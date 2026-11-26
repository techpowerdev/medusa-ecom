import { formatCountdown, secondsLeft } from "@lib/util/payment-session"

/** PAY-2/PAY-3b2: QR + นับถอยหลัง (หมดอายุ 10 นาทีนับจากสร้าง PaymentIntent) — ใช้ร่วมระหว่าง checkout และหน้าชำระเงินของ order */
const PromptPayQr = ({ image, deadline, now }: { image: string; deadline: number; now: number }) => (
  <>
    <p className="text-sm leading-[1.4rem] font-medium text-foreground">
      สแกนคิวอาร์โค้ดด้วยแอปธนาคารเพื่อชำระเงิน
    </p>
    {/* eslint-disable-next-line @next/next/no-img-element -- รูป QR จาก Stripe (URL ภายนอกที่เปลี่ยนต่อ payment) */}
    <img
      src={image}
      alt="คิวอาร์โค้ดพร้อมเพย์"
      width={240}
      height={240}
      className="border border-border rounded-rounded"
      data-testid="promptpay-qr"
    />
    <p className="text-sm leading-[1.4rem] text-muted-foreground" aria-live="polite">
      หมดอายุใน <span data-testid="promptpay-countdown">{formatCountdown(secondsLeft(deadline, now))}</span>
    </p>
    <p className="text-sm leading-[1.4rem] text-muted-foreground">
      กำลังรอยืนยันการชำระเงิน… หน้านี้จะอัปเดตอัตโนมัติ
    </p>
  </>
)

export default PromptPayQr
