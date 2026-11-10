# QA CORE-41 — เปิด `?step=payment`/`review` ตรงๆ แล้วไปขั้นแรกที่ยังไม่เสร็จ (PR #276)

Spec: `docs/spec/01-core-medusa.md` กฎข้อ 99, AC-135 (regression AC-129)
สภาพแวดล้อม: prod build (backend `medusa build`/`medusa start`, storefront `next build`/`next start`), commit `3637dec`, viewport 1280 และ 375, Stripe test mode
หา element ด้วย `data-testid` และตรวจข้อความไทยด้วย regex `[฀-๿]`
Playwright report/trace ฉบับเต็มดูใน CI artifact ของ PR #276 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-135 cart t-shirt ไม่มีที่อยู่: เปิด `?step=payment` และ `?step=review` → `?step=address` ฟอร์มที่อยู่เปิด ไม่มี `submit-order-button` ไม่มีขั้น delivery ไม่มี horizontal scroll navigation ≤ 2 (ไม่วน) จากนั้นกรอกที่อยู่ → delivery Standard → manual payment → สั่งซื้อสำเร็จ (order มีที่อยู่และ Standard จริง ยิง complete 1 ครั้ง) — 1280/375 | pass | qa-01-tshirt-review-to-address-1280.png, qa-02-tshirt-review-to-address-375.png, qa-03-order-confirmed-375.png |
| AC-135 cart digital-only ไม่มีที่อยู่: เปิด `?step=payment`/`review` → `?step=address` ฟอร์มที่อยู่ใบเสร็จ (`billing-first-name-input`) เปิด ไม่มี `delivery-heading` กรอกแล้วไป `step=payment` ทันที — 1280/375 | pass | qa-04-digital-only-review-to-address-1280.png |
| AC-135 / AC-129 regression: cart มีที่อยู่แต่ค้าง Digital → `?step=delivery` ปุ่ม submit disabled ไม่มี option Digital — 1280/375 | pass | ผล test ของ qa + e2e `core-32-shipping-profile-filter` |
| AC-135 regression: cart ครบ → อยู่ที่ `?step=payment`/`review` ได้ ไม่ถูกพาไป address/delivery ไม่วน — 1280/375 | pass | ผล test ของ qa + e2e `core-41` |
| Stripe test `/api/payment-return?redirect_status=failed` บน cart ครบ → `/th/checkout?step=payment` คง `payment_intent`, `payment_intent_client_secret`, `redirect_status=failed` | pass | qa-05-stripe-return-failed-step-payment-1280.png |
| Regression e2e: `core-41-checkout-first-step`, `core-32-shipping-profile-filter`, `ev-7c-digital-only-checkout`, `thai-ui-checkout`, `core-4e`/`4f`/`4g`/`4h` | pass 14/14 | ผลรัน chromium |
| Unit: Playwright unit project 54/54 และ vitest `ev-7c-digital-only-checkout.test.ts` 29/29 | pass | ผลรัน |

## Negative / edge case (cart t-shirt ไม่มีที่อยู่ ยกเว้นที่ระบุ)
- `?step=review&x=1` → `?step=address` (query อื่นหาย ซึ่งยอมรับได้)
- `/checkout?step=review` ที่ไม่มี country prefix → middleware เติม `/th` แล้วได้ `/th/checkout?step=address`
- `?step=payment&step=review` (step ซ้ำ), `?step=REVIEW`, `?step=foo` และ `/th/checkout` ที่ไม่มี step → ไม่ redirect (200) ทุก section ปิด ไม่มีปุ่มสั่งซื้อที่กดได้ (เป็นพฤติกรรมเดิมของ starter)
- ทุกเคสไม่มี error page ไม่มี redirect วน (navigation ≤ 2) และไม่มีการยิง `/complete`
- Stripe return failed บน cart ที่ไม่มีที่อยู่ → `/api/payment-return` พาไป `step=payment` แล้ว CORE-41 พาต่อไป `?step=address` ฟอร์มเปิด query ของ Stripe หายไป ซึ่งถูกตามกฎข้อ 99 และกรณีนี้ไม่เกิดใน flow จริง

## Defect
ไม่พบ

## Observation (นอก scope)
1. เปิด `?step=delivery` ตรงๆ ตอนยังไม่มีที่อยู่: ไม่ redirect ขั้น delivery เปิดอยู่ ลูกค้าเลือก Standard แล้วกดไปต่อได้ (backend ยอมรับ shipping method บน cart ที่ไม่มีที่อยู่) จากนั้น `step=payment` ถูก CORE-41 พาไป `?step=address` ลูกค้าจึงไม่ค้าง แต่ลำดับขั้นไม่ตรง ถ้าต้องการให้ตรงควรขยายกฎข้อ 99 ให้ครอบคลุม `step=delivery` (spec รอบ 19 บันทึกว่ายอมรับใน v1)
2. `/th/checkout` ที่ไม่มี `step` หรือมี `step` ที่ไม่รู้จัก แสดงหน้าที่ทุก section ปิด เป็นพฤติกรรมเดิมก่อน PR นี้ เสนอให้ใช้ `checkoutStep` เป็นค่า default ได้
3. ตัวเลือกประเทศในฟอร์มที่อยู่จัดส่งแสดง "Thailand" (ชื่อประเทศจาก Medusa) และสรุปที่อยู่ที่ seed ผ่าน API เป็นอักษรละติน เป็นข้อมูลไม่ใช่ข้อความ UI

## สรุป
PR #276 ทำได้ตามกฎข้อ 99 และ AC-135 ครบทั้ง 1280 และ 375: เปิด payment/review ตรงๆ ไปขั้นแรกที่ยังไม่เสร็จ (address หรือ delivery), cart digital-only ไม่มีขั้น delivery, cart ที่ครบแล้วไม่ถูก redirect และไม่วน, Stripe failed return ยังคง query ไว้, AC-129 และ regression ผ่านทั้งหมด ไม่มี defect
