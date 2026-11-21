// สถานะของ code e-voucher — แหล่งเดียว (ไม่ import sdk เพื่อให้ lib ที่เป็น pure function ใช้ร่วมและ unit test ได้)
export const CODE_STATUSES = ["available", "allocated", "delivered", "void"] as const
export type CodeStatus = (typeof CODE_STATUSES)[number]

// EV-22 (กฎข้อ 38): key เดียวกับ EVOUCHER_BACKORDERED_METADATA_KEY ของ workflow (admin bundle ไม่ import โค้ดฝั่ง server)
// backend เขียนธงลง order_item ด้วย จึงอยู่ใน `items[].metadata` ของ Admin API; ล้างแล้ว key หาย
const BACKORDERED_KEY = "evoucher_backordered"

/** line ของ order ที่ยังไม่ได้ code (backordered) */
export const backorderedItems = <T extends { metadata?: Record<string, unknown> | null }>(
  items: T[] | null | undefined
) => (items ?? []).filter((item) => item.metadata?.[BACKORDERED_KEY] === true)
