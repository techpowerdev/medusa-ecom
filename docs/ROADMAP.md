# ROADMAP — milestone, ลำดับ PR, สถานะ

สัญลักษณ์: ☐ ยังไม่ทำ · ◐ อยู่ใน PR · ☑ merge เข้า develop แล้ว · 🚀 release แล้ว
แต่ละแถว = 1 PR เข้า `develop` แถวที่ทำคู่ขนานได้มีเครื่องหมาย ∥ และ builder หลายตัวสร้างพร้อมกันได้
สถานะล่าสุดตาม PR #1–#74 (2026-10-26): PR ที่เปิดอยู่ = #67, #68, #71, #73, #74

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
| CORE-4b (4b1) | ESLint กันข้อความละติน, ลบ language-select, layout shell/home (ADR-014) | ☑ #57 |
| CORE-4b2 | ข้อความไทย store/PLP, search, categories, collections, PDP, `/buy` + hreflang `th-<CC>` (owner 2026-10-26) | ☑ #70 |
| CORE-4c ∥ 4d | ข้อความไทย: cart/account/order/policies ∥ checkout (รวมข้อความของ PAY-2 + ประโยคยอมรับเงื่อนไขขั้น review — ยืนยันรอบ 6) | ☐ (4c ← 4b2; 4d ← 4b2, PAY-2 ☑) |
| CORE-5 | Playwright + convention การเก็บ evidence | ☑ #7 |
| CORE-6 | store route เฉพาะ customer + e2e AC-1..4, AC-6 | ☑ #36 |
| CORE-12 | ownership middleware: cart/payment-collection/order ต้องเป็นของ customer ที่ล็อกอิน (ADR-013) | ☑ #51 |
| CORE-13 | `POST /store/returns` ต้องเป็นเจ้าของ order + ปิด order transfer ทั้งชุด | ☑ #56 |
| CORE-16 | ปิด `return_shipping.price`/`receive_now`/`location_id` บน `POST /store/returns` + seed "Standard return" | ☑ #63 |
| CORE-17 | **ความปลอดภัย** return option ต้อง `is_return`/`enabled_in_store` (`eq` เท่านั้น) + service zone ของ order | ◐ #71 (รอ spec AC-60a..f merge) |
| CORE-18 | เนื้อหาร้านไทย placeholder แทนโฆษณา starter + ลบ `product-onboarding-cta` + "Medusa Store" ในหน้า account → `STORE_NAME` (รอบ 6); AC-61 ไม่นับข้อมูลจาก backend | ☐ PR #80 (← CORE-4b2) |
| CORE-7 | Translation module + store locales | ☑ #26 |
| OPS-1 | Dockerfiles, worker mode, health | ☑ #9 (+ hotfix #18) |
**Release v0.1.0** — ร้านค้าที่เข้าชมได้, ชำระเงิน manual (เงื่อนไข release แรกที่เปิดให้ลูกค้าจริง: CORE-12 ☑, CORE-12b, CORE-17, CORE-18)

