# QA REPORT — CORE-14d (PR #128)
- Spec: `docs/spec/01-core-medusa.md` — AC-92, AC-93, กฎข้อ 57–58 (กฎ 58 ตามคำตัดสิน owner 2026-10-27: ล็อกอินอยู่แล้วต้องกดยืนยัน; spec แก้ใน PR #132)
- รอบ 1: `06a74bb` | รอบ 2: `9ec05db` — prod build (`medusa start` :9181, `next start` :8181), Node 22.23.3, DB seed ใหม่, Stripe key ปลอม, Playwright chromium workers=1
- param จริงคือ `add_quantity` และ test id ของรายการใน cart คือ `product-row`
- Report/trace ฉบับเต็ม (CI artifact 14 วัน): รอบ 1 https://github.com/techpowerdev/medusa-ecom/actions/runs/40453746279 | รอบ 2 https://github.com/techpowerdev/medusa-ecom/actions/runs/40456884626 (storefront-e2e pass)

## ตาราง AC (รอบ 2 — head 9ec05db)
| AC | Result | Evidence |
|----|--------|----------|
| AC-92 no-JS ไม่ล็อกอิน `add_quantity=2` → login → `/th/cart` มี `product-row` qty 2, ไม่มี `skeleton-cart-page` ทั้งใน DOM และใน HTML ที่ server ส่งมา (ภายใน 10 วินาที) | pass | r2-ac92-nojs-cart-qty2.png |
| AC-92 admin ลบสินค้าระหว่างอยู่หน้า login → login → `add-variant-error` ไทย, URL มี `add_error=1`, ไม่มีปุ่มยืนยัน, cart ว่าง | pass | r2-ac92-nojs-deleted-add-error.png |
| AC-92 ไม่มี `catch {}` ว่างใน `lib/data/customer.ts` (grep 0) + vitest storefront 290/290 | pass | ผล grep/vitest รอบ qa |
| AC-93 ล็อกอินแล้วเปิดลิงก์ `add_variant` → ไม่เพิ่มเอง (cart ว่าง) แสดงการ์ด `add-variant-pending` ภาษาไทย (ตัวเลือก/จำนวน/ราคา) + ปุ่ม `add-variant-confirm` → กดแล้วไป `/th/cart` qty ตามลิงก์ (JS เปิดและปิด) | pass | r2-ac93-logged-in-confirm-card.png |
| AC-93 ล็อกอินแล้ว variant ไม่มีจริง → `add-variant-error` ไทย ไม่มีปุ่ม cart ไม่เปลี่ยน (JS เปิดและปิด) | pass | r2-ac93-missing-variant-error-nojs.png |
| `/th/cart/pending-add?add_variant=…` ตรงๆ (ล็อกอินอยู่) → 404 cart ไม่เปลี่ยน | pass | e2e qa R2-4 |
| `/th/cart` ปกติ (JS เปิด) โหลดไม่ค้าง ไม่มี skeleton ไม่มี pageerror; เข้าจาก `nav-cart-link` ได้ | pass | e2e qa R2-6 |
| Regression AC-6, AC-44, AC-45 (JS เปิด/ปิด), AC-41/42/43/76, AC-1–4 | pass | e2e 15/15 |

## D-1 (กด Back หลัง login แบบ no-JS แล้วเพิ่มซ้ำ)
| รอบ | ขั้นตอน | ผล |
|---|---|---|
| รอบ 1 (06a74bb) | no-JS `/th` → `/th/account?add_variant=<t-shirt>&add_quantity=2` → login → `/th/cart` qty 2 → Back | **fail**: qty กลายเป็น 4 เพราะเพิ่มซ้ำเงียบๆ |
| รอบ 2 (9ec05db) | ขั้นตอนเดียวกัน | **pass**: กลับไปหน้าบัญชีที่มีการ์ด + ปุ่ม `add-variant-confirm`, cart ยัง qty 2 — r2-d1-back-confirm-qty2.png |

## Edge case (รอบ 2)
| กรณี | ผล |
|---|---|
| ลิงก์ `<a>` จากเว็บอื่นขณะล็อกอิน (`add_quantity=3`) | ไม่เพิ่ม แสดงการ์ดยืนยัน (รอบ 1 เพิ่มเอง) |
| `<img src>` จากเว็บอื่นยิงไปที่ `/account?add_variant=` | ไม่เพิ่ม |
| JS เปิด ดับเบิลคลิกปุ่มยืนยัน | qty 2 ไม่ซ้ำ |
| JS ปิด ส่งฟอร์มยืนยันสองครั้งพร้อมกัน ขณะยังไม่มี cart | 303 ทั้งคู่; cart ที่ cookie ชี้มี qty 1 แต่ DB มี cart ของลูกค้าคนเดียวกัน 2 ใบ — ข้อสังเกต O-2 |
| JS ปิด ส่งสองครั้งพร้อมกัน ขณะมี cart qty 1 อยู่แล้ว | qty 2 (ไม่ใช่ 3) — ข้อสังเกต O-2 |
| กด Back ไปหน้าการ์ดหลังกดยืนยันแล้ว | ไม่เพิ่มเอง ต้องกดปุ่มอีกครั้ง |
| `add_quantity=999` (ล็อกอินแล้ว) | ถูกตัดเหลือ 100 เกิน stock (99) → error ไม่มีปุ่ม |
| แก้ hidden `country_code` เป็น `/evil.example` แล้ว submit | ไม่ออกนอกร้าน cart ไม่เปลี่ยน แต่ได้ HTTP 500 — ทำได้เฉพาะเมื่อแก้ฟอร์มเอง ผลกระทบต่ำ |
| `/zz/…`, `//evil.example/…` (รอบ 1) | อยู่ในโดเมนร้าน ไม่เพิ่มลง cart |

## ข้อสังเกต (ไม่บล็อก AC)
- O-1 (UX): หลังกด Back ใน D-1 การ์ดเขียนว่า "…ยังไม่ได้อยู่ในตะกร้า" ทั้งที่สินค้านั้นอยู่ใน cart แล้ว อาจทำให้ลูกค้ากดเพิ่มซ้ำ
- O-2 (พฤติกรรมเดิมของ `addToCart`/`getOrSetCart`): no-JS ส่งฟอร์มซ้ำพร้อมกันตอนยังไม่มี cart → ได้ cart ค้างเพิ่มอีกหนึ่งใบ (owner ตัดสิน Q-F7: ยังไม่กันใน v1)
- tamper `country_code` แล้วได้ 500 แทนข้อความ error ที่เป็นมิตร
