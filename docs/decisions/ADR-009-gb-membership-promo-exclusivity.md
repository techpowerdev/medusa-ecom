# ADR-009 GB membership หลายออเดอร์ต่อคน และ promotion exclusivity ผ่าน promotion context rule

สถานะ: accepted (เจ้าของโปรเจกต์, 2026-10-25)
เกี่ยวข้อง: spec 04 (GB-1, GB-3), spec 03 (PROMO-1, FS-5, FS-6), ADR-003, ADR-004
ขยายความจาก ADR-003 ข้อ "กฎการซ้อน/exclusivity เป็นของ Medusa": Medusa ยังเป็นผู้ตัดสินว่าจะใช้ promotion ไหน
แต่เราป้อน context เพิ่มหนึ่ง attribute ให้ (ไม่ได้คำนวณส่วนลดเอง) — ไม่ขัด ADR-003

## เรื่องที่ 1 — GroupBuyMembership

### บริบท
spec 04 เดิมมี unique `(group_id, customer_id)` บน membership ซึ่งขัดกับ AC-12 (ลูกค้าคนเดียวมี 2 ออเดอร์
ในกลุ่มเดียว) และ AC-7 (ออกแล้วเข้าใหม่ — แถวเดิมที่ `cancelled` ยังชนกับ unique) กฎข้อ 3 และ Non-functional
อ้าง index `(campaign_id, customer_id)` แต่ membership ไม่มี `campaign_id` และ `order_id` เขียนไม่ตรงกันระหว่าง
spec ("unique") กับ data-model.md ("link → order")

### ทางเลือก
A. หนึ่ง membership ต่อคนต่อกลุ่ม (คง unique) แล้วแก้ AC-12 ให้ "1 คน = 1 ออเดอร์"
B. **หลายออเดอร์ต่อคนได้: 1 membership = 1 draft order, ลูกค้าเดียวมีได้หลายแถวในกลุ่มเดียว**
C. B + partial unique index `(campaign_id, customer_id) WHERE status <> 'cancelled'` — ใช้ไม่ได้ เพราะ
   คนเดียวมีหลายแถวที่ active ในกลุ่มเดียวได้ตาม B

### การตัดสินใจ
เลือก B (เจ้าของเลือก AC-12 เป็นหลัก)
1. เอา unique `(group_id, customer_id)` ออก
2. เพิ่ม `campaign_id` แบบ denormalized ใน membership (คัดลอกจากกลุ่มตอน join, ไม่เปลี่ยนภายหลัง) +
   index ธรรมดา `(campaign_id, customer_id)` และ `(group_id, status)` เพื่อให้ตรวจกฎต่อแคมเปญได้ใน query เดียว
3. กฎ "1 คน 1 กลุ่มต่อแคมเปญ" ตรวจใน `joinGroupWorkflow` ภายใต้ lock ไม่ใช้ unique index:
   ลูกค้ามี membership ที่ไม่ใช่ `cancelled` ในแคมเปญนี้อยู่ใน **กลุ่มอื่น** → 409 `GB_ALREADY_IN_OTHER_GROUP`
4. lock ของกลุ่มอย่างเดียวไม่พอสำหรับกฎข้ามกลุ่ม จึงกำหนด lock scope (ผ่าน Locking module ของ Medusa
   ที่ใช้ Redis อยู่แล้วตาม spec 07 — ไม่ใช่ infra ใหม่) ล็อกตามลำดับนี้เสมอเพื่อกัน deadlock:
   1. `group_buy:campaign:<campaign_id>` — เฉพาะเมื่อแคมเปญตั้ง `max_total_orders` (นับข้ามกลุ่ม)
   2. `group_buy:group:<group_id>` — ทุกครั้ง (status, `max_people_per_group`, ตัวนับ)
   3. `group_buy:customer:<campaign_id>:<customer_id>` — ทุกครั้ง (กฎข้อ 3 และ `max_units_per_person`
      เมื่อคนเดียวยิง join หลายกลุ่มพร้อมกัน)
5. ความหมายของข้อจำกัด/ตัวนับ (นับเฉพาะ membership ที่ไม่ใช่ `cancelled`):
   - `max_units_per_person`: ผลรวม `units` ของลูกค้าในแคมเปญ (ทุก membership) + จำนวนชิ้นใน cart ใหม่ ≤ ค่าที่ตั้ง
   - `max_people_per_group`: นับลูกค้าไม่ซ้ำ; สมาชิกเดิมสั่งเพิ่มได้แม้กลุ่มเต็มจำนวนคนแล้ว
   - `max_total_orders`: นับ membership ทั้งแคมเปญ
   - `progress_orders` = จำนวน membership, `progress_units` = ผลรวม units, `progress_people` = ลูกค้าไม่ซ้ำ
6. `order_id` เป็นคอลัมน์ `text` unique บน membership (1 membership = 1 draft order) และนิยาม
   **read-only module link** `group_buy_membership ↔ order` ด้วย `defineLink({ linkable, field: "order_id" },
   OrderModule.linkable.order, { readOnly: true })` — เป็น convention ของ Medusa (แบบเดียวกับ cart → customer)
   ไม่มี link table ไม่ต้องใช้ `link.create`; ใช้ `query.graph` อ่าน order จาก membership ได้

### ผลที่ตามมา
+ AC-7 และ AC-12 เป็นไปได้โดยไม่มี constraint ชน
+ query ต่อแคมเปญใช้ index เดียว ไม่ต้อง join กลุ่ม
− กฎข้อ 3 ไม่มี DB constraint คุ้มกัน — ความถูกต้องขึ้นกับ lock ใน workflow; ต้องมี concurrency test
  (spec 04 AC-18)
