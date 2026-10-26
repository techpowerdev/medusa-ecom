import { Metadata } from "next"

import LoginTemplate from "@modules/account/templates/login-template"

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
  description: "เข้าสู่ระบบบัญชีของคุณ",
}

export default function Login() {
  return <LoginTemplate />
}
