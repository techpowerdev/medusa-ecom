# 04 Group buying — ส่วนลดแบบมีเป้าหมายและจำกัดเวลา

สถานะ: draft (ปรับดีไซน์ 2026-10-25 ตามความต้องการของเจ้าของ: ใช้ flow แบบ draft order เหมือนตัวอย่าง Quotes ของ Medusa)
เป้าหมาย (เจ้าของ): แคมเปญที่มีกำหนดเวลา โดยส่วนลดจะมีผลก็ต่อเมื่อถึงเป้าหมายที่กำหนดเท่านั้น
เป้าหมายอาจเป็น **จำนวนออเดอร์ (orders)**, **จำนวนชิ้น (units)** หรือ **จำนวนคน (people)** ข้อจำกัด: จำนวนออเดอร์รวม,
จำนวนชิ้นต่อคน, จำนวนคนต่อกลุ่ม กลุ่มมีสองแบบคือ **pool** ที่ admin สร้าง หรือ **team** ที่ลูกค้าสร้างเอง
ขึ้นอยู่กับการตั้งค่าแคมเปญ **การเข้าร่วมจะสร้าง draft order** (ยังไม่ชำระเงิน);
เมื่อถึงเป้าหมาย สมาชิกจะได้รับการแจ้งเตือนพร้อมลิงก์/หน้าชำระเงิน; หากไม่ถึงเป้าหมาย
draft order จะถูกยกเลิกและแจ้งสมาชิก ต้อง login ก่อนจึงจะเข้าร่วมได้
การตัดสินใจ: custom module `group_buy` (ADR-004); ส่วนลด **ใช้ผ่าน Promotion module**
(หนึ่ง promotion code ต่อหนึ่งกลุ่ม), draft order ผ่าน Order module ของ Medusa
นอกขอบเขต: การแชร์ไปโซเชียลที่มากกว่าลิงก์แชร์, เป้าหมายแบบหลายระดับ (tiered), การชำระเงินบางส่วน

## สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | วิธีใช้ |
|------|-----------------|-----|
| ใส่ส่วนลด % / จำนวนคงที่ให้ cart | Promotion module (แบบใช้ code) | 1 promotion ต่อกลุ่ม, `is_automatic=false` |
| ช่วงเวลา | Campaign | 1 campaign ต่อหนึ่งแคมเปญ group-buy |
| สร้าง draft order จาก cart แล้วแปลงและชำระเงินภายหลัง | draft order ของ Order module (`createOrderWorkflow` พร้อม `is_draft_order`, `convertDraftOrderWorkflow`) + payment collection บน order — เป็น pattern เดียวกับตัวอย่าง **Quotes** ของ Medusa | ใช้ตามเดิม |
| Payment collection สำหรับ order ที่มีอยู่แล้ว | `createOrderPaymentCollectionWorkflow` + payment sessions | ใช้ตามเดิม |
| ยกเลิก draft order | `cancelOrderWorkflow` | ใช้ตามเดิม |
| ตัวตนลูกค้า, auth | Customer + Auth modules | ใช้ตามเดิม (ต้อง login) |
| อีเมล | Notification module | templates |
| หน้า admin | Admin UI routes | custom page |

## ดีไซน์หลัก: สร้าง draft order ตอนเข้าร่วม ชำระเงินเมื่อสำเร็จ
1. ลูกค้า (login แล้ว) เข้าร่วมกลุ่มพร้อม cart → ใส่ promotion code `GB-<token>` →
   แปลง cart เป็น **draft order** (status `pending`, `is_draft_order=true`, ยังไม่ชำระเงิน)
   สร้าง membership + ตัวนับความคืบหน้าใน transaction เดียวกัน
2. ทันทีที่ถึงเป้าหมาย (หรือเมื่อถึง `ends_at` หากถึงเป้าหมายภายในเวลานั้น) กลุ่มจะ **สำเร็จ (succeeded)**:
   สมาชิกแต่ละคนจะได้รับอีเมลพร้อมลิงก์ชำระเงิน `/account/orders/:id/pay` และมีช่วงเวลาชำระเงิน
   `pay_within_hours` (ตั้งค่าที่แคมเปญ ค่าเริ่มต้น 24 ชม.)
