# 06 Payments — บัตรผ่าน Stripe + PromptPay ไทย

สถานะ: draft
เป้าหมาย (เจ้าของ): รับชำระด้วยบัตรเครดิต/เดบิตและ PromptPay ผ่าน Stripe
การตัดสินใจ: ใช้ Stripe provider ที่มีมากับ Medusa, capture อัตโนมัติ (ADR-007) **ไม่มี custom payment code**
ตรวจสอบแล้ว (เอกสาร Medusa, 2026-10): `@medusajs/medusa/payment-stripe` ลงทะเบียน
`pp_stripe_stripe` (บัตร) และ `pp_stripe-promptpay_stripe` (PromptPay); webhook อยู่ที่
`{server}/hooks/payment/stripe_stripe` และ `{server}/hooks/payment/stripe-promptpay_stripe`

## สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | วิธีใช้ |
|------|-----------------|-----|
| ชำระด้วยบัตร (3DS) | `pp_stripe_stripe` | ใช้ตามเดิม |
| PromptPay QR | `pp_stripe-promptpay_stripe` | ใช้ตามเดิม |
| Payment sessions, authorize, capture, refund | Payment module + core flows | ใช้ตามเดิม |
| จัดการ webhook + idempotency | `/hooks/payment/*` | ใช้ตามเดิม |
| ชำระเงินสำหรับ (draft) order ที่มีอยู่แล้ว | Order payment collection + store payment routes | ใช้ตามเดิม (group buy, spec 04) |
| Checkout ด้วย Stripe Elements ใน storefront | Next.js starter | ขยายเพื่อรองรับ PromptPay + หน้าชำระเงินของ order |
| Admin: เปิดใช้ provider ต่อ region, refund | Admin | ตั้งค่า |

## การตั้งค่า
- บัญชี Stripe: นิติบุคคลไทย (PromptPay ต้องใช้บัญชี Stripe ประเทศไทย, THB)
- `medusa-config.ts`: payment module พร้อม Stripe provider id `stripe`, `capture: true`,
  `automaticPaymentMethods: false`
- Region Thailand: เปิดใช้ทั้งสอง provider
- Env: `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_KEY`
- Webhooks (สอง endpoint) ลงทะเบียนใน Stripe dashboard; events: `payment_intent.*`

## Storefront
- ขั้นตอนชำระเงินใน checkout: "Card" (Stripe Elements) / "PromptPay" (PaymentElement แบบ
  `promptpay` แสดง QR; poll สถานะ session จนกว่าจะ captured; หมดอายุหลัง 10 นาที)
- `/account/orders/:id/pay`: ใช้ payment component เดียวกัน ผูกกับ payment collection ของ order
  (ใช้โดย group buying)
- Error states: บัตรถูกปฏิเสธ, 3DS ล้มเหลว, PromptPay หมดอายุ → ลองใหม่ได้; cart/order ยังคงอยู่
- ต้อง login ก่อน checkout (กฎทั้งร้าน, spec 01)

## Business rules
1. ยอดเงินทั้งหมดเป็น THB ในหน่วยหลัก (major units) ของ Medusa; Stripe provider แปลงเป็นสตางค์เอง
2. order จะถูกสร้างก็ต่อเมื่อ payment session ถูก authorized/captured แล้วเท่านั้น (ค่าเริ่มต้นของ Medusa)
3. Webhook event เป็น source of truth สำหรับการชำระ PromptPay สำเร็จ
4. Refund ทำผ่าน `refundPaymentWorkflow` เท่านั้น; ห้ามเรียก Stripe API โดยตรงนอก provider

## Acceptance criteria
- AC-1 บัตร `4242…` → สร้าง order สำเร็จ, `payment_status=captured`
- AC-2 บัตรที่ต้องผ่าน 3DS (`4000 0027 6000 3184`) → แสดง 3DS modal → สำเร็จ
- AC-3 บัตรถูกปฏิเสธ (`4000 0000 0000 0002`) → แสดง error, ไม่มีการสร้าง order
- AC-4 PromptPay: แสดง QR; เมื่อ confirm PaymentIntent ใน test mode → webhook → สร้าง order
  พร้อม `payment_status=captured`
- AC-5 PromptPay ไม่ชำระภายใน 10 นาที → session ถูกยกเลิก, cart ยังใช้งานได้
- AC-6 Admin refund ฿100 บน order ที่ captured แล้ว → มี Stripe refund เกิดขึ้น; order แสดงสถานะ refunded
- AC-7 ชำระ draft order ผ่าน `/account/orders/:id/pay` ด้วย PromptPay → captured
- AC-8 การส่ง webhook ซ้ำต้องไม่ทำให้ capture/refund ซ้ำ

## Test plan
- Integration (http): AC-8 โดย mock provider
- e2e: AC-1..AC-7 กับ Stripe test mode; CI รัน `stripe listen --forward-to` เพื่อให้
  webhook จริงส่งถึง runner; จำลอง PromptPay สำเร็จด้วยการ confirm PaymentIntent ใน test mode

## Tasks
| ID | Task | Depends |
|----|------|---------|
| PAY-1 | ตั้งค่า Stripe provider, เปิดใช้ใน region, env, ตรวจสอบ webhook route ในเครื่องด้วย Stripe CLI (AC-8) | CORE-2 |
| PAY-2 | Storefront: ขั้นตอนชำระเงินด้วยบัตร + PromptPay, polling, error + e2e (AC-1..AC-5) | PAY-1, CORE-5 |
| PAY-3 | หน้าชำระเงินของ order `/account/orders/:id/pay` + e2e (AC-7) | PAY-2 |
| PAY-4 | Refund e2e + screenshot หน้า admin (AC-6) | PAY-2 |

## Open questions
- Q1 ยืนยันว่าบัญชี Stripe เป็นนิติบุคคลไทยและเปิดใช้ PromptPay แล้ว (จำเป็นสำหรับ AC-4 ใน test mode)
