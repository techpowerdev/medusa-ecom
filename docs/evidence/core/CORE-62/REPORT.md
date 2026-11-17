# QA — CORE-62 ป้าย "ก่อนส่วนลด" เฉพาะเมื่อราคาสินค้าลดจริง (PR #384)

- Spec: `docs/spec/01-core-medusa.md` กฎข้อ 120 (ภาคผนวก 2026-11-17 ของกฎข้อ 118a), AC-161 และ regression AC-159 / AC-156 / AC-117
- Commit ที่ตรวจ: `11d58cfe` (branch `feat/CORE-62-subtotal-label-item-discount`, base `develop` `a0d0d5f9`)
- วันที่: 2026-11-17

## สภาพแวดล้อม
- worktree แยกใน scratchpad จาก `origin/feat/CORE-62-subtotal-label-item-discount`
- prod build ทั้งสองฝั่ง: backend `medusa build` + `medusa start` ที่ :9312, storefront `next build` + `next start` ที่ :8312
- Postgres 16 DB `medusa_qa384` สร้างใหม่ แล้ว migrate และ seed; Redis 7 db 12; Node v22.23.3
- ไม่ใช้ Stripe จริง: key ปลอมแบบ CI และชำระเงินด้วย `pp_system_default`
- หา element ด้วย `data-testid` ภายใน `getByTestId("cart-totals")` และตรวจความเป็นไทยด้วย regex อักษรไทย
- Playwright report/trace ฉบับเต็ม: CI artifact ของ job `storefront-e2e` ของ PR #384 (14 วัน)

## ผล test อัตโนมัติ
- unit (Vitest): `src/core-57-cart-totals.test.ts` และ `src/ev-7d-digital-only-totals.test.ts` ผ่าน 48/48
- e2e regression (chromium, workers=1) ผ่าน 5/5: `core-60-cart-subtotal-label.spec.ts` (AC-159, AC-161), `core-57-cart-totals.spec.ts` (AC-156), `core-26-cart-dropdown-total.spec.ts` (AC-117 ×2)
- QA spec ชั่วคราว (ไม่ commit) ผ่าน 7/7 ครอบ checklist ข้อ 1–7

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-161 unit — ส่วนลดค่าส่งอย่างเดียว ป้ายไม่มี "ก่อนส่วนลด" / flash มี / ไม่ส่ง field หรือเป็น null ไม่มี / เศษ ≤ 0.005 ไม่มี | pass | Vitest 48/48; `docs/evidence/core/CORE-62-tests.txt` (red→green ของ builder) |
| AC-161 e2e — `/th/cart` ลดค่าส่ง 100%: แถว `cart-discount` แสดง, ป้าย = ป้ายเดิม, แถวรวมได้ยอดสุทธิ | pass | `01-cart-shipping-discount-label.png` (builder, 1280), `qa-01-cart-shipping-only-375.png` |
| AC-159 (a)–(d) regression — ลด order 10% ได้ป้าย "ก่อนส่วนลด", review ป้ายเดียวกัน, 375 ไม่ล้น | pass | e2e `core-60` AC-159; `qa-02-cart-item-and-shipping-discount.png` |
| AC-156 regression — ค่าส่งเท่าราคา option และแถวรวม VAT รวมได้ยอดสุทธิ (`/cart` และ review) | pass | e2e `core-57` |
| AC-117 regression — dropdown แสดง `item_total` หลัง flash และแถว `cart-totals` รวมได้ | pass | e2e `core-26` 2/2 |

