# 02 E-voucher — ขายต่อ voucher code ของพาร์ทเนอร์ ส่งมอบทางอีเมล

สถานะ: draft (ปรับปรุง 2026-10-25: voucher เป็น code ของพาร์ทเนอร์ ไม่ใช่ของเรา; ไม่มีการ redeem)
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
| Stock = จำนวน code ที่ยังไม่ขาย | Inventory module | **ใช้มัน**: การ import pool จะปรับ inventory level ของ variant; Medusa จอง/ตัด stock ตอนสั่งซื้อตามปกติ |
| Order, line items | Order module | ใช้ตามที่มี |
| ขั้นตอน "ส่งมอบ" | Fulfillment module + custom fulfillment provider `digital` | custom provider (ทันที) |
| ส่งอีเมล | Notification module | ใช้ตามที่มี, เพิ่ม template ใหม่ |
| Trigger หลังชำระเงิน | event `payment.captured` + subscriber | subscriber |
| Admin product UI | Admin widget บนหน้า product/variant | widget |
| Admin import UI | Admin route page + file upload (File module) | custom page |
| สินค้าที่ไม่ต้องจัดส่ง | `requires_shipping` ของ inventory item (override ระดับ variant) → line item `requires_shipping` | ใช้ตามที่มี; ตั้งค่าตอนสร้าง pool (EV-8) |

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
  (reason `expiring`) และลด inventory; ส่งอีเมลสรุปหา mailbox admin (กฎข้อ 9) อีเมล low-stock เมื่อ
  `available < low_stock_threshold`
- Admin `resendEvoucherEmailWorkflow(order_id)` (EV-5b): ส่งอีเมล `evoucher.delivered` ซ้ำไปที่อีเมลของ order ด้วย code ที่
  `delivered` หรือ `allocated` (ส่งอีเมลล้มตามกฎข้อ 17) ของ order นั้น — ไม่ allocate ใหม่; ส่งสำเร็จ → code `allocated` เป็น `delivered`;
  order ที่ไม่มี code `delivered`/`allocated` → 400 `NOT_ALLOWED`
- Admin `voidCodeWorkflow(code_id, reason)` สำหรับ code สถานะ `available` เท่านั้น (ปรับ inventory ด้วย)

## API
- Admin: CRUD `/admin/evoucher/partners`, CRUD `/admin/evoucher/pools`,
  `POST /admin/evoucher/pools/:id/import` (multipart CSV), `GET /admin/evoucher/pools/:id/codes?status=`,
  `POST /admin/evoucher/codes/:id/void`, `POST /admin/evoucher/orders/:id/resend`
  ค่าของ code จะถูกคืน **เฉพาะ** ที่ `GET .../codes/:id/reveal` (มี audit)
- Store (customer auth): `GET /store/customers/me/evouchers` → code ที่ส่งมอบแล้วของตนเอง
  (code, pin, พาร์ทเนอร์, วิธีใช้, วันหมดอายุ) ไม่มี endpoint สำหรับ redeem

## Admin UI / Storefront
- Admin route page "E-vouchers": พาร์ทเนอร์, pool (variant, จำนวน available / allocated /
  delivered / void, badge low-stock), import CSV พร้อมสรุปผล, รายการ code
  (masked), reveal พร้อม audit log
- Admin widget บนหน้า variant: "Voucher pool" (พาร์ทเนอร์, face value, stock จาก pool)
- Tab บนหน้า order ใน admin: code ที่ส่งมอบแล้ว (masked) + ส่งซ้ำ
- Storefront (ข้อความไทยตรงในโค้ด ADR-014; e2e หาด้วย test id): PDP แสดงพาร์ทเนอร์, วิธีใช้, "ส่งมอบทางอีเมล"; หน้า account
  "บัตรกำนัลของฉัน" (เมนู `vouchers-link`, การ์ด `voucher-card`, ปุ่มคัดลอก `voucher-copy-button`)
  แสดง code + PIN (ปุ่ม copy), โลโก้พาร์ทเนอร์, วันหมดอายุ; checkout แบบ digital-only ตามเดิม

## Business rules
1. variant จะเป็น voucher ก็ต่อเมื่อมี `EvoucherPool`; `requires_shipping=false`,
   `manage_inventory=true` โดย inventory ต้องเท่ากับจำนวน code ที่ `available` เสมอ; (owner 2026-10-26, ปิด Q5) product ของ voucher ต้องอยู่ใน
   shipping profile **Digital** (`shipping_profile.type = "digital"` ที่ EV-3 seed) เสมอ — สร้าง pool ให้ variant ที่ product อยู่ profile อื่น → 400 (EV-10)
   และ cart ที่มี voucher ต้องได้ shipping method Digital delivery (`type.code = "digital-delivery"`) เท่านั้น (EV-7 ตรวจ/บังคับ, AC-3)
