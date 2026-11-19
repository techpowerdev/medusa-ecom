// ADM-26 (spec 08 กฎ 30c): onEscapeKeyDown ของ FocusModal.Content ในฟอร์มที่มี Combobox ของ dashboard
// Radix (FocusModal) ดัก Escape ที่ document แบบ capture ก่อน Ariakit (Combobox) จึงปิด modal ทั้งที่รายการตัวเลือกเปิดอยู่ (กฎ 30b)
// → กัน modal ปิดขณะ input combobox ขยาย; ข้อจำกัดที่ยอมรับ (กฎ 30d): Ariakit ข้าม Escape ที่ preventDefault แล้ว รายการจึงไม่ปิดด้วย Escape
// ทบทวนเมื่อ bump @medusajs/* — ถ้า Escape ปิดเฉพาะรายการได้เองแล้วให้ถอด helper นี้
const EXPANDED_COMBOBOX = '[role="combobox"][aria-expanded="true"]'

export const keepModalOpenWhileComboboxExpanded = (event: KeyboardEvent) => {
  const target = event.target as Partial<Element> | null
  if (typeof target?.closest === "function" && target.closest(EXPANDED_COMBOBOX)) {
    event.preventDefault()
  }
}
