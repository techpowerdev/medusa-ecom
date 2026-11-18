# QA REPORT: CORE-66 (PR #412)

- **Spec:** `docs/spec/01-core-medusa.md` กฎข้อ 124, AC-165 (a)–(f) (owner ตัดสินข้อ ข 2026-11-18: แก้เฉพาะ preview ส่วนหน้า `/cart` คงเดิม)
- **Commit ที่ทดสอบ:** `141c75ba` (branch `feat/CORE-66-checkout-preview-unit-price`)
- **สภาพแวดล้อม:** prod build ทั้งสองฝั่ง
  - backend: `NODE_ENV=production medusa build` แล้ว `medusa start` ที่ :9337 ใช้ `ALLOW_TEST_PROVIDERS=true` และ key ปลอมแบบ CI
  - storefront: `next build` แล้ว `next start` ที่ :8337
  - DB `medusa_qa412` (migrate + seed ใหม่), Redis db 6
  - Chromium ที่ 1280×800 และ 375×812
  - ไม่ใช้ Stripe จริง ชำระด้วย `pp_system_default`
- **วิธีหา element:** ใช้ `data-testid` เสมอ แยกแถวด้วยชื่อสินค้าซึ่งเป็นข้อมูลภายใน `product-title`/`product-name` และตรวจความเป็นไทยของ `checkout-summary-heading` ด้วย regex อักษรไทย
- **Playwright report/trace ฉบับเต็ม:** CI artifact ของ PR #412 (14 วัน)

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-165 (a)–(d) e2e ของ builder `core-66-checkout-preview-unit-price.spec.ts`: cart 4 ใบ {ไม่ลด, ลด 10%} × {qty 1, qty 2} ที่ 1280 และ 375 รวม `/cart` | pass (1/1, `--repeat-each=2` ได้ 2/2) | ผล test |
| AC-165 (a): preview แถว qty 1 ไม่ลด (A ฿590) ไม่มี `product-unit-price`/`product-unit-original-price` มี `product-quantity` "1" และ `product-price` = `item.total` | pass | `qa-01-preview-mixed-1280.png` |
| AC-165 (a): preview แถว qty 1 ลดด้วย flash sale อัตโนมัติ −20% ราคาเศษสตางค์ (B ฿333.33 → `total` 266.664 แสดง ฿266.66) มี `product-original-price` 1 อัน = `original_total` และไม่มีราคาต่อหน่วย | pass | `qa-01-preview-mixed-1280.png` |
| AC-165 (b): preview แถว qty 3 ลด 10% (C ฿199.75 × 3): ต่อหน่วย ฿179.78 ขีดฆ่า ฿199.75 และรวม ฿539.33 ขีดฆ่า ฿599.25 = `total/3` และ `original_total/3`; แถว qty 2 จาก price list (D ฿449.99) มีทั้งต่อหน่วยและรวม | pass | `qa-01-preview-mixed-1280.png` |
| AC-165 (c): ทุกแถวมี `product-quantity` ตรงกับจำนวนของ line; ที่ 375 ได้ `scrollWidth ≤ 375` | pass | `qa-02-preview-mixed-375.png` |
| AC-165 (d) / กฎ 124d: `/th/cart` (1280) ยังมี `product-unit-price` ครบ 4/4 แถว (รวม qty 1 ทั้งสองแถว) และค่าตรงกับ `total/qty` | pass | `qa-03-cart-unchanged-1280.png` |
| AC-165 (e): หาด้วย `data-testid` เท่านั้น; ผ่านโดยไม่แก้: `core-42-cart-voucher-layout`, `core-47-cart-375-long-title`, `core-65-order-item-unit-price` (หลังแก้ตามกฎ 124e: ใช้ `toBeCloseTo` และยกเลิก order ใน `finally`); promotion ลบใน `finally` ด้วย `deleteAllThenExpectOk` | pass | ผล test |
| AC-165 (f): REPORT นี้มี screenshot 3 รูป ครอบคลุม preview qty 1 ลดและไม่ลด และ qty 2/3 ลด ที่ 1280 และ 375 | pass | `qa-01`, `qa-02`, `qa-03` |

รวมผลการรัน:
- spec ของ qa (ไม่ commit) ผ่าน 2/2
- e2e ของ builder: `core-66` ผ่าน 1/1 (`--repeat-each=2` ผ่าน 2/2) และ `core-65` ผ่าน 1/1
- regression ผ่าน 57 ข้าม 1 ชุดที่รัน:
  - `core-42`, `core-47`, `core-44-cart-summary-qty`, `core-26-cart-dropdown-total`, `core-19a-nav-cart-search`
  - `core-57-cart-totals`, `core-60-cart-subtotal-label`, `core-4e`, `core-4g`, `core-4j`
  - `thai-ui-checkout`, `thai-ui-cart-order`, `core-52-checkout-guards`, `core-41`, `core-19b`
  - `ev-7c`, `ev-7d`, `core-14b-add-variant`, `flash-sale-storefront`
