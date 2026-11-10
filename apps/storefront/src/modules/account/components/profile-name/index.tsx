"use client"

import React, { useEffect, useActionState } from "react";

import Input from "@modules/common/components/input"

import AccountInfo from "../account-info"
import { submitWithoutReset } from "@lib/util/submit-without-reset"
import { HttpTypes } from "@medusajs/types"
import { updateCustomer } from "@lib/data/customer"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

const ProfileName: React.FC<MyInformationProps> = ({ customer }) => {
  const [successState, setSuccessState] = React.useState(false)

  const updateCustomerName = async (
    _currentState: Record<string, unknown>,
    formData: FormData
  ) => {
    const customer = {
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
    }

    try {
      return await updateCustomer(customer)
    } catch {
      // ไม่แสดง error ดิบของ React ที่ข้อความถูกตัดใน prod (กฎข้อ 52)
      return { success: false, error: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" }
    }
  }

  const [state, formAction, isPending] = useActionState(updateCustomerName, {
    error: null as string | null,
    success: false,
  })
  const onSubmit = submitWithoutReset(formAction)

  const clearState = () => {
    setSuccessState(false)
  }

  useEffect(() => {
    setSuccessState(state.success)
  }, [state])

  return (
    <form onSubmit={onSubmit} className="w-full overflow-visible">
      <AccountInfo
        label="ชื่อ"
        currentInfo={`${customer.first_name} ${customer.last_name}`}
        isSuccess={successState}
        isError={!!state?.error}
        errorMessage={state?.error || undefined}
        clearState={clearState}
        isPending={isPending}
        data-testid="account-name-editor"
      >
        <div className="grid grid-cols-2 gap-x-4">
          <Input
            label="ชื่อ"
            name="first_name"
            required
            defaultValue={customer.first_name ?? ""}
            data-testid="first-name-input"
          />
          <Input
            label="นามสกุล"
            name="last_name"
            required
            defaultValue={customer.last_name ?? ""}
            data-testid="last-name-input"
          />
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfileName
