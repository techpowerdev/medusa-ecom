import { Metadata } from "next"

import { STORE_NAME } from "@lib/util/site"
import { PlaceholderNotice, PolicyPage } from "@modules/policies/templates"

export const dynamic = "force-static"
export const revalidate = 60

export const metadata: Metadata = {
  title: "ข้อกำหนดการใช้งาน",
  description: `ข้อกำหนดสำหรับการสั่งซื้อสินค้าจาก ${STORE_NAME}`,
}

export default function TermsPage() {
  return (
    <PolicyPage title="ข้อกำหนดการใช้งาน">
      <PlaceholderNotice />
      <p>
        การสั่งซื้อสินค้ากับ {STORE_NAME} ถือว่าคุณยอมรับข้อกำหนดเหล่านี้ ราคา
        สินค้าคงเหลือ และตัวเลือกการจัดส่งแสดงอยู่ในหน้าสินค้าและขั้นตอนชำระเงิน
        และอาจเปลี่ยนแปลงได้โดยไม่ต้องแจ้งล่วงหน้า
      </p>
      <p>
        เราจะยืนยันคำสั่งซื้อทางอีเมลเมื่อได้รับชำระเงิน การคืนสินค้าและการคืนเงิน
        เป็นไปตามนโยบายการคืนสินค้าของร้าน
      </p>
    </PolicyPage>
  )
}
