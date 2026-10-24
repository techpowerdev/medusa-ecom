# 00 Overview — Goals, scope, and feature map

Status: accepted (owner's goals, 2026-10-25)

## Owner's goals (verbatim, Thai → summarized)
1. Own e-commerce website, built **on Medusa v2**, extending it — never rebuilding what
   Medusa already has and does well. Follow Medusa coding conventions and best practice.
2. All basic Medusa commerce features complete, working, production-ready.
3. No over-engineering.
4. Additional features required:
   - **E-voucher**: resell partners' vouchers (Lotus, Big C, malls, cafés); we hold the
     partners' coupon codes and deliver them digitally (email). No redemption on our side.
   - **Flash sale** campaigns: time-limited discount to drive purchases.
   - **Group buying** campaigns: time-limited discount that only applies if a target is
     met (target = orders, units, or people); limits on total orders, units per person,
     people per group; groups are either admin-created **pools** or customer-created
     **teams**, per campaign setting.
   - **Affiliate** system with commission windows (commission enabled for periods, not
     permanently) — like TikTok/Shopee affiliate, but single-merchant (not marketplace).
     Affiliates see which products earn now or soon and share them.
   - **Stripe** payments: credit/debit cards + Thai **PromptPay**.
5. Scales well under many users.

## Feature map → spec
| # | Feature | Spec | Build strategy |
|---|---------|------|----------------|
| 1 | Core commerce | `01-core-medusa.md` | Use Medusa as-is; configure |
| 2 | E-voucher | `02-evoucher.md` | Custom module `evoucher` (partner code pools → Medusa inventory) + digital fulfillment + notification |
| 3 | Flash sale | `03-flash-sale.md` | Extend Promotion module (campaign + rules); thin custom module only for per-customer cap + countdown data |
| 4 | Group buying | `04-group-buying.md` | Custom module `group_buy`; draft order at join (Medusa Quotes pattern), pay link on success; discount via Promotion module |
| 5 | Affiliate | `05-affiliate.md` | Custom module `affiliate` (own actor type); signed-link attribution; product showcase now/soon; ledger |
| 6 | Payments | `06-payments-stripe.md` | Medusa Stripe provider (`pp_stripe_stripe`, `pp_stripe-promptpay_stripe`), auto capture |
| 7 | Scale & ops | `07-scaling-ops.md` | Worker mode, Redis modules, DB indexes, CDN, observability |

## Milestones (see `docs/ROADMAP.md`)
M0 Scaffold → M1 Core store live (test mode) → M2 Payments (Stripe cards + PromptPay) →
M3 E-voucher → M4 Flash sale → M5 Group buying → M6 Affiliate → M7 Scale/hardening → v1.0

## Owner decisions (2026-10-25)
- **No guests.** Only viewing is public; any other action requires a logged-in customer
  (cart, checkout, orders, vouchers, group buy). Affiliates are a separate actor type with
  their own login; they need not be customers.
- Flash-sale and group-buy discounts cannot be combined with other promotion codes.
- Group buying: draft order at join → pay link when target met → cancel + notify when missed.

## Global non-functional requirements
- Money: follow Medusa v2 — amounts are **decimal major units** (฿100 = `100`), stored with
  `model.bigNumber()` / `BigNumber` in custom modules. Never satang in our code; the Stripe
  provider converts to minor units internally.
- Time: store UTC; campaign times entered in admin in `Asia/Bangkok`, converted on save.
- Idempotency: all webhooks, scheduled jobs and settlement steps are safe to re-run.
- Concurrency: any "limited quantity / limited slots" counter is enforced in the DB
  (atomic update or row lock), never in application memory.
- Observability: structured logs, request IDs, error tracking; health endpoint.
- Security: admin routes behind Medusa auth; store routes use publishable API key;
  rate limit auth and campaign-join endpoints.
