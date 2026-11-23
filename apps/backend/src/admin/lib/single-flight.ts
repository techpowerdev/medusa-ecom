import { useState, useSyncExternalStore } from "react"

/**
 * EV-9 (กฎข้อ 11): กัน submit ซ้ำในฟอร์ม admin — คลิกซ้อน (dblclick) เกิดใน tick เดียวก่อน `isPending`
 * ของ react-query เป็น true จึงต้องมี flag นอก state; ระหว่าง `fn` ยังไม่จบ การเรียกซ้ำถูกข้าม
 * ใช้ใน component: `const [submitOnce] = useState(createSingleFlight)`
 *
 * ADM-39 (spec 08 กฎ 43): ฟอร์มสร้างที่ปิด `FocusModal` หลังสำเร็จ — ปุ่ม Save และ ⌘/Ctrl+Enter ยังทำงานได้ระหว่างแอนิเมชันปิด
 * จึงเรียก `hold()` ใน `fn` เมื่อ request สำเร็จ: lock ค้างไว้แม้ `fn` จบแล้ว จนกว่าจะ `release()` ตอนเปิดฟอร์มใหม่
 * (`fn` ล้มหรือจบโดยไม่ `hold()` เช่น validation ฝั่ง client = ปล่อยทันที ลองใหม่ได้)
 *
 * EV-21 D1 (qa #454): `isPending()` = `fn` ยังไม่จบ — ตาราง pools ใช้กันคลิกแถว (rowHref) ระหว่าง prompt/การลบ
 *
 * ADM-46 (spec 08 กฎ 50): `isLocked()` = `fn` ยังไม่จบ หรือถูก hold; `subscribe()` แจ้งทุกครั้งที่ lock เปลี่ยน
 * ให้ React อ่านผ่าน `useSingleFlight` แล้ว `disabled` ปุ่ม Save ตลอดช่วง hold (isPending ของ react-query เป็น false แล้ว)
 */
export const createSingleFlight = () => {
  let pending = false
  let held = false
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())
  const run = async (fn: () => Promise<unknown>) => {
    if (pending || held) {
      return
    }
    pending = true
    notify()
    try {
      await fn()
    } finally {
      pending = false
      notify()
    }
  }
  return Object.assign(run, {
    hold: () => {
      held = true
      notify()
    },
    release: () => {
      held = false
      notify()
    },
    isPending: () => pending,
    isLocked: () => pending || held,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  })
}

/** ADM-46 (กฎ 50): single-flight ของ component + `locked` สำหรับ `disabled` ของปุ่ม (re-render เมื่อ lock เปลี่ยน) */
export const useSingleFlight = () => {
  const [run] = useState(createSingleFlight)
  const locked = useSyncExternalStore(run.subscribe, run.isLocked)
  return [run, locked] as const
}
