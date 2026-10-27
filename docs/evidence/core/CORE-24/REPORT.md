# QA CORE-24 — ตัวเลือกจำนวนบน PDP (PR #134)

- Spec: `docs/spec/01-core-medusa.md` กฎข้อ 59, AC-94 (origin/develop)
- Commit ที่ทดสอบ: รอบ 1 `8c08ad9`, รอบ 2 `1974c3e` (หลังแก้ D-1 ใน `7600238` + sync develop)
- สภาพแวดล้อม: prod build (`medusa start` :9185 + `next start` :8185), DB `medusa_qa134` (seed ใหม่ทุกรอบ), Redis db 11,
  Stripe key ปลอม (test mode), prod guard OPS-7 (`ALLOW_TEST_PROVIDERS=true`), Node 22, Chromium
- Playwright report/trace ฉบับเต็ม (CI artifact 14 วัน):
  - รอบ 1: https://github.com/techpowerdev/medusa-ecom/actions/runs/40472771502
  - รอบ 2: https://github.com/techpowerdev/medusa-ecom/actions/runs/40475142091

## ผลตาม Acceptance Criteria

| AC | รอบ 1 (`8c08ad9`) | รอบ 2 (`1974c3e`) | Evidence |
|----|-------------------|-------------------|----------|
| AC-94 (JS) เลือก 3 ใน `product-quantity-select` → กดเพิ่ม → cart มี line qty 3 | pass | pass | `01-js-quantity-3.png`; e2e `core-24-pdp-quantity.spec.ts` + QA Q2 (cart API qty 3, `nav-cart-link` แสดง (3)) |
| AC-94 (no-JS, ไม่ล็อกอิน) เลือก 2 → submit → login → cart qty 2 | pass | pass | `02-nojs-login-quantity-2.png`; e2e `core-24-pdp-quantity.spec.ts` (URL login มี `add_quantity=2`, cart API qty 2) |

## Checklist ใน PR body (รอบ 2)

| รายการ | Result | Evidence |
|--------|--------|----------|
| select 1..10 ค่าเริ่มต้น 1, label ไทย (desktop 1280 + มือถือ 375) | pass | Q1 ทั้งสองขนาด label = "จำนวน" ตรง regex อักษรไทย |
| JS + ล็อกอิน: เลือก 3 → cart qty 3, ตัวนับ nav อัปเดต | pass | Q2 |
| JS + ล็อกอิน มือถือ: ปุ่มแถบล่างใช้จำนวนที่เลือก | pass | `04-qa-mobile-bar-quantity-5.png`; Q3 เลือก 5 → `mobile-cart-button` → cart qty 5 |
| no-JS ไม่ล็อกอิน: เลือก 2 → login → `/th/cart` qty 2 | pass | AC-94 (no-JS) |
| no-JS ล็อกอินแล้ว: เลือก 4 → `/th/cart` qty 4 | pass | Q8 |
| สินค้าหมด / flash sold out: ปุ่มและ select disable | pass | Q5 (stock 0), Q6 (flash cap 1 ขายครบ) + regression `flash-sale-fs13.spec.ts` 3/3 |

Regression รอบ 2: `core-24-pdp-quantity.spec.ts` 3/3 (รวม test D-1), `core-14b-add-variant.spec.ts` 3/3, `flash-sale-fs13.spec.ts` 3/3, QA spec 15/15

## Negative / edge case (นอก spec)

| กรณี | ผลลัพธ์ |
|------|---------|
| JS desktop: stock 2 เลือก 5 กดเพิ่ม | รอบ 1 **fail (D-1)** ปุ่มค้าง; รอบ 2 pass — `add-to-cart-error` ข้อความไทย ปุ่ม/select ใช้ต่อได้ cart ไม่เปลี่ยน แล้วเลือก 2 เพิ่มได้ qty 2 ไม่มี pageerror (`03-js-over-stock-error.png`) |
| JS มือถือ 375 แถบล่าง: stock 2 เลือก 5 | รอบ 2 pass — `mobile-add-to-cart-error` ข้อความไทยเดียวกัน ใช้ต่อได้ cart ไม่เปลี่ยน (`05-qa-mobile-over-stock-error.png`) |
| guest (JS) กดเพิ่ม qty 3 / แถบล่างมือถือ qty 2 | pass — redirect ไป `/th/account?add_variant=…&add_quantity=3` (และ `=2`) เห็น `login-page` ไม่มี `add-to-cart-error` |
| เปลี่ยน variant หลังเลือกจำนวน 4 | จำนวนคงที่ (4) เพิ่ม variant ใหม่ได้ qty 4 ถูกต้อง |
| no-JS: stock 2 เลือก 5 | 400 ข้อความไทย cart ไม่เปลี่ยน (หน้า text ล้วนไม่มีลิงก์กลับ) |
| no-JS: แก้ค่า quantity เป็น 999 / -3 / abc | clamp เป็น 100 / 1 / 1 |
| no-JS: เพิ่มซ้ำจนเกิน stock ของ line เดิม | route สร้าง cart ใหม่ qty 1 แบบเงียบ (พฤติกรรมเดิมของ CORE-14b) |
| JS: ดับเบิลคลิกปุ่มเพิ่ม (qty 3) | ได้ line qty 3 ครั้งเดียว |
| แถบล่างมือถือ | ไม่แสดงจำนวนที่เลือก — ข้อสังเกต UX |

## Defect

| ID | รายละเอียด | รอบ 1 | รอบ 2 |
|----|------------|-------|-------|
| D-1 | JS: stock 2 → ล็อกอิน → PDP เลือก 5 → กดเพิ่ม. รอบ 1: `handleAddToCart` ไม่ catch error → ปุ่มค้าง select disable ถาวร ไม่มีข้อความ | fail | แก้แล้ว (`7600238`) — pass ทั้ง desktop และแถบล่างมือถือ |
