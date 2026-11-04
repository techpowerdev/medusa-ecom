# QA CORE-35 — PR #266 (spec 01 กฎข้อ 93, AC-129)

สภาพแวดล้อม: prod build (backend `medusa build` แล้ว `medusa start`, storefront `next build && next start`) ที่ commit `3e19dfe`, viewport 1280 และ 375,
manual payment (`pp_system_default`), Stripe test mode เท่านั้น, ข้อความไทยตรวจด้วย regex `[฀-๿]`, หา element ด้วย `data-testid`
เทียบ baseline: storefront ของ `develop` (build แยก) ต่อ backend ตัวเดียวกัน
Playwright report และ trace ฉบับเต็ม: CI artifact ของ job `storefront-e2e` ใน PR #266 (เก็บ 14 วัน)

## ผลตาม AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-129: cart t-shirt ที่ค้าง Digital delivery (ตั้งผ่าน `POST /store/carts/:id/shipping-methods`) เปิด `?step=payment` และ `?step=review` ตรงๆ → พาไป `?step=delivery`, ไม่มี radio ถูกเลือก, `submit-delivery-option-button` disabled, ไม่มี `submit-order-button`, ไม่มี POST `/complete`, ไม่มี horizontal scroll (1280) | pass | qa-01-step-payment-redirected-delivery-1280.png |
| AC-129 (375): เหมือนข้อบน ที่ 375px | pass | qa-02-step-payment-redirected-delivery-375.png |
| AC-129: เลือก Standard → payment (manual) → review → `submit-order-button` ภาษาไทยและกดได้ (375) | pass | qa-03-standard-review-order-button-375.png |
| AC-129: สั่งซื้อสำเร็จ ได้ order ที่ shipping method เป็น Standard ตัวเดียว (1280; ที่ 375 ผ่านเหมือนกันโดย test assert) | pass | qa-04-order-confirmed-1280.png |
| Regression EV-7c: cart ดิจิทัลล้วน เปิด `?step=payment`/`review` ตรงๆ → ไม่ถูกพาไป delivery, ไม่มีขั้น delivery, ไปถึงปุ่มยืนยันได้ | pass | qa-05-digital-only-review-no-delivery-1280.png |
| Regression: cart ที่เลือก Standard แล้ว เปิด `?step=payment` ตรงๆ → อยู่ที่ payment ไม่ redirect วน (navigation ≤ 2 ครั้ง ไม่เคยผ่าน `step=delivery`), `?step=review` ก็ไม่ redirect (1280/375) | pass | ผล test (qa spec) |
| Stripe test: `/api/payment-return` (PaymentIntent จริง, `redirect_status=failed`) บน cart Standard → `/th/checkout?step=payment&payment_intent…&redirect_status=failed` | pass | ผล test (qa spec) |
| e2e ของ builder `core-32-shipping-profile-filter` › CORE-35 › AC-129 | pass | ผล test |

ยืนยันบั๊กบน develop: test AC-129 เดียวกันล้มบน develop (URL ค้างที่ `?step=payment`) แต่ผ่านบน PR

## Negative / edge
- Stripe return บน cart ที่ค้าง Digital → ถูกพาไป `?step=delivery` ปุ่ม disabled (ไม่ไปถึง complete) ตรงตามกฎข้อ 93 (develop: ค้างที่ payment)
- `?step=payment&step=review` (step ซ้ำเป็น array) → ไม่ redirect แต่ไม่มี `submit-order-button` ที่กดได้; `?step=REVIEW`, `?step=foo` → 200 ไม่มีปุ่มสั่งซื้อ
- `?step=review&x=1` → redirect ไป `?step=delivery` (query อื่นหาย ยอมรับได้)
- หน้าตะกร้า `checkout-button` บน cart ค้าง Digital → ไปจบที่ `?step=delivery` (develop: ไป `?step=payment`)
- ตลอด flow ไม่มี POST `/store/carts/:id/complete` ก่อนผู้ใช้กดยืนยัน และกดยืนยันแล้วยิง complete แค่ 1 ครั้ง

## Defect
ไม่พบ

## Observation
1. เปิด `?step=payment`/`review` ตอนยังไม่มีที่อยู่: PR → redirect ไป `?step=delivery` แต่ฟอร์มที่อยู่ไม่เปิด; develop → ค้างที่ `?step=payment`/`review` โดยไม่มีขั้นไหนเปิด PR ดีขึ้นกว่าเดิม แต่ปลายทางที่ถูกควรเป็น `?step=address` → เสนอ follow-up (นอกขอบเขตกฎข้อ 93; reviewer เห็นตรงกัน)
2. ถ้าเปลี่ยน shipping method จากนอก storefront (ยิง API ตรง) ระหว่างเปิดหน้า payment แล้ว reload → ยังอยู่ที่ payment เพราะ `retrieveCart` ใช้ `force-cache` + tag เป็นพฤติกรรมเดิมของ data cache ไม่ใช่ flow ของผู้ใช้จริง
3. ขั้น delivery ที่ยังไม่เสร็จ (cart ค้าง Digital): สรุปยอดด้านขวาแสดง "ค่าจัดส่ง ฿0" จาก method ที่ค้าง (qa-01) — ยอมรับใน v1 ตาม spec รอบ 18
4. ที่ 375px สรุปที่อยู่ 3 คอลัมน์ทับกัน (qa-02) และสรุปการชำระเงินตัดคำแคบ (qa-03) เป็นปัญหาเดิม — สรุปที่อยู่แก้ใน CORE-38 (#267)
5. Regression ในเครื่องผ่าน 10/13 ตัวที่ล้มคือ `core-4e` AC-91, `ev-7c` AC-37/AC-3 และ `thai-ui-checkout` AC-48/75 ซึ่งล้มเหมือนกันบน develop build ในเครื่องเดียวกัน (เครื่องโหลดสูง) จึงไม่ใช่ regression จาก PR นี้ — ยืนยันด้วย CI `storefront-e2e`

## สรุป
AC-129 ผ่านทั้ง 1280 และ 375 บน prod build บั๊กเดิมทำซ้ำได้บน develop และหายไปบน PR EV-7c, Stripe return และ cart Standard ไม่ถดถอย ไม่พบ defect
