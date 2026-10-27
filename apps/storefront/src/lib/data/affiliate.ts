import "server-only"
import { sdk } from "@lib/config"
import { AFFILIATE_COOKIE, affiliateMetadataUpdate } from "@lib/util/affiliate"
import { HttpTypes } from "@medusajs/types"
import { cookies as nextCookies } from "next/headers"
import { getAuthHeaders } from "./cookies"

/**
 * AF-2 cart hook (spec 05): มี cookie `aff` → คัดลอกลง cart `metadata.affiliate_token` ผ่าน store API ของ Medusa
 * ด้วย token ของ customer เจ้าของ cart (CORE-6/CORE-12) — ไม่เคยสร้าง/แก้ token เอง
 * AF-3b (กฎ 23): ใช้ `metadata` ของ cart ที่ผู้เรียกอ่านอยู่แล้ว ไม่ยิง `GET /store/carts/:id` เพิ่ม; POST เฉพาะเมื่อค่าต่าง
 * ล้มเหลวต้องไม่ทำให้การเพิ่มสินค้า/สั่งซื้อล้ม (attribution เป็นผลพลอยได้ ไม่ใช่เงื่อนไขของการซื้อ)
 */
export async function syncCartAffiliateToken(
  cartId: string,
  metadata: HttpTypes.StoreCart["metadata"],
  headers: Awaited<ReturnType<typeof getAuthHeaders>>
) {
  const token = (await nextCookies()).get(AFFILIATE_COOKIE)?.value
  const update = affiliateMetadataUpdate(metadata, token)
  if (!update || !("authorization" in headers)) {
    return
  }

  try {
    await sdk.store.cart.update(cartId, { metadata: update }, {}, headers)
  } catch (error) {
    console.warn("affiliate: could not copy aff cookie to cart metadata", error)
  }
}
