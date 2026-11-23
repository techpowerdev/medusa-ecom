import { buttonClassName, Heading, Text } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const SignInPrompt = () => {
  return (
    <div className="bg-white flex items-center justify-between">
      <div>
        <Heading level="h2" className="txt-xlarge">
          มีบัญชีอยู่แล้วใช่ไหม
        </Heading>
        <Text className="txt-medium text-ui-fg-subtle mt-2">
          เข้าสู่ระบบเพื่อประสบการณ์ที่ดียิ่งขึ้น
        </Text>
      </div>
      <div>
        <LocalizedClientLink
          href="/account"
          className={buttonClassName({ variant: "secondary" }, "h-10")}
          data-testid="sign-in-button"
        >
          เข้าสู่ระบบ
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default SignInPrompt
