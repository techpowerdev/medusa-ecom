# 06 Payments — บัตรผ่าน Stripe + PromptPay ไทย

สถานะ: draft
เป้าหมาย (เจ้าของ): รับชำระด้วยบัตรเครดิต/เดบิตและ PromptPay ผ่าน Stripe
การตัดสินใจ: ใช้ Stripe provider ที่มีมากับ Medusa, capture อัตโนมัติ (ADR-007) **ไม่มี custom payment code**
ข้อยกเว้นที่ owner ยอมรับ: ADR-015 (accepted 2026-10-26) — guard + alert สำหรับ race QR หมดอายุ × จ่ายสำเร็จ (กฎข้อ 7, PAY-6)
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
- Webhooks (สอง endpoint) ลงทะเบียนใน Stripe dashboard; events: `payment_intent.*`

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
- AC-10 ใน CI job `storefront-e2e` webhook ของ Stripe CLI ถึงทั้ง `/hooks/payment/stripe_stripe` และ
  `/hooks/payment/stripe-promptpay_stripe` (Stripe CLI รับ `--forward-to` ได้ปลายทางเดียวต่อ process — ใช้ listener แยกต่อ endpoint
  หรือวิธีที่ตรวจกับ docs แล้ว) วัดผลด้วย: AC-1 และ AC-4 ผ่านใน CI และ log ของ backend มี request เข้าทั้งสอง path
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

## Test plan
- Integration (http): AC-8 โดย mock provider
- e2e: AC-1..AC-7 กับ Stripe test mode; CI รัน `stripe listen --forward-to` เพื่อให้
  webhook จริงส่งถึง runner; จำลอง PromptPay สำเร็จด้วยการ confirm PaymentIntent ใน test mode
- e2e: AC-9 (อ่าน PaymentIntent จาก Stripe test mode ระหว่าง AC-1/AC-4); CI: AC-10
- integration/e2e กับ Stripe test mode: AC-11; e2e: AC-12, AC-12b (ส่วน storefront); integration: AC-12b (complete cart หลัง guard)
- unit: guard (AC-13 a–g ด้วย mock payment module), การตรวจ runbook/env (AC-16, AC-16b); integration http: AC-13; integration: AC-14, AC-15, AC-16c
- e2e + unit (Vitest): AC-17 (PAY-6c)
- integration (http/modules): AC-18 (PAY-3a); e2e กับ Stripe test mode: AC-7, AC-19 (PAY-3b) — กรณี 409/400/500/401 ของ AC-19 ใช้ route mock; unit Vitest: predicate "มีการชำระแล้ว" (AC-19)

