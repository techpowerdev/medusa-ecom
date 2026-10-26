import { MedusaError } from "@medusajs/framework/utils"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { STORE_RESOURCE_NOT_FOUND } from "../../../../lib/store-ownership"
import { ensureQueryCartOwnership, storeOwnershipMiddlewares } from "../middlewares"

// CORE-12b (spec 01 กฎ 28, ADR-013): query.cart_id บน products/product-variants ตรวจเจ้าของเฉพาะเมื่อมี key
const PRODUCT_ROUTES = [
  "/store/products",
  "/store/products/:id",
  "/store/product-variants",
  "/store/product-variants/:id",
]

const run = async (queryParams: Record<string, unknown>, actorId?: string) => {
  const graph = jest.fn(async () => ({ data: [{ id: "cart_a", customer_id: "cus_a" }] }))
  const req = {
    query: queryParams,
    auth_context: actorId ? { actor_id: actorId } : undefined,
    scope: { resolve: () => ({ graph }) as unknown as RemoteQueryFunction },
  }
  const next = jest.fn()
  const error = await Promise.resolve(ensureQueryCartOwnership(req as any, {} as any, next)).then(
    () => undefined,
    (e: unknown) => e
  )
  return { error, next, graph }
}

describe("ensureQueryCartOwnership", () => {
  it("passes without auth or query when cart_id is absent (public browsing)", async () => {
    const { error, next, graph } = await run({ region_id: "reg_1" })
    expect(error).toBeUndefined()
    expect(next).toHaveBeenCalledTimes(1)
    expect(graph).not.toHaveBeenCalled()
  })

  it("throws 401 when cart_id is present but there is no customer", async () => {
    const { error, next, graph } = await run({ cart_id: "cart_a" })
    expect(error).toEqual(expect.objectContaining({ type: MedusaError.Types.UNAUTHORIZED }))
    expect(next).not.toHaveBeenCalled()
    expect(graph).not.toHaveBeenCalled()
  })

  it("calls next for the cart owner", async () => {
    const { error, next } = await run({ cart_id: "cart_a" }, "cus_a")
    expect(error).toBeUndefined()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["another customer's cart", "cart_a", "cus_b"],
    ["an empty cart_id", "", "cus_a"],
    ["an array cart_id", ["cart_a", "cart_a"], "cus_a"],
  ])("throws 404 for %s", async (_name, cartId, actor) => {
    const { error, next } = await run({ cart_id: cartId }, actor)
    expect(error).toEqual(
      expect.objectContaining({ type: MedusaError.Types.NOT_FOUND, message: STORE_RESOURCE_NOT_FOUND })
    )
    expect(next).not.toHaveBeenCalled()
  })
})

describe("storeOwnershipMiddlewares: product routes (CORE-12b)", () => {
  it.each(PRODUCT_ROUTES)("GET %s runs optional customer auth then the query cart check", (matcher) => {
    const route = storeOwnershipMiddlewares.find((r) => r.matcher === matcher)
    expect(route?.method).toEqual(["GET"])
    expect(route?.middlewares).toHaveLength(2)
    expect(route?.middlewares?.[1]).toBe(ensureQueryCartOwnership)
  })
})
