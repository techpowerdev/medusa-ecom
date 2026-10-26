import { randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  addShippingMethodToCartWorkflow,
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
import { allocateAndDeliverEvouchersWorkflow } from "../../src/workflows/evoucher/allocate-and-deliver-evouchers"

jest.setTimeout(300 * 1000)

// ต้องตั้งก่อน runner โหลด medusa-config (module evoucher อ่าน key จาก env)
process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

const ADMIN_EMAIL = "ev4-admin@example.com"
const ADMIN_PASSWORD = "ev4-test-password"
const OPS_EMAIL = "ops@x.test"
const DAY = 24 * 60 * 60 * 1000
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString()

const csvForm = (content: string) => {
  const form = new FormData()
  form.append("file", new Blob([content], { type: "text/csv" }), "codes.csv")
  return form
}

// EV-4: allocate & deliver หลัง payment.captured (AC-2, AC-4, AC-7, AC-17 ส่วน backordered)
// วาง order ผ่าน core workflow ตรง (ไม่ผ่าน store route) — test นี้ทดสอบการส่งมอบ ไม่ใช่ auth ของ store
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let service: EvoucherModuleService
    let adminHeaders: { headers: Record<string, string> }
    let regionId: string
    let salesChannelId: string
    let locationId: string
    let digitalProfileId: string
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
      const { data: profiles } = await query.graph({
        entity: "shipping_profile",
        fields: ["id"],
        filters: { type: "digital" },
      })
      digitalProfileId = profiles[0].id
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
      const { data } = await api.post("/auth/user/emailpass", {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      })
      adminHeaders = { headers: { authorization: `Bearer ${data.token}` } }
    })

    afterEach(() => {
      jest.restoreAllMocks()
      delete process.env.EVOUCHER_ADMIN_EMAIL
    })

    // voucher variant (profile Digital) + pool + import CSV ผ่าน admin API (inventory = จำนวน code)
    const createVoucher = async (csv: string, { digitalProfile = true } = {}) => {
      seq += 1
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: `Lotus voucher ${seq}`,
              status: "published",
              ...(digitalProfile ? { shipping_profile_id: digitalProfileId } : {}),
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
      const inventoryItemId = data[0].inventory_items![0]!.inventory_item_id
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            { inventory_item_id: inventoryItemId, location_id: locationId, stocked_quantity: 0 },
          ],
        },
      })
      const partner = await api.post(
        "/admin/evoucher/partners",
        { name: `Lotus ${seq}`, logo_url: "https://cdn.example.com/lotus.png" },
        adminHeaders
      )
      const pool = await api.post(
        "/admin/evoucher/pools",
        {
          partner_id: partner.data.partner.id,
          variant_id: variantId,
          name: `Lotus 500 #${seq}`,
          how_to_use: "แสดง code ที่แคชเชียร์",
        },
        adminHeaders
      )
      const poolId = pool.data.pool.id as string
      await api.post(`/admin/evoucher/pools/${poolId}/import`, csvForm(csv), adminHeaders)
      return { variantId, inventoryItemId, poolId }
    }

    const placeOrder = async (
      items: { variant_id: string; quantity: number }[],
      optionIds: string[] = [digitalOptionId]
    ) => {
      seq += 1
      const email = `ev4-buyer-${seq}@example.com`
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
      return { orderId: order.id, email, customerId: customer.id }
    }

    const orderOf = async (orderId: string) => {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: [
          "id",
          "items.id",
          "items.metadata",
          "items.variant_id",
          "fulfillments.id",
          "fulfillments.provider_id",
          "payment_collections.payments.id",
        ],
        filters: { id: orderId },
      })
      return data[0]
    }

    // capture ผ่าน core workflow → event payment.captured → subscriber ของ EV-4
    const captureAndWait = async (orderId: string) => {
      const order = await orderOf(orderId)
      const paymentId = order.payment_collections![0]!.payments![0]!.id
      const done = TestEventUtils.waitSubscribersExecution(
        "payment.captured",
        container.resolve(Modules.EVENT_BUS)
      )
      await capturePaymentWorkflow(container).run({ input: { payment_id: paymentId } })
      await done
    }

    const listEmails = (filters: Record<string, unknown>) =>
      container.resolve(Modules.NOTIFICATION).listNotifications({ channel: "email", ...filters })

    const stockedQuantity = async (inventoryItemId: string) => {
      const levels = await container
        .resolve(Modules.INVENTORY)
        .listInventoryLevels({ inventory_item_id: inventoryItemId })
      return levels.reduce((sum, l) => sum + Number(l.stocked_quantity), 0)
    }

    const voidCode = async (poolId: string) => {
      const [code] = await service.listEvoucherCodes({ pool_id: poolId, status: "available" })
      await api.post(`/admin/evoucher/codes/${code.id}/void`, { reason: "partner recalled" }, adminHeaders)
    }

    describe("AC-2 deliver after payment.captured", () => {
      it("delivers 2 codes for qty 2 in one customer email with codes, PIN, how-to-use and expiry", async () => {
        const expires = inDays(30)
        const { variantId, inventoryItemId, poolId } = await createVoucher(
          `code,pin,expires_at\nLOTUS-0001,1111,${expires}\nLOTUS-0002,2222,\nLOTUS-0003,3333,\n`
        )
        const { orderId, email, customerId } = await placeOrder([{ variant_id: variantId, quantity: 2 }])
        const info = jest.spyOn(container.resolve(ContainerRegistrationKeys.LOGGER), "info")
        // ยังไม่ capture → ยังไม่ allocate (กฎข้อ 2)
        expect(await service.listEvoucherCodes({ order_id: orderId })).toHaveLength(0)

        await captureAndWait(orderId)

        const order = await orderOf(orderId)
        const codes = await service.listEvoucherCodes({ order_id: orderId })
        expect(codes).toHaveLength(2)
        for (const code of codes) {
          expect(code).toMatchObject({
            status: "delivered",
            order_id: orderId,
            order_line_item_id: order.items![0]!.id,
            customer_id: customerId,
            delivered_to_email: email,
            delivered_at: expect.any(Date),
          })
        }
        // ตาม expires_at ก่อน: code ที่มีวันหมดอายุถูกใช้ก่อน code ไม่มีวันหมดอายุ
        const plain = await Promise.all(codes.map((c) => service.decryptSecret(c.code)))
        expect(plain).toContain("LOTUS-0001")

        // fulfillment ผ่าน provider digital (ADR-006) และ inventory = จำนวน code available (กฎข้อ 1)
        expect(order.fulfillments).toEqual([expect.objectContaining({ provider_id: "digital_digital" })])
        expect(await stockedQuantity(inventoryItemId)).toBe(1)
        expect(await service.listEvoucherCodes({ pool_id: poolId, status: "available" })).toHaveLength(1)

        const emails = await listEmails({ template: "evoucher.delivered" })
        expect(emails).toHaveLength(1)
        expect(emails[0]).toMatchObject({ to: email, status: "success", resource_id: orderId })
        const [voucher] = (emails[0].data as any).vouchers
        expect(voucher).toMatchObject({
          how_to_use: "แสดง code ที่แคชเชียร์",
          partner: expect.objectContaining({ logo_url: "https://cdn.example.com/lotus.png" }),
        })
        // owner: code/PIN ใน notification.data เป็น ciphertext เท่านั้น — provider ถอดตอน render
        expect(JSON.stringify(emails[0].data)).not.toMatch(/LOTUS-000|1111|2222/)
        expect(voucher.codes).toHaveLength(2)
        const decrypted = await Promise.all(
          voucher.codes.map(async (c: { code: string; pin: string; expires_at: string | null }) => ({
            code: await service.decryptSecret(c.code),
            pin: await service.decryptSecret(c.pin),
            expires_at: c.expires_at,
          }))
        )
        expect(decrypted).toEqual(
          expect.arrayContaining([
            { code: "LOTUS-0001", pin: "1111", expires_at: expect.stringContaining(expires.slice(0, 10)) },
            expect.objectContaining({ code: plain.find((p) => p !== "LOTUS-0001"), pin: expect.any(String) }),
          ])
        )
        // local provider log data → ต้องไม่มี plaintext
        expect(JSON.stringify(info.mock.calls)).not.toMatch(/LOTUS-000/)
      })

      it("fulfils vouchers via Digital delivery even when a mixed order only has the Standard method", async () => {
        // owner: voucher อยู่ profile Digital เสมอ → cart ผสมต้องมีทั้ง Standard และ Digital
        const { variantId } = await createVoucher("MIX-1\nMIX-2\n")
        const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "product",
          fields: ["variants.id"],
          filters: { handle: "t-shirt" },
        })
        const tshirt = data[0].variants[0].id
        // shipping_methods[0] = Standard (manual) — createOrderFulfillmentWorkflow ต้องไม่ใช้ค่านี้กับ voucher
        const { orderId } = await placeOrder(
          [
            { variant_id: tshirt, quantity: 1 },
            { variant_id: variantId, quantity: 1 },
          ],
          [standardOptionId, digitalOptionId]
        )

        await captureAndWait(orderId)

        const order = await orderOf(orderId)
        expect(order.fulfillments).toEqual([expect.objectContaining({ provider_id: "digital_digital" })])
        expect(await service.listEvoucherCodes({ order_id: orderId, status: "delivered" })).toHaveLength(1)
      })

      it("warns (but still delivers) when a voucher product is not in the Digital shipping profile", async () => {
        const { variantId } = await createVoucher("NOPROF-1\n", { digitalProfile: false })
        const { orderId } = await placeOrder([{ variant_id: variantId, quantity: 1 }])
        const warn = jest.spyOn(container.resolve(ContainerRegistrationKeys.LOGGER), "warn")

        await captureAndWait(orderId)

        expect(warn).toHaveBeenCalledWith(expect.stringMatching(/shipping profile/i))
        expect(await service.listEvoucherCodes({ order_id: orderId, status: "delivered" })).toHaveLength(1)
      })

      it("does nothing for an order without voucher items", async () => {
        const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "product",
          fields: ["variants.id"],
          filters: { handle: "t-shirt" },
        })
        const { orderId } = await placeOrder([{ variant_id: data[0].variants[0].id, quantity: 1 }], [standardOptionId])

        await captureAndWait(orderId)

        expect((await orderOf(orderId)).fulfillments).toEqual([])
        expect(await listEmails({ template: "evoucher.delivered" })).toHaveLength(0)
      })
    })

    describe("AC-7 idempotent", () => {
      it("re-running for the same order allocates no more codes and sends no more emails", async () => {
        const { variantId } = await createVoucher("A-1\nA-2\nA-3\nA-4\n")
        const { orderId } = await placeOrder([{ variant_id: variantId, quantity: 2 }])
        await captureAndWait(orderId)

        await allocateAndDeliverEvouchersWorkflow(container).run({ input: { order_id: orderId } })
        // event ซ้ำ
        const done = TestEventUtils.waitSubscribersExecution(
          "payment.captured",
          container.resolve(Modules.EVENT_BUS)
        )
        const order = await orderOf(orderId)
        await container
          .resolve(Modules.EVENT_BUS)
          .emit({ name: "payment.captured", data: { id: order.payment_collections![0]!.payments![0]!.id } })
        await done

        expect(await service.listEvoucherCodes({ order_id: orderId })).toHaveLength(2)
        expect(await listEmails({ template: "evoucher.delivered" })).toHaveLength(1)
        expect((await orderOf(orderId)).fulfillments).toHaveLength(1)
      })

      it("keeps the codes with the order and alerts EVOUCHER_ADMIN_EMAIL when the customer email fails", async () => {
        const { variantId, inventoryItemId, poolId } = await createVoucher("B-1\nB-2\n")
        const { orderId, email } = await placeOrder([{ variant_id: variantId, quantity: 1 }])
        // ล้มเฉพาะอีเมล e-voucher ถึงลูกค้า (subscriber order.placed ส่งอีเมลของตัวเองแบบ async อยู่ด้วย)
        const notifications = container.resolve(Modules.NOTIFICATION)
        const original = notifications.createNotifications.bind(notifications)
        jest.spyOn(notifications, "createNotifications").mockImplementation((async (
          data: Parameters<typeof original>[0]
        ) => {
          if (JSON.stringify(data).includes("evoucher.delivered")) {
            throw new Error("resend down")
          }
          return original(data)
        }) as typeof original)
        const warn = jest.spyOn(container.resolve(ContainerRegistrationKeys.LOGGER), "warn")

        await allocateAndDeliverEvouchersWorkflow(container).run({
          input: { order_id: orderId, admin_email: OPS_EMAIL },
        })

        // ห้ามคืน code เข้า pool (ห้าม resale): code อยู่กับ order และ fulfillment คงอยู่
        const codes = await service.listEvoucherCodes({ pool_id: poolId }, { order: { status: "ASC" } })
        expect(codes.filter((c) => c.order_id === orderId)).toEqual([
          expect.objectContaining({ status: "delivered", delivered_to_email: email }),
        ])
        expect(codes.filter((c) => c.status === "available")).toHaveLength(1)
        expect((await orderOf(orderId)).fulfillments).toHaveLength(1)
        expect(await stockedQuantity(inventoryItemId)).toBe(1)

        expect(warn).toHaveBeenCalledWith(expect.stringContaining("resend down"))
        const alerts = await listEmails({ template: "evoucher-delivery-failed" })
        expect(alerts).toHaveLength(1)
        expect(alerts[0]).toMatchObject({ to: OPS_EMAIL, resource_id: orderId })

        // รันซ้ำ → ไม่ allocate code ใหม่ให้ order เดิม
        await allocateAndDeliverEvouchersWorkflow(container).run({ input: { order_id: orderId } })
        expect(await service.listEvoucherCodes({ order_id: orderId })).toHaveLength(1)
      })

      it("uses a new idempotency key per claim and clears the backordered flag once delivered", async () => {
        const a = await createVoucher("PA-1\n")
        const b = await createVoucher("PB-1\n")
        const { orderId } = await placeOrder([
          { variant_id: a.variantId, quantity: 1 },
          { variant_id: b.variantId, quantity: 1 },
        ])
        await voidCode(b.poolId)

        await allocateAndDeliverEvouchersWorkflow(container).run({
          input: { order_id: orderId, admin_email: OPS_EMAIL },
        })
        const lineB = (await orderOf(orderId)).items!.find((i) => i!.variant_id === b.variantId)!
        expect(lineB.metadata).toMatchObject({ evoucher_backordered: true })

        // admin import code เพิ่ม แล้ว trigger ใหม่ → line B ส่งมอบได้ (claim ใหม่ = key ใหม่)
        await api.post(`/admin/evoucher/pools/${b.poolId}/import`, csvForm("PB-2\n"), adminHeaders)
        await allocateAndDeliverEvouchersWorkflow(container).run({
          input: { order_id: orderId, admin_email: OPS_EMAIL },
        })

        const emails = await listEmails({ template: "evoucher.delivered" })
        expect(emails).toHaveLength(2)
        expect(new Set(emails.map((e) => (e as { idempotency_key?: string }).idempotency_key)).size).toBe(2)
        expect(await service.listEvoucherCodes({ order_id: orderId, status: "delivered" })).toHaveLength(2)
        const after = (await orderOf(orderId)).items!.find((i) => i!.variant_id === b.variantId)!
        expect(after.metadata?.evoucher_backordered).toBeFalsy()
      })
    })

    describe("AC-4 backordered when no code is left", () => {
      it("gives the last code to only one of two concurrently captured orders and flags the other", async () => {
        const { variantId, inventoryItemId, poolId } = await createVoucher("LAST-1\nLAST-2\n")
        const a = await placeOrder([{ variant_id: variantId, quantity: 1 }])
        const b = await placeOrder([{ variant_id: variantId, quantity: 1 }])
        // void ลด stocked_quantity โดยไม่ดู reservation → สอง order ที่ยังไม่ capture เหลือ code ให้เพียงหนึ่ง
        // (เรียก workflow ตรงแทน capture เพื่อควบคุมให้รันพร้อมกัน)
        await voidCode(poolId)
        expect(await stockedQuantity(inventoryItemId)).toBe(1)

        const results = await Promise.all(
          [a, b].map((o) =>
            allocateAndDeliverEvouchersWorkflow(container).run({
              input: { order_id: o.orderId, admin_email: OPS_EMAIL },
            })
          )
        )

        const delivered = await service.listEvoucherCodes({ pool_id: poolId, status: "delivered" })
        expect(delivered).toHaveLength(1)
        const winner = delivered[0].order_id === a.orderId ? a : b
        const loser = winner === a ? b : a
        expect(results.map((r) => r.result.backordered.length).sort()).toEqual([0, 1])

        const loserOrder = await orderOf(loser.orderId)
        expect(loserOrder.items![0]!.metadata).toMatchObject({ evoucher_backordered: true })
        expect(loserOrder.fulfillments).toEqual([])
        expect((await orderOf(winner.orderId)).items![0]!.metadata?.evoucher_backordered).toBeUndefined()

        const customerEmails = await listEmails({ template: "evoucher.delivered" })
        expect(customerEmails.map((e) => e.to)).toEqual([winner.email])
        const adminEmails = await listEmails({ template: "evoucher-backordered" })
        expect(adminEmails).toHaveLength(1)
        expect(adminEmails[0]).toMatchObject({ to: OPS_EMAIL, resource_id: loser.orderId })
        expect(await stockedQuantity(inventoryItemId)).toBe(0)

        // รันซ้ำ (ยังไม่มี code) → ไม่มีอีเมล admin ซ้ำ
        await allocateAndDeliverEvouchersWorkflow(container).run({
          input: { order_id: loser.orderId, admin_email: OPS_EMAIL },
        })
        expect(await listEmails({ template: "evoucher-backordered" })).toHaveLength(1)
      })
    })

    describe("AC-17 backordered admin email goes to EVOUCHER_ADMIN_EMAIL only", () => {
      const backorderedOrder = async () => {
        const { variantId, poolId } = await createVoucher("GONE-1\n")
        const order = await placeOrder([{ variant_id: variantId, quantity: 1 }])
        await voidCode(poolId)
        return order
      }

      it("sends one notification to the mailbox and none to the 3 admin users", async () => {
        const users = container.resolve(Modules.USER)
        await users.createUsers([{ email: "admin2@example.com" }, { email: "admin3@example.com" }])
        expect(await users.listUsers()).toHaveLength(3)
        process.env.EVOUCHER_ADMIN_EMAIL = OPS_EMAIL
        const { orderId } = await backorderedOrder()

        await captureAndWait(orderId)

        const emails = await listEmails({ template: "evoucher-backordered" })
        expect(emails).toHaveLength(1)
        expect(emails[0]).toMatchObject({ to: OPS_EMAIL, resource_id: orderId })
        const all = await listEmails({})
        const adminEmails = (await users.listUsers()).map((u) => u.email)
        expect(all.filter((e) => adminEmails.includes(e.to))).toHaveLength(0)
        expect((await orderOf(orderId)).items![0]!.metadata).toMatchObject({ evoucher_backordered: true })
      })

      it("logs a warning and sends nothing when EVOUCHER_ADMIN_EMAIL is not set (order still flagged)", async () => {
        const { orderId } = await backorderedOrder()
        const warn = jest.spyOn(container.resolve(ContainerRegistrationKeys.LOGGER), "warn")

        await captureAndWait(orderId)

        expect(warn).toHaveBeenCalledWith(expect.stringContaining("EVOUCHER_ADMIN_EMAIL"))
        expect(await listEmails({ template: "evoucher-backordered" })).toHaveLength(0)
        expect((await orderOf(orderId)).items![0]!.metadata).toMatchObject({ evoucher_backordered: true })
      })
    })
  },
})