## Checklist ของ QA
1. **ลดแค่ค่าส่ง ที่ `/th/cart`: pass** — API `discount_total` 10, `original_item_total` 590 = `item_total` 590, `shipping_total` 0, `total` 590; UI ป้าย "ยอดรวมสินค้า (รวม VAT)" เท่าตอนไม่มีส่วนลด; แถว 590 − 10 + 10 = 590 ตรง `cart.total`
2. **ลดทั้ง order / ลดสินค้า / flash sale: pass** — order 10% (`item_total` 531), items 15% (501.5), flash 20% (2360 จาก 2950) ได้ป้าย "ก่อนส่วนลด" ทุกเคส แถวรวมได้ `cart.total` (±0.01)
3. **ลดสินค้า 15% พร้อมลดค่าส่ง 100%: pass** — `discount_total` 98.5 ได้ป้าย "ก่อนส่วนลด" (`qa-02-cart-item-and-shipping-discount.png`)
4. **ขั้น review และหน้า order-completed: pass** — ลดแค่ค่าส่ง: review ป้ายเดิม; `/order/<id>/confirmed` ป้ายเดิม มีแถวส่วนลด −฿10 (`qa-03-order-completed-shipping-only.png`); order ที่ลดสินค้า 10% หน้า confirmed ได้ป้าย "ก่อนส่วนลด" — payload order มี `item_total` 531 และ `original_item_total` 590
5. **375×812 และ 320: pass** — `scrollWidth` 375 / 320 ไม่ล้นจอ; ป้าย (x 24–163.75) กับจำนวนเงิน (x 318.8–351 ที่ 375, 263.8–296 ที่ 320) ไม่ทับกัน; `cart-subtotal` บรรทัดเดียว
6. **dropdown, cart digital-only, ลบโค้ด: pass** — dropdown (`nav-cart-dropdown`) ป้ายเดิมและ ฿590 ก่อน/หลังใช้โค้ดค่าส่ง; digital-only ไม่มีแถวค่าส่ง ป้ายเดิม ใส่โค้ด 10% ได้ป้าย "ก่อนส่วนลด"; ลบโค้ดแล้วป้ายกลับเดิมทั้งสองเคส
7. **edge: ดูด้านล่าง**

## Edge / negative
- ราคาเศษสตางค์ 33.33 × 3 + ลดค่าส่ง 100%: `original_item_total` 99.99 = `item_total` 99.99 ได้ป้ายเดิม
- ราคาเศษสตางค์ + ลดสินค้า fixed 0.01: `discount_total` 0.0107, `item_total` 99.9793 ผลต่าง 0.0107 > 0.005 ได้ป้าย "ก่อนส่วนลด" มีแถวส่วนลด 1 แถว — ถูกตามกฎ 120a
- price list ประเภท sale (1000 → 800, ไม่ใช่ promotion): `unit_price` 800, `compare_at_unit_price` 1000, `discount_total` 0, `original_item_total` = `item_total` = 800 → ป้ายเดิม ไม่มีแถวส่วนลด `cart-subtotal` = 800 (ไม่ขัด spec เพราะ price list ไม่ใช่ส่วนลดระดับ adjustment)
- campaign flash หมดอายุ: `discount_total` 0 แถวส่วนลดหาย ป้ายกลับเดิม
- ใช้โค้ดเดิมซ้ำ (submit ซ้ำผ่าน API): promotion 1 ตัว `discount_total` 10 ไม่ซ้อน
- กด place order สองครั้งติด (dblclick): order ของลูกค้า 1 รายการ
- cart digital-only + โค้ดลดค่าส่ง: API 200 แต่ `discount_total` 0 ไม่มีแถวส่วนลด ป้ายเดิม

## Defect
ไม่พบ

## ข้อสังเกต (ไม่ใช่ defect ของ PR นี้)
- **O-1:** promotion แบบ `fixed` 0.01 บนสินค้าราคารวม VAT ได้ `discount_total` 0.0107 (Medusa น่าจะคิดค่า fixed เป็นยอดก่อน VAT ตาม `is_tax_inclusive` ของ promotion) — ถ้า admin ตั้งส่วนลด fixed จำนวนที่ลูกค้าเห็นจะต่างจากที่ตั้ง ~7% → ให้ planner พิจารณาว่า promotion ของร้านต้องตั้ง `is_tax_inclusive: true` หรือไม่
- **O-2:** ลดค่าส่ง 100% แสดง "ค่าจัดส่ง ฿10" และ "ส่วนลด −฿10" แยกกัน (ไม่แสดงค่าส่ง ฿0) ตรงกฎ 118c/120c — บันทึกไว้เผื่อ owner ต้องการให้ส่วนลดค่าส่งแสดงในแถวค่าส่ง
- **O-3:** ทุกจุดที่ใช้ `cart-totals` (`/cart`, review, order-completed) มีทั้ง `item_total` และ `original_item_total`
