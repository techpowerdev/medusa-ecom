# ROADMAP — milestone, ลำดับ PR, สถานะ

สัญลักษณ์: ☐ ยังไม่ทำ · ◐ อยู่ใน PR · ☑ merge เข้า develop แล้ว · 🚀 release แล้ว · ✕ ปิด (owner ไม่ทำ / ไม่ต้องทำ) · ⏸ เลื่อนหลัง v1.0
แต่ละแถว = 1 PR เข้า `develop` แถวที่ทำคู่ขนานได้มีเครื่องหมาย ∥ และ builder หลายตัวสร้างพร้อมกันได้
สถานะล่าสุดตาม PR #1–#185 (2026-10-28, **รอบ 12** — ข้อมูลจาก session หลัก): merge แล้วถึง #185 — รอบนี้ #148 FS-14, #149 EV-N1, #150 CORE-14f, #151 CORE-19b, #152 spec รอบ 11,
#153 AF-3c, #154 CORE-23b, #155 EV-7a, #156 OPS-15, #157 PAY-3a, #158 AF-13, #159 CORE-10b, #160 CORE-19d, #161 GB-N3, #162 CORE-4h, #163 AF-12a, #164 FS-17, #165 AF-12b, #166 CORE-19e,
#167 EV-13, #168 CORE-20d, #169 CORE-5c, #170 CORE-4g, #171 EV-5c, #172 OPS-12, #173 AF-8b, #174 EV-7c, #175 OPS-4, #176 AF-12c, #177 CORE-15, #178 FS-15, #179 EV-7b, #180 OPS-16,
#181 (กฎ admin ใช้ของ Medusa), #182 AF-8c, #183 ADR-018/spec 08, #184 spec PAY-3b (race 400), #185 GB-5;
#186 ADM-1 ☑ (กำลัง merge); เปิดอยู่ (◐): #187 AF-14, #188 spec รอบ 12, #189 PAY-3b1 (PAY-3b แยกเป็น 3b1/3b2 โดย session หลัก 2026-10-28)
**owner ตัดสิน 2026-10-27 (รอบ 6)**: admin UI ของ affiliate แบบเขียนได้**อยู่ใน v1** → AF-12a/12b/12c (spec 05 กฎ 37) · **รอบ 11 (2026-10-27)**: ADR-017 accepted A, spec 05 Q16 (ก) คงเดิม,
Q17 → AF-14, Q18 = 3 ช่อง, spec 03 Q6 → CORE-10b · รอบ 5: ADR-016 accepted A, EV Q10 = (ก), Q-O3 ตามข้อเสนอ, AF Q15 ⏸, EV Q11 คงเดิม · **owner 2026-10-28**: ADR-018 accepted + spec 08 Q1–Q6
**owner ตอบคำถามรอบ 12 (2026-10-28)**: spec 04 Q13 = (ก) manual + alert + runbook + GB-10, Q14 = (ก) ใช้ `order-placed`, spec 05 Q19 = (ข) ให้ค่าคอม affiliate กับ order กลุ่ม → AF-16,
Q20 = (ข) เลขบัญชี 10–12 หลัก → รวมใน AF-15 · ไม่มีคำถามค้าง
**รอบ 13 (2026-11-03 — owner สั่งเปิด task จาก follow-up)**: merge แล้วหลังรอบ 12: #186 ADM-1, #187 AF-14, #188 spec รอบ 12, #189 PAY-3b1, #190 FS-16, #191–#193 เอกสาร OPS-4, #194 OPS-18, #195 EV-14, #197 AF-16, #198 (spec OPS-20a/20b + REPORT OPS-18);
เปิดอยู่ (◐): #196 GB-9, #199 CORE-25, #200 CORE-9b, #201 EV-N2, #202 CORE-10c, #203 PAY-3b2, #204 OPS-20a, #205 ADM-2a;
task ใหม่/ขยาย: CORE-26 (**ยอดรวม dropdown ตะกร้าไม่ตรงส่วนลด — ควรทำก่อน**), CORE-9c, EV-N3, FS-19, AF-17, OPS-17a; ขยาย GB-10 (แยก GB-10b ได้ถ้าเกิน ~400 LOC), OPS-17, FS-18, ADM-5, ADM-8a ·
**owner ตอบคำถามรอบ 13 (2026-11-03) ตามข้อเสนอทั้งหมด**: spec 01 Q-C1 (1) = (ก) `item_total` ป้าย "ยอดรวมสินค้า (รวม VAT)", (2) = (ก) คงเปิดเองแต่ปิดเองใน 5 วินาที → CORE-26;
Q-C2 = (ก) helper กลาง `{ ok } | { error }` → CORE-4i · ไม่มีคำถามค้าง
**รอบ 14 (2026-11-03 — owner สั่ง)**: กันกดเพิ่มตะกร้าซ้ำบน PDP (qa/review #211) → CORE-27 (spec 01 กฎข้อ 83, AC-119; ← FS-19 #211) ·
spec 01 (owner อนุมัติ, qa #222 D-1): JWT หายบนหน้า `/cart` แล้ว server action เห็นตะกร้าว่างแทน `SIGN_IN_AGAIN_MESSAGE` → CORE-14g (กฎข้อ 84, AC-120; ← CORE-4i-a #222) ·
spec 04 (builder GB-7 พบ route สาธารณะที่ spec ระบุแต่ไม่มี task): GB-11 (backend, กฎข้อ 28, AC-45..46) + แยก GB-7 → GB-7a1 (← GB-11) → GB-7a2 ∥ GB-7c / GB-7b (◐ #223) ·
**owner ตอบ spec 04 Q15–Q19 (2026-11-03)**: Q15 แสดงทุกแคมเปญบนหน้าแรก (→ GB-7c), Q16 join ด้วย cart ใหม่เฉพาะสินค้าที่เลือก (กฎข้อ 14c แทนที่),
Q17 = (ก) (กฎข้อ 29f ปรับถ้อยคำตาม Q16), Q18 = (ก), Q19 (review #224) เลือกที่อยู่ + วิธีส่งบนหน้ากลุ่มก่อน join (→ GB-7a2) · ไม่มีคำถามค้าง
**รอบ 15 (2026-11-03 — owner ตัดสิน: group buy 1 แคมเปญ = 1 สินค้า)**: หน้ากลุ่ม = ตะกร้าเฉพาะสินค้านั้น เลือกหลาย variant + จำนวน → spec 04 กฎข้อ 30–31, AC-49..50,
GB-6e (admin picker สินค้าเดียว + backend validation) ∥ GB-11 (`product_id`) ∥ GB-7a2a (error map) → GB-7a1 → GB-7a2 (หลาย variant) ∥ GB-7c (การ์ดสินค้าเดียว) ·
**owner ตอบ spec 04 Q20 (2026-11-03) = ตามค่าตั้งต้นทั้งหมด**: ไม่จำรายการข้ามหน้า, หลัง join แก้ไม่ได้ (leave แล้ว join ใหม่), `max_units_per_person` รวมทุก variant, คงเป้า orders/units/people (กฎข้อ 31d) · ไม่มีคำถามค้าง
**รอบ 16 (2026-11-04 — owner อนุมัติเปิด task จาก follow-up ของ review/qa 2026-11-04)**: spec 01 CORE-28 (`promotion-error` เมื่อช่องโค้ดปิด) · CORE-29 (กู้ตะกร้าหลัง login ใหม่ ← **ADR-019 proposed**) ·
CORE-30 (กลับหน้าเดิมหลัง login) · CORE-31 (ปุ่มคัดลอกกลาง) · CORE-32 (ซ่อน Digital delivery ของสินค้าที่ต้องจัดส่ง) · spec 04 GB-12 (UI group buy) · GB-13 (idempotency สร้างแคมเปญ ← Q21) · GB-N4 (test hygiene) ·
spec 07 OPS-17b (redact JWT ใน log ของ load test) · **คำถามค้างสำหรับ owner**: spec 01 Q-C3 (= อนุมัติ ADR-019), Q-C4 (บังคับ backend เรื่อง shipping profile ไหม),
spec 04 Q21 (ขัด Q10 เดิม — ทำ `POST /admin/group-buy/campaigns` ให้ idempotent ไหม)
**รอบ 16b (2026-11-04 — owner ตัดสิน)**: spec 01 Q-C3 = B (**ADR-019 accepted**; CORE-29 ← CORE-30 เท่านั้น) · Q-C4 = (ข) → **GB-14** (spec 04 กฎข้อ 35, AC-54: ตรวจ shipping profile ตอน join
+ code `GB_SHIPPING_PROFILE_NOT_COVERED`; ∥ CORE-32) · spec 04 Q21 = (ก) (GB-13 ← GB-N4) · CORE-28b (comment e2e core-14g หลัง CORE-28 #241; กฎข้อ 90, AC-126) · nit review #240 (spec 07 AC-34 `run.sh:132`,
spec 01 กฎข้อ 86e/87) · merge แล้วตั้งแต่รอบ 16: #220 OPS-17a, #221 CORE-27, #223 GB-7b, #230 GB-11, #231 GB-6e, #234 CORE-14g, #235 OPS-17, #236 GB-7a1, #237 AF-N3, #238 GB-7a2, #239 GB-7c, #240 spec รอบ 16 ·
**รอบ 17 กำลังทำ (◐)**: CORE-28 (#241), CORE-32, GB-12, OPS-17b · **คำถามค้างสำหรับ owner**: spec 04 Q22 (join ที่ไม่มีวิธีส่งเลยต้องถูกปฏิเสธด้วยไหม — แนะนำ (ก) ไม่ปฏิเสธใน v1)

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
| CORE-4f ∥ CORE-14f | (รอบ 10) error login/register เป็นไทย + คงอีเมลเมื่อล้ม (AC-98) ∥ ข้อความการ์ด `add-variant-pending` + `countryCode` ปลอมไม่ 5xx (AC-101) | ☑ #144 ∥ ☑ #150 |
| CORE-4h | (รอบ 11, review/qa #144) `reason` ของ login, ฟอร์มสมัครคงค่า, กันกดซ้ำ login/register, error ไทยหน้า verify-account (AC-105) | ☑ #162 |
| CORE-4g | (รอบ 10, review/qa #131) `medusaError` คง status, `promotion-error` เมื่อโค้ดใช้ไม่ได้, `compareAddresses`, ความสูง `CountrySelect` (AC-99) | ☑ #170 |
| CORE-4i | (รอบ 12) server action ของ `lib/data/cart.ts` คืนผลแบบมีโครงสร้าง + helper กลาง + `SIGN_IN_AGAIN_MESSAGE` เดียว (AC-110) | ☐ (← PAY-3b2 #203; Q-C2 = ก — contract error ของ action สร้าง session, review #188; PAY-3b1 ☑ #189) |
| CORE-4j | (รอบ 12, #170) trim โค้ดส่วนลด, ฟอร์มที่อยู่ไม่หายเมื่อใส่โค้ด, ความสูง billing select (AC-111) | ☐ (← CORE-4i) |
| CORE-22 | (qa #92, defect starter) title หน้า account, เบอร์ว่างไม่แสดง `null`, panel แก้ไขที่ปิดไม่รับ click (AC-82..84) | ☑ #99 |
| CORE-23 | (qa #99, defect starter รอบ 8) ลบเบอร์โทรได้, editor อีเมลออก, order ไม่พบตอบ 404, error token หมดเป็นไทย, จัดแนว "ยังไม่ได้ระบุ" (AC-85..89) | ☑ #105 |
| CORE-23b | (รอบ 9, qa/review #105) progress ตอนเปลี่ยนหน้า account, ฟอร์มไม่ล้างค่าเมื่อบันทึกล้ม, e2e AC-88 (AC-97) | ☑ #154 |
| CORE-23c | (รอบ 12, #154/#150/#164) ฟอร์มที่อยู่ใน account คงค่าเมื่อล้ม, ที่อยู่ใบเสร็จไม่ล่มทั้งหน้า, พิมพ์หลังกดแก้ไข, ลิงก์ `/contact` (AC-112) | ☐ **เริ่มได้** |
| CORE-5 | Playwright + convention การเก็บ evidence | ☑ #7 |
| CORE-5c | (รอบ 10, e2e tooling) evidence เขียนเฉพาะโฟลเดอร์ของ `evidenceTarget`, `step()` อยู่ในงบ (AC-103) | ☑ #169 |
| CORE-5d | (รอบ 12, #169/#173) ชื่อ evidence ใน spec ตรงไฟล์ที่ commit — รัน e2e ทั้งชุดด้วย `E2E_SAVE_EVIDENCE=1` ไม่ล้ม (AC-115) | ☐ **เริ่มได้** |
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
| CORE-10b | (รอบ 11, owner Q6 spec 03) seed collection ตัวอย่างให้หน้าแรกของ dev มี rail สินค้า (spec 01 กฎข้อ 70, AC-106) | ☑ #159 |
| CORE-10c | (รอบ 12, review #159) AC-72 ที่ CORE-10 ยังไม่ได้ทำจริง: category ไทย + handle คงที่, ซ่อม `featured` ที่ว่าง (AC-109) | ◐ #202 |
| CORE-9b | (รอบ 12, builder FS-17) search ingestion ไม่ throw กับ `product-option.deleted` (AC-108) | ◐ #200 |
| CORE-9c | (รอบ 13, review #200) test `search-option-deleted` poll + timeout แทน `sleep`, logger จาก container + positive control (AC-118) | ☐ (← CORE-9b #200) |
| CORE-11 | อีเมล shipped เฉพาะ item ใน fulfillment / `no_notification` | ☑ #64 |
| CORE-12b | **ความปลอดภัย** ownership ของ `cart_id` ใน query products/variants | ☑ #78 |
| CORE-14a | storefront `/buy` บังคับล็อกอิน, ปิด UCP/`cart/resume`, cookie cart ค้าง, ลบหน้า order transfer (AC-41..43, 56) | ☑ #81 |
| CORE-14b ∥ CORE-14c | no-JS login + error `add_variant` (AC-44, 45) ∥ login ไม่ล้มเมื่อ `transferCart()` ได้ 404 (AC-76) + e2e redirect แรกของ `/buy` (303), `/ucp` (307/308) | ☑ #113 ∥ ☑ #117 |
| CORE-14d ∥ CORE-24 | `/cart` ไม่ค้าง skeleton หลัง login no-JS, `add_error` + `unstable_rethrow`, `add_variant` ตอนล็อกอินแล้ว = การ์ดยืนยัน (กฎ 58, #132) (AC-92, 93 — รอบ 10: AC-93 (c) ทดสอบ no-JS ครั้งเดียวพอ) ∥ ตัวเลือกจำนวนบน PDP (AC-94) | ☑ #128 ∥ ☑ #134 |
| CORE-14e | ⏸ หลัง v1.0 (owner Q-F7 2026-10-27): nonce กันฟอร์ม no-JS ส่งซ้ำ (qty สองเท่า — owner ตัดสิน; cart ค้าง 2 ใบ จาก qa #128 O-2 — planner รวมเข้า) — ไม่มี AC | ⏸ |
| CORE-15 | หน้า `/store` หยุดยิงซ้ำเมื่อ search error + ป้ายราคา ฿ (AC-69) | ☑ #177 |
| CORE-15b | (รอบ 12, review #177) error ของ search drawer ที่ header ไม่เป็น `pageerror` + pin `instantsearch.js` (AC-114) | ☐ **เริ่มได้** |
| CORE-19a ∥ CORE-19b | ตัวนับ cart + search drawer 375px ∥ ปุ่ม "Continue to review" ไม่ค้าง | ☑ #118 ∥ ☑ #151 |
| CORE-19c | (รอบ 10, qa #118) `DeleteButton` ส่งต่อ `data-testid` + error เมื่อลบล้ม (AC-100 — ถ้อยคำแก้รอบ 11: mock request ของ server action) | ☑ #142 |
| CORE-19d | (รอบ 11, review/qa #142) `deleteLineItem` คืนผลแบบมีโครงสร้าง แยก 401 ใน prod (AC-104) | ☑ #160 |
| CORE-19e | (รอบ 11, review #151) ปุ่ม Continue ที่ CORE-19b ล็อกรอ session ไม่ค้างเมื่อ RSC refresh ไม่มา: `router.refresh()` 5s, ปลดล็อก + error ไทย 10s (AC-107) | ☑ #166 |
| CORE-19f | (รอบ 12, qa #166/#151) revalidate cart หลังสร้าง session, Continue หลัง timeout ไม่ข้าม session, e2e สลับวิธีชำระ (AC-113) | ☐ (← CORE-4i) |
| CORE-25 | (รอบ 12, **defect qa #178 — ลูกค้าอาจได้ไซซ์ผิด**) option บน PDP ไม่ถูกรีเซ็ตจาก `v_id` + ปิด flaky `core-19a:183` + แถบมือถือ (AC-116) | ◐ #199 |
| CORE-26 | (รอบ 13, **qa #199 — ยอดรวมใน dropdown ตะกร้าเป็นยอดก่อนส่วนลด ลูกค้าสับสนราคา**) ยอดรวมจาก field ของ Medusa ที่ตรงส่วนลด, แถว `cart-totals` รวมได้ยอดสุทธิ, dropdown ที่เปิดเองไม่ค้างทับ PDP, unit PDP เปลี่ยน `product.id`, comment "Shirts" (AC-117) | ☐ **ควรทำก่อน** (← CORE-25 #199; CORE-10c #202 ไม่บล็อก — แค่ส่วน comment ต้อง rebase; Q-C1 = ก/ก) |
| CORE-27 | (รอบ 14, qa/review #211) ปุ่มเพิ่มลงตะกร้าทั้งสองจุดของ PDP กันคลิกซ้อนใน tick เดียวด้วย `useRef` in-flight + `mobile-cart-button` disable ครบแบบปุ่มหลัก (AC-119) | ☑ #221 |
| CORE-14g | (รอบ 14b, qa #222 D-1) `clearStaleCartCookie` ไม่ล้าง `_medusa_cart_id` ใน request ของ server action (`next-action`) → แก้จำนวน/โค้ด/ลบสินค้าตอน JWT หายแสดง `SIGN_IN_AGAIN_MESSAGE` แถวสินค้ายังอยู่; GET ถัดไปยังล้างตาม AC-43 (AC-120) | ☑ #234 |
| CORE-28 | (รอบ 16, qa #222 O-2) `promotion-error` render นอก `isOpen` — error ของการใส่/ลบโค้ดเห็นได้แม้ช่องปิด + แก้ comment ค้างใน e2e core-19c (AC-121) | ◐ #241 (รอบ 17) |
| CORE-28b | (รอบ 16b, test-only) แก้ comment ค้างใน `e2e/core-14g-action-stale-jwt.spec.ts` ~125 ที่ไม่จริงหลัง CORE-28 (กฎข้อ 90, AC-126) | ☐ (← CORE-28 #241) |
| CORE-29 | (รอบ 16, รอบ 14b) กู้ตะกร้าหลัง login ใหม่: จำ id ตะกร้าหลักใน `customer.metadata` แล้วกู้เมื่อไม่มี cookie cart (AC-122; ADR-019 accepted owner 2026-11-04) | ☐ (← CORE-30; #234 ☑) |
| CORE-30 | (รอบ 16, qa #239/#238) ไม่ login กด join/สร้างทีม → login แล้วกลับ `/<cc>/g/<token>` หรือ `/<cc>` (allow-list ของ `return_to`) (AC-123) | ☐ **เริ่มได้** |
| CORE-31 | (รอบ 16) ปุ่มคัดลอกกลางใช้ร่วม `ShareLinkButton` + `VoucherCopyButton` (AC-124) | ☐ **เริ่มได้** |
| CORE-32 | (รอบ 16, qa #238) กรอง option วิธีส่งตาม shipping profile ที่ checkout และหน้ากลุ่ม — ไม่แสดง Digital delivery ให้สินค้าที่ต้องจัดส่ง (AC-125) | ◐ (รอบ 17; ∥ GB-14 ด่าน backend ของ Q-C4 = ข) |
| CORE-20 | หน้าขอคืนสินค้าจาก order detail | ☑ #112 |
| CORE-20b ∥ CORE-20c | backend บังคับช่วงคืน N วัน + กัน line ไม่ต้องจัดส่ง (AC-95) ∥ storefront: window จาก region ของ order, `shipped_quantity`, ไม่ `force-cache` (AC-96) | ☑ #124 ∥ ☑ #130 |
| CORE-20d | (รอบ 10) ค่าเริ่มต้น window ตรง backend ทุกหน้า, window ต่อ line, map error code + contract test, `GET /store/regions/:id` (AC-102) | ☑ #168 |
| CORE-21 | return option: stock location ต้องอยู่ใน sales channel ของ order + test order ไม่มี `country_code` + error ไม่สะท้อน `option_id` | ☑ #86 |

## M2 การชำระเงิน
| Task | งาน | สถานะ |
|------|-----|--------|
| PAY-1 | Stripe provider + webhooks | ☑ #13 |
| PAY-2 | UI checkout บัตร + PromptPay + e2e | ☑ #48 |
| PAY-3 | **แยกรอบ 10** (builder หยุด: Store API อ่าน draft order ไม่ได้) → PAY-3a + GB-8 + PAY-3b | — |
| PAY-3a | (backend test-only) ownership ของ session route บน collection ของ draft order + guard × webhook บน collection ของ order (AC-18) | ☑ #157 |
| PAY-3b1 | หน้า `/account/orders/:id/pay` อ่านจาก GB-8 + บัตร + 409/non-2xx → ตรวจสถานะ GB-8 + poll มีเพดาน (กฎข้อ 9 d/d2 จาก #184) + e2e (AC-19) | ☑ #189 |
| PAY-3b2 | พร้อมเพย์บนหน้า pay (AC-7) + แยก `open-qr.ts` ใช้ร่วม checkout, allow-list ใน static test AF-3c กฎ 31 (หน้า order ไม่มี cart) + กลับจาก redirect ของ Stripe (AC-20) | ◐ #203 |
| PAY-4 | Refund e2e (refund บางส่วน → `partially_refunded` + credit line) | ☑ #94 |
| PAY-5 | race QR หมดอายุ × จ่ายสำเร็จ — ยืนยันกรณี (b) + ADR-015 | ☑ #65 |
| PAY-6a | ADR-015 A ฝั่ง backend: guard + 409 `PAYMENT_ALREADY_COMPLETED` | ☑ #82 |
| PAY-6b | storefront poll + complete cart ทางสำรอง (6b1) ∥ alert + runbook + script `refund-orphan-payment.ts` (6b2) | ☑ #98 ∥ ☑ #97 |
| PAY-6c | เพดานการลองซ้ำ 10 ครั้ง + UI เงินถูกคืนแล้ว (spec 06 กฎข้อ 8, AC-17) — ควรก่อน release ที่เปิดพร้อมเพย์จริง | ☑ #136 |
**Release v0.2.0** — ชำระเงินจริงใน test mode; checklist go-live สำหรับ live keys

## M3 E-voucher — **v0.3.0**
EV-1 ☑ #15 · EV-2 ☑ #25 · EV-3 ☑ #31 · EV-4 ☑ #67 · EV-5 ☑ #43 · EV-5b ☑ #111 · EV-6 ☑ #39 · EV-8 ☑ #54 · EV-10 ☑ #85 · EV-11 ☑ #88 · EV-12 ☑ #123 ·
EV-7 **แตกรอบ 10** → EV-7a ☑ #155 → EV-7b ☑ #179 ∥ EV-7c ☑ #174 · EV-9 ☑ #139 · EV-13 ☑ #167 · EV-5c ☑ #171 · EV-N1 ☑ #149 ·
(รอบ 12) **EV-14 ☑ #195** (`terms_url`/`logo_url` รับเฉพาะ http(s); AC-40; รอบ 13: ฟอร์ม admin ตรวจฝั่ง client → ADM-5) ∥ EV-N2 ◐ #201 (lock owner/TTL ของ allocation + nit EV-7a; AC-41) →
(รอบ 13) EV-N3 ☐ (← #201: ข้อความ resend ไม่มีจุดซ้อนที่ต้นเหตุ backend + test รูปแบบ `ownerId`; AC-44) ∥
EV-7e ☐ เริ่มได้ (vouchers แบ่งหน้า, `support_contact`, บล็อก partner บน PDP; AC-43) · EV-7d ☐ (← CORE-4i ← PAY-3b2 #203: cart-totals digital-only, redirect ผ่าน `safeCountryCode`; AC-42 — ชน `cart-totals` กับ CORE-26)

## M4 Flash sale — **v0.4.0**
PROMO-1 ☑ #21 (+ #24) · FS-1 ☑ #14 (+ hotfix #22) · FS-3 ☑ #28 · FS-2 ☑ #37 · FS-4 ☑ #32 · FS-5 ☑ #38 · FS-7 ☑ #53 · PROMO-2 ☑ #50 ·
FS-10 ☑ #74 · FS-6 ☑ #115 · FS-8 ☑ #69 · FS-11 ☑ #83 · FS-13 ☑ #129 ·
FS-12 ✕ (รอบ 10: ปิด — QA #115 พิสูจน์ preview = cart ทั้ง 5 แบบ target rule) · FS-9 ✕ (owner ตัดสินไม่ทำ 2026-10-27) ·
FS-14 ☑ #148 (☑ เต็ม — FS-17 ☑) → FS-17 ☑ #164 ∥ FS-15 ☑ #178 →
FS-16 ☑ #190 (ปุ่มรอข้อมูล flash, `product-price` ขีดฆ่า, ป้าย sold out บนการ์ด; AC-23) → (รอบ 13) FS-19 ☐ (← CORE-25 #199: `mobile-cart-button` รอ `flash.loading`, แถบมือถือไม่จางทับปุ่มหลัก; AC-26) ∥
FS-18 ☐ **เริ่มได้** (รอบ 12: `revalidate` ให้ fetch ที่เหลือใน `lib/data`, e2e ลบข้อมูลครบ (รอบ 13: + `flash-sale-fs16.spec.ts`), `/store` ไม่ยิงข้อมูล flash ชุดเก่า; AC-25)
(FS-2 คืนโควตาเมื่อ cancel หรือ refund เต็มจำนวน ไม่ว่ามาจาก return — owner 2026-10-25)

## M5 Group buying — **v0.5.0**
GB-1 ☑ #17 · ADR-011 ☑ #33 · GB-2a ☑ #42 → GB-2b ☑ #49 → GB-2c ☑ #58 ·
GB-3 ☑ #68 → (GB-3b ☑ #95 ∥ GB-3c ☑ #100 ∥ GB-4 ☑ #89) →
(รอบ 10) PAY-3a ☑ #157 ∥ GB-8 ☑ #145 →
GB-5 ☑ #185 (+ ops alert/runbook เงินค้าง) ∥ PAY-3b1 ☑ #189 → PAY-3b2 ☑ #203 → GB-7 (รอบ 14 แยก: **GB-7b ☑ #223** หน้า account จาก GB-8 + ออกจากกลุ่ม + ลิงก์ชำระเงิน; AC-2 e2e, AC-16b ∥
**GB-11 ☑ #230** route สาธารณะ `GET /store/group-buy/campaigns/active` + `GET /store/group-buy/groups/:token` ไม่คืน PII; AC-45..46 → **GB-7a1 ☑ #236** หน้ากลุ่ม `/<cc>/g/<token>` อ่านอย่างเดียว; AC-16a →
(**GB-7a2 ☑ #238** เลือกที่อยู่ + วิธีส่ง (Q19) + join ด้วย cart ใหม่ (ไม่แตะ cart ปัจจุบัน), sync `aff`, ข้อความ error ต่อ code; AC-28, AC-47 ∥
**GB-7c ☑ #239** แคมเปญ flash + group buy บนหน้าแรก + สร้างทีม; rebase กับ #216 FS-18; AC-48)) ;
(รอบ 15 — 1 แคมเปญ = 1 สินค้า) **GB-6e ☑ #231** (picker สินค้าเดียว + validation + แก้ seed-load/e2e/unit เดิมที่ใช้หลายสินค้า/variant scope (review #227); AC-49..50; ชน `product-picker.tsx` กับ ADM-7) ∥ **GB-7a2a ☑ #229** (error map — `lib/util/group-join-error.ts` อยู่ใน develop `b20c1e1`; เลข PR จาก evidence "review #229") →
GB-7a2 ใช้หลาย variant (← GB-7a1, GB-7a2a, GB-6e); GB-7c การ์ดแสดงสินค้าเดียว; Q20 ตัดสินแล้ว (owner 2026-11-03, กฎข้อ 31d) ;
(รอบ 12) GB-9 ◐ #196 (alert เงินค้างอ่านสถานะใหม่ + runbook ตรวจ draft ก่อน refund; AC-43) → GB-10 ☐ (← #196 — รอบ 13 รวม follow-up ของ #196 (เกิน ~400 LOC → แยก GB-10b): subscriber fail-open, `loadMembership` ที่เดียว,
test `membership_joined`, ขอบหัวข้อ runbook; membership `paid` เมื่อ ops แปลง draft เอง + noop ใต้ lock ในเส้นทางปกติ; AC-44) — ควรก่อน release v0.5.0;
owner Q13 = (ก) manual, Q14 = (ก) `order-placed` (2026-10-28) ;
GB-6a ☑ #75 → (GB-6b1 ☑ #87 ∥ GB-6b2 ☑ #96) → GB-6c1 ☑ #114 → GB-6c2 ☑ #121 → GB-6d ☑ #143 → GB-N3 ☑ #161 ;
GB-N1 ☑ #106 · GB-N2 ☑ #126 (nit `trackSubscribers` คัดลอก `subscriberId` ถ้ายังไม่แก้ใน #126 → แก้ใน PR ถัดไปที่แตะ `group-buy-join.spec.ts`) · Q11 owner ยืนยัน (ก) ยอมรับ lock TTL 60s ใน v1 — ไม่มี task
(รอบ 16) **GB-12 ◐ (รอบ 17)** (countdown กลาง, ชื่อสินค้า/ราคาใน `group-selection`, fixed "ต่อชิ้น", กล่องยืนยันออกจากกลุ่ม 375px + empty state เดียว; AC-51 — ควรก่อน v0.5.0) ∥
**GB-N4 ☐ เริ่มได้** (test hygiene; AC-53; ต้อง merge ก่อน GB-13) → GB-13 ☐ (Q21 = ก owner 2026-11-04: `idempotency_key` ของการสร้างแคมเปญ; AC-52) ∥
(รอบ 16b) **GB-14 ☐ เริ่มได้** (Q-C4 = ข: ตรวจ shipping profile ตอน join → 400 `GB_SHIPPING_PROFILE_NOT_COVERED` + ข้อความไทยใน `group-join-error.ts`; AC-54; ∥ CORE-32 ไม่มีไฟล์ชน — ควรก่อน v0.5.0;
Q22 ค้าง: cart ไม่มีวิธีส่งเลย) · CORE-30, CORE-32 (spec 01) ควรก่อน v0.5.0

## M6 Affiliate — **v0.6.0**
AF-1 ☑ #11 · AF-2 ☑ #66 · AF-5 ☑ #35 → AF-3 ☑ #77 → (AF-3b ☑ #119 ∥ AF-4 ☑ #90 ∥ AF-4b ☑ #91 ∥ AF-7 ☑ #110) → AF-7b ☑ #122 →
AF-N2 ☑ #146 (nit #125/#122; AC-38) · AF-8 แตกรอบ 11: AF-8a ☑ #135 → AF-13 ☑ #158 → AF-8b ☑ #173 → AF-8c ☑ #182 ;
AF-5 → AF-9 ☑ #79 → (AF-6 ☑ #138 ∥ AF-9b ☑ #107 → AF-N1 ☑ #137) → **admin UI แบบเขียนได้ (owner 2026-10-27)**: AF-12a ☑ #163 ∥ AF-12b ☑ #165 ∥ AF-12c ☑ #176 ;
AF-10 ☑ #125 · AF-3c ☑ #153 · AF-11 ⏸ หลัง v1.0 (owner Q15 2026-10-27) · AF-14 ☑ #187 (AC-45; รอบ 13: nit ของ #187 → ADM-8a) ·
(รอบ 12) AF-15 ☐ **เริ่มได้** (← AF-14 ☑: `payout_info` 3 ช่องแบบ strict + เลขบัญชี 10–12 หลัก (Q20), `expected_status` กันกด approve จากหน้าเก่า, prompt ของ Clear; AC-46; เกิน ~400 LOC แยก backend/UI) ∥
AF-N3 ☑ #237 (portal: สกุลเงิน, หน้าเกิน, `−`, static test AST; AC-47) ∥ **AF-16 ☑ #197** (owner Q19 = ข: ค่าคอม affiliate ของ order group buy — token บน draft order, attribution ตอนแปลง; AC-48 ☑) →
(รอบ 13) AF-17 ☐ **เริ่มได้** (← AF-16 ☑ #197: token ว่างใน cart fallback ไป `order.metadata`; AC-49) ·
release v0.6.0 ต้องมี AF-14 (ที่เหลือ ☑ แล้ว; AF-15, AF-16 ควรมี) · owner รอบ 11: Q16 คง `variant_ids` ผ่าน API, Q18 `payout_info` 3 ช่อง

## M7 Scale และ hardening — **v1.0.0** 🎯
OPS-2 ☑ #27 · OPS-6 ☑ #47 · OPS-3 ☑ #120 (JSON logs + alert `Error running event bus worker`, AC-18) · OPS-3b ⏸ rate limiting · OPS-3c ⏸ Sentry (owner Q-O1/Q-O2 2026-10-27: เลื่อนหลัง v1.0) ·
OPS-7 ☑ #108 · OPS-8 ☑ #101 · OPS-13 ☑ #127 · OPS-9 ☑ #72 · OPS-11 ☑ #87 (รวมใน GB-6b1) ·
OPS-14 ☑ #133 · OPS-10 ☑ #141 → OPS-15 ☑ #156 → OPS-12 ☑ #172 → OPS-16 ☑ #180 → (รอบ 13) **OPS-17a ☑ #220 — ความปลอดภัย** (← OPS-20a #204: artifact k6 ไม่มี `setup_data`/JWT ของลูกค้า load test + ขั้นตรวจใน `run.sh`; AC-33) →
(รอบ 12) OPS-17 ☑ #235 (← OPS-17a; `prod-guards` อ่าน YAML ด้วย parser, `IMAGE_TAG` ของ load test, ตัด cast; รอบ 13: `hold_rank_corr` O(n); AC-28) ·
OPS-13b ☑ #147 · OPS-4 ☑ #175 (load-nightly run 40590093846 success — `docs/evidence/scale/OPS-4/REPORT.md` ☑ #191; **owner 2026-11-03: AC-2 ☑** — nightly บน runner เป็น gate ความถูกต้อง ยอมรับอัตรา burst ที่ runner ทำได้, **AC-3 ☑**) →
OPS-18 ☑ #194 (run 41617065775: lock ไม่ใช่สาเหตุ, ≥ 95% ของ checkout อยู่นอก lock; AC-29 ☑) →
OPS-20a ◐ #204 (owner 2026-11-03 — ปิด burst ได้ผ่าน dispatch input + แตกเวลาก่อน/ใน/หลัง hook, สรุป burst vs workflow; AC-31) → OPS-17a → OPS-17 → OPS-20b ☐ (ตัวชี้วัดความอิ่มตัว; AC-32)
— ลำดับ `tools/load/*` (รอบ 13): OPS-20a → OPS-17a → OPS-17 → OPS-20b (ชน `run.sh`) · OPS-19 ⏸ (staging load test 500 rps × 60s + p95 < 300ms gate; AC-30 — ต้องมี ADR staging ก่อน) ·
OPS-5 ☐ (ท้ายสุด)
(รอบ 16) **OPS-17b ◐ (รอบ 17) — ความปลอดภัย** (scan secret ก่อนพิมพ์ลง job log + redact JWT ใน console ของ k6 + `run.sh:132` `k6-failures.txt` ผ่าน redact (nit review #240); AC-34) → OPS-20b (ชน `run.sh`)

hotfix/chore: #46 (test FS-4 × CORE-6), #52 (jest integration heap OOM), #59 (ลด CI ซ้ำซ้อน — ตัด push ไป develop)

## Admin UI ใช้ component ของ Medusa (ADR-018 accepted, spec 08) — ไม่บล็อก release ใด
owner 2026-10-28: ให้ admin ใช้ component/hook/utility ของ Medusa เป็นฐาน (`@medusajs/dashboard/{components,hooks,lib}` ตั้งแต่ v2.21.0 → `@medusajs/ui` → custom guide → สร้างเอง)
owner ตัดสิน spec 08 Q1–Q6 (2026-10-28): ทำครบ ADM-1..9, bump `@medusajs/ui` 4.2.8, ปุ่มต่อแถวใช้ `ActionMenu`, วันเวลาใช้ `DatePicker`/`useDate` ตาม timezone เครื่อง (เลิก `lib/ict.ts` ใน admin),
เงินใช้ `getLocaleAmount`, ฟอร์มแบบ state, pagination ใน URL — ADR-018/spec 08 ☑ #183
| Task | งาน | สถานะ |
|------|-----|--------|
| ADM-1 | dependency ตรงกับ dashboard (`@medusajs/ui` 4.2.8, `react-hook-form`, `@hookform/resolvers`, `@medusajs/icons`) + jest โหลด `@medusajs/dashboard/lib` ได้ + `icon` ของ route (AC-1, 2) | ☑ #186 |
| ADM-2a | Header/Container (guide) + Header/`SectionRow` ใน 3 widget + เพิ่มข้อตรวจใน `medusa-ui.unit.spec.ts` เดิม (AC-5; รอบ 12 + nit EV-13 #167) | ◐ #205 |
| ADM-2b | `createSingleFlight` แทน `useRef`, วันที่ผ่าน `useDate` (locale จากภาษาของ admin — แก้รอบ 12), Playwright admin `locale`/`timezoneId` (AC-3, AC-4) | ☐ (← ADM-2a) |
| ADM-3 ∥ ADM-4 ∥ ADM-6 | pilot ฟอร์ม widget (`Form` + zod, AC-6) ∥ หน้า e-voucher (`LayoutComposer`, `DataTable` dashboard, `ActionMenu` Reveal, AC-7) ∥ หน้า group buy (AC-9; ← GB-N3 ถ้ายังเปิดอยู่) | ☐ ∥ ☐ ∥ ☐ (← ADM-2b) |
| ADM-5 ∥ ADM-7 | partners ตาราง + ฟอร์ม + `ActionMenu` (AC-8; รอบ 13: + ตรวจ URL http(s) ของ partner ฝั่งฟอร์ม — follow-up EV-14 #195) ∥ ฟอร์มสร้างแคมเปญ + `DatePicker` + `useProducts` (AC-10) | ☐ ∥ ☐ (← ADM-3) |
| ADM-8a | affiliate ตาราง (`DataTable` dashboard, `getLocaleAmount`, `useDate`, icon + ลบ `affiliate` จาก `ICON_PENDING`; AC-2, AC-11; รอบ 13: + nit AF-14 #187 — assertion `safeParse`, cast `as unknown as`, `keepPreviousData` ของ query ชื่อ) | ☐ (← ADM-2b, #176 ☑, AF-14 ☑ #187, **AF-15**) |
| ADM-8b | affiliate ปุ่มต่อแถวเป็น `ActionMenu` + แก้ locator e2e + (รอบ 12) Cancel/Mark paid ของแถวเดียวกันกันกัน (AC-13) | ☐ (← ADM-8a) |
| ADM-9 | affiliate ฟอร์ม (`Form`, `DatePicker`, `Combobox` scope, ฟอร์มของ AF-12c; รอบ 12: ส่งวันที่เฉพาะที่แก้, scope ว่าง → error, ตัวเลือก affiliate ค้นหาได้; AC-12) | ☐ (← ADM-3, ADM-7, ADM-8b) |

## Backlog หลัง v1.0 (owner ตัดสินเลื่อน — ไม่มี AC จนกว่าจะกลับมาทำ)
- **CORE-14e** nonce กันฟอร์ม no-JS ส่งซ้ำ (owner Q-F7 2026-10-27 — กรณี qty สองเท่า; กรณี cart ค้าง 2 ใบ planner รวมเข้า) — spec 01 Open questions รอบ 9
- **OPS-3b** rate limiting (owner Q-O1 2026-10-27) — spec 07 AC-22, ข้อเสนอเดิมใน Q-O1
- **OPS-3c** error tracking Sentry (owner Q-O2 2026-10-27) — spec 07 AC-23, ข้อเสนอเดิมใน Q-O2
- **AF-11** reconcile entry ที่ approve แล้วของ order ที่ยกเลิกแต่ไม่มี reversal (owner Q15 2026-10-27) · dedupe `/affiliate/products` ใน SQL เมื่อแคตตาล็อกใหญ่ (planner, review #122) ·
  entry `pending` ยอดสุทธิ 0 ของ order ที่ยกเลิกค้างและถูกสแกนทุกวัน (planner รอบ 11, review #146)
- **OPS-19** staging load test: burst 500 rps × 60s จริง + p95 < 300ms เป็น gate (owner 2026-11-03, ย้ายจาก AC-2 ของ OPS-4) — spec 07 AC-30; ต้องมี ADR staging ก่อน (infra ใหม่)
- **FS-9** ใส่ exclusivity rule ให้ automatic promotion ใหม่อัตโนมัติ (owner 2026-10-27: ไม่ทำใน v1 — admin กด Save ใน widget ของ FS-5 เอง) — spec 03 AC-15 (ยกเลิก)

- **resolve-product-ids แบ่งหน้า** `query.graph` ของ option กลางที่ผูกหลายสินค้า (planner รอบ 13, review #200) — spec 01 รอบ 13 "ไม่ทำ/ยอมรับ"; ทำเมื่อ option เดียวผูกสินค้าหลักร้อยจริง

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
- รอบ 11 (2026-10-27): owner ตัดสิน admin UI ของ affiliate ใน v1 → AF-12a/12b/12c · นิยาม AF-8a/8b + AF-8c, `has_payout_info` → AF-13, กฎ 29d → spec 05 กฎ 35 ·
  เงื่อนไข review #148 → FS-17 (FS-14 ☑ เต็มเมื่อ FS-17 ☑) · แก้ถ้อยคำ: spec 01 AC-100 (server action), spec 03 กฎ 19 (`/search` ใช้ `GET /store/products`), spec 02 กฎ 2 (ขอบ cutoff) ·
  #142 → CORE-19d · #144 → CORE-4h · #143/#145 → GB-N3 · #141/#133 → OPS-16 · #147 nit "service zone" → แก้ใน #152 · #136 ข้อสังเกตเพดาน → ยอมรับ (spec 06) ·
  owner ตัดสินคำถามรอบ 11: ADR-017 accepted, Q16 คงเดิม, Q17 → AF-14, Q18 3 ช่อง, Q6 → CORE-10b · review #152: Earnings แสดงแถว reversed แยก (spec 05 กฎ 33), GB-N3 เป็นเรื่องกัน `null` · review #151 → ถ้อยคำ CORE-19b (race) + CORE-19e ·
  qa #148 O-1 (หน้าค้างไม่อัปเดตเมื่อแคมเปญหมด) → ยอมรับ (spec 03 กฎ 19)
- รอบ 12 (2026-10-28): follow-up สะสมจาก #148–#185 →
  spec 01: #177 → CORE-15b · #159 (AC-72 ยังไม่ทำ) → CORE-10c · builder FS-17 (search ingestion) → CORE-9b · FS-15/#160/#170 (status ของ error server action) → CORE-4i · #170 → CORE-4j ·
  #154/#150/#164 O-2 → CORE-23c · #166/#151 → CORE-19f · #169/#173/AF-12c (ชื่อ evidence) → CORE-5d · qa #178 (PDP ไซซ์ผิด) + flaky `core-19a:183` → CORE-25 ·
  spec 02: qa #179 (`javascript:` ใน `terms_url`) → EV-14 · #171/#155 → EV-N2 · #174 → EV-7d · #179 → EV-7e · nit #167 → ADM-2a ·
  spec 03: #164/#177/#148 O-3 → FS-18 · spec 04: #185 → GB-9, GB-10, Q13/Q14 (owner: ก/ก) · spec 05: #165 → AF-15 (+ Q20 = ข) · #173/#153/#174 → AF-N3 · #185 → Q19 = ข → AF-16 + spec 04 กฎข้อ 27 ·
  review #188: CORE-4i ← PAY-3b1/3b2 (contract error ของ action ชำระเงิน), PAY-3b แยก 3b1 (#189)/3b2, nit `isVisible` (#154) → CORE-5d, `useMemo` deps (#163) → ADM-8b, ถ้อยคำ mark paid (กฎ 37c) ·
  spec 07: #180/#175 → OPS-17, เช็กลิสต์ bump ข้อ 8 · spec 08: nit #183 (`useDate` locale), #163/#176 → ADM-8b/ADM-9, ADM-8a ← AF-15 ·
  แก้ถ้อยคำ: spec 01 (ADR-018 accepted, AC-102, AC-107), spec 05 กฎ 37d (ADM-8b), spec 07 path ของ `seed-load.ts`, ADR-008 ข้อ 6 (jsdom ต่อไฟล์) ·
  ไม่ทำ/ยอมรับ: `DATABASE_POOL_MAX` (gate ผ่าน), `E2E_SAVE_EVIDENCE=<TASK-ID>`, `/zz/account`, field fulfillment ใน Store order API, method ของ ownership middleware region,
  ปุ่ม `Loading...` (แก้แล้ว), test `if: false` (แก้แล้วใน #180), test convert สต็อกหมด (มีใน #185); แจ้ง owner: หน้าแรกสดช้าสุด 88.4s (เพดาน 90 ตาม ADR-017 — qa #164)
- รอบ 13 (2026-11-03, owner สั่งเปิด task จาก follow-up ของ review/qa 2026-11-03) →
  spec 01: qa #199 ยอดรวม dropdown + review #199 dropdown ค้างทับ PDP + unit `product.id` + #202 comment "Shirts" → CORE-26 (+ Q-C1) · #200 → CORE-9c (+ แก้ถ้อยคำ AC-108, pagination → backlog) ·
  #202 → หมายเหตุกฎข้อ 80 (seed เติม `featured` ที่ admin ทำว่าง — ยอมรับ) · CORE-4i ค้างรอบ 12 → Q-C2 + AC-20 ใน AC-110, Depends #203 ·
  spec 02: #201 + #205 (ต้นเหตุจุดซ้อนที่ backend) → EV-N3 · spec 03: #190 (`mobile-cart-button`) + #199 (แถบจาง 300ms) → FS-19 · #190 (`afterAll` ของ fs16) → FS-18 ·
  spec 04: #196 → รวมเข้า GB-10 (+ แก้ถ้อยคำกฎข้อ 25c) · spec 05: #197 (`??` กับ `""`) → AF-17 · spec 07: #194 JWT ใน `flash-sale.json` → OPS-17a (← #204, ความปลอดภัย), O(n²) → รวมเข้า OPS-17 ·
  spec 08: #195 (URL ของ partner ฝั่งฟอร์ม) → ADM-5 · #187 (nit `affiliate-names`) → ADM-8a
- รอบ 14 (2026-11-03, owner สั่ง) → spec 01: qa #211 (คลิกซ้อนใน tick เดียวได้ quantity 2) + review #211 (`mobile-cart-button` disable ไม่ครบ) → CORE-27 (กฎข้อ 83, AC-119) · qa #222 D-1 (cookie cart ถูกล้างใน request ของ server action) → CORE-14g (กฎข้อ 84, AC-120; owner เรียก CORE-14d แต่เลขซ้ำกับ ☑ #128) ·
  spec 04: builder GB-7 (route สาธารณะใน "API" ไม่มีใน backend และไม่มี task) → GB-11 (กฎข้อ 28, AC-45..46) + GB-7 แยก GB-7a1/GB-7a2/GB-7b/GB-7c (กฎข้อ 29, AC-16a/16b, AC-28 แทนที่, AC-47..48) + Q15–Q19 (owner ตอบแล้ว; Q19 จาก blocker review #224)
- รอบ 15 (2026-11-03, owner ตัดสิน) → spec 04: 1 แคมเปญ = 1 สินค้า + หน้ากลุ่มเลือกหลาย variant → กฎข้อ 30–31, GB-6e, GB-7a2a, ปรับ GB-11/GB-7a1/GB-7a2/GB-7c, AC-28/33/45/46/48, AC-49..50, Q20 ·
  spec 08: ADM-7 หมายเหตุ picker single select (ชน GB-6e) · review #227 → GB-6e รวมโค้ด/test เดิมที่พัง (~320 LOC), กฎ 30 ห้าม variant scope + ข้อยอมรับ promotion ของกลุ่ม, AC-33 ขีดฆ่า ·
  รอบ 15b: owner ตอบ Q20 = ค่าตั้งต้นทั้งหมด (กฎข้อ 31d) + nit re-review #227 (test id ของหน้ากลุ่ม/การ์ดในหัวข้อ Storefront)
- รอบ 16 (2026-11-04, owner อนุมัติเปิด task จาก follow-up ของ review/qa 2026-11-04) → spec 01: qa #222 O-2 → CORE-28 · รอบ 14b ตะกร้าหายหลัง login → CORE-29 + ADR-019 (proposed, Q-C3) ·
  qa #239/#238 return URL → CORE-30 · ปุ่มคัดลอกซ้ำ → CORE-31 · qa #238 Digital delivery → CORE-32 (+ Q-C4) · comment e2e core-19c → รวมใน CORE-28 ·
  spec 04: countdown ซ้ำ + `group-selection` + "ต่อชิ้น" (qa GB-7a1) + qa GB-7b 375px/empty state → GB-12 · qa GB-6e O-2 → GB-13 (+ Q21 ขัด Q10) · evidence/`firstPool`/`createViaApi` → GB-N4 ·
  test id ในหัวข้อ Storefront แก้ในที่เดิม (ไม่มี task) · spec 07: scan ก่อน cat + k6 console → OPS-17b
- รอบ 16b (2026-11-04, owner ตัดสิน) → spec 01: Q-C3 = B (ADR-019 accepted), Q-C4 = ข → spec 04 GB-14 (กฎข้อ 35, AC-54, + Q22), comment e2e core-14g หลัง #241 → CORE-28b (กฎข้อ 90, AC-126) ·
  spec 04: Q21 = ก (กฎข้อ 17/33, Q10) · nit review #240 → spec 01 กฎข้อ 86e/87, Depends CORE-28/29; spec 04 GB-N4 ก่อน GB-13; spec 07 AC-34 (`run.sh:132`)

## ข้อตกลงการทำงานต่อ PR
planner (เฉพาะเมื่อ spec เปลี่ยน) → builder (TDD, worktree) → qa (e2e + evidence) →
reviewer (อิสระ) → session หลัก merge เข้า develop (main เป็นของ owner) → PR ถัดไป
คอลัมน์สถานะอัปเดตโดย session หลัก (builder ห้ามแก้ไฟล์นี้)
