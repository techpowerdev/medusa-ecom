# 06 Payments — Stripe cards + Thai PromptPay

Status: draft
Goal (owner): accept credit/debit cards and PromptPay via Stripe.
Decision: Medusa's built-in Stripe provider, automatic capture (ADR-007). **No custom payment code.**
Verified (Medusa docs, 2026-10): `@medusajs/medusa/payment-stripe` registers
`pp_stripe_stripe` (cards) and `pp_stripe-promptpay_stripe` (PromptPay); webhooks at
`{server}/hooks/payment/stripe_stripe` and `{server}/hooks/payment/stripe-promptpay_stripe`.

## What Medusa already gives us
| Need | Medusa provides | Use |
|------|-----------------|-----|
| Card payments (3DS) | `pp_stripe_stripe` | as-is |
| PromptPay QR | `pp_stripe-promptpay_stripe` | as-is |
| Payment sessions, authorize, capture, refund | Payment module + core flows | as-is |
| Webhook handling + idempotency | `/hooks/payment/*` | as-is |
| Pay an existing (draft) order | Order payment collection + store payment routes | as-is (group buy, spec 04) |
| Storefront Stripe Elements checkout | Next.js starter | extend for PromptPay + order pay page |
| Admin: enable providers per region, refund | Admin | configure |

## Configuration
- Stripe account: Thailand entity (PromptPay requires a Thai Stripe account, THB).
- `medusa-config.ts`: payment module with Stripe provider id `stripe`, `capture: true`,
  `automaticPaymentMethods: false`.
- Region Thailand: enable both providers.
- Env: `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_KEY`.
- Webhooks (two endpoints) registered in Stripe dashboard; events: `payment_intent.*`.

## Storefront
- Checkout payment step: "Card" (Stripe Elements) / "PromptPay" (PaymentElement with
  `promptpay`, shows QR; poll session status until captured; expire after 10 min).
- `/account/orders/:id/pay`: same payment component bound to the order's payment collection
  (used by group buying).
- Error states: declined, 3DS fail, PromptPay expired → retry; cart/order intact.
- Login required for checkout (store-wide rule, spec 01).

## Business rules
1. All amounts THB in Medusa major units; the Stripe provider converts to satang.
2. Order is created only when the payment session is authorized/captured (Medusa default).
3. Webhook events are the source of truth for PromptPay completion.
4. Refunds only through `refundPaymentWorkflow`; never direct Stripe API calls outside the provider.

## Acceptance criteria
- AC-1 Card `4242…` → order placed, `payment_status=captured`.
- AC-2 Card requiring 3DS (`4000 0027 6000 3184`) → 3DS modal → success.
- AC-3 Declined card (`4000 0000 0000 0002`) → error shown, no order created.
- AC-4 PromptPay: QR displayed; confirming the test-mode PaymentIntent → webhook → order
  placed with `payment_status=captured`.
- AC-5 PromptPay not paid within 10 min → session cancelled, cart still usable.
- AC-6 Admin refund of ฿100 on captured order → Stripe refund exists; order shows refunded.
- AC-7 Paying a draft order via `/account/orders/:id/pay` with PromptPay → captured.
- AC-8 Replayed webhook delivery does not double-capture/refund.

## Test plan
- Integration (http): AC-8 with provider mocked.
- e2e: AC-1..AC-7 with Stripe test mode; CI runs `stripe listen --forward-to` so real
  webhooks reach the runner; PromptPay success simulated by confirming the test-mode PaymentIntent.

## Tasks
| ID | Task | Depends |
|----|------|---------|
| PAY-1 | Stripe provider config, region enablement, env, webhook routes verified locally with Stripe CLI (AC-8) | CORE-2 |
| PAY-2 | Storefront: card + PromptPay payment step, polling, errors + e2e (AC-1..AC-5) | PAY-1, CORE-5 |
| PAY-3 | Order pay page `/account/orders/:id/pay` + e2e (AC-7) | PAY-2 |
| PAY-4 | Refund e2e + admin screenshot (AC-6) | PAY-2 |

## Open questions
- Q1 Confirm the Stripe account is a Thai entity with PromptPay enabled (needed for AC-4 in test mode).
