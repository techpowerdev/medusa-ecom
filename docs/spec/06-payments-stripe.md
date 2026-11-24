# 06 Payments — บัตรผ่าน Stripe + PromptPay ไทย

สถานะ: draft
เป้าหมาย (เจ้าของ): รับชำระด้วยบัตรเครดิต/เดบิตและ PromptPay ผ่าน Stripe
การตัดสินใจ: ใช้ Stripe provider ที่มีมากับ Medusa, capture อัตโนมัติ (ADR-007) **ไม่มี custom payment code**
ข้อยกเว้นที่ owner ยอมรับ: ADR-015 (accepted 2026-10-26) — guard + alert สำหรับ race QR หมดอายุ × จ่ายสำเร็จ (กฎข้อ 7, PAY-6)
ตรวจสอบแล้ว (เอกสาร Medusa, 2026-10): `@medusajs/medusa/payment-stripe` ลงทะเบียน
`pp_stripe_stripe` (บัตร) และ `pp_stripe-promptpay_stripe` (PromptPay); Medusa มี webhook route ต่อ provider แต่เราลงทะเบียน
endpoint **เดียว** `{server}/hooks/payment/stripe_stripe` รับ event ของทั้งบัตรและ PromptPay (ADR-023 — signing secret ต่อ endpoint
แต่ `STRIPE_WEBHOOK_SECRET` ใส่ได้ค่าเดียว) ห้ามลงทะเบียน `{server}/hooks/payment/stripe-promptpay_stripe`

## สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | วิธีใช้ |
|------|-----------------|-----|
| ชำระด้วยบัตร (3DS) | `pp_stripe_stripe` | ใช้ตามเดิม |
| PromptPay QR | `pp_stripe-promptpay_stripe` | ใช้ตามเดิม |
| Payment sessions, authorize, capture, refund | Payment module + core flows | ใช้ตามเดิม |
| จัดการ webhook + idempotency | `/hooks/payment/*` | ใช้ตามเดิม |
| ชำระเงินสำหรับ (draft) order ที่มีอยู่แล้ว | Order payment collection + store payment routes | ใช้ตามเดิม (group buy, spec 04) |
| storefront อ่าน draft order + payment collection/session ของ order | **ไม่มี** ใน Store API 2.22.1 (`GET /store/orders*` กรอง draft, ไม่มี GET payment collection) | route อ่านอย่างเดียวของ GB-8 (spec 04 กฎข้อ 21, **ADR-016 accepted** owner 2026-10-27) — PAY-3b ใช้ |
| Checkout ด้วย Stripe Elements ใน storefront | Next.js starter | ขยายเพื่อรองรับ PromptPay + หน้าชำระเงินของ order |
| Admin: เปิดใช้ provider ต่อ region, refund | Admin | ตั้งค่า |
| ยกเลิก PaymentIntent เดิมเมื่อเปลี่ยน session | สร้าง session ใหม่ → Medusa ลบ session เดิม → Stripe provider cancel PI — **แต่ลบ session ได้แม้ PI `succeeded`** (PAY-5, ADR-015) | ขยาย: guard ก่อนสร้าง session ใหม่ (PAY-6, กฎข้อ 7) |
| อ่านสถานะ PI ของ session เดิม (ไม่เรียก Stripe ตรง) | `paymentModule.authorizePaymentSession(id)` → provider `authorizePayment` → `getPaymentStatus` ของ Stripe provider (ตรวจกับ source 2.22.1 ใน ADR-015) | ใช้ตามเดิมใน guard ของ PAY-6 |
| lock ข้าม request | Locking module (`Modules.LOCKING`) key `cart_id` (key เดียวกับ `processPaymentWorkflow`) | ใช้ตามเดิมใน guard ของ PAY-6 |
| อ่าน/ตรวจ webhook ของ provider | `paymentModule.getWebhookActionAndData(input)` (ที่ core subscriber ของ `payment.webhook_received` ใช้) | ใช้ตามเดิมใน subscriber alert ของ PAY-6 |
| ส่งอีเมล alert | Notification module + Resend provider ที่มีอยู่ | ใช้ตามเดิม |
| refund payment ที่ collection ไม่ผูก order | `refundPaymentsWorkflow` (core-flows 2.22.1) — Medusa ใช้เองใน `compensatePaymentIfNeededStep` ของ `completeCartWorkflow` | ใช้ตามเดิมผ่าน script `medusa exec` (ADR-015 ภาคผนวก 2, AC-16c) |
| error 409 พร้อม code ของเรา | `businessErrorHandler` ของ PROMO-2 (spec 03 กฎข้อ 13) | ใช้ตามเดิม: เพิ่ม `PAYMENT_ALREADY_COMPLETED` ใน allow-list |

## การตั้งค่า
- บัญชี Stripe: นิติบุคคลไทย (PromptPay ต้องใช้บัญชี Stripe ประเทศไทย, THB)
- `medusa-config.ts`: payment module พร้อม Stripe provider id `stripe`, `capture: true`,
  `automaticPaymentMethods: false`
- Region Thailand: เปิดใช้ทั้งสอง provider
- Env: `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_KEY`
- Webhook endpoint เดียว `/hooks/payment/stripe_stripe` ลงทะเบียนใน Stripe dashboard (ADR-023); events: `payment_intent.*`

## Storefront
- ขั้นตอนชำระเงินใน checkout: "Card" (Stripe Elements) / "PromptPay" (Stripe.js `confirmPromptPayPayment(clientSecret, …,
  { handleActions: false })` แล้ว storefront แสดงรูป QR จาก `next_action` ของ PaymentIntent เอง — ไม่ใช้ PaymentElement/modal ของ Stripe
  (ปรับถ้อยคำให้ตรงกับที่ PAY-2 ทำและ reviewer ยอมรับ, 2026-10-26); poll จน webhook complete cart; หมดอายุ 10 นาที **นับจาก
  `created` ของ PaymentIntent** (สร้างตอนเลือก PromptPay ไม่ใช่ตอนแสดง QR — ดู Q3) — ครบกำหนดแล้วเช็กสถานะ PI ก่อน ถ้ายังไม่ชำระจึงสร้าง
  session ใหม่ (Medusa ลบ session เดิม → provider cancel PI เดิม))
- `/account/orders/:id/pay`: ใช้ payment component เดียวกัน ผูกกับ payment collection ของ order
  (ใช้โดย group buying) — (รอบ 10) อ่านข้อมูลจาก `GET /store/customers/me/group-buy/orders/:order_id` (GB-8) สร้าง/ต่อ session ด้วย route ของ Medusa (กฎข้อ 9)
