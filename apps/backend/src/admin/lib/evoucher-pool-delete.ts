// EV-21 (spec 02 กฎข้อ 37): logic ของปุ่มลบ pool และ badge สต็อก (แยกจาก lib/evoucher.ts ที่ import SDK client — test ได้ด้วย jest)

export type PoolStockState = "no_codes" | "low" | "ok"

/** ไม่มี code เลย = "No codes" แทน "Low stock" (กฎข้อ 36c) — ตรวจ total_codes ก่อน low_stock */
export const poolStockState = (pool: { total_codes: number; low_stock: boolean }): PoolStockState => {
  if (pool.total_codes === 0) {
    return "no_codes"
  }
  return pool.low_stock ? "low" : "ok"
}

/** ข้อความของ usePrompt — ระบุจำนวน code ที่จะถูกลบตาม (กฎข้อ 36b) */
export const deletePoolPrompt = (pool: { name: string; total_codes: number }) => {
  const n = pool.total_codes
  const codes = n === 0 ? "This pool has no codes." : `This also deletes ${n} ${n === 1 ? "code" : "codes"} in the pool and lowers the variant stock.`
  return {
    title: `Delete ${pool.name}?`,
    description: `${codes} Pools with codes already sent to customers cannot be deleted. This cannot be undone.`,
    confirmText: "Delete",
    cancelText: "Cancel",
  }
}
