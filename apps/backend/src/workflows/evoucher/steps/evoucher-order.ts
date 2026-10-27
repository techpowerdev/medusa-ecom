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
