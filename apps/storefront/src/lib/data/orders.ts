"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { getAuthHeaders } from "./cookies"
import { HttpTypes } from "@medusajs/types"

export const retrieveOrder = async (id: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  // CORE-20: ไม่ cache — fulfillment/การส่ง/return เปลี่ยนจากฝั่ง admin ซึ่งไม่ revalidate tag ของ storefront
  // (force-cache ของ starter ทำให้ปุ่มขอคืนสินค้าไม่ขึ้นหลัง admin ส่งของ และสถานะ order ค้างค่าเดิม)
  return sdk.client
    .fetch<HttpTypes.StoreOrderResponse>(`/store/orders/${id}`, {
      method: "GET",
      query: {
        fields:
          "*payment_collections.payments,*items,*items.metadata,*items.variant,*items.product" +
          // CORE-20: เงื่อนไขขอคืนสินค้า (requires_shipping, วันที่ส่ง/ได้รับ) และ cart ของ order สำหรับ return option
          ",+items.requires_shipping,*fulfillments,+cart.id" +
          // CORE-20d (กฎข้อ 66b): ช่วงคืนคิดต่อ line — ต้องรู้ว่า fulfillment ไหนมี line ใด
          ",+fulfillments.items.line_item_id",
      },
      headers,
      cache: "no-store",
    })
    .then(({ order }) => order)
    .catch((err) => medusaError(err))
}

export const listOrders = async (
  limit: number = 10,
  offset: number = 0,
  filters?: Record<string, unknown>
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  // CORE-20c (กฎข้อ 60): ไม่ cache แบบเดียวกับ retrieveOrder — สถานะ return/การส่งเปลี่ยนจากฝั่ง admin
  // CORE-68 (กฎข้อ 126): คืน count ของ Medusa ด้วย — หน้า /account/orders ใช้แบ่งหน้า
  return sdk.client
    .fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
      method: "GET",
      query: {
        limit,
        offset,
        order: "-created_at",
        fields: "*items,+items.metadata,*items.variant,*items.product",
        ...filters,
      },
      headers,
      cache: "no-store",
    })
    .then(({ orders, count }) => ({ orders, count }))
    .catch((err) => medusaError(err))
}

/**
 * PAY-12 (spec 06 กฎข้อ 14; qa #481 D-2): order ของลูกค้าที่สร้างจาก cart นี้ (field `cart.id` = link order_cart ของ Medusa)
 * — store API กรองด้วย cart ไม่ได้ จึงอ่าน order ล่าสุดของลูกค้า (order ที่เพิ่ง complete อยู่ต้นรายการ); ไม่พบ/ล้ม → null
 */
export const findOrderIdByCart = async (cartId: string): Promise<string | null> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<{ orders: { id: string; cart?: { id: string } | null }[] }>(`/store/orders`, {
      method: "GET",
      query: { limit: 10, order: "-created_at", fields: "id,cart.id" },
      headers,
      cache: "no-store",
    })
    .then(({ orders }) => orders.find((order) => order.cart?.id === cartId)?.id ?? null)
    .catch(() => null)
}
