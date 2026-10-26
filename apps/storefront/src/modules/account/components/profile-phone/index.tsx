"use client"

import React, { useEffect, useActionState } from "react";

import Input from "@modules/common/components/input"

import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { updateCustomer } from "@lib/data/customer"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

const ProfileEmail: React.FC<MyInformationProps> = ({ customer }) => {
  const [successState, setSuccessState] = React.useState(false)

  const updateCustomerPhone = async (
    _currentState: Record<string, unknown>,
    formData: FormData
  ) => {
    // CORE-23 (กฎข้อ 49): ช่องว่าง = ลบเบอร์ (validator ของ POST /store/customers/me รับ phone เป็น null ได้)
    const phone = ((formData.get("phone") as string | null) ?? "").trim()

    try {
      return await updateCustomer({ phone: phone || null })
    } catch {
      // network ล้ม/server action error ที่ข้อความถูกตัดใน prod — ไม่แสดง error ดิบของ React (กฎข้อ 52)
      return { success: false, error: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }
    }
  }

  const [state, formAction] = useActionState(updateCustomerPhone, {
    error: null as string | null,
    success: false,
  })

  const clearState = () => {
    setSuccessState(false)
  }

  useEffect(() => {
    setSuccessState(state.success)
  }, [state])

  return (
    <form action={formAction} className="w-full">
      <AccountInfo
        label="เบอร์โทรศัพท์"
        currentInfo={customer.phone || "ยังไม่ได้ระบุ"}
        isSuccess={successState}
        isError={!!state.error}
        errorMessage={state.error || undefined}
        clearState={clearState}
        data-testid="account-phone-editor"
      >
        <div className="grid grid-cols-1 gap-y-2">
          <Input
            label="เบอร์โทรศัพท์"
            name="phone"
            type="phone"
            autoComplete="phone"
            defaultValue={customer.phone ?? ""}
            data-testid="phone-input"
          />
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfileEmail
