import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Text } from "@modules/common/components/ui"

/**
 * PAY-6c (กฎข้อ 8) / PAY-3b (กฎข้อ 9d): ครบเพดานการลองซ้ำแล้วยังไม่ยืนยัน → ให้ติดต่อร้าน
 * ใช้ร่วมระหว่าง checkout และหน้าชำระเงินของ order (/account/orders/:id/pay)
 */
const PromptPayOrderDelayed = () => (
  <div className="flex flex-col items-start gap-y-2" data-testid="promptpay-order-delayed">
    <Text className="txt-medium-plus text-ui-fg-base" aria-live="polite">
      ได้รับเงินแล้ว ระบบกำลังตรวจสอบคำสั่งซื้อของคุณ
    </Text>
    <Text className="txt-medium text-ui-fg-subtle">
      หากยังไม่ได้รับการยืนยันคำสั่งซื้อ กรุณา{" "}
      <LocalizedClientLink href="/contact" className="underline" data-testid="promptpay-contact-link">
        ติดต่อร้าน
      </LocalizedClientLink>
    </Text>
  </div>
)

export default PromptPayOrderDelayed
