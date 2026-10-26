# ADR-015 Medusa ลบ payment session ได้แม้ PaymentIntent ชำระแล้ว (race ตอน QR PromptPay หมดอายุ)

สถานะ: **accepted** (owner 2026-10-26) — เลือก **A + D**, ไม่ทำ B
เกี่ยวข้อง: ADR-007, spec 06 กฎข้อ 3, 4, 7, AC-11, AC-12, task PAY-5 (พบปัญหา), PAY-6 (แก้ตาม ADR นี้)

## บริบท
spec 06 กฎข้อ 7 ให้ PAY-5 ยืนยันด้วย test ว่าเมื่อลูกค้าชำระ PromptPay สำเร็จในช่วงระหว่าง storefront อ่านสถานะ PI (ยังไม่ชำระ) กับการสร้าง
session ใหม่ตอน QR หมดอายุ ผลเป็นกรณี (a) (การลบ session เดิมล้ม → poll ต่อได้) หรือ (b) (Medusa ลบ session/ทิ้ง payment ได้)

**ผลที่พบ: กรณี (b)** — Medusa 2.22.1 + `@medusajs/payment-stripe` 2.22.1, Stripe test mode จริง + webhook ผ่าน `stripe listen`
(e2e `apps/storefront/e2e/payments-promptpay-race.spec.ts`, evidence `docs/evidence/payments/PAY-5-tests.txt`):
1. PI PromptPay `requires_action` → authorize test payment → PI `succeeded`
2. ทันทีเรียก `POST /store/payment-collections/:id/payment-sessions` (provider PromptPay เดิม) → **HTTP 200**, ได้ session + PI ใหม่
3. webhook `payment_intent.succeeded` ของ PI เดิมถึง backend (200) แต่ `processPaymentWorkflow` ล้มด้วย
   `PaymentSession with id: payses_… was not found` → ไม่มี payment, cart ไม่ถูก complete
4. หลัง 60 วินาที: PI `succeeded` (เงินถูกตัด) แต่ไม่มี order ที่อ้าง PI นั้น — Stripe ได้ 200 จึงไม่ส่ง webhook ซ้ำ

สาเหตุจากโค้ดของ Medusa 2.22.1 (ไม่ได้แก้):
- `createPaymentSessionsWorkflow` ลบ session เดิมทั้งหมดของ collection ขนานกับการสร้าง session ใหม่
- `StripeBase.deletePayment` เรียก `paymentIntents.cancel` และข้าม error เมื่อ PI เป็น `canceled` หรือ `succeeded` → session ถูกลบจาก DB
  (`StripeBase` เป็น base ของทุก Stripe provider ทั้งบัตรและ PromptPay)
- webhook อ้าง session ด้วย `metadata.session_id` เท่านั้น เมื่อ session ถูกลบจึงผูก PI กับ cart ไม่ได้

## ทางเลือกที่พิจารณา
A. **guard ฝั่ง backend ก่อนลบ session** — middleware บน `POST /store/payment-collections/:id/payment-sessions` ตรวจ session เดิมผ่าน
   payment module ของ Medusa ถ้าชำระแล้วตอบ 409 และไม่ลบ session — ปิดช่องจาก storefront เกือบหมด เหลือ race สั้นๆ (ดู "ความเสี่ยงที่เหลือ")
B. **reconciliation** — job/subscriber หา PI `succeeded` ที่ไม่มี payment ใน Medusa แล้ว complete cart ใหม่หรือ refund อัตโนมัติ — ปิดช่องครบ
   แต่เป็น custom payment code มากที่สุด และ refund นอก `refundPaymentWorkflow` ขัดกฎข้อ 4
C. **storefront ไม่สร้าง session ใหม่อัตโนมัติ** — ให้ผู้ใช้กด "ลองอีกครั้ง" เอง — ลดโอกาสแต่ไม่ปิดช่อง
D. **alert + runbook** — ตรวจจับ webhook ที่หา session ไม่เจอ (log error + อีเมล `OPS_ALERT_EMAIL`) แล้ว ops refund ตาม runbook — ไม่แก้อัตโนมัติ แต่ไม่มีเงินค้างโดยไม่มีใครรู้
E. **แก้ที่ต้นทาง** — issue/PR ที่ Medusa ให้ `deletePayment` ไม่ข้าม `succeeded` แล้ว bump เวอร์ชันผ่าน ADR — ถูกที่สุดระยะยาว แต่ไม่รู้กำหนดเวลา

## การตัดสินใจ
**A + D** (owner 2026-10-26) ไม่ทำ B; C และ E ไม่อยู่ในขอบเขตของ ADR นี้

