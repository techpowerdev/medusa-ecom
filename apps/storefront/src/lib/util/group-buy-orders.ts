// GB-7b (spec 04 Storefront): logic ล้วนของรายการ draft order ของกลุ่มในหน้า account — อ่านจาก response ของ GB-8 เท่านั้น ไม่มี I/O

/** จำนวนแถวที่หน้า account แสดง (ใหม่สุดก่อน — GB-8 เรียง `joined_at` DESC); ไฟล์ "use server" export ค่าคงที่ไม่ได้จึงอยู่ที่นี่ */
export const GROUP_BUY_MEMBERSHIPS_LIMIT = 50

export const LEAVE_NOT_ALLOWED_MESSAGE = "ออกจากกลุ่มไม่ได้แล้ว เพราะกลุ่มปิดหรือหมดเวลาแล้ว"

/** 1 แถวของ `GET /store/customers/me/group-buy/memberships` (GB-8, ADR-016) */
export type GroupBuyMembership = {
  id: string
  status: string
  units: number
  joined_at: string
  order_id: string
  group: { id: string; status: string; ends_at: string | null; pay_deadline_at: string | null; join_token: string } | null
  campaign: { id: string; name: string } | null
  order: {
    id: string
    display_id: number
    status: string
    is_draft_order: boolean
    currency_code: string
    total: number
    /** GB-22 (spec 04 กฎข้อ 45b, ADR-016 ภาคผนวก 2026-11-21) */
    payment_status: string
  } | null
}

export type GroupBuyMembershipView =
  | { kind: "waiting"; canLeave: boolean }
  | { kind: "pay"; deadline: string; canLeave: false }
  | { kind: "expired"; canLeave: false }
  | { kind: "processing"; canLeave: false }
  | { kind: "paid"; canLeave: false; orderDetails: boolean }
  | { kind: "cancelled"; canLeave: false; refundNotice: boolean }

/** ได้รับเงินแล้วแต่ order ยังเป็น draft (subscriber ยังไม่แปลง/แปลงไม่สำเร็จ) — กฎข้อ 45b */
const RECEIVED = ["captured", "authorized", "partially_captured"]
/** สิทธิ์ยกเลิกที่มีการชำระ (รวมที่คืนเงินแล้ว — GB-21) → ข้อความคืนเงินแบบหน้า pay */
const PAID_BEFORE_CANCEL = [...RECEIVED, "refunded", "partially_refunded"]

const before = (iso: string | null | undefined, nowMs: number) => !!iso && nowMs < Date.parse(iso)

/**
 * สถานะที่แสดง: รอกลุ่ม (joined) / ชำระเงินภายใน <deadline> (awaiting_payment ก่อน `pay_deadline_at` — ตรงกับฟอร์มของหน้า pay, spec 06 กฎข้อ 9b) /
 * หมดเวลาชำระเงิน (awaiting_payment ที่เลย deadline แต่ job ยังไม่ยกเลิก) / ชำระแล้ว / ยกเลิก
 * GB-22 (กฎข้อ 45b): awaiting_payment ที่ได้รับเงินแล้ว → กำลังยืนยัน (ไม่มีปุ่มชำระ ไม่กลายเป็นหมดเวลา)
 * ออกจากกลุ่มได้เฉพาะ joined + กลุ่ม open + ยังไม่หมดเวลา (spec 04 กฎข้อ 13 — backend ตัดสินซ้ำอยู่แล้ว)
 */
export function groupBuyMembershipView(m: GroupBuyMembership, nowMs: number): GroupBuyMembershipView {
  switch (m.status) {
    case "joined":
      return { kind: "waiting", canLeave: m.group?.status === "open" && before(m.group.ends_at, nowMs) }
    case "awaiting_payment": {
      if (RECEIVED.includes(m.order?.payment_status ?? "")) return { kind: "processing", canLeave: false }
      const deadline = m.group?.pay_deadline_at
      return deadline && before(deadline, nowMs)
        ? { kind: "pay", deadline, canLeave: false }
        : { kind: "expired", canLeave: false }
    }
    case "paid":
      // แปลงเป็น order ปกติแล้ว (GB-5/GB-10) → หน้า order detail ของ Medusa อ่านได้
      return { kind: "paid", canLeave: false, orderDetails: m.order?.is_draft_order === false }
    default:
      return { kind: "cancelled", canLeave: false, refundNotice: PAID_BEFORE_CANCEL.includes(m.order?.payment_status ?? "") }
  }
}

/**
 * GB-12 (spec 04 กฎข้อ 32e + คำตัดสิน owner 2026-11-04): แสดง empty state (`no-orders-container`) ของหน้า orders
 * เฉพาะเมื่อไม่มี order ปกติ และ GB-8 ตอบสำเร็จว่าไม่มี membership — อ่าน GB-8 ล้ม (null) ไม่รู้ว่ามี order แบบกลุ่มหรือไม่ จึงไม่แสดง
 */
export const showOrdersEmptyState = (
  orders: readonly unknown[],
  groupOrders: { memberships: readonly GroupBuyMembership[]; count: number } | null
) => orders.length === 0 && groupOrders !== null && groupOrders.memberships.length === 0
