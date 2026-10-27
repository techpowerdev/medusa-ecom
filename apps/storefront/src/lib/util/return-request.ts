import { friendlyErrorMessage } from "./error-message"

// spec 01 CORE-20 (AC-65, Q-F5 owner 2026-10-26): เงื่อนไขแสดงปุ่ม/หน้าขอคืนสินค้า — กติกาเดียวกับที่ backend บังคับ
// ตั้งแต่ CORE-20b (Q-F6) storefront ซ่อนสิ่งที่คืนไม่ได้ และแปล error ของ backend เป็นไทย (CORE-20c)
type Dateish = string | Date | null | undefined

type ReturnableLine = {
  id: string
  requires_shipping?: boolean | null
  detail?: {
    shipped_quantity?: number | null
    return_requested_quantity?: number | null
    return_received_quantity?: number | null
    return_dismissed_quantity?: number | null
  } | null
}

type FulfillmentDates = {
  shipped_at?: Dateish
  delivered_at?: Dateish
  canceled_at?: Dateish
  items?: ({ line_item_id?: string | null } | null)[] | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/** ค่าเริ่มต้นเมื่อ region ไม่ตั้ง `return_window_days` — ต้องเท่ากับ `DEFAULT_REGION_STORE_POLICIES` ของ backend (CORE-20b; contract test CORE-20d) */
export const DEFAULT_RETURN_WINDOW_DAYS = 30

/** `return_window_days` จาก metadata ของ region (ตัวเลข ≥ 0 หรือ string ตัวเลข) แบบเดียวกับ backend; ไม่มี/ไม่ถูกต้อง → ค่าเริ่มต้น */
export const returnWindowDaysOf = (metadata: Record<string, unknown> | null | undefined) => {
  const value = metadata?.return_window_days
  const days = typeof value === "string" && value.trim() === "" ? NaN : Number(value)
  return Number.isFinite(days) && days >= 0 ? days : DEFAULT_RETURN_WINDOW_DAYS
}

/**
 * line ที่ลูกค้าขอคืนได้และจำนวนสูงสุด (กฎข้อ 60): shipped − (requested + received + dismissed)
 * — ของที่ fulfill แล้วแต่ยังไม่ส่งคืนไม่ได้; line ที่ไม่ต้องจัดส่ง (e-voucher, spec 02 กฎข้อ 6) ไม่แสดง
 */
export const returnableItems = <T extends ReturnableLine>(items: T[] | null | undefined) =>
  (items ?? []).flatMap((item) => {
    const d = item.detail ?? {}
    const quantity =
      (d.shipped_quantity ?? 0) -
      (d.return_requested_quantity ?? 0) -
      (d.return_received_quantity ?? 0) -
      (d.return_dismissed_quantity ?? 0)
    return item.requires_shipping === true && quantity > 0 ? [{ item, quantity }] : []
  })

/**
 * วันที่ได้รับของของ line (กฎข้อ 66b — แบบเดียวกับ backend CORE-20b): `delivered_at` ถ้าไม่มีใช้ `shipped_at`
 * ล่าสุดในบรรดา fulfillment ที่ไม่ถูกยกเลิกและมี line นั้น
 */
export const lineReceivedAt = (fulfillments: FulfillmentDates[] | null | undefined, lineId: string) => {
  const times = (fulfillments ?? [])
    .filter((f) => !f.canceled_at && f.items?.some((fi) => fi?.line_item_id === lineId))
    .map((f) => f.delivered_at ?? f.shipped_at)
    .filter((at): at is string | Date => !!at)
    .map((at) => new Date(at).getTime())
  return times.length ? new Date(Math.max(...times)) : null
}

/**
 * line ที่คืนได้ตอนนี้: เฉพาะ line ที่ส่งแล้วและยังไม่เลย N วันนับจากวันที่ได้รับ**ของ line นั้น**; อ่านช่วงคืนไม่ได้ (null) → ว่าง
 * — ปุ่ม หน้า return และ server action ตรวจผ่านฟังก์ชันนี้ครั้งเดียวต่อ request
 */
export const returnableItemsNow = <T extends ReturnableLine>(
  order: { items?: T[] | null; fulfillments?: FulfillmentDates[] | null },
  returnWindowDays: number | null | undefined,
  now: Date = new Date()
) => {
  if (returnWindowDays == null) return []
  return returnableItems(order.items).filter(({ item }) => {
    const received = lineReceivedAt(order.fulfillments, item.id)
    return !!received && now.getTime() <= received.getTime() + returnWindowDays * DAY_MS
  })
}

export const canRequestReturn = (
  order: { items?: ReturnableLine[] | null; fulfillments?: FulfillmentDates[] | null },
  returnWindowDays: number | null | undefined,
  now: Date = new Date()
) => returnableItemsNow(order, returnWindowDays, now).length > 0

// error 400 ของ CORE-20b (`apps/backend/src/api/store/ownership/return-window.ts`) — `FetchError` ของ js-sdk เก็บแค่
// message ไม่มี `code` จึงจับคู่ทั้ง code และ message คงที่ของ backend (กฎข้อ 37: message ไม่มีค่าจาก input)
// contract test `src/return-window-contract.test.ts` อ่าน source ของ backend และล้มเมื่อข้อความเปลี่ยนโดยไม่แก้ map นี้ (กฎข้อ 66c)
export const RETURN_ERRORS: { code: string; message: string; text: string }[] = [
  {
    code: "RETURN_ITEM_NOT_SHIPPABLE",
    message: "Only shipped products of the order can be returned",
    text: "สินค้าบางรายการไม่ต้องจัดส่ง (เช่น e-voucher) จึงขอคืนไม่ได้",
  },
  {
    code: "RETURN_ITEM_NOT_SHIPPED",
    message: "Items that have not been shipped cannot be returned",
    text: "สินค้าบางรายการยังไม่ได้จัดส่ง จึงยังขอคืนไม่ได้",
  },
  {
    code: "RETURN_WINDOW_EXPIRED",
    message: "The return window for this order has expired",
    text: "เลยระยะเวลาที่ขอคืนสินค้าได้แล้ว",
  },
]

export const returnErrorMessage = (error: unknown, fallback: string) => {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown }
  const known = RETURN_ERRORS.find((e) => e.code === code || e.message === message)
  return known ? known.text : friendlyErrorMessage(error, fallback)
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
