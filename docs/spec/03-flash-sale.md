# 03 Flash sale — แคมเปญส่วนลดแบบจำกัดเวลา

สถานะ: draft (exclusivity ปรับตาม ADR-009, 2026-10-25)
เป้าหมาย (เจ้าของระบบ): จัดแคมเปญ flash sale ที่ลดราคาสินค้าในช่วงเวลาจำกัดเพื่อกระตุ้นการซื้อ
การตัดสินใจ: สร้างบน **Promotion module** ของ Medusa (ADR-003) ไม่มี discount engine แยกต่างหาก
นอกขอบเขต: การเปลี่ยน price list ตามเวลา (ใช้ Promotion แทน), countdown timer ต่อ SKU บน PLP
ที่ละเอียดกว่าระดับแคมเปญ (v2), การส่ง notification แบบ blast

## สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | การใช้งาน |
|------|-----------------|-----|
| ส่วนลด % หรือจำนวนคงที่ ต่อ item / order / shipping | Promotion `application_method` | ใช้ตามที่มี |
| กำหนดเป้าหมาย products/collections/categories | Promotion target rules | ใช้ตามที่มี |
| เวลาเริ่ม/สิ้นสุด | **Campaign** `starts_at` / `ends_at` | ใช้ตามที่มี |
| งบประมาณรวม (ยอดใช้จ่ายหรือจำนวนครั้ง) | Campaign `budget` (type `spend` / `usage`) | ใช้ตามที่มี |
| ใช้อัตโนมัติ (ไม่ต้องใส่ code) | Promotion `is_automatic` | ใช้ตามที่มี |
| จำนวนหน่วยที่ลดราคาสูงสุดต่อ cart line | `application_method.max_quantity` | ใช้ตามที่มี |
| Admin CRUD UI | หน้า Promotions/Campaigns ใน admin | ใช้ตามที่มี + widget |
| ราคาขีดฆ่าบน storefront | Starter แสดง `original_price` เทียบ `calculated_price` เฉพาะกรณี price list | **ช่องว่าง** → store API คืน promotion preview |
| Exclusivity ระหว่าง promotion | ไม่มี native (ตรวจ source 2.22.1) | **ขยาย** → hook `setPromotionContext` + `validate` ของ `updateCartPromotionsWorkflow`, `validate` ของ `completeCartWorkflow` (ADR-009) |
| ข้าม promotion ตามเงื่อนไขของ cart | Promotion rules (operator `ne`) ประเมินกับ promotion context | ใช้ตามที่มี — rule `exclusivity.code_applied ne "true"` |

ช่องว่างที่เราเติม (แบบบาง):
1. **Per-customer cap** ตลอดทั้งแคมเปญ (เช่น สูงสุด 2 หน่วยต่อลูกค้า) — Promotion มี
   `max_quantity` ต่อ cart แต่ไม่มีการจำกัดต่อลูกค้า custom module `flash_sale` เก็บตัวนับ
   การใช้งานโดย key เป็น `(campaign_id, customer_id)` และมี workflow hook สำหรับตรวจสอบ cart
2. **Countdown บน storefront + การแสดง "flash price"** บน PLP/PDP — ต้องมี store endpoint
   ที่คืน flash campaign ที่กำลังทำงานอยู่ และราคาหลังส่วนลดที่จะเป็นของ variant นั้น
3. **การแสดง flash stock** ("เหลือ 12 ชิ้น") — optional; อิงจาก budget `usage` ที่เหลือของแคมเปญ

## Data model (module `flash_sale`)
```
FlashSaleConfig
  id, campaign_id (link → promotion campaign), per_customer_limit: int?, total_cap: int?,
  units_sold: int (atomic), show_countdown: bool, show_remaining: bool, banner_text: text?

FlashSaleUsage
  id, campaign_id, customer_id, units: int   // unique (campaign_id, customer_id)
```
Link: `flash_sale_config ↔ promotion_campaign`

