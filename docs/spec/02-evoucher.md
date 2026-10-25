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
  หากไม่มี code ว่าง (stock คลาดเคลื่อน): mark line item เป็น `backordered` ใน metadata, ส่งอีเมลหา
  admin, ไม่ทำให้ order ล้มเหลว
- Scheduled job รายวัน: code `available` ที่ `expires_at < now + 7 days` → `void`
  (reason `expiring`) และลด inventory; ส่งอีเมลสรุปหา admin อีเมล low-stock เมื่อ
  `available < low_stock_threshold`
- Admin `resendEvoucherEmailWorkflow(order_id)`
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
- Storefront: PDP แสดงพาร์ทเนอร์, วิธีใช้, "ส่งมอบทางอีเมล"; หน้า account "My vouchers"
  แสดง code + PIN (ปุ่ม copy), โลโก้พาร์ทเนอร์, วันหมดอายุ; checkout แบบ digital-only ตามเดิม

## Business rules
1. variant จะเป็น voucher ก็ต่อเมื่อมี `EvoucherPool`; `requires_shipping=false`,
   `manage_inventory=true` โดย inventory ต้องเท่ากับจำนวน code ที่ `available` เสมอ
2. จะ allocate code หลังจากชำระเงิน **captured** แล้วเท่านั้น โดยเลือก code ที่หมดอายุเร็วที่สุดก่อน
   และไม่เลือก code ที่จะหมดอายุภายใน 7 วัน
3. 1 code ต่อ 1 หน่วย; qty 3 → 3 code ในอีเมลเดียว
4. Code/PIN ถูกเข้ารหัสขณะจัดเก็บ (ระดับแอป, key จาก env); masked ในรายการ; การ reveal มี audit
5. **ไม่มีการ redeem ฝั่งเรา**; อีเมลระบุว่าใช้ที่ไหนและอย่างไรที่พาร์ทเนอร์
6. นโยบายคืนเงิน: code ที่ส่งมอบแล้วจะไม่คืนเงินอัตโนมัติ (เราเรียกคืน code ไม่ได้)
   admin อาจคืนเงินด้วยตนเองได้ โดย code ยังคงสถานะ `delivered` code ที่ allocate แล้วแต่ยังไม่ส่งมอบ
   บน order ที่ถูกยกเลิกจะถูกปล่อยกลับเป็น `available`
7. วันหมดอายุเป็นของพาร์ทเนอร์; เราแสดงให้เห็นและหยุดขาย code ก่อนหมดอายุ 7 วัน

## Acceptance criteria
- AC-1 Admin import CSV จำนวน 100 code (ซ้ำ 2 รายการ) → 98 `available`, inventory ของ variant +98,
  response รายงานว่าข้าม 2 รายการ
- AC-2 เมื่อมี voucher variant qty 2 ใน cart และชำระเงิน captured แล้ว 2 code จะกลายเป็น
  `delivered` พร้อม order id และลูกค้าได้รับอีเมล 1 ฉบับที่มีทั้ง 2 code, PIN,
  วิธีใช้ของพาร์ทเนอร์ และวันหมดอายุ
- AC-3 เมื่อ cart มีเฉพาะสินค้า voucher การ checkout ไม่ต้องกรอกที่อยู่; shipping method
  "Digital delivery" ฟรีถูกใช้อัตโนมัติ; ยอดรวมมีค่าจัดส่ง ฿0
- AC-4 เมื่อมี code `available` 1 รายการ และ order qty 1 สองรายการถูก capture พร้อมกัน → มีเพียง
  order เดียวที่ได้ code; อีก order ถูก flag เป็น backordered และ admin ได้รับอีเมล
- AC-5 code ที่จะหมดอายุภายใน < 7 วันจะไม่ถูก allocate; job รายวัน void code เหล่านั้นและ
  ลด inventory
- AC-6 หน้า "My vouchers" ของลูกค้าแสดงเฉพาะ code ของตนเอง พร้อมปุ่ม copy; ลูกค้าคนอื่นได้ 404
- AC-7 การรัน allocation workflow ซ้ำสำหรับ order เดิมจะไม่ allocate code เพิ่มและ
  ไม่ส่งอีเมลเพิ่ม
- AC-8 API รายการ code คืน code แบบ masked; endpoint reveal คืนค่าจริงและเขียน
  แถว audit (ใคร, เมื่อไร, code id)
- AC-9 จำนวน available ต่ำกว่า threshold → อีเมล low-stock 1 ฉบับต่อวันต่อ pool

## Non-functional
- การ allocate รันใน subscriber (worker) ไม่ใช่ใน request ของ checkout
- Import รองรับ 50k แถวภายใน < 60 วินาที (batched insert)
- Email template เป็นภาษาไทยและอังกฤษ; มีโลโก้พาร์ทเนอร์ + บล็อกวิธีใช้

## แผนการทดสอบ
- Unit: CSV parser, masking, expiry filter, encryption round-trip
- Integration (modules): การ allocate พร้อมกัน (AC-4), idempotency (AC-7)
- Integration (http): AC-1, AC-2, AC-5, AC-8, AC-9 โดย mock notification provider
- e2e: AC-3, AC-6

## Tasks
| ID | Task | Depends |
|----|------|---------|
| EV-1 | Module model (partner, pool, code) + encryption + link ไปยัง variant + migration + unit test | CORE-2 |
| EV-2 | Import workflow + ปรับ inventory + admin API สำหรับ partner/pool/import (AC-1, AC-8) | EV-1 |
| EV-3 | Fulfillment provider `digital` + seed shipping option digital-delivery | EV-1 |
| EV-4 | Allocate & deliver workflow + subscriber + email template (AC-2, AC-4, AC-7) | EV-2, EV-3, CORE-3 |
| EV-5 | Job รายวันสำหรับ expiry/void + low-stock; admin API สำหรับ void & resend (AC-5, AC-9) | EV-2 |
| EV-6 | Admin UI: route page (partner, pool, import, code แบบ masked/reveal) + variant widget + order tab | EV-2 |
| EV-7 | Storefront: บล็อกพาร์ทเนอร์บน PDP, checkout แบบ digital-only, My vouchers + e2e (AC-3, AC-6) | EV-4 |
EV-3 ∥ EV-2 หลัง EV-1; EV-5 ∥ EV-6 หลัง EV-2

## คำถามที่ยังเปิดอยู่
- Q1 พาร์ทเนอร์ให้ PIN มาพร้อม code หรือให้ code อย่างเดียว? (model รองรับทั้งสองแบบ)
- Q2 วันหมดอายุ: ต่อ code (ใน CSV) หรือต่อ batch? (ค่าเริ่มต้น: คอลัมน์ต่อ code, optional)
- Q3 admin ควรนำ code จาก order ที่คืนเงินแล้วกลับมาขายใหม่ได้หรือไม่? (ค่าเริ่มต้น: ไม่ได้)
