import { StripePromptpayService, StripeProviderService } from "@medusajs/payment-stripe/dist/services"
import { createSharedAccountHolder, findSharedAccountHolder } from "../shared-customer"
import { SharedStripePromptpayService, SharedStripeProviderService } from "../service"

const CARD = "pp_stripe_stripe"
const PROMPTPAY = "pp_stripe-promptpay_stripe"

// PAY-26 (spec 01 กฎข้อ 157, AC-198, ADR-035): บัตรและพร้อมเพย์ใช้ Stripe customer ตัวเดียว
describe("findSharedAccountHolder", () => {
  it("returns the holder of the other Stripe provider that has data.id", () => {
    const holder = { provider_id: CARD, data: { id: "cus_1", email: "a@example.com" } }
    expect(findSharedAccountHolder([holder], "stripe-promptpay")).toBe(holder)
    const pp = { provider_id: PROMPTPAY, data: { id: "cus_2" } }
    expect(findSharedAccountHolder([pp], "stripe")).toBe(pp)
  })

  it("does not reuse a holder of the other provider without data.id", () => {
    expect(findSharedAccountHolder([{ provider_id: CARD, data: {} }], "stripe-promptpay")).toBeUndefined()
    expect(findSharedAccountHolder([{ provider_id: CARD, data: { id: "" } }], "stripe-promptpay")).toBeUndefined()
    expect(findSharedAccountHolder([{ provider_id: CARD, data: null }], "stripe-promptpay")).toBeUndefined()
  })

  it("ignores its own provider and non-Stripe providers", () => {
    expect(findSharedAccountHolder([{ provider_id: CARD, data: { id: "cus_1" } }], "stripe")).toBeUndefined()
    expect(
      findSharedAccountHolder([{ provider_id: "pp_system_default", data: { id: "x" } }], "stripe")
    ).toBeUndefined()
    expect(findSharedAccountHolder(undefined, "stripe")).toBeUndefined()
    expect(findSharedAccountHolder([null, undefined], "stripe")).toBeUndefined()
  })
})

describe("createSharedAccountHolder", () => {
  const customer = { id: "cus_medusa_1", email: "a@example.com" }

  it("delegates when the account holder of this provider already exists", async () => {
    const create = jest.fn().mockResolvedValue({ id: "cus_1" })
    const input = { context: { customer, account_holder: { data: { id: "cus_1" } } } } as any
    expect(await createSharedAccountHolder(input, "stripe", create)).toEqual({ id: "cus_1" })
    expect(create).toHaveBeenCalledWith(input)
  })

  it("reuses the Stripe customer of the other provider without calling Stripe", async () => {
    const create = jest.fn()
    const data = { id: "cus_shared", object: "customer" }
    const input = {
      context: { customer: { ...customer, account_holders: [{ provider_id: CARD, data }] } },
    } as any
    expect(await createSharedAccountHolder(input, "stripe-promptpay", create)).toEqual({ id: "cus_shared", data })
    expect(create).not.toHaveBeenCalled()
  })

  it("creates with an idempotency key per provider otherwise", async () => {
    const create = jest.fn().mockResolvedValue({ id: "cus_new" })
    const input = {
      context: {
        idempotency_key: customer.id,
        customer: { ...customer, account_holders: [{ provider_id: CARD, data: {} }] },
      },
    } as any
    expect(await createSharedAccountHolder(input, "stripe-promptpay", create)).toEqual({ id: "cus_new" })
    expect(create).toHaveBeenCalledWith({
      context: { ...input.context, idempotency_key: "cus_medusa_1:stripe-promptpay" },
    })
  })
})

describe("shared Stripe provider classes", () => {
  it("keep the identifiers of Medusa's Stripe providers (pp_stripe_stripe, pp_stripe-promptpay_stripe with id `stripe`)", () => {
    expect(SharedStripeProviderService.identifier).toEqual(StripeProviderService.identifier)
    expect(SharedStripeProviderService.identifier).toEqual("stripe")
    expect(SharedStripePromptpayService.identifier).toEqual(StripePromptpayService.identifier)
    expect(SharedStripePromptpayService.identifier).toEqual("stripe-promptpay")
    expect(Object.getPrototypeOf(SharedStripeProviderService)).toBe(StripeProviderService)
    expect(Object.getPrototypeOf(SharedStripePromptpayService)).toBe(StripePromptpayService)
  })

  it("override only createAccountHolder", () => {
    expect(Object.getOwnPropertyNames(SharedStripeProviderService.prototype).sort()).toEqual([
      "constructor",
      "createAccountHolder",
    ])
    expect(Object.getOwnPropertyNames(SharedStripePromptpayService.prototype).sort()).toEqual([
      "constructor",
      "createAccountHolder",
    ])
  })

  it("route createAccountHolder through the shared logic of the provider's identifier", async () => {
    const service = Object.create(SharedStripePromptpayService.prototype)
    const data = { id: "cus_shared" }
    const result = await service.createAccountHolder({
      context: { customer: { id: "c1", email: "a@example.com", account_holders: [{ provider_id: CARD, data }] } },
    })
    expect(result).toEqual({ id: "cus_shared", data })
  })
})
