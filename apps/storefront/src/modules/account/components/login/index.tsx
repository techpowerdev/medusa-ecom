import { login } from "@lib/data/customer"
import { useSubmitOnce } from "@lib/hooks/use-submit-once"
import { INVALID_CREDENTIALS_MESSAGE } from "@lib/util/error-message"
import { LOGIN_NOTICE_PARAM, PAYMENT_RECEIVED } from "@lib/util/login-notice"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import PendingAddToCartFields from "@modules/account/components/pending-add-to-cart-fields"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import { Button } from "@/components/ui/button"
import Input from "@modules/common/components/input"
import { useActionState } from "react"
import { useParams } from "next/navigation"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
  // CORE-79 (กฎข้อ 137): อีเมลที่กรอกในฟอร์มสมัคร (มาจากลิงก์ register-login-link)
  defaultEmail?: string
  // CORE-95 (กฎข้อ 151c): notice ที่ผ่าน allow-list แล้ว → ส่งต่อให้ server action เลือกปลายทาง (ค่าคงที่) หลัง login
  notice?: typeof PAYMENT_RECEIVED | null
}

const Login = ({ setCurrentView, defaultEmail, notice }: Props) => {
  const { countryCode } = useParams() as { countryCode: string }
  const [message, formAction, isPending] = useActionState(login, null)
  const onSubmit = useSubmitOnce(isPending)

  return (
    <div
      className="max-w-sm w-full flex flex-col items-center"
      data-testid="login-page"
    >
      <h1 className="text-3xl font-semibold tracking-tight mb-6">ยินดีต้อนรับกลับมา</h1>
      <p className="text-center text-sm leading-6 font-normal text-foreground mb-8">
        เข้าสู่ระบบเพื่อรับประสบการณ์การช้อปปิ้งที่ดียิ่งขึ้น
      </p>
      {message?.state === "verification_required" && (
        <div
          className="w-full mb-6 text-center text-sm leading-6 font-normal text-foreground bg-muted border border-border rounded-rounded p-4"
          data-testid="login-verification-message"
        >
          เราได้ส่งลิงก์ยืนยันไปที่ <strong>{message.email}</strong> แล้ว
          กรุณายืนยันอีเมล จากนั้นเข้าสู่ระบบ
        </div>
      )}
      <form className="w-full" action={formAction} onSubmit={onSubmit}>
        <PendingAddToCartFields />
        {notice && (
          <>
            <input type="hidden" name={LOGIN_NOTICE_PARAM} value={notice} />
            <input type="hidden" name="country_code" value={countryCode} />
          </>
        )}
        <div className="flex flex-col w-full gap-4">
          <Input
            label="อีเมล"
            name="email"
            type="email"
            title="กรุณากรอกอีเมลให้ถูกต้อง"
            autoComplete="email"
            required
            data-testid="email-input"
            // CORE-4f (กฎข้อ 62): ล้มแล้วคงอีเมลเดิม — React 19 reset ฟอร์มกลับเป็น defaultValue หลัง action
            defaultValue={message?.state === "error" ? message.email : defaultEmail}
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
      {/* SFUI-23 (spec 09 กฎ 85): ประโยค text-sm เท่าปุ่ม ไม่มี "." — ระยะเว้นคือ padding ซ้ายของปุ่ม */}
      <div className="mt-6 flex flex-wrap items-center justify-center text-sm text-foreground">
        <span>ยังไม่เป็นสมาชิก?</span>
        <Button
          type="button"
          variant="link"
          onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
          // CORE-90 (กฎข้อ 146a): testid ไม่ซ้ำกับ submit ของฟอร์มสมัคร; SFUI-19b (spec 09 กฎ 63b): Button link size default 36px
          data-testid="login-to-register-button"
        >
          สมัครสมาชิก
        </Button>
      </div>
    </div>
  )
}

export default Login
