# Production config ของ backend (OPS-2)

อ้างอิง: `docs/spec/07-scaling-ops.md` (deliverable 2, 3) — ทุกอย่างเป็น module/provider ทางการที่มากับ
`@medusajs/medusa` 2.22.1 ไม่มี dependency ใหม่ โค้ดอยู่ที่ `apps/backend/src/lib/infra-modules.ts`

## Redis modules
เปิดเมื่อ `NODE_ENV=production` **และ** ตั้ง `REDIS_URL` (backend image ตั้ง `NODE_ENV=production` ให้แล้ว)

| ความสามารถ | module ของ Medusa | option |
|---|---|---|
| Event bus (BullMQ) | `@medusajs/medusa/event-bus-redis` | `redisUrl` |
| Workflow engine | `@medusajs/medusa/workflow-engine-redis` | `redis.redisUrl` |
| Cache | `@medusajs/medusa/caching` + provider `@medusajs/medusa/caching-redis` | `redisUrl` |
| Locking | `@medusajs/medusa/locking` + provider `@medusajs/medusa/locking-redis` (default) | `redisUrl` |
| Session store | `projectConfig.redisUrl` | — |

- `medusa develop` (development) และ jest/medusa-test-utils (test) ใช้ module in-memory ของ Medusa เสมอ
  แม้ `.env` จะมี `REDIS_URL` — dev หลายเครื่อง/หลาย worktree จึงไม่แย่ง queue เดียวกันใน Redis
- production ที่ `MEDUSA_WORKER_MODE=server|worker` แต่ไม่มี `REDIS_URL` → config throw ตอนบูต
  (event bus in-memory ส่ง event จาก server ไป subscriber บน worker ไม่ได้)
- Cache ใช้ Caching Module (Cache Module `cache-redis` deprecated ตั้งแต่ v2.11) core ของ Medusa จะ cache
  ผล Query ก็ต่อเมื่อตั้ง `MEDUSA_FF_CACHING=true` (feature flag ยังเป็น WIP — ปิดไว้จนกว่าจะตัดสินใจ)
- แยก Redis ต่อหน้าที่ได้ภายหลัง (เช่น queue กับ cache) แต่ v1.0 ใช้ instance เดียว

## Pool ของ Postgres
`DATABASE_POOL_MIN` / `DATABASE_POOL_MAX` → `projectConfig.databaseDriverOptions.pool`
(ไม่ตั้ง = default ของ Medusa: min 2, max ตาม driver)
งบ connection: `(จำนวน server + worker) × DATABASE_POOL_MAX` ต้องน้อยกว่า `max_connections` ของ Postgres
(managed service มักจำกัด ~100 ต่อ instance เล็ก) — เช่น 2 server + 1 worker × 20 = 60

## ไฟล์ (S3) และ CDN
ตั้ง `S3_BUCKET` → File Module ใช้ `@medusajs/medusa/file-s3` (provider id `s3`) แทน `file-local`
ต้องตั้ง `S3_REGION`, `S3_FILE_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` และ `S3_ENDPOINT`
(สำหรับ storage ที่รองรับ S3 เจ้าอื่น) ไม่ตั้ง `S3_BUCKET` = `file-local` (dev/CI ไม่ต้องมี credentials)
หมายเหตุ: `file-local` เก็บไฟล์ใน container — ใช้กับหลาย replica ไม่ได้ prod ต้องใช้ S3

CDN หน้าไฟล์:
1. สร้าง CDN (เช่น CloudFront) ที่มี origin เป็น bucket แล้วตั้ง `S3_FILE_URL=https://<โดเมน CDN>`
   Medusa สร้าง URL ของไฟล์จาก `file_url` จึงได้ URL ผ่าน CDN ทันที
2. provider ตั้ง `Cache-Control: public, max-age=31536000` ให้ทุก object และต่อท้าย key ด้วย ulid (ไฟล์ใหม่ = URL ใหม่) → cache ได้ยาวโดยไม่ต้อง invalidate
3. ถ้า bucket ปิด ACL (Object Ownership = Bucket owner enforced) ให้ CDN อ่านผ่าน origin access control
   (การตั้ง option `acl: false` ของ provider ยังไม่ได้ทำ — เสนอเป็น task ใหม่เมื่อเลือก provider จริง)

