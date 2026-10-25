# ADR-010 Prod guards: ห้าม provider สำหรับทดสอบใน production และ escape hatch สำหรับ CI

สถานะ: accepted (เจ้าของโปรเจกต์, 2026-10-25 — เลือก C + D1)
เกี่ยวข้อง: spec 06 (กฎข้อ 6, Q2), spec 07 (OPS-7, AC-9..11), spec 01 (CORE-3), ADR-007

## บริบท
review/qa พบสองจุดที่ production อาจทำงานแบบ "เงียบ ๆ ผิด":
1. ไม่มี `RESEND_API_KEY` → `buildNotificationProviders` ใช้ provider `local` (log แทนส่งอีเมล) ลูกค้าไม่ได้อีเมลโดยไม่มีใครรู้
2. seed ใส่ `pp_system_default` (manual payment) ให้ region Thailand → ใน production ลูกค้าสั่งซื้อได้โดยไม่จ่ายเงินจริง

มี precedent แล้วใน `src/lib/infra-modules.ts` (OPS-2): production ที่ worker mode แต่ไม่มี `REDIS_URL` → throw ตอนบูต
ข้อจำกัด: CI job `storefront-e2e` และ `docker-worker-mode` รัน backend แบบ production (`medusa start` / image prod) โดยไม่มี
Resend key และ e2e ของ CORE-6 ใช้ manual payment ดังนั้นการผูกกับ `NODE_ENV` อย่างเดียวจะทำให้ CI พัง

## ทางเลือก
A. ผูกกับ `NODE_ENV=production` อย่างเดียว — CI ต้องรันโหมด development หรือใส่ key จริง → ทดสอบไม่ตรงกับ prod / ต้องมี secret
B. ตัวแปร `APP_ENV` (production|staging|ci) เปิด guard เมื่อ `APP_ENV=production` — ถ้า deploy prod ลืมตั้ง guard จะไม่ทำงาน (fail-open)
C. **guard เปิดเสมอเมื่อ `NODE_ENV=production` ปิดได้ด้วย `ALLOW_TEST_PROVIDERS=true` อย่างชัดเจน (CI/staging เท่านั้น)** — fail-closed
D. ไม่บังคับในโค้ด ใช้ checklist go-live อย่างเดียว — พึ่งคน, ไม่มี test

สำหรับ `pp_system_default` มีระดับการบังคับให้เลือกเพิ่ม:
- D1 seed ไม่ใส่ให้ใน production (ตาม C) + script `check:go-live` ที่ตรวจ region จริงก่อนเปิดร้าน
- D2 D1 + hook หลัง `createRegionsWorkflow`/`updateRegionsWorkflow` ปฏิเสธการเพิ่ม `pp_system_default` ใน production
  (กัน admin เปิดเองภายหลัง) — โค้ดและ test มากขึ้น, ปิดทางใช้ manual payment ใน prod ถาวร

## การตัดสินใจ
เลือก C + D1
1. `ALLOW_TEST_PROVIDERS=true` ปิด guard ทั้งหมด; ค่าอื่น/ไม่ตั้ง = guard ทำงานเมื่อ `NODE_ENV=production`
2. guard ของ notification: ขาด `RESEND_API_KEY` หรือ `RESEND_FROM_EMAIL` → throw ตอนโหลด config (แบบเดียวกับ OPS-2)
3. guard ของ payment: seed ไม่ใส่ `pp_system_default`; `check:go-live` (`medusa exec`) ตรวจ region, prefix ของ `STRIPE_API_KEY`,
   และว่าไม่ได้ตั้ง `ALLOW_TEST_PROVIDERS` — exit ≠ 0 ถ้าไม่ผ่าน
4. CI job ที่รันโหมด production ตั้ง `ALLOW_TEST_PROVIDERS=true`; `docs/ops/production.md` ระบุว่าห้ามตั้งใน prod
5. owner ตอบ spec 06 Q2 แล้ว: production ห้าม `pp_system_default` ระดับ D1 — ไม่ทำ D2 (admin ยังเปิดเองผ่าน dashboard ได้)

## ผลที่ตามมา
+ prod ที่ตั้งค่าไม่ครบล้มตอนบูต (เห็นทันที) แทนที่จะทำงานผิดเงียบ ๆ
+ ไม่มี infra ใหม่ ไม่มี custom module; ใช้ seed/`medusa exec` ที่มีอยู่
− เพิ่ม env หนึ่งตัวที่ "อันตรายถ้าตั้งใน prod" — บรรเทาด้วย `check:go-live` ที่ตรวจตัวแปรนี้
− admin ยังเปิด `pp_system_default` ผ่าน dashboard ได้หลัง go-live (D1 ไม่กัน) — `check:go-live` จับได้เมื่อรันซ้ำเท่านั้น
