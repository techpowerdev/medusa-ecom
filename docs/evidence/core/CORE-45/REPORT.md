# QA CORE-45 — checkout เปิด step ที่ใช้ไม่ได้ → ขั้นแรกที่ยังไม่เสร็จ (PR #288) รอบ 2

Spec: `docs/spec/01-core-medusa.md` กฎข้อ 103, AC-139 (regression: กฎข้อ 99, AC-135, AC-129)

สภาพแวดล้อม:
- prod build: backend `medusa build`/`medusa start`, storefront `next build`/`next start`
- commit `ab6fa8c` (รอบแรก `e49fc2c`)
- viewport 1280×900 และ 375×812, Stripe test mode
- หา element ด้วย `data-testid` และตรวจข้อความไทยด้วย regex `[฀-๿]`

Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact ของ PR #288 (เก็บ 14 วัน)

ประวัติ: qa รอบแรก (`e49fc2c`) ผ่าน AC-139 ครบ แต่พบ D-1 คือหลังบันทึกที่อยู่ หน้าเด้งกลับไป `step=address` เป็นบางครั้งตอนเครื่องโหลดสูง (4/6 flow) เพราะ cart ที่อ่านจาก force-cache ยังไม่มีที่อยู่ แล้วกฎข้อ 103b จึง redirect กลับ

สิ่งที่แก้ในรอบนี้ (D-1): ถ้า cart จาก force-cache บอกให้ redirect หน้าจะอ่าน cart ใหม่แบบ no-store แล้วตัดสินซ้ำ (`checkoutRedirectWithLatest`) และ render ด้วย cart ล่าสุด ถ้าไม่ต้อง redirect จะไม่อ่าน cart เพิ่ม

สภาพ cart ใน matrix (สร้างผ่าน Store API ด้วย token ของ customer ทุกครั้ง):
- t-shirt ไม่มีที่อยู่
- t-shirt มีที่อยู่แต่ยังไม่มีวิธีส่ง
- t-shirt ค้างวิธีส่ง Digital
- t-shirt ครบ
- digital-only ไม่มีที่อยู่
- digital-only มีที่อยู่

query ที่ทดสอบ: ไม่มี step, `foo`, `REVIEW`, `Delivery`, `address&address`, `delivery&payment`, `address`, `delivery`, `payment`, `review`

ทุกช่องตรวจว่า:
- status < 400
- `step` ตรงกับผลที่คาดตามกฎข้อ 103 (คำนวณแยกจาก helper ของ PR)
- navigation ≤ 2 และไม่มี `POST /store/carts/<id>/complete`
- ฟอร์มของขั้นนั้นเปิด และหัวข้อเป็นภาษาไทย
- ไม่มี horizontal scroll และไม่มี `submit-order-button` ที่กดได้

