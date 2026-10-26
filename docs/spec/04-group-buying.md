# 04 Group buying — ส่วนลดแบบมีเป้าหมายและจำกัดเวลา

สถานะ: draft (ปรับดีไซน์ 2026-10-25 ตามความต้องการของเจ้าของ: ใช้ flow แบบ draft order เหมือนตัวอย่าง Quotes ของ Medusa;
ปรับ membership หลายออเดอร์ต่อคน + exclusivity ตาม ADR-009; 2026-10-25 แก้ความกำกวมที่ GB-2 พบ:
ส่วนลดระดับแคมเปญเก็บใน promotion ต้นแบบตาม ADR-011, สถานะแคมเปญ, error mapping, แบ่ง GB-2 เป็น GB-2a/GB-2b และแบ่ง scope กับ GB-3)
เป้าหมาย (เจ้าของ): แคมเปญที่มีกำหนดเวลา โดยส่วนลดจะมีผลก็ต่อเมื่อถึงเป้าหมายที่กำหนดเท่านั้น
เป้าหมายอาจเป็น **จำนวนออเดอร์ (orders)**, **จำนวนชิ้น (units)** หรือ **จำนวนคน (people)** ข้อจำกัด: จำนวนออเดอร์รวม,
จำนวนชิ้นต่อคน, จำนวนคนต่อกลุ่ม กลุ่มมีสองแบบคือ **pool** ที่ admin สร้าง หรือ **team** ที่ลูกค้าสร้างเอง
ขึ้นอยู่กับการตั้งค่าแคมเปญ **การเข้าร่วมจะสร้าง draft order** (ยังไม่ชำระเงิน);
เมื่อถึงเป้าหมาย สมาชิกจะได้รับการแจ้งเตือนพร้อมลิงก์/หน้าชำระเงิน; หากไม่ถึงเป้าหมาย
draft order จะถูกยกเลิกและแจ้งสมาชิก ต้อง login ก่อนจึงจะเข้าร่วมได้
การตัดสินใจ: custom module `group_buy` (ADR-004); ส่วนลด **ใช้ผ่าน Promotion module**
(หนึ่ง promotion code ต่อหนึ่งกลุ่ม, clone จาก promotion ต้นแบบของแคมเปญ — ADR-011), draft order ผ่าน Order module ของ Medusa
นอกขอบเขต: การแชร์ไปโซเชียลที่มากกว่าลิงก์แชร์, เป้าหมายแบบหลายระดับ (tiered), การชำระเงินบางส่วน

## สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | วิธีใช้ |
|------|-----------------|-----|
| ใส่ส่วนลด % / จำนวนคงที่ให้ cart | Promotion module (แบบใช้ code) | 1 promotion ต่อกลุ่ม, `is_automatic=false`, `status=active` |
| เก็บส่วนลด + product scope ระดับแคมเปญก่อนมีกลุ่ม | Promotion `status=draft` — `computeActions` กรองเฉพาะ `active` จึงไม่มีผลกับ cart (ตรวจ source 2.22.1) | ใช้ตามเดิม: promotion ต้นแบบ 1 ตัวต่อแคมเปญ แก้ผ่านหน้า promotion ของ Medusa admin (ADR-011) |
| สร้าง/ลบ promotion | `createPromotionsWorkflow` / `deletePromotionsWorkflow` | ใช้ตามเดิม (clone ต้นแบบ → `GB-<token>`) |
| ช่วงเวลา | Campaign (`starts_at`/`ends_at` คุมช่วงที่ promotion ใช้ได้) | 1 campaign ต่อหนึ่งแคมเปญ group-buy; ต้องมี `ends_at` |
| HTTP status จาก error | error handler ของ Medusa: `FORBIDDEN`→403, `NOT_ALLOWED`/`INVALID_DATA`→400, `NOT_FOUND`→404, `CONFLICT`→409 (แต่ **เขียนทับ** `code`/`message` เป็น `invalid_state_error`) | ใช้ตามเดิม ยกเว้น 409 ที่ต้องมี code ของเรา (กฎข้อ 11) |
| สร้าง draft order จาก cart แล้วแปลงและชำระเงินภายหลัง | draft order ของ Order module (`createOrderWorkflow` พร้อม `is_draft_order`, `convertDraftOrderWorkflow`) + payment collection บน order — เป็น pattern เดียวกับตัวอย่าง **Quotes** ของ Medusa | ใช้ตามเดิม |
| Payment collection สำหรับ order ที่มีอยู่แล้ว | `createOrderPaymentCollectionWorkflow` + payment sessions | ใช้ตามเดิม |
| ยกเลิก draft order | `cancelOrderWorkflow` | ใช้ตามเดิม |
| ตัวตนลูกค้า, auth | Customer + Auth modules | ใช้ตามเดิม (ต้อง login) |
| อีเมล | Notification module | templates |
| หน้า admin | Admin UI routes | custom page |
| อ่าน draft order จาก membership | read-only module link (`defineLink(..., { readOnly: true })`, field `order_id`) | ใช้ตามเดิม (ADR-009) |
| lock ข้าม request/step | Locking module (Redis, spec 07) + `acquireLockStep` / `releaseLockStep` | ใช้ตามเดิม (ADR-009) |
| exclusivity ของ promotion | ไม่มี native (ตรวจ 2.22.1); มี hook `validate` / `setPromotionContext` บน `updateCartPromotionsWorkflow` | ขยาย — ทำครั้งเดียวใน PROMO-1 (ADR-009) |

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
  id, name,   // starts_at/ends_at อยู่ที่ Medusa campaign (link); discount type/value + product scope อยู่ที่
              // promotion ต้นแบบ (status=draft) ใน campaign นั้น (link template, ADR-011); ไม่ทำซ้ำที่นี่
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

GroupBuyMembership                    // 1 membership = 1 draft order; ลูกค้าเดียวมีได้หลายแถวในกลุ่มเดียว (ADR-009)
  id, campaign_id (denormalized จากกลุ่มตอน join, ไม่เปลี่ยน), group_id, customer_id,
  order_id: text (unique, draft order), units: int, joined_at,
  status: "joined"|"awaiting_payment"|"paid"|"cancelled"
  // index (campaign_id, customer_id), index (group_id, status); ไม่มี unique (group_id, customer_id)
