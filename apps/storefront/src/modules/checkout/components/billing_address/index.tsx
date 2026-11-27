import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"
import React, { useState } from "react"
import CountrySelect from "../country-select"

const BillingAddress = ({ cart }: { cart: HttpTypes.StoreCart | null }) => {
  const [formData, setFormData] = useState<Record<string, string>>({
    "billing_address.first_name": cart?.billing_address?.first_name || "",
    "billing_address.last_name": cart?.billing_address?.last_name || "",
    "billing_address.address_1": cart?.billing_address?.address_1 || "",
    "billing_address.address_2": cart?.billing_address?.address_2 || "",
    "billing_address.company": cart?.billing_address?.company || "",
    "billing_address.postal_code": cart?.billing_address?.postal_code || "",
    "billing_address.city": cart?.billing_address?.city || "",
    "billing_address.country_code": cart?.billing_address?.country_code || "",
    "billing_address.province": cart?.billing_address?.province || "",
    "billing_address.phone": cart?.billing_address?.phone || "",
  })

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLInputElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <>
      {/* SFUI-18b (spec 09 กฎ 53–54): ลำดับแบบที่อยู่ไทย; < 768px แถวละช่อง, ≥ md คู่ ชื่อ–นามสกุล, ตำบล/แขวง–เขต/อำเภอ, จังหวัด–รหัสไปรษณีย์ (ช่องอื่นเต็มแถว) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="ชื่อ"
          name="billing_address.first_name"
          autoComplete="given-name"
          value={formData["billing_address.first_name"]}
          onChange={handleChange}
          required
          data-testid="billing-first-name-input"
        />
        <Input
          label="นามสกุล"
          name="billing_address.last_name"
          autoComplete="family-name"
          value={formData["billing_address.last_name"]}
          onChange={handleChange}
          required
          data-testid="billing-last-name-input"
        />
        <Input
          label="บริษัท"
          name="billing_address.company"
          value={formData["billing_address.company"]}
          onChange={handleChange}
          autoComplete="organization"
          className="md:col-span-2"
          data-testid="billing-company-input"
        />
        <Input
          label="บ้านเลขที่ หมู่ ซอย ถนน"
          name="billing_address.address_1"
          autoComplete="address-line1"
          placeholder="เช่น 99/1 หมู่ 2 ซ.สุขุมวิท 3 ถ.สุขุมวิท"
          value={formData["billing_address.address_1"]}
          onChange={handleChange}
          required
          className="md:col-span-2"
          data-testid="billing-address-input"
        />
        <Input
          label="ตำบล/แขวง"
          name="billing_address.address_2"
          autoComplete="address-level3"
          value={formData["billing_address.address_2"]}
          onChange={handleChange}
          required
          data-testid="billing-address-2-input"
        />
        <Input
          label="เขต/อำเภอ"
          name="billing_address.city"
          autoComplete="address-level2"
          value={formData["billing_address.city"]}
          onChange={handleChange}
          required
          data-testid="billing-city-input"
        />
        <Input
          label="จังหวัด"
          name="billing_address.province"
          autoComplete="address-level1"
          value={formData["billing_address.province"]}
          onChange={handleChange}
          data-testid="billing-province-input"
        />
        <Input
          label="รหัสไปรษณีย์"
          name="billing_address.postal_code"
          autoComplete="postal-code"
          placeholder="เช่น 10110"
          value={formData["billing_address.postal_code"]}
          onChange={handleChange}
          required
          data-testid="billing-postal-input"
        />
        <CountrySelect
          name="billing_address.country_code"
          autoComplete="country"
          region={cart?.region}
          value={formData["billing_address.country_code"]}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, "billing_address.country_code": value }))
          }
          required
          className="md:col-span-2"
          data-testid="billing-country-select"
        />
        <Input
          label="เบอร์โทรศัพท์"
          name="billing_address.phone"
          autoComplete="tel"
          placeholder="เช่น 0812345678"
          value={formData["billing_address.phone"]}
          onChange={handleChange}
          className="md:col-span-2"
          data-testid="billing-phone-input"
        />
      </div>
    </>
  )
}

export default BillingAddress
