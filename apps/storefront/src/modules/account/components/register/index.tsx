"use client"

import { useActionState } from "react"
import Input from "@modules/common/components/input"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import PendingAddToCartFields from "@modules/account/components/pending-add-to-cart-fields"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { signup } from "@lib/data/customer"
import { STORE_NAME } from "@lib/store-content"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Register = ({ setCurrentView }: Props) => {
  const [message, formAction] = useActionState(signup, null)

  return (
    <div
      className="max-w-sm flex flex-col items-center"
      data-testid="register-page"
    >
      <h1 className="text-large-semi uppercase mb-6">
        สมัครสมาชิก {STORE_NAME}
      </h1>
      <p className="text-center text-base-regular text-ui-fg-base mb-4">
        สร้างบัญชีสมาชิก {STORE_NAME} เพื่อรับประสบการณ์การช้อปปิ้งที่ดียิ่งขึ้น
      </p>
      {message?.state === "verification_required" && (
        <div
          className="w-full mb-4 text-center text-base-regular text-ui-fg-base bg-ui-bg-subtle border border-ui-border-base rounded-rounded p-4"
          data-testid="register-verification-message"
        >
          เราได้ส่งลิงก์ยืนยันไปที่ <strong>{message.email}</strong> แล้ว
          กรุณาตรวจสอบกล่องจดหมายเพื่อยืนยันอีเมล จากนั้นเข้าสู่ระบบ
        </div>
      )}
      <form className="w-full flex flex-col" action={formAction}>
        <PendingAddToCartFields />
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="ชื่อ"
            name="first_name"
            required
            autoComplete="given-name"
            data-testid="first-name-input"
          />
          <Input
            label="นามสกุล"
            name="last_name"
            required
            autoComplete="family-name"
            data-testid="last-name-input"
          />
          <Input
            label="อีเมล"
            name="email"
            required
            type="email"
            autoComplete="email"
            data-testid="email-input"
            // CORE-4f (กฎข้อ 62): ล้มแล้วคงอีเมลเดิม — React 19 reset ฟอร์มกลับเป็น defaultValue หลัง action
            defaultValue={message?.state === "error" ? message.email : undefined}
          />
          <Input
            label="เบอร์โทรศัพท์"
            name="phone"
            type="tel"
            autoComplete="tel"
            data-testid="phone-input"
          />
          <Input
            label="รหัสผ่าน"
            name="password"
            required
            type="password"
            autoComplete="new-password"
            data-testid="password-input"
          />
        </div>
        <ErrorMessage
          error={message?.state === "error" ? message.error : null}
          data-testid="register-error"
        />
        <span className="text-center text-ui-fg-base text-small-regular mt-6">
          การสร้างบัญชีกับ {STORE_NAME} ถือว่าคุณยอมรับ{" "}
          <LocalizedClientLink
            href="/privacy"
            className="underline"
            data-testid="register-privacy-link"
          >
            นโยบายความเป็นส่วนตัว
          </LocalizedClientLink>{" "}
          และ{" "}
          <LocalizedClientLink
            href="/terms"
            className="underline"
            data-testid="register-terms-link"
          >
            ข้อกำหนดการใช้งาน
          </LocalizedClientLink>
          .
        </span>
        <SubmitButton className="w-full mt-6" data-testid="register-button">
          สมัครสมาชิก
        </SubmitButton>
      </form>
      <span className="text-center text-ui-fg-base text-small-regular mt-6">
        เป็นสมาชิกอยู่แล้ว?{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          className="underline"
        >
          เข้าสู่ระบบ
        </button>
        .
      </span>
    </div>
  )
}

export default Register
