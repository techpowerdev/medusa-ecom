"use server"

import { sdk } from "@lib/config"
import {
  type ActiveFlashSales,
  cartFlashExceeded,
  mergeActiveFlashSales,
} from "@lib/util/flash-sale"
import { HttpTypes } from "@medusajs/types"

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
 * FS-15 (spec 03 กฎข้อ 20b): line ของ cart ที่ได้ราคา flash แต่จำนวนเกิน `remaining_units` → { line id: remaining_units }
 * ไม่มี line ในแคมเปญ หรือ request ล้ม → {} (ไม่เตือน)
 */
export async function getCartFlashExceeded(
  cart: HttpTypes.StoreCart
): Promise<Record<string, number>> {
  const items = cart.items ?? []
  const variantIds = items.flatMap((i) => (i.variant_id ? [i.variant_id] : []))
  if (!cart.region_id || !variantIds.length) {
    return {}
  }
  const data = await getActiveFlashSales(cart.region_id, variantIds)
  return cartFlashExceeded(items, cart.promotions, data, Date.now())
}