CDN หน้า storefront: วาง CDN หน้า Next.js โดยเคารพ `Cache-Control` ที่ Next.js ส่ง (ISR/`revalidateTag`
ตามค่าเริ่มต้นของ starter) ห้าม cache path ที่มี cookie ของ customer (`/account`, `/cart`, `/checkout`)
storefront ตั้ง `images.unoptimized: true` อยู่แล้ว จึงโหลดรูปจากโดเมน CDN ได้โดยไม่ต้องเพิ่ม `remotePatterns`

## ลำดับ release (backend ก่อน storefront)
ใช้ทุก release และ**บังคับ**เมื่อ migration หรือ field ของ search index เปลี่ยน (เช่น `PRICE_CURRENCIES`, spec 01 กฎข้อ 15):
1. `medusa db:migrate` (compose prod: service `migrate` รันก่อน server/worker ด้วย `service_completed_successfully`)
2. รีสตาร์ต backend ทั้ง server และ worker ด้วย image ใหม่ — search index ถูก reindex ตอนบูต
3. ตรวจว่า index มี field ใหม่แล้ว: `POST /store/search` (query ว่าง) คืน hit ที่มี field นั้น (เช่น `min_price_thb`)
4. จึงปล่อย storefront (compose prod: storefront รอ server `service_healthy` — แต่ healthy ไม่ได้แปลว่า reindex เสร็จ จึงต้องทำข้อ 3)
ปล่อย storefront ก่อนข้อ 3 → หน้า `/store` query field ที่ยังไม่มีใน index

## เงินถูกตัดแต่ไม่มี order (ADR-015)
ที่มา: Medusa 2.22.1 ลบ payment session ได้แม้ PaymentIntent (PI) `succeeded` แล้ว (ADR-015, spec 06 กฎข้อ 7) guard บน
`POST /store/payment-collections/:id/payment-sessions` ตอบ 409 `PAYMENT_ALREADY_COMPLETED` แทนการลบ แต่ยังเหลือ race สั้นๆ ที่ owner ยอมรับ
ops ทำตามหัวข้อนี้ด้วยมือ — payment ที่มีอยู่ใน Medusa refund ด้วย script `refund-orphan-payment` ซึ่งเรียก `refundPaymentsWorkflow` ของ Medusa
(ADR-015 ภาคผนวก 2) ระวัง: Medusa เองอาจ refund ให้แล้วเมื่อ complete cart ล้มหลัง capture (ดูหัวข้อ "ไม่มี alert" ข้อ 3)
ใช้ Stripe account แยกต่อ environment (test/staging/prod) ไม่เช่นนั้น webhook ของ environment อื่นทำให้ alert ผิด

### มี alert `PAYMENT_WEBHOOK_SESSION_NOT_FOUND`
subscriber `apps/backend/src/subscribers/payment-webhook-orphan.ts` เขียน log ระดับ error หนึ่งบรรทัดขึ้นต้นด้วย
`PAYMENT_WEBHOOK_SESSION_NOT_FOUND` (มี `provider`, `session_id`, `amount`, `payment_intent`) และส่งอีเมลหา `OPS_ALERT_EMAIL`
(ไม่ตั้ง env = มีแต่ log พร้อม warning — ตั้งค่าใน env ของ server และ worker) Medusa ลบ session แบบ hard delete จึงไม่มี
`payment_collection_id`/`cart_id` ใน alert — ใช้อีเมลลูกค้าใน Stripe แทน
1. ค้นหา PI ใน Stripe dashboard ด้วยค่า `payment_intent` จาก alert (account และ mode ให้ตรงกับ environment) ตรวจว่า `succeeded`,
   จำนวนเงิน และ `metadata.session_id` ตรงกับ alert จดอีเมลลูกค้าจาก billing details — ดู Refunds ของ PI ก่อนเสมอ (PI ยังแสดง `succeeded`
   แม้ refund ครบแล้ว) ถ้า refund ครบแล้ว ข้ามข้อ 3 ไปแจ้งลูกค้าและบันทึก incident
