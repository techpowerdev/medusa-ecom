"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMemo } from "react"
import ReactCountryFlag from "react-country-flag"

import { StateType } from "@lib/hooks/use-toggle-state"
import { useParams, usePathname } from "next/navigation"
import { updateRegion } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"

type CountryOption = {
  country: string
  region: string
  label: string
}

type CountrySelectProps = {
  toggleState: StateType
  regions: HttpTypes.StoreRegion[]
}

const Flag = ({ country }: { country: string }) => (
  <ReactCountryFlag
    svg
    style={{
      width: "16px",
      height: "16px",
    }}
    countryCode={country}
  />
)

// SFUI-3c (spec 09 กฎ 4, 12): Listbox ของ headless → Select ของ shadcn (Radix)
// เปิดด้วยคลิก/Enter/Space/ArrowDown ตาม Select — ไม่ผูกการเปิดกับ hover ของ side menu อีกต่อไป
// (Select ของ Radix ปิด pointer event นอกรายการขณะเปิด จึงเปิด/ปิดตาม hover แล้วกระพริบ); `toggleState` เป็นสถานะเปิดของ Select (SFUI-3b) ให้ลูกศรของ side menu
const CountrySelect = ({ toggleState, regions }: CountrySelectProps) => {
  const { countryCode } = useParams()
  const currentPath = usePathname().split(`/${countryCode}`)[1]

  const { state, open, close } = toggleState

  const options = useMemo(() => {
    return regions
      ?.map((r) => {
        return r.countries?.map((c) => ({
          country: c.iso_2 ?? "",
          region: r.id,
          label: c.display_name ?? "",
        }))
      })
      .flat()
      .filter((o): o is CountryOption => !!o)
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [regions])

  const current = countryCode
    ? options?.find((o) => o.country === countryCode)
    : undefined

  const handleChange = (country: string) => {
    updateRegion(country, currentPath)
    close()
  }

  return (
    <div>
      {/* SFUI-3b: สถานะเปิดของ Select = toggleState → ลูกศรของ side menu สะท้อนสถานะจริง (เปิดด้วยคลิก/คีย์บอร์ด) */}
      <Select
        value={current?.country ?? ""}
        onValueChange={handleChange}
        open={state}
        onOpenChange={(next) => (next ? open() : close())}
      >
        <SelectTrigger
          // SFUI-3c: side menu มีลูกศรของตัวเองแล้ว → ซ่อน chevron ของ SelectTrigger
          // SFUI-20c (spec 09 กฎ 72, 75): ไม่มี className ขนาด (h-*/p*/text-*/leading-*) — ขนาด default ของ shadcn
          className="w-full border-0 bg-transparent text-inherit shadow-none [&>svg]:hidden"
          data-testid="country-select-button"
        >
          <div className="flex items-start gap-x-2">
            <span>จัดส่งไปที่:</span>
            <SelectValue>
              {current && (
                <span className="text-sm leading-5 flex items-center gap-x-2">
                  <Flag country={current.country} />
                  {current.label}
                </span>
              )}
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent className="max-h-[442px] text-xs leading-5 font-normal uppercase">
          {options?.map((o) => (
            <SelectItem
              key={o.country}
              value={o.country}
              className="py-2 pl-3 pr-8 cursor-pointer gap-x-2"
            >
              <Flag country={o.country} /> {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default CountrySelect
