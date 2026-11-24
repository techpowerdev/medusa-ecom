# ROADMAP — milestone, ลำดับ PR, สถานะ

อัปเดตล่าสุด: 2026-11-24 (ปิดรอบ 42) · ไฟล์นี้เก็บเฉพาะ "ตอนนี้" — ประวัติรายรอบ/ตาราง task ทุกตัวอยู่ที่
[`docs/roadmap/history.md`](roadmap/history.md) และ follow-up เก่า (รอบ 13–39) อยู่ที่
[`docs/roadmap/followups-archive.md`](roadmap/followups-archive.md)

## สรุปสถานะ (อ่านตรงนี้ก่อน)

- **ตอนนี้**: รอบ 42 เสร็จ 21/21 task (☑ develop `599009b6`) — **รอ owner merge release v0.3.1** (`develop → main`)
- **รอ owner ตัดสิน**: ชุดคำถาม Q-R43 + คำถามใน spec ของรอบ 43 (หัวข้อ "คำถามที่รอ owner")
- **ขั้นต่อไป**: owner merge v0.3.1 → owner ตอบ Q-R43 → รอบ 43 ตามที่ตอบ → go-live (checklist ข้อ 1–16)

### Release

| Release | สถานะ | วันที่ | PR / tag | เนื้อหาหลัก |
|---|---|---|---|---|
| v0.1.0 | 🚀 | 2026-11-11 | #342 (`15fce017`), tag `v0.1.0` | ร้านค้าหลัก + task ทุกตัวที่ merge ถึงวันนั้น (เงื่อนไข: CORE-12/12b/17/18, OPS-21, EV-15, CORE-55) |
| v0.2.0 | 🚀 | 2026-11-19 | #423 (`e274d387`), tag `v0.2.0` | task ใน milestone/Admin UI ที่ merge หลัง v0.1.0 ถึงรอบ 39 |
| v0.3.0 | 🚀 | 2026-11-24 | #521 (`47c3e545`), tag `v0.3.0`, [GitHub Release](https://github.com/techpowerdev/medusa-ecom/releases/tag/v0.3.0) | แก้จากการทดสอบ manual (รอบ 40 = 32 task) + รอบ 41 (36 task; PAY-13 ✕) |
| v0.3.1 | ☑ ครบ — รอ owner merge | — | — | รอบ 42 (21 task — ตารางใน history หัวข้อ "รอบ 42 — ผลจริง") |
| รอบ 43 | ☐ เสนอ | — | — | 16 task — release ตามคำตอบ Q-R43-ฉ |
| go-live | ☐ | — | — | หลัง v0.3.1 (+ ส่วนของรอบ 43 ตาม Q-R43-ฉ) + Go-live checklist |
| v1.0.0 | ☐ ยังไม่กำหนดเงื่อนไข | — | — | Q-R43-จ (ป้าย v0.3.0–v1.0 ของ M3–M7 เป็นแผนเดิม ไม่ผูกกับเลข release จริง) |

### สัญลักษณ์

☐ ยังไม่ทำ · ◐ อยู่ใน PR · ☑ merge เข้า develop แล้ว · 🚀 release แล้ว · ✕ ปิด (owner ไม่ทำ / ไม่ต้องทำ) · ⏸ เลื่อนหลัง v1.0 · ∥ ทำขนานได้

- `docs/spec/*.md` คง ☑ = merge เข้า develop แล้ว **ไม่ sync ☑→🚀** — ROADMAP เป็นที่เดียวที่บอกสถานะ release (owner 2026-11-12)
- task ที่ merge หลัง v0.3.0 ใช้ ☑ จนถึง release v0.3.1 · บันทึกประวัติคงสัญลักษณ์ ณ วันที่บันทึก

## รอบ 43 (เสนอ — ปิดรอบ 42 2026-11-24; ☐ รอ owner สั่ง)