### A: guard ผ่านกลไกของ Medusa — ไม่เรียก Stripe ตรง
middleware ของเราใน `src/api/middlewares.ts` บน `POST /store/payment-collections/:id/payment-sessions` (ต่อจาก `authenticate("customer", ...)`)
ไม่มีการเรียก Stripe SDK/API ในโค้ดของเรา สถานะ PI อ่านผ่าน `paymentModule.authorizePaymentSession(id)` → provider `authorizePayment` →
`getPaymentStatus` ของ Stripe provider

ตรวจกับ source 2.22.1 แล้ว (`@medusajs/payment` `PaymentModuleService.authorizePaymentSession`, `@medusajs/payment-stripe` `StripeBase.getStatus`):

| สถานะ PI | status จาก provider | ผลของ `authorizePaymentSession` | guard ทำ |
|---|---|---|---|
| `requires_payment_method` / `requires_confirmation` / `requires_action` | `pending` / `requires_more` | update session status แล้ว throw `MedusaError` `NOT_ALLOWED` | `next()` — สร้าง session ใหม่ตามปกติ |
| `canceled` / error | `canceled` / `error` | throw `NOT_ALLOWED` | `next()` |
| `succeeded` | `captured` | สร้าง payment บน collection และ mark captured (ไม่เรียก capture ซ้ำที่ provider) คืน payment | throw `MedusaError(CONFLICT, …, "PAYMENT_ALREADY_COMPLETED")` → 409 |
| `requires_capture` | `authorized` | สร้าง payment คืน payment | 409 เหมือนกัน |
| `processing` (async method) | `pending_authorization` | คืน `null` ไม่ throw | 409 (การชำระกำลังดำเนินอยู่ ห้ามลบ) |

กติกาของ guard:
1. ทำงานเฉพาะเมื่อ collection มี session เดิมของ Stripe provider (`provider_id` ขึ้นต้นด้วย `pp_stripe` — ครอบทั้ง `pp_stripe_stripe` และ
   `pp_stripe-promptpay_stripe`) ที่มี `data.id` (PI id) ไม่ตรงเงื่อนไข → `next()` ทันที
2. session เดิมมี `authorized_at` หรือ payment แล้ว → 409 ทันทีโดยไม่เรียก provider (cart กำลัง/ถูก complete แล้ว)
3. ยังไม่ authorized → เรียก `authorizePaymentSession` ตามตารางข้างบน: แยก `NOT_ALLOWED` ออกจาก error อื่น error อื่น (เช่น Stripe ล่ม)
   → **fail closed** ส่ง error ต่อ (ไม่ `next()`) เพื่อไม่ลบ session ที่ไม่รู้สถานะ storefront ลองใหม่ได้
4. 409 ใช้กลไก PROMO-2 (spec 03 กฎข้อ 13): throw `MedusaError(CONFLICT, message, "PAYMENT_ALREADY_COMPLETED")` และเพิ่ม code นี้ใน allow-list
   ของ `businessErrorHandler` — ห้าม `res.status(409)` ใน middleware
5. ครอบการตรวจด้วย lock ของ Medusa (`Modules.LOCKING`) key = `cart_id` ของ collection (key เดียวกับที่ `processPaymentWorkflow` ใช้) เพื่อไม่ให้
   guard กับ webhook authorize session เดียวกันพร้อมกันจนสร้าง payment ซ้อน
6. เรียก `paymentModule.authorizePaymentSession` ตรงใน middleware ไม่ห่อเป็น workflow ที่ throw 409 หลัง `authorizePaymentSessionStep` —
   compensation ของ step นั้นเรียก `cancelPayment` ซึ่งจะยกเลิก payment ที่เพิ่งสร้าง (การเรียก module เดียวไม่ใช่ logic ข้าม module จึงไม่ขัด
   CLAUDE.md ข้อ 2; การอ่าน link cart ↔ collection ใช้ `query.graph`)

หลัง 409: session เดิมไม่ถูกลบ, webhook `payment_intent.succeeded` ที่มาถึง → `processPaymentWorkflow` เห็น payment อยู่แล้ว → รัน
`capturePaymentWorkflow` (payment มี `captured_at` แล้ว → ไม่สร้าง capture ใหม่ ไม่เรียก provider) → `completeCartAfterPaymentStep` →
`completeCartWorkflow` (`authorizePaymentSession` คืน payment เดิมแบบ idempotent) → order `payment_status=captured`
storefront ได้ code `PAYMENT_ALREADY_COMPLETED` → แสดง `promptpay-awaiting-order` และ poll ต่อ (AC-12)
**builder ต้องยืนยันด้วย integration test** ว่าเส้นทางนี้ complete cart ได้จริงแบบ idempotent (รายละเอียดใน PAY-6) — ถ้าไม่จริง หยุดและรายงาน
planner ห้ามเขียนการ complete cart เอง

