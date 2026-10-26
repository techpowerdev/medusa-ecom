// type ร่วมของ step ใน allocate-and-deliver-evouchers (EV-4)
export type EvoucherOrderItem = {
  id: string
  title?: string | null
  variant_id?: string | null
  quantity: number
  metadata?: Record<string, unknown> | null
  variant?: { product?: { shipping_profile?: { type?: string | null } | null } | null } | null
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
