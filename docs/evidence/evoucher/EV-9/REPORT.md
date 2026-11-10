# รายงาน QA — EV-9 follow-up e-voucher (PR #139)

- Spec: `docs/spec/02-evoucher.md` (AC-15, AC-16, AC-20 + regression AC-18, AC-19, AC-28, AC-29 ของ EV-5b; กฎข้อ 11)
- Commit ที่ทดสอบ: `9c77ad6` (sync กับ `origin/develop` แล้ว) วันที่ 2026-10-27
- สภาพแวดล้อม: worktree แยก, Node 22, Postgres 16 (`medusa_qa139`), Redis 7 (db 14), backend `medusa build` + `medusa start` (`NODE_ENV=production`, :9188, `ALLOW_TEST_PROVIDERS=true`), `EVOUCHER_ENCRYPTION_KEY` สุ่มต่อ run, Stripe key ปลอม, ชำระเงินด้วย `pp_system_default`
- อีเมล: provider Resend ของโปรเจกต์ + preload script ของ QA ดัก `fetch` ไป `api.resend.com` (ไม่ออก network จริง) วิธีเดียวกับ QA EV-5b

## ผลตาม Acceptance criteria

| AC | Result | Evidence |
|----|--------|----------|
| AC-15 | pass | integration `evoucher-admin-ui.spec.ts` 6/6 + e2e QA: threshold 20 / available 5 → `low_stock=true` ทั้ง list และ detail กับ `fields` หลายแบบ; import เพิ่มเป็น 25 → `false`; `04-pools-low-stock.png` |
| AC-16 | pass (test flaky ดู Defect 1) | e2e QA: 2 order ใช้ pool เดียวกัน → codes ของแต่ละ order ตรงกับ DB ไม่ปนกัน; integration `evoucher-links.spec.ts` ผ่าน 5/8 รอบ (ล้มที่ assertion ฝั่ง test) |
| AC-20 | pass | e2e PR `evoucher-admin-forms.spec.ts` (`01-partner-save-disabled.png`, `02-pool-form-labels.png`) + e2e QA: dblclick และคลิก 3 ครั้งใน tick เดียว → POST 1 ครั้ง, partner 1 แถว |
| AC-18 (regression) | pass | integration `evoucher-resend.spec.ts` 6/6 + e2e QA: Resend → notification ใหม่ 1 แถว |
| AC-19 (regression) | pass | `03-order-widget-resend.png`: dblclick Resend → POST 1 ครั้ง, disabled ระหว่างส่ง, toast |
| AC-28 (regression) | pass | provider ล้มตอน allocate → `allocated` → Resend → `delivered` |
| AC-29 (regression) | pass | resend 2 ครั้ง → `idempotency_key` ไม่ซ้ำ |

## Checklist ใน body ของ PR

| รายการ | Result | Evidence |
|--------|--------|----------|
| Create partner: คลิก label focus input ที่ถูกต้อง (4 ช่อง) | pass | ตรวจ `document.activeElement.id` |
| Create partner: dblclick Save → 1 แถว, ปุ่ม disabled ระหว่างรอ | pass | `01-partner-save-disabled.png` |
| Edit partner (drawer): label ผูก input, Save disabled, dblclick → POST 1 ครั้ง | pass | `05-edit-partner-save-disabled.png` |
| Create pool บน variant: label ทุกช่องผูก input (Partner select / How to use); dblclick Save → pool 1 อัน | pass | `02-pool-form-labels.png` |
| widget E-vouchers บน order: code masked ครบ เรียงเหมือนเดิม, Resend ใช้ได้ | pass | `03-order-widget-resend.png` |
| badge Low stock ยังขึ้น | pass | `04-pools-low-stock.png` |
| ข้อความ admin เป็นอังกฤษ | pass | ทุก screenshot |

## Negative / edge case

| กรณี | ผล |
|------|----|
| `GET /admin/evoucher/orders/<ไม่มีอยู่>/codes` | 200 `{"codes":[]}` |
| resend พร้อมกัน 2 request | `[200, 409]` |
| resend order ที่ไม่มีอยู่ | 404 |
| resend order ที่มีแต่ code `void` | 400 |
| resend ไม่มี token admin | 401 |

## Defect / ข้อสังเกต
1. (test flaky — ไม่ใช่โค้ดแอป) `evoucher-links.spec.ts` › "AC-16 … the order from a code" ล้ม 3/8 รอบ: `createOrders([...])` คืนผลไม่ตามลำดับ input → `orderA`/`orderB` สลับ ข้อมูล link ถูกต้อง — ส่งให้ builder แก้ test
2. code ที่ import ใน CSV เดียวกันมี `created_at` เท่ากัน ลำดับในกลุ่มไม่คงที่ (เหมือนเดิม) ควรเพิ่ม `id` เป็น key รอง
3. (ของเดิม, ขอบเขต EV-13) ตาราง E-vouchers บน order ล้นขอบที่ 1280px

Playwright report/trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR #139 (เก็บ 14 วัน)