ขอบเขต provider — **ทุก Stripe provider (บัตร + PromptPay)**: ADR-007 ตั้ง `capture: true` ทั้งคู่ PI บัตรจึงไป `succeeded` ได้ทันทีที่ confirm
(รวมหลัง 3DS) และ `deletePayment` ข้าม `succeeded` ใน `StripeBase` เหมือนกัน ถ้าหลัง confirm บัตรแล้วมีการสร้าง session ใหม่ (เปลี่ยนวิธีชำระ,
ย้อนหน้า, retry) ก่อน cart complete ก็เกิดกรณี (b) ได้เช่นกัน ต้นทุนคือ Stripe retrieve 1 ครั้งต่อการสร้าง session ใหม่ที่มี session เดิม

### D: alert + runbook (ตาข่ายสำรองของความเสี่ยงที่เหลือ)
- subscriber ของเรา `src/subscribers/payment-webhook-orphan.ts` บน `PaymentWebhookEvents.WebhookReceived` (`payment.webhook_received`
  event เดียวกับ subscriber `payment-webhook-handler` ของ Medusa, subscriberId แยก) อ่านอย่างเดียว: เรียก
  `paymentModule.getWebhookActionAndData(input)` (provider ตรวจ signature) ถ้า action เป็น `captured`/`authorized` และมี `session_id` แต่
  `paymentModule.listPaymentSessions({ id: session_id })` ว่าง → `logger.error` หนึ่งบรรทัด ข้อความขึ้นต้นด้วย
  `PAYMENT_WEBHOOK_SESSION_NOT_FOUND` พร้อม `provider`, `session_id`, `amount`, `payment_intent` (= `data.object.id` ของ event ที่ provider
  ตรวจแล้ว) และ `payment_collection_id`/`cart_id` ถ้ายังหาได้ (builder ตรวจว่า session ถูก soft delete หรือไม่)
- alert (owner ตัดสิน 2026-10-26): `logger.error` ข้างบน **และ** ส่งอีเมลหา `OPS_ALERT_EMAIL` ผ่าน Notification module (Resend ที่มีอยู่)
  ทันที — แจ้งได้แม้ยังไม่มี Sentry (OPS-3); env แยกจาก `EVOUCHER_ADMIN_EMAIL`; ถ้าไม่ตั้ง env → log warn แล้วข้ามการส่ง
  ส่งอีเมลล้มต้องไม่ทำให้ subscriber ล้ม (log error แทน); กฎบน log aggregator จับ `PAYMENT_WEBHOOK_SESSION_NOT_FOUND` เพิ่มได้ภายหลัง
  ไม่เพิ่ม metric/infra ใหม่
- runbook: หัวข้อใหม่ **"เงินถูกตัดแต่ไม่มี order (ADR-015)"** ใน `docs/ops/production.md` — ค้น PI ใน Stripe dashboard → ยืนยันว่าไม่มี order
  อ้าง PI นั้น (admin orders) → refund เต็มจำนวนใน Stripe dashboard → แจ้งลูกค้า → บันทึก PI/ลูกค้า/เวลาในบันทึก incident
- ใช้ Stripe account แยกต่อ environment เพื่อไม่ให้ webhook ของ environment อื่นทำให้ alert ผิด

### การยกเว้น ADR-007 และ spec 06 กฎข้อ 4 (เฉพาะขอบเขตนี้)
- **ADR-007 ("ไม่มีโค้ด payment ที่เขียนเอง")**: ยกเว้นเฉพาะ (1) middleware guard ข้างบน ซึ่งเรียก method สาธารณะของ payment module
  (`authorizePaymentSession`) และ (2) subscriber อ่านอย่างเดียวของ D ทั้งสองไม่เรียก Stripe ตรง ไม่เปลี่ยน provider/config capture ไม่สร้าง/
  refund payment นอก method ของ Medusa — ข้ออื่นของ ADR-007 คงเดิม ยังห้าม custom provider, reconciliation, refund อัตโนมัติ
