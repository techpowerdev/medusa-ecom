# ADR-008 Storefront i18n (next-intl + cookie `_medusa_locale`), theme placeholder และรูปแบบ THB

สถานะ: accepted (owner อนุมัติ 2026-10-25: แตก CORE-4 เป็น 4a–4d + CORE-7, เนื้อหาต้นฉบับใน admin เป็นภาษาไทย, ADR นี้ครอบคลุมการใช้ Translation module ที่ยังเป็น experimental, แปล page metadata ใน task ของหน้านั้น)
— **ส่วน i18n ถูกแทนที่ (superseded) โดย [ADR-014](ADR-014-storefront-thai-only-defer-i18n.md) (owner, 2026-10-26)**: การตัดสินใจข้อ 1
(next-intl + `messages/*.json`; ส่วน Translation module คงไว้ที่ backend แต่ storefront ไม่ใช้), ข้อ 2 (locale จาก cookie), ส่วน cookie ของข้อ 3,
หัวข้อ "การแทนที่กฎใน CLAUDE.md" และตาราง "AC / ข้อกำหนดใน spec อื่น" **ไม่ใช้แล้ว** — ดู ADR-014
ข้อที่ยังมีผล: ข้อ 3 (e2e หาด้วย `data-testid` ไม่ match ด้วยข้อความ), ข้อ 4 (brand tokens + Noto Sans Thai), ข้อ 5 (THB), ข้อ 6 (Vitest)

## บริบท
CORE-4 (spec 01) ต้องส่งมอบ storefront ภาษาไทย + อังกฤษ, การจัดรูปแบบ THB และ brand theme
สภาพของ Medusa Next.js Starter (ADR-002) ตอนนี้:
- มีกลไก locale อยู่แล้ว: cookie `_medusa_locale` (`src/lib/data/locale-actions.ts`), header
  `x-medusa-locale` ที่ส่งไปทุก request ของ SDK (`src/lib/util/get-locale-header.ts`, `src/lib/config.ts`),
  `GET /store/locales` (`src/lib/data/locales.ts`) และ component `language-select` (มีตัวเลือก "Default")
- กลไกนี้แปลเฉพาะ **เนื้อหาจาก Medusa** (สินค้า, หมวดหมู่, collection) ผ่าน Translation module
  ซึ่งเป็น experimental และต้องเปิด feature flag ที่ backend ข้อความ UI ของ starter ยัง hard-code เป็นอังกฤษ
- `convertToLocale` (`src/lib/util/money.ts`) default `en-US` — `en-US` + THB ได้ `THB 1,000.00` ไม่ใช่ `฿1,000`
- Tailwind ใช้ preset ของ Medusa + ฟอนต์ Inter (ไม่มี glyph ภาษาไทย)
- storefront ยังไม่มี unit test runner
- CLAUDE.md กำหนดว่า "UI label ที่ test อ้างถึงคงเป็นอังกฤษจนกว่าจะตัดสินใจเรื่อง i18n" — ADR นี้คือการตัดสินใจนั้น

## ทางเลือก
ข้อความ UI
1. **next-intl** (ทำงานกับ App Router และ Server Components ได้ ใช้แบบ "without i18n routing" อ่าน locale จาก cookie)
2. dictionary ที่เขียนเอง (`getDictionary(locale)`) — ไม่ต้องเพิ่ม dependency แต่ต้องทำ pluralization, interpolation,
   client provider และ type ของ key เอง (สร้างสิ่งที่ library ทำได้ดีอยู่แล้ว)
3. ใช้ Translation module ของ Medusa เก็บข้อความ UI ด้วย — ไม่ได้ออกแบบมาสำหรับ UI string และทำให้ UI ขึ้นกับ backend

การเลือก locale
1. **cookie `_medusa_locale` ที่ starter มีอยู่** URL คงเป็น `/[countryCode]/...`
2. locale prefix ใน URL (`/[countryCode]/[locale]/...`) — ดีต่อ SEO หลายภาษา แต่ต้องแก้ middleware และลิงก์ทั้งหมดของ starter

รูปแบบ THB
1. **`Intl.NumberFormat` + `currencyDisplay: "narrowSymbol"` + จำนวนทศนิยมตามค่า** (0 เมื่อเป็นจำนวนเต็ม, 2 เมื่อมีสตางค์)
2. string template เอง (`"฿" + n.toLocaleString()`) — ต้องจัดการเครื่องหมายลบ/การปัดเศษเอง

## การตัดสินใจ (owner)
1. ข้อความ UI แปลด้วย **next-intl** (dependency ใหม่ของ `apps/storefront`) ไฟล์ข้อความ `messages/th.json`,
   `messages/en.json` เนื้อหาสินค้าใช้ **Translation module ของ Medusa** ผ่าน cookie `_medusa_locale` →
   header `x-medusa-locale` ที่ starter ทำอยู่แล้ว (ไม่เขียนกลไกใหม่) การเปิด Translation module ฝั่ง backend
   อยู่นอก CORE-4 (แยกเป็น task CORE-7 ใน spec 01)
2. locale ที่รองรับ: **th (default)** และ **en** เลือกผ่าน cookie `_medusa_locale` (ค่าเป็นรหัส BCP 47 ของ
   Medusa เช่น `th-TH`, `en-US`) ไม่มี locale prefix ใน URL locale ของ next-intl คือ language subtag ของ cookie
   (`en*` → `en`; ค่าอื่นทั้งหมด ไม่มี cookie หรือค่าว่าง → `th`)
