// spec 01 CORE-20 (AC-65, Q-F5 owner 2026-10-26): เงื่อนไขแสดงปุ่ม/หน้าขอคืนสินค้า — backend ไม่บังคับใน v1
// (POST /store/returns ของ Medusa ตรวจจำนวนเอง) storefront จึงซ่อนสิ่งที่คืนไม่ได้
type Dateish = string | Date | null | undefined

type ReturnableLine = {
  id: string
  requires_shipping?: boolean | null
  detail?: {
    fulfilled_quantity?: number | null
    return_requested_quantity?: number | null
    return_received_quantity?: number | null
    return_dismissed_quantity?: number | null
  } | null
}

type FulfillmentDates = {
  shipped_at?: Dateish
  delivered_at?: Dateish
  canceled_at?: Dateish
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * line ที่ลูกค้าขอคืนได้และจำนวนสูงสุด — สูตรเดียวกับ `return-item` ของ Medusa:
 * fulfilled − (requested + received + dismissed); line ที่ไม่ต้องจัดส่ง (e-voucher, spec 02 กฎข้อ 6) ไม่แสดง
 */
export const returnableItems = <T extends ReturnableLine>(items: T[] | null | undefined) =>
  (items ?? []).flatMap((item) => {
    const d = item.detail ?? {}
    const quantity =
      (d.fulfilled_quantity ?? 0) -
      (d.return_requested_quantity ?? 0) -
      (d.return_received_quantity ?? 0) -
      (d.return_dismissed_quantity ?? 0)
    return item.requires_shipping === true && quantity > 0 ? [{ item, quantity }] : []
  })

/** วันที่ได้รับของ: `delivered_at` ถ้าไม่มีใช้ `shipped_at` ของ fulfillment ล่าสุดที่ไม่ถูกยกเลิก */
export const receivedAt = (fulfillments: FulfillmentDates[] | null | undefined) => {
  const times = (fulfillments ?? [])
    .filter((f) => !f.canceled_at)
    .map((f) => f.delivered_at ?? f.shipped_at)
    .filter((at): at is string | Date => !!at)
    .map((at) => new Date(at).getTime())
  return times.length ? new Date(Math.max(...times)) : null
}

export const canRequestReturn = (
  order: { items?: ReturnableLine[] | null; fulfillments?: FulfillmentDates[] | null },
  returnWindowDays: number | null | undefined,
  now: Date = new Date()
) => {
  const received = receivedAt(order.fulfillments)
  if (returnWindowDays == null || !received) return false
  if (now.getTime() > received.getTime() + returnWindowDays * DAY_MS) return false
  return returnableItems(order.items).length > 0
}

/**
 * body ของ `POST /store/returns` — กฎข้อ 30: ไม่ส่ง `return_shipping.price`, `receive_now`, `location_id`
 * (ราคา/location มาจาก return option ของร้าน, admin เป็นผู้รับของคืน)
 */
export const buildReturnRequest = ({
  orderId,
  optionId,
  lines,
}: {
  orderId: string
  optionId: string
  lines: { id: string; quantity: number; reasonId?: string | null }[]
}) => ({
  order_id: orderId,
  items: lines
    .filter((line) => line.quantity > 0)
    .map(({ id, quantity, reasonId }) => ({ id, quantity, ...(reasonId ? { reason_id: reasonId } : {}) })),
  return_shipping: { option_id: optionId },
})
