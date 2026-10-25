# ADR-013 บังคับความเป็นเจ้าของ cart/order บน store route ด้วย middleware

สถานะ: accepted (เจ้าของโปรเจกต์, 2026-10-25)
เกี่ยวข้อง: spec 01 (กฎ no-guest, CORE-6, CORE-12, CORE-13), CLAUDE.md ข้อห้าม 5

## บริบท
builder CORE-6 พบ และตรวจกับ source Medusa 2.22.1 แล้วว่า Medusa ไม่ตรวจว่า cart เป็นของ customer ที่ล็อกอินอยู่:
- `packages/medusa/src/api/store/carts/middlewares.ts` ใช้ `authenticate("customer", …)` เฉพาะ `POST /store/carts/:id/customer`
  route อื่นทั้งหมด (GET/POST cart, line-items, promotions, shipping-methods, taxes, complete) ไม่มี auth และไม่เทียบ owner
- `updateCartWorkflow` (core-flows) ไม่เทียบ `customer_id` ของ cart กับ auth context และ input ของ workflow ไม่มี auth context
- `/store/payment-collections*` ไม่มี auth; `GET /store/orders/:id` ไม่มี auth (ใช้ id เป็นความลับ ออกแบบมาเพื่อ guest)
หลัง CORE-6 ผู้เรียกต้องล็อกอิน แต่ customer B ที่รู้ cart id ของ A ยังอ่าน (PII: ที่อยู่, อีเมล) และแก้/complete cart ของ A ได้

## ทางเลือก
A. **Middleware ใน `src/api/middlewares.ts`** (กลไกทางการ `defineMiddlewares`) ต่อจาก `authenticate("customer")`: หา owner ของ resource
   ที่อ้างใน path/body/query ด้วย `query.graph` (cart → `customer_id`, payment collection → cart/order, order → `customer_id`)
   แล้วเทียบกับ `req.auth_context.actor_id` ไม่ตรง → 404 — หนึ่ง query ตาม PK ต่อ request, ไม่แตะ route/workflow ของ Medusa
B. **hook `validate` ของแต่ละ workflow** (updateCart, addToCart, completeCart, …) — input ของ hook ไม่มี auth context
   (ต้องส่งผ่าน `additional_data` ซึ่ง client กำหนดเองได้ → เชื่อถือไม่ได้), บาง workflow ไม่มี hook, และ hook หนึ่งตัวมี handler
   ได้ตัวเดียว (spec 03 กฎข้อ 8) ทำให้ชนกับ handler ที่มีอยู่
C. **ห่อ/แทน route ของ Medusa** — ขัด CLAUDE.md ข้อห้าม 1 และต้องตามแก้ทุกครั้งที่ bump เวอร์ชัน
D. **คงเดิม** ถือว่า cart id เดาไม่ได้ — id รั่วได้ทาง log, URL (`cart/resume/<id>`), screenshot; ขัดกฎ no-guest เชิงเจตนา

## การตัดสินใจ
เลือก A
1. helper เดียว `ensureStoreOwnership(resolveOwner)` ใช้กับหลาย matcher (มีผู้ใช้ ≥ 2 ที่ ตามกฎ abstraction)
2. ไม่ตรง/ไม่พบ/owner เป็น null → 404 `not_found` (ไม่บอกว่า resource มีอยู่) ไม่ใช่ 403
3. route ของเราเองที่รับ `cart_id` (เช่น GB join) ตรวจ owner แบบเดียวกัน
4. ถ้าภายหลัง Medusa เพิ่มการตรวจ owner เอง → ลบ middleware นี้ผ่าน ADR ใหม่

## ผลที่ตามมา
+ ใช้กลไกทางการ ไม่แตะ core; test ได้ด้วย integration http ทีละ route
+ ปิดช่อง PII ของ cart/order
− ต้องรักษารายการ matcher ให้ครบเมื่อ Medusa เพิ่ม store route ที่รับ cart/order id ใหม่ (ตรวจทุกครั้งที่ bump เวอร์ชัน — ใส่ใน checklist ของ ADR bump)
− เพิ่ม 1 query ต่อ request ของ cart (PK lookup — ยอมรับได้)
