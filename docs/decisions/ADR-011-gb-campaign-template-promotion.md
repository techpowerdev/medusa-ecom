# ADR-011 ส่วนลด/ขอบเขตสินค้าระดับแคมเปญ group buy เก็บใน promotion "ต้นแบบ" (draft) แล้ว clone ต่อกลุ่ม

สถานะ: accepted (owner อนุมัติ 2026-10-25 พร้อมค่าเริ่มต้นของ Q5–Q7 ใน spec 04)
เกี่ยวข้อง: spec 04 (GB-2, GB-3), ADR-004, ADR-009, `docs/design/data-model.md` (module `group_buy`)

## บริบท
spec 04 ให้ `createGroupWorkflow` สร้าง promotion `GB-<token>` ต่อกลุ่ม (ADR-004) แต่ Data model บอกว่า discount
type/value และ product scope "อยู่ที่ Medusa campaign + promotion ที่ลิงก์ไว้ ไม่ทำซ้ำในโมดูลเรา" ปัญหาคือ
Medusa campaign ไม่มี field ส่วนลด และ promotion มีเฉพาะระดับกลุ่ม — ตอนสร้างแคมเปญ (โดยเฉพาะ `group_mode=team`
ที่ยังไม่มีกลุ่มเลยจนลูกค้าสร้างเอง) จึงไม่มีที่เก็บค่าส่วนลดและ scope ที่ `createGroupWorkflow` จะใช้

ข้อเท็จจริงที่ตรวจจาก source Medusa 2.22.1 (`@medusajs/promotion`, `@medusajs/core-flows`):
- `Promotion.status` เป็น enum `draft | active | inactive` **ค่าเริ่มต้นคือ `draft`**
- `computeActions` (ใช้โดย `updateCartPromotionsWorkflow`) ดึง promotion ผ่าน `listActivePromotions_` ซึ่งกรอง
  `status = active` และช่วง `starts_at/ends_at` ของ campaign → promotion ที่เป็น `draft` **ไม่สร้าง adjustment
  ใดๆ บน cart** แม้จะใส่ code ได้ (`getPromotionCodesToApply` ตรวจแค่ว่า code มีอยู่)
- promotion มี `campaign_id`, `application_method` (+ `target_rules`), `rules`, `metadata`; code unique

## ทางเลือก
A. **promotion "ต้นแบบ" (template) ต่อแคมเปญ**: `status=draft`, `is_automatic=false`, อยู่ใน Medusa campaign
   ของแคมเปญ group buy; `createGroupWorkflow` clone `application_method` (+ `target_rules`), `rules`,
   `is_tax_inclusive`, `campaign_id` ไปเป็น `GB-<token>` ที่ `status=active`
B. เก็บ discount type/value และ scope เป็นคอลัมน์ใน `GroupBuyCampaign` (+ migration)
C. ใช้ promotion ของกลุ่มแรกเป็นต้นแบบ

## การประเมิน
| เกณฑ์ | A | B | C |
|---|---|---|---|
| ห้ามสร้างซ้ำสิ่งที่ Medusa มี (CLAUDE.md ข้อ 1) | ผ่าน — ส่วนลดและ scope ยังเป็น Medusa promotion, แก้ไขได้ด้วยหน้า promotion ของ Medusa admin | ไม่ผ่าน — ต้องจำลองโครงสร้าง application method/target rules เอง + ฟอร์ม admin เอง | ผ่าน |
| Data model "never duplicated" | ผ่าน — โมดูลเราเก็บแค่ link | ขัดโดยตรง | ผ่าน |
| ADR-004 (1 code ต่อกลุ่ม ผ่าน Promotion module, ส่วนลดถูก freeze ใน draft order) | ผ่าน | ผ่านแต่ต้องแปลงคอลัมน์เป็น promotion ทุกครั้ง | ผ่าน |
| ADR-009 (`GB-*` เป็น code `is_automatic=false`; exclusivity ผ่าน context rule) | ผ่าน — ต้นแบบไม่ใช่ `GB-*` และเป็น draft จึงไม่มีผลกับ cart | ผ่าน | ผ่าน |
| `group_mode=team` (ยังไม่มีกลุ่ม) | ผ่าน | ผ่าน | **ไม่ผ่าน** — ไม่มีต้นแบบจนกว่าจะมีกลุ่ม |

