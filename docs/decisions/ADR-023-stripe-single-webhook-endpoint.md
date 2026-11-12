# ADR-023 ใช้ Stripe webhook endpoint ตัวเดียว (`/hooks/payment/stripe_stripe`) สำหรับทั้งบัตรและ PromptPay

สถานะ: **accepted** (owner อนุมัติ 2026-11-12 — ทางเลือก 1; ตรวจ endpoint ใน Stripe Dashboard ด้วยมือใน go-live checklist ไม่เพิ่มการตรวจผ่าน Stripe API ใน `check:go-live`)
เกี่ยวข้อง: ADR-007, ADR-015 D, spec 06 (AC-8, AC-10, AC-15, task PAY-7), spec 07 OPS-10, `docs/ops/production.md` หัวข้อ "Stripe webhooks" และ "Go-live checklist"

## บริบท
- `apps/backend/medusa-config.ts:66-84` ลงทะเบียน `@medusajs/medusa/payment-stripe` ครั้งเดียว (`id: 'stripe'`, `webhookSecret: process.env.STRIPE_WEBHOOK_SECRET`)
  `@medusajs/payment-stripe` 2.22.1 สร้าง provider ทุกตัวใน array `services` จาก options ชุดเดียวกัน (`dist/index.js:5-17`) รวม
  `pp_stripe_stripe` (บัตร, `services/stripe-provider.js`) และ `pp_stripe-promptpay_stripe` (`services/stripe-promptpay.js`) — ทั้งคู่ extend `StripeBase`
  ต่างกันแค่ `paymentIntentOptions`
- ทุก provider ตรวจ signature ด้วย secret ค่าเดียว: `StripeBase.constructWebhookEvent` → `stripe.webhooks.constructEvent(data.rawData, signature, this.options_.webhookSecret)`
  (`dist/core/stripe-base.js:518-526`)
- เอกสารของเราสั่งให้สร้าง endpoint ใน Stripe Dashboard **สองตัว** ที่สมัคร event ชุดเดียวกัน (`docs/ops/production.md:110-126`, spec 06 บรรทัด 8-9 และ 36,
  comment `medusa-config.ts:68`) ตามตารางในหน้า Stripe provider ของ Medusa docs ที่แสดง URL หนึ่งตัวต่อ provider (docs ไม่ได้บอกว่าต้องสร้างทุกตัว)
- Stripe Dashboard ออก signing secret (`whsec_…`) **คนละค่าต่อ endpoint** แต่เราใส่ได้ค่าเดียว → endpoint หนึ่งตรวจ signature ไม่ผ่านทุก event
- Stripe กรอง event ตาม payment method ไม่ได้ — `payment_intent.*` ของทุก PI ไปทุก endpoint อยู่แล้ว CI ไม่เจอปัญหาเพราะ `stripe listen` ทุก process ใช้ secret เดียวกัน
  (`.github/workflows/ci.yml:269-286`) ผลคือใน CI ทุก event ถูกประมวลผล**สองรอบ** (หนึ่งรอบต่อ listener)

### อาการจริงใน prod เมื่อมีสอง endpoint (ตรวจกับโค้ด 2.22.1 — แก้ข้อสันนิษฐานเดิม)
- route `POST /hooks/payment/:provider` **ไม่ตรวจ signature** แค่ emit event `payment.webhook_received` แล้วตอบ 200 เสมอ
  (`@medusajs/medusa/dist/api/hooks/payment/[provider]/route.js:5-30`) → Stripe เห็น 200 ทั้งสอง endpoint **ไม่ retry และไม่ disable endpoint**
  (สอดคล้องกับ ADR-015 บริบทข้อ 4 "Stripe ได้ 200 จึงไม่ส่ง webhook ซ้ำ")
- การตรวจ signature เกิดใน subscriber แบบ async: core subscriber `payment-webhook-handler` (`@medusajs/medusa/dist/subscribers/payment-webhook.js:13`) throw
  → event bus แบบ Redis retry subscriber ที่ล้มตาม `attempts` (ค่าเริ่มต้น `webhook_retries || 3` ที่ route.js:22; กลไก retry ที่
  `@medusajs/event-bus-redis/dist/services/event-bus-redis.js:46-106`) แล้วทิ้ง; subscriber `payment-webhook-orphan` ของเรา log warn `skipped` ทุก event
- endpoint ที่ secret ตรงยังรับ event ของ**ทุก** PI (ทั้งบัตรและ PromptPay) และประมวลผลถูก (ดูการตรวจข้อ 1) → การชำระเงินไม่พัง แต่มี error/warn ทุก event × จำนวน retry
  ซ่อน error จริง, alert จาก log รก และเปลืองงานของ worker — ถ้าใครตั้ง secret ผิดตัวโดยไม่รู้ ก็ไม่มีอะไรเตือนนอกจาก log

