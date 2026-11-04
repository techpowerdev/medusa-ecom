# QA — CORE-47 (PR #298, `0876725`) กฎข้อ 105 / AC-142

Spec: `docs/spec/01-core-medusa.md` กฎข้อ 105, AC-142 (owner เลือกทาง (C) — line ใน `/cart` ที่ < 1024 เป็นการ์ด)
สภาพแวดล้อม: prod build backend (:9476) + storefront (:8476) ของ PR และ storefront ของ develop `63cd172` (:8477) ต่อ backend ตัวเดียวกันเพื่อเทียบภาพ · Stripe test mode · หา element ด้วย `data-testid` ตรวจข้อความไทยด้วย regex `[฀-๿]`
Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact ของ PR #298 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-142 (a) 375 แสดงเป็นการ์ด, ชื่อ ≥ 60% ของแถว และไม่เกิน 5 บรรทัด, ราคา 7 หลักอยู่บรรทัดเดียวและชิดขวา, ไม่มี scroll แนวนอน | pass | 01-cart-375-card-multi.png, `core-47-cart-375-long-title` ผ่าน |
| AC-142 (a+) ตรวจเงื่อนไขเดียวกันที่ 320, 414, 639 และ 1023 ทั้งแบบหลาย line, ชื่อสั้น, หลายตัวเลือก, มีส่วนลด, ไม่มีส่วนลด และ line เดียว | pass | 02-cart-320-card.png; จำนวนบรรทัดของชื่อยาว 4/3/3/2/1 ที่ 320/375/414/639/1023, scrollWidth เท่ากับความกว้างจอทุกขนาด |
| AC-142 (b) เปลี่ยนจำนวนและลบได้ โดย Store API ยืนยันด้วย token ของเจ้าของ cart | pass | builder spec ที่ 375 ผ่าน และ QA-3 ผ่าน (เปลี่ยนจำนวนที่ 320 และ 639, ลบที่ 414) |
| AC-142 (a) error ของการลบ/แก้จำนวน และ flash sale อยู่ในการ์ดของ line นั้น | pass | 03-cart-375-qty-error-in-card.png; QA-4 (320/375/1023) และ QA-5 (320/375/639): อยู่ในกรอบการ์ด ไม่ทับปุ่ม ข้อความเป็นภาษาไทย |
| AC-142 (c) ที่ 1023 ยังเป็นการ์ด ไม่ใช่ `table-row` | pass | builder spec และ QA-1 ผ่าน |
| AC-142 (d) ที่ 1024/1280/1440 เหมือน develop ทุกพิกเซล | pass | 04-cart-1280-develop-vs-pr.png; ภาพ full-page ต่างกัน 0 พิกเซลทั้ง 3 ขนาด และ bounding box ของ table, th, row, td, ราคา และคอลัมน์สรุปเท่ากันหมด; header ครบ 5 ช่องและมองเห็นได้ |
| AC-142 (e) checkout `items-table` ที่ 375 และ 1280 ไม่เปลี่ยน | pass | QA-7: `outerHTML` และขนาดเท่ากับ develop และยังเป็น `table-row` |
| dropdown ตะกร้าที่ nav ไม่เปลี่ยน | pass | QA-7: DOM และ box ที่ 1280 เท่ากับ develop |
| test ล้มบน develop | pass | builder spec บน :8477 ล้มที่ scrollWidth 414 > 375 |
| regression: `core-47`, `core-42`, `core-44`, `core-19c`, `thai-ui-cart-order`, `core-14g`, `flash-sale-fs15`, `core-26` | pass | 18/18 passed ด้วย 2 worker |

## Negative / edge
- ดับเบิลคลิกปุ่มลบที่ 375: ลบไปแค่ 1 line, Store API ตรงกับหน้าจอ และไม่มี `cart-item-remove-error` ขึ้นมา
- เปลี่ยนจำนวน 3 แล้ว 4 ติดกันเร็วๆ: Store API ได้ 4 และหลัง reload หน้าจอยังแสดง 4
- server action ตอบ 500 ตอนลบหรือแก้จำนวน: ข้อความไทยอยู่ในการ์ด ไม่เกิน 3 บรรทัดที่ 320 และหน้าไม่ล้นจอ
- flash sale ที่จำนวนเกิน `remaining_units`: คำเตือนอยู่ในการ์ด ไม่เกิน 3 บรรทัดที่ 320
- จำนวน 99 (มากกว่า 10): select แสดง 99 ได้ครบในการ์ด

## Defect
ไม่พบ

## Observation
- O-1: ที่ 320 nav "ตะกร้า (116)" ตัดเป็น 2 บรรทัดและเกือบชนไอคอนค้นหา (เห็นใน 02-cart-320-card.png) ส่วนนี้อยู่นอก diff ของ PR นี้ ควรยกเป็น follow-up ของ header
- O-2: เมื่อมี error หรือคำเตือน flash แถวล่างของการ์ดจะสูงขึ้น ราคาจึงอยู่กึ่งกลางแนวตั้งของแถวนั้น ไม่ได้อยู่ระดับเดียวกับ select เป็นเรื่องความสวยงามเล็กน้อย ยังอ่านได้และไม่ทับกัน
- O-3: กฎข้อ 105b ยกตัวอย่างไว้เป็น `small:table-*` แต่ PR ใช้ `max-small:*` ผลออกมาเหมือนกัน (ภาพที่ ≥ 1024 ต่างกัน 0 พิกเซล) และ class ของการ์ดอยู่ใต้เงื่อนไข `type === "full"` ตามข้อ 105d

## สรุป
AC-142 ผ่านทุกข้อ ทั้งที่ 320, 375, 414, 639 และ 1023 และที่ ≥ 1024 เหมือน develop ทุกพิกเซล regression 8 ไฟล์ผ่าน ไม่พบ defect
