# ADR-021 ลบ shipping method ที่ค้างบน cart voucher ล้วนด้วย hook ของ Medusa

สถานะ: **accepted** (owner 2026-11-09 — เลือกทางเลือก **ก**; spec 02 Q13, แจ้งผ่าน session หลัก; planner เสนอรอบ 26 ตาม review #323)
เกี่ยวข้อง: spec 02 กฎข้อ 8, 24a, 31 (EV-15, AC-45), AC-3; ADR-006 (voucher ส่งมอบแบบดิจิทัล)

## บริบท
- qa รอบ 25: voucher ฿500 + สินค้าจัดส่งเลือก Standard ฿10 แล้วลบสินค้าจัดส่ง → cart เหลือ line `requires_shipping=false` แต่ยังมี method: `shipping_subtotal=9.35`, `total=510`, order 510 — ขัดกฎข้อ 24a และ**บล็อก release v0.1.0**
- ต้นเหตุ: `refreshCartShippingMethodsWorkflow` ของ `@medusajs/core-flows` 2.22.1 ล้าง method ของ profile ที่ไม่มี line ใช้เฉพาะเมื่อ cart มี method มากกว่า 1 (`cart/workflows/refresh-cart-shipping-methods.js:107–110` `shouldCleanupOrphanProfiles`)
- Medusa มี hook `refreshCartItemsWorkflow.hooks.beforeRefreshingPaymentCollection` (`refresh-cart-items.js:183`) รันหลัง refresh method/promotion และก่อน refresh payment collection ซึ่งอ่าน `total` ใหม่ (`refresh-payment-collection.js:50–74`)
- hook ได้แค่ `{ input }` และแยกการลบ line ออกจากการแก้จำนวนไม่ได้: `deleteLineItemsWorkflow` กับ `updateLineItemInCartWorkflow` ส่ง `{ cart_id, additional_data }` เหมือนกัน
- ท้าย AC-3 เดิมระบุว่าไม่มีการบังคับฝั่ง backend ว่า voucher ได้เฉพาะ Digital method และถ้าต้องการต้องเขียน ADR ก่อน; review #323 ชี้ว่าการลบนี้เข้าข่ายการบังคับ จึงเป็นที่มาของ ADR นี้

## ทางเลือก
ก. **[เลือก]** consumer ของ hook `beforeRefreshingPaymentCollection`: cart ที่มี item และทุก line `requires_shipping=false` ลบ method ที่ `shipping_option.type.code !== "digital-delivery"` โดยข้าม refresh ที่มาจากการเพิ่ม method (`input.shipping_methods` ไม่ว่าง)
   — ข้อดี: ใช้ extension point ของ Medusa ไฟล์เดียว ครอบทุกเส้นทางที่ refresh cart และยอด payment collection ตามทันเอง; ข้อเสีย: เป็นการบังคับฝั่ง backend แบบลบเงียบ (ดูผลข้างเคียง)

ข. middleware/route ของเราเองลบเฉพาะตอน `DELETE` line ไม่แตะ AC-3
   — ข้อดี: ไม่กระทบ Standard ที่ยิง API เพิ่มเอง; ข้อเสีย: โค้ดเฉพาะเส้นทางมากกว่า และเส้นทางอื่นที่ทำให้เหลือ voucher ล้วนยังค้างค่าส่ง

ค. ตัดเงื่อนไข `input.shipping_methods` บังคับเต็มรูป
   — ข้อดี: กติกาชัดที่สุด; ข้อเสีย: `POST /store/carts/:id/shipping-methods` ด้วย Standard ตอบ 200 แต่ไม่มี method ใน cart

## การตัดสินใจ
เลือก **ก** — รายละเอียดการทำงานอยู่ใน spec 02 กฎข้อ 31 และท้าย AC-3 แก้ให้ตรงกับ ADR นี้ ไม่เพิ่ม route, workflow, infra หรือ dependency

## ผลที่ตามมา
- **ผลข้างเคียงที่ยอมรับ**: Standard ที่ยิง API เพิ่มบน cart voucher ล้วนยังอยู่หลังการเพิ่ม แต่จะ**หายเงียบใน refresh ถัดไป** (แก้จำนวน, `updateCartWorkflow`, เพิ่ม voucher, transfer) โดยไม่มี error — storefront ไม่มีเส้นทางนี้ (กฎข้อ 24a) จึงกระทบเฉพาะผู้ยิง API ตรง และลูกค้าไม่ถูกคิดค่าส่ง
- ถ้า complete cart ทันทีหลังเพิ่ม Standard โดยไม่มี refresh คั่น order ยังมี method นั้น — เป็นการเลือกของผู้ยิง API เอง และไม่ใช่กรณีของ storefront
- method `type.code = "digital-delivery"` ไม่ถูกลบ; cart ผสมและ cart ว่างไม่ถูกแตะ
- hook นี้มี handler ได้ตัวเดียว (`createHook`) งานในอนาคตที่ใช้ hook เดียวกันต้องรวม handler
- ไม่มี backfill: owner ยืนยันว่าไม่มี order ลูกค้าจริงก่อน v0.1.0 (spec 02 Q12)
- ตอน bump `@medusajs/*` ต้องตรวจว่า hook นี้ยังมีและ `shouldCleanupOrphanProfiles` ยังทำงานแบบเดิม — ถ้า upstream แก้แล้วให้ทบทวนว่ายังต้องใช้ hook หรือไม่
