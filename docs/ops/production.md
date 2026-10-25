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

## ตรวจสอบ
- `pnpm --filter backend test:unit` — `src/__tests__/medusa-config.infra.unit.spec.ts`
- `tools/ops/smoke-worker-mode.sh` — product ที่สร้างบน server ต้องถูกประมวลผลโดย subscriber บน worker
