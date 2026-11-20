# ADR-026 group buy: ล็อกส่วนลดของกลุ่ม — สมาชิกทุกคนในกลุ่มเดียวกันได้ส่วนลดเท่ากัน

สถานะ: **proposed** (planner รอบ 40, 2026-11-21 — owner ตัดสิน "ล็อกส่วนลดตอน join" 2026-11-21; การตีความรอยืนยัน — spec 04 Q24)
เกี่ยวข้อง: ADR-011 (promotion ต้นแบบ + clone ต่อกลุ่ม), spec 04 กฎข้อ 5, 12, 28e และ Q5 (แก้ต้นแบบมีผลเฉพาะกลุ่มใหม่ ไม่ล็อกการแก้ต้นแบบ), Q23 (ไม่ทำ hook `promotionsUpdated`), task GB-25

## บริบท
- ส่วนลดของแต่ละสมาชิกถูก freeze ใน draft order ตอน join อยู่แล้ว (กฎข้อ 5, 18) แต่ promotion ของกลุ่ม `GB-<token>` แก้ได้ที่หน้า promotion ของ Medusa admin
  (`POST /admin/promotions/:id`, `/admin/promotions/:id/rules/batch`, `/target-rules/batch`, `/buy-rules/batch`, `DELETE /admin/promotions/:id`)
- การทดสอบ manual เฟส 6: แก้ `GB-<token>` ระหว่างกลุ่มเปิด → คนที่ join ทีหลังได้ส่วนลดต่างจากคนก่อนในกลุ่มเดียวกัน (ไม่เป็นธรรม ขัดกับหน้ากลุ่มที่แสดงส่วนลดเดียว — กฎข้อ 28e)
- ต้นแบบ `GBT-*` แก้ได้ตาม Q5 (มีผลเฉพาะกลุ่มที่สร้างหลังจากนั้น) — ไม่อยู่ใน ADR นี้

## ทางเลือก
1. **กันการแก้ promotion ของกลุ่มที่ admin route** (middleware บน `/admin/promotions/:id` และ `/admin/promotions/:id/*` method POST/DELETE): ถ้า promotion ผูก
   `group_buy_group` (link `group ↔ promotion`) → 400 `not_allowed` ข้อความอังกฤษชัด ("This promotion belongs to a group-buy group; its discount is locked. Edit the campaign template for new groups.")
   — ครอบทุก route ที่แก้ส่วนลด/rule/สถานะ/ลบ, ไม่แตะ workflow ของ Medusa, เส้นทางภายในของเรา (`createGroupWorkflow` สร้าง, การลบตอนลบแคมเปญ `draft`) เรียก workflow ตรงจึงไม่ผ่าน middleware
2. snapshot ส่วนลดลง `GroupBuyGroup` ตอนสร้าง แล้ว join ตรวจว่า `GB-<token>` ยังตรง snapshot ไม่ตรง → 409 `GB_DISCOUNT_CHANGED` — ไม่กันการแก้ ลูกค้าติด join ไม่ได้จน admin แก้กลับ, เพิ่ม field/migration
3. handler `updatePromotionsWorkflow.hooks.promotionsUpdated` — ครอบเฉพาะ `POST /admin/promotions/:id` (rule batch ใช้ workflow อื่น), `createHook` มี handler ได้ตัวเดียว, owner เคยไม่เลือกแนวนี้ (Q23)
4. คงเดิม (ไม่ล็อก) — owner ไม่เลือก

## การตัดสินใจ (เสนอ: ทางเลือก 1)
- ล็อก**ตลอดอายุกลุ่ม** (ทุกสถานะ — กลุ่ม `succeeded`/`failed` แก้ไม่ได้เช่นกัน เพราะ draft order อ้างส่วนลดนั้น) ตั้งแต่สร้างกลุ่ม ไม่ใช่ตั้งแต่ join คนแรก — ง่ายและตรวจได้
- ข้อยกเว้น: ไม่มี (admin ที่ต้องการเปลี่ยนส่วนลดให้แก้ต้นแบบแล้วสร้างกลุ่มใหม่ หรือ fail กลุ่มเดิมผ่านปุ่มของ GB-6c)
- อ่าน link ด้วย `query.graph` ครั้งเดียวต่อ request (entity link `group_buy_group` ↔ `promotion`) ไม่เพิ่ม model/migration

## ผลที่ตามมา
- สมาชิกกลุ่มเดียวกันได้ส่วนลดเท่ากันเสมอ; หน้า promotion ของ Medusa admin แสดง toast error เมื่อพยายามแก้ `GB-*`
- admin แก้สถานะ promotion `GB-*` (เช่น deactivate) ไม่ได้ — ต้องปิดกลุ่มผ่านหน้า Group buying
- route ของ Medusa ที่เพิ่มในเวอร์ชันถัดไปต้องตรวจว่าอยู่ใต้ matcher (เพิ่มในเช็กลิสต์ bump ของ spec 07)
