import { describe, expect, it } from "vitest"

import {
  MAX_LINE_ITEM_QUANTITY,
  PENDING_ADD_PARAM,
  PENDING_ERROR_PARAM,
  PENDING_QUANTITY_PARAM,
  clampLineItemQuantity,
  loginPathForAddToCart,
  readPendingAddToCart,
  readPendingAddQuery,
} from "./pending-add-to-cart"

// CORE-6 (spec 01 AC-6): guest กด "Add to cart" → ไปหน้า login พร้อม variant ที่ค้างไว้ → ล็อกอินแล้วเพิ่มลง cart
const form = (entries: Record<string, string>) => {
  const data = new FormData()
  Object.entries(entries).forEach(([k, v]) => data.set(k, v))
  return data
}

describe("loginPathForAddToCart", () => {
  it("points to the account (login) page of the country with the pending variant", () => {
    expect(loginPathForAddToCart("th", "variant_01")).toBe(
      `/th/account?${PENDING_ADD_PARAM}=variant_01`
    )
  })

  it("encodes the variant id", () => {
    expect(loginPathForAddToCart("th", "a&b=c")).toBe(
      `/th/account?${PENDING_ADD_PARAM}=a%26b%3Dc`
    )
  })
})

describe("readPendingAddToCart", () => {
  it("returns the pending variant and country from the login form", () => {
    expect(
      readPendingAddToCart(
        form({ [PENDING_ADD_PARAM]: "variant_01", country_code: "th" })
      )
    ).toEqual({ variantId: "variant_01", countryCode: "th", quantity: 1 })
  })

  it("returns null when nothing is pending", () => {
    expect(readPendingAddToCart(form({ country_code: "th" }))).toBeNull()
    expect(
      readPendingAddToCart(form({ [PENDING_ADD_PARAM]: "", country_code: "th" }))
    ).toBeNull()
  })

  it("returns null for a missing or malformed country code", () => {
    expect(
      readPendingAddToCart(form({ [PENDING_ADD_PARAM]: "variant_01" }))
    ).toBeNull()
    expect(
      readPendingAddToCart(
        form({ [PENDING_ADD_PARAM]: "variant_01", country_code: "../x" })
      )
    ).toBeNull()
  })
})

// CORE-14b (กฎ 26, AC-44): คง quantity ที่ผู้ใช้เลือกไว้ข้าม login
describe("clampLineItemQuantity", () => {
  it.each([
    [undefined, 1],
    [null, 1],
    ["", 1],
    ["abc", 1],
    ["0", 1],
    ["-2", 1],
    ["3", 3],
    [String(MAX_LINE_ITEM_QUANTITY + 1), MAX_LINE_ITEM_QUANTITY],
  ])("%s → %s", (raw, expected) => {
    expect(clampLineItemQuantity(raw)).toBe(expected)
  })
})

describe("quantity ที่ค้างไว้ข้าม login (CORE-14b)", () => {
  it("loginPathForAddToCart ใส่ quantity เมื่อมากกว่า 1", () => {
    expect(loginPathForAddToCart("th", "variant_01", 3)).toBe(
      `/th/account?${PENDING_ADD_PARAM}=variant_01&${PENDING_QUANTITY_PARAM}=3`
    )
    expect(loginPathForAddToCart("th", "variant_01", 1)).toBe(
      `/th/account?${PENDING_ADD_PARAM}=variant_01`
    )
  })

  it("readPendingAddToCart อ่าน quantity จากฟอร์มและจำกัดช่วง", () => {
    const pending = (q: string) =>
      readPendingAddToCart(
        form({ [PENDING_ADD_PARAM]: "variant_01", country_code: "th", [PENDING_QUANTITY_PARAM]: q })
      )?.quantity
    expect(pending("3")).toBe(3)
    expect(pending("x")).toBe(1)
    expect(pending("100000")).toBe(MAX_LINE_ITEM_QUANTITY)
  })

  it("readPendingAddQuery อ่าน variant และ quantity จาก searchParams ของหน้า", () => {
    expect(
      readPendingAddQuery({ [PENDING_ADD_PARAM]: "variant_01", [PENDING_QUANTITY_PARAM]: "3" })
    ).toEqual({ variantId: "variant_01", quantity: 3, failed: false })
    expect(readPendingAddQuery({ [PENDING_ADD_PARAM]: "variant_01" })).toEqual({
      variantId: "variant_01",
      quantity: 1,
      failed: false,
    })
    expect(readPendingAddQuery({})).toBeNull()
    expect(readPendingAddQuery(undefined)).toBeNull()
    expect(readPendingAddQuery({ [PENDING_ADD_PARAM]: ["a", "b"] })).toBeNull()
  })
})

// CORE-14d (กฎ 57–58): เพิ่มไม่สำเร็จหลัง login → flag add_error ให้หน้าแสดง error และไม่พยายามเพิ่มซ้ำ
describe("add_error (CORE-14d)", () => {
  it("loginPathForAddToCart ใส่ add_error เมื่อเพิ่มไม่สำเร็จ", () => {
    expect(loginPathForAddToCart("th", "variant_01", 2, { failed: true })).toBe(
      `/th/account?${PENDING_ADD_PARAM}=variant_01&${PENDING_QUANTITY_PARAM}=2&${PENDING_ERROR_PARAM}=1`
    )
  })

  it("readPendingAddQuery อ่าน add_error", () => {
    expect(
      readPendingAddQuery({ [PENDING_ADD_PARAM]: "variant_01", [PENDING_ERROR_PARAM]: "1" })
    ).toEqual({ variantId: "variant_01", quantity: 1, failed: true })
  })
})
