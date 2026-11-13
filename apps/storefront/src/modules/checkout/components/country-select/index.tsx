import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react"

import NativeSelect, {
  NativeSelectProps,
} from "@modules/common/components/native-select"
import { HttpTypes } from "@medusajs/types"
import { clx } from "@modules/common/components/ui"

const CountrySelect = forwardRef<
  HTMLSelectElement,
  NativeSelectProps & {
    region?: HttpTypes.StoreRegion
  }
>(({ placeholder = "เลือกประเทศ", region, defaultValue, className, ...props }, ref) => {
  const innerRef = useRef<HTMLSelectElement>(null)

  useImperativeHandle<HTMLSelectElement | null, HTMLSelectElement | null>(
    ref,
    () => innerRef.current
  )

  const countryOptions = useMemo(() => {
    if (!region) {
      return []
    }

    return region.countries?.map((country) => ({
      value: country.iso_2,
      label: country.display_name,
    }))
  }, [region])

  // CORE-52 (กฎข้อ 110d): React 19 reset `<form action>` หลัง action คืนผล (เช่น setAddresses คืน error) — reset ของ
  // browser เลือก option ตาม `defaultSelected` ไม่ใช่ `value` ที่ React ควบคุม จึงตั้ง defaultSelected ให้ตรงค่าปัจจุบัน
  const { value } = props
  useLayoutEffect(() => {
    if (value === undefined || !innerRef.current) return
    for (const option of Array.from(innerRef.current.options)) {
      option.defaultSelected = option.value === String(value)
    }
  }, [value, countryOptions])

  return (
    <NativeSelect
      ref={innerRef}
      placeholder={placeholder}
      defaultValue={defaultValue}
      // CORE-4g (กฎข้อ 63d): สูงเท่า Input (h-12) ในแถวเดียวกัน
      className={clx("h-12", className)}
      {...props}
    >
      {countryOptions?.map(({ value, label }, index) => (
        <option key={index} value={value}>
          {label}
        </option>
      ))}
    </NativeSelect>
  )
})

CountrySelect.displayName = "CountrySelect"

export default CountrySelect