- ตัวที่ข้ามคือ test PromptPay ใน `core-19b` ซึ่ง skip เพราะไม่มี Stripe key ตามที่ออกแบบไว้

## Checklist จาก builder

| รายการ | ผล |
|---|---|
| `/th/checkout` ใน `items-table`: qty 1 ลด (1280/375) ไม่มีราคาต่อหน่วย มีราคาเดิมขีดฆ่าและราคารวม เห็น "1x" | pass |
| qty 1 ไม่ลด: มีแค่ "1x" และราคารวม | pass |
| qty 2 ลด: มีทั้งต่อหน่วยและรวม | pass |
| ที่ 375 ไม่ล้นแนวนอน | pass |
| `/th/cart` แถว qty 1 ยังมีราคาต่อหน่วย | pass |

## Negative / edge case

| กรณี | ผล |
|---|---|
| เพิ่มสินค้าผ่าน UI จริง (ปุ่ม `add-product-button` บน PDP และ `product-quantity-select` = 3) ให้ได้ cart qty ผสม (1, 1, 2, 3) ในใบเดียว | ซ่อนราคาต่อหน่วยเฉพาะแถว qty 1 ทั้งที่ 1280 และ 375 — pass |
| เปลี่ยน qty ใน `/th/cart` 1→2→1 (`product-select-button`) แล้วกลับไป checkout ทุกครั้ง (สินค้า flash) | qty 2 มีราคาต่อหน่วย ฿266.66 (ขีดฆ่า ฿333.33) และรวม ฿533.33; กลับเป็น qty 1 ราคาต่อหน่วยหายไปและเหลือรวม ฿266.66 — pass |
| dropdown ของตะกร้าใน nav (`nav-cart-dropdown`) | มี 4 `cart-item` แต่ละแถวมี `product-price` 1 อัน = `total` และ `cart-item-quantity` ถูกต้อง; ไม่มี `product-unit-price` เหมือนเดิม — pass |
| ดับเบิลคลิก `submit-order-button` | เกิด order เดียว แล้วไป `/order/<id>/confirmed` — pass |
| หน้า order-completed ของ order เดียวกัน (4 แถว) | เป็นไปตาม CORE-65 (กฎ 123): แถว qty 1 ไม่มีราคาต่อหน่วย, แถว qty 2/3 มี — pass |
| แคมเปญ flash หมดอายุระหว่างที่ cart เปิดอยู่ | ก่อนแตะ cart: Medusa ยังเก็บ adjustment เดิมไว้และ preview แสดงตามข้อมูลนั้น (฿266.66 ขีดฆ่า ฿333.33); หลังเปลี่ยน qty (cart refresh): ส่วนลดหาย preview แถว qty 1 เหลือ ฿333.33 ไม่มีราคาขีดฆ่าและไม่มีราคาต่อหน่วย — pass |

## Defect
ไม่พบ

## ข้อสังเกต (ไม่ใช่ defect ของ PR นี้)
- **O-1:** แถว D (price list แบบ sale ฿500 → ฿449.99) ไม่มีราคาขีดฆ่าทั้งใน `/cart`, preview และ order เป็นพฤติกรรมเดิมบน develop และอยู่ในขอบเขตของ CORE-67 (กฎ 125)
- **O-2:** ระหว่างที่ `updateLineItem` ของ Medusa ทำงาน ถ้า GET Store API ในช่วงนั้นจะเห็น `quantity` ใหม่แต่ adjustment ของ promotion ยังเป็นค่าเก่าอยู่ครู่หนึ่ง (เช่น qty 2 แต่ส่วนลด 66.666 ยังไม่ใช่ 133.332) แล้วจึงนิ่ง UI แสดงค่าสุดท้ายถูกต้อง เป็นลักษณะของ core-flows ไม่ใช่ของ PR นี้ e2e ใหม่ที่อ่านยอดหลังเปลี่ยน qty ควรอ่านซ้ำจนค่านิ่ง (spec ของ qa ใช้ `toPass`)
- **O-3:** โค้ด promotion กับ automatic promotion ของ flash sale ใช้ร่วมกันไม่ได้ (PROMO-1 `promotion-exclusivity`) qa จึงใช้ automatic promotion แยกสำหรับแถวที่ลด 10% เป็นไปตาม spec 03 กฎข้อ 6
- **O-4:** ใน preview แถว qty 1 ข้อความ "1x" อยู่บรรทัดบนของราคารวมเพียงลำพัง (ดู `qa-01`/`qa-02`) อ่านได้ชัด ไม่ล้น บันทึกไว้เป็นข้อสังเกตด้าน UX เท่านั้น
- **O-5:** โค้ดใช้เงื่อนไข `item.quantity > 1` แทน `=== 1` ตามถ้อยคำในกฎ ผลเหมือนกันเพราะ line มี quantity ≥ 1 เสมอ
