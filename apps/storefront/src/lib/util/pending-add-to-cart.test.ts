import { describe, expect, it } from "vitest"

import {
  PENDING_ADD_PARAM,
  loginPathForAddToCart,
  readPendingAddToCart,
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
    ).toEqual({ variantId: "variant_01", countryCode: "th" })
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
