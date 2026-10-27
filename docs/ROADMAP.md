# ROADMAP — milestone, ลำดับ PR, สถานะ

สัญลักษณ์: ☐ ยังไม่ทำ · ◐ อยู่ใน PR · ☑ merge เข้า develop แล้ว · 🚀 release แล้ว · ✕ ปิด (owner ไม่ทำ)
แต่ละแถว = 1 PR เข้า `develop` แถวที่ทำคู่ขนานได้มีเครื่องหมาย ∥ และ builder หลายตัวสร้างพร้อมกันได้
สถานะล่าสุดตาม PR #1–#114 (2026-10-27, รอบ 9 — ข้อมูลจาก session หลัก): merge แล้วถึง #106 (#104 = เอกสาร spec รอบ 8);
เปิดอยู่ #107 AF-9b, #108 OPS-7, #109 CORE-4d, #110 AF-7, #111 EV-5b, #112 CORE-20, #113 CORE-14b, #114 GB-6c1, #115 FS-6, #116 spec รอบ 9 (#107/#108/#109/#113 อยู่ในคิว merge)

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
| CORE-4c1 ∥ 4d | ข้อความไทย: account/login/register/verify-account ∥ checkout (รวมข้อความของ PAY-2 + ประโยคยอมรับเงื่อนไขขั้น review) | ☑ #92 ∥ ◐ #109 |
| CORE-4c2 | ข้อความไทย: cart, order detail/confirmed, policy 5 หน้า, common/skeletons + follow-up รอบ 7 | ☑ #102 + #103 |
| CORE-4e | (รอบ 9, nit/qa #109 + qa #98) Stripe Elements `locale: "th"`, `friendlyErrorMessage` ใน action ของ checkout, "พร้อมเพย์" แบบเดียว, placeholder "เลือกประเทศ", test id/aria-label popup ที่อยู่ (AC-90, 91) | ☐ (← CORE-4d #109) |
| CORE-22 | (qa #92, defect starter) title หน้า account, เบอร์ว่างไม่แสดง `null`, panel แก้ไขที่ปิดไม่รับ click (AC-82..84) | ☑ #99 |
| CORE-23 | (qa #99, defect starter รอบ 8) ลบเบอร์โทรได้, editor อีเมลออก, order ไม่พบตอบ 404, error token หมดเป็นไทย, จัดแนว "ยังไม่ได้ระบุ" (AC-85..89) | ☑ #105 |
| CORE-23b | (รอบ 9, qa/review #105) progress ตอนเปลี่ยนหน้า account, ฟอร์มไม่ล้างค่าเมื่อบันทึกล้ม, e2e AC-88 (AC-97) | ☐ (← CORE-23 ☑) |
| CORE-5 | Playwright + convention การเก็บ evidence | ☑ #7 |
| CORE-6 | store route เฉพาะ customer + e2e AC-1..4, AC-6 | ☑ #36 |
| CORE-12 | ownership middleware: cart/payment-collection/order ต้องเป็นของ customer ที่ล็อกอิน (ADR-013) | ☑ #51 |
| CORE-13 | `POST /store/returns` ต้องเป็นเจ้าของ order + ปิด order transfer ทั้งชุด | ☑ #56 |
| CORE-16 | ปิด `return_shipping.price`/`receive_now`/`location_id` บน `POST /store/returns` + seed "Standard return" | ☑ #63 |
| CORE-17 | **ความปลอดภัย** return option ต้อง `is_return`/`enabled_in_store` (`eq` เท่านั้น) + service zone ของ order | ☑ #71 |
| CORE-18 | เนื้อหาร้านไทย placeholder แทนโฆษณา starter + ลบ `product-onboarding-cta` + "Medusa Store" → `STORE_NAME` | ☑ #80 |
| CORE-7 | Translation module + store locales | ☑ #26 |
| OPS-1 | Dockerfiles, worker mode, health | ☑ #9 (+ hotfix #18) |
**Release v0.1.0** — ร้านค้าที่เข้าชมได้, ชำระเงิน manual (เงื่อนไข release แรกที่เปิดให้ลูกค้าจริง: CORE-12 ☑, CORE-12b ☑, CORE-17 ☑, CORE-18 ☑)

ไม่บล็อก release v0.1.0:
| Task | งาน | สถานะ |
|------|-----|--------|
| CORE-10 | seed follow-up (ชื่อไทย, idempotency, หัวข้อ dev ใน README; ค่าส่งคง placeholder) | ☑ #76 |
| CORE-11 | อีเมล shipped เฉพาะ item ใน fulfillment / `no_notification` | ☑ #64 |
| CORE-12b | **ความปลอดภัย** ownership ของ `cart_id` ใน query products/variants | ☑ #78 |
| CORE-14a | storefront `/buy` บังคับล็อกอิน, ปิด UCP/`cart/resume`, cookie cart ค้าง, ลบหน้า order transfer (AC-41..43, 56) | ☑ #81 |
| CORE-14b ∥ CORE-14c | no-JS login + error `add_variant` (AC-44, 45) ∥ login ไม่ล้มเมื่อ `transferCart()` ได้ 404 (AC-76) + nit e2e AC-41 307/308 | ◐ #113 ∥ ☐ (14c ← CORE-14a ☑) |
| CORE-14d ∥ CORE-24 | (รอบ 9, #113) `/cart` ไม่ค้าง skeleton หลัง login no-JS, `add_error` + `unstable_rethrow`, `add_variant` ตอนล็อกอินแล้ว (AC-92, 93) ∥ ตัวเลือกจำนวนบน PDP (AC-94) | ☐ ∥ ☐ (ทั้งคู่ ← CORE-14b #113) |
| CORE-15 | หน้า `/store` หยุดยิงซ้ำเมื่อ search error + ป้ายราคา ฿ (AC-69) | ☐ (← CORE-9 ☑) |
| CORE-19a ∥ CORE-19b | ตัวนับ cart + search drawer 375px ∥ ปุ่ม "Continue to review" ไม่ค้าง | ☐ (19a ← CORE-4b2 ☑; 19b ← CORE-4e — ไฟล์ checkout เดียวกัน) |
| CORE-20 | หน้าขอคืนสินค้าจาก order detail | ◐ #112 |
| CORE-20b ∥ CORE-20c | (รอบ 9, review #112) backend บังคับช่วงคืน N วัน + กัน line ไม่ต้องจัดส่ง บน `POST /store/returns` (AC-95; owner ตัดสิน Q-F6 2026-10-27) ∥ storefront: window จาก region ของ order, `shipped_quantity`, ไม่ `force-cache`, e2e region แยก (AC-96) | ☐ (20b ← CORE-21 ☑ — เริ่มได้) ∥ ☐ (20c ← CORE-20 #112) |
| CORE-21 | return option: stock location ต้องอยู่ใน sales channel ของ order + test order ไม่มี `country_code` + error ไม่สะท้อน `option_id` | ☑ #86 |

## M2 การชำระเงิน
| Task | งาน | สถานะ |
|------|-----|--------|
| PAY-1 | Stripe provider + webhooks | ☑ #13 |
| PAY-2 | UI checkout บัตร + PromptPay + e2e | ☑ #48 |
| PAY-3 | หน้าชำระเงิน order (สำหรับ group buy) | ☐ (← PAY-2 ☑) |
| PAY-4 | Refund e2e (refund บางส่วน → `partially_refunded` + credit line) | ☑ #94 |
| PAY-5 | race QR หมดอายุ × จ่ายสำเร็จ — ยืนยันกรณี (b) + ADR-015 | ☑ #65 |
| PAY-6a | ADR-015 A ฝั่ง backend: guard + 409 `PAYMENT_ALREADY_COMPLETED` | ☑ #82 |
| PAY-6b | storefront poll + complete cart ทางสำรอง (6b1) ∥ alert + runbook + script `refund-orphan-payment.ts` (6b2) | ☑ #98 ∥ ☑ #97 |
| PAY-6c | (รอบ 9, review #98) เพดานการลองซ้ำ 10 ครั้ง + UI เงินถูกคืนแล้ว (spec 06 กฎข้อ 8, AC-17) — ควรก่อน release ที่เปิดพร้อมเพย์จริง | ☐ (← CORE-4e) |
**Release v0.2.0** — ชำระเงินจริงใน test mode; checklist go-live สำหรับ live keys

## M3 E-voucher — **v0.3.0**
EV-1 ☑ #15 · EV-2 ☑ #25 · EV-3 ☑ #31 · EV-4 ☑ #67 ·
EV-5 ☑ #43 · EV-5b ◐ #111 · EV-6 ☑ #39 · EV-7 ☐ (← EV-4 ☑; checkout digital-only เลือก option Digital delivery ด้วย `type.code` — ไม่บังคับ Digital method ฝั่ง backend) · EV-8 ☑ #54 ·
EV-9 ☐ (← EV-2, EV-6; ถ้า #111 merge ก่อน ให้ resend ใช้ link `evoucher_code ↔ order`) · EV-10 ☑ #85 · EV-11 ☑ #88 ·
EV-12 ☐ **เริ่มได้** (owner Q6 2026-10-27: job เว้น code ใกล้หมดอายุเท่าที่ถูกจอง `expires_at` ไกลสุดก่อน + allocation ใช้ code ที่เว้น; AC-30, AC-30b; ← EV-5 ☑, EV-10 ☑) ·
EV-13 ☐ (รอบ 9, qa #111: widget order ไม่ล้น 1280px + toast ไม่โชว์ `noti_…`; AC-32; ← EV-5b #111) ∥
EV-5c ☐ (รอบ 9, nit review #111: lock `evoucher-order:<id>` ร่วม allocation/resend, ไม่กลืน error Redis, ส่งสำเร็จแต่ update ล้ม → 200; AC-33; ← EV-5b #111)

## M4 Flash sale — **v0.4.0**
PROMO-1 ☑ #21 (+ #24) · FS-1 ☑ #14 (+ hotfix #22) · FS-3 ☑ #28 · FS-2 ☑ #37 · FS-4 ☑ #32 · FS-5 ☑ #38 · FS-7 ☑ #53 · PROMO-2 ☑ #50 ·
FS-10 ☑ #74 · FS-6 ◐ #115 · FS-8 ☑ #69 · FS-11 ☑ #83 ·
FS-12 ☐ (รอบ 9, backend: context ของ item ใน price preview ตรงกับ cart `items.product.id`; AC-18; ← FS-4 ☑ — เริ่มได้) ∥ FS-13 ☐ (storefront: disable ปุ่มเมื่อ sold out + ราคา flash บน PLP/แถบมือถือ; AC-19; ← FS-6 #115) ·
FS-9 ✕ (owner ตัดสินไม่ทำ 2026-10-27)
(FS-2 คืนโควตาเมื่อ cancel หรือ refund เต็มจำนวน ไม่ว่ามาจาก return — owner 2026-10-25)

## M5 Group buying — **v0.5.0**
GB-1 ☑ #17 · ADR-011 ☑ #33 · GB-2a ☑ #42 → GB-2b ☑ #49 → GB-2c ☑ #58 ·
GB-3 ☑ #68 → (GB-3b ☑ #95 ∥ GB-3c ☑ #100 ∥ GB-4 ☑ #89) → GB-5 ☐ (← PAY-3; ปัดยอด collection 2 ตำแหน่ง + test `completed` AC-37) → GB-7 ☐ (← GB-5, GB-3b ☑) ;
GB-6a ☑ #75 → (GB-6b1 ☑ #87 ∥ GB-6b2 ☑ #96) → GB-6c1 ◐ #114 (route membership) → GB-6c2 ☐ (ตาราง membership + succeed/fail manual, AC-35 + nit #114: test `payment_status`/404 `not_found`, `customer` null) ;
GB-N1 ☑ #106 · GB-N2 ☐ (รอบ 9, test-only: แก้ flaky concurrency ของ `group-buy-join.spec.ts` hook timeout 240s; ← GB-3 ☑ — เริ่มได้) · Q11 owner ยืนยัน (ก) ยอมรับ lock TTL 60s ใน v1 — ไม่มี task

## M6 Affiliate — **v0.6.0**
AF-1 ☑ #11 · AF-2 ☑ #66 · AF-5 ☑ #35 → AF-3 ☑ #77 → (AF-3b ☐ storefront sync cookie ∥ AF-4 ☑ #90 ∥ AF-4b ☑ #91 ∥ AF-7 ◐ #110 (รวม `GET /affiliate/me/payouts` + paging, AC-32/33 — owner 2026-10-27)) →
AF-7b ☐ (PR แยกหลัง #110 merge เท่านั้น: การ์ดเดียวต่อสินค้าด้วยอัตราจริงตามกฎ 29 AC-34 + ตัด `reference` ออกจาก payouts ตามคำตัดสิน owner AC-32) → AF-8 ☐ (← AF-7, AF-7b, AF-4 ☑; AC-35) ;
AF-5 → AF-9 ☑ #79 → (AF-6 ☐ + ปุ่มยกเลิก payout ∥ AF-9b ◐ #107 → AF-N1 ☐ test nit #107) ;
AF-10 ☐ (รอบ 9, review #90: maturity job reconcile order ยกเลิกที่ไม่มี reversal, AC-36; ← AF-4 ☑ — เริ่มได้)

## M7 Scale และ hardening — **v1.0.0** 🎯
OPS-2 ☑ #27 · OPS-6 ☑ #47 · OPS-3 ☐ (JSON logs + alert `Error running event bus worker`, AC-18) → (OPS-3b ☐ rate limiting AC-22 **รอ owner ตอบ Q-O1** ∥ OPS-3c ☐ Sentry AC-23 **รอ owner ตอบ Q-O2**) · OPS-5 ☐ · OPS-7 ◐ #108 · OPS-8 ☑ #101 →
OPS-12 ☐ (smoke ใน CI job `docker-worker-mode`; เริ่มหลัง #108 merge) ∥ OPS-13 ☐ (รอบ 9, review #108: warn เมื่อ prod ตั้ง `ALLOW_TEST_PROVIDERS`, ถ้อยคำ go-live ข้อ 3, ข้อ Q-F1 ค่าส่ง placeholder ใน checklist go-live; AC-20, 21; ← #108) ·
OPS-9 ☑ #72 · OPS-10 ☐ (← PAY-2 ☑) ; OPS-4 ☐ (← FS-6, GB-7) · OPS-11 ☑ #87 (รวมใน GB-6b1)

hotfix/chore: #46 (test FS-4 × CORE-6), #52 (jest integration heap OOM), #59 (ลด CI ซ้ำซ้อน — ตัด push ไป develop)

## Backlog follow-up (แปลงเป็น task แล้ว — รายละเอียด/AC อยู่ใน spec)
- ฟอนต์ ui-preset → CORE-8 · เครื่องมือ evidence e2e → CORE-5b · ราคา THB หน้า store → CORE-9
- seed (ชื่อไทย, idempotency, `.env.example`; ค่าส่ง Standard คง placeholder จนกว่า owner ตัดสิน Q-F1) → CORE-10 · อีเมล shipped / `no_notification` → CORE-11
- `pp_system_default` ใน prod (D1) + fail-fast `RESEND_API_KEY`/`AFFILIATE_TOKEN_SECRET` + checklist go-live → OPS-7 (ADR-010 accepted)
- race PromptPay หมดอายุ × จ่ายสำเร็จ → PAY-5 (ยืนยัน) → PAY-6 (ADR-015 accepted A + D)
- `void_reason` → EV-5 · `requires_shipping=false`, `expires_at` วันที่ล้วน → EV-8 · reservation/วันที่จริง/inventory item ร่วม → EV-10
- worker ตายหลัง `ETIMEDOUT` → OPS-8 (ADR-012 accepted) · standalone / `agentRules` / `testMatch` → OPS-6
- error 409 ของ Medusa (`CONFLICT`) เขียนทับ `code`/`message` → PROMO-2 ☑ (spec 03 กฎข้อ 13)
- returns: ownership → CORE-13 ☑ · ฟิลด์ต้องห้าม → CORE-16 ☑ · ตรวจ option → CORE-17 ☑ · sales channel ของ location → CORE-21 ☑ · หน้า storefront → CORE-20
- cart หลัง join group buy → GB-3 (backend) + GB-7 (storefront) · leave → GB-3b
- รอบ 6 (2026-10-26): admin group buy → GB-6a/6b/6c · cookie `aff` ก่อน placeOrder → AF-3b · เรียง line ก่อนแจก cap → AF-4 · lock ตอน cancel payout → AF-9b ·
  ปุ่มยกเลิก payout → AF-6 · resend e-voucher `idempotency_key` → EV-5b · helper e2e admin → OPS-11 · "Medusa Store" → CORE-18/CORE-4d ·
  แยก CORE-14 → 14a/14b + 14c · แยก PAY-6 → 6a/6b · voucher ไม่มี shipping profile → EV-10/EV-11, job → EV-12
- รอบ 7 (2026-10-26): แยก CORE-4c → 4c1/4c2 · defect starter ของ account → CORE-22 · summary ของ draft order → GB-3c · `STOREFRONT_URL` → OPS-7 (AC-17) ·
  payout/reversal → AF-4 · order ยกเลิก (attribution) → AF-4b · runbook ลบ payment session → PAY-6b
- รอบ 8 (2026-10-26): OPS-8 ปิดด้วย smoke + alert → OPS-3 (AC-18), OPS-12 · AC-6 refund บางส่วน → spec 06 · refund payment ที่ collection ไม่ผูก order → ADR-015 ภาคผนวก 2 ·
  defect starter หน้า profile/order → CORE-23 · ปัดยอด 2 ตำแหน่ง → GB-5 (AC-37) · nit สะสม → GB-N1
- รอบ 9 (2026-10-27): owner ตัดสิน spec 02 Q6 (เว้น code เท่าที่จอง → EV-12 เริ่มได้) / Q7 (ลบ pool → `requires_shipping=true` เสมอ), spec 05 Q13 + payouts route (AF-7 #110),
  spec 04 Q11 (ก), FS-9 ✕, Q-F6 (backend บังคับช่วงคืน → CORE-20b), ชื่อ "พร้อมเพย์", payouts ไม่แสดง `reference` (→ AF-7b) · Q-F1 ยังไม่ตัดสิน → checklist go-live ใน OPS-13 ·
  nit/qa #109 → CORE-4e · #112 → CORE-20b/CORE-20c · #113 → CORE-14d/CORE-24 · #105 → CORE-23b · #98 → PAY-6c · #111 → EV-13/EV-5c (+ link ใน EV-9) ·
  #110 การ์ดซ้ำ/อัตราผิด → AF-7b/AF-8 (กฎ 29) · #90 reconcile → AF-10 · #107 → AF-N1 · #114 → GB-6c2 · #115 → FS-12/FS-13 · flaky `group-buy-join` → GB-N2 ·
  rate limit/Sentry ของ OPS-3 → OPS-3b/OPS-3c (รอ Q-O1/Q-O2) ·
  #108 → OPS-13 + ADR-010 ภาคผนวก · (ตรวจแล้วไม่ใช่ปัญหา: production ใช้ locking-redis ผ่าน `infra-modules.ts`)

## ข้อตกลงการทำงานต่อ PR
planner (เฉพาะเมื่อ spec เปลี่ยน) → builder (TDD, worktree) → qa (e2e + evidence) →
reviewer (อิสระ) → session หลัก merge เข้า develop (main เป็นของ owner) → PR ถัดไป
คอลัมน์สถานะอัปเดตโดย session หลัก (builder ห้ามแก้ไฟล์นี้)
