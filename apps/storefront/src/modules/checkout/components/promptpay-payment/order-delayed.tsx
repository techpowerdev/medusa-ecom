import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * PAY-6c (กฎข้อ 8) / PAY-3b (กฎข้อ 9d): ครบเพดานการลองซ้ำแล้วยังไม่ยืนยัน → ให้ติดต่อร้าน
 * ใช้ร่วมระหว่าง checkout และหน้าชำระเงินของ order (/account/orders/:id/pay)
 */
const PromptPayOrderDelayed = () => (
  <div className="flex flex-col items-start gap-y-2" data-testid="promptpay-order-delayed">
    <p className="text-sm leading-[1.4rem] font-medium text-foreground" aria-live="polite">
      ได้รับเงินแล้ว ระบบกำลังตรวจสอบคำสั่งซื้อของคุณ
    </p>
    <p className="text-sm leading-[1.4rem] text-muted-foreground">
      หากยังไม่ได้รับการยืนยันคำสั่งซื้อ กรุณา{" "}
      <LocalizedClientLink href="/contact" className="underline" data-testid="promptpay-contact-link">
        ติดต่อร้าน
      </LocalizedClientLink>
    </p>
  </div>
)

export default PromptPayOrderDelayed
