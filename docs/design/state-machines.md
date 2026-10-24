# State machines

Every transition is implemented as an idempotent workflow step or atomic update.

## EvoucherCode

```mermaid
stateDiagram-v2
  [*] --> available : CSV import (inventory +1)
  available --> allocated : payment captured, atomic claim (SKIP LOCKED)
  allocated --> delivered : email sent
  allocated --> available : order cancelled before delivery
  available --> void : expiring < 7 days or admin void (inventory -1)
  delivered --> [*] : used at partner, not tracked here
  void --> [*]
  note right of delivered : refund = manual, code not reclaimed
```

## GroupBuyGroup

```mermaid
stateDiagram-v2
  [*] --> open : createGroupWorkflow
  open --> succeeded : target hit (any time) or target met at ends_at
  open --> failed : ends_at reached, target not met
  succeeded --> [*] : all memberships paid or expired
  failed --> [*] : all draft orders cancelled
  note right of open : counters atomic under row lock
  note right of succeeded : pay_deadline_at = now + pay_within_hours
```

## GroupBuyMembership

```mermaid
stateDiagram-v2
  [*] --> joined : joinGroupWorkflow (draft order created)
  joined --> awaiting_payment : group succeeded → payment collection + email
  joined --> cancelled : member leaves, or group failed
  awaiting_payment --> paid : payment.captured → convertDraftOrder
  awaiting_payment --> cancelled : pay_deadline_at passed
  paid --> [*] : normal order lifecycle
  cancelled --> [*] : draft order cancelled
```

## CommissionEntry (ledger)

```mermaid
stateDiagram-v2
  [*] --> pending : order.placed in active program
  pending --> approved : matures_at ≤ now and no reversal (daily job)
  pending --> reversed : refund / cancel (separate negative row)
  approved --> paid : payout marked paid
  approved --> reversed : late refund (negative row)
  paid --> [*]
  reversed --> [*]
  note right of reversed : original row never mutated
```

## Affiliate

```mermaid
stateDiagram-v2
  [*] --> pending : register via /auth/affiliate
  pending --> active : admin approves
  active --> suspended : admin suspends
  suspended --> active : admin reinstates
  note right of active : must be active at click AND at order
```

## AffiliateProgram (visibility)

```mermaid
stateDiagram-v2
  [*] --> draft : admin creates
  draft --> published : admin publishes (visible on portal)
  state published {
    [*] --> upcoming : starts_at > now
    upcoming --> active : starts_at reached
    active --> ended_window : ends_at reached
  }
  published --> ended : admin closes or window passed
  ended --> [*]
  note right of published : upcoming = "coming soon", shareable early
```

## Order (group-buy view)

```mermaid
stateDiagram-v2
  [*] --> draft_pending : join (is_draft_order, no payment)
  draft_pending --> draft_awaiting_payment : group succeeded
  draft_pending --> canceled : group failed / member left
  draft_awaiting_payment --> order_captured : paid → convertDraftOrderWorkflow
  draft_awaiting_payment --> canceled : pay window expired
  order_captured --> fulfilled : Medusa fulfillment
  fulfilled --> [*]
  canceled --> [*]
```
