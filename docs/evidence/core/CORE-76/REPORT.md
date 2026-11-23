# CORE-76 — QA evidence (spec 01 AC-175, กฎข้อ 134) — PR #474 @ 042b73f2

| AC | Result | Evidence |
|----|--------|----------|
| AC-175 (a) manual + สต็อกไม่พอจริง (ลูกค้าอีกคนซื้อชิ้นสุดท้ายผ่าน API ขณะอยู่ขั้น review) → "สินค้ามีไม่พอตามจำนวนที่เลือก กรุณาลดจำนวนแล้วลองใหม่อีกครั้ง" ทั้งหน้าไม่มีคำ "คืนเงิน" ไม่มี refunded/processing notice กดซ้ำได้ข้อความเดิมและ order = 0 | pass | qa474-ac175a-manual-stock-375.png, qa474-ac175a-manual-stock-1280.png |
| AC-175 (a2) processing: `checkout-processing-notice` (ไทย) + ปุ่ม disabled (ไม่มี refunded notice) → poll ทุก 3 วินาที → ได้ order จริง → หน้า confirmed และ order = 1 | pass (route mock payload แบบ CORE-71 — ทำ 409 จริงไม่ได้ ดูข้อสังเกต) | qa474-ac175-processing-notice.png |
| AC-175 (a2) สองแท็บกดยืนยันพร้อมกันจริง 4 รอบ (+ API complete ชนกับปุ่ม 3 รอบ) → ทั้งสองแท็บไป confirmed ภายใน 3.3–3.5 วินาที ได้ order เดียวกัน order = 1 | pass | ผล test |
| AC-175 (a2) unauthorized: ลบ cookie `_medusa_jwt` ที่ขั้น review / ใส่ token หมดอายุ → `/th/account` (`login-page`) ไม่มี refunded notice order = 0 | pass | qa474-ac175-unauthorized-account.png |
| AC-175 (b) backend ตอบ 400 "Return shipping option has no stock location" (inject ที่ HTTP proxy หน้า backend; action และ storefront เป็นโค้ดจริง) → `return-contact-store` ไทย + ลิงก์ `/th/contact` ไม่มี "ลองใหม่" ไม่มี `return-error` | pass | qa474-ac175b-return-contact-store.png |
| regression: manual + FLASH_SOLD_OUT → ข้อความเดิมของ code ไม่มี refunded notice (flash-sale-fs15 AC-22) | pass | ผล test |
| regression: กดปุ่มยืนยันสองครั้งติดกัน (dblclick) → order เดียว | pass | ผล test |
| ทางบัตร: `checkout-refunded-notice` (FS-22 AC-29 a/b, PAY-9 AC-22c) | pass (จาก CI) | CI run 44932737566 job storefront-e2e: 439 passed, 0 failed |
| ทางบัตร PROMOTION_NOT_COMBINABLE → PROMOTION_REFUNDED_NOTICE | unit เท่านั้น (Vitest) | `src/lib/util/place-order-outcome.test.ts`, `src/core-76-place-order-outcome-ui.test.ts` |

e2e ของ PR บนเครื่อง QA: core-76 4/4, core-71 2/2, flash-sale-fs15 4/4 pass; vitest ที่เกี่ยวข้อง 91/91 pass
Playwright report/trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ https://github.com/techpowerdev/medusa-ecom/actions/runs/44932737566 (14 วัน)

## ข้อสังเกต
- 409 `CART_COMPLETION_IN_PROGRESS` ทำให้เกิดจริงบน stack นี้ไม่ได้ (complete พร้อมกัน 5×3 รอบได้ 200 order เดียวกัน) จึงพิสูจน์ทาง `processing` ด้วย mock
- `RETURN_NO_LOCATION_MESSAGE` เกิดได้เฉพาะ location ถูกถอดระหว่าง request (option ที่ไม่มี location ไม่ถูก list และ CORE-21 ปฏิเสธก่อน) จึงพิสูจน์ (b) ด้วย inject
