import { login } from "@lib/data/customer"
import { useSubmitOnce } from "@lib/hooks/use-submit-once"
import { INVALID_CREDENTIALS_MESSAGE } from "@lib/util/error-message"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import PendingAddToCartFields from "@modules/account/components/pending-add-to-cart-fields"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import { useActionState } from "react"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Login = ({ setCurrentView }: Props) => {
  const [message, formAction, isPending] = useActionState(login, null)
  const onSubmit = useSubmitOnce(isPending)

  return (
    <div
      className="max-w-sm w-full flex flex-col items-center"
      data-testid="login-page"
    >
      <h1 className="text-large-semi uppercase mb-6">ยินดีต้อนรับกลับมา</h1>
      <p className="text-center text-base-regular text-ui-fg-base mb-8">
        เข้าสู่ระบบเพื่อรับประสบการณ์การช้อปปิ้งที่ดียิ่งขึ้น
      </p>
      {message?.state === "verification_required" && (
        <div
          className="w-full mb-6 text-center text-base-regular text-ui-fg-base bg-ui-bg-subtle border border-ui-border-base rounded-rounded p-4"
          data-testid="login-verification-message"
        >
          เราได้ส่งลิงก์ยืนยันไปที่ <strong>{message.email}</strong> แล้ว
          กรุณายืนยันอีเมล จากนั้นเข้าสู่ระบบ
        </div>
      )}
      <form className="w-full" action={formAction} onSubmit={onSubmit}>
        <PendingAddToCartFields />
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="อีเมล"
            name="email"
            type="email"
            title="กรุณากรอกอีเมลให้ถูกต้อง"
            autoComplete="email"
            required
            data-testid="email-input"
            // CORE-4f (กฎข้อ 62): ล้มแล้วคงอีเมลเดิม — React 19 reset ฟอร์มกลับเป็น defaultValue หลัง action
            defaultValue={message?.state === "error" ? message.email : undefined}
          />
          <Input
            label="รหัสผ่าน"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            data-testid="password-input"
          />
        </div>
        <ErrorMessage
          error={
            message?.state !== "error"
              ? null
              : // CORE-4h (กฎข้อ 69a): ตัดสินจาก reason ไม่เทียบข้อความ
                message.reason === "invalid_credentials"
                ? INVALID_CREDENTIALS_MESSAGE
                : message.error
          }
          data-testid="login-error-message"
        />
        <SubmitButton data-testid="sign-in-button" className="w-full mt-6">
          เข้าสู่ระบบ
        </SubmitButton>
      </form>
      <span className="text-center text-ui-fg-base text-small-regular mt-6">
        ยังไม่เป็นสมาชิก?{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
          className="underline"
          data-testid="register-button"
        >
          สมัครสมาชิก
        </button>
        .
      </span>
    </div>
  )
}

export default Login
