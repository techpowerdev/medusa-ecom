# ADR-006 E-voucher = imported partner code pools + Medusa inventory + `digital` fulfillment + notification

Status: accepted (owner, 2026-10-25) — revised: vouchers are partners' codes; we never redeem

## Context
We resell vouchers from partners (Lotus, Big C, malls, cafés). Partners hand us code
batches up front; we must deliver exactly one unused code per unit sold, by email, and show
remaining stock. Redemption happens at the partner.

## Options
1. `evoucher` module with Partner / Pool / Code; pool size drives the variant's Medusa
   inventory level; codes claimed atomically after payment captured; delivered through the
   documented digital-products pattern (custom fulfillment provider + Notification).
2. Store codes in product/variant metadata (no atomic claim, no audit, no masking).
3. Live-fetch codes from partner APIs at order time (no partner has an API today).

## Decision
Option 1. Inventory stays Medusa's (reservations, "out of stock" in storefront) and is kept
equal to `available` codes by the import/void workflows. Codes/PINs are encrypted at rest
and masked in admin; reveal is audited. Option 3 can be added later behind a code-source
interface without changing the order flow.

## Consequences
+ No custom stock logic; Medusa handles oversell prevention at cart level, our atomic
  claim (`FOR UPDATE SKIP LOCKED`) handles the last-code race.
+ Refund policy is explicit: delivered codes are not reclaimed.
− Admin must import batches before selling; low-stock and expiring-code jobs are required.
− A free "Digital delivery" shipping option (provider `digital`) must exist and the storefront
  auto-selects it for digital-only carts, so `createOrderFulfillmentWorkflow` can resolve the provider.
