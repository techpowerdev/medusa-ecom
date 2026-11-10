# Sequence diagrams

participant ที่ชื่อลงท้ายด้วย 'module' คือ module ที่เราสร้างเอง ส่วนที่เหลือเป็นของ Medusa หรือ Stripe

## E-voucher: import โค้ด partner → ซื้อ → จัดสรร → ส่งอีเมล

```mermaid
sequenceDiagram
  autonumber
  actor C as ลูกค้า
  participant SF as Storefront
  participant API as Medusa API
  participant PAY as Stripe provider
  participant EV as evoucher module
  participant NT as Notification

  actor AD as Admin
  AD->>EV: import CSV จาก partner (โค้ด, PIN, วันหมดอายุ)
  EV->>API: ปรับ inventory level +N (Medusa Inventory)
  C->>SF: เพิ่ม voucher variant, checkout (ล็อกอินแล้ว)
  SF->>API: complete cart (เลือก digital shipping อัตโนมัติ, Medusa จองสต็อก)
  API->>PAY: สร้าง + confirm PaymentIntent
  PAY-->>API: payment ถูก capture (webhook)
  API-->>EV: event payment.captured (subscriber, worker)
  EV->>EV: claim โค้ด available 1 โค้ดต่อหน่วย (FOR UPDATE SKIP LOCKED, หมดอายุเร็วสุดก่อน)
  EV->>API: createOrderFulfillmentWorkflow (provider digital)
  EV->>NT: ส่ง evoucher.delivered (โค้ด, PIN, วิธีใช้ของ partner, วันหมดอายุ)
  EV->>EV: codes = delivered
  NT-->>C: อีเมลพร้อมโค้ด
  C->>SF: voucher ของฉัน
  SF->>API: GET /store/customers/me/evouchers
  API-->>SF: โค้ดของตัวเอง + สถานะ
```

## Flash sale: checkout ภายใต้ limit

```mermaid
sequenceDiagram
  autonumber
  actor C as ลูกค้า
  participant SF as Storefront
  participant API as Medusa API
  participant PR as Promotion module
  participant FS as flash_sale hook
  participant DB as Postgres

  SF->>API: GET /store/flash-sales/active
  API->>PR: คำนวณ promotion สำหรับ variant
  API-->>SF: countdown, flash_price, remaining
  C->>SF: เพิ่มสินค้า, checkout
  SF->>API: POST /store/carts/:id/complete
  API->>FS: completeCartWorkflow.validate hook (handler รวม: PROMO-1 check → FS-3)
  FS->>FS: lock flash_sale:customer:{campaign_id}:{customer_id}
  FS->>DB: transaction: usage + n <= per_customer_limit, upsert usage,<br/>UPDATE units_sold = units_sold + n WHERE total_cap IS NULL OR units_sold + n <= total_cap,<br/>insert FlashSaleReservation(cart_id)
  alt เกิน limit / ไม่มีแถวถูกอัปเดต
    FS-->>API: throw FLASH_LIMIT_EXCEEDED / FLASH_SOLD_OUT (rollback ทั้ง transaction)
    API-->>SF: 400
  else ผ่าน
    API->>PR: บันทึก promotion usage
    alt step ถัดไปล้ม
      API->>FS: compensation → คืน usage + units_sold ตาม reservation ของ cart
    else สำเร็จ
      API-->>SF: สร้าง order แล้ว
    end
  end
  Note over API,FS: order.canceled / refund เต็มจำนวน → FS-2 คืน usage + units_sold (released_at, idempotent)
```

## Group buy 1/2: join (draft order)

```mermaid
sequenceDiagram
  autonumber
  actor A as ลูกค้า
  participant SF as Storefront
  participant GB as group_buy module
  participant M as Medusa core
  A->>SF: เข้าร่วมกลุ่ม (ล็อกอินแล้ว)
  SF->>GB: POST join พร้อม cart id
  GB->>GB: lock แถวกลุ่ม, ตรวจ limit และต้องไม่มี promo code อื่น
  GB->>M: ใช้ promotion code ของกลุ่มกับ cart
  GB->>M: createOrderWorkflow เป็น draft order (ยังไม่ชำระเงิน)
  GB->>GB: สร้าง membership joined, เพิ่ม counter
  GB-->>SF: 201 membership และ draft order
  SF-->>A: รอให้กลุ่มถึงเป้า
```

## Group buy 2/2: ถึงเป้า, ชำระเงิน

