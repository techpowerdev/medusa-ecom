import { formatCountdown, secondsLeft } from "@lib/util/payment-session"
import { Text } from "@modules/common/components/ui"

/** PAY-2/PAY-3b2: QR + นับถอยหลัง (หมดอายุ 10 นาทีนับจากสร้าง PaymentIntent) — ใช้ร่วมระหว่าง checkout และหน้าชำระเงินของ order */
const PromptPayQr = ({ image, deadline, now }: { image: string; deadline: number; now: number }) => (
  <>
    <Text className="txt-medium-plus text-ui-fg-base">
      สแกนคิวอาร์โค้ดด้วยแอปธนาคารเพื่อชำระเงิน
    </Text>
    {/* eslint-disable-next-line @next/next/no-img-element -- รูป QR จาก Stripe (URL ภายนอกที่เปลี่ยนต่อ payment) */}
    <img
      src={image}
      alt="คิวอาร์โค้ดพร้อมเพย์"
      width={240}
      height={240}
      className="border border-ui-border-base rounded-rounded"
      data-testid="promptpay-qr"
    />
    <Text className="txt-small text-ui-fg-subtle" aria-live="polite">
      หมดอายุใน <span data-testid="promptpay-countdown">{formatCountdown(secondsLeft(deadline, now))}</span>
    </Text>
    <Text className="txt-small text-ui-fg-subtle">
      กำลังรอยืนยันการชำระเงิน… หน้านี้จะอัปเดตอัตโนมัติ
    </Text>
  </>
)

export default PromptPayQr
