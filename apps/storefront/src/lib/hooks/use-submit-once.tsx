import { FormEvent, useEffect, useRef } from "react"

// CORE-4h (spec 01 กฎข้อ 69c): กันกด submit ซ้ำ (dblclick) ระหว่าง form action ของ useActionState ยังทำงาน
// `disabled` ของ SubmitButton (useFormStatus) มาช้ากว่าคลิกที่สองได้ → ตัดด้วย ref แบบ synchronous
// preventDefault ใน onSubmit ทำให้ React ไม่เรียก action รอบที่สอง; ปลดเมื่อ action จบ (isPending → false)
export const useSubmitOnce = (isPending: boolean) => {
  const submitting = useRef(false)

  useEffect(() => {
    if (!isPending) {
      submitting.current = false
    }
  }, [isPending])

  return (event: FormEvent<HTMLFormElement>) => {
    if (submitting.current) {
      event.preventDefault()
      return
    }
    submitting.current = true
  }
}
