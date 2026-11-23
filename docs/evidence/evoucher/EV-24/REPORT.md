# QA — EV-24 ปุ่ม Retry allocation (PR #504)

- Spec: `docs/spec/02-evoucher.md` กฎข้อ 39/40, AC-54
- Commit ที่ตรวจ: `b7496456` (branch `feat/EV-24-retry-allocation`)
- สภาพแวดล้อม: backend production build (`NODE_ENV=production medusa build` + `medusa start`), DB ของ qa (migrate + seed), Playwright 1.64.1 chromium, payment `pp_system_default`
- Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #504 (job e2e, เก็บ 14 วัน)

## Acceptance criteria

| AC | Result | Evidence |
|----|--------|----------|
| AC-54 order backordered เห็น `evoucher-retry-allocation` (อยู่ข้าง `evoucher-resend` เมื่อ order มี code ด้วย) | pass | qa504-01-backordered-mixed.png; e2e `evoucher-admin-retry-allocation.spec.ts` 2/2 passed |
| AC-54 dblclick → POST 1 ครั้ง (นับ request) + toast "Still backordered — import more codes first", badge คงอยู่ | pass | e2e ของ PR (posts = 1); QA-1: หน่วง response 1.5 วินาทีแล้วกด 4 ครั้ง (click, force click, dblclick) → POST 1 ครั้ง ปุ่ม disabled ระหว่างส่งแล้วกลับมา enabled |
| AC-54 import code แล้วกด → toast "Codes allocated" (success), badge และปุ่มหายโดยไม่ reload, code ขึ้นตารางเป็น delivered | pass | qa504-02-allocated-no-reload.png; QA-1: marker `window.__qa504` ยังอยู่, main-frame navigation = 0, ตาราง 2 แถว delivered, ปุ่ม Resend email ยังอยู่ |
| AC-54 order ที่ไม่มี line ค้าง → ไม่เห็นปุ่ม | pass | e2e ของ PR test ที่ 2 passed |
| กฎข้อ 40 (ส่วนเกินตาม review #472) `stuck_line_item_ids` ไม่ว่าง → toast warning ให้ใช้ Resend email ไม่ขึ้น "Codes allocated" | pass (mock response) | qa504-03-stuck-warning.png; QA-2: icon สีส้ม (warning); กรณี stuck + backordered ได้ข้อความรวม "Still backordered — import more codes first. Some codes were allocated but not emailed — use Resend email" |
| กฎข้อ 40 4xx → `toast.error` ข้อความจาก API | pass | qa504-04-uncaptured-error.png (backend จริง); QA-3 mock 400 → toast error "QA mock: cannot allocate" ปุ่มกลับมา enabled badge คงอยู่ |

## Negative / edge case

| กรณี | Result | รายละเอียด |
|------|--------|------------|
| order ยังไม่ captured (ตั้งธง backordered ตรงใน `order_item.metadata`) → กดปุ่ม | pass | backend จริงตอบ 400 `not_allowed` "Cannot allocate e-voucher codes before the order payment is captured" → toast error ข้อความเดียวกัน ไม่มี code ถูก claim |
| order canceled (ยกเลิกผ่าน `POST /admin/orders/:id/cancel` → 200 โดยธงยังอยู่ 1 line) | pass | ไม่เห็นปุ่มและ badge; ยิง API ตรง → 400 `not_allowed` "Cannot allocate e-voucher codes for a canceled order" |
| ยิง API พร้อมกัน 3 request หลัง import 1 code | pass | ทั้ง 3 ตอบ 200 มีเพียง request เดียวที่ `allocated_line_item_ids` มี line อีกสองตัวได้ผลว่าง; code delivered 1 และธงถูกล้าง |
| ไม่มี token admin | pass | 401 |
| admin คงภาษาอังกฤษ | pass | regex อักษรไทยไม่ match ข้อความใน widget, ปุ่ม และ toast |

## ข้อสังเกต (ไม่ใช่ defect)
- "Still backordered — import more codes first" แสดงเป็น `toast.success` (icon เขียว) ตรงตามกฎข้อ 40 แต่อ่านแล้วเหมือนสำเร็จทั้งที่ยังค้าง ถ้าต้องการเปลี่ยนเป็น `warning`/`info` ต้องให้ planner แก้กฎข้อ 40
- ข้อความที่ 3 (stuck → Resend email) ยังไม่อยู่ในกฎข้อ 40 PR ขอให้ planner เพิ่มไว้แล้ว

## Defect
ไม่พบ
