# QA GB-12 (PR #244) — กฎข้อ 32 a–e, AC-51
ทดสอบบน prod build (`medusa build`/`medusa start` + `next build`/`next start`) ที่ 1280px และ 375px หา element ด้วย `data-testid` ตรวจข้อความไทยด้วย regex `[฀-๿]` และเทียบราคากับ `GET /store/products` (region ไทย) — commit `7220302`

| AC | Result | Evidence |
|----|--------|----------|
| AC-51 / 32a: countdown กลาง — ไม่มีไฟล์เก่า, การ์ด group + flash + หน้ากลุ่ม import `@modules/common/components/countdown`; countdown เดินจริงบนการ์ด group, การ์ด flash และหน้ากลุ่ม | pass | qa-01-home-cards-1280.png, grep + unit 22 ผ่าน |
| AC-51 / 32b: `group-selection` (S×3 รวมแถว, M×1) — `group-selection-title` มี `product.title` + `variant.title`, `group-selection-price` `data-value` = `calculated_amount` จาก API, แสดง "฿590 ต่อชิ้น (ราคาก่อนส่วนลดกลุ่ม)", 375px ไม่เลื่อนแนวนอน | pass | qa-02-group-selection-375.png |
| AC-51 / 32c: fixed 50 THB → "ลด ฿50 ต่อชิ้น เมื่อกลุ่มครบเป้าหมาย" บนการ์ด และ `group-discount` บนหน้ากลุ่ม; ราคาหลังลดบนการ์ด ฿540 = ราคา API ฿590 − 50; percentage ยังเป็น "10%" | pass | qa-01-home-cards-1280.png, qa-02-group-selection-375.png |
| AC-51 / 32d: 375px ข้อความอยู่เหนือปุ่ม (สองแถว), ปุ่มสูงเท่ากัน ±2px, ไม่ตัดคำ, scrollWidth ≤ 375; 1280px อยู่แถวเดียว | pass (ดู Observation 1) | qa-03-leave-confirm-375.png |
| AC-51 / 32e: มีแต่ group order → ไม่มี `no-orders-container`; มีทั้งสองแบบ (1280 + 375) → เห็น `group-order-card` 1 และ `order-card` 1 และไม่มี empty state; มีแต่ order ปกติ → ไม่มีทั้ง `group-orders` และ empty state; ไม่มีเลย → `no-orders-container` 1 อัน เป็นภาษาไทย | pass | qa-04-orders-both-1280.png, qa-05-orders-empty-375.png |
| Regression GB-7a1/7a2/7b/7c + thai-ui-account | pass (24 ผ่าน, 2 skip เป็นเคส Stripe UI ที่ต้องใช้ `NEXT_PUBLIC_STRIPE_KEY`) | e2e list run |

## Negative / edge
- **กลุ่มหมดเวลาระหว่างเปิดหน้า** (สร้าง `ends_at` = +12 วินาที): ขึ้น "หมดเวลารวมกลุ่มแล้ว" และหยุดนับ — ผ่าน
- **กดยืนยันออกจากกลุ่มแบบ dblclick:** server action POST ครั้งเดียว สถานะเป็น `cancelled` และไม่มี `group-leave-error` — ผ่าน
- **กด "ไม่ใช่":** กล่องยืนยันปิดและปุ่ม `group-leave-button` กลับมา — ผ่าน
- **เพิ่ม variant เดิมซ้ำ:** รวมเป็นแถวเดิม ราคาต่อชิ้นไม่ถูกคูณด้วยจำนวน — ผ่าน

## Defect
ไม่มี defect ที่ทำให้ AC fail

## Observation
1. **breakpoint ของ 32d:** โค้ดที่ `7220302` ใช้ `small:` (= 1024px ใน `tailwind.config`) วัดได้ว่า 375, 639, 640, 768, 1023px เป็นสองแถว ส่วน 1024/1280px เป็นแถวเดียว — ข้อ "≥ 640px คงแถวเดียว" ไม่จริงที่ 640–1023px (AC-51 วัดแค่ 375/1280 จึงยังผ่าน) reviewer จัดเป็น blocker เดียวกัน → **แก้แล้ว** ใน `409643e` (เปลี่ยนเป็น `sm:` 640px + e2e ที่ 639/640/768/1280px, red → green) และ spec กฎข้อ 32d แก้แล้วใน #249
2. **กรณีโหลด group orders ล้ม (`group-orders-error`) ยังไม่ได้ทดสอบ:** หน้านี้เป็น server component จึงดัก fetch ด้วย Playwright ไม่ได้ owner ตัดสิน 2026-11-04 ให้ไม่แสดง `no-orders-container` เมื่อโหลดล้ม → **แก้แล้ว** ใน `aedc2cf` (helper `showOrdersEmptyState` + unit 4 กรณี; กฎข้อ 32e1 ใน #249) ครอบด้วย unit อย่างเดียว
3. ลูกค้าที่มีแต่ membership ที่ `cancelled` แล้ว ยังเห็นรายการใน `group-orders` และไม่มี empty state ซึ่งสอดคล้องกับกฎ 32e
4. reload หน้ากลุ่มหลังหมดเวลา countdown ยังอยู่และแสดงข้อความหมดเวลา (สถานะกลุ่มยังไม่ถูกปิดโดย job) เหมือนพฤติกรรมเดิมก่อน PR นี้
5. ที่ 375px ป้าย "(ราคาก่อนส่วนลดกลุ่ม)" ขึ้นบรรทัดใหม่ข้างช่องจำนวน (ดู qa-02) เป็นเรื่องความสวยงาม ไม่ล้นจอ

## สรุป
AC-51 และกฎข้อ 32 a–e ผ่านทั้งหมดบน prod build ที่ 1280/375px regression ไม่พัง breakpoint ของ 32d และกรณีโหลด group orders ล้ม (32e1) แก้แล้วใน PR นี้ ผ่าน re-review
