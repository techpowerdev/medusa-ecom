# 05 Affiliate — ค่าคอมมิชชันแบบมีช่วงเวลากำหนด

สถานะ: in-progress (AF-1 = PR #11; รอบ 7 2026-10-26: กฎ 19 แก้, กฎ 27–28, AC-28..31)
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
27. (owner 2026-10-26, AF-4) attribution **ไม่สร้าง entry** ให้ order ที่ถูกยกเลิกแล้ว: workflow attribution อ่าน `order.status` (`canceled`) **หลัง**ถือ lock
    `affiliate-attribution:<order_id>` (Locking module) — ยกเลิกแล้ว → ไม่สร้างทั้ง `AffiliateAttribution` และ entry (log info `order_canceled`; Q13 — ตามที่ #91 ทำ); reversal ที่มาจาก cancel ต้องถือ lock key เดียวกัน เพื่อให้ลำดับเป็น
    "attribution ก่อน → reversal เห็น entry" หรือ "cancel ก่อน → attribution เห็น `canceled`" เสมอ (ไม่มี entry pending ค้างของ order ที่ยกเลิก)
28. (การตีความของ AF-4 #90 ที่ **owner ยืนยัน 2026-10-26** — แทนข้อตัดสิน Q3 ส่วน partial refund) เหตุที่ทำให้เกิด reversal มีเพียง cancel, refund เต็ม และการคืนของ:
    (a) **cancel** order → reverse ยอดสุทธิที่เหลือของทุก line
    (b) **refund เต็มจำนวน** — เกณฑ์คือ `isOrderFullyRefunded` (helper ของ #90: ยอด refund สะสมของ order ≥ ยอดที่ชำระ, เทียบด้วย `MathBN`) → reverse ยอดสุทธิที่เหลือของทุก line
    (c) **return** → ต่อ line: จำนวนคืน = จำนวน **received + dismissed** (dismissed = รับคืนแบบชำรุด) ของ return item ของ line นั้น;
        reversal = `−entry.amount × จำนวนคืน / line.quantity` (ปัด 2 ตำแหน่ง half-up, `MathBN`) และรวม reversal ของ line ไม่เกิน `entry.amount`
    (d) **refund บางส่วนที่ไม่ได้มาจาก return** (เช่น admin คืนเงินบางส่วนเพื่อชดเชย) → **ไม่** reverse; ถ้าจำเป็น admin ปรับค่าคอมเองนอกระบบ
        (v1 ไม่มี route/UI ปรับ entry ด้วยมือ — ถ้าต้องการต้องเป็น task ใหม่)

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

## Tasks
| ID | Task | Depends |
|----|------|---------|
| AF-1 | models/service/migrations ของ module + auth ของ actor type `affiliate` (register/login) + unit tests สำหรับการคำนวณค่าคอมมิชชัน (AC-12, AC-15, AC-16) — PR #11 | CORE-2 |
| AF-2 | Tracking redirect + cookie + cart metadata hook ใน storefront (เตรียมสำหรับ AC-3) | AF-1 |
| AF-3 | Subscriber `order.placed` สำหรับ attribution + สร้าง entry (AC-1,2,3,4,8,10,11,17) (ตามข้อตัดสิน Q2, Q3, Q7 และกฎ 24 — #77 กรองตาม window ของแต่ละโปรแกรมและใช้ `order.created_at` แล้ว มี unit test) — backend เท่านั้น; ส่วน storefront ย้ายไป AF-3b | AF-2 |
| AF-3b | (แยกจาก AF-3, 2026-10-26) storefront: sync cookie `aff` ลง `cart.metadata.affiliate_token` ก่อน `placeOrder` เมื่อค่าต่าง และเลิก round-trip `GET /store/carts/:id` ที่ AF-2 เพิ่มใน add to cart (กฎ 23; AC-21, AC-22) — แตะ `lib/data/cart.ts` | AF-3 |
| AF-4 | Subscriber สำหรับ reversal + maturity job + migration index `(status, matures_at)` (AC-5, AC-6) — ห้ามลบ entry; ตามข้อตัดสิน Q8; **เพิ่ม 2026-10-26 (owner, review #90)**: เหตุของ reversal ตามกฎ 28 (AC-30, AC-31), reversal จาก cancel ถือ lock `affiliate-attribution:<order_id>` (กฎ 27, AC-29 ส่วน reversal — #90 ทำแล้ว), payout เลือก reversed เฉพาะที่ต้นทาง approved/paid (กฎ 19, AC-28 — แก้ filter ของ `createPayoutWorkflow`) — ◐ #90 (nit review AF-3 ย้ายไป AF-4b) | AF-3 |
| AF-4b | (แยกจาก AF-4, ◐ #91) nit review AF-3 ฝั่ง attribution: เรียง `order.items` ตาม `created_at`/`id` ก่อน `planAttribution` (กฎ 26, AC-25), log info เมื่อ token หมดอายุ/affiliate ไม่ active, integration test ของกฎ 24 (AC-23, AC-24), test AC-10 assert ทั้งสอง promise `fulfilled` + attribution ข้าม order ที่ยกเลิกแล้วใต้ lock `affiliate-attribution:<order_id>` (กฎ 27, AC-29 ส่วน attribution) | AF-3 (∥ AF-4; แตะ workflow attribution — ถ้าชนกับ #90 ที่ lock ตัวที่ merge ทีหลัง rebase) |
| AF-5 | Admin APIs + payout workflows (AC-7) (ตามข้อตัดสิน Q8) | AF-1 |
| AF-6 | หน้า Admin UI รวมปุ่มยกเลิก payout `draft` (AC-26) | AF-5, AF-9 (route ยกเลิก) |
| AF-7 | Portal APIs รวม `/affiliate/products` (แปลงขอบเขต → สินค้า ตามกฎ 16, paging) (AC-13, AC-14, AC-18) — หมายเหตุ: ปรับ middleware matcher ให้คลุมทุก `/affiliate/*` ยกเว้น register (กฎ 18) และสิทธิ์ตามสถานะ (Q6) | AF-3 |
| AF-8 | หน้า portal ใน storefront (login ของตัวเอง, เรียก API จาก server side ตามกฎ 17): Products now/soon + Share, Programs, Earnings, Payouts, Profile (Q5) + e2e (AC-9); ข้อความไทยตรงในโค้ด + path ใหม่ใน ESLint rule (spec 01 CORE-4 กฎข้อ 4, ADR-014) | AF-7, AF-4 |
| AF-9 | follow-up AF-5 (เล็ก): `cancelPayoutWorkflow` + admin route ยกเลิก payout `draft` (คืน entry ให้เลือกได้อีก) และย้ายการกรอง entry ของ `createPayoutWorkflow` ไปทำใน DB (filter ตามกฎ 19 แทนโหลด entry ทั้งหมดแล้วกรองในแอป) (AC-19, AC-20; AC-7 ต้องยังผ่าน) | AF-5 |
| AF-9b | follow-up review AF-9 (เล็ก, backend): `cancelPayoutWorkflow` คง lock `affiliate-payout-paid:<payout_id>` และเพิ่ม `affiliate-payout:<affiliate_id>` ตามลำดับตายตัว (กฎ 25) + test บังคับ path compensation ของ cancel + test route ยกเลิกไม่มี token → 401 (AC-27) | AF-9 |
AF-5 → AF-9 → (AF-6 ∥ AF-9b) ∥ AF-3/AF-4; AF-3 → (AF-3b ∥ AF-4 ∥ AF-4b ∥ AF-7); AF-8 หลัง AF-7, AF-4 (AF-3b ไม่บล็อก AF-8 แต่ต้อง merge ก่อน release v0.6.0)
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
- Q8 maturity job อนุมัติ entry ที่ยอดสุทธิของ line (รวม reversal) > 0; payout = Σ `approved` + Σ `reversed`
  ที่ยังไม่อยู่ใน `entry_ids` ของ payout ใด; ยอดสุทธิ ≤ 0 → ไม่สร้าง payout ยกยอดไปรอบถัดไป
- Q9 (2026-10-25, AF-9) ยกเลิก payout `draft` = soft-delete (ไม่เพิ่มสถานะ `cancelled`)
- กฎ 20 ให้ตรงกับโค้ดของ PR #35 (`draft → ended` ตรงได้)

## Open questions (รอบ 6–7)
- ~~Q10~~ ตัดสินแล้ว (owner 2026-10-26): เมื่อหลายโปรแกรม active นับค่าคอม**เฉพาะโปรแกรมที่ window คลุมวันคลิก** (ตามที่ #77 ทำ) — กฎ 24a, AC-23
- ~~Q11~~ ตัดสินแล้ว (owner 2026-10-26, รอบ 7): payout เลือก reversed เฉพาะที่ต้นทาง approved/paid (กฎ 19, AC-28); order ที่ยกเลิกแล้วไม่ได้ entry (กฎ 27, AC-29);
  ยอมรับการตีความของ #90: refund บางส่วนที่ไม่ได้มาจากการคืนของไม่หักค่าคอม, การคืนนับ received + dismissed / quantity, admin ปรับเองถ้าจำเป็น (กฎ 28, AC-30, AC-31)
- ~~Q12~~ ปิดแล้ว (2026-10-26): #91 = AF-4b (เรียง line, log info, test AC-10/23/24, กฎ 27 ฝั่ง attribution); filter payout กฎ 19 อยู่ใน AF-4 #90
- ~~Q13~~ ใช้ค่าเริ่มต้น (session หลักเลือก 2026-10-26, **รอ owner ยืนยัน**): order ที่ยกเลิกก่อน attribution ไม่บันทึกทั้ง `AffiliateAttribution` และ entry (ตามที่ AF-4b #91 ทำ — order ที่ยกเลิกแล้ว
  ไม่มีอะไรให้ idempotency ต้องกัน; redeliver ซ้ำได้ผลเดิม) — กฎ 27
