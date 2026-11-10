# QA CORE-4c2 — PR #102 + #103 (merge รวมบน develop 201f062)
สภาพแวดล้อม: backend + storefront next dev, Node 22, chromium, manual payment (ไม่ใช้ Stripe)
ภาพรวม: vitest 166 ผ่าน, eslint 0 error, playwright unit 29 ผ่าน, spec ของ QA ผ่าน 6/7 (QA-6 ไม่ผ่าน → D-1)

## PR #102
| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-48 policy ทั้ง 5 (title + เนื้อหาไทย) | ผ่าน | `4c2-01-policy-shipping-th.png` |
| AC-48 cart มีสินค้า / cart ว่าง / มือถือ 375 ไม่ล้น | ผ่าน | `4c2-02-cart-th.png` |
| AC-48 order confirmed ("ชำระเมื่อ 26 ต.ค. 2569 HH:MM") | ผ่าน | `4c2-03-order-confirmed-th.png` |
| AC-48 order detail (สถานะไทย, help → /th/contact, /th/returns 200, มือถือไม่ล้น) | ผ่าน | `4c2-04-order-detail-th.png` |
| AC-78 order 18:30Z (01:30 เวลาไทย) แสดง "26 ต.ค. 2569" ทุกจุด ใน browser UTC / Asia/Bangkok / New_York ไม่มี hydration error | ผ่าน | `4c2-05-orders-th.png` |
| AC-49 (JSX) lint 0 error | ผ่าน | eslint + vitest |
| "เลือก..." ใน CartItemSelect | ผ่าน | e2e ของ QA |
| "เลือก..." ในฟอร์มที่อยู่ (country) | ไม่ผ่าน (D-2 → CORE-4d) | — |

## PR #103
| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-77 ลิงก์ /th/privacy, /th/terms ในฟอร์มสมัคร ตอบ 200 | ผ่าน | e2e register-policy-links |
| AC-79 order 5 line แสดง 3 รูป + "+ 2 รายการ"; 3 line ไม่มีตัวนับ | ผ่าน | e2e ของ QA |
| AC-80 / AC-81 / AC-49 ข้อความนอก JSX | ผ่าน | vitest |
| error ไม่มีคำนำหน้า "Error:" | ผ่าน (ดู D-3) | e2e ของ QA |
| cart/add no-JS: variant ผิดตอบไทย | ไม่ผ่าน (D-1) | e2e ของ QA |

## Defect
- D-1 (#103): route `cart/add` ส่งข้อความ error ของ backend ภาษาอังกฤษตรงๆ เมื่อ variant ไม่มีอยู่ → แก้ใน #103
- D-2 (#102): placeholder ช่องประเทศในฟอร์มที่อยู่เป็น "Country" (CountrySelect อยู่ใน scope ของ CORE-4d) → CORE-4d
- D-3 (#103, minor): address-error แสดง "Unauthorized" ดิบจาก backend → แก้ใน #103

## Edge
- submit cart/add ซ้ำ 2 ครั้ง → cart มี 1 line qty 2 ไม่มี line ซ้ำ
