import { t } from "../i18n/t"

// EV-21 (spec 02 กฎข้อ 37): logic ของปุ่มลบ pool และ badge สต็อก (แยกจาก lib/evoucher.ts ที่ import SDK client — test ได้ด้วย jest)

export type PoolStockState = "no_codes" | "low" | "ok"

/** ไม่มี code เลย = "No codes" แทน "Low stock" (กฎข้อ 36c) — ตรวจ total_codes ก่อน low_stock */
export const poolStockState = (pool: { total_codes: number; low_stock: boolean }): PoolStockState => {
  if (pool.total_codes === 0) {
    return "no_codes"
  }
  return pool.low_stock ? "low" : "ok"
}

/** ข้อความของ usePrompt — ระบุจำนวน code ที่จะถูกลบตาม (กฎข้อ 36b); spec 10 กฎ 4b: แปลตอนเรียก (ภาษาปัจจุบัน) */
export const deletePoolPrompt = (pool: { name: string; total_codes: number }) => {
  const n = pool.total_codes
  const codes = n === 0 ? t("ecom-evoucher", "pool.deleteNoCodes") : t("ecom-evoucher", "pool.deleteCodes", { count: n })
  return {
    title: t("ecom-evoucher", "pool.deleteTitle", { name: pool.name }),
    description: t("ecom-evoucher", "pool.deleteDescription", { codes }),
    confirmText: t("ecom-evoucher", "pool.delete"),
    cancelText: t("ecom-evoucher", "pool.cancel"),
  }
}
