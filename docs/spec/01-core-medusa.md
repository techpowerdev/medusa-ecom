# 01 Core commerce — what Medusa v2 already gives us

Status: accepted
Goal: a complete, production-ready basic store with **zero custom commerce logic**.
Everything in this spec is configuration, seeding, theming, and deployment.

## What Medusa already gives us (DO NOT REBUILD)
| Capability | Medusa module / feature | Our action |
|------------|-------------------------|------------|
| Products, variants, options, images, categories, collections, tags, types | Product module | Seed + admin |
| Pricing, price lists, currency, tax-inclusive pricing | Pricing module | Configure THB |
| Inventory, stock locations, reservations | Inventory + Stock Location | One location |
| Regions, countries, currencies | Region module | Region "Thailand", THB |
| Sales channels, publishable API keys | Sales Channel + API Key | Default channel |
| Cart, line items, shipping/billing address, totals | Cart module + core flows | Storefront uses |
| Promotions, campaigns, budgets, rules, automatic/code | Promotion module | Base for flash sale |
| Orders, order edits, returns, exchanges, claims | Order module | Admin |
| Payments, sessions, capture, refund, webhooks | Payment module + Stripe provider | Spec 06 |
| Fulfillment, shipping options, providers | Fulfillment module (manual provider) | + digital provider (spec 02) |
| Customers, groups, addresses | Customer module | — |
| Auth (email/password, Google, GitHub) | Auth module | email/password for customers |
| Notifications (email providers) | Notification module | Resend/SendGrid provider |
| Tax | Tax module | Thai VAT 7% inclusive |
| Admin dashboard | `@medusajs/dashboard` | Theme/logo only |
| Storefront: PLP, PDP, cart, checkout, account, orders | Next.js Starter | Theme + Thai i18n |
| File storage | File module (S3 provider) | S3-compatible bucket |
| Search | Product `q` filter (v1); `@medusajs/search-postgres` if needed later | Default |
| Scheduled jobs, subscribers, workflow engine | Framework | Redis-backed in prod |

## Configuration to deliver
- Region: Thailand, THB, tax-inclusive pricing, payment providers from spec 06.
- Shipping: 1 manual option "Standard" (flat), 1 "Digital delivery" (free, for vouchers).
- Tax: 7% VAT, included in price.
- Notification provider: email (Resend) for order placed / shipped / voucher delivery.
- File provider: S3-compatible.
- Admin: store name, logo, default currency.
- Storefront: Thai + English locales, THB formatting, brand theme (Tailwind tokens).
- **No guests** (owner): only browsing (PLP/PDP/search/campaign pages/affiliate landing)
  is public. Every other store action — create/update cart, add to cart, checkout, orders,
  vouchers, group buy — requires a logged-in **customer**. (Affiliate portal uses its own
  `affiliate` actor type, spec 05.) Enforced
  server-side with Medusa's `authenticate("customer", ...)` middleware on those store
  routes plus a `createCartWorkflow` hook rejecting carts without `customer_id`; storefront
  redirects to login/register on "Add to cart".

## Acceptance criteria
- AC-1 Given a seeded store, when a customer browses, adds to cart, checks out with the
  manual payment provider, then an order exists in admin with `payment_status=authorized`;
  after admin capture, `payment_status=captured`. (Stripe is M2.)
- AC-2 Given an order, when admin creates a fulfillment and marks shipped, the customer
  receives a "shipped" email (test inbox).
- AC-3 Given a customer account, when they view "My orders", their orders are listed with
  correct THB totals.
- AC-4 Admin can create product with 2 variants and stock, and it appears in storefront
  within 5s (no cache stale > 60s in prod).
- AC-6 Given a guest, when they click "Add to cart", they are sent to login; `POST /store/carts`
  and `POST /store/carts/:id/line-items` without a customer session return 401. After login
  the item is added.
- AC-5 `GET /health` returns 200; app boots in `server` and `worker` mode separately.

## Test plan
- Integration (http): region/tax config smoke; cart→order flow with manual payment.
- e2e: AC-1, AC-3, AC-4 via Playwright with screenshots.

## Tasks
| ID | Task | Depends |
|----|------|---------|
| CORE-1 | `create-medusa-app` into `apps/backend` + starter into `apps/storefront`; pnpm workspace; Docker Compose (pg, redis); `.env.example`; CI green on empty tests | — |
| CORE-2 | Seed script: Thailand region, THB, 7% VAT, shipping options (Standard + Digital delivery), sample products, admin user; `print-publishable-key` script used by CI | CORE-1 |
| CORE-3 | Notification provider (Resend) + order placed/shipped templates | CORE-1 |
| CORE-4 | Storefront theming + Thai i18n + THB formatting | CORE-1 |
| CORE-5 | Playwright setup with screenshot-per-step + evidence folder convention | CORE-1 |
| CORE-6 | Customer-only store routes (middleware + cart hook + storefront redirect) + e2e for AC-1..AC-4, AC-6 with manual payment provider | CORE-2,4,5 |
CORE-3 and CORE-4 can run in parallel after CORE-1.
