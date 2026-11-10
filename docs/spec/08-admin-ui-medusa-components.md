# 08 Admin UI ใช้ component, hook และ utility ของ Medusa (ADM)
Status: in-progress (owner 2026-10-28 — ADR-018 accepted, Q1–Q6 ตัดสินแล้ว; รอบ 13 2026-11-03: เพิ่มขอบเขต ADM-5 (ตรวจ URL ของ partner — follow-up EV-14 #195) และ ADM-8a (nit AF-14 #187) ใน AC-8/AC-11;
รอบ 23 2026-11-05: ADM-1/2a/2b/3/4/6 ☑ (ADM-3 #294, ADM-4 #296, ADM-6 #293 ผ่าน train #299), ADM-5/7/8a กำลังทำ; follow-up ของ qa/review #293/#294/#296 → ADM-10..13, กฎ 13–17, AC-14..17,
ร่าง issue upstream ของ `DataTable` (หัวข้อ "Follow-up รอบ 23"), คำถาม Q7;
2026-11-05 owner ตอบ Q7 = (ก): ปุ่มใน `action` ของ `DataTable` เป็นข้อยกเว้นที่สองของการหาด้วย testid — กฎ 7c, 18, ADM-13 ปลดล็อก, task ใหม่ ADM-14, AC-18;
รอบ 26 2026-11-09: แก้ถ้อยคำกฎ 7(b), 14, AC-18; ADM-15..17, กฎ 19–21, AC-19..21; Q8 ตัดสินแล้ว;
รอบ 27 2026-11-10: ADM-20, กฎ 24, AC-24; follow-up ADM-21, ADM-22)
Goal (owner's words, 2026-10-28): "หลังบ้าน admin ทั้งหมดได้ใช้ component, hook, utility และอื่นที่ medusa ให้แล้วหรือยัง ถ้ายังให้วางแผนปรับใช้ตามที่ medusa มีให้ก่อนเป็นฐาน
อย่าสร้างซ้ำกับที่มีแล้ว ถ้าไม่มีที่ใช้ได้จริงๆค่อยสร้างเพิ่ม"
Out of scope: เปลี่ยน backend/API, เปลี่ยนพฤติกรรมทางธุรกิจของหน้า admin, แปล admin เป็นไทย (admin คงอังกฤษตาม CLAUDE.md), เปลี่ยน `data-testid`/label ที่ e2e ใช้
(ยกเว้นปุ่มต่อแถวที่ย้ายเข้า `ActionMenu`, ช่องวันเวลาที่เป็น `DatePicker` และปุ่มสร้างที่ย้ายเข้า `action` ของ `DataTable` — กฎ 7), หน้า admin ของ Medusa เอง (เราไม่ override), เวลาของ storefront (คงเวลาไทยตาม spec 01 กฎ 42)

ผลตรวจทีละไฟล์และเหตุผล: ADR-018 (accepted)

## What Medusa already gives us
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| หน้า/เมนูใหม่, widget บนหน้า Medusa | `defineRouteConfig` (`label`, `icon`, `rank`), `defineWidgetConfig` (zone), `loader` + `handle.breadcrumb` | ใช้ตามเดิม + เพิ่ม `icon` (`@medusajs/icons`) และ breadcrumb ที่ขาด (ADM-1, ADM-6, ADM-8a) |
| เรียก API | JS SDK (`lib/client.ts`) + Tanstack Query ตาม Admin tips | ใช้ตามเดิม |
| ข้อมูลสินค้า/collection/category | `useProducts` + `productsQueryKeys` (dashboard/hooks), `useComboboxData` + `sdk.admin.productCollection/productCategory.list` | ใช้แทน `useQuery` เอง (ADM-7, ADM-9) |
| layout หน้า | `LayoutComposer` (`core:single-column`, widget zone) | ใช้แทน `div flex-col gap-y-3` (ADM-4, ADM-6) |
| หัว section | ไม่ export — custom guide **Header** (+ Container wrapper) | คัดลอกจาก guide ไป `components/common/` (ADM-2a); **หน้า list ที่มี `DataTable` ของ dashboard ใช้ `heading`/`subHeading` (+ `action`) ของตารางแทน Header** (รอบ 23 — ADR-018 หมายเหตุ 2026-11-05; ADM-4 ☑, ADM-13) |
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
   `ActionMenu` (กฎ 10), (b) การกรอกช่องวันเวลาที่เป็น `DatePicker` (ใช้ `fillDatePicker`; assertion ค่าที่แสดงเปลี่ยนจาก `toHaveValue` เป็น `expectDatePicker` เพราะ `DatePicker` ไม่มี input ให้ตรวจ — ค่าที่คาดคงเดิม) และ `Combobox` ที่แทน `Select` (เลิกกด `Escape` หลังเปิดรายการ เพราะ `Escape` ปิดทั้ง `FocusModal` — รอบ 26 ตาม review #322) และ (c) (owner Q7 = ก, 2026-11-05) ปุ่มสร้างที่ย้ายเข้า `action` ของ `DataTable`
   ของ dashboard (กฎ 18) — testid เดิมของปุ่มนั้นหายได้ และ e2e หาด้วย `page.getByTestId("<wrapper>").getByRole("button", { name: "<Label อังกฤษ>" })` — แก้ได้เฉพาะ locator/วิธีกรอก
   ของจุดนั้น assertion อื่นคงเดิม; ข้อความที่คาดของเงินเปลี่ยนตามกฎ 6 ได้ (เช่น `THB 1,234.50` → `฿1,234.50`)
8. ฟอร์มใช้ `Form` + `KeyboundForm` + `useForm`; validation ด้วย zod ยกเว้นฟอร์มที่มี builder + unit test เดิม (`toProgramBody`, `toCampaignBody`) ซึ่ง map error เข้า `form.setError`
   (builder รับ `Date` แทน string ICT); ข้อความ error แสดงใต้ช่องด้วย `Form.ErrorMessage` (คง testid error เดิม); `⌘/Ctrl+Enter` ส่งฟอร์มได้ 1 ครั้ง;
   ช่องจำนวนเต็มบวกที่ว่างได้ใช้ `optionalInt` + `.refine` (ว่าง หรือจำนวนเต็ม ≥ 1) + `.transform` (`""`/`undefined` → `null`, string → number) — `optionalInt` อย่างเดียวรับ `"0"` และไม่แปลง `""` เป็น `null`
9. ตารางที่ใช้ `DataTable` ของ dashboard ใช้ `prefix` ไม่ซ้ำกันในหน้าเดียว; หน้าปัจจุบันอยู่ใน URL (`<prefix>_offset`) แล้วอ่านกลับด้วย `useQueryParams` สำหรับ request (owner Q6)
10. ปุ่ม action ต่อแถวของตาราง (Edit, Delete, Approve, Suspend, Reactivate, Payout info, Mark paid, Cancel, Reveal) อยู่ใน `ActionMenu` ของ `@medusajs/dashboard/components`
    (owner Q3): `Action` ไม่รับ `data-testid` จึงส่ง trigger เป็น `children` — `<IconButton size="small" variant="transparent" data-testid="<entity>-row-actions"><EllipsisHorizontal /></IconButton>`
    (ActionMenu ห่อ children ด้วย `DropdownMenu.Trigger asChild` จึงคง testid ที่ปุ่ม); e2e หาแถว → trigger ด้วย testid ภายในแถว → `page.getByRole("menuitem", { name: "<Label อังกฤษ>" })`
    (ข้อยกเว้นแรกของการหาด้วย testid — CLAUDE.md; ข้อที่สองคือปุ่มใน `action` ของ `DataTable` — กฎ 7c, 18); action ที่สถานะไม่อนุญาตไม่ใส่ใน `groups` (เดิม "ไม่มีปุ่ม" → ตอนนี้ "ไม่มี menuitem"); แถวที่ไม่มี action เลยไม่ render trigger;
    `usePrompt` ยืนยันเหมือนเดิม; ปุ่มระดับ section/หน้า (Create, Save, `evoucher-resend`, `gb-campaign-*`, `gb-group-succeed`/`-fail`, `gb-create-pool-group`) คงเป็น `Button` + testid
    ยกเว้นปุ่มสร้างของหน้า list ที่ย้ายเข้า `action` ของ `DataTable` ตามกฎ 18
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
  e2e `evoucher-admin-forms` (AC-20 ของ spec 02: dblclick Save = 1 POST, `getByLabel`) ผ่านโดยแก้เฉพาะ locator ของปุ่ม Edit/Delete ต่อแถว;
  (รอบ 13, spec 02 กฎข้อ 26 — follow-up EV-14 #195) Create/Edit partner ที่ `terms_url` = `javascript:alert(1)` หรือ `logo_url` = `data:text/html,x` → error ใต้ช่องนั้นและไม่มี
  `POST /admin/evoucher/partners*`; `https://example.com/terms` และค่าว่าง (ช่องไม่บังคับ) ส่งได้; unit ของ schema: `http://…`/`https://…` ผ่าน, `javascript:`/`data:`/`ftp:`/`example.com` ไม่ผ่าน
  (ตรวจด้วย `new URL(...).protocol` ไม่ใช่ regex ขึ้นต้น)
- AC-9 (ADM-6) Given แคมเปญชื่อ N When เปิด `/group-buying/:id` Then breadcrumb รายการสุดท้ายเป็น N (มาจาก `loader`); รายการแคมเปญคลิกแถวแล้วไป `/group-buying/:id` และหน้า 2
  อยู่ใน URL; ฟิลด์รายละเอียดใช้ `SectionRow` (static); id ที่ไม่มี → `gb-campaign-not-found` เหมือนเดิม; e2e `group-buy-admin-*` ผ่านโดยไม่แก้
- AC-10 (ADM-7, กฎ 5, 8) e2e `group-buy-admin-form` ผ่านโดยแก้เฉพาะการกรอกวันเวลาเป็น `fillDatePicker` (dblclick Create = 1 POST, `gb-max-quantity-error`, `gb-ends-at-warning`,
  product picker ข้ามหน้า); Given `timezoneId: "Asia/Bangkok"` When กรอก starts `2026-12-01 10:00` และ ends `2026-12-31 23:30` Then body ของ POST มี
  `starts_at = "2026-12-01T03:00:00.000Z"` และ `ends_at = "2026-12-31T16:30:00.000Z"`; `Meta/Control+Enter` ส่ง 1 ครั้ง; static: `product-picker.tsx` ใช้ `useProducts` และไม่เรียก
  `sdk.admin.product.list` เอง, `create-campaign.tsx` ใช้ `DatePicker` ไม่มี `datetime-local`; unit `group-buy-form.unit.spec.ts` ผ่าน — test ของ `ictToIso` ถูกแทนด้วย test ที่ส่ง `Date`
  และจำนวน test ที่เหลือไม่ลด
- AC-11 (ADM-8a, กฎ 5–6, 9) e2e `affiliate-admin-*` ที่มีอยู่ (รวมของ AF-12c/AF-14) ผ่านโดยแก้เฉพาะข้อความเงินที่คาดตามกฎ 6; e2e ใหม่: entry ยอด `1234.5` THB แสดง `฿1,234.50`
  ใน Ledger (`locale: "en-US"`); เปลี่ยนหน้าในแท็บ Payouts แล้ว URL มี offset ของ prefix Payouts เท่านั้น (ไม่มีของ Programs); static: `lib/affiliate-format.ts` ไม่มีแล้ว;
  (รอบ 13, nit review/qa AF-14 #187) unit `lib/__tests__/affiliate-names.unit.spec.ts` assert ค่าที่ parse ได้ (`AdminListAffiliates.parse(query)` มี `id` = `["aff_a","aff_b"]` และ `limit` = 2)
  ไม่ใช่แค่ `success === true`; static: ตาราง affiliate ที่ ADM-8a เขียนใหม่ (แทน `components/affiliate/list-table.tsx`) ไม่มี `as unknown as` (type ของแถวที่มี `affiliate_id` มาจาก generic/prop
  ของตาราง) และ query ชื่อ affiliate ตั้ง `placeholderData: keepPreviousData`; e2e: เปลี่ยนหน้า Ledger แล้ว request `GET /admin/affiliate/affiliates?id[]=…` ยังเป็น 1 ครั้งต่อหน้า (AC-45 ของ spec 05)
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
| ADM-1 | dependency ตรงกับ dashboard: bump `@medusajs/ui` 4.2.6 → 4.2.8, เพิ่ม `react-hook-form` 7.83.0, `@hookform/resolvers` 5.5.7, `@medusajs/icons` 2.22.1 (exact) + `deps.unit.spec.ts` (รวมตรวจ jest โหลด `@medusajs/dashboard/lib`) + `icon` ของ route `evouchers`, `group-buying` — ไฟล์: `apps/backend/package.json`, `pnpm-lock.yaml`, jest config (ถ้าต้องแก้), `src/admin/__tests__/`, `routes/{evouchers,group-buying}/page.tsx` (เฉพาะ config) — ☑ #186 | AC-1, AC-2 (2 route) | PR ของ ADR-018/spec 08 merge |
| ADM-2a | `components/common/{header,container}.tsx` (จาก guide); Header + `SectionRow` ใน `flash-sale-options`, `order-evouchers`, `variant-evoucher-pool`; **เพิ่ม**ข้อตรวจ AC-5 + โครงรายการข้อยกเว้นใน `src/admin/__tests__/medusa-ui.unit.spec.ts` ที่ ADM-1 (#186) สร้างไว้แล้ว (แก้รอบ 12 ตาม review #186); (รอบ 12) nit EV-13 #167 ใน `order-evouchers` (จุดซ้อนใน toast + เคส e2e ข้อความใหม่) — ☑ #205 | AC-5 | ADM-1 |
| ADM-2b | `createSingleFlight` แทน `useRef` ใน `flash-sale-options`, `order-evouchers`, `group-members`, `group-buying/[id]/page`; แสดงวันที่ด้วย `useDate` แทน `formatDate`/`formatDateTime` ของ `lib/evoucher.ts`, `lib/group-buy.ts` และผู้เรียก (รวม `codes-table` เฉพาะ cell วันที่); ตั้ง Playwright e2e admin `locale: "en-US"` + `timezoneId: "Asia/Bangkok"` (project ของไฟล์ `*admin*.spec.ts` หรือ `test.use` ทุกไฟล์); ข้อตรวจ AC-4 ใน `medusa-ui.unit.spec.ts` — ☑ #225 | AC-3, AC-4 | ADM-2a |
| ADM-3 | pilot ฟอร์ม: drawer ของ `flash-sale-options` + modal Create pool ของ `variant-evoucher-pool` เป็น `Form` + `KeyboundForm` + zod (`optionalInt` + refine/transform) — ☑ #294 (train #299) | AC-6 | ADM-2b |
| ADM-4 | หน้า e-voucher: `LayoutComposer` + Header ใน `routes/evouchers/**`, `SectionRow` หน้า pool, `pools-table`/`codes-table` เป็น `DataTable` ของ dashboard (+ filter สถานะ), Reveal ต่อแถวเป็น `ActionMenu` (+ แก้ locator e2e ที่กด Reveal), Header ใน `import-codes` — ☑ #296 (train #299; หัวตาราง pool ใช้ `heading`/`subHeading` ของ `DataTable` แทน Header — ADR-018 หมายเหตุ 2026-11-05) | AC-7 | ADM-2b — ∥ ADM-3, ADM-6 |
| ADM-5 | `partners-section`: ตาราง `DataTable` แบ่งหน้า + `NoRecords` + Edit/Delete ต่อแถวเป็น `ActionMenu` + ฟอร์มสร้าง/แก้เป็น `Form`; `listPartners` รับ `limit`/`offset` (`lib/evoucher.ts`); แก้ locator Edit/Delete ใน `evoucher-admin-forms`; (รอบ 13, follow-up EV-14 #195) zod ของฟอร์ม partner ตรวจ `logo_url`/`terms_url` เป็น http(s) (spec 02 กฎข้อ 26) — ☑ #302 (train #307) | AC-8 | ADM-3 — ∥ ADM-4 (คนละไฟล์; ชน `lib/evoucher.ts` ตัวที่ merge ทีหลัง rebase) |
| ADM-6 | หน้า group buy: `LayoutComposer`, Header, รายการแคมเปญเป็น `DataTable` ของ dashboard (`rowHref`), หน้ารายละเอียด `SectionRow` + `NoRecords` + `loader`/breadcrumb, `groups-section` (คง ui `DataTable`) ใช้ Header + `createSingleFlight` — ☑ #293 (train #299; แถว toolbar ว่างเหนือตาราง → ADM-13) | AC-9 | ADM-2b, GB-N3 (ถ้ายังไม่ merge — ชน `groups-section.tsx`) — ∥ ADM-3, ADM-4 |
| ADM-7 | `create-campaign` เป็น `Form` + `DatePicker`/`z.date()` (คง `toCampaignBody` → `setError` แต่รับ `Date`; ลบ `ictToIso` ใน `lib/group-buy-form.ts` + ปรับ unit, `createSingleFlight`) + `product-picker` ใช้ `useProducts`; helper `fillDatePicker` ใน `e2e/support/admin.ts` (ห่อ `DatePicker` ด้วย element ที่มี testid เดิม เช่น `gb-field-starts_at`; helper คลิก segment แรกใน wrapper แล้วพิมพ์ตามลำดับ segment ของ en-US) + แก้การกรอกวันเวลาใน `group-buy-admin-form`; (รอบ 15 spec 04) `product-picker` เป็น single select ตาม GB-6e (กฎข้อ 30d ของ spec 04) — ห้ามกลับเป็นหลายสินค้าตอนย้ายไป `useProducts` — ☑ #301 (train #307) | AC-10 | ADM-3 — ∥ ADM-6 (คนละไฟล์); ชน `product-picker.tsx` กับ GB-6e (spec 04) — ตัวที่ merge ทีหลัง rebase |
| ADM-8a | affiliate ตาราง: `list-table` → `DataTable` ของ dashboard (`prefix` ต่อแท็บ), Header, `getLocaleAmount` + `useDate` (ลบ `affiliate-format.ts` + ปรับ unit/ข้อความเงินใน e2e), `icon` ของ route `affiliate` + ลบ `"affiliate"` ออกจาก `ICON_PENDING` ใน `medusa-ui.unit.spec.ts` และเพิ่ม assertion ว่าทุก route ใน `ICON_PENDING` ต้อง**ยังไม่มี** `icon:` (กันลืมลบ — review #186); (รอบ 13, nit AF-14 #187) assertion ค่าที่ parse ใน `affiliate-names.unit.spec.ts`, ตัด cast `as unknown as` ของ `affiliateNames`, query ชื่อใช้ `placeholderData: keepPreviousData` — ไฟล์เพิ่ม: `lib/__tests__/affiliate-names.unit.spec.ts` — ☑ #304 (train #307) | AC-2 (affiliate), AC-11 | ADM-2b, #176 (AF-12c) ☑, AF-14 ☑ (#187), **AF-15 merge** (รอบ 12 — แตะตาราง affiliates เดียวกัน) |
| ADM-8b | affiliate ปุ่มต่อแถว: `affiliates-table`, `programs-table`, `payouts-table` เป็น `ActionMenu` (trigger `affiliate-row-actions`, `affiliate-program-row-actions`, `affiliate-payout-row-actions`) + `createSingleFlight` ใน `payouts-table` + แก้ locator ปุ่มต่อแถวใน e2e `affiliate-admin-*`; (รอบ 12, nit #176) action ของแถว payout เดียวกันกันกัน — ระหว่าง Cancel กำลังส่ง Mark paid กดไม่ได้ และกลับกัน; (nit review #163) deps ของ `useMemo` คอลัมน์ action ใน `programs-table` ครบตามค่าที่อ่าน (ไม่ใช่แค่ `[remove.isPending]`) — ถ้า `ActionMenu` ทำให้ไม่ต้อง memo คอลัมน์แล้วให้ตัด `useMemo` ทิ้ง — ☑ #316 | AC-13 | ADM-8a |
| ADM-9 | affiliate ฟอร์ม: `program-form` (`Form` + `DatePicker`/`z.date()` ให้ `toProgramBody` รับ `Date` และลบ `ictToIso`/`isoToIct` ใน `lib/affiliate-program-form.ts` + `Combobox`/`useComboboxData` ของ scope), `payout-info-drawer` (`Form` + zod), ฟอร์มของ AF-12c (สร้าง payout ด้วย `DatePicker`, mark paid) + แก้การกรอกวันเวลาใน e2e ด้วย `fillDatePicker`; (รอบ 12, nit #163/#176) ฟอร์มแก้โปรแกรมส่ง `starts_at`/`ends_at` เฉพาะเมื่อแก้ (วินาทีไม่ถูกปัดทุก Save), ปิด `all` แล้วไม่เลือก scope → error ใน `toProgramBody`, ตัวเลือก affiliate ของฟอร์ม payout เป็น `Combobox` ค้นหาได้ (กฎ 11) — ☑ #322 | AC-12 | ADM-3, ADM-7 (`fillDatePicker`), ADM-8b |
ลำดับ: ADM-1 → ADM-2a → ADM-2b → (ADM-3 ∥ ADM-4 ∥ ADM-6) → (ADM-5 ← ADM-3) ∥ (ADM-7 ← ADM-3); ADM-8a ← (ADM-2b + #176 + AF-14 + AF-15) → ADM-8b → ADM-9 ← (ADM-3 + ADM-7).
(รอบ 12 สถานะ) #183 (ADR-018/spec 08) ☑; ADM-1 ☑ #186 → ADM-2a เริ่มได้; ที่เหลือ ☐ ตามลำดับเดิม — แก้ถ้อยคำ `useDate` (locale จากภาษาของ admin) และเพิ่ม nit ของ #163/#167/#176 ใน ADM-2a/8b/9
ไม่มี task ใดบล็อก release; ADM-1..7 ไม่แตะไฟล์ affiliate (ไม่ชน #176/AF-14)
(รอบ 13 สถานะ, 2026-11-03) ADM-2a ◐ #205; AF-14 ☑ #187; ADM-5 เพิ่มการตรวจ URL ของ partner (follow-up EV-14 #195 ☑), ADM-8a เพิ่ม nit ของ #187 — ลำดับ/Depends เดิม
(รอบ 23 สถานะ, 2026-11-05) ADM-1 ☑ #186, ADM-2a ☑ #205, ADM-2b ☑ #225, ADM-3 ☑ #294, ADM-4 ☑ #296, ADM-6 ☑ #293 (สามตัวหลังผ่าน train #299); ADM-5, ADM-7, ADM-8a กำลังทำ; ADM-8b, ADM-9 ☐ ตามลำดับเดิม;
งานใหม่ ADM-10..13 อยู่ในหัวข้อ "Follow-up รอบ 23" ด้านล่าง; (2026-11-05 Q7 = ก) เพิ่ม ADM-14 — ADM-5/8a/8b ไม่ต้องย้อนแก้ Depends/AC เดิม (กฎ 18)
(รอบ 25 สถานะ, 2026-11-09) ADM-5 ☑ #302, ADM-7 ☑ #301, ADM-8a ☑ #304 (ทั้งสามผ่าน train #307); ADM-8b, ADM-9..14 ☐ ตาม Depends เดิม — owner สั่งเริ่มรอบนี้

## Follow-up รอบ 23 (2026-11-05 — owner อนุมัติให้ทำรอบถัดไป)
ที่มา: qa ADM-4 #296 (`docs/evidence/admin-ui/ADM-4/REPORT.md` O-1, O-2), qa ADM-6 #293 (`ADM-6/REPORT.md` Observation 1, 4), qa ADM-3 #294 (`ADM-3/REPORT.md` Observation 1),
review #293/#296 (หัวตารางใช้ `heading`/`subHeading` ของ `DataTable`, `initialData` จาก loader) — ตรวจโค้ดบน develop `a349676` (path ย่อจาก `apps/backend/src/admin/`):
- `components/evoucher/pools-table.tsx:40–41` และ `codes-table.tsx:83–85` ส่ง `<prefix>_offset` ผ่าน `lib/evoucher-query.ts:7–10` (`toOffset`: ไม่ใช่จำนวนเต็มบวก → 0) แต่**ไม่แก้ URL**;
  `DataTable` ของ dashboard 2.22.1 อ่านค่าดิบเอง (`@medusajs/dashboard/dist/chunk-6CQCXI3F.mjs:555–557` `parsePaginationState` = `parseInt`) → `abc` = "NaN of 2 pages" และ Prev/Next disable,
  `-50` = "0 of 2 pages" (กด Next ครั้งแรกแค่ลบ param) — ยังจริง (O-1); หน้า `/app/campaigns?offset=abc` ของ Medusa เองแสดง error page (qa) — Medusa ไม่มีตัว normalize ให้ใช้
- `codes_offset=99999999` → request ได้ 0 แถว → `emptyState.empty` "Import a CSV to add codes." (`codes-table.tsx:185–188`) ทั้งที่ pool มี code — ยังจริง (O-2)
- `routes/group-buying/page.tsx:71–86` normalize `gb_offset` ด้วย `pageOffset()` (`lib/group-buy-campaign.ts:32–36`, `Math.trunc` ไม่ปัดเป็นหน้า — qa #293 `gb_offset=25` ได้แถว 26–45 แต่ป้าย "2 of 2")
  + `setSearchParams(…, { replace: true })`; ค่าว่าง `gb_offset=` ค้าง (qa #293 Observation 5 — `useQueryParams` คืน `undefined`) — helper สองตัวทำงานเดียวกันคนละกติกา และมีผู้ใช้ 3 ที่ → ย้ายไปที่เดียว
- `routes/evouchers/pools/[id]/page.tsx:17–20` (`useQuery`) + `:93–94` (`loader`) และ `routes/group-buying/[id]/page.tsx:44–49` + `:188–189` เรียก API เดียวกันสองทางโดยไม่แชร์ผล — qa #293 วัดได้ GET 5 ครั้ง
  เมื่อเปิดตรง (หน้า product ของ Medusa 1 ครั้ง) และ GET หน่วง 2 วินาทีแล้วหน้าพร้อมที่ 4.4 วินาที — ยังจริง; Medusa ใช้ `queryClient.ensureQueryData` ใน loader
  (`dist/product-detail-EFCAHRXH.mjs:145–153`) แต่ `queryClient` (`dist/chunk-SEMVMECK.mjs:4–12`, `staleTime: 9e4`) **ไม่ถูก export** จาก `@medusajs/dashboard/{components,hooks,lib}` (ตรวจ `dist/*.d.ts`)
  และ `admin-vite-plugin` 2.22.1 รับเฉพาะ export `loader`/`handle` (`dist/index.mjs:1546–1552`, `:1690–1701`) — `shouldRevalidate` ใช้ไม่ได้
- `routes/evouchers/page.tsx:35–40` ไม่มี `handle` → `createRouteMap` ของ dashboard (`dist/chunk-34AF5R5P.mjs:140616–140669`) ให้ branch `evouchers` ไม่มี breadcrumb (`pools` เป็น branch ว่าง)
  → breadcrumb หน้า pool มีระดับเดียว — ยังจริง (ADM-6 แก้แบบเดียวกันที่ `routes/group-buying/page.tsx:147`)
- `routes/group-buying/page.tsx:102–106` Header แยก + `:115–131` `DataTable` ไม่มี `heading` → `DataTable` render `Toolbar` เสมอ (`chunk-6CQCXI3F.mjs:682–726`) = แถวว่าง 32px (qa #293 Observation 1) — ยังจริง;
  `action` ของ `DataTable` = `{ label: string, disabled?, onClick | to }` และ `DataTableAction` (`chunk-6CQCXI3F.mjs:799–816`) **ไม่ส่งต่อ `data-testid`** → ย้ายปุ่มแล้ว `gb-campaign-create`
  (`components/group-buy/create-campaign.tsx:102`, e2e `group-buy-admin-form.spec.ts:48`) หายไป — ขัดกฎ 7/ADR-018 หลักการ 8 → **Q7**
- filter เปลี่ยนแล้ว offset ไม่ reset: `useDataTable` ของ `@medusajs/ui` 4.2.8 (`dist/esm/blocks/data-table/use-data-table.js:13–18`, `:126–147`) เรียก `onPaginationChange({ pageIndex: 0 })` แล้วตามด้วย
  `onFilteringChange` ใน tick เดียว; handler ของ dashboard ทั้งสอง (`chunk-6CQCXI3F.mjs:558–570`, `:575–595`) ใช้ `setSearchParams((prev) => …)` และ `react-router` 7.18.2
  สร้าง `prev` จาก `searchParams` ของ render ปัจจุบันทุกครั้ง (`react-router/dist/development/chunk-62JRHF6Z.mjs:10851–10859`) → ครั้งหลังเขียนทับครั้งแรก; sort (`onSortingChange`) เป็นแบบเดียวกัน;
  workaround อยู่ที่ `codes-table.tsx:44–74` (`useResetOffsetOnStatusChange`) — ยังจริง → ร่าง issue upstream ด้านล่าง (ไม่มี task โค้ด)
- `widgets/flash-sale-options.tsx:161`, `:174` และ `widgets/variant-evoucher-pool.tsx:66–80` (`face_value`, `low_stock_threshold`) เป็น `<Input type="number">`; พิมพ์ `e` → `validity.badInput = true`
  แต่ value = `""` → schema (`lib/flash-sale-form.ts:10–12`, `lib/evoucher-pool-form.ts:13`, `:18–19`) ถือว่า "ว่าง" → `total_cap: null` (ไม่จำกัด) / `face_value: null` / `low_stock_threshold` = ค่า default โดยไม่มี error
  — ยังจริง (qa #294 Observation 1); `@medusajs/ui` `Input` และ `optionalInt`/`optionalFloat` ไม่ดู `badInput`
Out of scope: แก้ `DataTable` ของ dashboard เอง (patch-package), ตาราง partners (ADM-5) และ affiliate (ADM-8a) — ใช้ hook ของ ADM-10 เมื่อ merge ตามลำดับ (กฎ 13e), ช่อง number ของฟอร์มที่ ADM-7/ADM-9 เขียนใหม่ (ใช้ของกลางของ ADM-12 เมื่อ merge ตามลำดับ)

### What Medusa already gives us (รอบ 23)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| หน้าใน URL | `DataTable` ของ dashboard เขียน/อ่าน `<prefix>_offset` (`parseInt` ค่าดิบ) + `useQueryParams` | ใช้ตามเดิม + **custom** hook normalize ค่าใน URL (Medusa ไม่มี — หน้า campaigns ของ Medusa เองล่มกับ `offset=abc`) |
| แชร์ผล loader กับ query | Medusa ใช้ `queryClient.ensureQueryData` (ไม่ export) | **extend**: `initialData` ของ `useQuery` จาก `useLoaderData()` (Tanstack Query) — ใช้ `staleTime` 90s ของ QueryClient ของ dashboard |
| breadcrumb | `handle.breadcrumb` + `createRouteMap` (branch ตาม path) | ใช้ตามเดิม — เพิ่ม `handle` ที่ `/evouchers` |
| หัวตารางหน้า list | `DataTable` ของ dashboard `heading`, `subHeading`, `action`/`actions` (แบบหน้า list ของ Medusa) | ใช้แทน Header แยก (ADR-018 หมายเหตุ 2026-11-05); `action` ไม่รับ `data-testid` → Q7 = (ก): e2e หาปุ่มด้วย role + ชื่อภายใน wrapper ที่มี testid (กฎ 18) |
| ค่าไม่ใช่ตัวเลขใน `<input type="number">` | ไม่มี (`Input` ของ ui, `optionalInt`/`optionalFloat` ไม่ดู `validity.badInput`) | **custom** เล็ก ใน `components/common/` (ผู้ใช้ 2 ที่: widget flash sale + modal pool) |
| filter แล้วกลับหน้าแรก | `autoResetPageIndex` ของ `useDataTable` (พังเมื่อใช้กับ `setSearchParams` ของ dashboard — ด้านบน) | คง workaround จน upstream แก้ (กฎ 17) |

### Business rules (รอบ 23)
13. (ADM-10) offset ของตาราง `DataTable` ของ dashboard ใน `src/admin` ผ่านของกลางชุดเดียว:
    (a) `src/admin/lib/page-offset.ts` (pure, ไม่ import ui/dashboard): `pageOffset(raw, pageSize)` — `undefined`/ว่าง/ไม่ใช่ตัวเลข/ไม่ finite/≤ 0 → `0`, อื่นๆ ปัดลงเป็นต้นหน้า
        (`Math.floor(n / pageSize) * pageSize`); `clampOffset(offset, count, pageSize)` — `count === 0` → `0`, `offset ≥ count` → ต้นหน้าสุดท้าย (`Math.floor((count - 1) / pageSize) * pageSize`), อื่นๆ คงเดิม;
    (b) hook `usePageOffset(prefix, pageSize, { count?, resetOn? })` ใน `src/admin/components/common/use-page-offset.ts` คืน offset ที่ใช้ขอข้อมูล และเมื่อค่าดิบใน URL ≠ ค่าที่ normalize
        (รวม `<prefix>_offset=` ค่าว่าง และ offset เกินเมื่อรู้ `count` แล้ว) แก้ URL ด้วย `setSearchParams(…, { replace: true })` (ค่า 0 = ลบ param) — ไม่เพิ่ม history;
    (c) **ผู้เขียน URL ต่อ commit มีตัวเดียว**: reset เมื่อ filter เปลี่ยน (workaround ของ `codes-table`, กฎ 17) ย้ายเข้า hook เดียวกัน (`resetOn` = ค่า filter) เพราะ `setSearchParams` สองครั้งใน commit เดียวเขียนทับกัน;
        ระหว่างรอ URL เปลี่ยน request ใช้ offset ที่ normalize แล้ว (ไม่ยิง request ของค่าดิบ);
    (d) ผู้ใช้: `routes/group-buying/page.tsx`, `components/evoucher/pools-table.tsx`, `components/evoucher/codes-table.tsx`; ลบ `pageOffset` ออกจาก `lib/group-buy-campaign.ts` และ `toOffset` ออกจาก `lib/evoucher-query.ts`
        (ย้าย unit test เดิมไป `lib/__tests__/page-offset.unit.spec.ts`);
    (e) ตารางที่ใช้ `DataTable` ของ dashboard ที่ merge หลัง ADM-10 (ADM-5 partners, ADM-8a affiliate) ใช้ hook นี้; ถ้า merge ก่อน ADM-10 ให้ ADM-10 เปลี่ยนตารางนั้นด้วย;
    (f) (hotfix #324) `DataTable` ของ dashboard 2.22.1 `parseInt` ค่าดิบใน URL เอง และการแก้ URL ต้องรอ loader ก่อน commit — ระหว่างนั้น `-50` ได้ pageIndex -1 (กด Next แล้วลบ offset แทนการไปหน้า 2) จึงครอบ `DataTable` ทุกตารางที่ใช้ `usePageOffset` ด้วย `PageOffsetGate`
        (`components/common/page-offset-gate.tsx`, ใช้ `isMalformedOffset` ใน `lib/page-offset.ts`): ไม่ render จนกว่า `<prefix>_offset` จะไม่ผิดรูป — ตารางและปุ่มใน `action` จึงหายชั่วขณะจนแก้ URL เสร็จ (ยอมรับ; e2e ใน ADM-19);
        ผู้ใช้: `routes/group-buying/page.tsx`, `components/evoucher/{pools-table,codes-table,partners-section}.tsx`, `components/affiliate/list-table.tsx`
14. (ADM-11) หน้ารายละเอียดที่มี `loader` (`routes/evouchers/pools/[id]/page.tsx`, `routes/group-buying/[id]/page.tsx`) ส่ง `initialData: useLoaderData() ?? undefined` ให้ `useQuery` key เดิม
    — ไม่ import ของภายในของ dashboard, ไม่เพิ่ม cache ใน loader; loader ที่คืน `null` (group buy 404) → `initialData` เป็น `undefined` → `useQuery` ยิงเองและแสดง `gb-campaign-not-found` เหมือนเดิม;
    ถ้าแก้แล้วจำนวน GET ของ resource เมื่อเปิดตรงเกินเกณฑ์ใน AC-15 เพราะ loader ถูกเรียกซ้ำเอง (revalidate) ให้หยุดรายงาน planner (ห้ามเขียน cache เอง);
    `routes/evouchers/page.tsx` export `handle = { breadcrumb: () => "E-vouchers" }` → breadcrumb หน้า pool = "E-vouchers › <ชื่อ pool>"
15. (ADM-12) ช่อง `<Input type="number">` ใน `Form` ของ admin ที่ว่างได้หรือมีค่า default (flash sale `per_customer_limit`, `total_cap`; pool `face_value`, `low_stock_threshold`):
    ถ้า `validity.badInput === true` ตอน submit → error ใต้ช่อง (ข้อความเดียวกับค่าไม่ถูกของช่องนั้น เช่น `POSITIVE_INT_MESSAGE`) และไม่ส่ง request — ไม่ถือเป็น "ว่าง";
    ทำเป็นของกลางชิ้นเดียวใน `src/admin/components/common/` (เช่น `NumberInput` ที่ห่อ `Input` ของ ui หรือ helper ตรวจ `badInput` ก่อน `handleSubmit` — เลือกใน PR) ไม่คัดลอกต่อช่อง;
    ฟอร์มที่ ADM-7/ADM-9 เขียนใหม่ใช้ของกลางนี้เมื่อ merge หลัง ADM-12
16. (ADM-13 — Q7 = (ก) owner 2026-11-05) หน้า list ที่ใช้ `DataTable` ของ dashboard ใส่หัวตารางด้วย `heading`/`subHeading` และปุ่มสร้างด้วย `action` ของ `DataTable` (ไม่มี Header แยก → ไม่มีแถว toolbar ว่าง);
    `CreateCampaign` เป็น controlled (`open`, `onOpenChange`) ไม่มีปุ่ม trigger ในตัว; ทุกครั้งที่ `open` เปลี่ยน false → true ตั้ง idempotency key ใหม่และ reset ฟอร์ม (spec 04 กฎข้อ 33d — GB-13/GB-15 ห้ามถอย);
    ข้อความเตือน GBT- (spec 04 Q7) ยังเห็นใน Container เดียวกัน (testid ใหม่ `gb-template-warning`)
17. (upstream) workaround reset offset เมื่อ filter เปลี่ยน (`codes-table.tsx:44–74` → ใน hook ของกฎ 13c หลัง ADM-10) คงไว้จนกว่า `@medusajs/dashboard` ที่ pin มี fix;
    PR ที่ bump `@medusajs/dashboard` (ผ่าน ADR ตาม CLAUDE.md) ต้องรัน e2e "เปลี่ยน filter จากหน้า 2" ของ AC-7 โดยปิด `resetOn` — ผ่าน → ลบ workaround ใน PR นั้น, ล้ม → คงไว้;
    เมื่อ owner ส่ง issue แล้ว ให้ PR ถัดไปที่แตะ `codes-table.tsx`/hook ใส่ URL ของ issue ใน comment ของ workaround
18. (owner Q7 = (ก), 2026-11-05 — ADR-018 หมายเหตุ 2026-11-05 (2)) ปุ่มสร้างของหน้า list ที่ใช้ `DataTable` ของ dashboard อยู่ใน `action` ของ `DataTable`
    (หัวตารางใช้ `heading`/`subHeading` — ไม่มี Header แยก); `DataTableAction` ของ `@medusajs/dashboard` 2.22.1 (`chunk-6CQCXI3F.mjs:799–816`) ไม่ส่งต่อ `data-testid`
    จึง**ห่อ `DataTable` ด้วย element ที่มี wrapper testid** (ครอบทั้ง toolbar และตาราง) และ e2e หาปุ่มด้วย
    `page.getByTestId("<wrapper>").getByRole("button", { name: "<Label อังกฤษ>" })` — ข้อยกเว้นที่สองของการหาด้วย testid (CLAUDE.md); ห้ามหาปุ่มด้วยชื่อระดับ `page` โดยไม่มี wrapper;
    wrapper testid ต่อหน้า (ตายตัว):

    | หน้า/ตาราง | wrapper testid | ปุ่ม (ชื่อ) | testid เดิมที่หายไป | Task |
    |---|---|---|---|---|
    | `/group-buying` รายการแคมเปญ | `gb-campaigns-table` (มีอยู่แล้ว `routes/group-buying/page.tsx:113`) | "Create campaign" | `gb-campaign-create` | ADM-13 |
    | `/evouchers` ตาราง Partners | `evoucher-partners-table` (ใหม่) | "Create partner" | — (เดิมไม่มี testid; e2e หาด้วยชื่อระดับ `page`) | ADM-5 หรือ ADM-14 |
    | `/affiliate` แท็บ Programs | `affiliate-programs-table` (ใหม่) | "Create program" | `affiliate-program-create` | ADM-14 |
    | `/affiliate` แท็บ Payouts | `affiliate-payouts-table` (ใหม่) | "Create payout" | `affiliate-payout-create` | ADM-14 |

    กันกดซ้ำ: `onClick` ของ `action` เปิด modal ที่เป็น controlled (`open`/`onOpenChange`) — กดซ้ำขณะเปิดอยู่ไม่สร้าง modal/idempotency key ซ้อน; การกันส่งซ้ำอยู่ที่ปุ่ม submit ตามกฎ 4 เดิม;
    ADM-5/ADM-8a/ADM-8b ที่กำลังทำไม่บังคับให้ย้อนแก้ — ถ้ายังไม่เปิด PR ใช้กฎนี้ได้เลย (แล้วตัดส่วนนั้นออกจาก ADM-14) ไม่งั้นคง Header/ปุ่ม + testid เดิมแล้ว ADM-14 ตามแก้

### Acceptance criteria (รอบ 23)
- AC-14 (ADM-10, กฎ 13) unit `lib/__tests__/page-offset.unit.spec.ts`: `pageOffset(x, 50)` = 0 สำหรับ `undefined`, `""`, `"abc"`, `"-50"`, `"NaN"`, `"Infinity"`, `"12.5"`; `pageOffset("75", 50)` = 50,
  `pageOffset("50", 50)` = 50, `pageOffset("25", 20)` = 20, `pageOffset("1e1", 20)` = 0; `clampOffset(99999950, 60, 50)` = 50, `clampOffset(50, 60, 50)` = 50, `clampOffset(100, 0, 50)` = 0;
  static (`medusa-ui.unit.spec.ts`): `lib/group-buy-campaign.ts` ไม่มี `pageOffset`, `lib/evoucher-query.ts` ไม่มี `toOffset`, `use-page-offset` ถูก import ≥ 3 ไฟล์, `codes-table.tsx` ไม่มี `useSearchParams`;
  e2e 1280×800 (ต่อจาก `e2e/evoucher-admin-pool-page.spec.ts`): Given pool ที่มี code 60 ตัว When เปิด `?codes_offset=abc` Then URL ไม่มี `codes_offset`, ตารางใน `evoucher-codes` มี 50 แถว,
  ข้อความใน `evoucher-codes` ไม่ตรง `/NaN/` และ `history.length` เท่ากับก่อนเปิด (replace); กด Next → `codes_offset=50` และ 10 แถว; When `?codes_offset=-50` Then ไม่มี `codes_offset` และกด Next ครั้งเดียว → `codes_offset=50`;
  When `?codes_offset=99999999` Then URL เป็น `codes_offset=50`, 10 แถว, ไม่มีข้อความ "Import a CSV to add codes." ใน `evoucher-codes`; filter `delivered` จากหน้า 2 ยังได้ 5 แถว (AC-7 ผ่านโดยไม่แก้);
  `/app/evouchers?pools_offset=abc` → ไม่มี `pools_offset`; `/app/group-buying?gb_offset=` → ไม่มี `gb_offset`; Given แคมเปญ ≥ 21 (test สร้างเองให้พอ) When `?gb_offset=25` Then `gb_offset=20`; When `?gb_offset=99999` Then `gb_offset` =
  `Math.floor((count − 1) / 20) * 20` โดย `count` จาก `GET /admin/group-buy/campaigns` ตอนนั้น (DB ของ e2e มีแคมเปญของ test อื่น — ไม่ fix ตัวเลข);
  e2e `group-buy-admin-pages` และ `evoucher-admin-pool-page` เดิมผ่าน
- AC-15 (ADM-11, กฎ 14) e2e ใหม่ `e2e/admin-detail-loader.spec.ts` 1280×800: Given แคมเปญ C และ pool P (สร้างผ่าน API) When `page.goto` `/app/group-buying/<C>` แล้วรอ `gb-campaign-status` visible
  และ network idle Then จำนวน request `GET` ที่ pathname = `/admin/group-buy/campaigns/<C>` พอดี (ไม่นับ `/groups`) ≤ 4 และไม่มี GET นั้นที่เริ่มหลัง response แรกของ path นั้น (useQuery ไม่ยิงเพิ่มจาก loader); When `page.goto` `/app/evouchers/pools/<P>` แล้วรอ `evoucher-codes` visible
  Then `GET` ที่ pathname = `/admin/evoucher/pools/<P>` พอดี (ไม่นับ `/codes`) ≤ 4 และไม่มี GET ที่เริ่มหลัง response แรก (รอบ 25, session หลัก 2026-11-09) loader ถูก dashboard 2.22.1 เรียกซ้ำเอง — `createRouteMap` ใส่ loader ทั้ง branch และ leaf route; issue upstream ร่างไว้ owner ส่ง — PR แนบจำนวนก่อน/หลังแก้ (develop 5 ตาม qa #293) และ test ต้องล้มบน develop `a349676`;
  Given `page.route` หน่วงทุก GET ของ `/admin/group-buy/campaigns/<C>` 2000ms When คลิกแถว C ใน `gb-campaigns-table` Then เวลาจากคลิกถึง `gb-campaign-status` visible < 3500ms (develop ~4.4s);
  id ที่ไม่มี → `gb-campaign-not-found` (AC-9); breadcrumb หน้า P (อ่านแบบ e2e `group-buy-admin-pages` ของ AC-9) = `["E-vouchers", <ชื่อ P>]` และรายการแรกลิงก์ไป `/app/evouchers`;
  e2e `group-buy-admin-detail`, `group-buy-admin-members`, `evoucher-admin-pool-page` ผ่านโดยไม่แก้
- AC-16 (ADM-12, กฎ 15) e2e 1280×800 (ต่อจาก `e2e/admin-form-pilot.spec.ts`): Given drawer flash sale When `pressSequentially("e")` ในช่อง Total cap แล้วกด Save Then `fs-total-cap-error` visible
  ข้อความ "Must be a whole number greater than 0" และไม่มี `POST …/config`; เช่นเดียวกันกับ `1e` และกับช่อง Per-customer limit (`fs-per-customer-limit-error`); When ล้างช่อง (`fill("")`) แล้ว Save
  Then `POST` 1 ครั้ง body `total_cap: null`; Given modal Create pool (กรอกช่องบังคับครบ) When Face value = `e` Then `evoucher-pool-face_value-error` visible และไม่มี POST; Low stock threshold = `e`
  → `evoucher-pool-low_stock_threshold-error` และไม่มี POST; static: `flash-sale-options.tsx` และ `variant-evoucher-pool.tsx` import ของกลางจาก `components/common/`; AC-6 ผ่านโดยไม่แก้
- AC-17 (ADM-13, กฎ 16, 18 — Q7 = (ก) owner 2026-11-05) e2e 1280×800: เปิด `/app/group-buying` Then ภายใน `gb-campaigns-table` มี heading "Group-buy campaigns" 1 ตัว และปุ่ม role `button` ชื่อ "Create campaign"
  ที่ `|centerY(ปุ่ม) − centerY(บล็อก heading+subHeading)| ≤ 8` (อยู่แถวเดียวกัน — (รอบ 25, session หลัก 2026-11-09) เทียบกับบล็อกแทนตัว heading เพราะ toolbar ของ `DataTable` จัด `items-center` ตามดีไซน์ Medusa จึงต่างจากตัว heading ครึ่งบรรทัด subHeading ≈ 10 px; คงเกณฑ์ 8) และ `gb-template-warning` visible; static: `routes/group-buying/page.tsx` ไม่ import `components/common/header`, `create-campaign.tsx` ไม่มี `gb-campaign-create`
  และ `CreateCampaign` รับ `open`/`onOpenChange`; e2e `group-buy-admin-form` ผ่านโดยแก้เฉพาะ locator ของปุ่มเปิด modal (`gb-campaign-create` → `getByTestId("gb-campaigns-table").getByRole("button", { name: "Create campaign" })`)
  — dblclick Create = 1 POST และ (GB-15) เปิด modal สองครั้งแล้วสร้าง → `idempotency_key` ของสอง POST ต่างกัน
- AC-18 (ADM-14, กฎ 18) e2e 1280×800: ทุกแถวในตารางกฎ 18 ที่ ADM-14 ทำ — เปิดหน้า/แท็บนั้น Then ภายใน wrapper testid มีปุ่ม role `button` ชื่อตามตาราง 1 ตัว
  ที่ `|centerY(ปุ่ม) − centerY(บล็อกหัวตาราง)| ≤ 8` (บล็อกหัวตาราง = element ที่ครอบ heading และ subHeading; toolbar ของ `DataTable` จัดปุ่มกึ่งกลางกับบล็อกนี้ — รอบ 26 แบบเดียวกับ #321) และระยะจากขอบบน wrapper ถึงขอบบน heading ≤ 24px (ไม่มีแถว toolbar ว่าง 32px — qa #293 Obs 1); กดปุ่มแล้ว modal เดิมเปิด (`affiliate-program-*`/`affiliate-payout-*` testid ในฟอร์มเดิม); static: `programs-table.tsx`, `payouts-table.tsx`
  ไม่มี `affiliate-program-create`/`affiliate-payout-create`, `partners-section.tsx` (ถ้าอยู่ใน ADM-14) และไฟล์ทั้งสองไม่ import `components/common/header`;
  e2e `affiliate-admin-programs`, `affiliate-admin-payout-create`, `evoucher-admin-forms` ผ่านโดยแก้เฉพาะ locator ปุ่มเปิด modal ตามกฎ 7c
  (เช่น `getByTestId("affiliate-program-create")` → `getByTestId("affiliate-programs-table").getByRole("button", { name: "Create program" })`) — dblclick ปุ่ม submit = 1 POST ตามเดิม

### Test plan (รอบ 23)
| ชนิด | AC |
|---|---|
| unit (jest `test:unit`) | AC-14 (pure + static), static ของ AC-16/AC-17/AC-18 |
| e2e admin (`locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, 1280×800) | AC-14, AC-15, AC-16, AC-17, AC-18 |
qa เก็บ evidence ทุก task (UI admin) — ADM-11 วัดจำนวน GET บน prod build (`medusa build` + `medusa start`) แบบ qa #293

### Tasks (รอบ 23)
| Task | งาน | ไฟล์ที่แตะ (`apps/backend/src/admin/` ยกเว้นระบุ) | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-10 | (qa #296 O-1/O-2 + qa #293 Obs 5) offset ใน URL ผ่านของกลาง: `pageOffset`/`clampOffset` + hook `usePageOffset` (normalize + clamp + reset เมื่อ filter เปลี่ยนในตัวเขียนเดียว) ใช้ใน group buy, pools, codes (กฎ 13) — ☑ #315 (+ hotfix #324, กฎ 13f) | `lib/page-offset.ts` (ใหม่) + `lib/__tests__/page-offset.unit.spec.ts` (ใหม่), `components/common/use-page-offset.ts` (ใหม่), `lib/group-buy-campaign.ts` (+ unit เดิม), `lib/evoucher-query.ts` (+ unit เดิม), `routes/group-buying/page.tsx`, `components/evoucher/{pools-table,codes-table}.tsx`, `__tests__/medusa-ui.unit.spec.ts`, `apps/storefront/e2e/evoucher-admin-pool-page.spec.ts` | ~220 LOC รวม test | 1280×800 | AC-14 | none — **เริ่มได้** (ADM-4 ☑ #296, ADM-6 ☑ #293); ∥ ADM-11, ADM-12 | ไม่ชนไฟล์กับ ADM-5/7/8a, CORE-48, CORE-4i-b; ตาราง partners (ADM-5) และ affiliate (ADM-8a) ใช้ hook ตามกฎ 13e — ตัวที่ merge ทีหลังปรับ |
| ADM-11 | (qa #293 Obs 4 + review #293/#296) หน้ารายละเอียด pool/group buy ส่ง `initialData` จาก `useLoaderData()` ให้ `useQuery` + breadcrumb `E-vouchers` ที่ `/evouchers` (กฎ 14) — ☑ #311 | `routes/evouchers/pools/[id]/page.tsx`, `routes/group-buying/[id]/page.tsx`, `routes/evouchers/page.tsx` (เฉพาะ `handle`), `apps/storefront/e2e/admin-detail-loader.spec.ts` (ใหม่) | ~120 LOC รวม e2e | 1280×800 | AC-15 | none — **เริ่มได้**; ∥ ADM-10, ADM-12 | ไม่ชน (ADM-5 แตะ `partners-section`/`lib/evoucher.ts` ไม่แตะ `routes/evouchers/page.tsx` — ถ้าแตะ ตัวที่ merge ทีหลัง rebase) |
| ADM-12 | (qa #294 Obs 1) ช่อง number ที่ว่างได้ตรวจ `validity.badInput` → error ใต้ช่อง ไม่ส่ง request ด้วยของกลางชิ้นเดียว (กฎ 15) — ☑ #313 | `components/common/number-input.tsx` (ใหม่ — ชื่อเลือกใน PR), `widgets/flash-sale-options.tsx`, `widgets/variant-evoucher-pool.tsx`, `__tests__/medusa-ui.unit.spec.ts`, `apps/storefront/e2e/admin-form-pilot.spec.ts` | ~120 LOC รวม e2e | 1280×800 | AC-16 | none — **เริ่มได้** (ADM-3 ☑ #294); ∥ ADM-10, ADM-11 | ไม่ชน; ADM-7 (`create-campaign.tsx`) / ADM-9 ใช้ของกลางเมื่อ merge หลัง ADM-12 (กฎ 15) |
| ADM-13 | (qa #293 Obs 1 + review #293) หน้า `/group-buying` ใช้ `heading`/`subHeading`/`action` ของ `DataTable` แทน Header แยก, `CreateCampaign` เป็น controlled (กฎ 16); ปุ่ม "Create campaign" ใน `action` หาใน wrapper `gb-campaigns-table` (กฎ 18) — ☑ #321 | `routes/group-buying/page.tsx`, `components/group-buy/create-campaign.tsx`, `__tests__/medusa-ui.unit.spec.ts`, `apps/storefront/e2e/group-buy-admin-form.spec.ts` (locator ปุ่มเปิด modal) | ~90 LOC | 1280×800 | AC-17 | ADM-7 (#301 ยังไม่ merge), ADM-10 (ยังไม่เริ่ม — ชน `group-buying/page.tsx`) ต้อง merge ทั้งคู่ก่อน | **ชน ADM-7** (`create-campaign.tsx`, `group-buy-admin-form.spec.ts`) → ห้ามเริ่มก่อน ADM-7 merge; ไม่ชน ADM-5/8a, CORE-48, CORE-4i-b |
| ADM-14 | (Q7 = ก, 2026-11-05) ปุ่มสร้างของหน้า list ที่เหลือเข้า `action` ของ `DataTable` + wrapper testid ตามตารางกฎ 18: Partners (เฉพาะเมื่อ ADM-5 merge โดยยังมี Header/ปุ่มแยก), Programs, Payouts (ADM-8a ใช้ Header + `subHeading`) — ตัด Header แยกของตารางนั้น, ลบ `affiliate-program-create`/`affiliate-payout-create`, แก้ locator e2e ตามกฎ 7c — ☑ #327 | `components/affiliate/{programs-table,payouts-table}.tsx` (+ ตารางของ ADM-8a ถ้า `heading`/`action` ส่งผ่านที่นั่น), `components/evoucher/partners-section.tsx` (ถ้ามี), `__tests__/medusa-ui.unit.spec.ts`, `apps/storefront/e2e/{affiliate-admin-programs,affiliate-admin-payout-create,evoucher-admin-forms}.spec.ts` (locator ปุ่มเปิด modal) | ~120 LOC | 1280×800 | AC-18 | ADM-5, ADM-8b (merge แล้ว — ชน `programs-table`/`payouts-table`); ∥ ADM-13 (คนละไฟล์) | ชน ADM-9 ถ้า ADM-9 แตะ `payouts-table.tsx`/`programs-table.tsx` (เปิด modal) — ตัวที่ merge ทีหลัง rebase |
ลำดับ: ADM-10 ∥ ADM-11 ∥ ADM-12 เริ่มได้ทันที → ADM-13 ← ADM-7 + ADM-10 (Q7 = ก แล้ว 2026-11-05); ADM-14 ← ADM-5 + ADM-8b (∥ ADM-13); ไม่มี task ใดบล็อก release

### ร่าง issue upstream (owner ส่งที่ https://github.com/medusajs/medusa/issues — ค้นว่ามี issue ซ้ำก่อนส่ง)
ข้อความด้านล่างเป็นภาษาอังกฤษสำหรับ GitHub; ตัวเลขบรรทัดอ้าง `@medusajs/dashboard` 2.22.1 / `@medusajs/ui` 4.2.8 ที่เรา pin
```
Title: [dashboard] DataTable: changing a filter (or sort) on page 2+ does not reset `<prefix>_offset` — table shows an empty page

Package versions: @medusajs/dashboard 2.22.1 (exports from @medusajs/dashboard/components), @medusajs/ui 4.2.8, react-router-dom 7.18.2

Steps to reproduce (admin extension):
1. Render `<DataTable prefix="codes" pageSize={50} filters={[radio filter "status"]} … />` from
   `@medusajs/dashboard/components`, with data fetched via `useQueryParams(["offset","status"], "codes")`.
2. Go to page 2 (URL has `codes_offset=50`).
3. Pick a filter value that matches fewer than 50 rows.

Expected: offset is reset (URL has no `codes_offset`), first page of the filtered result is shown.
Actual: URL keeps `codes_offset=50` and gets `codes_status=…`; the table is empty ("No results")
although matching rows exist. Sorting from page 2 behaves the same.

Cause: `useDataTable` (@medusajs/ui, blocks/data-table/use-data-table.js) calls
`onPaginationChange({ pageIndex: 0 })` and then `onFilteringChange(...)` in the same tick.
Both handlers in the dashboard `DataTable` call `setSearchParams((prev) => …)`.
react-router's `setSearchParams` builds `prev` from the searchParams of the current render
(not from a queued update), so the second call overwrites the first and the offset deletion is lost.

Suggested fix: in the dashboard DataTable, delete `getQueryParamKey("offset", prefix)` inside
`handleFilteringChange` and `handleSortingChange` (single setSearchParams call), or pass
`autoResetPageIndex: false` to `useDataTable` and reset the page in the same update.

Workaround we use: an effect that deletes `<prefix>_offset` when the filter value changes.
```

## Follow-up รอบ 26 (2026-11-09)
ที่มา: review/qa #315 (ADM-10), #316 (ADM-8b), #321 (ADM-13), #322 (ADM-9) และ follow-up รอบ 25 — ตรวจโค้ดใน worktree `origin/develop` (path ย่อจาก `apps/backend/src/admin/`):
- `components/group-buy/create-campaign.tsx:31–34`, `:42–55` ช่อง `type: "number"` ยังเป็น `Input` (ADM-12 ปิดเฉพาะ flash sale + pool; `NumberInput` อยู่ที่ `components/common/number-input.tsx`) — ยังจริง
- `components/evoucher/codes-table.tsx:140` และ `partners-section.tsx:166` deps ของ `columns` มี `prompt`/`getFullDate` ที่สร้างใหม่ทุก render — blocker ของ #316 แก้ที่ `affiliate/programs-table.tsx:93–104` ด้วย component ต่อแถว + `actionsColumn` deps `[]` — ยังจริงที่สองไฟล์นี้
- `?codes_offset=99999999` request แรกได้ 0 แถวก่อน clamp → empty state กระพริบ 1 frame (ไม่หน่วง) ถึง ~830ms (GET หน่วง 800ms; qa #315 O-1) — ยังจริง
- `GET /admin/affiliate/affiliates` ไม่รับ `q` (`api/admin/affiliate/validators.ts:57`) → ADM-9 (#322) ดึงทีละ 200 จนครบทุกครั้งที่เปิดฟอร์ม และ query ล้มแล้วรายการว่างไม่มีข้อความ
Out of scope: แก้ `DataTable`/`ActionMenu` ของ dashboard, patch-package, ปรับ AC-15/AC-17 (PR #311/#321 แก้เอง)

### What Medusa already gives us (รอบ 26)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ค้นหาใน list ของ module เรา | `q` ของ `query.graph` (DML `.searchable()`) | **extend**: `.searchable()` ที่ `name`/`email` ของ affiliate + `q` ใน validator (ไม่มี migration) |
| เลือกค่าแบบค้นหา | `Combobox` + `useComboboxData` (dashboard) | ใช้แทน `fetchAllAffiliates`/`Select` |
| ช่อง number กันค่าไม่ใช่ตัวเลข | ไม่มี — `NumberInput` ของเรา (ADM-12) | ใช้ตามเดิม |
| ปิด modal คืน focus | `FocusModal` (Radix `onCloseAutoFocus` ส่งผ่าน `Content` ของ `@medusajs/ui`) | ใช้ตามเดิม — ส่ง prop |

### Business rules (รอบ 26)
19. (ADM-15 — follow-up รอบ 25, #321) `create-campaign.tsx`: (a) ช่องที่เป็น `type: "number"` ทั้งหมดใช้ `NumberInput` (กฎ 15) และ schema ถือ `BAD_NUMBER_INPUT` เป็น error ใต้ช่อง; (b) ปิด modal แล้ว focus กลับปุ่ม "Create campaign" ในตาราง (`onCloseAutoFocus` ของ `FocusModal.Content`); (c) comment หัวไฟล์ `__tests__/group-buy-pages.unit.spec.ts` ตรงโค้ด (`heading` ของ `DataTable` ไม่ใช่ Header)
20. (ADM-16 — #316, #315) (a) `codes-table.tsx` และ `partners-section.tsx`: ปุ่มต่อแถวเป็น component แยก (`usePrompt` อยู่ใน component นั้น) และคอลัมน์ action แยกเป็น `actionsColumn` (`useMemo` ที่ deps ไม่มี `prompt`/`getFullDate`) ให้ `cell` ของปุ่มต่อแถวคงที่ข้าม render ตามต้นแบบ `programs-table.tsx` — `columns` รวมมี `actionsColumn` และ `getFullDate` ใน deps ได้ (`[actionsColumn, getFullDate]`); (b) ระหว่าง offset ใน URL ยังไม่ถูก clamp ตารางไม่แสดง empty state (เช่น `isLoading`/`isPending` จนกว่า `raw === target`); (c) static ของ AC-14: `use-page-offset.ts` มี `replace: true`, `codes-table.tsx` มี `resetOn: status`
21. (ADM-17 — #322, spec 05) `GET /admin/affiliate/affiliates` รับ `q` (ค้น `name`/`email`); ตัวเลือก affiliate ของฟอร์ม payout ใช้ `useComboboxData` + `q` (ไม่โหลดทุกหน้า) และแสดง error ใต้ช่องเมื่อ query ล้ม; e2e `affiliate-admin-forms`: ขั้นที่อ้างถึง collection นอกหน้าแรกตรวจว่า option ถูกเลือกจริง (หรือเปลี่ยนชื่อ step) และตรวจ response 200 — ข้อยกเว้นของ Out of scope เรื่อง backend ต้น spec (route ของเราเอง, เพิ่ม query param เดียว)

### Acceptance criteria (รอบ 26)
- AC-19 (ADM-15, กฎ 19) e2e 1280×800 (ต่อจาก `e2e/group-buy-admin-form.spec.ts`): Given modal สร้างแคมเปญ When `pressSequentially("e")` ในช่อง `Max total orders` แล้วส่ง Then error ใต้ช่องและไม่มี `POST`; When ล้างช่อง (ว่าง) แล้วส่ง Then `POST` 1 ครั้ง ช่องนี้เป็น `null`; When `dblclick` ปุ่ม "Create campaign" (wrapper `gb-campaigns-table`) Then มี dialog 1 ตัว (ไม่เปิดซ้อน, กฎ 18); When ปิด modal ด้วย Escape Then `document.activeElement` คือปุ่ม "Create campaign" (role + ชื่อใน wrapper); When เปิดใหม่ Then ช่องชื่อ `toHaveValue("")` และเป็น key ใหม่ (AC-17);
  static: `create-campaign.tsx` ไม่มี `type: "number"`/`<Input ` ของช่องตัวเลข และ import `NumberInput`; AC-10 ผ่าน
- AC-20 (ADM-16, กฎ 20) e2e 1280×800 (ต่อจาก `e2e/evoucher-admin-pool-page.spec.ts`): Given pool 60 code และ `page.route` หน่วง GET `/codes` 800ms When เปิด `?codes_offset=99999999` Then ตลอด 2 วินาทีแรก (MutationObserver นับ) ข้อความ "Import a CSV to add codes." ไม่ปรากฏ และจบที่ `codes_offset=50` 10 แถว; static: `codes-table.tsx`/`partners-section.tsx` มี `actionsColumn` ที่ deps ของ `useMemo` ไม่มี `prompt`/`getFullDate` และ `columns` ใช้ `actionsColumn` นั้น,
  `usePrompt` อยู่ในไฟล์เหล่านั้นเฉพาะใน component ต่อแถว; `use-page-offset.ts` มี `replace: true`, `codes-table.tsx` มี `resetOn: status`; AC-7, AC-8, AC-14 ผ่าน
- AC-21 (ADM-17, กฎ 21) integration http (`integration-tests/http/affiliate-admin*.spec.ts`): `GET /admin/affiliate/affiliates?q=<คำ>` คืนเฉพาะ affiliate ที่ `name`/`email` ตรง (case-insensitive); e2e: Given affiliate `active` 250 ราย When พิมพ์ชื่อรายที่ 250 ใน combobox affiliate Then มี request ที่มี `q=` และไม่มี `limit=200` วนหลายหน้า, เลือกได้ (AC-12 ยังผ่าน); Given GET รายชื่อล้ม (`page.route` → 500) Then error ใต้ช่องมีข้อความ (ไม่ใช่รายการว่างเงียบ); `affiliate-admin-forms` ขั้น :98 ตรวจ option selected (หรือชื่อ step ใหม่) และ :132 assert 200

### Test plan (รอบ 26)
| ชนิด | AC |
|---|---|
| unit (static) | ส่วน static ของ AC-19/20 |
| integration | AC-21 (route) |
| e2e admin | AC-19, AC-20, AC-21 |

### Tasks (รอบ 26)
| Task | งาน | ไฟล์ที่แตะ (`apps/backend/src/admin/` ยกเว้นระบุ) | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-15 | (รอบ 25 ข้อ D + #321) `create-campaign.tsx`: `NumberInput`, focus กลับปุ่มหลังปิด modal, e2e dblclick/`form.reset` (กฎ 19) | `components/group-buy/create-campaign.tsx`, `lib/group-buy-form.ts` (ถ้า schema ต้องรู้จัก sentinel), `__tests__/group-buy-pages.unit.spec.ts`, `apps/storefront/e2e/group-buy-admin-form.spec.ts` | ~80 LOC | 1280×800 | AC-19 | **ADM-13 (#321) merge** (แตะ `create-campaign.tsx`); ไม่บล็อก release | ชน ADM-14 ไม่มี (คนละไฟล์) |
| ADM-16 | (#316, #315) deps คอลัมน์ `codes-table`/`partners-section`, empty state ไม่กระพริบตอน offset เกิน, static AC-14 (กฎ 20) | `components/evoucher/{codes-table,partners-section}.tsx`, `components/common/use-page-offset.ts` (ถ้าเพิ่มค่าคืน), `__tests__/medusa-ui.unit.spec.ts`, `apps/storefront/e2e/evoucher-admin-pool-page.spec.ts` | ~120 LOC | 1280×800 | AC-20 | none — **เริ่มได้** (ADM-5 ☑, ADM-8b ☑, ADM-10 ☑); ไม่บล็อก release | ไม่ชน ADM-15; ถ้า ADM-14 แตะ `partners-section.tsx` ตัวที่ merge ทีหลัง rebase |
| ADM-17 | (#322) `q` ของ affiliate + `useComboboxData` + error ของรายการ + nit e2e (กฎ 21) | `apps/backend/src/modules/affiliate/models/*` (`.searchable()`), `api/admin/affiliate/validators.ts`, `components/affiliate/payout-form.tsx`, `apps/backend/integration-tests/http/affiliate-admin*.spec.ts`, `apps/storefront/e2e/affiliate-admin-forms.spec.ts` | ~120 LOC | 1280×800 | AC-21 | **ADM-9 (#322) merge** (แก้โค้ดของ PR นั้น); ไม่บล็อก release | ไม่ชน ADM-15/16 |
ลำดับ: ADM-16 เริ่มได้ทันที; ADM-15 หลัง #321; ADM-17 หลัง #322; ไม่มี task ใดบล็อก release

### ยอมรับใน v1 / ไม่เปิด task (รอบ 26)
- (qa #315, ADM-4/5) `ActionMenu` ต้อง Escape สองครั้งเมื่อกดทันทีหลังเปิด (รอ 300ms ได้ 10/10) เป็นจังหวะ animation ของ component Medusa — helper e2e `support/admin.ts:66–71` กดซ้ำจนเมนูหายอยู่แล้ว ไม่กระทบผู้ใช้จริง — ไม่เปิด task

## Follow-up ปิดรอบ 26 (2026-11-09)
ที่มา: qa #324, nit review/qa #327 — ตรวจโค้ดบน develop `0d1c678b` (path ย่อจาก `apps/backend/src/admin/`):
- qa #324 (hotfix ADM-10): เลือก filter แล้วกด Esc ทันทีระหว่าง loader หน่วง filter หาย — **ยังไม่ทดสอบบน develop** จึงเป็น follow-up ที่ต้องยืนยันก่อน ไม่ใช่บั๊กที่ยืนยันแล้ว; หน้าเดียวที่เข้าเงื่อนไข filter + loader คือ `routes/evouchers/pools/[id]/page.tsx` (`codes-table.tsx:37–41`, `:55`)
- `components/evoucher/partners-section.tsx:188` `PageOffsetGate` ซ่อนทั้ง `DataTable` และปุ่ม "Create partner" ขณะ `partners_offset` ผิดรูป จนกว่า `usePageOffset` จะแก้ URL เสร็จ — ยังไม่มี e2e เคส offset ผิดรูปตอนไม่มี partner (`?partners_offset=abc`, REPORT ADM-14 ทดสอบแค่ `=40`); REPORT ของ ADM-14 ทำที่ `a8bceff5` ก่อน sync develop และ gate × action ยืนยันด้วย e2e ของ CI เท่านั้น
Out of scope: แก้ `DataTable`/`ActionMenu` ของ dashboard, patch-package, ปรับ `usePageOffset` เกินที่ test ของ AC-22 บังคับ, งานของ ADM-15/16/17

### What Medusa already gives us (ปิดรอบ 26)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| filter + แบ่งหน้าใน URL | `DataTable` ของ dashboard + `useQueryParams` | ใช้ตามเดิม — ADM-18 แค่ยืนยันพฤติกรรม |
| ตารางว่าง | `NoRecords` + `action` ของ `DataTable` | ใช้ตามเดิม — ADM-19 เป็น test ล้วน |

### Business rules (ปิดรอบ 26)
22. (ADM-18 — qa #324) เลือกค่า filter ของ `evoucher-codes` แล้วกด Escape ทันทีขณะ loader ของหน้า pool หน่วงอยู่ → ค่า filter คงอยู่ใน URL และในผลลัพธ์ตาราง; ถ้าทำซ้ำไม่ได้บน develop ถือว่าปิดโดยมี test กันถอย; ถ้าทำซ้ำได้ แก้ได้เฉพาะในโค้ดของเรา (`usePageOffset`/`codes-table.tsx`) — ต้นเหตุอยู่ใน dashboard/react-router ให้หยุดรายงาน planner (ห้าม patch-package)
23. (ADM-19 — qa/review #327) `partners_offset` ผิดรูปตอนไม่มี partner: URL ถูกแก้แล้วตาราง ปุ่ม "Create partner" และ empty state กลับมาเองโดยไม่ต้อง reload หรือแก้ URL ด้วยมือ; ไม่แก้โค้ดถ้า test ผ่าน

### Acceptance criteria (ปิดรอบ 26)
- AC-22 (ADM-18, กฎ 22) e2e 1280×800 (เพิ่มใน `e2e/evoucher-admin-pool-page.spec.ts`): Given pool P ที่มี code และ `page.route` หน่วง GET `/admin/evoucher/pools/<P>` 1000ms When เปิดเมนู filter status ใน `evoucher-codes` เลือกค่าหนึ่ง แล้ว `keyboard.press("Escape")` ทันที (ไม่รอ) Then ภายในเวลา default ของ `expect` URL มี `codes_status=<ค่านั้น>` และ request `/codes` ล่าสุดมี `status=<ค่านั้น>`; ผ่าน `--repeat-each=10` (แนบผลใน evidence); AC-7, AC-14 ผ่าน
- AC-23 (ADM-19, กฎ 23) e2e 1280×800 (เพิ่มใน `e2e/evoucher-admin-forms.spec.ts`): Given `page.route` ตอบ GET `/admin/evoucher/partners*` เป็น `{ partners: [], count: 0, offset: 0, limit: 20 }` When เปิด `/app/evouchers?partners_offset=abc` Then URL ไม่มี `partners_offset`, ภายใน `evoucher-partners-table` มีปุ่ม role `button` ชื่อ "Create partner" 1 ตัว, `evoucher-partners-empty` visible และข้อความใน wrapper ไม่ตรง `/NaN/`; ทำซ้ำกับ `partners_offset=-50`; กดปุ่มแล้ว modal เปิด;
  `docs/evidence/admin-ui/ADM-19/REPORT.md` ระบุ commit ที่ sync กับ develop แล้ว (ปิดข้อสังเกต REPORT ADM-14 ทำก่อน sync) และรวมผล gate × action ของ Partners/Programs/Payouts

### Test plan (ปิดรอบ 26)
| ชนิด | AC |
|---|---|
| e2e admin (`locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, 1280×800) | AC-22, AC-23 |

### Tasks (ปิดรอบ 26)
| Task | งาน | ไฟล์ที่แตะ (`apps/backend/src/admin/` ยกเว้นระบุ) | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-18 | (qa #324 — **ต้องยืนยันก่อน ไม่ใช่บั๊กที่ยืนยันแล้ว**) test filter + Esc ระหว่าง loader หน่วง; แก้เฉพาะเมื่อทำซ้ำได้ (กฎ 22) | `apps/storefront/e2e/evoucher-admin-pool-page.spec.ts` (+ `components/common/use-page-offset.ts` หรือ `components/evoucher/codes-table.tsx` เฉพาะเมื่อ test ล้ม) | ~40 LOC (test); ถ้าต้องแก้ ≤ ~80 LOC | 1280×800 | AC-22 | none — **เริ่มได้**; ไม่บล็อก release | ชน ADM-16 ที่ไฟล์ e2e และ `use-page-offset.ts` → ตัวที่ merge ทีหลัง rebase |
| ADM-19 | (qa/review #327) e2e offset ผิดรูปตอนไม่มี partner + REPORT หลัง sync (กฎ 23) | `apps/storefront/e2e/evoucher-admin-forms.spec.ts`, `docs/evidence/admin-ui/ADM-19/REPORT.md` | ~30 LOC | 1280×800 | AC-23 | none — **เริ่มได้** (ADM-14 ☑ #327); ไม่บล็อก release | ไม่ชน ADM-15/16/17/18 |
(ปิดรอบ 26 สถานะ, 2026-11-09) ADM-8b ☑ #316 · ADM-9 ☑ #322 · ADM-10 ☑ #315 (+ hotfix #324) · ADM-11 ☑ #311 · ADM-12 ☑ #313 · ADM-13 ☑ #321 · ADM-14 ☑ #327; ADM-15, ADM-16, ADM-17, ADM-18, ADM-19 ☐ เริ่มได้ (ไม่บล็อก release)

### Open questions (ปิดรอบ 26)
none

## Follow-up รอบ 27 จากการทดสอบจริงบน develop `84b9e610` (2026-11-10 — owner สั่งแก้เฉพาะ ADM-M-10)
ที่มา: `/app/group-buying` ตอน API ล้มแสดง "No group-buy campaigns yet" เพราะ `routes/group-buying/page.tsx:75` ใช้แค่ `data`/`isLoading` และส่ง `data?.campaigns ?? []` เข้าตาราง (path ย่อจาก `apps/backend/src/admin/`)
Out of scope: แก้ตารางอื่น (→ ADM-21), error ของ loader หน้า pool (→ ADM-22), backend

### What Medusa already gives us (รอบ 27)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ข้อความ error ในหน้าที่ layout ยังอยู่ | `NoRecords` ของ `@medusajs/dashboard/components` (`title`, `message`, `action` แบบลิงก์เท่านั้น) | ใช้ตามเดิม แบบเดียวกับ `routes/group-buying/[id]/page.tsx:86–96` |
| error ระดับ route และ 401 | `ErrorBoundary` ของ dashboard (`errorElement` ของ route หลัก) พา 401 ไป `/login`; หน้าอื่นแสดงข้อความทั้งหน้าและ stack trace เมื่อ `NODE_ENV=development` | ใช้เฉพาะ 401 ด้วย `throw error` |
| ตาราง + empty state | `DataTable` ของ dashboard รับ `isLoading`/`emptyState` ไม่มี prop error | คง `DataTable` เมื่อโหลดสำเร็จ |
| retry ของ query | `QueryClient` ของ dashboard `retry: 1` | ใช้ตามเดิม |

### Business rules (รอบ 27)
24. (ADM-20) หน้า list `/app/group-buying` เมื่อ `listCampaigns` ล้มและไม่มีข้อมูลในมือ (`isError && !data`): (a) แทน `PageOffsetGate` + `DataTable` ด้วย `NoRecords` (`title="Could not load campaigns"`, `message` = `error.message`) ใน wrapper `data-testid="gb-campaigns-error"` ภายใน `gb-campaigns-table`; (b) HTTP 401 → `throw error` ให้ `ErrorBoundary` พาไป `/login`; (c) empty state เดิมแสดงเฉพาะเมื่อ API สำเร็จและไม่มีแคมเปญ; (d) refetch เบื้องหลังล้มขณะมี `data` คงตารางไว้; (e) `gb-template-warning` คงแสดง ไม่เพิ่มปุ่มลองใหม่ (`NoRecords` รับแค่ลิงก์)

### Acceptance criteria (รอบ 27)
- AC-24 (ADM-20, กฎ 24) e2e 1280×800 (เพิ่มใน `e2e/group-buy-admin-pages.spec.ts`, `page.route` ของ GET `**/admin/group-buy/campaigns*`): Given ตอบ 500 When เปิด `/app/group-buying` Then `gb-campaigns-error` visible (timeout default), `gb-campaigns-table` ไม่มีข้อความ "No group-buy campaigns yet", `gb-template-warning` visible — **ล้มบน develop**; ทำซ้ำด้วย `route.abort()`; Given ตอบ 401 Then URL เป็น `/app/login`; Given ตอบ `{ campaigns: [], count: 0, offset: 0, limit: 20 }` Then ข้อความ empty state เดิมแสดงและ `gb-campaigns-error` count 0; Given API ปกติ AC-9/AC-17 ผ่าน; static (`group-buy-pages.unit.spec.ts`): `page.tsx` ใช้ `NoRecords` และ `isError && !data`

### Test plan (รอบ 27)
| ชนิด | AC |
|---|---|
| static jest + e2e admin (`locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, 1280×800) | AC-24 — เขียน e2e ให้ล้มบน develop ก่อน |

### Tasks (รอบ 27)
| Task | งาน | ไฟล์ที่แตะ (`apps/backend/src/admin/` ยกเว้นระบุ) | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-20 | (qa ADM-M-10) สถานะ error แทน empty ของหน้า list group buy (กฎ 24) | `routes/group-buying/page.tsx`, `__tests__/group-buy-pages.unit.spec.ts`, `apps/storefront/e2e/group-buy-admin-pages.spec.ts` | ~60 LOC | 1280×800 | AC-24 | PR spec รอบ 27 merge; ไม่บล็อก release v0.1.0 | ไม่ชน CORE-55/EV-16/AF-21; ชน ADM-15/16 ไม่มี (คนละไฟล์) |
| ADM-21 | (follow-up จากการสำรวจ ADM-20 — ยังไม่สั่งทำ) ตารางอื่นที่ใช้แค่ `data`/`isLoading` จนอาจแสดง empty ตอน API ล้ม: `components/evoucher/pools-table.tsx:45`, `codes-table.tsx:58`, `partners-section.tsx:82`, `components/affiliate/list-table.tsx:22` (Programs/Affiliates/Payouts), `components/group-buy/groups-section.tsx:30`, `group-members.tsx:84` | ตามแถว | — | — | ไม่มี (ต้องเขียน AC ก่อนเริ่ม) | ADM-20; ไม่บล็อก release | — |
| ADM-22 | (follow-up — ยังไม่สั่งทำ) loader ของหน้า pool (`routes/evouchers/pools/[id]/page.tsx:96`) ล้มแล้ว `ErrorBoundary` แสดง stack trace — source แสดงเฉพาะ `NODE_ENV=development` ต้องยืนยันบน build production ก่อนว่าไม่ใช่ปัญหาจริง | ตามแถว | — | — | ไม่มี (ต้องเขียน AC ก่อนเริ่ม) | none; ไม่บล็อก release | — |

### Open questions (รอบ 27)
none

## Open questions
- ~~Q8~~ ตัดสินแล้ว (owner 2026-11-09): **(ก)** เพิ่มข้อ "ลดเกณฑ์ AC-15 กลับเป็น ≤ 2 ถ้า upstream แก้" ใน checklist bump `@medusajs/*` ของ spec 07 (ข้อ 9) — ไม่เปิด task
- ~~Q1~~ ตัดสินแล้ว (owner 2026-10-28): **A** ทำครบ ADM-1..9 ทีละ module
- ~~Q2~~ ตัดสินแล้ว (owner 2026-10-28): อนุญาต bump `@medusajs/ui` 4.2.6 → 4.2.8 ให้ตรงกับ `@medusajs/dashboard` 2.22.1 (บันทึกใน ADR-018; ADM-1)
- ~~เงิน~~ ตัดสินแล้ว (owner 2026-10-28): ใช้ `getLocaleAmount` รูปแบบตาม locale ของ browser เหมือนหน้า admin หลักของ Medusa; e2e/unit กำหนด locale ตายตัว (กฎ 6, 12)
- ~~Q3~~ ตัดสินแล้ว (owner 2026-10-28): **ใช้ `ActionMenu`** สำหรับปุ่มต่อแถว — testid ที่ trigger, e2e หา menuitem ด้วย role + ชื่อ, กันกดซ้ำยังต้องมี (กฎ 10, AC-7/8/13)
- ~~Q4~~ ตัดสินแล้ว (owner 2026-10-28): **ตาม Medusa ทั้งหมด** — `DatePicker` + `z.date()` และ `useDate` ตาม timezone เครื่อง, เลิก `lib/ict.ts` ใน admin, เครื่องแอดมินต้องตั้งเวลาไทย
  (กฎ 5; แก้ spec 00, 03 กฎ 5, 05 กฎ 37c/AC-44 ให้สอดคล้อง)
- ~~Q5~~ ตัดสินแล้ว (owner 2026-10-28): คง `FocusModal`/`Drawer` แบบ state ไม่ใช้ `RouteFocusModal`/`RouteDrawer`
- ~~Q6~~ ตัดสินแล้ว (owner 2026-10-28): ยอมรับ pagination ใน URL (`?<prefix>_offset=`)
- ~~Q7~~ ตัดสินแล้ว (owner 2026-11-05): **(ก)** — ย้ายปุ่มสร้างของหน้า list เข้า `action` ของ `DataTable` ได้ และหาปุ่มด้วย
  `getByTestId("<wrapper>").getByRole("button", { name })` เป็นข้อยกเว้นที่สองของการหาด้วย testid (กฎ 7c, 18; ADR-018 หมายเหตุ 2026-11-05 (2); CLAUDE.md แก้ใน PR เดียวกับ spec นี้);
  ADM-13 ปลดล็อก, ปุ่มสร้างของ Partners/Programs/Payouts → ADM-14 — ข้อความคำถามเดิมด้านล่าง:
- Q7 (รอบ 23, ADM-13 — ขัด ADR-018 หลักการ 8 / กฎ 7 จึงต้องให้ owner ตัดสิน) ปุ่มใน `action` ของ `DataTable` ของ dashboard ไม่รับ `data-testid`
  (`DataTableAction` ส่งต่อแค่ `label`/`disabled`/`tooltip`/`onClick`/`to` — `chunk-6CQCXI3F.mjs:799–816`) การย้ายปุ่ม "Create campaign" เข้า `action` เพื่อตัดแถว toolbar ว่างจึงทำให้ `gb-campaign-create` หายไป
  - (ก) **ข้อเสนอ**: เพิ่มข้อยกเว้นที่สองของการหาด้วย testid — ปุ่มใน `action`/`actions` ของ `DataTable` หาด้วย `getByTestId("<wrapper ของตาราง>").getByRole("button", { name: "<Label อังกฤษ>" })`
    (แบบเดียวกับ menuitem ของ `ActionMenu`) → planner แก้ ADR-018 หลักการ 7–8 และกฎ 7/10 ของ spec นี้; owner แก้ประโยคข้อยกเว้นใน CLAUDE.md (รอบนี้ owner อนุญาตให้แก้ผ่าน PR);
    ใช้กับปุ่มสร้างของหน้า list อื่นที่จะย้ายเข้า `action` ด้วย (ADM-5 partners, ADM-8a/8b programs — ADR-018 แถว 14)
  - (ข) คง Header + `gb-campaign-create` และยอมรับแถวว่าง 32px (ผลต่อผู้ใช้ต่ำตาม qa #293) → ปิด ADM-13 (✕)
