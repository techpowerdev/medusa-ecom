# Evidence: PAY-3b2 — พร้อมเพย์บนหน้า `/account/orders/:id/pay` + การกลับจาก redirect ของ Stripe (QA PR #203)

- Spec: `docs/spec/06-payments-stripe.md` — AC-7, AC-20, กฎข้อ 9c (+ spec 05 กฎ 31/41)
- PR: #203 — branch `feat/PAY-3b2-promptpay-order-page`
- QA รอบ 1 ที่ head `8a33045` (2026-11-03); แก้ตาม QA/review ที่ `740c9f9` แล้วยืนยัน AC-7 ด้วย CI run 41628260267
- สภาพแวดล้อม QA ในเครื่อง: backend ใช้ Stripe **test mode** secret key (สร้าง PaymentIntent จริง), storefront prod build ใช้ publishable key ปลอม + Playwright route แทน `js.stripe.com` (ในเครื่องไม่มี `pk_test_`) — ผลของ Stripe.js จริงมาจาก CI; ไม่ใช้ live key และไม่พิมพ์ค่า key
- ลูกค้า login แล้วทุกเคส (ไม่มี guest); หา element ด้วย `data-testid`; ข้อความไทยตรวจด้วย `expectThai`

## ผลตาม AC

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-7 สแกน QR แล้ว authorize → `order-pay-paid` และ payment `captured` | pass (หลังแก้) | รอบ 1 ล้มเพราะ e2e ปิดหน้าธนาคารก่อน request ไป Stripe ถึง (D-1 — ไม่ใช่โค้ดแอป); หลังแก้ที่ `740c9f9` e2e AC-7 บน Stripe test mode จริงผ่านใน CI run https://github.com/techpowerdev/medusa-ecom/actions/runs/41628260267 (`storefront-e2e` 157 passed, 0 skipped); QR บนหน้า order: `ac7-promptpay-qr-375.png` |
| AC-7 (QA) QR หมดอายุ → session ใหม่ + `promptpay-expired` | pass | `qa-promptpay-expired-375.png`; session id ใหม่ไม่ซ้ำเดิม และ PI เดิมเป็น `canceled` ใน Stripe test mode |
| AC-7 (QA) กันกดซ้ำ | pass | dblclick ปุ่มพร้อมเพย์ → `confirmPromptPayPayment` 1 ครั้ง; คลิกตัวเลือกพร้อมเพย์ 3 ครั้ง → สร้าง session 1 ครั้ง |
| AC-20 redirect `succeeded` → awaiting ไม่มีฟอร์ม แล้ว `order-pay-paid` | pass | e2e :292 ทั้งในเครื่องและ CI; `ac20-redirect-succeeded-375.png`; URL ไม่มี query ของ Stripe และ reload ไม่เข้าทาง d3 ซ้ำ |
| AC-20 redirect `failed` → `order-pay-error` + ฟอร์ม แล้วลองใหม่สำเร็จ | pass | e2e :329 และบัตร 4242 บน Stripe จริงใน CI; `ac20-redirect-failed-375.png`; ลองใหม่ด้วยพร้อมเพย์ได้ QR |
| AC-20 d2 แล้ว GB-8 ล้ม (500) → 409 → poll จน paid | pass | e2e :354 ทั้งในเครื่องและ CI |
| (review B2) poll ระหว่าง QR เจอ `authorized` ก่อน `captured` → `order-pay-awaiting` แล้ว `order-pay-paid` (ไม่ค้างที่ฟอร์มเปล่า) | pass | e2e ใหม่ (route mock GB-8) ผ่านใน CI run 41628260267 |

## Negative / edge (ผ่านทั้งหมด)
- `?redirect_status=succeeded` ที่ไม่มี `payment_intent` และ `redirect_status=bogus` → ฟอร์มปกติ
- `requires_payment_method` → error + ฟอร์ม
- ไม่ login → ไม่เห็นฟอร์มชำระเงิน
- 375×812: ข้อความ UI ไทยทั้งหมด ไม่มี scroll แนวนอน

## Defect
- D-1 (e2e, รอบ 1): `payments-order-pay.spec.ts` กด "authorize test payment" แล้ว `bank.close()` ทันที → request ไป `pm-hooks.stripe.com` ถูกตัด, PI ค้าง `requires_action` — **แก้แล้ว** ที่ `740c9f9` (helper `authorizePromptPay` รอ PI `succeeded` ก่อนปิด)