## การตรวจกับโค้ด Medusa 2.22.1 (node_modules จริง)
1. **event PromptPay ที่เข้า `/hooks/payment/stripe_stripe` ทำงานถูก — ไม่มีการเช็กว่า provider ของ session ต้องตรงกับ provider ของ webhook**
   - route ใส่ `provider` จาก path ลง event (`route.js:7-14`)
   - core subscriber เรียก `paymentService.getWebhookActionAndData(input)` แล้วส่ง `processedEvent` (= `{ action, data: { session_id, amount } }` ไม่มี provider)
     เข้า `processPaymentWorkflow` (`subscribers/payment-webhook.js:13-34`)
   - Payment module แปลง `stripe_stripe` เป็น `pp_stripe_stripe` แล้วเรียก provider นั้น (`@medusajs/payment/dist/services/payment-module.js:781-786`
     → `payment-provider.js:131-134`; `retrieveProvider` resolve จาก container ตรงๆ ไม่ดูการเปิดใช้ใน region `payment-provider.js:25-27`)
   - `StripeBase.getWebhookActionAndData` อ่าน `intent.metadata.session_id` และ map ตาม `event.type` เท่านั้น ไม่ดู `payment_method_types`/provider
     (`stripe-base.js:425-507`); ส่วนที่ขึ้นกับ options (`isAsyncPaymentMethod`, `:508-511`) ใช้ options ชุดเดียวกันทุก provider จึงได้ผลเหมือนกัน
   - `processPaymentWorkflow` หา payment/session/cart ด้วย `session_id` อย่างเดียว (`@medusajs/core-flows/dist/payment/workflows/process-payment.js:39-76`)
     ไม่มี input provider; ขั้นที่เรียก provider ใช้ `provider_id` ของ session/payment ใน DB (`payment-module.js:242` authorize, `:415` capture)
     → PI PromptPay ถูก authorize/capture ผ่าน `pp_stripe-promptpay_stripe` ตามเดิม
   - สรุป: ทางเลือก 1 ใช้ได้ ข้อยืนยันเชิงเครื่องอยู่ใน task PAY-7 (integration test session PromptPay + webhook path `stripe_stripe`)
2. **subscriber `payment-webhook-orphan` (ADR-015 D, AC-15)** ยังถูกต้อง: เรียก `getWebhookActionAndData` ตัวเดียวกับ core (`payment-webhook-orphan.ts:34`)
   แล้วตรวจ session ด้วย `session_id` อย่างเดียว (`:45`) → alert `PAYMENT_WEBHOOK_SESSION_NOT_FOUND` ยังเกิดเมื่อ session PromptPay ถูกลบ
   ข้อต่างเดียว: ค่า `provider` ใน log/อีเมล (`:53`) เป็น **path ของ endpoint** (`stripe_stripe`) ไม่ใช่ provider ของ session — runbook ต้องบอกว่าอย่าใช้ค่านี้ตัดสิน
   ว่าเป็นบัตรหรือ PromptPay (ดู `payment_method_types` ของ PI ใน Stripe Dashboard จาก `payment_intent` ใน alert) ผลดีเพิ่ม: เดิมใน CI (และ prod ถ้า secret ตรงทั้งคู่)
   alert ออกสองครั้งต่อ event ตอนนี้ออกครั้งเดียว
3. **CI**: เหลือ `stripe listen` process เดียว forward ไป `localhost:9000/hooks/payment/stripe_stripe` ให้ตรงกับ prod — AC-4 (PromptPay → order) ที่ผ่านด้วย listener
   ตัวเดียวคือหลักฐานว่า event PromptPay ผ่าน path บัตรได้; spec 06 AC-10 ที่บังคับ "ถึงทั้งสอง endpoint" ต้องแก้ (ข้อความเสนอใน task PAY-7)
   `tools/ci/check-stripe-events.sh` (OPS-10) **ไม่ต้องแก้**: เทียบเซต event ในหัวข้อ "## Stripe webhooks" กับบรรทัด `events=` บรรทัดเดียวใน `ci.yml`
   (`check-stripe-events.sh:13-21`) ซึ่งยังเป็นบรรทัดเดียว — คงหัวข้อและรายการ bullet ไว้ตามเดิม; `tools/ci/check-stripe-webhooks.sh` รับ log/url เป็น argument ไม่ต้องแก้
   (ขั้น "Stripe webhooks reached both endpoints" ใน `ci.yml:299-305` เหลือการเรียกครั้งเดียว)

## ทางเลือก
1. **endpoint เดียวต่อ environment** → `https://<backend>/hooks/payment/stripe_stripe` รับ event ของทั้งบัตรและ PromptPay; `STRIPE_WEBHOOK_SECRET` = secret ของ endpoint นี้
   — ข้อดี: ไม่แตะโค้ด/config ของ provider, provider id เดิม, ไม่มี event ล้มทิ้ง, ประมวลผล event ละครั้งเดียว; ข้อเสีย: ต่างจากตาราง URL ต่อ provider ใน Medusa docs
   (ต้องเขียนเหตุผลไว้ในเอกสาร ops) และพึ่งพฤติกรรมที่ provider/workflow ไม่เช็ก provider (ป้องกันด้วย integration test)
