# Data model (module ที่สร้างเอง)

entity หลักของ Medusa (Product, Variant, Cart, Order, Promotion, Campaign, Payment, Customer) ใช้ตามเดิมและไม่นิยามซ้ำในเอกสารนี้ จำนวนเงินเป็นหน่วยหลักตามแบบ Medusa (`bigNumber`)


## module `evoucher`


### EvoucherPartner
เจ้าของ voucher เช่น Lotus, Big C, ห้าง, ร้านกาแฟ

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | id |  |
| `name` | string |  |
| `logo_url` | string? |  |
| `terms_url` | string? |  |
| `support_contact` | string? |  |

### EvoucherPool
คลังโค้ดของ partner 1 คลังต่อ 1 variant — จำนวน available = สต็อกใน Medusa inventory

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | id |  |
| `partner_id` | fk |  |
| `variant_id` | link → product_variant | unique |
| `name` | string |  |
| `face_value` | bigNumber? | หน่วยบาท |
| `validity_note` | text? |  |
| `how_to_use` | text | แสดงในอีเมล |
| `low_stock_threshold` | int | default 20 |

### EvoucherCode
โค้ดที่ import จาก partner 1 แถวต่อ 1 โค้ด — เราไม่แลกเอง

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | id |  |
| `pool_id` | fk | index (pool_id, status) |
| `code` | string | เข้ารหัส, unique ต่อ pool |
| `pin` | string? | เข้ารหัส |
| `expires_at` | timestamptz? | จาก partner |
| `batch_ref` | string | รอบ import |
| `status` | enum available | allocated | delivered | void |  |
| `order_id / order_line_item_id / customer_id` | fk? | เมื่อถูกจัดสรร |
| `allocated_at / delivered_at` | timestamptz? |  |
| `delivered_to_email` | string? |  |

## module `flash_sale`


### FlashSaleConfig
ตัวเลือกเพิ่มของ Medusa Campaign ที่เป็น flash sale

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | id |  |
| `campaign_id` | link → promotion_campaign | unique |
| `per_customer_limit` | int? | ชิ้นต่อคนทั้งแคมเปญ |
| `total_cap` | int? | จำนวนชิ้นรวม |
| `units_sold` | int | counter แบบ atomic |
| `show_countdown / show_remaining` | bool |  |
| `banner_text` | text? |  |

### FlashSaleUsage
นับชิ้นที่ลูกค้าซื้อไปแล้วต่อแคมเปญ

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | id |  |
| `campaign_id` | fk |  |
| `customer_id` | fk → customer |  |
| `units` | int |  |
| `(campaign_id, customer_id)` |  | unique |

## module `group_buy`


### GroupBuyCampaign
แคมเปญรวมกลุ่ม — ส่วนลด/ช่วงเวลา/สินค้า อยู่ที่ Medusa campaign+promotion ที่ลิงก์ไว้

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | id |  |
| `name` | string |  |
| `promotion_campaign_id` | link → promotion_campaign |  |
| `target_type` | enum orders | units | people |  |
| `target_value` | int |  |
| `max_total_orders` | int? | ทั้งแคมเปญ |
| `max_units_per_person` | int? |  |
| `max_people_per_group` | int? |  |
| `group_mode` | enum pool | team | both | ใครสร้างกลุ่มได้ |
| `team_duration_hours` | int? |  |
| `pay_within_hours` | int | default 24 |
| `status` | enum draft | active | ended |  |

### GroupBuyGroup
กลุ่ม 1 กลุ่ม = โค้ดส่วนลด 1 โค้ด (GB-token)

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | id |  |
| `campaign_id` | fk |  |
| `kind` | enum pool | team |  |
| `created_by_customer_id` | fk? | team เท่านั้น |
| `name` | string? |  |
| `join_token` | string | unique, ลิงก์แชร์ |
| `promotion_id` | link → promotion |  |
| `starts_at / ends_at` | timestamptz | index (status, ends_at) |
| `status` | enum open | succeeded | failed |  |
| `succeeded_at / pay_deadline_at` | timestamptz? |  |
| `progress_orders / units / people` | int | denormalized ภายใต้ lock ของกลุ่ม; นับ membership ที่ไม่ใช่ cancelled (people = ลูกค้าไม่ซ้ำ) |
| `(status, pay_deadline_at)` |  | index |

### GroupBuyMembership
การเข้าร่วม 1 ครั้ง = draft order 1 ใบ; ลูกค้าเดียวมีได้หลายแถวในกลุ่มเดียว แต่อยู่ได้กลุ่มเดียวต่อแคมเปญ
(ตรวจใน `joinGroupWorkflow` ภายใต้ lock ไม่ใช่ unique index — ADR-009)

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | id |  |
| `campaign_id` | fk | denormalized จากกลุ่มตอน join, ไม่เปลี่ยน |
| `group_id` | fk |  |
| `customer_id` | fk → customer |  |
| `order_id` | text, read-only link → order (draft) | unique; `defineLink` แบบ `readOnly` ผ่าน field นี้ ไม่มี link table |
| `units` | int |  |
| `joined_at` | timestamptz |  |
| `status` | enum joined | awaiting_payment | paid | cancelled |  |
| `(campaign_id, customer_id)` |  | index (ไม่ unique) |
| `(group_id, status)` |  | index (ไม่ unique) |

## module `affiliate`


### Affiliate
actor type แยก (Auth module) — ไม่ใช่ customer

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | id |  |
| `email` | string | unique |
| `name` | string |  |
| `code` | string | slug ที่ unique, index |
| `status` | enum pending | active | suspended |  |
| `payout_info` | json | masked ใน API |
| `auth_identity.app_metadata.affiliate_id` | (Auth module) | ลิงก์ login |

### AffiliateProgram
ช่วงเวลาที่เปิดค่าคอม

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | id |  |
| `name` | string |  |
| `starts_at / ends_at` | timestamptz |  |
| `status` | enum draft | published | ended | active/upcoming คำนวณจากช่วงเวลา |
| `announce_text` | text? | ข้อความ coming soon |
| `commission_type` | enum percentage | v1 |
| `commission_value` | bigNumber |  |
| `scope` | json {all | variant_ids | collection_ids | category_ids} |  |
| `attribution_window_days` | int | default 7 |
| `cap_per_order` | bigNumber? |  |
| `hold_days` | int | default 14 |

### AffiliateAttribution
order ไหน ให้เครดิตใคร ภายใต้โปรแกรมไหน (last click)

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | id |  |
| `order_id` | fk → order | unique |
| `affiliate_id` | fk |  |
| `program_id` | fk |  |
| `attributed_at` | timestamptz |  |

### CommissionEntry
ledger แบบ append-only; reversal = แถวใหม่ติดลบ

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | id |  |
| `affiliate_id / program_id / order_id` | fk | index (affiliate_id, status, created_at) |
| `line_item_id` | fk? |  |
| `amount` | bigNumber | ลบได้สำหรับ reversed |
| `currency` | string | THB |
| `status` | enum pending | approved | reversed | paid |  |
| `reason` | string? |  |
| `created_at / matures_at` | timestamptz |  |

### Payout
รอบจ่ายเงินที่แอดมินสร้างและมาร์คว่าจ่ายแล้ว

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | id |  |
| `affiliate_id` | fk |  |
| `amount` | bigNumber |  |
| `currency` | string |  |
| `period_from / period_to` | date |  |
| `status` | enum draft | paid |  |
| `paid_at` | timestamptz? |  |
| `reference` | string? | เลขอ้างอิงโอน |
| `entry_ids` | id[] |  |