3. สมาชิกชำระเงิน (บัตรหรือ PromptPay) ผ่าน payment collection ของ order → เมื่อ captured แล้ว
   draft order จะถูก **แปลง** เป็น order ปกติ (`convertDraftOrderWorkflow`) และเข้าสู่ขั้นตอน fulfillment
   หากไม่ชำระภายในกำหนด → draft order ถูกยกเลิกและแจ้งสมาชิก
4. เมื่อถึง `ends_at` แต่ไม่ถึงเป้าหมาย → กลุ่ม **ล้มเหลว (failed)**: draft order ทั้งหมดถูกยกเลิก และแจ้งสมาชิก
เหตุผลที่เลือกแบบนี้แทนการชำระเงินตอนเข้าร่วม: refund น้อยกว่า, ไม่มีข้อจำกัดเรื่องระยะเวลา auth-hold, และตรงกับ
pattern ที่ Medusa มีเอกสารรองรับ ข้อแลกเปลี่ยน: สมาชิกอาจไม่ชำระเงินหลังกลุ่มสำเร็จ (บรรเทาด้วยช่วงเวลาชำระเงิน
และรายงาน `min_paid_ratio` ไม่ใช่การบล็อก fulfillment ของคนที่ชำระแล้ว)

## Data model (module `group_buy`)
```
GroupBuyCampaign
  id, name,   // discount type/value, product scope, starts_at/ends_at live on the linked
              // Medusa campaign + promotion; read via link, never duplicated here
  target_type: "orders"|"units"|"people", target_value: int,
  max_total_orders: int?, max_units_per_person: int?, max_people_per_group: int?,
  group_mode: "pool"|"team"|"both",
  team_duration_hours: int?,          // team deadline = min(created_at + h, campaign.ends_at)
  pay_within_hours: int (default 24),
  status: "draft"|"active"|"ended",
  promotion_campaign_id (link)

GroupBuyGroup
  id, campaign_id, kind: "pool"|"team", created_by_customer_id?,
  name?, join_token (unique), starts_at, ends_at,
  promotion_id (link → Medusa promotion, code = "GB-<token>"),
  status: "open"|"succeeded"|"failed",
  succeeded_at?, pay_deadline_at?,
  progress_orders: int, progress_units: int, progress_people: int   // denormalized, atomic

GroupBuyMembership
  id, group_id, customer_id, order_id (unique, draft order), units: int, joined_at,
  status: "joined"|"awaiting_payment"|"paid"|"cancelled"
  // unique (group_id, customer_id)
```
Links: `group_buy_group ↔ promotion`, `group_buy_campaign ↔ promotion_campaign`,
`group_buy_membership ↔ order`

## Workflows
- `createGroupBuyCampaignWorkflow` → สร้าง Medusa campaign + campaign ของเรา (compensate: ลบ)
- `createGroupWorkflow(campaign, kind, customer)` → ตรวจสอบ mode และข้อจำกัด → สร้าง Medusa
  promotion (แบบใช้ code, rules: ขอบเขตของแคมเปญ) → สร้างกลุ่ม
- `joinGroupWorkflow(group, cart, customer)` (ต้อง auth):
  1. lock แถวของกลุ่ม (`SELECT ... FOR UPDATE`) → ตรวจว่ากลุ่ม `open`, ยังไม่หมดเวลา, ลูกค้ายังไม่ได้อยู่ในกลุ่มใด
     ของแคมเปญนี้, `progress_people < max_people_per_group`,
     `max_total_orders` ของแคมเปญ, จำนวนชิ้นใน cart ≤ `max_units_per_person`, cart มีเฉพาะสินค้า
     ในขอบเขตแคมเปญ, cart ไม่มี promotion code อื่น (กฎข้อ 7);
  2. ใส่ `GB-<token>` ให้ cart (`updateCartPromotionsWorkflow`);
  3. สร้าง draft order จาก cart (`createOrderWorkflow`, `is_draft_order: true`,
     metadata `{group_buy_group_id, group_buy_membership_id}`) — compensation: ยกเลิก order นั้น;
  4. สร้าง membership (`joined`) + เพิ่มตัวนับแบบ atomic;
  5. หากถึงเป้าหมาย → emit `group_buy.group.succeeded`
  ขั้นตอน 1 และ 4 ใช้ lock เดียวกัน; ทั้งหมดอยู่ใน workflow เดียวพร้อม compensation
