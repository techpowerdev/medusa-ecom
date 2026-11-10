import { HttpTypes } from "@medusajs/types"
import { describe, expect, it } from "vitest"

import { canPurchaseVariant } from "./inventory"

// CORE-14b (กฎ 26, AC-45): add_variant ที่ไม่มีอยู่จริง/ขายไม่ได้ต้องแสดง error ไม่เงียบ
const variant = (v: Partial<HttpTypes.StoreProductVariant> & Record<string, unknown>) =>
  ({
    id: "variant_01",
    manage_inventory: true,
    allow_backorder: false,
    inventory_quantity: 5,
    calculated_price: { calculated_amount: 100 },
    ...v,
  }) as unknown as HttpTypes.StoreProductVariant

describe("canPurchaseVariant", () => {
  it("variant ไม่มีอยู่ → false", () => {
    expect(canPurchaseVariant(null, 1)).toBe(false)
  })

  it("ไม่มีราคาใน region → false", () => {
    expect(canPurchaseVariant(variant({ calculated_price: undefined }), 1)).toBe(false)
  })

  it("stock ไม่พอกับจำนวนที่ต้องการ → false", () => {
    expect(canPurchaseVariant(variant({ inventory_quantity: 2 }), 3)).toBe(false)
  })

  it("stock พอ, ไม่จัดการ inventory หรือรับ backorder → true", () => {
    expect(canPurchaseVariant(variant({}), 3)).toBe(true)
    expect(canPurchaseVariant(variant({ manage_inventory: false, inventory_quantity: 0 }), 3)).toBe(true)
    expect(canPurchaseVariant(variant({ allow_backorder: true, inventory_quantity: 0 }), 3)).toBe(true)
  })
})
