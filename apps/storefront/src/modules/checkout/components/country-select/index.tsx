"use client"

import { useEffect, useId, useRef, useState } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HttpTypes } from "@medusajs/types"
import { useFieldError } from "@modules/common/components/input"

type CountrySelectProps = {
  region?: HttpTypes.StoreRegion
  name: string
  label?: string
  placeholder?: string
  required?: boolean
  autoComplete?: string
  /** controlled (checkout) — คู่กับ `onValueChange` */
  value?: string
  /** uncontrolled (ฟอร์มที่อยู่ในบัญชี) */
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  "data-testid": string
}

// SFUI-16b (spec 09 กฎ 40b–c, 41–43; ADR-033): component ของโดเมน — แปลง `region.countries` เป็น `SelectItem` ของ shadcn
// ประกอบตามตัวอย่าง docs: Field → FieldLabel → Select → SelectTrigger (testid + data-value) → SelectValue (children = ข้อความของค่าปัจจุบัน)
// → SelectContent → SelectItem; ค่าปัจจุบัน = `value` ของผู้เรียก (controlled) หรือ state จาก `onValueChange` (uncontrolled — เริ่มจาก `defaultValue`)
const CountrySelect = ({
  placeholder = "เลือกประเทศ",
  label = "ประเทศ",
  region,
  name,
  required,
  autoComplete,
  value,
  defaultValue,
  onValueChange,
  className,
  "data-testid": testId,
}: CountrySelectProps) => {
  const id = useId()
  const controlled = value !== undefined
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? "")
  const current = controlled ? value : uncontrolledValue
  const { fieldProps, controlProps, messages } = useFieldError<HTMLButtonElement>(null, {
    id,
    label,
    testId,
    control: "select",
    props: { value: current },
  })

  // กฎ 42 (spec 01 กฎ 110d): React 19 reset `<form action>` หลัง action คืนผล — Radix ตอบ `reset` ด้วย `onValueChange(ค่าแรก)`
  // และ browser คืน select ซ่อนเป็น option เริ่มต้น → controlled: ไม่ส่ง onValueChange ระหว่าง reset แล้วคืนค่าปัจจุบันให้ select ซ่อน
  // (ฟัง capture ที่ document — มาก่อน listener ของ Radix บนฟอร์ม; browser reset control หลัง event จบ จึงคืนค่าใน task ถัดไป)
  const resetting = useRef(false)
  const trigger = controlProps.ref
  useEffect(() => {
    if (!controlled) return
    const onReset = (e: Event) => {
      const form = trigger.current?.closest("form")
      if (!form || e.target !== form) return
      resetting.current = true
      setTimeout(() => {
        resetting.current = false
        // ค่าปัจจุบัน = `data-value` ของ trigger (render ล่าสุด)
        const hidden = trigger.current?.parentElement?.querySelector("select")
        if (hidden) hidden.value = trigger.current?.getAttribute("data-value") ?? ""
      })
    }
    document.addEventListener("reset", onReset, true)
    return () => document.removeEventListener("reset", onReset, true)
  }, [controlled, trigger])

  const handleValueChange = (next: string) => {
    if (resetting.current) return
    if (!controlled) setUncontrolledValue(next)
    onValueChange?.(next)
  }

  const countries = region?.countries ?? []

  return (
    <Field className={className} {...fieldProps}>
      <FieldLabel htmlFor={id} data-testid={`${testId}-label`}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        )}
      </FieldLabel>
      <Select
        name={name}
        required={required}
        autoComplete={autoComplete}
        {...(controlled ? { value } : { defaultValue })}
        onValueChange={handleValueChange}
      >
        <SelectTrigger id={id} data-testid={testId} data-value={current} className="w-full" {...controlProps}>
          <SelectValue placeholder={placeholder}>
            {countries.find((country) => country.iso_2 === current)?.display_name}
          </SelectValue>
        </SelectTrigger>
        <SelectContent data-testid={`${testId}-options`}>
          {countries.map((country) => (
            <SelectItem
              key={country.iso_2}
              value={country.iso_2!}
              data-testid={`${testId}-option`}
              data-value={country.iso_2}
            >
              {country.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {messages}
    </Field>
  )
}

export default CountrySelect