| AC | Result | Evidence |
|----|--------|----------|
| กฎ 103a: ไม่มี step, step ไม่รู้จัก (`foo`/`REVIEW`/`Delivery`) หรือ step ซ้ำ → ขั้นแรกที่ยังไม่เสร็จ (ไม่มีที่อยู่ → address, มีที่อยู่ไม่มีวิธีส่ง/ค้าง Digital → delivery, ครบ → payment, digital-only ไม่มีที่อยู่ → address, digital-only มีที่อยู่ → payment) ที่ 1280/375 | pass (matrix 120/120 ช่อง) | qa-01-tshirt-no-address-step-foo-to-address-375.png |
| กฎ 103b: `step=delivery` ขณะยังไม่มีที่อยู่ (t-shirt และ digital-only) → `step=address` ฟอร์มที่อยู่เปิด ไม่มี `delivery-option-radio` | pass | ผล test matrix ของ qa และ e2e `core-41` describe CORE-45 |
| กฎ 103c: `step=delivery` บน cart digital-only ที่มีที่อยู่ → `step=payment` ไม่มี `delivery-options-container` | pass | qa-02-digital-only-delivery-to-payment-375.png |
| ไม่ redirect: `step=address` ทุกสภาพ cart และ `step=delivery` เมื่อมีที่อยู่แล้ว → delivery เปิดและมี radio | pass | ผล test matrix ของ qa |
| กฎ 103d / AC-135 / AC-129: payment/review ก่อนขั้นก่อนหน้าเสร็จ → address หรือ delivery; cart ครบอยู่ที่ payment/review ได้ | pass | ผล test matrix ของ qa |
| ไม่วน: navigation ≤ 2 (วัดได้ 2 ทั้ง 137 ครั้งที่เปิดหน้า) และไม่มี `/complete` | pass | ผล test ของ qa |
| **D-1 แก้แล้ว**: กรอกที่อยู่แล้วกด `submit-address-button` → `step=delivery` เห็น `delivery-option-radio` ไม่เด้งกลับ address (flow จาก `checkout-button` และ `/buy/<variant>:1` ทั้งที่ login อยู่แล้วและต้อง login ก่อน, 1280/375, ภายใต้โหลดสูง) | pass (submit 203 ครั้ง, เด้งกลับ 0) | qa-03-d1-cart-flow-submit-address-to-delivery-1280.png |
| **D-1 cart เก่าใน cache**: เปิด checkout ให้ cache cart ที่ไม่มีที่อยู่ → ตั้งที่อยู่ (หรือที่อยู่ + Standard) ผ่าน Store API → เปิด `step=delivery` / `step=foo` → delivery มี radio; ไม่มี step / `step=payment` → payment (4 เคส × 2 viewport) | pass (8/8 ในรอบปกติ, 88/88 ในรอบโหลด) | qa-04-d1-stale-cache-step-delivery-375.png |
| Flow จริง: cart ไม่มีที่อยู่ → address, cart ครบ → payment; `/buy` → address → Standard → manual payment → order confirmed (1280/375) | pass | ผล test ของ qa (flow ×4 × 2 viewport) |
| Stripe test: `/api/payment-return?redirect_status=failed` บน cart ครบ → `/th/checkout?step=payment` ยังมี `payment_intent`, `payment_intent_client_secret`, `redirect_status=failed` | pass | qa-05-stripe-return-failed-step-payment-1280.png |
| Regression e2e: `core-41-checkout-first-step` (รวม D-1 ของ builder), `core-14-buy-login`, `thai-ui-checkout`, `core-32-*`, `core-40-*`, `ev-7c-*` | pass 18/18 | ผลรัน chromium |
| Unit: vitest `ev-7c-digital-only-checkout.test.ts` (AC-139 + `checkoutRedirectWithLatest` 5 เคส) | pass 59/59 | ผลรัน |

## ยืนยัน D-1 ภายใต้โหลด
ตรวจด้วยสแกนเนอร์ trace ที่นับ server action บันทึกที่อยู่ซึ่งได้ `x-action-redirect: …step=delivery` แล้วตามด้วย GET `/checkout?step=address` (ลักษณะของ D-1) ใช้กับ trace ของรอบแรกแล้วจับได้ 4/6 ตรงกับรายงานเดิม จึงเชื่อถือได้

| รอบ | workers × repeat | load avg สูงสุด | test ผ่าน | บันทึกที่อยู่ | redirect → delivery | เด้งกลับ address |
|-----|------------------|-----------------|-----------|---------------|---------------------|------------------|
| ปกติ | 3 × 1 | ~7 | 31/31 | 7 | 7 | 0 |
| load | 8 × 6 | 9.6 | 102/102 | 36 | 36 | 0 |
| load2 | 12 × 10 | 63 | 60/70 | 61 | 60 | 0 |
| load3 (ถ่ายรูป evidence) | 8 × 5 | 10 | 85/85 | 30 | 30 | 0 |
| load4 | 12 × 10 | 32 | 69/70 | 69 | 69 | 0 |
| **รวม** | | | | **203** | **202** | **0** |

test ที่ fail ใน load2/load4 ไม่ใช่ D-1 (ดู Observation ข้อ 1) ส่วนบันทึกที่อยู่ 1 ครั้งที่ไม่ redirect คือ server action ไม่ตอบภายใน ~57 วินาทีตอน load average ~60

