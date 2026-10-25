# 05 Affiliate — ค่าคอมมิชชันแบบมีช่วงเวลากำหนด

สถานะ: draft
เป้าหมาย (เจ้าของ): โปรแกรม affiliate ที่เปิดค่าคอมมิชชันเป็น **ช่วงเวลา** (แบบแคมเปญ
เหมือน affiliate "ปักหมุดสินค้า" ของ TikTok/Shopee) ไม่ใช่เปิดถาวร ร้านค้าเดียว ไม่ใช่ marketplace
การตัดสินใจ: custom module `affiliate` (ADR-005) การระบุที่มา (attribution) ผ่านลิงก์ติดตาม → cookie →
cart metadata การจ่ายเงิน (โอนธนาคาร) ทำแบบ **manual** โดย admin; ระบบของเราสร้าง ledger ให้
ความต้องการของเจ้าของ: affiliate ต้อง **เห็นว่าสินค้าใดได้ค่าคอมมิชชันตอนนี้หรือเร็ว ๆ นี้** และ
**แชร์** สินค้าเหล่านั้นได้ (ลิงก์รายสินค้า) — ประสบการณ์แบบ "product showcase" ของ TikTok/Shopee
นอกขอบเขต: การจ่ายเงินอัตโนมัติ, โครงสร้างหลายชั้น/referral tree, เครื่องมือทำคอนเทนต์, การปักหมุด
หน้าร้านส่วนตัว (v2)

## สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | วิธีใช้ |
|------|-----------------|-----|
| ตัวตนและการ login ของ affiliate | Auth module **custom actor type `affiliate`** (pattern "custom actor type" ที่ Medusa มีเอกสารรองรับ: `authenticate("affiliate", …)`, `/auth/affiliate/emailpass`) | ใช้ตามเดิม; affiliate ไม่ใช่ customer |
| Orders, ยอดรวม, refunds | Order module + events | subscribe |
| หน้า admin | Admin UI routes/widgets | custom page |
| ส่วนลดเฉพาะ affiliate สำหรับผู้ซื้อ (ไม่บังคับ) | Promotion module (code) | link แบบไม่บังคับ |
| แปลงขอบเขตโปรแกรม → รายการสินค้าพร้อมราคา/รูป | Product module + Query (`useQueryGraphStep`) | ใช้ตามเดิม |

## Data model (module `affiliate`)
```
Affiliate                      // separate actor; may share an email with a customer, no link required
  id, email (unique), name, code (unique slug, indexed), status: "pending"|"active"|"suspended",
  payout_info: json (masked in API), created_at
  // auth identity: Auth module `auth_identity.app_metadata.affiliate_id`

AffiliateProgram          // a commission window
  id, name, starts_at, ends_at,
  status: "draft"|"published"|"ended",   // published = visible to affiliates; "active" / "upcoming" are derived from the window
  announce_text?: text,                       // shown on the portal before start ("coming soon")
  commission_type: "percentage" (v1; fixed types deferred), commission_value,
  scope: { all: bool, variant_ids?: [], collection_ids?: [], category_ids?: [] },
  attribution_window_days: int (default 7), cap_per_order?: bigNumber (major units),
  hold_days: int (default 14)

AffiliateAttribution
  id, order_id (unique), affiliate_id, program_id, attributed_at

CommissionEntry           // ledger, append-only
  id, affiliate_id, program_id, order_id, line_item_id?, amount: bigNumber (major units), currency,
  status: "pending"|"approved"|"reversed"|"paid", reason?, created_at, matures_at
  // unique (order_id, line_item_id, status='pending') to prevent duplicates

Payout
  id, affiliate_id, amount, currency, period_from, period_to, status: "draft"|"paid",
  paid_at?, reference?, entry_ids[]
```

## Workflows
- `trackClickWorkflow(code, path)` (store, public): หา affiliate → ตั้ง signed cookie
  `aff=<signed token>` (สูงสุด 30 วัน แต่ช่วงเวลาของโปรแกรมเป็นตัวกำหนด) การบันทึก click เลื่อนไป v2
