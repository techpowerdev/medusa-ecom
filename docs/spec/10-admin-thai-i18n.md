# 10 หน้า admin ของเราแสดงภาษาไทยผ่าน i18n ของ Medusa admin (AI18N)
Status: done — AI18N-1..4 ☑ (#594–#597, merge 2026-11-27; เอกสาร #593) · AC-1..11 ☑ (qa ไม่พบ defect — `docs/evidence/admin-i18n/AI18N-{1..4}/REPORT.md`)
(accepted owner 2026-11-26 — ADR-031 accepted, Q1 = ก; แก้ตาม review PR เอกสาร: blocker 1–3 + nit)
Goal (owner's words, 2026-11-26): ทาง "ข" — หน้า admin หลักของ Medusa มีไทยในตัวแล้ว ให้**หน้า/widget ที่เราเขียนเอง**แสดงไทยเมื่อผู้ใช้เลือกไทย (และอังกฤษเมื่อเลือกอังกฤษ)
ด้วย i18n ของ Medusa admin · "แค่ปรับเพิ่มภาษา" ไม่เปลี่ยน layout/พฤติกรรม/โครง component · task ไม่ย่อยเกินไป · ทำแบบ stack ได้
Out of scope: หน้าหลักของ Medusa (ไทยในตัวแล้ว), storefront (ADR-014), แก้ถ้อยคำภาษาอังกฤษเดิม, แปลข้อความ error จาก backend (ADR-031 ข้อ 5), อีเมล/notification,
ข้อมูลที่แอดมินกรอก (ชื่อแคมเปญ/สินค้า), เปลี่ยน `data-testid`/API/route/พฤติกรรม, ภาษาอื่นนอกจาก `en`/`th`, ตั้งไทยเป็นภาษาเริ่มต้น (Q1 = ก — owner 2026-11-26)

เหตุที่เป็น spec ใหม่ (ไม่ต่อท้าย spec 08): spec 08 ยาว >1,300 บรรทัดและเป็นเรื่อง "ใช้ component ของ Medusa" — งานนี้เป็นฟีเจอร์แยก (ภาษา) มีเลข AC/กฎของตัวเอง
แบบเดียวกับที่ spec 09 แยกจาก spec 01; spec 08 เพิ่มเพียงหมายเหตุอ้างกลับ (Out of scope, กฎ 12) — กฎของ spec 08 ยังใช้ครบ

## ขอบเขต (นับจาก origin/develop `61e285c8`)
`src/admin/**` (ไม่นับ test): route 5, widget 4, component 25, lib 24 · heuristic = ตำแหน่งข้อความอังกฤษที่ regex จับได้ (นับต่ำ — ไม่จับข้อความหลายบรรทัด/template/ตัวพิมพ์เล็ก)
ประมาณข้อความจริงรวม ~450–600

| กลุ่ม (namespace) | ไฟล์ | บรรทัดรวม | heuristic |
|---|---|---|---|
| ส่วนร่วม (`ecom-common`) | `components/common/*` (8), `lib/{fetch-error,form-validation,page-offset,single-flight,combobox-escape}.ts` | ~360 | ข้อความ UI 4 ข้อความ (prompt ออกจากฟอร์ม — 2 ข้อความใช้ key ของ Medusa) ที่เหลือเป็น comment/ค่าภายใน |
| group buy + flash sale (`ecom-group-buy`) | `routes/group-buying/{page,[id]/page}.tsx`, `components/group-buy/*` (4), `lib/group-buy{,-form,-campaign}.ts`, `widgets/flash-sale-options.tsx`, `lib/flash-sale-form.ts` | ~1,690 | 123 |
| e-voucher + widget order/variant (`ecom-evoucher`) | `routes/evouchers/{page,pools/[id]/page}.tsx`, `components/evoucher/*` (5), `lib/evoucher*.ts` (8), `widgets/{order-evouchers,variant-evoucher-pool,order-refund-blocked}.tsx`, `lib/order-refund-blocked.ts` | ~1,830 | 112 |
| affiliate (`ecom-affiliate`) | `routes/affiliate/page.tsx`, `components/affiliate/*` (8), `lib/affiliate*.ts` (5) | ~2,060 | 116 |
| ไม่มีเจ้าของ | `lib/client.ts` (ไม่มีข้อความ UI — ไม่อยู่ใน `I18N_PENDING`) | 9 | 0 |

## What Medusa already gives us
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ไฟล์คำแปลของ extension | `src/admin/i18n/index.ts` + `json/` ([Translate Admin Customizations](https://docs.medusajs.com/learn/fundamentals/admin/translations)) รวมเข้ากับ resource ของ dashboard (`deepMerge`) | use as-is — namespace ของเรา 4 ตัว (ADR-031 ข้อ 2) |
| แปลใน component | `useTranslation("<ns>")` ของ `react-i18next` (instance เดียวกับ dashboard; dep เดิม 13.5.0) | use as-is |
| แปลนอก component | `getI18n()` ของ `react-i18next` | extend — helper `src/admin/i18n/t.ts` ตัวเดียว (ADR-031 ข้อ 4) |
| ตัวเลือกภาษา + จำค่า | Settings → Profile (`i18n.changeLanguage`) + detector cookie/localStorage `lng`; เครื่องใหม่ = `en` | use as-is — ไม่สร้างตัวเลือกภาษาเอง, ไม่เปลี่ยนค่าเริ่มต้น (Q1 = ก) |
| ภาษาไทยของคำทั่วไป | `th.json` ของ dashboard (namespace `translation`: `actions.save/cancel/edit/delete/create`, `general.unsavedChangesTitle/Description` ฯลฯ) | use as-is — อ้าง key ของ Medusa เมื่อค่า `en` ตรงกับข้อความเดิม (กฎ 6) |
| label เมนูด้านข้าง + document title | `defineRouteConfig({ label, translationNs })` (`@medusajs/admin-sdk` 2.22.1; `admin-vite-plugin` อ่าน `translationNs` เฉพาะ string literal) | use as-is (กฎ 9) |
| ข้อความของ `DataTable`/แบ่งหน้า/filter/`usePrompt` ปุ่มเริ่มต้น | แปลโดย dashboard อยู่แล้ว | use as-is (ข้อความที่เราส่งเข้า prop แปลเอง) |
| ข้อความ error ของ zod แบบ lazy | zod 4.2.0 `{ error: () => string }` ใน method ของ schema | use as-is สำหรับ schema ระดับ module (กฎ 4) |
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
ที่มา: storefront (`apps/storefront/src`) และ `th.json` ของ dashboard 2.22.1

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
| available / allocated / delivered / void | พร้อมใช้งาน / จัดสรรแล้ว / ส่งแล้ว / ยกเลิกแล้ว | "พร้อมใช้งาน" = th.json |
| Backordered | รอโค้ด | — |
| Affiliate | แอฟฟิลิเอต | storefront |
| Program / Commission / Commission rate | โปรแกรม / ค่าคอมมิชชัน / อัตราค่าคอมมิชชัน | storefront |
| Ledger | รายการบัญชี | — |
| Payout / Payout info / Mark paid | การจ่ายเงิน / ข้อมูลรับเงิน / ทำเครื่องหมายว่าจ่ายแล้ว | storefront ("การจ่ายเงิน") |
| Approve / Suspend / Reactivate | อนุมัติ / ระงับ / เปิดใช้อีกครั้ง | — |
| Order / Product / Variant / Customer / Promotion | คำสั่งซื้อ / สินค้า / ตัวเลือก / ลูกค้า / โปรโมชั่น | th.json |
| Refund / return / claim / exchange / edit (order change) | คืนเงิน / คืนสินค้า / เคลม / แลกเปลี่ยน / แก้ไขคำสั่งซื้อ | storefront, th.json |
| draft / active / ended / published / pending / paid / canceled | ฉบับร่าง / ใช้งานอยู่ / สิ้นสุดแล้ว / เผยแพร่ / รอดำเนินการ / จ่ายแล้ว / ยกเลิกแล้ว | th.json (ยกเว้น ended/paid) |
| Save / Cancel / Edit / Delete / Create | key `actions.*` ของ Medusa (บันทึก / ยกเลิก / แก้ไข / ลบ / สร้าง) | th.json |

คงละติน: ชื่อเฉพาะ/หน่วย/รหัส (`THB`, `CSV`, `URL`, `ID`, ค่าของ code), ข้อมูลจาก backend

## Business rules (numbered, testable)
1. กลไกเดียว: i18n ของ Medusa admin — `src/admin/i18n/index.ts` default export `{ en: { <ns>: json }, th: { <ns>: json } }` ครบ 4 namespace (ADR-031 ข้อ 2) import JSON ด้วย
   `with { type: "json" }`; ไม่มี key ใน namespace `translation`; ไม่เพิ่ม dependency i18n ใน runtime; ไม่มี provider/detector/ตัวเลือกภาษาของเรา; ไม่เปลี่ยนภาษาเริ่มต้น (Q1 = ก)
2. ไฟล์ JSON ต่อ namespace ต่อภาษา `src/admin/i18n/json/<lang>/<ns>.json`; แต่ละ task แก้เฉพาะไฟล์ของ namespace ตัวเอง (`index.ts` แก้ใน AI18N-1 เท่านั้น — ลงทะเบียนครบ 4 ns ตั้งแต่ต้น)
3. ค่า `en` = ข้อความอังกฤษเดิมตรงตัว (รวมช่องว่าง/เครื่องหมาย); ข้อความที่ประกอบจากหลายท่อน (template literal เช่น `` `${label} is required` ``) ใช้ interpolation `{{name}}`
   โดยผล `en` เท่าเดิมทุกตัวอักษร (`label` ที่ส่งเข้าก็แปลเป็น key ของตัวเอง)
4. **เรียก `t` ตอนรันเท่านั้น** — browser import โมดูลของ extension ก่อน `<I18n/>` ของ dashboard init ถ้า `t` ถูกเรียกตอนโหลดโมดูล helper จะ throw และ admin ทั้งก้อนพัง:
   a. component ใช้ `const { t } = useTranslation("<ns>")` (1 ไฟล์ 1 namespace; ข้ามไป ns อื่นด้วย `{ ns: "<ns>" }` ใน call เท่านั้น)
   b. โค้ดนอก component (lib, `handle.breadcrumb`) ใช้ `t` จาก `src/admin/i18n/t.ts` (`(ns, key, options?) => getI18n().t(key, { ns, ...options })`; ยังไม่ init → throw)
   c. ห้ามเรียก `t(`/`useTranslation(`/helper ที่ระดับบนสุดของไฟล์ (นอก function ใดๆ) รวมถึงใน initializer ของค่าคงที่ระดับ module
   d. ค่าคงที่ข้อความระดับ module เดิม (`INVALID_DATE`, `DISCOUNT_VALUE_MESSAGE`, `REFUND_BLOCKED_MESSAGE` ฯลฯ) เปลี่ยนเป็น function (`const invalidDate = () => t(...)`);
      schema zod ระดับ module (`poolFormSchema`, `partnerFormSchema`, `campaignFormSchema` ฯลฯ) ใช้ข้อความแบบ lazy ของ zod 4.2.0 `{ error: () => t(...) }` แทน positional message
      (`.min(1, "Select a partner")` → `.min(1, { error: () => t("ecom-evoucher", "pool.errors.partner") })`); `fieldErrorMap({...})` รับ function ต่อช่อง (`{ starts_at: invalidDate }`)
      และเรียกตอน parse; error ที่ `ctx.addIssue` ใน `superRefine` เรียก `t` ภายใน callback อยู่แล้วจึงใช้ได้
   e. ย้ายค่าคงที่ที่มีข้อความเข้า component/hook ได้เพื่อเรียก `t` โดย render เท่าเดิม
5. parity: ทุก key ใน `en` มีใน `th` และกลับกันต่อ namespace (plural: `en` มี `_one`/`_other`, `th` มี `_other` — เทียบหลังตัด suffix); ชุด `{{var}}` ของสองภาษาเท่ากัน;
   ค่า `th` ทุกตัวมีอักษรไทย ยกเว้น key ที่อยู่ในรายการคงละตินของ test (ชื่อเฉพาะ/หน่วย)
6. key ที่ใช้ในโค้ดแบบ literal (`t("…")`, `t(ns, "…")`, `label` ที่มี `translationNs`) มีใน `en` ของ namespace ของไฟล์นั้น (namespace จาก `useTranslation("<ns>")` ของไฟล์หรือ `{ ns }` ใน call);
   อ้าง key ของ Medusa ได้เฉพาะ `t("<key>", { ns: "translation" })` ที่ key มีใน `en.json` ของ dashboard และค่า `en` เท่าข้อความเดิม — ใช้แล้ว: `actions.save/cancel/edit/delete/create`,
   `general.unsavedChangesTitle`, `general.unsavedChangesDescription` (prompt ใน `components/common/use-confirm-discard.ts` — `ecom-common` เหลือ "Leave"/"Continue editing")
7. status/enum: แสดงด้วย `t(\`<prefix>.${value}\`, { defaultValue: value })` — ค่าที่ไม่รู้จักแสดงค่าดิบ; ทุกค่าใน array ค่าคงที่ของ enum (`CODE_STATUSES`, `ACTIVE_ORDER_CHANGE_STATUSES`,
   สถานะแคมเปญ/membership/โปรแกรม/payout ที่ lib ประกาศ — ค่าที่ประกาศเป็น type union (`CampaignStatus`, `ProgramStatus` ฯลฯ) อ่าน literal ของ union ด้วย TS compiler API ชุดเดียวกับ guard กฎ 14;
   array ใน lib ที่ import `./client` โหลดด้วย mock `client` แบบ AC-4c) มี key ครบ; ค่าที่ส่ง API, ค่าใน URL (`<prefix>_status` ฯลฯ) และ `value` ของ filter ไม่เปลี่ยน;
   ข้อยกเว้นด้านการแสดงผล: `ACTIVE_ORDER_CHANGE_STATUSES` (`lib/order-refund-blocked.ts`) มี key `orderChangeStatus.<status>` ครบตามกฎนี้ (AC-3) แต่ใช้เป็นเงื่อนไขเท่านั้น —
   UI (widget refund-blocked) **ไม่แสดงสถานะ** ของ change แต่แสดง**ชนิด** ของ change ผ่าน `activeChangeType` ซึ่งคืนข้อความที่แปลแล้วของชนิด change
   (`return_request` → key `refundBlocked.changeType.<type>`, ชนิดที่ไม่มี key → ค่าดิบที่แทน `_` ด้วยช่องว่าง, ไม่มีชนิด → key "order change") — `en` เท่าเดิม
8. ข้อความจาก backend (`error.message` ของ API) แสดงตามที่ได้รับ; ข้อความ fallback/คำนำ/ข้อความ validation/คำเตือนที่ฝั่ง admin สร้างแปลตามภาษา
   (`REFUND_BLOCKED_MESSAGE` เป็นข้อความของ admin — ค่า `en` ต้องเท่ากับถ้อยคำของ middleware PAY-8 ต่อไป)
9. เมนูด้านข้าง: `defineRouteConfig({ label: "<key>", translationNs: "<ns>" })` — **`label` และ `translationNs` เป็น string literal** (`translationNs`: `admin-vite-plugin` อ่านด้วย `isStringLiteral`
   ค่าอื่นถูกทิ้งเงียบ; `label`: plugin อ่านค่าตอน runtime ได้ แต่เราบังคับ literal ให้ guard กฎ 14g/AC-3 ตรวจ key ได้); breadcrumb (`handle.breadcrumb`) ใช้ `t` ของกฎ 4b (ชื่อแคมเปญ/pool จาก loader คงเดิม)
10. ไม่เปลี่ยน: `data-testid`, โครง JSX/ลำดับ element, className, พฤติกรรม/การกันกดซ้ำ, request, เงิน (`getLocaleAmount`), วันเวลา (`useDate`/`DatePicker`)
11. ภาษาอื่นที่ผู้ใช้เลือก (เช่น `de`) → ข้อความของเรา fallback เป็น `en` (ไม่แสดง key ดิบ)
12. e2e admin ทุกไฟล์รันด้วย `lng=en` (cookie `lng` + localStorage `lng` ของ origin backend ผ่าน `storageState` ใน `ADMIN_UI_OPTIONS`) เพิ่มจาก `locale`/`timezoneId` ของ spec 08 กฎ 12 —
    ข้อยกเว้น 4 ข้อของการหาด้วยชื่อ (CLAUDE.md, ADR-018) ใช้ชื่อจาก `en`; e2e ห้ามเปลี่ยนภาษาของผู้ใช้กลางทาง (spec 08 AC-3)
    หมายเหตุ: cookie ไม่แยกตาม port — บน `localhost` storefront (:8000) เห็น cookie `lng` ที่ e2e admin ตั้งด้วย; ตอนนี้ไม่มีผล (storefront ไม่มี i18n — ADR-014) ถ้า storefront มี i18n ในอนาคตต้องทบทวน
13. e2e ภาษาไทยใช้ `ADMIN_UI_OPTIONS_TH` (เหมือนกฎ 12 แต่ `lng=th`) และสร้างค่าที่คาดจากไฟล์ `json/th/<ns>.json` ของเรา หรือจาก `th.json` ของ dashboard สำหรับ key ของ Medusa
    (อ่านไฟล์ผ่าน `require.resolve("@medusajs/dashboard/package.json", { paths: [<apps/backend>] })`) ผ่าน helper ใน `support/admin.ts` (ไม่ hard-code ประโยคไทย)
    + ตรวจอักษรไทย `/[฀-๿]/`; เคส `lng=en` ของ element เดียวกันต้องไม่มีอักษรไทย
14. guard static (`src/admin/__tests__/i18n.unit.spec.ts`, เขียนด้วย TypeScript compiler API — `typescript` เป็น devDependency อยู่แล้ว — ไม่ใช่ regex บรรทัด): ไฟล์ `.ts/.tsx` ใน `src/admin`
    (ยกเว้น test, `i18n/`) ที่ไม่อยู่ใน `I18N_PENDING` ต้องไม่มีข้อความ UI ฮาร์ดโค้ด =
    (a) JSX text ที่มีตัวอักษรละติน ≥ 2 ตัวติดกัน;
    (b) string/template literal ที่มีคำละตินเป็นค่าของ prop/key `title`, `label`, `placeholder`, `heading`, `subHeading`, `description`, `message`, `error`, `confirmText`, `cancelText`, `children`, `text`;
    (c) argument แรกของ `toast.*(`, `new FormError(`, `new Error(` ที่ถูกแสดงต่อผู้ใช้ (รายการไฟล์ที่ throw ไปแสดงอยู่ใน test);
    (d) argument ข้อความของ method ของ zod (`.min/.max/.length/.regex/.email/.url/.refine/.superRefine/.nonempty/.int/.positive/…` — string literal ตำแหน่ง message หรือ `message:`/`error:` ที่เป็น literal)
        และค่าที่เป็น literal ใน object ที่ส่งเข้า `fieldErrorMap({...})`;
    (e) ใน `lib/*.ts`: string/template literal ที่ขึ้นต้นตัวใหญ่และมีคำละติน ≥ 2 คำ (รวมค่าคงที่ระดับ module ที่ถูกส่งต่อเป็น identifier เช่น `INVALID_DATE`, `REFUND_BLOCKED_MESSAGE`)
        และ literal คำละตินที่ถูก `return` จาก function ที่ export (เช่น `"order change"`) ต้องอยู่ใน allowlist ของ test;
    (f) **การเรียก `t(`/`useTranslation(`/helper `t` ระดับบนสุดของไฟล์** (call expression ที่ไม่มี function ใดครอบ) ในทุกไฟล์ `.ts/.tsx` — ตรวจทุกไฟล์ไม่ขึ้นกับ `I18N_PENDING`;
    (g) `defineRouteConfig` ที่มี `translationNs` ต้องเป็น string literal และ `label` เป็น string literal;
    ยกเว้น token ใน allowlist ของ test (ชื่อเฉพาะ/หน่วย เช่น `THB`, `CSV`) และค่าที่ไม่ใช่ข้อความแสดงผล (`displayName`, `method`, `variant`, key ของ query, `data-testid`, ค่า enum);
    `I18N_PENDING` แบ่ง key ต่อกลุ่ม (`groupBuy`, `evoucher`, `affiliate` — แต่ละ key อยู่คนละบรรทัดคั่นด้วยบรรทัดที่ไม่เปลี่ยน) task ของกลุ่มลบไฟล์ของตัวเองออก;
    ไฟล์ใน PENDING ที่ไม่มีข้อความฮาร์ดโค้ดแล้ว → test ล้ม (กันลืมลบ แบบ `ICON_PENDING`); หลัง AI18N-4 ทุก key ว่าง
15. ~~ตั้งไทยเป็นภาษาเริ่มต้น~~ — **ไม่ทำ** (Q1 = ก, owner 2026-11-26)
16. dependency: `i18next` 23.7.11 (exact, **devDependencies** — ใช้เฉพาะ jest setup) = เวอร์ชันใน `@medusajs/dashboard/package.json`; `react-i18next` คง 13.5.0 = ของ dashboard ·
    jest setup (`src/admin/__tests__/i18n-setup.ts`) สร้าง **instance แยก** `i18next.createInstance().use(initReactI18next).init({ resources, lng: "en", fallbackLng: "en" })`
    (`initReactI18next` ตั้งให้ `getI18n()` คืน instance นี้) — **ห้าม init instance กลาง `i18next`** เพราะ `optionalInt`/`optionalFloat` ของ `@medusajs/dashboard/lib`
    เรียก `i18next.t("validation.mustBeInt")` ตอนโหลด module และ unit เดิมพึ่งผล `"Invalid input"` (`lib/__tests__/form-validation.unit.spec.ts:33-34`, `evoucher-pool-form.unit.spec.ts:63,68`)

## Acceptance criteria (Given/When/Then, numbered AC-1..n)
- AC-1 (AI18N-1, กฎ 1–2) ☑ #594 unit: Given `src/admin/i18n/index.ts` When import ใน jest Then key ระดับบน = `["en","th"]` และแต่ละภาษามี namespace ตรง 4 ตัวของ ADR-031 ข้อ 2 ไม่มี `translation`;
  ไฟล์ JSON 8 ไฟล์มีอยู่และ parse ได้
- AC-2 (AI18N-1, กฎ 5) ☑ #594 unit parity: Given ไฟล์ `en`/`th` ของแต่ละ namespace Then ชุด key (หลัง normalize plural) เท่ากัน, ชุด `{{var}}` ต่อ key เท่ากัน, ค่า `th` มีอักษรไทย (ยกเว้น allowlist);
  เคสลบ key หนึ่งตัวออกจาก fixture `th` ในตัว test → ฟังก์ชันตรวจคืน key นั้น
- AC-3 (AI18N-1..4, กฎ 4a, 6, 7) ☑ #594–#597 unit: ทุก key literal ใน `src/admin/**` มีใน `en` ของ namespace ของไฟล์ (หาจาก `useTranslation("<ns>")` ของไฟล์ หรือ `{ ns }` ใน call; ไฟล์ที่เรียก
  `useTranslation` ด้วย namespace ต่างกัน > 1 ตัว → ล้ม); key ที่อ้าง `ns: "translation"` มีใน `en.json` ของ dashboard และค่าเท่ากับข้อความเดิมในตารางของ test (รวม
  `general.unsavedChangesTitle/Description`); ทุกค่าใน array enum ของกฎ 7 มี key ใน `en` (เคส fixture เพิ่มค่าใหม่ใน array โดยไม่มี key → ล้ม); เคส fixture key ไม่มีอยู่ → ฟังก์ชันตรวจคืน key นั้น
- AC-4 (AI18N-1..4, กฎ 4, 8, 11, 16) ☑ #594–#597 unit lazy + instance:
  (a) Given jest setup ตามกฎ 16 (`lng=en`) When เรียกตัวแทนของกลุ่ม (common: `t("ecom-common", <key "Leave">)`; group buy: `toCampaignBody({ ...emptyCampaignForm(), name: "" })` และ
  `campaignFormSchema.safeParse` ที่ `ends_at` เป็น Invalid Date ผ่าน `CAMPAIGN_PARSE_OPTIONS`; e-voucher: `poolFormSchema.safeParse` ที่ไม่เลือก partner; affiliate: `toPayoutBody` ที่ไม่เลือก affiliate)
  Then ได้ข้อความอังกฤษเดิมตรงตัว (ค่าที่ unit เดิม assert); When `changeLanguage("th")` แล้วเรียกซ้ำ Then ได้ค่าจาก `th` (มีอักษรไทย); When `changeLanguage("de")` Then ได้ค่า `en`;
  (b) ใน jest ที่ setup ตามกฎ 16 `optionalInt.safeParse("1.5")` ของ `@medusajs/dashboard/lib` ยังได้ issue `"Invalid input"` (ไม่ถูก instance ของเราเปลี่ยน) และ `i18next.isInitialized` ของ instance กลางเป็น `false`;
  (c) **โหลด module ก่อน init**: ใน `jest.isolateModules` (registry ใหม่ → `getI18n()` ของ `react-i18next` คืน `undefined`) `jest.doMock(<path ของ src/admin/lib/client>, () => ({ sdk: {} }))` ก่อน แล้ว `require` ทุกไฟล์ `src/admin/lib/*.ts` (ยกเว้น `client.ts` — ใช้ `import.meta.env` ซึ่ง jest แบบ CommonJS ของเรา compile ไม่ได้ และไม่มีข้อความ UI) และ `src/admin/i18n/t.ts` ต้องไม่ throw;
  เคส fixture โมดูลที่เรียก helper ระดับบนสุด → throw (พิสูจน์ว่าเคส (c) จับได้);
  unit เดิมทั้งหมดผ่านโดยไม่แก้ assertion ข้อความ
- AC-5 (AI18N-1..4, กฎ 9, 14) ☑ #594–#597 (`I18N_PENDING` ว่างทั้งหมดหลัง #597) guard static ผ่าน; fixture ในตัว test ทุกรูปแบบถูกจับ: (a) `<Text>Hello world</Text>`; (b) `label: "Edit"`, `heading: "Could not load codes"`; (c) `toast.success("Saved")`;
  (d) `z.string().min(1, "Select a partner")`, `.refine(fn, { message: "Name is required" })`, `fieldErrorMap({ starts_at: "Invalid date" })`;
  (e) `const INVALID_DATE = "Invalid date"` ใน lib, `` `${label} is required` ``, `return "order change"`; (f) `const X = t("ecom-common", "a")` ระดับบนสุดของไฟล์ `.tsx`;
  (g) `defineRouteConfig({ label: LABEL, translationNs: NS })` — และไม่จับ: `t("x")` ใน function, `{ error: () => t("ecom-evoucher", "x") }`, `displayName = "NumberInput"`, `method: "POST"`;
  หลัง AI18N-4 `I18N_PENDING` ทุก key ว่าง
- AC-6 (AI18N-1, กฎ 12, 16) ☑ #594 unit: `ADMIN_UI_OPTIONS.storageState` มี cookie `lng=en` และ localStorage `lng=en` ของ origin `BACKEND_URL`; `ADMIN_UI_OPTIONS_TH` ต่างกันเฉพาะค่า `th`;
  ทุกไฟล์ e2e ที่ `loginAdmin` ใช้ `ADMIN_UI_OPTIONS` หรือ `ADMIN_UI_OPTIONS_TH` (ข้อตรวจเดิมของ `admin-options.unit.spec.ts` ขยาย); `deps.unit.spec.ts`: `i18next` อยู่ใน `devDependencies`
  (ไม่อยู่ใน `dependencies`) และเท่ากับเวอร์ชันใน `@medusajs/dashboard/package.json`, `react-i18next` อยู่ใน `dependencies` และเท่ากับของ dashboard
- AC-7 (AI18N-1..4, กฎ 3, 8, 10) ☑ #594–#597 e2e admin เดิมทั้งชุด (`apps/storefront/e2e/*admin*.spec.ts` และไฟล์อื่นที่ใช้ `ADMIN_UI_OPTIONS`) ผ่านโดย `git diff` ของไฟล์ spec เหล่านั้นว่าง
  (ยกเว้น `support/admin.ts`, `support/admin-options.unit.spec.ts`); static test เดิมใน `src/admin/__tests__` ที่ match ข้อความอังกฤษใน source (เช่น `"Group buying"`, `"Create campaign"`,
  `"Could not load codes"`) แก้ให้ match key แทนโดยคงเจตนาเดิม; `lib/__tests__/order-refund-blocked.unit.spec.ts` คงเจตนาว่า**ค่า `en`** ของข้อความเตือน refund เท่าถ้อยคำของ
  middleware PAY-8 (`ACTIVE_ORDER_CHANGE_REFUND_MESSAGE`) และ `activeChangeType` ใน `en` คืน `"return request"`/`"exchange"`/`"order change"` เหมือนเดิม
- AC-8 (AI18N-1, กฎ 6, 13) ☑ #594 e2e `admin-i18n-common.spec.ts`: Given `lng=th` When เปิดฟอร์มสร้าง partner ที่ `/evouchers` พิมพ์ชื่อแล้วกด Escape Then prompt แสดงหัวข้อ/คำอธิบายเท่าค่า
  `general.unsavedChangesTitle`/`general.unsavedChangesDescription` ใน `th.json` ของ dashboard และปุ่มยืนยัน/ยกเลิกเท่าค่า `th` ของ `ecom-common` (หา element ด้วย role ภายใน dialog — ข้อยกเว้นข้อ 4)
  และมีอักษรไทย; Given `lng=en` Then เท่าค่า `en` (ของ dashboard/ของเรา) และไม่มีอักษรไทย; Given `lng=th` Then ลิงก์ Settings ของ Medusa ในเมนูเป็นไทย (ยืนยันว่าเลือกภาษาผ่านกลไก Medusa จริง)
- AC-9 (AI18N-2, กฎ 7, 9, 13) ☑ #595 e2e `admin-i18n-group-buy.spec.ts` (`lng=th`): ลิงก์เมนูด้านข้างของ group buying มีชื่อเท่าค่า `th`; หน้า `/group-buying` heading ของตารางเท่าค่า `th`;
  เปิด modal สร้างแคมเปญ (`FocusModal.Title` + label ช่องชื่อเป็นค่า `th`) กรอก Target value เป็น `0` แล้วกด Create → error ใต้ช่องที่มี testid เดิม `gb-target-value-error` (ข้อความจาก zod แบบ lazy) เท่าค่า `th`; กด Create โดยไม่กรอกชื่อ → toast "Name is required" (จาก `toCampaignBody` — ช่องชื่อไม่มี error ใต้ช่อง/testid มาแต่เดิม, กฎ 10) เท่าค่า `th`; หน้า `/group-buying/:id` breadcrumb แรกและ badge สถานะ
  เป็นค่า `th`; หน้า campaign ที่มี widget `flash-sale-options` หัว widget และ title ของแถว Total cap เป็นค่า `th`; เคส `lng=en` ของ element เดียวกันไม่มีอักษรไทย
- AC-10 (AI18N-3, กฎ 7, 9, 13) ☑ #596 e2e `admin-i18n-evoucher.spec.ts` (`lng=th`): เมนู + breadcrumb `/evouchers`, heading ตาราง Partners/Pools, หน้า pool (heading ตาราง Codes + label filter สถานะ +
  ป้ายสถานะ `available` เท่าค่า `th`), widget `variant-evoucher-pool` บนหน้า variant และ widget `order-evouchers` บนหน้า order ที่มี code เป็นค่า `th`; เคส `lng=en` ไม่มีอักษรไทย
- AC-11 (AI18N-4, กฎ 7, 9, 13) ☑ #597 e2e `admin-i18n-affiliate.spec.ts` (`lng=th`): เมนู `/affiliate`, ชื่อแท็บ 4 แท็บ, heading ตารางของแต่ละแท็บ, ฟอร์มสร้างโปรแกรมส่งโดยไม่กรอกชื่อ → error ใต้ช่องเป็นค่า `th`,
  เมนูต่อแถวของ affiliate `pending` มี menuitem ชื่อเท่าค่า `th` ของ "Approve"; เคส `lng=en` ไม่มีอักษรไทย
- ~~AC-12~~ ไม่ทำ (Q1 = ก — กฎ 15)

## Non-functional (concurrency, idempotency, scale, observability)
- bundle: JSON คำแปล ~2 × 30KB รวมใน admin bundle; ไม่มี request เพิ่ม
- ความทนทาน: ไม่มีการเรียก `t` ตอนโหลด module (กฎ 4c, AC-4c, AC-5f) — ไม่เช่นนั้น admin ทั้งก้อนพังก่อน render
- การเปลี่ยนภาษาไม่ reload หน้า: component ที่ใช้ `useTranslation` render ใหม่เอง; ข้อความจาก lib คำนวณใหม่ตอนเรียกครั้งถัดไป (error ที่แสดงอยู่แล้วคงภาษาเดิมจนกว่าจะ validate ใหม่ และ breadcrumb เปลี่ยนภาษาเมื่อ `Shell` render ใหม่ เช่นตอนเปลี่ยนหน้า — ยอมรับ ไม่นับเป็น defect)
- concurrency/idempotency: none (ไม่แตะ request)

## Test plan: unit / integration / e2e, mapped to AC numbers
| ชนิด | AC |
|---|---|
| unit backend jest (`test:unit`; setup instance แยก `lng=en` ตามกฎ 16) | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 (`deps`), AC-7 (static เดิม + `order-refund-blocked`) |
| unit storefront Playwright project `unit` | AC-6 (`admin-options.unit.spec.ts`) |
| integration | none (ไม่แก้ backend) |
| e2e admin (Playwright, `ADMIN_UI_OPTIONS`/`_TH`) | AC-7 (ชุดเดิม), AC-8, AC-9, AC-10, AC-11 |
qa เก็บ evidence ทุก task (หน้าโหมดไทย ≤ 5 รูป/งาน) ตาม CLAUDE.md ข้อ 6 · builder รัน e2e admin ทุก spec ที่อ้างหน้าที่ตัวเองแก้ (grep path/testid) ก่อน push
· `.tsx` ทดสอบใน jest ไม่ได้ (`jest.config.js` transform แค่ `.[jt]s`) — การเรียก `t` ตอนโหลดใน `.tsx` จับด้วย guard static (กฎ 14f) และ e2e ที่เปิด admin

## Tasks (each = one PR, ≤ ~400 LOC, ordered, with dependencies)
เหตุที่เกิน ~400 LOC ได้ (owner 2026-11-26): ไฟล์คำแปล `en`+`th` และการแทนสตริงด้วย `t()` เป็นงานกลไกที่ review เป็นตาราง key ได้ — แบ่งตามกลุ่มฟีเจอร์ให้ reviewer ดูทีละโดเมน
แทนการแตกย่อยที่เพิ่มรอบ CI · **stack** (ADR-031 ข้อ 11): AI18N-1 แตกจาก `docs/admin-thai-i18n`; AI18N-2/3/4 แตกจาก branch ของ AI18N-1 (ขนานกันได้ ∥) → เปิด PR ทั้งชุดตอนท้าย → merge 1 → 2 → 3 → 4

| Task | งาน — ไฟล์ที่เป็นเจ้าของ | AC | Depends | ประมาณ diff |
|---|---|---|---|---|
| AI18N-1 | ☑ #594 — โครง i18n + ล็อกภาษาใน test + ส่วนร่วม: `src/admin/i18n/{index.ts,t.ts}`, `json/{en,th}/*.json` ทั้ง 8 ไฟล์ (`ecom-common` เต็ม, อีก 3 ns เป็น `{}`), `components/common/**` (prompt ใช้ key ของ Medusa + "Leave"/"Continue editing"), `lib/{fetch-error,form-validation,page-offset,single-flight,combobox-escape}.ts` (`fieldErrorMap` รับ function ต่อช่อง — กฎ 4d), `src/admin/__tests__/{i18n.unit.spec.ts,i18n-setup.ts,deps.unit.spec.ts}` (guard AST กฎ 14 a–g + `I18N_PENDING` ทุกไฟล์ของกลุ่ม 2–4 + AC-4b/4c), `apps/backend/jest.config.js` (setup เฉพาะ `unit`), `apps/backend/package.json` + `pnpm-lock.yaml` (`i18next` dev), `apps/storefront/e2e/support/{admin.ts,admin-options.unit.spec.ts}`, `e2e/admin-i18n-common.spec.ts` | AC-1..6, AC-7 (ชุดเดิม), AC-8 | PR เอกสารรอบ 46 (stack) | ~650 |
| AI18N-2 | ☑ #595 — group buy + flash sale: ไฟล์กลุ่ม `ecom-group-buy` ในตาราง "ขอบเขต" (รวม `INVALID_DATE`/`DISCOUNT_VALUE_MESSAGE`/template ของ `group-buy-form.ts` → function + `{ error: () => … }`) + `json/{en,th}/ecom-group-buy.json` + ลบ key `groupBuy` ใน `I18N_PENDING` + แก้ static เดิมที่ match ข้อความ (`group-buy-pages.unit.spec.ts`, จุดของกลุ่มใน `medusa-ui.unit.spec.ts`) + `lib/__tests__/i18n-group-buy.unit.spec.ts` + `e2e/admin-i18n-group-buy.spec.ts` | AC-3, AC-4, AC-5, AC-7, AC-9 | AI18N-1 (stack) ∥ 3, 4 | ~700 |
| AI18N-3 | ☑ #596 — e-voucher + widget order/variant/refund-blocked: ไฟล์กลุ่ม `ecom-evoucher` (รวม zod positional message ของ `evoucher-pool-form.ts`/`evoucher-partner-form.ts`, `REFUND_BLOCKED_MESSAGE` + `activeChangeType` ของ `order-refund-blocked.ts`) + JSON ของตัวเอง + key `evoucher` ใน `I18N_PENDING` + static เดิมของกลุ่มใน `medusa-ui.unit.spec.ts` + `order-refund-blocked.unit.spec.ts` (AC-7) + `lib/__tests__/i18n-evoucher.unit.spec.ts` + `e2e/admin-i18n-evoucher.spec.ts` | AC-3, AC-4, AC-5, AC-7, AC-10 | AI18N-1 (stack) ∥ 2, 4 | ~700 |
| AI18N-4 | ☑ #597 — affiliate: ไฟล์กลุ่ม `ecom-affiliate` (รวม `fieldErrorMap` ของ `affiliate-program-form.ts`, ค่าคงที่ของ `affiliate-payout.ts`) + JSON ของตัวเอง + key `affiliate` ใน `I18N_PENDING` + static เดิมของกลุ่ม + `lib/__tests__/i18n-affiliate.unit.spec.ts` + `e2e/admin-i18n-affiliate.spec.ts` | AC-3, AC-4, AC-5 (PENDING ว่างทั้งหมดหลัง merge), AC-7, AC-11 | AI18N-1 (stack) ∥ 2, 3 | ~750 |
| AI18N-N1 | ☑ #599 — nit จาก review รอบ 46 (owner สั่ง 2026-11-27; ไม่เปลี่ยนพฤติกรรม/testid/ค่า en): (1) `routes/group-buying/page.tsx`, `routes/group-buying/[id]/page.tsx` และ `routes/evouchers/pools/[id]/page.tsx` import helper เป็น `t as tNs` ไม่ซ้อนชื่อกับ `t` ของ `useTranslation` (guard `__tests__/i18n-check.ts` รู้จัก alias ของ helper ทั้ง key check และกฎ 14f และ unit `shadowedHelperLines` ห้ามทุกไฟล์ใน `src/admin` import helper เป็น `t` ตรงๆ แล้วมี `t` อื่นในไฟล์); (2) `components/group-buy/create-campaign.tsx` ตัวแปรใน component `SELECTS`/`NAME_AND_TARGET`/`DATES`/`INPUTS` → camelCase; (3) `json/th/ecom-group-buy.json` `productStatus.proposed` = "เสนอ" ตาม `th.json` ของ `@medusajs/dashboard` 2.22.1 (unit เทียบ `productStatus.*` ทั้ง 4 ค่า); (4) `e2e/support/evidence-rules.ts` ข้อความ error ของ `evidenceDir` อธิบายรูปแบบตาม regex จริง (prefix มีตัวเลขได้, รูป `XX-Nn`); (5) `e2e/admin-i18n-group-buy.spec.ts` breadcrumb — `Breadcrumbs` ของ dashboard ไม่มี nav/aria-label จึงคง `ol` แรก (อธิบายใน comment) | AC-3, AC-5, AC-7, AC-9 (คงผ่าน) | AI18N-1..4 | ~100 |

- **ไฟล์ร่วม** (ตัวที่ merge ทีหลัง sync): `src/admin/__tests__/i18n.unit.spec.ts` (แต่ละ task แก้เฉพาะบรรทัด key ของกลุ่มตัวเองใน `I18N_PENDING`) ·
  `src/admin/__tests__/medusa-ui.unit.spec.ts` (แต่ละ task แก้เฉพาะ assertion ของไฟล์กลุ่มตัวเอง) · `src/admin/i18n/index.ts`, `support/admin.ts`, `package.json`/lockfile = AI18N-1 เท่านั้น
- AI18N-2..4 ไม่แตะ `components/common/**` และ `lib/form-validation.ts` (ถ้าพบข้อความร่วมที่ขาด ให้เพิ่ม key ใน namespace ของกลุ่มตัวเอง ไม่แก้ `ecom-common`)
- ไม่งด release: โหมดอังกฤษไม่เปลี่ยน ระหว่างทางโหมดไทยเป็นไทยบางกลุ่ม (ยอมรับ)

## Open questions
none — Q1 = ก (owner 2026-11-26): ภาษาเริ่มต้นตาม Medusa (อังกฤษ) ผู้ใช้เลือกไทยครั้งเดียวต่อ browser ที่ Settings → Profile; ไม่ทำกฎ 15/AC-12
