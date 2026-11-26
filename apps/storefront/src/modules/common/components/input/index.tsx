import { Input as ShadcnInput } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import React, { useEffect, useImperativeHandle, useState } from "react"

import Eye from "@modules/common/icons/eye"
import EyeOff from "@modules/common/icons/eye-off"

type InputProps = Omit<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
  "placeholder"
> & {
  label: string
  errors?: Record<string, unknown>
  touched?: Record<string, unknown>
  name: string
  topLabel?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ type, name, label, touched: _touched, required, topLabel, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [inputType, setInputType] = useState(type)

    useEffect(() => {
      if (type === "password" && showPassword) {
        setInputType("text")
      }

      if (type === "password" && !showPassword) {
        setInputType("password")
      }
    }, [type, showPassword])

    useImperativeHandle(ref, () => inputRef.current!)

    return (
      <div className="flex flex-col w-full">
        {topLabel && (
          <Label className="mb-2 text-sm leading-5 font-medium">{topLabel}</Label>
        )}
        <div className="flex relative z-0 w-full text-sm leading-5">
          <ShadcnInput
            type={inputType}
            name={name}
            placeholder=" "
            required={required}
            className="peer pt-5 pb-1 block w-full h-12 px-4 mt-0 text-sm bg-background appearance-none hover:bg-muted focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            {...props}
            ref={inputRef}
          />
          {/* CORE-4e (qa #109): transition เฉพาะตอน focus (peer-focus:transition-all) — ค่าที่เติมจากโค้ด (เลือกที่อยู่ที่บันทึกไว้)
              ทำให้ label ลอยทันทีไม่ทับข้อความ; h-12/pt-5 เผื่อสระบน/ล่างของอักษรไทย
              SFUI-5a: ไม่ใส่ z-index ติดลบ — v4 สร้าง `-z-1` จริง (v3 ไม่มี class นี้) แล้ว label ไปอยู่หลังพื้นทึบของ input
              SFUI-8: ลอยด้วย peer ของ input (เดิม rule `input ~ label` ใน globals.css): focus/มีค่า = 10px/16px/400 เลื่อนขึ้น 12px */}
          <label
            htmlFor={name}
            onClick={() => inputRef.current?.focus()}
            className="flex items-center justify-center mx-3 px-1 absolute top-3.5 text-muted-foreground peer-focus:-translate-y-3 peer-focus:text-[10px] peer-focus:leading-4 peer-focus:font-normal peer-focus:left-0 peer-focus:transition-all peer-focus:duration-300 peer-not-placeholder-shown:-translate-y-3 peer-not-placeholder-shown:text-[10px] peer-not-placeholder-shown:leading-4 peer-not-placeholder-shown:font-normal"
          >
            {label}
            {required && <span className="text-rose-500">*</span>}
          </label>
          {type === "password" && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-muted-foreground px-4 focus:outline-hidden transition-all duration-150 outline-hidden focus:text-foreground absolute right-0 top-3.5"
            >
              {showPassword ? <Eye /> : <EyeOff />}
            </button>
          )}
        </div>
      </div>
    )
  }
)

Input.displayName = "Input"

export default Input
