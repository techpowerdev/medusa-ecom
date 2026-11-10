import { randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner, TestEventUtils } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, MathBN, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  addShippingMethodToCartWorkflow,
  cancelOrderFulfillmentWorkflow,
  cancelOrderWorkflow,
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
import { releaseEvoucherCodesForOrderWorkflow } from "../../src/workflows/evoucher/release-evoucher-codes-for-order"
import { evoucherOrderLockKey } from "../../src/workflows/evoucher/steps/evoucher-order"

jest.setTimeout(300 * 1000)

// ต้องตั้งก่อน runner โหลด medusa-config (module evoucher อ่าน key จาก env)
process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

const ADMIN_EMAIL = "ev16-admin@example.com"
const ADMIN_PASSWORD = "ev16-test-password"

type Voucher = { variantId: string; poolId: string; inventoryItemId: string }

// EV-16 (spec 02 กฎข้อ 32, AC-46): order.canceled → code `allocated` ของ order กลับเป็น `available`
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let service: EvoucherModuleService
    let adminHeaders: { headers: Record<string, string> }
    let regionId: string
    let salesChannelId: string
    let locationId: string
    let digitalOptionId: string
    let seq = 0

    beforeAll(async () => {
      container = getContainer()
      process.env.SEED_ADMIN_EMAIL = ADMIN_EMAIL
      process.env.SEED_ADMIN_PASSWORD = ADMIN_PASSWORD
      await seedThailand({ container, args: [] })

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      regionId = (await query.graph({ entity: "region", fields: ["id"] })).data[0].id
      salesChannelId = (
        await query.graph({
          entity: "sales_channel",
          fields: ["id"],
          filters: { name: "Default Sales Channel" },
        })
      ).data[0].id
      locationId = (await query.graph({ entity: "stock_location", fields: ["id"] })).data[0].id
      digitalOptionId = (
        await query.graph({
          entity: "shipping_option",
          fields: ["id"],
          filters: { type: { code: "digital-delivery" } },
        })
      ).data[0].id
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

    // pool + import ผ่าน admin route จริง (import ตั้ง stocked ของ inventory level ตามจำนวน code)
    const createVoucher = async (csv: string): Promise<Voucher> => {
      seq += 1
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: `Cancel voucher ${seq}`,
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
      const inventoryItemId = data[0].inventory_items![0]!.inventory_item_id
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [{ inventory_item_id: inventoryItemId, location_id: locationId, stocked_quantity: 0 }],
        },
      })
      const partner = await api.post("/admin/evoucher/partners", { name: `Partner ${seq}` }, adminHeaders)
      const pool = await api.post(
        "/admin/evoucher/pools",
        {
          partner_id: partner.data.partner.id,
          variant_id: variantId,
          name: `Pool ${seq}`,
          how_to_use: "แสดง code ที่แคชเชียร์",
        },
        adminHeaders
      )
      const form = new FormData()
      form.append("file", new Blob([csv], { type: "text/csv" }), "codes.csv")
      await api.post(`/admin/evoucher/pools/${pool.data.pool.id}/import`, form, adminHeaders)
      return { variantId, poolId: pool.data.pool.id, inventoryItemId }
    }

    // order ของลูกค้าที่มีบัญชี (ไม่ผ่าน store route — test นี้ทดสอบการยกเลิก ไม่ใช่ checkout)
    const placeOrder = async (items: { variant_id: string; quantity: number }[]) => {
      seq += 1
      const email = `ev16-buyer-${seq}@example.com`
      const customer = await container.resolve(Modules.CUSTOMER).createCustomers({ email, has_account: true })
      const { result: cart } = await createCartWorkflow(container).run({
        input: { region_id: regionId, customer_id: customer.id, email, sales_channel_id: salesChannelId, items },
      })
      await addShippingMethodToCartWorkflow(container).run({
        input: { cart_id: cart.id, options: [{ id: digitalOptionId }] },
      })
      const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
        input: { cart_id: cart.id },
      })
      await createPaymentSessionsWorkflow(container).run({
        input: { payment_collection_id: collection.id, provider_id: "pp_system_default" },
      })
      const { result: order } = await completeCartWorkflow(container).run({ input: { id: cart.id } })
      return order.id
    }

    const lineOf = async (orderId: string, variantId: string) => {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: ["items.id", "items.variant_id"],
        filters: { id: orderId },
      })
      return data[0].items!.find((i) => i!.variant_id === variantId)!.id
    }

    // admin ต้องยกเลิก fulfillment ก่อนยกเลิก order (cancel-order.js) — ยกเลิกทุก fulfillment ที่ยังไม่ถูกยกเลิก
    const cancelFulfillments = async (orderId: string) => {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: ["fulfillments.id", "fulfillments.canceled_at"],
        filters: { id: orderId },
      })
      for (const f of data[0].fulfillments ?? []) {
        if (f && !f.canceled_at) {
          await cancelOrderFulfillmentWorkflow(container).run({ input: { order_id: orderId, fulfillment_id: f.id } })
        }
      }
    }

    const andWaitCanceled = async (fn: () => Promise<unknown>) => {
      const done = TestEventUtils.waitSubscribersExecution("order.canceled", container.resolve(Modules.EVENT_BUS))
      await fn()
      await done
    }

    const cancelOrder = (orderId: string) =>
      andWaitCanceled(() => cancelOrderWorkflow(container).run({ input: { order_id: orderId } }))

    const sellable = async (v: Voucher) => {
      const [level] = await container
        .resolve(Modules.INVENTORY)
        .listInventoryLevels({ inventory_item_id: v.inventoryItemId, location_id: locationId })
      return MathBN.sub(level.stocked_quantity, level.reserved_quantity).toNumber()
    }

    const availableCount = async (v: Voucher) =>
      (await service.listEvoucherCodes({ pool_id: v.poolId, status: "available" })).length

    // Given ตาม AC-46: line X (pool PX) มี code `delivered`, line Y (pool PY) มี code `allocated`
    // (allocation จริงส่งมอบทั้งสอง line แล้วตั้ง code ของ Y กลับเป็น `allocated` แบบอีเมลล้มตามกฎข้อ 17)
    const givenDeliveredAndAllocated = async () => {
      const px = await createVoucher("X-0001\nX-0002\n")
      const py = await createVoucher("Y-0001\nY-0002\n")
      const orderId = await placeOrder([
        { variant_id: px.variantId, quantity: 1 },
        { variant_id: py.variantId, quantity: 1 },
      ])
      await allocateAndDeliverEvouchersWorkflow(container).run({ input: { order_id: orderId } })
      const lineY = await lineOf(orderId, py.variantId)
      const [codeY] = await service.listEvoucherCodes({ order_line_item_id: lineY })
      await service.updateEvoucherCodes({
        id: codeY.id,
        status: "allocated",
        delivered_at: null,
        delivered_to_email: null,
      })
      const [codeX] = await service.listEvoucherCodes({ order_line_item_id: await lineOf(orderId, px.variantId) })
      expect(codeX.status).toBe("delivered")
      return { px, py, orderId, codeX, codeY }
    }

    describe("AC-46 order.canceled releases allocated codes", () => {
      it("returns the allocated code of line Y to available, keeps the delivered code of line X and PY stock matches", async () => {
        const { py, orderId, codeX, codeY } = await givenDeliveredAndAllocated()
        await cancelFulfillments(orderId)

        await cancelOrder(orderId)

        const [y] = await service.listEvoucherCodes({ id: codeY.id })
        expect(y).toMatchObject({
          status: "available",
          order_id: null,
          order_line_item_id: null,
          customer_id: null,
          allocated_at: null,
        })
        const [x] = await service.listEvoucherCodes({ id: codeX.id })
        expect(x).toMatchObject({ status: "delivered", order_id: orderId })
        // กฎข้อ 32e: ไม่ปรับ inventory เอง — Medusa คืน stock ตอนยกเลิก fulfillment/ลบ reservation ตอนยกเลิก order
        expect(await availableCount(py)).toBe(2)
        expect(await sellable(py)).toBe(await availableCount(py))
      })

      it("is idempotent on a repeated event and never touches a code claimed by another order", async () => {
        const { py, orderId, codeX } = await givenDeliveredAndAllocated()
        await cancelFulfillments(orderId)
        await cancelOrder(orderId)
        // order อื่น (B) claim code ของ PY ไปหลัง A ถูกยกเลิก
        const otherOrderId = await placeOrder([{ variant_id: py.variantId, quantity: 2 }])
        await allocateAndDeliverEvouchersWorkflow(container).run({ input: { order_id: otherOrderId } })
        const claimedByB = await service.listEvoucherCodes({ order_id: otherOrderId }, { order: { id: "ASC" } })
        expect(claimedByB).toHaveLength(2)
        await service.updateEvoucherCodes({ id: claimedByB[0].id, status: "allocated", delivered_at: null })
        const before = await service.listEvoucherCodes({ pool_id: py.poolId }, { order: { id: "ASC" } })

        // event ซ้ำของ order A
        await andWaitCanceled(() =>
          container.resolve(Modules.EVENT_BUS).emit({ name: "order.canceled", data: { id: orderId } })
        )

        const after = await service.listEvoucherCodes({ pool_id: py.poolId }, { order: { id: "ASC" } })
        expect(after.map((c) => [c.id, c.status, c.order_id, c.allocated_at])).toEqual(
          before.map((c) => [c.id, c.status, c.order_id, c.allocated_at])
        )
        const [x] = await service.listEvoucherCodes({ id: codeX.id })
        expect(x).toMatchObject({ status: "delivered", order_id: orderId })
      })

      // กฎข้อ 32b: ถือ lock `evoucher-order:<order_id>` ร่วมกับ allocation/resend — รอจน run อื่นปล่อย lock
      it("waits for the per-order e-voucher lock held by allocation or resend", async () => {
        const { orderId, codeY } = await givenDeliveredAndAllocated()
        const locking = container.resolve(Modules.LOCKING)
        await locking.acquire(evoucherOrderLockKey(orderId), { ownerId: "ev16-other-run", expire: 60 })

        const running = releaseEvoucherCodesForOrderWorkflow(container).run({ input: { order_id: orderId } })
        await new Promise((resolve) => setTimeout(resolve, 1500))
        const [held] = await service.listEvoucherCodes({ id: codeY.id })
        expect(held.status).toBe("allocated")

        await locking.release(evoucherOrderLockKey(orderId), { ownerId: "ev16-other-run" })
        const { result } = await running

        expect(result).toEqual({ released: 1 })
        const [y] = await service.listEvoucherCodes({ id: codeY.id })
        expect(y.status).toBe("available")
        // run นี้ปล่อย lock ของตัวเองแล้ว — owner อื่นถือต่อได้ทันที
        await locking.acquire(evoucherOrderLockKey(orderId), { ownerId: "ev16-next-run", expire: 1 })
        await locking.release(evoucherOrderLockKey(orderId), { ownerId: "ev16-next-run" })
      })
    })
  },
})
