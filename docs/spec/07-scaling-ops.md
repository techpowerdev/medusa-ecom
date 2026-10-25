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
- AC-7 Given รัน `next dev` ใน storefront (มี env ของ AI agent) Then ไม่มีไฟล์ `apps/storefront/AGENTS.md` / `apps/storefront/CLAUDE.md` ถูกสร้าง
- AC-8 Given `TEST_TYPE=integration:modules` When `jest --listTests` Then ไม่มีไฟล์ `*.unit.spec.*`; Given `TEST_TYPE=unit` Then ไม่มีไฟล์
  integration ของ module (ทุก unit spec ยังถูกรันใน `test:unit` ครั้งเดียว)
- AC-9 (ADR-010) Given `NODE_ENV=production` และไม่ตั้ง `ALLOW_TEST_PROVIDERS=true` When `buildNotificationProviders` ถูกเรียกโดยไม่มี
  `RESEND_API_KEY` หรือไม่มี `RESEND_FROM_EMAIL` Then throw พร้อมชื่อตัวแปรที่ขาด; Given `ALLOW_TEST_PROVIDERS=true` Then ได้ provider
  `local` ตามเดิม; Given ไม่ใช่ production Then พฤติกรรมเดิม (unit)
- AC-10 (ADR-010, ขึ้นกับคำตอบ owner spec 06 Q2) Given `NODE_ENV=production` ไม่มี `ALLOW_TEST_PROVIDERS` When รัน seed บน DB ว่าง Then
  region Thailand มี payment provider เฉพาะ `pp_stripe_stripe`, `pp_stripe-promptpay_stripe`; Given `ALLOW_TEST_PROVIDERS=true` Then มี
  `pp_system_default` ด้วย (integration)
- AC-11 (ADR-010) Given DB ที่ region มี `pp_system_default` หรือ `STRIPE_API_KEY` ขึ้นต้นด้วย `sk_test_` หรือตั้ง `ALLOW_TEST_PROVIDERS`
  When รัน `pnpm --filter backend check:go-live` ด้วย `NODE_ENV=production` Then exit code ≠ 0 และพิมพ์รายการที่ไม่ผ่าน;
  เมื่อครบทุกข้อ Then exit 0 (integration) — checklist go-live ใน `docs/ops/production.md` อ้างคำสั่งนี้

## Tasks
| ID | Task | Depends |
|----|------|---------|
| OPS-1 | Dockerfiles + compose + env ของ worker mode + health (AC-1) | CORE-1 |
| OPS-2 | Prod config: Redis modules, pool size, S3, เอกสาร CDN | OPS-1 |
| OPS-3 | Logging/Sentry + rate limiting + worker ฟื้นตัว/จบ process เมื่อ Redis ขาดตามที่ ADR-012 ตัดสิน (AC-5) | OPS-1, ADR-012 accepted |
| OPS-4 | k6 scripts + nightly CI job + evidence (AC-2, AC-3) | FS-6, GB-7 |
| OPS-5 | ตรวจสอบ index + migrations; runbook สำหรับ backup/restore (AC-4) | ทุก module |
| OPS-6 | Tooling: Next `output: "standalone"` + Dockerfile storefront ใช้ `.next/standalone`, `agentRules: false`, แก้ `testMatch` ของ jest ไม่ให้ unit spec ถูกจับซ้ำ (AC-6, AC-7, AC-8) | OPS-1 |
| OPS-7 | Prod guards ตาม ADR-010: fail-fast เมื่อขาด `RESEND_API_KEY`/`RESEND_FROM_EMAIL`, seed ไม่เปิด `pp_system_default` ใน prod, script `check:go-live` + checklist go-live ใน `docs/ops/production.md`, ตั้ง `ALLOW_TEST_PROVIDERS=true` ใน CI job ที่รันโหมด production (AC-9, AC-10, AC-11) | OPS-2, PAY-1, CORE-3, ADR-010 accepted, คำตอบ spec 06 Q2 |
OPS-3 ∥ OPS-6 ∥ OPS-7 (OPS-6 แตะ `next.config.js`/Dockerfile/jest config; OPS-7 แตะ `notification-providers.ts`/seed/`ci.yml` —
ถ้า CORE-10 merge ก่อน OPS-7 ต้อง rebase ส่วน seed)
