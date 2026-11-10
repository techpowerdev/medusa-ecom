# Evidence PAY-2 — Storefront checkout บัตร + PromptPay (spec 06)

PR #48 · branch `feat/PAY-2-storefront-payment` · QA 2026-10-26 · Stripe **test mode** เท่านั้น
สภาพแวดล้อม: backend build + start จาก `.medusa/server`, storefront build + start, DB แยก, Redis db แยก,
`stripe listen` แยก listener ต่อ endpoint (`stripe_stripe`, `stripe-promptpay_stripe`)
รายงานและ trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ run 40224439814 (เก็บ 14 วัน)

## Acceptance criteria

| AC | Result | Evidence |
|----|--------|----------|
| AC-1 บัตร 4242 → order, `payment_status=captured` | pass | [01-card-order-confirmed.png](01-card-order-confirmed.png) · `payments.spec.ts` AC-1 (ในเครื่องและ CI) |
| AC-2 บัตร 3DS → modal → สำเร็จ | pass | [02-card-3ds-modal.png](02-card-3ds-modal.png) · AC-2 |
| AC-3 บัตรถูกปฏิเสธ → error, ไม่มี order, cart ยังอยู่ | pass | [03-card-declined-error.png](03-card-declined-error.png) · AC-3 |
| AC-4 PromptPay QR → authorize → webhook → order captured | pass | [04-promptpay-qr.png](04-promptpay-qr.png), [05-promptpay-order-confirmed.png](05-promptpay-order-confirmed.png) · AC-4 |
| AC-5 PromptPay ไม่ชำระใน 10 นาที → PI เดิม `canceled`, cart ใช้ต่อได้, ได้ QR ใหม่ | pass | test AC-5 (`page.clock` เลื่อน 10:01) — ดู CI artifact |
| AC-9 session บัตร → PI `["card"]`; PromptPay → `["promptpay"]` | pass | test AC-9 (อ่านจาก Stripe API) |
| AC-10 webhook ของ Stripe CLI ถึงทั้งสอง path ใน CI | pass | CI run 40224439814 step "Stripe webhooks reached both endpoints"; ในเครื่อง 200 ครบ 18/18 ต่อ path |

ผล: `payments.spec.ts` 6/6; unit `payment-session.test.ts` 14/14; `stripe-env.unit.spec.ts` 5/5

## Negative / edge case

| # | กรณี | Result | สิ่งที่สังเกต |
|---|------|--------|------------|
| E1 | 3DS บัตร 4000 0025 0000 3155 | pass | order captured |
| E2 | ถูกปฏิเสธ → จ่ายใหม่ด้วย 4242 | pass | cart id เดิม; order captured |
| E3 | 3DS กด Fail | pass | error แสดง; ยังอยู่ที่ `/checkout`; cart ไม่ complete |
| E4 | กด Continue ของบัตร 6 ครั้งรัวๆ | pass | session เดียว; PI 1 ตัว |
| E5 | กด Place order ซ้ำ (บัตร) | pass | order 1, payment 1, capture 1 |
| E6 | PromptPay กด Continue ×5 / Pay ×4 แล้ว reload | pass | PI เดียว; countdown ไม่รีเซ็ต (9:38 → 9:37) |
| E7 | QR หมดอายุ → Try again → จ่าย; replay `payment_intent.succeeded` 3 รอบ × 2 endpoint | pass | PI แรก `canceled`; replay 200 ทุกครั้ง; order 1 รายการ capture 1 ครั้ง |

## Defect
ไม่พบ

## ข้อสังเกต (ไม่ใช่ defect)
- ข้อความ UI/error ยังเป็นอังกฤษ — แปลไทยใน CORE-4d (ADR-014)
- หลัง reload ระหว่างรอ PromptPay ต้องกด "Pay with PromptPay" อีกครั้ง QR จึงแสดง (QR เดิม countdown นับต่อ)
- countdown เทียบ `created` ของ PI กับนาฬิกาเครื่องลูกค้า ถ้านาฬิกาคลาดมาก เวลาที่แสดงคลาดตาม
- ปุ่ม "Continue to review" ของ starter ค้าง ~1/6 ครั้ง (e2e `continueToReview` กดซ้ำเลี่ยง) → task แยก
