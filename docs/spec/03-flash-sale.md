# 03 Flash sale — แคมเปญส่วนลดแบบจำกัดเวลา

สถานะ: draft (exclusivity ปรับตาม ADR-009; FS-2/FS-3 ปรับตามข้อตัดสิน owner เรื่องจองตอน complete, 2026-10-25; review 2026-10-25: remaining อิงหน่วย → FS-7, รูปแบบ error 409 ของ PROMO-2)
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
| variant id ของสินค้าที่มาจาก search hit | `GET /store/products?id[]=…&fields=id,variants.id` | ใช้ตามที่มี (FS-14) — ไม่เพิ่ม field ใน search index |

ช่องว่างที่เราเติม (แบบบาง):
1. **Per-customer cap** ตลอดทั้งแคมเปญ (เช่น สูงสุด 2 หน่วยต่อลูกค้า) — Promotion มี
   `max_quantity` ต่อ cart แต่ไม่มีการจำกัดต่อลูกค้า custom module `flash_sale` เก็บตัวนับ
   การใช้งานโดย key เป็น `(campaign_id, customer_id)` และมี workflow hook สำหรับตรวจสอบ cart
2. **Countdown บน storefront + การแสดง "flash price"** บน PLP/PDP — ต้องมี store endpoint
   ที่คืน flash campaign ที่กำลังทำงานอยู่ และราคาหลังส่วนลดที่จะเป็นของ variant นั้น
3. **การแสดง flash stock** ("เหลือ 12 ชิ้น" / "สินค้าหมด") — optional; อิงจาก `total_cap − units_sold` ของ
   `FlashSaleConfig` (ตัวเดียวกับที่ FS-3 ใช้ตัดสิน `FLASH_SOLD_OUT`) **ไม่ใช่** campaign budget `usage` เพราะ Medusa นับ
   `usage` เป็นจำนวนครั้งที่ promotion ถูกใช้ต่อ order ไม่ใช่จำนวนหน่วย (order เดียว 3 ชิ้น = usage 1) — กฎข้อ 4

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
  - ความเสี่ยง (review FS-2): subscriber ที่ล้ม (เช่น DB ขาดชั่วคราว) ไม่ถูก retry → การคืนโควตาหายเงียบ → follow-up FS-8
- Exclusivity hooks (PROMO-1) ตามกฎข้อ 6 — ส่วนของ PROMO-1 ไม่เขียนข้อมูลจึงไม่มี compensation; compensation
  ของ handler รวมเป็นของส่วน FS-3 เท่านั้น

## API
- Store: `GET /store/flash-sales/active?region_id=&variant_ids[]=` → campaign
  (id, name, starts_at, ends_at, banner_text, `sold_out`, `remaining_units` — สองฟิลด์หลังมาจาก FS-7 แทน `remaining_usage` เดิม) และ `flash_price`
  ต่อ variant ที่คำนวณผ่าน compute API ของ Promotion module บน cart line สังเคราะห์ (FS-4; ข้อจำกัดของ preview ดูกฎข้อ 14)
  - FS-7 แก้ response นี้: เอา `remaining_usage` ออก แล้วเพิ่มต่อ campaign
    `sold_out: boolean` (= `total_cap` ไม่ใช่ null และ `units_sold >= total_cap`; ไม่ขึ้นกับ `show_remaining`) และ
    `remaining_units: number | null` (= `max(0, total_cap − units_sold)` เมื่อ `show_remaining=true` และ `total_cap` ไม่ใช่ null,
    มิฉะนั้น `null`) — อ่านจาก `FlashSaleConfig` ไม่อ่าน campaign budget (กฎข้อ 4)
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
4. ตัวนับที่แสดงบน storefront คือตัวนับเดียวกับที่ FS-3 ใช้ตัดสิน "ขายได้ N พอดี": storefront แสดง "สินค้าหมด"
   (`data-testid="flash-sold-out"`) เมื่อ `sold_out=true` (`units_sold >= total_cap`) และแสดง "เหลือ N ชิ้น" (`flash-remaining`) จาก
   `remaining_units` (FS-7) — ข้อความไทยตรงในโค้ด (ADR-014) ห้ามใช้ campaign budget
   `usage` เพื่อแสดงผล เพราะนับต่อ order ไม่ใช่ต่อหน่วย; campaign budget เป็นเพียง backstop (ถ้าหมดก่อน Medusa หยุดใช้
   promotion เอง)
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
   (idempotent: step ของเราเรียก `addPromotionRules` ของ Promotion module ทีละ promotion ที่ยังไม่มี rule, compensation เรียก
   `removePromotionRules` กับ rule ที่เพิ่งเพิ่ม — Medusa 2.22.1 ไม่มี `addPromotionRulesWorkflow`; core-flows มี
   `addRulesToPromotionsStep`/`createPromotionRulesWorkflow` แต่รับ **ครั้งละ promotion เดียว** ขณะที่จำนวน promotion ใน campaign
   ไม่แน่นอน จึงต้องเขียน step เองที่วนหลาย promotion ใน step เดียว) เพราะฟอร์ม promotion ของ Medusa
   admin ไม่มี attribute นี้; promotion ที่เพิ่มเข้า campaign **หลัง** บันทึก config ยังไม่มี rule จนกว่าจะบันทึก config ซ้ำ
   (widget เตือนตาม Q1) — การใส่อัตโนมัติ (FS-9) **owner ตัดสินไม่ทำ 2026-10-27**: admin บันทึก config ซ้ำเองตามคำเตือนของ widget
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
    และ `units_sold` ตาม reservation ของ cart ของ order นั้น ครั้งเดียวต่อ reservation
    "refund เต็มจำนวน" มีเกณฑ์เดียว (owner, 2026-10-25): ยอด refund รวมของ order ≥ ยอด capture รวม **และ** ยอด capture รวม > 0
    เทียบด้วย `MathBN`/BigNumber (ห้ามใช้ number) — ไม่สนว่า refund มาจาก cancel, return หรือ refund ด้วยมือ;
    refund รวมยังไม่ถึง capture รวม → ไม่คืน; return ที่ไม่มี refund → ไม่คืน