2. จะ allocate code หลังจากชำระเงิน **captured** แล้วเท่านั้น โดยเลือก code ที่หมดอายุเร็วที่สุดก่อน
   และไม่เลือก code ที่จะหมดอายุภายใน 7 วัน
3. 1 code ต่อ 1 หน่วย; qty 3 → 3 code ในอีเมลเดียว
4. Code/PIN ถูกเข้ารหัสขณะจัดเก็บ (ระดับแอป, key จาก env); masked ในรายการ; การ reveal มี audit
5. **ไม่มีการ redeem ฝั่งเรา**; อีเมลระบุว่าใช้ที่ไหนและอย่างไรที่พาร์ทเนอร์
6. นโยบายคืนเงิน: code ที่ส่งมอบแล้วจะไม่คืนเงินอัตโนมัติ (เราเรียกคืน code ไม่ได้)
   admin อาจคืนเงินด้วยตนเองได้ โดย code ยังคงสถานะ `delivered` code ที่ allocate แล้วแต่ยังไม่ส่งมอบ
   บน order ที่ถูกยกเลิกจะถูกปล่อยกลับเป็น `available`
7. วันหมดอายุเป็นของพาร์ทเนอร์; เราแสดงให้เห็นและหยุดขาย code ก่อนหมดอายุ 7 วัน
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
    (กลไก PROMO-2) และไม่เปลี่ยนอะไร; job รายวันยัง void code ที่ใกล้หมดอายุทั้งหมด (ขายไม่ได้แล้ว) แต่ถ้าหลังลดแล้ว `stocked < reserved` ให้ระบุ
    pool นั้นในอีเมลสรุป expiry (กฎข้อ 9) — ดู Q6
13. (EV-10) `expires_at` ต้องเป็นวันที่มีจริง: ค่าที่ `Date` เลื่อนเดือน/ปีให้ (เช่น `2026-02-30`, `2026-04-31`, `2026-13-01`, รวมรูปแบบที่มีเวลา) ถือเป็น
    ค่าที่ parse ไม่ได้ (ทั้งไฟล์ล้มพร้อมเลขบรรทัด ตามพฤติกรรมเดิมของ EV-2) — ตรวจแบบ round-trip: ปี/เดือน/วันที่ parse ได้ต้องตรงกับข้อความ
14. (EV-10) voucher variant ต้องมี inventory item เดียว (`required_quantity = 1`) ที่ไม่มี variant อื่นใช้ร่วม — ไม่เช่นนั้นสร้าง pool ไม่ได้ (400) เพราะการตั้ง
    `requires_shipping=false` และการปรับ stock จะกระทบ variant อื่น
15. (EV-10) ลบ pool (เฉพาะ pool ว่างตาม EV-2) → ตั้ง `requires_shipping` ของ inventory item กลับเป็น `true` (ค่าเริ่มต้นของ Medusa) พร้อม compensation;
    pool ที่สร้างก่อน EV-8 (inventory item ยัง `requires_shipping=true`) ถูก backfill เป็น `false` ด้วย migration script (`src/migration-scripts/`,
    รันใน `db:migrate`, รันซ้ำได้) **ก่อน** release ที่มี EV-7 (checkout digital-only พึ่งค่านี้)
16. (EV-4, owner 2026-10-26) code/PIN ใน `notification.data` ของอีเมล `evoucher.delivered` เก็บเป็น **ciphertext** (รูปแบบเดียวกับ at-rest ของกฎข้อ 4)
    และถอดรหัสตอนส่งเท่านั้น (template/provider ถอดก่อน render) — ไม่มี plaintext ของ code/PIN ใน DB (ตาราง notification) หรือ log
17. (EV-4, owner 2026-10-26) ส่งอีเมล `evoucher.delivered` ล้ม → **คง code ไว้กับ order** (สถานะ `allocated`, ไม่คืน pool, ไม่ void) และส่งอีเมลแจ้ง
    `EVOUCHER_ADMIN_EMAIL` (กฎข้อ 9) ให้ admin ส่งซ้ำผ่าน resend (EV-5b) — resend ที่สำเร็จเปลี่ยน code `allocated` ของ order นั้นเป็น `delivered`;
    รัน allocation ซ้ำ (AC-7) ไม่ allocate code ใหม่ให้ line ที่มี code `allocated` แล้ว
