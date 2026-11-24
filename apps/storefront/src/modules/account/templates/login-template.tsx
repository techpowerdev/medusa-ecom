"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"

import {
  LOGIN_NOTICE_PARAM,
  PAYMENT_RECEIVED_NOTICE,
  readLoginNotice,
} from "@lib/util/login-notice"

import Register from "@modules/account/components/register"
import Login from "@modules/account/components/login"

export enum LOGIN_VIEW {
  SIGN_IN = "sign-in",
  REGISTER = "register",
}

const LoginTemplate = () => {
  const [currentView, setCurrentView] = useState("sign-in")
  // CORE-79 (กฎข้อ 137): อีเมลจากฟอร์มสมัครที่ส่งต่อให้ฟอร์ม login
  const [loginEmail, setLoginEmail] = useState<string>()
  // CORE-95 (กฎข้อ 151b): allow-list ค่าเดียว — ไม่ render ค่าจาก URL
  const notice = readLoginNotice(useSearchParams().get(LOGIN_NOTICE_PARAM))

  const showView = (view: LOGIN_VIEW, email?: string) => {
    setLoginEmail(email)
    setCurrentView(view)
  }

  return (
    <div className="w-full flex flex-col items-start px-8 py-8">
      {notice && (
        <p
          role="status"
          className="max-w-sm w-full mb-6 text-center text-base-regular text-ui-fg-base bg-ui-bg-subtle border border-ui-border-base rounded-rounded p-4"
          data-testid="login-payment-received-notice"
        >
          {PAYMENT_RECEIVED_NOTICE}
        </p>
      )}
      {currentView === "sign-in" ? (
        <Login
          setCurrentView={showView}
          defaultEmail={loginEmail}
          notice={notice}
        />
      ) : (
        <Register setCurrentView={showView} />
      )}
    </div>
  )
}

export default LoginTemplate
