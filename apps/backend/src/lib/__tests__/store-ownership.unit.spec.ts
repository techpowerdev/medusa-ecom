import { MedusaError } from "@medusajs/framework/utils"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import type { MiddlewareRoute } from "@medusajs/framework/http"
import {
  STORE_RESOURCE_NOT_FOUND,
  assertCartOwner,
  cartOwner,
  orderOwner,
  paymentCollectionOwner,
} from "../store-ownership"
import { ensureStoreOwnership, storeOwnershipMiddlewares } from "../../api/store/ownership/middlewares"

// CORE-12 (spec 01 กฎ 22-23, ADR-013): resolver ของ owner ต่อ matcher + middleware 404 เมื่อไม่ใช่เจ้าของ
type GraphCall = { entity: string; fields: string[]; filters: Record<string, unknown> }

const fakeQuery = (rows: Record<string, Record<string, unknown>[]>) => {
  const calls: GraphCall[] = []
  const query = {
    graph: async (config: GraphCall) => {
      calls.push(config)
      return { data: rows[config.entity] ?? [] }
    },
  } as unknown as RemoteQueryFunction
  return { query, calls }
}

const notFound = expect.objectContaining({ type: MedusaError.Types.NOT_FOUND, message: STORE_RESOURCE_NOT_FOUND })

describe("owner resolvers", () => {
  it("cartOwner reads cart.customer_id by id", async () => {
    const { query, calls } = fakeQuery({ cart: [{ id: "cart_1", customer_id: "cus_a" }] })
    await expect(cartOwner(query, "cart_1")).resolves.toEqual("cus_a")
    expect(calls).toEqual([{ entity: "cart", fields: ["customer_id"], filters: { id: "cart_1" } }])
  })

  it("cartOwner returns null for a missing cart, a cart without customer, or no id (no query)", async () => {
    await expect(cartOwner(fakeQuery({}).query, "cart_x")).resolves.toBeNull()
    await expect(cartOwner(fakeQuery({ cart: [{ customer_id: null }] }).query, "cart_1")).resolves.toBeNull()
    const { query, calls } = fakeQuery({})
    await expect(cartOwner(query, undefined)).resolves.toBeNull()
    await expect(cartOwner(query, "")).resolves.toBeNull()
    expect(calls).toHaveLength(0)
  })

  it("orderOwner reads order.customer_id", async () => {
    const { query, calls } = fakeQuery({ order: [{ customer_id: "cus_a" }] })
    await expect(orderOwner(query, "order_1")).resolves.toEqual("cus_a")
    expect(calls[0]).toMatchObject({ entity: "order", filters: { id: "order_1" } })
    await expect(orderOwner(fakeQuery({}).query, "order_x")).resolves.toBeNull()
  })

  it("paymentCollectionOwner uses the linked cart, falling back to the linked order", async () => {
    const viaCart = fakeQuery({ payment_collection: [{ cart: { customer_id: "cus_a" }, order: null }] })
    await expect(paymentCollectionOwner(viaCart.query, "pay_col_1")).resolves.toEqual("cus_a")
    expect(viaCart.calls[0]).toEqual({
      entity: "payment_collection",
      fields: ["cart.customer_id", "order.customer_id"],
      filters: { id: "pay_col_1" },
    })

    const viaOrder = fakeQuery({ payment_collection: [{ cart: null, order: { customer_id: "cus_b" } }] })
    await expect(paymentCollectionOwner(viaOrder.query, "pay_col_2")).resolves.toEqual("cus_b")

    const orphan = fakeQuery({ payment_collection: [{ cart: null, order: null }] })
    await expect(paymentCollectionOwner(orphan.query, "pay_col_3")).resolves.toBeNull()
  })
})

describe("assertCartOwner (ADR-013 ข้อ 3 — ใช้ใน route/workflow ของเราเอง เช่น GB-3)", () => {
  const { query } = fakeQuery({ cart: [{ customer_id: "cus_a" }] })

  it("passes for the owner", async () => {
    await expect(assertCartOwner(query, "cart_1", "cus_a")).resolves.toBeUndefined()
  })

  it("throws 404 not_found for another customer, a missing cart or a missing customer", async () => {
    await expect(assertCartOwner(query, "cart_1", "cus_b")).rejects.toEqual(notFound)
    await expect(assertCartOwner(fakeQuery({}).query, "cart_x", "cus_a")).rejects.toEqual(notFound)
    await expect(assertCartOwner(query, "cart_1", undefined)).rejects.toEqual(notFound)
  })
})

