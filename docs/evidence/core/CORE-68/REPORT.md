# QA — CORE-68 แบ่งหน้าคำสั่งซื้อในบัญชีลูกค้า (PR #462, spec 01 AC-167)

รันบน prod build (backend + storefront), DB แยก, manual payment — commit d3bfab8d
Playwright report/trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR #462 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-167 ลูกค้า 12 order → หน้า 1 มี 10 แถว (ใหม่สุดก่อน) | pass | e2e core-68 (CI artifact) |
| AC-167 กดเลข 2 ใน `orders-pagination` → `?page=2` มี 2 แถว (เก่าสุด), reload แล้วยังอยู่หน้า 2 | pass | qa462-ac167-page2-reload.png |
| AC-167 `?page=99` → `?page=2`; `?page=abc` → หน้า 1 | pass | ผล test |
| AC-167 order ≤ 10 ใบ → ไม่มีแถบแบ่งหน้า | pass | ผล test |
| AC-167 overview มี 5 แถว + ลิงก์ "ดูทั้งหมด" (อักษรไทย) ไป /account/orders | pass | qa462-ac167-overview.png |
| AC-167 375px ไม่มี scroll แนวนอน | pass | qa462-ac167-page2-375.png |
| Regression GB-22: รายการ group buy ยังแสดงคู่กับการแบ่งหน้า | pass | qa462-gb22-with-pagination.png |
| ลูกค้าอีกคนไม่เห็น order ของคนอื่น | pass | ผล test |
| unit การคำนวณ offset/page | pass | vitest 3/3 |

## Negative/edge
| กรณี | ผล |
|------|-----|
| `?page=3`, `?page=99` (มี 2 หน้า) | redirect `?page=2` |
| `?page=0`, `-1`, `1.5`, `%20`, `page=2&page=3` | แสดงหน้า 1 |
| ลูกค้า 0 order + `?page=5` | redirect /account/orders, empty state |
| double-click ปุ่มเลข 2 | ไปหน้า 2 ครั้งเดียว |
| draft order ของ group buy | ไม่ถูกนับใน count ของ order ปกติ |

ข้อสังเกต: ส่วน "คำสั่งซื้อแบบกลุ่ม" แสดงซ้ำทุกหน้า (spec ไม่กำหนด); Pagination ของ starter ไม่มี `aria-current`
