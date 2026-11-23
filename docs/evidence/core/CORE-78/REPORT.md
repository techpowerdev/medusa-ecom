# QA — CORE-78 (PR #489) spec 01 กฎข้อ 136 / AC-177
ทดสอบที่ head a95e6ff4 แบบ prod build (DB/Redis แยกของ qa, env ปลอม, จ่ายด้วย pp_system_default)

| AC | Result | Evidence |
|----|--------|----------|
| AC-177 (136a) ที่ 1280px: 12 order + membership กลุ่ม → หน้า 1 เห็น group-orders; กดหน้า 2 / เปิด ?page=2 ตรง ไม่เห็น | pass | qa489-01-page1-group-1280.png, qa489-02-page2-keyboard-1280.png |
| AC-177 (136a) ที่ 375px: ผลเดียวกัน ไม่มี horizontal scroll | pass | qa489-03-page1-group-375.png, qa489-04-page2-no-group-375.png |
| AC-177 (136c) `orders-pagination` เป็น `<nav aria-label="แบ่งหน้า">`, aria-current="page" ตัวเดียวและย้ายตามหน้า 1→2→1, ทุกปุ่มมี aria-label ไทย "หน้า N", Tab+Enter เปลี่ยนหน้าได้ | pass | qa489-02-page2-keyboard-1280.png + e2e |
| AC-177 (136b) ลูกค้าที่มีแต่ membership → /account เห็น overview-orders-view-all (ไทย), กด/Enter แล้วไป /account/orders ที่มี group-orders ไม่มี pagination | pass | qa489-05-overview-membership-only-1280.png |
| regression /store หลายหน้า (28 สินค้า, 3 หน้า) กดเลข 2 ได้ทั้ง 1280 และ 375 | pass | e2e |
| regression category ใช้ Pagination ของ starter: a11y ไทย, หน้า 3 → ?page=3, aria-current ย้าย ทั้ง 1280 และ 375 | pass | e2e |
| regression vouchers หน้าละ 20 พร้อม next/prev | pass | e2e 3 passed; vitest pagination/evoucher 23 passed |

## Negative / edge
- orders ?page=0, -1, abc, 1.5, 02 และ ?page=2&page=3 → หน้า 1 มีส่วนกลุ่มและ 10 ใบ: pass
- ?page=99 → redirect ไป ?page=2 ไม่มีส่วนกลุ่ม: pass
- ลูกค้าใหม่ไม่มี order/membership → ไม่มี "ดูทั้งหมด", แสดง no-orders-message: pass

## ข้อสังเกต (ไม่ใช่ defect ของ PR นี้)
- overview ที่มีแต่ membership แสดง "ยังไม่มีคำสั่งซื้อ" คู่กับ "ดูทั้งหมด"
- ที่ 375px ส่วน overview ของ /account ถูกซ่อน (`hidden small:block` ของ starter)
- /store ใช้ `SearchPagination` ของ InstantSearch ไม่ใช่ Pagination ที่ PR แก้ — ยังไม่มี aria ไทย และ URL ไม่เปลี่ยนเป็น ?page=
Playwright report/trace ฉบับเต็มอยู่ใน CI artifact ของ PR #489
