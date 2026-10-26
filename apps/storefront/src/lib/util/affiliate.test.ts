import { describe, expect, it } from "vitest"

import {
  affiliateCookieFromSetCookie,
  affiliateLandingPath,
  affiliateMetadataUpdate,
  safeRedirectPath,
} from "./affiliate"

// AF-2 (spec 05): landing `/r/<code>?to=` + คัดลอก cookie `aff` ลง cart metadata.affiliate_token
describe("safeRedirectPath", () => {
  it("keeps internal paths", () => {
    expect(safeRedirectPath("/products/t-shirt?x=1")).toBe("/products/t-shirt?x=1")
  })

  it.each([null, undefined, "", "products/x", "https://evil.example", "//evil.example", "/\\evil.example", "/\t/x"])(
    "falls back to / for %p",
    (to) => {
      expect(safeRedirectPath(to)).toBe("/")
    }
  )
})

describe("affiliateLandingPath", () => {
  it("prefixes the country code", () => {
    expect(affiliateLandingPath("th", "/products/t-shirt")).toBe("/th/products/t-shirt")
    expect(affiliateLandingPath("th", "/")).toBe("/th")
  })
})

describe("affiliateCookieFromSetCookie", () => {
  it("returns the aff value from the backend Set-Cookie headers", () => {
    expect(
      affiliateCookieFromSetCookie([
        "connect.sid=abc; Path=/; HttpOnly",
        "aff=aff_01.1761.c2ln; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax",
      ])
    ).toBe("aff_01.1761.c2ln")
  })

  it("returns null when the backend set no aff cookie", () => {
    expect(affiliateCookieFromSetCookie([])).toBeNull()
    expect(affiliateCookieFromSetCookie(["affx=1; Path=/"])).toBeNull()
    expect(affiliateCookieFromSetCookie(["aff=; Path=/"])).toBeNull()
  })
})

describe("affiliateMetadataUpdate", () => {
  it("adds the token while keeping other metadata", () => {
    expect(affiliateMetadataUpdate({ gift: true }, "tok")).toEqual({
      gift: true,
      affiliate_token: "tok",
    })
    expect(affiliateMetadataUpdate(null, "tok")).toEqual({ affiliate_token: "tok" })
  })

  it("overwrites an older token (last click wins, rule 2)", () => {
    expect(affiliateMetadataUpdate({ affiliate_token: "old" }, "new")).toEqual({
      affiliate_token: "new",
    })
  })

  it("returns null when nothing changes", () => {
    expect(affiliateMetadataUpdate({ affiliate_token: "tok" }, "tok")).toBeNull()
    expect(affiliateMetadataUpdate({ affiliate_token: "tok" }, undefined)).toBeNull()
    expect(affiliateMetadataUpdate({}, "")).toBeNull()
  })
})
