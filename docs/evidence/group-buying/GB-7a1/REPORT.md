# QA GB-7a1 — หน้ากลุ่ม `/<cc>/g/<token>` อ่านอย่างเดียว (PR #236)

Spec: `docs/spec/04-group-buying.md` (AC-16a, กฎข้อ 28b, 29b) — วันที่ 2026-11-04, commit `a379136`
สภาพแวดล้อม: prod build — backend `medusa build` + `medusa start` (`.medusa/server`), storefront `next build` + `next start`, DB แยก (seed ปกติ), Redis db แยก, node 22, Playwright chromium; ไม่ได้ใช้ Stripe (หน้านี้ไม่มีการชำระเงิน)
ผล: `group-buy-group-page.spec.ts` ของ builder ผ่าน 3/3 + spec ของ QA ผ่าน 12/12 (รวม 15 passed)
รายงาน/trace ฉบับเต็ม: CI artifact `playwright-report` ของ PR #236 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-16a ไม่ login → `group-member-count` = 2, `group-progress` 2/3, `group-countdown` ลดลงหลังรอ 2.5 วินาที (23:59:58 → 23:59:56), ข้อความไทย | pass | 01-group-page-2-of-3.png (builder) + QA test "AC-16a" |
| AC-16a คนที่ 3 join ผ่าน API แล้ว reload → 3 (3/3, สถานะ `succeeded`) | pass | 02-group-page-after-third-join.png (builder) + QA test |
| กฎข้อ 29b `/g/<token>` → `/th/g/<token>` (ทั้ง token จริงและ token ที่ไม่มี) | pass | QA test |
| กฎข้อ 29b อ่านสดแบบ no-store — HTML ตอบ `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, route เป็น `ƒ` (dynamic) ใน `next build` | pass | log QA + log build |
| กฎข้อ 29b ไม่มีปุ่ม join/สร้างทีม — ปุ่มเดียวในหน้าคือ "คัดลอกลิงก์" | pass | QA test "AC-16a" |
| `group-share-link` + ปุ่มคัดลอก ทั้ง desktop 1280 และ 375px: clipboard = `href` = `<origin>/g/<token>`, ปุ่มเปลี่ยนเป็น "คัดลอกแล้ว", ลิงก์ที่คัดลอกเปิดได้จริง, ไม่เลื่อนแนวนอน | pass | 03-group-page-375.png (builder) + QA test |
| token ไม่มีจริงหรือรูปแบบแปลก (`does-not-exist`, `..%2Fcampaigns%2Factive`, `%00`, 300 ตัวอักษร) → 404 | pass | QA test |
| กลุ่มเลย `ends_at` แต่ยัง `open` (ก่อน job GB-4 ทำงาน) → "หมดเวลารวมกลุ่มแล้ว"; นับถอยหลังถึงศูนย์ขณะเปิดหน้าแล้วเปลี่ยนเป็นข้อความเดียวกัน | pass (ดูข้อสังเกต 1) | 04-qa-expired-still-open.png |
| กลุ่ม `failed` → "กลุ่มไม่ครบเป้าหมาย" ไม่มีนับถอยหลังและลิงก์แชร์; กลุ่ม `succeeded` → "กลุ่มครบเป้าหมายแล้ว" | pass | QA test |
| pool group → "ซื้อกลุ่มแบบกลุ่มเปิด", progress `units` 0/5 ชิ้น | pass | 05-qa-pool-fixed-discount.png |
| ส่วนลด fixed 50 THB → "฿50" (ไม่มี %); percentage 15 → "15%" (ไม่มี ฿) | pass | 05-qa-pool-fixed-discount.png + QA test |
| `product_id = null` (จำลองผ่าน DB) → API คืน null, หน้าไม่มี `group-product` และไม่มีปุ่ม join | pass | QA test |
| กฎข้อ 28b ไม่มี PII หรือ promotion code ใน HTML (SSR + RSC payload), response ทุกตัวที่หน้าโหลด และ API (อีเมล/ชื่อลูกค้า, `created_by_customer_id`, membership id, `order_id`, code `GB-<token>`/`GBT-*`, `promo_*`) | pass | QA test "PII/promotion code" |
| ข้อความไทย (regex อักษรไทย) หา element ด้วย `data-testid`; `robots: noindex` | pass | QA test "AC-16a" |

## Defect
ไม่พบ defect ที่ขัดกับ AC-16a หรือกฎข้อ 29b

## ข้อสังเกต (ไม่อยู่ใน spec — ให้ owner/planner ตัดสิน)
1. กลุ่มเลย `ends_at` แต่ยัง `open` (≤ 1 นาทีก่อน job GB-4): นับถอยหลังแสดง "หมดเวลารวมกลุ่มแล้ว" แต่ `group-status` ยัง "กำลังรวมกลุ่ม" และยังแสดงลิงก์แชร์/ปุ่มคัดลอก (ตรงกับ nit ของ reviewer — แก้ใน GB-7a2 ด้วยเงื่อนไข `open && ends_at > now`)
2. ส่วนลด fixed แสดง "รับส่วนลด ฿50" โดยไม่บอกว่าเป็นต่อชิ้น (`allocation: each`)
3. รูปสินค้า (`Thumbnail`) เป็นกล่องว่างกับ seed นี้ ไม่เกี่ยวกับ PR นี้
4. หลังคนที่ 3 join กลุ่ม `people`/3 เป็น `succeeded` ทันที หน้าซ่อนนับถอยหลังและลิงก์แชร์ — ถูกต้อง