2. ยืนยันว่าไม่มี order อ้าง PI นี้: `GET /admin/payments?payment_session_id=<session_id>` ต้องได้ `payments: []` (ไม่มี payment ใน Medusa
   = ไม่มี order) และใน admin → Orders ค้นด้วยอีเมลลูกค้าช่วงเวลาเดียวกัน ไม่พบ order ที่ payment อ้าง PI นี้ — ถ้าพบ order **หยุด** ไม่ต้อง refund
   ถ้าได้ payments ไม่ว่าง (เช่น compensation ของ `completeCartWorkflow` ลบ session เดิมแล้วสร้าง session ใหม่ทั้งที่ refund ล้มเงียบ → payment captured
   ค้างอยู่ใน Medusa) → ทำตามหัวข้อ "ไม่มี alert" ข้อ 3–4 (ตรวจก่อน refund + script `refund-orphan-payment`) **ห้ามใช้ Stripe dashboard**
3. refund เต็มจำนวนใน Stripe dashboard (หน้า PI → Refund) — ใช้ได้เฉพาะเมื่อข้อ 2 ได้ `payments: []` (PI ไม่มี payment ใน Medusa — session ถูกลบ script จึงหา payment
   ไม่ได้) ตามข้อยกเว้นของ spec 06 กฎข้อ 4 ใน ADR-015
4. แจ้งลูกค้า (อีเมลจากข้อ 1): การชำระไม่สำเร็จเป็นคำสั่งซื้อ คืนเงินเต็มจำนวนแล้ว cart ยังอยู่ สั่งซื้อใหม่ได้
5. บันทึก incident: PI, `session_id`, จำนวนเงิน, อีเมลลูกค้า, เวลาใน alert, เวลา refund และผู้ทำ

### ไม่มี alert: payment captured แต่ collection ไม่ผูก order (ลูกค้าแจ้งว่าถูกตัดเงินแล้วไม่มี order)
กรณีที่ guard ตอบ `PAYMENT_ALREADY_COMPLETED` แล้ว (Medusa มี payment captured บน payment collection ของ cart ที่ยังไม่ complete) แต่ webhook
ไม่มาหรือ complete cart ล้ม และลูกค้าปิดหน้าไปก่อน — session ยังอยู่จึงไม่มี alert
1. ค้นหา PI ใน Stripe dashboard ด้วยอีเมลลูกค้า (`succeeded`) แล้ว `GET /admin/payments?payment_session_id=<metadata.session_id ของ PI>` ต้องพบ
   payment captured และใน admin → Orders ไม่มี order ของลูกค้าที่ payment อ้าง PI นี้
2. ให้ลูกค้า login แล้วเปิดหน้า checkout ของ cart นั้นอีกครั้งที่ขั้น review (`/<country>/checkout?step=review`) แล้วกดปุ่มชำระ PromptPay —
   storefront เรียก `POST /store/carts/:id/complete` ของ Medusa เป็นทางสำรอง (spec 06 AC-12b) ได้ order แล้วไปหน้า order confirmed
   (ห้ามให้ลูกค้าเปลี่ยนวิธีชำระหรือสแกน QR ใหม่)
3. complete ไม่ได้ (กดแล้วยังค้างที่หน้ารอสร้าง order) → **ตรวจก่อน refund**: `completeCartWorkflow` ของ Medusa 2.22.1 มี
   `compensatePaymentIfNeededStep` ที่ refund payment ที่ captured ให้อัตโนมัติเมื่อ complete ล้มหลัง capture (refund มี note
   "Refunded due to cart completion failure") — ดู `refunds` จาก `GET /admin/payments/:id` (id จากข้อ 1) และส่วน Refunds ของ PI
   ใน Stripe dashboard (ดูอย่างเดียว) ถ้า refund ครบจำนวนแล้ว ข้ามข้อ 4
4. ยังไม่ refund → รันบน container ของ server หรือ worker (env เดียวกับ production):
   `npx medusa exec ./src/scripts/refund-orphan-payment.ts <payment_id>` — refund ส่วนที่เหลือผ่าน `refundPaymentsWorkflow` ของ Medusa
   (provider เรียก Stripe ให้ และบันทึก refund ใน Medusa) รันซ้ำได้ (refund ครบแล้วจะข้าม); script ปฏิเสธ payment ที่ยังไม่ captured และ
   payment ที่ผูก order แล้ว (ใช้ refund ใน admin ของ order แทน) ด้วย exit ≠ 0; ถ้า script แจ้งว่า refund ไม่สำเร็จ ดู log ของ provider
   และ `refunds` อีกครั้ง (อาจชนกับ refund อัตโนมัติที่เกิดพร้อมกัน — Medusa กันไม่ให้ refund เกินยอดที่ capture) แล้วรันใหม่
   — `POST /admin/payments/:id/refund` ใช้ไม่ได้ เพราะ `refundPaymentWorkflow` ต้องมี order ผูกกับ payment collection ห้าม refund ใน Stripe dashboard
   (Medusa จะไม่รู้ว่า refund แล้ว: Stripe provider 2.22.1 ไม่รับรู้ `charge.refunded`)
