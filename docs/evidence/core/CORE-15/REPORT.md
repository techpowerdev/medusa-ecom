# QA — CORE-15 หน้า store หยุดยิง /store/search เมื่อ error + ป้ายช่วงราคา ฿ (PR #177)

Spec: `docs/spec/01-core-medusa.md` กฎข้อ 29, AC-54, AC-55, AC-69 · regression `docs/spec/03-flash-sale.md` AC-20 (FS-14)
ตรวจที่ commit `ab61fa7` บน prod build (`medusa start` + `next start`), DB ที่ seed แล้ว, Playwright chromium, 2026-10-28
CI run (รายงาน Playwright และ trace ฉบับเต็มเป็น artifact 14 วัน): https://github.com/techpowerdev/medusa-ecom/actions/runs/40561027845

| AC | Result | Evidence |
|----|--------|----------|
| AC-54 search ตอบ 500 → request ≤ 3 ใน 6 วินาที, `products-error` ไทย, ไม่มี pageerror | pass (1 request, "โหลดรายการสินค้าไม่สำเร็จ", pageerror 0) | qa-ac54-search-error.png |
| กฎข้อ 29 เปลี่ยนค้นหา/filter ขณะ error → ยิงใหม่ 1 ครั้งแล้วหยุด | pass (พิมพ์ค้นหา 1, ล้างช่องค้นหา 1, คลิก filter 1 ครั้งใน 6 วินาที; กลับมาปกติได้โดยไม่ต้อง reload) | QA spec (ในเครื่อง ไม่ได้ commit) |
| AC-55 ยกเลิก mock + reload → เห็นการ์ด ไม่มี `products-error` | pass (การ์ด 2 ใบ) | qa-ac55-recovered.png |
| AC-69 locale en-US ป้าย `price-range-min/max` เป็น ฿ ก่อน/หลังลาก | pass (฿590/฿990 → ลาก min ฿730 → ลาก max ฿830 → คีย์บอร์ด ฿988; ไม่มี THB) | qa-ac69-price-range-en-us.png |
| มือถือ 375px ข้อความ error และป้ายราคาไม่ล้น | pass (scrollWidth = 375) | qa-mobile-375-price-range.png |
| Regression FS-14 AC-20 ราคา flash บน /store | pass (`flash-sale-fs14.spec.ts` 4/4, `store-thb-price` AC-28 ผ่าน) | qa-fs14-store-flash-price.png |

## Negative / edge case
| กรณี | ผล |
|------|----|
| network abort (ไม่ใช่ 500) | pass: ยิง 1 ครั้งใน 6 วินาที, ไม่มี pageerror, แสดง `products-error` |
| เปิด `/th/store?page=2` ขณะ search ล้ม | pass: ยิง 1 ครั้งใน 6 วินาที ไม่วน |
| ล้างช่องค้นหาซ้ำขณะ error | pass: ยิง 1 ครั้งแล้วหยุด |

## ผลการรัน test
- e2e ของ builder `core-15-store-search-error.spec.ts`: 2/2 passed
- regression `flash-sale-fs14.spec.ts` + `store-thb-price.spec.ts`: 5/5 passed
- QA spec: 7/7 passed

## Defect
ไม่มี (ข้อสังเกต: footer ใน screenshot AC-54 มี collection ของ e2e FS-14 ค้าง — ข้อมูลทดสอบที่ e2e นั้นไม่ลบ)
