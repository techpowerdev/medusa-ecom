# QA — CORE-50 (PR #309) nav ที่ < 1024 ตั้งแต่ 320

Spec: `docs/spec/01-core-medusa.md` กฎข้อ 108, AC-145 — branch `feat/CORE-50-nav-narrow` @ `6a022bd8`
สภาพแวดล้อม: prod build ทั้งสองฝั่ง (`medusa build` + `medusa start` (admin UI ปิด), `next build` + `next start`), Chromium

## ผลต่อ AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-145 (320/375/639/1023, cart 116) | pass | `e2e/core-50-nav-narrow.spec.ts` ผ่าน 5/5 บน PR; บน develop ที่ 320 ล้ม (ระยะ store→search = 0); qa-01-home-320-cart116.png |
| AC-145 (1280 regression) | pass | left/width ทั้ง 4 ตัวตรง develop (24/18.27, 590.75/98.48, 1107.70/15, 1195.47/60.53 — วัดบน macOS), "บัญชี" แสดง, header 64; qa-03-1280-dropdown.png |

## Checklist ใน PR body

| รายการ | Result | Evidence |
|--------|--------|----------|
| 320×640 cart 116: ไม่ชิด/ทับ, "ตะกร้า (116)" และชื่อร้านบรรทัดเดียว, ไม่มี scroll แนวนอน | pass | ระยะ 81.95/12.7/12, lines 1/1, scrollWidth 320; qa-01-home-320-cart116.png |
| 375/639/1023 + header 64 | pass | ระยะ store→search 40.2/172.2/364.2, header 64 |
| 1280 เหมือน develop | pass | ตามตาราง AC |
| dropdown ที่ 1280, กดตะกร้าที่ 375 ไป /cart, search drawer, side menu | pass | qa-03-1280-dropdown.png, qa-04-375-side-menu.png |

## เงื่อนไขเพิ่ม (ระยะ ≥ 8, อยู่ในจอ, testid ไม่ซ้ำ, 1 บรรทัด, ชื่อร้านไม่ถูกตัด, ไม่ล้น, header 64, อักษรไทย)

| เงื่อนไข | ความกว้าง | Result | ระยะ store→search ต่ำสุด |
|----------|-----------|--------|--------------------------|
| login, cart 116 (`/th`) | 320, 340, 375, 414, 500, 639, 640, 768, 1023 | pass | 12.7 (320) |
| login, cart 1 | ชุดเดียวกัน | pass | 26.42 (320) |
| ไม่ login ("ตะกร้า (0)") | ชุดเดียวกัน | pass | 26.42 (320) |
| PDP, `/cart`, `/account`, `/store` (cart 116) | 320, 375 | pass | 12.7 (320); qa-02-cart-page-320.png |
| 1024, 1100 (มี "บัญชี") | — | pass | ไม่ทับกัน |
| cart 1000 (4 หลัก, นอก spec) | 320 | ข้อสังเกต | 5.83 (< 8) ไม่ทับ/ไม่ล้น; ≥ 340 ได้ ≥ 15.83; qa-05-home-320-cart1000.png |

## Regression
- `core-19a-nav-cart-search`: 7/8 ผ่าน — AC-62 `/th` ล้มแบบ timing (poll 5 วินาที) ขณะเครื่อง load สูง และล้มแบบเดียวกันบน develop nav จึงไม่ใช่ผลของ PR นี้ (PR แก้แค่ className)
- `core-26-cart-dropdown-total`: 2/2 ผ่าน

## Defect
ไม่พบ

## ข้อสังเกต
- O-1: ตะกร้า 4 หลักที่ 320 ระยะชื่อร้าน→ไอคอนค้นหา 5.83px (< 8) — กฎข้อ 108b ครอบคลุมถึง 3 หลัก จึงอยู่นอกขอบเขต ให้ planner ตัดสิน
- O-2: ระยะเผื่อของชื่อร้านที่ 320 ≈ 4.7px (PR แจ้งไว้แล้ว)

Report/trace ฉบับเต็ม: CI artifact ของ PR #309 (14 วัน)
