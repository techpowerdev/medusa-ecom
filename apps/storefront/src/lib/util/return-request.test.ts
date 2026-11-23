import { describe, expect, it } from "vitest"

import { MedusaApiError } from "./medusa-api-error"

import {
  buildReturnRequest,
  canRequestReturn,
  DEFAULT_RETURN_WINDOW_DAYS,
  isReturnNotStockedError,
  RETURN_NOT_STOCKED,
  lineReceivedAt,
  returnableItems,
  returnableItemsNow,
  returnErrorMessage,
  returnWindowDaysOf,
} from "./return-request"

// spec 01 CORE-20 (AC-65, Q-F5 owner 2026-10-26): ขอคืนได้เฉพาะ item ที่ต้องจัดส่ง (ไม่ใช่ e-voucher) ที่ fulfill แล้ว
// และภายใน return_window_days วันนับจาก delivered_at ของ fulfillment (ไม่มีใช้ shipped_at)
const item = (
  id: string,
  detail: Partial<Record<string, number>>,
  requires_shipping: boolean | null = true
) => ({
  id,
  quantity: 3,
  requires_shipping,
  detail: {
    fulfilled_quantity: 0,
    shipped_quantity: 0,
    return_requested_quantity: 0,
    return_received_quantity: 0,
    return_dismissed_quantity: 0,
    ...detail,
  },
})

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-10-27T05:00:00Z")
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString()

describe("returnableItems", () => {
  it("จำนวนที่คืนได้ = shipped − (requested + received + dismissed)", () => {
    const items = [
      item("a", { fulfilled_quantity: 3, shipped_quantity: 3, return_requested_quantity: 1 }),
      item("b", { fulfilled_quantity: 2, shipped_quantity: 2, return_received_quantity: 1, return_dismissed_quantity: 1 }),
      item("c", { fulfilled_quantity: 0 }),
    ]
    expect(returnableItems(items).map((r) => [r.item.id, r.quantity])).toEqual([["a", 2]])
  })

  // CORE-20c AC-96 (กฎข้อ 60): นับ shipped_quantity ไม่ใช่ fulfilled_quantity — ของที่ fulfill แต่ยังไม่ส่งคืนไม่ได้
  it("qty 3, fulfilled 3, shipped 2, requested 1 → คืนได้ 1", () => {
    const items = [item("L", { fulfilled_quantity: 3, shipped_quantity: 2, return_requested_quantity: 1 })]
    expect(returnableItems(items).map((r) => [r.item.id, r.quantity])).toEqual([["L", 1]])
  })

  it("fulfill แล้วแต่ยังไม่ส่ง (shipped 0) → ไม่แสดง", () => {
    expect(returnableItems([item("a", { fulfilled_quantity: 2 })])).toEqual([])
  })

  it("ซ่อน line ที่ไม่ต้องจัดส่ง (e-voucher) หรือไม่ทราบค่า requires_shipping", () => {
    const items = [
      item("voucher", { fulfilled_quantity: 1, shipped_quantity: 1 }, false),
      item("unknown", { fulfilled_quantity: 1, shipped_quantity: 1 }, null),
      item("shirt", { fulfilled_quantity: 1, shipped_quantity: 1 }),
    ]
    expect(returnableItems(items).map((r) => r.item.id)).toEqual(["shirt"])
  })

  it("ไม่มี items → ว่าง", () => {
    expect(returnableItems(undefined)).toEqual([])
  })
})

// CORE-20d (กฎข้อ 66b): วันอ้างอิงคิดต่อ line = delivered_at (ไม่มีใช้ shipped_at) ล่าสุดของ fulfillment ที่มี line นั้น
const shipped = (lineIds: string[], dates: Record<string, string | null>) => ({
  ...dates,
  items: lineIds.map((line_item_id) => ({ line_item_id })),
})