ที่มา: follow-up ของ review/qa/builder #524–#551 ที่ยังจริงบน develop `599009b6` · เลขกฎ/AC อยู่ในหัวข้อ "Follow-up รอบ 43" ของแต่ละ spec ·
Depends "—" = เฉพาะ PR เอกสารปิดรอบ 42 · ทุกตัวขนานกันได้ (∥) เว้นที่ระบุ

| Task | spec | งาน (สั้น) | Depends | UI/qa | สถานะ |
|---|---|---|---|---|---|
| CORE-96 | 01 | สรุปขั้น payment ไม่ตัดคำทุกความกว้าง + บัตรของขวัญ + `renewedFrom` | — | ✓ | ☐ |
| CORE-97 | 01 | nav ตะกร้า: ลิงก์ไม่ซ้อนปุ่ม, ป้ายไม่ค้างหลัง logout, backend ล่มไม่บอก (0) | — | ✓ | ☐ |
| CORE-98 | 01 | overview GB-8 ล้ม/`<ul>` ว่าง + a11y `SearchPagination` + จำนวน toggle ลดราคา | — | ✓ | ☐ |
| CORE-99 | 01 | a11y ลิงก์/ปุ่ม: static ครอบทุกรูป, "." ปุ่มสลับ, testid `cart-sign-in-link` | — | ✓ | ☐ |
| CORE-100 | 01 | hygiene storefront: purity 3 ไฟล์, coverage/`COMPARE`, e2e chip, unit กฎ 151e | — | — | ☐ |
| FS-26 | 03 | e2e hygiene flash: `stripeRefunds`/`ok` ร่วม + catch ของ helper | — | — | ☐ |
| GB-33 | 04 | test hygiene: filter ของ AC-69b, เกณฑ์เวลาผูก `LOCK_TIMEOUT`, comment | — | — | ☐ |
| PAY-22 | 06 | `/api/payment-return`: `FAILED`, failed+401 → `step=payment`, notice (Q-P21) | Q-P21 | — | ☐ |
| PAY-23 | 06 | (เงิน) alert คืนเงิน: `source`, prefix log, เรียงใหม่ก่อน (Q-P23), `order_id` | Q-P23 | — | ☐ |
| PAY-24 | 06 | (เงิน) ผู้ส่ง `OPS_ALERT_EMAIL` 3 ที่ใช้ `sendOpsAlert` | — | — | ☐ |
| PAY-25 | 06 | ข้อความไทยของ error Stripe ตอนเปิด QR + หน้าจ่าย order | — | ✓ | ☐ |
| OPS-36 | 07 | (PII) redact: ค่าลงท้าย backslash ไม่ทำให้ key ถัดไปหลุด + หลายท่อน | — | — | ☐ |
| OPS-37 | 07 | runbook หลัง go-live (คำสั่ง DELETE) + log backend เต็มเป็น artifact CI | — | — | ☐ |
| OPS-38 | 07 | backend lint warning 4 ไฟล์ (ไม่เปลี่ยน id ของ step/workflow) | — | — | ☐ |
| ADM-49 | 08 | focus หลัง Mark as paid → แถวถัดไป/ปุ่ม Create payout | — | ✓ | ☐ |
| ADM-50 | 08 | test hygiene admin: static ผูกปุ่ม Save, unit hook, e2e campaign | — | — | ☐ |

- **ไฟล์ร่วม** (ตัวที่ merge ทีหลัง sync): `docs/ops/production.md` OPS-37 ↔ PAY-23 (ถ้า Q-P23 = ก) · `components/common/*` ADM-49 ↔ ADM-50 ·
  static ของ CORE-99 พบจุดใน nav → ให้ CORE-97 แก้ · `ci.yml` OPS-37 เท่านั้น · `cart.ts` CORE-97 เท่านั้น
