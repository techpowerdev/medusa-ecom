"use client"

import { Button } from "@modules/common/components/ui"
import React from "react"
import { useFormStatus } from "react-dom"

export function SubmitButton({
  children,
  variant = "primary",
  size = "medium",
  className,
  disabled,
  isLoading,
  "data-testid": dataTestId,
}: {
  children: React.ReactNode
  variant?: "primary" | "secondary" | "transparent" | null
  size?: "small" | "medium" | "large"
  className?: string
  disabled?: boolean
  /** AF-22: pending จากภายนอก (ค่าที่สามของ useActionState) เมื่อฟอร์มส่งด้วย submitWithoutReset ซึ่ง useFormStatus ไม่เห็น */
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
      variant={variant || "primary"}
      data-testid={dataTestId}
    >
      {children}
    </Button>
  )
}
