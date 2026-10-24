# ADR-004 Group buying = custom module; draft order at join, pay after success; discount via per-group Promotion code

Status: accepted (owner, 2026-10-25) — supersedes the earlier "pay-at-join" proposal

## Context
Group buying needs target gating (orders/units/people), per-group membership and limits,
pools vs teams, deadline handling. Medusa has no conditional-on-target concept, but it has
draft orders that can later be paid and converted (the pattern used by Medusa's Quotes example).

## Options
A. Pay discounted price at join (card auth-hold / PromptPay paid); capture or refund at deadline.
B. Pay full price; refund the difference on success.
C. **Join creates a draft order (no payment); on success members get a pay link with a
   payment window; on failure draft orders are cancelled.**

## Decision
C (owner's choice). Discount is applied through a unique Medusa promotion code per group and
frozen in the draft order; payment uses Medusa's order payment-collection flow.

## Consequences
+ No refunds on failure, no Stripe auth-hold time limit, no campaign-length constraint.
+ No special capture logic in the payment layer (ADR-007 simplified).
+ Reuses documented Medusa draft-order → payment → convert flow.
− Some members may not pay after success; mitigated by `pay_within_hours`, reminder email,
  and admin "members vs paid" view. Fulfillment proceeds for those who pay.
− Draft orders do not reserve inventory; stock is validated at payment time.
