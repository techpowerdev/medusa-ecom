# Evidence — PAY-12 (spec 06 AC-25, กฎข้อ 14) — QA re-test head caf615a7

ทดสอบบน prod build (DB/Redis แยกของ qa, proxy หน้า backend สำหรับฉีด 5xx/network ตอน route อ่าน cart) ไม่ใช้ Stripe จริง (key หลอก) ทุก test ใช้ `pp_system_default` ที่แก้ data ใน DB ให้หน้าตาเหมือน PaymentIntent

| AC | Result | Evidence |
|----|--------|----------|
| AC-25 notice ภาษาไทย 3 แบบ ข้อความต่างกัน ทั้งไม่ล็อกอิน / ตะกร้าว่าง / มีตะกร้า | pass | 01-cart-error-refunded.png, ผล test `AC-25 ข้อความไทย 3 แบบ` |
| AC-25 ค่าไม่รู้จัก/XSS 11 แบบ → ไม่แสดง notice ไม่มี dialog | pass | 02-cart-error-unknown-hidden.png, ผล test `EDGE ค่าแปลก/ซ้ำ/XSS` |
| D-1 session หมดอายุ (ไม่มี jwt / jwt เสีย / jwt หมดอายุจริงที่ backend ตอบ 401) → หน้า login, return_to=/th/checkout?step=review&cart_id=<cart> ไม่มี payment_intent_client_secret ใน Location, URL และ HTML; login แล้วกลับ review ของ cart เดิม | pass | qa481c-01-d1-login-no-secret.png |
| D-2 cart ถูก complete ก่อน login ใหม่ (ไม่มี jwt และ jwt เสีย) → หลัง login ไปหน้า /th/order/<order>/confirmed ของ order นั้น ไม่มี 404 | pass | qa481c-02-d2-login-to-order-confirmed.png |
| IDOR: B ล็อกอินแล้วเปิด checkout?step=review&cart_id=<cart ของ A ที่ complete แล้ว> → /th/account/orders เห็นเฉพาะ order ของ B; HTML ไม่มี order id และอีเมลของ A (3 แบบของ cookie) | pass | qa481c-03-idor-own-orders-only.png |
| 5xx (500/502/503) และ network reset ตอนอ่าน cart → review&cart_id ไม่มี notice ไม่มีคำว่า "ชำระเงินไม่สำเร็จ" cookie ไม่เปลี่ยน; cart complete แล้ว + 503 → หน้า confirmed ของ order นั้น | pass | ผล test `5xx/network ตอนอ่าน cart` |
| 404/400 ตอนอ่าน cart → cart?error=payment_failed | pass | ผล test เดียวกัน |
| Regression: 375px ไม่ล้นจอ, สต็อกหมด → cart?error=refunded, เปิด return URL ซ้ำหลังได้ order → หน้า confirmed เดิม, ไม่มี country → /account | pass | ผล test `EDGE 375px` และ `EDGE /api/payment-return` |

## Negative/edge
- return_to ที่ถูกแก้ 12 แบบ (`//evil`, `https://evil`, `/TH/…`, `cart_id=//evil`, query เพิ่ม, cart_id ซ้ำ, `cart_../../x`, `%2F%2F`, fragment, cart_id ยาว 65 ตัว, สลับลำดับ, มี client_secret) → ไม่ผ่าน allow-list หลัง login อยู่ที่ /th/account
- cart_id ผิดรูปบนหน้า checkout (`//evil`, `https://evil`, CRLF, `../`) → ไม่ redirect ออกนอกร้าน
- ไม่ล็อกอิน + cart_id ของ A → หน้า login ของ /th/account/orders ไม่เห็น order ของ A
- B มี cart ของตัวเองที่ยังไม่ complete ใน cookie + cart_id ของ A → ขั้น checkout ของ cart B ไม่เปิดเผยข้อมูลของ A

Playwright report/trace ฉบับเต็ม: CI artifact ของ job storefront-e2e ใน PR #481
