# REPORT — PAY-18 (PR #532) payment-return failed+5xx, checkout `cart_id` ≠ cookie, notice ตะกร้าหายหลังแก้

spec: `docs/spec/06-*.md` หัวข้อ "Follow-up รอบ 42" · กฎข้อ 20 · AC-31
ทดสอบโดย qa บน prod build (backend `NODE_ENV=production medusa start`, storefront `next build && next start`) commit `98551035` · viewport 375×812 และ 1280×720 · Stripe key ปลอม
หา element ด้วย `data-testid` ตรวจภาษาไทยด้วย regex อักษรไทย
Playwright report และ trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR #532 (14 วัน)

| AC / ข้อ | ผล | Evidence |
|----|----|----------|
| AC-31 (20c) `/th/cart?error=refunded` เปลี่ยนจำนวนสำเร็จ: notice หาย, URL ไม่มี `error`, `history.length` ไม่เพิ่ม, Back กลับ `/th/store`, Forward/reload ไม่มี notice (375 + 1280) | pass | `ac31-notice-cleared-375.png`, e2e `pay-18-cart-error-notice-clear.spec.ts` |
| AC-31 (20c) ตะกร้า 2 รายการ ลบ 1 รายการ: notice หาย URL ไม่มี `error` (375 + 1280) | pass | QA spec (ไม่ commit) |
| AC-31 (20c) แก้จำนวนไม่สำเร็จ (สต็อก 2 เลือก 5): `product-error-message` ภาษาไทย, notice ยังอยู่, URL ยังมี `error`, จำนวนใน backend ยังเป็น 1 | pass | `ac31-stock-fail-notice-kept-1280.png` |
| regression AC-25 (PAY-12): `refunded`/`order_failed`/`payment_failed` ข้อความไทย 3 แบบต่างกัน; `xyz`, `<script>`, ค่าว่าง, `error` ซ้ำสองค่า ไม่แสดง notice | pass | QA spec (ไม่ commit) |
| AC-31 (20a) `/api/payment-return` backend ล้ม (network) และ mock 500: `failed` → `307 /th/checkout?step=payment` ไม่มีพารามิเตอร์ Stripe; `succeeded` → `step=review&cart_id=…`; ไม่มี `Set-Cookie _medusa_cart_id` | pass | curl header `Location` + unit `core-29-active-cart.test.ts` |
| AC-31 (20b) checkout `cart_id` = cart X ที่ complete แล้ว ขณะ cookie ชี้ cart Y → `/th/order/<order ของ X>/confirmed` (375 + 1280) | pass | `ac31-checkout-cartid-mismatch-confirmed-1280.png` |
| AC-31 (20b) `cart_id` ของลูกค้าอื่น (complete แล้ว/ยังเปิด) → `/th/account/orders` ไม่มีข้อมูลของลูกค้าอื่น | pass | QA spec (ไม่ commit) |
| unit ของ PR (`core-29-active-cart`, `pay-12-checkout-return`, `cart-error`) 66 tests | pass | vitest |
| flow Stripe จริง (กลับจาก 3DS/PromptPay `redirect_status=failed` ขณะ backend ปกติ) | ข้าม — CI | key ในเครื่องเป็นค่าปลอม |

## negative/edge (นอก spec)
- ลบรายการสุดท้ายจนตะกร้าว่าง: notice หาย URL ไม่มี `error`
- ใส่/ลบโค้ดส่วนลด: notice ยังอยู่ (`itemsKey` นับเฉพาะ id:quantity — ตรงถ้อยคำ 20c "แก้ตะกร้า" = รายการสินค้า)
- `cart_id` รูปแบบผิด (`../x`) ไม่เข้าทางหา order → flow ปกติ redirect `step=payment`
- เปิด `/th/order/<order ของลูกค้าอื่น>/confirmed` ตรงๆ → หน้าไม่พบ ไม่มีข้อมูลรั่ว
- payment-return อ่าน cart ได้ 500: `redirect_status=FAILED` (ตัวใหญ่) หรือ `processing` → `step=review`; ไม่มี `country_code` → `/checkout?step=payment`
- เครื่อง load ~10: รอบแรกที่ 375 notice หายช้ากว่า 5 วินาที (RSC 2 round trip) รันซ้ำ 3 รอบ × 2 viewport ผ่านทั้ง 6 รอบ — ไม่ใช่ defect

**Defect**: ไม่มี
