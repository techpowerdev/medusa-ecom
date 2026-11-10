"use client"

import { Plus } from "@medusajs/icons"
import { Button, Heading } from "@modules/common/components/ui"
import { useActionState, useEffect, useState } from "react"

import { addCustomerAddress } from "@lib/data/customer"
import useToggleState from "@lib/hooks/use-toggle-state"
import { HttpTypes } from "@medusajs/types"
import { withActionFallback } from "@lib/util/action-fallback"
import { submitWithoutReset } from "@lib/util/submit-without-reset"
import CountrySelect from "@modules/checkout/components/country-select"
import Input from "@modules/common/components/input"
import Modal from "@modules/common/components/modal"

// CORE-23c (กฎข้อ 74a): action ล้ม (5xx/network) → error ไทยในฟอร์ม ไม่ใช่หน้า error ทั้งหน้า
const saveAddress = withActionFallback(addCustomerAddress)

const AddAddress = ({
  region,
}: {
  region: HttpTypes.StoreRegion
  addresses: HttpTypes.StoreCustomerAddress[]
}) => {
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
    <>
      <button
        className="border border-ui-border-base rounded-rounded p-5 min-h-[220px] h-full w-full flex flex-col justify-between"
        onClick={open}
        data-testid="add-address-button"
      >
        <span className="text-base-semi">เพิ่มที่อยู่ใหม่</span>
        <Plus />
      </button>

      <Modal isOpen={state} close={close} data-testid="add-address-modal">
        <Modal.Title>
          <Heading className="mb-2">เพิ่มที่อยู่</Heading>
        </Modal.Title>
        <form onSubmit={onSubmit}>
          <Modal.Body>
            <div className="flex flex-col gap-y-2">
              <div className="grid grid-cols-2 gap-x-2">
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
                label="ที่อยู่"
                name="address_1"
                required
                autoComplete="address-line1"
                data-testid="address-1-input"
              />
              <Input
                label="อาคาร ห้อง ฯลฯ"
                name="address_2"
                autoComplete="address-line2"
                data-testid="address-2-input"
              />
              <div className="grid grid-cols-[144px_1fr] gap-x-2">
                <Input
                  label="รหัสไปรษณีย์"
                  name="postal_code"
                  required
                  autoComplete="postal-code"
                  data-testid="postal-code-input"
                />
                <Input
                  label="เขต/อำเภอ"
                  name="city"
                  required
                  autoComplete="locality"
                  data-testid="city-input"
                />
              </div>
              <Input
                label="จังหวัด"
                name="province"
                autoComplete="address-level1"
                data-testid="state-input"
              />
              <CountrySelect
                region={region}
                name="country_code"
                required
                autoComplete="country"
                data-testid="country-select"
              />
              <Input
                label="เบอร์โทรศัพท์"
                name="phone"
                autoComplete="phone"
                data-testid="phone-input"
              />
            </div>
          </Modal.Body>
          {/* CORE-23c: Modal.Body เป็น flex แถว — error อยู่ใต้ฟอร์มไม่ใช่ข้างช่อง */}
          {formState.error && (
            <div
              className="text-rose-500 text-small-regular py-2"
              data-testid="address-error"
            >
              {formState.error}
            </div>
          )}
          <Modal.Footer>
            <div className="flex gap-3 mt-6">
              <Button
                type="reset"
                variant="secondary"
                onClick={close}
                className="h-10"
                data-testid="cancel-button"
              >
                ยกเลิก
              </Button>
              <Button type="submit" isLoading={isPending} data-testid="save-button">
                บันทึก
              </Button>
            </div>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  )
}

export default AddAddress