describe("lineReceivedAt", () => {
  it("ใช้ delivered_at ก่อน shipped_at, เลือกล่าสุดเฉพาะ fulfillment ที่มี line นั้น, ไม่นับที่ยกเลิก", () => {
    const fulfillments = [
      shipped(["a"], { shipped_at: daysAgo(10), delivered_at: daysAgo(8) }),
      shipped(["a"], { shipped_at: daysAgo(5), delivered_at: null }),
      shipped(["a"], { shipped_at: daysAgo(1), canceled_at: daysAgo(1) }),
      shipped(["b"], { shipped_at: daysAgo(2) }),
    ]
    expect(lineReceivedAt(fulfillments, "a")?.toISOString()).toBe(daysAgo(5))
    expect(lineReceivedAt(fulfillments, "b")?.toISOString()).toBe(daysAgo(2))
  })

  it("line ยังไม่ส่ง / ไม่มี fulfillment ของ line → null", () => {
    expect(lineReceivedAt([shipped(["a"], { shipped_at: null, delivered_at: null })], "a")).toBeNull()
    expect(lineReceivedAt([shipped(["b"], { shipped_at: daysAgo(1) })], "a")).toBeNull()
    expect(lineReceivedAt(undefined, "a")).toBeNull()
  })
})

describe("canRequestReturn", () => {
  const order = (fulfillments: object[], items = [item("a", { fulfilled_quantity: 1, shipped_quantity: 1 })]) => ({
    items,
    fulfillments,
  })

  it("ภายใน N วันนับจากวันที่ได้รับ → ได้ (รวมวันสุดท้ายพอดี)", () => {
    expect(canRequestReturn(order([shipped(["a"], { delivered_at: daysAgo(29) })]), 30, NOW)).toBe(true)
    expect(canRequestReturn(order([shipped(["a"], { delivered_at: daysAgo(30) })]), 30, NOW)).toBe(true)
  })

  it("เกิน N วัน → ไม่ได้", () => {
    expect(canRequestReturn(order([shipped(["a"], { delivered_at: daysAgo(31) })]), 30, NOW)).toBe(false)
  })

  it("ไม่มี delivered_at ใช้ shipped_at", () => {
    expect(canRequestReturn(order([shipped(["a"], { shipped_at: daysAgo(3) })]), 7, NOW)).toBe(true)
    expect(canRequestReturn(order([shipped(["a"], { shipped_at: daysAgo(8) })]), 7, NOW)).toBe(false)
  })

  it("ยังไม่ fulfill / ยังไม่ส่ง → ไม่ได้", () => {
    expect(canRequestReturn(order([]), 30, NOW)).toBe(false)
    expect(canRequestReturn(order([shipped(["a"], { shipped_at: null })]), 30, NOW)).toBe(false)
  })

  it("ไม่มี item ที่คืนได้ (เช่น มีแต่ e-voucher) → ไม่ได้", () => {
    const voucherOnly = order(
      [shipped(["v"], { shipped_at: daysAgo(1) })],
      [item("v", { fulfilled_quantity: 1, shipped_quantity: 1 }, false)]
    )
    expect(canRequestReturn(voucherOnly, 30, NOW)).toBe(false)
  })

  it("อ่าน region ไม่ได้ (return_window_days = null) → ไม่ได้", () => {
    expect(canRequestReturn(order([shipped(["a"], { delivered_at: daysAgo(1) })]), null, NOW)).toBe(false)
  })

  // กฎข้อ 66b: ไม่ใช้ fulfillment ล่าสุดของทั้ง order — line ที่ส่งไปนานแล้วไม่ได้สิทธิ์จาก line อื่นที่เพิ่งส่ง
  it("line A พ้นช่วง แต่ line B เพิ่งส่ง → ยังมีปุ่ม (มี line คืนได้ ≥ 1)", () => {
    const items = [
      item("A", { fulfilled_quantity: 1, shipped_quantity: 1 }),
      item("B", { fulfilled_quantity: 1, shipped_quantity: 1 }),
    ]
    const fulfillments = [shipped(["A"], { shipped_at: daysAgo(31) }), shipped(["B"], { shipped_at: daysAgo(1) })]
    expect(canRequestReturn({ items, fulfillments }, 30, NOW)).toBe(true)
  })
})