11. hook validate ข้ามทุก check เมื่อ `cart.completed_at` มีค่า (การ retry complete คืน order เดิม ไม่จองซ้ำ)
12. ไม่มี DB check `units_sold <= total_cap` — ใช้ `WHERE` แบบมีเงื่อนไขตอนจองแทน เพื่อให้ FS-5 ลด `total_cap`
    ต่ำกว่า `units_sold` ได้; เมื่อ `units_sold >= total_cap` ทุก complete ถัดไปที่มี units > 0 ล้มด้วย `FLASH_SOLD_OUT`
13. (PROMO-2) code ธุรกิจของเรา (`PROMOTION_NOT_COMBINABLE`, `FLASH_*`, และ code `GB_*` ของ spec 04) ต้องถึง client ในรูปแบบเดียว
    ทุก route (ทั้ง route ของ Medusa และของเรา): **HTTP 409 body `{ type: "conflict", code: "<CODE ของเรา>", message }`** — code
    อยู่ในฟิลด์ `code` เสมอ (ตรงกับ spec 04 กฎข้อ 11) กลไก: override `errorHandler` ใน `defineMiddlewares` (กลไกทางการของ Medusa)
    ให้แปลงเฉพาะ error ที่มี code ของเรา (เช่น `MedusaError(CONFLICT, message, code)`; builder ตรวจว่า `code` รอดผ่าน workflow
    engine/hook จริงแล้วบันทึกวิธีที่ใช้ลงกฎนี้) error อื่นส่งต่อให้ `errorHandler` เดิมของ Medusa — ห้ามห่อ route ของ Medusa ใหม่
    ถ้าต้องทำมากกว่านี้ให้หยุดและเขียน ADR; route ของเราเอง (เช่น GB join ใน GB-3) ใช้กลไกเดียวกันนี้ ไม่แปลงเอง
    **วิธีที่ใช้จริง (PROMO-2):** `apps/backend/src/api/error-handler.ts` (`businessErrorHandler`) มี allow-list
    `BUSINESS_CONFLICT_CODES` — error ที่ `code` อยู่ใน list → 409 `{ type: "conflict", code, message }` (ตัดสินจาก `code`
    ไม่ดู `type`) ที่เหลือส่งให้ `errorHandler()` ของ Medusa ตามเดิม; วิธี throw: `new MedusaError(MedusaError.Types.CONFLICT,
    message, "<CODE>")` แล้ว **เพิ่ม code ลง allow-list** (GB-3 เพิ่ม `GB_*` ที่เป็น 409; code ที่ spec กำหนดเป็น 400 เช่น
    `GB_DISCOUNT_NOT_APPLIED` ไม่ใส่ — handler ของ Medusa คง `code` ของ `NOT_ALLOWED` อยู่แล้ว) `code` รอดผ่าน workflow engine
    เพราะ orchestrator ส่ง error ผ่าน `serializeError` ซึ่งคง own property (`type`, `code`, `message`) เป็น object ธรรมดา
    (ไม่ใช่ instance ของ `MedusaError`) handler จึงอ่าน property ตรงๆ ไม่ใช้ `instanceof` (ยืนยันด้วย test ผ่าน hook ของ
    `updateCartPromotionsWorkflow`/`completeCartWorkflow` จริงใน AC-12)
14. **ข้อจำกัดของ price preview (FS-4)**: `flash_price` คิดเฉพาะ promotion ที่ `application_method.target_type = "items"`
    (promotion แบบ `order`/`shipping_methods` ในแคมเปญไม่สะท้อนใน `flash_price` แม้มีผลใน cart); promotion `type = "fixed"`
    ใน region ราคารวมภาษี (THB VAT 7%) ค่า preview อาจต่างจากยอดใน cart จริง — ยอดใน cart (คำนวณโดย Medusa) เป็นค่าที่ถูกต้อง
    เสมอ; percentage ไม่ได้รับผลกระทบ (owner ยอมรับใน v1, Q4)
15. (FS-10, QA FS-5 D-1r) widget "Flash sale options" ส่ง `POST .../config` ได้ครั้งเดียวต่อการกด Save จนกว่า response กลับ — กันด้วย
    in-flight flag แบบ `useRef` (ตั้งก่อน `await` แบบ synchronous) ไม่พึ่ง state ของ React เพียงอย่างเดียว เพราะคลิกซ้ำใน tick เดียว
    เห็น state เดิม (ข้อมูลไม่เสียอยู่แล้วเพราะ lock แต่ไม่ควรมี request ซ้ำ)