## Workflows / hooks
- Hook เข้าที่ขั้นตอน **validation** ของ `completeCartWorkflow`: หาก cart มี promotion ที่เป็นของ
  flash campaign: (a) ต่อลูกค้า: `units_in_cart + FlashSaleUsage.units <= limit` ไม่เช่นนั้น
  `FLASH_LIMIT_EXCEEDED`; (b) total cap: จองจาก `FlashSaleConfig.units_sold` แบบ atomic
  (`UPDATE ... SET units_sold = units_sold + n WHERE units_sold + n <= total_cap`) ไม่เช่นนั้น
  `FLASH_SOLD_OUT` campaign budget ของ Medusa ไม่ atomic ข้าม cart ที่ทำงานพร้อมกัน ดังนั้น
  ตัวนับของเราคือ source of truth สำหรับ "N พอดี"; ตั้ง campaign budget ให้เท่ากันไว้เป็น backstop
- Subscriber บน `order.placed`: เพิ่ม `FlashSaleUsage` แบบ atomic
  (`INSERT ... ON CONFLICT DO UPDATE SET units = units + n`) Idempotent ผ่าน
  processed-set ของ `order_id` (table หรือ Redis SET พร้อม TTL)
- Subscriber บน order cancel/refund: ลดค่าลง
- Exclusivity hooks (PROMO-1) ตามกฎข้อ 6 — ไม่มี compensation เพราะไม่เขียนข้อมูล (เติม context / ปฏิเสธเท่านั้น)

## API
- Store: `GET /store/flash-sales/active?region_id=&variant_ids[]=` → campaign
  (id, name, starts_at, ends_at, banner_text, remaining_usage?) และ `flash_price`
  ต่อ variant ที่คำนวณผ่าน compute API ของ Promotion module บน cart line สังเคราะห์
- Admin: `GET/POST /admin/flash-sales/:campaign_id/config`

## Admin UI / Storefront
- Admin: widget บนหน้า Campaign detail: "Flash sale options" (per-customer limit,
  countdown, remaining, banner) การสร้าง campaign/promotion ยังคงใช้ UI ของ Medusa
- Storefront: banner แคมเปญพร้อม countdown; PDP แสดง flash price + ราคาขีดฆ่า +
  "สิ้นสุดใน"; cart แสดงรายการส่วนลด (starter ทำส่วนนี้อยู่แล้ว)

## Business rules
1. flash sale 1 รายการ = Medusa Campaign 1 รายการที่มี automatic promotion ≥1 ช่วงเวลาเป็นของ campaign
2. Medusa เป็นผู้ใช้ส่วนลดที่ระดับ cart; โค้ดของเราไม่คำนวณจำนวนส่วนลดเองเด็ดขาด
3. per-customer limit นับหน่วยที่ **สั่งซื้อแล้ว** (ไม่ใช่ที่อยู่ใน cart) โดย key เป็น `customer_id`
   (ต้องล็อกอินทั่วทั้งร้าน, spec 01)
4. เมื่อ campaign budget (`usage`) หมด Medusa จะหยุดใช้ promotion; storefront แสดง
   "Sold out" เมื่อ `remaining_usage == 0`
