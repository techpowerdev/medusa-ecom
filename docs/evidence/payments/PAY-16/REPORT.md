# REPORT — PAY-16 (PR #541) สถานะขั้น payment

spec: `docs/spec/06-payments-stripe.md` หัวข้อ "Follow-up รอบ 42" · AC-29 (a)–(d) · head ที่ทดสอบ `e9fb472e`
CI run [45273442089](https://github.com/techpowerdev/medusa-ecom/actions/runs/45273442089) job `storefront-e2e` = 489 passed (38.9m) ไม่มี failed/skipped/flaky
Playwright report/trace ฉบับเต็ม: artifact `e2e-evidence` ของ run ข้างบน (14 วัน)
ข้อ (a)–(d) ต้องใช้ Stripe test mode จึงพิสูจน์จาก CI · regression manual/ไทย/375 พิสูจน์ในเครื่องด้วย prod build

| AC | ผล | Evidence |
|----|----|----------|
| AC-29 (a) notice แล้วเลือก manual → notice + ปุ่มลองอีกครั้งหาย ไม่สร้าง session บัตรเพิ่ม | pass | CI `pay-14-stale-session.spec.ts:214` ✓ |
| AC-29 (b) dblclick ลองอีกครั้ง → action เดียว ได้ PI ใหม่ Elements mount | pass | CI `pay-14-stale-session.spec.ts:243` ✓ |
| AC-29 (c) cart ไม่ได้ session ใหม่ → ภายใน 12 วินาทีเห็น notice ไทย ไม่มี skeleton แล้วกดลองอีกครั้งได้ PI ใหม่ notice หาย | pass | CI `pay-14-stale-session.spec.ts:261` ✓ |
| AC-29 (d) ระหว่างรอ order (`PAYMENT_ALREADY_COMPLETED`) radio ทุกตัว disabled | pass | CI `pay-14-stale-session.spec.ts:301` ✓ |
| regression AC-27 (PAY-14) | pass | CI `pay-14-stale-session.spec.ts:96`, `:145` ✓ |
| regression core-19f (AC-113 สลับวิธีชำระ) | pass | CI `core-19f-switch-payment-method.spec.ts:20` ✓ |
| regression ในเครื่อง: radio ไม่ disabled ในสถานะปกติ, เลือก manual/สลับวิธี, ข้อความไทย, 375px | pass | `01-local-375-manual-thai.png`, `02-local-1280-manual-radios-enabled.png` |

## Edge case
- dblclick ปุ่มลองอีกครั้ง → action สร้าง session 1 ครั้ง (AC-29 b) — pass
- backend ตอบ "สำเร็จ" แต่ cart ไม่เปลี่ยน → ไม่ค้าง skeleton เกิน 12 วินาที (AC-29 c) — pass
- ชำระแล้วแต่ order ยังไม่เกิด → เปลี่ยนวิธีชำระไม่ได้ (AC-29 d) — pass

**Defect**: ไม่พบ (รอบก่อนบน head `c8914bed` ข้อ (c) และ (d) fail — แก้แล้วใน `e9fb472e`)
