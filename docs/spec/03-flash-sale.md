# 03 Flash sale — time-limited discount campaigns

Status: draft
Goal (owner): run flash-sale campaigns that discount products for a limited time to drive purchases.
Decision: build on the Medusa **Promotion module** (ADR-003). No separate discount engine.
Out of scope: scheduled price-list changes (use Promotion), per-SKU countdown timers on PLP
beyond campaign level (v2), notification blasts.

## What Medusa already gives us
| Need | Medusa provides | Use |
|------|-----------------|-----|
| Discount % or fixed, per item / order / shipping | Promotion `application_method` | as-is |
| Target products/collections/categories | Promotion target rules | as-is |
| Start/end time | **Campaign** `starts_at` / `ends_at` | as-is |
| Total budget (spend or usage count) | Campaign `budget` (type `spend` / `usage`) | as-is |
| Automatic (no code) application | Promotion `is_automatic` | as-is |
| Max discounted units per cart line | `application_method.max_quantity` | as-is |
| Admin CRUD UI | Admin Promotions/Campaigns pages | as-is + widget |
| Strikethrough price on storefront | Starter shows `original_price` vs `calculated_price` only for price lists | **gap** → store API returns promotion preview |

Gaps we fill (thin):
1. **Per-customer cap** across the campaign (e.g. max 2 units per customer) — Promotion has
   per-cart `max_quantity` but no per-customer limit. Custom module `flash_sale` keeps a
   usage counter keyed by `(campaign_id, customer_id)` and a cart-validation workflow hook.
2. **Storefront countdown + "flash price" display** on PLP/PDP — needs a store endpoint
   that returns active flash campaigns and the would-be discounted price for a variant.
3. **Flash stock display** ("12 left") — optional; backed by campaign `usage` budget remaining.

## Data model (module `flash_sale`)
```
FlashSaleConfig
  id, campaign_id (link → promotion campaign), per_customer_limit: int?, total_cap: int?,
  units_sold: int (atomic), show_countdown: bool, show_remaining: bool, banner_text: text?

FlashSaleUsage
  id, campaign_id, customer_id, units: int   // unique (campaign_id, customer_id)
```
Link: `flash_sale_config ↔ promotion_campaign`.

## Workflows / hooks
- Hook into `completeCartWorkflow` **validation** step: if cart has a promotion belonging to a
  flash campaign: (a) per-customer: `units_in_cart + FlashSaleUsage.units <= limit` else
  `FLASH_LIMIT_EXCEEDED`; (b) total cap: atomically reserve from `FlashSaleConfig.units_sold`
  (`UPDATE ... SET units_sold = units_sold + n WHERE units_sold + n <= total_cap`) else
  `FLASH_SOLD_OUT`. Medusa's campaign budget is not atomic across concurrent carts, so our
  counter is the source of truth for "exactly N"; the campaign budget is set equal as a backstop.
- Subscriber on `order.placed`: increment `FlashSaleUsage` atomically
  (`INSERT ... ON CONFLICT DO UPDATE SET units = units + n`). Idempotent via
  `order_id` processed-set (table or Redis SET with TTL).
- Subscriber on order cancel/refund: decrement.

## API
- Store: `GET /store/flash-sales/active?region_id=&variant_ids[]=` → campaigns
  (id, name, starts_at, ends_at, banner_text, remaining_usage?) and per-variant
  `flash_price` computed via Promotion module's compute API on a synthetic cart line.
- Admin: `GET/POST /admin/flash-sales/:campaign_id/config`.

## Admin UI / Storefront
- Admin: widget on Campaign detail page: "Flash sale options" (per-customer limit,
  countdown, remaining, banner). Campaign/promotion creation stays in Medusa's UI.
- Storefront: campaign banner with countdown; PDP shows flash price + strikethrough +
  "ends in"; cart shows discount line (starter does this already).

## Business rules
1. A flash sale = one Medusa Campaign with ≥1 automatic promotion. Time window is the campaign's.
2. Discount is applied by Medusa at cart level; our code never computes discount amounts.
3. Per-customer limit counts **ordered** units (not carted), keyed by `customer_id`
   (login is required store-wide, spec 01).
4. When campaign budget (`usage`) is exhausted, Medusa stops applying the promotion; the
   storefront shows "Sold out" when `remaining_usage == 0`.
5. Times entered in Bangkok time in admin, stored UTC.
6. **Exclusivity** (owner): a cart receiving a flash-sale promotion may not hold any other
   promotion code, and a code cannot be applied to a cart with an active flash promotion
   (error `PROMOTION_NOT_COMBINABLE`). Implemented once as a hook on
   `updateCartPromotionsWorkflow` + `completeCartWorkflow` validation (task PROMO-1), shared
   with group buying (spec 04 rule 7). Builder must first check whether the Medusa Promotion
   module version in use has native exclusivity; if so, configure it and skip the hook.

## Acceptance criteria
- AC-1 Given an active campaign (−20% on collection X, automatic), when a customer adds X
  item, cart shows discounted total; after `ends_at`, a new cart shows full price.
- AC-2 Given `per_customer_limit=2`, when a customer who already ordered 2 units tries to
  complete a cart with 1 more, then checkout fails with `FLASH_LIMIT_EXCEEDED`.
- AC-3 Given `total_cap=10`, when 10 units are ordered, the 11th checkout fails with `FLASH_SOLD_OUT`.
- AC-4 `GET /store/flash-sales/active` returns countdown data and `flash_price` for variants
  in the campaign; PDP renders countdown and strikethrough (screenshot).
- AC-5 Given a cancelled order with 2 flash units, the customer's usage decreases by 2.
- AC-6 Processing the same `order.placed` event twice increments usage once.
- AC-8 Given a cart with flash promotion applied, applying code `SAVE10` returns
  `PROMOTION_NOT_COMBINABLE`; a cart with `SAVE10` adding a flash item keeps `SAVE10` and
  gets no flash discount (code wins unless removed) — screenshot of the storefront message.
- AC-7 50 concurrent checkouts by distinct customers under `total_cap=20` → exactly 20 succeed
  (integration concurrency test).

## Non-functional
- Usage increments in worker, not request path.

## Test plan
- Unit: limit math, time-window helpers.
- Integration (http): AC-1, AC-2, AC-3, AC-5, AC-6, AC-7.
- e2e: AC-4 (PLP/PDP/cart screenshots at T-1min and T+1min using clock control).

## Tasks
| ID | Task | Depends |
|----|------|---------|
| PROMO-1 | Shared promotion-exclusivity hook (flash + group-buy promotions vs other codes) + tests (AC-8) | CORE-2 |
| FS-1 | Module `flash_sale` models/service/link/migration + unit tests | CORE-2 |
| FS-2 | Usage subscribers (placed/cancel/refund) idempotent + tests (AC-5, AC-6) | FS-1 |
| FS-3 | Cart completion validation hook: per-customer limit + atomic total cap (AC-2, AC-3, AC-7) | FS-1 |
| FS-4 | Store endpoint `/store/flash-sales/active` with promotion price preview (AC-4 API) | FS-1 |
| FS-5 | Admin campaign widget | FS-1 |
| FS-6 | Storefront banner/countdown/PDP price + not-combinable message + e2e (AC-1, AC-3, AC-4, AC-8 UI) | FS-4, PROMO-1 |
FS-2 ∥ FS-3 ∥ FS-4 ∥ FS-5 after FS-1.

## Open questions
- none (guest question resolved: login required store-wide)
