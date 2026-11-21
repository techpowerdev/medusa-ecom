import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { GB_PAYMENT_CLOSED } from "../../../../modules/group_buy/errors"
import { guardGroupBuyPaymentWindow } from "../group-buy-payment-guard"
import { guardPaidStripeSession } from "../stripe-session-guard"
import middlewares from "../../../middlewares"

// GB-20 (spec 04 กฎข้อ 42, AC-62, ADR-024 a): guard ด้วย mock query
type Collection = { id: string; status: string; order?: { id: string; metadata?: Record<string, unknown> | null } | null }
type Membership = { id: string; status: string; order_id: string; group?: { pay_deadline_at?: string | null } | null }

const HOUR = 60 * 60 * 1000

function setup(collection: Collection | undefined, membership?: Membership) {
  const graph = jest.fn(async ({ entity }: { entity: string }) => ({
    data: entity === "payment_collection" ? (collection ? [collection] : []) : membership ? [membership] : [],
  }))
  const services: Record<string, unknown> = { [ContainerRegistrationKeys.QUERY]: { graph } }
  const req = { method: "POST", params: { id: "pay_col_1" }, scope: { resolve: (key: string) => services[key] } }
  const next = jest.fn()
  const run = () => guardGroupBuyPaymentWindow(req as any, {} as any, next)
  return { run, next, graph }
}

const groupBuyCollection = (status = "not_paid"): Collection => ({
  id: "pay_col_1",
  status,
  order: { id: "order_1", metadata: { group_buy_membership_id: "gbmem_1" } },
})
const membership = (status: string, deadlineOffset = HOUR, orderId = "order_1"): Membership => ({
  id: "gbmem_1",
  status,
  order_id: orderId,
  group: { pay_deadline_at: new Date(Date.now() + deadlineOffset).toISOString() },
})

describe("guardGroupBuyPaymentWindow (AC-62)", () => {
  it.each([
    ["no order (cart collection)", { id: "pay_col_1", status: "not_paid", order: null }],
    ["an order without group buy metadata", { id: "pay_col_1", status: "not_paid", order: { id: "order_1", metadata: {} } }],
    ["an order with null metadata", { id: "pay_col_1", status: "not_paid", order: { id: "order_1", metadata: null } }],
  ])("collection with %s → next() after a single query.graph", async (_label, collection) => {
    const { run, next, graph } = setup(collection)
    await run()
    expect(next).toHaveBeenCalledTimes(1)
    expect(graph).toHaveBeenCalledTimes(1)
  })

  it("unknown collection → next() (ownership already answered 404)", async () => {
    const { run, next } = setup(undefined)
    await run()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it("(c) awaiting_payment before the deadline → next()", async () => {
    const { run, next } = setup(groupBuyCollection(), membership("awaiting_payment"))
    await run()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["(a) awaiting_payment past pay_deadline_at", groupBuyCollection(), membership("awaiting_payment", -1000)],
    ["(b) cancelled", groupBuyCollection(), membership("cancelled")],
    ["joined (no payment window yet)", groupBuyCollection(), membership("joined")],
    ["paid", groupBuyCollection(), membership("paid")],
    ["collection canceled", groupBuyCollection("canceled"), membership("awaiting_payment")],
  ])("%s → 400 not_allowed GB_PAYMENT_CLOSED and next() not called", async (_label, collection, m) => {
    const { run, next } = setup(collection, m)
    await expect(run()).rejects.toMatchObject({ type: MedusaError.Types.NOT_ALLOWED, code: GB_PAYMENT_CLOSED })
    expect(next).not.toHaveBeenCalled()
  })

  // metadata ของ order ปกติมาจาก cart.metadata (ลูกค้าตั้งได้) → ใช้กฎเฉพาะ membership ของ order นี้จริง
  it.each([
    ["of another order", membership("cancelled", HOUR, "order_other")],
    ["not found", undefined],
  ])("membership %s → next()", async (_label, m) => {
    const { run, next } = setup(groupBuyCollection(), m)
    await run()
    expect(next).toHaveBeenCalledTimes(1)
  })
})

describe("middleware order on POST /store/payment-collections/:id/payment-sessions (ADR-024/ADR-025)", () => {
  it("GB guard runs before guardPaidStripeSession", () => {
    // defineMiddlewares แปลง `method` เป็น `methods`
    const chain = ((middlewares.routes ?? []) as { matcher: unknown; methods?: string[]; middlewares?: unknown[] }[])
      .filter((r) => r.matcher === "/store/payment-collections/:id/payment-sessions" && r.methods?.includes("POST"))
      .flatMap((r) => r.middlewares ?? [])
    const gb = chain.indexOf(guardGroupBuyPaymentWindow as any)
    const stripe = chain.indexOf(guardPaidStripeSession as any)
    expect(gb).toBeGreaterThanOrEqual(0)
    expect(stripe).toBeGreaterThan(gb)
  })
})
