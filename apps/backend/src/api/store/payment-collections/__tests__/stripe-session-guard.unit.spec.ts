import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { PAYMENT_ALREADY_COMPLETED, guardPaidStripeSession } from "../stripe-session-guard"

// PAY-6 (spec 06 กฎข้อ 7A, AC-13 a–f, ADR-015 A + ภาคผนวก): guard ด้วย mock payment module
type Session = {
  id: string
  provider_id: string
  data?: Record<string, unknown> | null
  authorized_at?: Date | null
  payment?: { id: string } | null
}

const stripeSession = (overrides: Partial<Session> = {}): Session => ({
  id: "payses_1",
  provider_id: "pp_stripe-promptpay_stripe",
  data: { id: "pi_1" },
  authorized_at: null,
  payment: null,
  ...overrides,
})

function setup(sessions: Session[], opts: { cartId?: string | null; authorize?: () => Promise<unknown> } = {}) {
  const collection = {
    id: "pay_col_1",
    cart: opts.cartId === null ? null : { id: opts.cartId ?? "cart_1" },
    payment_sessions: sessions,
  }
  const query = { graph: jest.fn(async () => ({ data: [collection] })) }
  const payment = { authorizePaymentSession: jest.fn(opts.authorize ?? (async () => ({ id: "pay_1" }))) }
  const locking = { execute: jest.fn(async (_key: string, job: () => Promise<unknown>) => job()) }
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.QUERY]: query,
    [Modules.PAYMENT]: payment,
    [Modules.LOCKING]: locking,
  }
  const req = { method: "POST", params: { id: collection.id }, scope: { resolve: (key: string) => services[key] } }
  const next = jest.fn()
  const run = () => guardPaidStripeSession(req as any, {} as any, next)
  return { run, next, payment, locking }
}

const notAllowed = () => new MedusaError(MedusaError.Types.NOT_ALLOWED, "Session: payses_1 was not authorized")

describe("guardPaidStripeSession (AC-13)", () => {
  it.each([
    ["returns a payment (PI succeeded / requires_capture)", async () => ({ id: "pay_1" })],
    ["returns null (PI processing)", async () => null],
  ])("(a) answers 409 PAYMENT_ALREADY_COMPLETED when authorizePaymentSession %s", async (_label, authorize) => {
    const { run, next, payment } = setup([stripeSession()], { authorize })

    await expect(run()).rejects.toMatchObject({
      type: MedusaError.Types.CONFLICT,
      code: PAYMENT_ALREADY_COMPLETED,
    })
    expect(payment.authorizePaymentSession).toHaveBeenCalledWith("payses_1", {})
    expect(next).not.toHaveBeenCalled()
  })

  it.each([
    ["authorized_at", { authorized_at: new Date() }],
    ["a payment", { payment: { id: "pay_1" } }],
  ])("(b) answers 409 without calling the provider when the session already has %s", async (_label, overrides) => {
    const { run, next, payment } = setup([stripeSession(overrides)])

    await expect(run()).rejects.toMatchObject({ code: PAYMENT_ALREADY_COMPLETED })
    expect(payment.authorizePaymentSession).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it("(c) lets Medusa create the new session when the PI is not paid (NOT_ALLOWED)", async () => {
    const { run, next } = setup([stripeSession({ provider_id: "pp_stripe_stripe" })], {
      authorize: async () => {
        throw notAllowed()
      },
    })

    await run()
    expect(next).toHaveBeenCalledWith()
  })

  it("(d) fails closed on any other error (e.g. Stripe unavailable)", async () => {
    const { run, next } = setup([stripeSession()], {
      authorize: async () => {
        throw new Error("Stripe is down")
      },
    })

    await expect(run()).rejects.toThrow("Stripe is down")
    expect(next).not.toHaveBeenCalled()
  })

  it.each([
    ["a non-Stripe session (pp_system_default)", [stripeSession({ provider_id: "pp_system_default", data: {} })]],
    ["a Stripe session without a PaymentIntent id", [stripeSession({ data: {} })]],
    ["no session", []],
  ])("(e) skips the provider for %s", async (_label, sessions) => {
    const { run, next, payment, locking } = setup(sessions)

    await run()
    expect(payment.authorizePaymentSession).not.toHaveBeenCalled()
    expect(locking.execute).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith()
  })

  it("(f) never imports the Stripe SDK (reads PI status through the payment module only)", () => {
    const source = readFileSync(join(__dirname, "..", "stripe-session-guard.ts"), "utf8")
    expect(source).not.toMatch(/from\s+["']stripe["']|require\(\s*["']stripe["']\s*\)|import\(\s*["']stripe["']\s*\)/)
  })

  it("locks on the cart id of the collection (same key as processPaymentWorkflow)", async () => {
    const { run, locking } = setup([stripeSession()], { cartId: "cart_42", authorize: async () => Promise.reject(notAllowed()) })

    await run()
    expect(locking.execute).toHaveBeenCalledWith("cart_42", expect.any(Function), expect.anything())
  })

  it("locks on the payment collection id when the collection has no cart (order payment, ADR-015 appendix)", async () => {
    const { run, locking } = setup([stripeSession()], { cartId: null, authorize: async () => Promise.reject(notAllowed()) })

    await run()
    expect(locking.execute).toHaveBeenCalledWith("pay_col_1", expect.any(Function), expect.anything())
  })
})
