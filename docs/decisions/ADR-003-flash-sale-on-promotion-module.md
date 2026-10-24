# ADR-003 Flash sale = Medusa Campaign + automatic Promotion; thin `flash_sale` module for gaps

Status: accepted (owner, 2026-10-25)

## Context
Medusa Promotion module already has campaigns with start/end, budgets (spend/usage),
automatic application, target rules and per-cart max quantity.

## Options
1. Use Campaign/Promotion for the discount; add a thin module for per-customer cap and
   storefront countdown/price preview.
2. Medusa **Price List** `type: sale` with `starts_at/ends_at` — zero code, starter already
   shows strikethrough. Lacks budget ("first N"), per-customer cap, and order-level discount lines.
3. Separate "flash sale" pricing engine that mutates prices on schedule.

## Decision
Option 1, because budget and per-customer cap are required. Campaigns that need neither
(simple timed markdown) should use a sale Price List and no code. Our code never computes discount amounts; it only validates limits and exposes
read-only campaign data to the storefront.

## Consequences
+ Admin uses Medusa's promotion UI; stacking/exclusivity rules are Medusa's.
+ Discount totals in cart/order are consistent with Medusa reports.
− Per-customer limit requires our own counter and a cart-completion validation hook.
− "Flash price" preview needs a store endpoint calling Promotion compute on a synthetic line.
