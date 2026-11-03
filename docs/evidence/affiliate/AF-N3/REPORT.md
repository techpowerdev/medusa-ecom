# QA AF-N3 — ขัดเกลา affiliate portal (PR #237)

spec: `docs/spec/05-affiliate.md` กฎ 40, AC-47 · branch `fix/AF-N3-affiliate-portal-polish` @ `83689a3`
สภาพแวดล้อม: prod build (`medusa start` จาก `.medusa/server` + `next build && next start`), DB แยก (migrate + seed), Redis db แยก,
Node 22.23.3, ไม่ใช้ Stripe (feature นี้ไม่แตะการชำระเงิน)
หา element ด้วย `data-testid` ตรวจความเป็นไทยด้วย `expectThai` (regex อักษรไทย + ไม่มีคำละติน)

## ตาราง AC

| AC | ส่วนที่ตรวจ | Result | Evidence |
|----|-------------|--------|----------|
| AC-47 (40c) | `/th/affiliate/payouts?page=99` และ `/programs?page=99` ที่ 375px และ 1280px → `affiliate-page-out-of-range` ข้อความไทย, ไม่มีลิงก์เปลี่ยนหน้า (`a[href*="?page="]` = 0), ไม่มี scroll แนวนอน, ลิงก์ `affiliate-page-out-of-range-first` กดแล้วไป `/th/affiliate/<list>` จริง; หน้าแรกว่างแสดง `affiliate-payouts-empty` "ยังไม่มีรายการจ่ายเงิน" | pass | 01-payouts-out-of-range-375.png (builder), 03-programs-out-of-range-1280.png |
| AC-47 (40a, 40d) | Earnings: reversed `−฿20.50` และ `−US$3.00` อักขระแรกเป็น U+2212 (ตรวจจาก `textContent`) ไม่มี `-`; approved/paid ที่ไม่มีแถว → `฿0`; แถว `usd` จาก API แสดง `US$12.34` / `−US$3.00` (สกุลมาจาก API ไม่ได้ fix เป็น thb) | pass | 02-earnings-reversed-375.png (builder) + ผล test QA-2 |
| AC-47 (40b) | Profile `affiliate-default-link-copy`: คัดลอก `/r/<code>` เข้า clipboard, `navigator.share` ถูกเรียก 0 ครั้งแม้ browser รองรับ, ปุ่ม disabled ระหว่างทำงาน (คลิกซ้ำ → writeText 1 ครั้ง), สถานะ "คัดลอกลิงก์แล้ว" | pass | 04-profile-copy-only-1280.png |
| AC-47 (40b) | การ์ด Products `affiliate-share-button`: รองรับ Web Share → `share({url, title})` 1 ครั้ง (คลิกซ้ำระหว่างทำงานไม่เพิ่ม); ผู้ใช้ยกเลิก (AbortError) → ไม่แสดง error; ไม่รองรับ → คัดลอก `/r/<code>?to=/products/sweatshirt` 1 ครั้ง + สถานะไทย | pass | 05-products-share-fallback-375.png |
| AC-47 (static) | Vitest `af-n3-portal-polish.test.ts`, `checkout-affiliate-coverage.test.ts` (positive control กฎ 31b/31c), `thai-ui-rule.test.ts` | pass (101/101) | `docs/evidence/affiliate/AF-N3-tests.txt` + qa รันซ้ำ |
| AC-47 (e2e builder) | `e2e/affiliate-portal-polish.spec.ts` | pass | CI artifact |

## Negative / edge case

| กรณี | ผล |
|------|-----|
| `?page=` เป็น 1, 0, -1, abc, 1.5 บน payouts ที่ว่าง | 200, "ยังไม่มี…" ไม่ใช่ out-of-range (pass) |
| `?page=2` บนรายการที่ว่าง | out-of-range (pass) |
| programs `?page=99` ทั้งตอนที่ไม่มีโปรแกรมเลย และตอนที่มีโปรแกรม published อยู่จริง | out-of-range ทั้งสองกรณี ไม่มี pager (pass) |
| affiliate `pending` เปิด payouts/programs `?page=99` | แสดง `affiliate-status-notice` ไม่ใช่ out-of-range (pass) |
| ใช้ token ของ customer เรียก `GET /affiliate/me` | 401 (pass) |
| มี `_medusa_jwt` ของ customer แล้วเปิด `/th/affiliate`, `/earnings`, `/payouts?page=99`, `/profile` | redirect ไป `/th/affiliate/login` (pass) |
| ปลอม cookie `_affiliate_jwt` ด้วย token ของ customer | redirect ไปหน้า login ของ portal (pass) |
| login ในฟอร์มของ portal ด้วยอีเมล/รหัสของ customer | `affiliate-login-error` ข้อความไทย อยู่หน้า login ต่อ (pass) |
| e2e เดิมของ AF-8a/AF-8b (`affiliate-portal*.spec.ts`) รันโดยไม่ตั้ง `E2E_SAVE_EVIDENCE` | 7/7 pass (ไม่มี regression) |

## Defect
ไม่พบ

## ข้อสังเกต (ไม่ block)
- รูปแบบตัวเลขไม่เหมือนกัน: ยอดศูนย์แสดง `฿0` แต่ยอดอื่นมีทศนิยม 2 ตำแหน่ง (`−฿20.50`, `US$12.34`) มาจาก `convertToLocale` ของ thb ที่มีอยู่เดิม PR นี้ไม่ได้เปลี่ยน
- ปุ่มคัดลอกลิงก์ใน Profile กว้างเต็มแถวที่ 1280px (ดูรูป 04) เป็นเรื่องความสวยงามเท่านั้น

Playwright report/trace ฉบับเต็ม: CI artifact ของ job `storefront-e2e` (เก็บ 14 วัน)
