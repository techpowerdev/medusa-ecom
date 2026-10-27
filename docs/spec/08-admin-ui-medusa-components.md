# 08 Admin UI ใช้ component, hook และ utility ของ Medusa (ADM)
Status: draft (รอ owner ตัดสิน ADR-018 + Open questions)
Goal (owner's words, 2026-10-28): "หลังบ้าน admin ทั้งหมดได้ใช้ component, hook, utility และอื่นที่ medusa ให้แล้วหรือยัง ถ้ายังให้วางแผนปรับใช้ตามที่ medusa มีให้ก่อนเป็นฐาน
อย่าสร้างซ้ำกับที่มีแล้ว ถ้าไม่มีที่ใช้ได้จริงๆค่อยสร้างเพิ่ม"
Out of scope: เปลี่ยน backend/API, เปลี่ยนพฤติกรรมทางธุรกิจของหน้า admin, แปล admin เป็นไทย (admin คงอังกฤษตาม CLAUDE.md), เปลี่ยน `data-testid`/label ที่ e2e ใช้,
หน้า admin ของ Medusa เอง (เราไม่ override)

ผลตรวจทีละไฟล์และเหตุผล: ADR-018 (proposed)

## What Medusa already gives us
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| หน้า/เมนูใหม่, widget บนหน้า Medusa | `defineRouteConfig` (`label`, `icon`, `rank`), `defineWidgetConfig` (zone), `loader` + `handle.breadcrumb` | ใช้ตามเดิม + เพิ่ม `icon` (`@medusajs/icons`) และ breadcrumb ที่ขาด (ADM-1, ADM-6, ADM-8) |
| เรียก API | JS SDK (`lib/client.ts`) + Tanstack Query ตาม Admin tips | ใช้ตามเดิม |
| ข้อมูลสินค้า/collection/category | `useProducts` + `productsQueryKeys` (dashboard/hooks), `useComboboxData` + `sdk.admin.productCollection/productCategory.list` | ใช้แทน `useQuery` เอง (ADM-7, ADM-9) |
| layout หน้า | `LayoutComposer` (`core:single-column`, widget zone) | ใช้แทน `div flex-col gap-y-3` (ADM-4, ADM-6) |
| หัว section | ไม่ export — custom guide **Header** (+ Container wrapper) | คัดลอกจาก guide ไป `components/common/` (ADM-2) |
| แถว key/value | `SectionRow` | ใช้แทน `Field`/`Row`/grid เอง (ADM-2, ADM-4, ADM-6) |
| empty state | `NoRecords` | ใช้แทนข้อความเอง (ADM-5, ADM-6) |
| ตาราง + แบ่งหน้า + filter | `DataTable` ของ dashboard (`heading`, `prefix`, `pageSize`, `rowHref`, `filters`, `emptyState`, `action`) + `useQueryParams`; `DataTable` ของ `@medusajs/ui` | dashboard เป็นค่าตั้งต้น; คง ui `DataTable` เมื่อต้องการ `onRowClick` (groups) หรืออยู่ใน modal (product picker) |
| ตารางที่ backend กำหนดคอลัมน์ | `ConfigurableDataTable` | ไม่ใช้ — ต้องเปิด view configuration (ADR-018) |
| ฟอร์ม | `Form`, `KeyboundForm` (dashboard) + `react-hook-form` + zod, `optionalInt`/`optionalFloat` (dashboard/lib); `FocusModal` (สร้าง) / `Drawer` (แก้) ตาม Forms guide | ใช้แทน state ฟอร์มเอง (ADM-3, 5, 7, 9); ไม่ใช้ `RouteFocusModal`/`RouteDrawer` (Q5) |
| เลือกหลายค่าแบบค้นหาได้ | `Combobox` + `useComboboxData` | ใช้แทน checkbox list `limit: 200` (ADM-9) |
| ยืนยัน/แจ้งเตือน | `usePrompt`, `toast` | ใช้ตามเดิม |
| ปุ่มต่อแถว | `ActionMenu` | ไม่ใช้กับปุ่มที่ e2e ใช้ `data-testid` (`Action` ไม่รับ testid — Q3) |
| เงิน | `getLocaleAmount` + `castNumber` (dashboard/lib, หน่วยหลัก) | ใช้แทน `formatAmount` (ADM-8) |
| วันที่ | `useDate` (ไม่มี timezone) | **custom**: `lib/ict.ts` แสดง/แปลงเวลาไทยเสมอ (ADM-2) |
| กันกดซ้ำใน tick เดียว | ไม่มี (`isPending`/`isSubmitting` async) | **custom**: `createSingleFlight` ที่มีอยู่ เป็น guard ตัวเดียว (ADM-2) |
| input ไฟล์ CSV | ไม่มี (ui ไม่มี, dashboard ไม่ export `FileUpload`) | **custom**: คง `<input type="file">` |

## Data model (only new/changed)
none

## Workflows (name, steps, compensation)
none

## API routes (store / admin), auth, request/response shape
none (ใช้ admin route เดิมทั้งหมด; `GET /admin/evoucher/partners` ส่ง `limit`/`offset` จากตาราง — route รับอยู่แล้ว)

## Admin UI (widgets/pages) and Storefront pages
- ไม่มีหน้าใหม่; ปรับหน้า/widget เดิม 8 ไฟล์ route/widget + 14 component ตามตารางใน ADR-018
- ของกลางใหม่: `src/admin/components/common/header.tsx`, `src/admin/components/common/container.tsx` (จาก guide; Header ส่งต่อ props เช่น `data-testid` ไปที่ปุ่ม),
  `src/admin/lib/ict.ts`
- Storefront: none

## Business rules (numbered, testable)
1. ลำดับการเลือก: export ของ `@medusajs/dashboard/{components,hooks,lib}` → `@medusajs/ui` → custom guide → สร้างเอง; ไม่ใช้ของ Medusa ต้องมีเหตุผลใน PR (ADR-018 หลักการ 1)
2. ของที่สร้างเอง/คัดลอกที่ใช้ ≥ 2 ที่ อยู่ใน `src/admin/components/common/` หรือ `src/admin/lib/`; ไฟล์ใน `src/admin/lib/` ที่มี unit test ไม่ import `@medusajs/dashboard`/`@medusajs/ui`
3. version ของ `@medusajs/ui`, `@medusajs/icons`, `react-hook-form`, `@hookform/resolvers`, `zod`, `@tanstack/react-query`, `react-router-dom` ใน `apps/backend/package.json`
   เท่ากับ dependency ของ `@medusajs/dashboard` ที่ติดตั้ง (pin แบบ exact)
4. กันกดซ้ำด้วย `createSingleFlight` (instance คงที่ด้วย `useState(createSingleFlight)`) เท่านั้น ห้าม `useRef(false)` เป็น guard; ปุ่ม disabled ระหว่างส่งตามเดิม
5. เวลาใน admin แสดงและรับเป็นเวลาไทย (Asia/Bangkok) ผ่าน `lib/ict.ts` เท่านั้น — `toLocaleString`, `toLocaleDateString`, `Intl.NumberFormat`, `timeZone:` ใน `src/admin`
   มีได้เฉพาะ `lib/ict.ts`; เงินใช้ `getLocaleAmount`
6. ไม่เปลี่ยน `data-testid` ที่มีอยู่และ label ที่ e2e หาด้วย `getByLabel`; ไฟล์ใน `apps/storefront/e2e/*admin*.spec.ts` ที่มีอยู่ต้องผ่านโดยไม่แก้ locator (เพิ่ม test ใหม่ได้)
7. ฟอร์มใช้ `Form` + `KeyboundForm` + `useForm`; validation ด้วย zod ยกเว้นฟอร์มที่มี builder + unit test เดิม (`toProgramBody`, `toCampaignBody`) ซึ่ง map error เข้า `form.setError`;
   ข้อความ error แสดงใต้ช่องด้วย `Form.ErrorMessage` (คง testid error เดิม); `⌘/Ctrl+Enter` ส่งฟอร์มได้ 1 ครั้ง
8. ตารางที่ใช้ `DataTable` ของ dashboard ใช้ `prefix` ไม่ซ้ำกันในหน้าเดียว; หน้าปัจจุบันอยู่ใน URL (`<prefix>_offset`) แล้วอ่านกลับด้วย `useQueryParams` สำหรับ request
9. รายการที่เคยดึงแบบมีเพดาน (`partners` `limit: 100`, scope `limit: 200`) ต้องแบ่งหน้า/ค้นหาได้ ไม่ตัดข้อมูลเงียบ

## Acceptance criteria (Given/When/Then, numbered AC-1..n)
- AC-1 (ADM-1, กฎ 3) unit `src/admin/__tests__/deps.unit.spec.ts`: Given `require("@medusajs/dashboard/package.json")` When เทียบกับ `apps/backend/package.json` Then ทุกชื่อในกฎ 3
  มี version เท่ากันทุกตัว (บน develop ปัจจุบัน test นี้ล้มเพราะ `@medusajs/ui` 4.2.6 ≠ 4.2.8) และ `pnpm --filter @dtc/backend build` ผ่าน
- AC-2 (ADM-1, ADM-8) static ใน `src/admin/__tests__/medusa-ui.unit.spec.ts`: ทุก `src/admin/routes/*/page.tsx` ที่เรียก `defineRouteConfig` มี `icon:` ที่ import จาก `@medusajs/icons`
  (ADM-1: `evouchers`, `group-buying`; ADM-8: `affiliate`)
- AC-3 (ADM-2, กฎ 5) unit `src/admin/lib/__tests__/ict.unit.spec.ts` รันทั้ง `TZ=UTC` และ `TZ=America/New_York`: `formatIctDateTime("2026-01-31T17:30:00.000Z")` ได้ค่าเดียวกันทั้งสอง TZ
  และมี `Feb 1, 2026` กับ `12:30`; `formatIctDate("2026-03-10T16:59:59.000Z")` มี `Mar 10, 2026`; `ictToIso("2026-02-01T00:30")` = `"2026-01-31T17:30:00.000Z"`;
  `isoToIct("2026-01-31T17:30:00.000Z")` = `"2026-02-01T00:30"`; ค่าไม่ถูกต้อง → `null`; `formatIct*(null)` = `"-"`
- AC-4 (ADM-2, กฎ 4–5) static: นอก `components/affiliate/**`, `routes/affiliate/**`, `lib/affiliate*`, `components/group-buy/{create-campaign,groups-section}.tsx` ไม่มี `useRef(false)`,
  `toLocaleString(`, `toLocaleDateString(`, `Intl.NumberFormat(`, `timeZone:` ยกเว้นใน `lib/ict.ts`; `ictToIso` ประกาศเฉพาะใน `lib/ict.ts`
  (รายการข้อยกเว้นอยู่ใน `medusa-ui.unit.spec.ts` — task ที่แตะไฟล์ใดต้องลบไฟล์นั้นออกจากข้อยกเว้นใน PR เดียวกัน); และ e2e `flash-sale-admin-save`, `evoucher-admin-resend`, `evoucher-admin-forms`, `group-buy-admin-detail`, `group-buy-admin-members` ผ่านโดย `git diff` ของไฟล์ e2e ว่าง
- AC-5 (ADM-2) static: `components/common/header.tsx` ถูก import ≥ 2 ไฟล์; `widgets/flash-sale-options.tsx` และ `widgets/variant-evoucher-pool.tsx` import `SectionRow`
  จาก `@medusajs/dashboard/components` และไม่มี `const Field =`/`const Row =`; e2e ใหม่: widget flash sale ที่บันทึกแล้วแสดงค่า "Total cap" ตรงกับ API
- AC-6 (ADM-3, กฎ 7) Given หน้า campaign ที่มี widget flash sale When เปิด drawer กรอก Total cap `0` Then เห็น error ใต้ช่อง (`fs-total-cap-error`) และไม่มี `POST .../config`;
  When กรอก `10` แล้ว `dblclick` Save Then `POST .../config` 1 ครั้ง; When แก้ค่าแล้วกด `Meta+Enter` (หรือ `Control+Enter` บน Linux) Then POST 1 ครั้ง;
  ฟอร์ม Create pool บน variant: ส่งโดยไม่เลือก partner → error ใต้ช่อง Partner ไม่มี POST; unit ของ schema: `""` → `null`, `"2"` → `2`, `"0"`/`"1.5"`/`"abc"` → error
- AC-7 (ADM-4, กฎ 8) Given pool ที่มี code 60 ตัว (delivered 5) When เปิดหน้า pool กด Next ของตาราง Codes Then URL มี `<prefix>_offset=50` และ reload แล้วยังเป็นหน้าเดิม;
  When กรองสถานะ `delivered` ผ่าน filter ของ `DataTable` Then มี 5 แถวทุกแถวสถานะ delivered; static: `pools-table.tsx`, `codes-table.tsx` import `DataTable` จาก
  `@medusajs/dashboard/components` และไม่มี `DataTablePaginationState`; หน้า `/evouchers` และ pool ใช้ `LayoutComposer`
- AC-8 (ADM-5, กฎ 9) Given partner 25 ราย When เปิด `/evouchers` Then ตาราง Partners มี 20 แถวหน้าแรกและ 5 แถวหน้าที่สอง; Given ไม่มี partner Then เห็น `evoucher-partners-empty`;
  Create partner ชื่อว่าง → error ใต้ช่อง Name ไม่มี POST; e2e `evoucher-admin-forms` (AC-20 ของ spec 02: dblclick Save = 1 POST, `getByLabel`) ผ่านโดยไม่แก้
- AC-9 (ADM-6) Given แคมเปญชื่อ N When เปิด `/group-buying/:id` Then breadcrumb รายการสุดท้ายเป็น N (มาจาก `loader`); รายการแคมเปญคลิกแถวแล้วไป `/group-buying/:id` และหน้า 2
  อยู่ใน URL; ฟิลด์รายละเอียดใช้ `SectionRow` (static); id ที่ไม่มี → `gb-campaign-not-found` เหมือนเดิม; e2e `group-buy-admin-*` ผ่านโดยไม่แก้
- AC-10 (ADM-7) e2e `group-buy-admin-form` ผ่านโดยไม่แก้ (dblclick Create = 1 POST, `gb-max-quantity-error`, `gb-ends-at-warning`, product picker ข้ามหน้า); `Meta/Control+Enter`
  ส่ง 1 ครั้ง; static: `product-picker.tsx` ใช้ `useProducts` และไม่เรียก `sdk.admin.product.list` เอง; unit `group-buy-form.unit.spec.ts` ผ่านและจำนวน test ไม่ลด
- AC-11 (ADM-8) e2e `affiliate-admin-*` ที่มีอยู่ (รวมของ AF-12c/AF-14) ผ่านโดยไม่แก้; e2e ใหม่: entry ยอด 100 THB แสดง `฿100.00` ใน Ledger; เปลี่ยนหน้าในแท็บ Payouts แล้ว
  URL มี offset ของ prefix Payouts เท่านั้น (ไม่มีของ Programs); static: `lib/affiliate-format.ts` ไม่มีแล้ว, `components/affiliate/**` ไม่มี `useRef(false)`
- AC-12 (ADM-9, กฎ 9) Given collection 250 รายการ When พิมพ์ชื่อ collection ลำดับที่ 250 ใน combobox Collections ของฟอร์มโปรแกรม Then เลือกได้และ `POST /admin/affiliate/programs`
  มี id นั้นใน `scope.collection_ids`; e2e `affiliate-admin-programs`, `affiliate-admin-affiliates`, `affiliate-admin-payouts` ผ่านโดยไม่แก้ (รวม `affiliate-program-error-*`,
  `affiliate-payout-info-error`); static: ไฟล์ affiliate ไม่อยู่ในข้อยกเว้นของ AC-4 แล้ว และไม่มี `useState(` ที่ถือค่าฟอร์ม
  (`emptyProgramForm`/`emptyCampaignForm`/`payoutInfoForm`/`toForm`/`EMPTY`) ในไฟล์ที่ ADM-3/5/7/9 ปรับ — เมื่อ ADM-1..9 merge ครบ รายการข้อยกเว้นต้องว่าง

## Non-functional (concurrency, idempotency, scale, observability)
- กันกดซ้ำ: dblclick/⌘+Enter ซ้ำ = 1 request ทุกฟอร์มและปุ่มยืนยัน (กฎ 4) — backend lock/idempotency เดิมคงไว้
- scale: ไม่มีรายการที่ตัดเพดานเงียบ (กฎ 9); query ใช้ `limit`/`offset` ตามหน้า
- bundle: หลัง ADM-1 มี `@medusajs/ui` สำเนาเดียว

## Test plan: unit / integration / e2e, mapped to AC numbers
| ชนิด | AC |
|---|---|
| unit (jest `test:unit`) | AC-1, AC-2, AC-3, static ของ AC-4/5/7/9/10/11/12, schema ของ AC-6 |
| integration | none (ไม่แก้ backend) |
| e2e admin (Playwright ใน `apps/storefront/e2e`) | AC-4 (ชุดเดิม), AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12 |
qa เก็บ evidence ทุก task ที่มี UI (ADM-2..9) ตาม CLAUDE.md ข้อ 6

## Tasks (each = one PR, ≤ ~400 LOC, ordered, with dependencies)
| Task | งาน — ไฟล์ | AC | Depends |
|---|---|---|---|
| ADM-1 | dependency ตรงกับ dashboard: bump `@medusajs/ui` 4.2.6 → 4.2.8, เพิ่ม `react-hook-form` 7.83.0, `@hookform/resolvers` 5.5.7, `@medusajs/icons` 2.22.1 (exact) + `deps.unit.spec.ts` + `icon` ของ route `evouchers`, `group-buying` — ไฟล์: `apps/backend/package.json`, `pnpm-lock.yaml`, `src/admin/__tests__/`, `routes/{evouchers,group-buying}/page.tsx` (เฉพาะ config) | AC-1, AC-2 (2 route) | ADR-018 accepted (+ Q2) |
| ADM-2 | ของกลาง: `components/common/{header,container}.tsx` (จาก guide), `lib/ict.ts` (+ unit) แทน formatter/`ictToIso` ใน `lib/evoucher.ts`, `lib/group-buy.ts`, `lib/group-buy-form.ts` และผู้เรียก; `createSingleFlight` แทน `useRef` ใน `flash-sale-options`, `order-evouchers`, `group-members`, `group-buying/[id]/page`; Header + `SectionRow` ใน 3 widget; `medusa-ui.unit.spec.ts` | AC-3, AC-4, AC-5 | ADM-1 |
| ADM-3 | pilot ฟอร์ม: drawer ของ `flash-sale-options` + modal Create pool ของ `variant-evoucher-pool` เป็น `Form` + `KeyboundForm` + zod (`optionalInt`) | AC-6 | ADM-2 |
| ADM-4 | หน้า e-voucher: `LayoutComposer` + Header ใน `routes/evouchers/**`, `SectionRow` หน้า pool, `pools-table`/`codes-table` เป็น `DataTable` ของ dashboard (+ filter สถานะ), Header ใน `import-codes` | AC-7 | ADM-2 — ∥ ADM-3, ADM-6 |
| ADM-5 | `partners-section`: ตาราง `DataTable` แบ่งหน้า + `NoRecords` + ฟอร์มสร้าง/แก้เป็น `Form`; `listPartners` รับ `limit`/`offset` (`lib/evoucher.ts`) | AC-8 | ADM-3 — ∥ ADM-4 (คนละไฟล์; ชน `lib/evoucher.ts` ตัวที่ merge ทีหลัง rebase) |
| ADM-6 | หน้า group buy: `LayoutComposer`, Header, รายการแคมเปญเป็น `DataTable` ของ dashboard (`rowHref`), หน้ารายละเอียด `SectionRow` + `NoRecords` + `loader`/breadcrumb, `groups-section` (คง ui `DataTable`) ใช้ Header + `createSingleFlight` | AC-9 | ADM-2, GB-N3 (ถ้ายังไม่ merge — ชน `groups-section.tsx`) — ∥ ADM-3, ADM-4 |
| ADM-7 | `create-campaign` เป็น `Form` (คง `toCampaignBody` → `setError`, `createSingleFlight`) + `product-picker` ใช้ `useProducts` | AC-10 | ADM-3 — ∥ ADM-6 (คนละไฟล์) |
| ADM-8 | affiliate ตาราง: `list-table` → `DataTable` ของ dashboard (`prefix` ต่อแท็บ), Header, `getLocaleAmount` + `lib/ict.ts` (ลบ `affiliate-format.ts` + ปรับ unit), `createSingleFlight` ใน `payouts-table`, `icon` ของ route `affiliate` | AC-2 (affiliate), AC-11 | ADM-2, **#176 (AF-12c) merge**, **AF-14 merge** |
| ADM-9 | affiliate ฟอร์ม: `program-form` (`Form` + `Combobox`/`useComboboxData` ของ scope, `ictToIso` จาก `lib/ict.ts`), `payout-info-drawer` (`Form` + zod), ฟอร์มของ AF-12c (สร้าง payout, mark paid) | AC-12 | ADM-3, ADM-8 |
ลำดับ: ADM-1 → ADM-2 → (ADM-3 ∥ ADM-4 ∥ ADM-6) → (ADM-5 ← ADM-3) ∥ (ADM-7 ← ADM-3); ADM-8 ← (ADM-2 + #176 + AF-14) → ADM-9 ← ADM-3.
ไม่มี task ใดบล็อก release; ADM-1..7 ไม่แตะไฟล์ affiliate (ไม่ชน #176/AF-14)

## Open questions
- Q1 ทางเลือกการปรับ (ADR-018): (A) ทั้งหมดทีละ module ADM-1..9 **[แนะนำ]** · (B) เฉพาะเมื่อแตะไฟล์ · (C) ADM-1..3 ตอนนี้ ที่เหลือหลัง release v0.6.0
- Q2 อนุมัติ bump `@medusajs/ui` 4.2.6 → 4.2.8 (CLAUDE.md: bump `@medusajs/*` ผ่าน ADR) เพื่อให้ตรงกับ `@medusajs/dashboard` 2.22.1 — **[แนะนำ: อนุมัติ]** มิฉะนั้น
  bundle มี ui สองสำเนา และ component ของ dashboard กับของเราใช้ context คนละตัว
- Q3 ปุ่มต่อแถว (Edit/Delete/Approve/Suspend/Cancel/Reveal) ใช้ `ActionMenu` ของ Medusa ไม่ได้โดยไม่เปลี่ยน e2e เพราะ `Action` ไม่รับ `data-testid` — (ก) คงปุ่มเดิม **[แนะนำ]**
  · (ข) ใช้ `ActionMenu` แล้วเปลี่ยน e2e ไปหา menuitem ด้วย role + ชื่อ (ขัดหลักการ testid)
- Q4 วันเวลาในฟอร์ม (program, campaign) ใช้ `DatePicker` ของ `@medusajs/ui` หรือไม่ — (ก) คง `datetime-local` ที่ตีความเป็นเวลาไทย **[แนะนำ]** (DatePicker คืน `Date` ตาม
  timezone ของ browser และ e2e `fill` ช่อง testid อยู่) · (ข) เปลี่ยนเป็น `DatePicker` + แปลง wall-clock เป็น ICT + เขียน e2e ใหม่
- Q5 ฟอร์มแบบ route (`RouteFocusModal`/`RouteDrawer` — URL ของตัวเอง + เตือนเมื่อมีค่าที่ยังไม่บันทึก) — (ก) คง `FocusModal`/`Drawer` แบบ state ตาม Forms guide **[แนะนำ]**
  (widget สร้าง route ไม่ได้) · (ข) ย้ายฟอร์มในหน้า route ของเราเป็น nested route
- Q6 pagination ของตารางที่ย้ายไป `DataTable` ของ dashboard จะอยู่ใน URL (`?<prefix>_offset=`) เหมือนหน้า Medusa — **[แนะนำ: ยอมรับ]**
