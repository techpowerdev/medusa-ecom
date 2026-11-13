# 04 Group buying — ส่วนลดแบบมีเป้าหมายและจำกัดเวลา

สถานะ: draft (ปรับดีไซน์ 2026-10-25 ตามความต้องการของเจ้าของ: ใช้ flow แบบ draft order เหมือนตัวอย่าง Quotes ของ Medusa;
ปรับ membership หลายออเดอร์ต่อคน + exclusivity ตาม ADR-009; 2026-10-25 แก้ความกำกวมที่ GB-2 พบ:
ส่วนลดระดับแคมเปญเก็บใน promotion ต้นแบบตาม ADR-011, สถานะแคมเปญ, error mapping, แบ่ง GB-2 เป็น GB-2a/GB-2b และแบ่ง scope กับ GB-3;
2026-10-26 รอบ 6: แยก GB-6 เป็น GB-6a/6b/6c + route membership ของ admin, nit review #68/#75 — กฎข้อ 14d–17, AC-29..35;
รอบ 7: path `/group-buying/:id`, บั๊ก summary ของ draft order → GB-3c, ข้อจำกัด lock TTL ของ GB-4 — กฎข้อ 18–19, AC-36;
รอบ 8: leave หลังหมดเวลา (กฎข้อ 13), ถ้อยคำ AC-32/AC-36, ปัดยอด 2 ตำแหน่ง (กฎข้อ 20, AC-37), รวม nit เป็น GB-N1;
รอบ 9 2026-10-27: owner ยืนยัน Q11 (ก), แยก GB-6c → 6c1 (#114)/6c2 + nit #114, GB-N2 test flaky;
รอบ 10 2026-10-27: store route อ่าน draft order ของ membership (GB-8, ADR-016 accepted โดย owner 2026-10-27) ที่ PAY-3 ต้องใช้, GB-5 พึ่ง PAY-3a แทน PAY-3, GB-6d nit admin — กฎข้อ 21–23, AC-38..41;
รอบ 12 2026-10-28: follow-up ของ GB-5 #185 → GB-9/GB-10, กฎข้อ 25–26, AC-43..44, คำถาม owner Q13–Q14;
รอบ 13 2026-11-03: follow-up ของ GB-9 #196 รวมเข้า GB-10 (กฎข้อ 25e–f, 26 ท้าย, AC-44 ส่วนรอบ 13), ถ้อยคำกฎข้อ 25(c) ตรงหัวข้อ runbook จริง;
รอบ 14 2026-11-03: builder GB-7 พบว่า route สาธารณะ `GET /store/group-buy/campaigns/active` / `GET /store/group-buy/groups/:token` ใน "API" ยังไม่มีและไม่มี task รับ
→ GB-11 (backend) + แยก GB-7 เป็น GB-7a1 (หน้ากลุ่ม) / GB-7a2 (ที่อยู่ + วิธีส่ง + join ด้วย cart ใหม่) / GB-7b (หน้า account, ◐ #223) / GB-7c (แคมเปญบนหน้าแรก + สร้างทีม)
— กฎข้อ 28–29, กฎข้อ 14c แทนที่ (ไม่ล้าง cart ปัจจุบัน), AC-16 แยก (a)/(b), AC-28 แทนที่, AC-45..48; owner ตอบ Q15–Q19 แล้ว 2026-11-03 (Q19 จาก review #224);
รอบ 15 2026-11-03: **owner ตัดสิน 1 แคมเปญ = 1 สินค้า** หน้ากลุ่มเป็น "ตะกร้าเฉพาะของสินค้านั้น" เลือกได้หลาย variant พร้อมจำนวน → กฎข้อ 30–31, GB-6e (admin picker สินค้าเดียว +
backend validation), GB-11 คืน `product_id` แทน `product_ids`, GB-7a2 หลาย variant (แยก GB-7a2a error map), GB-7c การ์ดสินค้าเดียว — AC-28/33/45/46/48 ปรับ, AC-49..50, คำถาม Q20 (ก–ง);
รอบ 15b 2026-11-03: owner ตอบ Q20 = ตามค่าตั้งต้นทั้งหมด → กฎข้อ 31d เป็นคำตัดสิน, test id ของหน้ากลุ่ม/การ์ดครบตาม re-review #227;
รอบ 15c 2026-11-04: owner ตัดสินคง status 200 ของ `POST /admin/group-buy/campaigns` (ไม่ใช่ 201) ตามที่พบใน review/qa ของ PR #231 → แก้ AC-49;
รอบ 16 2026-11-04: follow-up review/qa ของ GB-6e/GB-7a1/GB-7a2/GB-7b/GB-7c → GB-12 (UI), GB-13 (idempotency ของการสร้างแคมเปญ ← Q21), GB-N4 (test hygiene), test id ในหัวข้อ Storefront ตรงโค้ด — กฎข้อ 32–34, AC-51..53, คำถาม Q21;
รอบ 16b 2026-11-04: owner ตัดสิน Q21 = (ก) (กฎข้อ 33 เป็นกฎปกติ, กฎข้อ 17 ปรับ, Q10 ส่วน idempotent ถูกแทน) และ spec 01 Q-C4 = (ข) → GB-14 ตรวจ shipping profile ตอน join — กฎข้อ 35, AC-54, คำถาม Q22;
รอบ 17 2026-11-04: owner ตัดสิน Q22 = (ก) (กฎข้อ 35c เป็นกฎปกติ), หน้า orders เมื่อโหลด group orders ล้มไม่แสดง empty state (กฎข้อ 32e1, AC-51 — ใน GB-12 #244), แก้ breakpoint ของกฎข้อ 32d,
follow-up review #247/#246 → GB-N5 (test/cleanup) — กฎข้อ 36, AC-55;
รอบ 18 2026-11-04: แก้ถ้อยคำกฎข้อ 36b/AC-55 ตาม core-flows 2.22.1 จริง (ลบเฉพาะ method ที่ profile ชน + ทิ้ง method ของ profile ที่ไม่มี item ใช้ตอน refresh),
AC-52 ใช้ e2e admin ดัก network ด้วย `page.route` แทน component test, follow-up qa/review #259 → GB-N6 — กฎข้อ 37, AC-56;
รอบ 19 2026-11-04: GB-13 ☑ #259, GB-N6 ☑ #269 (ข้อ (a) ปิดโดย #259), nit review #269 → GB-N7 (comment ของ assertion) — กฎข้อ 38, AC-57;
รอบ 20 2026-11-04: GB-N7 ☑ #274, owner เลือกทาง (ก) ให้ key ของฟอร์มสร้างแคมเปญใช้ `crypto.getRandomValues` (admin ที่เปิดผ่าน http เปิดฟอร์มไม่ได้เพราะ `crypto.randomUUID()`
มีเฉพาะ secure context) → GB-15 — กฎข้อ 33d แก้, AC-58;
รอบ 21 2026-11-04: GB-15 ☑ #285, qa #285 O-1 (cookie `Secure` ของ admin บน prod) → หมายเหตุ spec 07 Deliverables ข้อ 11 ไม่มี task)
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
| refund payment ของ draft/order ที่ยกเลิก | `POST /admin/payments/:id/refund` (`refundPaymentWorkflow` ไม่ปฏิเสธ draft/order ยกเลิก — re-review #185) | ใช้ตามเดิมใน runbook (กฎข้อ 25) — ไม่ refund อัตโนมัติ (owner Q13 = ก) |
| (รอบ 14) ผู้เยี่ยมชมดูแคมเปญ/กลุ่มที่เปิดอยู่ (ไม่ login) | **ไม่มี** — Store API ไม่มี route ของ promotion/campaign (`/store/promotions*` ไม่มีใน 2.22.1; code `GBT-*`/`GB-*` ต้องไม่รั่ว) และข้อมูลกลุ่มอยู่ใน module ของเรา | custom route อ่านอย่างเดียว 2 ตัว (GB-11, กฎข้อ 28) อ่านผ่าน `query.graph` + link เดิม; ไม่เพิ่ม link/model |
| (รอบ 14) ข้อมูลสินค้า/ราคาในขอบเขตแคมเปญบน storefront | `GET /store/products?id[]=...` ของ Medusa (ราคาตาม region, publishable key) | ใช้ตามเดิม — GB-11 คืนแค่ `product_id` (รอบ 15: สินค้าเดียวต่อแคมเปญ, กฎข้อ 30) ไม่คืนข้อมูลสินค้าซ้ำ |
| (รอบ 14, Q19) ที่อยู่/วิธีส่งของ cart ใหม่ที่ใช้ join | ที่อยู่ที่ลูกค้าบันทึก (`customer.addresses`), `POST /store/carts/:id` (ที่อยู่), `GET /store/shipping-options?cart_id=`, `POST /store/carts/:id/shipping-methods`; `createGroupDraftOrderStep` คัดลอกที่อยู่/วิธีส่งจาก cart ลง draft order อยู่แล้ว | ใช้ตามเดิมผ่าน data function ของ starter (`retrieveCustomer`, `listCartShippingMethods`, `setShippingMethod`) — ไม่มี backend เพิ่ม (กฎข้อ 29c) |
| exclusivity ของ promotion | ไม่มี native (ตรวจ 2.22.1); มี hook `validate` / `setPromotionContext` บน `updateCartPromotionsWorkflow` | ขยาย — ทำครั้งเดียวใน PROMO-1 (ADR-009) |
| (รอบ 16) กันสร้างแคมเปญซ้ำเมื่อยิงซ้ำ/พร้อมกัน | admin API ของ Medusa ไม่มี idempotency key; Medusa campaign มี `campaign_identifier` ที่ผู้สร้างกำหนดได้ + Locking module (`acquireLockStep`/`releaseLockStep`) | ขยาย — key ของผู้เรียกใส่ใน `campaign_identifier` + lock ต่อ key (กฎข้อ 33, Q21 = ก owner 2026-11-04) ไม่เพิ่ม model/infra |
| (รอบ 16b, Q-C4 = ข) วิธีส่งของ cart ที่ join ต้องครอบ shipping profile ของสินค้า | `validateShippingStep` (`@medusajs/medusa/core-flows`, id `validate-shipping`, `core-flows/src/cart/steps/validate-shipping.ts` 2.22.1) ที่ `completeCartWorkflow` เรียกด้วย cart (`completeCartFields` มี `items.variant.product.shipping_profile.id`) + `shipping_option` ที่ query ด้วย `useQueryGraphStep({ entity: "shipping_option", fields: ["id", "shipping_profile_id"], filters: { id: <shipping_option_id ของ shipping_methods> } })` — join ไม่ผ่าน complete cart จึงไม่ถูกตรวจ | ขยาย — **ไม่เรียก step นี้ตรง** เพราะ (1) throw `INVALID_DATA` ข้อความทั่วไปไม่มี code (storefront แยกจาก 400 อื่นไม่ได้ — ต้องมี `GB_*` ตามที่ owner สั่ง) และ (2) ล้มเมื่อไม่มี shipping method เลย ซึ่งขัดกับข้อยกเว้นกฎข้อ 35c; ใช้ **field/query ชุดเดียวกับ Medusa** และกฎเทียบ profile แบบเดียวกันใน helper pure (กฎข้อ 35) |
| (รอบ 16) นับถอยหลัง / ราคา variant บนหน้า | `countdownLabel` (`lib/util/flash-sale.ts` เดิม), `calculated_price` ของ variant จาก `GET /store/products` (region) ที่หน้าโหลดอยู่แล้ว | ใช้ตามเดิม (กฎข้อ 32) — ไม่ยิง API เพิ่ม |

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

## API (store route ที่เขียนข้อมูลและ route `/store/customers/me/*` ต้อง auth ด้วย customer; ยกเว้น `GET` สาธารณะ 2 ตัวของ GB-11 — การดูเท่านั้น, CLAUDE.md ข้อ 5, กฎข้อ 28)
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
  (ความคืบหน้า, deadline, จำนวนสมาชิก — **GB-11** รอบ 14, รูปแบบด้านล่าง), `POST /store/group-buy/groups` `{campaign_id, name?}` (team, GB-3;
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
- (รอบ 14, GB-11, กฎข้อ 28) Store อ่านอย่างเดียว **สาธารณะ** (ไม่มี `authenticate`; ต้องมี publishable key ตามปกติของ `/store/*`; ไม่รับ query param — field กำหนดใน route แบบ GB-8):
  - `GET /store/group-buy/campaigns/active` → 200 `{ campaigns: [Campaign & { pool_groups: [Group] }] }` (ไม่แบ่งหน้า; สูงสุด 50 เรียง `ends_at` น้อยไปมาก)
  - `GET /store/group-buy/groups/:token` → 200 `{ group: Group & { kind }, campaign: Campaign }` (กลุ่มทุกสถานะ); token ไม่มีจริง → 404 `not_found`
  - `Campaign` = `{ id, name, starts_at, ends_at, target_type, target_value, group_mode, max_people_per_group, max_units_per_person, team_duration_hours, pay_within_hours,
    discount: { type, value, currency_code }, product_id: string | null }` (`starts_at`/`ends_at` จาก Medusa campaign; `discount`/`product_id` ตามกฎข้อ 28e — รอบ 15 แทน `product_ids: string[]`)
  - `Group` = `{ id, name, join_token, status, starts_at, ends_at, progress_orders, progress_units, progress_people }` (`progress_people` = จำนวนสมาชิกที่แสดงบนหน้า)
  - ห้ามมี key อื่นนอกจากรายการนี้ (allow-list ประกอบทีละ field ไม่ spread entity — AC-45/46 ตรวจชุด key ตรงตัว)

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
  - (รอบ 14, owner Q15–Q19) แบ่ง task: **GB-7a1** = หน้ากลุ่ม `/<cc>/g/<token>` อ่านอย่างเดียว + `group-share-link` (กฎข้อ 29b); **GB-7a2** = เลือก variant/ที่อยู่/วิธีส่ง +
    join ด้วย cart ใหม่ + error map (กฎข้อ 29c–f; test id `group-address-select`, `group-add-address-link`, `group-shipping-option`); **GB-7c** = ส่วนแคมเปญบนหน้าแรก `/<cc>`
    (flash + group buy) + สร้างทีม (กฎข้อ 29a, 29g); **GB-7b** = รายการในหน้า account (GB-8) + ปุ่มออกจากกลุ่ม + ลิงก์ไปหน้าชำระเงินของ PAY-3b; ไม่มีหน้า `/group-buy` แยก
    — test id เพิ่ม: `home-campaigns`, `flash-campaign-card`, `group-campaign-card`, `group-pool-link`, `group-progress`, `group-countdown`, `group-member-count`, `group-options` (รอบ 16: แทน `group-variant-select` ที่ไม่มีในโค้ด — wrapper ของ `OptionSelect` ตามกฎข้อ 31a),
    `group-quantity`, `group-share-link`, `group-join-error`, (รอบ 15) `group-selection`, `group-add-variant`, `group-units-limit`, `group-create-team-error`,
    `group-campaign-thumbnail`, `group-campaign-price`, `group-campaign-progress`;
    (รอบ 16 — ตรงกับโค้ดของ GB-7a1/GB-7a2 บน develop) `group-status` (มี `data-status`), `group-share-copy`, `group-share-copy-status`, `group-shipping-load`, `group-join`, `group-product`, `group-discount`,
    `group-selection-item`, `group-selection-quantity`, `group-selection-remove`, `group-campaign-countdown`; (GB-12) `group-selection-title`, `group-selection-price`

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
   หมดเวลาชำระเงิน — (รอบ 12, owner ตัดสิน Q14 = (ก) 2026-10-28) "ได้รับการชำระเงินแล้ว" ใน v1 **คืออีเมล `order-placed`** ที่ Medusa ส่งเมื่อ draft order ถูกแปลงหลัง capture
   (GB-5 #185) — ไม่มี template แยก
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
    | (รอบ 16b, GB-14) cart มี shipping method แต่ไม่ครอบ shipping profile ของ line ที่ `requires_shipping = true` (กฎข้อ 35) | 400 `not_allowed` code `GB_SHIPPING_PROFILE_NOT_COVERED` (ไม่อยู่ใน allow-list ของ 409) |
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
    (c) ~~storefront ล้าง cart (cookie `_medusa_cart_id`) หลัง join สำเร็จ~~ — **แทนที่รอบ 14 (owner Q16, 2026-11-03)**: storefront join ด้วย **cart ใหม่ที่สร้างเฉพาะ
    สินค้าของแคมเปญ** (กฎข้อ 29c) cart ปัจจุบันของลูกค้า (`_medusa_cart_id`) ไม่ถูกแตะและไม่ถูกล้าง; cart ใหม่ที่มี `GB-*` ไม่ถูกตั้งเป็น cart ปัจจุบัน — ทำใน GB-7a2
    (d) (review #68, ยอมรับตามการออกแบบ) ถ้าลูกค้าเอา `GB-<token>` ออกจาก cart เดิมเอง (`DELETE /store/carts/:id/promotions`) cart นั้นไม่มี `GB-*` แล้ว
    จึง join ใหม่ได้ตามปกติ (ได้ membership/draft order ใหม่ ข้อจำกัดของกฎข้อ 4 ยังคุม) — ไม่ใช่ช่องโหว่ GB-7 ไม่ต้องกันกรณีนี้ แต่ต้องไม่พึ่ง "cart เดิม join ไม่ได้"
    เป็นเงื่อนไขของ UI
15. (GB-6b, review #75) ในฟอร์มสร้างแคมเปญ ถ้ากรอกทั้ง `application_method.max_quantity` และ `max_units_per_person` ต้อง `max_quantity ≥ max_units_per_person`
    (ไม่เช่นนั้นสมาชิกจะ join ด้วยจำนวนชิ้นที่ส่วนลดไม่ครอบ) — ฟอร์มแสดง hint ข้างช่องเสมอ และแสดง error `gb-max-quantity-error` + ไม่ส่ง request เมื่อผิด;
    บังคับเฉพาะในฟอร์ม (ต้นแบบแก้ภายหลังได้ที่หน้า promotion ของ Medusa จึงบังคับฝั่ง backend ตอนสร้างได้ไม่ครบ — owner ตัดสิน Q10 2026-10-26: ไม่ทำ backend validator)
16. (GB-6b, qa #75) ฟอร์มสร้างแคมเปญที่ `ends_at <= now` แสดงคำเตือน `gb-ends-at-warning` (ยังส่งได้ เพราะแคมเปญเป็น `draft` และ `draft → active`
    ถูกปฏิเสธโดย backend อยู่แล้วเมื่อ `ends_at <= now`)
17. (GB-6b, review #75; ปรับรอบ 16b ตาม Q21 = ก) ทุกปุ่มที่สร้างข้อมูลในหน้า Group buying (สร้างแคมเปญ, สร้าง pool group,
    succeed/fail) กันกดซ้ำด้วย in-flight flag (`useRef`) + `disabled` ระหว่างส่ง (แบบเดียวกับ FS-10, spec 03 กฎข้อ 15) — succeed/fail idempotent ฝั่ง
    backend อยู่แล้ว (กฎข้อ 8); `POST /admin/group-buy/campaigns` idempotent ด้วย `idempotency_key` ตามกฎข้อ 33 (GB-13 — ฟอร์มส่ง key เสมอ; ผู้เรียกที่ไม่ส่ง key
    ได้พฤติกรรมเดิม แคมเปญที่ซ้ำเป็น `draft` ลบได้); การกันกดซ้ำฝั่ง UI ยังคงไว้
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
    (membership เดียวเจอทั้งสองเหตุได้ 2 ฉบับ); (c) runbook หัวข้อ "group buy: เงินเข้าแต่ไม่มี order" (alert `GROUP_BUY_PAID_WITHOUT_ORDER`) ใน `docs/ops/production.md`
    (แก้ถ้อยคำรอบ 13 ให้ตรงหัวข้อที่มีจริง — review #196) ขึ้นต้นด้วยขั้น "ตรวจว่า order
    ยังเป็น draft และ membership ยังไม่ `paid` — ถ้าไม่ใช่ ถือว่า alert ผิด ปิด incident ห้าม refund" และเปิด draft order ด้วย URL `/app/orders/<order_id>` (draft ไม่อยู่ในรายการ Orders);
    (d) test ที่ตั้ง `OPS_ALERT_EMAIL` คืนค่าเดิมใน `afterAll`;
    (e) (รอบ 13, review #196 — ส่งมอบใน GB-10) การอ่านสถานะใหม่ของ (a) ล้ม (เช่น `query.graph` throw) → **fail-open: ส่ง alert ต่อ** พร้อม log warn (ยอมให้ alert ซ้ำ/ผิดได้ดีกว่าเงินค้างเงียบ —
    ops มีขั้นตรวจของ (c) อยู่แล้ว); `loadMembership` ที่ subscriber เรียกต้องอยู่ใน `try` เดียวกับการตัดสิน ไม่ใช่ก่อน `try`;
    (f) test ของ runbook (`src/__tests__/ops-runbook.unit.spec.ts`) ตัดเนื้อหาหัวข้อของ (c) จากหัวข้อนั้นถึงหัวข้อระดับเดียวกันถัดไป (ไม่ใช่ถึงท้ายไฟล์) เพื่อให้ขั้นที่ตรวจอยู่ในหัวข้อนั้นจริง
26. (รอบ 12, GB-10 — review #185) ops แปลง draft order ของ membership `awaiting_payment` เอง (ปุ่ม Convert ของ `@medusajs/draft-order` หรือ `POST /admin/draft-orders/:id/convert-to-order`
    ตาม runbook ของกฎข้อ 25) → membership ต้องเป็น `paid`: subscriber ของ event ที่ `convertDraftOrderWorkflow` emit (`order.placed` — builder ยืนยันใน 2.22.1; ต่างจากนี้ให้ใช้ event
    ที่ emit จริงและบันทึกใน PR) สำหรับ order ที่มี `metadata.group_buy_membership_id` → workflow ใต้ lock ต่อ membership ตัวเดียวกับ GB-5: membership `awaiting_payment` + order
    `is_draft_order = false` + payment collection `completed` → `paid`; สถานะอื่น (รวม `paid` อยู่แล้วจากเส้นทางปกติของ GB-5) → noop + log info; ไม่ส่งอีเมลเพิ่ม
    (อีเมล `order-placed` ของการแปลงส่งแล้ว); ไม่แปลง/ไม่ refund อะไรเอง — (owner Q13 = (ก) 2026-10-28: เงินค้างจัดการแบบ manual ด้วย alert + runbook + GB-10 ใน v1);
    (รอบ 13) `loadMembership` ที่ GB-9 (#196) วางไว้ในไฟล์ workflow `membership-payment.ts` — ถ้า GB-10 ใช้ด้วย ย้ายไปเป็น helper เดียวที่ทั้งสองไฟล์ import (ไม่ copy)
27. (รอบ 12, owner Q19 = (ข) 2026-10-28 — ส่งมอบใน AF-16 ของ spec 05) order ของ group buy ได้ค่าคอม affiliate: `joinGroupWorkflow` ขั้น 3 คัดลอก `cart.metadata.affiliate_token`
    (ถ้ามี) ลง `metadata.affiliate_token` ของ draft order พร้อม key เดิม; storefront (GB-7 — รอบ 14: GB-7a2) sync cookie `aff` ลง cart ก่อนเรียก join แบบเดียวกับก่อน `placeOrder` (spec 05 กฎ 23) —
    ค่าคอมเกิดเมื่อ draft ถูกแปลงเป็น order ปกติเท่านั้น (spec 05 กฎ 41)
28. (รอบ 14, GB-11) route สาธารณะ 2 ตัวใน "API" รอบ 14:
    (a) `GET` เท่านั้น ไม่มี `authenticate` (CLAUDE.md ข้อ 5 ยกเว้นการดู) ไม่เรียก workflow ไม่เขียนข้อมูล; route `POST` เดิมใต้ `/store/group-buy/*` ยัง 401 เมื่อไม่ login (AC-15)
    (b) **ไม่คืน PII หรือข้อมูล order** (ADR-016 ทางเลือก D): ห้ามมี `customer_id`, `created_by_customer_id`, อีเมล/ชื่อลูกค้า, membership, `order_id`/ยอดของสมาชิก, `pay_deadline_at`
      (สมาชิกอ่านผ่าน GB-8) และห้ามมี id/code ของ promotion (`GBT-*` ต้นแบบ — Q7; `GB-<token>`) — response ประกอบจาก allow-list ใน "API" รอบ 14 เท่านั้น;
      (review #224) `join_token` ของ pool เปิดสาธารณะทำให้ใครก็เดา code `GB-<token>` ได้ — ยอมรับได้เพราะ cart ที่มี `GB-*` complete ไม่ได้ทุกกรณี (กฎข้อ 14a) ราคาลดได้ผ่าน `joinGroupWorkflow`
      เท่านั้น ซึ่งบังคับ login + ข้อจำกัดของกฎข้อ 4; การไม่คืน code จึงเป็นการลดข้อมูลเกินจำเป็น ไม่ใช่ด่านความปลอดภัย
    (c) แคมเปญ "active" = `status = active` **และ** อยู่ในช่วงเวลาของ Medusa campaign (`starts_at` null หรือ `<= now`, `now < ends_at`) — เงื่อนไขเดียวกับที่ join ยอมรับ (กฎข้อ 10)
      จึงไม่แสดงแคมเปญที่ job (GB-4) ยังไม่ตั้ง `ended` แต่หมดเวลาแล้ว
    (d) `pool_groups` = กลุ่ม `kind = pool`, `status = open`, `ends_at > now` ของแคมเปญนั้น พร้อม `join_token` (pool เปิดให้ทุกคน); **ไม่ list team** — token ของ team
      ได้จากลิงก์แชร์ของผู้สร้างเท่านั้น (route รายตัวด้วย token ยังเปิด team ได้)
    (e) `discount = { type, value, currency_code }` และ `product_id` อ่านจาก `application_method` ของ promotion: รายการแคมเปญ (`campaigns/active` — การ์ดบนหน้าแรก) ใช้ **ต้นแบบ** (ADR-011); หน้ากลุ่มใช้ **promotion
      ของกลุ่ม** (ส่วนลดที่สมาชิกได้จริง — ต้นแบบที่แก้ภายหลังไม่กระทบกลุ่มเดิม, Q5); (รอบ 15, กฎข้อ 30) `product_id` = ค่าเดียวใน `values` ของ `target_rules` ที่ `attribute = "items.product.id"` และ
      `operator = "in"`; ไม่มี rule แบบนี้ หรือมีมากกว่า 1 ค่า (ข้อมูลก่อนกฎข้อ 30) → `null` (หน้าไม่แสดงตัวเลือกสินค้า/ปุ่ม join) และ `campaigns/active` **ไม่คืน**แคมเปญนั้น; `currency_code` null เมื่อเป็น `percentage`
    (f) อ่านด้วย `query.graph` ครั้งเดียวต่อ request (รวม relation ที่ต้องใช้ ไม่ยิงต่อแถว) ผ่าน link เดิม (`group_buy_campaign ↔ promotion_campaign`, template, `group ↔ promotion`)
      — ไม่เพิ่ม link/model/index; แคมเปญ active พร้อมกันมีน้อย (≤ 50) จึงกรองช่วงเวลา/กลุ่มใน route ได้
29. (รอบ 14, owner ตอบ Q15–Q19 2026-11-03) storefront ของ group buy:
    (a) **ไม่มีหน้า `/group-buy` แยก** (Q15): แคมเปญ group buy ที่ active (`GET /store/group-buy/campaigns/active`) แสดงบน**หน้าแรก `/<cc>`** คู่กับแคมเปญ flash sale ที่ active —
      หน้าแรกปัจจุบัน (`app/[countryCode]/(main)/page.tsx`) มีแค่ Hero + rail สินค้า (ราคา flash บนการ์ดตาม spec 03 กฎข้อ 19) **ยังไม่มีส่วนแสดงแคมเปญ** จึงเพิ่มส่วน `home-campaigns`
      ที่มีการ์ด `flash-campaign-card` (ชื่อ/`banner_text`/นับถอยหลังจาก `GET /store/flash-sales/active` ของ FS-4 แบบไม่ส่ง `variant_ids` — reviewer #224 ยืนยันว่าได้แคมเปญครบ
      แต่ `getActiveFlashSales` ใน `lib/data/flash-sales.ts` คืน `null` เมื่อ `variantIds` ว่าง จึง**เพิ่มฟังก์ชันใหม่** (เช่น `listActiveFlashCampaigns()`) ในไฟล์เดิมที่เรียก route นี้โดยไม่มี query —
      ไม่แก้พฤติกรรมของ `getActiveFlashSales` และไม่สร้าง route ใหม่ฝั่ง flash) และ `group-campaign-card` (ชื่อ, ส่วนลด, นับถอยหลัง `ends_at`, ลิงก์ pool `group-pool-link` → `/<cc>/g/<token>`,
      ปุ่ม `group-create-team-button` เมื่อ `group_mode ∈ {team, both}`); ส่วนนี้ใช้ cache ของหน้าแรกเดิม (`force-static` + `revalidate = 60`, ADR-017 — ข้อมูลใหม่ภายใน ≤ 90 วินาที เหมือน spec 03
      กฎข้อ 22) **รวม `sold_out`/`remaining_units` ของการ์ด flash และ `progress_*` ของ pool ที่อาจค้าง ~90 วินาที — ยอมรับตาม ADR-017** (เป็นข้อมูลแสดงผล; โควตา flash บังคับตอน complete cart
      ตาม spec 03 และข้อจำกัดของกลุ่มบังคับใน `joinGroupWorkflow` ส่วนหน้ากลุ่มอ่านสด — กฎข้อ 29b) ไม่อ่านสดฝั่ง client; ไม่มีแคมเปญเลย → ไม่แสดงส่วนนี้ (GB-7c)
    (b) หน้ากลุ่ม `/<cc>/g/<token>` (ลิงก์แชร์ `/g/<token>` ถูก middleware เติม country อยู่แล้ว) อ่าน GB-11 แบบ `cache: "no-store"` — ความคืบหน้าตรง DB ทุกครั้งที่โหลดหน้า; แสดงสินค้า
      `product_id` ผ่าน `listProducts` เดิม (`GET /store/products` ของ Medusa) — (รอบ 15) เลือก**หลาย variant พร้อมจำนวน**ตามกฎข้อ 31; `product_id = null` → ไม่มีตัวเลือกสินค้าและไม่มีปุ่ม join
      (กฎข้อ 30 บังคับสินค้าเดียวตั้งแต่สร้าง/activate) (GB-7a1 — หน้าอ่านอย่างเดียว ยังไม่มีปุ่ม join)
    (c) **join ด้วย cart ใหม่ต่อการ join** (Q16) + **ที่อยู่และวิธีส่งก่อน join** (Q19, owner 2026-11-03 — review #224: cart ที่สร้างใหม่ไม่มี `shipping_address`/`shipping_methods`
      เพราะ Medusa 2.22.1 ไม่เติมที่อยู่ default และ `createGroupDraftOrderStep` คัดลอกที่อยู่/วิธีส่งจาก cart ตรงๆ → draft order ไม่มีที่อยู่ ยอดไม่รวมค่าส่ง และ fulfill ไม่ได้หลังแปลง — ขัด ADR-004)
      สองขั้นบนหน้ากลุ่ม (GB-7a2):
      (c1) ลูกค้าเลือก variant/จำนวน (รอบ 15: หลายรายการตามกฎข้อ 31) + **ที่อยู่ที่บันทึกไว้** (`customer.addresses` จาก `retrieveCustomer` เดิม, `group-address-select`; ไม่มีที่อยู่ → `group-join-button` disabled +
        ลิงก์ `group-add-address-link` ไปหน้าที่อยู่ใน account ของ starter) → server action สร้าง cart ใหม่ผ่าน `createCartWithItems` ใน `lib/util/server-cart.ts` (export ร่วมกับ `/buy/[items]`;
        **ไม่**เรียก `activateCart`/`setCartId`) แล้ว `sdk.store.cart.update(cart_id, { shipping_address, billing_address: <ที่อยู่เดียวกัน>, email: <อีเมลลูกค้าถ้า cart ยังไม่มี> })`
        → คืน `cart_id` + วิธีส่งจาก `listCartShippingMethods(cart_id)` ใน `lib/data/fulfillment.ts` (รับ cart id — **ไม่ใช้** `listCartOptions` เพราะอ่าน cart จาก cookie); option แบบ `calculated`
        ใช้ `calculatePriceForShippingOption` เดิมแบบหน้า checkout; ไม่มีวิธีส่งสำหรับที่อยู่นั้น → ข้อความไทยใน `group-join-error` และไม่มีปุ่ม join
      (c2) ลูกค้าเลือกวิธีส่ง (`group-shipping-option`) → server action `setShippingMethod({ cartId, shippingMethodId })` เดิม (`sdk.store.cart.addShippingMethod`) → sync cookie `aff` ลง cart
        ใหม่ (กฎข้อ 27) → `POST .../join { cart_id }`; เปลี่ยนที่อยู่ระหว่างทาง → เริ่ม (c1) ใหม่ด้วย cart ใหม่ (ไม่แก้ cart เดิมซ้ำ)
      cart ปัจจุบัน (`_medusa_cart_id`) ไม่ถูกอ่าน/แก้/ล้าง (กฎข้อ 14c); ownership: Medusa ตั้ง `customer_id` ของ cart ที่สร้างด้วย token ลูกค้า + CORE-6/CORE-12 บังคับ login → **ไม่ต้องมี backend เพิ่ม**
      (`createGroupDraftOrderStep` คัดลอก `shipping_address`/`billing_address`/`shipping_methods` อยู่แล้ว; AC-28 พิสูจน์); cart ที่ (c1) สร้างแต่ไม่ได้ join หรือ join ล้ม ถูกทิ้งไว้ (ไม่อยู่ใน cookie;
      ถ้ามี `GB-*` complete ไม่ได้ตามกฎข้อ 14a) — ยอมรับใน v1
    (d) sync `aff` ก่อน join บังคับด้วย static test ของ spec 05 กฎ 31 ที่ขยายให้ครอบไฟล์ของ GB-7a2 (ฟังก์ชันที่เรียก join ต้องเรียก `syncAffiliateBefore(` ก่อนในฟังก์ชันเดียวกัน)
    (e) ยังไม่ login แล้วกด join/สร้างทีม → ไปหน้า login (กฎข้อ 3) ไม่ยิง `POST`; ไม่แสดงปุ่ม join เมื่อกลุ่มไม่ `open` หรือ `ends_at <= now`; `group-join-button` กันกดซ้ำ
      (disable ระหว่างส่ง + in-flight flag — กดซ้ำต้องไม่สร้าง cart/membership ที่สอง); join สำเร็จ → พาไปหน้า account ที่ GB-7b
      แสดงรายการ draft order ของกลุ่ม (path ตามที่ GB-7b ส่งมอบ)
    (f) **error ของ join** (Q17 = ก): map code → ข้อความไทยใน helper เดียว แสดงที่ `group-join-error` — `GB_ALREADY_IN_OTHER_GROUP` "คุณอยู่ในกลุ่มอื่นของแคมเปญนี้แล้ว", `GB_GROUP_FULL`
      "กลุ่มนี้เต็มแล้ว", `GB_MAX_TOTAL_ORDERS_REACHED` "แคมเปญนี้ครบจำนวนออเดอร์แล้ว", `GB_UNITS_LIMIT_EXCEEDED` "เกินจำนวนชิ้นสูงสุดต่อคน (<max_units_per_person> ชิ้น)",
      `GB_ITEMS_NOT_ELIGIBLE` "สินค้านี้ไม่ร่วมแคมเปญ", `PROMOTION_NOT_COMBINABLE` "ใช้ร่วมกับโค้ดส่วนลดอื่นไม่ได้", `GB_CART_ALREADY_JOINED` "รายการนี้เข้าร่วมกลุ่มแล้ว", 400 `not_allowed`
      "กลุ่มหรือแคมเปญนี้ปิดรับแล้ว", code อื่น/5xx "เข้าร่วมไม่สำเร็จ กรุณาลองใหม่" (ถ้อยคำปรับได้ใน PR แต่ต้องต่างกันทุก code) — ใช้รูปแบบ `{ ok } | { error }` ของ CORE-4i ถ้า merge แล้ว
    (g) **สร้างทีม** (Q18 = ก): `POST /store/group-buy/groups` อย่างเดียว (ไม่ join อัตโนมัติ) แล้วพาไป `/<cc>/g/<token>` ของทีมใหม่ที่มี `group-share-link` (ลิงก์ `/g/<token>` + ปุ่มคัดลอก)
      และผู้สร้าง join เองด้วย `group-join-button` เหมือนคนอื่น; กันกดซ้ำ (disable ระหว่างส่ง + in-flight flag แบบกฎข้อ 17) เพราะ route สร้างทีมไม่ idempotent (GB-7c)

30. (รอบ 15, **owner ตัดสิน 2026-11-03**) **1 แคมเปญ group buy = 1 สินค้า**: promotion ต้นแบบต้องมี `target_rules` ที่ `attribute = "items.product.id"`, `operator = "in"` และ `values` **ค่าเดียว**
    (variant ใดก็ได้ของสินค้านั้นร่วมแคมเปญ) — **ห้าม scope ระดับ variant** (`items.variant_id`) หรือ attribute อื่นของ `items` (review #227: `scripts/seed-load.ts` เดิมใช้ `items.variant_id` → แปลงเป็น
    `items.product.id` ของสินค้าที่ variant นั้นอยู่ใน GB-6e); rule อื่นนอก `items.*` ใน `rules` ของ promotion ไม่อยู่ในกฎนี้ — บังคับที่:
    (a) zod validator ของ `POST /admin/group-buy/campaigns` (`application_method.target_rules`): ไม่มี rule นี้, `values` ว่าง หรือ > 1 ค่า → 400 `invalid_data` ข้อความระบุ code `GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED`
      และ `createGroupBuyCampaignWorkflow` ตรวจซ้ำก่อนขั้น 1 (ผู้เรียก workflow ตรงไม่ผ่าน validator) → `MedusaError INVALID_DATA` code เดียวกัน ไม่สร้าง Medusa campaign/promotion;
    (b) scope ไม่ได้แก้ผ่าน route ของเรา (`updateGroupBuyCampaignWorkflow` แก้ได้แค่คอนฟิก — ส่วนลด/scope แก้ที่หน้า promotion ของ Medusa ตาม ADR-011) จึงตรวจ**ตอน `draft → active`**
      ใน `setGroupBuyCampaignStatusWorkflow` (ต้นแบบที่ถูกแก้เป็นหลายสินค้า/ไม่มี scope ระหว่าง `draft` → 400 `NOT_ALLOWED` code `GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED`) และ**ตอนสร้างกลุ่ม** ใน
      `createGroupWorkflow` ขั้น 2 (ต้นแบบถูกแก้ระหว่าง `active` → 400 code เดียวกัน ไม่ clone) — กลุ่มเดิมไม่กระทบ (Q5); **ข้อยอมรับ (review #227)**: admin แก้ promotion ของกลุ่ม `GB-<token>` เองที่หน้า Medusa ให้มีสินค้าที่ 2 ได้ → `validateJoinStep` ยอม join สินค้าที่ 2 ผ่าน API
      (target_rules ของกลุ่มยอมรับ) แต่หน้ากลุ่มได้ `product_id = null` จึงไม่มีปุ่ม join — **ไม่กันที่ join** เพราะขัดกฎข้อ 30c (กลุ่มเดิมต้อง join ได้ตามเดิม); ผลข้างเคียง: ถ้าต้นแบบถูกแก้หลัง `active`
      ให้ไม่ผ่านกฎ GB-11 ซ่อน**ทั้งแคมเปญ**จาก `campaigns/active` (รวม pool ที่ยัง join ได้) → ลิงก์หายจากหน้าแรก แต่ URL `/g/<token>` ของกลุ่มเดิมยังใช้ได้ (หน้ากลุ่มอ่าน promotion ของกลุ่ม) —
      แก้ได้โดยแก้ต้นแบบกลับเป็นสินค้าเดียว;
    (c) ข้อมูลเดิมก่อนกฎนี้ (dev/staging) ไม่ backfill — GB-11 ไม่แสดงแคมเปญที่ไม่ผ่าน (กฎข้อ 28e); join ของกลุ่มเดิมยังทำงานตามเดิม (`GB_ITEMS_NOT_ELIGIBLE` คุมสินค้า)
    (d) admin picker (GB-6e) เลือกได้ 1 สินค้า — ส่วน "หลายสินค้า" ของ GB-6b/AC-33 ถูกแทนที่
31. (รอบ 15, owner) **หน้ากลุ่ม = ตะกร้าเฉพาะของสินค้านั้น** (GB-7a2): (a) ลูกค้าเลือก option ด้วย component `OptionSelect` เดิมของ PDP (`modules/products/components/product-actions/option-select.tsx`
      — import ใช้ร่วม ไม่ copy; ตรรกะหา variant จาก option ถ้าใช้ร่วมได้ให้ย้ายเป็น helper ที่ PDP และหน้ากลุ่ม import — ผู้ใช้ 2 ที่ตาม CLAUDE.md ข้อ 3) + จำนวน แล้วกด "เพิ่มในรายการ" (`group-add-variant`)
      (review #227: `id` ของ input ใน `OptionSelect` มาจาก prop `name` — ส่ง `name` ที่ไม่ซ้ำกับส่วนอื่นของหน้า; testid `option-button` ตายตัว → e2e หาภายใต้ wrapper ของหน้ากลุ่ม;
      ย้าย `optionsAsKeymap` + การหา variant จาก option ออกจาก `product-actions/index.tsx` เป็น helper ใน `lib/util/` ~30 LOC ให้ PDP และหน้ากลุ่ม import)
      → รายการ `group-selection` ในหน้า (variant เดิมซ้ำ = รวมจำนวน, แก้จำนวน/ลบรายการได้ก่อนยืนยัน); (b) ยืนยัน → cart ใหม่ **หลาย line** ตามรายการ (กฎข้อ 29c) แล้ว join ครั้งเดียว = 1 membership/1 draft order
      ที่มีทุก variant, `units` = ผลรวมจำนวน (backend เดิม `cartUnits` รวมทุก line); (c) ผลรวมเกิน `max_units_per_person` → ปุ่ม join disabled + `group-units-limit` (ตรวจฝั่ง client จากค่าในหน้า —
      ด่านจริงคือ backend กฎข้อ 4 ที่นับรวม membership เดิมด้วย); (d) **คำตัดสินของ owner (Q20, 2026-11-03)**: รายการเป็น state ในหน้า ไม่จำข้ามการออกจากหน้า (Q20ก), หลัง join แก้รายการไม่ได้ —
      leave แล้ว join ใหม่ (Q20ข), `max_units_per_person` นับรวมทุก variant (Q20ค), คงเป้า orders/units/people ทั้งสามแบบ (Q20ง)
32. (รอบ 16, GB-12 — review/qa 2026-11-04 ของ GB-7a1/7a2/7b/7c) UI ของ group buy บน storefront:
    (a) นับถอยหลังของการ์ดหน้าแรก (`CampaignCountdown`) และหน้ากลุ่ม (`GroupCountdown`) เป็น component เดียว `modules/common/components/countdown` (props: `endsAt`, `now`, `testId`, `expiredLabel`,
      `className`) — คง test id เดิม (`group-campaign-countdown`, `group-countdown`) และข้อความหมดเวลาเดิมของแต่ละที่ ("หมดเวลาแล้ว" / "หมดเวลารวมกลุ่มแล้ว"); ลบสองไฟล์เดิม;
      countdown ของ flash บน PDP (`modules/products/components/flash-sale`) ไม่อยู่ในกฎนี้
    (b) แต่ละแถวของ `group-selection` แสดงชื่อสินค้า + ชื่อ variant (`group-selection-title`) และราคาต่อชิ้นของ variant ใน region (`group-selection-price` มี `data-value` = `calculated_price.calculated_amount`,
      แสดงด้วย `convertToLocale`) จาก product ที่หน้าโหลดอยู่แล้ว — ไม่ยิง API เพิ่ม; ป้ายบอกว่าเป็นราคาก่อนส่วนลดกลุ่ม (ส่วนลดเกิดเมื่อกลุ่มสำเร็จ)
    (c) ข้อความส่วนลดแบบ `fixed` จาก `groupDiscountValue` ต่อท้าย "ต่อชิ้น" (เช่น "฿50 ต่อชิ้น") ทั้ง `group-discount` ของหน้ากลุ่มและการ์ดหน้าแรก; `percentage` คงเดิม — ฟอร์ม admin สร้างต้นแบบด้วย
      `allocation: "each"` เสมอ (`src/admin/lib/group-buy-form.ts`) และ GB-11 ไม่คืน `allocation`; ต้นแบบที่ถูกแก้เป็น `across` ที่หน้า promotion ของ Medusa ทำให้ข้อความไม่ตรง — **ยอมรับใน v1**
      (แบบเดียวกับข้อยอมรับของกฎข้อ 30b)
    (d) หน้า account (GB-7b) ที่ความกว้าง < 640px (breakpoint `sm` ของ Tailwind = 640px — **ไม่ใช่** `small` ของ starter ซึ่งเป็น 1024px ใน `tailwind.config.js`; แก้ถ้อยคำรอบ 17): `group-leave-confirm-box` วางข้อความยืนยันหนึ่งแถวและปุ่มสองปุ่มอีกแถว ปุ่มไม่ตัดคำ; ≥ 640px คงแถวเดียว
    (e) หน้า `/account/orders` ของลูกค้าที่มี `group-orders` แต่ไม่มี order ปกติ ไม่แสดง `no-orders-container` ของ `OrderOverview` ต่อท้าย — แสดง empty state เดิมเฉพาะเมื่อไม่มีทั้งสองแบบ
      (ใช้เงื่อนไข/prop ในหน้า orders ไม่ copy `OrderOverview`);
      (e1) **(owner 2026-11-04 รอบ 17)** เมื่อโหลด group orders ล้ม (แสดง `group-orders-error`) → **ไม่**แสดง `no-orders-container` แม้ไม่มี order ปกติ (ไม่รู้ว่ามี order กลุ่มหรือไม่
      จึงห้ามบอกว่า "ไม่มีคำสั่งซื้อ"); เงื่อนไขแสดง empty state = ไม่มี order ปกติ **และ** โหลด group orders สำเร็จ **และ** ได้ 0 รายการ — เขียนเป็นฟังก์ชัน pure (+ unit) ที่หน้า orders เรียก
33. (รอบ 16, GB-13 — qa GB-6e #231 O-2; owner Q21 = (ก) 2026-11-04 — แทนส่วน "ไม่ทำให้ idempotent" ของ Q10) `POST /admin/group-buy/campaigns` กันยิงซ้ำ/พร้อมกัน:
    (a) body รับ `idempotency_key` (optional, string 8–128 ตัว `[A-Za-z0-9_-]`) — ผิดรูป → 400 `invalid_data`; ไม่ส่ง → พฤติกรรมเดิม (`campaign_identifier = group-buy-<uuid>`)
    (b) มี key: `createGroupBuyCampaignWorkflow` ขอ lock `group-buy-campaign-create:<key>` ผ่าน `acquireLockStep` (Locking module, TTL/timeout ≤ 30s) → หา Medusa campaign ที่
      `campaign_identifier = group-buy-<key>` และแคมเปญของเราผ่าน link เดิมด้วย `query.graph` → พบ → คืนแคมเปญเดิม (ไม่สร้าง campaign/promotion/link ใหม่) / ไม่พบ → สร้างตามเดิมด้วย
      `campaign_identifier = group-buy-<key>` → `releaseLockStep`; `when(...)` ตั้งชื่อคงที่ (CLAUDE.md) และ compensation ของขั้นเดิมคงไว้
    (c) ตอบ 200 `{ campaign }` รูปเดียวกันทั้งสร้างใหม่และคืนของเดิม (AC-49 ยัง 200); key เดิมแต่ body ต่าง → คืนแคมเปญเดิม (key ใช้ได้ครั้งเดียวต่อการเปิดฟอร์ม — ไม่เทียบ body)
    (d) ฟอร์มสร้างแคมเปญใน admin สร้าง key ครั้งเดียวต่อการเปิด `FocusModal` และส่ง key เดิมทุกครั้งที่ submit ในรอบนั้น (ลองใหม่หลัง network ล้มได้แคมเปญเดิม);
      การกันกดซ้ำของกฎข้อ 17 คงไว้ — **(รอบ 20, owner เลือกทาง (ก) 2026-11-04 — GB-15)** สร้าง key ด้วย `crypto.getRandomValues` (มีทั้งบน http และ https)
      **ไม่ใช่** `crypto.randomUUID()` (มีเฉพาะ secure context — https/localhost; admin ที่เปิดผ่าน http เช่น staging/LAN กด "Create campaign" แล้ว throw จนฟอร์มไม่เปิด):
      helper pure `newIdempotencyKey()` ใน `src/admin/lib/group-buy-form.ts` สุ่ม 16 byte แล้วจัดรูปเป็น UUID v4 (ตั้ง bit version/variant ตาม RFC 4122 — key ยังเป็น "รูป UUID" ตาม AC-52
      และผ่าน validator เดิมของข้อ (a)); ไม่เพิ่ม dependency (ไม่ใช้ lib `uuid`), ไม่แก้ backend
34. (รอบ 16, GB-N4 — review/qa GB-6e/GB-7a2/GB-7c) hygiene ของ test: (a) `e2e/group-buy-join.spec.ts` ไม่เรียก `evidence("01-selection-address-shipping")` และ `evidence("05-guest-login")`
    (รูปถูกแทนด้วยรูปของ qa ใน `docs/evidence/group-buying/GB-7a2/REPORT.md`) — คงขั้นตรวจของ test; (b) `src/lib/util/home-campaigns.test.ts` กรณี `firstPool` ที่ `[b, a, d].reverse()` ซ้ำกับ
    `[d, a, b]` → แทนด้วยลำดับที่ต่างจริง; (c) `integration-tests/http/group-buy-campaigns.spec.ts` helper `createViaApi` assert status 200 ตรงๆ (AC-49 รอบ 15c) ไม่ใช่แค่ไม่ throw
35. (รอบ 16b, GB-14 — owner spec 01 Q-C4 = (ข) 2026-11-04; qa #238 D1) **join ต้องมีวิธีส่งที่ครอบ shipping profile ของสินค้า** — draft order ของกลุ่มไม่ผ่าน `completeCartWorkflow`
    จึงไม่ถูก `validateShippingStep` ของ Medusa ตรวจ (เช่น cart เสื้อ (profile Default) + วิธีส่ง Digital delivery (profile Digital) join ผ่าน API ได้):
    (a) ใน `validateJoinStep` (`src/workflows/group-buy/join-group.ts`, ขั้น 1 ใต้ lock, อ่านอย่างเดียว ไม่ต้องมี compensation) หลัง `assertJoinAllowed` (code 409 เดิมมาก่อน):
      อ่าน cart ด้วย `query.graph` ใน query เดิมโดยเพิ่ม field `items.requires_shipping`, `items.variant.product.shipping_profile.id`, `shipping_methods.shipping_option_id`
      (ชุดเดียวกับ `completeCartFields` ของ Medusa 2.22.1) แล้วอ่าน `query.graph({ entity: "shipping_option", fields: ["id", "shipping_profile_id"], filters: { id: <option ids> } })` แบบ `completeCartWorkflow`
    (b) helper pure `assertShippingProfilesCovered` ใน `src/modules/group_buy/utils/` (+ unit) ใช้กฎเทียบเดียวกับ `validateShippingStep`: profile ที่ต้องมี = `variant.product.shipping_profile.id` ของทุก line
      ที่ `requires_shipping = true`; profile ที่มี = `shipping_profile_id` ของ option ของทุก shipping method; มี profile ที่ต้องมีแต่ไม่อยู่ในชุด (รวม line ที่สินค้าไม่มี profile — `undefined`)
      → `MedusaError NOT_ALLOWED` code `GB_SHIPPING_PROFILE_NOT_COVERED` ข้อความขึ้นต้นด้วยชื่อ code (แบบ `SINGLE_PRODUCT_MESSAGE` — storefront จับจากข้อความเพราะ `FetchError` ไม่มี `code`)
      — ไม่สร้าง draft order/membership และไม่ใส่ `GB-<token>` ลง cart (ล้มก่อนขั้น 2); export code ใน `src/modules/group_buy/errors.ts` (**ไม่**อยู่ใน `GB_CONFLICT_CODES`)
    (c) **ข้อยกเว้น**: cart ที่ไม่มี shipping method เลย → ไม่ตรวจ (พฤติกรรมเดิม — test http/e2e/load ที่ join โดยไม่ตั้งวิธีส่งยังผ่าน; ต่างจาก `validateShippingStep` ที่ล้ม — **owner ตัดสิน Q22 = (ก) 2026-11-04**);
      cart ที่ทุก line `requires_shipping = false` (voucher) → ผ่านไม่ว่าวิธีส่งใด
    (d) storefront: `src/lib/util/group-join-error.ts` เพิ่ม `GB_SHIPPING_PROFILE_NOT_COVERED` ใน `CODES` (`message: null` — จับจากชื่อ code ในข้อความแบบ `GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED`)
      ข้อความไทย "วิธีจัดส่งที่เลือกใช้กับสินค้านี้ไม่ได้ กรุณาเลือกวิธีจัดส่งใหม่" (ปรับถ้อยคำได้ใน PR แต่ต่างจากทุก code) แสดงที่ `group-join-error` แทน "ปิดรับแล้ว";
      **ห้าม**เพิ่ม `GB_*` ใน `CHECKOUT_CONFLICTS` (error map ของ checkout)
36. (รอบ 17, GB-N5 — nit review #247 (GB-14) และ #246 (GB-N4); test/cleanup ไม่เปลี่ยนพฤติกรรม) (a) `src/modules/group_buy/utils/shipping-profile.ts` ตัดเงื่อนไข `!profile ||` ที่ซ้ำซ้อน
    (ผลของ helper เท่าเดิม — unit เดิมผ่านโดยไม่แก้ expectation); (b) `integration-tests/http/group-buy-join.spec.ts` ขั้นเปลี่ยนวิธีส่งของ cart จาก O_dig เป็น O_std (AC-54) ใช้ Store API
    ด้วย token ของเจ้าของ cart (`POST /store/carts/:id/shipping-methods`) ล้วน ไม่ใช้ admin API/module service — builder ตรวจ source ของ `@medusajs/core-flows` 2.22.1 ก่อนว่า
    method O_dig หายจาก cart ใน request เดียวกัน (ระบุไฟล์/บรรทัดใน PR; ถ้าไม่หาย → หยุดและรายงาน ไม่ใช้ทางอ้อม) — **แก้ถ้อยคำรอบ 18 ตามของจริง (GB-N5 #257)**:
    `addShippingMethodToCartWorkflow` (`cart/workflows/add-shipping-method-to-cart.ts`) **ไม่ได้**ลบ method เดิมทั้งหมดก่อนเพิ่ม — ลบเฉพาะ method ที่ shipping profile ชนกับ option ใหม่
    และ method เดิมที่ option ของมันไม่มี profile (`!sm.shipping_option?.shipping_profile_id` ใน `currentCollidingShippingProfileMethodIds`); O_dig (P_dig) ไม่ชนกับ O_std (P_phys) จึงยังอยู่ แล้วถูกลบในขั้น `refreshCartShippingMethodsWorkflow` (เรียกผ่าน `refreshCartItemsWorkflow` หลังเพิ่ม)
    ที่ทิ้ง method ของ profile ที่ไม่มี item ใดใช้ (เมื่อ cart มี method > 1); และลบ comment "ไม่มี route ลบ"
    ใน `integration-tests/http/group-buy-join.spec.ts` (~938 ของ #247); (c) โค้ดสร้าง admin user + JWT (`actor_type: "user"`) ใน `beforeEach` ที่ซ้ำกันหลาย spec (review #247 นับ ≥ 8;
    develop `e45b046` มี 6 ไฟล์ + ของ GB-14) ย้ายเป็น helper เดียว `integration-tests/helpers/admin.ts` (แบบ `helpers/customer.ts` — ไม่ใช่ abstraction ล่วงหน้า: ผู้ใช้จริงหลายที่) แล้วทุก spec ที่มีโค้ดชุดนั้นเรียก helper; (d) `src/lib/util/home-campaigns.test.ts`
    ชื่อตัวแปรของ pool ตรงกับ `join_token` (เช่น `const a = pool("a", ...)`) — ปัจจุบัน `a` ถือ token `"b"` และ `b` ถือ `"a"` ทำให้อ่าน expectation ผิด
37. (รอบ 18, GB-N6 — qa #259 O-3, nit 2 ของ review #259; test-only ไม่เปลี่ยนพฤติกรรม) (a) e2e admin ของ AC-52 (ไฟล์ที่ GB-13 #259 เพิ่ม) ไม่ขึ้นกับตำแหน่งเมาส์/toast:
    ก่อนคลิก `gb-campaign-create` (หรือปุ่มอื่นที่อยู่ใต้มุม toast) หลังมี `toast` ของ `@medusajs/ui` ให้รอจน toast หาย หรือปิด toast ก่อน — ทำเป็น helper ใน `e2e/support/admin.ts` เดิม (OPS-11)
    ถ้าใช้ ≥ 2 ที่ ไม่งั้นอยู่ใน spec นั้น; ห้ามแก้ด้วย `click({ force: true })` หรือ `waitForTimeout` — **(รอบ 19) ข้อ (a) ปิดแล้วใน GB-13 #259 (commit `016f204`)**
    ก่อน GB-N6 เริ่ม; GB-N6 #269 ส่งมอบข้อ (b); (b) integration http ของเส้นทาง error **หลังขอ lock** ใน `createGroupBuyCampaignWorkflow`:
    request ด้วย key K ที่ล้มในขั้นหลัง `acquireLockStep` → error และไม่มีของค้าง — ใน #259 `validateSingleProductScopeStep` รัน**ก่อน** lock จึงอาจไม่มี input ที่ล้มด้วย 4xx หลัง lock;
    ทางที่รับได้ตามลำดับ: (1) input จริงที่ล้มหลัง lock (4xx หรือ 5xx ก็ได้ — สิ่งที่พิสูจน์คือการปล่อย lock ไม่ใช่ status); (2) ทำให้ step หลัง lock ล้มใน test
    (เช่น `jest.spyOn` service/step ใน integration test ให้ throw ครั้งเดียว) — ห้ามแก้โค้ด production เพื่อเปิดช่องให้ test; ถ้าทำไม่ได้ทั้งสองทาง → builder หยุดและรายงาน (ไม่ตัดข้อนี้เอง);
    request ถัดไปด้วย K และ body ถูกต้องสำเร็จ**โดยไม่ต้องรอ TTL ของ lock** (lock ถูกปล่อยด้วย compensation/`releaseLockStep`)
38. (รอบ 19, GB-N7 — nit review #269; test-only ไม่เปลี่ยนพฤติกรรม) ใน `integration-tests/http/group-buy-campaigns.spec.ts` test ของ GB-N6 ("POST K that fails after the lock …")
    บรรทัดเหนือ assertion `toContain("percentage number between 0 and 100")` มี comment ภาษาไทยว่า assertion นี้มีไว้ยืนยันว่า request ล้ม**หลัง lock** ใน promotion module
    (`createPromotionsWorkflow`) ไม่ใช่ล้มที่ zod validator ของ route (ถ้าล้มที่ zod จะไม่พิสูจน์การปล่อย lock); ไม่แก้ assertion/logic
39. (รอบ 26, GB-16 — performance, follow-up รอบ 25) job `group-buy-deadline` กรอง membership ที่หมดเวลาด้วย `group: { status: "succeeded", pay_deadline_at: { $lte: now } }` เพื่อให้ใช้ index `(status, pay_deadline_at)` ของกลุ่ม (วัดได้ 50–65ms ต่อรอบเมื่อกรองแค่ `pay_deadline_at`);
    ไม่เปลี่ยนพฤติกรรม: `pay_deadline_at` ถูกตั้งเฉพาะตอนกลุ่ม `succeeded` (`workflows/group-buy/group-outcome.ts:100`) และ membership `awaiting_payment` มีเฉพาะในกลุ่มนั้น

## Acceptance criteria
- AC-1 เมื่อมีแคมเปญ (เป้าหมาย 3 ออเดอร์, −30%) และลูกค้าที่ login แล้ว 3 คนเข้าร่วม pool P แล้ว
  ภายใน 60 วินาที กลุ่มต้องเป็น `succeeded`, แต่ละคนมี draft order พร้อม payment collection และ
  แต่ละคนได้รับอีเมลพร้อมลิงก์ชำระเงิน
- AC-2 จาก AC-1 เมื่อสมาชิกชำระเงินด้วยบัตรทดสอบในหน้าชำระเงิน แล้ว draft order ของเขา
  ต้องกลายเป็น order ปกติที่ `payment_status=captured` และ membership เป็น `paid`
  (รอบ 14: ส่วน API ส่งมอบแล้วใน GB-5; ส่วน e2e ทั้งข้อ → **GB-7b** — setup join ผ่าน `POST /store/group-buy/groups/:token/join` ใน helper ของ test ไม่ต้องใช้ route สาธารณะ/หน้ากลุ่ม)
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
- AC-16 Storefront (รอบ 14 แยกเป็น 2 ส่วน):
  - AC-16a (**GB-7a1**) Given team G ของแคมเปญ `target_type=people` `target_value=3` ที่มีสมาชิก 2 คน When เปิดหน้ากลุ่มของ G (ไม่ login) Then `group-member-count` มีตัวเลข 2,
    `group-progress` มีตัวเลข 2 และ 3, `group-countdown` แสดงเวลาที่เหลือก่อน `ends_at` (ค่าลดลงเมื่อรอ ≥ 2 วินาที) และข้อความมีอักษรไทย; When ลูกค้าคนที่ 3 join ผ่าน API แล้ว reload
    Then `group-member-count` = 3 (กฎข้อ 29a) (e2e + screenshot)
  - AC-16b (**GB-7b**) หน้า account แสดง `group-pay-deadline` "ชำระเงินภายใน <time>" และหน้าชำระเงินทำรายการสำเร็จด้วย PromptPay (e2e + screenshots)
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
- AC-28 (**GB-7a2**, กฎข้อ 14c, 29c — แทนที่รอบ 14 ตาม owner Q16/Q19) Given A login แล้วมีที่อยู่ที่บันทึกไว้ 2 รายการ (H1, H2 ในประเทศไทย) และ cart ปัจจุบัน C (cookie `_medusa_cart_id = C`)
  ที่มีสินค้า Z นอกแคมเปญ qty 2 When A เปิดหน้ากลุ่ม เพิ่ม variant V1 qty 2 และ V2 qty 1 ของสินค้าในแคมเปญ (รอบ 15, กฎข้อ 31) ลงรายการ `group-selection`, เลือกที่อยู่ H2 ใน `group-address-select`, เลือกวิธีส่ง S ใน `group-shipping-option` แล้วกด
  `group-join-button` (ซ้ำด้วย `dblclick`) Then มี `POST .../join` **1** ครั้งด้วย `cart_id ≠ C`; cookie `_medusa_cart_id` ยังเป็น C; C (อ่านผ่าน
  store API) มี line ของ Z qty 2 เหมือนก่อนและไม่มี promotion `GB-*`; draft order ที่สร้าง (อ่านผ่าน admin API) มี item ครบ 2 รายการ V1 qty 2 และ V2 qty 1 (ไม่มีสินค้าอื่น), membership `units = 3`, `customer_id = A`, `shipping_address` ตรงกับ H2
  (`address_1`, `postal_code`, `country_code`, `phone`), `shipping_methods` 1 รายการที่ `shipping_option_id = S`, `shipping_total` = ราคาของ S และ `total` = ยอด item หลังส่วนลด + ค่าส่ง (เทียบ
  `MathBN`); Given ลูกค้า B ที่ไม่มีที่อยู่ When เปิดหน้ากลุ่ม Then `group-join-button` disabled, มี `group-add-address-link` และไม่มี `POST /store/carts` เกิดจากหน้า; cart ที่ใช้ join (`GET /store/carts/<cart_id ของ request>` ด้วย token ของ A ได้ 200)
  มี `customer_id = A`; When join ตอบ 409 `GB_GROUP_FULL` (กลุ่มเต็ม) Then `group-join-error` มีข้อความไทยและ C ยังไม่เปลี่ยน (e2e); unit: helper map ทุก code ในกฎข้อ 29f
  ได้ข้อความที่ต่างกันทุกตัวและมีอักษรไทย (unit Vitest — **GB-7a2a**);
  (รอบ 15) Given `max_units_per_person = 3` When รายการรวม 4 ชิ้น (ข้าม variant) Then ปุ่ม `group-join-button` disabled พร้อมข้อความไทย `group-units-limit` และไม่มี `POST /store/carts`;
  Given A มี membership 2 ชิ้นอยู่แล้วในแคมเปญ When join ด้วยรายการรวม 2 ชิ้น Then backend ตอบ 409 `GB_UNITS_LIMIT_EXCEEDED` และ `group-join-error` แสดงข้อความของ code นั้น (นับรวมทุก variant/membership — กฎข้อ 4) (e2e)
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
- AC-33 (GB-6b — **รอบ 15 แทนที่ด้วย AC-50** ส่วนจำนวนสินค้า: picker เลือกได้ 1 ตัว; ส่วน "ไม่มีช่องกรอก product ID" ยังใช้) ~~Given ฟอร์มสร้างแคมเปญ When เลือกสินค้า 2 ตัวผ่าน `gb-product-picker` (ค้นหาด้วยชื่อ) แล้ว submit Then body ของ `POST` มี~~
  ~~`application_method.target_rules = [{ attribute: "items.product.id", operator: "in", values: [<id1>, <id2>] }]`; และในฟอร์มไม่มีช่องกรอก product ID~~
  ~~แบบข้อความอิสระ (component test ตรวจ body ที่ส่ง)~~
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
  `awaiting_payment` ที่ collection ยังไม่ `completed` แล้ว admin แปลง Then M ไม่เปลี่ยน และมี log info; Given เส้นทางปกติของ GB-5 (capture → membership `paid` → แปลง → event)
  When subscriber ของ GB-10 ทำงาน Then เป็น noop ภายใต้ lock ต่อ membership (ไม่ error, ไม่ deadlock — ขอ lock ได้ภายใน timeout ของ GB-5 และ test จบภายใน timeout ปกติ) และ subscriber อื่นของ
  event เดียวกัน (affiliate attribution, e-voucher) ยังทำงาน; AC-2 (API) ของ GB-5 ยังผ่าน (integration http);
  (รอบ 13, กฎข้อ 25e–f — follow-up #196) unit ของ subscriber `group-buy-payment-captured.ts` (mock `query.graph` ให้ throw ตอนอ่านสถานะใหม่): ยังสร้าง notification alert 1 ฉบับ
  ด้วย key `<membership_id>:<reason>` และมี log warn; unit ของฟังก์ชันตัดสินส่ง alert (`src/modules/group_buy/utils/membership-payment.ts`) มีกรณี membership `joined` (`membership_joined`)
  ตามผลที่ฟังก์ชันกำหนด (assert ค่าตรง ไม่ใช่แค่ไม่ throw); unit ของ runbook: ตัวแปรเนื้อหาหัวข้อ "group buy: เงินเข้าแต่ไม่มี order" จบก่อนหัวข้อ `###` ถัดไป
  (fixture: ขั้นตรวจ draft ที่อยู่ในหัวข้อถัดไปเท่านั้น → test ล้ม; positive control ใน PR); grep: `loadMembership` ประกาศที่เดียว (unit jest)
- AC-45 (GB-11, กฎข้อ 28) Given แคมเปญ A (`active`, ในช่วงเวลา, `group_mode=both`, ต้นแบบ −30% scope = product X) ที่มี pool P1 `open`, pool P2 `failed`, pool P3 `open` แต่ `ends_at` ผ่านแล้ว
  (ตั้งผ่าน module), team T1 `open` และมีสมาชิก 1 คนใน P1; แคมเปญ B `draft`; แคมเปญ C `active` ที่ Medusa campaign `starts_at` อยู่ในอนาคต; แคมเปญ D `active` ที่ Medusa campaign `ends_at` ผ่านแล้ว
  When `GET /store/group-buy/campaigns/active` ด้วย publishable key อย่างเดียว (ไม่มี token ลูกค้า) Then 200, `campaigns` มีเฉพาะ A; ชุด key ของ campaign และของ group ใน `pool_groups`
  **เท่ากับ** allow-list ใน "API" รอบ 14 พอดี; `pool_groups` = [P1] พร้อม `join_token` และ `progress_people = 1`; `discount = { type: "percentage", value: 30, currency_code: null }`; `product_id = X` (รอบ 15);
  `JSON.stringify(response)` ไม่มี customer id ของสมาชิก, `GBT-`, `GB-<join_token>` ของกลุ่มใดๆ และ id ของ promotion ใดๆ; When ต้นแบบของแคมเปญ A2 (active) ไม่มี `target_rules` หรือมี 2 สินค้า (ตั้งผ่าน Promotion module ข้ามกฎข้อ 30) Then `campaigns` ไม่มี A2 (integration http)
- AC-46 (GB-11, กฎข้อ 28) Given team T1 ของแคมเปญ A ที่มี membership ของลูกค้า X 2 รายการ, Y 1 รายการ และ Z 1 รายการที่ `cancelled` และหลังสร้าง T1 admin แก้ต้นแบบเป็น scope = product W
  When `GET /store/group-buy/groups/<T1.join_token>` ไม่มี token ลูกค้า Then 200, `group.kind = "team"`, `progress_people`/`progress_orders`/`progress_units`/`ends_at`/`status` เท่ากับ DB,
  `campaign.product_id` = สินค้าในแคมเปญตอนสร้าง T1 (จาก promotion ของกลุ่ม ไม่ใช่ต้นแบบ — รอบ 15), ชุด key ของ `group`/`campaign` เท่ากับ allow-list พอดี และ `JSON.stringify(response)` ไม่มี id/อีเมลของ X, Y, Z,
  `order_id` ใดๆ, `created_by_customer_id`, `pay_deadline_at`; เรียกด้วย token ลูกค้าได้ body เดียวกัน; When กลุ่ม `succeeded` Then 200 `status = "succeeded"`;
  When token ไม่มีจริง Then 404 `type = "not_found"`; `POST /store/group-buy/groups/<token>/join` ไม่มี token ลูกค้ายังได้ 401 (integration http)
- AC-47 (GB-7a2, กฎข้อ 27, 29c–e) static test ของ spec 05 กฎ 31 ครอบไฟล์ GB-7a2: ฟังก์ชันที่เรียก server action join ต้องมี `syncAffiliateBefore(` ก่อนหน้าในฟังก์ชันเดียวกัน — fixture ที่ไม่มี
  → test ล้ม (positive control ใน PR) (unit); Given cookie `aff = T` When A join ผ่านหน้ากลุ่ม (cart ใหม่ตามกฎข้อ 29c) Then draft order ที่สร้าง (อ่านผ่าน admin API) มี
  `metadata.affiliate_token = T`; Given A ยังไม่ login When กด `group-join-button` Then ไปหน้า login และไม่มี `POST .../join` และไม่มี cart ใหม่ (e2e)
- AC-48 (GB-7c, กฎข้อ 29a, 29g) Given แคมเปญ group buy G1 (`group_mode=both`, มี pool P `open`) และ G2 (`group_mode=pool`) ที่ active และแคมเปญ flash F ที่ active When เปิดหน้าแรก `/th`
  (reload ได้ภายใน 90 วินาที) Then `home-campaigns` มี `group-campaign-card` 2 ใบ (G1, G2) และ `flash-campaign-card` ของ F, ข้อความมีอักษรไทย; (รอบ 15) การ์ด group buy แต่ละใบแสดงสินค้าเดียวของแคมเปญ: `group-campaign-thumbnail` (รูปจาก `GET /store/products`), ชื่อสินค้า,
  `group-campaign-price` (ราคาเริ่มต้นของ variant ใน region ก่อนส่วนลดแบบขีดฆ่า + หลังส่วนลดตาม `discount`) และ `group-campaign-progress` ของ pool ที่เปิดอยู่ (ถ้ามี); การ์ด G1 มี `group-pool-link` ที่ href ลงท้าย `/g/<P.join_token>`
  และมี `group-create-team-button`; การ์ด G2 ไม่มี `group-create-team-button`; When A (login) `dblclick` `group-create-team-button` ของ G1 Then มี `POST /store/group-buy/groups` **1** ครั้ง, URL เป็น
  `/th/g/<token ใหม่>`, `group-share-link` มี `/g/<token ใหม่>` และ A ยังไม่มี membership ใหม่ (ไม่ join อัตโนมัติ); When `POST /store/group-buy/groups` ตอบ 400 (mock หรือแคมเปญที่ต้นแบบถูกแก้) Then `group-create-team-error` มีข้อความไทยและไม่เปลี่ยนหน้า; When ยังไม่ login แล้วกด Then ไปหน้า login
  และไม่มี `POST`; Given ไม่มีแคมเปญ active ทั้งสองแบบ Then ไม่มี `home-campaigns` (e2e + screenshot)

- AC-49 (GB-6e, กฎข้อ 30a–c) integration http: `POST /admin/group-buy/campaigns` ที่ `target_rules` มีสินค้า 1 ตัว → 200 (ตามที่ route ตอบมาตั้งแต่ GB-2a เหมือน create route ฝั่ง admin ของ Medusa — รอบ 15c); 2 ตัว, `values: []` หรือไม่มี rule `items.product.id` → 400
  `type = "invalid_data"` ข้อความมี `GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED` และจำนวน Medusa campaign/promotion ก่อน-หลังเท่ากัน; workflow `createGroupBuyCampaignWorkflow` เรียกตรงด้วย 2 สินค้า → error code เดียวกัน
  ไม่มี campaign/promotion ใหม่; Given แคมเปญ `draft` ที่ต้นแบบถูกแก้เป็น 2 สินค้าผ่าน Promotion module When `POST .../status {status:"active"}` Then 400 และยังเป็น `draft`; Given แคมเปญ `active`
  ที่ต้นแบบถูกแก้เป็น 2 สินค้า When admin `POST .../groups` หรือลูกค้า `POST /store/group-buy/groups` Then 400 code เดียวกัน และไม่มี promotion `GB-*` ใหม่; กลุ่มที่สร้างก่อนแก้ยัง join ได้ 201;
  (review #227) หลังแปลง `seed-load.ts` เป็น `items.product.id`: `integration-tests/http/load-seed.spec.ts` ผ่าน และ gate AC-2/AC-3 ของ load test OPS-4 (spec 07) ยังผ่าน (ระบุ run ใน PR);
  e2e admin เดิม AC-30/AC-31 (`group-buy-admin-detail.spec.ts`) ผ่านหลัง helper สร้างแคมเปญส่ง `target_rules` สินค้าเดียว
- AC-50 (GB-6e, กฎข้อ 30d) e2e admin หรือ component test (mock `fetch`): Given ฟอร์มสร้างแคมเปญ When เลือกสินค้า A ใน `gb-product-picker` แล้วเลือก B Then เหลือ B ตัวเดียว (single select) และ body ของ
  `POST` มี `target_rules = [{ attribute: "items.product.id", operator: "in", values: [<B>] }]`; When ยังไม่เลือกสินค้าแล้ว submit Then เห็น `gb-product-required-error` และไม่มี `POST`; ไม่มีช่องกรอก product ID อิสระ;
  เคส AC-32 (submit โดยไม่เลือกสินค้า) และ AC-33 สองเคส (เลือก 2 สินค้า) ใน `group-buy-admin-form.spec.ts` ถูกเขียนใหม่ตาม AC-50 (ไม่ลบโดยไม่แทน); unit `group-buy-form.unit.spec.ts` คาด `values` 1 ค่า
  และไม่มี comment "ว่าง = ทุกสินค้า" ใน `lib/group-buy-form.ts` (grep)
- AC-51 (GB-12, กฎข้อ 32) grep: ไม่มีไฟล์ `home/components/campaigns/campaign-countdown.tsx` และ `group-buy/components/group-page/countdown.tsx`; การ์ดและหน้ากลุ่ม import `@modules/common/components/countdown`;
  unit (Vitest + jsdom, fake timers): `endsAt` อีก 3 วินาที → ตัวเลขลดลงหลังเลื่อนเวลา 1 วินาที; เลย `endsAt` → แสดง `expiredLabel` และ interval ถูก clear (`vi.getTimerCount() === 0`); `endsAt = null` → ไม่ render;
  unit: `groupDiscountValue({ type: "fixed", value: 50, currency_code: "thb" })` = "฿50 ต่อชิ้น", percentage 10 → "10%";
  e2e (หน้ากลุ่ม): เพิ่ม V1 ×2 → `group-selection-title` ของแถวมี `product.title` และ `variant.title` จาก `GET /store/products` (เทียบกับค่าจาก API ไม่ hard-code), `group-selection-price` มี `data-value` เท่ากับ
  `calculated_price.calculated_amount` ของ V1 ใน region ไทย; e2e 375×812 หน้า `/th/account/orders` ของลูกค้าที่มี membership `joined` 1 รายการและไม่มี order ปกติ: กด `group-leave-button` → ขอบล่างของข้อความยืนยัน
  ≤ ขอบบนของ `group-leave-confirm` (สองแถว) และความสูงของ `group-leave-confirm` เท่ากับ `group-leave-cancel` ±2px (ไม่ตัดคำ), `document.documentElement.scrollWidth` ≤ 375; ที่ 1280px ข้อความกับปุ่มอยู่แถวเดียว
  (กึ่งกลางแนวตั้งต่างกัน < 5px); ไม่มี `no-orders-container` เมื่อมี `group-orders`; ลูกค้าที่ไม่มีทั้งสองแบบ → `no-orders-container` 1 อัน; ข้อความใหม่มีอักษรไทย (regex) (e2e + screenshot);
  (รอบ 17, กฎข้อ 32e1) unit (Vitest) ของฟังก์ชันเงื่อนไข empty state: order ปกติ 0 + group orders โหลดสำเร็จ 0 รายการ → แสดง; order ปกติ 0 + group orders โหลด**ล้ม** → **ไม่**แสดง;
  order ปกติ 0 + group orders ≥ 1 → ไม่แสดง; order ปกติ ≥ 1 → ไม่แสดง (ไม่ว่าผลของ group orders); หน้า orders ใช้ฟังก์ชันนี้ (grep ชื่อฟังก์ชันใน `account/@dashboard/orders/page.tsx`)
- AC-52 (GB-13, กฎข้อ 33; Q21 = (ก) owner 2026-11-04) integration http: `POST /admin/group-buy/campaigns` ด้วย key K สอง request พร้อมกัน (`Promise.all`) → ทั้งคู่ 200 และ `campaign.id` เท่ากัน; จำนวน GB campaign,
  Medusa campaign และ promotion `GBT-*` เพิ่มอย่างละ 1; Medusa campaign มี `campaign_identifier = "group-buy-K"`; POST K ซ้ำภายหลัง → 200 id เดิม ไม่มีของใหม่; key K2 → แคมเปญใหม่; ไม่ส่ง key สองครั้ง →
  2 แคมเปญ (พฤติกรรมเดิม); key `"a b"` หรือยาว 129 ตัว → 400 `invalid_data` ไม่มีของใหม่; workflow เรียกตรงพร้อมกันด้วย key เดียวกัน → แคมเปญเดียว; e2e admin (Playwright) ของฟอร์มที่ดัก network ด้วย `page.route`
  (request แรก `route.fetch()` ให้ถึง backend แล้ว `route.abort()` ให้ฟอร์มเห็น network error):
  body มี `idempotency_key` รูป UUID, submit ซ้ำหลัง request แรกล้มด้วย network error ส่ง key เดิม (และได้แคมเปญเดียว), ปิดแล้วเปิดฟอร์มใหม่ → key ใหม่; AC-49 และ AC-50 ยังผ่าน
  (แก้ถ้อยคำรอบ 18: เดิม "component test (mock `fetch`)" — backend ไม่มี jsdom/RTL และการเพิ่ม dependency ต้องผ่าน spec/ADR จึงใช้ e2e admin ตามที่ GB-13 #259 ทำ)
- AC-53 (GB-N4, กฎข้อ 34) grep: `e2e/group-buy-join.spec.ts` ไม่มี `"01-selection-address-shipping"` และ `"05-guest-login"`; `src/lib/util/home-campaigns.test.ts` ส่วน `firstPool` ไม่มี `.reverse()` และมี input
  อย่างน้อย 3 ลำดับที่ต่างกันจริง (เทียบ `JSON.stringify` ของลำดับ token) ที่ได้ผลเดียวกัน; `group-buy-campaigns.spec.ts` ใน `createViaApi` มี assertion status 200 (grep) และ suite ผ่าน; e2e ที่แก้ยังผ่าน
- AC-54 (GB-14, กฎข้อ 35) integration http (`integration-tests/http/group-buy-join.spec.ts`; test สร้าง shipping profile 2 ตัว (P_phys, P_dig) + option O_std (P_phys) และ O_dig (P_dig) ผ่าน admin API
  ในเขตบริการของ region ไทย และสินค้าของแคมเปญผูก P_phys): Given cart ของ A มี line `requires_shipping = true` และ shipping method จาก O_dig When `POST /store/group-buy/groups/:token/join`
  Then 400, `type = "not_allowed"`, `message` มี `GB_SHIPPING_PROFILE_NOT_COVERED`; จำนวน membership/draft order ก่อน-หลังเท่ากัน, `progress_*` ของกลุ่มไม่เปลี่ยน และ cart ไม่มี promotion `GB-*`;
  Given cart เดียวกันเปลี่ยนเป็น O_std When join Then 201; Given cart มีทั้ง O_std และ O_dig Then 201; Given cart ไม่มี shipping method Then 201 (กฎข้อ 35c); Given cart ที่ทุก line `requires_shipping = false`
  + O_dig Then 201; Given กลุ่มเต็ม (409 `GB_GROUP_FULL`) และ cart ใช้ O_dig Then 409 `GB_GROUP_FULL` (ลำดับ — 409 มาก่อน); unit jest ของ helper: ครอบ / ไม่ครอบ / line ไม่มี profile + มี method → ล้ม /
  ไม่มี method → ผ่าน / ทุก line ไม่ต้องจัดส่ง → ผ่าน; unit `error-handler.unit.spec.ts`: `BUSINESS_CONFLICT_CODES.has("GB_SHIPPING_PROFILE_NOT_COVERED") === false`;
  unit Vitest (`group-join-error.test.ts`): `groupJoinFailure({ status: 400, message: "GB_SHIPPING_PROFILE_NOT_COVERED: ..." })` → `{ error: "GB_SHIPPING_PROFILE_NOT_COVERED" }` (ไม่ใช่ `closed`),
  `groupJoinActionMessage` ของ code นี้ตรง regex อักษรไทยและต่างจากข้อความของทุก code อื่น; grep: `CHECKOUT_CONFLICTS` ใน `apps/storefront/src/lib/util/checkout-error.ts` ไม่มี `GB_`; AC-28 ยังผ่าน
- AC-55 (GB-N5, กฎข้อ 36) grep: `apps/backend/src/modules/group_buy/utils/shipping-profile.ts` ไม่มี `!profile ||` และ unit ของ helper (AC-54) ผ่านโดยไม่แก้ expectation;
  grep: ขั้นเปลี่ยน O_dig → O_std ใน `integration-tests/http/group-buy-join.spec.ts` เรียก `/store/carts/` และ test ของ AC-54 ไม่มี `container.resolve`/`/admin/` ในขั้นนั้น, ไฟล์ไม่มีวลี "ไม่มี route ลบ" และ PR อ้างไฟล์/บรรทัดของ core-flows 2.22.1 ที่ทำให้ O_dig หาย (การลบ method ที่ profile ชนใน `add-shipping-method-to-cart.ts` + การทิ้ง method ของ profile ที่ไม่มี item ใช้ใน `refresh-cart-shipping-methods.ts` — กฎข้อ 36b, แก้ถ้อยคำรอบ 18); มีไฟล์ `integration-tests/helpers/admin.ts`
  และ grep `actor_type: "user"` ใต้ `apps/backend/integration-tests/` พบเฉพาะใน `helpers/admin.ts` (develop `e45b046` มี 6 spec + spec ของ GB-14; JWT ของ affiliate ใน
  `evoucher-store.spec.ts` ไม่อยู่ในข้อนี้); suite integration http ทั้งหมดผ่านใน CI;
  `home-campaigns.test.ts`: ทุกบรรทัดรูป `const <x> = pool("<y>", ...)` มี `<x> === <y>` (grep/regex ใน test หรือ PR) และ test เดิมผ่าน
- AC-56 (GB-N6, กฎข้อ 37) grep: e2e admin ของ AC-52 ไม่มี `force: true` และ `waitForTimeout` และก่อนคลิก `gb-campaign-create` ที่ตามหลัง toast มีการรอ/ปิด toast (helper หรือ
  `expect(<locator ของ toast>).toHaveCount(0)`); e2e นั้นผ่าน `--repeat-each=5` ใน CI หรือในเครื่อง (แนบผลใน PR); integration http (`integration-tests/http/group-buy-campaigns.spec.ts`):
  request แรกด้วย key K ล้มหลัง lock (ตามทางในกฎข้อ 37b) → status ไม่ใช่ 2xx, จำนวน GB campaign/Medusa campaign/promotion `GBT-*` ก่อน-หลังเท่ากัน; request ที่สองด้วย K + body ถูกต้องตอบ 200 ภายใน < 10 วินาที
  (วัดเวลาใน test — น้อยกว่า TTL 30s ของกฎข้อ 33b) และ Medusa campaign มี `campaign_identifier = "group-buy-K"`; AC-52 ยังผ่าน
- AC-57 (GB-N7, กฎข้อ 38) grep: ใน `group-buy-campaigns.spec.ts` บรรทัดก่อนหน้า (ติดกัน) ของบรรทัดที่มี `percentage number between 0 and 100` เป็น comment ที่มีอักษรไทยและมีคำว่า `lock`
  และ `zod`; diff ของ PR ในไฟล์นี้มีเฉพาะบรรทัด comment (ไม่มีบรรทัด code เปลี่ยน); AC-56 ยังผ่านใน CI (`backend-tests`)
- AC-58 (GB-15, กฎข้อ 33d รอบ 20) unit jest (`src/admin/lib/__tests__/group-buy-form.unit.spec.ts`): Given `globalThis.crypto` ถูกแทนชั่วคราวด้วย object ที่มี**เฉพาะ** `getRandomValues`
  (ของจริงจาก `node:crypto` `webcrypto`; ไม่มี `randomUUID` — จำลองหน้า http) When เรียก `newIdempotencyKey()` 1,000 ครั้ง Then ไม่ throw, ทุกค่าตรง `/^[A-Za-z0-9_-]{8,128}$/`
  (regex ของกฎข้อ 33a) และ `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`, `new Set(keys).size === 1000`; คืนค่า `globalThis.crypto` เดิมหลัง test (`afterEach`);
  grep: `apps/backend/src/admin/components/group-buy/create-campaign.tsx` และ `apps/backend/src/admin/lib/group-buy-form.ts` ไม่มีคำว่า `randomUUID` (รวม comment) และ `openModal` เรียก `newIdempotencyKey()`;
  diff ของ PR ไม่แตะ `apps/backend/src/api/` และ `package.json`; e2e admin ของ AC-52 (body มี `idempotency_key` รูป UUID, key เดิมเมื่อ submit ซ้ำ, key ใหม่เมื่อเปิดฟอร์มใหม่) และ AC-56 ผ่านโดยไม่แก้ assertion
- AC-59 (GB-16, กฎข้อ 39) unit (mock service ของ job): `listAndCountGroupBuyMemberships`/`listGroupBuyMemberships` ถูกเรียกด้วย filter ที่ `group` มี `status: "succeeded"` และ `pay_deadline_at.$lte`; integration ที่มีอยู่ `group-buy-payment.spec.ts`, `group-buy-outcome.spec.ts` (AC-10) ผ่านโดยไม่แก้ assertion;
  แนบผล `EXPLAIN` ของ query ก่อน/หลังใน PR (เป็นหลักฐาน ไม่ใช่เกณฑ์ผ่าน — planner เลือก plan ตามปริมาณข้อมูล)

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
- (รอบ 13) unit jest: AC-44 ส่วนรอบ 13 (GB-10 — subscriber fail-open, กรณี `membership_joined`, ขอบหัวข้อ runbook)
- (รอบ 14) integration (http): AC-45, AC-46 (GB-11) + unit ของ helper ดึง `product_id`/`discount` (0, 1, 2 ค่า) จาก `application_method` (กฎข้อ 28e);
  e2e: AC-16a (GB-7a1); e2e: AC-28, AC-47 ส่วน e2e + unit static test AC-47 และ unit ของ map code → ข้อความไทย (AC-28) (GB-7a2); e2e: AC-48 (GB-7c); e2e: AC-2, AC-16b (GB-7b)
- (รอบ 15) integration (http): AC-49 + e2e admin/component: AC-50 (GB-6e); AC-28 ส่วนหลาย variant/`units` รวม (GB-7a2), unit map code (GB-7a2a)
- (รอบ 16) unit + e2e: AC-51 (GB-12); integration (http) + e2e admin (`page.route`): AC-52 (GB-13); grep + suite เดิม: AC-53 (GB-N4)
- (รอบ 16b) integration (http) + unit jest + unit Vitest + grep: AC-54 (GB-14)
- (รอบ 17) unit Vitest: AC-51 ส่วนกฎข้อ 32e1 (GB-12); grep + suite เดิม (integration http, unit jest, Vitest): AC-55 (GB-N5)
- (รอบ 18) e2e admin (repeat) + integration (http) + grep: AC-56 (GB-N6)
- (รอบ 19) grep + suite เดิม: AC-57 (GB-N7)
- (รอบ 20) unit jest + grep + e2e admin เดิม: AC-58 (GB-15); qa (ไม่ใช่ AC): เปิด admin ผ่าน http ที่ไม่ใช่ localhost (เช่น IP ของเครื่องใน LAN) แล้วกด `gb-campaign-create` → ฟอร์มเปิดและสร้างแคมเปญได้

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
| GB-9 | (backend เล็ก, รอบ 12 — re-review #185) alert เงินค้างอ่านสถานะใหม่ก่อนส่ง, idempotency key ต่อ membership+เหตุ, runbook ขั้นตรวจ draft + URL `/app/orders/<id>`, test คืนค่า `OPS_ALERT_EMAIL` (กฎข้อ 25) (AC-43) — ไฟล์: `src/subscribers/group-buy-payment-captured.ts`, `src/workflows/group-buy/membership-payment.ts`, `docs/ops/production.md`, `integration-tests/http/group-buy-payment.spec.ts` — ☑ #196 | GB-5 ☑ (#185) — **เริ่มได้** |
| GB-10 | (backend เล็ก, รอบ 12 — review #185) membership เป็น `paid` เมื่อ ops แปลง draft order เองหลังเงินเข้า (กฎข้อ 26) (AC-44) — ไฟล์: subscriber ใหม่ใน `src/subscribers/`, workflow/step ใน `src/workflows/group-buy/`; **(รอบ 13) รวม follow-up review #196 (GB-9)**: subscriber `group-buy-payment-captured.ts` fail-open เมื่ออ่านสถานะใหม่ล้ม (`loadMembership` ราวบรรทัด 37 เข้าไปใน `try`), ย้าย `loadMembership` ออกจาก `src/workflows/group-buy/membership-payment.ts` เป็น helper เดียวถ้า subscriber ใหม่ใช้ร่วม, test กรณี `membership_joined` ใน `src/modules/group_buy/utils/membership-payment.ts`, ขอบตัวแปร `gb` ใน `src/__tests__/ops-runbook.unit.spec.ts` (กฎข้อ 25e–f) — ไฟล์เพิ่ม: `src/subscribers/group-buy-payment-captured.ts`, `src/modules/group_buy/utils/membership-payment.ts` (+ test), `src/__tests__/ops-runbook.unit.spec.ts` — ถ้ารวมแล้วเกิน ~400 LOC ให้ builder แยกเป็น **GB-10** (subscriber/workflow ของกฎข้อ 26 + AC-44 ส่วนเดิม) และ **GB-10b** (follow-up #196 ของกฎข้อ 25e–f + AC-44 ส่วนรอบ 13; ทำก่อนหรือหลังก็ได้ — ถ้า GB-10 ใช้ `loadMembership` ร่วม ให้ตัวที่ทำก่อนย้าย helper) — ☑ #208 (PR เดียว ไม่แยก GB-10b) | GB-5 ☑ (#185), **GB-9 (#196) merge** (รอบ 13 — แก้โค้ดที่ #196 เพิ่ม; เดิม "ชน `membership-payment.ts` ตัวที่ merge ทีหลัง rebase") |
| GB-6e | (admin + backend, รอบ 15 — owner: 1 แคมเปญ = 1 สินค้า) validator ของ `POST /admin/group-buy/campaigns` + ตรวจซ้ำใน `createGroupBuyCampaignWorkflow`, `setGroupBuyCampaignStatusWorkflow` (`draft → active`) และ `createGroupWorkflow` (กฎข้อ 30a–c; AC-49) + `gb-product-picker` เลือกได้ 1 สินค้า + `gb-product-required-error` (กฎข้อ 30d; AC-50) — ไฟล์: `src/api/admin/group-buy/validators.ts`, `src/workflows/group-buy/{campaign,create-group}.ts` (หรือไฟล์ที่ workflow อยู่จริง), helper pure ตรวจ `target_rules` ใน `src/modules/group_buy/utils/` (+ unit — ใช้ร่วมกับ helper `product_id` ของ GB-11 ถ้าตัวหนึ่ง merge ก่อน), `src/admin/components/group-buy/{product-picker,create-campaign}.tsx`, test http ของ campaigns/groups; **โค้ด/test เดิมที่พังเมื่อบังคับกฎข้อ 30 (review #227) — แก้ใน PR นี้**: `src/scripts/seed-load.ts` (~123–139 `items.variant_id` → `items.product.id`; `integration-tests/http/load-seed.spec.ts` + gate load test OPS-4), `storefront/e2e/group-buy-admin-detail.spec.ts` (helper ~25–40 ส่ง `target_rules` สินค้าเดียว; AC-30/31), `storefront/e2e/group-buy-admin-form.spec.ts` (เคส AC-32 ไม่เลือกสินค้า + AC-33 สองเคส → AC-50), `src/admin/lib/__tests__/group-buy-form.unit.spec.ts` (`values` 1 ค่า) + comment "ว่าง = ทุกสินค้า" ใน `src/admin/lib/group-buy-form.ts`; ~320 LOC | GB-6b ☑ — **เริ่มได้** (∥ GB-11; ชน `product-picker.tsx` กับ ADM-7 (spec 08) และ helper `utils/` กับ GB-11 — ตัวที่ merge ทีหลัง rebase) |
| GB-11 | (backend, รอบ 14 — builder GB-7 พบว่าไม่มี route) route สาธารณะอ่านอย่างเดียว `GET /store/group-buy/campaigns/active` + `GET /store/group-buy/groups/:token` ตาม "API" รอบ 14 และกฎข้อ 28 + integration test (AC-45, AC-46; รอบ 15: `product_id` ค่าเดียวแทน `product_ids` ตามกฎข้อ 28e/30) — ไฟล์: `src/api/store/group-buy/campaigns/active/route.ts`, `src/api/store/group-buy/groups/[token]/route.ts` (GET; ข้าง `join/` เดิม), helper pure ของกฎข้อ 28e ใน `src/modules/group_buy/utils/` (+ unit), `src/api/store/group-buy/middlewares.ts` (ไม่ใส่ `customerAuth` ให้ `GET`), `integration-tests/http/group-buy-public.spec.ts`; ~300 LOC | GB-8 ☑, GB-3b ☑ — **เริ่มได้** (∥ GB-7b, GB-10) |
| GB-7a1 | (รอบ 14 — GB-7a เดิมเกิน ~400 LOC หลังเพิ่มที่อยู่/วิธีส่งตาม Q19 จึงแยก) หน้ากลุ่ม `/<cc>/g/<token>` อ่านอย่างเดียว: ความคืบหน้า/นับถอยหลัง/จำนวนสมาชิกจาก GB-11 แบบ `no-store`, ส่วนลด, สินค้าเดียวของ `product_id` (รอบ 15) (`listProducts` เดิม), `group-share-link`, ข้อความไทยตรงในโค้ด + path ใหม่ใน ESLint rule (spec 01 CORE-4 กฎข้อ 4, ADR-014) (กฎข้อ 29b; AC-16a) — ~200 LOC | **GB-11**; ∥ GB-7b (ไฟล์ร่วม `lib/data/group-buy.ts`/ESLint rule — ตัวที่ merge ทีหลัง rebase) |
| GB-7a2a | (storefront เล็ก, รอบ 15 — แยกจาก GB-7a2 ล่วงหน้าเพราะหลาย variant ทำให้เกิน ~400 LOC) helper map code ของ join → ข้อความไทย (กฎข้อ 29f + รอบ 15: `GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED` "แคมเปญนี้ยังไม่พร้อมเปิดกลุ่ม" — ใช้ร่วมกับปุ่มสร้างทีมของ GB-7c) + unit Vitest (AC-28 ส่วน unit) — ไฟล์: `src/lib/util/group-join-error.ts` (+ test); ~80 LOC | none — **เริ่มได้** (∥ ทุกตัว) |
| GB-7a2 | (รอบ 14, Q16/Q17/Q19; รอบ 15 หลาย variant) บนหน้ากลุ่ม: รายการ `group-selection` หลาย variant + จำนวนด้วย `OptionSelect` ของ PDP (กฎข้อ 31) + ที่อยู่ที่บันทึกไว้ + วิธีส่ง → cart ใหม่หลาย line ผ่าน `createCartWithItems` (export จาก `lib/util/server-cart.ts`) + `sdk.store.cart.update` (ที่อยู่) + `listCartShippingMethods(cart_id)` + `setShippingMethod` เดิม, ไม่แตะ cart ปัจจุบัน (กฎข้อ 14c, 29c; 14d ไม่ต้องกัน), sync cookie `aff` ลง cart ใหม่ก่อน join (กฎข้อ 27) + เพิ่มจุดนี้ใน static test ของ spec 05 กฎ 31, ใช้ error map ของ GB-7a2a, `group-units-limit`, กันกดซ้ำ (กฎข้อ 29c–e, 31; AC-28 ส่วน e2e, AC-47) — ไม่มี backend เพิ่ม (`createGroupDraftOrderStep` คัดลอกทุก line/ที่อยู่/วิธีส่ง และ `cartUnits` รวมทุก line อยู่แล้ว); ~380 LOC (หลังย้าย error map ไป GB-7a2a; รายการหลาย variant ~+80 รวมย้าย `optionsAsKeymap`/หา variant เป็น helper ~30 — กฎข้อ 31a) — ถ้ายังเกินให้แยกส่วนที่อยู่/วิธีส่งเป็น PR ก่อน join | **GB-7a1**, **GB-7a2a**, GB-6e (สินค้าเดียว), GB-3 ☑, AF-16 ☑ (#197) |
| GB-7c | (รอบ 14 — owner Q15 ให้แสดงทุกแคมเปญบนหน้าแรก, Q18 = ก; แยกเพื่อให้แต่ละ PR ≤ ~400 LOC) ส่วน `home-campaigns` บนหน้าแรก `/<cc>`: การ์ด flash ผ่าน**ฟังก์ชันใหม่** ใน `lib/data/flash-sales.ts` ที่เรียก `GET /store/flash-sales/active` โดยไม่ส่ง `variant_ids` (reviewer #224 ยืนยันว่าได้แคมเปญครบ; `getActiveFlashSales` เดิมคืน `null` เมื่อ array ว่างจึงใช้ไม่ได้ — ไม่แก้ฟังก์ชันเดิม, ไม่สร้าง route ใหม่) + การ์ด group buy (GB-11; รอบ 15: สินค้าเดียวต่อการ์ด — รูป/ชื่อ/ราคาก่อน-หลังส่วนลด/ความคืบหน้า pool จาก `listProducts` เดิมด้วย `product_id` ของทุกแคมเปญใน request เดียว) + ปุ่มสร้างทีม → `/<cc>/g/<token>` (ล้ม → ข้อความไทยจาก helper ของ GB-7a2a ใน `group-create-team-error` บนการ์ด เช่น 400 `GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED`/`not_allowed`, 403 mode) ที่มี `group-share-link` (กฎข้อ 29a, 29g; AC-48) — ใช้ cache ของหน้าแรกเดิม (ADR-017; ค่า `sold_out`/`remaining_units`/`progress_*` ค้างได้ ~90 วินาที ยอมรับตามกฎข้อ 29a); **rebase กับ #216 (FS-18)** ที่แก้ `lib/data/flash-sales.ts` เดียวกัน — ตัวที่ merge ทีหลัง rebase; ~280 LOC (ส่วน + การ์ด 2 แบบ ~150 รวมสินค้าบนการ์ด, ฟังก์ชัน flash ~20, ปุ่มสร้างทีม ~40, e2e ~70) | **GB-7a1** (หน้า `/g/<token>` + `group-share-link` ที่ปุ่มสร้างทีมพาไป), **GB-7a2a** (error map), GB-11, FS-4 ☑ |
| GB-7b | (รอบ 14 แยกจาก GB-7 — ☑ #223) หน้า account: รายการ draft order ของกลุ่มจาก route GB-8 พร้อมสถานะ (`group-pay-deadline`), ปุ่มออกจากกลุ่ม (GB-3b), ลิงก์ไป `/account/orders/:id/pay` ของ PAY-3b (ไม่สร้างหน้าชำระเงินซ้ำ); ข้อความไทย + path ใหม่ใน ESLint rule (AC-2 e2e, AC-16b) | GB-5 ☑ (#185), GB-8 ☑, GB-3b ☑, PAY-3b1 ☑ (#189), PAY-3b2 ☑ (#203) (spec 06) |
| ~~GB-7~~ | (รอบ 14) แยกเป็น GB-7a1 + GB-7a2 + GB-7b + GB-7c — ข้อความเดิม: หน้า storefront แคมเปญ/กลุ่ม/account/ชำระเงิน + ล้าง cart หลัง join (กฎข้อ 14c; 14d ไม่ต้องกัน) + e2e (AC-2, AC-16, AC-28); ข้อความไทยตรงในโค้ด + path ใหม่ใน ESLint rule (spec 01 CORE-4 กฎข้อ 4, ADR-014); (รอบ 10) รายการ draft order ของกลุ่มในหน้า account อ่านจาก route ของ GB-8 และลิงก์ไปหน้าชำระเงินของ PAY-3b (ไม่สร้างหน้าชำระเงินซ้ำ); (รอบ 12) sync cookie `aff` ลง cart ก่อนเรียก join (กฎข้อ 27) + เพิ่มจุดนี้ใน static test ของ spec 05 กฎ 31 | GB-5 ☑ (#185), GB-8 ☑, PAY-3b1 ☑ (#189) + **PAY-3b2 (◐ #203)** (spec 06), GB-3b ☑, AF-16 ☑ (#197) (spec 05 — token บน draft order) |
| GB-12 | (storefront ~250 LOC, รอบ 16 — review/qa 2026-11-04) countdown กลาง, ชื่อสินค้า + ราคาต่อชิ้นใน `group-selection`, fixed "ต่อชิ้น", กล่องยืนยันออกจากกลุ่มที่ 375px + empty state เดียวในหน้า orders (กฎข้อ 32; AC-51) — ไฟล์: `modules/common/components/countdown/index.tsx` ใหม่ (+ unit; ลบ `home/components/campaigns/campaign-countdown.tsx`, `group-buy/components/group-page/countdown.tsx`), `group-buy/components/group-page/{index,group-join}.tsx`, `home/components/campaigns/group-campaign-card.tsx`, `lib/util/group-page.ts` (+ test), `group-buy/components/account-group-orders/leave-button.tsx`, `app/[countryCode]/(main)/account/@dashboard/orders/page.tsx` (+ prop ของ `order-overview` ถ้าจำเป็น), e2e; **(รอบ 17, owner 2026-11-04) เพิ่มใน PR #244**: ไม่แสดง `no-orders-container` เมื่อโหลด group orders ล้ม (กฎข้อ 32e1) + unit ของเงื่อนไข (AC-51 ส่วนรอบ 17) — ไฟล์เพิ่ม: `lib/util/group-buy-orders.ts` (+ `group-buy-orders.test.ts`) — ☑ #244 | GB-7a1 ☑, GB-7a2 ☑ (#238), GB-7b ☑, GB-7c ☑ (#239) — **เริ่มได้**; ชน `group-join.tsx` กับ CORE-30 (spec 01) ตัวที่ merge ทีหลัง rebase |
| GB-13 | (backend + admin เล็ก ~200 LOC, รอบ 16 — qa GB-6e #231 O-2) `idempotency_key` ของการสร้างแคมเปญ: validator + lock/lookup ใน `createGroupBuyCampaignWorkflow` + ฟอร์ม admin ส่ง key (กฎข้อ 33; AC-52) — ไฟล์: `src/api/admin/group-buy/validators.ts`, `src/workflows/group-buy/campaign.ts`, `src/admin/components/group-buy/create-campaign.tsx` (+ `src/admin/lib/group-buy-form.ts`), `integration-tests/http/group-buy-campaigns.spec.ts`, e2e admin ของฟอร์ม (`page.route` — แก้ถ้อยคำรอบ 18 จาก "component test") — ☑ #259 (train #261) | **GB-N4** (ชน `group-buy-campaigns.spec.ts`), GB-6e ☑ (#231) — Q21 = (ก) owner 2026-11-04; ชน `create-campaign.tsx` กับ ADM-7 (spec 08) ตัวที่ merge ทีหลัง rebase |
| GB-N4 | (test-only เล็ก ~30 LOC, รอบ 16) ตัด `evidence(...)` ที่ถูกแทนด้วยรูป qa, กรณี `firstPool` ที่ซ้ำ, `createViaApi` assert 200 (กฎข้อ 34; AC-53) — ไฟล์: `storefront/e2e/group-buy-join.spec.ts`, `storefront/src/lib/util/home-campaigns.test.ts`, `backend/integration-tests/http/group-buy-campaigns.spec.ts` — ☑ #246 | none — **เริ่มได้** (∥ ทุกตัว; **ต้อง merge ก่อน GB-13**) |
| GB-14 | (backend + storefront เล็ก ~150 LOC, รอบ 16b — owner spec 01 Q-C4 = ข) ตรวจ shipping profile ตอน join + map code ใหม่เป็นข้อความไทย (กฎข้อ 35; AC-54) — ไฟล์: `src/workflows/group-buy/join-group.ts` (`validateJoinStep` — field ของ cart + query `shipping_option`), `src/modules/group_buy/utils/shipping-profile.ts` ใหม่ (+ unit), `src/modules/group_buy/errors.ts`, `src/api/__tests__/error-handler.unit.spec.ts`, `integration-tests/http/group-buy-join.spec.ts`, `storefront/src/lib/util/group-join-error.ts` (+ `group-join-error.test.ts`) | none — **เริ่มได้** (∥ CORE-32 ของ spec 01 — ไม่มีไฟล์ชน: CORE-32 แตะ `lib/data/group-join.ts`/`lib/util/shipping-options.ts`; ∥ GB-12, GB-13, GB-N4 — ไม่มีไฟล์ชน (GB-N4 แตะ `e2e/group-buy-join.spec.ts` ฝั่ง storefront ไม่ใช่ไฟล์ http ชื่อเดียวกันของ backend)); ควรมีก่อน release v0.5.0 — ☑ #247 |
| GB-N5 | (test/cleanup เล็ก ~150 LOC, รอบ 17 — nit review #247/#246) ตัด `!profile \|\|`, ขั้น O_dig → O_std ใช้ Store API, helper `integration-tests/helpers/admin.ts` แทนโค้ดสร้าง admin + JWT ที่ซ้ำ, ชื่อตัวแปร pool ใน `home-campaigns.test.ts` (กฎข้อ 36; AC-55) — ไฟล์: `src/modules/group_buy/utils/shipping-profile.ts`, `integration-tests/helpers/admin.ts` ใหม่, `integration-tests/http/{group-buy-join,evoucher-admin,evoucher-admin-ui,evoucher-partner-url,evoucher-void-expiry,affiliate-admin,flash-sale-admin-config}.spec.ts` (ตามที่มีโค้ดชุดนั้นจริงตอนเริ่ม), `storefront/src/lib/util/home-campaigns.test.ts`; ถ้าเกิน ~400 LOC แยกส่วน helper admin เป็น PR ที่สอง — ☑ #257 | **GB-14 (#247) merge**, **GB-N4 (#246) merge** (แก้ `home-campaigns.test.ts` ส่วน `firstPool` เดียวกัน); ชน spec http กับ GB-13 (`group-buy-campaigns.spec.ts` — ไม่อยู่ในรายการถ้าไม่มี `actor_type: "user"`) และ AF-15 (`affiliate-admin.spec.ts`) ตัวที่ merge ทีหลัง rebase; ไม่บล็อก release |
| GB-N6 | (test-only เล็ก ~60 LOC, รอบ 18 — qa #259 O-3, nit 2 review #259) e2e admin ของ AC-52 รอ/ปิด toast ก่อนคลิก `gb-campaign-create` + integration test เส้นทาง error หลังขอ lock แล้ว key เดิมใช้ต่อได้ทันที (กฎข้อ 37; AC-56) — ไฟล์: e2e admin ที่ #259 เพิ่ม, `storefront/e2e/support/admin.ts` (ถ้าเป็น helper), `backend/integration-tests/http/group-buy-campaigns.spec.ts` — ☑ #269 (train #270; ข้อ (a) ปิดโดย #259 commit `016f204`) | **GB-13 (#259) merge** (แก้ test ที่ #259 เพิ่ม); ∥ ทุกตัวของ spec 01; ชน e2e admin ของฟอร์มสร้างแคมเปญกับ ADM-7 (spec 08) ตัวที่ merge ทีหลัง rebase; ไม่บล็อก release |
| GB-N7 | (test-only comment ~2 LOC, รอบ 19 — nit review #269) comment เหนือ assertion ข้อความ "percentage number between 0 and 100" ว่ายืนยันการล้มหลัง lock ไม่ใช่ที่ zod (กฎข้อ 38; AC-57) — ไฟล์: `backend/integration-tests/http/group-buy-campaigns.spec.ts` — ☑ #274 | none — **เริ่มได้** (GB-N6 ☑ #269); ∥ ทุกตัว; ไม่บล็อก release — ถ้ามี PR อื่นแตะไฟล์นี้ก่อน รวมเข้า PR นั้นได้แล้วปิด GB-N7 |
| GB-15 | (admin เล็ก ~40 LOC รวม test, รอบ 20 — owner เลือกทาง (ก) 2026-11-04) key ของฟอร์มสร้างแคมเปญสร้างด้วย `crypto.getRandomValues` ผ่าน helper `newIdempotencyKey()` (รูป UUID v4) แทน `crypto.randomUUID()` ที่ใช้ไม่ได้บน http (กฎข้อ 33d; AC-58) — ไฟล์: `src/admin/lib/group-buy-form.ts` (+ `src/admin/lib/__tests__/group-buy-form.unit.spec.ts`), `src/admin/components/group-buy/create-campaign.tsx` (`openModal` + comment ~49); ไม่แตะ backend/`package.json` — ☑ #285 (train #290) | none — **เริ่มได้** (GB-13 ☑ #259); ∥ ทุกตัว; ชน `create-campaign.tsx` กับ ADM-7 (spec 08, ☐) ตัวที่ merge ทีหลัง rebase; **ควรมีก่อน release v0.5.0** (admin ที่เปิดผ่าน http สร้างแคมเปญไม่ได้เลย) |
| GB-16 | (backend เล็ก ~20 LOC, รอบ 26 — follow-up รอบ 25) filter ของ job `group-buy-deadline` รวมสถานะกลุ่ม `succeeded` ให้ใช้ index `(status, pay_deadline_at)` (กฎข้อ 39; AC-59) — ไฟล์: `src/jobs/group-buy-deadline.ts` (+ unit) — ☑ #357 | none — **เริ่มได้**; ∥ ทุกตัว; ไม่บล็อก release |
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
(รอบ 12) สถานะ: PAY-3a ☑ #157, GB-N3 ☑ #161, GB-5 ☑ #185; PAY-3b1 ◐ #189 → PAY-3b2 ☐ → GB-7 (← ทั้งสอง + AF-16); GB-9 ∥ GB-10 เริ่มได้ (backend; ไม่บล็อก GB-7 แต่ควร merge ก่อน release v0.5.0);
review #185: test "convert ล้มเพราะสต็อกหมด" มีแล้วใน #185 (ไม่ต้องมี task); owner ตอบแล้ว 2026-10-28: Q13 (ก), Q14 (ก), spec 05 Q19 (ข) → กฎข้อ 27 + AF-16
(รอบ 13, 2026-11-03) สถานะ: GB-9 ◐ #196, AF-16 ☑ #197 (spec 05), PAY-3b1 ☑ #189, PAY-3b2 ◐ #203 (spec 06); GB-10 ← #196 (รวม follow-up ของ #196); GB-7 ← PAY-3b2 (AF-16 ☑)
(รอบ 14, 2026-11-03) GB-7 แยก: GB-7b ◐ #223 (PAY-3b2 ☑ #203; ไม่ใช้ route สาธารณะ) ∥ GB-11 ☐ เริ่มได้ (backend ล้วน คนละไฟล์กับ GB-10) → GB-7a1 ☐ → (GB-7a2 ☐ ∥ GB-7c ☐);
GB-7a1/GB-7a2/GB-7c ∥ GB-7b; owner ตอบ Q15–Q19 แล้ว (2026-11-03); release v0.5.0 ต้องมี GB-7a1, GB-7a2, GB-7b และ GB-7c
(รอบ 15, 2026-11-03 — 1 แคมเปญ = 1 สินค้า) (GB-6e ☐ ∥ GB-11 ☐ ∥ GB-7a2a ☐) → GB-7a1 ☐ (← GB-11) → (GB-7a2 ☐ (← GB-7a1, GB-7a2a, GB-6e) ∥ GB-7c ☐ (← GB-7a1, GB-7a2a)); ทั้งหมด ∥ GB-7b;
Q20 ตัดสินแล้ว (owner 2026-11-03, กฎข้อ 31d); release v0.5.0 ต้องมี GB-6e และ GB-7a2a ด้วย
(รอบ 16, 2026-11-04) GB-12 ☐ ∥ GB-N4 ☐ เริ่มได้ → GB-13 ☐ (← Q21 = ก และ GB-N4); GB-12 ควรมีก่อน release v0.5.0 (ราคา/ส่วนลดที่ลูกค้าเห็น); งาน spec 01 ที่กระทบ group buy:
CORE-30 (กลับหน้ากลุ่ม/หน้าแรกหลัง login) และ CORE-32 (ซ่อน Digital delivery ของสินค้าที่ต้องจัดส่งบนหน้ากลุ่ม) ควรมีก่อน release v0.5.0
(รอบ 16b, 2026-11-04) merge แล้ว: GB-6e ☑ #231, GB-11 ☑ #230, GB-7a1 ☑ #236, GB-7a2 ☑ #238, GB-7b ☑ #223, GB-7c ☑ #239; GB-12 ◐ (รอบ 17); GB-N4 ☐ → GB-13 ☐ (Q21 = ก แล้ว — เหลือ ← GB-N4);
GB-14 ☐ เริ่มได้ (∥ ทุกตัว, Q-C4 = ข) — GB-12 และ GB-14 ควรมีก่อน release v0.5.0
(รอบ 17, 2026-11-04) GB-12 ◐ #244 (+ กฎข้อ 32e1), GB-N4 ◐ #246, GB-14 ◐ #247; Q22 = (ก) ตัดสินแล้ว; GB-N5 ☐ (← #247, #246) → ไม่บล็อก release; GB-13 ☐ (← GB-N4 #246)
(รอบ 18, 2026-11-04) merge แล้วผ่าน merge train: GB-12 ☑ #244, GB-N4 ☑ #246, GB-14 ☑ #247 (train #250); GB-N5 ☑ #257 (train #260); GB-13 ◐ #259 (อยู่ใน train #261) → GB-N6 ☐ (← #259; ไม่บล็อก release)
(รอบ 19, 2026-11-04) merge แล้ว: GB-13 ☑ #259 (train #261), GB-N6 ☑ #269 (train #270; ข้อ (a) ปิดโดย #259 commit `016f204`); GB-N7 ☐ เริ่มได้ (comment อย่างเดียว ไม่บล็อก release)
(รอบ 20, 2026-11-04) merge แล้ว: GB-N7 ☑ #274 (merge ตรง); ใหม่: GB-15 ☐ เริ่มได้ (∥ ทุกตัว — owner ทาง (ก): `crypto.getRandomValues` แทน `crypto.randomUUID()`);
e2e `group-buy-admin-detail.spec.ts`/`group-buy-admin-dates.spec.ts` ที่ดึง `/admin/products?limit=1` แก้ใน CORE-46 ของ spec 01 (กฎข้อ 104d — e2e hygiene กลุ่มเดียวกัน)
(รอบ 21, 2026-11-04) merge แล้ว: GB-15 ☑ #285 (train #290); qa #285 O-1 (`medusa start` ตั้ง session cookie ของ admin เป็น `Secure` → login ผ่าน http ที่ไม่ใช่ localhost ไม่ติด)
เป็นข้อกำหนดของ prod ไม่ใช่ bug ของ GB-15 → บันทึกใน spec 07 Deliverables ข้อ 11 (ไม่มี task); assertion `toHaveLength(1)` ข้าง `handle=` ของสองไฟล์ข้างบนเข้มขึ้นใน CORE-49 ของ spec 01
(รอบ 30, 2026-11-13) GB-16 ☑ #357 (ปิดรอบ 29); ไม่เปิด task: index ของ `group_buy_membership` ที่ขึ้นต้นด้วย `status` หรือ partial `WHERE status = 'awaiting_payment'` (review #357) — มี index `(group_id, status)` อยู่แล้วและ job `group-buy-deadline`
กรองด้วยกลุ่ม `succeeded` ผ่าน index `(status, pay_deadline_at)` ของกลุ่ม (กฎข้อ 39) → รอวัดบน production ก่อน (แนวเดียวกับ GIN index ของ spec 05 Non-functional); เปิด task เมื่อ `EXPLAIN` บน prod แสดง seq scan ของ membership ที่มีผลจริง

## Open questions
- ~~**Q22**~~ **ตัดสินแล้ว (owner 2026-11-04 รอบ 17) = (ก)** → กฎข้อ 35c เป็นกฎปกติ (cart ไม่มี shipping method เลย → ไม่ตรวจ) ไม่มี task เพิ่ม — คำถามเดิม: (รอบ 16b, GB-14 กฎข้อ 35c) join ด้วย cart ที่มี line ต้องจัดส่งแต่**ไม่มี shipping method เลย**ควรถูกปฏิเสธด้วยไหม (แบบ `validateShippingStep` ของ Medusa):
  (ก) **[แนะนำใน v1]** ไม่ปฏิเสธ (พฤติกรรมเดิม) — storefront (GB-7a2) บังคับเลือกวิธีส่งก่อน join อยู่แล้ว; ปิดเฉพาะช่องที่ qa #238 พบ (วิธีส่งผิด profile) ใน GB-14 ~150 LOC;
  (ข) ปฏิเสธด้วย code เดียวกัน — ตรงกับ Medusa ครบ แต่ต้องแก้ผู้เรียก join ที่ไม่ตั้งวิธีส่งทั้งหมด (integration http ~9 ไฟล์ของ group buy/affiliate, `e2e/support/group-buy.ts`,
  `e2e/group-buy-admin-members.spec.ts`, k6 `tools/load/group-buy-join.js` + `seed-load.ts` ของ gate OPS-4) เพิ่ม ~250 LOC → แยกเป็น task ต่อจาก GB-14 และชน `tools/load/*` กับ OPS-17b/OPS-20b
- ~~**Q21**~~ **ตัดสินแล้ว (owner 2026-11-04) = (ก)** → กฎข้อ 33 เป็นกฎปกติ, กฎข้อ 17 ปรับ, ส่วน idempotent ของ Q10 ถูกแทน; GB-13 ← GB-N4 — คำถามเดิม: (รอบ 16, qa GB-6e #231 O-2 — **ขัดกับคำตัดสิน Q10 ของ owner 2026-10-26** ที่ไม่ทำ `POST /admin/group-buy/campaigns` ให้ idempotent) ยิงพร้อมกันผ่าน API ได้ 2 แคมเปญ `draft`
  (UI กันกดซ้ำแล้วตามกฎข้อ 17): (ก) **[แนะนำ]** ยกเลิกส่วนนั้นของ Q10 แล้วทำกฎข้อ 33 (`idempotency_key` แบบ optional ผ่าน `campaign_identifier` + lock ของ Locking module ไม่เพิ่ม model/infra ~200 LOC)
  — สอดคล้องบทเรียนใน CLAUDE.md "API ที่สร้างข้อมูลต้องกันกดซ้ำ/ยิงพร้อมกัน" และกันกรณี admin กดซ้ำหลัง network ล้ม; (ข) คง Q10 — แคมเปญซ้ำเป็น `draft` ลบได้ ปิด O-2 เป็น "ยอมรับ" และตัด GB-13/AC-52;
  (ค) บังคับ key (required) — ปิดช่องครบ แต่ต้องแก้ผู้เรียกทุกตัว (`seed-load.ts`, helper e2e ~6 ไฟล์, test http) เพิ่ม ~100 LOC
- (บันทึก รอบ 15) **owner ตัดสิน 2026-11-03**: group buy แยกรายสินค้า — 1 แคมเปญมีสินค้าเดียว; หน้ากลุ่มเป็น "ตะกร้าเฉพาะของสินค้านั้น" เลือกได้หลาย variant พร้อมจำนวน
  (เช่น S ×2, M ×1) แยกจากตะกร้าหลัก (สอดคล้อง Q16/Q19) → กฎข้อ 30–31, GB-6e, GB-7a2/GB-7a2a, AC-49..50
- ~~Q20~~ ตัดสินแล้ว (owner 2026-11-03): **ใช้ค่าตั้งต้นทั้งหมด** (ก) ไม่จำรายการข้ามการออกจากหน้า (ข) หลัง join แก้ไม่ได้ใน v1 — leave แล้ว join ใหม่
  (ค) `max_units_per_person` นับรวมทุก variant (ง) คงเป้า orders/units/people — กฎข้อ 31d; คำถามเดิม (รอบ 15, GB-7a2): (ก) **[ค่าตั้งต้น]** รายการที่เลือกบนหน้ากลุ่มไม่จำข้ามการออกจากหน้า (state ในหน้า สร้าง cart ตอนกดยืนยัน)
  — ไม่มี cart ค้างจากคนที่แค่ดู; ทางเลือก: จำใน cookie/localStorage; (ข) **[ค่าตั้งต้น]** หลัง join แก้รายการไม่ได้ใน v1 (leave แล้ว join ใหม่ — GB-3b มีแล้ว) — แก้ draft order ต้องใช้ order edit
  ของ Medusa + ปรับตัวนับใต้ lock (task backend ใหม่); (ค) **[ค่าตั้งต้น]** `max_units_per_person` นับรวมทุก variant (ตาม backend เดิม กฎข้อ 4) — ทางเลือก: จำกัดต่อ variant ต้องเพิ่ม config;
  (ง) **[ค่าตั้งต้น]** คงเป้า `orders`/`units`/`people` ทั้งหมด — ทางเลือก: ตัด `orders` (หลาย variant ใน 1 order ทำให้ orders ≈ people ถ้าลูกค้าไม่สั่งซ้ำ)
- ~~Q15–Q18~~ ตัดสินแล้ว (owner 2026-11-03): **Q15** ต่างจากข้อเสนอ — แสดงทุกแคมเปญ (flash + group buy) บนหน้าแรก `/<cc>` ไม่มีหน้า `/group-buy` แยก หน้ากลุ่มคง `/<cc>/g/<token>`
  (กฎข้อ 29a, GB-7c); **Q16** ต่างจากข้อเสนอ = (ข) join ด้วย cart ใหม่เฉพาะสินค้าที่เลือก ไม่แตะ cart ปัจจุบัน (กฎข้อ 14c, 29c, GB-7a — ไม่ต้องมี backend เพิ่ม); **Q17** = (ก) ข้อความไทยต่อ code
  (กฎข้อ 29f — ถ้อยคำปรับตาม Q16); **Q18** = (ก) สร้างทีมแล้วพาไปหน้าทีมที่มี `group-share-link` ผู้สร้าง join เอง (กฎข้อ 29g) — คำถามเดิมด้านล่าง
- ~~Q19~~ ตัดสินแล้ว (owner 2026-11-03): ให้ลูกค้าเลือกที่อยู่ที่บันทึกไว้ + วิธีส่งของ region บนหน้ากลุ่มก่อน join แล้วใส่ลง cart ใหม่ด้วย API ของ Medusa (กฎข้อ 29c, GB-7a2, AC-28);
  ไม่มีที่อยู่ → ปุ่ม join disabled + ลิงก์ไปเพิ่มที่อยู่; ไม่เพิ่ม backend — คำถามเดิม (review #224, blocker): cart ใหม่ของ Q16 ไม่มี `shipping_address`/`shipping_methods` (Medusa 2.22.1
  ไม่เติมที่อยู่ default) และ `createGroupDraftOrderStep` คัดลอกจาก cart ตรงๆ → draft order ไม่มีที่อยู่/ค่าส่ง fulfill ไม่ได้หลังแปลง (ขัด ADR-004)
- (คำถามเดิม) **Q15** (รอบ 14, GB-7a) path ของหน้าแคมเปญและหน้ากลุ่มใน storefront: (ก) **[แนะนำ]** หน้าเดียวรวมแคมเปญ `/<cc>/group-buy` (การ์ด `group-campaign-card` ต่อแคมเปญ:
  ส่วนลด, `ends_at`, สินค้าใน scope จาก `/store/products`, รายการ pool group, ปุ่ม "สร้างทีม") + หน้ากลุ่ม `/<cc>/g/<token>` — ลิงก์แชร์ `/g/<token>` ถูก middleware ของ storefront redirect เป็น
  `/<cc>/g/<token>` อยู่แล้ว (redirect ทั่วไปที่เติม country) จึงไม่ต้องแก้ middleware; ใช้ GB-11 ครบโดยไม่ต้องมี route รายแคมเปญ; (ข) เพิ่มหน้ารายแคมเปญ `/<cc>/group-buy/<campaign_id>`
  — ต้องเพิ่ม route `GET /store/group-buy/campaigns/:id` ใน GB-11 (~60 LOC) และอีกหนึ่งหน้า
- **Q16** (รอบ 14, GB-7a) join ใช้ cart ไหน: (ก) **[แนะนำ]** cart ปัจจุบันของลูกค้า (cookie `_medusa_cart_id`) ตามดีไซน์หลักข้อ 1 และกฎข้อ 14c (ล้าง cart นี้หลัง join);
  cart ว่าง/ไม่มี cart → ปุ่ม `group-join-button` disabled พร้อมข้อความ "เพิ่มสินค้าในแคมเปญลงตะกร้าก่อน" และแสดงสินค้าใน `product_ids` ให้กดเพิ่มลงตะกร้าด้วยปุ่มเพิ่มตะกร้าเดิม
  (ไม่มี flow สร้าง cart ใหม่); cart มีสินค้านอก scope → ให้ backend ตอบ 409 `GB_ITEMS_NOT_ELIGIBLE` (ไม่ตรวจซ้ำฝั่ง client); (ข) ปุ่ม "เข้าร่วมด้วยสินค้านี้" สร้าง cart แยกเฉพาะสินค้านั้น
  (แบบ `/buy/[items]`) — ไม่แตะตะกร้าหลัก แต่ต้องมี cart สองใบ/ตัวเลือก variant ในหน้ากลุ่ม (~150 LOC) และต้องกันไม่ให้ cart แยกไปทับ cookie ของ cart หลัก
- **Q17** (รอบ 14, GB-7a) error ของ join แสดงข้อความไทยแยกต่อ code หรือไม่: (ก) **[แนะนำ]** แยก — map ใน helper เดียว แสดงใน `group-join-error`: `GB_ALREADY_IN_OTHER_GROUP` "คุณอยู่ในกลุ่มอื่นของแคมเปญนี้แล้ว",
  `GB_GROUP_FULL` "กลุ่มนี้เต็มแล้ว", `GB_MAX_TOTAL_ORDERS_REACHED` "แคมเปญนี้ครบจำนวนออเดอร์แล้ว", `GB_UNITS_LIMIT_EXCEEDED` "เกินจำนวนชิ้นสูงสุดต่อคน (<max_units_per_person> ชิ้น)",
  `GB_ITEMS_NOT_ELIGIBLE` "ตะกร้ามีสินค้าที่ไม่ร่วมแคมเปญ", `PROMOTION_NOT_COMBINABLE` "ตะกร้ามีโค้ดส่วนลดอื่น กรุณานำออกก่อน", `GB_CART_ALREADY_JOINED` "ตะกร้านี้เข้าร่วมกลุ่มแล้ว" (+ ล้าง cart ตามกฎข้อ 14c),
  400 `not_allowed` "กลุ่มหรือแคมเปญนี้ปิดรับแล้ว", code อื่น/5xx "เข้าร่วมไม่สำเร็จ กรุณาลองใหม่" — ใช้รูปแบบ `{ ok } | { error }` ของ CORE-4i ถ้า merge แล้ว; unit ตรวจว่าทุก code ให้ข้อความต่างกันและเป็นอักษรไทย;
  ลูกค้าแก้ปัญหาเองได้ (นำโค้ดออก/ลดจำนวน) จึงคุ้มกว่าข้อความรวม; (ข) ข้อความรวมเดียว — โค้ดน้อยกว่าเล็กน้อยแต่ลูกค้าไม่รู้ว่าต้องแก้อะไร
- **Q18** (รอบ 14, GB-7a) หลังกด "สร้างทีม": (ก) **[แนะนำ]** สร้างทีมอย่างเดียว (`POST /store/group-buy/groups`) แล้วพาไปหน้ากลุ่มของทีมใหม่ที่มี `group-share-link` (คัดลอกลิงก์ `/g/<token>`)
  และปุ่ม `group-join-button` ให้ผู้สร้าง join เองเหมือนสมาชิกคนอื่น — backend แยกสร้าง/join อยู่แล้ว (GB-3), ไม่ต้องจัดการกรณีสร้างสำเร็จแต่ join ล้ม (เช่น cart ว่าง/นอก scope)
  และผู้สร้างแชร์ก่อนมี cart ได้; ทีมที่ไม่มีใครเข้าร่วมหมดเวลาแล้ว fail เองโดยไม่มี draft order; (ข) สร้างแล้ว join ทันทีด้วย cart ปัจจุบัน — คลิกน้อยกว่า แต่ถ้า join ล้มจะเหลือทีมว่างและต้องแสดงสองสถานะ
- ~~Q13~~ ตัดสินแล้ว (owner 2026-10-28): **(ก)** manual ใน v1 — alert + runbook (กฎข้อ 25, GB-9) + GB-10; ไม่มี job ลองแปลงใหม่/refund อัตโนมัติ; คำถามเดิม (รอบ 12, review #185): เงินถูก capture แต่ไม่มี order ที่ใช้ได้ (GB-5 ตอนนี้ทำแค่ ops alert + runbook — ops ตัดสิน refund หรือเติมสต็อกแล้วแปลงเอง):
  (1) แปลงไม่สำเร็จ (เช่นสต็อกหมด) → membership ค้าง `awaiting_payment` + collection `completed`; (2) เงินเข้าหลัง membership ถูกยกเลิกเพราะหมดเวลา (พร้อมเพย์จ่ายช้า) ทางเลือก:
  (ก) **[แนะนำ] คงแบบ manual ใน v1** (alert + runbook ของกฎข้อ 25 + GB-10 อัปเดต membership เมื่อ ops แปลงเอง) — เหตุผล: สาเหตุหลักของ (1) คือสต็อกหมดซึ่งลองซ้ำไม่ช่วยจนกว่าจะเติมสต็อก
  และต้องมีคนเลือกว่าจะคืนเงินหรือส่งของ; ปริมาณช่วงแรกน้อย; ไม่มีโค้ดเงินอัตโนมัติเพิ่ม;
  (ข) job ลองแปลงใหม่ทุก N นาทีสูงสุด K ครั้งสำหรับ membership `awaiting_payment` + collection `completed` แล้วค่อย alert — ช่วยกรณีล้มชั่วคราว (DB/lock) ~150 LOC;
  (ค) refund อัตโนมัติสำหรับกรณี (2) ผ่าน `refundPaymentWorkflow` + อีเมลแจ้งลูกค้า — ลูกค้าได้เงินคืนเร็ว แต่เพิ่มเส้นทางเงินอัตโนมัติที่ต้องกันซ้ำ/ทดสอบกับ Stripe ~250 LOC
  ((ข) และ (ค) เลือกร่วมกันได้)
- ~~Q14~~ ตัดสินแล้ว (owner 2026-10-28): **(ก)** ใช้ `order-placed` (กฎข้อ 9); คำถามเดิม (รอบ 12, review #185) อีเมล "ได้รับการชำระเงินแล้ว" (กฎข้อ 9): (ก) **[แนะนำ] ใช้อีเมล `order-placed` ที่ส่งหลังแปลง draft (ตามที่ GB-5 ทำ) ใน v1** แล้วบันทึกเป็นกฎ —
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
  และไม่ทำ `POST /admin/group-buy/campaigns` ให้ idempotent (route ของ admin เท่านั้น แคมเปญที่ซ้ำเป็น `draft` ลบได้) — กฎข้อ 15, 17 (**ส่วน "ไม่ทำให้ idempotent" ถูกแทนโดย Q21 = (ก) owner 2026-11-04** → กฎข้อ 33/GB-13; ส่วน backend validator ของ `max_quantity` ยังคงตามคำตัดสินเดิม)
- ~~Q11~~ ตัดสินแล้ว (owner ยืนยัน 2026-10-27): (ก) ยอมรับ lock TTL 60s ของ succeed/fail ใน v1 (pool จริงช่วงแรกเล็ก และ idempotent ต่อ membership) — กฎข้อ 19
  ไม่มี task; ทบทวนใหม่เมื่อมี pool ที่สมาชิกมากจนประมวลผลเกิน TTL (ทางเลือก (ข) แบ่งชุด ≤ 50 ต่อ lock เป็นทางแรกที่ควรพิจารณา)
