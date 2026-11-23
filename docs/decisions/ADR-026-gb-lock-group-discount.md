# ADR-026 group buy: ล็อกส่วนลดของกลุ่ม — สมาชิกทุกคนในกลุ่มเดียวกันได้ส่วนลดเท่ากัน

สถานะ: **accepted** (owner อนุมัติ 2026-11-21 — ทางเลือก 1; spec 04 Q24 = ก "ล็อก `GB-<token>` ตลอดอายุกลุ่ม")
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
- (review #425) route ของ **campaign** ของ Medusa ที่กระทบส่วนลดของกลุ่มอยู่ในขอบเขตด้วย: `POST /admin/campaigns/:id/promotions` (เพิ่ม/ถอด promotion) ที่มี promotion `GB-*` → 400;
  `POST /admin/campaigns/:id` (วัน/budget) ของ campaign ที่ผูก `group_buy_campaign` ที่ไม่ใช่ `draft` → 400 (เปลี่ยน `ends_at` ทำให้ deadline ของกลุ่มเดิมขัดกฎข้อ 2/10 ของ spec 04);
  `DELETE /admin/campaigns/:id` ของ campaign ดังกล่าว → 400
- อ่าน link ด้วย `query.graph` ครั้งเดียวต่อ request (entity link `group_buy_group` ↔ `promotion`) ไม่เพิ่ม model/migration

## ผลที่ตามมา
- สมาชิกกลุ่มเดียวกันได้ส่วนลดเท่ากันเสมอ; หน้า promotion ของ Medusa admin แสดง toast error เมื่อพยายามแก้ `GB-*`
- admin แก้สถานะ promotion `GB-*` (เช่น deactivate) ไม่ได้ — ต้องปิดกลุ่มผ่านหน้า Group buying
- route ของ Medusa ที่เพิ่มในเวอร์ชันถัดไปต้องตรวจว่าอยู่ใต้ matcher (เพิ่มในเช็กลิสต์ bump ของ spec 07)

## ภาคผนวก 2026-11-21 (planner รอบ 41 — owner สั่ง "ล็อก campaign ของแคมเปญ group buy ไม่ให้เพิ่ม/ถอด `GBT-*` หรือ promotion อื่น")
- ขยายข้อ campaign ด้านบน: `POST /admin/campaigns/:id/promotions` ของ campaign ที่ผูก `group_buy_campaign` → 400 **ทุกกรณี** (เพิ่มหรือถอด promotion ใดก็ได้ ทุกสถานะของแคมเปญ) ไม่ใช่เฉพาะ `GB-*` —
  เหตุผล: ต้นแบบ `GBT-*` ถูกผูกกับ campaign โดย workflow ของเรา; ถอดต้นแบบ/ใส่ promotion อื่นทำให้ส่วนลดหรืองบของ campaign ไม่ตรงกับหน้า Group buying; การแก้ส่วนลดของต้นแบบยังทำได้ที่ promotion (Q5)
- clone `GB-<token>` ใช้ campaign id จาก link `group_buy_campaign.campaign` แทน `template.campaign_id` — link เป็น source of truth ของความเป็นเจ้าของ; ต้นแบบที่ไม่อยู่ใน campaign ของแคมเปญ → สร้างกลุ่มไม่ได้ (`invalid_data`)
- ไม่มีทางเลือกใหม่ให้ตัดสิน (owner สั่งแล้ว) — spec 04 กฎข้อ 51, GB-26
- (เพิ่ม 2026-11-22 — owner ตัดสินจาก review #488) ปิดทางอ้อมที่ admin route ของ promotion ด้วย: `POST /admin/promotions/:id` ที่เปลี่ยน `campaign_id` ของต้นแบบ `GBT-*` และ `POST /admin/promotions` / `POST /admin/promotions/:id` ที่ตั้ง `campaign_id` เป็น campaign ที่ผูก `group_buy_campaign` → 400 `not_allowed`; body ที่ไม่แตะ `campaign_id` (หรือส่งค่าเดิม) ผ่านได้ตาม Q5 — spec 04 กฎข้อ 54, GB-29

## ภาคผนวก 2026-11-23 (planner รอบ 41 — owner สั่ง "กัน DELETE ไม่ให้ลบ promotion ต้นแบบ `GBT-*` ของ group buy")
- `DELETE /admin/promotions/:id` ของต้นแบบ `GBT-*` ที่ผูกแคมเปญ group buy → 400 `not_allowed` ทุกสถานะของแคมเปญ — แทนส่วน "ต้นแบบ `GBT-*` → `next()`" ของทางเลือก 1 **เฉพาะ DELETE** (POST แก้ส่วนลดของต้นแบบยังได้ตาม Q5)
- เหตุผล: ลบต้นแบบแล้วแคมเปญสร้างกลุ่มใหม่ไม่ได้ (กฎข้อ 51b ต้องมีต้นแบบใน campaign ของ link) และหน้า Group buying อ้างต้นแบบที่หายไป; ทางลบที่ถูกต้องคือลบแคมเปญ `draft` ที่หน้า Group buying (`deleteGroupBuyCampaignWorkflow` ไม่ผ่าน route นี้)
- ตรวจ `@medusajs/medusa` 2.22.1: `DELETE /admin/promotions/:id` เป็น admin route เดียวที่ลบ promotion (ไม่มี bulk delete; rule batch ลบเฉพาะ rule; ลบ campaign cascade เฉพาะ budget) — ใช้ matcher เดิมของ GB-25 ไม่เพิ่ม hook/model
- ผลที่ตามมา: ต้นแบบของแคมเปญ `active`/`ended` ลบไม่ได้ตลอดไป (ไม่มีทางลบแคมเปญที่ไม่ใช่ `draft` อยู่แล้ว) — spec 04 กฎข้อ 55, GB-30
