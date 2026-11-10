# QA REPORT — AF-21 ปฏิเสธรหัสแนะนำที่เป็นคำสงวน (PR #334)

- Spec: `docs/spec/05-affiliate.md` กฎ 45 (ทำให้กฎ 14 + Q4 เป็นจริง), AC-53
- Commit ที่ตรวจ: `83db7369` (branch `feat/AF-21-reserved-codes`)
- สภาพแวดล้อม: backend prod build (`medusa build` → `medusa start`, NODE_ENV=production) + storefront prod build (`next build` → `next start`), DB ใหม่ที่ migrate + seed แล้ว, ไม่ใช้ Redis (in-memory), Stripe key ปลอม, Chromium (Playwright)
- หา element ด้วย `data-testid` ทั้งหมด ตรวจความเป็นไทยด้วย regex `/[฀-๿]/` และ `expectThai` (ไม่มีคำละติน)
- ผลรวม: **AC-53 PASS** ไม่พบ defect

## คำสั่งและ exit code

| ขั้น | คำสั่ง | exit |
|---|---|---|
| ติดตั้ง | `pnpm install --frozen-lockfile` | 0 |
| migrate | `pnpm db:migrate` (apps/backend) | 0 |
| seed | `pnpm seed` | 0 |
| build backend | `pnpm build` (apps/backend) | 0 |
| build storefront | `pnpm build` (apps/storefront) | 0 |
| e2e ของ PR | `playwright test e2e/affiliate-portal.spec.ts --project=chromium` → 5 passed | 0 |
| QA spec | `playwright test e2e/qa334-af21.spec.ts --project=chromium` → 11 passed (ก่อนแก้ assertion ใน QA-3 ของ qa เอง รันครั้งแรกได้ exit 1 — ดูหมายเหตุ) | 0 |
| ทำซ้ำ | `playwright test e2e/qa334-af21.spec.ts e2e/affiliate-portal.spec.ts --repeat-each=2 --workers=1` → 32 passed | 0 |

## ตาราง AC

| AC / checklist | ผล | หลักฐาน |
|---|---|---|
| AC-53 (1) `/th/affiliate/login` สมัครด้วย `affiliate-register-code` = `admin` → `affiliate-register-error` = "รหัสแนะนำนี้เป็นคำสงวน กรุณาเลือกรหัสอื่น" (ตรง regex ไทย ไม่มีคำละติน) ยังอยู่หน้า login, DB ไม่มีแถว affiliate ของอีเมลนี้และไม่มี `code=admin` | PASS | QA-1, `qa334-01-admin-reserved-1280.png` |
| AC-53 (2) คำสงวนอีก 8 คำ (`affiliate, store, auth, api, app, www, support, shop`) ผ่านฟอร์มจริง → ข้อความเดียวกันทุกคำ ไม่มีแถว | PASS | QA-2 |
| AC-53 (2) ตัวพิมพ์ใหญ่ `ADMIN` | PASS (ดูหมายเหตุ) | QA-3, QA-4 |
| AC-53 (3) หลังเจอคำสงวน กรอกรหัสใหม่ที่ไม่ซ้ำ ใช้อีเมล/รหัสผ่านเดิม → เข้า portal, `affiliate-code` ตรงกับที่กรอก, มีแถวเดียวสถานะ `pending`, `provider_identity` ของอีเมลนี้มี 1 แถว | PASS | QA-1, `qa334-02-retry-portal-1280.png` |
| AC-53 (4) `admin1`, `my-shop` สมัครผ่านฟอร์มได้ (`affiliate-code` ตรง, แถว `pending`) | PASS | QA-5 |
| AC-53 (5) รหัสซ้ำกับ affiliate อื่น → ข้อความเดิม "สมัครไม่สำเร็จ รหัสแนะนำนี้อาจถูกใช้แล้ว หรืออีเมลนี้สมัครแอฟฟิลิเอตไว้แล้ว" (ไม่ใช่ข้อความคำสงวน) ไม่มีแถวใหม่ | PASS | QA-6, `qa334-03-duplicate-code-1280.png` |
| AC-53 (6) / กฎ 45(e) ลิงก์ `/r/<code>` ของ affiliate ที่ active → ไปหน้าสินค้า + cookie `aff` (httpOnly); แถวเดิมที่ `code=shop` (จำลองด้วย insert ตรงใน DB เพราะไม่ backfill) → `/r/shop` ยังตั้ง cookie `aff` | PASS | QA-7 |
| API: `POST /affiliate/register` code `admin`/`support` → 400 `invalid_data` "Invalid request: This referral code is reserved"; ข้อความไม่ต่อค่าจาก input; `ab` → 400 ข้อความ slug เท่านั้น (ไม่มีคำว่า reserved) | PASS | QA-4 |
| มือถือ 375px: ข้อความ error อยู่ในจอ (`x ≥ 0`, `x+width ≤ 375`), `scrollWidth ≤ 375`, สมัครต่อด้วยรหัสใหม่ได้ | PASS | QA-8, `qa334-04-admin-reserved-375.png` |
| e2e เดิมของ register (AF-8a) + e2e AF-21 ของ builder | PASS | `affiliate-portal.spec.ts` 5/5, รันซ้ำ 2 รอบด้วย 1 worker ผ่าน |

