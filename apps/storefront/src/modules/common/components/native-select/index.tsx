import { Field, FieldLabel } from "@/components/ui/field"
import { cn } from "@/lib/utils"
import { useFieldError } from "@modules/common/components/input"
import { ChevronDownIcon } from "lucide-react"
import React, { SelectHTMLAttributes, forwardRef, useId } from "react"

export type NativeSelectProps = {
  /** ข้อความของ option ว่าง disabled; `false` = ไม่ render option ว่าง (กฎ 31a) */
  placeholder?: string | false
  label?: string
  /** ข้อความ error ของผู้เรียก (SFUI-11b กฎ 32d) */
  error?: string
  description?: React.ReactNode
  errors?: Record<string, unknown>
  touched?: Record<string, unknown>
  "data-testid"?: string
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "placeholder">

// SFUI-11a (spec 09 กฎ 28, 31a, 35; ADR-032) + SFUI-11b (กฎ 32: error ระดับช่องผ่าน useFieldError): <select> native (กฎ 4) ด้วย class ตาม registry `native-select` ของ shadcn 4.23.1
// (h-9 สูงเท่า Input) — มี `label` → ห่อด้วย Field + FieldLabel เหนือช่อง; className ของผู้เรียกไปที่ wrapper (layout เท่านั้น)
const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    { placeholder = "เลือก...", label, id, required, className, children, error, description, errors: _errors, touched: _touched, ...props },
    ref
  ) => {
    const autoId = useId()
    const selectId = id ?? autoId
    const testId = props["data-testid"]
    const { fieldProps, controlProps, messages } = useFieldError(ref, {
      id: selectId,
      label: label ?? "",
      testId,
      control: "select",
      error,
      description,
      props,
    })

    const select = (
      <div
        data-slot="native-select-wrapper"
        className={cn("group/native-select relative w-full has-[select:disabled]:opacity-50", !label && className)}
      >
        <select
          id={selectId}
          required={required}
          data-slot="native-select"
          className={cn(
            "h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent px-3 py-2 pr-9 text-sm shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed dark:bg-input/30 dark:hover:bg-input/50",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40"
          )}
          {...props}
          {...controlProps}
        >
          {placeholder !== false && (
            <option disabled value="">
              {placeholder}
            </option>
          )}
          {children}
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          data-slot="native-select-icon"
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground opacity-50 select-none"
        />
      </div>
    )

    if (!label) {
      return (
        <>
          {select}
          {messages}
        </>
      )
    }

    // มี label → className ของผู้เรียก (layout) อยู่ที่ Field; ไม่มี label → อยู่ที่ wrapper ของ select (กฎ 28)
    return (
      <Field className={className} {...fieldProps}>
        <FieldLabel htmlFor={selectId} data-testid={testId && `${testId}-label`}>
          {label}
          {required && (
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          )}
        </FieldLabel>
        {select}
        {messages}
      </Field>
    )
  }
)

NativeSelect.displayName = "NativeSelect"

export default NativeSelect
