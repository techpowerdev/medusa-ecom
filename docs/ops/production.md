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

## Redis ของ event bus ขาด (OPS-8, ADR-012)
smoke test: `tools/ops/smoke-redis-outage.sh` (AC-5 ของ spec 07) — บูต compose prod แบบแยก project, `docker pause`
Redis 30 วินาทีแล้ว unpause จากนั้นตรวจว่า event ที่ server emit หลัง unpause ถูก subscriber บน worker ประมวลผลภายใน
60 วินาที (หรือ worker จบ process แล้วถูก restart แล้วประมวลผลได้) — ถ้า worker ค้างทั้งที่ `/health` ตอบ 200 script จะ fail
```bash
tools/ops/smoke-redis-outage.sh                                  # postgres/redis ภายใน project (default ops8test)
SMOKE_PROJECT=medusa-ops8 SMOKE_DATABASE_URL="postgres://medusa:medusa@host.docker.internal:5432/medusa_ops8?sslmode=disable" \
  tools/ops/smoke-redis-outage.sh                                # ใช้ DB ที่สร้างไว้แล้วบน postgres ของ dev แทน
```
- `SMOKE_DATABASE_URL` ต้องชี้ไป DB ที่สร้างไว้สำหรับ smoke โดยเฉพาะ (เช่น `medusa_ops8`) **ห้ามชี้ไป DB `medusa` ของ dev**
  (script รัน migration และสร้าง admin/product ลงไป) และ `host.docker.internal` ใช้ได้เฉพาะ Docker Desktop
  (Linux/CI ต้องใช้ IP ของ host หรือไม่ตั้งตัวแปรนี้)
- `SMOKE_PROJECT` ห้ามขึ้นต้นด้วย `medusa-ecom` (script ปฏิเสธ) เพราะ cleanup รัน `down -v` ซึ่งจะลบ volume ของ dev
- `KEEP_UP=1` เก็บ container ไว้ดูหลังรัน; รันซ้ำบน container เดิมได้เพราะ script นับ log เป็นส่วนต่าง
  เก็บกวาดเองด้วย `docker compose -p <project> -f docker-compose.prod.yml down -v` (ทั้ง `smoke-redis-outage.sh` และ `smoke-worker-mode.sh`)
ผลบน Medusa 2.22.1 / bullmq 5.13.0: ผ่านโดยไม่ต้องตั้ง `redisOptions`/`workerOptions` เพิ่ม — Redis ที่ถูก pause ยังรับ TCP
handshake (kernel ตอบแทน) คำสั่งจึงแค่ค้างแล้วทำงานต่อหลัง unpause ไม่เกิด `ETIMEDOUT`
(ผลทดลองทั้งหมด: `docs/evidence/ops/OPS-8-tests.txt`)

