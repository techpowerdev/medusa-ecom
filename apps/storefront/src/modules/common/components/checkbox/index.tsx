import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import React, { useId } from "react"

type CheckboxProps = {
  checked?: boolean
  onChange?: () => void
  label: string
  name?: string
  'data-testid'?: string
}

// SFUI-5a (spec 09 กฎ 13, 20): Checkbox ของ shadcn — root เป็น role="checkbox" (testid อยู่บน root) และใน <form>
// Radix สร้าง input ซ่อนที่ส่ง `<name>=on` เมื่อติ๊ก (value เริ่มต้น "on" — cart.ts อ่าน `=== "on"`)
// qa #353 D-1: form.reset() (React 19 หลัง action คืน error) ต้องไม่เปลี่ยนค่า — Radix ฟัง reset แล้วเรียก onCheckedChange
// ด้วยค่าตอน mount จึงสลับผ่าน onClick (คลิก/Space/label) แทน และ defaultChecked = ค่าปัจจุบันให้ input ซ่อน reset กลับค่าเดิม
const CheckboxWithLabel: React.FC<CheckboxProps> = ({
  checked = true,
  onChange,
  label,
  name,
  'data-testid': dataTestId
}) => {
  // SFUI-11a (spec 09 กฎ 28–29): Field แนวนอน → control → FieldLabel; id จาก useId() (เดิม "checkbox" คงที่ ชนกันเมื่อมีหลายตัว)
  const id = useId()
  return (
    <Field orientation="horizontal">
      <Checkbox
        id={id}
        checked={checked}
        defaultChecked={checked}
        onClick={onChange}
        name={name}
        data-testid={dataTestId}
      />
      <FieldLabel htmlFor={id} data-testid={dataTestId && `${dataTestId}-label`}>
        {label}
      </FieldLabel>
    </Field>
  )
}

export default CheckboxWithLabel
