# QA GB-7c — การ์ดแคมเปญ group buy บนหน้าแรก + ปุ่มสร้างทีม (PR #239)

Spec: `docs/spec/04-group-buying.md` (AC-48, Q15, Q18, กฎข้อ 29a) — วันที่ 2026-11-04, commit `364ca91`
สภาพแวดล้อม: prod build — backend จาก `.medusa/server`, storefront `next build` + `next start`, DB แยกที่ seed ใหม่ (ตอนเริ่มไม่มีแคมเปญ active), Redis db แยก, Node 22.23.3, Stripe test key
ผล: spec ของ qa 7/7; e2e ของ builder 5 test + regression `store-content`, `thai-ui-shell`, `flash-sale-storefront` บน stack เดียวกัน 13/13
Playwright report/trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR #239 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-48 DB ว่างจริง ไม่มีแคมเปญ flash และ group buy → ไม่มีส่วน `home-campaigns` | pass | QA-1 |
| AC-48 การ์ด group buy (both/pool/team) 4 ใบแสดงร่วมกับการ์ด flash, การ์ดละสินค้าเดียว, ราคา ฿590 ขีดฆ่า → ฿501.50 (ลด 15%), ข้อความส่วนลด, นับถอยหลัง, `group-pool-link` ไป `/th/g/<pool token>`, แคมเปญแบบ pool ไม่มีปุ่มสร้างทีม; ข้อมูลใหม่ขึ้นหน้าแรกใน 64.5 วินาที (≤ 90) | pass | QA-2 |
| AC-48 ไม่ login กดสร้างทีม → ไป `/th/account`, ไม่มีทีมใหม่ใน DB, browser ไม่ยิง `/store/group-buy/groups` | pass | QA-3 (ดูข้อสังเกต 1) |
| AC-48/Q18 login แล้ว `dblclick` ตามด้วยคลิกรัวอีก 5 ครั้ง → ได้ 1 ทีม (นับจาก DB และ admin API), ไปที่ `/th/g/<token ใหม่>`, `group-share-link` ลงท้ายด้วย `/g/<token>`, membership = 0 | pass | QA-4 |
| AC-48 POST ตอบ 400 เพราะต้นแบบถูกแก้เป็น 2 สินค้า → แสดง `group-create-team-error` ภาษาไทย และไม่เปลี่ยนหน้า | pass | e2e ของ builder, 03-create-team-error.png |
| (edge) แคมเปญถูกตั้ง `ended` ระหว่างเปิดหน้า → API 400 `not_allowed` → การ์ดแสดง "กลุ่มหรือแคมเปญนี้ปิดรับแล้ว" ไม่ใช่ข้อความทั่วไป, อยู่หน้าเดิม, ไม่มีทีมใหม่ | pass | QA-5, 05-ended-campaign-error.png |
| 375px: การ์ด 5 ใบเรียงคอลัมน์เดียว (กว้าง 327px) และ `scrollWidth` ≤ 375 | pass | QA-6 |
| HTML ของหน้าแรกไม่มี promotion code (flash 1 ตัว + ต้นแบบ 4 ตัว), template id, อีเมลลูกค้า หรือ key `code`/`customer_id` | pass | QA-7 |
| ข้อความไทยตรวจด้วย regex (หา element ด้วย `data-testid`); ราคา `flash-price` บน rail หน้าแรกยังแสดง | pass | QA-2 |

## Defect
ไม่พบ

## ข้อสังเกต (ไม่บล็อก)
1. ตอนไม่ login browser ยังเรียก server action ของ Next (POST `/th` ที่มี header `next-action`) เพื่ออ่าน cookie httpOnly ฝั่ง server แต่ไม่มี POST ไป backend — ตรงกับ AC-48 "ไม่มี `POST`"
2. รูปสินค้าจาก seed เป็นกรอบว่าง เหมือน rail สินค้าเดิม ไม่ใช่ปัญหาของ PR นี้
3. การ์ดของแคมเปญที่ ended แล้วยังค้างบนหน้าแรกได้จนกว่าจะ revalidate (~90 วินาที) ตามที่ ADR-017 / กฎข้อ 29a ยอมรับ ถ้ากดในช่วงนั้นได้ข้อความปิดรับแล้ว
4. QA ตรวจที่ `364ca91` — commit หลังจากนั้น (แก้ตาม review: test ของ guard, ลำดับ pool, comment) ไม่เปลี่ยน UI
