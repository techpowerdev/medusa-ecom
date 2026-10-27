"use server"

import { sdk } from "@lib/config"
import { CustomerEvoucher } from "@lib/util/evoucher"
import medusaError from "@lib/util/medusa-error"
import { getAuthHeaders } from "./cookies"

/**
 * EV-7b (spec 02 กฎข้อ 22): บัตรกำนัลของลูกค้าที่ล็อกอิน — มี code/PIN จริง จึงไม่ cache ทั้งใน Next.js และ browser
 * (backend ตอบ `Cache-Control: private, no-store`)
 */
export const listCustomerEvouchers = async (limit = 100, offset = 0) =>
  sdk.client
    .fetch<{ evouchers: CustomerEvoucher[]; count: number }>(
      `/store/customers/me/evouchers`,
      {
        method: "GET",
        query: { limit, offset },
        headers: { ...(await getAuthHeaders()) },
        cache: "no-store",
      }
    )
    .catch((err) => medusaError(err))