2. ลงทะเบียน `payment-stripe` สองครั้ง คนละ `id` + คนละ `webhookSecret` — provider id เปลี่ยน (เช่น `pp_stripe-promptpay_<id ใหม่>`) กระทบ payment provider ของ region
   ที่ seed ไว้, storefront ที่อ้าง `pp_stripe-promptpay_stripe`, guard PAY-6 (prefix `pp_stripe`), test/e2e และ session/payment เดิมใน DB; อีกทั้งแต่ละการลงทะเบียนยังสร้าง
   provider ครบทุก method (บัตรซ้ำสองชุด) — ไม่เลือก
3. คงสอง endpoint แล้วยอมให้ตัวหนึ่ง fail — การชำระเงินทำงาน (ดูบริบท) แต่ error/warn ทุก event × retry, งาน worker เปล่า และตั้ง secret ผิดตัวโดยไม่มีอะไรเตือน — ไม่เลือก
4. เขียน webhook route/การตรวจ signature เอง (รองรับหลาย secret) — ขัดข้อห้ามข้อ 1 ของ CLAUDE.md (สร้างสิ่งที่ Medusa มีซ้ำ) — ไม่เลือก

## การตัดสินใจ
เลือก **1** ลงทะเบียน webhook endpoint ใน Stripe Dashboard **ตัวเดียว** ต่อ environment ที่ `https://<backend>/hooks/payment/stripe_stripe` สมัคร event ตามรายการเดิมใน
`docs/ops/production.md` หัวข้อ "Stripe webhooks"; `STRIPE_WEBHOOK_SECRET` = signing secret ของ endpoint นั้น **ห้าม**ลงทะเบียน `/hooks/payment/stripe-promptpay_stripe`
(route ยังมีอยู่ใน Medusa ปิดไม่ได้และไม่ต้องปิด) ไม่เพิ่มโค้ด production, route, infra หรือ dependency

## ผลที่ตามมา
- เอกสาร/CI ต้องแก้ตาม task PAY-7 (spec 06): `docs/ops/production.md` (หัวข้อ "Stripe webhooks" + checklist ข้อ 2 + หมายเหตุ `provider` ใน runbook ADR-015),
  spec 06 บรรทัด 8-9, 36 และ AC-10, comment `medusa-config.ts:67-68`, `ci.yml` (listener เดียว), `docs/design/sequence-diagrams.md:189`,
  comment `STRIPE_WEBHOOK_SECRET` ใน `apps/backend/.env.example:49` (ระบุ endpoint เดียว) — evidence เก่าใน `docs/evidence/payments/` ไม่แก้ (บันทึกประวัติ)
- ความเสี่ยง: Medusa รุ่นถัดไปอาจเพิ่มการเช็กว่า provider ของ webhook ต้องตรงกับ session → PromptPay ไม่ได้ order (เงินถูกตัด ไม่มี order, alert ของ ADR-015 D ไม่ช่วยเพราะ
  session ยังอยู่) กันด้วย integration test ของ PAY-7 (session PromptPay + webhook path `stripe_stripe` → order 1 รายการ) ที่ต้องผ่านทุกครั้งที่ bump `@medusajs/*`
  ถ้าล้มหลัง bump → หยุด bump แล้วทบทวน ADR นี้ (ทางเลือก 2)
- การย้อนกลับ: เป็นการตั้งค่าใน Stripe Dashboard + เอกสาร ไม่มี migration; ย้อนกลับเป็นสอง endpoint ได้ทันทีแต่กลับไปมีอาการของทางเลือก 3 จนกว่าจะทำทางเลือก 2
- verify ก่อน go-live (เพิ่มใน checklist โดย PAY-7): บน staging/test mode ที่มี endpoint เดียว (1) Stripe Dashboard → Developers → Webhooks มี endpoint ของ backend นี้
  ตัวเดียวคือ `/hooks/payment/stripe_stripe`; (2) จ่ายพร้อมเพย์ (confirm PI ใน test mode) → ได้ order `payment_status=captured`; (3) จ่ายบัตร `4242…` → ได้ order;
  (4) log ของ server/worker ไม่มี `An error occurred in constructWebhookEvent` และไม่มี `payment-webhook-orphan: skipped`; (5) Dashboard แสดง delivery ของ
  endpoint ตอบ 200
- environment ที่สร้างสอง endpoint ไปแล้ว (ถ้ามี): ลบ endpoint `stripe-promptpay_stripe` ใน Dashboard และตรวจว่า `STRIPE_WEBHOOK_SECRET` เป็น secret ของ `stripe_stripe`
