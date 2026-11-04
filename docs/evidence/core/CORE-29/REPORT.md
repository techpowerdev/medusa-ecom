# QA CORE-29 (PR #263) — กู้ตะกร้าหลัง login ใหม่ (spec 01 กฎข้อ 86, AC-122; ADR-019 ทางเลือก B)

สภาพแวดล้อม: prod build ที่ commit `2b1336f` — backend `medusa build` แล้วรัน `medusa start`, storefront `next build` + `next start`, DB แยก, Stripe test mode เท่านั้น, viewport 1280 และ 375
report/trace ฉบับเต็มอยู่ใน CI artifact ของ PR #263 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-122 ลบ `_medusa_jwt` → เปิด `/th/cart` (cookie cart ถูกล้างตาม AC-43) → login ใหม่ผ่านฟอร์ม → cookie = C, `product-row` เดิม, `nav-cart-link` (1) — 1280 | pass | qa-01-restored-after-jwt-drop-1280.png |
| AC-122 ขั้นเดียวกันที่ 375px (ข้อความในแถวเป็นภาษาไทยตาม regex `[฀-๿]`) | pass | qa-02-restored-after-jwt-drop-375.png |
| AC-122 key อื่นใน `metadata` (`keep_me`) ยังอยู่หลังบันทึก `active_cart_id` (กฎข้อ 86e) | pass | e2e ของ PR + S1 (assert metadata) |
| AC-122 cart C ที่ complete แล้ว (สั่งซื้อผ่าน checkout UI ด้วย manual payment) → ลบ JWT แล้ว login ใหม่ → ไม่มี cookie cart, ตะกร้าว่าง; เพิ่มสินค้าต่อ → cart ใหม่ถูกบันทึกเป็น `active_cart_id` | pass | qa-04-completed-cart-not-restored.png |
| AC-122 `active_cart_id` ของ A ชี้ไปที่ cart ของ B (A ตั้งผ่าน API ของตัวเอง) → login สำเร็จ ไม่มี cookie cart; cart ของ B ยังมี `customer_id = B` และ metadata ของ B ไม่เปลี่ยน | pass | e2e ของ PR + S4c |
| AC-122 มี cookie cart D อยู่แล้วตอน login → cookie ยังเป็น D (ไม่ถูกทับด้วย `active_cart_id` = X) | pass | e2e ของ PR + S4b |
| AC-122 unit: `getOrSetCart`, `activateCart`, payment-return เรียก `customer.update` 1 ครั้ง; update ล้มแล้ว cart ยังสร้างได้; `prepareGroupCart` ไม่เรียก | pass | vitest 15/15 |

## สถานการณ์จากมุมผู้ใช้
| # | สถานการณ์ | ผล |
|---|-----------|----|
| S2 | ออกจากระบบปกติ (`logout-button`) → cookie cart และ JWT หาย → login ใหม่ → ได้ตะกร้าเดิม (กฎข้อ 86b: ไม่มี cookie cart จึงกู้) | pass |
| S3 | ข้ามอุปกรณ์: context A ใส่ของ → login ใน context B ใหม่ (375) ได้ cart เดิม; เพิ่มสินค้าใน B แล้วเข้า cart เดียวกัน A เห็น 2 แถว | pass — qa-03-cross-device-context-b-375.png |
| S4d | join group: หลัง `prepareGroupCart` และหลัง join แล้ว `active_cart_id` ยังเป็นตะกร้าหลัก; ลบ JWT แล้ว login ใหม่ได้ตะกร้าหลัก ไม่ใช่ cart ของกลุ่ม | pass — qa-05-group-join-keeps-main-cart.png |

## Negative / edge
| # | กรณี | ผล |
|---|------|----|
| E1 | `active_cart_id` เป็น id ที่ไม่มีอยู่จริง, เป็นตัวเลข 12345, หรือเป็น "" → login สำเร็จ ไม่มี cookie cart | pass |
| E2 | cookie cart ค้างเป็นของ B (ถูกทิ้งเพราะ 404 ตามกฎข้อ 40) → กู้ C ของ A แทน; cart B ยังเป็นของ B | pass |
| E3 | กด sign-in สองครั้ง (dblclick) → login สำเร็จ cookie = C ไม่มี cart ใหม่ | pass |
| E4 | `/api/payment-return` ใช้ PaymentIntent จริงของ Stripe test, `redirect_status=failed`: client_secret ผิด → ไป `/th/cart?error=payment_failed` และไม่บันทึก; secret ถูก → ไป `/th/checkout?step=payment`, cookie = cart และ `active_cart_id` = cart | pass |
| E5 | `/api/payment-return` กรณี succeeded (confirm PI ด้วย `pm_card_visa`) → ได้หน้า order confirmed, cookie cart หาย; ลบ JWT แล้ว login ใหม่ไม่กู้ cart ที่ complete | pass |

## Regression (prod build)
core-14 / 14b / 14c / 14d / 14f / 14g, core-30, group-buy-join, core-store (checkout manual payment), payments (order-pay เส้นกลับจาก redirect ของ Stripe), thai-ui-checkout, thai-ui-cart-order: ผ่าน 48 ข้าม 11 ไม่มี fail
test ที่ถูกข้ามคือ test ที่ต้องใช้ Stripe Elements UI (`payments.spec` AC-1–5, `payments-order-pay` ส่วน Stripe test mode, `payments-promptpay-already-paid`) เพราะเครื่อง QA ไม่มี publishable test key — เส้น `/api/payment-return` ตรวจแทนด้วย E4 และ E5

## Defect
ไม่พบ

## ข้อสังเกต (ไม่ใช่ defect)
- O-1: กรณีที่เป็นไปตาม spec เช่น `active_cart_id` เป็นของคนอื่นหรือไม่มีอยู่ (404) ถูก log ด้วย `console.error` พร้อม stack ทำให้ log ของ prod มี noise (reviewer ชี้เหมือนกัน — แก้ใน commit ถัดไปของ PR นี้)
- O-2: หลังสั่งซื้อสำเร็จ `active_cart_id` ยังชี้ไปที่ cart ที่ complete แล้วจนกว่าจะสร้างตะกร้าใบใหม่ ไม่มีผลต่อผู้ใช้เพราะตอน login ตรวจ `completed_at` แล้วไม่กู้
- O-3: ยังไม่มี e2e ใน repo ที่เรียก `/api/payment-return` ของตะกร้าปกติโดยตรง (`payments.spec` ใช้ Stripe UI จึงถูกข้ามเมื่อไม่มี publishable key) เส้นนี้จึงตรวจแค่ใน QA รอบนี้

## สรุป
AC-122 ผ่านครบทุกข้อทั้งที่ 1280 และ 375px บน prod build กฎข้อ 86 (a)–(e) เป็นไปตาม spec และ ADR-019 ไม่พบ regression
