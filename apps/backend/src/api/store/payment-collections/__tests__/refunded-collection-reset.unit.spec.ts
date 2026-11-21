import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { resetCartPaymentCollectionWorkflow } from "../../../../workflows/payment/reset-cart-payment-collection"
import { PAYMENT_COLLECTION_RESET } from "../errors"
import { guardGroupBuyPaymentWindow } from "../group-buy-payment-guard"
import { resetRefundedCartPaymentCollection } from "../refunded-collection-reset"
import { guardPaidStripeSession } from "../stripe-session-guard"
import middlewares from "../../../middlewares"

jest.mock("../../../../workflows/payment/reset-cart-payment-collection", () => ({
  resetCartPaymentCollectionWorkflow: jest.fn(),
}))

// PAY-9 (spec 06 กฎข้อ 11, AC-22, ADR-025): middleware ด้วย mock query + mock workflow
const raw = (value: string) => ({ raw_amount: { value, precision: 20 } })
const refunded = [{ canceled_at: null, captures: [raw("600")], refunds: [raw("600")] }]
const capturedOnly = [{ canceled_at: null, captures: [raw("600")], refunds: [] }]

function setup(collection: Record<string, unknown> | undefined, reset = true) {
  const graph = jest.fn(async () => ({ data: collection ? [collection] : [] }))
  const run = jest.fn(async () => ({ result: { reset } }))
  ;(resetCartPaymentCollectionWorkflow as unknown as jest.Mock).mockReset().mockReturnValue({ run })
  const services: Record<string, unknown> = { [ContainerRegistrationKeys.QUERY]: { graph } }
  const req = { method: "POST", params: { id: "pay_col_1" }, scope: { resolve: (key: string) => services[key] } }
  const next = jest.fn()
  return { call: () => resetRefundedCartPaymentCollection(req as any, {} as any, next), next, run, graph }
}

async function expectReset(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e) => e
  )
  expect(error).toBeInstanceOf(MedusaError)
  expect(error).toMatchObject({ type: MedusaError.Types.CONFLICT, code: PAYMENT_COLLECTION_RESET })
}

describe("resetRefundedCartPaymentCollection", () => {
  it.each([
    ["unknown collection", undefined],
    ["cart collection without payments", { id: "pay_col_1", cart: { id: "cart_1" }, order: null, payments: [] }],
    ["cart collection with a captured payment not refunded (AC-22 b)", { id: "pay_col_1", cart: { id: "cart_1" }, order: null, payments: capturedOnly }],
    ["order collection (group buy) fully refunded (AC-22 b)", { id: "pay_col_1", cart: null, order: { id: "order_1" }, payments: refunded }],
    [
      "cart collection fully refunded but with a session not yet paid (webhook may still come — review #445)",
      {
        id: "pay_col_1",
        cart: { id: "cart_1" },
        order: null,
        payments: refunded,
        payment_sessions: [{ id: "ps_old", payment: { id: "pay_1" } }, { id: "ps_new", payment: null }],
      },
    ],
  ])("%s → next() without the workflow", async (_label, collection) => {
    const { call, next, run } = setup(collection)
    await call()
    expect(next).toHaveBeenCalledTimes(1)
    expect(run).not.toHaveBeenCalled()
  })

  it("cart collection fully refunded → dismisses the link via the workflow and answers PAYMENT_COLLECTION_RESET", async () => {
    const { call, next, run } = setup({ id: "pay_col_1", cart: { id: "cart_1" }, order: null, payments: refunded })
    await expectReset(call())
    expect(run).toHaveBeenCalledWith({ input: { cart_id: "cart_1", payment_collection_id: "pay_col_1" } })
    expect(next).not.toHaveBeenCalled()
  })

  it("link already dismissed by a concurrent request (no cart, no order) → same 409 without the workflow", async () => {
    const { call, next, run } = setup({ id: "pay_col_1", cart: null, order: null, payments: refunded })
    await expectReset(call())
    expect(run).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it("workflow re-checks under the lock and finds nothing to reset → next()", async () => {
    const { call, next } = setup({ id: "pay_col_1", cart: { id: "cart_1" }, order: null, payments: refunded }, false)
    await call()
    expect(next).toHaveBeenCalledTimes(1)
  })
})

describe("middleware order on POST /store/payment-collections/:id/payment-sessions (ADR-025)", () => {
  it("GB guard → reset → guardPaidStripeSession", () => {
    const chain = ((middlewares.routes ?? []) as { matcher: unknown; methods?: string[]; middlewares?: unknown[] }[])
      .filter((r) => r.matcher === "/store/payment-collections/:id/payment-sessions" && r.methods?.includes("POST"))
      .flatMap((r) => r.middlewares ?? [])
    const gb = chain.indexOf(guardGroupBuyPaymentWindow as any)
    const reset = chain.indexOf(resetRefundedCartPaymentCollection as any)
    const stripe = chain.indexOf(guardPaidStripeSession as any)
    expect(gb).toBeGreaterThanOrEqual(0)
    expect(reset).toBeGreaterThan(gb)
    expect(stripe).toBeGreaterThan(reset)
  })
})
