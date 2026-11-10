# QA CORE-44 — PR #287 (กฎข้อ 102, AC-138)

ทดสอบบน prod build (`medusa build/start` + `next build/start`) ของ commit `e5321d4` ที่ความกว้าง 375, 1023, 1024, 1279, 1280 และ 1440 px ใช้ Stripe test mode เท่านั้น สินค้า 3 ขนาด ราคา ฿12,345.67 (`manage_inventory: false`) และ promotion 5% สร้างผ่าน admin API แล้วลบเมื่อเสร็จ
Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact (job `storefront-e2e`) ไม่เก็บใน git

| AC | Result | Evidence |
|----|--------|----------|
| AC-138 unit: `cartQuantityOptions(3\|10\|11\|99)` ไม่มีค่าซ้ำ เรียงน้อยไปมาก | pass | vitest 4/4 |
| AC-138 grep: `item/index.tsx` เรียก `cartQuantityOptions` และไม่มี `<option value={1} key={1}>` | pass | grep 2 / 0 |
| กฎข้อ 102a: ทั้ง 96 เคส (6 ความกว้าง × 1/3 line × มี/ไม่มีส่วนลด × จำนวน 1/10/11/99) `scrollWidth ≤ viewport`; ที่ ≥ 1024 `cart-summary-column` กว้าง 360 และ right ≤ viewport; ตาราง/`product-price` อยู่ซ้ายของคอลัมน์สรุป (ห่าง 40px ที่ 1024–1280 และ 160px ที่ 1440); `elementFromPoint` ของ `product-price` และยอดในสรุปอยู่ใน element ไม่ถูกตัด | pass | qa-01-cart-1024-3lines-99-discount.png |
| กฎข้อ 102a: < 1024 (375/1023) คอลัมน์สรุปเรียงอยู่ใต้ตาราง ไม่ล้น | pass | qa matrix |
| 1440 (≥ large) layout เหมือน develop: bounding box ของคอลัมน์ซ้าย, คอลัมน์สรุป, ตาราง, แถว และราคา ตรงกันทุกค่า เมื่อเทียบกับ grid ของ develop (`1fr 360px`, gap 160px ใส่เป็น inline style บนหน้าเดียวกัน) ทั้งที่ 1440 และ 1680 | pass | qa-02-cart-1440-3lines-99-discount.png |
| กฎข้อ 102b: select แสดงจำนวนจริง (1/10/11/99/2/3); option = 1..10 และเพิ่มจำนวนจริงเมื่อ > 10 ไม่ซ้ำ | pass | qa matrix |
| กฎข้อ 102b: 99→2, 3→10, 11→10 ที่ 375 และ 1024 → `GET /store/carts/:id` (token เจ้าของ) ได้ค่าใหม่ หลังเปลี่ยนเหลือ option 1..10 | pass | qa select |
| ไม่ถดถอย: dropdown ตะกร้า (1024/1280/1440) อยู่ในจอ กว้าง 420, แสดง "จำนวน: 99", ยอดรวมไม่ถูกตัด; checkout summary ทั้ง 6 ความกว้างไม่ล้น หัวข้อเป็นไทย | pass | qa-04-dropdown-1024.png |
| Regression: `core-44` 1/1, `core-42` 2/2, `thai-ui-cart-order` 2/2, `core-19c` 5/5, `core-26` 2/2 (ไม่แก้ locator) | pass | e2e 12/12 |

## Negative / edge
- **เลือกจำนวนเกิน stock** (สินค้า `manage_inventory` stock 5 จาก 3 เลือก 10): Medusa ปฏิเสธ แสดง error ไทย "แก้ไขจำนวนสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" backend ยังเป็น 3 select กลับเป็น 3 และหน้าไม่ล้น → pass (qa-03-stock-error-1024.png)
- **เลือกสองครั้งติดกัน** (99 → 5 → 7 ทันที): backend และ UI ได้ 7 ตรงกัน → pass
- **ชื่อสินค้ายาวมาก** (ไทย+อังกฤษ ประมาณ 90 ตัวอักษร) + 99 + 11 + ส่วนลด: ที่ 1024/1280 ไม่ล้น ตารางไม่ทับคอลัมน์สรุป → pass; ที่ 375 ล้น ดู O-1
- **จาก 10 เพิ่มไม่ได้**: line จำนวน 10 มี option สูงสุดแค่ 10 ตรงตามกฎข้อ 102b

## Defect
ไม่พบ

## Observation
- **O-1** (นอกขอบเขต AC-138 อยู่ในขอบเขตกฎข้อ 100a ของ CORE-42): ที่ 375 cart มีสินค้าชื่อยาวมาก จำนวน 99 ยอด 7 หลัก (฿1,222,221.33 → ฿1,161,110.26) + line จำนวน 11 มีส่วนลด ได้ `scrollWidth` 385 (`product-price` ล้นขอบขวา 10px; qa-05-longname-375.png) ส่วนสินค้าชื่อสั้นยอดเท่ากันไม่ล้น PR นี้ไม่ได้เปลี่ยน CSS ที่ < 1024 จึงน่าจะเป็นปัญหาเดิม → follow-up
- **O-2**: error เมื่อจำนวนเกิน stock เป็นข้อความทั่วไป ไม่บอกว่าสินค้าไม่พอ → follow-up
- **O-3**: ที่ 1024–1439 ระยะห่างคอลัมน์เป็น 40px (develop 160px) ตามที่ตั้งใจในกฎข้อ 102a; ที่ 1024 develop ล้นแม้ไม่มีส่วนลด (`scrollWidth` 1056) และล้นมากขึ้นเมื่อมีส่วนลด (1075) ส่วน PR ไม่ล้น

## สรุป
AC-138 และกฎข้อ 102 (a)(b) pass ครบทุกข้อบน prod build ไม่มี regression ที่ ≥ 1440 layout เหมือน develop ทุกพิกเซล ไม่มี defect ที่บล็อก merge
