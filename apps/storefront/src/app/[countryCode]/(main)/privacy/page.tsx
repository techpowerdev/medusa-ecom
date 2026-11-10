import { Metadata } from "next"

import { STORE_NAME } from "@lib/util/site"
import { PlaceholderNotice, PolicyPage } from "@modules/policies/templates"

export const dynamic = "force-static"
export const revalidate = 60

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว",
  description: `วิธีที่ ${STORE_NAME} เก็บและใช้ข้อมูลส่วนบุคคล`,
}

export default function PrivacyPage() {
  return (
    <PolicyPage title="นโยบายความเป็นส่วนตัว">
      <PlaceholderNotice />
      <p>
        {STORE_NAME} เก็บข้อมูลที่คุณกรอกในขั้นตอนชำระเงิน เช่น ชื่อ อีเมล
        และที่อยู่จัดส่ง เพื่อดำเนินการและจัดส่งคำสั่งซื้อของคุณ
      </p>
      <p>
        ข้อมูลการชำระเงินดำเนินการโดยผู้ให้บริการชำระเงิน ร้านไม่ได้จัดเก็บไว้
        และเราใช้คุกกี้เพื่อจดจำตะกร้าสินค้าและการเข้าสู่ระบบของคุณ
      </p>
    </PolicyPage>
  )
}