- `succeedGroupWorkflow(group_id)` (ทำงานเมื่อมี event และจาก deadline job): ตั้งเป็น `succeeded`,
  `pay_deadline_at = now + pay_within_hours`; สำหรับแต่ละ membership ที่ `joined`: สร้าง payment
  collection บน draft order, ตั้งเป็น `awaiting_payment`, ส่งอีเมล "กลุ่มสำเร็จ — ชำระเงินได้เลย"
  Idempotent: ข้าม membership ที่เป็น `awaiting_payment`/`paid` อยู่แล้ว
- `failGroupWorkflow(group_id)`: ตั้งเป็น `failed`; สำหรับแต่ละ membership ที่ `joined`:
  `cancelOrderWorkflow(order)`, ตั้งเป็น `cancelled`, ส่งอีเมล "กลุ่มไม่สำเร็จ" Idempotent
- Subscriber `payment.captured` (order มี `group_buy_membership_id`): membership → `paid`;
  `convertDraftOrderWorkflow(order)` Idempotent ผ่าน status ของ membership
- Scheduled job ทุก 1 นาที:
  - กลุ่ม `open` ที่ `ends_at <= now` → ถึงเป้าหมาย ? succeed : fail;
  - membership `awaiting_payment` ที่กลุ่มมี `pay_deadline_at <= now` →
    `cancelOrderWorkflow` + `cancelled` + อีเมล "หมดเวลาชำระเงิน"
- Store `leaveGroupWorkflow` (สมาชิก, ก่อนกลุ่มสำเร็จ): ยกเลิก draft order, membership
  เป็น `cancelled`, ลดตัวนับ

## API (store route ทั้งหมดต้อง auth ด้วย customer)
- Admin: CRUD `/admin/group-buy/campaigns`, `POST /admin/group-buy/campaigns/:id/groups`
  (pool), `GET .../groups`, `POST /admin/group-buy/groups/:id/succeed|fail` (override แบบ manual)
- Store: `GET /store/group-buy/campaigns/active`, `GET /store/group-buy/groups/:token`
  (ความคืบหน้า, deadline, จำนวนสมาชิก), `POST /store/group-buy/groups` (team),
  `POST /store/group-buy/groups/:token/join` `{cart_id}`, `POST /store/group-buy/memberships/:id/leave`
- หน้าชำระเงินใช้ store payment-collection route ที่ Medusa มีอยู่แล้วบน order
  (เหมือนตัวอย่าง Quotes); ไม่มี custom payment route

## Admin UI / Storefront
- Admin: route page "Group buying" → แคมเปญ, กลุ่มพร้อมความคืบหน้าและ status, membership
  พร้อม order + สถานะการชำระเงิน, succeed/fail แบบ manual
- Storefront: หน้าแคมเปญ; หน้ากลุ่ม (progress bar, นับถอยหลัง, จำนวนสมาชิก, ปุ่ม "Join",
  ปุ่ม "Create team" เมื่ออนุญาต → ลิงก์แชร์ `/g/<token>`); รายการ order ในหน้า account แสดง draft
  order ของกลุ่มพร้อมสถานะ (รอกลุ่ม / ชำระเงินภายใน <deadline> / ชำระแล้ว / ยกเลิก);
  หน้าชำระเงิน `/account/orders/:id/pay` (บัตร + PromptPay, spec 06)

## Business rules
1. เป้าหมาย: `orders` = จำนวน membership ที่ไม่ถูกยกเลิก; `units` = ผลรวมจำนวนชิ้น; `people` =
   จำนวนลูกค้าที่ไม่ซ้ำกัน