18. (EV-4, owner 2026-10-26) **backordered ทั้งรายการ**: ถ้า code ที่ claim ได้ไม่ครบ quantity ของ line item → ปล่อย code ที่ claim แล้วของ line นั้นกลับเป็น
    `available` และ mark line ทั้ง line เป็น backordered (ไม่ส่งมอบบางส่วน) — line อื่นของ order ที่ครบยังส่งมอบตามปกติ

## Acceptance criteria
- AC-1 Admin import CSV จำนวน 100 code (ซ้ำ 2 รายการ) → 98 `available`, inventory ของ variant +98,
  response รายงานว่าข้าม 2 รายการ
- AC-2 เมื่อมี voucher variant qty 2 ใน cart และชำระเงิน captured แล้ว 2 code จะกลายเป็น
  `delivered` พร้อม order id และลูกค้าได้รับอีเมล 1 ฉบับที่มีทั้ง 2 code, PIN,
  วิธีใช้ของพาร์ทเนอร์ และวันหมดอายุ
- AC-3 เมื่อ cart มีเฉพาะสินค้า voucher การ checkout ไม่ต้องกรอกที่อยู่; shipping method
  "Digital delivery" ฟรีถูกใช้อัตโนมัติ; ยอดรวมมีค่าจัดส่ง ฿0 — แม้ `GET /store/shipping-options?cart_id=` คืน Standard มาก่อน
  Digital delivery ในรายการ cart ก็ต้องมี shipping method ที่ `type.code = "digital-delivery"` และไม่มี Standard (กฎข้อ 8); (EV-7, กฎข้อ 1) order ที่ได้มี
  shipping method เดียวคือ digital-delivery; `POST /store/carts/:id/shipping-methods` ด้วย option Standard บน cart ที่มีแต่ voucher → ไม่ใช่ 2xx หรือถ้า Medusa
  รับ → complete cart ไม่ผ่าน — builder ยืนยันกลไกของ Medusa (shipping profile ↔ option) ด้วย integration test ถ้าไม่มีกลไกใดกัน ให้หยุดและรายงาน (ไม่เขียน hook เอง
  โดยไม่มี ADR)
- AC-25 (EV-4, กฎข้อ 16) Given order ที่ได้รับ code แล้ว When อ่านแถว `notification` ของ `evoucher.delivered` จาก DB Then `data` ไม่มีค่า plaintext ของ code/PIN
  (เทียบกับค่าที่ถอดรหัสแล้ว) และ mock provider ได้รับ code/PIN ที่ถอดแล้วถูกต้อง (integration)
- AC-26 (EV-4, กฎข้อ 17) Given notification provider throw ตอนส่ง `evoucher.delivered` When allocation workflow ทำงาน Then code ของ order เป็น `allocated` (ไม่ใช่
  `available`/`delivered`), inventory ไม่เปลี่ยนจากหลัง allocate, มี notification แจ้ง `EVOUCHER_ADMIN_EMAIL` 1 รายการที่มี order id; รัน workflow ซ้ำ → ไม่มี code ใหม่
  ถูก allocate (integration, mock provider)
- AC-27 (EV-4, กฎข้อ 18) Given pool มี code `available` 1 รายการ When order มี voucher line qty 2 ถูก capture Then line นั้นเป็น backordered, code ที่ claim ได้กลับเป็น
  `available` (นับ `available` = 1 เท่าเดิม), ลูกค้าไม่ได้อีเมล `evoucher.delivered` ของ line นั้น และ admin ได้อีเมล backordered (integration)
- AC-28 (EV-5b, กฎข้อ 17) Given order ที่ code เป็น `allocated` เพราะส่งอีเมลล้ม When admin `POST /admin/evoucher/orders/:id/resend` แล้วส่งสำเร็จ Then 200 และ
  code เป็น `delivered` พร้อม `delivered_at` (integration http)
- AC-4 เมื่อมี code `available` 1 รายการ และ order qty 1 สองรายการถูก capture พร้อมกัน → มีเพียง
  order เดียวที่ได้ code; อีก order ถูก flag เป็น backordered และ admin ได้รับอีเมล
- AC-5 code ที่จะหมดอายุภายใน < 7 วันจะไม่ถูก allocate; job รายวัน void code เหล่านั้นและ
  ลด inventory
