"use client"

import { Button } from "@/components/ui/button"
import React from "react"
import { useFormStatus } from "react-dom"

// SFUI-5c (spec 09 กฎ 20): คง prop variant/size เดิมของผู้เรียก แล้ว map เป็นของ shadcn
const VARIANT = { primary: "default", secondary: "outline", transparent: "ghost" } as const
const SIZE = { small: "sm", medium: "default", large: "lg" } as const

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
  /** AF-22: pending จากภายนอก (ค่าที่สามของ useActionState) เมื่อฟอร์มส่งด้วย submitWithoutReset — ใช้แทน useFormStatus
   * เพื่อผูกกับสถานะของ action โดยตรง (useFormStatus เห็น submit แบบนี้ได้ แต่ขึ้นกับกลไก host transition ของ React DOM) */
  isLoading?: boolean
  "data-testid"?: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button
      size={SIZE[size]}
      className={className}
      type="submit"
      isLoading={isLoading ?? pending}
      disabled={disabled}
      variant={VARIANT[variant || "primary"]}
      data-testid={dataTestId}
    >
      {children}
    </Button>
  )
}
