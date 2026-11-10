# ADR-022 กำหนด stock location ของ return จากหน้าเว็บจาก return shipping option ฝั่ง server

สถานะ: **accepted** (owner เลือกทางเลือก ก 2026-11-10 — Q-C5)
เกี่ยวข้อง: spec 01 กฎข้อ 113 (CORE-55, AC-150..154), CORE-16, CORE-17, CORE-21

## บริบท
- ทดสอบจริงบน develop `84b9e610`: ลูกค้าขอคืนจาก `/th/account/orders/details/<id>/return` แล้วแอดมินกด Receive items → `POST /admin/returns/:id/receive/confirm` ตอบ 500 `Cannot receive the Return at location null` ทำซ้ำได้ — **บล็อก release v0.1.0** (order `manage_inventory=true` รับของคืนไม่ได้, stock ไม่คืน, ไม่เกิด `order.return_received` และ reversal ค่าคอม)
- ต้นเหตุใน `@medusajs/core-flows` 2.22.1: `createAndCompleteReturnOrderWorkflow` หา location จาก return shipping option แต่ใช้กับ fulfillment เท่านั้น (`order/workflows/return/create-complete-return.js:82-93`) ส่วนการสร้าง return ใช้ `input.location_id` (`:268`) และ `confirmReturnReceiveWorkflow` throw เมื่อ `return.location_id` ไม่มี inventory level ของ variant ที่ `manage_inventory` (`confirm-receive-return-request.js:72-74`)
- `POST /store/returns` รับ `location_id` ได้ (`StorePostReturnsReqSchema`) แต่ CORE-16 ห้าม client ส่ง (`apps/backend/src/api/store/ownership/return-overrides.ts:19`) จึงเป็น null เสมอ — ข้อห้ามนี้ถูกต้องและต้องคงไว้
- ลำดับ middleware: core โหลดก่อน project (`medusa/dist/loaders/api.js:40`) และ entry ที่ระบุ method อยู่ bucket `static` ตามลำดับที่โหลด (`framework/dist/http/routes-sorter.js`, `router.js:107-110`) `validateAndTransformBody` ของ core จึงทำงานก่อน middleware `POST /store/returns` ของเรา และ route ของ core ส่ง `req.validatedBody` เข้า workflow ตรงๆ (`medusa/dist/api/store/returns/route.js:14`)
- เป็นบั๊กของ Medusa ไม่ใช่การตั้งใจปิด: `StorePostReturnsReqSchema` รับ `location_id` แบบ `nullish` และ `prepareFulfillmentData` เติม location จาก return option ให้เมื่อไม่ได้ส่ง แต่ค่าที่เติมไปถึงเฉพาะ fulfillment ไม่ไปถึง `createCompleteReturnStep` — ลูกค้าขอคืนจากหน้าเว็บเป็นฟีเจอร์ที่ตั้งใจให้มี (spec 01 ตารางของเดิม Medusa) และเจตนาของ CORE-16 คือ location มาจาก return option; test เดิมตรวจแค่ขั้นขอคืน ไม่ถึงขั้นรับของ
- docs ของ Medusa ("Restrict Return Creation") แนะนำปิดช่องโหว่ route นี้ด้วย middleware แต่ไม่พูดถึง `location_id`

## ทางเลือก
ก. **[เสนอ]** เพิ่ม middleware ตัวสุดท้ายของ `POST /store/returns` อ่าน location จาก return option ที่ผ่าน CORE-17/21 แล้วตั้ง `req.validatedBody.location_id`
   — ข้อดี: โค้ดน้อยที่สุด ใช้ route/workflow ของ core ทั้งหมด ไม่เปิด input ให้ client; ข้อเสีย: พึ่งลำดับ middleware ของ core (ถ้าเปลี่ยน `req.validatedBody` เป็น undefined → 500 ชัดเจน และ integration test ของ AC-150 ล้ม)

ข. สร้าง `src/api/store/returns/route.ts` แทน route ของ core แล้วเรียก workflow พร้อม location
   — ข้อดี: ไม่พึ่งลำดับ middleware; ข้อเสีย: คัดลอก handler ของ core ต้องตามเวลา bump และยังต้องมีการตรวจเดียวกัน

ค. subscriber `order.return_requested` อัปเดต `location_id` ของ return ทีหลัง
   — ข้อเสีย: เป็น eventual, แอดมินรับของก่อน subscriber จบได้, ล้มแล้วค้าง null เงียบๆ

ง. mutate input ใน hook `setPricingContext` ของ workflow
   — ข้อเสีย: hook นี้มีไว้กำหนด pricing context ไม่รับรองการแก้ input และรันก่อนรู้ option

## การตัดสินใจ
เลือก **ก** รายละเอียดอยู่ใน spec 01 กฎข้อ 113 ไม่เพิ่ม route, workflow, infra หรือ dependency

เมื่อหา location ไม่ได้ (ข้อ 113b–c): ตอบ 400 `invalid_data` ตอน**ขอคืน** ไม่สร้าง return — เหมือนการตรวจของ core ที่ `throwIfManagedItemsNotStockedAtReturnLocation` (`order/utils/order-validation.js:16`, ไม่ถูก export) แทนที่จะปล่อยไปล้มตอนรับของ

## ผลที่ตามมา
- return ใหม่จากหน้าเว็บมี `location_id` เสมอ; client ยังส่ง `location_id` ไม่ได้ (400 เดิมของ CORE-16)
- ไม่ backfill: owner ยืนยันไม่มี order ลูกค้าจริงก่อน v0.1.0 (spec 02 Q12) return ทดสอบที่ค้างในฐานข้อมูล dev ไม่ต้องแก้
- เมื่อ confirm ล้มแบบนี้ Medusa ยังทิ้ง `return.status=received` และซ่อนปุ่ม Receive items — เป็นพฤติกรรมของ core ทางเลือก ก ทำให้ไปไม่ถึงกรณีนี้จาก store flow; ไม่แก้ core และไม่ใช้ patch-package
- ตอน bump `@medusajs/*` test AC-150 ต้องยังผ่าน; ถ้า upstream ส่ง location ที่หาได้ลงการสร้าง return เอง ให้ลบ middleware นี้
- owner ส่ง issue ไปที่ Medusa upstream (ข้อความใน body ของ PR CORE-55)
