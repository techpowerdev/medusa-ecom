# ROADMAP — follow-up เก่า (archive)

ย้ายจาก `docs/ROADMAP.md` เมื่อ 2026-11-24 (owner สั่งให้ ROADMAP อ่านง่าย) — **คัดลอกตรงทุกตัวอักษร ไม่ตัดเนื้อหา**
สถานะในไฟล์นี้คง ณ วันที่บันทึก — **สถานะปัจจุบันดู [`docs/ROADMAP.md`](../ROADMAP.md)** · ประวัติรายรอบดู [`history.md`](history.md)

ณ วันย้าย: ข้อ "ก. ต้องให้ owner ตัดสิน" ของทุกรอบปิดแล้ว · ข้อ ข (test hygiene/nit) และ ค (backlog/ไม่ทำ พร้อมเหตุผล)
ที่ยังไม่มี task รอ owner สั่ง · ข้อ ง (บทเรียนกระบวนการ) เป็นของ session หลัก

## สารบัญ (ค้นด้วยชื่อหัวข้อ)

1. Backlog follow-up (แปลงเป็น task แล้ว — รายละเอียด/AC อยู่ใน spec)
2. follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 39)
3. follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 38)
4. follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 37)
5. follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 36)
6. follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 35)
7. follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 34)
8. follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 33)
9. follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 32)
10. follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 30/31)

แต่ละหัวข้อ 2–10 แบ่งเป็น ก. ต้องให้ owner ตัดสิน · ข. test hygiene / nit · ค. backlog / ไม่ทำ · ง. บทเรียนกระบวนการ (บางรอบไม่มีครบ)