- Cart hook: เมื่อสร้าง/อัปเดต cart ใน storefront หากมี cookie → ตั้ง cart
  `metadata.affiliate_token = <signed token>` (HMAC-SHA256 ของ `affiliate_id|clicked_at`
  ด้วย secret ฝั่ง server; storefront เพียงคัดลอกค่า cookie ไม่เคยสร้างเอง)
  Cart metadata เขียนได้จากฝั่ง client ผ่าน Store API ดังนั้น token เป็น input เดียวที่เชื่อถือได้
- Subscriber `order.placed`: ตรวจสอบลายเซ็นของ `affiliate_token` (ปฏิเสธหากไม่ถูกต้อง/หมดอายุ) และ `now - clicked_at ≤ attribution_window`
  และ affiliate ยัง active และ **มีโปรแกรมที่ active** ครอบคลุมเวลาที่สั่งซื้อ → สร้าง
  `AffiliateAttribution` (unique ต่อ order) → คำนวณ entry ต่อ line item ที่เข้าเกณฑ์
  (ขอบเขตโปรแกรม ∩ รายการสินค้าใน order) → insert `CommissionEntry` status `pending`,
  `matures_at = now + hold_days` การซื้อเอง (อีเมลลูกค้าของ order == อีเมล affiliate) → ไม่ได้ค่าคอมมิชชัน
- Subscriber เมื่อ refund/cancel/return: insert entry แบบ `reversed` สำหรับยอดที่ได้รับผลกระทบ
  (ไม่แก้ไข entry เดิม; ledger เป็น append-only)
- Scheduled job รายวัน: entry `pending` ที่ `matures_at <= now` และไม่มี reversal → `approved`
- `createPayoutWorkflow(affiliate, period)` admin: รวม `approved` ที่ยังไม่จ่าย → Payout draft;
  `markPayoutPaid` → entry เป็น `paid`

## API
- Store (public): `GET /store/affiliate/r/:code?to=/path` → ตั้ง cookie, 302 ไปยัง path
- Affiliate portal (actor `affiliate`, `authenticate("affiliate", ["session","bearer"])`):
  `POST /affiliate/register` (หลัง `/auth/affiliate/emailpass/register`; สร้าง affiliate สถานะ `pending`
  และตั้ง `app_metadata.affiliate_id`), `GET /affiliate/me`, `GET /affiliate/me/programs`,
  `GET /affiliate/me/earnings?from&to`,
  `GET /affiliate/products?status=active|upcoming&page=` → สินค้าในโปรแกรมที่ published
  (สินค้า, ราคา variant, รูป, % ค่าคอมมิชชัน, ชื่อโปรแกรม, starts_at/ends_at,
  `share_url` = `{storefront}/r/{code}?to=/products/{handle}`) เรียงตาม starts_at
  Login ผ่าน `/auth/affiliate/emailpass`
  route `/store/*` ของ customer ไม่ถูกแก้ไข; ไม่จำเป็นต้องเป็น customer
- Admin: CRUD โปรแกรม; รายการ affiliate/อนุมัติ/ระงับ; `GET /admin/affiliate/entries`;
  สร้าง payout/ทำเครื่องหมายว่าจ่ายแล้ว; `GET /admin/affiliate/reports/summary`

## Admin UI / Storefront
- Admin: route page "Affiliate" → Programs (รายการพร้อมวันที่), Affiliates, Ledger, Payouts
- Storefront: portal `/affiliate/*` ที่มี login/register ของตัวเอง (affiliate session แยกจาก
  customer session):
  - **Products** (หน้าแรก): สองแท็บ "Earning now" / "Coming soon"; แต่ละการ์ดแสดงรูป,
    ชื่อ, ราคา, % ค่าคอมมิชชัน และยอดประมาณการเป็น ฿ ที่ราคาปัจจุบัน, วันที่ของโปรแกรม (นับถอยหลังถึง
    วันเริ่มสำหรับ upcoming) และปุ่ม **Share** (คัดลอกลิงก์; ใช้ Web Share เมื่อ browser รองรับ
    โดยมีการคัดลอกเป็น fallback) สินค้า upcoming แชร์ล่วงหน้าได้ — ลิงก์ใช้งานได้
    ทันทีและเริ่มได้ค่าคอมมิชชันเมื่อช่วงเวลาเปิด
  - Programs, Earnings (pending/approved/paid), Payouts, Profile (code, ลิงก์เริ่มต้น)
  หน้า landing สาธารณะผ่าน `/r/<code>`