// CORE-20c (กฎข้อ 60): หน้า return และ server action ใช้รายการเดียวกับปุ่ม — ตรวจช่วงคืนครั้งเดียว
describe("returnableItemsNow", () => {
  const items = [item("a", { fulfilled_quantity: 2, shipped_quantity: 2 })]

  it("ภายในช่วงคืน → line ที่คืนได้พร้อมจำนวน", () => {
    const lines = returnableItemsNow({ items, fulfillments: [shipped(["a"], { shipped_at: daysAgo(1) })] }, 7, NOW)
    expect(lines.map((r) => [r.item.id, r.quantity])).toEqual([["a", 2]])
  })

  it("เลยช่วงคืน / ยังไม่ส่ง / ไม่ทราบช่วงคืน → ว่าง", () => {
    expect(returnableItemsNow({ items, fulfillments: [shipped(["a"], { shipped_at: daysAgo(8) })] }, 7, NOW)).toEqual([])
    expect(returnableItemsNow({ items, fulfillments: [] }, 7, NOW)).toEqual([])
    expect(returnableItemsNow({ items, fulfillments: [shipped(["a"], { shipped_at: daysAgo(1) })] }, null, NOW)).toEqual([])
  })

  // AC-102: line A ส่งเมื่อ window + 1 วันก่อน, line B ส่งเมื่อวาน → เลือกได้เฉพาะ B
  it("ช่วงคืนต่อ line: เฉพาะ line ที่ยังอยู่ในช่วง", () => {
    const two = [
      item("A", { fulfilled_quantity: 1, shipped_quantity: 1 }),
      item("B", { fulfilled_quantity: 2, shipped_quantity: 2 }),
    ]
    const fulfillments = [shipped(["A"], { shipped_at: daysAgo(31) }), shipped(["B"], { shipped_at: daysAgo(1) })]
    expect(returnableItemsNow({ items: two, fulfillments }, 30, NOW).map((r) => [r.item.id, r.quantity])).toEqual([["B", 2]])
  })

  it("line ที่ส่งหลายรอบใช้วันอ้างอิงล่าสุด (แบบเดียวกับ backend)", () => {
    const fulfillments = [shipped(["a"], { shipped_at: daysAgo(40) }), shipped(["a"], { shipped_at: daysAgo(2) })]
    expect(returnableItemsNow({ items, fulfillments }, 30, NOW).map((r) => r.item.id)).toEqual(["a"])
  })
})

// CORE-20c: ค่าเริ่มต้นตรงกับ backend (DEFAULT_REGION_STORE_POLICIES.return_window_days ที่ CORE-20b ใช้)
describe("returnWindowDaysOf", () => {
  it("ค่าเริ่มต้น 30 วันเท่ากับ backend", () => {
    expect(DEFAULT_RETURN_WINDOW_DAYS).toBe(30)
  })

  it("ตัวเลข ≥ 0 หรือ string ตัวเลข → ใช้ค่านั้น", () => {
    expect(returnWindowDaysOf({ return_window_days: 7 })).toBe(7)
    expect(returnWindowDaysOf({ return_window_days: "14" })).toBe(14)
    expect(returnWindowDaysOf({ return_window_days: 0 })).toBe(0)
  })

  it("ไม่ตั้ง / ค่าไม่ถูกต้อง → ค่าเริ่มต้น", () => {
    for (const metadata of [null, undefined, {}, { return_window_days: "" }, { return_window_days: "x" }, { return_window_days: -1 }]) {
      expect(returnWindowDaysOf(metadata)).toBe(DEFAULT_RETURN_WINDOW_DAYS)
    }
  })
})

// CORE-20c: error 400 ของ CORE-20b แปลเป็นข้อความไทย — CORE-83 (กฎข้อ 140, ADR-028): ตัดสินจาก `code` ของ
// `MedusaApiError` (medusaFetch) เท่านั้น ข้อความอังกฤษของ backend ไม่มีผลแล้ว
describe("returnErrorMessage", () => {
  const apiError = (code: string | null, message = "x", status = 400) =>
    new MedusaApiError({ status, type: "invalid_data", code, message })
  const FALLBACK = "ส่งคำขอไม่สำเร็จ"
  const THAI = /[\u0E00-\u0E7F]/
  const CODES = ["RETURN_ITEM_NOT_SHIPPABLE", "RETURN_ITEM_NOT_SHIPPED", "RETURN_WINDOW_EXPIRED"]

  it.each(CODES)("%s → ข้อความไทยเฉพาะกรณี", (code) => {
    const text = returnErrorMessage(apiError(code), FALLBACK)
    expect(text).toMatch(THAI)
    expect(text).not.toBe(FALLBACK)
  })

  it("แต่ละ code ได้ข้อความต่างกัน", () => {
    expect(new Set(CODES.map((c) => returnErrorMessage(apiError(c), FALLBACK))).size).toBe(3)
  })

  it("ข้อความอังกฤษเดิมของ backend แต่ไม่มี code → fallback (ไม่เทียบข้อความแล้ว)", () => {
    expect(returnErrorMessage(apiError(null, "The return window for this order has expired"), FALLBACK)).toBe(FALLBACK)
  })

  it("401 → ให้เข้าสู่ระบบใหม่, error อื่น → fallback (ไม่ส่งข้อความอังกฤษของ Medusa)", () => {
    expect(returnErrorMessage(apiError(null, "Unauthorized", 401), FALLBACK)).toBe("กรุณาเข้าสู่ระบบอีกครั้ง")
    expect(returnErrorMessage(apiError("OTHER", "Something else"), FALLBACK)).toBe(FALLBACK)
  })
})

