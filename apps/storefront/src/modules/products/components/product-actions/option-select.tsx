import { HttpTypes } from "@medusajs/types"
import { cn } from "@/lib/utils"
import React from "react"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  name: string
  disabled: boolean
  "data-testid"?: string
}

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  name,
  "data-testid": dataTestId,
  disabled,
}) => {
  const filteredOptions = (option.values ?? []).map((v) => v.value)

  return (
    <fieldset className="flex flex-col gap-y-3" disabled={disabled}>
      <legend className="text-sm mb-3">เลือก {title}</legend>
      <div
        className="flex flex-wrap justify-between gap-2"
        data-testid={dataTestId}
      >
        {filteredOptions.map((v) => {
          const id = `${name}-${v}`.replace(/[^A-Za-z0-9_-]/g, "-")
          return (
            <div key={v} className="flex-1">
              <input
                type="radio"
                id={id}
                name={name}
                value={v}
                checked={v === current}
                onChange={() => updateOption(option.id, v)}
                className="peer sr-only"
              />
              {/* SFUI-6: ring ตอน focus ระบุสี ring-ring/50 ของ shadcn (เดิมไม่ระบุสี = blue-500/50 ของ v3 ผ่าน --default-ring-color ที่ลบพร้อมชั้นเข้ากันได้) */}
              <label
                htmlFor={id}
                className={cn(
                  "flex items-center justify-center cursor-pointer border-border bg-muted border text-xs leading-5 font-normal h-10 rounded-rounded p-2 peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50 peer-focus-visible:ring-offset-1 peer-disabled:cursor-not-allowed",
                  {
                    "border-primary": v === current,
                    "hover:shadow-sm transition-shadow ease-in-out duration-150":
                      v !== current,
                  }
                )}
                data-testid="option-button"
              >
                {v}
              </label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

export default OptionSelect
