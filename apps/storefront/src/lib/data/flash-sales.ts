"use server"

import { sdk } from "@lib/config"
import type { ActiveFlashSales } from "@lib/util/flash-sale"

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
  const variant_ids = Array.from(new Set(variantIds)).slice(0, MAX_VARIANTS)
  if (!variant_ids.length) {
    return null
  }

  return sdk.client
    .fetch<ActiveFlashSales>("/store/flash-sales/active", {
      method: "GET",
      query: { region_id: regionId, variant_ids },
      cache: "no-store",
    })
    .catch(() => null)
}