− การ leave ต้องคำนวณว่าเป็น membership สุดท้ายของลูกค้าในกลุ่มหรือไม่ก่อนลด `progress_people`
− เมื่อตั้ง `max_total_orders` การ join ทั้งแคมเปญถูก serialize; ยอมรับได้ในสเกล v1

## เรื่องที่ 2 — Promotion exclusivity (flash / group buy / code อื่น)

### บริบท
builder PROMO-1 ตรวจ source Medusa 2.22.1: Promotion module ไม่มี exclusivity แบบ native;
`updateCartPromotionsWorkflow` มี hook `validate` (ปฏิเสธได้อย่างเดียว) และ `setPromotionContext`
(เติม context ที่ใช้ประเมิน promotion rule); automatic promotion ที่ตรงเงื่อนไขถูกใส่เสมอ; add-to-cart วิ่งผ่าน
`refreshCartItemsWorkflow` ซึ่งเรียก `updateCartPromotionsWorkflow` ซ้ำ ดังนั้น hook `validate` อย่างเดียว
ทำให้ "code ชนะ flash" ไม่ได้ (ปฏิเสธ automatic promotion ไม่ได้ และจะทำให้ add-to-cart error)

### ทางเลือก
A. hook `validate` ปฏิเสธทุกกรณีที่ซ้อน — ทำไม่ได้กับ automatic promotion (ดูบริบท)
B. ลบ flash adjustment เองหลัง workflow — เท่ากับคำนวณส่วนลดเอง ขัด ADR-003
C. **hook `setPromotionContext` ใส่ flag ลง context; flash promotion มี rule ที่ต้องการ flag ≠ `"true"`
   แล้วให้ Medusa ตัดสินเอง**
D. ระบุ flash ด้วย link ไป module `flash_sale` — ผูก PROMO-1 กับ FS-1 และ promotion ที่ไม่ได้ตั้ง config จะหลุด

### การตัดสินใจ
เลือก C
1. constant `EXCLUSIVITY_CODE_APPLIED_ATTRIBUTE = "exclusivity.code_applied"` และ helper
   `exclusiveAutomaticRule()` → `{ attribute: "exclusivity.code_applied", operator: "ne", values: ["true"] }`
   ส่งมอบใน PROMO-1 (pure, unit test ได้)
2. **exclusive automatic promotion** = promotion ที่ `is_automatic=true` และมี rule ข้างบน ไม่พึ่ง module `flash_sale`
3. hook `setPromotionContext` ตั้งค่า `exclusivity.code_applied` เป็น `"true"` หากชุด code **ผลลัพธ์**ของการเรียกนี้
   (คิดตาม `action` add/remove/replace จาก code เดิมของ cart + input) มี promotion ที่ `is_automatic=false`
   อย่างน้อยหนึ่งตัว (รวม `GB-*`) มิฉะนั้นตั้งเป็น `"false"` — ต้องตั้งค่าเสมอ ไม่ปล่อยว่าง
4. ผล: มี code ใดๆ → Medusa ไม่ใส่ flash ("code ชนะ"); ลบ code ออก → flash กลับมาเองในการคำนวณครั้งถัดไป;
   เข้าร่วม group buy (`GB-*` คือ code) → ส่วนลด GB ชนะ flash หลุดด้วยกลไกเดียวกัน
5. hook `validate`: ปฏิเสธ (`PROMOTION_NOT_COMBINABLE`) เมื่อชุด code ผลลัพธ์มี `GB-*` ร่วมกับ code อื่นที่
   `is_automatic=false` (spec 04 กฎข้อ 7) — ไม่ปฏิเสธกรณี flash + code
6. ด่านสำรอง: hook `validate` ของ `completeCartWorkflow` ปฏิเสธ (`PROMOTION_NOT_COMBINABLE`) หาก cart มี
   exclusive automatic promotion ร่วมกับ code ใดๆ หรือมี `GB-*` ร่วมกับ code อื่น
7. flow สร้าง/ตั้งค่า flash sale ต้องใส่ rule นี้ให้ทุก automatic promotion ของแคมเปญ (FS-5);
   promotion ที่ไม่มี rule = ไม่ exclusive ซ้อนกับ code ได้ตามปกติของ Medusa

### ผลที่ตามมา
+ ไม่มีการคำนวณส่วนลดเอง; ทำงานเหมือนกันทั้ง apply code, add-to-cart และ refresh
+ PROMO-1 ไม่ขึ้นกับ module `flash_sale`
− ถ้าลืมใส่ rule ให้ flash promotion มันจะซ้อนกับ code ได้ — บรรเทาด้วย FS-5 (ใส่ให้อัตโนมัติ + เตือนใน widget)
  และด่านสำรองตอน complete จะไม่จับกรณีนี้เพราะระบุ exclusive ด้วย rule
− rule attribute ที่ไม่อยู่ในรายการของ admin UI ต้องเพิ่มผ่าน admin API/workflow (`addPromotionRulesWorkflow`)
  ไม่ใช่ฟอร์ม promotion ของ Medusa
− พฤติกรรม spec 03 AC-8 เปลี่ยนจาก "ปฏิเสธ code เมื่อมี flash" เป็น "code ชนะ flash หลุด" เพื่อให้ผลลัพธ์ไม่ขึ้นกับลำดับการกระทำ
