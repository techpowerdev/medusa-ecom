import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useMemo } from "react"

import { addressLines } from "@lib/util/address-lines"
import compareAddresses from "@lib/util/compare-addresses"
import { HttpTypes } from "@medusajs/types"

type AddressSelectProps = {
  addresses: HttpTypes.StoreCustomerAddress[]
  addressInput: HttpTypes.StoreCartAddress | null
  onSelect: (
    address: HttpTypes.StoreCartAddress | undefined,
    email?: string
  ) => void
}

// SFUI-3c (spec 09 กฎ 4, 9, 12): Listbox ของ headless → Select ของ shadcn (Radix) — testid เดิมอยู่ที่ SelectTrigger/SelectContent/SelectItem
const AddressSelect = ({
  addresses,
  addressInput,
  onSelect,
}: AddressSelectProps) => {
  const handleSelect = (id: string) => {
    const savedAddress = addresses.find((a) => a.id === id)
    if (savedAddress) {
      onSelect(savedAddress as HttpTypes.StoreCartAddress)
    }
  }

  const selectedAddress = useMemo(() => {
    return addresses.find((a) => addressInput && compareAddresses(a, addressInput))
  }, [addresses, addressInput])

  return (
    // value "" = ยังไม่เลือก (แสดง placeholder) — คง controlled ตลอดแม้ที่อยู่ในฟอร์มไม่ตรงกับที่บันทึกไว้
    <Select onValueChange={handleSelect} value={selectedAddress?.id ?? ""}>
      {/* SFUI-20b (spec 09 กฎ 75 — inventory 34 ย้ายจาก 21a): SelectTrigger ขนาด default ของ shadcn (ไม่มี className ขนาด) */}
      <SelectTrigger className="w-full" data-testid="shipping-address-select">
        {/* ปุ่มแสดงเฉพาะบรรทัดที่อยู่ (ไม่ใช่เนื้อหาทั้งรายการ) ตามเดิม */}
        <SelectValue placeholder="เลือกที่อยู่">
          {selectedAddress?.address_1}
        </SelectValue>
      </SelectTrigger>
      {/* SFUI-20b (AC-49 มือถือ): popper ของ Radix กว้างตามเนื้อหาจนล้นจอ 390px (ที่อยู่ยาวไม่ตัดบรรทัด) → ให้กล่องกว้างเท่า trigger
          ด้วยตัวแปร `--radix-select-trigger-width` ที่ Radix ตั้งให้ (แบบเดียวกับ Viewport ของ ui/select) ข้อความในรายการจึงตัดบรรทัดภายในจอ */}
      <SelectContent
        position="popper"
        className="max-h-60 w-(--radix-select-trigger-width) text-xs leading-5 font-normal"
        data-testid="shipping-address-options"
      >
        {addresses.map((address) => {
          const checked = selectedAddress?.id === address.id
          return (
            <SelectItem
              key={address.id}
              value={address.id}
              className="items-start pl-6 pr-10 py-4"
              data-testid="shipping-address-option"
            >
              <div className="flex gap-x-4 items-start">
                {/* วงกลมบอกสถานะ (ตกแต่ง) — ไม่ใช่ปุ่ม role="radio" ซ้อนใน option */}
                <span
                  aria-hidden
                  data-state={checked ? "checked" : "unchecked"}
                  className={cn(
                    "mt-0.5 flex size-[14px] shrink-0 items-center justify-center rounded-full border border-input",
                    checked && "border-primary bg-primary"
                  )}
                  data-testid="shipping-address-radio"
                >
                  {checked && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                </span>
                <div className="flex flex-col">
                  <span className="text-left text-sm leading-6 font-semibold">
                    {address.first_name} {address.last_name}
                  </span>
                  {address.company && (
                    <span className="text-xs leading-5 font-normal text-foreground">
                      {address.company}
                    </span>
                  )}
                  <div className="flex flex-col text-left text-sm leading-6 font-normal mt-2">
                    {/* SFUI-18a (spec 09 กฎ 57): ที่อยู่ตามลำดับไทย + บรรทัดประเทศ */}
                    {addressLines(address).map((line, i) => (
                      <span key={i}>{line}</span>
                    ))}
                  </div>
                </div>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

export default AddressSelect
