# ADR-007 ชำระเงินผ่าน Stripe provider ของ Medusa แบบ capture อัตโนมัติ

สถานะ: อนุมัติแล้ว (เจ้าของโปรเจกต์, 2026-10-25) — ปรับปรุงหลัง ADR-004 ตัดความจำเป็นของ auth-hold ออก

## บริบท
Medusa มี `pp_stripe_stripe` (บัตร) และ `pp_stripe-promptpay_stripe` (PromptPay) มาให้
เมื่อ group buying ใช้ draft order ที่ชำระเงินหลังสำเร็จเท่านั้น (ADR-004) จึงไม่มี order ใดต้องการ
deferred capture ทุก order เป็นแบบจ่ายทันที

## ทางเลือก
1. provider `capture: true` (อัตโนมัติ) ทั้งบัตรและ PromptPay; ไม่มี capture subscriber
2. provider `capture: false` + capture subscriber บน `order.placed` + job สำหรับ reconciliation
3. payment provider ที่สร้างเอง

## การตัดสินใจ
เลือกทางเลือกที่ 1 ไม่มีโค้ด payment ที่เขียนเองเลย draft order ของ group buy ชำระผ่าน
provider เดียวกันบน payment collection ของตัวเอง

## ผลที่ตามมา
+ setup เรียบง่ายที่สุด; Stripe test mode + CLI ครอบคลุม e2e
+ refund ทำผ่าน refund workflow ของ Medusa เท่านั้น
− หากภายหลังต้องเปลี่ยนเป็น deferred capture จะต้องแก้ config และเพิ่ม subscriber (ตามที่อธิบายในทางเลือกที่ 2)
