# รายงาน QA — EV-5b ส่งอีเมล e-voucher ซ้ำ (PR #111)

- Spec: `docs/spec/02-evoucher.md` (AC-18, AC-19, AC-28, AC-29, กฎข้อ 17, 19)
- Commit ที่ทดสอบ: `b925b4f` (branch `feat/EV-5b-resend-email`) วันที่ 2026-10-27
- สภาพแวดล้อม: worktree แยก, Node 22, Postgres 16 (`medusa_qa111`), Redis 7 (db 12), backend `medusa build` + `medusa start` (:9132),
  storefront `next dev` (:8132), `EVOUCHER_ENCRYPTION_KEY` สุ่มต่อ run, ชำระเงินด้วย `pp_system_default` (ไม่ใช้ Stripe)
- จำลอง provider อีเมล: ใช้ provider Resend ของโปรเจกต์ แต่ดัก `fetch` ไป `api.resend.com` ด้วย preload script ของ QA (ไม่ออก network จริง)
  เปิด toggle → HTTP 500 (provider ล้ม), ปิด → สำเร็จ ไม่ได้แก้โค้ดแอป

## ผลตาม Acceptance criteria

| AC | Result | Evidence |
|----|--------|----------|
| AC-18 | pass | integration `evoucher-resend.spec.ts` › "AC-18 resend delivered codes" ผ่าน 3/3 (notification ใหม่ 1 รายการมี code เดิม 2 รายการ สถานะไม่เปลี่ยน; ไม่มี code → 400; ไม่มี token → 401) + e2e: order ที่มีแต่ code `void` → 400, ไม่มี token → 401 |
| AC-19 | pass | `01-resend-success.png` (dblclick → POST 1 ครั้ง, toast "E-voucher email resent with 2 codes", notification `evoucher.delivered` จาก 1 เป็น 2), `05-resend-in-flight-disabled.png` (ปุ่ม disabled + loading ระหว่างส่ง) |
| AC-28 | pass | integration "AC-28 / AC-29" ผ่าน + e2e `03-allocated-to-delivered.png`: code `allocated` 2 รายการ (ส่งล้ม) → กด Resend → badge `delivered`, Delivered to = อีเมล order, API มี `delivered_at` |
| AC-29 | pass | integration "uses a new idempotency key on every resend" ผ่าน + ตรวจ DB: หลังแถว `status=failure` resend 2 ครั้งติดกันได้ 200 ทั้งคู่, key `evoucher-resend:<order_id>:<uuid>` ไม่ซ้ำกันทุกแถว, ไม่มี `NOT_FOUND` |

## Checklist AC-19 ใน body ของ PR

| รายการ | Result | Evidence |
|--------|--------|----------|
| order ที่มี code `delivered` แสดงปุ่ม Resend email | pass | `01-resend-success.png` |
| order ที่มีแต่ code `void` ไม่มีปุ่ม / order ที่ไม่มี voucher ไม่มี widget | pass | `04-void-no-resend-button.png` และ e2e (order สินค้า physical ไม่มี heading E-vouchers) |
| คลิก → disabled + loading, toast สำเร็จ, notification ใหม่ 1 รายการ | pass | `05-resend-in-flight-disabled.png`, `01-resend-success.png` |
| dblclick → `POST .../resend` 1 ครั้ง | pass | นับ request ใน e2e ได้ 1 (ทั้งแบบปกติและแบบหน่วง response 1.5 วินาที) |
| code `allocated` → `delivered` + Delivered to มีอีเมล (ตาราง refetch) | pass | `03-allocated-to-delivered.png` |
| provider ล้ม → toast "Could not send the e-voucher email: ..." และ code คง `allocated` | pass | `02-resend-provider-failed.png` |
| ข้อความ admin เป็นอังกฤษ | pass | ทุก screenshot |

## Negative / edge case

| กรณี | ผล |
|------|----|
| resend พร้อมกัน 2 request | `[200, 409]` (`EVOUCHER_RESEND_IN_PROGRESS`) |
| provider ล้มแล้ว resend ซ้ำทันที | 500 อีกครั้ง (ไม่ใช่ 409 → lock ถูกปล่อย); provider กลับมา → 200 |
| order id ที่ไม่มีอยู่ | 404 |
| order ที่มีแต่ code `void` | 400 และไม่มีปุ่ม |
| ไม่มี token admin | 401 |

ข้อสังเกต (ไม่ใช่ defect ตาม spec): toast error แสดงข้อความภายในของ Notification module รวม id `noti_...` ยาวเกินจำเป็น;
ตาราง widget E-vouchers (EV-6) ล้นขอบ container ที่ 1280px เมื่อมีอีเมลในคอลัมน์ Delivered to (PR แจ้งไว้แล้วว่าเป็นของเดิม)

## ผลการรัน

    integration (http): evoucher-resend.spec.ts            6 passed, 6 total
    e2e PR:             e2e/evoucher-admin-resend.spec.ts  1 passed
    e2e QA:             e2e/evoucher/ev5b-qa.spec.ts       phase fail 1 passed, phase ok 4 passed

Playwright report/trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR #111 (เก็บ 14 วัน)

## Defect

ไม่พบ defect ที่ทำให้ AC ใดไม่ผ่าน
