# QA REPORT — PAY-6c (PR #136)

- Spec: `docs/spec/06-payments-stripe.md` (origin/develop) กฎข้อ 8, AC-17; regression AC-12, AC-12b; ADR-014
- Commit ที่ตรวจ: `b79192c` (head ของ `feat/PAY-6c-promptpay-retry-cap`)
- CI: run [40476817902](https://github.com/techpowerdev/medusa-ecom/actions/runs/40476817902) — `storefront-e2e` pass (82 passed ไม่มี skip, Stripe test mode จริง), `lint-typecheck` pass, `backend-tests`/`docker-worker-mode` skipped ตาม `classify-changes.sh`
- Playwright report + trace ฉบับเต็ม: CI artifact `e2e-evidence` (14 วัน)
- ในเครื่อง: prod build backend :9189 / storefront :8189 (`NODE_ENV=production`, OPS-7 guard, Stripe key ปลอม), DB `medusa_qa136`, Redis db 15

## ผลต่อ AC

| AC | Result | ยืนยันจาก | Evidence |
|----|--------|-----------|----------|
| AC-17 เพดาน: complete ล้มทุกครั้ง → complete + poll ≤ 10 แล้วเห็น `promptpay-order-delayed` | pass | CI + ในเครื่อง (วัดได้ 9 request) | qa-01-ci-order-delayed.png |
| AC-17 ข้อความไทย + ลิงก์ `/contact` | pass | CI + ในเครื่อง (href `/th/contact` เปิดได้) | qa-01-ci-order-delayed.png |
| AC-17 ไม่มี request เพิ่มใน 30 วินาที, ไม่แสดง awaiting | pass | CI + ในเครื่อง (+0 request) | qa-01-ci-order-delayed.png |
| AC-17 คืนเงิน: `promptpay-refunded` + ปุ่ม `promptpay-retry-button` enabled | pass | CI (mock poll) + ในเครื่อง (สัญญาณจาก Store API จริง) | qa-02-ci-refunded.png |
| AC-17 unit ตัวนับเพดาน | pass | ในเครื่อง `payment-session.test.ts` 33 passed | ผลรันในเครื่อง |
| AC-12 regression | pass | CI (`payments-promptpay-already-paid.spec.ts:37`) | qa-03-ci-ac12b-order-confirmed.png |
| AC-12b regression | pass | CI (`payments-promptpay-already-paid.spec.ts:68`) | qa-03-ci-ac12b-order-confirmed.png |
| มือถือ 375×740 ไม่ล้นจอ | pass | ในเครื่อง | qa-04-local-mobile-order-delayed.png, qa-05-local-mobile-refunded.png |

## หมายเหตุวิธีทดสอบในเครื่อง
1. ไม่มี Stripe key จริง จึงจำลอง "ชำระแล้วแต่ไม่มี order" ด้วย payment session พร้อมเพย์ `authorized` ใน DB และนับ/ตัด server action แบบเดียวกับ e2e ใน PR
2. ฉากคืนเงินตั้ง `captured_amount = refunded_amount = 600` ใน DB แล้วยืนยันว่า Store API คืนสอง field นี้จริง — ยังไม่มีหลักฐานจาก refund จริงของ `compensatePaymentIfNeededStep`

## Negative / edge case (นอก spec)
| กรณี | ผล |
|------|----|
| ดับเบิลคลิกปุ่มชำระ | รวม 9 request ไม่ยิงซ้ำ — ok |
| หลัง refunded รอ 15 วินาที | ไม่มี request เพิ่ม — ok |
| reload หลัง delayed | เพดานนับใหม่ต่อการ mount (ยิงได้อีก 9) — ข้อสังเกต |
| reload เมื่อมีแต่ session พร้อมเพย์ `authorized` | ปุ่มพร้อมเพย์ disabled (พฤติกรรมเดิมตั้งแต่ PAY-6b) — ข้อสังเกต |

## Defect
ไม่พบ defect ของ AC-17 / AC-12 / AC-12b
