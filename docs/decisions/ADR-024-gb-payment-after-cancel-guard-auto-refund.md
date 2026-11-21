# ADR-024 group buy: กันการชำระหลังสิทธิ์ถูกยกเลิก + ยกเลิก PaymentIntent ที่ค้าง + คืนเงินอัตโนมัติ

สถานะ: **accepted** — owner อนุมัติ**ฉบับแรก** 2026-11-21 (ก่อน review #425; ทิศทาง "กัน + คืนเงินอัตโนมัติ"); ฉบับแก้ตาม review #425 blocker 1–2 (เพิ่ม "race ที่ยอมรับ") ถูกนำกลับไปถาม owner อีกครั้ง 2026-11-21
→ owner **ไม่ยอมรับ race** และเลือกปิดด้วย GB-20b (ภาคผนวก 2026-11-21 ด้านล่าง — แทนย่อหน้า "race ที่ยอมรับ" ในผลที่ตามมา)
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

## ภาคผนวก 2026-11-21: ตรวจสถานะที่ provider ก่อนยกเลิก (GB-20b) — accepted (owner 2026-11-21)
บริบท: owner ไม่ยอมรับ "race ที่ยอมรับ" ข้างบน (ลูกค้าจ่ายสำเร็จก่อน deadline แต่ webhook มาช้า → ถูกยกเลิกสิทธิ์และต้องรอ ops คืนเงินมือ) → ปิดด้วยการตรวจสถานะ PaymentIntent
**ก่อน**ยกเลิก membership แทนการเผื่อเวลา ส่วนนี้แทนย่อหน้า "race ที่ยอมรับ" ในผลที่ตามมา (ข้อ (a), (c), (d) ไม่เปลี่ยน; (b) ยังทำเมื่อผลตรวจ = ยังไม่จ่าย)

ข้อเท็จจริงจาก source 2.22.1 (ตรวจใน `node_modules`):
- Payment module **ไม่มี** method สาธารณะสำหรับอ่านสถานะอย่างเดียว — `getStatus` อยู่ที่ `PaymentProviderService` ภายใน (`@medusajs/payment/dist/services/payment-provider.js:59-62`, เรียกผ่าน `paymentProviderService_` ที่ไม่ export)
  method สาธารณะที่อ่านสถานะคือ **`paymentModule.authorizePaymentSession(id, context)`** (`payment-module.js:224-280`) → provider `authorizePayment` (`payment-provider.js:55-58`)
  → Stripe `getPaymentStatus` (`payment-stripe/dist/core/stripe-base.js:129-139, 162-164` — `paymentIntents.retrieve` ไม่ห่อ error) → map สถานะ (`stripe-base.js:393-422`) — เส้นทางเดียวกับ guard ADR-015 A
- ผลของ `authorizePaymentSession`: session มี payment + `authorized_at` แล้ว → คืน payment เดิม (idempotent, `:239-241` ไม่เรียก provider); `pending_authorization` → update session แล้วคืน `null` (`:246-254`);
  สถานะอื่นที่ไม่ใช่ `authorized`/`captured` (PI `requires_payment_method`/`requires_confirmation`/`requires_action`/`canceled`) → update session `{ status, data }` แล้ว throw `MedusaError` **`NOT_ALLOWED`** (`:255-263`);
  **(แก้ตาม review #440 blocker)** PI `processing` เป็น `pending_authorization` **เฉพาะเมื่อตั้ง `asyncPaymentMethodTypes`** (`stripe-base.js:402-409`, `isAsyncPaymentMethod` `:508-510`) — `apps/backend/medusa-config.ts` ไม่ได้ตั้ง
  → ใน repo นี้ `processing` = `PENDING` → **`NOT_ALLOWED`** เหมือน "ยังไม่จ่าย" (ถ้านับเป็น unpaid: `deletePayment` ยกเลิก PI ที่ processing มักไม่ได้ (`:203-208` ยกเว้นแค่ canceled/succeeded) → PI สำเร็จทีหลัง → membership `cancelled` → (c) คืนเงิน — ลูกค้าที่จ่ายก่อน deadline ไม่ได้ order)
  ข้อมูลที่แยกได้: ก่อน throw module บันทึก `data` = PI object ที่ provider คืน (`getStatus` คืน `data: paymentIntent`, `stripe-base.js:393-422`) ลง session แล้ว และ `authorizePaymentSession` เป็น `@InjectManager` ไม่ใช่ transaction
  (`payment-module.js:878-884`) การ update จึงไม่ถูก rollback ตอน throw → อ่าน `paymentModule.retrievePaymentSession(id, { select: ["status", "data"] })` (method สาธารณะ — `authorizePaymentSessionStep` ใช้ที่ `:33`) ได้ `data.status` ของ PI โดยไม่เรียก Stripe อีก;
  ไม่ตั้ง `asyncPaymentMethodTypes` เพราะจะเปลี่ยน action ของ webhook `payment_intent.processing` (`stripe-base.js:447-449`) ของ cart ทั้งหมด;
  `authorized`/`captured` → `authorizePaymentSession_` สร้าง payment + (ถ้า `captured`) capture แบบไม่เรียก provider ซ้ำ (`:281-313`, `:413-436`) แล้ว `maybeUpdatePaymentCollection_` (`:278`);
  Stripe/network error → throw `Error` ธรรมดา (ไม่ใช่ `MedusaError`)
- **ไม่ใช้ `authorizePaymentSessionStep`** ของ core-flows: กลืน error ที่ไม่ใช่ `MedusaError` แล้ว throw `PAYMENT_AUTHORIZATION_ERROR` (`core-flows/dist/payment/steps/authorize-payment-session.js:23-50`) จึงแยก "provider ล่ม" กับ "ยังไม่จ่าย" ไม่ได้
  และ compensation เรียก `cancelPayment` (`:54-72`) — เหตุผลเดียวกับ ADR-015 A ข้อ 6 (เรียก module ตรงใน step ของเรา ไม่มี compensation ที่ยกเลิก payment)
- `authorizePaymentSession` **ไม่ emit `payment.captured`** — event มาจาก `capturePaymentWorkflow` (`core-flows/dist/payment/workflows/capture-payment.js:53-56`) ซึ่ง `processPaymentWorkflow` เรียกต่อจาก authorize ใน branch autocapture
  (`process-payment.js:114-144`); `capturePaymentWorkflow` บน payment ที่มี `captured_at` แล้วไม่สร้าง capture ใหม่และไม่เรียก provider (`payment-module.js:363-364`, `:427-436`) และ
  `addOrderTransactionStep` ข้าม transaction ที่ `reference_id` ซ้ำ (`core-flows/dist/order/steps/add-order-transaction.js:16-38`) → webhook ที่มาทีหลังรันซ้ำได้ไม่เกิดของซ้อน:
  capture/transaction ไม่ซ้ำตามข้างบน และ `payment.captured` ที่ถูก emit ซ้ำ (emit ทุกครั้งที่รัน) → GB-5 `paymentCapturedAction` ได้ `noop` เมื่อ membership `paid` แล้ว (`modules/group_buy/utils/membership-payment.ts:17-19`) จึงไม่แปลง order/alert/refund ซ้ำ
- payment ที่สองของ session เดียวกันสร้างไม่ได้ (unique index `IDX_payment_payment_session_id_unique` — spec 06 หมายเหตุรอบ 6) → job กับ webhook ที่ authorize พร้อมกันได้ payment เดียว ฝั่งที่แพ้ได้ error (ไม่ใช่ `NOT_ALLOWED`) → `retry`
  แล้วรอบถัดไปได้ payment เดิมแบบ idempotent; **ข้อจำกัด (review #440 nit 1):** ฝั่งที่แพ้ถูก module เรียก `cancelPayment` ของ provider ก่อน throw (`payment-module.js:265-276`) — กับ PI `succeeded` (ADR-007 `capture: true`) Stripe ปฏิเสธจึงไม่เสียหาย
  (`cancelPayment` ไม่ยกเว้น succeeded — `stripe-base.js:165-167`) แต่**ถ้าเปลี่ยนเป็น `capture: false`** ฝั่งที่แพ้จะยกเลิก PI ที่ authorize แล้วจริง → ต้องทบทวนภาคผนวกนี้ (เช่น lock ร่วมกับ webhook) ใน ADR ที่เปลี่ยน capture

การตัดสินใจ — job หมดเวลาชำระ ก่อนเรียก `expireGroupBuyMembershipPaymentWorkflow` ของ membership ที่เลือกได้ (filter เดิม: `awaiting_payment` + เลย deadline): ตรวจ**ทุก** session ของ collection ด้วย `authorizePaymentSession`
(รวม session ที่มี payment แล้ว — ได้ payment เดิมโดยไม่เรียก provider) แล้วตัดสินรวม
1. **จ่ายแล้ว** (ได้ payment จาก session ใดก็ได้) → `capturePaymentWorkflow` ของ Medusa กับ payment นั้น (emit `payment.captured` แบบเดียวกับ branch autocapture) → subscriber เดิม (GB-5) ตั้ง `paid` + `convertDraftOrderWorkflow`
   → **ไม่ยกเลิก** ไม่ลบ session ลูกค้าได้ order; job ไม่เรียก expire รอบนี้ (และ `shouldExpireMembershipPayment` ข้ามอยู่แล้วเพราะ collection ไม่อยู่ในกลุ่ม unpaid)
   **(review #440 nit 2)** ถ้า authorize สร้าง payment ได้แต่ `capturePaymentWorkflow`/แปลง order ล้ม membership ยัง `awaiting_payment` → รอบถัดไป job หยิบซ้ำ ได้ payment เดิมแล้วรัน capture ใหม่ (idempotent) —
   หยิบซ้ำเฉพาะเมื่อ `now − pay_deadline_at < 15 นาที` (เพดานเดียวกับข้อ 3) เกินแล้วหยุดและพึ่ง webhook (`process-payment.js:98-113`) / alert `convert_failed` ตามกฎข้อ 25 (manual — กันแปลง order ซ้ำทุกนาทีเมื่อสต็อกหมด)
2. **ยังไม่จ่าย** (ทุก session throw `NOT_ALLOWED` **และ** `data.status` ที่ Medusa บันทึกไว้ไม่ใช่ `processing`, หรือ collection ไม่มี session — ไม่เรียก provider) → expire ตามเดิม: ยกเลิก + (b) ลบ session (cancel PI)
3. **ตรวจไม่ได้** (error อื่นจาก provider, ได้ `null` = `pending_authorization`, หรือ **`NOT_ALLOWED` ที่ session มี `data.status === "processing"`** — การจ่ายกำลังดำเนินอยู่ที่ธนาคาร) → รอบนี้**ไม่ลบ ไม่ยกเลิก** + `logger.warn` บรรทัดเดียวขึ้นต้น `GROUP_BUY_PAYMENT_CHECK_FAILED` (membership, session, error) แล้วลองใหม่รอบถัดไป (job ทุก 1 นาที)
   **เพดาน: 15 นาทีนับจาก `pay_deadline_at`** (owner ยืนยัน 2026-11-21; ≈ 15 รอบ — วัดจากเวลา ไม่ต้องเก็บตัวนับ ไม่มี data model ใหม่) — ยังตรวจไม่ได้เมื่อ `now − pay_deadline_at ≥ 15 นาที` → expire ตามเดิม
   พร้อม `logger.error` ขึ้นต้น `GROUP_BUY_PAYMENT_CHECK_GAVE_UP` และอีเมลหา `OPS_ALERT_EMAIL` (idempotency key ต่อ membership — แบบเดียวกับ alert เดิม; ไม่ตั้ง env → warn แล้วข้าม; ส่งล้มไม่ทำให้ job ล้ม)
   ให้ ops ตรวจ PI ใน Stripe ตาม runbook ADR-015 D (หลังยกเลิก ถ้า PI ยังจ่ายได้และ session ยังอยู่ → `payment.captured` → (c) คืนเงินอัตโนมัติ; ถ้า session ถูกลบแล้ว → ADR-015 D)
- **ไม่เผื่อเวลา (owner เลือก 2026-11-21):** deadline ที่ประกาศยังเป็นจุดตัด guard `GB_PAYMENT_CLOSED` (a) ไม่เปลี่ยน — หลัง deadline สร้าง session ใหม่ไม่ได้ทันที; การตรวจนี้ไม่ให้สิทธิ์จ่ายเพิ่ม
  แค่ไม่ยกเลิกเงินที่จ่ายสำเร็จ**แล้ว** (เหตุผล: เผื่อเวลาทำให้ deadline ที่ลูกค้าเห็นไม่ตรงความจริงและเลื่อนการคืนสต็อก/ปิดกลุ่ม ส่วนการตรวจที่ provider ปิด race ได้ตรงจุดกว่า)
  ข้อยกเว้นที่รู้: ช่วงที่ provider ล่ม (ข้อ 3) PI ที่เปิดค้างก่อน deadline ยังจ่ายได้นานสุดถึงเพดาน — ถ้าจ่ายได้ รอบถัดไปเจอ "จ่ายแล้ว" → ได้ order
- race ที่เหลือ: PI สำเร็จในช่วงมิลลิวินาทีระหว่างตรวจ (ยังไม่จ่าย) กับ `deletePayment` → ตกตาข่าย ADR-015 D (`PAYMENT_WEBHOOK_SESSION_NOT_FOUND` + อีเมล) เหมือน TOCTOU ของ ADR-015 A
- ขอบเขต ADR-007/ADR-015: เป็นรูปแบบเดียวกับ guard ADR-015 A ("ตรวจผ่าน `authorizePaymentSession` ก่อนลบ session ที่ Medusa ยังรู้จัก") ขยายไปที่ job — **ไม่ใช่** reconciliation แบบ ADR-015 B
  (ไม่ค้น PI ใน Stripe ที่ Medusa ไม่มี session) ไม่เรียก Stripe SDK ตรง ไม่สร้าง payment/capture นอก method/workflow ของ Medusa
- ผลที่ตามมา: Stripe retrieve 1 ครั้งต่อ session ต่อรอบของ membership ที่หมดเวลา (≤ 50 ต่อรอบตาม batch เดิม); การยกเลิกช้ากว่า deadline ได้ ≤ 15 นาทีเฉพาะตอนตรวจไม่ได้ (provider ล่ม/PI `processing`);
  **ข้อจำกัด (review #440 nit 4):** ระหว่าง provider ล่ม membership ที่อยู่ใน `retry` ยังผ่าน filter ของ job ทุกรอบ (`group-buy-deadline.ts:56-59`, `take: 50` + หมุนหน้าต่างด้วย `deadlineBatchSkip`) — ถ้าค้างเกิน 50 รายการ
  membership ที่หมดเวลาทีหลังอาจถูกตรวจช้ากว่า 1 นาที/รายการ และ give up ได้ช้ากว่า 15 นาที (ยอมรับ — ไม่แก้ batch ใน GB-20b; ร้านเดียวกลุ่มพร้อมกันน้อย);
  task **GB-20b** (spec 04 กฎข้อ 50, AC-68) หลัง GB-20
