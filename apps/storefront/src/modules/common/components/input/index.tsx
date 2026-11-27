import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input as ShadcnInput } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { fieldErrorMessage } from "@lib/util/field-validation"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import React, { useEffect, useId, useImperativeHandle, useRef, useState } from "react"

// HTMLButtonElement = SelectTrigger ของ Radix (validity อยู่ที่ select ซ่อนข้าง trigger)
type Control = HTMLInputElement | HTMLSelectElement | HTMLButtonElement
type Validatable = HTMLInputElement | HTMLSelectElement

type FieldErrorOptions<T extends Control> = {
  id: string
  label: string
  testId?: string
  control: "input" | "select"
  error?: string
  description?: React.ReactNode
  props?: {
    title?: string
    value?: unknown
    onChange?: React.ChangeEventHandler<T>
    onInvalid?: React.FormEventHandler<T>
    "aria-describedby"?: string
  }
}

/** select ซ่อนที่ Radix render ข้าง trigger (พี่น้องใน element เดียวกัน) — ที่อยู่ของ name/required/validity */
function hiddenSelectOf(trigger: Element | null): HTMLSelectElement | null {
  const select = trigger?.parentElement && Array.from(trigger.parentElement.children).find((el) => el.tagName === "SELECT")
  return (select as HTMLSelectElement | undefined) ?? null
}

const isSelectTrigger = (el: Element | null | undefined) => el?.getAttribute("data-slot") === "select-trigger"

/** element ที่ถือ validity ของ control (trigger ของ Radix → select ซ่อน) */
const validatable = (el: Element | null): Validatable | null =>
  isSelectTrigger(el) ? hiddenSelectOf(el) : (el as Validatable | null)

/**
 * SFUI-11b (spec 09 กฎ 32b–d; ADR-032 D4): error ระดับช่องจาก validation native ของ Input / NativeSelect
 * `invalid` → preventDefault + ข้อความไทยใน FieldError, focus ช่องแรกที่ผิดของฟอร์ม; ค่าเปลี่ยน (พิมพ์/เลือก/value จากโค้ด) จน valid → ล้าง
 * prop `error` ของผู้เรียกแสดงแบบเดียวกัน; aria-describedby อ้างเฉพาะ id ที่มี element จริง
 * SFUI-15 (กฎ 43; ADR-033 D3): select ของ Radix — `controlProps` ใส่ที่ `SelectTrigger`, `fieldProps` ที่ `Field`; `invalid` เกิดที่ select ซ่อน
 * (ไม่ bubble) จึงฟังแบบ capture บน `Field`, ค่าเปลี่ยนฟังจาก `change` ที่ Radix ส่งจาก select ซ่อน; focus ที่ trigger
 */