## Tasks
| ID | Task | Depends |
|----|------|---------|
| PAY-1 | ตั้งค่า Stripe provider, เปิดใช้ใน region, env, ตรวจสอบ webhook route ในเครื่องด้วย Stripe CLI (AC-8) | CORE-2 |
| PAY-2 | Storefront: ขั้นตอนชำระเงินด้วยบัตร + PromptPay, polling, error + e2e (AC-1..AC-5); `payment_method_types: ["card"]` ของ session บัตร (กฎข้อ 5, AC-9); แก้ขั้น `stripe listen` ใน `ci.yml` ที่ใส่ `--forward-to` ซ้ำ (AC-10) | PAY-1, CORE-5 |
| PAY-3 | **แยกรอบ 10** (builder หยุด: Store API อ่าน draft order ไม่ได้) → PAY-3a + PAY-3b ด้านล่าง; route อ่านข้อมูลเป็น GB-8 (spec 04, ADR-016) | — |
| PAY-3a | (เล็ก, backend test-only) integration: ownership ของ `POST /store/payment-collections/:id/payment-sessions` บน collection ของ draft order + guard × webhook พร้อมกันบน collection ของ order ตามภาคผนวก ADR-015 (กฎข้อ 9c, AC-18) — ไม่แก้โค้ด production ถ้า test ผ่าน — ☑ #157 | PAY-6a ☑, GB-4 ☑ |
| PAY-3b | storefront หน้า `/account/orders/:id/pay` ตามกฎข้อ 9 (อ่านจาก GB-8, component บัตร/พร้อมเพย์เดิม, 409 `PAYMENT_ALREADY_COMPLETED` → poll GB-8 อย่างเดียวมีเพดาน, non-2xx อื่นยกเว้น 401 → ตรวจสถานะ GB-8 1 ครั้งด้วย predicate "มีการชำระแล้ว" ตามกฎข้อ 9 d2; ไม่แก้ GB-8) + e2e (AC-7, AC-19) | GB-8 ☑ #145, PAY-3a ☑ #157, PAY-6c ☑ #136 (ใช้ตัวนับเพดานของ PAY-6c ไม่เขียนซ้ำ) — **เริ่มได้หลัง PR spec รอบ 12 (`docs/PAY-3b-spec-race-400`) merge** |
| PAY-4 | Refund e2e + screenshot หน้า admin (AC-6) | PAY-2 |
| PAY-5 | follow-up review PR #48 (เล็ก): race ระหว่าง QR หมดอายุกับการชำระสำเร็จ — test AC-11 ก่อนเพื่อยืนยันพฤติกรรมของ Medusa/Stripe provider เมื่อลบ session ที่ PI `succeeded` แล้ว; ถ้าเป็นกรณี (a) ของกฎข้อ 7 แก้เฉพาะ storefront ให้ poll ต่อเมื่อสร้าง session ใหม่ล้ม (AC-12); ถ้าเป็นกรณี (b) หยุดแล้วเขียน ADR (ไม่เขียน reconciliation เอง) | PAY-2 |
| PAY-6a | (◐ #82, แยกรอบ 6) ADR-015 A ฝั่ง backend: guard บน `POST /store/payment-collections/:id/payment-sessions` ตามกฎข้อ 7A (`authorizePaymentSession` เท่านั้น ไม่เรียก Stripe ตรง, lock `cart_id`/`payment_collection_id`, 409 `PAYMENT_ALREADY_COMPLETED` ผ่าน PROMO-2) + guard หลัง ownership ของ CORE-12 + เปิด test AC-11 จาก `test.fixme` + integration complete cart idempotent (AC-11, AC-13 a–g, AC-14, AC-12b ส่วน backend = integration complete cart หลัง guard) + integration race ตาม "หมายเหตุ (รอบ 6)" ด้านล่าง — **ไม่รวม** storefront (AC-12 และ AC-12b ส่วน storefront อยู่ใน PAY-6b) | PAY-5 (#65), PROMO-2 |
| PAY-6b | (แยกรอบ 6) storefront: poll ต่อเมื่อได้ `PAYMENT_ALREADY_COMPLETED` และเรียก complete cart เป็นทางสำรอง (AC-12, AC-12b ส่วน storefront) + ADR-015 D: subscriber `src/subscribers/payment-webhook-orphan.ts` (`PAYMENT_WEBHOOK_SESSION_NOT_FOUND` + อีเมล `OPS_ALERT_EMAIL`) + `OPS_ALERT_EMAIL` ใน `.env.example` + runbook ใน `docs/ops/production.md` (กฎข้อ 7D; หัวข้อ fail closed ต้องใช้วิธีที่ตรวจแล้วว่ามีจริง — ดู "ความเสี่ยงที่ยอมรับเพิ่ม" รอบ 7) (AC-15, AC-16) — ถ้าเกิน ~400 LOC แยก storefront (6b1) กับ alert + runbook (6b2) ทำขนานกันได้; **รอบ 8**: PAY-6b2 (#97) รวม AC-16b (runbook ใหม่) และ script `apps/backend/src/scripts/refund-orphan-payment.ts` + integration test (AC-16c) — ☑ #97 (6b2), #98 (6b1) | PAY-6a |
| PAY-6c | (storefront เล็ก, รอบ 9, review #98) เพดานการลองซ้ำของทางสำรอง + UI กรณีเงินถูกคืนโดย `compensatePaymentIfNeededStep` (กฎข้อ 8, AC-17) — ข้อความไทยตรงในโค้ด | PAY-6b ☑ (#97/#98), CORE-4e (spec 01 — แตะ `promptpay-payment`/`renewPromptPaySession` เดียวกัน; CORE-4e ← CORE-4d #109) |
PAY-3 ∥ PAY-4 ∥ PAY-5 หลัง PAY-2 (PAY-5 แตะ `promptpay-payment` เดียวกับที่ PAY-3 นำไปใช้ซ้ำ — merge PAY-5 ก่อน PAY-3 ถ้าทำพร้อมกัน ให้ rebase)
(รอบ 10) PAY-3a เริ่มได้ทันที (∥ GB-8, PAY-6c); PAY-3b หลัง GB-8 + PAY-3a + PAY-6c; GB-5 (spec 04) พึ่ง PAY-3a ไม่ใช่ PAY-3b
(รอบ 11) สถานะ: PAY-6c ☑ #136, GB-8 ☑ #145 → PAY-3b เหลือรอ PAY-3a; ข้อสังเกตจาก review/qa #136
(เพดานนับต่อการ mount ไม่ใช่ต่อ cart — reload ได้อีกชุด, refund แล้วสร้าง session ใหม่ไม่สำเร็จได้เพดานใหม่เมื่อเริ่มใหม่, unit จำลอง loop เอง, สัญญาณคืนเงินยังไม่มี integration
ผ่าน Store API จริง) — **ยอมรับใน v1** เพราะเพดานมีไว้กันลูปไม่รู้จบในหน้าเดียว (แต่ละครั้งเป็น request complete ที่ idempotent) ไม่มี task; ถ้า PAY-3b ใช้ตัวนับเดิมให้คงพฤติกรรมนี้
(รอบ 12, review #157) สถานะ: PAY-3a ☑ #157 → dependency ของ PAY-3b ครบ (GB-8 ☑ #145, PAY-3a ☑ #157, PAY-6c ☑ #136); PAY-3b เริ่มได้หลัง PR spec นี้ merge (กฎข้อ 9 d2, AC-19 ที่ปรับ)
(รอบ 12 planner, 2026-10-28) สถานะ: #184 (spec PAY-3b) ☑, PAY-3b ◐ (builder) — planner ไม่แก้กฎข้อ 9 ระหว่าง task ทำงาน; nit review #184 (เงื่อนไขหยุด poll ของข้อ d/d2 = `payment_status=captured`
หรือ collection `completed` ไม่ใช่เมื่อ predicate "มีการชำระแล้ว" จริงครั้งแรก — กรณี session `authorized` + `not_paid` ของ AC-19) ส่งให้ builder PAY-3b ผ่าน session หลัก; reviewer ของ PAY-3b ตรวจข้อนี้
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

## Open questions
- Q1 ยืนยันว่าบัญชี Stripe เป็นนิติบุคคลไทยและเปิดใช้ PromptPay แล้ว (จำเป็นสำหรับ AC-4 ใน test mode)
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
