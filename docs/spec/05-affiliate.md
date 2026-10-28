# 05 Affiliate — ค่าคอมมิชชันแบบมีช่วงเวลากำหนด

สถานะ: in-progress (AF-1 = PR #11; รอบ 7 2026-10-26: กฎ 19 แก้, กฎ 27–28, AC-28..31; รอบ 9 2026-10-27: payouts/paging ของ portal, กฎ 29–30, AC-32..36, AF-7b/AF-10/AF-N1;
รอบ 11 2026-10-27: admin UI แบบเขียนได้ AF-12a/b/c (owner), นิยาม AF-8a/8b/8c, `has_payout_info` AF-13, ชื่อ affiliate ใน admin AF-14 (owner Q17), กฎ 33–38, AC-39..45)
เป้าหมาย (เจ้าของ): โปรแกรม affiliate ที่เปิดค่าคอมมิชชันเป็น **ช่วงเวลา** (แบบแคมเปญ
เหมือน affiliate "ปักหมุดสินค้า" ของ TikTok/Shopee) ไม่ใช่เปิดถาวร ร้านค้าเดียว ไม่ใช่ marketplace
การตัดสินใจ: custom module `affiliate` (ADR-005, accepted 2026-10-25) การระบุที่มา (attribution) ผ่านลิงก์ติดตาม → cookie →
cart metadata การจ่ายเงิน (โอนธนาคาร) ทำแบบ **manual** โดย admin; ระบบของเราสร้าง ledger ให้
ความต้องการของเจ้าของ: affiliate ต้อง **เห็นว่าสินค้าใดได้ค่าคอมมิชชันตอนนี้หรือเร็ว ๆ นี้** และ
**แชร์** สินค้าเหล่านั้นได้ (ลิงก์รายสินค้า) — ประสบการณ์แบบ "product showcase" ของ TikTok/Shopee
นอกขอบเขต: การจ่ายเงินอัตโนมัติ, โครงสร้างหลายชั้น/referral tree, เครื่องมือทำคอนเทนต์, การปักหมุด
หน้าร้านส่วนตัว (v2), การเปลี่ยนอีเมลของ affiliate (v1)

## สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | วิธีใช้ |
|------|-----------------|-----|
| ตัวตนและการ login ของ affiliate | Auth module **custom actor type `affiliate`** (pattern "custom actor type" ที่ Medusa มีเอกสารรองรับ: `authenticate("affiliate", …)`, `/auth/affiliate/emailpass`) | ใช้ตามเดิม; affiliate ไม่ใช่ customer |
| ผูก auth identity กับ actor | `setAuthAppMetadataStep` (core-flows) | ใช้ตามเดิมใน `createAffiliateAccountWorkflow` |
| Orders, ยอดรวม, refunds | Order module + events | subscribe |
| ยอด line item ไม่รวมภาษี/หลังส่วนลด | Order line item totals (`subtotal`, `discount_subtotal`) | ใช้ตามเดิม |
| คณิตศาสตร์เงิน | `MathBN` / `bigNumber` | ใช้ตามเดิม |
| หน้า admin | Admin UI routes/widgets | custom page |
| ส่วนลดเฉพาะ affiliate สำหรับผู้ซื้อ (ไม่บังคับ) | Promotion module (code) | link แบบไม่บังคับ |
| แปลงขอบเขตโปรแกรม → รายการสินค้าพร้อมราคา/รูป | Product module + Query (`useQueryGraphStep`) | ใช้ตามเดิม |
| lock ข้าม request ของ payout | Locking module (Redis) + `acquireLockStep`/`releaseLockStep` | ใช้ตามเดิม: key `affiliate-payout:<affiliate_id>` ทั้ง create และ cancel (กฎ 25); key `affiliate-attribution:<order_id>` ระหว่าง attribution กับ reversal จาก cancel (กฎ 27) |
| สถานะ order / ยอด refund | Order module (`order.status`, payment collection ของ order) | ใช้ตามเดิม อ่านด้วย `query.graph` (กฎ 27, 28) |
| ปุ่มยืนยันใน admin | `usePrompt` ของ `@medusajs/ui` | ใช้ตามเดิม (AF-6) |
| ฟอร์ม/ตาราง/แจ้งเตือนใน admin | `FocusModal`, `Drawer`, `Select`, `DatePicker`, `toast` ของ `@medusajs/ui` + `sdk`/react-query ที่ admin extension ใช้ | ใช้ตามเดิม (AF-12a/b/c) |
| รายการ collection/category ให้เลือกใน scope | `GET /admin/collections`, `GET /admin/product-categories` ของ Medusa | ใช้ตามเดิม (AF-12a) ไม่สร้าง route ใหม่ |
| CORS | Medusa ใส่ให้เฉพาะ `/store`, `/admin`, `/auth` | ไม่ใช้สำหรับ `/affiliate/*` — portal เรียกจาก server side (กฎ 17) |

## Data model (module `affiliate`)
```
Affiliate                      // separate actor; may share an email with a customer, no link required
  id, email (unique, from auth identity), name, code (unique slug), status: "pending"|"active"|"suspended" (default pending),
  payout_info?: json (never returned by portal API), created_at
  // auth identity: Auth module `auth_identity.app_metadata.affiliate_id`

AffiliateProgram          // a commission window [starts_at, ends_at)
  id, name, starts_at, ends_at,
  status: "draft"|"published"|"ended",   // published = visible to affiliates; "active" / "upcoming" are derived from the window
  announce_text?: text,                       // shown on the portal before start ("coming soon")
  commission_type: "percentage" (v1; fixed types deferred), commission_value,
  scope: { all: bool, variant_ids?: [], collection_ids?: [], category_ids?: [] },
  attribution_window_days: int (default 7), cap_per_order?: bigNumber (major units),
  hold_days: int (default 14)

AffiliateAttribution
  id, order_id (unique), affiliate_id, program_id?, attributed_at
  // program_id = null when no active program covered the order time (AC-2)

CommissionEntry           // ledger, append-only
  id, affiliate_id, program_id, order_id, line_item_id?, amount: bigNumber (major units), currency,
  status: "pending"|"approved"|"reversed"|"paid", reason?, created_at, matures_at?
  // index (affiliate_id, status, created_at)
  // unique (order_id, line_item_id) WHERE status='pending'  -- does NOT cover line_item_id NULL
  // AF-4 adds index (status, matures_at) for the maturity job

Payout
  id, affiliate_id, amount, currency, period_from, period_to (timestamptz), status: "draft"|"paid",
  paid_at?, reference?, entry_ids[]
```
หมายเหตุ data model:
- `AffiliateAttribution.program_id` เป็น nullable เพราะ AC-2 ต้องบันทึกว่า order นี้มาจาก affiliate คนไหน
  แม้ไม่มีโปรแกรม active ณ เวลาสั่งซื้อ (ใช้ในรายงาน/ป้องกันการ attribute ซ้ำ) แต่จะไม่มี entry
- `CommissionEntry.matures_at` เป็น nullable: มีค่าเฉพาะ entry ที่สร้างเป็น `pending`
  (`= created_at + hold_days`) และคงค่าเดิมเมื่อเปลี่ยนเป็น `approved`/`paid`; entry `reversed` มี `matures_at = null`
  (ไม่ผ่าน maturity job)

## Workflows
- `createAffiliateAccountWorkflow(authIdentityId, name, code)` (AF-1, เสร็จแล้ว): อ่านอีเมลจาก auth identity →
  สร้าง `Affiliate` (`pending`) → `setAuthAppMetadataStep(actorType "affiliate")` compensation: ลบ affiliate ที่สร้าง
- `trackClickWorkflow(code, path)` (store, public): หา affiliate → ตั้ง signed cookie
  `aff=<signed token>` (สูงสุด 30 วัน แต่ช่วงเวลาของโปรแกรมเป็นตัวกำหนด) การบันทึก click เลื่อนไป v2
- Cart hook: เมื่อสร้าง/อัปเดต cart ใน storefront หากมี cookie → ตั้ง cart
  `metadata.affiliate_token = <signed token>` (HMAC-SHA256 ของ `affiliate_id|clicked_at`
  ด้วย secret ฝั่ง server; storefront เพียงคัดลอกค่า cookie ไม่เคยสร้างเอง)
  Cart metadata เขียนได้จากฝั่ง client ผ่าน Store API ดังนั้น token เป็น input เดียวที่เชื่อถือได้
- Subscriber `order.placed` → workflow attribution: ตรวจสอบลายเซ็นของ `affiliate_token` (ปฏิเสธหากไม่ถูกต้อง/หมดอายุ)
  และ attribution window ตามกฎ 24 (เวลาอ้างอิง = `order.created_at` ไม่ใช่เวลาที่ subscriber รัน) และ affiliate ยัง active → ถ้ามี attribution ของ
  order นี้อยู่แล้ว **หยุด** (กฎ 15) → หาโปรแกรมที่ active ณ `order.created_at` → สร้าง `AffiliateAttribution` (`program_id` = โปรแกรมนั้น หรือ null)
  → ถ้ามีโปรแกรมและไม่ใช่การซื้อเอง (กฎ 12) คำนวณ entry ต่อ line item ที่เข้าเกณฑ์
  (ขอบเขตโปรแกรม ∩ รายการสินค้าใน order; เรียง `order.items` ตามกฎ 26 ก่อนแจก cap) → insert `CommissionEntry` status `pending`,
  `matures_at = now + hold_days`; token ไม่ถูกต้อง/หมดอายุ หรือ affiliate ไม่ active → ไม่สร้างอะไรและ log ระดับ info (ลายเซ็นผิด = warn ตาม AC-11)
- Subscriber เมื่อ refund/cancel/return: insert entry แบบ `reversed` สำหรับยอดที่ได้รับผลกระทบตามกฎ 28
  (ไม่แก้ไข entry เดิม; ledger เป็น append-only); reversal จาก cancel ถือ lock `affiliate-attribution:<order_id>` เดียวกับ attribution (กฎ 27)
- Scheduled job รายวัน: entry `pending` ที่ `matures_at <= now` และไม่มี reversal → `approved`
- `createPayoutWorkflow(affiliate, period)` admin: เลือก entry ตามกฎ 19 → Payout draft;
  `markPayoutPaid` → entry เป็น `paid` (compensation คืน `paid → approved`, กฎ 21)
- `cancelPayoutWorkflow(payout_id)` admin (AF-9): เฉพาะ payout `draft` → ลบ payout (soft-delete) entry ใน `entry_ids` กลับไปเลือกได้
  ในรอบถัดไป (สถานะ entry ไม่เปลี่ยน เพราะ draft ไม่แตะ entry); payout `paid` → 400 `NOT_ALLOWED`;
  (AF-9b, กฎ 25) คง lock `affiliate-payout-paid:<payout_id>` เดิมและเพิ่ม `affiliate-payout:<affiliate_id>` ตัวเดียวกับ `createPayoutWorkflow` ตามลำดับตายตัว
  ตลอด workflow (`acquireLockStep`/`releaseLockStep`)

