# SFUI-23 — ผล QA (เก็บตกรอบ 50; spec 09 inventory 38–42, กฎ 81–85, AC-72–75; ADR-034)

สภาพแวดล้อม: `55615d02` (ฐาน SFUI-22 `cfa91f46`; หลัง rebase เนื้อโค้ดเท่าเดิมที่ `0f2fc4ee`), node 24, prod build — backend :9511 (`NODE_ENV=production` build, start จาก `.medusa/server`,
DB `medusa_qa_sfui23`, Redis db 15, Stripe test + `stripe listen`), storefront :8511 (`next build` + `next start`); worktree แยกของ qa
Playwright report/trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR (14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-72 | pass | 05-affiliate-forms-390.png — `sfui-23-followups` AC-72 (1280/390) ผ่าน; ตรวจเอง `row-gap` 16px ของฟอร์ม login และฟอร์มสมัครที่ 1280/640/390/375/320 |
| AC-73 | pass | 01-free-shipping-popup-focus-375.png — popup อยู่ในจอที่ 375 (กว้าง 335px)/390 (350px)/640/1280 (400px ห่างขอบขวา 20px), `scrollWidth <= innerWidth`; แตะ (touch) พื้นที่ว่างข้างปุ่มปิดแล้ว event ไปถึงหน้า (ไม่ติด popup); ปิดได้; ลิงก์ไป `/th/cart` และ `/th/store` ถูก; Tab แล้วเห็น focus ring; contrast ghost 21:1, secondary 16.4:1, ghost hover 16.4:1 |
| AC-74 | pass | 03-mobile-account-nav-390.png, 04-checkout-review-edit-375.png — ขอบข้อความ "แก้ไข" ×3 = ขอบขวาแถวหัวข้อ, "เพิ่มโค้ดส่วนลด" = ขอบซ้าย form, "ออกจากระบบ" = แนว icon (มือถือ x=56) / แนว overview-link (desktop x=152) ที่ 1280/640/390/375 ไม่มีล้นจอ; ปุ่มยังสูง 36px padding 16px และกดได้ |
| AC-75 | pass | 02-auth-toggle-login-375.png — ประโยคเป็น `[SPAN, BUTTON]` ไม่มี "." และไม่มี text node ช่องว่าง; ระยะประโยคถึงลิงก์ 16.0px, กึ่งกลางแนวตั้งต่างกัน 0 (login และ register) ที่ 1280/640/390/375/320 |

## ผลรัน test
- ชุดของ task และ spec ที่อ้างหน้า: `sfui-23-followups`, `sfui-19-button-size` (Stripe 3DS + พร้อมเพย์จริง), `sfui-21-forms`, `core-79`, `core-90`, `sfui-9d-font`,
  `affiliate-portal`, `affiliate-portal-polish`, `core-4e-checkout-polish` — 26/26 passed
- regression 24 ไฟล์ที่อ้างหน้า/testid ที่แตะ (core-14g/40/38/4g/4h/4f/4j/73, flash-sale-storefront, register-policy-links, sfui-11/12a/12b/12c/14/21-heading/21d/9e,
  store-content, thai-ui-checkout/account, affiliate-header/profile-overflow, affiliate-portal-pages) — 62/62 passed
- static (project unit): `sfui-21-consistency`, `sfui-19-button-size.unit`, `core-90-link-button.unit` — 26/26 passed

## negative / edge case
- แตะปุ่มปิด popup สองครั้งติดกัน: popup ปิด ไม่มี error
- ที่ 320px ประโยคลิงก์สลับไม่ล้นจอ ระยะยังเป็น 16px
- ที่ 640px (จุด `sm`) popup กว้าง 400px ไม่ล้นจอ
- แตะ/คลิกพื้นที่ว่างใน root ของ popup ข้างปุ่มปิด: event ไปที่ element ของหน้า (การ์ดสินค้า/ตัวกรอง)
- แตะ "เพิ่มโค้ดส่วนลด" หลังใส่ margin ติดลบ: ยังกดได้

## defect
ไม่พบ

## ข้อสังเกต
1. focus ring ของลิงก์ใน popup (`ring-ring/50` ค่าเดิมของ shadcn) บนพื้นดำคำนวณได้ประมาณ 2.7:1 ต่ำกว่า 3:1 ของ WCAG 1.4.11 เล็กน้อย ในภาพยังเห็นเป็นกรอบเทา (AC กำหนดเพียง box-shadow ≠ none) — ถ้าจะแก้ควรตัดสินที่ระดับ token/spec
2. "ดูตะกร้าสินค้า" เป็น ghost ไม่มีกรอบขาวเหมือนเดิม ตอนไม่ได้ focus จึงเห็นเป็นตัวหนังสือขาวเฉยๆ ตรงตามกฎ 83
3. ภาพ 04 มีอีเมลลูกค้าสุ่มของ test (`e2e-core6-…@example.com`) ไม่ใช่อีเมลจริง
