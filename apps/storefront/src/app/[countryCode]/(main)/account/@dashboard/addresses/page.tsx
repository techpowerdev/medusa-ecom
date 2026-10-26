import { Metadata } from "next"
import { notFound } from "next/navigation"

import AddressBook from "@modules/account/components/address-book"

import { getRegion } from "@lib/data/regions"
import { retrieveCustomer } from "@lib/data/customer"

export const metadata: Metadata = {
  title: "ที่อยู่",
  description: "ดูที่อยู่ของคุณ",
}

export default async function Addresses(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params
  const { countryCode } = params
  const customer = await retrieveCustomer()
  const region = await getRegion(countryCode)

  if (!customer || !region) {
    notFound()
  }

  return (
    <div className="w-full" data-testid="addresses-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4" data-testid="account-page-header">
        <h1 className="text-2xl-semi">ที่อยู่สำหรับจัดส่ง</h1>
        <p className="text-base-regular">
          ดูและแก้ไขที่อยู่สำหรับจัดส่ง เพิ่มได้ไม่จำกัด ที่อยู่ที่บันทึกไว้จะเลือกใช้ได้ตอนชำระเงิน
        </p>
      </div>
      <AddressBook customer={customer} region={region} />
    </div>
  )
}