## Business rules
1. ค่าคอมมิชชันเกิดขึ้น **เฉพาะ** เมื่อ order ถูกสั่งภายในช่วงเวลาของโปรแกรมที่ active และ
   ภายใน attribution window ของ affiliate นับจากการ click ไม่มีโปรแกรม active → ไม่มีค่าคอมมิชชัน
   แม้ cookie จะยังใช้ได้
2. ใช้ last-click attribution cookie จะถูกเขียนทับเมื่อมีการ click จาก affiliate รายใหม่กว่า
3. ฐานคำนวณค่าคอมมิชชัน = ยอดที่ **ชำระจริง** ของ line item หลังหักส่วนลด ไม่รวมค่าจัดส่งและภาษี
4. บังคับใช้ cap ต่อ order ตอนสร้าง entry
5. Entry เป็น append-only; การกลับรายการ (reversal) เป็น entry ติดลบแยกต่างหาก
6. `hold_days` ป้องกันช่วงเวลาที่อาจมี refund; จ่ายได้เฉพาะ entry ที่ `approved`
7. Affiliate ต้องเป็น `active` ทั้งตอน click และตอนสั่งซื้อ
8. PII: `payout_info` ถูก mask ใน store API; ค่าเต็มดูได้เฉพาะ admin
9. การมองเห็น: เฉพาะโปรแกรมที่ `published` เท่านั้นที่แสดงบน portal; `active` = อยู่ในช่วงเวลา,
   `upcoming` = `starts_at > now` โปรแกรม draft จะไม่แสดง

## Acceptance criteria
- AC-1 เมื่อมีโปรแกรม P ที่ active (10%, สินค้าทั้งหมด, ช่วงเวลาวันนี้) และผู้ซื้อ click
  `/r/ann` แล้วสั่งซื้อ ฿1,000 (ไม่รวมค่าจัดส่ง/ภาษี) ภายในช่วงเวลา แล้วต้องมี entry สถานะ pending จำนวน ฿100 สำหรับ Ann
- AC-2 เมื่อไม่มีโปรแกรม active ณ เวลาสั่งซื้อ flow เดียวกัน → บันทึก attribution แต่ **ไม่มี** entry
- AC-3 เมื่อ click เมื่อ 10 วันก่อนและ `attribution_window_days=7` → ไม่มี attribution
- AC-4 เมื่อขอบเขตโปรแกรม = collection C, order มี 1 รายการใน C (฿500) และ 1 รายการที่ไม่อยู่ใน C → entry ฿50
- AC-5 เมื่อมี refund เต็มจำนวนหลังสร้าง entry → มี entry `reversed` จำนวน −฿100; ยอดสุทธิ 0
- AC-6 เมื่อ `hold_days=14` entry จะเป็น `approved` หลังผ่านไป 14 วันเท่านั้น (job ที่ควบคุมเวลาได้)
- AC-7 Admin สร้าง payout ให้ Ann สำหรับเดือนที่แล้ว → รวม entry ที่ approved; ทำเครื่องหมายจ่ายแล้ว → entry เป็น `paid`
- AC-8 order ที่อีเมลลูกค้าตรงกับอีเมลของ affiliate → ไม่มี entry
- AC-12 affiliate สามารถ register และ login ที่ `/auth/affiliate/emailpass` ได้โดยไม่ต้องมี
  customer account; customer session ไม่สามารถเข้าถึง `/affiliate/me` ได้ (401)
