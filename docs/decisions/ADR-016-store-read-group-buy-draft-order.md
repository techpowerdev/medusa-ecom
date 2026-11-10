# ADR-016 store route อ่านอย่างเดียวสำหรับ draft order ของ group buy (membership ของลูกค้า)

สถานะ: **accepted** (owner 2026-10-27 — เลือกทางเลือก A; เสนอโดย planner รอบ 10)
เกี่ยวข้อง: spec 04 (GB-8, GB-7, กฎข้อ 21–22), spec 06 (PAY-3a/PAY-3b), ADR-004, ADR-009, ADR-013, ADR-015 ภาคผนวก (collection ที่ไม่มี cart)

## บริบท
- ลูกค้าที่เข้าร่วมกลุ่มได้ **draft order** (`is_draft_order=true`) และเมื่อกลุ่มสำเร็จ GB-4 สร้าง payment collection บน draft order แล้วส่งอีเมลลิงก์
  `/account/orders/<order_id>/pay` (`group-outcome.ts`) — หน้าชำระเงิน (PAY-3) ต้องอ่าน draft order + payment collection + payment session ของ order นั้น
  และหน้า account (GB-7) ต้องแสดงรายการ draft order ของกลุ่มพร้อมสถานะ/เส้นตายชำระเงิน
- builder PAY-3 ตรวจ Medusa 2.22.1 แล้ว: Store API **อ่าน draft order ไม่ได้** — `GET /store/orders` และ `GET /store/orders/:id` กรอง `is_draft_order: false`
  ใน handler เอง (middleware เปลี่ยนไม่ได้) และไม่มี store route ของ draft order (มีเฉพาะ `/admin/draft-orders*`); ไม่มี store route อ่าน payment collection
  ตาม id (`POST /store/payment-collections/:id/payment-sessions` สร้าง session ได้ แต่โหลดหน้าใหม่แล้วอ่าน session เดิมไม่ได้)
- ตัวอย่าง Quotes ของ Medusa (pattern ที่ spec 04 อ้าง) แก้ช่องเดียวกันด้วย custom store route ใต้ `/store/customers/me/quotes*` ที่อ่าน draft order ผ่าน Query
- spec 04 ส่วน API เดิมเขียนว่า "ไม่มี custom payment route" — ADR นี้**ไม่**เพิ่ม route ชำระเงิน (สร้าง session ยังใช้ route ของ Medusa) เพิ่มเฉพาะ route **อ่าน**

## ทางเลือก
A. **route อ่านอย่างเดียวผูกกับ membership ของ group buy** (ตาม pattern Quotes):
   `GET /store/customers/me/group-buy/memberships` (รายการ) และ `GET /store/customers/me/group-buy/orders/:order_id` (รายตัว ตาม order id ในลิงก์อีเมล)
   — หา membership ด้วย `customer_id = auth_context.actor_id` (module ของเรา) แล้วอ่าน order ผ่าน read-only link `group_buy_membership ↔ order` (ADR-009) และ
   `order.payment_collections` ด้วย `query.graph`; ไม่ใช่ของผู้เรียก/ไม่พบ → 404 (ADR-013 ข้อ 2)
B. **route draft order ทั่วไป** `GET /store/customers/me/draft-orders/:id` (draft order ใดก็ได้ที่ `customer_id` ตรง) — เปิด draft order ที่ admin สร้างเอง
   (ฟีเจอร์ draft order ของ Medusa admin เช่น ใบเสนอราคา/order โทรศัพท์) ให้ลูกค้าเห็นด้วยซึ่งไม่มีใครขอ และไม่มีข้อมูลกลุ่ม (สถานะ/เส้นตาย) ที่ GB-7 ต้องใช้ → ต้องยิงเพิ่ม
