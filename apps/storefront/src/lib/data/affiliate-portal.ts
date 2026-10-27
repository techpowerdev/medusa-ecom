"use server"

import { sdk } from "@lib/config"
import type { PortalTab } from "@lib/util/affiliate-portal"
import { cookies as nextCookies } from "next/headers"
import { redirect } from "next/navigation"

// AF-8a (spec 05 กฎ 17): portal เรียก `/affiliate/*` จาก server side ของ Next เท่านั้น
// token ของ actor `affiliate` อยู่ใน httpOnly cookie แยกจาก `_medusa_jwt` ของ customer (session แยกกัน)
const AFFILIATE_JWT = "_affiliate_jwt"

export type PortalAffiliate = {
  id: string
  email: string
  name: string
  code: string
  status: "pending" | "active" | "suspended"
}

export type PortalProduct = {
  product: {
    id: string
    title: string
    handle: string
    thumbnail: string | null
    variants: {
      id: string
      calculated_price?: { calculated_amount?: number | null; currency_code?: string | null } | null
    }[]
  }
  program: { id: string; name: string; starts_at: string; ends_at: string; commission_value: number }
  rate_varies: boolean
  share_url: string
}

export type AffiliateAuthState = { error: string } | null

const statusOf = (error: unknown) => (error as { status?: unknown } | null)?.status

const authHeaders = async (): Promise<{ authorization: string } | null> => {
  const token = (await nextCookies()).get(AFFILIATE_JWT)?.value
  return token ? { authorization: `Bearer ${token}` } : null
}

const portalFetch = <T>(path: string, headers: { authorization: string }, query?: Record<string, unknown>) =>
  sdk.client.fetch<T>(path, { headers, query, cache: "no-store" })

/** affiliate ของ session ปัจจุบัน — ไม่มี/หมดอายุ (401) → null */
export async function getAffiliate(): Promise<PortalAffiliate | null> {
  const headers = await authHeaders()
  if (!headers) {
    return null
  }
  try {
    return (await portalFetch<{ affiliate: PortalAffiliate }>("/affiliate/me", headers)).affiliate
  } catch (error) {
    if (statusOf(error) === 401) {
      return null
    }
    throw error
  }
}

/** `GET /affiliate/products` — หนึ่งรายการต่อสินค้าตามกฎ 29 (dedupe/paging ทำที่ API) */
export async function listAffiliateProducts(status: PortalTab, page: number) {
  const headers = await authHeaders()
  if (!headers) {
    return null
  }
  return portalFetch<{ products: PortalProduct[]; count: number; page: number; limit: number }>(
    "/affiliate/products",
    headers,
    { status, page }
  )
}

const login = async (email: string, password: string) =>
  (
    await sdk.client.fetch<{ token: string }>("/auth/affiliate/emailpass", {
      method: "POST",
      body: { email, password },
    })
  ).token

const setSession = async (token: string) => {
  ;(await nextCookies()).set(AFFILIATE_JWT, token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

const portalPath = (formData: FormData) => `/${formData.get("countryCode")}/affiliate`

export async function affiliateLogin(_state: AffiliateAuthState, formData: FormData): Promise<AffiliateAuthState> {
  let token: string
  try {
    token = await login(String(formData.get("email")), String(formData.get("password")))
  } catch (error) {
    return {
      error: statusOf(error) === 401 ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    }
  }
  // Medusa คืน token ให้ identity ที่ยังไม่มี affiliate (เช่น customer อย่างเดียว; actor_id ว่าง) — ตรวจก่อนตั้ง session (review #135)
  try {
    await portalFetch("/affiliate/me", { authorization: `Bearer ${token}` })
  } catch (error) {
    return {
      error:
        statusOf(error) === 401
          ? "อีเมลนี้ยังไม่ได้สมัครแอฟฟิลิเอต กรุณาสมัครด้วยรหัสผ่านเดิม"
          : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    }
  }
  await setSession(token)
  redirect(portalPath(formData))
}

/**
 * สมัคร: identity emailpass (`/auth/affiliate/emailpass/register`) → `POST /affiliate/register` { name, code }
 * → login ใหม่เพื่อได้ token ที่มี actor_id; อีเมลที่มี identity อยู่แล้ว (เช่น เป็น customer) ใช้รหัสผ่านเดิม login แทน
 */
export async function affiliateRegister(_state: AffiliateAuthState, formData: FormData): Promise<AffiliateAuthState> {
  const email = String(formData.get("email"))
  const password = String(formData.get("password"))
  const failed = { error: "สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }

  let token: string
  try {
    token = (
      await sdk.client.fetch<{ token: string }>("/auth/affiliate/emailpass/register", {
        method: "POST",
        body: { email, password },
      })
    ).token
  } catch (error) {
    if (statusOf(error) !== 401) {
      return failed
    }
    try {
      token = await login(email, password)
    } catch {
      return { error: "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาใช้รหัสผ่านเดิม" }
    }
  }

  try {
    await sdk.client.fetch("/affiliate/register", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: { name: formData.get("name"), code: formData.get("code") },
    })
  } catch {
    return { error: "สมัครไม่สำเร็จ รหัสแนะนำนี้อาจถูกใช้แล้ว หรืออีเมลนี้สมัครแอฟฟิลิเอตไว้แล้ว" }
  }

  try {
    await setSession(await login(email, password))
  } catch {
    return failed
  }
  redirect(portalPath(formData))
}

export async function affiliateLogout(formData: FormData) {
  ;(await nextCookies()).delete(AFFILIATE_JWT)
  redirect(`${portalPath(formData)}/login`)
}
