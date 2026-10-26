# 07 Scaling และการปฏิบัติการ (operations)

สถานะ: draft
เป้าหมาย (เจ้าของ): รองรับผู้ใช้จำนวนมากได้ดี; พร้อมใช้งาน production ไม่ over-engineering: ทุกอย่าง
ในนี้คือ production setup ตามเอกสารของ Medusa บวกกับ index อีกไม่กี่ตัวและ load test

## สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | วิธีใช้ |
|------|-----------------|-----|
| แยก HTTP ออกจากงาน background | `workerMode: "server" | "worker"` | 2 deployables |
| Events / jobs แบบคงทน (durable) | Redis Event Bus, Redis Workflow Engine, Redis Locking, Redis Cache modules | เปิดใช้ใน prod |
| Horizontal scaling ของ API | Server แบบ stateless; flag `--cluster` | N replicas |
| DB pooling | `databaseDriverOptions` | ตั้งค่า pool size |
| Static assets | File module S3 provider + CDN | S3 + CDN |
| Caching ของ storefront | Next.js ISR/`revalidateTag` + Medusa publishable key | ค่าเริ่มต้นของ starter |
| การเชื่อมต่อ Redis ของ event bus | option `redisOptions` (ioredis), `workerOptions` (BullMQ) ของ Redis Event Bus module | ตั้งค่า (ADR-012) |
| Liveness | `GET /health` ของ Medusa (ไม่ตรวจ Redis/BullMQ worker) | ใช้ตามเดิม; ช่องว่างแก้ตาม ADR-012 |
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
   `/store/affiliate/r/*`
6. Observability: JSON logs พร้อม request id, error tracking (Sentry), `/health` สำหรับ liveness
   (Tracing เลื่อนไปจนกว่าจะมีความจำเป็นที่วัดได้)
7. Backups: snapshot Postgres รายวัน; จัดทำเอกสารการซ้อม restore
8. Load test: k6 scripts ใน `tools/load/` สำหรับ browse, flash-sale burst, group-buy join;
   รันใน CI ทุกคืนกับ staging; บันทึกผลไว้ที่ `docs/evidence/scale/`
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

## Acceptance criteria
- AC-1 Backend boot เป็น `server` และ `worker` ได้จาก image เดียวกัน; scheduled jobs รันเฉพาะบน worker
- AC-2 k6 flash-sale burst: 500 rps เป็นเวลา 60 วินาที กับ `total_cap=100` → มี order ที่ได้ส่วนลด
  พอดี 100 รายการ, p95 < 300ms, 0 5xx
- AC-3 k6 group-buy join: การเข้าร่วมพร้อมกัน 200 ครั้งกับกลุ่มขนาด 10 คน → มีสมาชิกพอดี 10 คน
- AC-4 ซ้อม restore จาก backup สำเร็จและร้าน boot ได้ (runbook)
- AC-5 (ADR-012) Given compose แบบ prod (1 server + 1 worker + Redis, `NODE_ENV=production`) When Redis ถูก `docker pause` นาน 30 วินาที
  (worker เจอ `ETIMEDOUT`) แล้ว unpause Then event ที่ emit จาก server หลัง unpause ถูก subscriber บน worker ประมวลผลภายใน 60 วินาที —
  หรือ worker process จบด้วย exit code ≠ 0 ภายใน 60 วินาที แล้วถูก restart (restart policy) และประมวลผล event ได้; ไม่มีกรณีที่ worker
  ค้างโดยไม่ประมวลผลขณะที่ health ยังตอบ 200 (script `tools/ops/smoke-redis-outage.sh`)
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