```mermaid
sequenceDiagram
  autonumber
  participant GB as group_buy module
  participant M as Medusa core
  participant NT as Notification
  actor A as ลูกค้า
  participant SF as Storefront
  participant ST as Stripe
  participant JOB as Scheduled job
  GB->>GB: ถึงเป้า, succeedGroupWorkflow (idempotent)
  GB->>M: สร้าง payment collection บน draft order แต่ละใบ
  GB->>NT: อีเมลแจ้งกลุ่มสำเร็จพร้อม deadline ชำระเงิน
  NT-->>A: อีเมลพร้อม pay link
  A->>SF: เปิดหน้าชำระเงิน, เลือก PromptPay
  SF->>M: payment session บน payment collection ของ order
  M->>ST: PaymentIntent promptpay
  ST-->>M: webhook payment succeeded
  M-->>GB: event payment captured
  GB->>M: convertDraftOrderWorkflow
  GB->>GB: membership paid
  JOB->>GB: ทุก 1 นาที, ยังไม่ชำระหลัง deadline ให้ยกเลิก order และส่งอีเมล
```

## Group buy: ไม่ถึงเป้า

```mermaid
sequenceDiagram
  autonumber
  participant JOB as Scheduled job (1 นาที)
  participant GB as group_buy module
  participant API as Medusa Order
  participant NT as Notification
  actor M as สมาชิก

  JOB->>GB: กลุ่มที่ open และ ends_at <= now
  GB->>GB: ประเมินเป้า (orders | units | people)
  alt ถึงเป้า
    GB->>GB: succeedGroupWorkflow
  else ไม่ถึงเป้า
    GB->>GB: failGroupWorkflow (idempotent)
    loop แต่ละ membership(joined)
      GB->>API: cancelOrderWorkflow(draft order)
      GB->>GB: membership = cancelled
    end
    GB->>NT: อีเมล "กลุ่มไม่สำเร็จ, ไม่มีการเรียกเก็บเงิน"
    NT-->>M: การแจ้งเตือน
  end
```

## Affiliate: โชว์สินค้า → แชร์ → คลิก → สั่งซื้อ → ค่าคอม → จ่าย

```mermaid
sequenceDiagram
  autonumber
  actor AF as Affiliate
  actor B as ผู้ซื้อ (customer)
  participant SF as Storefront
  participant AM as affiliate module
  participant API as Medusa Order
  participant JOB as Daily job
  actor AD as Admin

  AF->>SF: /affiliate portal → สินค้า (ได้ค่าคอมตอนนี้ / เร็ว ๆ นี้)
  SF->>AM: GET /affiliate/products?status=upcoming
  AM->>API: resolve scope ของโปรแกรม → สินค้า, ราคา, รูปภาพ
  AM-->>SF: การ์ดพร้อม % ค่าคอม, วันที่, share_url
  AF->>SF: แชร์สินค้า x (คัดลอกลิงก์ / Web Share)
  AF-->>B: /r/ann?to=/products/x
  B->>SF: คลิกลิงก์
  SF->>AM: GET /store/affiliate/r/ann
  AM-->>B: ตั้ง signed cookie aff=HMAC token, 302 ไป /products/x
  B->>SF: เพิ่มลง cart (ล็อกอินแล้ว)
  SF->>API: cart.metadata.affiliate_token = ค่าจาก cookie
  B->>SF: checkout + ชำระเงิน
  API-->>AM: order.placed (subscriber)
  AM->>AM: ตรวจลายเซ็น token, อายุคลิก <= window, โปรแกรม active, affiliate active, email != ผู้ซื้อ
  alt ถูกต้อง
    AM->>AM: สร้าง Attribution (order_id ไม่ซ้ำ)
    AM->>AM: CommissionEntry pending ต่อ line item ที่เข้าเกณฑ์, matures_at = now + hold_days
  else ไม่ถูกต้อง / ไม่มีโปรแกรม
    AM->>AM: log, ไม่สร้าง entry
  end
  API-->>AM: refund/cancel → CommissionEntry reversed (ติดลบ)
  JOB->>AM: pending ที่ matures_at <= now และไม่มี reversal → approved
  AD->>AM: สร้าง payout สำหรับรอบ → รวมยอด approved
  AD->>AM: มาร์คว่าจ่ายแล้ว (reference) → entries paid
  AF->>SF: /affiliate portal (ล็อกอินของตัวเอง) แสดงรายได้
```

## Payment: PromptPay ผ่าน Stripe + webhook

```mermaid
sequenceDiagram
  autonumber
  actor C as ลูกค้า
  participant SF as Storefront
  participant API as Medusa API
  participant ST as Stripe
  participant WH as /hooks/payment/stripe-promptpay_stripe

  C->>SF: เลือก PromptPay
  SF->>API: เริ่ม payment session (pp_stripe-promptpay_stripe)
  API->>ST: สร้าง PaymentIntent (promptpay, THB)
  ST-->>API: client_secret
  API-->>SF: session + client_secret
  SF->>ST: confirm → แสดง QR code
  C->>C: สแกนและจ่ายในแอปธนาคาร
  ST-->>WH: payment_intent.succeeded (signed)
  WH->>API: authorize + capture session (idempotent ต่อ event)
  API->>API: complete cart → order (payment_status captured)
  SF->>API: poll สถานะ session
  API-->>SF: captured → ยืนยัน order
  Note over SF,ST: ไม่ชำระภายใน 10 นาที → ยกเลิก session, cart ยังคงอยู่
```
