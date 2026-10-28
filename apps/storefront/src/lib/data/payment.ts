"use server"

import { MEDUSA_BACKEND_URL, sdk } from "@lib/config"
import { paymentSessionData } from "@lib/util/payment-session"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { HttpTypes } from "@medusajs/types"

export const listCartPaymentMethods = async (regionId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
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
 * คืน `status` (0 = network error) + `code` แทนการ throw — FetchError ของ js-sdk เก็บแค่ message และ error ของ server action
 * ถูกซ่อนข้อความใน production จึงอ่าน `code` ของ 409 ไม่ได้ (เหตุผลที่ใช้ fetch ตรงแทน sdk)
 */
export async function createPaymentSession(
  collectionId: string,
  providerId: string
): Promise<{ status: number; code: string | null }> {
  const res = await fetch(`${MEDUSA_BACKEND_URL}/store/payment-collections/${collectionId}/payment-sessions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "",
      ...(await getAuthHeaders()),
    },
    // กฎข้อ 5: provider บัตรขอ PaymentIntent แบบ card เท่านั้น
    body: JSON.stringify({ provider_id: providerId, data: paymentSessionData(providerId) }),
    cache: "no-store",
  }).catch(() => null)
  if (!res) return { status: 0, code: null }
  const body = res.ok ? null : await res.json().catch(() => null)
  const code = typeof body?.code === "string" ? body.code : null
  return { status: res.status, code }
}
