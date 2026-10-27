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
          ",+items.requires_shipping,*fulfillments,+cart.id",
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
    .then(({ orders }) => orders)
    .catch((err) => medusaError(err))
}
