# 08 Admin UI ใช้ component, hook และ utility ของ Medusa (ADM)
Status: accepted (owner 2026-10-28 — ADR-018 accepted, Q1–Q6 ตัดสินแล้ว)
Goal (owner's words, 2026-10-28): "หลังบ้าน admin ทั้งหมดได้ใช้ component, hook, utility และอื่นที่ medusa ให้แล้วหรือยัง ถ้ายังให้วางแผนปรับใช้ตามที่ medusa มีให้ก่อนเป็นฐาน
อย่าสร้างซ้ำกับที่มีแล้ว ถ้าไม่มีที่ใช้ได้จริงๆค่อยสร้างเพิ่ม"
Out of scope: เปลี่ยน backend/API, เปลี่ยนพฤติกรรมทางธุรกิจของหน้า admin, แปล admin เป็นไทย (admin คงอังกฤษตาม CLAUDE.md), เปลี่ยน `data-testid`/label ที่ e2e ใช้
(ยกเว้นปุ่มต่อแถวที่ย้ายเข้า `ActionMenu` และช่องวันเวลาที่เป็น `DatePicker` — กฎ 7), หน้า admin ของ Medusa เอง (เราไม่ override), เวลาของ storefront (คงเวลาไทยตาม spec 01 กฎ 42)

ผลตรวจทีละไฟล์และเหตุผล: ADR-018 (accepted)

## What Medusa already gives us
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| หน้า/เมนูใหม่, widget บนหน้า Medusa | `defineRouteConfig` (`label`, `icon`, `rank`), `defineWidgetConfig` (zone), `loader` + `handle.breadcrumb` | ใช้ตามเดิม + เพิ่ม `icon` (`@medusajs/icons`) และ breadcrumb ที่ขาด (ADM-1, ADM-6, ADM-8a) |
| เรียก API | JS SDK (`lib/client.ts`) + Tanstack Query ตาม Admin tips | ใช้ตามเดิม |
| ข้อมูลสินค้า/collection/category | `useProducts` + `productsQueryKeys` (dashboard/hooks), `useComboboxData` + `sdk.admin.productCollection/productCategory.list` | ใช้แทน `useQuery` เอง (ADM-7, ADM-9) |
| layout หน้า | `LayoutComposer` (`core:single-column`, widget zone) | ใช้แทน `div flex-col gap-y-3` (ADM-4, ADM-6) |
| หัว section | ไม่ export — custom guide **Header** (+ Container wrapper) | คัดลอกจาก guide ไป `components/common/` (ADM-2a) |
| แถว key/value | `SectionRow` | ใช้แทน `Field`/`Row`/grid เอง (ADM-2a, ADM-4, ADM-6) |
| empty state | `NoRecords` | ใช้แทนข้อความเอง (ADM-5, ADM-6) |
| ตาราง + แบ่งหน้า + filter | `DataTable` ของ dashboard (`heading`, `prefix`, `pageSize`, `rowHref`, `filters`, `emptyState`, `action`) + `useQueryParams`; `DataTable` ของ `@medusajs/ui` | dashboard เป็นค่าตั้งต้น; คง ui `DataTable` เมื่อต้องการ `onRowClick` (groups) หรืออยู่ใน modal (product picker) |
| ตารางที่ backend กำหนดคอลัมน์ | `ConfigurableDataTable` | ไม่ใช้ — ต้องเปิด view configuration (ADR-018) |
| ฟอร์ม | `Form`, `KeyboundForm` (dashboard) + `react-hook-form` + zod, `optionalInt`/`optionalFloat` (dashboard/lib); `FocusModal` (สร้าง) / `Drawer` (แก้) ตาม Forms guide | ใช้แทน state ฟอร์มเอง (ADM-3, 5, 7, 9); `optionalInt` + refine/transform (กฎ 8); ไม่ใช้ `RouteFocusModal`/`RouteDrawer` (Q5) |
| เลือกหลายค่าแบบค้นหาได้ | `Combobox` + `useComboboxData` | ใช้แทน checkbox list `limit: 200` (ADM-9) |
| ยืนยัน/แจ้งเตือน | `usePrompt`, `toast` | ใช้ตามเดิม |
| ปุ่มต่อแถว | `ActionMenu` (dashboard/components; `children` = trigger ผ่าน `DropdownMenu.Trigger asChild`) | ใช้ตามเดิม; testid ใส่ที่ trigger, e2e หา menuitem ด้วย role + ชื่อ (กฎ 10; ADM-4, 5, 8b) |
| เงิน | `getLocaleAmount` + `castNumber` (dashboard/lib; locale ของ browser, `narrowSymbol`) | ใช้แทน `formatAmount` (ADM-8a) |
| แสดงวันเวลา | `useDate().getFullDate({ date, includeTime })` (dashboard/hooks; timezone ของ browser, **locale จาก `i18n.language` ของ admin** — ค่า `date_locale` ของภาษานั้น fallback `enUS` ไม่ใช่ locale ของ browser โดยตรง — แก้รอบ 12 ตาม nit #183) | ใช้แทน `formatDate`/`formatDateTime` เอง (ADM-2b, ADM-8a); `DateRangeDisplay` ไม่ถูก export ใน 2.22.1 → ช่วงเวลาแสดงเป็นสองค่า |
| กรอกวันเวลา | `DatePicker` ของ `@medusajs/ui` `granularity="minute"` + zod `z.date()` ผูก `Form.Field` (แบบ `routes/campaigns/common/components/create-campaign-form-fields` ของ dashboard) | ใช้แทน `<input type="datetime-local">` + `ictToIso`/`isoToIct` (ADM-7, ADM-9) |
| กันกดซ้ำใน tick เดียว | ไม่มี (`isPending`/`isSubmitting` async) | **custom**: `createSingleFlight` ที่มีอยู่ เป็น guard ตัวเดียว (ADM-2b) |
| input ไฟล์ CSV | ไม่มี (ui ไม่มี, dashboard ไม่ export `FileUpload`) | **custom**: คง `<input type="file">` |

## Data model (only new/changed)
none

## Workflows (name, steps, compensation)
none

## API routes (store / admin), auth, request/response shape
none (ใช้ admin route เดิมทั้งหมด; `GET /admin/evoucher/partners` ส่ง `limit`/`offset` จากตาราง — route รับอยู่แล้ว; วันเวลาส่งเป็น `Date` → JSON ISO UTC เหมือนเดิม)

## Admin UI (widgets/pages) and Storefront pages
- ไม่มีหน้าใหม่; ปรับหน้า/widget เดิม 8 ไฟล์ route/widget + 14 component ตามตารางใน ADR-018
- ของกลางใหม่: `src/admin/components/common/header.tsx`, `src/admin/components/common/container.tsx` (จาก guide; Header ส่งต่อ props เช่น `data-testid` ไปที่ปุ่ม)
- e2e helper ใหม่ (ADM-7): `fillDatePicker(wrapper, "YYYY-MM-DDTHH:mm")` ใน `apps/storefront/e2e/support/admin.ts`
- Storefront: none

## Business rules (numbered, testable)
1. ลำดับการเลือก: export ของ `@medusajs/dashboard/{components,hooks,lib}` → `@medusajs/ui` → custom guide → สร้างเอง; ไม่ใช้ของ Medusa ต้องมีเหตุผลใน PR (ADR-018 หลักการ 1)
2. ของที่สร้างเอง/คัดลอกที่ใช้ ≥ 2 ที่ อยู่ใน `src/admin/components/common/` หรือ `src/admin/lib/`; ไฟล์ใน `src/admin/lib/` ที่มี unit test ไม่ import `@medusajs/ui`
   หรือ `@medusajs/dashboard/{components,hooks}` (`@medusajs/dashboard/lib` import ได้เมื่อ AC-1 ยืนยันว่า jest โหลดได้)
3. version ของ `@medusajs/ui`, `@medusajs/icons`, `react-hook-form`, `@hookform/resolvers`, `zod`, `@tanstack/react-query`, `react-router-dom` ใน `apps/backend/package.json`
   เท่ากับ dependency ของ `@medusajs/dashboard` ที่ติดตั้ง (pin แบบ exact) — bump `@medusajs/ui` 4.2.6 → 4.2.8 อนุมัติใน ADR-018 (owner Q2)
4. กันกดซ้ำด้วย `createSingleFlight` (instance คงที่ด้วย `useState(createSingleFlight)`) เท่านั้น ห้าม `useRef(false)` เป็น guard; ปุ่ม disabled ระหว่างส่งตามเดิม;
   ใช้กับ `onClick` ของ action ใน `ActionMenu` ด้วย
5. วันเวลาใน admin ทำแบบเดียวกับหน้า campaign/promotion ของ Medusa (owner Q4): แสดงด้วย `useDate().getFullDate(...)` (locale ตามภาษาของ admin, timezone ตามเครื่อง), กรอกด้วย `DatePicker` `granularity="minute"` + zod `z.date()`
   (`.nullable()` ตาม field) ส่ง `Date` เข้า API ตรงๆ — ตีความตาม timezone ของเครื่องแอดมิน **เครื่องแอดมินต้องตั้งเวลาเป็นไทย** (ข้อกำหนดการใช้งาน); backend เก็บ UTC
   และ storefront แสดงเวลาไทยตามเดิม; ใน `src/admin` ห้ามมี `datetime-local`, `ictToIso`, `isoToIct`, `timeZone:`, `toLocaleString(`, `toLocaleDateString(`, `Intl.DateTimeFormat(`
6. เงินแสดงด้วย `getLocaleAmount(castNumber(amount), currency_code)` (รูปแบบตาม locale ของ browser เหมือนหน้า admin หลักของ Medusa); ห้าม `Intl.NumberFormat(` ใน `src/admin`
7. ไม่เปลี่ยน `data-testid` ที่มีอยู่และ label ที่ e2e หาด้วย `getByLabel`; ไฟล์ `apps/storefront/e2e/*admin*.spec.ts` ที่มีอยู่ต้องผ่านโดยไม่แก้ locator **ยกเว้น** (a) ปุ่มต่อแถวที่ย้ายเข้า
   `ActionMenu` (กฎ 10) และ (b) การกรอกช่องวันเวลาที่เป็น `DatePicker` (ใช้ `fillDatePicker`) — แก้ได้เฉพาะ locator/วิธีกรอกของจุดนั้น assertion อื่นคงเดิม; ข้อความที่คาดของเงิน
   เปลี่ยนตามกฎ 6 ได้ (เช่น `THB 1,234.50` → `฿1,234.50`)
8. ฟอร์มใช้ `Form` + `KeyboundForm` + `useForm`; validation ด้วย zod ยกเว้นฟอร์มที่มี builder + unit test เดิม (`toProgramBody`, `toCampaignBody`) ซึ่ง map error เข้า `form.setError`
   (builder รับ `Date` แทน string ICT); ข้อความ error แสดงใต้ช่องด้วย `Form.ErrorMessage` (คง testid error เดิม); `⌘/Ctrl+Enter` ส่งฟอร์มได้ 1 ครั้ง;
   ช่องจำนวนเต็มบวกที่ว่างได้ใช้ `optionalInt` + `.refine` (ว่าง หรือจำนวนเต็ม ≥ 1) + `.transform` (`""`/`undefined` → `null`, string → number) — `optionalInt` อย่างเดียวรับ `"0"` และไม่แปลง `""` เป็น `null`
9. ตารางที่ใช้ `DataTable` ของ dashboard ใช้ `prefix` ไม่ซ้ำกันในหน้าเดียว; หน้าปัจจุบันอยู่ใน URL (`<prefix>_offset`) แล้วอ่านกลับด้วย `useQueryParams` สำหรับ request (owner Q6)
10. ปุ่ม action ต่อแถวของตาราง (Edit, Delete, Approve, Suspend, Reactivate, Payout info, Mark paid, Cancel, Reveal) อยู่ใน `ActionMenu` ของ `@medusajs/dashboard/components`
    (owner Q3): `Action` ไม่รับ `data-testid` จึงส่ง trigger เป็น `children` — `<IconButton size="small" variant="transparent" data-testid="<entity>-row-actions"><EllipsisHorizontal /></IconButton>`
    (ActionMenu ห่อ children ด้วย `DropdownMenu.Trigger asChild` จึงคง testid ที่ปุ่ม); e2e หาแถว → trigger ด้วย testid ภายในแถว → `page.getByRole("menuitem", { name: "<Label อังกฤษ>" })`
    (ข้อยกเว้นเดียวของการหาด้วย testid — CLAUDE.md); action ที่สถานะไม่อนุญาตไม่ใส่ใน `groups` (เดิม "ไม่มีปุ่ม" → ตอนนี้ "ไม่มี menuitem"); แถวที่ไม่มี action เลยไม่ render trigger;
    `usePrompt` ยืนยันเหมือนเดิม; ปุ่มระดับ section/หน้า (Create, Save, `evoucher-resend`, `gb-campaign-*`, `gb-group-succeed`/`-fail`, `gb-create-pool-group`) คงเป็น `Button` + testid
11. รายการที่เคยดึงแบบมีเพดาน (`partners` `limit: 100`, scope `limit: 200`) ต้องแบ่งหน้า/ค้นหาได้ ไม่ตัดข้อมูลเงียบ
12. e2e admin ทุกไฟล์รันด้วย Playwright `locale: "en-US"` และ `timezoneId: "Asia/Bangkok"` (ผลของกฎ 5–6 ตายตัว)

## Acceptance criteria (Given/When/Then, numbered AC-1..n)
- AC-1 (ADM-1, กฎ 2–3) unit `src/admin/__tests__/deps.unit.spec.ts`: Given `require("@medusajs/dashboard/package.json")` When เทียบกับ `apps/backend/package.json` Then ทุกชื่อในกฎ 3
  มี version เท่ากันทุกตัว (บน develop ปัจจุบัน test นี้ล้มเพราะ `@medusajs/ui` 4.2.6 ≠ 4.2.8); และใน jest `import("@medusajs/dashboard/lib")` สำเร็จ
  (`optionalInt.safeParse("2").success === true`, `typeof getLocaleAmount === "function"`) — ถ้าโหลดไม่ได้ (ESM/i18next) แก้ config jest ใน ADM-1; แก้ไม่ได้ให้หยุดรายงาน planner
  (schema ของ AC-6 จะย้ายไปทดสอบด้วย e2e); และ `pnpm --filter @dtc/backend build` ผ่าน
- AC-2 (ADM-1, ADM-8a) static ใน `src/admin/__tests__/medusa-ui.unit.spec.ts`: ทุก `src/admin/routes/*/page.tsx` ที่เรียก `defineRouteConfig` มี `icon:` ที่ import จาก `@medusajs/icons`
  (ADM-1: `evouchers`, `group-buying`; ADM-8a: `affiliate`) — (รอบ 12, review #186) route ที่ยังรอ icon อยู่ในรายการ `ICON_PENDING` ของ test; ADM-8a ลบ `affiliate` ออกจากรายการ
  และ test ล้มถ้า route ใน `ICON_PENDING` มี `icon:` แล้ว (รายการว่างเมื่อ ADM-8a merge)
- AC-3 (ADM-2b, กฎ 5, 12) e2e admin: Given แคมเปญ group buy ที่ `ends_at = "2026-01-31T17:30:00.000Z"` (ตั้งผ่าน API) When เปิด `/group-buying/:id` Then ค่าที่แสดงของ ends_at
  มี `Feb 1, 2026` และ `12:30 AM`; static: `lib/evoucher.ts`, `lib/group-buy.ts` ไม่มี `formatDate`/`formatDateTime` และผู้เรียกเดิมใช้ `useDate`; config Playwright ของ e2e admin
  มี `locale: "en-US"` และ `timezoneId: "Asia/Bangkok"` (unit อ่านไฟล์ config/ไฟล์ e2e) — (รอบ 12, nit #183) รูปแบบวันที่ของ `useDate` มาจาก `i18n.language` ของ admin (ภาษา
  English → `enUS`) ไม่ใช่ `locale` ของ Playwright โดยตรง: e2e ต้องไม่เปลี่ยนภาษาของ admin user ก่อน assert และ timezone มาจาก `timezoneId`
- AC-4 (ADM-2b, กฎ 4–6) static: นอก `components/affiliate/**`, `routes/affiliate/**`, `lib/affiliate*`, `components/group-buy/{create-campaign,groups-section}.tsx`, `lib/group-buy-form.ts`
  ไม่มี `useRef(false)` และ pattern ต้องห้ามของกฎ 5–6 (รายการข้อยกเว้นอยู่ใน `medusa-ui.unit.spec.ts` — task ที่แตะไฟล์ใดต้องลบไฟล์นั้นออกจากข้อยกเว้นใน PR เดียวกัน);
  และ e2e `flash-sale-admin-save`, `evoucher-admin-resend`, `evoucher-admin-forms`, `group-buy-admin-detail`, `group-buy-admin-members` ผ่านโดย `git diff` ของไฟล์ e2e ว่าง
  (ยกเว้นการตั้ง `locale`/`timezoneId` ตาม AC-3)
- AC-5 (ADM-2a) static: `components/common/header.tsx` ถูก import ≥ 2 ไฟล์; `widgets/flash-sale-options.tsx` และ `widgets/variant-evoucher-pool.tsx` import `SectionRow`
  จาก `@medusajs/dashboard/components` และไม่มี `const Field =`/`const Row =`; e2e ใหม่: widget flash sale ที่บันทึกแล้วแสดงค่า "Total cap" ตรงกับ API;
  (รอบ 12, nit EV-13 #167) toast error ของ `evoucher-resend` ไม่มีจุดซ้อน (ข้อความไม่มี `.).` หรือ `..`) และ e2e ของ resend มีเคส mock ข้อความ error รูปแบบปัจจุบันของ backend
  (ไม่มี `noti_`) ที่ตรวจ `/log/i` ด้วย
- AC-6 (ADM-3, กฎ 8) Given หน้า campaign ที่มี widget flash sale When เปิด drawer กรอก Total cap `0` Then เห็น error ใต้ช่อง (`fs-total-cap-error`) และไม่มี `POST .../config`;
  When กรอก `10` แล้ว `dblclick` Save Then `POST .../config` 1 ครั้ง; When แก้ค่าแล้วกด `Meta+Enter` (หรือ `Control+Enter` บน Linux) Then POST 1 ครั้ง;
  ฟอร์ม Create pool บน variant: ส่งโดยไม่เลือก partner → error ใต้ช่อง Partner ไม่มี POST; unit ของ schema (`optionalInt` + refine/transform): `""` → `null`, `"2"` → `2`,
  `"0"`/`"1.5"`/`"abc"` → error
- AC-7 (ADM-4, กฎ 9–10) Given pool ที่มี code 60 ตัว (delivered 5) When เปิดหน้า pool กด Next ของตาราง Codes Then URL มี `<prefix>_offset=50` และ reload แล้วยังเป็นหน้าเดิม;
  When กรองสถานะ `delivered` ผ่าน filter ของ `DataTable` Then มี 5 แถวทุกแถวสถานะ delivered; When เปิด `evoucher-code-row-actions` ของแถวแล้วกด menuitem "Reveal" Then เห็น
  `evoucher-revealed-code`; static: `pools-table.tsx`, `codes-table.tsx` import `DataTable` และ `ActionMenu` (codes) จาก `@medusajs/dashboard/components` และไม่มี
  `DataTablePaginationState`; หน้า `/evouchers` และ pool ใช้ `LayoutComposer`; e2e เดิมที่กด Reveal แก้เฉพาะ locator (กฎ 7a)
- AC-8 (ADM-5, กฎ 10–11) Given partner 25 ราย When เปิด `/evouchers` Then ตาราง Partners มี 20 แถวหน้าแรกและ 5 แถวหน้าที่สอง; Given ไม่มี partner Then เห็น `evoucher-partners-empty`;
  Create partner ชื่อว่าง → error ใต้ช่อง Name ไม่มี POST; Edit/Delete ผ่าน `evoucher-partner-row-actions` → menuitem "Edit"/"Delete" (Delete ยกเลิก prompt → ไม่มี `DELETE`);
  e2e `evoucher-admin-forms` (AC-20 ของ spec 02: dblclick Save = 1 POST, `getByLabel`) ผ่านโดยแก้เฉพาะ locator ของปุ่ม Edit/Delete ต่อแถว
- AC-9 (ADM-6) Given แคมเปญชื่อ N When เปิด `/group-buying/:id` Then breadcrumb รายการสุดท้ายเป็น N (มาจาก `loader`); รายการแคมเปญคลิกแถวแล้วไป `/group-buying/:id` และหน้า 2
  อยู่ใน URL; ฟิลด์รายละเอียดใช้ `SectionRow` (static); id ที่ไม่มี → `gb-campaign-not-found` เหมือนเดิม; e2e `group-buy-admin-*` ผ่านโดยไม่แก้
- AC-10 (ADM-7, กฎ 5, 8) e2e `group-buy-admin-form` ผ่านโดยแก้เฉพาะการกรอกวันเวลาเป็น `fillDatePicker` (dblclick Create = 1 POST, `gb-max-quantity-error`, `gb-ends-at-warning`,
  product picker ข้ามหน้า); Given `timezoneId: "Asia/Bangkok"` When กรอก starts `2026-12-01 10:00` และ ends `2026-12-31 23:30` Then body ของ POST มี
  `starts_at = "2026-12-01T03:00:00.000Z"` และ `ends_at = "2026-12-31T16:30:00.000Z"`; `Meta/Control+Enter` ส่ง 1 ครั้ง; static: `product-picker.tsx` ใช้ `useProducts` และไม่เรียก
  `sdk.admin.product.list` เอง, `create-campaign.tsx` ใช้ `DatePicker` ไม่มี `datetime-local`; unit `group-buy-form.unit.spec.ts` ผ่าน — test ของ `ictToIso` ถูกแทนด้วย test ที่ส่ง `Date`
  และจำนวน test ที่เหลือไม่ลด
- AC-11 (ADM-8a, กฎ 5–6, 9) e2e `affiliate-admin-*` ที่มีอยู่ (รวมของ AF-12c/AF-14) ผ่านโดยแก้เฉพาะข้อความเงินที่คาดตามกฎ 6; e2e ใหม่: entry ยอด `1234.5` THB แสดง `฿1,234.50`
  ใน Ledger (`locale: "en-US"`); เปลี่ยนหน้าในแท็บ Payouts แล้ว URL มี offset ของ prefix Payouts เท่านั้น (ไม่มีของ Programs); static: `lib/affiliate-format.ts` ไม่มีแล้ว
- AC-12 (ADM-9, กฎ 5, 8, 11) Given collection 250 รายการ When พิมพ์ชื่อ collection ลำดับที่ 250 ใน combobox Collections ของฟอร์มโปรแกรม Then เลือกได้และ `POST /admin/affiliate/programs`
  มี id นั้นใน `scope.collection_ids`; Given `timezoneId: "Asia/Bangkok"` When กรอก starts `2026-12-01 00:00` Then body มี `starts_at = "2026-11-30T17:00:00.000Z"`; ฟอร์มสร้าง payout
  ค่าเริ่มต้น `period_from` = วันที่ 1 ของเดือนก่อน 00:00 ตามเวลาเครื่อง (spec 05 กฎ 37c); e2e `affiliate-admin-programs`, `affiliate-admin-affiliates`, `affiliate-admin-payouts` ผ่าน
  โดยแก้เฉพาะการกรอกวันเวลา (รวม `affiliate-program-error-*`, `affiliate-payout-info-error`); static: ไฟล์ affiliate ไม่อยู่ในข้อยกเว้นของ AC-4 แล้ว, `src/admin` ไม่มี `datetime-local`/`ictToIso`/`isoToIct`
  และไม่มี `useState(` ที่ถือค่าฟอร์ม (`emptyProgramForm`/`emptyCampaignForm`/`payoutInfoForm`/`toForm`/`EMPTY`) ในไฟล์ที่ ADM-3/5/7/9 ปรับ — เมื่อ ADM-1..9 merge ครบ รายการข้อยกเว้นต้องว่าง;
  (รอบ 12, nit review #163/#176) Given โปรแกรมที่ `starts_at` มีวินาที (`…:00:30Z`, ตั้งผ่าน API) When เปิดฟอร์มแก้แล้วแก้แค่ชื่อและ Save Then body ของ request ไม่มี `starts_at`/`ends_at`;
  When ปิดสวิตช์ `all` โดยไม่เลือก collection/category Then เห็น error ใต้ช่อง scope และไม่มี request; Given affiliate `active` 250 ราย When พิมพ์ชื่อรายที่ 250 ในตัวเลือก affiliate ของฟอร์มสร้าง payout
  Then เลือกได้ (ไม่ตัดที่ 200 เงียบ)
- AC-13 (ADM-8b, กฎ 4, 10) Given affiliate `pending` When เปิด `affiliate-row-actions` ของแถวแล้วกด menuitem "Approve" Then `POST /admin/affiliate/affiliates/:id` 1 ครั้ง (`status: "active"`)
  และ badge เป็น `active` โดยไม่ reload; Given route ของ POST หน่วง 1 วินาที (`page.route`) When กด "Approve" แล้วเปิดเมนูกด "Approve" ซ้ำก่อนได้ response Then มี POST 1 ครั้ง;
  Given โปรแกรม `published` Then เมนูของแถวไม่มี menuitem "Delete"; Given payout `paid` Then แถวไม่มี `affiliate-payout-row-actions`; (รอบ 12, nit #176) Given route ยกเลิก payout
  หน่วง 1 วินาที When กด "Cancel" แล้วเปิดเมนูแถวเดียวกัน Then menuitem "Mark paid" disabled (หรือกดแล้วไม่มี request) จนการยกเลิกจบ; e2e ของ AC-26, AC-42..44 (spec 05) ผ่าน
  โดยแก้เฉพาะ locator ของปุ่มต่อแถว; static: `affiliates-table.tsx`, `programs-table.tsx`, `payouts-table.tsx` import `ActionMenu` และไม่มี testid ปุ่มต่อแถวเดิม, `components/affiliate/**` ไม่มี `useRef(false)`

## Non-functional (concurrency, idempotency, scale, observability)
- กันกดซ้ำ: dblclick/⌘+Enter ซ้ำ/กด menuitem ซ้ำ = 1 request ทุกฟอร์มและปุ่มยืนยัน (กฎ 4) — backend lock/idempotency เดิมคงไว้
- scale: ไม่มีรายการที่ตัดเพดานเงียบ (กฎ 11); query ใช้ `limit`/`offset` ตามหน้า
- bundle: หลัง ADM-1 มี `@medusajs/ui` สำเนาเดียว

## Test plan: unit / integration / e2e, mapped to AC numbers
| ชนิด | AC |
|---|---|
| unit (jest `test:unit`) | AC-1, AC-2, static ของ AC-3/4/5/7/10/11/12/13, schema ของ AC-6 |
| integration | none (ไม่แก้ backend) |
| e2e admin (Playwright ใน `apps/storefront/e2e`, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`) | AC-3, AC-4 (ชุดเดิม), AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13 |
qa เก็บ evidence ทุก task ที่มี UI (ADM-2a..9) ตาม CLAUDE.md ข้อ 6

## Tasks (each = one PR, ≤ ~400 LOC, ordered, with dependencies)
| Task | งาน — ไฟล์ | AC | Depends |
|---|---|---|---|
| ADM-1 | dependency ตรงกับ dashboard: bump `@medusajs/ui` 4.2.6 → 4.2.8, เพิ่ม `react-hook-form` 7.83.0, `@hookform/resolvers` 5.5.7, `@medusajs/icons` 2.22.1 (exact) + `deps.unit.spec.ts` (รวมตรวจ jest โหลด `@medusajs/dashboard/lib`) + `icon` ของ route `evouchers`, `group-buying` — ไฟล์: `apps/backend/package.json`, `pnpm-lock.yaml`, jest config (ถ้าต้องแก้), `src/admin/__tests__/`, `routes/{evouchers,group-buying}/page.tsx` (เฉพาะ config) | AC-1, AC-2 (2 route) | PR ของ ADR-018/spec 08 merge |
| ADM-2a | `components/common/{header,container}.tsx` (จาก guide); Header + `SectionRow` ใน `flash-sale-options`, `order-evouchers`, `variant-evoucher-pool`; **เพิ่ม**ข้อตรวจ AC-5 + โครงรายการข้อยกเว้นใน `src/admin/__tests__/medusa-ui.unit.spec.ts` ที่ ADM-1 (#186) สร้างไว้แล้ว (แก้รอบ 12 ตาม review #186); (รอบ 12) nit EV-13 #167 ใน `order-evouchers` (จุดซ้อนใน toast + เคส e2e ข้อความใหม่) | AC-5 | ADM-1 |
| ADM-2b | `createSingleFlight` แทน `useRef` ใน `flash-sale-options`, `order-evouchers`, `group-members`, `group-buying/[id]/page`; แสดงวันที่ด้วย `useDate` แทน `formatDate`/`formatDateTime` ของ `lib/evoucher.ts`, `lib/group-buy.ts` และผู้เรียก (รวม `codes-table` เฉพาะ cell วันที่); ตั้ง Playwright e2e admin `locale: "en-US"` + `timezoneId: "Asia/Bangkok"` (project ของไฟล์ `*admin*.spec.ts` หรือ `test.use` ทุกไฟล์); ข้อตรวจ AC-4 ใน `medusa-ui.unit.spec.ts` | AC-3, AC-4 | ADM-2a |
| ADM-3 | pilot ฟอร์ม: drawer ของ `flash-sale-options` + modal Create pool ของ `variant-evoucher-pool` เป็น `Form` + `KeyboundForm` + zod (`optionalInt` + refine/transform) | AC-6 | ADM-2b |
| ADM-4 | หน้า e-voucher: `LayoutComposer` + Header ใน `routes/evouchers/**`, `SectionRow` หน้า pool, `pools-table`/`codes-table` เป็น `DataTable` ของ dashboard (+ filter สถานะ), Reveal ต่อแถวเป็น `ActionMenu` (+ แก้ locator e2e ที่กด Reveal), Header ใน `import-codes` | AC-7 | ADM-2b — ∥ ADM-3, ADM-6 |
| ADM-5 | `partners-section`: ตาราง `DataTable` แบ่งหน้า + `NoRecords` + Edit/Delete ต่อแถวเป็น `ActionMenu` + ฟอร์มสร้าง/แก้เป็น `Form`; `listPartners` รับ `limit`/`offset` (`lib/evoucher.ts`); แก้ locator Edit/Delete ใน `evoucher-admin-forms` | AC-8 | ADM-3 — ∥ ADM-4 (คนละไฟล์; ชน `lib/evoucher.ts` ตัวที่ merge ทีหลัง rebase) |
| ADM-6 | หน้า group buy: `LayoutComposer`, Header, รายการแคมเปญเป็น `DataTable` ของ dashboard (`rowHref`), หน้ารายละเอียด `SectionRow` + `NoRecords` + `loader`/breadcrumb, `groups-section` (คง ui `DataTable`) ใช้ Header + `createSingleFlight` | AC-9 | ADM-2b, GB-N3 (ถ้ายังไม่ merge — ชน `groups-section.tsx`) — ∥ ADM-3, ADM-4 |
| ADM-7 | `create-campaign` เป็น `Form` + `DatePicker`/`z.date()` (คง `toCampaignBody` → `setError` แต่รับ `Date`; ลบ `ictToIso` ใน `lib/group-buy-form.ts` + ปรับ unit, `createSingleFlight`) + `product-picker` ใช้ `useProducts`; helper `fillDatePicker` ใน `e2e/support/admin.ts` (ห่อ `DatePicker` ด้วย element ที่มี testid เดิม เช่น `gb-field-starts_at`; helper คลิก segment แรกใน wrapper แล้วพิมพ์ตามลำดับ segment ของ en-US) + แก้การกรอกวันเวลาใน `group-buy-admin-form` | AC-10 | ADM-3 — ∥ ADM-6 (คนละไฟล์) |
| ADM-8a | affiliate ตาราง: `list-table` → `DataTable` ของ dashboard (`prefix` ต่อแท็บ), Header, `getLocaleAmount` + `useDate` (ลบ `affiliate-format.ts` + ปรับ unit/ข้อความเงินใน e2e), `icon` ของ route `affiliate` + ลบ `"affiliate"` ออกจาก `ICON_PENDING` ใน `medusa-ui.unit.spec.ts` และเพิ่ม assertion ว่าทุก route ใน `ICON_PENDING` ต้อง**ยังไม่มี** `icon:` (กันลืมลบ — review #186) | AC-2 (affiliate), AC-11 | ADM-2b, **#176 (AF-12c) ☑**, **AF-14 merge**, **AF-15 merge** (รอบ 12 — แตะตาราง affiliates เดียวกัน) |
| ADM-8b | affiliate ปุ่มต่อแถว: `affiliates-table`, `programs-table`, `payouts-table` เป็น `ActionMenu` (trigger `affiliate-row-actions`, `affiliate-program-row-actions`, `affiliate-payout-row-actions`) + `createSingleFlight` ใน `payouts-table` + แก้ locator ปุ่มต่อแถวใน e2e `affiliate-admin-*`; (รอบ 12, nit #176) action ของแถว payout เดียวกันกันกัน — ระหว่าง Cancel กำลังส่ง Mark paid กดไม่ได้ และกลับกัน; (nit review #163) deps ของ `useMemo` คอลัมน์ action ใน `programs-table` ครบตามค่าที่อ่าน (ไม่ใช่แค่ `[remove.isPending]`) — ถ้า `ActionMenu` ทำให้ไม่ต้อง memo คอลัมน์แล้วให้ตัด `useMemo` ทิ้ง | AC-13 | ADM-8a |
| ADM-9 | affiliate ฟอร์ม: `program-form` (`Form` + `DatePicker`/`z.date()` ให้ `toProgramBody` รับ `Date` และลบ `ictToIso`/`isoToIct` ใน `lib/affiliate-program-form.ts` + `Combobox`/`useComboboxData` ของ scope), `payout-info-drawer` (`Form` + zod), ฟอร์มของ AF-12c (สร้าง payout ด้วย `DatePicker`, mark paid) + แก้การกรอกวันเวลาใน e2e ด้วย `fillDatePicker`; (รอบ 12, nit #163/#176) ฟอร์มแก้โปรแกรมส่ง `starts_at`/`ends_at` เฉพาะเมื่อแก้ (วินาทีไม่ถูกปัดทุก Save), ปิด `all` แล้วไม่เลือก scope → error ใน `toProgramBody`, ตัวเลือก affiliate ของฟอร์ม payout เป็น `Combobox` ค้นหาได้ (กฎ 11) | AC-12 | ADM-3, ADM-7 (`fillDatePicker`), ADM-8b |
ลำดับ: ADM-1 → ADM-2a → ADM-2b → (ADM-3 ∥ ADM-4 ∥ ADM-6) → (ADM-5 ← ADM-3) ∥ (ADM-7 ← ADM-3); ADM-8a ← (ADM-2b + #176 + AF-14 + AF-15) → ADM-8b → ADM-9 ← (ADM-3 + ADM-7).
(รอบ 12 สถานะ) #183 (ADR-018/spec 08) ☑; ADM-1 ☑ #186 → ADM-2a เริ่มได้; ที่เหลือ ☐ ตามลำดับเดิม — แก้ถ้อยคำ `useDate` (locale จากภาษาของ admin) และเพิ่ม nit ของ #163/#167/#176 ใน ADM-2a/8b/9
ไม่มี task ใดบล็อก release; ADM-1..7 ไม่แตะไฟล์ affiliate (ไม่ชน #176/AF-14)

## Open questions
- ~~Q1~~ ตัดสินแล้ว (owner 2026-10-28): **A** ทำครบ ADM-1..9 ทีละ module
- ~~Q2~~ ตัดสินแล้ว (owner 2026-10-28): อนุญาต bump `@medusajs/ui` 4.2.6 → 4.2.8 ให้ตรงกับ `@medusajs/dashboard` 2.22.1 (บันทึกใน ADR-018; ADM-1)
- ~~เงิน~~ ตัดสินแล้ว (owner 2026-10-28): ใช้ `getLocaleAmount` รูปแบบตาม locale ของ browser เหมือนหน้า admin หลักของ Medusa; e2e/unit กำหนด locale ตายตัว (กฎ 6, 12)
- ~~Q3~~ ตัดสินแล้ว (owner 2026-10-28): **ใช้ `ActionMenu`** สำหรับปุ่มต่อแถว — testid ที่ trigger, e2e หา menuitem ด้วย role + ชื่อ, กันกดซ้ำยังต้องมี (กฎ 10, AC-7/8/13)
- ~~Q4~~ ตัดสินแล้ว (owner 2026-10-28): **ตาม Medusa ทั้งหมด** — `DatePicker` + `z.date()` และ `useDate` ตาม timezone เครื่อง, เลิก `lib/ict.ts` ใน admin, เครื่องแอดมินต้องตั้งเวลาไทย
  (กฎ 5; แก้ spec 00, 03 กฎ 5, 05 กฎ 37c/AC-44 ให้สอดคล้อง)
- ~~Q5~~ ตัดสินแล้ว (owner 2026-10-28): คง `FocusModal`/`Drawer` แบบ state ไม่ใช้ `RouteFocusModal`/`RouteDrawer`
- ~~Q6~~ ตัดสินแล้ว (owner 2026-10-28): ยอมรับ pagination ใน URL (`?<prefix>_offset=`)