export function useFieldError<T extends Control>(
  ref: React.ForwardedRef<T>,
  { id, label, testId, control, error, description, props }: FieldErrorOptions<T>
) {
  const inner = useRef<T>(null)
  const field = useRef<HTMLDivElement>(null)
  useImperativeHandle<T | null, T | null>(ref, () => inner.current)
  const [nativeError, setNativeError] = useState<string | null>(null)
  const shown = error || nativeError
  const errorId = `${id}-error`
  const descriptionId = `${id}-description`
  const { title, value, onChange, onInvalid } = props ?? {}

  const recheck = (el: Validatable) =>
    setNativeError(el.validity.valid ? null : fieldErrorMessage(el.validity, { label, title, control }))

  const handleInvalid = (e: Event, el: Validatable, focusTarget: HTMLElement) => {
    e.preventDefault()
    recheck(el)
    // ช่องแรกตามลำดับ DOM: event มาถึงก่อน และ activeElement ยังไม่ใช่ช่องที่ผิดในฟอร์มเดียวกัน (trigger ของ select นับด้วย select ซ่อน)
    const active = validatable(document.activeElement)
    const activeInvalid = !!active && active !== el && !!el.form && active.form === el.form && active.matches(":invalid")
    if (!activeInvalid && document.activeElement !== focusTarget) focusTarget.focus()
  }

  // select ของ Radix: ฟังที่ Field (select ซ่อนอยู่ใน Field ข้าง trigger)
  useEffect(() => {
    const fieldEl = field.current
    if (!fieldEl) return
    const isHidden = (target: EventTarget | null) =>
      isSelectTrigger(inner.current) && target === hiddenSelectOf(inner.current)
    const onFieldInvalid = (e: Event) => {
      if (isHidden(e.target)) handleInvalid(e, e.target as HTMLSelectElement, inner.current!)
    }
    const onFieldChange = (e: Event) => {
      if (!isHidden(e.target)) return
      const el = e.target as HTMLSelectElement
      setNativeError((prev) => (prev === null || el.validity.valid ? null : prev))
    }
    fieldEl.addEventListener("invalid", onFieldInvalid, true)
    fieldEl.addEventListener("change", onFieldChange)
    return () => {
      fieldEl.removeEventListener("invalid", onFieldInvalid, true)
      fieldEl.removeEventListener("change", onFieldChange)
    }
  })

  // value จากโค้ด (เช่น เลือกที่อยู่ที่บันทึกไว้) ไม่มี event ของช่อง — ตรวจ validity ใหม่หลัง commit เมื่อมีข้อความค้าง
  useEffect(() => {
    if (nativeError !== null && validatable(inner.current)?.validity.valid) setNativeError(null)
  }, [value, nativeError])

  const describedBy =
    [props?.["aria-describedby"], description ? descriptionId : null, shown ? errorId : null].filter(Boolean).join(" ") || undefined

  return {
    fieldProps: { ref: field, "data-invalid": shown ? true : undefined },
    controlProps: {
      ref: inner,
      "aria-invalid": shown ? (true as const) : undefined,
      "aria-describedby": describedBy,
      onChange: (e: React.ChangeEvent<T>) => {
        onChange?.(e)
        const el = validatable(e.currentTarget)
        if (nativeError !== null && el) recheck(el)
      },
      onInvalid: (e: React.FormEvent<T>) => {
        onInvalid?.(e)
        const el = validatable(e.currentTarget)
        if (el) handleInvalid(e.nativeEvent, el, e.currentTarget)
      },
    },
    messages: (
      <>
        {description && (
          <FieldDescription id={descriptionId} data-testid={testId && `${testId}-description`}>
            {description}
          </FieldDescription>
        )}
        {shown && (
          <FieldError id={errorId} data-testid={testId && `${testId}-error`}>
            {shown}
          </FieldError>
        )}
      </>
    ),
  }
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string
  /** ข้อความ error ของผู้เรียก (แสดงใน FieldError แบบเดียวกับ error ของ validation) */
  error?: string
  description?: React.ReactNode
  errors?: Record<string, unknown>
  touched?: Record<string, unknown>
  name: string
  "data-testid"?: string
}

// SFUI-11a (spec 09 กฎ 28–31, 34–35; ADR-032): โครงตามตัวอย่างของ shadcn — Field → FieldLabel (เหนือช่อง) → control → FieldDescription → FieldError
// id = prop id ของผู้เรียก หรือ useId() (ไม่ใช้ name — ฟอร์มใน Dialog/checkout มีชื่อซ้ำได้); ช่องบังคับมี * แบบ aria-hidden
// ช่องรหัสผ่านใช้ InputGroup + ปุ่มแสดง/ซ่อน (`<t>-toggle`); ขนาดตาม default ของ shadcn (h-9) ไม่ override
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      type,
      name,
      label,
      id,
      required,
      className,
      error,
      description,
      errors: _errors,
      touched: _touched,
      "data-testid": testId,
      ...props
    },
    ref
  ) => {
    const autoId = useId()
    const inputId = id ?? autoId
    const [showPassword, setShowPassword] = useState(false)
    const { fieldProps, controlProps, messages } = useFieldError(ref, {
      id: inputId,
      label,
      testId,
      control: "input",
      error,
      description,
      props,
    })

    const control = { ...props, ...controlProps, id: inputId, name, required, "data-testid": testId }

    // className ของผู้เรียก = layout ภายนอก (เช่นตำแหน่งใน grid) → ที่ Field ไม่ส่งลง control (กฎ 28)
    return (
      <Field className={className} {...fieldProps}>
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
        {messages}
      </Field>
    )
  }
)

Input.displayName = "Input"

export default Input
