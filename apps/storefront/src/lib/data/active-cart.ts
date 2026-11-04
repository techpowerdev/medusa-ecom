import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { getAuthHeaders, getCacheTag, setCartId } from "./cookies"

// CORE-29 (spec 01 กฎข้อ 86, ADR-019 ทางเลือก B): id ของตะกร้าหลักใน `customer.metadata.active_cart_id` เป็นแค่ hint
// ให้กู้ cookie cart หลัง login ใหม่ — สิทธิ์ตรวจโดย ownership ของ CORE-12 (`GET /store/carts/:id` ของคนอื่น = 404) เท่านั้น
// ไม่ใช่ "use server" (ไม่เปิดเป็น server action ให้ client เรียก); ใช้ฝั่ง server เท่านั้นผ่าน `./cookies` (server-only)

/**
 * บันทึก cart ที่เพิ่งตั้งเป็น cookie `_medusa_cart_id` — ส่งเฉพาะ key นี้ เพราะ Medusa merge `metadata` เอง (กฎข้อ 86e)
 * เขียนไม่สำเร็จ → log แล้วไปต่อ (การสร้าง/ตั้ง cart ไม่ล้ม)
 * ห้ามเรียกกับ cart ของ group buy (spec 04 กฎข้อ 14c — ไม่ใช่ตะกร้าหลัก)
 */
export async function rememberActiveCart(cartId: string) {
  try {
    await sdk.store.customer.update({ metadata: { active_cart_id: cartId } }, {}, await getAuthHeaders())
  } catch (error) {
    console.error("CORE-29: บันทึก active_cart_id ไม่สำเร็จ", error)
  }
}

/**
 * ตอน login เมื่อไม่มี cookie cart (กฎข้อ 86b): cart ใน `active_cart_id` อ่านได้ด้วย token ใหม่และยังไม่ complete → ตั้งเป็น cookie
 * กรณีอื่นทั้งหมด (ไม่มีค่า / 404 / complete แล้ว / error) → ไม่ทำอะไร
 */
export async function restoreActiveCart() {
  try {
    const headers = await getAuthHeaders()
    const { customer } = await sdk.store.customer.retrieve({ fields: "metadata" }, headers)
    const cartId = customer?.metadata?.active_cart_id
    if (typeof cartId !== "string" || !cartId) {
      return
    }

    const { cart } = await sdk.client.fetch<HttpTypes.StoreCartResponse>(`/store/carts/${cartId}`, {
      method: "GET",
      query: { fields: "id,completed_at" },
      headers,
      cache: "no-store",
    })
    if (cart.completed_at) {
      return
    }

    await setCartId(cart.id)
    const cartCacheTag = await getCacheTag("carts")
    if (cartCacheTag) {
      revalidateTag(cartCacheTag, { expire: 0 })
    }
  } catch (error) {
    console.error("CORE-29: กู้ตะกร้าจาก active_cart_id ไม่สำเร็จ", error)
  }
}
