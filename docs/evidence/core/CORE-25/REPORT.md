# Evidence: CORE-25 — option บน PDP ไม่ถูกรีเซ็ตจาก `v_id` + แถบมือถือไม่ทับปุ่มหลัก (QA PR #199)

- Spec: `docs/spec/01-core-medusa.md` — AC-116, กฎข้อ 78
- PR: #199 — branch `feat/CORE-25-pdp-option-reset` @78c3f5d
- สภาพแวดล้อม: storefront prod build (:8121), backend (:9121), node 24.12.0, ลูกค้า login แล้วทุกเคส (ไม่มี guest)
- ข้อมูล: สินค้า `qa199-noimg` (ไม่มีรูป, variant เดียว, ฿250) + แคมเปญ flash ลด 20% บน t-shirt (฿590 → ฿472) เตรียมผ่าน admin API
- หา element ด้วย `data-testid` ทั้งหมด ตรวจข้อความไทยด้วย regex อักษรไทย
- รูปในโฟลเดอร์นี้: `01`–`03` จาก builder + `ac116-1`, `ac116-2c` จาก qa (รวม 5 รูปตามงบ)
- baseline: e2e ของ builder (`core-25-pdp-option-reset` + `core-19a-nav-cart-search`) `--repeat-each=5` ผ่าน 50/50; spec ของ qa `--repeat-each=3` ผ่าน 15/15, edge case 2/2

## ผลตาม AC

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-116 (1) desktop: เลือก S→M แล้วกดเพิ่มทันที 5 รอบ และกดเพิ่มรัว 3 ครั้ง → cart API มีแต่ M (6 ชิ้น); เพิ่ม S → สลับเป็น M → เพิ่มทันที 5 รอบบนหน้าเดิม → S5 M5 ทุกรอบ, radio M ยังถูกเลือก, `variant_id` = M, URL `v_id` = M | pass | `ac116-1-desktop-cart-S5-M5.png` |
| AC-116 (2a) 375×812 สินค้าไม่มีรูป variant เดียว ก่อน hydrate (บล็อก JS chunk): เลื่อนทีละ 40px 14 ตำแหน่ง แถบไม่ทับปุ่มหลัก (bbox + `elementFromPoint`) | pass | (ภาพของ qa ไม่ commit — งบ ≤ 5 รูป; ดู `02-pdp-375-main-button-no-bar.png` ของ builder) |
| AC-116 (2b) แบบเดียวกันหลัง hydrate (รอ observer และ transition ทุกตำแหน่ง): 14 ตำแหน่ง ไม่ทับ | pass | (ดูข้อ 2a) |
| AC-116 (2c) ปิด JS ที่ 375×812: ไม่มี `mobile-actions` ใน DOM, ปุ่มหลัก y=498 ไม่มีอะไรทับ | pass | `ac116-2c-375-noimg-nojs.png` |
| AC-116 (3) 375 เลื่อนพ้นฟอร์ม → แถบแสดง (top 703, opacity 1), `flash-price` บนแถบ ฿472 ตรงฟอร์มหลัก (ขีดฆ่า ฿590) ข้อความไทย; เลื่อนกลับขึ้น แถบไม่ทับปุ่มหลัก | pass | `03-pdp-375-bar-after-scroll.png` (ของ builder) |

## Edge case (นอก spec)

| กรณี | ผล |
|----|----|
| กดเพิ่มลงตะกร้าซ้ำ 3 ครั้งติดกัน | pass — cart +1 (กันกดซ้ำ) |
| จำนวน 3 เกิน remaining 2 | pass — `flash-qty-exceeds-remaining`, `add-product-button` และ `mobile-cart-button` disabled |
| campaign หมดอายุ | pass — แถบไม่มี `flash-price` แสดง ฿590 |

Defect: ไม่พบ

## ข้อสังเกต (นอก scope ไม่ block)
1. cart dropdown แสดง "ยอดรวม (ไม่รวมภาษี) ฿5,514.02" (= 5,900/1.07 ราคาก่อนส่วนลด flash) ขณะที่ราคาต่อ line เป็นราคาหลังลด (฿2,360 × 2) — ลูกค้าอาจสับสน ส่งให้ planner
2. สินค้า noimg วางปุ่มหลักที่ y=498 จึงไม่ได้พิสูจน์ว่าโค้ดเดิมทับด้วยสินค้านี้ — e2e 375 ของ builder (t-shirt ก่อน hydrate ที่เคยทับ 703 vs 740–780) ผ่าน 5/5
3. screenshot ที่ถ่ายระหว่างแถบ fade-in (300ms) อาจไม่เห็นแถบ — ควรรอ opacity = 1 ก่อนถ่าย