16. (FS-11, review FS-8 #69) เส้นทาง `payment.refunded` ต้องได้กลไก retry เดียวกับ `order.canceled` ของ FS-8: การหา order/`cart_id` จาก payment และเกณฑ์
    refund เต็มจำนวน (กฎข้อ 10) ต้องอยู่**ใน** workflow (step) ไม่ใช่ใน subscriber ก่อนเรียก workflow — subscriber เหลือเพียงส่ง id จาก event เข้า workflow
    เพื่อให้ error ชั่วคราวระหว่างหา order ถูก retry/กวาดซ้ำได้
17. (**ปิดรอบ 10 — ไม่ต้องทำ**: QA #115 `docs/evidence/flash-sale/FS-6/REPORT.md` หัวข้อ "ราคา PDP เทียบกับ cart" ตรวจ target rule 5 แบบ (`items.product.id`,
    `items.product_id`, `items.variant_id`, `items.product.collection_id`, `items.product.categories.id`) + fixed ฿100 + จำนวน 2 แล้ว preview = `cart.total` ทุกกรณี —
    preview ส่งทั้ง `product_id` และ `product` ของ variant อยู่แล้ว (`apps/backend/src/lib/flash-sale-preview.ts`) และ cart ของ Medusa ก็รับทั้งสองแบบ ข้อกังวลเดิมไม่เกิดจริง)
    ข้อความเดิม: (FS-12, รอบ 9 — follow-up qa/review FS-6 #115) context ของ item ที่ preview ส่งให้ `computeActions` (`get-active-flash-sales.ts`) ต้องมีรูปเดียวกับ context ที่
    Medusa สร้างตอนคำนวณ promotion ของ cart (builder อ่าน core-flows 2.22.1 ว่า cart ส่ง field ใดของ item เช่น `product.id` แบบซ้อน) — promotion ที่มีผลกับสินค้าใน cart ต้อง
    มี `flash_price` ใน preview และ promotion ที่ไม่มีผลใน cart ต้องไม่มี (ปัจจุบัน preview ส่ง `product_id` แบน ทำให้ rule `items.product.id` กับ preview ไม่ตรงกัน); ข้อจำกัดของ
    กฎข้อ 14 ยังคงเดิม
18. (FS-13, รอบ 9 — qa FS-6 #115) storefront: เมื่อ `sold_out=true` ปุ่มเพิ่มลง cart ของสินค้านั้นบน PDP (`add-product-button`) ถูก disable และแสดง `flash-sold-out`
    (ไม่ให้ลูกค้าไปล้ม `FLASH_SOLD_OUT` ตอน checkout); การ์ดสินค้าใน PLP และแถบล่างของ PDP บนมือถือแสดงราคา flash เหมือน PDP
19. (FS-14, รอบ 10 — FS-13 #129 ส่งมอบเฉพาะ collection/category + PDP) การ์ดสินค้าบนหน้า `/store`, ผลค้นหา (`/search`) และ rail สินค้าของหน้าแรกแสดงราคา flash แบบเดียวกับการ์ดของ
    FS-13 (test id `flash-price`/`flash-original-price` เดิม) — hit ของ search index ไม่มี variant id: storefront หา variant id ของการ์ดที่แสดงอยู่ด้วย `GET /store/products` ของ Medusa
    (`id[]=<hit ids>&fields=id,variants.id`) **หนึ่ง request ต่อหน้า** แล้วเรียก data function flash เดิม (แบ่งชุด ≤ 24 variant) — **ไม่**เพิ่ม field ใน search index
    (เลี่ยงลำดับ release ของ spec 01 กฎข้อ 15); การ์ดที่ยังไม่ได้ข้อมูล flash แสดงราคาปกติ (ไม่ค้าง skeleton)
20. (FS-15, รอบ 10 — qa FS-6 O-1 #115 / CORE-24 #134) จำนวนที่เกินโควตา flash:
    (a) PDP: เมื่อแคมเปญของ variant มี `remaining_units` (ไม่ใช่ null) และจำนวนที่เลือกใน `product-quantity-select` (CORE-24) > `remaining_units` → แสดง
    `flash-qty-exceeds-remaining` (ข้อความไทยบอกจำนวนที่เหลือ) และ disable `add-product-button` จนกว่าจะลดจำนวน (units นับเต็มจำนวนตามกฎข้อ 9 → เกินแล้ว complete ล้มแน่นอน);
    `remaining_units = null` → ไม่เตือน (ไม่รู้ยอด)
    (b) cart: line ที่มี adjustment ของ flash campaign และ `quantity > remaining_units` แสดง `cart-flash-exceeds-remaining` ที่ line นั้น (ไม่บล็อกการแก้จำนวน)
    (c) checkout: complete ล้มด้วย code `FLASH_SOLD_OUT`, `FLASH_LIMIT_EXCEEDED`, `PROMOTION_NOT_COMBINABLE` (409 ของ PROMO-2) → ข้อความไทยเฉพาะของแต่ละ code ใน error ของขั้น
    review (ไม่ใช่ข้อความอังกฤษของ backend และไม่ใช่ข้อความ fallback ทั่วไป) — อ่าน `code` จาก error ถ้า js-sdk 2.22.1 เก็บไว้ (builder ตรวจ `FetchError`); ถ้าไม่เก็บ map
    ด้วยข้อความคงที่ของ backend พร้อม contract test ที่อ่าน source backend (แบบเดียวกับ spec 01 กฎข้อ 66c)
21. (FS-16, รอบ 10 — qa FS-13 #129 O-A/O-B/O-C) (a) PDP ของสินค้าที่ยังโหลดข้อมูล flash ไม่เสร็จ: `add-product-button` อยู่ในสถานะรอ (`disabled` + `aria-busy="true"`) จน request
    flash ตอบ (สำเร็จหรือ error — error แล้วปุ่มกลับมากดได้, ไม่ค้าง) (b) เมื่อ variant ที่เลือกมีราคา flash ราคาบน `product-price` (ด้านบนของ PDP) แสดงราคาเดิมแบบขีดฆ่า
    (`text-decoration: line-through`) — ไม่แสดงราคาเต็มแบบปกติคู่กับกล่อง flash (c) การ์ด PLP/`/store` ของสินค้าที่แคมเปญ `sold_out=true` แสดงป้าย `flash-card-sold-out`
    (ข้อความไทย) และราคาปกติ

## Acceptance criteria
- AC-1 เมื่อมีแคมเปญที่ทำงานอยู่ (−20% สำหรับ collection X, automatic) และลูกค้าเพิ่มสินค้า X
  ลง cart แสดงยอดรวมหลังส่วนลด; หลัง `ends_at` cart ใหม่แสดงราคาเต็ม ✓ FS-6 (e2e)
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
  ในแคมเปญ; PDP แสดง countdown และราคาขีดฆ่า (screenshot) ✓ FS-4 (API), FS-6 (PDP e2e)
- AC-5 เมื่อ order ที่มี flash unit 2 หน่วยถูกยกเลิก (`order.canceled`) usage ของลูกค้าลดลง 2 **และ** `units_sold`
  ลดลง 2 และ reservation มี `released_at`; refund เต็มจำนวนของ order ลักษณะเดียวกันให้ผลเดียวกัน
  (a) (กฎข้อ 10) order capture ฿1,000: refund ผ่าน return ครบ ฿1,000 → คืน 2 หน่วย; refund ฿999.99 → ไม่คืน; refund ฿600 แล้ว
  ฿400 (สองครั้ง) → คืนหลังครั้งที่สองครั้งเดียว; order ที่ capture = 0 แล้วมี refund event → ไม่คืนผ่านเส้นทาง refund
- AC-6 การประมวลผล event คืนค่าของ order เดิมซ้ำ (ส่ง `order.canceled` สองครั้งตามลำดับ, สองครั้งพร้อมกัน
  และ refund ตามด้วย cancel) คืน usage และ `units_sold` เพียงครั้งเดียว
- AC-8 (code ชนะ, ADR-009) ให้ F = automatic promotion ที่มี exclusivity rule, N = automatic promotion ไม่มี rule
  (a) cart มีส่วนลด F อยู่ เมื่อใส่ code `SAVE10` → 200, `cart.promotions` มี `SAVE10` ไม่มี F, ไม่มี adjustment จาก F ✓ PROMO-1 (#21)
  (b) cart มี `SAVE10` แล้วเพิ่มสินค้า flash → ยังมี `SAVE10`, ไม่มี adjustment จาก F ✓ PROMO-1 (#21)
  (c) จาก (b) ลบ `SAVE10` → adjustment จาก F กลับมา ✓ PROMO-1 (#21)
  (d) cart ไม่มี code → F ถูกใส่ตามปกติ (context เป็น `"false"` ไม่ใช่ว่าง) ✓ PROMO-1 (#21)
  (e) cart มี `SAVE10` + สินค้าใน N → ได้ทั้ง `SAVE10` และ N ✓ PROMO-1 (#21)
  (f) cart ที่ถูกตั้งให้มี F + `SAVE10` พร้อมกัน (สร้างตรงผ่าน module ใน test) → complete cart ล้มเหลว `PROMOTION_NOT_COMBINABLE` ✓ PROMO-1 (#21)
  (g) storefront: cart ที่มี code และสินค้า flash แสดงข้อความ "Flash sale price can't be combined with promotion codes" (screenshot) ✓ FS-6 (ข้อความไทย `flash-not-combinable`)
- AC-7 (integration concurrency test)
  (a) complete พร้อมกัน 50 cart จากลูกค้าต่างคน คนละ 1 หน่วย ภายใต้ `total_cap=20` → สำเร็จ 20 รายการพอดี,
  `units_sold=20`, ผลรวม usage = 20, ที่เหลือ 30 ล้มด้วย `FLASH_SOLD_OUT`
  (b) ลูกค้าคนเดียวมี 2 cart (คนละ cart_id) cart ละ 2 หน่วย ภายใต้ `per_customer_limit=2` complete พร้อมกัน →
  สำเร็จ 1 ล้ม 1 ด้วย `FLASH_LIMIT_EXCEEDED`, usage = 2, `units_sold` เพิ่ม 2
- AC-9 (compensation) เมื่อ step หลัง hook ใน `completeCartWorkflow` ล้มหลังจองแล้ว (test ทำให้ล้ม เช่น
  payment authorization ล้ม) → complete ล้มเหลว, usage และ `units_sold` กลับเป็นค่าก่อน complete, ไม่มี reservation ของ cart นั้น
- AC-10 (retry) เรียก complete ซ้ำกับ cart ที่ complete สำเร็จแล้ว → ได้ order เดิม, usage และ `units_sold` ไม่เปลี่ยน
- AC-11 (ลด cap, กฎข้อ 12)
  (a) `POST /admin/flash-sales/:campaign_id/config` ตั้ง `total_cap=5` ขณะ `units_sold=10` → 200, `units_sold` ยังเป็น 10 ✓ FS-5 (#38)
  (b) config ที่มี `units_sold=10`, `total_cap=5` (ตั้งตรงผ่าน module ใน test) → complete cart ที่มี flash 1 หน่วย
  ล้มเหลว `FLASH_SOLD_OUT`
- AC-12 (PROMO-2, error code ถึง client) error handler ของ Medusa เขียนทับ `code`/`message` ของ `MedusaError.Types.CONFLICT` เป็น
  `invalid_state_error` + ข้อความกลาง ทำให้ client ไม่เห็น code ของเรา
  (a) `POST /store/carts/:id/promotions` ที่ถูก hook ปฏิเสธ (`GB-*` + `SAVE10`) → status 409 และ body
  `{ type: "conflict", code: "PROMOTION_NOT_COMBINABLE", message: <string ไม่ว่าง> }` ✓ PROMO-2
  (b) `POST /store/carts/:id/complete` ที่ล้มด้วย `PROMOTION_NOT_COMBINABLE`, `FLASH_LIMIT_EXCEEDED`, `FLASH_SOLD_OUT` → status 409
  และ body `{ type: "conflict", code: <code นั้น>, message }` (ฟิลด์ `code` เท่านั้น ไม่ใช่ใน `message` หรือ `error` ของ `type: "cart"`) ✓ PROMO-2
  (c) error อื่นของ Medusa ที่ไม่ใช่ของเรา (เช่น `CONFLICT` ที่ Medusa throw เอง) → status, `type`, `code`, `message` เหมือนก่อนแก้ ✓ PROMO-2
  (d) (owner Q-C) route ของเราที่เคยตอบ 409 เอง (เช่น `POST /admin/evoucher/codes/:id/void` บน code ที่ไม่ใช่ `available`) → ยังได้ 409
  body `{ type: "conflict", code: "EVOUCHER_CODE_NOT_AVAILABLE", message }` (code ที่ PROMO-2 ตั้ง; ตรงกับ spec 02 AC-10) และไฟล์ route ไม่มี `res.status(409)` (ตรวจด้วย test + grep ใน CI/review)
  ✓ PROMO-2 — `POST /admin/evoucher/codes/:id/void` (EV-5 #43) ย้ายมาแล้ว: route เดิมไม่มี code จึงตั้ง code ใหม่
  `EVOUCHER_CODE_NOT_AVAILABLE` (spec 02 AC-10 ระบุแค่ `<code ของเรา>`); unit test สแกน `src/api/**/route.ts` ว่าไม่มี `status(409)`
- AC-13 (FS-7, remaining อิงหน่วย, กฎข้อ 4) config `total_cap=10`, `show_remaining=true`
  (a) `units_sold=7` จาก order เดียว qty 3 + 4 order qty 1 (campaign budget usage ของ Medusa = 5) → `GET /store/flash-sales/active`
  คืน `remaining_units=3`, `sold_out=false` และ response ไม่มี key `remaining_usage`
  (b) `units_sold=10` → `remaining_units=0`, `sold_out=true` (ตรงกับ AC-3: checkout ถัดไปล้ม `FLASH_SOLD_OUT`)
  (c) `units_sold=10`, `total_cap=5` (AC-11) → `remaining_units=0`, `sold_out=true`
  (d) `show_remaining=false`, `units_sold=10` → `remaining_units=null`, `sold_out=true`; `total_cap=null` → `remaining_units=null`, `sold_out=false`
  (e) storefront: PDP ของสินค้าในแคมเปญที่ `sold_out=true` มี `flash-sold-out` ที่มองเห็นได้และมีอักษรไทย (screenshot, FS-6) ✓ FS-6
- AC-14 (FS-8) ทำให้การคืนค่าครั้งแรกของ `order.canceled` ล้ม (test inject error ครั้งเดียว) → ภายในรอบ retry/job ถัดไป usage และ
  `units_sold` ถูกคืนครบครั้งเดียว และ reservation มี `released_at`
- ~~AC-15~~ (FS-9) ยกเลิก — owner ตัดสินไม่ทำ FS-9 (2026-10-27); ไม่มี test
- AC-16 (FS-10, กฎข้อ 15) Given หน้า Campaign detail ที่มี widget "Flash sale options" When `dblclick` ปุ่ม Save (สองคลิกใน tick เดียว)
  Then มี `POST /admin/flash-sales/:campaign_id/config` 1 ครั้ง (นับด้วย `page.on("request")`) และปุ่ม disabled จน response กลับ;
  When Save อีกครั้งหลัง response กลับ Then ส่งได้ตามปกติ (e2e admin หรือ component test ที่ mock `fetch`)
- AC-17 (FS-11, กฎข้อ 16) Given order ที่มี flash 2 หน่วย capture ฿1,000 When refund เต็มจำนวน (`payment.refunded`) และขั้นหา order จาก payment ล้มครั้งแรก
  (test inject error ครั้งเดียว) Then ภายในรอบ retry/job ถัดไป usage และ `units_sold` ถูกคืนครบครั้งเดียว และ reservation มี `released_at`; AC-5 (a) และ
  AC-6 ยังผ่าน; ไฟล์ subscriber `payment.refunded` ไม่มีการเรียก `query.graph`/service (ตรวจด้วย unit test หรือ grep) (integration http)
- ~~AC-18~~ (FS-12) **ยกเลิกรอบ 10** — ปิดตามผล QA #115 (กฎข้อ 17) ไม่มี test ใหม่; ข้อความเดิม: (FS-12, กฎข้อ 17) Given แคมเปญ flash ที่มี automatic promotion P1 (target rule attribute `items.product.id` in [X]) และ P2 (rule attribute ที่ไม่ตรงกับ context ของ cart
  เช่น `items.product_id` in [Y]) When `GET /store/flash-sales/active` และเพิ่ม X, Y ลง cart ของลูกค้า Then สำหรับแต่ละสินค้า "มี `flash_price` ใน preview" ⇔ "line ใน cart มี
  adjustment ของ promotion นั้น" และ `flash_price` ของ X เท่ากับราคาต่อหน่วยหลังส่วนลดของ line X ใน cart (promotion แบบ percentage) (integration http)
- AC-19 (FS-13, กฎข้อ 18) Given สินค้าในแคมเปญที่ `sold_out=true` When เปิด PDP Then `add-product-button` เป็น `disabled` และเห็น `flash-sold-out`; Given แคมเปญที่ไม่ sold out
  When เปิด PLP (desktop) และ PDP ที่ viewport 375×812 Then การ์ดสินค้าและแถบล่างของ PDP แสดงราคา flash (test id ราคา flash เดียวกับ PDP ของ FS-6) (e2e, screenshot ≤ 2)
- AC-20 (FS-14, กฎข้อ 19) Given แคมเปญ flash active ของสินค้า X (ไม่ sold out) และสินค้า Y นอกแคมเปญ When e2e เปิด `/th/store`, `/th/search?q=<ชื่อ X>` และหน้าแรก Then การ์ดของ X
  มี `flash-price` และ `flash-original-price` ทุกหน้า, การ์ดของ Y ไม่มี; unit ของ data function ที่หา variant id (mock SDK) ยืนยันว่าเรียก `GET /store/products` **1 ครั้ง**ต่อชุด hit ของหน้า (24 hit → 1 ครั้ง);
  diff ของ PR ไม่แตะ `apps/backend/src/search/` (grep) (e2e + unit Vitest)
- AC-21 (FS-15, กฎข้อ 20a/b) Given แคมเปญ `total_cap=3`, `show_remaining=true`, `units_sold=1` (`remaining_units=2`) When เลือกจำนวน 3 บน PDP Then เห็น `flash-qty-exceeds-remaining`
  มีอักษรไทย และ `add-product-button` disabled; เลือก 2 → ไม่มีคำเตือนและกดได้; Given `show_remaining=false` เลือก 3 Then ไม่มีคำเตือน; Given cart มี line ของ X qty 3 ขณะ
  `remaining_units=2` When เปิด `/th/cart` Then line นั้นมี `cart-flash-exceeds-remaining` (e2e)
- AC-22 (FS-15, กฎข้อ 20c) Given cart ที่ complete แล้วได้ 409 `FLASH_SOLD_OUT` (ตั้ง `units_sold = total_cap` ระหว่าง checkout) When กดสั่งซื้อในขั้น review Then error ที่แสดงมีอักษรไทย,
  ไม่มีข้อความอังกฤษของ backend และต่างจากข้อความของ `FLASH_LIMIT_EXCEEDED` (unit Vitest ของ mapping ทั้ง 3 code + e2e 1 กรณี `FLASH_SOLD_OUT`); ถ้า map ด้วยข้อความ: contract test
  ที่อ่าน source ของ backend ล้มเมื่อข้อความ backend เปลี่ยน (positive control ใน evidence)
- AC-23 (FS-16, กฎข้อ 21) Given PDP ของสินค้า X ในแคมเปญ sold out และ route ของ flash ถูกหน่วง 3 วินาที (route mock) When เปิดหน้า Then ระหว่างรอ `add-product-button` มี `aria-busy="true"`
  และ disabled, หลังตอบ disabled ด้วยเหตุ sold out; Given route ของ flash ตอบ 500 Then ปุ่มกลับมากดได้ภายใน 5 วินาที; Given แคมเปญไม่ sold out Then computed `text-decoration-line`
  ของราคาใน `product-price` มี `line-through`; Given แคมเปญ sold out When เปิด collection ของ X Then การ์ดของ X มี `flash-card-sold-out` มีอักษรไทย (e2e, screenshot ≤ 2)

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
- Integration (http): AC-1, AC-2, AC-3, AC-5 (รวม a), AC-6, AC-7, AC-8 (a)–(f), AC-9, AC-10, AC-11, AC-12, AC-13 (a)–(d), AC-14, AC-17
- Unit (FS-2): เกณฑ์ refund เต็มจำนวนด้วย BigNumber (กฎข้อ 10)
- Unit (FS-7): การคำนวณ `sold_out` / `remaining_units` จาก config (AC-13 a–d รวม clamp ที่ 0)
- e2e: AC-8 (g), AC-13 (e)
- e2e admin / component test: AC-16
- ~~Integration (http): AC-18 (FS-12)~~ (ปิดรอบ 10); e2e: AC-19 (FS-13)
- e2e + unit Vitest: AC-20 (FS-14), AC-21, AC-22 (FS-15), AC-23 (FS-16)
- e2e: AC-4 (screenshot PLP/PDP/cart ที่ T-1min และ T+1min โดยใช้ clock control)

## Tasks
| ID | Task | Depends |
|----|------|---------|
| PROMO-1 | Exclusivity ตามกฎข้อ 6: constant + helper (unit), hook `setPromotionContext` + `validate` ของ `updateCartPromotionsWorkflow`, `validate` ของ `completeCartWorkflow` + integration test (AC-8 a–f; test สร้าง F/N/`GB-*` เองด้วย helper ไม่พึ่ง FS/GB) | CORE-2 |
| FS-1 | Module `flash_sale` model/service/link/migration + unit test (ไม่กระทบจาก ADR-009: การระบุ exclusive ไม่ใช้ module นี้) | CORE-2 |
| FS-3 | Model + migration `FlashSaleReservation`; handler รวม `src/workflows/hooks/complete-cart-validate.ts` (ย้ายการลงทะเบียน `completeCartWorkflow.hooks.validate` ของ PROMO-1 มาไฟล์นี้ เรียก check PROMO-1 ก่อน, กฎข้อ 8); lock ต่อ `(campaign_id, customer_id)` + จอง usage/`units_sold`/reservation ใน transaction เดียว + compensation; ข้ามเมื่อ `completed_at` มีค่า (AC-2, AC-3, AC-7, AC-9, AC-10, AC-11 b; AC-8 f ต้องยังผ่าน) | FS-1, PROMO-1 |
| FS-2 | Subscriber คืนค่า `order.canceled` + refund เต็มจำนวน (เกณฑ์กฎข้อ 10: refund รวม ≥ capture รวม > 0, รวม refund จาก return; AC-5 a) → คืน usage และ `units_sold` ตาม reservation แบบ idempotent (`released_at`) ไม่มี subscriber `order.placed` (AC-5, AC-6) | FS-3 |
| FS-4 | Store endpoint `/store/flash-sales/active` พร้อม promotion price preview (AC-4 API); preview ที่เรียก `computeActions` เองต้องส่ง context `exclusivity.code_applied: "false"` ไม่เช่นนั้น F ถูก prefilter ตัดทิ้ง (กฎข้อ 6g) | FS-1 |
| FS-5 | Admin campaign widget + `POST /admin/flash-sales/:campaign_id/config` ใส่ exclusivity rule ให้ทุก automatic promotion ของ campaign (idempotent, ใช้ helper PROMO-1) และ widget เตือน promotion ที่ไม่มี rule (กฎข้อ 7); รับ `total_cap` ต่ำกว่า `units_sold` ได้ (AC-11 a) | FS-1, PROMO-1 |
| FS-6 | Storefront banner/countdown/ราคาบน PDP + "สินค้าหมด"/"เหลือ N ชิ้น" จาก `sold_out`/`remaining_units` (กฎข้อ 4) + ข้อความ AC-8 (g) + e2e (AC-1, AC-3, AC-4, AC-8 g, AC-13 e); ข้อความไทยตรงในโค้ด + path ใหม่ใน ESLint rule (spec 01 CORE-4 กฎข้อ 4, ADR-014) | FS-4, FS-7, PROMO-1, CORE-4b (แตะ PDP เดียวกัน) |
| PROMO-2 | follow-up PROMO-1/FS-3: override `errorHandler` ให้ code ของเราถึง client เป็น 409 `{ type: "conflict", code, message }` ตามกฎข้อ 13 + integration test (AC-12) + ย้าย route ของเราที่ตอบ 409 เอง และ merge แล้ว ณ ตอนทำ PROMO-2 (เช่น `POST /admin/evoucher/codes/:id/void` ของ EV-5) มาใช้กลไกนี้: throw `MedusaError(CONFLICT, message, "<CODE>")` และลบ try/catch/`res.status(409)` ใน route (AC-12 d) — route ที่ merge หลัง PROMO-2 ใช้กลไกนี้เอง (owner Q-C) | PROMO-1, FS-3 |
| FS-8 | follow-up FS-2 (เล็ก): การคืนโควตาต้องไม่หายเมื่อ subscriber ล้ม — ใช้กลไก retry ที่ Medusa มีให้ (เช่น option retry ของ workflow/step หรือ event bus) ก่อน ถ้าไม่มีให้ใช้ scheduled job กวาด order ที่เข้าเกณฑ์กฎข้อ 10 แต่ reservation ยังไม่ `released_at` (idempotent เดิม); AC-14 | FS-2 |
| FS-9 | **ปิด — owner ตัดสินไม่ทำ (2026-10-27)**; เดิม: follow-up FS-5: subscriber `promotion.created`/`promotion.updated` ใส่ exclusivity rule ให้ automatic promotion ใหม่ใน campaign ที่มี `FlashSaleConfig` อัตโนมัติ (ใช้ step เดียวกับ FS-5); AC-15 | FS-5 |
| FS-7 | follow-up FS-4 (backend เล็ก): `GET /store/flash-sales/active` เอา `remaining_usage` ออก เพิ่ม `sold_out` + `remaining_units` จาก `FlashSaleConfig` (pure function + unit test) และระบุข้อจำกัดของ preview (กฎข้อ 14) ใน JSDoc ของ route (AC-13 a–d) | FS-4 |
| FS-10 | follow-up QA FS-5 D-1r (เล็ก, frontend เท่านั้น): in-flight flag `useRef` ในปุ่ม Save ของ widget "Flash sale options" (กฎข้อ 15); AC-16 | FS-5 |
| FS-11 | follow-up review FS-8 #69 (เล็ก, backend): ย้ายการหา order/`cart_id` + เกณฑ์ refund เต็มจำนวนของเส้นทาง `payment.refunded` เข้า workflow ให้ใช้ retry ของ FS-8 (กฎข้อ 16); AC-17 | FS-8 |
| FS-12 | **✕ ปิดรอบ 10 (ไม่ต้องทำ)** — QA #115 พิสูจน์ preview = cart ทั้ง 5 แบบ target rule (กฎข้อ 17); เดิม: context ของ item ใน price preview ตรงกับของ cart; AC-18 | — |
| FS-13 | ☑ #129 — (เล็ก, storefront, รอบ 9 — qa #115) disable ปุ่มเพิ่มลง cart เมื่อ `sold_out` + ราคา flash บนการ์ด PLP และแถบล่าง PDP มือถือ (กฎข้อ 18); AC-19 | FS-6 ☑ (#115) |
| FS-14 | (เล็ก, storefront, รอบ 10 — scope ที่ FS-13 #129 ไม่ครอบ) ราคา flash บนการ์ดของ `/store`, `/search`, rail หน้าแรก โดยหา variant id ผ่าน `GET /store/products` หนึ่ง request ต่อหน้า ไม่แตะ search index (กฎข้อ 19); AC-20 | FS-13 ☑ (#129) |
| FS-15 | (storefront, รอบ 10 — qa FS-6 O-1, CORE-24 #134) เตือน/disable เมื่อจำนวนเกิน `remaining_units` บน PDP + เตือนใน cart + ข้อความไทยของ `FLASH_*`/`PROMOTION_NOT_COMBINABLE` ตอน complete (กฎข้อ 20); AC-21, AC-22 | CORE-24 (#134 — ใช้ `product-quantity-select`), FS-13 ☑ |
| FS-16 | (เล็ก, storefront, รอบ 10 — qa FS-13 O-A/O-B/O-C) ปุ่มรอระหว่างโหลดข้อมูล flash, ราคา `product-price` ขีดฆ่าเมื่อมีราคา flash, ป้าย sold out บนการ์ด (กฎข้อ 21); AC-23 | FS-15 (แตะ PDP ไฟล์เดียวกัน), FS-14 (แตะการ์ดเดียวกัน) |
FS-11 หลัง FS-8 (แตะ subscriber/workflow คืนโควตาไฟล์เดียวกัน); FS-10 ยังไม่ทำ (สถานะ 2026-10-26) ไม่เปลี่ยนนิยาม
PROMO-1 ∥ FS-1; หลังทั้งสอง merge: FS-3 ∥ FS-4 ∥ FS-5; FS-2 หลัง FS-3 (ใช้ `FlashSaleReservation`); FS-7 หลัง FS-4; FS-6 หลัง FS-4 และ FS-7; FS-8 หลัง FS-2; FS-9 ปิด (owner ไม่ทำ 2026-10-27);
FS-10 หลัง FS-5; FS-12 ∥ FS-13 (FS-12 backend เริ่มได้ทันที; FS-13 หลัง FS-6 #115 merge) — รอบ 10: FS-12 ปิด, FS-13 ☑ #129
(รอบ 10) FS-14 เริ่มได้ทันที ∥ FS-15 (หลัง CORE-24 #134 merge); FS-16 หลังทั้งสอง (แตะ PDP/การ์ดเดียวกัน); review nit #115 ที่เหลือ (server action ทำงานทีละตัวต่อ client — พฤติกรรมของ Next,
ไม่มี task; `slice(0,24)` แก้แล้วเป็นการแบ่งชุดใน FS-13) ไม่มี task
PROMO-2 ∥ FS-2/FS-4/FS-5/FS-7 (แตะ hook ไฟล์เดียวกับ FS-3 แต่ FS-3 merge แล้ว); ต้อง merge ก่อน GB-3 (dependency) และควรก่อน FS-6

## คำถามที่ยังเปิดอยู่
- คำถามเรื่อง guest ได้ข้อสรุปแล้ว: ต้องล็อกอินทั่วทั้งร้าน
- ~~Q1~~ ตัดสินแล้ว (owner, 2026-10-25): flash promotion ที่ยังไม่ได้บันทึก flash config (FS-5) ไม่มี exclusivity rule
  และซ้อนกับ code ได้ — ยอมรับ โดย widget ของ FS-5 ต้องเตือน promotion ที่ยังไม่มี rule
- ตัดสินแล้ว (owner, 2026-10-25): AC-8 "code ชนะ flash หลุด" ทุกลำดับการกระทำ
- ตัดสินแล้ว (owner, 2026-10-25): FS-3 depend PROMO-1 + handler รวม (กฎข้อ 8); units = quantity เต็ม (กฎข้อ 9);
  จองตอน complete ภายใต้ lock + compensation, FS-2 เหลือแค่คืนค่า (กฎข้อ 10); ข้ามเมื่อ `completed_at`, ไม่มี DB check cap (กฎข้อ 11, 12)
- ~~Q2~~ ตัดสินแล้ว (owner, 2026-10-25): ใช้ model `FlashSaleReservation` (unique `(cart_id, campaign_id)`) เก็บ units
  ที่จองจริง เพื่อให้ compensation และการคืนค่าของ FS-2 แม่นยำและ idempotent แม้ promotion/campaign ถูกแก้ภายหลัง
- ~~Q3~~ ตัดสินแล้ว (owner, 2026-10-25; ปรับ 2026-10-25): คืน flash quota (usage + `units_sold`) เมื่อ cancel หรือ refund เต็มจำนวน
  ตามเกณฑ์กฎข้อ 10 (refund รวม ≥ capture รวม และ capture > 0) ไม่ว่าจะมาจาก cancel หรือ return; refund บางส่วนไม่คืน
- ~~Q4~~ ตัดสินแล้ว (owner, 2026-10-25): ยอมรับข้อจำกัดของ preview ตามกฎข้อ 14 ใน v1
- ~~Q5~~ ตัดสินแล้ว (owner, 2026-10-25): FS-7 เอา `remaining_usage` ออก ใช้ `sold_out` + `remaining_units` แทน
