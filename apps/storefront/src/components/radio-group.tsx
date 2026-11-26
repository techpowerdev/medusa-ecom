"use client"

import * as React from "react"
import { CircleIcon } from "lucide-react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// SFUI-7 (spec 09 กฎ 3, 9): RadioGroupItem ของ shadcn ที่ render `children` ต่อท้าย indicator — ตัวเลือกวิธีชำระ (SFUI-3d)
// ต้องมีชื่อวิธีอยู่ในปุ่ม role="radio" ที่มี testid; ของ CLI ไม่ render children จึงประกอบจาก primitive ของ Radix
// ด้วย class เดียวกับ src/components/ui/radio-group.tsx (wrappers.test.tsx เทียบ DOM กับของ CLI)
// ใช้ `cn` ของ `@/lib/utils` (ต่างจากไฟล์ใน ui/ ที่ใช้ package `cn` ตามผล CLI) — แต่ utility ขนาดฟอนต์ของ globals.css
// ยังห้ามส่งเข้า wrapper นี้เหมือน ui/ (e2e/sfui-7-ui-pristine.unit.spec.ts, spec 09 กฎ 2)
function RadioGroupItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "aspect-square size-4 shrink-0 rounded-full border border-input text-primary shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-primary" />
      </RadioGroupPrimitive.Indicator>
      {children}
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroupItem }
