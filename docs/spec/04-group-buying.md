# 04 Group buying — ส่วนลดแบบมีเป้าหมายและจำกัดเวลา

สถานะ: draft (ปรับดีไซน์ 2026-10-25 ตามความต้องการของเจ้าของ: ใช้ flow แบบ draft order เหมือนตัวอย่าง Quotes ของ Medusa;
ปรับ membership หลายออเดอร์ต่อคน + exclusivity ตาม ADR-009; 2026-10-25 แก้ความกำกวมที่ GB-2 พบ:
ส่วนลดระดับแคมเปญเก็บใน promotion ต้นแบบตาม ADR-011, สถานะแคมเปญ, error mapping, แบ่ง GB-2 เป็น GB-2a/GB-2b และแบ่ง scope กับ GB-3;
2026-10-26 รอบ 6: แยก GB-6 เป็น GB-6a/6b/6c + route membership ของ admin, nit review #68/#75 — กฎข้อ 14d–17, AC-29..35;
รอบ 7: path `/group-buying/:id`, บั๊ก summary ของ draft order → GB-3c, ข้อจำกัด lock TTL ของ GB-4 — กฎข้อ 18–19, AC-36;
รอบ 8: leave หลังหมดเวลา (กฎข้อ 13), ถ้อยคำ AC-32/AC-36, ปัดยอด 2 ตำแหน่ง (กฎข้อ 20, AC-37), รวม nit เป็น GB-N1;
รอบ 9 2026-10-27: owner ยืนยัน Q11 (ก), แยก GB-6c → 6c1 (#114)/6c2 + nit #114, GB-N2 test flaky;
รอบ 10 2026-10-27: store route อ่าน draft order ของ membership (GB-8, ADR-016 accepted โดย owner 2026-10-27) ที่ PAY-3 ต้องใช้, GB-5 พึ่ง PAY-3a แทน PAY-3, GB-6d nit admin — กฎข้อ 21–23, AC-38..41;
รอบ 12 2026-10-28: follow-up ของ GB-5 #185 → GB-9/GB-10, กฎข้อ 25–26, AC-43..44, คำถาม owner Q13–Q14)
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
| Payment collection สำหรับ order ที่มีอยู่แล้ว | `createOrderPaymentCollectionWorkflow` (รับ amount ที่ส่งเข้าไป ไม่อ่าน summary) / `createOrUpdateOrderPaymentCollectionWorkflow` (คิดจาก `summary.pending_difference`) + payment sessions | ใช้ตามเดิม; ยอดที่ส่งปัด 2 ตำแหน่ง (กฎข้อ 20) |
| ยกเลิก draft order | `cancelOrderWorkflow` | ใช้ตามเดิม |
| ยอดรวม/summary ของ order (`current_order_total`, `pending_difference`) | Order module คำนวณ summary เมื่อ order เปลี่ยนผ่านกลไกของตัวเอง | ใช้ตามเดิม — step ที่แก้ adjustment ต้องให้ Medusa คำนวณ summary ใหม่ (กฎข้อ 18, GB-3c) |
| URL ของ storefront ในอีเมลชำระเงิน | ไม่มี config ของ Medusa | env `STOREFRONT_URL` (spec 07 Deliverables ข้อ 9, GB-4) |
| ตัวตนลูกค้า, auth | Customer + Auth modules | ใช้ตามเดิม (ต้อง login) |
| อีเมล | Notification module | templates |
| หน้า admin | Admin UI routes | custom page |
| อ่าน draft order จาก membership | read-only module link (`defineLink(..., { readOnly: true })`, field `order_id`) | ใช้ตามเดิม (ADR-009) — GB-6c อ่าน `order.status`/`payment_status`/`total` ผ่าน `query.graph` |
| ลูกค้าอ่าน draft order ของตัวเองผ่าน Store API | **ไม่มี** — `GET /store/orders*` กรอง `is_draft_order: false` ใน handler, ไม่มี store route ของ draft order/อ่าน payment collection (ตรวจ 2.22.1 โดย builder PAY-3) | custom route อ่านอย่างเดียว 2 ตัวใต้ `/store/customers/me/group-buy/*` ตาม pattern Quotes (GB-8, **ADR-016 accepted**) |
| เลือกสินค้าใน admin extension | `sdk.admin.product.list` (JS SDK) + `DataTable`/`Checkbox` ของ `@medusajs/ui`; dashboard **ไม่ export** product picker ภายในให้ extension ใช้ | ขยาย: picker เล็กในหน้า Group buying (GB-6b) — builder ตรวจ docs admin customization ก่อน ถ้ามี component ของ Medusa ให้ใช้ ใช้ตัวนั้น |
| กล่องยืนยัน / toast ใน admin | `usePrompt`, `toast` ของ `@medusajs/ui` | ใช้ตามเดิม (GB-6b, GB-6c) |
| lock ข้าม request/step | Locking module (Redis, spec 07) + `acquireLockStep` / `releaseLockStep` | ใช้ตามเดิม (ADR-009) |
| ops แปลง draft order เองหลังเงินเข้า | `@medusajs/draft-order` 2.22.1 (ปุ่ม Convert ใน admin) + `POST /admin/draft-orders/:id/convert-to-order` → `convertDraftOrderWorkflow` (ตรวจโดย re-review #185) | ใช้ตามเดิม — เราเพิ่มแค่การอัปเดต membership หลังแปลง (GB-10, กฎข้อ 26) |
| refund payment ของ draft/order ที่ยกเลิก | `POST /admin/payments/:id/refund` (`refundPaymentWorkflow` ไม่ปฏิเสธ draft/order ยกเลิก — re-review #185) | ใช้ตามเดิมใน runbook (กฎข้อ 25) — ไม่ refund อัตโนมัติจนกว่า owner ตอบ Q13 |
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
  (pool), `GET .../groups`, `POST /admin/group-buy/groups/:id/succeed|fail` (override แบบ manual, GB-4),
  `GET /admin/group-buy/groups/:id/memberships` (GB-6c, อ่านอย่างเดียว; query ตรวจด้วย zod validator ผ่าน `validateAndTransformQuery` ของ Medusa:
  `limit` int 1..100 ค่าเริ่มต้น 50, `offset` int ≥ 0 ค่าเริ่มต้น 0 — นอกช่วง/ไม่ใช่ตัวเลข → 400 `invalid_data`) → 200
  `{ memberships: [{ id, customer_id, customer: { email }, units, status, joined_at, order_id, order: { status, is_draft_order, payment_status, total } }], count }`
  (อ่าน order ผ่าน read-only link ด้วย `query.graph`; อีเมลลูกค้าอ่านจาก Customer module ใน route ด้วย `query.graph` — ไม่มี link ใหม่; ถ้า Query ต่อ
  membership → customer ไม่ได้ ให้ query ลูกค้าแยกด้วย `customer_id` ชุดเดียว ไม่ยิงต่อแถว)
  กลุ่มไม่มีจริง → 404; ไม่มี token admin → 401
- Store: `GET /store/group-buy/campaigns/active`, `GET /store/group-buy/groups/:token`
  (ความคืบหน้า, deadline, จำนวนสมาชิก), `POST /store/group-buy/groups` `{campaign_id, name?}` (team, GB-3;
  201 `{group: {id, join_token, ends_at, ...}}`),
  `POST /store/group-buy/groups/:token/join` `{cart_id}`, `POST /store/group-buy/memberships/:id/leave`
- หน้าชำระเงินใช้ store payment-collection route ที่ Medusa มีอยู่แล้วบน order
  (เหมือนตัวอย่าง Quotes); ไม่มี custom payment route
- (รอบ 10, GB-8, ADR-016 accepted) Store อ่านอย่างเดียว (ต้อง login; Medusa ใส่ `authenticate("customer")` ให้ `/store/customers/me*` — builder ยืนยัน):
  - `GET /store/customers/me/group-buy/memberships?limit=&offset=` (zod ผ่าน `validateAndTransformQuery`: `limit` 1..100 ค่าเริ่มต้น 20, `offset` ≥ 0) → 200
    `{ memberships: [{ id, status, units, joined_at, order_id, group: { id, status, ends_at, pay_deadline_at, join_token }, campaign: { id, name },
    order: { id, display_id, status, is_draft_order, currency_code, total } }], count }` เฉพาะของผู้เรียก เรียง `joined_at` ใหม่สุดก่อน (รวม `cancelled`)
  - `GET /store/customers/me/group-buy/orders/:order_id` → 200 `{ membership: { id, status, units }, group: { id, status, ends_at, pay_deadline_at },
    order: { id, display_id, status, is_draft_order, currency_code, total, subtotal, discount_total, tax_total, payment_status,
    items: [{ id, title, variant_title, thumbnail, quantity, unit_price, total }],
    payment_collections: [{ id, amount, status, payment_sessions: [{ id, provider_id, status, amount, data: { id, client_secret, status } }] }] } }`
    (`data` เฉพาะ 3 key นี้ของ PaymentIntent — ไม่คืน `data` ทั้งก้อนของ provider; ADR-016 ข้อ 3);
    order ที่ไม่มี membership ของผู้เรียก (ของคนอื่น/ไม่มี/ไม่ใช่ group buy) → 404 `not_found`; header `Cache-Control: private, no-store`

## Admin UI / Storefront
- Admin (ข้อความอังกฤษ, `src/admin/`; แยกเป็น 3 PR):
  - GB-6a (#75): route page "Group buying" = ตารางแคมเปญ + ฟอร์มสร้างแคมเปญ
  - GB-6b: หน้ารายละเอียดแคมเปญ `/group-buying/:id` (admin route ใต้ route page "Group buying" ของ GB-6a — แก้รอบ 7 ไม่ใช่ `/group-buy/:id`) — badge สถานะ + ปุ่มเปลี่ยนสถานะ (`gb-campaign-activate` เมื่อ `draft`,
    `gb-campaign-end` เมื่อ `active`, ยืนยันด้วย `usePrompt`), ปุ่มลบ (`gb-campaign-delete`, เฉพาะ `draft`), ตารางกลุ่ม (`gb-groups-table`:
    kind, status, ความคืบหน้าเทียบ `target_value`, `ends_at`, `join_token`), ปุ่มสร้าง pool group (`gb-create-pool-group`, แสดงเฉพาะแคมเปญ `active`
    ที่ `group_mode ∈ {pool, both}`); ปรับฟอร์มสร้างของ GB-6a: product picker (`gb-product-picker`) แทนช่องกรอก product ID, ตรวจ
    `max_quantity ≥ max_units_per_person` (กฎข้อ 15), เตือน `ends_at` ในอดีต (กฎข้อ 16), กันกดซ้ำ (กฎข้อ 17) และคำเตือนว่าต้นแบบ `GBT-*` มองเห็นในหน้า
    promotion ของ Medusa (Q7)
  - GB-6c: แถวกลุ่มเปิดรายการ membership (`gb-memberships-table`: อีเมลลูกค้า, units, สถานะ membership, ลิงก์ไปหน้า order ของ Medusa admin,
    `payment_status`) + ปุ่ม succeed/fail แบบ manual (`gb-group-succeed`, `gb-group-fail`, เฉพาะกลุ่ม `open`, ยืนยันก่อนส่ง)
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
   หมดเวลาชำระเงิน — (รอบ 12, review #185) ปัจจุบัน "ได้รับการชำระเงินแล้ว" คืออีเมล `order-placed` ที่ส่งเมื่อ draft order ถูกแปลงหลัง capture (GB-5 #185) ซึ่งข้อความ
   ไม่พูดถึงการชำระเงิน — รอ owner ยืนยันว่ายอมรับใน v1 หรือต้องมี template แยก (Q14)
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
    → 404; membership ที่ `cancelled` แล้ว (leave ซ้ำ) หรือกลุ่มไม่ `open` หรือกลุ่ม**หมดเวลาแล้ว** (`ends_at <= now` แม้ status ยัง `open` เพราะ job
    ยังไม่ตัดสิน — session หลักเลือก, ส่งมอบใน GB-3b #95; ตรงกับแถว "หมดเวลาแล้ว" ของ join) → 400 `not_allowed`; ภายใต้ lock `group_buy:group:<id>` ปรับ membership →
    `cancelled` + ตัวนับ (ตาม `leaveGroupWorkflow`) ก่อน แล้ว `cancelOrderWorkflow` เป็นขั้นสุดท้าย (compensation คืนสถานะ/ตัวนับถ้ายกเลิก order ล้ม)
14. (owner 2026-10-26, ปิด Q9; ทำใน GB-3) cart หลัง join ยังมี `GB-<token>` — กันสองชั้นฝั่ง backend:
    (a) **ห้าม complete cart ที่มี promotion code ขึ้นต้น `GB-` ทุกกรณี** (ราคาลดของกลุ่มได้ผ่าน draft order ของ membership เท่านั้น): handler ของ
    `completeCartWorkflow.hooks.validate` throw 400 `NOT_ALLOWED` code `GB_CART_NOT_COMPLETABLE` — hook นี้มี handler เดียว (`createHook`) ที่ PROMO-1/FS-3
    ใช้อยู่แล้ว ต้อง**รวมเข้า handler เดิม** ไม่ลงทะเบียนใหม่
    (b) **join ซ้ำด้วย cart เดิม** (cart มี code `GB-*` อยู่แล้วตอนเริ่ม `joinGroupWorkflow` ขั้น 1) → 409 `GB_CART_ALREADY_JOINED` (เพิ่มใน allow-list ของ
    PROMO-2) ไม่สร้าง draft order/membership — ตรวจก่อนการตรวจ `PROMOTION_NOT_COMBINABLE`
    (c) storefront ล้าง cart (cookie `_medusa_cart_id`) หลัง join สำเร็จ แล้วเริ่ม cart ใหม่ตอนเพิ่มสินค้าครั้งถัดไป — ทำใน GB-7
    (d) (review #68, ยอมรับตามการออกแบบ) ถ้าลูกค้าเอา `GB-<token>` ออกจาก cart เดิมเอง (`DELETE /store/carts/:id/promotions`) cart นั้นไม่มี `GB-*` แล้ว
    จึง join ใหม่ได้ตามปกติ (ได้ membership/draft order ใหม่ ข้อจำกัดของกฎข้อ 4 ยังคุม) — ไม่ใช่ช่องโหว่ GB-7 ไม่ต้องกันกรณีนี้ แต่ต้องไม่พึ่ง "cart เดิม join ไม่ได้"
    เป็นเงื่อนไขของ UI
15. (GB-6b, review #75) ในฟอร์มสร้างแคมเปญ ถ้ากรอกทั้ง `application_method.max_quantity` และ `max_units_per_person` ต้อง `max_quantity ≥ max_units_per_person`
    (ไม่เช่นนั้นสมาชิกจะ join ด้วยจำนวนชิ้นที่ส่วนลดไม่ครอบ) — ฟอร์มแสดง hint ข้างช่องเสมอ และแสดง error `gb-max-quantity-error` + ไม่ส่ง request เมื่อผิด;
    บังคับเฉพาะในฟอร์ม (ต้นแบบแก้ภายหลังได้ที่หน้า promotion ของ Medusa จึงบังคับฝั่ง backend ตอนสร้างได้ไม่ครบ — owner ตัดสิน Q10 2026-10-26: ไม่ทำ backend validator)
16. (GB-6b, qa #75) ฟอร์มสร้างแคมเปญที่ `ends_at <= now` แสดงคำเตือน `gb-ends-at-warning` (ยังส่งได้ เพราะแคมเปญเป็น `draft` และ `draft → active`
    ถูกปฏิเสธโดย backend อยู่แล้วเมื่อ `ends_at <= now`)
17. (GB-6b, review #75) `POST /admin/group-buy/campaigns` ไม่ idempotent → ทุกปุ่มที่สร้างข้อมูลในหน้า Group buying (สร้างแคมเปญ, สร้าง pool group,
    succeed/fail) กันกดซ้ำด้วย in-flight flag (`useRef`) + `disabled` ระหว่างส่ง (แบบเดียวกับ FS-10, spec 03 กฎข้อ 15) — succeed/fail idempotent ฝั่ง
    backend อยู่แล้ว (กฎข้อ 8); การสร้างแคมเปญซ้ำโดยไม่ตั้งใจลบได้เพราะเป็น `draft`
18. (รอบ 7, บั๊กของ GB-3 จาก review) หลัง `joinGroupWorkflow` สร้าง draft order, step `freezeDraftOrderAdjustmentsStep` ใส่ adjustment ของ `GB-<token>` แต่**ไม่คำนวณ
    order summary ใหม่** → `summary.current_order_total`/`pending_difference` ค้างที่ยอดเต็ม (ก่อนส่วนลด) กระทบหน้า order ของ admin, ยอด payment collection,
    refund และ claim ต้องแก้ให้ summary ของ draft order ตรงกับ `order.total` หลังส่วนลดทันทีหลัง join: ใช้กลไกของ Medusa ที่คำนวณ summary ใหม่ (builder ตรวจ
    source 2.22.1 ของ Order module/core-flows ว่ามี method/workflow ใด เช่นการ apply ผ่าน order change แล้ว confirm) — **ห้ามเขียนตัวเลข summary ที่คำนวณเอง
    จากราคา line**; ถ้าไม่มีกลไกให้หยุดและรายงาน (อาจต้อง ADR) draft order ที่สร้างก่อนแก้ (dev/staging) ไม่ backfill
19. (รอบ 7, ข้อจำกัดของ GB-4 ที่ยอมรับใน v1) `succeedGroupWorkflow`/`failGroupWorkflow` ถือ lock ของกลุ่มด้วย TTL 60 วินาที (ค่าที่ GB-4 ใช้) — pool ขนาดใหญ่ที่ประมวลผล
    ทุก membership (สร้าง payment collection + อีเมล) ใน lock เดียวอาจเกิน TTL แล้ว lock หลุดระหว่างทาง ทำให้ job/admin override รอบอื่นเข้ามาซ้อน
    ความถูกต้องพึ่ง idempotency ต่อ membership (กฎข้อ 8: ข้าม `awaiting_payment`/`paid`/`cancelled`) — ยังเสี่ยง payment collection ซ้ำถ้าสองรอบทำ membership
    เดียวกันพร้อมกันพอดี — **ยอมรับใน v1** (Q11 ทาง (ก), owner ยืนยัน 2026-10-27) ไม่มี task; AC-1/AC-9 ทดสอบกับกลุ่มเล็ก
20. (รอบ 8, review #100) ส่วนลด % ทำให้ `order.total` ของ draft order มีทศนิยมไม่จำกัด (เช่น 699.99…) แต่ Stripe รับหน่วยสตางค์ — ยอดของ payment collection
    ของ membership = `order.total` **ปัด 2 ตำแหน่งแบบ half-up ด้วย `MathBN`** ตอนสร้าง collection ใน `succeedGroupWorkflow` (ปัจจุบัน `group-outcome.ts` ราวบรรทัด 126
    ของ GB-4 ส่ง raw) — ทำใน GB-5 (AC-37) ไม่คำนวณยอดจากราคา line เอง (กฎข้อ 18 ยังใช้); ส่วนต่างเศษสตางค์ (< 0.005) ที่เหลือใน `summary.pending_difference`
    หลัง capture ต้องไม่ทำให้ `convertDraftOrderWorkflow`/`payment_status` ผิด — builder ยืนยันใน test AC-37 ถ้าผิดให้หยุดและรายงาน
21. (รอบ 10, GB-8, ADR-016 accepted) ลูกค้าอ่าน draft order ของกลุ่มได้**เฉพาะผ่าน membership ของตัวเอง** (route ใน "API" รอบ 10): หา membership ด้วย
    `customer_id = auth_context.actor_id` ใน query เดียวกับการหา (ไม่อ่านก่อนแล้วเทียบ) อ่าน order ผ่าน read-only link `group_buy_membership ↔ order` และ
    `order.payment_collections` ด้วย `query.graph`; ไม่ใช่ของผู้เรียก/ไม่พบ → 404 (ADR-013 ข้อ 2); route อ่านอย่างเดียว ไม่เรียก workflow/ไม่เขียนข้อมูล;
    ทำงานทั้งก่อนและหลัง draft order ถูกแปลง (GB-5) — ไม่กรอง `is_draft_order`; (review #140) เพิ่ม index `(customer_id, joined_at)` (`WHERE deleted_at IS NULL`) บน
    `group_buy_membership` + migration ใน PR ของ GB-8 — index เดิม `(campaign_id, customer_id)`, `(group_id, status)` ไม่ขึ้นต้นด้วย `customer_id` (full scan ต่อ request)
22. (รอบ 10) การสร้าง/ต่อ payment session ของ draft order ใช้ `POST /store/payment-collections/:id/payment-sessions` ของ Medusa เท่านั้น (ownership ของ CORE-12
    ผ่าน `order.customer_id` ของ collection + guard ของ PAY-6a ที่ lock `payment_collection_id` ตามภาคผนวก ADR-015) — PAY-3a พิสูจน์ด้วย integration (spec 06 AC-18)
23. (รอบ 10, GB-6d — qa/review #121) หน้ารายละเอียดแคมเปญ admin: กด succeed/fail แล้ว**ล้ม** (เช่น 400/409 เพราะกลุ่มเปลี่ยนสถานะไปแล้ว) ต้อง invalidate query ของตารางกลุ่ม
    (`groupBuyKeys.groups`) ด้วย ไม่ใช่เฉพาะตอนสำเร็จ — สถานะในตารางตรง DB โดยไม่ต้อง reload; แถวกลุ่มที่เลือกอยู่มี highlight และปุ่มปิด `gb-memberships-close`;
    เปลี่ยนหน้าของตารางกลุ่มแล้วแถวที่เลือกยังคงอยู่ถ้ายังอยู่ในหน้าใหม่ มิฉะนั้นปิด `gb-memberships-table` (ไม่ค้างตารางของกลุ่มที่มองไม่เห็น); ตัด field ที่ไม่ใช้ (`Membership.order.total`)
24. (รอบ 11, GB-N3 — qa #143, review #145) (a) highlight ของแถวกลุ่มที่เลือก (กฎข้อ 23) ต้องครอบ**ทุก** cell รวม `td` แรกที่เป็น sticky (`bg-ui-bg-base` ทับสีของแถว) — ใส่สีที่ระดับ `td`;
    (b) (แก้ถ้อยคำตาม review #152 — route ปัจจุบันคำนวณถูกแล้วในกรณีปกติ) route รายตัวของ GB-8 (`orders/[order_id]/route.ts`) กรอง `null` ออกจาก `order.payment_collections` เป็น `collections`
    อยู่แล้วแต่ส่ง `order` ดิบเข้า `getLastPaymentStatus` — ให้ส่ง `{ ...order, payment_collections: collections }` (ชุดเดียวกับที่ใช้ส่วนอื่นของ response) เพื่อให้ `null` ใน array ไม่ทำให้
    เกิด TypeError (500) และสถานะคำนวณจากชุด collection เดียวกันทั้ง response
25. (รอบ 12, GB-9 — re-review #185 GB-5) alert `GROUP_BUY_PAID_WITHOUT_ORDER` ของ GB-5 (ถึง `OPS_ALERT_EMAIL`, เหตุ `convert_failed` / `membership_cancelled`):
    (a) ก่อนส่ง subscriber **อ่านสถานะใหม่** และส่งเฉพาะเมื่อยังเป็นเงินค้างจริง — `convert_failed`: order ยัง `is_draft_order = true` และ membership ไม่ใช่ `paid`;
    `membership_cancelled`: membership ยัง `cancelled` — ไม่เช่นนั้น log info ไม่ส่ง (กัน ops refund order ที่แปลงสำเร็จแล้ว); (b) idempotency key ของ alert = `<membership_id>:<reason>`
    (membership เดียวเจอทั้งสองเหตุได้ 2 ฉบับ); (c) runbook "group buy: จ่ายแล้วแต่แปลง order ไม่ได้/membership ถูกยกเลิก" ใน `docs/ops/production.md` ขึ้นต้นด้วยขั้น "ตรวจว่า order
    ยังเป็น draft และ membership ยังไม่ `paid` — ถ้าไม่ใช่ ถือว่า alert ผิด ปิด incident ห้าม refund" และเปิด draft order ด้วย URL `/app/orders/<order_id>` (draft ไม่อยู่ในรายการ Orders);
    (d) test ที่ตั้ง `OPS_ALERT_EMAIL` คืนค่าเดิมใน `afterAll`
26. (รอบ 12, GB-10 — review #185) ops แปลง draft order ของ membership `awaiting_payment` เอง (ปุ่ม Convert ของ `@medusajs/draft-order` หรือ `POST /admin/draft-orders/:id/convert-to-order`
    ตาม runbook ของกฎข้อ 25) → membership ต้องเป็น `paid`: subscriber ของ event ที่ `convertDraftOrderWorkflow` emit (`order.placed` — builder ยืนยันใน 2.22.1; ต่างจากนี้ให้ใช้ event
    ที่ emit จริงและบันทึกใน PR) สำหรับ order ที่มี `metadata.group_buy_membership_id` → workflow ใต้ lock ต่อ membership ตัวเดียวกับ GB-5: membership `awaiting_payment` + order
    `is_draft_order = false` + payment collection `completed` → `paid`; สถานะอื่น (รวม `paid` อยู่แล้วจากเส้นทางปกติของ GB-5) → noop + log info; ไม่ส่งอีเมลเพิ่ม
    (อีเมล `order-placed` ของการแปลงส่งแล้ว); ไม่แปลง/ไม่ refund อะไรเอง

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
  When A leave membership ในกลุ่มนั้น Then 400 และไม่มีอะไรเปลี่ยน; Given กลุ่ม `open` ที่ `ends_at <= now` (รอบ 8, กฎข้อ 13) When A leave Then 400
  `not_allowed` และไม่มีอะไรเปลี่ยน; Given ขั้น `cancelOrderWorkflow` ล้ม (inject ครั้งเดียว) Then M กลับเป็น `joined`
  และตัวนับเท่าก่อนเรียก (integration http)
- AC-26 (GB-3, กฎข้อ 14a) Given A join กลุ่ม G ด้วย cart C สำเร็จ (C มี `GB-<token>`) When A `POST /store/carts/C/complete` Then 400 `type=not_allowed`
  code `GB_CART_NOT_COMPLETABLE`, `C.completed_at` ยัง null และไม่มี order ใหม่ที่ไม่ใช่ draft; Given cart ที่ใส่ `GB-<token>` ผ่าน
  `POST /store/carts/:id/promotions` โดยไม่ join Then complete ได้ 400 เหมือนกัน; Given cart ที่ไม่มี `GB-*` (มีส่วนลด flash) Then complete สำเร็จตามเดิม
  (test ของ PROMO-1/FS-3 ยังผ่าน) (integration http)
- AC-27 (GB-3, กฎข้อ 14b) Given A join G ด้วย cart C สำเร็จ When A join G (หรือกลุ่มอื่นของแคมเปญเดียวกัน) ด้วย C อีกครั้ง Then 409
  `{ type: "conflict", code: "GB_CART_ALREADY_JOINED" }`, membership/draft order/ตัวนับไม่เปลี่ยน; When A join G ด้วย cart ใหม่ C2 Then 201 (integration http)
- AC-28 (GB-7, กฎข้อ 14c) Given A join สำเร็จใน storefront When กลับไปหน้าร้านแล้วเปิด cart Then cart ว่าง (ไม่มี line เดิม, ไม่มี `GB-*`) และการเพิ่มสินค้าสร้าง
  cart ใหม่ที่ id ต่างจาก C (e2e)
- AC-29 (GB-6a, #75) Given admin ล็อกอิน When เปิด route "Group buying" Then ตารางแสดงแคมเปญจาก `GET /admin/group-buy/campaigns` (ชื่อ + สถานะ);
  When กรอกฟอร์มสร้างครบแล้ว submit Then มี `POST /admin/group-buy/campaigns` 1 ครั้ง และแคมเปญใหม่สถานะ `draft` ปรากฏในตารางโดยไม่ reload
  (e2e admin หรือ component test ที่ mock `fetch` ตามที่ #75 ใช้)
- AC-30 (GB-6b) Given แคมเปญ `draft` When เปิดหน้ารายละเอียด Then เห็น `gb-campaign-activate` และ `gb-campaign-delete` ไม่เห็น `gb-campaign-end`;
  When กด activate แล้วยืนยัน Then `POST .../status {status:"active"}` 1 ครั้ง, badge เป็น `active`, `gb-campaign-delete` หายไป และเห็น `gb-campaign-end`;
  Given แคมเปญ `ended` Then ไม่มีปุ่มเปลี่ยนสถานะ/ลบ; Given แคมเปญ `draft` When กดลบแล้วยืนยัน Then `DELETE /admin/group-buy/campaigns/:id` 1 ครั้ง
  และกลับไปหน้ารายการที่ไม่มีแคมเปญนั้น; When กดลบแล้ว**ยกเลิก**ในกล่องยืนยัน Then ไม่มี request (e2e admin)
- AC-31 (GB-6b) Given แคมเปญ `active` `group_mode=both` ที่มีกลุ่ม 2 กลุ่ม Then `gb-groups-table` มี 2 แถว แต่ละแถวแสดง kind, status, ความคืบหน้า
  (`progress_*` ตาม `target_type` / `target_value`), `ends_at`; When `dblclick` `gb-create-pool-group` Then `POST .../groups` **1** ครั้ง และตารางมี 3 แถว;
  Given แคมเปญ `draft` หรือ `group_mode=team` Then ไม่มี `gb-create-pool-group` (e2e admin)
- AC-32 (GB-6b, กฎข้อ 15–17) Given ฟอร์มสร้างแคมเปญ When `max_quantity=1`, `max_units_per_person=2` แล้ว submit Then เห็น `gb-max-quantity-error`
  และไม่มี `POST /admin/group-buy/campaigns`; When `max_quantity=2` (หรือเว้นว่าง `max_units_per_person` — ช่อง `max_quantity` บังคับกรอกในฟอร์ม
  จึงเว้นว่างไม่ได้; แก้ถ้อยคำรอบ 8 ตาม review #96) Then ส่งได้; When `ends_at` เป็นเวลาที่ผ่านไปแล้ว Then
  เห็น `gb-ends-at-warning` และยังส่งได้ (แคมเปญ `draft`); When `dblclick` ปุ่ม submit ของฟอร์มที่ถูกต้อง Then มี `POST` **1** ครั้งและแคมเปญใหม่ 1 แถว
  (component test ที่ mock `fetch` หรือ e2e admin)
- AC-33 (GB-6b) Given ฟอร์มสร้างแคมเปญ When เลือกสินค้า 2 ตัวผ่าน `gb-product-picker` (ค้นหาด้วยชื่อ) แล้ว submit Then body ของ `POST` มี
  `application_method.target_rules = [{ attribute: "items.product.id", operator: "in", values: [<id1>, <id2>] }]`; และในฟอร์มไม่มีช่องกรอก product ID
  แบบข้อความอิสระ (component test ตรวจ body ที่ส่ง)
- AC-34 (GB-6c) Given กลุ่ม G ที่มี membership 2 รายการ (`joined` 1, `cancelled` 1) When admin `GET /admin/group-buy/groups/G/memberships` Then 200
  `count=2` และแต่ละรายการมี `order_id`, `order.status`, `order.payment_status`, `customer.email` ตรงกับ DB; `limit=1&offset=1` → 1 รายการ `count=2`;
  `limit=101`, `limit=0`, `offset=-1`, `limit=abc` → 400; กลุ่มไม่มีจริง → 404; ไม่มี token → 401
  (integration http)
- AC-35 (GB-6c) Given กลุ่ม `open` ที่มีสมาชิก When admin เปิดแถวกลุ่มใน `gb-groups-table` Then `gb-memberships-table` แสดงสมาชิกครบพร้อมลิงก์ไป
  หน้า order ของ Medusa admin (`/draft-orders/<order_id>` เมื่อ order ยังเป็น draft, `/orders/<order_id>` เมื่อแปลงแล้ว — builder ยืนยัน path ของ dashboard
  2.22.1); When กด `gb-group-succeed` แล้วยืนยัน Then `POST /admin/group-buy/groups/G/succeed` 1 ครั้ง (ซ้ำด้วย `dblclick` ก็ 1 ครั้ง), status ของกลุ่มเป็น
  `succeeded` และปุ่ม succeed/fail หายไป; Given กลุ่มที่ไม่ใช่ `open` Then ไม่มีปุ่ม succeed/fail (e2e admin)
- AC-36 (GB-3c, กฎข้อ 18) Given แคมเปญ −30% scope = product X ราคา ฿1,000 When A join ด้วย cart ที่มี X qty 1 Then draft order มี `total` = 700 และ
  `summary.current_order_total` = 700, `summary.pending_difference` = 700 (ยังไม่มี payment; เทียบด้วย `MathBN`/raw ไม่ใช่ float); `GET /admin/orders/:id`
  (หรือ `/admin/draft-orders/:id`) คืน summary เท่ากัน; When `createOrUpdateOrderPaymentCollectionWorkflow` ของ draft order นั้นโดยไม่ระบุ amount Then
  `amount` = 700 (แก้รอบ 8 ตาม review #100: workflow นี้คิดยอดจาก `summary.pending_difference` — `createOrderPaymentCollectionWorkflow` ไม่อ่าน summary
  จึงพิสูจน์บั๊กไม่ได้); หลัง GB-3c draft order มี `version` = 2 (ผลของ order change ที่ confirm — test ที่อ่าน item/adjustment ต้องไม่ยึด version 1)
  (integration http)
- AC-37 (GB-5, รอบ 8, review #100) Given แคมเปญส่วนลด % ที่ทำให้ `order.total` ของ draft order มีทศนิยมเกิน 2 ตำแหน่ง (เช่น 699.99…; builder ใช้ fixture
  ราคา/ส่วนลดที่ #100 พบ) When กลุ่มสำเร็จ (GB-4) Then `payment_collection.amount` มีทศนิยม ≤ 2 ตำแหน่ง = `order.total` ปัด 2 ตำแหน่งแบบ half-up ด้วย
  `MathBN` (ไม่ใช้ `Number`); When สมาชิกชำระและ capture ยอดนั้นผ่าน provider (mock หรือ Stripe test mode) Then `payment_collection.status` = `completed`
  (ไม่ใช่ `partially_captured`/`authorized`), draft order ถูกแปลงเป็น order ปกติ (`convertDraftOrderWorkflow` สำเร็จ), order `payment_status=captured`
  และ membership `paid` (integration http, กฎข้อ 20)
- AC-38 (GB-8, กฎข้อ 21) Given A มี membership M1 (`joined`) และ M2 (`cancelled`) ในแคมเปญเดียวกัน และ B มี membership M3 When A `GET /store/customers/me/group-buy/memberships`
  Then 200 `count=2` มี M1, M2 (ไม่มี M3) แต่ละรายการมี `group.status`, `group.pay_deadline_at`, `campaign.name`, `order.id`, `order.is_draft_order=true`, `order.total`
  เท่ากับ draft order ใน DB (เทียบ `MathBN`); `limit=1&offset=1` → 1 รายการ `count=2`; `limit=101`, `limit=0`, `offset=-1` → 400; ไม่มี token → 401 (integration http)
- AC-39 (GB-8, กฎข้อ 21) Given กลุ่มของ M1 สำเร็จแล้ว (GB-4 สร้าง payment collection) When A `GET /store/customers/me/group-buy/orders/<order ของ M1>` Then 200 มี `items`,
  `payment_collections[0].amount` = ยอดของ collection ใน DB, `membership.status = "awaiting_payment"`, `group.pay_deadline_at` และ header `Cache-Control` มี `no-store`;
  When B เรียก path เดียวกัน, A เรียกด้วย `order_xxx` ที่ไม่มีจริง หรือด้วย id ของ order ปกติของ A ที่ไม่ใช่ group buy Then 404 `type = "not_found"`; ไม่มี token → 401;
  Given A สร้าง session ผ่าน `POST /store/payment-collections/:id/payment-sessions` แล้ว When GET ซ้ำ Then `payment_sessions` มี session นั้น และ `data` มี key เฉพาะ
  `id`, `client_secret`, `status` (ไม่มี key อื่นของ provider) (integration http); Given migration ของ GB-8 รันแล้ว Then `pg_indexes` ของ `group_buy_membership` มี index ที่คอลัมน์
  `(customer_id, joined_at)` (integration modules)
- AC-40 (GB-8, กฎข้อ 21) Given draft order ของ M1 ถูกแปลงเป็น order ปกติแล้ว (ตั้งผ่าน `convertDraftOrderWorkflow` ใน test) When A GET รายตัว Then 200 `order.is_draft_order=false`
  และ `membership.status` ตาม DB (integration http)
- AC-41 (GB-6d, กฎข้อ 23) Given กลุ่มที่หน้าแสดงเป็น `open` แต่ใน DB ถูกตั้งเป็น `succeeded` แล้ว (ทาง API ระหว่างที่หน้าเปิดอยู่ หรือ mock `fetch`) When admin กด
  `gb-group-fail` แล้วยืนยัน และ route ตอบ 4xx Then มี request `GET` รายการกลุ่มใหม่ และภายใน 5 วินาทีโดยไม่ reload status ของแถวกลุ่มใน `gb-groups-table` เป็น `succeeded`
  และปุ่ม succeed/fail หายไป; Given เลือกแถวกลุ่มอยู่ When กด `gb-memberships-close`
  Then `gb-memberships-table` หายไป; When เปลี่ยนหน้าของตารางกลุ่มไปหน้าที่ไม่มีแถวที่เลือก Then ไม่มี `gb-memberships-table`; grep: type `Membership` ใน
  `src/admin/` ไม่มี `order.total` (e2e admin หรือ component test ที่ mock `fetch`)
- AC-42 (GB-N3, กฎข้อ 24) Given เลือกแถวกลุ่มใน `gb-groups-table` Then computed `background-color` ของ `td` แรกของแถวนั้นเท่ากับของ `td` ที่สองและต่างจากแถวที่ไม่ถูกเลือก (e2e admin);
  unit ของ handler `GET` ของ route รายตัว GB-8 (mock `query.graph` คืน order ที่ `payment_collections: [null, c]` โดย `c.status = "authorized"`) Then ไม่ throw และ `payment_status` =
  ค่าที่ `getLastPaymentStatus` ให้กับ order ที่มีเฉพาะ `c` — test นี้**ล้มก่อนแก้** (TypeError); integration เดิมของ AC-38..40 ยังผ่าน (unit jest + integration http)
- AC-43 (GB-9, กฎข้อ 25) unit ของฟังก์ชันตัดสินการส่ง alert: `convert_failed` + order `is_draft_order=false` → ไม่ส่ง; + membership `paid` → ไม่ส่ง; + draft และ `awaiting_payment` → ส่ง;
  `membership_cancelled` + membership `cancelled` → ส่ง; key = `<membership_id>:<reason>`; integration: กรณีสต็อกหมดตอนแปลงและกรณี capture หลังยกเลิก (test เดิมของ GB-5) ยังได้ alert
  1 ฉบับต่อกรณี; unit อ่าน `docs/ops/production.md`: หัวข้อ group buy มีขั้นตรวจ draft ก่อนขั้น refund และมี `/app/orders/`; `process.env.OPS_ALERT_EMAIL` หลัง suite เท่ากับก่อน suite
  (unit jest + integration http)
- AC-44 (GB-10, กฎข้อ 26) Given membership M `awaiting_payment` ที่ collection `completed` แต่ order ยังเป็น draft (สร้างสภาพแบบ test สต็อกหมดของ GB-5 แล้วเติมสต็อก) When admin
  `POST /admin/draft-orders/<order>/convert-to-order` Then order `is_draft_order=false` และ M เป็น `paid` ภายในรอบ subscriber; ส่ง event ซ้ำ → ไม่เปลี่ยน/ไม่มี error; Given membership
  `awaiting_payment` ที่ collection ยังไม่ `completed` แล้ว admin แปลง Then M ไม่เปลี่ยน และมี log info; AC-2 (API) ของ GB-5 ยังผ่าน (integration http)

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
  AC-21b, AC-22, AC-23, AC-24, AC-25, AC-26, AC-27, AC-36, AC-37
  โดย mock payment provider
- e2e: AC-2, AC-16 กับ Stripe test mode; AC-28
- Integration (http): AC-34 (GB-6c)
- e2e admin / component test (mock `fetch`): AC-29 (GB-6a), AC-30..AC-33 (GB-6b), AC-35 (GB-6c) — ใช้ helper login admin ร่วมของ OPS-11 (spec 07)
  ถ้าเป็น e2e admin ตัวที่สองของโปรเจกต์
- Integration (http): AC-38, AC-39, AC-40 (GB-8); e2e admin / component test: AC-41 (GB-6d)
- (รอบ 12) unit + integration (http): AC-43 (GB-9); integration (http): AC-44 (GB-10)

## Tasks
| ID | Task | Depends |
|----|------|---------|
| GB-1 | models/service/links/migrations ของ module + unit tests — membership มี `campaign_id`, ไม่มี unique `(group_id, customer_id)`, `order_id` unique + read-only link ไป order, index ตาม Non-functional (ADR-009) | CORE-2 |
| GB-2a | link template (ADR-011) + `createGroupBuyCampaignWorkflow` / `updateGroupBuyCampaignWorkflow` / `deleteGroupBuyCampaignWorkflow` / `setGroupBuyCampaignStatusWorkflow` + admin API: campaigns CRUD, `.../status` (AC-20a, AC-21a) | GB-1, ADR-011 accepted |
| GB-2b | `computeGroupEndsAt` + `createGroupWorkflow` (pool + team ระดับ workflow, ตรวจช่วงเวลาแคมเปญ) + admin `POST/GET /admin/group-buy/campaigns/:id/groups` (AC-19, AC-20b, AC-21b) — **ไม่รวม** `POST /store/group-buy/groups` | GB-2a |
| GB-2c | follow-up owner/review (เล็ก): ค่าเริ่มต้น `is_tax_inclusive: true` ของต้นแบบใน validator ของ `POST /admin/group-buy/campaigns` และ `createGroupBuyCampaignWorkflow` (กฎข้อ 12) + test rollback เมื่อขั้น link ของ `createGroupWorkflow` ล้ม (AC-20c, AC-20d) — ไม่แตะ store route | GB-2b |
| GB-3 | `joinGroupWorkflow` (draft order, lock scope ADR-009, ตรวจช่วงเวลา + ตรวจว่ามี adjustment ของ `GB-<token>`) + store endpoint `POST /store/group-buy/groups` (team, เรียก `createGroupWorkflow` จาก GB-2b), join, leave + 409 ผ่านกลไกของ PROMO-2 ตามกฎข้อ 11 (ไม่แปลงเอง) + concurrency tests (AC-4, AC-5, AC-6, AC-7, AC-8, AC-13, AC-14, AC-15, AC-17, AC-18, AC-23, AC-24); ใช้ hook exclusivity จาก PROMO-1 ไม่เขียนเอง; ตรวจเจ้าของ cart ด้วย helper ของ CORE-12; **เพิ่ม 2026-10-26 (owner, Q9)**: ห้าม complete cart ที่มี `GB-*` (รวมเข้า handler `completeCartWorkflow.hooks.validate` เดิม) + 409 `GB_CART_ALREADY_JOINED` (กฎข้อ 14a/b, AC-26, AC-27) | GB-2b, PROMO-1, PROMO-2 (AC-14 ส่วนที่สอง: ใส่ `SAVE10` ผ่าน route ของ Medusa ต้องได้ code ของเรา), CORE-12 (AC-24) |
| GB-3b | (แยกจาก GB-3 ตาม PR #68, owner 2026-10-26) `leaveGroupWorkflow` + `POST /store/group-buy/memberships/:id/leave` ตามกฎข้อ 13 (AC-7, AC-15 ส่วน leave, AC-17 ส่วน "หลัง leave", AC-25) — GB-3 (#68) ส่งมอบ join + สร้างทีม ส่วน AC อื่นในแถว GB-3 คงเดิม; **รวม nit review #68**: prettier `workflows/group-buy/join-group.ts` บรรทัด 45-46 และ guard ผลของ `query.graph` ที่อ่าน `groups[0]`/`campaigns[0]` (ไม่พบ → `MedusaError NOT_FOUND` แทนอ่าน property ของ `undefined`) | GB-3 |
| GB-4 | `succeedGroupWorkflow` / `failGroupWorkflow` + deadline job (รวมตั้งแคมเปญ `ended`) + admin succeed/fail + อีเมล (AC-1, AC-3, AC-9, AC-11, AC-12, AC-22) — **ข้อควรระวังจาก review #68**: ยอดของ payment collection ต้องมาจากยอดของ draft order ที่ Medusa คำนวณ (ระวัง `summary.current_order_total` ของ draft order ที่สร้างตอน join — ตรวจว่าตรงกับ `total` หลังส่วนลด `GB-*`) ไม่คำนวณยอดเอง; test AC-1 assert `payment_collection.amount` = ยอดหลังส่วนลดของ draft order | GB-3 |
| GB-3c | (เล็ก, รอบ 7, บั๊ก GB-3) `freezeDraftOrderAdjustmentsStep` คำนวณ summary ของ draft order ใหม่หลังใส่ adjustment ด้วยกลไกของ Medusa (กฎข้อ 18, AC-36) — GB-4 (#89) สร้าง payment collection จาก `order.total` (ไม่ใช่ summary) จึงไม่ได้รับผลจากบั๊กนี้ แต่หน้า admin/refund/claim ยังได้รับผล | GB-3 (∥ GB-3b, GB-4) |
| GB-5 | ☑ #185 (รวม ops alert `GROUP_BUY_PAID_WITHOUT_ORDER` + runbook เงินค้าง ตาม review #185; follow-up → GB-9, GB-10, Q13–Q14) — Subscriber payment captured → แปลง draft order; หมดเวลาชำระเงิน (AC-2 API, AC-10) + **รอบ 8**: ปัดยอด payment collection 2 ตำแหน่งใน `succeedGroupWorkflow` (แก้ `group-outcome.ts` ของ GB-4) และ test สถานะ `completed` หลัง capture (กฎข้อ 20, AC-37) — **ต้องมี GB-3c merge ก่อน** หรือรวม GB-3c ไว้ใน PR นี้ (ทั้ง task + AC-36) — (รอบ 10) test ของ GB-5 สร้าง session ผ่าน store route ของ Medusa บน collection ของ draft order ด้วย mock provider จึงพึ่ง**เฉพาะ PAY-3a** (พิสูจน์ ownership + guard บน collection ของ order) ไม่ต้องรอหน้า storefront PAY-3b | GB-4 ☑, PAY-3a, GB-3c ☑ (#100) |
| GB-N1 | ☑ #106 — (เล็ก, รอบ 8, รวม nit ที่สะสม — test เดิมต้องผ่าน; test ใหม่ที่ต้องมี: integration inject ให้ขั้น confirm order change ของ GB-3c ล้ม → order change เป็น `declined` และ draft order ไม่มี adjustment ค้าง; assertion credit line ใน e2e refund ของ PAY-4 ตาม spec 06 AC-6) **GB-3b (#95)**: `leaveGroupWorkflow` ตรวจเจ้าของ membership (select `customer_id` ขั้น 0) **ก่อน**ขอ lock, ใส่ `canceled_by: customer_id` ตอนยกเลิก order, ตัด `as any` ใน `cancelGroupMembershipStep`; **GB-4 (#89)**: log กรณี `at_deadline` ไม่ตรงเป็น `warn` แทน `error`; **GB-6b2 (#96)**: `gb-ends-at-warning` ใช้สีเตือน (ไม่ใช่สี error) และ test ของ product picker ครอบ selection ข้ามหน้า; **GB-3c (#100 merged แล้ว)**: comment ว่า `provider_id` ของ adjustment หายหลัง `applyOrderChanges`, เรียก `declineOrderChange` (ของ Medusa) เมื่อขั้น confirm ล้ม; **CORE-12b**: comment `allowUnauthenticated` ซ้ำใน `src/api/store/ownership/middlewares.ts` (spec 01); **CORE-18**: comment "onboarding status" ล้าสมัยใน storefront `src/middleware.ts` ราวบรรทัด 88; **PAY-6a (#82)**: ย้าย constant `PAYMENT_ALREADY_COMPLETED` ไปไฟล์ errors และ comment ใน test guard × webhook ว่า 409/5xx ของฝั่งที่แพ้ถือว่าผ่าน (spec 06 หมายเหตุรอบ 6) — ถ้าเกิน ~400 LOC แยก backend/storefront | GB-3c (#100), PAY-6b (#97/#98 — แตะไฟล์ guard/errors ใกล้กัน) |
| GB-6a | ☑ #75 — route page "Group buying": ตารางแคมเปญ + ฟอร์มสร้างแคมเปญ (AC-29) | GB-2b |
| GB-6b | หน้ารายละเอียดแคมเปญ: เปลี่ยนสถานะ, ลบ `draft`, ตารางกลุ่ม, สร้าง pool group; ปรับฟอร์มสร้าง: product picker แทนกรอก ID, ตรวจ `max_quantity ≥ max_units_per_person`, เตือน `ends_at` อดีต, กันกดซ้ำ, คำเตือน `GBT-*` (กฎข้อ 15–17; AC-30..33) — frontend ล้วน ใช้ API ของ GB-2a/GB-2b; แยกแล้ว: **GB-6b1 = ☑ #87** (หน้ารายละเอียด `/group-buying/:id`, AC-30, AC-31 + รวม OPS-11 `e2e/support/admin.ts` AC-16 และ regex evidence) และ **GB-6b2 = ☑ #96** (ฟอร์ม, AC-32, AC-33) | GB-6a |
| GB-6c | membership + succeed/fail manual: route `GET /admin/group-buy/groups/:id/memberships` + integration test (AC-34) + ตาราง membership และปุ่ม succeed/fail ในหน้ารายละเอียด (AC-35); แยกแล้ว: **GB-6c1 = ☑ #114** (route, AC-34) → **GB-6c2 = ☑ #121** (UI, AC-35; nit/qa ของ #121 → GB-6d) — **GB-6c2 รวม nit review #114**: test `order.payment_status` กรณีกลุ่มมี payment collection แล้ว, test 404 assert `type = "not_found"`, และตาราง membership รองรับ `customer = null` (ลูกค้าถูกลบ → แสดง `customer_id` แทนอีเมล ไม่พัง) | GB-6b (GB-6b1 ถ้าแยก), GB-3, GB-4 (route succeed/fail) |
| GB-N2 | (เล็ก, test-only, รอบ 9 — CI flaky ใน #111 รอบแรก) `integration-tests/http/group-buy-join.spec.ts` กรณี concurrency ล้มด้วย hook timeout 240s: หาสาเหตุจาก log จริงก่อน (lock รอ TTL, DB pool, หรือ setup หนัก) แล้วแก้ที่ test (ลดจำนวน request พร้อมกันให้พอพิสูจน์ AC-8/AC-13, แยก setup ไป `beforeAll`, ตั้ง timeout ของ hook ให้สอดคล้อง) — ห้ามแก้ด้วยการเพิ่ม timeout อย่างเดียว; AC-8/AC-13/AC-18 ต้องยังพิสูจน์ได้ และ suite ผ่าน 5 รอบติดใน CI (ระบุ run id ใน PR) — ◐ #126; **nit review #126 (รอบ 10)**: helper `trackSubscribers` ต้องคัดลอก `subscriberId` ของ subscriber เดิม (แก้ใน #126 ก่อน merge); การพึ่ง `eventEmitter_` ภายในของ local event bus บันทึกใน checklist bump ของ spec 07 ข้อ 6 | GB-3 ☑ |
| GB-8 | (เล็ก, backend, รอบ 10 — builder PAY-3 หยุดเพราะ Store API อ่าน draft order ไม่ได้) store route อ่านอย่างเดียว `GET /store/customers/me/group-buy/memberships` + `GET /store/customers/me/group-buy/orders/:order_id` ตาม "API" รอบ 10 (กฎข้อ 21; ADR-016) + index `(customer_id, joined_at)` บน `group_buy_membership` + migration + integration test (AC-38..40) — ใช้ร่วมโดย PAY-3b (หน้าชำระเงิน + poll) และ GB-7 (รายการใน account) | ADR-016 ☑ accepted (owner 2026-10-27), GB-4 ☑, GB-3b ☑ — **เริ่มได้** |
| GB-6d | (เล็ก, admin UI, รอบ 10 — qa/review #121) invalidate ตารางกลุ่มเมื่อ succeed/fail ล้ม, highlight + ปุ่มปิดของแถวที่เลือก, selection ข้ามหน้า, ตัด `Membership.order.total` ที่ไม่ใช้ (กฎข้อ 23) (AC-41) | GB-6c2 ☑ (#121) |
| GB-N3 | (เล็ก, รอบ 11 — qa #143, nit review #145) highlight `td` แรก (admin) + ส่ง collection ที่กรอง `null` แล้วเข้า `getLastPaymentStatus` ใน route รายตัว GB-8 (กฎข้อ 24) (AC-42) — ไฟล์: ตารางกลุ่มใน `src/admin/routes/group-buying/[id]/`, `orders/[order_id]/route.ts` ของ GB-8 | GB-6d ☑ (#143), GB-8 ☑ (#145) — เริ่มได้; ไม่บล็อก PAY-3b |
| GB-9 | (backend เล็ก, รอบ 12 — re-review #185) alert เงินค้างอ่านสถานะใหม่ก่อนส่ง, idempotency key ต่อ membership+เหตุ, runbook ขั้นตรวจ draft + URL `/app/orders/<id>`, test คืนค่า `OPS_ALERT_EMAIL` (กฎข้อ 25) (AC-43) — ไฟล์: `src/subscribers/group-buy-payment-captured.ts`, `src/workflows/group-buy/membership-payment.ts`, `docs/ops/production.md`, `integration-tests/http/group-buy-payment.spec.ts` | GB-5 ☑ (#185) — **เริ่มได้** |
| GB-10 | (backend เล็ก, รอบ 12 — review #185) membership เป็น `paid` เมื่อ ops แปลง draft order เองหลังเงินเข้า (กฎข้อ 26) (AC-44) — ไฟล์: subscriber ใหม่ใน `src/subscribers/`, workflow/step ใน `src/workflows/group-buy/` | GB-5 ☑ (#185) — เริ่มได้; ชน `membership-payment.ts` กับ GB-9 ตัวที่ merge ทีหลัง rebase |
| GB-7 | หน้า storefront แคมเปญ/กลุ่ม/account/ชำระเงิน + ล้าง cart หลัง join (กฎข้อ 14c; 14d ไม่ต้องกัน) + e2e (AC-2, AC-16, AC-28); ข้อความไทยตรงในโค้ด + path ใหม่ใน ESLint rule (spec 01 CORE-4 กฎข้อ 4, ADR-014); (รอบ 10) รายการ draft order ของกลุ่มในหน้า account อ่านจาก route ของ GB-8 และลิงก์ไปหน้าชำระเงินของ PAY-3b (ไม่สร้างหน้าชำระเงินซ้ำ) | GB-5, GB-8, PAY-3b (spec 06), GB-3b ☑ |
GB-1 → GB-2a → GB-2b → (GB-2c ∥ GB-6a → GB-6b ∥ (GB-3 → GB-4 → GB-5 → GB-7)); GB-6c หลัง GB-6b และ GB-4; GB-3 ต้องรอ PROMO-2 (spec 03) และ CORE-12 (spec 01) merge ด้วย
GB-6b/GB-6c เป็น e2e admin ตัวที่สองขึ้นไป (ต่อจาก FS-10) → ใช้ helper ร่วมของ OPS-11 (spec 07); ถ้า OPS-11 ยังไม่ merge ตัวที่เริ่มก่อนรวม OPS-11 เข้า PR ของตัวเอง
GB-3b ∥ GB-4 หลัง GB-3 (GB-3b แตะ workflow/route leave แยกไฟล์; ถ้าแตะ `utils/join.ts`/`errors.ts` ร่วมกัน ตัวที่ merge ทีหลัง rebase);
GB-7 ต้องรอ GB-3b ด้วย (ปุ่มออกจากกลุ่มในหน้า account)
GB-3c ∥ GB-3b ∥ GB-4 หลัง GB-3 (แตะ step freeze ใน workflow join — ไฟล์ร่วมกับ GB-3b ตัวที่ merge ทีหลัง rebase); GB-5 ต้องรอ GB-3c (หรือรวมไว้)
GB-N1 หลัง GB-3c (#100) และ PAY-6b (#97/#98) merge; ∥ GB-5 (GB-5 แตะ `group-outcome.ts` ส่วนสร้าง collection, GB-N1 แตะ log `at_deadline` ไฟล์เดียวกันได้ — ตัวที่ merge
ทีหลัง rebase) ไม่บล็อก release
GB-2c ไม่บล็อก GB-3 (แตะ `campaign.ts`/`validators.ts`/test ของ `create-group` ไม่ใช่ไฟล์ join) แต่ควร merge ก่อน release v0.5.0
(รอบ 10) ลำดับใหม่ของ critical path ชำระเงิน: PAY-3a (เริ่มได้ทันที) ∥ GB-8 (เริ่มได้ — ADR-016 accepted) → GB-5 (← PAY-3a) ∥ PAY-3b (← GB-8) → GB-7 (← GB-5, GB-8, PAY-3b);
GB-6d ∥ ทุกตัว (admin UI ล้วน); GB-8 กับ PAY-3a คนละไฟล์ (route ใหม่ใต้ `src/api/store/customers/me/group-buy/` vs test ของ payment collection) ขนานได้
(รอบ 11) สถานะ: GB-6d ☑ #143, GB-8 ☑ #145 → PAY-3b เริ่มได้เมื่อ PAY-3a ☑ ด้วย (ดู spec 06); GB-N3 เริ่มได้ทันที (ไม่บล็อกงานอื่น); PAY-3a, GB-5, GB-7 ☐
(รอบ 12) สถานะ: PAY-3a ☑ #157, GB-N3 ☑ #161, GB-5 ☑ #185; PAY-3b ◐ (builder) → GB-7 (← PAY-3b); GB-9 ∥ GB-10 เริ่มได้ (backend; ไม่บล็อก GB-7 แต่ควร merge ก่อน release v0.5.0);
review #185: test "convert ล้มเพราะสต็อกหมด" มีแล้วใน #185 (ไม่ต้องมี task); คำถาม owner Q13, Q14 ด้านล่าง และ spec 05 Q19 (ค่าคอม affiliate ของ order กลุ่ม)

## Open questions
- **Q13** (รอบ 12, review #185 — ต้องให้ owner ตัดสิน) เงินถูก capture แต่ไม่มี order ที่ใช้ได้ (GB-5 ตอนนี้ทำแค่ ops alert + runbook — ops ตัดสิน refund หรือเติมสต็อกแล้วแปลงเอง):
  (1) แปลงไม่สำเร็จ (เช่นสต็อกหมด) → membership ค้าง `awaiting_payment` + collection `completed`; (2) เงินเข้าหลัง membership ถูกยกเลิกเพราะหมดเวลา (พร้อมเพย์จ่ายช้า) ทางเลือก:
  (ก) **[แนะนำ] คงแบบ manual ใน v1** (alert + runbook ของกฎข้อ 25 + GB-10 อัปเดต membership เมื่อ ops แปลงเอง) — เหตุผล: สาเหตุหลักของ (1) คือสต็อกหมดซึ่งลองซ้ำไม่ช่วยจนกว่าจะเติมสต็อก
  และต้องมีคนเลือกว่าจะคืนเงินหรือส่งของ; ปริมาณช่วงแรกน้อย; ไม่มีโค้ดเงินอัตโนมัติเพิ่ม;
  (ข) job ลองแปลงใหม่ทุก N นาทีสูงสุด K ครั้งสำหรับ membership `awaiting_payment` + collection `completed` แล้วค่อย alert — ช่วยกรณีล้มชั่วคราว (DB/lock) ~150 LOC;
  (ค) refund อัตโนมัติสำหรับกรณี (2) ผ่าน `refundPaymentWorkflow` + อีเมลแจ้งลูกค้า — ลูกค้าได้เงินคืนเร็ว แต่เพิ่มเส้นทางเงินอัตโนมัติที่ต้องกันซ้ำ/ทดสอบกับ Stripe ~250 LOC
  ((ข) และ (ค) เลือกร่วมกันได้)
- **Q14** (รอบ 12, review #185) อีเมล "ได้รับการชำระเงินแล้ว" (กฎข้อ 9): (ก) **[แนะนำ] ใช้อีเมล `order-placed` ที่ส่งหลังแปลง draft (ตามที่ GB-5 ทำ) ใน v1** แล้วบันทึกเป็นกฎ —
  ส่งเฉพาะหลัง capture จึงตรงเวลา ไม่เพิ่ม template; ข้อเสีย: ข้อความไม่พูดถึงการชำระเงิน; (ข) template แยก `group-buy-payment-received` (ไทย) ส่งจาก subscriber ของ GB-5 แทน/เพิ่มจาก
  `order-placed` ~80 LOC (task เล็ก ต่อจาก GB-9)
- ~~Q12~~ ตัดสินแล้ว (owner 2026-10-27): **อนุมัติ ADR-016 ทางเลือก A** → GB-8 เริ่มได้; คำถามเดิม (รอบ 10): อนุมัติ store route อ่านอย่างเดียวของ draft order ผ่าน membership
  (`/store/customers/me/group-buy/memberships`, `/orders/:order_id`) หรือไม่ — ข้อเสนอที่ owner รับ: ทางเลือก A เหตุผล: Medusa 2.22.1 ไม่มีทางอ่าน draft order ฝั่ง store (กรองใน handler), pattern เดียวกับตัวอย่าง Quotes ของ Medusa, สิทธิ์ผูกกับ membership ของ
  module เรา (ไม่เปิด draft order ที่ admin สร้างประเภทอื่น) และใช้ร่วม 2 ที่ (PAY-3b, GB-7); ไม่มี route ชำระเงินใหม่ — ถ้าไม่อนุมัติ PAY-3b และ GB-7 เริ่มไม่ได้
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
- ~~Q10~~ ตัดสินแล้ว (owner 2026-10-26): ตรวจ `max_quantity ≥ max_units_per_person` ในฟอร์ม admin + กันกดซ้ำฝั่ง UI พอ — **ไม่**เพิ่ม backend validator
  และไม่ทำ `POST /admin/group-buy/campaigns` ให้ idempotent (route ของ admin เท่านั้น แคมเปญที่ซ้ำเป็น `draft` ลบได้) — กฎข้อ 15, 17
- ~~Q11~~ ตัดสินแล้ว (owner ยืนยัน 2026-10-27): (ก) ยอมรับ lock TTL 60s ของ succeed/fail ใน v1 (pool จริงช่วงแรกเล็ก และ idempotent ต่อ membership) — กฎข้อ 19
  ไม่มี task; ทบทวนใหม่เมื่อมี pool ที่สมาชิกมากจนประมวลผลเกิน TTL (ทางเลือก (ข) แบ่งชุด ≤ 50 ต่อ lock เป็นทางแรกที่ควรพิจารณา)
