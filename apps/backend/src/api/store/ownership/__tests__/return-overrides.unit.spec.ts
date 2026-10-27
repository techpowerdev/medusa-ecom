import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rejectStoreReturnOverrides, storeReturnOverrides } from "../return-overrides"
import { storeOwnershipMiddlewares } from "../middlewares"

// CORE-16 (owner 2026-10-26): ฟิลด์ของ StorePostReturnsReqSchema (Medusa 2.22.1) ที่ store ห้ามกำหนดเอง
describe("storeReturnOverrides", () => {
  it("returns nothing for the fields a customer may send", () => {
    expect(
      storeReturnOverrides({
        order_id: "order_1",
        items: [{ id: "ordli_1", quantity: 1, reason_id: "rr_1", note: "too big" }],
        return_shipping: { option_id: "so_return" },
        note: "please",
      })
    ).toEqual([])
    expect(storeReturnOverrides(undefined)).toEqual([])
  })

  it("does not throw for a body or return_shipping that is not an object (core validator answers 400)", () => {
    for (const body of [null, "x", 1, true, []]) {
      expect(storeReturnOverrides(body)).toEqual([])
    }
    for (const return_shipping of [null, "so_1", 0, false]) {
      expect(storeReturnOverrides({ order_id: "order_1", return_shipping })).toEqual([])
    }
    expect(storeReturnOverrides({ return_shipping: "so_1", receive_now: true })).toEqual(["receive_now"])
  })

  it("lists return_shipping.price, receive_now and location_id whenever they are present (any value)", () => {
    expect(storeReturnOverrides({ return_shipping: { option_id: "so", price: 0 } })).toEqual(["return_shipping.price"])
    expect(storeReturnOverrides({ receive_now: false })).toEqual(["receive_now"])
    expect(storeReturnOverrides({ location_id: null })).toEqual(["location_id"])
    expect(
      storeReturnOverrides({
        return_shipping: { option_id: "so", price: 5 },
        receive_now: true,
        location_id: "sloc_1",
      })
    ).toEqual(["return_shipping.price", "receive_now", "location_id"])
  })
})

describe("rejectStoreReturnOverrides", () => {
  const run = (body: unknown) => {
    const next = jest.fn() as unknown as MedusaNextFunction
    const call = () =>
      rejectStoreReturnOverrides({ body } as MedusaRequest, {} as MedusaResponse, next)
    return { call, next }
  }

  it("throws 400 invalid_data naming the fields, without calling next", () => {
    const { call, next } = run({ order_id: "order_1", receive_now: true, location_id: "sloc_1" })
    expect(call).toThrow(
      expect.objectContaining({
        type: MedusaError.Types.INVALID_DATA,
        message: expect.stringContaining("receive_now, location_id"),
      })
    )
    expect(next).not.toHaveBeenCalled()
  })

  it("calls next for a normal return request", () => {
    const { call, next } = run({ order_id: "order_1", items: [], return_shipping: { option_id: "so_return" } })
    call()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it("calls next for a body that is not an object (no 500 from the middleware)", () => {
    for (const body of [undefined, null, "x"]) {
      const { call, next } = run(body)
      expect(call).not.toThrow()
      expect(next).toHaveBeenCalledTimes(1)
    }
  })

  it("runs right after auth + owner check on the CORE-13 POST /store/returns entry (CORE-17 option + CORE-20b window checks follow)", () => {
    const routes = storeOwnershipMiddlewares.filter((r) => r.matcher === "/store/returns")
    expect(routes).toHaveLength(1)
    expect(routes[0].method).toEqual(["POST"])
    expect(routes[0].middlewares).toHaveLength(5)
    expect(routes[0].middlewares![2]).toBe(rejectStoreReturnOverrides)
  })
})