ไม่บล็อก release v0.1.0:
| Task | งาน | สถานะ |
|------|-----|--------|
| CORE-10 | seed follow-up (ชื่อสินค้า + ชื่อ option + ชื่อ category ไทย/handle คงที่, idempotency, หัวข้อ dev ใน README: `SEED_ADMIN_PASSWORD`/`E2E_ADMIN_PASSWORD` + reset DB; ค่าส่งคง placeholder) | ☐ (← CORE-2; แนะนำหลัง CORE-6) |
| CORE-11 | อีเมล shipped เฉพาะ item ใน fulfillment / `no_notification` | ☑ #64 |
| CORE-12b | **ความปลอดภัย** ownership ของ `cart_id` ใน query products/variants (ควรก่อน release แรกที่เปิดจริง) | ☐ (← CORE-12) |
| CORE-14a | storefront `/buy` บังคับล็อกอิน, ปิด UCP/`cart/resume`, cookie cart ค้าง, ลบหน้า order transfer (AC-41..43, 56) | ◐ #81 (← CORE-6) |
| CORE-14b ∥ CORE-14c | no-JS login + error `add_variant` (AC-44, 45) ∥ login ไม่ล้มเมื่อ `transferCart()` ได้ 404 เพราะ cookie cart เป็นของคนอื่น (AC-76) | ☐ (14b ← CORE-6; 14c ← CORE-14a) |
| CORE-15 | หน้า `/store` หยุดยิงซ้ำเมื่อ search error | ☐ (← CORE-9) |
| CORE-19a ∥ CORE-19b | ตัวนับ cart + search drawer 375px ∥ ปุ่ม "Continue to review" ไม่ค้าง | ☐ (19a ← CORE-4b2; 19b ← CORE-4d) |
| CORE-20 | หน้าขอคืนสินค้าจาก order detail | ☐ (← CORE-17, CORE-4c) |
| CORE-21 | return option: stock location ต้องอยู่ใน sales channel ของ order (follow-up #71) + test order ไม่มี `country_code` + error ไม่สะท้อน `option_id` (รอบ 6) | ☐ (← CORE-17) |

## M2 การชำระเงิน
| Task | งาน | สถานะ |
|------|-----|--------|
| PAY-1 | Stripe provider + webhooks | ☑ #13 |
| PAY-2 | UI checkout บัตร + PromptPay + e2e | ☑ #48 |
| PAY-3 | หน้าชำระเงิน order (สำหรับ group buy) | ☐ (← PAY-2; merge หลัง PAY-5 ถ้าทำพร้อมกัน) |
| PAY-4 | Refund e2e | ☐ (← PAY-2) |
| PAY-5 | race QR หมดอายุ × จ่ายสำเร็จ — ยืนยันกรณี (b) + ADR-015 | ☑ #65 |
| PAY-6a | ADR-015 A ฝั่ง backend: guard `authorizePaymentSession` + 409 `PAYMENT_ALREADY_COMPLETED` (AC-11, 13 a–g, 14, 12b ส่วน backend) | ◐ #82 (← PAY-5 ☑ #65) |
| PAY-6b | storefront poll + complete cart ทางสำรอง (AC-12, 12b) + alert `PAYMENT_WEBHOOK_SESSION_NOT_FOUND`/`OPS_ALERT_EMAIL` + runbook (AC-15, 16) | ☐ (← PAY-6a) — 6a และ 6b ต้อง merge ก่อน release ที่เปิด PromptPay จริง |
**Release v0.2.0** — ชำระเงินจริงใน test mode; checklist go-live สำหรับ live keys

## M3 E-voucher — **v0.3.0**
EV-1 ☑ #15 · EV-2 ☑ #25 · EV-3 ☑ #31 · EV-4 ◐ #67 (+ ciphertext ใน notification, ส่งล้มคง `allocated`, backordered ทั้ง line — owner 2026-10-26) ·
EV-5 ☑ #43 · EV-5b ☐ (← EV-4, EV-6: resend รวม `allocated`, `idempotency_key` ใหม่ทุกครั้ง) · EV-6 ☑ #39 · EV-7 ☐ (← EV-4; บังคับ Digital method) · EV-8 ☑ #54 ·
EV-9 ☐ (← EV-2, EV-6) · EV-10 ☐ (← EV-5, EV-8: reservation ตอน admin void, วันที่จริง, inventory item ร่วม, คืน `requires_shipping` — ก่อน release ที่มี EV-7;
รอบ 6 owner **ยกเลิก**การบังคับ shipping profile Digital) · EV-11 ☐ (← EV-4: ลบ warn เรื่อง profile) · EV-12 ☐ (← EV-10 + คำตอบ Q6: job ระบุ pool `stocked < reserved`)

## M4 Flash sale — **v0.4.0**
PROMO-1 ☑ #21 (+ #24) · FS-1 ☑ #14 (+ hotfix #22) · FS-3 ☑ #28 · FS-2 ☑ #37 · FS-4 ☑ #32 · FS-5 ☑ #38 · FS-7 ☑ #53 · PROMO-2 ☑ #50 ·
FS-10 ◐ #74 (← FS-5: กันกดซ้ำด้วย useRef) · FS-6 ☐ (← FS-4, FS-7, PROMO-1, CORE-4b2) · FS-8 ☑ #69 (retry การคืนโควตา) · FS-11 ☐ (← FS-8: เส้นทาง `payment.refunded` เข้า workflow) ·
FS-9 ☐ (ทางเลือก รอ owner สั่ง, ← FS-5)
(FS-2 คืนโควตาเมื่อ cancel หรือ refund เต็มจำนวน ไม่ว่ามาจาก return — owner 2026-10-25)

## M5 Group buying — **v0.5.0**
GB-1 ☑ #17 · ADR-011 ☑ #33 · GB-2a ☑ #42 → GB-2b ☑ #49 → GB-2c ☑ #58 ·
GB-3 ◐ #68 (+ ห้าม complete cart ที่มี `GB-*`, 409 `GB_CART_ALREADY_JOINED` — owner 2026-10-26) → (GB-3b ☐ leave + nit #68 ∥ GB-4 ☐) → GB-5 ☐ (← PAY-3) → GB-7 ☐ (← GB-3b; ล้าง cart หลัง join) ;
GB-6a ◐ #75 (รายการ + ฟอร์มสร้าง) → GB-6b ☐ (หน้ารายละเอียด: สถานะ/ลบ draft/ตารางกลุ่ม/สร้าง pool + ฟอร์ม: product picker, `max_quantity ≥ max_units_per_person`, เตือน `ends_at` อดีต) →
GB-6c ☐ (← GB-6b, GB-3, GB-4: route membership ของ admin + ตาราง membership + succeed/fail manual)

## M6 Affiliate — **v0.6.0**
AF-1 ☑ #11 · AF-2 ☑ #66 · AF-5 ☑ #35 → AF-3 ☐ (← AF-2; backend + การตีความ window กฎ 24) → (AF-3b ☐ storefront sync cookie ∥ AF-4 ☐ + nit AF-3: เรียง items ∥ AF-7) → AF-8 ;
AF-5 → AF-9 ☐ (ยกเลิก payout draft) → (AF-6 ☐ + ปุ่มยกเลิก payout ∥ AF-9b ☐ lock ตอน cancel + test 401)

## M7 Scale และ hardening — **v1.0.0** 🎯
OPS-2 ☑ #27 · OPS-6 ☑ #47 · OPS-3 ☐ · OPS-5 ☐ · OPS-7 ☐ (← OPS-2, PAY-1, CORE-3, AF-2 ☑) · OPS-8 ☐ (← OPS-2) · OPS-9 ☑ #72 (typecheck group-buy test กับ `.medusa/types` — แก้ไปแล้วใน GB-2a, PR มีแค่ evidence) ·
OPS-10 ☐ (← PAY-2: test ของ `classify-changes.sh` ใน CI + รายการ event ของ Stripe webhooks ตรงกับ `stripe listen`) ; OPS-4 ☐ (← FS-6, GB-7) ·
OPS-11 ☐ (← FS-10: helper login admin + `x-forwarded-proto` ร่วม + test id widget flash sale — ทำเมื่อมี e2e admin ตัวที่สอง หรือรวมใน PR ของตัวนั้น)

hotfix/chore: #46 (test FS-4 × CORE-6), #52 (jest integration heap OOM), #59 (ลด CI ซ้ำซ้อน — ตัด push ไป develop)

## Backlog follow-up (แปลงเป็น task แล้ว — รายละเอียด/AC อยู่ใน spec)
- ฟอนต์ ui-preset → CORE-8 · เครื่องมือ evidence e2e → CORE-5b · ราคา THB หน้า store → CORE-9
- seed (ชื่อไทย + ชื่อ option ไทย, idempotency, `.env.example`; ค่าส่ง Standard คง placeholder จนกว่า owner ตัดสิน Q-F1) → CORE-10 · อีเมล shipped / `no_notification` → CORE-11
- `pp_system_default` ใน prod (D1) + fail-fast `RESEND_API_KEY`/`AFFILIATE_TOKEN_SECRET` + checklist go-live → OPS-7 (ADR-010 accepted)
- race PromptPay หมดอายุ × จ่ายสำเร็จ → PAY-5 (ยืนยัน) → PAY-6 (ADR-015 accepted A + D)
- `void_reason` → EV-5 · `requires_shipping=false`, `expires_at` วันที่ล้วน → EV-8 · reservation/วันที่จริง/inventory item ร่วม/shipping profile Digital → EV-10
- worker ตายหลัง `ETIMEDOUT` → OPS-8 (ADR-012 accepted) · standalone / `agentRules` / `testMatch` → OPS-6
- error 409 ของ Medusa (`CONFLICT`) เขียนทับ `code`/`message` → PROMO-2 ☑ (spec 03 กฎข้อ 13)
- returns: ownership → CORE-13 ☑ · ฟิลด์ต้องห้าม → CORE-16 ☑ · ตรวจ option → CORE-17 · sales channel ของ location → CORE-21 · หน้า storefront → CORE-20
- cart หลัง join group buy → GB-3 (backend) + GB-7 (storefront) · leave → GB-3b
- รอบ 6 (2026-10-26): admin group buy → GB-6a/6b/6c · cookie `aff` ก่อน placeOrder → AF-3b · เรียง line ก่อนแจก cap → AF-4 · lock ตอน cancel payout → AF-9b ·
  ปุ่มยกเลิก payout → AF-6 · resend e-voucher `idempotency_key` → EV-5b · helper e2e admin → OPS-11 · "Medusa Store" → CORE-18 (account)/CORE-4d (checkout) ·
  AC-61 ไม่นับข้อมูล backend → CORE-18 · แยก CORE-14 → 14a/14b + 14c (transferCart 404) · แยก PAY-6 → 6a/6b · ยกเลิก profile Digital → EV-10/EV-11, job → EV-12

## ข้อตกลงการทำงานต่อ PR
planner (เฉพาะเมื่อ spec เปลี่ยน) → builder (TDD, worktree) → qa (e2e + evidence) →
reviewer (อิสระ) → session หลัก merge เข้า develop (main เป็นของ owner) → PR ถัดไป
คอลัมน์สถานะอัปเดตโดย session หลัก (builder ห้ามแก้ไฟล์นี้)
