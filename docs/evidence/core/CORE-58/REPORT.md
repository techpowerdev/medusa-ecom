# QA evidence — CORE-58 (PR #369)

Spec: `docs/spec/01-core-medusa.md` กฎข้อ 116, AC-157 และ regression AC-147

## Commit ที่ตรวจ
- `a82dd5be167f338460575ae0ef3c66c86ca4d7f4` (`feat/CORE-58-address-invisible-chars`) ฐานคือ `develop` @ `fef9b65b`
- ตรวจใน worktree แยกของ QA ไม่ได้แก้โค้ดแอปพลิเคชัน
- หลังจากนี้ builder แก้ตาม review (เขียนอักขระมองไม่เห็นใน test เป็น escape ของ JS + เทียบ snapshot ของ cart ใน e2e) — ไม่เปลี่ยนพฤติกรรมของแอป ยืนยันด้วย CI ของ head ล่าสุด

## สภาพแวดล้อม
- Prod build ทั้งสองฝั่ง: backend `medusa build` + `medusa start` (NODE_ENV=production) ที่ :9311, storefront `next build` + `next start` ที่ :8311
- DB `medusa_qa369` สร้างใหม่ แล้ว migrate + seed, Redis db 11, Node v22.23.3
- ไม่ใช้ Stripe จริง: ใช้ `pp_system_default` กับ key ปลอมแบบเดียวกับ CI และตั้ง `ALLOW_TEST_PROVIDERS=true`
- Chromium (Playwright) หา element ด้วย `data-testid` และตรวจภาษาไทยด้วย regex อักษรไทย
- trace และรายงาน Playwright ฉบับเต็ม: CI artifact ของ PR #369 (job `storefront-e2e`, 14 วัน)

## ผลตาม AC

| AC | ผล | Evidence |
|----|----|----------|
| AC-157 (unit): helper `trimInvisible` ครบ 7 กรณี; grep สองไฟล์ไม่มี `const normalize =` | pass | Vitest `src/core-58-address-invisible.test.ts` ผ่าน; ชุดเต็ม 99 files / 1151 tests ผ่าน รวม `insufficient-inventory`, `group-join-error`, `checkout-error`, `checkout-conflict-contract` ที่ไม่ได้แก้ assertion |
| AC-157 (e2e): `shipping-city-input` = U+200B → error ไทย, `step=address`, cart ไม่ถูกเขียน | pass | `01-ac157-shipping-city-zwsp-1280.png`; e2e ของ PR ผ่าน และ QA ทดสอบเพิ่มอีก 6 ค่า (U+200B/200C/200D/2060/FEFF และค่าผสม space/tab) ผ่านทั้งหมด |
| AC-157 (e2e): `billing-city-input` บน cart digital-only | pass | `02-ac157-digital-billing-city-feff-1280.png`; ทั้ง U+200B (PR), U+FEFF และค่าผสม (QA) |
| AC-157: ช่องบังคับอื่น (ชื่อ, นามสกุล, ที่อยู่, รหัสไปรษณีย์) = U+200B U+2060 | pass | QA e2e 4 กรณีผ่าน: error ไทย และ cart ไม่เปลี่ยน |
| AC-157: ตัดอักขระมองไม่เห็นที่หัว/ท้าย แต่คงไว้กลางข้อความ | pass | QA e2e: city `​วัฒนา​` → `วัฒนา`; first `﻿สมชาย‍` → `สมชาย`; postal `‌10110‌` → `10110`; address_1 `​99 ถนน​สุขุมวิท​` → `99 ถนน​สุขุมวิท` (U+200B กลางข้อความยังอยู่); billing ค่าเดียวกัน แล้ว redirect ไป `step=delivery` |
| AC-147 regression (ทั้งไฟล์, 2 viewport) | pass | `core-52-checkout-guards.spec.ts` ผ่าน 14/14 (AC-147 ×12 + AC-157 ×2); `04-ac147-blank-city-error-1280.png` |
| AC-147: ใบเสร็จแยก error แล้วค่าไม่หาย | pass | e2e ของ PR ผ่าน 2 viewport; QA ทดสอบ billing city = U+200C U+200D: checkbox ยังไม่ติ๊ก และ `billing-first-name-input` ยังเป็น "สมหญิง" |
| Regression ข้อความ error ไทยหลังรวม `normalize` และเพิ่ม `.trim()` | pass | `05-regress-group-join-full-error-1280.png`; `core-48-cart-insufficient-stock` AC-143 ผ่าน 2/2; `group-buy-join` (GB_GROUP_FULL, GB_UNITS_LIMIT_EXCEEDED, หมดเวลา 400) ผ่าน; `flash-sale-fs15` AC-22 (409 FLASH_SOLD_OUT ไทย) ผ่าน; `core-4g` AC-99 (promotion-error ไทย) ผ่าน |

