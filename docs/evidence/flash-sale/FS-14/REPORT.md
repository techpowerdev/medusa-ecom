# รายงาน QA — FS-14 ราคา flash บนการ์ด /store, /search, rail หน้าแรก (PR #148)

Spec: `docs/spec/03-flash-sale.md` กฎข้อ 19, AC-20 · ADR-014
สภาพแวดล้อม: prod build (`medusa start` + `next start`), DB/Redis แยกของ QA, Stripe key ปลอม
- รอบ 1: commit `e7c5e05` · CI https://github.com/techpowerdev/medusa-ecom/actions/runs/40491281517
- รอบ 2: commit `c785751` (แก้ D-1) · CI https://github.com/techpowerdev/medusa-ecom/actions/runs/40503129198
Playwright report/trace ฉบับเต็มอยู่ใน CI artifact `e2e-evidence` (14 วัน)

## Acceptance criteria (สถานะล่าสุด — รอบ 2)

| AC | Result | Evidence |
|----|--------|----------|
| AC-20 `/th/store` การ์ด X มี `flash-price` + `flash-original-price` (ขีดฆ่า), การ์ด Y ราคาปกติ | pass | 01-store-hits-flash-price.png; e2e `flash-sale-fs14.spec.ts` |
| AC-20 `/th/search?q=<ชื่อ X>` | pass | 02-search-flash-price.png; e2e |
| AC-20 rail หน้าแรก | pass (ตรวจบน build ที่สร้างหลังมีข้อมูล) / test ใน CI เป็น `fixme` รอ task แก้ cache หน้าแรก | 03-home-rail-flash-price.png, qa-1280-home-campaign-after-build.png |
| AC-20 unit: 24 hit → `GET /store/products` 1 ครั้ง | pass | Vitest 371/371 |
| AC-20 diff ไม่แตะ `apps/backend/src/search/` | pass | grep = 0 |

## รอบ 1 (`e7c5e05`)

| # | รายการ | Result | หมายเหตุ |
|---|--------|--------|----------|
| 1 | /store ค้นชื่อ: X ราคา flash, Y ราคาปกติ, ไม่ค้าง skeleton | pass | `products-list-loader` = 0 |
| 2 | `/store/products?id[]` 1 ครั้งต่อหน้า/ต่อการค้น | pass | log ของ backend: หน้าแรกของ /store 1, ต่อการค้น 1, ชุดเดิมได้จาก cache 0 |
| 3 | /search?q= | pass | |
| 4 | หน้าแรก: build หลังมีข้อมูล / แคมเปญสร้างหลัง build | pass / pass (reload) | collection ที่สร้างหลัง build ไม่ขึ้นหน้าแรก (fetch cache `revalidate:31536000`, `tags:[]`) |
| 5 | sold out / เลย `ends_at` | pass (เมื่อ reload) | |
| 6 | 375px การ์ดไม่ล้น | **fail → D-1** | ราคาล้นการ์ด (x 168–212 เกินขอบการ์ด 176) ทับการ์ดข้างๆ ทั้ง /store, /search, หน้าแรก และ PLP ของ FS-13 |
| 7 | regression FS-13 | pass | 3/3 |

## รอบ 2 (`c785751`, แก้ D-1 ด้วย flex-wrap)

| # | รายการ | Result | หมายเหตุ |
|---|--------|--------|----------|
| 1 | 375×812 ชื่อยาว 26 ตัว: /store, /search, PLP, หน้าแรก | pass | ราคาขึ้นบรรทัดใหม่อยู่ในการ์ด (การ์ด 24–175, flash 24–56, ขีดฆ่า 64–108), scrollWidth = 375 — qa-375-store-card-fixed.png |
| 2 | 1280 ชื่อสั้น: บรรทัดเดียวกับราคา; การ์ดไม่มี flash ไม่เพี้ยน | pass | y ของชื่อ/ราคาต่างกัน ≤ 1px ทุกหน้า |
| 3 | /store ค้นไม่พบ → ไม่มี server action เปล่า | pass | ไม่มี action ของ FS-14 และ lookup = 0 |
| 4 | regression ข้อ 1–5 ของรอบ 1 + FS-13 | pass | e2e FS-14 3/3 (รวม test 375 ใหม่), FS-13 3/3; sold out/เลย `ends_at` กลับราคาปกติทั้ง 4 หน้า |

## Defect
- **D-1 (รอบ 1) — ที่ 375px ราคา flash ล้นการ์ด** → แก้แล้วใน `c785751` และตรวจซ้ำผ่าน

## ข้อสังเกต (ไม่ผิด spec)
- O-1: หน้าที่เปิดค้างไว้ยังแสดงราคา flash หลังเลย `ends_at` จนกว่าจะ reload
- O-2: หน้าแรก cache collection/สินค้า 1 ปี (แยกเป็น task ใหม่ แล้วค่อยเปลี่ยน test หน้าแรกจาก `fixme` เป็น `test`) ส่วนราคา flash บน rail ไม่โดน cache
- O-3: บน /store ถ้าค้นไม่พบแล้วค้นคำใหม่ จะยิง `getActiveFlashSales` ด้วย variant ของชุด hit เก่าเกินมา 1 ครั้ง ราคาที่แสดงยังถูกต้อง
