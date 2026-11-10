# QA — FS-13 (PR #129): ปุ่มเพิ่มลง cart เมื่อ flash sold out + ราคา flash บนการ์ด PLP / แถบล่าง PDP มือถือ

Spec: `docs/spec/03-flash-sale.md` กฎข้อ 18, AC-19 (follow-up qa FS-6 O-2/O-3) — commit ที่ตรวจ `af997c0`
สภาพแวดล้อม: worktree แยก, backend prod build :9182 (NODE_ENV=production, ALLOW_TEST_PROVIDERS=true, Stripe key ปลอม),
storefront `next build && next start` :8182, DB `medusa_qa129`, Redis db 12, Node 22.23.3
หา element ด้วย `data-testid` เท่านั้น ตรวจความเป็นไทยด้วย regex อักษรไทย

## ผลตาม AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-19 (ก) sold out → `add-product-button` disabled + เห็น `flash-sold-out` (desktop) | pass | e2e PR `flash-sale-fs13` test 3 + QA-4; `product-availability` = "สินค้าหมด", ข้อความปุ่ม "สินค้าหมด", ไม่มี "มีสินค้า" บนหน้า |
| AC-19 (ก) มือถือ: `mobile-cart-button` disabled + "สินค้าหมด" และแถบล่างกลับเป็นราคาปกติ ฿1,000 | pass | QA-4, `qa-04-pdp-mobile-sold-out.png` |
| AC-19 (ข) PLP desktop: การ์ดในแคมเปญ `flash-price` ฿800 + `flash-original-price` ฿1,000 ขีดฆ่า; สินค้านอกแคมเปญราคาปกติ (ทั้งหน้า collection และ category) | pass | e2e PR test 1 + QA-1, `01-plp-card-flash-price.png`, `qa-03-category-cards-flash-vs-plain.png` |
| AC-19 (ข) PDP 375×812 ปุ่มหลุดจอ: แถบล่างแสดงราคา flash + ขีดฆ่า, ปุ่มกดได้ | pass | e2e PR test 2 + QA-3, `02-pdp-mobile-bar-flash-price.png` |
| checklist 4: เลย `ends_at` บน PDP (ไม่ reload) กล่อง flash หาย / แถบล่างกลับราคาปกติ / ปุ่มกดได้ พร้อมกัน | pass | QA-6: ห่างกัน 0 ms (render เดียวกัน) หายที่ ~20.2s จาก ends_at +20s; `product-availability` = "มีสินค้า"; `qa-05-pdp-mobile-after-ends-at.png` |
| checklist 5: หลาย variant ใช้ราคา flash ต่ำสุด | pass | QA-1/QA-2: สินค้า 30 variant (เกินเพดาน 24/request, variant ถูกสุดอยู่ chunk ที่ 2) การ์ดแสดง ฿480 ขีด ฿600; PDP variant นั้นแสดง ฿480 (`qa-03-...png`) |

## Regression / unit
- FS-6 `flash-sale-storefront.spec.ts` 4/4 pass (AC-4/AC-13 PDP, AC-1/AC-8 g cart, AC-13 e sold out, AC-1 หลัง ends_at)
- storefront vitest 287/287 pass (รวม 4 test ใหม่ของ `cardFlashOffer`/`mergeActiveFlashSales`)
- e2e PR `flash-sale-fs13.spec.ts` 3/3 pass; QA spec 7/7 pass

## Negative / edge
| กรณี | ผล |
|------|-----|
| hydration error / console error ทุกหน้าที่เปิดใน QA (PLP, PDP desktop/มือถือ, ends_at) | ไม่พบเลย (0 console error) |
| ช่วงก่อนโหลด flash data (หน่วง server action 3 วินาที) บน PDP ที่ sold out | ระหว่างรอ: ปุ่มกดได้, `product-availability` = "มีสินค้า", ไม่มี `flash-sold-out`; หลังโหลด disabled ถูกต้อง — ตรงกับข้อจำกัดที่ PR ระบุ (ด่าน `FLASH_SOLD_OUT` ตอน complete ยังกันอยู่) — O-A |
| แคมเปญหมดอายุ (เลย `ends_at`) แล้ว reload PLP | การ์ดกลับราคาปกติ ไม่มี `flash-price` |
| แคมเปญ sold out แล้วเปิด PLP | การ์ดราคาปกติ ฿1,000 ไม่มีสัญลักษณ์ "สินค้าหมด" บนการ์ด (spec ไม่ได้กำหนด) — O-B |
| แคมเปญ sold out กับสินค้าหลาย variant (แคมเปญเดียวกัน) | PDP sold out + ปุ่ม disabled ด้วย |
| submit ซ้ำ / จำนวนเกิน limit / webhook replay | ไม่เกี่ยวกับ FS-13 (storefront แสดงผลล้วน); O-1 ของ FS-6 (จำนวนเกิน `remaining_units`) ยกไป CORE-24 ตามที่ PR ระบุ |

## Defect
ไม่พบ defect ที่ขัดกับกฎข้อ 18 / AC-19

## ข้อสังเกต (ไม่ block)
- O-A ก่อนข้อมูล flash มาถึง PDP ที่ sold out แสดง "มีสินค้า" และปุ่มกดได้ชั่วครู่ (ปกติเสี้ยววินาที, เครือข่ายช้าจะนานขึ้น) — พิจารณา state "กำลังโหลด" ถ้าต้องการ
- O-B การ์ด PLP ของสินค้าที่แคมเปญ sold out แสดงราคาปกติ ไม่บอกว่าหมด
- O-C (จาก FS-6 O-3 ส่วนที่สอง) `product-price` เหนือกล่อง flash ยังแสดง ฿1,000 ไม่ขีดฆ่า — PR ระบุเป็นนอกขอบเขต
- O-D หน้า collection แคช list สินค้า: สินค้าที่สร้างหลังเปิดหน้าครั้งแรกไม่ขึ้นทันที (พฤติกรรมเดิม ไม่เกี่ยวกับ FS-13; ราคา flash ดึงแบบ `no-store`)

Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #129 (14 วัน)
