# รายงาน QA — CORE-57 (PR #352)

- Spec: `docs/spec/01-core-medusa.md` กฎข้อ 115, AC-156 (Q-C7 = ก) + AC-117 (dropdown ตะกร้า)
- Commit ที่ตรวจ: `e1e5f408` (`feat/CORE-57-cart-totals-vat-inclusive`)
- สภาพแวดล้อม: prod build ทั้งสองฝั่ง (backend `medusa start` จาก `.medusa/server` :9252, storefront `next start` :8252),
  DB `medusa_qa352` (migrate + seed), Redis db 9, payment `pp_system_default` (ไม่ใช้ Stripe จริง)
- QA spec: `apps/storefront/e2e/core-57-qa/qa-cart-totals.spec.ts` (6 test ผ่าน; ไม่ commit) + e2e ของ PR 8 test ผ่าน + Vitest 39 test ผ่าน
- Playwright report/trace ฉบับเต็ม: CI artifact ของ run https://github.com/techpowerdev/medusa-ecom/actions/runs/43369063170

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-156 `/th/cart`: ค่าจัดส่ง ฿10 = `amount` ของ option (`is_tax_inclusive: true`) = `original_shipping_total`, ยอดรวม = ยอดสินค้า + ฿10 | pass | `01-cart-vat-inclusive-totals.png`; `core-57-cart-totals.spec.ts` ✓ |
| AC-156 ขั้นเลือกวิธีจัดส่ง = แถวค่าจัดส่ง, ขั้น review แสดงเหมือนกัน | pass | `02-review-vat-inclusive-totals.png`; `core-57-cart-totals.spec.ts` ✓, QA-1 (review) ✓ |
| AC-156 มีโปรโมชัน/flash ไม่หักซ้ำ: subtotal − discount + shipping = total | pass | `03-qa-multi-item-promo-cart.png` (QA-1: 9,510.31 − 1,236.34 + 10 = 8,283.97); `core-26` AC-117 step `/th/cart` ✓; QA-2 ส่วนลดค่าส่ง 100% (590 − 10 + 10 = 590) ✓ |
| AC-156 / AC-42 cart digital-only ไม่มีแถว/คำว่า "ค่าจัดส่ง" ที่ `/th/cart` และ review; cart ผสมยังมีแถว | pass | `ev-7d-digital-only-totals.spec.ts` 2 test ✓ (Vitest digital-only 0/10 ✓) |
| กฎข้อ 115 หน้า order confirmed ใช้ฐานเดียวกัน ป้ายไทย ไม่มี "ไม่รวมภาษี"/"ก่อน VAT" ตรงกับ order API | pass | `04-qa-order-confirmed-totals.png` (QA-4); `thai-ui-cart-order.spec.ts` AC-48/AC-78 ✓ |
| AC-117 / กฎข้อ 115d dropdown ตะกร้าไม่เปลี่ยน (`cart-subtotal` = `item_total` หลังส่วนลด) | pass | QA-4 step dropdown ✓; `core-26` 2 test ✓; diff ไม่แตะ `cart-dropdown/` |
| AC-48/AC-75 `expectThai` ของ cart/checkout ยังผ่าน | pass | `thai-ui-cart-order.spec.ts`, `thai-ui-checkout.spec.ts` ✓ |

## Negative / edge case

| เคส | Result | หลักฐาน |
|-----|--------|---------|
| หลายสินค้าหลายชิ้น ราคาไม่ลงตัว (1,999×3, 333.33×7, 590×2) + โค้ด 13% → แถวรวมกันตรง `total` ทุกสตางค์ทั้ง `data-value` และตัวเลขที่แสดง, ตรงกับ `original_item_total`/`discount_total`/`original_shipping_total`/`tax_total`/`total` ของ API | pass | QA-1, `03-qa-multi-item-promo-cart.png` |
| กดปุ่มใช้โค้ดสองครั้ง (double click) → ส่วนลดเดียว `promotions.length = 1` | pass | QA-1 |
| โค้ดของแคมเปญที่หมดอายุ → แสดง `promotion-error`, ไม่มีแถวส่วนลด ยอดไม่เปลี่ยน | pass | QA-3 |
| มือถือ 375px `/th/cart` และ review: `cart-totals` ทุกแถวอยู่ในจอ, `scrollWidth` ≤ 375 | pass | QA-5, `05-qa-mobile-375-cart-totals.png` |
| `ALLOWED = ["VAT"]` ยกเว้นเฉพาะคำ "VAT" ทั้งคำ: "VATs", "vat", "NOVAT", "Tax", "Subtotal", "incl", "Shipping" ยังถูกจับ; ข้อความใน `cart-totals` ไม่มีคำละตินอื่น | pass | QA-6 + `expectRows` ทุกหน้า |

## ข้อสังเกต (ไม่ใช่ defect ของ PR นี้)
- `data-value` ของ `cart-discount`/`cart-total`/`cart-taxes` มีทศนิยมเกิน 2 ตำแหน่ง (เช่น 1236.3403, 8283.9697) — เป็นค่าดิบของ Medusa ตัวเลขที่แสดงปัดเป็นสตางค์และรวมกันตรง
- ป้าย "ยอดรวมสินค้า (รวม VAT)" ใช้ทั้งใน dropdown (= `item_total` หลังส่วนลด) และ `cart-totals` (= `original_item_total` ก่อนส่วนลด) เมื่อมีส่วนลดสองที่แสดงตัวเลขต่างกันภายใต้ป้ายเดียวกัน — ตรงตาม spec (กฎข้อ 81a/115d) เสนอ planner พิจารณาถ้อยคำ
