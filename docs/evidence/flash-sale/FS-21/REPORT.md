# QA FS-21 (PR #441) — spec 03 กฎข้อ 26, AC-28
ทดสอบบน prod build (backend + storefront) ที่ a6566ecc; ชำระเงินด้วย manual payment (ไม่มี Stripe key ในการทดสอบนี้)
e2e ของ PR `fs-21-customer-limit.spec.ts` ผ่าน 3/3; spec ของ QA ผ่าน 10/10 (Playwright report/trace ฉบับเต็มอยู่ใน CI artifact)

| AC / กรณี | Result | Evidence |
|----|--------|----------|
| AC-28 (a) ลูกค้า login, limit 1, ยังไม่เคยซื้อ → ตัวเลือกจำนวนมีแค่ 1 + `flash-customer-limit` "จำกัด 1 ชิ้นต่อคน (เหลือสิทธิ์ 1 ชิ้น)" | pass | qa441-ac28a-pdp-limit.png |
| (a เพิ่ม) limit 2 ซื้อไปแล้ว 1 → ตัวเลือกสูงสุด 1 ข้อความ "จำกัด 2 ชิ้นต่อคน (เหลือสิทธิ์ 1 ชิ้น)" | pass | ผล test Q1b |
| AC-28 (b) ซื้อครบแล้ว → `add-product-button` disabled + `flash-customer-limit-reached` "คุณใช้สิทธิ์ราคาแฟลชเซลครบแล้ว" (variant อื่นในแคมเปญเดียวกันก็ครบ เพราะนับต่อแคมเปญ) | pass | qa441-ac28b-pdp-reached.png |
| AC-28 (c) ตะกร้ามี line flash qty 2 (เพิ่มผ่าน API) → `cart-flash-exceeds-customer-limit` ภาษาไทยบอกว่าเหลือ 1 ชิ้น | pass | qa441-ac28c-cart-warning.png |
| AC-28 (c) ขั้น review → `submit-order-button` disabled + `review-flash-exceeds-customer-limit` มีลิงก์ไปตะกร้า (กดลิงก์แล้วไป /th/cart); ไม่มี POST complete แม้ force click | pass | qa441-ac28c-review-disabled.png |
| AC-28 (c) แก้จำนวนเป็น 1 → คำเตือนหาย ปุ่มกดได้ สั่งซื้อสำเร็จ (หน้า confirmed, 1 order ต่อ cart, `flash_sale_usage.units`=1) | pass | ผล test Q3/Q4 |
| ไม่ login → ไม่มีข้อความจำกัดต่อคน ตัวเลือกจำนวนปกติ (10) | pass | ผล test Q5 |
| มือถือ 375px ใช้สิทธิ์ครบ → `mobile-cart-button` disabled | pass | qa441-q6-mobile-375-disabled.png |
| สองแท็บ: แท็บ 1 ค้างที่ review แท็บ 2 ซื้ออีก cart จนครบ → กดในแท็บ 1 ได้ `manual-payment-error-message` ภาษาไทย, API 409 `FLASH_LIMIT_EXCEEDED`, ไม่มี order, payment collection `not_paid`, ไม่มี payment ถูกสร้าง | pass | ผล test Q7 (+ DB) |
| regression: ลูกค้าคนอื่นยังซื้อสินค้า flash เดียวกันได้ | pass | ผล test Q8 |
| regression: สินค้าที่ไม่ใช่ flash (t-shirt qty 2) ไม่มีข้อความ และปุ่ม review กดได้ | pass | ผล test Q8 |
| edge: แคมเปญหมดอายุ → คำเตือนในตะกร้าหาย, PDP ไม่มีข้อความจำกัด, ปุ่ม review กดได้ | pass | ผล test E1 |
| edge: สอง variant ในแคมเปญเดียวกัน (M 1 + L 1) ที่ limit 1 → เตือนทั้งสอง line และ review disabled | pass | ผล test E2 |
| edge: ดับเบิลคลิก "สั่งซื้อ" หลังแก้จำนวน → ได้ order เดียว | pass | ผล test Q4 |
| edge: webhook replay | ทดสอบไม่ได้ | ไม่มี Stripe test key ในการทดสอบนี้ (manual payment) |

ข้อสังเกต (ไม่ผิด spec): ถ้ามีสินค้า flash อยู่ในตะกร้าแล้ว (ยังไม่สั่ง) PDP ยังแสดงสิทธิ์เต็มเพราะ `used_units` นับเฉพาะ order ที่สั่งแล้ว — ตะกร้า/review ยังกันก่อนจ่ายตามกฎ 26b