ยืนยันว่า cache เก่าจริงตอนทดสอบ (probe): หลังตั้งที่อยู่ผ่าน Store API หน้า `step=address` (ซึ่งไม่ redirect จึง render ด้วย cart จาก cache) ยังแสดงช่องชื่อว่าง แต่ `step=delivery` ได้ `step=delivery` และ radio 1 อัน ส่วน red log ของ builder บน `e49fc2c` ก็ fail ด้วยการจำลองเดียวกัน (`Received …?step=address`)

## Negative / edge case (cart t-shirt ไม่มีที่อยู่ ยกเว้นที่ระบุ) — ได้ผลเหมือนรอบแรก
- `?step=`, `?step=%20delivery`, `?step=delivery&step=delivery`, `?step=foo&x=1` → `?step=address` (query อื่นหายไป ซึ่งรับได้)
- `/checkout?step=delivery` ที่ไม่มี country prefix → `/th/checkout?step=address`
- ยังไม่ login แล้วเปิด `/th/checkout?step=foo` → 404 ไม่วน (พฤติกรรมเดิมของ `page.tsx`)
- cart ว่าง → `?step=address`
- cart ที่ complete แล้ว (ผ่าน API) → `?step=payment`
- cart เก่าใน cache + เปิด step ที่ไม่ต้อง redirect → render ด้วย cart จาก cache ตามเดิม (ไม่อ่าน cart เพิ่ม)
- ทุกเคส: navigation 2 ครั้ง ไม่มีการยิง `/complete`

## Defect
ไม่พบ defect ใหม่ D-1 ของรอบแรกปิดได้แล้ว

## Observation
1. ตอนรัน 12 workers (load average 32–63) การกด `checkout-button` ที่หน้า `/th/cart` บางครั้งไม่ย้ายหน้าภายใน 30 วินาที
   - เกิด 9/10 ของ flow cart @1280 ใน load2 ซึ่งเป็น test แรกของไฟล์ ทุก worker จึงเริ่มพร้อมกันตอนช่วงโหลดสูงสุด และเกิด 1/10 ใน load4
   - trace: RSC ของ `/th/checkout?step=address` ตอบ 200 แต่ router ไม่ย้ายหน้า
   - เกิดก่อนเข้า logic ของ checkout-form และ `step=address` ไม่สั่ง redirect จึงไม่ได้รันส่วนที่ PR แก้ ที่ 8 workers ไม่เกิดเลย (187/187)
   - ยังไม่ได้ทดสอบเทียบบน develop ไม่ใช่ D-1
2. stock ของ T-SHIRT-L หมดหลัง test สั่งซื้อจริงไปประมาณ 100 order (จอง 100/100) ทำให้รอบหนึ่ง fail ตั้งแต่ขั้นเพิ่มสินค้า เป็นปัญหาข้อมูลทดสอบ เติม stock ผ่าน admin API แล้วรันใหม่ผ่านครบ
3. `step=address` และ `CheckoutSummary` ยังแสดงจาก cart ใน cache ถ้า cart ถูกแก้นอก server action ของ storefront (เช่น ยิง Store API ตรง) flow จริงไม่เจอเพราะ mutation ของ storefront เรียก `revalidateTag` อยู่นอก scope ของ CORE-45
4. ข้อสังเกตเดิมจากรอบแรกยังอยู่:
   - `/th/buy/<variant>:1` ตอบ 404 (route จริงคือ `/buy/…`)
   - ทุกหน้า checkout มี `framenavigated` 2 ครั้ง
   - cart ที่ complete แล้วยังเปิด checkout ได้

## สรุป
PR #288 ที่ `ab6fa8c` ทำตามกฎข้อ 103 และ AC-139 ครบทั้ง 1280 และ 375 matrix ได้ผลเหมือนรอบแรกครบ 120 ช่อง ไม่วน ไม่ยิง `/complete` และ Stripe failed return ยังเก็บ query ไว้ D-1 แก้แล้ว: บันทึกที่อยู่ผ่าน UI 203 ครั้ง (รวมช่วง load average สูงสุด 63) ไม่เด้งกลับ `step=address` เลย และการจำลอง cart เก่าใน cache ได้ผลตาม cart ล่าสุดทุกเคส regression ผ่าน e2e 18/18 และ unit 59/59 ไม่พบ defect ใหม่
