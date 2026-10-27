# ADR-018 Admin UI ใช้ component, hook และ utility ของ Medusa เป็นฐาน

สถานะ: **accepted** (owner 2026-10-28 — ทางเลือก A + คำตัดสิน Q2–Q6 ด้านล่าง; เสนอโดย planner 2026-10-28)
เกี่ยวข้อง: spec 08 (task ADM-1..9, AC-1..13), CLAUDE.md ข้อ 1 และ 3, spec 05 กฎ 37 (`createSingleFlight`), spec 00 (เวลา), spec 03 กฎ 5, spec 05 กฎ 37c/AC-44

## บริบท
- owner (2026-10-28): "หลังบ้าน admin ทั้งหมดได้ใช้ component, hook, utility และอื่นที่ medusa ให้แล้วหรือยัง ถ้ายังให้วางแผนปรับใช้ตามที่ medusa มีให้ก่อนเป็นฐาน
  อย่าสร้างซ้ำกับที่มีแล้ว ถ้าไม่มีที่ใช้ได้จริงๆค่อยสร้างเพิ่ม"
- ตั้งแต่ Medusa v2.21.0 แพ็กเกจ `@medusajs/dashboard` export ของให้ extension import ได้ 3 subpath ([Admin Components](https://docs.medusajs.com/resources/admin-components));
  เรา pin `@medusajs/dashboard` 2.22.1 — ตรวจ `exports` ใน `package.json` ของ 2.22.1 แล้วมี `./components`, `./hooks`, `./lib` จริง
  - `@medusajs/dashboard/components`: `ActionMenu`, `SectionRow`, `JsonViewSection`, `DisplayId`, `NoRecords`/`NoResults`, `Listicle`, `Thumbnail`, `IconAvatar`,
    `ConditionalTooltip`, `Form`, `KeyboundForm`, `Combobox`, `CountrySelect`, `HandleInput`, `RouteDrawer`, `RouteFocusModal`, `StackedDrawer`, `StackedFocusModal`,
    `DataTable`, `ConfigurableDataTable`, `DataGrid`, product table cells, `LayoutComposer` (**ไม่มี** `DateRangeDisplay` — ตรวจ `src/exports/components.tsx` ของ v2.22.1)
  - `@medusajs/dashboard/hooks`: hook ของ resource หลัก (`useProducts`, `useOrder`, …) + query key factory, `useComboboxData`, `useDate` (`getFullDate({ date, includeTime })`,
    รูปแบบ date-fns `PP p`, timezone ของ browser), `useDebouncedSearch`, `useQueryParams`, data-table helpers
  - `@medusajs/dashboard/lib`: `getLocaleAmount` (`Intl.NumberFormat([], { style: "currency", currencyDisplay: "narrowSymbol" })`), `getStylizedAmount`, `castNumber`,
    `optionalInt`, `optionalFloat`, `partialFormValidation`, address helpers, `defineSearchEntity`
  - `ActionMenu` รับ `groups` + `children` (ถ้ามี children ใช้เป็น trigger ผ่าน `DropdownMenu.Trigger asChild`); `Action` = `{ icon, label, disabled?, disabledTooltip?, onClick | to }`
    ไม่รับ `data-testid`
- ลำดับการเลือกที่ใช้ตรวจ: **export ของ dashboard → `@medusajs/ui` → custom component guide ของ docs (คัดลอก) → สร้างเอง**
  - "import ได้" = export ของ `@medusajs/dashboard/*` หรือ `@medusajs/ui` (มี `DataTable`/`useDataTable`, `usePrompt`, `toast`, `FocusModal`, `Drawer`,
    `StatusBadge`, `DatePicker`, `CurrencyInput`, `Tooltip`, `Copy`, `Skeleton` ฯลฯ)
  - "pattern ที่ guide ให้คัดลอก" = หน้า `guides/*` ใช้เฉพาะของที่ dashboard ไม่ export: **Header** และ **Container** wrapper
    ([Header guide](https://docs.medusajs.com/resources/admin-components/guides/header)) — หน้า `/archive` (Action Menu, JSON View, Section Row, layouts) ถูกแทนด้วย export แล้ว **ห้ามคัดลอก**
- รูปแบบส่ง request ที่ docs แนะนำ ([Admin tips](https://docs.medusajs.com/learn/fundamentals/admin/tips)): JS SDK ใน `src/admin/lib/` + Tanstack Query `useQuery`/`useMutation`
- dependency ของ `@medusajs/dashboard@2.22.1`: `@medusajs/ui` **4.2.8**, `react-hook-form` 7.83.0, `@hookform/resolvers` 5.5.7, `zod` 4.2.0, `@tanstack/react-query` 5.64.2,
  `react-router-dom` 7.18.2 — แต่ backend pin `@medusajs/ui` **4.2.6** → `pnpm-lock.yaml` มี `@medusajs/ui` สองเวอร์ชัน (4.2.6 ของเรา, 4.2.8 ของ dashboard)
  และ pnpm ไม่ hoist `react-hook-form` ให้ `src/admin` import ได้
- หน้า campaign/promotion ของ Medusa: ฟอร์มใช้ `DatePicker` `granularity="minute"` ผูก `Form.Field` (`routes/campaigns/common/components/create-campaign-form-fields`), แสดงด้วย
  `useDate` — ทั้งคู่ตาม timezone ของเครื่องแอดมิน; เงินในหน้า order/product ใช้ `getLocaleAmount`/`getStylizedAmount` ตาม locale ของ browser

## ผลตรวจ (ทุกไฟล์ใน `apps/backend/src/admin/**` ที่ `origin/develop` 2026-10-28, 35 ไฟล์ไม่นับ test/README/tsconfig)
สรุป: **ใช้ของ Medusa อยู่แล้ว** ในทุกไฟล์ UI (route/widget config, JS SDK, Tanstack Query, `DataTable` ของ `@medusajs/ui` 7 ตาราง, `usePrompt` 7 ไฟล์, `toast`,
`FocusModal`/`Drawer` ตาม Forms guide) แต่ **ยังไม่ใช้ export ของ `@medusajs/dashboard` เลย (0 import)** — พบ 14 กลุ่มที่เขียนเองซ้ำกับของ Medusa (รวม ~50 จุด: หัว section 13, in-flight `useRef` 7, ฟอร์ม state เอง 6, แบ่งหน้าเอง 5, formatter/converter ซ้ำ 6,
แถว key/value 4, layout 3, icon 3, อื่นๆ 6 — และ `@medusajs/ui` คนละเวอร์ชันกับ dashboard) และ 3 เรื่องที่ Medusa ไม่มีให้จริง (`createSingleFlight`, file input, `onRowClick` ใน `DataTable` ของ dashboard)
— ปุ่มต่อแถวและวันเวลาไทย ซึ่งเดิมจัดเป็น "ไม่มีจริง" owner ตัดสินให้ใช้ของ Medusa (Q3, Q4)

### ตารางตรวจทีละไฟล์
| # | ไฟล์ (`src/admin/…`) | ใช้ของ Medusa แล้ว | เขียนเองซ้ำ → ของ Medusa ที่ใช้แทน | ไม่มีของ Medusa จริง (เหตุผล) | Task |
|---|---|---|---|---|---|
| 1 | `routes/affiliate/page.tsx` | `defineRouteConfig`, `Container`/`Heading`/`Tabs`/`Badge`, column helper | หัวหน้า L49–52 → Header (guide); `formatDate`/`formatAmount` L8,17,21 → `useDate` + `getLocaleAmount`; config ไม่มี `icon` L70 → `@medusajs/icons` | — | ADM-8a |
| 2 | `routes/evouchers/page.tsx` | `defineRouteConfig`, `Container`/`Heading`/`Text` | `div flex-col gap-y-3` L10 → `LayoutComposer` `core:single-column`; หัว L12–17 → Header (subtitle); ไม่มี `icon` L25 | — | ADM-1, ADM-4 |
| 3 | `routes/evouchers/pools/[id]/page.tsx` | `loader` + `handle.breadcrumb` L77–82 (ตาม UI routes docs), `Badge` | layout L20 → `LayoutComposer`; หัว L22–42 → Header; บล็อก How to use L57–66 → `SectionRow` | — | ADM-4 |
| 4 | `routes/group-buying/page.tsx` | `DataTable` ของ ui, `defineRouteConfig` | state แบ่งหน้าเอง L64–75 → `DataTable` ของ dashboard (`prefix`, `pageSize`, `rowHref`, `heading`) + `useQueryParams`; หัว L89–102 → Header; ไม่มี `icon` L118 | — | ADM-1, ADM-6 |
| 5 | `routes/group-buying/[id]/page.tsx` | `usePrompt`, `toast`, `FetchError` ของ js-sdk | `useRef` in-flight L45–82 → `createSingleFlight`; วันที่ → `useDate`; ตารางฟิลด์ L154–175 → `SectionRow`; หัว+ปุ่ม L130–153 → Header; loading/not-found L84–111 → `NoRecords`; ไม่มี `loader`/breadcrumb (หน้า pool มี) | — | ADM-2b, ADM-6 |
| 6 | `widgets/flash-sale-options.tsx` | `defineWidgetConfig` zone `campaign.details`, `Alert`, `Drawer`, `Switch` | `Field` L63–72 → `SectionRow`; `useRef` L80,121–124 → `createSingleFlight`; state ฟอร์ม + `parseLimit` L38–61,109–132 → `Form` + zod + `optionalInt` (+ refine/transform); หัว L136–141 → Header | — | ADM-2a, ADM-2b, ADM-3 |
| 7 | `widgets/order-evouchers.tsx` | zone `order.details`, `Table` ของ ui (รายการสั้นไม่แบ่งหน้า — ถูกแล้ว), `Badge` | `useRef` L19,33–39 → `createSingleFlight`; หัว L48–62 → Header; `formatDate` → `useDate` | — | ADM-2a, ADM-2b |
| 8 | `widgets/variant-evoucher-pool.tsx` | zone `product_variant.details.side`, `FocusModal`, `Select`, `Button asChild` + `Link` | `Row` L31–40 → `SectionRow`; state ฟอร์ม `EMPTY` L22–29,46,83–105 → `Form` + zod; หัว L109–123 → Header | — | ADM-2a, ADM-3 |
| 9 | `components/affiliate/list-table.tsx` | `DataTable`/`useDataTable` ของ ui | state แบ่งหน้า L15–35 → `DataTable` ของ dashboard + `useQueryParams` (`prefix` ต่อแท็บ) | — | ADM-8a |
| 10 | `components/affiliate/affiliates-table.tsx` | `usePrompt`, `toast`, `Badge`, `createSingleFlight` | ปุ่มต่อแถว (approve/suspend/reactivate/payout info) → `ActionMenu` (trigger มี testid — Q3); `formatDate` → `useDate` | — | ADM-8a, ADM-8b |
| 11 | `components/affiliate/payouts-table.tsx` | `usePrompt`, `toast` | `useRef` L16,33–51 → `createSingleFlight`; ปุ่มต่อแถว (cancel/mark paid) → `ActionMenu`; `formatAmount`/`formatDate` → `getLocaleAmount`/`useDate` | — | ADM-8a, ADM-8b |
| 12 | `components/affiliate/payout-info-drawer.tsx` | `Drawer`, `Input`, `Label`, `createSingleFlight` | state ฟอร์ม/errors L23–51,60–81 → `Form` + zod (`Form.ErrorMessage`) | — | ADM-9 |
| 13 | `components/affiliate/program-form.tsx` | `FocusModal`, `Select`, `Switch`, `Checkbox`, `sdk.admin.productCollection/productCategory` | state ฟอร์ม L104–144 → `Form`; `<input type="datetime-local">` → `DatePicker` + `z.date()` (Q4); `ScopeList` L44–95 (`limit: 200` ไม่มีค้นหา) → `Combobox` + `useComboboxData` | — | ADM-9 |
| 14 | `components/affiliate/programs-table.tsx` | `usePrompt`, `createSingleFlight`, `toast` | แถบปุ่ม Create L101–110 → `action` ของ `DataTable` (dashboard) หรือ Header; ปุ่มต่อแถว (edit/delete) → `ActionMenu`; `formatDate` → `useDate` | — | ADM-8a, ADM-8b |
| 15 | `components/evoucher/codes-table.tsx` | `DataTable` + Toolbar, `Copy`, `Drawer`, `usePrompt` | state แบ่งหน้า L38–54 → `DataTable` ของ dashboard; `Select` กรองสถานะ + ค่า `ALL` L131–152 → `filters` ของ `DataTable`; ปุ่ม Reveal ต่อแถว L89–92 → `ActionMenu`; `formatDate` → `useDate` | — | ADM-2b, ADM-4 |
| 16 | `components/evoucher/import-codes.tsx` | `Container`/`Heading`/`Button`/`toast` | หัว L34–39 → Header | `<input type="file">` L41 — `@medusajs/ui` ไม่มี file input และ dashboard ไม่ export `FileUpload` | ADM-4 |
| 17 | `components/evoucher/partners-section.tsx` | `FocusModal` (สร้าง) + `Drawer` (แก้) ตาม Forms guide, `usePrompt`, `createSingleFlight` | รายการเขียนเอง L146–182 (ดึงแค่ `limit: 100` ที่ `lib/evoucher.ts` L88 ไม่แบ่งหน้า) → `DataTable` + `NoRecords`; ปุ่ม Edit/Delete ต่อแถว L167–172 → `ActionMenu`; state ฟอร์ม L25–38,73,123–130 → `Form` + zod; หัว → Header | — | ADM-5 |
| 18 | `components/evoucher/pools-table.tsx` | `DataTable` ของ ui | state แบ่งหน้า L42–63 → `DataTable` ของ dashboard (`rowHref`) | — | ADM-4 |
| 19 | `components/group-buy/create-campaign.tsx` | `FocusModal`, `Select`, `Switch` | `useRef` L45,64–80 → `createSingleFlight`; state ฟอร์ม L41–49 → `Form` (คง `toCampaignBody` + `setError`); `datetime-local` → `DatePicker` + `z.date()` (Q4) | — | ADM-7 |
| 20 | `components/group-buy/group-members.tsx` | `DataTable` ของ ui, `usePrompt` | `useRef` L78–100 → `createSingleFlight`; `formatDateTime` → `useDate` | — | ADM-2b |
| 21 | `components/group-buy/groups-section.tsx` | `DataTable` ของ ui + `onRowClick` เลือกแถว | `useRef` L44–62 → `createSingleFlight`; หัว L108–122 → Header | `DataTable` ของ dashboard ไม่มี `onRowClick` (มีแค่ `rowHref`) → คง `DataTable` ของ ui | ADM-6 |
| 22 | `components/group-buy/product-picker.tsx` | `DataTable` (selection + search), `sdk.admin.product.list` | `useQuery` เอง L31–35 → `useProducts` (dashboard/hooks) | product picker ไม่ถูก export (คง `DataTable` ของ ui ใน modal) | ADM-7 |
| 23 | `lib/client.ts` | JS SDK ตาม Admin tips (`auth.type: "session"`) | — | — | — |
| 24 | `lib/single-flight.ts` | — | — | กันคลิกซ้อนแบบ synchronous: `isPending` ของ `useMutation` และ `isSubmitting` ของ react-hook-form เปลี่ยนหลัง render จึงไม่กัน dblclick ใน tick เดียว — Medusa ไม่มี | — (คงไว้ เป็น guard ตัวเดียว) |
| 25 | `lib/affiliate.ts` | `sdk.client.fetch` สำหรับ custom route (ตาม docs) | — | type/endpoint ของ route ของเราเอง | — |
| 26 | `lib/affiliate-format.ts` | — | `formatDate` → `useDate`; `formatAmount` → `getLocaleAmount` + `castNumber` | — | ADM-8a (ลบไฟล์) |
| 27 | `lib/affiliate-account.ts` | — | `parsePayoutInfo` → schema zod (ADM-9) | map ปุ่มตามสถานะ — domain logic (ใช้สร้าง `groups` ของ `ActionMenu`) | ADM-9 |
| 28 | `lib/affiliate-payout.ts` | — | — | domain logic | — |
| 29 | `lib/affiliate-program-form.ts` | — | `ictToIso`/`isoToIct` L24–31 → ลบ; builder รับ `Date` จาก `DatePicker` (Q4) | builder + กฎ 20 (domain, มี unit test) | ADM-9 |
| 30 | `lib/evoucher.ts` | `sdk.client.fetch` | `formatDate` L128 → `useDate` ในผู้เรียก; `listPartners` `limit: 100` L88 → แบ่งหน้า | domain types | ADM-2b, ADM-5 |
| 31 | `lib/evoucher-resend.ts` | — | — | domain logic | — |
| 32 | `lib/group-buy.ts` | `sdk.client.fetch` | `formatDateTime` L82 → `useDate` ในผู้เรียก | domain types | ADM-2b |
| 33 | `lib/group-buy-campaign.ts` | — | — | domain logic | — |
| 34 | `lib/group-buy-form.ts` | — | `ictToIso` L53 → ลบ; builder รับ `Date` (Q4) | builder (domain, มี unit test) | ADM-7 |
| 35 | `i18n/index.ts` | scaffold i18n ของ admin (admin เป็นอังกฤษตาม CLAUDE.md) | — | — | — |

ภาพรวมระดับ package: `@medusajs/ui` 4.2.6 ≠ 4.2.8 ที่ dashboard ใช้ (สองสำเนาใน bundle — ของ dashboard ที่เราจะ import เช่น `Form`, `DataTable`, `ActionMenu` ใช้ 4.2.8;
context ของ ui เช่น `TooltipProvider` ข้ามสำเนาไม่ได้) → ADM-1

### ของ Medusa ที่ตรวจแล้ว**ไม่ใช้** (พร้อมเหตุผล)
- `ConfigurableDataTable` — ต้องเปิด view configuration feature และให้ backend resolve คอลัมน์ของ entity; ตารางเราเป็น custom route ไม่คุ้ม → ใช้ `DataTable` ของ dashboard
- `RouteFocusModal`/`RouteDrawer` — ต้องเป็น root ของ nested UI route; widget สร้าง route ไม่ได้ และ Forms guide เองใช้ `FocusModal`/`Drawer` แบบ state → คงแบบ state (Q5)
- `JsonViewSection`/`DisplayId`/`Thumbnail` — ยังไม่มีจุดที่แสดง metadata/รูป (`DisplayId` ตัด id เหลือ 7 ตัว แต่ e2e ของ payouts/affiliates หาแถวด้วย id เต็ม)
- `DateRangeDisplay` — ไม่ถูก export ใน 2.22.1 → ช่วงเวลาแสดงสองค่าด้วย `useDate` (ไม่คัดลอก component ภายในของ dashboard)

## หลักการ
1. ก่อนเขียน UI admin ใหม่ ตรวจตามลำดับ: export ของ `@medusajs/dashboard/{components,hooks,lib}` → `@medusajs/ui` → custom guide ของ docs → สร้างเอง; เหตุผลที่ไม่ใช้ของ Medusa
   ต้องอยู่ในตาราง "What Medusa already gives us" ของ spec หรือ PR
2. ของที่สร้างเอง/คัดลอกจาก guide ที่ใช้ร่วม ≥ 2 ที่ อยู่ใน `src/admin/components/common/` (component) หรือ `src/admin/lib/` (pure function) — ต่ำกว่า 2 ที่ให้อยู่ในไฟล์ที่ใช้ (CLAUDE.md ข้อ 3)
3. `src/admin/lib/*.ts` ที่มี unit test ไม่ import `@medusajs/ui`/`@medusajs/dashboard/{components,hooks}` — `@medusajs/dashboard/lib` ได้เมื่อ jest โหลดได้ (spec 08 AC-1)
4. กันกดซ้ำด้วย `createSingleFlight` ตัวเดียว (spec 05 กฎ 37) ห้าม `useRef(false)` เป็น guard — รวม `onClick` ของ action ใน `ActionMenu`
5. วันเวลาทำแบบหน้า campaign/promotion ของ Medusa: แสดงด้วย `useDate`, กรอกด้วย `DatePicker` `granularity="minute"` + zod `z.date()` ส่ง `Date` เข้า API ตรงๆ — ตาม timezone ของเครื่องแอดมิน
   (ข้อกำหนดการใช้งาน: เครื่องแอดมินตั้งเวลาไทย); ไม่มี `lib/ict.ts`/`ictToIso`/`datetime-local` ใน admin; backend เก็บ UTC และ storefront แสดงเวลาไทยตามเดิม (spec 01 กฎ 42)
6. เงินแสดงด้วย `getLocaleAmount` (locale ของ browser เหมือนหน้า admin หลักของ Medusa); e2e admin ตั้ง `locale: "en-US"` และ `timezoneId: "Asia/Bangkok"` ให้ผลตายตัว
7. ปุ่มต่อแถวใช้ `ActionMenu`; testid อยู่ที่ trigger (ส่งเป็น `children`) และ e2e หา menuitem ด้วย role `menuitem` + ชื่ออังกฤษ — ข้อยกเว้นเดียวของกฎ "หาด้วย `data-testid`" (CLAUDE.md)
8. ไม่เปลี่ยน `data-testid` และ label ที่ e2e ใช้ (`getByLabel("Name *")`, `"Per-customer limit"`, …); e2e admin เดิมผ่านโดยไม่แก้ locator ยกเว้นปุ่มต่อแถว (7) และการกรอก `DatePicker` (5)
9. ฟอร์ม: `Form` + `KeyboundForm` ของ dashboard กับ `useForm` ของ `react-hook-form`; validation ตาม guide ด้วย zod — ยกเว้นฟอร์มที่มี builder + unit test อยู่แล้ว
   (`toProgramBody`, `toCampaignBody`) ใช้ builder เดิม (รับ `Date`) แล้ว map error เข้า `form.setError` ไม่เขียนกฎซ้ำเป็น zod
10. version ของ `@medusajs/ui`, `react-hook-form`, `@hookform/resolvers`, `zod`, `@tanstack/react-query`, `react-router-dom` ใน backend ต้องเท่ากับ dependency ของ `@medusajs/dashboard`
    ที่ pin (ตรวจด้วย unit test ใน ADM-1) — bump `@medusajs/*` ยังต้องผ่าน ADR ตาม CLAUDE.md

## ทางเลือก
- **A. ปรับทั้งหมดทีละ module ตาม task ADM-1..9** — foundation (dependency + ของกลาง) ก่อน, pilot ฟอร์มใน widget, แล้ว e-voucher / group buy / affiliate
  ข้อดี: ครบตามคำสั่ง owner, PR เล็กทีละ module, มี static test กันถอยกลับ; ข้อเสีย: ~11 PR + qa admin e2e ทุก PR ที่มี UI, ต้องรอ #176/AF-14 สำหรับ affiliate
- **B. ปรับเฉพาะเมื่อแตะไฟล์ (opportunistic)** — บังคับหลักการกับ PR ใหม่, ไม่มี task แยก
  ข้อดี: ไม่มีงานเพิ่มตอนนี้; ข้อเสีย: ไฟล์ที่ไม่มีใครแตะคงซ้ำตลอด, dependency สองเวอร์ชันค้าง, ไม่ตรงคำสั่ง owner ที่ให้ "วางแผนปรับใช้"
- **C. A แบบแบ่งช่วง** — ทำ ADM-1..3 ตอนนี้ ที่เหลือหลัง release v0.6.0 หรือ v1.0
  ข้อดี: ลดความเสี่ยงก่อน release; ข้อเสีย: ช่วงหนึ่งมีสองแบบปนกัน

## การตัดสินใจ (owner 2026-10-28)
- **A** ทำครบ ADM-1..9 (ADM-2 และ ADM-8 แยกเป็น a/b ตามขนาด PR) ไม่บล็อก release ใด; ADM-8a/8b/9 เริ่มหลัง #176 (AF-12c) และ AF-14 merge
- Q2: **อนุมัติ bump `@medusajs/ui` 4.2.6 → 4.2.8** ให้ตรงกับ dependency ของ `@medusajs/dashboard` 2.22.1 (ADR นี้คือ ADR การ bump ตาม CLAUDE.md; ทำใน ADM-1)
- เงิน: ใช้ `getLocaleAmount` ยอมรับรูปแบบตาม locale ของ browser (en-US → `฿1,234.50` แทน `THB 1,234.50` เดิมของ AF-6)
- Q3: **ใช้ `ActionMenu`** สำหรับปุ่มต่อแถว — ข้อยกเว้นการหาด้วย testid เฉพาะ menuitem (หลักการ 7); การกันกดซ้ำยังต้องมี
- Q4: **ตาม Medusa ทั้งหมด** — `DatePicker` + `z.date()` และ `useDate` ตาม timezone ของเครื่อง; เลิกแผน `lib/ict.ts`; เครื่องแอดมินต้องตั้งเวลาไทย; e2e admin ตั้ง `timezoneId: "Asia/Bangkok"`
- Q5: คง `FocusModal`/`Drawer` แบบ state
- Q6: ยอมรับ pagination ใน URL (`?<prefix>_offset=`)

## ผลที่ตามมา
- เพิ่ม dependency ใน `apps/backend/package.json` (pin ตรงกับ dashboard): `react-hook-form` 7.83.0, `@hookform/resolvers` 5.5.7, `@medusajs/icons` 2.22.1;
  bump `@medusajs/ui` 4.2.6 → 4.2.8 (อนุมัติแล้ว — Q2)
- `src/admin/components/common/` มี `header.tsx` + `container.tsx` (คัดลอกจาก guide); ลบ `lib/affiliate-format.ts`, `formatDate`/`formatDateTime` ใน `lib/evoucher.ts`/`lib/group-buy.ts`
  และ `ictToIso`/`isoToIct` ใน `lib/group-buy-form.ts`/`lib/affiliate-program-form.ts`
- **ข้อกำหนดการใช้งาน**: เวลาที่แอดมินเห็นและกรอกขึ้นกับ timezone ของเครื่อง — เครื่องที่ไม่ได้ตั้งเวลาไทยจะเห็น/กรอกเวลาเลื่อน (เหมือนหน้า campaign/promotion ของ Medusa อยู่แล้ว);
  spec 00 (เวลา), spec 03 กฎ 5, spec 05 กฎ 37c/AC-44 แก้ให้สอดคล้องแล้ว; storefront ไม่เปลี่ยน
- e2e admin ที่กดปุ่มต่อแถวหรือกรอกวันเวลาต้องแก้ locator/วิธีกรอก (spec 08 กฎ 7) และ e2e admin ทั้งหมดรันด้วย `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`
- pagination ของตารางที่ใช้ `DataTable` ของ dashboard ไปอยู่ใน URL (`?<prefix>_offset=`) — back/refresh คงหน้าเดิม
- ไฟล์ static test `src/admin/__tests__/medusa-ui.unit.spec.ts` ตรวจ pattern ต้องห้าม (เช่น `useRef(false)`, `datetime-local`, `toLocaleString`/`Intl.NumberFormat`) เพิ่มข้อตรวจทีละ task
- ถ้า Medusa bump dashboard ในอนาคต unit test ของ ADM-1 จะล้มจนกว่าจะปรับ version ที่ต้องตรงกัน
