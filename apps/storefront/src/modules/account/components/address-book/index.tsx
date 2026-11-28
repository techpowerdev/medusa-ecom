import React from "react"

import AddAddress from "../address-card/add-address"
import EditAddress from "../address-card/edit-address-modal"
import { HttpTypes } from "@medusajs/types"

type AddressBookProps = {
  customer: HttpTypes.StoreCustomer
  region: HttpTypes.StoreRegion
}

// SFUI-20b/20c (spec 09 กฎ 70): ฟอร์มที่อยู่ไม่ใช้ region แล้ว — คง prop `region` ของหน้า (ไม่แก้ page ที่เป็นไฟล์ของ 21b)
const AddressBook: React.FC<AddressBookProps> = ({ customer }) => {
  const { addresses } = customer
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 mt-4">
        <AddAddress />
        {addresses.map((address) => {
          return (
            <EditAddress address={address} key={address.id} />
          )
        })}
      </div>
    </div>
  )
}

export default AddressBook
