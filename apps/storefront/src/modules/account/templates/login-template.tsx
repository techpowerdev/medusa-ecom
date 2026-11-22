"use client"

import { useState } from "react"

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

  const showView = (view: LOGIN_VIEW, email?: string) => {
    setLoginEmail(email)
    setCurrentView(view)
  }

  return (
    <div className="w-full flex justify-start px-8 py-8">
      {currentView === "sign-in" ? (
        <Login setCurrentView={showView} defaultEmail={loginEmail} />
      ) : (
        <Register setCurrentView={showView} />
      )}
    </div>
  )
}

export default LoginTemplate
