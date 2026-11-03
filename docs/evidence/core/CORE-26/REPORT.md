# Evidence: CORE-26 — ยอดรวม cart dropdown = `item_total` และ dropdown ปิดเองใน 5 วินาที (QA PR #209)

- Spec: `docs/spec/01-core-medusa.md` — AC-117, กฎข้อ 81 (owner ตัดสิน Q-C1 = (1ก) + (2ก) 2026-11-03)
- PR: #209 — branch `fix/CORE-26-cart-dropdown-total` @7300758
- สภาพแวดล้อม: prod build ทั้ง backend และ storefront, node 24.12.0, Stripe test mode เท่านั้น; ลูกค้า login ทุกเคส (ไม่มี guest); หา element ด้วย `data-testid`
- ผล: e2e ของ PR (core-26 ×2, core-25, core-19a) 12/12; unit `core-26-cart-dropdown` + `core-25-pdp-option-reset` 8/8; spec ของ qa 5/5

## ผลตาม AC

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-117 dropdown: flash −20% ฿2,950 ×2 → `cart-subtotal` data-value 4720 = `item_total` 4720 = ผลรวม line, ป้าย "ยอดรวมสินค้า (รวม VAT)" ไม่มี "ไม่รวมภาษี" | pass | `ac117-1-dropdown-flash-4720.png` |
| AC-117 ไม่มี flash (590) / หลายรายการ (5310) / มี code promotion (6383) → ตรง `item_total` ทุกกรณี | pass | `ac117-2-dropdown-multi-promo.png` |
| AC-117 ปิดเอง 1280px: mouse ค้างที่ปุ่มปิดใน 5.3 วินาที, mouse ใต้ panel ปิดใน 4.8–5.4 วินาที, กดซ้ำด้วย `click()` ได้, ชี้ `nav-cart-link` แล้วค้างเกิน 6 วินาที | pass | `ac117-3-auto-open-under-panel.png` |
| AC-117 `/th/cart` แถว `cart-totals` รวมแล้วเท่ายอดสุทธิ ±0.01 (4730 / 600 / 5320 / 6393 / 7090) | pass | `ac117-4-cart-totals.png` |
| 375px: dropdown ซ่อน (`hidden small:block`), PDP overflow 0px, ข้อความไทย, ยอดใน `/th/cart` ตรง | pass (ไม่ถดถอย) | `ac117-5-mobile-375-cart.png` |
| AC-117 static (`1.07`/`.reduce` บนราคา) + unit PDP rerender + grep `dispatchEvent("click")` ที่ `add-product-button` | pass | vitest 8/8, grep ไม่พบ |
| AC-117 (e) `thai-ui-pages.spec.ts` ไม่มี `Shirts` | ยังไม่ทำ | spec อนุญาตให้ข้ามเพราะรอ #202 — ทำใน PR ถัดไปที่แตะไฟล์นั้น |

## Edge case (นอก spec)
- เพิ่มเกิน stock → 400 `insufficient_inventory`
- campaign หมดอายุแล้วกดเพิ่ม → ส่วนลดหาย dropdown แสดง 8850 = `item_total`
- dblclick ปุ่มเพิ่ม → จำนวน +1 (กันกดซ้ำ)
- กดเพิ่มสองครั้งห่าง 3 วินาที → timer นับใหม่จากครั้งที่สอง (ปิดหลัง 5.3 วินาที)
- ใส่ code คู่กับ flash → flash ถูกถอดพร้อมแบนเนอร์แจ้ง (พฤติกรรมที่ตั้งใจ)

Defect: ไม่พบใน scope ของ PR

## ข้อสังเกต (ไม่ใช่ defect ของ PR)
1. panel ที่เปิดเองหลังกดเพิ่มจะปิดราว 5.3 วินาทีแม้ mouse ค้างบน `go-to-cart-button` (กดทันภายใน ~5 วินาที) — เป็นไปตามกฎ 81c (2ก); ถ้าชี้ `nav-cart-link` ก่อน การปิดเองถูกยกเลิก
2. `/th/cart` ที่ 375px ล้นแนวนอน 53px (2px กับ t-shirt) จากตาราง `cart-items` — ปัญหาเดิม ควรเปิด task แยก
3. code แบบ fixed ฿100 ทำให้ `item_total` ลด 107 เพราะ promotion ใน test ไม่ได้ตั้ง `is_tax_inclusive` — เรื่องการตั้งค่า promotion
4. panel ของ Headless UI fade-in 150–300ms — screenshot ที่ถ่ายทันทีหลัง `toBeVisible()` อาจไม่เห็น panel (qa รอ opacity 1 ก่อนถ่าย)