- AC-6 หน้าบัตรกำนัลของฉัน (`vouchers-link`) ของลูกค้าแสดงเฉพาะ code ของตนเอง (`voucher-card`) พร้อมปุ่มคัดลอก (`voucher-copy-button`);
  ลูกค้าคนอื่นได้ 404; heading ของหน้ามีอักษรไทย (ADR-014)
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
  ถ้าขั้นสร้าง pool ล้มหลังปรับ inventory item → `requires_shipping` กลับเป็นค่าเดิม (compensation); (EV-10, กฎข้อ 1 owner 2026-10-26) variant ที่ product
  อยู่ใน shipping profile ที่ไม่ใช่ `type=digital` → 400, ไม่มี pool และ inventory item ไม่เปลี่ยน; product ใน profile Digital → 201
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
- Email template เป็นภาษาไทยและอังกฤษ; มีโลโก้พาร์ทเนอร์ + บล็อกวิธีใช้

## แผนการทดสอบ
- Unit: CSV parser (รวม AC-12 วันที่ล้วน), masking, expiry filter, encryption round-trip
- Integration (modules): การ allocate พร้อมกัน (AC-4), idempotency (AC-7)
- Integration (http): AC-1, AC-2, AC-5, AC-8, AC-9, AC-10, AC-11, AC-13 โดย mock notification provider
- Integration (seed script): AC-14
- Integration (http/modules): AC-15, AC-16, AC-17, AC-18
- e2e admin: AC-19, AC-20
- e2e: AC-3, AC-6
- Unit: round-trip ของ `expires_at` (AC-22); Integration (http/migration script): AC-21, AC-22 (1 กรณี), AC-23, AC-24, AC-11 (ส่วน shipping profile)
- Integration: AC-25, AC-26, AC-27 (EV-4), AC-28 (EV-5b), AC-3 (ส่วน backend ของ EV-7)

