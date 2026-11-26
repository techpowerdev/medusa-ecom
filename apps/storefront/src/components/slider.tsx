"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// SFUI-7 (spec 09 กฎ 3, 10): Slider ของ shadcn + `thumbLabels` — ไม่ตั้งชื่อ thumb แล้ว Radix ใส่ aria-label "Minimum"/"Maximum"
// ภาษาอังกฤษ; ของ CLI ไม่ส่ง prop ถึง thumb จึงประกอบจาก primitive ของ Radix ด้วย class เดียวกับ src/components/ui/slider.tsx
// (wrappers.test.tsx เทียบ DOM กับของ CLI)
// ใช้ `cn` ของ `@/lib/utils` (ต่างจากไฟล์ใน ui/ ที่ใช้ package `cn` ตามผล CLI) — แต่ utility ขนาดฟอนต์ของ globals.css
// ยังห้ามส่งเข้า wrapper นี้เหมือน ui/ (e2e/sfui-7-ui-pristine.unit.spec.ts, spec 09 กฎ 2)
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabels,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabels?: string[] }) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          // ส่ง aria-label เฉพาะเมื่อมีชื่อ — ค่า undefined ทับชื่อ "Minimum"/"Maximum" ของ Radix จนต่างจาก Slider ของ CLI
          {...(thumbLabels ? { "aria-label": thumbLabels[index] } : {})}
          className="block size-4 shrink-0 rounded-full border border-primary bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
