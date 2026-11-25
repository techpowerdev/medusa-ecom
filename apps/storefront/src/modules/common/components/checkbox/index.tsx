import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import React from "react"

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
  return (
    <div className="flex items-center space-x-2 ">
      {/* ห่อให้ input ซ่อนของ Radix ไม่อยู่ข้าง label (เหมือนโครง shim เดิม — core-38 วัด label เทียบ input พี่น้อง) */}
      <span className="flex">
        <Checkbox
          id="checkbox"
          checked={checked}
          defaultChecked={checked}
          onClick={onChange}
          name={name}
          data-testid={dataTestId}
        />
      </span>
      {/* transform-none!/text-sm!: กัน rule `input ~ label` ของ globals.css (label ลอย) จับ input ซ่อนของ Radix */}
      <Label htmlFor="checkbox" className="transform-none! text-sm!">
        {label}
      </Label>
    </div>
  )
}

export default CheckboxWithLabel