## Edge case

| กรณี | ผล |
|---|---|
| กดสมัครซ้ำ (dblclick) ด้วย `admin` | ข้อความคำสงวน ไม่มีแถว |
| dblclick ด้วยรหัสดีต่อจากนั้น | มี affiliate แถวเดียว และ `provider_identity` แถวเดียว — PASS |
| สองแท็บ อีเมลเดียวกัน: A ส่ง `www` แล้ว B สมัครสำเร็จ | A ได้ข้อความคำสงวน |
| สองแท็บ ต่อ: A ส่งรหัสใหม่ | ได้ข้อความเดิม (สมัครไว้แล้ว) |
| สองแท็บ ต่อ: A ส่ง `shop` | ได้ข้อความคำสงวน (validator ทำงานก่อนตรวจรหัสซ้ำ) ยังมีแถวเดียวคือของ B — PASS |
| ขอบค่า: `api` (3 ตัว สั้นสุด เป็นคำสงวน) | ถูกปฏิเสธ — PASS |
| ขอบค่า: `apis`, `app1`, `www-shop`, รหัส 32 ตัวที่ขึ้นต้นด้วย `admin` | สมัครได้ (เทียบทั้งคำ ไม่ใช่ prefix) — PASS |
| ตัวพิมพ์ใหญ่ในฟอร์ม (`ADMIN`) | `pattern` ของ input บล็อกก่อนส่ง (`validity.patternMismatch=true`) ไม่มีการส่ง action สมัคร ไม่มีแถว ยังอยู่หน้า login |
| ตัวพิมพ์ใหญ่เมื่อปิด HTML validation (`novalidate`) | server ตอบข้อความคำสงวน และหน้าแสดงข้อความไทยคำสงวน — PASS |
| ทำซ้ำวิธีของ qa ครั้งก่อน (AF-M-02 บน `84b9e610`: สมัคร `admin` ผ่านฟอร์มจริง แล้วตรวจแถวใน DB + คำสงวนที่เหลือผ่าน API) | เดิมรับสมัครได้ ตอนนี้ถูกปฏิเสธทุกคำทั้ง UI และ API — PASS |

## หมายเหตุ / ข้อสังเกต (ไม่ใช่ defect ของ AC-53)

