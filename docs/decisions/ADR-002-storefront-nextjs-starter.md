# ADR-002 Storefront = Medusa Next.js Starter (themed), not a custom Ant Design app

Status: accepted (owner, 2026-10-25)

## Context
Owner earlier considered a custom Ant Design storefront. Goal "don't rebuild what Medusa has"
applies to the storefront too: the starter already implements PLP/PDP/cart/checkout
(incl. Stripe Elements)/account/orders with Medusa's JS SDK and caching conventions.

## Options
1. Medusa Next.js Starter, re-themed (Tailwind tokens), extended with new pages.
2. New Next.js app with Ant Design, re-implementing all commerce pages.

## Decision
Option 1. New feature pages (flash banner, group page, affiliate dashboard, my vouchers)
are added as routes inside the starter, using its data-fetching helpers.

## Consequences
+ Weeks saved; checkout edge cases (3DS, address, regions) already handled.
− Visual identity is constrained to Tailwind theming; Ant Design is not used.
− Starter upgrades require merging upstream changes occasionally.
