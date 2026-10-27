// FS-15 (spec 03 กฎข้อ 20c, AC-22): 409 ของ `POST /store/carts/:id/complete` → ข้อความไทยเฉพาะของแต่ละ code ในขั้น review
// `FetchError` ของ js-sdk 2.22.1 เก็บแค่ message/status ไม่มี `code` จึงจับคู่ทั้ง code และข้อความคงที่ของ backend
// contract test `src/checkout-conflict-contract.test.ts` อ่าน source ของ backend และล้มเมื่อข้อความเปลี่ยนโดยไม่แก้ map นี้
export const CHECKOUT_CONFLICTS: { code: string; message: string; text: string }[] = [
  {
    code: "FLASH_SOLD_OUT",
    message: "This flash sale is sold out",
    text: "สินค้าแฟลชเซลในตะกร้าขายครบจำนวนแล้ว กรุณาลบสินค้านั้นออกจากตะกร้าแล้วลองใหม่",
  },
  {
    code: "FLASH_LIMIT_EXCEEDED",
    message: "Flash sale limit per customer exceeded",
    text: "จำนวนสินค้าแฟลชเซลเกินสิทธิ์ที่ซื้อได้ต่อคน กรุณาลดจำนวนแล้วลองใหม่",
  },
  {
    code: "PROMOTION_NOT_COMBINABLE",
    message: "This promotion can't be combined with the promotions already on the cart",
    text: "โปรโมชันในตะกร้าใช้ร่วมกันไม่ได้ กรุณาลบโค้ดส่วนลดออกแล้วลองใหม่",
  },
]

// medusaError ทำตัวแรกเป็นตัวใหญ่และต่อ "." ท้ายข้อความ — ตัดออกก่อนเทียบ
const normalize = (message: string) => message.replace(/\.$/, "").toLowerCase()

/** ข้อความไทยของ 409 ที่รู้จักตอน complete cart; error อื่น → null (ผู้เรียกใช้ข้อความเดิมของตัวเอง) */
export const checkoutConflictMessage = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) {
    return null
  }
  const { code, message } = error as { code?: unknown; message?: unknown }
  const known = CHECKOUT_CONFLICTS.find(
    (c) =>
      c.code === code ||
      (typeof message === "string" && normalize(message) === normalize(c.message))
  )
  return known?.text ?? null
}
