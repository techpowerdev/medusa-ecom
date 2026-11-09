import { Input } from "@medusajs/ui"
import { type ChangeEvent, type ComponentPropsWithoutRef, type ElementRef, forwardRef } from "react"
import { BAD_NUMBER_INPUT, numberInputValue } from "../../lib/form-validation"

type NumberInputProps = Omit<ComponentPropsWithoutRef<typeof Input>, "type" | "value" | "onChange"> & {
  value?: string | number
  onChange: (value: string) => void
}

/**
 * ADM-12 (spec 08 กฎ 15): `Input type="number"` ของ @medusajs/ui สำหรับ `Form.Field` ที่ส่งค่าเป็นสตริงให้ zod
 * — ค่าที่ browser ถือว่าไม่ใช่ตัวเลข (`validity.badInput`) ส่งเป็น `BAD_NUMBER_INPUT` แทน `""` เพื่อให้ schema แสดง error ใต้ช่อง
 * ไม่ถือเป็น "ว่าง"; @medusajs/ui `Input` และ `optionalInt`/`optionalFloat` ของ dashboard ไม่ดู `badInput`
 */
export const NumberInput = forwardRef<ElementRef<typeof Input>, NumberInputProps>(
  ({ value, onChange, ...props }, ref) => {
    // React ไม่ยิง onChange เมื่อ value ยังเป็น "" (พิมพ์ "e" ในช่องว่าง) — onInput ยิงทุก input event จึงใช้ handler เดียวกัน
    const handle = (e: ChangeEvent<HTMLInputElement>) => onChange(numberInputValue(e.currentTarget))
    return (
      <Input
        {...props}
        ref={ref}
        type="number"
        // ไม่เขียนค่า sentinel ลง DOM (จะล้างสิ่งที่พิมพ์) — "" ตรงกับ value ของ DOM ตอน badInput อยู่แล้ว
        value={value === BAD_NUMBER_INPUT ? "" : value}
        onChange={handle}
        onInput={handle}
      />
    )
  }
)
NumberInput.displayName = "NumberInput"
