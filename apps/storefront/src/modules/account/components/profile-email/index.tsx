import { HttpTypes } from "@medusajs/types"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

// CORE-23 (spec 01 กฎข้อ 50): editor อีเมลของ starter เป็น TODO ที่แสดง success โดยไม่บันทึก และ
// POST /store/customers/me ไม่รับ email (อีเมลผูกกับ auth identity) → แสดงแบบอ่านอย่างเดียว
// โครงเดียวกับ AccountInfo เพื่อให้ค่าชิดแนวเดียวกับช่องอื่น (กฎข้อ 53)
const ProfileEmail = ({ customer }: MyInformationProps) => {
  return (
    <div className="text-small-regular w-full" data-testid="account-email">
      <div className="flex flex-col">
        <span className="uppercase text-ui-fg-base">อีเมล</span>
        <span className="font-semibold" data-testid="current-info">
          {customer.email}
        </span>
      </div>
    </div>
  )
}

export default ProfileEmail
