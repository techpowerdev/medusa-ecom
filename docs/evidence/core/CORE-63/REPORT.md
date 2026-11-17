# QA REPORT: CORE-63 (PR #386)

- **Spec:** `docs/spec/01-core-medusa.md` กฎข้อ 121, AC-162 และ regression AC-157 / AC-147 / AC-81
- **Commit ที่ทดสอบ:** `75d4717a` (branch `feat/CORE-63-address-invisible-all-fields`)
- **สภาพแวดล้อม:** prod build (`medusa build` + `medusa start`, `next build` + `next start`), backend :9313, storefront :8313, DB `medusa_qa386` (migrate + seed ใหม่), Redis db 13, Chromium 1280×800 และ 375×812, ไม่ใช้ Stripe จริง ชำระด้วย `pp_system_default`
- **วิธีหา element:** `data-testid` เสมอ ตรวจความเป็นไทยด้วย regex อักษรไทย
- **ข้อความ error ที่ assert ตรงตัว:** `MISSING_ADDRESS_MESSAGE` = "กรุณากรอกชื่อ นามสกุล ที่อยู่ รหัสไปรษณีย์ และเขต/อำเภอให้ครบ (ช่องที่มีแต่ช่องว่างถือว่ายังไม่ได้กรอก)"
- **อักขระมองไม่เห็น:** ในรายงานนี้เขียนเป็น escape `\uXXXX` เท่านั้น
- **Playwright report/trace ฉบับเต็ม:** CI artifact ของ PR #386 (14 วัน)

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-162 e2e (builder): เพิ่มที่อยู่ `city-input` = `\u200B` → `address-error` ภาษาไทย, modal ยังเปิด, จำนวนที่อยู่ใน API ไม่เพิ่ม; แก้เป็นค่าจริงแล้วเพิ่ม 1; cleanup `request.delete` ตรวจ ok | pass (1/1 และ `--repeat-each=3` 3/3) | `01-account-address-zwsp-error.png` |
| AC-162 / กฎ 121b–c: เพิ่มที่อยู่ city = `\u200B`, `\u200C`, `\u200D`, `\u2060`, `\uFEFF` และค่าผสม `" \u200B\t\uFEFF\u2060 "`; first/last/address_1/postal = `\u200B\u2060` → error ตรงตัว, modal ยังเปิด, ค่าที่พิมพ์ (city, ชื่อ, บริษัท, โทร, ประเทศ) ยังอยู่, รายการที่อยู่ใน API เท่า snapshot ก่อนส่ง | pass (10/10) | `05-qa-add-address-zwsp-error-375.png` |
| AC-162 / กฎ 121b–c: แก้ที่อยู่เดิม city = อักขระ 6 แบบข้างบน → error ไทย, ค่าที่พิมพ์ยังอยู่, ที่อยู่ใน API เท่า snapshot; postal = `\uFEFF` error แล้วแก้เป็นค่าจริง → บันทึกได้ modal ปิด | pass (7/7) | `02-qa-edit-address-u2060-error.png` |
| AC-162 / กฎ 121b: ที่อยู่ใบเสร็จหน้าโปรไฟล์ (`account-billing-address-editor`) ทาง add city = `\u200B` → `error-message` ข้อความเดียวกัน ไม่สร้างที่อยู่ ค่ายังอยู่; แก้เป็น `\u200Bวัฒนา\u200D` → บันทึก "วัฒนา" และ `is_default_billing` = true; ทาง update last_name = `\u200C\uFEFF` → error และ API ไม่เปลี่ยน | pass (2/2) | `03-qa-profile-billing-zwsp-error.png` |
| AC-162 / กฎ 121b: บัญชีตัดหัว/ท้ายแต่คงตรงกลาง: first `\uFEFFสมหญิง\u200D` → "สมหญิง", last `" \u2060รัก\u200Bดี\t"` → `"รัก\u200Bดี"`, address_1 คง `\u200C` ตรงกลาง, phone `\u200B081\u200B\u200B` → "081"; address_2 กับ province ที่มีแต่อักขระมองไม่เห็นบันทึกเป็น `""`; การ์ดที่อยู่ไม่แสดง null/undefined/`""` | pass | log ค่าที่บันทึกจาก API |
| AC-162(a) / กฎ 121a: checkout shipping company = `\u200B`, province = `\u200C\u200D`, phone = `" \uFEFF\u2060 "` บันทึกลง cart เป็น `""` ทั้งสาม; first `\u200Bสมชาย\u200B` → "สมชาย"; last `"ใจ\u200Bดี"` คงตรงกลาง; ใบเสร็จแยก company `\u200Bบริษัท\u200Bเอ\u200B` → `"บริษัท\u200Bเอ"`, province/phone = `\u200B` → `""`; redirect ไปขั้น delivery ได้ | pass | log cart |
| AC-162(a): cart digital-only billing company/province/phone มีแต่อักขระมองไม่เห็น → ไปขั้น payment ได้ cart เก็บ `""`; หน้า review และ `/order/<id>/confirmed` ไม่มีอักขระมองไม่เห็นและไม่มี null/undefined/`""`; ที่อยู่ของ order ใน admin API ไม่มีอักขระมองไม่เห็น | pass | `04-qa-digital-review-optional-empty.png` |
| AC-162 unit + grep: `src/core-63-address-invisible.test.ts`; `const REQUIRED_ADDRESS_FIELDS` และ `const MISSING_ADDRESS_MESSAGE` มีที่เดียวคือ `src/lib/util/address-required.ts` | pass (Vitest ทั้งชุด 1173/1173, 100 ไฟล์) | ผล test |
| Regression AC-157 (CORE-58): e2e และ Vitest ผ่านโดยไม่แก้ assertion | pass (e2e 2/2; `core-58-address-invisible.test.ts`) | ผล test |
| Regression AC-147 (CORE-52): checkout guards ที่ 1280×800 และ 375×812 | pass (12/12) | ผล test |
| Regression AC-81 / AC-112: error ของ API แปลเป็นไทย ไม่มี "Error:"; ฟอร์มบัญชีล้มด้วย 500/network แล้วค่าที่พิมพ์ยังอยู่ | pass (`error-message.test.ts` และ e2e `core-23c` 5/5) | ผล test |
| Regression: checkout บันทึก phone แล้วแก้ให้ว่าง → phone ใน cart เป็น `""` | pass | ผล test |