C. **middleware ปลด filter `is_draft_order` บน `GET /store/orders/:id`** — filter อยู่ใน handler ทำไม่ได้โดยไม่ห่อ/แทน route ของ Medusa (ขัด CLAUDE.md ข้อห้าม 1, ADR-013 ทางเลือก C)
D. **ใส่ข้อมูล order ใน route สาธารณะ `GET /store/group-buy/groups/:token`** — route นี้เป็นการเรียกดูสาธารณะ (ไม่บังคับ login) จะรั่ว PII/ยอดของสมาชิก
E. **ไม่มี route: storefront เก็บ `client_secret` จาก response ของ `POST .../payment-sessions` ไว้ใน cookie/URL** — โหลดหน้าใหม่/เปิดจากอีเมลอีกเครื่องไม่ได้,
   แสดงสถานะ "ชำระแล้ว"/"หมดเวลา" และรายการใน account ไม่ได้ (GB-7 ยังต้องมีรายการอยู่ดี)

## การตัดสินใจ (owner อนุมัติ 2026-10-27)
เลือก **A**
1. สอง route ใต้ `/store/customers/me/group-buy/*` — Medusa ใส่ `authenticate("customer", ["session","bearer"])` ให้ `/store/customers/me*` อยู่แล้ว
   (builder ยืนยันกับ source 2.22.1 ถ้าไม่ครอบให้ใส่เองใน `src/api/middlewares.ts`); route อ่านอย่างเดียว ไม่มี workflow (ไม่มีการเขียน)
2. ownership ตามกฎ ADR-013: filter `customer_id = actor_id` ใน query เดียวกับการหา → ไม่ใช่ของผู้เรียก/ไม่มี/membership ไม่มี order → **404** `not_found`
3. response ของรายตัวรวม `payment_collections[].payment_sessions[]` เฉพาะ field ที่หน้าชำระเงินต้องใช้ (review #140): `id`, `provider_id`, `status`, `amount` และจาก `data`
   เพียง `data.id` (PaymentIntent id), `data.client_secret`, `data.status` — **ไม่**คืน `data` ทั้งก้อนของ provider (ลดข้อมูลเกินจำเป็น แม้ cart ของ Medusa คืนทั้งก้อน);
   `Cache-Control: private, no-store`
4b. index: route รายการหา membership ด้วย `customer_id` เรียง `joined_at` → เพิ่ม index `(customer_id, joined_at)` (`WHERE deleted_at IS NULL`) บน `group_buy_membership` + migration
   ใน PR ของ GB-8 (index เดิม `(campaign_id, customer_id)`/`(group_id, status)` ไม่ขึ้นต้นด้วย `customer_id`)
4. การสร้าง/ต่อ payment session ยังใช้ `POST /store/payment-collections/:id/payment-sessions` ของ Medusa + ownership ของ CORE-12 (owner ผ่าน `order.customer_id`) +
   guard ของ PAY-6a (lock `payment_collection_id` ตามภาคผนวก ADR-015) — ไม่มี custom payment route
5. route ทำงานต่อได้หลัง draft order ถูกแปลงเป็น order ปกติ (GB-5) — อ่านผ่าน membership ไม่ขึ้นกับ `is_draft_order`
6. ถ้า Medusa เพิ่ม store route อ่าน draft order ของลูกค้าเองในอนาคต → ทบทวน/ลบผ่าน ADR ใหม่ (checklist bump ใน spec 07)

## ผลที่ตามมา
+ ใช้ข้อมูลของ module ของเรา (membership) เป็นตัวกำหนดสิทธิ์ ไม่เปิด draft order ประเภทอื่นของ Medusa
+ GB-7 (รายการใน account) และ PAY-3b (หน้าชำระเงิน + poll หลัง `PAYMENT_ALREADY_COMPLETED`) ใช้ route ชุดเดียวกัน (ผู้ใช้ 2 ที่)
+ ไม่แตะ route/workflow ของ Medusa
− store route ใหม่ 2 ตัวที่ต้องรักษา + 1 query.graph ต่อ request
− ถ้าภายหลังมี draft order ที่ไม่ใช่ group buy ต้องชำระผ่านหน้าเดียวกัน ต้องขยาย route หรือ ADR ใหม่
