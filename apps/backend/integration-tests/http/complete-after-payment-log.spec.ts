import path from "path"
import { Writable } from "stream"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, MedusaError, Modules, PaymentActions } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { logger } from "@medusajs/framework/logger"
import {
  addShippingMethodToCartWorkflow,
  completeCartWorkflow,
  createCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  createPaymentSessionsWorkflow,
  processPaymentWorkflow,
} from "@medusajs/medusa/core-flows"
import seedThailand from "../../src/scripts/seed"
import { getPublishableKey } from "../../src/scripts/print-publishable-key"
import { registerCustomer } from "../helpers/customer"
import { createAdminUser } from "../helpers/admin"
import { FLASH_SALE_MODULE } from "../../src/modules/flash_sale"
import type FlashSaleModuleService from "../../src/modules/flash_sale/service"
import { CART_COMPLETION_FAILED_AFTER_PAYMENT } from "../../src/workflows/hooks/paid-completion-failure"
import { buildJsonLogger } from "../../src/lib/json-logger"

jest.setTimeout(240 * 1000)

// OPS-32 (spec 07 AC-47 a): complete ล้มหลัง capture → warn CART_COMPLETION_FAILED_AFTER_PAYMENT 1 บรรทัด
// ก่อน log ของ Medusa compensatePaymentIfNeededStep ที่ดูเหมือนคืนเงินล้ม (ADR-025 บริบท) และ payment ถูกคืน 1 รายการ

// SDK `stripe` ตัวเดียวกับที่ @medusajs/payment-stripe ใช้ (แบบ payment-session-guard.spec.ts) — mock เฉพาะ network
const stripeSdkPath = require.resolve("stripe", {
  paths: [
    path.dirname(
      require.resolve("@medusajs/payment-stripe/package.json", {
        paths: [require.resolve("@medusajs/medusa/package.json")],
      })
    ),
  ],
})
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require(stripeSdkPath)
const PaymentIntents = Stripe.resources.PaymentIntents.prototype

// step หลัง hook validate ล้ม เฉพาะ cart ที่ test กำหนด (hook orderCreated — แบบ flash-sale-limits.spec.ts AC-9)
const failAfterValidate = new Set<string>()
const hooks = completeCartWorkflow.hooks as unknown as {
  orderCreated: (handler: (input: { cart_id: string }) => Promise<StepResponse<undefined>>) => void
}
hooks.orderCreated(async ({ cart_id }) => {
  if (failAfterValidate.has(cart_id)) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "OPS-32 test: forced failure after validate")
  }
  return new StepResponse(undefined)
})

