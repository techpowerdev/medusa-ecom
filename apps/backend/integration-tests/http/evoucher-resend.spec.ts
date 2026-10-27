import { randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  addShippingMethodToCartWorkflow,
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
// provider ของ Notification module ใน test — mock ให้ throw/หน่วงได้ (AC-28, AC-29)
import localNotificationProvider from "@medusajs/medusa/notification-local"

jest.setTimeout(300 * 1000)

// ต้องตั้งก่อน runner โหลด medusa-config (module evoucher อ่าน key จาก env)
process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

const ADMIN_EMAIL = "ev5b-admin@example.com"
const ADMIN_PASSWORD = "ev5b-test-password"
const DELIVERED = "evoucher.delivered"

// EV-5b: POST /admin/evoucher/orders/:id/resend (AC-18, AC-28, AC-29, กฎข้อ 17 และ 19)
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

    const createVoucher = async (csv: string) => {
      seq += 1
      const { result } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: `Resend voucher ${seq}`,
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
      return variantId
    }

    // order (ไม่ผ่าน store route — test นี้ทดสอบ resend ไม่ใช่ checkout) แล้ว allocate ผ่าน workflow ของ EV-4
    const placeOrder = async (items: { variant_id: string; quantity: number }[]) => {
      seq += 1
      const email = `ev5b-buyer-${seq}@example.com`
      const customer = await container
        .resolve(Modules.CUSTOMER)
        .createCustomers({ email, has_account: true })
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
      return { orderId: order.id, email }
    }

    const allocate = (orderId: string) =>
      allocateAndDeliverEvouchersWorkflow(container).run({ input: { order_id: orderId } })

    const deliveredEmails = (orderId: string) =>
      container
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ template: DELIVERED, resource_id: orderId }, { order: { created_at: "ASC" } })

    // NotificationDTO ของ 2.22.1 ไม่ประกาศ idempotency_key แต่ module คืนค่าจริงจาก DB
    const keyOf = (notification: object) => (notification as { idempotency_key?: string }).idempotency_key

    const resend = (orderId: string, headers: object = adminHeaders) =>
      api.post(`/admin/evoucher/orders/${orderId}/resend`, {}, headers).catch((e) => e.response)

    // provider (local) ของ evoucher.delivered: throw หรือหน่วงตามที่ test กำหนด ส่วน template อื่นส่งตามปกติ
    const mockDeliveredSend = (impl: () => Promise<unknown>) => {
      const LocalProvider = localNotificationProvider.services[0]
      const originalSend = LocalProvider.prototype.send
      return jest.spyOn(LocalProvider.prototype, "send").mockImplementation(async function (
        this: unknown,
        notification: { template: string }
      ) {
        if (notification.template === DELIVERED) {
          await impl()
        }
        return originalSend.call(this, notification)
      })
    }

    describe("AC-18 resend delivered codes", () => {
      it("sends one new email with the same 2 codes to the order email and leaves the codes unchanged", async () => {
        const variantId = await createVoucher("R-0001,1111\nR-0002,2222\nR-0003,3333\n")
        const { orderId, email } = await placeOrder([{ variant_id: variantId, quantity: 2 }])
        await allocate(orderId)
        const before = await service.listEvoucherCodes({ order_id: orderId }, { order: { id: "ASC" } })
        expect(before.map((c) => c.status)).toEqual(["delivered", "delivered"])

        const res = await resend(orderId)

        expect(res.status).toBe(200)
        expect(res.data).toEqual({ order_id: orderId, code_count: 2 })
        const emails = await deliveredEmails(orderId)
        expect(emails).toHaveLength(2)
        const latest = emails[1]
        expect(latest).toMatchObject({ to: email, status: "success" })
        expect(keyOf(latest)).toMatch(new RegExp(`^evoucher-resend:${orderId}:`))
        // กฎข้อ 16: data เป็น ciphertext — ถอดแล้วต้องเป็น code ชุดเดิมของ order
        expect(JSON.stringify(latest.data)).not.toMatch(/R-000|1111|2222/)
        const sent = (latest.data as any).vouchers.flatMap((v: { codes: { code: string }[] }) => v.codes)
        const plain = await Promise.all(sent.map((c: { code: string }) => service.decryptSecret(c.code)))
        const original = await Promise.all(before.map((c) => service.decryptSecret(c.code)))
        expect(plain.sort()).toEqual(original.sort())

        const after = await service.listEvoucherCodes({ order_id: orderId }, { order: { id: "ASC" } })
        expect(after.map((c) => [c.id, c.status, c.delivered_at])).toEqual(
          before.map((c) => [c.id, c.status, c.delivered_at])
        )
      })

      it("returns 400 for an order without delivered or allocated codes", async () => {
        const variantId = await createVoucher("N-0001\n")
        // ยังไม่ capture → ยังไม่มี code ของ order
        const { orderId } = await placeOrder([{ variant_id: variantId, quantity: 1 }])

        const res = await resend(orderId)

        expect(res.status).toBe(400)
        expect(res.data.type).toBe("not_allowed")
        expect(await deliveredEmails(orderId)).toHaveLength(0)
      })

      it("returns 401 without an admin token", async () => {
        const variantId = await createVoucher("U-0001\n")
        const { orderId } = await placeOrder([{ variant_id: variantId, quantity: 1 }])
        await allocate(orderId)

        const res = await resend(orderId, {})

        expect(res.status).toBe(401)
        expect(await deliveredEmails(orderId)).toHaveLength(1)
      })
    })

    describe("AC-28 / AC-29 resend after a failed delivery email", () => {
      it("marks allocated codes delivered and uses a new idempotency key on every resend", async () => {
        const variantId = await createVoucher("F-0001\nF-0002\n")
        const { orderId, email } = await placeOrder([{ variant_id: variantId, quantity: 1 }])
        const failing = mockDeliveredSend(async () => {
          throw new Error("smtp down")
        })
        await allocate(orderId)
        failing.mockRestore()
        const [failed] = await deliveredEmails(orderId)
        expect(failed).toMatchObject({ status: "failure" })
        expect((await service.listEvoucherCodes({ order_id: orderId }))[0].status).toBe("allocated")

        const first = await resend(orderId)
        const second = await resend(orderId)

        expect([first.status, second.status]).toEqual([200, 200])
        const codes = await service.listEvoucherCodes({ order_id: orderId })
        expect(codes).toEqual([
          expect.objectContaining({
            status: "delivered",
            delivered_at: expect.any(Date),
            delivered_to_email: email,
          }),
        ])
        const emails = await deliveredEmails(orderId)
        expect(emails.map((e) => e.status)).toEqual(["failure", "success", "success"])
        const keys = emails.map(keyOf)
        expect(new Set(keys).size).toBe(3)
      })

      it("keeps the codes allocated, answers an error and can be retried when the provider still fails", async () => {
        const variantId = await createVoucher("S-0001\n")
        const { orderId } = await placeOrder([{ variant_id: variantId, quantity: 1 }])
        const failing = mockDeliveredSend(async () => {
          throw new Error("smtp down")
        })
        await allocate(orderId)

        const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
        const logError = jest.spyOn(logger, "error")

        const res = await resend(orderId)

        expect(res.status).toBe(500)
        expect(res.data.message).toContain("smtp down")
        // EV-13 (AC-32): ข้อความถึง admin สั้น ไม่มี id `noti_…` — id อยู่ใน log
        expect(res.data.message).not.toMatch(/noti_[A-Za-z0-9]+/)
        expect(res.data.message).toMatch(/try again.*log/i)
        expect(logError.mock.calls.map(([line]) => String(line)).join("\n")).toMatch(
          new RegExp(`${orderId}.*noti_[A-Za-z0-9]+`)
        )
        logError.mockRestore()
        expect((await service.listEvoucherCodes({ order_id: orderId }))[0].status).toBe("allocated")

        // lock ต่อ order ถูกปล่อยเมื่อล้ม → ส่งซ้ำได้ทันทีเมื่อ provider กลับมา
        failing.mockRestore()
        expect((await resend(orderId)).status).toBe(200)
        expect((await service.listEvoucherCodes({ order_id: orderId }))[0].status).toBe("delivered")
      })
    })

    describe("concurrent resend (lock ต่อ order)", () => {
      it("sends only one email when two resends of the same order arrive together", async () => {
        const variantId = await createVoucher("C-0001\n")
        const { orderId } = await placeOrder([{ variant_id: variantId, quantity: 1 }])
        await allocate(orderId)
        mockDeliveredSend(() => new Promise((resolve) => setTimeout(resolve, 1500)))

        const results = await Promise.all([resend(orderId), resend(orderId)])

        expect(results.map((r) => r.status).sort()).toEqual([200, 409])
        const conflict = results.find((r) => r.status === 409)
        expect(conflict.data.code).toBe("EVOUCHER_RESEND_IN_PROGRESS")
        expect(await deliveredEmails(orderId)).toHaveLength(2)
      })
    })

    // EV-5c (กฎข้อ 21): allocation กับ resend ของ order เดียวกันถือ lock `evoucher-order:<order_id>` ร่วมกัน
    describe("AC-33 lock ร่วมระหว่าง allocation กับ resend", () => {
      it("answers 409 while allocation holds the order lock and allocation still sends exactly one email", async () => {
        const variantId = await createVoucher("L-0001\n")
        const { orderId } = await placeOrder([{ variant_id: variantId, quantity: 1 }])
        const locking = container.resolve(Modules.LOCKING)
        const acquire = jest.spyOn(locking, "acquire")
        // step ส่งอีเมลของ allocation (ใต้ lock) รอ signal ของ test — เฉพาะการส่งครั้งแรก (resend ที่หลุด lock ไม่ค้าง)
        let entered!: () => void
        const reached = new Promise<void>((resolve) => (entered = resolve))
        let proceed!: () => void
        const signal = new Promise<void>((resolve) => (proceed = resolve))
        let sends = 0
        mockDeliveredSend(async () => {
          if (++sends === 1) {
            entered()
            await signal
          }
        })

        const allocation = allocate(orderId)
        await reached
        const res = await resend(orderId)
        proceed()
        await allocation

        expect(res.status).toBe(409)
        expect(res.data.code).toBe("EVOUCHER_RESEND_IN_PROGRESS")
        expect(await deliveredEmails(orderId)).toHaveLength(1)
        // allocation (acquireLockStep) และ resend ขอ lock key เดียวกัน
        const keys = acquire.mock.calls.map(([key]) => key)
        expect(keys.filter((key) => key === `evoucher-order:${orderId}`)).toHaveLength(2)
      })

      it("answers 5xx (not 409) when the locking provider fails for another reason", async () => {
        const variantId = await createVoucher("E-0001\n")
        const { orderId } = await placeOrder([{ variant_id: variantId, quantity: 1 }])
        await allocate(orderId)
        jest.spyOn(container.resolve(Modules.LOCKING), "acquire").mockRejectedValue(new Error("redis down"))

        const res = await resend(orderId)

        expect(res.status).toBeGreaterThanOrEqual(500)
        expect(res.data.code).not.toBe("EVOUCHER_RESEND_IN_PROGRESS")
        expect(await deliveredEmails(orderId)).toHaveLength(1)
      })

      it("answers 200 and logs the order id when the email is sent but the status update fails", async () => {
        const variantId = await createVoucher("P-0001\n")
        const { orderId } = await placeOrder([{ variant_id: variantId, quantity: 1 }])
        const failing = mockDeliveredSend(async () => {
          throw new Error("smtp down")
        })
        await allocate(orderId)
        failing.mockRestore()
        jest.spyOn(service, "updateEvoucherCodes").mockRejectedValue(new Error("db down"))
        const logError = jest.spyOn(container.resolve(ContainerRegistrationKeys.LOGGER), "error")

        const res = await resend(orderId)

        expect(res.status).toBe(200)
        const emails = await deliveredEmails(orderId)
        expect(emails.map((e) => e.status)).toEqual(["failure", "success"])
        expect(logError.mock.calls.some(([message]) => String(message).includes(orderId))).toBe(true)
        // code ที่ยัง allocated จะถูกเปลี่ยนใน resend ครั้งถัดไป
        expect((await service.listEvoucherCodes({ order_id: orderId }))[0].status).toBe("allocated")
      })
    })
  },
})
