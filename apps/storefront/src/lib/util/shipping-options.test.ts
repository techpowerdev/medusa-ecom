import { describe, expect, it } from "vitest"

import { DIGITAL_DELIVERY_TYPE_CODE, selectedShippingOptionId, shippingOptionsForCart } from "./shipping-options"

// CORE-32 (spec 01 กฎข้อ 89, AC-125): Store API 2.22.1 ไม่คืน shipping profile ของสินค้าใน line → ทาง (b)
// cart ที่มี line ต้องจัดส่ง ซ่อน option ที่ type.code = "digital-delivery" (spec 02 กฎข้อ 8 — ไม่ใช้ชื่อ)
const standard = { id: "so_standard", name: "Standard", shipping_profile_id: "sp_default", type: { code: "standard" } }
const digital = {
  id: "so_digital",
  name: "Digital delivery",
  shipping_profile_id: "sp_digital",
  type: { code: DIGITAL_DELIVERY_TYPE_CODE },
}
const physical = { requires_shipping: true }
const voucher = { requires_shipping: false }

describe("shippingOptionsForCart", () => {
  it("cart ที่มี line ต้องจัดส่ง (profile Default) → เหลือ Standard", () => {
    expect(shippingOptionsForCart([standard, digital], { items: [physical] })).toEqual([standard])
  })

  it("cart ผสม (สินค้าจัดส่ง + e-voucher) → ยังซ่อน Digital delivery", () => {
    expect(shippingOptionsForCart([digital, standard], { items: [voucher, physical] })).toEqual([standard])
  })

  it("ไม่มี option ที่ตรง → []", () => {
    expect(shippingOptionsForCart([digital], { items: [physical] })).toEqual([])
  })

  it("หา option ดิจิทัลด้วย type.code ไม่ใช่ชื่อ", () => {
    const renamed = { ...digital, name: "ส่งทางอีเมล" }
    const namedLikeDigital = { ...standard, name: "Digital delivery" }
    expect(shippingOptionsForCart([renamed, namedLikeDigital], { items: [physical] })).toEqual([namedLikeDigital])
  })

  it("cart ที่ทุก line ไม่ต้องจัดส่ง → ไม่กรอง (EV-7c ข้ามขั้น delivery เอง)", () => {
    expect(shippingOptionsForCart([standard, digital], { items: [voucher] })).toEqual([standard, digital])
  })

  it("option ที่ไม่มี type → ถือว่าไม่ใช่ Digital delivery", () => {
    const untyped = { id: "so_x", type: null }
    expect(shippingOptionsForCart([untyped, digital], { items: [physical] })).toEqual([untyped])
  })
})

// CORE-33 (spec 01 กฎข้อ 91b, AC-127): วิธีส่งที่ "เลือกแล้ว" = method ล่าสุดของ cart ที่อยู่ในรายการที่กรองแล้วเท่านั้น
describe("selectedShippingOptionId", () => {
  const listed = [standard]
  const method = (shipping_option_id: string) => ({ shipping_option_id })

  it("method ล่าสุดเป็น Standard ที่อยู่ในรายการ → id ของ Standard", () => {
    expect(selectedShippingOptionId({ shipping_methods: [method(standard.id)] }, listed)).toBe(standard.id)
  })

  it("method ล่าสุดเป็น Digital delivery ที่ไม่อยู่ในรายการ (ไม่มี method อื่นในรายการ) → null", () => {
    expect(selectedShippingOptionId({ shipping_methods: [method(digital.id)] }, listed)).toBeNull()
  })

  it("ไม่มี method → null", () => {
    expect(selectedShippingOptionId({ shipping_methods: [] }, listed)).toBeNull()
    expect(selectedShippingOptionId({ shipping_methods: null }, listed)).toBeNull()
    expect(selectedShippingOptionId({}, listed)).toBeNull()
  })

  it("รายการว่าง → null แม้ cart มี method", () => {
    expect(selectedShippingOptionId({ shipping_methods: [method(standard.id)] }, [])).toBeNull()
  })

  it("หลาย method → ตัวล่าสุดที่อยู่ในรายการ", () => {
    const express = { id: "so_express" }
    const cart = { shipping_methods: [method(standard.id), method(express.id), method(digital.id)] }
    expect(selectedShippingOptionId(cart, [standard, express])).toBe(express.id)
  })
})
