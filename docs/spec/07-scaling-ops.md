# 07 Scaling และการปฏิบัติการ (operations)

สถานะ: draft (ปิดรอบ 36 2026-11-18: ☑ OPS-28 #403, OPS-29 #407 (owner สั่งทำ 2026-11-18) — หัวข้อ "Follow-up รอบ 36" done; รอบ 36 2026-11-18: follow-up ของ OPS-27 #399 → OPS-28 (AC-43 — ขั้นตรวจ "ต้องไม่พบ" ใน CI ล้มเมื่อ grep error ไม่ผ่านเงียบ) → OPS-29 (AC-44 — ไม่มีไฟล์ test ที่ compile แล้วใน image) — หัวข้อ "Follow-up รอบ 36"; ปิดรอบ 35 2026-11-18: ☑ OPS-27 #399 — หัวข้อ "Follow-up รอบ 35" done; รอบ 35 2026-11-18: ผล qa ADM-22 (spec 08) — `medusa build` ที่ไม่ตั้ง `NODE_ENV` ได้ admin แบบ development (stack trace ในหน้า error) → owner ตัดสินข้อ ก "แก้ที่การ build" → OPS-27 (AC-42) ตั้ง `NODE_ENV=production` เฉพาะขั้น build ใน Dockerfile + CI + คำสั่ง prod-like ใน `CLAUDE.md` — หัวข้อ "Follow-up รอบ 35", Q-O6 = ก owner 2026-11-18 (วิธีให้ build ผ่าน guard ตอนโหลด config); รอบ 33 2026-11-17: owner ตัดสิน OPS-26 ต่อ = ก หยุด วัดบน staging เป็นรายการก่อน go-live (ท้ายหัวข้อ "Follow-up รอบ 32"), checklist bump ข้อ 10 (สวิตช์ `is_tax_inclusive` ของ dashboard — spec 01 CORE-64); ปิดรอบ 32 2026-11-17: ☑ OPS-26 #385 — AC-41 สรุปไม่เปลี่ยนวิธี deploy prod ไม่เปิด ADR-024 (→ ADR-027 — รอบ 40), แก้กฎ (d) เป็น 10 × (n + 1) และข้อเท็จจริง `--cluster` ของ 2.22.1; รอบ 32 2026-11-17: Q-O5 = ก owner 2026-11-17 → OPS-26 (AC-41) วัด server 1 vs 2 process — หัวข้อ "Follow-up รอบ 32"; ปิดรอบ 30/31 2026-11-14: ☑ OPS-25 #366, OPS-23 #371 — AC-38 สรุปคง default pool 10 ไม่เปิด ADR-020; ปิดรอบ 29 2026-11-13: ☑ OPS-22 #354, OPS-24 #356 — sync สถานะเท่านั้น; รอบ 26 2026-11-09: OPS-21 (AC-36 — **บล็อก release v0.1.0**), OPS-22 (AC-37), OPS-23 (AC-38 — owner Q-O4 = ก 2026-11-09); รอบ 21 2026-11-04: Deliverables ข้อ 11 — prod ต้องอยู่หลัง HTTPS เพราะ session cookie ของ admin เป็น `Secure` (qa #285 O-1, ไม่มี task); รอบ 17 2026-11-04: OPS-17c (AC-35) — nit review #242: stdout/stderr ของ `docker run` k6 ผ่าน redact + static test ที่เข้มขึ้น, ก่อน OPS-20b; รอบ 16 2026-11-04: OPS-17b (AC-34) — scan secret ก่อนพิมพ์ลง job log + redact console ของ k6, ทำก่อน OPS-20b; รอบ 13 2026-11-03: follow-up ของ OPS-18 #194 → OPS-17a (AC-33) + OPS-17 (AC-28 ส่วนรอบ 13), ลำดับ OPS-20a → OPS-17a → OPS-17 → OPS-20b)
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
| ตรวจ env ที่ต้องมีตอนบูต | ไม่มี (Medusa ตรวจเฉพาะ option ของ module ตอนใช้) | **ขยาย** `checkBootEnv` ของเรา (`src/lib/prod-guards.ts`, OPS-7) — OPS-21 |

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
   - `EVOUCHER_ENCRYPTION_KEY` — กุญแจเข้ารหัส code/PIN ของ e-voucher 64 hex (spec 02 กฎข้อ 4; production ขาดหรือรูปแบบผิด = บูตไม่ขึ้น, OPS-21)
   - `AFFILIATE_TOKEN_SECRET` — secret ของ cookie `aff` (spec 05 กฎ 22; production ขาด = บูตไม่ขึ้น, OPS-7)
   - `STOREFRONT_URL` — origin ของ storefront (เช่น `https://shop.example.com` ไม่มี `/` ท้าย) ที่ backend ใช้สร้างลิงก์ชำระเงิน `/account/orders/:id/pay` ในอีเมล
     "กลุ่มสำเร็จ" ของ GB-4 (spec 04) — ไม่ตั้ง = GB-4 (#89) ใส่ลิงก์เป็น path อย่างเดียว (ลูกค้ากดจากอีเมลไม่ได้) และ production มีเพียง
     `storefrontUrlWarning` → fail-fast ใน OPS-7 (AC-17)
   - `OPS_ALERT_EMAIL` — mailbox รับ alert ของ ops: `PAYMENT_WEBHOOK_SESSION_NOT_FOUND` (ADR-015, spec 06 กฎข้อ 7D, PAY-6), `GROUP_BUY_PAID_WITHOUT_ORDER`/`GROUP_BUY_PAYMENT_CHECK_GAVE_UP` (spec 04),
     `REFUND_FAILED`/`REFUND_STUCK`/`STRIPE_REFUND_FAILED` (ADR-029, spec 06 กฎข้อ 22–23 — PAY-20/21) — แยกจาก `EVOUCHER_ADMIN_EMAIL` (แก้ถ้อยคำปิดรอบ 42 ตาม PAY-20 #550)
   - Stripe webhook endpoint เดียว (`/hooks/payment/stripe_stripe`, ADR-023) ต้องสมัคร event ตามรายการใน `docs/ops/production.md` หัวข้อ "Stripe webhooks" (OPS-10)
10. Runbook ลำดับ release: migrate → รีสตาร์ต backend (server + worker, reindex search ตอนบูต) → ตรวจ index → ปล่อย storefront
    (`docs/ops/production.md` หัวข้อ "ลำดับ release"; spec 01 กฎข้อ 15) — เพิ่มใน docs 2026-10-26 ไม่มี task โค้ด
11. (รอบ 21 2026-11-04 — qa #285 O-1, หมายเหตุ ไม่มี task) **admin และ store API ของ prod ต้องอยู่หลัง HTTPS**: เมื่อ `NODE_ENV=production` (หรือ staging) Medusa ตั้ง session cookie
    เป็น `{ sameSite: "lax", secure: true }` เป็นค่า default (`resolveSessionCookieSecurity` ใน `@medusajs/framework` http express loader; ตั้งทับได้ด้วย `projectConfig.cookieOptions`
    ตั้งแต่ v2.8.5 — https://docs.medusajs.com/learn/configurations/medusa-config) → login admin ผ่าน http ที่ไม่ใช่ localhost ไม่ติด (qa #285 ทำซ้ำด้วย `medusa start` บน 2.22.1);
    loader ตั้ง `app.set("trust proxy", 1)` แล้ว จึง terminate TLS ที่ reverse proxy/load balancer ชั้นเดียวได้ (proxy ต้องส่ง `X-Forwarded-Proto: https`);
    **ห้าม**ตั้ง `cookieOptions.secure: false` ใน `medusa-config.ts` ที่ commit — ~~ทดสอบแบบ prod ในเครื่องให้เปิดผ่าน `localhost` (หรือ tunnel HTTPS)~~
    **(แก้รอบ 40 — OPS-M-12 ของการทดสอบ manual 2026-11-20 พิสูจน์ว่าผิด)** prod build ผ่าน `http://localhost` ก็ login admin ไม่ได้ (server ไม่ส่ง `Set-Cookie` เพราะ cookie `secure` และ request ไม่ใช่ https)
    → ทดสอบแบบ prod ในเครื่องต้องเข้า admin ผ่าน **HTTPS** (tunnel/reverse proxy ที่มี TLS) **หรือ** reverse proxy ที่ส่ง header `X-Forwarded-Proto: https` มาที่ server (อาศัย `trust proxy` ข้างต้น);
    `http://localhost` ตรงไปที่ `:9000` ใช้ไม่ได้ — คู่มือ/แผนทดสอบที่อ้างข้อนี้ต้องแก้ตาม (OPS-30 แก้ `docs/ops/production.md`)
    (ข้อมูล default มาจาก source ของ medusajs/medusa branch develop — ตอน bump `@medusajs/*` ให้ตรวจซ้ำตาม checklist ด้านล่าง)

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
9. (รอบ 26, owner Q8 ของ spec 08 = ก 2026-11-09) ถ้า `@medusajs/dashboard` เวอร์ชันใหม่แก้ปัญหา `createRouteMap` ผูก loader ซ้ำแล้ว (upstream ตามที่ระบุใน #311) ให้ลดเกณฑ์ AC-15 ของ spec 08 กลับเป็น ≤ 2 ใน PR ที่ bump — ไม่มี task ล่วงหน้า
10. (รอบ 33, spec 01 กฎข้อ 122 / CORE-64) ฟอร์มสร้าง/แก้ promotion ของ `@medusajs/dashboard` ยังมีสวิตช์ `is_tax_inclusive` ("Does promotion include taxes?") สำหรับ template fixed
    (`routes/promotions/promotion-create/components/create-promotion-form/templates.ts`, `create-promotion-form.tsx`) และค่าเริ่มต้นยังเป็นแบบเดิม — ถ้าเปลี่ยน แก้คู่มือ `docs/guides/admin-promotions.md` ใน PR ที่ bump; AC-163(a) ของ spec 01 ผ่าน

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
- AC-4 ซ้อม restore จาก backup สำเร็จและร้าน boot ได้ (runbook) — **☑** OPS-5: runbook `docs/ops/database.md` หัวข้อ "Backup และ restore ของ Postgres", ซ้อม 2026-11-09 บนเครื่อง dev (`docs/evidence/ops/OPS-5-tests.txt` ข้อ 10); ก่อน go-live ซ้อมซ้ำบน environment จริงตาม go-live checklist ข้อ 7
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
- AC-36 (OPS-21, รอบ 26 — **บล็อก release v0.1.0**; ตรวจบน develop: `x-backend-env` ใน `docker-compose.prod.yml:33–63` ไม่มีสี่ตัวนี้ และ `checkBootEnv` ตรวจแค่ `AFFILIATE_TOKEN_SECRET`/`STOREFRONT_URL`
  ส่วน `EVOUCHER_ENCRYPTION_KEY` ถูกตรวจตอนใช้ — ร้านบูตได้แต่ import/encrypt/reveal/อีเมล voucher ล้ม) unit (`prod-guards.unit.spec.ts`, อ่าน YAML ด้วย parser):
  (a) `x-backend-env` มี key `EVOUCHER_ENCRYPTION_KEY`, `EVOUCHER_ADMIN_EMAIL`, `OPS_ALERT_EMAIL` (รูปแบบ `${X:-}` เหมือน OPS-7) และ `TZ: UTC` ค่าคงที่ (Deliverables ข้อ 9 — ไม่รับค่าจาก shell) และ service `migrate`/`server`/`worker` ได้ทั้งสี่ตัว;
  (b) Given `NODE_ENV=production` When โหลด config โดย `EVOUCHER_ENCRYPTION_KEY` ว่าง หรือไม่ใช่ 64 hex (`"abc"`) Then throw ข้อความมีชื่อตัวแปร (ตรวจด้วย `parseEncryptionKey` ของ `modules/evoucher/utils/crypto` ตัวเดิม ไม่เขียน regex ซ้ำ)
  และ `ALLOW_TEST_PROVIDERS=true` ไม่ปิด guard นี้ (เหมือน AC-13); Given ค่า 64 hex ถูกต้อง Then ไม่ throw;
  (c) Given production ที่ไม่ตั้ง `EVOUCHER_ADMIN_EMAIL` หรือ `OPS_ALERT_EMAIL` Then **ไม่ throw** (spec 02 กฎข้อ 9, ADR-015 — ส่งข้ามพร้อม warn) แต่ `checkBootEnv` คืน warning ที่มีชื่อตัวแปรนั้นตัวละ 1 ข้อ;
  (d) Given `NODE_ENV=development` และไม่ตั้งสามตัวนี้ Then ไม่ throw; (e) `it.each` ของ "every production-mode job sets %s" รวม `EVOUCHER_ENCRYPTION_KEY` — job production-mode ใน `ci.yml` และ `tools/ops/smoke-*.sh`, `tools/load/run.sh`
  ตั้งค่าแล้ว (script ใช้ `openssl rand -hex 32` แบบ `AFFILIATE_TOKEN_SECRET`; `ci.yml` ใส่ค่า 64 hex ระดับ job ทั้งสอง job ที่ตั้ง `AFFILIATE_TOKEN_SECRET` อยู่ เพราะ guard ตรวจรูปแบบ — หรือปรับ test ถ้า job ใดไม่ได้รันโหมด production จริง); (f) `docs/ops/production.md` หัวข้อ guard และ go-live checklist ระบุ `EVOUCHER_ENCRYPTION_KEY` (grep); job `docker-worker-mode` ผ่าน
- AC-37 (OPS-22, รอบ 26 — `prod-guards.unit.spec.ts`/`ops-runbook.unit.spec.ts`/`ci-workflow.unit.spec.ts`, `check-stripe-events.sh` และ `backup-runbook.unit.spec.ts` (ของ OPS-5 ยังไม่อยู่บน develop) อ่าน `docs/ops/**` แต่ `classify-changes.sh:29` นับเป็นเอกสาร) `classify-changes.test.sh` เคสใหม่:
  `docs/ops/production.md` → `true/true`; `docs/ops/production.md` + `docs/spec/01.md` → `true/true`; rename `docs/ops/a.md` → `docs/archive/a.md` → `true/true`; `docs/spec/01.md`, `docs/evidence/**`, `CLAUDE.md`, `docs/ROADMAP.md` ยัง `false/false`;
  comment หัวไฟล์ระบุเหตุผล; เคสเดิม 30 เคสที่ไม่เกี่ยวกับ `docs/ops/` ผ่านโดยไม่แก้; grep: ประโยค "PR เอกสารล้วน" ใน `CLAUDE.md` ระบุข้อยกเว้น `docs/ops/**`
- AC-38 (OPS-23, รอบ 26 — owner Q-O4 = ก 2026-11-09) Given run ของ `load-nightly.yml` (`workflow_dispatch`) ที่ `DATABASE_POOL_MAX` = 10 (ค่าเดิม), 20, 40 ค่าละอย่างน้อย 1 run (commit เดียวกัน)
  Then `docs/evidence/scale/OPS-23/REPORT.md` มี run id ทุกตัว, ตาราง (d)/(e) ของ AC-31 และ pool wait/connection ตาม AC-32 ต่อค่า, ข้อสรุปว่า (d)/(e) อธิบายได้ด้วย pool หรือไม่ และค่าที่เสนอ (ถ้ามี);
  gate AC-2/AC-3/AC-33 ผ่านทุก run; ไม่เพิ่ม infra/dependency; ถ้าเสนอเปลี่ยนค่า prod → ADR-020 สถานะ proposed แยก (เลขนี้เท่านั้น)
- AC-39 (OPS-24, ปิดรอบ 26 — nit review #325; ตรวจบน develop `0d1c678b`: `checkBootEnv` ใน `apps/backend/src/lib/prod-guards.ts:59` ใช้ `!env[name]` แต่ผู้ใช้ค่าจริง `.trim()` ก่อน (`subscribers/evoucher-payment-captured.ts:28`, `jobs/evoucher-daily.ts:40`, `subscribers/group-buy-payment-captured.ts:58`, `subscribers/payment-webhook-orphan.ts:63`) ค่าช่องว่างล้วนจึงไม่ได้ warning ตอนบูตแต่อีเมลถูกข้าม)
  unit (`prod-guards.unit.spec.ts`): Given production ที่ `EVOUCHER_ADMIN_EMAIL: "   "` When `checkBootEnv` Then warnings มีข้อที่มีชื่อตัวแปรนั้น 1 ข้อ (เหมือนไม่ตั้ง) และไม่ throw; ทำซ้ำกับ `OPS_ALERT_EMAIL`; ค่าอีเมลจริง → ไม่มี warning ของตัวนั้น;
  static (อ่าน `docker-compose.prod.yml` เป็นข้อความ): บรรทัด comment `export` ต้นไฟล์มี `EVOUCHER_ENCRYPTION_KEY=`; AC-36 ผ่านโดยไม่แก้
- AC-40 (OPS-25, รอบ 30 — nit review #354; ตรวจบน develop `8fb44d70`: comment `tools/ci/classify-changes.sh:8–9` ให้เหตุผลว่า `ci-workflow.unit.spec.ts` และ `tools/ci/check-stripe-events.sh` อ่าน `docs/ops/**` แต่ `ci-workflow.unit.spec.ts` อ่านแค่ `ci.yml`/`package.json`
  และ `check-stripe-events.sh` รันใน `lint-typecheck` ทุก PR อยู่แล้ว (ไม่ขึ้นกับ `code=`) — เหตุผลจริงคือ `prod-guards`/`ops-runbook`/`backup-runbook.unit.spec.ts` ซึ่งรันใน job `backend-suites` เฉพาะเมื่อ `backend=true` (`.github/workflows/ci.yml:76` `if: needs.changes.outputs.backend == 'true'`; แก้จาก "`code=true`" 2026-11-14 — `docs/ops/**` ได้ทั้ง `code=true` และ `backend=true`); `.github/workflows/ci.yml:50` comment "30 เคส" แต่ `classify-changes.test.sh` มี 35 เคสหลัง OPS-22)
  grep: comment หัว `classify-changes.sh` ส่วน `docs/ops/**` มี `prod-guards`, `ops-runbook`, `backup-runbook` และไม่อ้าง `ci-workflow` เป็นเหตุผล; `ci.yml` ไม่มี "30 เคส" (ระบุ 35 หรือไม่ระบุจำนวน); `classify-changes.test.sh` และ `ci-workflow.unit.spec.ts` ผ่านโดยไม่แก้ (เปลี่ยนเฉพาะ comment)

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
| OPS-20b | (เล็ก, วัดผล) ตัวชี้วัดความอิ่มตัว: event-loop delay ของ server/worker ใน `instrumentation.ts` (เฉพาะ `LOG_LEVEL=debug`), sampler `docker stats`/`pg_stat_activity` ใน `run.sh`, รอ pool ของ knex + รันเทียบมี/ไม่มี burst อีกสองครั้ง + สรุปเรื่องอิ่มตัวใน evidence (AC-32) — ☑ #318 | OPS-20a ☑ #204, **OPS-17** ☑ #235 (รอบ 13 — ลำดับ OPS-20a → OPS-17a → OPS-17 → OPS-20b; ชน `tools/load/run.sh`; ปิด token ใน artifact ก่อนรัน load เพิ่มอีกสองครั้ง); (รอบ 16–17) **OPS-17b ☑ #242 และ OPS-17c ☑ #253** ก่อน (ชน `run.sh`) — รอบ 18: dependency ครบ **เริ่มได้** |
| OPS-19 | (staging load test) burst 500 rps × 60s จริง + p95 < 300ms เป็น gate (AC-30) — **⏸ backlog**: ต้องมี ADR สำหรับ staging (infra ใหม่ ตามข้อห้ามข้อ 3) ก่อน — ยังไม่มี ADR | ADR staging (ยังไม่มี), OPS-4 ☑ |
| OPS-17 | (เล็ก, test/tooling, รอบ 12 — nit OPS-16 #180, review #175) `prod-guards.unit.spec.ts` อ่าน `ci.yml` ด้วย parser YAML, `IMAGE_TAG` ค่าเริ่มต้น `load` ใน `tools/load/run.sh`, ตัด cast ใน `seed-load.ts`; (รอบ 13, review #194) `hold_rank_corr` ใน `lock-timing.js` เป็น O(n) (AC-28) — ไฟล์เพิ่ม: `tools/load/lock-timing.js` + unit | OPS-16 ☑ (#180), OPS-4 ☑ (#175), **OPS-17a** (รอบ 13 — ชน `tools/load/run.sh`) |
| OPS-17a | (เล็ก, **ความปลอดภัย** — ทำก่อน OPS-17, รอบ 13 — review/qa #194 OPS-18) summary/artifact ของ k6 ไม่มี `setup_data`/JWT ของลูกค้า load test (มีมาตั้งแต่ OPS-4) + ขั้นตรวจ JWT ท้าย `run.sh` (AC-33) — ไฟล์: `tools/load/{flash-sale,group-buy-join}.js`, `tools/load/run.sh`, unit ของ `tools/load` | OPS-4 ☑ (#175), **OPS-20a (#204) merge** (ชน `run.sh`, `flash-sale.js`) |
| OPS-17b | (เล็ก ~100 LOC, **ความปลอดภัย**, รอบ 16 — review/qa 2026-11-04) redact JWT ใน console ของ k6 ก่อนลง job log + test ล็อกลำดับ "scan ก่อน cat" ของ `cleanup()`/report + static test `console.*` ของ k6 (AC-34) — ไฟล์: `tools/load/run.sh` (รวมบรรทัด 132 `k6-failures.txt` — AC-34), `tools/load/artifact-guard.js` (+ unit), `tools/load/{flash-sale,group-buy-join}.js` (ถ้าต้องแก้) | OPS-17a ☑ และ OPS-17 ☑ (#235 — `artifact-guard.js` อยู่ใน develop `abbbc92` แล้ว); ชน `run.sh` กับ OPS-20b → **OPS-17b ก่อน OPS-20b** — ☑ #242 |
| OPS-17c | (เล็ก ~60 LOC, ความปลอดภัย/test, รอบ 17 — nit review #242) stdout/stderr ของ `docker run` k6 ผ่าน redact (คง exit code), static test `console.*` จับ `JSON.stringify(`, ตัวตรวจ "พิมพ์ก่อน scan" ไม่ข้ามทั้งบรรทัดที่มี `grep -q` (AC-35) — ไฟล์: `tools/load/run.sh` (`k6()`), test ของ `tools/load` ที่ OPS-17b เพิ่ม | **OPS-17b (#242) merge** (แก้ test/โค้ดที่ #242 เพิ่ม); ชน `run.sh` กับ OPS-20b → ทีละตัว ลำดับแนะนำ **OPS-17c ก่อน OPS-20b** (เล็ก, ปิดช่อง log ก่อนรัน load เพิ่ม) — ☑ #253 |
| OPS-5 | ตรวจสอบ index + migrations; runbook สำหรับ backup/restore (AC-4) — ☑ #319 | ทุก module |
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
| OPS-21 | (เล็ก ~80 LOC, **บล็อก release v0.1.0**, รอบ 26 — qa/review รอบ 25) compose prod ส่ง `EVOUCHER_ENCRYPTION_KEY`/`EVOUCHER_ADMIN_EMAIL`/`OPS_ALERT_EMAIL`/`TZ` + guard หยุดบูตเมื่อขาดกุญแจ (AC-36) — ไฟล์: `docker-compose.prod.yml`, `apps/backend/src/lib/prod-guards.ts`, `src/__tests__/prod-guards.unit.spec.ts`, `src/__tests__/medusa-config.infra.unit.spec.ts` (ค่าใน PROD env), `.github/workflows/ci.yml` (job production-mode), `tools/ops/smoke-{worker-mode,redis-outage}.sh`, `tools/load/run.sh`, `docs/ops/production.md` — ☑ #325 | none — **เริ่มได้**; ชน `tools/load/run.sh` กับ OPS-20b (#318 ถ้ายังไม่ merge) ตัวที่ merge ทีหลัง rebase; ชน `docs/ops/production.md` กับ OPS-5 (#319) ตัวที่ merge ทีหลัง rebase; ไม่แตะ `medusa-config.ts` |
| OPS-22 | (เล็ก ~20 LOC, CI, รอบ 26 — follow-up รอบ 25 ข้อ F) `classify-changes.sh` นับ `docs/ops/**` เป็นโค้ด (`code=true`, `backend=true`) เพราะ unit test อ่านไฟล์เหล่านี้ และปรับประโยค "PR เอกสารล้วน" ใน `CLAUDE.md` ให้ยกเว้น `docs/ops/**` ตามคำตัดสิน owner 2026-11-09 (AC-37) — ไฟล์: `tools/ci/classify-changes.sh`, `tools/ci/classify-changes.test.sh`, `CLAUDE.md` — ☑ #354 | none — **เริ่มได้**; ไม่บล็อก release; ควร merge ก่อน PR เอกสารที่แก้ `docs/ops/` (∥ OPS-21: OPS-21 แตะ `docs/ops/production.md` แต่มีไฟล์โค้ดจึงรัน test อยู่แล้ว) |
| OPS-23 | (วัดผล ไม่แตะโค้ด app, รอบ 26 — load test #318) เทียบ `DATABASE_POOL_MAX` 10/20/40 ใน load-nightly (AC-38) — ไฟล์: `.github/workflows/load-nightly.yml` (`workflow_dispatch` input ถ้ายังไม่มี), `tools/load/run.sh` (ส่งค่า), `docs/evidence/scale/OPS-23/REPORT.md` — ☑ #371 (ผล: (d)/(e) อธิบายด้วยขนาด pool ไม่ได้ — server CPU เต็ม ~115% ทุกค่า pool ใหญ่ขึ้นแย่ลง → คง default 10 = ไม่ตั้ง `DATABASE_POOL_MAX`, **ไม่เปิด ADR-020**) | OPS-20b ☑ #318 (AC-32) (owner Q-O4 = ก 2026-11-09); ไม่บล็อก release |
| OPS-24 | (เล็ก ~15 LOC, ปิดรอบ 26 — nit review #325) comment `export` ต้น `docker-compose.prod.yml` เพิ่ม `EVOUCHER_ENCRYPTION_KEY` + `checkBootEnv` นับค่าช่องว่างล้วนของ `EVOUCHER_ADMIN_EMAIL`/`OPS_ALERT_EMAIL` ว่าไม่ได้ตั้ง (AC-39) — ไฟล์: `docker-compose.prod.yml`, `apps/backend/src/lib/prod-guards.ts`, `apps/backend/src/__tests__/prod-guards.unit.spec.ts` — ☑ #356 | none — **เริ่มได้**; ไม่บล็อก release; ∥ ทุกตัว (ไม่ชน OPS-22, OPS-23) |
| OPS-25 | (comment ล้วน ~5 LOC, รอบ 30 — nit review #354) เหตุผลใน comment ของ `classify-changes.sh` เรื่อง `docs/ops/**` ให้ตรงไฟล์ที่อ่านจริง + จำนวนเคสใน comment ของ `ci.yml` (AC-40) — ไฟล์: `tools/ci/classify-changes.sh`, `.github/workflows/ci.yml` (เป็นไฟล์โค้ดตาม `classify-changes.sh` → CI รันครบ) — ☑ #366 | none (OPS-22 ☑ #354); ไม่บล็อก release; ∥ ทุกตัว (OPS-23 แตะ `load-nightly.yml` ไม่ใช่ `ci.yml`) — หรือรวมเข้า PR ถัดไปที่แตะ `ci.yml` แล้วปิด OPS-25 |
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
(รอบ 26, 2026-11-09) OPS-21 ☐ **เริ่มได้ — บล็อก release v0.1.0**; OPS-22 ☐ เริ่มได้; OPS-23 ☐ หลัง OPS-20b
(ปิดรอบ 26, 2026-11-09) OPS-20b ☑ #318 · OPS-5 ☑ #319 · OPS-21 ☑ #325; OPS-22 ∥ OPS-23 ∥ OPS-24 ☐ เริ่มได้ (ไม่บล็อก release)
(รอบ 30, 2026-11-13) OPS-22 ☑ #354, OPS-24 ☑ #356 (ปิดรอบ 29); ใหม่: OPS-25 ☐ (nit review #354, AC-40 — owner ยังไม่สั่งทำ); OPS-23 ยังเริ่มได้;
ไม่เปิด task: integration ของ lock รันบน locking provider แบบ in-memory (#351) — production ใช้ `locking-redis` และ job `docker-worker-mode`/load test รันกับ Redis จริง (รายละเอียด spec 01 หัวข้อ "Follow-up รอบ 30")
(ปิดรอบ 30/31, 2026-11-14) OPS-25 ☑ #366, OPS-23 ☑ #371 — ผล AC-38 (`docs/evidence/scale/OPS-23/REPORT.md`): คง default pool 10 ไม่เปิด ADR-020 (เลข ADR-020 ยังว่าง); ข้อเสนอเพิ่ม CPU ฝั่ง server/ลดงาน CPU ต่อ request ของ checkout รอ owner (ROADMAP หัวข้อ "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 30/31)")

(รอบ 32, 2026-11-17) งาน CPU ของ checkout จากผล OPS-23 → Q-O5 = ก (owner 2026-11-17) → **OPS-26** ☐ (AC-41); เลข ADR-024 (→ ADR-027 — รอบ 40) สงวนไว้เฉพาะเมื่อผลทำให้ต้องเปลี่ยนวิธี deploy prod (ยังไม่เขียน)

(ปิดรอบ 32, 2026-11-17) OPS-26 ☑ #385 — ผล AC-41: ไม่เปลี่ยนวิธี deploy prod ไม่เปิด ADR-024 (→ ADR-027 — รอบ 40) (ดู "ผล OPS-26" ในหัวข้อ "Follow-up รอบ 32")

(รอบ 35, 2026-11-18) ผล qa ADM-22 → owner ข้อ ก "แก้ที่การ build" → **OPS-27** ☑ #399 (AC-42; owner สั่งทำ 2026-11-18) — เริ่มหลัง PR เอกสารรอบ 35 #398 merge (owner ตอบ Q-O6 = ก 2026-11-18) (หัวข้อ "Follow-up รอบ 35")

(รอบ 36, 2026-11-18) follow-up ของ review/builder/qa #399 → **OPS-28** ☑ #403 (AC-43) → **OPS-29** ☑ #407 (AC-44; ← OPS-28 เพราะแก้ step เดียวกันของ `ci.yml`) — owner สั่งทำ 2026-11-18 ไม่บล็อก release (หัวข้อ "Follow-up รอบ 36"; ปิดรอบ 36)

## Follow-up รอบ 32 (2026-11-17 — Q-O5 = ก)
Status: done (ปิดรอบ 32 2026-11-17 — OPS-26 ☑ #385; owner สั่งทำ 2026-11-17) · Out of scope: แก้โค้ด app/`medusa-config.ts`/ค่า pool, เปลี่ยน `docker-compose.prod.yml` ของ prod (ยกเว้นส่งค่าเข้า command ผ่าน env ของ load run), profile CPU (Q-O5 ทาง ข ไม่ทำ)

| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| หลาย server process ในเครื่องเดียว | `medusa start --cluster <n>` 2.22.1 (`@medusajs/medusa/dist/commands/start.js:175–313` — fork ตามจำนวน, primary fork ใหม่เมื่อลูกตาย; **แก้ข้อเท็จจริง ปิดรอบ 32 ตาม review #385**: process ที่ fork ใหม่ไม่ได้รับ message ให้บูต (`start.js:311–314`) จึงไม่รับ request — ไม่ใช่การกู้คืนอัตโนมัติ) | ใช้ตามเดิม — ส่ง flag จาก load run เท่านั้น |
| วัด checkout/CPU/event-loop/pool | sampler + `checkout-timing.md`/`saturation.md` ของ OPS-20b/OPS-23 (ของเรา) | ใช้ตามเดิม — ต้องรวมค่าจากทุก process (ดูกฎ) |

**กฎ (OPS-26)**: (a) `load-nightly.yml` มี `workflow_dispatch` input `server_processes` (ค่าเริ่มต้น `1`); `tools/load/run.sh` ส่งไปให้ container `server` รัน `medusa start --cluster <n>` เมื่อ n > 1 และคงคำสั่งเดิมทุกตัวอักษรเมื่อ n = 1 (nightly ตามตารางไม่เปลี่ยน);
`--cluster` ใช้กับ `server` เท่านั้น ไม่ใช้กับ `worker`; (b) report บันทึกบรรทัด `server processes (OPS-26): <n>` และยืนยันจำนวน process จริง (เช่น `ps` ใน container หรือ log บูตของแต่ละ process); (c) sampler ของ server ที่ใช้ event-loop/pool ต่อ process รายงานแยกต่อ process หรือรวม (ระบุใน REPORT) — CPU ของ container รวมทุก process;
(d) ค่า pool ต่อ process คง default 10 (ผลของ OPS-23) → connection รวม = 10 × (n + 1) (server n process + worker 1 — แก้ปิดรอบ 32 ตาม nit review #383; เดิมเขียน 10 × n) ต้องไม่เกิน `max_connections` 100 ของ Postgres; (e) ไม่เพิ่ม package/service; (f) ถ้าผลชี้ว่าควรเปลี่ยนวิธี deploy prod (เช่นใช้ `--cluster` ใน image แทน/คู่กับ replica ตาม Deliverables ข้อ 2) → ADR-024 (→ ADR-027 — รอบ 40) สถานะ proposed แยก (เลขนี้เท่านั้น) — ไม่แก้ prod ใน PR นี้

**AC-41 (OPS-26)** run `load-nightly` ด้วย `-f flash_burst=1 -f server_processes=1` และ `-f server_processes=2` บน commit เดียวกัน (ทีละ run ตาม concurrency group): gate AC-2/AC-3/AC-33 ผ่านทั้งสอง run (`failures: 0`, ไม่มี 5xx, ไม่ oversell);
`docs/evidence/scale/OPS-26/REPORT.md` รูปแบบเดียวกับ OPS-23: ตาราง run/artifact, (a)–(e) median/p95 ของ AC-31, ตาราง AC-32 (CPU server, event-loop ต่อ process, รอ pool, connection) และข้อสรุปว่า (d)/(e)/(a) ลดหรือไม่ พร้อมข้อจำกัด (runner 4 vCPU ใช้ร่วมกับ k6);
static (unit ที่มีอยู่ของ `tools/load` หรือ grep ใน CI): `run.sh` ไม่ใส่ `--cluster` เมื่อค่าเป็น 1/ว่าง; ไม่มีไฟล์ใต้ `apps/` เปลี่ยน; มี ADR-024 (→ ADR-027 — รอบ 40) เฉพาะเมื่อข้อสรุปเสนอเปลี่ยนวิธี deploy

| Task | งาน | ไฟล์ | ขนาด | Depends | ชนกับ |
|---|---|---|---|---|---|
| OPS-26 | (Q-O5 = ก owner 2026-11-17) วัด load-nightly server 1 vs 2 process ด้วย `--cluster` (AC-41) — ☑ #385 (owner สั่งทำ 2026-11-17) | `.github/workflows/load-nightly.yml`, `tools/load/run.sh` (+ sampler ถ้าต้องรวมหลาย process), `docs/evidence/scale/OPS-26/REPORT.md` | ~40 LOC + REPORT | PR เอกสารรอบ 32 merge; OPS-23 ☑ #371; ไม่บล็อก release | ไม่ชน task อื่นที่เปิด (GB-17/CORE-61..63/ADM-27 ไม่แตะ `tools/load/`); รวม nit `tools/load/run.sh` ไม่ unset `DATABASE_POOL_MIN` (review #371) ได้ถ้าเล็ก |

**ผล OPS-26 (ปิดรอบ 32 — `docs/evidence/scale/OPS-26/REPORT.md`)**: gate AC-2/AC-3/AC-33 ผ่านทั้ง 1 และ 2 process (ไม่ oversell);
2 process ลด median ของ checkout (a) ราว 13% (40.5 → 35.4s; (b)/(c)/(d)/(e) ลดใกล้เคียงกัน) แต่**ยังไม่เกินช่วงแปรปรวน** (วัดค่าละ 1 run และ run 1 process ครั้งนี้ต่างจาก OPS-23 config เดียวกันมากกว่านั้น; runner 4 vCPU ใช้ร่วมกับ k6/Postgres/worker) —
ที่เปลี่ยนชัดคือ CPU ของ server (~117% → ~216%) และรอ pool ต่อ process (ลดครึ่ง) → **ไม่เปลี่ยนวิธี deploy prod และไม่เปิด ADR-024** (เลขยังว่าง ณ ตอนนั้น — รอบ 40 ใช้เลขนี้แล้ว → ADR-027; Deliverables ข้อ 2 "prod: 2× server" คงเดิม);
ข้อเท็จจริงของ 2.22.1 ที่พบ (ต้องบันทึกใน ADR ถ้าจะใช้ `--cluster` ใน prod): (1) `--cluster <n>` ต้องคู่ `--servers <n>` — ไม่ใส่ = process ลูกเป็น `workerMode` `shared` (รัน subscriber/job ด้วย) เพราะ primary ส่ง `workerMode` ทับ `MEDUSA_WORKER_MODE`;
(2) process ที่ตายแล้ว primary fork ใหม่แต่ไม่บูต (`start.js:311–314`) → จำนวน process ที่รับ request ลดลงเงียบๆ จนกว่าจะ restart container; งานต่อ (วัดบน staging แยก k6 / profile CPU ของ checkout) รอ owner — ROADMAP หัวข้อ "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 32)"

**(รอบ 33, 2026-11-17) owner ตัดสินข้อ (3) = ก "หยุด วัดตอนมี staging"**: OPS-26 จบที่ผลข้างบน ไม่มี task ต่อตอนนี้ (ไม่ profile CPU — Q-O5 ทาง ข ไม่ทำ) ·
**รายการก่อนเปิดร้าน (go-live)**: เมื่อมี staging (ต้องมี ADR ก่อน — OPS-19/AC-30) วัด checkout แบบ AC-41 ซ้ำบน staging ที่ k6 อยู่คนละเครื่องกับระบบ เทียบจำนวน server process/replica ที่จะใช้จริง
แล้วตัดสินวิธี deploy (ถ้าเปลี่ยนจาก Deliverables ข้อ 2 → ADR-024 (→ ADR-027 — รอบ 40) proposed) — ไม่ต้องเพิ่มใน `docs/ops/production.md` จนกว่าจะมี ADR staging (บันทึกที่นี่และ ROADMAP "ก่อนเปิดร้านจริง")

## Follow-up รอบ 35 (2026-11-18 — ผล qa ADM-22: admin ถูก build แบบ development)
Status: done (owner ตัดสินข้อ ก "แก้ที่การ build" 2026-11-18 และสั่งทำ OPS-27 → ☑ #399 ปิดรอบ 35 2026-11-18) · Out of scope: แก้ loader หน้า pool (ADM-22b ไม่เปิด — spec 08 กฎ 26), patch `@medusajs/dashboard`/`@medusajs/cli`, แก้ `ErrorBoundary`,
แก้ guard (`src/lib/prod-guards.ts`, `src/lib/notification-providers.ts`, `medusa-config.ts`), แก้ script `build` ใน `apps/backend/package.json`, infra/service/dependency ใหม่, แก้ `docs/ops/**`

ที่มา: qa ADM-22 บน develop `9cd0770d` (`docs/evidence/admin-ui/ADM-22/REPORT.md` D-1): build ตามคำสั่งเดิมแล้ว `ErrorBoundary` ของ admin แสดง "Error Details (Development Mode)" + stack (500/abort/404 × full load/client navigation);
build ด้วย `NODE_ENV=production` ไม่มี stack ทุกเคส และ bundle เล็กลง ~336KB — ผลระดับ build กระทบทุกหน้า admin (รวมหน้าของ Medusa) ตรวจ source ของ dependency ที่ pin 2.22.1 เพิ่ม (planner):
- `@medusajs/cli` `dist/create-cli.js:540–541` handler ของ `build`: `process.env.NODE_ENV = process.env.NODE_ENV || "development"` (ของ `start` `:519–520` ใช้ `production`) → vite ฝังค่า development ลง bundle; ตั้ง `NODE_ENV=production` ตอน `medusa start` ไม่มีผล
  (แก้ข้อเท็จจริงในคำสั่งงาน: บรรทัด `:182` คือ handler ของ `db:setup` ไม่ใช่ `build`)
- **ข้อควรระวังของ Dockerfile**: `medusa build` (`@medusajs/medusa/dist/commands/build.js:10`) เรียก `initializeContainer` → โหลด `medusa-config.ts` → `checkBootEnv` และ `buildNotificationProviders` ทำงาน
  เมื่อ `NODE_ENV=production` แต่ไม่มี env ที่ guard ต้องการ → throw → `configLoader` สั่ง `process.exit(1)` (`@medusajs/framework/dist/config/loader.js:10–16`, `:31–32`) — stage `build` ของ Dockerfile ไม่มี env เหล่านี้
  (`docker-compose.prod.yml:20–22` ไม่ส่ง build args) ดังนั้น**ตั้งแค่ `NODE_ENV=production` แล้ว image build ล้ม** → กฎ (b) และ Q-O6; job `storefront-e2e` ของ CI มี env ครบที่ระดับ job อยู่แล้ว (`ci.yml:192–213`)

ที่ build backend (ตรวจ develop `9cd0770d`):
| ที่ | build อย่างไร | `NODE_ENV` ตอน build | OPS-27 |
|---|---|---|---|
| `apps/backend/Dockerfile:18` stage `build` | `RUN pnpm --filter @dtc/backend build` | ไม่ตั้ง (`ENV NODE_ENV=production` อยู่ stage `runtime` `:23`) | แก้ (กฎ a, b) |
| `.github/workflows/ci.yml:287` job `storefront-e2e` step "Start backend and capture publishable key" | `pnpm --filter backend build` | ไม่ตั้ง (env ระดับ job ไม่มี `NODE_ENV`) | แก้ (กฎ c) |
| `CLAUDE.md:103` หัวข้อ Commands | `pnpm --filter backend build && pnpm --filter backend start   # prod-like` | ไม่ตั้ง | แก้เฉพาะบรรทัดนี้ (กฎ d — owner อนุมัติ 2026-11-18) |
| `docker-compose.prod.yml:20–22`, job `docker-worker-mode` ของ `ci.yml` (ผ่าน `tools/ops/smoke-worker-mode.sh:37`, `tools/ops/smoke-redis-outage.sh:45,50`), `tools/load/run.sh:107` (`load-nightly.yml`) | `compose ... --build` → Dockerfile | ตาม Dockerfile | ไม่แก้ — ได้ผลผ่าน Dockerfile |
| `apps/backend/package.json:16` `"build": "medusa build"` | script ของ Medusa ที่ builder ใช้ตรวจ build ในเครื่อง | ไม่ตั้ง | ไม่แก้ — ตั้งที่ผู้เรียก (ถ้าบังคับใน script, build ในเครื่องที่ไม่มี env ของ guard จะล้ม) |
| `docs/ops/**`, `.github/workflows/release-gate.yml`, Deliverables ของ spec นี้ | ไม่มีคำสั่ง build backend | — | ไม่แก้ |
| spec 08 กฎ 26 (คำสั่งเดิมในวงเล็บ) | ประวัติของ ADM-22 | — | ไม่แก้เนื้อหาเดิม (หมายเหตุรอบ 35 ใน spec 08) |

| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| โหมด build ของ admin | `medusa build` ใช้ `NODE_ENV` ที่ผู้เรียกตั้ง (ไม่ตั้ง = development) | ใช้ตามเดิม — ตั้ง `NODE_ENV=production` ที่ผู้เรียก |
| ซ่อน stack ในหน้า error | `ErrorBoundary` ของ dashboard แสดง stack เฉพาะ `NODE_ENV === "development"` | ใช้ตามเดิม |
| guard env ตอนโหลด config | ของเรา (ADR-010, OPS-7/21/24) | ใช้ตามเดิม ไม่แก้ — stage build ส่ง placeholder (กฎ b) |

**ไม่เขียน ADR**: ไม่มีทางเลือกเชิงสถาปัตยกรรมใหม่ — เป็นการแก้ค่า build ให้ตรงกับที่ image ตั้งใจอยู่แล้ว (stage `runtime` เป็น production) โดย guard ของ ADR-010 ไม่เปลี่ยนความหมาย และ placeholder อยู่แค่ใน process ของ build;
ถ้า owner เลือกทาง ข/ค ของ Q-O6 (เปลี่ยน guard หรือ config) จึงต้องมี ADR (ADR-024 ยังว่าง ณ ตอนนั้น → รอบ 40: ใช้ ADR-027)

**กฎ (OPS-27)**: (a) Dockerfile stage `build`: บรรทัด `RUN` ที่รัน `pnpm --filter @dtc/backend build` ตั้ง `NODE_ENV=production` แบบ inline ในคำสั่งนั้น — ห้ามใช้ `ENV`/`ARG` ตั้ง `NODE_ENV` ใน stage `base`/`build`;
`RUN pnpm install --frozen-lockfile` (`:15`, ต้องได้ devDependencies) และ `RUN pnpm ... deploy --prod` (`:20`) ไม่ได้รับ `NODE_ENV=production`; stage `runtime` คง `ENV NODE_ENV=production`;
(b) (Q-O6 = ก — owner 2026-11-18) env ที่ guard ต้องมีตอนโหลด config ใน production ส่งเป็น placeholder **inline ในบรรทัด build เดียวกันเท่านั้น** — ณ `9cd0770d`: `AFFILIATE_TOKEN_SECRET`, `STOREFRONT_URL` (URL `http://` โดเมน `.invalid`), `EVOUCHER_ENCRYPTION_KEY` (64 hex),
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`; ค่าที่เป็นข้อความมีคำ `build-only` และไม่ใช่ secret จริง; **ห้ามมี `ALLOW_TEST_PROVIDERS` ใน Dockerfile** (คงเจตนา ADR-010 ข้อ 4 — ตัวแปรนี้มีเฉพาะใน CI);
placeholder ไม่อยู่ใน stage `runtime` และไม่ถูกฝังใน output ของ build (ค่าจริงมาจาก env ตอนรัน container — guard ตอนบูตทำงานเหมือนเดิม); comment ใน Dockerfile อ้าง spec 07 OPS-27;
ถ้า build ยังล้มด้วย placeholder ชุดนี้ (เช่น provider ตรวจรูปแบบ key ตอน build) → หยุดรายงาน ห้ามสลับไปใช้ `ALLOW_TEST_PROVIDERS` หรือแก้ guard เอง;
(c) `ci.yml` job `storefront-e2e` step "Start backend and capture publishable key": คำสั่ง build เป็น `NODE_ENV=production pnpm --filter backend build` (env ระดับ job คงเดิม ไม่เพิ่ม `NODE_ENV` ระดับ job — step อื่นเช่น `db:migrate`/`seed` ไม่เปลี่ยนโหมด)
แล้วตรวจ bundle (AC-42b) ก่อน `medusa start`; job `docker-worker-mode` ตรวจ image ที่ build แล้ว (AC-42b) — ไม่เพิ่ม job ใหม่;
(d) `CLAUDE.md` แก้เฉพาะบรรทัดคำสั่ง prod-like เป็น `NODE_ENV=production pnpm --filter backend build && pnpm --filter backend start   # prod-like` (คง comment `# prod-like`; อธิบายสั้นๆ ต่อท้ายได้) — `medusa start` ตั้ง production เองอยู่แล้ว (`create-cli.js:520`) ห้ามแตะส่วนอื่นของ `CLAUDE.md`;
(e) ไม่เพิ่ม package/service; ไม่แก้โค้ด app

**AC-42 (OPS-27)** ☑ #399 (a–d ผ่าน: static red 5/7 → green 7/7; build เดิม "Development Mode" 1 ไฟล์ → 0; CI `storefront-e2e` + `docker-worker-mode` เขียว; qa `docs/evidence/scale/OPS-27/REPORT.md` 11/11) (a) static ใน `apps/backend/src/__tests__/ci-workflow.unit.spec.ts` (describe ใหม่ "OPS-27"; `ci.yml` อ่านด้วย `yaml` แบบเดิม, Dockerfile/`CLAUDE.md` อ่านเป็นข้อความ) — **ล้มบน develop `9cd0770d` ก่อนแก้** (แสดง red ใน PR):
(1) Dockerfile: ภายใน stage `build` (จาก `FROM ... AS build` ถึง `FROM` ถัดไป) บรรทัด `RUN` ที่มี `pnpm --filter @dtc/backend build` มี `NODE_ENV=production` ก่อน `pnpm`; บรรทัด `RUN` ที่มี `pnpm install` และ `deploy --prod` ไม่มี `NODE_ENV`;
stage `base`/`build` ไม่มีบรรทัด `ENV`/`ARG` ที่มี `NODE_ENV`; stage `runtime` มี `ENV NODE_ENV=production` และไม่มีคำ `build-only`; ทั้งไฟล์ไม่มี `ALLOW_TEST_PROVIDERS`;
(2) `ci.yml` job `storefront-e2e`: step ที่ `run` มี `pnpm --filter backend build` → บรรทัดนั้นขึ้นต้นด้วย `NODE_ENV=production ` และ job-level `env` ไม่มี `NODE_ENV`; (3) `CLAUDE.md` บรรทัดที่มี `# prod-like` มี `NODE_ENV=production pnpm --filter backend build`
(ข้อจำกัด: PR เอกสารล้วนที่แก้ `CLAUDE.md` ไม่รัน test นี้ตาม `classify-changes.sh` — test จับได้ใน PR โค้ดถัดไป ยอมรับ);
(b) bundle: job `storefront-e2e` หลัง build — มีไฟล์ `apps/backend/.medusa/server/public/admin/assets/*.js` อย่างน้อย 1 ไฟล์ และไม่มีไฟล์ใดมีข้อความ `Development Mode` (ไม่ผ่าน = step ล้มพร้อมข้อความ error);
job `docker-worker-mode` — ใน image backend ที่ build แล้ว `/app/public/admin/assets/*.js` มีอย่างน้อย 1 ไฟล์และไม่มี `Development Mode`, และ `/app` (ยกเว้น `node_modules`) ไม่มีคำ `build-only`;
PR แสดงผลในเครื่อง red/green: build แบบเดิมนับไฟล์ที่มี `Development Mode` ได้ ≥ 1, build ใหม่ได้ 0;
(c) qa บน build จากคำสั่ง prod-like ใหม่ (กฎ d) แล้ว `medusa start` จาก `.medusa/server` แบบ REPORT ADM-22 (1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, header `x-forwarded-proto: https`): ซ้ำ AC-27 ของ spec 08 —
`page.route` GET `/admin/evoucher/pools/<P>` (loader) ตอบ 500 / `route.abort()` / 404 × (เปิดหน้าตรง, คลิกจากรายการ pool) → `innerText` และ `textContent` ของหน้าไม่ตรง regex `/\bat \S+ \(|\.(tsx?|m?js):\d+/` และไม่มี "Development Mode";
ตอบ 401 (ทั้งสองทาง) → URL เป็น `/app/login`; control: หน้า pool ปกติเห็นชื่อ pool; หน้าของ Medusa 1 หน้า (`/app/products/prod_ops27_missing`) ไม่ตรง regex เดิม — REPORT `docs/evidence/scale/OPS-27/REPORT.md` (≤ 5 PNG);
(d) job `storefront-e2e` (`--project=chromium` ทั้งชุด รวม e2e admin) และ `docker-worker-mode` เขียวบน PR (image build ผ่าน guard ด้วย placeholder ตามกฎ b); builder รันในเครื่องบน build ใหม่อย่างน้อย
`e2e/evoucher-admin-pool-page.spec.ts`, `e2e/admin-form-pilot.spec.ts`, `e2e/affiliate-admin-forms.spec.ts` (ระบุผลใน PR); `prod-guards.unit.spec.ts` และ test อื่นของ `ci.yml` ผ่านโดยไม่แก้

| ชนิด | AC |
|---|---|
| unit static (jest — `ci-workflow.unit.spec.ts`) เขียนให้ล้มก่อน | AC-42a |
| ขั้นตรวจใน CI (`storefront-e2e`, `docker-worker-mode`) + red/green ในเครื่อง | AC-42b |
| qa Playwright บน build production ใหม่ | AC-42c |
| e2e ชุดเต็มใน CI + e2e admin ในเครื่อง | AC-42d |

| Task | งาน | ไฟล์ | ขนาด | Depends | ชนกับ |
|---|---|---|---|---|---|
| OPS-27 | (owner ข้อ ก 2026-11-18 — ผล qa ADM-22) build backend ด้วย `NODE_ENV=production` เฉพาะขั้น build ใน Dockerfile (+ placeholder ของ guard — กฎ b) และ CI + ขั้นตรวจ bundle/image + คำสั่ง prod-like ใน `CLAUDE.md` (AC-42) — ☑ #399 (owner สั่งทำ 2026-11-18; qa REPORT `docs/evidence/scale/OPS-27/REPORT.md`) | `apps/backend/Dockerfile`, `.github/workflows/ci.yml` (step build ของ `storefront-e2e` + ขั้นตรวจใน `docker-worker-mode`), `CLAUDE.md` (บรรทัดคำสั่ง prod-like เท่านั้น — owner อนุมัติ), `apps/backend/src/__tests__/ci-workflow.unit.spec.ts`, `docs/evidence/scale/OPS-27/REPORT.md` (qa — session หลัก commit) | ~70 LOC + REPORT | none (PR เอกสารรอบ 35 #398 merge; Q-O6 = ก owner 2026-11-18); ไม่บล็อก release | ไม่ชน task ที่เปิดอยู่ (ไม่มี PR เปิด ณ 2026-11-18) |

## Follow-up รอบ 36 (2026-11-18 — follow-up ของ OPS-27 #399: ขั้นตรวจใน CI ผ่านเงียบ + ไฟล์ test ใน image)
Status: done (ปิดรอบ 36 2026-11-18 — OPS-28 ☑ #403, OPS-29 ☑ #407; owner สั่งทำ 2026-11-18 — hygiene ของ CI/image ไม่ใช่ business rule; ไม่บล็อก release) · Out of scope: แก้ `tsconfig.json` (include/exclude), แก้ script ใน `tools/ops/**`/`tools/load/**`/`check-stripe-*.sh`,
แก้ build ในเครื่อง/CI ที่ไม่ใช่ image (`.medusa/server` ของ `storefront-e2e` ยังมีไฟล์ test — ไม่ได้ส่งขึ้น prod), job/package/service ใหม่, แก้ `docs/ops/**`

**ผล OPS-28 (`docs/evidence/scale/OPS-28-tests.txt`)**: red — `assert-absent.test.sh` 0/12 (ไม่มี script), static OPS-28 ล้ม 5/5; เนื้อ step เดิมกับ path ไม่มี/ไฟล์อ่านไม่ได้ → exit 0 (ผ่านเงียบ), step OPS-15 เดิมเมื่อไม่มี log → exit 0 ·
green — `assert-absent.test.sh` 12/12 (macOS, `debian:bookworm-slim` uid 1000; uid 0 10/10 ข้าม 1 เคส `chmod 000`), static ทั้งไฟล์ 25/25 (describe เดิมผ่านโดยไม่แก้); แบบใหม่ทั้ง 3 จุด → exit 2 พร้อม `::error::`, OPS-15 ไม่มี log/อ่านไม่ได้ → exit 1;
build/image จริงไม่พบข้อความ → exit 0 และ positive control (ข้อความที่มีจริง) → exit 1
**ผล OPS-29 (`docs/evidence/scale/OPS-29-tests.txt`)**: red — static OPS-29 ล้ม 2 เคส (`.dockerignore`, step ตรวจ image) · image เดิม `__tests__` 23 directory / `*.spec.js` 97 ไฟล์ → image ใหม่ 0 / 0, `/app/src/api` และ `/app/src/modules` ยังอยู่,
image เล็กลง ~225KB (`/app` ไม่รวม `node_modules` ลด 1,316 KB); step ใหม่ล้มกับ image เดิม, ผ่านกับ image ใหม่, ล้มเมื่อ path ที่ยืนยันผิดหรือ `find` error (fail-closed); typecheck ยังตรวจไฟล์ test (type error ชั่วคราว → exit 1);
image ใหม่ยังล้มที่ guard เมื่อไม่มี env และบูต server/worker ได้ · รวม nit review #403: test รันเนื้อ step OPS-15 จริง (ลบบล็อก rc ≥ 2 แล้ว test ล้ม)

ที่มา (ตรวจบน develop `14837f04`):
- review #399: `ci.yml:179–180` (job `docker-worker-mode` step "Backend image has production admin bundle (OPS-27)") และ `:302` (job `storefront-e2e` step "Start backend and capture publishable key") ใช้ `if grep …; then exit 1; fi` —
  grep คืน 0 = พบ, 1 = ไม่พบ, ≥ 2 = error (path ไม่มี, ไฟล์อ่านไม่ได้, glob ไม่ตรงจนส่ง `*.js` เป็นตัวอักษร) แต่ `if` ถือ ≥ 2 เป็นเท็จ = **ผ่าน**; `set -eu` (`:177`) ไม่มีผลกับคำสั่งในเงื่อนไขของ `if`;
  `ls` ที่ `:178`/`:301` กันได้แค่กรณีไม่มีไฟล์ `.js` เลย ไม่กัน `grep -r … /app` (`:180`) ที่เจอไฟล์อ่านไม่ได้
- พบเพิ่มระหว่างวางแผน: step OPS-15 (`ci.yml:125–135`) `n=$(grep -c … "$TEST_LOG" || true)` — log ไม่มี/อ่านไม่ได้ → `n` ว่าง → `${n:-0}` = 0 → ผ่าน (ถ้า path ของ log เปลี่ยน ขั้นนี้ตรวจไม่จริงตลอดไป)
- static ของ OPS-27 (`apps/backend/src/__tests__/ci-workflow.unit.spec.ts:264–283`) ตรวจว่ามี step, ลำดับ และไม่มี `if:`/`continue-on-error`/`|| true` — ไม่ได้ตรวจว่าขั้นตรวจล้มเมื่อ grep error
- รูป `grep -c … || true` ใน `tools/ops/smoke-*.sh`, `tools/load/run.sh:155`, `tools/ci/check-stripe-*.sh` **ไม่อยู่ใน scope**: อ่านจาก pipe (rc 2 ไม่เกิดจากไฟล์) หรือค่าว่างทำให้ check ที่คาดค่าบวกล้มอยู่แล้ว (fail-closed)
- builder/qa/review #399: image มีไฟล์ test ที่ compile แล้วที่ `/app/src/**/__tests__/*.js` (มีมาก่อน OPS-27) — `tsconfig.json:25–36` include `**/*` และ `Compiler` ของ Medusa 2.22.1
  (`@medusajs/framework/dist/build-tools/compiler.js:55–60`) ข้ามเฉพาะ path segment `integration-tests`, `test`, `unit-tests`, `src/admin` (`compiler-utils.js:21–27`) ไม่ข้าม `__tests__` →
  ไฟล์ `apps/backend/src/**/__tests__/*.spec.ts` นอก `src/admin` (~100 ไฟล์) ถูก compile ลง `.medusa/server` แล้ว `COPY` เข้า `/app` (`apps/backend/Dockerfile:35`); `.dockerignore` ไม่ตัด `__tests__`;
  ตอนรัน resource loader ของ Medusa ข้าม path ที่มี `__tests__` (`@medusajs/framework/dist/utils/resource-loader.js:53`) จึง**ไม่ใช่บั๊ก runtime** — เป็นขนาด/ความสะอาดของ image (โค้ด test ที่อ่าน `docs/ops`, `ci.yml` ไม่ควรอยู่ใน prod);
  ไม่มีโค้ดใต้ `src/` import จาก `__tests__` (ตรวจ 2026-11-18)

| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ไม่ส่งไฟล์ test เข้า output ของ build | `Compiler` ข้าม `integration-tests`/`test`/`unit-tests`/`src/admin` และใช้ include/exclude ของ `tsconfig.json` — ไม่ข้าม `__tests__` | extend ที่ build context: `.dockerignore` ตัด `__tests__` (กฎ OPS-29 a) — **ไม่**แก้ `tsconfig.json` เพราะ `typecheck` (`apps/backend/package.json:20` `tsc --noEmit`) ใช้ไฟล์เดียวกัน exclude แล้วไฟล์ test หลุดจาก typecheck |
| ไม่โหลดไฟล์ test ตอนรัน | resource loader ข้าม `__tests__` | ใช้ตามเดิม |
| ขั้นตรวจ "ต้องไม่พบ" ใน CI | ไม่ใช่ของ Medusa — shell ใน `ci.yml` + script ใน `tools/ci/` ตาม pattern เดิม (`classify-changes.sh` + `.test.sh` รันใน `lint-typecheck`) | custom (มีอยู่แล้ว — แก้ให้ fail-closed) |

**กฎ (OPS-28)**: (a) ขั้นตรวจ "ต้องไม่พบข้อความ" ใน `ci.yml` ทั้ง 3 จุด (`docker-worker-mode`: `Development Mode` ใน `/app/public/admin/assets/*.js` และ `build-only` ใน `/app` ยกเว้น `node_modules`; `storefront-e2e`: `Development Mode` ใน `apps/backend/.medusa/server/public/admin/assets/*.js`)
ผ่าน**เฉพาะเมื่อ grep คืน 1**; คืน 0 → ล้มพร้อมรายชื่อไฟล์ที่พบ + `::error::`; คืน ≥ 2 → ล้มพร้อม `::error::` ว่าตรวจไม่ได้ (ไม่ใช่ "ไม่พบ");
(b) ทำเป็น script เดียว `tools/ci/assert-absent.sh <ข้อความ> <path>...` (POSIX `sh` — ต้องรันใน image `node:*-bookworm-slim` ได้; ค้นแบบ fixed string, recursive เมื่อ path เป็น directory, ข้าม `node_modules`) ใช้ทั้ง 3 จุด (ผู้ใช้ 3 ที่ ≥ 2 ตาม `CLAUDE.md` ข้อ 3);
job `docker-worker-mode` mount `tools/ci` เข้า container แบบ read-only (`-v …/tools/ci:/ci:ro`) แล้วเรียก script — **ไม่** COPY script เข้า image; glob ของ assets ขยายในเชลล์ที่เรียก (ไม่ตรง → path ตัวอักษร → grep rc 2 → ล้ม); ขั้น `ls` ที่มีอยู่จะคงไว้หรือเอาออกก็ได้ถ้า (a) ยังครอบกรณีไม่มีไฟล์;
(c) `tools/ci/assert-absent.test.sh` (รูปแบบเดียวกับ `classify-changes.test.sh`) รันใน job `lint-typecheck` ถัดจาก `.test.sh` เดิม;
(d) step OPS-15: `$TEST_LOG` ไม่มี/อ่านไม่ได้ หรือ grep คืน ≥ 2 → step ล้มพร้อม `::error::`; นับได้ 0 → ผ่าน; > 0 → ล้มเหมือนเดิม — ห้ามใช้ `|| true` ครอบ grep ใน step นี้;
(e) `ci.yml` ไม่มีรูป `if grep`/`if ! grep` เหลือ; (f) ไม่เพิ่ม job/package; ไม่เปลี่ยนสิ่งที่ตรวจ (ข้อความ/ที่ตรวจเดิม) — เปลี่ยนเฉพาะการตัดสินผล

**กฎ (OPS-29)**: (a) `.dockerignore` ตัด `apps/backend/src/**/__tests__` (และ `apps/backend/integration-tests` ที่ `Compiler` ไม่ compile อยู่แล้ว) ออกจาก build context — ไฟล์ test ไม่เข้า stage `build` เลย; ห้ามแก้ `tsconfig.json`;
(b) image: `/app` (ยกเว้น `node_modules`) ไม่มี directory ชื่อ `__tests__` และไม่มีไฟล์ `*.spec.js`; และ `/app/src/api`, `/app/src/modules` ยังมีอยู่ (กันการตรวจ path ผิดแล้วผ่าน);
(c) step ตรวจ image ของ `docker-worker-mode` (ที่ OPS-28 แก้) ตรวจ (b) แบบ fail-closed — `find` error/path ไม่มี → ล้ม;
(d) comment `ci-workflow.unit.spec.ts:228` ("test นี้ถูก compile ลง /app ของ image") แก้ให้ตรงความจริงหลังแก้ (คงคำ placeholder แบบประกอบจากส่วนย่อยไว้ได้ — `.medusa/server` ของ build ในเครื่อง/CI ยังมีไฟล์ test);
(e) ไม่แก้ stage ของ Dockerfile ถ้า (a) พอ (ถ้าไม่พอ ระบุเหตุผลใน PR); smoke `docker-worker-mode` และ `smoke-redis-outage.sh` ผ่านโดยไม่แก้

**AC-43 (OPS-28)** ☑ #403 (a–d ผ่าน: shell test red 0/12 → green 12/12; static red 5 → green 25/25; step เดิมผ่านเงียบ exit 0 → ใหม่ exit ≠ 0; CI เขียว) (a) `tools/ci/assert-absent.test.sh` — **ล้มบน develop `14837f04`** (ไม่มี script): ไม่พบ → exit 0; พบ → exit ≠ 0 และ output มีชื่อไฟล์; path ไม่มีอยู่ → exit ≠ 0;
ไฟล์อ่านไม่ได้ (`chmod 000`; uid = 0 อ่านได้เสมอ → ข้ามเคสนี้พร้อมพิมพ์ว่าข้าม) → exit ≠ 0; directory ที่มีข้อความเฉพาะใต้ `node_modules/` → exit 0; หลายไฟล์ที่ไม่มีข้อความ → exit 0;
(b) static ใน `ci-workflow.unit.spec.ts` (describe ใหม่ "OPS-28"; อ่าน `ci.yml` ด้วย `yaml` แบบเดิม) — **ล้มบน develop `14837f04`**: ทุก `run` ของทุก job ไม่ตรง `/\bif\s+!?\s*grep\b/`;
step ตรวจ image ของ `docker-worker-mode` เรียก `assert-absent.sh` กับ `Development Mode` และคำ placeholder; step build ของ `storefront-e2e` เรียก `assert-absent.sh` กับ `Development Mode` หลังบรรทัด build และก่อน `medusa start`;
step OPS-15 ไม่มี `|| true` และตรวจว่ามีไฟล์ `$TEST_LOG`; job `lint-typecheck` มี step `tools/ci/assert-absent.test.sh`; test เดิมของ OPS-27 ปรับเท่าที่จำเป็นและยังตรวจลำดับ build → ตรวจ → `medusa start`;
(c) red/green ในเครื่อง (แนบใน PR): เนื้อ step เดิมรันกับ path ที่ไม่มีอยู่ → exit 0 (ผ่านเงียบ); แบบใหม่ → exit ≠ 0; และ build จริงที่ไม่มีข้อความ → แบบใหม่ exit 0;
(d) CI ของ PR: `lint-typecheck`, `docker-worker-mode`, `storefront-e2e`, `backend-tests` เขียว (ค่าจริงไม่พบ → ผ่าน)

**AC-44 (OPS-29)** ☑ #407 (a–c ผ่าน: static red 2 เคส → green 9/9 (describe OPS-28 + OPS-29); image `__tests__` 23 → 0, `*.spec.js` 97 → 0; typecheck ยังตรวจไฟล์ test; CI `docker-worker-mode` เขียว) (a) static ใน `ci-workflow.unit.spec.ts` (describe ใหม่ "OPS-29") — **ล้มก่อนแก้**: `.dockerignore` มีบรรทัดที่ตัด `__tests__` ใต้ `apps/backend/src`; `tsconfig.json` (`apps/backend`) `exclude` ไม่มีคำ `__tests__`/`spec`;
step ตรวจ image ของ `docker-worker-mode` มีการตรวจ `__tests__` และ `/app/src/api`;
(b) red/green ในเครื่อง (แนบใน PR): image จาก Dockerfile/`.dockerignore` เดิม → `docker run --rm --entrypoint sh <image> -c 'find /app -path /app/node_modules -prune -o -type d -name __tests__ -print | wc -l'` ≥ 1; image ใหม่ = 0 และ `/app/src/api` มีอยู่;
ขนาด image (`docker image inspect -f '{{.Size}}'`) ก่อน/หลัง; `pnpm --filter backend typecheck` ยังตรวจไฟล์ test (เช่นใส่ type error ชั่วคราวในไฟล์ test หนึ่งไฟล์แล้วล้ม — ไม่ commit);
(c) CI ของ PR: `docker-worker-mode` (smoke worker mode + ตรวจ image + `smoke-redis-outage.sh`) และ job อื่นเขียว

| ชนิด | AC |
|---|---|
| shell test (`assert-absent.test.sh`) เขียนให้ล้มก่อน | AC-43a |
| unit static (jest — `ci-workflow.unit.spec.ts`) เขียนให้ล้มก่อน | AC-43b, AC-44a |
| red/green ในเครื่อง (step เดิม vs ใหม่, image เดิม vs ใหม่) | AC-43c, AC-44b |
| CI ของ PR | AC-43d, AC-44c |

ไม่มี UI → ไม่ต้องมี qa REPORT (ผลอยู่ใน PR body)

| Task | งาน | ไฟล์ | ขนาด | Depends | ชนกับ |
|---|---|---|---|---|---|
| OPS-28 | (รอบ 36 — review #399) ขั้นตรวจ "ต้องไม่พบ" ใน CI ล้มเมื่อ grep error (fail-closed) ผ่าน `tools/ci/assert-absent.sh` + test ของ script + step OPS-15 ล้มเมื่อไม่มี log (AC-43) — ☑ #403 (owner สั่งทำ 2026-11-18; ผลใน `docs/evidence/scale/OPS-28-tests.txt`) | `.github/workflows/ci.yml` (step ตรวจ image ของ `docker-worker-mode`, step build ของ `storefront-e2e`, step OPS-15, step ใหม่ใน `lint-typecheck`), `tools/ci/assert-absent.sh`, `tools/ci/assert-absent.test.sh`, `apps/backend/src/__tests__/ci-workflow.unit.spec.ts` | ~120 LOC | PR เอกสารรอบ 36 merge; ไม่บล็อก release | ∥ ADM-30, ADM-31 (spec 08 — ไม่มีไฟล์ร่วม); OPS-29 ต่อจากตัวนี้ |
| OPS-29 | (รอบ 36 — builder/qa/review #399) ไม่มีไฟล์ test ที่ compile แล้วใน image: `.dockerignore` ตัด `__tests__` + ขั้นตรวจ image ใน CI (AC-44) — ☑ #407 (owner สั่งทำ 2026-11-18; หลัง OPS-28 #403; ผลใน `docs/evidence/scale/OPS-29-tests.txt`) | `.dockerignore`, `.github/workflows/ci.yml` (step ตรวจ image ของ `docker-worker-mode`), `apps/backend/src/__tests__/ci-workflow.unit.spec.ts` (+ `apps/backend/Dockerfile` เฉพาะเมื่อกฎ OPS-29 e ต้องใช้) | ~40 LOC | **OPS-28** (step เดียวกันของ `ci.yml` + describe ในไฟล์ static เดียวกัน); ไม่บล็อก release | ∥ ADM-30, ADM-31 |

## Follow-up รอบ 40 (2026-11-21 — การทดสอบ manual เฟส 2/4/9 บน v0.2.0; owner สั่งแก้ใน release เดียว)
ที่มา: OPS-M-06 (prod ไม่มี access log — compose ตั้ง `LOG_LEVEL=info` แต่ access log ของ Medusa ออกที่ระดับ `http`; ขัด `docs/ops/production.md:79`), OPS-M-12 (Deliverables ข้อ 11 — แก้แล้วในรอบนี้),
log หลอก ops (`Error was thrown trying to refund payment … [object Object]` + `recreate a payment session … Invalid string billing_details` ทั้งที่คืนเงินสำเร็จ — ต้นเหตุ Medusa `compensatePaymentIfNeededStep`, ดู ADR-025 บริบท),
migrate พิมพ์ warning ซ้ำ 3 รอบ + `worker_mode:"server"` ตอน migrate, prod seed สร้าง publishable key 2 ตัว
**เลข ADR**: ADR-024 ที่หัวข้อ "Follow-up รอบ 32" สงวนไว้สำหรับการเปลี่ยนวิธี deploy prod ถูกใช้ในรอบ 40 แล้ว (group buy — ADR-024) → ADR ของวิธี deploy/staging ในอนาคตใช้**เลขว่างถัดไป (ADR-027)** แทนทุกที่ที่อ้าง ADR-024 ในหัวข้อรอบ 32/35
owner อนุมัติ (2026-11-21) ให้ task ของรอบนี้แก้ `docs/ops/**` ในเรื่อง LOG_LEVEL/HTTPS (OPS-30) — task อื่นที่แตะ runbook (GB-21, OPS-32) แก้หัวข้อของตัวเองตามปกติ

### Acceptance criteria (รอบ 40)
- AC-45 (OPS-30) ☑ (a–c ผ่าน: static red 7 เคส → green 66/66; step CI ในเครื่อง compose `info` ล้ม exit 1 → `http` ผ่าน มีบรรทัด `"path":"/admin/users/me","status":401`; ผลใน `docs/evidence/scale/OPS-30-tests.txt`) (a) `docker-compose.prod.yml` ตั้ง `LOG_LEVEL: ${LOG_LEVEL:-http}`; unit ใน `load-lock-timing.unit.spec.ts:150-152` และ `instrumentation.unit.spec.ts` ที่ยึดค่า `info` แก้เป็น `http` (sampler ยังไม่สร้าง timer ที่ `http` — ผลเดิมของ `saturation-sampler.unit.spec.ts`);
  (b) `docs/ops/production.md` หัวข้อ Alerts ระบุว่า access log ต้องใช้ `LOG_LEVEL=http` (ค่าเริ่มต้นของ compose) และเตือนว่า `info` จะไม่มี access log; หัวข้อ go-live/คำสั่ง prod-like ระบุ HTTPS หรือ `X-Forwarded-Proto: https` ตาม Deliverables ข้อ 11;
  (c) `docker-worker-mode` (CI) ยืนยันว่ามีบรรทัด access log (`request_id`, `status`) จาก server หลังยิง **`GET /admin/users/me` ไม่มี token (ได้ 401)** หรือ `GET /store/regions` พร้อม publishable key 1 ครั้ง
      (ล้มบน develop) — **ห้ามใช้ `/health`** เพราะ Medusa ข้าม access log ของ `/health` เสมอ (`framework/dist/http/express-loader.js:21,108-113` — review #425); unit อ่านไฟล์ตรวจ (a)(b)
- AC-46 (OPS-31) ☑ (a–b ผ่าน: ที่มา (a) = `medusa db:migrate` fork `db:migrate:search`/`db:migrate:scripts` ที่โหลด config ซ้ำ + ตั้ง `MEDUSA_WORKER_MODE=server` เอง → แก้ที่ `medusa-config.ts`/`json-logger.ts`; (b) Medusa `createDefaultsWorkflow` สร้าง "Default Publishable API Key" ตอนบูต → seed ใช้ตัวนั้นเป็น "Storefront"; unit red 5 → green, integration red 1 → green, image prod: warning 1 ครั้ง/ข้อความ, `worker_mode:"server"` 0 บรรทัด, key 1 ตัว; ผลใน `docs/evidence/scale/OPS-31-tests.txt`) (a) `pnpm --filter backend db:migrate` ของ image prod พิมพ์ warning แต่ละข้อความ**ครั้งเดียว** และไม่มี `worker_mode:"server"` ในบรรทัดของขั้น migrate (builder หาที่มา — ถ้าเป็นพฤติกรรมของ Medusa ที่โหลด config หลายรอบ ให้แก้ที่โค้ดเรา เช่น guard/log ใน `medusa-config.ts` ที่รันซ้ำ; ทำไม่ได้โดยไม่ patch Medusa → บันทึกใน PR และ `docs/ops/production.md` ว่าเป็นของ Medusa แล้วปิดข้อ (a));
  (b) prod seed (ใน image) รันบน DB ว่าง **2 ครั้ง** → มี publishable key ที่ไม่ revoke **1** ตัวชื่อ "Storefront" ผูก sales channel ของร้าน (ล้มบน develop ที่ได้ 2 ตัว) และ `print-publishable-key` คืนตัวนั้น
- AC-47 (OPS-32) ☑ (a–c ผ่าน: integration red 2/3 → green 3/3, runbook unit red 3 → green; ร่าง issue อยู่ใน PR body) (a) เมื่อ `completeCartWorkflow` ล้มหลัง capture (handler `completeCartWorkflow.hooks.validate` throw หรือ step หลัง hook ล้ม) backend log **warn** 1 บรรทัดขึ้นต้น `CART_COMPLETION_FAILED_AFTER_PAYMENT`
  พร้อม `cart_id`, `payment_session_id`, `code` และข้อความ "Medusa refunds automatically; a following 'Error was thrown trying to refund payment' line comes from re-creating the payment session — verify refunds via GET /admin/payments/:id"
  (integration ด้วย mock provider: flash เกินสิทธิ์หลัง capture → มีบรรทัดนี้ 1 ครั้ง และ payment มี refund 1 รายการ); (b) `docs/ops/production.md` หัวข้อใหม่ "log ที่ดูเหมือนคืนเงินล้มแต่สำเร็จ" ระบุสองข้อความของ Medusa,
  วิธีตรวจ (`GET /admin/payments/:id` → `refunds`, PI ใน Stripe), และ "ห้าม refund ซ้ำด้วยมือ" (unit runbook grep คำสำคัญ); (c) PR body มีร่าง issue upstream (refund แล้ว recreate session ด้วย `data` เดิม + log `[object Object]`) — **owner อนุมัติให้เปิด issue 2026-11-21** (session หลักเปิด)

### Checklist ตอน bump `@medusajs/*` — เพิ่ม (รอบ 40)
11. `compensatePaymentIfNeededStep`/`refundPaymentAndRecreatePaymentSessionWorkflow` ยัง refund แล้ว recreate ด้วย `data` เดิม และไม่สร้าง collection ใหม่ (ADR-025, OPS-32 ข้อความ log)
12. `refundPaymentWorkflow` ยัง refund ก่อนสร้าง credit line (B-1 — ถ้า upstream แก้แล้ว พิจารณาถอด middleware ของ PAY-8)
13. route ใหม่ใต้ `/admin/promotions/:id/*` และ `/admin/campaigns/:id*` อยู่ใต้ matcher ของ GB-25 (ADR-026); Medusa ยังข้าม access log ของ `/health` เท่านั้น (OPS-30 AC-45c); error/ข้อความของ Medusa ที่ FS-22 (สต็อกไม่พอ) และ CORE-73 (`Identity with email already exists`) ใช้ตัดสินยังเหมือนเดิม

### Tasks (รอบ 40)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| OPS-30 | ☑ #432 — `LOG_LEVEL=http` ค่าเริ่มต้นของ compose prod + เอกสาร access log/HTTPS (owner อนุมัติแก้ `docs/ops/**`) + ขั้นตรวจ access log ใน CI | `docker-compose.prod.yml`, `docs/ops/production.md`, `apps/backend/src/__tests__/{load-lock-timing,instrumentation}.unit.spec.ts`, `.github/workflows/ci.yml` (`docker-worker-mode`), `apps/backend/src/__tests__/ci-workflow.unit.spec.ts` | ~30 LOC + ~60 LOC test | AC-45 | PR เอกสารรอบ 40 | `docs/ops/production.md` (GB-21, OPS-32 คนละหัวข้อ — ตัวหลัง sync) |
| OPS-31 | ☑ #457 — warning ซ้ำตอน migrate + publishable key เดียวใน prod seed | `apps/backend/medusa-config.ts` หรือ guard ที่ log, `apps/backend/src/scripts/seed*.ts`, test | ~60 LOC + ~100 LOC test | AC-46 | PR เอกสารรอบ 40 | `medusa-config.ts` (เก็บทั้งสองฝั่งถ้า conflict — CLAUDE.md) |
| OPS-32 | ☑ #438 — log ชัดเมื่อ complete ล้มหลังจ่าย + runbook + ร่าง issue upstream | `apps/backend/src/workflows/hooks/complete-cart-validate.ts`, `docs/ops/production.md`, `src/__tests__/ops-runbook.unit.spec.ts`, integration | ~40 LOC + ~120 LOC test | AC-47 | PR เอกสารรอบ 40 | `complete-cart-validate.ts` (ไม่มี task อื่นในรอบนี้), `production.md` |

## Follow-up รอบ 41 (2026-11-21 — owner: redact PII + hygiene + เอกสาร go-live ใน release v0.3.0)
ที่มา: OPS-32 #438 (log Medusa `recreate a payment session … Invalid string: {…}` มีชื่อ/อีเมล/เบอร์/ที่อยู่ของลูกค้า), CORE-71 builder (typecheck ในเครื่องล้มเมื่อมี `apps/backend/.medusa/types`),
nits review รอบ 40 (#428, #429, #431, #432, #433, #434), PAY-9 D-1 (#17948), qa #465 (เวลา query ของการค้นหา)
**แก้แล้วใน PR เอกสารรอบ 41 (owner อนุมัติแก้ `docs/ops/**` 2026-11-21)**: `docs/ops/production.md` — `worker_mode: "migrate"` (OPS-31), runbook collection ที่ถูกถอด link หลัง PAY-9, หมายเหตุเวลา refund ของ FS-22,
Go-live checklist ข้อ 10–14 (LC_CTYPE ของ Postgres, อีเมลตัวเล็ก, backfill ธง backordered, redact PII, เวลา query ค้นหากับ catalog จริง)

### What Medusa already gives us (รอบ 41)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| logger ของ prod | `logger` ใน `medusa-config.ts` → `json-logger.ts` ของเรา (winston format เดียวกับ Medusa — OPS-3) — log ของ Medusa core (รวมบรรทัด recreate session) ผ่าน logger นี้ | extend: format redact ใน chain เดิม (กฎข้อ 15) — ไม่เพิ่ม log shipper/infra |
| redact ใน winston | `winston.format((info) => …)` ที่ใช้อยู่แล้ว | ใช้ตามเดิม |

### Business rules (รอบ 41)
15. (OPS-33) format `redactPii` ใน `json-logger.ts` (ก่อน `json()`) แทนค่า PII ใน `message`, `stack` และ field string อื่นของ log ด้วย `[REDACTED]`:
    (a) ทุกสตริงรูปอีเมล; (b) ค่าของ key `email`, `phone`, `name`, `first_name`, `last_name`, `company`, `address_1`, `address_2`, `line1`, `line2`, `city`, `province`, `state`, `postal_code` ในข้อความรูป JSON/JS object (`"key":"value"` และ `key: 'value'`);
    (c) เบอร์โทรไทย (`0` + 8–9 หลัก, `+66…`) ที่มีขอบเขตเป็นอักขระที่ไม่ใช่ตัวอักษร/ตัวเลขทั้งสองข้าง (lookbehind/lookahead `[^A-Za-z0-9]` หรือต้น/ท้ายสตริง — ไม่ตัดเลขที่อยู่กลาง ULID เช่น `pay_01…`/`cart_01…`);
    ไม่แตะ id (`cart_…`, `pay_…`, `pi_…`), `request_id`, จำนวนเงิน; pure function + unit จากตัวอย่างบรรทัดจริงที่ integration ของ OPS-32 (`complete-after-payment-log.spec.ts`) สร้าง;
    development (logger ของ Medusa เดิม) ไม่เปลี่ยน; หมายเหตุ "ถูกแทนด้วย `[REDACTED]`" ใน runbook หัวข้อ OPS-32 แก้แล้วใน PR เอกสารรอบ 41 — OPS-33 แค่ตรวจว่าถ้อยคำยังตรงกับผลจริง
    (review #473) regex ต้องทำงานแบบ linear กับข้อความยาว (อีเมล: เริ่ม match เฉพาะต้นช่วง + จำกัดความยาว local ≤ 64/label ≤ 63 — unit 100k ตัวอักษร);
    key ใน (b) เทียบแบบไม่สนตัวพิมพ์และรวมค่าตัวเลข; เบอร์ใน (c) ไม่อยู่หลัง `.` (ทศนิยมของจำนวนเงิน); ไม่นับชื่อไฟล์ `image@2x.png` เป็นอีเมล; `Error`/`Map` ใน meta ถูก redact
    (d) (owner ยืนยัน 2026-11-21) `check:go-live` (`src/scripts/check-go-live.ts`) ตรวจ `datctype` ของ DB ปัจจุบัน (`pg_database` ของ `current_database()`) — เป็น `C` หรือ `POSIX` → FAIL
    พร้อมเหตุผล (pg_trgm ทิ้งอักษรไทยทั้งหมด `show_trgm('สเวตเตอร์')` ได้ `{}` → ค้นไทยกลางคำของ CORE-75 ใช้ไม่ได้); Go-live ข้อ 10 ของ `docs/ops/production.md` บอกว่าตรวจให้อัตโนมัติ
16. (OPS-34 — hygiene backend รวม) (a) `apps/backend/tsconfig.json` exclude `.medusa/**` → `pnpm typecheck` ในเครื่องผ่านแม้มี `.medusa/types` (CI เดิมผ่านอยู่แล้ว);
    (b) #428: assertion ของ test refund นับ order transaction ของ refund = 1 และนับเฉพาะ refund ที่สำเร็จ; (c) #429: ลบ session ทีละ id และ `query.graph` อยู่นอก try (พฤติกรรมเดิม);
    (d) #431: assertion log แคบลงเป็นบรรทัดที่ขึ้นต้นด้วย prefix ที่ตรวจ; (e) #432: comment ระดับ log ของ saturation-sampler ตรงกับโค้ด; (f) #433: test ลำดับ `not_allowed` vs `invalid_data` ตรงกับ validator;
    (g) #434: matcher `/store/customers/me/*` ของ flash ย้ายจาก `api/store/flash-sales/middlewares.ts` ไปไฟล์ middleware ของ path นั้น (พฤติกรรมเดิม); (h) test ยิงพร้อมกันของ PAY-9 ไม่ flake 404 (รอ link/collection ด้วยสัญญาณจริง)
    — ไม่เปลี่ยนพฤติกรรม production ยกเว้นที่ระบุ; ห้ามเพิ่ม timeout/retries

### Acceptance criteria (รอบ 41)
- AC-48 (OPS-33, กฎข้อ 15 รอบ 41) ☑ (a–d ผ่าน: unit red 12 → green, integration AC-48b red 1 → green) unit + integration — **ล้มบน develop** ก่อน: (a) unit `redactPii` กับข้อความตัวอย่างจริงของบรรทัด recreate session → ไม่มีอีเมล/ชื่อ/เบอร์/ที่อยู่ของ fixture เหลือ, `pay_…`/`cart_…` ยังอยู่ครบ
  (fixture มี id ที่มีเลขติดกัน ≥ 9 หลัก เช่น `pay_01M70812345678XYZ` → ไม่ถูกตัด);
  (b) integration (แบบ AC-47a) ด้วยลูกค้าชื่อ/อีเมล/เบอร์/ที่อยู่ที่ tag ไว้ → stream ของ logger prod ไม่มีค่า tag ใดเลย และยังมีบรรทัด `CART_COMPLETION_FAILED_AFTER_PAYMENT` พร้อม `cart_id`; (c) logger development ไม่ redact (regression);
  (d) (owner ยืนยัน 2026-11-21, กฎข้อ 15 d) unit — **ล้มบน develop** ก่อน: `goLiveFailures` เมื่อ `datctype` เป็น `C`/`POSIX` → มีข้อ FAIL ที่บอก `datctype`, `pg_trgm` และภาษาไทย; `en_US.utf8`/`th_TH.UTF-8` ผ่าน;
  Go-live ข้อ 10 มีข้อความ "`check:go-live` ตรวจข้อนี้ให้อัตโนมัติ"; integration `prod-guards.spec.ts` (ผ่านครบ) รัน query `datctype` กับ DB จริง
- AC-49 (OPS-34, กฎข้อ 16 รอบ 41) ☑ (a–h ผ่าน: typecheck red TS2531 ×6 → green, unit red 2 → green, integration (c) red 1 → green, (f) mutation red, (h) ลำดับบังคับ red 404, (b) เพิ่ม assertion — mutation ถอด lock ยังไม่ red ในเครื่อง; รันซ้ำ 3 รอบ) (a) สร้าง `apps/backend/.medusa/types/*.d.ts` จำลองที่ขัดกับ test แล้ว `pnpm --filter backend typecheck` ผ่าน; (b)–(h) test ที่แก้ผ่าน `--repeat-each`/รันซ้ำ 3 รอบ; static: ไม่มี `setTimeout`/`retries` ใหม่ใน test ที่แก้

### Checklist ตอน bump `@medusajs/*` — เพิ่ม (รอบ 41)
(เลขข้อด้านล่างต่อจากเช็กลิสต์ bump ข้อ 1–13 — คนละชุดกับ "กฎข้อ 15–16 รอบ 41" ข้างบน; อ้างเป็น "เช็กลิสต์ bump ข้อ 14–18" — ข้อ 18 เพิ่มปิดรอบ 41)
14. (PAY-9 D-1 — **สำคัญ**) ถ้า upstream แก้ medusajs/medusa#17948 แล้ว `compensatePaymentIfNeededStep` สร้าง session ใหม่ได้สำเร็จ → collection เดิมมี session ใหม่ที่ไม่มี payment → guard ของ PAY-9 ไม่ reset
    → อาการ O-2 (#69) กลับมา: characterization test `integration-tests/http/payment-collection-reset.spec.ts` (~`:256`) จะล้ม → ทบทวน ADR-025 (ภาคผนวก 2026-11-21) ก่อน merge bump
15. (CORE-75/CORE-88) `typo_tolerance` ของ `POST /store/search` และเกณฑ์ similarity ใน provider ยังเหมือนเดิม (AC-174, AC-185 ผ่าน); `json-logger.ts` redact ยังครอบข้อความ recreate session ของเวอร์ชันใหม่ (AC-48b)
16. (ADR-028) ถ้า `FetchError` ของ `@medusajs/js-sdk` เก็บ `code`/`type` แล้ว → ย้ายผู้เรียก `lib/data/medusa-fetch.ts` กลับไปใช้ SDK แล้วลบ helper; ไม่งั้นตรวจว่า header ของ helper ยังเท่ากับของ SDK (unit AC-181a)
    **(ยืนยันปิดรอบ 41 2026-11-23 หลัง CORE-82..84 + ADR-028 ภาคผนวก 2026-11-23 — ข้อนี้ยังถูกต้อง เพิ่มรายละเอียด)**: ผู้เรียก `medusaFetch` = **ทุกไฟล์ที่ import `./medusa-fetch`** (หาด้วย grep ตอน bump — ห้ามใช้รายการนี้แทน grep); ณ ปิดรอบ 41 มี 7 ไฟล์ `lib/data/{payment,cart,returns,customer,group-join,group-buy,affiliate-portal}.ts`
    (affiliate ส่ง `authHeaders` ของ actor `affiliate` — ถ้าย้ายกลับ SDK ต้องส่ง header นี้แทน); ย้ายกลับแล้วยังต้องคง class `MedusaApiError` หรือแทนด้วย error ของ SDK ที่มี `status/type/code` ให้ helper ตัดสินผลทุกตัวทำงานเหมือนเดิม;
    ทุก bump ตรวจข้อความของข้อยกเว้น `UNCODED_MEDUSA_ERRORS` ใน `lib/util/medusa-api-error.ts` (`OUT_OF_STOCK_AT_RESERVE`, `EMPTY_CART_COMPLETION`, `IDENTITY_EXISTS`) กับ source ของ Medusa ที่ติดตั้ง (ซ้อนกับข้อ 13 — ข้อนี้คือรายการครบ);
    ไม่มี issue upstream ที่เราเปิด (owner 2026-11-23 — ADR-028 ภาคผนวก) — ตอน bump ดูสถานะ medusajs/medusa#16770 และ PR ที่แก้ `FetchError`
17. (CORE-76) ข้อความ 409 ไม่มี code "Cart is already being completed by another request" ของ `POST /store/carts/:id/complete` (`@medusajs/medusa` `dist/api/store/carts/[id]/complete/route.js`) ยังเหมือนเดิม
    และ `errorHandler` ของ Medusa ยังเขียนทับข้อความ CONFLICT — contract test ฝั่ง backend (`src/api/__tests__/error-handler.unit.spec.ts`) ล้ม = แก้ `CART_COMPLETION_IN_PROGRESS_MESSAGE` (`src/api/store/carts/errors.ts`)
    แล้วตรวจ kind `processing` ของ `placeOrderOutcome` (session หลักตัดสิน 2026-11-21 ตามรายงาน builder CORE-76; storefront ตัดสินจาก code อย่างเดียวตั้งแต่ CORE-82 — ไม่มี map ข้อความให้แก้)
18. (GB-30 — spec 04 กฎข้อ 55/56, review #498; เพิ่มปิดรอบ 41) ตรวจ `@medusajs/medusa` เวอร์ชันใหม่ว่ามี admin route หรือ job/workflow ที่เรียกจากภายนอกใหม่ที่**ลบ** promotion (เช่น bulk/batch delete, cascade จาก campaign)
    หรือ**เปลี่ยน `status`** ของ promotion (เช่น batch status, `updatePromotionsStatusWorkflow` จาก route อื่น, job เปิดใช้ตาม `starts_at` ของ campaign) นอกจาก `DELETE /admin/promotions/:id` และ `POST /admin/promotions/:id` —
    พบ → ต้นแบบ `GBT-*` ลบ/เปิดใช้ได้ทางใหม่: ขยาย guard ของ `adminPromotionLockMiddlewares` (`src/api/admin/promotions/group-buy-lock.ts`) ให้ครอบก่อน merge bump และเพิ่มเคสใน `integration-tests/http/group-buy-promotion-lock.spec.ts` (AC-73);
    ตรวจด้วย grep `deletePromotionsWorkflow`/`updatePromotionsStatusWorkflow`/`status` ใน `dist/api/admin/promotions/**`, `dist/api/admin/campaigns/**` และ `@medusajs/core-flows` ส่วน promotion (ข้อ 13 ครอบเฉพาะ path ใต้ matcher เดิม)

### Tasks (รอบ 41)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| OPS-33 | ☑ #473 — redact PII ใน logger prod (กฎข้อ 15 รอบ 41) + ตรวจถ้อยคำหมายเหตุ runbook/go-live ข้อ 13 ที่ PR เอกสารรอบ 41 เขียนไว้ + `check:go-live` ตรวจ `datctype` (กฎข้อ 15 d — owner ยืนยัน 2026-11-21) | `apps/backend/src/lib/json-logger.ts`, `src/lib/redact-pii.ts` (+ unit), `src/scripts/check-go-live.ts`, integration, `docs/ops/production.md` | ~60 LOC + ~150 LOC test | AC-48 | PR เอกสารรอบ 41 | `production.md` (CORE-81, EV-25 คนละบรรทัด) |
| OPS-34 | ☑ #497 — hygiene backend รวม (กฎข้อ 16 รอบ 41) | `apps/backend/tsconfig.json`, test ตาม (b)–(h), `api/store/flash-sales/middlewares.ts` | ~40 LOC + ~150 LOC test | AC-49 | PR เอกสารรอบ 41 | `middlewares.ts` ถ้าย้าย matcher (CORE-80, GB-26 — ตัวหลัง sync) |

## Follow-up รอบ 42 (ปิดรอบ 41 2026-11-23 — review/re-review #473, #471; ไม่บล็อก release v0.3.0)
Status: done (☑ OPS-35 #536 — ปิดรอบ 42 2026-11-24) · แตะ `docs/ops/production.md` (นับเป็นโค้ดใน CI) — owner อนุมัติให้ task ops แก้หัวข้อของตัวเองตามแนวรอบ 40/41
### What Medusa already gives us (รอบ 42)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| access log | Medusa 2.22.1 เขียน access log ที่ระดับ `http` (path + query + status) ผ่านทางของ Medusa เอง — builder ยืนยันว่าผ่าน logger ของเรา (`json-logger.ts`) หรือ stdout ตรง (review #473 บอกว่าตรง) | ไม่ patch — บันทึกใน runbook (กฎข้อ 17c รอบ 42) |
| layout ของหน้า order | system default layout ของ zone `order.details` (migration script ของ PAY-10) + layout ส่วนตัวของแอดมิน ("Customize layout") | ใช้ตามเดิม — runbook บอกวิธี reset (กฎข้อ 17d รอบ 42) |
### Business rules (รอบ 42)
17. (กฎข้อ 17 รอบ 42 — คนละชุดกับเช็กลิสต์ bump ข้อ 17; OPS-35 — ช่องว่างของ redact + runbook) (a) `redactPii` (`src/lib/redact-pii.ts`) ครอบเพิ่ม: สตริงในเครื่องหมาย backtick ของ `util.inspect` (`` key: `value` ``), ค่าใน JSON ที่ escape ซ้อน (`\"email\":\"…\"`),
        local part ของอีเมลที่มี `'` (เช่น `o'brien@…` ต้องไม่เหลือ `o'`); คงกติกา linear-time ของกฎข้อ 15 รอบ 41 (unit 100k ตัวอักษร) และไม่ตัด id/`request_id`/จำนวนเงิน;
    (b) ไม่ redact ค่า non-PII ของ key `name`/`state` ที่เป็นชื่อ step/สถานะ workflow ไม่ได้ — ยอมรับตามกฎข้อ 15 (ไม่เปลี่ยน); `cause` ที่ non-enumerable ไม่ถูก log (ไม่ regression) — ไม่เปลี่ยน;
    (c) `docs/ops/production.md` หัวข้อ redact (Go-live ข้อ 13): ระบุว่า access log ของ Medusa **ไม่ผ่าน** redact (ถ้า builder ยืนยันว่าตรง stdout) — มี path (รวม query), status, `client_ip`, `referrer` (อาจมี `?q=` ของหน้าค้นหา) และ `user_agent` (แก้ถ้อยคำปิดรอบ 42 ตามที่ OPS-35 พบ: morgan ของ Medusa 2.22.1) — query ของหน้าค้นหา (`q`) อาจมีข้อความที่ลูกค้าพิมพ์; log shipper ต้องเก็บตามนโยบาย PII เดียวกัน;
    (d) `docs/ops/production.md` runbook หลัง go-live: แอดมินที่บันทึก layout ส่วนตัวของหน้า order ไว้ก่อน PAY-10 จะไม่เห็น widget `order-refund-blocked` บนสุด → ให้ widget กลับบนสุด (re-review #471) — แก้ถ้อยคำปิดรอบ 42: dashboard 2.22.1 **ไม่มีปุ่ม reset** จึงใช้ "Customize layout" แบบ Personal ลาก widget ขึ้นเอง หรือ `DELETE /admin/layouts/order.details/configuration` ด้วย session ของแอดมินคนนั้น (ตามที่ OPS-35 เขียนใน runbook)
### Acceptance criteria (รอบ 42)
- AC-50 (OPS-35, กฎข้อ 17 รอบ 42 — คนละชุดกับเช็กลิสต์ bump ข้อ 17) ☑ (unit red 7 → green: redact 5 + runbook 2; linear-time เดิม 3 กรณีผ่านที่เกณฑ์ 200ms เดิม + เพิ่ม 3 กรณี) unit `redact-pii` — **ล้มบน develop** ก่อน: fixture backtick `` email: `a.b@x.co` ``, JSON escape ซ้อน, `o'brien@example.com` → ไม่เหลือค่า fixture และไม่เหลือ `o'`; unit linear-time 100k ตัวอักษรเดิมยังผ่านโดยไม่เพิ่มเกณฑ์เวลา;
  unit runbook (`ops-runbook.unit.spec.ts`) grep คำ "access log" ในหัวข้อ redact และ "Customize layout" ในหัวข้อหลัง go-live
### Tasks (รอบ 42)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| OPS-35 | ☑ #536 — redact backtick/JSON escape/`'` + runbook access log และ reset layout (กฎข้อ 17 รอบ 42) | `apps/backend/src/lib/redact-pii.ts` (+ unit), `docs/ops/production.md`, `src/__tests__/ops-runbook.unit.spec.ts` | ~20 LOC + ~60 LOC test | AC-50 | PR เอกสารปิดรอบ 41 | `production.md` |

## Follow-up รอบ 43 (เสนอ — ปิดรอบ 42 2026-11-24; ☐ รอ owner สั่งทำ)
Status: accepted สำหรับ OPS-36 (owner สั่งทำก่อน go-live — Q-R43-ฉ = ก (owner 2026-11-25) แก้เพิ่ม: 3 task รวมใน v0.3.1) และ OPS-39 (owner สั่ง 2026-11-25: ปิดช่อง PII ที่เหลือจาก review #554 รวมใน v0.3.1) และ OPS-40 (owner สั่ง 2026-11-25: ปิดช่อง PII ค่าเดี่ยวที่เหลือจาก review #559 **ก่อน go-live — ไม่อยู่ใน v0.3.1 และไม่บล็อก v0.3.1**) · OPS-37, OPS-38 draft (☐ หลัง go-live — รอ owner สั่ง) · ที่มา: review #536, #548, GB-32 #534 (builder) — ตรวจบน develop `599009b6` · OPS-36 เป็น**ช่องรั่วของ PII ใน log** (Go-live ข้อ 13)
### What Medusa already gives us (รอบ 43)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| logger ของ prod | `logger` ใน `medusa-config.ts` → `json-logger.ts` ของเรา (OPS-33) | ขยาย `redactPii` ตามเดิม (กฎข้อ 18, 21, 22 รอบ 43) |
| ล้าง layout ส่วนตัว | `DELETE /admin/layouts/:zone/configuration` (`clearLayoutConfigurationWorkflow`) | ใช้ตามเดิมใน runbook (กฎข้อ 19 รอบ 43) |
| lint ของ workflow/step/module | `@medusajs/eslint-plugin` (`step-id-kebab-case` ฯลฯ) | แก้ตามกฎ ไม่เปลี่ยน id ที่ engine เก็บ (กฎข้อ 20 รอบ 43) |
### Business rules (รอบ 43)
18. (กฎข้อ 18 รอบ 43 — คนละชุดกับเช็กลิสต์ bump ข้อ 18; OPS-36 — review #536) `redactPii` (`src/lib/redact-pii.ts`): (a) ค่าของ key PII ใน JSON ที่ escape ซ้อนและ**ลงท้ายด้วย backslash** ต้องไม่ทำให้ค่าของ key ถัดไปหลุด (เคสที่พบ: `city` "Bangkok" ไม่ถูก redact) — comment ~`:26` "redact เกิน (ทางปลอดภัย)" แก้ให้ตรงพฤติกรรม;
    (b) ระบุใน comment + unit ว่ารองรับ escape ซ้อน ≤ 3 ชั้น (≥ 4 ชั้นไม่ redact — ยอมรับ); (c) ค่าที่ `util.inspect` ตัดเป็นหลายท่อน (`'…' +\n '…'` เมื่อสตริงมี `\n`) ถูก redact ทุกท่อน;
    (d) คง linear-time (unit 100k ตัวอักษรเดิม) และไม่ตัด id/`request_id`/จำนวนเงิน
19. (กฎข้อ 19 รอบ 43 — คนละชุดกับเช็กลิสต์ bump; OPS-37 — review #536, #548) (a) `docs/ops/production.md` "หลัง go-live": ยืนยันบน browser ว่า widget `order-refund-blocked` ของแอดมินที่มี layout ส่วนตัวอยู่ตำแหน่งใด แล้วแก้ถ้อยคำ "อยู่ท้ายคอลัมน์หลักใต้ Payments" ให้ตรง;
        ทาง (2) ให้คำสั่งที่รันได้ทันทีใน DevTools console ของหน้า admin (`fetch("/admin/layouts/order.details/configuration", { method: "DELETE", credentials: "include" })`);
    (b) `.github/workflows/ci.yml` job ที่บูต backend ให้ e2e เก็บ log เต็มของ backend เป็น artifact (retention 14 วัน — CLAUDE.md ข้อ 6) นอกเหนือจาก tail 200 บรรทัดเดิม (tail ไม่ครอบช่วง test — review #548)
20. (กฎข้อ 20 รอบ 43 — คนละชุดกับเช็กลิสต์ bump; OPS-38 — GB-32 #534 builder) `pnpm --filter backend lint` ไม่มี warning ใน `src/workflows/group-buy/campaign.ts` (~`:177` step id), `src/workflows/group-buy/refund-cancelled-membership.ts` (~`:48` workflow id),
    `src/lib/json-logger.ts` (import path ภายใน build ของ package) และ `src/modules/evoucher/service.ts` (method ที่ใช้ manager แต่ขาด `@InjectManager`) — **id ของ step/workflow ที่ engine เก็บห้ามเปลี่ยน** (เปลี่ยนชื่อตัวแปรแทน แบบกฎข้อ 58e ของ spec 04; ถ้าต้องเปลี่ยน id → หยุดและรายงาน)
21. (กฎข้อ 21 รอบ 43 — คนละชุดกับเช็กลิสต์ bump; OPS-39 — review #554, owner 2026-11-25 ก่อน go-live) `redactPii`/`redactValue` (`src/lib/redact-pii.ts`) ปิดช่องที่เหลือหลัง OPS-36:
    (a) ค่าที่ `util.inspect` quote ด้วย `'` และ escape `'` ภายในเป็น `\'` (inspect ทำเมื่อสตริงมีครบทั้ง `'`, `"` และ backtick) ต้อง redact ทั้งค่าเมื่ออยู่ใน JSON escape 0–3 ชั้น —
        ชั้น k: `\'` ของ inspect = backslash 2^k ตัว + `'` (JSON ไม่ escape `'`) ส่วน backslash จริงในค่า = 2^(k+1) ตัว จึงแยก quote ปิดได้ก็ต่อเมื่อรู้ k (ปัจจุบัน `\\.` กิน `\\` แล้วจบที่ `'` ถัดไป → ส่วนที่เหลือหลุด เช่น `name: '[REDACTED]'s \"Somchai\" …`; มีมาตั้งแต่ OPS-35);
        วิธีรู้ k (เช่น ลองทีละชั้นแล้วยืนยันด้วยช่วง backslash ของ `"` ภายในค่า ซึ่งต้องมีเสมอในกรณีนี้) หรือ redact เกินถึงขอบที่ปลอดภัย = builder เลือก แต่ต้องไม่กลืน id/`request_id`/จำนวนเงินของ key ถัดไปในบรรทัด
    (b) ค่าของ key PII ที่เป็น array แบบแบน (สมาชิกเป็น string/ตัวเลข) ถูก redact ทั้ง array (หรือทุกสมาชิก) ทั้งรูป `util.inspect` (`name: [ 'Somchai' ]`, หลายบรรทัด, ท่อน `+`), JSON (`"name":["Somchai"]`) และ JSON escape 1–3 ชั้น (`\"name\":[\"Somchai\"]`) —
        ตรวจบน develop `0c416cce`: **ทั้งรูป inspect และรูป JSON หลุด** (ค่าต้องขึ้นต้นด้วย quote/ตัวเลขเท่านั้น `[` จึงไม่ match);
        array ซ้อน/object ใน array ไม่บังคับ (redact เกินได้) แต่ห้ามทำให้ค่าหลัง `]` ของ key ถัดไปหลุด
    (c) `redactValue` (field แบบ structured ของ log): ค่า array ใต้ key PII (`{ name: ["Somchai"] }`) ทุกสมาชิกที่เป็น string/ตัวเลขเป็น `[REDACTED]` — ปัจจุบัน array ส่ง `key = undefined` ให้สมาชิกจึงผ่าน `redactPii` เฉยๆ และหลุด (ตรวจบน develop `0c416cce`)
    (d) คงข้อจำกัดเดิม: linear-time (unit 100k ตัวอักษรเดิม ≤ เกณฑ์ 200ms เดิม), escape ≤ 3 ชั้น (≥ 4 ไม่บังคับ — กฎข้อ 18b รอบ 43), ไม่ตัด id/`request_id`/จำนวนเงิน, redact เกินได้แต่ห้ามหลุด; test เดิมของ AC-48/50/51 ผ่านไม่แก้ fixture
22. (กฎข้อ 22 รอบ 43 — คนละชุดกับเช็กลิสต์ bump; OPS-40 — review #559, owner 2026-11-25 ก่อน go-live ไม่บล็อก v0.3.1) `redactPii` (`src/lib/redact-pii.ts`) กิ่ง**ค่าเดี่ยว** (`scalarValue` ~`:67–70`) ปิดช่องแบบเดียวกับที่ OPS-39 ปิดให้ array —
    ตรวจบน develop `9749d6d1`: key ของ `KEY_VALUE` (~`:90`) มีแค่ `(?<![A-Za-z0-9_$])` ไม่มี `STRUCTURAL_KEY` และ `scalarValue` ใช้ guard ว่าง (`inspectTail("", "")` และเนื้อหาในกิ่ง quote ปกติไม่มี `G`/`GQ`) และไม่บังคับขอบหลังค่า จึง match `<pii-key>:` ที่อยู่**ในเนื้อหา**ของค่าอื่นได้:
    (a) ค่า (ของ key ใดก็ได้) ที่ลงท้ายด้วยรูปเปิด key PII ค่าเดี่ยว (`name: '`, `name: "`, `phone: `, `Name: `, JSON `"name":"` และรูปที่ escape 1–3 ชั้น) ต้องไม่ทำให้ค่าของ key PII ถัดไปหลุด
        (ตัวอย่าง: `inspect({ note: "name: '", city: "Bangkok" })` → quote ปิดของ `note` ถูกนับเป็น quote เปิดของค่า `name` ปลอม แล้วปิดที่ quote เปิดของ `city` → "Bangkok" หลุด;
        fuzz ของ builder OPS-39: develop เดิมหลุด 82,893 กรณี หลัง OPS-39 ยังหลุด ~20,188 ในชุดรูปเปิดค่าเดี่ยว) และต้องไม่กลืน id/จำนวนเงิน/ชื่อ key ที่ไม่ใช่ PII ที่ตามมา
        (`total`, `amount`, `display_id`, `request_id`, `currency_code`);
    (b) ค่า PII ที่ quote ด้วย `'` และมี `\'` (กิ่ง `INSPECT_ESCAPED_QUOTE` ~`:68`) ใน JSON escape 1–3 ชั้น ที่เนื้อหามีข้อความรูป `<pii-key>:` → `GQ` ทำให้กิ่ง `\'` ล้มแล้วตกไปกิ่งเดิมของ develop (`\\.` ปิดผิดที่ `'` ถัดไป) → ส่วนที่เหลือของค่าหลุด — ต้อง redact ทั้งค่า (หรือเกินถึงขอบที่ปลอดภัย);
    (c) กลไก (แนะนำ — ตามที่ OPS-39 ใช้กับ array): key ของกิ่งค่าเดี่ยวต้องอยู่ตำแหน่งโครงสร้าง (`STRUCTURAL_KEY` นำด้วย lookahead ความยาวคงที่ของอักขระแรกของค่า แบบ `(?=\[)` — ห้ามให้ `\s*` ท้าย lookbehind ย้อนช่วง whitespace ยาว),
        เนื้อหาห้ามมี `<pii-key>:`/ขอบ field (`G`/`GQ`), ค่าต้องตามด้วยขอบ (`,` `}` `]` newline ดิบ/ที่ escape หรือท้ายข้อความ) — ถ้าการบังคับตำแหน่งโครงสร้างทำให้ค่าที่ develop redact อยู่ (เช่น ข้อความอิสระ `customer name: 'x'`) หลุด ต้องคงกิ่งเดิมไว้เป็น fallback ที่มี guard; วิธีจริง = builder เลือก แต่ต้องผ่าน (d);
    (d) ด่านทุกการแก้ (บทเรียน OPS-39 5 รอบ review): fuzz เทียบ develop `9749d6d1` **สองทิศ** — PII หลุดเพิ่ม = 0 และ id/จำนวนเงิน/ชื่อ key ที่ไม่ใช่ PII หายเพิ่ม = 0;
        ReDoS: ไล่ทุก lookbehind/lookahead ใหม่กับรูป "ทุกจุดเริ่ม match ล้ม" และ "whitespace/newline ยาวคั่น key กับค่า"; การ compile + เรียกครั้งแรก ≤ 200ms;
        **ข้อยกเว้นของเกณฑ์สองทิศ (owner ตัดสิน 2026-11-25 สองครั้ง — review #562 รอบ 4–5)**: regex ที่ไม่นับความลึกวงเล็บ/ชั้น escape รับประกัน "ไม่แย่กว่า develop ทุก seed" ไม่ได้
        เมื่อการจับคู่ quote เลื่อนไปแล้ว — กรณีที่ PR แย่กว่า develop ที่จุด X (marker PII ที่หลุด หรือ key/ค่า id/จำนวนเงินที่หาย) ได้รับยกเว้นเมื่อเข้าข้อใดข้อหนึ่งต่อไปนี้
        (ตรวจด้วยสคริปต์จำแนกของ reviewer/builder ที่แนบใน PR; กรณีที่ไม่เข้าข้อยกเว้นต้องเป็น 0):
        (d1) ค่า PII ถูกปิดผิดที่ตั้งแต่ develop — มี field PII G ที่เข้าครบสามข้อ: ① ค่าของ G เริ่มก่อน X; ② develop ปิดค่าของ G ผิดที่จากเนื้อหาของค่าเอง
             (render `{G: v, id}` เดี่ยวด้วย serializer และชั้น escape เดียวกัน แล้วช่วงที่ redact ไม่เท่ากับช่วงค่าจริง — จบก่อน, จบหลังจนกลืน key ถัดไป หรือ redact เป็นท่อน;
             การเลื่อนที่มาจาก key หรือค่าที่ไม่ใช่ PII ไม่นับ); ③ counterfactual: แทนอักขระในค่า G ที่ทำให้เข้าข้อ ② ด้วย `a` (คงความยาวและ marker) แล้ว PR ไม่แย่กว่า develop ที่ X อีก;
        (d2) ชื่อ key ใน `'` ที่อ่านชั้น escape ไม่ได้ — key อยู่บรรทัดเดียวกับสมาชิกก่อนหน้า (ตามหลัง `{ ` หรือ `, ` ไม่มี newline นำหน้า) และมี backslash หน้า quote ภายในชื่อ key
             (เช่น `\'` ที่เป็นได้ทั้ง `\'` ของชั้น 1 และ backslash จริงท้าย key ของชั้น 0); counterfactual: แทน backslash/quote ในชื่อ key นั้นด้วย `a` (คงความยาว)
             แล้ว PR ไม่แย่กว่า develop ที่ X อีก — จำแนกเป็นหมวดแยกจาก (d1);
        (d3) การสแกนเลื่อนเพราะ key/สตริงของ field ที่ไม่ใช่ PII ที่ regex อ่านโครงสร้างไม่ได้ — กรณีที่ PR แย่กว่า develop ที่จุด X ได้รับยกเว้นเมื่อมี field ระดับบนสุด F ตัวเดียวที่ key ไม่ใช่ key PII และอยู่ก่อน field ของ X ซึ่งเข้าครบสามข้อ: ① key ของ F หรือสตริงใดภายในค่าของ F (รวม key/ค่าของ object ซ้อน, key ของ Map, สมาชิก array, สตริงหลายท่อน) มีอักขระโครงสร้างอย่างน้อยหนึ่งตัว: newline (`\n` `\r`), `{` `}` `[` `]` `:` `,` `'` `"` `` ` `` `\` `+` ② ต้นเหตุอยู่ใน F: ในข้อความเต็ม ไม่มี match ระดับนอกของ `KEY_VALUE` ของ PR ที่คร่อมจุดเริ่มของ F (การสแกนเข้า F ตรงที่) และมี match ระดับนอกที่เริ่มภายในช่วงของ F แต่จบเลยจุดจบของ F (การสแกนออกจาก F แบบเลื่อน) — ช่วงของ F หาได้จากการ render `{F}` เดี่ยวด้วย serializer เดียวกันแล้วหาในข้อความชั้น 0 ก่อน map ขึ้นชั้น escape ③ counterfactual: แทนอักขระโครงสร้างตาม ① ทุกตัวใน key และสตริงทั้งหมดของ F ด้วย `a` (คงความยาว ไม่แตะ field PII และ marker) ใน object เต็ม แล้ว PR ต้องไม่แย่กว่า develop ที่ X อีก ตรวจหลัง (d1)/(d2) และนับเป็นหมวดแยก
             (owner ตัดสิน 2026-11-26: เพิ่ม (d3) แล้ว merge head `7a457480` ได้โดยไม่แก้ src อีก ส่วนที่เหลือยกไป OPS-41; ตัวจำแนก `cls5-OPS40.mts` ของ reviewer);
        **กรณีที่รู้แล้ว (owner ตัดสิน 2026-11-26)**: fixture `cart_13rjFZ` (`fuzz.mts all` seed 48001–52000, 9 render) ไม่เข้า (d1)/(d2)/(d3) — บันทึกเป็นกรณีที่ OPS-41 ต้องปิด
             แล้ว merge OPS-40 ได้ (ดูแถว OPS-41);
        งานที่ปิดช่องเหล่านี้ทั้งหมด (parser ที่นับความลึก/ชั้น escape) แยกเป็น OPS-41 หลัง go-live;
    (e) คงข้อจำกัดเดิมของกฎข้อ 18, 21 รอบ 43: linear-time ≤ 200ms @ 100k ตัวอักษร, escape ≤ 3 ชั้น, ไม่ตัด id/`request_id`/จำนวนเงิน, redact เกินได้แต่ห้ามหลุด; test เดิมของ AC-48/50/51/54 ผ่านไม่แก้ fixture;
    (f) **นอกขอบเขต (หลัง go-live — ไม่ต้องแก้ใน OPS-40, unit ไม่บังคับ)**: ค่าของ key PII ที่เป็น object/array ซ้อน, escape แบบผสม (ผล `util.inspect` ที่ครอบ `JSON.stringify` ซ้อนอีกชั้น), และ array จริงที่สมาชิกมีหน้าตาเหมือนขอบ field
### Acceptance criteria (รอบ 43)
- AC-51 (OPS-36, กฎข้อ 18 รอบ 43) ☑ (unit red 5 → green: เคส review #536 + escape 1–3 ชั้น 3 + util.inspect หลายท่อน 1; review #554 red 3 → green: util.inspect หลายท่อนใน JSON escape 1–3 ชั้น; escape 0 ชั้น/≥ 4 ชั้นผ่านทั้งก่อนและหลัง; linear-time เดิม 6 กรณีผ่านที่เกณฑ์ 200ms เดิม + เพิ่ม 9 กรณี) unit `redact-pii` — **ล้มบน develop** ก่อน: fixture JSON escape ซ้อนที่ค่า `email` ลงท้ายด้วย `\\` ตามด้วย `"city":"Bangkok"` → ไม่เหลือค่า email และไม่เหลือ "Bangkok";
  escape 1–3 ชั้น redact ครบ; สตริงหลายท่อนของ `util.inspect` (`address_1` ที่มี `\n`) ไม่เหลือท่อนใด; unit linear-time เดิมผ่านโดยไม่เพิ่มเกณฑ์เวลา
- AC-52 (OPS-37, กฎข้อ 19 รอบ 43) unit `ops-runbook.unit.spec.ts`: หัวข้อ "หลัง go-live" มี `method: "DELETE"` และ `credentials: "include"`; unit `ci-workflow.unit.spec.ts`: job ที่บูต backend สำหรับ e2e มี `actions/upload-artifact` ของไฟล์ log backend ที่ `retention-days: 14`
- AC-53 (OPS-38, กฎข้อ 20 รอบ 43) output ของ `pnpm --filter backend lint` (แนบก่อน/หลังใน PR) ไม่มี warning ในสี่ไฟล์; unit: id ของ step/workflow ที่แตะ (`createStep`/`createWorkflow` อาร์กิวเมนต์แรก) เท่าค่าบน develop; test เดิมของ evoucher ผ่าน
- AC-54 (OPS-39, กฎข้อ 21 รอบ 43) ☑ (unit red 22 → green: (a) ชั้น 1–3 = 3, (b) array 4 รูป × 0–3 ชั้น = 16 + JSON parse ได้ 1 + `redactValue` 1, (c) fuzz 1; (a) ชั้น 0 + guard 0–3 ชั้นผ่านทั้งก่อนและหลัง; ReDoS ใหม่ 14 กรณี ≤ 200ms; test เดิมผ่านไม่แก้ fixture; review #559 red 5 → green: array ไม่มี `]` ทุก key ล้มและสแกนถึงท้าย O(n²) → `]` ไม่บังคับ + ReDoS 5 กรณี, quote ของผลจากสมาชิกตัวแรก; re-review #559 red 60 → green: ค่าที่ไม่ใช่ PII ลงท้ายด้วย `<pii-key>: [` ไม่ทำให้ key ถัดไปหลุด — สมาชิก array/กิ่ง `\'` ห้ามมีหรือตามด้วยรูป `<pii-key>:`, สมาชิก null/true/false; fuzz เทียบ develop หลุดเพิ่ม 0; re-review #559 รอบ 3 red 51 → green: สมาชิกปลอมไม่กลืนจำนวนเงิน/id/key ที่ไม่ใช่ PII — `]` บังคับ, สมาชิกต้องตามด้วยขอบ array, key ของ array ต้องอยู่ตำแหน่งโครงสร้าง, เนื้อหาห้ามข้าม newline/ขอบ field; fuzz เทียบ develop สองทิศ = 0; re-review #559 รอบ 4 red 4 → green: whitespace/newline ยาวคั่น key กับค่า O(n²) → `(?=\[)` หน้า lookbehind) unit `redact-pii` — **ล้มบน develop** ก่อน (รายงานจำนวน red → green ใน PR):
  (a) `redactPii(s)` โดย s = `inspect({ name: "it's \"Somchai\" \`x\`", id: "cart_01ABC" })` ห่อด้วย `JSON.stringify` 0, 1, 2, 3 ชั้น → ผลไม่มี `Somchai` และยังมี `cart_01ABC` (ชั้น 1–3 red; ชั้น 0 ผ่านทั้งก่อนและหลัง);
      guard (ผ่านทั้งก่อนและหลัง — กันแก้ (a) แล้วพัง): ค่า `name` ที่ลงท้ายด้วย backslash จริง (`"a\\"` ใน JS) ตามด้วย `city: 'Bangkok'` ใน escape 0–3 ชั้น → ไม่มี `Bangkok`;
  (b) ค่า array: `inspect({ name: ["Somchai", "Jaidee"], postal_code: [10110] })` (บรรทัดเดียวและแบบ `breakLength: 1` หลายบรรทัด) และ `JSON.stringify({ name: ["Somchai"], city: "Bangkok", id: "pay_01X" })` ห่อด้วย JSON.stringify 0–3 ชั้น →
      ไม่มี `Somchai`/`Jaidee`/`10110`/`Bangkok` และยังมี `pay_01X`; `redactValue({ name: ["Somchai", 1] })` → `{ name: ["[REDACTED]", "[REDACTED]"] }`;
  (c) fuzz: PRNG แบบ seed คงที่ (บันทึก seed ใน test) สร้าง ≥ 500 object ที่ค่าของ key PII สุ่มจากอักขระ `'` `"` `` ` `` `\` `\n` `[` `]` `,` `:` ช่องว่าง ตัวอักษร พร้อม marker เฉพาะ (เช่น `PIIMARK`) — เป็น string หรือ array ของ string —
      ผ่าน `inspect` แล้ว `JSON.stringify` 0–3 ชั้น → ผล `redactPii` ไม่มี marker ทุกกรณี และ id `cart_…` ที่อยู่ใน key ที่ไม่ใช่ PII ยังอยู่;
  (d) ReDoS: input ≥ 100k ตัวอักษรอย่างน้อย 3 แบบใหม่ (เช่น `name: '` + `\\'` ซ้ำไม่มี quote ปิด, `name: [ ` + `'a', ` ซ้ำไม่มี `]`, `\"name\":[` + `\\\"a\\\",` ซ้ำ) แต่ละแบบ ≤ 200ms (เกณฑ์เดิม); test linear-time และ test เดิมของ AC-48/50/51 ผ่านไม่แก้
- AC-55 (OPS-40, กฎข้อ 22 รอบ 43) ☑ (unit red 45 → green: (a) 40/80 — `name: '` × inspect 8, `phone: ` 16, `Name: ` 16; guard 40 กรณีผ่านทั้งก่อนและหลัง, (b) ชั้น 1–3 = 3, (c) fuzz 1, fallback backtrack stack ล้น 1; กลไก = จับ field ที่ไม่ใช่ PII ที่ตำแหน่งโครงสร้างทั้งค่าแล้ว redact ภายในค่าด้วยกิ่ง key PII; fuzz เทียบ develop สองทิศ = 0/0 (3.2M + 1.6M กรณี); ReDoS ใหม่ 13 กรณี ≤ 200ms; test เดิมผ่านไม่แก้ fixture; review #562 red 33 → green: key ที่ไม่ใช่ identifier (`x-note`/`user-agent` × ค่า PII ขึ้นต้นด้วยอักษรไทย/ช่องว่าง/เครื่องหมาย 12, ตาราง (a) × key 6 แบบ 18), array 22f ตามด้วย `postal_code` 2, fuzz ที่ขยาย 1 — key ที่มี quote เข้า field ได้, สมาชิกของค่า field ต้องตามด้วยขอบค่า, array ใต้ key PII ที่ไม่ผ่านกิ่ง array ถูกจับเป็น field; fuzz สองทิศ (generator เดิม + ที่ขยาย) = 0/0; re-review #562 รอบ 2 red 33 → green: key ใน quote ที่มี quote อีกชนิด/backslash/`\n`/tab/surrogate × ค่า PII ขึ้นต้นด้วย `+` `,` `]` `}` newline 30, fuzz 1, backtrack stack ล้น 2 — quote ปิดของ key ตามชั้น escape (`"`) หรือ quote แรกที่ตามด้วย `:` (`'`/backtick), RangeError → `[REDACTED]` ทั้งข้อความ (ตัดสินโดย session หลัก); re-review #562 รอบ 3 red 16 → green: ค่า PII ขึ้นต้นด้วย `+` 1, key ใน quote ยาวเกิน 128 token 15 — ` +` ที่มีช่องว่างนำเท่านั้นเป็นขอบ, key ไม่จำกัดความยาว (หยุดที่ quote ถัดไปที่ไม่มี backslash นำ), key ที่ค่าไม่ใช่สตริงจับเฉพาะ key; fuzz ของ reviewer + ของ builder หลุด/หายเพิ่ม 0/0; re-review #562 รอบ 4–6 (owner ตัดสิน 2026-11-25 สองครั้ง: เกณฑ์สองทิศมีข้อยกเว้น (d1)/(d2) ของกฎข้อ 22d) red 10 บน `4942a265` → green: array ซ้อน/object key ว่าง/Map ใน array 4, key ที่มี ' " backtick ครบ 2, `cart_6vjFZ` 4 (+ Map key หลายท่อน 2 จาก fuzz) — key ใน ' ปิดตามชั้นที่อ่านได้, สมาชิกไม่มี key, สมาชิก field ห้ามมี newline ดิบ; ตัวเลขจำแนกรอบนี้ใช้ตัวจำแนกที่หลวม (นับ `dk_none`/`nospan` เป็น (d1)); re-review #562 รอบ 7 red 4 บน `dbf9a8a3` → green: ` +` เป็นขอบสมาชิกเฉพาะเมื่อท่อนถัดไปขึ้นต้นด้วย quote (key หลายท่อนบรรทัดถัดไป 1, `cart_2d5FZ` 3); จำแนกด้วยตัวจำแนกแบบเข้มของ reviewer (`cls4`): fz_nokm 1–30000 ทุกโหมด, `fuzz.mts all` 1–44000, keyq 1–30000, generator M ของ reviewer 1–10000, object ซ้อน 1–600 และ fuzz รอบ 3 1–500 ของ builder — กรณีที่ PR แย่กว่า develop เข้า (d1)/(d2) แบบเข้ม 100% (ไม่เข้า 0)) unit `redact-pii` — **ล้มบน develop** ก่อน (รายงานจำนวน red → green ใน PR; รูปที่ไม่ red บน develop = guard ที่ผ่านทั้งก่อนและหลัง ระบุใน PR):
  (a) รูปเปิดค่าเดี่ยว 5 แบบ (`name: '`, `name: "`, `phone: `, `Name: `, JSON `"name":"`) เป็นท้ายค่าของ field ที่ไม่ใช่ PII (`note`) ตามด้วย `city: "Bangkok"` และ `total: "1999.50"`, `display_id: 1042`, `request_id: "req_01ABC"`, `currency_code: "thb"` →
      serialize 4 แบบ (`util.inspect`, `util.inspect` `breakLength: 1`, `JSON.stringify`, `JSON.stringify(…, null, 2)`) × ห่อด้วย `JSON.stringify` 0–3 ชั้น (5 × 4 × 4 = 80 กรณี) → ผลไม่มี `Bangkok` และยังมี `1999.50`, `1042`, `req_01ABC`, `thb` และชื่อ key `total`/`display_id`/`request_id`/`currency_code` ทุกกรณี
      (อย่างน้อยรูป `name: '` × inspect × 0 ชั้น และรูป `phone: ` ต้อง red บน develop);
  (b) `\'` + `<pii-key>:`: `inspect({ name: "it's \"Somchai\" \`x\` city: y", id: "cart_01ABC" })` ห่อด้วย `JSON.stringify` 0–3 ชั้น → ไม่มี `Somchai` และยังมี `cart_01ABC` (ชั้น 1–3 red; ชั้น 0 ผ่านทั้งก่อนและหลัง);
  (c) fuzz สองทิศ: PRNG seed คงที่ (บันทึก seed ใน test) ≥ 500 object — field ที่ไม่ใช่ PII ค่าลงท้ายด้วยรูปเปิดใน (a) (รวมแบบ escape) ตามด้วย key PII ที่ค่ามี marker (`PIIMARK`) แล้วตามด้วย `total`/`amount`/`display_id`/`request_id`/`currency_code` ที่ค่ารู้ล่วงหน้า —
      serialize 4 แบบของ (a) × 0–3 ชั้น → ผลไม่มี marker และยังมีค่า/ชื่อ key ที่ไม่ใช่ PII ทุกกรณี; PR แนบผลรัน generator เดียวกันเทียบ `redactPii` ของ develop `9749d6d1`: PII หลุดเพิ่ม = 0 และค่า/ชื่อ key ที่ไม่ใช่ PII หายเพิ่ม = 0
      (ถ้ากรณีใดทำให้ผ่านทั้งสองทิศไม่ได้ → หยุดและรายงาน ไม่ผ่อนเกณฑ์เอง) — ยกเว้นกรณีที่เข้าข้อยกเว้น (d1)/(d2)/(d3) ของกฎข้อ 22d (owner 2026-11-25, 2026-11-26) ซึ่ง PR แนบผลจำแนก
      ต่อชุด (fuzz ของ reviewer `fz_nokm` ทุกโหมด, `fuzz.mts all`, keyq, generator M/S, generator object ซ้อนของ builder) ว่ากรณีที่ PR แย่กว่า develop เข้าข้อยกเว้น 100%
      ยกเว้นกรณีที่รู้แล้ว `cart_13rjFZ` (9 render — owner 2026-11-26 ให้ยกไป OPS-41);
  (d) ReDoS: input ≥ 100k ตัวอักษรใหม่อย่างน้อย 4 แบบ ≤ 200ms แต่ละแบบ — "ทุกจุดเริ่ม match ล้ม" (เช่น `note: 'name: ` ซ้ำไม่มี quote ปิด, `, name: "` ซ้ำ) และ "whitespace/newline ยาวคั่น key กับค่า" (`name:` + ช่องว่าง/`\n` 100k + `'x'`, รูปเดียวกันใน escape 1 ชั้น);
      compile + เรียก `redactPii` ครั้งแรก (regex ใหม่จาก `KEY_VALUE.source`) ≤ 200ms; test linear-time และ test เดิมของ AC-48/50/51/54 ผ่านไม่แก้ fixture;
  (e) นอกขอบเขต (กฎข้อ 22f รอบ 43) ไม่มี unit บังคับ
### Tasks (รอบ 43)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| OPS-36 | ☑ #554 — (PII — v0.3.1 ก่อน go-live) redact: ค่าลงท้าย backslash ไม่ทำให้ key ถัดไปหลุด, ≤ 3 ชั้น, สตริงหลายท่อน (กฎข้อ 18 รอบ 43) | `apps/backend/src/lib/redact-pii.ts` (+ unit) | ~20 LOC + ~60 LOC test | AC-51 | PR เอกสารปิดรอบ 42 | — |
| OPS-37 | runbook หลัง go-live (ตำแหน่ง widget + คำสั่ง DELETE) + log backend เต็มเป็น artifact ของ CI (กฎข้อ 19 รอบ 43) | `docs/ops/production.md`, `.github/workflows/ci.yml`, `src/__tests__/{ops-runbook,ci-workflow}.unit.spec.ts` | ~15 LOC + ~30 LOC test | AC-52 | PR เอกสารปิดรอบ 42 | `production.md` (PAY-23 — ตัวหลัง sync) |
| OPS-38 | backend lint warning 4 ไฟล์ โดยไม่เปลี่ยน id ของ step/workflow (กฎข้อ 20 รอบ 43) | ไฟล์ในกฎข้อ 20 รอบ 43, unit | ~15 LOC + ~30 LOC test | AC-53 | PR เอกสารปิดรอบ 42 | — |
| OPS-39 | ☑ #559 — (PII — v0.3.1 ก่อน go-live, owner 2026-11-25) redact: `\'` ของ util.inspect ใน JSON escape 1–3 ชั้น + ค่า array ของ key PII (inspect/JSON/`redactValue`) + fuzz/ReDoS (กฎข้อ 21 รอบ 43) | `apps/backend/src/lib/redact-pii.ts` (+ unit `redact-pii`) | ~25 LOC + ~70 LOC test (< ~100 LOC) | AC-54 | PR เอกสาร OPS-39 (`docs/r43-pii-followup`) | `redact-pii.ts` — ไม่มี task อื่นแตะ |
| OPS-40 | (PII — ก่อน go-live, **ไม่อยู่ใน v0.3.1/ไม่บล็อก v0.3.1**, owner 2026-11-25) redact ค่าเดี่ยว: รูปเปิด key PII ในค่าอื่นไม่ทำให้ key ถัดไปหลุด + `\'` ที่มี `<pii-key>:` ใน escape 1–3 ชั้น + fuzz สองทิศ/ReDoS (กฎข้อ 22 รอบ 43) | `apps/backend/src/lib/redact-pii.ts` (+ unit `redact-pii`) | < ~150 LOC (โค้ด ~30 + test ~110) | AC-55 | PR เอกสาร OPS-40 (`docs/r43-ops40-pii-scalar`) | `redact-pii.ts` — ไม่มี task อื่นแตะ |
| OPS-41 | (PII — หลัง go-live, ☐ รอ owner สั่ง; owner 2026-11-25) `redactPii` แบบ parser ที่นับความลึกวงเล็บ/ชั้น escape แทน regex — ปิดข้อยกเว้น (d1)/(d2)/(d3) ของกฎข้อ 22d รอบ 43 (ค่า PII ที่ develop ปิดผิดที่, key ใน `'` บรรทัดเดียวกันที่มี backslash, การสแกนเลื่อนเพราะ key/สตริงของ field ที่ไม่ใช่ PII) และ PII ในชื่อ key (follow-up #562); test case ที่ต้องปิด (owner 2026-11-26): fixture `cart_13rjFZ` (`fuzz.mts all` 48001–52000 — ค่า `total0: '1999.50'` กินข้าม `,\n` เข้า key ที่มี quote ปน `` 'email: `\' `` แล้ว `address_1: "` ในชื่อ key กลืนไปถึง `first_name`) และ generator S ของ reviewer (`cls5-OPS40.mts`) | `apps/backend/src/lib/redact-pii.ts` (+ unit, fuzz สองทิศ/ReDoS ตามกฎข้อ 22d) | ต้องมี spec + ADR ก่อน | — (เขียน AC ใน spec ก่อนทำ) | OPS-40, spec/ADR ของ OPS-41 | `redact-pii.ts` |

ลำดับ: OPS-36 ∥ OPS-37 ∥ OPS-38 — OPS-36 ใน v0.3.1 ก่อน go-live (owner สั่งแล้ว 2026-11-25); OPS-37, OPS-38 หลัง go-live (☐ รอ owner สั่ง)
OPS-39 (เพิ่ม 2026-11-25 หลัง train #557): ∥ งานหลัง go-live ทุกตัว — **v0.3.1 รอ OPS-39 merge ก่อน owner merge `develop → main`** (☑ #559 — v0.3.1 พร้อม)
OPS-40 (เพิ่ม 2026-11-25 หลัง #559): ∥ งานหลัง go-live ทุกตัว — ต้อง merge ก่อน go-live (Go-live ข้อ 13) แต่ไม่บล็อก v0.3.1 (owner merge v0.3.1 ได้ก่อน OPS-40 merge)

## Open questions (รอบ 35)
- **Q-O6** [**ตอบแล้ว: ก — owner 2026-11-18** (placeholder inline เฉพาะบรรทัด build); ไม่เปลี่ยนคำตัดสินข้อ ก] (พบระหว่างวางแผน: `medusa build` โหลด `medusa-config.ts` → guard ของ ADR-010/OPS-7/OPS-21 throw เมื่อ `NODE_ENV=production` แต่ stage build ของ Dockerfile ไม่มี env → image build ล้มถ้าตั้งแค่ `NODE_ENV`):
  (ก) **[แนะนำ]** placeholder inline เฉพาะบรรทัด build ของ Dockerfile (กฎ b; ไม่มี `ALLOW_TEST_PROVIDERS`) — ไม่แตะโค้ด app/guard/ADR; ผลกระทบ: guard env ตัวใหม่ในอนาคตต้องเพิ่ม placeholder ที่ Dockerfile ด้วย (ลืม → job `docker-worker-mode` แดงทันที ไม่หลุดเงียบ), บรรทัด build ยาวขึ้น ~5 ตัวแปร
  (ข) ให้ guard ข้ามตอน `medusa build` (ตรวจ argv หรือตัวแปรใหม่) — Dockerfile สั้น แต่เพิ่มทางปิด guard ใหม่: ต้องแก้ ADR-010 (ภาคผนวก) + `prod-guards.ts`/`notification-providers.ts` + test; เสี่ยงตัวแปรที่ปิด guard หลุดไปตอนรันจริง
  (ค) บังคับ `process.env.NODE_ENV` ของ admin ผ่าน `admin.vite` ใน `medusa-config.ts` — ไม่ต้องตั้ง env ที่ใด แต่ vite/plugin-react ยังถือว่าเป็น development (bundle อาจผสม dev/prod) และไม่ตรงกับคำตัดสินข้อ ก → ต้องมี ADR

## Open questions (รอบ 32)
- ~~**Q-O5**~~ ✅ **owner ตอบ ก 2026-11-17** → OPS-26 (หัวข้อ "Follow-up รอบ 32"); คำถามเดิม: (OPS-23 #371 — `docs/evidence/scale/OPS-23/REPORT.md` ข้อสรุป 1–3) server CPU เต็ม ~115% (100 = 1 core) ทุกค่า pool, Postgres ~28%, (d)/(e) ของ checkout ไม่ลดด้วย pool → คอขวดคือ CPU ของ server process เดียว;
  ตรวจแล้ว (develop `a9fec926`): spec นี้**รองรับ horizontal scale อยู่แล้ว** (ตาราง Medusa "Server แบบ stateless; flag `--cluster`", Deliverables ข้อ 2 "prod: 2× server") และ `medusa start` ของ 2.22.1 มี `--cluster` (fork process ตามจำนวน — `@medusajs/medusa/dist/commands/start.js:175–313`)
  แต่ load-nightly บูต `server` 1 container 1 process (`tools/load/run.sh:100`, `docker-compose.prod.yml`) จึงยังไม่เคยวัดแบบที่ prod จะรัน; runner มาตรฐาน 4 vCPU ใช้ร่วมกับ k6/Postgres/Redis/worker (ข้อจำกัดของ Q-O3 a):
  (ก) **[แนะนำ]** OPS-26 วัดก่อนตัดสิน: เพิ่ม input `server_processes` (ค่าเริ่มต้น 1 = เดิม) ใน `load-nightly.yml` → `run.sh` ส่ง `--cluster <n>` ให้ container `server` (ไม่เพิ่ม service/infra — ใช้ flag ของ Medusa ที่ spec ระบุไว้แล้ว)
      แล้วเทียบ 1 vs 2 process ด้วยรูปแบบ AC-38 (gate AC-2/AC-3 ต้องผ่าน, (a)–(e), CPU, event-loop) — เหตุผล: ตอบได้ว่า scale-out ที่ Deliverables ข้อ 2 วางไว้ลด checkout ได้จริงไหมด้วยตัวเลขก่อนลงแรง profile;
      ผลกระทบ: task ops ~40 LOC + REPORT (แบบ OPS-23), ไม่แตะโค้ด app; ถ้าผลให้เปลี่ยนวิธี deploy prod (เช่นใช้ `--cluster` ใน image แทน/คู่กับ replica) → ADR-024 (→ ADR-027 — รอบ 40) proposed; ข้อจำกัด: 4 vCPU ร่วมกับ k6 อาจทำให้ผล 2 process ต่ำกว่าจริง
  (ข) profile ก่อน: รัน load-nightly ด้วย `node --cpu-prof` (หรือ `--prof`) บน server ช่วง checkout แล้วระบุงาน CPU ต่อ request (เช่น workflow/serialization/คำนวณ totals) เพื่อเปิด task ลดงาน — ผลกระทบ: task ops ~50 LOC + วิเคราะห์ profile,
      task แก้จริงตามมาอาจแตะ workflow ของ checkout/hook (ความเสี่ยงสูงกว่า) และอาจพบว่าเป็นงานภายใน Medusa ที่แก้ไม่ได้
  (ค) คงเดิมจนก่อนเปิดร้าน — gate ความถูกต้องผ่านทุก run (0 5xx, ไม่ oversell); เป้า p95 < 300ms ของ v1.0 ยังเป็น "รายงานอย่างเดียว" จนมี staging (Q-O3 a) — ผลกระทบ: ไม่มีงานตอนนี้; ความเสี่ยงเรื่องความเร็ว checkout ช่วง flash sale ย้ายไปตอนตั้ง prod จริง

## Open questions (รอบ 26)
- ~~Q-O4~~ ตัดสินแล้ว (owner 2026-11-09): **(ก)** เปิด OPS-23 วัดเทียบ `DATABASE_POOL_MAX` 10/20/40 ก่อน แล้วค่อยตัดสินค่าของ prod ใน ADR-020 จากตัวเลขจริง (AC-38)

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