1. **`ADMIN` ในฟอร์ม:** ผู้ใช้จะไม่เห็นข้อความคำสงวนจาก server เพราะเบราว์เซอร์บล็อกด้วย `pattern` (a-z ตัวเล็ก) ก่อนส่ง และแสดง tooltip "ใช้ตัวอักษร a-z ตัวเลข และขีด ยาว 3-32 ตัว" แทน
   - ข้อความคำสงวนจะแสดงเมื่อข้าม HTML validation เท่านั้น
   - API กับ `ADMIN`/`AdMin`/`Shop`/`WWW` ตอบ 400 `invalid_data` "Invalid request: code must be a 3-32 char lowercase slug; This referral code is reserved" คือมีทั้งสอง issue
   - helper ฝั่ง storefront ยังจับได้ จึงแสดงข้อความคำสงวน
2. **ฟอร์มล้างค่าที่กรอกหลังเกิด error:** ช่องอีเมลและรหัสแนะนำว่างเปล่า ผู้ใช้ต้องกรอกอีเมล/รหัสผ่านใหม่ทั้งหมด
   - builder ระบุไว้ใน PR แล้วว่าเป็นพฤติกรรมเดิมของ `<form action>` ใน React 19 และอยู่นอกขอบเขต
   - ควรติดตามเป็นงาน UX แยก
3. **ระหว่างที่ `ADMIN` ถูก `pattern` บล็อก มี POST server action ไปที่ `/th/affiliate/login` 1 ครั้ง** body เป็น `["$undefined","$undefined",{"fresh":true}]`
   - action นี้ไม่ใช่การส่งฟอร์มสมัคร (ไม่มีข้อมูลฟอร์ม และไม่มีแถวใน DB) น่าจะเป็น action อื่นของหน้า
   - assertion รอบแรกของ qa จับ POST ทุกตัวจึงได้ exit 1 จากนั้นแก้ให้จับเฉพาะการส่งฟอร์มสมัคร
4. **รัน `--repeat-each=2` แบบหลาย worker ได้ exit 1 (30 passed, 2 failed)** เป็นปัญหาของการทดสอบเอง ไม่ใช่ของ PR:
   - QA-5 สองรอบรันพร้อมกันแล้วแย่ง code `admin1`/`my-shop` ตัวเดียวกัน
   - AF-8a (AC-35) สองรอบสร้างโปรแกรม P3 ทับกันบน variant เดียวกัน
   - รันซ้ำด้วย `--workers=1` ผ่านทั้ง 32 ตัว (exit 0)

## สิ่งที่ไม่ได้ทดสอบ

- unit jest / integration (`affiliate-auth.spec.ts`) / Vitest ของ builder — ไม่ได้รันซ้ำในเครื่อง ให้ CI รัน (เครื่องใช้ร่วมกัน)
- เบราว์เซอร์อื่นนอกจาก Chromium และอุปกรณ์มือถือจริง (ทดสอบ 375px ด้วย viewport เท่านั้น)
- โหมด Redis / worker แยก process
- แถวเดิมที่เป็นคำสงวนในระบบจริง (QA-7 จำลองด้วย insert ตรงใน DB)
- AF-M-03 (ส่ง `email` เกินมาใน body) ซึ่งอยู่นอกขอบเขตและรอ owner

## Screenshot

| ไฟล์ | สิ่งที่แสดง | ขนาด |
|---|---|---|
| `qa334-01-admin-reserved-1280.png` | สมัครด้วย `admin` → ข้อความไทยคำสงวนใต้ฟอร์ม ยังอยู่หน้า login | 35KB |
| `qa334-02-retry-portal-1280.png` | กรอกรหัสใหม่ด้วยอีเมล/รหัสผ่านเดิม → เข้า portal, `affiliate-code` ตรง | 48KB |
| `qa334-03-duplicate-code-1280.png` | รหัสซ้ำกับคนอื่น → ข้อความเดิม (ไม่ใช่ข้อความคำสงวน) | 37KB |
| `qa334-04-admin-reserved-375.png` | จอ 375px: ข้อความคำสงวนอยู่ในจอ ไม่ล้นแนวนอน | 27KB |
