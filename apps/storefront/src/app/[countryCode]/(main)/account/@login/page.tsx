import { Metadata } from "next"

import { retrieveCustomer } from "@lib/data/customer"
import { STORE_NAME } from "@lib/store-content"

import LoginTemplate from "@modules/account/templates/login-template"

// CORE-22 (กฎข้อ 46): Next รวม metadata ของทุก parallel slot และ slot @login ถูก merge หลัง @dashboard
// ถ้าคืน title เสมอจะทับ title ของหน้า dashboard ทุกหน้า → คืน metadata เฉพาะตอนที่ยังไม่ล็อกอิน (layout แสดง slot นี้)
export async function generateMetadata(): Promise<Metadata> {
  const customer = await retrieveCustomer().catch(() => null)

  if (customer) {
    return {}
  }

  return {
    title: "เข้าสู่ระบบ",
    description: `เข้าสู่ระบบบัญชี ${STORE_NAME} ของคุณ`,
  }
}

export default function Login() {
  return <LoginTemplate />
}
