# QA REPORT — PAY-3b1 (PR #189) หน้า `/[cc]/account/orders/[id]/pay` ชำระด้วยบัตร + กฎ 9 d/d2

Spec: `docs/spec/06-payments-stripe.md` กฎข้อ 9 (a–e, d2), AC-19 ส่วนบัตร (AC-7 พร้อมเพย์อยู่ใน PAY-3b2)
ตรวจที่ commit `d2dcc6c` บน prod build (`medusa start` + `next start`) ใน worktree แยก ใช้ Stripe key ปลอม
Stripe test mode จริง (บัตร 4242) อ้างจาก CI run [40609474785](https://github.com/techpowerdev/medusa-ecom/actions/runs/40609474785) บน SHA เดียวกัน (storefront-e2e 146 passed)
Playwright report/trace ฉบับเต็มอยู่ใน artifact `e2e-evidence` ของ run นั้น (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-19 B เปิด URL ของ A → HTTP 404 (order id ที่ไม่มีอยู่ → 404 ด้วย) | pass | e2e `payments-order-pay.spec.ts:100` (CI + ในเครื่อง), QA-2 ในเครื่อง |
| AC-19 A เห็น `order-pay-form` + ยอดชำระ + ตัวเลือกบัตร (ไทย) | pass | qa-01-mobile-375-form.png |
| AC-19 `joined` → `order-pay-waiting`; `cancelled` → `order-pay-closed` (ไทย, ไม่มีฟอร์ม) | pass | qa-04-closed-mobile.png, e2e `:116` |
| AC-19 เลย `pay_deadline_at` → `order-pay-closed` (เปิดหน้าใหม่ และเปิดหน้าค้างจนเลยเวลา) | pass | e2e `:130`, QA-6 (clock +40 วินาที) |
| AC-19 ชำระแล้ว → `order-pay-paid` ไม่มีฟอร์ม | pass | qa-03-paid.png (admin mark-as-paid) |
| AC-19 409 `PAYMENT_ALREADY_COMPLETED` → ไม่ complete cart, poll GB-8 = 10 แล้วหยุด → `promptpay-order-delayed` | pass | e2e `:142` (CI + ในเครื่อง) |
| AC-19 d2: 500 `unknown_error` / 400 `invalid_data` + GB-8 มีการชำระแล้ว → `order-pay-paid` ไม่มี error, GB-8 ≤ 10 | pass | e2e `:169` ×2 (CI + ในเครื่อง) |
| AC-19 d2: 500/400/409 `invalid_state_error` + GB-8 ยังไม่ชำระ → `order-pay-error` ไทย + ฟอร์ม, GB-8 = 1 | pass | e2e `:201` ×3 + QA-4 (500 จริงจาก backend), qa-02-real-500-error-mobile.png |
| AC-19 401 → หน้า login ไม่อ่าน GB-8 จาก d2; ไม่ login → `login-page` | pass | e2e `:225`, QA-1 |
| AC-19 unit predicate "มีการชำระแล้ว" (`partially_authorized`, `refunded`+`not_paid`, session `authorized`+`not_paid`) | pass | `order-pay.test.ts` 52 passed (ในเครื่อง) |
| AC-19 บัตร 4242 → `order-pay-paid` ภายใน 60 วินาที + `captured` | pass (CI) | CI run 40609474785 `:243` (12.4 วินาที); ในเครื่อง skip เพราะใช้ key ปลอม |
| AC-7 / AC-19 พร้อมเพย์ | ไม่อยู่ในขอบเขต | PAY-3b2 |

## Negative / edge case
| กรณี | ผล | หมายเหตุ |
|------|----|----------|
| สร้าง session ล้มจริง (500 จาก Stripe key ผิด) | pass | `order-pay-error` ไทย + ฟอร์ม, GB-8 = 1, ไม่มี action ของ cart |
| กดซ้ำระหว่างส่ง (หน่วง 2 วินาที แล้วคลิก 3 ครั้ง) | pass | สร้าง session ครั้งเดียว; หลังแก้ option มี `aria-disabled="true"` ระหว่างส่ง (ตรวจใน e2e ใหม่) |
| **ลองใหม่หลัง error โดยคลิกบัตรอีกครั้ง** | รอบแรก **fail — D-1** → หลังแก้ pass | builder ล้างตัวเลือกหลัง error; e2e ใหม่ "d2 ยังไม่ชำระแล้วคลิกบัตรอีกครั้ง → สร้าง session ใหม่ได้" ผ่านใน CI run [40618589669](https://github.com/techpowerdev/medusa-ecom/actions/runs/40618589669) |
| เปิดหน้าค้างจนเลยเส้นตาย | pass | ฟอร์มปิดภายใน 30 วินาที |
| มือถือ 375px (ฟอร์ม/error/closed) | pass | `scrollWidth ≤ clientWidth` |
| Regression checkout (PaymentWrapper/createPaymentSession ถูก refactor) | pass | ในเครื่อง: thai-ui-checkout, core-19b, core-4g, core-14f ผ่าน; CI: payments.spec AC-1..AC-5, AC-9 (บัตร/3DS/ถูกปฏิเสธ/PromptPay) และ promptpay-already-paid/fallback-cap/race ผ่านทั้งหมด |
| 3DS / บัตรถูกปฏิเสธบนหน้า order | ไม่ได้ตรวจ | ไม่มี e2e สำหรับหน้า order และในเครื่องไม่มี Stripe จริง (checkout เดิมผ่านใน CI) |

## Defect
- **D-1** หลัง `order-pay-error` (d2 ยังไม่ชำระ) คลิกตัวเลือกบัตรอีกครั้งไม่สร้าง session ใหม่ เพราะ `selected` ยังเป็น `pp_stripe_stripe` และ headlessui `RadioGroup` ไม่เรียก `onChange` เมื่อเลือกค่าเดิม ผู้ใช้ลองใหม่จากฟอร์มไม่ได้ (ขัดกับกฎ 9 d2) ต้อง reload หน้า — **แก้แล้ว** (CI run 40618589669 storefront-e2e ผ่าน)
