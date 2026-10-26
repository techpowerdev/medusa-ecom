import crypto from "node:crypto"
import { signAffiliateToken, verifyAffiliateToken } from "../token"

// AF-2 (spec 05 "Cart hook"): token = HMAC-SHA256 ของ `affiliate_id|clicked_at` ด้วย secret ฝั่ง server
const SECRET = "af2-unit-secret"
const CLICKED_AT = new Date("2026-10-20T08:30:00.000Z")

describe("affiliate click token (AF-2)", () => {
  it("round-trips affiliate_id and clicked_at", () => {
    const token = signAffiliateToken("aff_01ABC", CLICKED_AT, SECRET)

    expect(verifyAffiliateToken(token, SECRET)).toEqual({
      affiliate_id: "aff_01ABC",
      clicked_at: CLICKED_AT,
    })
  })

  it("signs `affiliate_id|clicked_at` with HMAC-SHA256", () => {
    const token = signAffiliateToken("aff_01ABC", CLICKED_AT, SECRET)
    const expected = crypto
      .createHmac("sha256", SECRET)
      .update(`aff_01ABC|${CLICKED_AT.getTime()}`)
      .digest("base64url")

    expect(token).toBe(`aff_01ABC.${CLICKED_AT.getTime()}.${expected}`)
  })

  it("rejects a token signed with another secret", () => {
    const token = signAffiliateToken("aff_01ABC", CLICKED_AT, "other-secret")

    expect(verifyAffiliateToken(token, SECRET)).toBeNull()
  })

  it("rejects a tampered affiliate id or clicked_at", () => {
    const [, ts, sig] = signAffiliateToken("aff_01ABC", CLICKED_AT, SECRET).split(".")

    expect(verifyAffiliateToken(`aff_01EVIL.${ts}.${sig}`, SECRET)).toBeNull()
    expect(verifyAffiliateToken(`aff_01ABC.${Number(ts) + 1}.${sig}`, SECRET)).toBeNull()
  })

  it.each([undefined, null, 42, "", "a.b", "a.b.c.d", "aff_1.notanumber.sig", "aff_1.1.%%%"])(
    "rejects malformed token %p",
    (token) => {
      expect(verifyAffiliateToken(token, SECRET)).toBeNull()
    }
  )

  it("never verifies with an empty secret and refuses to sign with one", () => {
    const token = signAffiliateToken("aff_01ABC", CLICKED_AT, SECRET)

    expect(verifyAffiliateToken(token, "")).toBeNull()
    expect(() => signAffiliateToken("aff_01ABC", CLICKED_AT, "")).toThrow()
  })
})
