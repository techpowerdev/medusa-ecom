# QA PAY-11 — PromptPay ทางสำรองบอกเหตุคืนเงิน (PR #479, spec 06 กฎข้อ 13 / AC-24)

| AC / ข้อตรวจ | Result | Evidence |
|----|--------|----------|
| AC-24 (1) complete ตอบ 409 FLASH_SOLD_OUT → เห็น `promptpay-refunded` ภายใน 5 วินาที, มีคำว่า "คืนเงิน", ไม่มี `promptpay-awaiting-order` และไม่มี poll/complete ตามมาอีก — Stripe test mode จริง | pass (ยืนยันจาก CI) | CI run 44951266926 job storefront-e2e: `pay-11-promptpay-refund-reason.spec.ts:66` |
| AC-24 (2) ตอบ CART_COMPLETION_IN_PROGRESS → ยัง poll ต่อ ไม่แสดง refunded — Stripe test mode จริง | pass (ยืนยันจาก CI) | CI job เดียวกัน: `…:107` |
| QA-1 ในเครื่อง: FLASH_SOLD_OUT → refunded ~0.03 วินาที ข้อความไทยตามกฎข้อ 27; 12 วินาทีหลังจากนั้น placeOrder 1→1 และ poll 0→0 | pass | qa479-01-refunded-flash-sold-out.png |
| QA-2 ในเครื่อง: processing → ยังอยู่ที่ awaiting, poll 0→3 ใน 10 วินาที, ไม่มี refunded | pass | qa479-02-processing-still-awaiting.png |
| QA-3 ทางเดิม PAY-6c: poll ได้ refunded โดยไม่รู้เหตุ → ข้อความเดิมตรงทุกตัวอักษร | pass | qa479-03-pay6c-unknown-reason.png |
| QA-4 375px: กล่อง x=24 กว้าง 327 ไม่ล้นจอ | pass | qa479-04-refunded-375.png |
| QA-5 PROMOTION_NOT_COMBINABLE → ข้อความโปรโมชันที่มีคำ "คืนเงิน" | pass | ผล test |
| QA-6 unauthorized → /th/account | pass | ผล test |
| QA-7 dblclick → placeOrder ครั้งเดียว | pass | ผล test |
| unit `promptpay-finish.test.ts` | pass (12/12) | vitest ในเครื่อง |

## ยืนยันจาก CI
ส่วนที่ใช้ PromptPay ของ Stripe จริงยืนยันจาก CI เท่านั้น (เครื่อง QA ไม่มี Stripe key) — storefront-e2e pass 442 passed, ไม่มีคำเตือนว่าขาด secret Stripe จึงรันจริงไม่ถูก skip; report/trace ใน artifact ของ run 44951266926 (14 วัน)

## วิธีทดสอบในเครื่อง
prod build, Stripe.js stub ผ่าน page.route, ปรับ session ใน DB ของ qa เป็น `pp_stripe-promptpay_stripe` สถานะ `authorized` (เท่ากับหลัง guard ตอบ PAYMENT_ALREADY_COMPLETED), mock server action placeOrder/getPromptPayState ด้วย action id จาก build — ไม่ได้ complete cart จริงในเครื่อง การแปลง 409 → outcome ใช้ unit + CI เป็นหลักฐาน

## ข้อสังเกต
ปุ่ม "เริ่มชำระใหม่" (`promptpay-retry-button`) ยังแสดงหลังขึ้น refunded (เหมือน PAY-6c) ทั้งที่ข้อความบอกให้ปรับตะกร้า — ไม่ใช่ defect เสนอเป็น task แยก (qa479-05-after-retry-click.png)
