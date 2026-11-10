# ADR-014 storefront ภาษาไทยอย่างเดียวในระยะแรก — เลื่อน i18n (next-intl, locale cookie, language-select)

สถานะ: accepted (owner, 2026-10-26)
เกี่ยวข้อง: ADR-008 (supersede **เฉพาะส่วน i18n**), ADR-002, spec 01 (CORE-4b/4c/4d, CORE-7), spec 02–06 (ข้อความ UI storefront)

## บริบท
- ADR-008 ข้อ 1–3 ให้แปล UI ด้วย next-intl และเลือก locale จาก cookie `_medusa_locale` โดยคาดว่า "หน้าที่อ่าน cookie render แบบ dynamic
  อยู่แล้ว" (ADR-008 ผลที่ตามมา)
- builder CORE-4b พบว่า starter ตั้ง `export const dynamic = "force-static"` + `revalidate = 60` ใน 7 route (home, PDP, contact, terms,
  shipping, privacy, returns) ใน Next.js 16 หน้า `force-static` ได้ `cookies()` ว่าง → `<html lang>`/ข้อความตาม cookie ทำไม่ได้ (spec 01
  AC-15 เดิม) ถ้าจะทำต้องเปลี่ยนหน้าเหล่านั้นเป็น dynamic (เสีย cache/ISR ของหน้าที่ถูกเรียกบ่อยที่สุด) หรือใส่ locale ใน URL (rewrite
  middleware + ลิงก์ทั้ง starter) — ทั้งสองทางใหญ่เกินระยะแรก
- ร้านขายในไทยเท่านั้น (region เดียว THB) ลูกค้าระยะแรกใช้ภาษาไทย

## ทางเลือก
A. **ภาษาไทยอย่างเดียว เขียนข้อความไทยตรงในโค้ดแทนข้อความอังกฤษของ starter** ไม่มี next-intl/locale cookie/language-select
B. ทำ i18n ต่อแบบ dynamic SSR (เอา `force-static` ออกจาก 7 route) — เสีย static cache ของ home/PDP
C. ทำ i18n ต่อแบบ locale ใน URL (`/[countryCode]/[locale]/...` หรือ rewrite) — แก้ middleware และลิงก์ทั้ง starter, งานหลาย PR

## การตัดสินใจ (owner)
เลือก A
1. ข้อความ UI ของ storefront เป็น**ภาษาไทยเขียนตรงใน component** (รวม `metadata` title/description, ข้อความ error/ว่าง/loading ที่
   storefront สร้างเอง) ไม่มี `messages/*.json`, ไม่มี dependency `next-intl`
2. ไม่มี UI เลือกภาษา: เอา `language-select` ออกจากหน้า (nav/side menu) storefront ไม่ตั้ง cookie `_medusa_locale` เอง;
   `<html lang="th">` คงที่ (จาก CORE-4a); ไม่แตะ `force-static`/`revalidate` ของ starter
3. **ยังใช้จาก ADR-008**: ข้อ 4 (brand tokens + Noto Sans Thai), ข้อ 5 (THB `฿1,000`), ข้อ 6 (Vitest) และหลักของข้อ 3 ที่ว่า
   **e2e หา element ด้วย `data-testid` ไม่ match ด้วยข้อความ**; เมื่อ test ต้องตรวจว่า "เป็นภาษาไทย" ให้ตรวจว่ามีอักษรไทย
   (`/[฀-๿]/`) ไม่ hard-code ประโยคเต็ม (แก้ถ้อยคำได้โดย test ไม่พัง)
4. ข้อความที่ยกเว้นได้ (คงตัวอักษรละติน): ชื่อแบรนด์/ชื่อเฉพาะ (เช่น "PromptPay", "Visa", ชื่อร้าน), หน่วย/รหัส (เช่น `THB`, รหัส voucher),
   และ**ข้อมูลจาก backend** (ชื่อ/รายละเอียดสินค้า, option value, ที่อยู่, error message จาก Medusa API)
5. backend CORE-7 (Translation module + store locales `th-TH`, `en-US`) **คงไว้ไม่ถอด** แต่ storefront ไม่ใช้: ไม่มี cookie จึงไม่ส่ง header
   `x-medusa-locale` → Medusa คืนเนื้อหาต้นฉบับ (ภาษาไทย ตามข้อตัดสิน owner ใน spec 01 CORE-4 ข้อ 1)
6. Admin dashboard และ admin extension (`src/admin/`) อยู่นอก ADR นี้ (คงภาษาอังกฤษตาม Medusa admin)

