// FS-15 (spec 03 กฎข้อ 20c, AC-22): 409 ของ `POST /store/carts/:id/complete` → ข้อความไทยเฉพาะของแต่ละ code ในขั้น review
// CORE-82 (spec 01 กฎข้อ 140, ADR-028): ตัดสินจาก `code` ของ `MedusaApiError` (`medusaFetch`) เท่านั้น — ไม่เทียบข้อความของ backend
// contract test `src/checkout-conflict-contract.test.ts` อ่าน code จาก source ของ backend และล้มเมื่อ code เปลี่ยนโดยไม่แก้ map นี้
export const CHECKOUT_CONFLICTS: { code: string; text: string }[] = [
  {
    code: "FLASH_SOLD_OUT",
    text: "สินค้าแฟลชเซลในตะกร้าขายครบจำนวนแล้ว กรุณาลบสินค้านั้นออกจากตะกร้าแล้วลองใหม่",
  },
  {
    code: "FLASH_LIMIT_EXCEEDED",
    text: "จำนวนสินค้าแฟลชเซลเกินสิทธิ์ที่ซื้อได้ต่อคน กรุณาลดจำนวนแล้วลองใหม่",
  },
  {
    code: "PROMOTION_NOT_COMBINABLE",
    text: "โปรโมชันในตะกร้าใช้ร่วมกันไม่ได้ กรุณาลบโค้ดส่วนลดออกแล้วลองใหม่",
  },
]

const knownConflict = (error: unknown) => {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined
  return CHECKOUT_CONFLICTS.find((c) => c.code === code)
}

/** ข้อความไทยของ 409 ที่รู้จักตอน complete cart; error อื่น → null (ผู้เรียกใช้ข้อความเดิมของตัวเอง) */
export const checkoutConflictMessage = (error: unknown): string | null =>
  knownConflict(error)?.text ?? null

/** CORE-4i (กฎข้อ 72): code ของ 409 ที่รู้จัก (จาก `code` ของ error); error อื่น → null */
export const checkoutConflictCode = (error: unknown): string | null =>
  knownConflict(error)?.code ?? null

// FS-22 (spec 03 กฎข้อ 27): complete ล้มเพราะสต็อก inventory ไม่พอ (ผู้แพ้ race ของ e-voucher ใบสุดท้าย/สินค้าชิ้นสุดท้าย)
// `placeOrderOutcome` คืน code นี้จาก `isOutOfStockAtCompletion` (ไม่อยู่ใน CHECKOUT_CONFLICTS — error ของ Medusa ไม่ใช่ 409 ของเรา)
export const OUT_OF_STOCK = "OUT_OF_STOCK"

/**
 * PAY-19 (spec 06 กฎข้อ 21a — owner Q-P16 2026-11-24): notice ขั้น review เมื่อ collection คืนเงินครบและไม่มี session (reload/Back)
 * ไม่รู้ว่าจ่ายด้วยบัตรหรือพร้อมเพย์ (Store API ไม่มี payment ของ collection) → บอกทั้งสองทาง
 */
export const REVIEW_REFUNDED_NOTICE =
  "การชำระเงินของตะกร้านี้ไม่สำเร็จ เราเริ่มคืนเงินเต็มจำนวนแล้ว — ชำระด้วยบัตร เงินจะเข้าบัญชีตามรอบของธนาคาร; " +
  "ชำระด้วยพร้อมเพย์ ผู้ให้บริการชำระเงินจะส่งอีเมลให้คุณกรอกบัญชีรับเงินคืน กรุณาตรวจอีเมล — กรุณาปรับตะกร้าแล้วสั่งใหม่"

export const REFUNDED_NOTICE =
  "สินค้า/สิทธิ์ราคาพิเศษหมดระหว่างชำระเงิน ระบบคืนเงินเต็มจำนวนให้อัตโนมัติแล้ว (เข้าบัญชีตามรอบของธนาคาร) กรุณาปรับตะกร้าแล้วสั่งใหม่"
