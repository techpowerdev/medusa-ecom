import { describe, expect, it } from "vitest"

import {
  buildReturnRequest,
  canRequestReturn,
  receivedAt,
  returnableItems,
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
  it("จำนวนที่คืนได้ = fulfilled − (requested + received + dismissed) แบบเดียวกับ Medusa", () => {
    const items = [
      item("a", { fulfilled_quantity: 3, return_requested_quantity: 1 }),
      item("b", { fulfilled_quantity: 2, return_received_quantity: 1, return_dismissed_quantity: 1 }),
      item("c", { fulfilled_quantity: 0 }),
    ]
    expect(returnableItems(items).map((r) => [r.item.id, r.quantity])).toEqual([["a", 2]])
  })

  it("ซ่อน line ที่ไม่ต้องจัดส่ง (e-voucher) หรือไม่ทราบค่า requires_shipping", () => {
    const items = [
      item("voucher", { fulfilled_quantity: 1 }, false),
      item("unknown", { fulfilled_quantity: 1 }, null),
      item("shirt", { fulfilled_quantity: 1 }),
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
  const order = (fulfillments: object[], items = [item("a", { fulfilled_quantity: 1 })]) => ({
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
    const voucherOnly = order([{ shipped_at: daysAgo(1) }], [item("v", { fulfilled_quantity: 1 }, false)])
    expect(canRequestReturn(voucherOnly, 30, NOW)).toBe(false)
  })

  it("ไม่ทราบ return_window_days (region ไม่ได้ตั้ง metadata) → ไม่ได้ ไม่เดา", () => {
    expect(canRequestReturn(order([{ delivered_at: daysAgo(1) }]), null, NOW)).toBe(false)
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
