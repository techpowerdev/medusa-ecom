# 02 E-voucher — ขายต่อ voucher code ของพาร์ทเนอร์ ส่งมอบทางอีเมล

สถานะ: draft (ปรับปรุง 2026-10-25: voucher เป็น code ของพาร์ทเนอร์ ไม่ใช่ของเรา; ไม่มีการ redeem; รอบ 9 2026-10-27: Q6/Q7 ตัดสินแล้ว, EV-13; รอบ 10 2026-10-27: แตก EV-7 → EV-7a/7b/7c (builder หยุด), AC-6 ทดสอบได้, EV-N1, index ใหม่, EV-9 key เรียงรอง; owner ตัดสิน Q10 = (ก), Q11 คงเดิม; รอบ 11: กฎข้อ 2 ขอบ cutoff ตรงโค้ด; รอบ 12: EV-14, EV-N2, EV-7d, EV-7e; รอบ 13 2026-11-03: EV-N3 (follow-up #201/#205 — กฎข้อ 30, AC-44), ฟอร์ม partner ตรวจ URL ฝั่ง client → ADM-5 ของ spec 08; รอบ 26 2026-11-09: EV-15 (กฎข้อ 31, AC-45 — **บล็อก release v0.1.0**), แก้ถ้อยคำกฎข้อ 28c; รอบ 27 2026-11-10: EV-16 (กฎข้อ 32, AC-46), EV-17 (กฎข้อ 33, AC-47; owner ตอบ Q14 = ก); ปิดรอบ 27 2026-11-10: ☑ EV-16 #333, EV-17 #337, เพิ่ม EV-18 (review #333 — กฎข้อ 34, AC-48); รอบ 28 2026-11-10: ☑ EV-18 #339; รอบ 47 2026-11-27: EV-27 — กฎข้อ 43, AC-57..59; owner ตอบ Q15 = ข, Q16 = ก 2026-11-27)
เป้าหมาย (เจ้าของระบบ): ขาย e-voucher จากพาร์ทเนอร์ (Lotus, Big C, ห้างสรรพสินค้า, คาเฟ่…) เราได้รับ
coupon code จากพาร์ทเนอร์ล่วงหน้า และส่งมอบ 1 code ต่อ 1 หน่วยที่ขายได้ในรูปแบบดิจิทัล
(อีเมล) การ redeem เกิดขึ้นที่พาร์ทเนอร์ เราไม่ redeem เอง
นอกขอบเขต: API สำหรับ redeem/ตรวจสอบ, การสร้าง code ของเราเอง, การเชื่อมต่อ API ของพาร์ทเนอร์
เพื่อดึง code แบบ live (v2: สามารถเพิ่ม provider interface `CodeSource` ได้เมื่อพาร์ทเนอร์
มี API ให้), การขายต่อ/โอนย้ายระหว่างลูกค้า

## สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | การใช้งาน |
|------|-----------------|-----|
| สินค้า/variant ที่ขายได้พร้อมราคา | Product + Pricing | ใช้ตามที่มี; variant เชื่อมกับ code pool |
| lock ระหว่าง allocation กับ resend | Locking module (Redis) + `acquireLockStep`/`releaseLockStep` (รับ `ttl` และ `ownerId`) | ใช้ตามเดิม (EV-5c, กฎข้อ 21); รอบ 12 ระบุ `ownerId` ต่อ run (EV-N2, กฎข้อ 27 — builder ยืนยัน input ของ step ใน 2.22.1) |
| ตรวจ scheme ของ URL ใน admin API | ไม่มีเฉพาะ — validator ของ route เป็น zod (`validateAndTransformBody`) | ขยาย validator เดิม (EV-14, กฎข้อ 26) |
| Stock = จำนวน code ที่ยังไม่ขาย | Inventory module | **ใช้มัน**: การ import pool จะปรับ inventory level ของ variant; Medusa จอง/ตัด stock ตอนสั่งซื้อตามปกติ |
| Order, line items | Order module | ใช้ตามที่มี |
| ขั้นตอน "ส่งมอบ" | Fulfillment module + custom fulfillment provider `digital` | custom provider (ทันที) |
| ส่งอีเมล | Notification module | ใช้ตามที่มี, เพิ่ม template ใหม่ |
| Trigger หลังชำระเงิน | event `payment.captured` + subscriber | subscriber |
| Admin product UI | Admin widget บนหน้า product/variant | widget |
| Admin import UI | Admin route page + file upload (File module) | custom page |
| สินค้าที่ไม่ต้องจัดส่ง | `requires_shipping` ของ inventory item (override ระดับ variant) → line item `requires_shipping` | ใช้ตามที่มี; ตั้งค่าตอนสร้าง pool (EV-8) — **อย่างเดียว** (กฎข้อ 1) |
| ข้อมูลพาร์ทเนอร์/วิธีใช้บน PDP | `GET /store/products/:id` + read-only link `product_variant ↔ evoucher_pool` (มีแล้ว `src/links/product-variant-evoucher-pool.ts`) + helper `allowFields` ของ `@medusajs/framework/http` (≥ 2.21) ใน global middleware ให้ store route คืน field ของ link ที่ระบุทีละ path | **ขยาย** (EV-7a, กฎข้อ 23) — ไม่สร้าง route ใหม่ |
| auth ของ route ใต้ `/store/customers/me*` | Medusa ใส่ `authenticate("customer", ["session","bearer"])` ให้ path นี้ (builder ยืนยันกับ source 2.22.1) | ใช้ตามเดิมกับ route ใหม่ `GET /store/customers/me/evouchers` (EV-7a) |
| รายการบัตรกำนัลของลูกค้า | ไม่มี (module ของเรา) | custom route อ่านอย่างเดียว (EV-7a, กฎข้อ 22) |
| shipping profile | product ที่มี shipping profile **ใดก็ตาม** (Default, Digital หรืออื่น) → line item `requires_shipping=true` เสมอ (`core-flows` 2.22.1 `cart/utils/prepare-line-item-data.js:23-29`: `hasShippingProfile \|\| someInventoryRequiresShipping`) และ `validate-shipping.js:48-57` บังคับ shipping method ตาม profile ของ line ที่ต้องจัดส่ง | product ของ voucher ต้อง**ไม่มี shipping profile เลย** (กฎข้อ 1) |
| ล้าง shipping method ที่ไม่มี line ต้องจัดส่งแล้ว | `refreshCartShippingMethodsWorkflow` ล้างเฉพาะเมื่อ cart มี method > 1 (`core-flows` 2.22.1 `cart/workflows/refresh-cart-shipping-methods.js:107–110` `shouldCleanupOrphanProfiles`); hook `refreshCartItemsWorkflow.hooks.beforeRefreshingPaymentCollection` รันหลัง refresh method/promotion ก่อน refresh payment collection (`refresh-cart-items.js:183–186`) | **ขยาย** ด้วย hook (EV-15, กฎข้อ 31) — ไม่สร้าง route/workflow ใหม่ |
| รู้ว่า order ถูกยกเลิก และคืน stock | event `order.canceled` (`{ id }`); `cancelOrderWorkflow` ลบ reservation และต้องยกเลิก fulfillment ก่อนยกเลิก order (การยกเลิก fulfillment คืน stock ให้) | subscriber + workflow ของเรา (EV-16) **ไม่ปรับ inventory เอง** |

## Data model (module `evoucher`)
```
EvoucherPartner
  id, name, logo_url?, terms_url?, support_contact?, created_at

EvoucherPool                      // one per product variant
  id, partner_id, variant_id (link → product_variant, unique), name,
  face_value: bigNumber?, validity_note: text?, how_to_use: text (shown in email),
  low_stock_threshold: int (default 20)

EvoucherCode                      // imported from partner; one row per code
  id, pool_id, code: string (encrypted at rest; unique per pool), pin?: string (encrypted),
  expires_at?: timestamptz (from partner file), batch_ref: string (import batch),
  status: "available" | "allocated" | "delivered" | "void",
  void_reason?: text,             // EV-5: ตั้งเมื่อ status → void ("expiring" จาก job หรือข้อความจาก admin)
  order_id?, order_line_item_id?, customer_id?, allocated_at?, delivered_at?, delivered_to_email?
  // index (pool_id, status); unique (pool_id, code)
```
Links: `evoucher_pool ↔ product_variant`, `evoucher_code ↔ order` (สำหรับ tab order ใน admin)

## Workflows
- `importEvoucherCodesWorkflow(pool, file)` (admin): parse CSV (`code,pin?,expires_at?`),
  ปฏิเสธ code ที่ซ้ำภายใน pool, insert แถว `available` พร้อม `batch_ref` (compensation:
  ลบ batch) → ปรับ Medusa inventory level ของ variant เพิ่ม `+inserted`
  (compensation: `-inserted`) คืนค่าจำนวนที่ insert / จำนวนที่ข้ามเพราะซ้ำ
- `allocateAndDeliverEvouchersWorkflow(order_id)` เมื่อเกิด `payment.captured`:
  สำหรับแต่ละ voucher line item × quantity: claim code 1 รายการแบบ atomic
  (`UPDATE evoucher_code SET status='allocated', order_id=… WHERE id = (SELECT id … WHERE
  pool_id=? AND status='available' AND (expires_at IS NULL OR expires_at > now()+interval '7 days')
  ORDER BY expires_at NULLS LAST LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`)
  (compensation: ปล่อยกลับเป็น `available`) → สร้าง fulfillment ผ่าน provider `digital`
  (compensation: ยกเลิก) → ส่งอีเมล `evoucher.delivered` พร้อม code, PIN, วิธีใช้ของ
  พาร์ทเนอร์, วันหมดอายุ → mark เป็น `delivered` Idempotent: ข้าม line item ที่ allocate ไปแล้ว
  หากมี code ว่างไม่ครบ quantity ของ line (stock คลาดเคลื่อน): ปล่อย code ที่ claim แล้วของ line นั้น และ mark **ทั้ง line** เป็น `backordered` ใน metadata
  (กฎข้อ 18), ส่งอีเมลหา mailbox admin (กฎข้อ 9), ไม่ทำให้ order ล้มเหลว; ส่งอีเมลล้ม → code คง `allocated` + แจ้ง admin (กฎข้อ 17);
  `data` ของ notification เก็บ code/PIN เป็น ciphertext (กฎข้อ 16)
- Scheduled job รายวัน: code `available` ที่ `expires_at < now + 7 days` → `void`
  (reason `expiring`) และลด inventory **ยกเว้น code ที่เว้นไว้ให้ order ที่จอง stock แล้ว** (กฎข้อ 12b, EV-12); ส่งอีเมลสรุปหา mailbox admin (กฎข้อ 9) อีเมล low-stock เมื่อ
  `available < low_stock_threshold`
- Admin `resendEvoucherEmailWorkflow(order_id)` (EV-5b): ส่งอีเมล `evoucher.delivered` ซ้ำไปที่อีเมลของ order ด้วย code ที่
  `delivered` หรือ `allocated` (ส่งอีเมลล้มตามกฎข้อ 17) ของ order นั้น — ไม่ allocate ใหม่; ส่งสำเร็จ → code `allocated` เป็น `delivered`;
  order ที่ไม่มี code `delivered`/`allocated` → 400 `NOT_ALLOWED`; **ทุกครั้งที่ resend สร้าง notification ด้วย `idempotency_key` ใหม่**
  (กฎข้อ 19) ไม่ใช้ key ของการส่งครั้งก่อน
- Admin `voidCodeWorkflow(code_id, reason)` สำหรับ code สถานะ `available` เท่านั้น (ปรับ inventory ด้วย)

## API
- Admin: CRUD `/admin/evoucher/partners`, CRUD `/admin/evoucher/pools`,
  `POST /admin/evoucher/pools/:id/import` (multipart CSV), `GET /admin/evoucher/pools/:id/codes?status=`,
  `POST /admin/evoucher/codes/:id/void`, `POST /admin/evoucher/orders/:id/resend`
  ค่าของ code จะถูกคืน **เฉพาะ** ที่ `GET .../codes/:id/reveal` (มี audit)
- Store (customer auth): `GET /store/customers/me/evouchers` → code ที่ส่งมอบแล้วของตนเอง
  (code, pin, พาร์ทเนอร์, วิธีใช้, วันหมดอายุ) ไม่มี endpoint สำหรับ redeem
  — (รอบ 10, EV-7a, กฎข้อ 22) query `limit` 1..100 ค่าเริ่มต้น 20, `offset` ≥ 0 (zod ผ่าน `validateAndTransformQuery`) → 200
  `{ evouchers: [{ id, code, pin, expires_at, delivered_at, order_id, pool: { name, face_value, validity_note, how_to_use },
  partner: { name, logo_url, terms_url, support_contact } }], count }` เรียง `delivered_at` ใหม่สุดก่อน; header `Cache-Control: private, no-store`;
  **ไม่มี** route รายตัว (`/store/customers/me/evouchers/:id`) — ไม่มีทางอ้าง code ด้วย id
- Store (สาธารณะ, รอบ 10, EV-7a, กฎข้อ 23): `GET /store/products` และ `GET /store/products/:id` คืนข้อมูลพาร์ทเนอร์ของ voucher variant เมื่อ client ขอผ่าน `fields`
  (path ของ link ตามที่ builder ยืนยัน เช่น `+variants.evoucher_pool.name,+variants.evoucher_pool.how_to_use,…,+variants.evoucher_pool.partner.name`) — ไม่มี route ใหม่

## Admin UI / Storefront
- Admin route page "E-vouchers": พาร์ทเนอร์, pool (variant, จำนวน available / allocated /
  delivered / void, badge low-stock), import CSV พร้อมสรุปผล, รายการ code
  (masked), reveal พร้อม audit log
- Admin widget บนหน้า variant: "Voucher pool" (พาร์ทเนอร์, face value, stock จาก pool)
- Tab บนหน้า order ใน admin: code ที่ส่งมอบแล้ว (masked) + ส่งซ้ำ
- Storefront (ข้อความไทยตรงในโค้ด ADR-014; e2e หาด้วย test id): PDP แสดงพาร์ทเนอร์, วิธีใช้, "ส่งมอบทางอีเมล"; หน้า account
  "บัตรกำนัลของฉัน" (เมนู `vouchers-link`, การ์ด `voucher-card`, ปุ่มคัดลอก `voucher-copy-button`)
  แสดง code + PIN (ปุ่ม copy), โลโก้พาร์ทเนอร์, วันหมดอายุ; checkout แบบ digital-only ตามเดิม
  — (รอบ 10) PDP: บล็อก `evoucher-partner-block` (ชื่อ/โลโก้พาร์ทเนอร์, `how_to_use`, `validity_note`, ข้อความ "ส่งมอบทางอีเมล") แสดงเฉพาะ variant ที่มี pool (EV-7b);
  หน้า `/<cc>/account/vouchers` (EV-7b); checkout digital-only (EV-7c, กฎข้อ 24)

## Business rules
1. variant จะเป็น voucher ก็ต่อเมื่อมี `EvoucherPool`; `requires_shipping=false`,
   `manage_inventory=true` โดย inventory ต้องเท่ากับจำนวน code ที่ `available` เสมอ; (owner 2026-10-26, รอบ 6 — **ยกเลิก**ข้อตัดสิน Q5 เดิมเรื่อง profile Digital)
   line item ของ voucher มี `requires_shipping=false` ได้ก็ต่อเมื่อ**ทั้งสองข้อ**: (a) inventory item `requires_shipping=false` (EV-8) และ (b) product ของ voucher
   **ไม่มี shipping profile เลย** — ใน Medusa 2.22.1 profile ใดก็ตาม (รวม Default ที่ seed/admin ใส่ให้ product ส่วนใหญ่) ทำให้ line item `requires_shipping=true`
   (`prepare-line-item-data`: `hasShippingProfile || inventory`) และ `validate-shipping` จะบังคับ method ของ profile นั้น (Standard) — ตรงกับที่ EV-10 (#85) ทำ;
   การสร้าง pool ให้ variant ที่ product มี shipping profile → **400** ไม่มี pool (owner ตัดสิน Q9 2026-10-26); การเลือก shipping option ของ cart voucher
   (ถ้า storefront ใส่) ทำตามกฎข้อ 8
2. จะ allocate code หลังจากชำระเงิน **captured** แล้วเท่านั้น โดยเลือก code ที่หมดอายุเร็วที่สุดก่อน
   และไม่เลือก code ที่จะหมดอายุภายใน 7 วัน — **ข้อยกเว้น (EV-12, owner Q6 2026-10-27)**: ถ้า code ที่หมดอายุเกิน 7 วัน (หรือไม่มีวันหมดอายุ) ไม่พอสำหรับ
   line นั้น ให้ `claimCodesForOrder` (`modules/evoucher/service.ts`) รัน **query ส่วนเติม** หลัง query เดิม (`expires_at ASC NULLS LAST`) claim ส่วนที่ขาดจาก code
   `available` ที่ยังไม่หมดอายุ เรียง `expires_at DESC` (ไกลสุดก่อน — code ที่ job เว้นไว้ตามกฎข้อ 12b หรือ code ที่เพิ่งเข้าช่วง 7 วัน
   ระหว่าง job สองรอบ) ก่อนจะ mark backordered (กฎข้อ 18)
   (รอบ 11 — แก้ถ้อยคำให้ตรงโค้ดของ EV-12 #123 ตามที่ EV-N1 พบ) ขอบเขตของทั้งสอง query ใช้ `cutoff = now() + 7 days` ค่าเดียว: query หลัก = `expires_at IS NULL OR expires_at > cutoff`;
   query ส่วนเติม = `now() < expires_at <= cutoff` — code ที่ `expires_at = cutoff` พอดีอยู่ใน**ส่วนเติม** (ไม่ตกหล่นระหว่างสอง query และไม่ถูกเลือกซ้ำ);
   ต่างจากการนับ `long` ของ job (กฎข้อ 12b(a) ใช้ `>=`) เฉพาะ code ที่ตรง cutoff พอดี ซึ่งไม่ทำให้ผลผิด (job ไม่ void code นั้น และ allocation ยังเลือกได้) — ไม่มี task
3. 1 code ต่อ 1 หน่วย; qty 3 → 3 code ในอีเมลเดียว
4. Code/PIN ถูกเข้ารหัสขณะจัดเก็บ (ระดับแอป, key จาก env); masked ในรายการ; การ reveal มี audit
5. **ไม่มีการ redeem ฝั่งเรา**; อีเมลระบุว่าใช้ที่ไหนและอย่างไรที่พาร์ทเนอร์
6. นโยบายคืนเงิน: code ที่ส่งมอบแล้วจะไม่คืนเงินอัตโนมัติ (เราเรียกคืน code ไม่ได้)
   admin อาจคืนเงินด้วยตนเองได้ โดย code ยังคงสถานะ `delivered` code ที่ allocate แล้วแต่ยังไม่ส่งมอบ
   บน order ที่ถูกยกเลิกจะถูกปล่อยกลับเป็น `available`
7. วันหมดอายุเป็นของพาร์ทเนอร์; เราแสดงให้เห็นและหยุดขาย code ก่อนหมดอายุ 7 วัน — **ข้อยกเว้น** (owner Q6 2026-10-27, ผ่านกฎข้อ 2 ส่วนเติม): code ที่เหลืออายุ
   < 7 วันแต่ยังไม่หมดอายุอาจถูกส่งมอบเมื่อ code อายุยาวไม่พอ ได้แก่ (a) code ที่ job รายวันเว้นไว้ให้ order ที่**จอง stock ไปแล้ว** (กฎข้อ 12b) — order ใหม่ซื้อ code
   เหล่านี้ไม่ได้ เพราะหลัง job inventory ที่ขายได้ (`stocked − reserved`) ไม่รวม code ที่เว้นไว้ และ (b) code ที่เพิ่งเข้าช่วง 7 วันระหว่าง job สองรอบ (ยังนับใน stock
   จนถึง job รอบถัดไป จึงอาจถูก order ใหม่ซื้อได้ไม่เกิน ~1 วัน — ยอมรับได้ ดีกว่าให้ order นั้น backordered)
8. cart ที่มีแต่สินค้า digital จะได้ shipping option **Standard** มาด้วย (อยู่ service zone `country=th` เดียวกัน และ cart ที่ไม่มี
   address ไม่ถูกกรองด้วย geo zone) → ห้ามเลือก option ตัวแรกของรายการ: storefront (EV-7) เลือก option Digital delivery ด้วย
   `type.code === "digital-delivery"` (หรือ `shipping_profile.type === "digital"` ถ้า store API คืน field นี้) และโค้ด backend/seed
   ที่ต้องหา option นี้ใช้ `type.code` ไม่ใช้ชื่อ (`name` แก้ได้ใน admin)
9. (owner Q-A, 2026-10-25) อีเมลแจ้ง admin ของ e-voucher ทุกชนิด (low-stock, สรุป expiry รายวัน, backordered ของ EV-4) ส่งหา
   **mailbox เดียว** จาก env `EVOUCHER_ADMIN_EMAIL` ไม่ใช่ admin user ทุกคน; env ไม่ได้ตั้ง → log warning และไม่ส่ง (ไม่ throw)
   — EV-5 (PR #43) ที่ส่งหา admin user ทุกคนต้องปรับ, EV-4 ใช้ env เดียวกัน; เพิ่มบรรทัด `EVOUCHER_ADMIN_EMAIL=` ใน
   `apps/backend/.env.example`
10. route ของเราที่ตอบ 409 (เช่น void code ที่ไม่ใช่ `available`) ใช้กลไก 409 กลางของ PROMO-2 (spec 03 กฎข้อ 13): throw
    `MedusaError(CONFLICT, message, "<CODE>")` ไม่ `res.status(409)` เองใน route
11. ฟอร์ม admin (partner/pool): ปุ่ม submit ถูก disable ระหว่างส่ง (กัน double-submit สร้างซ้ำ) และทุก `Label` ผูก `htmlFor` กับ `id`
    ของ input
12. (EV-10) void ที่ลด inventory ต้องไม่ทำให้ order ที่จองไว้แล้วกลายเป็น backordered: admin void (`voidEvoucherCodeWorkflow`) ตรวจ inventory level
    ของ pool ก่อน — ถ้า `stocked_quantity − reserved_quantity < 1` (stock ที่เหลือถูก order จองหมดแล้ว) → 409 code `EVOUCHER_CODE_RESERVED`
    (กลไก PROMO-2) และไม่เปลี่ยนอะไร
12b. (**EV-12**, owner ตัดสิน Q6 2026-10-27 — เว้น code ไว้เท่าที่ถูกจอง) job รายวัน ต่อ pool:
    (a) `long` = จำนวน code `available` ที่ `expires_at IS NULL OR expires_at >= now + 7 days`; `near` = code `available` ที่ `expires_at < now + 7 days`
    (code ที่หมดอายุแล้ว `expires_at <= now()` อยู่ใน `near` แต่**ไม่ถูกเว้นเด็ดขาด**); `reserved` = `reserved_quantity` ของ inventory level ของ pool
    (b) จำนวนที่เว้น `keep = min(จำนวน near ที่ยังไม่หมดอายุ, max(0, reserved − long))` — เว้นเท่าที่ order ที่จองแล้วต้องใช้จริง code ที่หมดอายุเกิน 7 วันที่มีอยู่ก็นับว่าครอบ
    การจองแล้ว (allocation เลือกตามกฎข้อ 2)
    (c) code ที่เว้นเลือก `expires_at` **ไกลสุดก่อน** (เท่ากันเรียง `id`) — เหตุผล: ลูกค้าที่ได้ code มีเวลาใช้มากที่สุด และ code มีโอกาสหมดอายุก่อน payment captured
    (เช่น PromptPay/order ที่ capture ช้า) น้อยที่สุด; code ที่เหลือใน `near` → `void` (reason `expiring`) และลด inventory เท่าจำนวนที่ void
    (d) อีเมลสรุป expiry (กฎข้อ 9) แสดงต่อ pool: จำนวน void, จำนวนที่เว้น (`kept`) พร้อม `expires_at` ที่เร็วที่สุดของ code ที่เว้น และถ้าหลังรัน `stocked < reserved`
    (code ไม่พอแม้เว้นแล้ว) ระบุ pool ว่า "code ไม่พอสำหรับ order ที่จอง" พร้อมจำนวนที่ขาด (`reserved − stocked`) — order เหล่านั้นจะ backordered ตอน capture (กฎข้อ 18)
    pool ที่ `kept = 0` และ `stocked ≥ reserved` ไม่ต้องมีบรรทัดเตือน; ไม่มีอีเมลถ้าไม่มี pool ใดมีการ void/เว้น (พฤติกรรมเดิมของ EV-5)
    (e) code ที่เว้นไว้วันนี้ถูกพิจารณาใหม่ทุกวัน (ไม่มี field ใหม่ใน model) — เมื่อ order ถูก allocate/ยกเลิก `reserved` ลดลงและ code ที่เกินจะถูก void ในรอบถัดไป
13. (EV-10) `expires_at` ต้องเป็นวันที่มีจริง: ค่าที่ `Date` เลื่อนเดือน/ปีให้ (เช่น `2026-02-30`, `2026-04-31`, `2026-13-01`, รวมรูปแบบที่มีเวลา) ถือเป็น
    ค่าที่ parse ไม่ได้ (ทั้งไฟล์ล้มพร้อมเลขบรรทัด ตามพฤติกรรมเดิมของ EV-2) — ตรวจแบบ round-trip: ปี/เดือน/วันที่ parse ได้ต้องตรงกับข้อความ
14. (EV-10) voucher variant ต้องมี inventory item เดียว (`required_quantity = 1`) ที่ไม่มี variant อื่นใช้ร่วม — ไม่เช่นนั้นสร้าง pool ไม่ได้ (400) เพราะการตั้ง
    `requires_shipping=false` และการปรับ stock จะกระทบ variant อื่น
15. (EV-10) ลบ pool (เฉพาะ pool ว่างตาม EV-2) → ตั้ง `requires_shipping` ของ inventory item กลับเป็น `true` (ค่าเริ่มต้นของ Medusa) **เสมอ** ไม่จำค่าเดิม (owner ยืนยัน Q7 2026-10-27) พร้อม compensation;
    pool ที่สร้างก่อน EV-8 (inventory item ยัง `requires_shipping=true`) ถูก backfill เป็น `false` ด้วย migration script (`src/migration-scripts/`,
    รันใน `db:migrate`, รันซ้ำได้) **ก่อน** release ที่มี EV-7 (checkout digital-only พึ่งค่านี้)
16. (EV-4, owner 2026-10-26) code/PIN ใน `notification.data` ของอีเมล `evoucher.delivered` เก็บเป็น **ciphertext** (รูปแบบเดียวกับ at-rest ของกฎข้อ 4)
    และถอดรหัสตอนส่งเท่านั้น (template/provider ถอดก่อน render) — ไม่มี plaintext ของ code/PIN ใน DB (ตาราง notification) หรือ log
17. (EV-4, owner 2026-10-26) ส่งอีเมล `evoucher.delivered` ล้ม → **คง code ไว้กับ order** (สถานะ `allocated`, ไม่คืน pool, ไม่ void) และส่งอีเมลแจ้ง
    `EVOUCHER_ADMIN_EMAIL` (กฎข้อ 9) ให้ admin ส่งซ้ำผ่าน resend (EV-5b) — resend ที่สำเร็จเปลี่ยน code `allocated` ของ order นั้นเป็น `delivered`;
    รัน allocation ซ้ำ (AC-7) ไม่ allocate code ใหม่ให้ line ที่มี code `allocated` แล้ว
18. (EV-4, owner 2026-10-26 — ยืนยันว่าระดับ line item) **backordered ทั้งรายการ**: ถ้า code ที่ claim ได้ไม่ครบ quantity ของ line item → ปล่อย code ที่ claim แล้วของ line นั้นกลับเป็น
    `available` และ mark line ทั้ง line เป็น backordered (ไม่ส่งมอบบางส่วน) — line อื่นของ order ที่ครบยังส่งมอบตามปกติ
19. (EV-5b, follow-up review รอบ 6) resend ต้องสร้าง notification ด้วย `idempotency_key` **ใหม่ทุกครั้ง** (เช่น
    `evoucher-resend:<order_id>:<uuid>`) — ห้ามใช้ key เดิมของการส่งที่ `status=failure`: `NotificationModuleService` จะเข้า retry path ของแถวเดิม
    แล้ว throw `NOT_FOUND` ทำให้ resend ล้มตลอด
20. (EV-4, ตามโค้ด #67 — owner ยืนยัน Q8 2026-10-26) อีเมล `evoucher.delivered` ส่ง**เสมอ**แม้ order ตั้ง `no_notification=true` เพราะอีเมลนี้คือการส่งมอบสินค้า
    (ไม่ใช่อีเมลแจ้งสถานะ) — ต่างจากอีเมล shipped ของ CORE-11 ที่เคารพ `no_notification`
21. (EV-5c, รอบ 9 — nit review #111) resend กับ allocation ของ order เดียวกันถือ lock key เดียวกัน `evoucher-order:<order_id>` (Locking module) — allocation (EV-4) ถือ
    ตลอดช่วง claim → ส่งอีเมล → mark `delivered` เพื่อไม่ให้ลูกค้าได้อีเมลซ้ำ 2 ฉบับ; resend: ขอ lock ไม่ได้เพราะมีคนถืออยู่ → 409 (`EVOUCHER_RESEND_IN_PROGRESS`, กลไก PROMO-2)
    แต่ error อื่นจาก Redis/Locking ต้อง **throw ต่อ** (ไม่กลืนใน `catch {}` แล้วตอบ 409); ส่งอีเมลสำเร็จแต่ขั้น update สถานะ code ล้ม → log error พร้อม order id และตอบ **200**
    (อีเมลถึงลูกค้าแล้ว — ไม่ให้ admin กดซ้ำเพราะเห็น 500) code ที่ยัง `allocated` จะถูกเปลี่ยนในการ resend ครั้งถัดไป
22. (รอบ 10, EV-7a) `GET /store/customers/me/evouchers` คืนเฉพาะ code ที่ `customer_id = auth_context.actor_id` และสถานะ `delivered` หรือ `allocated` (code ที่ผูกกับ order
    ของลูกค้าแล้วแต่ส่งอีเมลล้ม — กฎข้อ 17; ลูกค้าเห็นในบัญชีได้ทันที) — ไม่คืน `available`/`void`; filter อยู่ใน query (ไม่อ่านทั้งหมดแล้วกรองในแอป); ถอดรหัส code/PIN
    ด้วย method ของ module `evoucher` (กฎข้อ 4) ตอนสร้าง response เท่านั้น ห้าม log ค่า plaintext; ไม่มี route รายตัว — "ลูกค้าคนอื่นเข้าไม่ได้" พิสูจน์ด้วยรายการของ B ที่ไม่มี
    code ของ A (AC-6, AC-34); (review #140) เพิ่ม index `(customer_id, status)` บน `evoucher_code` + migration ใน PR ของ EV-7a — index เดิม `(pool_id, code)`, `(pool_id, status)`,
    `(order_id)` ไม่ครอบ และตารางนี้โตตามจำนวน code ที่ import ทั้งหมด
23. (รอบ 10, EV-7a) ข้อมูลพาร์ทเนอร์บน PDP มาจาก `GET /store/products*` ของ Medusa ผ่าน `allowFields(...)` ใน `src/api/middlewares.ts` (global middleware ตาม docs ของ Medusa —
    route-level ใช้ไม่ได้) ระบุ path **ทีละ field** เท่านั้น: ของ pool `name`, `face_value`, `validity_note`, `how_to_use`; ของ partner `name`, `logo_url`, `terms_url` —
    ห้ามระบุ path ที่ขึ้นต้นด้วย relation ของ code หรือ field ใดของ `evoucher_code` (Medusa ตัด field ที่ไม่ได้อนุญาตทิ้งเอง); ถ้า Query ไปถึง partner จาก pool ไม่ได้
    (relation ใน module) ให้หยุดและรายงาน — ทางสำรองคือ store route ของ module เราเอง (`GET /store/evoucher/variants/:id`) ซึ่งไม่ต้องมี ADR แต่ต้องปรับ spec ก่อน
24. (รอบ 10, EV-7c — **owner ตัดสิน Q10 = (ก) 2026-10-27**) checkout ของ cart ที่**ทุก** line `requires_shipping=false`:
    (a) ข้ามขั้น delivery (ไม่ใส่ shipping method — AC-3; ถ้าจำเป็นต้องมีให้เลือก `type.code = "digital-delivery"` ตามกฎข้อ 8 ไม่ใช่ตัวแรก)
    (b) ขั้นที่อยู่เก็บ**ที่อยู่สำหรับใบเสร็จ/ใบกำกับภาษี** (ฟอร์ม billing เดิมของ starter; ไม่มีคำว่า "ที่อยู่จัดส่ง") แล้วตั้ง `shipping_address` = ที่อยู่เดียวกันเพื่อให้ Tax module
    ของ Medusa คำนวณ VAT 7% เป็น tax line เสมอ (ตามคำตัดสิน owner — AC-37 ตรวจ `order.shipping_address` = ที่อยู่ที่กรอก)
    (c) หลัง complete redirect ไป `/<countryCode จาก URL ปัจจุบัน>/order/<id>/confirmed` (ไม่อ่าน country จาก shipping address)
    (d) cart ผสม (voucher + สินค้าจัดส่ง) ใช้ flow ปกติ — Medusa บังคับ shipping method ตาม profile ของ line ที่ต้องจัดส่งเอง
25. (รอบ 10, EV-9 — ที่มา: qa ของ EV-9 ระหว่างรอบ 10 (#139); ส่งมอบใน #139 พร้อม AC-39 — ที่มาระบุรอบ 11 ตาม nit #140) รายการ code ที่เรียงตาม `created_at` (เช่น `GET /admin/evoucher/pools/:id/codes` และตารางใน admin) ใช้ `id` เป็น key เรียงรองเสมอ (`created_at`, `id`) —
    code จาก CSV เดียวกันมี `created_at` เท่ากัน ถ้าไม่มี key รอง การแบ่งหน้าอาจซ้ำ/หายระหว่างหน้า
26. (รอบ 12, EV-14 — **ความปลอดภัย**, qa #179) `logo_url`/`terms_url` ของ partner ใน admin API (สร้างและแก้) รับเฉพาะ URL ที่ scheme เป็น `http:` หรือ `https:` — อื่น
    (`javascript:`, `data:`, `vbscript:` ฯลฯ) → 400 `invalid_data` ไม่บันทึก; storefront render ลิงก์/รูปของ partner เฉพาะเมื่อ URL เป็น http(s) (กันข้อมูลเก่าที่บันทึกก่อนแก้ — EV-7e);
    (รอบ 13, review/qa #195 EV-14) ฟอร์ม partner ใน admin (`src/admin/components/evoucher/partners-section.tsx`) ตรวจกฎเดียวกันก่อนส่ง (error ใต้ช่อง ไม่มี request) —
    ส่งมอบใน ADM-5 (spec 08 AC-8) เพราะ ADM-5 เขียนฟอร์มนี้ใหม่เป็น `Form` + zod อยู่แล้ว; backend ยังเป็นด่านจริง
27. (รอบ 12, EV-N2 — review #171, #155) (a) lock `evoucher-order:<order_id>` ของ allocation (EV-4/EV-5c) ตั้ง TTL ≥ 300 วินาที และ acquire/release ด้วย `ownerId` เฉพาะของ run นั้น
    (เช่น transaction id ของ workflow) — release ต้องไม่ลบ lock ที่ owner อื่นถืออยู่หลัง TTL ของตัวเองหมด (ห้าม release แบบไม่ระบุ owner/wildcard); comment ที่ `isLockHeldError`
    ระบุเวอร์ชัน Medusa ที่ข้อความ error อ้างอิง; (b) (nit EV-7a) `GET /store/customers/me/evouchers` เรียง `delivered_at DESC NULLS FIRST` แล้ว `id` — code `allocated` ที่ส่งอีเมลล้ม
    (`delivered_at` null) อยู่บนสุด; validator ของ route ย้ายไปไฟล์ข้าง route ตาม convention; ตัด `defaults: ["id"]` ที่ไม่มีผล
28. (รอบ 12, EV-7d — builder/review/re-review #174 EV-7c) cart digital-only (กฎข้อ 24): (a) ยอดรวมของ cart/checkout (`cart-totals`) ไม่แสดงแถว "ค่าจัดส่ง" และคำว่า
    "ไม่รวมค่าจัดส่ง"; (b) การตัดสินว่าเป็น digital-only คำนวณจาก cart ฝั่ง server (`items[].requires_shipping`) ไม่รับ flag จาก client; (c) redirect หลัง complete ทุกวิธีชำระ
    (manual, บัตร, พร้อมเพย์) และหลัง `setAddresses` สำเร็จ ใช้ `countryCode` ของ URL หน้าปัจจุบัน (ข้อ 24c) ซึ่งส่งเข้า action ทาง param หรือ hidden input `checkout_country_code` — ต้องผ่าน `safeCountryCode` ก่อนประกอบ path เสมอ (ค่านี้มาจาก browser จึงไม่เชื่อค่าดิบ; ถ้าไม่ผ่าน → path ที่ไม่มี country ให้ middleware เลือก) และไม่อ่านจาก `shipping_address` (แก้ถ้อยคำรอบ 26 ตาม review #320 — ไม่ต้องใช้ `Referer` เพราะมาจาก browser เหมือนกัน)
29. (รอบ 12, EV-7e — review/qa #179, builder EV-7b) (a) หน้า `/account/vouchers` แบ่งหน้า (`limit` 20, `?page=`, ปุ่ม `vouchers-prev`/`vouchers-next`) ไม่ตัดที่ 100; (b) `voucher-card`
    แสดง `support_contact` ของ partner เมื่อมี; (c) PDP: บล็อก `evoucher-partner-block` ไม่แสดงซ้อนสองบล็อกระหว่างโหลด, อ่าน `v_id` หลัง mount, แสดงข้อมูลของ variant ที่ PDP เลือกอยู่จริง
    เท่านั้น (ไม่ได้เลือก variant ใด → ไม่แสดงบล็อก), `generateMetadata` กับหน้าใช้ชุด `fields` เดียวกัน (Next dedupe ได้ → 1 request ต่อ render); (d) ลิงก์/รูป partner ตามกฎข้อ 26
30. (รอบ 13, EV-N3 — review #201 EV-N2, review/qa #205 ADM-2a) (a) ข้อความ error ของ resend (`steps/resend-evoucher-email.ts`) ประกอบจากสาเหตุที่**ตัดเครื่องหมายวรรคตอนท้าย**
    (`.`, `。`, ช่องว่าง) ก่อนใส่ในวงเล็บ — ไม่มี `.).` หรือ `..` ในข้อความ (ต้นเหตุอยู่ backend; admin ที่ ADM-2a #205 กันไว้แล้วคงไว้เป็นชั้นที่สอง); แยกการประกอบข้อความเป็น pure function
    เพื่อ unit test; (b) test AC-41 ใน `integration-tests/http/evoucher-resend.spec.ts` ตรวจ `ownerId` ด้วยรูปแบบจริง `^evoucher-allocation:(?!undefined$).+` แทน `expect.any(String)`
31. (รอบ 26, EV-15 — **บล็อก release v0.1.0**; qa รอบ 25 พบ: voucher ฿500 + เสื้อเลือก Standard ฿10 แล้วลบเสื้อ → `requires_shipping=[false]`, `shipping_subtotal=9.35`, `total=510`, order 510 ขัดกฎข้อ 24a; ต้นเหตุ Medusa 2.22.1 ไม่ลบ method เมื่อเหลือ method เดียว — source อ้างในตารางข้างบน)
    (a) ใช้ hook `refreshCartItemsWorkflow.hooks.beforeRefreshingPaymentCollection` ไฟล์ `src/workflows/hooks/refresh-cart-orphan-shipping.ts` (`createHook` มี handler ตัวเดียว — ปัจจุบันยังไม่มีผู้ใช้ hook นี้) รันภายใน lock ของ cart หลัง refresh shipping/promotion;
    `refreshPaymentCollectionForCartWorkflow` ที่รันถัดไป query `total` ใหม่เมื่อ cart มี payment collection (`refresh-payment-collection.js:50–74`) ยอดจึงตามทัน ไม่ต้องอัปเดตเอง;
    (b) hook ได้แค่ `{ input }` และ `input.items` เป็น undefined ตอน DELETE line → handler ต้อง Query `cart` จาก `input.cart_id` (`items.requires_shipping`, `shipping_methods.id`, `shipping_methods.shipping_option_id`). เงื่อนไขลบ: `items.length > 0` และทุก line `requires_shipping=false` (ตรรกะเดียวกับ `isDigitalOnlyCart`) **และ** `input.shipping_methods` ว่าง (refresh นี้ไม่ได้มาจาก `addShippingMethodToCartWorkflow`) → ลบ method ทุกตัวที่ `shipping_option.type.code !== "digital-delivery"` (กฎข้อ 8);
        **ข้อจำกัด (แก้ตาม review #323)**: การข้ามด้วย `input.shipping_methods` มีผลเฉพาะ refresh ของการเพิ่ม method นั้นเอง — refresh ถัดไปของ cart voucher ล้วน (แก้จำนวน, `updateCartWorkflow`, เพิ่ม voucher, transfer) จะลบ Standard ที่ลูกค้าเพิ่มไว้ และแยกการลบ line ออกจากการแก้จำนวนด้วย input ไม่ได้ (`deleteLineItemsWorkflow` กับ `updateLineItemInCartWorkflow` ส่ง `{ cart_id, additional_data }` เหมือนกัน);
        ผลคือ cart voucher ล้วนเหลือ method ได้เฉพาะ Digital เมื่อผ่าน refresh → เป็นการบังคับฝั่ง backend แบบลบเงียบ (ไม่ปฏิเสธ) ที่ owner ยอมรับแล้ว (Q13 = (ก) 2026-11-09, ADR-021 accepted): Standard ที่ยิง API เพิ่มบน cart voucher ล้วนจะหายเงียบใน refresh ถัดไป;
    (c) ลบด้วย `softDeleteShippingMethods(ids)` ของ Cart module แบบเดียวกับ `removeShippingMethodFromCartStep`, compensation `restoreShippingMethods(ids)`; หา `type.code` ผ่าน Query (entity `shipping_option`); handler ไม่ throw กรณีไม่มีอะไรต้องลบ (idempotent) — cart ผสม/cart ที่ยังมี line ต้องจัดส่ง และ cart ว่าง ไม่แตะ;
    (d) ของค้าง: ไม่มี migration/backfill — v0.1.0 ยังไม่ release, ยังไม่มี tag และ Stripe อยู่ test mode และ owner ยืนยันว่าไม่มี order ลูกค้าจริง (Q12 = (ก) 2026-11-09); cart ที่ค้างถูกแก้ตอน refresh ครั้งถัดไป
32. (รอบ 27, EV-16 — qa EV-M-29 บน develop `84b9e610`; ทำให้กฎข้อ 6 เป็นจริง ไม่บล็อก release v0.1.0) `order.canceled` → workflow `releaseEvoucherCodesForOrderWorkflow` (subscriber ใหม่ `src/subscribers/evoucher-order-canceled.ts` ส่งแค่ `order_id` จาก `data.id`):
    (a) ทุก code ที่ `order_id` = order นั้นและ `status='allocated'` กลับเป็น `available` และล้าง `order_id`, `order_line_item_id`, `customer_id`, `allocated_at`; code `delivered` ไม่ถูกแตะ (แยกระดับ code/line บน order เดียวกันได้);
    (b) ถือ lock `evoucher-order:<order_id>` ตามกฎข้อ 21/27 (`evoucherOrderLockKey`, TTL/timeout เดียวกับ allocation, `ownerId` ต่อ run) กันชนกับ allocation และ resend; ล้มชั่วคราวแล้วให้ subscriber log error ไม่มี retry ใหม่ (แบบเดียวกับ EV-4);
    (c) idempotent: event ซ้ำหรือ code ที่ถูกปล่อยแล้วไม่เปลี่ยนอะไร และไม่แตะ code ที่ถูก order อื่น claim ไปแล้ว (`order_id` ถูกล้างแล้ว);
    (d) compensation ของ step คืนค่าเดิมของแถวที่ปล่อย (status + ฟิลด์ใน a);
    (e) **ไม่ปรับ inventory** — Medusa คืน stock ตอนยกเลิก fulfillment และลบ reservation ตอนยกเลิก order แล้ว; ผลคือ pool ของ code ที่ปล่อยมี `stocked − reserved` = จำนวน `available`
    **เฉพาะ pool ที่ order นี้ไม่มี code `delivered`** — pool ที่มี code `delivered` บน order ที่ถูกยกเลิกได้ stock เกิน (ข้อจำกัดที่มีอยู่ก่อน EV-16 ไม่ได้เกิดจาก EV-16 → กฎข้อ 33, EV-17)
33. (รอบ 27, EV-17 — follow-up จาก review PR #332; **ไม่บล็อก release v0.1.0**; owner ตอบ Q14 = ทาง ก 2026-11-10) stock ของ pool เกินจำนวน code ที่ขายได้เมื่อยกเลิก fulfillment ของ code ที่ส่งมอบแล้ว:
    (a) ต้นเหตุ (ยืนยันจากโค้ด): allocation สร้าง fulfillment ของทุก line ที่ claim ได้ (`allocate-and-deliver-evouchers.ts:87–97`) แต่ไม่เคยตั้ง `shipped_at` (ไม่มีการสร้าง shipment ใน `src/workflows/evoucher/`) จึงยกเลิก fulfillment ได้เสมอ (`cancel-order-fulfillment.js:50–51` ปฏิเสธเฉพาะที่ shipped);
    `cancelOrderWorkflow` บังคับให้ยกเลิก fulfillment ก่อน (`cancel-order.js:44, :48`) และการยกเลิก fulfillment คืน stock `+quantity` พร้อมสร้าง reservation ใหม่ (`cancel-order-fulfillment.js:95–135`) โดยไม่รู้ว่า code ยัง `delivered` (provider `digital` ตอบ `{}` — `modules/digital_fulfillment/service.ts:49–51`);
    (b) ผล: ทุกครั้งที่ยกเลิก fulfillment ที่มี code `delivered` (ทั้งยกเลิก order และยกเลิก fulfillment อย่างเดียว) pool นั้นมี stock เกินจำนวน code `available` เท่าจำนวน code ที่ส่งมอบแล้ว → ร้านขายเกินได้ และลูกค้าคนถัดไปที่จ่ายเงินแล้วอาจได้ line เป็น backordered (กฎข้อ 18; อาการแบบ EV-M-23) ต้องรอ admin เติม code;
    (c) ทางแก้ (Q14 = ก): เมื่ออีเมล code ส่ง**สำเร็จ** ให้สร้าง shipment ของ fulfillment ที่ยังไม่ shipped/ไม่ถูกยกเลิกและมี line ของ code ชุดนั้น ด้วย `createOrderShipmentWorkflow` (`order_id`, `fulfillment_id`, `items`, `no_notification: true` — `shipment-created.ts:9` จึงไม่ส่งอีเมลจัดส่ง) → Medusa ไม่ยอมยกเลิก fulfillment นั้น (`cancel-order-fulfillment.js:50–51`) และยกเลิก order ไม่ได้ (`cancel-order.js:44`) — admin คืนเงินบางส่วนแทนตามกฎข้อ 6; ไม่ปรับ inventory เอง;
    (d) จุดที่สร้าง: step ใหม่ที่**ไม่ throw** (แบบ `sendEvoucherDeliveredNotificationStep`) วางต่อจาก step ส่งอีเมลและก่อน release lock — allocation: ใน `when` เดิม ต่อจาก `sendEvoucherDeliveredNotificationStep` เมื่อผล `sent: true` (`allocate-and-deliver-evouchers.ts:106–111`, ก่อน `releaseLockStep` `:114`); resend: ต่อจาก `sendEvoucherResendNotificationStep` (`resend-evoucher-email.ts:51`, ก่อน `releaseEvoucherResendLockStep` `:53`) ซึ่ง throw เมื่ออีเมลล้มจึงไปไม่ถึง step นี้;
    ห้ามใช้ `createOrderShipmentWorkflow.runAsStep` ตรงๆ ใน allocation — ถ้าล้มจะ compensate ย้อนไปยกเลิก fulfillment และปล่อย code ที่ลูกค้าได้รับอีเมลแล้วกลับเข้า pool; ให้ step เรียก `createOrderShipmentWorkflow(container).run(...)` ใน try/catch แล้ว log error ถ้าล้ม (fulfillment ยังยกเลิกได้ — resend ครั้งถัดไปสร้าง shipment ให้); fulfillment ที่ shipped แล้วข้าม (idempotent);
    (e) อีเมลล้ม → ไม่สร้าง shipment (code คง `allocated` ตามกฎข้อ 17 และยกเลิก order ได้ตามกฎข้อ 32)
34. (ปิดรอบ 27, EV-18 — review #333; ไม่บล็อก release v0.1.0) allocation ข้าม order ที่ถูกยกเลิกแล้ว:
    (a) ยืนยันจากโค้ดบน develop: `allocate-and-deliver-evouchers.ts:55–73` query order โดยไม่มี `status`/`canceled_at` และไม่ตรวจการยกเลิกก่อน claim; subscriber `evoucher-payment-captured.ts` ก็ไม่ตรวจ —
        เกิดได้เมื่อ `payment.captured` ถูกประมวลผลหลัง admin ยกเลิก order (subscriber รันใน worker แบบ async; ยกเลิก order ที่ capture แล้วได้เพราะยังไม่มี fulfillment) ไม่ใช่ flow ปกติ;
    (b) ผลจริงเบากว่าที่ review ระบุ: เมื่อ claim ได้ `createOrderFulfillmentWorkflow` ของ core throw (`throwIfOrderIsCancelled` — `create-fulfillment.js:43`) แล้ว compensation ของ `claimEvoucherCodesStep` คืน code เป็น `available` จึงไม่มี code ค้างกับ order ที่ยกเลิก
        แต่ยังมี: workflow ล้มพร้อม error log ทุกครั้ง, `evoucher_backordered` ถูกตั้งบน line ของ order ที่ยกเลิกเมื่อทุก line ขาด code (ไม่ถึงขั้น fulfillment จึงไม่ throw) และอีเมล backordered ถึง admin (กฎข้อ 9) ถูกส่งก่อนถึงจุดที่ throw (อีเมล compensate ไม่ได้);
    (c) แก้: ภายใต้ lock เดิม query `status` ของ order แล้วถ้า `canceled` → ไม่ claim, ไม่ตั้ง/ล้าง flag, ไม่ส่งอีเมลใดๆ, ไม่สร้าง fulfillment, `logger.info` พร้อม `order_id` และ workflow จบสำเร็จ (ไม่ throw) — ถ้าใช้ `when` ต้องตั้งชื่อคงที่ตาม CLAUDE.md;
    (d) resend (EV-5b) ไม่ต้องแก้: order ที่ยกเลิกไม่มี code `allocated` เหลือหลัง EV-16

## Acceptance criteria
- AC-1 Admin import CSV จำนวน 100 code (ซ้ำ 2 รายการ) → 98 `available`, inventory ของ variant +98,
  response รายงานว่าข้าม 2 รายการ
- AC-2 เมื่อมี voucher variant qty 2 ใน cart และชำระเงิน captured แล้ว 2 code จะกลายเป็น
  `delivered` พร้อม order id และลูกค้าได้รับอีเมล 1 ฉบับที่มีทั้ง 2 code, PIN,
  วิธีใช้ของพาร์ทเนอร์ และวันหมดอายุ
- AC-3 เมื่อ cart มีเฉพาะสินค้า voucher (product ไม่มี shipping profile, กฎข้อ 1) ทุก line มี `requires_shipping=false`, การ checkout ไม่ต้องกรอกที่อยู่
  และ complete cart ได้โดย `validate-shipping` ของ Medusa ไม่บังคับ shipping method (integration: complete cart ที่ไม่มี shipping method → order สำเร็จ);
  ยอดรวมมีค่าจัดส่ง ฿0; ถ้า storefront ใส่ method ต้องเป็น `type.code = "digital-delivery"` ไม่ใช่ Standard แม้ `GET /store/shipping-options?cart_id=`
  คืน Standard มาก่อน (กฎข้อ 8, e2e) — (แก้รอบ 26 ตาม ADR-021) backend ไม่ปฏิเสธการเพิ่ม method อื่นบน cart voucher ล้วน แต่ hook ของ EV-15 ลบ method ที่ไม่ใช่ `digital-delivery` เงียบๆ ใน refresh ถัดไป (กฎข้อ 31b, AC-45)
- AC-25 (EV-4, กฎข้อ 16) Given order ที่ได้รับ code แล้ว When อ่านแถว `notification` ของ `evoucher.delivered` จาก DB Then `data` ไม่มีค่า plaintext ของ code/PIN
  (เทียบกับค่าที่ถอดรหัสแล้ว) และ mock provider ได้รับ code/PIN ที่ถอดแล้วถูกต้อง (integration)
- AC-26 (EV-4, กฎข้อ 17) Given notification provider throw ตอนส่ง `evoucher.delivered` When allocation workflow ทำงาน Then code ของ order เป็น `allocated` (ไม่ใช่
  `available`/`delivered`), inventory ไม่เปลี่ยนจากหลัง allocate, มี notification แจ้ง `EVOUCHER_ADMIN_EMAIL` 1 รายการที่มี order id; รัน workflow ซ้ำ → ไม่มี code ใหม่
  ถูก allocate (integration, mock provider)
- AC-27 (EV-4, กฎข้อ 18) Given pool มี code `available` 1 รายการ When order มี voucher line qty 2 ถูก capture Then line นั้นเป็น backordered, code ที่ claim ได้กลับเป็น
  `available` (นับ `available` = 1 เท่าเดิม), ลูกค้าไม่ได้อีเมล `evoucher.delivered` ของ line นั้น และ admin ได้อีเมล backordered (integration)
- AC-28 (EV-5b, กฎข้อ 17) Given order ที่ code เป็น `allocated` เพราะส่งอีเมลล้ม When admin `POST /admin/evoucher/orders/:id/resend` แล้วส่งสำเร็จ Then 200 และ
  code เป็น `delivered` พร้อม `delivered_at` (integration http)
- AC-29 (EV-5b, กฎข้อ 19) Given order ที่ notification `evoucher.delivered` ครั้งก่อนมี `status=failure` (mock provider throw ครั้งแรก) When admin resend
  สองครั้งติดกัน (provider ใช้ได้แล้ว) Then ทั้งสองครั้งได้ 200, มี notification ใหม่ 2 แถวที่ `idempotency_key` ต่างกันและต่างจากแถวที่ล้ม, ไม่มี error `NOT_FOUND`
  (integration http, mock provider)
- AC-4 เมื่อมี code `available` 1 รายการ และ order qty 1 สองรายการถูก capture พร้อมกัน → มีเพียง
  order เดียวที่ได้ code; อีก order ถูก flag เป็น backordered และ admin ได้รับอีเมล
- AC-5 code ที่จะหมดอายุภายใน < 7 วันจะไม่ถูก allocate เมื่อมี code ที่หมดอายุเกิน 7 วันพอ (ข้อยกเว้นตามกฎข้อ 2 → AC-30b); job รายวัน void code เหล่านั้นและ
  ลด inventory เมื่อไม่มี order จองไว้ (`reserved=0`; กรณีมีการจอง → AC-30)
- AC-6 หน้าบัตรกำนัลของฉัน (`vouchers-link`) ของลูกค้าแสดงเฉพาะ code ของตนเอง (`voucher-card`) พร้อมปุ่มคัดลอก (`voucher-copy-button`);
  ~~ลูกค้าคนอื่นได้ 404~~ (แก้รอบ 10 — ไม่มี resource รายตัวให้ได้ 404): Given A มี code 2 รายการและ B มี 1 When B ล็อกอินเปิด `/th/account/vouchers` Then มี `voucher-card`
  1 ใบ และ textContent ของหน้าไม่มีค่า code ของ A; When ไม่ล็อกอินเปิดหน้าเดียวกัน Then ไปหน้า login (ไม่เห็น `voucher-card`); ฝั่ง API ดู AC-34; heading ของหน้ามีอักษรไทย
  (ADR-014) (e2e EV-7b)
- AC-7 การรัน allocation workflow ซ้ำสำหรับ order เดิมจะไม่ allocate code เพิ่มและ
  ไม่ส่งอีเมลเพิ่ม
- AC-8 API รายการ code คืน code แบบ masked; endpoint reveal คืนค่าจริงและเขียน
  แถว audit (ใคร, เมื่อไร, code id)
- AC-9 จำนวน available ต่ำกว่า threshold → อีเมล low-stock 1 ฉบับต่อวันต่อ pool
- AC-10 `POST /admin/evoucher/codes/:id/void` ด้วย `{ reason: "partner recalled" }` บน code `available` → `status=void`,
  `void_reason="partner recalled"`, inventory ของ variant −1; ไม่ส่ง `reason` หรือส่งค่าว่าง → 400 และ code ไม่เปลี่ยน;
  code ที่ไม่ใช่ `available` → 409 body `{ type: "conflict", code: "EVOUCHER_CODE_NOT_AVAILABLE", message }` (กฎข้อ 10 — code นี้
  PROMO-2 ตั้งตอนย้ายมาใช้กลไกกลาง; ตรงกับ spec 03 AC-12 d);
  job รายวันตั้ง `void_reason="expiring"`
- AC-11 สร้าง pool ให้ variant ที่ `manage_inventory=true` → inventory item ของ variant มี `requires_shipping=false` และ line item ของ
  variant นั้นใน cart มี `requires_shipping=false`; variant ที่ `manage_inventory=false` → 400 และไม่มี pool ถูกสร้าง;
  ถ้าขั้นสร้าง pool ล้มหลังปรับ inventory item → `requires_shipping` กลับเป็นค่าเดิม (compensation); (รอบ 6, กฎข้อ 1) variant ที่ product **ไม่มี** shipping
  profile → สร้าง pool ตอบ **200** (route เดิมของ EV-2) และ line item ใน cart `requires_shipping=false`; variant ที่ product มี shipping profile ใดๆ (Default หรือ Digital)
  → 400, ไม่มี pool และ inventory item ไม่เปลี่ยน (owner ตัดสิน Q9 2026-10-26)
- AC-12 import CSV ที่ `expires_at` เป็นวันที่ล้วน `2026-12-31` → เก็บเป็นสิ้นวันเวลาไทย `2026-12-31T16:59:59.999Z`
  (= 23:59:59.999+07:00; owner ยืนยัน Q4 แล้ว); ค่า ISO ที่มี offset เก็บตามจริง; ค่าที่ parse ไม่ได้ → พฤติกรรมเดิมของ EV-2
- AC-13 import ที่ขั้นปรับ inventory ล้ม **และ** compensation ลบ batch ก็ล้มด้วย → response/error ที่ผู้เรียกได้รับเป็น error เดิมของขั้นที่ล้ม
  (ไม่ใช่ error ของการลบ) และ error ของ compensation ถูก log พร้อม `batch_ref`
- AC-14 (EV-8) รัน seed บน DB ที่ option Digital delivery ถูกเปลี่ยนชื่อใน admin (เช่น "E-mail delivery") และยังผูก `manual_manual`
  → option นั้น (หาด้วย `type.code = "digital-delivery"`) ถูกย้ายไป provider `digital` และไม่มี option ใหม่ถูกสร้าง
- AC-15 (EV-9) pool ที่ `low_stock_threshold=20` มี code `available` 5 รายการ → `GET /admin/evoucher/pools?fields=id,name` และ
  `GET /admin/evoucher/pools/:id?fields=id` คืน `low_stock=true` (route select `low_stock_threshold` เองเสมอแม้ client ไม่ขอ);
  มี `available` 25 → `low_stock=false`
- AC-16 (EV-9) code ที่ allocate ให้ order O แล้ว → `query.graph({ entity: "order", fields: ["evoucher_codes.id"], filters: { id: O } })`
  คืน code นั้น (link `evoucher_code ↔ order` ตาม Data model) และ code ของ order อื่นไม่ปรากฏ
- AC-17 (กฎข้อ 9; EV-5 สำหรับ low-stock/expiry, EV-4 สำหรับ backordered) Given มี admin user 3 คน และ `EVOUCHER_ADMIN_EMAIL=ops@x.test`
  When เกิดอีเมล low-stock / สรุป expiry / backordered Then notification แต่ละชนิดถูกสร้าง 1 รายการ `to = "ops@x.test"` และไม่มีรายการถึง
  admin user; Given ไม่ตั้ง env Then ไม่มี notification และมี log warning (integration, mock provider)
- AC-18 (EV-5b) Given order ที่มี code `delivered` 2 รายการ When admin `POST /admin/evoucher/orders/:id/resend` Then 200, notification
  `evoucher.delivered` 1 รายการถึงอีเมลของ order ที่มี code ทั้ง 2 เดิม, สถานะ/จำนวน code ไม่เปลี่ยน; order ที่ไม่มี code `delivered` → 400;
  ไม่มี token admin → 401
- AC-19 (EV-5b) Given order ใน AC-18 When admin กดปุ่ม resend (`data-testid="evoucher-resend"`) บน order widget ของ EV-6 Then เห็นข้อความ
  สำเร็จและมี notification ใหม่ 1 รายการ (e2e admin, screenshot)
- AC-20 (EV-9, กฎข้อ 11) Given ฟอร์ม Create partner When คลิก submit สองครั้งติดกัน Then มี `POST /admin/evoucher/partners` 1 ครั้งและ
  partner ใหม่ 1 แถว; ปุ่มถูก disable จน response กลับ; ทุก input ในฟอร์ม partner/pool หาได้ด้วย `getByLabel(<ข้อความ label>)` (e2e admin)
- AC-21 (EV-10, กฎข้อ 12) Given pool มี code `available` 2 รายการ, inventory `stocked=2` และ order ที่ยังไม่ allocate จองไว้ 2 (`reserved=2`) When admin void code
  หนึ่ง Then 409 `{ type: "conflict", code: "EVOUCHER_CODE_RESERVED", message }`, code ยัง `available`, `stocked` ยัง 2; Given `reserved=1` Then void สำเร็จ
  และ `stocked=1` (integration http)
- AC-30 (EV-12, กฎข้อ 12b — owner Q6 2026-10-27) Given pool P มี code `available` 3 รายการที่หมดอายุใน 2, 4, 5 วัน (`near`), ไม่มี code อายุยาว, `stocked=3`, `reserved=2`;
  pool Q มี code ใกล้หมดอายุ 2 รายการ `reserved=0`; pool R มี code อายุยาว 1 + ใกล้หมดอายุ 2 (`stocked=3`, `reserved=1`); pool S มี code ใกล้หมดอายุ 1 รายการ, `stocked=1`, `reserved=3`
  When job รายวันรัน Then
  (a) P: code ที่หมดอายุใน 4 และ 5 วันยัง `available` (ไกลสุดก่อน), code 2 วันเป็น `void` reason `expiring`, `stocked=2`;
  (b) Q: ทั้ง 2 code `void`, `stocked=0`; (c) R: code ใกล้หมดอายุทั้ง 2 `void` (`long=1` ครอบ `reserved=1`), `stocked=1`;
  (d) S: code ยัง `available` 1 (`keep=min(1, 3)`), `stocked=1`;
  (e) อีเมลสรุป expiry 1 ฉบับถึง `EVOUCHER_ADMIN_EMAIL`: P แสดง void 1 / เว้น 2 พร้อมวันหมดอายุเร็วสุดของ code ที่เว้น, S แสดง "code ไม่พอสำหรับ order ที่จอง" ขาด 2,
  Q/R แสดงเฉพาะจำนวน void และไม่มีบรรทัดเตือน (assert จาก `notification.data` ไม่ใช่ข้อความ HTML)
  (f) pool T มี code 1 รายการที่หมดอายุแล้ว (`expires_at` = เมื่อวาน) และ `reserved=1` → code `void` (ไม่เว้น code ที่หมดอายุแล้ว)
  (integration, mock provider; ตั้ง `reserved` ผ่าน Inventory module ใน test)
- AC-30b (EV-12, กฎข้อ 2 ข้อยกเว้น) Given pool P หลัง AC-30 (code ที่เว้นไว้ 2 รายการ อายุ 4 และ 5 วัน) และ order ที่จองไว้ qty 1 When payment captured
  Then order ได้ code ที่หมดอายุใน 5 วัน (ไกลสุดก่อน) สถานะ `delivered` ไม่ backordered; Given pool ที่มี code อายุยาว 1 + ใกล้หมดอายุ 1 และ order qty 1 Then ได้ code อายุยาว
  (integration)
- AC-31 (EV-11, กฎข้อ 1) Given voucher ที่ product **ไม่มี** shipping profile When allocation workflow ของ EV-4 ทำงาน Then ไม่มี log warning เรื่อง shipping profile
  และส่งมอบ code ตามปกติ; Given product ที่มี shipping profile ใดๆ (Default หรือ Digital — ตั้งใน test ผ่าน module) Then มี log warning 1 ครั้งที่ระบุ product/variant
  และยังส่งมอบ code (ไม่ทำให้ order ล้ม) (integration, spy logger)
- AC-32 (EV-13, qa #111) Given order ที่มี code 3 รายการ When เปิดหน้า order ใน admin ที่ viewport 1280×800 Then container ของ widget E-vouchers
  (`data-testid="evoucher-order-widget"`) มี `scrollWidth <= clientWidth` (ตารางไม่ล้นขอบ; ถ้าคอลัมน์ไม่พอให้ตารางเลื่อนแนวนอนภายใน container ที่มี `overflow-x: auto`
  และ container ของหน้าไม่ล้น); Given resend ล้ม (mock provider throw) When กด `evoucher-resend` Then toast error ไม่มีข้อความที่ match `/noti_[A-Za-z0-9]+/`
  และมีข้อความสั้นให้ลองใหม่/ดู log (e2e admin, screenshot 1 รูป)
- AC-33 (EV-5c, กฎข้อ 21) Given allocation ของ order O ถือ lock `evoucher-order:O` อยู่ (step ที่ inject รอ signal ของ test) When admin resend O Then 409 code
  `EVOUCHER_RESEND_IN_PROGRESS` และหลัง allocation จบมี notification `evoucher.delivered` ของ O 1 ฉบับ; Given locking provider throw error อื่น (mock) Then resend ได้ 5xx ไม่ใช่ 409;
  Given provider ส่งสำเร็จแต่ step update สถานะ code ถูก inject ให้ล้ม Then 200, มี notification ใหม่ 1 รายการ และ log error ที่มี order id; unit/spy ยืนยันว่า allocation และ resend
  ขอ lock key เดียวกัน (integration http)
- AC-34 (EV-7a, กฎข้อ 22) Given A มี code `delivered` 2, `allocated` 1 (order ของ A) และ B มี code `delivered` 1; pool มี code `available`/`void` ที่ไม่มีเจ้าของ When A
  `GET /store/customers/me/evouchers` Then 200 `count=3` มีเฉพาะ code ของ A, `code`/`pin` เท่ากับค่าที่ถอดรหัสแล้ว, มี `partner.name` และ `pool.how_to_use`, header `Cache-Control`
  มี `no-store`; When B เรียก Then `count=1` และไม่มี id/code ของ A; `limit=101`/`limit=0`/`offset=-1` → 400; ไม่มี token หรือ token ของ affiliate → 401;
  `GET /store/customers/me/evouchers/<id ของ code ของ A>` → 404 (ไม่มี route); spy logger: ไม่มีบรรทัด log ที่มีค่า code/PIN plaintext (integration http); Given migration ของ EV-7a
  รันแล้ว Then `pg_indexes` ของ `evoucher_code` มี index ที่คอลัมน์ `(customer_id, status)` (integration modules)
- AC-35 (EV-7a, กฎข้อ 23) Given voucher variant V (pool + partner) When `GET /store/products/:id?fields=` พร้อม path ของ pool/partner ตามกฎข้อ 23 Then variant V มี `name`, `how_to_use`
  ของ pool และ `name`, `logo_url` ของ partner; variant ที่ไม่มี pool ไม่ error; When ขอ `fields=*variants.evoucher_pool` หรือ path ของ code (เช่น `+variants.evoucher_pool.codes.code`)
  Then JSON ของ response ไม่มี key `codes`, `code`, `pin`, `batch_ref` ที่ใดเลย (ค้นทั้ง object) และไม่ใช่ 5xx; ไม่มี token → ยัง 200 (การเรียกดูสาธารณะ) (integration http)
- AC-36 (EV-7b) Given PDP ของ voucher variant When e2e เปิด `/th/products/<handle>` Then เห็น `evoucher-partner-block` ที่มีชื่อพาร์ทเนอร์และอักษรไทย; PDP ของสินค้าปกติไม่มีบล็อกนี้;
  Given A มี code ที่ส่งมอบแล้ว When เปิด `vouchers-link` ใน account Then `voucher-card` แสดง code, ชื่อพาร์ทเนอร์, วันหมดอายุ และกด `voucher-copy-button` แล้วค่าใน clipboard
  เท่ากับ code (Playwright `clipboard-read`) (e2e, screenshot ≤ 3)
- AC-37 (EV-7c, กฎข้อ 24 — owner Q10 = (ก)) Given cart ของ A ที่มีแต่ voucher (product ไม่มี shipping profile) When checkout ด้วย manual payment (CI) Then ไม่มีขั้น delivery
  (ไม่มี element ของขั้น delivery), ขั้นที่อยู่แสดงฟอร์มที่อยู่สำหรับใบเสร็จ/ใบกำกับภาษีและไม่มีคำว่า "จัดส่ง", order สำเร็จที่ `shipping_methods` ว่าง, `order.shipping_address` เท่ากับที่อยู่
  ที่กรอก (เทียบ `address_1`, `postal_code`, `country_code`), URL ปลายทางขึ้นต้น `/th/order/` และ `order.tax_total > 0` โดย `|tax_total − total × 7/107| ≤ 0.01` (คำนวณใน test ด้วย `MathBN` เพื่อตรวจเท่านั้น — โค้ดไม่คำนวณภาษีเอง); Given cart ผสม Then flow ปกติมีขั้น delivery (e2e + integration
  ส่วน `tax_total`) — AC-3 ส่วน storefront ปิดใน task นี้
- AC-38 (EV-N1) Given code ที่ `expires_at = now + 7 วัน` พอดี (ควบคุมเวลาใน test) When job รายวันรัน Then นับเป็น `long` ไม่ถูก void (กฎข้อ 12b(a) `>=`); Given code
  `expires_at = now + 7 วัน − 1ms` Then นับเป็น `near`; job ใช้ query เดียวนับ `near`/`long` ต่อ pool (spy นับจำนวน query ต่อ pool = 1) (integration + unit)
- AC-39 (EV-9, กฎข้อ 25) Given pool ที่ import CSV 30 code ในครั้งเดียว (`created_at` เท่ากันทุกแถว — ตั้งตรงใน test ถ้าจำเป็น) When admin `GET /admin/evoucher/pools/:id/codes?limit=10`
  ทีละหน้า offset 0, 10, 20 Then รวมได้ 30 id ไม่ซ้ำ และเรียกซ้ำได้ลำดับเดิม (integration http)
- AC-22 (EV-10, กฎข้อ 13) Given CSV ที่ `expires_at` = `2026-02-30`, `2026-04-31`, `2026-13-01`, `2026-02-30T10:00:00+07:00` (ทีละไฟล์) When import Then ล้ม
  ทั้งไฟล์พร้อมเลขบรรทัด และไม่มี code ถูก insert; `2028-02-29` → สำเร็จ (unit parser + integration 1 กรณี)
- AC-23 (EV-10, กฎข้อ 14) Given variant V1 ที่ inventory item ถูก variant V2 ใช้ร่วม หรือ V1 มี inventory item 2 ตัว When สร้าง pool ให้ V1 Then 400, ไม่มี pool
  และ `requires_shipping` ของ inventory item ไม่เปลี่ยน (integration http)
- AC-24 (EV-10, กฎข้อ 15) Given pool ว่างที่สร้างผ่าน workflow (inventory item `requires_shipping=false`) When ลบ pool Then inventory item `requires_shipping=true`;
  Given DB ที่มี pool ซึ่ง inventory item `requires_shipping=true` (ตั้งตรงใน test) When รัน migration script 2 ครั้ง Then เป็น `false` และ inventory item ที่ไม่ผูก
  pool ไม่เปลี่ยน (integration)
- AC-40 (EV-14, กฎข้อ 26) Given admin When `POST /admin/evoucher/partners` (และ update) ด้วย `terms_url` = `javascript:alert(1)` หรือ `logo_url` = `data:text/html,x` Then 400 `invalid_data`
  และไม่มี partner ใหม่/ค่าเดิมไม่เปลี่ยน; `https://example.com/terms` → 200 (integration http)
- AC-41 (EV-N2, กฎข้อ 27) Given lock `evoucher-order:O` ถูกถือโดย owner X (ตั้งผ่าน Locking module ใน test หลัง lock ของ allocation หมดอายุ) When release step ของ allocation O ทำงาน
  Then lock ของ X ยังอยู่; spy: allocation acquire ด้วย `ttl` ≥ 300 และ `ownerId` ไม่ว่าง; Given A มี code `allocated` (ส่งล้ม) 1 และ `delivered` 2 When A `GET /store/customers/me/evouchers`
  Then `evouchers[0]` คือ code `allocated`; AC-33, AC-34 ยังผ่าน (integration http)
- AC-42 (EV-7d, กฎข้อ 28) e2e: cart digital-only ที่ `/th/cart` และขั้น review ไม่มีข้อความ "ค่าจัดส่ง"/"ไม่รวมค่าจัดส่ง" ใน `cart-totals`; cart ผสมยังมีแถวค่าจัดส่ง; unit (Vitest): ฟังก์ชันตัดสิน
  digital-only รับ cart แล้วคืนผลจาก `requires_shipping` (ไม่มี parameter flag จาก client); static: redirect หลัง complete ของบัตร/พร้อมเพย์/manual และของ `setAddresses` ผ่าน `safeCountryCode`
  (grep ใน `lib/data/cart.ts` และ component ชำระเงิน); e2e AC-37 ยังผ่าน
- AC-43 (EV-7e, กฎข้อ 29) e2e: A มี code 25 รายการ → `/th/account/vouchers` หน้าแรก 20 การ์ด, `vouchers-next` → 5 การ์ด; partner ที่มี `support_contact` → การ์ดแสดงค่านั้น; partner ที่ `terms_url`
  เป็น `javascript:` (ตั้งตรงใน DB ของ test) → ไม่มี `<a>` ที่ `href` ขึ้นต้น `javascript:` บนหน้า; PDP ของ voucher: ระหว่างโหลดมี `evoucher-partner-block` ไม่เกิน 1 ตัว; unit: request ของ
  `generateMetadata` กับหน้าใช้ `fields` เท่ากัน (e2e + unit Vitest)
- AC-44 (EV-N3, กฎข้อ 30) unit ของฟังก์ชันประกอบข้อความ: สาเหตุ `"Template evoucher-delivered could not be resolved."` → ข้อความมี `(Template evoucher-delivered could not be resolved).` และไม่มี `.).`/`..`; สาเหตุว่าง → ไม่มี `()`;
  สาเหตุมี `noti_…` → ไม่มี `noti_` (AC-32 เดิม); integration: test AC-41 ใน `evoucher-resend.spec.ts` ใช้ `toMatch(/^evoucher-allocation:(?!undefined$).+/)` กับ `ownerId` (grep: ไม่มี
  `ownerId: expect.any(String)`) และ AC-32, AC-33, AC-41 ยังผ่าน (unit jest + integration http)
- AC-45 (EV-15, กฎข้อ 31) integration http ใหม่ `integration-tests/http/evoucher-orphan-shipping.spec.ts` (token ลูกค้าเจ้าของ cart; product voucher ไม่มี shipping profile ตามกฎข้อ 1): Given cart มี voucher ฿500 + สินค้าจัดส่ง + method Standard ฿10 When `DELETE /store/carts/:id/line-items/:line` ของสินค้าจัดส่ง Then response `shipping_methods` = `[]`, `shipping_total` = 0, `total` = 500 (ล้มบน develop);
  complete cart ต่อ → order `shipping_methods` = `[]`, `total` = 500; Given cart เดียวกันที่มี payment collection ก่อนลบ Then `payment_collection.amount` = 500 และ session เดิมถูกล้าง (`GET` cart ซ้ำ); Given cart voucher ล้วนที่มี method `type.code = "digital-delivery"` When แก้จำนวน line Then ยังมี method นั้น 1 ตัว;
  Given cart ผสมที่ method Standard When ลบเฉพาะ voucher Then method ยังอยู่ และ `total` ลดเฉพาะราคา voucher; Given cart voucher ล้วน When `POST /store/carts/:id/shipping-methods` ด้วย Standard Then 200 และ method อยู่ใน cart; Given cart voucher ล้วนที่มี Standard จากขั้นก่อนหน้า When แต่ละกรณีแยกกัน — แก้จำนวน line (`POST /store/carts/:id/line-items/:line`), เพิ่ม voucher (`POST /store/carts/:id/line-items`), แก้ cart (`POST /store/carts/:id` เช่น email) Then Standard ถูกลบ และ `shipping_total` = 0 (ข้อจำกัดของกฎข้อ 31b; transfer ใช้เส้นทาง hook เดียวกัน ไม่บังคับ test แยก; แก้ถ้อยคำตาม EV-15: Standard และ Digital อยู่ร่วมกันบน cart voucher ล้วนไม่ได้ — เพิ่ม method ตัวที่สอง `shouldCleanupOrphanProfiles` ของ Medusa ลบทั้งคู่ใน refresh ของการเพิ่มนั้นเอง การคง `digital-delivery` จึงตรวจด้วยเคส Digital ตัวเดียวข้างต้น); Given cart ที่มีแต่สินค้าจัดส่ง When ลบ line สุดท้าย Then method ไม่ถูกแตะ;
  unit (`refresh-cart-orphan-shipping.unit.spec.ts`): `input.shipping_methods` ไม่ว่าง → ไม่เรียก `softDeleteShippingMethods`; compensation เรียก `restoreShippingMethods` ด้วย id ที่ลบ; static: ไฟล์ใช้ `refreshCartItemsWorkflow.hooks.beforeRefreshingPaymentCollection` ไม่แก้ `node_modules` (grep); AC-3, AC-37, AC-42 ยังผ่าน
- AC-46 (EV-16, กฎข้อ 32) integration http ใหม่ `integration-tests/http/evoucher-order-canceled.spec.ts` (ใช้ `medusaIntegrationTestRunner`; `TestEventUtils.waitSubscribersExecution("order.canceled", ...)`): Given order ของ A มี voucher 2 line ของ**คนละ pool** — line X (pool PX) มี code `delivered`, line Y (pool PY) มี code `allocated` (ตั้งผ่าน allocation จริงกับ notification ที่ล้มตามกฎข้อ 17 หรือ `updateEvoucherCodes` หลังวาง order) และยกเลิก fulfillment ที่มีแล้ว When `cancelOrderWorkflow` Then code ของ Y เป็น `available` และ `order_id`, `order_line_item_id`, `customer_id`, `allocated_at` เป็น null, code ของ X ยังเป็น `delivered` พร้อม `order_id` เดิม, `stocked − reserved` ของ inventory level ของ **PY** เท่ากับจำนวน code `available` ของ PY — **ล้มบน develop**; ไม่ตรวจ stock ของ PX (เกินตามข้อจำกัดของกฎข้อ 33 → EV-17);
  Given order นั้น When ส่ง `order.canceled` ซ้ำสองครั้งตามลำดับและสองครั้งพร้อมกัน Then ไม่ error และผลเท่าเดิม; Given code ที่ปล่อยแล้วถูก order B claim When ส่ง `order.canceled` ของ order เดิมซ้ำ Then code ยังเป็นของ B; Given order ไม่มี voucher When ยกเลิก Then ไม่ error;
  unit `src/subscribers/__tests__/evoucher-order-canceled.unit.spec.ts`: ส่ง `data.id` เข้า workflow; compensation คืนค่าเดิมของแถวที่ปล่อย; static: workflow ใช้ `evoucherOrderLockKey`, `acquireLockStep`, `releaseLockStep`; AC-7, AC-27, AC-41 ยังผ่าน
- AC-47 (EV-17, กฎข้อ 33 — Q14 = ก) integration http (ต่อจาก `evoucher-order-canceled.spec.ts`): Given order ที่จ่ายแล้วมี line voucher qty 2 ของ pool P และอีเมล `evoucher.delivered` ส่งสำเร็จ (allocation จริง) Then fulfillment ของ line นั้นมี `shipped_at` ไม่เป็น null และไม่มี notification template อีเมลจัดส่ง (`shipment.created` มา `no_notification: true`) — **ล้มบน develop**;
  When admin `POST /admin/orders/:id/fulfillments/:fid/cancel` Then 4xx `not_allowed` (fulfillment shipped) และ `POST /admin/orders/:id/cancel` Then 4xx `not_allowed`; หลังทั้งสองขั้น code ทั้ง 2 ยัง `delivered`, order ไม่ถูกยกเลิก และ `stocked`/`reserved` ของ P เท่าก่อนยิง (stock ไม่เพิ่ม);
  Given อีเมลล้ม (notification provider mock ล้มแบบ AC ของกฎข้อ 17) Then fulfillment ไม่มี `shipped_at`, code คง `allocated`, และยกเลิก fulfillment + order ได้ แล้ว code กลับเป็น `available` ตาม AC-46;
  Given resend สำเร็จบน order ที่อีเมลแรกล้ม Then fulfillment มี `shipped_at` (resend ซ้ำอีกครั้งไม่ error และไม่สร้าง shipment ซ้ำ);
  Given การสร้าง shipment ล้ม (mock `createOrderShipmentWorkflow` ให้ throw) Then allocation ไม่ compensate: code คง `delivered`, fulfillment ยังอยู่ และมี log error; AC-7, AC-27, AC-33, AC-46 ยังผ่าน
- AC-48 (EV-18, กฎข้อ 34) integration http (ต่อจาก `evoucher-order-canceled.spec.ts`; ใช้ notification provider mock และ spy logger จาก container): Given order ที่จ่ายแล้วมี line voucher qty 2 ของ pool P (P มี code `available` ≥ 2) และถูกยกเลิกด้วย `cancelOrderWorkflow` ก่อน allocation
  When เรียก `allocateAndDeliverEvouchersWorkflow(container).run({ input: { order_id } })` (จำลอง `payment.captured` ที่มาช้า) Then resolve ไม่ throw, ไม่มี code ที่ `order_id` = order นั้น, จำนวน code `available` ของ P เท่าเดิม, order ไม่มี fulfillment, ไม่มี notification ใหม่ (ทั้ง `evoucher.delivered` และอีเมล backordered ถึง admin),
  line ไม่มี `metadata.evoucher_backordered` และ logger ได้ข้อความ info ที่มี `order_id` — เคส "P ไม่มี code เลย" ต้อง**ล้มบน develop** (flag + อีเมล backordered); Given order ที่ไม่ถูกยกเลิก Then ผลตาม AC-2/AC-47 เดิม; AC-7, AC-27, AC-46, AC-47 ยังผ่าน

## Non-functional
- การ allocate รันใน subscriber (worker) ไม่ใช่ใน request ของ checkout
- Import รองรับ 50k แถวภายใน < 60 วินาที (batched insert)
- (EV-12) job อ่าน `reserved` แล้ว void ทีละ pool ไม่ต้องมี lock ใหม่: ถ้า allocation เกิดระหว่างนั้น `stocked`/`reserved` ลดเท่ากัน ค่าที่คลาดเคลื่อนถูกแก้ในรอบถัดไป
  (กฎข้อ 12b e); void ยังใช้ `UPDATE … WHERE status='available'` แบบเดิมจึงไม่ void code ที่เพิ่งถูก claim
- Email template เป็นภาษาไทยและอังกฤษ; มีโลโก้พาร์ทเนอร์ + บล็อกวิธีใช้

## แผนการทดสอบ
- Unit: CSV parser (รวม AC-12 วันที่ล้วน), masking, expiry filter, encryption round-trip
- Integration (modules): การ allocate พร้อมกัน (AC-4), idempotency (AC-7)
- Integration (http): AC-1, AC-2, AC-5, AC-8, AC-9, AC-10, AC-11, AC-13 โดย mock notification provider
- Integration (seed script): AC-14
- Integration (http/modules): AC-15, AC-16, AC-17, AC-18
- e2e admin: AC-19, AC-20
- e2e: AC-3, AC-6
- Unit: round-trip ของ `expires_at` (AC-22); Integration (http/migration script): AC-21, AC-22 (1 กรณี), AC-23, AC-24
- Integration: AC-25, AC-26, AC-27 (EV-4), AC-28, AC-29 (EV-5b), AC-30, AC-30b (EV-12), AC-31 (EV-11), AC-3 (ส่วน `requires_shipping` ของ EV-7)
- Unit (EV-12): ฟังก์ชัน pure คำนวณ `keep` และเลือก code ที่เว้น (ไกลสุดก่อน, ไม่เว้น code หมดอายุแล้ว) — ครอบทุกกรณีของ AC-30
- e2e admin: AC-32 (EV-13); integration http: AC-33 (EV-5c)
- integration http: AC-34, AC-35 (EV-7a); e2e: AC-6, AC-36 (EV-7b), AC-3 ส่วน storefront + AC-37 (EV-7c); integration + unit: AC-38 (EV-N1); integration http: AC-39 (EV-9)
- (รอบ 12) integration http: AC-40 (EV-14), AC-41 (EV-N2); e2e + unit Vitest: AC-42 (EV-7d), AC-43 (EV-7e)
- (รอบ 13) unit jest + integration http: AC-44 (EV-N3)
- (รอบ 26) unit jest + integration http: AC-45 (EV-15)
- (รอบ 27) unit jest + integration http: AC-46 (EV-16) — เขียน integration ให้ล้มบน develop ก่อน (ไม่มี subscriber ของ `order.canceled` สำหรับ e-voucher)
- (รอบ 27) integration http: AC-47 (EV-17) — เขียนให้ล้มบน develop ก่อน (fulfillment ของ voucher ไม่มี `shipped_at`)
- (ปิดรอบ 27) integration http: AC-48 (EV-18) — เขียนเคส pool ไม่มี code ให้ล้มบน develop ก่อน

## Tasks
| ID | Task | Depends |
|----|------|---------|
| EV-1 | Module model (partner, pool, code) + encryption + link ไปยัง variant + migration + unit test | CORE-2 |
| EV-2 | Import workflow + ปรับ inventory + admin API สำหรับ partner/pool/import (AC-1, AC-8) | EV-1 |
| EV-3 | Fulfillment provider `digital` + seed shipping option digital-delivery | EV-1 |
| EV-4 | Allocate & deliver workflow + subscriber + email template; อีเมล backordered ส่งหา `EVOUCHER_ADMIN_EMAIL` (กฎข้อ 9); **เพิ่ม 2026-10-26 (owner, review #67)**: ciphertext ใน `notification.data` (กฎข้อ 16), ส่งล้มคง `allocated` + แจ้ง admin (กฎข้อ 17), backordered ทั้ง line (กฎข้อ 18) (AC-2, AC-4, AC-7, AC-17 ส่วน backordered, AC-25..27) | EV-2, EV-3, CORE-3 |
| EV-5 | Job รายวันสำหรับ expiry/void + low-stock (ส่งหา `EVOUCHER_ADMIN_EMAIL` ตามกฎข้อ 9 — PR #43 ต้องปรับ); admin API สำหรับ void; field `void_reason` + migration (AC-5, AC-9, AC-10, AC-17 ส่วน low-stock/expiry) — resend ย้ายไป EV-5b (owner Q-B) | EV-2 |
| EV-5b | `resendEvoucherEmailWorkflow` + `POST /admin/evoucher/orders/:id/resend` + ปุ่ม resend บน order widget ของ EV-6 — รวม code `allocated` ที่ส่งอีเมลล้ม (กฎข้อ 17); `idempotency_key` ใหม่ทุกครั้ง (กฎข้อ 19) (AC-18, AC-19, AC-28, AC-29) | EV-4, EV-6 |
| EV-6 | Admin UI: route page (partner, pool, import, code แบบ masked/reveal) + variant widget + order tab | EV-2 |
| EV-7 | **แตกรอบ 10** (builder หยุด: ไม่มี route รายการ code, AC-6 404 ไม่มี resource, ข้อมูลพาร์ทเนอร์บน PDP, billing ของ digital-only) → EV-7a / EV-7b / EV-7c ด้านล่าง | — |
| EV-7a | (backend) `GET /store/customers/me/evouchers` (กฎข้อ 22) + `allowFields` ของ pool/partner บน `GET /store/products*` (กฎข้อ 23) + index `(customer_id, status)` บน `evoucher_code` + migration + integration test (AC-34, AC-35) — แตะ `src/api/middlewares.ts` (conflict: เก็บทั้งสองฝั่ง) | EV-4 ☑ (เริ่มได้ทันที) |
| EV-7b | (storefront) บล็อก `evoucher-partner-block` บน PDP + หน้า `/account/vouchers` (`vouchers-link`, `voucher-card`, `voucher-copy-button`) + e2e (AC-6, AC-36); ข้อความไทยตรงในโค้ด + path ใหม่ใน ESLint rule (spec 01 CORE-4 กฎข้อ 4) | EV-7a |
| EV-7c | (storefront) checkout digital-only ตามกฎข้อ 24 + e2e (AC-3 ส่วน storefront, AC-37) | owner Q10 ☑ (ก) 2026-10-27, EV-4 ☑, EV-10 ☑ (backfill), CORE-4e ☑ — **เริ่มได้** — แตะไฟล์ checkout เดียวกับ CORE-19b/CORE-4g/PAY-6c: ตัวที่ merge ทีหลัง rebase (∥ EV-7a/7b) |
| EV-N1 | (เล็ก, backend, nit review #123) job รายวันนับ `near`/`long` ใน query เดียว (`count(*) FILTER`), test ขอบ `expires_at = cutoff`, รวม `readEvoucherStockStep` กับ step ตรวจ reservation (refactor — test เดิมของ AC-30/30b ต้องผ่าน) (AC-38) | EV-12 ☑ (#123) |
| EV-8 | Hardening จาก review EV-2: บังคับกฎข้อ 1 ตอนสร้าง pool (`requires_shipping=false` ที่ inventory item ผ่าน `updateInventoryItemsWorkflow` + compensation, ปฏิเสธ `manage_inventory=false`), `expires_at` แบบวันที่ล้วน, error เดิมไม่ถูกกลบเมื่อ compensation ล้ม; seed (`upgradeDigitalDelivery`) หา option Digital delivery ด้วย `type.code` แทนชื่อ (กฎข้อ 8) (AC-11, AC-12, AC-13, AC-14) | EV-2, EV-3 |
| EV-9 | follow-up review/QA (เล็ก): route pool list/detail select `low_stock_threshold` เสมอ (คำนวณ `low_stock` ถูกแม้ client ส่ง `fields` เอง) + module link `evoucher_code ↔ order` (`src/links/`) ที่ order tab (EV-6) และ resend (EV-5b) ใช้ + ฟอร์ม admin กัน double-submit และ `Label` ผูก `htmlFor`/`id` (กฎข้อ 11) (AC-15, AC-16, AC-20); (รอบ 9) ถ้า EV-5b (#111) merge ก่อน ให้เปลี่ยนการหา code ของ resend จาก filter `order_id` เป็น link นี้ใน PR เดียวกัน (test AC-18 เดิมต้องผ่าน); (รอบ 10, qa) เรียง code ด้วย `created_at` + `id` เป็น key รอง (กฎข้อ 25, AC-39) | EV-2, EV-6 |
| EV-10 | follow-up review/QA รอบ 5 (เล็ก, backend): admin void ตรวจ reservation (กฎข้อ 12 — เฉพาะส่วน admin void), `expires_at` วันที่มีจริงแบบ round-trip (กฎข้อ 13), ปฏิเสธ variant ที่ใช้ inventory item ร่วม/หลายตัว (กฎข้อ 14), ลบ pool คืน `requires_shipping` + migration script backfill pool ก่อน EV-8 (กฎข้อ 15) (AC-21..24) — **รอบ 6 (#85)**: เปลี่ยนจาก "ต้องอยู่ profile Digital" เป็น "product ต้องไม่มี shipping profile" (กฎข้อ 1; 400 ตาม Q9 ที่ owner ตัดสินแล้ว, AC-11) และย้ายส่วน job รายวันไป EV-12 | EV-5, EV-8 |
| EV-11 | (เล็ก, follow-up รอบ 6) เปลี่ยนเงื่อนไข `logger.warn` ใน EV-4 จาก "product ไม่อยู่ใน profile `digital`" เป็น "product มี shipping profile ใดๆ" (กฎข้อ 1) — ไม่ลบ warn (AC-31) | EV-4 |
| EV-12 | (owner Q6 2026-10-27 — **เริ่มได้**) job รายวันเว้น code ใกล้หมดอายุไว้เท่าที่ order จอง (`keep`, `expires_at` ไกลสุดก่อน) แล้ว void ส่วนที่เหลือ + อีเมลสรุปแสดง void/เว้น/ขาดต่อ pool (กฎข้อ 12b); allocation claim code ที่เว้นเมื่อ code อายุยาวไม่พอ (กฎข้อ 2 ข้อยกเว้น — เพิ่ม query ส่วนเติม `expires_at DESC` ใน `claimCodesForOrder` ของ `modules/evoucher/service.ts`) (AC-5 ปรับ, AC-30, AC-30b) | EV-5 ☑, EV-10 ☑ |
| EV-5c | (เล็ก, backend, nit review #111) lock `evoucher-order:<order_id>` ร่วมระหว่าง allocation กับ resend, ไม่กลืน error ของ Redis เป็น 409, ส่งสำเร็จแต่ update ล้ม → log + 200 (กฎข้อ 21) (AC-33) | EV-5b (#111) (∥ EV-12/EV-13 — EV-12 แตะ `claimCodesForOrder` ของ service ส่วน EV-5c แตะ workflow allocate/resend; ถ้าชนไฟล์ allocate ตัวที่ merge ทีหลัง rebase) |
| EV-13 | (เล็ก, admin UI, qa #111) widget E-vouchers บน order (EV-6) ไม่ล้นที่ 1280px + `data-testid="evoucher-order-widget"`; toast error ของ resend ไม่แสดง id `noti_…` (แสดงข้อความสั้น id ไปอยู่ใน log); README dev: ไม่ตั้ง `RESEND_API_KEY` ตอน seed/dev แล้ว notification ค้าง — บอกวิธีตั้ง key test หรือดูสถานะใน DB (AC-32) | EV-5b (#111) |
| EV-14 | ☑ #195 (AC-40 ☑) — (backend เล็ก, **ความปลอดภัย**, รอบ 12 — qa #179) validator ของ partner รับ `logo_url`/`terms_url` เฉพาะ http(s) (กฎข้อ 26) (AC-40) — ไฟล์: `src/api/admin/evoucher/validators.ts` + integration test | EV-2 ☑ |
| EV-N2 | (backend เล็ก, รอบ 12 — review #171 EV-5c, #155 EV-7a) lock ของ allocation: TTL ≥ 300s + `ownerId` ต่อ run, release ไม่ลบ lock ของคนอื่น, comment เวอร์ชันของ `isLockHeldError`; ลำดับ `NULLS FIRST` + test `evouchers[0]`, ย้าย validator, ตัด `defaults` (กฎข้อ 27) (AC-41) — ไฟล์: `src/workflows/evoucher/allocate-and-deliver-evouchers.ts`, `steps/resend-evoucher-email.ts`, route `store/customers/me/evouchers` — ☑ #201 | EV-5c ☑ (#171), EV-7a ☑ (#155) — **เริ่มได้** |
| EV-N3 | (backend เล็กมาก, รอบ 13 — review #201 EV-N2, review/qa #205 ADM-2a) ข้อความ error ของ resend ไม่มีจุดซ้อน (ตัดวรรคตอนท้ายของสาเหตุ, pure function + unit) + test AC-41 ตรวจรูปแบบ `ownerId` (กฎข้อ 30) (AC-44) — ไฟล์: `src/workflows/evoucher/steps/resend-evoucher-email.ts` (+ unit), `integration-tests/http/evoucher-resend.spec.ts` — ☑ #219 | **EV-N2 (#201) merge** (แตะสองไฟล์เดียวกัน); ∥ ADM-2a #205 (admin คงการกันจุดซ้อนไว้ — ไม่แตะ `src/admin`) |
| EV-7d | (storefront เล็ก, รอบ 12 — #174) cart-totals ของ digital-only ไม่มีแถวค่าจัดส่ง, digital-only คำนวณฝั่ง server, redirect ทุกวิธีชำระ + `setAddresses` ผ่าน `safeCountryCode` (กฎข้อ 28) (AC-42) — ไฟล์: `modules/common/components/cart-totals`, `lib/data/cart.ts`, component ชำระเงิน — ☑ #320 | EV-7c ☑ (#174), CORE-4i (spec 01 — แตะ `lib/data/cart.ts` action เดียวกัน) |
| EV-7e | (storefront เล็ก, รอบ 12 — #179) หน้า vouchers แบ่งหน้า + `support_contact`, บล็อก partner บน PDP (โหลด/`v_id`/metadata), ลิงก์ partner เฉพาะ http(s) (กฎข้อ 29) (AC-43) — ไฟล์: `app/[countryCode]/(main)/account/@dashboard/vouchers`, `modules/account` (voucher card), บล็อก partner บน PDP, data function — ☑ #217 | EV-7b ☑ (#179) — **เริ่มได้** (∥ EV-14; ชน PDP กับ CORE-25 ตัวที่ merge ทีหลัง rebase) |
| EV-15 | (backend เล็ก ~100 LOC รวม test, **บล็อก release v0.1.0**, รอบ 26 — qa รอบ 25; ต้นเหตุตั้งแต่ EV-7c และ Medusa 2.22.1 ไม่ลบ shipping method เมื่อเหลือ method เดียว) ลบ shipping method ที่ค้างเมื่อ cart เหลือแต่ line `requires_shipping=false` ผ่าน hook `beforeRefreshingPaymentCollection` (กฎข้อ 31) (AC-45) — ไฟล์: `src/workflows/hooks/refresh-cart-orphan-shipping.ts` ใหม่ (+ unit), `integration-tests/http/evoucher-orphan-shipping.spec.ts` ใหม่ — ☑ #326 | EV-7c ☑ (#174) — **เริ่มได้เมื่อ PR นี้ (#323, ADR-021) merge**; ∥ ทุกตัว (ไม่ชนไฟล์กับ #320 EV-7d — คนละ layer) |
| EV-16 | (backend เล็ก ~180 LOC, รอบ 27 — qa EV-M-29) subscriber + workflow ปล่อย code `allocated` ของ order ที่ยกเลิก (กฎข้อ 32) (AC-46) — ไฟล์: `src/subscribers/evoucher-order-canceled.ts` (ใหม่) + unit, `src/workflows/evoucher/release-evoucher-codes-for-order.ts` (ใหม่), `integration-tests/http/evoucher-order-canceled.spec.ts` (ใหม่) — ☑ #333 | PR spec รอบ 27 merge; ไม่ชน CORE-55/AF-21/ADM-20; ไม่บล็อก release v0.1.0 |
| EV-17 | (backend เล็ก, รอบ 27 — follow-up review PR #332) stock ของ pool ไม่เกินจำนวน code ที่ขายได้หลังยกเลิก fulfillment ของ code `delivered` (กฎข้อ 33, Q14 = ก: shipment `no_notification` หลังอีเมลสำเร็จ) (AC-47) — ไฟล์: `src/workflows/evoucher/steps/` (step ใหม่ สร้าง shipment แบบไม่ throw) + unit, `src/workflows/evoucher/allocate-and-deliver-evouchers.ts`, `src/workflows/evoucher/resend-evoucher-email.ts`, `integration-tests/http/evoucher-order-canceled.spec.ts` — ☑ #337 | EV-16 merge (ไฟล์ test เดียวกัน); ไม่บล็อก release v0.1.0 |
| EV-18 | (backend เล็ก ~60 LOC รวม test, ปิดรอบ 27 — review #333) allocation ข้าม order ที่ถูกยกเลิก: ไม่ claim/flag/อีเมล/fulfillment, log info, ไม่ throw (กฎข้อ 34) (AC-48) — ไฟล์: `src/workflows/evoucher/allocate-and-deliver-evouchers.ts` (+ `steps/evoucher-order.ts` type หรือ `steps/resolve-evoucher-lines.ts` ถ้าตรวจที่นั่น), `integration-tests/http/evoucher-order-canceled.spec.ts` — ☑ #339 | none (EV-16 ☑ #333, EV-17 ☑ #337); ∥ ทุกตัว; ไม่บล็อก release v0.1.0 |
EV-3 ∥ EV-2 หลัง EV-1; EV-5 ∥ EV-6 หลัง EV-2; EV-10 ∥ EV-4/EV-9 (EV-10 แตะ `void-evoucher-codes.ts`, `evoucher-pool.ts`, `utils/csv.ts`, migration script — ถ้า EV-9 แตะ
`evoucher-pool.ts` ร่วม ตัวที่ merge ทีหลัง rebase) และต้อง merge ก่อน release ที่มี EV-7 (backfill); EV-9 หลัง EV-6 (แก้ฟอร์มของ EV-6; ถ้า EV-6 ต้องใช้ link ก่อน ให้รวม link เข้า PR นั้นแทน); EV-5b หลัง EV-4 และ EV-6; EV-11 หลัง EV-4 (∥ EV-5b; แตะไฟล์ allocation เดียวกันได้ — ตัวที่ merge ทีหลัง rebase); EV-12 เริ่มได้ทันที (∥ EV-9/EV-13 — EV-12 แตะ job/workflow void + `claimCodesForOrder` ของ service + template สรุป; ไม่แตะ admin UI);
EV-13 หลัง EV-5b (#111) (∥ EV-12; ถ้า EV-9 แตะ widget order เดียวกัน ตัวที่ merge ทีหลัง rebase);
(รอบ 10) EV-7a เริ่มได้ทันที → EV-7b; EV-7c เริ่มได้ (Q10 = ก) ∥ EV-7a/EV-7b (คนละไฟล์: checkout vs PDP/account); EV-9 รวมกฎข้อ 25/AC-39 (ถ้า PR ของ EV-9 เปิดอยู่แล้ว แก้ใน PR นั้น); EV-N1 ∥ ทุกตัว (แตะ job/workflow expiry ของ EV-12 เท่านั้น);
release ที่มี EV-7c ต้องมี backfill ของ EV-10 แล้ว (☑)
(รอบ 11 สถานะ) EV-9 ☑ #139 · EV-N1 ◐ #149 (กฎข้อ 2 แก้ถ้อยคำขอบ cutoff ให้ตรงโค้ด — EV-N1 ไม่ต้องแก้โค้ด `claimCodesForOrder` เพราะเรื่องนี้) · EV-7a/7b/7c, EV-13, EV-5c ยังไม่เริ่ม — นิยามไม่เปลี่ยน;
nit #139: `evoucher-admin-ui.spec` ยังหา code จากลำดับ `codes[0]` ของ CSV → ให้ PR ถัดไปที่แตะไฟล์นั้น (EV-13) หา code จากค่าแทน (ไม่สร้าง task)
(รอบ 12 สถานะ) ☑: EV-N1 #149 · EV-7a #155 · EV-13 #167 · EV-5c #171 · EV-7c #174 · EV-7b #179 → EV ของ v0.3.0 ครบทุก task เดิม; ใหม่รอบ 12: EV-14 ∥ EV-N2 ∥ EV-7e เริ่มได้ทันที,
EV-7d หลัง CORE-4i (ซึ่งรอ PAY-3b1/PAY-3b2 ของ spec 06); nit EV-13 (review/qa #167: e2e mock ข้อความ resend รูปแบบใหม่ + ตรวจ `/log/i`, ข้อความ error มีจุดซ้อน `resolved.). Try again`) รวมใน ADM-2a (spec 08 — แตะ widget
`order-evouchers` เดียวกัน); ถ้า owner ต้องการ release v0.3.0 ก่อน EV-14 ให้แจ้ง — EV-14 เป็นเรื่องความปลอดภัยฝั่ง admin (ต้องมีสิทธิ์ admin จึงใส่ค่าได้) แต่ storefront render ลิงก์นั้นให้ลูกค้า
(รอบ 13 สถานะ, 2026-11-03) EV-14 ☑ #195 · EV-N2 ◐ #201 · ADM-2a ◐ #205 (spec 08); ใหม่: EV-N3 (← #201); การตรวจ URL ฝั่งฟอร์ม admin → ADM-5 (spec 08); EV-7d ยังรอ CORE-4i
(Q-C2 ของ spec 01 ตัดสินแล้ว = (ก) owner 2026-11-03 — helper กลาง ไม่เปลี่ยนกฎข้อ 28 ของ EV-7d); EV-7e เริ่มได้ (ชน PDP กับ CORE-25 #199 ตัวที่ merge ทีหลัง rebase)
(รอบ 25 สถานะ, 2026-11-09) ☑: EV-N2 #201 · EV-7e #217 · EV-N3 #219; CORE-4i ☑ (spec 01 — #222 + #305) → EV-7d เริ่มได้ (Depends เดิม); owner ปิด Q1–Q3 ตามค่าเริ่มต้น
(รอบ 26, 2026-11-09) EV-15 ☐ **บล็อก release v0.1.0 — เริ่มได้เมื่อ PR นี้ merge** (Q13 = ก, ADR-021); กฎข้อ 28c แก้ถ้อยคำ (ไม่เปลี่ยนพฤติกรรม EV-7d)
(ปิดรอบ 26, 2026-11-09) EV-7d ☑ #320 · EV-15 ☑ #326
(ปิดรอบ 27, 2026-11-10) EV-16 ☑ #333 · EV-17 ☑ #337; ใหม่: EV-18 เริ่มได้ทันที (review #333 — กฎข้อ 34)
(รอบ 28, 2026-11-10) EV-18 ☑ #339
(รอบ 30, 2026-11-13) ไม่เปิด task: `allocate-and-deliver-evouchers.ts:77` แปลงผล `query.graph` เป็น `EvoucherOrder` ด้วย `as unknown as` (review #347) จึง typecheck ไม่ได้ตรวจว่า field เช่น `status` มีจริง — field ถูกตรวจด้วย integration ของ EV-16/EV-18 อยู่แล้ว; แก้ให้ใช้ type ที่ generate จาก `query.graph` ใน PR ถัดไปที่แตะไฟล์นั้น
EV-4 ส่งอีเมล backordered ตามกฎข้อ 9 (AC-17 ส่วน backordered); EV-8 ∥ EV-4/EV-5/EV-6 หลัง EV-3 (EV-8 ต้องไม่ขัดกับกลไก checkout digital ที่ EV-3
ส่งมอบ — ถ้า EV-3 ตั้ง `requires_shipping=false` ให้แล้ว ส่วนนั้นของ EV-8 เหลือเพียง test ของ AC-11)

## Follow-up รอบ 40 (2026-11-21 — การทดสอบ manual เฟส 2/4/8; owner สั่งแก้ใน release เดียว)
ที่มา: EV-M-12 (แบ่งหน้า code ซ้ำ/หาย), ไม่มีปุ่มลบ pool ใน admin + pool ว่างขึ้น "Low stock", admin มองไม่เห็นธง `evoucher_backordered` (`GET /admin/orders/:id?fields=*items` คืน `items[].metadata` = `{}`),
ผู้แพ้ race voucher ใบสุดท้าย → ข้อความอยู่ใน spec 03 กฎข้อ 27 (FS-22)

### สิ่งที่ Medusa มีให้อยู่แล้ว (รอบ 40)
| ความต้องการ | Medusa มีให้ | วิธีใช้ |
|---|---|---|
| ลำดับการแบ่งหน้าที่คงที่ | `pagination.order` ของ `listAndCount`/`query.graph` รับหลาย key | เพิ่ม `id` เป็น key รอง (กฎข้อ 35) |
| ลด stock ของ inventory item | `adjustInventoryLevelsStep` / `updateInventoryLevelsWorkflow` (core-flows) | ใช้ตามเดิมพร้อม compensation (กฎข้อ 36) |
| prompt ยืนยัน / ปุ่มต่อแถว / toast ใน admin | `usePrompt`, `toast` ของ `@medusajs/ui`; `ActionMenu` ของ `@medusajs/dashboard/components` | ใช้ตามเดิม (กฎข้อ 37) — ไม่สร้างเอง |
| widget หน้า order | injection zone `order.details.after` / `order.details.side.after` ของ admin; `StatusBadge` ของ `@medusajs/ui`; `SectionRow` ของ dashboard | ใช้ตามเดิม (กฎข้อ 38) |

### Business rules (รอบ 40)
35. (EV-19 — EV-M-12) `GET /admin/evoucher/pools/:id/codes` เรียง `{ created_at: "ASC", id: "ASC" }` (`route.ts:35`) — แบ่งหน้าแล้วได้ code ครบไม่ซ้ำแม้ `created_at` เท่ากันทั้ง batch;
    ตรวจ route list อื่นของ module e-voucher (pools, partners) ที่เรียงด้วย field เดียวแล้วเพิ่ม `id` แบบเดียวกัน (affiliate มี `tiebreakById` แล้ว — ADM-24)
36. (EV-20 — owner อนุมัติปุ่มลบ + **ยืนยันกติกานี้ 2026-11-21**: ลบได้เมื่อยังไม่มีรหัสถูกส่ง, code `available`/`void` ลบตาม, stock ลด, prompt ยืนยัน) `deleteEvoucherPoolWorkflow` ขยายจาก "เฉพาะ pool ว่าง" เป็น "**ลบได้เมื่อไม่มี code ที่เคยถูกส่ง/จองให้ลูกค้า**":
    (a) มี code สถานะ `allocated`/`delivered` หรือมี `order_id` อย่างน้อย 1 → 400 `not_allowed` "Pool has codes that were allocated or delivered to customers; it cannot be deleted";
    (b) ไม่เช่นนั้น: soft-delete code ทั้งหมดของ pool (`available`/`void`) → ลด `stocked_quantity` ของ inventory level ของ variant ลงเท่าจำนวน code `available` (workflow ของ Medusa + compensation)
        → ขั้นเดิมของกฎข้อ 15 (`requires_shipping=true`) → ลบ pool; compensation คืนทุกขั้น; ใต้ lock เดียวกับ import/allocation ของ pool (กัน allocate ระหว่างลบ)
    (c) `low_stock` = `code ทั้งหมด > 0` **และ** `available < low_stock_threshold`; route คืน `total_codes` เพิ่ม; pool ที่ไม่มี code เลยไม่ขึ้น "Low stock" (แก้ AC-15: pool ว่าง → `low_stock=false`);
        job รายวัน (`send-evoucher-stock-alerts`) ใช้นิยามเดียวกัน — ไม่ส่งอีเมล low-stock ของ pool ที่ไม่มี code เลย (session หลักตัดสิน 2026-11-21)
    (d) (session หลักตัดสิน 2026-11-21 ตามเจตนา owner "ลบได้เมื่อยังไม่มีรหัสถูกส่ง") inventory level ของ variant มี `reserved_quantity > 0` (order ที่รอชำระ/รอส่งรหัส) → 400 `not_allowed`
        "Pool has orders awaiting payment or code delivery (reserved stock); it cannot be deleted until they are completed or canceled" ทุกอย่างคงเดิม;
        ตรวจใต้ lock ของ inventory item เดียวกับการลด stock (แบบกฎข้อ 12) จึงไม่ชนกับ checkout ที่จองระหว่างลบ
37. (EV-21 — admin UI) หน้า pool (`routes/evouchers/pools/[id]`) และตาราง pools: ปุ่ม Delete ใน `ActionMenu` → `usePrompt` ยืนยัน (ระบุจำนวน code ที่จะถูกลบ) → ลบ → toast + กลับรายการ;
    400 ของข้อ 36a/36d → toast ข้อความจาก API; ปุ่มกันกดซ้ำ (disable ระหว่างส่ง + single-flight ตามกฎ ADM-39 ของ spec 08); badge "No codes" (`StatusBadge` สีเทา) เมื่อ `total_codes = 0` แทน "Low stock"
38. (EV-22 — owner) admin เห็นธง backordered ของ line: (a) builder หาสาเหตุที่ `GET /admin/orders/:id?fields=*items` คืน `items[].metadata` ว่างทั้งที่ DB มี `evoucher_backordered=true`
    (บันทึกใน PR ว่าเขียนลงตาราง/entity ไหน — เช่น `order_line_item.metadata` vs `order_item`/cart line); แก้ให้ธงอยู่ใน field ที่ Admin API ของ Medusa คืนจริง ถ้าแก้ที่ต้นทางไม่ได้โดยไม่ patch Medusa
        → route อ่านของเรา `GET /admin/evoucher/orders/:id/codes` (มีอยู่แล้ว) คืน `backordered_line_item_ids`;
    (b) widget หน้า order (zone `order.details.side.after` หรือ widget e-voucher เดิม `order-evouchers.tsx`) แสดง `StatusBadge` "Backordered — codes pending" ต่อ line ที่ค้าง (`evoucher-backordered-badge`)

### Acceptance criteria (รอบ 40)
- ☑ AC-49 (EV-19, กฎข้อ 35) integration http — **ล้มบน develop** ก่อน: import **100** code ใน batch เดียว (created_at เท่ากัน — ตั้งด้วย SQL ใน test ถ้าจำเป็น) แล้วอ่าน `limit=10` ทีละหน้า 10 หน้า → ได้ id ไม่ซ้ำ 100 รายการ
  (แก้ตาม review รอบ 40: 30 แถวไม่พอให้ล้มบน develop — Postgres สลับลำดับแถวที่ค่า sort เท่ากันให้เห็นเมื่อจำนวนแถว > 2×(offset+limit) ซึ่งเปลี่ยนแผนเป็น top-N heapsort)
- ☑ AC-50 (EV-20, กฎข้อ 36) integration — **ล้มบน develop** ก่อน: (a) pool ที่มี code `available` 5 + `void` 1 ไม่มี order → DELETE 200, code ทั้ง 6 ถูก soft-delete, inventory level ของ variant ลดลง 5, `requires_shipping=true`;
  (b) pool ที่มี code `delivered` 1 → 400 ข้อความตาม 36a ทุกอย่างคงเดิม; (c) step ลด stock ล้ม (mock) → code/pool คืนครบ; (d) pool ว่าง → `low_stock=false`, `total_codes=0`; pool 5 available threshold 20 → `low_stock=true` (AC-15 เดิม);
  (e) reservation ค้าง 1 → 400 ข้อความตาม 36d ทุกอย่างคงเดิม, ลบ reservation แล้วลบได้; (f) job รายวันไม่ส่ง low-stock ของ pool ที่ไม่มี code
- AC-51 ☑ (EV-21, กฎข้อ 37) e2e admin: ลบ pool ที่ไม่มีการส่ง → prompt แสดงจำนวน code → ยืนยัน → toast และ pool หายจากตาราง; dblclick ปุ่มยืนยัน → DELETE 1 ครั้ง (นับ request);
  pool ที่มี code ส่งแล้ว → toast error และ pool ยังอยู่; pool ใหม่ไม่มี code → เห็น badge "No codes" ไม่เห็น "Low stock"; menuitem หาด้วย role + ชื่อ (ADR-018)
- ☑ AC-52 (EV-22, กฎข้อ 38) integration + e2e admin: order ที่ pool หมดตอน capture (backordered) → API ตามข้อ 38a คืนธงของ line นั้น (ล้มบน develop); หน้า order ใน admin เห็น `evoucher-backordered-badge` 1 ตัวต่อ line ที่ค้าง; หลัง allocation สำเร็จ (ธงถูกล้าง) badge หาย — integration รัน allocate workflow ซ้ำหลัง import code (session หลักตัดสิน 2026-11-21: resend ของ EV-5b ไม่ allocate ใหม่ ข้อความเดิม "หลัง resend สำเร็จ" จึงอ้างพฤติกรรมที่ไม่มีจริง; ปุ่ม "Retry allocation" เป็นข้อเสนอให้ owner ตัดสินแยก)

### Tasks (รอบ 40)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| EV-19 | ☑ #427 — (EV-M-12) `id` เป็น key เรียงรองของรายการ code (+ list อื่นของ e-voucher) (กฎข้อ 35) | `src/api/admin/evoucher/pools/[id]/codes/route.ts`, route list อื่นถ้าพบ, integration | ~10 LOC + ~80 LOC test | AC-49 | PR เอกสารรอบ 40 | — |
| EV-20 | ☑ #437 — (backend) ลบ pool ที่ยังไม่ส่ง code + ลด stock + `low_stock`/`total_codes` (กฎข้อ 36) | `src/workflows/evoucher/evoucher-pool.ts`, `src/api/admin/evoucher/pools/*`, test | ~120 LOC + ~200 LOC test | AC-50 | PR เอกสารรอบ 40 | — |
| EV-21 | ☑ #454 — (admin UI) ปุ่ม Delete + prompt + badge "No codes" (กฎข้อ 37); qa | `src/admin/routes/evouchers/pools/[id]/page.tsx`, `src/admin/components/evoucher/pools-table.tsx`, `src/admin/lib/evoucher.ts`, e2e admin | ~90 LOC + ~150 LOC test | AC-51 | **EV-20**, **ADM-39** (single-flight แบบใหม่) | `pools-table.tsx` |
| EV-22 | ☑ #446 — ธง backordered เห็นใน admin (หาสาเหตุ metadata ว่าง + badge) (กฎข้อ 38); qa | `src/subscribers/evoucher-payment-captured.ts` หรือ workflow allocation, `src/api/admin/evoucher/orders/[id]/codes/route.ts`, `src/admin/widgets/order-evouchers.tsx`, test | ~80 LOC + ~150 LOC test | AC-52 | PR เอกสารรอบ 40 | `order-evouchers.tsx` (ADM-39 ถ้าแตะ single-flight ในไฟล์นี้ — ตัวหลัง sync) |

## Follow-up รอบ 41 (2026-11-21 — owner อนุมัติปุ่ม "Retry allocation" + backfill ธง backordered ให้ order เก่า)
ที่มา: EV-22 — allocation รันแค่ตอน `payment.captured` (resend ของ EV-5b ไม่ allocate ใหม่) → order ที่ backordered ค้างจนกว่าจะมีคนรัน workflow เอง;
order ก่อน EV-22 (เช่น #66) มีธงแค่ใน `order_line_item.metadata` จึงไม่ขึ้น badge (EV-22 เขียนธงซ้ำลง `order_item` — `update-evoucher-backordered-flags.ts:14-27`)

### สิ่งที่ Medusa มีให้อยู่แล้ว (รอบ 41)
| ความต้องการ | Medusa มีให้ | วิธีใช้ |
|---|---|---|
| allocate ใหม่แบบ idempotent | workflow ของเรา `allocateAndDeliverEvouchersWorkflow` (lock ต่อ order, ข้าม line ที่มี code แล้ว — AC-7; idempotency key อีเมล admin ต่อ order+line) | ใช้ตามเดิมจาก route ใหม่ (กฎข้อ 39) — ไม่เขียน allocation ใหม่ |
| เขียน metadata ของ order item | `orderModule.updateOrderItem` (ทางเดียวกับ EV-22) | ใช้ตามเดิม (กฎข้อ 41) |
| ปุ่ม/toast ใน widget | `Button`, `toast` ของ `@medusajs/ui`; single-flight ของ `admin/lib/single-flight.ts` (ADM-39) | ใช้ตามเดิม (กฎข้อ 40) |

### Business rules (รอบ 41)
39. (EV-23) `POST /admin/evoucher/orders/:id/allocate` (admin auth ของ Medusa) รัน `allocateAndDeliverEvouchersWorkflow({ order_id, admin_email: EVOUCHER_ADMIN_EMAIL })` แล้วคืน
    `{ allocated_line_item_ids, backordered_line_item_ids, stuck_line_item_ids }`; order ไม่พบ → 404; order `canceled` → 400 `not_allowed`; order ไม่มี line e-voucher → 400 `not_allowed`;
    order ที่ยังไม่มี payment ที่ captured (`payment_collections.payments.captured_at` ว่างทุกตัว เช่น group buy ที่ยัง `authorized`) → 400 `not_allowed` ไม่ claim code
    (review #472 — สอดคล้องกฎข้อ 2); line ที่มี code `allocated` แต่ยังไม่ส่งมอบ (อีเมลล้ม กฎข้อ 17) ไม่ claim ซ้ำและคืนใน `stuck_line_item_ids` (ให้ widget ไม่แจ้งว่าส่งแล้ว — ใช้ resend ของ EV-5b; review #472);
    ไม่มี line ที่ backordered → 200 ผลว่าง (noop — ยิงซ้ำ/พร้อมกันได้ผลเดียวกัน ไม่ claim/อีเมลซ้ำ); ยัง backordered เพราะ code ไม่พอ → 200 พร้อม `backordered_line_item_ids` (ไม่ส่งอีเมล admin ซ้ำ — idempotency key เดิม)
40. (EV-24 — admin) widget `order-evouchers.tsx` แสดงปุ่ม "Retry allocation" (`evoucher-retry-allocation`) เมื่อมี line ที่ backordered (กฎข้อ 38b) → POST ข้อ 39;
    disabled ระหว่างส่ง + single-flight (CLAUDE.md กันกดซ้ำ); สำเร็จ → `toast.success` ("Codes allocated" หรือ "Still backordered — import more codes first" เมื่อยังค้าง) แล้ว invalidate query ของ widget (badge หายเมื่อ allocate ครบ); 4xx → `toast.error` ข้อความจาก API
    **(ปิดรอบ 41 — ข้อความที่ 3 ตามที่ EV-24 #504 ทำจริง, review #472)** `stuck_line_item_ids` ไม่ว่าง (code `allocated` แต่ส่งอีเมลไม่สำเร็จ — กฎข้อ 17) → **`toast.warning`** "Some codes were allocated but not emailed — use Resend email"
    (ถ้ามี line ที่ยัง backordered ด้วย ข้อความ = "Still backordered — import more codes first. Some codes were allocated but not emailed — use Resend email") และ**ไม่**แสดง "Codes allocated";
    การเลือกข้อความเป็น pure helper `allocateResultToast` (`src/admin/lib/evoucher-allocate.ts` + unit) — "Still backordered" อย่างเดียวยังเป็น `toast.success` (เปลี่ยนเป็น warning ใน EV-26 กฎข้อ 42a)
41. (EV-25 — owner อนุมัติ backfill) script `apps/backend/src/scripts/backfill-evoucher-backordered-flags.ts` (`medusa exec`): หา line ที่ `order_line_item.metadata.evoucher_backordered === true` แต่ `order_item.metadata` ไม่มีธงนี้
    → ค่าเริ่มต้น dry-run พิมพ์ order/line id; `--apply` เขียนธงลง `order_item` ด้วยวิธีเดียวกับ EV-22 (helper ร่วม — export จาก step เดิม ไม่ copy) ไม่แตะ line ที่ไม่มีธง; รันซ้ำ → 0 แถว; เพิ่มบรรทัด go-live checklist พร้อมคำสั่งจริง

### Acceptance criteria (รอบ 41)
- AC-53 ☑ (EV-23, กฎข้อ 39) integration http — **ล้มบน develop** (404 route): order backordered (pool ว่างตอน capture) → import code → POST → 200 `allocated_line_item_ids` มี line นั้น, code `delivered`, อีเมลลูกค้า 1 ฉบับ, ธงถูกล้าง;
  ยิงพร้อมกัน 2 request → code ถูก claim ตามจำนวนเดียว อีเมลลูกค้า 1 ฉบับ ทั้งคู่ 200; ยังไม่ import → 200 `backordered_line_item_ids` และอีเมล admin ไม่เพิ่ม; order `canceled` → 400; ไม่มี token admin → 401;
  order ที่ payment ยังไม่ captured → 400 `not_allowed` และไม่มี code ถูก claim (review #472 — สอดคล้องกฎข้อ 2); line ที่ code `allocated` แต่ยังไม่ส่งมอบ → 200 `stuck_line_item_ids` มี line นั้น ไม่ claim/อีเมลซ้ำ (review #472)
- AC-54 ☑ (EV-24, กฎข้อ 40) e2e admin: order backordered เห็น `evoucher-retry-allocation`; dblclick → POST 1 ครั้ง (นับ request); หลัง import code กด → toast และ `evoucher-backordered-badge` หาย; order ที่ไม่มี line ค้าง → ไม่เห็นปุ่ม
- ☑ AC-55 (EV-25, กฎข้อ 41) integration: order ที่ตั้งธงเฉพาะใน `order_line_item.metadata` (จำลองข้อมูลก่อน EV-22) → dry-run พิมพ์ 1 แถว DB ไม่เปลี่ยน; `--apply` → `GET /admin/orders/:id?fields=*items` คืน `items[].metadata.evoucher_backordered = true`; รันซ้ำ → 0; line ที่ไม่มีธงไม่ถูกแตะ

### Tasks (รอบ 41)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| EV-23 | ☑ #472 — route Retry allocation (กฎข้อ 39) | `src/api/admin/evoucher/orders/[id]/allocate/route.ts` (ใหม่), middleware/validator ของ admin evoucher, integration | ~60 LOC + ~180 LOC test | AC-53 | PR เอกสารรอบ 41 | `src/api/middlewares.ts` ถ้าลงทะเบียน middleware ที่นี่ (GB-26, CORE-80, OPS-34 — ตัวหลัง sync) |
| EV-24 | ☑ #504 — ปุ่ม Retry allocation ใน widget order (กฎข้อ 40); qa | `src/admin/widgets/order-evouchers.tsx`, `src/admin/lib/evoucher.ts`, e2e admin | ~50 LOC + ~100 LOC test | AC-54 | **EV-23** | `order-evouchers.tsx` |
| EV-25 | ☑ #476 — script backfill ธง backordered (กฎข้อ 41) + บรรทัด go-live | `src/scripts/backfill-evoucher-backordered-flags.ts`, `src/workflows/evoucher/steps/update-evoucher-backordered-flags.ts` (export helper), `docs/ops/production.md` (Go-live ข้อ 12), integration | ~60 LOC + ~100 LOC test | AC-55 | PR เอกสารรอบ 41 | `production.md` (CORE-81, OPS-33 คนละบรรทัด) |

## Follow-up รอบ 42 (ปิดรอบ 41 2026-11-23 — qa/review #504; ไม่บล็อก release v0.3.0)
Status: done (☑ EV-26 #527 — ปิดรอบ 42 2026-11-24; รอบ 43 ไม่มี task ของ spec นี้ — nit ของ #527 อยู่ในรายการไม่ทำของ `docs/roadmap/history.md` หัวข้อ "รอบ 42 — ผลจริง")
### สิ่งที่ Medusa มีให้อยู่แล้ว (รอบ 42)
| ความต้องการ | Medusa มีให้ | วิธีใช้ |
|---|---|---|
| toast แบบเตือน | `toast.warning` ของ `@medusajs/ui` | ใช้ตามเดิม (กฎข้อ 42a) |
### Business rules (รอบ 42)
42. (EV-26 — admin hygiene) (a) (qa #504) ผล "Still backordered — import more codes first" (ไม่มี stuck) ใช้ `variant: "warning"` แทน `success` (ข้อความเดิม — ยังไม่ได้ส่ง code จึงไม่ใช่ผลสำเร็จ);
    (b) (review #504; แก้ชื่อตาม review #520) helper ที่ซ้ำกันสองไฟล์ย้ายไป `e2e/support/evoucher.ts` (ผู้ใช้ 2 ที่):
        ตั้ง stock ของ variant — `overstock` (`e2e/evoucher-admin-backordered.spec.ts:14-25`) กับ `setStock` (`e2e/evoucher-admin-retry-allocation.spec.ts:12-23`) เนื้อเหมือนกัน → helper ร่วมชื่อ **`setVariantStock`**
        (ห้ามใช้ชื่อ `setStock` เพราะ `e2e/support/group-buy.ts:320` export `setStock` คนละ signature อยู่แล้ว);
        อ่าน line ที่มีธง backordered — `flaggedVariants` (`backordered.spec.ts:28-31` คืน variant id) กับ `flaggedLines` (`retry-allocation.spec.ts:25-27` คืนจำนวน) ไม่ได้ซ้ำตรงตัว
        → helper ร่วม **`backorderedItems(request, admin, orderId)`** คืน item ที่ `metadata.evoucher_backordered === true` แล้วผู้เรียก map เป็น `variant_id`/`length` เอง;
    (c) `allocateErrorMessage` ใช้ตัวจัดข้อความเดียวกับ `evoucher-resend.ts` (`tidyStops`/HINT) — export จากที่เดิม ไม่ copy; ข้อความ 4xx ที่แสดงเท่าเดิมยกเว้นการจัดจุด/คำแนะนำ
### Acceptance criteria (รอบ 42)
- ☑ AC-56 (EV-26, กฎข้อ 42) unit `evoucher-allocate.unit.spec.ts`: backordered อย่างเดียว → `variant: "warning"` (ล้มบน develop — `success`); allocated อย่างเดียว → `success` "Codes allocated" (regression);
  static — **ล้มบน develop** ก่อน: ไม่มีนิยาม `overstock`/`flaggedVariants` ใน `evoucher-admin-backordered.spec.ts` และไม่มี `setStock`/`flaggedLines` ใน `evoucher-admin-retry-allocation.spec.ts`;
  ทั้งสองไฟล์ import `setVariantStock` และ `backorderedItems` จาก `e2e/support/evoucher.ts`; `e2e/support/evoucher.ts` ไม่ export ชื่อ `setStock`; unit ของ `allocateErrorMessage` กับข้อความที่ resend ใช้ได้ผลจัดรูปเดียวกัน; e2e AC-52/AC-54 ผ่าน
### Tasks (รอบ 42)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| EV-26 | ☑ #527 — hygiene admin e-voucher: toast warning ของ backordered + helper e2e ร่วม + ตัวจัดข้อความ error ร่วม (กฎข้อ 42) | `src/admin/lib/evoucher-allocate.ts` (+ unit), `src/admin/lib/evoucher-resend.ts`, `src/admin/widgets/order-evouchers.tsx`, `apps/storefront/e2e/{evoucher-admin-retry-allocation,evoucher-admin-backordered}.spec.ts`, `e2e/support/evoucher.ts` | ~30 LOC + ~60 LOC test | AC-56 | PR เอกสารปิดรอบ 41 | — |

## Follow-up รอบ 47 (2026-11-27 — ทดสอบ manual ก่อน release v0.4.0; owner อนุมัติ)
Status: draft
ที่มา: สร้างคลังโค้ดจาก widget "Voucher pool" (`src/admin/widgets/variant-evoucher-pool.tsx`) แล้วแอดมินเจอ error อังกฤษจาก backend ทีละข้อหลังกดบันทึก/นำเข้า:
`evoucher-pool.ts:80` "Voucher variant must have manage_inventory=true with an inventory item" (กฎข้อ 1), `evoucher-pool.ts:84` "Voucher product must not have a shipping profile …" (กฎข้อ 1/Q9),
และตอนนำเข้า `import-evoucher-codes.ts:83` "Voucher variant must manage inventory with exactly one inventory item and one stock location level"
(เงื่อนไข location level มีเฉพาะตอน **import** — การสร้าง pool ไม่ตรวจ; ยังไม่มีกฎในสเปกนี้) · กฎข้อ 14 (`evoucher-pool.ts:90-93` inventory item เดียว `required_quantity=1` ไม่ใช้ร่วม) เป็นด่านที่ 4 ตอนสร้าง
นอกขอบเขต: เปลี่ยน validation/ข้อความ error ของ backend (คงเดิม — เป็นด่านจริง; toast ยังแสดงข้อความ API เมื่อหลุดถึง backend), ตรวจเงื่อนไขบนหน้า pool (`routes/evouchers/pools/[id]`) ก่อน import, แปลข้อความ error ของ API

### สิ่งที่ Medusa มีให้อยู่แล้ว (รอบ 47)
| ความต้องการ | Medusa มีให้ | วิธีใช้ |
|---|---|---|
| ข้อมูล `manage_inventory`, inventory item (`required_quantity`, variant ที่ใช้ร่วม), location level, shipping profile ของ product | `GET /admin/products/:id` + `fields` ผ่าน hook `useProduct` ของ `@medusajs/dashboard/hooks` (หน้า product ของ dashboard เองขอ `*shipping_profile` — `PRODUCT_DETAIL_FIELDS`); path ของ inventory ตรงกับที่ backend ใช้ใน `query.graph` | **ใช้ตามที่มี** — ไม่เพิ่ม API (กฎข้อ 43a); dashboard 2.22.1 export hook ของ variant ด้วย (`useProductVariants`, `useVariants`/`useInfiniteVariants` — `hooks.d.ts`) แต่ไม่มี hook ราย inventory item; ใช้ `useProduct` เพราะได้ shipping profile ของ product และ inventory ของ variant ใน request เดียว |
| หน้าแก้แต่ละเงื่อนไข | route ของ dashboard 2.22.1: `/products/:id/variants/:variant_id/edit` (สวิตช์ manage inventory), `/products/:id/variants/:variant_id/manage-items` (inventory item), `/products/:id/shipping-profile`, `/inventory/:inventory_item_id/locations` (`app.js` route table) | **ลิงก์ไปหน้าของ Medusa** (กฎข้อ 43c) — ไม่สร้างฟอร์มแก้เอง |
| รายการเงื่อนไขใน modal/ลิงก์ | `FocusModal` (ใช้อยู่แล้ว), `Text` ของ `@medusajs/ui`; `Header` ของเรา (`components/common/header`, dashboard ไม่ export); `Link` ของ `react-router-dom` | ใช้ตามที่มี — ไม่สร้าง component ใหม่ |
| ข้อความไทย/อังกฤษ | i18n ของ Medusa admin + namespace `ecom-evoucher` (ADR-031, spec 10 กฎ 5 parity) | เพิ่ม key ใต้ `variantWidget.prerequisites.*` |
| ด่านจริงตอนสร้าง/นำเข้า | `validateEvoucherVariantStep`, `resolveEvoucherPoolInventoryStep` (ของเรา) | **คงเดิม** |

### Business rules (รอบ 47)
43. (EV-27 — admin; owner ตอบ Q15 = ข 2026-11-27) widget "Voucher pool" บนหน้า variant ตรวจเงื่อนไขเมื่อแอดมินกด "Create pool" จากข้อมูลของ Medusa แล้วแสดงรายการเงื่อนไข**แทนฟอร์ม**ถ้ายังไม่ครบ
    (หน้า variant ของสินค้าปกติจึงไม่มีกล่องเงื่อนไขแสดงค้าง):
    (a) โหลด `useProduct(variant.product_id, { fields }, { enabled: open, staleTime: 0 })` เมื่อเปิด FocusModal (แบบรายชื่อ partner เดิม) และได้ข้อมูลใหม่ทุกครั้งที่เปิด
        (แก้ในหน้า Medusa แล้วกลับมากดใหม่โดยไม่ reload ต้องเห็นผลล่าสุด — builder ยืนยันว่า `staleTime: 0` + `enabled` พอ หรือเรียก `refetch()` ตอนเปิด) โดย `fields` = `id,*shipping_profile,variants.id,variants.manage_inventory,variants.inventory_items.inventory_item_id,`
        `variants.inventory_items.required_quantity,variants.inventory_items.inventory.variants.id,variants.inventory_items.inventory.location_levels.location_id`
        (ไม่พึ่ง field ที่หน้า variant ของ dashboard โหลดให้ — เปลี่ยนได้เมื่อ bump) แล้วเลือก variant ตาม `variant.id`; ถ้า Admin API ไม่คืน path `inventory.variants` builder ตัดเงื่อนไข "ใช้ร่วม" ออกจาก (b) แล้วระบุใน PR (backend ยังกันด้วยกฎข้อ 14)
    (b) pure function `evoucherPoolPrerequisites(product, variantId)` (`src/admin/lib/evoucher-pool-prerequisites.ts`) คืนรายการ issue ที่ไม่ผ่าน เรียงตามลำดับคงที่นี้ แต่ละตัว `{ code, to }`:
        1. `manageInventory` — `manage_inventory !== true` → `to` = `/products/<product_id>/variants/<variant_id>/edit`
        2. `inventoryItem` — จำนวน inventory item ≠ 1 หรือ `required_quantity` ≠ 1 หรือ item นั้นมี variant อื่นใช้ร่วม (กฎข้อ 14) → `to` = `/products/<product_id>/variants/<variant_id>/manage-items`
        3. `shippingProfile` — `product.shipping_profile?.id` มีค่า (กฎข้อ 1/Q9; `null`/ไม่มี field = ผ่าน) → `to` = `/products/<product_id>/shipping-profile`
        4. `stockLocation` — ตรวจเฉพาะเมื่อข้อ 2 ผ่าน: `location_levels` ของ item นั้นมีจำนวน ≠ 1 (เงื่อนไขของ import `import-evoucher-codes.ts:80`) → `to` = `/inventory/<inventory_item_id>/locations`
        ทุกข้อผ่าน → `[]`; ไม่พบ `variantId` ใน `product.variants` → `null`
    (c) ปุ่ม "Create pool" (เพิ่ม `data-testid="evoucher-pool-create"` ผ่าน `props` ของ `Header`; ชื่อปุ่มคงเดิม) **กดได้เสมอ**เมื่อยังไม่มี pool (ตามเดิม: ซ่อนระหว่างโหลด/ล้มของรายการ pool;
        กันกดซ้ำ/`submitLocked` ของฟอร์มคงเดิม) — **ไม่มี**กล่องเงื่อนไขบนหน้า variant ก่อนกด; กดแล้ว FocusModal เปิด (heading `variantWidget.createTitle` คงเดิม — กฎ `admin-dialog-title`) แล้ว body แสดงอย่างใดอย่างหนึ่ง:
        1. ระหว่างโหลดเงื่อนไข → `evoucher-pool-prerequisites-loading` (ข้อความ `general.loading`) — ไม่มีฟอร์ม ไม่มีปุ่ม Save
        2. โหลดล้ม → `evoucher-pool-prerequisites-error` (ข้อความ `variantWidget.prerequisites.loadError` พร้อม `{{message}}`) **แทนฟอร์ม** ไม่มีปุ่ม Save — ไม่ให้สร้าง pool โดยไม่รู้ผลตรวจ; ปิดแล้วกดใหม่ = โหลดใหม่
        3. รายการไม่ว่าง → `evoucher-pool-prerequisites` **แทนฟอร์ม** ไม่มีปุ่ม Save: หัวข้อ `variantWidget.prerequisites.title` แล้วหนึ่งแถวต่อ issue
           `evoucher-pool-prereq-<code>` = ข้อความ `variantWidget.prerequisites.<code>` + ลิงก์ `evoucher-pool-prereq-<code>-link` (`to` ตาม (b), ข้อความ `variantWidget.prerequisites.fix`);
           คลิกลิงก์ → ปิด modal (`setOpen(false)`) แล้ว navigate — route ที่เป็นลูกของหน้า variant (`edit`, `manage-items`) จึงไม่ถูก modal บัง
        4. รายการว่าง → ฟอร์มเดิม (`data-testid="evoucher-pool-form"` ที่ `KeyboundForm`) + ปุ่ม Save; ฟอร์ม/single-flight/กฎข้อ 11 คงเดิม
        กรณี 1–3 ไม่มีทางยิง `POST /admin/evoucher/pools` (ไม่มีฟอร์มให้ submit — ⌘/Ctrl+Enter ก็ไม่ยิง)
    (d) มี pool แล้ว → widget คงเดิม (ปุ่ม "Manage codes" อย่างเดียว ไม่ตรวจ ไม่แสดงกล่อง) — การบอกเงื่อนไขตอนกดนำเข้าโค้ดบนหน้า pool ไม่ทำในรอบนี้ (Q16 = ก, owner 2026-11-27)
    (e) ข้อความทั้งหมดผ่าน `t()` ของ namespace `ecom-evoucher`: `en` เป็นถ้อยคำอังกฤษใหม่, `th` คำแปล (ชื่อฟิลด์/หน้าใช้คำเดียวกับคำแปลไทยของ Medusa เช่น "จัดการสินค้าคงคลัง", "โปรไฟล์การจัดส่ง", "จัดการสถานที่"); parity ตาม spec 10 กฎ 5
    (f) backend ไม่เปลี่ยน — diff ของ EV-27 ไม่แตะ `apps/backend/src/workflows/**` และ `apps/backend/src/api/**`; สร้าง pool ผ่าน API โดยไม่มี location level ยังได้ตามเดิม (UI เข้มกว่า backend เฉพาะข้อ 4 — เพื่อไม่ให้ import ล้มทีหลัง)
    (g) e2e เดิมที่เปิดฟอร์ม Create pool บน variant ที่สร้างด้วย `POST /admin/products` ธรรมดา (`manage_inventory` ค่าเริ่มต้น `false` → กดแล้วจะได้รายการเงื่อนไขแทนฟอร์ม) เปลี่ยนไปใช้ variant ที่ผ่านเงื่อนไขจาก helper ร่วม
        `createPoolReadyVariant` ใน `e2e/support/evoucher.ts` (แยกจากส่วนต้นของ `createVoucher` — ผู้ใช้ ≥ 2 ที่) ไม่ copy

### Acceptance criteria (รอบ 47)
- AC-57 (EV-27, กฎข้อ 43b) unit `src/admin/lib/__tests__/evoucher-pool-prerequisites.unit.spec.ts` (ไฟล์ใหม่ — ล้มบน develop เพราะไม่มี module): variant พร้อม (manage on, item เดียว qty 1 ไม่ใช้ร่วม, location 1, `shipping_profile: null`) → `[]`;
  `shipping_profile` ไม่มี field → `[]`; `manage_inventory=false` + 0 item → code `["manageInventory","inventoryItem"]` (ไม่มี `stockLocation`); 2 item → `["inventoryItem"]`; `required_quantity=2` → `["inventoryItem"]`;
  item มี variant อื่นใน `inventory.variants` → `["inventoryItem"]`; มี shipping profile → `["shippingProfile"]`; location 0 และ 2 → `["stockLocation"]`; ไม่ผ่านทุกข้อ → ลำดับ `manageInventory, inventoryItem, shippingProfile` ตามกฎ 43b;
  `to` ของแต่ละ code เท่ากับ path ในกฎ 43b ตรงตัว (แทน id จริงของ fixture); `variantId` ไม่พบใน `product.variants` → `null` (widget แสดงแบบกรณี 2 ของกฎ 43c — error แทนฟอร์ม)
- AC-58 (EV-27, กฎข้อ 43c–e) e2e admin `apps/storefront/e2e/evoucher-admin-pool-prerequisites.spec.ts` รันทั้ง `lng=th` (`ADMIN_UI_OPTIONS_TH`) และ `lng=en` (`ADMIN_UI_OPTIONS`); ค่าที่คาดสร้างจาก `adminText(lng, "ecom-evoucher", key)`;
  `th` ต้องตรง regex อักษรไทย, `en` ต้องไม่มีอักษรไทย; หาด้วย testid (ข้อยกเว้นเฉพาะ element ของหน้า Medusa ตาม ADR-018):
  (a) product ที่มี shipping profile Default + variant `manage_inventory=false` (สร้างผ่าน Admin API) → ก่อนกด: ไม่มี `evoucher-pool-prerequisites` บนหน้า และ `evoucher-pool-create` enabled;
      กดปุ่ม → ใน dialog เห็น `evoucher-pool-prerequisites` (หัวข้อ `prerequisites.title`) มี `evoucher-pool-prereq-manageInventory`, `-inventoryItem`, `-shippingProfile` ข้อความตรง key และไม่มี `-stockLocation`;
      ไม่มี `evoucher-pool-form` และไม่มีปุ่ม Save ใน dialog; กด ⌘/Ctrl+Enter → นับ `POST /admin/evoucher/pools` ตลอด test = 0; `href` ของลิงก์แต่ละตัวลงท้ายด้วย path ตามกฎ 43b;
      คลิก `evoucher-pool-prereq-manageInventory-link` → dialog ปิด และ URL เป็น `/app/products/<id>/variants/<variant_id>/edit`
  (b) แก้ผ่าน Admin API (manage inventory + inventory item, `shipping_profile_id: null`) **โดยไม่ reload** → กลับหน้า variant (ปิด drawer ของ Medusa / goto ภายใน SPA) แล้วกดปุ่มอีกครั้ง → รายการเหลือ `evoucher-pool-prereq-stockLocation` เท่านั้น ยังไม่มี `evoucher-pool-form`;
      ปิด dialog เพิ่ม location level ผ่าน API แล้วกดใหม่ → ไม่มี `evoucher-pool-prerequisites`, เห็น `evoucher-pool-form` + heading `variantWidget.createTitle` (แทน `{{title}}` ด้วยชื่อ variant — หาด้วย role + ชื่อภายใน dialog); กรอกแล้ว Save → POST 1 ครั้งและ 200
  (c) variant ที่มี pool แล้ว (`createVoucher`) → ไม่มี `evoucher-pool-prerequisites` และไม่มี `evoucher-pool-create` บนหน้า (regression กฎ 43d)
  (d) `GET /admin/products/:id` ถูก route mock ให้ตอบ 500 (mock เฉพาะ pathname `/admin/products/<id>` ตรงตัว — ไม่โดน `/admin/products/<id>/variants/...` ที่หน้า variant ใช้; ติดตั้งหลังหน้า variant โหลดครบ) → กดปุ่ม → `evoucher-pool-prerequisites-error` แสดงข้อความ `loadError` (`{{message}}` แทนแล้ว) ไม่มี `evoucher-pool-form` และ POST = 0;
      ยกเลิก mock ปิด dialog แล้วกดใหม่ → ได้ผลตรวจจริง (ไม่ค้าง error)
- AC-59 (EV-27, กฎข้อ 43f–g) regression: `git diff --name-only origin/develop...HEAD` ไม่มี path ใต้ `apps/backend/src/workflows/` หรือ `apps/backend/src/api/`;
  e2e ที่เปิด Create pool บนหน้า variant — `admin-form-pilot`, `admin-create-double-submit`, `admin-modal-return-focus`, `evoucher-admin-forms` — ผ่านโดย fixture ใช้ `createPoolReadyVariant`;
  e2e ที่เปิดหน้า variant ที่มี pool แล้ว (`admin-i18n-evoucher`) และ static ของ dialog title (`admin-dialog-title`) ผ่าน; static: `createPoolReadyVariant` ถูก import ใน ≥ 2 ไฟล์ (รวม `createVoucher`); unit parity/guard ของ spec 10 (AC-2, AC-5) ผ่านกับ key ใหม่

### แผนการทดสอบ (รอบ 47)
- unit: AC-57 (+ parity/guard ของ spec 10 ใน AC-59) · e2e admin: AC-58, AC-59 · integration: none (backend ไม่เปลี่ยน — test เดิมของ AC-11/กฎข้อ 14/import ต้องผ่านตาม CI)

### Tasks (รอบ 47)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| EV-27 | ☑ #602 — (admin UI) กด "Create pool" แล้วตรวจเงื่อนไข → ไม่ครบแสดงรายการไทย/อังกฤษพร้อมลิงก์ไปหน้า Medusa **แทนฟอร์ม** ไม่ยิง POST (กฎข้อ 43, Q15 = ข); qa | `src/admin/lib/evoucher-pool-prerequisites.ts` (ใหม่ + unit), `src/admin/widgets/variant-evoucher-pool.tsx`, `src/admin/i18n/json/{en,th}/ecom-evoucher.json`, `apps/storefront/e2e/evoucher-admin-pool-prerequisites.spec.ts` (ใหม่), `e2e/support/evoucher.ts` (`createPoolReadyVariant`), fixture ของ e2e ที่เปิด Create pool (กฎ 43g) | ~110 LOC + ~350 LOC test | AC-57, AC-58, AC-59 | ไม่มี (นอกจาก PR เอกสารนี้) | ∥ AI18N-N2 (spec 10 — คนละไฟล์ ยกเว้น `ecom-*.json` ถ้า N2 แตะ `ecom-evoucher.json` ตัวหลัง sync เก็บทั้งสองฝั่ง) |

## คำถามที่ยังเปิดอยู่
- ~~Q16~~ ตัดสินแล้ว (owner 2026-11-27): **(ก)** ไม่ทำตอนนี้ — คำถามเดิม: (รอบ 47 — ไม่บล็อก EV-27) pool ที่มีอยู่แล้วแต่ variant ไม่ผ่านเงื่อนไขของ import (เช่นลบ location level ทีหลัง หรือสร้าง pool ผ่าน API โดยไม่มี location) — import บนหน้า pool
  (`routes/evouchers/pools/[id]`) ยังได้ toast ข้อความอังกฤษของ backend (`import-evoucher-codes.ts:83`) หลังเลือกไฟล์:
  (ก) **[เลือก]** ไม่ทำตอนนี้ — EV-27 ทำให้ pool ที่สร้างผ่าน UI มี location ครบแล้ว เหลือเฉพาะกรณีแก้ทีหลัง/สร้างผ่าน API ซึ่งเกิดยาก
  (ข) task ใหม่ EV-28: ปุ่มนำเข้าโค้ดบนหน้า pool ตรวจเงื่อนไขเดียวกันเมื่อกด (ใช้ `evoucherPoolPrerequisites` ร่วม — ผู้ใช้ที่ 2) แล้วแสดงรายการแทนฟอร์ม import แบบ Q15 = ข (~60 LOC + ~120 LOC test)
- ~~Q15~~ ตัดสินแล้ว (owner 2026-11-27): **(ข)** ปุ่ม "Create pool" กดได้เสมอ (ยกเว้นระหว่างส่ง/โหลดตามกฎกันกดซ้ำเดิม); กดแล้วเงื่อนไขไม่ครบ → แสดงรายการเงื่อนไขพร้อมลิงก์ไปแก้
  **แทนฟอร์ม** และไม่ยิง request สร้าง pool; หน้า variant ของสินค้าปกติไม่มีกล่องเงื่อนไขค้าง — กฎข้อ 43c, AC-58;
  คำถามเดิม: กล่องเงื่อนไขขึ้นบน variant ทุกตัวที่ยังไม่มี pool รวมสินค้าปกติ (ก แสดงเสมอ + ปุ่ม disabled / ข แสดงเมื่อกดปุ่มแทนฟอร์ม)
- ~~Q14~~ ตัดสินแล้ว (owner 2026-11-10): **(ก)** — กฎข้อ 33c–e, AC-47, EV-17; คำถามเดิม (รอบ 27, EV-17 กฎข้อ 33) ป้องกัน stock เกินเมื่อยกเลิก fulfillment ของ code ที่ส่งมอบแล้วด้วยทางใด:
  (ก) **[เลือก]** หลังส่งอีเมลสำเร็จ (allocation และ resend) สร้าง shipment ของ fulfillment นั้นด้วย `createOrderShipmentWorkflow` แบบ `no_notification: true` (subscriber `shipment-created.ts:9` จึงไม่ส่งอีเมลจัดส่ง) → Medusa ไม่ยอมยกเลิก fulfillment ที่ shipped และจึงยกเลิก order นั้นไม่ได้
  — ตรงกับกฎข้อ 6 (code ส่งแล้ว admin คืนเงินเองโดยไม่ยกเลิก) และใช้กติกาของ Medusa ไม่ต้องปรับ inventory เอง; ข้อเสีย: order ผสมที่มี voucher ส่งแล้วยกเลิกทั้ง order ไม่ได้ ต้องคืนเงินบางส่วนแทน และ fulfillment ที่ยังไม่ได้ส่งอีเมล (code `allocated`) ยังยกเลิกได้ตามเดิม
  (ข) consumer ของ hook `cancelOrderFulfillmentWorkflow.hooks.orderFulfillmentCanceled` (`cancel-order-fulfillment.js:261`) ลด stock และ reservation ที่ Medusa เพิ่มคืนเท่าจำนวน code `delivered` ของ line ใน fulfillment นั้น
  — ข้อดี: ยกเลิกได้ตามเดิม; ข้อเสีย: เขียน logic inventory เองแก้ผลของ core (ทั้ง stock และ reservation ที่สร้างใหม่), hook มี handler ได้ตัวเดียว และต้องตรวจซ้ำทุกครั้งที่ bump
  (ค) คงไว้ (ยอมรับ stock เกิน + backorder แล้วให้ admin void/เติม code เอง)
- ~~Q13~~ ตัดสินแล้ว (owner 2026-11-09): **(ก)** ลบ shipping method ที่ค้างด้วย hook `refreshCartItemsWorkflow.hooks.beforeRefreshingPaymentCollection` ยอมรับการลบเงียบตามกฎข้อ 31b และแก้ท้าย AC-3 — ADR-021 accepted (บันทึกทางเลือก ข/ค และผลข้างเคียง)
- ~~Q12~~ ตัดสินแล้ว (owner 2026-11-09): **(ก)** ไม่มี order ลูกค้าจริง — ไม่ทำ backfill (กฎข้อ 31d)
- ~~Q1~~ ตัดสินแล้ว (owner 2026-11-09): ยืนยันค่าเริ่มต้น — PIN เป็น **optional** (code มีหรือไม่มี PIN ก็ได้ ตาม model เดิม) ไม่มี task;
  คำถามเดิม: พาร์ทเนอร์ให้ PIN มาพร้อม code หรือให้ code อย่างเดียว? (model รองรับทั้งสองแบบ)
- ~~Q2~~ ตัดสินแล้ว (owner 2026-11-09): ยืนยันค่าเริ่มต้น — วันหมดอายุ**ต่อ code** (คอลัมน์ใน CSV, optional) ไม่มี task;
  คำถามเดิม: วันหมดอายุต่อ code (ใน CSV) หรือต่อ batch?
- ~~Q3~~ ตัดสินแล้ว (owner 2026-11-09): ยืนยันค่าเริ่มต้น — code จาก order ที่คืนเงินแล้ว**ไม่นำกลับมาขาย** ไม่มี task;
  คำถามเดิม: admin ควรนำ code จาก order ที่คืนเงินแล้วกลับมาขายใหม่ได้หรือไม่?
- ~~Q4~~ ตัดสินแล้ว (owner, 2026-10-25): `expires_at` ที่เป็นวันที่ล้วน = ใช้ได้ถึงสิ้นวันนั้นตามเวลาไทย (AC-12)
- ~~Q5~~ ตัดสินแล้ว (owner 2026-10-26) แล้ว**กลับคำตัดสิน**ในวันเดียวกัน (รอบ 6): ~~voucher product ใช้ shipping profile Digital เสมอ~~ → ใช้
  `requires_shipping=false` ที่ inventory item + product **ไม่มี shipping profile เลย** และไม่บังคับ Digital method ฝั่ง backend เพราะ profile ใดก็ตามทำให้ line item
  `requires_shipping=true` เสมอใน Medusa 2.22.1 (ขัด AC-11) — กฎข้อ 1, AC-3, AC-11, EV-7, EV-10, EV-11
- ~~Q6~~ ตัดสินแล้ว (owner 2026-10-27): job รายวัน**เว้น code ใกล้หมดอายุไว้เท่าจำนวนที่ถูกจอง** (ไม่ใช่ void ทั้งหมด) — กฎข้อ 2/7 (ข้อยกเว้น), 12b, AC-5, AC-30, AC-30b, EV-12
- ~~Q7~~ ตัดสินแล้ว (owner 2026-10-27): ลบ pool → `requires_shipping=true` **เสมอ** ไม่จำค่าเดิม (ไม่เพิ่ม field) — กฎข้อ 15 ตามที่ EV-10 (#85) ทำแล้ว
- ~~Q8~~ ตัดสินแล้ว (owner 2026-10-26): อีเมล `evoucher.delivered` ส่ง**เสมอ**แม้ order ตั้ง `no_notification=true` (เป็นการส่งมอบสินค้า) — กฎข้อ 20
- ~~Q9~~ ตัดสินแล้ว (owner 2026-10-26): สร้าง pool ให้ variant ที่ product มี shipping profile ใดๆ → **400** ไม่มี pool (admin ต้องเอา profile ออกจาก product ก่อน)
  — กฎข้อ 1, AC-11
- ~~Q10~~ ตัดสินแล้ว (owner 2026-10-27): **(ก)** เก็บที่อยู่สำหรับใบกำกับภาษีแล้วใช้เป็น `shipping_address` ข้ามเฉพาะขั้นเลือกวิธีจัดส่ง — กฎข้อ 24, AC-37, EV-7c เริ่มได้;
  คำถามเดิม (รอบ 10, EV-7c): checkout digital-only ข้ามที่อยู่ทั้งหมดด้วยไหม — Medusa คำนวณ tax line ของ cart จากที่อยู่ (`shipping_address`) ถ้า cart ไม่มีที่อยู่เลย order จะไม่มี tax line
  (`tax_total = 0`) แม้ราคารวม VAT แล้ว → กระทบใบเสร็จ/ใบกำกับภาษีและรายงาน VAT ทางเลือก:
  (ก) **[แนะนำ]** เก็บที่อยู่สำหรับใบเสร็จ/ใบกำกับภาษี (ฟอร์ม billing เดิม) และใช้เป็น `shipping_address` เพื่อให้ Medusa คำนวณ VAT — ข้ามเฉพาะขั้นเลือกวิธีจัดส่ง;
  เหตุผล: VAT 7% ถูกบันทึกเป็น tax line เหมือนสินค้าอื่น (spec 01), ใช้ฟอร์มที่มีอยู่, ลูกค้าที่ต้องการใบกำกับภาษีเต็มรูปมีที่อยู่ครบ; ข้อเสีย: ลูกค้ากรอกที่อยู่ 1 ครั้งทั้งที่ไม่มีของส่ง
  (ข) ข้ามที่อยู่ทั้งหมด — checkout สั้นที่สุด แต่ order ของ voucher ไม่มี tax line (ต้องแยกคิด VAT นอกระบบ) และออกใบกำกับเต็มรูปไม่ได้
  (ค) เก็บเฉพาะชื่อ + ประเทศ (ไม่ต้องมีที่อยู่เต็ม) แล้วตั้ง `shipping_address.country_code = "th"` — ได้ tax line แต่ออกใบกำกับเต็มรูปไม่ได้
- ~~Q11~~ ตัดสินแล้ว (owner 2026-10-27): **คงเดิม** ไม่มี task; คำถามเดิม (รอบ 10, แจ้งจาก review #123 EV-12) pool ที่หลังรัน job `stocked < reserved` แต่**ไม่มี** code ถูก void/เว้น (เช่น code อายุยาวทั้งหมด แต่ stock ไม่พอ order ที่จอง) ไม่อยู่ในอีเมลสรุป
  expiry (ตรงกับกฎข้อ 12b(d)) — **ข้อเสนอ: คงเดิม** (ไม่มี task) เพราะสถานการณ์นี้ไม่ได้เกิดจาก expiry และ admin ได้อีเมล backordered ตอน capture ตามกฎข้อ 9/18 อยู่แล้ว;
  ถ้า owner ต้องการเตือนล่วงหน้า → task เล็กเพิ่มบรรทัดเตือนใน job เดิม
