import { randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  addShippingMethodToCartWorkflow,
  cancelOrderWorkflow,
  capturePaymentWorkflow,
  completeCartWorkflow,
  createCartWorkflow,
  createInventoryLevelsWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { EVOUCHER_MODULE } from "../../src/modules/evoucher"
import EvoucherModuleService from "../../src/modules/evoucher/service"

jest.setTimeout(300 * 1000)

// ต้องตั้งก่อน runner โหลด medusa-config (module evoucher อ่าน key จาก env)
process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

const ADMIN_EMAIL = "ev23-admin@example.com"
const ADMIN_PASSWORD = "ev23-test-password"
const OPS_EMAIL = "ops-ev23@x.test"

const csvForm = (content: string) => {
  const form = new FormData()
  form.append("file", new Blob([content], { type: "text/csv" }), "codes.csv")
  return form
}

// error ของ axios มี circular reference (jest worker serialize ไม่ได้) → ห่อเป็น status/body
const statusOf = async (p: Promise<{ status: number; data: unknown }>): Promise<{ status: number; data: any }> => {
  try {
    const res = await p
    return { status: res.status, data: res.data as any }
  } catch (e: any) {
    if (!e?.response) {
      throw new Error(String(e?.message ?? e))
    }
    return { status: e.response.status as number, data: e.response.data as any }
  }
}

// setup ที่ต้องสำเร็จ — ล้มแล้วโยน Error ธรรมดา (ไม่ปล่อย error ของ axios)
const ok = async (p: Promise<{ status: number; data: unknown }>) => {
  const res = await statusOf(p)
  if (res.status >= 300) {
    throw new Error(`${res.status} ${JSON.stringify(res.data)}`)
  }
  return res.data
}

// EV-23 (spec 02 กฎข้อ 39, AC-53): POST /admin/evoucher/orders/:id/allocate — allocate ใหม่ให้ order ที่ backordered
// ด้วย allocateAndDeliverEvouchersWorkflow เดิม (lock ต่อ order + ข้าม line ที่มี code แล้ว)
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let service: EvoucherModuleService
    let adminHeaders: { headers: Record<string, string> }
    let regionId: string
    let salesChannelId: string
    let locationId: string
    let digitalOptionId: string
    let standardOptionId: string
    let seq = 0

    beforeAll(async () => {
      container = getContainer()
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      await seedThailand({ container, args: [] })

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: channels } = await query.graph({
        entity: "sales_channel",
        fields: ["id"],
        filters: { name: "Default Sales Channel" },
      })
      salesChannelId = channels[0].id
      const { data: locations } = await query.graph({ entity: "stock_location", fields: ["id"] })
      locationId = locations[0].id
      const { data: digital } = await query.graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { type: { code: "digital-delivery" } },
      })
      digitalOptionId = digital[0].id
      const { data: standard } = await query.graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { type: { code: "standard" } },
      })
      standardOptionId = standard[0].id
    })

    beforeEach(async () => {
      container = getContainer()
      service = container.resolve(EVOUCHER_MODULE)
      const { token } = await ok(
        api.post("/auth/user/emailpass", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      )
      adminHeaders = { headers: { authorization: `Bearer ${token}` } }
      process.env.EVOUCHER_ADMIN_EMAIL = OPS_EMAIL
    })

    afterEach(() => {
      delete process.env.EVOUCHER_ADMIN_EMAIL
    })

    const importCodes = (poolId: string, csv: string) =>
      ok(api.post(`/admin/evoucher/pools/${poolId}/import`, csvForm(csv), adminHeaders))

    const createVoucher = async (csv: string) => {
      seq += 1
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: `Retry voucher ${seq}`,
              status: "published",
              sales_channels: [{ id: salesChannelId }],
              options: [{ title: "Value", values: ["500"] }],
              variants: [
                {
                  title: "500 THB",
                  options: { Value: "500" },
                  manage_inventory: true,
                  prices: [{ currency_code: "thb", amount: 500 }],
                },
              ],
            },
          ],
        },
      })
      const variantId = result[0].variants[0].id
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: variantId },
      })
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            {
              inventory_item_id: data[0].inventory_items![0]!.inventory_item_id,
              location_id: locationId,
              stocked_quantity: 0,
            },
          ],
        },
      })
      const partner = await ok(
        api.post(
          "/admin/evoucher/partners",
          { name: `Retry ${seq}`, logo_url: "https://cdn.example.com/retry.png" },
          adminHeaders
        )
      )
      const pool = await ok(
        api.post(
          "/admin/evoucher/pools",
          {
            partner_id: partner.partner.id,
            variant_id: variantId,
            name: `Retry 500 #${seq}`,
            how_to_use: "แสดง code ที่แคชเชียร์",
          },
          adminHeaders
        )
      )
      const poolId = pool.pool.id as string
      await importCodes(poolId, csv)
      return { variantId, poolId }
    }

    const placeOrder = async (
      items: { variant_id: string; quantity: number }[],
      optionIds: string[] = [digitalOptionId]
    ) => {
      seq += 1
      const email = `ev23-buyer-${seq}@example.com`
      const customer = await container
        .resolve(Modules.CUSTOMER)
        .createCustomers({ email, has_account: true })
      const { result: cart } = await createCartWorkflow(container).run({
        input: {
          region_id: regionId,
          customer_id: customer.id,
          email,
          sales_channel_id: salesChannelId,
          shipping_address: {
            first_name: "Somchai",
            last_name: "Jaidee",
            address_1: "1 Sukhumvit",
            city: "Bangkok",
            postal_code: "10110",
            country_code: "th",
          },
          items,
        },
      })
      await addShippingMethodToCartWorkflow(container).run({
        input: { cart_id: cart.id, options: optionIds.map((id) => ({ id })) },
      })
      const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
        input: { cart_id: cart.id },
      })
      await createPaymentSessionsWorkflow(container).run({
        input: { payment_collection_id: collection.id, provider_id: "pp_system_default" },
      })
      const { result: order } = await completeCartWorkflow(container).run({ input: { id: cart.id } })
      return { orderId: order.id, email }
    }

    const orderOf = async (orderId: string) => {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: ["id", "items.id", "items.metadata", "payment_collections.payments.id"],
        filters: { id: orderId },
      })
      return data[0]
    }

    // void code ที่เหลือ + ลด inventory (แบบ job รายวัน) → pool ว่างตอน capture
    const emptyPool = async (poolId: string) => {
      const codes = await service.listEvoucherCodes({ pool_id: poolId, status: "available" })
      const { variant_id } = await service.retrieveEvoucherPool(poolId, { select: ["variant_id"] })
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory_item_id"],
        filters: { id: variant_id },
      })
      for (const code of codes) {
        await service.voidAvailableCodes({ id: code.id }, "expiring")
        await container
          .resolve(Modules.INVENTORY)
          .adjustInventory(data[0].inventory_items![0]!.inventory_item_id, locationId, -1)
      }
    }

    const captureAndWait = async (orderId: string) => {
      const order = await orderOf(orderId)
      const done = TestEventUtils.waitSubscribersExecution(
        "payment.captured",
        container.resolve(Modules.EVENT_BUS)
      )
      await capturePaymentWorkflow(container).run({
        input: { payment_id: order.payment_collections![0]!.payments![0]!.id },
      })
      await done
    }

    const listEmails = (template: string) =>
      container.resolve(Modules.NOTIFICATION).listNotifications({ channel: "email", template })

    // order backordered: pool มี code 1 ตัว ถูก void ก่อน capture → subscriber ตั้งธง + อีเมล admin 1 ฉบับ
    const backorderedOrder = async () => {
      const { variantId, poolId } = await createVoucher(`R${seq}-0\n`)
      const { orderId, email } = await placeOrder([{ variant_id: variantId, quantity: 1 }])
      await emptyPool(poolId)
      await captureAndWait(orderId)
      const order = await orderOf(orderId)
      const lineId = order.items![0]!.id
      expect(order.items![0]!.metadata).toMatchObject({ evoucher_backordered: true })
      expect(await listEmails("evoucher-backordered")).toHaveLength(1)
      return { orderId, email, poolId, lineId }
    }

    const allocate = (orderId: string, headers: object = adminHeaders) =>
      statusOf(api.post(`/admin/evoucher/orders/${orderId}/allocate`, {}, headers))

    describe("AC-53 retry allocation", () => {
      it("allocates and delivers the backordered line after codes are imported and clears the flag", async () => {
        const { orderId, email, poolId, lineId } = await backorderedOrder()
        await importCodes(poolId, "RETRY-NEW-1\n")

        const res = await allocate(orderId)

        expect(res.status).toBe(200)
        expect(res.data).toEqual({ allocated_line_item_ids: [lineId], backordered_line_item_ids: [] })
        const codes = await service.listEvoucherCodes({ order_id: orderId })
        expect(codes).toEqual([expect.objectContaining({ status: "delivered", order_line_item_id: lineId })])
        const delivered = await listEmails("evoucher.delivered")
        expect(delivered).toEqual([expect.objectContaining({ to: email })])
        expect((await orderOf(orderId)).items![0]!.metadata?.evoucher_backordered).toBeFalsy()
      })

      it("claims codes only once and sends one customer email for two concurrent requests", async () => {
        const { orderId, poolId, lineId } = await backorderedOrder()
        await importCodes(poolId, "RACE-1\nRACE-2\n")

        const results = await Promise.all([allocate(orderId), allocate(orderId)])

        expect(results.map((r) => r.status)).toEqual([200, 200])
        // ตัวที่ได้ lock ก่อน allocate ตัวหลังเห็น line มี code แล้ว → ผลว่าง (noop)
        expect(results.flatMap((r) => r.data.allocated_line_item_ids)).toEqual([lineId])
        expect(results.flatMap((r) => r.data.backordered_line_item_ids)).toEqual([])
        expect(await service.listEvoucherCodes({ order_id: orderId })).toHaveLength(1)
        expect(await service.listEvoucherCodes({ pool_id: poolId, status: "available" })).toHaveLength(1)
        expect(await listEmails("evoucher.delivered")).toHaveLength(1)
      })

      it("returns the still-backordered line without another admin email when no codes were imported", async () => {
        const { orderId, lineId } = await backorderedOrder()

        const res = await allocate(orderId)

        expect(res.status).toBe(200)
        expect(res.data).toEqual({ allocated_line_item_ids: [], backordered_line_item_ids: [lineId] })
        expect(await listEmails("evoucher-backordered")).toHaveLength(1)
        expect(await listEmails("evoucher.delivered")).toHaveLength(0)
        expect((await orderOf(orderId)).items![0]!.metadata).toMatchObject({ evoucher_backordered: true })
      })

      it("returns an empty result (noop) when no line is backordered", async () => {
        const { variantId } = await createVoucher("NOOP-1\n")
        const { orderId } = await placeOrder([{ variant_id: variantId, quantity: 1 }])
        await captureAndWait(orderId)

        const res = await allocate(orderId)

        expect(res.status).toBe(200)
        expect(res.data).toEqual({ allocated_line_item_ids: [], backordered_line_item_ids: [] })
        expect(await listEmails("evoucher.delivered")).toHaveLength(1)
      })

      it("rejects a canceled order with 400 not_allowed", async () => {
        const { variantId } = await createVoucher("CXL-1\n")
        const { orderId } = await placeOrder([{ variant_id: variantId, quantity: 1 }])
        await cancelOrderWorkflow(container).run({ input: { order_id: orderId } })

        const res = await allocate(orderId)

        expect(res.status).toBe(400)
        expect(res.data.type).toBe("not_allowed")
        expect(await service.listEvoucherCodes({ order_id: orderId })).toHaveLength(0)
      })

      it("rejects an order without e-voucher lines with 400 not_allowed", async () => {
        const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "product",
          fields: ["variants.id"],
          filters: { handle: "t-shirt" },
        })
        const { orderId } = await placeOrder([{ variant_id: data[0].variants[0].id, quantity: 1 }], [standardOptionId])

        const res = await allocate(orderId)

        expect(res.status).toBe(400)
        expect(res.data.type).toBe("not_allowed")
      })

      it("returns 404 for an unknown order", async () => {
        const res = await allocate("order_does_not_exist")

        expect(res.status).toBe(404)
      })

      it("returns 401 without an admin token", async () => {
        const res = await allocate("order_does_not_exist", {})

        expect(res.status).toBe(401)
      })
    })
  },
})