5. เวลาที่กรอกใน admin เป็นเวลา Bangkok จัดเก็บเป็น UTC
6. **Exclusivity** (เจ้าของระบบ, ADR-009): ส่วนลด flash ไม่ซ้อนกับ promotion code ใดๆ — **code ชนะ**
   (a) exclusive automatic promotion = `is_automatic=true` และมี rule
   `{ attribute: "exclusivity.code_applied", operator: "ne", values: ["true"] }` (ไม่พึ่ง module `flash_sale`)
   (b) hook `setPromotionContext` ของ `updateCartPromotionsWorkflow` ตั้ง `exclusivity.code_applied` เป็น `"true"`
   เมื่อชุด code ผลลัพธ์ (ตาม `action` add/remove/replace) มี promotion ที่ `is_automatic=false` อย่างน้อยหนึ่งตัว
   (รวม `GB-*`) มิฉะนั้น `"false"` — ตั้งค่าเสมอ; Medusa จึงข้ามส่วนลด flash เอง ทั้งตอน apply code,
   add-to-cart (`refreshCartItemsWorkflow`) และ refresh; ลบ code ออก → flash กลับมา
   (c) group buy: `GB-*` เป็น code → ส่วนลด GB ชนะ flash หลุดด้วยกลไกเดียวกัน (spec 04 กฎข้อ 7)
   (d) hook `validate` ของ `updateCartPromotionsWorkflow` ปฏิเสธ `GB-*` + code อื่นด้วย `PROMOTION_NOT_COMBINABLE`
   (ไม่ปฏิเสธกรณี flash + code)
   (e) ด่านสำรอง: hook `validate` ของ `completeCartWorkflow` ปฏิเสธ `PROMOTION_NOT_COMBINABLE` หาก cart มี exclusive
   automatic promotion ร่วมกับ code ใดๆ หรือ `GB-*` ร่วมกับ code อื่น
   (f) PROMO-1 ส่งมอบ: constant `EXCLUSIVITY_CODE_APPLIED_ATTRIBUTE`, helper `exclusiveAutomaticRule()` และ
   `isExclusiveAutomatic(promotion)` (pure, unit test), hook ทั้งสามข้างบน, integration test AC-8 (API)
   ผู้ใช้: FS-5 (ใส่ rule ให้ flash promotion), FS-6 (ข้อความบน storefront), GB-3 (join)
7. ทุก automatic promotion ของ flash campaign ต้องมี exclusivity rule; การบันทึก config ใน FS-5 ใส่ให้อัตโนมัติ
   (idempotent ผ่าน `addPromotionRulesWorkflow`) เพราะฟอร์ม promotion ของ Medusa admin ไม่มี attribute นี้

## Acceptance criteria
- AC-1 เมื่อมีแคมเปญที่ทำงานอยู่ (−20% สำหรับ collection X, automatic) และลูกค้าเพิ่มสินค้า X
  ลง cart แสดงยอดรวมหลังส่วนลด; หลัง `ends_at` cart ใหม่แสดงราคาเต็ม
- AC-2 เมื่อ `per_customer_limit=2` และลูกค้าที่สั่งซื้อไปแล้ว 2 หน่วยพยายาม
  complete cart ที่มีเพิ่มอีก 1 หน่วย checkout จะล้มเหลวด้วย `FLASH_LIMIT_EXCEEDED`
- AC-3 เมื่อ `total_cap=10` และมีการสั่งซื้อครบ 10 หน่วยแล้ว checkout ครั้งที่ 11 จะล้มเหลวด้วย `FLASH_SOLD_OUT`
- AC-4 `GET /store/flash-sales/active` คืนข้อมูล countdown และ `flash_price` สำหรับ variant
  ในแคมเปญ; PDP แสดง countdown และราคาขีดฆ่า (screenshot)
- AC-5 เมื่อ order ที่มี flash unit 2 หน่วยถูกยกเลิก usage ของลูกค้าลดลง 2
- AC-6 การประมวลผล event `order.placed` เดิมสองครั้ง เพิ่ม usage เพียงครั้งเดียว
- AC-8 (code ชนะ, ADR-009) ให้ F = automatic promotion ที่มี exclusivity rule, N = automatic promotion ไม่มี rule
  (a) cart มีส่วนลด F อยู่ เมื่อใส่ code `SAVE10` → 200, `cart.promotions` มี `SAVE10` ไม่มี F, ไม่มี adjustment จาก F
  (b) cart มี `SAVE10` แล้วเพิ่มสินค้า flash → ยังมี `SAVE10`, ไม่มี adjustment จาก F
  (c) จาก (b) ลบ `SAVE10` → adjustment จาก F กลับมา
  (d) cart ไม่มี code → F ถูกใส่ตามปกติ (context เป็น `"false"` ไม่ใช่ว่าง)
  (e) cart มี `SAVE10` + สินค้าใน N → ได้ทั้ง `SAVE10` และ N
  (f) cart ที่ถูกตั้งให้มี F + `SAVE10` พร้อมกัน (สร้างตรงผ่าน module ใน test) → complete cart ล้มเหลว `PROMOTION_NOT_COMBINABLE`
  (g) storefront: cart ที่มี code และสินค้า flash แสดงข้อความ "Flash sale price can't be combined with promotion codes" (screenshot)
