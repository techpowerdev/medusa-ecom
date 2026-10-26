import "server-only"
import { sdk } from "@lib/config"
import { AFFILIATE_COOKIE, affiliateMetadataUpdate } from "@lib/util/affiliate"
import { HttpTypes } from "@medusajs/types"
import { cookies as nextCookies } from "next/headers"
import { getAuthHeaders } from "./cookies"

/**
 * AF-2 cart hook (spec 05): มี cookie `aff` → คัดลอกลง cart `metadata.affiliate_token` ผ่าน store API ของ Medusa
 * ด้วย token ของ customer เจ้าของ cart (CORE-6/CORE-12) — ไม่เคยสร้าง/แก้ token เอง
 * ล้มเหลวต้องไม่ทำให้การเพิ่มสินค้าล้ม (attribution เป็นผลพลอยได้ ไม่ใช่เงื่อนไขของการซื้อ)
 */
export async function syncCartAffiliateToken(
  cartId: string,
  headers: Awaited<ReturnType<typeof getAuthHeaders>>
) {
  const token = (await nextCookies()).get(AFFILIATE_COOKIE)?.value
  if (!token || !("authorization" in headers)) {
    return
  }

  try {
    const { cart } = await sdk.client.fetch<HttpTypes.StoreCartResponse>(
      `/store/carts/${cartId}`,
      { query: { fields: "id,metadata" }, headers, cache: "no-store" }
    )
    const metadata = affiliateMetadataUpdate(cart.metadata, token)
    if (metadata) {
      await sdk.store.cart.update(cartId, { metadata }, {}, headers)
    }
  } catch (error) {
    console.warn("affiliate: could not copy aff cookie to cart metadata", error)
  }
}