### เงื่อนไขที่จะกลับมาทำ i18n
ต้องมี **ADR ใหม่** ที่เลือกระหว่างทางเลือก B (dynamic SSR — ต้องวัดผลกระทบ cache/latency ของ home/PDP) หรือ C (locale ใน URL — ดีต่อ
SEO หลายภาษา) โดยมีเหตุจากความต้องการจริง (เช่น ลูกค้าต่างชาติ, SEO ภาษาอังกฤษ) ข้อความไทยที่เขียนตรงในโค้ดตอนนี้จะกลายเป็นค่า `th`
ของ message key ในตอนนั้น (ต้นทุนการย้าย ~ เท่ากับงานแปลเดิม จึงไม่เสียงานซ้ำมาก)

### ข้อความ UI ใน spec อื่น (แทนตารางของ ADR-008)
label ภาษาอังกฤษในเครื่องหมายคำพูดที่ยังเหลือใน spec ให้ตีความว่าเป็น**ชื่อเรียก element** ไม่ใช่ข้อความที่แสดง; ข้อความจริงเป็นภาษาไทย
ตามคอลัมน์ "ข้อความไทย (เสนอ)" — owner อนุมัติให้เริ่มจากถ้อยคำนี้ (2026-10-26) แก้ภายหลังได้ไม่กระทบ test และ test หาด้วย test id
| Spec | อ้างอิง | ชื่อเรียกเดิม | ข้อความไทย (เสนอ) | test id |
|------|--------|-------------|-----------------|---------|
| 01 | AC-6, AC-44, การตั้งค่า "ไม่มี guest" | "Add to cart" | เพิ่มลงตะกร้า | `add-product-button` (มีใน starter) |
| 01 | AC-3 | "My orders" | คำสั่งซื้อของฉัน | `orders-link`, `order-card`, `order-amount` (มีใน starter) |
| 01 | CORE-15 | "Couldn't load products" | โหลดรายการสินค้าไม่สำเร็จ | `products-error` (มีอยู่แล้ว) |
| 02 | Storefront, AC-6 (EV-7) | "My vouchers" | บัตรกำนัลของฉัน | `vouchers-link`, `voucher-card`, `voucher-copy-button` |
| 03 | กฎข้อ 4, AC-13 e (FS-6) | "Sold out" / "เหลือ N ชิ้น" | สินค้าหมด / เหลือ N ชิ้น | `flash-sold-out`, `flash-remaining` |
| 04 | Storefront, AC-16 (GB-7) | "Join", "Create team", "ชำระเงินภายใน <time>" | เข้าร่วมกลุ่ม, สร้างทีม, ชำระเงินภายใน <เวลา> | `group-join-button`, `group-create-team-button`, `group-pay-deadline` |
| 05 | Storefront, AC-9 (AF-8) | "Earning now", "Coming soon", "Share" | ได้ค่าคอมมิชชันตอนนี้, เร็วๆ นี้, แชร์ | `affiliate-tab-earning`, `affiliate-tab-upcoming`, `affiliate-share-button` |
| 06 | Storefront (PAY-2 #48 กำลังทำ) | "Card", "PromptPay", "Pay with PromptPay", "Try again" | บัตรเครดิต/เดบิต, PromptPay, ชำระด้วย PromptPay, ลองอีกครั้ง | ใช้ test id ที่ PAY-2 ตั้ง — แปลข้อความหลัง #48 merge ใน CORE-4d |

## ผลที่ตามมา
+ ไม่มี dependency ใหม่ (`next-intl` ไม่ถูกติดตั้ง), ไม่ต้องแก้ `force-static` — home/PDP ยัง cache แบบ static ได้
+ งาน CORE-4b..4d เหลือการแทนข้อความในโค้ด (diff แบบ 1:1) ทำเป็น PR เล็กได้ และไม่ต้องรอ backend CORE-7
− ลูกค้าที่ไม่อ่านภาษาไทยใช้ร้านไม่ได้จนกว่าจะมี ADR i18n ใหม่
− ข้อความกระจายในโค้ด (ไม่มีไฟล์รวม) — ยอมรับในระยะแรก; ESLint rule กันข้อความอังกฤษใหม่หลุดเข้ามา (spec 01 หัวข้อ CORE-4 กฎข้อ 4)
− fixture ตั้ง cookie `_medusa_locale` ของ CORE-5 และ backend CORE-7 ยังอยู่แต่ไม่ถูกใช้โดย storefront
− e2e/AC ที่เขียนไว้แล้วซึ่งอ้างข้อความอังกฤษต้องหาด้วย test id (เป็นข้อกำหนดเดิมของ ADR-008 ข้อ 3 อยู่แล้ว)

## ข้อตัดสินเพิ่มเติม (owner, 2026-10-26)
- โค้ด locale เดิมของ starter (`get-locale-header`, `locale-actions`) และ helper cookie ของ CORE-5 **คงไว้** แม้ไม่ได้ใช้ (diff เล็ก ใช้ต่อได้ถ้ากลับมาทำ i18n)
- CLAUDE.md ปรับข้อ UI label ให้ตรงกับ ADR นี้แล้ว
