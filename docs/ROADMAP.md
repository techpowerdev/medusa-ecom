# ROADMAP — milestone, ลำดับ PR, สถานะ

สัญลักษณ์: ☐ ยังไม่ทำ · ◐ อยู่ใน PR · ☑ merge เข้า develop แล้ว · 🚀 release แล้ว · ✕ ปิด (owner ไม่ทำ / ไม่ต้องทำ) · ⏸ เลื่อนหลัง v1.0
แต่ละแถว = 1 PR เข้า `develop` แถวที่ทำคู่ขนานได้มีเครื่องหมาย ∥ และ builder หลายตัวสร้างพร้อมกันได้
**ปิดรอบ 26 (2026-11-09, เอกสารล้วน) — สถานะล่าสุด**: merge เข้า develop แล้วถึง #328 — #308 เอกสาร sync รอบ 25, CORE-50 #309, CORE-19f #310, ADM-11 #311, CORE-49 #312, ADM-12 #313, CORE-4j #314, ADM-10 #315, ADM-8b #316, OPS-20b #318, OPS-5 #319, EV-7d #320, ADM-13 #321, ADM-9 #322, #323 spec รอบ 26, #324 hotfix ADM-10 (`PageOffsetGate`), OPS-21 #325, EV-15 #326, ADM-14 #327, CORE-51 #328 (#317 draft พิสูจน์ของ CORE-49 ปิดโดยไม่ merge) ·
**เงื่อนไข release v0.1.0 ครบ** (OPS-21 ☑, EV-15 ☑; `develop → main` owner เป็นผู้ merge) · งานที่เหลือ ☐ ไม่บล็อก release: CORE-52, CORE-53, CORE-54, GB-16, OPS-22, OPS-23, OPS-24, ADM-15..19 ·
ก่อนเปิดร้านจริง: Q-F1 ค่าส่ง ฿10 เป็น placeholder (ข้อ 5) และ spec 06 Q1 ยืนยันบัญชี Stripe ไทย/PromptPay (ข้อ 6) อยู่ใน go-live checklist ของ `docs/ops/production.md`; ลด AC-15 ของ spec 08 กลับเป็น ≤ 2 (Q8) อยู่ใน checklist bump `@medusajs/*` ข้อ 9 ของ spec 07 ·
**รอบ 26 (2026-11-09, เอกสารล้วน)** — follow-up จาก review/qa รอบ 25: **บล็อก release v0.1.0: OPS-21, EV-15** · ไม่บล็อก: OPS-22, CORE-52 (← #320), CORE-53, GB-16, ADM-15 (← #321), ADM-16, ADM-17 (← #322) · OPS-23 (← OPS-20b) · owner ตัดสิน 2026-11-09: Q-O4 = ก, Q8 (spec 08) = ก, Q12 = ก และ Q13 = ก (spec 02; ADR-021 accepted — EV-15 เริ่มได้เมื่อ PR รอบนี้ merge), OPS-22 ปรับประโยคใน `CLAUDE.md` ·
**สถานะรอบ 25 (2026-11-09)** — merge เข้า develop แล้วถึง #307 (train #307 รอบ 24: CORE-48 #300, CORE-4i-b #305, ADM-7 #301, ADM-5 #302, ADM-8a #304), **ไม่มี PR เปิด** ·
sync สถานะที่ค้างเป็น ☐/◐: CORE-25 #199, CORE-9b #200, EV-N2 #201, CORE-10c #202, GB-9 #196, AF-17 #207, GB-10 #208, CORE-26 #209, FS-19 #211, CORE-15b #213, CORE-23c #214, AF-15 #215,
FS-18 #216, EV-7e #217, CORE-9c #218, EV-N3 #219, CORE-4i (#222 4i-a + #305 4i-b) ·
**งานที่ owner สั่งรอบ 2026-11-09 เสร็จครบ** (CORE-4j, CORE-5d, CORE-19f, CORE-49, CORE-50, CORE-51, EV-7d, ADM-8b, ADM-9..14, OPS-5, OPS-20b) ·
**owner ตัดสิน 2026-11-09**: spec 02 Q1–Q3 = ยืนยันค่าเริ่มต้น (PIN optional, วันหมดอายุต่อ code ในคอลัมน์ CSV optional, code จาก order ที่คืนเงินไม่นำกลับมาขาย) ·
spec 06 Q1 ยังไม่ยืนยัน — ใช้ Stripe test mode ต่อ, ยืนยันนิติบุคคลไทย + PromptPay เป็นข้อ 6 ของ go-live checklist (`docs/ops/production.md`) · spec 01 Q-F1 คง ฿10 placeholder (ยังอยู่ใน go-live checklist)

(ประวัติ) สถานะตาม PR #1–#185 (2026-10-28, **รอบ 12** — ข้อมูลจาก session หลัก): merge แล้วถึง #185 — รอบนี้ #148 FS-14, #149 EV-N1, #150 CORE-14f, #151 CORE-19b, #152 spec รอบ 11,
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
**รอบ 17 กำลังทำ (◐)**: CORE-28 #241, OPS-17b #242, CORE-32 #243, GB-12 #244, GB-N4 #246, GB-14 #247 ·
**owner ตัดสินรอบ 17 (2026-11-04)**: spec 04 Q22 = (ก) ไม่ปฏิเสธ join ที่ไม่มีวิธีส่งเลย (กฎข้อ 35c) · หน้า orders เมื่อโหลด group orders ล้มไม่แสดง `no-orders-container` (กฎข้อ 32e1, AC-51 — ใน GB-12 #244) ·
task ใหม่จาก review/qa รอบ 17: spec 01 CORE-33 (← #243) · CORE-34 (← #241) · spec 04 GB-N5 (← #247, #246) · spec 07 OPS-17c (← #242; ก่อน OPS-20b) · ไม่มีคำถามค้าง
**รอบ 18 (2026-11-04)**: merge แล้วผ่าน merge train — train #248: CORE-28 #241, OPS-17b #242, CORE-32 #243 · train #250: GB-12 #244, GB-N4 #246, GB-14 #247 ·
train #256: CORE-28b #251, CORE-34 #252, OPS-17c #253, CORE-31 #254, CORE-33 #255 · train #260: GB-N5 #257, CORE-30 #258 · เปิดอยู่ (◐): GB-13 #259 (train #261), CORE-29 (กำลังทำ) ·
task ใหม่จาก review/qa รอบ 17–18: spec 01 **CORE-35** (delivery "เสร็จ" ใช้ option ที่เลือกในรายการที่กรองแล้ว — **ควรก่อน v0.5.0**) ∥ CORE-36 (ปุ่มลบโค้ด) ∥ CORE-37 (ปุ่มคัดลอก/การ์ด voucher)
∥ CORE-38 (layout 375px: สรุปที่อยู่ + label ลอย) · CORE-39 (← CORE-29: nit `return_to`) · spec 04 GB-N6 (← GB-13 #259: toast ใน e2e admin + test error หลัง lock) ·
แก้ถ้อยคำ spec 04 กฎข้อ 36b/AC-55 (core-flows 2.22.1 ลบเฉพาะ method ที่ profile ชน + refresh ทิ้ง method ของ profile ที่ไม่มี item ใช้) และ AC-52 (e2e admin `page.route` แทน component test) · ไม่มีคำถามค้าง
**รอบ 19 (2026-11-04 — owner สั่ง "เปิดเลย")**: merge แล้วผ่าน merge train — train #261: GB-13 #259 · train #268: CORE-29 #263, CORE-36 #264, CORE-37 #265 ·
train #270: CORE-35 #266, CORE-38 #267, GB-N6 #269 · train #272: CORE-39 #271 — GB-N6 ข้อ (a) ปิดโดย #259 (commit `016f204`); CORE-38 ข้อ (b) ปิดโดยไม่แก้โค้ด (ภาพ qa-04 ของ #258 เป็นภาพกลาง transition — spec 01 กฎข้อ 96b) ·
task ใหม่: spec 01 **CORE-40** (bug: ใส่โค้ดระหว่างลบโค้ดทำให้โค้ดที่ลบกลับมา — **ควรทำก่อน**) ∥ CORE-41 (`?step=payment`/`review` ไม่มีที่อยู่ → `step=address`) ∥ CORE-42 (ตาราง cart 375 + ช่องว่างแถวรหัส voucher)
∥ CORE-43 (test hygiene e2e: รอเงื่อนไขจริงแทน timeout 5s, `LONG_CITY`) · spec 04 GB-N7 (comment ของ assertion ใน test GB-N6) · spec 05 AF-18 (Profile ล้นที่ 375) ·
แก้ตารางที่แตก (escape pipe ในเซลล์: spec 01 ตาราง CORE-6 และแถว CORE-4i, spec 07 `workerMode`) · ไม่มีคำถามค้าง
**รอบ 20 (2026-11-04 — owner สั่ง "ตกลง")**: merge แล้ว — GB-N7 #274 (merge ตรง) · train #279: CORE-41 #276, AF-18 #277 · train #282: CORE-40 #275 (train #280 ปิดเพราะ e2e CORE-42 พึ่ง stock seed) ·
train #283: CORE-42 #278, CORE-43 #281 · **owner เลือกทาง (ก)**: key ของฟอร์มสร้างแคมเปญใช้ `crypto.getRandomValues` → spec 04 **GB-15** (กฎข้อ 33d, AC-58 — admin ผ่าน http เปิดฟอร์มไม่ได้; ควรมีก่อน v0.5.0) ·
task ใหม่: spec 01 CORE-44 (`/cart` 1024 + จำนวนจริงในตัวเลือก) ∥ CORE-45 (step ที่ใช้ไม่ได้ → ขั้นแรกที่ยังไม่เสร็จ; ถอน "ยอมรับ" `step=delivery` ของรอบ 19) ∥ CORE-46 (e2e hygiene) ·
spec 05 AF-19 (header portal ชื่อละตินยาว) · แก้แถว PAY-3b2 ที่แตกบรรทัดใน spec 06 (+ สถานะ ☑ #203) · ไม่มีคำถามค้าง
**รอบ 21 (2026-11-04 — owner อนุมัติเปิด task)**: merge แล้ว — train #290: GB-15 #285, AF-19 #286, CORE-44 #287, CORE-46 #289 · train #291: CORE-45 #288 ·
task ใหม่: spec 01 CORE-47 (`/cart` 375 ชื่อยาว + ยอด 7 หลัก) ∥ CORE-48 (แก้จำนวนเกิน stock → ข้อความ "สินค้ามีไม่พอ") ∥ CORE-49 (e2e hygiene: grep test ที่เดียว, regex config, `waitForTimeout` ของ affiliate-admin-programs, `waitForServerAction` ใน core-25/26/fs19) ·
spec 05 AF-20 (ป้าย "รหัสแนะนำ"/รหัสไม่ถูกตัดบรรทัด) · spec 01 แก้ถ้อยคำกฎข้อ 103 (103e + AC-141 ครอบแล้วโดย #288) · spec 07 Deliverables ข้อ 11 (prod ต้อง HTTPS — cookie `Secure`, qa #285 O-1) · ไม่มีคำถามค้าง
**รอบ 23 (2026-11-05 — owner อนุมัติให้ทำรอบถัดไป)**: merge แล้ว — train #299: ADM-3 #294, ADM-4 #296, ADM-6 #293, AF-20 #295, CORE-47 #298 · กำลังทำ: ADM-5, ADM-7, ADM-8a, CORE-48, CORE-4i-b ·
task ใหม่: spec 08 ADM-10 (offset ใน URL ผ่าน hook กลาง) ∥ ADM-11 (`initialData` จาก loader + breadcrumb E-vouchers) ∥ ADM-12 (ช่อง number `badInput`) · ADM-13 (หัวตารางแคมเปญใน `DataTable`, ← ADM-7 + ADM-10) ·
spec 01 CORE-50 (nav 320) ∥ CORE-51 (e2e hygiene: `DESKTOP_BASELINE`, `createActiveAffiliate` options, `longCode`, `evidenceTarget`) · ADR-018 หมายเหตุ 2026-11-05 (แถว #2 ตามที่ทำจริง) ·
ร่าง issue upstream `DataTable` ไม่ reset offset (spec 08 รอบ 23 — owner ส่ง) · ~~คำถามค้าง spec 08 Q7~~ owner ตอบ **(ก)** 2026-11-05: ปุ่มใน `action` ของ `DataTable` หาด้วย
`getByTestId("<wrapper>").getByRole("button", { name })` (ข้อยกเว้นที่สองของ testid — spec 08 กฎ 7c/18, ADR-018 หมายเหตุ 2026-11-05 (2), CLAUDE.md) → ADM-13 ปลดล็อก (← ADM-7 + ADM-10) ·
task ใหม่ ADM-14 (ปุ่มสร้าง Partners/Programs/Payouts เข้า `action`, ← ADM-5 + ADM-8b; AC-18) · ไม่มีคำถามค้าง

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
| CORE-4i | (รอบ 12) server action ของ `lib/data/cart.ts` คืนผลแบบมีโครงสร้าง + helper กลาง + `SIGN_IN_AGAIN_MESSAGE` เดียว (AC-110) | ☑ #222 (CORE-4i-a) + #305 (CORE-4i-b, train #307) |
| CORE-4j | (รอบ 12, #170) trim โค้ดส่วนลด, ฟอร์มที่อยู่ไม่หายเมื่อใส่โค้ด, ความสูง billing select (AC-111) | ☑ #314 |
| CORE-22 | (qa #92, defect starter) title หน้า account, เบอร์ว่างไม่แสดง `null`, panel แก้ไขที่ปิดไม่รับ click (AC-82..84) | ☑ #99 |
| CORE-23 | (qa #99, defect starter รอบ 8) ลบเบอร์โทรได้, editor อีเมลออก, order ไม่พบตอบ 404, error token หมดเป็นไทย, จัดแนว "ยังไม่ได้ระบุ" (AC-85..89) | ☑ #105 |
| CORE-23b | (รอบ 9, qa/review #105) progress ตอนเปลี่ยนหน้า account, ฟอร์มไม่ล้างค่าเมื่อบันทึกล้ม, e2e AC-88 (AC-97) | ☑ #154 |
| CORE-23c | (รอบ 12, #154/#150/#164) ฟอร์มที่อยู่ใน account คงค่าเมื่อล้ม, ที่อยู่ใบเสร็จไม่ล่มทั้งหน้า, พิมพ์หลังกดแก้ไข, ลิงก์ `/contact` (AC-112) | ☑ #214 |
| CORE-5 | Playwright + convention การเก็บ evidence | ☑ #7 |
| CORE-5c | (รอบ 10, e2e tooling) evidence เขียนเฉพาะโฟลเดอร์ของ `evidenceTarget`, `step()` อยู่ในงบ (AC-103) | ☑ #169 |
| CORE-5d | (รอบ 12, #169/#173; นิยามใหม่ปิดรอบ 26) โฟลเดอร์มี PNG ครบ 5 แล้ว `saveEvidencePng` ไม่เขียนและ `console.warn` แทน throw (ไม่แก้ชื่อใน spec e2e) — รัน e2e ทั้งชุดด้วย `E2E_SAVE_EVIDENCE=1` ไม่ล้มและไม่เขียนทับรูปของ qa ในโฟลเดอร์ที่ครบงบ (กฎข้อ 77, AC-115) | ☑ #330 |
| CORE-6 | store route เฉพาะ customer + e2e AC-1..4, AC-6 | ☑ #36 |
| CORE-12 | ownership middleware: cart/payment-collection/order ต้องเป็นของ customer ที่ล็อกอิน (ADR-013) | ☑ #51 |
| CORE-13 | `POST /store/returns` ต้องเป็นเจ้าของ order + ปิด order transfer ทั้งชุด | ☑ #56 |
| CORE-16 | ปิด `return_shipping.price`/`receive_now`/`location_id` บน `POST /store/returns` + seed "Standard return" | ☑ #63 |
| CORE-17 | **ความปลอดภัย** return option ต้อง `is_return`/`enabled_in_store` (`eq` เท่านั้น) + service zone ของ order | ☑ #71 |
| CORE-18 | เนื้อหาร้านไทย placeholder แทนโฆษณา starter + ลบ `product-onboarding-cta` + "Medusa Store" → `STORE_NAME` | ☑ #80 |
| CORE-7 | Translation module + store locales | ☑ #26 |
| OPS-1 | Dockerfiles, worker mode, health | ☑ #9 (+ hotfix #18) |
**Release v0.1.0** — ร้านค้าที่เข้าชมได้, ชำระเงิน manual (เงื่อนไข release แรกที่เปิดให้ลูกค้าจริง: CORE-12 ☑, CORE-12b ☑, CORE-17 ☑, CORE-18 ☑; **รอบ 26 เพิ่ม: OPS-21 ☑ #325, EV-15 ☑ #326** — รายละเอียดด้านล่าง/M3/M7)

ไม่บล็อก release v0.1.0:
| Task | งาน | สถานะ |
|------|-----|--------|
| CORE-10 | seed follow-up (ชื่อไทย, idempotency, หัวข้อ dev ใน README; ค่าส่งคง placeholder) | ☑ #76 |
| CORE-10b | (รอบ 11, owner Q6 spec 03) seed collection ตัวอย่างให้หน้าแรกของ dev มี rail สินค้า (spec 01 กฎข้อ 70, AC-106) | ☑ #159 |
| CORE-10c | (รอบ 12, review #159) AC-72 ที่ CORE-10 ยังไม่ได้ทำจริง: category ไทย + handle คงที่, ซ่อม `featured` ที่ว่าง (AC-109) | ☑ #202 |
| CORE-9b | (รอบ 12, builder FS-17) search ingestion ไม่ throw กับ `product-option.deleted` (AC-108) | ☑ #200 |
| CORE-9c | (รอบ 13, review #200) test `search-option-deleted` poll + timeout แทน `sleep`, logger จาก container + positive control (AC-118) | ☑ #218 |
| CORE-11 | อีเมล shipped เฉพาะ item ใน fulfillment / `no_notification` | ☑ #64 |
| CORE-12b | **ความปลอดภัย** ownership ของ `cart_id` ใน query products/variants | ☑ #78 |
| CORE-14a | storefront `/buy` บังคับล็อกอิน, ปิด UCP/`cart/resume`, cookie cart ค้าง, ลบหน้า order transfer (AC-41..43, 56) | ☑ #81 |
| CORE-14b ∥ CORE-14c | no-JS login + error `add_variant` (AC-44, 45) ∥ login ไม่ล้มเมื่อ `transferCart()` ได้ 404 (AC-76) + e2e redirect แรกของ `/buy` (303), `/ucp` (307/308) | ☑ #113 ∥ ☑ #117 |
| CORE-14d ∥ CORE-24 | `/cart` ไม่ค้าง skeleton หลัง login no-JS, `add_error` + `unstable_rethrow`, `add_variant` ตอนล็อกอินแล้ว = การ์ดยืนยัน (กฎ 58, #132) (AC-92, 93 — รอบ 10: AC-93 (c) ทดสอบ no-JS ครั้งเดียวพอ) ∥ ตัวเลือกจำนวนบน PDP (AC-94) | ☑ #128 ∥ ☑ #134 |
| CORE-14e | ⏸ หลัง v1.0 (owner Q-F7 2026-10-27): nonce กันฟอร์ม no-JS ส่งซ้ำ (qty สองเท่า — owner ตัดสิน; cart ค้าง 2 ใบ จาก qa #128 O-2 — planner รวมเข้า) — ไม่มี AC | ⏸ |
| CORE-15 | หน้า `/store` หยุดยิงซ้ำเมื่อ search error + ป้ายราคา ฿ (AC-69) | ☑ #177 |
| CORE-15b | (รอบ 12, review #177) error ของ search drawer ที่ header ไม่เป็น `pageerror` + pin `instantsearch.js` (AC-114) | ☑ #213 |
| CORE-19a ∥ CORE-19b | ตัวนับ cart + search drawer 375px ∥ ปุ่ม "Continue to review" ไม่ค้าง | ☑ #118 ∥ ☑ #151 |
| CORE-19c | (รอบ 10, qa #118) `DeleteButton` ส่งต่อ `data-testid` + error เมื่อลบล้ม (AC-100 — ถ้อยคำแก้รอบ 11: mock request ของ server action) | ☑ #142 |
| CORE-19d | (รอบ 11, review/qa #142) `deleteLineItem` คืนผลแบบมีโครงสร้าง แยก 401 ใน prod (AC-104) | ☑ #160 |
| CORE-19e | (รอบ 11, review #151) ปุ่ม Continue ที่ CORE-19b ล็อกรอ session ไม่ค้างเมื่อ RSC refresh ไม่มา: `router.refresh()` 5s, ปลดล็อก + error ไทย 10s (AC-107) | ☑ #166 |
| CORE-19f | (รอบ 12, qa #166/#151) revalidate cart หลังสร้าง session, Continue หลัง timeout ไม่ข้าม session, e2e สลับวิธีชำระ (AC-113) | ☑ #310 |
| CORE-25 | (รอบ 12, **defect qa #178 — ลูกค้าอาจได้ไซซ์ผิด**) option บน PDP ไม่ถูกรีเซ็ตจาก `v_id` + ปิด flaky `core-19a:183` + แถบมือถือ (AC-116) | ☑ #199 |
| CORE-26 | (รอบ 13, **qa #199 — ยอดรวมใน dropdown ตะกร้าเป็นยอดก่อนส่วนลด ลูกค้าสับสนราคา**) ยอดรวมจาก field ของ Medusa ที่ตรงส่วนลด, แถว `cart-totals` รวมได้ยอดสุทธิ, dropdown ที่เปิดเองไม่ค้างทับ PDP, unit PDP เปลี่ยน `product.id`, comment "Shirts" (AC-117) | ☑ #209 |
| CORE-27 | (รอบ 14, qa/review #211) ปุ่มเพิ่มลงตะกร้าทั้งสองจุดของ PDP กันคลิกซ้อนใน tick เดียวด้วย `useRef` in-flight + `mobile-cart-button` disable ครบแบบปุ่มหลัก (AC-119) | ☑ #221 |
| CORE-14g | (รอบ 14b, qa #222 D-1) `clearStaleCartCookie` ไม่ล้าง `_medusa_cart_id` ใน request ของ server action (`next-action`) → แก้จำนวน/โค้ด/ลบสินค้าตอน JWT หายแสดง `SIGN_IN_AGAIN_MESSAGE` แถวสินค้ายังอยู่; GET ถัดไปยังล้างตาม AC-43 (AC-120) | ☑ #234 |
| CORE-28 | (รอบ 16, qa #222 O-2) `promotion-error` render นอก `isOpen` — error ของการใส่/ลบโค้ดเห็นได้แม้ช่องปิด + แก้ comment ค้างใน e2e core-19c (AC-121) | ☑ #241 |
| CORE-28b | (รอบ 16b, test-only) แก้ comment ค้างใน `e2e/core-14g-action-stale-jwt.spec.ts` ~125 ที่ไม่จริงหลัง CORE-28 (กฎข้อ 90, AC-126) | ☑ #251 |
| CORE-29 | (รอบ 16, รอบ 14b) กู้ตะกร้าหลัง login ใหม่: จำ id ตะกร้าหลักใน `customer.metadata` แล้วกู้เมื่อไม่มี cookie cart (AC-122; ADR-019 accepted owner 2026-11-04) | ☑ #263 |
| CORE-30 | (รอบ 16, qa #239/#238) ไม่ login กด join/สร้างทีม → login แล้วกลับ `/<cc>/g/<token>` หรือ `/<cc>` (allow-list ของ `return_to`) (AC-123) | ☑ #258 |
| CORE-31 | (รอบ 16) ปุ่มคัดลอกกลางใช้ร่วม `ShareLinkButton` + `VoucherCopyButton` (AC-124) | ☑ #254 |
| CORE-32 | (รอบ 16, qa #238) กรอง option วิธีส่งตาม shipping profile ที่ checkout และหน้ากลุ่ม — ไม่แสดง Digital delivery ให้สินค้าที่ต้องจัดส่ง (AC-125) | ☑ #243 (ทาง (b)) |
| CORE-33 | (รอบ 17, qa #243 O-1/O-2) ข้อความไทยเมื่อกรองแล้วไม่มีวิธีส่ง + method ค้างที่ถูกกรองออก (Digital delivery บน cart เก่า) ถือว่ายังไม่เลือก + comment e2e core-32 (AC-127) | ☑ #255 |
| CORE-34 | (รอบ 17, qa #241 O-3) `removePromotionCode` ล้าง error เดิมก่อนส่ง (AC-128) | ☑ #252 |
| CORE-35 | (รอบ 18, review #255) `deliveryStepDone` ใช้ option ที่เลือกในรายการที่กรองแล้ว + `?step=payment`/`review` ตรงๆ พากลับ delivery — cart ค้าง Digital ไม่ไปจบ 400 อังกฤษตอน complete (กฎข้อ 93, AC-129) | ☑ #266 |
| CORE-36 | (รอบ 18, qa #252 O-2) ปุ่ม `remove-discount-button` disabled/สถานะกำลังลบ + กันคลิกซ้อน + ข้อความล้มเฉพาะการลบ (กฎข้อ 94, AC-130) | ☑ #264 |
| CORE-37 | (รอบ 18, qa/review #254) ข้อความคัดลอกล้มแยกค่าให้เลือกง่าย, Web Share ล้มแล้วลองคัดลอก, แถวรหัสของการ์ด voucher ไม่เยื้อง (กฎข้อ 95, AC-131) | ☑ #265 |
| CORE-38 | (รอบ 18, qa #255 O-2 / #258 O-3) สรุปที่อยู่ checkout เรียงแนวตั้งที่ < 640px + label ลอยของ `Input` ไม่ทับค่า (กฎข้อ 96, AC-132) | ☑ #267 (ข้อ (b) ปิดโดยไม่แก้โค้ด — กฎข้อ 96b) |
| CORE-39 | (รอบ 18, nit review #258) token ของ `return_to` `{1,64}`, comment ลำดับ `return_to`/`add_variant`, unit เคสที่ qa ลองมือ (กฎข้อ 97, AC-133) | ☑ #271 |
| CORE-40 | (รอบ 19, **bug** qa #264 O-1) ช่องโค้ดส่วนลดมี action ค้างได้ทีละหนึ่ง (ปุ่มใส่/ลบ disabled + ref เดียว) + รายการโค้ดตอนใส่ไม่พาโค้ดที่เพิ่งลบกลับมา (กฎข้อ 98, AC-134) | ☑ #275 (train #282) |
| CORE-41 | (รอบ 19, review/qa #266) `?step=payment`/`review` ตรงๆ → ขั้นแรกที่ยังไม่เสร็จ (`step=address` เมื่อไม่มีที่อยู่) ผ่าน `checkoutStep(cart, options)` (กฎข้อ 99, AC-135) | ☑ #276 (train #279) |
| CORE-42 | (รอบ 19, qa #264 O-4 / #265 O-1) ตารางสินค้า `/cart` ไม่ล้นที่ 375 + แถวรหัส voucher ไม่มีช่องว่างเมื่อสถานะว่าง (คง `aria-live`) (กฎข้อ 100, AC-136) | ☑ #278 (train #283) |
| CORE-43 | (รอบ 19, test hygiene) helper ใส่ตะกร้าจาก PDP ที่รอผลจริง, แก้ assertion ที่ล้มจริงของ e2e ไม่นิ่ง (ห้ามเพิ่ม timeout ระดับ config), `LONG_CITY` + `billing-city-input` (กฎข้อ 101, AC-137) | ☑ #281 (train #283) |
| CORE-44 | (รอบ 20, qa #278 D-2/O-1) `/cart` ที่ ≥ 1024 คอลัมน์สรุปไม่ล้นเมื่อมีส่วนลด + `product-select-button` แสดงจำนวนจริงของ line (> 10) (กฎข้อ 102, AC-138) | ☑ #287 (train #290) |
| CORE-45 | (รอบ 20, qa #276 Obs 1–2) checkout ไม่มี step/step ไม่รู้จัก/`delivery` ก่อนมีที่อยู่/`delivery` ของ digital-only → ขั้นแรกที่ยังไม่เสร็จผ่าน `checkoutRedirectStep` (กฎข้อ 103, AC-139; + D-1 ของ qa → กฎข้อ 103e, AC-141) | ☑ #288 (train #291) |
| CORE-46 | (รอบ 20, test hygiene — nit review #281/#278) `checkoutToPayment` ใช้ `addToCartFromPdp`, comment timeout ตาม docs, core-19a/core-24 ใช้ `isAddToCartBody`, e2e admin ดึงสินค้า seed ด้วย handle แทน `limit=1` (กฎข้อ 104, AC-140) | ☑ #289 (train #290) |
| CORE-47 | (รอบ 21, qa #287 O-1) `/cart` ที่ < 1024 แต่ละ line เป็นแถวแบบการ์ด อ่านได้เมื่อชื่อสินค้ายาว ~90 ตัว + ยอด 7 หลักพร้อมส่วนลด; ≥ 1024 ตารางเดิม (owner เลือกทาง (C) 2026-11-04; กฎข้อ 105, AC-142) | ☑ #298 (train #299) |
| CORE-48 | (รอบ 21, qa #287 O-2) แก้จำนวนเกิน stock บน `/cart` → ข้อความไทยว่าสินค้าไม่พอ (400 `insufficient_inventory` ของ Medusa) (กฎข้อ 106, AC-143) | ☑ #300 (train #307) |
| CORE-49 | (รอบ 21, test hygiene — nit review #289 + qa #286/#288) grep test ที่เดียว, regex config เฉพาะ key timeout, `toHaveLength(1)` ติด `handle=`, ตัด `waitForTimeout` ของ affiliate-admin-programs, core-25/26/fs19 ใช้ `waitForServerAction` (กฎข้อ 107, AC-144) | ☑ #312 |
| CORE-50 | (รอบ 23, qa #298 O-1 + qa #295 O-2) nav ที่ < 1024 ตั้งแต่ 320: ชื่อร้าน/ค้นหา/"ตะกร้า (n)" ไม่ชิดกัน, "ตะกร้า (n)" บรรทัดเดียว (กฎข้อ 108, AC-145) | ☑ #309 |
| CORE-51 | (รอบ 23, test hygiene — nit review #295/#298) `DESKTOP_BASELINE` ใน `e2e/support/`, `createActiveAffiliate` options object, `longCode()` ความกว้างคงที่, `evidenceTarget` AF-20 (กฎข้อ 109, AC-146; ชน ADM-8a/8b/CORE-49 — ตัวที่ merge ทีหลัง rebase) | ☑ #328 |
| CORE-52 | (รอบ 26, qa #320 + review #314) checkout: ตะกร้าว่างจากอีกแท็บ → `/cart`, ที่อยู่ช่องว่างไม่ผ่าน, ไม่แสดง section จัดส่งบน order voucher, select ประเทศคงค่าหลัง error (กฎข้อ 110, AC-147; ไม่บล็อก release) | ☐ **เริ่มได้** (EV-7d ☑ #320) |
| CORE-53 | (รอบ 26, test hygiene — nit review #312/#314) `setsTimeout`, parser `core-4j`, cleanup `core-4g`/`core-4j` ไม่กลบ error (กฎข้อ 111, AC-148; ไม่บล็อก release) | ☐ **เริ่มได้** |
| CORE-54 | (ปิดรอบ 26, test hygiene — nit review #328) `core-46-e2e-hygiene`: หา `longCode` ไม่เจอต้องล้ม ไม่ผ่านเงียบ, ตัวตรวจอาร์กิวเมนต์ไม่รับเกิน 3 ตัว (กฎข้อ 112, AC-149; ไม่บล็อก release; ชน CORE-53 ไฟล์เดียวกัน — ตัวที่ merge ทีหลัง rebase) | ☐ **เริ่มได้** |
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
| PAY-3b2 | พร้อมเพย์บนหน้า pay (AC-7) + แยก `open-qr.ts` ใช้ร่วม checkout, allow-list ใน static test AF-3c กฎ 31 (หน้า order ไม่มี cart) + กลับจาก redirect ของ Stripe (AC-20) | ☑ #203 |
| PAY-4 | Refund e2e (refund บางส่วน → `partially_refunded` + credit line) | ☑ #94 |
| PAY-5 | race QR หมดอายุ × จ่ายสำเร็จ — ยืนยันกรณี (b) + ADR-015 | ☑ #65 |
| PAY-6a | ADR-015 A ฝั่ง backend: guard + 409 `PAYMENT_ALREADY_COMPLETED` | ☑ #82 |
| PAY-6b | storefront poll + complete cart ทางสำรอง (6b1) ∥ alert + runbook + script `refund-orphan-payment.ts` (6b2) | ☑ #98 ∥ ☑ #97 |
| PAY-6c | เพดานการลองซ้ำ 10 ครั้ง + UI เงินถูกคืนแล้ว (spec 06 กฎข้อ 8, AC-17) — ควรก่อน release ที่เปิดพร้อมเพย์จริง | ☑ #136 |
**Release v0.2.0** — ชำระเงินจริงใน test mode; checklist go-live สำหรับ live keys

## M3 E-voucher — **v0.3.0**
EV-1 ☑ #15 · EV-2 ☑ #25 · EV-3 ☑ #31 · EV-4 ☑ #67 · EV-5 ☑ #43 · EV-5b ☑ #111 · EV-6 ☑ #39 · EV-8 ☑ #54 · EV-10 ☑ #85 · EV-11 ☑ #88 · EV-12 ☑ #123 ·
EV-7 **แตกรอบ 10** → EV-7a ☑ #155 → EV-7b ☑ #179 ∥ EV-7c ☑ #174 · EV-9 ☑ #139 · EV-13 ☑ #167 · EV-5c ☑ #171 · EV-N1 ☑ #149 ·
(รอบ 12) **EV-14 ☑ #195** (`terms_url`/`logo_url` รับเฉพาะ http(s); AC-40; รอบ 13: ฟอร์ม admin ตรวจฝั่ง client → ADM-5) ∥ **EV-N2 ☑ #201** (lock owner/TTL ของ allocation + nit EV-7a; AC-41) →
(รอบ 13) **EV-N3 ☑ #219** (← #201: ข้อความ resend ไม่มีจุดซ้อนที่ต้นเหตุ backend + test รูปแบบ `ownerId`; AC-44) ∥
**EV-7e ☑ #217** (vouchers แบ่งหน้า, `support_contact`, บล็อก partner บน PDP; AC-43) · **EV-7d ☑ #320** (cart-totals digital-only, redirect ผ่าน `safeCountryCode`; AC-42)
(รอบ 26) **EV-15 ☑ #326 — เงื่อนไข release v0.1.0** (Medusa 2.22.1 ไม่ลบ shipping method เมื่อเหลือ method เดียว: เก็บค่าส่งจากตะกร้า digital-only — hook `beforeRefreshingPaymentCollection`; กฎข้อ 31, AC-45; ADR-021 accepted)

## M4 Flash sale — **v0.4.0**
PROMO-1 ☑ #21 (+ #24) · FS-1 ☑ #14 (+ hotfix #22) · FS-3 ☑ #28 · FS-2 ☑ #37 · FS-4 ☑ #32 · FS-5 ☑ #38 · FS-7 ☑ #53 · PROMO-2 ☑ #50 ·
FS-10 ☑ #74 · FS-6 ☑ #115 · FS-8 ☑ #69 · FS-11 ☑ #83 · FS-13 ☑ #129 ·
FS-12 ✕ (รอบ 10: ปิด — QA #115 พิสูจน์ preview = cart ทั้ง 5 แบบ target rule) · FS-9 ✕ (owner ตัดสินไม่ทำ 2026-10-27) ·
FS-14 ☑ #148 (☑ เต็ม — FS-17 ☑) → FS-17 ☑ #164 ∥ FS-15 ☑ #178 →
FS-16 ☑ #190 (ปุ่มรอข้อมูล flash, `product-price` ขีดฆ่า, ป้าย sold out บนการ์ด; AC-23) → (รอบ 13) **FS-19 ☑ #211** (← CORE-25 #199: `mobile-cart-button` รอ `flash.loading`, แถบมือถือไม่จางทับปุ่มหลัก; AC-26) ∥
**FS-18 ☑ #216** (รอบ 12: `revalidate` ให้ fetch ที่เหลือใน `lib/data`, e2e ลบข้อมูลครบ (รอบ 13: + `flash-sale-fs16.spec.ts`), `/store` ไม่ยิงข้อมูล flash ชุดเก่า; AC-25)
(FS-2 คืนโควตาเมื่อ cancel หรือ refund เต็มจำนวน ไม่ว่ามาจาก return — owner 2026-10-25)

## M5 Group buying — **v0.5.0**
GB-1 ☑ #17 · ADR-011 ☑ #33 · GB-2a ☑ #42 → GB-2b ☑ #49 → GB-2c ☑ #58 ·
GB-3 ☑ #68 → (GB-3b ☑ #95 ∥ GB-3c ☑ #100 ∥ GB-4 ☑ #89) →
(รอบ 10) PAY-3a ☑ #157 ∥ GB-8 ☑ #145 →
GB-5 ☑ #185 (+ ops alert/runbook เงินค้าง) ∥ PAY-3b1 ☑ #189 → PAY-3b2 ☑ #203 → GB-7 (รอบ 14 แยก: **GB-7b ☑ #223** หน้า account จาก GB-8 + ออกจากกลุ่ม + ลิงก์ชำระเงิน; AC-2 e2e, AC-16b ∥
**GB-11 ☑ #230** route สาธารณะ `GET /store/group-buy/campaigns/active` + `GET /store/group-buy/groups/:token` ไม่คืน PII; AC-45..46 → **GB-7a1 ☑ #236** หน้ากลุ่ม `/<cc>/g/<token>` อ่านอย่างเดียว; AC-16a →
(**GB-7a2 ☑ #238** เลือกที่อยู่ + วิธีส่ง (Q19) + join ด้วย cart ใหม่ (ไม่แตะ cart ปัจจุบัน), sync `aff`, ข้อความ error ต่อ code; AC-28, AC-47 ∥
**GB-7c ☑ #239** แคมเปญ flash + group buy บนหน้าแรก + สร้างทีม; rebase กับ #216 FS-18; AC-48)) ;
(รอบ 15 — 1 แคมเปญ = 1 สินค้า) **GB-6e ☑ #231** (picker สินค้าเดียว + validation + แก้ seed-load/e2e/unit เดิมที่ใช้หลายสินค้า/variant scope (review #227); AC-49..50; ชน `product-picker.tsx` กับ ADM-7) ∥ **GB-7a2a ☑ #229** (error map — `lib/util/group-join-error.ts`) →
GB-7a2 ใช้หลาย variant (← GB-7a1, GB-7a2a, GB-6e); GB-7c การ์ดแสดงสินค้าเดียว; Q20 ตัดสินแล้ว (owner 2026-11-03, กฎข้อ 31d) ;
(รอบ 12) **GB-9 ☑ #196** (alert เงินค้างอ่านสถานะใหม่ + runbook ตรวจ draft ก่อน refund; AC-43) → **GB-10 ☑ #208** (PR เดียว ไม่แยก GB-10b) (← #196 — รอบ 13 รวม follow-up ของ #196 (เกิน ~400 LOC → แยก GB-10b): subscriber fail-open, `loadMembership` ที่เดียว,
test `membership_joined`, ขอบหัวข้อ runbook; membership `paid` เมื่อ ops แปลง draft เอง + noop ใต้ lock ในเส้นทางปกติ; AC-44) — ควรก่อน release v0.5.0;
owner Q13 = (ก) manual, Q14 = (ก) `order-placed` (2026-10-28) ;
GB-6a ☑ #75 → (GB-6b1 ☑ #87 ∥ GB-6b2 ☑ #96) → GB-6c1 ☑ #114 → GB-6c2 ☑ #121 → GB-6d ☑ #143 → GB-N3 ☑ #161 ;
GB-N1 ☑ #106 · GB-N2 ☑ #126 (nit `trackSubscribers` คัดลอก `subscriberId` ถ้ายังไม่แก้ใน #126 → แก้ใน PR ถัดไปที่แตะ `group-buy-join.spec.ts`) · Q11 owner ยืนยัน (ก) ยอมรับ lock TTL 60s ใน v1 — ไม่มี task
(รอบ 16) **GB-12 ☑ #244** (countdown กลาง, ชื่อสินค้า/ราคาใน `group-selection`, fixed "ต่อชิ้น", กล่องยืนยันออกจากกลุ่ม 375px + empty state เดียว
+ รอบ 17: ไม่แสดง empty state เมื่อโหลด group orders ล้ม (กฎข้อ 32e1); AC-51 — ควรก่อน v0.5.0) ∥
**GB-N4 ☑ #246** (test hygiene; AC-53) → **GB-13 ☑ #259 (train #261)** (Q21 = ก owner 2026-11-04: `idempotency_key` ของการสร้างแคมเปญ; AC-52 — รอบ 18 แก้ถ้อยคำเป็น e2e admin `page.route`) →
(รอบ 18) **GB-N6 ☑ #269 (train #270)** (ข้อ (a) toast ปิดโดย #259 commit `016f204`; #269 ส่งมอบ integration test error หลังขอ lock แล้ว key เดิมใช้ต่อได้ทันที; AC-56) →
(รอบ 19) **GB-N7 ☑ #274** (comment เหนือ assertion "percentage number between 0 and 100" ว่ายืนยันการล้มหลัง lock ไม่ใช่ zod; AC-57) →
(รอบ 20) **GB-15 ☑ #285 (train #290)** (owner ทาง (ก): key ของฟอร์มสร้างแคมเปญจาก `crypto.getRandomValues` รูป UUID v4 แทน `crypto.randomUUID()` ที่ใช้ไม่ได้บน http; กฎข้อ 33d, AC-58 — ควรมีก่อน v0.5.0; ชน `create-campaign.tsx` กับ ADM-7) ∥
(รอบ 16b) **GB-14 ☑ #247** (Q-C4 = ข: ตรวจ shipping profile ตอน join → 400 `GB_SHIPPING_PROFILE_NOT_COVERED` + ข้อความไทยใน `group-join-error.ts`; AC-54; ∥ CORE-32 ไม่มีไฟล์ชน — ควรก่อน v0.5.0;
Q22 = (ก) owner 2026-11-04: cart ไม่มีวิธีส่งเลยไม่ถูกปฏิเสธ) →
(รอบ 17) **GB-N5 ☑ #257** (ตัด `!profile ||`, ขั้น O_dig → O_std ผ่าน Store API, helper admin ของ integration test, ชื่อตัวแปร pool ใน `home-campaigns.test.ts`; AC-55 — รอบ 18 แก้ถ้อยคำกฎข้อ 36b ตาม core-flows จริง) ·
CORE-30 ☑ #258, CORE-32 ☑ #243, CORE-33 ☑ #255, CORE-35 ☑ #266 (spec 01) ·
(รอบ 26) **GB-16 ☐** (filter ของ job `group-buy-deadline` รวมสถานะกลุ่ม ให้ใช้ index `(status, pay_deadline_at)`; กฎข้อ 39, AC-59; **เริ่มได้**, ไม่บล็อก release)

## M6 Affiliate — **v0.6.0**
AF-1 ☑ #11 · AF-2 ☑ #66 · AF-5 ☑ #35 → AF-3 ☑ #77 → (AF-3b ☑ #119 ∥ AF-4 ☑ #90 ∥ AF-4b ☑ #91 ∥ AF-7 ☑ #110) → AF-7b ☑ #122 →
AF-N2 ☑ #146 (nit #125/#122; AC-38) · AF-8 แตกรอบ 11: AF-8a ☑ #135 → AF-13 ☑ #158 → AF-8b ☑ #173 → AF-8c ☑ #182 ;
AF-5 → AF-9 ☑ #79 → (AF-6 ☑ #138 ∥ AF-9b ☑ #107 → AF-N1 ☑ #137) → **admin UI แบบเขียนได้ (owner 2026-10-27)**: AF-12a ☑ #163 ∥ AF-12b ☑ #165 ∥ AF-12c ☑ #176 ;
AF-10 ☑ #125 · AF-3c ☑ #153 · AF-11 ⏸ หลัง v1.0 (owner Q15 2026-10-27) · AF-14 ☑ #187 (AC-45; รอบ 13: nit ของ #187 → ADM-8a) ·
(รอบ 12) **AF-15 ☑ #215** (← AF-14 ☑: `payout_info` 3 ช่องแบบ strict + เลขบัญชี 10–12 หลัก (Q20), `expected_status` กันกด approve จากหน้าเก่า, prompt ของ Clear; AC-46; เกิน ~400 LOC แยก backend/UI) ∥
AF-N3 ☑ #237 (portal: สกุลเงิน, หน้าเกิน, `−`, static test AST; AC-47) ∥ **AF-16 ☑ #197** (owner Q19 = ข: ค่าคอม affiliate ของ order group buy — token บน draft order, attribution ตอนแปลง; AC-48 ☑) →
(รอบ 13) **AF-17 ☑ #207** (← AF-16 ☑ #197: token ว่างใน cart fallback ไป `order.metadata`; AC-49) ·
(รอบ 19) **AF-18 ☑ #277 (train #279)** (qa #265 O-2: หน้า Profile ล้นที่ 375 เมื่ออีเมลยาวไม่มีช่องว่าง → `minmax(0,1fr)` + `break-words`; AC-50) →
(รอบ 20) **AF-19 ☑ #286 (train #290)** (qa #277 D-1: header ของ portal ล้นทุกหน้าเมื่อชื่อละตินยาวไม่มีช่องว่าง → `min-w-0` + ตัดคำ + `affiliate-header-name`; กฎ 43, AC-51) →
(รอบ 21) **AF-20 ☑ #295 (train #299)** (qa #286 O-1: ป้าย "รหัสแนะนำ" `whitespace-nowrap` + `affiliate-code-label`, รหัสแนะนำไม่ถูกตัดที่ `-`; กฎ 44, AC-52 — รอบ 23: qa #295 O-1 ปิดโดยไม่สร้าง task, nit e2e → CORE-51) ·
release v0.6.0 ต้องมี AF-14 (ที่เหลือ ☑ แล้ว; AF-15, AF-16 ควรมี) · owner รอบ 11: Q16 คง `variant_ids` ผ่าน API, Q18 `payout_info` 3 ช่อง

## M7 Scale และ hardening — **v1.0.0** 🎯
OPS-2 ☑ #27 · OPS-6 ☑ #47 · OPS-3 ☑ #120 (JSON logs + alert `Error running event bus worker`, AC-18) · OPS-3b ⏸ rate limiting · OPS-3c ⏸ Sentry (owner Q-O1/Q-O2 2026-10-27: เลื่อนหลัง v1.0) ·
OPS-7 ☑ #108 · OPS-8 ☑ #101 · OPS-13 ☑ #127 · OPS-9 ☑ #72 · OPS-11 ☑ #87 (รวมใน GB-6b1) ·
OPS-14 ☑ #133 · OPS-10 ☑ #141 → OPS-15 ☑ #156 → OPS-12 ☑ #172 → OPS-16 ☑ #180 → (รอบ 13) **OPS-17a ☑ #220 — ความปลอดภัย** (← OPS-20a #204: artifact k6 ไม่มี `setup_data`/JWT ของลูกค้า load test + ขั้นตรวจใน `run.sh`; AC-33) →
(รอบ 12) OPS-17 ☑ #235 (← OPS-17a; `prod-guards` อ่าน YAML ด้วย parser, `IMAGE_TAG` ของ load test, ตัด cast; รอบ 13: `hold_rank_corr` O(n); AC-28) ·
OPS-13b ☑ #147 · OPS-4 ☑ #175 (load-nightly run 40590093846 success — `docs/evidence/scale/OPS-4/REPORT.md` ☑ #191; **owner 2026-11-03: AC-2 ☑** — nightly บน runner เป็น gate ความถูกต้อง ยอมรับอัตรา burst ที่ runner ทำได้, **AC-3 ☑**) →
OPS-18 ☑ #194 (run 41617065775: lock ไม่ใช่สาเหตุ, ≥ 95% ของ checkout อยู่นอก lock; AC-29 ☑) →
OPS-20a ☑ #204 (owner 2026-11-03 — ปิด burst ได้ผ่าน dispatch input + แตกเวลาก่อน/ใน/หลัง hook, สรุป burst vs workflow; AC-31) → OPS-17a → OPS-17 → OPS-20b ☑ #318 (ตัวชี้วัดความอิ่มตัว; AC-32)
— ลำดับ `tools/load/*` (รอบ 13): OPS-20a → OPS-17a → OPS-17 → OPS-20b (ชน `run.sh`) · OPS-19 ⏸ (staging load test 500 rps × 60s + p95 < 300ms gate; AC-30 — ต้องมี ADR staging ก่อน) ·
OPS-5 ☑ #319 (index/migration + runbook backup/restore; AC-4)
(รอบ 16) **OPS-17b ☑ #242 — ความปลอดภัย** (scan secret ก่อนพิมพ์ลง job log + redact JWT ใน console ของ k6 + `run.sh:132` `k6-failures.txt` ผ่าน redact (nit review #240); AC-34) →
(รอบ 17) **OPS-17c ☑ #253** (stdout/stderr ของ `docker run` k6 ผ่าน redact, static test จับ `JSON.stringify(`, ตัวตรวจไม่ข้ามบรรทัด `grep -q`; AC-35) → OPS-20b (ชน `run.sh`)
(รอบ 26) **OPS-21 ☑ #325 — เงื่อนไข release v0.1.0** (compose prod ส่ง `EVOUCHER_ENCRYPTION_KEY`/`EVOUCHER_ADMIN_EMAIL`/`OPS_ALERT_EMAIL`/`TZ` + guard บูต; AC-36) ·
OPS-22 ☐ (`classify-changes.sh` นับ `docs/ops/**` เป็นโค้ด; AC-37; **เริ่มได้**) · OPS-23 ☐ **เริ่มได้** (OPS-20b ☑ #318; owner Q-O4 = ก 2026-11-09 เทียบ `DATABASE_POOL_MAX` 10/20/40; AC-38; ADR-020 เฉพาะเมื่อเสนอเปลี่ยนค่า prod) ·
OPS-24 ☐ **เริ่มได้** (ปิดรอบ 26, nit review #325: comment `export` ใน `docker-compose.prod.yml` + `.trim()` ของ env อีเมลแจ้งเตือนใน `checkBootEnv`; AC-39; ไม่บล็อก release)

hotfix/chore: #46 (test FS-4 × CORE-6), #52 (jest integration heap OOM), #59 (ลด CI ซ้ำซ้อน — ตัด push ไป develop)

## Admin UI ใช้ component ของ Medusa (ADR-018 accepted, spec 08) — ไม่บล็อก release ใด
owner 2026-10-28: ให้ admin ใช้ component/hook/utility ของ Medusa เป็นฐาน (`@medusajs/dashboard/{components,hooks,lib}` ตั้งแต่ v2.21.0 → `@medusajs/ui` → custom guide → สร้างเอง)
owner ตัดสิน spec 08 Q1–Q6 (2026-10-28): ทำครบ ADM-1..9, bump `@medusajs/ui` 4.2.8, ปุ่มต่อแถวใช้ `ActionMenu`, วันเวลาใช้ `DatePicker`/`useDate` ตาม timezone เครื่อง (เลิก `lib/ict.ts` ใน admin),
เงินใช้ `getLocaleAmount`, ฟอร์มแบบ state, pagination ใน URL — ADR-018/spec 08 ☑ #183
| Task | งาน | สถานะ |
|------|-----|--------|
| ADM-1 | dependency ตรงกับ dashboard (`@medusajs/ui` 4.2.8, `react-hook-form`, `@hookform/resolvers`, `@medusajs/icons`) + jest โหลด `@medusajs/dashboard/lib` ได้ + `icon` ของ route (AC-1, 2) | ☑ #186 |
| ADM-2a | Header/Container (guide) + Header/`SectionRow` ใน 3 widget + เพิ่มข้อตรวจใน `medusa-ui.unit.spec.ts` เดิม (AC-5; รอบ 12 + nit EV-13 #167) | ☑ #205 |
| ADM-2b | `createSingleFlight` แทน `useRef`, วันที่ผ่าน `useDate` (locale จากภาษาของ admin — แก้รอบ 12), Playwright admin `locale`/`timezoneId` (AC-3, AC-4) | ☑ #225 |
| ADM-3 ∥ ADM-4 ∥ ADM-6 | pilot ฟอร์ม widget (`Form` + zod, AC-6) ∥ หน้า e-voucher (`LayoutComposer`, `DataTable` dashboard, `ActionMenu` Reveal, AC-7) ∥ หน้า group buy (AC-9; ← GB-N3 ถ้ายังเปิดอยู่) | ☑ #294 ∥ ☑ #296 ∥ ☑ #293 (train #299) |
| ADM-5 ∥ ADM-7 | partners ตาราง + ฟอร์ม + `ActionMenu` (AC-8; รอบ 13: + ตรวจ URL http(s) ของ partner ฝั่งฟอร์ม — follow-up EV-14 #195) ∥ ฟอร์มสร้างแคมเปญ + `DatePicker` + `useProducts` (AC-10) | ☑ #302 ∥ ☑ #301 (train #307) |
| ADM-8a | affiliate ตาราง (`DataTable` dashboard, `getLocaleAmount`, `useDate`, icon + ลบ `affiliate` จาก `ICON_PENDING`; AC-2, AC-11; รอบ 13: + nit AF-14 #187 — assertion `safeParse`, cast `as unknown as`, `keepPreviousData` ของ query ชื่อ) | ☑ #304 (train #307) |
| ADM-8b | affiliate ปุ่มต่อแถวเป็น `ActionMenu` + แก้ locator e2e + (รอบ 12) Cancel/Mark paid ของแถวเดียวกันกันกัน (AC-13) | ☑ #316 |
| ADM-9 | affiliate ฟอร์ม (`Form`, `DatePicker`, `Combobox` scope, ฟอร์มของ AF-12c; รอบ 12: ส่งวันที่เฉพาะที่แก้, scope ว่าง → error, ตัวเลือก affiliate ค้นหาได้; AC-12) | ☑ #322 |
| ADM-10 ∥ ADM-11 ∥ ADM-12 | (รอบ 23) offset ใน URL ผ่าน `pageOffset`/`clampOffset` + hook `usePageOffset` (qa #296 O-1/O-2; AC-14) ∥ `initialData` จาก loader + breadcrumb E-vouchers (qa #293 Obs 4; AC-15) ∥ ช่อง number ตรวจ `badInput` (qa #294 Obs 1; AC-16) | ☑ #315 (+ hotfix #324) ∥ ☑ #311 ∥ ☑ #313 |
| ADM-13 | (รอบ 23) หัวตารางแคมเปญ group buy ใช้ `heading`/`subHeading`/`action` ของ `DataTable`, `CreateCampaign` controlled (qa #293 Obs 1; AC-17) | ☑ #321 |
| ADM-14 | (Q7 = ก) ปุ่มสร้างของ Partners/Programs/Payouts เข้า `action` ของ `DataTable` + wrapper testid `evoucher-partners-table`/`affiliate-programs-table`/`affiliate-payouts-table` (spec 08 กฎ 18; AC-18) | ☑ #327 |
| ADM-15 | (รอบ 26, รอบ 25 ข้อ D + #321) `create-campaign`: `NumberInput`, focus กลับปุ่มหลังปิด modal, e2e dblclick/`form.reset` (กฎ 19; AC-19) | ☐ **เริ่มได้** (ADM-13 ☑ #321) |
| ADM-16 | (รอบ 26, #316/#315) deps คอลัมน์ `codes-table`/`partners-section`, empty state ไม่กระพริบ, static AC-14 (กฎ 20; AC-20) | ☐ **เริ่มได้** |
| ADM-17 | (รอบ 26, #322) `q` ของ affiliate + `useComboboxData` + error ของรายการ + nit e2e (กฎ 21; AC-21) | ☐ **เริ่มได้** (ADM-9 ☑ #322) |
| ADM-18 | (ปิดรอบ 26, qa #324) e2e filter + Esc ระหว่าง loader หน่วง — ต้องยืนยันก่อน ไม่ใช่บั๊กที่ยืนยันแล้ว; แก้เฉพาะเมื่อทำซ้ำได้ (กฎ 22; AC-22) | ☐ **เริ่มได้** (ชน ADM-16 ไฟล์ e2e เดียวกัน — ตัวที่ merge ทีหลัง rebase) |
| ADM-19 | (ปิดรอบ 26, qa/review #327) e2e `partners_offset` ผิดรูปตอนไม่มี partner + REPORT หลัง sync develop (กฎ 23; AC-23) | ☐ **เริ่มได้** |

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

## ข้อตกลงการทำงานต่อ PR
planner (เฉพาะเมื่อ spec เปลี่ยน) → builder (TDD, worktree) → qa (e2e + evidence) →
reviewer (อิสระ) → session หลัก merge เข้า develop (main เป็นของ owner) → PR ถัดไป
คอลัมน์สถานะอัปเดตโดย session หลัก (builder ห้ามแก้ไฟล์นี้)