## การตัดสินใจ
เลือก A
1. `createGroupBuyCampaignWorkflow` สร้าง Medusa campaign (ต้องมี `ends_at`) + promotion ต้นแบบด้วย
   `createPromotionsWorkflow`: `status: "draft"`, `is_automatic: false`, `campaign_id` = campaign นั้น,
   `code: "GBT-<random 12 ตัว>"` (ห้ามขึ้นต้นด้วย `GB-` เพื่อไม่ชนกฎ `GB-*` ของ ADR-009) แล้วผูกด้วย module link
   `group_buy_campaign ↔ promotion` (ชื่อ link: template, one-to-one) — link นี้คือ marker ว่าตัวไหนเป็นต้นแบบ
   ไม่ใช้ metadata
2. `createGroupWorkflow` อ่านต้นแบบผ่าน `query.graph` (link) แล้วสร้าง `GB-<token>` ด้วย `createPromotionsWorkflow`
   โดยระบุ **`status: "active"` อย่างชัดเจน** (ค่าเริ่มต้นของ Medusa คือ `draft`) compensation = ลบ promotion
3. ต้นแบบต้องคงเป็น `draft` ตลอดอายุแคมเปญ; การแก้ส่วนลด/scope ทำผ่านหน้า promotion ของ Medusa admin
   และ **มีผลเฉพาะกลุ่มที่สร้างหลังจากนั้น** (กลุ่มเดิมถือ promotion ของตัวเอง; draft order ที่สร้างแล้วถูก freeze อยู่แล้ว)
4. การตรวจ "cart มีเฉพาะสินค้าในขอบเขตแคมเปญ" ใน `joinGroupWorkflow` อ่าน `target_rules` จาก promotion ของกลุ่ม
5. ช่วงเวลาใช้งานของ `GB-*` ถูกคุมโดย `starts_at/ends_at` ของ Medusa campaign อยู่แล้ว (`listActivePromotions_`)

## ผลที่ตามมา
+ ไม่ต้องมีคอลัมน์ส่วนลด/scope และไม่ต้องสร้างฟอร์มส่วนลดเองใน admin — ใช้ editor promotion ของ Medusa
+ ทำงานเหมือนกันทั้ง pool และ team; ไม่ต้องมี migration ใหม่ใน `group_buy` นอกจาก link
+ budget ของ Medusa campaign (ถ้าตั้ง) ครอบทุก `GB-*` ของแคมเปญโดยอัตโนมัติ
− ต้นแบบปรากฏในรายการ promotion ของ Medusa admin; ถ้า admin เปลี่ยนเป็น `active` เอง code `GBT-*` จะใช้ได้
  โดยไม่ต้องเข้ากลุ่ม — บรรเทาด้วย code แบบสุ่มเดาไม่ได้ และ widget/หน้า GB-6 แสดงคำเตือน (ไม่เพิ่ม hook)
− ลูกค้าที่รู้ code `GBT-*` แล้วใส่ลง cart จะไม่ได้ส่วนลด แต่ hook `setPromotionContext` ของ ADR-009 จะนับเป็น
  code (`is_automatic=false`) ทำให้ส่วนลด flash หลุด — ผลกระทบเฉพาะตัวผู้ใส่เอง ยอมรับได้
− การ clone ต้อง map field ให้ครบ (`application_method.type/target_type/allocation/value/currency_code/max_quantity/
  target_rules`, `rules`, `is_tax_inclusive`); ถ้า Medusa เพิ่ม field ในอนาคตต้องตามแก้ — ครอบด้วย integration test
  (spec 04 AC-20)
