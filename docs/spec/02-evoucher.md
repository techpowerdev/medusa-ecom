# 02 E-voucher — ขายต่อ voucher code ของพาร์ทเนอร์ ส่งมอบทางอีเมล

สถานะ: draft (ปรับปรุง 2026-10-25: voucher เป็น code ของพาร์ทเนอร์ ไม่ใช่ของเรา; ไม่มีการ redeem; รอบ 9 2026-10-27: Q6/Q7 ตัดสินแล้ว, EV-13; รอบ 10 2026-10-27: แตก EV-7 → EV-7a/7b/7c (builder หยุด), AC-6 ทดสอบได้, EV-N1, index ใหม่, EV-9 key เรียงรอง; owner ตัดสิน Q10 = (ก), Q11 คงเดิม)
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
| lock ระหว่าง allocation กับ resend | Locking module (Redis) + `acquireLockStep`/`releaseLockStep` | ใช้ตามเดิม (EV-5c, กฎข้อ 21) |
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
   `available` ที่ยังไม่หมดอายุ (`now() < expires_at < now() + 7 days`) เรียง `expires_at DESC` (ไกลสุดก่อน — code ที่ job เว้นไว้ตามกฎข้อ 12b หรือ code ที่เพิ่งเข้าช่วง 7 วัน
   ระหว่าง job สองรอบ) ก่อนจะ mark backordered (กฎข้อ 18)
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
    ของ Medusa คำนวณ VAT 7% เป็น tax line (builder ยืนยันกับ core-flows 2.22.1 ว่าการคำนวณภาษีของ cart อ่าน `shipping_address` — ถ้าอ่าน billing ได้ด้วยไม่ต้องตั้ง shipping)
    (c) หลัง complete redirect ไป `/<countryCode จาก URL ปัจจุบัน>/order/<id>/confirmed` (ไม่อ่าน country จาก shipping address)
    (d) cart ผสม (voucher + สินค้าจัดส่ง) ใช้ flow ปกติ — Medusa บังคับ shipping method ตาม profile ของ line ที่ต้องจัดส่งเอง
25. (รอบ 10, EV-9 — qa) รายการ code ที่เรียงตาม `created_at` (เช่น `GET /admin/evoucher/pools/:id/codes` และตารางใน admin) ใช้ `id` เป็น key เรียงรองเสมอ (`created_at`, `id`) —
    code จาก CSV เดียวกันมี `created_at` เท่ากัน ถ้าไม่มี key รอง การแบ่งหน้าอาจซ้ำ/หายระหว่างหน้า

## Acceptance criteria
- AC-1 Admin import CSV จำนวน 100 code (ซ้ำ 2 รายการ) → 98 `available`, inventory ของ variant +98,
  response รายงานว่าข้าม 2 รายการ
- AC-2 เมื่อมี voucher variant qty 2 ใน cart และชำระเงิน captured แล้ว 2 code จะกลายเป็น
  `delivered` พร้อม order id และลูกค้าได้รับอีเมล 1 ฉบับที่มีทั้ง 2 code, PIN,
  วิธีใช้ของพาร์ทเนอร์ และวันหมดอายุ
- AC-3 เมื่อ cart มีเฉพาะสินค้า voucher (product ไม่มี shipping profile, กฎข้อ 1) ทุก line มี `requires_shipping=false`, การ checkout ไม่ต้องกรอกที่อยู่
  และ complete cart ได้โดย `validate-shipping` ของ Medusa ไม่บังคับ shipping method (integration: complete cart ที่ไม่มี shipping method → order สำเร็จ);
  ยอดรวมมีค่าจัดส่ง ฿0; ถ้า storefront ใส่ method ต้องเป็น `type.code = "digital-delivery"` ไม่ใช่ Standard แม้ `GET /store/shipping-options?cart_id=`
  คืน Standard มาก่อน (กฎข้อ 8, e2e) — ไม่มีการบังคับฝั่ง backend ว่า voucher ได้เฉพาะ Digital method (ถ้าต้องการต้องเขียน ADR ก่อน)
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
EV-3 ∥ EV-2 หลัง EV-1; EV-5 ∥ EV-6 หลัง EV-2; EV-10 ∥ EV-4/EV-9 (EV-10 แตะ `void-evoucher-codes.ts`, `evoucher-pool.ts`, `utils/csv.ts`, migration script — ถ้า EV-9 แตะ
`evoucher-pool.ts` ร่วม ตัวที่ merge ทีหลัง rebase) และต้อง merge ก่อน release ที่มี EV-7 (backfill); EV-9 หลัง EV-6 (แก้ฟอร์มของ EV-6; ถ้า EV-6 ต้องใช้ link ก่อน ให้รวม link เข้า PR นั้นแทน); EV-5b หลัง EV-4 และ EV-6; EV-11 หลัง EV-4 (∥ EV-5b; แตะไฟล์ allocation เดียวกันได้ — ตัวที่ merge ทีหลัง rebase); EV-12 เริ่มได้ทันที (∥ EV-9/EV-13 — EV-12 แตะ job/workflow void + `claimCodesForOrder` ของ service + template สรุป; ไม่แตะ admin UI);
EV-13 หลัง EV-5b (#111) (∥ EV-12; ถ้า EV-9 แตะ widget order เดียวกัน ตัวที่ merge ทีหลัง rebase);
(รอบ 10) EV-7a เริ่มได้ทันที → EV-7b; EV-7c เริ่มได้ (Q10 = ก) ∥ EV-7a/EV-7b (คนละไฟล์: checkout vs PDP/account); EV-9 รวมกฎข้อ 25/AC-39 (ถ้า PR ของ EV-9 เปิดอยู่แล้ว แก้ใน PR นั้น); EV-N1 ∥ ทุกตัว (แตะ job/workflow expiry ของ EV-12 เท่านั้น);
release ที่มี EV-7c ต้องมี backfill ของ EV-10 แล้ว (☑)
EV-4 ส่งอีเมล backordered ตามกฎข้อ 9 (AC-17 ส่วน backordered); EV-8 ∥ EV-4/EV-5/EV-6 หลัง EV-3 (EV-8 ต้องไม่ขัดกับกลไก checkout digital ที่ EV-3
ส่งมอบ — ถ้า EV-3 ตั้ง `requires_shipping=false` ให้แล้ว ส่วนนั้นของ EV-8 เหลือเพียง test ของ AC-11)

## คำถามที่ยังเปิดอยู่
- Q1 พาร์ทเนอร์ให้ PIN มาพร้อม code หรือให้ code อย่างเดียว? (model รองรับทั้งสองแบบ)
- Q2 วันหมดอายุ: ต่อ code (ใน CSV) หรือต่อ batch? (ค่าเริ่มต้น: คอลัมน์ต่อ code, optional)
- Q3 admin ควรนำ code จาก order ที่คืนเงินแล้วกลับมาขายใหม่ได้หรือไม่? (ค่าเริ่มต้น: ไม่ได้)
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
