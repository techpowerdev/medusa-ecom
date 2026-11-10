# QA — GB-7b รายการคำสั่งซื้อแบบกลุ่มในหน้า account (PR #223)

- Spec: `docs/spec/04-group-buying.md` (AC-16 ส่วน account + พร้อมเพย์, AC-2, กฎข้อ 13)
- Commit ที่ตรวจ: `e55c70b` (branch `feat/GB-7b-account-group-orders`)
- สภาพแวดล้อม: prod build (`medusa build` + `medusa start`, `next build` + `next start`), `NODE_ENV=production`,
  `ALLOW_TEST_PROVIDERS=true`, DB และ Redis db แยก, region `th`; ลูกค้า login ทุก test (ไม่มี guest)
- ในเครื่องไม่มี Stripe publishable key → test Stripe (AC-2, พร้อมเพย์) ใช้ผลจาก CI run ของ commit เดียวกัน
- Playwright report/trace ฉบับเต็ม: CI artifact ของ https://github.com/techpowerdev/medusa-ecom/actions/runs/41669555106 (job `storefront-e2e`)

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-16 (account) แสดง "ชำระเงินภายใน <time>" (`group-pay-deadline`) | pass | `02-account-group-pay-deadline.png`, `05-qa-mobile-375-pay-deadline.png`; ข้อความตรงกับ `pay_deadline_at` ของ GB-8 ในเวลาไทย (Asia/Bangkok) |
| AC-16 (account) ลิงก์ "ชำระเงิน" ไปหน้า pay ของ PAY-3b | pass | `href=/th/account/orders/<order_id>/pay` คลิกแล้วเห็น `order-pay-form` |
| AC-16 (account) สถานะรอกลุ่ม / ยกเลิก / หมดเวลาชำระเงิน เป็นภาษาไทย | pass | `01-account-group-waiting.png`; ตรวจ `data-status` = waiting / cancelled / expired + regex อักษรไทย |
| กฎข้อ 13 ออกจากกลุ่ม (ยืนยันก่อน, กดยกเลิกการยืนยันได้) | pass | e2e ของ builder (local + CI) — membership เป็น `cancelled` |
| กฎข้อ 13 ออกไม่ได้ → error ไทยไม่หายหลัง `router.refresh()` | pass | `03-qa-leave-error-after-refresh.png` (กลุ่มหมดเวลา `ends_at <= now` ระหว่างเปิดหน้า: ปุ่มหายไป error ยังอยู่หลังรอ 3 วินาที) |
| AC-16 (พร้อมเพย์) จากลิงก์ในหน้า account → QR → ชำระสำเร็จ | pass (CI) | CI run 41669555106 test #116 (Stripe test mode) |
| AC-2 บัตร 4242 → order ปกติ `captured`, membership `paid`, รายการแสดง "ชำระแล้ว" | pass (CI) | CI run 41669555106 test #115 |
| มือถือ 375px | pass | `04-qa-mobile-375-leave-confirm.png`, `05-qa-mobile-375-pay-deadline.png` — `scrollWidth = 375` ไม่มีเลื่อนแนวนอน ปุ่มอยู่ในจอ |

## Negative / edge case

| กรณี | ผล |
|------|----|
| หมดเวลาชำระเงิน (`awaiting_payment` เลย `pay_deadline_at`) | pass — แสดง "หมดเวลาชำระเงิน" ไม่มีลิงก์ชำระเงินและปุ่มออก |
| ไม่ login แล้วเปิด `/th/account/orders` | pass — เห็น `login-page` ไม่เห็น `group-orders` |
| ลูกค้า B เปิดหน้า orders / leave membership ของ A | pass — ไม่เห็นแถวของ A; API ตอบ 404 และ A ยัง `joined` |
| ยิง leave พร้อมกัน 2 request | pass — ได้ 200 + 400 ตัวนับกลุ่มลดครั้งเดียว (เป็น 0); reload แล้วแสดง "ยกเลิก" |
| dblclick ปุ่มยืนยันใน UI | pass — server action leave ถูกเรียกครั้งเดียว ไม่มี error |
| reload ทั้งหน้าหลังเห็น error | ตามคาด — state ฝั่ง client หาย แถวแสดงสถานะล่าสุดและไม่มีปุ่มออก |

## Defect
ไม่พบ

## Observation (ไม่ block)
1. ที่ 375px กล่องยืนยันอยู่ในแถวเดียว ปุ่ม "ออกจากกลุ่ม" ตัดคำเป็น 2 บรรทัดและข้อความยืนยันแคบ (ยังไม่ล้นจอ) — ควรให้ wrap เป็นสองแถวบนมือถือ
2. ลูกค้าที่มีแต่คำสั่งซื้อแบบกลุ่มจะเห็น empty state "ยังไม่มีคำสั่งซื้อ" ของ `OrderOverview` เดิมต่อจาก section กลุ่ม อาจทำให้สับสน
3. แถว `joined` ที่กลุ่มหมดเวลาแล้วแต่ job ยังไม่ตัดสิน ยังแสดง "รอกลุ่มครบเป้าหมาย" (ไม่มีปุ่มออก) ซึ่งสอดคล้องกับ backend
