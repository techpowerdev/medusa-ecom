import * as React from "react"

import { Button as ShadcnButton } from "@/components/ui/button"

// SFUI-7 (spec 09 กฎ 3, 20): Button ของ shadcn + `isLoading` ของ shim เดิม — ระหว่างส่งแสดง "กำลังดำเนินการ..." และ disabled
// ตอน loading ไม่ใช้ asChild (Slot ต้องการลูกเป็น element ตัวเดียว ใช้กับข้อความไม่ได้) จึง render เป็น <button> เสมอ
function Button({
  isLoading = false,
  asChild,
  disabled,
  children,
  ...props
}: React.ComponentProps<typeof ShadcnButton> & { isLoading?: boolean }) {
  return (
    <ShadcnButton asChild={asChild && !isLoading} disabled={disabled || isLoading} {...props}>
      {isLoading ? "กำลังดำเนินการ..." : children}
    </ShadcnButton>
  )
}

export { Button }
