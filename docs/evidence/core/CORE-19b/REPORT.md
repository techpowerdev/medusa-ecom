# QA — CORE-19b (PR #151) · spec 01 AC-64

ตรวจบน prod build ในเครื่อง (manual payment, Stripe key ปลอม) + CI run 40503667515 (Stripe test mode)
- CI run: https://github.com/techpowerdev/medusa-ecom/actions/runs/40503667515 — ทุก job SUCCESS/SKIPPED, storefront-e2e 101 passed (test พร้อมเพย์ของ AC-64 รันจริง ไม่ถูก skip)
- Playwright report/trace ฉบับเต็ม: artifact `e2e-evidence` ของ run นี้ (14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-64 manual: กดครั้งเดียว 20 รอบ → `step=review` ≤ 10 วินาที | pass (ในเครื่อง 3×20 รอบ + CI) | `core-19b-continue-to-review.spec.ts` |
| AC-64 พร้อมเพย์: กดทันทีที่ปุ่มพร้อม 20 รอบ → review, session เดียว | pass (**CI trace**: server action สร้าง session 20 ครั้งใน 20 รอบ, session ต่อ cart = `[pp_stripe-promptpay_stripe]`) | qa-05-ci-promptpay-review-round20.png |
| AC-64 helper `continueToReview` ไม่มีการกดซ้ำ | pass (unit 3/3) | `core-19b-continue-to-review.unit.spec.ts` |
| ปุ่มแสดง "กำลังดำเนินการ..." ระหว่างรอ | pass (manual ในเครื่อง; พร้อมเพย์จาก CI trace DOM snapshot) | qa-01-loading-thai.png |
| แก้ไขการชำระเงิน → กลับ review ได้ (5 รอบ, session เดียว) | pass | qa-02-review-after-edit.png |
| สลับ บัตร → พร้อมเพย์ → บัตร แล้วกดครั้งเดียว → review | ไม่ได้ตรวจ (ในเครื่องไม่มี Stripe key จริง และ CI ไม่มี test flow นี้) — บันทึกเป็น follow-up | — |

## Negative / edge case (ในเครื่อง, QA spec ไม่ได้ commit — 5/5 pass)

| กรณี | Result | Evidence |
|------|--------|----------|
| server action ตอบ 500 → error ไทย, ปุ่มไม่ล็อกค้าง, กดใหม่ไป review ได้ | pass | qa-03-action-500-thai-error.png |
| เลือกพร้อมเพย์แต่ Stripe ปฏิเสธ (key ปลอม) → error ไทย, ปุ่มไม่ล็อก, สลับเป็น manual แล้วไป review ได้ | pass | qa-04-promptpay-fail-thai-error.png |
| double-click ปุ่ม Continue (manual) 5 รอบ → review, session เดียว | pass | ผล test |
| e2e chromium ทั้งชุดในเครื่อง (ไม่มี Stripe) | 236 passed, 26 skipped (Stripe) | — |

## Defect
ไม่พบ

## ข้อสังเกต (ไม่ใช่ defect)
- ถ้า router refresh ไม่นำ cart ที่มี session ใหม่เข้า props ปุ่มจะแสดง "กำลังดำเนินการ..." ไปจนกว่าผู้ใช้จะเลือกวิธีชำระใหม่ (ไม่มี timeout) ทำซ้ำในเครื่องไม่ได้ — มี task CORE-19e (spec รอบ 11) รองรับ
