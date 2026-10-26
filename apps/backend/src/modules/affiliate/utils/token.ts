import crypto from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"

// spec 05 "Cart hook": token = `<affiliate_id>.<clicked_at ms>.<HMAC-SHA256(affiliate_id|clicked_at) base64url>`
// storefront เพียงคัดลอกค่านี้ลง cart metadata.affiliate_token — ตรวจลายเซ็นตอน order.placed (AF-3)
export type AffiliateTokenPayload = { affiliate_id: string; clicked_at: Date }

const hmac = (affiliateId: string, clickedAtMs: number, secret: string) =>
  crypto.createHmac("sha256", secret).update(`${affiliateId}|${clickedAtMs}`).digest("base64url")

export function signAffiliateToken(affiliateId: string, clickedAt: Date, secret: string): string {
  if (!secret) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "affiliate token secret is not configured")
  }
  const ms = clickedAt.getTime()
  return `${affiliateId}.${ms}.${hmac(affiliateId, ms, secret)}`
}

export function verifyAffiliateToken(token: unknown, secret: string): AffiliateTokenPayload | null {
  if (!secret || typeof token !== "string") {
    return null
  }
  const parts = token.split(".")
  if (parts.length !== 3) {
    return null
  }
  const [affiliateId, ts, signature] = parts
  if (!affiliateId || !/^\d+$/.test(ts)) {
    return null
  }
  const expected = Buffer.from(hmac(affiliateId, Number(ts), secret))
  const actual = Buffer.from(signature)
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return null
  }
  return { affiliate_id: affiliateId, clicked_at: new Date(Number(ts)) }
}