- AC-7 checkout พร้อมกัน 50 รายการจากลูกค้าต่างคนภายใต้ `total_cap=20` → สำเร็จ 20 รายการพอดี
  (integration concurrency test)

## Non-functional
- การเพิ่ม usage ทำใน worker ไม่ใช่ใน request path

## แผนการทดสอบ
- Unit: การคำนวณ limit, helper สำหรับช่วงเวลา, `exclusiveAutomaticRule` / `isExclusiveAutomatic` /
  การคำนวณชุด code ผลลัพธ์และค่า flag ตาม `action` (PROMO-1)
- Integration (http): AC-1, AC-2, AC-3, AC-5, AC-6, AC-7, AC-8 (a)–(f)
- e2e: AC-8 (g)
- e2e: AC-4 (screenshot PLP/PDP/cart ที่ T-1min และ T+1min โดยใช้ clock control)

## Tasks
| ID | Task | Depends |
|----|------|---------|
| PROMO-1 | Exclusivity ตามกฎข้อ 6: constant + helper (unit), hook `setPromotionContext` + `validate` ของ `updateCartPromotionsWorkflow`, `validate` ของ `completeCartWorkflow` + integration test (AC-8 a–f; test สร้าง F/N/`GB-*` เองด้วย helper ไม่พึ่ง FS/GB) | CORE-2 |
| FS-1 | Module `flash_sale` model/service/link/migration + unit test (ไม่กระทบจาก ADR-009: การระบุ exclusive ไม่ใช้ module นี้) | CORE-2 |
| FS-2 | Usage subscriber (placed/cancel/refund) แบบ idempotent + test (AC-5, AC-6) | FS-1 |
| FS-3 | Hook validation ตอน complete cart: per-customer limit + total cap แบบ atomic (AC-2, AC-3, AC-7) | FS-1 |
| FS-4 | Store endpoint `/store/flash-sales/active` พร้อม promotion price preview (AC-4 API) | FS-1 |
| FS-5 | Admin campaign widget + `POST /admin/flash-sales/:campaign_id/config` ใส่ exclusivity rule ให้ทุก automatic promotion ของ campaign (idempotent, ใช้ helper PROMO-1) และ widget เตือน promotion ที่ไม่มี rule (กฎข้อ 7) | FS-1, PROMO-1 |
| FS-6 | Storefront banner/countdown/ราคาบน PDP + ข้อความ AC-8 (g) + e2e (AC-1, AC-3, AC-4, AC-8 g) | FS-4, PROMO-1 |
PROMO-1 ∥ FS-1; FS-2 ∥ FS-3 ∥ FS-4 หลัง FS-1; FS-5 หลัง FS-1 และ PROMO-1

## คำถามที่ยังเปิดอยู่
- คำถามเรื่อง guest ได้ข้อสรุปแล้ว: ต้องล็อกอินทั่วทั้งร้าน
- ~~Q1~~ ตัดสินแล้ว (owner, 2026-10-25): flash promotion ที่ยังไม่ได้บันทึก flash config (FS-5) ไม่มี exclusivity rule
  และซ้อนกับ code ได้ — ยอมรับ โดย widget ของ FS-5 ต้องเตือน promotion ที่ยังไม่มี rule
- ตัดสินแล้ว (owner, 2026-10-25): AC-8 "code ชนะ flash หลุด" ทุกลำดับการกระทำ
