import path from "path"
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
import { FLASH_SALE_MODULE } from "../../src/modules/flash_sale"
import type FlashSaleModuleService from "../../src/modules/flash_sale/service"
import { CART_COMPLETION_FAILED_AFTER_PAYMENT } from "../../src/workflows/hooks/paid-completion-failure"

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

    async function readyCart(quantity: number, providerId: string) {
      seq += 1
      const customer = await registerCustomer(api, pk, `ops32-${seq}@example.com`, "ops32-password")
      const { result: cart } = await createCartWorkflow(container).run({
        input: {
          region_id: regionId,
          customer_id: customer.customerId,
          shipping_address: {
            first_name: "Test",
            last_name: "Buyer",
            address_1: "1 Test Rd",
            city: "Bangkok",
            postal_code: "10110",
            country_code: "th",
          },
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

    it("complete ล้มก่อนมีการชำระ (ยังไม่ capture) → ไม่มี warn นี้", async () => {
      await flashLimitOne()
      const { cartId } = await readyCart(2, "pp_system_default")

      const { errors } = await completeCartWorkflow(container).run({ input: { id: cartId }, throwOnError: false })

      expect(errors.length).toBeGreaterThan(0)
      expect(markerLines()).toHaveLength(0)
    })
  },
})
