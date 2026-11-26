"use client"

import { Button } from "@/components/button"
import React, { type ComponentProps } from "react"
import { useFormStatus } from "react-dom"

export function SubmitButton({
  children,
  variant,
  size,
  className,
  disabled,
  isLoading,
  "data-testid": dataTestId,
}: {
  children: React.ReactNode
  variant?: ComponentProps<typeof Button>["variant"]
  size?: ComponentProps<typeof Button>["size"]
  className?: string
  disabled?: boolean
  /** AF-22: pending จากภายนอก (ค่าที่สามของ useActionState) เมื่อฟอร์มส่งด้วย submitWithoutReset — ใช้แทน useFormStatus
   * เพื่อผูกกับสถานะของ action โดยตรง (useFormStatus เห็น submit แบบนี้ได้ แต่ขึ้นกับกลไก host transition ของ React DOM) */
  isLoading?: boolean
  "data-testid"?: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button
      size={size}
      className={className}
      type="submit"
      isLoading={isLoading ?? pending}
      disabled={disabled}
      variant={variant}
      data-testid={dataTestId}
    >
      {children}
    </Button>
  )
}
