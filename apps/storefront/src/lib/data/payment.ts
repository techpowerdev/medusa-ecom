"use server"

import { sdk } from "@lib/config"
import { MedusaApiError } from "@lib/util/medusa-api-error"
import { paymentSessionData } from "@lib/util/payment-session"
import { OrderPaySessionResult, orderPaySessionResult } from "@lib/util/order-pay"
import { CATALOG_REVALIDATE_SECONDS } from "@lib/util/catalog-cache"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { medusaFetch } from "./medusa-fetch"
import { HttpTypes } from "@medusajs/types"

export const listCartPaymentMethods = async (regionId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    revalidate: CATALOG_REVALIDATE_SECONDS,
    ...(await getCacheOptions("payment_providers")),
  }

  return sdk.client
    .fetch<HttpTypes.StorePaymentProviderListResponse>(
      `/store/payment-providers`,
      {
        method: "GET",
        query: { region_id: regionId },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ payment_providers }) =>
      payment_providers.sort((a, b) => {
        return a.id > b.id ? 1 : -1
      })
    )
    .catch(() => {
      return null
    })
}

/**
 * PAY-6b/PAY-3b (spec 06 กฎข้อ 7A, 9): สร้าง session ด้วย `POST /store/payment-collections/:id/payment-sessions` ของ Medusa
 * คืน `status` (0 = network error) + `code` แทนการ throw — error ของ server action ถูกซ่อนข้อความใน production
 * CORE-82 (spec 01 กฎข้อ 140, ADR-028): ผ่าน `medusaFetch` (FetchError ของ js-sdk ไม่เก็บ `code` ของ 409)
 */
export async function createPaymentSession(
  collectionId: string,
  providerId: string
): Promise<{ status: number; code: string | null }> {
  try {
    // กฎข้อ 5: provider บัตรขอ PaymentIntent แบบ card เท่านั้น
    await medusaFetch(`/store/payment-collections/${collectionId}/payment-sessions`, {
      provider_id: providerId,
      data: paymentSessionData(providerId),
    })
    return { status: 200, code: null }
  } catch (error) {
    return error instanceof MedusaApiError ? { status: error.status, code: error.code } : { status: 0, code: null }
  }
}

/**
 * CORE-4i-b (spec 01 กฎข้อ 72, Q-C2 = (ก)): action ที่หน้า `/account/orders/:id/pay` เรียก — ผลของ `createPaymentSession`
 * ผ่าน helper กลาง รูปแบบเดียวกับ `initiatePaymentSession` ของ checkout (`{ ok: true } | { error }`)
 */
export async function startPaymentSession(collectionId: string, providerId: string): Promise<OrderPaySessionResult> {
  // GB-22 (spec 04 กฎข้อ 45a): + 400 `GB_PAYMENT_CLOSED` ของ guard GB-20
  return orderPaySessionResult(await createPaymentSession(collectionId, providerId))
}
