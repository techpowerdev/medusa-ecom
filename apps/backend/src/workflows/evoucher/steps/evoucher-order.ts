// type ร่วมของ step ใน allocate-and-deliver-evouchers (EV-4)
export type EvoucherOrderItem = {
  id: string
  title?: string | null
  variant_id?: string | null
  quantity: number
  metadata?: Record<string, unknown> | null
  variant?: { product?: { id: string; shipping_profile?: { id: string } | null } | null } | null
}

export type EvoucherOrder = {
  id: string
  /** กฎข้อ 34: `canceled` → allocation ข้าม order นี้ */
  status?: string | null
  display_id?: number | null
  email?: string | null
  customer_id?: string | null
  items?: (EvoucherOrderItem | null)[] | null
  shipping_methods?: ({ shipping_option_id?: string | null } | null)[] | null
}

export type EvoucherLine = {
  line_item_id: string
  pool_id: string
  pool_name: string
  title: string
  quantity: number
}

export const EVOUCHER_BACKORDERED_METADATA_KEY = "evoucher_backordered"
export const EVOUCHER_NOTIFICATION_TRIGGER = "payment.captured"

/** EV-5c (กฎข้อ 21): lock key ต่อ order ที่ allocation (EV-4) และ resend (EV-5b) ถือร่วมกัน — กันอีเมลซ้ำ 2 ฉบับ */
export const evoucherOrderLockKey = (orderId: string) => `evoucher-order:${orderId}`

// EV-5c (กฎข้อ 21): รอ resend ที่ถืออยู่ได้ (ส่งอีเมลไม่กี่วินาที); allocation ถือตลอด claim → fulfillment → ส่งอีเมล → mark delivered
// EV-16 (กฎข้อ 32b): การปล่อย code ของ order ที่ยกเลิกใช้ค่าเดียวกัน
export const EVOUCHER_ORDER_LOCK_TIMEOUT = 30
// EV-N2 (กฎข้อ 27a): ≥ 300 วินาที — เผื่อ fulfillment + SMTP ช้า; lock หมดอายุเองถ้า process ตายกลางทาง
export const EVOUCHER_ORDER_LOCK_TTL = 300
