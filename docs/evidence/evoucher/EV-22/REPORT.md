# QA EV-22 — PR #446 (spec 02 "Follow-up รอบ 40", AC-52)

ทดสอบบน prod build (`medusa build` + `medusa start` จาก `.medusa/server`) commit `58f11dbd`, จ่ายด้วย manual provider (pp_system_default) แล้ว capture โดย admin
e2e: `evoucher-admin-backordered.spec.ts` (PR) 1 passed, `evoucher-qa446-backordered.spec.ts` (qa) 3 passed
report/trace ฉบับเต็มอยู่ใน CI artifact ของ job e2e (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-52 line A ได้ code + line B ค้าง → badge `evoucher-backordered-badge` 1 ตัว ตาราง code 1 แถว | pass | 01-backordered-badge.png, qa446-1-partial-backordered.png |
| AC-52 `GET /admin/orders/:id?fields=*items` คืน `evoucher_backordered=true` เฉพาะ line ที่ค้าง | pass | step ใน test 1 (ตรวจ API) + DB: `order_item.metadata` และ `order_line_item.metadata` มีธงตรงกัน |
| AC-52 ทุก line ค้าง (ไม่มี code เลย) → widget ยังแสดง มี badge 2 ตัว (ตัวละ line) และไม่มีตาราง | pass | qa446-3-all-backordered.png |
| AC-52 order ปกติ (code ครบ) → ไม่มี badge ตาราง 2 แถว | pass | qa446-4-normal-order.png |
| AC-52 เติมรหัสแล้วรัน allocation ซ้ำ → ธงถูกล้าง badge หาย ตาราง 3 แถว | pass | qa446-2-after-reallocate.png |
| 1280px ไม่ล้น (document ไม่มี scroll แนวนอน, badge อยู่ในกรอบ widget) | pass | `noHorizontalOverflow` ใน test 1 และ 2 |

## Negative / edge case
| กรณี | ผล |
|------|----|
| รัน allocation ซ้ำครั้งที่สองหลังส่งมอบครบ (idempotent / payment.captured replay) | pass: code ยังเป็น 3 ไม่มีธงกลับมา |
| order ที่ backordered แล้วมี version ใหม่จาก fulfillment ของ line อื่น | pass: order_item ทุก version มีธง |
| ยกเลิก order ที่ทุก line ค้าง | ข้อสังเกต: ธงยังเป็น `true` บน order ที่ canceled (ส่งให้ builder แก้ใน PR เดียวกัน) |
