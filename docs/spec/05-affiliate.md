# 05 Affiliate — commission with time-boxed windows

Status: draft
Goal (owner): affiliate program where commission is enabled for **periods** (campaign-style,
like TikTok/Shopee "pin product" affiliate), not permanently. Single merchant, not a marketplace.
Decision: custom module `affiliate` (ADR-005). Attribution via tracked link → cookie →
cart metadata. Payout execution (bank transfer) is **manual** by admin; we produce the ledger.
Owner requirement: affiliates must **see which products earn commission now or soon**, and
**share** them (per-product links) — the TikTok/Shopee "product showcase" experience.
Out of scope: automated payouts, multi-level/referral trees, content tooling, pinning a
personal storefront page (v2).

## What Medusa already gives us
| Need | Medusa provides | Use |
|------|-----------------|-----|
| Affiliate identity & login | Auth module **custom actor type `affiliate`** (Medusa's documented "custom actor type" pattern: `authenticate("affiliate", …)`, `/auth/affiliate/emailpass`) | as-is; affiliate is NOT a customer |
| Orders, totals, refunds | Order module + events | subscribe |
| Admin pages | Admin UI routes/widgets | custom page |
| Optional affiliate-specific discount for buyers | Promotion module (code) | optional link |
| Resolve program scope → product list with prices/images | Product module + Query (`useQueryGraphStep`) | as-is |

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
- `trackClickWorkflow(code, path)` (store, public): resolve affiliate → set signed cookie
  `aff=<signed token>` (30d max, but program window governs). Click logging deferred to v2.
- Cart hook: on cart create/update in storefront, if cookie present → cart
  `metadata.affiliate_token = <signed token>` (HMAC-SHA256 over `affiliate_id|clicked_at`
  with server secret; the storefront copies the cookie value, it never builds it).
  Cart metadata is client-writable via the Store API, so the token is the only trusted input.
- Subscriber `order.placed`: verify `affiliate_token` signature (reject if invalid/expired) and `now - clicked_at ≤ attribution_window`
  and affiliate active and **an active program** covers the order time → create
  `AffiliateAttribution` (unique by order) → compute entries per eligible line item
  (program scope ∩ order items) → insert `CommissionEntry` status `pending`,
  `matures_at = now + hold_days`. Self-purchase (order customer email == affiliate email) → no commission.
- Subscriber on refund/cancel/return: insert `reversed` entries for affected amounts
  (never mutate the original; ledger is append-only).
- Scheduled job daily: `pending` entries with `matures_at <= now` and no reversal → `approved`.
- `createPayoutWorkflow(affiliate, period)` admin: sum `approved` not yet paid → Payout draft;
  `markPayoutPaid` → entries `paid`.

## API
- Store (public): `GET /store/affiliate/r/:code?to=/path` → sets cookie, 302 to path.
- Affiliate portal (actor `affiliate`, `authenticate("affiliate", ["session","bearer"])`):
  `POST /affiliate/register` (after `/auth/affiliate/emailpass/register`; creates `pending`
  affiliate and sets `app_metadata.affiliate_id`), `GET /affiliate/me`, `GET /affiliate/me/programs`,
  `GET /affiliate/me/earnings?from&to`,
  `GET /affiliate/products?status=active|upcoming&page=` → products in published programs
  (product, variant prices, image, commission %, program name, starts_at/ends_at,
  `share_url` = `{storefront}/r/{code}?to=/products/{handle}`), sorted by starts_at.
  Login via `/auth/affiliate/emailpass`.
  Customers' `/store/*` routes are untouched; being a customer is not required.
- Admin: CRUD programs; affiliates list/approve/suspend; `GET /admin/affiliate/entries`;
  payouts create/mark paid; `GET /admin/affiliate/reports/summary`.

## Admin UI / Storefront
- Admin: route page "Affiliate" → Programs (list with dates), Affiliates, Ledger, Payouts.
- Storefront: `/affiliate/*` portal with its own login/register (affiliate session, separate
  from customer session):
  - **Products** (home): two tabs "Earning now" / "Coming soon"; each card shows image,
    name, price, commission % and ฿ estimate at current price, program dates (countdown to
    start for upcoming), and **Share** (copy link; Web Share where the browser allows,
    with copy as fallback). Upcoming products can be shared early — the link works
    immediately and earns once the window opens.
  - Programs, Earnings (pending/approved/paid), Payouts, Profile (code, default link).
  Public landing via `/r/<code>`.

## Business rules
1. Commission exists **only** if the order is placed within an active program window and
   within the affiliate's attribution window from the click. No active program → no commission,
   even with a valid cookie.
2. Last-click attribution. Cookie overwritten by a newer affiliate click.
3. Commission base = line item **paid** amount after discounts, excluding shipping and tax.
4. Cap per order enforced at entry creation.
5. Entries are append-only; reversals are separate negative entries.
6. `hold_days` protects against refund window; only `approved` entries can be paid.
7. Affiliate must be `active` at click time and at order time.
8. PII: `payout_info` masked in store API; full value admin-only.
9. Visibility: only `published` programs appear on the portal; `active` = within window,
   `upcoming` = `starts_at > now`. Draft programs are invisible.

## Acceptance criteria
- AC-1 Given active program P (10%, all products, window today), when a buyer clicks
  `/r/ann`, orders ฿1,000 (ex. shipping/tax) within window, then a pending entry of ฿100 exists for Ann.
- AC-2 Given no active program at order time, same flow → attribution recorded, **no** entry.
- AC-3 Given click 10 days ago and `attribution_window_days=7` → no attribution.
- AC-4 Given program scope = collection C, order has 1 item in C (฿500) and 1 not → entry ฿50.
- AC-5 Given a full refund after entry creation → a `reversed` entry of −฿100; net 0.
- AC-6 Given `hold_days=14`, entry becomes `approved` only after 14 days (job with clock control).
- AC-7 Admin creates payout for Ann for last month → sums approved entries; mark paid → entries `paid`.
- AC-8 An order whose customer email equals the affiliate's email → no entry.
- AC-12 An affiliate can register and log in at `/auth/affiliate/emailpass` without a
  customer account; a customer session cannot access `/affiliate/me` (401).
- AC-9 Affiliate portal shows Products with "Earning now" and "Coming soon" tabs, each card
  with commission % and dates, and Share copies a per-product link (screenshots).
- AC-13 Given program P2 published with `starts_at` tomorrow (scope: collection C), then
  `GET /affiliate/products?status=upcoming` lists C's products with P2's rate and start date,
  and `status=active` does not; a draft program's products appear in neither.
- AC-14 A buyer who clicks a shared upcoming-product link today and orders tomorrow after
  `starts_at` (within attribution window) earns commission; ordering today earns none.
- AC-10 Duplicate `order.placed` delivery → single attribution and entry set.
- AC-11 Given cart metadata with a forged/tampered `affiliate_token`, when the order is placed,
  then no attribution and no entry are created, and the event is logged.

## Non-functional
- Redirect does no DB write; < 50ms.
- Ledger queries indexed on `(affiliate_id, status, created_at)`; reports aggregate by SQL.

## Test plan
- Unit: commission calc (scope, caps, base), window checks.
- Integration (http): AC-1..AC-8, AC-10, AC-11, AC-12, AC-13, AC-14.
- e2e: AC-9 + AC-1 end-to-end with cookie.

## Tasks
| ID | Task | Depends |
|----|------|---------|
| AF-1 | Module models/service/migrations + `affiliate` actor type auth (register/login) + unit tests for commission calc (AC-12) | CORE-2 |
| AF-2 | Tracking redirect + cookie + cart metadata hook in storefront (AC-3 setup) | AF-1 |
| AF-3 | `order.placed` attribution + entry creation subscriber (AC-1,2,3,4,8,10,11) | AF-2 |
| AF-4 | Reversal subscribers + maturity job (AC-5, AC-6) | AF-3 |
| AF-5 | Admin APIs + payout workflows (AC-7) | AF-1 |
| AF-6 | Admin UI pages | AF-5 |
| AF-7 | Portal APIs incl. `/affiliate/products` (scope → product resolution, paging) (AC-13, AC-14) | AF-3 |
| AF-8 | Storefront portal pages (own login): Products now/soon + Share, Programs, Earnings, Payouts + e2e (AC-9) | AF-7, AF-4 |
AF-5/AF-6 ∥ AF-3/AF-4; AF-7 ∥ AF-4.

## Open questions
- Q1 Affiliate self-signup open to anyone, or invite-only? (default: register → `pending` → admin approves)
- Q2 Should an affiliate get a personal public page listing products they chose to pin
  (`/a/<code>`)? (default: v2; per-product share links cover v1)