รวม: spec ของ qa (ไม่ commit) 30/30, รอบสุดท้ายรวมกับ e2e ของ builder 31/31; regression e2e 23/23 (`core-52-checkout-guards`, `core-23c-account-forms`, `core-22`, `ev-7c`)

## Negative / edge case

| กรณี | ผล |
|---|---|
| ดับเบิลคลิกบันทึกในฟอร์มเพิ่มที่อยู่ ขณะ city = `\u200B` | server action 1 ครั้ง, `address-error` 1 อัน, ไม่สร้างที่อยู่ — pass |
| ดับเบิลคลิกบันทึกค่าที่ถูก (city = `\u200Bวัฒนา\u200B`) | server action 1 ครั้ง, สร้างที่อยู่ 1 รายการ city = "วัฒนา" — pass |
| 375×812: ฟอร์มเพิ่มที่อยู่ city = `\u200B` | error ไทยมองเห็น อยู่ภายใน 375px ไม่ล้นแนวนอน — pass |
| 375×812: ที่อยู่ใบเสร็จหน้าโปรไฟล์ city = `\u200B` | error ไทยมองเห็น ไม่สร้างที่อยู่ — pass |
| แก้ที่อยู่ phone ว่าง หรือ = `\u200B` | phone เดิมยังอยู่เพราะไม่ส่ง key (กฎ 121b); company/province = `\u200B` / `\u2060` ถูกล้างเป็นว่าง การ์ดซ่อน `address-company` — pass |
| ที่อยู่ใบเสร็จหน้าโปรไฟล์ (ทาง update) phone = `\u200B` | บันทึกสำเร็จ phone เดิมยังอยู่ ตรงกฎ 121b — pass |

## Defect
ไม่พบ

## ข้อสังเกต (ไม่ใช่ defect ของ PR นี้)
- **O-1:** `docs/spec/01-core-medusa.md` บรรทัด 2498, 2499, 2502 (ข้อความ AC-162) มีอักขระ U+200B ดิบ ผู้อ่านเห็นเป็น `""` เปล่า — มีอยู่บน develop ตั้งแต่ `8244d9cf` ควรแก้เป็น escape ใน PR เอกสารรอบถัดไป
- **O-2:** หน้าโปรไฟล์และฟอร์มแก้ที่อยู่ ลูกค้าลบเบอร์โทรออกไม่ได้ (ว่างหรือ `\u200B` → phone เดิมยังอยู่ แต่ฟอร์มแสดงว่าบันทึกสำเร็จ) ตรงกฎ 121b ("คงพฤติกรรมเดิม") ไม่ใช่ defect แต่ผู้ใช้อาจสับสน — ให้ owner ตัดสินถ้าต้องการเปลี่ยน
- **O-3:** อักขระมองไม่เห็นกลางข้อความ เช่น `"ใจ\u200Bดี"` ถูกเก็บไว้ ตรงกฎ 116a/121 ที่ตัดเฉพาะหัว/ท้าย
