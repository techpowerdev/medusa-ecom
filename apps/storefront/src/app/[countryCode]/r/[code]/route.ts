import {
  AFFILIATE_COOKIE,
  AFFILIATE_COOKIE_MAX_AGE,
  affiliateCookieFromSetCookie,
  affiliateLandingPath,
  safeRedirectPath,
} from "@lib/util/affiliate"
import { getRequestOrigin } from "@lib/util/site"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000"

// backend ช้า/ล่มต้องไม่ทำให้ลิงก์ที่แชร์ไปเปิดไม่ได้ — ข้าม cookie แล้วพาไปหน้าปลายทางต่อ
const BACKEND_TIMEOUT_MS = 3000

/**
 * ขอ token จาก `GET /store/affiliate/r/:code` (backend ลงชื่อด้วย secret ของตัวเอง)
 * ใช้ fetch ตรงแทน JS SDK เพราะ SDK โยน error เมื่อได้ 3xx และไม่เปิดให้อ่าน header Set-Cookie
 */
async function fetchAffiliateToken(code: string, to: string) {
  try {
    const url = new URL(
      `/store/affiliate/r/${encodeURIComponent(code)}`,
      BACKEND_URL
    )
    url.searchParams.set("to", to)
    const res = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      headers: {
        "x-publishable-api-key":
          process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "",
      },
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    })
    return affiliateCookieFromSetCookie(res.headers.getSetCookie())
  } catch {
    return null
  }
}

/** AF-2 (spec 05): landing สาธารณะ `/r/<code>?to=/products/<handle>` → ตั้ง cookie `aff` แล้ว redirect */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ countryCode: string; code: string }> }
) {
  const { countryCode, code } = await params
  const to = safeRedirectPath(request.nextUrl.searchParams.get("to"))
  const token = await fetchAffiliateToken(code, to)

  const response = NextResponse.redirect(
    `${getRequestOrigin(request)}${affiliateLandingPath(countryCode, to)}`,
    302
  )
  // ไม่มี token (code ไม่ active/ไม่พบ) → คง cookie เดิมไว้ (last click ของ affiliate ที่ใช้ได้)
  if (token) {
    response.cookies.set(AFFILIATE_COOKIE, token, {
      maxAge: AFFILIATE_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    })
  }
  return response
}
