# 08 Admin UI ใช้ component, hook และ utility ของ Medusa (ADM)
Status: in-progress (ปิดรอบ 39 2026-11-19: ☑ ADM-38 #421 (red 3 ขั้น → green; qa defect ไม่พบ) — หัวข้อ "Follow-up รอบ 39" done; ไม่มี task เปิดค้างใน spec นี้; รอบ 39 2026-11-19: owner ตอบข้อ ก ของ ROADMAP "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 38)" = ก "แก้แบบ ADM-37" 2026-11-19 → ADM-38 (กฎ 42, AC-43 — ตาราง Ledger คอลัมน์ Affiliate `size`/`maxSize` 274 + คอลัมน์สุดท้าย Status เป็น auto + nit review #418) ☐ owner สั่งทำ — หัวข้อ "Follow-up รอบ 39"; ปิดรอบ 38 2026-11-19: ☑ ADM-37 #418 — owner ตอบ Q12 = ก 2026-11-19 (คอลัมน์สุดท้ายเป็น auto แทน actions — กฎ 41c) — หัวข้อ "Follow-up รอบ 38" done; ไม่มี task เปิดค้างใน spec นี้; ปิดรอบ 37 2026-11-19: ☑ ADM-34 #413, ADM-35 #416; ADM-36 ☑ ผลวัด (ไม่มี PR โค้ด — `docs/evidence/admin-ui/ADM-36-tests.txt`) = ทาง (A) พฤติกรรมของ `@medusajs/ui`/Radix → owner ตอบ Q11 = ก 2026-11-19 ปิดข้อนี้ — หัวข้อ "Follow-up รอบ 37" done; owner สั่งทำ 2026-11-19: ADM-37 (กฎ 41, AC-42 — คอลัมน์ Affiliate ของ payouts จำกัด 250px + คอลัมน์ auto รับความกว้างส่วนเกิน ใน programs/affiliates/payouts) ☐ — หัวข้อ "Follow-up รอบ 38" (คำถาม Q12 ไม่บล็อก); รอบ 37 2026-11-18: owner ตัดสินข้อ ก (3) และ (5) ของ ROADMAP ปิดรอบ 36 = ทำ → ADM-34 (กฎ 38, AC-39 — ปิด `FocusModal` ที่เปิดจากปุ่มแล้ว focus กลับปุ่ม) → ADM-35 (กฎ 39, AC-40 — ข้อความยาวใน `DataTable` ไม่ดันปุ่ม `…` ออกนอกจอ + nit #409) → ADM-36 (กฎ 40, AC-41 — Escape ในเฟรมแรกที่เมนูโผล่; มีด่านวัดก่อนแก้ ถ้าเป็นพฤติกรรม upstream → หยุดแล้วถาม owner Q11) ☐ owner สั่งทำแล้ว — หัวข้อ "Follow-up รอบ 37"; ปิดรอบ 36 2026-11-18: ☑ ADM-30 #402, ADM-31 #404, ADM-32 #408, ADM-33 #409 — หัวข้อ "Follow-up รอบ 36" และ "Follow-up รอบ 36 ส่วนที่ 2" done; ไม่มี task เปิดค้างใน spec นี้; รอบ 36 ส่วนที่ 2 2026-11-18: owner ตอบข้อ UX กลุ่ม ค ของ ROADMAP ปิดรอบ 30/31 = ข "ตรวจซ้ำบน develop แล้วเปิด task เฉพาะข้อที่ยังจริง" → ADM-32 (กฎ 36, AC-37 — error ของช่องจำนวนในฟอร์ม Create campaign อยู่ใต้ช่อง) ∥ ADM-33 (กฎ 37, AC-38 — เมนูต่อแถวใน `DataTable` ปิดด้วย Escape ครั้งเดียว) owner สั่งทำแล้ว (ทั้งคู่ ← ADM-31) — หัวข้อ "Follow-up รอบ 36 ส่วนที่ 2"; รอบ 36 2026-11-18: follow-up ปิดรอบ 34/35 → ADM-30 (กฎ 34, AC-35 — static ของ e2e ที่ผ่านได้แม้ไม่มีสิ่งที่ตรวจ) ∥ ADM-31 (กฎ 35, AC-36 — `FocusModal.Title` ของ `@medusajs/ui` ในฟอร์ม `FocusModal` ทั้ง 5 จุด) owner สั่งทำ 2026-11-18 — หัวข้อ "Follow-up รอบ 36"; รอบ 35 2026-11-18: ☑ ADM-22 ผลตรวจ (qa, ไม่มี PR — `docs/evidence/admin-ui/ADM-22/REPORT.md`) = เข้ากฎ 26b แต่สาเหตุระดับ build (`medusa build` ไม่ตั้ง `NODE_ENV` = admin แบบ development ทุกหน้า) → owner เลือกแก้ที่การ build → OPS-27 (spec 07 AC-42), ADM-22b ไม่เปิด (✕) — หมายเหตุใต้กฎ 26 และแถว ADM-22 ของหัวข้อ "Follow-up รอบ 28"; ปิดรอบ 34 2026-11-18: ☑ ADM-29 #396 — หัวข้อ "Follow-up รอบ 34" done; ADM-22 ยังพักไว้; รอบ 34 2026-11-18: owner สั่งเปิด ADM-29 (กฎ 33, AC-34 — tag ตัวอักษร + assert จำนวนผลใน test payout ตามกฎ 32f) — หัวข้อ "Follow-up รอบ 34"; กฎ 32f แก้ถ้อยคำ; ปิดรอบ 33 2026-11-18: ☑ ADM-28 #393 — สาเหตุจริง: tag ตัวเลขของ test ชนคำค้น `q` ที่ Medusa แยกคำแล้ว AND (กฎ 32f บทเรียน); ADM-22 ยังพักไว้; รอบ 33 2026-11-17: owner สั่งเปิด ADM-28 (กฎ 32, AC-33 — หาสาเหตุ flaky AC-12 จาก trace) ☐ พร้อมเริ่ม — หัวข้อ "Follow-up รอบ 33"; ปิดรอบ 32 2026-11-17: ☑ ADM-27 #389 (sync สถานะเท่านั้น); ADM-22 ยังพักไว้; รอบ 32 2026-11-17: Q9 = ก → ADM-27 (กฎ 31, AC-32 — prompt ก่อนปิดฟอร์มที่ dirty), Q10 = ก (คงเดิม ไม่มี task) owner 2026-11-17 — หัวข้อ "Follow-up รอบ 32"; owner 2026-10-28 — ADR-018 accepted, Q1–Q6 ตัดสินแล้ว; รอบ 13 2026-11-03: เพิ่มขอบเขต ADM-5 (ตรวจ URL ของ partner — follow-up EV-14 #195) และ ADM-8a (nit AF-14 #187) ใน AC-8/AC-11;
รอบ 23 2026-11-05: ADM-1/2a/2b/3/4/6 ☑ (ADM-3 #294, ADM-4 #296, ADM-6 #293 ผ่าน train #299), ADM-5/7/8a กำลังทำ; follow-up ของ qa/review #293/#294/#296 → ADM-10..13, กฎ 13–17, AC-14..17,
ร่าง issue upstream ของ `DataTable` (หัวข้อ "Follow-up รอบ 23"), คำถาม Q7;
2026-11-05 owner ตอบ Q7 = (ก): ปุ่มใน `action` ของ `DataTable` เป็นข้อยกเว้นที่สองของการหาด้วย testid — กฎ 7c, 18, ADM-13 ปลดล็อก, task ใหม่ ADM-14, AC-18;
รอบ 26 2026-11-09: แก้ถ้อยคำกฎ 7(b), 14, AC-18; ADM-15..17, กฎ 19–21, AC-19..21; Q8 ตัดสินแล้ว;
รอบ 27 2026-11-10: ADM-20, กฎ 24, AC-24; follow-up ADM-21, ADM-22; ปิดรอบ 27 2026-11-10: ADM-20 ☑ #335;
รอบ 28 2026-11-10: owner ตัดสิน ADM-21 = ทำ (แยก ADM-21a/21b, กฎ 25, AC-25..26) และ ADM-22 = ยืนยันก่อน (กฎ 26, AC-27) — ทั้งหมดพักไว้ owner ยังไม่สั่งทำ ไม่บล็อก release v0.1.0;
ปิดรอบ 29 2026-11-13: owner สั่งทำ → ☑ ADM-16 #359, ADM-17 #360 (dependency ของ 21a/21b), ADM-21a #361, ADM-21b #362; ADM-22 ยังพักไว้ — sync สถานะเท่านั้น;
รอบ 30 2026-11-13: follow-up ของ #359–#362 → ADM-23..26, กฎ 27–30, AC-28..31 (หัวข้อ "Follow-up รอบ 30"); Out of scope เรื่อง backend ข้างล่างมีข้อยกเว้นใน ADM-24 แบบ ADM-17 (route ของเราเอง);
ปิดรอบ 30/31 2026-11-14: owner สั่งทำ 2026-11-13 → ☑ ADM-15 #374, ADM-18 #377 (owner = ก ยอมรับข้อจำกัด — test-only), ADM-19 #380, ADM-23 #373, ADM-24 #375, ADM-25 #381, ADM-26 #379 (owner = ก); ADM-22 ยังพักไว้;
แก้ข้อเท็จจริงตาม review/qa: กฎ 22 (หน้าต่างข้อจำกัด), กฎ 30b (เวอร์ชัน Radix), AC-31(b) (scope เป็น multi-select) — ไม่เปลี่ยนพฤติกรรมที่ต้องได้)
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
| ADM-15 | (รอบ 25 ข้อ D + #321) `create-campaign.tsx`: `NumberInput`, focus กลับปุ่มหลังปิด modal, e2e dblclick/`form.reset` (กฎ 19) — ☑ #374 | `components/group-buy/create-campaign.tsx`, `lib/group-buy-form.ts` (ถ้า schema ต้องรู้จัก sentinel), `__tests__/group-buy-pages.unit.spec.ts`, `apps/storefront/e2e/group-buy-admin-form.spec.ts` | ~80 LOC | 1280×800 | AC-19 | **ADM-13 (#321) merge** (แตะ `create-campaign.tsx`); ไม่บล็อก release | ชน ADM-14 ไม่มี (คนละไฟล์) |
| ADM-16 | (#316, #315) deps คอลัมน์ `codes-table`/`partners-section`, empty state ไม่กระพริบตอน offset เกิน, static AC-14 (กฎ 20) — ☑ #359 | `components/evoucher/{codes-table,partners-section}.tsx`, `components/common/use-page-offset.ts` (ถ้าเพิ่มค่าคืน), `__tests__/medusa-ui.unit.spec.ts`, `apps/storefront/e2e/evoucher-admin-pool-page.spec.ts` | ~120 LOC | 1280×800 | AC-20 | none — **เริ่มได้** (ADM-5 ☑, ADM-8b ☑, ADM-10 ☑); ไม่บล็อก release | ไม่ชน ADM-15; ถ้า ADM-14 แตะ `partners-section.tsx` ตัวที่ merge ทีหลัง rebase |
| ADM-17 | (#322) `q` ของ affiliate + `useComboboxData` + error ของรายการ + nit e2e (กฎ 21) — ☑ #360 | `apps/backend/src/modules/affiliate/models/*` (`.searchable()`), `api/admin/affiliate/validators.ts`, `components/affiliate/payout-form.tsx`, `apps/backend/integration-tests/http/affiliate-admin*.spec.ts`, `apps/storefront/e2e/affiliate-admin-forms.spec.ts` | ~120 LOC | 1280×800 | AC-21 | **ADM-9 (#322) merge** (แก้โค้ดของ PR นั้น); ไม่บล็อก release | ไม่ชน ADM-15/16 |
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
| filter + แบ่งหน้าใน URL | `DataTable` ของ dashboard + `useQueryParams` | ใช้ตามเดิม — ADM-18 แค่ยืนยันพฤติกรรม (Esc ก่อน URL commit ทำ filter หาย = ข้อจำกัดของ `@medusajs/ui` ที่ยอมรับใน v1, กฎ 22) |
| ตารางว่าง | `NoRecords` + `action` ของ `DataTable` | ใช้ตามเดิม — ADM-19 เป็น test ล้วน |

### Business rules (ปิดรอบ 26)
22. (ADM-18 — qa #324) เลือกค่า filter ของ `evoucher-codes` แล้วกด Escape ทันทีขณะ loader ของหน้า pool หน่วงอยู่ → ค่า filter คงอยู่ใน URL และในผลลัพธ์ตาราง; ถ้าทำซ้ำไม่ได้บน develop ถือว่าปิดโดยมี test กันถอย; ถ้าทำซ้ำได้ แก้ได้เฉพาะในโค้ดของเรา (`usePageOffset`/`codes-table.tsx`) — ต้นเหตุอยู่ใน dashboard/react-router ให้หยุดรายงาน planner (ห้าม patch-package)
    **ผลยืนยัน + คำตัดสิน owner (2026-11-14) = ก ยอมรับใน v1, ไม่เปิด issue upstream ตอนนี้**: builder ทำซ้ำได้บน prod build — กด Esc ก่อน react-router commit `codes_status` ลง URL → filter หาย (18/20; ถอด loader ยังล้ม 14/20; รอ ~1.5 วินาทีแล้วกด Esc ผ่าน 10/10)
    ต้นเหตุไม่ใช่โค้ดของเรา: `DataTableFilter.onOpenChange` ของ `@medusajs/ui` 4.2.8 (`dist/esm/blocks/data-table/components/data-table-filter.js:51–71`) เรียก `removeFilter` เมื่อ popover ปิดขณะ `hasValue` เป็นเท็จ ซึ่ง `DataTable` ของ dashboard อ่านค่าจาก URL; `loader` ของหน้า pool (ADM-11 กฎ 14) ทำให้ช่วงเสี่ยงยาวขึ้น;
    admin-vite-plugin 2.22.1 ส่งต่อแค่ `loader`/`handle` (ใช้ `shouldRevalidate` ไม่ได้), patch-package ห้าม และทำ filter เองขัด CLAUDE.md ข้อ 1
    → **ข้อจำกัดที่ยอมรับ**: กด Esc ก่อน URL commit ค่า filter ทำให้ filter หาย ผู้ใช้เลือกใหม่ได้ (ไม่มีผลต่อข้อมูล — แนวเดียวกับ Escape ของ `ActionMenu` ใน "ยอมรับใน v1 / ไม่เปิด task (รอบ 26)"); ADM-18 จึงเป็น test-only (ไม่แก้โค้ด admin) — AC-22 ทดสอบเส้นทางที่ URL commit แล้ว
    (**หมายเหตุ ปิดรอบ 30/31** ตาม qa #377 O-1/O-2: หน้าต่างของข้อจำกัดนับถึง re-render หลัง URL commit (~50ms หลัง URL มีค่า) ไม่ใช่แค่ถึงจังหวะที่ URL มีค่า — ช่วงที่ filter หายจริงวัดได้ราว ~150ms หลังคลิกเลือกค่า; AC-22 ที่ `expect.poll` URL แล้วกด Esc ทันทียังผ่าน `--repeat-each=10` ใน #377 ไม่ต้องแก้ test)
23. (ADM-19 — qa/review #327) `partners_offset` ผิดรูปตอนไม่มี partner: URL ถูกแก้แล้วตาราง ปุ่ม "Create partner" และ empty state กลับมาเองโดยไม่ต้อง reload หรือแก้ URL ด้วยมือ; ไม่แก้โค้ดถ้า test ผ่าน

### Acceptance criteria (ปิดรอบ 26)
- AC-22 (ADM-18, กฎ 22) e2e 1280×800 (เพิ่มใน `e2e/evoucher-admin-pool-page.spec.ts`): Given pool P ที่มี code และ `page.route` หน่วง GET `/admin/evoucher/pools/<P>` 1000ms When เปิดเมนู filter status ใน `evoucher-codes` เลือกค่าหนึ่ง (เช่น `void`) แล้ว**รอจน URL มีค่า filter** (`expect.poll` ว่า `new URL(page.url()).searchParams.get("codes_status")` เท่ากับ `JSON.stringify(<ค่านั้น>)` — dashboard เขียนค่าเป็น JSON ใน URL เช่น `codes_status=%22void%22`) จึง `keyboard.press("Escape")`
  Then popover ปิด, `codes_status` ใน URL ยังเป็นค่าเดิม (ตรวจซ้ำหลัง Escape ด้วยเงื่อนไขเดียวกัน) และ request GET `/admin/evoucher/pools/<P>/codes` ล่าสุดมี query `status=<ค่านั้น>`; ผ่าน `--repeat-each=10` (แนบผลใน evidence); AC-7, AC-14 ผ่าน;
  ไม่ทดสอบการกด Esc ก่อน URL commit — เป็นข้อจำกัดที่ยอมรับใน v1 (กฎ 22, owner 2026-11-14)
- AC-23 (ADM-19, กฎ 23) e2e 1280×800 (เพิ่มใน `e2e/evoucher-admin-forms.spec.ts`): Given `page.route` ตอบ GET `/admin/evoucher/partners*` เป็น `{ partners: [], count: 0, offset: 0, limit: 20 }` When เปิด `/app/evouchers?partners_offset=abc` Then URL ไม่มี `partners_offset`, ภายใน `evoucher-partners-table` มีปุ่ม role `button` ชื่อ "Create partner" 1 ตัว, `evoucher-partners-empty` visible และข้อความใน wrapper ไม่ตรง `/NaN/`; ทำซ้ำกับ `partners_offset=-50`; กดปุ่มแล้ว modal เปิด;
  `docs/evidence/admin-ui/ADM-19/REPORT.md` ระบุ commit ที่ sync กับ develop แล้ว (ปิดข้อสังเกต REPORT ADM-14 ทำก่อน sync) และรวมผล gate × action ของ Partners/Programs/Payouts

### Test plan (ปิดรอบ 26)
| ชนิด | AC |
|---|---|
| e2e admin (`locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, 1280×800) | AC-22, AC-23 |

### Tasks (ปิดรอบ 26)
| Task | งาน | ไฟล์ที่แตะ (`apps/backend/src/admin/` ยกเว้นระบุ) | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-18 | (qa #324 — ยืนยันแล้ว 2026-11-14: ต้นเหตุใน `@medusajs/ui`, owner = ก ยอมรับใน v1) **test-only** — e2e filter + Esc หลัง URL commit ระหว่าง loader หน่วง; ไม่แก้โค้ด admin (กฎ 22) — ☑ #377 | `apps/storefront/e2e/evoucher-admin-pool-page.spec.ts` | ~40 LOC (test) | 1280×800 | AC-22 | none; ไม่บล็อก release | ชน ADM-16 ที่ไฟล์ e2e และ `use-page-offset.ts` → ตัวที่ merge ทีหลัง rebase |
| ADM-19 | (qa/review #327) e2e offset ผิดรูปตอนไม่มี partner + REPORT หลัง sync (กฎ 23) — ☑ #380 | `apps/storefront/e2e/evoucher-admin-forms.spec.ts`, `docs/evidence/admin-ui/ADM-19/REPORT.md` | ~30 LOC | 1280×800 | AC-23 | none (ADM-14 ☑ #327); ไม่บล็อก release | ไม่ชน ADM-15/16/17/18 |
(ปิดรอบ 26 สถานะ, 2026-11-09) ADM-8b ☑ #316 · ADM-9 ☑ #322 · ADM-10 ☑ #315 (+ hotfix #324) · ADM-11 ☑ #311 · ADM-12 ☑ #313 · ADM-13 ☑ #321 · ADM-14 ☑ #327; ADM-15, ADM-16, ADM-17, ADM-18, ADM-19 ☐ เริ่มได้ (ไม่บล็อก release)
(ปิดรอบ 30/31 สถานะ, 2026-11-14) ADM-15 ☑ #374 · ADM-16 ☑ #359 · ADM-17 ☑ #360 · ADM-18 ☑ #377 · ADM-19 ☑ #380

### Open questions (ปิดรอบ 26)
none

## Follow-up รอบ 27 จากการทดสอบจริงบน develop `84b9e610` (2026-11-10 — owner สั่งแก้เฉพาะ ADM-M-10)
ที่มา: `/app/group-buying` ตอน API ล้มแสดง "No group-buy campaigns yet" เพราะ `routes/group-buying/page.tsx:75` ใช้แค่ `data`/`isLoading` และส่ง `data?.campaigns ?? []` เข้าตาราง (path ย่อจาก `apps/backend/src/admin/`)
Out of scope: แก้ตารางอื่น (→ ADM-21), error ของ loader หน้า pool (→ ADM-22), backend

### What Medusa already gives us (รอบ 27)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ข้อความ error โดยคงหัวตารางและปุ่มสร้าง | `DataTable` ของ dashboard ไม่มี prop error แต่ `emptyState.empty` (`heading`, `description`) แสดงเมื่อไม่มีแถว และ `heading`/`action` ยังแสดงอยู่ | **ใช้ `emptyState` แสดง error** — ไม่ใช้ `NoRecords` แทนตาราง เพราะจะทำให้ปุ่ม "Create campaign" ใน `action` (ADR-018, ADM-13) หายไปด้วย |
| error ระดับ route และ 401 | `ErrorBoundary` ของ dashboard (`errorElement` ของ route หลัก) พา 401 ไป `/login`; หน้าอื่นแสดงข้อความทั้งหน้าและ stack trace เมื่อ `NODE_ENV=development` | ใช้เฉพาะ 401 ด้วย `throw error` |
| retry ของ query | `QueryClient` ของ dashboard `retry: 1` | ใช้ตามเดิม |

### Business rules (รอบ 27)
24. (ADM-20) หน้า list `/app/group-buying` เมื่อ `listCampaigns` ล้มและไม่มีข้อมูลในมือ (`isError && !data`): (a) คง `PageOffsetGate` + `DataTable` (หัวตารางและปุ่ม "Create campaign" ใน `action` ยังกดได้และเปิด modal ได้) แต่ส่ง `emptyState.empty` = `{ heading: "Could not load campaigns", description: error.message }` แทนข้อความ empty เดิม และห่อด้วย element `data-testid="gb-campaigns-error"` เฉพาะตอนสถานะนี้ (ภายใน `gb-campaigns-table`); (b) HTTP 401 → `throw error` ให้ `ErrorBoundary` พาไป `/login`; (c) empty state เดิมแสดงเฉพาะเมื่อ API สำเร็จและไม่มีแคมเปญ; (d) refetch เบื้องหลังล้มขณะมี `data` คงตารางไว้; (e) `gb-template-warning` คงแสดง ไม่เพิ่มปุ่มลองใหม่ (reload หน้า)

### Acceptance criteria (รอบ 27)
- AC-24 (ADM-20, กฎ 24) e2e 1280×800 (เพิ่มใน `e2e/group-buy-admin-pages.spec.ts`, `page.route` ของ GET `**/admin/group-buy/campaigns*`): Given ตอบ 500 When เปิด `/app/group-buying` Then `gb-campaigns-error` visible (timeout default), `gb-campaigns-table` ไม่มีข้อความ "No group-buy campaigns yet", `gb-template-warning` visible, และ `getByTestId("gb-campaigns-table").getByRole("button", { name: "Create campaign" })` (ข้อยกเว้นตามกฎ 18) enabled กดแล้ว modal สร้างแคมเปญเปิด — **ล้มบน develop**; ทำซ้ำด้วย `route.abort()`; Given ตอบ 401 Then `page.waitForURL(/\/app\/login/)` แล้ว**จบ test ทันที** (ไม่ตรวจอะไรต่อในหน้า login); Given ตอบ `{ campaigns: [], count: 0, offset: 0, limit: 20 }` Then ข้อความ empty state เดิมแสดงและ `gb-campaigns-error` count 0; Given API ปกติ AC-9/AC-17 ผ่าน; static (`group-buy-pages.unit.spec.ts`): `page.tsx` มี `isError && !data` และ `"Could not load campaigns"` อยู่ใน `emptyState` ของ `DataTable` (ไม่แทนตารางด้วย `NoRecords`)

### Test plan (รอบ 27)
| ชนิด | AC |
|---|---|
| static jest + e2e admin (`locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, 1280×800) | AC-24 — เขียน e2e ให้ล้มบน develop ก่อน |

### Tasks (รอบ 27)
| Task | งาน | ไฟล์ที่แตะ (`apps/backend/src/admin/` ยกเว้นระบุ) | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-20 | (qa ADM-M-10) สถานะ error แทน empty ของหน้า list group buy (กฎ 24) | `routes/group-buying/page.tsx`, `__tests__/group-buy-pages.unit.spec.ts`, `apps/storefront/e2e/group-buy-admin-pages.spec.ts` — ☑ #335 | ~60 LOC | 1280×800 | AC-24 | PR spec รอบ 27 merge; ไม่บล็อก release v0.1.0 | ไม่ชน CORE-55/EV-16/AF-21; **ชน ADM-15** ที่ `__tests__/group-buy-pages.unit.spec.ts` (ADM-15 เพิ่ม test ของกฎ 19c ไฟล์เดียวกัน, คนละ test) → ตัวที่ merge ทีหลัง rebase; ไม่ชน ADM-16 |
| ADM-21 | (follow-up จากการสำรวจ ADM-20 — ยังไม่สั่งทำ) ตารางอื่นที่ใช้แค่ `data`/`isLoading` จนอาจแสดง empty ตอน API ล้ม: `components/evoucher/pools-table.tsx:45`, `codes-table.tsx:58`, `partners-section.tsx:82`, `components/affiliate/list-table.tsx:22` (Programs/Affiliates/Payouts), `components/group-buy/groups-section.tsx:30`, `group-members.tsx:84` — **รอบ 28: owner ตัดสิน "ทำ" (พักไว้) → แยกเป็น ADM-21a/21b ในหัวข้อ "Follow-up รอบ 28"** | **แทนด้วย ADM-21a/21b** (หัวข้อ "Follow-up รอบ 28") — แถวนี้ไม่เปิด PR | — | — | → AC-25, AC-26 | ดูหัวข้อรอบ 28 | — |
| ADM-22 | (follow-up — ยังไม่สั่งทำ) loader ของหน้า pool (`routes/evouchers/pools/[id]/page.tsx:96`) ล้มแล้ว `ErrorBoundary` แสดง stack trace — source แสดงเฉพาะ `NODE_ENV=development` ต้องยืนยันบน build production ก่อนว่าไม่ใช่ปัญหาจริง — **รอบ 28: owner ตัดสิน "ยืนยันก่อน" (พักไว้) → หัวข้อ "Follow-up รอบ 28"** | **ย้ายไปแถว ADM-22 ของหัวข้อ "Follow-up รอบ 28"** (qa ยืนยันบน build production ก่อน — กฎ 26; พบปัญหาจึงเปิด ADM-22b) — แถวนี้ไม่เปิด PR | — | — | → AC-27 | ดูหัวข้อรอบ 28 | — |

### Open questions (รอบ 27)
none

## Follow-up รอบ 28 (2026-11-10 — เอกสารล้วน: บันทึกคำตัดสินของ owner)
ที่มา: owner ตอบ "ตามที่แนะนำ" — ADM-21 = ทำ, ADM-22 = ยืนยันก่อน **แต่สั่งว่ายังไม่ต้องทำตอนนี้** → ทุก task ในหัวข้อนี้พักไว้ ไม่บล็อก release v0.1.0 (ปิดรอบ 29: owner สั่งทำ ADM-21a/21b 2026-11-13 → ☑ #361/#362; ADM-22 ยังพักไว้) (path ย่อจาก `apps/backend/src/admin/`)
Status: accepted (ADM-21a/21b/22 พักไว้ — owner ยังไม่สั่งทำ) · ปิดรอบ 29: owner สั่งทำ 2026-11-13 → ADM-21a ☑ #361, ADM-21b ☑ #362; ADM-22 ยังพักไว้ · รอบ 35 2026-11-18: ADM-22 ☑ ผลตรวจ (owner สั่งทำ 2026-11-18) → แก้ที่ build (OPS-27 spec 07), ADM-22b ✕ — หัวข้อนี้ done
Out of scope: backend, แก้ `DataTable`/`ErrorBoundary` ของ dashboard, patch-package, ปุ่มลองใหม่ (reload หน้า — กฎ 24e), ตารางนอก 6 ไฟล์ข้างล่าง

### What Medusa already gives us (รอบ 28)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ข้อความ error โดยคงหัวตาราง/ปุ่มสร้าง | `emptyState.empty` (`heading`, `description`) ของ `DataTable` (dashboard) และ `DataTable.Table` (`@medusajs/ui` — `groups-section`, `group-members`) | ใช้ตามเดิม — แนวเดียวกับกฎ 24a (ADM-20) |
| 401 → `/login` | `ErrorBoundary` ของ dashboard | ใช้ตามเดิมด้วย `throw error` (กฎ 24b); เงื่อนไข 401 ที่ใช้ ≥ 2 ที่ย้ายเป็น helper pure ใน `lib/` ได้ตามกฎ 2 |
| หน้า error ของ loader | `ErrorBoundary` ของ dashboard (`errorElement` ของ route หลัก) — แสดง stack เฉพาะ `NODE_ENV=development` ตาม source | ใช้ตามเดิม — ADM-22 ยืนยันบน build production ก่อน (รอบ 35: ยังใช้ตามเดิม — เงื่อนไขคือ admin ต้อง build ด้วย `NODE_ENV=production` → OPS-27 spec 07) |

### Business rules (รอบ 28)
25. (ADM-21a/21b — owner "ทำ" 2026-11-10) ตารางทั้ง 6 ไฟล์ทำตามกฎ 24a–d เมื่อ query รายการล้มและไม่มีข้อมูลในมือ (`isError && !data`): ส่ง `emptyState.empty` = `{ heading: <ข้อความในตาราง>, description: error.message }`
    แทนข้อความ empty เดิม ห่อด้วย element ที่มี testid error **เฉพาะตอนสถานะนี้**, คงหัวตาราง/ปุ่มใน `action`/ปุ่ม toolbar เดิม; 401 → `throw error`; empty state เดิมแสดงเฉพาะเมื่อ API สำเร็จและไม่มีแถว; refetch ล้มขณะมี `data` คงตารางไว้ — ตารางของกฎ 25:

| ตาราง | ไฟล์ | GET ที่ e2e ทำให้ล้ม (`page.route`) | testid error | heading | task |
|---|---|---|---|---|---|
| E-voucher pools (`/app/evouchers`) | `components/evoucher/pools-table.tsx` | `**/admin/evoucher/pools?*` (รายการ — ไม่ match `/pools/<id>`) | `evoucher-pools-error` | "Could not load voucher pools" | 21a |
| Codes (หน้า pool) | `components/evoucher/codes-table.tsx` | `**/admin/evoucher/pools/*/codes*` | `evoucher-codes-error` (ภายใน `evoucher-codes`) | "Could not load codes" | 21a |
| Partners (`/app/evouchers`) | `components/evoucher/partners-section.tsx` | GET `**/admin/evoucher/partners*` | `evoucher-partners-error` (ภายใน `evoucher-partners-table`; ไม่แสดง `evoucher-partners-empty`) | "Could not load partners" | 21a |
| Affiliate ทุกแท็บที่ใช้ `useAffiliateList` (programs, affiliates, entries, payouts) | `components/affiliate/list-table.tsx` (`useAffiliateList` คืน `isError`/`error` ด้วย, `AffiliateListTable` แสดง) | `**/admin/affiliate/<resource>?*` ของแท็บนั้น | `affiliate-list-error` | "Could not load <resource>" — (รอบ 30, กฎ 29b) แท็บ Ledger (`entries`) = "Could not load ledger entries" | 21b |
| Groups (หน้าแคมเปญ) | `components/group-buy/groups-section.tsx` | `**/admin/group-buy/campaigns/*/groups*` (GET) | `gb-groups-error` (ภายใน `gb-groups-table`) | "Could not load groups" | 21b |
| Members (ของกลุ่มที่เลือก) | `components/group-buy/group-members.tsx` | `**/admin/group-buy/groups/*/memberships*` | `gb-memberships-error` (ภายใน `gb-memberships-table`) | "Could not load members" | 21b |

26. (ADM-22 — owner "ยืนยันก่อน" 2026-11-10) loader ของ `routes/evouchers/pools/[id]/page.tsx` ล้ม (ไม่ใช่ 401) บน **build production** (`pnpm --filter backend build && pnpm --filter backend start`):
    (a) ถ้าหน้าที่แสดงไม่มี stack trace/path ของ source → ปิด ADM-22 (✕) ไม่มีโค้ด บันทึกผลใน `docs/evidence/admin-ui/ADM-22/REPORT.md`;
    (b) ถ้าพบ → เปิด task แก้ (ADM-22b) ในโค้ดของเรา: loader คืน `undefined` เมื่อ fetch ล้ม (ยกเว้น 401 ที่ยัง throw) แล้วหน้าแสดง error จาก `useQuery` ของ pool (`evoucher-pool-error`) แทน `ErrorBoundary`; ห้าม patch dashboard
    **ผล (รอบ 35, 2026-11-18 — qa บน develop `9cd0770d`, `docs/evidence/admin-ui/ADM-22/REPORT.md`)**: เข้า (b) จริง — 500/abort/404 × full load/client navigation ตรง regex ของ AC-27 ("Error Details (Development Mode)" + stack), 401 ไป `/app/login` ผ่าน;
    แต่สาเหตุอยู่ระดับ build ไม่ใช่ loader: `medusa build` ตั้ง `NODE_ENV=development` เองเมื่อไม่มีค่า (`@medusajs/cli` 2.22.1 `dist/create-cli.js:541`) และค่านี้ถูกฝังใน admin bundle — build ด้วย `NODE_ENV=production` ไม่มี stack ทุกเคส (กระทบทุกหน้า admin รวมหน้าของ Medusa)
    → **owner เลือกแก้ที่การ build (2026-11-18)**: OPS-27 (spec 07 หัวข้อ "Follow-up รอบ 35", AC-42 — ซ้ำ AC-27 บน build ใหม่); **ADM-22b ไม่เปิด (✕)** — ไม่แก้ loader หน้า pool, ไม่ patch dashboard;
    คำสั่ง build ในวงเล็บของกฎนี้คงไว้เป็นประวัติ — คำสั่ง prod-like ที่ถูกต้องดู `CLAUDE.md` หลัง OPS-27

### Acceptance criteria (รอบ 28)
- AC-25 (ADM-21a, กฎ 25) e2e 1280×800 (เพิ่มใน `e2e/evoucher-admin-pool-page.spec.ts` และ `e2e/evoucher-admin-forms.spec.ts`): สำหรับแต่ละแถว 21a ของตารางกฎ 25 — Given `page.route` GET ตามแถวตอบ 500 When เปิดหน้า Then testid error visible (timeout default), ข้อความ empty เดิมของตารางนั้นไม่ปรากฏ ("No voucher pools yet", "Import a CSV to add codes.", `evoucher-partners-empty` count 0), heading ของตาราง visible และปุ่ม "Create partner" ภายใน `evoucher-partners-table` enabled (ข้อยกเว้นกฎ 18) — **ล้มบน develop**; ทำซ้ำด้วย `route.abort()`;
  Given ตอบ 401 Then `page.waitForURL(/\/app\/login/)` แล้วจบ test ทันที; Given ตอบรายการว่าง (`count: 0`) Then empty state เดิมแสดงและ testid error count 0; AC-7, AC-8, AC-20, AC-22, AC-23 ยังผ่าน;
  static (`__tests__/medusa-ui.unit.spec.ts`): ทั้งสามไฟล์มี `isError && !data` และ heading error ตามตารางอยู่ใน `emptyState` (ไม่แทนตารางด้วย `NoRecords`)
- AC-26 (ADM-21b, กฎ 25) e2e 1280×800 (เพิ่มใน `e2e/affiliate-admin-*.spec.ts` และ `e2e/group-buy-admin-pages.spec.ts`): Given `page.route` GET ของแท็บ affiliate ทีละแท็บ (`affiliate-admin-tab-*`) ตอบ 500 When เปิดแท็บ Then `affiliate-list-error` visible และปุ่มสร้างใน `action` (ภายใน `affiliate-programs-table`/`affiliate-payouts-table`) ยัง enabled;
  Given GET groups ของแคมเปญตอบ 500 Then `gb-groups-error` visible และ `gb-create-pool-group` ยังอยู่; Given GET memberships ตอบ 500 หลังเลือกกลุ่ม Then `gb-memberships-error` visible และไม่มี "No members yet" — **ล้มบน develop**; ทำซ้ำด้วย `route.abort()`;
  Given 401 Then ไป `/app/login` แล้วจบ test; Given รายการว่าง Then empty state เดิม และ testid error count 0; AC-11, AC-13, AC-21 ยังผ่าน; static: `list-table.tsx`, `groups-section.tsx`, `group-members.tsx` มี `isError && !data` และ heading error อยู่ใน `emptyState`
- AC-27 (ADM-22, กฎ 26) qa บน build production (1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`): Given pool P และ `page.route` GET `**/admin/evoucher/pools/<P>` (loader) ตอบ 500 When เปิด `/app/evouchers/pools/<P>` Then ข้อความของหน้าไม่ตรง regex `/\bat \S+ \(|\.(tsx?|m?js):\d+/` (ไม่มี stack/path) → ปิด ADM-22 ✕ พร้อม REPORT;
  ถ้าตรง → AC-27b (เงื่อนไขของ ADM-22b): หลังแก้ เคสเดียวกันแสดง `evoucher-pool-error` และไม่ตรง regex เดิม, 401 ไป `/app/login`, loader สำเร็จ AC-15 (spec 08) ยังผ่าน
  (รอบ 35, 2026-11-18) ผล: ตรง regex บน build เดิม → AC-27b **ไม่ใช้** (ADM-22b ✕ — กฎ 26 ผลรอบ 35); เคสของ AC-27 ถูกตรวจซ้ำบน build ใหม่ใน spec 07 AC-42c (OPS-27)

### Test plan (รอบ 28)
| ชนิด | AC |
|---|---|
| static jest + e2e admin (1280×800) | AC-25 (ADM-21a), AC-26 (ADM-21b) — เขียน e2e ให้ล้มบน develop ก่อน |
| qa ด้วยมือ/Playwright บน build production | AC-27 (ADM-22) |

### Tasks (รอบ 28)
| Task | งาน | ไฟล์ที่แตะ (`apps/backend/src/admin/` ยกเว้นระบุ) | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-21a | (owner "ทำ") สถานะ error แทน empty ของตาราง e-voucher: pools, codes, partners (กฎ 25) — ☑ #361 (owner สั่งทำ 2026-11-13) | `components/evoucher/{pools-table,codes-table,partners-section}.tsx`, `lib/` (helper 401 ถ้าย้าย — กฎ 2), `__tests__/medusa-ui.unit.spec.ts`, `apps/storefront/e2e/{evoucher-admin-pool-page,evoucher-admin-forms}.spec.ts` | ~180 LOC | 1280×800 | AC-25 | **ADM-16 merge** (ชน `codes-table.tsx`/`partners-section.tsx`), ADM-18/ADM-19 ถ้าเปิดอยู่ (ชนไฟล์ e2e — ตัวที่ merge ทีหลัง rebase); ไม่บล็อก release | ∥ ADM-21b |
| ADM-21b | (owner "ทำ") สถานะ error แทน empty ของตาราง affiliate (ทุกแท็บ) และ group buy groups/members (กฎ 25) — ☑ #362 (owner สั่งทำ 2026-11-13) | `components/affiliate/list-table.tsx`, `components/group-buy/{groups-section,group-members}.tsx`, `__tests__/medusa-ui.unit.spec.ts`, `apps/storefront/e2e/{affiliate-admin-forms,group-buy-admin-pages}.spec.ts` | ~180 LOC | 1280×800 | AC-26 | **ADM-17 merge** (ชน query รายการ affiliate/`affiliate-admin-forms`); ถ้า ADM-21a ย้าย helper 401 ไป `lib/` ก่อน ให้ใช้ตัวนั้น; ไม่บล็อก release | ∥ ADM-21a (ชน `medusa-ui.unit.spec.ts` คนละ test — ตัวที่ merge ทีหลัง rebase); ชน ADM-15 ไม่มี |
| ADM-22 | (owner "ยืนยันก่อน") qa ตรวจ stack trace ของ loader หน้า pool บน build production (กฎ 26) — ~~☐ พร้อมเริ่ม — owner ยังไม่สั่งทำ (พักไว้ 2026-11-10)~~ → **☑ ผลตรวจ 2026-11-18** (owner สั่งทำ 2026-11-18; ไม่มี PR — `docs/evidence/admin-ui/ADM-22/REPORT.md`): เข้า 26b แต่สาเหตุระดับ build → owner แก้ที่ build = OPS-27 (spec 07, AC-42); **ADM-22b ✕ ไม่เปิด** | `docs/evidence/admin-ui/ADM-22/REPORT.md` (ไม่มีโค้ด); ถ้าพบ → ADM-22b: `routes/evouchers/pools/[id]/page.tsx` + e2e ใน `evoucher-admin-pool-page.spec.ts` (~60 LOC) | qa ล้วน (22b ~60 LOC) | 1280×800 | AC-27 | none; ADM-22b ← ผล qa + ADM-21a (ไฟล์ e2e เดียวกัน); ไม่บล็อก release | ไม่ชน |

### Open questions (รอบ 28)
none

## Follow-up รอบ 30 (2026-11-13 — เอกสารล้วน: follow-up จาก review/qa #359–#362)
ที่มา: owner อนุมัติให้แปลง follow-up ของรอบ 29 เป็น spec/task (2026-11-13) — ตรวจโค้ดบน develop `8fb44d70` (path ย่อจาก `apps/backend/src/admin/` ยกเว้นระบุ):
- `components/evoucher/partners-section.tsx:240–251` ไม่มีเงื่อนไข "offset เกินกำลัง clamp" แบบ `codes-table.tsx:121` (`pastLastPage`) → ระหว่าง clamp `partners_offset` แสดง "No partners on this page" กระพริบ (#359 — นอก AC-20)
- `partners-section.tsx:68–121` `PartnerActions` ไม่มี `key={menuKey}` + `remountMenu()` ก่อนเปิด Drawer แบบ `affiliate/programs-table.tsx:25`, `:56–67` (comment ที่นั่นอธิบาย `pointer-events: none` ค้างบน body) และ Edit ไม่ disabled ระหว่างลบ (review #359)
- `lib/affiliate-payout.ts:75` `mergeAffiliatePages` รวม active + suspended ของหน้าเดียวกันแล้วเรียงชื่อ — เรียงได้แค่ภายในหน้า เพราะ `status` ของ `GET /admin/affiliate/affiliates` รับค่าเดียว (`apps/backend/src/api/admin/affiliate/validators.ts:61`); 401 ของ query ตัวเลือกแสดงเป็นข้อความใต้ช่องไม่ไป `/login` (review #360)
- `apps/backend/src/api/admin/affiliate/middlewares.ts:70` `tiebreakById` แก้แค่ `req.queryConfig.pagination.order` ไม่แก้ `req.listConfig.order` — ไม่มี comment เตือน (re-review #360)
- สถานะ error ของกฎ 24/25: แถบแบ่งหน้ายังแสดง "0 of 0 results" และ codes หน้า 2 ที่ล้มแสดง "2 of 1 pages" เพราะ `rowCount={data?.count ?? 0}` (qa #361/#362); หัวข้อ error แท็บ Ledger เป็น "Could not load entries" (`components/affiliate/list-table.tsx:103` ใช้ชื่อ resource) ไม่ตรงชื่อแท็บ (review #362); กฎ 24d (refetch ล้มขณะมีข้อมูล) ยังไม่มี e2e อัตโนมัติ (qa #361/#362 ทดสอบมือ); comment กฎ 25 ใน `components/evoucher/pools-table.tsx:60` อยู่ห่างจาก `div` ที่อธิบาย (review #361)
- `@medusajs/dashboard` 2.22.1 `DataTableProps` มี `enablePagination?: boolean` (`dist/components.d.ts:296`) — ปิดแถบแบ่งหน้าได้โดยไม่สร้างเอง
- qa #360 O-2: กด Escape ขณะ popover ของ `Combobox` เปิดอยู่ใน `FocusModal` ปิดทั้ง modal และค่าที่กรอกหาย — มาจาก ADM-9 (ยืนยันแล้ว 10/10 บน develop `e994246f` เมื่อ 2026-11-14 — กฎ 30) (ฟอร์มที่เข้าเงื่อนไข: `components/affiliate/payout-form.tsx:86`/`:113`, `components/affiliate/program-form.tsx:68`/`:136`)
Status: done (owner สั่งทำ 2026-11-13 → ADM-23 ☑ #373, ADM-24 ☑ #375, ADM-25 ☑ #381, ADM-26 ☑ #379)
Out of scope: แก้ `DataTable`/`Combobox`/`usePrompt` ของ dashboard/ui, patch-package, ปุ่มลองใหม่ (กฎ 24e), ตารางนอกกฎ 24/25

### What Medusa already gives us (รอบ 30)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ซ่อนแถบแบ่งหน้าตอน error | `enablePagination` ของ `DataTable` (dashboard); `DataTable.Pagination` ของ `@medusajs/ui` เป็น component แยก (ไม่ render ได้) | ใช้ตามเดิม |
| filter หลายค่าใน list route | `validateAndTransformQuery` + `query.graph` filter แบบ array (`status: ["active", "suspended"]` → `$in`) | **extend**: validator ของเราเองรับ array (แบบ `id[]` ของ AF-14) — ไม่มี migration |
| เรียงตามชื่อฝั่ง server | `order` ของ `validateAndTransformQuery` (`isList`) + `tiebreakById` ของเรา | ใช้ตามเดิม |
| เมนูต่อแถว + Drawer | `ActionMenu` (dashboard) + แนว `key`/remount ที่ `ProgramActions` ใช้อยู่ | ใช้ตามเดิม — ทำให้ `PartnerActions` เหมือนกัน |
| Escape ของ popover ใน modal | `Combobox` (dashboard) + `FocusModal.Content` (`onEscapeKeyDown` ของ Radix ส่งผ่าน `@medusajs/ui`) | **extend** (ADM-26, ยืนยันแล้ว 2026-11-14): `onEscapeKeyDown` กัน modal ปิดขณะ combobox ขยาย — ไม่แก้/ไม่สร้าง `Combobox` (กฎ 30) |

### Data model / Workflows
none

### API routes
`GET /admin/affiliate/affiliates` (ADM-24): `status` รับค่าเดียวหรือ array (`?status[]=active&status[]=suspended`); ค่าอื่นนอก enum → 400 `invalid_data`; response shape เดิม — ข้อยกเว้นของ Out of scope เรื่อง backend ต้น spec แบบ ADM-17 (route ของเราเอง, param เดิม)

### Business rules (รอบ 30)
27. (ADM-23 — #359, review #359) `components/evoucher/partners-section.tsx`: (a) เงื่อนไข "มีแถว (`count > 0`) แต่หน้านี้ว่าง = offset เกินที่กำลัง clamp" ย้ายเป็น helper pure ใน `lib/page-offset.ts` (ผู้ใช้ 2 ที่ — `codes-table.tsx` และ `partners-section.tsx`) แล้วทั้งสองตารางแสดง loading ในสถานะนั้นแทน empty state;
    branch "No partners on this page" ที่ไปไม่ถึงแล้วให้ลบ; (b) `PartnerActions` ทำแบบ `ProgramActions`: `ActionMenu key={menuKey}` และ `remountMenu()` ก่อน `onEdit`, Edit disabled ระหว่างลบ (`removing`) เหมือน Delete
28. (ADM-24 — review/re-review #360) (a) `GET /admin/affiliate/affiliates` รับ `status` หลายค่า (ดู API routes); (b) ตัวเลือก affiliate ของฟอร์ม payout ยิง request เดียวต่อหน้าด้วย `status` = `active`+`suspended` และ `order=name` → รายการเรียงชื่อข้ามหน้าตามลำดับของ API (ไม่เรียงซ้ำฝั่ง client);
    ลบ `mergeAffiliatePages`/`mergeAffiliateOptions`/`listAffiliatesByStatus` และ test ของมันเมื่อไม่มีผู้ใช้อื่น; (c) query ตัวเลือกได้ 401 → `throw error` ให้ `ErrorBoundary` พาไป `/login` (แนวกฎ 24b); error อื่นคงข้อความใต้ช่อง (กฎ 21);
    (d) comment ของ `tiebreakById` ระบุว่าแก้เฉพาะ `req.queryConfig.pagination.order` — route ที่อ่าน `req.listConfig.order` จะไม่ได้ tiebreak
29. (ADM-25 — qa #361/#362, review #361/#362) สถานะ error ของกฎ 24/25 (7 ตาราง: `routes/group-buying/page.tsx`, `components/evoucher/{pools-table,codes-table,partners-section}.tsx`, `components/affiliate/list-table.tsx`, `components/group-buy/{groups-section,group-members}.tsx`):
    (a) ขณะ `isError && !data` ไม่แสดงแถบแบ่งหน้า — `DataTable` ของ dashboard ส่ง `enablePagination={!loadFailed}`, ตารางของ `@medusajs/ui` ไม่ render `DataTable.Pagination` — จึงไม่มี "0 of 0 results"/"2 of 1 pages"; สถานะปกติแถบแบ่งหน้าคงเดิม;
    (b) heading error ของแท็บ Ledger (`resource` = `entries`) = "Could not load ledger entries" (แท็บอื่นคง "Could not load <resource>");
    (c) กฎ 24d มี e2e อัตโนมัติอย่างน้อยหนึ่งตารางต่อกลุ่ม (e-voucher, affiliate, group buy): ตารางโหลดสำเร็จแล้ว GET ครั้งถัดไปของรายการเดียวกันล้ม → แถวเดิมยังแสดงและไม่มี testid error;
    (d) comment กฎ 25 ใน `pools-table.tsx` ย้ายไปติด `div` ที่ใส่ testid error
30. (ADM-26 — qa #360 O-2; **ยืนยันแล้ว 2026-11-14**, owner ตัดสิน = ก "กันฟอร์มปิด" 2026-11-14) ใน `FocusModal` ที่มี `Combobox` (ฟอร์ม payout `components/affiliate/payout-form.tsx`, ฟอร์ม program `components/affiliate/program-form.tsx` — ทั้งสร้างและแก้):
    (a) **ผลยืนยัน** (builder, prod build develop `e994246f`): e2e กด Escape ขณะรายการตัวเลือกของ `Combobox` เปิด → ปิดทั้ง modal และค่าที่กรอกหาย ล้ม 10/10 (payout 5/5, program 5/5);
    (b) **ต้นเหตุ** (อยู่ใน component ของ Medusa — แก้ที่ต้นทางไม่ได้): `FocusModal` ของ `@medusajs/ui` 4.2.8 ใช้ `radix-ui` 1.1.2 → `@radix-ui/react-dialog` 1.1.5 → `@radix-ui/react-dismissable-layer` 1.1.4 (`dist/index.mjs`; **แก้เวอร์ชันปิดรอบ 30/31** ตาม review #378 — เดิมเขียน dialog 1.1.4 → dismissable-layer 1.1.3) ดัก Escape ที่ document แบบ capture (`react-use-escape-keydown` 1.1.0 ลงทะเบียนตอน modal mount จึงทำงานก่อน popover)
        เรียก `onEscapeKeyDown` แล้วถ้าไม่ `defaultPrevented` ก็ `preventDefault()` + `onDismiss()`; `Combobox` ของ `@medusajs/dashboard` 2.22.1 (`chunk-53MXUSIR.mjs:41-58`, `:377`) ใช้ Ariakit 0.7.1 ซึ่งข้าม Escape ที่ `defaultPrevented` แล้ว และ `Combobox` ไม่มี prop `open`/`onOpenChange` ให้ควบคุมรายการ
        — ลอง `preventDefault()` แล้ว modal ไม่ปิดแต่รายการก็ไม่ปิด, เพิ่ม `input.blur()` รายการยังไม่ปิด; วิธีอื่นเป็น hack;
    (c) **พฤติกรรมที่ต้องได้**: ขณะ `Combobox` ในฟอร์มขยายอยู่ Escape **ไม่ปิด** `FocusModal` และค่าที่กรอกไม่หาย — ใช้ prop `onEscapeKeyDown` ของ `FocusModal.Content` (ของ Radix ส่งผ่าน `@medusajs/ui`) เรียก `event.preventDefault()` เมื่อ combobox ขยาย
        ตรวจจาก `aria-expanded="true"` ของ input combobox ภายใน modal นั้น (หรือวิธีเทียบเท่าที่ไม่ hack — ระบุใน PR); เมื่อไม่มี combobox ขยาย Escape ปิด modal ตามเดิม (รวมเงื่อนไข `!save.isPending` เดิมของ `onOpenChange`);
    (d) **ข้อจำกัดที่ยอมรับ** (owner 2026-11-14): Escape ไม่ปิดรายการตัวเลือก — ผู้ใช้ปิดรายการด้วยการคลิกนอกรายการหรือเลือกค่า; Escape ครั้งถัดไปหลังรายการปิดแล้วปิด modal ตามปกติ;
    (e) ห้าม patch-package, ห้าม fork/สร้าง `Combobox` เอง, ห้ามดัก keydown ระดับ `window`/`document` หรือจำลอง event ของ Ariakit; ถ้าทำ (c) ด้วย `onEscapeKeyDown` ไม่ได้ → หยุดรายงาน planner

### Acceptance criteria (รอบ 30)
- AC-28 (ADM-23, กฎ 27) e2e 1280×800 (ต่อจาก `e2e/evoucher-admin-forms.spec.ts`): Given partner ≥ 1 และ `page.route` หน่วง GET `**/admin/evoucher/partners*` 800ms When เปิด `/app/evouchers?partners_offset=99999999` Then ตลอด 2 วินาทีแรก (MutationObserver นับ) ข้อความ "No partners on this page" ไม่ปรากฏ และจบที่หน้าสุดท้ายที่มีแถว (`partners_offset` ถูก clamp); — **ล้มบน develop**;
  When เปิดเมนู `evoucher-partner-row-actions` กด menuitem "Edit" แล้วปิด Drawer ด้วย Escape Then `page.locator("body")` ไม่มี CSS `pointer-events: none` และปุ่ม "Create partner" ใน `evoucher-partners-table` กดแล้ว modal เปิด;
  unit (`lib/__tests__/page-offset.unit.spec.ts`): helper ของกฎ 27a คืน true เมื่อ `count` 5 แถว 0, false เมื่อ `count` 0 แถว 0, false เมื่อ `count` 5 แถว 2, false เมื่อยังไม่มี data;
  static (`__tests__/medusa-ui.unit.spec.ts`): `codes-table.tsx` และ `partners-section.tsx` import helper นั้นจาก `lib/page-offset`, `partners-section.tsx` ไม่มี "No partners on this page", มี `key={menuKey}` ที่ `ActionMenu` และ action Edit มี `disabled: removing`; AC-8, AC-20, AC-23, AC-25 ผ่าน
- AC-29 (ADM-24, กฎ 28) integration http (`integration-tests/http/affiliate-admin*.spec.ts`): Given affiliate `pending`/`active`/`suspended` ชื่อคละลำดับ When `GET /admin/affiliate/affiliates?status[]=active&status[]=suspended&order=name&limit=2` หน้า 1 และ 2 Then มีเฉพาะ active/suspended, ต่อกันแล้วเรียงตาม `name` ไม่ซ้ำ id;
  `?status=active` ค่าเดียวยังได้ผลเดิม; `?status[]=foo` → 400 `invalid_data`; e2e (`e2e/affiliate-admin-forms.spec.ts`): When เปิด combobox affiliate ของฟอร์ม payout Then request รายการต่อหน้ามี 1 ตัวที่มีทั้ง `active` และ `suspended` และ `order=name` (ไม่มีคู่ request แยกสถานะ), option ตรงลำดับ `affiliates` ของ response;
  Given `page.route` GET รายการตัวเลือกตอบ 401 Then `page.waitForURL(/\/app\/login/)` แล้วจบ test; static: `components/affiliate/payout-form.tsx` ไม่มี `mergeAffiliatePages`, `api/admin/affiliate/middlewares.ts` มีคำว่า `listConfig` ใน comment เหนือ `tiebreakById`; AC-12, AC-21 ผ่าน
- AC-30 (ADM-25, กฎ 29) e2e 1280×800 (ไฟล์ e2e เดิมของ AC-24/25/26): สำหรับแต่ละตารางของกฎ 29 — Given `page.route` GET รายการตอบ 500 When เปิดหน้า Then testid error visible และภายใน wrapper ของตารางไม่มีข้อความตรง `/\d+ of \d+ (results|pages)/`; Given `?codes_offset=50` และ GET codes ตอบ 500 Then ไม่มี "2 of 1 pages";
  Given แท็บ Ledger ล้ม Then `affiliate-list-error` มี "Could not load ledger entries"; Given ตารางของกลุ่ม e-voucher/affiliate/group buy อย่างละหนึ่งโหลดสำเร็จ (มีแถว) When GET รายการเดียวกันครั้งถัดไปตอบ 500 (ทำให้ refetch ด้วยการ invalidate จาก mutation ของหน้านั้นหรือวิธีที่ระบุใน PR) Then แถวเดิมยัง visible และ testid error count 0 — กฎ 24d;
  Given API ปกติ Then แถบแบ่งหน้ายังแสดง (AC-14 ผ่าน); static (`medusa-ui.unit.spec.ts`/`group-buy-pages.unit.spec.ts`): ตาราง `DataTable` ของ dashboard ทั้ง 5 ไฟล์มี `enablePagination={!loadFailed}` (หรือชื่อตัวแปรเทียบเท่าที่เป็นเงื่อนไข error), `groups-section.tsx`/`group-members.tsx` render `DataTable.Pagination` เฉพาะเมื่อไม่ error; AC-24, AC-25, AC-26 ผ่าน
- AC-31 (ADM-26, กฎ 30) e2e 1280×800 (เพิ่มใน `e2e/affiliate-admin-forms.spec.ts`) — **ล้มบน develop `e994246f`** (10/10):
  (a) ฟอร์ม payout: Given ฟอร์มเปิดและกรอกช่วงวันที่แล้ว When คลิก combobox affiliate จน `role="listbox"` visible แล้ว `keyboard.press("Escape")` Then `getByRole("dialog")` ยัง visible และค่าช่วงวันที่ยังเป็นค่าที่กรอก (`expectDatePicker`);
      When ปิดรายการด้วยการเลือก option หนึ่ง (หรือคลิกนอกรายการภายใน dialog เช่นที่ heading) จน listbox ไม่ visible และ input combobox มี `aria-expanded` ≠ `"true"` แล้วกด Escape Then dialog ไม่ visible (modal ปิด — พฤติกรรมเดิม);
  (b) ฟอร์ม program (สร้าง): Given ฟอร์มเปิด กรอกชื่อ program และปิด "all" ให้ช่อง scope แสดง When คลิก combobox scope จน listbox visible แล้วกด Escape Then dialog ยัง visible และชื่อที่กรอกคงอยู่ (`toHaveValue`); When ปิดรายการด้วยการคลิกนอกรายการภายใน dialog (เช่นที่ heading) แล้วกด Escape Then modal ปิด
      (**แก้ปิดรอบ 30/31** ตาม review #378: combobox scope เป็น multi-select — การเลือก option ไม่ปิดรายการ จึงปิดได้ด้วยการคลิกนอกรายการเท่านั้น ไม่ใช่ "แบบ (a)");
  ไม่ assert ว่า Escape ปิด listbox (ข้อจำกัดที่ยอมรับ กฎ 30d); ผ่าน `--repeat-each=5` ทั้งสองเคส (แนบผลใน evidence);
  static (`__tests__/medusa-ui.unit.spec.ts`): `payout-form.tsx` และ `program-form.tsx` ต่างมี `onEscapeKeyDown` ที่ `FocusModal.Content` และมี `aria-expanded` ในเงื่อนไข (หรือชื่อ helper ที่ระบุใน PR); regression AC-12, AC-21, AC-29 ผ่าน

### Test plan (รอบ 30)
| ชนิด | AC |
|---|---|
| unit jest (lib) + static | AC-28, AC-29 (static), AC-30 (static), AC-31 (static) |
| integration http | AC-29 |
| e2e admin (`locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, 1280×800) | AC-28, AC-29, AC-30, AC-31 — เขียน e2e ที่ระบุว่า "ล้มบน develop" ให้ล้มก่อน |

### Tasks (รอบ 30)
| Task | งาน | ไฟล์ที่แตะ (`apps/backend/src/admin/` ยกเว้นระบุ) | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-23 | (#359, review #359) partners ไม่กระพริบ "No partners on this page" ตอน clamp (helper กลางใน `lib/page-offset.ts`) + `PartnerActions` remount เมนู/Edit disabled ระหว่างลบ (กฎ 27) — ☑ #373 (owner สั่งทำ 2026-11-13) | `lib/page-offset.ts` (+ `lib/__tests__/page-offset.unit.spec.ts`), `components/evoucher/{partners-section,codes-table}.tsx`, `__tests__/medusa-ui.unit.spec.ts`, `apps/storefront/e2e/evoucher-admin-forms.spec.ts` | ~90 LOC | 1280×800 | AC-28 | none (ADM-16 ☑ #359, ADM-21a ☑ #361); ไม่บล็อก release | ชน ADM-19 (☐) ที่ `evoucher-admin-forms.spec.ts` และ ADM-25 ที่ `partners-section`/`codes-table`/`medusa-ui.unit.spec.ts` → ตัวที่ merge ทีหลัง rebase; ∥ ADM-24 |
| ADM-24 | (review/re-review #360) `status` หลายค่าใน `GET /admin/affiliate/affiliates` + combobox request เดียวเรียงชื่อข้ามหน้า + 401 ไป `/login` + comment `tiebreakById` (กฎ 28) — ☑ #375 | `apps/backend/src/api/admin/affiliate/{validators,middlewares}.ts`, `components/affiliate/payout-form.tsx`, `lib/{affiliate,affiliate-payout}.ts` (+ `lib/__tests__/affiliate-payout.unit.spec.ts`), `apps/backend/integration-tests/http/affiliate-admin*.spec.ts`, `apps/storefront/e2e/affiliate-admin-forms.spec.ts` | ~150 LOC | 1280×800 | AC-29 | none (ADM-17 ☑ #360); ไม่บล็อก release | ชน ADM-26 ที่ `payout-form.tsx`/`affiliate-admin-forms.spec.ts` → ADM-24 ก่อน; ∥ ADM-23 |
| ADM-25 | (qa #361/#362, review #361/#362) สถานะ error: ซ่อนแถบแบ่งหน้า, หัวข้อ Ledger, e2e กฎ 24d อัตโนมัติ, comment `pools-table` (กฎ 29) — ☑ #381 | `routes/group-buying/page.tsx`, `components/evoucher/{pools-table,codes-table,partners-section}.tsx`, `components/affiliate/list-table.tsx`, `components/group-buy/{groups-section,group-members}.tsx`, `__tests__/{medusa-ui,group-buy-pages}.unit.spec.ts`, `apps/storefront/e2e/{evoucher-admin-pool-page,evoucher-admin-forms,affiliate-admin-forms,group-buy-admin-pages}.spec.ts` | ~220 LOC รวม e2e | 1280×800 | AC-30 | **ADM-23 merge** (ชน `partners-section`/`codes-table`/`medusa-ui.unit.spec.ts`); ไม่บล็อก release | ชน ADM-15 (☐) ที่ `group-buy-pages.unit.spec.ts`, ADM-18/19 (☐) ที่ไฟล์ e2e e-voucher, ADM-24 ที่ `affiliate-admin-forms.spec.ts` → ตัวที่ merge ทีหลัง rebase |
| ADM-26 | (qa #360 O-2 — ยืนยันแล้ว 2026-11-14, owner = ก "กันฟอร์มปิด") ขณะ `Combobox` ขยาย Escape ไม่ปิด `FocusModal` ของฟอร์ม payout/program (`onEscapeKeyDown` + `aria-expanded`) + e2e (กฎ 30) — ☑ #379 | `components/affiliate/{payout-form,program-form}.tsx`, `__tests__/medusa-ui.unit.spec.ts` (static), `apps/storefront/e2e/affiliate-admin-forms.spec.ts` | ~40 LOC + e2e | 1280×800 | AC-31 | **ADM-24 merge** (ชน `payout-form.tsx` และไฟล์ e2e); ไม่บล็อก release | ชน ADM-25 ที่ไฟล์ e2e → ตัวที่ merge ทีหลัง rebase |
ลำดับ (รอบ 30): ADM-23 ∥ ADM-24 → ADM-25 (← ADM-23) ∥ ADM-26 (← ADM-24); ไม่มี task ใดบล็อก release — ปิดรอบ 30/31: ☑ ครบ (#373, #375, #381, #379)

### ยอมรับใน v1 / ไม่เปิด task (รอบ 30)
- (qa #359) ดับเบิลคลิกปุ่มยืนยันของ `usePrompt` (Medusa): คลิกที่สองตกไปโดน element ใต้ dialog ที่ปิดแล้ว (1/3 รอบไปหน้า pool) แต่ DELETE ยังครั้งเดียว (guard `createSingleFlight` + `useIsMutating`) — พฤติกรรมของ component Medusa ไม่มีผลต่อข้อมูล → ไม่เปิด task (ส่ง upstream ได้ถ้า owner ต้องการ)
- (review #359) `REVEAL_KEY`/`DELETE_KEY` ไม่ผูก pool/partner — หน้า pool แสดงทีละ pool และ partners ไม่ขึ้นกับ pool ผลจริงคือปุ่มของทุกแถวในตารางเดียว disabled ระหว่าง request ตามเจตนาของกฎ 20a → ไม่เปิด task
- (qa #360 O-1/O-4) `q` ไม่ escape `%`/`_` (ได้ผลกว้างขึ้น ไม่ใช่ข้อมูลรั่ว — admin เท่านั้น) และ access log บันทึก `q` เต็ม — เหมือน route ของ Medusa core (เช่น `/admin/customers?q=`) → ไม่เปิด task; ทบทวนพร้อมนโยบาย log/PII ตอนทำ OPS-3c
- (qa #360 O-5) `order=foo`/`order=` ได้ 500 — มาจาก `validateAndTransformQuery` ของ Medusa เหมือน route core, admin เท่านั้น → ไม่เปิด task
- (review #361) regex static ใน `medusa-ui.unit.spec.ts` ผูกรูปแบบตัวอักษรแน่น — ตั้งใจล็อกรูปแบบ (แนว AC-5..27) ปรับเมื่อ refactor ทำให้ล้ม → ไม่เปิด task
- (#362) `e2e/affiliate-admin-affiliates.spec.ts:43` (AC-43) เปราะเมื่อ workers > 1 — CI ใช้ `workers: 1` (แนวเดียวกับที่ยอมรับรอบ 20) → ไม่เปิด task
- (review #362) รูป `04-members-error-500` ของ evidence ADM-21b ตัดไม่เห็น description — evidence merge แล้วและ AC-26 ตรวจด้วย e2e; qa ของ ADM-25 ถ่ายรูปสถานะ error ใหม่ → ไม่เปิด task
- (backlog เก่า) ลด AC-15 กลับเป็น ≤ 2 หลัง upgrade `@medusajs/dashboard` — อยู่ใน checklist bump ข้อ 9 ของ spec 07 แล้ว (Q8) → ไม่เปิด task
- (ADM-18, owner = ก 2026-11-14) เลือก filter ของ `evoucher-codes` แล้วกด Esc ก่อน URL commit → filter หาย (ต้นเหตุ `DataTableFilter.onOpenChange` ของ `@medusajs/ui` 4.2.8 — รายละเอียดกฎ 22) ผู้ใช้เลือกใหม่ได้ → ไม่เปิด task และไม่เปิด issue upstream ตอนนี้;
  backlog (ไม่เปิด task): (1) ให้ `loader` ของ `routes/evouchers/pools/[id]/page.tsx` ใช้ค่า cache ของ query ที่มีอยู่แล้วเพื่อลดช่วงเสี่ยง — ต้องแก้ `page.tsx` และไม่ปิดปัญหาทั้งหมด (ถอด loader ยังล้ม 14/20); (2) เปิด issue upstream ที่ `@medusajs/ui` เมื่อ owner ต้องการ; ทบทวนอีกครั้งเมื่อ bump `@medusajs/*`
- (ADM-26, owner = ก 2026-11-14) Escape ขณะ `Combobox` ขยายใน `FocusModal` ไม่ปิดรายการตัวเลือก (ผู้ใช้คลิกนอก/เลือกค่าเพื่อปิด) — ต้นเหตุลำดับตัวดัก Escape ของ Radix dismissable-layer × Ariakit (กฎ 30b) → ยอมรับใน v1;
  backlog (ไม่เปิด task): (1) เปิด issue upstream ที่ `@medusajs/ui`/`@medusajs/dashboard` (owner ยังไม่สั่ง); (2) ทบทวนเมื่อ bump `@medusajs/*` — ถ้า Escape ปิดเฉพาะรายการได้เองแล้ว ให้ถอด `onEscapeKeyDown` ของกฎ 30c และปรับ AC-31 ให้ assert ว่า listbox ปิด;
  (3) ข้อสังเกต (ตรวจ develop `e994246f`): `Combobox` ใน `src/admin/` มีเฉพาะ `components/affiliate/payout-form.tsx` และ `program-form.tsx` (ทั้งคู่อยู่ใน ADM-26); `FocusModal`/`Drawer` อื่น (`widgets/variant-evoucher-pool.tsx`, `widgets/flash-sale-options.tsx`, `components/group-buy/create-campaign.tsx`, `components/evoucher/{partners-section,codes-table}.tsx`, `components/affiliate/payout-info-drawer.tsx`) ไม่มี `Combobox`
  — ถ้าเพิ่ม `Combobox` ใน `FocusModal`/`Drawer` ใหม่ต้องใช้แนวเดียวกับกฎ 30c (ADM-26 มีผู้ใช้ 2 ที่แล้ว — builder ย้ายเงื่อนไขเป็น helper ใน `lib/` ได้ตาม `CLAUDE.md` ระบุใน PR)

### Open questions (รอบ 30)
none

## Follow-up รอบ 32 (2026-11-17 — Q9 = ก, Q10 = ก owner 2026-11-17)
Status: done (ปิดรอบ 32 2026-11-17 — ADM-27 ☑ #389; owner สั่งทำ 2026-11-17) · Out of scope: ย้ายไป `RouteFocusModal`/`RouteDrawer` (Q5 คงเดิม), แก้/patch `usePrompt`/`FocusModal`/`Drawer` ของ Medusa, Drawer ที่ไม่ใช่ฟอร์ม (`components/evoucher/codes-table.tsx` reveal code), ปุ่ม Prev/ลองใหม่ของตาราง error (Q10 = ก)

### What Medusa already gives us (รอบ 32)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ถามก่อนทิ้งฟอร์มที่แก้แล้ว | `RouteModalForm` (dashboard) — `useBlocker` เฉพาะ modal แบบ route; ไม่มี export สำหรับ `FocusModal`/`Drawer` แบบ state (ตรวจ 2.22.1 `dist/components.d.ts:483–537`) | **custom เล็ก** ตาม "Custom Component Guides": hook กลางที่ใช้ `usePrompt` ของ `@medusajs/ui` + ถ้อยคำเดียวกับ dashboard |
| กล่องยืนยัน | `usePrompt` (`@medusajs/ui`) | ใช้ตามเดิม |
| รู้ว่าฟอร์มถูกแก้ | `formState.isDirty` ของ react-hook-form (ผ่าน `Form` ของ dashboard) | ใช้ตามเดิม |

### Business rules (รอบ 32)
31. (ADM-27 — Q9 = ก owner 2026-11-17, qa #379 O-1) ฟอร์มใน `FocusModal`/`Drawer` แบบ state (Q5) ทั้ง 7 จุด — `widgets/variant-evoucher-pool.tsx`, `widgets/flash-sale-options.tsx`, `components/affiliate/{payout-form,program-form,payout-info-drawer}.tsx`,
    `components/group-buy/create-campaign.tsx`, `components/evoucher/partners-section.tsx` (สร้าง + แก้):
    (a) ปิดด้วยทางใดก็ได้ (Escape, ปุ่ม close/Cancel, คลิกนอก — ทุกทางที่ผ่าน `onOpenChange(false)`) ขณะ `form.formState.isDirty` → แสดง `usePrompt` title "Are you sure you want to leave this form?" description "You have unsaved changes that will be lost if you exit this form."
        (ถ้อยคำ `unsavedChangesTitle`/`unsavedChangesDescription` ของ dashboard; ปุ่มยืนยัน/ยกเลิกตาม default ของ `usePrompt` หรือ "Leave"/"Continue editing" — ระบุใน PR); ยืนยัน → ปิดและค่าหาย, ยกเลิก → modal ยังเปิดและค่าคงอยู่; ไม่ dirty → ปิดทันทีเหมือนเดิม;
    (b) hook กลางตัวเดียว (เช่น `useConfirmDiscard(isDirty)` คืน handler สำหรับ `onOpenChange`) ใน `components/common/` (ผู้ใช้ 7 ที่ — `CLAUDE.md` ข้อ 1) ไม่มีสำเนาใน form ใด;
        ฟอร์มที่ไม่ได้ใช้ react-hook-form (ถ้ามี) ส่งเงื่อนไข dirty ที่เทียบเท่า (ค่าปัจจุบัน ≠ ค่าเริ่มต้น) — ระบุใน PR;
    (c) **กันกดซ้ำ**: ขณะบันทึก (`isPending` ของ mutation เดิม) การปิดยังถูกกันตามเงื่อนไขเดิม (`!save.isPending` ฯลฯ) และไม่แสดง prompt; ขณะ prompt เปิดอยู่ คำขอปิดซ้ำ (Escape/คลิกซ้ำ) ไม่เปิด prompt ซ้อน (in-flight flag);
        หลังบันทึกสำเร็จฟอร์มปิดโดยไม่ถาม (reset หรือเช็ก `isSubmitSuccessful`/state ปิดของ handler เดิม);
    (d) **ADM-26 (กฎ 30c) คงเดิม**: ขณะ `Combobox` ขยาย `onEscapeKeyDown` ยัง `preventDefault()` ก่อน → Escape ไม่ถึง `onOpenChange` จึงไม่เกิด prompt; Escape ครั้งถัดไปหลังรายการปิดแล้วเข้ากฎ (a);
    (e) ห้ามดัก keydown ที่ `window`/`document`, ห้าม `beforeunload`/router blocker (ไม่ใช่ route modal), ห้ามแก้ testid เดิม

### Acceptance criteria (รอบ 32)
- AC-32 (ADM-27, กฎ 31) e2e 1280×800 (ไฟล์ใหม่ `e2e/admin-form-discard-prompt.spec.ts`, `evidenceTarget` `ADM-27`; `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`) — **ล้มบน develop**:
  สำหรับฟอร์มสร้าง partner (`evoucher-partners-table` → "Create partner"), ฟอร์มสร้างแคมเปญ (`gb-campaign-create`) และฟอร์ม program (สร้าง): Given ฟอร์มเปิดและกรอกช่องข้อความหนึ่งช่อง When `keyboard.press("Escape")`
  Then `getByRole("alertdialog")` visible และ dialog ของฟอร์มยัง visible; When กดปุ่มยกเลิกของ prompt Then alertdialog ไม่ visible, ฟอร์มยังเปิด และค่าที่กรอกคงอยู่ (`toHaveValue`); When Escape อีกครั้งแล้วกดยืนยัน Then ฟอร์มปิด และเปิดใหม่ช่องว่าง;
  Given ฟอร์มเปิดแต่ยังไม่กรอก When Escape Then ฟอร์มปิดโดยไม่มี alertdialog; Given ฟอร์ม Drawer แก้ partner กรอกแล้วคลิกปุ่ม close ของ Drawer Then มี alertdialog;
  Given ฟอร์ม payout dirty และ `Combobox` ขยาย When Escape Then ไม่มี alertdialog และ dialog ยังเปิด (กฎ 31d — AC-31 ยังผ่าน);
  Given ฟอร์มสร้าง partner dirty When กด Escape 2 ครั้งติดกัน Then alertdialog มี 1 ตัว (`toHaveCount(1)`); Given บันทึกสำเร็จ Then ไม่มี alertdialog;
  static (`__tests__/medusa-ui.unit.spec.ts`): ไฟล์ทั้ง 7 import hook จาก `components/common/` และ hook ใช้ `usePrompt` จาก `@medusajs/ui`, ไม่มี `addEventListener("keydown"` ในไฟล์เหล่านี้;
  e2e เดิมที่ปิดฟอร์มที่กรอกแล้วด้วย Escape/close ปรับให้ยืนยัน prompt (ระบุรายการใน PR) และ AC-7..31 ที่เกี่ยวข้องผ่าน

### Test plan (รอบ 32)
| ชนิด | AC |
|---|---|
| static jest + e2e admin (1280×800) | AC-32 (เขียน e2e ให้ล้มบน develop ก่อน; qa ถ่ายรูป prompt ≤ 2 PNG) |

### Tasks (รอบ 32)
| Task | งาน | ไฟล์ที่แตะ (`apps/backend/src/admin/` ยกเว้นระบุ) | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-27 | (Q9 = ก owner 2026-11-17, qa #379 O-1) ถามยืนยันด้วย `usePrompt` ก่อนปิดฟอร์มที่ dirty ใน `FocusModal`/`Drawer` แบบ state 7 จุด ผ่าน hook กลาง (กฎ 31) — ☑ #389 | `components/common/` (hook ใหม่), `widgets/{variant-evoucher-pool,flash-sale-options}.tsx`, `components/affiliate/{payout-form,program-form,payout-info-drawer}.tsx`, `components/group-buy/create-campaign.tsx`, `components/evoucher/partners-section.tsx`, `__tests__/medusa-ui.unit.spec.ts`, `apps/storefront/e2e/admin-form-discard-prompt.spec.ts` (ใหม่) + e2e เดิมที่ปิดฟอร์ม dirty (เช่น `affiliate-admin-{forms,programs}`, `evoucher-admin-{forms,pool-page}`, `group-buy-admin-form`) | ~250 LOC รวม e2e — ถ้าเกิน ~400 แบ่ง **ADM-27a** (hook + ฟอร์ม affiliate/group buy + e2e) → **ADM-27b** (ฟอร์ม e-voucher/flash sale + e2e) | 1280×800 | AC-32 | PR เอกสารรอบ 32 merge; ADM-26 ☑ #379; ไม่บล็อก release | ชน CORE-61 (spec 01) ที่ `e2e/{affiliate-admin-forms,evoucher-admin-forms,evoucher-admin-pool-page}.spec.ts`/`e2e/support/admin.ts` (CORE-61 แก้แค่บรรทัด import `PAGINATION_TEXT`) → **แนะนำ CORE-61 merge ก่อน** แล้ว ADM-27 rebase; ∥ GB-17 (`src/api/`), CORE-62, CORE-63, OPS-26 |

### ยอมรับใน v1 / ไม่เปิด task (รอบ 32)
- (Q10 = ก owner 2026-11-17, qa #381) ตารางที่ error ขณะอยู่หน้า ≥ 2 ไม่มีปุ่ม Prev/ลองใหม่ — reload หรือกดเมนูด้านข้าง (URL ไม่มี offset → หน้า 1) แก้ได้, ตรงกับหน้า list ของ Medusa ที่ไม่มี retry; กฎ 24e/29a คงเดิม

## Open questions (รอบ 32 — 2026-11-17)
ที่มา: ROADMAP หัวข้อ "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 30/31)" ข้อ (3), (6) — ตรวจโค้ดบน develop `a9fec926` และ `@medusajs/dashboard` 2.22.1 / `@medusajs/ui` 4.2.8 ที่ติดตั้ง (path ย่อจาก `apps/backend/src/admin/`)
- ~~**Q9**~~ ✅ **owner ตอบ ก 2026-11-17** → กฎ 31, AC-32, ADM-27 (หัวข้อ "Follow-up รอบ 32"); คำถามเดิม: (qa #379 O-1) ฟอร์มที่กรอกแล้ว (dirty) ปิดด้วย Escape/ปุ่มปิด/คลิกนอก → ค่าหายโดยไม่ถาม (ตรงกฎ 30c — ADM-26 กันเฉพาะตอน `Combobox` ขยาย); Medusa มี pattern นี้**เฉพาะ modal แบบ route**:
  `RouteModalForm` (export จาก `@medusajs/dashboard/components`, ใช้ผ่าน `RouteFocusModal.Form`/`RouteDrawer.Form`) ใช้ `useBlocker` ของ react-router บล็อกการออกจาก route เมื่อ `isDirty` แล้วถาม "Are you sure you want to leave this form?"
  / "You have unsaved changes that will be lost if you exit this form." (`dist/chunk-GXJ5J364.mjs:80`, คำแปล `unsavedChangesTitle`/`unsavedChangesDescription`) — ไม่มี export สำหรับ `FocusModal`/`Drawer` แบบ state ที่เราใช้ตาม Q5;
  ฟอร์มที่เข้าข่าย 7 จุด: `widgets/variant-evoucher-pool.tsx`, `widgets/flash-sale-options.tsx` (Drawer), `components/affiliate/{payout-form,program-form}.tsx`, `components/affiliate/payout-info-drawer.tsx`, `components/group-buy/create-campaign.tsx`, `components/evoucher/partners-section.tsx` (สร้าง + แก้):
  (ก) **[แนะนำ]** คง `FocusModal`/`Drawer` แบบ state (Q5) แล้วถาม `usePrompt` ของ `@medusajs/ui` ก่อนปิดเมื่อ `form.formState.isDirty` และไม่ได้กำลังบันทึก — ใช้ถ้อยคำเดียวกับ dashboard; ทำเป็น hook เดียวใน `components/common/` (ผู้ใช้ 7 ที่ — ตาม "Custom Component Guides" เพราะ dashboard ไม่ export ตัวนี้) ต่อกับ `onOpenChange` เดิม (และ `onEscapeKeyDown` ของ ADM-26 ยังทำงานก่อน);
      เหตุผล: พฤติกรรมเหมือนหน้า admin หลักของ Medusa โดยไม่กลับคำตัดสิน Q5; ผลกระทบ: ~150 LOC + e2e ใหม่ (dirty → Escape → prompt → ยกเลิกแล้วค่าคงอยู่ / ยืนยันแล้วปิด) และต้องแก้ e2e เดิมที่ปิดฟอร์มที่กรอกแล้วด้วย Escape (แตกเป็น 2 PR ตาม module ถ้าเกิน ~400 LOC)
  (ข) ย้ายฟอร์มไปใช้ `RouteFocusModal`/`RouteDrawer` + `RouteModalForm` ของ Medusa (ได้ prompt อัตโนมัติ) — **กลับคำตัดสิน Q5 ของ owner และต้องแก้ ADR-018**; ผลกระทบ: ทุกฟอร์มต้องมี route ของตัวเอง (URL เปลี่ยน, state ที่ส่งเข้าฟอร์มต้องอ่านจาก URL/loader), e2e ฟอร์มเกือบทั้งหมดต้องแก้ ~400+ LOC หลาย PR
  (ค) คงเดิม ไม่มี task — ผลกระทบ: admin ที่กด Escape/คลิกนอกโดยไม่ตั้งใจต้องกรอกใหม่ (ไม่มีข้อมูลเสียหาย — ยังไม่ได้บันทึก)
- ~~**Q10**~~ ✅ **owner ตอบ ก 2026-11-17 (คงเดิม)** → บันทึกใน "ยอมรับใน v1 (รอบ 32)" ไม่มี task; คำถามเดิม: (qa #381) ตารางที่ error ขณะอยู่หน้า ≥ 2 (`?<prefix>_offset=` > 0) ไม่มีปุ่ม Prev/ลองใหม่ เพราะ ADM-25 ซ่อนแถบแบ่งหน้าตอน `isError && !data` (กฎ 29a) และกฎ 24e ไม่มีปุ่มลองใหม่ (reload หน้า);
  Medusa: `DataTable` ของ dashboard/`@medusajs/ui` ไม่มี error state/ปุ่ม retry — หน้า list ของ Medusa เองโยน error ให้ `ErrorBoundary` (ไม่มี retry); `emptyState.empty.custom` (ReactNode, `@medusajs/ui` `blocks/data-table/types.d.ts:319`) ใส่ปุ่มได้โดยไม่สร้างตารางเอง;
  `QueryClient` ของ dashboard `retry: 1` อยู่แล้ว:
  (ก) **[แนะนำ]** คงเดิม ไม่มี task — เหตุผล: เกิดเฉพาะเมื่อ API ล้มตอนอยู่หน้า ≥ 2 แล้ว refetch ล้มซ้ำ, reload หรือกดเมนูด้านข้าง (URL ไม่มี offset → หน้า 1) แก้ได้ทันที และตรงกับหน้า list ของ Medusa ที่ไม่มี retry; ผลกระทบ: ไม่มีงาน
  (ข) ปุ่ม "Back to first page" ใน `emptyState.empty.custom` เฉพาะตอน error และ offset > 0 (ล้าง `<prefix>_offset` ผ่าน `useQueryParams`/search params) ทั้ง 7 ตารางของกฎ 29 — ผลกระทบ: ~150 LOC + e2e (testid ปุ่มใหม่ต่อตาราง), แก้กฎ 24e/29
  (ค) ปุ่ม "Try again" (`refetch()`) ทุกตารางตอน error + ข้อ (ข) — ผลกระทบ: ~200 LOC + e2e, ต้องกันกดซ้ำระหว่าง refetch (`isFetching`), แก้กฎ 24e

## Follow-up รอบ 33 (2026-11-17 — owner สั่งเปิด task หาสาเหตุ flaky AC-12)
ที่มา: ROADMAP หัวข้อ "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 32)" ข้อ (4) — owner 2026-11-17 "เปิด task หาสาเหตุ"; spec 01 รอบ 32 ตกลงว่า "เปิด task เมื่อเกิดซ้ำ" ·
อาการ: `apps/storefront/e2e/affiliate-admin-forms.spec.ts:47` (AC-12, ADM-9) ล้มใน CI 2 ครั้ง — #373 run 43475980049 และ #388 run 44071909424 — ทั้งคู่ timeout 2 นาที (`test.setTimeout(120_000)` `:52`) ใน step "พิมพ์ชื่อ collection ลำดับที่ 250" (`:85–97`) ·
อ่าน test บน develop `1c55193f` (path ย่อจาก `apps/storefront/`; โค้ด admin ย่อจาก `apps/backend/src/admin/`) — **สมมติฐานเบื้องต้น (ยังไม่ยืนยันด้วย trace)**:
- H1 (น่าจะที่สุด) action ที่ค้างคือ `page.getByRole("option").filter({ hasText: … }).click()` (`:87` — ข้อความ `<tag> col 249`): `playwright.config.ts` ไม่ตั้ง `actionTimeout` (มีแค่ `retries: 0`, `workers: 1` ใน CI) → action รอจน timeout ของ test 120s
  ซึ่งตรงกับอาการ "timeout 2m ที่ step นี้" (ถ้า expect ของ `:88`/`:96` ค้าง จะล้มที่ 5s ของ expect timeout ไม่ใช่ 2 นาที) → option ที่มีข้อความนั้น**ไม่เคย render** หรือ render แต่ click ไม่สำเร็จจน timeout
- H1a รายการยังเป็นผลของ query ก่อนค้นหา: `useComboboxData` 2.22.1 (`@medusajs/dashboard/src/hooks/use-combobox-data.tsx:48`, `:74–91`) debounce ค่าค้นหาแล้วใช้ `useInfiniteQuery` ที่ `placeholderData: keepPreviousData` + `pageSize` 10 —
  ถ้า request ค้นหา (`GET /admin/collections?q=…`) ช้า/ล้ม (retry 1 ของ `QueryClient`) หรือ `fill` ครั้งเดียวไม่ทำให้ค่า debounce เปลี่ยน รายการจะค้างที่ 10 ตัวแรก (collection ลำดับที่ 250 ไม่อยู่ในนั้น)
- H1b option render แล้วแต่ถูก re-render/detach ซ้ำ: `Combobox` ของ dashboard เรียก `fetchNextPage` เมื่อ sentinel ท้ายรายการเข้ามาในจอ — ขณะผลเก่า (มีหน้าถัดไป) ยังแสดงอยู่อาจโหลดหน้าเพิ่มต่อเนื่อง ทำให้ element "not stable/detached" จน timeout
- H2 `fill` ที่ `affiliate-program-field-collection_ids` (`:86`; testid ที่ `components/affiliate/program-form.tsx:82`) ไม่ทำให้รายการเปิด (เช่น focus ยังอยู่ที่ปุ่ม Save หลัง error ของ step แรก `:80–81`) — ถ้าเป็นแบบนี้ trace จะแสดงว่าไม่มี request `q=` ออกไปเลย
- H3 ข้อมูลเกิน: `product_collection` ที่ test อื่น/run ก่อนไม่ลบ ทำให้ `q` ได้ผลหลายตัว — น่าจะน้อย (`tag` มี `Date.now()` และ `finally` ลบ `pcol_<tag>_%` `:114`)

Status: done (ปิดรอบ 33 2026-11-18 — ADM-28 ☑ #393; owner สั่งทำ 2026-11-17)
**ผล ADM-28 (ยืนยันจาก trace ของ run 44071909424 และ 43475980049 — `docs/evidence/admin-ui/ADM-28-tests.txt`)**: ไม่ใช่ H1a/H1b/H2 — เป็น **H3 แบบที่ไม่ได้คาด (ต้นเหตุอยู่ในข้อมูลทดสอบ)**:
`q` ของ Medusa 2.22.1 (`@medusajs/utils` `mikro-orm-free-text-search-filter.js:74–110`) แยกคำค้นด้วยช่องว่างแล้ว AND `ILIKE "%คำ%"` ทีละคำ; tag `adm9${Date.now()}` ของทั้งสอง run ที่ล้มบังเอิญมีเลข "249"
→ คำค้น "<tag> col 249" ตรงทั้ง 250 collection (`count=250`), col 249 ไม่อยู่ใน 10 รายการแรกของ `Combobox` → `click` รอจน timeout ของ test 120s (option ไม่เคย render) — `useComboboxData`/`Combobox` ของ dashboard และ `program-form.tsx` ทำงานถูก;
แก้ฝั่ง test: แปลงตัวเลขของ tag เป็นตัวอักษร a–j + รอ response ของ `GET /admin/collections` ที่ `q` ตรงแล้ว assert `count === 1` ก่อนหา option (ข้อมูลชนอีกจะล้มใน ~2s พร้อมจำนวนจริง) — ไม่เพิ่ม timeout, `playwright.config.ts` ไม่เปลี่ยน

### What Medusa already gives us (รอบ 33)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ค้นหา/แบ่งหน้าใน combobox | `useComboboxData` + `Combobox` (`@medusajs/dashboard`) — ตามกฎ 11 | ใช้ตามเดิม — ห้าม patch; ถ้าต้นเหตุอยู่ใน Medusa ให้แก้ฝั่ง test (รอสัญญาณที่ถูกต้อง) และบันทึก |
| ค้นหา collection ฝั่ง server | `GET /admin/collections?q=` | ใช้ตามเดิม |
| วิเคราะห์ test ที่ล้ม | Playwright trace (CI artifact 14 วัน — `CLAUDE.md` ข้อ 6) | ใช้ตามเดิม |

### Business rules (รอบ 33)
32. (ADM-28 — owner 2026-11-17, ROADMAP ปิดรอบ 32 ข้อ (4)) แก้ flaky ของ test AC-12 ตัวแรกใน `e2e/affiliate-admin-forms.spec.ts:47` ตาม**สาเหตุที่ยืนยันแล้ว**:
    (a) builder ดาวน์โหลดและอ่าน trace/report ของ run ที่ล้ม (`gh run download 44071909424`, และ 43475980049 ถ้ายังไม่หมดอายุ — artifact เก็บ 14 วันนับจากวันที่ run — ประมาณราว 2026-12-01 สำหรับ 44071909424 ตรวจวันหมดอายุจริงด้วย `gh api repos/{owner}/{repo}/actions/runs/<id>/artifacts`) **ก่อนแก้** แล้วระบุใน PR และ `docs/evidence/admin-ui/ADM-28-tests.txt`:
        action/assertion ที่ค้าง (บรรทัด), call log ของ Playwright ตอนค้าง, request `GET /admin/collections` (มี `q` ไหม, status, เวลา, จำนวนผล) และ DOM ของ listbox ตอนค้าง — แล้วระบุว่าสมมติฐานใด (H1–H3 หรืออื่น) ถูก;
    (b) แก้ตามสาเหตุ: ถ้าอยู่ใน test → ให้ test รอสัญญาณจริง (เช่น `waitForResponse` ของ `GET /admin/collections` ที่ `q` ตรงกับค่าที่พิมพ์ก่อนหา option, หรือเปิดรายการให้ชัดก่อนพิมพ์) แบบเดียวกับ test อื่นในไฟล์;
        ถ้าอยู่ในโค้ด admin ของเรา (`components/affiliate/program-form.tsx`) → แก้ในโค้ดพร้อม test ที่ล้มก่อน (≤ ~50 LOC; เกินนั้นหยุดและรายงาน planner);
        ถ้าอยู่ใน `@medusajs/dashboard`/`@medusajs/ui` → ห้าม patch แก้ฝั่ง test ให้รอสถานะที่ถูกต้องพร้อม comment อ้าง trace แล้วบันทึกเป็นข้อจำกัดภายนอกใน PR;
    (c) **ห้าม**แก้แค่เพิ่ม timeout: ห้ามเพิ่ม `test.setTimeout`, timeout ต่อ action/expect ที่ยาวขึ้น, `waitForTimeout`, `retries`/`actionTimeout`/timeout ระดับ `playwright.config.ts`, `test.fixme`/`skip`;
        อนุญาตใส่ timeout ต่อ action ที่**สั้นลง**เพื่อให้ล้มเร็วและเห็นจุดค้าง (ใส่คู่กับการแก้ตามสาเหตุเท่านั้น);
    (d) ถ้า trace ทั้งสอง run หมดอายุ/อ่านไม่ได้ และทำซ้ำในเครื่องไม่ได้ (รันตาม AC-33 แล้วผ่านครบ) → **ไม่แก้ test** หยุดและรายงาน planner/owner พร้อมผลที่รัน (ห้ามแก้ตามการเดา);
    (e) ไม่แก้ test อื่นในไฟล์ (รวม AC-31 ของ ADM-26 และ e2e ของ ADM-27) นอกจาก helper ที่ test นี้ใช้ร่วม และไม่เปลี่ยน testid เดิม;
    (f) (บทเรียนปิดรอบ 33 — ใช้กับ e2e/integration ใหม่ทุกตัว) test ที่ค้นด้วย `q` ของ Medusa (หรือ route ของเราที่ใช้ `q` แบบเดียวกัน) **ห้ามใช้ tag/ค่าไม่ซ้ำที่มีตัวเลขซึ่งอาจชนกับคำค้น** (เช่น `Date.now()` ดิบคู่กับคำค้นที่มีเลข) —
        เพราะ `q` แยกคำด้วยช่องว่างแล้ว AND ทีละคำ ให้ใช้ tag ตัวอักษร (เช่นแปลงตัวเลขเป็น a–j) และรอ response ที่ `q` ตรงแล้ว **assert จำนวนผลที่คาด (เช่น `count === 1`) ก่อนใช้ผลการค้น** (หา option, เลือกแถว, อ่าน id ฯลฯ) เพื่อให้ล้มเร็วพร้อมสาเหตุ
        (แก้ถ้อยคำรอบ 34 — nit review #394: เดิมเขียนเฉพาะ "ก่อนหา option");
        test ที่ยังมีจุดอ่อนนี้: payout ใน `affiliate-admin-forms.spec.ts` (`"<tag> aff 249"`) → ADM-29 (กฎ 33, AC-34 — หัวข้อ "Follow-up รอบ 34")

### Acceptance criteria (รอบ 33)
- AC-33 (ADM-28, กฎ 32) `docs/evidence/admin-ui/ADM-28-tests.txt` มี: run id ที่อ่าน trace, บรรทัด/action ที่ค้างพร้อม call log, ข้อสรุปสาเหตุ (H ใด) — **ไม่มีข้อนี้ = ไม่ผ่าน**;
  e2e บน prod build (`pnpm --filter storefront build && start` แบบ CI, `workers=1`): `pnpm --filter storefront test:e2e e2e/affiliate-admin-forms.spec.ts -g "ปิด all โดยไม่เลือก scope" --repeat-each=20` ผ่าน 20/20 (แนบผลใน `ADM-28-tests.txt`; ไม่ใส่ `--` หน้า argument — ดู AC-160 ของ spec 01);
  ถ้าทำซ้ำอาการได้ในเครื่อง (เช่นด้วย `--repeat-each=20` บน develop หรือจำลองสาเหตุที่พบด้วย `page.route` หน่วง/ล้ม request ค้นหา) → แนบผลที่ล้มบน develop และผ่านหลังแก้ด้วยคำสั่งเดียวกัน;
  static (Playwright `unit` project ต่อใน `e2e/core-46-e2e-hygiene.unit.spec.ts`): body ของ test นี้ไม่มี `waitForTimeout` และ `test.setTimeout(` มีค่าไม่เกิน 120_000; `playwright.config.ts` ไม่เปลี่ยน; test อื่นในไฟล์ (AC-12 ตัวที่สอง, AC-31, AC-24d) ผ่าน

### Test plan (รอบ 33)
| ชนิด | AC |
|---|---|
| วิเคราะห์ trace + e2e admin `--repeat-each=20` + static | AC-33 (test-only หรือแก้โค้ด admin ≤ ~50 LOC ตามกฎ 32b — ไม่ต้องมี qa REPORT ถ้าไม่แตะ `src/admin/`; แตะ `src/admin/` → qa ตรวจ combobox ของฟอร์ม program) |

### Tasks (รอบ 33)
| Task | งาน | ไฟล์ที่แตะ | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-28 | (owner 2026-11-17 — CI #373/#388) หาสาเหตุ flaky ของ AC-12 ตัวแรก (`affiliate-admin-forms.spec.ts:47`) จาก trace ของ run 44071909424 ก่อน artifact หมดอายุ (~2026-12-01) แล้วแก้ตามสาเหตุ ห้ามแก้แค่เพิ่ม timeout (กฎ 32) — ☑ #393 (สาเหตุ: คำค้น `q` ของ Medusa แยกคำแล้ว AND — tag ตัวเลขที่มี "249" ทำให้ตรงทั้ง 250 รายการ; แก้ฝั่ง test) | `apps/storefront/e2e/affiliate-admin-forms.spec.ts` (+ `e2e/support/admin.ts` ถ้าต้องใช้ helper ร่วม), `e2e/core-46-e2e-hygiene.unit.spec.ts`, `docs/evidence/admin-ui/ADM-28-tests.txt`; เฉพาะเมื่อสาเหตุอยู่ในโค้ดของเรา: `components/affiliate/program-form.tsx` (≤ ~50 LOC) | test ~40 LOC (+ ≤ ~50 LOC ถ้าแก้โค้ด) | 1280×800 | AC-33 | PR เอกสารรอบ 33 merge; ไม่บล็อก release; **เริ่มเร็ว** (trace หมดอายุ) | ∥ CORE-64 (spec 01) — ไฟล์ร่วมที่เป็นไปได้: `e2e/core-46-e2e-hygiene.unit.spec.ts` ถ้า CORE-64 เลือกเพิ่ม unit ของ AC-163(c) ในไฟล์นี้ → ตัวที่ merge ทีหลัง merge `origin/develop` (คนละ test) |

## Follow-up รอบ 34 (2026-11-18 — owner สั่งเปิด task แก้ test payout)
Status: done (ปิดรอบ 34 2026-11-18 — ADM-29 ☑ #396; owner สั่งทำ 2026-11-18)
**ผล ADM-29 (`docs/evidence/admin-ui/ADM-29-tests.txt`)**: red — static AC-34 ล้มบนไฟล์เดิม (tag `adm9${Date.now()}` ไม่ผ่าน `.replace(/\d/g, …)`) และ e2e ที่บังคับ tag ให้มี "249" ล้มใน 2.0s ที่ assert `count` (ได้ 250 ไม่ใช่ 1) ไม่ใช่ timeout 120s ·
green — `--repeat-each=20` บน prod build ผ่าน 20/20, test อื่นในไฟล์ผ่าน 19/19, `test:e2e:unit` ผ่านทั้ง project (static ประเมินนิพจน์ tag จริงครอบ AC-12 ตัวแรกและ payout) · diff ไม่แตะ `playwright.config.ts`/`src/admin/`/backend
ที่มา: ROADMAP "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 33)" ข้อ ก (2) + ข้อ ข (nit review #393/#394) ·
อาการที่คาด (ยังไม่เคยล้มใน CI — จุดอ่อนแบบเดียวกับ ADM-28): test "AC-12/AC-21: ฟอร์มสร้าง payout …" ใน `apps/storefront/e2e/affiliate-admin-forms.spec.ts:167` ใช้ tag `adm9${Date.now()}` (`:170`) และคำค้น `"<tag> aff 249"` (`:202–205`);
`name`/`email` ของ affiliate เป็น `.searchable()` (`apps/backend/src/modules/affiliate/models/affiliate.ts:7–8`) และ `q` ของ Medusa 2.22.1 แยกคำแล้ว AND `ILIKE` ทีละคำ → ถ้า tag มี "249" ทั้ง 250 รายตรง, `aff 249` ไม่อยู่หน้าแรก → `click` option รอจน timeout 120s (โอกาส ~1% ต่อ run) ·
static ของ ADM-28 (`e2e/core-46-e2e-hygiene.unit.spec.ts:241–250`) ตรวจแค่ว่าไม่มีข้อความ `adm9${Date.now()}` ใน test AC-12 ตัวแรก — tag ตัวเลขรูปอื่นยังผ่าน และไม่ครอบ test payout

### What Medusa already gives us (รอบ 34)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ค้น affiliate ฝั่ง server | `q` ของ `GET /admin/affiliate/affiliates` (free-text filter ของ Medusa บน field `.searchable()`) + response `count` | ใช้ตามเดิม — แก้ฝั่ง test เท่านั้น |
| ตัวเลือก affiliate ในฟอร์ม payout | `useComboboxData` + `Combobox` ของ `@medusajs/dashboard` (กฎ 11, 28) | ใช้ตามเดิม — ไม่แตะ `src/admin/` |

### Data model / Workflows / API routes / Admin UI
none

### Business rules (รอบ 34)
33. (ADM-29 — owner 2026-11-18; ใช้กฎ 32f กับ test payout) แก้ test "AC-12/AC-21: ฟอร์มสร้าง payout …" ของ `e2e/affiliate-admin-forms.spec.ts` ฝั่ง test เท่านั้น:
    (a) tag ไม่มีตัวเลข: แปลงตัวเลขของ `Date.now()` เป็นตัวอักษร a–j แบบเดียวกับ AC-12 ตัวแรก (`:57`) — ผู้ใช้ครบ 2 ที่แล้ว จะย้ายเป็น helper ร่วมใน `e2e/support/` ก็ได้ (ไม่บังคับ;
        ถ้าย้ายให้ AC-12 ตัวแรกเปลี่ยนเฉพาะบรรทัดประกาศ tag ไปเรียก helper); ค่าอื่นที่อิง tag (`aff_<tag>_%` ใน `finally`, `affiliate_id` ที่คาด) ต้องยังตรงกัน;
    (b) รอ response ของ `GET /admin/affiliate/affiliates` ที่ pathname ตรงและ `q` ตรงกับคำค้น (เดิมตรวจแค่ `q` — `:202`) แล้ว assert `count` = 1 (ข้อความ assert มีคำค้น) **ก่อน**หา/คลิก option;
    (c) ห้ามเพิ่ม `test.setTimeout`/timeout ต่อ action ที่ยาวขึ้น/`waitForTimeout`/`retries`/`test.fixme`/`skip` และห้ามแก้ `playwright.config.ts` (กฎ 32c ใช้ด้วย);
    (d) static ใน `e2e/core-46-e2e-hygiene.unit.spec.ts` ปรับ test ของ AC-33 (หรือเพิ่ม test ใหม่ที่แทนส่วนนั้น) ให้ตรวจ **"tag ไม่มีตัวเลข"** ครอบทั้งสอง test (AC-12 ตัวแรก และ payout) — ตรวจผลจริง ไม่ใช่แค่ไม่มีข้อความเดิม:
        ดึงนิพจน์ `const tag = …` จาก body ของแต่ละ test แล้ว (1) ถ้ามี `Date.now()` ต้องผ่าน `.replace(/\d/g, …)` ในนิพจน์เดียวกัน หรือ (2) ถ้าใช้ helper ร่วม → unit เรียก helper จริงหลายครั้งแล้ว `expect(tag).not.toMatch(/\d/)` และตรวจว่าทั้งสอง body เรียก helper นั้น;
        และ body ทั้งสองมี `searchParams.get("q")` คู่กับ assert `.count` เป็น `toBe(1)`; ส่วนตรวจ `waitForTimeout`/`setTimeout ≤ 120_000` เดิมคงไว้และใช้กับ test payout ด้วย;
    (e) ไม่แก้ test อื่นในไฟล์ (AC-12 ตัวที่สอง, AC-21 ตัวอื่น, AC-29, AC-31, ADM-27) และไม่เปลี่ยน testid; ไม่แตะ `src/admin/` และ backend

### Acceptance criteria (รอบ 34)
- AC-34 (ADM-29, กฎ 33)
  (a) red ก่อนแก้: static ของกฎ 33d รันบนไฟล์เดิมแล้วล้ม (test payout ยังใช้ `adm9${Date.now()}`); และ e2e test payout ที่แก้แล้วแต่**บังคับ tag ชั่วคราวให้มี "249"** (เช่นต่อท้าย `249` ในเครื่องเท่านั้น ไม่ commit) ล้ม**เร็ว**ที่ assert `count` (ได้ 250 ไม่ใช่ 1 — ข้อความมีคำค้น) ไม่ใช่ timeout ของ test — แนบผลทั้งสองใน `docs/evidence/admin-ui/ADM-29-tests.txt`;
  (b) green: `pnpm --filter storefront test:e2e:unit` ผ่านทั้ง project; e2e บน prod build (`pnpm --filter storefront build && start` แบบ CI, `workers=1`):
      `pnpm --filter storefront test:e2e e2e/affiliate-admin-forms.spec.ts -g "ฟอร์มสร้าง payout" --repeat-each=20` ผ่าน 20/20 (ไม่ใส่ `--` หน้า argument — AC-160 ของ spec 01) และ test อื่นในไฟล์ผ่าน 1 รอบ — แนบผลใน `ADM-29-tests.txt`;
  (c) diff ไม่มี `playwright.config.ts`, `src/admin/`, `apps/backend/`; ไม่มี `waitForTimeout`/`retries`/`skip`/`fixme` ใหม่ (ตรวจโดย static ของ (b) + reviewer)

### Test plan (รอบ 34)
| ชนิด | AC |
|---|---|
| static (Playwright `unit` project) + e2e admin `--repeat-each=20` บน prod build | AC-34 — test-only ไม่แตะ `src/admin/` → ไม่ต้องมี qa REPORT (แบบ ADM-28) |

### Tasks (รอบ 34)
| Task | งาน | ไฟล์ที่แตะ | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-29 | (owner 2026-11-18 — ROADMAP ปิดรอบ 33 ข้อ ก (2) + nit review #393/#394) test payout ใน `affiliate-admin-forms.spec.ts` ใช้ tag ตัวอักษร + รอ response `q` แล้ว assert `count` = 1 ก่อนใช้ผล; static ตรวจ "tag ไม่มีตัวเลข" ครอบทั้ง AC-12 ตัวแรกและ payout (กฎ 33) — ☑ #396 (tag ตัวอักษร a–j + assert `count` = 1 ของ `GET /admin/affiliate/affiliates?q=` ก่อนเลือก option; static ประเมินนิพจน์ tag จริงครอบทั้งสอง test) | `apps/storefront/e2e/affiliate-admin-forms.spec.ts`, `apps/storefront/e2e/core-46-e2e-hygiene.unit.spec.ts` (+ `e2e/support/*.ts` ถ้าแยก helper tag), `docs/evidence/admin-ui/ADM-29-tests.txt` | test-only ~15–30 LOC | 1280×800 | AC-34 | PR เอกสารรอบ 34 merge; ไม่บล็อก release | ไม่มี task อื่นที่เปิดอยู่แตะไฟล์เหล่านี้ |

## Follow-up รอบ 36 (2026-11-18 — planner รวบ follow-up ปิดรอบ 34/35 + review #388)
Status: done (ปิดรอบ 36 2026-11-18 — ADM-30 ☑ #402, ADM-31 ☑ #404; owner สั่งทำ 2026-11-18 — test hygiene + a11y ไม่เปลี่ยน business rule/หน้าตา; ไม่บล็อก release) · Out of scope: รวม `sql()`/`new Client` ของ e2e เป็น helper กลาง (ดูหมายเหตุท้ายกฎ 34),
เพิ่ม `FocusModal.Description`/`Drawer.Description` (คำเตือน `Missing Description` เป็น `console.warn` ของ Radix — เพิ่มข้อความต้องตัดสิน UX), ย้ายไป `RouteFocusModal` (Q5 คงเดิม), แก้ `@medusajs/ui`
**ผล ADM-30 (`docs/evidence/admin-ui/ADM-30-tests.txt`)**: static เดิมผ่านบนสำเนาที่ถูก mutate (comment assert `count`, ตัด `pathname`, ลบ `softSql` ของ `affiliate`) = vacuous จริง; red — self-check ใหม่ล้ม 2 เคสเมื่อใช้ตรรกะเดิม, static ใหม่ล้มกับ predicate ที่สร้าง `new URL(` สองครั้ง และล้มกับ mutation M1–M3 ทุกกรณี ·
green — `test:e2e:unit` 118/118, `affiliate-admin-forms.spec.ts` บน prod build 19/19; diff แตะ 2 ไฟล์ test เท่านั้น
**ผล ADM-31 (`docs/evidence/admin-ui/ADM-31-tests.txt`, qa `docs/evidence/admin-ui/ADM-31/REPORT.md`)**: red — static 0/5, e2e `admin-dialog-title` ล้ม 4/4 · green — static ผ่าน, e2e 4/4 + e2e admin เดิม 6 ไฟล์ (รวม 61/61 ของ qa);
qa: screenshot dialog PR เทียบ develop ต่างกัน 0 px ครบ 6 ฟอร์ม, console error `DialogTitle` 0 (develop มีทุกฟอร์ม), accessible name ตรงหัวข้อทุกฟอร์ม; defect ไม่พบ ·
ข้อสังเกต qa → ROADMAP follow-up ปิดรอบ 36: focus ไม่กลับปุ่ม "Create partner" หลังปิด (O-1, มีบน develop), Escape ระหว่าง animation เปิดถูกเพิกเฉย (O-2, Radix)

ที่มา (ตรวจบน develop `14837f04`):
- review #396 (ROADMAP ปิดรอบ 34 ข้อ ข): static ของกฎ 33d (`apps/storefront/e2e/core-46-e2e-hygiene.unit.spec.ts:248–266`) match `/\.count\b[^\n]*\)\.toBe\(1\)/` (`:260`) และ `searchParams.get("q")` (`:259`) บน body ดิบ —
  บรรทัด assert ที่ถูก comment (`// expect(…count…).toBe(1)`) ยังผ่าน; ไม่บังคับว่า predicate ของ `waitForResponse` ตรวจ `pathname` (กฎ 33b ตรวจโดย reviewer อย่างเดียว);
  predicate ใน `affiliate-admin-forms.spec.ts:90–92` และ `:204–206` สร้าง `new URL(r.url())` สองครั้ง
- review #388 (ROADMAP ปิดรอบ 32 ข้อ ข "unit ของกฎข้อ 119c vacuous") — ยังเป็นจริง: static ของ spec 01 กฎข้อ 119c (`core-46-e2e-hygiene.unit.spec.ts:231–239`) ตรวจ `/\bfinally\s*\{/` ทั้งไฟล์ —
  ตรงกับ `finally` ของ helper `sql()` (`affiliate-admin-payout-create.spec.ts:39`) อยู่แล้ว; และไฟล์นี้ไม่มี `request.delete(` (cleanup ใช้ `softSql` `:198–206`) → `deletes` = `checked` = 0 ผ่านเสมอ แม้ลบ cleanup ทิ้งทั้งหมด
- qa #399 O-1: console error ของ Radix "`DialogContent` requires a `DialogTitle`" ตอนเปิด Create partner — ทุก `FocusModal` ของเราใช้ `<Heading>` ธรรมดาเป็นหัวข้อ (เช่น `partners-section.tsx:294`) โดยไม่มี `FocusModal.Title` (5 จุด — เลขบรรทัดชี้ `FocusModal.Content` บน `14837f04`:
  `components/evoucher/partners-section.tsx:285`, `components/affiliate/program-form.tsx:143`, `components/affiliate/payout-form.tsx:90`, `components/group-buy/create-campaign.tsx:163`, `widgets/variant-evoucher-pool.tsx:155`)
  → dialog ไม่มีชื่อสำหรับ screen reader; `Drawer` ทุกตัวมี `Drawer.Title` อยู่แล้ว (`widgets/flash-sale-options.tsx:159`, `codes-table.tsx:203`, `payout-info-drawer.tsx:78`, `partners-section.tsx:308`)

### What Medusa already gives us (รอบ 36)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ชื่อของ dialog (a11y) | `FocusModal.Title` ของ `@medusajs/ui` 4.2.8 (`focus-modal.d.ts:34` — `RadixDialog.Title` รับ `asChild`) | ใช้ตามเดิม — ห่อ `Heading` เดิมด้วย `asChild` ไม่สร้าง wrapper/component ใหม่ (ลำดับ ADR-018: primitive ของ `@medusajs/ui`; dashboard ไม่ export ตัวแทนสำหรับ modal แบบ state — Q5) |
| ตรวจ static/ e2e | Playwright `unit` project + jest ของ `src/admin/__tests__` (ของเรา) | ใช้ตามเดิม |

### Data model / Workflows / API routes
none

### Business rules (รอบ 36)
34. (ADM-30 — test-only; review #396, #388) static ใน `e2e/core-46-e2e-hygiene.unit.spec.ts` ต้องล้มเมื่อสิ่งที่ตรวจหายไป:
    (a) กฎ 33d: ตัด comment (`// …` ถึงท้ายบรรทัด และ `/* … */`) ออกจาก body ของ test ก่อน match — assert `.count … toBe(1)` หรือ `searchParams.get("q")` ที่ถูก comment ไว้ต้องทำให้ static ล้ม;
        มี self-check ด้วย body ตัวอย่างในไฟล์ unit (แบบ `expect(() => testBody("const x = 1", …)).toThrow()` ที่ `:213`) ว่า body ที่ assert ถูก comment ไว้ไม่ผ่าน;
    (b) กฎ 33b อัตโนมัติ: ใน body ของทั้งสอง test (AC-12 ตัวแรก, payout) predicate ของ `waitForResponse` ที่มี `searchParams.get("q")` ต้องมีการเทียบ `pathname ===` ใน predicate เดียวกัน (self-check: predicate ที่ไม่มี pathname ไม่ผ่าน);
    (c) `e2e/affiliate-admin-forms.spec.ts` predicate ทั้งสอง (`:90–92`, `:204–206`) สร้าง `new URL(r.url())` ครั้งเดียวต่อการเรียก — สิ่งที่ตรวจเท่าเดิม (pathname + `q`);
    (d) static ของ spec 01 กฎข้อ 119c: ตรวจ**เฉพาะ `finally` ของ test AC-44** (ไม่ใช่ทั้งไฟล์) ว่ามี `softSql(` ที่ลบ `affiliate_payout` → `affiliate_commission_entry` → `affiliate` → `affiliate_program` ตามลำดับนี้ และ `expect.soft(` ของจำนวน affiliate ที่เหลือ;
        คงการตรวจ `request.delete(` ที่ไม่ตรวจ `ok()` ไว้ (ใช้เมื่อมี delete); self-check: `finally` ที่ไม่มี `softSql` ลบ `affiliate` ไม่ผ่าน;
    (e) ห้ามเพิ่ม `waitForTimeout`/timeout/`retries`/`skip`/`fixme`; ไม่แตะ `src/admin/`, `apps/backend/`, `playwright.config.ts`; ไม่แก้ test อื่นในไฟล์ e2e
    — หมายเหตุ: `sql()` แบบ `new Client` มีสำเนาใน e2e ~15 ไฟล์ (ไม่ใช่ 3 ตามที่ review #388 นับ) → รวมเป็น helper กลางแตะไฟล์กว้างและไม่แก้บั๊ก จึงไม่อยู่ใน ADM-30 (backlog — ROADMAP)
35. (ADM-31 — a11y; qa #399 O-1) ทุก `FocusModal` ใต้ `src/admin/` มี `FocusModal.Title` ของ `@medusajs/ui` ห่อ heading เดิมด้วย `asChild` (เช่น `<FocusModal.Title asChild><Heading>Create partner</Heading></FocusModal.Title>`):
    (a) ข้อความ, ระดับ heading, className และตำแหน่งเท่าเดิม — หน้าตาไม่เปลี่ยน; ไม่เปลี่ยน testid/label;
    (b) dialog มี accessible name (`aria-labelledby` ชี้ id ของ heading) และ Radix ไม่ log `console.error` ที่มีคำ `DialogTitle`;
    (c) ไม่สร้าง component/hook ใหม่; ไม่แตะ `Drawer` (มี `Drawer.Title` แล้ว) และ `usePrompt` ของ Medusa;
    (d) พฤติกรรม Escape/prompt ของกฎ 30, 31 และกันกดซ้ำคงเดิม — e2e admin เดิมผ่านโดยไม่แก้;
    (e) `FocusModal` ใหม่ในอนาคตต้องมี `FocusModal.Title` (static ของ AC-36a บังคับ)

### Acceptance criteria (รอบ 36)
- AC-35 (ADM-30, กฎ 34)
  (a) red: self-check ของกฎ 34a/34b/34d (body ตัวอย่างที่ assert ถูก comment, predicate ไม่มี pathname, `finally` ไม่มี cleanup) — static แบบเดิม (`:231–239`, `:248–266`) **ผ่าน**ตัวอย่างเหล่านี้ (vacuous) และแบบใหม่ล้ม;
      แสดงใน `docs/evidence/admin-ui/ADM-30-tests.txt`: รัน static แบบใหม่บน**สำเนาในเครื่อง**ของ `affiliate-admin-forms.spec.ts` ที่ comment บรรทัด assert `count` (ไม่ commit) → ล้ม; สำเนาของ `affiliate-admin-payout-create.spec.ts` ที่ลบ `softSql` ลบ `affiliate` ออก → ล้ม;
  (b) green: `pnpm --filter storefront test:e2e:unit` ผ่านทั้ง project; `pnpm --filter storefront test:e2e e2e/affiliate-admin-forms.spec.ts` บน prod build (แบบ CI, `workers=1`) ผ่าน 1 รอบ (ไม่ใส่ `--` หน้า argument — spec 01 AC-160);
  (c) diff ไม่มี `src/admin/`, `apps/backend/`, `playwright.config.ts`; ไม่มี `waitForTimeout`/`retries`/`skip`/`fixme` ใหม่
- AC-36 (ADM-31, กฎ 35)
  (a) static ใน `apps/backend/src/admin/__tests__/medusa-ui.unit.spec.ts` — **ล้มบน develop `14837f04`** (0/5): ทุกไฟล์ใต้ `src/admin/` ที่มี `<FocusModal.Content` มี `<FocusModal.Title` จำนวนเท่ากับ `<FocusModal.Content` และ `FocusModal.Title` มี `asChild`;
  (b) e2e ใหม่ `e2e/admin-dialog-title.spec.ts` (`evidenceTarget` `ADM-31`, 1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`) — **ล้มบน develop**: เปิดฟอร์ม Create partner (`/app/evouchers`), Create program และ Create payout (`/app/affiliate`), Create campaign (`/app/group-buying`)
      ด้วยปุ่มตามกฎ 7c/18 แล้วหา dialog จาก testid ของ element ในฟอร์ม (`locator("xpath=ancestor::*[@role='dialog']")` — ไม่หาด้วยข้อความ) → `toHaveAccessibleName(/\S/)`;
      และ `console` type `error` ที่มีคำ `DialogTitle` ตลอด test = 0 (เก็บด้วย `page.on("console")`); `widgets/variant-evoucher-pool.tsx` ครอบด้วย (a) เท่านั้น;
  (c) e2e admin เดิม (`evoucher-admin-forms`, `affiliate-admin-forms`, `affiliate-admin-payout-create`, `group-buy-admin-form`, `admin-form-discard-prompt`, `evoucher-admin-pool-page`) ผ่านโดยไม่แก้ (CI `storefront-e2e`);
  (d) qa REPORT `docs/evidence/admin-ui/ADM-31/REPORT.md`: ฟอร์มทั้ง 4 หน้าตาเท่าเดิม (screenshot ≤ 2), console ไม่มี error `DialogTitle`, accessible name ของ dialog ตรงหัวข้อของฟอร์ม (ตรวจโดย qa — ไม่ใช้เป็น locator)

### Test plan (รอบ 36)
| ชนิด | AC |
|---|---|
| static (Playwright `unit` project) + self-check + e2e admin 1 รอบบน prod build | AC-35 — test-only ไม่แตะ `src/admin/` → ไม่ต้องมี qa REPORT (แบบ ADM-28/29) |
| unit static (jest `src/admin/__tests__`) + e2e ใหม่ + e2e admin เดิมใน CI + qa | AC-36 |

### Tasks (รอบ 36)
| Task | งาน | ไฟล์ที่แตะ | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-30 | (รอบ 36 — review #396, #388) static ของกฎ 33 ตัด comment ก่อน match + บังคับ `pathname` ใน predicate; static ของ spec 01 กฎข้อ 119c ตรวจ `finally` ของ AC-44 จริง; `new URL` ครั้งเดียวใน predicate (กฎ 34) — ☑ #402 (owner สั่งทำ 2026-11-18; static ใหม่ล้มกับ mutation ทุกกรณี) | `apps/storefront/e2e/core-46-e2e-hygiene.unit.spec.ts`, `apps/storefront/e2e/affiliate-admin-forms.spec.ts`, `docs/evidence/admin-ui/ADM-30-tests.txt` | test-only ~50–80 LOC | 1280×800 | AC-35 | PR เอกสารรอบ 36 merge; ไม่บล็อก release | ∥ ADM-31, OPS-28, OPS-29 (ไม่มีไฟล์ร่วม) |
| ADM-31 | (รอบ 36 — qa #399 O-1) `FocusModal.Title asChild` ห่อ heading ของฟอร์ม `FocusModal` 5 จุด + static + e2e accessible name/console (กฎ 35) — ☑ #404 (owner สั่งทำ 2026-11-18; qa: หน้าตาต่าง 0 px, console `DialogTitle` 0) | `src/admin/components/evoucher/partners-section.tsx`, `src/admin/components/affiliate/program-form.tsx`, `src/admin/components/affiliate/payout-form.tsx`, `src/admin/components/group-buy/create-campaign.tsx`, `src/admin/widgets/variant-evoucher-pool.tsx`, `src/admin/__tests__/medusa-ui.unit.spec.ts`, `apps/storefront/e2e/admin-dialog-title.spec.ts` (ใหม่), `docs/evidence/admin-ui/ADM-31/REPORT.md` (qa — session หลัก commit) | ~20 LOC โค้ด + ~80 LOC test | 1280×800 | AC-36 | PR เอกสารรอบ 36 merge; ไม่บล็อก release | ∥ ADM-30, OPS-28, OPS-29 (ไม่มีไฟล์ร่วม) |

## Follow-up รอบ 36 ส่วนที่ 2 (2026-11-18 — owner ตอบข้อ UX กลุ่ม ค = ข "ตรวจซ้ำบน develop แล้วเปิด task เฉพาะข้อที่ยังจริง")
Status: done (ปิดรอบ 36 2026-11-18 — ADM-32 ☑ #408, ADM-33 ☑ #409; owner สั่งทำ 2026-11-18 ตามคำตอบ ข; ไม่บล็อก release) · Out of scope: ย้ายกฎข้าม field/ช่องบังคับว่างของฟอร์ม campaign (Name, End date, Team duration เมื่อ team/both, Percentage > 100) จาก toast ไปใต้ช่อง,
parse ข้อความ 400 ของ backend เข้า field, ข้อความ 400 ของ `status` ที่มาจาก zod union (ปิด — ดู "ไม่เปิด task" ข้างล่าง), แก้/patch `@medusajs/ui`, เปิด issue upstream
**ผล ADM-32 (`docs/evidence/admin-ui/ADM-32-tests.txt`, qa `docs/evidence/admin-ui/ADM-32/REPORT.md`)**: red — unit ล้ม 37 เคส (7 ช่อง × 5 ค่า + `discount_value` −10/0), e2e AC-37b ล้มที่ `gb-max-total-orders-error` ไม่ visible ·
green — unit 107/107, e2e AC-37b/c + e2e admin เดิม (`--repeat-each=3` ของ qa 3/3); qa ตาราง 8 ช่อง × 8 ค่าบน prod build: error ใต้ช่อง + `aria-invalid` ครบ, toast 0, POST 0; 2147483647 → POST 200; defect ไม่พบ ·
ข้อสังเกต qa → ROADMAP follow-up ปิดรอบ 36: `discount_value` แบบ fixed ไม่มีเพดาน (O-1 — 1e20 THB สร้างได้ backend 200), ช่องบังคับว่างขึ้น product error ก่อน (O-2, พฤติกรรมเดิม), `NumberInput` รับ `1e3` (O-3)
**ผล ADM-33 (`docs/evidence/admin-ui/ADM-33-tests.txt`, qa `docs/evidence/admin-ui/ADM-33/REPORT.md`)**: red — static 0/5 (self-check ผ่าน), e2e `admin-row-menu-escape` ล้ม 5/5 ที่ menu ยังเปิดหลัง Escape ครั้งเดียว, `closeRowMenu` แบบครั้งเดียวบน develop ล้ม 4/5 ·
green — static 7/7, e2e `--repeat-each=10` 50/50, `closeRowMenu` เปลี่ยนเป็น Escape ครั้งเดียว (กฎ 37c — ผ่าน 50/50 + 20/20; `settled()` นับ animation ที่ถูกยกเลิกว่าจบ), e2e admin เดิม 26/26; qa: Escape ครั้งเดียวปิด 30/30 ครบ 5 ตาราง (develop ค้าง 19/30), ตำแหน่งปุ่มเท่าเดิม; defect ไม่พบ ·
ข้อสังเกต qa → ROADMAP follow-up ปิดรอบ 36: Escape ภายใน 1 frame แรกยังค้าง (O-2 — หน่วง 16ms ไม่ค้าง; `/app/products` ไม่ค้าง), ชื่อยาวมากดันปุ่ม `…` ออกนอก viewport (O-1 — layout ของ `DataTable`, มีบน develop)
ที่มา: ROADMAP หัวข้อ "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 30/31)" กลุ่ม ค — qa ตรวจซ้ำบน develop `8425a53f` (prod build, 2026-11-18): ข้อ 1 (ฟอร์ม campaign) และข้อ 3 (Escape 2 ครั้ง) **ยังจริง**; ข้อ 2 ปิด; ข้อ 4 → spec 01 CORE-65; ข้อ 5 ปิด
- ข้อ 1: `max_total_orders` = `-1`/`1.5`/`0` → ไม่มี POST แต่ error เป็น toast ใต้ช่องไม่มี error (`aria-invalid="false"`; ค่า "e" ได้ error ใต้ช่องตามกฎ 19a); `target_value` `-3`, `discount_value` `-10` เป็น toast เช่นกัน;
  `2147483648` → backend 400 (GB-17) toast ข้อความดิบ; `99999999999999999999` → toast สองท่อน — ต้นเหตุ: `lib/group-buy-form.ts:18` `numberText` ตรวจแค่ `BAD_NUMBER_INPUT`, `:72–80` `intOrNull` throw `FormError` ไม่ระบุ field, `:64` `FormField` มีแค่ `max_quantity`/`product`;
  `components/group-buy/create-campaign.tsx:115–122` error อื่นไป toast, `:109` toast ข้อความ API
- ข้อ 3: เปิดเมนูต่อแถว → Escape → เปิดเมนูแถวเดิม/แถวอื่นอีก (หรือ focus ปุ่ม + Enter) → Escape 1 ครั้งเมนูยังเปิดและ body `pointer-events: none` — 6/6 ที่ partners และ programs (`/app/products` ของ Medusa ปิดใน 1 ครั้ง);
  ต้นเหตุ (ตรวจ source `@medusajs/ui` 4.2.8 แล้ว): `dist/esm/blocks/data-table/components/data-table-table.js:322–356` `renderAlignedCell` ห่อทุก cell ด้วย `TruncatedCell` (`Tooltip` ที่ `hidden` แต่ยัง mount)
  เว้นแต่ `meta.___truncateTooltip === false` (`:327`); tooltip เปิดเมื่อ focus กลับมาที่ปุ่ม trigger แล้วรับ Escape แรก (ตรงกับ ADM-23 REPORT O-1 "`[data-radix-popper-content-wrapper]` ค้าง 1 ตัว");
  option สาธารณะ `truncateTooltip` มีเฉพาะ `accessor` (`utils/create-data-table-column-helper.js:10–14`) ส่วน `display` ส่ง def ตรงให้ tanstack → ตั้งผ่าน `meta` (`DataTableTruncatableColumnDefMeta` ใน `types.d.ts:71–73`)

### What Medusa already gives us (รอบ 36 ส่วนที่ 2)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| error ใต้ช่อง + `aria-invalid` | `Form`/`Form.Field`/`Form.Control`/`Form.ErrorMessage` ของ `@medusajs/dashboard/components` + `zodResolver` (ใช้อยู่แล้วใน `create-campaign.tsx`) | ใช้ตามเดิม — ย้ายเงื่อนไขรูปค่าเข้า `campaignFormSchema` อย่างเดียว ไม่สร้าง component |
| เพดาน int4 | `INT4_MAX` ของเรา (`apps/backend/src/lib/int4.ts`, GB-17) | ใช้ค่าเดิม (admin import จาก `src/lib`/`src/modules` อยู่แล้ว เช่น `lib/affiliate-account.ts:2`) — ไม่ประกาศค่าใหม่ |
| error ที่ไม่ผูกช่อง | `toast` ของ `@medusajs/ui` (แบบหน้าของ Medusa) | ใช้ตามเดิมสำหรับ 400 ที่ schema ไม่ครอบ |
| ปิด tooltip ของ cell | `meta.___truncateTooltip: false` ของ `DataTable` `@medusajs/ui` 4.2.8 (opt-out ที่ Medusa ออกแบบไว้ "for cells that manage their own overflow" — `types.d.ts:63–69`) | ใช้ตามเดิมในคอลัมน์ actions — ไม่ patch library ไม่ห่อ column helper |
| เมนูต่อแถว | `ActionMenu` ของ `@medusajs/dashboard/components` | ใช้ตามเดิม |

### Data model / Workflows / API routes
none

### Business rules (รอบ 36 ส่วนที่ 2)
36. (ADM-32 — owner ข 2026-11-18; qa รอบ 36 ข้อ 1, เดิม qa #374 O-1) ฟอร์ม Create campaign แสดง error **รูปค่า**ของช่องตัวเลขใต้ช่อง:
    (a) `campaignFormSchema` (`lib/group-buy-form.ts`): ช่องจำนวนเต็ม 7 ช่อง (`target_value`, `team_duration_hours`, `max_total_orders`, `max_units_per_person`, `max_people_per_group`, `pay_within_hours`, `max_quantity`)
        เมื่อค่าไม่ว่าง ต้อง `Number.isInteger(n) && n > 0` (ไม่เช่นนั้นข้อความเดิม `wholeNumberMessage(label)`) และ `n ≤ INT4_MAX` จาก `src/lib/int4.ts`
        (ไม่เช่นนั้น `` `${label} must be at most ${INT4_MAX}` ``); `BAD_NUMBER_INPUT` คงข้อความเดิม (กฎ 19a); ค่าว่างยังผ่าน schema — ช่องบังคับตัดสินใน `toCampaignBody` ตามเดิม;
    (b) `discount_value` เมื่อไม่ว่างต้อง `> 0` (ทศนิยมได้) ไม่เช่นนั้น `DISCOUNT_VALUE_MESSAGE` ใต้ช่อง;
    (c) แสดงด้วย `Form.ErrorMessage` ที่มีอยู่ (ช่องได้ `aria-invalid="true"` จาก `Form.Control`); testid: คง `gb-max-quantity-error`, `gb-max-total-orders-error` และเพิ่ม
        `gb-target-value-error`, `gb-team-duration-hours-error`, `gb-max-units-per-person-error`, `gb-max-people-per-group-error`, `gb-pay-within-hours-error`, `gb-discount-value-error` ใน `ERROR_TESTIDS`;
        error ใต้ช่องไม่ส่ง POST และไม่มี toast;
    (d) `toCampaignBody` คงการตรวจเดิม (unit เดิมผ่านโดยไม่แก้ assertion); กฎข้าม field/ช่องบังคับว่างคงช่องทางเดิม (Out of scope);
    (e) 400 จาก backend คง `toast.error(e.message)` ใน `onError` (`create-campaign.tsx:109`) — ไม่ parse ข้อความ backend;
    (f) ไม่สร้าง component/hook ใหม่, ไม่แตะ backend (validator ของ GB-17 ครอบแล้ว), ไม่เปลี่ยน testid เดิม/label
37. (ADM-33 — owner ข 2026-11-18; qa รอบ 36 ข้อ 3, เดิม ADM-23 REPORT O-1, ADM-8b) เมนู `ActionMenu` ในคอลัมน์ actions ของ `DataTable` ปิดด้วย Escape **ครั้งเดียว**ทุกครั้ง:
    (a) คอลัมน์ `display` ที่ `id: "actions"` ทั้ง 5 ตาราง (ตรวจบน develop `8425a53f` — ทุก `ActionMenu` ใน `DataTable` ของเรา):
        `components/evoucher/partners-section.tsx:203`, `components/evoucher/codes-table.tsx:127`, `components/affiliate/programs-table.tsx:96`, `components/affiliate/affiliates-table.tsx:122`, `components/affiliate/payouts-table.tsx:111`
        ใส่ `meta: { ___truncateTooltip: false }` แบบ inline + comment อ้างกฎนี้ (ไม่สร้าง helper/wrapper; `ActionMenu` ใน `components/common/header.tsx:45` ไม่อยู่ใน `DataTable` — ไม่แตะ); คอลัมน์ accessor คง tooltip เดิม;
    (b) หน้าตา/ตำแหน่งปุ่มเท่าเดิม; testid ของ trigger, กันกดซ้ำ, `cell` คงที่ข้าม render (กฎ 20a) และ remount เมนูระหว่างลบ (กฎ 27) คงเดิม;
    (c) `closeRowMenu` (`apps/storefront/e2e/support/admin.ts:89–94`): หลังแก้ ถ้า e2e ของ AC-38(b) และ spec ที่เรียก `closeRowMenu` (`affiliate-admin-row-actions`, `affiliate-admin-affiliates`) ผ่าน `--repeat-each=10` ด้วย Escape ครั้งเดียว
        → เปลี่ยนเป็นกด Escape ครั้งเดียวแล้ว `expect(page.getByRole("menu")).toHaveCount(0)` (ไม่วน `toPass`) และแก้ comment; ถ้าไม่ผ่าน → คง `toPass` และบันทึกสาเหตุที่เหลือ (เช่นจังหวะ animation ใน ADM-8b REPORT) ใน comment และ `ADM-33-tests.txt`;
        ห้ามเพิ่ม `waitForTimeout`/timeout/`retries`/`skip`/`fixme`;
    (d) `ActionMenu` ในคอลัมน์ของ `DataTable` ที่เพิ่มในอนาคตต้องมี meta นี้ (static ของ AC-38a บังคับ) — bump `@medusajs/ui` ต้องตรวจว่าชื่อ `___truncateTooltip` ยังใช้ได้ (e2e ของ AC-38b จะล้มถ้าไม่ได้)

### Acceptance criteria (รอบ 36 ส่วนที่ 2)
- AC-37 (ADM-32, กฎ 36)
  (a) unit jest `src/admin/lib/__tests__/group-buy-form.unit.spec.ts` — **ล้มบน develop**: ทุกช่องของกฎ 36a ค่า `-1`, `1.5`, `0`, `2147483648`, `99999999999999999999` →
      `campaignFormSchema.safeParse({ ...emptyCampaignForm(), [field]: v }, CAMPAIGN_PARSE_OPTIONS)` ไม่สำเร็จและมี issue ที่ `path` = `[field]` (สองค่าหลังข้อความมี `2147483647`);
      `"1"`, `"2147483647"`, `""` → ไม่มี issue ที่ path นั้น; `discount_value` `-10`, `0` → issue ที่ `["discount_value"]`, `0.5` → ไม่มี; unit เดิมของ `toCampaignBody` ผ่านโดยไม่แก้ assertion;
  (b) e2e test ใหม่ใน `e2e/group-buy-admin-form.spec.ts` (`evidenceTarget` `ADM-32`, 1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`) — **ล้มบน develop**: กรอกฟอร์มที่ถูกต้องครบ (helper เดิมของไฟล์) แล้วแทน `max_total_orders` ทีละค่าตาม (a) แล้วส่ง →
      `gb-max-total-orders-error` visible, `gb-field-max_total_orders` มี `aria-invalid="true"`, `[data-sonner-toast]` count 0, POST `/admin/group-buy/campaigns` 0 ครั้ง (นับด้วย `page.on("request")`);
      `target_value` `-3` → `gb-target-value-error`; `discount_value` `-10` → `gb-discount-value-error` (POST 0 ครั้งทุกกรณี); สุดท้าย `max_total_orders` = `2147483647` → POST 1 ครั้ง body `max_total_orders` = 2147483647 และ response 200 (ลบแคมเปญที่สร้างใน `finally` ตาม pattern เดิมของไฟล์);
  (c) e2e: 400 ที่ schema ไม่ครอบยังเป็น toast — `page.route` ดัก `POST` `/admin/group-buy/campaigns` ตอบ 400 `{ type: "invalid_data", message: "<ข้อความของ test>" }` → `[data-sonner-toast]` ที่มีข้อความของ test = 1,
      ใน dialog ไม่มี element ที่ testid ขึ้นต้น `gb-` และลงท้าย `-error` ที่ visible, `gb-campaign-create-submit` ยัง visible (modal ไม่ปิด);
  (d) e2e admin เดิม (`group-buy-admin-form` test อื่น, `admin-form-discard-prompt`, `admin-dialog-title` ของ ADM-31) ผ่านโดยไม่แก้ assertion (CI `storefront-e2e`);
  (e) qa REPORT `docs/evidence/admin-ui/ADM-32/REPORT.md`: error ใต้ช่องของ `max_total_orders` (`-1` และ `2147483648`) และ toast ของ 400 — screenshot ≤ 2
- AC-38 (ADM-33, กฎ 37)
  (a) static jest ใน `src/admin/__tests__/medusa-ui.unit.spec.ts` — **ล้มบน develop** (0/5): ทุกไฟล์ใต้ `src/admin/` (ไม่รวม `__tests__`) ทุก `.display({` ที่มี `id: "actions"` มี `___truncateTooltip: false` ใน object เดียวกัน
      และจำนวนที่พบ ≥ 5 (กัน vacuous); self-check: object ตัวอย่างที่ไม่มี meta ไม่ผ่าน;
  (b) e2e ใหม่ `e2e/admin-row-menu-escape.spec.ts` (`evidenceTarget` `ADM-33`, 1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`) — **ล้มบน develop**: ทั้ง 5 ตาราง (partners และ codes ของ e-voucher, programs/affiliates/payouts ของ affiliate)
      สร้างข้อมูล ≥ 1 แถวผ่าน admin API; ขั้น: คลิก trigger (testid เดิมในแถว) → `getByRole("menu")` 1 → Escape → 0 → คลิก trigger เดิมอีกครั้ง → 1 → **Escape ครั้งเดียว** → `getByRole("menu")` 0 ภายใน 2s
      และ `document.body.style.pointerEvents` ≠ `"none"`; และทางคีย์บอร์ด: `focus()` trigger + Enter → 1 → Escape ครั้งเดียว → 0; ขั้นที่ตรวจห้ามใช้ `toPass`/Escape ซ้ำ; ลบข้อมูลใน `finally` ด้วยการตรวจ `ok()` (กฎข้อ 119 ของ spec 01);
  (c) `pnpm --filter storefront test:e2e e2e/admin-row-menu-escape.spec.ts --repeat-each=10` บน prod build (แบบ CI, `workers=1`) ผ่าน 10/10 และผลของกฎ 37c (`closeRowMenu` แบบครั้งเดียวผ่าน 10/10 หรือเหตุผลที่คงไว้) — แนบใน `docs/evidence/admin-ui/ADM-33-tests.txt`;
  (d) e2e admin เดิมที่เปิดเมนูต่อแถว (`affiliate-admin-row-actions`, `affiliate-admin-affiliates`, `evoucher-admin-forms`, `evoucher-admin-pool-page`) ผ่าน (CI);
  (e) qa REPORT `docs/evidence/admin-ui/ADM-33/REPORT.md`: ทำซ้ำขั้นของ qa รอบ 36 (6 ครั้งต่อตาราง partners/programs) → Escape ครั้งเดียวปิดทุกครั้ง; tooltip ของคอลัมน์ข้อความยาว (เช่นชื่อ partner) ยังขึ้นเมื่อ hover — screenshot ≤ 2

### Test plan (รอบ 36 ส่วนที่ 2)
| ชนิด | AC |
|---|---|
| unit (jest `src/admin`) + e2e admin + qa | AC-37 |
| static (jest `src/admin/__tests__`) + e2e ใหม่ `--repeat-each=10` + e2e admin เดิมใน CI + qa | AC-38 |

### Tasks (รอบ 36 ส่วนที่ 2)
| Task | งาน | ไฟล์ที่แตะ | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-32 | (owner ข 2026-11-18 — qa รอบ 36 ข้อ 1) ฟอร์ม Create campaign: เงื่อนไขจำนวนเต็ม > 0 และ ≤ `INT4_MAX` ของ 7 ช่อง + `discount_value` > 0 เข้า `campaignFormSchema` → error ใต้ช่อง; 400 อื่นคง toast (กฎ 36) — ☑ #408 (หลัง ADM-31 #404; qa ผ่าน, defect ไม่พบ) | `apps/backend/src/admin/lib/group-buy-form.ts`, `apps/backend/src/admin/components/group-buy/create-campaign.tsx` (`ERROR_TESTIDS`), `apps/backend/src/admin/lib/__tests__/group-buy-form.unit.spec.ts`, `apps/storefront/e2e/group-buy-admin-form.spec.ts`, `docs/evidence/admin-ui/ADM-32/REPORT.md` (qa — session หลัก commit) | ~30 LOC โค้ด + ~120 LOC test | 1280×800 | AC-37 | PR เอกสารรอบ 36 ส่วนที่ 2 merge; **ADM-31 (#404) merge** (`create-campaign.tsx` ร่วม); ไม่บล็อก release | ∥ ADM-33, CORE-65 (ไม่มีไฟล์ร่วม); ADM-30 #402/OPS-28 #403 ไม่ชน |
| ADM-33 | (owner ข 2026-11-18 — qa รอบ 36 ข้อ 3) `meta: { ___truncateTooltip: false }` ในคอลัมน์ actions 5 ตาราง + static + e2e Escape ครั้งเดียว + `closeRowMenu` ตามผลวัด (กฎ 37) — ☑ #409 (หลัง ADM-31 #404; `closeRowMenu` เป็น Escape ครั้งเดียว; qa 30/30) | `apps/backend/src/admin/components/evoucher/partners-section.tsx`, `.../evoucher/codes-table.tsx`, `.../affiliate/programs-table.tsx`, `.../affiliate/affiliates-table.tsx`, `.../affiliate/payouts-table.tsx`, `apps/backend/src/admin/__tests__/medusa-ui.unit.spec.ts`, `apps/storefront/e2e/admin-row-menu-escape.spec.ts` (ใหม่), `apps/storefront/e2e/support/admin.ts`, `docs/evidence/admin-ui/ADM-33-tests.txt`, `docs/evidence/admin-ui/ADM-33/REPORT.md` (qa — session หลัก commit) | ~10 LOC โค้ด + ~150 LOC test | 1280×800 | AC-38 | PR เอกสารรอบ 36 ส่วนที่ 2 merge; **ADM-31 (#404) merge** (`partners-section.tsx`, `medusa-ui.unit.spec.ts` ร่วม); ไม่บล็อก release | ∥ ADM-32, CORE-65 (ไม่มีไฟล์ร่วม); ADM-30 #402/OPS-28 #403 ไม่ชน |

### ไม่เปิด task (รอบ 36 ส่วนที่ 2)
- (qa รอบ 36 ข้อ 2, เดิม qa #375) ข้อความ 400 ของ `status` ที่มาจาก zod union อ่านยาก — จริงที่ API แต่ UI ของเราส่งค่าที่ผิดไม่ได้ (เลือกจากรายการ) และ `/admin/products` ของ Medusa ให้ข้อความรูปเดียวกันทุกตัวอักษร (พฤติกรรม upstream) → ปิด ไม่มี task
- (qa รอบ 36 ข้อ 5) `data-value` ของยอดใน `cart-totals` เป็น float ดิบ → ยอมรับแล้วใน spec 01 หัวข้อ "Follow-up รอบ 30" (ค่าดิบตามกฎข้อ 115a, test เทียบ ±0.01) → ปิด ไม่มี task

## Follow-up รอบ 37 (2026-11-18 — owner ตัดสินข้อ ก (3) และ (5) ของ ROADMAP "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 36)" = ทำ)
Status: done (ปิดรอบ 37 2026-11-19 — ADM-34 ☑ #413, ADM-35 ☑ #416, ADM-36 ☑ ผลวัดทาง (A) + Q11 = ก ปิด ไม่มีโค้ด; owner สั่งทำ 2026-11-18; ไม่บล็อก release) · Out of scope: คืน focus หลังปิด `Drawer` และฟอร์มที่เปิดจาก menuitem ของ `ActionMenu` (เช่น Edit program — menuitem ถูกถอดจาก DOM แล้ว Radix ใช้ค่าเริ่มต้น),
ย้ายไป `RouteFocusModal` (Q5), จำกัดความยาวชื่อที่ validator (ทาง ค เดิมของ ROADMAP — owner ไม่เลือก), แก้/patch/fork `@medusajs/ui`/`@medusajs/dashboard`, เปิด issue upstream (ถ้าจะทำ → Q11)
ที่มา (ตรวจบน develop `99a52afb`):
- qa #404 O-1 (ADM-31 REPORT): ปิดฟอร์ม Create partner แล้ว `document.activeElement` = `BODY` — `FocusModal` ทั้ง 5 จุดเปิดด้วย state ไม่มี `FocusModal.Trigger` → Radix `Dialog` คืน focus ให้ trigger ไม่ได้;
  มีเฉพาะ `components/group-buy/create-campaign.tsx:98–100, 172–178` ที่จำ `document.activeElement` ตอน `onOpenAutoFocus` แล้วคืนเองตอน `onCloseAutoFocus` (ADM-15 กฎ 19b; static `__tests__/group-buy-pages.unit.spec.ts:109–115`);
  อีก 4 จุดที่เปิดจากปุ่ม — ไม่มี: `components/evoucher/partners-section.tsx:292–293` (Create partner — ปุ่มใน `action` ของ `DataTable` `:270`), `components/affiliate/program-form.tsx:142–143` (Create program `programs-table.tsx:142`; Edit จาก menuitem),
  `components/affiliate/payout-form.tsx:89–90` (Create payout `payouts-table.tsx:173`), `widgets/variant-evoucher-pool.tsx:154–155` (Create pool — ปุ่มใน `Header` `:115`)
- qa #409 O-1 (ADM-33 REPORT): ชื่อ partner ~370 ตัวอักษรทำให้ตารางกว้าง ~3000px ปุ่ม `…` หลุดนอก viewport — ต้นเหตุ (ตรวจ source `@medusajs/ui` 4.2.8): `DataTable` ที่ไม่เปิด column order ใช้ `<Table className="relative isolate w-full">` (auto layout)
  และ cell `whitespace-nowrap` (`dist/esm/blocks/data-table/components/data-table-table.js:224, 280`) → คอลัมน์ขยายตามข้อความ; path `table-fixed` + ความกว้าง % (`:130, 211–219`) ใช้เฉพาะ `instance.enableColumnOrder`
  ซึ่ง `DataTable` ของ dashboard เปิดเฉพาะ feature flag `view_configurations` (`@medusajs/dashboard` `dist/chunk-6CQCXI3F.mjs:670–673`) → ใช้ไม่ได้; หน้า dashboard เองจำกัดความกว้างที่เนื้อหา cell เช่น `ProductCell` `max-w-[250px]` (`dist/chunk-XEEPMJRY.mjs:12`)
- qa #409 O-2 (ADM-33 REPORT): กด Escape ในเฟรมเดียวกับที่เมนูโผล่ → ตารางของเราค้าง (programs 4/8 ที่ 0ms, 0/8 ที่ ≥ 16ms) แต่ `/app/products` ไม่ค้าง — **`/app/products` ไม่ใช่ตัวเทียบที่ถูก**: ใช้ `_DataTable` ภายในของ dashboard
  (`dist/product-list-XAW4AQNH.mjs:177`) ไม่ใช่ `DataTable` แบบของเรา (ตารางเรา import `DataTable` จาก `@medusajs/dashboard/components` ซึ่งห่อ `DataTable` ของ `@medusajs/ui` — แก้ถ้อยคำปิดรอบ 37 ตาม review #411); หน้า Medusa ที่ใช้ `DataTable` + `ActionMenu` ในคอลัมน์แบบเดียวกันคือ customer groups (`dist/customer-group-list-3ESALQFX.mjs:202, 272–275` — `id: "action"`);
  กลไกที่เกี่ยว: Radix ลงทะเบียน listener ของ Escape ใน `useEffect` (`@radix-ui/react-use-escape-keydown` 1.1.0 `dist/index.mjs:6–13`; React runtime 18.3.1) → Escape ที่มาก่อน passive effect ของเมนู flush ถูกทิ้งโดยออกแบบ;
  ระดับ source หาจุดต่างที่แน่ชัดไม่ได้ (ต้องวัดใน browser) → ADM-36 มีด่านวัดเทียบกับ customer groups ก่อนแก้ (กฎ 40a)

### What Medusa already gives us (รอบ 37)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| คืน focus เมื่อปิด modal | `FocusModal.Content` ของ `@medusajs/ui` ส่ง `onOpenAutoFocus`/`onCloseAutoFocus` ของ Radix; Radix คืน focus ให้ `Dialog.Trigger` เท่านั้น — dashboard ไม่ export hook/คอมโพเนนต์สำหรับ modal แบบ state (Q5) | ขยาย — hook เล็กของเราใน `src/admin/components/common/` (ผู้ใช้จริง 5 ที่ — CLAUDE.md ≥ 2) ส่ง handler ให้ prop ของ Medusa; ไม่ห่อ `FocusModal` · (ปิดรอบ 37 — review #411) ใช้ `FocusModal.Trigger` ไม่ได้: ฟอร์มเปิดด้วย state + `key` เพื่อ mount ใหม่และกันกดซ้ำ (Q5) และปุ่มใน `action` ของ `DataTable` เป็น `DataTableAction` (`label`/`onClick` — ห่อเป็น Trigger ไม่ได้, กฎ 18); ROADMAP ปิดรอบ 36 ข้อ ก (4) เดิมแนะนำ "ไม่สร้าง hook (prop บรรทัดเดียว)" — เปลี่ยนเพราะ logic จริงคือ state + handler 2 ตัวที่ซ้ำ 5 ที่ |
| tooltip ข้อความที่ถูกตัดใน cell | `TruncatedCell` ของ `DataTable` (`data-table-table.js:338–356`) เปิดเองเมื่อ `scrollWidth > clientWidth` | ใช้ตามเดิม — คง tooltip ของ Medusa ในคอลัมน์ข้อความ (ไม่ตั้ง `truncateTooltip: false`) |
| จำกัดความกว้างคอลัมน์ | `size`/`maxSize`/`minSize` ของ column def (ส่งเป็น style ของ th/td — `:288–293`) และ className ของเนื้อหา cell แบบ `ProductCell` ของ dashboard | ใช้ตามเดิม — className/column option ไม่สร้าง component |
| เมนูต่อแถว | `ActionMenu` ของ `@medusajs/dashboard/components` | ใช้ตามเดิม |

### Data model / Workflows / API routes
none

### Business rules (รอบ 37)
38. (ADM-34 — owner สั่งทำ 2026-11-18; qa #404 O-1) `FocusModal` ที่เปิดจากปุ่ม คืน focus ให้ปุ่มนั้นเมื่อปิด (แบบกฎ 19b):
    (a) hook `useRestoreOpenerFocus()` ใน `src/admin/components/common/use-restore-opener-focus.ts` คืน `{ onOpenAutoFocus, onCloseAutoFocus }` ด้วย logic เดิมของ `create-campaign.tsx`:
        `onOpenAutoFocus` จำ `document.activeElement` (HTMLElement) ด้วย `useState`; `onCloseAutoFocus` ถ้า element ที่จำ `isConnected` → `e.preventDefault()` แล้ว `.focus()` ไม่งั้นปล่อยค่าเริ่มต้นของ Radix;
    (b) ใช้กับ `FocusModal.Content` ทั้ง 5 จุด (partners-section, program-form, payout-form, variant-evoucher-pool, create-campaign — แทนโค้ด inline เดิม) โดยคง `onEscapeKeyDown` เดิมของ program/payout (ADM-26) ไว้;
    (c) ไม่เปลี่ยน: testid/label, `FocusModal.Title` (กฎ 35), prompt ก่อนปิด (กฎ 31), Escape ของ combobox (กฎ 30c), กันกดซ้ำ, การเปิดใหม่ทุกครั้ง (key/`opened`);
    (d) static เดิมของกฎ 19b (`group-buy-pages.unit.spec.ts:109–115`) ย้ายไปตรวจว่าใช้ hook แทน inline; `FocusModal` ใหม่ในอนาคตต้องใช้ hook นี้ (static ของ AC-39a);
    (e) (nit review #404 — ไฟล์เดียวกัน) static ของ AC-36a ใน `medusa-ui.unit.spec.ts` (~`:929`) ใช้ regex `<Heading[^>]*>[^<]*<\/Heading>` แทน `(\{[^}]*\}[^<]*)*` และชื่อ test ตรงกับ `arrayContaining` ("อย่างน้อย 5 จุด") หรือเปลี่ยนเป็นเทียบเท่ากับรายการ;
        (nit review #409) `optsOut` ของ static AC-38a (`medusa-ui.unit.spec.ts:953`) ไม่ใช้ `[^}]*` ที่เปราะกับ object ซ้อนใน `meta` (ใช้ตัวนับวงเล็บแบบ `balanced()` ของ `e2e/core-46-e2e-hygiene.unit.spec.ts` หรือวิธีอื่นที่ทน)
        + self-check `meta: { a: { b: 1 }, ___truncateTooltip: false }` ผ่าน
39. (ADM-35 — owner สั่งทำ 2026-11-18; qa #409 O-1) ข้อความยาวในคอลัมน์ของ `DataTable` ต้องไม่ดันปุ่ม `…` ออกนอกจอ:
    (a) คอลัมน์ข้อความอิสระในตารางที่มีเมนูต่อแถว — partners `name`, `support_contact` (`partners-section.tsx:215–216`); programs `name` (`programs-table.tsx:109`); affiliates `name`, `email` (`affiliates-table.tsx:133–134`); payouts `reference` (`payouts-table.tsx:157`)
        — จำกัดความกว้างของเนื้อหา cell ที่ **250px** (ค่าเดียวกับ `ProductCell` ของ dashboard) ด้วย className ใน `cell` ของ column และ/หรือ `size`/`maxSize` ของ column def (เลือกใน PR ตามผลวัด);
        **(ปิดรอบ 37 — ที่ทำจริงใน #416 ตามการตีความของ session หลัก 2026-11-18)**: `size` + `maxSize` ของ column def = width/max-width ของ td (border-box) จึงบวก padding — คอลัมน์แรก (`pl-6`+`pr-6`) **298**, คอลัมน์อื่น (`pr-6`) **274**;
        คอลัมน์กว้างตายตัวแม้ข้อความสั้น (ยอมรับ); ตารางที่ผลรวม width น้อยกว่าตาราง `w-full` (partners 3 คอลัมน์) Chrome แจกส่วนเกินตามสัดส่วนโดยไม่สน max-width
        → คอลัมน์ actions ของ partners ตั้ง `size: undefined` (ไม่ได้ width = auto รับส่วนเกิน; ค่าเริ่มต้น `size` 150 ของ tanstack ถูกส่งเป็น width ของ td ทุกคอลัมน์ — `data-table-table.js:288–293`);
        ไม่ครอบคอลัมน์ Affiliate ของ payouts (`AffiliateCell`) และความกว้างที่จอ > 1280 ของ programs/affiliates/payouts → **ADM-37** (กฎ 41);
    (b) คง tooltip ของ `TruncatedCell` ของ Medusa: hover ข้อความที่ถูกตัดแล้วเห็นข้อความเต็ม — ถ้า className/column option ทำให้ (c) และ (b) เป็นจริงพร้อมกันไม่ได้ → **หยุดและรายงาน planner** (ไม่สร้าง component, ไม่ใช้ `title` แทน, ไม่ patch library);
    (c) ข้อความสั้น (≤ 250px) หน้าตาเท่าเดิม; คอลัมน์ actions (กฎ 37) และ testid คงเดิม; ไม่สร้าง component/helper ใหม่;
    (d) (nit review #409 + qa #409 O-4 — test-only) `e2e/admin-row-menu-escape.spec.ts`: ตาราง affiliates (~`:130`) หาแถวภายใน wrapper testid ของตาราง (ไม่ใช้ `tbody tr` ทั้งหน้า); ตาราง partners หาแถวโดยไม่พึ่งการเรียงหน้าแรก — **(ปิดรอบ 37 แก้ถ้อยคำตามการตีความของ session หลัก 2026-11-18)**: ไม่ใช้การค้นหา `q`
        (ตารางเหล่านี้ตั้ง `enableSearch={false}` และ partners API ไม่รับ `q`) → หา offset ของหน้าที่แถวอยู่ผ่าน admin API (`pageOffsetOf` ของ `e2e/support/admin.ts`) แล้วเปิดด้วย `?<prefix>_offset=` ใน URL (Q6);
        comment ของ `waitMenuOpened` (`e2e/support/admin.ts:89–93`) ระบุว่าเมื่อไม่มี animation จะ resolve ทันที; `getAnimations().finished` ที่ยังไม่มี `.catch` (`e2e/affiliate-admin-programs.spec.ts:132`) ใส่ `.catch` หรือใช้ helper กลางใน `e2e/support/admin.ts`
        (ผู้ใช้ ≥ 2 ที่ — `affiliate-admin-affiliates.spec.ts:60–61` มี `settled` แบบเดียวกัน) — ห้ามเพิ่ม `waitForTimeout`/timeout/`retries`/`skip`/`fixme`
40. (ADM-36 — owner สั่งทำ 2026-11-18; qa #409 O-2) Escape ที่มาในเฟรมแรกที่เมนูต่อแถวโผล่ ต้องปิดเมนูได้ **เท่ากับหน้าของ Medusa ที่ใช้ `DataTable` แบบเดียวกัน**:
    (a) **ด่านวัดก่อนแก้ (ทำก่อนเขียนโค้ด production)**: probe e2e ที่กด Escape "ในเฟรมเดียวกัน" แบบกำหนดได้ — ใน `page.evaluate` ตั้ง `MutationObserver` รอ `[role="menu"]` ถูกเพิ่มแล้ว dispatch
        `new KeyboardEvent("keydown", { key: "Escape", bubbles: true })` ทันทีใน callback, จากนั้นคลิก trigger; รอ animation จบแล้วนับ `getByRole("menu")`; รัน 20 ครั้งต่อหน้า:
        programs (`/app/affiliate`) และ customer groups ของ Medusa (`/app/customer-groups` — สร้าง customer group ≥ 1 ผ่าน admin API) — **ไม่ใช้ `/app/products`** (คนละ implementation);
    (b) ผล → ทาง: (A) customer groups ค้าง ≥ 1/20 → พฤติกรรมของ `@medusajs/ui`/Radix → **หยุด ไม่เปิด PR** ส่งตัวเลขให้ session หลัก → planner ถาม owner Q11;
        (B) customer groups 0/20 และของเรา > 0/20 → หาจุดต่างในโค้ดของเรา (ผู้ต้องสงสัย: `ActionMenu key={menuKey}` ของกฎ 27, คอลัมน์ `id: "actions"` ที่ไม่อยู่ท้าย ต่างจาก `id: "action"` ของ Medusa, `cell` ที่ไม่คงที่) แล้วแก้ในโค้ดของเรา;
        (C) ทั้งสอง 0/20 (probe ทำซ้ำอาการไม่ได้) → หยุด ไม่เปิด PR รายงานผล → planner ปิดข้อนี้;
    (c) ทาง (B) ห้าม fork/patch library, ห้าม `waitForTimeout`/หน่วงด้วย timer, ห้ามดัก Escape เองที่ document; กฎ 27 (remount เมนูระหว่างลบ) และกฎ 37 ต้องยังผ่าน (e2e เดิม)
    (d) **ผลวัด (ปิดรอบ 37, 2026-11-19 — `docs/evidence/admin-ui/ADM-36-tests.txt`; develop `572942e4` prod build, 20 ครั้งต่อหน้าต่อเงื่อนไข) = ทาง (A)**:
        จำนวน Escape จนเมนูปิด — ค่าฐาน (กดหลังเมนูเปิด ≥ 16ms): customer groups = 2 ทุกครั้ง (Escape แรกถูก tooltip ของ `TruncatedCell` กิน — คอลัมน์ `id: "action"` ของ Medusa ไม่มี `___truncateTooltip: false`), programs ของเรา = 1 ทุกครั้ง;
        เฟรมแรก (คลิกแล้วกดทันที 0ms): ทั้งสองหน้าต้องเพิ่ม 1 ครั้งจากค่าฐาน (customer groups 19/20, programs 20/20) = Escape เฟรมแรกถูกทิ้งเหมือนกัน;
        probe `MutationObserver` +1 ทุกครั้งทั้งสองหน้า (ยืนยันกลไกได้แต่แยกหน้าไม่ได้ — จึงไม่ใช้ตัดสินลำพังตาม review #411) → พฤติกรรมของ `@medusajs/ui`/Radix (listener ของ Escape ลงทะเบียนใน `useEffect`) ไม่ใช่จุดต่างของโค้ดเรา
        (`key={menuKey}`, `id: "actions"` กลางตาราง ไม่เกี่ยว) → ไม่มี PR โค้ด; **owner ตอบ Q11 = ก 2026-11-19 ปิดข้อนี้** (ไม่ patch ไม่เปิด issue);
        static `isActions` ของ AC-38a ไม่ต้องแก้ (ทาง B ไม่เกิด — review #411 nit 5)

### Acceptance criteria (รอบ 37)
- AC-39 (ADM-34, กฎ 38) ☑ #413 (a–d ผ่าน: red static 8 เคส (0/5 ไฟล์ + inline + hook + กฎ 19b เดิม), e2e 7/8 activeElement = `BODY` (Create campaign ผ่านอยู่แล้ว) → green static 244/244, e2e ใหม่ + เดิม 58/58, `--repeat-each=3` 24/24;
  qa 30/30 กรณี focus กลับปุ่มที่เปิด defect ไม่พบ — `docs/evidence/admin-ui/ADM-34-tests.txt`, `ADM-34/REPORT.md`)
  (a) static jest ใน `src/admin/__tests__/medusa-ui.unit.spec.ts` — **ล้มบน develop** (0/5 — create-campaign เป็น inline): ทุกไฟล์ใต้ `src/admin/` (ไม่รวม `__tests__`) ที่มี `<FocusModal.Content` เรียก `useRestoreOpenerFocus(` และจำนวน `<FocusModal.Content` = จำนวนที่ได้ handler ของ hook,
      จำนวนไฟล์ที่พบ ≥ 5 (กัน vacuous); ไม่มี `onCloseAutoFocus={(` แบบ inline เหลือ; self-check: ตัวอย่าง Content ที่ไม่มี handler ไม่ผ่าน; static เดิม `group-buy-pages.unit.spec.ts:109–115` แก้ให้ตรวจ hook แทน inline;
  (b) e2e ใหม่ `e2e/admin-modal-return-focus.spec.ts` (`evidenceTarget` `ADM-34`, 1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`) — **ล้มบน develop** (ยกเว้น Create campaign ที่ผ่านอยู่แล้ว — คงไว้เป็น regression):
      เปิด Create partner (`/app/evouchers`), Create program และ Create payout (`/app/affiliate`), Create campaign (`/app/group-buying`) ด้วยปุ่มตามกฎ 7c/18 และ Create pool (หน้า variant ที่ยังไม่มี pool — หาปุ่มแบบ e2e เดิมของ widget)
      → กด Escape (ฟอร์มไม่ dirty — ปิดโดยไม่มี prompt) → dialog หาย และปุ่มที่ใช้เปิดคือ `document.activeElement` (`locator.evaluate((el) => el === document.activeElement)` = true);
      Create partner เพิ่มกรณีบันทึกสำเร็จ (กรอก field ที่บังคับแล้ว submit) → focus กลับปุ่มเช่นกัน; ลบข้อมูลที่สร้างใน `finally` ด้วยการตรวจ `ok()`;
  (c) e2e admin เดิม (`admin-dialog-title`, `admin-form-discard-prompt`, `evoucher-admin-forms`, `affiliate-admin-forms`, `affiliate-admin-payout-create`, `group-buy-admin-form`) ผ่านโดยไม่แก้ assertion (CI `storefront-e2e`);
  (d) qa REPORT `docs/evidence/admin-ui/ADM-34/REPORT.md`: ทั้ง 5 ฟอร์ม เปิดด้วยเมาส์และคีย์บอร์ด (Tab ไปที่ปุ่ม + Enter) → ปิดด้วย Escape/ปุ่มปิด → focus ring อยู่ที่ปุ่มที่เปิด — screenshot ≤ 2
- AC-40 (ADM-35, กฎ 39) ☑ #416 (a–d ผ่าน: red บน develop `e1973af0` 2/2 `toBeInViewport` ("viewport ratio 0"; partners ตาราง 4839px) → green; AC-40b 25/25; ชุด admin เต็ม 126/126 ในเครื่อง; qa D-1 (test-only — ผลขึ้นกับข้อมูลใน DB) แก้ใน PR แล้ว,
  qa ทั้ง 4 ตารางที่ 1280/1440/1920 ปุ่มในจอ `scrollLeft` 0, ข้อสังเกต O-1/O-3 → ADM-37 — `docs/evidence/admin-ui/ADM-35-tests.txt`, `ADM-35/REPORT.md`)
  (a) e2e ใหม่ `e2e/admin-table-long-text.spec.ts` (`evidenceTarget` `ADM-35`, 1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`) — **ล้มบน develop**: สร้าง partner และ program ชื่อ 370 ตัวอักษร (ไทยปนอังกฤษ ไม่มีช่องว่าง 1 ช่วงยาว ≥ 100 ตัว) ผ่าน admin API;
      หาแถวด้วย offset ของหน้าผ่าน admin API + `?<prefix>_offset=` (ปิดรอบ 37 แก้ถ้อยคำจาก "การค้นหา `q`" — กฎ 39d) → trigger `…` ของแถวนั้น `toBeInViewport()` โดยไม่เลื่อนแนวนอน (`scrollLeft` ของกล่องเลื่อนของตาราง = 0) และ `boundingBox().x + width ≤ 1280`;
      ความกว้างของ cell ชื่อ ≤ 250px + padding ของ cell; hover ที่ชื่อ → `getByRole("tooltip")` visible และมีชื่อเต็ม; แถวชื่อสั้น (≤ 20 ตัวอักษร) แสดงชื่อเต็ม (element ที่ `TruncatedCell` ห่อ `scrollWidth ≤ clientWidth`);
      คลิก trigger → `getByRole("menu")` 1 → Escape → 0 (กฎ 37 ยังจริง); ลบข้อมูลใน `finally` ด้วยการตรวจ `ok()`;
  (b) `admin-row-menu-escape.spec.ts` หลังแก้ตามกฎ 39d ผ่าน `--repeat-each=5` บน prod build (แบบ CI, `workers=1`) — แนบใน `docs/evidence/admin-ui/ADM-35-tests.txt`;
  (c) e2e admin เดิมที่ใช้ตาราง 4 ตัวนี้ผ่าน (CI);
  (d) qa REPORT `docs/evidence/admin-ui/ADM-35/REPORT.md`: ตาราง partners/programs/affiliates/payouts ด้วยข้อความยาว (affiliate และ reference ของ payout สร้างเอง) และข้อความสั้น ที่ 1280 — ปุ่ม `…` อยู่ในจอ, tooltip ขึ้น, ข้อความสั้นไม่ถูกตัด — screenshot ≤ 3
- AC-41 (ADM-36, กฎ 40) ☑ ผลวัด (a) — ทาง (A) ตามกฎ 40d (`docs/evidence/admin-ui/ADM-36-tests.txt`, commit ใน PR เอกสารปิดรอบ 37); (b)/(c) ไม่ใช้ (เฉพาะทาง B); Q11 = ก ปิด
  (a) ผลด่านวัดของกฎ 40a (20 ครั้งต่อหน้า, จำนวนที่ค้าง) แนบใน `docs/evidence/admin-ui/ADM-36-tests.txt` ทุกทาง — ทาง (A)/(C) ส่งเฉพาะไฟล์นี้ผ่าน session หลัก (ไม่มี PR โค้ด);
  (b) ทาง (B): probe เป็น e2e ถาวร `e2e/admin-row-menu-first-frame.spec.ts` (`evidenceTarget` `ADM-36`) — **ล้มบน develop** ที่ตารางของเรา; หลังแก้ทั้ง 5 ตาราง 0/20 และ customer groups 0/20;
      e2e เดิม `admin-row-menu-escape` (`--repeat-each=10`), `affiliate-admin-row-actions`, `affiliate-admin-affiliates`, `evoucher-admin-forms`, `evoucher-admin-pool-page` ผ่าน; static ของ AC-38a ยังผ่าน;
  (c) ทาง (B): qa REPORT `docs/evidence/admin-ui/ADM-36/REPORT.md` ทำซ้ำการวัด 0ms ของ qa #409 (8 ครั้งต่อตาราง) → ไม่ค้าง — screenshot ≤ 1

### Test plan (รอบ 37)
| ชนิด | AC |
|---|---|
| static (jest `src/admin/__tests__`) + e2e ใหม่ + e2e admin เดิมใน CI + qa | AC-39 |
| e2e ใหม่ + e2e เดิม `--repeat-each=5` + qa | AC-40 |
| probe e2e (ด่านวัด) → ทาง (B): e2e ถาวร + e2e เดิม + qa | AC-41 |

### Tasks (รอบ 37)
| Task | งาน | ไฟล์ที่แตะ | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-34 | (owner สั่งทำ 2026-11-18 — qa #404 O-1) hook `useRestoreOpenerFocus` + ใช้ใน `FocusModal` 5 จุด (create-campaign ย้ายจาก inline) + static + e2e คืน focus + nit review #404 และ `optsOut` ของ review #409 (กฎ 38); red→green: AC-39a 0/5, AC-39b ล้ม 4 ฟอร์ม (activeElement = BODY); qa — ☑ #413 (owner สั่งทำ 2026-11-18; qa 30/30 defect ไม่พบ) | `apps/backend/src/admin/components/common/use-restore-opener-focus.ts` (ใหม่), `.../components/evoucher/partners-section.tsx`, `.../components/affiliate/program-form.tsx`, `.../components/affiliate/payout-form.tsx`, `.../widgets/variant-evoucher-pool.tsx`, `.../components/group-buy/create-campaign.tsx`, `.../__tests__/medusa-ui.unit.spec.ts`, `.../__tests__/group-buy-pages.unit.spec.ts`, `apps/storefront/e2e/admin-modal-return-focus.spec.ts` (ใหม่), `docs/evidence/admin-ui/ADM-34/REPORT.md` (qa — session หลัก commit) | ~40 LOC โค้ด + ~150 LOC test | 1280×800 | AC-39 | PR เอกสารรอบ 37 merge; ไม่บล็อก release | ∥ GB-18 (spec 04), CORE-66/67 (spec 01) — ไม่มีไฟล์ร่วม |
| ADM-35 | (owner สั่งทำ 2026-11-18 — qa #409 O-1) จำกัดความกว้างเนื้อหาคอลัมน์ข้อความอิสระ 250px ใน 4 ตาราง คง tooltip ของ `TruncatedCell` + nit review/qa #409 ใน `admin-row-menu-escape.spec.ts` (กฎ 39); red→green: AC-40a ล้มบน develop (trigger นอก viewport); qa — ☑ #416 (หลัง ADM-34 #413; `size`/`maxSize` 298/274 + actions ของ partners auto; รวม nit review #413 ของ static `restoreUsage`; qa D-1 test-only แก้ใน PR) | `apps/backend/src/admin/components/evoucher/partners-section.tsx`, `.../affiliate/programs-table.tsx`, `.../affiliate/affiliates-table.tsx`, `.../affiliate/payouts-table.tsx`, `apps/storefront/e2e/admin-table-long-text.spec.ts` (ใหม่), `apps/storefront/e2e/admin-row-menu-escape.spec.ts`, `apps/storefront/e2e/support/admin.ts`, `apps/storefront/e2e/affiliate-admin-programs.spec.ts` (+ `affiliate-admin-affiliates.spec.ts` ถ้ารวม helper), `docs/evidence/admin-ui/ADM-35-tests.txt`, `docs/evidence/admin-ui/ADM-35/REPORT.md` (qa — session หลัก commit) | ~15 LOC โค้ด + ~160 LOC test | 1280×800 | AC-40 | **ADM-34 merge** (`partners-section.tsx` ร่วม); ไม่บล็อก release | ∥ GB-18, CORE-66/67 |
| ADM-36 | (owner สั่งทำ 2026-11-18 — qa #409 O-2) ด่านวัด Escape เฟรมแรกเทียบ customer groups ของ Medusa → แก้เฉพาะเมื่อเป็นจุดต่างในโค้ดของเรา (กฎ 40); red→green (ทาง B): probe 0ms ค้างในตารางของเรา → 0/20; qa เฉพาะทาง (B) — **☑ ผลวัด 2026-11-19** (ไม่มี PR โค้ด — `docs/evidence/admin-ui/ADM-36-tests.txt`): ทาง (A) customer groups ทิ้ง Escape เฟรมแรก 19/20 เท่ากับ programs 20/20 → owner Q11 = ก ปิดข้อนี้ (กฎ 40d) | ด่านวัด: `docs/evidence/admin-ui/ADM-36-tests.txt` เท่านั้น; ทาง (B) เพิ่ม: `apps/storefront/e2e/admin-row-menu-first-frame.spec.ts` (ใหม่) + ไฟล์ตาราง/เมนูที่เป็นต้นเหตุ (ระบุใน PR — คาดว่าในชุดไฟล์ของ ADM-33), `docs/evidence/admin-ui/ADM-36/REPORT.md` (qa) | ด่านวัด ~80 LOC probe; ทาง (B) ≤ ~150 LOC รวม | 1280×800 | AC-41 | **ADM-35 merge** (ไฟล์ตาราง + `admin-row-menu-escape.spec.ts` ร่วม) — ด่านวัด (ไม่มี PR) เริ่มได้ทันทีเมื่อ PR เอกสารรอบ 37 merge; ไม่บล็อก release | ∥ GB-18, CORE-66/67 |

## Follow-up รอบ 38 (2026-11-19 — owner สั่งทำ ก "ทำแบบ ADM-35" สำหรับข้อสังเกต qa #416 O-1/O-3 และข้อเสนอ builder #416)
Status: done (ปิดรอบ 38 2026-11-19 — ADM-37 ☑ #418; owner สั่งทำ 2026-11-19, Q12 = ก owner 2026-11-19; ไม่บล็อก release) · Out of scope: ตารางที่กว้างเกินกล่องเพราะจำนวนคอลัมน์ (qa #416 O-2 — payouts 1490px, affiliates 1141px ที่ 1280; ปุ่ม `…` ยังอยู่ในจอ),
ตาราง Ledger (ใช้ `AffiliateCell` แต่ไม่มีเมนูต่อแถว — รอบ 39 owner สั่งทำ → ADM-38 กฎ 42), codes/pools/campaigns, ความสูงของ tooltip ข้อความไทยไม่มีช่องว่าง (qa #416 O-4), จำกัดความยาวที่ validator, แก้/patch `@medusajs/ui`
ที่มา (ตรวจบน develop `572942e4` และ `@medusajs/ui` 4.2.8 `dist/esm/blocks/data-table/components/data-table-table.js`):
- qa #416 O-1: คอลัมน์ Affiliate ของ payouts (`components/affiliate/payouts-table.tsx:138–141`, cell = `AffiliateCell` ของ `list-table.tsx:122–136` — `div.flex.flex-col` ชื่อ + อีเมล) ไม่มี `size`/`maxSize` → ชื่อ 370 ตัวทำให้ตารางกว้าง 3759px ที่ 1280
- qa #416 O-3 + builder #416: ที่ 1920 คอลัมน์ข้อความเกิน 250px (ชื่อ program 381px, ชื่อ affiliate 364px, อีเมล 334px) — ทุก td ได้ `width` = `columnDef.size` (ค่าเริ่มต้น 150 ของ tanstack — `:288–293`) ผลรวมน้อยกว่าตาราง `w-full`
  → Chrome แจกส่วนเกินตามสัดส่วนโดยไม่สน `max-width`; partners ไม่มีอาการเพราะคอลัมน์ actions ตั้ง `size: undefined` แล้ว (กฎ 39a) — programs (`programs-table.tsx:94–105`), affiliates (`affiliates-table.tsx:120–129`), payouts (`payouts-table.tsx:109–123`) ยังไม่ตั้ง
- `TruncatedCell` (`:338–356`) วัด `scrollWidth > clientWidth` ของ div `.truncate` ที่ห่อเนื้อหา cell และใช้ `textContent` ทั้ง cell เป็นข้อความ tooltip → `AffiliateCell` ที่ไม่มีช่องว่างระหว่างชื่อกับอีเมลได้ tooltip "ชื่ออีเมล" ติดกัน

### What Medusa already gives us (รอบ 38)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| จำกัดความกว้างคอลัมน์ | `size`/`maxSize` ของ column def (`@medusajs/ui` `DataTable` ส่งเป็น style ของ td) — แบบเดียวกับกฎ 39a | ใช้ตามเดิม — column option ไม่สร้าง component |
| คอลัมน์ที่รับส่วนเกิน | td ที่ไม่มี `width` (ตั้ง `size: undefined` ทับค่าเริ่มต้นของ tanstack) เป็นคอลัมน์ auto ของ table layout | ใช้ตามเดิม (แบบ partners ของ #416) |
| tooltip ข้อความที่ถูกตัด | `TruncatedCell` ของ `DataTable` | ใช้ตามเดิม — ไม่ตั้ง `___truncateTooltip: false` ในคอลัมน์ข้อความ |

### Data model / Workflows / API routes
none

### Business rules (รอบ 38)
41. (ADM-37 — owner สั่งทำ 2026-11-19; qa #416 O-1/O-3, builder #416) คอลัมน์ข้อความในตารางที่มีเมนูต่อแถวกว้างไม่เกิน 250px ทุกความกว้างจอ:
    (a) payouts คอลัมน์ `affiliate_id` ("Affiliate") ตั้ง `size: 274, maxSize: 274` (ไม่ใช่คอลัมน์แรก — ค่าเดียวกับกฎ 39a) ใน column def ของ `payouts-table.tsx`; คงลำดับคอลัมน์ (ปุ่มอยู่คอลัมน์ 2 — รอบ 10);
        **(แก้รอบ 41)** ADM-41 (กฎ 45) ลดเป็น `size/maxSize: 150` (Reference/Payout 124) เพื่อไม่ล้นที่ 1280 — ความกว้างที่จอใหญ่ตามกฎ 49 (ADM-45) แทนค่า 274 ของข้อนี้;
    (b) tooltip ของ `TruncatedCell` ต้องขึ้นเมื่อชื่อ/อีเมลถูกตัด: **ห้าม**ใส่ `truncate`/`overflow-hidden`/`max-w-*` ที่ลูกของ `AffiliateCell` (overflow ของลูกถูกตัดก่อนถึง div ของ Medusa → `scrollWidth` ไม่เกิน → tooltip หาย);
        ข้อความจึงถูกตัดที่ขอบ cell โดยอาจไม่มี "…" (`text-overflow` มีผลกับ inline content ของ div นั้นเท่านั้น) — ยอมรับ; ใส่ `{" "}` ระหว่าง `Text` ชื่อกับอีเมลใน `AffiliateCell`
        ให้ tooltip เป็น "ชื่อ อีเมล" (whitespace ระหว่างลูกของ flex container ไม่ render — หน้าตาเท่าเดิม; Ledger ได้ผลเดียวกัน); ถ้า (a) กับ (b) จริงพร้อมกันไม่ได้ → **หยุดและรายงาน planner** (ไม่สร้าง component, ไม่ใช้ `title`, ไม่ patch library);
    (c) programs, affiliates, payouts มีคอลัมน์ auto (ไม่มี width) 1 คอลัมน์ต่อตารางรับความกว้างส่วนเกิน = **คอลัมน์สุดท้าย** `size: undefined` — programs `hold_days` ("Hold days"), affiliates `created_at` ("Joined"), payouts `id` ("Payout")
        + comment อ้างกฎนี้ (**Q12 = ก owner 2026-11-19**; เดิมสั่งคอลัมน์ actions ตามข้อเสนอ builder #416 — ปิดรอบ 38 แก้ถ้อยคำ); คอลัมน์ actions คงขนาดเริ่มต้นของ tanstack (150) และ meta เดิม (d);
        ผล #418 ที่ 1920 (`docs/evidence/admin-ui/ADM-37-tests.txt`): ส่วนเกินอยู่ท้ายตาราง (programs Hold days 507px, affiliates Joined 458px), ช่องว่างหลังปุ่ม `…` programs 122px, affiliates 122px, payouts 91px;
        payouts กว้างพอดีเนื้อหาจึงคอลัมน์สุดท้ายไม่รับส่วนเกิน (qa #418 O-1 — ยอมรับ ไม่เกินความกว้างเริ่มต้นของคอลัมน์ actions);
        **(แก้รอบ 41)** payouts หลัง ADM-41: คอลัมน์ auto คือ Amount/Period/Paid at (`size: undefined`) และ `id` ("Payout") `size/maxSize: 124` — ไม่ใช่คอลัมน์สุดท้ายตามข้อนี้แล้ว (กฎ 45, 49);
    (d) คงเดิม: `meta: { ___truncateTooltip: false }` ของคอลัมน์ actions (กฎ 37 — static AC-38a), `size`/`maxSize` ของกฎ 39a, testid, `cell` คงที่ข้าม render (กฎ 20a), กันกดซ้ำ; ไม่สร้าง component/helper ใหม่ (ตั้ง option inline แบบ partners)

### Acceptance criteria (รอบ 38)
- AC-42 (ADM-37, กฎ 41) ☑ #418 (a–d ผ่าน: red บน develop `dccf7a7d` 4/7 ล้ม (เนื้อหา cell Affiliate 2587px ที่ 1280; Program 338px, Name 342px, Affiliate 2580px ที่ 1920) + red ขั้นที่ 2 tooltip "ชื่ออีเมล" ติดกันก่อนใส่ `{" "}` → green;
  AC-42b 60/60 `--repeat-each=5`, static AC-38a 7/7; qa ชุด admin เต็ม 96/96; วัดที่ 1280/1440/1920 defect ไม่พบ, ข้อสังเกต O-1/O-2 → ROADMAP ปิดรอบ 38 — `docs/evidence/admin-ui/ADM-37-tests.txt`, `ADM-37/REPORT.md`)
  (a) e2e ใน `e2e/admin-table-long-text.spec.ts` (เพิ่ม `test.describe` ที่ `test.use({ evidenceTarget: { feature: "admin-ui", taskId: "ADM-37" } })`; `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`; helper เดิมของไฟล์ — หาแถวด้วย `pageOffsetOf` + `?<prefix>_offset=`, เลื่อนแนวตั้งด้วย cell แบบ qa #416 D-1) — **ล้มบน develop**:
      (a1) 1280×800: affiliate ชื่อ 370 ตัวอักษร (`longName` เดิม) และอีเมล ≥ 80 ตัวอักษร (`createActiveAffiliate` option `name`/`email`) + payout draft (`insertDraftPayouts`) → ในแถวของ payout ภายใน `affiliate-payouts-table`:
           td ของ `affiliate-row-affiliate` เนื้อหา (ไม่รวม padding) ≤ 250.5px และ `.truncate` `scrollWidth > clientWidth`; hover → tooltip ของ cell (`getByRole("tooltip").filter({ hasText: ชื่อ })`) visible และมีข้อความ `` `${ชื่อ} ${อีเมล}` ``;
           trigger `affiliate-payout-row-actions` `toBeInViewport()`, `scrollLeft` ของกล่องเลื่อน = 0, `x + width ≤ 1280`; ลบ payout ใน `finally` ด้วยการตรวจ `ok()` (affiliate ไม่มี API ลบ — เหมือน e2e เดิม);
      (a2) 1920×1080: programs (ชื่อยาว), affiliates (ชื่อ + อีเมลยาว) และ payouts (affiliate ยาว + payout **draft** ที่ `reference` ยาว ≥ 300 ตัว — เพิ่ม option `reference` ให้ `insertDraftPayouts` ของ `e2e/support/affiliate.ts`; payout ที่ paid ไม่มีปุ่ม `…` ตามกฎ 10 จึงไม่ใช้ mark paid) → ทุกคอลัมน์ข้อความของกฎ 39a/41a ในแถวนั้นเนื้อหา ≤ 250.5px
           และ trigger `…` ของแถว `toBeInViewport()`; partners ที่ 1920 ตรวจแบบเดียวกัน (ผ่านอยู่แล้ว — regression);
      ห้ามเพิ่ม `waitForTimeout`/timeout/`retries`/`skip`/`fixme`; เส้นทางเมาส์ไม่ผ่าน sidebar (qa #416 O-5);
  (b) `admin-table-long-text.spec.ts` ทั้งไฟล์ + `admin-row-menu-escape.spec.ts` `--repeat-each=5` บน prod build (แบบ CI, `workers=1`) ผ่าน; static ของ AC-38a ผ่าน — แนบใน `docs/evidence/admin-ui/ADM-37-tests.txt` พร้อม red บน develop;
  (c) e2e admin เดิมที่ใช้ตาราง affiliate (`affiliate-admin-*` รวม `affiliate-admin-names`/`affiliate-admin-tables` ที่ตรวจ `affiliate-row-affiliate` ด้วย `toContainText`) ผ่านโดยไม่แก้ assertion (CI `storefront-e2e`);
  (d) qa REPORT `docs/evidence/admin-ui/ADM-37/REPORT.md`: payouts ชื่อ affiliate ยาวที่ 1280 (ถูกตัด, tooltip "ชื่อ อีเมล", ปุ่มในจอ) และ programs/affiliates/payouts ที่ 1920 (คอลัมน์ข้อความ ≤ 250px, ตำแหน่งปุ่มและช่องว่างของคอลัมน์ auto — ข้อมูลประกอบ Q12) — screenshot ≤ 3

### Test plan (รอบ 38)
| ชนิด | AC |
|---|---|
| e2e ใหม่ (2 viewport) + e2e เดิม `--repeat-each=5` + static เดิม + e2e admin เดิมใน CI + qa | AC-42 |

### Tasks (รอบ 38)
| Task | งาน | ไฟล์ที่แตะ | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-37 | (owner สั่งทำ 2026-11-19 — qa #416 O-1/O-3, builder #416) คอลัมน์ Affiliate ของ payouts `size`/`maxSize` 274 + `{" "}` ใน `AffiliateCell` + คอลัมน์ auto (คอลัมน์สุดท้าย `size: undefined` — Q12 = ก) ใน programs/affiliates/payouts (กฎ 41); red→green: AC-42a1 ล้มบน develop (เนื้อหา cell Affiliate ~3000px), AC-42a2 ล้ม (ชื่อ program ~381px ที่ 1920); qa — ☑ #418 (red 4/7 → green; qa defect ไม่พบ; O-1/O-2 → ROADMAP ปิดรอบ 38) | `apps/backend/src/admin/components/affiliate/payouts-table.tsx`, `.../affiliate/programs-table.tsx`, `.../affiliate/affiliates-table.tsx`, `.../affiliate/list-table.tsx` (`AffiliateCell`), `apps/storefront/e2e/admin-table-long-text.spec.ts`, `apps/storefront/e2e/support/affiliate.ts` (option `reference` ของ `insertDraftPayouts`), `docs/evidence/admin-ui/ADM-37-tests.txt`, `docs/evidence/admin-ui/ADM-37/REPORT.md` (qa — session หลัก commit) | ~10 LOC โค้ด + ~130 LOC test | 1280×800, 1920×1080 | AC-42 | PR เอกสารปิดรอบ 37 merge; ไม่บล็อก release | ไม่มี PR เปิด — ไม่ชน |

## Follow-up รอบ 39 (2026-11-19 — owner ตอบข้อ ก ของ ROADMAP "follow-up ที่รอ planner รอบถัดไป (ปิดรอบ 38)" = ก "แก้แบบ ADM-37")
Status: done (ปิดรอบ 39 2026-11-19 — ADM-38 ☑ #421; owner สั่งทำ 2026-11-19; ไม่บล็อก release) · Out of scope: ตารางที่กว้างเกินกล่องเพราะจำนวนคอลัมน์ (qa #416 O-2), คอลัมน์ Order ของ Ledger (id ของระบบ ไม่ใช่ข้อความอิสระ),
แก้ `AffiliateCell` (กฎ 41b ทำแล้วใน #418), codes/pools/campaigns, จำกัดความยาวที่ validator, แก้/patch `@medusajs/ui`
ที่มา (ตรวจบน develop `c0ec084e`):
- qa #418 O-2: `LedgerTable` (`routes/affiliate/page.tsx:27–66`; คอลัมน์ Created, Affiliate (`AffiliateCell` ร่วมกับ payouts — `list-table.tsx:122–138` มี `{" "}` ของกฎ 41b แล้ว), Order, Amount, Status; ไม่มีคอลัมน์ actions)
  ไม่ตั้ง `size`/`maxSize` → affiliate ชื่อยาวทำให้คอลัมน์ Affiliate 2600px (ตาราง 3203px) ทุกความกว้างจอ → ต้องเลื่อนแนวนอนจึงเห็น Status
- `LedgerTable` ไม่มี wrapper `data-testid` (อีก 3 ตารางของหน้ามี — `programs-table.tsx:140`, `affiliates-table.tsx:162`, `payouts-table.tsx:180`) e2e เดิมหาแถวด้วย `page.getByRole("row")` ทั้งหน้า (`affiliate-admin-names.spec.ts:75`)
- `insertApprovedEntry` (`e2e/support/affiliate.ts:47–74`) ไม่คืน id ของ entry → ใช้กับ `pageOffsetOf` (หาด้วย id) ไม่ได้; `program_id` ของ entry เป็น `model.text()` (ไม่มี FK — `models/commission-entry.ts:8`); ledger อ่านอย่างเดียว ไม่มี API ลบ (spec 05 กฎ 5)
- review #418 (nit กลุ่ม ข ของ ROADMAP ปิดรอบ 38): `e2e/admin-table-long-text.spec.ts:23` `tag()` prefix `adm35-` ใช้กับข้อมูลของ ADM-37 ด้วย; `components/affiliate/payouts-table.tsx:137–139` comment AF-14 (ตำแหน่งคอลัมน์) ติดกับ comment กฎ 41a (ความกว้าง)

### What Medusa already gives us (รอบ 39)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| จำกัดความกว้างคอลัมน์ / คอลัมน์ auto | `size`/`maxSize` ของ column def ของ `DataTable` (`@medusajs/ui` 4.2.8) — แบบกฎ 39a/41 | ใช้ตามเดิม — column option inline ไม่สร้าง component |
| tooltip ข้อความที่ถูกตัด | `TruncatedCell` ของ `DataTable` | ใช้ตามเดิม — คอลัมน์ Affiliate ไม่ตั้ง `___truncateTooltip: false` |

### Data model / Workflows / API routes
none

### Business rules (รอบ 39)
42. (ADM-38 — owner สั่งทำ 2026-11-19 ก "แก้แบบ ADM-37"; qa #418 O-2) ตาราง Ledger คอลัมน์ Affiliate กว้างไม่เกิน 250px ทุกความกว้างจอ (กฎ 41 ใช้กับตารางที่ไม่มีเมนูต่อแถว):
    (a) `LedgerTable` คอลัมน์ `affiliate_id` ("Affiliate") ตั้ง `size: 274, maxSize: 274` (ไม่ใช่คอลัมน์แรก — Created เป็นคอลัมน์แรก; ค่าเดียวกับกฎ 39a/41a); คงลำดับและ cell ของทุกคอลัมน์;
    (b) tooltip "ชื่อ อีเมล" ของ `TruncatedCell` มาจาก `AffiliateCell` เดิม (กฎ 41b) — **ไม่แก้ `AffiliateCell`**; ถ้า (a) กับ tooltip จริงพร้อมกันไม่ได้ → **หยุดและรายงาน planner** (ไม่สร้าง component, ไม่ใช้ `title`, ไม่ patch library);
    (c) คอลัมน์สุดท้าย `status` ("Status") `size: undefined` (คอลัมน์ auto รับความกว้างส่วนเกิน — แบบกฎ 41c, Q12 = ก) + comment อ้างกฎนี้;
    (d) ห่อ `AffiliateListTable` ของ `LedgerTable` ด้วย `<div data-testid="affiliate-ledger-table">` (แบบอีก 3 ตาราง — กฎ 39d) ให้ e2e หาแถวภายในตาราง — เพิ่ม testid ใหม่เท่านั้น ไม่เปลี่ยน testid เดิม (`affiliate-row-affiliate`, `affiliate-list-error`, `affiliate-admin-tab-ledger`);
        ไม่ใช้ `getByRole("tabpanel")` แทน เพราะ (1) สม่ำเสมอกับอีก 3 ตารางที่ e2e หาด้วย wrapper testid (`affiliate-programs-table`/`-affiliates-`/`-payouts-`)
        และ (2) Radix Tabs (`@radix-ui/react-tabs` 1.1.2 `dist/index.mjs:161–172`) render `role="tabpanel"` ครบทุกแท็บ (แท็บที่ไม่ active เป็น `hidden` และไม่มีลูก)
        locator `tabpanel` ที่ resolve ก่อนแท็บ Ledger active จะชี้ panel ของ Programs (แท็บเริ่มต้น) — ไม่ผูกกับตาราง Ledger;
    (e) คงเดิม: `useDate`/`getLocaleAmount`/`Badge`, ไม่สร้าง component/helper ใหม่ (column option inline แบบ payouts);
    (f) (nit review #418 — test/comment-only) `tag()` ของ `admin-table-long-text.spec.ts` รับ prefix ต่อ task: ข้อมูลของ ADM-35 คง `adm35-`, describe ADM-37 ใช้ `adm37-`, describe ADM-38 ใช้ `adm38-`;
        helper `createLongAffiliate` และ `longEmail` (ตอนนี้อยู่ใน describe ของ ADM-37 `admin-table-long-text.spec.ts:241–252` ฝัง prefix `a37-`/`adm37`) ย้ายขึ้นระดับไฟล์และรับ prefix ต่อ task เช่นเดียวกัน
        (ADM-37 คง `a37-`/`adm37`, ADM-38 ใช้ `a38-`/`adm38`) — ADM-37 ยังผ่านโดยไม่แก้ assertion;
        comment ที่ `payouts-table.tsx:137–139` แยก AF-14 (ตำแหน่งคอลัมน์ถัดจากปุ่ม) กับกฎ 41a (ความกว้าง/tooltip) ให้อ่านแยกกันได้ — ไม่เปลี่ยนโค้ด; comment กฎ 41c ที่ซ้ำ 3 ไฟล์คงไว้ (reviewer #418 ยอมรับ)

### Acceptance criteria (รอบ 39)
- AC-43 (ADM-38, กฎ 42) ☑ #421 (a–d ผ่าน: red ขั้น (1) develop `678dc990` + เฉพาะ wrapper testid → a1/a2 ล้มที่เนื้อหา cell Affiliate 2589.5px (ไม่ใช่ locator/timeout; Status อยู่นอกจอ `x + width` 3419px ที่ 1280);
  ขั้น (2) + `size`/`maxSize` → ยังล้ม 261.9px ที่ 1280 และ 409.1px ที่ 1920 (Status อยู่ในจอแล้ว `x + width` 1268px ที่ 1280); ขั้น (3) + Status auto → green 9/9;
  AC-43b 45/45 `--repeat-each=5` (qa 70/70 รวม `admin-row-menu-escape`); ชุด admin เต็ม 98/98; qa วัดที่ 1280/1440/1920: td Affiliate 274px (เนื้อหา 250px) ถูกตัด, Status auto 174/334/734px, `scrollLeft` 0 (develop: Affiliate 2614–2616px, ตาราง 3163–3164px),
  defect ไม่พบ, ข้อสังเกต O-1 → ROADMAP ปิดรอบ 39 — `docs/evidence/admin-ui/ADM-38-tests.txt`, `ADM-38/REPORT.md`)
  (a) e2e ใน `e2e/admin-table-long-text.spec.ts` — `test.describe` ใหม่ที่ `test.use({ evidenceTarget: { feature: "admin-ui", taskId: "ADM-38" } })` (`locale: "en-US"`, `timezoneId: "Asia/Bangkok"` จาก `ADMIN_UI_OPTIONS`) — **ล้มบน develop + เฉพาะ (d)** (wrapper testid ยังไม่มีบน develop — ดู red ขั้น (1) ข้างล่าง):
      ข้อมูล: affiliate ชื่อ 370 ตัวอักษร (`longName`) + อีเมล ≥ 80 ตัวอักษร (helper `createLongAffiliate` ที่ย้ายขึ้นระดับไฟล์และรับ prefix `adm38` ตามกฎ 42f) และ entry approved 1 แถว `order_id` สั้นไม่ซ้ำต่อ run (`insertApprovedEntry` แก้ให้คืน id ของ entry — ผู้เรียกเดิมไม่ต้องแก้;
      `program_id` = โปรแกรม draft จาก `createDraftProgram` ที่ลบใน `finally` ด้วยการตรวจ `ok()`; entry/affiliate ไม่มี API ลบ — คงไว้แบบ e2e AF-14/ADM-8a เดิม) →
      เปิดหน้าด้วย `pageOffsetOf` (`/admin/affiliate/entries`, key `entries`, ลำดับเริ่มต้นของ API) + `?ledger_offset=` แล้วคลิก `affiliate-admin-tab-ledger`; หาแถวภายใน `affiliate-ledger-table` ด้วย `order_id`;
      **ไม่ขึ้นกับข้อมูลใน DB**: เลื่อนแนวตั้งก่อนด้วย td แรกของแถว `scrollIntoView({ block: "center", inline: "start" })` (qa #416 D-1) แล้วจึงตรวจแนวนอน; ไม่ใช้ `scrollIntoViewIfNeeded` ของ cell ท้าย; เส้นทางเมาส์ไม่ผ่าน sidebar (hover ตรงไปที่ cell — qa #416 O-5);
      (a1) 1280×800: td ที่มี `affiliate-row-affiliate` เนื้อหา (ไม่รวม padding) ≤ 250.5px และ `.truncate` `scrollWidth > clientWidth` (กัน vacuous); td สุดท้ายของแถว (Status) `toBeInViewport()`,
           `scrollLeft` ของกล่องเลื่อนของตาราง = 0 และ `x + width` ของ td Status ≤ 1280; hover `.truncate` ของ cell Affiliate → `getByRole("tooltip").filter({ hasText: ชื่อ })` visible และ `` toHaveText(`${ชื่อ} ${อีเมล}`) ``;
      (a2) 1920×1080: ข้อมูลชุดเดียวกัน (สร้างใหม่ใน test นั้น) → เนื้อหา cell Affiliate ≤ 250.5px และถูกตัดจริง, td Status `toBeInViewport()`, `scrollLeft` = 0;
      ใช้ helper เดิมของไฟล์ (`cellMetrics`, `tableScrollLeft`, `openTableAt` — ปรับ type `Table` ให้ `trigger` เป็น optional ได้) ห้ามเพิ่ม `waitForTimeout`/timeout/`retries`/`skip`/`fixme`;
      red→green ต้องแนบ 3 ขั้น (ไม่ vacuous):
      (1) develop + **เฉพาะ (d)** wrapper testid → a1 และ a2 ล้มที่ `cellMetrics().content` ของ cell Affiliate > 250.5 (~2580px) — ที่ 1280 บันทึกด้วยว่า Status `toBeInViewport` หรือ `x + width` ≤ 1280 ล้ม;
          **ห้ามล้มที่การหา locator หรือ timeout** (ถ้าล้มแบบนั้น = red ไม่นับ ให้แก้ test ก่อน);
      (2) + (a) → บันทึกผลวัดที่ 1280 (เนื้อหา cell Affiliate, td Status อยู่ในจอหรือไม่, `x + width` ของ Status, `scrollLeft`) และที่ 1920 (เนื้อหา cell Affiliate ก่อนใส่ (c) —
          คาดว่าเกิน 250 เพราะ Chrome แจกส่วนเกินตามสัดส่วน; ถ้าไม่เกินให้บันทึกตัวเลขและเหตุผล);
      (3) + (c) → green;
  (b) `admin-table-long-text.spec.ts` ทั้งไฟล์ `--repeat-each=5` บน prod build (แบบ CI, `workers=1`) ผ่าน หลังแก้ `tag()` ตามกฎ 42f — แนบใน `docs/evidence/admin-ui/ADM-38-tests.txt` พร้อม red ของ (a);
  (c) e2e admin เดิมที่ใช้ตาราง Ledger (`affiliate-admin-names`, `affiliate-admin-tables`, กรณี ledger ของ `affiliate-admin-forms` (error state กฎ 29)) และผู้เรียก `insertApprovedEntry` อื่นผ่านโดยไม่แก้ assertion (CI `storefront-e2e`);
  (d) qa REPORT `docs/evidence/admin-ui/ADM-38/REPORT.md`: Ledger ชื่อ affiliate ยาวที่ 1280 (ถูกตัด, tooltip "ชื่อ อีเมล", เห็น Status โดยไม่เลื่อนแนวนอน) และที่ 1920 (คอลัมน์ Affiliate ≤ 250px, ส่วนเกินอยู่ท้ายตาราง);
      affiliate ชื่อสั้นใน Ledger แสดงชื่อ + อีเมลเต็มเหมือนเดิม — screenshot ≤ 2

### Test plan (รอบ 39)
| ชนิด | AC |
|---|---|
| e2e ใหม่ (2 viewport) + ทั้งไฟล์ `--repeat-each=5` + e2e admin เดิมใน CI + qa | AC-43 |

### Tasks (รอบ 39)
| Task | งาน | ไฟล์ที่แตะ | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|---|---|---|---|---|---|---|---|
| ADM-38 | (owner สั่งทำ 2026-11-19 ก "แก้แบบ ADM-37" — qa #418 O-2 + nit review #418) Ledger คอลัมน์ Affiliate `size`/`maxSize` 274 + คอลัมน์สุดท้าย Status `size: undefined` + wrapper testid `affiliate-ledger-table` + `tag()` prefix ต่อ task + แยก comment AF-14/กฎ 41a ใน payouts (กฎ 42); red→green 3 ขั้น: (1) develop + เฉพาะ wrapper (d) → AC-43a ล้มที่เนื้อหา cell Affiliate > 250.5 (~2580px) ทั้ง 1280/1920 (ห้ามล้มที่ locator/timeout), (2) + (a) บันทึกผลวัด 1280 (Status) และ 1920, (3) + (c) green; `createLongAffiliate`/`longEmail` ขึ้นระดับไฟล์รับ prefix ต่อ task; qa — ☑ #421 (red ขั้น (1) 2589.5px → ขั้น (2) 261.9/409.1px → ขั้น (3) green; qa 1280/1440/1920 td Affiliate 274px, Status auto 174/334/734px, defect ไม่พบ; O-1 + nit review → ROADMAP ปิดรอบ 39) | `apps/backend/src/admin/routes/affiliate/page.tsx`, `apps/backend/src/admin/components/affiliate/payouts-table.tsx` (comment เท่านั้น), `apps/storefront/e2e/admin-table-long-text.spec.ts`, `apps/storefront/e2e/support/affiliate.ts` (`insertApprovedEntry` คืน id), `docs/evidence/admin-ui/ADM-38-tests.txt`, `docs/evidence/admin-ui/ADM-38/REPORT.md` (qa — session หลัก commit) | ~10 LOC โค้ด + ~90 LOC test | 1280×800, 1920×1080 | AC-43 | PR เอกสารรอบ 39 merge; ไม่บล็อก release | ไม่มี PR เปิด — ไม่ชน |

## Follow-up รอบ 40 (2026-11-21 — การทดสอบ manual เฟส 2/7/8 บน v0.2.0; owner สั่งแก้ใน release เดียว)
ที่มา: ADM-B1 (ADM-M-14 ไม่ผ่าน — Create partner ดับเบิลคลิกเว้น 80–150ms หรือ ⌘+Enter/Save ซ้ำระหว่าง `FocusModal` กำลังปิด → POST 2 ครั้ง partner ซ้ำ; ขัด CLAUDE.md กฎกันกดซ้ำ),
หน้า Affiliates ไม่มีช่องค้นหา (200+ ราย), ตาราง Payouts กว้าง 1417px ที่ 1280/1440, ฟอร์ม program แสดง error ทีละช่อง
**ข้อเท็จจริงที่ตรวจบน develop `87cb20df` (แก้ข้อมูลใน brief)**: backend `GET /admin/affiliate/affiliates` **รับ `q` แล้ว** (ADM-17, `validators.ts:62-65` — `.searchable()` name/email) และ list ทุกตัวของ affiliate มี `tiebreakById` (ADM-24, `apps/backend/src/api/admin/affiliate/middlewares.ts:72-85`)
→ งานค้นหาเป็นฝั่ง UI อย่างเดียว และไม่ต้องแก้การเรียงของ Affiliates; การเรียงที่ต้องแก้คือ e-voucher (spec 02 EV-19)
ไม่ทำ (owner 2026-11-21): ฟอร์ม Refund ของ Medusa ค่าเริ่มต้นยอดเต็ม (ของ dashboard core), ป้าย "(ICT)" บนเครื่อง UTC (เครื่องแอดมินตั้งเวลาไทย — ADR-018), หน้า order แสดงราคารวม VAT

### What Medusa already gives us (รอบ 40)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ปิดฟอร์มหลังบันทึก | `FocusModal` (`@medusajs/ui`) + `RouteFocusModal`/`useRouteModal` ของ `@medusajs/dashboard/components` (ปิดเมื่อสำเร็จ) | ใช้ `FocusModal` แบบ state ตามเดิม (ADR-018 Q5) — ขยาย lock ของเราให้ค้างจนปิด (กฎ 43) |
| ช่องค้นหาของตาราง | `DataTable` ของ `@medusajs/ui` (`search` state + `DataTable.Search`), `useDebouncedSearch`/`useQueryParams` ของ `@medusajs/dashboard/hooks` | ใช้ตามเดิม (กฎ 44) — ไม่สร้าง input เอง |
| ความกว้างคอลัมน์ | column `size`/`maxSize` + คอลัมน์ auto (บทเรียนรอบ 39) | ใช้ตามเดิม (กฎ 45) |
| แสดง error ทุกช่อง | `Form` ของ dashboard + react-hook-form `mode`/`criteriaMode`, `handleSubmit` ตรวจทั้ง schema | ใช้ตามเดิม (กฎ 46) |

### Business rules (รอบ 40)
43. (ADM-39 — ADM-B1) กันกดซ้ำของฟอร์ม**สร้าง**ทุกตัวใน `src/admin/` ที่ปิด `FocusModal` หลังสำเร็จ: lock ไม่ถูกปล่อยเมื่อ request สำเร็จ แต่ค้างจน modal ปิด (unmount/`open=false`) แล้ว reset ตอนเปิดใหม่;
    request ล้ม → ปล่อยทันที (ลองใหม่ได้); ปุ่ม Save `disabled` + ⌘/Ctrl+Enter ผ่าน lock เดียวกัน; แก้ที่ helper เดียว `admin/lib/single-flight.ts` (เช่น option `holdOnSuccess` หรือ `release()` ที่เรียกตอนปิด)
    ไม่ copy ต่อฟอร์ม — ครอบ: partner (`partners-section.tsx`), program (`program-form.tsx`/`programs-table.tsx`), payout (`payout-form.tsx`), campaign (`create-campaign.tsx`),
    variant pool (`variant-evoucher-pool.tsx`), import codes (`import-codes.tsx`) และฟอร์มสร้างอื่นที่ builder พบด้วย grep `createSingleFlight` (รายการใน PR พร้อมเหตุผลของตัวที่ไม่ต้องแก้ — เช่น prompt ที่ไม่ใช่ modal);
    **pool group (`components/group-buy/groups-section.tsx` — แก้ path รอบ 41 ตาม review #430; ไม่ใช่ e-voucher)** เป็นปุ่มสร้างที่ไม่มี modal (แก้ตาม review รอบ 40 ให้ตรงกับ ADM-39): **ไม่** hold lock จนปิด —
    lock เฉพาะระหว่าง request in-flight (ปล่อยเมื่อ response กลับ) + ข้ามคลิกที่สองของดับเบิลคลิก (`event.detail > 1`) — คลิกแยกครั้งหลัง response กลับสร้าง group เพิ่มได้ตามตั้งใจ (AC-44 (a) ใช้กับปุ่มนี้; (b)/(d) ไม่เกี่ยว);
    การกด Enter ค้างบนปุ่ม (keyboard click มี `detail = 0`) → กฎ 50 (ADM-46)
44. (ADM-40) ตาราง Affiliates (`affiliates-table.tsx`) มีช่องค้นหาของ `DataTable` (แก้รอบ 41: `DataTable.Search` ของ dashboard ใส่ `data-testid` ไม่ได้ → e2e หาด้วย
    `getByTestId("affiliate-affiliates-table").getByRole("searchbox")` — ข้อยกเว้นที่ 3 ของการหาด้วย testid, ADR-018 ภาคผนวก 2026-11-21; เดิมเขียน testid `affiliates-search` ซึ่งไม่มีจริง) → ส่ง `q` (debounce ตาม helper ของ dashboard) + reset offset เป็น 0 + เก็บใน URL (`affiliates_q`) แบบ offset ของ ADM-10;
    ผลว่าง → empty state ของ "ไม่พบผล" ของ Medusa (ไม่ใช่ "No affiliates"); ข้อความอังกฤษ
45. (ADM-41) ตาราง Payouts ไม่ล้นแนวนอนที่ 1280 และ 1440 (`scrollWidth ≤ clientWidth` ของ**กล่องเลื่อน `overflow-auto` ของ `DataTable` ภายใน** wrapper `affiliate-payouts-table` — แก้รอบ 41 ตามที่ ADM-41 วัดจริง:
    wrapper อยู่ใต้ div `overflow-hidden` จึง `scrollWidth = clientWidth` เสมอ) — ลดคอลัมน์ข้อความด้วย `size`/`maxSize` + คอลัมน์ auto ตามบทเรียนรอบ 39
    (คง tooltip ของ `TruncatedCell`); ถ้าต้องซ่อนคอลัมน์ให้ย้ายข้อมูลไปที่ drawer/รายละเอียด ไม่ตัดข้อมูลทิ้ง (ระบุใน PR)
46. (ADM-42) ฟอร์ม program (สร้าง/แก้) กด Save ด้วยค่าที่ผิดหลายช่อง → แสดง `Form.ErrorMessage` **ทุกช่องที่ผิดพร้อมกัน** ในครั้งเดียว (รวม refine ข้ามช่อง เช่น `ends_at > starts_at` และ scope ว่าง) — ไม่ใช่ทีละช่อง;
    400 จาก API ที่ map เข้าช่องได้ → ใต้ช่อง ที่เหลือ → toast (แบบกฎ 36e)

### Acceptance criteria (รอบ 40)
- AC-44 (ADM-39, กฎ 43) ☑ (a–d ผ่าน: red บน develop `73148c83` partner POST 2 ครั้ง, campaign 2 (ทั้ง (a) และ (b)), pool group 2 → green 7/7, `--repeat-each=3` 21/21; unit helper 7/7; `docs/evidence/admin-ui/ADM-39-tests.txt`) e2e admin — **ล้มบน develop** ก่อน (partner ซ้ำ 2 แถว): ทุกฟอร์มในกฎ 43: (a) dblclick Save เว้น 100ms → POST 1 ครั้ง; (b) Save แล้วกด ⌘/Ctrl+Enter ซ้ำทันทีหลัง response ระหว่าง modal ปิด → POST 1 ครั้ง;
  (c) API ตอบ 500 (route mock) → กด Save ได้อีกและ POST ครั้งที่ 2 เกิด; (d) เปิดฟอร์มใหม่หลังสร้างสำเร็จ → Save กดได้; unit jest ของ helper ครอบ hold/release/error; นับ request ด้วย `page.on("request")`
- AC-45 (ADM-40, กฎ 44) ☑ (red บน develop `cb934dac`: ไม่มีช่องค้นหาในตาราง Affiliates → green `--repeat-each=3` 3/3 รวม reset offset จากหน้า 2 และ empty state "No results"; หลัง reload ต้องคลิกแท็บ Affiliates เพราะแท็บไม่อยู่ใน URL; `docs/evidence/admin-ui/ADM-40-tests.txt`) e2e admin: affiliate 3 ราย (tag ตัวอักษรตามกฎ 33) พิมพ์ชื่อหนึ่งราย → รอ response ที่ `pathname === "/admin/affiliate/affiliates"` และ `q` ตรง แล้ว assert `count` = 1 และตารางมี 1 แถว; URL มี `affiliates_q`; reload แล้วผลคงเดิม; ล้างช่อง → แถวกลับ
- AC-46 (ADM-41, กฎ 45) ☑ (red บน develop `0e5295de`: กล่องเลื่อนของ DataTable ใน wrapper `scrollWidth` 1400 > `clientWidth` 1036/1196 ที่ 1280/1440 → green 2/2; ทั้งไฟล์ `admin-table-long-text.spec.ts` 11/11 — wrapper เองอยู่ใต้ div `overflow-hidden` ของ DataTable จึง `scrollWidth = clientWidth` เสมอ test วัดกล่องเลื่อนภายใน wrapper ด้วย; `docs/evidence/admin-ui/ADM-41-tests.txt`) e2e admin ที่ 1280×800 และ 1440×900 ด้วย payout ที่ affiliate ชื่อยาว 370 ตัว: wrapper `affiliate-payouts-table` `scrollWidth ≤ clientWidth + 1`, ปุ่ม `…` ของทุกแถวอยู่ในจอ, tooltip ยังแสดงชื่อเต็ม (ล้มบน develop: 1417px)
- AC-47 (ADM-42, กฎ 46) ☑ (red บน develop `0e5295de` เห็นแค่ error ของ name → green: error 4 ช่องพร้อมกัน ไม่มี POST, `--repeat-each=3` 3/3; unit `toProgramBody` คืน error ทุกช่อง; `docs/evidence/admin-ui/ADM-42-tests.txt`) e2e admin: ฟอร์ม Create program ว่าง + `ends_at < starts_at` กด Save ครั้งเดียว → error ใต้ช่อง name, commission, ends_at และ scope พร้อมกัน (นับ `Form.ErrorMessage` ที่มองเห็น ≥ 4) และไม่มี POST (ล้มบน develop ที่เห็นทีละช่อง)

### Test plan (รอบ 40)
| ระดับ | AC |
|---|---|
| unit jest + e2e admin + qa | AC-44 |
| e2e admin + qa | AC-45, AC-46, AC-47 |

### Tasks (รอบ 40)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| ADM-39 | (ADM-B1) lock ของฟอร์มสร้างค้างจน modal ปิด — ทุกฟอร์ม (กฎ 43); qa | `src/admin/lib/single-flight.ts` (+ unit), ฟอร์มในกฎ 43, e2e `admin-create-double-submit.spec.ts` (ใหม่) | ~60 LOC + ~250 LOC test (เกิน ~400 → แยก ADM-39a evoucher+affiliate / ADM-39b group buy+widget) | AC-44 | PR เอกสารรอบ 40 | หลายไฟล์ admin — **merge ก่อน** ADM-40/41/42, EV-21 |
| ADM-40 | ช่องค้นหา Affiliates (UI อย่างเดียว) (กฎ 44); qa | `src/admin/components/affiliate/affiliates-table.tsx`, e2e | ~40 LOC + ~100 LOC test | AC-45 | ADM-39 (`affiliates-table.tsx` ใช้ single-flight) | — |
| ADM-41 | ตาราง Payouts ไม่ล้นที่ 1280/1440 (กฎ 45); qa | `src/admin/components/affiliate/payouts-table.tsx`, `e2e/admin-table-long-text.spec.ts` | ~20 LOC + ~80 LOC test | AC-46 | ADM-39 (`payouts-table.tsx`) | `admin-table-long-text.spec.ts` |
| ADM-42 | error ทุกช่องพร้อมกันในฟอร์ม program (กฎ 46); qa | `src/admin/components/affiliate/program-form.tsx`, `src/admin/lib/affiliate-*form*.ts`, e2e | ~40 LOC + ~100 LOC test | AC-47 | ADM-39 (`program-form.tsx`) | — |

ลำดับ: ADM-39 → (ADM-40 ∥ ADM-41 ∥ ADM-42 ∥ EV-21 ของ spec 02)

## Follow-up รอบ 41 (2026-11-21 — owner: ทุกข้อใน release v0.3.0)
ที่มา: qa ADM-40 (ค้นด้วย code ไม่เจอ, `%`/`_` เป็น wildcard, ช่องว่างไม่ trim, แท็บ Affiliate ไม่อยู่ใน URL), qa ADM-42 (error ของ ends_at ค้างหลังแก้ starts_at; ฟอร์ม edit program เป็น FocusModal ขัด Q5; nit `shouldFocus` ของ DatePicker),
qa ADM-41 (คอลัมน์ Affiliate ของ Payouts 150px เห็นชื่อ ~15 ตัวแม้จอใหญ่), ADM-39 เสนอ (Save ยังกดได้ระหว่างแอนิเมชันปิด), review #430 (Enter ค้างบนปุ่ม pool group)
แก้ถ้อยคำแล้วใน PR เอกสารรอบ 41: กฎ 41a/41c (ค่าหลัง ADM-41), กฎ 43 (path/ข้อความ pool group), กฎ 44 (searchbox — ข้อยกเว้นที่ 3), กฎ 45 (วัดกล่อง overflow-auto)
งาน admin ของรอบนี้ใน spec อื่น: spec 02 EV-24 (ปุ่ม Retry allocation), spec 06 PAY-10 (widget refund ถูกกัน)

### What Medusa already gives us (รอบ 41)
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ค้นหาหลาย field | `.searchable()` ของ data model (`q` → ILIKE ของ field ที่ searchable — ADM-17) | ใช้ตามเดิม เพิ่ม `code` (กฎ 47) |
| แท็บ | `Tabs` ของ `@medusajs/ui` (controlled `value`), `useSearchParams` ของ react-router ใน admin | ใช้ตามเดิม (กฎ 47c) |
| ฟอร์มแก้ไข | `Drawer` ของ `@medusajs/ui` + `Form` ของ `@medusajs/dashboard/components` (ADR-018 Q5) | ใช้ตามเดิม (กฎ 48) |
| re-validate ข้ามช่อง | react-hook-form `trigger(name)` | ใช้ตามเดิม (กฎ 48a) |
| ความกว้างคอลัมน์ | column `size`/`maxSize` ของ `DataTable` | ใช้ตามเดิม — ไม่สร้าง component (กฎ 49) |

### Business rules (รอบ 41)
47. (ADM-43) (a) `GET /admin/affiliate/affiliates?q=` ค้น `code` ด้วย (เพิ่ม `.searchable()` ที่ `code` ของ model — builder ยืนยันด้วย `db:generate` ว่าไม่มี migration; มี → บันทึกใน PR);
    (b) validator: `q` ถูก `trim()` — ว่างหลัง trim = ไม่มี `q`; `%`, `_` และ `\` ในคำค้นเป็นตัวอักษรธรรมดา (escape ตามที่ query ของ Medusa ใช้ — builder ตรวจว่า Medusa escape ให้หรือไม่ก่อนเพิ่มเอง ไม่ escape ซ้ำ);
    (c) แท็บของหน้า Affiliate (Programs/Affiliates/Ledger/Payouts) อยู่ใน URL (`?tab=<key>`) — reload/แชร์ลิงก์กลับแท็บเดิม; ไม่มี/ค่าผิด → Programs; ค่า `<prefix>_offset`/`affiliates_q` เดิมคงอยู่
48. (ADM-44) ฟอร์ม program: (a) เปลี่ยน `starts_at` ขณะ `ends_at` มี error → `trigger("ends_at")` ทันที (error ข้ามช่องหายเมื่อแก้ถูก ไม่ต้องกด Save); (b) ฟอร์ม**แก้ไข** program เป็น `Drawer` แบบ state (ADR-018 Q5)
    ใช้ field/validation/กันกดซ้ำ/prompt ก่อนปิด (กฎ 31)/`useRestoreOpenerFocus` เดิม — ฟอร์มสร้างคง `FocusModal`; testid ของ field คงเดิม (testid ของ container ใหม่ระบุใน PR); (c) nit ADM-42: `DatePicker` ที่ error ได้ focus เมื่อ Save (`shouldFocus`) ตามที่ `Form` ของ dashboard รองรับ
49. (ADM-45 — แทนค่า 150 ของกฎ 45 ที่จอใหญ่) คอลัมน์ Affiliate ของ Payouts: ที่ 1920×1080 เนื้อหากว้าง ≥ 240px และ ≤ 250.5px (เพดานกฎ 41); ที่ 1280/1440 ยังไม่ล้น (กฎ 45) และปุ่ม `…` อยู่ในจอ; tooltip เดิม;
    ทำด้วย option ของ `DataTable`/className ของ cell เท่านั้น — ถ้าต้องสร้าง component/วัดจอเองด้วย JS → **หยุดและรายงาน planner**; แก้ comment ที่ขัดกันใน `payouts-table.tsx` (~`:168–170` "250px" vs "100px")
50. (ADM-46) ฟอร์มสร้างทุกตัวของกฎ 43: ปุ่ม Save `disabled` ตลอดช่วงที่ lock ถูก hold (สำเร็จแล้วระหว่างแอนิเมชันปิด) ไม่ใช่แค่ไม่ยิง request — อ่านสถานะจาก helper `single-flight.ts` เดียว (ไม่ copy);
    ปุ่ม pool group (`components/group-buy/groups-section.tsx`): keyboard click ที่มาจากการกดปุ่มค้าง (`keydown` ที่ `repeat === true`) ถูกข้าม — กด Enter ค้าง 1 ครั้ง = สร้าง 1 group
    (ฟอร์ม program ใช้ไฟล์ร่วมกับ ADM-44 — ตัวหลัง sync)

### Acceptance criteria (รอบ 41)
- AC-48 (ADM-43, กฎ 47) ☑ (red บน develop `b1896690`: integration `q=ANNPROMO` ได้ 0 และหลังเพิ่ม `.searchable()` `q=%` ได้ทุกแถว (Medusa 2.22.1 ไม่ escape); e2e คลิกแท็บ Affiliates แล้ว URL ไม่มี `tab` → green integration `affiliate-admin.spec.ts` 39/39, e2e `--repeat-each=3` 6/6 (รวม AC-45 เดิมที่แก้ step reload); `db:generate affiliate` = ไม่มี migration; `docs/evidence/admin-ui/ADM-43-tests.txt`) integration http + e2e admin — **ล้มบน develop** ก่อน: (a) `q=<code>` ได้ affiliate นั้น (count 1); `q="  <name>  "` = ผลเดียวกับไม่มีช่องว่าง; `q="%"` และ `q="_"` ได้ 0 (affiliate ทดสอบไม่มีอักขระนี้) ไม่ใช่ทั้งหมด;
  (b) e2e: เลือกแท็บ Affiliates → URL มี `tab=affiliates` → reload → แท็บ Affiliates ยังถูกเลือก (ล้มบน develop — กลับ Programs); searchbox หาด้วย role ใน wrapper (กฎ 44)
- AC-49 (ADM-44, กฎ 48) ☑ (red บน develop `8471f3c0`: (c) focus ไม่อยู่ที่ DatePicker ของ ends_at, (a) เมื่อตัด assert focus ออก error ของ ends_at ค้างหลังเลื่อน starts_at, (b) ไม่มี Drawer `affiliate-program-drawer` → green `--repeat-each=3` 6/6; Drawer = role `dialog` ที่มี testid `affiliate-program-drawer` และ class `sm:max-w-[560px]` ของ `Drawer.Content`; `docs/evidence/admin-ui/ADM-44-tests.txt`) e2e admin: (a) ตั้ง `ends_at < starts_at` กด Save → error ใต้ ends_at; เลื่อน `starts_at` ให้ก่อน ends_at → error หายภายใน 1 วินาทีโดยไม่กด Save (ล้มบน develop);
  (b) เปิดแก้ไข program → เห็น `Drawer` (role `dialog` ที่มี class/attribute ของ Drawer ตามที่ builder ระบุ) ไม่ใช่ FocusModal; Save แก้ได้ 1 PATCH/POST (dblclick); Escape ขณะ dirty → prompt (กฎ 31) — e2e เดิมของ edit program ผ่านหลังแก้ locator
- AC-50 (ADM-45, กฎ 49) e2e ใน `admin-table-long-text.spec.ts` ที่ 1920×1080 / 1440×900 / 1280×800 ด้วย affiliate ชื่อยาว: 1920 เนื้อหา cell Affiliate ∈ [240, 250.5]px (ล้มบน develop — ~126px); 1280/1440 กล่อง overflow-auto `scrollWidth ≤ clientWidth + 1` และปุ่ม `…` อยู่ในจอ; tooltip แสดงชื่อเต็ม
- AC-51 (ADM-46, กฎ 50) ☑ (red บน develop `53e758a2`: (a) Save ของ partner/campaign/variant pool กดได้ทุก frame หลัง response, (b) Enter ค้าง → POST 2 ครั้ง; unit `isLocked`/`subscribe` ไม่มี → green unit helper 11/11, e2e 8/8 และ `--repeat-each=3` 24/24; program/payout ถูกถอดทันทีเมื่อปิด (ไม่มี frame ให้ตรวจ — disabled ผ่าน helper เดียวกัน); import codes disabled อยู่แล้วด้วย `!file`; `docs/evidence/admin-ui/ADM-46-tests.txt`) e2e admin + unit helper: (a) ทุกฟอร์มในกฎ 43: หลัง POST สำเร็จ ระหว่าง modal ปิด ปุ่ม Save มี `disabled` (ตรวจ attribute ใน `requestAnimationFrame` ถัดจาก response) — ล้มบน develop+ADM-39;
  (b) โฟกัสปุ่มสร้าง pool group แล้ว dispatch `keydown Enter` ซ้ำ 5 ครั้ง (`repeat: true` หลังครั้งแรก) → POST 1 ครั้ง; คลิกแยก 2 ครั้งหลัง response → 2 group (regression กฎ 43)

### Test plan (รอบ 41)
| ระดับ | AC |
|---|---|
| integration http + e2e admin + qa | AC-48 |
| e2e admin + qa | AC-49, AC-50 |
| unit jest + e2e admin + qa | AC-51 |

### Tasks (รอบ 41)
| ID | Task | ไฟล์ที่น่าจะแตะ | ขนาด | AC | Depends | ชนไฟล์ |
|----|------|------|------|----|---------|------|
| ADM-43 | ค้น Affiliates ด้วย code + trim/escape + แท็บใน URL (กฎ 47); qa | `src/modules/affiliate/models/affiliate.ts`, `src/api/admin/affiliate/validators.ts`, `src/admin/routes/affiliate/page.tsx` (Tabs), e2e `affiliate-admin-search.spec.ts`, integration | ~40 LOC + ~150 LOC test | AC-48 | PR เอกสารรอบ 41 | `routes/affiliate/page.tsx` |
| ADM-44 | ends_at re-validate + ฟอร์มแก้ program เป็น Drawer + nit shouldFocus (กฎ 48); qa | `src/admin/components/affiliate/program-form.tsx`, `programs-table.tsx`, e2e | ~120 LOC + ~120 LOC test | AC-49 | PR เอกสารรอบ 41 | `program-form.tsx` (ADM-46) |
| ADM-45 | คอลัมน์ Affiliate ของ Payouts กว้างขึ้นที่จอใหญ่ (กฎ 49); qa | `src/admin/components/affiliate/payouts-table.tsx`, `e2e/admin-table-long-text.spec.ts` | ~20 LOC + ~80 LOC test | AC-50 | PR เอกสารรอบ 41 | `admin-table-long-text.spec.ts` |
| ADM-46 | Save disabled ระหว่างปิด modal ทุกฟอร์มสร้าง + Enter ค้างบนปุ่ม pool group (กฎ 50); qa | `src/admin/lib/single-flight.ts` (+ unit), ฟอร์มในกฎ 43, `components/group-buy/groups-section.tsx`, e2e `admin-create-double-submit.spec.ts` | ~60 LOC + ~150 LOC test | AC-51 | **ADM-44** (`program-form.tsx`) | ฟอร์มสร้างทุกตัว (EV-24 ใช้ single-flight — คนละไฟล์) |

ลำดับ: ADM-43 ∥ ADM-44 ∥ ADM-45 → ADM-46 (หลัง ADM-44)

## Open questions
- ~~**Q12**~~ **ตัดสินแล้ว (owner 2026-11-19 ก่อน ADM-37 เริ่ม) = (ก)** คอลัมน์สุดท้ายเป็น auto — ทำแล้วใน ADM-37 #418 (กฎ 41c) — คำถามเดิม:
  (รอบ 38, ADM-37 กฎ 41c — ไม่บล็อก ADM-37) คอลัมน์ไหนรับความกว้างส่วนเกินที่จอกว้าง: คอลัมน์ actions อยู่**กลางตาราง**ใน programs (คอลัมน์ 3), affiliates (คอลัมน์ 5), payouts (คอลัมน์ 2)
  ต่างจาก partners ที่อยู่ท้าย → ถ้า actions เป็น auto ที่ 1920 จะมีช่องว่างกว้างระหว่างปุ่ม `…` กับคอลัมน์ถัดไป
  (ปิดรอบ 38 แก้ตัวเลขตาม review #417: เดิมเขียน "ประมาณ 290px" ซึ่งเป็นค่าประมาณส่วนเกินของคอลัมน์ ไม่ใช่ช่องว่างจริง — ผลวัดใน `docs/evidence/admin-ui/ADM-37-tests.txt` ที่ 1920:
  ทาง (ข) จำลองใน DOM ช่องว่างหลังปุ่ม programs 479px, affiliates 421px (payouts 48px — ตารางพอดีเนื้อหา); ทาง (ก) ที่ทำ ช่องว่างหลังปุ่ม 122px / 122px / 91px):
  (ก) **[Recommended]** คอลัมน์**สุดท้าย**ของแต่ละตาราง (programs "Hold days", affiliates "Joined", payouts "Payout") เป็น auto แทน — ปุ่มยังชิดคอลัมน์ข้างเคียงเหมือนเดิม ช่องว่างอยู่ท้ายตาราง (แบบ partners); ขนาดงานเท่ากัน;
  (ข) actions เป็น auto ตามที่สั่ง 2026-11-19 — ยอมรับช่องว่างกลางตาราง;
  ทั้งสองทางผ่าน AC-42 เท่ากัน (AC ตรวจความกว้างคอลัมน์ข้อความและตำแหน่งปุ่ม ไม่ตรวจว่าคอลัมน์ไหนเป็น auto)
- ~~**Q11**~~ **ตัดสินแล้ว (owner 2026-11-19 ปิดรอบ 37) = (ก)** ปิดข้อนี้ ไม่ patch ไม่เปิด issue (ผลวัดทาง (A) — กฎ 40d) — คำถามเดิม: (รอบ 37, ADM-36 — **ถามเฉพาะเมื่อด่านวัดของกฎ 40a ได้ทาง (A)**) Escape ในเฟรมแรกที่เมนูโผล่ถูกทิ้งเหมือนกันในหน้าของ Medusa ที่ใช้ `DataTable` แบบเดียวกัน — แก้ไม่ได้โดยไม่ fork/patch library:
  (ก) **[Recommended]** ปิดข้อนี้ — คนกดไม่ทันภายใน 1 เฟรม (≥ 16ms ไม่ค้าง), e2e รอ animation จบอยู่แล้ว (`waitMenuOpened`), พฤติกรรมเท่ากับ Medusa admin;
  (ข) patch `@medusajs/ui` ด้วย `pnpm patch` — ต้องมี ADR (ขัดหลักไม่แก้ library ของ ADR-018/spec นี้) และต้องตรวจซ้ำทุกครั้งที่ bump;
  (ค) เปิด issue ที่ repo ของ Medusa พร้อม probe — ไม่มีโค้ดของเรา รอ upstream
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
