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
| CORE-5b ∥ CORE-8 ∥ CORE-9 | เครื่องมือ evidence e2e ∥ ฟอนต์ ui-preset → Noto Sans Thai ∥ ราคา THB หน้า store | ☑ #40 ∥ ☑ #41 ∥ ☑ #45 |
| CORE-4b | ข้อความ UI ไทยตรงในโค้ด (ADR-014): ESLint กันข้อความละติน, ลบ language-select, layout/home/PLP/PDP | ☐ (← 4a, 5b, 8 พร้อมแล้ว) |
| CORE-4c ∥ 4d | ข้อความไทย: cart/account/order/policies ∥ checkout (รวมข้อความของ PAY-2) | ☐ (4c ← 4b; 4d ← 4b, PAY-2) |
| CORE-5 | Playwright + convention การเก็บ evidence | ☑ #7 |
| CORE-6 | store route เฉพาะ customer + e2e AC-1..4, AC-6 | ☑ #36 |
| CORE-12 | ownership middleware: cart/payment-collection/order ต้องเป็นของ customer ที่ล็อกอิน (ADR-013) | ☑ #51 |
| CORE-7 | Translation module + store locales | ☑ #26 |
| OPS-1 | Dockerfiles, worker mode, health | ☑ #9 (+ hotfix #18) |
**Release v0.1.0** — ร้านค้าที่เข้าชมได้, ชำระเงิน manual

ไม่บล็อก release v0.1.0:
| Task | งาน | สถานะ |
|------|-----|--------|
| CORE-10 ∥ CORE-11 | seed follow-up (ชื่อไทย, idempotency; ค่าส่งคง placeholder) ∥ อีเมล shipped / `no_notification` | ☐ (← CORE-2 / CORE-3; CORE-10 แนะนำหลัง CORE-6) |
| CORE-13 | `POST /store/returns` ต้องเป็นเจ้าของ order + ปิด order transfer ทั้งชุด | ☐ (← CORE-12) |
| CORE-14 | storefront `/buy` บังคับล็อกอิน, ปิด UCP/`cart/resume`, no-JS login (QA D-1); เกิน ~400 LOC แยก 14a/14b | ☐ (← CORE-6) |
| CORE-12b ∥ CORE-15 | ownership ของ `cart_id` ใน query products/variants ∥ หน้า `/store` หยุดยิงซ้ำเมื่อ search error | ☐ (← CORE-12 / CORE-9) |

## M2 การชำระเงิน
| Task | งาน | สถานะ |
|------|-----|--------|
| PAY-1 | Stripe provider + webhooks | ☑ #13 |
| PAY-2 | UI checkout บัตร + PromptPay + e2e | ◐ #48 |
| PAY-3 | หน้าชำระเงิน order (สำหรับ group buy) | ☐ (← PAY-2) |
| PAY-4 | Refund e2e | ☐ (← PAY-2) |
| PAY-5 | race QR หมดอายุ × จ่ายสำเร็จ (reconciliation) | ☐ (← PAY-2; แนะนำก่อน PAY-3) |
**Release v0.2.0** — ชำระเงินจริงใน test mode; checklist go-live สำหรับ live keys

## M3 E-voucher — **v0.3.0**
EV-1 ☑ #15 · EV-2 ☑ #25 · EV-3 ☑ #31 · EV-4 ☐ (← EV-2, EV-3, CORE-3) · EV-5 ☑ #43 (ไม่รวม resend) · EV-5b ☐ (← EV-4, EV-6: resend) · EV-6 ☑ #39 · EV-7 ☐ (← EV-4) · EV-8 ◐ · EV-9 ☐ (← EV-2, EV-6: `low_stock_threshold`, link code↔order, ฟอร์ม admin)

## M4 Flash sale — **v0.4.0**
PROMO-1 ☑ #21 (+ #24) · FS-1 ☑ #14 (+ hotfix #22) · FS-3 ☑ #28 · FS-2 ☑ #37 · FS-4 ☑ #32 · FS-5 ◐ #38 · FS-10 ☐ (← FS-5: กันกดซ้ำด้วย useRef) · FS-7 ◐ #53 · FS-6 ☐ (← FS-4, FS-7, PROMO-1, CORE-4b) · FS-8 ☐ (← FS-2: retry การคืนโควตา) · FS-9 ☐ (ทางเลือก รอ owner สั่ง, ← FS-5) · PROMO-2 ◐ #50
(FS-2 คืนโควตาเมื่อ cancel หรือ refund เต็มจำนวน ไม่ว่ามาจาก return — owner 2026-10-25)

## M5 Group buying — **v0.5.0**
GB-1 ☑ #17 · ADR-011 ☑ #33 · GB-2a ☑ #42 → GB-2b ☑ #49 → GB-3 (← GB-2b, PROMO-1, PROMO-2, CORE-12) → GB-4 → GB-5 (← PAY-3) → GB-7 ; GB-6 (← GB-2b) · GB-2c ☐ (← GB-2b: default `is_tax_inclusive=true`)

## M6 Affiliate — **v0.6.0**
AF-1 ☑ #11 · AF-2 ☐ · AF-5 ☑ #35 → AF-3 → (AF-4 ∥ AF-7) → AF-8 ; AF-5 → AF-6 ∥ AF-9 (ยกเลิก payout draft)

## M7 Scale และ hardening — **v1.0.0** 🎯
OPS-2 ☑ #27 · OPS-3 ☐ · OPS-5 ☐ · OPS-6 ☑ #47 · OPS-9 ☐ (typecheck group-buy test กับ `.medusa/types`) · OPS-7 ☐ · OPS-8 ☐ (← OPS-2) ; OPS-4 ☐ (← FS-6, GB-7)

hotfix: #46 (test FS-4 × CORE-6), #52 (jest integration heap OOM)

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
