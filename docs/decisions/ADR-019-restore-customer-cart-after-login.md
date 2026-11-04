# ADR-019 กู้ตะกร้าของลูกค้าหลัง login ใหม่ (หลัง JWT หมดอายุ/ถูกลบ)

สถานะ: **proposed** (planner รอบ 16 2026-11-04 — รอ owner)
เกี่ยวข้อง: spec 01 กฎข้อ 25, 40, 84, 86 (CORE-29, AC-122), AC-43, CORE-14a/14c/14g; ADR-013 (ownership ของ cart); spec 04 กฎข้อ 14c, 29c (cart ของ group buy ไม่เป็น cart ปัจจุบัน)

## บริบท
- ไม่มี guest (CLAUDE.md ข้อห้าม 5): request ที่ไม่มี `_medusa_jwt` แต่มี `_medusa_cart_id` → middleware `clearStaleCartCookie` (CORE-14a, AC-43) ล้าง cookie cart
  ตอน GET/RSC; CORE-14g (#234) ยกเว้นเฉพาะ request ของ server action
- ผล (qa #222 / รอบ 14b): JWT หมดอายุหรือถูกลบ → เปิดหน้าใดก็ได้ → cookie cart ถูกล้าง → login ใหม่ → `transferCart()` ไม่มี cart ให้โอน → ตะกร้าว่าง
  ทั้งที่ cart ใน backend ยังอยู่ครบ (`customer_id` = ลูกค้า, `completed_at` null)
- Medusa 2.22.1 **ไม่มี**วิธีหา cart ของ customer ผ่าน Store API: `packages/medusa/src/api/store/carts/route.ts` export เฉพาะ `POST` (สร้าง cart);
  docs storefront ของ Medusa (`storefront-development/cart/retrieve`) ให้เก็บ cart id ฝั่ง client แล้วเรียก `GET /store/carts/:id`; Next.js Starter กู้ได้เฉพาะจาก cookie
- customer มี `metadata` ที่ลูกค้าแก้เองได้ผ่าน `POST /store/customers/me` (route ของ Medusa ส่ง body ให้ `updateCustomersWorkflow` ตรงๆ)
- ลูกค้ามี cart หลายใบที่ไม่ใช่ "ตะกร้าหลัก" ได้: cart ของ group buy ต่อการ join รวม cart ที่เตรียมไว้แต่ไม่ได้ join (spec 04 กฎข้อ 14c, 29c) และ cart ที่ complete แล้ว

## ทางเลือก
A. **custom store route อ่านอย่างเดียว** `GET /store/customers/me/carts/latest` (ใต้ `/store/customers/me*` ซึ่ง Medusa บังคับ `authenticate("customer", ...)` อยู่แล้ว):
   `query.graph` cart ที่ `customer_id = actor_id`, `completed_at` null, เรียง `updated_at` ล่าสุด, ตัด cart ที่มี promotion `GB-*` และ cart ที่เตรียมไว้ของกลุ่ม
   (ต้องเพิ่ม marker ใน `cart.metadata` ตอน `prepareGroupCart`) แล้วคืน `{ cart: { id } | null }`
   — ข้อดี: กู้ cart ที่สร้างก่อน deploy ได้; ข้อเสีย: route ใหม่ฝั่ง backend + integration test, และกติกาตัด cart ที่ "ไม่ใช่ตะกร้าหลัก" ต้องตามให้ทันทุกชนิดในอนาคต
   (ถ้าลืม marker จะกู้ cart ผิดใบ), ~150 LOC backend + storefront
B. **[แนะนำ] จำ id ของตะกร้าหลักใน `customer.metadata.active_cart_id` ด้วย API ของ Medusa**: storefront เขียนค่าเมื่อตั้ง cookie `_medusa_cart_id` เป็น cart ใหม่
   และอ่านตอน login เมื่อไม่มี cookie cart แล้วตรวจด้วย `GET /store/carts/:id` (ownership ของ CORE-12 → cart ของคนอื่นได้ 404) + `completed_at`
   — ข้อดี: ไม่มี backend/route/model ใหม่ (CLAUDE.md ข้อห้าม 1 และ 3), กู้ "cart ที่อยู่ใน cookie ครั้งล่าสุด" ตรงความหมาย ไม่ต้องมีกติกาตัด cart ของกลุ่ม
   (cart ของกลุ่มไม่เคยเป็น cookie ตามกฎข้อ 14c); ข้อเสีย: `POST /store/customers/me` เพิ่ม 1 ครั้งต่อการสร้างตะกร้าใหม่ (ไม่ใช่ทุก request), cart ที่สร้างก่อน deploy
   กู้ไม่ได้ (ยอมรับได้ — ค่าถูกเขียนตั้งแต่ตะกร้าใบถัดไป), สองแท็บสร้าง cart พร้อมกันแล้วค่าหลังสุดชนะ, ลูกค้าแก้ค่าเองได้ (ปลอดภัยเพราะ CORE-12 ตรวจเจ้าของทุกครั้ง)
C. **ไม่กู้**: ยอมรับว่าตะกร้าหายหลัง login ใหม่ (สถานะปัจจุบัน — spec 01 รอบ 14b ระบุเป็น out of scope) ลูกค้าต้องเพิ่มสินค้าใหม่
D. ไม่ล้าง cookie cart ตอน GET เมื่อ JWT หาย (ยกเลิก AC-43): ขัดกฎข้อ 25/AC-43 ที่ accepted แล้ว และหน้าจะแสดง cart ที่อ่านไม่ได้ (401) แบบกำกวม — ไม่เสนอ

## การตัดสินใจ (เสนอ — รอ owner)
เลือก **B** รายละเอียดที่ทดสอบได้อยู่ใน spec 01 กฎข้อ 86 และ AC-122 (CORE-29):
1. key เดียว `metadata.active_cart_id` บน customer เขียนผ่าน `sdk.store.customer.update` จาก helper เดียวใน `apps/storefront/src/lib/data/`
2. เขียนทุกครั้งที่ตั้ง cookie `_medusa_cart_id` เป็น cart ใหม่ (`getOrSetCart`, `activateCart`, `app/api/payment-return/route.ts`) ถ้าเขียนไม่สำเร็จให้ log แล้วไปต่อ (การสร้าง cart ไม่ล้ม)
3. ตอน login: หลัง `transferCart()` ถ้าไม่มี cookie cart → อ่านค่า → `GET /store/carts/:id` ด้วย token ใหม่ → 200 และ `completed_at` null → `setCartId`;
   กรณีอื่นทั้งหมดไม่ตั้ง cookie และ login สำเร็จตามเดิม
4. ไม่ทับ cookie cart ที่มีอยู่ ไม่ merge cart สองใบ ไม่แตะกฎข้อ 84/AC-43
5. ค่าใน metadata เป็นแค่ hint ห้ามใช้ตัดสินสิทธิ์ใดๆ (สิทธิ์ตรวจโดย CORE-12 เท่านั้น)

## ผลที่ตามมา
- ไม่มี route, model หรือ infra ใหม่ storefront เพิ่ม helper 1 ตัวและแก้ 3 จุดที่ตั้ง cookie กับขั้นท้ายของ `completeLogin`
- admin เห็น `active_cart_id` ใน metadata ของลูกค้าได้ (ไม่ใช่ PII)
- ถ้าภายหลังมีช่องทางอื่นที่สร้างตะกร้าหลัก (เช่น mobile app) ต้องเขียนค่าเดียวกัน หรือย้ายไปทางเลือก A
- ถ้า owner เลือก A: CORE-29 แยกเป็น route backend + storefront และต้องเพิ่ม marker ให้ cart ที่เตรียมไว้ของกลุ่ม (spec 04); ถ้าเลือก C: ตัด CORE-29 และ AC-122
