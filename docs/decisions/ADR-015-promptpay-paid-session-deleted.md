# ADR-015 PromptPay: Medusa ลบ payment session ได้แม้ PaymentIntent ชำระแล้ว (race ตอน QR หมดอายุ)

สถานะ: proposed (builder PAY-5, 2026-10-26) — รอ owner ตัดสินใจ ห้ามเขียน reconciliation/guard ใดๆ ก่อน ADR นี้ accepted
เกี่ยวข้อง: ADR-007 (ไม่มี custom payment code), spec 06 กฎข้อ 3, 4, 7, AC-11, AC-12, task PAY-5

## บริบท
spec 06 กฎข้อ 7 ให้ PAY-5 ยืนยันด้วย test ว่าเมื่อลูกค้าชำระ PromptPay สำเร็จในช่วงระหว่าง storefront อ่านสถานะ PI (ยังไม่ชำระ) กับการสร้าง
session ใหม่ตอน QR หมดอายุ ผลเป็นกรณี (a) (การลบ session เดิมล้ม → poll ต่อได้) หรือ (b) (Medusa ลบ session/ทิ้ง payment ได้)

**ผลที่พบ: กรณี (b)** — Medusa 2.22.1 + `@medusajs/payment-stripe` 2.22.1, Stripe test mode จริง + webhook ผ่าน `stripe listen`
(e2e `apps/storefront/e2e/payments-promptpay-race.spec.ts`, evidence `docs/evidence/payments/PAY-5-tests.txt`):
1. PI PromptPay `requires_action` → authorize test payment → PI `succeeded`
2. ทันทีเรียก `POST /store/payment-collections/:id/payment-sessions` (provider PromptPay เดิม) → **HTTP 200**, ได้ session + PI ใหม่
3. webhook `payment_intent.succeeded` ของ PI เดิมถึง backend (200) แต่ `processPaymentWorkflow` ล้มด้วย
   `PaymentSession with id: payses_… was not found` → ไม่มี payment, cart ไม่ถูก complete
4. หลัง 60 วินาที: PI `succeeded` (เงินถูกตัด) แต่ไม่มี order ที่อ้าง PI นั้น และไม่มีการแก้ไขอัตโนมัติ — Stripe ได้ 200 จึงไม่ส่ง webhook ซ้ำ

สาเหตุจากโค้ดของ Medusa (ไม่ได้แก้):
- `createPaymentSessionsWorkflow` ลบ session เดิมทั้งหมดของ collection ขนานกับการสร้าง session ใหม่ (ไม่รองรับ split payment)
- `StripeBase.deletePayment` เรียก `paymentIntents.cancel` และ **ข้าม error เมื่อ PI เป็น `succeeded`** (คอมเมนต์ใน provider:
  "A succeeded PaymentIntent can't be canceled, but its session can still be deleted") → session ถูกลบจาก DB
- webhook อ้าง session ด้วย `metadata.session_id` เท่านั้น เมื่อ session ถูกลบจึงผูก PI กับ cart ไม่ได้

ข้อสังเกตที่ยังไม่ได้ทดสอบ: PI `processing` — provider ไม่ข้าม error นี้ การลบ session น่าจะล้ม (เข้ากรณี a) แต่ PromptPay ใน test mode
ไม่ผ่านสถานะนี้; กรณี webhook complete cart **ก่อน** การสร้าง session ใหม่ ยังไม่ได้ทดสอบ

ช่วงเวลาเสี่ยงใน storefront (PAY-2) คือระหว่าง `retrievePaymentIntent` กับ `initiatePaymentSession` ตอนครบ 10 นาที (ระดับร้อยมิลลิวินาที–
วินาที) โอกาสเกิดต่ำ แต่ผลคือเงินลูกค้าถูกตัดโดยไม่มี order ซึ่งกฎข้อ 7 ห้าม

## ทางเลือก
A. **guard ฝั่ง backend ก่อนลบ session**: middleware/route ของร้านบน `POST /store/payment-collections/:id/payment-sessions` ตรวจ session
   PromptPay เดิมผ่าน payment module/provider (ไม่เรียก Stripe ตรง) ถ้า PI ชำระแล้วตอบ 409 → storefront แสดง `promptpay-awaiting-order`
   และ poll ต่อ (AC-12) — ปิดช่องจาก storefront ได้เกือบหมด แต่ยังเหลือ race ระหว่าง guard กับการลบ (สั้นลงมาก) และเป็น custom payment
   code (ขัด ADR-007 บางส่วน) payment module ไม่มี method สาธารณะสำหรับอ่านสถานะจาก provider โดยตรง ต้องออกแบบเพิ่ม
B. **reconciliation**: subscriber/scheduled job หา PI `succeeded` ที่ไม่มี payment ใน Medusa แล้ว (1) สร้าง session/complete cart ใหม่ หรือ
   (2) refund อัตโนมัติ — ปิดช่องได้ครบ แต่เป็น custom payment code มากที่สุด และ refund นอก `refundPaymentWorkflow` ขัดกฎข้อ 4
   (ไม่มี payment ใน Medusa ให้ refund ผ่าน workflow)
C. **ไม่ลบ session ฝั่ง storefront**: ตอนหมดอายุไม่สร้าง session ใหม่ทันที ให้ผู้ใช้กด "ลองอีกครั้ง" เอง (ยังลบ session ตอนกด) — ลดโอกาส
   แต่ไม่ปิดช่อง (ลูกค้าอาจจ่ายจาก QR เก่าที่ถ่ายไว้)
D. **ยอมรับความเสี่ยง + ขั้นตอนปฏิบัติการ**: alert เมื่อ log มี `PaymentSession with id … was not found` จาก webhook แล้ว ops refund ผ่าน
   Stripe dashboard ตาม runbook (spec 07) — ไม่มีโค้ด payment เพิ่ม แต่ขัดคำว่า "ไม่มีการแก้ไขอัตโนมัติ" ของกฎข้อ 7
E. **แก้ที่ต้นทาง**: เปิด issue/PR ที่ Medusa ให้ `deletePayment` ไม่ข้าม `succeeded` (หรือ webhook หา cart จาก PI ได้) แล้ว bump เวอร์ชัน
   ผ่าน ADR — ถูกที่สุดในระยะยาว แต่ไม่รู้กำหนดเวลา

## ข้อเสนอของ builder (ยังไม่ใช่การตัดสินใจ)
D ทันที (ไม่มีโค้ด) + E ระยะยาว และพิจารณา A ถ้า owner ต้องการลดช่องฝั่ง storefront ก่อน E — ไม่แนะนำ B เพราะขัด ADR-007/กฎข้อ 4 มากที่สุด
กฎข้อ 7 ต้องปรับถ้อยคำตามทางที่เลือก (planner)

## ผลที่ตามมา (ระหว่าง proposed)
- test AC-11 อยู่ในสถานะ `test.fixme` อ้าง ADR นี้ (รันยืนยันในเครื่องได้ด้วย `E2E_RUN_KNOWN_ISSUES=1`) AC-11/AC-12 ยังไม่ผ่าน
- storefront ไม่เปลี่ยนพฤติกรรม (PAY-5 ไม่แก้ `promptpay-payment` ในกรณี b)
