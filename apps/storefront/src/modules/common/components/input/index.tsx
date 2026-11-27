import { Field, FieldLabel } from "@/components/ui/field"
import { Input as ShadcnInput } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import React, { useId, useState } from "react"

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string
  errors?: Record<string, unknown>
  touched?: Record<string, unknown>
  name: string
  "data-testid"?: string
}

// SFUI-11a (spec 09 กฎ 28–31, 34–35; ADR-032): โครงตามตัวอย่างของ shadcn — Field → FieldLabel (เหนือช่อง) → control
// id = prop id ของผู้เรียก หรือ useId() (ไม่ใช้ name — ฟอร์มใน Dialog/checkout มีชื่อซ้ำได้); ช่องบังคับมี * แบบ aria-hidden
// ช่องรหัสผ่านใช้ InputGroup + ปุ่มแสดง/ซ่อน (`<t>-toggle`); ขนาดตาม default ของ shadcn (h-9) ไม่ override
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { type, name, label, id, required, className, errors: _errors, touched: _touched, "data-testid": testId, ...props },
    ref
  ) => {
    const autoId = useId()
    const inputId = id ?? autoId
    const [showPassword, setShowPassword] = useState(false)

    const control = { ...props, id: inputId, name, required, "data-testid": testId, ref }

    // className ของผู้เรียก = layout ภายนอก (เช่นตำแหน่งใน grid) → ที่ Field ไม่ส่งลง control (กฎ 28)
    return (
      <Field className={className}>
        <FieldLabel htmlFor={inputId} data-testid={testId && `${testId}-label`}>
          {label}
          {required && (
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          )}
        </FieldLabel>
        {type === "password" ? (
          <InputGroup>
            <InputGroupInput {...control} type={showPassword ? "text" : "password"} />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
                data-testid={testId && `${testId}-toggle`}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        ) : (
          <ShadcnInput {...control} type={type} />
        )}
      </Field>
    )
  }
)

Input.displayName = "Input"

export default Input