// CORE-71 (spec 01 กฎข้อ 129, AC-170): backend (CORE-55) ปฏิเสธเมื่อ location ของ return option ไม่มี inventory level
// → ลองใหม่ไม่ช่วย ต้องบอกให้ติดต่อร้าน; error อื่นไม่เข้ากรณีนี้ — CORE-83: ตัดสินจาก code
describe("isReturnNotStockedError", () => {
  const apiError = (code: string | null, status = 400) =>
    new MedusaApiError({ status, type: "invalid_data", code, message: "x" })

  it("400 + RETURN_ITEM_NOT_STOCKED → true", () => {
    expect(isReturnNotStockedError(apiError("RETURN_ITEM_NOT_STOCKED"))).toBe(true)
  })

  it("CORE-76 (กฎข้อ 134b): 400 + RETURN_NO_LOCATION → true", () => {
    expect(isReturnNotStockedError(apiError("RETURN_NO_LOCATION"))).toBe(true)
    expect(isReturnNotStockedError(apiError("RETURN_NO_LOCATION", 500))).toBe(false)
  })

  it("error อื่น (code อื่น, ไม่มี code แม้ข้อความเดิม, 401, ไม่ใช่ object) → false", () => {
    expect(isReturnNotStockedError(apiError("RETURN_WINDOW_EXPIRED"))).toBe(false)
    expect(isReturnNotStockedError(apiError(null, 401))).toBe(false)
    expect(
      isReturnNotStockedError(
        new MedusaApiError({ status: 400, type: "invalid_data", message: "This item cannot be returned online" })
      )
    ).toBe(false)
    expect(isReturnNotStockedError(apiError("RETURN_ITEM_NOT_STOCKED", 500))).toBe(false)
    expect(isReturnNotStockedError(null)).toBe(false)
    expect(isReturnNotStockedError("RETURN_ITEM_NOT_STOCKED")).toBe(false)
  })

  it("ข้อความที่ลูกค้าเห็นเป็นไทยและบอกให้ติดต่อร้าน ไม่บอกให้ลองใหม่", () => {
    expect(RETURN_NOT_STOCKED.text).toBe("ไม่สามารถสร้างคำขอคืนสินค้านี้ทางเว็บได้ กรุณาติดต่อร้าน")
    expect(RETURN_NOT_STOCKED.text).not.toContain("ลองใหม่")
  })
})

// spec 01 กฎข้อ 30 (CORE-16): body ที่ storefront ส่งไป POST /store/returns ต้องไม่มี return_shipping.price, receive_now, location_id
describe("buildReturnRequest", () => {
  it("มีเฉพาะ order_id, items และ return_shipping.option_id — ตัด line ที่จำนวน 0 และเหตุผลว่าง", () => {
    const body = buildReturnRequest({
      orderId: "order_1",
      optionId: "so_return",
      lines: [
        { id: "a", quantity: 2, reasonId: "rr_1" },
        { id: "b", quantity: 0, reasonId: "rr_1" },
        { id: "c", quantity: 1, reasonId: "" },
      ],
    })
    expect(body).toEqual({
      order_id: "order_1",
      items: [
        { id: "a", quantity: 2, reason_id: "rr_1" },
        { id: "c", quantity: 1 },
      ],
      return_shipping: { option_id: "so_return" },
    })
    expect(Object.keys(body).sort()).toEqual(["items", "order_id", "return_shipping"])
    expect(Object.keys(body.return_shipping)).toEqual(["option_id"])
  })
})