const HINT =
  "Medusa refunds automatically; a following 'Error was thrown trying to refund payment' line comes from re-creating the payment session — verify refunds via GET /admin/payments/:id"

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer
    let pk: string
    let regionId: string
    let variantId: string
    let shippingOptionId: string
    let seq = 0

    beforeAll(async () => {
      container = getContainer()
      await seedThailand({ container, args: [] })
      pk = await getPublishableKey(container)
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: regions } = await query.graph({ entity: "region", fields: ["id"] })
      regionId = regions[0].id
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["variants.id", "variants.title"],
        filters: { handle: "t-shirt" },
      })
      variantId = products[0].variants.find((v) => v.title === "L")!.id
      const { data: options } = await query.graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { name: "Standard" },
      })
      shippingOptionId = options[0].id
    })

    let warn: jest.SpyInstance
    let error: jest.SpyInstance
    beforeEach(() => {
      jest.spyOn(Stripe.StripeResource.prototype, "_makeRequest").mockImplementation(() => {
        throw new Error("unexpected network call to Stripe in test")
      })
      // session ที่ Medusa สร้างใหม่ด้วย `data` เดิม: `payment_method` เป็น object (expand ตอน authorize) → Stripe ตอบ Invalid string
      jest.spyOn(PaymentIntents, "create").mockImplementation(async (params: any) => {
        if (params.payment_method && typeof params.payment_method === "object") {
          throw new Error(`Invalid string: ${JSON.stringify(params.payment_method)}`)
        }
        return { id: `pi_ops32_${++seq}`, object: "payment_intent", amount: params.amount, currency: "thb", status: "requires_payment_method" }
      })
      // ลบ session ของ PI ที่ succeeded: Stripe ปฏิเสธ cancel แต่ provider ข้ามสถานะ succeeded (deletePayment)
      jest.spyOn(PaymentIntents, "cancel").mockImplementation(async (id: string) => {
        throw Object.assign(new Error("PaymentIntent has a status of succeeded"), { payment_intent: { id, status: "succeeded" } })
      })
      jest.spyOn(PaymentIntents, "retrieve").mockImplementation(async (id: string) => ({
        id,
        object: "payment_intent",
        currency: "thb",
        status: "succeeded",
        payment_method: { id: "pm_ops32", object: "payment_method", billing_details: { name: "Test Buyer" } },
      }))
      jest
        .spyOn(Stripe.resources.Refunds.prototype, "create")
        .mockImplementation(async (params: any) => ({ id: `re_ops32_${++seq}`, object: "refund", amount: params.amount }))
      // workflow ที่รันผ่าน workflow engine log ผ่าน singleton `logger` ของ framework ไม่ใช่ LOGGER ของ container ใน test
      // (แบบ search-option-deleted.spec.ts)
      warn = jest.spyOn(logger, "warn")
      error = jest.spyOn(logger, "error")
    })

    afterEach(() => {
      jest.restoreAllMocks()
      failAfterValidate.clear()
    })

    async function flashLimitOne() {
      seq += 1
      const promotionModule = container.resolve(Modules.PROMOTION)
      const campaign = await promotionModule.createCampaigns({ name: `OPS-32 flash ${seq}`, campaign_identifier: `OPS32-${seq}` })
      await promotionModule.createPromotions([
        {
          code: `OPS32FLASH${seq}`,
          type: "standard",
          status: "active",
          is_automatic: true,
          campaign_id: campaign.id,
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 10,
            value: 20,
            target_rules: [{ attribute: "items.variant_id", operator: "in", values: [variantId] }],
          },
        },
      ])
      const flashSale: FlashSaleModuleService = container.resolve(FLASH_SALE_MODULE)
      await flashSale.createFlashSaleConfigs({ campaign_id: campaign.id, per_customer_limit: 1 })
    }

    type Buyer = { email: string; first_name: string; last_name: string; address_1: string; city: string; postal_code: string }
    async function readyCart(quantity: number, providerId: string, buyer?: Buyer) {
      seq += 1
      const { email, ...address } = buyer ?? {
        email: `ops32-${seq}@example.com`,
        first_name: "Test",
        last_name: "Buyer",
        address_1: "1 Test Rd",
        city: "Bangkok",
        postal_code: "10110",
      }
      const customer = await registerCustomer(api, pk, email, "ops32-password")
      const { result: cart } = await createCartWorkflow(container).run({
        input: {
          region_id: regionId,
          customer_id: customer.customerId,
          shipping_address: { ...address, country_code: "th" },
          items: [{ variant_id: variantId, quantity }],
        },
      })
      await addShippingMethodToCartWorkflow(container).run({
        input: { cart_id: cart.id, options: [{ id: shippingOptionId }] },
      })
      const { result: collection } = await createPaymentCollectionForCartWorkflow(container).run({
        input: { cart_id: cart.id },
      })
      const { result: session } = await createPaymentSessionsWorkflow(container).run({
        input: { payment_collection_id: collection.id, provider_id: providerId },
      })
      return { cartId: cart.id, collectionId: collection.id, session }
    }

    // webhook payment_intent.succeeded (Stripe ตัดเงินแล้ว) → authorize + capture แล้ว complete cart
    const captured = (session: { id: string; amount: unknown }) =>
      processPaymentWorkflow(container).run({
        input: { action: PaymentActions.SUCCESSFUL, data: { session_id: session.id, amount: session.amount as number } },
        throwOnError: false,
      })

    async function paymentsOf(collectionId: string) {
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "payment_collection",
        fields: ["payments.id", "payments.captured_at", "payments.refunds.id", "payments.refunds.note"],
        filters: { id: collectionId },
      })
      return data[0].payments
    }

    const markerLines = () =>
      warn.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith(CART_COMPLETION_FAILED_AFTER_PAYMENT))

    it("flash เกินสิทธิ์หลัง capture → warn 1 บรรทัด (cart_id, payment_session_id, code) ก่อน log ของ Medusa และคืนเงิน 1 รายการ", async () => {
      await flashLimitOne()
      const { cartId, collectionId, session } = await readyCart(2, "pp_stripe_stripe")

      await captured(session)

      const lines = markerLines()
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain(`cart_id=${cartId}`)
      expect(lines[0]).toContain(`payment_session_id=${session.id}`)
      expect(lines[0]).toContain("code=FLASH_LIMIT_EXCEEDED")
      expect(lines[0]).toContain(HINT)

      const payments = await paymentsOf(collectionId)
      expect(payments).toHaveLength(1)
      expect(payments[0].captured_at).toBeTruthy()
      expect(payments[0].refunds).toEqual([expect.objectContaining({ note: "Refunded due to cart completion failure" })])

      // log หลอกของ Medusa 2.22.1 ยังเกิดหลังบรรทัดของเรา (ที่ runbook อ้าง) — ถ้า bump แล้วหายไปให้ทบทวน runbook
      const refundError = error.mock.calls.findIndex((c) => String(c[0]).includes("Error was thrown trying to refund payment"))
      expect(refundError).toBeGreaterThan(-1)
      const markerOrder = warn.mock.invocationCallOrder[warn.mock.calls.findIndex((c) => String(c[0]) === lines[0])]
      expect(markerOrder).toBeLessThan(error.mock.invocationCallOrder[refundError])
    })

    it("step หลัง hook validate ล้มหลัง capture → warn 1 บรรทัด และคืนเงิน 1 รายการ", async () => {
      const { cartId, collectionId, session } = await readyCart(1, "pp_stripe_stripe")
      failAfterValidate.add(cartId)

      await captured(session)

      const lines = markerLines()
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain(`cart_id=${cartId}`)
      expect(lines[0]).toContain(`payment_session_id=${session.id}`)
      expect(lines[0]).toContain("code=STEP_AFTER_VALIDATE_FAILED")
      const payments = await paymentsOf(collectionId)
      expect(payments[0].refunds).toHaveLength(1)
    })

    // hotfix PAY-9 (spec 06 AC-22c e2e): สัญญาณที่ e2e ใช้รอให้ compensation ของ Medusa จบ — ยืนยันลำดับจาก source 2.22.1
    // refundPayment_ บันทึก refund ก่อนเรียก Stripe; recreate session ด้วย data เดิมสร้างแถว pending (PI เดิม) ก่อนเรียก Stripe;
    // execution ของ complete-cart (store: true) เป็นสถานะจบหลัง compensation ทั้งหมด (รวม recreate รอบสองของ deletePaymentSessionsStep)
    it("PAY-9 hotfix: ระหว่าง compensation execution ของ complete-cart ยังไม่จบแม้ refund ถูกบันทึกแล้ว; จบแล้วไม่มี session ที่อ้าง PI เดิม", async () => {
      await flashLimitOne()
      const { cartId, collectionId, session } = await readyCart(2, "pp_stripe_stripe")
      const firstIntent = (session.data as { id: string }).id
      const admin = await createAdminUser(container, `pay9-hotfix-${seq}@example.com`)
      const startedAt = new Date(Date.now() - 60_000).toISOString()

      const gate = () => {
        let open!: () => void
        let reached!: () => void
        const opened = new Promise<void>((r) => (open = r))
        const arrived = new Promise<void>((r) => (reached = r))
        return { open, arrived, wait: async () => (reached(), opened) }
      }
      const atRefund = gate()
      const atRecreate = gate()
      jest.spyOn(Stripe.resources.Refunds.prototype, "create").mockImplementation(async (params: any) => {
        await atRefund.wait()
        return { id: `re_pay9_${++seq}`, object: "refund", amount: params.amount }
      })
      const createIntent = jest.spyOn(PaymentIntents, "create").mockImplementation(async (params: any) => {
        if (params.payment_method && typeof params.payment_method === "object") {
          await atRecreate.wait()
          throw new Error(`Invalid string: ${JSON.stringify(params.payment_method)}`)
        }
        return { id: `pi_pay9_${++seq}`, object: "payment_intent", amount: params.amount, currency: "thb", status: "requires_payment_method" }
      })

      const snapshot = async () => {
        const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "payment_collection",
          fields: ["payments.refunds.id", "payment_sessions.status", "payment_sessions.data"],
          filters: { id: collectionId },
        })
        // query string เดียวกับ e2e pay-9-refunded-cart-repay.spec.ts
        const res = await api.get(
          "/admin/workflows-executions?workflow_id=complete-cart&fields=id,state,context" +
            `&created_at[$gte]=${encodeURIComponent(startedAt)}`,
          { headers: admin.headers }
        )
        const executions = (res.data.workflow_executions as { state: string; context?: any }[])
          .filter((e) => e.context?.data?.payload?.id === cartId)
          .map((e) => e.state)
        return {
          refunds: data[0].payments.flatMap((p: any) => p.refunds ?? []).length,
          sessions: data[0].payment_sessions.map((s: any) => [s.status, s.data?.id]),
          executions,
        }
      }

      const run = captured(session)

      await atRefund.arrived
      // e2e เดิมเห็น Stripe refund แล้วถือว่าจบ: Medusa บันทึก refund แล้ว session เดิมยัง authorized แต่ compensation ยังไม่จบ
      expect(await snapshot()).toEqual({
        refunds: 1,
        sessions: [["authorized", firstIntent]],
        executions: ["waiting_to_compensate"],
      })
      atRefund.open()

      await atRecreate.arrived
      // session ชั่วคราวที่ recreate ด้วย data เดิม = pending + PI เดิม (หน้า checkout ถือเป็น session ที่ใช้อยู่)
      const during = await snapshot()
      expect(during.sessions).toContainEqual(["pending", firstIntent])
      expect(during.executions).toEqual(["waiting_to_compensate"])
      atRecreate.open()

      await run
      const after = await snapshot()
      expect(after.executions).toEqual(["reverted"])
      expect(after.refunds).toBe(1)
      expect(after.sessions.filter(([, id]: [string, string]) => id === firstIntent)).toEqual([])
      // recreate ด้วย PI เดิม: รอบ createPaymentSessionStep + รอบ compensation ของ deletePaymentSessionsStep
      const recreated = createIntent.mock.calls.filter(([p]: any[]) => p.payment_method && typeof p.payment_method === "object")
      expect(recreated).toHaveLength(2)
    })

    // OPS-33 (spec 07 กฎข้อ 15 รอบ 41, AC-48 b/c): บรรทัด recreate a payment session ของ Medusa มี billing_details ของลูกค้า
    it("AC-48b logger ของ prod ไม่มีชื่อ/อีเมล/เบอร์/ที่อยู่ของลูกค้า แต่ยังมี CART_COMPLETION_FAILED_AFTER_PAYMENT พร้อม cart_id", async () => {
      const lines: string[] = []
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          lines.push(...chunk.toString().split("\n").filter(Boolean))
          callback()
        },
      })
      // logger เดียวกับที่ medusa-config ส่งให้ Medusa ใน production — ใน test LOGGER คือ singleton ของ framework จึงส่งต่อเข้าไป
      const prod = buildJsonLogger({ NODE_ENV: "production", LOG_LEVEL: "debug" }, stream)!
      warn.mockImplementation((message: string) => prod.warn(message))
      error.mockImplementation((message: string, err?: Error) => prod.error(message, err))
      jest.spyOn(logger, "info").mockImplementation((message: string) => prod.info(message))

      const tag = {
        email: "pii-tag-qz@example.com",
        first_name: "Piifirstqz",
        last_name: "Piilastqz",
        address_1: "77 Piistreetqz",
        city: "Piicityqz",
        postal_code: "10999",
      }
      const phone = "0891234567"
      // Stripe คืน payment_method พร้อม billing_details ที่ลูกค้ากรอก → Medusa ส่งกลับไปตอน recreate session แล้ว log ทั้งก้อน
      jest.spyOn(PaymentIntents, "retrieve").mockImplementation(async (id: string) => ({
        id,
        object: "payment_intent",
        currency: "thb",
        status: "succeeded",
        payment_method: {
          id: "pm_ops33",
          object: "payment_method",
          billing_details: {
            name: `${tag.first_name} ${tag.last_name}`,
            email: tag.email,
            phone,
            address: { line1: tag.address_1, city: tag.city, postal_code: tag.postal_code, country: "TH" },
          },
        },
      }))
      await flashLimitOne()
      const { cartId, session } = await readyCart(2, "pp_stripe_stripe", tag)

      await captured(session)

      // AC-48c: logger ของ Medusa ได้ PII จริง (fixture ถึง log) — redact เกิดใน json-logger ของ prod เท่านั้น
      const medusaRaw = error.mock.calls.map((c) => String(c[0])).join("\n")
      for (const value of [tag.email, tag.first_name, phone, tag.address_1]) {
        expect(medusaRaw).toContain(value)
      }

      const text = lines.join("\n")
      expect(text).toContain("recreate a payment session")
      for (const value of [...Object.values(tag), phone]) {
        expect(text).not.toContain(value)
      }
      const markers = lines
        .map((line) => JSON.parse(line).message as string)
        .filter((message) => message.startsWith(CART_COMPLETION_FAILED_AFTER_PAYMENT))
      expect(markers).toEqual([expect.stringContaining(`cart_id=${cartId}`)])
    })

    it("complete ล้มก่อนมีการชำระ (ยังไม่ capture) → ไม่มี warn นี้", async () => {
      await flashLimitOne()
      const { cartId } = await readyCart(2, "pp_system_default")

      const { errors } = await completeCartWorkflow(container).run({ input: { id: cartId }, throwOnError: false })

      expect(errors.length).toBeGreaterThan(0)
      expect(markerLines()).toHaveLength(0)
    })
  },
})
