import { usePrompt } from "@medusajs/ui"
import { useEffect, useLayoutEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

type Options = {
  /** ฟอร์มของ react-hook-form — ใช้ `isDirty` (ถูกแก้) และ `isSubmitting` (กด Save แล้ว ก่อน mutation เริ่ม) */
  form: { formState: { isDirty: boolean; isSubmitting: boolean } }
  /** กำลังบันทึก (mutation ของฟอร์ม) — ไม่ปิดและไม่ถาม (เงื่อนไขกันปิดเดิม) */
  isPending: boolean
  /** ปิดฟอร์มจริง (ยืนยันแล้ว หรือไม่ dirty) */
  onClose: () => void
}

/**
 * ADM-27 (spec 08 กฎ 31): ถามยืนยันก่อนปิด `FocusModal`/`Drawer` แบบ state ที่ฟอร์ม dirty — Medusa มี pattern นี้เฉพาะ
 * `RouteModalForm` (modal แบบ route) จึงทำตาม "Custom Component Guides" ด้วย `usePrompt` ของ `@medusajs/ui`
 * และถ้อยคำ `unsavedChangesTitle`/`unsavedChangesDescription` ของ dashboard (key ของ Medusa — spec 10 กฎ 6) ปุ่มยืนยัน/ยกเลิกจาก `ecom-common`
 * คืน handler สำหรับ `onOpenChange` — ค่า `true` (เปิด) ไม่ทำอะไร; บันทึกสำเร็จผู้เรียกปิดด้วย state ตรง (ไม่ผ่าน handler นี้) จึงไม่ถาม
 * prompt ไม่ซ้อน: คำขอปิดหลายครั้งก่อน prompt เปิดรวมเป็น timer เดียว และระหว่าง prompt เปิด `usePrompt` (4.2.8) คืน promise เดิม
 */
export const useConfirmDiscard = ({ form, isPending, onClose }: Options) => {
  const prompt = usePrompt()
  const { t } = useTranslation("ecom-common")
  // อ่านใน render เพื่อ subscribe proxy ของ formState
  const { isDirty, isSubmitting } = form.formState
  const latest = useRef({ busy: isPending || isSubmitting, isDirty, onClose })
  useLayoutEffect(() => {
    latest.current = { busy: isPending || isSubmitting, isDirty, onClose }
  })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  return (open = false) => {
    if (open || latest.current.busy) return
    clearTimeout(timer.current)
    // ตัดสินใจหลัง event เดิมจบด้วยค่าล่าสุด:
    // (1) Escape: Radix เรียก onOpenChange ใน capture ของ keydown ที่ document — prompt ที่ render ทันทีผูก listener Escape
    //     ของตัวเองที่ document ก่อน event เดิมถึง bubble แล้วปิดตัวเองทันที
    // (2) qa #389 D-1: กด Save แล้ว Escape ทันที — `isSubmitting` (form.formState.isSubmitting) ยังไม่ render ตอนกด จึงต้องเช็กซ้ำ
    //     ไม่งั้น prompt เปิดระหว่างบันทึกและค้างหลังฟอร์มปิด
    timer.current = setTimeout(async () => {
      const { busy, isDirty, onClose } = latest.current
      if (busy) return
      if (!isDirty) {
        onClose()
        return
      }
      const leave = await prompt({
        title: t("general.unsavedChangesTitle", { ns: "translation" }),
        description: t("general.unsavedChangesDescription", { ns: "translation" }),
        confirmText: t("confirmDiscard.leave"),
        cancelText: t("confirmDiscard.continueEditing"),
      })
      if (leave) latest.current.onClose()
    })
  }
}
