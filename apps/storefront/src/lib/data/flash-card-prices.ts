import "server-only"

import { getActiveFlashSales } from "@lib/data/flash-sales"
import { type FlashVariantPrice, cardFlashPrices } from "@lib/util/flash-sale"
import type { HttpTypes } from "@medusajs/types"

/**
 * FS-13 (กฎข้อ 18): ราคา flash ต่อสินค้าสำหรับการ์ด PLP (key = product id; ไม่มี key = แสดงราคาปกติ)
 * ไม่อยู่ในไฟล์ "use server" เพื่อไม่ให้ถูก expose เป็น server action (เรียกจาก server component ของ PLP เท่านั้น)
 * เทียบ `ends_at` กับเวลาที่ได้ response; แคมเปญ sold out → ไม่มีราคา flash บนการ์ด
 */
export async function getCardFlashPrices(
  regionId: string,
  products: HttpTypes.StoreProduct[]
): Promise<Record<string, FlashVariantPrice>> {
  const variantIdsByProduct = Object.fromEntries(
    products.map((p) => [p.id, (p.variants ?? []).map((v) => v.id)])
  )
  const flash = await getActiveFlashSales(
    regionId,
    Object.values(variantIdsByProduct).flat()
  )
  return cardFlashPrices(flash, variantIdsByProduct, Date.now())
}
