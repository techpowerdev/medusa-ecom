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
