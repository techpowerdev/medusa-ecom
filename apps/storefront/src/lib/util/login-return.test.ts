import { describe, expect, it } from "vitest"

import { RETURN_TO_PARAM, isBuyReturnPath, loginPathForReturn, readReturnTo } from "./login-return"

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

// CORE-30 (spec 01 กฎข้อ 87, AC-123): ไม่ login กด join/สร้างทีม → login แล้วกลับหน้ากลุ่ม/หน้าแรก (path ภายในเท่านั้น)
describe("readReturnTo — group page and home (CORE-30)", () => {
  it("returns the group page path and the country home path", () => {
    for (const value of ["/th/g/abc_D-1", "/th", "/buy/variant_01:2"]) {
      expect(readReturnTo(form({ [RETURN_TO_PARAM]: value })), value).toBe(value)
    }
  })

  it("returns null for anything else (no open redirect; query is rejected on the new paths)", () => {
    for (const value of [
      "https://evil.example/th",
      "//evil.example",
      "/th/g/../account",
      "/th/g/a/b",
      "/th/account",
      "/th/g/abc?x=1",
      "/th?x=1",
      "\\evil",
      "/th/g/",
      "/th/g/abc%2F..",
      "/TH/g/abc",
      "/th/",
    ]) {
      expect(readReturnTo(form({ [RETURN_TO_PARAM]: value })), value).toBeNull()
    }
  })
})

// CORE-39 (spec 01 กฎข้อ 97, AC-133): เคสที่ qa #258 ลองมือ + จำกัดความยาว token ของหน้ากลุ่ม (join_token จริงยาว 12 ตัว)
describe("readReturnTo — hardening (CORE-39)", () => {
  it("returns null for backslash, encoded slashes, trailing newline and a 65-char token", () => {
    for (const value of ["/\\evil", "/%2F%2Fevil", "/th/g/abc\n", `/th/g/${"a".repeat(65)}`]) {
      expect(readReturnTo(form({ [RETURN_TO_PARAM]: value })), JSON.stringify(value)).toBeNull()
    }
  })

  it("returns a group page path with a 64-char token unchanged", () => {
    const value = `/th/g/${"A".repeat(63)}1`
    expect(readReturnTo(form({ [RETURN_TO_PARAM]: value }))).toBe(value)
  })
})

describe("isBuyReturnPath", () => {
  it("is true only for /buy/ return paths", () => {
    expect(isBuyReturnPath("/buy/v1:1?x=1")).toBe(true)
    expect(isBuyReturnPath("/th/g/abc")).toBe(false)
    expect(isBuyReturnPath("/th")).toBe(false)
  })
})
