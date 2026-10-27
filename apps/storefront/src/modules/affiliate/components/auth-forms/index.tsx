"use client"

import { affiliateLogin, affiliateRegister } from "@lib/data/affiliate-portal"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import { useActionState } from "react"

// AF-8a: login/register ของ portal (actor `affiliate`) — ไม่เกี่ยวกับบัญชีลูกค้า
export default function AffiliateAuthForms({ countryCode }: { countryCode: string }) {
  const [loginState, loginAction] = useActionState(affiliateLogin, null)
  const [registerState, registerAction] = useActionState(affiliateRegister, null)

  return (
    <div className="grid grid-cols-1 small:grid-cols-2 gap-12 w-full">
      <form action={loginAction} className="flex flex-col gap-y-2">
        <h1 className="text-large-semi mb-4" data-testid="affiliate-login-title">
          เข้าสู่ระบบแอฟฟิลิเอต
        </h1>
        <input type="hidden" name="countryCode" value={countryCode} />
        <Input label="อีเมล" name="email" type="email" autoComplete="email" required data-testid="affiliate-login-email" />
        <Input
          label="รหัสผ่าน"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          data-testid="affiliate-login-password"
        />
        <ErrorMessage error={loginState?.error} data-testid="affiliate-login-error" />
        <SubmitButton className="w-full mt-4" data-testid="affiliate-login-submit">
          เข้าสู่ระบบ
        </SubmitButton>
      </form>

      <form action={registerAction} className="flex flex-col gap-y-2">
        <h2 className="text-large-semi mb-4">สมัครเป็นแอฟฟิลิเอต</h2>
        <input type="hidden" name="countryCode" value={countryCode} />
        <Input label="ชื่อ" name="name" autoComplete="name" required data-testid="affiliate-register-name" />
        <Input
          label="รหัสแนะนำ (a-z, 0-9, - ยาว 3-32 ตัว)"
          name="code"
          pattern="[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]"
          title="ใช้ตัวอักษร a-z ตัวเลข และขีด ยาว 3-32 ตัว"
          required
          data-testid="affiliate-register-code"
        />
        <Input label="อีเมล" name="email" type="email" autoComplete="email" required data-testid="affiliate-register-email" />
        <Input
          label="รหัสผ่าน"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          data-testid="affiliate-register-password"
        />
        <ErrorMessage error={registerState?.error} data-testid="affiliate-register-error" />
        <SubmitButton className="w-full mt-4" data-testid="affiliate-register-submit">
          สมัคร
        </SubmitButton>
      </form>
    </div>
  )
}
