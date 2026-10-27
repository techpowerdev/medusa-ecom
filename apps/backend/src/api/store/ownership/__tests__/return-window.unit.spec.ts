import { DEFAULT_REGION_STORE_POLICIES } from "../../../../lib/region-store-policies"
import { storeOwnershipMiddlewares } from "../middlewares"
import { validateStoreReturnShippingOption } from "../return-shipping-option"
import {
  RETURN_ITEM_NOT_SHIPPABLE,
  RETURN_ITEM_NOT_SHIPPED,
  RETURN_WINDOW_EXPIRED,
  returnWindowDaysOf,
  storeReturnWindowError,
  validateStoreReturnWindow,
} from "../return-window"

// CORE-20b (owner Q-F6 2026-10-27, AC-95): POST /store/returns บังคับช่วงคืน N วันนับจาก delivered_at (ไม่มีใช้ shipped_at)
// ของ fulfillment ที่มี line นั้น และกัน line ที่ไม่ต้องจัดส่ง (e-voucher)
const DAY = 24 * 60 * 60 * 1000
const now = new Date("2026-10-27T12:00:00Z")
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY)

const order = (
  fulfillments: { shipped_at?: Date | null; delivered_at?: Date | null; canceled_at?: Date | null; items: string[] }[],
  lines = [
    { id: "ordli_shirt", requires_shipping: true },
    { id: "ordli_voucher", requires_shipping: false },
  ]
) => ({
  items: lines,
  fulfillments: fulfillments.map(({ items, ...dates }) => ({ ...dates, items: items.map((line_item_id) => ({ line_item_id })) })),
})

describe("returnWindowDaysOf", () => {
  it("reads return_window_days from region metadata (number or numeric string)", () => {
    expect(returnWindowDaysOf({ return_window_days: 7 })).toBe(7)
    expect(returnWindowDaysOf({ return_window_days: "14" })).toBe(14)
    expect(returnWindowDaysOf({ return_window_days: 0 })).toBe(0)
  })

  it("falls back to the default from region-store-policies when missing or invalid", () => {
    const fallback = DEFAULT_REGION_STORE_POLICIES.return_window_days
    for (const metadata of [null, undefined, {}, { return_window_days: "" }, { return_window_days: "x" }, { return_window_days: -1 }]) {
      expect(returnWindowDaysOf(metadata)).toBe(fallback)
    }
  })
})

describe("storeReturnWindowError", () => {
  it("accepts a shipped line inside the window (boundary inclusive)", () => {
    expect(storeReturnWindowError(["ordli_shirt"], order([{ shipped_at: daysAgo(1), items: ["ordli_shirt"] }]), 7, now)).toBeNull()
    expect(storeReturnWindowError(["ordli_shirt"], order([{ shipped_at: daysAgo(7), items: ["ordli_shirt"] }]), 7, now)).toBeNull()
  })

  it("rejects a line shipped more than N days ago", () => {
    expect(storeReturnWindowError(["ordli_shirt"], order([{ shipped_at: daysAgo(8), items: ["ordli_shirt"] }]), 7, now)?.code).toBe(
      RETURN_WINDOW_EXPIRED
    )
  })

  it("uses delivered_at instead of shipped_at when the fulfillment has been delivered", () => {
    const delivered = order([{ shipped_at: daysAgo(10), delivered_at: daysAgo(2), items: ["ordli_shirt"] }])
    expect(storeReturnWindowError(["ordli_shirt"], delivered, 7, now)).toBeNull()
    const deliveredLongAgo = order([{ shipped_at: daysAgo(1), delivered_at: daysAgo(8), items: ["ordli_shirt"] }])
    expect(storeReturnWindowError(["ordli_shirt"], deliveredLongAgo, 7, now)?.code).toBe(RETURN_WINDOW_EXPIRED)
  })

  it("rejects a line that is fulfilled but not shipped, or only in a canceled fulfillment", () => {
    expect(storeReturnWindowError(["ordli_shirt"], order([{ items: ["ordli_shirt"] }]), 7, now)?.code).toBe(RETURN_ITEM_NOT_SHIPPED)
    expect(storeReturnWindowError(["ordli_shirt"], order([]), 7, now)?.code).toBe(RETURN_ITEM_NOT_SHIPPED)
    const canceled = order([{ shipped_at: daysAgo(1), canceled_at: daysAgo(1), items: ["ordli_shirt"] }])
    expect(storeReturnWindowError(["ordli_shirt"], canceled, 7, now)?.code).toBe(RETURN_ITEM_NOT_SHIPPED)
  })

  it("only counts fulfillments that contain the line; the latest one wins", () => {
    const other = order([{ shipped_at: daysAgo(1), items: ["ordli_other"] }, { shipped_at: daysAgo(9), items: ["ordli_shirt"] }])
    expect(storeReturnWindowError(["ordli_shirt"], other, 7, now)?.code).toBe(RETURN_WINDOW_EXPIRED)
    const split = order([{ shipped_at: daysAgo(9), items: ["ordli_shirt"] }, { shipped_at: daysAgo(1), items: ["ordli_shirt"] }])
    expect(storeReturnWindowError(["ordli_shirt"], split, 7, now)).toBeNull()
  })

  it("rejects a line that does not require shipping (e-voucher) even when other lines are fine", () => {
    const shipped = order([{ shipped_at: daysAgo(1), items: ["ordli_shirt", "ordli_voucher"] }])
    expect(storeReturnWindowError(["ordli_shirt", "ordli_voucher"], shipped, 7, now)?.code).toBe(RETURN_ITEM_NOT_SHIPPABLE)
  })

  it("rejects an id that is not a line of the order, with a message that does not echo the input", () => {
    const injected = "ordli_<script>x</script>"
    const error = storeReturnWindowError([injected], order([{ shipped_at: daysAgo(1), items: ["ordli_shirt"] }]), 7, now)
    expect(error?.code).toBe(RETURN_ITEM_NOT_SHIPPABLE)
    for (const e of [error, storeReturnWindowError(["ordli_shirt"], order([]), 7, now)]) {
      expect(e?.message).not.toContain("ordli_")
    }
  })
})

describe("POST /store/returns middleware order", () => {
  it("runs the return window check last, after the CORE-17/21 option check", () => {
    const chain = storeOwnershipMiddlewares.find((m) => m.matcher === "/store/returns")!.middlewares!
    expect(chain.indexOf(validateStoreReturnWindow)).toBe(chain.indexOf(validateStoreReturnShippingOption) + 1)
    expect(chain[chain.length - 1]).toBe(validateStoreReturnWindow)
  })
})
