import { describe, expect, it } from "vitest"

import { DIGITAL_DELIVERY_TYPE_CODE, shippingOptionsForCart } from "./shipping-options"

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
