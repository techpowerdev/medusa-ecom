"use server"

import { sdk } from "@lib/config"
import type { PortalTab } from "@lib/util/affiliate-portal"
import { cookies as nextCookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

// AF-8a (spec 05 กฎ 17): portal เรียก `/affiliate/*` จาก server side ของ Next เท่านั้น
// token ของ actor `affiliate` อยู่ใน httpOnly cookie แยกจาก `_medusa_jwt` ของ customer (session แยกกัน)
const AFFILIATE_JWT = "_affiliate_jwt"

export type PortalAffiliate = {
  id: string
  email: string
  name: string
  code: string
  status: "pending" | "active" | "suspended"
  /** AF-13 กฎ 34: มีข้อมูลรับเงินหรือไม่ (portal ไม่เห็น payout_info ดิบ) */
  has_payout_info: boolean
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

export type PortalProgram = {
  id: string
  name: string
  starts_at: string
  ends_at: string
  announce_text: string | null
  commission_value: number
  state: "active" | "upcoming"
}

export type PortalPayout = {
  id: string
  amount: number
  currency: string
  period_from: string
  period_to: string
  status: "draft" | "paid"
  paid_at: string | null
}

export type PortalEarningsTotal = { currency: string; status: string; amount: number; count: number }

type PortalList = { count: number; limit: number; offset: number }

export type AffiliateAuthState = { error: string } | null

const statusOf = (error: unknown) => (error as { status?: unknown } | null)?.status

const authHeaders = async (): Promise<{ authorization: string } | null> => {
  const token = (await nextCookies()).get(AFFILIATE_JWT)?.value
  return token ? { authorization: `Bearer ${token}` } : null
}

const portalFetch = <T>(path: string, headers: { authorization: string }, query?: Record<string, unknown>) =>
  sdk.client.fetch<T>(path, { headers, query, cache: "no-store" })

// AF-8b: layout และหน้าของ portal เรียกใน render เดียวกัน — cache ต่อ request ยิง `/affiliate/me` ครั้งเดียว
const fetchMe = cache(async (authorization: string): Promise<PortalAffiliate | null> => {
  try {
    return (await portalFetch<{ affiliate: PortalAffiliate }>("/affiliate/me", { authorization })).affiliate
  } catch (error) {
    if (statusOf(error) === 401) {
      return null
    }
    throw error
  }
})

/** affiliate ของ session ปัจจุบัน — ไม่มี/หมดอายุ (401) → null */
export async function getAffiliate(): Promise<PortalAffiliate | null> {
  const headers = await authHeaders()
  return headers ? fetchMe(headers.authorization) : null
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

/** AF-8b: route ของ portal ที่ API ตอบ 403 ตามสถานะ (Q6) → null ให้หน้าแสดง `affiliate-status-notice` */
const portalGet = async <T>(path: string, query?: Record<string, unknown>): Promise<T | null> => {
  const headers = await authHeaders()
  if (!headers) {
    return null
  }
  try {
    return await portalFetch<T>(path, headers, query)
  } catch (error) {
    if (statusOf(error) === 403) {
      return null
    }
    throw error
  }
}

const PAGE_SIZE = 50

/** `GET /affiliate/me/programs` — โปรแกรม published ที่ active/upcoming (เฉพาะ affiliate `active`) */
export async function listAffiliatePrograms(page: number) {
  return portalGet<PortalList & { programs: PortalProgram[] }>("/affiliate/me/programs", {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })
}

/** `GET /affiliate/me/earnings` — ยอดรวมต่อ currency/status (คำนวณที่ API) */
export async function getAffiliateEarnings() {
  return portalGet<{ totals: PortalEarningsTotal[] }>("/affiliate/me/earnings")
}

/** `GET /affiliate/me/payouts` — payout ของตัวเอง ใหม่สุดก่อน (ไม่มี reference) */
export async function listAffiliatePayouts(page: number) {
  return portalGet<PortalList & { payouts: PortalPayout[] }>("/affiliate/me/payouts", {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })
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
