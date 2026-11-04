# 07 Scaling และการปฏิบัติการ (operations)

สถานะ: draft (รอบ 17 2026-11-04: OPS-17c (AC-35) — nit review #242: stdout/stderr ของ `docker run` k6 ผ่าน redact + static test ที่เข้มขึ้น, ก่อน OPS-20b; รอบ 16 2026-11-04: OPS-17b (AC-34) — scan secret ก่อนพิมพ์ลง job log + redact console ของ k6, ทำก่อน OPS-20b; รอบ 13 2026-11-03: follow-up ของ OPS-18 #194 → OPS-17a (AC-33) + OPS-17 (AC-28 ส่วนรอบ 13), ลำดับ OPS-20a → OPS-17a → OPS-17 → OPS-20b)
เป้าหมาย (เจ้าของ): รองรับผู้ใช้จำนวนมากได้ดี; พร้อมใช้งาน production ไม่ over-engineering: ทุกอย่าง
ในนี้คือ production setup ตามเอกสารของ Medusa บวกกับ index อีกไม่กี่ตัวและ load test

## สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | วิธีใช้ |
|------|-----------------|-----|
| แยก HTTP ออกจากงาน background | `workerMode: "server" \| "worker"` | 2 deployables |
| Events / jobs แบบคงทน (durable) | Redis Event Bus, Redis Workflow Engine, Redis Locking, Redis Cache modules | เปิดใช้ใน prod |
| Horizontal scaling ของ API | Server แบบ stateless; flag `--cluster` | N replicas |
| DB pooling | `databaseDriverOptions` | ตั้งค่า pool size |
| Static assets | File module S3 provider + CDN | S3 + CDN |
| Caching ของ storefront | Next.js ISR/`revalidateTag` + Medusa publishable key | ค่าเริ่มต้นของ starter |
| Liveness | `GET /health` ของ Medusa (ไม่ตรวจ Redis/BullMQ worker) | ใช้ตามเดิม; ช่องว่าง (worker ตายตอนบูต) ครอบด้วย alert จาก log ตาม ADR-012 ภาคผนวก (AC-18) |
| การเชื่อมต่อ Redis ของ event bus | option `redisOptions` (ioredis), `workerOptions` (BullMQ) ของ Redis Event Bus module; loader ตั้ง `maxRetriesPerRequest: null` เป็นค่า default แล้ว (OPS-8 #101) | ใช้ตามเดิม **ไม่ตั้ง** `redisOptions`/`workerOptions` (ADR-012 ภาคผนวก) |
| Image ของ Next.js ขนาดเล็ก | `output: "standalone"` ของ Next.js | ใช้ตามเดิม (OPS-6) |

## เป้าหมาย (v1.0)
- ผู้ใช้ storefront พร้อมกัน 2k คน, 50 checkouts/นาที อย่างต่อเนื่อง, flash-sale burst 500
  add-to-cart/วินาที เป็นเวลา 60 วินาที, p95 ของ API < 300ms, ไม่มี oversell ของตัวนับที่จำกัดจำนวนเลย

## Deliverables
1. Docker images: `backend` (image เดียวกัน, env `MEDUSA_WORKER_MODE` เลือก server/worker),
   `storefront`
2. Compose สำหรับ local; prod อ้างอิง: 2× server, 1× worker (scale ตามต้องการ), Postgres
   (managed), Redis (managed), storage ที่รองรับ S3, CDN หน้า storefront และไฟล์
3. เปิดใช้ Redis modules ใน `medusa-config.ts` สำหรับ prod: event bus, workflow engine, cache, locking
4. Indexes: ทุก column ของ custom module ที่ใช้ใน filter (ระบุไว้ในแต่ละ spec) รวมถึงตรวจสอบ
   `EXPLAIN` ของ 5 store query ที่ถูกเรียกบ่อยที่สุด
5. Rate limiting (reverse proxy หรือ middleware) บน `/store/auth/*`, `/store/group-buy/*/join`,
   `/store/affiliate/r/*` — **owner 2026-10-27 (Q-O1): เลื่อนหลัง v1.0** (OPS-3b → backlog)
6. Observability: JSON logs พร้อม request id, error tracking (Sentry), `/health` สำหรับ liveness
   (Tracing เลื่อนไปจนกว่าจะมีความจำเป็นที่วัดได้) — **owner 2026-10-27 (Q-O2): Sentry เลื่อนหลัง v1.0** (OPS-3c → backlog); v1.0 ใช้ JSON log + alert จาก log (OPS-3 ☑, AC-18)
7. Backups: snapshot Postgres รายวัน; จัดทำเอกสารการซ้อม restore
8. Load test: k6 scripts ใน `tools/load/` สำหรับ browse, flash-sale burst, group-buy join;
   รันใน CI ทุกคืนบน GitHub runner (gate ความถูกต้อง — AC-2/AC-3) และกับ staging เมื่อมี ADR (OPS-19, AC-30); บันทึกผลไว้ที่ `docs/evidence/scale/`
9. Env ที่ต้องตั้งใน prod (นอกเหนือจาก `.env.example`):
   - `TZ=UTC` ในทุก container ของ backend (server + worker) — `schedule` ของ scheduled job ใน Medusa เป็น cron ที่ไม่มีตัวเลือก
     timezone จึงตีความตามเวลาของ process; spec ที่ระบุเวลาไทย (เช่น job รายวันของ EV-5) ต้องแปลงเป็น UTC ใน cron เอง
     (00:00 Asia/Bangkok = `0 17 * * *` UTC)
   - `EVOUCHER_ADMIN_EMAIL` — mailbox เดียวที่รับอีเมลแจ้ง admin ของ e-voucher (spec 02 กฎข้อ 9)
   - `AFFILIATE_TOKEN_SECRET` — secret ของ cookie `aff` (spec 05 กฎ 22; production ขาด = บูตไม่ขึ้น, OPS-7)
   - `STOREFRONT_URL` — origin ของ storefront (เช่น `https://shop.example.com` ไม่มี `/` ท้าย) ที่ backend ใช้สร้างลิงก์ชำระเงิน `/account/orders/:id/pay` ในอีเมล
     "กลุ่มสำเร็จ" ของ GB-4 (spec 04) — ไม่ตั้ง = GB-4 (#89) ใส่ลิงก์เป็น path อย่างเดียว (ลูกค้ากดจากอีเมลไม่ได้) และ production มีเพียง
     `storefrontUrlWarning` → fail-fast ใน OPS-7 (AC-17)
   - `OPS_ALERT_EMAIL` — mailbox รับ alert `PAYMENT_WEBHOOK_SESSION_NOT_FOUND` (ADR-015, spec 06 กฎข้อ 7D, PAY-6; แยกจาก `EVOUCHER_ADMIN_EMAIL`)
   - Stripe webhook endpoint ทั้งสองต้องสมัคร event ตามรายการใน `docs/ops/production.md` หัวข้อ "Stripe webhooks" (OPS-10)
10. Runbook ลำดับ release: migrate → รีสตาร์ต backend (server + worker, reindex search ตอนบูต) → ตรวจ index → ปล่อย storefront
    (`docs/ops/production.md` หัวข้อ "ลำดับ release"; spec 01 กฎข้อ 15) — เพิ่มใน docs 2026-10-26 ไม่มี task โค้ด

## ความเสี่ยงที่ติดตาม (2026-10-26)
- R-1 (หลัง hotfix #52) jest integration รันด้วย `maxWorkers: 1` + `workerIdleMemoryLimit` แล้ว แต่ suite `flash-sale-limits` ใช้ heap
  ~1.8GB ต่อไฟล์ — `workerIdleMemoryLimit` รีไซเคิล worker **ระหว่าง**ไฟล์เท่านั้น ไม่ช่วยไฟล์เดียวที่ใหญ่ ถ้า suite ใดโตจน CI ล้มด้วย
  OOM/heap หรือใช้ heap เกิน ~2GB (ดูจาก `--logHeapUsage`) → แตก suite นั้นเป็นหลายไฟล์ตาม AC/describe ใน PR ของ task ที่ทำให้โต
  (ไม่เพิ่ม `--max-old-space-size` เป็นทางแก้หลัก) ไม่มี task ล่วงหน้า

## Checklist ตอน bump `@medusajs/*` (ADR-001: bump เป็น task/ADR แยก)
PR/ADR ที่ bump เวอร์ชันต้องติ๊กครบใน body:
1. API ที่เรา cast type หรือเรียกนอก interface สาธารณะยังมีและพฤติกรรมเดิม (ค้นด้วย `as unknown as` / `as any` ใน `apps/`):
   - `listActivePromotions` ของ Promotion module ที่ FS-4 ใช้ทำ price preview (spec 03)
   - wrapper plugin ของ `@medusajs/ui-preset` ใน `apps/storefront/tailwind.config.js` (CORE-8) — ชื่อ class `txt-*`/`*-webs` ยังเดิม
2. ADR-013: store route ใหม่ของ Medusa ที่รับ cart/order/payment collection id (รวม `cart_id` ใน query เช่น products/product-variants
   — CORE-12b) ถูกเพิ่มใน matcher ของ `ensureStoreOwnership`
   และ route ที่ปิดไว้ (order transfer, UCP) ยังถูกปิด
3. hook ที่เราใช้ (`completeCartWorkflow.hooks.validate`, `updateCartPromotionsWorkflow.hooks.*`) ยังมีชื่อ/รูปแบบ input เดิม และ
   `errorHandler` ของ Medusa ยังเขียนทับ `CONFLICT` แบบเดิม (spec 03 กฎข้อ 13)
4. integration test ทุกชุดผ่านบนเวอร์ชันใหม่
5. logger ของ OPS-3 (`apps/backend/src/lib/json-logger.ts`): format ของ log JSON (timestamp/errors/splat/json, `LOG_LEVEL`/`LOG_FILE`) ยังตรงกับ
   logger default ของ Medusa (`@medusajs/cli/dist/reporter`), deep import class `Reporter` และ `ora` ที่ resolve จาก `@medusajs/cli` ยังใช้ได้ และ
   `medusa start` ที่ไม่ตั้ง `NODE_ENV` ยังบูตได้
6. (รอบ 10, GB-N2 #126) helper ของ test `group-buy-join.spec.ts` ที่รอ subscriber ให้จบ พึ่ง `eventEmitter_` ภายในของ local event bus — ยังมีชื่อ/พฤติกรรมเดิม (test ล้ม = ตรวจที่นี่ก่อน)
7. (รอบ 10, ADR-016) Store API ของเวอร์ชันใหม่ยังอ่าน draft order ฝั่ง store ไม่ได้ — ถ้าได้แล้วให้ทบทวน route ของ GB-8; `allowFields` (EV-7a) ยังมีและยังตัด field ที่ไม่อนุญาต
8. (รอบ 12, builder CORE-4h) ข้อความ `Identity with email already exists` ของ auth emailpass ที่ storefront ใช้แยก "อีเมลซ้ำ" ตอนสมัคร (spec 01 กฎข้อ 69) ยังเหมือนเดิม — หรือ
   Medusa มี code แยกแล้ว (ให้เปลี่ยนไปใช้ code); `convertDraftOrderWorkflow` ยัง emit event ที่ GB-10 ฟัง (spec 04 กฎข้อ 26)

## Acceptance criteria
- AC-1 Backend boot เป็น `server` และ `worker` ได้จาก image เดียวกัน; scheduled jobs รันเฉพาะบน worker
- AC-2 k6 flash-sale burst: 500 rps เป็นเวลา 60 วินาที กับ `total_cap=100` → มี order ที่ได้ส่วนลด
  พอดี 100 รายการ, p95 < 300ms, 0 5xx — (รอบ 10, owner Q-O3) บน runner ของ CI: "order ที่ได้ส่วนลด" = order จาก **complete checkout** ด้วย manual payment ที่มี adjustment
  ของ promotion ในแคมเปญ (นับด้วย query DB หลังจบ) = 100 และ `units_sold = 100`, ที่เหลือได้ 409 `FLASH_SOLD_OUT`, 5xx = 0 → **gate** (workflow ล้มถ้าไม่ผ่าน);
  p95 < 300ms **รายงานอย่างเดียว** (threshold ของ k6 ไม่ทำให้ล้ม) จนกว่าจะมี staging จริง (ต้องมี ADR)
  — **ปรับโดย owner 2026-11-03 (อ้าง run 40590093846)**: nightly บน GitHub runner เป็น gate **ความถูกต้อง** เท่านั้น (order ได้ส่วนลด = `total_cap` 100, `units_sold` = 100,
  checkout ที่เหลือได้ 409 `FLASH_SOLD_OUT`, checkout ผลอื่น = 0, 5xx = 0) ภายใต้ burst ที่**ตั้งเป้า** 500 rps × 60s โดยยอมรับอัตราที่ runner ทำได้จริง (run อ้างอิงยิง burst ได้ ~421 request,
  VU ของ burst เต็ม 300, `dropped_iterations` 29,423) — ไม่ gate ที่อัตรา burst; burst ที่ถึง 500 rps × 60s จริง + p95 < 300ms ย้ายไปเป็นเงื่อนไขของ staging (AC-30, OPS-19);
  p95 ยังเป็นรายงานอย่างเดียวตาม Q-O3 (a) — **☑** ตาม run 40590093846 (`docs/evidence/scale/OPS-4/REPORT.md`)
- AC-3 k6 group-buy join: การเข้าร่วมพร้อมกัน 200 ครั้งกับกลุ่มขนาด 10 คน → มีสมาชิกพอดี 10 คน (ลูกค้า 200 คนจาก seed script; ตรวจจาก DB หลังจบ; 5xx = 0 — gate) — **☑** run 40590093846
- AC-4 ซ้อม restore จาก backup สำเร็จและร้าน boot ได้ (runbook)
- AC-5 (ADR-012, ปรับรอบ 8 ตามผลทดลอง OPS-8 #101 และการตัดสินของ owner 2026-10-26) Given compose แบบ prod (1 server + 1 worker + Redis,
  `NODE_ENV=production`) When Redis ถูก `docker pause` นาน 30 วินาทีระหว่างที่ worker ทำงานอยู่ แล้ว unpause Then event ที่ emit จาก server
  หลัง unpause ถูก subscriber บน worker ประมวลผลภายใน 60 วินาที — หรือ worker process จบด้วย exit code ≠ 0 แล้วถูก restart (restart policy)
  และประมวลผล event ได้ (script `tools/ops/smoke-redis-outage.sh` เป็น **regression test** ที่ผ่านบน develop ตั้งแต่แรก — `docker pause`
  ไม่ทำให้เกิด `ETIMEDOUT` เพราะ kernel ยังรับ TCP handshake แทน container ที่ถูก pause จึงไม่มีขั้น "fail ก่อนแก้") ความเสี่ยงที่เหลือ
  (worker ตายตอนบูตเมื่อเครื่องโหลดหนัก: log `Error running event bus worker` ขณะ `/health` ยัง 200) ทำซ้ำในเครื่องไม่ได้ จึง**ไม่**อยู่ใน AC-5
  แต่ครอบด้วย alert ใน AC-18 (OPS-3)
- AC-6 Given `apps/storefront/next.config.js` Then `output === "standalone"` และ `agentRules === false`; Given image `storefront`
  ที่ build ใหม่ When เทียบ `docker image inspect --format '{{.Size}}'` กับขนาดก่อนแก้ (บันทึกใน evidence) Then เล็กลง และ container
  ตอบ `GET /` เป็น 200
- AC-7 Given รัน `CLAUDECODE=1 pnpm --filter storefront dev` (ตัวแปรที่ Claude Code ตั้ง — builder ยืนยันชื่อตัวแปรที่ Next ใช้ตรวจจับใน
  `node_modules/next/dist/server/lib/generate-agent-files.js` และใช้ตัวนั้นถ้าต่างกัน) รอจนหน้า `/` ตอบ 200 Then ไม่มีไฟล์
  `apps/storefront/AGENTS.md` / `apps/storefront/CLAUDE.md`; positive control: ก่อนแก้ (ไม่มี `agentRules: false`) คำสั่งเดียวกันสร้างไฟล์ได้
  (บันทึกใน evidence เพื่อยืนยันว่าตัวแปรถูกต้อง)
- AC-8 Given `TEST_TYPE=integration:modules` When `jest --listTests` Then ไม่มีไฟล์ `*.unit.spec.*`; Given `TEST_TYPE=unit` Then ไม่มีไฟล์
  integration ของ module (ทุก unit spec ยังถูกรันใน `test:unit` ครั้งเดียว)
- AC-9 (ADR-010) Given `NODE_ENV=production` และไม่ตั้ง `ALLOW_TEST_PROVIDERS=true` When `buildNotificationProviders` ถูกเรียกโดยไม่มี
  `RESEND_API_KEY` หรือไม่มี `RESEND_FROM_EMAIL` Then throw พร้อมชื่อตัวแปรที่ขาด; Given `ALLOW_TEST_PROVIDERS=true` Then ได้ provider
  `local` ตามเดิม; Given ไม่ใช่ production Then พฤติกรรมเดิม (unit)
- AC-10 (ADR-010 D1, owner ตอบ spec 06 Q2 แล้ว) Given `NODE_ENV=production` ไม่มี `ALLOW_TEST_PROVIDERS` When รัน seed บน DB ว่าง Then
  region Thailand มี payment provider เฉพาะ `pp_stripe_stripe`, `pp_stripe-promptpay_stripe`; Given `ALLOW_TEST_PROVIDERS=true` Then มี
  `pp_system_default` ด้วย (integration)
- AC-11 (ADR-010) Given DB ที่ region มี `pp_system_default` หรือ `STRIPE_API_KEY` ขึ้นต้นด้วย `sk_test_` หรือตั้ง `ALLOW_TEST_PROVIDERS`
  When รัน `pnpm --filter backend check:go-live` ด้วย `NODE_ENV=production` Then exit code ≠ 0 และพิมพ์รายการที่ไม่ผ่าน;
  เมื่อครบทุกข้อ Then exit 0 (integration) — checklist go-live ใน `docs/ops/production.md` อ้างคำสั่งนี้
- AC-12 (OPS-9) Given `apps/backend/.medusa/types` ที่สร้างใหม่จาก schema ปัจจุบัน (รัน `pnpm --filter backend dev` จนบูตเสร็จ แล้วหยุด)
  When `pnpm typecheck` Then ผ่าน; Given ลบ `.medusa/types` ทิ้ง Then ผ่าน; ทั้งสองกรณีครอบ `integration-tests/http/group-buy-campaigns.spec.ts`
  และไม่มี `// @ts-ignore`/`@ts-expect-error` ใหม่ (ตรวจด้วย grep ใน diff)
- AC-13 (OPS-7, spec 05 กฎ 22, review AF-2 #66) Given `NODE_ENV=production` ไม่มี `AFFILIATE_TOKEN_SECRET` When โหลด config/บูต backend Then throw
  พร้อมชื่อตัวแปร (unit แบบ AC-9); Given ไม่ใช่ production และไม่มีค่า Then log warning 1 ครั้งตอนบูต และ `GET /store/affiliate/r/:code` 3 ครั้ง
  ไม่เพิ่ม warning; Given `.github/workflows/ci.yml` Then job `docker-worker-mode` (และทุก job ที่บูต backend ด้วย `NODE_ENV=production`) ตั้ง
  `AFFILIATE_TOKEN_SECRET` (unit อ่าน YAML)
- AC-14 (OPS-10) Given `tools/ci/classify-changes.sh` When รัน test ของ script (30 เคสเดิม: เอกสารล้วน, storefront ล้วน, backend, ไฟล์ CI, ผสม ฯลฯ)
  Then ผ่านทั้งหมด; Given job `lint-typecheck` ใน `ci.yml` Then มีขั้นตอนรัน test นี้ (และ test ล้มเมื่อกติกาใน script เปลี่ยนโดยไม่แก้เคส — positive control
  ใน evidence)
- AC-15 (OPS-10) Given `docs/ops/production.md` หัวข้อ "Stripe webhooks" (รายการ event ที่ provider Stripe ของ Medusa 2.22.1 ใช้ — builder ตรวจจาก
  `getWebhookActionAndData` ของ `@medusajs/payment-stripe`) และค่า `events=` ของขั้น `stripe listen` ใน `ci.yml` Then สองรายการเท่ากันแบบเซต
  (unit/script ที่อ่านทั้งสองไฟล์ รันใน `lint-typecheck`)
- AC-16 (OPS-11, follow-up review FS-10 #74) Given `apps/storefront/e2e` Then การ login admin และการตั้ง header `x-forwarded-proto` อยู่ใน helper เดียว
  `e2e/support/admin.ts` (grep: สตริง `x-forwarded-proto` และ path login ของ admin ไม่ปรากฏในไฟล์ `*.spec.ts` ใด); e2e admin ของ FS-10 และ e2e admin ตัวที่สอง
  ใช้ helper นี้และผ่าน; widget "Flash sale options" มี `data-testid="flash-sale-options"` ที่ `Container` และ e2e ของ FS-10 ไม่ใช้ locator `div` + `.last()` (grep)
- AC-17 (OPS-7, รอบ 7) Given `NODE_ENV=production` ไม่มี `STOREFRONT_URL` (หรือค่าไม่ใช่ URL `http(s)://` ที่ parse ได้) When โหลด config/บูต backend Then throw พร้อมชื่อตัวแปร
  (unit แบบ AC-13) — แทน `storefrontUrlWarning` ของ GB-4 ใน production; Given ไม่ใช่ production และไม่มีค่า Then ลิงก์เป็น path อย่างเดียวตามเดิมของ GB-4 และ log warning 1 ครั้งตอนบูต; Given `ci.yml` Then ทุก job ที่บูต backend ด้วย
  `NODE_ENV=production` ตั้ง `STOREFRONT_URL` (unit อ่าน YAML); `apps/backend/.env.example` มีบรรทัด `STOREFRONT_URL=` (unit อ่านไฟล์)
- AC-18 (OPS-3, ADR-012 ภาคผนวก, รอบ 8) Given `docs/ops/production.md` หัวข้อ "Alerts" Then มีกฎ alert ที่ match สตริง
  `Error running event bus worker` บน log ของ process `worker` พร้อมขั้นตอนตอบสนอง (restart worker) (unit/script grep); Given log ของ worker ในรูป
  JSON ของ OPS-3 When Medusa log ข้อความนี้ (จำลองด้วยการเรียก logger ใน unit) Then บรรทัด log มี level `error` และ field `worker_mode: "worker"`
  (field ที่กฎ alert ใช้กรอง) — logger ของ Medusa ไม่ใส่ field นี้เอง: OPS-3 เพิ่มใน formatter/transport ของ JSON log ที่ OPS-3 ตั้งเอง โดยอ่านค่าจาก env
  `MEDUSA_WORKER_MODE` (ทางเลือกที่ยอมรับเท่ากัน: ตั้ง label ระดับ container ใน log shipper ตาม env เดียวกัน) — ไม่ hook/patch internal ของ event bus module หรือ logger ของ Medusa
- AC-19 (OPS-12, รอบ 8) Given `.github/workflows/ci.yml` Then job `docker-worker-mode` มีขั้นรัน `tools/ops/smoke-redis-outage.sh` หลัง
  `smoke-worker-mode.sh` (unit อ่าน YAML); Given PR ที่ทำให้ script ล้ม (positive control ใน evidence เช่น ตั้ง subscriber ไม่ให้รัน) Then job ล้ม
- AC-20 (OPS-13, รอบ 9 — nit review #108, ADR-010 ภาคผนวก) Given `NODE_ENV=production` และ `ALLOW_TEST_PROVIDERS=true` When โหลด config/บูต backend Then log ระดับ
  warn **1 ครั้ง** ที่มีสตริง `ALLOW_TEST_PROVIDERS` (และยังบูตได้ — CI ต้องใช้); Given ไม่ใช่ production หรือไม่ตั้งตัวแปร Then ไม่มี warn นี้ (unit แบบ AC-9 ด้วย spy logger)
- AC-21 (OPS-13, Q-F1 spec 01) Given `docs/ops/production.md` หัวข้อ checklist go-live Then มีข้อที่อ้าง `Q-F1` และ `shipping_rate` (ค่าส่ง "Standard" และราคา
  "Standard return" ยังเป็น placeholder 10 THB — owner ตัดสินค่าและแก้ใน admin ก่อนเปิดร้าน) และข้อที่เคยกล่าวถึง "ค่าว่าง" (ข้อ 3 เดิมของ #108) ระบุชัดว่าตัวแปรที่
  "ไม่ตั้ง" กับ "ตั้งเป็นค่าว่าง" ถูกนับเหมือนกัน (ตามที่โค้ดของ OPS-7 ทำ — builder ยืนยันจากโค้ดแล้วเขียนตามจริง) (unit grep ไฟล์)
- AC-22 (OPS-3b — **เลื่อนหลัง v1.0**, owner Q-O1 2026-10-27; ไม่ใช่เงื่อนไขของ v1.0) Given path P ที่มีเพดาน L request ต่อหน้าต่างเวลา W ต่อ key (IP หรือ customer ตาม Q-O1) When ยิง L+1 request ภายใน W จาก key เดียวกัน Then
  request ที่ L+1 ได้ **429** พร้อม header `Retry-After` และ request ที่ 1..L ไม่ได้ 429; key อื่นไม่ถูกจำกัด; path นอกรายการไม่ถูกจำกัด (integration http หรือ test ของ config proxy
  ตามที่ Q-O1 เลือก)
- AC-23 (OPS-3c — **เลื่อนหลัง v1.0**, owner Q-O2 2026-10-27; ไม่ใช่เงื่อนไขของ v1.0) Given ตั้ง `SENTRY_DSN` (transport mock ใน test) When route ของ backend throw error ที่ไม่ใช่ `MedusaError` 4xx Then มี event 1 รายการที่มี `environment`
  และไม่มีอีเมล/cookie/header `authorization` ของผู้ใช้ (PII scrub); `MedusaError` 4xx ไม่ส่ง; Given ไม่ตั้ง `SENTRY_DSN` Then ไม่ init SDK (unit/integration); storefront ทำแบบเดียวกัน
  ถ้า Q-O2 รวม storefront
- AC-24 (OPS-14, owner อนุมัติ 2026-10-27 — ◐ #133) Given `.github/workflows/ci.yml` Then (a) job `storefront-e2e` ไม่มี `backend-tests` (หรือ job shard ใด) ใน `needs` — เริ่มพร้อม
  backend หลัง `lint-typecheck`/`changes`; (b) integration แบบ http รันเป็น matrix 3 shard ด้วย `--shard=<i>/3` ของ jest; (c) ทุก job shard มีเงื่อนไข `if:` จาก output ของ
  `tools/ci/classify-changes.sh` เท่ากับ job `backend-tests` เดิม (PR ที่แก้แค่ `apps/storefront/**` หรือเอกสาร → ทุก shard `SKIPPED`) (unit อ่าน YAML ใน `lint-typecheck`);
  Given `TEST_TYPE=integration:http` When `jest --listTests --shard=i/3` สำหรับ i = 1..3 Then union ของไฟล์ = `jest --listTests` แบบไม่ shard และไม่มีไฟล์ใดอยู่สองชุด (script/unit);
  evidence ใน PR: เวลารวมของ workflow ก่อน/หลัง (run id อย่างละ 1) — ไม่ใช่ gate
- AC-25 (OPS-13b, nit review #127) Given `docs/ops/production.md` checklist go-live Then ข้อที่พูดถึง `ALLOW_TEST_PROVIDERS` ใช้ถ้อยคำเดียวกับข้อ 3 ว่า "ไม่ตั้ง" กับ "ตั้งเป็นค่าว่าง"
  นับเหมือนกัน และข้อ Q-F1 บอกตำแหน่งแก้ `shipping_rate` ใน admin (มีคำว่า `Settings`, `Regions`, `Metadata`) และราคาของ shipping option "Standard"/"Standard return"
  (unit grep ไฟล์ใน `ops-runbook.unit.spec.ts` หรือ test เดิมของ AC-21)
- AC-26 (OPS-15, review #122 — log `Connection ended unexpectedly` ของ knex ~1,400 บรรทัดใน CI) Given job integration ของ backend ใน CI When รันจบ Then จำนวนบรรทัดที่มี
  `Connection ended unexpectedly` = 0 — ขั้นท้าย job นับจาก log ของ test แล้ว fail เมื่อ > 0; สาเหตุจริงบันทึกใน body ของ PR (เช่น ปิด connection ของ app ก่อน DB ถูก drop ใน teardown) และ
  ไม่แก้ด้วยการกรอง/ปิด log ข้อความนี้ (grep: ไม่มีสตริงนี้ในโค้ดนอกขั้นนับของ CI); ผ่าน 3 run ติดกัน (run id ใน PR)
- AC-27 (OPS-16, รอบ 11 — nit review #141 OPS-10, #133 OPS-14) Given `.github/workflows/ci.yml` Then (a) job `lint-typecheck` มี step ที่รัน `tools/ci/check-stripe-events.sh` ตัวจริงกับ
  `docs/ops/production.md` + `ci.yml` ของ repo (ไม่ใช่แค่ `check-stripe-events.test.sh`) และ test ของ script มีเคสหัวข้อ "Stripe webhooks" ที่มี trailing space → ผ่าน และเคสไม่มีหัวข้อ →
  exit ≠ 0 พร้อมข้อความบอกว่าหาหัวข้อไม่เจอ; (b) job `storefront-e2e` cache โฟลเดอร์ browser ของ Playwright ด้วย `actions/cache` (key มีเวอร์ชัน `@playwright/test` จาก lockfile) และ
  cache hit → ไม่ดาวน์โหลด browser ซ้ำ (ติดตั้งเฉพาะ system deps); (c) test ที่อ่าน `ci.yml` (ของ OPS-14) parse ด้วย parser YAML (package ที่อยู่ใน lockfile แล้ว — ถ้าไม่มี ให้ระบุใน PR และคง regex)
  ไม่ใช้ regex; evidence ใน PR: เวลา step ติดตั้ง Playwright ของ run ที่ cache hit (run id) — ไม่ใช่ gate (unit/script + CI)
- AC-28 (OPS-17, รอบ 12 — nit OPS-16 #180, review #175 OPS-4) Given `apps/backend/src/__tests__/prod-guards.unit.spec.ts` Then อ่าน env ของ job ใน `ci.yml` ด้วย `parse` ของ package `yaml`
  (แบบ `ci-workflow.unit.spec.ts`) ไม่วนบรรทัด/regex (grep: ไม่มีตัวแปรสถานะแบบ `inEnv`) และ assertion เดิมของ AC-13/AC-17 ยังผ่าน; Given `tools/load/run.sh` Then ตั้ง `IMAGE_TAG` ค่าเริ่มต้น
  `load` เมื่อไม่ได้ส่งมา (ไม่ใช้ image `local` ของ dev) (unit อ่านไฟล์); `apps/backend/src/scripts/seed-load.ts` ไม่มี `as unknown as`/`as any` (grep) และ `tsc` ผ่าน;
  (รอบ 13, review/qa #194) `hold_rank_corr` ของ `tools/load/lock-timing.js` หาลำดับคิวด้วย `Map` (O(n)) ไม่ใช่ `queue.indexOf` ในลูป (grep: ไม่มี `indexOf` ใน `lock-timing.js`) และ unit ของ analyzer ได้ค่าเดิมกับ fixture เดิม
- AC-29 (OPS-18, owner 2026-11-03 — run 40590093846: checkout flash ทุกตัวใช้ 58–71s, min 58.14s) Given `tools/load/run.sh` ขนาดเต็มเดิม (300 ลูกค้า, `total_cap=100`) When รัน
  (`workflow_dispatch` ของ `load-nightly.yml`) Then `REPORT.md` ของ OPS-18 ใต้ `docs/evidence/scale/` มีตาราง per-checkout (อย่างน้อย min/median/p95/max) ของ (a) เวลารอ lock ของ flash checkout
  และ (b) เวลาถือ lock (เวลาภายใน `locking.execute` ของ hook `flash-sale-reservation.ts`) — วัดจาก log/metric ที่มีอยู่แล้ว (JSON log ของ OPS-3, duration ของ k6/workflow) หรือ log ระดับ debug ใหม่ใน logger เดิม
  (ตั้ง `LOG_LEVEL=debug` เฉพาะ load run — ไม่เปลี่ยนค่าเริ่มต้นของ prod)
  (ไม่เพิ่ม infra/dependency — grep diff: ไม่มี package ใหม่ใน `package.json`/service ใหม่ใน compose) พร้อม run id; และสรุปสาเหตุ: ยืนยันหรือหักล้างว่า checkout ถูก serialize ด้วย lock
  (เกณฑ์ยืนยัน: ผลรวมเวลาถือ lock ≥ 80% ของช่วงเวลา checkout ทั้งหมด และเวลารอ lock โตตามลำดับคิว) — gate ความถูกต้องของ AC-2 ยังผ่านใน run เดียวกัน; ถ้าต้องแก้ design → เปิด ADR/task แยกพร้อม AC
  (ไม่แก้ใน OPS-18)
- AC-30 (OPS-19 — **⏸ backlog**, ต้องมี ADR สำหรับ staging ก่อน; ไม่ใช่เงื่อนไขของ OPS-4) Given staging ตาม ADR นั้น (k6 อยู่คนละเครื่องกับระบบ) When รัน flash-sale burst ด้วย `total_cap=100`
  Then burst ทำได้จริง ≥ 500 rps ตลอด 60 วินาที (`dropped_iterations` = 0, จำนวน request ของ burst ≥ 30,000), p95 ของ burst และ checkout < 300ms เป็น **gate** (threshold k6 ทำให้ล้ม — ขอบเขตของ p95 ยืนยันกับ owner ตอนเขียน ADR staging)
  และ gate ความถูกต้องของ AC-2 ผ่านครบ (order ได้ส่วนลด = 100, `units_sold` = 100, ที่เหลือ 409 `FLASH_SOLD_OUT`, 5xx = 0)
- AC-31 (OPS-20a, owner 2026-11-03 — OPS-18 run 41617065775: รอ lock median 12ms, ถือ lock ≤ 2.4s แต่ checkout ทั้ง request 52–63s → ≥ 95% อยู่นอก `locking.execute`)
  Given `load-nightly.yml` มี `workflow_dispatch.inputs.flash_burst` (ค่าเริ่มต้น = มี burst) ส่งเป็น env `LOAD_FLASH_BURST` ให้ `tools/load/run.sh` → k6 และ `LOAD_FLASH_BURST=0` **ตัด scenario burst ออกจาก
  `options.scenarios`** ของ `tools/load/flash-sale.js` (ไม่ใช้ `LOAD_BURST_RATE=0` — `constant-arrival-rate` ไม่รับ rate 0); `schedule` ไม่ส่ง input → มี burst (unit อ่าน `load-nightly.yml`/`run.sh`/`flash-sale.js`)
  When รัน `workflow_dispatch` ขนาดเต็มเดิม (300 ลูกค้า, `total_cap=100`) สองครั้ง — (1) มี burst (2) `flash_burst` ปิด — Then `docs/evidence/scale/OPS-20a/REPORT.md` มี run id ทั้งสอง และต่อ run มีตาราง
  per-checkout (min/median/p95/max, จำนวนรวม = 300) **แยกทั้งรวมและตาม outcome** (ok = 100 / `FLASH_SOLD_OUT` = 200) ของ (a) checkout ทั้ง request (k6)
  (b) ก่อน hook = middleware ของ route `/store/carts/:id/complete` (เข้า) → ต้น handler รวม `apps/backend/src/workflows/hooks/complete-cart-validate.ts`
  (c) ใน hook = ต้น → ท้าย handler รวมนั้น (รวม exclusivity check + `reserveFlashSaleForCart`; รอ/ถือ lock ของ OPS-18 แสดงเป็นส่วนย่อย)
  (d) หลัง hook = ท้าย handler รวม → response ออก (`res` `finish` ใน middleware เดียวกับ (b))
  (e) ก่อนถึง middleware ของ route + หลัง response = (a) − (b+c+d) (คิว event loop/accept ของ server, middleware ส่วนกลาง/`authenticate`, เครือข่ายใน runner) — **ห้ามสรุปว่า (e) "อยู่นอก server"**;
  ตีความ (e) คู่กับ event-loop delay ของ AC-32 (ก่อน OPS-20b ให้ระบุว่ายังแยกไม่ได้)
  — (b)–(d) เป็น log ระดับ debug ของ logger เดิมแบบ OPS-18 ผูกด้วย `cart_id` (ไม่ใช้ duration ของ OPS-3 — ไม่มี log ระยะเวลา request); handler ของ hook คงเป็นตัวรวมตัวเดียว (`createHook` มี handler เดียว)
  และ REPORT ใส่ timestamp ของ "ช่วง checkout" ต่อ run = request checkout แรกเข้า middleware ของ (b) → response สุดท้ายออกของ (d)
  (ไม่เพิ่ม infra/dependency — grep diff: ไม่มี package ใหม่ใน `package.json`/service ใหม่ใน compose; `LOG_LEVEL=debug` เฉพาะ load run; ตั้งใจไม่ใช้ `registerOtel` ของ Medusa (`instrumentation.ts`)
  แม้ให้ span ราย step ได้ตรงกว่า เพราะต้องเพิ่ม `@opentelemetry/*` + exporter/collector = dependency/infra ใหม่ตามข้อห้ามข้อ 3)
  และสรุปตามเกณฑ์ (owner อนุมัติ 2026-11-03): median (a) ของ run ไม่มี burst ≤ 20% ของ run มี burst → "burst เป็นสาเหตุหลัก", ≥ 80% → "workflow เอง", ระหว่างนั้น → "ทั้งสอง" (ระบุสัดส่วน);
  ช่วงใน (b)–(e) ที่ median ≥ 50% ของ median (a) = ช่วงหลัก (ต่อ run และต่อ outcome) — gate ความถูกต้องของ AC-2 ผ่านในทั้งสอง run; ถ้าต้องแก้ → ADR/task แยกพร้อม AC (ไม่แก้ใน OPS-20a)
- AC-32 (OPS-20b) Given OPS-20a ☑ When รัน `workflow_dispatch` สองครั้งแบบ AC-31 (มี/ไม่มี burst) โดยเปิด sampler **เท่ากันทั้งสอง run** (REPORT บันทึกค่าตั้งและ interval ของ sampler)
  Then `docs/evidence/scale/OPS-20b/REPORT.md` มี run id ทั้งสอง, ตาราง (a)–(e) ของ AC-31 จาก run เดียวกัน และตารางตัวชี้วัดรายวินาทีใน "ช่วง checkout" (นิยามเดียวกับ AC-31 พร้อม timestamp)
  min/median/p95/max ของ: event-loop delay ของ server และ worker (`perf_hooks.monitorEventLoopDelay` ใน `register()` ของ `apps/backend/instrumentation.ts` ที่ `medusa start` โหลดทั้งสองโหมด
  — ยืนยันด้วย log ของทั้งสอง process; histogram/timer สร้าง**เฉพาะเมื่อ `LOG_LEVEL=debug`** ไม่มี timer ใน prod — unit: ไม่ตั้ง `LOG_LEVEL=debug` → ไม่สร้าง interval),
  CPU ของแต่ละ container (`docker stats --no-stream` ที่ `run.sh` sample), จำนวน connection ของ Postgres แยก `state`/`wait_event_type` (`pg_stat_activity` ผ่าน `psql` ใน container postgres เดิม)
  และจำนวนที่รอ pool ของ knex (`numPendingAcquires` ของ `PG_CONNECTION`) — ถ้าเข้าถึงไม่ได้ให้ระบุเหตุผลใน REPORT (ไม่เพิ่ม infra/dependency เหมือน AC-31)
  และสรุปตามเกณฑ์ (owner อนุมัติ 2026-11-03): "อิ่มตัว" เมื่อ p95 event-loop delay ของ server ≥ 100ms หรือ median CPU ของ server ≥ 90% ของ 1 core (`docker stats` 100% = 1 core)
  หรือ p95 ของจำนวนรอ pool > 0 ในช่วง checkout; ระบุว่าช่วงหลักของ AC-31 (โดยเฉพาะ (e)) อธิบายได้ด้วยความอิ่มตัวหรือไม่ — gate ของ AC-2 ผ่านทั้งสอง run; ถ้าต้องแก้ → ADR/task แยกพร้อม AC
- AC-33 (OPS-17a, รอบ 13 — review/qa #194 OPS-18, **token ใน artifact**) Given load run ใดก็ตาม Then ไฟล์ใน `OUT` (artifact) ไม่มี key `setup_data` และไม่มีสตริงรูปแบบ JWT
  (`eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.`) — k6 script ที่ `setup()` คืน token (`flash-sale.js`, `group-buy-join.js`) ส่งออก summary ผ่าน `handleSummary` ที่ตัด `setup_data` (หรือ `run.sh`
  ตัดก่อนเขียน `OUT`) และ `run.sh` มีขั้นตรวจท้าย run ที่ล้ม (exit ≠ 0) เมื่อพบรูปแบบ JWT ใน `OUT` (unit: fixture summary ที่มี `setup_data.checkout[].token` → ผลไม่มี `setup_data`;
  fixture ไฟล์มี JWT → ขั้นตรวจล้ม; ยืนยันด้วย run id ใน PR — gate ของ AC-2 ยังผ่าน)
- AC-34 (OPS-17b, รอบ 16 — review/qa 2026-11-04) **กฎ cleanup/รายงานของ `tools/load/run.sh`: ก่อน `cat`/`grep` เนื้อหาจาก `OUT` หรือ console ของ k6 ลง job log หรือ `GITHUB_STEP_SUMMARY`
  ต้อง scan หา secret (รูปแบบ JWT ของ AC-33) ก่อนเสมอ — ไฟล์ที่พบถูกลบและไม่ถูกพิมพ์ ส่วน stream ที่พิมพ์ระหว่าง run ต้องผ่านตัว redact** —
  (a) `cleanup()` และ flow หลักพิมพ์ report หลัง `artifact-guard.js scan "$OUT"` (มีแล้วใน OPS-17 #235 — test นี้ล็อกลำดับไว้);
  (b) บรรทัดใน `k6()` ที่ `grep -v checkout_k6_timing` console ของ k6 ลง job log ส่งผ่าน `node tools/load/artifact-guard.js redact` ที่แทนสตริงรูปแบบ JWT ด้วย `[REDACTED_JWT]` ก่อนพิมพ์;
  (c) k6 script (`flash-sale.js`, `group-buy-join.js`) ไม่ส่ง token/header ของ request เข้า `console.*`;
  unit (node test ของ `tools/load`): `redact` กับ input ที่มี JWT → ผลไม่มีรูปแบบ JWT และข้อความอื่นคงเดิม; static test อ่าน `run.sh`: ทุกคำสั่ง `cat`/`grep` ที่อ่านไฟล์ใน `$OUT` หรือ console ของ k6
  แล้วเขียนไป stdout หรือ `>>"$GITHUB_STEP_SUMMARY"` อยู่หลัง `artifact-guard.js scan` ในบล็อกเดียวกัน หรือ pipe ผ่าน `artifact-guard.js redact` — fixture ที่สลับลำดับ (cat ก่อน scan) → test ล้ม;
  **(review #240) test นี้ครอบ `cat`/`grep` ของไฟล์ใน `$OUT` ทุกตัวรวมตัวที่ redirect เข้า `report.md`** — บรรทัดเดิม `tools/load/run.sh:132` `cat "$OUT/k6-failures.txt"` (ในบล็อกเขียน `report.md` ก่อน scan บรรทัด 138)
  จะทำให้ test ล้ม → OPS-17b ต้องเปลี่ยนบรรทัดนั้นให้อ่านผ่าน `node tools/load/artifact-guard.js redact <"$OUT/k6-failures.txt"` (หรือย้ายไปหลัง scan) ใน PR เดียวกัน ห้ามใส่ข้อยกเว้นใน test
  (positive control ใน PR); static: argument ของ `console.(log|error|warn|info)(` ใน `tools/load/{flash-sale,group-buy-join}.js` ไม่มี identifier `token`, `authorization`, `headers`, `setup`;
  run ของ `load-nightly.yml` (`workflow_dispatch`) ผ่าน และ gate AC-2/AC-3 + AC-33 ยังผ่าน (run id ใน PR)
- AC-35 (OPS-17c, รอบ 17 — nit review #242 OPS-17b; ต่อจาก AC-34) (a) stdout/stderr ของคำสั่ง `docker run ... k6 run` เอง (log `ERRO`/`WARN` ของ k6 ที่ไม่ได้ไปที่ `--console-output`;
  `tools/load/run.sh` ใน `k6()` ~71–75 บน develop `e45b046` พิมพ์ตรงลง job log) ส่งผ่าน `node tools/load/artifact-guard.js redact` ก่อนพิมพ์ โดย exit code ที่บันทึกลง `k6-failures.txt` ยังเป็นของ
  `docker run` (ใช้ `PIPESTATUS`/`pipefail` — ไม่ใช่ของ `redact`); test (node test ของ `tools/load` หรือ bash test) ใช้ stub `docker` ใน `PATH` ที่พิมพ์ JWT ลง stderr แล้ว exit 99 →
  output ที่ได้ไม่มีรูปแบบ JWT และ `k6-failures.txt` มี `exit 99`; (b) static test ของ `console.*` ใน k6 script (ตัวที่ OPS-17b เพิ่ม — `SECRET_IDENT`) ปฏิเสธ argument ที่มี `JSON.stringify(`
  ด้วย (object ที่ stringify อาจมี token) — fixture `console.log(JSON.stringify(res))` → test ล้ม; (c) ตัวตรวจ "พิมพ์ก่อน scan" (`unguardedPrints` ของ OPS-17b) ไม่ข้ามทั้งบรรทัดที่มี `grep -q`
  — แยกคำสั่งตาม `&&`/`||`/`;`/`|` แล้วข้ามเฉพาะส่วน `grep -q` — fixture `grep -q x "$OUT/a" && cat "$OUT/a"` ก่อน scan → test ล้ม; positive control ของ (b)/(c) ใน PR;
  test ของ AC-34 ยังผ่าน (ไม่ต้องรัน `load-nightly.yml` ซ้ำถ้า diff ของ `run.sh` อยู่เฉพาะ `k6()` — แนบ run id ถ้าแตะส่วนอื่น)

## Tasks
| ID | Task | Depends |
|----|------|---------|
| OPS-1 | Dockerfiles + compose + env ของ worker mode + health (AC-1) | CORE-1 |
| OPS-2 | Prod config: Redis modules, pool size, S3, เอกสาร CDN | OPS-1 |
| OPS-3 | JSON logs + request id + alert log `Error running event bus worker` ของ worker (รอบ 8, AC-18) — รอบ 9 แยก rate limiting → OPS-3b และ Sentry → OPS-3c | OPS-1, OPS-8 ☑ (#101) |
| OPS-3b | (รอบ 9) rate limiting ตาม Deliverables ข้อ 5 + `/store/search` (AC-22) — **⏸ backlog หลัง v1.0** (owner Q-O1 2026-10-27); ข้อเสนอเดิมใน Q-O1 ใช้ตอนกลับมาทำ | OPS-3 ☑ |
| OPS-3c | (รอบ 9) error tracking Sentry ตาม Deliverables ข้อ 6 (AC-23) — **⏸ backlog หลัง v1.0** (owner Q-O2 2026-10-27); dependency ใหม่ (`@sentry/*`) ระบุใน PR ตอนกลับมาทำ | OPS-3 ☑ |
| OPS-4 | ☑ #175 — k6 scripts ใน `tools/load/` + seed script (`apps/backend/src/scripts/seed-load.ts` — ย้ายจาก `tools/load/` เพราะ `.dockerignore`) + `.github/workflows/load-nightly.yml` + evidence (AC-2, AC-3) ตาม Q-O3 ที่ owner ตัดสิน 2026-10-27 (a)–(e); `REPORT.md` ใช้ผลของ run หลัง merge (40590093846) ตัวล่าสุด — ถ้า gate ล้มให้อ่าน `backend-tail.log` ก่อน; REPORT ☑ #191; **AC-2 ☑ (ถ้อยคำปรับโดย owner 2026-11-03), AC-3 ☑** (run 40590093846) | FS-3 ☑, GB-3 ☑, OPS-1 ☑ |
| OPS-18 | (เล็ก, วัดผล, owner 2026-11-03) วัด/หาสาเหตุเวลา checkout flash 58–71s ใน run 40590093846 — สงสัย lock ของ flash checkout ทำให้ต่อคิวทีละตัว: วัดเวลารอ lock/เวลาใน step จาก log/metric ที่มีอยู่ (ห้ามเพิ่ม infra) + สรุปสาเหตุใน evidence; ต้องแก้ design → ADR/task แยก (AC-29) — ☑ #194, **AC-29 ☑** (run 41617065775: **หักล้าง** lock serialize) | OPS-4 ☑ |
| OPS-20a | (เล็ก, วัดผล, owner 2026-11-03) หาว่าเวลา checkout flash 52–63s ของ run 41617065775 อยู่ที่ไหน: input `flash_burst` ของ `load-nightly.yml` → `LOAD_FLASH_BURST` ตัด scenario burst + รันเทียบมี/ไม่มี burst, log debug ช่วง (b)–(d) ที่ middleware ของ route complete และ handler รวม `complete-cart-validate.ts` + analyzer (ต่อจาก `lock-timing.js`) + สรุป burst vs workflow ใน evidence (ห้ามเพิ่ม infra/dependency; ไม่ใช้ `registerOtel`); ต้องแก้ → ADR/task แยก (AC-31) | OPS-18 ☑ (#194); ชน `tools/load/run.sh` กับ OPS-17 — ทำทีละตัว (ตัวที่เริ่มทีหลังรอตัวก่อน merge); แตะ `load-nightly.yml` (ไม่มี task อื่นที่เปิดอยู่แตะ) |
| OPS-20b | (เล็ก, วัดผล) ตัวชี้วัดความอิ่มตัว: event-loop delay ของ server/worker ใน `instrumentation.ts` (เฉพาะ `LOG_LEVEL=debug`), sampler `docker stats`/`pg_stat_activity` ใน `run.sh`, รอ pool ของ knex + รันเทียบมี/ไม่มี burst อีกสองครั้ง + สรุปเรื่องอิ่มตัวใน evidence (AC-32) | OPS-20a ☑ #204, **OPS-17** ☑ #235 (รอบ 13 — ลำดับ OPS-20a → OPS-17a → OPS-17 → OPS-20b; ชน `tools/load/run.sh`; ปิด token ใน artifact ก่อนรัน load เพิ่มอีกสองครั้ง); (รอบ 16–17) **OPS-17b ☑ #242 และ OPS-17c ☑ #253** ก่อน (ชน `run.sh`) — รอบ 18: dependency ครบ **เริ่มได้** |
| OPS-19 | (staging load test) burst 500 rps × 60s จริง + p95 < 300ms เป็น gate (AC-30) — **⏸ backlog**: ต้องมี ADR สำหรับ staging (infra ใหม่ ตามข้อห้ามข้อ 3) ก่อน — ยังไม่มี ADR | ADR staging (ยังไม่มี), OPS-4 ☑ |
| OPS-17 | (เล็ก, test/tooling, รอบ 12 — nit OPS-16 #180, review #175) `prod-guards.unit.spec.ts` อ่าน `ci.yml` ด้วย parser YAML, `IMAGE_TAG` ค่าเริ่มต้น `load` ใน `tools/load/run.sh`, ตัด cast ใน `seed-load.ts`; (รอบ 13, review #194) `hold_rank_corr` ใน `lock-timing.js` เป็น O(n) (AC-28) — ไฟล์เพิ่ม: `tools/load/lock-timing.js` + unit | OPS-16 ☑ (#180), OPS-4 ☑ (#175), **OPS-17a** (รอบ 13 — ชน `tools/load/run.sh`) |
| OPS-17a | (เล็ก, **ความปลอดภัย** — ทำก่อน OPS-17, รอบ 13 — review/qa #194 OPS-18) summary/artifact ของ k6 ไม่มี `setup_data`/JWT ของลูกค้า load test (มีมาตั้งแต่ OPS-4) + ขั้นตรวจ JWT ท้าย `run.sh` (AC-33) — ไฟล์: `tools/load/{flash-sale,group-buy-join}.js`, `tools/load/run.sh`, unit ของ `tools/load` | OPS-4 ☑ (#175), **OPS-20a (#204) merge** (ชน `run.sh`, `flash-sale.js`) |
| OPS-17b | (เล็ก ~100 LOC, **ความปลอดภัย**, รอบ 16 — review/qa 2026-11-04) redact JWT ใน console ของ k6 ก่อนลง job log + test ล็อกลำดับ "scan ก่อน cat" ของ `cleanup()`/report + static test `console.*` ของ k6 (AC-34) — ไฟล์: `tools/load/run.sh` (รวมบรรทัด 132 `k6-failures.txt` — AC-34), `tools/load/artifact-guard.js` (+ unit), `tools/load/{flash-sale,group-buy-join}.js` (ถ้าต้องแก้) | OPS-17a ☑ และ OPS-17 ☑ (#235 — `artifact-guard.js` อยู่ใน develop `abbbc92` แล้ว); ชน `run.sh` กับ OPS-20b → **OPS-17b ก่อน OPS-20b** — ☑ #242 |
| OPS-17c | (เล็ก ~60 LOC, ความปลอดภัย/test, รอบ 17 — nit review #242) stdout/stderr ของ `docker run` k6 ผ่าน redact (คง exit code), static test `console.*` จับ `JSON.stringify(`, ตัวตรวจ "พิมพ์ก่อน scan" ไม่ข้ามทั้งบรรทัดที่มี `grep -q` (AC-35) — ไฟล์: `tools/load/run.sh` (`k6()`), test ของ `tools/load` ที่ OPS-17b เพิ่ม | **OPS-17b (#242) merge** (แก้ test/โค้ดที่ #242 เพิ่ม); ชน `run.sh` กับ OPS-20b → ทีละตัว ลำดับแนะนำ **OPS-17c ก่อน OPS-20b** (เล็ก, ปิดช่อง log ก่อนรัน load เพิ่ม) — ☑ #253 |
| OPS-5 | ตรวจสอบ index + migrations; runbook สำหรับ backup/restore (AC-4) | ทุก module |
| OPS-6 | Tooling: Next `output: "standalone"` + Dockerfile storefront ใช้ `.next/standalone`, `agentRules: false`, แก้ `testMatch` ของ jest ไม่ให้ unit spec ถูกจับซ้ำ (AC-6, AC-7, AC-8) | OPS-1 |
| OPS-7 | Prod guards ตาม ADR-010 (accepted, D1): fail-fast เมื่อขาด `RESEND_API_KEY`/`RESEND_FROM_EMAIL` (AC-9), seed ไม่เปิด `pp_system_default` ใน prod (AC-10), script `check:go-live` + checklist go-live ใน `docs/ops/production.md` (AC-11), ตั้ง `ALLOW_TEST_PROVIDERS=true` ใน CI job ที่รันโหมด production; fail-fast `AFFILIATE_TOKEN_SECRET` + ตั้งตัวแปรใน job `docker-worker-mode` (เพิ่ม 2026-10-26 จาก review AF-2, AC-13); fail-fast `STOREFRONT_URL` (รอบ 7, AC-17 — ถ้า GB-4 ยังไม่ merge ตอนเริ่ม OPS-7 ให้ทำส่วนนี้เมื่อ GB-4 merge แล้ว ไม่แตะโค้ดอีเมลของ GB-4) | OPS-2, PAY-1, CORE-3, AF-2 (#66), GB-4 (#89, เฉพาะ AC-17) |
| OPS-10 | (เล็ก, CI) commit test ของ `tools/ci/classify-changes.sh` (30 เคส) ให้รันใน `lint-typecheck` (AC-14) + หัวข้อ "Stripe webhooks" ใน `docs/ops/production.md` และ `--events` ของ `stripe listen` ใน `ci.yml` ตรงกัน พร้อม check อัตโนมัติ (AC-15) | PAY-2 |
| OPS-8 | (☑ #101) Worker กับ Redis ของ event bus ขาด ตาม ADR-012 ภาคผนวก (owner ตัดสิน 2026-10-26): `tools/ops/smoke-redis-outage.sh` เป็น regression test (AC-5) + เอกสารความเสี่ยงที่เหลือใน `docs/ops/production.md`; **ไม่**แก้ `infra-modules.ts` และไม่แตะ internal ของ module | OPS-2 |
| OPS-12 | (เล็ก, CI, รอบ 8) รัน `smoke-redis-outage.sh` ใน job `docker-worker-mode` ของ `ci.yml` (AC-19) | OPS-8 ☑ #101, OPS-7 (◐ #108 — แตะ job เดียวกันใน `ci.yml`; **เริ่มหลัง #108 merge**) |
| OPS-13 | (เล็ก, รอบ 9, follow-up review #108) warn ตอนบูตเมื่อ production ตั้ง `ALLOW_TEST_PROVIDERS=true` (AC-20) + `docs/ops/production.md`: ถ้อยคำ checklist go-live ข้อ 3 เรื่องค่าว่าง และข้อ Q-F1 ค่าส่ง placeholder (AC-21) | OPS-7 (#108) (∥ OPS-12 — คนละไฟล์: OPS-13 แตะ config/guard + `production.md`, OPS-12 แตะ `ci.yml`) |
| OPS-13b | (เล็ก, docs + test grep, รอบ 10 — nit review #127) `docs/ops/production.md` ถ้อยคำ `ALLOW_TEST_PROVIDERS` ให้ตรงข้อ 3, ตำแหน่งแก้ `shipping_rate`/ราคา option ใน admin (AC-25) — ต้องเป็น PR ที่รัน unit ของ backend (อย่ารวมใน PR เอกสารล้วนเพราะ CI ข้าม test ที่อ่านไฟล์นี้) | OPS-13 ☑ (#127) |
| OPS-14 | (CI, owner อนุมัติ 2026-10-27 — ◐ #133) `storefront-e2e` รันขนานกับ backend + แบ่ง integration:http เป็น 3 shard + test อ่าน YAML/shard ครบ (AC-24) | — (ไม่มี dependency; OPS-10/OPS-12 แตะ `ci.yml` เดียวกัน → เริ่มหลัง #133 merge) |
| OPS-15 | (เล็ก, test infra, รอบ 10 — review #122) หาสาเหตุ log knex `Connection ended unexpectedly` ใน integration ของ CI แล้วแก้ที่ต้นเหตุ + ขั้นนับใน CI (AC-26) | OPS-14 (#133 — แตะ job integration เดียวกัน) |
| OPS-16 | (เล็ก, CI, รอบ 11 — nit review #141/#133, qa OPS-14) รัน `check-stripe-events.sh` ตัวจริงใน `lint-typecheck` + เคส trailing space, cache browser ของ Playwright ใน `storefront-e2e`, test อ่าน `ci.yml` ด้วย parser YAML (AC-27) — ไฟล์: `.github/workflows/ci.yml`, `tools/ci/check-stripe-events*.sh`, test ของ OPS-14 | OPS-10 ☑ (#141), OPS-14 ☑ (#133) — ชน `ci.yml` กับ OPS-12/OPS-15: ทำทีละตัว (ตัวที่เริ่มทีหลังรอตัวก่อน merge) |
| OPS-9 | (เล็ก) typecheck ในเครื่องล้มที่ `group-buy-campaigns.spec.ts` เมื่อมี `.medusa/types` (typed `query.graph` ของ link) — แก้ที่ test ให้ type ตรงกับ type ของ link ที่ Medusa generate (เช่น อ่านผ่าน type ของ entity/cast ให้ตรง) **ไม่** exclude `.medusa/types` จาก tsconfig (ทำให้ typed query ทั้งโปรเจกต์หายและ CI กับเครื่อง dev typecheck ต่างกันมากขึ้น); ถ้าแก้ที่ test ไม่ได้ให้หยุดและรายงาน (AC-12) | GB-2a |
| OPS-11 | (เล็ก, e2e tooling, รอบ 6) ย้าย login admin + header `x-forwarded-proto` จาก e2e admin ของ FS-10 ไปเป็น helper ร่วม `e2e/support/admin.ts` + `data-testid` ที่ `Container` ของ widget "Flash sale options" แทน locator `div.last()` (AC-16) — **ทำเมื่อมี e2e admin ตัวที่สอง** (ตัวแรกที่จะเริ่มจาก EV-5b, EV-9, GB-6b, GB-6c, AF-6): ถ้า OPS-11 ยังไม่ merge ตอน task นั้นเริ่ม ให้รวม OPS-11 ไว้ใน PR ของ task นั้น (ไม่สร้าง helper ก่อนมีผู้ใช้สองที่) | FS-10 (#74) |
OPS-3 ∥ OPS-6 ∥ OPS-7 ∥ OPS-8 ∥ OPS-9 (OPS-9 แตะเฉพาะ `integration-tests/http/group-buy-campaigns.spec.ts`; OPS-6 แตะ `next.config.js`/Dockerfile/jest config; OPS-7 แตะ `notification-providers.ts`/seed/`ci.yml`;
OPS-8 แตะ `tools/ops/`/`docs/ops/production.md` — ถ้า CORE-10 merge ก่อน OPS-7 ต้อง rebase ส่วน seed)
OPS-12 ทำต่อจาก OPS-7 (ไม่ขนานกัน: ชน `ci.yml` job `docker-worker-mode`); ∥ งานอื่น; OPS-13 หลัง OPS-7 (#108) ∥ OPS-12; OPS-3b ∥ OPS-3c หลัง OPS-3 และคำตอบ Q-O1/Q-O2
(รอบ 10) สถานะ: OPS-3 ☑ #120, OPS-7 ☑ #108, OPS-13 ☑ #127; OPS-3b/OPS-3c ⏸ หลัง v1.0; OPS-12 ∥ OPS-13b ∥ OPS-10 เริ่มได้ (OPS-12/OPS-10 แตะ `ci.yml` ร่วมกับ OPS-14 #133 —
เริ่มหลัง #133 merge เพื่อลด conflict); OPS-15 หลัง OPS-14; OPS-4 เริ่มได้ (Q-O3 ตัดสินแล้ว; workflow ไฟล์แยกจึงไม่ชน `ci.yml` ของ #133)
(รอบ 11) สถานะ: OPS-10 ☑ #141, OPS-14 ☑ #133, OPS-13b ☑ #147 (nit review #147 — เพิ่ม "→ service zone" ในเส้นทางเมนู shipping option ของ `production.md` ข้อ 5 —
#147 ไม่ได้แก้ จึงแก้ใน PR เอกสารรอบ 11 (#152) หลัง merge develop);
OPS-12, OPS-15, OPS-16 เริ่มได้ (แตะ `ci.yml` ร่วมกัน — ทีละตัว ลำดับแนะนำ OPS-15 → OPS-12 → OPS-16); OPS-4, OPS-5 ☐; e2e รันแม้ backend test ล้ม (ผลของการรันขนานใน OPS-14) — ยอมรับ ไม่มี task
(รอบ 12) สถานะ: OPS-15 ☑ #156, OPS-12 ☑ #172, OPS-4 ☑ #175 (load-nightly run 40590093846 success — `REPORT.md` ☑ #191; owner 2026-11-03: AC-2 ☑ ตามถ้อยคำใหม่, AC-3 ☑, OPS-19 ⏸), OPS-16 ☑ #180 (รวม test `if: false` ของ review #172);
OPS-18 ☑ #194 (AC-29 ☑ — lock ไม่ใช่สาเหตุ) → OPS-20a ☐ เริ่มได้ → OPS-20b ☐ (owner 2026-11-03; ทั้งคู่ทีละตัวกับ OPS-17 เพราะชน `run.sh`);
OPS-17 เริ่มได้; OPS-5 ☐ (ท้ายสุด); `DATABASE_POOL_MAX` ไม่ต้องมี task เพราะ gate ของ load test ผ่าน (5xx = 0) — ทบทวนเมื่อรอบเต็มล้มด้วย 5xx
(รอบ 13, 2026-11-03) สถานะ: OPS-20a ◐ #204; follow-up ของ #194 แยกเป็น OPS-17a (token ใน artifact — ความปลอดภัย, AC-33) และส่วน O(n²) ของ analyzer รวมใน OPS-17 (AC-28);
ลำดับ `tools/load/*`: OPS-20a → OPS-17a → OPS-17 → OPS-20b
(ความเสี่ยงของ token: เป็น JWT ของลูกค้าทดสอบใน DB ชั่วคราวของ runner ที่ถูกทิ้งหลัง run — ไม่ใช่ข้อมูลจริง แต่ไม่ควรอยู่ใน artifact 14 วัน; ไม่ต้องลบ artifact เดิมเพราะ token ใช้กับระบบใดไม่ได้แล้ว)
(รอบ 16, 2026-11-04) OPS-17b ☐ เริ่มได้ → OPS-20b (ลำดับ `tools/load/*` ที่เหลือ: OPS-17b → OPS-20b)
(รอบ 16b, 2026-11-04) OPS-17a ☑ #220, OPS-17 ☑ #235; OPS-17b ◐ (รอบ 17 — รวมการแก้ `run.sh:132` ตาม AC-34) → OPS-20b
(รอบ 17, 2026-11-04) OPS-17b ◐ #242 → OPS-17c ☐ (nit review #242; AC-35) → OPS-20b (ลำดับ `tools/load/*`: OPS-17b → OPS-17c → OPS-20b)
(รอบ 18, 2026-11-04) OPS-17b ☑ #242 (train #248), OPS-17c ☑ #253 (train #256) ; OPS-20a ☑ #204 (merge 2026-11-03) → OPS-20b ☐ **เริ่มได้** (dependency ครบ)

## Open questions (รอบ 10)
- ~~Q-O3~~ ตัดสินแล้ว (owner 2026-10-27): **รับข้อเสนอทั้งชุด (a)–(e)** ด้านล่าง → OPS-4 เริ่มได้ (Depends FS-3 ☑, GB-3 ☑, OPS-1 ☑); คำถามเดิม (OPS-4 load test) **ข้อเสนอรวม**:
  (a) **สภาพแวดล้อม**: ยังไม่มี staging — เสนอบูต stack แบบ prod ใน GitHub runner ด้วย `docker-compose.prod.yml` ของ OPS-1 (server + worker + Postgres + Redis ใน runner เดียว,
  `NODE_ENV=production`, `ALLOW_TEST_PROVIDERS=true` เพื่อใช้ manual payment) **ไม่สร้าง infra ใหม่**; ข้อจำกัด: runner มาตรฐาน (4 vCPU/16GB) และ k6 อยู่เครื่องเดียวกับระบบ ตัวเลข latency
  จึงไม่แทน production → เสนอให้ AC-2/AC-3 ส่วน **ความถูกต้อง** (พอดี 100 / พอดี 10 / 0 5xx) เป็น gate และ p95 < 300ms **รายงานอย่างเดียว** (ไม่ fail) จนกว่าจะมี staging จริง
  (staging จริง = infra ใหม่ ต้องมี ADR)
  (b) **seed**: script `tools/load/seed-load.ts` (ส่งมอบจริงใน #175 ที่ `apps/backend/src/scripts/seed-load.ts` เพราะ `.dockerignore` — แก้ถ้อยคำรอบ 12) (รันด้วย `medusa exec` ใน container) สร้างลูกค้า N คน (เช่น 300 สำหรับ flash, 200 สำหรับ join) ผ่าน workflow ของ Medusa
  + ออก token ของลูกค้าแต่ละคนผ่าน `/auth/customer/emailpass` แล้วเขียนไฟล์ JSON ที่ k6 อ่าน (`SharedArray`) — ไฟล์อยู่ใน runner เท่านั้นไม่ commit; admin ใช้ `SEED_ADMIN_EMAIL`/
  `SEED_ADMIN_PASSWORD` ที่ workflow สุ่มขึ้นเองตอนรัน (ไม่ต้องมี secret ใหม่)
  (c) **นิยาม "order ได้ส่วนลดพอดี 100"**: k6 ต้อง **complete checkout** (การจองโควตาเกิดตอน complete cart — กฎ FS-3 ไม่ใช่ตอน add to cart) ด้วย manual payment; ลูกค้า 300 คน คนละ 1 ชิ้น
  แข่งกับ `total_cap=100` → หลังจบ query DB: จำนวน order ที่มี adjustment ของ promotion ในแคมเปญ = 100, `units_sold = 100`, ที่เหลือได้ 409 `FLASH_SOLD_OUT` (4xx ไม่นับเป็น error),
  5xx = 0; burst 500 rps เป็น add-to-cart/อ่าน cart ของลูกค้าเดียวกันระหว่างนั้น (ไม่ใช่ 500 order/วินาที)
  (d) **k6**: ใช้ image `grafana/k6` แบบ pin เวอร์ชัน (หรือ action `grafana/setup-k6-action`) — ไม่เพิ่ม dependency ใน `package.json`/pnpm; script เป็น JS ใน `tools/load/`
  (e) **workflow**: ไฟล์แยก `.github/workflows/load-nightly.yml` (`schedule` รายคืน + `workflow_dispatch`) ไม่อยู่ใน `ci.yml` (ไม่กระทบ PR และกติกา merge); ผล k6 (`--summary-export`) เป็น
  artifact 14 วัน; `docs/evidence/scale/` เก็บ `REPORT.md` ของ PR OPS-4 ครั้งเดียว (nightly ไม่ commit); Depends เปลี่ยนจาก FS-6 + GB-7 เป็น FS-3 ☑ + GB-3 ☑ + OPS-1 ☑ เพราะ load test ยิง
  API ล้วน (ไม่ใช้หน้า storefront) และใช้ compose ของ OPS-1
- ~~Q-O1~~ ตัดสินแล้ว (owner 2026-10-27): rate limiting **เลื่อนหลัง v1.0** — OPS-3b ย้ายไป backlog (ข้อเสนอด้านล่างเก็บไว้ใช้ตอนกลับมาทำ)
- ~~Q-O2~~ ตัดสินแล้ว (owner 2026-10-27): Sentry **เลื่อนหลัง v1.0** — OPS-3c ย้ายไป backlog; v1.0 ใช้ alert จาก log (AC-18)

## Open questions (รอบ 9 — ปิดแล้วรอบ 10)
- ~~Q-O1~~ (OPS-3b) เกณฑ์ rate limit และตำแหน่งที่บังคับ — **ข้อเสนอ**: บังคับที่ reverse proxy/load balancer ของ prod (ไม่เพิ่มโค้ด; Deliverables ข้อ 5 อนุญาต) ถ้า hosting ไม่มี proxy ที่ทำได้
  จึงทำเป็น middleware ใน backend ที่ใช้ Redis ที่มีอยู่ (ต้องมี ADR ก่อนเพราะเป็นกลไกใหม่); เกณฑ์เริ่มต้นต่อ IP: `/auth/customer/*` และ `/store/auth/*` 10 ครั้ง/นาที,
  `/store/group-buy/*/join` 30 ครั้ง/นาที (ต่อ customer), `/store/affiliate/r/*` 60 ครั้ง/นาที, `/store/search` และ `/store/products?q=` 120 ครั้ง/นาที; เกิน → 429 + `Retry-After`
  ต้องให้ owner ระบุ hosting/proxy ที่ใช้จริงและยืนยันตัวเลข
- ~~Q-O2~~ (OPS-3c) ใช้ Sentry แบบใด — **ข้อเสนอ**: Sentry SaaS (sentry.io) เก็บเฉพาะ error (`tracesSampleRate: 0`, Tracing เลื่อนไปตาม Deliverables ข้อ 6), `sendDefaultPii: false`,
  ทั้ง backend และ storefront, env `SENTRY_DSN`/`SENTRY_ENVIRONMENT` (ไม่ตั้ง = ปิด); builder ตรวจ docs instrumentation ของ Medusa v2 ก่อนเลือกวิธีผูก; ทางเลือก: self-host
  (เพิ่ม infra — ขัดหลักไม่เพิ่ม infra) หรือเลื่อน error tracking ไปหลัง v1.0 แล้วใช้ alert จาก log (AC-18) แทน
OPS-11 ∥ งานอื่น แต่แตะ e2e ของ FS-10 + `src/admin/widgets/flash-sale-options.tsx` — ทำเมื่อมี e2e admin ตัวที่สองเท่านั้น (ดูแถว OPS-11)
OPS-10 ∥ งานอื่น (แตะ `ci.yml` ขั้น `lint-typecheck`/`stripe listen`, `tools/ci/`, `docs/ops/production.md`) — PAY-6 แตะ `production.md` หัวข้อ runbook
คนละหัวข้อ ตัวที่ merge ทีหลัง rebase; OPS-7 แตะ `ci.yml` job `docker-worker-mode` คนละขั้นกับ OPS-10
