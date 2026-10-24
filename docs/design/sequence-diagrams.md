# Sequence diagrams

Participants named 'module' are our custom modules; everything else is Medusa or Stripe.

## E-voucher: import โค้ด partner → ซื้อ → จัดสรร → ส่งอีเมล

```mermaid
sequenceDiagram
  autonumber
  actor C as Customer
  participant SF as Storefront
  participant API as Medusa API
  participant PAY as Stripe provider
  participant EV as evoucher module
  participant NT as Notification

  actor AD as Admin
  AD->>EV: import partner CSV (codes, pins, expiry)
  EV->>API: adjust inventory level +N (Medusa Inventory)
  C->>SF: add voucher variant, checkout (logged in)
  SF->>API: complete cart (digital shipping auto-selected, stock reserved by Medusa)
  API->>PAY: create + confirm PaymentIntent
  PAY-->>API: payment captured (webhook)
  API-->>EV: event payment.captured (subscriber, worker)
  EV->>EV: claim 1 available code per unit (FOR UPDATE SKIP LOCKED, oldest expiry first)
  EV->>API: createOrderFulfillmentWorkflow (provider digital)
  EV->>NT: send evoucher.delivered (codes, pins, partner how-to-use, expiry)
  EV->>EV: codes = delivered
  NT-->>C: email with codes
  C->>SF: My vouchers
  SF->>API: GET /store/customers/me/evouchers
  API-->>SF: own codes + status
```

## Flash sale: checkout ภายใต้ limit

```mermaid
sequenceDiagram
  autonumber
  actor C as Customer
  participant SF as Storefront
  participant API as Medusa API
  participant PR as Promotion module
  participant FS as flash_sale hook
  participant DB as Postgres

  SF->>API: GET /store/flash-sales/active
  API->>PR: compute promotion for variants
  API-->>SF: countdown, flash_price, remaining
  C->>SF: add item, checkout
  SF->>API: POST /store/carts/:id/complete
  API->>FS: completeCartWorkflow.validate hook
  FS->>DB: check FlashSaleUsage(customer) + per_customer_limit
  FS->>DB: UPDATE units_sold = units_sold + n WHERE units_sold + n <= total_cap
  alt no row updated
    FS-->>API: throw FLASH_SOLD_OUT
    API-->>SF: 400 FLASH_SOLD_OUT
  else ok
    API->>PR: register promotion usage
    API-->>SF: order created
    API-->>FS: order.placed → upsert FlashSaleUsage (idempotent by order_id)
  end
```

## Group buy 1/2: join (draft order)

```mermaid
sequenceDiagram
  autonumber
  actor A as Customer
  participant SF as Storefront
  participant GB as group_buy module
  participant M as Medusa core
  A->>SF: Join group (logged in)
  SF->>GB: POST join with cart id
  GB->>GB: lock group row, check limits and no other promo code
  GB->>M: apply promotion code of the group to cart
  GB->>M: createOrderWorkflow as draft order (no payment)
  GB->>GB: create membership joined, increase counters
  GB-->>SF: 201 membership and draft order
  SF-->>A: waiting for group to reach target
```

## Group buy 2/2: target reached, pay

```mermaid
sequenceDiagram
  autonumber
  participant GB as group_buy module
  participant M as Medusa core
  participant NT as Notification
  actor A as Customer
  participant SF as Storefront
  participant ST as Stripe
  participant JOB as Scheduled job
  GB->>GB: target reached, succeedGroupWorkflow (idempotent)
  GB->>M: create payment collection on each draft order
  GB->>NT: email group succeeded with pay deadline
  NT-->>A: email with pay link
  A->>SF: open pay page, choose PromptPay
  SF->>M: payment session on the order payment collection
  M->>ST: PaymentIntent promptpay
  ST-->>M: webhook payment succeeded
  M-->>GB: event payment captured
  GB->>M: convertDraftOrderWorkflow
  GB->>GB: membership paid
  JOB->>GB: every minute, unpaid after deadline then cancel order and email
```

## Group buy: ไม่ถึงเป้า

```mermaid
sequenceDiagram
  autonumber
  participant JOB as Scheduled job (1 min)
  participant GB as group_buy module
  participant API as Medusa Order
  participant NT as Notification
  actor M as Members

  JOB->>GB: groups open with ends_at <= now
  GB->>GB: evaluate target (orders | units | people)
  alt target met
    GB->>GB: succeedGroupWorkflow
  else not met
    GB->>GB: failGroupWorkflow (idempotent)
    loop each membership(joined)
      GB->>API: cancelOrderWorkflow(draft order)
      GB->>GB: membership = cancelled
    end
    GB->>NT: email "group failed, nothing charged"
    NT-->>M: notification
  end
```

## Affiliate: โชว์สินค้า → แชร์ → คลิก → สั่งซื้อ → ค่าคอม → จ่าย

```mermaid
sequenceDiagram
  autonumber
  actor AF as Affiliate
  actor B as Buyer (customer)
  participant SF as Storefront
  participant AM as affiliate module
  participant API as Medusa Order
  participant JOB as Daily job
  actor AD as Admin

  AF->>SF: /affiliate portal → Products (Earning now / Coming soon)
  SF->>AM: GET /affiliate/products?status=upcoming
  AM->>API: resolve program scope → products, prices, images
  AM-->>SF: cards with commission %, dates, share_url
  AF->>SF: Share product x (copy link / Web Share)
  AF-->>B: /r/ann?to=/products/x
  B->>SF: click link
  SF->>AM: GET /store/affiliate/r/ann
  AM-->>B: set signed cookie aff=HMAC token, 302 to /products/x
  B->>SF: add to cart (logged in)
  SF->>API: cart.metadata.affiliate_token = cookie value
  B->>SF: checkout + pay
  API-->>AM: order.placed (subscriber)
  AM->>AM: verify token signature, click age <= window, program active, affiliate active, email != buyer
  alt valid
    AM->>AM: create Attribution (unique order_id)
    AM->>AM: CommissionEntry pending per eligible line item, matures_at = now + hold_days
  else invalid / no program
    AM->>AM: log, no entry
  end
  API-->>AM: refund/cancel → CommissionEntry reversed (negative)
  JOB->>AM: pending with matures_at <= now and no reversal → approved
  AD->>AM: create payout for period → sum approved
  AD->>AM: mark paid (reference) → entries paid
  AF->>SF: /affiliate portal (own login) shows earnings
```

## Payment: PromptPay ผ่าน Stripe + webhook

```mermaid
sequenceDiagram
  autonumber
  actor C as Customer
  participant SF as Storefront
  participant API as Medusa API
  participant ST as Stripe
  participant WH as /hooks/payment/stripe-promptpay_stripe

  C->>SF: choose PromptPay
  SF->>API: initiate payment session (pp_stripe-promptpay_stripe)
  API->>ST: create PaymentIntent (promptpay, THB)
  ST-->>API: client_secret
  API-->>SF: session + client_secret
  SF->>ST: confirm → QR code displayed
  C->>C: scan & pay in banking app
  ST-->>WH: payment_intent.succeeded (signed)
  WH->>API: authorize + capture session (idempotent per event)
  API->>API: complete cart → order (payment_status captured)
  SF->>API: poll session status
  API-->>SF: captured → order confirmation
  Note over SF,ST: not paid in 10 min → cancel session, cart intact
```
