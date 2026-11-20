# ADR-024 group buy: กันการชำระหลังสิทธิ์ถูกยกเลิก + ยกเลิก PaymentIntent ที่ค้าง + คืนเงินอัตโนมัติ

สถานะ: **proposed** (planner รอบ 40, 2026-11-21 — ทิศทางมาจากคำตัดสิน owner 2026-11-21 "กัน + คืนเงินอัตโนมัติ"; รายละเอียดทางเทคนิครออนุมัติ)
เกี่ยวข้อง: ADR-015 (guard `PAYMENT_ALREADY_COMPLETED`, ตาข่าย D), ADR-016 (GB-8), spec 04 กฎข้อ 9, 22, 25, 26 และ Q13 (เดิม = ก manual), spec 06 กฎข้อ 4, 7, 9;
task GB-20, GB-21, GB-22 (spec 04 รอบ 40); แทนที่ส่วน "ไม่ refund อัตโนมัติ" ของ spec 04 กฎข้อ 25/26 และ Q13 **เฉพาะกรณีเงินเข้าหลัง membership ถูกยกเลิก**

## บริบท
- การทดสอบ manual เฟส 6 (GB-BUG-1, 2026-11-20): ลูกค้าเปิดหน้า `/th/account/orders/<id>/pay` ค้างไว้ข้าม `pay_deadline_at` แล้วกดจ่าย → ถูกตัด ฿710 ไม่มี order
  มีแค่ log `GROUP_BUY_PAID_WITHOUT_ORDER` (+ อีเมล ops ถ้าตั้ง `OPS_ALERT_EMAIL`) และหน้า pay ขึ้น "ชำระเงินเรียบร้อยแล้ว"
- สาเหตุในโค้ด (develop `87cb20df`):
  1. `POST /store/payment-collections/:id/payment-sessions` มีแค่ auth + ownership (ADR-013) + `guardPaidStripeSession` (ADR-015) — **ไม่ตรวจสถานะ membership/deadline** (`apps/backend/src/api/middlewares.ts:53-57`)
  2. job หมดเวลาชำระเรียก `cancelOrderWorkflow` ของ draft order แต่ payment collection ยัง `not_paid` และ session/PaymentIntent เดิม**ไม่ถูกยกเลิก** —
     Medusa 2.22.1 `cancelPaymentCollectionWorkflow` เปลี่ยนแค่สถานะ collection + cancel payment ที่ authorize แล้ว **ไม่ลบ session** (`core-flows/dist/payment-collection/workflows/cancel-payment-collection.js:29-65`)
     ส่วน `deletePaymentSessionsWorkflow` (`.../delete-payment-sessions.js`) ลบ session ผ่าน provider ซึ่ง Stripe provider cancel PI
  3. subscriber `group-buy-payment-captured.ts` ตัดสิน `orphan` (`membership-payment.ts:13-24`) แล้วส่งแค่ alert ตามกฎข้อ 25 (owner Q13 = ก, 2026-10-28)
