import { FormEvent, startTransition } from "react"

/**
 * CORE-23b (กฎข้อ 61): `<form action={fn}>` ของ React 19 reset ฟอร์มทุกครั้งหลัง action จบ — รวมกรณีบันทึกล้ม
 * ทำให้ค่าที่ผู้ใช้พิมพ์หาย ใช้ `onSubmit` ที่ส่ง FormData เข้า action ของ `useActionState` เองแทน (ไม่ reset)
 * pending ใช้ค่าที่สามของ `useActionState` (useFormStatus ไม่เห็น submit แบบนี้)
 */
export function submitWithoutReset(action: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => action(formData))
  }
}
