# QA Report — GB-N1 (PR #106) ส่วน UI admin

ทดสอบบน backend `medusa start` (build) · Playwright: `group-buy-admin-form.spec.ts` 3 ผ่าน + spec ของ QA 2 ผ่าน (5/5)

| AC | ผล | หลักฐาน |
|----|----|---------|
| GB-6b2: ends_at อดีต → `gb-ends-at-warning` สีส้ม (คำเตือน) ไม่ใช่สีแดง error และยังสร้างแคมเปญได้ | ผ่าน | `ac1-ends-at-warning-vs-error.png` |
| AC-33: picker เลือกหน้า 1 + หน้า 2 แล้วกลับหน้า 1 ยังติ๊ก จำนวนที่เลือก = 2 | ผ่าน | `ac2-picker-cross-page.png` |
| Regression AC-32: `gb-max-quantity-error` ยังเป็นสีแดง | ผ่าน | `ac1-ends-at-warning-vs-error.png` |
| Regression AC-32: dblclick Create → POST 1 ครั้ง ปุ่ม disabled ระหว่างรอ ได้แคมเปญ 1 แถว | ผ่าน | ผล Playwright |

## รายละเอียดที่วัดได้
- computed color: warning = `rgb(154, 52, 18)` (`text-ui-tag-orange-text`), error = `rgb(225, 29, 72)` (`text-ui-fg-error`)
- ends_at อดีต + max_quantity ผิดพร้อมกัน → error บล็อกการส่ง (POST 0) คำเตือนไม่บล็อก; แก้แล้ว dblclick → POST 1 ครั้ง แคมเปญ draft 1 แถว
- picker: 6 สินค้า 2 หน้า เลือก P1 → Next เลือก P6 → Prev → P1 ยังติ๊ก "2 selected."

## Negative / edge case
- ยกเลิกตัวที่เลือกในหน้า 1 → count ลดเป็น 1 ตัวในหน้า 2 ยังติ๊ก — ผ่าน
- dblclick ระหว่างหน่วง response → POST 1 ครั้ง — ผ่าน

## Defect
ไม่พบ
