# QA CORE-42 — PR #278 (กฎข้อ 100, AC-136)

ทดสอบบน prod build (`medusa build/start` + `next build/start`) ของ commit `3d05ada` ที่ความกว้าง 375, 639, 768, 1023, 1024 และ 1280 px ใช้ Stripe test mode เท่านั้น
Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact (job `storefront-e2e`) ไม่เก็บใน git

| AC | Result | Evidence |
|----|--------|----------|
| AC-136a — `/th/cart` ที่ 375 มี t-shirt 1 รายการ (มีและไม่มีโค้ด 5%): `scrollWidth ≤ 375`, `product-price` อยู่ในจอ ไม่ถูกตัด, ปุ่มลบและช่องจำนวนกดได้; ที่ 1280 header แสดง 5 ช่องและ `product-unit-price` แสดง | pass | e2e `core-42` AC-136a + qa matrix (ราคาลด `฿560.50`, `sw=375`) |
| AC-136a — 1 และ 3 รายการ × มี/ไม่มีส่วนลด × ชื่อยาว ที่ 639/768/1023/1280 | pass | qa matrix (`sw = viewport`; < 1024 ซ่อนช่องราคา, ≥ 1024 แสดง 5 ช่อง) |
| กฎข้อ 100a — ขอบเขตเพิ่มเติม: ที่ 375 มี 3 รายการ + ส่วนลด + จำนวน 99 | **fail ที่ `3d05ada` (D-1)** | qa-01-cart-3items-discount-375.png |
| AC-136b — `/th/account/vouchers` ทั้ง 6 ความกว้าง สถานะว่าง: ระยะใต้ `voucher-code-row` = 0px, `voucher-copy-status` อยู่ใน DOM, `aria-live="polite"`, `display: block` | pass | qa-03-voucher-row-empty-375.png |
| AC-136b — คัดลอกสำเร็จ ("คัดลอกแล้ว") และล้ม (ข้อความ + `-value`) ทั้ง 6 ความกว้าง: สถานะอยู่ในแถว ใต้ปุ่ม 4px, ปุ่มขยับ 0px ทั้งแกน x และ y, ไม่ล้นจอ, ยังมี `aria-live` | pass | qa-04-voucher-copied-375.png |
| ปุ่มแชร์ลิงก์ (การ์ด Products และ Profile ของ affiliate, หน้ากลุ่ม `/th/g/<token>`) ที่ 375 และ 1280 หน้าตาเหมือนเดิม (layout แบบ stack ไม่ถูกแก้) | pass | qa-05-group-share-copied-375.png |
| dropdown ตะกร้า (1024/1280) และ checkout summary (ทั้ง 6 ความกว้าง) ไม่ถดถอย | pass | qa matrix |
| Regression: `core-42` 2/2, `core-37-copy-button` 1/1, `evoucher-storefront` 2/2, `thai-ui-cart-order` 2/2, `core-19c-delete-button-error` 5/5, `core-26-cart-dropdown-total` 2/2, unit `core-31-copy-button` 11/11 | pass | e2e 14/14 + vitest 11/11 |

## Negative / edge
- คัดลอกด้วยการคลิก 3 ครั้งติดกัน ขณะที่ `writeText` ใช้เวลา 800ms: เรียก `writeText` ครั้งเดียว และปุ่ม disabled ระหว่างทำงาน → pass
- เปลี่ยนจำนวนผ่านช่องจำนวน (3→2) และลบ line ผ่าน UI ที่ 375 บน cart 3 รายการที่มีส่วนลด: backend อัปเดตจริง, จำนวนแถวลดลง, ไม่ล้น → pass
- ชื่อสินค้ายาว (ไทย+อังกฤษ ประมาณ 90 ตัวอักษร) ไม่ทำให้ล้น
- เทียบกับ base `develop` (`023a720`), scrollWidth ที่ 375:

| เคส | base | PR (`3d05ada`) |
|-----|------|----|
| 1 รายการ จำนวน 10 มีส่วนลด | 377 | 375 |
| 1 รายการ จำนวน 99 ไม่มีส่วนลด | 385 | 375 |
| 3 รายการ มีส่วนลด | 385 | 375 |
| 3 รายการ (1,1,3) มีส่วนลด | 397 | 375 |
| 1 รายการ จำนวน 99 มีส่วนลด | 405 | **381** |

## Defect
- **D-1 (minor, กฎข้อ 100a "ไม่ล้นที่ 375" ในเคสขอบ)** — **แก้แล้ว** ใน `b43f26d` (ลด padding ช่องชื่อสินค้า < small เป็น `px-2`; e2e จำนวน 1 และ 99 + ส่วนลด red ที่ 381 → green; e2e ที่ 1280 ล็อก padding ทุก th/td เท่า develop) ผ่าน re-review
  - ขั้นตอนทำซ้ำ: ล็อกอินเป็นลูกค้า A → cart มี t-shirt จำนวน 99 → ใส่โค้ด 5% → เปิด `/th/cart` ที่ 375×812
  - Expected: `scrollWidth ≤ 375` และ `product-price` อยู่ในจอครบ
  - Actual: `scrollWidth = 381` และ `product-price` ทุกแถวมี `right = 381` (`฿58,410` ขีดฆ่า / `฿55,489.50`) หัวคอลัมน์ "รวม" และราคาถูกตัดที่ขอบ
- **D-2 (มีอยู่ก่อน PR นี้ ไม่ใช่ regression, อยู่นอก AC-136):** cart ที่มีโค้ดส่วนลดใดก็ได้ → `/th/cart` ที่ 1024px → `scrollWidth` 1029–1057 คอลัมน์สรุปคำสั่งซื้อ (360px) ล้นขวา base ได้ค่าเดียวกัน → follow-up แยก (qa-02-cart-3items-discount-1024.png)

## Observation
- O-1 (มีอยู่ก่อน PR นี้): line จำนวน 99 แต่ `product-select-button` แสดง "1" เพราะตัวเลือกมีแค่ 1–10 (qa-01)
- O-2: ที่ 375 ชื่อสินค้ายาวตัดขึ้นบรรทัดใหม่ประมาณ 13 บรรทัด อ่านได้และไม่ล้น
- O-3: cache ของ Next ไม่รู้การแก้ cart ผ่าน Store API หลังเปิดหน้าไปแล้ว qa จึงสร้าง cart ให้ครบก่อนเปิดหน้า (พฤติกรรมของ test ไม่ใช่ bug)

## สรุป
AC-136 (a)(b) ผ่านตามเงื่อนไขที่ spec เขียนไว้ และ regression ผ่านทั้งหมด พบ D-1 (ตาราง 375 ยังล้น 6px เมื่อ line มีส่วนลดและยอดหลักหมื่นมีทศนิยม) แก้แล้วใน `b43f26d` ส่วน D-2 ที่ 1024 เป็นปัญหาเดิม เปิด task แยก