type FakeReq = {
  params?: Record<string, string>
  body?: Record<string, unknown>
  query?: Record<string, unknown>
  auth_context?: { actor_id: string }
}

const run = async (middleware: (...args: any[]) => unknown, req: FakeReq, query: RemoteQueryFunction) => {
  const next = jest.fn()
  const request = { params: {}, body: {}, query: {}, ...req, scope: { resolve: () => query } }
  await middleware(request, {}, next)
  return next
}

describe("ensureStoreOwnership", () => {
  const { query } = fakeQuery({})
  const mw = (owner: string | null) => ensureStoreOwnership(async () => owner)

  it("calls next() when the resolved owner is the authenticated customer", async () => {
    const next = await run(mw("cus_a"), { auth_context: { actor_id: "cus_a" } }, query)
    expect(next).toHaveBeenCalledWith()
  })

  it("throws 404 when the owner differs, is null, or there is no actor", async () => {
    await expect(run(mw("cus_a"), { auth_context: { actor_id: "cus_b" } }, query)).rejects.toEqual(notFound)
    await expect(run(mw(null), { auth_context: { actor_id: "cus_a" } }, query)).rejects.toEqual(notFound)
    await expect(run(mw("cus_a"), {}, query)).rejects.toEqual(notFound)
  })
})

describe("storeOwnershipMiddlewares: which id each matcher checks", () => {
  const find = (matcher: string, method?: string) => {
    const route = storeOwnershipMiddlewares.find(
      (r: MiddlewareRoute) => r.matcher === matcher && (method ? r.method?.includes(method as never) : !r.method)
    )
    if (!route) {
      throw new Error(`no ownership middleware for ${method ?? "ALL"} ${matcher}`)
    }
    // middleware ตัวสุดท้ายของแต่ละ matcher คือตัวตรวจ owner (ตัวก่อนหน้าเป็น authenticate ถ้ามี)
    return route.middlewares![route.middlewares!.length - 1]
  }

  const rows = {
    cart: [{ customer_id: "cus_a" }],
    order: [{ customer_id: "cus_a" }],
    payment_collection: [{ cart: { customer_id: "cus_a" }, order: null }],
  }
  const owner = { auth_context: { actor_id: "cus_a" } }

  it.each([
    ["/store/carts/:id", "ALL", "cart", { params: { id: "cart_1" } }, "cart_1"],
    ["/store/payment-collections", "POST", "cart", { body: { cart_id: "cart_1" } }, "cart_1"],
    [
      "/store/payment-collections/:id/payment-sessions",
      "ALL",
      "payment_collection",
      { params: { id: "pay_col_1" } },
      "pay_col_1",
    ],
    ["/store/shipping-options", "GET", "cart", { query: { cart_id: "cart_1" } }, "cart_1"],
    ["/store/shipping-options/:id/calculate", "POST", "cart", { params: { id: "so_1" }, body: { cart_id: "cart_1" } }, "cart_1"],
    ["/store/orders/:id", "GET", "order", { params: { id: "order_1" } }, "order_1"],
  ])("%s (%s) → looks up %s", async (matcher, methodName, entity, req, id) => {
    const method = methodName === "ALL" ? undefined : methodName
    const { query, calls } = fakeQuery(rows)
    const next = await run(find(matcher, method), { ...req, ...owner }, query)
    expect(next).toHaveBeenCalledWith()
    expect(calls).toEqual([expect.objectContaining({ entity: entity, filters: { id } })])

    const other = fakeQuery(rows)
    await expect(run(find(matcher, method), { ...req, auth_context: { actor_id: "cus_b" } }, other.query)).rejects.toEqual(
      notFound
    )
  })

  it("adds authenticate(customer) to shipping-options and GET /store/orders/:id", () => {
    const auth = storeOwnershipMiddlewares.find((r) => r.matcher === "/store/shipping-options*" && !r.method)
    expect(auth?.middlewares).toHaveLength(1)
    const order = storeOwnershipMiddlewares.find((r) => r.matcher === "/store/orders/:id")
    expect(order?.method).toEqual(["GET"])
    expect(order?.middlewares).toHaveLength(2)
  })
})
