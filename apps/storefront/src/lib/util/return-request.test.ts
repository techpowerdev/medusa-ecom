import { describe, expect, it } from "vitest"

import {
  buildReturnRequest,
  canRequestReturn,
  DEFAULT_RETURN_WINDOW_DAYS,
  receivedAt,
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

describe("receivedAt", () => {
  it("ใช้ delivered_at ก่อน shipped_at และเลือก fulfillment ล่าสุด ไม่นับที่ยกเลิก", () => {
    const at = receivedAt([
      { shipped_at: daysAgo(10), delivered_at: daysAgo(8) },
      { shipped_at: daysAgo(5), delivered_at: null },
      { shipped_at: daysAgo(1), canceled_at: daysAgo(1) },
    ])
    expect(at?.toISOString()).toBe(daysAgo(5))
  })

  it("ยังไม่ส่ง (ไม่มีทั้ง delivered_at และ shipped_at) → null", () => {
    expect(receivedAt([{ shipped_at: null, delivered_at: null }])).toBeNull()
    expect(receivedAt(undefined)).toBeNull()
  })
})

describe("canRequestReturn", () => {
  const order = (fulfillments: object[], items = [item("a", { fulfilled_quantity: 1, shipped_quantity: 1 })]) => ({
    items,
    fulfillments,
  })

  it("ภายใน N วันนับจากวันที่ได้รับ → ได้ (รวมวันสุดท้ายพอดี)", () => {
    expect(canRequestReturn(order([{ delivered_at: daysAgo(29) }]), 30, NOW)).toBe(true)
    expect(canRequestReturn(order([{ delivered_at: daysAgo(30) }]), 30, NOW)).toBe(true)
  })

  it("เกิน N วัน → ไม่ได้", () => {
    expect(canRequestReturn(order([{ delivered_at: daysAgo(31) }]), 30, NOW)).toBe(false)
  })

  it("ไม่มี delivered_at ใช้ shipped_at", () => {
    expect(canRequestReturn(order([{ shipped_at: daysAgo(3) }]), 7, NOW)).toBe(true)
    expect(canRequestReturn(order([{ shipped_at: daysAgo(8) }]), 7, NOW)).toBe(false)
  })

  it("ยังไม่ fulfill / ยังไม่ส่ง → ไม่ได้", () => {
    expect(canRequestReturn(order([]), 30, NOW)).toBe(false)
    expect(canRequestReturn(order([{ shipped_at: null }]), 30, NOW)).toBe(false)
  })

  it("ไม่มี item ที่คืนได้ (เช่น มีแต่ e-voucher) → ไม่ได้", () => {
    const voucherOnly = order([{ shipped_at: daysAgo(1) }], [item("v", { fulfilled_quantity: 1, shipped_quantity: 1 }, false)])
    expect(canRequestReturn(voucherOnly, 30, NOW)).toBe(false)
  })

  it("อ่าน region ไม่ได้ (return_window_days = null) → ไม่ได้", () => {
    expect(canRequestReturn(order([{ delivered_at: daysAgo(1) }]), null, NOW)).toBe(false)
  })
})

// CORE-20c (กฎข้อ 60): หน้า return และ server action ใช้รายการเดียวกับปุ่ม — ตรวจช่วงคืนครั้งเดียว
describe("returnableItemsNow", () => {
  const items = [item("a", { fulfilled_quantity: 2, shipped_quantity: 2 })]

  it("ภายในช่วงคืน → line ที่คืนได้พร้อมจำนวน", () => {
    const lines = returnableItemsNow({ items, fulfillments: [{ shipped_at: daysAgo(1) }] }, 7, NOW)
    expect(lines.map((r) => [r.item.id, r.quantity])).toEqual([["a", 2]])
  })

  it("เลยช่วงคืน / ยังไม่ส่ง / ไม่ทราบช่วงคืน → ว่าง", () => {
    expect(returnableItemsNow({ items, fulfillments: [{ shipped_at: daysAgo(8) }] }, 7, NOW)).toEqual([])
    expect(returnableItemsNow({ items, fulfillments: [] }, 7, NOW)).toEqual([])
    expect(returnableItemsNow({ items, fulfillments: [{ shipped_at: daysAgo(1) }] }, null, NOW)).toEqual([])
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

// CORE-20c: error 400 ของ CORE-20b แปลเป็นข้อความไทย — FetchError ของ js-sdk เก็บแค่ message (ไม่มี code)
// จึงรับได้ทั้ง `code` และ message คงที่ของ backend (กฎข้อ 37)
describe("returnErrorMessage", () => {
  const fetchError = (message: string, status = 400) => Object.assign(new Error(message), { status })
  const FALLBACK = "ส่งคำขอไม่สำเร็จ"
  const THAI = /[\u0E00-\u0E7F]/

  it.each([
    ["RETURN_ITEM_NOT_SHIPPABLE", "Only shipped products of the order can be returned"],
    ["RETURN_ITEM_NOT_SHIPPED", "Items that have not been shipped cannot be returned"],
    ["RETURN_WINDOW_EXPIRED", "The return window for this order has expired"],
  ])("%s → ข้อความไทยเฉพาะกรณี", (code, message) => {
    const byMessage = returnErrorMessage(fetchError(message), FALLBACK)
    const byCode = returnErrorMessage(Object.assign(fetchError("x"), { code }), FALLBACK)
    expect(byMessage).toMatch(THAI)
    expect(byMessage).not.toBe(FALLBACK)
    expect(byMessage).not.toContain(message)
    expect(byCode).toBe(byMessage)
  })

  it("แต่ละ code ได้ข้อความต่างกัน", () => {
    const texts = [
      "Only shipped products of the order can be returned",
      "Items that have not been shipped cannot be returned",
      "The return window for this order has expired",
    ].map((m) => returnErrorMessage(fetchError(m), FALLBACK))
    expect(new Set(texts).size).toBe(3)
  })

  it("401 → ให้เข้าสู่ระบบใหม่, error อื่น → fallback (ไม่ส่งข้อความอังกฤษของ Medusa)", () => {
    expect(returnErrorMessage(fetchError("Unauthorized", 401), FALLBACK)).toBe("กรุณาเข้าสู่ระบบอีกครั้ง")
    expect(returnErrorMessage(fetchError("Something else"), FALLBACK)).toBe(FALLBACK)
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