## Tasks
| ID | Task | Depends |
|----|------|---------|
| OPS-1 | Dockerfiles + compose + env ของ worker mode + health (AC-1) | CORE-1 |
| OPS-2 | Prod config: Redis modules, pool size, S3, เอกสาร CDN | OPS-1 |
| OPS-3 | Logging/Sentry + rate limiting | OPS-1 |
| OPS-4 | k6 scripts + nightly CI job + evidence (AC-2, AC-3) | FS-6, GB-7 |
| OPS-5 | ตรวจสอบ index + migrations; runbook สำหรับ backup/restore (AC-4) | ทุก module |
| OPS-6 | Tooling: Next `output: "standalone"` + Dockerfile storefront ใช้ `.next/standalone`, `agentRules: false`, แก้ `testMatch` ของ jest ไม่ให้ unit spec ถูกจับซ้ำ (AC-6, AC-7, AC-8) | OPS-1 |
| OPS-7 | Prod guards ตาม ADR-010 (accepted, D1): fail-fast เมื่อขาด `RESEND_API_KEY`/`RESEND_FROM_EMAIL` (AC-9), seed ไม่เปิด `pp_system_default` ใน prod (AC-10), script `check:go-live` + checklist go-live ใน `docs/ops/production.md` (AC-11), ตั้ง `ALLOW_TEST_PROVIDERS=true` ใน CI job ที่รันโหมด production; fail-fast `AFFILIATE_TOKEN_SECRET` + ตั้งตัวแปรใน job `docker-worker-mode` (เพิ่ม 2026-10-26 จาก review AF-2, AC-13); fail-fast `STOREFRONT_URL` (รอบ 7, AC-17 — ถ้า GB-4 ยังไม่ merge ตอนเริ่ม OPS-7 ให้ทำส่วนนี้เมื่อ GB-4 merge แล้ว ไม่แตะโค้ดอีเมลของ GB-4) | OPS-2, PAY-1, CORE-3, AF-2 (#66), GB-4 (#89, เฉพาะ AC-17) |
| OPS-10 | (เล็ก, CI) commit test ของ `tools/ci/classify-changes.sh` (30 เคส) ให้รันใน `lint-typecheck` (AC-14) + หัวข้อ "Stripe webhooks" ใน `docs/ops/production.md` และ `--events` ของ `stripe listen` ใน `ci.yml` ตรงกัน พร้อม check อัตโนมัติ (AC-15) | PAY-2 |
| OPS-8 | Worker ฟื้นตัว/จบ process เมื่อ Redis ของ event bus ขาด ตาม ADR-012 (accepted): `tools/ops/smoke-redis-outage.sh` (fail ก่อนแก้) + ตั้ง `redisOptions`/`workerOptions` ใน `infra-modules.ts` (AC-5) | OPS-2 |
| OPS-9 | (เล็ก) typecheck ในเครื่องล้มที่ `group-buy-campaigns.spec.ts` เมื่อมี `.medusa/types` (typed `query.graph` ของ link) — แก้ที่ test ให้ type ตรงกับ type ของ link ที่ Medusa generate (เช่น อ่านผ่าน type ของ entity/cast ให้ตรง) **ไม่** exclude `.medusa/types` จาก tsconfig (ทำให้ typed query ทั้งโปรเจกต์หายและ CI กับเครื่อง dev typecheck ต่างกันมากขึ้น); ถ้าแก้ที่ test ไม่ได้ให้หยุดและรายงาน (AC-12) | GB-2a |
| OPS-11 | (เล็ก, e2e tooling, รอบ 6) ย้าย login admin + header `x-forwarded-proto` จาก e2e admin ของ FS-10 ไปเป็น helper ร่วม `e2e/support/admin.ts` + `data-testid` ที่ `Container` ของ widget "Flash sale options" แทน locator `div.last()` (AC-16) — **ทำเมื่อมี e2e admin ตัวที่สอง** (ตัวแรกที่จะเริ่มจาก EV-5b, EV-9, GB-6b, GB-6c, AF-6): ถ้า OPS-11 ยังไม่ merge ตอน task นั้นเริ่ม ให้รวม OPS-11 ไว้ใน PR ของ task นั้น (ไม่สร้าง helper ก่อนมีผู้ใช้สองที่) | FS-10 (#74) |
OPS-3 ∥ OPS-6 ∥ OPS-7 ∥ OPS-8 ∥ OPS-9 (OPS-9 แตะเฉพาะ `integration-tests/http/group-buy-campaigns.spec.ts`; OPS-6 แตะ `next.config.js`/Dockerfile/jest config; OPS-7 แตะ `notification-providers.ts`/seed/`ci.yml`;
OPS-8 แตะ `infra-modules.ts`/`tools/ops/` — ถ้า CORE-10 merge ก่อน OPS-7 ต้อง rebase ส่วน seed)
OPS-11 ∥ งานอื่น แต่แตะ e2e ของ FS-10 + `src/admin/widgets/flash-sale-options.tsx` — ทำเมื่อมี e2e admin ตัวที่สองเท่านั้น (ดูแถว OPS-11)
OPS-10 ∥ งานอื่น (แตะ `ci.yml` ขั้น `lint-typecheck`/`stripe listen`, `tools/ci/`, `docs/ops/production.md`) — PAY-6 แตะ `production.md` หัวข้อ runbook
คนละหัวข้อ ตัวที่ merge ทีหลัง rebase; OPS-7 แตะ `ci.yml` job `docker-worker-mode` คนละขั้นกับ OPS-10