- Error states: บัตรถูกปฏิเสธ, 3DS ล้มเหลว, PromptPay หมดอายุ → ลองใหม่ได้; cart/order ยังคงอยู่
- ต้อง login ก่อน checkout (กฎทั้งร้าน, spec 01)
- ภาษา (ADR-014, 2026-10-26): ข้อความ UI เป็นภาษาไทยตรงในโค้ด และ e2e หาด้วย test id — PAY-2 (#48) ทำไปด้วยข้อความอังกฤษแล้ว **ไม่แก้ใน #48**
  การแปลข้อความของ PAY-2 เป็นภาษาไทยอยู่ใน spec 01 CORE-4d (Depends PAY-2); PAY-3 และ PAY-5 เขียนข้อความใหม่เป็นภาษาไทย (label อังกฤษ
  ในเครื่องหมายคำพูดใน spec นี้ = ชื่อเรียก element)

## Business rules
1. ยอดเงินทั้งหมดเป็น THB ในหน่วยหลัก (major units) ของ Medusa; Stripe provider แปลงเป็นสตางค์เอง
2. order จะถูกสร้างก็ต่อเมื่อ payment session ถูก authorized/captured แล้วเท่านั้น (ค่าเริ่มต้นของ Medusa)
3. Webhook event เป็น source of truth สำหรับการชำระ PromptPay สำเร็จ
4. Refund ทำผ่าน `refundPaymentWorkflow` เท่านั้น; ห้ามเรียก Stripe API โดยตรงนอก provider — ข้อยกเว้นตาม ADR-015: PI ที่ไม่มี payment ใน Medusa
   (refund ด้วยมือใน Stripe dashboard) และ payment captured ที่ collection ไม่ผูก order (`refundPaymentsWorkflow` ผ่าน script `refund-orphan-payment.ts`, รอบ 8)
5. PaymentIntent ของ provider บัตร (`pp_stripe_stripe`) มี `payment_method_types: ["card"]` เท่านั้น (ไม่เปิด method อื่นโดยปริยาย)
   ส่งผ่านช่องทางที่ Medusa Stripe provider รองรับ (เช่น `data` ของ payment session) — ถ้าทำไม่ได้โดยไม่เขียน provider เอง ให้หยุดและเขียน ADR
6. production ห้ามมี `pp_system_default` (manual) ใน region — ADR-010 (accepted) ระดับ D1: seed ไม่ใส่ให้ใน production และ
   `check:go-live` ตรวจ region ก่อนเปิดร้าน (ไม่กัน admin เปิดเองผ่าน dashboard) ส่งมอบใน OPS-7 (spec 07)
7. (PAY-5 → ADR-015 accepted A + D, ปรับ 2026-10-26) PAY-5 พบกรณี (b): Medusa 2.22.1 ลบ session ได้แม้ PI `succeeded` → webhook หา session
   ไม่เจอ → เงินถูกตัดแต่ไม่มี order กฎที่ใช้แทน:
   (A) **guard** (PAY-6): middleware ใน `src/api/middlewares.ts` บน `POST /store/payment-collections/:id/payment-sessions` (ต่อจาก
   `authenticate("customer", ...)` + ownership ของ CORE-12 — ต้องลงทะเบียนให้รัน**หลัง** ownership (ADR-013) เพื่อไม่ให้ customer อื่น trigger
   `authorizePaymentSession` ได้, AC-13g) **ไม่เรียก Stripe SDK/API ตรง** อ่านสถานะผ่าน `paymentModule.authorizePaymentSession(id)` เท่านั้น:
   1. ทำงานเฉพาะเมื่อ collection มี session เดิมที่ `provider_id` ขึ้นต้นด้วย `pp_stripe` (ครอบทุก Stripe provider ทั้งบัตรและ PromptPay) และมี `data.id`
      ไม่ตรง → `next()` ทันทีโดยไม่เรียก provider
   2. session เดิมมี `authorized_at` หรือมี payment แล้ว → 409 ทันทีโดยไม่เรียก provider
   3. ไม่เช่นนั้นเรียก `authorizePaymentSession`: throw `MedusaError` `NOT_ALLOWED` (PI `requires_*` / `canceled` / error ของ PI) → `next()`;
      คืน payment (PI `succeeded` / `requires_capture`) หรือคืน `null` (PI `processing`) → 409; error อื่น (เช่น Stripe ล่ม) → **fail closed**
      ส่ง error ต่อ ไม่ `next()` session เดิมยังอยู่
   4. 409 = throw `MedusaError(CONFLICT, message, "PAYMENT_ALREADY_COMPLETED")` ผ่านกลไก PROMO-2 (เพิ่ม code ใน allow-list ของ
      `businessErrorHandler`) body `{ type: "conflict", code: "PAYMENT_ALREADY_COMPLETED", message }` — ห้าม `res.status(409)` ใน middleware
   5. ครอบการตรวจด้วย lock ของ `Modules.LOCKING` key = `cart_id` ของ collection (อ่าน link ด้วย `query.graph`)
   6. เรียก module ตรงใน middleware ไม่ห่อเป็น workflow (compensation ของ `authorizePaymentSessionStep` จะ `cancelPayment` payment ที่เพิ่งสร้าง)
   หลัง 409 session เดิมไม่ถูกลบ → webhook `payment_intent.succeeded` → `processPaymentWorkflow` → complete cart แบบ idempotent (builder ยืนยันด้วย
   integration test ถ้าไม่จริง หยุดและรายงาน ห้ามเขียนการ complete cart เอง); storefront ที่ได้ code นี้แสดง `promptpay-awaiting-order`, เรียก
   `POST /store/carts/:id/complete` ของ Medusa เป็น**ทางสำรอง** (ช่องที่ D จับไม่ได้: guard สร้าง payment captured แล้วแต่ webhook ไม่มา หรือ
   `completeCartAfterPaymentStep` ล้ม → session ยังอยู่ ไม่มี alert แต่ไม่มี order) ได้ order → redirect หน้า order confirmed ไม่ได้ → poll ต่อ (AC-12, AC-12b)
   ถ้าลูกค้าปิดหน้าไปก่อน ช่องนี้ครอบด้วย runbook (AC-16) เท่านั้น
   (D) **ตาข่ายสำรอง** (PAY-6) สำหรับ race ที่เหลือ (TOCTOU ระหว่าง guard กับการลบใน route ของ Medusa — owner ยอมรับ): subscriber
   `src/subscribers/payment-webhook-orphan.ts` บน `PaymentWebhookEvents.WebhookReceived` (subscriberId แยกจาก core, อ่านอย่างเดียว) เรียก
   `paymentModule.getWebhookActionAndData(input)`; ถ้า action เป็น `captured`/`authorized` มี `session_id` แต่ `listPaymentSessions({ id: session_id })` ว่าง →
   `logger.error` หนึ่งบรรทัดขึ้นต้นด้วย `PAYMENT_WEBHOOK_SESSION_NOT_FOUND` พร้อม `provider`, `session_id`, `amount`, `payment_intent` และ
   `payment_collection_id`/`cart_id` ถ้าหาได้ **และ** ส่งอีเมลหา `OPS_ALERT_EMAIL` ผ่าน Notification module ทันที (owner ตัดสิน 2026-10-26; env แยกจาก
   `EVOUCHER_ADMIN_EMAIL`; ไม่ตั้ง → log warn ข้ามการส่ง; ส่งล้ม → log error subscriber ไม่ล้ม) — ไม่สร้าง order/payment/refund เอง (ไม่ทำ reconciliation
   ทางเลือก B) ops refund ตาม runbook **"เงินถูกตัดแต่ไม่มี order (ADR-015)"** ใน `docs/ops/production.md` (refund ด้วยมือใน Stripe dashboard ได้เฉพาะ
   PI ที่ไม่มี payment ใน Medusa; ถ้า Medusa **มี** payment captured แต่ collection ไม่ผูก order → **ตรวจก่อน refund** แล้วใช้ script
   `apps/backend/src/scripts/refund-orphan-payment.ts` ที่เรียก `refundPaymentsWorkflow` (รอบ 8, ADR-015 ภาคผนวก 2) — ข้อยกเว้นของกฎข้อ 4; โค้ดของเราไม่เรียก
   refund ของ Stripe ตรง และไม่ refund อัตโนมัติ — แต่ Medusa refund อัตโนมัติได้เองใน `compensatePaymentIfNeededStep` ของ `completeCartWorkflow`
   เมื่อ complete ล้มหลัง capture (note "Refunded due to cart completion failure"))
8. (รอบ 9, PAY-6c — review #98) ทางสำรองของ storefront (กฎข้อ 7A, AC-12b) ต้องมี**เพดาน**: เรียก complete cart + poll รวมไม่เกิน **10 ครั้ง** (ตาม interval เดิมของ PAY-6b1)
   แล้วหยุดยิง request และแสดง `promptpay-order-delayed` (ข้อความไทย: ได้รับเงินแล้ว ระบบกำลังตรวจสอบ ให้ติดต่อร้านพร้อมลิงก์หน้า `/contact`) แทนข้อความรอ;
   ถ้าระหว่างนั้น storefront อ่านได้ว่าเงินถูกคืนแล้ว (Medusa `compensatePaymentIfNeededStep` refund เมื่อ complete ล้ม) แสดง `promptpay-refunded` (ข้อความไทย: ชำระไม่สำเร็จ
   เงินจะคืนตามรอบของธนาคาร) และให้เริ่มชำระใหม่ได้ — สัญญาณ "คืนแล้ว" ต้องมาจาก field ที่ Store API คืนจริง (builder ตรวจ 2.22.1 เช่น สถานะ payment collection/payment
   sessions ของ cart ที่อ่านผ่าน data function เดิม) ห้ามเพิ่ม store route ใหม่; ถ้า Store API ไม่มีสัญญาณนี้ ให้ใช้ `promptpay-order-delayed` อย่างเดียวและรายงานใน PR
9. (รอบ 10, PAY-3a/PAY-3b — builder PAY-3 หยุดเพราะ Store API อ่าน draft order ไม่ได้) หน้า `/<cc>/account/orders/:id/pay` (ต้อง login; `:id` = order id ตามลิงก์อีเมลของ GB-4):
   (a) อ่านข้อมูลจาก route ของ GB-8 เท่านั้น (404 → หน้า not-found ของ Next ตอบ HTTP 404); (b) แสดงฟอร์มชำระเงิน (`order-pay-form`) เฉพาะเมื่อ `membership.status = "awaiting_payment"`,
   `now < group.pay_deadline_at` และมี payment collection สถานะยังไม่ `completed` — กรณีอื่นแสดงสถานะภาษาไทยแทนฟอร์ม: ชำระแล้ว (`order-pay-paid`), หมดเวลา/ยกเลิก (`order-pay-closed`),
   รอกลุ่ม (`order-pay-waiting`); (c) เลือกบัตร/พร้อมเพย์แล้วสร้าง session ด้วย `POST /store/payment-collections/:id/payment-sessions` ของ Medusa (ใช้ component บัตร/พร้อมเพย์เดิมของ
   checkout ไม่ copy) — ไม่มี custom payment route; (d) ได้ 409 `PAYMENT_ALREADY_COMPLETED` → **poll route ของ GB-8 อย่างเดียว** (ไม่เรียก complete cart — ภาคผนวก ADR-015) จน
   `payment_status`/สถานะ membership เปลี่ยน แล้วแสดง `order-pay-paid`; poll มีเพดานแบบเดียวกับกฎข้อ 8 (10 ครั้ง แล้วแสดง `promptpay-order-delayed`);
   (d2) (รอบ 12, review #157/#184) การสร้าง session ได้ **non-2xx ทุกแบบ** (รวม network error) **ยกเว้น** 409 code `PAYMENT_ALREADY_COMPLETED` (→ ข้อ d) และ 401 (→ ไปหน้า login
   ตามเดิม) — เช่น 400 `invalid_data`, 500 `unknown_error`, 409 `invalid_state_error` ที่ไม่มี code ของเรา (Medusa map `QUERY_RUNNER_RELEASED`/`TRANSACTION_*` เป็น 409) → อ่าน route
   ของ GB-8 **1 ครั้ง** แล้วตัดสินจาก**สถานะ** ไม่ดู status code/ข้อความ error: ถ้า predicate "มีการชำระแล้ว" เป็นจริง → เข้าทางเดียวกับ (d) (poll GB-8 อย่างเดียว เพดานเดิม
   นับรวมการอ่านครั้งแรกนี้, ไม่แสดง error) — ครอบกรณี guard แพ้ race กับ webhook (หมายเหตุรอบ 6/12: Stripe จริงได้ 500, mock ที่ cancel สำเร็จได้ 400); ถ้าเป็นเท็จ → แสดง error
   ภาษาไทย `order-pay-error` และ render ตามข้อ (b) จากข้อมูลที่เพิ่งอ่าน (ยังเข้าเงื่อนไข → ฟอร์มเดิมให้ลองใหม่) ไม่ poll ต่อ;
   **predicate "มีการชำระแล้ว"** = pure function ตัวเดียวที่ใช้ทั้ง (d) และ (d2) (unit Vitest) จาก response ของ GB-8 (ปัจจุบันคืนครบแล้ว: `order.payment_status`,
   `order.payment_collections[].status`, `order.payment_collections[].payment_sessions[].status` — ไม่ต้องแก้ GB-8) จริงเมื่อข้อใดข้อหนึ่ง:
   `payment_sessions[].status` ∈ `authorized`/`captured` (ครอบช่วงที่สร้าง payment แล้วแต่ `payment_status` ยัง `not_paid`); หรือ collection `status` ∈ `authorized`/`partially_authorized`/
   `partially_captured`/`completed`; หรือ `payment_status` ∈ `authorized`/`partially_authorized`/`partially_captured`/`captured` — `partially_*` อยู่**ใน** เพราะแปลว่ามี payment บน PI แล้ว
   (สร้าง session ใหม่เสี่ยงตัดเงินซ้ำ; ถ้าไม่ไปถึง captured จะจบที่ `promptpay-order-delayed` ให้ติดต่อร้าน); `payment_status` `refunded`/`partially_refunded` **ไม่อยู่ในรายการ**
   (ไม่ทำให้จริงด้วยตัวเอง) เพราะเกิดจาก admin refund หลัง capture ไม่ใช่ผลของ race ตอนสร้าง session — และไปไม่ถึง (d2) จากฟอร์ม เพราะ collection ของ order ที่ capture แล้วเป็น
   `completed` ซึ่งข้อ (b) ไม่แสดงฟอร์มตั้งแต่ต้น (ถ้าเกิดขึ้น predicate จริงจาก collection `completed` และหน้าแสดงตามข้อ (b) เหมือนเดิม);
   `not_paid`/`awaiting`/`requires_action`/`canceled` และ session `pending`/`requires_more`/`error`/`canceled` อยู่นอก — เหตุผลที่ไม่ match status code/ข้อความ: ฝั่งที่แพ้ race
   ได้ code ต่างกันตามว่า provider cancel สำเร็จหรือไม่ และข้อความมาจาก MikroORM/Stripe ที่เปลี่ยนได้เมื่อ bump เวอร์ชัน ส่วนสถานะใน GB-8 เป็นสัญญาของเราเอง;
   (d3) (รอบ 12, review #189) กลับมาที่หน้า pay จาก redirect ของ Stripe (3DS/พร้อมเพย์) ที่ query มี `payment_intent` + `redirect_status`: `succeeded`/`processing` → เข้าทาง poll GB-8
   ของข้อ (d) ทันทีโดยไม่แสดงฟอร์มเดิม (webhook อาจยังไม่มา); `failed`/`requires_payment_method` → `order-pay-error` + ฟอร์มตามข้อ (b); ใน (d2) ถ้าการอ่าน GB-8 ล้มเอง → แสดง
   `order-pay-error` ไม่ poll ต่อ — ปลอดภัยเพราะถ้าเงินเข้าแล้ว การลองใหม่ได้ 409 `PAYMENT_ALREADY_COMPLETED` จาก guard (PAY-6a) และเข้าทาง (d) ไม่ตัดเงินซ้ำ (ใส่ comment นี้ในโค้ด)
   (e) ข้อความไทยตรงในโค้ด + path ใหม่ใน ESLint rule (spec 01 CORE-4 กฎข้อ 4)

## Acceptance criteria
- AC-1 บัตร `4242…` → สร้าง order สำเร็จ, `payment_status=captured`
- AC-2 บัตรที่ต้องผ่าน 3DS (`4000 0027 6000 3184`) → แสดง 3DS modal → สำเร็จ
- AC-3 บัตรถูกปฏิเสธ (`4000 0000 0000 0002`) → แสดง error, ไม่มีการสร้าง order
- AC-4 PromptPay: แสดง QR; เมื่อ confirm PaymentIntent ใน test mode → webhook → สร้าง order
  พร้อม `payment_status=captured`
- AC-5 PromptPay ไม่ชำระภายใน 10 นาที → session ถูกยกเลิก, cart ยังใช้งานได้
- AC-6 (ปรับรอบ 8 ตาม PAY-4 #94) Admin refund ฿100 บน order ที่ captured แล้วยอด ฿600 (refund บางส่วน) → มี Stripe refund ฿100 เกิดขึ้น;
  order มี `payment_status=partially_refunded` (refund เต็มยอด → `refunded`) และ Medusa 2.22.1 สร้าง credit line ของ order จากการ refund
  (พฤติกรรมของ `refundPaymentWorkflow` → `createOrderRefundCreditLinesWorkflow` ใช้ตามเดิม) — **e2e ของ #94 ยังไม่ assert credit line**: เพิ่ม assertion
  (`GET /admin/orders/:id` มี `credit_lines` 1 รายการที่ยอดสัมบูรณ์ = 100) ใน task ถัดไปที่แตะ e2e refund (GB-N1)
- AC-7 ชำระ draft order ผ่าน `/account/orders/:id/pay` ด้วย PromptPay → captured
- AC-8 การส่ง webhook ซ้ำต้องไม่ทำให้ capture/refund ซ้ำ
- AC-9 สร้าง payment session บัตรจาก checkout → PaymentIntent ใน Stripe test mode (อ่านผ่าน Stripe API/MCP ด้วย id ใน session `data`)
  มี `payment_method_types` เท่ากับ `["card"]`; session PromptPay มี `["promptpay"]`
- AC-10 (PAY-7, ADR-023) CI มี listener เดียวไป `/hooks/payment/stripe_stripe`; AC-1 และ AC-4 ผ่าน และ `check-stripe-webhooks.sh`
  ยืนยัน `payment_intent.succeeded` ถึง path นั้นตอบ 2xx
- AC-11 (PAY-5, กฎข้อ 7) Given cart ที่มี session PromptPay และ PI อยู่สถานะ `requires_action` When test confirm PI ให้ `succeeded` ผ่าน
  Stripe test API แล้ว**ทันที**เรียกขั้นหมดอายุแบบเดียวกับ storefront (`POST /store/payment-collections/:id/payment-sessions` ด้วย provider
  PromptPay เดิม) Then ภายใน 60 วินาที cart ถูก complete เป็น order ที่ `payment_status=captured` และไม่มี payment ที่ captured ค้างโดยไม่มี
  order (ตรวจ PI ใน Stripe: `status=succeeded` ↔ มี order อ้าง PI นั้น) (integration กับ Stripe test mode หรือ e2e)
  — PAY-5 ยืนยันว่าเป็นกรณี (b) (ADR-015): test อยู่ในสถานะ `test.fixme` ใน `e2e/payments-promptpay-race.spec.ts` **PAY-6a เปิด test นี้และต้องผ่าน**
  โดยเพิ่มเงื่อนไข: request สร้าง session ใหม่นั้นได้ 409 code `PAYMENT_ALREADY_COMPLETED` และ session เดิมยังอยู่
- AC-12 (PAY-6b, เดิม PAY-5) Given ขั้นสร้าง session ใหม่ตอนหมดอายุได้ 409 `PAYMENT_ALREADY_COMPLETED` When storefront ได้ response นี้ Then แสดง
  `data-testid="promptpay-awaiting-order"` และ poll ต่อจนไปหน้า order confirmed — ไม่แสดง `promptpay-expired`; error อื่น → พฤติกรรมเดิม
  (e2e, mock response ของ route ได้)
- AC-12b (PAY-6a ส่วน backend/integration, PAY-6b ส่วน storefront/e2e; กฎข้อ 7A ทางสำรอง) Given ได้ 409 `PAYMENT_ALREADY_COMPLETED` และ webhook **ไม่มา** (CI: ไม่ส่ง event / mock) When storefront ได้ response นี้
  Then storefront เรียก `POST /store/carts/:id/complete` (ผ่าน data function เดิมของ starter) อย่างน้อย 1 ครั้ง และเมื่อได้ `type: "order"` redirect ไปหน้า
  order confirmed ของ order นั้น; complete ตอบ error → แสดง `promptpay-awaiting-order` และ poll ต่อ (ไม่แสดง `promptpay-expired`); webhook มาพร้อมกัน → ได้
  order เดียว (lock `cart_id` ของ `completeCartWorkflow`) (e2e + integration: complete cart ที่ guard authorize แล้วได้ order `payment_status=captured` 1 รายการ)
- AC-13 (PAY-6a, กฎข้อ 7A) Given collection ที่มี session Stripe 1 รายการ (`pp_stripe_stripe` หรือ `pp_stripe-promptpay_stripe`) When customer เจ้าของ
  `POST /store/payment-collections/:id/payment-sessions` Then:
  (a) `authorizePaymentSession` คืน payment (PI `succeeded`/`requires_capture`) หรือคืน `null` (PI `processing`) → 409 body
  `{ type: "conflict", code: "PAYMENT_ALREADY_COMPLETED", message }` session เดิมยังอยู่และไม่มี session ใหม่;
  (b) session เดิมมี `authorized_at` แล้ว → 409 เหมือน (a) และ `authorizePaymentSession` ไม่ถูกเรียก;
  (c) `authorizePaymentSession` throw `NOT_ALLOWED` (PI `requires_action`/`requires_payment_method`/`canceled`) → 200 session ใหม่ (พฤติกรรมเดิมของ Medusa);
  (d) `authorizePaymentSession` throw error อื่น → ไม่ใช่ 2xx และ session เดิมยังอยู่;
  (e) collection ที่มีเฉพาะ session `pp_system_default` → `authorizePaymentSession` ไม่ถูกเรียก และได้ 200;
  (f) โค้ดของ guard ไม่ import `stripe` (unit test ตรวจ source หรือ lint rule);
  (g) ลำดับ middleware (ADR-013): ไม่มี token → 401; customer B ที่ไม่ใช่เจ้าของ collection (ของ cart หรือ order) → 404 **และ**
  `authorizePaymentSession` ไม่ถูกเรียก (spy), ไม่มี payment ใหม่บน collection, session ของ A ยังอยู่ — customer อื่น trigger การ authorize ไม่ได้
  (unit ของ guard ด้วย mock payment module + integration http)
- AC-14 (PAY-6a, กฎข้อ 7A) Given guard ตอบ 409 แล้ว (session ถูก authorize เป็น payment) When รัน `processPaymentWorkflow` ด้วย action `captured` ของ session นั้น
  Then cart ถูก complete เป็น order `payment_status=captured` มี payment 1 รายการ; รันซ้ำ → ไม่มี capture/order เพิ่ม (integration)
- AC-15 (PAY-6b, กฎข้อ 7D) Given event `payment.webhook_received` ที่ `getWebhookActionAndData` คืน action `captured` (หรือ `authorized`) กับ `session_id`
  ที่ไม่มีใน DB และตั้ง `OPS_ALERT_EMAIL=ops@x.test` When subscriber `payment-webhook-orphan` ทำงาน Then มี notification 1 รายการ `to="ops@x.test"` ที่มี
  PI id และมี log ระดับ error ขึ้นต้นด้วย `PAYMENT_WEBHOOK_SESSION_NOT_FOUND`; Given `session_id` มีอยู่ Then ไม่มี log/notification; Given ไม่ตั้ง env
  Then ไม่มี notification และมี log warn; Given notification provider throw Then subscriber ไม่ throw และมี log error; ไม่มี payment/order/refund ถูกสร้าง
  โดย subscriber ทุกกรณี (integration, mock notification provider + mock payload)
- AC-16 (PAY-6b) Given `docs/ops/production.md` Then มีหัวข้อ "เงินถูกตัดแต่ไม่มี order (ADR-015)" ที่ระบุ: ค้นหา PI ใน Stripe dashboard (จาก alert
  `PAYMENT_WEBHOOK_SESSION_NOT_FOUND`), ยืนยันว่าไม่มี order อ้าง PI, refund เต็มจำนวนใน Stripe dashboard, แจ้งลูกค้า, บันทึก incident; **และ**
  กรณีไม่มี alert (ลูกค้าแจ้ง/พบ PI `succeeded` ที่ไม่มี order แต่ Medusa มี payment captured บน payment collection ของ cart ที่ยังไม่ complete): ให้ลูกค้า
  เปิดหน้า checkout ของ cart นั้นอีกครั้ง (storefront เรียก complete ตาม AC-12b) หรือ refund ตามขั้นเดิมถ้า complete ไม่ได้ — หัวข้อมีคำว่า
  `PAYMENT_WEBHOOK_SESSION_NOT_FOUND` และ `PAYMENT_ALREADY_COMPLETED`; (รอบ 6) มีหัวข้อย่อยกรณี guard fail closed ถาวร (retrieve PI ไม่ได้ → cart สร้าง session
  ใหม่ไม่ได้) พร้อมขั้นแก้; และมีบรรทัด `OPS_ALERT_EMAIL=` ใน `apps/backend/.env.example` (unit test อ่านไฟล์)
- AC-16b (PAY-6b2 #97, รอบ 8, ADR-015 ภาคผนวก 2) Given หัวข้อ runbook ของ AC-16 Then มีหัวข้อย่อยกรณี "payment captured แต่ collection ไม่ผูก order" ที่มีขั้นตามลำดับ:
  ลอง complete cart ก่อน → "ตรวจก่อน refund" (`refunds` จาก `GET /admin/payments/:id` + PI ใน Stripe; อ้างข้อความ "Refunded due to cart completion failure")
  → รัน `refund-orphan-payment.ts` ด้วย `medusa exec` เมื่อยังไม่ refund → ลูกค้า logout ทิ้ง cart เดิม → เฝ้า Orders จนพ้นช่วง Stripe retry webhook พร้อมข้อความ
  "ห้าม fulfill" และ "ห้าม cancel" (เหตุผล `cancelOrderWorkflow` refund ซ้ำ) → บันทึก incident; และไม่มีขั้นที่สั่ง refund payment นี้ใน Stripe dashboard
  (unit test อ่านไฟล์ grep คำสำคัญ: "ตรวจก่อน refund", `refund-orphan-payment`, "Refunded due to cart completion failure", "ห้าม fulfill", "ห้าม cancel")
- AC-16c (PAY-6b2 #97, รอบ 8) Given payment captured บน collection ของ cart ที่ไม่มี order (สร้างผ่าน mock provider) When รัน script `refund-orphan-payment.ts`
  ด้วย payment id Then payment มี refund 1 รายการเท่ายอดที่ capture (ผ่าน `refundPaymentsWorkflow` — provider ถูกเรียก refund 1 ครั้ง); When รันซ้ำ Then ไม่มี refund
  เพิ่มและจบด้วยข้อความว่า refund แล้ว; Given payment ที่ collection ผูก order หรือยังไม่ captured Then script ไม่ refund และ exit ≠ 0 พร้อมเหตุผล; source ของ
  script ไม่ import `stripe` (integration modules/http + grep)
- AC-17 (PAY-6c, กฎข้อ 8) Given storefront ได้ 409 `PAYMENT_ALREADY_COMPLETED` และ `POST /store/carts/:id/complete` ตอบ error ทุกครั้ง (route mock ใน e2e) When รอ Then จำนวน request
  complete + poll รวม ≤ 10, หลังครบเห็น `promptpay-order-delayed` ที่มีอักษรไทยและลิงก์ `/contact`, และไม่มี request complete เพิ่มใน 30 วินาทีถัดไป; ไม่แสดง `promptpay-awaiting-order` แล้ว;
  Given สัญญาณ "คืนเงินแล้ว" ตามกฎข้อ 8 (mock response) Then เห็น `promptpay-refunded` และปุ่มเริ่มชำระใหม่ (e2e; unit Vitest ของตัวนับเพดาน)
- AC-18 (PAY-3a, กฎข้อ 9c, spec 04 กฎข้อ 22, ภาคผนวก ADR-015) Given draft order DA ของ A ที่มี payment collection PC (สร้างผ่าน `succeedGroupWorkflow` หรือ
  `createOrUpdateOrderPaymentCollectionWorkflow` ใน test) When ไม่มี token `POST /store/payment-collections/PC/payment-sessions` Then 401; B → 404 และไม่มี session ใหม่;
  A (provider `pp_system_default` หรือ mock Stripe) → 200 มี session; Given session Stripe ของ PC ที่ PI ชำระแล้ว When ยิง guard (`POST .../payment-sessions` ของ A) **พร้อมกับ**
  `processPaymentWorkflow` action `captured` ของ session เดียวกัน Then มี payment ของ session นั้นที่ `deleted_at IS NULL` **1 แถว**, ฝั่งที่แพ้ได้ 409 หรือ non-2xx ใดก็ได้, session
  เดิมไม่ถูกลบ; รัน `processPaymentWorkflow` ซ้ำ Then ไม่มี capture เพิ่ม; spy ยืนยันว่า guard ขอ lock key = `PC.id` (integration http/modules; ไม่แก้โค้ด production ถ้าผ่าน —
  ถ้าไม่ผ่านให้หยุดและรายงาน)
- AC-19 (PAY-3b, กฎข้อ 9) Given กลุ่มของ A สำเร็จแล้ว (seed ผ่าน API) When A เปิด `/th/account/orders/<DA>/pay` แล้วชำระด้วยบัตร `4242…` (Stripe test mode) Then เห็น `order-pay-paid`
  ภายใน 60 วินาทีและ payment ของ PC `captured`; ทำซ้ำด้วยพร้อมเพย์ (confirm PI ใน test mode) → `order-pay-paid` (= AC-7); When B เปิด URL เดียวกัน Then HTTP 404; Given membership
  `joined` (กลุ่มยังไม่สำเร็จ) / `cancelled` / เลย `pay_deadline_at` Then ไม่มี `order-pay-form` และเห็น `order-pay-waiting` / `order-pay-closed` ตามลำดับ (มีอักษรไทย); Given route mock
  ให้สร้าง session ได้ 409 `PAYMENT_ALREADY_COMPLETED` Then ไม่มี request `POST /store/carts/*/complete` และมี request GET route ของ GB-8 ซ้ำ ≤ 10 ครั้ง;
  (รอบ 12, กฎข้อ 9 d2 — route mock ทุกกรณี) Given สร้าง session ได้ **500** `{ type: "unknown_error" }` (= ผลจริงกับ Stripe เมื่อ guard แพ้ race) และ GB-8 ตอบ
  `payment_status=not_paid` แต่ `payment_sessions[0].status=authorized` ในครั้งแรกแล้ว `payment_status=captured` ในครั้งถัดไป Then เห็น `order-pay-paid`, **ไม่เห็น** `order-pay-error`,
  ไม่มี request `POST /store/carts/*/complete` และ request GET ของ GB-8 หลังได้ error รวม ≤ 10 ครั้ง; Given สร้าง session ได้ 400 `invalid_data` "Payment with payment_session_id ...
  already exists" และ GB-8 ตอบ `payment_status=authorized` แล้ว `captured` Then ผลเหมือนกรณี 500; Given ได้ 500 `unknown_error` / 400 `invalid_data` / 409 `invalid_state_error`
  (ไม่มี code ของเรา) และ GB-8 ตอบยังไม่ชำระ (`payment_status=not_paid`, collection `not_paid`, session `pending`) Then เห็น `order-pay-error` ที่มีอักษรไทยและ `order-pay-form`,
  request GET ของ GB-8 หลังได้ error = 1 ครั้ง (ไม่ poll ต่อ); Given ได้ 401 Then ไปหน้า login และไม่มี request GET ของ GB-8 จาก d2 (e2e, screenshot ≤ 3);
  unit Vitest ของ predicate "มีการชำระแล้ว": ตารางกรณีจริง/เท็จครบทุกค่าที่กฎข้อ 9 d2 ระบุ (รวม `partially_authorized` → จริง, `refunded` + collection `not_paid` → เท็จ,
  session `authorized` + `payment_status=not_paid` → จริง)
- AC-20 (PAY-3b2, กฎข้อ 9 d3) Given A ชำระบนหน้า pay แล้ว Stripe redirect กลับมาที่ `/th/account/orders/<DA>/pay?payment_intent=pi_x&redirect_status=succeeded` (หลัง 3DS/พร้อมเพย์) ขณะ GB-8 ยังตอบ
  `payment_status=not_paid` (webhook ยังไม่มา — route mock) แล้วครั้งถัดไป `captured` Then ไม่มี `order-pay-form` ระหว่างรอ, มี request GET ของ GB-8 ซ้ำ ≤ 10 ครั้ง และเห็น `order-pay-paid`;
  Given `redirect_status=failed` Then เห็น `order-pay-error` (อักษรไทย) และ `order-pay-form` ให้ลองใหม่; Given ข้อ d2 แล้ว request GET ของ GB-8 ล้ม (route mock 500) Then เห็น `order-pay-error`,
  ไม่ poll ต่อ และกดชำระใหม่แล้วถ้าจ่ายไปแล้ว guard ตอบ 409 `PAYMENT_ALREADY_COMPLETED` → เข้าทาง poll ของข้อ d (e2e route mock + unit Vitest ของฟังก์ชันอ่าน query)

## Test plan
- Integration (http): AC-8 โดย mock provider
- e2e: AC-1..AC-7 กับ Stripe test mode; CI รัน `stripe listen --forward-to` เพื่อให้
  webhook จริงส่งถึง runner; จำลอง PromptPay สำเร็จด้วยการ confirm PaymentIntent ใน test mode
- e2e: AC-9 (อ่าน PaymentIntent จาก Stripe test mode ระหว่าง AC-1/AC-4); CI: AC-10
- integration/e2e กับ Stripe test mode: AC-11; e2e: AC-12, AC-12b (ส่วน storefront); integration: AC-12b (complete cart หลัง guard)
- unit: guard (AC-13 a–g ด้วย mock payment module), การตรวจ runbook/env (AC-16, AC-16b); integration http: AC-13; integration: AC-14, AC-15, AC-16c
- e2e + unit (Vitest): AC-17 (PAY-6c)
- integration (http/modules): AC-18 (PAY-3a); e2e กับ Stripe test mode: AC-19 (PAY-3b1), AC-7 (PAY-3b2); e2e route mock + unit: AC-20 (PAY-3b2) — กรณี 409/400/500/401 ของ AC-19 ใช้ route mock; unit Vitest: predicate "มีการชำระแล้ว" (AC-19)

## Tasks
| ID | Task | Depends |
|----|------|---------|
| PAY-1 | ตั้งค่า Stripe provider, เปิดใช้ใน region, env, ตรวจสอบ webhook route ในเครื่องด้วย Stripe CLI (AC-8) | CORE-2 |
| PAY-2 | Storefront: ขั้นตอนชำระเงินด้วยบัตร + PromptPay, polling, error + e2e (AC-1..AC-5); `payment_method_types: ["card"]` ของ session บัตร (กฎข้อ 5, AC-9); แก้ขั้น `stripe listen` ใน `ci.yml` ที่ใส่ `--forward-to` ซ้ำ (AC-10) | PAY-1, CORE-5 |
| PAY-3 | **แยกรอบ 10** (builder หยุด: Store API อ่าน draft order ไม่ได้) → PAY-3a + PAY-3b ด้านล่าง; route อ่านข้อมูลเป็น GB-8 (spec 04, ADR-016) | — |
| PAY-3a | (เล็ก, backend test-only) integration: ownership ของ `POST /store/payment-collections/:id/payment-sessions` บน collection ของ draft order + guard × webhook พร้อมกันบน collection ของ order ตามภาคผนวก ADR-015 (กฎข้อ 9c, AC-18) — ไม่แก้โค้ด production ถ้า test ผ่าน — ☑ #157 | PAY-6a ☑, GB-4 ☑ |
| PAY-3b | **แยกรอบ 12 (session หลัก 2026-10-28)** → PAY-3b1 / PAY-3b2 ด้านล่าง — นิยามเดิม: storefront หน้า `/account/orders/:id/pay` ตามกฎข้อ 9 (อ่านจาก GB-8, component บัตร/พร้อมเพย์เดิม, 409 `PAYMENT_ALREADY_COMPLETED` → poll GB-8 อย่างเดียวมีเพดาน, non-2xx อื่นยกเว้น 401 → ตรวจสถานะ GB-8 1 ครั้งด้วย predicate "มีการชำระแล้ว" ตามกฎข้อ 9 d2; ไม่แก้ GB-8) + e2e (AC-7, AC-19) | — |
| PAY-3b1 | ☑ #189 — หน้า `/account/orders/:id/pay` (กฎข้อ 9 a, b, e) + ชำระด้วยบัตร (9c) + 409/non-2xx/predicate (9 d, d2) + e2e (AC-19) | GB-8 ☑ #145, PAY-3a ☑ #157, PAY-6c ☑ #136, #184 ☑ |
| PAY-3b2 | พร้อมเพย์บนหน้า `/account/orders/:id/pay` (กฎข้อ 9c) + e2e (AC-7) — แยก logic เปิด QR เป็น `open-qr.ts` ใช้ร่วมกับ checkout (ไม่ copy); จุดเรียกบนหน้า order อยู่นอกกฎ 31 ของ spec 05 (ไม่มี cart — affiliate ผูกกับ draft order ตอน join, spec 05 กฎ 41) ใส่ใน allow-list ของ static test AF-3c พร้อมเหตุผลนี้; (review #189) กลับจาก 3DS/redirect ของ Stripe มาที่หน้า pay: อ่าน `redirect_status`/`payment_intent` จาก query แล้วเข้าทาง poll GB-8 ของกฎข้อ 9(d) แทนการแสดงฟอร์มเดิม และ comment เรื่อง d2 อ่าน GB-8 ล้ม (กฎข้อ 9 d3) (AC-7, AC-20) — ☑ #203 | PAY-3b1 ☑ (#189) |
| PAY-4 | Refund e2e + screenshot หน้า admin (AC-6) | PAY-2 |
| PAY-5 | follow-up review PR #48 (เล็ก): race ระหว่าง QR หมดอายุกับการชำระสำเร็จ — test AC-11 ก่อนเพื่อยืนยันพฤติกรรมของ Medusa/Stripe provider เมื่อลบ session ที่ PI `succeeded` แล้ว; ถ้าเป็นกรณี (a) ของกฎข้อ 7 แก้เฉพาะ storefront ให้ poll ต่อเมื่อสร้าง session ใหม่ล้ม (AC-12); ถ้าเป็นกรณี (b) หยุดแล้วเขียน ADR (ไม่เขียน reconciliation เอง) | PAY-2 |
| PAY-6a | (◐ #82, แยกรอบ 6) ADR-015 A ฝั่ง backend: guard บน `POST /store/payment-collections/:id/payment-sessions` ตามกฎข้อ 7A (`authorizePaymentSession` เท่านั้น ไม่เรียก Stripe ตรง, lock `cart_id`/`payment_collection_id`, 409 `PAYMENT_ALREADY_COMPLETED` ผ่าน PROMO-2) + guard หลัง ownership ของ CORE-12 + เปิด test AC-11 จาก `test.fixme` + integration complete cart idempotent (AC-11, AC-13 a–g, AC-14, AC-12b ส่วน backend = integration complete cart หลัง guard) + integration race ตาม "หมายเหตุ (รอบ 6)" ด้านล่าง — **ไม่รวม** storefront (AC-12 และ AC-12b ส่วน storefront อยู่ใน PAY-6b) | PAY-5 (#65), PROMO-2 |
| PAY-6b | (แยกรอบ 6) storefront: poll ต่อเมื่อได้ `PAYMENT_ALREADY_COMPLETED` และเรียก complete cart เป็นทางสำรอง (AC-12, AC-12b ส่วน storefront) + ADR-015 D: subscriber `src/subscribers/payment-webhook-orphan.ts` (`PAYMENT_WEBHOOK_SESSION_NOT_FOUND` + อีเมล `OPS_ALERT_EMAIL`) + `OPS_ALERT_EMAIL` ใน `.env.example` + runbook ใน `docs/ops/production.md` (กฎข้อ 7D; หัวข้อ fail closed ต้องใช้วิธีที่ตรวจแล้วว่ามีจริง — ดู "ความเสี่ยงที่ยอมรับเพิ่ม" รอบ 7) (AC-15, AC-16) — ถ้าเกิน ~400 LOC แยก storefront (6b1) กับ alert + runbook (6b2) ทำขนานกันได้; **รอบ 8**: PAY-6b2 (#97) รวม AC-16b (runbook ใหม่) และ script `apps/backend/src/scripts/refund-orphan-payment.ts` + integration test (AC-16c) — ☑ #97 (6b2), #98 (6b1) | PAY-6a |
| PAY-6c | (storefront เล็ก, รอบ 9, review #98) เพดานการลองซ้ำของทางสำรอง + UI กรณีเงินถูกคืนโดย `compensatePaymentIfNeededStep` (กฎข้อ 8, AC-17) — ข้อความไทยตรงในโค้ด | PAY-6b ☑ (#97/#98), CORE-4e (spec 01 — แตะ `promptpay-payment`/`renewPromptPaySession` เดียวกัน; CORE-4e ← CORE-4d #109) |
| PAY-7 | (เล็ก, เอกสาร + CI + test) Stripe webhook endpoint เดียว `/hooks/payment/stripe_stripe` ตาม ADR-023: (1) integration ใน `stripe-webhook.spec.ts` เพิ่มกรณี session `pp_stripe-promptpay_stripe` + event `payment_intent.succeeded` ที่ POST เข้า `/hooks/payment/stripe_stripe` (ส่งซ้ำ) → order 1 รายการ `payment_status=captured`, capture 1 ครั้ง (ขยาย AC-8); (2) `ci.yml` เหลือ `stripe listen` process เดียว forward ไป `stripe_stripe` และขั้นตรวจ `check-stripe-webhooks.sh` ครั้งเดียว; (3) แก้ AC-10 เป็น "CI มี listener เดียวไป `/hooks/payment/stripe_stripe`; AC-1 และ AC-4 ผ่าน และ `check-stripe-webhooks.sh` ยืนยัน `payment_intent.succeeded` ถึง path นั้นตอบ 2xx" และแก้บรรทัด 8-9, 36 ของ spec นี้; (4) `docs/ops/production.md` หัวข้อ "Stripe webhooks" (endpoint เดียว + เหตุผล secret ต่อ endpoint, คง bullet event ไว้ให้ OPS-10), checklist ข้อ 2 + ข้อใหม่ verify ตาม ADR-023 "ผลที่ตามมา", หมายเหตุใน runbook ADR-015 ว่า `provider` ใน alert = path ของ endpoint; (5) comment `medusa-config.ts:67-68`, `apps/backend/.env.example:49`, `docs/design/sequence-diagrams.md:189`, `docs/spec/07-scaling-ops.md:51` ("endpoint ทั้งสอง" → endpoint เดียว; AC-15 ของ spec 07 ไม่ต้องแก้); (6) test: ตัดสินว่าเก็บเคส path `stripe-promptpay_stripe` เดิมใน `stripe-webhook.spec.ts:162` หรือแทนด้วยเคสใหม่ และเปลี่ยน `PROVIDER` ใน `integration-tests/http/payment-webhook-orphan.spec.ts:24` เป็น `stripe_stripe`; test ข้อ (1) ผ่านบนโค้ดปัจจุบันโดยตั้งใจ (regression guard ตอน bump ไม่ใช่ red-first — ระบุใน PR) — `check-stripe-events.sh` ไม่ต้องแก้ | ADR-023 (accepted 2026-11-12) |
(2026-11-12) PAY-7 เริ่มได้หลัง PR ของ ADR-023 merge ทำขนานกับ task อื่นได้ (ไม่แตะโค้ด production) — ต้อง merge ก่อนสร้าง webhook endpoint ใน Stripe Dashboard ของ staging/prod
PAY-3 ∥ PAY-4 ∥ PAY-5 หลัง PAY-2 (PAY-5 แตะ `promptpay-payment` เดียวกับที่ PAY-3 นำไปใช้ซ้ำ — merge PAY-5 ก่อน PAY-3 ถ้าทำพร้อมกัน ให้ rebase)
(รอบ 10) PAY-3a เริ่มได้ทันที (∥ GB-8, PAY-6c); PAY-3b หลัง GB-8 + PAY-3a + PAY-6c; GB-5 (spec 04) พึ่ง PAY-3a ไม่ใช่ PAY-3b
(รอบ 11) สถานะ: PAY-6c ☑ #136, GB-8 ☑ #145 → PAY-3b เหลือรอ PAY-3a; ข้อสังเกตจาก review/qa #136
(เพดานนับต่อการ mount ไม่ใช่ต่อ cart — reload ได้อีกชุด, refund แล้วสร้าง session ใหม่ไม่สำเร็จได้เพดานใหม่เมื่อเริ่มใหม่, unit จำลอง loop เอง, สัญญาณคืนเงินยังไม่มี integration
ผ่าน Store API จริง) — **ยอมรับใน v1** เพราะเพดานมีไว้กันลูปไม่รู้จบในหน้าเดียว (แต่ละครั้งเป็น request complete ที่ idempotent) ไม่มี task; ถ้า PAY-3b ใช้ตัวนับเดิมให้คงพฤติกรรมนี้
(รอบ 12, review #157) สถานะ: PAY-3a ☑ #157 → dependency ของ PAY-3b ครบ (GB-8 ☑ #145, PAY-3a ☑ #157, PAY-6c ☑ #136); PAY-3b เริ่มได้หลัง PR spec นี้ merge (กฎข้อ 9 d2, AC-19 ที่ปรับ)
(รอบ 12 planner, 2026-10-28) สถานะ: #184 (spec PAY-3b) ☑, PAY-3b แยกเป็น PAY-3b1 (☑ #189 — ดูบรรทัดรอบ 13) → PAY-3b2; CORE-4i (spec 01) ต้องรอทั้งสองตัว (contract error ของ action สร้าง session) — planner ไม่แก้กฎข้อ 9 ระหว่าง task ทำงาน; nit review #184 (เงื่อนไขหยุด poll ของข้อ d/d2 = `payment_status=captured`
หรือ collection `completed` ไม่ใช่เมื่อ predicate "มีการชำระแล้ว" จริงครั้งแรก — กรณี session `authorized` + `not_paid` ของ AC-19) ส่งให้ builder PAY-3b ผ่าน session หลัก; reviewer ของ PAY-3b ตรวจข้อนี้
(รอบ 13, 2026-11-03) สถานะ: PAY-3b1 ☑ #189, PAY-3b2 ◐ #203; CORE-4i (spec 01) ← #203 — รูปแบบผลของ action สร้าง session ตัดสินแล้ว (spec 01 Q-C2 = (ก) helper กลาง `{ ok } | { error }`;
ทางแยกของกฎข้อ 9 d/d2/401 คงเดิม) และ AC-20 อยู่ใน regression ของ AC-110
PAY-6a → PAY-6b (storefront ต้องได้ 409 จริงจาก guard); PAY-6c หลัง CORE-4e (∥ CORE-19b ถ้าไม่แตะไฟล์เดียวกัน — ตัวที่ merge ทีหลัง rebase); PAY-6c ควร merge ก่อน release ที่เปิดพร้อมเพย์จริง; PAY-6b แตะ `promptpay-payment` เดียวกับ PAY-3 — ตัวที่ merge ทีหลัง rebase; **ทั้ง PAY-6a และ PAY-6b**
ต้อง merge ก่อน release ที่เปิด PromptPay ให้ลูกค้าจริง
หมายเหตุ (รอบ 6, จาก #82): ข้อกังวลในภาคผนวก ADR-015 ("lock key `payment_collection_id` ของ collection ที่ไม่มี cart ไม่ตรงกับ lock ของ `processPaymentWorkflow`
→ guard กับ webhook อาจสร้าง payment ซ้อน") **ไม่เกิดจริง**: Medusa 2.22.1 มี unique index แบบ partial `IDX_payment_payment_session_id_unique`
(`payment_session_id` WHERE `deleted_at IS NULL`) จึงสร้าง payment ที่สองของ session เดียวกันไม่ได้ ไม่ต้องเพิ่ม lock/โค้ด ADR-015 ไม่เปลี่ยน
ฝั่งที่**แพ้ race** ได้ unique violation — (แก้รอบ 12 ตาม review #157/#184 ที่ตรวจกับ Medusa 2.22.1 จริง) `authorizePaymentSession_` จับ error แล้วเรียก `cancelPayment` ของ provider
ก่อน throw ต่อ ผลที่ guard ตอบจึงขึ้นกับว่า cancel สำเร็จหรือไม่: (1) cancel สำเร็จ (เช่น mock ของ PAY-3a ที่คืน canceled เสมอ) → error เดิมถูก throw → **400**
`{ type: "invalid_data", message: "Payment with payment_session_id ... already exists" }`; (2) **Stripe จริงกับ PI `succeeded`** → Stripe ปฏิเสธการ cancel → `cancelPaymentIntent` ของ
`payment-stripe` throw `Error` ธรรมดาแทน error เดิม → errorHandler ตอบ **500 `unknown_error`** — ไม่ใช่ 409 ทั้งสองกรณี; webhook ฝั่งที่แพ้ตอบ non-2xx แล้ว Stripe retry;
storefront รับทุกกรณีตามกฎข้อ 9 d2 (ตัดสินจากสถานะ GB-8 ไม่ดู code) — integration test ที่ภาคผนวกกำหนด (PAY-6a สำหรับ collection ของ cart; PAY-3a สำหรับ collection ของ order)
ต้อง assert ผลที่คาดนี้: ยิง guard กับ `processPaymentWorkflow` ของ session เดียวกันพร้อมกัน → มี payment ที่ `deleted_at IS NULL` ของ session นั้น **1 แถว**, ฝั่งที่แพ้
ได้ 409 หรือ error ใดก็ได้ที่ไม่ใช่ 2xx (400 หรือ 500 ตามข้างต้น) และ session เดิมไม่ถูกลบ; รัน `processPaymentWorkflow` ซ้ำ (จำลอง Stripe retry) → order `payment_status=captured`
ไม่มี capture/order ซ้ำ
(รอบ 12, review #157/#184) lock ของ guard บน collection ของ order (key = `PC.id`) **ไม่กันร่วม**กับ lock ของ `processPaymentWorkflow` จาก webhook — ทั้งสองเข้า
`authorizePaymentSession` พร้อมกันได้ ความถูกต้องมาจาก unique index ด้านบนเท่านั้น (ยอมรับ ไม่เพิ่ม lock/โค้ด); การที่ Medusa เรียก `cancelPayment` บน PI ที่ `succeeded` แล้ว
ไม่กระทบเงินเพราะ Stripe ปฏิเสธ (ผลคือ 500 ตามกรณี 2) — ปลอดภัยเฉพาะ automatic capture (ค่าปัจจุบัน) ดู Q8
follow-up (ไม่ใช่ task บังคับ — ทำในงานถัดไปที่แตะ test นี้): mock `cancelPayment` ใน integration test ของ PAY-3a (`payment-session-draft-order.spec.ts`) ควร throw เมื่อ PI
`succeeded` ให้ตรงกับ Stripe จริง และ assert ฝั่งที่แพ้เป็น 500 แทนแค่ `>= 400` — ดู Q9
ความเสี่ยงที่ยอมรับเพิ่ม (บันทึกรอบ 6, review #82 — ไม่มี task โค้ด):
- PI ของ**บัตร**ที่อยู่สถานะ `processing` → provider คืน `PENDING` → `authorizePaymentSession` โยน `NOT_ALLOWED` → guard `next()` → session อาจถูกลบได้
  (ตรงกับกรณี `processing` ใน "ความเสี่ยงที่เหลือ" ของ ADR-015) — ถ้า PI สำเร็จภายหลัง ตาข่าย D (PAY-6b) จับได้ (alert + refund ด้วยมือ)
- guard แบบ fail closed: ถ้า retrieve PI ล้มถาวร (เช่น PI ถูกลบ/บัญชี Stripe ผิด) cart นั้นสร้าง session ใหม่ไม่ได้เลย → runbook ของ PAY-6b ต้องมีหัวข้อวิธีแก้
  (ตรวจ PI ใน Stripe dashboard แล้วให้ลูกค้าเริ่ม cart ใหม่ หรือ ops ล้าง session ที่ค้าง) และ AC-16 ตรวจว่ามีหัวข้อนี้
  **(รอบ 7)** Medusa 2.22.1 **ไม่มี admin route ลบ payment session** — builder PAY-6b ต้องตรวจวิธีที่ทำได้จริงจาก source/docs ก่อนเขียนขั้นใน runbook (เช่น ลูกค้าเริ่ม
  cart ใหม่, หรือ script `medusa exec` ที่เรียก method ของ Payment module ที่มีอยู่จริง) และทดลองบน DB ทดสอบ; ห้ามเขียนขั้นที่อ้าง route ที่ไม่มี และห้ามแนะนำแก้ DB
  ด้วย SQL ตรง; ถ้าไม่มีวิธีที่ไม่ต้องเขียนโค้ดใหม่ ให้ runbook ใช้ "ลูกค้าเริ่ม cart ใหม่" อย่างเดียวและรายงานใน PR
- **(รอบ 8, review #97/#104 — owner ตัดสินใหม่ 2026-10-26, ADR-015 ภาคผนวก 2 accepted)** payment captured บน collection ของ cart ที่ complete ไม่ได้
  (collection ไม่ผูก order → `refundPaymentWorkflow` throw) refund ผ่าน `refundPaymentsWorkflow` ของ Medusa ด้วย script `refund-orphan-payment.ts` (`medusa exec`)
  หลังขั้น "ตรวจก่อน refund" — เพราะ `completeCartWorkflow` อาจ refund ให้เองแล้ว (`compensatePaymentIfNeededStep`) สถานะใน Medusa จึงตรงกับ Stripe (AC-16b, AC-16c)
- (รอบ 8) nit review #82 ของ PAY-6a (ย้าย constant `PAYMENT_ALREADY_COMPLETED` ไปไฟล์ errors, comment ใน test guard × webhook ว่าฝั่งที่แพ้ได้ 409/non-2xx ถือว่าผ่าน — รอบ 12: 400 `invalid_data` เมื่อ cancel สำเร็จ, 500 `unknown_error` กับ Stripe จริง)
  รวมในงานเล็ก GB-N1 (spec 04)

## Follow-up รอบ 40 (2026-11-21 — การทดสอบ manual 2026-11 บน v0.2.0; owner สั่งแก้ก่อน go-live ใน release เดียว)
ที่มา: เฟส 5 B-1 (refund ขณะมี order change ค้าง), O-2 (order #69 `payment_status=refunded` ทั้งที่จ่ายแล้ว), log หลอก ops (ดู spec 07 OPS-32)

### สิ่งที่ Medusa มีให้อยู่แล้ว (รอบ 40)
| ความต้องการ | Medusa มีให้ | วิธีใช้ |
|---|---|---|
| refund ของ admin | `POST /admin/payments/:id/refund` → `refundPaymentWorkflow` (2.22.1) — **แต่** refund Stripe ก่อน (`refund-payment.js:138`) แล้ว `createOrderRefundCreditLinesWorkflow` (`:183`) ล้มเมื่อ order มี active order change → admin เห็น 400 แต่เงินคืนจริง, ไม่ emit `payment.refunded` (`:188`) → `flash-sale-release.ts`/`affiliate-reversal.ts` ไม่ทำงาน | ขยาย: middleware กันก่อนเข้า route (กฎข้อ 10) — ไม่ patch workflow ของ Medusa; รายงาน upstream (session หลักถาม owner ก่อนเปิด issue) |
| อ่าน order change ที่ค้าง | entity `order_change` (`status` `pending`/`requested` = active — ค่าเดียวกับที่ Medusa ใช้ตรวจ "already has an existing active order change") ผ่าน `query.graph` | ใช้ตามเดิม |
| link payment → order | `payment.payment_collection` + link `order_payment_collection` | ใช้ตามเดิมผ่าน `query.graph` |
| payment collection ของ cart | link `cart_payment_collection`, `POST /store/payment-collections` (storefront สร้างเองเมื่อ cart ไม่มี) | ใช้ตามเดิม (ADR-025) — dismiss link ด้วย workflow ของเรา + compensation |

### Business rules (รอบ 40)
10. (PAY-8 — B-1; owner "กันที่ backend" 2026-11-21) middleware บน `POST /admin/payments/:id/refund` (หลัง auth ของ admin ที่ Medusa ใส่ให้):
    (a) หา order ของ payment (`payment.payment_collection` → `order_payment_collection`); ไม่มี order → `next()` (พฤติกรรมเดิม — script `refund-orphan-payment.ts` ใช้ `refundPaymentsWorkflow` ไม่ผ่าน route นี้อยู่แล้ว);
    (b) order มี `order_change` ที่ `status ∈ {pending, requested}` (return/claim/exchange/order edit ที่ค้าง) → throw `MedusaError(NOT_ALLOWED, "Cannot refund while this order has an active return, claim, exchange or edit. Confirm or cancel it first.")`
        → **400** ก่อนเรียก provider (ไม่มี refund ใน Stripe, payment ไม่เปลี่ยน); ไม่มี → `next()`;
    (c) ข้อความอังกฤษ (admin) ห้ามเรียก Stripe ตรง; ไม่แตะ `refundPaymentWorkflow`; ลงทะเบียนใน admin middlewares ของเรา (ไฟล์ใหม่ `src/api/admin/payments/middlewares.ts` spread เข้า `middlewares.ts`)
    (d) (แก้ตาม review #425) เส้นทาง refund อัตโนมัติของ group buy (ADR-024 ข้อ c) ใช้ `refundPaymentsWorkflow` ที่ไม่สร้าง credit line จึงไม่ผ่าน route นี้และไม่ต้องใช้ helper นี้
    (e) รายงาน upstream เรื่อง `refundPaymentWorkflow` คืนเงินก่อนสร้าง credit line — **owner อนุมัติให้เปิด issue 2026-11-21** (session หลักเปิด; ร่างอยู่ใน PR body ของ PAY-8)
11. (PAY-9 — O-2, ADR-025 accepted 2026-11-21) payment collection ของ **cart** ที่ยังไม่มี order และมี payment ที่ capture แล้วถูกคืนครบ (`MathBN` จาก `raw_*`) เมื่อลูกค้าสร้าง session ใหม่
    (`POST /store/payment-collections/:id/payment-sessions`) → dismiss link cart ↔ collection (workflow + compensation, lock `cart_id`) แล้วตอบ **409** `{ type: "conflict", code: "PAYMENT_COLLECTION_RESET", message }`
    (code ใน allow-list ของ PROMO-2); storefront (`initiatePaymentSession`) ได้ code นี้ → อ่าน cart ใหม่ แล้วเรียกซ้ำ **1 ครั้ง** (สร้าง collection ใหม่ด้วย route ของ Medusa) — ครั้งที่สองยังได้ code เดิม → error ไทยทั่วไป;
    collection ที่ผูก order, ไม่มี payment, หรือมี payment ที่ยังไม่คืนครบ → `next()` (พฤติกรรมเดิม); ลำดับ middleware ตาม ADR-025

### Acceptance criteria (รอบ 40)
- ☑ AC-21 (PAY-8, กฎข้อ 10) integration http (admin JWT, mock Stripe provider ที่นับการเรียก `refundPayment`) — **ล้มบน develop** ก่อน:
  (a) order captured ฿600 + return request ที่ยังไม่ confirm (`POST /admin/returns` + request) When `POST /admin/payments/:id/refund { amount: 100 }` Then 400 ข้อความมี `active return`, provider ไม่ถูกเรียก, `refunds` ของ payment ว่าง, `order.summary.refunded_total` = 0;
  (b) order edit ที่ค้าง (`POST /admin/order-edits`) → 400 แบบ (a); (c) ยกเลิก return request แล้ว refund ฿100 → 200, `payment_status = partially_refunded`, credit line 1 รายการ และ event `payment.refunded` ถูก emit 1 ครั้ง (spy event bus);
  (d) order ที่ไม่มี order change → 200 (regression ของ AC-6)
- ☑ AC-22 (PAY-9, กฎข้อ 11) integration http + e2e — **ล้มบน develop** ก่อน:
  (a) integration: cart ที่ collection มี payment captured ฿X แล้วถูกคืนครบด้วย `refundPaymentsWorkflow` (จำลองผลของ `compensatePaymentIfNeededStep`) When เจ้าของ cart `POST .../payment-sessions` Then 409 code `PAYMENT_COLLECTION_RESET`,
      link `cart_payment_collection` ของ cart ว่าง, collection เดิมยังอยู่พร้อม refund; ยิงซ้ำพร้อมกัน 2 request → ทั้งคู่ 409 code เดิม ไม่มี error 5xx; หลัง `POST /store/payment-collections { cart_id }` + สร้าง session + complete → order มี payment collection **1** ชุด (ชุดใหม่) และ `payment_status = captured`;
  (b) collection ที่มี payment captured ยังไม่คืน → ไม่ถูก reset (ผล AC-13 เดิม); collection ของ order (group buy) → ไม่ถูก reset;
  (c) e2e (Stripe test mode): ลูกค้าอยู่ขั้น review ของ cart flash 1 ชิ้น (สิทธิ์ 1 — ปุ่มสั่งซื้อกดได้ ผ่านด่าน UI ของ FS-21 spec 03 กฎข้อ 26b) แล้วใช้สิทธิ์จาก cart อื่นผ่าน API (แบบสองแท็บ) → กดสั่งด้วยบัตร → capture แล้ว complete ล้ม `FLASH_LIMIT_EXCEEDED` → ถูกคืนเงิน → admin เพิ่มสิทธิ์ต่อคนแล้วจ่ายใหม่ใน cart เดิม → หน้า order confirmed (แก้ถ้อยคำ 2026-11-21 review #445: เดิม "ซื้อเกินสิทธิ์แล้วลดจำนวน" ซึ่ง FS-21 ปิดปุ่มสั่งซื้อก่อนตัดเงินแล้ว); `GET /admin/orders/:id` ได้ `payment_status = captured` และ payment collection 1 ชุด (แทน #69)

### Test plan (รอบ 40)
| ระดับ | AC |
|---|---|
| integration http (mock provider) | AC-21 |
| integration http + e2e Stripe test mode | AC-22 |

### Tasks (รอบ 40)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| PAY-8 | ☑ #426 — (B-1 — เงิน) middleware กัน refund ของ admin เมื่อ order มี active order change (กฎข้อ 10) + ร่าง issue upstream ใน PR body (owner อนุมัติเปิดแล้ว — session หลักเปิด) | `apps/backend/src/api/admin/payments/middlewares.ts` (ใหม่), `apps/backend/src/lib/active-order-change.ts` (ใหม่ + unit), `apps/backend/src/api/middlewares.ts`, `integration-tests/http/admin-refund-guard.spec.ts` (ใหม่) | ~80 LOC + ~200 LOC test | AC-21 | PR เอกสารรอบ 40 merge | `middlewares.ts` (GB-20, PAY-9, GB-25) |
| PAY-9 | ☑ #445 — (O-2 — เงิน, ADR-025 accepted 2026-11-21) reset collection ของ cart ที่ถูกคืนเงิน (กฎข้อ 11) + storefront เรียก `initiatePaymentSession` ซ้ำ 1 ครั้งเมื่อได้ `PAYMENT_COLLECTION_RESET` | `apps/backend/src/api/store/payment-collections/refunded-collection-reset.ts` (ใหม่), `apps/backend/src/workflows/payment/reset-cart-payment-collection.ts` (ใหม่), `apps/backend/src/api/middlewares.ts`, `apps/backend/src/api/error-handler.ts` (allow-list), `apps/storefront/src/lib/data/cart.ts`, test integration + `apps/storefront/e2e/pay-9-refunded-cart-repay.spec.ts` | ~180 LOC + ~250 LOC test | AC-22 | **GB-20** (ลำดับ middleware บน route เดียวกัน), ADR-025 accepted ☑ | `middlewares.ts`, `cart.ts` (FS-22 แตะ error map ของ checkout — คนละฟังก์ชัน) |

ลำดับ: PAY-8 ∥ GB-20 (คนละ route แต่ไฟล์ `middlewares.ts` ร่วม — ตัวที่ merge ทีหลัง sync) → PAY-9 (หลัง GB-20)

## Follow-up รอบ 41 (2026-11-21 — owner: ทุกข้อใน release v0.3.0)
ที่มา: review #426 (PAY-8 — admin เห็น toast 400 หลังกด Refund), FS-22 builder/review #464 (PromptPay `finish` ค้าง "กำลังสร้างคำสั่งซื้อ"; `/api/payment-return` ส่ง `/cart?error=order_failed` แต่หน้า cart ไม่อ่าน),
qa/review #445 (e2e `pay-9-refunded-cart-repay` step จ่ายใหม่ flaky — `sessionIntentId` ได้ `""` ระหว่าง Stripe ตอบ 500)

### What Medusa already gives us (รอบ 41)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ปุ่ม Refund ของหน้า order | `@medusajs/dashboard` 2.22.1 `order-detail` — action `to: /orders/:id/refund?paymentId=…`, `disabled: !payment.captured_at \|\| !!payment.canceled_at \|\| totalRefunded >= payment.amount` (`dist/order-detail-ERHRK6W3.mjs:2420-2423`) — **ไม่มีจุดขยาย** ให้ซ่อน/ปิดจาก extension | ซ่อน/ปิดไม่ได้โดยไม่ patch → widget แจ้งเตือน (Q-P11 = ก owner ตัดสิน 2026-11-21) |
| อ่าน order change ที่ค้าง | `useOrderPreview(id)` ของ `@medusajs/dashboard/hooks` (`dist/hooks.d.ts:779`) — `order.order_change` = active change (`getActiveOrderChange_` ของ order module: status pending/requested); หน้า order เรียกแบบเดียวกันจึงใช้ cache ร่วม และ mutation ของ return/claim/exchange/edit invalidate `preview(id)`. **ไม่ใช้** `useOrderChanges` (2.22.1: queryKey `changes(id)` ไม่รวม query → cache ชนกับ timeline จนหน้า order crash และ mutation เหล่านั้นไม่ invalidate key นี้ — review/qa #471) | ใช้ตามเดิม ห้ามส่ง query (กฎข้อ 12) |
| แจ้งเตือนใน widget | injection zone `order.details.before`, `Alert`/`Container` ของ `@medusajs/ui` | ใช้ตามเดิม |
| ตำแหน่ง widget บนหน้า order | dashboard 2.22.1 ทิ้ง suffix `.before`/`.after` (`getWidgetsForSections`) แล้ววาง widget ต่อท้ายคอลัมน์หลัก (ใต้ Payments) — ตำแหน่งปรับได้ด้วย layout configuration ของ zone (`id` ใน `defineWidgetConfig` + system default ของ Settings module `setSystemDefaultLayoutConfiguration`; แอดมินปรับเองได้ด้วย "Customize layout") | ขยาย: migration script ตั้ง default layout ของ `order.details` ให้ widget ขึ้นบนสุด (กฎข้อ 12) |
| ทาง redirect ของ 3DS/PromptPay | route ของ starter `/api/payment-return` + `placeOrder` | ขยาย (กฎข้อ 14) |

### Business rules (รอบ 41)
12. (PAY-10 — Q-P11 = ก owner ตัดสิน 2026-11-21) widget `order.details.before` (`src/admin/widgets/order-refund-blocked.tsx`): เมื่อ order มี order change `status ∈ {pending, requested}` (`order_change` ของ `useOrderPreview(id)` ไม่ส่ง query — ค่าเดียวกับ middleware ของ PAY-8 กฎข้อ 10b; ขึ้น/หายเองเมื่อแอดมินเริ่ม/ยกเลิก/confirm change บนหน้าเดียวกันโดยไม่ reload;
    ขึ้นบนสุดของคอลัมน์หลักในจอแรกผ่าน default layout ของ zone `order.details` ที่ migration script `src/migration-scripts/order-refund-blocked-layout.ts` ตั้ง — ไม่ทับตำแหน่งที่แอดมินกำหนดเอง; แอดมินที่บันทึก layout ส่วนตัวไว้ก่อนจะเห็นตาม layout ของตัวเอง)
    แสดง `Alert` (variant warning, testid `order-refund-blocked`) ข้อความอังกฤษ "Refunds are blocked while this order has an active return, claim, exchange or edit. Confirm or cancel it first." + ชนิดของ change ที่ค้าง;
    ไม่มี change ค้าง → ไม่ render อะไร; ไม่แตะปุ่ม Refund ของ Medusa (ยังกดได้ แล้ว middleware ของ PAY-8 ตอบ 400 ข้อความเดียวกันเป็น toast)
13. (PAY-11 — ต่อจาก FS-22, spec 03 กฎข้อ 27/29) PromptPay ทางสำรอง `finish()` จัดผลด้วย helper `placeOrderOutcome` ของ CORE-76 (allow-list — spec 01 กฎข้อ 134 a2):
    `processing` (409 code `CART_COMPLETION_IN_PROGRESS` — backend แปลงจาก 409 ไม่มี code ของ Medusa, spec 01 กฎข้อ 134 a2 (session หลักตัดสิน 2026-11-21 ตามรายงาน builder CORE-76)) → poll ต่อตามเดิม; `unauthorized` (401/403) → login ใหม่ตามเดิม; kind `refunded` (`FLASH_*`/สต็อกไม่พอ/code ของ hook ใน allow-list) → หยุด poll ทันที
    แล้วแสดง `promptpay-refunded` ข้อความตามกฎข้อ 27 ของ spec 03 (บอกเหตุผล "สินค้า/สิทธิ์ราคาพิเศษหมดระหว่างชำระเงิน… คืนเงินเต็มจำนวนให้อัตโนมัติ") แทนการค้าง "กำลังสร้างคำสั่งซื้อ";
    poll ได้ `refunded` โดยไม่รู้เหตุ → ข้อความเดิมของ PAY-6c; network/5xx → poll ต่อตามเดิม (PAY-6b)
14. (PAY-12) `/api/payment-return` (redirect off-site — 3DS/PromptPay redirect) ใช้ `placeOrderOutcome` เดียวกัน: kind `refunded` → `/<cc>/cart?error=refunded`;
    `processing` → อ่าน order ของ cart: มี → หน้า order confirmed, ยังไม่มี → `/<cc>/checkout?step=review` (กลไก poll ของ PAY-6b); `unauthorized` → หน้า login พร้อม return path เดิม (review/qa #481 D-1: return path = `/<cc>/checkout?step=review` ที่ `readReturnTo` รับ — ห้ามส่ง URL ของ route ที่มี `payment_intent_client_secret`; 401/403 ตอนอ่าน cart ก่อน complete ไปทางนี้ด้วย ไม่ใช่ `payment_failed`; session หลักตัดสิน #481: อ่าน cart ล้มด้วย 5xx/network = ไม่รู้ผลการชำระ → `/<cc>/checkout?step=review` ให้ placeOrder/poll ทำต่อ ไม่บอกว่าชำระไม่สำเร็จ — `payment_failed` เหลือเฉพาะที่รู้แน่ว่าไม่ได้จ่าย/ข้อมูลไม่ตรง: `redirect_status=failed`, ไม่มี param, ไม่พบ session/secret ไม่ตรง, 4xx อื่น; qa #481 D-2: ทาง review ทุกทางของ route นี้ส่ง `cart_id` (id ของ Medusa ไม่ใช่ secret) ไปด้วย — `/<cc>/checkout?step=review&cart_id=<cart>`; หน้า checkout ที่มี `cart_id` แต่ไม่มี cart (cookie ถูกล้างตอนไม่มี jwt และ `restoreActiveCart` ข้าม cart ที่ complete) หรือ cart complete แล้ว → หา order ของลูกค้าที่ `cart.id` ตรง (`GET /store/orders` field `cart.id`) แล้วไปหน้า order confirmed, ไม่พบ → `/<cc>/account/orders` ไม่แสดง 404); error อื่น → `order_failed` (เดิม); ปฏิเสธ → `payment_failed` (เดิม);
    หน้า `/<cc>/cart` อ่าน `error` ∈ {`refunded`, `order_failed`, `payment_failed`} แล้วแสดง `cart-error-notice` ข้อความไทยต่อค่า (`refunded` = ข้อความกฎข้อ 27 spec 03; `order_failed` = "สร้างคำสั่งซื้อไม่สำเร็จ หากมีการตัดเงิน ระบบจะคืนเงินให้อัตโนมัติ กรุณาตรวจสอบตะกร้าแล้วสั่งใหม่";
    `payment_failed` = "ชำระเงินไม่สำเร็จ กรุณาเลือกวิธีชำระเงินอีกครั้ง"); ค่าอื่น → ไม่แสดง (ไม่ render ค่าจาก URL ตรง)
15. (PAY-13 — test hygiene) e2e `pay-9-refunded-cart-repay.spec.ts` ขั้นจ่ายใหม่: รอ `sessionIntentId` ไม่ว่างด้วย `expect.poll` (หรือรอ response ของ `POST .../payment-sessions` ที่ 2xx) ก่อนใช้ค่า;
    Stripe ตอบ 5xx ชั่วคราว → ลองสร้าง session ใหม่ตามทางที่ผู้ใช้ทำได้ (เช่นเลือกวิธีชำระอีกครั้ง) ไม่เกิน 2 ครั้ง; **ห้าม**ลดสิ่งที่ตรวจ (AC-22c ทุกข้อคงเดิม), ห้าม `waitForTimeout`/`retries`/เพิ่ม timeout ระดับ config
16. (PAY-14 — owner สั่ง 2026-11-21, review #468 ยืนยัน; ไม่กระทบเงิน) complete ล้มหลังตัดบัตร แล้วลูกค้าเปิดขั้น payment ภายใน ~1 วินาทีระหว่าง compensation
    (`refundPaymentAndRecreatePaymentSessionWorkflow` → `createPaymentSession_` บันทึก session `pending` ที่ชี้ PI เดิมก่อนเรียก Stripe แล้วค่อยลบ) → หน้าเลือก radio บัตรไว้แล้ว Stripe Elements ขึ้น error อังกฤษ "terminal state"
    และคลิก radio เดิมไม่เรียก `onChange` → ติดจน reload (ขัด ADR-014):
    (a) ขั้น payment ตรวจ PI ของ session ที่เลือกอยู่ (`stripe.retrievePaymentIntent(client_secret)` ฝั่ง client — มีอยู่แล้วใน PromptPay) หรือรับ error จาก Elements (`loaderror`/`confirmPayment` ที่บอกว่า PI จบแล้ว):
        PI สถานะ `succeeded`/`canceled` หรือ Elements error → **ไม่** mount Elements กับ PI นั้น แล้วอ่าน cart ใหม่และเรียก `initiatePaymentSession` **ทุกครั้ง อัตโนมัติ 1 ครั้ง** — storefront ใช้สถานะ PI
        แค่ตัดสินว่า "ห้าม mount" ไม่ตัดสินเรื่องเงิน (client แยก "จ่ายแล้วยังไม่คืน" กับ "คืนครบแล้ว" ไม่ได้ — PI ที่ถูกคืนยังเป็น `succeeded`); backend ตัดสินตามลำดับ middleware ของ ADR-025:
        คืนครบแล้ว → 409 `PAYMENT_COLLECTION_RESET` → storefront retry 1 ครั้ง (กฎข้อ 11) ได้ collection/session ใหม่; จ่ายแล้วยังไม่คืน → 409 `PAYMENT_ALREADY_COMPLETED` → กลไกรอ order ของ ADR-015 (ไม่สร้าง PI ใหม่);
        (a2) race ที่ต้องครอบ (review #467): `guardPaidStripeSession` อ่านรายการ session **ก่อน**เข้า lock `cart_id` ที่ compensation ถืออยู่ → ได้ lock แล้ว session ชั่วคราวถูกลบไปแล้ว → `NOT_FOUND` ถูก rethrow —
             builder ยืนยันใน integration ก่อน แล้วแก้ที่ guard ให้อ่าน session ใหม่หลังได้ lock (session ที่หายไป = ข้ามการตรวจของ session นั้น) **หรือ** ให้ storefront ถือ 404 จาก `POST .../payment-sessions` เป็น "อ่าน cart แล้วลองใหม่ 1 ครั้ง" — เลือกทางเดียวและบันทึกใน PR;
        ยังไม่ได้ → แสดงข้อความไทย `payment-session-reset-notice` "กรุณาเลือกวิธีชำระเงินอีกครั้ง" และการคลิก radio ที่เลือกอยู่ (หรือปุ่ม `payment-session-retry`) สร้าง session ใหม่ได้ (ไม่พึ่ง `onChange`);
    (b) ข้อความ error ของ Stripe (ภาษาอังกฤษ) ไม่แสดงให้ลูกค้า — map เป็นข้อความไทยผ่าน helper เดิมของ CORE-4i;
    (c) ไม่ confirm PI เดิมที่จบแล้ว และไม่ตัดเงินซ้ำ: session ใหม่ = PI ใหม่ (Stripe provider สร้างให้); PI `succeeded` ที่**ยังไม่ถูกคืนเงิน** → backend ตอบ `PAYMENT_ALREADY_COMPLETED` (ADR-015) จึงไม่สร้าง PI ใหม่;
        PI `succeeded` ที่**คืนครบแล้ว** (กรณีหลักของ PAY-14) → `PAYMENT_COLLECTION_RESET` แล้วได้ session ใหม่;
    (d) ถ้าเรียก `stripe.retrievePaymentIntent` ใน component ของขั้น payment ให้เพิ่มข้อยกเว้นที่ระบุเหตุผลใน `checkout-affiliate-coverage.test.ts` (test นี้ตรวจจุดที่เรียก Stripe ก่อน sync cookie `aff` — AF-3b)
17. (PAY-15 — owner ตัดสิน 2026-11-22 จาก review #479; ต่อจากกฎข้อ 13) หลัง `promptpay-refunded` จากผล kind `refunded` ที่**รู้เหตุ** (`FLASH_SOLD_OUT`/`FLASH_LIMIT_EXCEEDED`/สต็อกไม่พอ/`PROMOTION_NOT_COMBINABLE` ฯลฯ — helper `promptPayFinishAction`)
    → **ไม่แสดง**ปุ่ม "เริ่มชำระใหม่" (`promptpay-retry-button`) เพราะปุ่มนั้นสร้าง QR ใหม่บนตะกร้าเดิมที่ยังมีเหตุเดิมอยู่ (ลูกค้าจ่ายซ้ำแล้วถูกคืนซ้ำ) แต่แสดงลิงก์ "ไปที่ตะกร้า" (`promptpay-go-to-cart`, ข้อความไทย)
    ไปที่ `/<cc>/cart` ให้ลูกค้าปรับตะกร้า/โค้ดส่วนลดตามข้อความ; refunded โดย**ไม่รู้เหตุ** (poll ของ PAY-6c) → คงปุ่ม "เริ่มชำระใหม่" และข้อความเดิม ไม่แสดง `promptpay-go-to-cart`

### Acceptance criteria (รอบ 41)
- ☑ AC-23 (PAY-10, กฎข้อ 12) e2e admin: order ที่มี return request ค้าง → เห็น `order-refund-blocked` (ข้อความมี `active return`); ยกเลิก return request แล้ว reload → ไม่เห็น; order ปกติ → ไม่เห็น;
  (review/qa #471, hotfix หลัง #471) เริ่ม return ผ่านหน้า Create Return ของ Medusa → widget บนหน้า order ขึ้นเองโดยไม่ reload; ปิดฟอร์มโดยไม่ submit → Medusa ยกเลิก return request (`onClose` → `cancelReturnRequest` เมื่อฟอร์ม mount แล้ว) → widget หายเอง; กด Cancel Return ในหน้า order → หายเองโดยไม่ reload; ที่ 1280×720 widget อยู่ในจอแรกเต็มกล่องโดยไม่ scroll
- ☑ AC-24 (PAY-11, กฎข้อ 13) unit Vitest (logic ของ finish/poll เป็น pure helper) + e2e route mock: complete ของทางสำรองตอบ 409 `FLASH_SOLD_OUT` → ภายใน 5 วินาทีเห็น `promptpay-refunded` มีคำ "คืนเงิน" และไม่เห็น `promptpay-awaiting-order`; ไม่มี request poll เพิ่มหลังนั้น (ล้มบน develop+FS-22 — ค้าง awaiting); 409 `CART_COMPLETION_IN_PROGRESS` → ยัง poll และไม่เห็น `promptpay-refunded`
- ☑ AC-25 (PAY-12, กฎข้อ 14) unit ของ route (แบบ `core-29-active-cart.test.ts:187-214`) + e2e: placeOrder kind `refunded` → location `/th/cart?error=refunded`; 409 `CART_COMPLETION_IN_PROGRESS` + order มีแล้ว → หน้า order confirmed (ไม่ใช่ `error=refunded`); 401 → หน้า login; เปิด `/th/cart?error=refunded|order_failed|payment_failed` → `cart-error-notice` อักษรไทยตามค่า; `?error=<script>` → ไม่แสดง (ล้มบน develop — หน้า cart ไม่อ่าน `error`)
- ☑ AC-27 (PAY-14, กฎข้อ 16) unit Vitest (helper ตัดสิน "PI จบแล้ว → reset") + e2e (Stripe test mode หรือ route mock ที่ให้ cart คืน session `pending` ชี้ PI ที่ `succeeded`/`canceled` แล้ว) — **ล้มบน develop** ก่อน:
  (a) เปิดขั้น payment → ภายใน 10 วินาทีมี `POST .../payment-sessions` ใหม่ 1 ครั้งและ Elements mount กับ client secret ใหม่ (ไม่ใช่ของ PI เดิม); บังคับให้การสร้างอัตโนมัติล้ม 1 ครั้ง (route mock 500) → เห็น `payment-session-reset-notice` แล้วคลิก radio บัตรที่เลือกอยู่ → สร้าง session ใหม่สำเร็จ;
  (b) ตลอดขั้นตอนไม่มีข้อความ "terminal state" หรือข้อความอังกฤษของ Stripe ใน DOM ที่มองเห็น (ตรวจด้วย regex อักษรละตินบนข้อความ error ที่มองเห็น + อักษรไทย);
  (c) ไม่มี request `confirmPayment` กับ PI เดิม (นับ request ไป `api.stripe.com/v1/payment_intents/<pi เดิม>/confirm` = 0); จ่ายด้วย session ใหม่แล้วได้ order 1 รายการ payment captured 1 รายการ;
  (c1) PI เดิม `succeeded` ที่**ยังไม่ถูกคืนเงิน** (ยังไม่มี order) → storefront เรียก `initiatePaymentSession` แล้วได้ 409 `PAYMENT_ALREADY_COMPLETED` → ไม่มี session/PI ใหม่ และเข้ากลไกรอ order (ADR-015);
  (c2) PI เดิม `succeeded` ที่**คืนครบแล้ว** → ได้ 409 `PAYMENT_COLLECTION_RESET` แล้ว retry ได้ collection + session ใหม่ (client secret ใหม่) และจ่ายได้;
  (d) integration race (กฎข้อ 16 a2): ยิง `POST .../payment-sessions` ระหว่าง compensation ถือ lock `cart_id` แล้ว session ชั่วคราวถูกลบ → ผลสุดท้ายฝั่งลูกค้าได้ session ใหม่ (ไม่ค้างที่ 404/500) ตามทางที่ builder เลือก
- ✕ AC-26 (PAY-13, กฎข้อ 15) e2e `pay-9-refunded-cart-repay` `--repeat-each=5` ผ่านในเครื่อง/CI; static: ไม่มี `waitForTimeout` ใหม่ และ assertion ของ AC-22c เท่าเดิม (นับ `expect(` ของ step เดิมไม่ลด)
  — **ปิดโดยไม่มี PR แยก (ปิดรอบ 41 2026-11-23)**: hotfix #468 (merge ก่อน PR เอกสารรอบ 41) แก้ต้นเหตุ flaky — **เพิ่ม** การรอ execution ของ `complete-cart` จบทุกตัว (`cartCompletionSettled`, `e2e/support/cart-completion.ts`) ก่อนจ่ายใหม่
    และเอา `expect.poll` ชั้นนอกออก; ส่วนแรกของกฎข้อ 15 (รอ `sessionIntentId` ไม่ว่าง) เป็นจริง**อยู่ก่อนแล้วตั้งแต่ PAY-2** (`dc4b2c13` — `e2e/support/stripe.ts:76-92` poll `pi_…` 15 วินาที; แก้ถ้อยคำตาม review #520);
    ส่วน "ลองสร้าง session ใหม่เมื่อ Stripe 5xx" ไม่ทำ — ไม่พบ flaky ซ้ำหลัง #468 (ถ้าซ้ำ เปิด task ใหม่)
- ☑ AC-28 (PAY-15, กฎข้อ 17) unit Vitest (helper บอกว่ากรณีไหนไปตะกร้า) + e2e route mock แบบ AC-24: complete ของทางสำรองตอบ 409 `FLASH_SOLD_OUT` → เห็น `promptpay-refunded` และ `promptpay-go-to-cart` (อักษรไทย, href ลงท้าย `/th/cart`)
  ไม่เห็น `promptpay-retry-button` (ล้มบน develop — ปุ่มเริ่มชำระใหม่แสดงทุกกรณี); คลิก `promptpay-go-to-cart` → อยู่ที่ `/th/cart`; regression PAY-6c (poll เห็น refunded ไม่รู้เหตุ) → ยังเห็น `promptpay-retry-button` และไม่เห็น `promptpay-go-to-cart`
  (ปิดรอบ 41: ย้ายวงเล็บ "ล้มบน develop" มาไว้หลังส่วนที่ล้มจริงตาม review #484 — ส่วน regression ผ่านบน develop)

### Tasks (รอบ 41)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| PAY-10 | ☑ #471 — widget แจ้งว่า refund ถูกกันเมื่อมี order change ค้าง (กฎข้อ 12); qa | `apps/backend/src/admin/widgets/order-refund-blocked.tsx` (ใหม่), e2e admin | ~50 LOC + ~80 LOC test | AC-23 | PR เอกสารรอบ 41 (Q-P11 = ก ☑), PAY-8 (#426) | — |
| PAY-11 | ☑ #479 — PromptPay ทางสำรองหยุดค้างและบอกเหตุคืนเงิน (กฎข้อ 13); qa | `modules/checkout/components/promptpay-payment/index.tsx`, `lib/util/promptpay*.ts` (+ test), e2e | ~50 LOC + ~120 LOC test | AC-24 | **FS-22 (#464)**, **CORE-76** (kind `refunded`) | `cart.ts`/`checkout-error.ts` |
| PAY-12 | ☑ #481 — `/api/payment-return` → `error=refunded` + หน้า cart อ่าน `error` (กฎข้อ 14); qa | `app/api/payment-return/route.ts`, `app/[countryCode]/(main)/cart/page.tsx`/`modules/cart/templates`, `lib/util/cart-error.ts` (+ test), e2e | ~60 LOC + ~120 LOC test | AC-25 | **FS-22 (#464)**, **CORE-76** | `cart.ts` (ไม่แก้ — ใช้ผลของ CORE-76) |
| PAY-13 | ✕ ปิดโดย hotfix #468 (ไม่มี PR แยก — ดู AC-26) — (test hygiene) e2e pay-9 จ่ายใหม่ไม่ flaky (กฎข้อ 15) | `apps/storefront/e2e/pay-9-refunded-cart-repay.spec.ts` | ~30 LOC | AC-26 | PR เอกสารรอบ 41 | — |
| PAY-14 | ☑ #482 — ขั้น payment ไม่ติดกับ session ชั่วคราวที่ชี้ PI ที่จบแล้ว: สร้าง session ใหม่อัตโนมัติ/คลิกตัวเลือกเดิมได้ + ไม่โชว์ error อังกฤษของ Stripe (กฎข้อ 16); qa | `modules/checkout/components/payment/index.tsx`, `modules/checkout/components/payment-container`/Stripe wrapper, `lib/util/payment-session.ts` (+ test), `lib/data/cart.ts` (ถ้าต้อง), `checkout-affiliate-coverage.test.ts` (ข้อยกเว้น), backend `guardPaidStripeSession` ถ้าเลือกแก้ที่ guard (+ integration), e2e `pay-14-stale-session.spec.ts` | ~100 LOC + ~200 LOC test | AC-27 | **CORE-76** (ไฟล์เดียวกัน: `cart.ts`/helper error) | `cart.ts`, `payment/index.tsx` (PAY-11/12 — ตัวหลัง sync) |
| PAY-15 | ☑ #484 — (owner ตัดสิน 2026-11-22 (review #479)) PromptPay refunded ที่รู้เหตุ: ซ่อน "เริ่มชำระใหม่" แสดงลิงก์ "ไปที่ตะกร้า" (กฎข้อ 17); qa | `modules/checkout/components/promptpay-payment/index.tsx`, `lib/util/promptpay-finish.ts` (+ test), e2e `pay-15-promptpay-go-to-cart.spec.ts`, regression `payments-promptpay-fallback-cap.spec.ts` | ~20 LOC + ~120 LOC test | AC-28 | **PAY-11 (#479)** | `promptpay-payment/index.tsx` |

ลำดับ: PAY-13 ∥ PAY-10 อิสระ; CORE-76 → (PAY-11 ∥ PAY-12 ∥ PAY-14); PAY-11 → PAY-15

### Open questions (รอบ 41)
- ~~**Q-P11**~~ **ตัดสินแล้ว (owner 2026-11-21) = (ก)** widget `order.details.before` แจ้งเตือน (กฎข้อ 12) — คำถามเดิม: (PAY-10) owner สั่ง "ซ่อน/ปิดปุ่ม Refund เมื่อมี order change ค้าง" แต่ปุ่มเป็นของหน้า order ใน `@medusajs/dashboard` (เงื่อนไข disabled ฝังใน `order-detail` — ไม่มี injection/override ให้ extension):
  (ก) **[Recommended]** widget เตือนเหนือหน้า order (กฎข้อ 12) + toast 400 ของ PAY-8 ที่มีอยู่ — ไม่แตะ library, ~50 LOC; ปุ่มยังกดได้แต่เงินไม่ถูกคืนผิด (backend กันแล้ว)
  (ข) patch `@medusajs/dashboard` ด้วย `pnpm patch` ให้ disabled เมื่อมี change ค้าง — ซ่อนจริง แต่ขัด ADR-018 (ห้าม patch library) ต้องมี ADR ใหม่และตรวจซ้ำทุก bump
  (ค) ไม่ทำ — คง toast 400 ของ PAY-8

## Follow-up รอบ 42 (ปิดรอบ 41 2026-11-23 — review/qa #479, #481, #482, #484; ไม่บล็อก release v0.3.0)
Status: done (☑ PAY-16..19 merge แล้ว — ปิดรอบ 42 2026-11-24) · ไม่กระทบเงิน (backend ADR-015/ADR-025 กันการตัดเงินซ้ำอยู่แล้ว) — UX/สถานะของหน้าร้านล้วน
### What Medusa already gives us (รอบ 42)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| error ของการ confirm บัตร | Stripe.js `confirmPayment` คืน `error` (`type`/`code`/`decline_code`/`message` ตาม locale ของ Elements) — ไม่ใช่ของ Medusa | map เป็นไทยด้วย helper เดิมของ CORE-4i/PAY-14 (กฎข้อ 19) |
| redirect หลังชำระ | route ของ starter `/api/payment-return` (ขยายแล้วใน PAY-12) | ใช้ตามเดิม (กฎข้อ 20) |
| จำว่า cart นี้ "จ่ายแล้วถูกคืนเงิน" ข้าม reload/Back (Q-P12 = ข, **Q-P13 = ก owner 2026-11-24**) | `payment_collection` ของ cart ใน Store API (`captured_amount`/`refunded_amount` อยู่ใน default `*payment_collection` ของ store cart 2.22.1, `completed_at` ของ cart) — **ข้อเท็จจริงที่พบ (PAY-19)**: `refundPaymentAndRecreatePaymentSessionWorkflow` คืนเงินสำเร็จแต่**สร้าง session ใหม่ไม่สำเร็จ** (สร้างด้วย `data` เดิมที่ `payment_method` เป็น object → Stripe ตอบ `Invalid string` billing_details — log จริงของ manual test 2026-11 และ integration `complete-after-payment-log.spec.ts`: หลัง compensation `payment_sessions` = `[]`) collection เดิมจึงเหลือยอดที่คืนครบและ**ไม่มี session** จนลูกค้าเลือกวิธีชำระใหม่ (PAY-9/ADR-025 `PAYMENT_COLLECTION_RESET` → collection ใหม่); helper `promptPayPollState` ของ PAY-6c อ่านสัญญาณนี้อยู่แล้ว; **refund ของพร้อมเพย์ (Q-P14/Q-P15, CI run 45337457353)**: Stripe สร้าง refund เป็น `requires_action` แล้วส่งอีเมลขอบัญชีรับเงินคืนถึงลูกค้า (บัญชี test ส่งได้เฉพาะอีเมลของบัญชี — อีเมลอื่นได้ error `Cannot send email…` ซึ่ง `refundPaymentsStep` ของ core-flows กลืนเป็น log `Error was thrown trying to cancel payment` → ไม่มี refund); Stripe provider ของ Medusa นับ refund ที่สร้างสำเร็จว่าคืนแล้วทันที (`refunded_amount` อัปเดตแม้ยัง `requires_action`) | ใช้ตามเดิม — ไม่เขียน `cart.metadata`, cookie หรือ storage ใหม่ (สัญญาณของ Medusa ล้างเองเมื่อ collection ถูก reset) (กฎข้อ 21) |
### Business rules (รอบ 42)
18. (PAY-16 — qa/review #482) ขั้น payment (`modules/checkout/components/payment/index.tsx`): (a) `payment-session-reset-notice` หายเมื่อเปลี่ยนวิธีชำระ (`setPaymentMethod`) หรือเมื่อ client secret ที่ใช้อยู่เปลี่ยน (session ใหม่มาแล้ว) —
        "ลองอีกครั้ง" หลังเปลี่ยนวิธีจึงไม่สร้าง session ของวิธีที่ไม่ได้เลือก; (b) guard กันยิงซ้ำของการ renew ใช้ ref (ไม่ใช่ state) และปุ่ม `payment-session-retry` `disabled` ระหว่าง renew;
    (c) renew สำเร็จแต่ RSC refresh ไม่มาภายใน 10 วินาที → เลิก skeleton แล้วแสดง `payment-session-reset-notice` (ไม่ค้าง); (d) ระหว่างรอ order ของ `PAYMENT_ALREADY_COMPLETED` (ADR-015) radio วิธีชำระ `disabled`
19. (PAY-17 — review #482, #484) (a) `StripePaymentButton` ขั้น review (`payment-button/index.tsx` ~`:225`): `error.message` ของ Stripe ไม่แสดงตรง — map เป็นข้อความไทยด้วย helper เดิมที่ PAY-14 ใช้กับ Elements (กฎข้อ 16b) ตาม `error.type`/`code`
        (บัตรถูกปฏิเสธ/ข้อมูลบัตรผิด/อื่นๆ); (b) PromptPay (`promptpay-payment/index.tsx`): ผล poll ที่เห็น `refunded` **ระหว่าง** `finish()` กำลังรอ `placeOrder` (`finishing.current`) ไม่ตัดสินผล — ให้ผลของ `placeOrder` ตัดสิน
        (กันปุ่ม `promptpay-retry-button` โผล่ชั่วครู่ก่อน `promptpay-go-to-cart`); แก้ comment ที่ล้าสมัย (~`:129-130`)
20. (PAY-18 — re-review #481, qa #481) (a) `/api/payment-return` ที่ `redirect_status=failed` แล้วอ่าน cart ได้ 5xx/network → `/<cc>/checkout?step=payment` (รู้แน่ว่าจ่ายไม่สำเร็จ — ไม่ใช่ `step=review`); unit 401/403/5xx ตรวจว่าไม่เรียก `setCartCookie`;
    (b) หน้า checkout ที่มี `cart_id` ใน query ตัดสินด้วย `!cart || cart.completed_at || cart.id !== cart_id` (cookie ชี้ cart อื่น → ทางหา order ของกฎข้อ 14);
    (c) `cart-error-notice` หายเมื่อลูกค้าแก้ตะกร้าสำเร็จครั้งแรก (ลบ `error` ออกจาก URL ด้วย `router.replace` — ไม่เพิ่ม history)
21. (PAY-19 — Q-P12 = ข owner 2026-11-23; **ขอบเขตตาม Q-P13 = ก owner 2026-11-24**; ต่อจากกฎข้อ 13/17) ขั้น review ตัดสิน "ถูกคืนเงินแล้ว" ที่ `PaymentButton`
    (`modules/checkout/components/payment-button/index.tsx`) จาก cart ที่ render มา: **ไม่มี payment session** และ collection ถูกคืนเงินครบ (นิยามเดียวกับ `promptPayPollState(cart) === "refunded"`
    — cart ยังไม่ `completed_at`, `captured_amount > 0`, `refunded_amount ≥ captured_amount`; pure helper `refundedWithoutSession` ใน `lib/util/payment-session.ts` ไม่เขียนเงื่อนไขซ้ำ):
    (a) แสดง `review-refunded-notice` ข้อความ `REVIEW_REFUNDED_NOTICE` ของ `checkout-error.ts` (หลัง reload ไม่รู้เหตุและไม่รู้วิธีชำระ — บอกทั้งทางบัตรและพร้อมเพย์ตามข้อ f) + ลิงก์ "ไปที่ตะกร้า" `review-refunded-go-to-cart` (→ `/<cc>/cart`)
        **แทน**ปุ่ม disabled "กรุณาเลือกวิธีชำระเงิน" — ครอบ reload, Back จาก `/<cc>/cart` และ RSC หลัง `router.refresh()` ของ PAY-11/15 (`stopRefunded`) ที่ทำให้ component พร้อมเพย์หลุดไป (notice ไม่หาย);
        ส่วนแสดงผลใช้ component ร่วม `refunded-go-to-cart` กับ PAY-15 (`promptpay-refunded`/`promptpay-go-to-cart` เดิมไม่เปลี่ยน)
    (b) ยังมี session (เช่น route mock ของ AC-24/AC-28) → component ของ provider ตัดสินตามเดิม (กฎข้อ 13/17/19) — PAY-19 ไม่แตะ state ใน `promptpay-payment/index.tsx`;
        แต่เมื่อ RSC หลัง `router.refresh()` ไม่มี session แล้ว component พร้อมเพย์หลุดไปทั้งก้อน: `promptpay-refunded`/`promptpay-go-to-cart` ของ PAY-15 และ `promptpay-retry-button`
        ของ PAY-6c (หลัง `stopRefunded(PROMPTPAY_REFUNDED_UNKNOWN)`) **ถูกแทนด้วย** `review-refunded-notice` + `review-refunded-go-to-cart` (ไม่มีปุ่มเริ่มชำระใหม่ — ไม่มี session ให้สร้าง QR อยู่แล้ว)
    (c) ขั้น payment ไม่เปลี่ยน: ลูกค้าเลือกวิธีชำระแล้วจ่ายใหม่ได้ตามเดิม (`initiatePaymentSession` ได้ `PAYMENT_COLLECTION_RESET` → collection ใหม่ → สัญญาณหาย, กฎข้อ 11) ไม่ว่าจะแก้ตะกร้าหรือไม่;
        ไม่มีการล้างสัญญาณจากฝั่ง storefront เอง; ไม่ขึ้นกับ provider (บัตรที่ refresh แล้วไม่มี session ได้ notice เดียวกัน)
    (d) ไม่เพิ่ม field ของ `retrieveCart` (default `*payment_collection` มี `captured_amount`/`refunded_amount` แล้ว — e2e ตรวจด้วย Store API) และไม่เพิ่ม store route
    (e) **มาก่อนกฎข้อ 127 ของ spec 01 เฉพาะกรณีนี้** (session หลักตัดสิน 2026-11-24 ตามเจตนา Q-P13 = ก): `checkoutRedirectStep` ไม่ส่ง `step=review` ไปขั้น payment
        เมื่อขั้นก่อนหน้าเสร็จแล้วและ `refundedWithoutSession(cart)` เป็นจริง (ไม่งั้น reload/Back ถูก redirect ไป payment และไม่เห็น notice); กรณีอื่นของกฎข้อ 127 คงเดิม
    (f) (owner Q-P16 2026-11-24) ข้อความคืนเงินที่ลูกค้า**พร้อมเพย์**เห็น ไม่บอกว่า "เข้าบัญชีตามรอบของธนาคาร" แต่บอกว่าเริ่มคืนเงินแล้ว ผู้ให้บริการชำระเงินจะส่งอีเมล (อีเมลที่ใช้สั่งซื้อ) ให้กรอกบัญชีรับเงินคืน กรุณาตรวจอีเมล:
        `PROMPTPAY_REFUNDED_NOTICE`/`PROMPTPAY_PROMOTION_REFUNDED_NOTICE` (แทนข้อความของ PAY-11/15 — กฎข้อ 13/17) และ `PROMPTPAY_REFUNDED_UNKNOWN` (PAY-6c — กฎข้อ 8) ใน `promptpay-finish.ts`;
        บัตรคงข้อความเดิม (`REFUNDED_NOTICE`/`PROMOTION_REFUNDED_NOTICE`, FS-22/CORE-76); test ตรวจด้วย testid + regex ไทย ไม่ match ข้อความเต็ม
### Acceptance criteria (รอบ 42)
- ☑ AC-29 (PAY-16, กฎข้อ 18) unit Vitest + e2e route mock (แบบ AC-27): (a) บังคับ notice แล้วเลือก manual → notice หาย และคลิก "ลองอีกครั้ง" ไม่มีอีกแล้ว/ไม่สร้าง session ของบัตร (ล้มบน develop);
  (b) dblclick `payment-session-retry` → `POST .../payment-sessions` 1 ครั้ง; (c) route mock ให้ refresh ไม่มา → ภายใน 12 วินาทีเห็น notice ไม่เห็น skeleton; (d) ระหว่างรอ order radio มี `disabled`
- ☑ AC-30 (PAY-17, กฎข้อ 19) unit + e2e route mock: (a) `confirmPayment` คืน error `card_error`/`card_declined` ข้อความอังกฤษ → ข้อความที่มองเห็นเป็นอักษรไทย ไม่มีข้อความอังกฤษของ Stripe (ล้มบน develop);
  (b) unit ของตัวตัดสิน PromptPay: poll `refunded` ระหว่าง finishing → ไม่เปลี่ยน state; e2e AC-24/AC-28 ผ่าน และไม่เห็น `promptpay-retry-button` ระหว่างทาง (นับด้วย `MutationObserver`)
- ☑ AC-31 (PAY-18, กฎข้อ 20) unit ของ route (แบบ AC-25): `redirect_status=failed` + อ่าน cart 500 → location `step=payment`; 401/403/5xx → `setCartCookie` ไม่ถูกเรียก; หน้า checkout `cart_id` ≠ cart ของ cookie → ทางหา order;
  e2e: เปิด `/th/cart?error=refunded` แล้วแก้จำนวนสำเร็จ → `cart-error-notice` หายและ URL ไม่มี `error` (ล้มบน develop)
- ☑ AC-32 (PAY-19, กฎข้อ 21 — Q-P13 = ก, Q-P15/Q-P16) unit Vitest ของ `refundedWithoutSession`, ข้อความพร้อมเพย์/`REVIEW_REFUNDED_NOTICE` (ไทย, ตรวจอีเมล, ไม่อ้างรอบธนาคาร) และ `checkoutRedirectStep` (กฎข้อ 21e): ไม่มี session (`[]`/ไม่มี field) + คืนครบ → true; ยังมี session → false; `completed_at` → false;
  `refunded_amount < captured_amount` / `captured_amount = 0` (collection ใหม่) / ไม่มี collection → false;
  e2e (backend + Stripe test mode จริง — ไม่ใช่ route mock เพราะ cart อ่านฝั่ง server) `pay-19-promptpay-refunded-reload.spec.ts`: ลูกค้าอีเมลจาก secret `E2E_PROMPTPAY_REFUND_EMAIL` (Q-P15 — อีเมลของบัญชี Stripe test; ไม่ตั้ง = skip; ไม่ log อีเมล, ปิด trace, ซ่อนกล่องข้อมูลติดต่อใน screenshot) ชำระพร้อมเพย์ตอน QR แสดง (`paidWhileQrShown` กับสินค้า flash ของ test)
  แล้วใช้สิทธิ์ flash จาก cart อื่น → complete ของทางสำรองล้มจริงด้วย `FLASH_LIMIT_EXCEEDED` จน Medusa คืนเงิน (Store API: คืนครบ, session = `[]`) → หลัง `router.refresh()` เห็น `review-refunded-notice` + `review-refunded-go-to-cart`
  (ล้มบน develop — เห็นปุ่ม disabled "กรุณาเลือกวิธีชำระเงิน"); (a) `page.reload()` → ยังเห็นทั้งสองและไม่มี `submit-order-button`/`promptpay-retry-button`;
  (b) คลิก `review-refunded-go-to-cart` → `/th/cart` แล้ว `page.goBack()` → เหมือน (a); (c) ขั้น payment เลือกพร้อมเพย์ → ขั้น review เห็น `submit-order-button` ไม่เห็น `review-refunded-notice` และ cart มี payment collection id ใหม่ (Store API);
  regression: AC-24, AC-28 (route mock) และ `payments-promptpay-fallback-cap.spec.ts` (PAY-6c ยังเห็น `promptpay-retry-button`) ผ่าน
### Tasks (รอบ 42)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| PAY-16 | ☑ #541 — สถานะขั้น payment: notice reset หายเมื่อเปลี่ยนวิธี, guard ref, timeout refresh, radio disabled ระหว่างรอ order (กฎข้อ 18); qa | `modules/checkout/components/payment/index.tsx`, `lib/util/payment-session.ts` (+ test), e2e `pay-14-stale-session.spec.ts` | ~50 LOC + ~120 LOC test | AC-29 | PR เอกสารปิดรอบ 41; **CORE-89** ถ้า merge ก่อน (ไฟล์เดียวกัน — ตัวหลัง sync) | `payment/index.tsx` |
| PAY-17 | ☑ #540 — ข้อความไทยของ error Stripe ขั้น review + PromptPay poll ไม่ตัดสินระหว่าง finishing (กฎข้อ 19); qa | `modules/checkout/components/payment-button/index.tsx`, `promptpay-payment/index.tsx`, `lib/util/promptpay-finish.ts` (+ test), e2e | ~40 LOC + ~120 LOC test | AC-30 | PR เอกสารปิดรอบ 41; **CORE-90** (`promptpay-payment/index.tsx`) | `promptpay-payment/index.tsx`, `payment-button/index.tsx` (CORE-94 coverage test อ่านไฟล์นี้ — ไม่แก้) |
| PAY-18 | ☑ #532 — `/api/payment-return` + checkout `cart_id` + notice ของ cart หายหลังแก้ตะกร้า (กฎข้อ 20); qa | `app/api/payment-return/route.ts` (+ test), checkout page, `modules/cart/templates` / `cart-error-notice`, e2e | ~30 LOC + ~100 LOC test | AC-31 | PR เอกสารปิดรอบ 41 | checkout page (PAY-19 ถ้าต้องเพิ่ม field — ตัวหลัง sync) |
| PAY-19 | ☑ #548 — (Q-P12 = ข owner 2026-11-23; ขอบเขต Q-P13 = ก owner 2026-11-24) ขั้น review ไม่มี session + collection คืนเงินครบ → notice คืนเงิน + ลิงก์ตะกร้าแทนปุ่ม disabled (reload/Back/หลัง refresh) (กฎข้อ 21); qa | `modules/checkout/components/payment-button/index.tsx`, `refunded-go-to-cart` (ใหม่ — ใช้ร่วมกับ `promptpay-payment/index.tsx`), `lib/util/payment-session.ts` (+ test), e2e ใหม่ `pay-19-promptpay-refunded-reload.spec.ts` (+ `paidWhileQrShown` รับ variant ใน `e2e/support/promptpay-race.ts`) | ~40 LOC + ~180 LOC test | AC-32 | PR เอกสาร owner 2026-11-23 (Q-P12); **PAY-17**; **CORE-95 (#546)** (`payment-button/index.tsx`) | `payment-button/index.tsx` (CORE-95), `promptpay-payment/index.tsx` (PAY-17) |

ลำดับ: PAY-18 อิสระ; PAY-16 ∥ PAY-17 (คนละไฟล์) — PAY-16 sync หลัง CORE-89, PAY-17 หลัง CORE-90; PAY-19 หลัง PAY-17 (∥ PAY-16, PAY-18 — sync ถ้าแตะ checkout page)

### Open questions (รอบ 42)
- ~~**Q-P12**~~ **ตัดสินแล้ว (owner 2026-11-23) = (ข) ทำ** → PAY-19 (กฎข้อ 21, AC-32) — เก็บด้วยสถานะ payment collection ของ Medusa แทน `cart.metadata`/cookie
  ("ตะกร้าเปลี่ยน" = collection ถูกแทนตามกฎข้อ 21c) — คำถามเดิม: (review #484 — นอกกฎข้อ 17) หลัง `promptpay-refunded` ที่รู้เหตุ ถ้าลูกค้า **reload หรือกด Back จากตะกร้า** state "refunded" หายและหน้า checkout แสดงปุ่มจ่ายพร้อมเพย์ตามปกติบนตะกร้าเดิม (เหตุเดิมอาจยังอยู่ → จ่ายแล้วถูกคืนซ้ำ):
  (ก) **[Recommended]** ไม่ทำ — กรณีเกินสิทธิ์ FS-21/FS-23 ปิดปุ่มสั่งซื้อและเตือนในตะกร้า/review อยู่แล้ว เหลือเฉพาะ sold-out ที่เกิดใหม่ซึ่งหายาก และเงินถูกคืนอัตโนมัติเสมอ (ADR-015/compensation); ไม่มีงาน
  (ข) จำผล refunded ต่อ cart (เช่น `cart.metadata` หรือ cookie ที่มี cart id) แล้วแสดง notice + ซ่อนปุ่มจ่ายจนกว่าตะกร้าเปลี่ยน — ~80 LOC + e2e; ต้องกำหนดว่า "ตะกร้าเปลี่ยน" นับอะไร
- ~~**Q-P13**~~ **ตัดสินแล้ว (owner 2026-11-24) = (ก)** → กฎข้อ 21/AC-32 ฉบับนี้ — คำถามเดิม (builder PAY-19): Medusa สร้าง session ใหม่หลังคืนเงินไม่สำเร็จ (collection ไม่มี session)
  component พร้อมเพย์จึงไม่ render หลัง reload/refresh และการเลือกวิธีชำระที่ขั้น payment reset collection เสมอ — (ก) ตัดสินที่ `PaymentButton` ครอบขั้น review (ขั้น payment จ่ายใหม่ได้ตามเดิม);
  (ข) กันที่ขั้น payment ด้วย (ต้องเก็บสถานะ "แก้ตะกร้าแล้ว" เอง ขัด "ไม่เขียน metadata/cookie"); (ค) ปิด PAY-19 แก้เฉพาะ notice หายหลัง refresh
- ~~**Q-P14**~~ **ตัดสินแล้ว (owner 2026-11-24) = (ข)** พิสูจน์สาเหตุ D-1 ก่อนแล้วทำ PAY-19 ให้เสร็จใน v0.3.1 — ผล: Stripe ปฏิเสธ refund พร้อมเพย์เพราะส่งอีเมลขอบัญชีรับเงินคืนถึงอีเมลลูกค้าสุ่มไม่ได้ (บัญชี test) และ Medusa กลืน error
- ~~**Q-P15**~~ **ตัดสินแล้ว (owner 2026-11-24)** e2e ที่คืนเงินพร้อมเพย์จริงใช้อีเมลลูกค้าจาก GitHub secret `E2E_PROMPTPAY_REFUND_EMAIL` (= อีเมลบัญชี Stripe-Dev) ห้ามเขียนอีเมลจริงลงโค้ด/log/evidence
- ~~**Q-P16**~~ **ตัดสินแล้ว (owner 2026-11-24)** ข้อความคืนเงินของพร้อมเพย์บอกให้ตรวจอีเมลเพื่อกรอกบัญชีรับเงินคืน (กฎข้อ 21f) บัตรคงเดิม; การแจ้ง ops เมื่อคืนเงินล้ม/`refund.failed` = PAY-20 (ADR-029) ไม่อยู่ใน PAY-19

## Follow-up รอบ 42 — คืนเงินล้ม/ค้าง (ADR-029; owner Q-P17 = ทำใน v0.3.1, 2026-11-24)
Status: done (☑ PAY-20 #550, PAY-21 #551 — ปิดรอบ 42 2026-11-24; owner 2026-11-24: ADR-029 accepted ก+ข, Q-P19 = ก, Q-P20 = ไม่เปิด issue) · ที่มา: PAY-19 #548 (CI) — PromptPay ฿810 ตัดเงินแล้วไม่ถูกคืน มีแค่ log · กฎข้อ 21/AC-32 เป็นของ PAY-19 ไม่แตะ
Goal (owner): ระบบต้องรู้เมื่อการคืนเงินล้มหรือค้าง
Out of scope: แก้สถานะเงินใน Medusa อัตโนมัติ, refund ซ้ำอัตโนมัติ, แจ้งลูกค้าอัตโนมัติ, widget admin, แก้ข้อความหน้าร้าน (PAY-11/15/19), refund ที่ `requires_action` (รอลูกค้ากรอกบัญชี = ปกติ)
### What Medusa already gives us (คืนเงินล้ม/ค้าง)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| รู้ว่า refund ที่ provider ล้ม | `refundPaymentsStep` 2.22.1 **กลืน error** (log อย่างเดียว) — ผู้เรียก: `compensatePaymentIfNeededStep`, `cancelOrderWorkflow`, GB-21, script ADR-015; ไม่มี hook/event | ไม่มี → custom (กฎข้อ 22) |
| ร่องรอย refund ที่ล้ม/ค้าง | Payment module เก็บแถว `refund` `status=failed` แบบ soft-delete และ `pending` ระหว่างรอ provider (`RefundStatus`, `payment-module.js:439-470`); อ่านด้วย `listRefunds`/`query.graph` + withDeleted | ใช้ตามเดิม (อ่านอย่างเดียว) |
| ผล async ของ Stripe refund | `getWebhookActionAndData` ตรวจ signature แล้วคืน `not_supported` สำหรับ `refund.*` (ไม่มี `metadata.session_id`); core subscriber ข้าม | ขยาย: subscriber ของเราอ่าน body ที่ตรวจแล้ว (กฎข้อ 23, แบบ `payment-webhook-orphan.ts`) |
| scheduled job | `src/jobs` ของ Medusa (worker รันอยู่แล้ว) + `scheduledJobsDisabled` ของ OPS-15b | ใช้ตามเดิม |
| อีเมลถึง ops + กันส่งซ้ำ | Notification module (Resend) + `idempotency_key` (`notification-module-service.js:39-55`) | ใช้ตามเดิม |
| คืนเงินซ้ำเมื่อ ops ตัดสิน | `refund-orphan-payment.ts` (ADR-015), Refund ของ admin (`refundPaymentWorkflow` + guard PAY-8) | ใช้ตามเดิมใน runbook |
### Business rules (คืนเงินล้ม/ค้าง)
22. (PAY-20 — ADR-029 ก) job `src/jobs/refund-failure-scan.ts` (cron `*/15 * * * *`, ชื่อ `refund-failure-scan`, ข้ามเมื่อ `scheduledJobsDisabled()`) เรียกฟังก์ชันที่ export
    `scanRefundFailures(container, now = new Date())` (test เรียกตรง):
    (a) อ่านแถว `refund` ที่ `created_at ≥ now − 7 วัน` และ `status ∈ {failed, pending}` รวมแถวที่ soft-delete (`listRefunds` + `withDeleted` หรือ `query.graph` — builder ยืนยัน
        ว่าได้แถว failed จริง; ห้าม SQL ตรง) เรียงเก่าก่อน (**เปลี่ยนเป็นใหม่ก่อนใน PAY-23 — กฎข้อ 26c, Q-P23 = ก owner 2026-11-25**) ไม่เกิน 200 แถวต่อรอบ (เกิน → log warn `REFUND_SCAN_TRUNCATED`);
    (b) `failed` และ payment นั้นยังเหลือ `captured − refunded` > 0 (`MathBN` จาก `raw_amount`, นับเฉพาะ refund ที่ไม่ถูกลบ) → alert code `REFUND_FAILED`; เหลือ 0 (คืนสำเร็จภายหลัง) → ไม่ alert;
        `pending` ที่ไม่ถูกลบและ `updated_at ≤ now − 60 นาที` → alert code `REFUND_STUCK`;
    (c) alert ต่อแถว refund: idempotency key `refund-alert:<refund_id>` — มี notification ของ key นี้ที่ไม่ใช่ `failure` แล้ว → ข้าม (ไม่ log/ไม่ส่งซ้ำ); ไม่งั้น `logger.error`
        หนึ่งบรรทัดขึ้นต้นด้วย code พร้อม `refund_id`, `payment_id`, `amount`, `currency_code`, `provider_id`, `cart_id`/`order_id` (จาก `query.graph` ถ้าหาได้), `note`
        แล้วส่งอีเมล template `refund-failed` ถึง `OPS_ALERT_EMAIL` (`resource_type: "payment"`, `resource_id: payment_id`); ไม่ตั้ง env → log warn ข้ามการส่ง
        (log error ซ้ำทุกรอบจนพ้น 7 วัน — ยอมรับ, `checkBootEnv` เตือนตอนบูตอยู่แล้ว); ส่งล้ม → log error แล้วทำแถวถัดไป — job ไม่ throw;
    (d) helper `src/lib/ops-alert.ts` (`sendOpsAlert`: trim env, warn เมื่อไม่ตั้ง, catch การส่ง, ส่ง `idempotency_key`) ใช้ใน PAY-20 และ PAY-21 — ผู้ใช้เดิม 3 ที่ไม่ย้ายใน task นี้;
    (e) อ่านอย่างเดียว: ไม่สร้าง/แก้ refund/payment/order, ไม่ import `stripe`;
    (f) runbook ใหม่ใน `docs/ops/production.md` หัวข้อ **"คืนเงินล้ม/ค้าง (ADR-029)"**: `REFUND_FAILED` → ดูยอดคงเหลือใน `GET /admin/payments/:id` + log `Error was thrown trying to cancel payment`
        ของ payment นั้น → collection ไม่ผูก order ใช้ `refund-orphan-payment.ts`, ผูก order ใช้ Refund ใน admin; Stripe ปฏิเสธซ้ำ (เช่นพร้อมเพย์ส่งอีเมลขอบัญชีไม่ได้) → คืนนอก Stripe
        แล้ว note ใน order + บันทึก incident; `REFUND_STUCK` → **ตรวจ refund ของ PI ใน Stripe Dashboard ก่อน**คืนซ้ำ (กันคืนสองครั้ง); order ที่ยกเลิกแล้ว refund ล้ม → ยอด refund ใน order
        ไม่ตรงเงินจริง (Medusa เพิ่ม order transaction แม้ refund ล้ม) ให้ note ไว้
23. (PAY-21 — ADR-029 ข) subscriber `src/subscribers/stripe-refund-webhook.ts` บน `PaymentWebhookEvents.WebhookReceived` (subscriberId `stripe-refund-webhook`):
    (a) ทำงานเฉพาะ `provider` ขึ้นต้นด้วย `stripe` และ `type` ของ body ∈ {`refund.failed`, `refund.updated`} — อื่นๆ return ทันทีโดยไม่เรียก provider; แปลง `rawData` แบบ Buffer เหมือน `payment-webhook-orphan.ts`;
    (b) เรียก `paymentModule.getWebhookActionAndData(input)` เพื่อตรวจ signature เท่านั้น — throw → log warn `stripe-refund-webhook: skipped` แล้ว return (ไม่ alert);
    (c) `refund.failed` หรือ `refund.updated` ที่ `data.object.status ∈ {failed, canceled}` → `sendOpsAlert` code `STRIPE_REFUND_FAILED` key `stripe-refund-failed:<refund id>` (event ซ้ำ/ทั้งสอง type ของ refund
        เดียวกัน = อีเมลเดียว) data: `refund_id`, `payment_intent`, `amount` (หน่วยหลักตามทศนิยมของสกุลเงิน ด้วย `MathBN`), `currency`, `status`, `failure_reason`; สถานะอื่น → ไม่ทำอะไร;
    (d) ไม่ throw, ไม่เขียน DB, ไม่ import `stripe`;
    (e) เพิ่ม `refund.updated`, `refund.failed` ใน `docs/ops/production.md` "Stripe webhooks" (ระบุว่า Medusa คืน `not_supported` และ subscriber ของเราจัดการ) และ `events=` ของ `stripe listen`
        ใน `.github/workflows/ci.yml` (OPS-10 ตรวจว่าเซตตรงกัน); runbook ข้อ 22f เพิ่ม `STRIPE_REFUND_FAILED` (Medusa ยังแสดง refunded แต่เงินกลับเข้า balance ของ Stripe → ติดต่อลูกค้า คืนใหม่
        ใน Stripe Dashboard หรือนอก Stripe, note ใน order, incident); Go-live checklist ข้อใหม่: endpoint live สมัคร `refund.updated`/`refund.failed` และทดสอบใน test mode ด้วยบัตร
        `4000 0000 0000 5126` (refund แล้วล้มภายหลัง) ว่าอีเมลถึง `OPS_ALERT_EMAIL`
24. ข้อความหน้าร้าน "คืนเงิน" ของ PAY-11/15/19 = ระบบเริ่มคืนเงิน ไม่ใช่เงินถึงแล้ว — ไม่แก้ในรอบนี้ (ADR-029 "ผลที่ตามมา")
### Acceptance criteria (คืนเงินล้ม/ค้าง)
- ☑ AC-33 (PAY-20, กฎข้อ 22) integration (mock payment provider ที่ `refundPayment` throw ได้, `OPS_ALERT_EMAIL=ops@x.test`, mock notification provider):
  (a) payment captured บน collection ของ cart ที่ไม่มี order → `refundPaymentsWorkflow` ขณะ provider throw → workflow ไม่ throw และ result ไม่มี payment นั้น (ยืนยันพฤติกรรม 2.22.1 — ล้มเมื่อ bump เปลี่ยน);
      `scanRefundFailures` → notification 1 รายการ `to="ops@x.test"` template `refund-failed` ที่ data มี `payment_id` + `amount` และ log error ขึ้นต้น `REFUND_FAILED`; รันซ้ำ → ยัง 1 รายการและไม่มี log error เพิ่ม;
  (b) refund ล้มแล้วคืนสำเร็จภายหลัง (provider กลับมาปกติ) ก่อน scan → 0 notification;
  (c) แถว `pending` (builder สร้างด้วยวิธีที่มีจริง) + `now` = +61 นาที → `REFUND_STUCK` 1 รายการ; `now` = +30 นาที → 0; แถว failed ที่ `created_at` เก่ากว่า 7 วันจาก `now` → 0;
  (d) ไม่ตั้ง env → 0 notification + log warn; notification provider throw กับแถวแรกของสองแถว → job ไม่ throw, log error, แถวที่สองยังถูกส่ง; ไม่มี refund/payment/order ใหม่ทุกกรณี;
  (e) unit: ตัวจัดประเภทแบบ pure (แถว refund + ยอด → alert) ครบกรณีกฎข้อ 22b; static: source ของ job/helper ไม่ import `stripe`;
  (f) unit อ่าน `docs/ops/production.md`: มีหัวข้อ "คืนเงินล้ม/ค้าง (ADR-029)" ที่มีคำ `REFUND_FAILED`, `REFUND_STUCK`, `refund-orphan-payment`, "ตรวจ refund ของ PI ใน Stripe Dashboard ก่อน"
- ☑ AC-34 (PAY-21, กฎข้อ 23) integration http (payload ลงนามแบบ `payment-webhook-orphan.spec.ts` → `POST /hooks/payment/stripe_stripe`):
  (a) `refund.failed` ของ `re_x` (PI `pi_x`, 81000 THB satang) → notification 1 รายการ key `stripe-refund-failed:re_x` data `amount` = 810, `payment_intent` = `pi_x`, มี `failure_reason`
      + log error ขึ้นต้น `STRIPE_REFUND_FAILED`; ส่งซ้ำ + `refund.updated` status `failed` ของ `re_x` → ยัง 1 รายการ;
  (b) `refund.updated` status `canceled` ของ `re_y` → 1 รายการ; status `requires_action`/`pending`/`succeeded` → 0;
  (c) signature ผิด → 0 notification + log warn; `payment_intent.succeeded` ปกติ → subscriber นี้ไม่เรียก notification; ไม่มี payment/refund/order ใหม่ทุกกรณี;
  (d) static: `tools/ci/check-stripe-events.sh` ผ่าน (เซต event ใน doc = `ci.yml` รวม `refund.updated`, `refund.failed`); source ของ subscriber ไม่ import `stripe`;
      unit อ่าน `production.md`: runbook มี `STRIPE_REFUND_FAILED` และ checklist มี `4000 0000 0000 5126`
### Test plan (คืนเงินล้ม/ค้าง)
| ระดับ | AC |
|---|---|
| unit (classifier, static import, runbook/checklist grep) | AC-33e–f, AC-34d |
| integration modules/http (mock provider + mock notification) | AC-33a–d, AC-34a–c |
| CI static (`check-stripe-events.sh` ใน `lint-typecheck`) | AC-34d |
### Tasks (คืนเงินล้ม/ค้าง)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| PAY-20 | ☑ #550 — (เงิน — ADR-029 ก) job ตรวจ refund ที่ล้ม/ค้าง + helper `sendOpsAlert` + template `refund-failed` + runbook (กฎข้อ 22) | `apps/backend/src/jobs/refund-failure-scan.ts` (ใหม่), `src/lib/ops-alert.ts` (ใหม่ + unit), `src/lib/refund-alerts.ts` (classifier + unit), `src/modules/resend/templates.ts` (+ test), `docs/ops/production.md`, `src/__tests__/ops-runbook.unit.spec.ts`, `integration-tests/http/refund-failure-scan.spec.ts` (ใหม่) | ~150 LOC + ~250 LOC test | AC-33 | PR เอกสารนี้ (ADR-029 accepted ☑) | `templates.ts`, `production.md` (PAY-21 — ตัวหลัง) |
| PAY-21 | ☑ #551 — (เงิน — ADR-029 ข) subscriber `refund.failed`/`refund.updated` + event ใน Stripe webhooks/`ci.yml` + runbook/checklist (กฎข้อ 23) | `apps/backend/src/subscribers/stripe-refund-webhook.ts` (ใหม่), `docs/ops/production.md`, `.github/workflows/ci.yml` (`events=`), `src/__tests__/ops-runbook.unit.spec.ts`, `integration-tests/http/stripe-refund-webhook.spec.ts` (ใหม่) | ~80 LOC + ~200 LOC test | AC-34 | **PAY-20** (helper + template + หัวข้อ runbook) | `ci.yml` (PAY-19 #548 ถ้าแก้ — ตัวหลัง sync) |

ลำดับ: PAY-20 ∥ PAY-19 (คนละ app) → PAY-21
### Open questions (คืนเงินล้ม/ค้าง)
- ~~**Q-P17**~~ **ตัดสินแล้ว (owner 2026-11-24) = ทำใน v0.3.1** → ADR-029 + PAY-20/21 — คำถามเดิม: แจ้ง ops เมื่อคืนเงินล้ม + รับ `refund.updated`/`refund.failed` ทำใน release นี้หรือหลัง go-live
- ~~**Q-P18**~~ **ตัดสินแล้ว (owner 2026-11-24) = (ก+ข)** ADR-029 accepted → PAY-20 + PAY-21 — คำถามเดิม: อนุมัติ ADR-029 ทางเลือกใด:
  (ก+ข) **[Recommended]** job ตรวจแถว refund ของ Medusa (ล้มทันที/ค้าง) + webhook `refund.failed`/`refund.updated` (ล้มภายหลัง) — ครอบทั้งสองช่อง ไม่มี infra ใหม่ ~230 LOC + test (PAY-20, PAY-21);
  (ก) job อย่างเดียว — ไม่รู้เมื่อพร้อมเพย์/บัตรล้มหลัง Stripe รับ refund แล้ว; (ข) webhook อย่างเดียว — ไม่รู้กรณีที่เกิดจริงใน #548 (Stripe ปฏิเสธตั้งแต่สร้าง refund)
- ~~**Q-P19**~~ **ตัดสินแล้ว (owner 2026-11-24) = (ก)** ops จัดการตาม runbook ไม่แก้ยอดอัตโนมัติใน v0.3.1 — คำถามเดิม: refund ที่ Stripe แจ้งล้มภายหลัง (ข): ข้อมูลใน Medusa ยังนับว่าคืนแล้ว — (ก) **[Recommended]** ไม่แก้ใน v0.3.1: ops note ใน order + incident ตาม runbook (Medusa 2.22.1 ไม่มี API
  เปลี่ยน refund ที่สำเร็จเป็นล้ม); (ข) เปิด task ปรับยอดหลัง go-live (ต้อง ADR ใหม่ — แตะข้อมูลของ Payment module)
- ~~**Q-P20**~~ **ตัดสินแล้ว (owner 2026-11-24) = ไม่เปิด issue upstream** — บันทึกไว้ใน ADR-029 อย่างเดียว (PAY-20 ไม่ต้องร่าง issue) — คำถามเดิม: เปิด issue ที่ Medusa เรื่อง `refundPaymentsStep` กลืน error ของ provider และ `refundPaymentsWorkflow` เพิ่ม order transaction ของ refund ที่ล้ม

## Follow-up รอบ 43 (เสนอ — ปิดรอบ 42 2026-11-24; ☐ รอ owner สั่งทำ)
Status: accepted สำหรับ PAY-23, PAY-24 (owner สั่งทำก่อน go-live — Q-R43-ฉ = ก (owner 2026-11-25) แก้เพิ่ม: 3 task รวมใน v0.3.1) · PAY-22, PAY-25 draft (☐ หลัง go-live — รอ owner สั่ง) · ที่มา: review/qa/builder #532, #540, #541, #546, #548, #550, #551 ที่ยังเป็นจริงบน develop `599009b6`
Out of scope: จำเหตุของการคืนเงินข้าม reload (Q-P22 = คงไว้), สกุลเงินอื่นนอก THB (PAY-21 ใช้ `decimal_digits` ของ ISO — ตัวคูณของ Stripe ต่างใน ISK/HUF; ทบทวนเมื่อเปิดสกุลเงินอื่น)
### What Medusa already gives us (รอบ 43)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| redirect หลัง Stripe | route `/api/payment-return` ของ starter (ขยายใน PAY-12/18) | ใช้ตามเดิม (กฎข้อ 25) |
| อีเมลถึง ops + กันส่งซ้ำ | Notification module + `idempotency_key`; helper `sendOpsAlert` ของเรา (PAY-20 — soft-delete แถว `failure` ก่อนส่งใหม่ เพราะ 2.22.1 ส่งซ้ำแถว failure ไม่ได้) | ย้ายผู้ใช้เดิมมาใช้ helper (กฎข้อ 27) |
| error ของ Stripe.js | `confirmPayment`/`confirmPromptPayPayment` คืน `error` (`type`/`code`) | map ด้วย `stripeErrorMessage` เดิมของ PAY-17 (กฎข้อ 28) |
### Business rules (รอบ 43)
25. (PAY-22 — re-review/qa #532, CORE-95 #546; ข้อ c ตาม Q-P21 = ก owner 2026-11-25) `/api/payment-return` (`app/api/payment-return/route.ts`):
    (a) เทียบ `redirect_status` แบบไม่สนตัวพิมพ์ (`FAILED` = `failed`);
    (b) อ่าน cart ได้ 401/403 และ `redirect_status=failed` → หน้า login ที่ `return_to` = `/<cc>/checkout?step=payment` (เดิมกลับ `step=review`);
    (c) 401/403 และ `redirect_status=succeeded` → `/<cc>/account?notice=payment_received` ผ่าน helper ของ CORE-95 (`lib/util/login-notice.ts`) แล้ว login ไป `/<cc>/account/orders` (spec 01 กฎข้อ 151c); สถานะอื่นคงเดิม
26. (PAY-23 — review #550, #551; ข้อ c ตาม Q-P23 = ก owner 2026-11-25 — แทนคำว่า "เรียงเก่าก่อน" ของกฎข้อ 22a) alert ของการคืนเงิน:
    (a) `stripe-refund-webhook` ส่ง `source: "stripe"` ใน data ของ template `refund-failed` (ADR-029; job ของ PAY-20 ส่ง `"medusa"`);
    (b) log error เมื่อ lock/ส่งล้มใน subscriber ไม่ขึ้นต้นด้วย `STRIPE_REFUND_FAILED` (code สงวนให้ alert จริง) — ขึ้นต้น `stripe-refund-webhook: alert failed`;
    (c) กฎข้อ 22a เรียง**ใหม่ก่อน** (`created_at` DESC) คงเพดาน 200 และ warn `REFUND_SCAN_TRUNCATED`; แก้ประโยคใน runbook "คืนเงินล้ม/ค้าง (ADR-029)" ให้ตรง;
    (d) test ผูก `order_id` ของ alert `REFUND_FAILED` กับ order จริง (refund ล้มของ order ที่ยกเลิก)
27. (PAY-24 — กฎข้อ 22d) ผู้ส่งอีเมลหา `OPS_ALERT_EMAIL` เดิม 3 ที่ใช้ `sendOpsAlert`: `subscribers/payment-webhook-orphan.ts` (key ใหม่ `payment-webhook-session-not-found:<payment_intent>` — Stripe ส่ง event ซ้ำ = อีเมลเดียว),
    `subscribers/group-buy-payment-captured.ts` และ `workflows/group-buy/membership-payment.ts` (alert give-up) คง key เดิม; code/template/ผู้รับ/ข้อมูลเท่าเดิม; log ขึ้นต้นด้วย code เดิม;
    ส่งล้มแล้วส่งใหม่ได้อีเมลเดียว (ได้จากการ soft-delete แถว failure ของ helper)
28. (PAY-25 — PAY-17 #540, review #540) error ของ Stripe ที่ `promptpay-payment/open-qr.ts` (~`:31`) และ `order/components/order-pay/pay-buttons.tsx` (~`:35`) ใช้ `stripeErrorMessage` (ไม่แสดง `error.message` ภาษาอังกฤษของ Stripe ตรง)
### Acceptance criteria (รอบ 43)
- AC-35 (PAY-22, กฎข้อ 25) unit ของ route (แบบ AC-31): ทุกคู่ {401, 403} × {`failed`, `FAILED`, `succeeded`, ไม่มีค่า} → location ตามกฎ (ล้มบน develop — `failed` + 401 ได้ `step=review`, `FAILED` + 5xx ได้ `step=review`);
  ทุกแขนง 401/403 ไม่เรียก `setCartCookie`; `succeeded` + 401 → `?notice=payment_received` และ login ไป `/th/account/orders` (unit ของ helper CORE-95)
- AC-36 (PAY-23, กฎข้อ 26) integration `stripe-refund-webhook.spec.ts`: data ของ notification มี `source: "stripe"` (ล้มบน develop); mock locking throw → ไม่มี log บรรทัดใดขึ้นต้น `STRIPE_REFUND_FAILED`;
  `refund-failure-scan.spec.ts`: refund ล้มของ order ที่ยกเลิก → data `order_id` = id ของ order; แถวที่ใหม่ที่สุดในชุด 201 แถวถูกตรวจ และ unit runbook ตรงประโยคใหม่
- ☑ AC-37 (PAY-24, กฎข้อ 27) static: สามไฟล์ไม่มี `process.env.OPS_ALERT_EMAIL`/`createNotifications` ตรง (ใช้ `sendOpsAlert`); test เดิมของ PAY-6b, GB-20b, GB-23 ผ่านโดยไม่แก้ค่าที่คาด;
  webhook orphan ของ PI เดียวกันมา 2 ครั้ง → notification 1 รายการ; mock notification provider ล้มครั้งแรกแล้วสำเร็จ → แถวที่ไม่ใช่ failure = 1 และรอบที่สามไม่ส่งเพิ่ม
- AC-38 (PAY-25, กฎข้อ 28) unit Vitest: `openQr` เมื่อ Stripe คืน error ภาษาอังกฤษ → message เป็นอักษรไทย (ล้มบน develop); `PayButtons` (route mock แบบ AC-30) error `card_declined` → ข้อความที่มองเห็นเป็นไทย ไม่มีข้อความของ Stripe
### Test plan (รอบ 43)
| ระดับ | AC |
|---|---|
| unit Vitest (route, helper, component) | AC-35, AC-38 |
| integration http/modules + unit/static | AC-36, AC-37 |
### Tasks (รอบ 43)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| PAY-22 | (หลัง go-live) `/api/payment-return`: ตัวพิมพ์ของ `redirect_status`, failed + 401 → `step=payment`, notice `payment_received` เมื่อ `succeeded` (กฎข้อ 25) | `app/api/payment-return/route.ts` (+ test), `lib/util/login-notice.ts` | ~20 LOC + ~80 LOC test | AC-35 | PR เอกสารปิดรอบ 42 (Q-P21 = ก ☑) | — |
| PAY-23 | (v0.3.1 ก่อน go-live; เงิน) alert คืนเงิน: `source`, prefix ของ log, เรียงใหม่ก่อน, test `order_id` (กฎข้อ 26) | `src/subscribers/stripe-refund-webhook.ts`, `src/jobs/refund-failure-scan.ts`, `docs/ops/production.md`, test | ~15 LOC + ~80 LOC test | AC-36 | PR เอกสารปิดรอบ 42 (Q-P23 = ก ☑) | `production.md` (OPS-37 — ตัวหลัง sync) |
| PAY-24 | (v0.3.1 ก่อน go-live; เงิน) ย้ายผู้ส่ง `OPS_ALERT_EMAIL` 3 ที่มาใช้ `sendOpsAlert` (กฎข้อ 27) | ไฟล์ในกฎข้อ 27, test | ~−30 LOC + ~80 LOC test | AC-37 | PR เอกสารปิดรอบ 42 | `membership-payment.ts` (GB-33 แตะเฉพาะ test — ไม่ชน) |
| PAY-25 | (หลัง go-live) ข้อความไทยของ error Stripe ตอนเปิด QR และหน้าจ่าย order (กฎข้อ 28); qa | ไฟล์ในกฎข้อ 28 (+ test) | ~10 LOC + ~60 LOC test | AC-38 | PR เอกสารปิดรอบ 42 | — |

ลำดับ: ทั้งสี่ตัวขนานกันได้ (∥) — v0.3.1 ก่อน go-live: PAY-23 ∥ PAY-24 (owner สั่งแล้ว 2026-11-25); PAY-22, PAY-25 หลัง go-live (☐ รอ owner สั่ง)
### Open questions (รอบ 43)
- ~~**Q-P21**~~ **ตัดสินแล้ว (owner 2026-11-25) = (ก)** notice `payment_received` เฉพาะ `redirect_status=succeeded` → PAY-22 กฎข้อ 25c — คำถามเดิม: (CORE-95 #546) กลับจาก Stripe redirect (`/api/payment-return`) แล้ว session หมด (401/403) ลูกค้าเห็นหน้า login เปล่า ไม่มี notice "ได้รับชำระเงินแล้ว" แบบ CORE-95:
  (ก) **[Recommended]** เพิ่มใน PAY-22 เฉพาะ `redirect_status=succeeded` (กฎข้อ 25c) — ทางเดียวกับปุ่มบัตรของ CORE-95 ~10 LOC ใช้ helper เดิม; ข้อความไม่สัญญาว่ามี order (order มาจาก webhook ตาม ADR-015);
  (ข) ไม่เพิ่ม — redirect เกิดเฉพาะบัตร 3DS/พร้อมเพย์บนมือถือ และ session หมดระหว่างนั้นหายาก; PAY-22 ทำแค่ (a)(b)
- ~~**Q-P22**~~ **ตัดสินแล้ว (owner 2026-11-25) = (ก) คงไว้** ไม่จำเหตุเฉพาะหลัง refresh ไม่มี task — คำถามเดิม: (PAY-19 #548, review #548) หลัง reload ข้อความคืนเงินเฉพาะเหตุ (เช่นโปรโมชันใช้ไม่ได้ของ CORE-76, สิทธิ์ flash) กลายเป็น `REVIEW_REFUNDED_NOTICE` ทั่วไป (กฎข้อ 21a — Store API ไม่บอกเหตุ):
  (ก) **[Recommended]** คงไว้ — ลูกค้ายังรู้ว่าคืนเงินแล้วและไปแก้ที่ตะกร้าได้ (ตะกร้าเตือนเหตุของ FS-21/CORE-76 อยู่แล้ว); ไม่เก็บสถานะใหม่ (ตรง Q-P13 = ก); ไม่มีงาน;
  (ข) จำเหตุต่อ cart (`cart.metadata` ฝั่ง backend ตอน compensation) แล้วแสดงข้อความเดิมหลัง reload — ~100 LOC + integration; ขัดหลัก "ไม่เขียน metadata" ของ Q-P13 จึงต้องมี ADR
- ~~**Q-P23**~~ **ตัดสินแล้ว (owner 2026-11-25) = (ก)** เรียงใหม่ก่อน → PAY-23 กฎข้อ 26c — คำถามเดิม: (review #550) job `refund-failure-scan` เรียงเก่าก่อน + เพดาน 200: ถ้ามีแถว failed/pending เกิน 200 ใน 7 วัน แถว**ใหม่**ไม่ถูกตรวจจนแถวเก่าพ้น 7 วัน (มีแค่ warn `REFUND_SCAN_TRUNCATED`):
  (ก) **[Recommended]** เรียงใหม่ก่อน (กฎข้อ 26c) — refund ที่ล้มใหม่ถูกแจ้งภายใน 15 นาทีเสมอ; ที่หลุดคือแถวเก่าซึ่งรอบก่อนแจ้งไปแล้ว; ~2 LOC + test; ถ้าล้มพร้อมกันเกิน 200 ใน 15 นาที แถวเก่าสุดของชุดนั้นเหลือแค่ warn (runbook ให้ตรวจมือ);
  (ข) อ่านทีละหน้าจนครบหน้าต่าง 7 วัน — ไม่หลุดเลย แต่เหตุการณ์ใหญ่ส่งอีเมลหลายร้อยฉบับในรอบเดียว ~20 LOC;
  (ค) คงเดิม — ยอมรับตามที่เขียนใน runbook แล้ว

## Open questions
- ~~Q10~~ **ตัดสินแล้ว (owner 2026-11-21) = อนุมัติ ADR-025 ทางเลือก 2** → PAY-9 เริ่มได้หลัง GB-20; คำถามเดิม (รอบ 40): อนุมัติ ADR-025 (reset payment collection ของ cart ที่ถูกคืนเงิน)
  หรือให้ storefront สร้าง cart ใหม่ (ไม่ครอบ client อื่น)
- Q1 ยืนยันว่าบัญชี Stripe เป็นนิติบุคคลไทยและเปิดใช้ PromptPay แล้ว (จำเป็นสำหรับ AC-4 ใน test mode)
  — (2026-11-09, รอบ 25) owner **ยังไม่ยืนยัน**: ใช้ Stripe test mode ต่อไป; การยืนยันนี้เป็นข้อ 6 ใน "Go-live checklist" ของ `docs/ops/production.md` (ต้องทำก่อนเปิดร้านจริง) — ไม่มี task
  — (ปิดรอบ 42, 2026-11-24) เพิ่ม Go-live ข้อ 16: บัญชี live ต้องยื่น account application ให้เสร็จ ไม่งั้น refund พร้อมเพย์ส่งอีเมลขอเลขบัญชีถึงลูกค้าไม่ได้ (Q-P14/Q-P15)
- ~~Q2~~ ตัดสินแล้ว (owner, 2026-10-25): production ห้าม `pp_system_default` แบบ D1 ของ ADR-010 (seed + `check:go-live`;
  ไม่กัน admin เปิดเอง) — กฎข้อ 6
- ~~Q3~~ ตัดสินแล้ว (owner, 2026-10-26): **คงเดิมใน v1** — เวลา 10 นาทีของ PromptPay นับจาก `created` ของ PaymentIntent
  (อ่านได้จาก PI เสมอแม้โหลดหน้าใหม่) ไม่เปลี่ยนเป็นนับจากตอนแสดง QR
- ~~Q4~~ ตัดสินแล้ว (ADR-015 accepted, owner 2026-10-26): guard อ่านสถานะผ่าน `paymentModule.authorizePaymentSession` เท่านั้น
  **ไม่มี fallback `paymentIntents.retrieve`** ไม่เรียก Stripe SDK ในโค้ดของเรา — กฎข้อ 7A
- ~~Q5~~ ตัดสินแล้ว (owner 2026-10-26): alert = `logger.error` `PAYMENT_WEBHOOK_SESSION_NOT_FOUND` + อีเมลหา `OPS_ALERT_EMAIL` ทันที
  (env แยกจาก `EVOUCHER_ADMIN_EMAIL` ตั้งค่าเดียวกันได้) — กฎข้อ 7D
- ~~Q6~~ (PAY-6 × PAY-3) payment collection ของ **order** (หน้า `/account/orders/:id/pay` ของ group buy) ไม่มี `cart_id` — ADR-015 กำหนด lock key = `cart_id`
  เท่านั้น ค่าเริ่มต้นที่เสนอ: collection ที่ไม่มี cart ใช้ key = `payment_collection_id` และ AC-12b (complete cart) ไม่ใช้กับหน้า order pay (poll ต่ออย่างเดียว)
  — **owner ยืนยัน 2026-10-26** (บันทึกเป็นภาคผนวกใน ADR-015)
- ~~Q7~~ ตัดสินแล้ว (owner 2026-10-26, ตัดสินใหม่หลัง review #104): payment captured ที่ collection ไม่ผูก order → refund ด้วย script ที่เรียก
  `refundPaymentsWorkflow` (ไม่ใช่ Stripe dashboard) หลังตรวจว่า Medusa ยังไม่ refund เอง — ADR-015 ภาคผนวก 2 (accepted), AC-16b, AC-16c
- Q8 (รอบ 12, review #157 — ยังไม่ต้องตัดสิน ไม่มี task) ถ้าวันหนึ่งเปิด **manual capture** (`capture: false` ของ Stripe provider): guard ที่แพ้ race (หมายเหตุรอบ 6/12)
  ทำให้ Medusa เรียก `cancelPayment` บน PI ที่ `requires_capture` ซึ่ง Stripe **ยกเลิกได้จริง** → payment ของฝั่งที่ชนะอ้าง PI ที่ถูกยกเลิก (capture ไม่ได้) — ต้องทบทวน guard/ADR-015
  ก่อนเปิด manual capture; ตอนนี้ใช้ automatic capture จึงไม่กระทบ
- Q9 (รอบ 12, review #184 — follow-up ไม่บังคับ) จะปรับ mock `cancelPayment` ใน test ของ PAY-3a ให้ throw เมื่อ PI `succeeded` (ตรงกับ Stripe จริง → ฝั่งที่แพ้ได้ 500)
  ในงานเล็กถัดไปที่แตะไฟล์นั้น หรือเปิด task แยก — ค่าเริ่มต้นที่เสนอ: รวมในงานถัดไปที่แตะ test นี้ ไม่เปิด task ใหม่ (พฤติกรรม storefront ไม่ขึ้นกับ code นี้แล้วตามกฎข้อ 9 d2)
