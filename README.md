# Store — e-commerce บน Medusa v2

ร้านค้าระดับ production ที่สร้างบน Medusa v2 + Next.js starter พร้อมระบบ e-voucher, flash sale,
group buying, affiliate และ Stripe (บัตรเครดิต + PromptPay)

เริ่มอ่านที่นี่: `CLAUDE.md` → `docs/spec/00-overview.md` → `docs/ROADMAP.md`
บันทึกการตัดสินใจ: `docs/decisions/` evidence ของแต่ละ PR: `docs/evidence/`

## เริ่มพัฒนาในเครื่อง
ต้องมี Node.js ตาม `.nvmrc` (22.23.4), Docker และ pnpm (เปิดด้วย `corepack enable` — เวอร์ชันมาจาก `packageManager` ใน `package.json`)
```bash
pnpm install
docker compose up -d                                   # Postgres 16 + Redis 7
cp apps/backend/.env.example apps/backend/.env
cp apps/storefront/.env.example apps/storefront/.env.local
pnpm --filter backend db:migrate
pnpm --filter backend dev                              # Medusa + admin ที่ :9000
```
storefront ต้องใช้ publishable key และ region จาก seed (CORE-2) ก่อน `pnpm --filter storefront dev`

### อีเมลตอน seed/dev (EV-13)
ถ้าไม่ตั้ง `RESEND_API_KEY` ใน `apps/backend/.env` channel `email` ใช้ local provider ของ Medusa: ไม่มีอีเมลออกจริง
(เช่น อีเมลส่งมอบ e-voucher และปุ่ม Resend email ในหน้า order) มีแค่ log `Attempting to send a notification ...` ใน console ของ backend
- อยากได้อีเมลจริง: ตั้ง `RESEND_API_KEY` เป็น key ของบัญชี Resend สำหรับทดสอบ คู่กับ `RESEND_FROM_EMAIL=onboarding@resend.dev`
  (ส่งได้เฉพาะอีเมลเจ้าของบัญชีจนกว่าจะ verify domain) แล้ว restart backend
- ดูสถานะการส่งใน DB: `select template, "to", status, created_at from notification order by created_at desc limit 20;`
  (`status` = `pending` / `success` / `failure`; id `noti_…` ของรายการที่ล้มอยู่ใน log ของ backend ไม่แสดงใน toast ของ admin)

## รันแบบ prod-like ด้วย Docker (OPS-1)
backend image เดียวรันได้ทั้ง `server` และ `worker` ตาม worker mode ของ Medusa
(`MEDUSA_WORKER_MODE=server|worker`, `DISABLE_MEDUSA_ADMIN=true` บน worker); scheduled jobs รันเฉพาะบน worker
```bash
export POSTGRES_PASSWORD=$(openssl rand -hex 16) JWT_SECRET=$(openssl rand -hex 32) COOKIE_SECRET=$(openssl rand -hex 32)
docker compose -f docker-compose.prod.yml up -d --build --wait   # postgres, redis, migrate, server (:9000), worker
tools/ops/smoke-worker-mode.sh                                   # ตรวจ AC-1 ใน project แยก `ops1test` (server ที่ :9104)
```
รายละเอียดและข้อจำกัด: `docker-compose.prod.yml`, `apps/backend/Dockerfile`, `apps/storefront/Dockerfile`
Redis modules, pool size, S3 และ CDN (OPS-2): `docs/ops/production.md`
