# QA PAY-9 (PR #445) — spec 06 กฎข้อ 11, AC-22
สภาพแวดล้อม: prod build ของ c735550e (backend LOG_LEVEL=http, storefront `next start`), DB แยกของ qa, env ปลอม ไม่มี Stripe key, provider `pp_system_default`
จำลอง O-2 ด้วยสคริปต์ `medusa exec` ของ qa: authorize → capture → refund ผ่าน workflow ของ Medusa (`refundPaymentAndRecreatePaymentSessionWorkflow` ตัวที่ `compensatePaymentIfNeededStep` เรียกจริง)
spec ของ qa 10/10 passed (อัดวิดีโอ) · Playwright report/trace ฉบับเต็มเป็น CI artifact

| AC / กรณี | Result | Evidence |
|---|---|---|
| AC-22a UI จริง: cart ที่ collection ถูก capture แล้วคืนครบและ session ถูกลบ (สภาพ O-2) → เลือกวิธีชำระ → POST payment-sessions 409 (collection เดิม) แล้ว 200 (collection ใหม่) ครั้งเดียว → link ชี้ collection ใหม่, collection เดิมคง refund 1 รายการ → สั่งซื้อสำเร็จ → admin `payment_status=authorized` (ไม่ใช่ refunded) มี collection 1 ชุด → capture แล้ว `captured` | pass | qa445-01-checkout-review-after-reset.png, qa445-02-order-confirmed.png, qa445-03-account-order-details.png |
| AC-22a ยิงพร้อมกัน 2 request | pass | 409 ทั้งคู่ ไม่มี 5xx, collection ใหม่ชุดเดียว |
| AC-22b captured แต่ยังไม่คืน / collection ของ order group buy ที่คืนครบ | pass | ไม่ reset |
| AC-22c e2e Stripe test mode (บัตร 4242) | pass — ยืนยันจาก CI (ไม่ได้ทดสอบในเครื่อง) | CI run 44872470524 storefront-e2e: `✓ e2e/pay-9-refunded-cart-repay.spec.ts:116:5 › AC-22c` (16.4s) รันจริงไม่ skip |
| reg: คืนบางส่วน / cart ที่มี order แล้ว / payment ที่ถูก cancel | pass | ไม่ reset |
| reg: checkout ปกติด้วย UI | pass | POST payment-sessions 200 ไม่มี 409, qa445-04-normal-checkout-confirmed.png |
| reg: หน้าจ่าย group buy (`payments-order-pay` + `core-19b`) | pass | 15 passed, skip 6 (Stripe UI) |
| edge: ลูกค้าอื่น / ไม่ login / ยิงซ้ำ collection เดิมหลังถูกถอด | pass | 404 / 401 / 404 |
| edge D-1 (นอก AC): compensation recreate session สำเร็จ → storefront ไม่เรียก payment-sessions → order ขึ้น refunded | ข้อจำกัดที่รู้ (ใน 2.22.1 + Stripe recreate ล้มเสมอ จึงไม่เกิดจริง; ต้องทบทวนเมื่อ medusajs/medusa#17948 ถูกแก้) | qa445-05-edge-recreate-refunded.png |
