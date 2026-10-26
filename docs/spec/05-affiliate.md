# 05 Affiliate — ค่าคอมมิชชันแบบมีช่วงเวลากำหนด

สถานะ: in-progress (AF-1 = PR #11)
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
| lock ข้าม request ของ payout | Locking module (Redis) + `acquireLockStep`/`releaseLockStep` | ใช้ตามเดิม: key `affiliate-payout:<affiliate_id>` ทั้ง create และ cancel (กฎ 25) |
| ปุ่มยืนยันใน admin | `usePrompt` ของ `@medusajs/ui` | ใช้ตามเดิม (AF-6) |
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
- Subscriber เมื่อ refund/cancel/return: insert entry แบบ `reversed` สำหรับยอดที่ได้รับผลกระทบ
  (ไม่แก้ไข entry เดิม; ledger เป็น append-only)
- Scheduled job รายวัน: entry `pending` ที่ `matures_at <= now` และไม่มี reversal → `approved`
- `createPayoutWorkflow(affiliate, period)` admin: เลือก entry ตามกฎ 19 → Payout draft;
  `markPayoutPaid` → entry เป็น `paid` (compensation คืน `paid → approved`, กฎ 21)
- `cancelPayoutWorkflow(payout_id)` admin (AF-9): เฉพาะ payout `draft` → ลบ payout (soft-delete) entry ใน `entry_ids` กลับไปเลือกได้
  ในรอบถัดไป (สถานะ entry ไม่เปลี่ยน เพราะ draft ไม่แตะ entry); payout `paid` → 400 `NOT_ALLOWED`;
  (AF-9b, กฎ 25) ถือ lock `affiliate-payout:<affiliate_id>` ตัวเดียวกับ `createPayoutWorkflow` ตลอด workflow (`acquireLockStep`/`releaseLockStep`)

## API
- Store (public): `GET /store/affiliate/r/:code?to=/path` → ตั้ง cookie, 302 ไปยัง path
- Affiliate portal (actor `affiliate`, `authenticate("affiliate", ["session","bearer"])`):
  `POST /affiliate/register` (หลัง `/auth/affiliate/emailpass/register`; `allowUnregistered: true`;
  body = `{ name, code }` เท่านั้น; สร้าง affiliate สถานะ `pending` และตั้ง `app_metadata.affiliate_id`;
  ถ้า token มี `actor_id` แล้ว → 400), `GET /affiliate/me`, `GET /affiliate/me/programs`,
  `GET /affiliate/me/earnings?from&to`,
  `GET /affiliate/products?status=active|upcoming&page=` → สินค้าในโปรแกรมที่ published
  (สินค้า, ราคา variant, รูป, % ค่าคอมมิชชัน, ชื่อโปรแกรม, starts_at/ends_at,
  `share_url` = `{storefront}/r/{code}?to=/products/{handle}`) เรียงตาม starts_at
  Login ผ่าน `/auth/affiliate/emailpass`
  route `/store/*` ของ customer ไม่ถูกแก้ไข; ไม่จำเป็นต้องเป็น customer
  Response ของ portal ใช้ field ของ affiliate: `id, email, name, code, status, created_at` (ไม่มี `payout_info`)
- Admin: CRUD โปรแกรม; รายการ affiliate/อนุมัติ/ระงับ; `GET /admin/affiliate/entries`;
  สร้าง payout/ทำเครื่องหมายว่าจ่ายแล้ว; `GET /admin/affiliate/reports/summary`

## Admin UI / Storefront
- Admin: route page "Affiliate" → Programs (รายการพร้อมวันที่), Affiliates, Ledger, Payouts — แถว payout `draft` มีปุ่มยกเลิก
  (`affiliate-payout-cancel`, ยืนยันด้วย `usePrompt` ของ `@medusajs/ui`, กันกดซ้ำ) เรียก route ยกเลิกของ AF-9; payout `paid` ไม่มีปุ่ม (AF-6)
- Storefront: portal `/affiliate/*` ที่มี login/register ของตัวเอง (affiliate session แยกจาก
  customer session):
  (ข้อความไทยตรงในโค้ด ADR-014; e2e หาด้วย test id)
  - **Products** (หน้าแรก): สองแท็บ "ได้ค่าคอมมิชชันตอนนี้" (`affiliate-tab-earning`) / "เร็วๆ นี้" (`affiliate-tab-upcoming`);
    แต่ละการ์ดแสดงรูป, ชื่อ, ราคา, % ค่าคอมมิชชัน และยอดประมาณการเป็น ฿ ที่ราคาปัจจุบัน, วันที่ของโปรแกรม (นับถอยหลังถึง
    วันเริ่มสำหรับ upcoming) และปุ่ม **แชร์** (`affiliate-share-button`) (คัดลอกลิงก์; ใช้ Web Share เมื่อ browser รองรับ
    โดยมีการคัดลอกเป็น fallback) สินค้า upcoming แชร์ล่วงหน้าได้ — ลิงก์ใช้งานได้
    ทันทีและเริ่มได้ค่าคอมมิชชันเมื่อช่วงเวลาเปิด
  - Programs, Earnings (pending/approved/paid), Payouts, Profile (code, ลิงก์เริ่มต้น)
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
6. `hold_days` ป้องกันช่วงเวลาที่อาจมี refund; จ่ายได้เฉพาะ entry ที่ `approved`
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
19. (AF-5) การเลือก entry ของ payout: entry ของ affiliate นั้นที่ `status ∈ {approved, reversed}` (Q8), `created_at < period_to`
    และยังไม่อยู่ใน `entry_ids` ของ payout ใด — **ไม่** ตัดด้วย `period_from` (`period_from` เป็นเพียงป้ายของรอบ) เพื่อให้ยอดที่
    ยกมาจากรอบก่อนตาม Q8 ถูกรวมในรอบถัดไป
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
25. (AF-9b, review AF-9) `cancelPayoutWorkflow` ถือ lock `affiliate-payout:<affiliate_id>` เดียวกับ `createPayoutWorkflow` — กัน payout draft ซ้อนกัน
    (entry เดียวอยู่ใน 2 payout) เมื่อ create กับ cancel/compensation ของ affiliate เดียวกันทำงานพร้อมกัน
26. (Q3, AF-4 — review AF-3) ก่อนแจก cap ต่อ order (กฎ 4) เรียง `order.items` ตาม `created_at` จากน้อยไปมาก เสมอกันใช้ `id` — ไม่พึ่งลำดับที่
    `query.graph` คืน (ไม่รับประกันลำดับ) ใช้ลำดับเดียวกันทุกครั้งที่คำนวณ (สร้าง entry และ reversal)

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
  เพิ่ม Then `cart.metadata.affiliate_token` ตอน complete เป็นของ Bob และ attribution ของ order เป็นของ Bob; Given cookie ไม่เปลี่ยน Then ไม่มี
  `POST /store/carts/:id` เพื่อ sync (e2e นับ request)
- AC-22 (AF-3b, กฎ 23) Given unit test ของ action add-to-cart ใน `lib/data/cart.ts` (mock SDK) When เพิ่มสินค้าโดยมี cookie `aff` Then จำนวนครั้งที่เรียก
  retrieve cart เท่ากับก่อน AF-2 (ไม่มี round-trip `GET /store/carts/:id` เพิ่ม) และ metadata ถูกตั้งเมื่อค่าต่าง (unit Vitest)
- AC-23 (AF-3, กฎ 24) Given โปรแกรม P1 active (15%, `attribution_window_days=7`) และ P2 active (10%, `attribution_window_days=14`) ครอบสินค้าเดียวกัน, click เมื่อ
  10 วันก่อน `order.created_at` Then มี attribution `program_id = P2` และ entry คิดที่ 10% (P1 ไม่นับเพราะ window ไม่คลุม click — ถ้า AF-3 ที่ merge คิดจากทุกโปรแกรม
  active ส่วนนี้ย้ายไปแก้ใน AF-4, ดู Q10); Given ไม่มีโปรแกรม active, click 20 วันก่อน Then attribution
  `program_id = null` ไม่มี entry; click 31 วันก่อน Then ไม่มี attribution (integration)
- AC-24 (AF-3, กฎ 24) Given click 6 วันก่อน `order.created_at` (`attribution_window_days=7`) When subscriber ประมวลผล event ช้าไป 3 วัน (ควบคุมเวลาใน test)
  Then ยังมี attribution และ entry (ใช้ `order.created_at` ไม่ใช่เวลาประมวลผล) (integration)
- AC-25 (AF-4, กฎ 26) Given `cap_per_order=฿60`, อัตรา 10%, order มี line L1 (`created_at` ก่อน, ฐาน ฿500) และ L2 (ฐาน ฿500) โดย input ส่ง L2 มาก่อน L1
  Then entry ของ L1 = ฿50 และ L2 = ฿10; สลับลำดับ input อีกแบบ ได้ผลเหมือนเดิม; `created_at` เท่ากัน → ตัดสินด้วย `id` (unit ของฟังก์ชันเรียง/วางแผน)
- AC-26 (AF-6) Given payout `draft` และ payout `paid` ของ Ann When admin เปิดแท็บ Payouts Then เฉพาะแถว `draft` มี `affiliate-payout-cancel`; When กด
  (หรือ `dblclick`) แล้วยืนยัน Then มี request ยกเลิก 1 ครั้งและแถวหายไปโดยไม่ reload; When กดแล้วยกเลิกกล่องยืนยัน Then ไม่มี request (e2e admin)
- AC-27 (AF-9b, กฎ 25) Given Ann มี entry `approved` 3 รายการและ payout `draft` D When ยิง cancel D กับ create payout ช่วงเดียวกันพร้อมกัน 10 รอบ
  Then ไม่มี entry ใดอยู่ใน `entry_ids` ของ payout ที่ยังไม่ถูกลบมากกว่า 1 ตัว; When `DELETE` route ยกเลิก payout โดยไม่มี token admin Then 401 และ payout ไม่เปลี่ยน
  (integration http)

## Non-functional
- Redirect ไม่เขียน DB; < 50ms
- Query ของ ledger มี index บน `(affiliate_id, status, created_at)`; รายงานรวมยอดด้วย SQL
- Maturity job ใช้ index `(status, matures_at)` (เพิ่มใน AF-4)
- Attribution ทนต่อ event ซ้ำ/พร้อมกันด้วย unique `order_id` (กฎ 15); test AC-10 แบบพร้อมกันต้อง assert ว่า**ทั้งสอง** promise เป็น `fulfilled`
  (ตัวที่แพ้ race หยุดเงียบตามกฎ 15 ไม่ throw) — แก้ใน AF-4 (review AF-3)
- payout เลือก entry ด้วย filter ใน DB (AF-9); ยังไม่เพิ่ม GIN index บน `payout.entry_ids` จนกว่าจำนวน payout ทำให้ query ช้าจริง (วัดก่อน — ไม่มี task)

## Test plan
- Unit: การคำนวณค่าคอมมิชชัน (ขอบเขต, cap, ฐานคำนวณ, ปัดเศษ), การตรวจสอบช่วงเวลา `[starts_at, ends_at)` และ `ended` (AC-17 ส่วน logic), การเรียง line (AC-25)
- Integration (http): AC-1..AC-8, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-23, AC-24, AC-27
- e2e: AC-9 + AC-1 แบบ end-to-end พร้อม cookie, AC-21 (AF-3b); unit (Vitest storefront): AC-22 (AF-3b); e2e admin: AC-26 (AF-6, ใช้ helper ของ OPS-11)

## Tasks
| ID | Task | Depends |
|----|------|---------|
| AF-1 | models/service/migrations ของ module + auth ของ actor type `affiliate` (register/login) + unit tests สำหรับการคำนวณค่าคอมมิชชัน (AC-12, AC-15, AC-16) — PR #11 | CORE-2 |
| AF-2 | Tracking redirect + cookie + cart metadata hook ใน storefront (เตรียมสำหรับ AC-3) | AF-1 |
| AF-3 | Subscriber `order.placed` สำหรับ attribution + สร้าง entry (AC-1,2,3,4,8,10,11,17, AC-23, AC-24) (ตามข้อตัดสิน Q2, Q3, Q7 และกฎ 24) — backend เท่านั้น; ส่วน storefront ย้ายไป AF-3b | AF-2 |
| AF-3b | (แยกจาก AF-3, 2026-10-26) storefront: sync cookie `aff` ลง `cart.metadata.affiliate_token` ก่อน `placeOrder` เมื่อค่าต่าง และเลิก round-trip `GET /store/carts/:id` ที่ AF-2 เพิ่มใน add to cart (กฎ 23; AC-21, AC-22) — แตะ `lib/data/cart.ts` | AF-3 |
| AF-4 | Subscriber สำหรับ reversal + maturity job + migration index `(status, matures_at)` (AC-5, AC-6) — ห้ามลบ entry; ตามข้อตัดสิน Q3, Q8; **รวม nit review AF-3**: เรียง `order.items` ตาม `created_at`/`id` ก่อน `planAttribution` (กฎ 26, AC-25), test AC-10 assert ทั้งสอง promise `fulfilled`, log info เมื่อ token หมดอายุ/affiliate ไม่ active | AF-3 |
| AF-5 | Admin APIs + payout workflows (AC-7) (ตามข้อตัดสิน Q8) | AF-1 |
| AF-6 | หน้า Admin UI รวมปุ่มยกเลิก payout `draft` (AC-26) | AF-5, AF-9 (route ยกเลิก) |
| AF-7 | Portal APIs รวม `/affiliate/products` (แปลงขอบเขต → สินค้า ตามกฎ 16, paging) (AC-13, AC-14, AC-18) — หมายเหตุ: ปรับ middleware matcher ให้คลุมทุก `/affiliate/*` ยกเว้น register (กฎ 18) และสิทธิ์ตามสถานะ (Q6) | AF-3 |
| AF-8 | หน้า portal ใน storefront (login ของตัวเอง, เรียก API จาก server side ตามกฎ 17): Products now/soon + Share, Programs, Earnings, Payouts, Profile (Q5) + e2e (AC-9); ข้อความไทยตรงในโค้ด + path ใหม่ใน ESLint rule (spec 01 CORE-4 กฎข้อ 4, ADR-014) | AF-7, AF-4 |
| AF-9 | follow-up AF-5 (เล็ก): `cancelPayoutWorkflow` + admin route ยกเลิก payout `draft` (คืน entry ให้เลือกได้อีก) และย้ายการกรอง entry ของ `createPayoutWorkflow` ไปทำใน DB (filter ตามกฎ 19 แทนโหลด entry ทั้งหมดแล้วกรองในแอป) (AC-19, AC-20; AC-7 ต้องยังผ่าน) | AF-5 |
| AF-9b | follow-up review AF-9 (เล็ก, backend): `cancelPayoutWorkflow` ถือ lock `affiliate-payout:<affiliate_id>` (กฎ 25) + test route ยกเลิกไม่มี token → 401 (AC-27) | AF-9 |
AF-5 → AF-9 → (AF-6 ∥ AF-9b) ∥ AF-3/AF-4; AF-3 → (AF-3b ∥ AF-4 ∥ AF-7); AF-8 หลัง AF-7, AF-4 (AF-3b ไม่บล็อก AF-8 แต่ต้อง merge ก่อน release v0.6.0)
AF-3b แตะ `lib/data/cart.ts` เดียวกับ CORE-14/CORE-4d — ตัวที่ merge ทีหลัง rebase
follow-up review AF-2 (#66, 2026-10-26): fail-fast `AFFILIATE_TOKEN_SECRET` ใน production (กฎ 22) ผนวกเข้า **OPS-7** (spec 07 AC-13) ไม่ใช่ task ของ spec นี้;
`/buy/[items]` ที่สร้าง cart โดยไม่มี token อยู่ใน CORE-14 (spec 01 AC-41) แล้ว

## ข้อตัดสินของ owner (2026-10-25)
- Q1 สมัครเองได้: register → `pending` → admin อนุมัติ
- Q2 ขอบเขต `category_ids` **ไม่นับ** category ลูกใน v1 (admin เลือก category ลูกเองใน UI) ใช้กฎเดียวกันทั้ง AF-3 และ AF-7
- Q3 cap ต่อ order แจกให้ line **ตามลำดับ line item** (แบบที่ AF-1 ทำ ไม่ต้องแก้ `utils/commission.ts`; "ลำดับ" = `created_at` แล้ว `id` ตามกฎ 26);
  partial refund ของ line → reversal = `−entry.amount × ยอดที่คืน / base ของ line` (คิดจาก entry ของ line นั้นเอง)
- Q4 affiliate เปลี่ยน `code` เองไม่ได้ใน v1; คำสงวน `admin, affiliate, store, auth, api, app, www, support, shop, r`
- Q5 portal ไม่ส่ง `payout_info` ออกเลย แสดงเพียง boolean `has_payout_info`; admin เป็นผู้กรอก
- Q6 `pending` เข้าได้เฉพาะ `/affiliate/me`; `suspended` เข้า `/affiliate/me`, earnings, payouts แบบอ่านอย่างเดียว;
  `/affiliate/products` และ programs เฉพาะ `active` อื่น ๆ → 403
- Q7 หลายโปรแกรม active ครอบ line เดียวกัน: ต่อ line เลือกอัตราสูงสุด เสมอกันเลือก `starts_at` ล่าสุด;
  attribution เก็บ `program_id` ของโปรแกรมที่ให้ค่าคอมรวมมากที่สุด
- Q8 maturity job อนุมัติ entry ที่ยอดสุทธิของ line (รวม reversal) > 0; payout = Σ `approved` + Σ `reversed`
  ที่ยังไม่อยู่ใน `entry_ids` ของ payout ใด; ยอดสุทธิ ≤ 0 → ไม่สร้าง payout ยกยอดไปรอบถัดไป
- Q9 (2026-10-25, AF-9) ยกเลิก payout `draft` = soft-delete (ไม่เพิ่มสถานะ `cancelled`)
- กฎ 20 ให้ตรงกับโค้ดของ PR #35 (`draft → ended` ตรงได้)

## Open questions (รอบ 6)
- Q10 (กฎ 24a) เมื่อหลายโปรแกรม active แต่ window ของบางตัวไม่คลุม click: นับค่าคอมเฉพาะโปรแกรมที่ window คลุม click (ค่าเริ่มต้นใน spec — window เป็นของ
  โปรแกรม จึงใช้กับโปรแกรมนั้นเท่านั้น) หรือ "ผ่านด่านด้วยโปรแกรมใดก็ได้แล้วเลือกอัตราสูงสุดจากทุกโปรแกรม active" (ง่ายกว่าแต่ให้ค่าคอมของโปรแกรมที่ window
  สั้นกว่าระยะ click)?
