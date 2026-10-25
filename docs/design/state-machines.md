# State machines

ทุก transition ถูก implement เป็น workflow step ที่ idempotent หรือการอัปเดตแบบ atomic

## EvoucherCode

```mermaid
stateDiagram-v2
  [*] --> available : import CSV (inventory +1)
  available --> allocated : payment ถูก capture, claim แบบ atomic (SKIP LOCKED)
  allocated --> delivered : ส่งอีเมลแล้ว
  allocated --> available : order ถูกยกเลิกก่อนส่งมอบ
  available --> void : ใกล้หมดอายุ < 7 วัน หรือ admin void (inventory -1)
  delivered --> [*] : ใช้ที่ partner, ไม่ track ที่นี่
  void --> [*]
  note right of delivered : refund = manual, ไม่เรียกคืนโค้ด
```

## GroupBuyGroup

```mermaid
stateDiagram-v2
  [*] --> open : createGroupWorkflow
  open --> succeeded : ถึงเป้า (เวลาใดก็ได้) หรือถึงเป้า ณ ends_at
  open --> failed : ถึง ends_at แล้วแต่ไม่ถึงเป้า
  succeeded --> [*] : ทุก membership ชำระแล้วหรือหมดเวลา
  failed --> [*] : ยกเลิก draft order ทั้งหมดแล้ว
  note right of open : counter เป็น atomic ภายใต้ row lock
  note right of succeeded : pay_deadline_at = now + pay_within_hours
```

## GroupBuyMembership

```mermaid
stateDiagram-v2
  [*] --> joined : joinGroupWorkflow (สร้าง draft order แล้ว)
  joined --> awaiting_payment : กลุ่มสำเร็จ → payment collection + อีเมล
  joined --> cancelled : สมาชิกออกจากกลุ่ม หรือกลุ่มล้มเหลว
  awaiting_payment --> paid : payment.captured → convertDraftOrder
  awaiting_payment --> cancelled : เลย pay_deadline_at แล้ว
  paid --> [*] : lifecycle ของ order ตามปกติ
  cancelled --> [*] : draft order ถูกยกเลิก
```

## CommissionEntry (ledger)

```mermaid
stateDiagram-v2
  [*] --> pending : order.placed ในโปรแกรมที่ active
  pending --> approved : matures_at ≤ now และไม่มี reversal (job รายวัน)
  pending --> reversed : refund / cancel (แถวติดลบแยกต่างหาก)
  approved --> paid : payout ถูกมาร์คว่าจ่ายแล้ว
  approved --> reversed : refund ภายหลัง (แถวติดลบ)
  paid --> [*]
  reversed --> [*]
  note right of reversed : แถวต้นฉบับไม่ถูกแก้ไขเลย
```

## Affiliate

```mermaid
stateDiagram-v2
  [*] --> pending : สมัครผ่าน /auth/affiliate
  pending --> active : admin อนุมัติ
  active --> suspended : admin ระงับ
  suspended --> active : admin คืนสถานะ
  note right of active : ต้อง active ทั้งตอนคลิกและตอนสั่งซื้อ
```

## AffiliateProgram (การมองเห็น)

```mermaid
stateDiagram-v2
  [*] --> draft : admin สร้าง
  draft --> published : admin เผยแพร่ (มองเห็นบน portal)
  state published {
    [*] --> upcoming : starts_at > now
    upcoming --> active : ถึง starts_at
    active --> ended_window : ถึง ends_at
  }
  published --> ended : admin ปิด หรือพ้นช่วงเวลาแล้ว
  ended --> [*]
  note right of published : upcoming = "เร็ว ๆ นี้", แชร์ล่วงหน้าได้
```

## Order (มุมมอง group-buy)

```mermaid
stateDiagram-v2
  [*] --> draft_pending : join (is_draft_order, ยังไม่ชำระเงิน)
  draft_pending --> draft_awaiting_payment : กลุ่มสำเร็จ
  draft_pending --> canceled : กลุ่มล้มเหลว / สมาชิกออก
  draft_awaiting_payment --> order_captured : ชำระแล้ว → convertDraftOrderWorkflow
  draft_awaiting_payment --> canceled : หมดเวลาชำระเงิน
  order_captured --> fulfilled : Medusa fulfillment
  fulfilled --> [*]
  canceled --> [*]
```
