# ROADMAP — milestone, ลำดับ PR, สถานะ

อัปเดตล่าสุด: 2026-11-24 · ไฟล์นี้เก็บเฉพาะ "ตอนนี้" — ประวัติรายรอบ/ตาราง task ทุกตัวอยู่ที่
[`docs/roadmap/history.md`](roadmap/history.md) และ follow-up เก่า (รอบ 13–39) อยู่ที่
[`docs/roadmap/followups-archive.md`](roadmap/followups-archive.md)

## สรุปสถานะ (อ่านตรงนี้ก่อน)

- **ตอนนี้**: รอบ 42 → release **v0.3.1** — เสร็จ 18/21 task (PAY-19 ◐ #548; PAY-20/21 ☐ คลื่น D)
- **รอ owner ตัดสิน**: ADR-029 + spec 06 Q-P18–Q-P20 (คืนเงินล้ม/ค้าง — บล็อก PAY-20/21)
- **ขั้นต่อไป**: PAY-19 + PAY-20 → PAY-21 merge → planner ปิดรอบ 42 → owner merge `develop → main` (v0.3.1) → go-live

### Release

| Release | สถานะ | วันที่ | PR / tag | เนื้อหาหลัก |
|---|---|---|---|---|
| v0.1.0 | 🚀 | 2026-11-11 | #342 (`15fce017`), tag `v0.1.0` | ร้านค้าหลัก + task ทุกตัวที่ merge ถึงวันนั้น (เงื่อนไข: CORE-12/12b/17/18, OPS-21, EV-15, CORE-55) |
| v0.2.0 | 🚀 | 2026-11-19 | #423 (`e274d387`), tag `v0.2.0` | task ใน milestone/Admin UI ที่ merge หลัง v0.1.0 ถึงรอบ 39 |
| v0.3.0 | 🚀 | 2026-11-24 | #521 (`47c3e545`), tag `v0.3.0`, [GitHub Release](https://github.com/techpowerdev/medusa-ecom/releases/tag/v0.3.0) | แก้จากการทดสอบ manual (รอบ 40 = 32 task) + รอบ 41 (36 task; PAY-13 ✕) |
| v0.3.1 | ◐ กำลังทำ | — | — | รอบ 42 (21 task) — ตารางด้านล่าง |
| go-live | ☐ | — | — | หลัง v0.3.1 + Go-live checklist (หัวข้อ "ก่อนเปิดร้านจริง") |
| v1.0.0 | ☐ ยังไม่กำหนดเงื่อนไขใหม่ | — | — | ป้ายเดิมของ M7; ป้าย v0.3.0–v1.0 ของ M3–M7 เป็นแผนเดิมก่อนรวม release ไม่ผูกกับเลข release จริง |

### สัญลักษณ์

☐ ยังไม่ทำ · ◐ อยู่ใน PR · ☑ merge เข้า develop แล้ว · 🚀 release แล้ว · ✕ ปิด (owner ไม่ทำ / ไม่ต้องทำ) · ⏸ เลื่อนหลัง v1.0 · ∥ ทำขนานได้

- `docs/spec/*.md` คง ☑ = merge เข้า develop แล้ว **ไม่ sync ☑→🚀** — ROADMAP เป็นที่เดียวที่บอกสถานะ release (owner 2026-11-12)
- task ที่ merge หลัง v0.3.0 ใช้ ☑ จนถึง release v0.3.1 · บันทึกประวัติคงสัญลักษณ์ ณ วันที่บันทึก

## รอบ 42 → release v0.3.1 (รอบปัจจุบัน)

ที่มา: follow-up ของ review/qa/builder #462–#519 (ตรวจบน develop `8d509076`) · owner สั่งทำ · เลขกฎ/AC อยู่ในหัวข้อ
"Follow-up รอบ 42" ของแต่ละ spec · ไม่บล็อก v0.3.0 (Q-R42 = ก) · Depends "—" = เฉพาะ PR เอกสารปิดรอบ 41 (merge แล้ว)

| คลื่น | Task | spec | งาน (สั้น) | Depends | สถานะ |
|---|---|---|---|---|---|
| A | CORE-89 | 01 | สรุปขั้น payment ไม่ตัดคำที่ 375px | — | ☑ #524 |
| A | CORE-90 | 01 | a11y ปุ่มสลับ login/register ≥ 44px + testid ไม่ซ้ำ | — | ☑ #525 |
| A | CORE-91 | 01 | dropdown ตะกร้าไม่บอกว่าว่างระหว่างโหลด/ล้ม | — | ☑ #539 |
| A | CORE-92 | 01 | overview/orders hygiene + a11y `SearchPagination` | — | ☑ #535 |
| A | CORE-93 | 01 | chip ป้ายกำกับบน `/store` + หัว `OptionsPicker` ไม่แสดง `(n)` (Q-C17 = ก) | — | ☑ #533 |
| A | CORE-94 | 01 | hygiene storefront (search, `cart.ts`, metadata, `COMPARE`) | — | ☑ #530 |
| A | EV-26 | 02 | toast "Still backordered" + helper e2e/ข้อความ error ร่วม | — | ☑ #527 |
| A | FS-25 | 03 | e2e hygiene flash: helper ร่วม + PDP `?v_id=` | — | ☑ #531 |
| A | GB-31 | 04 | พิสูจน์ lock AC-63b + guard อ่าน link ครั้งเดียว + test | — | ☑ #529 |
| A | GB-32 | 04 | job หมดเวลาชำระ: เพดาน 200 ต่อรอบ (Q26 = ก) | — | ☑ #534 |
| A | AF-27 | 05 | ลบโหมด grouped ของ `summarizeCommissionEntries` | — | ☑ #528 |
| A | PAY-18 | 06 | `/api/payment-return` failed+5xx → `step=payment` + notice ตะกร้า | — | ☑ #532 |
| A | OPS-35 | 07 | redact backtick/JSON escape/`'` + runbook | — | ☑ #536 |
| A | ADM-47 | 08 | focus กลับปุ่ม `…` หลังปิดฟอร์มจากเมนู | — | ☑ #526 |
| B | PAY-16 | 06 | สถานะขั้น payment: notice/guard/timeout/radio | CORE-89 | ☑ #541 |
| B | PAY-17 | 06 | ข้อความไทยของ error Stripe ขั้น review + PromptPay poll | CORE-90 | ☑ #540 |
| B | ADM-48 | 08 | Enter ค้างบน Save ไม่เปิดฟอร์มใหม่ + nit #513 | ADM-47 | ☑ #542 |
| C | CORE-95 | 01 | จ่ายบัตรแล้ว session หมด → notice บนหน้า login แล้วไป orders (Q-C16 = ก) | PAY-17 | ☑ #546 |
| C | PAY-19 | 06 | PromptPay คืนเงินครบ: notice + ลิงก์ตะกร้าแทนปุ่มจ่าย (ขอบเขตย่อตาม Q-P13 = ก) | PAY-17, CORE-95 (#546) | ◐ #548 |
| D | PAY-20 | 06 | job ตรวจ refund ล้ม/ค้าง → alert `OPS_ALERT_EMAIL` (ADR-029 ก) — ต้องทำก่อน go-live | ADR-029 accepted (Q-P18) | ☐ |
| D | PAY-21 | 06 | webhook `refund.failed`/`refund.updated` → alert (ADR-029 ข) — ต้องทำก่อน go-live | PAY-20 | ☐ |

- merge train: #537 (CORE-89, CORE-90, ADM-47, EV-26, AF-27, GB-31, CORE-94, PAY-18) · #538 (CORE-93, GB-32, CORE-92, OPS-35) ·
  #543 (FS-25, CORE-91) · #544 (PAY-17, ADM-48) · #545 (PAY-16) · CORE-95 #546 (merge ตรง)
- **PAY-19 (owner Q-P13 = ก 2026-11-24)**: ตัดสินที่ `PaymentButton` ขั้น review เมื่อไม่มี session + คืนเงินครบ
  (เพราะ `refundPaymentAndRecreatePaymentSessionWorkflow` สร้าง session ใหม่ไม่สำเร็จ) — spec 06 กฎ 21/AC-32 แก้ใน PR ของ PAY-19
- **ไฟล์ร่วมที่เหลือ**: `payment-button/index.tsx` CORE-95 → PAY-19 (#546 merge แล้ว — PAY-19 #548 แก้ต่อ) ·
  `ci.yml` PAY-19 → PAY-21 (ตัวหลัง sync) · `templates.ts`/`production.md` PAY-20 → PAY-21
- **คลื่น D (ADR-029, spec 06 กฎ 22–24)**: PAY-20 ∥ PAY-19 (คนละ app) → PAY-21
- **ปิดรอบ**: PAY-19 + PAY-21 merge → planner ปิดรอบ 42 → owner merge `develop → main` = v0.3.1
- **คำตัดสิน owner ของรอบ**: 2026-11-23 Q-R42 = ก, spec 04 Q26 = ก, spec 01 Q-C16 = ก, spec 06 Q-P12 = ข (ทำ PAY-19),
  spec 08 Q13 = ก (ข้อยกเว้น testid ที่ 4 — ADR-018 ภาคผนวก + `CLAUDE.md`) · 2026-11-24 spec 01 Q-C17 = ก (CORE-93), spec 06 Q-P13 = ก (PAY-19),
  spec 06 Q-P14 = ข, Q-P15, Q-P16 (PAY-19), Q-P17 = ทำใน v0.3.1 (→ ADR-029, PAY-20/21)
- งาน/ไม่ทำ/ไฟล์ร่วมฉบับเต็มตอนเสนอรอบ: history หัวข้อ "รอบ 42"

## คำถามที่รอ owner

- **รอบ 42**: ADR-029 (proposed) + spec 06 Q-P18 (ทางเลือก — Recommended ก+ข), Q-P19 (ไม่แก้ยอดใน Medusa), Q-P20 (issue upstream)
- **follow-up เก่า (รอบ 30–39)**: ข้อ "ก. ต้องให้ owner ตัดสิน" ปิดครบทุกรอบ — ข้อ ข/ค (hygiene/backlog) ยังไม่มี task
  รอ owner สั่ง ดู [`followups-archive.md`](roadmap/followups-archive.md)
- **ต้องตัดสินก่อน go-live** (ไม่บล็อก v0.3.1):
  1. spec 06 Q1 — บัญชี Stripe live เป็นนิติบุคคลไทยและเปิด PromptPay (Go-live ข้อ 6; owner ยังไม่ยืนยัน)
  2. spec 01 Q-F1 — ค่าส่งจริงแทน ฿10 placeholder (Go-live ข้อ 5)
  3. staging (ADR-027 ยังไม่เขียน) — ต้องมีก่อนวัด checkout แบบ OPS-26 ซ้ำบน staging และก่อน OPS-19 ⏸

## ก่อนเปิดร้านจริง (go-live)

ทำตาม `docs/ops/production.md` หัวข้อ "Go-live checklist" ข้อ 1–14 (+ ข้อ 15 หลัง PAY-21) บน prod (รวม `check:go-live`) โดยเฉพาะข้อที่เพิ่มในรอบ 40–41:

| ข้อ | งาน | ที่มา |
|---|---|---|
| 10 | Postgres prod `LC_CTYPE` ไม่ใช่ `C`/`POSIX` (`check:go-live` ตรวจ) | CORE-75, OPS-33 |
| 11 | รัน `lowercase-emails.ts` แปลงอีเมลเดิมเป็นตัวเล็ก | CORE-80/81 |
| 12 | backfill ธง `evoucher_backordered` | EV-25 |
| 13 | log ของ prod ไม่มี PII | OPS-33 |
| 14 | วัด p95 `POST /store/search` กับ catalog จริง (> ~10k สินค้าหรือ p95 > 300ms → ADR) | CORE-75 |
| 15 | endpoint live สมัคร `refund.updated`/`refund.failed` + ทดสอบบัตร `4000 0000 0000 5126` ว่า alert ถึง ops (ข้อที่ PAY-21 เพิ่ม) | PAY-21, ADR-029 |

เพิ่มเติม (ไม่ใช่ task): ข้อ 5–6 ตามคำถามด้านบน · smoke test บน production (`check:go-live` + `tools/ops/smoke-*.sh`) ·
ตั้ง `OPS_ALERT_EMAIL`, `EVOUCHER_ADMIN_EMAIL`, `RESEND_API_KEY` · วัด OPS-26 ซ้ำบน staging (ต้องมี ADR-027 ก่อน)

## Milestone ภาพรวม

รายการ task ทุกตัวพร้อมเลข PR: [`history.md`](roadmap/history.md) (หัวข้อ M0–M7, Admin UI, Release v0.3.0, รอบ 41)

| Milestone | spec | สถานะ | task | หมายเหตุ |
|---|---|---|---|---|
| M0 Scaffold | — | 🚀 | 1/1 | เอกสาร, agents, CI |
| M1 ร้านค้าหลัก | 01 | 🚀 | 104 🚀 + 1 ⏸ | ⏸ CORE-14e |
| M2 การชำระเงิน | 06 | 🚀 | 11 🚀 | PAY-3 แตกเป็น 3a/3b1/3b2 |
| M3 E-voucher | 02 | 🚀 | 27 🚀 | — |
| M4 Flash sale | 03 | 🚀 | 19 🚀 + 2 ✕ | ✕ FS-9, FS-12 |
| M5 Group buying | 04 | 🚀 | 39 🚀 | + ADR-011 #33 |
| M6 Affiliate | 05 | 🚀 | 34 🚀 + 1 ⏸ | ⏸ AF-11 |
| M7 Scale และ hardening | 07 | 🚀 (ส่วนที่ไม่ ⏸) | 32 🚀 + 3 ⏸ | ⏸ OPS-3b, OPS-3c, OPS-19 |
| Admin UI ใช้ component ของ Medusa | 08 | 🚀 | 41 🚀 | ADR-018; ADM-22/36 เป็นผลตรวจไม่มี PR |
| Release v0.3.0 (รอบ 40) | 01–08 | 🚀 | 32 🚀 | รวม CORE-75 #465 |
| รอบ 41 | 01–08 | 🚀 | 36 🚀 + 1 ✕ | ✕ PAY-13 (ปิดโดย hotfix #468) |
| รอบ 42 | 01–08 | ◐ | 18 ☑ + 1 ◐ + 2 ☐ | → v0.3.1 |

จำนวน task นับจากตารางใน history.md ณ 2026-11-24 (task ที่อยู่หลาย milestone นับที่ milestone หลักของ spec)

## Backlog หลัง v1.0 (owner ตัดสินเลื่อน — ไม่มี AC จนกว่าจะกลับมาทำ)

- **CORE-14e** nonce กันฟอร์ม no-JS ส่งซ้ำ (owner Q-F7 2026-10-27 — กรณี qty สองเท่า; กรณี cart ค้าง 2 ใบ planner รวมเข้า) — spec 01 Open questions รอบ 9
- **OPS-3b** rate limiting (owner Q-O1 2026-10-27) — spec 07 AC-22, ข้อเสนอเดิมใน Q-O1
- **OPS-3c** error tracking Sentry (owner Q-O2 2026-10-27) — spec 07 AC-23, ข้อเสนอเดิมใน Q-O2
- **AF-11** reconcile entry ที่ approve แล้วของ order ที่ยกเลิกแต่ไม่มี reversal (owner Q15 2026-10-27) ·
  dedupe `/affiliate/products` ใน SQL เมื่อแคตตาล็อกใหญ่ (planner, review #122) ·
  entry `pending` ยอดสุทธิ 0 ของ order ที่ยกเลิกค้างและถูกสแกนทุกวัน (planner รอบ 11, review #146)
- **OPS-19** staging load test: burst 500 rps × 60s จริง + p95 < 300ms เป็น gate (owner 2026-11-03, ย้ายจาก AC-2 ของ OPS-4) —
  spec 07 AC-30; ต้องมี ADR staging ก่อน (infra ใหม่)
- **FS-9** ใส่ exclusivity rule ให้ automatic promotion ใหม่อัตโนมัติ (owner 2026-10-27: ไม่ทำใน v1 — admin กด Save ใน widget ของ FS-5 เอง) —
  spec 03 AC-15 (ยกเลิก)
- **resolve-product-ids แบ่งหน้า** `query.graph` ของ option กลางที่ผูกหลายสินค้า (planner รอบ 13, review #200) —
  spec 01 รอบ 13 "ไม่ทำ/ยอมรับ"; ทำเมื่อ option เดียวผูกสินค้าหลักร้อยจริง

## หาหัวข้อเดิม (spec/ADR เก่าอ้างชื่อหัวข้อเหล่านี้ของ ROADMAP)

| หัวข้อเดิมใน ROADMAP | อยู่ที่ |
|---|---|
| บรรทัดสถานะ/ประวัติรายรอบ (รอบ 12–41), "ก่อนเปิดร้านจริง (go-live)" ฉบับเดิม | [`history.md`](roadmap/history.md) หัวข้อ "บันทึกสถานะและประวัติรายรอบ" |
| M0–M7, Admin UI, Release v0.3.0, รอบ 41, รอบ 42 (ฉบับเสนอ) | [`history.md`](roadmap/history.md) ชื่อหัวข้อเดิม |
| "Backlog follow-up" / "หัวข้อ Backlog" | [`followups-archive.md`](roadmap/followups-archive.md) |
| "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 30/31–39)" | [`followups-archive.md`](roadmap/followups-archive.md) ชื่อหัวข้อเดิม |

## ข้อตกลงการทำงานต่อ PR

planner (เฉพาะเมื่อ spec เปลี่ยน) → builder (TDD, worktree) → qa (e2e + evidence) →
reviewer (อิสระ) → session หลัก merge เข้า develop (main เป็นของ owner) → PR ถัดไป
คอลัมน์สถานะอัปเดตโดย session หลัก (builder ห้ามแก้ไฟล์นี้)

แต่ละแถว = 1 PR เข้า `develop` แถวที่ทำคู่ขนานได้มีเครื่องหมาย ∥ และ builder หลายตัวสร้างพร้อมกันได้ ·
กติกา merge/CI/dependency ดู `CLAUDE.md` หัวข้อ "Branching และ PR"
