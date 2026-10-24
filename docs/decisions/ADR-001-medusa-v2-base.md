# ADR-001 Build on Medusa v2, extend only

Status: accepted (owner, 2026-10-25)

## Context
Owner wants a production store with custom campaigns (flash sale, group buying, affiliate,
e-voucher) and explicitly does not want to rebuild commerce features Medusa already has.

## Options
1. Medusa v2 as backend + Next.js starter; add custom modules/workflows for the gaps.
2. Mercur (marketplace on Medusa) — adds vendor/marketplace concepts we don't need.
3. Custom backend from scratch.

## Decision
Option 1. Pin `@medusajs/*` to the current stable (2.22.x at time of writing; Node 22).
Upgrades are a task with its own PR, using Medusa's upgrade notes.

## Consequences
+ Cart/order/payment/promotion/fulfillment/admin come for free and stay upgradable.
+ Conventions (modules, workflows, links, subscribers, admin extensions) are documented and
  testable with `medusa-test-utils`.
− Custom features must fit Medusa's workflow/module model even when a shortcut exists.
− Every PR must pass a "reinvention" review gate (see reviewer agent).