ข้อความ error ที่แสดง (ไทย): "กรุณากรอกชื่อ นามสกุล ที่อยู่ รหัสไปรษณีย์ และเขต/อำเภอให้ครบ (ช่องที่มีแต่ช่องว่างถือว่ายังไม่ได้กรอก)"

## Edge / negative

| กรณี | ผล | รายละเอียด |
|------|----|------------|
| กดส่งซ้ำ (dblclick) ค่าไม่ถูกต้อง | pass | server action ยิง 1 ครั้ง, error 1 ข้อความ, cart ไม่เปลี่ยน |
| กดส่งซ้ำ (dblclick) ค่าถูกต้องที่มี ZWSP หัว/ท้าย | pass | server action ยิง 1 ครั้ง, ไปถึง `step=delivery`, city = "วัฒนา" |
| มือถือ 375×812, city = U+200B | pass | `03-edge-mobile-375-zwsp-error.png`; error ไทยห่อบรรทัดไม่ล้นจอ |
| paste U+200B×2 จาก clipboard (Cmd/Ctrl+V) | pass | input ได้ค่านั้นจริง ระบบไม่ยอมรับ และ cart ไม่เปลี่ยน |

วิธีตรวจว่า "cart ไม่ถูกเขียน": ดึง `GET /store/carts/:id?fields=*shipping_address,*billing_address` ด้วย token เจ้าของ cart แล้วเทียบกับ snapshot ก่อน submit ต้องเท่ากันทุกฟิลด์

## Defect
ไม่พบ defect ใน PR นี้

## ข้อสังเกต (ไม่บล็อก)
1. O-1 (test flaky, ไม่เกี่ยวกับ PR): `group-buy-join.spec.ts:86` test A ล้ม 2 ครั้งจาก 4 รอบบน prod build ในเครื่อง ล้มคนละจุด (`toHaveURL(/account/orders$/)`, `group-shipping-option` `toBeVisible()` — timeout default 5 วินาที) อยู่ใน happy path ก่อนถึง error mapping; test error ของ group join ทุกตัวผ่าน → backlog: ใช้ `waitForServerAction` ตามกฎข้อ 101
2. O-2 (UX): หลัง error ช่องที่มีแต่ ZWSP ยังเก็บค่านั้นไว้ ทำให้ช่องดูว่างแต่ไม่ว่าง ผู้ใช้ต้องลบเองก่อน `required` ของ browser จึงจะเตือน ข้อความ error ช่วยบอกได้ระดับหนึ่ง
3. O-3 (ขอบเขต spec): ช่องไม่บังคับ (`company`, `province`, `phone`) และ `email` ไม่ผ่าน `trimInvisible` ตามกฎข้อ 116a ที่กำหนดเฉพาะช่องบังคับ
4. O-4: assertion e2e เดิมของ PR ใช้ `not.toBe("​")` ซึ่งยังผ่านได้ถ้า cart บันทึกค่าอื่นที่มีแต่อักขระมองไม่เห็น — ส่งให้ builder เปลี่ยนเป็นเทียบ snapshot แล้ว
