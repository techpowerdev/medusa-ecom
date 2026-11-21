# ADR-025 แยก payment collection ใหม่ให้ cart ที่ถูกคืนเงินอัตโนมัติก่อนชำระซ้ำ

สถานะ: **accepted** (owner อนุมัติ 2026-11-21 — ทางเลือก 2; spec 06 Q10)
เกี่ยวข้อง: ADR-013, ADR-015 (+ ภาคผนวก 2), spec 06 กฎข้อ 7, 8, 11 (รอบ 40), task PAY-9; spec 03 (flash เกินสิทธิ์), spec 02 (แย่ง voucher ใบสุดท้าย)

## บริบท
- การทดสอบ manual เฟส 5 (O-2, order #69): checkout ล้ม**หลัง** capture (เช่น flash เกินสิทธิ์ `FLASH_LIMIT_EXCEEDED`, e-voucher หมด) → Medusa 2.22.1
  `compensatePaymentIfNeededStep` (`core-flows/dist/cart/steps/compensate-payment-if-needed.js:67-83`) เรียก `refundPaymentAndRecreatePaymentSessionWorkflow`
  = `refundPaymentsWorkflow` (คืนเงินสำเร็จ) แล้ว `createPaymentSessionsWorkflow` ด้วย `data` ของ session เดิม → Stripe ตอบ `Invalid string billing_details`
  → log `Error was thrown trying to refund payment … [object Object]` ทั้งที่คืนเงินแล้ว
- payment ที่ถูกคืนยัง**อยู่ใน payment collection เดิมของ cart** ลูกค้าเลือกวิธีชำระใหม่ใน cart เดิมแล้วจ่ายสำเร็จ → `completeCartWorkflow` ผูก collection นี้กับ order
  → order มี payment สองรายการ (คืนแล้ว + capture ใหม่) → admin แสดง `payment_status = refunded` ทั้งที่ลูกค้าจ่ายแล้วไม่เคยถูกคืน
- `refundPaymentsWorkflow` **ไม่ emit event** (มีแค่ `refundPaymentWorkflow` ที่ emit `payment.refunded` — `payment/workflows/refund-payment.js:188`)
  จึงดักตอนคืนเงินด้วย subscriber ไม่ได้; และ event ที่ emit ระหว่าง compensation ของ workflow ที่ล้มไม่ถูกปล่อย
- storefront `initiatePaymentSession` (`apps/storefront/src/lib/data/cart.ts:313-325`) สร้าง collection ใหม่เองด้วย `POST /store/payment-collections` เมื่อ cart ไม่มี collection

## ทางเลือก
1. **storefront สร้าง cart ใหม่** (คัดลอก item/ที่อยู่) เมื่อรู้ว่าถูกคืนเงิน — ไม่แตะ backend แต่ client อื่น (API) ยังเกิดได้ ลูกค้าต้องเลือกวิธีส่งใหม่ และพึ่งสัญญาณจาก UI
2. **backend ตรวจตอนสร้าง session**: middleware บน `POST /store/payment-collections/:id/payment-sessions` เมื่อ collection เป็นของ **cart** (link `cart_payment_collection`)
   ที่ยังไม่มี order (link `order_cart` ว่าง) และมี payment ที่ capture แล้วถูกคืนครบ (`refunded ≥ captured` ด้วย `MathBN`) → workflow เล็ก dismiss link cart ↔ collection
   (compensation: สร้าง link คืน) แล้วตอบ **409** `PAYMENT_COLLECTION_RESET`; storefront ได้ code นี้ → อ่าน cart ใหม่แล้วเรียก `initiatePaymentSession` ซ้ำ **1 ครั้ง**
   (ไม่มี collection → สร้างใหม่ด้วย route ของ Medusa) — collection เก่ายังอยู่ใน Payment module เป็นหลักฐาน (ไม่ลบ)
3. แก้การคำนวณ `payment_status` ของ order — เป็นของ Medusa core (ห้าม patch) ไม่พิจารณา
4. hook `completeCartWorkflow.hooks.validate` ปฏิเสธ cart ที่ collection มี payment ที่คืนแล้ว — ลูกค้าติดตาย ต้องมีทางออกอยู่ดี ไม่พิจารณา

## การตัดสินใจ (เสนอ: ทางเลือก 2)
เหตุผล: ตัดสินที่ backend จึงครอบทุก client; ใช้ link/route ของ Medusa (`cart_payment_collection`, `POST /store/payment-collections`) ไม่สร้าง model/route ใหม่;
cart เดิม (ที่อยู่ วิธีส่ง โค้ดส่วนลด) ยังอยู่; ไม่พึ่ง event ที่ Medusa ไม่ emit
- ลำดับ middleware บน route นี้: auth → ownership (ADR-013) → GB guard (ADR-024) → **reset ของ ADR นี้** → `guardPaidStripeSession` (ADR-015)
  (reset ต้องมาก่อน guard ของ ADR-015 เพราะ session/payment ที่คืนแล้วอาจทำให้ guard ตอบ 409 `PAYMENT_ALREADY_COMPLETED` ผิด — builder ยืนยันด้วย integration)
- lock key = `cart_id` (เดียวกับ ADR-015) กันสอง request reset ซ้อน; request ที่สองเห็นว่า link หายแล้ว → 409 code เดิม (idempotent)
- ไม่ refund/ไม่เรียก provider ใน middleware

## ผลที่ตามมา
- order ที่ได้หลังจ่ายซ้ำมีเฉพาะ collection ใหม่ → `payment_status` ถูกต้อง
- storefront ต้องจัดการ code ใหม่ 1 จุด (helper เดียวของ CORE-4i) และ e2e ต้องจำลอง "คืนเงินแล้วจ่ายซ้ำ"
- ถ้า bump Medusa แล้ว `compensatePaymentIfNeededStep` เปลี่ยนพฤติกรรม (เช่นสร้าง collection ใหม่เอง) → ทบทวน ADR นี้ (เพิ่มในเช็กลิสต์ bump ของ spec 07)
- รายงาน upstream (refund แล้ว recreate session ด้วย `data` เดิม + payment ที่คืนค้างใน collection) — **owner อนุมัติให้เปิด issue 2026-11-21** (session หลักเปิด; ร่างอยู่ใน PR ของ OPS-32)

## ภาคผนวก 2026-11-21 (planner รอบ 41 — PAY-9 D-1, ไม่เปลี่ยนการตัดสินใจ)
- middleware ของ ADR นี้ reset เฉพาะ collection ที่ "มี payment ที่คืนครบ" — ปัจจุบันเป็นจริงเพราะ recreate session ของ Medusa **ล้ม** (#17948) collection จึงไม่มี session ใหม่
- ถ้า upstream แก้ medusajs/medusa#17948 แล้ว recreate สำเร็จ: collection เดิมได้ session ใหม่ที่ไม่มี payment → storefront ไม่เรียก `POST .../payment-sessions` ใหม่ → middleware ไม่ทำงาน → จ่ายใหม่ใน collection เดิม = O-2 (#69) กลับมา
- กัน: characterization test `apps/backend/integration-tests/http/payment-collection-reset.spec.ts` (~`:256`) ล้มเมื่อพฤติกรรมเปลี่ยน + เช็กลิสต์ bump ของ spec 07 ข้อ 14 — PR ที่ bump ต้องทบทวน ADR นี้ (เช่นย้ายการ reset ไปตอน complete) ก่อน merge
- collection เดิมที่ถูกถอด link ไม่มีเจ้าของ (ไม่ผูก cart/order) — หลักฐานการคืนเงินดูจาก payment/refund (`docs/ops/production.md` หัวข้อ OPS-32)
