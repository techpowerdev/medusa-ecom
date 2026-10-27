# ADR-018 Admin UI ใช้ component, hook และ utility ของ Medusa เป็นฐาน

สถานะ: **proposed** (planner 2026-10-28 ตามคำสั่ง owner — รอ owner ตัดสินทางเลือกและคำถามใน spec 08)
เกี่ยวข้อง: spec 08 (task ADM-1..9, AC-1..12), CLAUDE.md ข้อ 1 และ 3, spec 05 กฎ 37 (`createSingleFlight`), spec 02 กฎ 11, spec 03 กฎ 15, spec 04 กฎ 17/23

## บริบท
- owner (2026-10-28): "หลังบ้าน admin ทั้งหมดได้ใช้ component, hook, utility และอื่นที่ medusa ให้แล้วหรือยัง ถ้ายังให้วางแผนปรับใช้ตามที่ medusa มีให้ก่อนเป็นฐาน
  อย่าสร้างซ้ำกับที่มีแล้ว ถ้าไม่มีที่ใช้ได้จริงๆค่อยสร้างเพิ่ม"
- ตั้งแต่ Medusa v2.21.0 แพ็กเกจ `@medusajs/dashboard` export ของให้ extension import ได้ 3 subpath ([Admin Components](https://docs.medusajs.com/resources/admin-components));
  เรา pin `@medusajs/dashboard` 2.22.1 — ตรวจ `exports` ใน `package.json` ของ 2.22.1 แล้วมี `./components`, `./hooks`, `./lib` จริง
  - `@medusajs/dashboard/components`: `ActionMenu`, `SectionRow`, `JsonViewSection`, `DisplayId`, `NoRecords`/`NoResults`, `Listicle`, `Thumbnail`, `IconAvatar`,
    `ConditionalTooltip`, `Form`, `KeyboundForm`, `Combobox`, `CountrySelect`, `HandleInput`, `RouteDrawer`, `RouteFocusModal`, `StackedDrawer`, `StackedFocusModal`,
    `DataTable`, `ConfigurableDataTable`, `DataGrid`, product table cells, `LayoutComposer`
  - `@medusajs/dashboard/hooks`: hook ของ resource หลัก (`useProducts`, `useOrder`, …) + query key factory, `useComboboxData`, `useDate`, `useDebouncedSearch`,
    `useQueryParams`, data-table helpers (`useDataTableDateColumns`, `useDataTableDateFilters`)
  - `@medusajs/dashboard/lib`: `getLocaleAmount`, `getStylizedAmount`, `castNumber`, `optionalInt`, `optionalFloat`, `partialFormValidation`, address helpers, `defineSearchEntity`
- ลำดับการเลือกที่ใช้ตรวจ: **export ของ dashboard → `@medusajs/ui` → custom component guide ของ docs (คัดลอก) → สร้างเอง**
  - "import ได้" = export ของ `@medusajs/dashboard/*` หรือ `@medusajs/ui` (4.2.6 ที่เรา pin มี `DataTable`/`useDataTable`, `usePrompt`, `toast`, `FocusModal`, `Drawer`,
    `StatusBadge`, `DatePicker`, `CurrencyInput`, `Tooltip`, `Copy`, `Skeleton` ฯลฯ)
  - "pattern ที่ guide ให้คัดลอก" = หน้า `guides/*` ใช้เฉพาะของที่ dashboard ไม่ export: **Header** และ **Container** wrapper
    ([Header guide](https://docs.medusajs.com/resources/admin-components/guides/header)) — หน้า `/archive` (Action Menu, JSON View, Section Row, layouts) ถูกแทนด้วย export แล้ว **ห้ามคัดลอก**
- รูปแบบส่ง request ที่ docs แนะนำ ([Admin tips](https://docs.medusajs.com/learn/fundamentals/admin/tips)): JS SDK ใน `src/admin/lib/` + Tanstack Query `useQuery`/`useMutation`
- dependency ของ `@medusajs/dashboard@2.22.1`: `@medusajs/ui` **4.2.8**, `react-hook-form` 7.83.0, `@hookform/resolvers` 5.5.7, `zod` 4.2.0, `@tanstack/react-query` 5.64.2,
  `react-router-dom` 7.18.2 — แต่ backend pin `@medusajs/ui` **4.2.6** → `pnpm-lock.yaml` มี `@medusajs/ui` สองเวอร์ชัน (4.2.6 ของเรา, 4.2.8 ของ dashboard)
  และ pnpm ไม่ hoist `react-hook-form` ให้ `src/admin` import ได้

## ผลตรวจ (ทุกไฟล์ใน `apps/backend/src/admin/**` ที่ `origin/develop` 2026-10-28, 35 ไฟล์ไม่นับ test/README/tsconfig)
สรุป: **ใช้ของ Medusa อยู่แล้ว** ในทุกไฟล์ UI (route/widget config, JS SDK, Tanstack Query, `DataTable` ของ `@medusajs/ui` 7 ตาราง, `usePrompt` 7 ไฟล์, `toast`,
`FocusModal`/`Drawer` ตาม Forms guide) แต่ **ยังไม่ใช้ export ของ `@medusajs/dashboard` เลย (0 import)** — พบ 14 กลุ่มที่เขียนเองซ้ำกับของ Medusa (รวม ~50 จุด: หัว section 13, in-flight `useRef` 7, ฟอร์ม state เอง 6, แบ่งหน้าเอง 5, formatter/converter ซ้ำ 6,
แถว key/value 4, layout 3, icon 3, อื่นๆ 6 — และ `@medusajs/ui` คนละเวอร์ชันกับ dashboard)
และ 8 เรื่องที่ Medusa ไม่มีให้จริง

### ตารางตรวจทีละไฟล์
| # | ไฟล์ (`src/admin/…`) | ใช้ของ Medusa แล้ว | เขียนเองซ้ำ → ของ Medusa ที่ใช้แทน | ไม่มีของ Medusa จริง (เหตุผล) | Task |
|---|---|---|---|---|---|
| 1 | `routes/affiliate/page.tsx` | `defineRouteConfig`, `Container`/`Heading`/`Tabs`/`Badge`, column helper | หัวหน้า L49–52 → Header (guide); `formatDate`/`formatAmount` L8,17,21 → `lib/ict.ts` + `getLocaleAmount` (dashboard/lib); config ไม่มี `icon` L70 → `@medusajs/icons` | — | ADM-8 |
| 2 | `routes/evouchers/page.tsx` | `defineRouteConfig`, `Container`/`Heading`/`Text` | `div flex-col gap-y-3` L10 → `LayoutComposer` `core:single-column`; หัว L12–17 → Header (subtitle); ไม่มี `icon` L25 | — | ADM-1, ADM-4 |
| 3 | `routes/evouchers/pools/[id]/page.tsx` | `loader` + `handle.breadcrumb` L77–82 (ตาม UI routes docs), `Badge` | layout L20 → `LayoutComposer`; หัว L22–42 → Header; บล็อก How to use L57–66 → `SectionRow` | — | ADM-4 |
| 4 | `routes/group-buying/page.tsx` | `DataTable` ของ ui, `defineRouteConfig` | state แบ่งหน้าเอง L64–75 → `DataTable` ของ dashboard (`prefix`, `pageSize`, `rowHref`, `heading`) + `useQueryParams`; หัว L89–102 → Header; ไม่มี `icon` L118 | — | ADM-1, ADM-6 |
| 5 | `routes/group-buying/[id]/page.tsx` | `usePrompt`, `toast`, `FetchError` ของ js-sdk | `useRef` in-flight L45–82 → `createSingleFlight`; ตารางฟิลด์ L154–175 → `SectionRow`; หัว+ปุ่ม L130–153 → Header; loading/not-found L84–111 → `NoRecords`; ไม่มี `loader`/breadcrumb (หน้า pool มี) | — | ADM-2, ADM-6 |
| 6 | `widgets/flash-sale-options.tsx` | `defineWidgetConfig` zone `campaign.details`, `Alert`, `Drawer`, `Switch` | `Field` L63–72 → `SectionRow`; `useRef` L80,121–124 → `createSingleFlight`; state ฟอร์ม + `parseLimit` L38–61,109–132 → `Form` + zod + `optionalInt` (dashboard/lib); หัว L136–141 → Header | — | ADM-2, ADM-3 |
| 7 | `widgets/order-evouchers.tsx` | zone `order.details`, `Table` ของ ui (รายการสั้นไม่แบ่งหน้า — ถูกแล้ว), `Badge` | `useRef` L19,33–39 → `createSingleFlight`; หัว L48–62 → Header; `formatDate` → `lib/ict.ts` | — | ADM-2 |
| 8 | `widgets/variant-evoucher-pool.tsx` | zone `product_variant.details.side`, `FocusModal`, `Select`, `Button asChild` + `Link` | `Row` L31–40 → `SectionRow`; state ฟอร์ม `EMPTY` L22–29,46,83–105 → `Form` + zod; หัว L109–123 → Header | — | ADM-2, ADM-3 |
| 9 | `components/affiliate/list-table.tsx` | `DataTable`/`useDataTable` ของ ui | state แบ่งหน้า L15–35 → `DataTable` ของ dashboard + `useQueryParams` (`prefix` ต่อแท็บ) | — | ADM-8 |
| 10 | `components/affiliate/affiliates-table.tsx` | `usePrompt`, `toast`, `Badge`, `createSingleFlight` | `formatDate` → `lib/ict.ts` | ปุ่มต่อแถวที่มี `data-testid` — `Action` ของ `ActionMenu` ไม่รับ `data-testid` (`components.d.ts` 2.22.1) และ e2e ใช้ testid (Q3) | ADM-8 |
| 11 | `components/affiliate/payouts-table.tsx` | `usePrompt`, `toast` | `useRef` L16,33–51 → `createSingleFlight`; `formatAmount`/`formatDate` → `getLocaleAmount`/`lib/ict.ts` | ปุ่มต่อแถว (เหตุผลเดียวกับ #10) | ADM-8 |
| 12 | `components/affiliate/payout-info-drawer.tsx` | `Drawer`, `Input`, `Label`, `createSingleFlight` | state ฟอร์ม/errors L23–51,60–81 → `Form` + zod (`Form.ErrorMessage`) | — | ADM-9 |
| 13 | `components/affiliate/program-form.tsx` | `FocusModal`, `Select`, `Switch`, `Checkbox`, `sdk.admin.productCollection/productCategory` | state ฟอร์ม L104–144 → `Form`; `ScopeList` L44–95 (`limit: 200` ไม่มีค้นหา) → `Combobox` + `useComboboxData` | `<input type="datetime-local">` ตีความเป็น ICT (Q4) | ADM-9 |
| 14 | `components/affiliate/programs-table.tsx` | `usePrompt`, `createSingleFlight`, `toast` | แถบปุ่ม Create L101–110 → `action` ของ `DataTable` (dashboard) หรือ Header; `formatDate` → `lib/ict.ts` | ปุ่มต่อแถว (เหตุผลเดียวกับ #10) | ADM-8 |
| 15 | `components/evoucher/codes-table.tsx` | `DataTable` + Toolbar, `Copy`, `Drawer`, `usePrompt` | state แบ่งหน้า L38–54 → `DataTable` ของ dashboard; `Select` กรองสถานะ + ค่า `ALL` L131–152 → `filters` ของ `DataTable`; `formatDate` → `lib/ict.ts` | — | ADM-2, ADM-4 |
| 16 | `components/evoucher/import-codes.tsx` | `Container`/`Heading`/`Button`/`toast` | หัว L34–39 → Header | `<input type="file">` L41 — `@medusajs/ui` ไม่มี file input และ dashboard ไม่ export `FileUpload` | ADM-4 |
| 17 | `components/evoucher/partners-section.tsx` | `FocusModal` (สร้าง) + `Drawer` (แก้) ตาม Forms guide, `usePrompt`, `createSingleFlight` | รายการเขียนเอง L146–182 (ดึงแค่ `limit: 100` ที่ `lib/evoucher.ts` L88 ไม่แบ่งหน้า) → `DataTable` + `NoRecords`; state ฟอร์ม L25–38,73,123–130 → `Form` + zod; หัว → Header | — | ADM-5 |
| 18 | `components/evoucher/pools-table.tsx` | `DataTable` ของ ui | state แบ่งหน้า L42–63 → `DataTable` ของ dashboard (`rowHref`) | — | ADM-4 |
| 19 | `components/group-buy/create-campaign.tsx` | `FocusModal`, `Select`, `Switch` | `useRef` L45,64–80 → `createSingleFlight`; state ฟอร์ม L41–49 → `Form` (คง `toCampaignBody` + `setError`) | `datetime-local` ICT (Q4) | ADM-7 |
| 20 | `components/group-buy/group-members.tsx` | `DataTable` ของ ui, `usePrompt` | `useRef` L78–100 → `createSingleFlight`; `formatDateTime` → `lib/ict.ts` | — | ADM-2, ADM-6 |
| 21 | `components/group-buy/groups-section.tsx` | `DataTable` ของ ui + `onRowClick` เลือกแถว | `useRef` L44–62 → `createSingleFlight`; หัว L108–122 → Header | `DataTable` ของ dashboard ไม่มี `onRowClick` (มีแค่ `rowHref`) → คง `DataTable` ของ ui | ADM-2, ADM-6 |
| 22 | `components/group-buy/product-picker.tsx` | `DataTable` (selection + search), `sdk.admin.product.list` | `useQuery` เอง L31–35 → `useProducts` (dashboard/hooks) | product picker ไม่ถูก export (คง `DataTable` ของ ui ใน modal) | ADM-7 |
| 23 | `lib/client.ts` | JS SDK ตาม Admin tips (`auth.type: "session"`) | — | — | — |
| 24 | `lib/single-flight.ts` | — | — | กันคลิกซ้อนแบบ synchronous: `isPending` ของ `useMutation` และ `isSubmitting` ของ react-hook-form เปลี่ยนหลัง render จึงไม่กัน dblclick ใน tick เดียว — Medusa ไม่มี | — (คงไว้ เป็น guard ตัวเดียว) |
| 25 | `lib/affiliate.ts` | `sdk.client.fetch` สำหรับ custom route (ตาม docs) | — | type/endpoint ของ route ของเราเอง | — |
| 26 | `lib/affiliate-format.ts` | — | `formatDate` ซ้ำกับ #30/#32 → `lib/ict.ts`; `formatAmount` → `getLocaleAmount` + `castNumber` | `useDate` ของ dashboard ไม่มี option `timeZone` (ใช้ timezone ของ browser) แต่ spec ให้แสดงเวลาไทยเสมอ (AF-6 review #138) | ADM-8 (ลบไฟล์) |
| 27 | `lib/affiliate-account.ts` | — | `parsePayoutInfo` → schema zod (ADM-9) | map ปุ่มตามสถานะ — domain logic | ADM-9 |
| 28 | `lib/affiliate-payout.ts` | — | — | domain logic | — |
| 29 | `lib/affiliate-program-form.ts` | — | `ictToIso`/`isoToIct` L24–31 ซ้ำกับ #34 → `lib/ict.ts` | builder + กฎ 20 (domain, มี unit test) | ADM-9 |
| 30 | `lib/evoucher.ts` | `sdk.client.fetch` | `formatDate` L128 → `lib/ict.ts`; `listPartners` `limit: 100` L88 → แบ่งหน้า | domain types | ADM-2, ADM-5 |
| 31 | `lib/evoucher-resend.ts` | — | — | domain logic | — |
| 32 | `lib/group-buy.ts` | `sdk.client.fetch` | `formatDateTime` L82 → `lib/ict.ts` | domain types | ADM-2 |
| 33 | `lib/group-buy-campaign.ts` | — | — | domain logic | — |
| 34 | `lib/group-buy-form.ts` | — | `ictToIso` L53 → `lib/ict.ts` | builder (domain, มี unit test) | ADM-2 |
| 35 | `i18n/index.ts` | scaffold i18n ของ admin (admin เป็นอังกฤษตาม CLAUDE.md) | — | — | — |

ภาพรวมระดับ package: `@medusajs/ui` 4.2.6 ≠ 4.2.8 ที่ dashboard ใช้ (สองสำเนาใน bundle — ของ dashboard ที่เราจะ import เช่น `Form`, `DataTable`, `DisplayId` ใช้ 4.2.8;
context ของ ui เช่น `TooltipProvider` ข้ามสำเนาไม่ได้) → ADM-1

### ของ Medusa ที่ตรวจแล้ว**ไม่ใช้** (พร้อมเหตุผล)
- `ConfigurableDataTable` — ต้องเปิด view configuration feature และให้ backend resolve คอลัมน์ของ entity; ตารางเราเป็น custom route ไม่คุ้ม → ใช้ `DataTable` ของ dashboard
- `RouteFocusModal`/`RouteDrawer` — ต้องเป็น root ของ nested UI route; widget สร้าง route ไม่ได้ และ Forms guide เองใช้ `FocusModal`/`Drawer` แบบ state → คงแบบ state (Q5)
- `ActionMenu` สำหรับปุ่มต่อแถวที่ e2e ใช้ `data-testid` (Q3); `useDate` (ไม่มี timezone); `DatePicker` สำหรับเวลา ICT (Q4); `JsonViewSection`/`DisplayId`/`Thumbnail` — ยังไม่มีจุดที่แสดง metadata/รูป
  (`DisplayId` ตัด id เหลือ 7 ตัว แต่ e2e ของ payouts/affiliates หาแถวด้วย id เต็ม)

## หลักการ (ถ้า accepted)
1. ก่อนเขียน UI admin ใหม่ ตรวจตามลำดับ: export ของ `@medusajs/dashboard/{components,hooks,lib}` → `@medusajs/ui` → custom guide ของ docs → สร้างเอง; เหตุผลที่ไม่ใช้ของ Medusa
   ต้องอยู่ในตาราง "What Medusa already gives us" ของ spec หรือ PR
2. ของที่สร้างเอง/คัดลอกจาก guide ที่ใช้ร่วม ≥ 2 ที่ อยู่ใน `src/admin/components/common/` (component) หรือ `src/admin/lib/` (pure function) — ต่ำกว่า 2 ที่ให้อยู่ในไฟล์ที่ใช้ (CLAUDE.md ข้อ 3)
3. `src/admin/lib/*.ts` ที่มี unit test ต้องเป็น pure (ไม่ import `@medusajs/dashboard`/`@medusajs/ui`) — ของ dashboard เรียกใน component
4. กันกดซ้ำด้วย `createSingleFlight` ตัวเดียว (spec 05 กฎ 37) ห้าม `useRef(false)` เป็น guard
5. ไม่เปลี่ยน `data-testid` และ label ที่ e2e ใช้ (`getByLabel("Name *")`, `"Per-customer limit"`, …); ปรับ UI ต้องให้ e2e admin เดิมผ่านโดยไม่แก้ locator
6. ฟอร์ม: `Form` + `KeyboundForm` ของ dashboard กับ `useForm` ของ `react-hook-form`; validation ตาม guide ด้วย zod — ยกเว้นฟอร์มที่มี builder + unit test อยู่แล้ว
   (`toProgramBody`, `toCampaignBody`) ใช้ builder เดิมแล้ว map error เข้า `form.setError` ไม่เขียนกฎซ้ำเป็น zod
7. version ของ `@medusajs/ui`, `react-hook-form`, `@hookform/resolvers`, `zod`, `@tanstack/react-query`, `react-router-dom` ใน backend ต้องเท่ากับ dependency ของ `@medusajs/dashboard`
   ที่ pin (ตรวจด้วย unit test ใน ADM-1) — bump `@medusajs/*` ยังต้องผ่าน ADR ตาม CLAUDE.md

## ทางเลือก
- **A. ปรับทั้งหมดทีละ module ตาม task ADM-1..9** — foundation (dependency + ของกลาง) ก่อน, pilot ฟอร์มใน widget, แล้ว e-voucher / group buy / affiliate
  ข้อดี: ครบตามคำสั่ง owner, PR เล็กทีละ module, มี static test กันถอยกลับ; ข้อเสีย: 9 PR + qa admin e2e ทุก PR ที่มี UI, ต้องรอ #176/AF-14 สำหรับ affiliate
- **B. ปรับเฉพาะเมื่อแตะไฟล์ (opportunistic)** — บังคับหลักการ 1–7 กับ PR ใหม่, ไม่มี task แยก
  ข้อดี: ไม่มีงานเพิ่มตอนนี้; ข้อเสีย: ไฟล์ที่ไม่มีใครแตะคงซ้ำตลอด, dependency สองเวอร์ชันค้าง, ไม่ตรงคำสั่ง owner ที่ให้ "วางแผนปรับใช้"
- **C. A แบบแบ่งช่วง** — ทำ ADM-1..3 (dependency, ของกลาง, pilot ฟอร์ม) ตอนนี้ ที่เหลือ (ADM-4..9) หลัง release v0.6.0 หรือ v1.0
  ข้อดี: ลดความเสี่ยงก่อน release; ข้อเสีย: ช่วงหนึ่งมีสองแบบปนกัน

## ข้อเสนอ
**A** โดยทุก task ไม่บล็อก release ใด (ทำคู่กับงาน milestone ได้เมื่อ dependency พร้อม) และ task affiliate (ADM-8, ADM-9) เริ่มหลัง #176 (AF-12c) และ AF-14 merge

## ผลที่ตามมา
- เพิ่ม dependency ใน `apps/backend/package.json` (pin ตรงกับ dashboard): `react-hook-form` 7.83.0, `@hookform/resolvers` 5.5.7, `@medusajs/icons` 2.22.1;
  bump `@medusajs/ui` 4.2.6 → 4.2.8 (ต้องการการอนุมัติของ owner ตาม CLAUDE.md — Q2)
- `src/admin/components/common/` มี `header.tsx` + `container.tsx` (คัดลอกจาก guide); `src/admin/lib/ict.ts` รวม formatter/converter เวลาไทย; ลบ `lib/affiliate-format.ts`
- pagination ของตารางที่ใช้ `DataTable` ของ dashboard ไปอยู่ใน URL (`?<prefix>_offset=`) — back/refresh คงหน้าเดิม (Q6)
- ไฟล์ static test `src/admin/__tests__/medusa-ui.unit.spec.ts` ตรวจ pattern ต้องห้าม (เช่น `useRef(false)`, `toLocaleString`/`Intl.NumberFormat` นอก `lib/ict.ts`) เพิ่มข้อตรวจทีละ task
- ถ้า Medusa bump dashboard ในอนาคต unit test ของ ADM-1 จะล้มจนกว่าจะปรับ version ที่ต้องตรงกัน