5. ปิดทางที่ cart เดิมจะถูก complete ทีหลังด้วย payment ที่ refund แล้ว:
   - ให้ลูกค้า logout ก่อน (storefront ลบ cookie ของ cart เดิม) แล้วค่อย login เริ่ม cart ใหม่ — ห้ามกลับไปกดชำระบน cart เดิม
     (storefront จะเรียก complete กับ session ที่ authorized ตาม AC-12b)
   - Stripe retry webhook ที่ส่งไม่สำเร็จได้นานถึง 3 วัน (live mode) → `payment_intent.succeeded` ที่มาช้าจะ complete cart นี้ได้ ops เฝ้า
     admin → Orders (อีเมลลูกค้า / PI นี้) ทุกวันจนพ้นช่วง retry ถ้ามี order อ้าง PI ที่ refund แล้ว: **ห้าม fulfill**, ติด note ใน order แล้ว
     escalate ให้ owner — **ห้าม cancel** order ใน admin เพราะ `cancelOrderWorkflow` จะ refund payment ผ่าน provider อีกรอบ
6. แจ้งลูกค้าและบันทึก incident เหมือนหัวข้อก่อน (เพิ่ม payment id, ผลของข้อ 3–4 และวันที่พ้นช่วง retry)

### guard fail closed ถาวร (retrieve PI ไม่ได้)
อาการ: ลูกค้าที่ cart มี session Stripe เดิมสร้าง session ใหม่ไม่ได้ทุกครั้ง (ไม่ใช่ 409 แต่เป็น error 5xx) และ log ของ backend มี error ของ Stripe
provider ตอนอ่าน PI เดิม — guard ไม่ลบ session ที่ไม่รู้สถานะ (ADR-015 A ข้อ 3) จึงค้างจนกว่าจะอ่าน PI ได้
1. Stripe ล่มชั่วคราว (ดู status.stripe.com) → ไม่ต้องแก้ ลูกค้าลองใหม่ได้เมื่อ Stripe กลับมา
2. key ผิด account/mode (`No such payment_intent`, authentication error) → แก้ `STRIPE_API_KEY` ให้เป็น account/mode ที่สร้าง PI นั้นแล้ว restart
   server และ worker จากนั้นลูกค้าลองใหม่
3. PI อ่านไม่ได้จริง (เช่น account เดิมเลิกใช้): ตรวจใน Stripe dashboard ของ account เดิม (ถ้าเข้าได้) ว่าไม่มี PI ที่ `succeeded` ของลูกค้า
   (ถ้ามี → ทำตามหัวข้อ "มี alert" ข้อ 3–5) แล้วให้ลูกค้าเริ่ม cart ใหม่: logout (storefront ลบ cookie ของ cart เดิม) → login → เพิ่มสินค้า
   แล้ว checkout ใหม่ cart เดิมค้างไว้โดยไม่มีผล
- Medusa 2.22.1 ไม่มี route ลบ payment session; `POST /admin/payment-collections/:id/payment-sessions` และ `paymentModule.deletePaymentSession`
  (เช่นผ่าน script `medusa exec`) ก็ cancel PI เดิมผ่าน provider ก่อนลบ จึงล้มด้วยสาเหตุเดียวกัน — วิธีที่ใช้ได้โดยไม่เขียนโค้ดใหม่คือให้ลูกค้าเริ่ม cart ใหม่ (ข้อ 3) — และห้ามใช้ route นี้กับ session ที่ PI `succeeded` (ลบ session ที่ชำระแล้ว = ปัญหาเดิมของ
  ADR-015) ห้ามแก้ตาราง payment ใน DB ตรง

## ตรวจสอบ
- `pnpm --filter backend test:unit` — `src/__tests__/medusa-config.infra.unit.spec.ts`
- `pnpm --filter backend test:unit` — `src/__tests__/ops-runbook.unit.spec.ts` (หัวข้อ ADR-015 และ `OPS_ALERT_EMAIL`)
- `tools/ops/smoke-worker-mode.sh` — product ที่สร้างบน server ต้องถูกประมวลผลโดย subscriber บน worker
