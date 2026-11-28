import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { buttonVariants } from "@/components/ui/button"

/**
 * PAY-15 (spec 06 กฎข้อ 17) / PAY-19 (กฎข้อ 21): เงินถูกคืนและเหตุยังอยู่ในตะกร้าเดิม → ข้อความคืนเงิน + ลิงก์ "ไปที่ตะกร้า"
 * แทนปุ่มจ่าย (จ่ายซ้ำบนตะกร้าเดิม = ถูกคืนซ้ำ)
 */
const RefundedGoToCart = ({ text, noticeTestId, linkTestId }: { text: string; noticeTestId: string; linkTestId: string }) => (
  <>
    <p className="text-sm leading-[1.4rem] text-muted-foreground mb-2" data-testid={noticeTestId}>
      {text}
    </p>
    <LocalizedClientLink href="/cart" className={buttonVariants()} data-testid={linkTestId}>
      ไปที่ตะกร้า
    </LocalizedClientLink>
  </>
)

export default RefundedGoToCart