3. e2e บังคับ locale ด้วยการตั้ง cookie `_medusa_locale` ใน Playwright context และหา element ด้วย
   `data-testid` (`getByTestId`) **ไม่ match ด้วยข้อความ** เมื่อต้องตรวจข้อความ ให้เทียบกับค่าใน `messages/<locale>.json`
   (import ไฟล์ ไม่ hard-code string ใน test)
4. brand: Tailwind tokens แบบ placeholder (สีกลาง กลุ่ม `brand`) + ฟอนต์ **Noto Sans Thai** ผ่าน `next/font/google`
   (ผูกเป็น CSS variable แล้วใช้เป็น `fontFamily.sans` ตัวแรก) owner เปลี่ยนค่า token ภายหลังโดยไม่ต้องแก้ component
5. THB แสดงเป็น `฿1,000` (ไม่มีทศนิยมเมื่อเป็นจำนวนเต็ม) และ `฿1,000.50` (2 ตำแหน่งเมื่อมีสตางค์) ทั้ง th และ en
   ใช้ `Intl.NumberFormat` กับ `currencyDisplay: "narrowSymbol"` (จำเป็นสำหรับ en ไม่เช่นนั้นจะได้ `THB`)
6. unit test ของ storefront ใช้ **Vitest** (dev dependency) — (บันทึกรอบ 12 ตาม review #166) environment ค่าเริ่มต้นของ suite คือ `node`; component test แบบ interactive
   ระบุ `jsdom` ทีละไฟล์ด้วย comment `// @vitest-environment jsdom` ที่หัวไฟล์ (ไม่เปลี่ยนค่าเริ่มต้นของทั้ง suite)

### การแทนที่กฎใน CLAUDE.md
กฎ "UI label ที่ test/screenshot อ้างถึงคงเป็นอังกฤษใน spec จนกว่าจะตัดสินใจเรื่อง i18n" **ถูกแทนด้วยข้อ 3** ข้างบน
(ไม่แก้ข้อความใน CLAUDE.md ตามที่ owner สั่ง) ตั้งแต่ ADR นี้ได้รับการอนุมัติ label ภาษาอังกฤษในเครื่องหมายคำพูดที่ปรากฏใน
spec ใดๆ ให้ตีความว่าเป็น **ข้อความ en ของ i18n key** ของ element นั้น ไม่ใช่ข้อความที่ test ใช้ค้นหา test ต้องใช้ `data-testid`

### AC / ข้อกำหนดใน spec อื่นที่กระทบ (ไม่แก้ spec เหล่านั้น — builder ใช้ตารางนี้)
| Spec | อ้างอิง | Label เดิม | ตีความใหม่ (en text / test id) |
|------|--------|-----------|------------------------------|
| 01 | AC-6, การตั้งค่า "ไม่มี guest" | "Add to cart" | en ของปุ่มเพิ่มลง cart; test id `add-product-button` (มีใน starter) |
| 01 | AC-3 | "My orders" | en ของเมนู orders; test id `orders-link`, รายการ `order-card` / `order-amount` (มีใน starter) |
| 02 | AC-6 | "My vouchers" | en ของหน้า/เมนู voucher; test id ใหม่กำหนดใน task ของ spec 02 |
| 03 | Business rule 4 | "Sold out" | en ของ badge sold out; test id ใหม่กำหนดใน task ของ spec 03 |
| 04 | Storefront UI, AC-16 | "Join", "Create team", "ชำระเงินภายใน <time>" | ข้อความ en/th ของปุ่มและข้อความนับเวลา; test id ใหม่กำหนดใน task ของ spec 04 |
| 05 | Storefront UI, AC-9 | "Earning now", "Coming soon" | en ของแท็บ; test id ใหม่กำหนดใน task ของ spec 05 |
| 06 | Storefront | "Card", "PromptPay" | en ของตัวเลือกการชำระเงิน; test id ใหม่กำหนดใน task ของ spec 06 |

## ผลที่ตามมา
+ ใช้กลไก locale ของ starter/Medusa ทั้งหมด เพิ่มเฉพาะ next-intl สำหรับ UI string
+ test ไม่พังเมื่อแก้คำแปลหรือเปลี่ยน default locale
+ ราคา THB เหมือนกันทุก locale จึงไม่ต้องส่ง locale เข้า `convertToLocale` ทุกจุดเรียก (~30 จุด)
− dependency ใหม่ 2 ตัว (`next-intl`, `vitest`) ต้องดูแลเวอร์ชันให้เข้ากับ Next.js 16
− ไม่มี locale ใน URL: search engine เห็นเฉพาะภาษาไทย (default) หน้าอังกฤษ index แยกไม่ได้ หากต้องการ SEO
  หลายภาษาภายหลังต้องเขียน ADR ใหม่ (ทางเลือก URL prefix)
− หน้าที่อ่าน cookie จะ render แบบ dynamic (starter อ่าน cookie อยู่แล้ว จึงไม่ใช่ต้นทุนใหม่)
− การแปล UI ทั้ง starter (~150 component) ต้องแตกเป็นหลาย PR (CORE-4b..4d)
− เนื้อหาสินค้าต้นฉบับที่กรอกใน admin ถือเป็นภาษาไทย ภาษาอังกฤษมาจาก Translation module (หลัง CORE-7)
