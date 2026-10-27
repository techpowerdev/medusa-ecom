"use server"

import { sdk } from "@lib/config"
import { friendlyErrorMessage } from "@lib/util/error-message"
import { buildReturnRequest, canRequestReturn, returnableItems } from "@lib/util/return-request"
import { getRegionPolicies } from "@lib/util/store-policies"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { getAuthHeaders, getCacheTag } from "./cookies"
import { retrieveOrder } from "./orders"

// spec 01 CORE-20 (AC-65): ลูกค้าขอคืนสินค้าผ่าน route ของ Medusa — เหตุผลจาก GET /store/return-reasons,
// return option จาก GET /store/shipping-options?is_return=true (cart ของ order; core กรอง enabled_in_store ให้)
// แล้ว POST /store/returns (backend ตรวจ option/ownership/ฟิลด์ต้องห้ามตาม CORE-13/16/17)

/**
 * return_window_days ของ region ของ order — ไม่ cache (QA #112 D1: admin แก้ metadata ของ region แล้ว storefront
 * ไม่ถูก revalidate) และใช้ `order.region_id` ไม่ใช่ countryCode ใน URL (review #112) — ไม่มีค่า = null (ไม่แสดงปุ่ม)
 */
export const retrieveReturnWindowDays = async (regionId: string | null | undefined) => {
  if (!regionId) return null
  return sdk.client
    .fetch<HttpTypes.StoreRegionResponse>(`/store/regions/${regionId}`, {
      method: "GET",
      cache: "no-store",
    })
    .then(({ region }) => getRegionPolicies(region)?.returnWindowDays ?? null)
    .catch(() => null)
}

/** order นี้ขอคืนได้ตอนนี้หรือไม่ (ใช้ทั้งปุ่ม, หน้า return และ server action — กติกาเดียวกัน) */
export const isOrderReturnable = async (order: HttpTypes.StoreOrder) =>
  canRequestReturn(order, await retrieveReturnWindowDays(order.region_id))

export const listReturnReasons = async (): Promise<HttpTypes.StoreReturnReason[]> =>
  sdk.client
    .fetch<HttpTypes.StoreReturnReasonListResponse>("/store/return-reasons", {
      method: "GET",
      query: { limit: 100, fields: "id,value,label" },
      headers: { ...(await getAuthHeaders()) },
      cache: "no-store",
    })
    .then(({ return_reasons }) => return_reasons)
    .catch(() => [])

const retrieveReturnOptionId = async (cartId: string | undefined) => {
  if (!cartId) return null
  return sdk.client
    .fetch<HttpTypes.StoreShippingOptionListResponse>("/store/shipping-options", {
      method: "GET",
      query: { cart_id: cartId, is_return: "true", fields: "id" },
      headers: { ...(await getAuthHeaders()) },
      cache: "no-store",
    })
    .then(({ shipping_options }) => shipping_options[0]?.id ?? null)
    .catch(() => null)
}

export type ReturnRequestState = { success: boolean; error: string | null }

export async function requestReturn(
  _state: ReturnRequestState,
  formData: FormData
): Promise<ReturnRequestState> {
  const orderId = String(formData.get("order_id") ?? "")
  const order = await retrieveOrder(orderId).catch(() => null)
  if (!order) {
    return { success: false, error: "ไม่พบคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง" }
  }
  // review #112 nit 2: ตรวจกติกาเดียวกับ UI ซ้ำ (เลยหน้าต่าง N วัน / ยังไม่ส่ง / ไม่มี line ที่คืนได้)
  if (!(await isOrderReturnable(order))) {
    return { success: false, error: "คำสั่งซื้อนี้ไม่สามารถขอคืนสินค้าได้แล้ว" }
  }

  const lines = returnableItems(order.items).map(({ item }) => ({
    id: item.id,
    quantity: Number(formData.get(`quantity:${item.id}`) ?? 0) || 0,
    reasonId: String(formData.get(`reason:${item.id}`) ?? ""),
  }))
  if (!lines.some((line) => line.quantity > 0)) {
    return { success: false, error: "กรุณาเลือกจำนวนสินค้าที่ต้องการคืนอย่างน้อย 1 ชิ้น" }
  }

  const optionId = await retrieveReturnOptionId(
    (order as HttpTypes.StoreOrder & { cart?: { id?: string } }).cart?.id
  )
  if (!optionId) {
    return { success: false, error: "ขณะนี้ยังขอคืนสินค้าออนไลน์ไม่ได้ กรุณาติดต่อร้าน" }
  }

  try {
    await sdk.client.fetch("/store/returns", {
      method: "POST",
      body: buildReturnRequest({ orderId, optionId, lines }),
      headers: { ...(await getAuthHeaders()) },
    })
  } catch (error) {
    return {
      success: false,
      error: friendlyErrorMessage(error, "ส่งคำขอคืนสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"),
    }
  }

  revalidateTag(await getCacheTag("orders"), { expire: 0 })
  return { success: true, error: null }
}
