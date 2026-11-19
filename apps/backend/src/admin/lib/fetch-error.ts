import { FetchError } from "@medusajs/js-sdk"

/**
 * spec 08 กฎ 24b/25: query รายการล้มด้วย 401 (session หมด) → component `throw error` ให้ `ErrorBoundary` ของ dashboard
 * พาไป /login แทนการแสดง error ในตาราง — ใช้ร่วมกันทุกตารางที่ทำตามกฎ 24/25 (ADM-20, ADM-21a/21b)
 */
export const isUnauthorized = (error: unknown): error is FetchError =>
  error instanceof FetchError && error.status === 401
