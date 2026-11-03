"use server"

import { sdk } from "@lib/config"
import { GENERIC_ERROR_MESSAGE, SIGN_IN_AGAIN_MESSAGE } from "@lib/util/error-message"
import {
  GROUP_BUY_MEMBERSHIPS_LIMIT,
  LEAVE_NOT_ALLOWED_MESSAGE,
  type GroupBuyMembership,
} from "@lib/util/group-buy-orders"
import medusaError from "@lib/util/medusa-error"
import type { GroupBuyOrder } from "@lib/util/order-pay"
import { getAuthHeaders } from "./cookies"

/**
 * PAY-3b (spec 06 กฎข้อ 9a): draft order ของกลุ่มผ่าน membership ของลูกค้า — route อ่านอย่างเดียวของ GB-8 (ADR-016)
 * ไม่ cache (สถานะการชำระเปลี่ยนจาก webhook); 404 (ไม่ใช่ของผู้เรียก/ไม่มี) → null
 */
export async function retrieveGroupBuyOrder(orderId: string): Promise<GroupBuyOrder | null> {
  return sdk.client
    .fetch<GroupBuyOrder>(`/store/customers/me/group-buy/orders/${orderId}`, {
      method: "GET",
      headers: await getAuthHeaders(),
      cache: "no-store",
    })
    .catch((err) => ((err as { status?: unknown }).status === 404 ? null : medusaError(err)))
}

/**
 * GB-7b: membership ทั้งหมดของลูกค้า (รวม cancelled) — route อ่านอย่างเดียวของ GB-8; ไม่ cache (สถานะเปลี่ยนจาก job/webhook)
 * อ่านล้ม → null (หน้า orders ยังแสดงคำสั่งซื้อปกติได้)
 */
export async function listGroupBuyMemberships(): Promise<{ memberships: GroupBuyMembership[]; count: number } | null> {
  return sdk.client
    .fetch<{ memberships: GroupBuyMembership[]; count: number }>(`/store/customers/me/group-buy/memberships`, {
      method: "GET",
      query: { limit: GROUP_BUY_MEMBERSHIPS_LIMIT },
      headers: await getAuthHeaders(),
      cache: "no-store",
    })
    .catch(() => null)
}

/**
 * GB-7b (spec 04 กฎข้อ 13): ออกจากกลุ่มทีละ membership — backend ตรวจเจ้าของ/สถานะ/เวลาเอง
 * 400 (cancelled แล้ว / กลุ่มไม่ open / หมดเวลา) → ข้อความไทยเฉพาะ; 401/403 → ให้เข้าสู่ระบบใหม่; อื่นๆ → ข้อความทั่วไป
 */
export async function leaveGroupBuyMembership(membershipId: string): Promise<{ error: string | null }> {
  return sdk.client
    .fetch(`/store/group-buy/memberships/${membershipId}/leave`, {
      method: "POST",
      headers: await getAuthHeaders(),
      cache: "no-store",
    })
    .then(() => ({ error: null }))
    .catch((err) => {
      const status = (err as { status?: unknown }).status
      if (status === 400) return { error: LEAVE_NOT_ALLOWED_MESSAGE }
      if (status === 401 || status === 403) return { error: SIGN_IN_AGAIN_MESSAGE }
      return { error: GENERIC_ERROR_MESSAGE }
    })
}
