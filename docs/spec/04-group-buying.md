# 04 Group buying — target-gated, time-limited discounts

Status: draft (design revised 2026-10-25 per owner: draft-order flow, like Medusa's Quotes example)
Goal (owner): campaigns with a time limit where the discount only becomes valid when a
target is reached. Target can be **orders**, **units**, or **people**. Limits: total orders,
units per person, people per group. Groups are admin-created **pools** or customer-created
**teams** depending on campaign setting. **Joining creates a draft order** (no payment);
when the target is hit, members are notified and get a payment link/page; if the target is
missed, draft orders are cancelled and members notified. Login required to join.
Decision: custom module `group_buy` (ADR-004); discount **applied by the Promotion module**
(one promotion code per group), draft orders via Medusa's Order module.
Out of scope: social sharing beyond a share link, tiered targets, partial payments.

## What Medusa already gives us
| Need | Medusa provides | Use |
|------|-----------------|-----|
| Apply a % / fixed discount to a cart | Promotion module (code-based) | 1 promotion per group, `is_automatic=false` |
| Time window | Campaign | 1 campaign per group-buy campaign |
| Draft order from a cart, later converted & paid | Order module draft orders (`createOrderWorkflow` with `is_draft_order`, `convertDraftOrderWorkflow`) + payment collection on order — the pattern of Medusa's **Quotes** example | as-is |
| Payment collection for an existing order | `createOrderPaymentCollectionWorkflow` + payment sessions | as-is |
| Cancel draft order | `cancelOrderWorkflow` | as-is |
| Customer identity, auth | Customer + Auth modules | as-is (login required) |
| Emails | Notification module | templates |
| Admin pages | Admin UI routes | custom page |

## Core design: draft order at join, pay on success
1. Customer (logged in) joins a group with a cart → promotion code `GB-<token>` applied →
   cart is converted to a **draft order** (status `pending`, `is_draft_order=true`, no payment).
   Membership + progress counters are created in the same transaction.
2. As soon as the target is hit (or at `ends_at` if hit by then), the group **succeeds**:
   each member gets an email with a pay link `/account/orders/:id/pay`, and a payment
   window `pay_within_hours` (campaign setting, default 24h).
3. Member pays (card or PromptPay) against the order's payment collection → on captured,
   the draft order is **converted** to a regular order (`convertDraftOrderWorkflow`) and
   proceeds to fulfillment. Unpaid after the window → draft order cancelled, member notified.
4. At `ends_at` with target missed → group **fails**: all draft orders cancelled, members notified.
Why this over pay-at-join: fewer refunds, no auth-hold time limit, mirrors a documented
Medusa pattern. Trade-off: members may not pay after success (mitigated by the pay window
and `min_paid_ratio` reporting, not by blocking fulfillment of those who paid).

## Data model (module `group_buy`)
```
GroupBuyCampaign
  id, name,   // discount type/value, product scope, starts_at/ends_at live on the linked
              // Medusa campaign + promotion; read via link, never duplicated here
  target_type: "orders"|"units"|"people", target_value: int,
  max_total_orders: int?, max_units_per_person: int?, max_people_per_group: int?,
  group_mode: "pool"|"team"|"both",
  team_duration_hours: int?,          // team deadline = min(created_at + h, campaign.ends_at)
  pay_within_hours: int (default 24),
  status: "draft"|"active"|"ended",
  promotion_campaign_id (link)

GroupBuyGroup
  id, campaign_id, kind: "pool"|"team", created_by_customer_id?,
  name?, join_token (unique), starts_at, ends_at,
  promotion_id (link → Medusa promotion, code = "GB-<token>"),
  status: "open"|"succeeded"|"failed",
  succeeded_at?, pay_deadline_at?,
  progress_orders: int, progress_units: int, progress_people: int   // denormalized, atomic

GroupBuyMembership
  id, group_id, customer_id, order_id (unique, draft order), units: int, joined_at,
  status: "joined"|"awaiting_payment"|"paid"|"cancelled"
  // unique (group_id, customer_id)
```
Links: `group_buy_group ↔ promotion`, `group_buy_campaign ↔ promotion_campaign`,
`group_buy_membership ↔ order`.

## Workflows
- `createGroupBuyCampaignWorkflow` → Medusa campaign + our campaign (compensate: delete).
- `createGroupWorkflow(campaign, kind, customer)` → validate mode & limits → create Medusa
  promotion (code-based, rules: campaign scope) → create group.
- `joinGroupWorkflow(group, cart, customer)` (auth required):
  1. lock group row (`SELECT ... FOR UPDATE`) → check `open`, not expired, customer not
     already in a group of this campaign, `progress_people < max_people_per_group`,
     campaign `max_total_orders`, cart units ≤ `max_units_per_person`, cart contains only
     campaign-scoped items, cart has no other promotion codes (rule 7);
  2. apply `GB-<token>` to cart (`updateCartPromotionsWorkflow`);
  3. create draft order from cart (`createOrderWorkflow`, `is_draft_order: true`,
     metadata `{group_buy_group_id, group_buy_membership_id}`) — compensation: cancel it;
  4. create membership (`joined`) + atomic counter increment;
  5. if target hit → emit `group_buy.group.succeeded`.
  Steps 1 & 4 share the lock; the whole thing is one workflow with compensation.
- `succeedGroupWorkflow(group_id)` (on event, and by the deadline job): set `succeeded`,
  `pay_deadline_at = now + pay_within_hours`; for each `joined` membership: create payment
  collection on the draft order, set `awaiting_payment`, send "group succeeded — pay now" email.
  Idempotent: skip memberships already `awaiting_payment`/`paid`.
- `failGroupWorkflow(group_id)`: set `failed`; for each `joined` membership:
  `cancelOrderWorkflow(order)`, set `cancelled`, send "group failed" email. Idempotent.
- Subscriber `payment.captured` (order has `group_buy_membership_id`): membership → `paid`;
  `convertDraftOrderWorkflow(order)`. Idempotent via membership status.
- Scheduled job every minute:
  - groups `open` with `ends_at <= now` → target met ? succeed : fail;
  - memberships `awaiting_payment` with group `pay_deadline_at <= now` →
    `cancelOrderWorkflow` + `cancelled` + "payment window expired" email.
- Store `leaveGroupWorkflow` (member, before success): cancel draft order, membership
  `cancelled`, counters decrement.

## API (all store routes require customer auth)
- Admin: CRUD `/admin/group-buy/campaigns`, `POST /admin/group-buy/campaigns/:id/groups`
  (pool), `GET .../groups`, `POST /admin/group-buy/groups/:id/succeed|fail` (manual override).
- Store: `GET /store/group-buy/campaigns/active`, `GET /store/group-buy/groups/:token`
  (progress, deadline, member count), `POST /store/group-buy/groups` (team),
  `POST /store/group-buy/groups/:token/join` `{cart_id}`, `POST /store/group-buy/memberships/:id/leave`.
- Payment page uses Medusa's existing store payment-collection routes on the order
  (same as the Quotes example); no custom payment route.

## Admin UI / Storefront
- Admin: route page "Group buying" → campaigns, groups with progress & status, memberships
  with order + payment status, manual succeed/fail.
- Storefront: campaign page; group page (progress bar, countdown, member count, "Join",
  "Create team" when allowed → share link `/g/<token>`); account order list shows draft
  group orders with status (waiting for group / pay now by <deadline> / paid / cancelled);
  `/account/orders/:id/pay` payment page (card + PromptPay, spec 06).

## Business rules
1. Target: `orders` = count memberships not cancelled; `units` = sum units; `people` =
   distinct customers.
2. Group deadline: pool → campaign `ends_at`; team → `min(created + team_duration_hours, campaign.ends_at)`.
3. One group per customer per campaign. Login required for every group action.
4. All limits enforced under the group row lock inside `joinGroupWorkflow`.
5. Discount amount comes from the Medusa promotion only; it is frozen in the draft order's
   totals at join time.
6. Draft orders do **not** reserve inventory; stock is checked at payment time by Medusa's
   normal order completion. Admin sees "members vs paid" per group.
7. **Exclusivity**: a cart with a `GB-*` promotion may not hold any other promotion code and
   vice versa (hook on `updateCartPromotionsWorkflow`; error `PROMOTION_NOT_COMBINABLE`).
   Shared implementation with flash sale (spec 03, rule 6).
8. Group succeeds at most once; succeed/fail/cancel steps are idempotent and re-runnable.
9. Emails: joined, group succeeded (pay link + deadline), payment received, group failed,
   payment window expired.

## Acceptance criteria
- AC-1 Given a campaign (target 3 orders, −30%), when 3 logged-in customers join pool P, then
  within 60s the group is `succeeded`, each has a draft order with a payment collection, and
  each receives an email with a pay link.
- AC-2 Given AC-1, when a member pays with a test card on the pay page, then their draft order
  becomes a regular order with `payment_status=captured` and membership `paid`.
- AC-3 Given the campaign with 2 members at `ends_at`, then both draft orders are cancelled,
  memberships `cancelled`, both customers emailed; no payment collection was created.
- AC-4 Given `max_people_per_group=2`, the 3rd join returns 409.
- AC-5 Given `max_units_per_person=1`, a join with cart qty 2 returns 409.
- AC-6 Given `group_mode=pool`, create-team returns 403; with `both`, the team is created with
  a share link and its own deadline.
- AC-7 Given a member leaves before success, progress decreases, their draft order is cancelled,
  and they can rejoin.
- AC-8 20 concurrent joins against `max_people_per_group=5` → exactly 5 memberships.
- AC-9 Running succeed/fail twice on the same group creates no duplicate payment collections,
  cancellations, or emails.
- AC-10 Given a succeeded group and `pay_within_hours=1`, an unpaid member after 1h has a
  cancelled order and an "expired" email; paid members are unaffected.
- AC-11 `target_type=units`, target 10: 10 units across any orders → succeeded; 9 → failed.
- AC-12 `target_type=people`, target 3: 3 distinct customers (one with 2 orders) → succeeded;
  2 customers with 4 orders → failed.
- AC-13 Campaign `max_total_orders=5`: the 6th join in any group returns 409.
- AC-14 A cart holding code `SAVE10` cannot join (409 `PROMOTION_NOT_COMBINABLE`); after
  joining, applying `SAVE10` to a `GB-*` cart is rejected.
- AC-15 Unauthenticated join/create/leave → 401.
- AC-16 Storefront: group page progress/countdown/members; account shows "pay now by <time>"
  and the pay page completes with PromptPay (screenshots).

## Non-functional
- Counters denormalized and atomic; indexes on `(status, ends_at)`, `join_token`,
  `(campaign_id, customer_id)`, `(status, pay_deadline_at)`.
- Deadline job processes ≤ 50 groups/run; per-member steps inside workflows with retries.

## Test plan
- Unit: deadline calc, target evaluation, limit checks, exclusivity check.
- Integration (modules): concurrent join (AC-8), idempotency (AC-9).
- Integration (http): AC-1, AC-3..AC-7, AC-10..AC-15 with payment provider mocked.
- e2e: AC-2, AC-16 against Stripe test mode.

## Tasks
| ID | Task | Depends |
|----|------|---------|
| GB-1 | Module models/service/links/migrations + unit tests | CORE-2 |
| GB-2 | Campaign + group creation workflows + admin CRUD API (AC-6 API) | GB-1 |
| GB-3 | `joinGroupWorkflow` (draft order) + join/create/leave endpoints + exclusivity hook + concurrency tests (AC-4, AC-5, AC-7, AC-8, AC-13, AC-14, AC-15) | GB-2, PROMO-1 |
| GB-4 | `succeedGroupWorkflow` / `failGroupWorkflow` + deadline job + emails (AC-1, AC-3, AC-9, AC-11, AC-12) | GB-3 |
| GB-5 | Payment captured subscriber → convert draft order; pay-window expiry (AC-2 API, AC-10) | GB-4, PAY-3 |
| GB-6 | Admin UI route pages | GB-2 |
| GB-7 | Storefront campaign/group/account/pay pages + e2e (AC-2, AC-16) | GB-5 |
GB-6 ∥ (GB-3 → GB-4 → GB-5 → GB-7).

## Open questions
- Q1 If some members never pay after success, should the group still count as fulfilled for
  the others? (default: yes — paid members are fulfilled regardless)
- Q2 Should a succeeded group stay open for late joiners until `ends_at`? (default: no, closes on success)