## Tasks
| ID | Task | Depends |
|----|------|---------|
| EV-1 | Module model (partner, pool, code) + encryption + link ไปยัง variant + migration + unit test | CORE-2 |
| EV-2 | Import workflow + ปรับ inventory + admin API สำหรับ partner/pool/import (AC-1, AC-8) | EV-1 |
| EV-3 | Fulfillment provider `digital` + seed shipping option digital-delivery | EV-1 |
| EV-4 | Allocate & deliver workflow + subscriber + email template; อีเมล backordered ส่งหา `EVOUCHER_ADMIN_EMAIL` (กฎข้อ 9); **เพิ่ม 2026-10-26 (owner, review #67)**: ciphertext ใน `notification.data` (กฎข้อ 16), ส่งล้มคง `allocated` + แจ้ง admin (กฎข้อ 17), backordered ทั้ง line (กฎข้อ 18) (AC-2, AC-4, AC-7, AC-17 ส่วน backordered, AC-25..27) | EV-2, EV-3, CORE-3 |
| EV-5 | Job รายวันสำหรับ expiry/void + low-stock (ส่งหา `EVOUCHER_ADMIN_EMAIL` ตามกฎข้อ 9 — PR #43 ต้องปรับ); admin API สำหรับ void; field `void_reason` + migration (AC-5, AC-9, AC-10, AC-17 ส่วน low-stock/expiry) — resend ย้ายไป EV-5b (owner Q-B) | EV-2 |
| EV-5b | `resendEvoucherEmailWorkflow` + `POST /admin/evoucher/orders/:id/resend` + ปุ่ม resend บน order widget ของ EV-6 — รวม code `allocated` ที่ส่งอีเมลล้ม (กฎข้อ 17) (AC-18, AC-19, AC-28) | EV-4, EV-6 |
| EV-6 | Admin UI: route page (partner, pool, import, code แบบ masked/reveal) + variant widget + order tab | EV-2 |
| EV-7 | Storefront: บล็อกพาร์ทเนอร์บน PDP, checkout แบบ digital-only (เลือก option ด้วย `type.code` ไม่ใช่ตัวแรก, กฎข้อ 8; ตรวจ/บังคับว่า voucher ได้เฉพาะ Digital method ตามกฎข้อ 1 + integration test ส่วน backend ของ AC-3), หน้าบัตรกำนัลของฉัน + e2e (AC-3, AC-6); ข้อความไทยตรงในโค้ดและเพิ่ม path ใน ESLint rule ของ spec 01 กฎ CORE-4 ข้อ 4 (ADR-014) | EV-4 |
| EV-8 | Hardening จาก review EV-2: บังคับกฎข้อ 1 ตอนสร้าง pool (`requires_shipping=false` ที่ inventory item ผ่าน `updateInventoryItemsWorkflow` + compensation, ปฏิเสธ `manage_inventory=false`), `expires_at` แบบวันที่ล้วน, error เดิมไม่ถูกกลบเมื่อ compensation ล้ม; seed (`upgradeDigitalDelivery`) หา option Digital delivery ด้วย `type.code` แทนชื่อ (กฎข้อ 8) (AC-11, AC-12, AC-13, AC-14) | EV-2, EV-3 |
| EV-9 | follow-up review/QA (เล็ก): route pool list/detail select `low_stock_threshold` เสมอ (คำนวณ `low_stock` ถูกแม้ client ส่ง `fields` เอง) + module link `evoucher_code ↔ order` (`src/links/`) ที่ order tab (EV-6) และ resend (EV-5b) ใช้ + ฟอร์ม admin กัน double-submit และ `Label` ผูก `htmlFor`/`id` (กฎข้อ 11) (AC-15, AC-16, AC-20) | EV-2, EV-6 |
| EV-10 | follow-up review/QA รอบ 5 (เล็ก, backend): admin void ตรวจ reservation (กฎข้อ 12), `expires_at` วันที่มีจริงแบบ round-trip (กฎข้อ 13), ปฏิเสธ variant ที่ใช้ inventory item ร่วม/หลายตัว (กฎข้อ 14), ลบ pool คืน `requires_shipping` + migration script backfill pool ก่อน EV-8 (กฎข้อ 15); สร้าง pool ได้เฉพาะ product ใน shipping profile Digital (กฎข้อ 1, owner 2026-10-26) (AC-21..24, AC-11 ส่วน shipping profile) | EV-5, EV-8 |
EV-3 ∥ EV-2 หลัง EV-1; EV-5 ∥ EV-6 หลัง EV-2; EV-10 ∥ EV-4/EV-9 (EV-10 แตะ `void-evoucher-codes.ts`, `evoucher-pool.ts`, `utils/csv.ts`, migration script — ถ้า EV-9 แตะ
`evoucher-pool.ts` ร่วม ตัวที่ merge ทีหลัง rebase) และต้อง merge ก่อน release ที่มี EV-7 (backfill); EV-9 หลัง EV-6 (แก้ฟอร์มของ EV-6; ถ้า EV-6 ต้องใช้ link ก่อน ให้รวม link เข้า PR นั้นแทน); EV-5b หลัง EV-4 และ EV-6;
EV-4 ส่งอีเมล backordered ตามกฎข้อ 9 (AC-17 ส่วน backordered); EV-8 ∥ EV-4/EV-5/EV-6 หลัง EV-3 (EV-8 ต้องไม่ขัดกับกลไก checkout digital ที่ EV-3
ส่งมอบ — ถ้า EV-3 ตั้ง `requires_shipping=false` ให้แล้ว ส่วนนั้นของ EV-8 เหลือเพียง test ของ AC-11)

## คำถามที่ยังเปิดอยู่
- Q1 พาร์ทเนอร์ให้ PIN มาพร้อม code หรือให้ code อย่างเดียว? (model รองรับทั้งสองแบบ)
- Q2 วันหมดอายุ: ต่อ code (ใน CSV) หรือต่อ batch? (ค่าเริ่มต้น: คอลัมน์ต่อ code, optional)
- Q3 admin ควรนำ code จาก order ที่คืนเงินแล้วกลับมาขายใหม่ได้หรือไม่? (ค่าเริ่มต้น: ไม่ได้)
- ~~Q4~~ ตัดสินแล้ว (owner, 2026-10-25): `expires_at` ที่เป็นวันที่ล้วน = ใช้ได้ถึงสิ้นวันนั้นตามเวลาไทย (AC-12)
- ~~Q5~~ ตัดสินแล้ว (owner 2026-10-26): voucher product ใช้ shipping profile Digital เสมอ (+ `requires_shipping=false`); EV-10 บังคับตอนสร้าง pool (AC-11)
  และ EV-7 ตรวจ/บังคับว่า cart ของ voucher ได้เฉพาะ Digital delivery method (AC-3) — กฎข้อ 1
- Q6 (EV-10, กฎข้อ 12) job รายวันที่ void code ใกล้หมดอายุซึ่งอาจเป็น stock ที่ order จองไว้: คงพฤติกรรม "void ทั้งหมด + แจ้งในอีเมลสรุป" (ค่าเริ่มต้น —
  order นั้นจะได้ backordered + อีเมลตาม EV-4) หรือให้ job เว้น code ไว้เท่าจำนวนที่ถูกจอง (ขายของที่จะหมดอายุภายใน 7 วัน ขัดกฎข้อ 7)?
- Q7 (EV-10, กฎข้อ 15) ลบ pool แล้วตั้ง `requires_shipping=true` เสมอ (ค่าเริ่มต้น) หรือต้องจำค่าเดิมก่อนสร้าง pool (ต้องเพิ่ม field ใน model)?