- AC-9 Affiliate portal แสดงหน้า Products พร้อมแท็บ "Earning now" และ "Coming soon" แต่ละการ์ด
  มี % ค่าคอมมิชชันและวันที่ และปุ่ม Share คัดลอกลิงก์รายสินค้าได้ (screenshots)
- AC-13 เมื่อโปรแกรม P2 ถูก published โดย `starts_at` เป็นวันพรุ่งนี้ (ขอบเขต: collection C) แล้ว
  `GET /affiliate/products?status=upcoming` ต้องแสดงสินค้าใน C พร้อมอัตราและวันเริ่มของ P2
  และ `status=active` ต้องไม่แสดง; สินค้าของโปรแกรม draft ต้องไม่แสดงในทั้งสองแบบ
- AC-14 ผู้ซื้อที่ click ลิงก์แชร์สินค้า upcoming วันนี้และสั่งซื้อพรุ่งนี้หลัง
  `starts_at` (ภายใน attribution window) ทำให้ได้ค่าคอมมิชชัน; สั่งซื้อวันนี้ไม่ได้ค่าคอมมิชชัน
- AC-10 การส่ง event `order.placed` ซ้ำ → มี attribution และชุด entry เพียงชุดเดียว
- AC-11 เมื่อ cart metadata มี `affiliate_token` ที่ถูกปลอมแปลง/ดัดแปลง เมื่อสั่งซื้อแล้ว
  ต้องไม่มีการสร้าง attribution และ entry และมีการ log event นั้น

## Non-functional
- Redirect ไม่เขียน DB; < 50ms
- Query ของ ledger มี index บน `(affiliate_id, status, created_at)`; รายงานรวมยอดด้วย SQL

## Test plan
- Unit: การคำนวณค่าคอมมิชชัน (ขอบเขต, cap, ฐานคำนวณ), การตรวจสอบช่วงเวลา
- Integration (http): AC-1..AC-8, AC-10, AC-11, AC-12, AC-13, AC-14
- e2e: AC-9 + AC-1 แบบ end-to-end พร้อม cookie

## Tasks
| ID | Task | Depends |
|----|------|---------|
| AF-1 | models/service/migrations ของ module + auth ของ actor type `affiliate` (register/login) + unit tests สำหรับการคำนวณค่าคอมมิชชัน (AC-12) | CORE-2 |
| AF-2 | Tracking redirect + cookie + cart metadata hook ใน storefront (เตรียมสำหรับ AC-3) | AF-1 |
| AF-3 | Subscriber `order.placed` สำหรับ attribution + สร้าง entry (AC-1,2,3,4,8,10,11) | AF-2 |
| AF-4 | Subscriber สำหรับ reversal + maturity job (AC-5, AC-6) | AF-3 |
| AF-5 | Admin APIs + payout workflows (AC-7) | AF-1 |
| AF-6 | หน้า Admin UI | AF-5 |
| AF-7 | Portal APIs รวม `/affiliate/products` (แปลงขอบเขต → สินค้า, paging) (AC-13, AC-14) | AF-3 |
| AF-8 | หน้า portal ใน storefront (login ของตัวเอง): Products now/soon + Share, Programs, Earnings, Payouts + e2e (AC-9) | AF-7, AF-4 |
AF-5/AF-6 ∥ AF-3/AF-4; AF-7 ∥ AF-4

## Open questions
- Q1 เปิดให้ affiliate สมัครเองได้ทุกคน หรือเฉพาะผู้ได้รับเชิญ? (ค่าเริ่มต้น: register → `pending` → admin อนุมัติ)
- Q2 affiliate ควรมีหน้าสาธารณะส่วนตัวที่แสดงสินค้าที่เลือกปักหมุดไว้
  (`/a/<code>`) หรือไม่? (ค่าเริ่มต้น: v2; ลิงก์แชร์รายสินค้าครอบคลุม v1 แล้ว)
