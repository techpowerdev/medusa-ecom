"use server"

import { sdk } from "@lib/config"
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
