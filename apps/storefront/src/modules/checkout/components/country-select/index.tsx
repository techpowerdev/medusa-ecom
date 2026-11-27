import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react"

import NativeSelect, {
  NativeSelectProps,
} from "@modules/common/components/native-select"
import { HttpTypes } from "@medusajs/types"

const CountrySelect = forwardRef<
  HTMLSelectElement,
  NativeSelectProps & {
    region?: HttpTypes.StoreRegion
  }
>(({ placeholder = "เลือกประเทศ", label = "ประเทศ", region, defaultValue, ...props }, ref) => {
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
      // SFUI-11a (spec 09 กฎ 28, 35): label เหนือช่อง และสูงตาม NativeSelect (h-9 เท่า Input) — เลิก h-12
      label={label}
      defaultValue={defaultValue}
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
