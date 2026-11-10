import { Metadata } from "next"

import { STORE_NAME } from "@lib/util/site"
import { PlaceholderNotice, PolicyPage } from "@modules/policies/templates"

export const dynamic = "force-static"
export const revalidate = 60

export const metadata: Metadata = {
  title: "ติดต่อเรา",
  description: `ช่องทางติดต่อ ${STORE_NAME}`,
}

export default function ContactPage() {
  return (
    <PolicyPage title="ติดต่อเรา">
      <PlaceholderNotice />
      <p>
        มีคำถามเกี่ยวกับคำสั่งซื้อ การจัดส่ง หรือการคืนสินค้า? ติดต่อฝ่ายบริการลูกค้าของ{" "}
        {STORE_NAME} พร้อมแจ้งเลขที่คำสั่งซื้อ
      </p>
    </PolicyPage>
  )
}
