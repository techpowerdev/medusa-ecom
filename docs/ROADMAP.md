# ROADMAP — milestones, PR order, status

Legend: ☐ todo · ◐ in PR · ☑ merged to develop · 🚀 released
Each row = one PR into `develop`. Parallel rows marked ∥ may be built by concurrent builders.

## M0 Scaffold (this PR)
| PR | Task | Status |
|----|------|--------|
| 1 | Docs, agents, CI, PR template (no app code) | ◐ |

## M1 Core store (manual payment, test data)
| CORE-1 | Monorepo + Medusa app + starter + compose + CI | ☐ |
| CORE-2 | Seed: Thailand/THB/VAT/shipping/products/admin | ☐ |
| CORE-3 ∥ | Resend notifications + templates | ☐ |
| CORE-4 ∥ | Storefront theme + Thai i18n | ☐ |
| CORE-5 ∥ | Playwright + evidence convention | ☐ |
| CORE-6 | Customer-only store actions + e2e AC-1..4, AC-6 | ☐ |
| OPS-1 | Dockerfiles, worker mode, health | ☐ |
**Release v0.1.0** — browsable store, manual payments.

## M2 Payments
| PAY-1 | Stripe config + webhooks | ☐ |
| PAY-2 | Card + PromptPay checkout UI + e2e | ☐ |
| PAY-3 | Order pay page (for group buy) | ☐ |
| PAY-4 | Refund e2e | ☐ |
**Release v0.2.0** — real payments in test mode; go-live checklist for live keys.

## M3 E-voucher
EV-1 → (EV-2 ∥ EV-3) → EV-4 ; EV-5 ∥ EV-6 → EV-7 — **v0.3.0**

## M4 Flash sale
PROMO-1 ∥ FS-1 → (FS-2 ∥ FS-3 ∥ FS-4 ∥ FS-5) → FS-6 — **v0.4.0**

## M5 Group buying
GB-1 → GB-2 → (GB-6 ∥ GB-3 → GB-4 → GB-5 → GB-7) — **v0.5.0**

## M6 Affiliate
AF-1 → AF-2 → AF-3 → (AF-4 ∥ AF-7) → AF-8 ; AF-5 → AF-6 — **v0.6.0**

## M7 Scale & hardening
OPS-2 → OPS-3 → OPS-5 ; OPS-4 — **v1.0.0** 🎯

## Working agreement per PR
planner (only if spec changes) → builder (TDD, worktree) → qa (e2e + evidence) →
reviewer (independent) → owner merges → next PR. Status column updated by the builder.