2. Deadline ของกลุ่ม: pool → `ends_at` ของแคมเปญ; team → `min(created + team_duration_hours, campaign.ends_at)`
3. ลูกค้าหนึ่งคนอยู่ได้หนึ่งกลุ่มต่อแคมเปญ ทุกการกระทำเกี่ยวกับกลุ่มต้อง login
4. ข้อจำกัดทั้งหมดถูกบังคับใช้ภายใต้ lock แถวของกลุ่มใน `joinGroupWorkflow`
5. จำนวนส่วนลดมาจาก Medusa promotion เท่านั้น และถูก freeze ไว้ในยอดรวมของ draft order
   ณ เวลาที่เข้าร่วม
6. Draft order **ไม่** จอง inventory; สต็อกจะถูกตรวจสอบตอนชำระเงินโดยขั้นตอน order completion
   ปกติของ Medusa Admin เห็น "สมาชิก vs ชำระแล้ว" ต่อกลุ่ม
7. **Exclusivity**: cart ที่มี promotion `GB-*` ห้ามมี promotion code อื่น และในทางกลับกันก็เช่นกัน
   (hook บน `updateCartPromotionsWorkflow`; error `PROMOTION_NOT_COMBINABLE`)
   ใช้ implementation ร่วมกับ flash sale (spec 03, กฎข้อ 6)
8. กลุ่มสำเร็จได้มากที่สุดครั้งเดียว; ขั้นตอน succeed/fail/cancel ต้อง idempotent และรันซ้ำได้
9. อีเมล: เข้าร่วมแล้ว, กลุ่มสำเร็จ (ลิงก์ชำระเงิน + deadline), ได้รับการชำระเงินแล้ว, กลุ่มไม่สำเร็จ,
   หมดเวลาชำระเงิน

## Acceptance criteria
- AC-1 เมื่อมีแคมเปญ (เป้าหมาย 3 ออเดอร์, −30%) และลูกค้าที่ login แล้ว 3 คนเข้าร่วม pool P แล้ว
  ภายใน 60 วินาที กลุ่มต้องเป็น `succeeded`, แต่ละคนมี draft order พร้อม payment collection และ
  แต่ละคนได้รับอีเมลพร้อมลิงก์ชำระเงิน
- AC-2 จาก AC-1 เมื่อสมาชิกชำระเงินด้วยบัตรทดสอบในหน้าชำระเงิน แล้ว draft order ของเขา
  ต้องกลายเป็น order ปกติที่ `payment_status=captured` และ membership เป็น `paid`
- AC-3 เมื่อแคมเปญมีสมาชิก 2 คน ณ `ends_at` แล้ว draft order ทั้งสองต้องถูกยกเลิก,
  membership เป็น `cancelled`, ลูกค้าทั้งสองได้รับอีเมล; ไม่มีการสร้าง payment collection
- AC-4 เมื่อ `max_people_per_group=2` การเข้าร่วมคนที่ 3 ต้องได้ 409
- AC-5 เมื่อ `max_units_per_person=1` การเข้าร่วมด้วย cart ที่มี qty 2 ต้องได้ 409
- AC-6 เมื่อ `group_mode=pool` การสร้าง team ต้องได้ 403; เมื่อเป็น `both` team ต้องถูกสร้างพร้อม
  ลิงก์แชร์และ deadline ของตัวเอง
- AC-7 เมื่อสมาชิกออกจากกลุ่มก่อนกลุ่มสำเร็จ ความคืบหน้าต้องลดลง, draft order ของเขาถูกยกเลิก
  และเขาสามารถเข้าร่วมใหม่ได้
- AC-8 การเข้าร่วมพร้อมกัน 20 ครั้งกับ `max_people_per_group=5` → ต้องมี membership พอดี 5 รายการ
- AC-9 การรัน succeed/fail สองครั้งกับกลุ่มเดียวกันต้องไม่สร้าง payment collection,
  การยกเลิก หรืออีเมลซ้ำ
- AC-10 เมื่อกลุ่มสำเร็จและ `pay_within_hours=1` สมาชิกที่ยังไม่ชำระหลัง 1 ชม. ต้องมี
  order ที่ถูกยกเลิกและได้รับอีเมล "หมดเวลา"; สมาชิกที่ชำระแล้วไม่ได้รับผลกระทบ
