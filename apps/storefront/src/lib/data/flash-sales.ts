"use server"

import { sdk } from "@lib/config"
import {
  type ActiveFlashSales,
  type FlashVariantPrice,
  cardFlashOffer,
  mergeActiveFlashSales,
} from "@lib/util/flash-sale"
import type { HttpTypes } from "@medusajs/types"

// FS-6: endpoint ของ FS-4/FS-7 รับ variant_ids ได้ไม่เกิน 24 ตัวต่อครั้ง
const MAX_VARIANTS = 24

/**
 * แคมเปญ flash ที่กำลังทำงาน + ราคา flash ต่อ variant (`GET /store/flash-sales/active`, อ่านอย่างเดียว เปิดสาธารณะ)
 * no-store: `sold_out`/`remaining_units` เปลี่ยนตาม checkout จริง (กฎข้อ 4) ห้าม cache
 * ล้มเหลว → null (หน้าแสดงราคาปกติ ไม่ทำให้หน้าพัง)
 */
export async function getActiveFlashSales(
  regionId: string,
  variantIds: string[]
): Promise<ActiveFlashSales | null> {
  const ids = Array.from(new Set(variantIds))
  if (!ids.length) {
    return null
  }

  // FS-13: PLP มีหลายสินค้า → แบ่ง request ละไม่เกิน MAX_VARIANTS แล้วรวมผล (ยิงพร้อมกัน)
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += MAX_VARIANTS) {
    chunks.push(ids.slice(i, i + MAX_VARIANTS))
  }

  const parts = await Promise.all(
    chunks.map((variant_ids) =>
      sdk.client
        .fetch<ActiveFlashSales>("/store/flash-sales/active", {
          method: "GET",
          query: { region_id: regionId, variant_ids },
          cache: "no-store",
        })
        .catch(() => null)
    )
  )
  return mergeActiveFlashSales(parts)
}

/**
 * FS-13 (กฎข้อ 18): ราคา flash ต่อสินค้าสำหรับการ์ด PLP (key = product id; ไม่มี key = แสดงราคาปกติ)
 * เทียบ `ends_at` กับเวลาที่ได้ response; แคมเปญ sold out → ไม่มีราคา flash บนการ์ด
 */
export async function getCardFlashPrices(
  regionId: string,
  products: HttpTypes.StoreProduct[]
): Promise<Record<string, FlashVariantPrice>> {
  const variantIds = (p: HttpTypes.StoreProduct) =>
    (p.variants ?? []).map((v) => v.id)
  const flash = await getActiveFlashSales(
    regionId,
    products.flatMap(variantIds)
  )
  const now = Date.now()
  const prices: Record<string, FlashVariantPrice> = {}
  for (const p of products) {
    const offer = cardFlashOffer(flash, variantIds(p), now)
    if (offer) {
      prices[p.id] = offer.price
    }
  }
  return prices
}
