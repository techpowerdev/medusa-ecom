# ROADMAP — milestone, ลำดับ PR, สถานะ

สัญลักษณ์: ☐ ยังไม่ทำ · ◐ อยู่ใน PR · ☑ merge เข้า develop แล้ว · 🚀 release แล้ว · ✕ ปิด (owner ไม่ทำ / ไม่ต้องทำ) · ⏸ เลื่อนหลัง v1.0
แต่ละแถว = 1 PR เข้า `develop` แถวที่ทำคู่ขนานได้มีเครื่องหมาย ∥ และ builder หลายตัวสร้างพร้อมกันได้
สถานะล่าสุดตาม PR #1–#138 (2026-10-27, รอบ 10 — ข้อมูลจาก session หลัก): merge แล้วถึง #132 รวม #126 GB-N2, #128 CORE-14d, #131 CORE-4e, #132 ยกเว้น #130;
อยู่ในคิว merge (◐): #130 CORE-20c (owner อนุมัติ merge), #133 OPS-14, #134 CORE-24, #137 AF-N1; เปิดอยู่ (◐): #135 AF-8a, #136 PAY-6c, #138 AF-6
**owner ตอบแล้ว 2026-10-27 (รอบ 5)**: ADR-016 accepted ทางเลือก A (GB-8 เริ่มได้), spec 02 Q10 = (ก) (EV-7c เริ่มได้), spec 07 Q-O3 = ตามข้อเสนอทั้งชุด (OPS-4 เริ่มได้),
spec 05 Q15 = เลื่อนหลัง v1.0 (AF-11 ⏸), spec 02 Q11 = คงเดิม · **รอ owner**: AF-6 admin UI อ่านอย่างเดียว — ต้องมี task UI สร้าง/แก้ไหม (session หลักกำลังยืนยัน, ยังไม่มี task)

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
| CORE-4c1 ∥ 4d | ข้อความไทย: account/login/register/verify-account ∥ checkout (รวมข้อความของ PAY-2 + ประโยคยอมรับเงื่อนไขขั้น review) | ☑ #92 ∥ ☑ #109 |
| CORE-4c2 | ข้อความไทย: cart, order detail/confirmed, policy 5 หน้า, common/skeletons + follow-up รอบ 7 | ☑ #102 + #103 |
| CORE-4e | Stripe Elements `locale: "th"`, `friendlyErrorMessage` ใน action ของ checkout, "พร้อมเพย์" แบบเดียว, placeholder "เลือกประเทศ", test id/aria-label popup ที่อยู่ (AC-90, 91) | ☑ #131 |
| CORE-4f ∥ CORE-14f | (รอบ 10) error login/register เป็นไทย + คงอีเมลเมื่อล้ม (AC-98) ∥ ข้อความการ์ด `add-variant-pending` + `countryCode` ปลอมไม่ 5xx (AC-101) | ☐ **เริ่มได้** ∥ ☐ **เริ่มได้** (← CORE-14d ☑ #128) |
| CORE-4g | (รอบ 10, review/qa #131) `medusaError` คง status, `promotion-error` เมื่อโค้ดใช้ไม่ได้, `compareAddresses`, ความสูง `CountrySelect` (AC-99) | ☐ **เริ่มได้** (← CORE-4e ☑) |
| CORE-22 | (qa #92, defect starter) title หน้า account, เบอร์ว่างไม่แสดง `null`, panel แก้ไขที่ปิดไม่รับ click (AC-82..84) | ☑ #99 |
| CORE-23 | (qa #99, defect starter รอบ 8) ลบเบอร์โทรได้, editor อีเมลออก, order ไม่พบตอบ 404, error token หมดเป็นไทย, จัดแนว "ยังไม่ได้ระบุ" (AC-85..89) | ☑ #105 |
| CORE-23b | (รอบ 9, qa/review #105) progress ตอนเปลี่ยนหน้า account, ฟอร์มไม่ล้างค่าเมื่อบันทึกล้ม, e2e AC-88 (AC-97) | ☐ เริ่มได้ (← CORE-23 ☑) |
| CORE-5 | Playwright + convention การเก็บ evidence | ☑ #7 |
| CORE-5c | (รอบ 10, e2e tooling) evidence เขียนเฉพาะโฟลเดอร์ของ `evidenceTarget`, `step()` อยู่ในงบ (AC-103) | ☐ **เริ่มได้** (← CORE-5b ☑) |
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
| CORE-14b ∥ CORE-14c | no-JS login + error `add_variant` (AC-44, 45) ∥ login ไม่ล้มเมื่อ `transferCart()` ได้ 404 (AC-76) + e2e redirect แรกของ `/buy` (303), `/ucp` (307/308) | ☑ #113 ∥ ☑ #117 |
| CORE-14d ∥ CORE-24 | `/cart` ไม่ค้าง skeleton หลัง login no-JS, `add_error` + `unstable_rethrow`, `add_variant` ตอนล็อกอินแล้ว = การ์ดยืนยัน (กฎ 58, #132) (AC-92, 93 — รอบ 10: AC-93 (c) ทดสอบ no-JS ครั้งเดียวพอ) ∥ ตัวเลือกจำนวนบน PDP (AC-94) | ☑ #128 ∥ ◐ #134 (คิว merge) |
| CORE-14e | ⏸ หลัง v1.0 (owner Q-F7 2026-10-27): nonce กันฟอร์ม no-JS ส่งซ้ำ (qty สองเท่า — owner ตัดสิน; cart ค้าง 2 ใบ จาก qa #128 O-2 — planner รวมเข้า) — ไม่มี AC | ⏸ |
| CORE-15 | หน้า `/store` หยุดยิงซ้ำเมื่อ search error + ป้ายราคา ฿ (AC-69) | ☐ เริ่มได้ (← CORE-9 ☑) |
| CORE-19a ∥ CORE-19b | ตัวนับ cart + search drawer 375px ∥ ปุ่ม "Continue to review" ไม่ค้าง | ☑ #118 ∥ ☐ เริ่มได้ (19b ← CORE-4e ☑) |
| CORE-19c | (รอบ 10, qa #118) `DeleteButton` ส่งต่อ `data-testid` + error เมื่อลบล้ม (AC-100) | ☐ **เริ่มได้** |
| CORE-20 | หน้าขอคืนสินค้าจาก order detail | ☑ #112 |
| CORE-20b ∥ CORE-20c | backend บังคับช่วงคืน N วัน + กัน line ไม่ต้องจัดส่ง (AC-95) ∥ storefront: window จาก region ของ order, `shipped_quantity`, ไม่ `force-cache` (AC-96) | ☑ #124 ∥ ◐ #130 (คิว merge — owner อนุมัติ) |
| CORE-20d | (รอบ 10) ค่าเริ่มต้น window ตรง backend ทุกหน้า, window ต่อ line, map error code + contract test, `GET /store/regions/:id` (AC-102) | ☐ (← CORE-20c #130) |
| CORE-21 | return option: stock location ต้องอยู่ใน sales channel ของ order + test order ไม่มี `country_code` + error ไม่สะท้อน `option_id` | ☑ #86 |

## M2 การชำระเงิน
| Task | งาน | สถานะ |
|------|-----|--------|
| PAY-1 | Stripe provider + webhooks | ☑ #13 |
| PAY-2 | UI checkout บัตร + PromptPay + e2e | ☑ #48 |
| PAY-3 | **แยกรอบ 10** (builder หยุด: Store API อ่าน draft order ไม่ได้) → PAY-3a + GB-8 + PAY-3b | — |
| PAY-3a | (backend test-only) ownership ของ session route บน collection ของ draft order + guard × webhook บน collection ของ order (AC-18) | ☐ **เริ่มได้** (← PAY-6a ☑, GB-4 ☑) |
| PAY-3b | หน้า `/account/orders/:id/pay` อ่านจาก GB-8, 409 → poll อย่างเดียวมีเพดาน + e2e (AC-7, AC-19) | ☐ (← GB-8, PAY-3a, PAY-6c) |
| PAY-4 | Refund e2e (refund บางส่วน → `partially_refunded` + credit line) | ☑ #94 |
| PAY-5 | race QR หมดอายุ × จ่ายสำเร็จ — ยืนยันกรณี (b) + ADR-015 | ☑ #65 |
| PAY-6a | ADR-015 A ฝั่ง backend: guard + 409 `PAYMENT_ALREADY_COMPLETED` | ☑ #82 |
| PAY-6b | storefront poll + complete cart ทางสำรอง (6b1) ∥ alert + runbook + script `refund-orphan-payment.ts` (6b2) | ☑ #98 ∥ ☑ #97 |
| PAY-6c | เพดานการลองซ้ำ 10 ครั้ง + UI เงินถูกคืนแล้ว (spec 06 กฎข้อ 8, AC-17) — ควรก่อน release ที่เปิดพร้อมเพย์จริง | ◐ #136 |
**Release v0.2.0** — ชำระเงินจริงใน test mode; checklist go-live สำหรับ live keys

## M3 E-voucher — **v0.3.0**
EV-1 ☑ #15 · EV-2 ☑ #25 · EV-3 ☑ #31 · EV-4 ☑ #67 · EV-5 ☑ #43 · EV-5b ☑ #111 · EV-6 ☑ #39 · EV-8 ☑ #54 · EV-10 ☑ #85 · EV-11 ☑ #88 · EV-12 ☑ #123 ·
EV-7 **แตกรอบ 10** → EV-7a ☐ **เริ่มได้** (backend: `GET /store/customers/me/evouchers` + `allowFields` ข้อมูลพาร์ทเนอร์บน `/store/products*`; AC-34, 35) →
EV-7b ☐ (PDP `evoucher-partner-block` + หน้า `/account/vouchers`; AC-6 แก้ให้ทดสอบได้, AC-36) ∥ EV-7c ☐ **เริ่มได้** (owner Q10 = (ก) 2026-10-27: ที่อยู่ใบกำกับภาษีเป็น `shipping_address`, ข้ามเฉพาะขั้นเลือกวิธีจัดส่ง; AC-3, AC-37) ·
EV-9 ☐ (← EV-2, EV-6; resend ใช้ link `evoucher_code ↔ order` เพราะ #111 merge แล้ว; รอบ 10 qa: เรียง code ด้วย `created_at` แล้ว `id` เป็น key รอง — AC-39) · EV-13 ☐ เริ่มได้ (AC-32) ∥ EV-5c ☐ เริ่มได้ (AC-33) ∥ EV-N1 ☐ เริ่มได้ (nit #123, AC-38)

## M4 Flash sale — **v0.4.0**
PROMO-1 ☑ #21 (+ #24) · FS-1 ☑ #14 (+ hotfix #22) · FS-3 ☑ #28 · FS-2 ☑ #37 · FS-4 ☑ #32 · FS-5 ☑ #38 · FS-7 ☑ #53 · PROMO-2 ☑ #50 ·
FS-10 ☑ #74 · FS-6 ☑ #115 · FS-8 ☑ #69 · FS-11 ☑ #83 · FS-13 ☑ #129 ·
FS-12 ✕ (รอบ 10: ปิด — QA #115 พิสูจน์ preview = cart ทั้ง 5 แบบ target rule) · FS-9 ✕ (owner ตัดสินไม่ทำ 2026-10-27) ·
FS-14 ☐ **เริ่มได้** (ราคา flash บน `/store`, `/search`, rail หน้าแรก ผ่าน `GET /store/products` ไม่แตะ search index; AC-20) ∥
FS-15 ☐ (← CORE-24 #134: เตือน/disable จำนวนเกิน `remaining_units` + ข้อความไทยของ `FLASH_*` ตอน complete; AC-21, 22) → FS-16 ☐ (← FS-14, FS-15: ปุ่มรอข้อมูล flash, `product-price` ขีดฆ่า, ป้าย sold out บนการ์ด; AC-23)
(FS-2 คืนโควตาเมื่อ cancel หรือ refund เต็มจำนวน ไม่ว่ามาจาก return — owner 2026-10-25)

## M5 Group buying — **v0.5.0**
GB-1 ☑ #17 · ADR-011 ☑ #33 · GB-2a ☑ #42 → GB-2b ☑ #49 → GB-2c ☑ #58 ·
GB-3 ☑ #68 → (GB-3b ☑ #95 ∥ GB-3c ☑ #100 ∥ GB-4 ☑ #89) →
(รอบ 10) PAY-3a ☐ เริ่มได้ ∥ GB-8 ☐ **เริ่มได้** (ADR-016 accepted ทางเลือก A, owner 2026-10-27; store route อ่าน draft order ผ่าน membership + index `(customer_id, joined_at)`; AC-38..40) →
GB-5 ☐ (← PAY-3a — ไม่ต้องรอ PAY-3b; ปัดยอด collection 2 ตำแหน่ง + test `completed` AC-37) ∥ PAY-3b ☐ (← GB-8) → GB-7 ☐ (← GB-5, GB-8, PAY-3b, GB-3b ☑) ;
GB-6a ☑ #75 → (GB-6b1 ☑ #87 ∥ GB-6b2 ☑ #96) → GB-6c1 ☑ #114 → GB-6c2 ☑ #121 → GB-6d ☐ เริ่มได้ (nit/qa #121; AC-41) ;
GB-N1 ☑ #106 · GB-N2 ☑ #126 (nit `trackSubscribers` คัดลอก `subscriberId` ถ้ายังไม่แก้ใน #126 → แก้ใน PR ถัดไปที่แตะ `group-buy-join.spec.ts`) · Q11 owner ยืนยัน (ก) ยอมรับ lock TTL 60s ใน v1 — ไม่มี task

## M6 Affiliate — **v0.6.0**
AF-1 ☑ #11 · AF-2 ☑ #66 · AF-5 ☑ #35 → AF-3 ☑ #77 → (AF-3b ☑ #119 ∥ AF-4 ☑ #90 ∥ AF-4b ☑ #91 ∥ AF-7 ☑ #110) → AF-7b ☑ #122 →
AF-N2 ☐ เริ่มได้ (nit #125/#122: lock สั้นใน maturity job, log, type `Program`; AC-38) → AF-8 (แตกเป็น AF-8a ◐ #135 / AF-8b — นิยามรอ planner รอบถัดไป; AC-35) ;
AF-5 → AF-9 ☑ #79 → (AF-6 ◐ #138 (ปุ่มยกเลิก payout; + qa รอบ 10: ปุ่ม Cancel ไม่หลุดจอที่ 1280px, ยกเลิกไม่สำเร็จต้อง refetch — AC-26 ส่วนเพิ่ม) ∥ AF-9b ☑ #107 → AF-N1 ◐ #137 คิว merge) ;
AF-10 ☑ #125 · AF-3c ☐ เริ่มได้ (static test จุดเริ่มชำระผ่าน `syncAffiliateBefore`; AC-37) · AF-11 ⏸ หลัง v1.0 (owner Q15 2026-10-27) ·
**รอ owner**: AF-6 admin UI ตอนนี้อ่านอย่างเดียว (สร้าง/แก้โปรแกรม, อนุมัติ/ระงับ affiliate, สร้าง payout, mark paid ทำผ่าน API) — ต้องมี task UI ไหม (session หลักยืนยัน; ยังไม่สร้าง task)

## M7 Scale และ hardening — **v1.0.0** 🎯
OPS-2 ☑ #27 · OPS-6 ☑ #47 · OPS-3 ☑ #120 (JSON logs + alert `Error running event bus worker`, AC-18) · OPS-3b ⏸ rate limiting · OPS-3c ⏸ Sentry (owner Q-O1/Q-O2 2026-10-27: เลื่อนหลัง v1.0) ·
OPS-5 ☐ · OPS-7 ☑ #108 · OPS-8 ☑ #101 · OPS-13 ☑ #127 · OPS-9 ☑ #72 · OPS-11 ☑ #87 (รวมใน GB-6b1) ·
OPS-14 ◐ #133 คิว merge (CI speedup — owner อนุมัติ 2026-10-27; AC-24) → (OPS-12 ☐ smoke Redis ใน `docker-worker-mode` ∥ OPS-10 ☐ (← PAY-2 ☑) ∥ OPS-15 ☐ log knex `Connection ended unexpectedly` (AC-26)) — แตะ `ci.yml` จึงเริ่มหลัง #133 ·
OPS-13b ☐ เริ่มได้ (nit #127 `production.md`; AC-25) ·
OPS-4 ☐ **เริ่มได้** (owner Q-O3 2026-10-27 ตามข้อเสนอทั้งชุด: `docker-compose.prod.yml` ใน runner, seed ลูกค้า/token ด้วย script, "พอดี 100" = complete checkout ด้วย manual payment, k6 image pin, `load-nightly.yml` แยก; Depends FS-3 ☑ + GB-3 ☑ + OPS-1 ☑)

hotfix/chore: #46 (test FS-4 × CORE-6), #52 (jest integration heap OOM), #59 (ลด CI ซ้ำซ้อน — ตัด push ไป develop)

## Backlog หลัง v1.0 (owner ตัดสินเลื่อน — ไม่มี AC จนกว่าจะกลับมาทำ)
- **CORE-14e** nonce กันฟอร์ม no-JS ส่งซ้ำ (owner Q-F7 2026-10-27 — กรณี qty สองเท่า; กรณี cart ค้าง 2 ใบ planner รวมเข้า) — spec 01 Open questions รอบ 9
- **OPS-3b** rate limiting (owner Q-O1 2026-10-27) — spec 07 AC-22, ข้อเสนอเดิมใน Q-O1
- **OPS-3c** error tracking Sentry (owner Q-O2 2026-10-27) — spec 07 AC-23, ข้อเสนอเดิมใน Q-O2
- **AF-11** reconcile entry ที่ approve แล้วของ order ที่ยกเลิกแต่ไม่มี reversal (owner Q15 2026-10-27) · dedupe `/affiliate/products` ใน SQL เมื่อแคตตาล็อกใหญ่ (planner, review #122)

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
- รอบ 9 (2026-10-27): owner ตัดสิน spec 02 Q6 (เว้น code เท่าที่จอง → EV-12) / Q7 (ลบ pool → `requires_shipping=true` เสมอ), spec 05 Q13 + payouts route (AF-7 #110),
  spec 04 Q11 (ก), FS-9 ✕, Q-F6 (backend บังคับช่วงคืน → CORE-20b), ชื่อ "พร้อมเพย์", payouts ไม่แสดง `reference` (→ AF-7b) · Q-F1 ยังไม่ตัดสิน → checklist go-live ใน OPS-13 ·
  nit/qa #109 → CORE-4e · #112 → CORE-20b/CORE-20c · #113 → CORE-14d/CORE-24 · #105 → CORE-23b · #98 → PAY-6c · #111 → EV-13/EV-5c (+ link ใน EV-9) ·
  #110 การ์ดซ้ำ/อัตราผิด → AF-7b/AF-8 (กฎ 29) · #90 reconcile → AF-10 · #107 → AF-N1 · #114 → GB-6c2 · #115 → FS-12/FS-13 · flaky `group-buy-join` → GB-N2 ·
  rate limit/Sentry ของ OPS-3 → OPS-3b/OPS-3c · #108 → OPS-13 + ADR-010 ภาคผนวก · (ตรวจแล้วไม่ใช่ปัญหา: production ใช้ locking-redis ผ่าน `infra-modules.ts`)
- รอบ 10 (2026-10-27): owner ตัดสิน Q-O1/Q-O2 (OPS-3b/3c ⏸ หลัง v1.0), Q-F7 (CORE-14e ⏸), กฎข้อ 58 (#132), อนุมัติ OPS-14 และ merge #130 ·
  builder หยุด: PAY-3 → PAY-3a/GB-8/PAY-3b + **ADR-016 (accepted A, owner รอบ 5)** · EV-7 → EV-7a/7b/7c (Q10 = ก) · OPS-4 → Q-O3 (ตามข้อเสนอ) · Q15 → AF-11 ⏸ · Q11 คงเดิม ·
  index ใหม่: `group_buy_membership (customer_id, joined_at)` (GB-8), `evoucher_code (customer_id, status)` (EV-7a) · qa EV-9 (key เรียงรอง) → EV-9, qa AF-6 → #138 ·
  FS-12 ✕ ตาม QA #115 · #115/#129 → FS-14/FS-15/FS-16 · #117/#131 → CORE-4f/CORE-4g · #118 → CORE-19c · #124/#130 → CORE-20d · #128 → CORE-14f (+ O-2 → CORE-14e) ·
  CORE-22 evidence → CORE-5c · #119 → AF-3c (+ AC-21 แก้ถ้อยคำ) · #122/#125 → AF-N2 (+ Q15) · #121 → GB-6d · #123 → EV-N1 (+ Q11) · #126 nit → GB-N2 + checklist bump ·
  #127 → OPS-13b · knex log → OPS-15 · แก้ถ้อยคำ AC-41/42 (303 vs 307/308), AC-93 (c), กฎ 29(b) ของ AF-8

## ข้อตกลงการทำงานต่อ PR
planner (เฉพาะเมื่อ spec เปลี่ยน) → builder (TDD, worktree) → qa (e2e + evidence) →
reviewer (อิสระ) → session หลัก merge เข้า develop (main เป็นของ owner) → PR ถัดไป
คอลัมน์สถานะอัปเดตโดย session หลัก (builder ห้ามแก้ไฟล์นี้)
