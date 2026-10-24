# 02 E-voucher — reselling partner voucher codes, delivered by email

Status: draft (revised 2026-10-25: vouchers are partners' codes, not ours; no redemption)
Goal (owner): sell e-vouchers from partners (Lotus, Big C, malls, cafés…). We receive the
coupon codes from the partner in advance and deliver one code per unit sold, digitally
(email). Redemption happens at the partner; we never redeem.
Out of scope: redemption/validation API, generating our own codes, partner API integrations
for live code fetch (v2: a `CodeSource` provider interface can be added when a partner
offers an API), resale/transfer between customers.

## What Medusa already gives us
| Need | Medusa provides | Use |
|------|-----------------|-----|
| Sellable product/variant with price | Product + Pricing | as-is; variant linked to a code pool |
| Stock = number of unsold codes | Inventory module | **use it**: pool import adjusts the variant's inventory level; Medusa reserves/decrements on order as usual |
| Order, line items | Order module | as-is |
| "Deliver" step | Fulfillment module + custom fulfillment provider `digital` | custom provider (instant) |
| Send email | Notification module | as-is, new template |
| Trigger after payment | `payment.captured` event + subscriber | subscriber |
| Admin product UI | Admin widgets on product/variant page | widget |
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
Links: `evoucher_pool ↔ product_variant`, `evoucher_code ↔ order` (for admin order tab).

## Workflows
- `importEvoucherCodesWorkflow(pool, file)` (admin): parse CSV (`code,pin?,expires_at?`),
  reject duplicates within pool, insert `available` rows with `batch_ref` (compensation:
  delete batch) → adjust the variant's Medusa inventory level by `+inserted`
  (compensation: `-inserted`). Returns inserted / skipped-duplicate counts.
- `allocateAndDeliverEvouchersWorkflow(order_id)` on `payment.captured`:
  for each voucher line item × quantity: atomically claim one code
  (`UPDATE evoucher_code SET status='allocated', order_id=… WHERE id = (SELECT id … WHERE
  pool_id=? AND status='available' AND (expires_at IS NULL OR expires_at > now()+interval '7 days')
  ORDER BY expires_at NULLS LAST LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`)
  (compensation: release to `available`) → create fulfillment via provider `digital`
  (compensation: cancel) → send `evoucher.delivered` email with codes, pins, partner
  how-to-use, expiry → mark `delivered`. Idempotent: skip line items already allocated.
  If no code is available (stock drifted): mark line item `backordered` in metadata, email
  admin, do not fail the order.
- Scheduled job daily: `available` codes with `expires_at < now + 7 days` → `void`
  (reason `expiring`) and decrement inventory; email admin summary. Low-stock email when
  `available < low_stock_threshold`.
- Admin `resendEvoucherEmailWorkflow(order_id)`.
- Admin `voidCodeWorkflow(code_id, reason)` for `available` codes only (adjusts inventory).

## API
- Admin: CRUD `/admin/evoucher/partners`, CRUD `/admin/evoucher/pools`,
  `POST /admin/evoucher/pools/:id/import` (multipart CSV), `GET /admin/evoucher/pools/:id/codes?status=`,
  `POST /admin/evoucher/codes/:id/void`, `POST /admin/evoucher/orders/:id/resend`.
  Code values are returned **only** on `GET .../codes/:id/reveal` (audited).
- Store (customer auth): `GET /store/customers/me/evouchers` → own delivered codes
  (code, pin, partner, how-to-use, expiry). No redeem endpoint.

## Admin UI / Storefront
- Admin route page "E-vouchers": partners, pools (variant, available / allocated /
  delivered / void counts, low-stock badge), import CSV with result summary, code list
  (masked), reveal with audit log.
- Admin widget on variant page: "Voucher pool" (partner, face value, stock from pool).
- Admin order page tab: delivered codes (masked) + resend.
- Storefront: PDP shows partner, how-to-use, "delivered by email"; account "My vouchers"
  shows code + pin (copy button), partner logo, expiry; digital-only checkout as before.

## Business rules
1. A variant is a voucher iff it has an `EvoucherPool`; `requires_shipping=false`,
   `manage_inventory=true` with inventory kept equal to `available` codes.
2. Codes are allocated only after payment **captured**, oldest-expiry first, never a code
   expiring within 7 days.
3. One code per unit; qty 3 → 3 codes in one email.
4. Codes/PINs encrypted at rest (app-level, key from env); masked in lists; reveal is audited.
5. **No redemption on our side**; the email states where and how to use it at the partner.
6. Refund policy: delivered codes are not refundable automatically (we cannot reclaim them).
   Admin may refund manually; the code stays `delivered`. Allocated-but-undelivered codes
   on a cancelled order are released to `available`.
7. Expiry is the partner's; we display it and stop selling codes 7 days before.

## Acceptance criteria
- AC-1 Admin imports a CSV of 100 codes (2 duplicates) → 98 `available`, variant inventory +98,
  response reports 2 skipped.
- AC-2 Given a voucher variant qty 2 in cart, when payment is captured, then 2 codes become
  `delivered` with the order id, and one email to the customer contains both codes, PINs,
  partner how-to-use and expiry.
- AC-3 Given a cart with only voucher items, checkout needs no address; the free "Digital
  delivery" method is auto-applied; total has ฿0 shipping.
- AC-4 Given 1 `available` code, two orders of qty 1 captured concurrently → exactly one gets
  the code; the other is flagged backordered and admin is emailed.
- AC-5 Codes expiring in < 7 days are never allocated; the daily job voids them and
  decrements inventory.
- AC-6 Customer "My vouchers" shows only own codes, with copy buttons; another customer gets 404.
- AC-7 Re-running the allocation workflow for the same order allocates no extra codes and
  sends no extra email.
- AC-8 Code list API returns masked codes; reveal endpoint returns the value and writes an
  audit row (who, when, code id).
- AC-9 Available count below threshold → one low-stock email per day per pool.

## Non-functional
- Allocation runs in a subscriber (worker), not in the checkout request.
- Import handles 50k rows in < 60s (batched inserts).
- Email template in Thai and English; partner logo + how-to-use block.

## Test plan
- Unit: CSV parser, masking, expiry filter, encryption round-trip.
- Integration (modules): concurrent allocation (AC-4), idempotency (AC-7).
- Integration (http): AC-1, AC-2, AC-5, AC-8, AC-9 with notification provider mocked.
- e2e: AC-3, AC-6.

## Tasks
| ID | Task | Depends |
|----|------|---------|
| EV-1 | Module models (partner, pool, code) + encryption + link to variant + migrations + unit tests | CORE-2 |
| EV-2 | Import workflow + inventory adjust + admin partner/pool/import APIs (AC-1, AC-8) | EV-1 |
| EV-3 | Fulfillment provider `digital` + digital-delivery shipping option seed | EV-1 |
| EV-4 | Allocate & deliver workflow + subscriber + email template (AC-2, AC-4, AC-7) | EV-2, EV-3, CORE-3 |
| EV-5 | Daily expiry/void + low-stock jobs; void & resend admin APIs (AC-5, AC-9) | EV-2 |
| EV-6 | Admin UI: route page (partners, pools, import, codes masked/reveal) + variant widget + order tab | EV-2 |
| EV-7 | Storefront: PDP partner block, digital-only checkout, My vouchers + e2e (AC-3, AC-6) | EV-4 |
EV-3 ∥ EV-2 after EV-1; EV-5 ∥ EV-6 after EV-2.

## Open questions
- Q1 Do partners provide a PIN with the code, or code only? (model supports both)
- Q2 Expiry: per code (in CSV) or per batch? (default: per code column, optional)
- Q3 Should admin be able to re-sell a code from a refunded order? (default: no)
