import { FormEvent, startTransition } from "react"

/**
 * CORE-23b (กฎข้อ 61): `<form action={fn}>` ของ React 19 reset ฟอร์มทุกครั้งหลัง action จบ — รวมกรณีบันทึกล้ม
 * ทำให้ค่าที่ผู้ใช้พิมพ์หาย ใช้ `onSubmit` ที่ส่ง FormData เข้า action ของ `useActionState` เองแทน (ไม่ reset)
 * pending: ส่งค่าที่สามของ `useActionState` เข้าปุ่มตรงๆ — เป็นสถานะของ action ที่เรียกจริง ไม่พึ่งกลไกภายในของ
 * React DOM (`useFormStatus` เห็น pending ของ submit แบบนี้ได้ เพราะ React เริ่ม host transition ของฟอร์มให้เมื่อ
 * submit ถูก `preventDefault()` และมี transition เริ่มใน event เดียวกัน แต่ผูกกับเงื่อนไขนั้น)
 */
export function submitWithoutReset(action: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => action(formData))
  }
}