<!-- BEGIN VERBATIM (docs/ROADMAP.md เดิม บรรทัด 606–1036) -->
## Backlog follow-up (แปลงเป็น task แล้ว — รายละเอียด/AC อยู่ใน spec)
- ฟอนต์ ui-preset → CORE-8 · เครื่องมือ evidence e2e → CORE-5b · ราคา THB หน้า store → CORE-9
- seed (ชื่อไทย, idempotency, `.env.example`; ค่าส่ง Standard คง placeholder จนกว่า owner ตัดสิน Q-F1) → CORE-10 · อีเมล shipped / `no_notification` → CORE-11
- `pp_system_default` ใน prod (D1) + fail-fast `RESEND_API_KEY`/`AFFILIATE_TOKEN_SECRET` + checklist go-live → OPS-7 (ADR-010 accepted)
- race PromptPay หมดอายุ × จ่ายสำเร็จ → PAY-5 (ยืนยัน) → PAY-6 (ADR-015 accepted A + D)
- `void_reason` → EV-5 · `requires_shipping=false`, `expires_at` วันที่ล้วน → EV-8 · reservation/วันที่จริง/inventory item ร่วม → EV-10
- worker ตายหลัง `ETIMEDOUT` → OPS-8 (ADR-012 accepted) · standalone / `agentRules` / `testMatch` → OPS-6
- error 409 ของ Medusa (`CONFLICT`) เขียนทับ `code`/`message` → PROMO-2 🚀 (spec 03 กฎข้อ 13)
- returns: ownership → CORE-13 🚀 · ฟิลด์ต้องห้าม → CORE-16 🚀 · ตรวจ option → CORE-17 🚀 · sales channel ของ location → CORE-21 🚀 · หน้า storefront → CORE-20
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
- รอบ 17 (2026-11-04, owner ตัดสิน + อนุมัติเปิด task) → spec 04: Q22 = ก (กฎข้อ 35c), group orders ล้ม → ไม่แสดง empty state (กฎข้อ 32e1, AC-51 ใน GB-12 #244), แก้ breakpoint กฎข้อ 32d (`sm` 640px) ·
  review #247 + `home-campaigns.test.ts` → GB-N5 (กฎข้อ 36, AC-55) · spec 01: qa #243 O-1/O-2 + comment e2e core-32 → CORE-33 (กฎข้อ 91, AC-127) · qa #241 O-3 → CORE-34 (กฎข้อ 92, AC-128) ·
  หมายเหตุทาง (b) ของ CORE-32 ในกฎข้อ 89 · spec 07: nit review #242 → OPS-17c (AC-35) · เลข PR ของ ◐ รอบ 17
- รอบ 18 (2026-11-04, session หลักส่ง follow-up หลัง merge train #248/#250/#256/#260) → spec 01: review #255 (`deliveryStepDone` นับแค่จำนวน method) → CORE-35 (กฎข้อ 93, AC-129; + หมายเหตุ out-of-scope `?step=payment` รอบ 17) ·
  qa #252 O-2 → CORE-36 (กฎข้อ 94, AC-130) · qa/review #254 ข้อความล้ม/Web Share/การ์ด voucher → CORE-37 (กฎข้อ 95, AC-131) · qa #255 O-2 + qa #258 O-3 → CORE-38 (กฎข้อ 96, AC-132) ·
  nit review #258 → CORE-39 (กฎข้อ 97, AC-133; ← CORE-29) · ยอมรับ/ตัด: ปุ่ม voucher `size="small"` (ทำแล้วใน #254), ค่าส่ง ฿0 ของ method ค้าง (qa #255 O-3) ·
  spec 04: qa #259 O-3 + nit 2 review #259 → GB-N6 (กฎข้อ 37, AC-56; ← #259) · แก้ถ้อยคำกฎข้อ 36b/AC-55 (core-flows 2.22.1 จริง), AC-52 (e2e admin `page.route`) · spec 07: สถานะ OPS-17b/17c
- รอบ 19 (2026-11-04, owner สั่ง "เปิดเลย" หลัง merge train #261/#268/#270/#272) → spec 01: qa #264 O-1 (ใส่โค้ดระหว่างลบ → โค้ดที่ลบกลับมา) → CORE-40 (กฎข้อ 98, AC-134) ·
  review/qa #266 Observation 1 → CORE-41 (กฎข้อ 99, AC-135) · qa #264 O-4 + qa/review #265 O-1 → CORE-42 (กฎข้อ 100, AC-136) · qa #264 O-2/#266 Obs 5/#267 Obs 3 + nit review #267 → CORE-43 (กฎข้อ 101, AC-137) ·
  CORE-38 ข้อ (b) ปิดโดยไม่แก้โค้ด (กฎข้อ 96b) · spec 04: nit review #269 → GB-N7 (กฎข้อ 38, AC-57), GB-N6 ข้อ (a) ปิดโดย #259 · spec 05: qa #265 O-2 → AF-18 (กฎ 42, AC-50) ·
  ยอมรับ/ไม่เปิด: `?step=delivery` ตอนไม่มีที่อยู่, spinner ปุ่มลบโค้ด (qa #264 O-3), URL หลายบรรทัดบนการ์ด Products (qa #265 O-3), `force-cache` เมื่อเปลี่ยน method นอก storefront (qa #266 Obs 2) ·
  แก้ตาราง GFM ที่แตก (pipe ในเซลล์) spec 01 (2 แถวตาราง CORE-6, แถว CORE-4i), spec 07 (`workerMode`)
- รอบ 20 (2026-11-04, owner สั่ง "ตกลง" หลัง merge #274 และ train #279/#282/#283) → spec 04: owner ทาง (ก) `crypto.getRandomValues` → GB-15 (กฎข้อ 33d แก้, AC-58) ·
  spec 01: qa #278 D-2 + O-1 → CORE-44 (กฎข้อ 102, AC-138) · qa #276 Obs 1–2 → CORE-45 (กฎข้อ 103, AC-139; ถอน "ยอมรับ" `step=delivery` ของรอบ 19) ·
  nit review #281 (`checkoutToPayment`, comment `server-action.ts`) + builder CORE-43 (core-19a/core-24 `waitForResponse`) + nit review #278 (`limit=1` — รวม `group-buy-admin-{detail,dates}` ที่มี pattern เดียวกัน) → CORE-46 (กฎข้อ 104, AC-140) ·
  บทเรียน train #280 (e2e ใช้ stock seed) → หมายเหตุแนวปฏิบัติใน test plan รอบ 20 ของ spec 01 · spec 05: qa #277 D-1 → AF-19 (กฎ 43, AC-51) · spec 06: แถว PAY-3b2 แตกบรรทัด + สถานะ ☑ #203 ·
  ยอมรับ/ไม่เปิด: `ECONNRESET` ตอน 12 workers ในเครื่อง (CI `workers: 1`), ชื่อสินค้ายาวหลายบรรทัดที่ 375 (qa #278 O-2)
- รอบ 21 (2026-11-04, owner อนุมัติเปิด task หลัง train #290/#291) → spec 01: qa #288 D-1 (ของที่ merge แล้ว) → แก้ถ้อยคำกฎข้อ 103 เป็น 103e + AC-141 (ไม่มี task) ·
  qa #287 O-1 → CORE-47 (กฎข้อ 105, AC-142) · qa #287 O-2 → CORE-48 (กฎข้อ 106, AC-143) · nit review #289 + `waitForTimeout` ของ affiliate-admin-programs + `next-action` ของ core-25/26/fs19 → CORE-49 (กฎข้อ 107, AC-144) ·
  spec 05: qa #286 O-1 → AF-20 (กฎ 44, AC-52) · spec 07: qa #285 O-1 → Deliverables ข้อ 11 (HTTPS + cookie `Secure`) ·
  ยอมรับ/ไม่เปิด: shipping option จาก cache tag `fulfillment` ใน `checkout-form` (seed มี service zone เดียว — ไม่มีผล), กด `checkout-button` ไม่ย้ายหน้าตอน 12 workers (qa #288 Obs 1; CI `workers: 1`)
- รอบ 23 (2026-11-05, owner อนุมัติให้ทำรอบถัดไปหลัง train #299) → spec 08: qa #296 O-1/O-2 + qa #293 Obs 5 → ADM-10 (กฎ 13, AC-14; รวม `pageOffset`/`toOffset` ที่เดียว) ·
  qa #293 Obs 4 + review #293/#296 → ADM-11 (กฎ 14, AC-15; + breadcrumb `/evouchers`) · qa #294 Obs 1 → ADM-12 (กฎ 15, AC-16) · qa #293 Obs 1 → ADM-13 (กฎ 16, AC-17; ← Q7) ·
  `DataTable` ไม่ reset offset (upstream) → กฎ 17 + ร่าง issue ใน spec 08 (ไม่มี task) · ADR-018 หมายเหตุ 2026-11-05 (แถว #2) ·
  spec 01: qa #298 O-1 + qa #295 O-2 → CORE-50 (กฎข้อ 108, AC-145) · nit review #295/#298 → CORE-51 (กฎข้อ 109, AC-146; ไม่รวมใน CORE-49 — ขอบเขตต่าง) ·
  ยอมรับ/ไม่เปิด: qa #295 O-1 (รหัสตัวกว้างตัดหลัง `-` — กฎ 44(b) อนุญาต), qa #298 O-2 (ราคากึ่งกลางแนวตั้งเมื่อมี error ในการ์ด)
- 2026-11-05 owner ตอบ spec 08 Q7 = (ก) → spec 08 กฎ 7c + 18 (wrapper testid ต่อหน้า), AC-17 ปลดเงื่อนไข, ADM-14 + AC-18 · ADR-018 หมายเหตุ 2026-11-05 (2) (ข้อยกเว้นหลักการ 7–8,
  `DataTableAction` 2.22.1 ไม่ส่งต่อ `data-testid`) · CLAUDE.md แก้ประโยคข้อยกเว้น testid (หัวข้อ Language + ข้อห้ามข้อ 1; owner อนุญาต)
- รอบ 25 (2026-11-09, เอกสารล้วน) → sync สถานะ ☑ ของ PR ที่ merge แล้วแต่ ROADMAP/spec ยังเป็น ☐/◐ (spec 01–05, 08) · ปิด spec 02 Q1–Q3 (ค่าเริ่มต้น) ·
  spec 06 Q1 → ข้อ 6 ของ go-live checklist ใน `docs/ops/production.md` · spec 01 Q-F1 คง ฿10 placeholder · ไม่มี task/ADR ใหม่ ไม่เปลี่ยนนิยาม/Depends ของ task ที่เหลือ
- รอบ 26 (2026-11-09, เอกสารล้วน — follow-up review/qa รอบ 25) → spec 07: OPS-21 (AC-36), OPS-22 (AC-37), OPS-23 (AC-38; Q-O4 = ก) · spec 02: EV-15 (กฎข้อ 31, AC-45; ADR-021), Q12 = ก, Q13 = ก, แก้ท้าย AC-3 และกฎ 28c · spec 04: GB-16 (กฎข้อ 39, AC-59) ·
  spec 01: CORE-52 (กฎข้อ 110, AC-147), CORE-53 (กฎข้อ 111, AC-148), แก้ AC-64/กฎข้อ 71, จัดตำแหน่ง ☑ รอบ 12 · spec 08: ADM-15..17 (กฎ 19–21, AC-19..21), แก้กฎ 7(b)/14/AC-18, Q8 = ก ·
  ยอมรับ/ไม่เปิด: ActionMenu Escape สองครั้ง (spec 08), ตะกร้า 4 หลักที่ 320px (spec 01)
- ปิดรอบ 26 (2026-11-09, เอกสารล้วน) → sync ☑ PR #309–#328 (ยกเว้น #317) ใน ROADMAP และ spec 01, 02, 07, 08 · spec 01: กฎข้อ 77 + AC-115 ของ CORE-5d เปลี่ยนเป็นแก้ที่ fixture (ผลสำรวจชื่อ evidence ไม่ตรงราว 80 จุดในกว่า 30 spec, ตามคำตัดสินของ session หลัก), CORE-54 (กฎข้อ 112, AC-149) ·
  spec 05: กฎ 37a/37c, AC-42, AC-44 ใช้ testid/locator ปัจจุบันหลัง ADM-8b/ADM-14 · spec 07: OPS-24 (AC-39) · spec 08: กฎ 13f (`PageOffsetGate` จาก #324), ADM-18 (กฎ 22, AC-22 — ยืนยันก่อน), ADM-19 (กฎ 23, AC-23) ·
  ตรวจ follow-up รอบ 25 ข้อ A–P แล้วมี task/คำตัดสินครบ ไม่เปิดซ้ำ · ไม่มี ADR ใหม่
- รอบ 27 (2026-11-10, เอกสารล้วน — ทดสอบจริงบน develop `84b9e610`, owner สั่งแก้ 4 ข้อ) → spec 01: return รับของไม่ได้ → CORE-55 (กฎข้อ 113, AC-150..154, ADR-022 accepted ตาม Q-C5) · spec 02: EV-M-29 → EV-16 (กฎข้อ 32, AC-46) · spec 05: AF-M-02 → AF-21 (กฎ 45, AC-53) ·
  spec 08: ADM-M-10 → ADM-20 (กฎ 24, AC-24), สำรวจพบตารางอื่นและ loader หน้า pool → follow-up ADM-21, ADM-22 (ไม่ขยาย scope) · AF-M-03 ยังรอ owner
- ปิดรอบ 27 (2026-11-10, เอกสารล้วน) → sync ☑ EV-16 #333, AF-21 #334, ADM-20 #335, CORE-55 #336, EV-17 #337 ใน ROADMAP และ spec 01, 02, 05, 08 — **เงื่อนไข release v0.1.0 ครบ** ·
  spec 01: แก้ถ้อยคำ AC-154 ให้ตรง dashboard 2.22.1 (drawer ยิง `/receive` แล้ว `/receive-items` เองตอนเปิด — nit 3 review #336), qa #336 D-1 → CORE-56 (กฎข้อ 114, AC-155; รอ Q-C6), คำถามวิธีแสดงค่าส่ง → Q-C7 ·
  spec 02: review #333 → EV-18 (กฎข้อ 34, AC-48 — ตรวจโค้ดแล้ว: code ถูก compensate คืนเพราะ `throwIfOrderIsCancelled` ของ core แต่ยังมี flag/อีเมล backordered และ error log) · spec 05: qa #334 → AF-22 (กฎ 46, AC-54) · ไม่มี ADR ใหม่
- รอบ 28 (2026-11-10, เอกสารล้วน — บันทึกคำตัดสินของ owner "ตามที่แนะนำ" แต่ยังไม่สั่งทำ) → sync ☑ EV-18 #339, AF-22 #340 ใน ROADMAP และ spec 02, 05 ·
  spec 01: Q-C6 = ก (หัวข้อปิดรอบ 27 accepted, ตัดทาง ข จาก CORE-56), Q-C7 = ก → แก้กฎข้อ 81b + หัวข้อ "Follow-up รอบ 28": กฎข้อ 115, AC-156, CORE-57 (ใช้ `original_item_total`/`original_shipping_total` แทน `item_total`/`shipping_total` เพราะ 2.22.1 หักส่วนลดแล้วใน field นั้น — ไม่หักซ้ำกับ `discount_total`) ·
  spec 05: AF-M-03 → แก้กฎ 13 + AC-15 (400 `invalid_data` เมื่อ body มี `email`) ไม่มี task · spec 08: ADM-21 → ADM-21a/21b (กฎ 25, AC-25..26), ADM-22 (กฎ 26, AC-27 — ยืนยันก่อน) ·
  task ใหม่ทั้งหมดพักไว้ (owner ยังไม่สั่งทำ) ไม่บล็อก release v0.1.0 · ไม่มี ADR ใหม่
- ปิดรอบ 29 (2026-11-13, เอกสารล้วน — owner สั่งทำต่อ "ตามที่เสนอ") → sync ☑ CORE-56 #351, CORE-57 #352, CORE-52 #353, OPS-22 #354, CORE-54 #355, OPS-24 #356, GB-16 #357, CORE-53 #358, ADM-16 #359, ADM-17 #360, ADM-21a #361, ADM-21b #362
  ใน ROADMAP และ spec 01, 04, 07, 08 (spec คง ☑ ไม่ sync 🚀) · spec 01/08: บันทึกเพิ่มในบรรทัดสถานะ/หัวข้อรอบ 28 ที่เคยเขียน "พักไว้ — owner ยังไม่สั่งทำ" ว่าสั่งทำและ merge แล้ว (ไม่ลบประวัติ) ·
  เหลือ: ADM-22 พักไว้, OPS-23/ADM-15/ADM-18/ADM-19 เริ่มได้ · ไม่มี task/ADR ใหม่ ไม่เปลี่ยนกฎ/AC/Depends · `CLAUDE.md` ไม่แตะในรอบนี้ (นอกจากที่ OPS-22 #354 แก้ไปแล้ว)
- รอบ 30 (2026-11-13, เอกสารล้วน — owner อนุมัติแปลง follow-up ของรอบ 29 #351–#363; ตรวจโค้ดบน develop `8fb44d70`) →
  spec 01: qa #353 O-1 (zero-width ในช่องที่อยู่) + re-review #353 (`normalize` 3 สำเนา) → CORE-58 (กฎข้อ 116, AC-157) · review #355/#358 (cleanup `core-4g`, นับ delete จาก AST, comment `VALID_AFFILIATE_ARGS`) → CORE-59 (กฎข้อ 117, AC-158) ·
  qa #352 ป้าย "ยอดรวมสินค้า (รวม VAT)" สองความหมาย → **Q-C8**; review #352 `ALLOWED = ["VAT"]` เทียบ ADR-014 ข้อ 4 → **Q-C9** (รอ owner; ไม่แก้ ADR-014 จนกว่า owner ตอบ) ·
  spec 08: #359 (กระพริบตอน clamp, `PartnerActions`) → ADM-23 (กฎ 27, AC-28) · review/re-review #360 (`mergeAffiliatePages`, 401 ใน combobox, `tiebreakById`) → ADM-24 (กฎ 28, AC-29) ·
  qa/review #361/#362 (แถบแบ่งหน้าตอน error, หัวข้อ Ledger, กฎ 24d ไม่มี e2e, comment `pools-table`) → ADM-25 (กฎ 29, AC-30; แก้ตารางกฎ 25 แถว Ledger) · qa #360 O-2 (Escape ของ Combobox) → ADM-26 (กฎ 30, AC-31 — ยืนยันก่อน) ·
  spec 05: nit review #347 → AF-23 (กฎ 47, AC-55) · spec 07: nit review #354 → OPS-25 (AC-40) ·
  ยอมรับ/ไม่เปิด: `cart-button` `force-cache` (qa #353 ไม่พบค่าค้าง — แนวรอบ 19), `data-value` ทศนิยมดิบ, `dataValue` ซ้ำ 2 ที่, `STRING_OR_COMMENT` ผู้ใช้เดียว, lock return ปล่อยตอน `close`/TTL ไม่ต่อ (ข้อเสียของ Q-C6 ก),
  integration lock บน provider in-memory (spec 01/07) · index `group_buy_membership` รอวัดบน prod (spec 04) · `usePrompt` ดับเบิลคลิก, `REVEAL_KEY`/`DELETE_KEY`, `q` ไม่ escape/access log, `order=foo` 500, regex static ของ `medusa-ui.unit.spec.ts`, AC-43 ที่ workers > 1, รูป evidence ADM-21b (spec 08) ·
  cast `EvoucherOrder` (spec 02) · `stale` เป็น `Set` ของ e2e AF-8a (spec 05) · ข้อ 🚀 ระดับ AC ในบันทึกประวัติ (review #348 — ไม่ผิดกติกา ไม่แก้ประวัติ) · ไม่ใช่ task: เลข PR ในแถว spec (แก้แล้ว e48ae413), Skill tool/node v20 ของ subagent, บทเรียน evidence แบน (PR #364) ·
  ไม่มี ADR ใหม่ · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- รอบ 31 (2026-11-13, เอกสารล้วน — บันทึกคำตัดสินของ owner; ตรวจโค้ดบน develop `fef9b65b`) → spec 01: Q-C8 = ก → แก้กฎข้อ 115c + หมายเหตุ AC-156, หัวข้อ "Follow-up รอบ 31": กฎข้อ 118, AC-159, CORE-60 ·
  Q-C9 = ก → ADR-014 ภาคผนวก 2026-11-13 ("VAT" = หน่วย/รหัสของข้อ 4; ไม่แก้เนื้อหาเดิม, ไม่มีโค้ด) · ROADMAP: owner สั่งทำ 2026-11-13 — CORE-58, CORE-59, CORE-60, AF-23, OPS-25, OPS-23, ADM-15, ADM-18, ADM-19, ADM-23..26 (ADM-22 ยังพักไว้) ·
  แถว task ของ spec 01/05/07/08 สำหรับ task ที่สั่งทำ**ไม่แก้**ในรอบนี้ (builder แก้แถวของตัวเองใน PR — กัน conflict) · ไม่มี ADR ใหม่ · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- ปิดรอบ 30/31 (2026-11-14, เอกสารล้วน) → sync ☑ OPS-25 #366, CORE-59 #367, AF-23 #368, CORE-58 #369, OPS-23 #371, CORE-60 #372, ADM-23 #373, ADM-15 #374, ADM-24 #375, ADM-18 #377, ADM-26 #379, ADM-19 #380, ADM-25 #381
  ใน ROADMAP และ spec 01, 05, 07, 08 (บรรทัดสถานะ/Status/Out of scope/บรรทัดใต้ตาราง task ที่เคยเขียน "owner ยังไม่สั่งทำ" แก้เป็นปัจจุบัน — ไม่ลบประวัติ) · เอกสารที่ merge ในรอบ: #364, #365, #370, #376, #378 ·
  แก้ข้อเท็จจริงตาม review/qa (ไม่เปลี่ยนพฤติกรรมที่ต้องได้): spec 01 กฎข้อ 117c (comment ข้อจำกัดมีอยู่ก่อนแล้ว — #367), spec 08 กฎ 22 (หน้าต่างข้อจำกัดนับถึง re-render หลัง URL commit — qa #377), กฎ 30b (radix-ui 1.1.2 → react-dialog 1.1.5 → dismissable-layer 1.1.4 — review #378),
  AC-31(b) (scope เป็น multi-select ปิดรายการด้วยคลิกนอกรายการ — review #378) · OPS-23: คง default pool 10 ไม่เปิด ADR-020 · follow-up ใหม่ → หัวข้อถัดไป (ไม่เปิด task id ใหม่) · เหลือ: ADM-22 พักไว้ · ไม่มี ADR ใหม่ · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- รอบ 32 (2026-11-17, เอกสารล้วน — owner อนุมัติ "ตามที่เสนอ" และตัดสินข้อ (4) เอง; ตรวจโค้ดบน develop `a9fec926`) →
  spec 04: qa #374 D-1 → GB-17 (กฎข้อ 40, AC-60 — ตรวจพบ validator ของ flash sale/affiliate/e-voucher มีปัญหาเดียวกัน รวมใน task เดียว) ·
  spec 01: e2e hygiene กลุ่ม ข → CORE-61 (กฎข้อ 119, AC-160; flaky `affiliate-admin-forms.spec.ts:47` ไม่พบสาเหตุ → รอเกิดซ้ำ; `waitForTimeout(1_000)` ของ e2e กฎ 24d ยอมรับ) ·
  ข้อ (4) owner ตัดสิน → ภาคผนวก 2026-11-17 ของกฎข้อ 118a + กฎข้อ 120, AC-161, CORE-62 (หมายเหตุใน AC-159 เคสค่าส่ง) · ข้อ (5) → Q-C10 ·
  spec 07: ข้อ (2) → Q-O5 (ADR-024 สงวนเลข ยังไม่เขียน) · spec 08: ข้อ (3) → Q9, ข้อ (6) → Q10 · spec 05: พบเพิ่มระหว่างตรวจ GB-17 → Q21 (`hold_days` ทำ `matures_at` เป็น Invalid Date) ·
  ไม่มี ADR ใหม่ · ไม่แตะ `docs/ops/**` และ `CLAUDE.md` ·
  **owner ตอบคำถามครบ 2026-11-17 (PR เดียวกัน #383)**: Q-O5 = ก → OPS-26 (spec 07 หัวข้อ "Follow-up รอบ 32", AC-41) · Q9 = ก → ADM-27 (spec 08 กฎ 31, AC-32) · Q-C10 = ก → CORE-63 (spec 01 กฎข้อ 121, AC-162) · Q10 = ก คงเดิม (spec 08 ยอมรับใน v1) ·
  Q21 = ก → GB-17 ขยาย (spec 04 กฎข้อ 40 (ข), AC-60 (c)) · แก้ nit review #383: แถว CORE-62 เงื่อนไข `> 0.005`, AC-161 เงื่อนไขก่อนเริ่ม `|ผลต่าง| ≤ 0.005`, spec 05 ค่าประมาณ 99,979,000 วัน
- ปิดรอบ 32 (2026-11-17, เอกสารล้วน) → sync ☑ CORE-62 #384, OPS-26 #385, CORE-63 #386, GB-17 #387, CORE-61 #388, ADM-27 #389 ใน ROADMAP และ spec 01, 04, 07, 08 (+ บรรทัดสถานะ spec 05 เรื่อง Q21) · เอกสารที่ merge ในรอบ: #383 ·
  OPS-26: ไม่เปลี่ยนวิธี deploy prod ไม่เปิด ADR-024 (เลขยังว่าง); spec 07 กฎ (d) แก้เป็น 10 × (n + 1) (รวม worker — nit review #383), ข้อเท็จจริง `--cluster` ของ 2.22.1 (ต้องคู่ `--servers`; fork ใหม่ไม่บูต `start.js:311–314` — review #385) ·
  แก้ข้อเท็จจริง (ไม่เปลี่ยนพฤติกรรมที่ต้องได้): spec 01 กฎข้อ 120a หมายเหตุ guard `discount_total` ที่โค้ดมี (review #384), AC-160 คำสั่งไม่มี `--` (#388 — มี `--` แล้วรันทั้ง suite),
  อักขระ zero-width ดิบใน spec 01 AC-162 และ `docs/evidence/core/CORE-58/REPORT.md`, `docs/evidence/core/CORE-52/REPORT.md` เป็น escape `\uXXXX` ·
  follow-up ใหม่ → หัวข้อ "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 32)" (ไม่เปิด task id ใหม่) · เหลือ: ADM-22 พักไว้ · ไม่มี ADR ใหม่ · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- รอบ 33 (2026-11-17, เอกสารล้วน — บันทึกคำตัดสินของ owner ต่อกลุ่ม ก ของ follow-up ปิดรอบ 32; ตรวจโค้ดบน develop `1c55193f` และ `@medusajs/dashboard` 2.22.1) →
  spec 01: (1) = ก → หัวข้อ "Follow-up รอบ 33": กฎข้อ 122, AC-163, CORE-64 (ฟอร์ม promotion ของ dashboard มีสวิตช์ `is_tax_inclusive` สำหรับ template fixed อยู่แล้ว ค่าเริ่มต้น `false`; โค้ดของเราไม่มีจุดสร้าง promotion fixed ที่ต้องแก้ — group buy ตั้ง `true` อยู่แล้ว) + คำถาม Q-C11 ·
  (2) = ข → กฎข้อ 121b หมายเหตุยอมรับใน v1 · (5) คงเดิม → ยอมรับใน v1 (กฎข้อ 115) · spec 01 "ยอมรับ (รอบ 32)" ข้อ flaky AC-12 ชี้ไป ADM-28 ·
  spec 08: (4) → หัวข้อ "Follow-up รอบ 33": สมมติฐาน H1–H3, กฎ 32, AC-33, ADM-28 · spec 07: (3) = ก → รายการก่อน go-live ท้ายหัวข้อ "Follow-up รอบ 32" + checklist bump ข้อ 10 ·
  ROADMAP: บรรทัดสถานะ, แถว CORE-64/ADM-28, รายการ go-live, ทำเครื่องหมาย "แปลงแล้ว" ในหัวข้อ follow-up ปิดรอบ 32 · ไม่มี ADR ใหม่ · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- ปิดรอบ 33 (2026-11-18, เอกสารล้วน) → sync ☑ ADM-28 #393, CORE-64 #392 ใน ROADMAP และ spec 01, 08 (Status หัวข้อ "Follow-up รอบ 33" ของทั้งสอง spec → done) · เอกสารที่ merge ในรอบ: #391 ·
  spec 08: บันทึกสาเหตุจริงของ ADM-28 (H3 แบบที่ไม่ได้คาด — `q` แยกคำ × tag ตัวเลข) + บทเรียนกฎ 32f (e2e ที่ใช้ `q` ห้ามใช้ tag ที่มีตัวเลขชนกับคำค้น) ·
  spec 01: ผล CORE-64 (สวิตช์ของ dashboard ใช้ได้ ลดตรงเป๊ะ; คู่มือ `docs/guides/admin-promotions.md`), Q-C11 ยังค้าง ·
  follow-up ใหม่ → หัวข้อ "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 33)" (ไม่เปิด task id ใหม่) · เหลือ: ADM-22 พักไว้ · ไม่มี ADR ใหม่ · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- รอบ 34 (2026-11-18, เอกสารล้วน — บันทึกคำตัดสินของ owner ต่อกลุ่ม ก ของ follow-up ปิดรอบ 33 + nit review #393/#394) →
  spec 01: Q-C11 = ก (คู่มือ + test ของ CORE-64 อย่างเดียว ไม่มี task) — ทำเครื่องหมายตอบแล้วใน Open questions รอบ 33 + บรรทัดสถานะ ·
  spec 08: หัวข้อ "Follow-up รอบ 34": กฎ 33, AC-34, ADM-29 (test payout tag ตัวอักษร + assert `count` = 1; static "tag ไม่มีตัวเลข" ครอบ AC-12 ตัวแรกและ payout — ข้อ ข nit #393) · กฎ 32f แก้ถ้อยคำ "assert จำนวนผลก่อนใช้ผลการค้น" (nit #394) ·
  ROADMAP: บรรทัดสถานะ, แถว ADM-29, ลบวลี "ADR-024 ยังว่าง" ที่ซ้ำในบรรทัดประวัติรอบ 33 (nit #394), ทำเครื่องหมาย "แปลงแล้ว" ในหัวข้อ follow-up ปิดรอบ 33 · ไม่มี ADR ใหม่ · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- ปิดรอบ 34 (2026-11-18, เอกสารล้วน) → sync ☑ ADM-29 #396 ใน ROADMAP และ spec 08 (Status ต้นไฟล์ + Status หัวข้อ "Follow-up รอบ 34" → done พร้อมผลจาก `ADM-29-tests.txt`) · เอกสารที่ merge ในรอบ: #395 ·
  ROADMAP: แก้ `**` เกินในข้อ ก (1) ของหัวข้อ follow-up ปิดรอบ 33 (nit review #395) · follow-up ใหม่ → หัวข้อ "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 34)" (ไม่เปิด task id ใหม่) ·
  เหลือ: ADM-22 พักไว้ · ไม่มี ADR ใหม่ · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- รอบ 35 (2026-11-18, เอกสารล้วน — ผล qa ADM-22 + คำตัดสินของ owner ข้อ ก "แก้ที่การ build") →
  spec 08: Status ต้นไฟล์, Status หัวข้อ "Follow-up รอบ 28" (→ done), ผลใต้กฎ 26 และ AC-27 (เข้า 26b แต่สาเหตุระดับ build; AC-27b ไม่ใช้), แถว ADM-22 (☑ ผลตรวจ, ADM-22b ✕), แถว `ErrorBoundary` ในตาราง Medusa ของรอบ 28 — เพิ่มหมายเหตุลงวันที่ ไม่ลบเนื้อหาเดิม ·
  spec 07: หัวข้อ "Follow-up รอบ 35" — ตารางที่ build backend (Dockerfile, `ci.yml`, `CLAUDE.md`; ทางผ่าน Dockerfile ไม่ต้องแก้; `docs/ops/**`/`release-gate.yml` ไม่มีคำสั่ง build), กฎ OPS-27 (a)–(e), AC-42 (a)–(d), test plan, task OPS-27, Q-O6;
  แก้ข้อเท็จจริงของคำสั่งงาน: handler `build` อยู่ที่ `@medusajs/cli` `create-cli.js:540–541` (`:182` คือ `db:setup`) · พบระหว่างวางแผน: `medusa build` โหลด `medusa-config.ts` → guard throw ใน stage build ที่ไม่มี env → กฎ (b) placeholder + Q-O6 ·
  ROADMAP: บรรทัดสถานะ, แถว ADM-22, OPS-27 ใน M7 · ไม่มี ADR ใหม่ (ADR-024 ยังว่าง) · ไม่แตะ `docs/ops/**` และ `CLAUDE.md` (บรรทัดคำสั่ง prod-like → builder แก้ใน OPS-27 ตามที่ owner อนุมัติ)
- รอบ 36 (2026-11-18, เอกสารล้วน — owner สั่ง "ให้ planner เริ่มรอบ 36"; triage follow-up ปิดรอบ 30/31–35 + บันทึกของ session หลัก ตรวจกับโค้ดบน develop `14837f04`) →
  spec 07: หัวข้อ "Follow-up รอบ 36" — ที่มา (`ci.yml:179–180`, `:302` `if grep` ผ่านเมื่อ rc ≥ 2; พบเพิ่ม: step OPS-15 `:130` `|| true` ผ่านเมื่อไม่มี log; `Compiler` ของ Medusa 2.22.1 ไม่ข้าม `__tests__` → ~100 ไฟล์ test เข้า `/app`), กฎ OPS-28/OPS-29, AC-43, AC-44, task OPS-28 → OPS-29 ·
  spec 08: หัวข้อ "Follow-up รอบ 36" — กฎ 34 (ADM-30), กฎ 35 (ADM-31), AC-35, AC-36 · spec 01: หมายเหตุใต้กฎข้อ 119 (static ของ (c) vacuous → ADM-30) ·
  ROADMAP: บรรทัดสถานะ, แถว OPS-28/29 ใน M7, ADM-30/31 ในตาราง Admin UI, ทำเครื่องหมายในหัวข้อ follow-up ปิดรอบ 30/31–35 ว่าข้อไหนเป็น task/ปิด/backlog · ไม่มี ADR ใหม่ (ADR-024 ยังว่าง) · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- รอบ 36 ส่วนที่ 2 (2026-11-18, เอกสารล้วน — owner ตอบกลุ่ม ค ของปิดรอบ 30/31 = ข และข้อราคาซ้ำ = ก; ผล qa ตรวจซ้ำบน develop `8425a53f`) →
  spec 08: หัวข้อ "Follow-up รอบ 36 ส่วนที่ 2" — กฎ 36 (ADM-32), กฎ 37 (ADM-33; ต้นเหตุ `TruncatedCell` ใน `@medusajs/ui` 4.2.8 `data-table-table.js:322–356` ตรวจ source แล้ว), AC-37, AC-38, ข้อที่ปิด (zod union ของ `status`, `data-value` float) + บรรทัดสถานะ ·
  spec 01: หัวข้อ "Follow-up รอบ 36 ส่วนที่ 2" — กฎข้อ 123, AC-164, CORE-65 + บรรทัดสถานะ · spec 04: หมายเหตุท้ายกฎข้อ 40 (error ใต้ช่องของฟอร์ม campaign → ADM-32) ·
  ROADMAP: บรรทัดสถานะ, แถว CORE-65 ในตาราง CORE, ADM-32/33 ในตาราง Admin UI, ทำเครื่องหมายกลุ่ม ค ในหัวข้อ follow-up ปิดรอบ 30/31 ว่า triage แล้ว · ไม่มี ADR ใหม่ (ADR-024 ยังว่าง) · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- ปิดรอบ 36 (2026-11-18, เอกสารล้วน) → sync ☑ ADM-30 #402, OPS-28 #403, ADM-31 #404, CORE-65 #406, OPS-29 #407, ADM-32 #408, ADM-33 #409 ใน ROADMAP และ spec 07, 08, 01 · เอกสารที่ merge ในรอบ: #401, #405 ·
  spec 07: Status ต้นไฟล์ + หัวข้อ "Follow-up รอบ 36" → done พร้อมผล OPS-28/OPS-29, ☑ ที่ AC-43/AC-44 และแถว task ·
  spec 08: Status ต้นไฟล์ (คง in-progress ตาม convention ของไฟล์ — ไม่มี task เปิดค้าง), หัวข้อ "Follow-up รอบ 36" และ "ส่วนที่ 2" → done พร้อมผล ADM-30–33 + ข้อสังเกต qa, แถว task; แก้ nit review #401 (path `widgets/flash-sale-options.tsx`, เลขบรรทัดชี้ `FocusModal.Content`) ·
  spec 01: Status ต้นไฟล์ + หัวข้อ "Follow-up รอบ 36 ส่วนที่ 2" → done พร้อมผล CORE-65, แถว task (แก้ "PR ที่เปิดอยู่ #402–#404" ตาม review #405), หมายเหตุใต้กฎข้อ 119 ☑ #402 ·
  ROADMAP: บรรทัดสถานะ (รอบ 36 ส่วนที่ 2 → ประวัติ; แก้ "ไม่ชน ADM-30 #402" ตาม review #405), แถว task ทั้ง 7, follow-up ใหม่ → หัวข้อ "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 36)" (ไม่เปิด task id ใหม่) ·
  ไม่มี ADR ใหม่ · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- รอบ 37 (2026-11-18, เอกสารล้วน — owner ตัดสินข้อ ก (1)–(5) ของหัวข้อปิดรอบ 36 = ทำทุกข้อ; ตรวจกับโค้ดบน develop `99a52afb` และ source ใน `node_modules` ของ Medusa 2.22.1/`@medusajs/ui` 4.2.8) →
  spec 04: Status ต้นไฟล์ (draft → in-progress ตาม convention เมื่อมี task), ตาราง "สิ่งที่ Medusa มีให้อยู่แล้ว" 2 แถว (Medusa คุม adjustment ≤ ยอด line; hook `promotionsUpdated`), กฎข้อ 41, AC-61, test plan, GB-18, Q23 ·
  spec 01: Status ต้นไฟล์ (accepted → in-progress), หมายเหตุใต้กฎข้อ 123d, หัวข้อ "Follow-up รอบ 37" — กฎข้อ 124–125, AC-165–166, CORE-66 → CORE-67 ·
  spec 08: Status ต้นไฟล์, หัวข้อ "Follow-up รอบ 37" — ที่มา (ต้นเหตุ layout ของ `DataTable` 4.2.8, `/app/products` ไม่ใช่ตัวเทียบ), กฎ 38–40, AC-39–41, ADM-34 → ADM-35 → ADM-36, Q11 (มีเงื่อนไข) ·
  ROADMAP: บรรทัดสถานะ (ปิดรอบ 36 → ประวัติ), แถว GB-18 (M5), CORE-66/67, ADM-34–36, ทำเครื่องหมายข้อ ก (1)–(5) และ nit กลุ่ม ข ของหัวข้อปิดรอบ 36 · ไม่มี ADR ใหม่ (ADR-024 ยังว่าง) · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- ปิดรอบ 37 (2026-11-19, เอกสารล้วน) → sync ☑ CORE-66 #412, ADM-34 #413, GB-18 #414, CORE-67 #415, ADM-35 #416 + ADM-36 ☑ ผลวัด (commit `docs/evidence/admin-ui/ADM-36-tests.txt` ใน PR นี้) · เอกสารที่ merge ในรอบ: #411 · คำตอบ owner 2026-11-19: Q11 = ก, Q23 = ก, qa #415 O-1 = คงเดิม, ADM-37 = ก ทำ ·
  spec 04: Status ต้นไฟล์, กฎข้อ 41f (Q23 = ก) + 41h (allocation across ตั้งใจ — review #411) + 41i (price list ถูกกรองโดย Pricing module อยู่แล้ว — review #414), ☑ AC-61 และแถว GB-18, Q23 ตัดสินแล้ว ·
  spec 01: Status ต้นไฟล์ + หัวข้อ "Follow-up รอบ 37" → done, ถ้อยคำ tolerance ใต้กฎข้อ 124e (`expectAmounts` ≤ 0.005 + 1e-6 แทน `toBeCloseTo` — review #412/#415), หมายเหตุใต้กฎข้อ 125f (qa #415 O-1 คงเดิม), ☑ AC-165/166 และแถว task ·
  spec 08: Status ต้นไฟล์ + หัวข้อ "Follow-up รอบ 37" → done, ถ้อยคำกฎ 39a (`size`/`maxSize` 298/274, actions ของ partners `size: undefined`), 39d + AC-40a (หาหน้าด้วย admin API + `<prefix>_offset` แทน `q`), กฎ 40d (ผลวัด ADM-36 ทาง A), nit review #411 (2)(3)(5),
  ☑ AC-39/40/41 และแถว task, Q11 ตัดสินแล้ว; หัวข้อใหม่ "Follow-up รอบ 38" — กฎ 41, AC-42, ADM-37, Q12 ·
  ROADMAP: บรรทัดสถานะ (รอบ 37 → ประวัติ), แถว task ทั้ง 6 + ADM-37, ทำเครื่องหมายหัวข้อปิดรอบ 36, หัวข้อใหม่ "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 37)" · ไม่มี ADR ใหม่ (ADR-024 ยังว่าง) · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- ปิดรอบ 38 (2026-11-19, เอกสารล้วน) → sync ☑ ADM-37 #418 · เอกสารที่ merge ในรอบ: #417 · คำตอบ owner 2026-11-19: spec 08 Q12 = ก (คอลัมน์สุดท้ายเป็น auto) ·
  spec 08: Status ต้นไฟล์ (คง in-progress) + หัวข้อ "Follow-up รอบ 38" → done, กฎ 41c (คอลัมน์สุดท้าย `hold_days`/`created_at`/`id` แทน actions + ผลวัด), ☑ AC-42 และแถว ADM-37, Q12 ตัดสินแล้ว + แก้ตัวเลข ~290px เป็นผลวัด (review #417) ·
  ROADMAP: บรรทัดสถานะ (ปิดรอบ 37 → ประวัติ; ย้ายข้อความ ☑/ตอบครบที่ต่อท้ายบรรทัดประวัติรอบ 37 มาไว้บรรทัดสถานะใหม่ — review #417 ข้อ 3), แถว ADM-37, cart S2 ของ CORE-67 ในหัวข้อปิดรอบ 37 กลุ่ม ข (review #417 ข้อ 2),
  หัวข้อใหม่ "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 38)" (ไม่เปิด task id ใหม่) · ไม่มี ADR ใหม่ (ADR-024 ยังว่าง) · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- รอบ 39 (2026-11-19, เอกสารล้วน — owner ตอบข้อ ก ของหัวข้อปิดรอบ 38 = ก "แก้แบบ ADM-37"; ตรวจกับโค้ดบน develop `c0ec084e`) →
  spec 08: Status ต้นไฟล์ (คง in-progress), หัวข้อใหม่ "Follow-up รอบ 39" — กฎ 42, AC-43, ADM-38; Out of scope ของรอบ 38 ชี้ไป ADM-38; nit review #419 ข้อ 1 (AC-42 "96/96; วัดที่ 1280/1440/1920") ·
  ROADMAP: บรรทัดสถานะ (ปิดรอบ 38 → ประวัติ), แถว ADM-38, ทำเครื่องหมายข้อ ก (1) และ ข ข้อแรกของหัวข้อปิดรอบ 38 · ไม่มี ADR ใหม่ (ADR-024 ยังว่าง) · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`
- ปิดรอบ 39 (2026-11-19, เอกสารล้วน) → sync ☑ ADM-38 #421 · เอกสารที่ merge ในรอบ: #420 · ไม่มีคำตอบ owner ใหม่ ·
  spec 08: Status ต้นไฟล์ (คง in-progress) + หัวข้อ "Follow-up รอบ 39" → done, ☑ AC-43 พร้อมผล red 3 ขั้นและผลวัด qa 1280/1440/1920, แถว ADM-38 ·
  ROADMAP: บรรทัดสถานะ (รอบ 39 → ประวัติ), แถว ADM-38, ทำเครื่องหมายหัวข้อปิดรอบ 38 ว่าข้อ ก ครบ, หัวข้อใหม่ "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 39)" (ไม่เปิด task id ใหม่) ·
  ไม่มี ADR ใหม่ (ADR-024 ยังว่าง) · ไม่แตะ `docs/ops/**` และ `CLAUDE.md`

## follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 39)
ที่มา: review/qa/builder ของ #420–#421 (2026-11-19) — **ยังไม่เปิด task id** planner รอบถัดไปแปลงเป็น spec/task เมื่อ owner สั่ง · ไม่มีข้อใดบล็อก release
### ก. ต้องให้ owner ตัดสิน
ไม่มี — ไม่มีคำถาม owner ในรอบนี้
### ข. test hygiene / nit (planner จัดเป็น task เล็กได้เมื่อ owner สั่ง)
- (review #421) `e2e/admin-table-long-text.spec.ts` type `Table` ให้ `trigger` เป็น optional (AC-43a) ทำให้ต้องใช้ non-null assertion `!` 6 ที่ในผู้เรียกเดิมที่มีปุ่ม `…` → แยก type เช่น `RowMenuTable` (มี `trigger` บังคับ) กับตารางที่ไม่มีเมนู
- (review #421) `docs/evidence/admin-ui/ADM-38-tests.txt` ขั้น (2): probe วัดเนื้อหา cell Affiliate 264.0/414.2px แต่ test ล้มที่ 261.875/409.0625px — ไม่ได้อธิบายส่วนต่าง (ข้อมูลคนละชุดหรือจังหวะวัดต่างกัน) → ครั้งหน้าบันทึกเหตุผลหรือวัดด้วย helper เดียวกับ test
- (review #421) `apps/storefront/e2e/support/affiliate.ts:46` comment "ผู้เรียกเดิมไม่ใช้ค่าคืน" จะล้าสมัยเมื่อมีผู้เรียกใช้ id ที่คืน (ADM-38 ใช้แล้ว) → แก้ถ้อยคำเมื่อแตะไฟล์ครั้งถัดไป
- ข ของหัวข้อปิดรอบ 38 และก่อนหน้าที่ยังไม่มี task คงไว้
### ค. backlog / ไม่ทำ (พร้อมเหตุผล)
- (qa #421 O-1 — ข้อสังเกต ไม่ใช่ defect) tooltip ของชื่อ 370 ตัวอักษรสูงมาก บังหลายแถวที่ 1280 (อ่านได้ครบ — เดียวกับ qa #418 O-3 / #416 O-4) · hover cell ถัดไปทันทีหลัง tooltip นี้ไม่เปิด tooltip ใหม่ภายใน 5 วินาที
  แต่บนหน้าที่เพิ่งโหลดเปิดถูกต้อง — น่าจะเป็น grace area ของ Radix หรือ cell ถูก tooltip บัง (แบบ qa #416 O-5) ไม่ได้มาจาก ADM-38 → ไม่ทำ (ไม่ patch library)
- ค้างจากรอบก่อน: ก่อน go-live (Stripe live นิติบุคคลไทย + PromptPay — spec 06 Q1, ค่าส่งจริงแทน ฿10 — spec 01 Q-F1, smoke test บน production, วัด OPS-26 ซ้ำบน staging) · กลุ่ม ข/ค ของหัวข้อปิดรอบ 38 และก่อนหน้าที่ยังไม่มี task คงไว้
### ง. บทเรียนกระบวนการ (session หลักพิจารณาเพิ่มใน `CLAUDE.md`/agent — planner ไม่แตะ)
- (builder #421) ตาราง `DataTable` ที่ไม่มีคอลัมน์ auto ตั้งแค่ `size`/`maxSize` ของคอลัมน์ข้อความยังเกิน 250px ได้แม้ที่ 1280 (ขั้น (2): 261.9px) — ทุก td ได้ width ผลรวมน้อยกว่าตาราง `w-full` แล้ว Chrome แจกส่วนเกินตามสัดส่วน
  → spec ที่จำกัดความกว้างคอลัมน์ต้องกำหนดคอลัมน์ auto คู่กันเสมอ ไม่ใช่เฉพาะจอกว้าง
- (review #420) red ขั้นแรกของ AC ต้องไม่ล้มที่ locator ที่ task จะเพิ่มเอง (เช่น wrapper testid ที่ develop ยังไม่มี) — ให้ red ขั้นแรก = develop + เฉพาะ locator นั้น แล้วล้มที่ assertion ของพฤติกรรม (qa #421 รันบน develop ตรงๆ จึงล้มที่ locator — ใช้เป็นหลักฐาน red ไม่ได้)

## follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 38)
ที่มา: review/qa/builder ของ #417–#418 (2026-11-19) — **ยังไม่เปิด task id** planner รอบถัดไปแปลงเป็น spec/task เมื่อ owner สั่ง · **[ถาม owner]** = ต้องให้ owner ตัดสินก่อน · ไม่มีข้อใดบล็อก release
**(ปิดรอบ 39, 2026-11-19) ☑**: ADM-38 #421 — ข้อ ก (1) และ ข ข้อแรกปิด (หัวข้อนี้ข้อ ก ครบ) · ข/ค ที่ยังไม่มี task คงไว้
**(รอบ 39, 2026-11-19) แปลงแล้ว**: ข้อ ก (1) owner ก → **ADM-38** (spec 08 กฎ 42, AC-43) · ข้อ ข ข้อแรก (review #418: `tag()` prefix, comment AF-14/กฎ 41a) รวมเข้า ADM-38 (กฎ 42f) · ข/ค ที่เหลือคงไว้
**แก้ในปิดรอบ 38 แล้ว (ไม่ต้องมี task)**: Q12 = ก บันทึกใน spec 08 กฎ 41c + แก้ตัวเลขช่องว่าง (review #417 ข้อ 1, review #418) · cart S2 ของ CORE-67 เพิ่มในข้อ cleanup ของหัวข้อปิดรอบ 37 กลุ่ม ข (review #417 ข้อ 2) ·
ข้อความ "☑ ครบในปิดรอบ 37"/"ตอบครบในปิดรอบ 37" ย้ายจากบรรทัดประวัติรอบ 37 ไปบรรทัดสถานะปิดรอบ 38 (review #417 ข้อ 3)
### ก. ต้องให้ owner ตัดสิน
1. **[ปิดรอบ 39: owner ก 2026-11-19 → ADM-38 ☑ #421]** **[ถาม owner] ตาราง Ledger คอลัมน์ Affiliate กว้างตามข้อความ (qa #418 O-2)** `routes/affiliate/page.tsx` `LedgerTable` (คอลัมน์ Created, Affiliate (`AffiliateCell` ร่วมกับ payouts), Order, Amount, Status — ไม่มีคอลัมน์ actions/เมนูต่อแถว)
   ไม่ตั้ง `size`/`maxSize` → affiliate ชื่อยาวทำให้คอลัมน์ Affiliate 2600px (ตาราง 3203px) ทุกความกว้างจอทั้งบน develop และ #418 → ต้องเลื่อนแนวนอนจึงเห็น Status (ไม่มีปุ่มถูกดันออกนอกจอ — spec 08 รอบ 38 ตัดไว้นอก scope) ·
   ทางเลือก: (ก) ทำแบบ ADM-37: คอลัมน์ `affiliate_id` `size`/`maxSize` 274 (tooltip "ชื่อ อีเมล" ของ `TruncatedCell` ได้จาก `{" "}` ของ #418 อยู่แล้ว) + คอลัมน์สุดท้าย Status `size: undefined` (แบบกฎ 41c) + e2e 1280/1920 ใน `admin-table-long-text.spec.ts` + qa
   ~5 LOC โค้ด + ~60 LOC test · (ข) คงเดิม — Ledger เป็นตารางอ่านอย่างเดียว ข้อมูลชื่อยาว 370 ตัวเป็นกรณีทดสอบ ไม่ใช่ข้อมูลจริงทั่วไป ·
   **Recommended: (ก)** — งานเล็ก ใช้ column option ของ `DataTable` แบบเดียวกับอีก 4 ตาราง (ไม่สร้าง component) ทำให้ทุกตารางของหน้า affiliate สม่ำเสมอ; ทำพร้อม nit ข้อ ข ในไฟล์ `admin-table-long-text.spec.ts` ได้ในครั้งเดียว
### ข. test hygiene / nit (planner จัดเป็น task เล็กได้เมื่อ owner สั่ง — ถ้า ก (1) = ก ให้รวมเข้า task นั้น)
- **[ปิดรอบ 39: ☑ ใน ADM-38 #421 — spec 08 กฎ 42f]** (review #418) `e2e/admin-table-long-text.spec.ts:23` `tag()` ใช้ prefix `adm35-` กับข้อมูลของ ADM-37 ด้วย → แยก/เปลี่ยนเป็น `adm37-` สำหรับ describe ของ ADM-37 · `components/affiliate/payouts-table.tsx:137–139` comment AF-14 เดิมติดกับ comment ใหม่ของกฎ 41a →
  แยกบรรทัด/จัดลำดับให้อ่านง่าย · comment กฎ 41c ซ้ำ 3 ไฟล์ — reviewer ยอมรับ ไม่ทำ
- (qa #418 O-1 — ข้อสังเกต ไม่ใช่ defect) payouts ที่ 1920 คอลัมน์สุดท้าย "Payout" ไม่รับส่วนเกินเพราะตารางกว้างพอดีเนื้อหา (293px) ส่วนเกินไปที่ Status/actions/Amount ที่ยังไม่ถึง 150 → ช่องว่างหลังปุ่ม 90–91px (ที่ 1280 = 24px) ไม่เกินความกว้างเริ่มต้นของคอลัมน์ actions — ยอมรับตามกฎ 41c ไม่ทำ
- (builder #418) ที่ 1280 ตาราง payouts 1414px, affiliates 1097px กว้างกว่ากล่อง (qa #416 O-2 — นอก scope, ปุ่มยังในจอ) คงไว้
- ข ของหัวข้อปิดรอบ 37 และ 36 ที่ยังไม่มี task คงไว้
### ค. backlog / ไม่ทำ (พร้อมเหตุผล)
- (qa #418 O-3) tooltip ชื่อไทยปนอังกฤษไม่มีช่องว่างสูงมาก อ่านได้ครบ — เดียวกับ qa #416 O-4 ไม่ทำ
- ค้างจากรอบก่อน: ก่อน go-live (Stripe live นิติบุคคลไทย + PromptPay — spec 06 Q1, ค่าส่งจริงแทน ฿10 — spec 01 Q-F1, smoke test บน production, วัด OPS-26 ซ้ำบน staging) · กลุ่ม ข/ค ของหัวข้อปิดรอบ 37 และก่อนหน้าที่ยังไม่มี task คงไว้
### ง. บทเรียนกระบวนการ (session หลักพิจารณาเพิ่มใน `CLAUDE.md`/agent — planner ไม่แตะ)
- ห้ามรัน `pnpm --filter storefront test:e2e:unit` พร้อมกับ e2e chromium ในโฟลเดอร์ `apps/storefront` เดียวกัน — trace ใน `test-results/.playwright-artifacts` ชนกัน (ENOENT) ทำให้ e2e ล้มโดยไม่ใช่ assertion
  (builder #418: `affiliate-admin-forms.spec.ts:381`/`:400` ล้มแล้วรันซ้ำผ่าน 3/3 — `ADM-37-tests.txt`); เพิ่มใน builder-common แล้ว (session หลัก) — รันทีละชุด
- คำถามที่ให้ตัวเลขประกอบการตัดสินใจ (เช่น Q12 ~290px) ควรระบุว่าเป็นค่าประมาณหรือผลวัด และวัดจริงก่อนถ้าทำได้ — ค่าประมาณส่วนเกินของคอลัมน์ต่างจากช่องว่างที่ผู้ใช้เห็น (479/421px)

## follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 37)
ที่มา: review/qa/builder ของ #411–#416 และผลวัด ADM-36 (2026-11-18/19) — **ยังไม่เปิด task id** (ยกเว้น ADM-37 ที่ owner สั่งแล้ว) · **[ถาม owner]** = ต้องให้ owner ตัดสินก่อน · ไม่มีข้อใดบล็อก release
**(ปิดรอบ 38, 2026-11-19) ☑**: ADM-37 #418 (Q12 = ก) — ข้อ ก (1) ปิด · ข/ค ที่ยังไม่มี task คงไว้
**แปลงแล้วในปิดรอบ 37**: qa #416 O-1/O-3 + builder #416 → **ADM-37** (spec 08 กฎ 41, AC-42; owner ก 2026-11-19) · qa #415 O-1 → owner คงเดิม (spec 01 หมายเหตุใต้กฎข้อ 125f) · ADM-36 ทาง (A) → Q11 = ก ปิด ·
แก้ถ้อยคำ spec แล้ว: ADM-35 กฎ 39a/39d/AC-40a (session หลัก 2026-11-18), tolerance กฎข้อ 124e (review #412/#415), review #411 nit (2)(3)(4)(5), review #414 (กฎข้อ 41i) — ไม่ต้องมี task · review #413 (static `restoreUsage` ไม่จับ handler หลัง spread และ `[^>]*` ตัดที่ `=>`) แก้แล้วใน #416 (ตัดแท็กแบบนับวงเล็บ `{}` — `ADM-35-tests.txt`) ·
review #411 nit (1) (ห้ามปิด ADM-36 จาก probe `MutationObserver` ลำพัง) ทำตามแล้ว — ผลวัดใช้การกดจริงแบบ qa #409 (0/16/50/100ms) ประกอบ
### ก. ต้องให้ owner ตัดสิน
1. **[ปิดรอบ 38: owner ก 2026-11-19 → ADM-37 ☑ #418]** **[ถาม owner] spec 08 Q12 — คอลัมน์ไหนรับความกว้างส่วนเกินใน ADM-37** คอลัมน์ actions อยู่กลางตารางใน programs/affiliates/payouts (ต่างจาก partners ที่อยู่ท้าย) ถ้าเป็น auto ที่ 1920 จะมีช่องว่างระหว่างปุ่ม `…` กับคอลัมน์ถัดไป
   (ปิดรอบ 38 แก้ตัวเลขตาม review #417: เดิม "~290px" — ผลวัดจริงใน `ADM-37-tests.txt` ทาง ข programs 479px, affiliates 421px; ทาง ก 122/122/91px) ·
   ทางเลือก: (ก) คอลัมน์สุดท้ายของแต่ละตารางเป็น auto แทน · (ข) actions เป็น auto ตามที่สั่ง · **Recommended: (ก)** — ช่องว่างไปอยู่ท้ายตารางแบบ partners ขนาดงานเท่ากัน AC เดิมใช้ได้ทั้งสองทาง; ไม่บล็อก ADM-37 (ไม่ตอบ = ทาง ข)
### ข. test hygiene / nit (planner จัดเป็น task เล็กได้เมื่อ owner สั่ง)
- (qa #412 O-2) ระหว่าง `updateLineItem` ของ Medusa GET เห็น `quantity` ใหม่แต่ adjustment เก่าชั่วครู่ → e2e ที่อ่านยอดหลังเปลี่ยน qty ต้องอ่านซ้ำจนนิ่ง (`toPass`) — ใช้เป็นแนวทางของ e2e ใหม่ (ยังไม่มี test ที่ล้มเพราะข้อนี้)
- (builder #412) cart ที่ e2e ของ CORE-66 สร้างไม่ถูกลบ · (review #417, เพิ่มในปิดรอบ 38) cart S2 ของ e2e CORE-67 (`core-67-sale-price-strikethrough.spec.ts`) ก็ไม่ถูกลบ · (review #408 เดิม) e2e AC-37b/c สร้างสินค้าไม่ลบ — รวมเป็นงาน cleanup ของ e2e ได้
- (review #414) test "fixed thb 499.99 (price list THB 100 is ignored)" ผ่านบน develop ด้วย (spec 04 กฎข้อ 41i) → แก้ชื่อ/comment ว่าเป็นการกันไว้ก่อน · AC-61 ใช้ headers ที่สร้างเองแทน `integration-tests/helpers/admin.ts`
- (review #415) `src/lib/util/line-item-compare-at.ts:15` ตรวจ `typeof === "number"` — ถ้า API ส่งจำนวนเงินเป็น string จะ fallback เป็นพฤติกรรมเดิมเงียบ ๆ (ควรใช้ `Number(...)` + `isFinite` หรือ test ครอบ) · e2e ของ CORE-67 ไม่ครอบ dropdown/375 (qa ครอบแล้ว)
- ข ของหัวข้อปิดรอบ 36 ที่ยังไม่มี task (review #407, #403, #402 ×2, builder #402 prettier, review #408) คงไว้
### ค. backlog / ไม่ทำ (พร้อมเหตุผล)
- (qa #412 O-4) preview แถว qty 1 "1x" อยู่บรรทัดบนลำพัง — อ่านได้ ไม่ล้น ไม่ทำจนกว่า owner ต้องการปรับ layout · (qa #415 O-2) `/cart` < `small` ซ่อนราคาต่อหน่วยทุก qty — พฤติกรรมของ starter ไม่ทำ
- (qa #413 O-2) Create pool บันทึกสำเร็จแล้ว focus ไป `BODY` เพราะปุ่มเปิดถูกแทนด้วย "Manage codes" — ตรงกฎ 38a ไม่ทำ · Edit program จาก `ActionMenu` focus `BODY` — Out of scope ของรอบ 37
- (qa #413 O-3) ฟอร์ม payout: Escape ตอนรายการ Combobox เปิด รายการค้างต้องคลิกนอก — ยังไม่ได้เทียบกับ develop → qa ตรวจบน develop ก่อนเปิด task (dialog ไม่ปิดตามกฎ 30c จึงไม่เสียข้อมูล)
- (qa #413 O-1 / ADM-34) Escape ระหว่าง animation เปิดของ `FocusModal` ถูกเพิกเฉย — ข้อจำกัดของ Radix (เดียวกับ qa #404 O-2) ไม่ทำ · (qa #416 O-4) tooltip ข้อความไทยไม่มีช่องว่างสูง ~20 บรรทัด อ่านได้ครบ ไม่ทำ
- (ADM-36 ผลวัด) customer groups ของ Medusa เองยังต้องกด Escape 2 ครั้ง (tooltip ของ `TruncatedCell` — อาการของ ADM-33 ใน upstream) — หน้าของ Medusa ไม่แก้ (ไม่ patch library)
- ค้างจากรอบก่อน: ก่อน go-live (Stripe live นิติบุคคลไทย + PromptPay — spec 06 Q1, ค่าส่งจริงแทน ฿10 — spec 01 Q-F1, smoke test บน production, วัด OPS-26 ซ้ำบน staging) · กลุ่ม ข/ค ของหัวข้อปิดรอบ 36 และก่อนหน้าที่ยังไม่มี task คงไว้
### ง. บทเรียนกระบวนการ (session หลักพิจารณาเพิ่มใน `CLAUDE.md`/agent — planner ไม่แตะ)
- spec ที่สั่งให้ e2e หาแถวด้วยการค้นหา `q` ต้องตรวจก่อนว่าตาราง (`enableSearch`) และ API ของ resource นั้นรับ `q` จริง — ADM-35 กฎ 39d เขียน `q` ทั้งที่ตารางปิด search และ partners API ไม่รับ `q` (session หลักต้องตีความระหว่างทาง); ทางที่ใช้ได้ทุกตาราง = `pageOffsetOf` + `?<prefix>_offset=`
- แก้ไฟล์ที่มีภาษาไทยด้วย `perl` ต้องใส่ `-Mutf8` (และ `-CSD`) ไม่งั้น regex ทำงานระดับ byte แล้วข้อความไทยเพี้ยน/ไม่ match
- ด่านวัดเทียบกับหน้าของ Medusa ต้องดูค่าฐานก่อน (ADM-36: customer groups มี tooltip กิน Escape แรกอยู่แล้ว ตัวชี้วัด "ค้างหลัง Escape ครั้งเดียว" จึงแยกผลไม่ได้ — ต้องนับ "จำนวน Escape จนปิด" แทน)

## follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 36)
ที่มา: review/qa/builder ของ #401–#409 (2026-11-18) — **ยังไม่เปิด task id** planner รอบถัดไปแปลงเป็น spec/task เมื่อ owner สั่ง · **[ถาม owner]** = ต้องให้ owner ตัดสินก่อน · ไม่มีข้อใดบล็อก release
**(ปิดรอบ 37, 2026-11-19) ☑ ครบ**: GB-18 #414, CORE-66 #412, CORE-67 #415, ADM-34 #413, ADM-35 #416, ADM-36 ☑ ผลวัด (ทาง A → Q11 = ก ปิด) — ข้อ ก (1)–(5) และ ข ที่รวมเข้า task ทำแล้วทั้งหมด
**(รอบ 37, 2026-11-18) แปลงแล้ว — owner ตัดสินครบ 2026-11-18 "ทำทุกข้อ"**: ก (1) = ก → GB-18 (spec 04 กฎข้อ 41, AC-61; กันตอนแก้ → Q23) · (2) = ข → CORE-66 (spec 01 กฎข้อ 124, AC-165) ·
(3) ทำ → ADM-34 (spec 08 กฎ 38, AC-39 — ตรวจแล้ว: ทั้ง 4 `FocusModal` ที่เปิดจากปุ่ม (partner, program, payout, pool) มีอาการเดียวกัน) · (4) ทำ → CORE-67 (spec 01 กฎข้อ 125, AC-166) ·
(5) ทำ → (b) ADM-35 (spec 08 กฎ 39, AC-40), (a) ADM-36 (spec 08 กฎ 40, AC-41 — ด่านวัดก่อนแก้; upstream → Q11) ·
ข ที่รวมเข้า task: review #406 → CORE-66 (กฎข้อ 124e) · review #404 + `optsOut` ของ review #409 → ADM-34 (กฎ 38e) · review #409 + qa #409 O-4 ที่เหลือ → ADM-35 (กฎ 39d) · ข ที่เหลือ (review #407, #403, #402 ×2, builder #402 prettier, review #408) คงไว้ ยังไม่มี task
### ก. ต้องให้ owner ตัดสิน
1. **[รอบ 37: owner ก → GB-18]** **[ถาม owner] เพดานส่วนลด fixed ของแคมเปญ group buy (qa #408 O-1)** `discount_value` แบบ fixed ไม่มีเพดานทั้งใน `campaignFormSchema` (spec 08 กฎ 36b กำหนดแค่ > 0) และ validator ของ backend → ใส่ `99999999999999999999` แล้ว backend ตอบ 200 สร้างแคมเปญส่วนลด 1e20 THB ได้จริง (admin เท่านั้น; แคมเปญเริ่มที่ `draft`; percentage มีเพดาน 100 อยู่แล้ว) ·
   ทางเลือก: (ก) backend ตอบ 400 เมื่อส่วนลด fixed ≥ ราคาของ variant ที่ร่วมแคมเปญ (ตรวจใน workflow สร้างแคมเปญ — ข้อจำกัด: `AdminUpdateGroupBuyCampaign` ไม่มีช่องส่วนลด และส่วนลดแก้ได้ที่หน้า promotion ของ Medusa ตรงๆ จึงกันได้แค่ตอนสร้าง ถ้าต้องกันตอนแก้ด้วยต้องหาจุดของ Medusa เช่น hook ของ promotion; error แสดงเป็น toast ตาม spec 08 กฎ 36e) ~80 LOC + integration ·
   (ข) เพดานคงที่ใน schema ของฟอร์มและ validator (เช่น ≤ `INT4_MAX` หรือค่าที่ owner กำหนด) ~20 LOC + unit — กันพิมพ์ผิดหลักใหญ่ได้ แต่ไม่กันส่วนลดเท่าราคาสินค้า · (ค) คงเดิม ·
   **Recommended: (ก)** — ความเสียหายจริงคือส่วนลด ≥ ราคา = ได้สินค้าฟรี ซึ่ง (ข) กันไม่ได้; ตอนวางแผนต้องตรวจว่า promotion ของ Medusa 2.22.1 จำกัด adjustment ไม่ให้เกินยอดของ line หรือไม่ (ถ้าไม่จำกัด ยอดอาจติดลบ ซึ่งทำให้ข้อนี้เร่งขึ้น)
2. **[รอบ 37: owner ข → CORE-66]** **[ถาม owner] preview ในขั้น review ของ checkout แถว qty 1 ยังแสดงราคาซ้ำ (qa #406 O-1)** CORE-65 แก้เฉพาะ `Item` ของ order; preview (`modules/cart/templates/preview.tsx` `items-table` → `cart/components/item` `type="preview"`) คงตามกฎข้อ 123d ของ spec 01 →
   แถว qty 1 แสดงราคาต่อหน่วย + ราคารวม (แถวที่ลดเห็นขีดฆ่าซ้ำสองชุด) ซึ่งเป็นปัญหาเดียวกับที่ owner ตัดสินให้แก้ในหน้า order ·
   ทางเลือก: (ก) คงเดิม · (ข) ใช้กฎข้อ 123a กับ `type="preview"` เท่านั้น (หน้า cart ที่แก้จำนวนได้ยังแสดงราคาต่อหน่วย) storefront ~10 LOC + e2e ·
   **Recommended: (ข)** — ลูกค้าเห็นราคาซ้ำตอนจะกดยืนยัน order; งานเล็กและไม่แตะ `LineItemUnitPrice`/`LineItemPrice`
3. **[รอบ 37: owner ทำ (ข) → CORE-67]** **[ถาม owner] price list แบบ sale ไม่มีราคาขีดฆ่าใน cart/order (qa #406 O-2)** `order_line_item.compare_at_unit_price` = 500 แต่ `LineItemPrice`/`LineItemUnitPrice` ของ starter เทียบแค่ `total` กับ `original_total` → แสดง ฿449.99 ไม่มีราคาเดิม (มีอยู่แล้วบน develop) ·
   ทางเลือก: (ก) คงเดิม · (ข) แสดงขีดฆ่าจาก `compare_at_unit_price` ใน cart/order (~40 LOC + e2e; ต้องตรวจว่า Store API ส่ง field นี้ทุกหน้า) ·
   **Recommended: (ก)** จนกว่าร้านจะใช้ price list แบบ sale จริง — flash sale ของเราใช้ promotion (ADR-003) ซึ่งแสดงขีดฆ่าอยู่แล้ว (qa ยืนยันในรอบนี้); ถ้า owner วางแผนใช้ price list แบบ sale ให้เลือก (ข)
4. **[รอบ 37: owner ทำ → ADM-34]** **[สั่งทำได้เลย — แก้เทคนิค ไม่ใช่การตัดสิน UX] ปิดฟอร์ม Create partner แล้ว focus ไปที่ `BODY` ไม่กลับปุ่ม "Create partner" (qa #404 O-1)** มีอยู่แล้วบน develop; ฟอร์ม Create campaign กลับปุ่มถูกเพราะ ADM-15 ใส่ `onCloseAutoFocus` (spec 08 กฎ 19b) ซึ่งครอบเฉพาะ `create-campaign.tsx` ·
   **Recommended**: เปิด task ใช้ pattern เดียวกับกฎ 19b กับ `FocusModal` ที่เปิดจากปุ่มใน `action` ของ `DataTable` (Create partner; ตรวจ Create program/payout และ Create pool ของ widget ตอนวางแผน) ~20 LOC + e2e ตรวจ `document.activeElement` — ไม่สร้าง component/hook ใหม่ (ผู้ใช้หลายที่แต่เป็น prop บรรทัดเดียว)
5. **[รอบ 37: owner ทำ → (b) ADM-35, (a) ADM-36]** **[ถาม owner] พฤติกรรมของ `DataTable` ที่เหลือหลัง ADM-33 (qa #409)** (a) O-2: กด Escape ภายในเฟรมแรกที่เมนูโผล่ยังค้าง (programs ค้าง 4/8 ที่ 0ms, 0/8 ที่ 16ms ขึ้นไป) ขณะที่ `/app/products` ของ Medusa ไม่ค้าง;
   (b) O-1: ชื่อยาวมาก (~370 ตัวอักษร) ทำให้ตารางกว้าง ~3000px และปุ่ม `…` หลุดนอก viewport (ต้องเลื่อนแนวนอน) — layout ของ `DataTable` ใน `@medusajs/ui` เหมือนบน develop ·
   ทางเลือก: (ก) คงเดิมทั้งสองข้อ · (ข) (a) หาสาเหตุใน `@medusajs/ui` แล้วแก้ (ไม่รู้ขนาด; อาจต้อง patch library ซึ่ง spec 08 ถือว่านอก scope มาตลอด) · (ค) (b) จำกัดความยาวชื่อ partner/program ที่ validator ของ backend + ฟอร์ม (เช่น ≤ 120 ตัวอักษร) ~30 LOC + test ·
   **Recommended: (ก)** — (a) คนกดไม่ทันภายใน 16ms และ e2e รอ animation จบอยู่แล้ว; (b) ชื่อจริงไม่ยาวขนาดนั้นและยังเลื่อนตารางไปกดได้ เปิด (ค) เมื่อมีข้อมูลจริงที่ยาวผิดปกติ
### ข. test hygiene / nit (planner จัดเป็น task เล็กได้เมื่อ owner สั่ง)
- (review #407) static `ci-workflow.unit.spec.ts:399` ไม่จับการลบ `exit 1` ในบล็อก `if [ -n "$found" ]` (`ci.yml:199–203`) → รันเนื้อ step กับ tmp dir แบบ test ของ OPS-15 · ชื่อ step `ci.yml:188` ยังลงท้าย "(OPS-27)" ทั้งที่ตรวจของ OPS-29 ด้วย
- (review #403) `tools/ci/assert-absent.test.sh` ตรวจจำนวนเคส 12 แบบตายตัว · รัน test นอก `<repo>/tools/ci` ต้องตั้ง `ASSERT_ABSENT=` (ไม่มีบอกใน comment) — ข้อ "static ไม่ตรวจ grep rc ≥ 2 ของ step OPS-15" ทำแล้วใน OPS-29 #407
- (review #402, ADM-30) self-check ของกฎ 34d ไม่ครอบ `expect.soft` ของจำนวน/`select count` · assert `count` `toBe(1)` match ทั้ง body ไม่ผูกกับ response ของคำค้นนั้น
- (builder #402) `prettier --check` ของ `e2e/core-46-e2e-hygiene.unit.spec.ts` และ `e2e/affiliate-admin-forms.spec.ts` ไม่ผ่านอยู่แล้วบน develop (ไม่อยู่ใน `pnpm lint`) — ตัดสินใจว่าจะให้ lint ครอบหรือจัดรูปแบบครั้งเดียว
- **[รอบ 37: → ADM-34]** (review #404) `src/admin/__tests__/medusa-ui.unit.spec.ts` (~`:929` ณ #404) regex `(\{[^}]*\}[^<]*)*` ซ้ำซ้อน/backtrack ได้ → `<Heading[^>]*>[^<]*<\/Heading>` · ชื่อ test "ครบ 5 จุด" แต่ใช้ `arrayContaining` (= อย่างน้อย)
- **[รอบ 37: → CORE-66]** (review #406 + builder) `e2e/core-65-order-item-unit-price.spec.ts:38–40` ปัด 2 ตำแหน่งแทนเทียบ ±0.01 (`toBeCloseTo`) · e2e ไม่ยกเลิก order 4 ใบที่สร้าง
- (review #408) e2e AC-37b/c สร้างสินค้าด้วย `createProduct` แต่ไม่ลบ
- **[รอบ 37: `optsOut` → ADM-34; ที่เหลือ → ADM-35]** (review #409 + qa #409 O-4) `e2e/admin-row-menu-escape.spec.ts:130` ตาราง affiliates หาแถวด้วย `tbody tr` ไม่ scope ด้วย testid ของตาราง · test partners หาแถวได้เพราะชื่อเรียงอยู่หน้าแรก (หน้าละ 20) — เปราะเมื่อ convention ชื่อเปลี่ยน ·
  regex `optsOut` `[^}]*` เปราะกับ object ซ้อน · comment ของ `waitMenuOpened` ไม่บอกว่าไม่มี animation แล้ว resolve ทันที · helper `settled` ที่ใช้ `getAnimations().finished` ตรงๆ → ใส่ `.catch` ทุกที่หรือรวมเป็น helper กลาง (builder เสนอ)
### ค. backlog / ไม่ทำ (พร้อมเหตุผล)
- (review #402) `balanced()` ไม่ข้าม string → backlog: เจอ string ที่มีวงเล็บแล้ว throw (ล้มดัง ไม่ผ่านเงียบ)
- (qa #404 O-2) Escape ระหว่าง animation เปิดของ `FocusModal` ถูกเพิกเฉยบางครั้ง → ข้อจำกัดของ Radix (แบบเดียวกับ qa #389 O-2/O-3) ปลอดภัย (ฟอร์มไม่ปิด) ไม่ทำ
- (qa #404 O-3) e2e ของ AC-36 ไม่ครอบ Edit program/Create pool → static ของ AC-36a ครอบและ qa ตรวจมือแล้ว ไม่ทำ
- (qa #408 O-2) ช่องบังคับว่างของฟอร์ม campaign ขึ้น product error ก่อน แล้ว "… is required" เป็น toast → พฤติกรรมเดิมของ `toCampaignBody` (Out of scope ของ spec 08 กฎ 36d) ไม่ทำจนกว่า owner ต้องการย้ายช่องบังคับไปใต้ช่อง ·
  (qa #408 O-3) `NumberInput` รับ `1e3` = 1000 เป็นจำนวนเต็มถูกต้อง ไม่ทำ · (review #408) e2e ไม่ตรวจข้อความ "at most 2147483647" → unit ครอบและ qa ยืนยันแล้ว ไม่ทำ
- (qa #406 O-3) โค้ดใช้ `quantity > 1` แทน `=== 1` → ผลเท่ากัน (line มี quantity ≥ 1) ไม่ทำ · (qa #409 O-3) ทางคีย์บอร์ดไม่ทำให้ develop ค้าง → ข้อสังเกตของการวัด ไม่ทำ
- (builder #402) evidence ไม่ระบุ `CI=1`/viewport 1280×720 → merge แล้ว ไม่แก้ · (review #401) OPS-28(d) ข้อความ error เมื่อ step test ไม่ได้รัน → ทำแล้วใน #403 · path/เลขบรรทัดใน spec 08 → แก้แล้วในปิดรอบ 36 · AC-44a ข้อ tsconfig exclude ผ่านอยู่แล้ว
- ค้างจากรอบก่อน: ก่อน go-live (Stripe live นิติบุคคลไทย + PromptPay — spec 06 Q1, ค่าส่งจริงแทน ฿10 — spec 01 Q-F1, smoke test บน production, วัด OPS-26 ซ้ำบน staging) · กลุ่ม ข/ค/ง ของหัวข้อปิดรอบ 32 และ 30/31 ที่ยังไม่มี task คงไว้
### ง. บทเรียนกระบวนการ (session หลักพิจารณาเพิ่มใน `CLAUDE.md`/agent — planner ไม่แตะ)
- เครือข่ายหลุด (`ENOTFOUND`) ทำให้ agent หยุดกลางทาง → resume ด้วย SendMessage ไปยัง agent เดิมได้ (context ยังอยู่) แต่ต้องตรวจ resource ที่ค้างก่อนสั่งต่อ (server/port, DB, Redis db, worktree, branch ที่ push ไปแล้วหรือยัง)
- builder/reviewer เรียก Skill tool ไม่ได้ (โหลด `building-with-medusa` ฯลฯ ไม่ได้) → ให้ตรวจ API จาก source/`.d.ts` ใน `node_modules/@medusajs/*` (แบบที่ ADM-33 ตรวจ `TruncatedCell`) หรือ `context7` แทน และระบุในคำสั่งงานแทนการสั่งให้โหลด skill

## follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 35)
ที่มา: review/qa ของ #398–#399 (2026-11-18) — **ยังไม่เปิด task id** · ไม่มีข้อที่ต้องให้ owner ตัดสิน
**(รอบ 36, 2026-11-18) แปลงแล้ว**: ข้อ ข (1) → OPS-28 (spec 07 AC-43; รวม step OPS-15 ที่ผ่านเมื่อไม่มี log — พบเพิ่ม) · (2) → OPS-29 (AC-44) · (3) → ADM-31 (spec 08 กฎ 35 — ไม่ใช่แค่ Create partner: ทุก `FocusModal` 5 จุดไม่มี `FocusModal.Title`) · (4) ✕ ปิด (ไม่มีผล) ·
nit #398 (แถว OPS-27 ใน spec 07 Depends เขียน "owner รับทราบ Q-O6") แก้แล้วในปิดรอบ 35 · บทเรียน "Redis ในเครื่องมี db 0–15" → ของ session หลัก (ไม่ใช่ task)
**(ปิดรอบ 36, 2026-11-18) ☑ ครบ**: OPS-28 #403, OPS-29 #407, ADM-31 #404
### ข. test hygiene / nit (ไม่เร่ง — planner จัดเป็น task เล็กได้เมื่อ owner สั่ง)
- (review #399) `.github/workflows/ci.yml` ขั้นตรวจ "Development Mode" ใน `docker-worker-mode` และ `storefront-e2e` ใช้ `if grep ...; then exit 1` → ผ่านเงียบเมื่อ grep คืน 2 (อ่านไฟล์ไม่ได้) ควร fail เมื่อ rc ≠ 1; static ใน `ci-workflow.unit.spec.ts` ไม่ตรวจว่า step fail จริง
- (builder/qa/review #399) ไฟล์ test ที่ compile แล้ว (`src/__tests__/*.unit.spec.js`) ติดไปใน `.medusa/server` และ image ที่ `/app/src/__tests__/` (มีมาก่อน OPS-27) → ตัดออกจาก output build/image; ระวังคำ `build-only` ใต้ `src/` ทำให้ขั้นตรวจ image แดง
- (qa #399 O-1) console error ของ Radix "`DialogContent` requires a `DialogTitle`" ในฟอร์ม Create partner (`FocusModal`) — a11y มีอยู่เดิม
- (review #398) REPORT ADM-22 ใช้ Node 22.23.3 แต่ Dockerfile pin 22.23.4 — ไม่มีผล ไม่ต้องแก้
### ค. ค้างจากรอบก่อน (ไม่มี task)
- ก่อน go-live: Stripe live นิติบุคคลไทย + PromptPay (spec 06 Q1), ค่าส่งจริงแทน ฿10 placeholder (spec 01 Q-F1), smoke test บน production, วัด OPS-26 ซ้ำบน staging · กลุ่ม ข ของหัวข้อปิดรอบ 34 และหัวข้อก่อนหน้ายังคงอยู่

## follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 34)
ที่มา: review ของ #395–#396 (2026-11-18) — **ยังไม่เปิด task id** · ไม่มีข้อที่ต้องให้ owner ตัดสิน
**(รอบ 36, 2026-11-18) แปลงแล้ว**: ข้อ ข ทั้ง 3 ข้อ → ADM-30 (spec 08 กฎ 34a/34b/34c, AC-35) — ☑ #402 (ปิดรอบ 36)
### ข. test hygiene / nit (ไม่เร่ง — planner จัดเป็น task เล็กได้เมื่อ owner สั่ง)
- (review #396) static `e2e/core-46-e2e-hygiene.unit.spec.ts:259` regex `.count … .toBe(1)` ผ่านแม้บรรทัด assert ถูก comment ไว้ → ตัดบรรทัดที่ขึ้นต้นด้วย `//` ก่อน match
- (review #396) static ไม่บังคับว่า predicate ของ `waitForResponse` ตรวจ `pathname === AFFILIATES` (กฎ 33b ตรวจโดย reviewer อย่างเดียว)
- (review #396) `e2e/affiliate-admin-forms.spec.ts:205` สร้าง `new URL(...)` ซ้ำใน predicate → ประกาศครั้งเดียว
### ค. ค้างจากรอบก่อน (ไม่มี task)
- ก่อน go-live: Stripe live นิติบุคคลไทย + PromptPay (spec 06 Q1), ค่าส่งจริงแทน ฿10 placeholder (spec 01 Q-F1), smoke test บน production, วัด OPS-26 ซ้ำบน staging (spec 07) — ดูบรรทัด "ก่อนเปิดร้านจริง (go-live)" ด้านบน
- ADM-22 พักไว้ (owner ยังไม่สั่งทำ) · กลุ่ม ข/ค/ง ของหัวข้อปิดรอบ 32 และ 30/31 ข้างล่างยังคงอยู่
  — (รอบ 35, 2026-11-18) ADM-22 ไม่พักแล้ว: ☑ ผลตรวจ → OPS-27 (spec 07), ADM-22b ✕; กลุ่ม ข ข้างบนยังไม่มี task

## follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 33)
ที่มา: review/qa/CI ของ #391–#393 (2026-11-17/18) — **ยังไม่เปิด task id** planner รอบถัดไปแปลงเป็น spec/task เมื่อ owner สั่ง · **[ถาม owner]** = ต้องให้ owner ตัดสินก่อน
**(รอบ 34, 2026-11-18) แปลงแล้ว — กลุ่ม ก ตัดสินครบ**: (1) Q-C11 = ก → คู่มือ + test อย่างเดียว (spec 01; ไม่มี task) · (2) → ADM-29 (spec 08 กฎ 33, AC-34) · กลุ่ม ข (static ของ ADM-28) → รวมใน ADM-29 (กฎ 33d); กลุ่ม ค คงไว้ด้านล่าง
### ก. ต้องให้ owner ตัดสิน
1. **[owner ตัดสิน ก 2026-11-18 → ไม่มี task]** **Q-C11 (spec 01 — ยังค้างจากรอบ 33)** กันลืมเปิดสวิตช์ `is_tax_inclusive` ของ promotion fixed เพิ่มจากคู่มือไหม:
   (ก) **[แนะนำ]** คู่มือ + test ของ CORE-64 อย่างเดียว (ไม่มีงานเพิ่ม) · (ข) widget เตือนที่หน้า detail ของ promotion (~60 LOC + e2e) · (ค) middleware ตอบ 400 บน `POST /admin/promotions(/:id)` (~100 LOC + integration + ADR; แตะ `src/api/middlewares.ts`)
2. **[owner สั่งเปิด task 2026-11-18 → ADM-29]** **test payout ใน `apps/storefront/e2e/affiliate-admin-forms.spec.ts` มีจุดอ่อนเดียวกับ ADM-28** (test "AC-12/AC-21: ฟอร์มสร้าง payout … ค้น affiliate รายที่ 250 ด้วย q" — tag `adm9${Date.now()}` `:170`, ค้น `"<tag> aff 249"` `:202–205`):
   `name`/`email` ของ affiliate เป็น `.searchable()` และ `q` แยกคำแล้ว AND → tag ที่บังเอิญมี "249" ทำให้ทั้ง 250 รายตรง, `aff 249` ไม่อยู่หน้าแรก → timeout 2 นาที (โอกาส ~1% ต่อ run) ·
   **แนะนำ**: แก้แบบเดียวกับ ADM-28 (tag ตัวอักษร + assert `count === 1` ของ response ที่ `q` ตรง) test-only ~15 LOC + static ใน `e2e/core-46-e2e-hygiene.unit.spec.ts`; ไม่บล็อก release
### ข. test hygiene / nit (planner จัดเป็น task เล็กได้เมื่อ owner สั่ง)
- **[รวมใน ADM-29 — รอบ 34]** (#393) static test ของ ADM-28 (`e2e/core-46-e2e-hygiene.unit.spec.ts:~244`) ตรวจแค่ว่าไม่มีข้อความเดิม `adm9${Date.now()}` — ไม่ได้ตรวจว่า tag ไม่มีตัวเลข (เขียน tag ตัวเลขรูปอื่นแล้วยังผ่าน) → ถ้าทำข้อ ก (2) ให้ตรวจแบบ "มีการแปลงตัวเลขเป็นตัวอักษร"/`count === 1` ครอบทั้งสอง test
### ค. ค้างจากรอบก่อน (ไม่มี task)
- ก่อน go-live: Stripe live นิติบุคคลไทย + PromptPay (spec 06 Q1), ค่าส่งจริงแทน ฿10 placeholder (spec 01 Q-F1), smoke test บน production, วัด OPS-26 ซ้ำบน staging (spec 07) — ดูบรรทัด "ก่อนเปิดร้านจริง (go-live)" ด้านบน
- ADM-22 พักไว้ (owner ยังไม่สั่งทำ) · กลุ่ม ข/ค/ง ของหัวข้อปิดรอบ 32 และ 30/31 ข้างล่างยังคงอยู่

## follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 32)
ที่มา: review/qa/CI ของ #383–#389 (2026-11-17) — **ยังไม่เปิด task id** planner รอบถัดไปแปลงเป็น spec/task เมื่อ owner สั่ง · **[ถาม owner]** = ต้องให้ owner ตัดสินก่อน
**(รอบ 33, 2026-11-17) แปลงแล้ว — กลุ่ม ก ตัดสินครบ**: (1) = ก → CORE-64 (spec 01 กฎข้อ 122, AC-163; คำถามต่อ Q-C11) · (2) = ข คงเดิม → ยอมรับใน v1 (spec 01 กฎข้อ 121b, ไม่มี task) ·
(3) = ก หยุด → รายการก่อน go-live (spec 07 ท้าย "Follow-up รอบ 32", ROADMAP "ก่อนเปิดร้านจริง"; ไม่มี task) · (4) → ADM-28 (spec 08 กฎ 32, AC-33) · (5) คงเดิม → ยอมรับใน v1 (spec 01 กฎข้อ 115, ไม่มี task);
กลุ่ม ข/ค/ง ยังไม่มี task (คงไว้ด้านล่าง)
**(รอบ 36, 2026-11-18) triage กลุ่ม ข**: "unit ของกฎข้อ 119c vacuous" (#388) → ADM-30 (spec 08 กฎ 34d — ยืนยันบน `14837f04`: ผ่านแม้ลบ cleanup) ·
ที่เหลือ **เก็บ backlog ไม่เปิด task** — `sql()` มีสำเนา ~15 ไฟล์ (ไม่ใช่ 3) รวมแล้วแตะไฟล์กว้างโดยไม่แก้บั๊ก; fs19 ล้มครั้งเดียว (run 43469877641 — ข้อ `:194` ของหัวข้อปิดรอบ 30/31 คือ run เดียวกัน) ไม่เกิดซ้ำ → เปิดเมื่อซ้ำ;
comment `SERVER_READY` ใน `tools/load/run.sh` + unset `DATABASE_POOL_MIN` (review #371) → รวมกับ PR ถัดไปที่แตะ `tools/load/run.sh`; comment `itemDiscounted`, บรรทัดว่างซ้ำ, test 2147483647 ของ e-voucher create/ชื่อ field ของ affiliate update → รวมกับ PR ถัดไปที่แตะไฟล์นั้น;
ADM-27 ปุ่ม Cancel/ปิดระหว่างบันทึก (#383/qa #389 O-5) — ยังไม่มีอาการที่ทำซ้ำได้ → backlog · กลุ่ม ค/ง คงเดิม
### ก. ต้องให้ owner ตัดสิน
1. **[owner ตัดสิน ก 2026-11-17 → CORE-64]** **(สำคัญ) promotion แบบ fixed บนสินค้าราคารวม VAT ได้ส่วนลดต่างจากที่ตั้ง ~7% (qa #384 O-1)** Medusa คิดจำนวน fixed เป็นยอด**ก่อน VAT** ตาม `is_tax_inclusive` ของ promotion (ค่าเริ่มต้น false)
   ขณะที่ราคาในร้านรวม VAT → `discount_total` ที่ลูกค้าเห็นไม่เท่าจำนวนที่ admin ตั้ง — กระทบการตั้งโปรจริงทุกตัว · **แนะนำ**: ร้านตั้ง promotion แบบ fixed ด้วย `is_tax_inclusive: true` เสมอ
   (ตั้งค่า ไม่สร้างของใหม่) แล้วเปิด task เล็กใน spec 01/03: ตรวจว่า form promotion ของ dashboard 2.22.1 ตั้งค่านี้ได้หรือไม่ + บันทึกในคู่มือ ops + e2e ตรวจยอดส่วนลดเท่าที่ตั้ง (percentage ไม่กระทบ)
2. **[owner ตัดสิน ข คงเดิม 2026-11-17 → ยอมรับใน v1]** **ลบเบอร์โทรในหน้าบัญชีไม่ได้ (qa #386 O-2)** ล้างช่อง phone แล้วบันทึก → เบอร์เดิมยังอยู่แต่ขึ้นว่าบันทึกสำเร็จ (ตรงกฎข้อ 121b ของ spec 01 ที่คงพฤติกรรมเดิม "ไม่ส่ง key") ·
   **แนะนำ**: ให้ลบได้ — ส่ง `phone: ""` เมื่อผู้ใช้ล้างช่อง (แก้กฎข้อ 121b; storefront ~10 LOC + unit + e2e 1 เคส)
3. **[owner ตัดสิน ก หยุด 2026-11-17 → รายการก่อน go-live]** **OPS-26 ต่อหรือหยุด** ผล 1 vs 2 process บน runner ร่วมแยกผลไม่ออก (spec 07 "ผล OPS-26") — ทางเลือก: หยุดแค่นี้ / วัดบน staging ที่แยก k6 ออกจาก stack / profile CPU ต่อ request ของ checkout (Q-O5 ทาง ข) ·
   **แนะนำ**: หยุดแค่นี้ แล้ววัดบน staging เป็นข้อหนึ่งของ go-live (ตอนนี้ไม่มี staging; gate ความถูกต้องผ่านทุก run, p95 เป็น "รายงานอย่างเดียว" ตาม Q-O3 a)
4. **[owner สั่งเปิด task 2026-11-17 → ADM-28]** **flaky `affiliate-admin-forms.spec.ts:47` AC-12 เกิดซ้ำครั้งที่ 2** (#373 run 43475980049; #388 run 44071909424 ขั้น "พิมพ์ชื่อ collection ลำดับที่ 250" timeout 2 นาที) — spec 01 รอบ 32 ตกลงว่า "เปิด task เมื่อเกิดซ้ำ" ·
   **แนะนำ**: เปิด task test-only หาสาเหตุ (อ่าน trace/log ของ run 44071909424 ก่อน artifact หมดอายุ 14 วัน) — ไม่บล็อก release แต่ทำให้ CI ของ PR อื่นแดงสุ่ม
5. **[owner ตัดสิน คงเดิม 2026-11-17 → ยอมรับใน v1]** **ลดค่าส่ง 100% แสดง "ค่าจัดส่ง ฿10" + "ส่วนลด −฿10" แยกกัน (qa #384 O-2)** ตรงกฎข้อ 115 ของ spec 01 (แถวค่าส่งใช้ `original_shipping_total`, ส่วนลดรวมใน `discount_total`) ยอดรวมถูก ·
   ทางเลือก: คงเดิม / แสดงแถวค่าจัดส่งเป็น "ฟรี" เมื่อส่วนลดค่าส่งเท่าค่าส่ง · **แนะนำ**: คงเดิม (สูตร subtotal − ส่วนลด + ค่าส่ง = ยอดรวม ตรวจได้ทุกแถว; เปลี่ยนแล้วต้องแยกส่วนลดค่าส่งออกจาก `discount_total`)
### ข. test hygiene / nit (planner จัดเป็น task เล็กได้เมื่อ owner สั่ง)
- (review #387) `evoucher-admin.spec` เคส 2147483647 → 200 ทดสอบเฉพาะ update (AC-60(d) เขียนทั้งสร้าง/แก้) · affiliate update ไม่ assert ชื่อ field ใน error
- (review #388) `evoucher-admin-pool-page.spec.ts:25-26` บรรทัดว่างซ้ำ · `sql()` ใน e2e มี ≥ 3 สำเนา → `e2e/support/` · unit ของกฎข้อ 119c vacuous (ผ่านได้แม้ไม่มีโค้ดที่ตรวจ)
- (#388) fs19 ล้มใน run 43469877641 ที่ `:199` (timeout 30s ไม่ใช่ `:245`) — ไม่แก้ใน CORE-61; เปิด task ถ้าล้มซ้ำ
- (review #385) `tools/load/run.sh` comment `SERVER_READY` "รวมที่ cluster fork ใหม่" ไม่ตรง 2.22.1 (fork ใหม่ไม่บูต) → แก้ comment
- (review #384) comment `itemDiscounted` ใน `cart-totals/index.tsx` ระบุเพิ่มว่า guard `discount_total` ไม่เปลี่ยนพฤติกรรมกับข้อมูลจริง (spec แก้แล้วในกฎข้อ 120a)
- (review #383) ADM-27: ปุ่ม Cancel ที่เรียก `setOpen(false)` ตรงต้องผ่าน hook — ตรวจว่า #389 ครอบทุกฟอร์มหรือยัง · (qa #389 O-5) ปิดฟอร์มระหว่างบันทึกของ create campaign/pool/payout/program ยังไม่มี e2e
- ข้อที่เหลือของกลุ่ม ข ในหัวข้อปิดรอบ 30/31 ข้างล่าง (ที่ไม่ได้รวมใน CORE-61) ยังคงอยู่
### ค. ข้อจำกัด/พฤติกรรมที่บันทึกไว้ (ยังไม่เสนอ task)
- (qa #389 O-2/O-3) Radix: คลิกนอกทันทีหลัง "Continue editing" หรือระหว่าง animation เปิด ถูกเพิกเฉย 1 ครั้ง (ปลอดภัย — ฟอร์มไม่ปิด)
- (#386) checkout digital-only ส่ง `company`/`province`/`phone` เป็น `""` แทน `null` (ตรงกฎข้อ 121a)
- (review #385) `medusa start --cluster` ของ 2.22.1 ต้องคู่ `--servers` และ fork ใหม่ตอน process ตายไม่บูต (`start.js:311–314`) — บันทึกใน spec 07 แล้ว; ถ้าจะใช้ใน prod ต้องอยู่ใน ADR
### ง. บทเรียนกระบวนการ (session หลักพิจารณาเพิ่มใน `CLAUDE.md`/agent — planner ไม่แตะ)
- เครื่องมือ Write/Edit แปลง escape แบบ backslash-u สี่หลักใน markdown เป็นอักขระ zero-width ดิบ (เกิดใน CORE-58 REPORT และ AC-162) → สแกนอักขระ U+200B/200C/200D/2060/FEFF ก่อน commit (perl);
  เขียนผ่าน Write/Edit ด้วยรูป `\u{XXXX}` (ไม่ถูกแปลง) แล้วใช้ perl แปลงเป็นรูปสี่หลักภายหลัง (ทำในปิดรอบ 32) หรือแก้ด้วย perl โดยตรง

## follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 30/31)
ที่มา: review/qa ของ #366–#381 (2026-11-13/14) — **ยังไม่เปิด task id** planner รอบถัดไปแปลงเป็น spec/task เมื่อ owner สั่ง · **[ถาม owner]** = ต้องให้ owner ตัดสินก่อน
**(รอบ 32, 2026-11-17) แปลงแล้ว**: กลุ่ม ก (1) → GB-17 · (2) → spec 07 Q-O5 = ก → OPS-26 · (3) → spec 08 Q9 = ก → ADM-27 · (4) → CORE-62 (owner ตัดสิน) · (5) → spec 01 Q-C10 = ก → CORE-63 · (6) → spec 08 Q10 = ก คงเดิม (ไม่มี task);
`tools/load/run.sh` ไม่ unset `DATABASE_POOL_MIN` (review #371) → รวมใน OPS-26 ได้ถ้าเล็ก;
กลุ่ม ข: `group-buy-join.spec.ts:86`, fs19, `PAGINATION_TEXT`, AC-44 (`e2e-af12c-*` + `toHaveCount(0)` ของ `pat`) → CORE-61; `affiliate-admin-forms.spec.ts:47` และ `waitForTimeout(1_000)` ของกฎ 24d → ยอมรับ/รอเกิดซ้ำ (spec 01 รอบ 32);
ข้อที่เหลือของกลุ่ม ข/ค/ง ยังไม่มี task (คงไว้ด้านล่าง)
**(รอบ 36, 2026-11-18) triage ข้อที่เหลือ**: กลุ่ม ข ที่เหลือ (`evoucher-admin-forms.spec.ts:255` ไม่กำหนด `order`, Escape ของ `group-buy-admin-form` ไม่ assert POST, regex `group-buy-pages.unit.spec.ts:113`, `slowLoader` ซ้ำ/RegExp ไม่ escape, `statuses.at(-1)`,
401 ของแท็บ affiliate อื่น, Escape ทันทีหลัง mount ของ Create partner) → **เก็บ backlog** — ยังไม่เคยล้มใน CI และไม่ใช่ static ที่ผ่านเงียบ; เปิด task เมื่อล้มหรือเมื่อ PR แตะไฟล์นั้น ·
กลุ่ม ค (UX) → **ทางเลือกของ owner** (ไม่บล็อก): ไม่เปิด task จนกว่า owner สั่ง — แนะนำเก็บไว้จนมี feedback ของผู้ใช้จริงหลัง go-live; ถ้าจะทำก่อน planner ต้องตรวจซ้ำบน develop ล่าสุดก่อน (ข้อสังเกตบันทึกก่อน ADM-15/ADM-24 ซึ่งแก้ฟอร์มไปแล้ว) · กลุ่ม ง คงเดิม
**(รอบ 36 ส่วนที่ 2, 2026-11-18) triage กลุ่ม ค แล้ว** — owner ตอบ ข "ตรวจซ้ำบน develop แล้วเปิด task เฉพาะข้อที่ยังจริง"; qa ตรวจบน `8425a53f` (prod build):
ฟอร์ม campaign error เป็น toast → **ADM-32** (spec 08 กฎ 36, AC-37) · ข้อความ 400 ของ `status` (zod union) → **✕ ปิด** (UI ทำให้เกิดไม่ได้; `/admin/products` ของ Medusa ข้อความเดียวกัน) ·
Escape 2 ครั้งของเมนูต่อแถว → **ADM-33** (spec 08 กฎ 37, AC-38 — ต้นเหตุ `TruncatedCell` tooltip ของ `@medusajs/ui`) · ราคาซ้ำหน้า order-completed → owner ก 2026-11-18 → **CORE-65** (spec 01 กฎข้อ 123, AC-164) ·
`data-value` float → **✕ ปิด** (ยอมรับแล้ว spec 01 รอบ 30) · บรรทัด "ยอมรับ/ข้อจำกัดภายนอก" ของกลุ่ม ค คงเดิม (ไม่มี task)
### ก. ต้องให้ owner ตัดสิน
1. **[ถาม owner] bug จริง (qa #374 D-1)** `POST /admin/group-buy/campaigns` ค่าเกิน int4 (เช่น `max_total_orders` 2147483648) → 500 `integer out of range` เพราะ validator ยอมถึง `MAX_SAFE_INTEGER` — **แนะนำเปิด task backend ใน spec 04** (จำกัด ≤ 2147483647 → 400 + test) ไม่บล็อกข้อมูล (admin เท่านั้น)
2. **[ถาม owner] งาน CPU ของ checkout (OPS-23 #371)** server CPU เต็ม ~115% ทุกค่า pool และ (d)/(e) ไม่ลดด้วย pool → ทางที่น่าจะลดคือเพิ่ม CPU ฝั่ง server (หลาย process/replica) หรือลดงาน CPU ต่อ request — เป็น infra/scale ใหม่ ต้องมี AC + ADR (spec 07) ก่อน
3. **[ถาม owner] prompt ก่อนปิดฟอร์มที่ dirty (qa #379 O-1)** Tab ออกจาก combobox แล้ว Escape → modal ปิดค่าหาย (ตรงกฎ 30c ของ spec 08) — ถ้าต้องการกันต้องเป็นนโยบายใหม่ "ถาม `usePrompt` ก่อนปิด `FocusModal`/`Drawer` เมื่อฟอร์ม dirty" (กระทบทุกฟอร์ม admin)
4. **[ถาม owner] ป้าย "ยอดรวมสินค้าก่อนส่วนลด" เมื่อลดแค่ค่าส่ง (qa #372)** ตรง spec 01 กฎข้อ 118a/AC-159 (เงื่อนไข `discount_total > 0`) แต่ลูกค้าอาจงงเพราะสินค้าไม่ได้ลด — ทางเลือก: คงเดิม / ใช้เงื่อนไขส่วนลดของสินค้าเท่านั้น
5. **[ถาม owner] zero-width ที่เหลือ (#369 CORE-58)** ช่องไม่บังคับ (company/province/phone) ยังไม่ตัด zero-width, ฟอร์ม `/account/addresses` และ validation ฝั่ง backend อยู่นอก scope ของกฎข้อ 116 — เสนอ task ต่อ (qa #369 O-2: ช่องที่มีแต่ ZWSP ยังเก็บค่าไว้หลัง error)
6. **[ถาม owner] error ที่หน้า ≥ 2 (qa #381)** ไม่มีปุ่ม Prev/ลองใหม่ (ปุ่มลองใหม่อยู่นอก scope กฎ 24e ของ spec 08) — UX task ถ้าต้องการ
### ข. test hygiene / flaky (planner จัดเป็น task เล็กได้เมื่อ owner สั่ง)
- storefront e2e: `group-buy-join.spec.ts:86` flaky 2/4 บน prod build ในเครื่อง → `waitForServerAction` (กฎข้อ 101) (qa #369 O-1) · CI flaky ที่ไม่เกี่ยว PR — `flash-sale-fs19.spec.ts:194` (run 43469877641), `affiliate-admin-forms.spec.ts:47` (run 43475980049): เปิด task ถ้าซ้ำ
- admin e2e: `evoucher-admin-forms.spec.ts:255` หา partner บนหน้าแรกแต่ GET ไม่กำหนด `order` (review #373) · `group-buy-admin-form` ขั้น Escape ไม่ assert ว่าไม่มี POST เพิ่ม + regex `group-buy-pages.unit.spec.ts:113` แน่นเกิน (review #374) ·
  `affiliate-admin-payout-create.spec.ts:86-92` `toHaveCount(0)` ผ่านก่อน render → assert response `affiliates=[]` (review #375) · e2e AC-44 (`e2e-af12c-ann/sue`) ไม่ลบข้อมูลหลังจบ (qa #375) ·
  `evoucher-admin-pool-page.spec.ts:394-400` หน่วง loader inline ซ้ำ `slowLoader` ของ AC-7 (ผู้ใช้ 2 ที่ → helper) และ `:408` RegExp ไม่ escape (review #377) · `statuses.at(-1)` ถูกเฉพาะการเลือกครั้งแรก (qa #377 O-3) ·
  `PAGINATION_TEXT` ซ้ำ 4 ไฟล์ → `e2e/support/` และ `waitForTimeout(1_000)` ใน test 24d (review #381) · 401 ของแท็บ affiliate programs/affiliates/ledger ยังไม่มี e2e (มีแค่ payouts — qa #381) ·
  evoucher "Create partner" กด Escape ทันทีหลัง mount ไม่ปิด (race ของ test? ตรวจซ้ำบน develop — qa #379 O-2) · รูป `02-partners-bad-offset-create-modal.png` ถ่ายตอน FocusModal ยัง fade-in (review #380 — evidence merge แล้ว ไม่ต้องแก้)
- `tools/load/run.sh` ไม่ unset `DATABASE_POOL_MIN` — ค่าค้างใน shell รั่วได้เฉพาะรันในเครื่อง (review #371)
### ค. UX/พฤติกรรมที่บันทึกไว้ (ยังไม่เสนอ task)
- **[รอบ 36 ส่วนที่ 2: → ADM-32 / ✕ zod union]** ฟอร์ม campaign: ค่าติดลบ/ทศนิยม/0 แสดงเป็น toast ไม่ใช่ใต้ช่อง (ต่างจาก "e") และ 400 จาก backend เป็น toast ข้อความดิบ (qa #374 O-1) · ข้อความ 400 ของ `status` ผิดมาจาก zod union อ่านยาก (qa #375)
- **[รอบ 36 ส่วนที่ 2: → ADM-33]** เมนูต่อแถว `PartnerActions`/`ProgramActions` เปิดแถวอื่นต่อจากแถวเดิมต้องกด Escape 2 ครั้ง (radix popper wrapper ค้าง; `/app/products` ของ Medusa ไม่เป็น — ตรวจต้นเหตุก่อน, มีก่อน #373)
- **[รอบ 36 ส่วนที่ 2: → CORE-65 / ✕ `data-value`]** หน้า order-completed แถวสินค้าแสดงราคาซ้ำสองชุด (ของเดิม — qa #372) · `total` ใน `data-value` เป็น float ดิบ (เช่น 10.000000000000005) — แนวเดียวกับที่ยอมรับใน spec 01 รอบ 30 (qa #372)
- ยอมรับ/ข้อจำกัดภายนอก: error ของ query `selectedValue` ใน `useComboboxData` ไม่ถูกส่งออกจาก hook ของ dashboard → 401 ตรงนั้นไม่ไป `/login` (ADM-24) · Safari ไม่ focus ปุ่มตอนคลิกเมาส์จึงไม่คืน focus (คีย์บอร์ดได้ — ADM-15) ·
  ไม่มี index `affiliate.status`/`name` (backlog รอวัด — review #375)
### ง. บทเรียนกระบวนการ (session หลักพิจารณาเพิ่มใน `CLAUDE.md`/agent — planner ไม่แตะ)
- builder ต้องรัน `pnpm --filter storefront test:e2e:unit` ทั้ง project ก่อน push (hygiene test จับ `request.delete` ที่ไม่ตรวจ ok — เคยรายงานว่าผ่านแต่ไม่ได้รัน)
- harness ไม่ให้ builder เขียน `REPORT.md` เช่นเดียวกับ qa (OPS-23) → ส่งเนื้อหาให้ session หลัก commit

