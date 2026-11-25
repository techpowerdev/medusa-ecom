# REPORT — PAY-17 (PR #540) ข้อความไทยของ error Stripe ขั้น review + PromptPay poll ไม่ตัดสินระหว่าง finishing

spec: `docs/spec/06-payments-stripe.md` หัวข้อ "Follow-up รอบ 42" · กฎข้อ 19 · AC-30 · head `47181b0c`
ส่วน e2e พิสูจน์จาก CI (Stripe test mode): run 45269744687 job `storefront-e2e` — 481 passed / 0 failed / 0 skipped
https://github.com/techpowerdev/medusa-ecom/actions/runs/45269744687
ในเครื่องไม่มี Stripe test key → qa ตรวจ unit/component (vitest) และอ่านโค้ด

| AC | ผล | Evidence |
|----|----|----------|
| AC-30a ขั้น review บัตร 4000 0000 0000 0002 (card_error/card_declined) และแทน message ของ confirm ด้วย "Your card was declined." → `stripe-payment-error-message` อักษรไทย ไม่มีข้อความอังกฤษ, `submit-order-button` ยังกดได้, cart ยังไม่ completed | pass | CI `e2e/pay-17-stripe-error-thai.spec.ts` ✓; unit `pay-17-stripe-error-thai.test.ts` ผ่าน และล้มบน develop 2/2 (qa รันซ้ำในเครื่อง) |
| AC-30b poll ได้ refunded ระหว่าง finishing → wait (ไม่เปลี่ยน state) | pass | unit `promptpay-finish.test.ts` (`promptPayPollWhileFinishing`) |
| AC-30b e2e AC-28: poll B ตอบ refunded ขณะ placeOrder รอคิว → ไม่เห็น `promptpay-retry-button` เลย (MutationObserver) จบที่ `promptpay-go-to-cart` → `/th/cart` | pass | CI `e2e/pay-15-promptpay-go-to-cart.spec.ts` ✓ |
| AC-30b e2e AC-24 (PAY-11) | pass | CI `pay-11-promptpay-refund-reason.spec.ts` ✓ ทั้ง 2 test |
| regression PAY-6c: refunded ที่ไม่รู้เหตุยังเห็น `promptpay-retry-button`; เพดาน ≤ 10; already-paid | pass | CI `payments-promptpay-fallback-cap.spec.ts` ✓ ×2; `payments-promptpay-already-paid` ✓ ×2 |

## negative/edge (qa เพิ่ม รันในเครื่อง — ไม่ commit)
vitest 62/62 (ของ builder + edge 20 กรณีของ qa) — ข้อความเป็นอักษรไทยและไม่มีอักษรละตินทุกกรณี:
code แปลก/ว่าง, card_error ไม่มี code/message, field null, object ว่าง → ข้อความทั่วไป · code ว่างแต่มี decline_code → บัตรถูกปฏิเสธ · validation_error ไม่มี message → ข้อมูลบัตรไม่ถูกต้อง · type อื่น → ข้อความทั่วไป · expired_card → บัตรถูกปฏิเสธ · message ที่มี HTML/script → ไม่แสดง · fuzz type×code×decline_code 90 ชุด → ข้อความไทย 1 ใน 3 แบบเสมอ · error ไม่มี message → ยังแสดงข้อความไทย (เดิมไม่แสดง) · ปุ่มกลับมากดได้หลัง error และไม่เรียก placeOrder

## ข้อสังเกต (ไม่ใช่ defect)
- type/code ตัวพิมพ์ใหญ่ตกไปข้อความทั่วไป (Stripe ส่งตัวเล็กเสมอ)
- `open-qr.ts` และ `order-pay/pay-buttons.tsx` ยังแสดง `error.message` ของ Stripe ตรงๆ — นอกกฎข้อ 19 (follow-up)

## รูป
ไม่ commit รูป — flow ทั้งหมดใช้ Stripe ซึ่งรันได้เฉพาะ CI; ภาพ `01-card-declined-thai` (PAY-17) และ `01-promptpay-go-to-cart` (PAY-15) อยู่ใน artifact `e2e-evidence` ของ run 45269744687 (report/trace เต็มเก็บเป็น CI artifact 14 วัน)
