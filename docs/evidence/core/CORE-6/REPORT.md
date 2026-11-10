# QA CORE-6 — PR #36 (spec: docs/spec/01-core-medusa.md)

| AC | Result | Evidence |
|----|--------|----------|
| AC-1 checkout ด้วย manual payment → authorized → capture → captured | pass | 03-order-confirmed.png + e2e core-store "AC-1, AC-2, AC-3" |
| AC-2 fulfillment + shipped → อีเมล order-shipped (provider local) | pass | e2e core-store step AC-2 (poll /admin/notifications) |
| AC-3 My orders แสดง order + ยอด THB ถูกต้อง | pass | 04-my-orders.png |
| AC-4 admin สร้างสินค้า 2 variant + stock → PDP ภายใน 5 วิ | pass | 05-new-product-on-storefront.png |
| AC-6 guest Add to cart → login, 401 บน cart API, ล็อกอินแล้วเข้า cart | pass | 01-guest-add-to-cart-login.png, 02-cart-after-login.png |

รันบน build/start แบบ prod (backend :9112 จาก `.medusa/server`, storefront `next start` :8112) — e2e 10 passed (PR 5 + QA 5)
Playwright report/trace ฉบับเต็ม: CI artifact `e2e-evidence` (14 วัน)

## ตรวจเพิ่ม (QA)
- AC-6 ผ่านการสมัครสมาชิก (register) แทนการล็อกอิน → สินค้าเข้า cart: pass
- guest → 401 ทุก route ที่ลอง: GET/POST `/store/carts/:id`, `/complete`, DELETE line-item, POST `/store/payment-collections`
- bearer ปลอม / token admin / auth identity ที่ยังไม่มี customer → POST `/store/carts` ได้ 401
- customer สร้าง cart ได้ 200 และ cart มี `customer_id`; guest GET `/store/products` ได้ 200
- กด sign-in สองครั้งติดกันพร้อม `add_variant` → 1 แถว qty=1; เปิด `/account?add_variant=` ซ้ำตอนล็อกอินแล้ว → ไม่เพิ่มซ้ำ
- line-item qty=100000 (เกิน stock) → 400

## Defect (ไม่อยู่ใน AC ของ CORE-6 — ส่งต่อเป็น task)
- **D-1 (medium)** no-JS: redirect 303 → `/th/account?add_variant=` ถูก แต่หน้า login ค้างที่ spinner เพราะเนื้อหาอยู่ใน Suspense stream ของ `account/loading.tsx` (ไฟล์ starter) → follow-up
- **D-2 (high, security)** customer B เพิ่ม/อ่าน cart ของ customer A ได้ 200 → CORE-12 (ADR-013)
- ข้อสังเกต: no-JS quantity=3 → หลังล็อกอินได้ qty=1; `add_variant` ที่ไม่มีอยู่จริง → ไปหน้า dashboard โดยไม่มีข้อความ error

## Screenshot
01-guest-add-to-cart-login.png, 02-cart-after-login.png, 03-order-confirmed.png, 04-my-orders.png,
05-new-product-on-storefront.png (≤ 55KB/รูป จาก PR ผลตรงกับรอบ QA)
