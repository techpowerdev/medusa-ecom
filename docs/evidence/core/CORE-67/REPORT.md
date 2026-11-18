# QA REPORT: CORE-67 (PR #415)

- **Spec:** `docs/spec/01-core-medusa.md` กฎข้อ 125, AC-166 (a)–(d) (หัวข้อ "Follow-up รอบ 37"; ปัญหาเดิม qa #406 O-2, #412 O-1)
- **Commit ที่ทดสอบ:** `a1f18ea6` (branch `feat/CORE-67-sale-compare-at`)
- **สภาพแวดล้อม:** prod build ทั้งสองฝั่ง
  - backend: `NODE_ENV=production medusa build` แล้ว `medusa start` ที่ :9340 ใช้ `ALLOW_TEST_PROVIDERS=true` และ key ปลอมแบบ CI
  - storefront: `next build` แล้ว `next start` ที่ :8340
  - DB `medusa_qa415` (migrate + seed ใหม่), Redis db 10
  - Chromium ที่ 1280×800 และ 375×812
  - ไม่ใช้ Stripe จริง ชำระด้วย `pp_system_default`
- **วิธีหา element:**
  - storefront ใช้ `data-testid` เสมอ แยกแถวด้วยชื่อสินค้าซึ่งเป็นข้อมูลภายใน `product-row`/`cart-item`
  - ตรวจความเป็นไทยด้วย regex อักษรไทย
  - admin (หน้า Price Lists ของ Medusa) หาด้วย role/label ตาม ADR-018
- **Playwright report/trace ฉบับเต็ม:** CI artifact ของ PR #415 (14 วัน)

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-166 (a) unit Vitest `line-item-compare-at.test.ts` | pass (7/7) | ผล test |
| AC-166 (b) e2e ของ builder `core-67-sale-price-strikethrough.spec.ts` (S1/S2/SP ที่ 1280) | pass (1/1, `--repeat-each=2` ได้ 2/2) | ผล test |
| AC-166 (b1) `/cart` sale qty 2: ต่อหน่วย ขีดฆ่า ฿500 → ฿450, รวม ขีดฆ่า ฿1,000 → ฿900; Store API ให้ `compare_at_unit_price` = 500 | pass | ผล test |
| AC-166 (b2) preview: qty 1 ไม่มีราคาต่อหน่วย มีขีดฆ่า ฿500 อันเดียว; qty 2 มีทั้งต่อหน่วยและรวม (1280 และ 375) | pass | `qa-03-preview-sale-promo-qty2-375.png` |
| AC-166 (b3) sale + promotion 10% qty 2: `/cart`, preview และ order-completed มี `product-original-price` **1** ตัว = ฿1,000 (ไม่ใช่ ฿900) และ `product-price` = ฿810; ต่อหน่วย ฿500 → ฿405 | pass | `qa-02-cart-sale-promo-qty2-1280.png`, `qa-03-preview-sale-promo-qty2-375.png`, `qa-04-order-sale-promo-qty2-1280.png` |
| AC-166 (b4) order-completed sale qty 1 (375): ขีดฆ่า ฿500 ตัวเดียว → ฿450 ไม่มีราคาต่อหน่วย (กฎ 123) | pass | `qa-05-order-sale-qty1-375.png` |
| AC-166 (c) e2e เดิมผ่านโดยไม่แก้ assertion: `core-64`, `core-65`, `core-66`, `core-26`, `thai-ui-cart-order` และอื่น ๆ (รายการเต็มในหัวข้อ "รวมผลการรัน") | pass (22/22) | ผล test |
| AC-166 (d) sale ล้วน และ sale + promotion ใน `/cart`, preview, order-completed ที่ 1280 และ 375 + cart dropdown ของ sale | pass | `qa-01`–`qa-05` |

รวมผลการรัน (workers=1):
- spec ของ qa (ไม่ commit) ผ่าน 6/6
- e2e ของ builder: `core-67` ผ่าน 2/2
- regression ผ่าน 22/22 ชุดที่รัน:
  - `core-64-promotion-fixed-vat`, `core-65`, `core-66`, `core-26-cart-dropdown-total`, `thai-ui-cart-order`
  - `core-42`, `core-47`, `core-57`, `core-60`, `core-44`, `flash-sale-storefront`, `core-23-profile-order`

## Checklist จาก builder

| รายการ | ผล |
|---|---|
| sale อย่างเดียว ใน `/cart` (1280: qty 2; 375: qty 1/2), preview (375: qty 1/2), order-completed (375: qty 1/2) — ราคาขีดฆ่า ฿500 × qty | pass |
| sale + promotion 10% ใน `/cart`, preview, order-completed ที่ 1280 และ 375 — ขีดฆ่า ฿1,000 ไม่ใช่ ฿900 และมีตัวเดียวต่อแถว | pass |
| cart dropdown ของ sale qty 2 (`nav-cart-dropdown` → `cart-item`): ขีดฆ่า ฿1,000 ตัวเดียว ราคา ฿900, `cart-item-quantity` 2 | pass (`qa-01`) |
| แถวที่ไม่มี sale เหมือนเดิม: regression ทั้งชุดผ่านโดยไม่แก้ และแถว flash ใน cart ผสม (กรณีด้านล่าง) ใช้ `original_total` | pass |
| ที่ 375 ไม่ล้นแนวนอน (`scrollWidth ≤ 375`) ใน `/cart`, preview, order-completed | pass |

## Negative / edge case

| กรณี | ผล |
|---|---|
| สร้าง price list ผ่าน **admin UI ของ Medusa** (Price Lists → Create → Type Sale → เลือกสินค้า → DataGrid "Price THB" = 450 → Save) แล้วใช้กับ cart qty 1/2 | API: `type` = sale, `status` = active, ราคา THB 450; storefront ขีดฆ่า ฿500/฿1,000 ทุกหน้า — pass |
| ดับเบิลคลิก Save ในฟอร์ม Create Price List ของ admin | เกิด price list 1 รายการ — pass |
| account order details (`order-details-container`) ที่ 1280: sale qty 1/2 และ sale + promotion qty 2 | ขีดฆ่า = ฿500 × qty ตัวเดียว; qty 1 ไม่มีราคาต่อหน่วย, qty 2 มี — pass |
| price list ราคาเท่าราคาเดิม (฿500) | Medusa ไม่ตั้ง `compare_at_unit_price` (null); ไม่มีราคาขีดฆ่าใน `/cart`, preview และ dropdown — pass |
| price list ต่างจากราคาเดิมเป็นเศษสตางค์ (฿499.996; Medusa ตั้ง `compare_at_unit_price` = 500, ต่าง 0.004 ≤ 0.005) | ไม่มีราคาขีดฆ่าใน `/cart`, preview และ dropdown — pass |
| price list หมดอายุ (`ends_at` ย้อนหลัง) ระหว่างที่ cart เปิดอยู่ | reload โดยไม่แตะ cart: line ยังเป็น ฿450/compare 500 ตามที่ Medusa เก็บไว้ จึงยังขีดฆ่า ฿500 ตรงกับยอดที่จะจ่าย; เปลี่ยน qty เป็น 2 ผ่าน `product-select-button`: Medusa คำนวณใหม่ได้ ฿500/ชิ้น, `compare_at` null และไม่มีราคาขีดฆ่าใน `/cart` และ preview — pass |
| price list ถูกลบระหว่างที่ cart เปิดอยู่ | พฤติกรรมเดียวกับกรณีหมดอายุ — pass |
| flash sale (แคมเปญ + automatic promotion −20% + config ของ flash sale) ใน cart ผสม (flash ฿1,000 × 2 + sale qty 1) | แถว flash: `compare_at` null, ขีดฆ่า ฿2,000 (ต่อหน่วย ฿1,000) → ฿1,600 (฿800) เหมือนเดิม; แถว sale: ขีดฆ่า ฿500 → ฿450; dropdown ถูกทั้งสองแถว — pass |

## ข้อสังเกต (ไม่ใช่ defect — ตรงตามกฎข้อ 125f)
- O-1: `cart-totals` ยังเป็น `original_item_total` ของ Medusa ตามกฎ 125f ทำให้ตัวเลขในแถวสินค้ากับสรุปยอดไม่ตรงกัน
  - sale + promotion: แถวขีดฆ่า ฿1,000 แต่ "ยอดรวมสินค้าก่อนส่วนลด" = ฿900 และ "ส่วนลด" = −฿90 (ส่วนต่างจาก sale ฿100 ไม่อยู่ในสรุปยอด)
  - sale ล้วน: แถวขีดฆ่า ฿500 แต่ "ยอดรวมสินค้า" = ฿450
  - ถ้า owner อยากให้สองส่วนนี้สอดคล้องกัน ควรเป็น follow-up ของ planner
- O-2: ที่ < `small` หน้า `/cart` ซ่อนคอลัมน์ราคาต่อหน่วยทุก qty (พฤติกรรมเดิมก่อน PR นี้) จึงเห็นแค่ราคารวมกับราคาขีดฆ่ารวม

## Defect
ไม่พบ
