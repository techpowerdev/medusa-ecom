type LineAmounts = {
  unit_price?: number | null
  compare_at_unit_price?: number | null
  quantity: number
  original_total?: number | null
}

/**
 * CORE-67 (spec 01 กฎข้อ 125a): ยอดอ้างอิงก่อนลดของทั้ง line สำหรับราคาขีดฆ่า
 * Medusa ตั้ง `compare_at_unit_price` (ราคาฐาน) ให้ line ที่ราคามาจาก price list แบบ sale → ราคาเดิมต่อหน่วย × จำนวน
 * ปรับฐานภาษีเดียวกับ `original_total` (สัดส่วน compare ÷ unit); line อื่นคง `original_total` ตามเดิม
 */
export function lineReferenceTotal({ unit_price, compare_at_unit_price, original_total }: LineAmounts): number {
  const original = original_total ?? 0
  if (typeof compare_at_unit_price !== "number" || typeof unit_price !== "number" || unit_price <= 0) {
    return original
  }
  if (compare_at_unit_price - unit_price <= 0.005) {
    return original
  }
  return (compare_at_unit_price * original) / unit_price
}
