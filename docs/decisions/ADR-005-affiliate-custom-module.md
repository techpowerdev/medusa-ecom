# ADR-005 Affiliate = custom module with append-only commission ledger and time-boxed programs

Status: proposed

## Context
Owner wants affiliate commissions only during defined windows (programs), last-click
attribution, holds for refunds, manual payouts. Medusa has no affiliate concept.

## Options
1. Custom module: Affiliate, Program (window), Attribution, CommissionEntry (ledger), Payout.
2. Third-party affiliate SaaS integrated by webhook.
3. Model commissions as Medusa promotions (wrong fit: promotions discount buyers).

## Decision
Option 1. Affiliates are a **separate actor type** in Medusa's Auth module (not customers);
they log in to their own portal. An affiliate may also hold a customer account under the same
email; the two are independent. Ledger is append-only (reversals are new rows). Payout execution is manual.

## Consequences
+ Full control over windows, scope and reporting; no vendor cost.
− We own fraud/edge handling (self-purchase, cookie overwrite, refunds) — covered by ACs.
