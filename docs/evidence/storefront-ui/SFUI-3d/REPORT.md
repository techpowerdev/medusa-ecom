# SFUI-3d — QA evidence (spec 09)

ทดสอบรวมทั้ง stack ที่ปลาย `f1a81eba` (feat/SFUI-6-cleanup ซึ่งรวม 1a→6) ในเครื่อง 2026-11-26: backend + storefront แบบ prod build, DB seed ใหม่,
e2e chromium `--workers=1` ทั้งชุด = 484 ผ่าน / 4 ล้ม / 37 ข้าม (ทุกตัวที่ข้ามต้องใช้ Stripe test key จริง), `test:e2e:unit` 197/197, vitest 131 ไฟล์ 2009/2009
(ล้ม 4 = `core-50-nav-narrow` 1280 กว้างต่าง 1.27px บน macOS (ทราบอยู่แล้ว) + `payments-order-pay` 3 ตัวที่เกิดจาก env หลอกในเครื่อง — รันซ้ำบน env ที่ตรงกันผ่าน 17/17)
รายงานและ trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-12 (unit) | pass | vitest 6 ไฟล์ (`core-19f-continue-after-timeout`, `pay-16-payment-container`, `pay-16-payment-step-state`, `payment-session-lock-timeout`, `pay-14-stale-session`, `core-4i-b-ui-results`) ผ่าน |
| AC-12 (e2e ArrowDown → พร้อมเพย์) | รอ CI | `sfui-3d-payment.spec.ts` ถูกข้าม: ต้องใช้ Stripe test key จริง (ในเครื่องไม่มี); ตรวจด้วยตาเห็นขั้นชำระเงินเป็น RadioGroup 3 ตัวเลือกภาษาไทย ไม่ล้นที่ 390; 01-payment-step-radiogroup-1280.png, 02-payment-step-radiogroup-390.png |
| AC-12 (e2e เดิม) | pass บางส่วน / รอ CI | `core-52` 14/14, `thai-ui-checkout` 1/1, `pay-10` 1/1, `pay-12` 2/2, `pay-18` 1/1; `payments-order-pay` 17/17 เมื่อ env ตรงกัน (ในชุดเต็มล้ม 3 เพราะ storefront build ด้วย `pk_test_` หลอก — ไม่ใช่โค้ด SFUI); `payments.spec`, `pay-9/11/14/15/17/19`, `payments-promptpay-*`, `payments-refund` ข้ามทั้งหมดเพราะต้องใช้ Stripe → **รอ CI** |

## รอบ 2 — Stripe test key จริง (2026-11-26, ปลาย stack SFUI-7)
ใช้ Stripe test mode จริง + `stripe listen` forward webhook แบบเดียวกับ CI

| AC | Result | Evidence |
|----|--------|----------|
| AC-12 (บัตรจริง) | pass หลังแก้ D-1 | เดิมปุ่ม `submit-payment-button` สูง 40px คลิกหลังกรอกบัตรตกใน iframe ของ Stripe (ค้าง step=payment, 11 test ล้ม) → คืน `h-12` (48px เท่า develop) ใน `de79cfef`; e2e ชุดบัตร repeat 3 ได้ 21/21 (develop 20/21 บนเครื่องเดียวกัน); ช่องบัตรอยู่ในกรอบใต้ปุ่มตัวเลือก qa2-01-card-element-in-option.png; สั่งซื้อด้วยบัตร 4242 สำเร็จ qa2-02-card-order-complete.png |
| AC-12 (พร้อมเพย์ / หน้าจ่าย order) | pass | พร้อมเพย์จริงจ่ายจน order สำเร็จ; `/account/orders/:id/pay` จ่ายด้วยบัตรแล้วขึ้น "ชำระเงินเรียบร้อยแล้ว…"; `payments-order-pay` + `sfui-3d-payment` ผ่าน |

หมายเหตุ: การคลิกปุ่มหลังกรอกบัตรยังค้างบางครั้งในเครื่องนี้ (2/10) ในอัตราเดียวกับ develop — เป็น flake เดิมของ helper `continueToReview` ไม่ใช่ regression ของ SFUI (บันทึกเป็นงานต่อเนื่อง)
