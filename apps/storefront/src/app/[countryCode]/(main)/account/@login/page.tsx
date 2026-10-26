import { Metadata } from "next"

import { STORE_NAME } from "@lib/store-content"

import LoginTemplate from "@modules/account/templates/login-template"

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
  description: `เข้าสู่ระบบบัญชี ${STORE_NAME} ของคุณ`,
}

export default function Login() {
  return <LoginTemplate />
}
