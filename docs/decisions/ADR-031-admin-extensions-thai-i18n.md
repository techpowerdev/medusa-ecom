# ADR-031 หน้า admin ที่เราเขียนเอง (`src/admin/**`) แสดงภาษาไทยผ่าน i18n ของ Medusa admin

สถานะ: **accepted** (owner 2026-11-26 — พร้อมคำตอบ spec 10 Q1 = ก ภาษาเริ่มต้นตาม Medusa และอนุมัติแก้ CLAUDE.md หัวข้อ Language) ·
เสนอโดย planner 2026-11-26 ตามคำตัดสิน owner (ทาง "ข" + "แค่ปรับเพิ่มภาษา" + task ไม่ย่อยเกินไป + ทำแบบ stack ได้) · แก้ตาม review PR เอกสาร: ข้อ 4 (ห้ามเรียก `t` ตอนโหลด module), ข้อ 8 (instance แยกใน jest)
เกี่ยวข้อง: spec 10 (task AI18N-1..4), ADR-018 (amend แถว #35 + หลักการ 7 — ดู "ผลต่อเอกสารเดิม"), ADR-014 ข้อ 6 (amend เฉพาะ admin extension),
spec 08 (Out of scope + กฎ 12), CLAUDE.md หัวข้อ Language (owner อนุมัติใน review)
เลข ADR: ADR-030 ล่าสุด, ADR-020/ADR-027 สงวนไว้ → ใช้ **ADR-031**

## บริบท
- owner (2026-11-26) ตัดสินแล้ว — ไม่เปิดคำถามซ้ำ:
  1. หน้า admin หลักของ Medusa มีไทยในตัวแล้ว (`@medusajs/dashboard@2.22.1` มี `src/i18n/translations/th.json`, `languages.ts` มี `code: "th"`) ผู้ใช้เลือกภาษาใน Settings → Profile
     → งานนี้ทำให้**หน้า/widget ที่เราเขียนเอง**แสดงไทยเมื่อเลือกไทย และอังกฤษเมื่อเลือกอังกฤษ ด้วยกลไก i18n ของ Medusa admin
  2. "แค่ปรับเพิ่มภาษา" — ไม่เปลี่ยน layout/พฤติกรรม/โครง component
  3. task ไม่ย่อยเกินไป (ลดรอบรอ CI) ยอมให้ diff เกิน ~400 LOC เมื่อเป็นไฟล์คำแปล/เปลี่ยนสตริงเป็น `t()` แบบกลไก; ทำแบบ stack ได้ (วิธีเดียวกับรอบ 44–45, ADR-030)
- กลไกของ Medusa (ตรวจจาก docs และโค้ดที่ติดตั้ง 2026-11-26):
  - [Translate Admin Customizations](https://docs.medusajs.com/learn/fundamentals/admin/translations) (ต้อง ≥ v2.11.1; เรา 2.22.1): JSON ต่อภาษาใน `src/admin/i18n/json/`,
    `src/admin/i18n/index.ts` export `{ <lang>: { <namespace>: json } }` (import ด้วย `with { type: "json" }`), ใช้ `useTranslation("<namespace>")` จาก `react-i18next`;
    docs แนะนำ**namespace ของตัวเอง**แทน `translation` เพื่อไม่ทับ key ของ Medusa; key ที่ไม่มีในภาษาที่เลือก fallback ไป `en`; รองรับ `{{var}}`, plural `_one`/`_other`, `Trans`
  - `@medusajs/dashboard/src/dashboard-app/dashboard-app.tsx:431` รวม resource ของ extension ด้วย `deepMerge`; `components/utilities/i18n/i18n.tsx` init i18next
    ด้วย `LanguageDetector` + `supportedLngs = Object.keys(resources)`
  - `src/i18n/config.ts`: `detection.order = ["cookie", "localStorage", "header"]`, `lookupCookie/lookupLocalStorage = "lng"`, `fallbackLng: "en"`, `fallbackNS: "translation"`
    → **ไม่อ่านภาษาของ browser** (`header` ไม่มีผลใน browser) เครื่องใหม่จึงเป็นอังกฤษจนกว่าผู้ใช้เลือก
  - `routes/profile/.../edit-profile-form.tsx`: เปลี่ยนภาษา = `i18n.changeLanguage(code)` เท่านั้น (ไม่บันทึกลง user ฝั่ง server) → **ภาษาเป็นค่าต่อ browser** (cookie/localStorage `lng`) ไม่ใช่ต่อบัญชี
  - `@medusajs/admin-sdk@2.22.1` `defineRouteConfig({ label, translationNs })` — label ของเมนูด้านข้างและ document title แปลผ่าน namespace (`nav-item.tsx`, `use-document-title.tsx`);
    `@medusajs/admin-vite-plugin` อ่าน `translationNs` เฉพาะเมื่อเป็น string literal (`isStringLiteral`) ค่าอื่นถูกทิ้งเงียบ
  - `@medusajs/dashboard/lib` (`optionalInt`/`optionalFloat`) เรียก `i18next.t("validation.mustBeInt")` ของ **instance กลาง** ตอนโหลด module — ใน jest ที่ไม่ init ได้ `"Invalid input"` ซึ่ง unit เดิมพึ่งอยู่
  - browser import โมดูลของ extension (virtual module) ก่อน `<I18n/>` ของ dashboard init → การเรียก `t` ตอนโหลด module ทำให้ admin ทั้งก้อนพัง
  - `@medusajs/admin-bundler` pre-bundle `react-i18next` ร่วมกับ dashboard (instance เดียว); `react-i18next@13.5.0` เป็น dependency ของเราอยู่แล้ว (= ของ dashboard) และ export `getI18n()`
  - `Form.ErrorMessage` ของ dashboard แสดง `error.message` ตรงๆ (ไม่แปล) → ข้อความ validation ต้องแปลตอนสร้าง
- ผลสำรวจ `src/admin/**` (origin/develop `61e285c8`): route 5 ไฟล์ (`affiliate`, `evouchers`, `evouchers/pools/[id]`, `group-buying`, `group-buying/[id]`), widget 4,
  component 25, lib 24 (+ unit test; `lib/client.ts` ไม่มีข้อความ UI) — นับตำแหน่งข้อความอังกฤษแบบ heuristic ได้ 386 จุด (นับต่ำ; ประมาณข้อความจริง ~450–600) แยกกลุ่มใน spec 10 หัวข้อ "ขอบเขต"
- e2e admin ~40 ไฟล์ใช้ `ADMIN_UI_OPTIONS` (`apps/storefront/e2e/support/admin.ts`) และหา menuitem/ปุ่มใน `action` ของ `DataTable`/`getByLabel` ด้วยชื่ออังกฤษ (ข้อยกเว้นของ ADR-018)

## ทางเลือก
กลไกแปล:
A. **i18n ของ Medusa admin** (`src/admin/i18n` + `useTranslation` + `translationNs`) — กลไกเดียวกับหน้าหลัก; ผู้ใช้เลือกภาษาที่เดียว
B. เขียนข้อความไทยตรงในโค้ดแบบ storefront (ADR-014) — ผู้ใช้ที่เลือกอังกฤษเห็นไทยปน, e2e ที่หาด้วยชื่ออังกฤษพังทั้งชุด, ขัดคำตัดสิน owner ข้อ 1
C. ไลบรารี/ตัวเลือกภาษาของเราเอง — สร้างซ้ำสิ่งที่ Medusa มี (CLAUDE.md ข้อ 1)

ข้อความนอก component (pure function ใน `lib/`, ข้อความ zod, `handle.breadcrumb`):
- ก. **helper ตัวเดียว `src/admin/i18n/t.ts`** เรียก `getI18n().t(key, { ns, ... })` ของ `react-i18next` ตอนรันจริง (ไม่ใช่ตอนโหลด module) — signature ของ lib ไม่เปลี่ยน, unit test เดิมผ่านเมื่อ jest init ภาษา `en`
- ข. ส่ง `t` เข้าทุก function/สร้าง schema ใน component — เปลี่ยน signature/โครงหลายสิบจุด ขัด "แค่ปรับเพิ่มภาษา"
- ค. `import i18next from "i18next"` ตรงใน lib — dev server ของ admin ไม่ pre-bundle `i18next` แยก เสี่ยงได้คนละ instance กับ dashboard

ข้อความจาก backend (error ของ admin route ของเรา/Medusa):
- ก. **แสดงตามที่ได้รับ** (แบบหน้า Medusa ที่ `toast.error(error.message)`) แปลเฉพาะข้อความ fallback/คำนำที่เราสร้าง
- ข. เพิ่ม error code ใน admin route แล้ว map เป็นข้อความไทยแบบ ADR-028 — เปลี่ยน backend หลาย route เกินกรอบ "แค่ปรับเพิ่มภาษา"

ภาษาเริ่มต้นของเครื่องที่ยังไม่เคยเลือก (spec 10 Q1 — owner 2026-11-26 เลือก **ก**):
- ก. **ตาม Medusa**: อังกฤษ (`fallbackLng: "en"`) ผู้ใช้เลือกไทยครั้งเดียวต่อ browser ที่ Settings → Profile — ไม่มีโค้ดเพิ่ม
- ข. ตั้งไทยเป็นค่าเริ่มต้น: `src/admin/i18n/index.ts` เขียน `lng=th` ลง localStorage เมื่อยังไม่มีทั้ง cookie/localStorage `lng` (รันก่อน `I18n` ของ dashboard init เพราะ module ถูก import ตอนโหลด app)
  — ~10 บรรทัด + unit; ผลกับหน้าหลักของ Medusa ด้วย (login/ทุกหน้าเป็นไทย); พึ่งลำดับ detection ภายในของ dashboard (`config.ts`) ที่ไม่ใช่ API ทางการ → ต้องตรวจซ้ำทุกครั้งที่ bump Medusa;
  e2e ไม่กระทบเพราะล็อก `lng=en` อยู่แล้ว

## การตัดสินใจ (accepted 2026-11-26)
1. ใช้ **A** — i18n ของ Medusa admin; ไม่มี dependency i18n ใหม่ใน runtime ไม่มี provider/detector/ตัวเลือกภาษาของเรา (ผู้ใช้เลือกที่ Settings → Profile ของ Medusa)
2. namespace ของเรา 4 ตัว (แยกตามกลุ่มฟีเจอร์ ให้แต่ละ task เป็นเจ้าของไฟล์ของตัวเอง): `ecom-common`, `ecom-group-buy` (รวม flash sale), `ecom-evoucher` (รวม widget order/variant),
   `ecom-affiliate`; ไฟล์ `src/admin/i18n/json/{en,th}/<ns>.json`; **ห้ามใส่ key ใน namespace `translation`** (จะทับข้อความของ Medusa)
3. ค่า `en` = ข้อความอังกฤษปัจจุบัน**ตรงตัว** (ไม่แก้ถ้อยคำ) → e2e/unit เดิมผ่านโดยไม่แก้; ค่า `th` ตาม glossary ใน spec 10
4. component ใช้ `useTranslation("<ns>")`; ข้อความนอก component ใช้ helper ทาง **ก** (`src/admin/i18n/t.ts` — ใช้จริง 3 กลุ่มขึ้นไปจึงไม่ขัดกฎ abstraction) เรียกตอนรันเท่านั้น:
   ห้ามเรียก `t`/helper ระดับบนสุดของไฟล์; ค่าคงที่ข้อความระดับ module เป็น function; schema zod ระดับ module ใช้ `{ error: () => t(...) }` ของ zod 4.2.0;
   ตรวจด้วย unit (`require` ทุก `lib/*.ts` ยกเว้น `client.ts` ใน `jest.isolateModules` ที่ยังไม่ init โดย mock `lib/client` เป็น `{ sdk: {} }` ต้องไม่ throw) + guard static แบบ AST สำหรับ `.tsx` (jest ไม่ transform `.tsx`) — spec 10 กฎ 4, 14
5. ข้อความจาก backend ทาง **ก** — แสดงตามที่ได้รับ; status/enum แสดงด้วย key ต่อค่า (ค่าที่ไม่รู้จักแสดงค่าดิบ) ค่าที่ส่ง API/อยู่ใน URL ไม่เปลี่ยน
6. เมนูด้านข้าง/ชื่อหน้า: `defineRouteConfig({ label: "<key>", translationNs: "<ns>" })` ของ Medusa (ทั้งสองค่าเป็น string literal — `translationNs` เพราะ plugin อ่านด้วย `isStringLiteral`, `label` เพื่อให้ guard ตรวจ key ได้); breadcrumb ใช้ helper ข้อ 4;
   คำทั่วไปที่ Medusa มี key แล้วและค่า `en` เท่าข้อความเดิมใช้ key ของ Medusa (`actions.*`, `general.unsavedChangesTitle/Description`)
7. เงิน/วันเวลา: คงตาม ADR-018 (`getLocaleAmount` ตาม locale ของ browser, `useDate` ตามภาษาของ admin — โหมดไทยได้ชื่อเดือนไทยตามพฤติกรรม Medusa)
8. test: e2e admin ทุกไฟล์**ล็อก `lng=en`** ผ่าน `ADMIN_UI_OPTIONS` (cookie + localStorage ของ origin backend) ข้อยกเว้น 4 ข้อของการหาด้วยชื่อ (ADR-018/CLAUDE.md) จึงยังใช้ชื่ออังกฤษ;
   e2e ใหม่ต่อกลุ่มตั้ง `lng=th` และสร้างค่าที่คาดจากไฟล์ `th` (ไม่ hard-code) + ตรวจอักษรไทย; unit ตรวจ parity en/th, key ที่ใช้มีจริง, lazy (สลับภาษาแล้ว lib ได้ข้อความตามภาษา),
   guard static ว่าไฟล์ที่แปลแล้วไม่มีข้อความ UI อังกฤษฮาร์ดโค้ด; jest ใช้ `i18next` เป็น devDependency (pin = เวอร์ชันของ dashboard `23.7.11`) และ setup สร้าง
   **instance แยก** `i18next.createInstance().use(initReactI18next).init(...)` (ให้ `getI18n()` คืนตัวนี้) — ห้าม init instance กลาง เพราะ `@medusajs/dashboard/lib` ใช้ instance กลางตอนโหลด
   และ unit เดิมพึ่งผล `"Invalid input"`
9. ภาษาเริ่มต้น: **ก** (ตาม Medusa — อังกฤษ ผู้ใช้เลือกไทยที่ Settings → Profile) owner 2026-11-26; ทาง **ข** ไม่ทำ
10. ไม่ใช้ `i18next.d.ts` (type ของ key) ในรอบนี้: ต้องประกาศ `CustomTypeOptions` ทั้งโปรเจกต์ admin ซึ่งเปลี่ยน type ของ `t` ที่ dashboard ใช้ร่วม — ใช้ unit ตรวจ key แทน
11. stack: AI18N-1 แตกจาก branch เอกสาร `docs/admin-thai-i18n`, AI18N-2..4 แตกจาก branch ของ AI18N-1 → เปิด PR ทั้งชุดตอนท้าย (base = `develop`) → merge 1 → 2 → 3 → 4 (sync ก่อนแต่ละตัว)
    — ข้อยกเว้นของ "ห้ามแตก branch จาก PR ที่ยังไม่ merge" เฉพาะชุด AI18N (owner อนุญาต 2026-11-26)

## ผลที่ตามมา
+ ผู้ใช้เลือกภาษาที่เดียว หน้าหลักของ Medusa และหน้าของเราเป็นภาษาเดียวกัน; โหมดอังกฤษเหมือนเดิมทุกตัวอักษร
+ e2e admin เดิมไม่ต้องแก้ (ยกเว้นตัวล็อกภาษาใน `support/admin.ts`)
− ข้อความ error จาก backend ยังเป็นอังกฤษในโหมดไทย (ปนภาษาใน toast) — ทำเป็นงานแยกได้ภายหลังแบบ ADR-028 ถ้า owner ต้องการ
− ภาษาเป็นค่าต่อ browser ไม่ตามบัญชี (พฤติกรรมของ Medusa)
− เพิ่มขั้นตอนเมื่อเขียนหน้า admin ใหม่: ทุกข้อความต้องมี key ใน `en` + `th` (guard บังคับ)
− PR ใหญ่กว่า ~400 LOC (คำแปล + เปลี่ยนเป็น `t()` แบบกลไก) — owner ยอมรับ

## ผลต่อเอกสารเดิม (มีผลแล้ว — accepted 2026-11-26)
- **CLAUDE.md** หัวข้อ Language (owner อนุมัติ 2026-11-26 — session หลักแก้ใน PR เอกสารนี้): "admin (`src/admin/`) คงภาษาอังกฤษ" →
  "admin (`src/admin/`) ข้อความ UI ผ่าน i18n ของ Medusa admin (`useTranslation` + `src/admin/i18n/json/{en,th}`) — `en` = ข้อความเดิม, `th` = คำแปล; e2e admin ล็อก `lng=en` ชื่ออังกฤษในข้อยกเว้น 4 ข้อมาจาก `en` (ADR-031)"
- **ADR-018** แถว #35 (`i18n/index.ts` "admin เป็นอังกฤษตาม CLAUDE.md") และหลักการ 7 ("ชื่ออังกฤษ") — ใส่หมายเหตุอ้าง ADR นี้ (ชื่ออังกฤษ = ค่า `en` ภายใต้การล็อก `lng=en`)
- **ADR-014** ข้อ 6 — admin extension ไม่ "คงภาษาอังกฤษ" แล้ว แต่สองภาษาตาม Medusa admin (storefront ไม่กระทบ)
- **spec 08** Out of scope ("แปล admin เป็นไทย") และกฎ 12 (`locale: "en-US"` + `lng=en`) — หมายเหตุอ้าง spec 10

## แหล่งอ้างอิง (ตรวจ 2026-11-26)
- https://docs.medusajs.com/learn/fundamentals/admin/translations
- https://docs.medusajs.com/resources/admin-components
- `node_modules/@medusajs/dashboard@2.22.1`: `src/i18n/config.ts`, `src/i18n/languages.ts`, `src/components/utilities/i18n/i18n.tsx`, `src/dashboard-app/dashboard-app.tsx`,
  `src/routes/profile/profile-edit/components/edit-profile-form/edit-profile-form.tsx`, `src/components/common/form/form.tsx`, `src/components/layout/nav-item/nav-item.tsx`
- `node_modules/@medusajs/admin-sdk` `dist/index.d.ts` (`RouteConfig.translationNs`), `@medusajs/admin-bundler` `dist/index.js` (`optimizeDeps.include` มี `react-i18next`),
  `@medusajs/admin-vite-plugin` `dist/index.js` (`translationNs` อ่านด้วย `isStringLiteral`)
- `@medusajs/dashboard@2.22.1` `src/i18n/translations/{en,th}.json` (`general.unsavedChangesTitle/Description`, `actions.*`, "available" = "พร้อมใช้งาน")
- `react-i18next@13.5.0` `dist/es/index.js` (`export { setI18n, getI18n }`)
