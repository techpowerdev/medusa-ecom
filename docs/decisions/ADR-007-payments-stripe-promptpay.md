# ADR-007 Payments via Medusa's Stripe provider with automatic capture

Status: accepted (owner, 2026-10-25) — revised after ADR-004 removed the auth-hold need

## Context
Medusa ships `pp_stripe_stripe` (cards) and `pp_stripe-promptpay_stripe` (PromptPay).
With group buying using draft orders paid only after success (ADR-004), no order needs a
deferred capture. All orders are pay-now.

## Options
1. Provider `capture: true` (automatic) for both cards and PromptPay; no capture subscriber.
2. Provider `capture: false` + `order.placed` capture subscriber + reconciliation job.
3. Custom payment provider.

## Decision
Option 1. Zero custom payment code. Group-buy draft orders are paid through the same
provider on their own payment collection.

## Consequences
+ Simplest possible setup; Stripe test mode + CLI covers e2e.
+ Refunds only through Medusa's refund workflow.
− Changing to deferred capture later would need a config change and a subscriber (documented in option 2).
