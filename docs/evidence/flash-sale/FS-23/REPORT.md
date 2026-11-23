# QA Report — FS-23 (PR #490) PDP หักจำนวนในตะกร้า + คนไม่ login เห็นจำกัดต่อคน

Spec: `docs/spec/03-flash-sale.md` กฎข้อ 28 / AC-30 — ทดสอบที่ commit `e217a7f7` (prod build ทั้ง backend และ storefront, จ่ายด้วย pp_system_default)
Playwright report/trace ฉบับเต็มอยู่ใน CI artifact (14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-30 (a) `GET /store/flash-sales/active` ไม่มี token คืน `per_customer_limit` = 2 / null และไม่มี `used_units`/`remaining_for_customer` | pass | ผล test (API) |
| AC-30 (b) ไม่ login + limit 2 → `flash-customer-limit` "จำกัด 2 ชิ้นต่อคน" ไม่มีส่วน "เหลือสิทธิ์" ปุ่มกดได้ | pass | qa490-1-guest-limit.png |
| AC-30 (c) login, ตะกร้ามี L 1 ชิ้น → PDP (M) `product-quantity-select` มีตัวเลือกเดียว (1) และ "เหลือสิทธิ์ 1 ชิ้น" | pass | qa490-2-pdp-limit-minus-cart.png |
| AC-30 (c) กดเพิ่มอีก 1 → `flash-customer-limit-reached` "สิทธิ์ราคาแฟลชเซลที่เหลือของคุณอยู่ในตะกร้าแล้ว" ปุ่ม disabled ทั้งทันทีและหลัง reload | pass | qa490-3-pdp-in-cart-after-reload.png |
| กฎ 28c ลดของในตะกร้าแล้วกลับ PDP → สิทธิ์กลับมา | pass | ผล test |
| กฎ 28c ซื้อครบจาก order → "คุณใช้สิทธิ์ราคาแฟลชเซลครบแล้ว" ปุ่ม disabled | pass | qa490-4-pdp-used-from-order.png |
| 375px สิทธิ์อยู่ในตะกร้าครบ → `mobile-cart-button` disabled | pass | qa490-5-mobile-bar-disabled.png |
| backend ยังกันได้เมื่อเลี่ยง PDP → complete ได้ 409 `FLASH_LIMIT_EXCEEDED` ไม่เกิด order | pass | ผล test (API) |

## Negative / edge case
| กรณี | Result |
|------|--------|
| แคมเปญหมดอายุ → ไม่มี `flash-customer-limit` ปุ่มกดได้ | pass |
| แคมเปญไม่จำกัดต่อคน (null) ไม่ login → ไม่มี `flash-customer-limit` | pass |
| ของในตะกร้าเป็นของแคมเปญอื่น → PDP ไม่หัก | pass |
| สลับ variant M→L (ตะกร้ามี L 1) → เหลือ 1 ทั้งสอง variant | pass |
| ดับเบิลคลิกเพิ่มลงตะกร้าตอนเหลือ 1 → ตะกร้ารวม 2 ชิ้น ไม่เกินสิทธิ์ | pass |
| login แต่ไม่มีตะกร้า → เหลือ 2 | pass |
| regression `fs-21-customer-limit` + `fs-23-pdp-cart-aware-limit` | pass 5/5 |
| ความเสถียร: spec ของ QA รันซ้ำ 3 รอบ | pass 39/39 |

ข้อสังเกต: PDP เลือก variant แรกตามลำดับที่ไม่คงที่ — e2e ของ PR ควรเปิด PDP ด้วย `?v_id=<M>` (nit)
