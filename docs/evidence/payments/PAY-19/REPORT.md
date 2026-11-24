# REPORT — PAY-19 (PR #548) PromptPay คืนเงินครบ: notice + ลิงก์ตะกร้าแทนปุ่มจ่ายที่ขั้น review

spec: `docs/spec/06-payments-stripe.md` หัวข้อ "Follow-up รอบ 42" · กฎข้อ 21 · AC-32 (owner Q-P13 = ก, Q-P14 = ข, Q-P15, Q-P16 — 2026-11-24) · head `97eee49e`
qa รอบ 2 (รอบแรกบน `225b825d` พบ D-1 Store API ไม่เห็นยอดคืนเงิน และ D-2 หน้า review ถูก redirect ไป payment — แก้แล้วทั้งสองข้อ)

| AC | ผล | Evidence |
|----|----|----------|
| AC-32 unit `refundedWithoutSession` + `checkoutRedirectStep` | pass | CI run 45364225381 |
| AC-32 e2e คืนเงินพร้อมเพย์จริง (Stripe test mode) → notice หลัง refresh | pass | CI `storefront-e2e` run 45364225381: `pay-19-promptpay-refunded-reload` ✓ (500 passed, 0 skipped) |
| AC-32(a) reload ยังเห็น notice + ลิงก์ ไม่มี submit/retry | pass | CI + ในเครื่อง `02-review-refunded-notice-1280.png` |
| AC-32(b) ไปตะกร้าแล้ว Back → เหมือน (a) | pass | CI + ในเครื่อง (1280 และ 375) |
| AC-32(c) เลือกพร้อมเพย์ใหม่ → collection ใหม่ + ปุ่มจ่าย | pass | CI |
| 375px: notice ไทย + ลิงก์ `/th/cart` ไม่ล้นจอ | pass | `03-review-refunded-notice-375.png` |
| regression review แบบ manual (ปุ่มจ่าย ไม่มี notice คืนเงิน ไทย) | pass | `01-review-manual-1280.png` |
| regression pay-11, pay-15, payments-promptpay-fallback-cap, pay-9, core-95 | pass | CI `storefront-e2e` log |

ส่วนที่พิสูจน์จาก CI: ทุกแถวที่ใช้ Stripe test mode จริง (e2e ใช้อีเมลลูกค้าจาก GitHub secret — ไม่ปรากฏในรายงาน/รูป; spec ปิด trace)
ส่วนที่ทดสอบในเครื่อง: prod build, Stripe placeholder — จำลองสถานะด้วย SQL บน DB ของ qa (`payment_session.deleted_at = now()`, `captured_amount = refunded_amount = amount` รวม `raw_*`) แล้วเปิด `/th/checkout?step=review` → ยังอยู่ step=review เห็น `review-refunded-notice` + `review-refunded-go-to-cart` · ข้อความไทย (regex อักษรไทย ไม่มีคำละติน) มีคำว่า "คืนเงิน" และ "อีเมล"
Edge: คืนไม่ครบ + ไม่มี session → redirect ไป step=payment ไม่มี notice (ถูกตามกฎข้อ 127)
Playwright report ฉบับเต็ม: CI artifact ของ run 45364225381 (14 วัน)

**Defect**: ไม่มี (รอบ 2)
