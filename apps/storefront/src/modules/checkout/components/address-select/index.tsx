import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useMemo } from "react"

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
      <SelectTrigger
        className="w-full data-[size=default]:h-auto px-4 py-[10px] text-left bg-background text-sm leading-6 font-normal"
        data-testid="shipping-address-select"
      >
        {/* ปุ่มแสดงเฉพาะบรรทัดที่อยู่ (ไม่ใช่เนื้อหาทั้งรายการ) ตามเดิม */}
        <SelectValue placeholder="เลือกที่อยู่">
          {selectedAddress?.address_1}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        position="popper"
        className="max-h-60 text-xs leading-5 font-normal"
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
                  <span className="text-left text-base-semi">
                    {address.first_name} {address.last_name}
                  </span>
                  {address.company && (
                    <span className="text-small-regular text-foreground">
                      {address.company}
                    </span>
                  )}
                  <div className="flex flex-col text-left text-base-regular mt-2">
                    <span>
                      {address.address_1}
                      {address.address_2 && (
                        <span>, {address.address_2}</span>
                      )}
                    </span>
                    <span>
                      {address.postal_code}, {address.city}
                    </span>
                    <span>
                      {address.province && `${address.province}, `}
                      {address.country_code?.toUpperCase()}
                    </span>
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