**ความเสี่ยงที่เหลือ** (ทำซ้ำในเครื่องไม่ได้ เคยเห็นครั้งเดียวตอนเครื่องโหลดหนัก — PR #27): ถ้า connection แรกของ BullMQ worker
ของ event bus ต่อ Redis ไม่สำเร็จตอนบูต (เช่น event loop ค้างเกิน connectTimeout 10 วินาที → `ETIMEDOUT`) worker จะหยุดถาวร
พร้อม log `Error running event bus worker: Connection is closed.` ขณะที่ `GET /health` ยังตอบ 200 → orchestrator ไม่ restart ให้
และ event (order placed, payment captured ฯลฯ) ค้างใน queue
- ต้องตั้ง **alert จาก log `Error running event bus worker`** บน process worker — กฎอยู่ในหัวข้อ "Alerts" (OPS-3)
- เมื่อ alert ดังให้ restart worker (orchestrator/on-call) — job ที่ค้างอยู่ใน Redis จะถูกประมวลผลหลัง restart
- เราไม่แตะ internal ของ module event bus ของ Medusa และไม่เพิ่ม health route (ADR-012 ข้อ 3–4)

## Alerts
log ของ backend เป็น JSON บรรทัดละหนึ่ง object (`NODE_ENV` ที่ไม่ใช่ development) ผ่าน logger ใน `apps/backend/src/lib/json-logger.ts`
(OPS-3, spec 07 AC-18) — format เดียวกับ logger ของ Medusa (`level`, `message`, `timestamp`, `stack` เมื่อมี error) และเพิ่ม field
`worker_mode` (`server` / `worker` / `shared`) จาก env `MEDUSA_WORKER_MODE` ของ container นั้น — ยกเว้นคำสั่ง `medusa db:*` (service `migrate` ของ compose prod
รวม process ลูกที่ Medusa fork) ได้ `worker_mode: "migrate"` เสมอ (OPS-31: `medusa db:migrate` ตั้ง `MEDUSA_WORKER_MODE=server` เองก่อนโหลด config) `LOG_LEVEL`/`LOG_FILE` ใช้ได้ตามเดิม
access log ของ HTTP (`request_id`, `status`, `duration` — จาก header `x-request-id` หรือ uuid ที่ Medusa สร้าง) Medusa เขียนเองโดยไม่ผ่าน
logger นี้ จึงไม่มี `worker_mode` (มีเฉพาะบน server อยู่แล้ว)
access log ออกที่ระดับ `http` → ต้องใช้ `LOG_LEVEL=http` (ค่าเริ่มต้นของ `docker-compose.prod.yml` ตั้งแต่ OPS-30) หรือละเอียดกว่า (`debug`);
ตั้ง `LOG_LEVEL=info` (หรือ `warn`/`error`) จะไม่มี access log เลย (OPS-M-06)
Medusa ไม่เขียน access log ของ `/health` ทุกระดับ (healthcheck ของ compose/load balancer จึงไม่ท่วม log) — ทดสอบว่ามี access log ด้วย route อื่น
เช่น `GET /admin/users/me` ไม่มี token (ได้ 401; CI ตรวจใน job `docker-worker-mode`)

| alert | เงื่อนไข (ตั้งใน log shipper / log platform ที่ใช้) | ระดับ | ขั้นตอนตอบสนอง |
|---|---|---|---|
| event bus worker หยุด (ADR-012 ภาคผนวก) | `worker_mode == "worker"` และ `level == "error"` และ `message` มีสตริง `Error running event bus worker` — แจ้งทันทีตั้งแต่บรรทัดแรก | critical | restart worker (container/process `MEDUSA_WORKER_MODE=worker`) แล้วตรวจตามด้านล่าง |

ขั้นตอนเมื่อ alert event bus worker ดัง:
1. restart worker — `GET /health` ยังตอบ 200 orchestrator จึงไม่ restart ให้เอง (ADR-012) เช่น
   `docker compose -f docker-compose.prod.yml restart worker`
2. ตรวจ log ของ worker หลัง restart ว่าไม่มี `Error running event bus worker` ซ้ำ และ Redis ตอบ (`redis-cli -u $REDIS_URL ping`)
3. job ที่ค้างใน Redis ถูกประมวลผลหลัง restart — ตรวจผลปลายทาง เช่น order ล่าสุดได้อีเมล/e-voucher
4. ถ้าเกิดซ้ำ: บันทึก log จริงแล้วเปิด ADR-012 พิจารณาทางเลือก B ใหม่ (ภาคผนวก "ผลที่ตามมาเพิ่ม")

## Prod guards (OPS-7, ADR-010)
backend ที่ `NODE_ENV=production` (image ตั้งให้แล้ว และ `medusa start` ตั้งเป็นค่า default) **บูตไม่ขึ้น** เมื่อ:
- ขาด `RESEND_API_KEY` หรือ `RESEND_FROM_EMAIL` (ไม่งั้นอีเมลลูกค้าตกไปที่ provider `local` แบบเงียบ ๆ) — ยกเว้นตั้ง `ALLOW_TEST_PROVIDERS=true`
- `EVOUCHER_ENCRYPTION_KEY` ว่างหรือไม่ใช่ 64 hex (กุญแจเข้ารหัส code/PIN ของ e-voucher, `openssl rand -hex 32`, OPS-21) — `ALLOW_TEST_PROVIDERS=true` ไม่ปิด guard นี้
- ขาด `AFFILIATE_TOKEN_SECRET` (secret ของ cookie `aff`, spec 05 กฎ 22)
- `STOREFRONT_URL` ไม่ใช่ URL `http(s)://` ที่ parse ได้ (ลิงก์ชำระเงินในอีเมล group buy ของ GB-4)

นอก production ตัวแปรสองตัวหลังที่ว่างจะ log warning ครั้งเดียวตอนบูต (ไม่ log ต่อ request)
production ที่ไม่ตั้ง `EVOUCHER_ADMIN_EMAIL` หรือ `OPS_ALERT_EMAIL` ยังบูตได้ แต่ log warning ตัวละครั้งตอนบูต และอีเมลแจ้งเตือนถูกข้าม (spec 02 กฎข้อ 9, ADR-015)
seed (`pnpm --filter backend seed`) ใน production เปิดเฉพาะ `pp_stripe_stripe` และ `pp_stripe-promptpay_stripe` ให้ region Thailand
(ไม่เปิด `pp_system_default` = manual payment ที่สั่งซื้อได้โดยไม่จ่ายเงินจริง)

`ALLOW_TEST_PROVIDERS=true` ปิด guard ของ provider ทดสอบ (อีเมล + seed) — ใช้กับ CI/smoke/staging เท่านั้น **ห้ามตั้งใน prod**
(job `storefront-e2e` และ `docker-worker-mode` ใน `ci.yml` ตั้งไว้เพราะรันโหมด production โดยไม่มี Resend key และ e2e ใช้ manual payment)
ค่าอื่นนอกจาก `true` ไม่ปิด guard; ไม่ปิด guard ของ `AFFILIATE_TOKEN_SECRET`/`STOREFRONT_URL`/`EVOUCHER_ENCRYPTION_KEY`
backend ที่บูตใน production พร้อม `ALLOW_TEST_PROVIDERS=true` จะ log warn หนึ่งครั้งตอนบูต (`[medusa-config] ALLOW_TEST_PROVIDERS=true in production ...`, OPS-13)

## Stripe webhooks
สร้าง webhook endpoint ใน Stripe Dashboard **ตัวเดียว** ต่อ environment: `https://<backend>/hooks/payment/stripe_stripe`
รับ event ของทั้งบัตร (`pp_stripe_stripe`) และ PromptPay (`pp_stripe-promptpay_stripe`) แล้วตั้ง `STRIPE_WEBHOOK_SECRET` = signing secret ของ endpoint นี้ (ADR-023)
**ห้าม**ลงทะเบียน `/hooks/payment/stripe-promptpay_stripe` แม้ตาราง provider ใน Medusa docs จะแสดง URL ต่อ provider — เหตุผล: Stripe ออก signing secret
คนละค่าต่อ endpoint แต่ `@medusajs/payment-stripe` ทุก provider ตรวจ signature ด้วย `STRIPE_WEBHOOK_SECRET` ค่าเดียว endpoint ที่สองจึงตรวจ signature ไม่ผ่านทุก event
(error ใน log × retry ของ event bus) ส่วน Stripe กรอง event ตาม payment method ไม่ได้อยู่แล้ว และ Medusa ประมวลผล event ด้วย `metadata.session_id`
ไม่ดู provider ของ path — event PromptPay ที่เข้า `stripe_stripe` จึง authorize/capture ผ่าน provider PromptPay ตามเดิม (กันด้วย integration test
`stripe-webhook.spec.ts`, PAY-7 — ต้องผ่านทุกครั้งที่ bump `@medusajs/*`)
endpoint สมัคร event ตามรายการด้านล่าง = event ที่ `getWebhookActionAndData` ของ `@medusajs/payment-stripe` 2.22.1 จัดการ
(event อื่นได้ `not_supported` — สมัครเกินไม่พังแต่เปลือง request) ทุก event ต้องมี `metadata.session_id` ที่ Medusa ใส่ตอนสร้าง PaymentIntent
ไม่งั้นถูกนับเป็น `not_supported`
- `payment_intent.created` — pending (หรือ pending authorization เมื่อเป็น async payment method)
- `payment_intent.processing` — เหมือน `created`
- `payment_intent.requires_action` — requires more (เช่น รอสแกน QR PromptPay / 3DS)
- `payment_intent.partially_funded` — requires more
- `payment_intent.amount_capturable_updated` — authorized
- `payment_intent.succeeded` — successful (complete cart / capture)
- `payment_intent.payment_failed` — failed
- `payment_intent.canceled` — canceled

รายการนี้ต้องเท่ากับ `events=` ของขั้น `stripe listen` ใน `.github/workflows/ci.yml` (ตรวจใน job `lint-typecheck` ด้วย
`tools/ci/check-stripe-events.sh`, OPS-10) — bump `@medusajs/*` ให้ตรวจ `getWebhookActionAndData` ใหม่แล้วแก้ทั้งสองที่

## Go-live checklist
ทำครบทุกข้อก่อนเปิดร้านจริง และรันข้อ 4 ซ้ำหลังแก้ตั้งค่า payment ใน admin ทุกครั้ง (D1 ไม่กัน admin เปิด manual payment เองภายหลัง)
1. env ของ server และ worker ครบตามหัวข้อ "Prod guards" และ `docs/spec/07-scaling-ops.md` ข้อ 9 (`TZ=UTC`, `EVOUCHER_ENCRYPTION_KEY`, `EVOUCHER_ADMIN_EMAIL`, `OPS_ALERT_EMAIL` ฯลฯ — `docker-compose.prod.yml` ส่งให้ทั้ง migrate/server/worker)
2. `STRIPE_API_KEY` เป็น live key และ `STRIPE_WEBHOOK_SECRET` มาจาก webhook endpoint `https://<backend>/hooks/payment/stripe_stripe` ของ live mode
   ซึ่งเป็น endpoint **เดียว**ของ backend นี้ (สมัคร event ตามหัวข้อ "Stripe webhooks", ADR-023) — environment ที่เคยสร้าง endpoint
   `stripe-promptpay_stripe` ไว้ ให้ลบใน Dashboard
3. `ALLOW_TEST_PROVIDERS` ต้องไม่มีค่า — "ไม่ตั้ง" กับ "ตั้งเป็นค่าว่าง" (`ALLOW_TEST_PROVIDERS=`) นับเหมือนกัน (ผ่าน); ค่าใด ๆ ที่ไม่ว่าง
   (รวม `false`, `0`) `check:go-live` นับว่าไม่ผ่าน
4. รันบน container ของ server หรือ worker (env เดียวกับ production):
   ```bash
   pnpm --filter backend check:go-live      # ใน image: npx medusa exec ./src/scripts/check-go-live.ts
   ```
   ตรวจ `NODE_ENV=production`, `ALLOW_TEST_PROVIDERS` ไม่มีค่า ("ไม่ตั้ง" กับ "ตั้งเป็นค่าว่าง" นับเหมือนกัน ตามข้อ 3), `STRIPE_API_KEY` ไม่ว่างและไม่ขึ้นต้นด้วย `sk_test_`/`rk_test_`,
   ไม่มี region ใดเปิด `pp_system_default` และ `datctype` ของ DB ไม่เป็น `C`/`POSIX` (ข้อ 10) — ไม่ผ่านข้อใดพิมพ์ `check:go-live FAIL ...` ทีละข้อและ exit code ≠ 0; ผ่านครบ exit 0
   (region ที่ seed สร้างก่อน OPS-7 หรือ admin เปิดเองยังมี `pp_system_default` → ปิดใน admin → Settings → Regions แล้วรันใหม่)
5. ค่าส่ง placeholder (Q-F1 ใน `docs/spec/01-core-medusa.md` ยังไม่ตัดสิน): seed ตั้งราคา shipping option "Standard" และ return option "Standard return" จาก `shipping_rate` (`DEFAULT_REGION_STORE_POLICIES`) = 10 THB placeholder — owner ตัดสินค่าจริงแล้วแก้ใน admin ก่อนเปิดร้าน (ราคาของ shipping option "Standard" และ "Standard return" แก้ที่ Settings → Locations & Shipping → location → service zone → shipping option นั้น → Edit prices; `shipping_rate` ที่หน้า storefront แสดงแก้ที่ Settings → Regions → region นั้น → Metadata — แก้ทั้งสองที่ให้ตรงกัน)
6. บัญชี Stripe (live) เป็นนิติบุคคลไทยและเปิดใช้ PromptPay แล้ว (spec 06 Q1 — owner ยังไม่ยืนยัน 2026-11-09; ระหว่างนี้ใช้ test mode) — ตรวจใน Stripe Dashboard → Settings → Payment methods ว่า PromptPay เป็น "On" ก่อนเปิดร้าน
7. เปิด backup รายวันของ Postgres และซ้อม restore สำเร็จตาม `docs/ops/database.md` หัวข้อ "Backup และ restore ของ Postgres" (spec 07 AC-4) — เก็บ `EVOUCHER_ENCRYPTION_KEY` ใน secret manager แยกจาก backup
8. ตรวจ webhook endpoint เดียวด้วยมือ (ADR-023 — `check:go-live` ไม่เรียก Stripe API) บน staging/test mode ก่อน แล้วตรวจรายการ endpoint ซ้ำใน live:
   (1) Stripe Dashboard → Developers → Webhooks มี endpoint ของ backend นี้ตัวเดียวคือ `/hooks/payment/stripe_stripe`;
   (2) จ่ายพร้อมเพย์ (confirm PI ใน test mode) → ได้ order `payment_status=captured`; (3) จ่ายบัตร `4242…` → ได้ order;
   (4) log ของ server/worker ไม่มี `An error occurred in constructWebhookEvent` และไม่มี `payment-webhook-orphan: skipped`;
   (5) Dashboard แสดง delivery ของ endpoint ตอบ 200
9. admin และ store API เข้าผ่าน **HTTPS** เท่านั้น (spec 07 Deliverables ข้อ 11): `NODE_ENV=production` ตั้ง session cookie เป็น `Secure`
   → request ที่ไม่ใช่ https ไม่ได้ `Set-Cookie` และ login admin ไม่ติด; terminate TLS ที่ reverse proxy/load balancer ชั้นเดียวได้
   (Medusa ตั้ง `trust proxy` = 1) โดย proxy ต้องส่ง header `X-Forwarded-Proto: https` มาที่ server; ห้ามตั้ง `cookieOptions.secure: false`
   ทดสอบแบบ prod-like ในเครื่อง (`docker-compose.prod.yml` หรือ `medusa start` ของ build production) ก็เช่นกัน: เข้าผ่าน tunnel/reverse proxy ที่มี TLS
   หรือ proxy ที่ส่ง `X-Forwarded-Proto: https` — เปิด `http://localhost:9000` ตรง ๆ จะ login admin ไม่ได้ (OPS-M-12)
10. Postgres ของ prod ต้องมี `LC_CTYPE` ที่ไม่ใช่ `C`/`POSIX` (เช่น `en_US.utf8` หรือ `th_TH.utf8`) — `pg_trgm` ทิ้งอักษรไทยเมื่อ `LC_CTYPE=C` ทำให้ค้นคำไทยกลางคำไม่เจอ (CORE-75); `check:go-live` ตรวจข้อนี้ให้อัตโนมัติ (`datctype` ของ DB ปัจจุบันเป็น `C`/`POSIX` → FAIL — OPS-33, owner ยืนยัน 2026-11-21) หรือตรวจเองด้วย:
    `psql "$DATABASE_URL" -c "SELECT datname, datctype FROM pg_database WHERE datname = current_database();"` — เป็น `C` → สร้าง DB ใหม่ด้วย locale ที่ถูกแล้ว restore (ตั้งที่ `initdb`/`CREATE DATABASE … LC_CTYPE`)
11. แปลงอีเมลเดิมเป็นตัวเล็กก่อนเปิดร้าน (บัญชีที่สร้างก่อนแปลงอีเมลจะ login ไม่ได้ — CORE-73/CORE-80; CORE-81) รันบน container ของ server หรือ worker:
    ```bash
    npx medusa exec ./src/scripts/lowercase-emails.ts          # dry-run: พิมพ์จำนวน + id ที่ต้องแปลงต่อตาราง ไม่แก้ข้อมูล
    npx medusa exec ./src/scripts/lowercase-emails.ts apply    # แปลงผ่าน workflow (ล้มกลางทาง → คืนค่าเดิมครบ)
    npx medusa exec ./src/scripts/lowercase-emails.ts          # ต้องได้ 0 แถวทุกตาราง
    ```
    ใช้คำ `apply` (ไม่มีขีด) — `medusa exec` ปฏิเสธ flag ที่ไม่รู้จัก (`--apply` → `Unknown argument`); แปลงเฉพาะ `customer.email`, `affiliate.email`
    และ identity `emailpass` ที่ผูก customer/affiliate — identity ของแอดมินไม่แตะ (Q-C13 = ก); พิมพ์เฉพาะ id ไม่พิมพ์อีเมล
    ถ้าพิมพ์ `ชน <ตาราง>: <id>, <id>` และ exit ≠ 0 = มีอีเมลที่ต่างกันแค่ตัวพิมพ์ภายใต้ unique เดิม (`provider_identity (entity_id, provider)`,
    `customer (email, has_account)`, `affiliate.email`; identity ที่ soft-delete แล้วนับด้วยเพราะ index นี้ไม่ใช่ partial) — script ไม่แก้อะไรและไม่รวมบัญชีเอง: owner ตัดสินว่าเก็บบัญชีไหนแล้วแก้คู่ที่ชนด้วยมือก่อนรันใหม่;
    apply ล้มด้วย `ชน unique index ระหว่าง apply` (มีคนสมัครแทรก) = workflow คืนค่าเดิมทุกตารางแล้ว — รัน dry-run ใหม่
12. backfill ธง `evoucher_backordered` ของ order ก่อน EV-22 (badge backordered ใน admin ไม่ขึ้นถ้าไม่รัน — EV-25): ใน container ของ backend (`apps/backend`)
    `npx medusa exec ./src/scripts/backfill-evoucher-backordered-flags.ts` (dry-run พิมพ์ order/line ที่จะแก้) →
    `npx medusa exec ./src/scripts/backfill-evoucher-backordered-flags.ts apply` (log จำนวนก่อน/เขียน/หลัง — หลังต้องเป็น 0) → dry-run ซ้ำได้ `พบ 0 line`
    (ใช้คำ `apply` ไม่ใช่ `--apply` — `medusa exec` เป็น yargs strict ปฏิเสธ option ที่ไม่รู้จักด้วย `Unknown argument`)
13. log ของ prod ไม่มี PII: ยืนยันว่า image มี OPS-33 (redact ใน `json-logger.ts`) แล้วค้น log ของ log platform ด้วยอีเมลลูกค้าทดสอบที่จ่ายแล้วถูกคืนเงิน (บรรทัด `recreate a payment session`) — ต้องไม่พบ
14. วัดเวลา `POST /store/search` (body เดียวกับ storefront, คำค้นไทย 2–3 คำ + คำว่าง) กับ catalog ขนาดจริงบน DB ของ prod/staging แล้วบันทึก p95 — ถ้าสินค้าเกิน ~10,000 รายการ
    (หรือ p95 เกิน 300ms) ต้องเขียน ADR เรื่องวิธีค้นหา (index/ provider) ก่อนเปิดร้าน (qa #465 — `typo_tolerance` ใช้ similarity ของ `pg_trgm` ทั้งตาราง)

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
`provider` ใน alert คือ path ของ webhook endpoint (`stripe_stripe` เสมอ — ADR-023) ไม่ใช่ provider ของ session อย่าใช้ตัดสินว่าเป็นบัตรหรือ PromptPay
— ดู `payment_method_types` ของ PI ใน Stripe Dashboard จากค่า `payment_intent`
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

### group buy: เงินเข้าแต่ไม่มี order (alert `GROUP_BUY_PAID_WITHOUT_ORDER`)
subscriber `apps/backend/src/subscribers/group-buy-payment-captured.ts` (GB-5, spec 04) เขียน log ระดับ error ขึ้นต้นด้วย `GROUP_BUY_PAID_WITHOUT_ORDER`
(`reason`, `membership_id`, `order_id`, `payment_id`, `amount`, `error`) และส่งอีเมลหา `OPS_ALERT_EMAIL` ครั้งเดียวต่อ membership + เหตุ
(idempotency key `<membership_id>:<reason>` — membership เดียวอาจได้ 2 ฉบับถ้าเจอทั้งสองเหตุ) subscriber อ่านสถานะใหม่ก่อนส่งและข้าม (log info
`GROUP_BUY_PAID_WITHOUT_ORDER skipped`) ถ้าไม่ใช่เงินค้างแล้ว (GB-9 กฎข้อ 25)
0. **ขั้นแรกเสมอ** — ตรวจว่า order ยังเป็น draft และ membership ยังไม่ `paid`: เปิด order ด้วย URL ตรง `/app/orders/<order_id>` ใน admin
   (draft order ไม่อยู่ในรายการ Orders) ดูว่ายังเป็น draft และดูสถานะ membership ในหน้าแคมเปญ group buy ของ admin
   (`reason=membership_cancelled`: membership ต้องยัง `cancelled`) — ถ้าไม่ใช่ ถือว่า alert ผิด ปิด incident ห้าม refund
   (order ที่แปลงสำเร็จแล้วคือคำสั่งซื้อปกติของลูกค้า)

payment มีอยู่ใน Medusa และผูกกับ draft order ของกลุ่มแล้ว จึง refund ผ่าน admin ของ Medusa ได้ (`POST /admin/payments/<payment_id>/refund` /
ปุ่ม Refund ในหน้า order) — **ห้าม refund ใน Stripe dashboard** และห้ามใช้ script `refund-orphan-payment` (script ปฏิเสธ payment ที่ผูก order)
ก่อน refund ทุกครั้งดู `refunds` จาก `GET /admin/payments/<payment_id>` ถ้า refund ครบแล้วข้ามขั้น refund
- **order ที่ถูกยกเลิกแล้ว** (`reason=membership_cancelled`): route/ปุ่ม Refund ของ admin (`refundPaymentWorkflow`) คืนเงินที่ provider **ก่อน** แล้วจึงสร้าง credit line
  ซึ่งล้มด้วย `throwIfOrderIsCancelled` — ถ้า route ตอบ error **ห้ามกดคืนซ้ำ** ให้ตรวจยอดคืนก่อนเสมอ: `refunds` ใน `GET /admin/payments/<payment_id>`
  และ Refunds ของ PI ใน Stripe dashboard (ดูอย่างเดียว) ถ้ายอดคืนครบแล้วถือว่าคืนสำเร็จ บันทึกใน incident
- `reason=convert_failed` — capture ครบแต่ `convertDraftOrderWorkflow` ล้ม (ส่วนใหญ่สต็อกไม่พอ ดู `error`) membership ยังเป็น `awaiting_payment`,
  order ยังเป็น draft และ job หมดเวลาจะไม่ยกเลิก (collection `completed`) ไม่มีการลองใหม่อัตโนมัติ
  1. เติมสต็อกได้ → เติมใน admin → Inventory แล้วแปลงด้วย Medusa admin: Draft Orders → order นั้น → Convert to order
     (`POST /admin/draft-orders/<order_id>/convert-to-order`) จากนั้นตรวจว่า order อยู่ใน Orders และ fulfill ตามปกติ — membership ของกลุ่มยังแสดง
     `awaiting_payment` (ยังไม่มีทางอัปเดตจาก admin — follow-up ใน spec 04) ให้จดใน incident
  2. เติมสต็อกไม่ได้ → refund เต็มจำนวนตามวิธีด้านบน ห้าม convert หลัง refund
- `reason=membership_cancelled` — capture มาหลัง membership ถูกยกเลิก (หมดเวลาชำระ) order ถูกยกเลิกแล้วหรือกำลังถูกยกเลิก
  subscriber **คืนเงินอัตโนมัติก่อนส่ง alert** (GB-21, ADR-024 c — `refundPaymentsWorkflow` ของ Medusa ยอดคงเหลือ note `Refunded: group buy membership cancelled`)
  และ alert มี `refund_result` ที่ตัดสินจาก `refunds` ที่อ่านใหม่หลังคืนเงิน ห้ามคืนสถานะ membership เอง
  1. `refund_result=refunded` — ตรวจ `refunds` ใน `GET /admin/payments/<payment_id>` ว่ายอดคืนรวมเท่ายอดที่ capture (มี note ข้างบน) แล้วแจ้งลูกค้าและปิด incident ไม่ต้อง refund เพิ่ม
  2. `refund_failed` (เช่น Stripe ล่ม — log warn `group-buy-refund` มีสาเหตุ) — ตรวจ `refunds` ก่อนเสมอ (เงินอาจถูกคืนไปแล้วบางส่วนหรือทั้งหมด)
     แล้ว refund ยอดที่เหลือตามวิธีด้านบนและข้อ **order ที่ถูกยกเลิกแล้ว** (route อาจตอบ error ทั้งที่คืนเงินสำเร็จ)
  3. ไม่มี `refund_result` ในเหตุนี้ = subscriber เวอร์ชันก่อน GB-21 — ทำแบบข้อ 2
แล้วแจ้งลูกค้า (อีเมลของ order) ว่าแปลงเป็นคำสั่งซื้อแล้ว/คืนเงินแล้ว และบันทึก incident (membership, order, payment, จำนวนเงิน, `reason`, การดำเนินการ, ผู้ทำ)

## log ที่ดูเหมือนคืนเงินล้มแต่สำเร็จ (OPS-32)
ที่มา: `completeCartWorkflow` ล้ม**หลัง** Stripe ตัดเงินแล้ว (เช่น flash เกินสิทธิ์ `FLASH_LIMIT_EXCEEDED`, สินค้า/e-voucher หมด, step หลัง hook ล้ม) →
Medusa 2.22.1 `compensatePaymentIfNeededStep` คืนเงินเต็มจำนวนเอง (refund note "Refunded due to cart completion failure") แล้วสร้าง payment session
ใหม่ด้วย `data` ของ session เดิม ซึ่ง Stripe ปฏิเสธ → Medusa เขียน log ระดับ error สองบรรทัด**ทั้งที่คืนเงินสำเร็จแล้ว** (ADR-025 บริบท):
- `Encountered an error when trying to recreate a payment session - [object Object] - Error: An error occurred in InitiatePayment … Invalid string: {…}`
  (ท้ายบรรทัดมีข้อมูล billing ของลูกค้า — อย่าแปะ log นี้ลง ticket/แชตสาธารณะ; หลัง OPS-33 ค่าเหล่านี้ถูกแทนด้วย `[REDACTED]`)
- `Error was thrown trying to refund payment - <payment_id> - [object Object]`

ก่อนสองบรรทัดนี้ backend เขียน warn หนึ่งบรรทัดขึ้นต้น `CART_COMPLETION_FAILED_AFTER_PAYMENT` (`apps/backend/src/workflows/hooks/paid-completion-failure.ts`)
มี `cart_id`, `payment_session_id`, `payment_id` และ `code` (code ของ error เช่น `FLASH_LIMIT_EXCEEDED`; `STEP_AFTER_VALIDATE_FAILED` = step หลัง hook ล้ม
ดู error ของ workflow ในบรรทัดถัดไป) ใช้บรรทัดนี้เป็นจุดเริ่มตรวจ ไม่ใช่สอง log ของ Medusa
1. `GET /admin/payments/<payment_id>` (id จาก warn หรือจากบรรทัด `Error was thrown trying to refund payment`) → ดู `refunds`:
   มี refund note "Refunded due to cart completion failure" และยอดรวมเท่ายอดที่ capture = คืนเงินสำเร็จ
2. ยืนยันใน Stripe dashboard (ดูอย่างเดียว): หน้า PI ของ payment นี้ส่วน Refunds มี refund เต็มจำนวน
3. **ห้าม refund ซ้ำด้วยมือ** (ทั้ง Stripe dashboard และ script `refund-orphan-payment`) เมื่อข้อ 1–2 ครบแล้ว — ปิดเป็น incident ระดับข้อมูล (cart, payment, code)
   ลูกค้าเห็นรายการตัดเงินและคืนเงินคู่กันในบัตร/แอปธนาคาร
4. ข้อ 1 ไม่มี refund หรือยอดไม่ครบ (refund ที่ provider ล้มจริง) → ทำตามหัวข้อ "เงินถูกตัดแต่ไม่มี order (ADR-015)" กรณี "ไม่มี alert" ข้อ 3–4
5. ถ้าไม่มี warn แต่มีสอง log ของ Medusa (เช่น backend เวอร์ชันก่อน OPS-32) ให้ทำข้อ 1–4 เช่นกัน; ลูกค้าที่จ่ายใหม่ใน cart เดิม → ADR-025 (PAY-9)
6. ลูกค้าแจ้งว่า "หน้าบอกคืนเงินแล้วแต่ยังไม่เห็นในแอปธนาคาร": `FLASH_*`/สต็อกไม่พอล้ม**ก่อน** authorize ใน request ของ storefront จึงคืนเงินในเส้นทางของ webhook
   (`processPaymentWorkflow` → complete ล้ม → compensation) — ข้อความ `checkout-refunded-notice` อาจขึ้นก่อน refund จริงไม่กี่วินาที (spec 03 กฎข้อ 29) ตรวจตามข้อ 1–2 อีกครั้งหลัง 1–2 นาที ก่อนทำข้อ 4
7. หลัง PAY-9 (ADR-025) ลูกค้าที่จ่ายใหม่ใน cart เดิม: payment collection **เดิม** (ที่มี payment ถูกคืน) ถูกถอด link ออกจาก cart แล้ว**ไม่มีเจ้าของ** (ไม่ผูก cart/order — ไม่เห็นในหน้า order ของ admin)
   หลักฐานการคืนเงินดูจาก payment/refund เท่านั้น: `GET /admin/payments/<payment_id>` (id จาก warn `CART_COMPLETION_FAILED_AFTER_PAYMENT`) → `refunds` และ `payment_collection_id`;
   order ใหม่ของลูกค้ามีเฉพาะ collection ใหม่ (`payment_status=captured`) — ห้ามลบ collection เดิมหรือแก้ DB ตรง ห้าม refund ซ้ำ
ตอน bump `@medusajs/*` ตรวจว่าสอง log นี้ยังเกิด (spec 07 checklist bump ข้อ 11; integration `complete-after-payment-log.spec.ts`) แล้วปรับหัวข้อนี้

## ตรวจสอบ
- `pnpm --filter backend test:unit` — `src/__tests__/medusa-config.infra.unit.spec.ts`
- `pnpm --filter backend test:unit` — `src/__tests__/ops-runbook.unit.spec.ts` (หัวข้อ ADR-015, `OPS_ALERT_EMAIL` และ Alerts)
- `pnpm --filter backend test:unit` — `src/lib/__tests__/json-logger.unit.spec.ts` (`worker_mode` ใน log JSON)
- `pnpm --filter backend test:unit` — `src/__tests__/prod-guards.unit.spec.ts` (OPS-7 guards, env ใน `ci.yml`, หัวข้อ Go-live checklist)
- `pnpm --filter backend test:unit` — `src/__tests__/backup-runbook.unit.spec.ts` (runbook backup/restore ใน `docs/ops/database.md`, OPS-5)
- `pnpm --filter backend check:go-live` — checklist ก่อนเปิดร้าน (OPS-7)
- `tools/ops/smoke-worker-mode.sh` — product ที่สร้างบน server ต้องถูกประมวลผลโดย subscriber บน worker
- `tools/ops/smoke-redis-outage.sh` — worker กลับมาประมวลผล event หลัง Redis ถูก pause 30 วินาที (OPS-8)