```
Links: `group_buy_group ↔ promotion`, `group_buy_campaign ↔ promotion_campaign`,
`group_buy_campaign ↔ promotion` (**template**, one-to-one, ADR-011 — ต้นแบบส่วนลด/scope),
`group_buy_membership ↔ order` (**read-only** ผ่าน field `order_id`, ไม่มี link table)

## Workflows
- `createGroupBuyCampaignWorkflow(input)` (admin) — input: ค่าคอนฟิกของ `GroupBuyCampaign` + `starts_at`, `ends_at`
  (บังคับ) + `application_method` (type, value, currency_code?, target_type `items`, allocation, `target_rules` = scope
  สินค้า) + `rules?` + `is_tax_inclusive?` (ค่าเริ่มต้น `true` — กฎข้อ 12, GB-2c):
  1. สร้าง Medusa campaign (`createCampaignsWorkflow`) — compensation: ลบ
  2. สร้าง promotion ต้นแบบ (`createPromotionsWorkflow`): `status: "draft"`, `is_automatic: false`,
     `campaign_id`, `code: "GBT-<random 12>"` (ห้ามขึ้นต้น `GB-`), `is_tax_inclusive` (ไม่ส่งมา = `true`) — compensation: ลบ
  3. สร้าง `GroupBuyCampaign` (`status: "draft"`) — compensation: ลบ
  4. สร้าง link ไป promotion_campaign และ template — compensation: dismiss
- `updateGroupBuyCampaignWorkflow(id, patch)` (admin): แก้คอนฟิกได้เฉพาะเมื่อ `draft`; เมื่อ `active` แก้ได้เฉพาะ
  `name`, `pay_within_hours`; `ended` แก้ไม่ได้ (400 `NOT_ALLOWED`) การเปลี่ยน `status` ทำผ่าน workflow ด้านล่างเท่านั้น
  ส่วนลด/scope แก้ที่ promotion ต้นแบบผ่านหน้า promotion ของ Medusa admin (มีผลเฉพาะกลุ่มที่สร้างหลังจากนั้น)
- `deleteGroupBuyCampaignWorkflow(id)` (admin, เฉพาะ `draft` — แคมเปญ `draft` ไม่มีกลุ่มอยู่แล้วเพราะสร้างกลุ่มได้เฉพาะ `active`):
  1. ตรวจ `status=draft` มิฉะนั้น 400 `NOT_ALLOWED`
  2. dismiss link template + promotion_campaign — compensation: สร้าง link คืน
  3. soft-delete `GroupBuyCampaign` — compensation: restore
  4. `deletePromotionsWorkflow([template_id])` แล้ว `deleteCampaignsWorkflow([campaign_id])` (รันเป็น step;
     compensation ตามที่ workflow ของ Medusa มีให้)
- `setGroupBuyCampaignStatusWorkflow(id, status)` (admin) — transition ที่อนุญาต (กฎข้อ 10):
  `draft → active` (ตรวจว่ามี template ที่มี `application_method` และ Medusa campaign มี `ends_at > now`),
  `active → ended` (manual); อย่างอื่น → 400 `NOT_ALLOWED`; ตั้งค่าเดิมซ้ำ = no-op (idempotent)
- `createGroupWorkflow({ campaign_id, kind, customer_id?, name? })`:
  1. โหลดแคมเปญ + Medusa campaign + template (`query.graph`)
  2. ตรวจ: แคมเปญ `active` และอยู่ในช่วงเวลา (`campaign.starts_at` เป็น null หรือ `<= now`, และ `now < campaign.ends_at`)
     มิฉะนั้น 400 `NOT_ALLOWED` (กฎข้อ 10);
     `kind=team` ต้อง `group_mode ∈ {team, both}` และ `customer_id` ต้องมี; `kind=pool` ต้อง `group_mode ∈ {pool, both}`
     — mode ไม่ตรง → **403 `MedusaError.Types.FORBIDDEN`** (ไม่ใช่ `NOT_ALLOWED` ซึ่ง map เป็น 400)
     "pool สร้างได้จาก admin เท่านั้น" บังคับที่ **ระดับ route** ไม่ใช่ workflow: มีแค่ admin route ที่ส่ง `kind=pool`;
     store route `POST /store/group-buy/groups` ส่ง `kind=team` เสมอ (ไม่รับ `kind` จาก body)
  3. สร้าง `join_token` (unique, สุ่ม URL-safe) และ `ends_at = computeGroupEndsAt(kind, now, team_duration_hours, campaign.ends_at)`
     (กฎข้อ 2); `starts_at = now`
  4. clone template → promotion `GB-<token>` (`createPromotionsWorkflow`): **`status: "active"` ระบุเสมอ** (ค่าเริ่มต้นของ
     Medusa คือ `draft`), `is_automatic: false`, `campaign_id` เดียวกัน, คัดลอก `application_method` (+ `target_rules`),
     `rules`, `is_tax_inclusive` — compensation: ลบ promotion
  5. สร้าง `GroupBuyGroup` (`open`, ตัวนับ 0, `created_by_customer_id` เมื่อเป็น team) + link `group ↔ promotion`
     — compensation: ลบกลุ่ม/dismiss link
- `joinGroupWorkflow(group, cart, customer)` (ต้อง auth):
  1. acquire lock ตามลำดับ (ADR-009): `group_buy:campaign:<id>` (เฉพาะเมื่อตั้ง `max_total_orders`) →
     `group_buy:group:<id>` → `group_buy:customer:<campaign_id>:<customer_id>`
     แล้วตรวจ (นับเฉพาะ membership ที่ไม่ใช่ `cancelled`):
     cart ต้องเป็นของผู้เรียก (`cart.customer_id = customer_id`) มิฉะนั้น 404 (spec 01 กฎ 23, ADR-013 ข้อ 3; ใช้ helper ของ CORE-12, AC-24);
     แคมเปญ `active` และอยู่ในช่วงเวลาของ Medusa campaign (`starts_at` null หรือ `<= now`, `now < ends_at`)
     มิฉะนั้น 400 `NOT_ALLOWED`; กลุ่ม `open` และยังไม่หมดเวลา; ลูกค้าไม่มี membership ใน **กลุ่มอื่น** ของแคมเปญนี้
     (409 `GB_ALREADY_IN_OTHER_GROUP`); หากลูกค้ายังไม่มี membership ในกลุ่มนี้ → `progress_people < max_people_per_group`;
     จำนวน membership ทั้งแคมเปญ < `max_total_orders`; ผลรวม `units` ของลูกค้าในแคมเปญ + จำนวนชิ้นใน cart
     ≤ `max_units_per_person`; cart มีเฉพาะสินค้าในขอบเขตแคมเปญ (อ่าน `target_rules` จาก promotion ของกลุ่ม); cart ไม่มี promotion code อื่น (กฎข้อ 7)
     ข้อจำกัดที่ไม่ผ่าน → 409 พร้อม code ของข้อนั้น
  2. ใส่ `GB-<token>` ให้ cart (`updateCartPromotionsWorkflow`) — ส่วนลด flash ที่มีอยู่หลุดเองผ่าน hook ของ PROMO-1;
     compensation ของขั้นนี้: เอา `GB-<token>` ออกจาก cart (`updateCartPromotionsWorkflow` action `remove`)
  2b. **step แยกจากขั้น 2**: อ่าน cart ใหม่ ถ้า **ไม่มี** adjustment ที่ `code = GB-<token>` อย่างน้อยหนึ่ง line → throw 400
     `NOT_ALLOWED` code `GB_DISCOUNT_NOT_APPLIED` ให้ workflow ล้มทั้งชุด (ไม่สร้าง draft order ราคาเต็ม; กฎข้อ 5)
     — ต้องแยก step เพราะ step ที่ throw ไม่รัน compensation ของตัวเอง ถ้ารวม "ใส่ code" กับ "ตรวจ adjustment" ไว้ step เดียว
     `GB-<token>` จะค้างใน cart (ขัด AC-23)
  3. สร้าง draft order จาก cart (`createOrderWorkflow`, `is_draft_order: true`,
     metadata `{group_buy_group_id, group_buy_membership_id}`) — compensation: ยกเลิก order นั้น;
  4. สร้าง membership (`joined`, `campaign_id` จากกลุ่ม, `order_id`) + ปรับตัวนับ: `progress_orders +1`,
     `progress_units +units`, `progress_people +1` เฉพาะเมื่อเป็น membership แรกที่ไม่ใช่ `cancelled` ของลูกค้าในกลุ่มนี้;
  5. หากถึงเป้าหมาย → emit `group_buy.group.succeeded`; release lock (compensation ก็ release)
  ขั้นตอน 1–4 อยู่ภายใต้ lock ชุดเดียวกัน; ทั้งหมดอยู่ใน workflow เดียวพร้อม compensation
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
  - แคมเปญ `active` ที่ Medusa campaign `ends_at <= now` → `setGroupBuyCampaignStatusWorkflow(id, "ended")` (GB-4)
- Store `leaveGroupWorkflow` (เจ้าของ membership, ก่อนกลุ่มสำเร็จ, ทีละ membership): ภายใต้ lock
  `group_buy:group:<id>` → ยกเลิก draft order, membership เป็น `cancelled`, `progress_orders −1`,
  `progress_units −units`, `progress_people −1` เฉพาะเมื่อไม่เหลือ membership ที่ไม่ใช่ `cancelled` ของลูกค้าในกลุ่มนี้
- การยกเลิกหลังกลุ่ม `succeeded`/`failed` (fail, หมดเวลาชำระเงิน) ไม่ปรับตัวนับ (กฎข้อ 8)

## API (store route ทั้งหมดต้อง auth ด้วย customer)
- Admin (campaigns + `.../status` = GB-2a; `.../campaigns/:id/groups` = GB-2b; succeed/fail = GB-4): CRUD `/admin/group-buy/campaigns` (`POST` = `createGroupBuyCampaignWorkflow`, คืน
  `template_promotion_id` ให้ admin ไปแก้ใน Medusa admin ได้; `DELETE` = `deleteGroupBuyCampaignWorkflow` เฉพาะ `draft`
  มิฉะนั้น 400 `NOT_ALLOWED`),
  `POST /admin/group-buy/campaigns/:id/status` `{status: "active"|"ended"}`, `POST /admin/group-buy/campaigns/:id/groups`
  (pool), `GET .../groups`, `POST /admin/group-buy/groups/:id/succeed|fail` (override แบบ manual, GB-4)
- Store: `GET /store/group-buy/campaigns/active`, `GET /store/group-buy/groups/:token`
  (ความคืบหน้า, deadline, จำนวนสมาชิก), `POST /store/group-buy/groups` `{campaign_id, name?}` (team, GB-3;
  201 `{group: {id, join_token, ends_at, ...}}`),
  `POST /store/group-buy/groups/:token/join` `{cart_id}`, `POST /store/group-buy/memberships/:id/leave`
- หน้าชำระเงินใช้ store payment-collection route ที่ Medusa มีอยู่แล้วบน order
  (เหมือนตัวอย่าง Quotes); ไม่มี custom payment route

## Admin UI / Storefront
- Admin: route page "Group buying" → แคมเปญ, กลุ่มพร้อมความคืบหน้าและ status, membership
  พร้อม order + สถานะการชำระเงิน, succeed/fail แบบ manual
- Storefront (ข้อความไทยตรงในโค้ด ADR-014; e2e หาด้วย test id): หน้าแคมเปญ; หน้ากลุ่ม (progress bar, นับถอยหลัง, จำนวนสมาชิก,
  ปุ่ม "เข้าร่วมกลุ่ม" `group-join-button`, ปุ่ม "สร้างทีม" `group-create-team-button` เมื่ออนุญาต → ลิงก์แชร์ `/g/<token>`); รายการ order
  ในหน้า account แสดง draft order ของกลุ่มพร้อมสถานะ (รอกลุ่ม / ชำระเงินภายใน <deadline> `group-pay-deadline` / ชำระแล้ว / ยกเลิก);
  หน้าชำระเงิน `/account/orders/:id/pay` (บัตร + PromptPay, spec 06)

## Business rules
1. 1 membership = 1 draft order; ลูกค้าเดียวสั่งซ้ำในกลุ่มเดิมได้ (หลาย membership) เป้าหมาย (นับเฉพาะ membership
   ที่ไม่ใช่ `cancelled`): `orders` = จำนวน membership; `units` = ผลรวม `units`; `people` = จำนวนลูกค้าไม่ซ้ำ
2. Deadline ของกลุ่ม: pool → `ends_at` ของแคมเปญ; team → `min(created + team_duration_hours, campaign.ends_at)`
   คำนวณครั้งเดียวตอนสร้างกลุ่ม — ถ้าแก้ `ends_at` ของ Medusa campaign ภายหลัง กลุ่มที่สร้างแล้ว **ไม่** ปรับตาม
3. ลูกค้าหนึ่งคนอยู่ได้หนึ่งกลุ่มต่อแคมเปญ (มีหลาย membership ได้แต่ต้องอยู่กลุ่มเดียว) ตรวจใน workflow
   ไม่ใช่ unique index; ออกครบทุก membership แล้วเข้ากลุ่มอื่นได้ ทุกการกระทำเกี่ยวกับกลุ่มต้อง login
4. ข้อจำกัดทั้งหมดถูกบังคับใช้ภายใต้ lock ใน `joinGroupWorkflow` (scope และลำดับตาม ADR-009):
   `max_units_per_person` = ผลรวมทุก membership ของลูกค้าในแคมเปญ; `max_people_per_group` = ลูกค้าไม่ซ้ำ
   (สมาชิกเดิมสั่งเพิ่มได้แม้กลุ่มเต็มจำนวนคน); `max_total_orders` = membership ทั้งแคมเปญ
5. จำนวนส่วนลดมาจาก Medusa promotion เท่านั้น และถูก freeze ไว้ในยอดรวมของ draft order
   ณ เวลาที่เข้าร่วม
6. Draft order **ไม่** จอง inventory; สต็อกจะถูกตรวจสอบตอนชำระเงินโดยขั้นตอน order completion
   ปกติของ Medusa Admin เห็น "สมาชิก vs ชำระแล้ว" ต่อกลุ่ม
7. **Exclusivity** (ADR-009, ส่งมอบโดย PROMO-1 — GB ไม่เขียน hook เอง):
   (a) cart ที่มี `GB-*` ห้ามมี promotion code อื่น (`is_automatic=false`) และในทางกลับกัน — hook `validate`
   ของ `updateCartPromotionsWorkflow` ปฏิเสธด้วย `PROMOTION_NOT_COMBINABLE`; `joinGroupWorkflow` ขั้น 1 ตรวจซ้ำก่อน
   ใส่ code (409 `PROMOTION_NOT_COMBINABLE`)
   (b) flash + group buy ห้ามซ้อน: `GB-*` เป็น code จึงทำให้ hook `setPromotionContext` ตั้ง
   `exclusivity.code_applied="true"` → ส่วนลด flash หลุด ส่วนลด GB ชนะ (สอดคล้อง spec 03 กฎข้อ 6)
   (c) automatic promotion ที่ไม่มี exclusivity rule ยังซ้อนกับ `GB-*` ได้ตามปกติของ Medusa
   (d) ด่านสำรองตอน complete cart ตาม spec 03 กฎข้อ 6
8. กลุ่มสำเร็จได้มากที่สุดครั้งเดียว; ขั้นตอน succeed/fail/cancel ต้อง idempotent และรันซ้ำได้
9. อีเมล: เข้าร่วมแล้ว, กลุ่มสำเร็จ (ลิงก์ชำระเงิน + deadline), ได้รับการชำระเงินแล้ว, กลุ่มไม่สำเร็จ,
   หมดเวลาชำระเงิน
10. **สถานะแคมเปญ**: สร้างเป็น `draft` → admin เปลี่ยนเป็น `active` เอง (ไม่มี auto-activate; ตั้ง `active` ก่อน `starts_at`
    ได้) → `ended` เมื่อ admin สั่ง หรือ job (GB-4) เมื่อ `ends_at` ของ Medusa campaign ผ่านไป
    `ended` เป็นสถานะสุดท้าย ห้ามย้อนกลับ สร้างกลุ่ม/เข้าร่วมได้เฉพาะเมื่อ `active` **และ** อยู่ในช่วงเวลาของ Medusa campaign
    (`starts_at` null หรือ `<= now`, `now < ends_at`) มิฉะนั้น 400 `NOT_ALLOWED` — เพราะนอกช่วงนี้ Medusa ไม่ใช้ `GB-*`
    กับ cart (`listActivePromotions_`) และจะได้ draft order ราคาเต็ม; กลุ่ม `open` ที่ค้างอยู่เมื่อแคมเปญ `ended`
    ยังถูกตัดสิน succeed/fail ที่ `ends_at` ของกลุ่มตามปกติ คอนฟิกเป้าหมาย/ข้อจำกัด/mode แก้ได้เฉพาะตอน `draft`
11. **Error mapping** (ตาม error handler ของ Medusa 2.22.1): mode ไม่อนุญาต → `MedusaError.Types.FORBIDDEN` (403);
    สถานะแคมเปญ/transition ไม่ถูกต้อง → `NOT_ALLOWED` (400); ไม่พบ → `NOT_FOUND` (404) ข้อจำกัดที่ spec กำหนดเป็น 409 พร้อม
    code ของเรา (`GB_*`, `PROMOTION_NOT_COMBINABLE`) ตอบเป็น `409 { type: "conflict", code, message }` (code อยู่ในฟิลด์ `code` เสมอ)
    ผ่าน **กลไกเดียวกับ PROMO-2** (spec 03 กฎข้อ 13: `errorHandler` ที่ override ใน `defineMiddlewares` แปลง error ที่มี code ของเรา)
    — handler เดิมของ Medusa เขียนทับ `code`/`message` ของ `CONFLICT` จึงต้องพึ่งกลไกนี้; GB-3 throw error ตามรูปแบบที่ PROMO-2
    บันทึกไว้ และ **ไม่** เขียนการแปลง 409 ของตัวเองใน route (ถ้า PROMO-2 ใช้ allow-list ของ code ให้ GB-3 เพิ่ม `GB_*` ในนั้น)
    **code ที่ GB-3 (#68) ใช้จริง** (`src/modules/group_buy/errors.ts`; 409 ทั้งหมดอยู่ใน `BUSINESS_CONFLICT_CODES`):
    | สถานการณ์ใน `joinGroupWorkflow` ขั้น 1 | ผล |
    |------|------|
    | มี membership ในกลุ่มอื่นของแคมเปญ | 409 `GB_ALREADY_IN_OTHER_GROUP` |
    | ลูกค้าใหม่ของกลุ่มแต่ `progress_people >= max_people_per_group` | 409 `GB_GROUP_FULL` |
    | membership ทั้งแคมเปญ `>= max_total_orders` | 409 `GB_MAX_TOTAL_ORDERS_REACHED` |
    | units ของลูกค้าในแคมเปญ + units ใน cart `> max_units_per_person` | 409 `GB_UNITS_LIMIT_EXCEEDED` |
    | cart มีสินค้านอก `target_rules` ของ promotion กลุ่ม | 409 `GB_ITEMS_NOT_ELIGIBLE` |
    | cart มี promotion code อื่น | 409 `PROMOTION_NOT_COMBINABLE` |
    | cart มี promotion code ขึ้นต้น `GB-` อยู่แล้ว (join ซ้ำด้วย cart เดิม — กฎข้อ 14; ตรวจก่อนแถว `PROMOTION_NOT_COMBINABLE`) | 409 `GB_CART_ALREADY_JOINED` |
    | กลุ่มไม่ `open` หรือหมดเวลาแล้ว (`ends_at <= now`) | 400 `not_allowed` (เทียบกับสถานะแคมเปญตามกฎข้อ 10) |
    | ขั้น 2b ไม่มี adjustment ของ `GB-<token>` | 400 `not_allowed` code `GB_DISCOUNT_NOT_APPLIED` (ไม่อยู่ใน allow-list) |
12. (owner 2026-10-26, ADR-011 หมายเหตุ) promotion ต้นแบบมี `is_tax_inclusive: true` เป็นค่าเริ่มต้น เพราะราคา THB ของร้านรวม VAT แล้ว
    (region/currency `is_tax_inclusive: true` ใน seed) — ส่วนลดแบบ `fixed` ฿X จึงลดยอดที่ลูกค้าจ่ายพอดี ฿X; admin ส่ง `false` ได้ทั้งใน
    `POST /admin/group-buy/campaigns` และแก้ภายหลังที่หน้า promotion ของ Medusa admin (มีผลเฉพาะกลุ่มที่สร้างหลังจากนั้น ตาม ADR-011 ข้อ 3)
    ไม่ย้อนแก้ต้นแบบของแคมเปญที่สร้างก่อน GB-2c (ค่าเดิมของ Medusa คือ `false`)
13. (GB-3b) **leave** (`POST /store/group-buy/memberships/:id/leave`, `authenticate("customer")`): เฉพาะเจ้าของ membership — ของคนอื่นหรือไม่มีอยู่
    → 404; membership ที่ `cancelled` แล้ว (leave ซ้ำ) หรือกลุ่มไม่ `open` → 400 `not_allowed`; ภายใต้ lock `group_buy:group:<id>` ปรับ membership →
    `cancelled` + ตัวนับ (ตาม `leaveGroupWorkflow`) ก่อน แล้ว `cancelOrderWorkflow` เป็นขั้นสุดท้าย (compensation คืนสถานะ/ตัวนับถ้ายกเลิก order ล้ม)
14. (owner 2026-10-26, ปิด Q9; ทำใน GB-3) cart หลัง join ยังมี `GB-<token>` — กันสองชั้นฝั่ง backend:
    (a) **ห้าม complete cart ที่มี promotion code ขึ้นต้น `GB-` ทุกกรณี** (ราคาลดของกลุ่มได้ผ่าน draft order ของ membership เท่านั้น): handler ของ
    `completeCartWorkflow.hooks.validate` throw 400 `NOT_ALLOWED` code `GB_CART_NOT_COMPLETABLE` — hook นี้มี handler เดียว (`createHook`) ที่ PROMO-1/FS-3
    ใช้อยู่แล้ว ต้อง**รวมเข้า handler เดิม** ไม่ลงทะเบียนใหม่
    (b) **join ซ้ำด้วย cart เดิม** (cart มี code `GB-*` อยู่แล้วตอนเริ่ม `joinGroupWorkflow` ขั้น 1) → 409 `GB_CART_ALREADY_JOINED` (เพิ่มใน allow-list ของ
    PROMO-2) ไม่สร้าง draft order/membership — ตรวจก่อนการตรวจ `PROMOTION_NOT_COMBINABLE`
    (c) storefront ล้าง cart (cookie `_medusa_cart_id`) หลัง join สำเร็จ แล้วเริ่ม cart ใหม่ตอนเพิ่มสินค้าครั้งถัดไป — ทำใน GB-7

## Acceptance criteria
- AC-1 เมื่อมีแคมเปญ (เป้าหมาย 3 ออเดอร์, −30%) และลูกค้าที่ login แล้ว 3 คนเข้าร่วม pool P แล้ว
  ภายใน 60 วินาที กลุ่มต้องเป็น `succeeded`, แต่ละคนมี draft order พร้อม payment collection และ
  แต่ละคนได้รับอีเมลพร้อมลิงก์ชำระเงิน
- AC-2 จาก AC-1 เมื่อสมาชิกชำระเงินด้วยบัตรทดสอบในหน้าชำระเงิน แล้ว draft order ของเขา
  ต้องกลายเป็น order ปกติที่ `payment_status=captured` และ membership เป็น `paid`
- AC-3 เมื่อแคมเปญมีสมาชิก 2 คน ณ `ends_at` แล้ว draft order ทั้งสองต้องถูกยกเลิก,
  membership เป็น `cancelled`, ลูกค้าทั้งสองได้รับอีเมล; ไม่มีการสร้าง payment collection
- AC-4 เมื่อ `max_people_per_group=2` และลูกค้า A, B อยู่ในกลุ่มแล้ว การเข้าร่วมของลูกค้าคนที่ 3 ต้องได้ 409;
  ส่วนออเดอร์ที่ 2 ของลูกค้า A ในกลุ่มเดียวกันต้องสำเร็จ (201) และ `progress_people` ยังเป็น 2
- AC-5 เมื่อ `max_units_per_person=1` การเข้าร่วมด้วย cart ที่มี qty 2 ต้องได้ 409
- AC-6 (HTTP, GB-3) เมื่อ `group_mode=pool` `POST /store/group-buy/groups` ต้องได้ 403; เมื่อเป็น `both` ต้องได้ 201
  พร้อม `join_token` และ `ends_at` ของตัวเอง (ระดับ workflow ดู AC-19)
- AC-7 เมื่อลูกค้า A มี 2 membership (1 ชิ้น/ออเดอร์) ในกลุ่มที่ยังไม่สำเร็จ แล้ว leave membership แรก:
  draft order นั้นถูกยกเลิก, `progress_orders −1`, `progress_units −1`, `progress_people` ไม่เปลี่ยน;
  เมื่อ leave membership ที่สอง: `progress_people −1`; จากนั้น A เข้าร่วมกลุ่มเดิมหรือกลุ่มอื่นในแคมเปญเดียวกันได้ (201)
- AC-8 การเข้าร่วมพร้อมกัน 20 ครั้งจากลูกค้า 20 คนที่ต่างกันกับ `max_people_per_group=5` → ต้องมี membership
  ที่ไม่ใช่ `cancelled` พอดี 5 รายการจากลูกค้า 5 คน และ `progress_people=5`
- AC-9 การรัน succeed/fail สองครั้งกับกลุ่มเดียวกันต้องไม่สร้าง payment collection,
  การยกเลิก หรืออีเมลซ้ำ
- AC-10 เมื่อกลุ่มสำเร็จและ `pay_within_hours=1` สมาชิกที่ยังไม่ชำระหลัง 1 ชม. ต้องมี
  order ที่ถูกยกเลิกและได้รับอีเมล "หมดเวลา"; สมาชิกที่ชำระแล้วไม่ได้รับผลกระทบ
- AC-11 `target_type=units`, เป้าหมาย 10: รวม 10 ชิ้นจากออเดอร์ใด ๆ → succeeded; 9 ชิ้น → failed
- AC-12 `target_type=people`, เป้าหมาย 3: ลูกค้า 3 คนไม่ซ้ำกัน (คนหนึ่งมี 2 ออเดอร์) → succeeded;
  ลูกค้า 2 คนรวม 4 ออเดอร์ → failed
- AC-13 แคมเปญ `max_total_orders=5` (2 กลุ่ม): การเข้าร่วมครั้งที่ 6 ในกลุ่มใดก็ตาม (รวมออเดอร์ซ้ำของสมาชิกเดิม)
  ต้องได้ 409; การเข้าร่วมพร้อมกัน 8 ครั้งกระจาย 2 กลุ่มจากแคมเปญว่าง → สำเร็จพอดี 5
- AC-14 cart ที่มี code `SAVE10` ไม่สามารถเข้าร่วมได้ (409 `PROMOTION_NOT_COMBINABLE`); หลังเข้าร่วมแล้ว
  การใส่ `SAVE10` ให้ cart ที่มี `GB-*` ต้องถูกปฏิเสธด้วย `PROMOTION_NOT_COMBINABLE`; cart ที่มีส่วนลด flash
  (automatic + exclusivity rule) เข้าร่วมได้ และ draft order มี adjustment จาก `GB-*` เท่านั้น ไม่มีจาก flash
- AC-15 join/create/leave โดยไม่ auth → 401
- AC-16 Storefront: หน้ากลุ่มแสดงความคืบหน้า/นับถอยหลัง/สมาชิก; หน้า account แสดง "ชำระเงินภายใน <time>"
  และหน้าชำระเงินทำรายการสำเร็จด้วย PromptPay (screenshots)
- AC-17 `max_units_per_person=2`: ลูกค้าที่มี membership 1 ชิ้นอยู่แล้ว เข้าร่วมซ้ำด้วย qty 2 → 409;
  ด้วย qty 1 → 201; หลัง leave membership แรก เข้าร่วมด้วย qty 1 ได้อีก (นับเฉพาะที่ไม่ใช่ `cancelled`)
- AC-18 ลูกค้าที่มี membership ในกลุ่ม G1 เข้าร่วม G2 ของแคมเปญเดียวกัน → 409 `GB_ALREADY_IN_OTHER_GROUP`;
  ลูกค้าที่ยังไม่มี membership ยิง join G1 และ G2 พร้อมกัน → สำเร็จพอดี 1 ครั้ง
- AC-19 (workflow, GB-2b) `createGroupWorkflow` บนแคมเปญ `active` ที่อยู่ในช่วงเวลา: `group_mode=pool` + `kind=team` → error type
  `forbidden` (403); `group_mode=team` + `kind=pool` → `forbidden`; `group_mode=both` + team (`team_duration_hours=2`,
  campaign ends ใน 10 ชม.) → กลุ่ม `open` มี `join_token` ไม่ซ้ำ, `created_by_customer_id`, `ends_at = created + 2 ชม.`;
  team ที่ campaign ends ใน 1 ชม. → `ends_at = campaign.ends_at`; admin สร้าง pool (`group_mode=pool`) → `ends_at = campaign.ends_at`
  และ `POST /admin/group-buy/campaigns/:id/groups` ได้ 201
- AC-20a (GB-2a) `createGroupBuyCampaignWorkflow` (−30%, scope = product X) สร้าง Medusa campaign + promotion ต้นแบบ
  `status=draft`, `is_automatic=false`, code ขึ้นต้น `GBT-` ที่ link (template) กับแคมเปญ; ใส่ code ต้นแบบลง cart ที่มี X
  → ไม่มี adjustment; `DELETE` แคมเปญ `draft` → แคมเปญ, ต้นแบบ, Medusa campaign และ link ถูกลบ; `DELETE` แคมเปญ `active` → 400
- AC-20b (GB-2b) สร้างกลุ่มแล้วได้ promotion `GB-<token>` `status=active` ที่ `campaign_id`, `application_method`
  (type/value/target_rules) และ `rules` ตรงกับต้นแบบ; ใส่ `GB-<token>` ลง cart ที่มี X → adjustment −30% เฉพาะ line X
- AC-21a (GB-2a) transition `active → draft`, `ended → active` → 400; `draft → active` แล้ว `active → ended` → สำเร็จ;
  เรียก `active` ซ้ำบนแคมเปญ `active` → no-op 200; แก้ `target_value` ของแคมเปญ `active` → 400
- AC-21b (GB-2b) สร้างกลุ่มบนแคมเปญ `draft` หรือ `ended` → 400 `not_allowed`; แคมเปญ `active` ที่ Medusa campaign
  `starts_at` อยู่ในอนาคต → 400 `not_allowed` และไม่มี promotion `GB-*` ถูกสร้าง
- AC-22 (GB-4) แคมเปญ `active` ที่ Medusa campaign `ends_at` ผ่านไปแล้ว → หลัง job รอบถัดไปเป็น `ended`;
  สร้างกลุ่มใหม่ได้ 400
- AC-23 (GB-3) join กลุ่ม `open` ขณะที่ Medusa campaign `starts_at` อยู่ในอนาคต (แก้ `starts_at` หลังสร้างกลุ่ม) → 400
  `not_allowed`; join กลุ่มที่ promotion `GB-<token>` ถูกตั้งเป็น `inactive` → 400 `GB_DISCOUNT_NOT_APPLIED`; ทั้งสองกรณี
  ไม่มี draft order, ไม่มี membership, ตัวนับไม่เปลี่ยน และ cart ไม่มี `GB-<token>` ค้าง
- AC-24 (GB-3, ADR-013) customer B ล็อกอินแล้ว `POST /store/group-buy/groups/:token/join` ด้วย `cart_id` ของ customer A → 404;
  ไม่มี membership, ไม่มี draft order, ตัวนับของกลุ่มไม่เปลี่ยน และ cart ของ A ไม่มี `GB-<token>` (promotions/adjustments เหมือนก่อนเรียก)
- AC-20c (GB-2c, กฎข้อ 12) `POST /admin/group-buy/campaigns` ที่ไม่ส่ง `is_tax_inclusive` → promotion ต้นแบบ `is_tax_inclusive=true`; ส่ง
  `false` → `false`; ไม่ใช่ boolean → 400; แคมเปญ (ค่าเริ่มต้น) ส่วนลด `fixed` ฿100 THB scope = product X ที่ราคา ฿1,070 (รวม VAT) → สร้างกลุ่ม
  แล้วใส่ `GB-<token>` ลง cart ที่มี X qty 1 → `cart.total` ลดลงพอดี 100; control: ต้นแบบ `is_tax_inclusive=false` → ลดลงไม่เท่ากับ 100
  (≈ 107 ตามการคำนวณของ Medusa — ยืนยันว่า test แยกสองกรณีออกจากกันได้)
- AC-20d (GB-2c, ปิดช่องว่าง test ของ GB-2b) `createGroupWorkflow` ที่ทำให้ขั้นสร้าง link `group ↔ promotion` ล้ม (test inject error ครั้งเดียว
  เช่น mock `link.create` ให้ throw) → workflow ล้ม, ไม่มี promotion `GB-*` ใหม่, ไม่มี `GroupBuyGroup` ใหม่ (นับก่อน/หลังเท่ากัน) และ error
  ที่ผู้เรียกได้รับเป็น error ของขั้น link; เรียกซ้ำโดยไม่ inject → สำเร็จ
- AC-25 (GB-3b, กฎข้อ 13) Given membership M ของ A ในกลุ่ม `open` When B leave M Then 404 และ M, draft order, ตัวนับไม่เปลี่ยน; When A leave M
  Then 200, M `cancelled`, draft order `canceled`; When A leave M ซ้ำ Then 400 `not_allowed` และตัวนับไม่ลดซ้ำ; Given กลุ่ม `succeeded` (ตั้งผ่าน module)
  When A leave membership ในกลุ่มนั้น Then 400 และไม่มีอะไรเปลี่ยน; Given ขั้น `cancelOrderWorkflow` ล้ม (inject ครั้งเดียว) Then M กลับเป็น `joined`
  และตัวนับเท่าก่อนเรียก (integration http)
- AC-26 (GB-3, กฎข้อ 14a) Given A join กลุ่ม G ด้วย cart C สำเร็จ (C มี `GB-<token>`) When A `POST /store/carts/C/complete` Then 400 `type=not_allowed`
  code `GB_CART_NOT_COMPLETABLE`, `C.completed_at` ยัง null และไม่มี order ใหม่ที่ไม่ใช่ draft; Given cart ที่ใส่ `GB-<token>` ผ่าน
  `POST /store/carts/:id/promotions` โดยไม่ join Then complete ได้ 400 เหมือนกัน; Given cart ที่ไม่มี `GB-*` (มีส่วนลด flash) Then complete สำเร็จตามเดิม
  (test ของ PROMO-1/FS-3 ยังผ่าน) (integration http)
- AC-27 (GB-3, กฎข้อ 14b) Given A join G ด้วย cart C สำเร็จ When A join G (หรือกลุ่มอื่นของแคมเปญเดียวกัน) ด้วย C อีกครั้ง Then 409
  `{ type: "conflict", code: "GB_CART_ALREADY_JOINED" }`, membership/draft order/ตัวนับไม่เปลี่ยน; When A join G ด้วย cart ใหม่ C2 Then 201 (integration http)
- AC-28 (GB-7, กฎข้อ 14c) Given A join สำเร็จใน storefront When กลับไปหน้าร้านแล้วเปิด cart Then cart ว่าง (ไม่มี line เดิม, ไม่มี `GB-*`) และการเพิ่มสินค้าสร้าง
  cart ใหม่ที่ id ต่างจาก C (e2e)

## Non-functional
- ตัวนับเป็นแบบ denormalized ปรับภายใต้ lock ของกลุ่ม; index: group `(status, ends_at)`, `join_token` (unique),
  `(status, pay_deadline_at)`; membership `(campaign_id, customer_id)` (ไม่ unique), `(group_id, status)`, `order_id` (unique)
- lock ผ่าน Locking module ของ Medusa (Redis) ตาม scope/ลำดับใน ADR-009; ไม่เพิ่ม infra ใหม่
- Deadline job ประมวลผล ≤ 50 กลุ่มต่อรอบ; ขั้นตอนต่อสมาชิกอยู่ภายใน workflow พร้อม retry

## Test plan
- Unit: การคำนวณ deadline (`computeGroupEndsAt`, AC-19), ตาราง transition สถานะแคมเปญ (AC-21a), การตรวจช่วงเวลาแคมเปญ
  (AC-21b, AC-23), การ map template → input ของ `createPromotionsWorkflow` (AC-20b), การประเมินเป้าหมาย, การตรวจสอบข้อจำกัด, delta ของตัวนับตอน join/leave (AC-7)
  (logic exclusivity ทดสอบใน PROMO-1)
- Integration (modules): model ยอมให้ 2 membership `(group_id, customer_id)` เดียวกัน และปฏิเสธ `order_id` ซ้ำ (GB-1);
  การเข้าร่วมพร้อมกัน (AC-8, AC-13 ส่วน concurrent, AC-18 ส่วน concurrent), idempotency (AC-9)
- Integration (modules/workflow): AC-19, AC-20a, AC-20b (รวมการใส่ code ลง cart จริงผ่าน `updateCartPromotionsWorkflow`), AC-20c (ส่วน cart),
  AC-20d
- Unit/integration (http): AC-20c (validator + ค่าเริ่มต้น)
- Integration (http): AC-1, AC-3..AC-7, AC-10..AC-15, AC-17, AC-18, AC-19 (ส่วน admin pool), AC-20a (DELETE), AC-21a,
  AC-21b, AC-22, AC-23, AC-24, AC-25, AC-26, AC-27
  โดย mock payment provider
- e2e: AC-2, AC-16 กับ Stripe test mode; AC-28

## Tasks
| ID | Task | Depends |
|----|------|---------|
| GB-1 | models/service/links/migrations ของ module + unit tests — membership มี `campaign_id`, ไม่มี unique `(group_id, customer_id)`, `order_id` unique + read-only link ไป order, index ตาม Non-functional (ADR-009) | CORE-2 |
| GB-2a | link template (ADR-011) + `createGroupBuyCampaignWorkflow` / `updateGroupBuyCampaignWorkflow` / `deleteGroupBuyCampaignWorkflow` / `setGroupBuyCampaignStatusWorkflow` + admin API: campaigns CRUD, `.../status` (AC-20a, AC-21a) | GB-1, ADR-011 accepted |
| GB-2b | `computeGroupEndsAt` + `createGroupWorkflow` (pool + team ระดับ workflow, ตรวจช่วงเวลาแคมเปญ) + admin `POST/GET /admin/group-buy/campaigns/:id/groups` (AC-19, AC-20b, AC-21b) — **ไม่รวม** `POST /store/group-buy/groups` | GB-2a |
| GB-2c | follow-up owner/review (เล็ก): ค่าเริ่มต้น `is_tax_inclusive: true` ของต้นแบบใน validator ของ `POST /admin/group-buy/campaigns` และ `createGroupBuyCampaignWorkflow` (กฎข้อ 12) + test rollback เมื่อขั้น link ของ `createGroupWorkflow` ล้ม (AC-20c, AC-20d) — ไม่แตะ store route | GB-2b |
| GB-3 | `joinGroupWorkflow` (draft order, lock scope ADR-009, ตรวจช่วงเวลา + ตรวจว่ามี adjustment ของ `GB-<token>`) + store endpoint `POST /store/group-buy/groups` (team, เรียก `createGroupWorkflow` จาก GB-2b), join, leave + 409 ผ่านกลไกของ PROMO-2 ตามกฎข้อ 11 (ไม่แปลงเอง) + concurrency tests (AC-4, AC-5, AC-6, AC-7, AC-8, AC-13, AC-14, AC-15, AC-17, AC-18, AC-23, AC-24); ใช้ hook exclusivity จาก PROMO-1 ไม่เขียนเอง; ตรวจเจ้าของ cart ด้วย helper ของ CORE-12; **เพิ่ม 2026-10-26 (owner, Q9)**: ห้าม complete cart ที่มี `GB-*` (รวมเข้า handler `completeCartWorkflow.hooks.validate` เดิม) + 409 `GB_CART_ALREADY_JOINED` (กฎข้อ 14a/b, AC-26, AC-27) | GB-2b, PROMO-1, PROMO-2 (AC-14 ส่วนที่สอง: ใส่ `SAVE10` ผ่าน route ของ Medusa ต้องได้ code ของเรา), CORE-12 (AC-24) |
| GB-3b | (แยกจาก GB-3 ตาม PR #68, owner 2026-10-26) `leaveGroupWorkflow` + `POST /store/group-buy/memberships/:id/leave` ตามกฎข้อ 13 (AC-7, AC-15 ส่วน leave, AC-17 ส่วน "หลัง leave", AC-25) — GB-3 (#68) ส่งมอบ join + สร้างทีม ส่วน AC อื่นในแถว GB-3 คงเดิม | GB-3 |
| GB-4 | `succeedGroupWorkflow` / `failGroupWorkflow` + deadline job (รวมตั้งแคมเปญ `ended`) + admin succeed/fail + อีเมล (AC-1, AC-3, AC-9, AC-11, AC-12, AC-22) | GB-3 |
| GB-5 | Subscriber payment captured → แปลง draft order; หมดเวลาชำระเงิน (AC-2 API, AC-10) | GB-4, PAY-3 |
| GB-6 | หน้า route ของ Admin UI | GB-2b |
| GB-7 | หน้า storefront แคมเปญ/กลุ่ม/account/ชำระเงิน + ล้าง cart หลัง join (กฎข้อ 14c) + e2e (AC-2, AC-16, AC-28); ข้อความไทยตรงในโค้ด + path ใหม่ใน ESLint rule (spec 01 CORE-4 กฎข้อ 4, ADR-014) | GB-5 |
GB-1 → GB-2a → GB-2b → (GB-2c ∥ GB-6 ∥ (GB-3 → GB-4 → GB-5 → GB-7)); GB-3 ต้องรอ PROMO-2 (spec 03) และ CORE-12 (spec 01) merge ด้วย
GB-3b ∥ GB-4 หลัง GB-3 (GB-3b แตะ workflow/route leave แยกไฟล์; ถ้าแตะ `utils/join.ts`/`errors.ts` ร่วมกัน ตัวที่ merge ทีหลัง rebase);
GB-7 ต้องรอ GB-3b ด้วย (ปุ่มออกจากกลุ่มในหน้า account)
GB-2c ไม่บล็อก GB-3 (แตะ `campaign.ts`/`validators.ts`/test ของ `create-group` ไม่ใช่ไฟล์ join) แต่ควร merge ก่อน release v0.5.0

## Open questions
- Q1 หากสมาชิกบางคนไม่ชำระเงินเลยหลังกลุ่มสำเร็จ กลุ่มควรยังนับว่า fulfilled สำหรับคนอื่นหรือไม่?
  (ค่าเริ่มต้น: ใช่ — สมาชิกที่ชำระแล้วได้รับ fulfillment ไม่ว่าอย่างไร)
- Q2 กลุ่มที่สำเร็จแล้วควรเปิดให้คนเข้าร่วมเพิ่มได้จนถึง `ends_at` หรือไม่? (ค่าเริ่มต้น: ไม่ ปิดเมื่อสำเร็จ)
- ~~Q3~~ ตัดสินแล้ว (owner, 2026-10-25): ออเดอร์ซ้ำของสมาชิกเดิมนับเข้า `max_total_orders` และไม่ติด
  `max_people_per_group` (ADR-009) ไม่เพิ่มเพดานจำนวนออเดอร์ต่อคน ใช้ `max_units_per_person` คุม
- ~~Q4~~ ตัดสินแล้ว (owner, 2026-10-25): อนุมัติ ADR-011 (promotion ต้นแบบ `draft` + clone ต่อกลุ่ม)
- ~~Q5~~ ตัดสินแล้ว (owner, 2026-10-25): แก้ส่วนลด/scope ของต้นแบบระหว่างแคมเปญ `active` มีผลเฉพาะกลุ่มที่สร้างหลังจากนั้น
  ไม่ sync ไปกลุ่มเดิม และไม่ล็อกการแก้
- ~~Q6~~ ตัดสินแล้ว (owner, 2026-10-25): admin สั่ง `ended` ก่อนเวลา → ปิดการสร้าง/เข้าร่วม กลุ่ม `open` ยังรอตัดสินที่ `ends_at` ของตัวเอง
- ~~Q7~~ ตัดสินแล้ว (owner, 2026-10-25): ไม่จำกัดจำนวน team ต่อลูกค้าใน v1 และยอมรับความเสี่ยงที่ต้นแบบ `GBT-*`
  มองเห็นในหน้า promotion ของ Medusa admin (บรรเทาด้วย code สุ่มที่เดาไม่ได้ + คำเตือนใน GB-6)
- ~~Q9~~ ตัดสินแล้ว (owner 2026-10-26): backend ห้าม complete cart ที่มี `GB-*` ทุกกรณี และปฏิเสธ join ซ้ำด้วย cart เดิม (409) — ทำใน GB-3;
  storefront ล้าง cart หลัง join — ทำใน GB-7 (กฎข้อ 14, AC-26..28)
- ~~Q8~~ ตัดสินแล้ว (owner, 2026-10-26): ต้นแบบ `is_tax_inclusive: true` เป็นค่าเริ่มต้น (ราคา THB รวม VAT) admin เปลี่ยนเองได้ — กฎข้อ 12, GB-2c
