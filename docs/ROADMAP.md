# ROADMAP — milestone, ลำดับ PR, สถานะ

สัญลักษณ์: ☐ ยังไม่ทำ · ◐ อยู่ใน PR · ☑ merge เข้า develop แล้ว · 🚀 release แล้ว
แต่ละแถว = 1 PR เข้า `develop` แถวที่ทำคู่ขนานได้มีเครื่องหมาย ∥ และ builder หลายตัวสร้างพร้อมกันได้

## M0 Scaffold
| PR | Task | สถานะ |
|----|------|--------|
| 1 | เอกสาร, agents, CI, PR template (ไม่มีโค้ดแอป) | ☑ |

## M1 ร้านค้าหลัก (ชำระเงิน manual, ข้อมูลทดสอบ)
| Task | งาน | สถานะ |
|------|-----|--------|
| CORE-1 | Monorepo + แอป Medusa + starter + compose + CI | ☑ #3 |
| CORE-2 | Seed: ประเทศไทย/THB/VAT/การจัดส่ง/สินค้า/admin | ☑ #6 |
| CORE-3 | Resend notifications + templates | ☑ #8 |
| CORE-4a | THB format + theme tokens + Noto Sans Thai + Vitest (ADR-008) | ☑ #19 |
| CORE-5b ∥ CORE-8 ∥ CORE-9 | เครื่องมือ evidence e2e ∥ ฟอนต์ ui-preset → Noto Sans Thai ∥ ราคา THB หน้า store | ◐ #40 ∥ ◐ ∥ ☐ |
| CORE-4b | next-intl infra + locale cookie + language-select + layout shell | ☐ (← 4a, CORE-5, 5b, 8) |
| CORE-4c ∥ 4d | แปล UI: home/PLP/PDP/cart ∥ checkout/account/order | ☐ (4c ← 4b, CORE-9; 4d ← 4b) |
| CORE-5 | Playwright + convention การเก็บ evidence | ☑ #7 |
| CORE-6 | store route เฉพาะ customer + e2e AC-1..4, AC-6 | ◐ #36 |
| CORE-12 | ownership middleware: cart/payment-collection/order ต้องเป็นของ customer ที่ล็อกอิน (ADR-013) | ☐ (← CORE-6) |
| CORE-7 | Translation module + store locales | ☑ #26 |
| OPS-1 | Dockerfiles, worker mode, health | ☑ #9 (+ hotfix #18) |
**Release v0.1.0** — ร้านค้าที่เข้าชมได้, ชำระเงิน manual

ไม่บล็อก release v0.1.0:
| Task | งาน | สถานะ |
|------|-----|--------|
| CORE-10 ∥ CORE-11 | seed follow-up (ชื่อไทย, idempotency; ค่าส่งคง placeholder) ∥ อีเมล shipped / `no_notification` | ☐ (← CORE-2 / CORE-3; CORE-10 แนะนำหลัง CORE-6) |
| CORE-13 | `POST /store/returns` ต้องเป็นเจ้าของ order + ปิด order transfer ทั้งชุด | ☐ (← CORE-12) |
| CORE-14 | storefront `/buy` บังคับล็อกอิน, ปิด UCP/`cart/resume`, no-JS login (QA D-1) | ☐ (← CORE-6) |

## M2 การชำระเงิน
| Task | งาน | สถานะ |
|------|-----|--------|
| PAY-1 | Stripe provider + webhooks | ☑ #13 |
| PAY-2 | UI checkout บัตร + PromptPay + e2e | ☐ (← PAY-1, CORE-5 พร้อมแล้ว) |
| PAY-3 | หน้าชำระเงิน order (สำหรับ group buy) | ☐ (← PAY-2) |
| PAY-4 | Refund e2e | ☐ (← PAY-2) |
**Release v0.2.0** — ชำระเงินจริงใน test mode; checklist go-live สำหรับ live keys

