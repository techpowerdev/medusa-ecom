# QA PAY-15 (PR #484) — PromptPay คืนเงินที่รู้เหตุ → ลิงก์ "ไปที่ตะกร้า" (spec 06 กฎข้อ 17, AC-28)

ทดสอบด้วย prod build (DB/Redis แยกของ qa) เครื่องนี้ไม่มี Stripe key จึงจำลองแบบเดียวกับ qa ของ PAY-11 (stub Stripe.js, แก้ payment_session ใน DB ของ qa เป็น `pp_stripe-promptpay_stripe` ที่ `authorized`, route mock server action `placeOrder` ด้วยผลของ action poll) ส่วนที่ต้องใช้ Stripe จริงยืนยันจาก CI run 44993480114 (job storefront-e2e)

| AC | Result | Evidence |
|----|--------|----------|
| AC-28 (unit) helper `promptPayFinishAction`: รู้เหตุ → goToCart, PAY-6c → ไม่ไปตะกร้า | pass | vitest `promptpay-finish.test.ts` 17/17 |
| AC-28 (e2e) 409 FLASH_SOLD_OUT → `promptpay-refunded` + `promptpay-go-to-cart` (ไทย "ไปที่ตะกร้า"), ไม่มี `promptpay-retry-button`, หยุด poll | pass | qa484-01-go-to-cart-flash-sold-out.png; CI `pay-15-promptpay-go-to-cart.spec.ts:17` (Stripe test mode จริง ไม่ skip) |
| AC-28 href ลงท้าย `/th/cart` คลิกแล้วอยู่หน้าตะกร้า | pass | qa484-02-cart-page-after-click.png |
| AC-28 regression PAY-6c (refunded ไม่รู้เหตุ) → ข้อความเดิม + ปุ่ม "เริ่มชำระใหม่" ไม่มี go-to-cart | pass | qa484-03-pay6c-retry-still-shown.png; CI `payments-promptpay-fallback-cap.spec.ts:90` |
| 375px: ปุ่ม 120.8×48px, ไม่ล้นแนวนอน, tap/Enter/Space → ไปตะกร้า | pass (มีข้อสังเกต a11y) | qa484-04-go-to-cart-375.png |
| PROMOTION_NOT_COMBINABLE / OUT_OF_STOCK / FLASH_LIMIT_EXCEEDED → go-to-cart, ไม่มี retry | pass | qa484-05-go-to-cart-promotion.png |

## Negative / edge
- หลัง refunded ที่รู้เหตุรอ 8 วินาที: placeOrder 1 ครั้ง poll 0 ไม่มี submit-order-button และ QR → pass
- dblclick ลิงก์ → /th/cart ปกติ → pass
- กด Back จากตะกร้ากลับ checkout → state refunded หาย (component state) เห็น submit-order-button อีกครั้ง — spec ไม่ได้กำหนด (หมายเหตุ)

## ข้อสังเกต (a11y, minor)
ลิงก์ครอบ `<button>` (`<a><button>` ซ้อน) Tab หยุด 2 ครั้งที่ action เดียวกัน — pattern เดียวกับ `group-order-pay-link`; เก็บเป็น follow-up

CI: storefront-e2e success (443 passed), lint-typecheck success, backend-* skipped ตาม classify-changes; report/trace ใน artifact ของ run 44993480114