- AC-11 `target_type=units`, เป้าหมาย 10: รวม 10 ชิ้นจากออเดอร์ใด ๆ → succeeded; 9 ชิ้น → failed
- AC-12 `target_type=people`, เป้าหมาย 3: ลูกค้า 3 คนไม่ซ้ำกัน (คนหนึ่งมี 2 ออเดอร์) → succeeded;
  ลูกค้า 2 คนรวม 4 ออเดอร์ → failed
- AC-13 แคมเปญ `max_total_orders=5`: การเข้าร่วมครั้งที่ 6 ในกลุ่มใดก็ตามต้องได้ 409
- AC-14 cart ที่มี code `SAVE10` ไม่สามารถเข้าร่วมได้ (409 `PROMOTION_NOT_COMBINABLE`); หลังเข้าร่วมแล้ว
  การใส่ `SAVE10` ให้ cart ที่มี `GB-*` ต้องถูกปฏิเสธ
- AC-15 join/create/leave โดยไม่ auth → 401
- AC-16 Storefront: หน้ากลุ่มแสดงความคืบหน้า/นับถอยหลัง/สมาชิก; หน้า account แสดง "ชำระเงินภายใน <time>"
  และหน้าชำระเงินทำรายการสำเร็จด้วย PromptPay (screenshots)

## Non-functional
- ตัวนับเป็นแบบ denormalized และ atomic; มี index บน `(status, ends_at)`, `join_token`,
  `(campaign_id, customer_id)`, `(status, pay_deadline_at)`
- Deadline job ประมวลผล ≤ 50 กลุ่มต่อรอบ; ขั้นตอนต่อสมาชิกอยู่ภายใน workflow พร้อม retry

## Test plan
- Unit: การคำนวณ deadline, การประเมินเป้าหมาย, การตรวจสอบข้อจำกัด, การตรวจสอบ exclusivity
- Integration (modules): การเข้าร่วมพร้อมกัน (AC-8), idempotency (AC-9)
- Integration (http): AC-1, AC-3..AC-7, AC-10..AC-15 โดย mock payment provider
- e2e: AC-2, AC-16 กับ Stripe test mode

## Tasks
| ID | Task | Depends |
|----|------|---------|
| GB-1 | models/service/links/migrations ของ module + unit tests | CORE-2 |
| GB-2 | workflow สร้างแคมเปญและกลุ่ม + admin CRUD API (AC-6 API) | GB-1 |
| GB-3 | `joinGroupWorkflow` (draft order) + endpoint join/create/leave + exclusivity hook + concurrency tests (AC-4, AC-5, AC-7, AC-8, AC-13, AC-14, AC-15) | GB-2, PROMO-1 |
| GB-4 | `succeedGroupWorkflow` / `failGroupWorkflow` + deadline job + อีเมล (AC-1, AC-3, AC-9, AC-11, AC-12) | GB-3 |
| GB-5 | Subscriber payment captured → แปลง draft order; หมดเวลาชำระเงิน (AC-2 API, AC-10) | GB-4, PAY-3 |
| GB-6 | หน้า route ของ Admin UI | GB-2 |
| GB-7 | หน้า storefront แคมเปญ/กลุ่ม/account/ชำระเงิน + e2e (AC-2, AC-16) | GB-5 |
GB-6 ∥ (GB-3 → GB-4 → GB-5 → GB-7)

## Open questions
- Q1 หากสมาชิกบางคนไม่ชำระเงินเลยหลังกลุ่มสำเร็จ กลุ่มควรยังนับว่า fulfilled สำหรับคนอื่นหรือไม่?
  (ค่าเริ่มต้น: ใช่ — สมาชิกที่ชำระแล้วได้รับ fulfillment ไม่ว่าอย่างไร)
- Q2 กลุ่มที่สำเร็จแล้วควรเปิดให้คนเข้าร่วมเพิ่มได้จนถึง `ends_at` หรือไม่? (ค่าเริ่มต้น: ไม่ ปิดเมื่อสำเร็จ)
