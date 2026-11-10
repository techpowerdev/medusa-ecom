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
import { resendEvoucherEmailWorkflow } from "../../src/workflows/evoucher/resend-evoucher-email"
import { evoucherOrderLockKey } from "../../src/workflows/evoucher/steps/evoucher-order"
import evoucherOrderCanceledHandler from "../../src/subscribers/evoucher-order-canceled"
import { EmailTemplates } from "../../src/modules/resend/templates"

// provider ของ Notification module ใน test — ให้ provider throw เฉพาะ `evoucher.delivered` (อีเมลล้มตามกฎข้อ 17)
import localNotificationProvider from "@medusajs/medusa/notification-local"

jest.setTimeout(300 * 1000)

// ต้องตั้งก่อน runner โหลด medusa-config (module evoucher อ่าน key จาก env)
process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

const ADMIN_EMAIL = "ev16-admin@example.com"
const ADMIN_PASSWORD = "ev16-test-password"

type Voucher = { variantId: string; poolId: string; inventoryItemId: string }

// EV-16 (spec 02 กฎข้อ 32, AC-46): order.canceled → code `allocated` ของ order กลับเป็น `available`
// EV-17 (spec 02 กฎข้อ 33, AC-47): อีเมล code สำเร็จ → shipment แบบ no_notification (ยกเลิก fulfillment ของ code ที่ส่งมอบแล้วไม่ได้)
// EV-18 (spec 02 กฎข้อ 34, AC-48): allocation ข้าม order ที่ถูกยกเลิกแล้วอย่างเงียบ (payment.captured มาช้า)
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

    afterEach(() => {
      jest.restoreAllMocks()
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

    // subscriber กลืน error เป็น log (กฎข้อ 32b) — "ไม่ error" จึงตรวจจาก logger.error ที่ขึ้นต้นด้วย `evoucher:`
    const evoucherErrors = () => {
      const spy = jest.spyOn(container.resolve(ContainerRegistrationKeys.LOGGER), "error")
      return () => {
        const lines = spy.mock.calls.map(([line]) => String(line)).filter((line) => line.startsWith("evoucher:"))
        spy.mockRestore()
        return lines
      }
    }

    const sellable = async (v: Voucher) => {
      const [level] = await container
        .resolve(Modules.INVENTORY)
        .listInventoryLevels({ inventory_item_id: v.inventoryItemId, location_id: locationId })
      return MathBN.sub(level.stocked_quantity, level.reserved_quantity).toNumber()
    }

    const availableCount = async (v: Voucher) =>
      (await service.listEvoucherCodes({ pool_id: v.poolId, status: "available" })).length

    // อีเมล `evoucher.delivered` ล้มที่ provider (Notification module บันทึก failure ตามจริง) — อีเมลอื่นส่งปกติ
    const failDeliveryEmail = () => {
      const LocalProvider = localNotificationProvider.services[0]
      const originalSend = LocalProvider.prototype.send
      return jest.spyOn(LocalProvider.prototype, "send").mockImplementation(async function (
        this: unknown,
        notification: { template: string }
      ) {
        if (notification.template === "evoucher.delivered") {
          throw new Error("smtp down")
        }
        return originalSend.call(this, notification)
      })
    }

    const orderStatus = async (orderId: string) =>
      (
        await container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "order",
          fields: ["status"],
          filters: { id: orderId },
        })
      ).data[0].status

    const levelOf = async (v: Voucher) => {
      const [level] = await container
        .resolve(Modules.INVENTORY)
        .listInventoryLevels({ inventory_item_id: v.inventoryItemId, location_id: locationId })
      return {
        stocked: MathBN.convert(level.stocked_quantity).toNumber(),
        reserved: MathBN.convert(level.reserved_quantity).toNumber(),
      }
    }

    // route admin ที่ต้องถูกปฏิเสธ — คืนแค่ status/type (ไม่ปล่อย error ของ axios ที่มี circular reference ออกจาก test)
    const adminRejection = async (path: string) => {
      let response: { status: number; data: unknown }
      try {
        response = await api.post(path, {}, adminHeaders)
      } catch (error) {
        const { status, data } = (error as { response?: { status: number; data?: { type?: string } } }).response ?? {}
        if (!status) {
          throw new Error(`no response from ${path}: ${(error as Error).message}`)
        }
        return { status, type: data?.type }
      }
      throw new Error(`${path} expected a 4xx but got ${response.status} ${JSON.stringify(response.data).slice(0, 200)}`)
    }

    const fulfillmentsOf = async (orderId: string) => {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: ["fulfillments.id", "fulfillments.shipped_at", "fulfillments.canceled_at"],
        filters: { id: orderId },
      })
      return (data[0].fulfillments ?? []).filter((f): f is NonNullable<typeof f> => !!f)
    }

    // Given ตาม AC-46: line X (pool PX) มี code `delivered`, line Y (pool PY) มี code `allocated`
    // (allocation จริงที่อีเมลล้มตามกฎข้อ 17 → ทั้งสอง line `allocated` และ fulfillment ยังไม่ shipped แล้วตั้ง code ของ X
    // เป็น `delivered` ด้วย updateEvoucherCodes — สภาพของ code ที่ส่งมอบแล้วแต่สร้าง shipment ไม่สำเร็จ ตามกฎข้อ 33d)
    const givenDeliveredAndAllocated = async () => {
      const px = await createVoucher("X-0001\nX-0002\n")
      const py = await createVoucher("Y-0001\nY-0002\n")
      const orderId = await placeOrder([
        { variant_id: px.variantId, quantity: 1 },
        { variant_id: py.variantId, quantity: 1 },
      ])
      const send = failDeliveryEmail()
      await allocateAndDeliverEvouchersWorkflow(container).run({ input: { order_id: orderId } })
      send.mockRestore()
      const [codeX] = await service.listEvoucherCodes({ order_line_item_id: await lineOf(orderId, px.variantId) })
      await service.updateEvoucherCodes({
        id: codeX.id,
        status: "delivered",
        delivered_at: new Date(),
        delivered_to_email: "ev16-buyer@example.com",
      })
      const [codeY] = await service.listEvoucherCodes({ order_line_item_id: await lineOf(orderId, py.variantId) })
      expect(codeY.status).toBe("allocated")
      return { px, py, orderId, codeX: { ...codeX, status: "delivered" }, codeY }
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
        const errors = evoucherErrors()
        await andWaitCanceled(() =>
          container.resolve(Modules.EVENT_BUS).emit({ name: "order.canceled", data: { id: orderId } })
        )
        expect(errors()).toEqual([])
        expect(
          (await releaseEvoucherCodesForOrderWorkflow(container).run({ input: { order_id: orderId } })).result
        ).toEqual({ released: 0 })

        const after = await service.listEvoucherCodes({ pool_id: py.poolId }, { order: { id: "ASC" } })
        expect(after.map((c) => [c.id, c.status, c.order_id, c.allocated_at])).toEqual(
          before.map((c) => [c.id, c.status, c.order_id, c.allocated_at])
        )
        const [x] = await service.listEvoucherCodes({ id: codeX.id })
        expect(x).toMatchObject({ status: "delivered", order_id: orderId })
      })

      it("releases the code exactly once when two runs for the same order arrive together", async () => {
        const { orderId, codeX, codeY } = await givenDeliveredAndAllocated()

        const runs = await Promise.all([
          releaseEvoucherCodesForOrderWorkflow(container).run({ input: { order_id: orderId } }),
          releaseEvoucherCodesForOrderWorkflow(container).run({ input: { order_id: orderId } }),
        ])

        expect(runs.map(({ result }) => result.released).sort()).toEqual([0, 1])
        const [y] = await service.listEvoucherCodes({ id: codeY.id })
        expect(y).toMatchObject({ status: "available", order_id: null, order_line_item_id: null })
        const [x] = await service.listEvoucherCodes({ id: codeX.id })
        expect(x).toMatchObject({ status: "delivered", order_id: orderId })
      })

      it("handles two order.canceled events of the same order delivered together without an error", async () => {
        const { orderId, codeX, codeY } = await givenDeliveredAndAllocated()
        const event = { name: "order.canceled", data: { id: orderId } }
        const errors = evoucherErrors()

        await Promise.all([
          evoucherOrderCanceledHandler({ event, container } as never),
          evoucherOrderCanceledHandler({ event, container } as never),
        ])

        expect(errors()).toEqual([])
        const [y] = await service.listEvoucherCodes({ id: codeY.id })
        expect(y).toMatchObject({ status: "available", order_id: null })
        const [x] = await service.listEvoucherCodes({ id: codeX.id })
        expect(x).toMatchObject({ status: "delivered", order_id: orderId })
      })

      it("cancels an order without e-vouchers without an error", async () => {
        seq += 1
        const { result } = await createProductsWorkflow(container).run({
          input: {
            products: [
              {
                title: `Plain product ${seq}`,
                status: "published",
                sales_channels: [{ id: salesChannelId }],
                options: [{ title: "Size", values: ["One"] }],
                variants: [
                  {
                    title: "One",
                    options: { Size: "One" },
                    manage_inventory: false,
                    prices: [{ currency_code: "thb", amount: 300 }],
                  },
                ],
              },
            ],
          },
        })
        const orderId = await placeOrder([{ variant_id: result[0].variants[0].id, quantity: 1 }])
        const errors = evoucherErrors()

        await cancelOrder(orderId)

        expect(errors()).toEqual([])
        expect(
          (await releaseEvoucherCodesForOrderWorkflow(container).run({ input: { order_id: orderId } })).result
        ).toEqual({ released: 0 })
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

    describe("AC-48 allocation skips an order canceled before allocation", () => {
      const OPS_EMAIL = "ev18-ops@example.com"

      // Given: order จ่ายแล้วมี line voucher qty 2 ของ P แล้วถูกยกเลิกก่อน allocation (ยังไม่มี fulfillment)
      const givenCanceledOrder = async ({ emptyPool }: { emptyPool: boolean }) => {
        const p = await createVoucher("C-0001\nC-0002\n")
        const orderId = await placeOrder([{ variant_id: p.variantId, quantity: 2 }])
        await cancelOrder(orderId)
        expect(await orderStatus(orderId)).toBe("canceled")
        if (emptyPool) {
          // P ไม่มี code `available` เลย — บน develop: ตั้ง flag backordered + ส่งอีเมล backordered ถึง admin
          const codes = await service.listEvoucherCodes({ pool_id: p.poolId })
          await service.updateEvoucherCodes(codes.map((c) => ({ id: c.id, status: "void" as const })))
        }
        return { p, orderId }
      }

      const notificationIds = async () =>
        (await container.resolve(Modules.NOTIFICATION).listNotifications({})).map((n) => n.id).sort()

      const lineMetadata = async (orderId: string) => {
        const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "order",
          fields: ["items.metadata"],
          filters: { id: orderId },
        })
        return (data[0].items ?? []).map((i) => i?.metadata ?? {})
      }

      it.each([
        ["P has available codes", false],
        ["P has no code at all", true],
      ])("resolves without claiming, flagging, emailing or fulfilling (%s)", async (_, emptyPool) => {
        const { p, orderId } = await givenCanceledOrder({ emptyPool })
        const availableBefore = await availableCount(p)
        const notificationsBefore = await notificationIds()
        const info = jest.spyOn(container.resolve(ContainerRegistrationKeys.LOGGER), "info")

        let failure: string | undefined
        try {
          await allocateAndDeliverEvouchersWorkflow(container).run({
            input: { order_id: orderId, admin_email: OPS_EMAIL },
          })
        } catch (error) {
          failure = (error as Error).message
        }

        expect(failure).toBeUndefined()
        expect(await service.listEvoucherCodes({ order_id: orderId })).toEqual([])
        expect(await availableCount(p)).toBe(availableBefore)
        expect(await fulfillmentsOf(orderId)).toEqual([])
        expect(await notificationIds()).toEqual(notificationsBefore)
        expect((await lineMetadata(orderId)).map((m) => m.evoucher_backordered)).toEqual([undefined])
        expect(
          info.mock.calls.map(([line]) => String(line)).filter((line) => line.startsWith("evoucher:") && line.includes(orderId))
        ).toHaveLength(1)
      })
    })

    describe("AC-47 delivered codes are shipped without a shipping notification", () => {
      const shippedEmails = () =>
        container.resolve(Modules.NOTIFICATION).listNotifications({ template: EmailTemplates.ORDER_SHIPPED })

      it("ships the fulfillment of a delivered voucher line with no_notification so it can no longer be canceled", async () => {
        const p = await createVoucher("P-0001\nP-0002\n")
        const orderId = await placeOrder([{ variant_id: p.variantId, quantity: 2 }])
        const emitted: unknown[] = []
        const eventBus = container.resolve(Modules.EVENT_BUS)
        const emit = eventBus.emit.bind(eventBus)
        jest.spyOn(eventBus, "emit").mockImplementation(async (event, options) => {
          for (const e of Array.isArray(event) ? event : [event]) {
            if (e.name === "shipment.created") {
              emitted.push(e.data)
            }
          }
          return emit(event, options)
        })
        const shipped = TestEventUtils.waitSubscribersExecution("shipment.created", eventBus)

        await allocateAndDeliverEvouchersWorkflow(container).run({ input: { order_id: orderId } })

        const codes = await service.listEvoucherCodes({ order_id: orderId })
        expect(codes.map((c) => c.status)).toEqual(["delivered", "delivered"])
        const fulfillments = await fulfillmentsOf(orderId)
        expect(fulfillments).toHaveLength(1)
        expect(fulfillments[0].shipped_at).not.toBeNull()
        await shipped
        expect(emitted).toEqual([expect.objectContaining({ id: fulfillments[0].id, no_notification: true })])
        expect(await shippedEmails()).toHaveLength(0)
        // กฎข้อ 33c: admin ยกเลิก fulfillment ที่ shipped และยกเลิก order ไม่ได้ → stock ของ P ไม่ถูกคืนเกินจำนวน code ที่ขายได้
        // (เทียบ stocked/reserved กับค่าก่อนยิง — ยกเลิก fulfillment เพิ่มทั้งสองค่าเท่ากัน `stocked − reserved` จึงจับไม่ได้)
        const before = await levelOf(p)
        for (const path of [
          `/admin/orders/${orderId}/fulfillments/${fulfillments[0].id}/cancel`,
          `/admin/orders/${orderId}/cancel`,
        ]) {
          const rejection = await adminRejection(path)
          expect([path, rejection.status >= 400 && rejection.status < 500, rejection.type]).toEqual([
            path,
            true,
            "not_allowed",
          ])
        }

        expect((await service.listEvoucherCodes({ order_id: orderId })).map((c) => c.status)).toEqual([
          "delivered",
          "delivered",
        ])
        expect(await orderStatus(orderId)).not.toBe("canceled")
        expect((await fulfillmentsOf(orderId))[0].canceled_at).toBeNull()
        expect(await levelOf(p)).toEqual(before)
      })

      // กฎข้อ 33e
      it("creates no shipment when the delivery email fails, so the fulfillment can still be canceled", async () => {
        const p = await createVoucher("Q-0001\n")
        const orderId = await placeOrder([{ variant_id: p.variantId, quantity: 1 }])
        failDeliveryEmail()

        await allocateAndDeliverEvouchersWorkflow(container).run({ input: { order_id: orderId } })

        const [code] = await service.listEvoucherCodes({ order_id: orderId })
        expect(code.status).toBe("allocated")
        const [fulfillment] = await fulfillmentsOf(orderId)
        expect(fulfillment.shipped_at).toBeNull()
        await cancelOrderFulfillmentWorkflow(container).run({
          input: { order_id: orderId, fulfillment_id: fulfillment.id },
        })
        expect((await fulfillmentsOf(orderId))[0].canceled_at).not.toBeNull()

        // ยกเลิก order ได้ แล้ว code กลับเป็น `available` ตามกฎข้อ 32 (AC-46)
        await cancelOrder(orderId)

        expect(await orderStatus(orderId)).toBe("canceled")
        const [released] = await service.listEvoucherCodes({ id: code.id })
        expect(released).toMatchObject({ status: "available", order_id: null, order_line_item_id: null })
        expect(await sellable(p)).toBe(await availableCount(p))
      })

      // กฎข้อ 33d: resend ที่สำเร็จสร้าง shipment ที่ยังขาด; resend ซ้ำไม่สร้างซ้ำ
      it("creates the missing shipment on a successful resend and never a second one on a repeated resend", async () => {
        const p = await createVoucher("R-0001\nR-0002\n")
        const orderId = await placeOrder([{ variant_id: p.variantId, quantity: 2 }])
        const send = failDeliveryEmail()
        await allocateAndDeliverEvouchersWorkflow(container).run({ input: { order_id: orderId } })
        send.mockRestore()
        expect((await fulfillmentsOf(orderId))[0].shipped_at).toBeNull()

        await resendEvoucherEmailWorkflow(container).run({ input: { order_id: orderId } })

        const [first] = await fulfillmentsOf(orderId)
        expect(first.shipped_at).not.toBeNull()
        const errors = evoucherErrors()

        await resendEvoucherEmailWorkflow(container).run({ input: { order_id: orderId } })

        expect(errors()).toEqual([])
        const after = await fulfillmentsOf(orderId)
        expect(after).toHaveLength(1)
        expect(new Date(after[0].shipped_at!).getTime()).toBe(new Date(first.shipped_at!).getTime())
        expect((await service.listEvoucherCodes({ order_id: orderId })).map((c) => c.status)).toEqual([
          "delivered",
          "delivered",
        ])
        expect(await shippedEmails()).toHaveLength(0)
      })

      // กฎข้อ 33d: shipment ล้มต้องไม่ compensate allocation (ไม่ยกเลิก fulfillment ไม่ปล่อย code ที่ลูกค้าได้รับอีเมลแล้ว)
      it("keeps the allocation and logs an error when creating the shipment fails", async () => {
        const p = await createVoucher("S-0001\nS-0002\n")
        const orderId = await placeOrder([{ variant_id: p.variantId, quantity: 1 }])
        const fulfillmentModule = container.resolve(Modules.FULFILLMENT)
        const update = fulfillmentModule.updateFulfillment.bind(fulfillmentModule)
        jest.spyOn(fulfillmentModule, "updateFulfillment").mockImplementation((async (
          id: string,
          data: { shipped_at?: Date }
        ) => {
          if (data.shipped_at) {
            throw new Error("fulfillment provider down")
          }
          return update(id, data as never)
        }) as never)
        const errors = evoucherErrors()

        const { result } = await allocateAndDeliverEvouchersWorkflow(container).run({
          input: { order_id: orderId },
        })

        expect(result.allocated).toHaveLength(1)
        const [code] = await service.listEvoucherCodes({ order_id: orderId })
        expect(code.status).toBe("delivered")
        const [fulfillment] = await fulfillmentsOf(orderId)
        expect(fulfillment).toMatchObject({ shipped_at: null, canceled_at: null })
        expect(errors()).toEqual([expect.stringMatching(new RegExp(`${fulfillment.id}.*fulfillment provider down`))])
      })
    })
  },
})
