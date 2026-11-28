"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { confirmEmailVerification } from "@lib/data/customer"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type VerificationState = "verifying" | "success" | "error"

const VerifyAccount = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [state, setState] = useState<VerificationState>("verifying")
  // Guard against the effect running twice in React Strict Mode, which would
  // consume the single-use token before the customer sees the result.
  const confirmed = useRef(false)

  useEffect(() => {
    if (confirmed.current) {
      return
    }
    confirmed.current = true

    if (!token) {
      setState("error")
      return
    }

    confirmEmailVerification(token).then(({ success }) =>
      setState(success ? "success" : "error")
    )
  }, [token])

  return (
    <div
      className="max-w-sm w-full flex flex-col items-center text-center gap-y-4"
      data-testid="verify-account-page"
    >
      <h1 className="text-3xl font-semibold tracking-tight">ยืนยันอีเมล</h1>

      {state === "verifying" && (
        <p className="text-sm leading-6 font-normal text-foreground">
          กำลังยืนยันอีเมลของคุณ...
        </p>
      )}

      {state === "success" && (
        <>
          <p className="text-sm leading-6 font-normal text-foreground">
            ยืนยันอีเมลเรียบร้อยแล้ว คุณเข้าสู่ระบบบัญชีได้แล้ว
          </p>
          <LocalizedClientLink href="/account" className={buttonVariants()}>
            ไปหน้าเข้าสู่ระบบ
          </LocalizedClientLink>
        </>
      )}

      {state === "error" && (
        <>
          <p
            className="text-sm leading-6 font-normal text-foreground"
            data-testid="verify-account-error"
          >
            ลิงก์ยืนยันนี้ไม่ถูกต้องหรือหมดอายุแล้ว เข้าสู่ระบบเพื่อรับอีเมลยืนยันใหม่
          </p>
          <LocalizedClientLink
            href="/account"
            className={buttonVariants({ variant: "outline" })}
          >
            ไปหน้าเข้าสู่ระบบ
          </LocalizedClientLink>
        </>
      )}
    </div>
  )
}

export default VerifyAccount