## M3 E-voucher — **v0.3.0**
EV-1 ☑ #15 · EV-2 ☑ #25 · EV-3 ☑ #31 · EV-4 ☐ (← EV-2, EV-3, CORE-3) · EV-5 ◐ · EV-6 ◐ #39 · EV-7 ☐ (← EV-4) · EV-8 ☐ (← EV-2, EV-3)

## M4 Flash sale — **v0.4.0**
PROMO-1 ☑ #21 (+ #24) · FS-1 ☑ #14 (+ hotfix #22) · FS-3 ☑ #28 · FS-2 ◐ #37 · FS-4 ◐ #32 · FS-5 ◐ #38 · FS-7 ☐ (← FS-4: `sold_out`/`remaining_units`) · FS-6 ☐ (← FS-4, FS-7, PROMO-1) · FS-8 ☐ (← FS-2: retry การคืนโควตา) · FS-9 (ทางเลือก, ← FS-5) · PROMO-2 ☐ (← PROMO-1, FS-3; ควรก่อน FS-6, GB-3)
(FS-2 คืนโควตาเมื่อ cancel หรือ refund เต็มจำนวน ไม่ว่ามาจาก return — owner 2026-10-25)

## M5 Group buying — **v0.5.0**
GB-1 ☑ #17 · ADR-011 ☑ #33 · GB-2a ◐ (critical path) → GB-2b → GB-3 (← GB-2b, PROMO-1, PROMO-2) → GB-4 → GB-5 (← PAY-3) → GB-7 ; GB-6 (← GB-2b)

## M6 Affiliate — **v0.6.0**
AF-1 ☑ #11 · AF-2 ☐ · AF-5 ☑ #35 → AF-3 → (AF-4 ∥ AF-7) → AF-8 ; AF-5 → AF-6 ∥ AF-9 (ยกเลิก payout draft)

## M7 Scale และ hardening — **v1.0.0** 🎯
OPS-2 ☑ #27 · OPS-3 ☐ · OPS-5 ☐ · OPS-6 ☐ · OPS-7 ☐ · OPS-8 ☐ (← OPS-2) ; OPS-4 ☐ (← FS-6, GB-7)

## Backlog follow-up (แปลงเป็น task แล้ว 2026-10-25 — รายละเอียด/AC อยู่ใน spec)
- ฟอนต์ ui-preset → CORE-8 · เครื่องมือ evidence e2e → CORE-5b (dependency ของ CORE-4b) · ราคา THB หน้า store → CORE-9 (dependency ของ CORE-4c)
- seed (ชื่อไทย, idempotency, `.env.example`; ค่าส่ง Standard คง placeholder จนกว่า owner ตัดสิน Q-F1) → CORE-10 · อีเมล shipped / `no_notification` → CORE-11
- `pp_system_default` ใน prod (D1) + fail-fast `RESEND_API_KEY` + checklist go-live → OPS-7 (ADR-010 accepted)
- `payment_method_types: ["card"]` + `stripe listen --forward-to` ซ้ำ → PAY-2
- `void_reason` → EV-5 · `requires_shipping=false`, `expires_at` วันที่ล้วน, error ถูกกลบตอน compensation → EV-8
- worker ตายหลัง `ETIMEDOUT` → OPS-8 (ADR-012 accepted) · standalone / `agentRules` / `testMatch` → OPS-6
- error 409 ของ Medusa (`CONFLICT`) เขียนทับ `code`/`message` เป็น `invalid_state_error` → PROMO-2 (spec 03 กฎข้อ 13, AC-12)
- cart route ไม่บังคับ `authenticate("customer")` + test PROMO-1/FS-3 ที่ไม่มี token → อยู่ใน CORE-6 (เงื่อนไข CI เขียว ไม่แก้นิยาม task)

## ข้อตกลงการทำงานต่อ PR
planner (เฉพาะเมื่อ spec เปลี่ยน) → builder (TDD, worktree) → qa (e2e + evidence) →
reviewer (อิสระ) → session หลัก merge เข้า develop (main เป็นของ owner) → PR ถัดไป
คอลัมน์สถานะอัปเดตโดย session หลัก (builder ห้ามแก้ไฟล์นี้)
