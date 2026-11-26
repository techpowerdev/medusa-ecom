# 10 หน้า admin ของเราแสดงภาษาไทยผ่าน i18n ของ Medusa admin (AI18N)
Status: draft (planner 2026-11-26 — ADR-031 เสนอ; รอ owner ตอบ Q1)
Goal (owner's words, 2026-11-26): ทาง "ข" — หน้า admin หลักของ Medusa มีไทยในตัวแล้ว ให้**หน้า/widget ที่เราเขียนเอง**แสดงไทยเมื่อผู้ใช้เลือกไทย (และอังกฤษเมื่อเลือกอังกฤษ)
ด้วย i18n ของ Medusa admin · "แค่ปรับเพิ่มภาษา" ไม่เปลี่ยน layout/พฤติกรรม/โครง component · task ไม่ย่อยเกินไป · ทำแบบ stack ได้
Out of scope: หน้าหลักของ Medusa (ไทยในตัวแล้ว), storefront (ADR-014), แก้ถ้อยคำภาษาอังกฤษเดิม, แปลข้อความ error จาก backend (ADR-031 ข้อ 5), อีเมล/notification,
ข้อมูลที่แอดมินกรอก (ชื่อแคมเปญ/สินค้า), เปลี่ยน `data-testid`/API/route/พฤติกรรม, ภาษาอื่นนอกจาก `en`/`th`

เหตุที่เป็น spec ใหม่ (ไม่ต่อท้าย spec 08): spec 08 ยาว >1,300 บรรทัดและเป็นเรื่อง "ใช้ component ของ Medusa" — งานนี้เป็นฟีเจอร์แยก (ภาษา) มีเลข AC/กฎของตัวเอง
แบบเดียวกับที่ spec 09 แยกจาก spec 01; spec 08 เพิ่มเพียงหมายเหตุอ้างกลับ (Out of scope, กฎ 12) — กฎของ spec 08 ยังใช้ครบ

## ขอบเขต (นับจาก origin/develop `61e285c8`)
heuristic = ตำแหน่งข้อความอังกฤษที่ regex จับได้ (นับต่ำ — ไม่จับข้อความหลายบรรทัด/template/ตัวพิมพ์เล็ก) ประมาณข้อความจริงรวม ~450–600

| กลุ่ม (namespace) | ไฟล์ | บรรทัดรวม | heuristic |
|---|---|---|---|
| ส่วนร่วม (`ecom-common`) | `components/common/*` (8), `lib/{fetch-error,form-validation,page-offset,single-flight,combobox-escape}.ts` | ~360 | 4 ข้อความ UI (prompt ออกจากฟอร์ม) ที่เหลือเป็น comment/ค่าภายใน |
| group buy + flash sale (`ecom-group-buy`) | `routes/group-buying/{page,[id]/page}.tsx`, `components/group-buy/*` (4), `lib/group-buy{,-form,-campaign}.ts`, `widgets/flash-sale-options.tsx`, `lib/flash-sale-form.ts` | ~1,690 | 123 |
| e-voucher + widget order/variant (`ecom-evoucher`) | `routes/evouchers/{page,pools/[id]/page}.tsx`, `components/evoucher/*` (5), `lib/evoucher*.ts` (9), `widgets/{order-evouchers,variant-evoucher-pool,order-refund-blocked}.tsx`, `lib/order-refund-blocked.ts` | ~1,830 | 112 |
| affiliate (`ecom-affiliate`) | `routes/affiliate/page.tsx`, `components/affiliate/*` (8), `lib/affiliate*.ts` (5) | ~2,060 | 116 |

## What Medusa already gives us
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ไฟล์คำแปลของ extension | `src/admin/i18n/index.ts` + `json/` ([Translate Admin Customizations](https://docs.medusajs.com/learn/fundamentals/admin/translations)) รวมเข้ากับ resource ของ dashboard (`deepMerge`) | use as-is — namespace ของเรา 4 ตัว (ADR-031 ข้อ 2) |
| แปลใน component | `useTranslation("<ns>")` ของ `react-i18next` (instance เดียวกับ dashboard; dep เดิม 13.5.0) | use as-is |
| แปลนอก component | `getI18n()` ของ `react-i18next` | extend — helper `src/admin/i18n/t.ts` ตัวเดียว (ADR-031 ข้อ 4) |
| ตัวเลือกภาษา + จำค่า | Settings → Profile (`i18n.changeLanguage`) + detector cookie/localStorage `lng` | use as-is — ไม่สร้างตัวเลือกภาษาเอง |
| ภาษาไทยของคำทั่วไป | `th.json` ของ dashboard (`actions.save/cancel/edit/delete/create` ฯลฯ ใน namespace `translation`) | use as-is — อ้าง key ของ Medusa เมื่อค่า `en` ตรงกับข้อความเดิม (กฎ 6) |
| label เมนูด้านข้าง + document title | `defineRouteConfig({ label, translationNs })` (`@medusajs/admin-sdk` 2.22.1) | use as-is |
| ข้อความของ `DataTable`/แบ่งหน้า/filter/`usePrompt` ปุ่มเริ่มต้น | แปลโดย dashboard อยู่แล้ว | use as-is (ข้อความที่เราส่งเข้า prop แปลเอง) |
| วันที่ตามภาษา | `useDate` ใช้ `date_locale` ของภาษาที่เลือก | use as-is (ADR-018) |
| type ของ key (`i18next.d.ts`) | มีใน docs | ไม่ใช้รอบนี้ (ADR-031 ข้อ 10) — unit ตรวจ key แทน |
| e2e ล็อกภาษา | ไม่มี | custom — `storageState` ใน `ADMIN_UI_OPTIONS` (กฎ 12) |

## Data model (only new/changed)
none

## Workflows (name, steps, compensation)
none

## API routes (store / admin), auth, request/response shape
none

## Admin UI (widgets/pages) and Storefront pages
- ไม่มีหน้าใหม่; ทุก route/widget/component ในตาราง "ขอบเขต" เปลี่ยนข้อความเป็น `t()` — โครง JSX, testid, ลำดับ element คงเดิม
- ไฟล์ใหม่: `src/admin/i18n/t.ts`, `src/admin/i18n/json/{en,th}/{ecom-common,ecom-group-buy,ecom-evoucher,ecom-affiliate}.json`
- Storefront: none (แก้เฉพาะ `apps/storefront/e2e/` — กฎ 12–13)

## Glossary (ไทยของคำหลัก — ใช้ตรงกันทุก namespace)
ที่มา: storefront (`apps/storefront/src`) และ `th.json` ของ dashboard 2.22.1; owner แก้ได้ใน review ของ PR เอกสารนี้

| อังกฤษ | ไทย | ที่มา |
|---|---|---|
| Group buy / Group buying | ซื้อกลุ่ม | storefront |
| Campaign | แคมเปญ | th.json |
| Group / Pool group / Team | กลุ่ม / กลุ่มของร้าน / ทีม | storefront ("ทีม"); "กลุ่มของร้าน" = pool ที่แอดมินสร้าง |
| Member(s) | สมาชิก | — |
| Target | เป้าหมาย | spec 00 |
| Flash sale | แฟลชเซล | storefront |
| Per-customer limit / Total cap / Units sold | จำกัดต่อลูกค้า / จำนวนรวมสูงสุด / ขายแล้ว | — |
| Countdown / Remaining / Banner text | นับถอยหลัง / คงเหลือ / ข้อความแบนเนอร์ | — |
| E-voucher | บัตรกำนัล | storefront (แยกจาก Gift card = "บัตรของขวัญ" ของ Medusa) |
| Partner | พาร์ทเนอร์ | storefront, spec 00 |
| Pool (คลังโค้ด e-voucher) | คลังโค้ด | — |
| Code / Reveal / Resend / Allocate / Import codes | โค้ด / แสดงโค้ด / ส่งอีกครั้ง / จัดสรรโค้ด / นำเข้าโค้ด | — |
| available / allocated / delivered / void | พร้อมใช้ / จัดสรรแล้ว / ส่งแล้ว / ยกเลิกแล้ว | — |
| Backordered | รอโค้ด | — |
| Affiliate | แอฟฟิลิเอต | storefront |
| Program / Commission / Commission rate | โปรแกรม / ค่าคอมมิชชัน / อัตราค่าคอมมิชชัน | storefront |
| Ledger | รายการบัญชี | — |
| Payout / Payout info / Mark paid | การจ่ายเงิน / ข้อมูลรับเงิน / ทำเครื่องหมายว่าจ่ายแล้ว | storefront ("การจ่ายเงิน") |
| Approve / Suspend / Reactivate | อนุมัติ / ระงับ / เปิดใช้อีกครั้ง | — |
| Order / Product / Variant / Customer / Promotion | คำสั่งซื้อ / สินค้า / ตัวเลือก / ลูกค้า / โปรโมชั่น | th.json |
| Refund | คืนเงิน | storefront |
| draft / active / ended / published / pending / paid / canceled | ฉบับร่าง / ใช้งานอยู่ / สิ้นสุดแล้ว / เผยแพร่ / รอดำเนินการ / จ่ายแล้ว / ยกเลิกแล้ว | th.json (ยกเว้น ended/paid) |
| Save / Cancel / Edit / Delete / Create | key `actions.*` ของ Medusa (บันทึก / ยกเลิก / แก้ไข / ลบ / สร้าง) | th.json |

คงละติน: ชื่อเฉพาะ/หน่วย/รหัส (`THB`, `CSV`, `URL`, `ID`, ค่าของ code), ข้อมูลจาก backend

## Business rules (numbered, testable)
1. กลไกเดียว: i18n ของ Medusa admin — `src/admin/i18n/index.ts` default export `{ en: { <ns>: json }, th: { <ns>: json } }` ครบ 4 namespace (ADR-031 ข้อ 2) import JSON ด้วย
   `with { type: "json" }`; ไม่มี key ใน namespace `translation`; ไม่เพิ่ม dependency i18n ใน runtime; ไม่มี provider/detector/ตัวเลือกภาษาของเรา
2. ไฟล์ JSON ต่อ namespace ต่อภาษา `src/admin/i18n/json/<lang>/<ns>.json`; แต่ละ task แก้เฉพาะไฟล์ของ namespace ตัวเอง (`index.ts` แก้ใน AI18N-1 เท่านั้น — ลงทะเบียนครบ 4 ns ตั้งแต่ต้น)
3. ค่า `en` = ข้อความอังกฤษเดิมตรงตัว (รวมช่องว่าง/เครื่องหมาย); ข้อความที่ประกอบจากหลายท่อนใช้ interpolation `{{name}}` โดยผล `en` เท่าเดิมทุกตัวอักษร
4. component ใช้ `const { t } = useTranslation("<ns>")`; โค้ดนอก component (lib, zod, `handle.breadcrumb`, ค่าคงที่ที่เป็นข้อความ) ใช้ `t` จาก `src/admin/i18n/t.ts`
   (`(ns, key, options?) => getI18n().t(key, { ns, ...options })`; ยังไม่ init → throw) และ**ต้องเรียกตอนรันเท่านั้น** — ห้ามเก็บผลของ `t` ในค่าคงที่ระดับ module
   (ค่าคงที่เดิมเช่น `INVALID_DATE`, `DISCOUNT_VALUE_MESSAGE` เปลี่ยนเป็น function); ย้ายค่าคงที่ที่มีข้อความเข้า component/hook ได้เพื่อเรียก `t` โดย render เท่าเดิม
5. parity: ทุก key ใน `en` มีใน `th` และกลับกันต่อ namespace (plural: `en` มี `_one`/`_other`, `th` มี `_other` — เทียบหลังตัด suffix); ชุด `{{var}}` ของสองภาษาเท่ากัน;
   ค่า `th` ทุกตัวมีอักษรไทย ยกเว้น key ที่อยู่ในรายการคงละตินของ test (ชื่อเฉพาะ/หน่วย)
6. key ที่ใช้ในโค้ดแบบ literal (`t("…")`, `t(ns, "…")`, `label` ที่มี `translationNs`) มีใน `en` ของ namespace นั้น; อ้าง key ของ Medusa ได้เฉพาะ `t("<key>", { ns: "translation" })`
   ที่ key มีใน `en.json` ของ dashboard และค่า `en` เท่าข้อความเดิม (เช่น `actions.save` = "Save")
7. status/enum: แสดงด้วย `t(\`<prefix>.${value}\`, { defaultValue: value })` — ค่าที่ไม่รู้จักแสดงค่าดิบ; ทุกค่าใน array ค่าคงที่ของ enum (เช่น `CODE_STATUSES`) มี key ครบ;
   ค่าที่ส่ง API, ค่าใน URL (`<prefix>_status` ฯลฯ) และ `value` ของ filter ไม่เปลี่ยน
8. ข้อความจาก backend (`error.message` ของ API) แสดงตามที่ได้รับ; ข้อความ fallback/คำนำ/ข้อความ validation ที่ฝั่ง admin สร้างแปลตามภาษา
9. เมนูด้านข้าง: `defineRouteConfig({ label: "<key>", translationNs: "<ns>" })`; breadcrumb (`handle.breadcrumb`) ใช้ `t` ของกฎ 4 (ชื่อแคมเปญ/pool จาก loader คงเดิม)
10. ไม่เปลี่ยน: `data-testid`, โครง JSX/ลำดับ element, className, พฤติกรรม/การกันกดซ้ำ, request, เงิน (`getLocaleAmount`), วันเวลา (`useDate`/`DatePicker`)
11. ภาษาอื่นที่ผู้ใช้เลือก (เช่น `de`) → ข้อความของเรา fallback เป็น `en` (ไม่แสดง key ดิบ)
12. e2e admin ทุกไฟล์รันด้วย `lng=en` (cookie `lng` + localStorage `lng` ของ origin backend ผ่าน `storageState` ใน `ADMIN_UI_OPTIONS`) เพิ่มจาก `locale`/`timezoneId` ของ spec 08 กฎ 12 —
    ข้อยกเว้น 4 ข้อของการหาด้วยชื่อ (CLAUDE.md, ADR-018) ใช้ชื่อจาก `en`; e2e ห้ามเปลี่ยนภาษาของผู้ใช้กลางทาง (spec 08 AC-3)
13. e2e ภาษาไทยใช้ `ADMIN_UI_OPTIONS_TH` (เหมือนกฎ 12 แต่ `lng=th`) และสร้างค่าที่คาดจากไฟล์ `json/th/<ns>.json` ผ่าน helper ใน `support/admin.ts` (ไม่ hard-code ประโยคไทย)
    + ตรวจอักษรไทย `/[฀-๿]/`; เคส `lng=en` ของ element เดียวกันต้องไม่มีอักษรไทย
14. guard static (`src/admin/__tests__/i18n.unit.spec.ts`): ไฟล์ `.ts/.tsx` ใน `src/admin` (ยกเว้น test, `i18n/`) ที่ไม่อยู่ใน `I18N_PENDING` ต้องไม่มีข้อความ UI ฮาร์ดโค้ด =
    (a) JSX text ที่มีตัวอักษรละติน ≥ 2 ตัวติดกัน, (b) string literal ที่มีคำละตินเป็นค่าของ prop/key `title`, `label`, `placeholder`, `heading`, `subHeading`, `description`, `message`,
    `confirmText`, `cancelText`, `children`, `text`, (c) argument แรกของ `toast.*(`, `new FormError(`, `new Error(` ที่ถูกแสดงต่อผู้ใช้ (รายการไฟล์ที่ throw ไปแสดงอยู่ใน test) —
    ยกเว้น token ใน allowlist ของ test (ชื่อเฉพาะ/หน่วย เช่น `THB`, `CSV`) และค่าที่ไม่ใช่ข้อความแสดงผล (`displayName`, `method`, `variant`, key ของ query);
    `I18N_PENDING` แบ่ง key ต่อกลุ่ม (`groupBuy`, `evoucher`, `affiliate` — แต่ละ key อยู่คนละบรรทัดคั่นด้วยบรรทัดที่ไม่เปลี่ยน) task ของกลุ่มลบไฟล์ของตัวเองออก;
    ไฟล์ใน PENDING ที่ไม่มีข้อความฮาร์ดโค้ดแล้ว → test ล้ม (กันลืมลบ แบบ `ICON_PENDING`); หลัง AI18N-4 ทุก key ว่าง
15. (เฉพาะเมื่อ owner ตอบ Q1 = ข) `src/admin/i18n/index.ts` ตั้ง localStorage `lng=th` เมื่อยังไม่มีทั้ง cookie และ localStorage `lng` ก่อน export — ไม่ทับค่าที่ผู้ใช้เลือกแล้ว
16. dependency: `i18next` 23.7.11 (exact, devDependency — ใช้เฉพาะ jest setup) = เวอร์ชันใน `@medusajs/dashboard/package.json`; `react-i18next` คง 13.5.0 = ของ dashboard

## Acceptance criteria (Given/When/Then, numbered AC-1..n)
- AC-1 (AI18N-1, กฎ 1–2) unit: Given `src/admin/i18n/index.ts` When import ใน jest Then key ระดับบน = `["en","th"]` และแต่ละภาษามี namespace ตรง 4 ตัวของ ADR-031 ข้อ 2 ไม่มี `translation`;
  ไฟล์ JSON 8 ไฟล์มีอยู่และ parse ได้
- AC-2 (AI18N-1, กฎ 5) unit parity: Given ไฟล์ `en`/`th` ของแต่ละ namespace Then ชุด key (หลัง normalize plural) เท่ากัน, ชุด `{{var}}` ต่อ key เท่ากัน, ค่า `th` มีอักษรไทย (ยกเว้น allowlist);
  เคสลบ key หนึ่งตัวออกจาก fixture `th` ในตัว test → ฟังก์ชันตรวจคืน key นั้น
- AC-3 (AI18N-1, กฎ 6) unit: ทุก key literal ที่ regex หาได้ใน `src/admin/**` มีใน `en` ของ namespace ที่ระบุ; key ที่อ้าง `ns: "translation"` มีใน `en.json` ของ dashboard และค่าเท่ากับข้อความในตาราง
  ที่ test ระบุ; เคส fixture key ไม่มีอยู่ → ฟังก์ชันตรวจคืน key นั้น
- AC-4 (AI18N-1..4, กฎ 4, 8, 11) unit lazy: Given jest setup init `react-i18next` ด้วย resource จริง `lng=en` When เรียกตัวแทนของกลุ่ม (common: `t("ecom-common", <key ของหัวข้อ prompt>)` ของ helper `t.ts`;
  group buy: `toCampaignBody({ ...emptyCampaignForm(), name: "" })`; e-voucher: `poolFormSchema.safeParse` ที่ไม่เลือก partner; affiliate: `toPayoutBody` ที่ไม่เลือก affiliate) Then ได้ข้อความอังกฤษเดิมตรงตัว
  (ค่าที่ unit เดิม assert); When `changeLanguage("th")` แล้วเรียกซ้ำ Then ได้ค่าจาก `th` (มีอักษรไทย); When `changeLanguage("de")` Then ได้ค่า `en`; unit เดิมทั้งหมดผ่านโดยไม่แก้ assertion ข้อความ
- AC-5 (AI18N-1..4, กฎ 14) guard static ผ่าน; เคส fixture (สตริง `<Text>Hello world</Text>`, `toast.success("Saved")`, `label: "Edit"`) ถูกจับ และ `t("x")`/`displayName = "NumberInput"` ไม่ถูกจับ;
  หลัง AI18N-4 `I18N_PENDING` ทุก key ว่าง
- AC-6 (AI18N-1, กฎ 12, 16) unit: `ADMIN_UI_OPTIONS.storageState` มี cookie `lng=en` และ localStorage `lng=en` ของ origin `BACKEND_URL`; `ADMIN_UI_OPTIONS_TH` ต่างกันเฉพาะค่า `th`;
  ทุกไฟล์ e2e ที่ `loginAdmin` ใช้ `ADMIN_UI_OPTIONS` หรือ `ADMIN_UI_OPTIONS_TH` (ข้อตรวจเดิมของ `admin-options.unit.spec.ts` ขยาย); `deps.unit.spec.ts`: `i18next`, `react-i18next` เท่ากับของ dashboard
- AC-7 (AI18N-1..4, กฎ 3, 10) e2e admin เดิมทั้งชุด (`apps/storefront/e2e/*admin*.spec.ts` และไฟล์อื่นที่ใช้ `ADMIN_UI_OPTIONS`) ผ่านโดย `git diff` ของไฟล์ spec เหล่านั้นว่าง
  (ยกเว้น `support/admin.ts`, `support/admin-options.unit.spec.ts`); static test เดิมใน `src/admin/__tests__` ที่ match ข้อความอังกฤษใน source (เช่น `"Group buying"`, `"Create campaign"`,
  `"Could not load codes"`) แก้ให้ match key แทนโดยคงเจตนาเดิม
- AC-8 (AI18N-1, กฎ 13) e2e `admin-i18n-common.spec.ts`: Given `lng=th` When เปิดฟอร์มสร้าง partner ที่ `/evouchers` พิมพ์ชื่อแล้วกด Escape Then prompt แสดงหัวข้อ/คำอธิบาย/ปุ่มเท่าค่า `th` ของ
  `ecom-common` (หา element ด้วย role ภายใน dialog — ข้อยกเว้นข้อ 4) และมีอักษรไทย; Given `lng=en` Then เท่าค่า `en` และไม่มีอักษรไทย; Given `lng=th` Then ลิงก์ Settings ของ Medusa ในเมนูเป็นไทย
  (ยืนยันว่าเลือกภาษาผ่านกลไก Medusa จริง)
- AC-9 (AI18N-2, กฎ 7, 9, 13) e2e `admin-i18n-group-buy.spec.ts` (`lng=th`): ลิงก์เมนูด้านข้างของ group buying มีชื่อเท่าค่า `th`; หน้า `/group-buying` heading ของตารางเท่าค่า `th`;
  เปิด modal สร้างแคมเปญ (`FocusModal.Title` + label ช่องชื่อเป็นค่า `th`) กด Create โดยไม่กรอกชื่อ → error ใต้ช่องชื่อ (testid เดิม) เท่าค่า `th`; หน้า `/group-buying/:id` breadcrumb แรกและ badge สถานะ
  เป็นค่า `th`; หน้า campaign ที่มี widget `flash-sale-options` หัว widget และ title ของแถว Total cap เป็นค่า `th`; เคส `lng=en` ของ element เดียวกันไม่มีอักษรไทย
- AC-10 (AI18N-3, กฎ 7, 9, 13) e2e `admin-i18n-evoucher.spec.ts` (`lng=th`): เมนู + breadcrumb `/evouchers`, heading ตาราง Partners/Pools, หน้า pool (heading ตาราง Codes + label filter สถานะ +
  ป้ายสถานะ `available` เท่าค่า `th`), widget `variant-evoucher-pool` บนหน้า variant และ widget `order-evouchers` บนหน้า order ที่มี code เป็นค่า `th`; เคส `lng=en` ไม่มีอักษรไทย
- AC-11 (AI18N-4, กฎ 7, 9, 13) e2e `admin-i18n-affiliate.spec.ts` (`lng=th`): เมนู `/affiliate`, ชื่อแท็บ 4 แท็บ, heading ตารางของแต่ละแท็บ, ฟอร์มสร้างโปรแกรมส่งโดยไม่กรอกชื่อ → error ใต้ช่องเป็นค่า `th`,
  เมนูต่อแถวของ affiliate `pending` มี menuitem ชื่อเท่าค่า `th` ของ "Approve"; เคส `lng=en` ไม่มีอักษรไทย
- AC-12 (Q1 = ข เท่านั้น, กฎ 15) unit: Given ไม่มี `lng` ทั้ง cookie/localStorage (jsdom/mock `globalThis.localStorage`) When import `i18n/index.ts` Then localStorage `lng` = `th`;
  Given `lng=en` อยู่แล้ว Then ไม่เปลี่ยน; e2e AC-7 ยังผ่าน (ล็อก `en`)

## Non-functional (concurrency, idempotency, scale, observability)
- bundle: JSON คำแปล ~2 × 30KB รวมใน admin bundle; ไม่มี request เพิ่ม
- การเปลี่ยนภาษาไม่ reload หน้า: component ที่ใช้ `useTranslation` render ใหม่เอง; ข้อความจาก lib คำนวณใหม่ตอนเรียกครั้งถัดไป (error ที่แสดงอยู่แล้วคงภาษาเดิมจนกว่าจะ validate ใหม่ — ยอมรับ)
- concurrency/idempotency: none (ไม่แตะ request)

## Test plan: unit / integration / e2e, mapped to AC numbers
| ชนิด | AC |
|---|---|
| unit backend jest (`test:unit`; setup init i18n `en`) | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 (`deps`), AC-12 |
| unit storefront Playwright project `unit` | AC-6 (`admin-options.unit.spec.ts`) |
| integration | none (ไม่แก้ backend) |
| e2e admin (Playwright, `ADMIN_UI_OPTIONS`/`_TH`) | AC-7 (ชุดเดิม), AC-8, AC-9, AC-10, AC-11 |
qa เก็บ evidence ทุก task (หน้าโหมดไทย ≤ 5 รูป/งาน) ตาม CLAUDE.md ข้อ 6 · builder รัน e2e admin ทุก spec ที่อ้างหน้าที่ตัวเองแก้ (grep path/testid) ก่อน push

## Tasks (each = one PR, ≤ ~400 LOC, ordered, with dependencies)
เหตุที่เกิน ~400 LOC ได้ (owner 2026-11-26): ไฟล์คำแปล `en`+`th` และการแทนสตริงด้วย `t()` เป็นงานกลไกที่ review เป็นตาราง key ได้ — แบ่งตามกลุ่มฟีเจอร์ให้ reviewer ดูทีละโดเมน
แทนการแตกย่อยที่เพิ่มรอบ CI · **stack** (ADR-031 ข้อ 11): AI18N-1 แตกจาก `docs/admin-thai-i18n`; AI18N-2/3/4 แตกจาก branch ของ AI18N-1 (ขนานกันได้ ∥) → เปิด PR ทั้งชุดตอนท้าย → merge 1 → 2 → 3 → 4

| Task | งาน — ไฟล์ที่เป็นเจ้าของ | AC | Depends | ประมาณ diff |
|---|---|---|---|---|
| AI18N-1 | โครง i18n + ล็อกภาษาใน test + ส่วนร่วม: `src/admin/i18n/{index.ts,t.ts}`, `json/{en,th}/*.json` ทั้ง 8 ไฟล์ (`ecom-common` เต็ม, อีก 3 ns เป็น `{}`), `components/common/**`, `lib/{fetch-error,form-validation,page-offset,single-flight,combobox-escape}.ts` (ถ้ามีข้อความ), `src/admin/__tests__/{i18n.unit.spec.ts,i18n-setup.ts,deps.unit.spec.ts}` (guard + `I18N_PENDING` ทุกไฟล์ของกลุ่ม 2–4), `apps/backend/jest.config.js` (setup เฉพาะ `unit`), `apps/backend/package.json` + `pnpm-lock.yaml` (`i18next` dev), `apps/storefront/e2e/support/{admin.ts,admin-options.unit.spec.ts}`, `e2e/admin-i18n-common.spec.ts`; (Q1 = ข) กฎ 15 + AC-12 | AC-1..6, AC-7 (ชุดเดิม), AC-8, (AC-12) | PR เอกสารรอบ 46 (stack) | ~550 |
| AI18N-2 | group buy + flash sale: ไฟล์กลุ่ม `ecom-group-buy` ในตาราง "ขอบเขต" + `json/{en,th}/ecom-group-buy.json` + ลบ key `groupBuy` ใน `I18N_PENDING` + แก้ static เดิมที่ match ข้อความ (`group-buy-pages.unit.spec.ts`, จุดของกลุ่มใน `medusa-ui.unit.spec.ts`) + `lib/__tests__/i18n-group-buy.unit.spec.ts` + `e2e/admin-i18n-group-buy.spec.ts` | AC-4, AC-5, AC-7, AC-9 | AI18N-1 (stack) ∥ 3, 4 | ~700 |
| AI18N-3 | e-voucher + widget order/variant/refund-blocked: ไฟล์กลุ่ม `ecom-evoucher` + JSON ของตัวเอง + key `evoucher` ใน `I18N_PENDING` + static เดิมของกลุ่มใน `medusa-ui.unit.spec.ts` + `lib/__tests__/i18n-evoucher.unit.spec.ts` + `e2e/admin-i18n-evoucher.spec.ts` | AC-4, AC-5, AC-7, AC-10 | AI18N-1 (stack) ∥ 2, 4 | ~700 |
| AI18N-4 | affiliate: ไฟล์กลุ่ม `ecom-affiliate` + JSON ของตัวเอง + key `affiliate` ใน `I18N_PENDING` + static เดิมของกลุ่ม + `lib/__tests__/i18n-affiliate.unit.spec.ts` + `e2e/admin-i18n-affiliate.spec.ts` | AC-4, AC-5 (PENDING ว่างทั้งหมดหลัง merge), AC-7, AC-11 | AI18N-1 (stack) ∥ 2, 3 | ~750 |

- **ไฟล์ร่วม** (ตัวที่ merge ทีหลัง sync): `src/admin/__tests__/i18n.unit.spec.ts` (แต่ละ task แก้เฉพาะบรรทัด key ของกลุ่มตัวเองใน `I18N_PENDING`) ·
  `src/admin/__tests__/medusa-ui.unit.spec.ts` (แต่ละ task แก้เฉพาะ assertion ของไฟล์กลุ่มตัวเอง) · `src/admin/i18n/index.ts`, `support/admin.ts`, `package.json`/lockfile = AI18N-1 เท่านั้น
- AI18N-2..4 ไม่แตะ `components/common/**` (ถ้าพบข้อความร่วมที่ขาด ให้เพิ่ม key ใน namespace ของกลุ่มตัวเอง ไม่แก้ `ecom-common`)
- ไม่งด release: โหมดอังกฤษไม่เปลี่ยน ระหว่างทางโหมดไทยเป็นไทยบางกลุ่ม (ยอมรับ)

## Open questions
- **Q1 (owner)** ภาษาเริ่มต้นของเครื่องที่ยังไม่เคยเลือกภาษา: **ก** ตาม Medusa = อังกฤษ ผู้ใช้เลือกไทยครั้งเดียวต่อ browser ที่ Settings → Profile (planner แนะนำ — ไม่มีโค้ดเพิ่ม)
  หรือ **ข** ไทยเป็นค่าเริ่มต้น (กฎ 15 — ~10 บรรทัดใน AI18N-1, มีผลกับหน้าหลักของ Medusa ด้วย, พึ่งลำดับ detection ภายในของ dashboard ต้องตรวจซ้ำเมื่อ bump) —
  ภาษาเป็นค่าต่อ browser ไม่ใช่ต่อบัญชีทั้งสองทาง (ADR-031)
