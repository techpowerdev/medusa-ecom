"use client"

import ErrorMessage from "@modules/checkout/components/error-message"
import { Plus, X } from "lucide-react"
import { useActionState, useEffect, useState } from "react"

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

import { addCustomerAddress } from "@lib/data/customer"
import useToggleState from "@lib/hooks/use-toggle-state"
import { withActionFallback } from "@lib/util/action-fallback"
import { submitWithoutReset } from "@lib/util/submit-without-reset"
import { ADDRESS_COUNTRY_CODE } from "@lib/util/address-required"
import Input from "@modules/common/components/input"

// CORE-23c (กฎข้อ 74a): action ล้ม (5xx/network) → error ไทยในฟอร์ม ไม่ใช่หน้า error ทั้งหน้า
const saveAddress = withActionFallback(addCustomerAddress)

// SFUI-20b (spec 09 กฎ 70): ไม่มีช่องประเทศแล้ว — ไม่รับ `region`/`addresses` (nit review 20b — ลบใน 20c)
const AddAddress = () => {
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

  return (
    // SFUI-3a (spec 09 กฎ 4, 11): modal ที่อยู่ → Dialog ของ shadcn (Radix) — Escape/คลิกนอก dialog ปิดผ่าน onOpenChange
    // ปุ่มเปิดเป็น DialogTrigger (focus กลับปุ่มเมื่อปิด) และใช้ปุ่มปิดของเราเพื่อคง testid `close-modal-button`
    <Dialog open={state} onOpenChange={(next) => (next ? open() : close())}>
      <DialogTrigger asChild>
        <button
          className="border border-border rounded-rounded p-5 min-h-[220px] h-full w-full flex flex-col justify-between"
          data-testid="add-address-button"
        >
          <span className="text-sm leading-6 font-semibold">เพิ่มที่อยู่ใหม่</span>
          <Plus className="size-4" />
        </button>
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        data-testid="add-address-modal"
      >
        <div className="flex items-center justify-between">
          <DialogTitle className="text-2xl font-semibold">เพิ่มที่อยู่</DialogTitle>
          {/* SFUI-21a (spec 09 กฎ 76): ปุ่มปิด = Close asChild → Button ghost icon ขนาด default ของ shadcn (icon X size-4) */}
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="ปิด" data-testid="close-modal-button">
              <X />
            </Button>
          </DialogClose>
        </div>
        <DialogDescription className="sr-only">
          กรอกข้อมูลที่อยู่ใหม่แล้วกดบันทึก
        </DialogDescription>
        <form onSubmit={onSubmit}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="ชื่อ"
                name="first_name"
                required
                autoComplete="given-name"
                data-testid="first-name-input"
              />
              <Input
                label="นามสกุล"
                name="last_name"
                required
                autoComplete="family-name"
                data-testid="last-name-input"
              />
            </div>
            <Input
              label="บริษัท"
              name="company"
              autoComplete="organization"
              data-testid="company-input"
            />
            <Input
              label="บ้านเลขที่ หมู่ ซอย ถนน"
              name="address_1"
              required
              autoComplete="address-line1"
              placeholder="เช่น 99/1 หมู่ 2 ซ.สุขุมวิท 3 ถ.สุขุมวิท"
              data-testid="address-1-input"
            />
            {/* SFUI-18b (spec 09 กฎ 53–54): ตำบล/แขวง–เขต/อำเภอ และ จังหวัด–รหัสไปรษณีย์ แถวเดียวกันที่ ≥ 768px */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="ตำบล/แขวง"
                name="address_2"
                required
                autoComplete="address-level3"
                data-testid="address-2-input"
              />
              <Input
                label="เขต/อำเภอ"
                name="city"
                required
                autoComplete="locality"
                data-testid="city-input"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="จังหวัด"
                name="province"
                autoComplete="address-level1"
                required
                data-testid="state-input"
              />
              <Input
                label="รหัสไปรษณีย์"
                name="postal_code"
                required
                autoComplete="postal-code"
                placeholder="เช่น 10110"
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
              data-testid="phone-input"
            />
          </div>
          {/* SFUI-21d (spec 09 กฎ 74 (a)): error ของฟอร์ม = Alert ผ่าน ErrorMessage */}
          <ErrorMessage error={formState.error} data-testid="address-error" />
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

export default AddAddress
