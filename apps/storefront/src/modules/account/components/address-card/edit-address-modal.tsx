"use client"

import {
  deleteCustomerAddress,
  updateCustomerAddress,
} from "@lib/data/customer"
import useToggleState from "@lib/hooks/use-toggle-state"
import { withActionFallback } from "@lib/util/action-fallback"
import { addressLines } from "@lib/util/address-lines"
import { submitWithoutReset } from "@lib/util/submit-without-reset"
import { HttpTypes } from "@medusajs/types"
import { ADDRESS_COUNTRY_CODE } from "@lib/util/address-required"
import Input from "@modules/common/components/input"
import Spinner from "@modules/common/icons/spinner"
import { SquarePen, Trash2, X } from "lucide-react"
import React, { useActionState, useEffect, useState } from "react"

import { Button } from "@/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type EditAddressProps = {
  region: HttpTypes.StoreRegion
  address: HttpTypes.StoreCustomerAddress
  isActive?: boolean
}

// CORE-23c (กฎข้อ 74a): action ล้ม (5xx/network) → error ไทยในฟอร์ม ไม่ใช่หน้า error ทั้งหน้า
const saveAddress = withActionFallback(updateCustomerAddress)

// SFUI-20b (spec 09 กฎ 70): ไม่มีช่องประเทศแล้ว — `region` ไม่ถูกใช้ (คง prop ของผู้เรียก address-book)
const EditAddress: React.FC<EditAddressProps> = ({
  address,
  isActive = false,
}) => {
  const [removing, setRemoving] = useState(false)
  const [successState, setSuccessState] = useState(false)
  const { state, open, close: closeModal } = useToggleState(false)

  const [formState, formAction, isPending] = useActionState(saveAddress, {
    success: false,
    error: null,
  } as { success: boolean; error: string | null })
  // CORE-23c (กฎข้อ 74a): onSubmit แทน `action` — React 19 reset ฟอร์มหลัง action แม้บันทึกล้ม (ค่าที่พิมพ์หาย)
  const onSubmit = submitWithoutReset(formAction)

  const close = () => {
    setSuccessState(false)
    closeModal()
  }

  useEffect(() => {
    if (successState) {
      close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successState])

  useEffect(() => {
    if (formState.success) {
      setSuccessState(true)
    }
  }, [formState])

  const removeAddress = async () => {
    setRemoving(true)
    await deleteCustomerAddress(address.id)
    setRemoving(false)
  }

  const [line, country] = addressLines(address)

  return (
    // SFUI-3a (spec 09 กฎ 4, 11): modal ที่อยู่ → Dialog ของ shadcn (Radix) — ปุ่มแก้ไขเป็น DialogTrigger (focus กลับเมื่อปิด)
    <Dialog open={state} onOpenChange={(next) => (next ? open() : close())}>
      <div
        className={cn(
          "border rounded-rounded p-5 min-h-[220px] h-full w-full flex flex-col justify-between transition-colors",
          {
            "border-gray-900": isActive,
          }
        )}
        data-testid="address-container"
      >
        <div className="flex flex-col">
          {/* SFUI-6 (กฎ 21): เดิม <Heading> h2 + utility 14px/24px/600 ของ starter — บน develop text-2xl/font-semibold ของ shim ชนะ (utility ของ starter อยู่ @layer components) → 24px/32px/600 */}
          <h2 className="text-left text-2xl font-semibold" data-testid="address-name">
            {address.first_name} {address.last_name}
          </h2>
          {address.company && (
            <p
              className="text-sm leading-5 text-foreground"
              data-testid="address-company"
            >
              {address.company}
            </p>
          )}
          {/* SFUI-18a (spec 09 กฎ 57): บรรทัดที่อยู่ตามลำดับไทย (address-address) + บรรทัดประเทศ (address-province-country);
              testid เดิม address-postal-city (baseline กฎ 10) อยู่ที่กล่องของสองบรรทัด */}
          <p className="flex flex-col text-left text-sm leading-6 font-normal mt-2" data-testid="address-postal-city">
            <span data-testid="address-address">{line}</span>
            <span data-testid="address-province-country">{country}</span>
          </p>
        </div>
        <div className="flex items-center gap-x-4">
          <DialogTrigger asChild>
            <Button variant="ghost" data-testid="address-edit-button">
              <SquarePen />
              แก้ไข
            </Button>
          </DialogTrigger>
          <Button variant="ghost" onClick={removeAddress} data-testid="address-delete-button">
            {removing ? <Spinner /> : <Trash2 />}
            ลบ
          </Button>
        </div>
      </div>

      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        data-testid="edit-address-modal"
      >
        <div className="flex items-center justify-between">
          <DialogTitle className="text-2xl font-semibold">แก้ไขที่อยู่</DialogTitle>
          <DialogClose
            className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label="ปิด"
            data-testid="close-modal-button"
          >
            <X className="size-5" />
          </DialogClose>
        </div>
        <DialogDescription className="sr-only">
          แก้ไขข้อมูลที่อยู่แล้วกดบันทึก
        </DialogDescription>
        <form onSubmit={onSubmit}>
          <input type="hidden" name="addressId" value={address.id} />
          <div className="grid grid-cols-1 gap-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                label="ชื่อ"
                name="first_name"
                required
                autoComplete="given-name"
                defaultValue={address.first_name || undefined}
                data-testid="first-name-input"
              />
              <Input
                label="นามสกุล"
                name="last_name"
                required
                autoComplete="family-name"
                defaultValue={address.last_name || undefined}
                data-testid="last-name-input"
              />
            </div>
            <Input
              label="บริษัท"
              name="company"
              autoComplete="organization"
              defaultValue={address.company || undefined}
              data-testid="company-input"
            />
            <Input
              label="บ้านเลขที่ หมู่ ซอย ถนน"
              name="address_1"
              required
              autoComplete="address-line1"
              placeholder="เช่น 99/1 หมู่ 2 ซ.สุขุมวิท 3 ถ.สุขุมวิท"
              defaultValue={address.address_1 || undefined}
              data-testid="address-1-input"
            />
            {/* SFUI-18b (spec 09 กฎ 53–54): ตำบล/แขวง–เขต/อำเภอ และ จังหวัด–รหัสไปรษณีย์ แถวเดียวกันที่ ≥ 768px */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                label="ตำบล/แขวง"
                name="address_2"
                required
                autoComplete="address-level3"
                defaultValue={address.address_2 || undefined}
                data-testid="address-2-input"
              />
              <Input
                label="เขต/อำเภอ"
                name="city"
                required
                autoComplete="locality"
                defaultValue={address.city || undefined}
                data-testid="city-input"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                label="จังหวัด"
                name="province"
                autoComplete="address-level1"
                defaultValue={address.province || undefined}
                required
                data-testid="state-input"
              />
              <Input
                label="รหัสไปรษณีย์"
                name="postal_code"
                required
                autoComplete="postal-code"
                placeholder="เช่น 10110"
                defaultValue={address.postal_code || undefined}
                data-testid="postal-code-input"
              />
            </div>
            {/* SFUI-20b (spec 09 กฎ 70 — ADR-034 D5): ไม่ render ช่องประเทศ ส่งค่าคงที่ */}
            <input type="hidden" name="country_code" value={ADDRESS_COUNTRY_CODE} />
            <Input
              label="เบอร์โทรศัพท์"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="เช่น 0812345678"
              defaultValue={address.phone || undefined}
              data-testid="phone-input"
            />
          </div>
          {formState.error && (
            <div
              className="text-rose-500 text-xs leading-5 font-normal py-2"
              data-testid="address-error"
            >
              {formState.error}
            </div>
          )}
          <DialogFooter className="mt-6">
            <Button
              type="reset"
              variant="outline"
              onClick={close}
              data-testid="cancel-button"
            >
              ยกเลิก
            </Button>
            <Button type="submit" isLoading={isPending} data-testid="save-button">
              บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default EditAddress
