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
| Checkout ด้วย Stripe Elements ใน storefront | Next.js starter | ขยายเพื่อรองรับ PromptPay + หน้าชำระเงินของ order |
| Admin: เปิดใช้ provider ต่อ region, refund | Admin | ตั้งค่า |
| ยกเลิก PaymentIntent เดิมเมื่อเปลี่ยน session | สร้าง session ใหม่ → Medusa ลบ session เดิม → Stripe provider cancel PI — **แต่ลบ session ได้แม้ PI `succeeded`** (PAY-5, ADR-015) | ขยาย: guard ก่อนสร้าง session ใหม่ (PAY-6, กฎข้อ 7) |
| อ่านสถานะ PI ของ session เดิม (ไม่เรียก Stripe ตรง) | `paymentModule.authorizePaymentSession(id)` → provider `authorizePayment` → `getPaymentStatus` ของ Stripe provider (ตรวจกับ source 2.22.1 ใน ADR-015) | ใช้ตามเดิมใน guard ของ PAY-6 |
| lock ข้าม request | Locking module (`Modules.LOCKING`) key `cart_id` (key เดียวกับ `processPaymentWorkflow`) | ใช้ตามเดิมใน guard ของ PAY-6 |
| อ่าน/ตรวจ webhook ของ provider | `paymentModule.getWebhookActionAndData(input)` (ที่ core subscriber ของ `payment.webhook_received` ใช้) | ใช้ตามเดิมใน subscriber alert ของ PAY-6 |
| ส่งอีเมล alert | Notification module + Resend provider ที่มีอยู่ | ใช้ตามเดิม |
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
   PI ที่ไม่มี payment ใน Medusa — ข้อยกเว้นของกฎข้อ 4 ตาม ADR-015; ไม่มีโค้ดใดเรียก refund ของ Stripe)

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
  `PAYMENT_WEBHOOK_SESSION_NOT_FOUND` และ `PAYMENT_ALREADY_COMPLETED`; และมีบรรทัด `OPS_ALERT_EMAIL=` ใน `apps/backend/.env.example` (unit test อ่านไฟล์)

## Test plan
- Integration (http): AC-8 โดย mock provider
- e2e: AC-1..AC-7 กับ Stripe test mode; CI รัน `stripe listen --forward-to` เพื่อให้
  webhook จริงส่งถึง runner; จำลอง PromptPay สำเร็จด้วยการ confirm PaymentIntent ใน test mode
- e2e: AC-9 (อ่าน PaymentIntent จาก Stripe test mode ระหว่าง AC-1/AC-4); CI: AC-10
- integration/e2e กับ Stripe test mode: AC-11; e2e: AC-12, AC-12b (ส่วน storefront); integration: AC-12b (complete cart หลัง guard)
- unit: guard (AC-13 a–g ด้วย mock payment module), การตรวจ runbook/env (AC-16); integration http: AC-13; integration: AC-14, AC-15

## Tasks
| ID | Task | Depends |
|----|------|---------|
| PAY-1 | ตั้งค่า Stripe provider, เปิดใช้ใน region, env, ตรวจสอบ webhook route ในเครื่องด้วย Stripe CLI (AC-8) | CORE-2 |
| PAY-2 | Storefront: ขั้นตอนชำระเงินด้วยบัตร + PromptPay, polling, error + e2e (AC-1..AC-5); `payment_method_types: ["card"]` ของ session บัตร (กฎข้อ 5, AC-9); แก้ขั้น `stripe listen` ใน `ci.yml` ที่ใส่ `--forward-to` ซ้ำ (AC-10) | PAY-1, CORE-5 |
| PAY-3 | หน้าชำระเงินของ order `/account/orders/:id/pay` + e2e (AC-7) | PAY-2 |
| PAY-4 | Refund e2e + screenshot หน้า admin (AC-6) | PAY-2 |
| PAY-5 | follow-up review PR #48 (เล็ก): race ระหว่าง QR หมดอายุกับการชำระสำเร็จ — test AC-11 ก่อนเพื่อยืนยันพฤติกรรมของ Medusa/Stripe provider เมื่อลบ session ที่ PI `succeeded` แล้ว; ถ้าเป็นกรณี (a) ของกฎข้อ 7 แก้เฉพาะ storefront ให้ poll ต่อเมื่อสร้าง session ใหม่ล้ม (AC-12); ถ้าเป็นกรณี (b) หยุดแล้วเขียน ADR (ไม่เขียน reconciliation เอง) | PAY-2 |
| PAY-6a | (◐ #82, แยกรอบ 6) ADR-015 A ฝั่ง backend: guard บน `POST /store/payment-collections/:id/payment-sessions` ตามกฎข้อ 7A (`authorizePaymentSession` เท่านั้น ไม่เรียก Stripe ตรง, lock `cart_id`/`payment_collection_id`, 409 `PAYMENT_ALREADY_COMPLETED` ผ่าน PROMO-2) + guard หลัง ownership ของ CORE-12 + เปิด test AC-11 จาก `test.fixme` + integration complete cart idempotent (AC-11, AC-13 a–g, AC-14, AC-12b ส่วน backend = integration complete cart หลัง guard) | PAY-5 (#65), PROMO-2 |
| PAY-6b | (แยกรอบ 6) storefront: poll ต่อเมื่อได้ `PAYMENT_ALREADY_COMPLETED` และเรียก complete cart เป็นทางสำรอง (AC-12, AC-12b ส่วน storefront) + ADR-015 D: subscriber `src/subscribers/payment-webhook-orphan.ts` (`PAYMENT_WEBHOOK_SESSION_NOT_FOUND` + อีเมล `OPS_ALERT_EMAIL`) + `OPS_ALERT_EMAIL` ใน `.env.example` + runbook ใน `docs/ops/production.md` (กฎข้อ 7D) (AC-15, AC-16) — ถ้าเกิน ~400 LOC แยก storefront (6b1) กับ alert + runbook (6b2) ทำขนานกันได้ | PAY-6a |
PAY-3 ∥ PAY-4 ∥ PAY-5 หลัง PAY-2 (PAY-5 แตะ `promptpay-payment` เดียวกับที่ PAY-3 นำไปใช้ซ้ำ — merge PAY-5 ก่อน PAY-3 ถ้าทำพร้อมกัน ให้ rebase)
PAY-6a → PAY-6b (storefront ต้องได้ 409 จริงจาก guard); PAY-6b แตะ `promptpay-payment` เดียวกับ PAY-3 — ตัวที่ merge ทีหลัง rebase; **ทั้ง PAY-6a และ PAY-6b**
ต้อง merge ก่อน release ที่เปิด PromptPay ให้ลูกค้าจริง
หมายเหตุ (รอบ 6, จาก #82): ข้อกังวลในภาคผนวก ADR-015 ("lock key `payment_collection_id` ของ collection ที่ไม่มี cart ไม่ตรงกับ lock ของ `processPaymentWorkflow`
→ guard กับ webhook อาจสร้าง payment ซ้อน") **ไม่เกิดจริง**: Medusa 2.22.1 มี unique index บน `payment.payment_session_id` จึงสร้าง payment ที่สองของ session
เดียวกันไม่ได้ ไม่ต้องเพิ่ม lock/โค้ด — integration test ที่ภาคผนวกกำหนดยังต้องมี (PAY-6a หรือ PAY-3) เพื่อยืนยันพฤติกรรมนี้ไว้ ADR-015 ไม่เปลี่ยน

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