## API
- Store (public): `GET /store/affiliate/r/:code?to=/path` → ตั้ง cookie, 302 ไปยัง path
- Affiliate portal (actor `affiliate`, `authenticate("affiliate", ["session","bearer"])`):
  `POST /affiliate/register` (หลัง `/auth/affiliate/emailpass/register`; `allowUnregistered: true`;
  body = `{ name, code }` เท่านั้น; สร้าง affiliate สถานะ `pending` และตั้ง `app_metadata.affiliate_id`;
  ถ้า token มี `actor_id` แล้ว → 400), `GET /affiliate/me`,
  `GET /affiliate/me/programs?limit&offset` (โปรแกรม published ที่ active/upcoming; paging: `limit` ≤ 100 ค่าเริ่มต้น 50, เกิน 100 → 400; response มี `count`, `limit`, `offset`),
  `GET /affiliate/me/earnings?from&to`,
  `GET /affiliate/me/payouts?limit&offset` (owner 2026-10-27 เก็บ route ที่ AF-7 #110 ทำไว้): payout ของตัวเองเท่านั้น **อ่านอย่างเดียว**, field allow-list ตามชื่อใน model
  `payout.ts`: `id, affiliate_id, amount, currency, period_from, period_to, status, paid_at, created_at` — **ไม่ส่ง `entry_ids`**; **ไม่ส่ง `reference`** (owner ตัดสิน
  2026-10-27 — #110 ยังส่งอยู่ การตัดออกพร้อม test เป็นขอบเขตของ **AF-7b**); paging เหมือน programs (`limit` ≤ 100 ค่าเริ่มต้น 50); เรียง `created_at` ใหม่สุดก่อน;
  สิทธิ์ตาม Q6 (`active`, `suspended` อ่านได้; `pending` → 403)
  `GET /affiliate/products?status=active|upcoming&page=` → สินค้าในโปรแกรมที่ published **หนึ่งรายการต่อสินค้า** (กฎ 29)
  (สินค้า, ราคา variant, รูป, % ค่าคอมมิชชัน, ชื่อโปรแกรม, starts_at/ends_at,
  `share_url` = `{storefront}/r/{code}?to=/products/{handle}`) เรียงตาม starts_at
  Login ผ่าน `/auth/affiliate/emailpass`
  route `/store/*` ของ customer ไม่ถูกแก้ไข; ไม่จำเป็นต้องเป็น customer
  Response ของ portal ใช้ field ของ affiliate: `id, email, name, code, status, created_at` (ไม่มี `payout_info`); (รอบ 11, AF-13) `GET /affiliate/me` เพิ่ม
  `has_payout_info: boolean` ตาม Q5 (กฎ 34)
- Admin: CRUD โปรแกรม; รายการ affiliate/อนุมัติ/ระงับ; `GET /admin/affiliate/entries`;
  สร้าง payout/ทำเครื่องหมายว่าจ่ายแล้ว; `GET /admin/affiliate/reports/summary`

## Admin UI / Storefront
- Admin: route page "Affiliate" → Programs (รายการพร้อมวันที่), Affiliates, Ledger, Payouts — แถว payout `draft` มีปุ่มยกเลิก
  (`affiliate-payout-cancel`, ยืนยันด้วย `usePrompt` ของ `@medusajs/ui`, กันกดซ้ำ) เรียก route ยกเลิกของ AF-9; payout `paid` ไม่มีปุ่ม (AF-6)
  — (รอบ 11, owner 2026-10-27: **admin UI แบบเขียนได้อยู่ใน v1**) สร้าง/แก้/ลบโปรแกรม (AF-12a), อนุมัติ/ระงับ affiliate + ข้อมูลรับเงิน (AF-12b), สร้าง payout + mark paid (AF-12c)
  ผ่าน admin API ของ AF-5 เดิม ไม่แก้ backend (กฎ 37)
- Storefront: portal `/affiliate/*` ที่มี login/register ของตัวเอง (affiliate session แยกจาก
  customer session):
  (ข้อความไทยตรงในโค้ด ADR-014; e2e หาด้วย test id)
  - **Products** (หน้าแรก): สองแท็บ "ได้ค่าคอมมิชชันตอนนี้" (`affiliate-tab-earning`) / "เร็วๆ นี้" (`affiliate-tab-upcoming`);
    แต่ละการ์ดแสดงรูป, ชื่อ, ราคา, % ค่าคอมมิชชัน และยอดประมาณการเป็น ฿ ที่ราคาปัจจุบัน, วันที่ของโปรแกรม (นับถอยหลังถึง
    วันเริ่มสำหรับ upcoming) และปุ่ม **แชร์** (`affiliate-share-button`) (คัดลอกลิงก์; ใช้ Web Share เมื่อ browser รองรับ
    โดยมีการคัดลอกเป็น fallback) สินค้า upcoming แชร์ล่วงหน้าได้ — ลิงก์ใช้งานได้
    ทันทีและเริ่มได้ค่าคอมมิชชันเมื่อช่วงเวลาเปิด
  - Programs, Earnings (pending/approved/paid), Payouts, Profile (code, ลิงก์เริ่มต้น) — (รอบ 11) ส่งมอบใน AF-8b ตามกฎ 33
  หน้า landing สาธารณะผ่าน `/r/<code>`

## Business rules
1. ค่าคอมมิชชันเกิดขึ้น **เฉพาะ** เมื่อ order ถูกสั่งภายในช่วงเวลาของโปรแกรมที่ active และ
   ภายใน attribution window ของ affiliate นับจากการ click ไม่มีโปรแกรม active → ไม่มีค่าคอมมิชชัน
   แม้ cookie จะยังใช้ได้ (แต่ยังบันทึก attribution ด้วย `program_id = null`)
2. ใช้ last-click attribution cookie จะถูกเขียนทับเมื่อมีการ click จาก affiliate รายใหม่กว่า
3. ฐานคำนวณค่าคอมมิชชัน = ยอดที่ **ชำระจริง** ของ line item หลังหักส่วนลด ไม่รวมค่าจัดส่งและภาษี
   (`subtotal − discount_subtotal` ของ line item)
4. บังคับใช้ cap ต่อ order ตอนสร้าง entry วิธีแจก cap ให้แต่ละ line ดู Q3 (owner เลือกตามลำดับ line item)
5. Entry เป็น append-only: ห้ามลบ (ห้ามใช้ `deleteCommissionEntries`/`softDeleteCommissionEntries` ใน workflow ใด)
   และห้ามแก้ `amount`/`order_id`/`line_item_id`/`program_id`; เปลี่ยนได้เฉพาะ `status` ไปข้างหน้า
   `pending → approved → paid` การกลับรายการ (reversal) เป็น entry ติดลบแยกต่างหาก status `reversed`
6. `hold_days` ป้องกันช่วงเวลาที่อาจมี refund; entry บวกที่จ่ายได้มีเฉพาะ `approved` (entry `reversed` ถูกหักใน payout ตามกฎ 19)
7. Affiliate ต้องเป็น `active` ทั้งตอน click และตอนสั่งซื้อ
8. PII: `payout_info` **ไม่ถูกส่งออก** ใน portal API เลย (AF-1 ใช้ allow-list field); ค่าเต็มดูได้เฉพาะ admin
   (การแสดงแบบ mask ในหน้า Profile ดู Q5)
9. การมองเห็น: เฉพาะโปรแกรมที่ `published` เท่านั้นที่แสดงบน portal; `active` = อยู่ในช่วงเวลา,
   `upcoming` = `starts_at > now` โปรแกรม draft จะไม่แสดง
10. ช่วงเวลาโปรแกรมเป็น `[starts_at, ends_at)`: active เมื่อ `status = published` และ `starts_at ≤ t < ends_at`
    โปรแกรม `ended` (admin ปิดก่อนกำหนด) **ไม่ active** แม้ `t` ยังอยู่ในช่วง และไม่แสดงบน portal
    ถ้ามีหลายโปรแกรม active พร้อมกัน → ดู Q7
11. การปัดเศษ: ค่าคอมต่อ line = `base × commission_value / 100` ปัด 2 ตำแหน่งแบบ half-up **ก่อน** แล้วจึงหัก cap;
    line ที่ได้ 0 ไม่สร้าง entry
12. การซื้อเอง: อีเมลของ order เทียบกับ `Affiliate.email` แบบ trim + lowercase ถ้าตรงกัน → ไม่มี entry
13. `Affiliate.email` มาจาก auth identity (emailpass `entity_id`) ตอน register เท่านั้น — `POST /affiliate/register`
    ไม่รับ `email` ใน body (field ที่ไม่รู้จักถูกตัดทิ้งโดย validator) เพื่อกันการปลอมอีเมลหลบกฎ 12
14. `code` เลือกเองตอน register: slug ตัวพิมพ์เล็ก `^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$` (3–32 ตัว) และ unique
    (ไม่นับแถวที่ soft-delete) การเปลี่ยนภายหลังและคำสงวน ดู Q4
15. Idempotency ของ attribution (AC-10) อิงจาก unique `order_id` ของ `AffiliateAttribution`: workflow ตรวจ/สร้าง
    attribution ก่อนสร้าง entry และหยุดถ้ามีอยู่แล้ว (unique ของ entry ที่ `status='pending'` ไม่พอ
    เพราะ Postgres ถือว่า `line_item_id` NULL ไม่ซ้ำกัน) การสร้าง attribution + entries ต้องอยู่ใน workflow เดียว
    มี compensation ลบ attribution/entries ของรอบที่ล้มเหลว (เป็นข้อยกเว้นหนึ่งของกฎ 5 — ยังไม่ commit; อีกข้อคือกฎ 21)
16. ขอบเขต (scope) = union ของ `variant_ids` ∪ `collection_ids` ∪ `category_ids`; `all = true` คลุมทุกสินค้า
    การนับ category ลูก ดู Q2; AF-3 (คำนวณ) และ AF-7 (`/affiliate/products`) ต้องใช้กฎเดียวกัน
17. Portal ใน storefront เรียก `/affiliate/*` จาก **server side ของ Next** (server component/route handler
    เก็บ token ใน httpOnly cookie) จึงไม่ต้องตั้ง CORS ให้ `/affiliate/*`; ถ้าภายหลังต้องเรียกจาก browser ตรง → ADR ก่อน
18. ทุก route ใต้ `/affiliate/*` ต้องผ่าน `authenticate("affiliate", ["session","bearer"])` ยกเว้น `/affiliate/register`
    ที่ใช้ `allowUnregistered: true` (ระวัง: middleware ของ matcher ที่ซ้อนกันทำงานทั้งคู่ — ห้ามใช้ `/affiliate/*`
    แบบไม่มี allowUnregistered คลุม register) สิทธิ์ตามสถานะ affiliate ดู Q6 (ตอนนี้ `/affiliate/me` เปิดทุกสถานะ)
19. (AF-5, แก้ 2026-10-26 owner) การเลือก entry ของ payout: entry ของ affiliate นั้นที่ `created_at < period_to`
    และยังไม่อยู่ใน `entry_ids` ของ payout ใด และเป็น (a) `status = approved` หรือ (b) `status = reversed` **เฉพาะเมื่อ entry ต้นทางของ line เดียวกัน**
    (`order_id` + `line_item_id` เดียวกัน, status ไม่ใช่ `reversed`) เป็น `approved` หรือ `paid` แล้ว — reversed ที่ต้นทางยัง `pending` **ไม่เข้า payout**
    (หักล้างกับ pending ของตัวเอง; ถ้าต้นทางถูก approve ภายหลังตาม Q8 reversed นั้นจึงเข้า payout รอบถัดไป) — **ไม่** ตัดด้วย `period_from`
    (`period_from` เป็นเพียงป้ายของรอบ) เพื่อให้ยอดที่ยกมาจากรอบก่อนตาม Q8 ถูกรวมในรอบถัดไป; filter ทำใน DB (AF-9) และ `created_at < period_to` ใช้กับ reversed ด้วย
20. (AF-5, ตามโค้ด PR #35) สถานะโปรแกรมเรียงเป็น `draft < published < ended` และเปลี่ยนได้เฉพาะไปข้างหน้าหรือคงเดิม:
    `draft → published`, `published → ended` และ **`draft → ended` ตรงได้** (ข้ามขั้น); ย้อนกลับ (เช่น `ended → published`,
    `published → draft`) → 400 `NOT_ALLOWED`; ตั้งค่าเดิมซ้ำไม่ error; ตอนสร้างตั้งได้แค่ `draft`/`published` (`ended` ได้ผ่าน update เท่านั้น)
    ลบ (soft-delete) โปรแกรมได้เฉพาะ `draft` มิฉะนั้น 400 `NOT_ALLOWED`
21. (AF-5) compensation ของ `markPayoutPaid` ที่คืนสถานะ entry `paid → approved` เมื่อ workflow ล้ม (ยังไม่ commit)
    เป็นข้อยกเว้นของกฎ 5 (เช่นเดียวกับ compensation ของกฎ 15)
22. (review AF-2 #66) `AFFILIATE_TOKEN_SECRET` ต้องมีใน production: backend ที่ `NODE_ENV=production` และไม่มีค่านี้ต้อง **throw ตอนบูต** (แบบเดียวกับ
    guard ใน `src/lib/infra-modules.ts`, ADR-010) ไม่ใช่ log warning ทุก click แล้ว attribution หายเงียบ; นอก production เตือน**ครั้งเดียว**ตอนบูต —
    ส่งมอบใน OPS-7 (spec 07 AC-13)
23. (review AF-2 #66, last click ตามกฎ 2) cookie `aff` ถูกคัดลอกลง cart ตอน add to cart เท่านั้น (AF-2) → ถ้าลูกค้า click affiliate B **หลัง** เพิ่มของ
    จากลิงก์ A แล้ว checkout เลย cart ยังเป็นของ A: storefront ต้อง sync cookie ลง `cart.metadata.affiliate_token` อีกครั้ง**ก่อน** `placeOrder`
    (complete cart) เมื่อค่าใน cookie ต่างจากใน cart — ครอบ cart ทุกทางที่สร้าง รวม `/buy/[items]` (CORE-14 AC-41 บังคับ login + customer แล้ว)
    การ sync ใช้ `metadata` จาก cart ที่ storefront อ่านอยู่แล้ว (`retrieveCart`) ไม่ยิง `GET /store/carts/:id` เพิ่ม — ส่งมอบใน **AF-3b**
24. (การตีความ attribution window ตามที่ AF-3 ทำ, บันทึก 2026-10-26) เวลาอ้างอิงทั้งหมดคือ `t = order.created_at` (subscriber ที่รันช้า/retry ให้ผลเท่าเดิม):
    (a) มีโปรแกรม active ณ `t` อย่างน้อยหนึ่งตัว → attribution ผ่านเมื่อมีโปรแกรม active **อย่างน้อย 1 ตัว** ที่ `t − clicked_at ≤ attribution_window_days`
    ของโปรแกรมนั้น; โปรแกรมที่นำมาคิดค่าคอม (รวม Q7) คือเฉพาะโปรแกรมที่ window คลุม click; ไม่มีตัวใดคลุม → ไม่มี attribution (AC-3)
    (b) ไม่มีโปรแกรม active ณ `t` → ใช้อายุ token (30 วัน) เป็น window: `t − clicked_at ≤ 30 วัน` → attribution `program_id = null` ไม่มี entry (AC-2);
    เกิน → ไม่มี attribution
25. (AF-9b, review AF-9) `cancelPayoutWorkflow` **คง** lock เดิม `affiliate-payout-paid:<payout_id>` (ของ #79) และ**เพิ่ม** lock `affiliate-payout:<affiliate_id>`
    ตัวเดียวกับ `createPayoutWorkflow`: อ่าน `affiliate_id` จาก payout ก่อน (ไม่ถือ lock) แล้วถือ lock ตามลำดับตายตัว `affiliate-payout:<affiliate_id>` →
    `affiliate-payout-paid:<payout_id>` จนจบ workflow (รวม compensation) — กัน payout draft ซ้อนกัน (entry เดียวอยู่ใน 2 payout) ในกรณีที่ compensation ของ cancel
    restore payout หลังจาก create หยิบ entry ไปแล้ว; workflow อื่นที่ถือทั้งสอง key ต้องใช้ลำดับเดียวกัน
26. (Q3, AF-4 — review AF-3) ก่อนแจก cap ต่อ order (กฎ 4) เรียง `order.items` ตาม `created_at` จากน้อยไปมาก เสมอกันใช้ `id` — ไม่พึ่งลำดับที่
    `query.graph` คืน (ไม่รับประกันลำดับ) ใช้ลำดับเดียวกันทุกครั้งที่คำนวณ (สร้าง entry และ reversal)
27. (owner 2026-10-26; ฝั่ง attribution = AF-4b #91, ฝั่ง reversal จาก cancel = AF-4 #90) attribution **ไม่สร้าง entry** ให้ order ที่ถูกยกเลิกแล้ว: workflow attribution อ่าน `order.status` (`canceled`) **หลัง**ถือ lock
    `affiliate-attribution:<order_id>` (Locking module) — ยกเลิกแล้ว → ไม่สร้างทั้ง `AffiliateAttribution` และ entry (log info `order_canceled`; Q13 — ตามที่ #91 ทำ); reversal ที่มาจาก cancel ต้องถือ lock key เดียวกัน เพื่อให้ลำดับเป็น
    "attribution ก่อน → reversal เห็น entry" หรือ "cancel ก่อน → attribution เห็น `canceled`" เสมอ (ไม่มี entry pending ค้างของ order ที่ยกเลิก)
28. (การตีความของ AF-4 #90 ที่ **owner ยืนยัน 2026-10-26** — แทนข้อตัดสิน Q3 ส่วน partial refund) เหตุที่ทำให้เกิด reversal มีเพียง cancel, refund เต็ม และการคืนของ:
    (a) **cancel** order → reverse ยอดสุทธิที่เหลือของทุก line
    (b) **refund เต็มจำนวน** — เกณฑ์คือ `isOrderFullyRefunded` (helper ของ #90: ยอด refund สะสมของ order ≥ ยอดที่ชำระ, เทียบด้วย `MathBN`) → reverse ยอดสุทธิที่เหลือของทุก line
    (c) **return** → ต่อ line: จำนวนคืน = จำนวน **received + dismissed** (dismissed = รับคืนแบบชำรุด) ของ return item ของ line นั้น
        (#90 ที่ head a8daf1d นับ `return_received_quantity` + `return_dismissed_quantity` แล้ว);
        reversal = `−entry.amount × จำนวนคืน / line.quantity` (ปัด 2 ตำแหน่ง half-up, `MathBN`) และรวม reversal ของ line ไม่เกิน `entry.amount`
    (d) **refund บางส่วนที่ไม่ได้มาจาก return** (เช่น admin คืนเงินบางส่วนเพื่อชดเชย) → **ไม่** reverse; ถ้าจำเป็น admin ปรับค่าคอมเองนอกระบบ
        (v1 ไม่มี route/UI ปรับ entry ด้วยมือ — ถ้าต้องการต้องเป็น task ใหม่)
29. (รอบ 9, AF-7b/AF-8 — follow-up #110, ตาม Q7) สินค้าที่อยู่ในหลายโปรแกรมพร้อมกัน แสดง**การ์ดเดียวต่อสินค้าต่อแท็บ** ด้วยอัตราที่ได้จริง:
    (a) `status=active`: ในโปรแกรม active ณ `now` ที่ scope คลุม variant ใดของสินค้า เลือกโปรแกรมที่ `commission_value` **สูงสุด** เสมอกันเลือก `starts_at` ล่าสุด
    (เกณฑ์เดียวกับ Q7 ที่ AF-3 ใช้คิดเงิน) — การ์ดแสดงอัตรา ชื่อ และวันที่ของโปรแกรมนั้น; ถ้า variant ต่างกันได้อัตราต่างกัน แสดงอัตราสูงสุดพร้อม flag `rate_varies=true`
    (การ์ดขึ้น "สูงสุด X%")
    (b) `status=upcoming`: ในโปรแกรม upcoming ที่คลุมสินค้า เลือก `starts_at` **เร็วสุด** เสมอกันเลือก `commission_value` สูงสุด — สินค้าอยู่ได้ทั้งสองแท็บ;
    (รอบ 10 ตามที่ AF-7b #122 ทำและ review ยอมรับ — AF-8 ต้องแสดงตามนี้) แท็บ upcoming มี `rate_varies=false` **เสมอ** และอัตรา/ข้อมูลของการ์ดมาจากโปรแกรมที่เลือกเพียงตัวเดียว
    (variant ที่ไม่อยู่ในโปรแกรมนั้นไม่ถูกนำมาคิด) — AF-8 ห้ามคำนวณอัตราใหม่ที่ storefront
    (c) dedupe ทำใน API ก่อน paging (`count` = จำนวนสินค้าไม่ซ้ำ) ไม่ทำที่ storefront
    (d) ยอดประมาณการ ฿ บนการ์ด = ราคาปัจจุบัน × อัตราใน (a)/(b) ปัด 2 ตำแหน่ง half-up (กฎ 11) ไม่รวม cap
30. (รอบ 9, AF-10 — follow-up review #90) ตาข่ายกันพลาดของ reversal จาก cancel: reversal ของ AF-4 retry ใต้ lock ได้ราว 40 วินาที ถ้า DB ล่มนานกว่านั้น event หายและ entry
    `pending` ของ order ที่ยกเลิกจะถูก approve → maturity job รายวัน (AF-4) ก่อน approve ให้อ่าน `order.status` ของ entry ที่ครบกำหนด; order `canceled` และยอดสุทธิของ line > 0
    → สร้าง reversal ตามกฎ 28a (ใต้ lock `affiliate-attribution:<order_id>` ตามกฎ 27, idempotent กับ reversal ที่ subscriber สร้าง) แทนการ approve และ log warn `affiliate_cancel_reconciled`
    — ไม่เพิ่ม job ใหม่ ไม่ครอบ entry ที่ approve ไปแล้ว (owner Q15 2026-10-27: เลื่อนหลัง v1.0 → AF-11 backlog)
31. (รอบ 10, AF-3c — review #119) การ sync cookie `aff` ก่อนชำระ (AF-3b) ต้องครอบ**ทุก**จุดที่ storefront เริ่มการชำระ ใน `modules/checkout/components/**`:
    (a) `stripe.confirmPayment(` (บัตร) อยู่ภายใน argument ของ `syncAffiliateBefore(`; (b) ในฟังก์ชันที่เรียก `confirmPromptPayPayment(` ต้องมี `syncAffiliateBefore(` ก่อนหน้าใน
    ฟังก์ชันเดียวกัน (ตามที่ #119 ทำ: sync ครอบ `retrievePaymentIntent` ตัวแรกแล้วจึง confirm); (c) `placeOrder(` ของ manual ส่ง `cart.metadata` ให้ sync ภายใน; การเรียก
    `retrievePaymentIntent` เพื่อ poll สถานะอย่างเดียวได้รับยกเว้นเมื่ออยู่ใน allow-list ของ test พร้อมเหตุผล — บังคับด้วย static test ที่อ่าน source (แบบ `thai-ui-rule.test.ts`) ไม่พึ่ง review; "cookie ไม่เปลี่ยน → ไม่มี `POST /store/carts/:id`" พิสูจน์ด้วย unit ของ `syncAffiliateBefore` (POST เกิดจาก Next
    server จึงนับใน e2e ฝั่ง browser ไม่ได้ — แก้ถ้อยคำ AC-21)
    (รอบ 12, review #189) **นอกขอบเขตกฎนี้**: หน้า `/account/orders/:id/pay` ของ group buy (`modules/order/components/order-pay/**` ที่เรียก `stripe.confirmPayment` และ `open-qr.ts`
    ที่ PAY-3b2 ใช้จากหน้านี้) — ไม่มี cart ให้ sync และ attribution ของ order กลุ่มอ่าน token จาก `metadata` ของ draft order ที่บันทึกตอน join (กฎ 41); static test ของ AF-3c ต้องไม่ตรวจ
    path นี้ (หรือใส่ใน allow-list พร้อมเหตุผลนี้) ส่วน `open-qr.ts` เมื่อถูกเรียกจาก checkout ยังต้องผ่าน `syncAffiliateBefore` ตามข้อ (b)
32. (รอบ 10, AF-N2 — nit review #125/#122) maturity job (AF-10): (a) ขอ lock `affiliate-attribution:<order_id>` ด้วย timeout สั้น (≤ 5 วินาที) — ขอไม่ได้ → **ข้าม** entry นั้นในรอบนี้
    (คง `pending` ไม่ approve) log warn `affiliate_maturity_lock_skipped` พร้อม `order_id` แล้วไปรอบถัดไป (ไม่รอ 30 วินาทีต่อ order); (b) log ตอนสั่ง reversal ที่ workflow ยัง retry แบบ async
    ไม่ใช้คำว่า "failed"/ระดับ error จนกว่า workflow จะล้มจริง; (c) order `canceled` ที่ไม่สร้าง reversal เพราะยอดสุทธิ ≤ 0 อยู่แล้ว log info `affiliate_cancel_reconcile_noop`;
    (d) type `Program` ใน `src/api/affiliate/products/route.ts` ระบุ field ตาม `PORTAL_PROGRAM_FIELDS` + `scope` (ไม่ใช้ `Record<string, unknown>`) — ก่อน AF-8
33. (รอบ 11 — นิยาม AF-8a/AF-8b ที่ค้างจากรอบ 10) AF-8 แตกเป็น: **AF-8a** (☑ #135) = login/register ของ portal + หน้า Products (สองแท็บ, การ์ดเดียวต่อสินค้าตามกฎ 29, ปุ่มแชร์;
    AC-9, AC-35); **AF-8b** = แถบนำทางของ portal (`affiliate-nav-products|programs|earnings|payouts|profile`) + หน้า Programs (`/affiliate/programs`: แถว `affiliate-program-row`
    จาก `GET /affiliate/me/programs` แสดงชื่อ, อัตรา, วันที่, ป้าย active/upcoming, `announce_text`), Earnings (`/affiliate/earnings`: ยอดรวมต่อสถานะจาก `GET /affiliate/me/earnings`
    ใน `affiliate-earnings-pending|approved|paid|reversed` เป็น ฿ — (แก้ตาม review #152) API รวมยอด `GROUP BY status` (`summarizeCommissionEntries`) จึงคืนแถว `reversed`
    **แยก** เป็นยอดติดลบ และ `markPayoutPaid` เปลี่ยนเฉพาะ `approved → paid` (reversed ไม่ย้ายสถานะ) → แสดงแถว `affiliate-earnings-reversed` ตามค่าที่ API ให้ (ติดลบ, ข้อความไทยอธิบายว่าเป็นยอด
    ที่ถูกหักจากการยกเลิก/คืนเงิน) แยกจากสามสถานะ; storefront **ไม่**คำนวณหักลบหรือรวมยอดเอง (ไม่ทำคณิตเงินที่ storefront); สถานะที่ API ไม่คืนแถวแสดง ฿0), Payouts (`/affiliate/payouts`: แถว `affiliate-payout-row`
    จาก `GET /affiliate/me/payouts` แสดงงวด, ยอด, สถานะ, `paid_at` — ไม่มี `reference` ตาม Q14), Profile (`/affiliate/profile`: ชื่อ, อีเมล, code, `affiliate-default-link` =
    `{storefront}/r/{code}` พร้อมปุ่มคัดลอก, `affiliate-payout-info-status` จาก `has_payout_info` ตามกฎ 34); สิทธิ์ตาม Q6: route ที่ API ตอบ 403 (เช่น `suspended` เปิด Products/Programs,
    `pending` เปิดหน้าใดนอกจาก Profile) → แสดง `affiliate-status-notice` ข้อความไทยตามสถานะ ไม่ใช่หน้า error; ข้อความไทยตรงในโค้ด + path ใหม่ใน ESLint rule (ADR-014)
34. (รอบ 11, AF-13 — Q5) `GET /affiliate/me` คืน `has_payout_info = true` เมื่อ `payout_info` ไม่เป็น null และเป็น object ที่มีอย่างน้อย 1 key ไม่เช่นนั้น `false`; ยังไม่คืน key
    `payout_info` (กฎ 8) — คำนวณใน route/helper ของ portal ไม่เพิ่ม column
35. (รอบ 11 — planner ตัดสินกฎ 29d ตาม review #135) ยอดประมาณการบนการ์ด: (a) `rate_varies=false` → ราคาของ variant ที่ถูกที่สุด × อัตรา (กฎ 29d) และขึ้นต้น "ตั้งแต่" เมื่อ
    variant ของสินค้ามีราคาต่างกัน; (b) `rate_varies=true` → **ไม่แสดงตัวเลขยอดประมาณการ** (ไม่มี `affiliate-estimate`) แสดงเพียง "สูงสุด X%" (`affiliate-rate-varies`) — เพราะ API ไม่ส่ง
    อัตราต่อ variant ผลคูณราคาต่ำสุด × อัตราสูงสุดอาจไม่ตรงกับ variant ใดเลย (ตัวเลขที่ affiliate ได้ไม่จริง)
36. (รอบ 11, AF-8c — qa/review #135) (a) นับถอยหลังของ upcoming: เหลือ ≥ 24 ชั่วโมง → "เริ่มในอีก N วัน" โดย N = **ปัดลง** ของจำนวนวัน; < 24 ชั่วโมง → "เริ่มในอีก N ชั่วโมง"
    (N = ปัดขึ้นของชั่วโมง); < 1 ชั่วโมง → "เริ่มในอีกไม่ถึง 1 ชั่วโมง" (เดิมปัดขึ้นทั้งหมด เริ่มในไม่กี่ชั่วโมงแสดง "1 วัน"); (b) backend ไม่ตอบ/5xx ตอนโหลดหน้า portal → แสดง
    `affiliate-portal-error` ข้อความไทยพร้อมลิงก์ลองใหม่ ไม่ใช่หน้า error ของ Next (401 → redirect ไป login ของ portal ตามเดิม); (c) logout ลบ cookie token อย่างเดียว — ยอมรับใน v1
    (token เป็น JWT แบบ stateless Medusa ไม่มี revoke) ไม่มี task
37. (รอบ 11, AF-12a/b/c — owner 2026-10-27: admin UI ทำใน v1) หน้า admin "Affiliate" (ภาษาอังกฤษ, `src/admin/`) เขียนข้อมูลผ่าน admin API ของ AF-5/AF-9 เท่านั้น **ไม่แก้ backend**:
    ทุกปุ่ม submit/ยืนยัน disabled ระหว่างส่ง + in-flight guard ด้วย `createSingleFlight` ที่มีอยู่แล้ว (`src/admin/lib/single-flight.ts` ของ EV-9 พร้อม unit test) — ไม่เขียน guard ใหม่;
    instance ต้อง**คงที่ตลอดอายุ component** ตามวิธีในหัวไฟล์ (`const [submitOnce] = useState(createSingleFlight)`) ห้ามเรียก `createSingleFlight()` ใน body ของ render (เหตุที่ AF-6 #138
    เลิกใช้ เพราะถูกสร้างใหม่ทุก render) — `dblclick` = 1 request (บทเรียน CLAUDE.md); สำเร็จ → invalidate query แล้วแถวเปลี่ยนโดยไม่ reload; ล้ม → toast error (ข้อความจาก API) และ refetch รายการ
    (a) **Programs** (AF-12a): ปุ่ม `affiliate-program-create` และ `affiliate-program-edit` ต่อแถว เปิดฟอร์ม (`FocusModal`) field ตาม `AdminCreateAffiliateProgram`: name, starts_at, ends_at,
    commission_value (%), attribution_window_days (ค่าเริ่มต้น 7), hold_days (14), cap_per_order (ว่างได้), announce_text, status; scope = สวิตช์ `all` **หรือ** เลือก collection/category
    หลายตัวจาก admin API ของ Medusa (`GET /admin/collections`, `GET /admin/product-categories`); `variant_ids` แก้ใน UI ไม่ได้ใน v1 (owner Q16: แก้ผ่าน API) — แสดงจำนวน และ
    ฟอร์มส่ง `scope` ทั้งก้อนโดยคง `variant_ids` เดิมเสมอ (`updateAffiliatePrograms` แทนที่ JSON `scope` ทั้งก้อน) **รวมกรณีสลับเป็น `all`** (`all: true` คลุมทุกสินค้าอยู่แล้ว
    `variant_ids` ที่คงไว้ไม่เปลี่ยนผล และกลับมาใช้ได้เมื่อปิด `all`) — admin ล้าง `variant_ids` ได้ทาง API เท่านั้น;
    ตัวเลือก status แสดงเฉพาะที่กฎ 20 อนุญาตจากสถานะปัจจุบัน; ฟอร์มตรวจ `ends_at > starts_at` ก่อนส่ง; `affiliate-program-delete` (ยืนยันด้วย `usePrompt`) มีเฉพาะแถว `draft`
    (b) **Affiliates** (AF-12b): ปุ่มตามสถานะ — `pending` → `affiliate-approve` (status `active`); `active` → `affiliate-suspend` (ยืนยันด้วย `usePrompt`); `suspended` → `affiliate-reactivate`;
    `affiliate-payout-info-edit` เปิด drawer ฟอร์มข้อมูลรับเงิน `bank_name`, `account_name`, `account_number` (owner Q18 2026-10-27: 3 ช่องนี้เท่านั้นใน v1; เก็บเป็น `payout_info` JSON;
    ปุ่ม Clear ส่ง `null`) — ค่าเต็มเห็นเฉพาะ admin (กฎ 8)
    (c) **Payouts** (AF-12c): `affiliate-payout-create` เปิดฟอร์ม: เลือก affiliate สถานะ `active`/`suspended` — filter `status` ของ `GET /admin/affiliate/affiliates` รับค่าเดียว
    จึงยิง 2 ครั้ง (`?status=active` และ `?status=suspended`, `limit` ≤ 200) แล้วรวมผล ไม่แก้ validator, `period_from`/`period_to` ค่าเริ่มต้น =
    เดือนก่อนหน้าตามเวลาไทย `[วันที่ 1 00:00, วันที่ 1 ของเดือนนี้ 00:00)` Asia/Bangkok ส่งเป็น ISO (ตั้งแต่ ADM-9: ใช้ `DatePicker` และคำนวณตาม timezone ของเครื่องแอดมิน
    ซึ่งต้องตั้งเป็นเวลาไทย — ADR-018; e2e admin ตั้ง `timezoneId: "Asia/Bangkok"`); 400 (เช่นไม่มี entry/ยอดสุทธิ ≤ 0 ตาม Q8) → toast ไม่มีแถวใหม่; แถว `draft` มี
    `affiliate-payout-mark-paid` → กล่องยืนยันพร้อม input `reference` (แก้ถ้อยคำรอบ 12 ตาม AF-12c #176: `usePrompt` ไม่มีช่องกรอก จึงประกอบ `Prompt` ของ `@medusajs/ui` เองใน
    `mark-paid-prompt.tsx` — ตรงกับกฎ 37c ที่ถามใน AF-12c) (ไม่บังคับ; trim แล้วว่าง → **ไม่ส่ง key `reference`** เพราะ validator เป็น `min(1).optional()` — ส่ง `""` ได้ 400)
    → `POST /admin/affiliate/payouts/:id/mark-paid`; แถว `paid` แสดง `paid_at`, `reference` และไม่มีทั้งปุ่ม mark paid/cancel;
    ส่วนเพิ่มของ AC-26 จาก qa #138 (ปุ่มในจอที่ 1280px, ยกเลิกล้ม → refetch + toast) ถ้า #138 ยังไม่ครอบ ทำใน AF-12c
    (d) (ADR-018, owner 2026-10-28) ตั้งแต่ ADM-8b (แก้ถ้อยคำรอบ 12 ตาม nit #183 — ADM-8a ยังไม่ย้ายปุ่ม) ปุ่มต่อแถว (`affiliate-program-edit`/`-delete`, `affiliate-approve`/`-suspend`/`-reactivate`, `affiliate-payout-info-edit`,
    `affiliate-payout-mark-paid`/`-cancel`) ย้ายเข้า `ActionMenu` ของ dashboard — e2e ของ AC-26, AC-42..44 หา trigger ด้วย testid ระดับแถว แล้วหา menuitem ด้วย role + ชื่อ
    ตาม spec 08 กฎ 10; การกันกดซ้ำ (`createSingleFlight`) และ `usePrompt` คงเดิม
38. (รอบ 11, AF-14 — owner ตัดสิน Q17 2026-10-27) Ledger และ Payouts ของ admin แสดง**ชื่อ + อีเมล** ของ affiliate แทน `affiliate_id`: `GET /admin/affiliate/affiliates` รับ filter `id`
    (ค่าเดียวหรือ array `id[]`) เพิ่มใน `AdminListAffiliates` (route เดิมส่ง `req.filterableFields` ให้ `refetchEntities` อยู่แล้ว — ไม่เพิ่ม route, ไม่แก้ model/relation, ไม่มี migration);
    UI รวบ `affiliate_id` ที่ไม่ซ้ำของแถวในหน้าปัจจุบันแล้วยิง **1 request ต่อหน้า** (`fields=id,name,email`, `limit` = จำนวน id) — ไม่ดึง affiliate ทั้งหมดมาจับคู่; หาไม่เจอ → แสดง `affiliate_id`
39. (รอบ 12, AF-15 — review/qa #165 AF-12b) (a) validator ของ admin สำหรับ `payout_info` (สร้าง/แก้ affiliate) รับเฉพาะ `null` หรือ object `{ bank_name, account_name, account_number }`
    ครบ 3 ช่อง เป็น string ที่ trim แล้วไม่ว่าง และไม่มี key อื่น (`.strict()`) — อื่น → 400 `invalid_data` (ตาม owner Q18); `account_number` (owner Q20 = (ข) 2026-10-28) ตัด `-` และ
    ช่องว่างออกแล้วต้องเป็นตัวเลข 10–12 หลัก และเก็บค่าที่ตัดแล้ว — ฟอร์ม admin ตรวจแบบเดียวกันก่อนส่ง (แสดง `affiliate-payout-info-error`); (b) `POST /admin/affiliate/affiliates/:id`
    รับ `expected_status` (ไม่บังคับ) — ส่งมาและไม่ตรงสถานะปัจจุบัน → 409 code `AFFILIATE_STATUS_CHANGED` (กลไก PROMO-2) และไม่เปลี่ยนข้อมูล; การตรวจกับการอัปเดตต้อง atomic
    (conditional update หรือ Locking module — ไม่อ่านแล้วค่อยเขียนแยกโดยไม่มี lock); ปุ่ม approve/suspend/reactivate ของ AF-12b ส่ง `expected_status` = สถานะของแถวที่แสดงเสมอ
    ได้ 409 → toast + refetch; (c) ปุ่ม Clear ข้อมูลรับเงินยืนยันด้วย `usePrompt` ก่อนส่ง `null`; e2e ใช้ `expect.poll` แทน `waitForTimeout`
40. (รอบ 12, AF-N3 — review/qa #173 AF-8b, review #153/#174 AF-3c) portal และ static test: (a) Earnings ไม่ hardcode `"thb"` เป็น fallback ของสกุลเงิน — ใช้ `currency_code`
    ที่ API คืน และสถานะที่ไม่มีแถว (฿0 ตามกฎ 33) ใช้ค่าคงที่สกุลของร้านที่ประกาศที่เดียว; (b) ปุ่มคัดลอกลิงก์ของ Profile กับปุ่มแชร์ของ Products ใช้ component เดียว (ใช้ 2 ที่แล้ว);
    (c) `?page=` เกินจำนวนหน้าของ Programs/Payouts → แสดง `affiliate-page-out-of-range` ข้อความไทยพร้อมลิงก์ไปหน้าแรก ไม่ใช่ข้อความ "ยังไม่มี…"; (d) ยอดติดลบ (reversed) ใช้เครื่องหมาย
    `−` (U+2212); (e) static test ของกฎ 31: (31c) ตรวจว่า argument ที่ส่ง metadata ให้ `placeOrder(` เป็น expression ที่ไม่ใช่ `undefined` (ไม่ใช่แค่นับจำนวน argument), (31b) ตรวจลำดับ
    "sync ก่อน confirm" ภายในฟังก์ชันเดียวกันด้วย AST (ไม่เทียบตำแหน่งตัวอักษรของ source ทั้งไฟล์)
41. (รอบ 12, AF-16 — **owner ตัดสิน Q19 = (ข) 2026-10-28**) order ของ group buy ได้ค่าคอม affiliate ตามกฎเดิมทั้งหมด:
    (a) `joinGroupWorkflow` (GB-3, ขั้นสร้าง draft order ใน `workflows/group-buy/join-group.ts`) คัดลอก `cart.metadata.affiliate_token` (ถ้ามีและไม่ว่าง) ลง `metadata.affiliate_token` ของ draft order
    พร้อม key `group_buy_*` เดิม — ไม่ตรวจลายเซ็นตอน join (ตรวจตอน attribution ตามเดิม);
    (b) attribution (`workflows/affiliate/attribute-order.ts`) อ่าน token จาก `order.cart.metadata.affiliate_token` ก่อน ไม่มีจึงอ่าน `order.metadata.affiliate_token`;
    (c) order ที่ `is_draft_order = true` → **ไม่ทำ attribution และไม่บันทึกอะไร** (หยุดเงียบ — attribution เกิดจาก `order.placed` ของการแปลงใน GB-5/GB-10 แทน; กันค่าคอมของ draft ที่ไม่ได้จ่าย/ถูกยกเลิก);
    (d) เวลาอ้างอิงกฎ 24 = `order.created_at` เดิม (= เวลาที่ join เพราะการแปลงไม่สร้าง order ใหม่ — builder ยืนยันใน 2.22.1 ถ้าไม่ใช่ให้หยุดรายงาน); ฐานคำนวณ = ยอดหลังส่วนลด `GB-*` ตามกฎ 3;
    (e) ไม่สร้าง cart/link ใหม่, ไม่แก้ AF-3b/กฎ 31 ฝั่ง checkout — จุด sync cookie ก่อน join เป็นของ GB-7 (spec 04 กฎข้อ 27)

## Acceptance criteria
- AC-1 เมื่อมีโปรแกรม P ที่ active (10%, สินค้าทั้งหมด, ช่วงเวลาวันนี้) และผู้ซื้อ click
  `/r/ann` แล้วสั่งซื้อ ฿1,000 (ไม่รวมค่าจัดส่ง/ภาษี) ภายในช่วงเวลา แล้วต้องมี entry สถานะ pending จำนวน ฿100 สำหรับ Ann
- AC-2 เมื่อไม่มีโปรแกรม active ณ เวลาสั่งซื้อ flow เดียวกัน → บันทึก attribution ที่ `program_id = null` แต่ **ไม่มี** entry
- AC-3 เมื่อ click เมื่อ 10 วันก่อนและ `attribution_window_days=7` → ไม่มี attribution
- AC-4 เมื่อขอบเขตโปรแกรม = collection C, order มี 1 รายการใน C (฿500) และ 1 รายการที่ไม่อยู่ใน C → entry ฿50
- AC-5 เมื่อมี refund เต็มจำนวนหลังสร้าง entry → มี entry `reversed` จำนวน −฿100 และ `matures_at = null`; ยอดสุทธิ 0
- AC-6 เมื่อ `hold_days=14` entry จะเป็น `approved` หลังผ่านไป 14 วันเท่านั้น (job ที่ควบคุมเวลาได้)
- AC-7 Admin สร้าง payout ให้ Ann สำหรับเดือนที่แล้ว → รวม entry ที่ approved; ทำเครื่องหมายจ่ายแล้ว → entry เป็น `paid`
- AC-8 order ที่อีเมลลูกค้าตรงกับอีเมลของ affiliate (ต่างกันแค่ตัวพิมพ์/ช่องว่าง) → ไม่มี entry
- AC-12 affiliate สามารถ register และ login ที่ `/auth/affiliate/emailpass` ได้โดยไม่ต้องมี
  customer account; customer session ไม่สามารถเข้าถึง `/affiliate/me` ได้ (401)
- AC-9 Affiliate portal แสดงหน้า Products พร้อมแท็บ `affiliate-tab-earning` และ `affiliate-tab-upcoming` (ข้อความมีอักษรไทย) แต่ละการ์ด
  มี % ค่าคอมมิชชันและวันที่ และปุ่ม `affiliate-share-button` คัดลอกลิงก์รายสินค้าได้ (screenshots)
- AC-13 เมื่อโปรแกรม P2 ถูก published โดย `starts_at` เป็นวันพรุ่งนี้ (ขอบเขต: collection C) แล้ว
  `GET /affiliate/products?status=upcoming` ต้องแสดงสินค้าใน C พร้อมอัตราและวันเริ่มของ P2
  และ `status=active` ต้องไม่แสดง; สินค้าของโปรแกรม draft ต้องไม่แสดงในทั้งสองแบบ
- AC-14 ผู้ซื้อที่ click ลิงก์แชร์สินค้า upcoming วันนี้และสั่งซื้อพรุ่งนี้หลัง
  `starts_at` (ภายใน attribution window) ทำให้ได้ค่าคอมมิชชัน; สั่งซื้อวันนี้ไม่ได้ค่าคอมมิชชัน
- AC-10 การส่ง event `order.placed` ซ้ำ (รวมกรณีส่งพร้อมกัน 2 ครั้ง) → มี attribution 1 แถวและชุด entry เพียงชุดเดียว
- AC-11 เมื่อ cart metadata มี `affiliate_token` ที่ถูกปลอมแปลง/ดัดแปลง เมื่อสั่งซื้อแล้ว
  ต้องไม่มีการสร้าง attribution และ entry และมีการ log event นั้น
- AC-15 เมื่อ `POST /affiliate/register` ด้วย body `{ name, code, email: "other@x.com" }` และ token ของ identity `ann@x.com`
  → `affiliate.email = "ann@x.com"`; code ที่ไม่ตรง slug (เช่น `"A b"`, 2 ตัว, 33 ตัว) → 400; code ซ้ำ → error และไม่มีแถวใหม่
- AC-16 response ของ `POST /affiliate/register` และ `GET /affiliate/me` ไม่มี key `payout_info` แม้ affiliate มีค่านี้
- AC-17 เมื่อโปรแกรม P มี `status = ended` แต่เวลาสั่งซื้ออยู่ใน `[starts_at, ends_at)` → attribution `program_id = null`
  และไม่มี entry; สั่งซื้อที่ `t = ends_at` พอดีของโปรแกรม published → ไม่มี entry
- AC-18 ทุก route ใต้ `/affiliate/*` ยกเว้น `/affiliate/register` ตอบ 401 เมื่อไม่มี token หรือใช้ token ของ customer
- AC-19 (AF-9) ยกเลิก payout `draft` ของ Ann → payout ไม่อยู่ในรายการ, entry ใน `entry_ids` ยังเป็น `approved`; สร้าง payout ใหม่
  ช่วงเดียวกัน → ได้ entry ชุดเดิมและยอดเท่าเดิม; ยกเลิก payout `paid` → 400 และ payout/entry ไม่เปลี่ยน
- AC-20 (AF-9, กฎ 19) entry `approved` ที่ `created_at` อยู่ก่อน `period_from` และยังไม่อยู่ใน payout ใด ถูกรวมใน payout รอบ
  `[period_from, period_to)`; entry ที่ `created_at >= period_to` ไม่ถูกรวม; entry ที่อยู่ใน payout อื่นแล้วไม่ถูกรวม
- AC-21 (AF-3b, กฎ 23) Given โปรแกรม active และลูกค้า click `/r/ann` แล้ว add to cart When click `/r/bob` (cookie เปลี่ยน) แล้ว checkout ทันทีโดยไม่ add
  เพิ่ม Then `cart.metadata.affiliate_token` ตอน complete เป็นของ Bob และ attribution ของ order เป็นของ Bob (e2e); ~~Given cookie ไม่เปลี่ยน Then ไม่มี
  `POST /store/carts/:id` เพื่อ sync (e2e นับ request)~~ (แก้รอบ 10 ตาม #119 — POST มาจาก Next server e2e นับไม่ได้) Given unit ของ `syncAffiliateBefore` (mock SDK) ที่ cookie
  เท่ากับ `cart.metadata.affiliate_token` Then ไม่เรียก update cart; ค่าต่าง → เรียก 1 ครั้งก่อน step ที่ห่อ (unit Vitest — ส่งมอบใน #119)
- AC-22 (AF-3b, กฎ 23) Given unit test ของ action add-to-cart ใน `lib/data/cart.ts` (mock SDK) When เพิ่มสินค้าโดยมี cookie `aff` Then จำนวนครั้งที่เรียก
  retrieve cart เท่ากับก่อน AF-2 (ไม่มี round-trip `GET /store/carts/:id` เพิ่ม) และ metadata ถูกตั้งเมื่อค่าต่าง (unit Vitest)
- AC-23 (กฎ 24 — logic ส่งมอบใน AF-3 #77 พร้อม unit test แล้ว; **integration test นี้ทำใน AF-4**) Given โปรแกรม P1 active (15%, `attribution_window_days=7`) และ
  P2 active (10%, `attribution_window_days=14`) ครอบสินค้าเดียวกัน, click เมื่อ 10 วันก่อน `order.created_at` Then มี attribution `program_id = P2` และ entry คิดที่ 10%
  (P1 ไม่นับเพราะ window ไม่คลุม click); Given ไม่มีโปรแกรม active, click 20 วันก่อน Then attribution
  `program_id = null` ไม่มี entry; click 31 วันก่อน Then ไม่มี attribution (integration)
- AC-24 (กฎ 24 — integration test ทำใน AF-4 เหมือน AC-23) Given click 6 วันก่อน `order.created_at` (`attribution_window_days=7`) When subscriber ประมวลผล event ช้าไป 3 วัน (ควบคุมเวลาใน test)
  Then ยังมี attribution และ entry (ใช้ `order.created_at` ไม่ใช่เวลาประมวลผล) (integration)
- AC-25 (AF-4, กฎ 26) Given `cap_per_order=฿60`, อัตรา 10%, order มี line L1 (`created_at` ก่อน, ฐาน ฿500) และ L2 (ฐาน ฿500) โดย input ส่ง L2 มาก่อน L1
  Then entry ของ L1 = ฿50 และ L2 = ฿10; สลับลำดับ input อีกแบบ ได้ผลเหมือนเดิม; `created_at` เท่ากัน → ตัดสินด้วย `id` (unit ของฟังก์ชันเรียง/วางแผน)
- AC-26 (AF-6) Given payout `draft` และ payout `paid` ของ Ann When admin เปิดแท็บ Payouts Then เฉพาะแถว `draft` มี `affiliate-payout-cancel`; When กด
  (หรือ `dblclick`) แล้วยืนยัน Then มี request ยกเลิก 1 ครั้งและแถวหายไปโดยไม่ reload; When กดแล้วยกเลิกกล่องยืนยัน Then ไม่มี request (e2e admin)
- AC-27 (AF-9b, กฎ 25) Given Ann มี entry `approved` 3 รายการและ payout `draft` D When cancel D โดย inject ให้ step **หลัง** soft-delete ล้ม (compensation restore D)
  และระหว่างที่ cancel ถือ lock อยู่ (เช่น step ที่ inject รอ signal ของ test) ยิง create payout ช่วงเดียวกันของ Ann Then create รอจน cancel ปล่อย lock, D ถูก restore
  และ create ได้ 400/ไม่มี payout ใหม่ หรือได้ payout ที่ไม่มี entry ซ้ำกับ D — **ไม่มี entry ใดอยู่ใน `entry_ids` ของ payout ที่ยังไม่ถูกลบมากกว่า 1 ตัว**; และ unit/spy
  ยืนยันว่า cancel ขอ lock key `affiliate-payout:<affiliate_id>` และ `affiliate-payout-paid:<payout_id>` ตามลำดับของกฎ 25; When `DELETE` route ยกเลิก payout โดยไม่มี
  token admin Then 401 และ payout ไม่เปลี่ยน (integration http)
- AC-28 (กฎ 19 แก้ 2026-10-26) Given Ann มี line L1: entry E1 `pending` ฿100 + reversed R1 −฿100 (refund เต็มก่อนครบ hold) และ line L2: entry E2 `approved` ฿50
  + reversed R2 −฿20 (ทั้งหมด `created_at < period_to`) When สร้าง payout Then `entry_ids` = {E2, R2}, ยอด ฿30 และ**ไม่มี** R1; Given line L3: E3 `pending` ฿100 +
  reversed R3 −฿40 When สร้าง payout ก่อน E3 ครบ hold Then ไม่มี E3/R3; When maturity job approve E3 แล้วสร้าง payout รอบถัดไป Then มี E3 และ R3 (฿60);
  Given ต้นทาง `paid` แล้วมี reversed ใหม่ Then reversed นั้นเข้า payout ถัดไป (integration http)
- AC-29 (กฎ 27) Given order O ที่มี `affiliate_token` ถูกต้องและโปรแกรม active When order O ถูก cancel **ก่อน** subscriber `order.placed` ประมวลผล (ควบคุมลำดับใน test)
  Then ไม่มี attribution และไม่มี entry ของ O; Given ยิง attribution กับ cancel ของ O พร้อมกัน Then ผลรวม entry + reversal ของ O = 0 และไม่มี entry `pending` ของ O ที่ไม่มี reversal;
  unit/spy ยืนยันว่าทั้งสองทางขอ lock `affiliate-attribution:<order_id>` (integration)
- AC-30 (กฎ 28c) Given entry ของ line L (qty 4) ฿100 When return รับของคืน 1 ชิ้น Then reversal −฿25; When รับคืนอีก 3 ชิ้น Then reversal −฿75 และยอดสุทธิของ L = 0;
  Given entry ฿100, qty 3, รับคืน 1 Then −฿33.33 (half-up); Given entry ฿100, qty 4 When return มี received 1 + dismissed 1 Then reversal −฿50
  (integration + unit ของฟังก์ชันคำนวณ)
- AC-31 (กฎ 28b, 28d) Given order ที่มี entry When admin refund บางส่วน (ไม่สร้าง return) Then ไม่มี reversal; When refund ส่วนที่เหลือจนครบ (`isOrderFullyRefunded` = true)
  Then มี reversal ของยอดสุทธิที่เหลือทุก line และยอดสุทธิของ order = 0; refund ซ้ำ/event ซ้ำ Then ไม่มี reversal เพิ่ม (integration)
- AC-32 (AF-7 #110, owner 2026-10-27) Given Ann (`active`) มี payout 3 รายการ และ Bob มี payout 1 รายการ When Ann `GET /affiliate/me/payouts` Then 200 มี 3 รายการ
  เรียงใหม่สุดก่อน **ทุกรายการมี `affiliate_id` = Ann** และไม่มี key `entry_ids`; `?limit=2` → 2 รายการ, `count=3`; `?limit=101` → 400; ไม่ส่ง `limit` → `limit=50`;
  Ann `suspended` → 200; Ann `pending` → 403; ไม่มี token หรือ token customer → 401; `POST`/`DELETE` ที่ path นี้ไม่มี route (404) (integration http — ส่งมอบใน #110)
  — ส่วน "ไม่มี key `reference`" (owner 2026-10-27) **ส่งมอบใน AF-7b** (ไม่ใช่เงื่อนไขของ #110)
- AC-33 (AF-7 #110) Given โปรแกรม published 3 ตัว When `GET /affiliate/me/programs?limit=2` Then 2 รายการ, `count=3`; `?limit=101` → 400; ค่าเริ่มต้น `limit=50` (integration http)
- AC-34 (AF-7b, กฎ 29) Given สินค้า X อยู่ในโปรแกรม active P1 (10%, starts เมื่อวาน) และ P2 (15%, starts เมื่อ 3 วันก่อน) และ P3 (15%, starts วันนี้) When `GET /affiliate/products?status=active`
  Then X ปรากฏ**ครั้งเดียว** อัตรา 15% ของ P3 (เสมอกันเลือก `starts_at` ล่าสุด) และ `count` นับ X หนึ่งครั้ง; Given X อยู่ใน upcoming U1 (starts พรุ่งนี้ 5%) และ U2 (starts มะรืน 20%)
  When `status=upcoming` Then X ครั้งเดียวกับ U1; Given variant X1 อยู่ใน P1 (10%) อย่างเดียวและ X2 อยู่ใน P2 (15%) Then อัตรา 15% และ `rate_varies=true` (integration http)
- AC-35 (AF-8, กฎ 29) Given ข้อมูลของ AC-34 When affiliate เปิดแท็บ `affiliate-tab-earning` Then มีการ์ด `affiliate-product-card` ของ X 1 ใบ แสดง 15% และยอดประมาณการตามกฎ 29d;
  สินค้า `rate_varies=true` แสดงข้อความ "สูงสุด" (มีอักษรไทย, หาด้วย test id `affiliate-rate-varies`) (e2e)
- AC-36 (AF-10, กฎ 30) Given entry `pending` ของ order O ที่ครบ `matures_at` และ O ถูก cancel โดยไม่มี reversal (จำลอง event หาย: ปิด subscriber ใน test) When maturity job รัน
  Then entry ไม่เป็น `approved`, มี reversal เท่ายอดสุทธิ, ยอดสุทธิของ O = 0 และมี log warn `affiliate_cancel_reconciled`; รัน job ซ้ำ Then ไม่มี reversal เพิ่ม;
  order ที่ไม่ถูก cancel ยัง approve ตามเดิม (AC-6 ผ่าน) (integration)
- AC-37 (AF-3c, กฎ 31) Given source ใต้ `apps/storefront/src/modules/checkout/components/` When static test (Vitest, ตรวจด้วย AST ของ TypeScript — ไม่ตัด source ด้วย `indexOf`)
  ตรวจเงื่อนไข (a)–(c) ของกฎ 31 Then ผ่านบน develop; positive control (fixture ใน test): `stripe.confirmPayment(...)` นอก `syncAffiliateBefore`, ฟังก์ชันที่เรียก
  `confirmPromptPayPayment` โดยไม่มี sync ก่อน, `placeOrder(cart.id)` ที่ไม่ส่ง metadata — แต่ละกรณีทำให้ test ล้ม; allow-list ของการ poll มีเหตุผลกำกับทุกแถว (unit Vitest)
- AC-38 (AF-N2, กฎ 32) Given entry `pending` ครบ `matures_at` ของ order O และ test ถือ lock `affiliate-attribution:O` ค้างไว้ When maturity job รัน Then job จบภายใน 10 วินาที, entry ยัง `pending`,
  มี log warn `affiliate_maturity_lock_skipped` ที่มี O; When ปล่อย lock แล้วรัน job อีกครั้ง Then entry ถูกประมวลผลตามกฎ 30/Q8; Given order canceled ที่ยอดสุทธิ = 0 Then log info
  `affiliate_cancel_reconcile_noop` และไม่มี reversal ใหม่; spy logger: ไม่มีบรรทัดระดับ error ที่มีคำว่า `failed` ระหว่าง workflow reversal ยัง retry; `pnpm typecheck` ผ่านและ
  `src/api/affiliate/products/route.ts` ไม่มี `Record<string, unknown>` (grep) (integration + unit)
- AC-39 (AF-13, กฎ 34) Given Ann มี `payout_info = { bank_name: "x" }` When `GET /affiliate/me` Then `has_payout_info = true` และไม่มี key `payout_info`; Given `payout_info = null` หรือ `{}`
  Then `has_payout_info = false`; AC-16 ยังผ่าน (integration http)
- AC-40 (AF-8b, กฎ 33) Given Ann (`active`) มีโปรแกรม published active 1 + upcoming 1, entry pending ฿30 / approved ฿50 / paid ฿100 และ reversed −฿20 (reversal ของ line ที่ approved)
  และ payout `paid` ที่มี `reference = "TRX-AC40"` When เปิด แต่ละหน้าผ่าน `affiliate-nav-*` Then Programs มี `affiliate-program-row` 2 แถว; Earnings แสดง `affiliate-earnings-pending` ฿30,
  `affiliate-earnings-approved` ฿50, `affiliate-earnings-paid` ฿100 และ `affiliate-earnings-reversed` −฿20 (ตรงกับแถวของ `GET /affiliate/me/earnings` ทีละสถานะ — approved **ไม่**แสดง ฿30);
  Given ไม่มี entry สถานะ reversed Then `affiliate-earnings-reversed` แสดง ฿0;
  Payouts มี `affiliate-payout-row` 1 แถวและ textContent ของหน้าไม่มี `TRX-AC40`; Profile มี `affiliate-default-link` ลงท้าย `/r/<code ของ Ann>` และ `affiliate-payout-info-status` มีอักษรไทย;
  ทุกหน้ามีอักษรไทย; Given Bob `suspended` When เปิด `/th/affiliate` และ Programs Then เห็น `affiliate-status-notice` มีอักษรไทยและ HTTP status < 500; Earnings/Payouts ของ Bob เปิดได้ (e2e)
- AC-41 (AF-8c, กฎ 35, 36) unit (Vitest) ของฟังก์ชันนับถอยหลัง (ควบคุม `now`): เหลือ 3 ชั่วโมง → มี "ชั่วโมง" ไม่มี "วัน"; 30 นาที → "ไม่ถึง 1 ชั่วโมง"; 49 ชั่วโมง → "2 วัน"; การ์ดที่ `rate_varies=true`
  → ไม่มี `affiliate-estimate` แต่มี `affiliate-rate-varies`; `rate_varies=false` ที่ variant ราคา 100/200 อัตรา 10% → `affiliate-estimate` แสดง ฿10 และมี "ตั้งแต่"; data function ของ portal เมื่อ
  fetch ล้มแบบ network/5xx → หน้า render `affiliate-portal-error` (unit ของ component/หน้า ด้วย mock) (unit Vitest)
- AC-42 (AF-12a, กฎ 37a) e2e admin (helper ของ OPS-11): When กรอกฟอร์มจาก `affiliate-program-create` แล้ว `dblclick` Save Then มี `POST /admin/affiliate/programs` **1 ครั้ง** และแถวใหม่สถานะ
  `draft` ปรากฏโดยไม่ reload; When แก้ `commission_value` ผ่าน `affiliate-program-edit` Then `GET /admin/affiliate/programs/:id` ได้ค่าใหม่และ `scope.variant_ids` เดิมไม่เปลี่ยน (ตั้งผ่าน API ใน setup);
  Given โปรแกรม `published` Then ตัวเลือก status ไม่มี `draft` และแถวไม่มี `affiliate-program-delete`; Given `draft` When กด `affiliate-program-delete` แล้วยกเลิก prompt Then ไม่มี `DELETE`;
  ยืนยัน Then แถวหาย; When `ends_at` ก่อน `starts_at` Then ปุ่ม Save ส่งไม่ได้หรือเห็น error และไม่มี `POST` (e2e admin)
- AC-43 (AF-12b, กฎ 37b) Given affiliate `pending` When `dblclick` `affiliate-approve` Then มี `POST /admin/affiliate/affiliates/:id` 1 ครั้งด้วย `status: "active"` และ badge เป็น `active` โดยไม่ reload;
  When `affiliate-suspend` แล้วยกเลิก prompt Then ไม่มี request; ยืนยัน Then `suspended` และมี `affiliate-reactivate`; When บันทึกข้อมูลรับเงิน 3 field Then `GET /admin/affiliate/affiliates/:id`
  มี `payout_info` ตรงกัน; When Clear Then `payout_info = null` (e2e admin)
- AC-44 (AF-12c, กฎ 37c) Given Ann มี entry `approved` ใน "เดือนก่อน" (ตั้ง `created_at` ใน setup) When เปิดฟอร์ม `affiliate-payout-create` Then ช่วงวันที่ค่าเริ่มต้นคือเดือนก่อนตามเวลาไทย (browser `timezoneId: "Asia/Bangkok"` — ADR-018);
  When เลือก Ann แล้ว `dblclick` Create Then `POST /admin/affiliate/payouts` 1 ครั้งและแถว `draft` ใหม่แสดงยอดรวม; Given affiliate ที่ไม่มี entry Then เห็น toast error และไม่มีแถวใหม่;
  When `affiliate-payout-mark-paid` ใส่ reference `TRX-AC44` แล้วยืนยัน Then แถวเป็น `paid` แสดง `TRX-AC44`, ไม่มี `affiliate-payout-mark-paid`/`affiliate-payout-cancel` และ `GET /admin/affiliate/entries?status=paid`
  มี entry ของ payout นั้นครบ; When ยกเลิก prompt mark paid Then ไม่มี request; When mark paid โดยเว้น reference ว่าง (หรือมีแต่ช่องว่าง) Then body ของ request ไม่มี key `reference`
  และได้ 200; Given affiliate `active` 1 และ `suspended` 1 Then ตัวเลือก affiliate ในฟอร์มมีทั้งสองคนและไม่มีคนที่ `pending`; AC-26 ยังผ่าน (e2e admin)
- AC-45 (AF-14, กฎ 38) Given affiliate A, B, C When `GET /admin/affiliate/affiliates?id[]=A&id[]=B` Then ได้ A และ B เท่านั้น (`count=2`); `?id=A` → A; ไม่มี token admin → 401
  (integration http); Given entry ของ A และ payout ของ B When เปิดแท็บ Ledger และ Payouts Then คอลัมน์ Affiliate แสดงชื่อและอีเมลของเจ้าของแถว (ไม่ใช่ `aff_…`) และต่อหน้าของตารางมี
  `GET /admin/affiliate/affiliates?id[]=…` **1 ครั้ง** (นับด้วย `page.on("request")`); affiliate ที่หาไม่เจอแสดง `affiliate_id` เดิม (e2e admin)
- AC-46 (AF-15, กฎ 39) integration: `payout_info` = `{ bank_name: "K", account_name: "A", account_number: "123-4-56789-0" }` → 200 และเก็บ `account_number = "1234567890"`;
  `account_number` 9 หลัก, 13 หลัก หรือมีตัวอักษร → 400; มี key เกิน (`promptpay_id`), ขาดช่อง หรือค่าว่างหลัง trim → 400;
  `null` → 200; Given affiliate `suspended` When `POST /admin/affiliate/affiliates/:id` `{ status: "active", expected_status: "pending" }` Then 409 `{ type: "conflict", code: "AFFILIATE_STATUS_CHANGED" }`
  และสถานะยัง `suspended`; ไม่ส่ง `expected_status` → พฤติกรรมเดิม (integration http); e2e admin: แท็บอื่นระงับ affiliate แล้วหน้าเดิมกด approve → toast + แถวแสดง `suspended` หลัง refetch;
  กด Clear ข้อมูลรับเงินแล้วยกเลิก prompt → ไม่มี request; grep: e2e ของ AF-12b ไม่มี `waitForTimeout`
- AC-47 (AF-N3, กฎ 40) unit (Vitest): component Earnings ไม่มี literal `"thb"` (static) และแสดงสกุลตาม `currency_code` ของ response ที่ mock; ยอด reversed ขึ้นต้นด้วย `−` (U+2212);
  e2e: `/th/affiliate/payouts?page=99` → เห็น `affiliate-page-out-of-range` มีอักษรไทย; static: ปุ่มคัดลอก/แชร์ import component เดียวกัน; static test ของกฎ 31 ล้มกับ fixture
  `placeOrder(id, undefined)` และ fixture ที่ `syncAffiliateBefore` อยู่ในฟังก์ชันอื่นที่ประกาศก่อน (positive control ใน evidence)
- AC-48 (AF-16, กฎ 41) Given โปรแกรม P active 10% และ cart ของ A มี `metadata.affiliate_token` ที่ถูกต้องของ Ann When A join กลุ่ม Then draft order มี `metadata.affiliate_token` เท่ากับของ cart
  และ `group_buy_membership_id`; When รัน workflow attribution กับ draft order (หรือ event ของการสร้าง draft ถ้ามี) Then ไม่มี `AffiliateAttribution`/entry ของ order นั้น; When กลุ่มสำเร็จ ชำระ
  และแปลง (GB-5, mock provider) Then มี attribution 1 รายการ และ entry ยอด = 10% ของ `subtotal − discount_subtotal` ของ line หลังส่วนลด `GB-*` (เทียบ `MathBN`); Given cart ไม่มี token Then draft order
  ไม่มี key `affiliate_token` และหลังแปลงไม่มี attribution; Given token ของ Ann และอีเมล order = อีเมลของ Ann Then ไม่มี entry (กฎ 12); AC-1, AC-10 เดิมยังผ่าน (integration http)

## Non-functional
- Redirect ไม่เขียน DB; < 50ms
- Query ของ ledger มี index บน `(affiliate_id, status, created_at)`; รายงานรวมยอดด้วย SQL
- Maturity job ใช้ index `(status, matures_at)` (เพิ่มใน AF-4)
- Attribution ทนต่อ event ซ้ำ/พร้อมกันด้วย unique `order_id` (กฎ 15); test AC-10 แบบพร้อมกันต้อง assert ว่า**ทั้งสอง** promise เป็น `fulfilled`
  (ตัวที่แพ้ race หยุดเงียบตามกฎ 15 ไม่ throw) — แก้ใน AF-4 (review AF-3)
- payout เลือก entry ด้วย filter ใน DB (AF-9); ยังไม่เพิ่ม GIN index บน `payout.entry_ids` จนกว่าจำนวน payout ทำให้ query ช้าจริง (วัดก่อน — ไม่มี task)

## Test plan
- Unit: การคำนวณค่าคอมมิชชัน (ขอบเขต, cap, ฐานคำนวณ, ปัดเศษ), การตรวจสอบช่วงเวลา `[starts_at, ends_at)` และ `ended` (AC-17 ส่วน logic), การเรียง line (AC-25)
- Integration (http): AC-1..AC-8, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-23, AC-24, AC-27, AC-28, AC-29, AC-30, AC-31
- Unit: สัดส่วน reversal ของ return (AC-30)
- e2e: AC-9 + AC-1 แบบ end-to-end พร้อม cookie, AC-21 (AF-3b); unit (Vitest storefront): AC-22 (AF-3b); e2e admin: AC-26 (AF-6, ใช้ helper ของ OPS-11)
- Integration (http): AC-32 (AF-7; ส่วน `reference` ใน AF-7b), AC-33 (AF-7), AC-34 (AF-7b) + unit ของฟังก์ชันเลือกโปรแกรมต่อสินค้า (กฎ 29); integration: AC-36 (AF-10); e2e: AC-35 (AF-8)
- unit Vitest (static): AC-37 (AF-3c); integration + unit: AC-38 (AF-N2)
- (รอบ 11) integration http: AC-39 (AF-13); e2e: AC-40 (AF-8b); unit Vitest: AC-41 (AF-8c); e2e admin: AC-42 (AF-12a), AC-43 (AF-12b), AC-44 (AF-12c); integration http + e2e admin: AC-45 (AF-14)
- (รอบ 12) integration http + e2e admin: AC-46 (AF-15); unit Vitest + e2e: AC-47 (AF-N3); integration http: AC-48 (AF-16)

## Tasks
| ID | Task | Depends |
|----|------|---------|
| AF-1 | models/service/migrations ของ module + auth ของ actor type `affiliate` (register/login) + unit tests สำหรับการคำนวณค่าคอมมิชชัน (AC-12, AC-15, AC-16) — PR #11 | CORE-2 |
| AF-2 | Tracking redirect + cookie + cart metadata hook ใน storefront (เตรียมสำหรับ AC-3) | AF-1 |
| AF-3 | Subscriber `order.placed` สำหรับ attribution + สร้าง entry (AC-1,2,3,4,8,10,11,17) (ตามข้อตัดสิน Q2, Q3, Q7 และกฎ 24 — #77 กรองตาม window ของแต่ละโปรแกรมและใช้ `order.created_at` แล้ว มี unit test) — backend เท่านั้น; ส่วน storefront ย้ายไป AF-3b | AF-2 |
| AF-3b | (แยกจาก AF-3, 2026-10-26) storefront: sync cookie `aff` ลง `cart.metadata.affiliate_token` ก่อน `placeOrder` เมื่อค่าต่าง และเลิก round-trip `GET /store/carts/:id` ที่ AF-2 เพิ่มใน add to cart (กฎ 23; AC-21, AC-22) — แตะ `lib/data/cart.ts` | AF-3 |
| AF-4 | Subscriber สำหรับ reversal + maturity job + migration index `(status, matures_at)` (AC-5, AC-6) — ห้ามลบ entry; ตามข้อตัดสิน Q8; **เพิ่ม 2026-10-26 (owner, review #90)**: เหตุของ reversal ตามกฎ 28 (AC-30, AC-31), reversal จาก cancel ถือ lock `affiliate-attribution:<order_id>` (กฎ 27, AC-29 ส่วน reversal — #90 ทำแล้ว), payout เลือก reversed เฉพาะที่ต้นทาง approved/paid (กฎ 19, AC-28 — แก้ filter ของ `createPayoutWorkflow`) — ☑ #90 (nit review AF-3 ย้ายไป AF-4b) | AF-3 |
| AF-4b | (แยกจาก AF-4, ☑ #91) nit review AF-3 ฝั่ง attribution: เรียง `order.items` ตาม `created_at`/`id` ก่อน `planAttribution` (กฎ 26, AC-25), log info เมื่อ token หมดอายุ/affiliate ไม่ active, integration test ของกฎ 24 (AC-23, AC-24), test AC-10 assert ทั้งสอง promise `fulfilled` + attribution ข้าม order ที่ยกเลิกแล้วใต้ lock `affiliate-attribution:<order_id>` (กฎ 27, AC-29 ส่วน attribution) | AF-3 (∥ AF-4; แตะ workflow attribution — ถ้าชนกับ #90 ที่ lock ตัวที่ merge ทีหลัง rebase) |
| AF-5 | Admin APIs + payout workflows (AC-7) (ตามข้อตัดสิน Q8) | AF-1 |
| AF-6 | หน้า Admin UI รวมปุ่มยกเลิก payout `draft` (AC-26) | AF-5, AF-9 (route ยกเลิก) |
| AF-7 | Portal APIs รวม `/affiliate/products` (แปลงขอบเขต → สินค้า ตามกฎ 16, paging) (AC-13, AC-14, AC-18) — หมายเหตุ: ปรับ middleware matcher ให้คลุมทุก `/affiliate/*` ยกเว้น register (กฎ 18) และสิทธิ์ตามสถานะ (Q6); (รอบ 9, owner 2026-10-27) รวม `GET /affiliate/me/payouts` ที่ #110 ทำไว้ + paging ของ programs/payouts (AC-32 ยกเว้นส่วน `reference`, AC-33) — ◐ #110 | AF-3 |
| AF-7b | (เล็ก, backend, follow-up #110 — **PR แยก เริ่มหลัง #110 merge เท่านั้น**) `/affiliate/products` หนึ่งรายการต่อสินค้าด้วยอัตราที่ได้จริงตามกฎ 29 (dedupe ก่อน paging, `rate_varies`; ปรับ test เดิมของ #110 ที่ยึดคู่โปรแกรม–สินค้า) (AC-34) + ตัด `reference` ออกจาก response ของ `GET /affiliate/me/payouts` พร้อม test (AC-32 ส่วน `reference`) | AF-7 (#110 merged) |
| AF-8 | **แตกรอบ 11 → AF-8a / AF-8b / AF-8c (กฎ 33)** — เดิม: หน้า portal ใน storefront (login ของตัวเอง, เรียก API จาก server side ตามกฎ 17): Products now/soon + Share, Programs, Earnings, Payouts (`/affiliate/me/payouts`), Profile (Q5) + e2e (AC-9, AC-35 การ์ดเดียวต่อสินค้าตามกฎ 29); ข้อความไทยตรงในโค้ด + path ใหม่ใน ESLint rule (spec 01 CORE-4 กฎข้อ 4, ADR-014); แท็บ upcoming ตามกฎ 29(b) รอบ 10 | — |
| AF-8a | ☑ #135 — login/register ของ portal + หน้า Products (แท็บ, การ์ดเดียวต่อสินค้า, แชร์) (AC-9, AC-35) | AF-7 ☑, AF-7b ☑, AF-4 ☑ |
| AF-8b | (storefront) แถบนำทาง + หน้า Programs, Earnings, Payouts, Profile และ `affiliate-status-notice` ตามสิทธิ์ Q6 (กฎ 33) (AC-40) — ไฟล์: `app/[countryCode]/(main)/affiliate/{programs,earnings,payouts,profile}/`, layout ของ portal, data function ของ portal, config ESLint (path ใหม่) | AF-8a ☑ (#135), AF-13 (Profile ใช้ `has_payout_info`) |
| AF-8c | (storefront เล็ก, qa/review #135) นับถอยหลังเป็นชั่วโมงเมื่อ < 24 ชม., การ์ด `rate_varies` ไม่แสดงยอดประมาณการ, `affiliate-portal-error` เมื่อ backend ล่ม (กฎ 35, 36) (AC-41) — ไฟล์: การ์ด/หน้า Products ของ AF-8a, data function ของ portal | AF-8b (แตะ layout/data function เดียวกัน — ทำหลัง AF-8b เพื่อไม่ชน) |
| AF-13 | (backend เล็ก, Q5) `has_payout_info` ใน `GET /affiliate/me` (กฎ 34) + integration test (AC-39) — ไฟล์: `src/api/affiliate/me/route.ts`, `src/api/affiliate/helpers.ts` | AF-1 ☑ — เริ่มได้ทันที (∥ ทุกตัว) |
| AF-12a | (admin UI) Programs: สร้าง/แก้/ลบ draft + เปลี่ยนสถานะตามกฎ 20, scope all/collections/categories (กฎ 37a) (AC-42) — ไฟล์: `src/admin/routes/affiliate/page.tsx`, `src/admin/components/affiliate/` (ฟอร์มใหม่), `src/admin/lib/affiliate.ts` | AF-6 ☑ (#138), AF-5 ☑ |
| AF-12b | (admin UI เล็ก) Affiliates: approve/suspend/reactivate + ข้อมูลรับเงิน (กฎ 37b) (AC-43) — ไฟล์เดียวกับ AF-12a (`page.tsx` คอลัมน์ action, `lib/affiliate.ts`) | AF-6 ☑ (#138) — ∥ AF-12a/12c (ชน `page.tsx`/`lib/affiliate.ts` ตัวที่ merge ทีหลัง rebase) |
| AF-14 | (backend เล็ก + admin UI, owner Q17 2026-10-27) filter `id[]` ใน `GET /admin/affiliate/affiliates` + คอลัมน์ Affiliate ของ Ledger/Payouts แสดงชื่อ/อีเมล ดึงทีละหน้า (กฎ 38) (AC-45) — ไฟล์: `src/api/admin/affiliate/validators.ts`, `src/admin/routes/affiliate/page.tsx` (คอลัมน์ Ledger), `src/admin/components/affiliate/payouts-table.tsx`, `src/admin/lib/affiliate.ts` | AF-6 ☑ (#138) — เริ่มได้; ชน `page.tsx`/`payouts-table.tsx`/`lib/affiliate.ts` กับ AF-12a/12c (ตัวที่ merge ทีหลัง rebase) |
| AF-12c | (admin UI เล็ก) Payouts: สร้าง payout + mark paid (+ ส่วนเพิ่ม AC-26 จาก qa #138 ถ้ายังไม่ครอบ) (กฎ 37c) (AC-44) — ไฟล์: `src/admin/components/affiliate/payouts-table.tsx`, `page.tsx`, `lib/affiliate.ts` | AF-6 ☑ (#138), AF-9 ☑ — ∥ AF-12a/12b (ชนไฟล์เดียวกัน ตัวที่ merge ทีหลัง rebase) |
| AF-10 | (เล็ก, backend, follow-up review #90) maturity job reconcile order ที่ยกเลิกแต่ไม่มี reversal ก่อน approve (กฎ 30) (AC-36) | AF-4 ☑ |
| AF-N1 | (เล็ก, test-only, nit review #107) test lock ของ AF-9b: `await` holding/waiting ต้องมี timeout (ไม่ค้างทั้ง suite เมื่อ lock ผิด), เปลี่ยน `toBeGreaterThanOrEqual(400)` เป็น status ที่คาดแน่นอน — AC-27 ต้องยังผ่าน | AF-9b (#107) |
| AF-9 | follow-up AF-5 (เล็ก): `cancelPayoutWorkflow` + admin route ยกเลิก payout `draft` (คืน entry ให้เลือกได้อีก) และย้ายการกรอง entry ของ `createPayoutWorkflow` ไปทำใน DB (filter ตามกฎ 19 แทนโหลด entry ทั้งหมดแล้วกรองในแอป) (AC-19, AC-20; AC-7 ต้องยังผ่าน) | AF-5 |
| AF-3c | (เล็ก, storefront test-only, รอบ 10 — review #119) static test ว่าทุกจุดเริ่มชำระผ่าน `syncAffiliateBefore` (กฎ 31) (AC-37) — ถ้า test พบจุดที่ไม่ครอบ แก้ใน PR เดียวกัน | AF-3b ☑ (#119) |
| AF-N2 | (เล็ก, backend, รอบ 10 — nit review #125 AF-10 + #122 r2 AF-7b) maturity job ข้าม order ที่ขอ lock ไม่ได้ภายใน ≤ 5s, ถ้อยคำ/ระดับ log ระหว่าง retry, log `affiliate_cancel_reconcile_noop`, type `Program` ระบุ field (กฎ 32) (AC-38) | AF-10 ☑ (#125), AF-7b ☑ (#122) — ควร merge ก่อน AF-8 (type) |
| AF-15 | (backend เล็ก + admin UI, รอบ 12 — review/qa #165) validator `payout_info` 3 ช่องแบบ strict, `expected_status` + 409 `AFFILIATE_STATUS_CHANGED`, prompt ของ Clear, e2e `expect.poll` (กฎ 39) (AC-46) — ไฟล์: `src/api/admin/affiliate/validators.ts`, route/workflow update affiliate, `src/admin/components/affiliate/` (affiliates table, payout info drawer), `src/admin/lib/affiliate.ts`, e2e `affiliate-admin-affiliates`; รวมรูปแบบ `account_number` 10–12 หลัก (owner Q20) — เกิน ~400 LOC ให้ builder แยกเป็น AF-15a backend (validator + `expected_status`) / AF-15b admin UI + e2e | AF-12b ☑ (#165), **AF-14** (◐ #187 — แตะ `lib/affiliate.ts`/`validators.ts` เดียวกัน) — ควร merge ก่อน ADM-8a (ADM-8a ต้องรอ AF-15 ด้วย) |
| AF-16 | (backend เล็ก, รอบ 12 — owner Q19 = (ข)) คัดลอก `affiliate_token` จาก cart ลง metadata ของ draft order ตอน join, attribution อ่าน `order.metadata` เมื่อไม่มี cart และข้าม order ที่เป็น draft (กฎ 41) (AC-48) — ไฟล์: `src/workflows/group-buy/join-group.ts`, `src/workflows/affiliate/attribute-order.ts` + integration test | AF-3 ☑, GB-3 ☑, GB-5 ☑ (#185) — **เริ่มได้**; ต้อง merge ก่อน GB-7 (spec 04) |
| AF-N3 | (storefront เล็ก, รอบ 12 — review/qa #173, nit #153/#174) สกุลเงินของ Earnings, component คัดลอก/แชร์เดียว, หน้าเกินจำนวน, เครื่องหมาย `−`, static test ของกฎ 31 ด้วย AST (กฎ 40) (AC-47) — ไฟล์: `app/[countryCode]/(main)/affiliate/**`, `modules/affiliate/**`, static test ของ AF-3c | AF-8c ☑ (#182), AF-3c ☑ (#153) — **เริ่มได้** |
| AF-9b | follow-up review AF-9 (เล็ก, backend): `cancelPayoutWorkflow` คง lock `affiliate-payout-paid:<payout_id>` และเพิ่ม `affiliate-payout:<affiliate_id>` ตามลำดับตายตัว (กฎ 25) + test บังคับ path compensation ของ cancel + test route ยกเลิกไม่มี token → 401 (AC-27) | AF-9 |
AF-5 → AF-9 → (AF-6 ∥ AF-9b → AF-N1) ∥ AF-3/AF-4; AF-3 → (AF-3b ∥ AF-4 ∥ AF-4b ∥ AF-7); AF-7 (#110 merge) → AF-7b (PR แยก) → AF-8 (AF-3b ไม่บล็อก AF-8 แต่ต้อง merge ก่อน release v0.6.0);
AF-10 เริ่มได้ทันที (∥ AF-7b/AF-N1/AF-6; แตะ maturity job/workflow ของ AF-4 เท่านั้น)
(รอบ 10) สถานะ: AF-3b ☑ #119, AF-7 ☑ #110, AF-7b ☑ #122, AF-9b ☑ #107, AF-10 ☑ #125, AF-N1 ◐ #137 (คิว merge), AF-6 ◐ #138, AF-8a ◐ #135; AF-3c ∥ AF-N2 เริ่มได้ทันที; AF-8 ← AF-N2 (type ของ products)
(รอบ 11) สถานะ: AF-8a ☑ #135, AF-6 ☑ #138, AF-N1 ☑ #137, AF-N2 ☑ #146, AF-3c ☐ เริ่มได้; ลำดับใหม่: AF-13 ∥ AF-12a ∥ AF-12b ∥ AF-12c ∥ AF-14 เริ่มได้ทันที →
AF-8b (← AF-13) → AF-8c; release v0.6.0 ต้องมี AF-8b, AF-12a/b/c, AF-14
(รอบ 12) สถานะ: AF-3c ☑ #153, AF-13 ☑ #158, AF-12a ☑ #163, AF-12b ☑ #165, AF-8b ☑ #173, AF-12c ☑ #176, AF-8c ☑ #182; AF-14 ◐ #187; ใหม่: AF-N3 ∥ AF-16 เริ่มได้ทันที,
AF-15 หลัง AF-14; owner ตอบ 2026-10-28: Q19 (ข) → กฎ 41/AF-16, Q20 (ข) → กฎ 39a/AF-15; nit admin ของ #163/#176 (วันเวลาของฟอร์มโปรแกรม, scope ว่าง, ตัวเลือก affiliate > 200, mark paid ระหว่าง cancel) รวมใน ADM-8b/ADM-9 (spec 08) เพราะ ADM เขียนฟอร์ม/ปุ่มเหล่านั้นใหม่;
release v0.6.0 ต้องมี AF-14 (AF-15 ควรมี)
(รอบ 11, review #146 AF-N2) nit `tryAcquire` ที่ `catch {}` กลืน error ทุกชนิด (ต้องข้ามเฉพาะ lock conflict) และ `.run()` ที่ throw แบบ sync ต้อง release lock — #146 merge แล้ว
ถ้ายังไม่ได้แก้ ให้ PR ถัดไปที่แตะ maturity job แก้ (ไม่สร้าง task); ข้อสังเกต: entry `pending` ของ order ที่ยกเลิกและยอดสุทธิ = 0 ค้าง `pending` ถาวร (กฎ 5 ห้ามแก้ status ย้อน/ข้าม) และถูกสแกนทุกวันพร้อม log `affiliate_cancel_reconcile_noop`
— ยอมรับใน v1 (ปริมาณน้อย; ไม่ใช่ยอดที่จ่ายได้) → backlog หลัง v1.0 พร้อม AF-11
backlog หลัง v1.0 (ไม่มี AC): dedupe ของ `/affiliate/products` ทำใน SQL เมื่อแคตตาล็อกใหญ่ (v1 dedupe ในแอปมีเพดานจำนวนสินค้าตามที่ AF-7b ทำ — review #122);
AF-11 reconcile entry ที่ **approve ไปแล้ว** ของ order ที่ถูกยกเลิกแต่ไม่มี reversal (review #125) — ⏸ หลัง v1.0 (owner Q15 2026-10-27)
(รอบ 10 — qa #138 AF-6, ทำใน #138 ถ้ายังไม่ merge มิฉะนั้นเป็น PR ถัดไปที่แตะหน้า Affiliates) AC-26 เพิ่ม: ที่ viewport 1280×800 ปุ่ม `affiliate-payout-cancel` อยู่ในจอ
(`boundingBox` อยู่ใน viewport หรือ container เลื่อนแนวนอนภายในตัวเองได้) และเมื่อยกเลิก**ไม่สำเร็จ** (route ตอบ 4xx/5xx) ต้อง refetch รายการ payout (มี request GET ใหม่) และแสดง toast error
— ไม่สร้าง task ใหม่; ข้อสังเกตอื่นของ #138 (Ledger/Payouts แสดงแค่ `affiliate_id`, e2e จับกันกดซ้ำไม่ได้มีแค่ unit) รอคำตอบ owner เรื่อง admin UI อ่านอย่างเดียว (Open questions รอบ 10)
AF-3b แตะ `lib/data/cart.ts` เดียวกับ CORE-14/CORE-4d — ตัวที่ merge ทีหลัง rebase
follow-up review AF-2 (#66, 2026-10-26): fail-fast `AFFILIATE_TOKEN_SECRET` ใน production (กฎ 22) ผนวกเข้า **OPS-7** (spec 07 AC-13) ไม่ใช่ task ของ spec นี้;
`/buy/[items]` ที่สร้าง cart โดยไม่มี token อยู่ใน CORE-14 (spec 01 AC-41) แล้ว

## ข้อตัดสินของ owner (2026-10-25)
- Q1 สมัครเองได้: register → `pending` → admin อนุมัติ
- Q2 ขอบเขต `category_ids` **ไม่นับ** category ลูกใน v1 (admin เลือก category ลูกเองใน UI) ใช้กฎเดียวกันทั้ง AF-3 และ AF-7
- Q3 cap ต่อ order แจกให้ line **ตามลำดับ line item** (แบบที่ AF-1 ทำ ไม่ต้องแก้ `utils/commission.ts`; "ลำดับ" = `created_at` แล้ว `id` ตามกฎ 26);
  ~~partial refund ของ line → reversal = `−entry.amount × ยอดที่คืน / base ของ line`~~ (แทนด้วยกฎ 28 ตามที่ #90 ทำ, 2026-10-26: refund บางส่วนที่ไม่ใช่ return
  ไม่ reverse; return ใช้สัดส่วนจำนวนชิ้น)
- Q4 affiliate เปลี่ยน `code` เองไม่ได้ใน v1; คำสงวน `admin, affiliate, store, auth, api, app, www, support, shop, r`
- Q5 portal ไม่ส่ง `payout_info` ออกเลย แสดงเพียง boolean `has_payout_info`; admin เป็นผู้กรอก
- Q6 `pending` เข้าได้เฉพาะ `/affiliate/me`; `suspended` เข้า `/affiliate/me`, earnings, payouts แบบอ่านอย่างเดียว;
  `/affiliate/products` และ programs เฉพาะ `active` อื่น ๆ → 403
- Q7 หลายโปรแกรม active ครอบ line เดียวกัน: ต่อ line เลือกอัตราสูงสุด เสมอกันเลือก `starts_at` ล่าสุด;
  attribution เก็บ `program_id` ของโปรแกรมที่ให้ค่าคอมรวมมากที่สุด
- Q8 maturity job อนุมัติ entry ที่ยอดสุทธิของ line (รวม reversal) > 0; payout = Σ `approved` + Σ `reversed` **ที่ผ่านกฎ 19** (ต้นทางของ line
  approved/paid แล้ว — แก้ 2026-10-26, AC-28) ที่ยังไม่อยู่ใน `entry_ids` ของ payout ใด; ยอดสุทธิ ≤ 0 → ไม่สร้าง payout ยกยอดไปรอบถัดไป
- Q9 (2026-10-25, AF-9) ยกเลิก payout `draft` = soft-delete (ไม่เพิ่มสถานะ `cancelled`)
- กฎ 20 ให้ตรงกับโค้ดของ PR #35 (`draft → ended` ตรงได้)

## Open questions (รอบ 12 — ปิดแล้ว)
- ~~Q19~~ ตัดสินแล้ว (owner 2026-10-28): **(ข) ให้ค่าคอม** → กฎ 41, AF-16, spec 04 กฎข้อ 27; คำถามเดิม (review #185 GB-5) order ของ group buy **ไม่ได้ค่าคอม affiliate** ในทางปฏิบัติ: attribution (AF-3) อ่าน `cart.metadata.affiliate_token` แต่ draft order ของกลุ่มสร้างด้วย
  `createOrderWorkflow` (GB-3) จึงไม่ผูก cart — ทางเลือก: (ก) **[แนะนำ] ตั้งใจไม่ให้ค่าคอมใน v1** แล้วบันทึกเป็นกฎ (group buy ลดราคาแรงอยู่แล้ว ไม่ซ้อนแรงจูงใจ, ไม่แตะ flow
  เงินที่เพิ่ง merge, ไม่มีงานเพิ่ม — affiliate ยังได้ค่าคอมจาก order ปกติ); (ข) ให้ค่าคอม: ตอน join คัดลอก `affiliate_token` จาก cart ลง `metadata` ของ draft order และ attribution
  อ่าน `order.metadata` เมื่อไม่มี cart (เวลาอ้างอิงกฎ 24 = `created_at` ของ order หลังแปลง หรือของ draft — ต้องตัดสินด้วย) ~150 LOC แตะ GB-3 + AF-3
- ~~Q20~~ ตัดสินแล้ว (owner 2026-10-28): **(ข)** ตัวเลข 10–12 หลักหลังตัด `-`/ช่องว่าง → กฎ 39a, AF-15; คำถามเดิม (AF-12b #165, กฎ 37b) รูปแบบ `account_number`: (ก) ไม่บังคับรูปแบบ (ตอนนี้ — admin กรอกเองและโอนด้วยมือ); (ข) **[แนะนำ]** ตัด `-`/ช่องว่างแล้วต้องเป็นตัวเลข 10–12 หลัก
  (ความยาวเลขบัญชีธนาคารไทยที่ใช้ทั่วไป) ตรวจทั้ง API (AF-15) และฟอร์ม — กันพิมพ์ผิดก่อนโอนเงินจริง ต้นทุนต่ำ; (ค) รูปแบบต่อธนาคาร (ซับซ้อนเกิน v1). ถ้าเลือก (ข) planner เพิ่มในกฎ 39a ก่อน AF-15 เริ่ม

## Open questions (รอบ 6–7)
- ~~Q10~~ ตัดสินแล้ว (owner 2026-10-26): เมื่อหลายโปรแกรม active นับค่าคอม**เฉพาะโปรแกรมที่ window คลุมวันคลิก** (ตามที่ #77 ทำ) — กฎ 24a, AC-23
- ~~Q11~~ ตัดสินแล้ว (owner 2026-10-26, รอบ 7): payout เลือก reversed เฉพาะที่ต้นทาง approved/paid (กฎ 19, AC-28); order ที่ยกเลิกแล้วไม่ได้ entry (กฎ 27, AC-29);
  ยอมรับการตีความของ #90: refund บางส่วนที่ไม่ได้มาจากการคืนของไม่หักค่าคอม, การคืนนับ received + dismissed / quantity, admin ปรับเองถ้าจำเป็น (กฎ 28, AC-30, AC-31)
- ~~Q12~~ ปิดแล้ว (2026-10-26): #91 = AF-4b (เรียง line, log info, test AC-10/23/24, กฎ 27 ฝั่ง attribution); filter payout กฎ 19 อยู่ใน AF-4 #90
- ~~Q13~~ ตัดสินแล้ว (owner ยืนยัน 2026-10-27): order ที่ยกเลิกก่อน attribution ไม่บันทึกทั้ง `AffiliateAttribution` และ entry (ตามที่ AF-4b #91 ทำ) — กฎ 27
- ~~Q14~~ ตัดสินแล้ว (owner 2026-10-27): เก็บ `GET /affiliate/me/payouts` ที่ #110 ทำไว้ (อ่านอย่างเดียว ไม่ส่ง `entry_ids`, paging ≤ 100 ค่าเริ่มต้น 50) และ
  **ไม่แสดง `reference`** ให้ affiliate (ตัดออกใน AF-7b) — API, AC-32
- ~~(รอบ 10, qa #138 AF-6) admin UI อ่านอย่างเดียว~~ ตัดสินแล้ว (owner 2026-10-27 รอบ 6): **ทำ admin UI แบบเขียนได้ใน v1** ใช้ API ของ AF-5 ไม่แก้ backend → AF-12a/12b/12c (กฎ 37);
  ส่วน "แสดงชื่อ/อีเมล affiliate ใน Ledger/Payouts" แยกเป็น Q17 (→ AF-14)
- ~~Q16~~ ตัดสินแล้ว (owner 2026-10-27): **(ก)** คงตามข้อเสนอ — `variant_ids` แก้ผ่าน API ใน v1 (กฎ 37a); คำถามเดิม: scope แบบ `variant_ids` แก้ใน admin UI ไม่ได้ใน v1 (คงค่าเดิม; ตั้งผ่าน API ได้) เพราะ product picker ของ GB-6b2 เลือกระดับ product ไม่ใช่ variant — ทางเลือก:
  (ก) **[แนะนำ]** คงไว้แบบนี้ใน v1: แคมเปญส่วนใหญ่ใช้ collection/category หรือทั้งร้าน และไม่เพิ่ม component; (ข) task เพิ่ม: picker ระดับ product แล้วแปลงเป็น variant ทั้งหมดของ product
  (ใช้ picker ของ GB-6b2 ซ้ำ — การใช้งานที่สองจึงย้ายเป็น component กลางได้) ~200 LOC
- ~~Q17~~ ตัดสินแล้ว (owner 2026-10-27): **(ก)** ทำใน v1 → AF-14 (กฎ 38, AC-45); คำถามเดิม (รอบ 11, จาก qa #138): Ledger/Payouts ของ admin แสดงแค่ `affiliate_id` เพราะ API ของ AF-5 ไม่ส่งชื่อ/อีเมล และ model ไม่มี relation — ทางเลือก: (ก) **[แนะนำ]** task backend เล็ก (AF-14):
  `GET /admin/affiliate/affiliates` รับ filter `id[]` แล้ว UI ดึงชื่อของ id ในหน้าปัจจุบันครั้งเดียวต่อหน้า (ไม่แก้ model); (ข) คง `affiliate_id` ใน v1 — admin กรองด้วย affiliate ได้อยู่แล้ว;
  (ค) เพิ่ม relation `belongsTo` ใน model + migration (ใหญ่กว่า ไม่จำเป็น)
- ~~Q18~~ ตัดสินแล้ว (owner 2026-10-27): 3 ช่อง `{ bank_name, account_name, account_number }` ไม่มีพร้อมเพย์ใน v1 (กฎ 37b); คำถามเดิม (รอบ 11, AF-12b): รูปแบบ `payout_info` ที่ admin กรอก: ข้อเสนอ `{ bank_name, account_name, account_number }` (โอนธนาคารตาม ADR-005) — ต้องมีพร้อมเพย์ (`promptpay_id`) ด้วยไหม;
  **ข้อเสนอ: 3 field ก่อน** เพิ่มภายหลังได้โดยไม่ต้อง migrate (เป็น JSON)
- ~~Q15~~ ตัดสินแล้ว (owner 2026-10-27): **เลื่อนหลัง v1.0** (AF-11 backlog); คำถามเดิม (รอบ 10, review #125) entry ที่ maturity job **approve ไปแล้ว** ก่อน order ถูกยกเลิก และ event `order.canceled` หาย (reversal ของ AF-4 retry ~40s ไม่สำเร็จ เช่น DB ล่มนาน) จะค้างเป็น
  ค่าคอมที่จ่ายได้ — AF-10 (กฎ 30) ครอบเฉพาะ entry ที่ยัง `pending` ทางเลือก: (ก) **[แนะนำ] เลื่อนหลัง v1.0** (ไม่มี task ตอนนี้) — ต้องเกิดสองเหตุพร้อมกัน (cancel หลังพ้น `hold_days`
  + DB ล่มเกิน 40s ตอนนั้น) และ admin ตรวจ/ยกเลิก payout `draft` ได้ก่อน mark paid; (ข) AF-11: maturity job สแกน entry `approved` ที่ยังไม่อยู่ใน payout `paid` ของ order ที่ถูกยกเลิก
  แล้วสร้าง reversal (กฎ 28a) — เพิ่ม query ข้ามโมดูลทุกวันตามจำนวน entry approved ที่ยังไม่จ่าย
