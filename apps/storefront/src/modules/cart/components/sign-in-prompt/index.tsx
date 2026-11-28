import { buttonVariants } from "@/components/ui/button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const SignInPrompt = () => {
  return (
    <div className="bg-white flex items-center justify-between">
      <div>
        <h2 className="font-semibold text-2xl">มีบัญชีอยู่แล้วใช่ไหม</h2>
        <p className="text-sm leading-[1.4rem] text-muted-foreground mt-2">
          เข้าสู่ระบบเพื่อประสบการณ์ที่ดียิ่งขึ้น
        </p>
      </div>
      <div>
        <LocalizedClientLink
          href="/account"
          className={buttonVariants({ variant: "outline" })}
          data-testid="sign-in-button"
        >
          เข้าสู่ระบบ
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default SignInPrompt
