# QA — CORE-82 (PR #514): storefront ตัดสิน error กลุ่ม checkout/cart/payment ด้วย code

- Spec: `docs/spec/01-core-medusa.md` กฎข้อ 140, AC-181 (b) กลุ่ม checkout/cart/payment; ADR-028
- Commit ที่ตรวจ: `e7b520588c605d7ec4ab7a01d5002051dd21fb9d`
- สภาพแวดล้อม: prod build — backend `NODE_ENV=production medusa build` + `medusa start`, storefront `next build` + `next start`; payment `pp_system_default`; ไม่มี Stripe จริง → กรณีที่ต้องตัดเงินด้วยบัตรดูผล CI
- Test ของ qa: viewport 375×812 ทุกกรณี, data ผ่าน API, สองแท็บจริง, ดับเบิลคลิก — 7 passed, `--repeat-each=3` 21 passed; ตรวจข้อความ = ข้อความไทยของ code ตรงตัว, มีอักษรไทย, ไม่มี `[A-Za-z]{4,}`, ทั้งหน้าไม่มีข้อความอังกฤษของ backend
- e2e เดิม (core-48, core-52, core-76, core-69, core-40, core-4j, core-19f, flash-sale-fs15, flash-sale-storefront, fs-21, fs-22, pay-9, pay-12, payments-order-pay) บน prod build: 56 passed, 8 skipped (Stripe จริง — CI)

| AC | Result | Evidence |
|----|--------|----------|
| AC-181 (b) ตะกร้าแก้จำนวนเกิน stock → "สินค้ามีไม่พอ…" จำนวนคงเดิม | pass | qa514-01-cart-insufficient-375.png |
| AC-181 (b) review manual ชิ้นสุดท้ายหมด (ดับเบิลคลิก) → ข้อความลดจำนวน ไม่มี "คืนเงิน" ไม่เกิด order | pass | qa514-02-review-last-piece-375.png |
| AC-181 (b) flash ขายหมด (manual) → ข้อความ FLASH_SOLD_OUT | pass | qa514-03-review-flash-sold-out-375.png |
| AC-181 (b) flash ขายหมด (บัตร) → checkout-refunded-notice | CI (Stripe จริง) | CI artifact storefront-e2e |
| AC-181 (b) โค้ดส่วนลดใช้ร่วมกันไม่ได้ → ข้อความ PROMOTION_NOT_COMBINABLE โค้ดเดิมคงอยู่ | pass | qa514-04-cart-promotion-not-combinable-375.png |
| AC-181 (b) ตะกร้าว่างจากอีกแท็บ (สองแท็บจริง) → /th/cart ไม่เกิด order | pass | ผล test QA-5 + core-52 AC-147 |
| AC-181 (b) สร้าง payment session ที่ checkout (manual ได้, provider ล้ม → ข้อความไทย) | pass | ผล test QA-6a + core-69, pay-12 |
| AC-181 (b) สร้าง payment session ที่ /account/orders/:id/pay (provider ล้ม → order-pay-error ไทย; 409/400/401 ผ่าน e2e เดิมแบบ route mock) | pass | qa514-05-order-pay-error-375.png |
| AC-181 (b) PAYMENT_COLLECTION_RESET | CI (Stripe จริง) | CI artifact storefront-e2e |
| ไม่มีข้อความอังกฤษของ backend ในทุกกรณี | pass | QA-1..QA-6b |

## Negative/edge case
- ดับเบิลคลิกยืนยันคำสั่งซื้อ / ใช้โค้ด, เลือกจำนวนติดกัน, คลิกบัตรแล้วพร้อมเพย์ติดกัน, กดยืนยันซ้ำหลังเห็น error → ข้อความไทยเดิม ไม่เกิด order ซ้ำ
- ทำซ้ำ 3 รอบ 3 worker → 21/21 ผ่าน

## ข้อสังเกต (นอกขอบเขต PR)
- 375px ขั้น review: "รายละเอียดการชำระเงิน" ของ manual ตัดคำเป็นคอลัมน์แคบ (มีมาก่อน PR นี้)
- PROMOTION_NOT_COMBINABLE ตอน complete (ด่านสำรอง) สร้างจาก UI ไม่ได้ — มีแค่ unit test คุม

## Defect
ไม่พบ
