# QA REPORT: CORE-65 (PR #406)

- **Spec:** `docs/spec/01-core-medusa.md` กฎข้อ 123, AC-164 (a)–(f)
- **Commit ที่ทดสอบ:** `6d22eaae` (branch `feat/CORE-65-order-item-unit-price`)
- **สภาพแวดล้อม:** prod build (`medusa build` + `medusa start` ด้วย `NODE_ENV=production`, `next build` + `next start`), backend :9327, storefront :8327, DB `medusa_qa406` (migrate + seed ใหม่), Redis db 9, Chromium 1280×800/1280×720 และ 375×812, ไม่ใช้ Stripe จริง ชำระด้วย `pp_system_default`
- **วิธีหา element:** ใช้ `data-testid` เสมอ แยกแถวด้วยชื่อสินค้าซึ่งเป็นข้อมูล ภายใน `product-name` และตรวจความเป็นไทยด้วย regex อักษรไทย
- **Playwright report/trace ฉบับเต็ม:** CI artifact ของ PR #406 (14 วัน)

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-164 (a)–(d) e2e ของ builder `core-65-order-item-unit-price.spec.ts`: order 4 ใบ {ไม่ลด, ลด 10%} × {qty 1, qty 2} ที่ 1280 และ 375 และ `/account/orders/details` ของ qty 1 แบบลด | pass (1/1) | ผล test |
| AC-164 (a): order ที่สั่งผ่าน UI แถว qty 1 ไม่ลด (เสื้อยืด ฿590) → ไม่มี `product-unit-price`/`product-unit-original-price` มีแต่ `product-quantity` "1" และ `product-price` = `item.total` | pass | `qa-01-ui-order-mixed-1280.png` |
| AC-164 (a): แถว qty 1 ที่ลดด้วย flash sale อัตโนมัติ −20% ราคาเศษสตางค์ (฿333.33 → ฿266.66) → `product-original-price` 1 อัน = `original_total` และไม่มีราคาต่อหน่วย | pass | `qa-01-ui-order-mixed-1280.png` |
| AC-164 (b): แถว qty 3 ที่ลดด้วยโค้ด 10% (฿199.75 × 3) → ต่อหน่วย ฿179.78 ขีดฆ่า ฿199.75 และรวม ฿539.33 ขีดฆ่า ฿599.25 ตรงกับ `total/3` และ `original_total/3`; แถว qty 2 ของ price list (฿449.99) แสดงทั้งต่อหน่วยและรวม | pass | `qa-01-ui-order-mixed-1280.png` |
| AC-164 (c): ทุกแถวแสดงจำนวน และที่ 375 ได้ `scrollWidth ≤ 375` (หน้า order-completed และ account details) | pass | `qa-02-ui-order-mixed-375.png` |
| AC-164 (d): `/th/account/orders/details/<id>` ของ order เดียวกัน (4 แถว) ที่ 1280 และ 375 เป็นไปตาม (a)/(b) | pass | `qa-04-account-details-mixed-1280.png` |
| AC-164 (e): หาด้วย `data-testid` อย่างเดียว; e2e ตะกร้าเดิม `core-42-cart-voucher-layout` (2/2) และ `core-47-cart-375-long-title` (1/1) ผ่านโดยไม่แก้; promotion ลบใน `finally` ด้วย `deleteAllThenExpectOk` | pass | ผล test |
| AC-164 (f) / กฎ 123d: หน้า cart (1280) ยังมี `product-unit-price` ครบ 4/4 แถว (รวม qty 1) และ preview ในขั้น review ของ checkout ก็ยังมีครบ 4/4 → ไม่ถูกแตะ | pass | `qa-03-checkout-review-unchanged-1280.png` |

รวม:
- spec ของ qa (ไม่ commit) ผ่าน 3/3 และ `--repeat-each=2` ผ่าน 6/6
- e2e ของ builder ผ่าน 1/1
- regression e2e ผ่าน 36 ข้าม 2 (`core-42`, `core-47`, `core-23-profile-order`, `core-22`, `thai-ui-cart-order`, `core-store`, `core-20`, `core-20c`, `ev-7c`, `core-52-checkout-guards`, `group-buy-account-orders`) สองตัวที่ข้ามคือ test ของ Stripe UI ใน `group-buy-account-orders` ซึ่ง skip เพราะไม่มี Stripe key ตามที่ออกแบบไว้

## Checklist จาก builder

| รายการ | ผล |
|---|---|
| order-completed: แถว 1 ชิ้นทั้งแบบลดและไม่ลด และแถว 2 ชิ้นแบบลด ที่ 1280 และ 375 ไม่มีราคาซ้ำ (นับเงินที่มองเห็นในแถวได้ตรงสูตร) | pass |
| ไม่ล้นแนวนอนที่ 375 | pass |
| `/th/account/orders/details/<id>` ของ order 1 ชิ้นแบบลด | pass |

## Negative / edge case

| กรณี | ผล |
|---|---|
| order หลายแถว qty ผสม (1, 1, 2, 3) ในใบเดียว สั่งผ่าน UI จริง (เพิ่มสินค้าจาก PDP แล้ว checkout ครบทุกขั้นจนกดยืนยัน) | ซ่อนราคาต่อหน่วยเฉพาะแถว qty 1 — pass |
| ราคาเศษสตางค์ (`total` 266.664 และ 539.325 จาก API) | แสดงปัดเป็น ฿266.66 และ ฿539.33 ต่อหน่วย ฿179.78 — pass |
| ลด 100% แถว qty 1 (`total` 0, `original_total` 120.5) | แสดง `product-price` ฿0 และขีดฆ่า ฿120.5 ไม่มีราคาต่อหน่วย — pass |
| ดับเบิลคลิกปุ่มยืนยัน order (`submit-order-button`) | เกิด order เดียว และแถว qty 1 ไม่มีราคาต่อหน่วย — pass |
| flash sale (automatic promotion + campaign) และ price list แบบ sale | ทำงานตามกฎ 123 — pass (ดู O-2) |

## Defect
ไม่พบ

## ข้อสังเกต (ไม่ใช่ defect ของ PR นี้)
- **O-1:** preview ในขั้น checkout/review (`items-table`) ยังแสดงราคาซ้ำสำหรับแถว qty 1 โดยแถวที่ลดจะเห็นราคาขีดฆ่าและราคาลดซ้ำสองชุด (ดู `qa-03-...`) ตรงกับกฎ 123d ที่ owner ให้คง cart ไว้ ถ้าต้องการให้เหมือนหน้า order ให้ owner ตัดสินเป็น task ใหม่
- **O-2:** แถวที่ราคามาจาก price list แบบ sale (฿500 → ฿449.99) ไม่มีราคาขีดฆ่า ทั้งที่ DB เก็บ `order_line_item.compare_at_unit_price = 500` ไว้ เพราะ `LineItemPrice`/`LineItemUnitPrice` เทียบแค่ `total` กับ `original_total` พฤติกรรมนี้มีอยู่แล้วบน develop ไม่เกี่ยวกับ PR นี้
- **O-3:** โค้ดใช้เงื่อนไข `item.quantity > 1` แทน `=== 1` ตามถ้อยคำในกฎ ผลเหมือนกันเพราะ order line มี quantity ≥ 1 เสมอ
