import { useState } from "react"

/**
 * ADM-34 (spec 08 กฎ 38; เดิมกฎ 19b ของ ADM-15): คืน focus ให้ปุ่มที่เปิด `FocusModal` แบบ state เมื่อปิด
 * Radix `Dialog` (ใต้ `FocusModal` ของ `@medusajs/ui`) คืน focus ให้ `Dialog.Trigger` เท่านั้น (`DialogContentModal`
 * preventDefault แล้ว focus `triggerRef` — ไม่มี trigger = focus หลุดไป BODY) และใช้ `FocusModal.Trigger` ไม่ได้เพราะ
 * ปุ่มเปิดของเราไม่ได้ render เอง: ปุ่มใน `action` ของ `DataTable` (`DataTableAction` ของ `@medusajs/dashboard` render
 * `Button` จาก `label`/`onClick` ไม่รับ children/asChild) และปุ่มใน `props` ของ `Header` (render นอก `FocusModal` root)
 * dashboard ไม่ export hook/คอมโพเนนต์สำหรับ modal แบบ state (Q5) จึงส่ง handler ให้ prop `onOpenAutoFocus`/`onCloseAutoFocus`
 * ของ `FocusModal.Content` (ใช้แบบ spread `{...restoreFocus}`) — ไม่ห่อ `FocusModal`
 */
export const useRestoreOpenerFocus = () => {
  const [opener, setOpener] = useState<HTMLElement | null>(null)
  return {
    // ยิงก่อน focus ย้ายเข้า modal — activeElement ยังเป็นปุ่มที่กดเปิด
    onOpenAutoFocus: () => setOpener(document.activeElement instanceof HTMLElement ? document.activeElement : null),
    // ปุ่มถูกถอดจาก DOM แล้ว (เช่นหน้าเปลี่ยน) → ปล่อยค่าเริ่มต้นของ Radix
    onCloseAutoFocus: (e: Event) => {
      if (opener?.isConnected) {
        e.preventDefault()
        opener.focus()
      }
    },
  }
}
