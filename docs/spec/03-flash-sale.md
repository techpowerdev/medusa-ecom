# 03 Flash sale — แคมเปญส่วนลดแบบจำกัดเวลา

สถานะ: draft (exclusivity ปรับตาม ADR-009; FS-2/FS-3 ปรับตามข้อตัดสิน owner เรื่องจองตอน complete, 2026-10-25)
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
| กัน race ข้าม cart ของลูกค้าคนเดียว | Locking module (Redis ใน prod, spec 07) | ใช้ตามที่มี — lock ต่อ `(campaign_id, customer_id)` ใน hook |
| ขยาย `completeCartWorkflow` พร้อม compensation | workflow hook `validate` (handler + compensate) | ขยาย — **hook หนึ่งตัวมี handler ได้ตัวเดียว** (กฎข้อ 8) |
| order ↔ cart | link `order.cart` ของ Medusa | ใช้ตามที่มี — FS-2 หา reservation จาก `cart_id` ของ order |

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

FlashSaleReservation   (ใหม่ใน FS-3)
  id, cart_id, campaign_id, customer_id, units: int, released_at: timestamptz?
  // unique (cart_id, campaign_id)
```
Link: `flash_sale_config ↔ promotion_campaign`
ไม่มี DB check `units_sold <= total_cap` (กฎข้อ 12) — คง check เดิมของ FS-1 (`units_sold >= 0`, `total_cap > 0`)

## Workflows / hooks
- **Handler รวมของ `completeCartWorkflow.hooks.validate`** ไฟล์เดียว `src/workflows/hooks/complete-cart-validate.ts`
  (กฎข้อ 8) ทำตามลำดับ:
  1. ข้ามทั้งหมดหาก `cart.completed_at` มีค่า (retry, กฎข้อ 11)
  2. check ของ PROMO-1 (exclusivity, กฎข้อ 6e) — อ่านอย่างเดียว ไม่เขียนข้อมูล
  3. check + จองของ FS-3: หา flash campaign ใน cart (กฎข้อ 9) แล้ว acquire lock
     `flash_sale:customer:<campaign_id>:<customer_id>` ทุก campaign เรียงตาม `campaign_id` (กัน deadlock)
     จากนั้นเรียก service method ของ module `flash_sale` หนึ่งครั้ง ทำใน **transaction เดียว** ทุก campaign:
     (a) per-customer: `FlashSaleUsage.units + n <= per_customer_limit` ไม่เช่นนั้น `FLASH_LIMIT_EXCEEDED`
     แล้ว upsert `units = units + n`;
     (b) total cap: `UPDATE ... SET units_sold = units_sold + n WHERE id = ? AND (total_cap IS NULL OR units_sold + n <= total_cap)`
     ไม่มีแถวถูกอัปเดต → `FLASH_SOLD_OUT`;
     (c) insert `FlashSaleReservation(cart_id, campaign_id, customer_id, units=n)`
     ข้อใดล้ม → rollback ทั้ง transaction (ไม่มีการจองค้าง) แล้ว release lock
  - **Compensation** (เมื่อ step หลัง hook ใน `completeCartWorkflow` ล้ม): คืน usage + `units_sold` ตาม reservation
    ของ `cart_id` นั้นและลบ reservation ใน transaction เดียว; idempotent (ไม่มี reservation = ไม่ทำอะไร)
  - campaign budget ของ Medusa ไม่ atomic ข้าม cart ที่ทำงานพร้อมกัน ดังนั้นตัวนับของเราคือ source of truth
    สำหรับ "N พอดี"; ตั้ง campaign budget ให้เท่ากันไว้เป็น backstop
- **FS-2 คืนค่า** (ไม่มี subscriber บน `order.placed` อีก — การนับเกิดตอน complete แล้ว): subscriber บน
  `order.canceled` และ refund เต็มจำนวน (กฎข้อ 10) → workflow หา `cart_id` ของ order ผ่าน `query.graph`
  แล้วเรียก service method ที่ทำใน transaction เดียว:
  `UPDATE flash_sale_reservation SET released_at = now() WHERE cart_id = ? AND released_at IS NULL RETURNING ...`
  แล้วลด `FlashSaleUsage.units` และ `units_sold` ตาม `units` ที่ได้ — แถวที่ release แล้วไม่ถูกคืนซ้ำ (idempotent
  ทั้ง event ซ้ำและ event พร้อมกัน)
- Exclusivity hooks (PROMO-1) ตามกฎข้อ 6 — ส่วนของ PROMO-1 ไม่เขียนข้อมูลจึงไม่มี compensation; compensation
  ของ handler รวมเป็นของส่วน FS-3 เท่านั้น

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
3. per-customer limit นับหน่วยที่ **complete cart สำเร็จแล้ว** (จองตอน complete ไม่ใช่ที่อยู่ใน cart) ลบด้วยหน่วยที่
   คืนแล้ว (กฎข้อ 10) โดย key เป็น `customer_id` (ต้องล็อกอินทั่วทั้งร้าน, spec 01)
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
   (g) known limitation: flow ที่ค้นหา automatic promotion เองนอก `updateCartPromotionsWorkflow`
   (admin draft order `computeDraftOrderAdjustmentsWorkflow`, price preview ของ FS-4) จะไม่ได้ F ถ้าไม่ส่ง
   context `exclusivity.code_applied` (prefilter ตัด F ทิ้ง) — FS-4 ต้องส่ง `"false"` เอง; order edit
   (`computeAdjustmentsForPreviewWorkflow`) ส่ง code จาก `order.promotions` ตรงจึงยังได้ F
7. ทุก automatic promotion ของ flash campaign ต้องมี exclusivity rule; การบันทึก config ใน FS-5 ใส่ให้อัตโนมัติ
   (idempotent ผ่าน `addPromotionRulesWorkflow`) เพราะฟอร์ม promotion ของ Medusa admin ไม่มี attribute นี้
8. **hook ของ Medusa หนึ่งตัวมี handler ได้ตัวเดียว** (`createHook` ใน 2.22.1 โยน
   "Cannot define multiple hook handlers for the validate hook") — ใช้กับทุก spec: task ที่ใช้ hook เดียวกันต้องรวม
   handler ไว้ไฟล์เดียว แต่ละ task ส่งมอบ check เป็น function ที่ export แล้วให้ handler รวมเรียกตามลำดับ
   `completeCartWorkflow.hooks.validate` → `src/workflows/hooks/complete-cart-validate.ts`: PROMO-1 ก่อน แล้ว FS-3
   (check ที่อ่านอย่างเดียวมาก่อน check ที่เขียนข้อมูล; check ใหม่ในอนาคตเพิ่มในไฟล์นี้)
9. **units ที่นับ** ต่อ campaign = ผลรวม `quantity` **เต็ม** ของทุก cart line ที่มี adjustment จาก promotion ของ
   campaign นั้น (ไม่ใช่ `min(quantity, max_quantity)`) ใช้ทั้ง per-customer limit และ total cap; campaign ที่ไม่มี
   `FlashSaleConfig` ไม่ใช่ flash sale → ไม่ตรวจไม่จอง; มี config → จองเสมอ (`units_sold` นับแม้ `total_cap` เป็น null)
   และตรวจเฉพาะ limit ที่ตั้งค่าไว้
10. การคืนค่า (FS-2): `order.canceled` หรือ refund เต็มจำนวนของ order → คืน **ทั้ง** `FlashSaleUsage.units` ของลูกค้า
    และ `units_sold` ตาม reservation ของ cart ของ order นั้น ครั้งเดียวต่อ reservation; refund บางส่วน/return
    ไม่คืน (รอยืนยัน Q3)
11. hook validate ข้ามทุก check เมื่อ `cart.completed_at` มีค่า (การ retry complete คืน order เดิม ไม่จองซ้ำ)
12. ไม่มี DB check `units_sold <= total_cap` — ใช้ `WHERE` แบบมีเงื่อนไขตอนจองแทน เพื่อให้ FS-5 ลด `total_cap`
    ต่ำกว่า `units_sold` ได้; เมื่อ `units_sold >= total_cap` ทุก complete ถัดไปที่มี units > 0 ล้มด้วย `FLASH_SOLD_OUT`

## Acceptance criteria
- AC-1 เมื่อมีแคมเปญที่ทำงานอยู่ (−20% สำหรับ collection X, automatic) และลูกค้าเพิ่มสินค้า X
  ลง cart แสดงยอดรวมหลังส่วนลด; หลัง `ends_at` cart ใหม่แสดงราคาเต็ม
- AC-2 ให้ `per_customer_limit=2`
  (a) ลูกค้าที่ complete cart สำเร็จไปแล้ว 2 หน่วย (usage = 2) complete cart ที่มีเพิ่มอีก 1 หน่วย → ล้มเหลว
  `FLASH_LIMIT_EXCEEDED`, usage ยังเป็น 2, `units_sold` ไม่เปลี่ยน, ไม่มี order ใหม่
  (b) ลูกค้าใหม่ complete cart ที่มี line flash `quantity=3` (promotion `max_quantity=1`) → ล้มเหลว
  `FLASH_LIMIT_EXCEEDED` (นับ 3 ไม่ใช่ 1, กฎข้อ 9)
  (c) ลูกค้าใหม่ complete cart 2 หน่วย → สำเร็จ และทันทีหลัง response usage = 2, `units_sold` เพิ่ม 2
  (ไม่ต้องรอ `order.placed`)
- AC-3 เมื่อ `total_cap=10` และ complete สำเร็จครบ 10 หน่วยแล้ว (`units_sold=10`) checkout ครั้งที่ 11 → ล้มเหลว
  `FLASH_SOLD_OUT`, `units_sold` ยังเป็น 10, usage ของลูกค้าคนนั้นไม่เปลี่ยน
- AC-4 `GET /store/flash-sales/active` คืนข้อมูล countdown และ `flash_price` สำหรับ variant
  ในแคมเปญ; PDP แสดง countdown และราคาขีดฆ่า (screenshot)
- AC-5 เมื่อ order ที่มี flash unit 2 หน่วยถูกยกเลิก (`order.canceled`) usage ของลูกค้าลดลง 2 **และ** `units_sold`
  ลดลง 2 และ reservation มี `released_at`; refund เต็มจำนวนของ order ลักษณะเดียวกันให้ผลเดียวกัน
- AC-6 การประมวลผล event คืนค่าของ order เดิมซ้ำ (ส่ง `order.canceled` สองครั้งตามลำดับ, สองครั้งพร้อมกัน
  และ refund ตามด้วย cancel) คืน usage และ `units_sold` เพียงครั้งเดียว
- AC-8 (code ชนะ, ADR-009) ให้ F = automatic promotion ที่มี exclusivity rule, N = automatic promotion ไม่มี rule
  (a) cart มีส่วนลด F อยู่ เมื่อใส่ code `SAVE10` → 200, `cart.promotions` มี `SAVE10` ไม่มี F, ไม่มี adjustment จาก F ✓ PROMO-1 (#21)
  (b) cart มี `SAVE10` แล้วเพิ่มสินค้า flash → ยังมี `SAVE10`, ไม่มี adjustment จาก F ✓ PROMO-1 (#21)
  (c) จาก (b) ลบ `SAVE10` → adjustment จาก F กลับมา ✓ PROMO-1 (#21)
  (d) cart ไม่มี code → F ถูกใส่ตามปกติ (context เป็น `"false"` ไม่ใช่ว่าง) ✓ PROMO-1 (#21)
  (e) cart มี `SAVE10` + สินค้าใน N → ได้ทั้ง `SAVE10` และ N ✓ PROMO-1 (#21)
  (f) cart ที่ถูกตั้งให้มี F + `SAVE10` พร้อมกัน (สร้างตรงผ่าน module ใน test) → complete cart ล้มเหลว `PROMOTION_NOT_COMBINABLE` ✓ PROMO-1 (#21)
  (g) storefront: cart ที่มี code และสินค้า flash แสดงข้อความ "Flash sale price can't be combined with promotion codes" (screenshot)
- AC-7 (integration concurrency test)
  (a) complete พร้อมกัน 50 cart จากลูกค้าต่างคน คนละ 1 หน่วย ภายใต้ `total_cap=20` → สำเร็จ 20 รายการพอดี,
  `units_sold=20`, ผลรวม usage = 20, ที่เหลือ 30 ล้มด้วย `FLASH_SOLD_OUT`
  (b) ลูกค้าคนเดียวมี 2 cart (คนละ cart_id) cart ละ 2 หน่วย ภายใต้ `per_customer_limit=2` complete พร้อมกัน →
  สำเร็จ 1 ล้ม 1 ด้วย `FLASH_LIMIT_EXCEEDED`, usage = 2, `units_sold` เพิ่ม 2
- AC-9 (compensation) เมื่อ step หลัง hook ใน `completeCartWorkflow` ล้มหลังจองแล้ว (test ทำให้ล้ม เช่น
  payment authorization ล้ม) → complete ล้มเหลว, usage และ `units_sold` กลับเป็นค่าก่อน complete, ไม่มี reservation ของ cart นั้น
- AC-10 (retry) เรียก complete ซ้ำกับ cart ที่ complete สำเร็จแล้ว → ได้ order เดิม, usage และ `units_sold` ไม่เปลี่ยน
- AC-11 (ลด cap, กฎข้อ 12)
  (a) `POST /admin/flash-sales/:campaign_id/config` ตั้ง `total_cap=5` ขณะ `units_sold=10` → 200, `units_sold` ยังเป็น 10
  (b) config ที่มี `units_sold=10`, `total_cap=5` (ตั้งตรงผ่าน module ใน test) → complete cart ที่มี flash 1 หน่วย
  ล้มเหลว `FLASH_SOLD_OUT`

## Non-functional
- การจอง usage + `units_sold` อยู่ใน request path ของ complete cart (ข้อตัดสิน owner) ภายใต้ lock ต่อ
  `(campaign_id, customer_id)` และ transaction เดียว — สั้น ไม่เรียก service ภายนอก; lock ต่อลูกค้าจึงไม่ทำให้
  ลูกค้าต่างคนรอกัน (total cap ใช้ `WHERE` แบบมีเงื่อนไข) ต้องใช้ Locking provider Redis ใน prod (spec 07)
  เพราะ in-memory provider ไม่กันข้าม instance; lock timeout → complete ล้มโดยไม่จองอะไร
- การคืนค่า (FS-2) ทำใน subscriber (worker) idempotent ด้วย `released_at` ของ reservation
- namespace lock `flash_sale:*` ไม่ซ้อนกับ lock ของ group buy (ADR-009) จึงไม่มีลำดับ lock ข้าม feature

## แผนการทดสอบ
- Unit: การคำนวณ units ต่อ campaign จาก cart lines (กฎข้อ 9), helper สำหรับช่วงเวลา, `exclusiveAutomaticRule` /
  `isExclusiveAutomatic` / การคำนวณชุด code ผลลัพธ์และค่า flag ตาม `action` (PROMO-1)
- Integration (modules): service method จอง/คืน/compensate ของ `flash_sale` (rollback ทั้ง transaction, `released_at`)
- Integration (http): AC-1, AC-2, AC-3, AC-5, AC-6, AC-7, AC-8 (a)–(f), AC-9, AC-10, AC-11
- e2e: AC-8 (g)
- e2e: AC-4 (screenshot PLP/PDP/cart ที่ T-1min และ T+1min โดยใช้ clock control)

## Tasks
| ID | Task | Depends |
|----|------|---------|
| PROMO-1 | Exclusivity ตามกฎข้อ 6: constant + helper (unit), hook `setPromotionContext` + `validate` ของ `updateCartPromotionsWorkflow`, `validate` ของ `completeCartWorkflow` + integration test (AC-8 a–f; test สร้าง F/N/`GB-*` เองด้วย helper ไม่พึ่ง FS/GB) | CORE-2 |
| FS-1 | Module `flash_sale` model/service/link/migration + unit test (ไม่กระทบจาก ADR-009: การระบุ exclusive ไม่ใช้ module นี้) | CORE-2 |
| FS-3 | Model + migration `FlashSaleReservation`; handler รวม `src/workflows/hooks/complete-cart-validate.ts` (ย้ายการลงทะเบียน `completeCartWorkflow.hooks.validate` ของ PROMO-1 มาไฟล์นี้ เรียก check PROMO-1 ก่อน, กฎข้อ 8); lock ต่อ `(campaign_id, customer_id)` + จอง usage/`units_sold`/reservation ใน transaction เดียว + compensation; ข้ามเมื่อ `completed_at` มีค่า (AC-2, AC-3, AC-7, AC-9, AC-10, AC-11 b; AC-8 f ต้องยังผ่าน) | FS-1, PROMO-1 |
| FS-2 | Subscriber คืนค่า `order.canceled` + refund เต็มจำนวน → คืน usage และ `units_sold` ตาม reservation แบบ idempotent (`released_at`) ไม่มี subscriber `order.placed` (AC-5, AC-6) | FS-3 |
| FS-4 | Store endpoint `/store/flash-sales/active` พร้อม promotion price preview (AC-4 API); preview ที่เรียก `computeActions` เองต้องส่ง context `exclusivity.code_applied: "false"` ไม่เช่นนั้น F ถูก prefilter ตัดทิ้ง (กฎข้อ 6g) | FS-1 |
| FS-5 | Admin campaign widget + `POST /admin/flash-sales/:campaign_id/config` ใส่ exclusivity rule ให้ทุก automatic promotion ของ campaign (idempotent, ใช้ helper PROMO-1) และ widget เตือน promotion ที่ไม่มี rule (กฎข้อ 7); รับ `total_cap` ต่ำกว่า `units_sold` ได้ (AC-11 a) | FS-1, PROMO-1 |
| FS-6 | Storefront banner/countdown/ราคาบน PDP + ข้อความ AC-8 (g) + e2e (AC-1, AC-3, AC-4, AC-8 g) | FS-4, PROMO-1 |
PROMO-1 ∥ FS-1; หลังทั้งสอง merge: FS-3 ∥ FS-4 ∥ FS-5; FS-2 หลัง FS-3 (ใช้ `FlashSaleReservation`); FS-6 หลัง FS-4

## คำถามที่ยังเปิดอยู่
- คำถามเรื่อง guest ได้ข้อสรุปแล้ว: ต้องล็อกอินทั่วทั้งร้าน
- ~~Q1~~ ตัดสินแล้ว (owner, 2026-10-25): flash promotion ที่ยังไม่ได้บันทึก flash config (FS-5) ไม่มี exclusivity rule
  และซ้อนกับ code ได้ — ยอมรับ โดย widget ของ FS-5 ต้องเตือน promotion ที่ยังไม่มี rule
- ตัดสินแล้ว (owner, 2026-10-25): AC-8 "code ชนะ flash หลุด" ทุกลำดับการกระทำ
- ตัดสินแล้ว (owner, 2026-10-25): FS-3 depend PROMO-1 + handler รวม (กฎข้อ 8); units = quantity เต็ม (กฎข้อ 9);
  จองตอน complete ภายใต้ lock + compensation, FS-2 เหลือแค่คืนค่า (กฎข้อ 10); ข้ามเมื่อ `completed_at`, ไม่มี DB check cap (กฎข้อ 11, 12)
- ~~Q2~~ ตัดสินแล้ว (owner, 2026-10-25): ใช้ model `FlashSaleReservation` (unique `(cart_id, campaign_id)`) เก็บ units
  ที่จองจริง เพื่อให้ compensation และการคืนค่าของ FS-2 แม่นยำและ idempotent แม้ promotion/campaign ถูกแก้ภายหลัง
- ~~Q3~~ ตัดสินแล้ว (owner, 2026-10-25): คืน flash quota (usage + `units_sold`) เฉพาะ cancel และ refund เต็มจำนวนของ order
  refund บางส่วน/return ไม่คืน
