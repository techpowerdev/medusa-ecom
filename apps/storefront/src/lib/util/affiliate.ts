// AF-2 (spec 05): landing `/r/<code>?to=` และ cart hook — storefront ไม่สร้าง token เอง เพียงคัดลอกค่า
// cookie `aff` ที่ backend (`GET /store/affiliate/r/:code`) ลงชื่อไว้
export const AFFILIATE_COOKIE = "aff"
// สูงสุด 30 วัน; attribution window ของโปรแกรมเป็นตัวตัดสินจริงตอน order.placed (AF-3)
export const AFFILIATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

/** `?to=` ต้องเป็น path ภายในร้าน (กัน open redirect) — ไม่ผ่าน → "/" */
export function safeRedirectPath(to: string | null | undefined): string {
  if (!to || !to.startsWith("/") || to.startsWith("//")) {
    return "/"
  }
  if (/[\\\u0000-\u001f\u007f]/.test(to)) {
    return "/"
  }
  return to
}

export function affiliateLandingPath(countryCode: string, to: string): string {
  return to === "/" ? `/${countryCode}` : `/${countryCode}${to}`
}

/** ค่า cookie `aff` จาก header Set-Cookie ของ backend (null = backend ไม่ตั้ง เช่น code ไม่ active) */
export function affiliateCookieFromSetCookie(setCookies: string[]): string | null {
  const prefix = `${AFFILIATE_COOKIE}=`
  const cookie = setCookies.find((c) => c.startsWith(prefix))
  const value = cookie?.split(";")[0].slice(prefix.length)
  return value ? decodeURIComponent(value) : null
}

/** metadata ใหม่ของ cart เมื่อ token ใน cookie ต่างจากที่บันทึกไว้ (last click wins) — null = ไม่ต้องอัปเดต */
export function affiliateMetadataUpdate(
  metadata: Record<string, unknown> | null | undefined,
  token: string | undefined
): Record<string, unknown> | null {
  if (!token || metadata?.affiliate_token === token) {
    return null
  }
  return { ...metadata, affiliate_token: token }
}
