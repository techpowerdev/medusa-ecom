import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"

// EV-15 (spec 02 กฎข้อ 31, AC-45 ส่วน unit): handler ตัวเดียวของ refreshCartItemsWorkflow.hooks.beforeRefreshingPaymentCollection
const beforeRefreshingPaymentCollection = jest.fn()
jest.mock("@medusajs/medusa/core-flows", () => ({
  refreshCartItemsWorkflow: { hooks: { beforeRefreshingPaymentCollection } },
}))

type HookResult = { compensateInput?: string[] } | undefined
type Handler = (data: { input: Record<string, unknown> }, ctx: { container: MedusaContainer }) => Promise<HookResult>
type Compensation = (ids: string[] | undefined, ctx: { container: MedusaContainer }) => Promise<void>

describe("refresh-cart-orphan-shipping (EV-15)", () => {
  let handler: Handler
  let compensation: Compensation

  beforeAll(() => {
    jest.isolateModules(() => {
      require("../refresh-cart-orphan-shipping")
    })
    expect(beforeRefreshingPaymentCollection).toHaveBeenCalledTimes(1)
    ;[handler, compensation] = beforeRefreshingPaymentCollection.mock.calls[0]
  })

  function setup(cart: { items: { requires_shipping: boolean }[]; shipping_methods: { id: string; shipping_option_id: string | null }[] }) {
    const softDeleteShippingMethods = jest.fn()
    const restoreShippingMethods = jest.fn()
    const graph = jest.fn(async ({ entity }: { entity: string }) => ({
      data:
        entity === "cart"
          ? [cart]
          : [
              { id: "so_standard", type: { code: "standard" } },
              { id: "so_digital", type: { code: "digital-delivery" } },
            ],
    }))
    const container = {
      resolve: (key: string) => {
        if (key === ContainerRegistrationKeys.QUERY) {
          return { graph }
        }
        return key === Modules.CART ? { softDeleteShippingMethods, restoreShippingMethods } : undefined
      },
    } as unknown as MedusaContainer
    return { container, graph, softDeleteShippingMethods, restoreShippingMethods }
  }

  const voucher = { requires_shipping: false }
  const shirt = { requires_shipping: true }
  const standard = { id: "sm_standard", shipping_option_id: "so_standard" }
  const digital = { id: "sm_digital", shipping_option_id: "so_digital" }

  it("input.shipping_methods ไม่ว่าง (refresh จากการเพิ่ม method) → ไม่เรียก softDeleteShippingMethods", async () => {
    const { container, softDeleteShippingMethods } = setup({ items: [voucher], shipping_methods: [standard] })

    await handler({ input: { cart_id: "cart_1", shipping_methods: [standard] } }, { container })

    expect(softDeleteShippingMethods).not.toHaveBeenCalled()
  })

  it("cart voucher ล้วน → ลบ Standard และส่ง id ให้ compensation", async () => {
    const { container, softDeleteShippingMethods } = setup({ items: [voucher], shipping_methods: [standard] })

    const result = await handler({ input: { cart_id: "cart_1" } }, { container })

    expect(softDeleteShippingMethods).toHaveBeenCalledWith(["sm_standard"])
    expect(result?.compensateInput).toEqual(["sm_standard"])
  })

  it("cart voucher ล้วนที่มี Digital → ไม่ลบ method digital-delivery", async () => {
    const { container, softDeleteShippingMethods } = setup({ items: [voucher], shipping_methods: [digital] })

    await handler({ input: { cart_id: "cart_1" } }, { container })

    expect(softDeleteShippingMethods).not.toHaveBeenCalled()
  })

  it("method ที่ไม่มี shipping_option_id ไม่ใช่ digital-delivery → ลบ", async () => {
    const custom = { id: "sm_custom", shipping_option_id: null }
    const { container, softDeleteShippingMethods } = setup({ items: [voucher], shipping_methods: [custom] })

    await handler({ input: { cart_id: "cart_1" } }, { container })

    expect(softDeleteShippingMethods).toHaveBeenCalledWith(["sm_custom"])
  })

  it.each([
    ["cart ผสม", { items: [voucher, shirt], shipping_methods: [standard] }],
    ["cart ว่าง", { items: [], shipping_methods: [standard] }],
    ["cart ที่ไม่มี method", { items: [voucher], shipping_methods: [] }],
  ])("%s → ไม่แตะและไม่ throw", async (_case, cart) => {
    const { container, softDeleteShippingMethods } = setup(cart)

    const result = await handler({ input: { cart_id: "cart_1" } }, { container })

    expect(softDeleteShippingMethods).not.toHaveBeenCalled()
    expect(result?.compensateInput).toEqual([])
  })

  it("compensation เรียก restoreShippingMethods ด้วย id ที่ลบ", async () => {
    const { container, restoreShippingMethods } = setup({ items: [], shipping_methods: [] })

    await compensation(["sm_standard"], { container })

    expect(restoreShippingMethods).toHaveBeenCalledWith(["sm_standard"])
  })

  it.each([[[]], [undefined]])("compensation เมื่อไม่มีอะไรถูกลบ (%j) → ไม่เรียก restoreShippingMethods", async (ids) => {
    const { container, restoreShippingMethods } = setup({ items: [], shipping_methods: [] })

    await compensation(ids, { container })

    expect(restoreShippingMethods).not.toHaveBeenCalled()
  })

  it("static: ใช้ hook ของ Medusa และไม่แก้ node_modules", () => {
    const source = readFileSync(join(__dirname, "../refresh-cart-orphan-shipping.ts"), "utf8")

    expect(source).toContain("refreshCartItemsWorkflow.hooks.beforeRefreshingPaymentCollection")
    expect(source).not.toContain("node_modules")
  })
})
