import { useLayoutEffect, useReducer, useRef } from "react"

/**
 * ADM-47 (spec 08 กฎ 51; ย้ายจาก ProgramActions ของ ADM-44): เปิดฟอร์ม (Drawer/FocusModal/Prompt) จาก menuitem ของ `ActionMenu`
 * - `remountMenu()` เรียกใน onClick ของ menuitem แล้วส่ง `menuKey` เป็น `key` ของ `ActionMenu` — mount เมนูใหม่ใน commit เดียวกับฟอร์ม
 *   (ปิดทันทีไม่รอ animation) ไม่งั้น Radix คนละสำเนาของเมนูกับฟอร์มคืนค่า pointer-events ของ body สลับกันจนค้าง `none` (กฎ 27b)
 * - การ remount ถอด trigger เดิมและ menuitem ที่ focus อยู่ → ฟอร์มจำ opener ไม่ได้ (ปิดแล้ว focus = BODY) จึง focus trigger ตัวใหม่
 *   (`ref={trigger}`) ใน layout effect — ก่อน effect ของ FocusScope ในฟอร์ม ซึ่งเรียก `onOpenAutoFocus` ของ `useRestoreOpenerFocus`
 *   ให้จำปุ่ม `…` ของแถวและคืน focus ให้เมื่อปิด
 */
export const useRemountMenu = () => {
  const [menuKey, remountMenu] = useReducer((k: number) => k + 1, 0)
  const trigger = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    if (menuKey) trigger.current?.focus()
  }, [menuKey])
  return { menuKey, remountMenu, trigger }
}
