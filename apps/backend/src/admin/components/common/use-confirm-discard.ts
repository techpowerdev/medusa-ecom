import { usePrompt } from "@medusajs/ui"
import { useState } from "react"
import { createSingleFlight } from "../../lib/single-flight"

type Options = {
  /** ฟอร์มถูกแก้ (`form.formState.isDirty`) */
  isDirty: boolean
  /** กำลังบันทึก — ไม่ปิดและไม่ถาม (เงื่อนไขกันปิดเดิม) */
  isPending: boolean
  /** ปิดฟอร์มจริง (ยืนยันแล้ว หรือไม่ dirty) */
  onClose: () => void
}

/**
 * ADM-27 (spec 08 กฎ 31): ถามยืนยันก่อนปิด `FocusModal`/`Drawer` แบบ state ที่ฟอร์ม dirty — Medusa มี pattern นี้เฉพาะ
 * `RouteModalForm` (modal แบบ route) จึงทำตาม "Custom Component Guides" ด้วย `usePrompt` ของ `@medusajs/ui`
 * และถ้อยคำ `unsavedChangesTitle`/`unsavedChangesDescription` ของ dashboard
 * คืน handler สำหรับ `onOpenChange` — ค่า `true` (เปิด) ไม่ทำอะไร; ระหว่าง prompt เปิดอยู่คำขอปิดซ้ำถูกข้าม (single flight)
 * บันทึกสำเร็จให้ผู้เรียกปิดด้วย state ตรง (ไม่ผ่าน handler นี้) จึงไม่ถาม
 */
export const useConfirmDiscard = ({ isDirty, isPending, onClose }: Options) => {
  const prompt = usePrompt()
  const [askOnce] = useState(createSingleFlight)

  return (open = false) => {
    if (open || isPending) return
    if (!isDirty) {
      onClose()
      return
    }
    void askOnce(async () => {
      // Escape: Radix เรียก onOpenChange ใน capture ของ keydown ที่ document — prompt ที่ render ทันที (sync lane) ผูก listener
      // Escape ของตัวเองที่ document ก่อน event เดิมถึง bubble แล้วปิดตัวเองทันที → รอให้ event เดิมจบก่อนเปิด prompt
      await new Promise((resolve) => setTimeout(resolve))
      const leave = await prompt({
        title: "Are you sure you want to leave this form?",
        description: "You have unsaved changes that will be lost if you exit this form.",
        confirmText: "Leave",
        cancelText: "Continue editing",
      })
      if (leave) onClose()
    })
  }
}
