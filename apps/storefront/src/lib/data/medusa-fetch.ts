import "server-only"

import { MEDUSA_BACKEND_URL, MEDUSA_PUBLISHABLE_KEY } from "@lib/config"
import { getLocaleHeader } from "@lib/util/get-locale-header"
import { MedusaApiError } from "@lib/util/medusa-api-error"
import { getAuthHeaders } from "./cookies"

/**
 * CORE-82 (spec 01 กฎข้อ 140, ADR-028): POST ไป Store API ด้วย `fetch` ตรง — ใช้เฉพาะ mutation ที่ตัดสินจาก `code` ของ error
 * (`FetchError` ของ js-sdk 2.22.1 อ่าน body แล้วทิ้ง code/type); header + credentials เท่ากับ `sdk.client.fetch`
 * (unit `core-82-medusa-fetch.test.ts` เทียบกับ SDK จริง); non-2xx → `MedusaApiError`, network error throw ตามเดิม (แบบ SDK)
 * ไม่ตั้ง `cache`: POST ไม่ถูก cache และ `no-store` ใน action ทำให้ cart ที่ render หลัง action ค้างค่าเดิม (CORE-4i-b)
 * เมื่อ `FetchError` เก็บ code/type แล้ว (issue upstream) ย้ายกลับไปใช้ SDK และลบไฟล์นี้ (เช็กลิสต์ bump ของ spec 07)
 */
export async function medusaFetch<T>(path: string, body?: object): Promise<T> {
  let locale: string | null = null
  try {
    locale = (await getLocaleHeader())["x-medusa-locale"]
  } catch {}

  const res = await fetch(`${MEDUSA_BACKEND_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(MEDUSA_PUBLISHABLE_KEY ? { "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY } : {}),
      ...(locale ? { "x-medusa-locale": locale } : {}),
      ...(await getAuthHeaders()),
    },
    credentials: "omit",
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (res.ok) {
    return (await res.json()) as T
  }
  const error = (await res.json().catch(() => ({}))) as { type?: unknown; code?: unknown; message?: unknown }
  throw new MedusaApiError({
    status: res.status,
    type: typeof error.type === "string" ? error.type : null,
    code: typeof error.code === "string" ? error.code : null,
    message: typeof error.message === "string" ? error.message : res.statusText,
  })
}
