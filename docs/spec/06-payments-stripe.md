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
| ยกเลิก PaymentIntent เดิมเมื่อเปลี่ยน session | สร้าง session ใหม่ → Medusa ลบ session เดิม → Stripe provider cancel PI | ใช้ตามเดิม; PAY-5 ยืนยันพฤติกรรมเมื่อ PI `succeeded` ไปแล้ว (กฎข้อ 7) |

## การตั้งค่า
- บัญชี Stripe: นิติบุคคลไทย (PromptPay ต้องใช้บัญชี Stripe ประเทศไทย, THB)
- `medusa-config.ts`: payment module พร้อม Stripe provider id `stripe`, `capture: true`,
  `automaticPaymentMethods: false`
- Region Thailand: เปิดใช้ทั้งสอง provider
- Env: `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_KEY`
- Webhooks (สอง endpoint) ลงทะเบียนใน Stripe dashboard; events: `payment_intent.*`

## Storefront
- ขั้นตอนชำระเงินใน checkout: "Card" (Stripe Elements) / "PromptPay" (Stripe.js `confirmPromptPayPayment(clientSecret, …,
  { handleActions: false })` แล้ว storefront แสดงรูป QR จาก `next_action` ของ PaymentIntent เอง — ไม่ใช้ PaymentElement/modal ของ Stripe
  (ปรับถ้อยคำให้ตรงกับที่ PAY-2 ทำและ reviewer ยอมรับ, 2026-10-26); poll จน webhook complete cart; หมดอายุ 10 นาที **นับจาก
  `created` ของ PaymentIntent** (สร้างตอนเลือก PromptPay ไม่ใช่ตอนแสดง QR — ดู Q3) — ครบกำหนดแล้วเช็กสถานะ PI ก่อน ถ้ายังไม่ชำระจึงสร้าง
  session ใหม่ (Medusa ลบ session เดิม → provider cancel PI เดิม))
- `/account/orders/:id/pay`: ใช้ payment component เดียวกัน ผูกกับ payment collection ของ order
  (ใช้โดย group buying)
- Error states: บัตรถูกปฏิเสธ, 3DS ล้มเหลว, PromptPay หมดอายุ → ลองใหม่ได้; cart/order ยังคงอยู่
- ต้อง login ก่อน checkout (กฎทั้งร้าน, spec 01)
- ภาษา (ADR-014, 2026-10-26): ข้อความ UI เป็นภาษาไทยตรงในโค้ด และ e2e หาด้วย test id — PAY-2 (#48) ทำไปด้วยข้อความอังกฤษแล้ว **ไม่แก้ใน #48**
  การแปลข้อความของ PAY-2 เป็นภาษาไทยอยู่ใน spec 01 CORE-4d (Depends PAY-2); PAY-3 และ PAY-5 เขียนข้อความใหม่เป็นภาษาไทย (label อังกฤษ
  ในเครื่องหมายคำพูดใน spec นี้ = ชื่อเรียก element)

## Business rules
1. ยอดเงินทั้งหมดเป็น THB ในหน่วยหลัก (major units) ของ Medusa; Stripe provider แปลงเป็นสตางค์เอง
2. order จะถูกสร้างก็ต่อเมื่อ payment session ถูก authorized/captured แล้วเท่านั้น (ค่าเริ่มต้นของ Medusa)
3. Webhook event เป็น source of truth สำหรับการชำระ PromptPay สำเร็จ
4. Refund ทำผ่าน `refundPaymentWorkflow` เท่านั้น; ห้ามเรียก Stripe API โดยตรงนอก provider
5. PaymentIntent ของ provider บัตร (`pp_stripe_stripe`) มี `payment_method_types: ["card"]` เท่านั้น (ไม่เปิด method อื่นโดยปริยาย)
   ส่งผ่านช่องทางที่ Medusa Stripe provider รองรับ (เช่น `data` ของ payment session) — ถ้าทำไม่ได้โดยไม่เขียน provider เอง ให้หยุดและเขียน ADR
6. production ห้ามมี `pp_system_default` (manual) ใน region — ADR-010 (accepted) ระดับ D1: seed ไม่ใส่ให้ใน production และ
   `check:go-live` ตรวจ region ก่อนเปิดร้าน (ไม่กัน admin เปิดเองผ่าน dashboard) ส่งมอบใน OPS-7 (spec 07)
7. (PAY-5, follow-up review PR #48) ห้ามมีกรณี "เงินถูกตัด แต่ไม่มี order และไม่มีการแก้ไขอัตโนมัติ": ถ้าลูกค้าชำระ PromptPay สำเร็จ
   ในช่วงระหว่าง storefront อ่านสถานะ PI (`retrievePaymentIntent` = ยังไม่ชำระ) กับการสร้าง session ใหม่ (ลบ session เดิม) ผลลัพธ์ต้องเป็น
   (a) session เดิมไม่ถูกลบและ cart ถูก complete เป็น order ตามปกติ — ทางที่ต้องการ ถ้าพฤติกรรมของ Medusa/Stripe provider รองรับ
   (cancel PI ที่ `succeeded` แล้วล้ม → การลบ session ล้ม) แล้ว storefront กลับไป poll แทนการแสดง error; หรือ
   (b) ถ้า Medusa ลบ session/ทิ้ง payment ได้แม้ PI ชำระแล้ว → **หยุดและเขียน ADR** ก่อนเพิ่มกลไก reconciliation ใดๆ (ขัด "ไม่มี custom
   payment code" ของ ADR-007 และกฎข้อ 4)

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
- AC-9 สร้าง payment session บัตรจาก checkout → PaymentIntent ใน Stripe test mode (อ่านผ่าน Stripe API/MCP ด้วย id ใน session `data`)
  มี `payment_method_types` เท่ากับ `["card"]`; session PromptPay มี `["promptpay"]`
- AC-10 ใน CI job `storefront-e2e` webhook ของ Stripe CLI ถึงทั้ง `/hooks/payment/stripe_stripe` และ
  `/hooks/payment/stripe-promptpay_stripe` (Stripe CLI รับ `--forward-to` ได้ปลายทางเดียวต่อ process — ใช้ listener แยกต่อ endpoint
  หรือวิธีที่ตรวจกับ docs แล้ว) วัดผลด้วย: AC-1 และ AC-4 ผ่านใน CI และ log ของ backend มี request เข้าทั้งสอง path
- AC-11 (PAY-5, กฎข้อ 7) Given cart ที่มี session PromptPay และ PI อยู่สถานะ `requires_action` When test confirm PI ให้ `succeeded` ผ่าน
  Stripe test API แล้ว**ทันที**เรียกขั้นหมดอายุแบบเดียวกับ storefront (`POST /store/payment-collections/:id/payment-sessions` ด้วย provider
  PromptPay เดิม) Then ภายใน 60 วินาที cart ถูก complete เป็น order ที่ `payment_status=captured` และไม่มี payment ที่ captured ค้างโดยไม่มี
  order (ตรวจ PI ใน Stripe: `status=succeeded` ↔ มี order อ้าง PI นั้น) (integration กับ Stripe test mode หรือ e2e)
- AC-12 (PAY-5) Given ขั้นสร้าง session ใหม่ตอนหมดอายุล้มเพราะ PI ชำระแล้ว When storefront ได้ error Then แสดง
  `data-testid="promptpay-awaiting-order"` และ poll ต่อจนไปหน้า order confirmed — ไม่แสดง `promptpay-expired` (e2e, mock response ของ
  route ได้)

## Test plan
- Integration (http): AC-8 โดย mock provider
- e2e: AC-1..AC-7 กับ Stripe test mode; CI รัน `stripe listen --forward-to` เพื่อให้
  webhook จริงส่งถึง runner; จำลอง PromptPay สำเร็จด้วยการ confirm PaymentIntent ใน test mode
- e2e: AC-9 (อ่าน PaymentIntent จาก Stripe test mode ระหว่าง AC-1/AC-4); CI: AC-10
- integration/e2e กับ Stripe test mode: AC-11; e2e: AC-12

## Tasks
| ID | Task | Depends |
|----|------|---------|
| PAY-1 | ตั้งค่า Stripe provider, เปิดใช้ใน region, env, ตรวจสอบ webhook route ในเครื่องด้วย Stripe CLI (AC-8) | CORE-2 |
| PAY-2 | Storefront: ขั้นตอนชำระเงินด้วยบัตร + PromptPay, polling, error + e2e (AC-1..AC-5); `payment_method_types: ["card"]` ของ session บัตร (กฎข้อ 5, AC-9); แก้ขั้น `stripe listen` ใน `ci.yml` ที่ใส่ `--forward-to` ซ้ำ (AC-10) | PAY-1, CORE-5 |
| PAY-3 | หน้าชำระเงินของ order `/account/orders/:id/pay` + e2e (AC-7) | PAY-2 |
| PAY-4 | Refund e2e + screenshot หน้า admin (AC-6) | PAY-2 |
| PAY-5 | follow-up review PR #48 (เล็ก): race ระหว่าง QR หมดอายุกับการชำระสำเร็จ — test AC-11 ก่อนเพื่อยืนยันพฤติกรรมของ Medusa/Stripe provider เมื่อลบ session ที่ PI `succeeded` แล้ว; ถ้าเป็นกรณี (a) ของกฎข้อ 7 แก้เฉพาะ storefront ให้ poll ต่อเมื่อสร้าง session ใหม่ล้ม (AC-12); ถ้าเป็นกรณี (b) หยุดแล้วเขียน ADR (ไม่เขียน reconciliation เอง) | PAY-2 |
PAY-3 ∥ PAY-4 ∥ PAY-5 หลัง PAY-2 (PAY-5 แตะ `promptpay-payment` เดียวกับที่ PAY-3 นำไปใช้ซ้ำ — merge PAY-5 ก่อน PAY-3 ถ้าทำพร้อมกัน ให้ rebase)

## Open questions
- Q1 ยืนยันว่าบัญชี Stripe เป็นนิติบุคคลไทยและเปิดใช้ PromptPay แล้ว (จำเป็นสำหรับ AC-4 ใน test mode)
- ~~Q2~~ ตัดสินแล้ว (owner, 2026-10-25): production ห้าม `pp_system_default` แบบ D1 ของ ADR-010 (seed + `check:go-live`;
  ไม่กัน admin เปิดเอง) — กฎข้อ 6
- ~~Q3~~ ตัดสินแล้ว (owner, 2026-10-26): **คงเดิมใน v1** — เวลา 10 นาทีของ PromptPay นับจาก `created` ของ PaymentIntent
  (อ่านได้จาก PI เสมอแม้โหลดหน้าใหม่) ไม่เปลี่ยนเป็นนับจากตอนแสดง QR