- **ควรก่อน go-live** (ข้อเสนอใน Q-R43-ฉ): OPS-36 (PII ใน log — Go-live ข้อ 13), PAY-23, PAY-24 (alert เงิน)
- integration หนัก: PAY-23, PAY-24, GB-33 — จำกัดพร้อมกันตามเครื่อง
- ไม่ทำ/backlog ของรอบนี้ (พร้อมเหตุผล): history หัวข้อ "รอบ 42 — ผลจริง"

## คำถามที่รอ owner

ตอบเป็นชุดได้ (ตัวเลือกแรก = Recommended) · คำถามใน spec: spec 06 **Q-P21** (notice ของ payment-return), **Q-P22** (ข้อความเฉพาะเหตุหลัง reload),
**Q-P23** (job refund เรียงใหม่ก่อน), spec 01 **Q-C18** (overview นับกลุ่มที่ยกเลิก)

- **Q-R43-ง** กติกาเขียน ROADMAP แบบสั้นใน `.claude/agents/planner.md` ข้อ 5 (planner #547 เสนอ):
  (ก) **[Recommended]** เพิ่ม: ROADMAP เก็บแค่สรุปสถานะ, ตาราง release, ตารางรอบปัจจุบัน (แถวละบรรทัด), คำถาม, go-live, milestone;
  ปิดรอบ → ย้ายตาราง/บันทึกไป `history.md` — กันไฟล์โตกลับเป็นพันบรรทัด; แก้ไฟล์ agent 1 ย่อหน้า (session หลักทำตามที่ owner อนุมัติ);
  (ข) ไม่เขียน — ใช้ตามแบบอย่างในไฟล์ (planner รุ่นถัดไปอาจเขียนยาวกลับ)
- **Q-R43-จ** เงื่อนไขของ v1.0.0 (ป้ายเดิม M3–M7 ไม่ตรง release จริง):
  (ก) **[Recommended]** v1.0.0 = release แรกที่เปิดร้านจริง: Go-live checklist ครบ + smoke test บน prod ผ่าน — ผูกเลขกับเหตุการณ์ที่วัดได้; backlog ⏸ คงหลัง v1.0;
  (ข) v1.0.0 หลัง go-live + backlog ⏸ บางตัว (OPS-3b rate limit, OPS-3c Sentry, OPS-19 staging) — ต้องเปลี่ยนคำตัดสิน 2026-10-27/11-03 และ OPS-19 ต้องมี ADR staging;
  (ค) ยังไม่กำหนด
- **Q-R43-ฉ** รอบ 43 อยู่ใน release ไหน/ทำเมื่อไร:
  (ก) **[Recommended]** merge v0.3.1 ตอนนี้ → ทำ OPS-36, PAY-23, PAY-24 เป็น v0.3.2 ก่อน go-live (PII/alert เงิน, ~3 PR) → go-live → ที่เหลือ 13 task หลัง go-live (v0.4.0) —
  go-live ไม่รอ hygiene/a11y ที่ไม่กระทบเงิน;
  (ข) ทั้งรอบ 43 (16 PR) ก่อน go-live เป็น v0.3.2 — go-live ช้าออกไปตามจำนวน PR;
  (ค) go-live ด้วย v0.3.1 แล้วทำรอบ 43 ทั้งหมดหลังจากนั้น — ช่องรั่ว PII ของ OPS-36 อยู่บน prod จนแก้ (ขัดเจตนา Go-live ข้อ 13)
- **follow-up เก่า (รอบ 30–39)**: ข้อ ข/ค (hygiene/backlog) ยังไม่มี task รอ owner สั่ง — [`followups-archive.md`](roadmap/followups-archive.md)
- **ต้องตัดสินก่อน go-live** (ไม่บล็อก v0.3.1):
  1. spec 06 Q1 — บัญชี Stripe live นิติบุคคลไทย + เปิด PromptPay + ยื่น account application (Go-live ข้อ 6, 16; owner ยังไม่ยืนยัน)
  2. spec 01 Q-F1 — ค่าส่งจริงแทน ฿10 placeholder (Go-live ข้อ 5)
  3. staging (ADR-027 ยังไม่เขียน) — ต้องมีก่อนวัด checkout แบบ OPS-26 ซ้ำบน staging และก่อน OPS-19 ⏸

## ก่อนเปิดร้านจริง (go-live)

ทำตาม `docs/ops/production.md` หัวข้อ "Go-live checklist" ข้อ 1–16 บน prod (รวม `check:go-live`) โดยเฉพาะข้อที่เพิ่มในรอบ 40–42:

| ข้อ | งาน | ที่มา |
|---|---|---|
| 10 | Postgres prod `LC_CTYPE` ไม่ใช่ `C`/`POSIX` (`check:go-live` ตรวจ) | CORE-75, OPS-33 |
| 11 | รัน `lowercase-emails.ts` แปลงอีเมลเดิมเป็นตัวเล็ก | CORE-80/81 |
| 12 | backfill ธง `evoucher_backordered` | EV-25 |
| 13 | log ของ prod ไม่มี PII (access log ไม่ผ่าน redact — OPS-35; ช่องรั่วที่เหลือ = OPS-36) | OPS-33, OPS-35 |
| 14 | วัด p95 `POST /store/search` กับ catalog จริง (> ~10k สินค้าหรือ p95 > 300ms → ADR) | CORE-75 |
| 15 | endpoint live สมัคร `refund.updated`/`refund.failed` + ทดสอบบัตร `4000 0000 0000 5126` ว่า alert ถึง ops | PAY-21, ADR-029 |
| 16 | บัญชี Stripe live ยื่น account application ให้เสร็จ (refund พร้อมเพย์ต้องส่งอีเมลขอบัญชีถึงลูกค้า) | PAY-19 (Q-P14/15), ปิดรอบ 42 |

เพิ่มเติม (ไม่ใช่ task): ข้อ 5–6 ตามคำถามด้านบน · smoke test บน production (`check:go-live` + `tools/ops/smoke-*.sh`) ·
ตั้ง `OPS_ALERT_EMAIL`, `EVOUCHER_ADMIN_EMAIL`, `RESEND_API_KEY` · วัด OPS-26 ซ้ำบน staging (ต้องมี ADR-027 ก่อน)

## Milestone ภาพรวม

รายการ task ทุกตัวพร้อมเลข PR: [`history.md`](roadmap/history.md) (หัวข้อ M0–M7, Admin UI, Release v0.3.0, รอบ 41, รอบ 42 — ผลจริง)

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
| รอบ 42 | 01–08 | ☑ | 21 ☑ | → v0.3.1 (รอ owner merge); ADR-029 |
| รอบ 43 | 01, 03, 04, 06–08 | ☐ เสนอ | 16 ☐ | รอ Q-R43 |

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
| "รอบ 42 → release v0.3.1 (รอบปัจจุบัน)" (ตาราง 21 task, merge train, คำตัดสิน) | [`history.md`](roadmap/history.md) หัวข้อ "รอบ 42 — ผลจริง" |
| "Backlog follow-up" / "หัวข้อ Backlog" | [`followups-archive.md`](roadmap/followups-archive.md) |
| "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 30/31–39)" | [`followups-archive.md`](roadmap/followups-archive.md) ชื่อหัวข้อเดิม |

## ข้อตกลงการทำงานต่อ PR

planner (เฉพาะเมื่อ spec เปลี่ยน) → builder (TDD, worktree) → qa (e2e + evidence) →
reviewer (อิสระ) → session หลัก merge เข้า develop (main เป็นของ owner) → PR ถัดไป
คอลัมน์สถานะอัปเดตโดย session หลัก (builder ห้ามแก้ไฟล์นี้)

แต่ละแถว = 1 PR เข้า `develop` แถวที่ทำคู่ขนานได้มีเครื่องหมาย ∥ และ builder หลายตัวสร้างพร้อมกันได้ ·
กติกา merge/CI/dependency ดู `CLAUDE.md` หัวข้อ "Branching และ PR"
