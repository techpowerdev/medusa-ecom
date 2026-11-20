# ADR-024 group buy: กันการชำระหลังสิทธิ์ถูกยกเลิก + ยกเลิก PaymentIntent ที่ค้าง + คืนเงินอัตโนมัติ

สถานะ: **accepted** (owner อนุมัติ 2026-11-21 — ฉบับที่แก้ตาม review #425 blocker 1–2; ทิศทางจากคำตัดสิน owner 2026-11-21 "กัน + คืนเงินอัตโนมัติ")
เกี่ยวข้อง: ADR-015 (guard `PAYMENT_ALREADY_COMPLETED`, ตาข่าย D), ADR-016 (GB-8), spec 04 กฎข้อ 9, 22, 25, 26, 42–45 และ Q13 (เดิม = ก manual), spec 06 กฎข้อ 4, 7, 9;
task GB-20, GB-21, GB-22 (spec 04 รอบ 40); แทนที่ส่วน "ไม่ refund อัตโนมัติ" ของ spec 04 กฎข้อ 25/26 และ Q13 **เฉพาะกรณีเงินเข้าหลัง membership ถูกยกเลิก**

## บริบท
- การทดสอบ manual เฟส 6 (GB-BUG-1, 2026-11-20): ลูกค้าเปิดหน้า `/th/account/orders/<id>/pay` ค้างไว้ข้าม `pay_deadline_at` แล้วกดจ่าย → ถูกตัด ฿710 ไม่มี order
  มีแค่ log `GROUP_BUY_PAID_WITHOUT_ORDER` (+ อีเมล ops ถ้าตั้ง `OPS_ALERT_EMAIL`) และหน้า pay ขึ้น "ชำระเงินเรียบร้อยแล้ว"
- สาเหตุในโค้ด (develop `87cb20df`, ตรวจกับ source 2.22.1 — แก้ตาม review #425):
  1. `POST /store/payment-collections/:id/payment-sessions` มีแค่ auth + ownership (ADR-013) + `guardPaidStripeSession` (ADR-015) — **ไม่ตรวจสถานะ membership/deadline** (`apps/backend/src/api/middlewares.ts:53-57`)
  2. job หมดเวลาชำระเรียก `cancelOrderWorkflow` (`cancelMemberOrdersStep`, `src/workflows/group-buy/group-outcome.ts:178-179`) ซึ่ง**ตั้ง payment collection ทุกชุดของ order เป็น `canceled` อยู่แล้ว**
     (`core-flows/dist/order/workflows/cancel-order.js:145-152`) แต่**ไม่ลบ payment session** → PaymentIntent เดิมยังเปิดอยู่ที่ Stripe (หน้าบัตรที่กรอกค้าง/QR พร้อมเพย์ยังจ่ายได้)
     — `deletePaymentSessionsWorkflow` ลบ session ผ่าน provider: Stripe `deletePayment` cancel PI และ**กลืน error เมื่อ PI `succeeded` แล้ว** (`payment-stripe/dist/core/stripe-base.js:203-208`)
     แล้ว Payment module hard-delete session ต่อ (`payment/dist/services/payment-module.js:217-223`)
  3. subscriber `group-buy-payment-captured.ts` ตัดสิน `orphan` (`membership-payment.ts:13-24`) แล้วส่งแค่ alert ตามกฎข้อ 25 (owner Q13 = ก, 2026-10-28)
- `refundPaymentWorkflow` (route refund ของ admin) คืนเงินที่ provider **ก่อน** (`refund-payment.js:138`) แล้วสร้าง credit line (`:183`) ซึ่ง `validateOrderRefundCreditLinesStep` → `throwIfOrderIsCancelled`
  (`order/workflows/payments/create-order-refund-credit-lines.js:14-15`) → บน draft order ที่ยกเลิกแล้วอาจ**คืนเงินสำเร็จแต่ workflow throw** (รูปแบบเดียวกับ B-1) ส่วน `refundPaymentsWorkflow`
  (ที่ `src/scripts/refund-orphan-payment.ts` และ `compensatePaymentIfNeededStep` ของ Medusa ใช้) refund payment โดยไม่สร้าง credit line และไม่ตรวจสถานะ order

## ทางเลือก
1. **คงแบบ manual** (กฎข้อ 25 เดิม) — owner ไม่เลือก
2. **กันอย่างเดียว** (guard ที่ route สร้าง session) — PI ที่สร้างก่อน deadline ยังจ่ายได้หลังยกเลิก → ยังต้อง refund มือ
3. **กัน + ยกเลิก PI ตอนยกเลิกสิทธิ์ + คืนเงินอัตโนมัติเป็นตาข่าย** — ปิดช่องหลัก เงินผ่าน workflow ของ Medusa เท่านั้น เหลือ race เล็ก (ดูผลที่ตามมา)
3b. (พิจารณาแล้ว ไม่เลือก) กัน + **ไม่ลบ session** พึ่ง (c) อย่างเดียว — ครอบ race ของข้อ 3 ได้ แต่ลูกค้าที่กรอกบัตร/สแกน QR ค้างไว้จะ**ถูกตัดเงินแล้วคืน**ทุกครั้ง (เห็นสองรายการ — ปัญหาเดียวกับ O2 ที่ owner ไม่อยากให้เกิด)
   และยังไม่ยืนยันว่า Medusa 2.22.1 authorize/capture session บน collection ที่ `canceled` แล้วได้หรือไม่
4. เปลี่ยนเป็นชำระตอน join (pre-auth) — ขัด ADR-004 ไม่พิจารณา

## การตัดสินใจ: ทางเลือก 3
(a) **guard** — middleware ใหม่บน `POST /store/payment-collections/:id/payment-sessions` ลงทะเบียน**หลัง** ownership (ADR-013) และ**ก่อน** `guardPaidStripeSession`:
    อ่านด้วย `query.graph` ว่า collection ผูก order ที่มี `metadata.group_buy_membership_id` หรือไม่ (ไม่ผูก/เป็น collection ของ cart → `next()` ทันที);
    ถ้าผูก: membership ต้อง `awaiting_payment` **และ** `now < group.pay_deadline_at` **และ** collection ไม่ `canceled` — ไม่เช่นนั้น throw
    `MedusaError(NOT_ALLOWED, …, "GB_PAYMENT_CLOSED")` → **400** `{ type: "not_allowed", code: "GB_PAYMENT_CLOSED", message }` (builder ยืนยันใน integration ว่า 400 คง `code`
    ถ้า handler ทับให้เพิ่มใน allow-list ของ PROMO-2) ไม่เรียก provider, ไม่สร้าง/ลบ session
(b) **ยกเลิก PI ที่ค้างเมื่อสิทธิ์ถูกยกเลิก** — หลัง `cancelOrderWorkflow` ของ membership ที่มี payment collection (job หมดเวลาชำระ; fail/leave ไม่มี collection → noop) เรียก
    `deletePaymentSessionsWorkflow` ของ Medusa กับ session ของ collection นั้นที่ยังไม่มี payment (`authorized`/`captured` ไม่แตะ) — **ไม่เรียก `cancelPaymentCollectionWorkflow`**
    (`cancelOrderWorkflow` ตั้ง `canceled` ให้แล้ว และ workflow นั้นจะ throw "already canceled"); best-effort: error → `logger.warn` บรรทัดเดียวขึ้นต้น `GROUP_BUY_SESSION_CANCEL_FAILED`
    แล้วไปต่อ (ไม่ทำให้การยกเลิก membership ล้ม); ไม่เรียก Stripe SDK ตรง (spec 06 กฎข้อ 4)
(c) **คืนเงินอัตโนมัติ** — ใน subscriber `payment.captured` เมื่อ `paymentCapturedAction` = `orphan` **และ** membership `cancelled` (อ่านสถานะใหม่ตามกฎข้อ 25a):
    ภายใต้ lock ต่อ payment (`group_buy:refund:<payment_id>`) อ่านยอดคงเหลือ = captured − refunded (`MathBN` จาก `raw_*`) ≤ 0 → noop + log info;
    ไม่เช่นนั้นเรียก **`refundPaymentsWorkflow`** ของ Medusa (แบบเดียวกับ `refund-orphan-payment.ts` — ไม่สร้าง credit line จึงไม่ชน `throwIfOrderIsCancelled`) ยอดคงเหลือ
    `note: "Refunded: group buy membership cancelled"` — **ไม่ใช้** `refundPaymentWorkflow` ในเส้นทางนี้;
    **ผลตัดสินจากการอ่าน `payment.refunds` ใหม่หลัง workflow จบหรือ throw** (ไม่ใช่จาก exception): ยอดคงเหลือ = 0 → `refunded` (แม้ workflow throw — log warn พร้อม error);
    ยอดคงเหลือ > 0 → `refund_failed`; แล้วส่ง alert เดิม `GROUP_BUY_PAID_WITHOUT_ORDER` ที่มีผลนี้ — `refund_failed` เป็นระดับ error ให้ ops ทำตาม runbook (ตรวจ `refunds` ก่อนคืนมือทุกครั้ง)
    กรณี `convert_failed` (membership ยัง `awaiting_payment`) **คงเดิม** (manual — สต็อกหมดต้องมีคนตัดสิน)
(d) storefront แสดงสถานะยกเลิก/คืนเงินจาก GB-8 แทน "ชำระแล้ว" เมื่อ membership `cancelled` (spec 04 กฎข้อ 45)

## ผลที่ตามมา
- ปิดช่อง API (a) และช่อง PI ค้าง (b) ในกรณีปกติ; เงินที่ capture ผ่าน Medusa หลังยกเลิกคืนอัตโนมัติ (c); ops ยังได้อีเมลทุกครั้ง
- **race ที่ยอมรับ (manual):** PI จ่ายสำเร็จที่ Stripe **ก่อน** (b) ลบ session แต่ webhook มาถึง**หลัง**ลบ (เช่น สแกนพร้อมเพย์ใกล้ deadline, webhook ถูก retry) →
  `processPaymentWorkflow` หา session ไม่เจอ ไม่มี `payment.captured` → (c) ไม่ทำงาน → ตกตาข่าย ADR-015 D (`payment-webhook-orphan.ts`: log + อีเมล `PAYMENT_WEBHOOK_SESSION_NOT_FOUND`)
  และ ops คืนเงินด้วยมือใน Stripe ตาม runbook เดิม — ช่วงเวลาแคบ (job รันทุก 1 นาทีหลัง deadline, webhook ปกติถึงในไม่กี่วินาที) จึงยอมรับแทนทางเลือก 3b; spec 04 AC-62(g) ยืนยันว่ายังได้ alert ครบ
- เพิ่มเส้นทางเงินอัตโนมัติหนึ่งเส้น (กันซ้ำด้วย lock + ยอดคงเหลือ; test ส่ง event ซ้ำ/พร้อมกัน และ refund draft order ที่ยกเลิกจริงไม่ mock workflow)
- `middlewares.ts` มี middleware บน route เดียวกันหลายตัว (ลำดับตาม ADR-025) — ต้องคงที่และมี test
- ความเสี่ยงที่เหลือ: Stripe ล่มตอน refund → `refund_failed` + runbook
