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
| CORE-4b | next-intl infra + locale cookie + language-select + layout shell | ☐ (← 4a, CORE-5) |
| CORE-4c ∥ 4d | แปล UI: home/PLP/PDP/cart ∥ checkout/account/order | ☐ (← 4b) |
| CORE-5 | Playwright + convention การเก็บ evidence | ☑ #7 |
| CORE-6 | store route เฉพาะ customer + e2e AC-1..4, AC-6 | ☐ (← CORE-2, 4a, 5 พร้อมแล้ว) |
| CORE-7 | Translation module + store locales | ☑ #26 |
| OPS-1 | Dockerfiles, worker mode, health | ☑ #9 (+ hotfix #18) |
**Release v0.1.0** — ร้านค้าที่เข้าชมได้, ชำระเงิน manual

## M2 การชำระเงิน
| Task | งาน | สถานะ |
|------|-----|--------|
| PAY-1 | Stripe provider + webhooks | ☑ #13 |
| PAY-2 | UI checkout บัตร + PromptPay + e2e | ☐ (← PAY-1, CORE-5 พร้อมแล้ว) |
| PAY-3 | หน้าชำระเงิน order (สำหรับ group buy) | ☐ (← PAY-2) |
| PAY-4 | Refund e2e | ☐ (← PAY-2) |
**Release v0.2.0** — ชำระเงินจริงใน test mode; checklist go-live สำหรับ live keys

## M3 E-voucher — **v0.3.0**
EV-1 ☑ #15 · EV-2 ☑ #25 · EV-3 ☐ · EV-4 ☐ (← EV-2, EV-3, CORE-3) · EV-5 ☐ · EV-6 ☐ · EV-7 ☐ (← EV-4)

## M4 Flash sale — **v0.4.0**
PROMO-1 ☑ #21 (+ #24) · FS-1 ☑ #14 (+ hotfix #22) · FS-3 ☑ #28 · FS-2 ☐ (← FS-3) · FS-4 ☐ · FS-5 ☐ · FS-6 ☐ (← FS-4, PROMO-1)
(spec 03 ปรับใน #23: FS-3 จองตอน complete cart, FS-2 คืนค่าเฉพาะ cancel/refund เต็มจำนวน)

## M5 Group buying — **v0.5.0**
GB-1 ☑ #17 · GB-2 ☐ (critical path) → GB-3 (← GB-2, PROMO-1) → GB-4 → GB-5 (← PAY-3) → GB-7 ; GB-6 (← GB-2)

## M6 Affiliate — **v0.6.0**
AF-1 ☑ #11 · AF-2 ☐ · AF-5 ☐ → AF-3 → (AF-4 ∥ AF-7) → AF-8 ; AF-5 → AF-6

## M7 Scale และ hardening — **v1.0.0** 🎯
OPS-2 ☑ #27 · OPS-3 ☐ · OPS-5 ☐ ; OPS-4 ☐ (← FS-6, GB-7)

## Backlog follow-up (จาก review/qa — ให้ planner แปลงเป็น task)
- storefront: หน้า store ไม่แสดงราคา THB (`SEARCH_PRICE_CURRENCIES` / backend `PRICE_CURRENCIES` มีแค่ eur, usd)
- storefront: class `txt-*`/`h*-webs` ของ `@medusajs/ui-preset` fix ฟอนต์ Inter — ต้องแก้ก่อนตรวจ AC-10 ของ CORE-4b
- e2e: `TASK_ID_RE` ใน `e2e/support/evidence-rules.ts` ไม่รับ `CORE-4a`; `evidence()` เขียน PNG ก่อนเช็กงบ; budget test ไม่ตรวจระดับ feature;
  ไฟล์ `*-tests.txt` ของ CORE-2/3, OPS-1 อยู่ในโฟลเดอร์ `<TASK-ID>/` ผิด convention; ให้ CI รัน `test:e2e:unit`
- seed: ชื่อสินค้าตัวอย่างยังเป็นอังกฤษ (ADR-008 ให้ต้นฉบับเป็นไทย); ค่าส่ง Standard 10 THB รอ owner กำหนด;
  เช็ก idempotency ท้ายสุดแทน region; `.env.example` `SEED_ADMIN_PASSWORD` ควรว่าง
- payments: prod ห้ามเปิด `pp_system_default` (ต้องเพิ่มกฎใน spec 06/07 + checklist go-live); `ci.yml` `stripe listen --forward-to` ซ้ำ;
  provider บัตรต้องส่ง `payment_method_types: ["card"]` (PAY-2)
- notifications: prod ไม่มี `RESEND_API_KEY` ควร fail-fast; อีเมล shipped แสดงทุก item; order placed ไม่เช็ก `no_notification`
- e-voucher: `void_reason` (EV-5); บังคับ `requires_shipping=false` (EV-3/EV-6); `expires_at` แบบวันที่ล้วน; delete ตอน import ล้มกลบ error เดิม
- ops: BullMQ event bus worker ตายหลัง `ETIMEDOUT` แต่ `/health` ยัง 200 (OPS-3); Next `output: "standalone"` ลดขนาด image;
  `next dev` สร้าง `AGENTS.md`/`CLAUDE.md` ใน storefront (`agentRules: false`); `testMatch` ของ `integration:modules` จับ unit spec ซ้ำ
- cart route ยังไม่บังคับ `authenticate("customer")` (CORE-6) — test ของ PROMO-1/FS-3 ต้องเพิ่ม customer token หลัง CORE-6

## ข้อตกลงการทำงานต่อ PR
planner (เฉพาะเมื่อ spec เปลี่ยน) → builder (TDD, worktree) → qa (e2e + evidence) →
reviewer (อิสระ) → session หลัก merge เข้า develop (main เป็นของ owner) → PR ถัดไป
คอลัมน์สถานะอัปเดตโดย session หลัก (builder ห้ามแก้ไฟล์นี้)
