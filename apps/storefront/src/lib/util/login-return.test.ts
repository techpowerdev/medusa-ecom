import { describe, expect, it } from "vitest"

import { RETURN_TO_PARAM, loginPathForReturn, readReturnTo } from "./login-return"

// CORE-14 (spec 01 AC-41, กฎ 25): /buy/[items] ต้องล็อกอินก่อน → หน้า login พร้อม return URL กลับ /buy/...
const form = (entries: Record<string, string>) => {
  const data = new FormData()
  Object.entries(entries).forEach(([k, v]) => data.set(k, v))
  return data
}

describe("loginPathForReturn", () => {
  it("points to the account (login) page of the country with an encoded return path", () => {
    expect(loginPathForReturn("th", "/buy/variant_01:2?x=1")).toBe(
      `/th/account?${RETURN_TO_PARAM}=%2Fbuy%2Fvariant_01%3A2%3Fx%3D1`
    )
  })
})

describe("readReturnTo", () => {
  it("returns a /buy/ path from the login form", () => {
    expect(readReturnTo(form({ [RETURN_TO_PARAM]: "/buy/variant_01:2" }))).toBe(
      "/buy/variant_01:2"
    )
    expect(
      readReturnTo(form({ [RETURN_TO_PARAM]: "/buy/v1:1?context/address_country=th" }))
    ).toBe("/buy/v1:1?context/address_country=th")
  })

  it("returns null when missing or not a same-origin /buy/ path (no open redirect)", () => {
    for (const value of [
      "",
      "/th/account",
      "//evil.example/buy/x",
      "https://evil.example/buy/x",
      "/buy/../th/account",
      "/buy\\x",
      "/buy/",
    ]) {
      expect(readReturnTo(form({ [RETURN_TO_PARAM]: value })), value).toBeNull()
    }
    expect(readReturnTo(form({}))).toBeNull()
  })
})