- `refundPaymentWorkflow` ของ Medusa refund payment ของ draft/order ที่ยกเลิกแล้วได้ (spec 04 ตาราง "สิ่งที่ Medusa มีให้อยู่แล้ว", re-review #185)

## ทางเลือก
1. **คงแบบ manual** (กฎข้อ 25 เดิม) — ไม่มีโค้ดเงินเพิ่ม แต่ช่อง (1)(2) ทำให้เกิดซ้ำได้ง่าย ลูกค้ารอ ops และหน้าเว็บหลอกว่าจ่ายสำเร็จ — owner ไม่เลือก
2. **กันอย่างเดียว** (guard ที่ route สร้าง session) — ปิดช่องหลัก แต่ PI ที่สร้างก่อน deadline (QR พร้อมเพย์ที่สแกนค้าง, หน้าบัตรที่กรอกไว้) ยังจ่ายได้หลังยกเลิก → ยังต้อง refund มือ
3. **กัน + ยกเลิก PI ตอนยกเลิกสิทธิ์ + คืนเงินอัตโนมัติเป็นตาข่ายสุดท้าย** — ครอบทั้งสามช่อง เงินผ่าน workflow ของ Medusa เท่านั้น
4. เปลี่ยนเป็นชำระตอน join (pre-auth) — ขัด ADR-004 (auth-hold หมดอายุ, refund มากกว่า) ไม่พิจารณา

## การตัดสินใจ (เสนอ: ทางเลือก 3)
(a) **guard** — middleware ใหม่บน `POST /store/payment-collections/:id/payment-sessions` ลงทะเบียน**หลัง** ownership (ADR-013) และ**ก่อน** `guardPaidStripeSession`:
    อ่านด้วย `query.graph` ว่า collection ผูก order ที่มี `metadata.group_buy_membership_id` หรือไม่ (ไม่ผูก/เป็น collection ของ cart → `next()` ทันที);
    ถ้าผูก: membership ต้อง `awaiting_payment` **และ** `now < group.pay_deadline_at` **และ** collection ไม่ `canceled` — ไม่เช่นนั้น throw
    `MedusaError(NOT_ALLOWED, …, "GB_PAYMENT_CLOSED")` → **400** `{ type: "not_allowed", code: "GB_PAYMENT_CLOSED", message }` (400 ของ Medusa คง `code` — builder ยืนยันใน integration
    ถ้า handler ทับ code ให้เพิ่มใน allow-list ของ PROMO-2) ไม่เรียก provider, ไม่สร้าง/ลบ session
(b) **ยกเลิก PI ที่ค้างเมื่อสิทธิ์ถูกยกเลิก** — ทุกเส้นทางที่ทำให้ membership ที่มี payment collection เป็น `cancelled` (job หมดเวลาชำระ; `failGroupWorkflow`/leave ไม่มี collection จึงไม่เกี่ยว
    แต่ helper ต้องเป็น noop เมื่อไม่มี): หลัง `cancelOrderWorkflow` เรียก `deletePaymentSessionsWorkflow` ของ Medusa กับ session ที่ไม่ใช่ `authorized`/`captured`
    แล้ว `cancelPaymentCollectionWorkflow` — **best-effort**: error (เช่น Stripe ปฏิเสธ cancel เพราะ PI `succeeded` แล้ว) → `logger.warn` บรรทัดเดียวขึ้นต้น
    `GROUP_BUY_SESSION_CANCEL_FAILED` แล้วไปต่อ (ไม่ทำให้การยกเลิก membership ล้ม — ข้อ (c) เป็นตาข่าย); ไม่เรียก Stripe SDK ตรง (spec 06 กฎข้อ 4)
(c) **คืนเงินอัตโนมัติ** — ใน subscriber `payment.captured` เมื่อ `paymentCapturedAction` = `orphan` **และ** membership `cancelled` (อ่านสถานะใหม่ตามกฎข้อ 25a):
    เรียก `refundPaymentWorkflow` ของ Medusa เต็มยอดที่ capture (คำนวณด้วย `MathBN` จาก `raw_*` = captured − refunded แล้ว) `note: "Refunded: group buy membership cancelled"`
    ภายใต้ lock ต่อ payment (`group_buy:refund:<payment_id>`) และ idempotent (ยอดคงเหลือ ≤ 0 → noop + log info) แล้วส่ง alert เดิม
    `GROUP_BUY_PAID_WITHOUT_ORDER` ที่ระบุผลการคืนเงิน (`refunded` / `refund_failed` + error) — refund ล้ม → alert ระดับ error ให้ ops ทำตาม runbook เดิม;
    กรณี `convert_failed` (membership ยัง `awaiting_payment`) **คงเดิม** (manual — สต็อกหมดต้องมีคนตัดสิน)
(d) storefront แสดงสถานะยกเลิก/คืนเงินจาก GB-8 แทน "ชำระแล้ว" เมื่อ membership `cancelled` (spec 04 กฎข้อ 45)

## ผลที่ตามมา
- ปิด GB-BUG-1 ทั้งทาง API, ทาง PI ค้าง และทางเงินที่เข้ามาแล้ว ลูกค้าได้เงินคืนโดยไม่ต้องรอ ops; ops ยังได้อีเมลทุกครั้ง
- เพิ่มเส้นทางเงินอัตโนมัติหนึ่งเส้น (ต้องกันซ้ำด้วย lock + ยอดคงเหลือ; test ส่ง event ซ้ำ/พร้อมกัน)
- `middlewares.ts` มี middleware บน route เดียวกันสองตัว (GB guard → `guardPaidStripeSession`) + ตัวของ ADR-025 — ลำดับต้องคงที่และมี test
- refund อัตโนมัติไม่ใช้กับ order ที่มี order change ค้าง (spec 06 กฎข้อ 10 / B-1) — draft order ที่ยกเลิกไม่มี order change จึงไม่ชน
- ความเสี่ยงที่เหลือ: Stripe ล่มตอน refund → alert error + runbook (เหมือนเดิม)
