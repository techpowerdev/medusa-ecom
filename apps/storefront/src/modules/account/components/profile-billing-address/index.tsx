"use client"

import React, { useActionState, useEffect, useMemo } from "react"

import Input from "@modules/common/components/input"
import { ADDRESS_COUNTRY_CODE } from "@lib/util/address-required"

import { addCustomerAddress, updateCustomerAddress } from "@lib/data/customer"
import { HttpTypes } from "@medusajs/types"
import AccountInfo from "../account-info"
import { submitWithoutReset } from "@lib/util/submit-without-reset"
import { addressLines } from "@lib/util/address-lines"
import { withActionFallback } from "@lib/util/action-fallback"

// CORE-23c (กฎข้อ 74b): action ล้มระดับ network/5xx → error ไทยในฟอร์ม ไม่ใช่หน้า "This page couldn't load"
const addBillingAddress = withActionFallback(addCustomerAddress)
const updateBillingAddress = withActionFallback(updateCustomerAddress)

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
  regions: HttpTypes.StoreRegion[]
}

// SFUI-20c (spec 09 กฎ 71): สรุปไม่มีบรรทัดประเทศ — `regions` ไม่ถูกใช้แล้ว (คง prop ของผู้เรียก)
const ProfileBillingAddress: React.FC<MyInformationProps> = ({ customer }) => {

  const [successState, setSuccessState] = React.useState(false)

  const billingAddress = customer.addresses?.find(
    (addr) => addr.is_default_billing
  )

  const initialState: Record<string, unknown> = {
    isDefaultBilling: true,
    isDefaultShipping: false,
    error: false,
    success: false,
  }

  if (billingAddress) {
    initialState.addressId = billingAddress.id
  }

  // CORE-23c: ผลที่ล้มไม่มี isDefaultBilling/addressId — เติมจาก initialState ให้กดบันทึกซ้ำยังเป็นที่อยู่ใบเสร็จ
  const [state, formAction, isPending] = useActionState(
    (current: Record<string, unknown>, formData: FormData) =>
      (billingAddress ? updateBillingAddress : addBillingAddress)(
        { ...initialState, ...current, isDefaultBilling: true },
        formData
      ),
    initialState
  )
  const onSubmit = submitWithoutReset(formAction)

  const clearState = () => {
    setSuccessState(false)
  }

  useEffect(() => {
    setSuccessState(!!state.success)
  }, [state])

  const currentInfo = useMemo(() => {
    if (!billingAddress) {
      return "ยังไม่มีที่อยู่สำหรับออกใบเสร็จ"
    }

    return (
      <div className="flex flex-col font-semibold" data-testid="current-info">
        <span>
          {billingAddress.first_name} {billingAddress.last_name}
        </span>
        <span>{billingAddress.company}</span>
        {/* SFUI-18a (spec 09 กฎ 57): บรรทัดที่อยู่ตามลำดับไทย; SFUI-20c (กฎ 71): ไม่มีบรรทัดประเทศ */}
        <span>{addressLines(billingAddress)[0]}</span>
      </div>
    )
  }, [billingAddress])

  return (
    <form onSubmit={onSubmit} onReset={() => clearState()} className="w-full">
      <input type="hidden" name="addressId" value={billingAddress?.id} />
      <AccountInfo
        label="ที่อยู่สำหรับออกใบเสร็จ"
        currentInfo={currentInfo}
        isSuccess={successState}
        isError={!!state.error}
        errorMessage={typeof state.error === "string" ? state.error : undefined}
        clearState={clearState}
        isPending={isPending}
        data-testid="account-billing-address-editor"
      >
        <div className="grid grid-cols-1 gap-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input
              label="ชื่อ"
              name="first_name"
              defaultValue={billingAddress?.first_name || undefined}
              required
              data-testid="billing-first-name-input"
            />
            <Input
              label="นามสกุล"
              name="last_name"
              defaultValue={billingAddress?.last_name || undefined}
              required
              data-testid="billing-last-name-input"
            />
          </div>
          <Input
            label="บริษัท"
            name="company"
            defaultValue={billingAddress?.company || undefined}
            data-testid="billing-company-input"
          />
          <Input
            label="บ้านเลขที่ หมู่ ซอย ถนน"
            name="address_1"
            autoComplete="address-line1"
            placeholder="เช่น 99/1 หมู่ 2 ซ.สุขุมวิท 3 ถ.สุขุมวิท"
            defaultValue={billingAddress?.address_1 || undefined}
            required
            data-testid="billing-address-1-input"
          />
          {/* SFUI-18b (spec 09 กฎ 53–54): ตำบล/แขวง–เขต/อำเภอ และ จังหวัด–รหัสไปรษณีย์ แถวเดียวกันที่ ≥ 768px; ประเทศ/เบอร์โทรศัพท์แถวละช่อง */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input
              label="ตำบล/แขวง"
              name="address_2"
              required
              autoComplete="address-level3"
              defaultValue={billingAddress?.address_2 || undefined}
              data-testid="billing-address-2-input"
            />
            <Input
              label="เขต/อำเภอ"
              name="city"
              defaultValue={billingAddress?.city || undefined}
              required
              data-testid="billing-city-input"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input
              label="จังหวัด"
              name="province"
              defaultValue={billingAddress?.province || undefined}
              required
              data-testid="billing-province-input"
            />
            <Input
              label="รหัสไปรษณีย์"
              name="postal_code"
              defaultValue={billingAddress?.postal_code || undefined}
              required
              placeholder="เช่น 10110"
              data-testid="billing-postcal-code-input"
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
            required
            defaultValue={billingAddress?.phone ?? customer?.phone ?? ""}
            data-testid="billing-phone-input"
          />
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfileBillingAddress
