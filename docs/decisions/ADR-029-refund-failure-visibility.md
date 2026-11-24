# ADR-029 ระบบต้องรู้เมื่อการคืนเงินล้มหรือค้าง (alert ถึง ops)

สถานะ: **proposed** (planner 2026-11-24 ตามคำสั่ง owner Q-P17 = ทำใน v0.3.1; รอ owner เลือกทางเลือก — spec 06 Q-P18)
เลข: ADR-027 สงวนให้ ADR วิธี deploy/staging จึงใช้ 029
เกี่ยวข้อง: ADR-015 (alert `OPS_ALERT_EMAIL`, script `refund-orphan-payment.ts`), ADR-023 (webhook endpoint เดียว), ADR-024 (GB auto-refund), ADR-025,
spec 06 กฎข้อ 4/7D/13/17/21 และหัวข้อ "Follow-up รอบ 42 — การคืนเงินล้ม/ค้าง" (กฎข้อ 22–24, PAY-20/PAY-21), spec 07 (`OPS_ALERT_EMAIL`)

## บริบท (ตรวจกับ source 2.22.1 ใน `node_modules` จริง, 2026-11-24)
1. **refund ที่ provider ปฏิเสธ "สำเร็จเงียบ"** — `refundPaymentsStep` (`@medusajs/core-flows/dist/payment/steps/refund-payments.js:15-17`) ครอบ
   `paymentModule.refundPayment` ด้วย `.catch(e => logger.error("Error was thrown trying to cancel payment - …"))` แล้วคืนเฉพาะ payment ที่สำเร็จ
   ผู้เรียก `refundPaymentsWorkflow` ทั้งหมดจึงไม่เห็น error:
   - `compensatePaymentIfNeededStep` → `refundPaymentAndRecreatePaymentSessionWorkflow` (complete cart ล้มหลังตัดเงิน — flash sold-out ฯลฯ ทางหลักของ PAY-11/15/19)
   - `cancelOrderWorkflow` → `refundCapturedPaymentsWorkflow` (admin ยกเลิก order) — และ `refundPaymentsWorkflow:99-121` **เพิ่ม order transaction ของ refund
     ทุกรายการใน input แม้ refund ล้ม** (ยอดใน order ไม่ตรงกับเงินจริง)
   - ของเรา: GB-21 (`refund-cancelled-membership.ts` — อ่านยอดใหม่และ alert `refund_failed` อยู่แล้ว), script `refund-orphan-payment.ts` (ตรวจยอดหลังรันแล้ว)
   - ต่างจาก `refundPaymentStep` ของ admin route (`refund-payment.js:10-13`) ที่ throw → admin เห็น toast error
2. **Payment module เก็บร่องรอยไว้แล้ว** — `refundPayment` (`@medusajs/payment/dist/services/payment-module.js:439-470`) สร้างแถว `refund` สถานะ `pending`
   → provider ล้ม → `status = failed` แล้ว **soft-delete** (comment ของ Medusa: เก็บไว้ให้ retry ด้วย idempotency key เดิม); สำเร็จ → `succeeded`
   (`RefundStatus` ใน `@medusajs/utils/dist/payment/refund.js`) แถว `pending` ที่ process ตายกลางทาง = ไม่รู้ผล (Medusa กู้เมื่อมี retry ที่ใช้ key เดิมเท่านั้น)
3. **ไม่มี event/hook ของ refund ที่ล้ม** — `refundPaymentsWorkflow` ไม่มี `createHook` และไม่ emit event; `payment.refunded` (`PaymentEvents.REFUNDED`) emit จาก
   `refundPaymentWorkflow` (admin) เมื่อสำเร็จเท่านั้น
4. **Stripe PromptPay refund เป็น async** — `refunds.create` ได้ `status: requires_action` (Stripe อีเมลลูกค้าขอเลขบัญชี) ผลสุดท้ายมาทาง webhook
   `refund.updated`/`refund.failed` (docs.stripe.com/payments/promptpay "Tracking refunds"); บัตรปกติ `succeeded` ทันที แต่ล้มภายหลังได้ (บัตรทดสอบ `4000 0000 0000 5126`)
   `StripeBase.refundPayment` (`@medusajs/payment-stripe/dist/core/stripe-base.js:210-230`) ไม่ดู `status` ของ refund → Medusa บันทึก `succeeded` และนับ refunded ทันที
5. **webhook ของ refund ไม่ถูกจัดการ** — `StripeBase.getWebhookActionAndData` (`stripe-base.js:425-506`) ตรวจ signature ก่อน (`constructWebhookEvent`) แล้วคืน
   `not_supported` เพราะ Refund object ไม่มี `metadata.session_id`; core subscriber (`@medusajs/medusa/dist/subscribers/payment-webhook.js:19-32`) ข้าม event นี้
   endpoint ของเรา (ADR-023, `docs/ops/production.md` "Stripe webhooks") สมัครเฉพาะ `payment_intent.*` จึงไม่ได้รับ `refund.*` อยู่แล้ว
6. มีกลไกแจ้ง ops อยู่แล้ว: `OPS_ALERT_EMAIL` + Notification module (Resend) แบบ best-effort (`payment-webhook-orphan.ts`, `group-buy-payment-captured.ts`,
   `membership-payment.ts`) และ Notification module มี `idempotency_key` กันส่งซ้ำ (`notification-module-service.js:39-55`)
7. เกิดจริงใน CI (PAY-19 #548): PromptPay ฿810 ถูกตัดแล้วไม่ถูกคืน (Stripe: "Cannot send email…") — มีแค่ log, ops ไม่รู้

## ทางเลือก
- **ก. ตรวจแถว `refund` ของ Payment module ด้วย scheduled job** (ฝั่ง Medusa: ล้มทันที/ค้าง) — job ทุก 15 นาทีอ่าน `refund` ที่ `status=failed` (withDeleted)
  หรือ `pending` เกิน 60 นาที ย้อนหลัง 7 วัน ผ่าน `paymentModule.listRefunds` + `query.graph` (cart/order) แล้ว log error + อีเมล `OPS_ALERT_EMAIL`
  (idempotency key ต่อแถว refund) — ครอบ**ทุก**ผู้เรียก (Medusa และของเรา) โดยไม่แตะ workflow ของ Medusa; ไม่เพิ่ม infra (scheduled job ของ Medusa ที่ worker รันอยู่แล้ว);
  ข้อเสีย: ช้าสูงสุด ~15 นาที, พึ่งพฤติกรรม "soft-delete แถว failed" ของ 2.22.1 (กันด้วย integration test ทุก bump), ไม่เห็นผล async ของ Stripe
- **ข. รับ webhook `refund.failed`/`refund.updated` ผ่าน endpoint เดียวของ ADR-023** (ฝั่ง Stripe: ล้มภายหลัง) — subscriber ใหม่บน `payment.webhook_received`
  เรียก `paymentModule.getWebhookActionAndData(input)` เพื่อให้ provider ตรวจ signature (แบบเดียวกับ `payment-webhook-orphan.ts`) แล้วอ่าน body ที่ตรวจแล้ว:
  refund `failed`/`canceled` → log error + อีเมล — ไม่เรียก Stripe API, ไม่แก้ข้อมูลใน Medusa; ต้องเพิ่ม event 2 ตัวใน Stripe Dashboard + `ci.yml` + เอกสาร (OPS-10);
  ข้อเสีย: ไม่เห็น refund ที่ล้มตั้งแต่ `refunds.create` (ข้อ 1) เพราะไม่มี refund ใน Stripe เลย
- **ค. ห่อผู้เรียก `refundPaymentsWorkflow` ของเราเอง** ให้ตรวจยอดหลังคืน — ครอบแค่ GB-21/script (ทำอยู่แล้ว) **ไม่ครอบ** `compensatePaymentIfNeededStep`/`cancelOrderWorkflow`
  ซึ่งเป็นทางหลัก — ไม่พอ
- **ง. เขียน Stripe provider เอง/override `refundPayment`** ให้ throw เมื่อ `requires_action` หรือ patch `refundPaymentsStep` — ขัดข้อห้ามข้อ 1 (สร้างของ Medusa ซ้ำ/patch library),
  และ PromptPay ทุกรายการจะกลายเป็น "ล้ม" ทั้งที่เงินกำลังคืน — ไม่เลือก
- **จ. ดัก log `Error was thrown trying to cancel payment`** (log drain/alert จาก log) — ต้องมี infra/log alerting ใหม่ และผูกกับข้อความที่ Medusa เปลี่ยนได้ — ไม่เลือก
- **ฉ. job เรียก Stripe API ตรวจ refund ที่ `requires_action` นานเกิน N วัน** — ขัดกฎข้อ 4 ของ spec 06 (ห้ามเรียก Stripe ตรงนอก provider) และ Stripe ส่ง `refund.failed`
  เองเมื่อหมดอายุ (ข) — ไม่เลือก

## การตัดสินใจ (เสนอ)
**Recommended: ก + ข** (สองช่องที่ไม่ทับกัน: ก = refund ที่ไม่เคยถึง/ไม่รู้ผลที่ Stripe, ข = refund ที่ Stripe รับแล้วล้มภายหลัง) — ส่งมอบเป็น PAY-20 (ก) และ PAY-21 (ข)
- alert ใช้ helper เดียว `src/lib/ops-alert.ts` (ผู้ใช้จริง 2 ที่ = PAY-20, PAY-21 — ตามกฎ abstraction) + template อีเมลเดียว `refund-failed` (ระบุแหล่ง `medusa`/`stripe`)
- **ไม่**แก้สถานะเงินใน Medusa อัตโนมัติ, ไม่ refund ซ้ำอัตโนมัติ, ไม่แจ้งลูกค้าอัตโนมัติ — ops ทำตาม runbook ใหม่ใน `docs/ops/production.md`
  ("คืนเงินล้ม/ค้าง (ADR-029)") ซึ่งใช้ทางที่มีอยู่: `refund-orphan-payment.ts` (payment ไม่ผูก order), Refund ใน admin (ผูก order), หรือคืนนอก Stripe แล้วบันทึก incident
- ไม่เพิ่ม table/queue/service/dependency; dedupe ด้วย `idempotency_key` ของ Notification module

## ผลที่ตามมา
- **ข้อความ "คืนเงินแล้ว" ของหน้าร้าน (PAY-11/15/19)**: เป็นการบอก "ระบบเริ่มคืนเงิน" ไม่ใช่ "เงินถึงลูกค้าแล้ว" — กรณี refund ล้มทันที (ข้อ 1) ลูกค้ายังเห็นข้อความของ PAY-11/15
  (ตัดสินจาก code error ของ complete ไม่ใช่จาก refund จริง) ส่วนสัญญาณ refunded ของ PAY-6c/PAY-19 (`refunded_amount ≥ captured_amount`) **ไม่จริง** → หน้าเดิมไม่แสดง notice
  คืนเงิน (การจ่ายซ้ำถูกกันโดย guard `PAYMENT_ALREADY_COMPLETED` ของ ADR-015 — ไม่ตัดเงินซ้ำ); ADR นี้ทำให้ ops รู้ภายใน ~15 นาทีแล้วติดต่อลูกค้า — ไม่แก้ข้อความหน้าร้าน
  (ข้อความพร้อมเพย์ของ Q-P16 "เริ่มคืนเงินแล้ว Stripe จะส่งอีเมล…" สอดคล้องกับ `requires_action` อยู่แล้ว)
- **`requires_action` ไม่ใช่ alert**: refund พร้อมเพย์ที่รอลูกค้ากรอกบัญชีถือว่าปกติ; ถ้าลูกค้าไม่กรอกจนหมดอายุ Stripe ส่ง `refund.failed` → alert ของ PAY-21
- ข้อมูลใน Medusa หลัง refund ล้มภายหลัง (ข) ยังแสดง refunded — ops บันทึก incident และ note ใน order; การปรับยอดใน Medusa อยู่นอกขอบเขต (spec 06 Q-P19)
- GB-21 มี alert `refund_failed` ของตัวเองอยู่แล้ว → refund GB ที่ล้มได้อีเมลสองฉบับ (คนละบริบท) — ยอมรับ
- **bump `@medusajs/*`**: integration test ของ PAY-20 ยืนยันว่า (1) `refundPaymentsWorkflow` ยังกลืน error (ถ้า Medusa แก้ให้ throw → ทบทวน ADR นี้และผู้เรียกของเรา)
  (2) แถว failed ยังอ่านได้ด้วย withDeleted — ล้ม = หยุด bump
- **upstream**: เสนอเปิด issue ที่ Medusa เรื่อง `refundPaymentsStep` กลืน error และ `refundPaymentsWorkflow` เพิ่ม order transaction ของ refund ที่ล้ม (session หลักถาม owner ก่อนเปิด — spec 06 Q-P20)
- **go-live**: PAY-20/PAY-21 อยู่ใน v0.3.1 (ก่อน go-live); endpoint ของ live mode ต้องสมัคร `refund.updated` + `refund.failed` และตั้ง `OPS_ALERT_EMAIL` (go-live checklist ข้อใหม่ที่ PAY-21 เพิ่ม)
- การย้อนกลับ: ลบ job/subscriber และ event ใน Dashboard — ไม่มี migration
