import { useState } from "react"

/**
 * ADM-48 (spec 08 กฎ 52a): กด Enter ค้างบน Save — keydown แรก submit แล้ว modal ปิด focus คืนปุ่มเปิด keydown ที่ repeat ต่อจากนั้น
 * ตกที่ปุ่มเปิด (Enter บน button = click) จึงเปิดฟอร์มใหม่ — ยกเลิก activation ของ Enter ที่ repeat บนปุ่มเปิดจนปล่อยปุ่ม (keyup) หรือ focus ออก
 * (Enter ใหม่ที่ไม่ใช่ repeat ยังเปิดฟอร์มได้; Space activate ตอน keyup จึงไม่ repeat) ปุ่มเปิดเป็นของ dashboard (action ของ DataTable)
 * ใส่ onKeyDown เองไม่ได้ จึงผูก listener ที่ element ตอนคืน focus ที่นี่ที่เดียว
 */
const ignoreEnterRepeat = (el: HTMLElement) => {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat && e.key === "Enter") e.preventDefault()
  }
  const stop = () => {
    el.removeEventListener("keydown", onKeyDown)
    el.removeEventListener("keyup", stop)
    el.removeEventListener("blur", stop)
  }
  el.addEventListener("keydown", onKeyDown)
  el.addEventListener("keyup", stop)
  el.addEventListener("blur", stop)
}

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
        ignoreEnterRepeat(opener)
      }
    },
  }
}