- **spec 06 กฎข้อ 4**: "refund ผ่าน `refundPaymentWorkflow` เท่านั้น" ยกเว้นเฉพาะการ refund **ด้วยมือโดย ops ใน Stripe dashboard ตาม runbook**
  สำหรับ PI ที่ไม่มี payment ใน Medusa (จึง refund ผ่าน workflow ไม่ได้) ไม่มีโค้ดใดเรียก refund ของ Stripe ส่วน "ห้ามเรียก Stripe API ตรง
  นอก provider" คงเดิม (guard เรียกผ่าน provider)
- spec 06 กฎข้อ 7 ต้องปรับถ้อยคำให้สอดคล้อง A + D (ผลที่ยอมรับ: guard ปิดช่องจาก storefront, กรณีที่หลุด = alert + refund ด้วยมือ ไม่ใช่
  แก้อัตโนมัติ) — เป็นงานของ planner ใน spec 06

### ความเสี่ยงที่เหลือ (TOCTOU)
guard ตรวจแล้ว `next()` → `createPaymentSessionsWorkflow` เรียก `deletePayment` (cancel PI) ภายหลัง ระยะห่างระดับสิบ–ร้อยมิลลิวินาที:
- ถ้า cancel ถึง Stripe ก่อนลูกค้าชำระ → PI `canceled` ชำระจาก QR เก่าไม่ได้ ปลอดภัย
- ถ้าลูกค้าชำระสำเร็จในช่วงนั้นพอดี → cancel ล้มด้วย `succeeded` แต่ provider ข้าม → กลับเป็นกรณี (b) → D จับได้ (alert + refund ด้วยมือ)
- PI `processing` ของ method ที่ไม่ได้ตั้งเป็น async → provider คืน `pending` → guard `next()` แต่ `deletePayment` ไม่ข้าม `processing` → การลบล้ม
  (กรณี a) ไม่เสียเงิน
lock ในข้อ 5 ไม่ครอบช่วงนี้เพราะการลบอยู่ใน route ของ Medusa หลัง middleware owner ยอมรับความเสี่ยงที่เหลือนี้พร้อม D

## ผลที่ตามมา
- task ถัดไป **PAY-6 (← PAY-5; ใช้กลไก error ของ PROMO-2)** ทำ A + D และทำให้ AC-11/AC-12 ผ่าน:
  - integration (http): session ยังไม่ชำระ → 200 session ใหม่; session ที่ authorize ได้ (`captured`/`authorized`/`pending_authorization`) หรือ
    มี `authorized_at` แล้ว → 409 `{ type: "conflict", code: "PAYMENT_ALREADY_COMPLETED" }` และ session เดิมยังอยู่; error อื่นจาก provider →
    ไม่ลบ session
  - integration: หลัง guard authorize แล้ว รัน `processPaymentWorkflow` ด้วย action `captured` ของ session นั้น → cart complete เป็น order
    `payment_status=captured` มี payment เดียว; รันซ้ำ → ไม่มี capture/order ซ้ำ
  - integration/unit: subscriber D log `PAYMENT_WEBHOOK_SESSION_NOT_FOUND` เมื่อ session หาไม่เจอ และไม่ log เมื่อเจอ
  - e2e: เอา `test.fixme` ของ AC-11 ออก (assert 409 แทน log) + AC-12 ใน storefront; เพิ่มหัวข้อ runbook ใน `docs/ops/production.md`
  - ถ้า diff เกิน ~400 LOC แยก D (subscriber + runbook) เป็น PR ที่สองได้
- จนกว่า PAY-6 merge: test AC-11 เป็น `test.fixme` อ้าง PAY-6 + ADR นี้ (รันยืนยันปัญหาในเครื่องได้ด้วย `E2E_RUN_KNOWN_ISSUES=1`)
- การสร้าง session ใหม่ที่มี session Stripe เดิมช้าขึ้น 1 Stripe retrieve
- ถ้า Medusa แก้ต้นทาง (E) ภายหลัง ให้ทบทวน guard ใน ADR ใหม่ตอน bump เวอร์ชัน

## ภาคผนวก (owner 2026-10-26): payment collection ที่ไม่มี cart
- payment collection ของ **order** (หน้า `/account/orders/:id/pay` เช่น group buy — PAY-3/GB-5) ไม่มี `cart_id` → guard ใช้ lock key =
  `payment_collection_id` แทน (collection ที่มี cart ยังใช้ `cart_id` ตามข้อ 5 เพื่อให้ตรงกับ `processPaymentWorkflow`)
- หน้า order pay ไม่ใช้ทางสำรอง complete cart (spec 06 AC-12b) — เมื่อได้ `PAYMENT_ALREADY_COMPLETED` ให้ poll สถานะ order ต่ออย่างเดียว
- ไม่เปลี่ยนส่วนอื่นของ A + D (spec 06 Q6)
