# 09 Storefront ใช้ shadcn/ui (Radix) บน Tailwind v4 (SFUI)
Status: accepted (owner 2026-11-26: ADR-030 accepted, Q1 = ยอมรับ, Q2 = งด release ระหว่าง SFUI-2..6) — **ทำงานแบบ stack ได้** (owner อนุญาต 2026-11-26 เป็นข้อยกเว้นของกติกา
"ห้ามแตก branch จาก PR ที่ยังไม่ merge" เฉพาะชุด SFUI): SFUI-1a แตกจาก branch เอกสาร `docs/SFUI-shadcn-adr-spec`, task ถัดไปแตกต่อจาก branch ของ task ที่อยู่ใน Depends
(task ขนานแตกจาก SFUI-2 ตัวเดียวกัน; SFUI-6 แตกจาก branch ที่รวม 3a..5e แล้ว) โดยไม่ต้องรอ PR merge → เปิด PR ทั้งชุดพร้อมกันตอนท้าย (base = `develop`) แล้ว merge ตามลำดับในตาราง Tasks
· SFUI-1a..7 ☑ (#565–#581); รอบ 45 เก็บกวาด (SFUI-8, 9a–9e, 10) ดูหัวข้อ "ส่วนเก็บกวาดหลัง SFUI-7" (owner 2026-11-26 "เก็บต่อเลย");
รอบ 48 ฟอร์ม (SFUI-11a..13, ADR-032 accepted 2026-11-27) ☑ (#605–#610; เอกสาร #604) ดูหัวข้อ "ส่วนฟอร์ม (รอบ 48)";
รอบ 49 select เป็น Radix + ช่องตำบล/ที่อยู่ไทย (SFUI-15..18c, ADR-033 accepted 2026-11-28) ☑ (#614–#622) + SFUI-14 ☑ #612 ดูหัวข้อ "ส่วน select + ที่อยู่ไทย (รอบ 49)";
รอบ 50 ปุ่มขนาดเดียว/ซ่อนประเทศ/จังหวัดบังคับ/consistency (SFUI-19a..22, ADR-034 accepted 2026-11-28) ☐ ดูหัวข้อ "ส่วน consistency + ที่อยู่ (รอบ 50)"
Goal (owner's words, 2026-11-26): เปลี่ยน storefront (`apps/storefront`) จาก UI ของ Medusa เป็น shadcn/ui (Radix) — แทนทั้ง 4 ชั้น (shim `common/components/ui`,
`@medusajs/ui-preset` + `thai-ui-preset.js` + class `txt-*`/`h*-webs`, `@medusajs/icons` → `lucide-react`, `@headlessui/react` → Radix ผ่าน shadcn) และถอด `tailwindcss-radix`;
อัป Tailwind v3 → v4 ก่อนแล้วใช้ shadcn CLI รุ่นล่าสุด; ยอมให้หน้าตาเปลี่ยนเป็นสไตล์ shadcn แต่ยังใช้สี brand ตาม ADR-008
Out of scope: admin (`apps/backend/src/admin` — ADR-018), เปลี่ยนพฤติกรรม/flow/ข้อความไทย/route ของร้าน, dark mode, i18n (ADR-014), icon SVG ที่ starter เขียนเองใน
`src/modules/common/icons/*`, สไตล์ภายใน Stripe Elements (appearance API), หน้าใหม่, เปลี่ยน `data-testid`

การตัดสินใจและเวอร์ชัน dependency: ADR-030 (accepted 2026-11-26)

## What Medusa already gives us
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ชั้น commerce ของ storefront (route, data layer, JS SDK, cache, Stripe Elements) | Medusa Next.js Starter (ADR-002) | ใช้ตามเดิม — ไม่แตะ |
| design token + typography | `@medusajs/ui-preset` 2.22.1 — Tailwind **v3 เท่านั้น** (`peer tailwindcss ^3.4.3`) | **แทน** ด้วย token ของ shadcn ใน `@theme` (owner: อัป v4) — ชั้นเข้ากันได้ชั่วคราวระหว่างย้าย (กฎ 16) |
| component (Button, Input, Table ฯลฯ) | `@medusajs/ui` (ของ admin; starter ของเราใช้ shim ที่เขียนเองแทนอยู่แล้ว) | **แทน** shim ด้วย shadcn `button`, `input`, `label`, `badge`, `table`, `checkbox`, `radio-group` (`<select>` native คงเป็นของเราเอง — กฎ 4) |
| icon | `@medusajs/icons` | **แทน** ด้วย `lucide-react` (iconLibrary ของ shadcn) |
| overlay/select/disclosure | ไม่มี (starter ใช้ `@headlessui/react`) | **แทน** ด้วย shadcn `dialog`, `sheet`, `popover`, `select`, `collapsible` (Radix) |
| accordion/slider | ไม่มี (starter ใช้ `@radix-ui/react-accordion`/`-slider` ตรง) | shadcn `accordion`, `slider` (Radix เดิม ห่อแบบ shadcn) |
| plugin UI จาก medusajs.com/integrations | ไม่มีสำหรับ storefront | — |
| Text/Heading/Container ของ shim | shadcn ไม่มี component typography (ใช้ utility) | **ไม่สร้าง component ใหม่** — เขียนเป็น element ธรรมดา + utility ตามตาราง map (กฎ 20) |

## Data model (only new/changed)
none

## Workflows (name, steps, compensation)
none

## API routes (store / admin), auth, request/response shape
none

## Admin UI (widgets/pages) and Storefront pages
- Admin: none
- Storefront: ไม่มีหน้าใหม่; ทุกหน้าเปลี่ยนชั้นแสดงผล ไฟล์ใหม่: `apps/storefront/components.json`, `src/components/ui/*.tsx` (จาก CLI), `src/lib/utils.ts`,
  `src/styles/legacy-medusa.css` (ชั่วคราว SFUI-1a → ลบ SFUI-6); ไฟล์ที่ลบ: `tailwind.config.js`, `src/styles/thai-ui-preset.js`, `src/styles/ui-preset-font.test.ts`,
  `src/styles/tailwind-config.test.ts` (SFUI-1a), `src/modules/common/components/{ui,radio}/`, `src/modules/common/components/modal/` (SFUI-3a), `legacy-medusa.css` (SFUI-6)

## Business rules (numbered, testable)
1. Tailwind 4.3.5 แบบ CSS-first: ไม่มี `tailwind.config.*`; `postcss.config.*` มี plugin `@tailwindcss/postcss` ตัวเดียว; `globals.css` ขึ้นต้นด้วย `@import "tailwindcss"`
   ค่า theme เดิม (brand, grey, breakpoints `2xsmall`/`xsmall`/`small`/`medium`/`large`/`xlarge`/`2xlarge`, `borderRadius` `soft`/`base`/`rounded`/`large`/`circle`, `max-w-8xl`,
   `text-3xl` = 2rem, keyframes/animation `ring`, `fade-in-right`, `fade-in-top`, `fade-out-top`, `accordion-*`, `enter`, `leave`, `slide-in`) ย้ายเป็น `@theme` ชื่อ class เดิมใช้ได้
   (`accordion-*` ของ v3 และ token `--chart-*`/`--sidebar-*` ที่ shadcn init สร้างถูกลบใน SFUI-6 เพราะไม่มีผู้ใช้ — `Accordion` ของ shadcn ใช้ `animate-accordion-down/up` ของ `tw-animate-css`);
   class เดิมใน `globals.css` ที่ถูก `@apply` (`text-xsmall-regular` … `text-3xl-semi`) เป็น `@utility` (ลบใน SFUI-10 — กฎ 24)
2. `components.json` ตาม ADR-030 ข้อ 2 (style `new-york`, ติดตั้งด้วย `pnpm dlx shadcn@4.23.1 init -b radix`, `tailwind.config: ""`, `baseColor: "neutral"`, `iconLibrary: "lucide"`,
   aliases `@/components`, `@/components/ui`, `@/lib/utils`, `@/lib`, `@/hooks`); `tsconfig.json` มี `"@/*": ["*"]`; `src/lib/utils.ts` export `cn` ที่สร้างด้วย `createCn` จาก `cn/config` โดย extend classGroups `font-size` ด้วย utility ขนาดฟอนต์ `text-*` ของ `globals.css` (`FONT_SIZE_UTILITIES`) — กัน tailwind-merge ตัด `text-xl-semi` ฯลฯ เมื่อคู่กับ `text-ui-fg-*` (ตัดสิน 2026-11-26 ระหว่าง SFUI-2) — ใช้กับโค้ดนอก `src/components/ui/` (**จนถึง SFUI-10** — หลังจากนั้น `src/lib/utils.ts` = `export { cn } from "cn"` ตาม ADR-030 ข้อ 3; กฎ 24);
   **component ใน `src/components/ui/*` ใช้ `cn` ตามผล CLI (`import { cn } from "cn"` — SFUI-7, owner 2026-11-26)** ซึ่งไม่รู้จัก utility ขนาดฟอนต์ของเรา (ถือเป็นสีตัวอักษร: ตัด `text-<สี>` ของ primitive
   หรือถูกตัดเมื่อคู่กับ `text-<สี>`) และ package `cn` 0.5.2 ไม่มี config ระดับ global (config ทำได้แค่ `createCn` ของ `cn/config` ที่ได้ฟังก์ชันใหม่ หรือ `cn build`/`withCn` ที่สร้างตาราง
   ให้ `cn/engine` — `import { cn } from "cn"` ใช้ตารางค่าเริ่มต้นเสมอ) → **className/argument ที่ส่งเข้า component ของ `@/components/**` ห้ามมี `text-{xsmall,small,base,large,xl,2xl,3xl}-{regular,semi}`**
   ใช้ utility มาตรฐานที่ได้ค่าเท่ากัน (ตาม `@apply` ใน `globals.css`): `xsmall-*` → `text-[10px] leading-4`, `small-*` → `text-xs leading-5`, `base-*` → `text-sm leading-6`, `large-*` → `text-base leading-6`,
   `xl-*` → `text-2xl leading-[36px]`, `2xl-*` → `text-[30px] leading-[48px]`, `3xl-*` → `text-[32px] leading-[44px]` + `font-normal` (`-regular`) / `font-semibold` (`-semi`) — AC-19
3. component ของ shadcn เพิ่มด้วย `pnpm dlx shadcn@4.23.1 add <name>` ลง `src/components/ui/` เท่านั้น และเฉพาะตัวที่ task ระบุ (ตาราง Tasks); add ตัวที่มีอยู่แล้วซ้ำใช้ `--overwrite`;
   **ห้ามแก้ไฟล์ใน `src/components/ui/`** — ต้องตรงกับผลของ CLI ตามตัวอักษร (SFUI-7, owner 2026-11-26): ตรวจกับ CLI จริงในเครื่อง (ต้องใช้เน็ต) ด้วย
   `pnpm dlx shadcn@4.23.1 add <name> --dry-run --diff` ทีละตัวครบทุกไฟล์ใน `ui/` ต้องได้ "No changes." ทุกตัว (ไม่เขียนไฟล์; ใส่หลายตัวในคำสั่งเดียว CLI แสดง diff แค่ 5 ไฟล์แรก);
   hash ของแต่ละไฟล์อยู่ใน `e2e/support/shadcn-ui.json` (test offline ของ AC-19) — add/`--overwrite` แล้วอัปเดตด้วย `shasum -a 256 src/components/ui/<name>.tsx`
   (test พิมพ์ hash จริงเมื่อไม่ตรง) และห้ามรับการแก้ `package.json`/lockfile/`globals.css` ที่ CLI เสนอ (ADR-030 ข้อ 3, 7); ปรับด้วย className/props ที่ primitive รับ หรือ **wrapper** `src/components/<name>.tsx` (ชื่อไฟล์และชื่อ export เดียวกับใน `ui/`
   เปลี่ยนแค่ path import) ที่ประกอบจาก export ของ `ui/*` ก่อน — ถ้า `ui/*` ไม่เปิด prop ที่ต้องใช้ ประกอบจาก primitive ของ `radix-ui` ด้วย class เดียวกับไฟล์ใน `ui/` พร้อม test เทียบ DOM
   กับของ CLI (`src/components/wrappers.test.tsx`); wrapper ปัจจุบัน: `button` (`isLoading` — กฎ 20), `sheet` (`SheetContent` + `overlayProps`; ไม่มีปุ่มปิดในตัว — ผู้เรียกใส่ `SheetClose` เอง), `slider` (`thumbLabels`),
   `radio-group` (`RadioGroupItem` render `children`); ผู้เรียกที่ไม่ใช้ความสามารถเพิ่มใช้ `@/components/ui/*` ตรง; ปุ่มปิดในตัวของ `DialogContent`/`SheetContent`/`DialogFooter` จาก CLI
   มีข้อความ "Close" → ใช้จาก `ui/` ต้องส่ง `showCloseButton={false}` แล้วใส่ปุ่มปิดชื่อไทยเอง (`DialogClose`/`SheetClose`); wrapper ใช้ `cn` ของ `@/lib/utils` (ต่างจาก `ui/` ที่ใช้ package `cn`)
   แต่ utility ขนาดฟอนต์ของ `globals.css` ห้ามส่งเข้า wrapper เช่นเดียวกับ `ui/` (กฎ 2); test ของ component อยู่นอก `ui/` (AC-19);
   ห้ามสร้างไฟล์ใน `src/components/ui/` ที่ไม่มาจาก registry ของ shadcn; task 2–5 ห้ามแก้ `package.json`/`pnpm-lock.yaml`
   (component ต้องการ dependency ใหม่ → หยุดรายงาน planner)
4. map primitive (ADR-030 ข้อ 5): modal ที่อยู่ → `Dialog`; side menu → `Sheet side="left"`, search drawer → `Sheet side="top"`, mobile actions → `Sheet side="bottom"`;
   cart dropdown → `Popover` (คงการเปิดเมื่อ hover/เพิ่มสินค้า และปิดตามเดิม); `layout/country-select`, `checkout/address-select` → `Select`; `account-info` → `Collapsible`;
   ตัวเลือกจัดส่ง/ชำระเงิน → `RadioGroup` + `RadioGroupItem`; filter/sort ของ store → `RadioGroup`; accordion/slider → `Accordion`/`Slider` ของ shadcn;
   `<select>` native ทุกตัว (`common/native-select`, จำนวนสินค้า, ประเทศในฟอร์มที่อยู่, คืนสินค้า, group buy) คงเป็น `<select>` ของเราเอง (`common/components/native-select` จัด style ด้วย token + icon lucide) — **ไม่ใช้ `NativeSelect` ของ shadcn** เพราะ wrapper ตั้ง `w-fit` ตายตัวทำ CORE-4g ล้ม (ตัดสิน 2026-11-26 ระหว่าง SFUI-5a; ลบ `src/components/ui/native-select.tsx`) — `selectOption` ใช้ได้เหมือนเดิม
   ส่วนที่เดิมใช้ `static` / `Transition` ของ headless (ต้องคง DOM และพฤติกรรมเดิม):
   (a) `account-info/index.tsx` — `Disclosure.Panel static` 3 ตัว (L83/102/120): แผง `success-message`/`error-message` ไม่มีปุ่ม toggle → เป็น `<div>` ธรรมดา (คง class/transition เดิม);
       `edit-panel` → `Collapsible open={state}` + `CollapsibleContent forceMount` (render ตลอด ซ่อน/แสดงด้วย class เดิม) และคง `data-open={state}` ไว้ตรงๆ บน element ที่มี testid
       (core-22 ต้องเจอ `edit-panel` ที่ `data-open="false"`; `data-state` ของ Radix ไม่ใช้แทน)
   (b) `cart-dropdown/index.tsx` — `PopoverPanel static` ใน `Transition show={cartDropdownOpen}` (L151–165): ใช้ `Popover open={cartDropdownOpen}` (state เดิมของเรา, `modal={false}`)
       และ `onOpenChange` เรียก `close`/`open` เดิม; `PopoverAnchor` ครอบลิงก์ `nav-cart-link` (ไม่ห่อลิงก์ด้วยปุ่ม); `PopoverContent` มี testid `nav-cart-dropdown` และถูก mount เฉพาะตอนเปิด
       เหมือนเดิม (ไม่ใช้ `forceMount`); ชน `cart-dropdown` กับ CORE-97 (ROADMAP รอบ 43 — ลิงก์ไม่ซ้อนปุ่ม) ตัวที่ merge ทีหลัง sync
   (c) `mobile-actions.tsx` — แถบ `mobile-actions` (L80–92, `Transition appear` จาง 300ms เมื่อ `show`): คงเงื่อนไข `{show && …}` และแทน `Transition` ด้วย class `animate-in fade-in duration-300`
       ของ `tw-animate-css` บน `<div data-testid="mobile-actions">` (จบที่ `opacity: 1` — FS-19 กฎ 24b ไม่มี leave transition); **`Sheet side="bottom"` แทนเฉพาะ `Dialog` ของ `mobile-actions-modal`** (L183–245)
       ไม่ใช่แถบ `mobile-actions`
5. `radix-ui`/`@radix-ui/*` ถูก import ได้เฉพาะใน `src/components/**` (`ui/` ของ CLI + wrapper ตามกฎ 3 — SFUI-7) — `src/modules/**`, `src/app/**`, `src/lib/**` import component จาก `@/components/ui/*` หรือ wrapper `@/components/*`
6. icon มาจาก `lucide-react` เท่านั้น (ขนาดด้วย `size-*`): `ArrowUpRightMini`→`ArrowUpRight`, `ArrowRightMini`→`ArrowRight`, `ChevronDownMini`→`ChevronDown`,
   `ChevronUpDown`→`ChevronsUpDown`, `CheckCircleSolid`→`CircleCheck`, `XMark`/`XMarkMini`→`X`, `MagnifyingGlass`→`Search`, `Plus`→`Plus`, `PencilSquare`→`SquarePen`,
   `Trash`→`Trash2`, `Spinner`/`Loader`→`LoaderCircle` + `animate-spin`, `ExclamationCircleSolid`→`CircleAlert`, `EllipseMiniSolid`→`Circle` (`fill-current size-2`),
   `CreditCard`→`CreditCard`, `Scan`→`QrCode`, `ArrowRightOnRectangle`→`LogOut`; ปุ่มที่มีแต่ icon ต้องมีชื่อที่เข้าถึงได้เป็นภาษาไทยไม่น้อยกว่าเดิม
7. token (ADR-030 ข้อ 7): `@theme` มี `--color-brand` และ `--color-brand-50..900` ค่า hex เดิม (`DEFAULT #525252`, 50 `#FAFAFA` … 900 `#171717`) และ `--color-grey-0..90` เดิม;
   `:root` มี `--primary: var(--color-brand-900)`, `--primary-foreground: var(--color-brand-50)`, `--ring: var(--color-brand-400)`; token อื่นตาม `neutral`; ไม่มี selector `.dark`; `@custom-variant dark (&:where([data-mode=dark] *))` เพื่อไม่ให้ `dark:` ของ component shadcn ทำงานตาม `prefers-color-scheme` (ตัดสิน 2026-11-26 ระหว่าง SFUI-2);
   โค้ดใหม่ไม่ใช้สี hex แบบ arbitrary (`[#…]`) ใน `className`
8. ฟอนต์: `--font-sans` ขึ้นต้นด้วย `var(--font-noto-sans-thai)`; `body` ใช้ `font-sans`; `src/app/layout.tsx` ยังโหลด `Noto_Sans_Thai` (`variable: "--font-noto-sans-thai"`) — แทนกฎ 14 ของ spec 01 (CORE-8)
9. `data-testid` ทุกค่าใน baseline (`e2e/support/sfui-baseline.json`, SFUI-1a) ต้องยังอยู่ใน `src/` และอยู่บน element ที่ e2e ใช้งานจริง:
   `DialogContent`/`SheetContent` (แทน `Dialog.Panel`), `SelectTrigger`/`SelectItem` (แทน `ListboxButton`/`ListboxOption`), `PopoverContent`/`PopoverTrigger`,
   `CollapsibleContent` (`forceMount` ตามกฎ 4a), `RadioGroupItem` (ปุ่ม `role="radio"`), `Checkbox` root (ปุ่ม `role="checkbox"` — `toBeChecked` ใช้ได้); ใช้ `asChild` → testid อยู่ที่ลูก; attribute อื่นที่ e2e อ่านอยู่บน element เดียวกันตามเดิม
   (`data-option-id`, `data-provider`, `data-open="true|false"` ของ `edit-panel`, `data-state` ของแถวโปรแกรม affiliate)
10. ข้อความไทยทุกข้อความใน baseline ต้องยังอยู่ (ไม่สนช่องว่าง/การตัดบรรทัด); ข้อความใหม่ (title/description ของ overlay, `sr-only`) เป็นภาษาไทย; ESLint rule ข้อความไทยของ CORE-4 ผ่าน
11. overlay ทุกตัว (`DialogContent`, `SheetContent`) มี `DialogTitle`/`SheetTitle` และ `DialogDescription`/`SheetDescription` (ซ่อนด้วย `sr-only` ได้) — ไม่มี console error/warning
    ของ Radix ที่มีคำว่า `DialogTitle` หรือ `aria-describedby`; `Escape` ปิด; focus กลับไปที่ปุ่มที่เปิด; `Tab` วนอยู่ใน overlay; ปุ่มปิดคง testid เดิม (`close-modal-button` ฯลฯ — ใช้
    `showCloseButton={false}` + `DialogClose`/`SheetClose` ของเราเมื่อ component ของ CLI มีปุ่มปิดในตัว)
12. `Select`: เปิดด้วย `Enter`/`Space`/`ArrowDown` บน trigger, เลือกด้วยลูกศร + `Enter`, `Escape` ปิดโดยไม่เปลี่ยนค่า; `RadioGroup`: ลูกศรเปลี่ยนตัวเลือก
13. ฟอร์ม server action ส่ง `FormData` ชื่อ/ค่าเดิม: `Input`/`native-select` เป็น element native; `Checkbox`/`RadioGroup` ที่อยู่ใน `<form>` ต้องมี `name` เดิม (Radix สร้าง input ซ่อนให้)
14. ลิงก์ที่หน้าตาเป็นปุ่มใช้ `cn(buttonVariants({...}), className)` บนลิงก์ (หรือ `<Button asChild>` ครอบลิงก์) — ห้าม `<Button>` เป็นลูกของ `LocalizedClientLink` (spec 01 กฎ 146b, AC-187)
15. pattern ต้องห้าม (หลัง task เจ้าของไฟล์ merge): import `@medusajs/icons`, `@medusajs/ui-preset`, `@headlessui/react`, `@radix-ui/react-*`, `tailwindcss-radix`, `clsx`,
    `@modules/common/components/ui`, `@modules/common/components/radio`, `@modules/common/components/modal` (รวม `vi.mock("…")` ใน test); class `txt-*`, `h[1-3]-(webs|core|docs)`,
    `(text|bg|border|ring|divide|fill|stroke|placeholder|outline|accent)-ui-*`, `var(--fg-*)`/`var(--bg-*)`/`var(--border-*)` ดิบของ preset, `shadow-(borders|elevation|buttons|details)-*`, `radix-state-*` ในไฟล์ที่ไม่ใช่ test;
    บังคับทีละไฟล์ด้วยรายการ `PENDING` แยก key ตาม task (AC-6) — task ต้องลบ key ของตัวเองใน PR เดียวกัน
16. ชั้นเข้ากันได้ `src/styles/legacy-medusa.css` (SFUI-1a): `@utility` ของ `txt-*`/`h*-webs` และ `@theme` ของ `--color-ui-*`/`--shadow-*` และตัวแปรดิบของ preset ใน `:root` (เช่น `--fg-interactive`, `--fg-muted` ที่ใช้ผ่าน `var(...)`) **เฉพาะชื่อที่ใช้จริงใน `src/`**; static test บังคับว่าทุก `var(--…)` ใน `src/` ที่ไม่ใช่ของ Tailwind/next/font/shadcn มีนิยาม
    ค่าคัดลอกจาก `@medusajs/ui-preset@2.22.1/dist/index.js` (light) font-family = `var(--font-sans)`; `@custom-variant radix-state-open/closed` (+ แบบ `group-`); ห้ามเพิ่มชื่อใหม่หลัง SFUI-1a;
    ลบทั้งไฟล์และ `@import` ใน SFUI-6; task 5a/5c ที่ย้าย `interactive-link`, `not-found`, `discount-code` ต้องแทน `var(--fg-*)` ด้วย token ของ shadcn
17. หน้าในรายการ AC-17 ที่ viewport 390×844 ไม่ล้นแนวนอน (`document.documentElement.scrollWidth <= window.innerWidth`)
18. admin ไม่ถูกแก้ (`git diff` ของ `apps/backend/**` ว่างในทุก task) และ e2e ที่เปิดหน้า admin (`/app`) ไม่ถูกแก้: `e2e/*admin*.spec.ts`, `e2e/support/admin.ts`,
    `e2e/core-55-return-receive.spec.ts`, `e2e/pay-10-refund-blocked-widget.spec.ts`, `e2e/payments-refund.spec.ts` (รายการนี้ = ไฟล์ใน `e2e/` ที่อ้าง `/app` ณ 2026-11-26)
19. e2e storefront ที่มีอยู่ผ่าน **โดยไม่แก้ locator/assertion** ยกเว้น: `e2e/ui-preset-font.spec.ts` (เขียนใหม่ใน SFUI-1a — AC-3) — assertion CSS ที่มีอยู่ต้องผ่านตามเดิม
    (`line-through` ของ `flash-original-price`/`product-price`/`s`, `opacity: 1` ของ `mobile-actions` และ error ใน `core-23c`, `[aria-checked="true"], [checked]` = 0 ใน `core-32`)
20. **(ท่อน `Button` `small|medium|large` → `sm|default|lg` + "`large` → `lg` + `h-12` คงความสูง 48px" แทนด้วยรอบ 50 — ADR-034, กฎ 59–61, 63a: ทุกปุ่ม size `default`/`icon` 36px รวมปุ่มจ่ายเงิน; มีผลเมื่อ SFUI-19a merge; ถ้อยคำเดิมคงไว้เป็นประวัติ)**
    ตาราง map ของ shim (SFUI-5x, 3x): `Text` → `<p className="text-sm">` (หรือ `<span>`/`<div>` ตาม `as`); `Heading` h1/h2/h3 → `<hN className="text-3xl|text-2xl|text-xl font-semibold">`;
    `Container` → `<div className="rounded-lg bg-card p-4">` (บน develop `.bg-white`/`.p-4` ของ shim อยู่หลัง `bg-*`/`p-*` ส่วนใหญ่ของผู้เรียกใน CSS v3 จึงชนะ → คง `bg-card p-4` แม้ผู้เรียกส่ง `bg-ui-bg-subtle`/`bg-gray-*`/`p-2` — ตรวจด้วยการ compile v3 ของ develop; ตัดสิน 2026-11-26 จาก review SFUI-5d); `Badge color` → shadcn `Badge` (`grey`→`secondary`, `red`→`destructive`, อื่น → `outline` + `bg-<สี>-100 text-<สี>-700`);
    `IconBadge` → `Badge variant="secondary"`; `IconButton` → `Button variant="ghost" size="icon"`; `Button` `primary|secondary|transparent` → `default|outline|ghost`,
    `small|medium|large` → `sm|default|lg` (`large` → `lg` + `h-12` คงความสูง 48px ของ develop — D-1 จาก qa: `lg` ของ shadcn สูง 40px ทำให้คลิก `submit-payment-button` หลังกรอกบัตรตกใน iframe ของ Stripe แล้วค้างที่ `step=payment`; shim ใส่ให้ เมื่อย้ายไปใช้ shadcn ตรงต้องใส่ `h-12` เอง — กฎ 19 ชนะกฎ 20); `buttonClassName(o, c)` → `cn(buttonVariants(o), c)`; `clx` → `cn`; `Label`/`Input`/`Table.*` → shadcn ชื่อเดียวกัน (`TableCell`/`TableHead` ของ shadcn มี `whitespace-nowrap` และ `TableHead` สูง `h-10` ซึ่ง `Table.Cell`/`.HeaderCell` เดิมไม่มี/สูง `h-12` → ผู้ใช้ใส่ `whitespace-normal` และหัวตาราง `h-12` เอง — review SFUI-5d/SFUI-6; shim ส่ง `px-4` ให้ `TableHead` และ `p-4` ให้ `TableCell` และ `Text` ค่าเริ่มต้น `text-sm leading-[1.4rem]` ที่ไม่ทับ `txt-*`/`h*-webs` ของผู้เรียก)
    (`Table.Header`→`TableHeader`, `.Body`→`TableBody`, `.Row`→`TableRow`, `.Head`/`.HeaderCell`→`TableHead`, `.Cell`→`TableCell`); `Button isLoading` → prop `isLoading` ที่เพิ่มใน
    `src/components/ui/button.tsx` (SFUI-2 — แสดง "กำลังดำเนินการ..." + disabled ตามเดิม; SFUI-7 ย้ายไป wrapper `src/components/button.tsx` — กฎ 3)
    หมายเหตุ (review SFUI-6): ค่าเริ่มต้นที่ระบุในวงเล็บข้างบน (`Text` = `text-sm leading-[1.4rem]` ที่ไม่ทับ `txt-*` ของผู้เรียก ฯลฯ) เป็นพฤติกรรมของ shim ฉบับ SFUI-2 ไม่ใช่ develop —
    บน develop shim ใช้ clsx โดยไม่ merge ค่าที่ render จึงขึ้นกับลำดับ CSS ของ v3 (เช่น `txt-medium` ของ `Text` ชนะ `txt-small`/`txt-compact-*` ของผู้เรียก) → ยึดค่าที่ render บน develop ตามกฎ 19;
    ปุ่มปิดของ `free-shipping-price-nudge` เปลี่ยนจากสี่เหลี่ยมมุมมน (`IconButton`) เป็นวงกลม `Button variant="ghost" size="icon"` — ยอมรับเป็นหน้าตา shadcn ตาม ADR-030
    `Checkbox` (shim native → shadcn, ใน `common/components/checkbox/index.tsx` ของ SFUI-5a; ผู้ใช้เดียวคือ `checkout/components/shipping-address/index.tsx:212` `name="same_as_billing"`):
    `<Checkbox id checked={checked} defaultChecked={checked} onClick={onChange} name={name} data-testid={dataTestId} />` ห่อด้วย `<span>` — **ไม่ใช้ `onCheckedChange`** เพราะ Radix ฟัง event `reset` ของ form แล้วเรียก `onCheckedChange` ด้วยค่าตอน mount ทำให้ติ๊กกลับเองหลัง action คืน error (qa #353 D-1; ตัดสิน 2026-11-26 ระหว่าง SFUI-5a); Enter ไม่ toggle ตาม WAI-ARIA (Space toggle); เอา `role`/`readOnly`/`aria-checked` ที่ใส่เองออก (Radix root เป็น
    `role="checkbox"` + `aria-checked` เองและ testid อยู่บน root จึง `toBeChecked` ใช้ได้); ใน `<form>` Radix สร้าง input ซ่อนที่ส่ง `same_as_billing=on` เมื่อติ๊ก
    และไม่ส่งเมื่อไม่ติ๊ก (`cart.ts:541` อ่าน `=== "on"` — `value` ต้องคงค่าเริ่มต้น `"on"`); `Label htmlFor` ชี้ id เดิม
    `RadioGroup` ใน `common/components/filter-radio-group/index.tsx` (SFUI-5a; sort/filter ของ store): `<RadioGroup value={value} onValueChange={handleChange} data-testid={dataTestId}>`
    + `RadioGroupItem value id className="sr-only"` (ไม่ใช้ `hidden` — `display:none` ทำให้ label คลิกไม่ถึง) + `Label htmlFor` ที่คง `data-testid="radio-label"` และ `data-active` เดิม;
    `EllipseMiniSolid` → `Circle` ตามกฎ 6
21. map class (SFUI-5x, 3x): `txt-*xsmall*`→`text-xs`, `txt-*small*`→`text-sm`, `txt-*medium*`→`text-sm leading-[1.4rem]` (คง line-height 22.4px เดิม — core-38), `txt-*large*`→`text-base`, `txt-*xlarge*`→`text-lg`, `-plus`→`+ font-medium`, `compact`→`+ leading-5`;
    `h1-webs`→`text-6xl font-medium`, `h2-webs`→`text-5xl font-medium`, `h3-webs`→`text-4xl font-medium`; `text-ui-fg-base`→`text-foreground`, `text-ui-fg-subtle`/`-muted`→`text-muted-foreground`,
    `text-ui-fg-disabled`→`text-muted-foreground/60`, `text-ui-fg-interactive`→`text-primary underline-offset-4`, `text-ui-fg-error`→`text-destructive`, `text-ui-fg-on-color`/`-on-inverted`→`text-primary-foreground`,
    `bg-ui-bg-base`/`-field`→`bg-background`, `bg-ui-bg-subtle`/`-component`→`bg-muted`, `bg-ui-bg-interactive`→`bg-primary`, `bg-ui-bg-disabled`→`bg-muted opacity-50`,
    `border-ui-border-base`/`-strong`→`border-border`/`border-input`, `shadow-borders-*`→`border border-input` (+ `ring-[3px] ring-ring/50` แบบ focus), `shadow-elevation-*`→`shadow-sm`/`shadow-md`,
    `ui-tag-<สี>-*`→`<สี>-100`/`<สี>-700`; ชื่อที่ไม่อยู่ในตาราง → token ของ shadcn ที่ใกล้ที่สุด (บันทึกใน PR); **กฎ 19 ชนะกฎ 20/21**: ถ้าการ map ทำให้ e2e เดิมล้ม (ขนาด/ตำแหน่ง/ระยะ) ให้คงค่าเดิมด้วย utility ของ Tailwind แทน เช่น `TableHead` ของ cart/order/skeleton คง `px-4` และ `TableCell` คง `p-4` (shim ส่งให้แล้วตั้งแต่ SFUI-2; เมื่อย้ายไปใช้ shadcn ตรงต้องใส่เอง — core-42/47) (ตัดสิน 2026-11-26 จาก triage)
    `<Heading>`/h1–h3 ของ shim ที่ผู้เรียกส่ง `text-*-regular`/`text-*-semi` ของ `globals.css` มาด้วย → ใช้**ค่าที่ชนะบน develop**: ใน v3 class เหล่านั้นอยู่ใน `@layer components`
    จึงแพ้ utility ของ shim (`text-3xl`/`text-2xl`/`text-xl` + `font-semibold`) ทุก property ที่ชน; property ที่ utility ไม่ตั้ง (เช่น line-height ของ `text-3xl` = 2rem ไม่มี line-height) มาจาก `text-*-regular/semi`
    — h2 = `text-2xl font-semibold` (24px/32px/600), h1 + `text-3xl-regular` = 32px/44px/600 (ไม่พึ่ง `@utility text-*-regular` ของ v4 ที่ตั้ง `font-normal` ด้วย) (ตัดสิน 2026-11-26 จาก review SFUI-5b/5c)

## Acceptance criteria (Given/When/Then, numbered AC-1..n)
- AC-1 (SFUI-1a, 1b, 6; กฎ 1–3) static `e2e/sfui-deps.unit.spec.ts`: Given `apps/storefront/package.json` Then เวอร์ชันตรงตาราง ADR-030 ข้อ 10 แบบ exact ตามขั้น
  (หลัง 1a: `tailwindcss`/`@tailwindcss/postcss` 4.3.5 และไม่มี `@medusajs/ui-preset`, `tailwindcss-radix`, `autoprefixer`; หลัง 1b: + `tw-animate-css`, `radix-ui`, `class-variance-authority`, `cn`, `lucide-react`;
  หลัง 6: ไม่มี `@medusajs/icons`, `@headlessui/react`, `@radix-ui/react-*`, `clsx`); ไม่มีไฟล์ `tailwind.config.*`; postcss config มี plugin เดียว `@tailwindcss/postcss`;
  และ `pnpm --filter storefront build`, `typecheck`, `lint`, `test:unit` ผ่าน
- AC-2 (SFUI-1a, กฎ 16) static `e2e/sfui-legacy-css.unit.spec.ts`: Given ทุกไฟล์ `src/**/*.{ts,tsx}` ที่ไม่ใช่ test When ดึง class ตาม pattern ของกฎ 15 Then ทุกชื่อมีนิยามใน `legacy-medusa.css`
  (`@utility <ชื่อ>` หรือ `--color-<token>`/`--shadow-<token>`) — ไม่มี class ของ preset ที่ไม่มีสไตล์เงียบๆ; และ `legacy-medusa.css` ไม่มีชื่อที่ไม่ถูกใช้
- AC-3 (SFUI-1a, กฎ 8 — แทน spec 01 AC-24/AC-25 และส่วนฟอนต์ของ AC-9) unit: `globals.css` มี `--font-sans:` ที่ค่าตัวแรกคือ `var(--font-noto-sans-thai)`; e2e `ui-preset-font.spec.ts` (เขียนใหม่):
  Given หน้าแรก When อ่าน `getComputedStyle(el).fontFamily` ของ `body`, `h1`, `h2`, `p`, `button`, `input` และทุก element ที่มี class `txt-*`/`*-webs` (ถ้ายังมี) Then ทุกค่ามี `Noto Sans Thai`
  และอยู่ก่อน `Inter` (ถ้ามี); `expect(samples.length).toBeGreaterThan(0)`
- AC-4 (SFUI-1a/1b/2, กฎ 7 — แทนส่วน brand ของ spec 01 AC-9) unit อ่าน `globals.css`: มี `--color-brand` และ `--color-brand-50..900` ค่า hex เดิมทุกตัว; (1b) `--primary: var(--color-brand-900)`,
  `--primary-foreground: var(--color-brand-50)`, `--ring: var(--color-brand-400)`, ไม่มี `.dark`; (2) e2e: Given PDP When อ่านสีพื้นของ `add-product-button` Then เป็น `rgb(23, 23, 23)`
  (= brand-900 `#171717` ผ่าน `--primary`)
- AC-5 (SFUI-1a, กฎ 9–10) static `e2e/sfui-baseline.unit.spec.ts` + `e2e/support/sfui-baseline.json` (สร้างจาก `origin/develop` ก่อนแก้ใดๆ ใน SFUI-1a): `testids` = ทุกค่าสตริงที่ตามหลัง `data-testid=` / `"data-testid":`
  (รวมรูป `={"…"}` และ template literal เก็บตามตัวอักษร) ใน `src/**` (ไม่ใช่ test), `thai` = ทุกช่วงข้อความที่มีอักษรไทย `/[฀-๿]/` ระหว่างเครื่องหมายคำพูด/`>`…`<`;
  Then ทุกค่ายังพบใน `src/**` (เทียบหลังลบช่องว่างทั้งหมด) — แก้ baseline ได้เฉพาะเมื่อ spec นี้ระบุ; ข้อยกเว้น (เก็บเป็นรายการใน test ไม่แก้ไฟล์ baseline):
  `radio-button` — ค่า default ของ `common/components/radio` (`MedusaRadio`): บน develop render ใน checkout (address-select, payment-container, shipping) แต่หายจาก DOM ตั้งแต่ SFUI-3d/3e ที่เปลี่ยนเป็น
  `RadioGroupItem` + วงกลม `OptionDot` (testid ของตัวเลือกอยู่บนปุ่ม `role="radio"` — ADR-030 ข้อ 11) และ AC-16 สั่งลบไฟล์; ไม่มีไฟล์ใน `e2e/` (รวม `support/`) อ้าง (SFUI-6)
- AC-6 (ทุก task, กฎ 15) static `e2e/sfui-legacy.unit.spec.ts` มี `PENDING: Record<"SFUI-2"|"SFUI-3a"|…|"SFUI-6", string[]>` (สร้างใน SFUI-1a ตามตารางเจ้าของไฟล์):
  (a) ไฟล์ที่มี pattern ต้องห้ามทุกไฟล์อยู่ใน `PENDING` ของ key ใด key หนึ่ง; (b) ทุกไฟล์ใน `PENDING` ยังมีและยังมี pattern (บังคับให้ลบออกเมื่อย้ายเสร็จ)
  — ข้อ (b) ทำให้ **SFUI-2 ต้องปรับ `PENDING` ของ shim ด้วย**: SFUI-1a ใส่ `common/components/ui/index.tsx` ไว้ใต้ key `SFUI-2` (มี `clsx` + `txt-medium`);
  SFUI-2 ส่งต่อไป shadcn แล้ว pattern ในไฟล์นี้หาย → ลบ key `SFUI-2` ออก (การลบไฟล์ shim ใน SFUI-6 ยังถูกบังคับผ่านไฟล์ผู้ใช้ที่ import `@modules/common/components/ui` ซึ่งอยู่ใต้ key ของ 3x/4/5x
  และ AC-16); หลัง SFUI-6 ไฟล์นี้เหลือเฉพาะการตรวจ (a) กับรายการว่าง
  — reviewer ตรวจ (ไม่ใช่ static): task ที่จะ merge ลบ key ของตัวเองออกจาก `PENDING` ครบ และไม่ลบ key ของ task อื่น
- AC-7 (SFUI-1b, กฎ 2) static: `components.json` มีค่าตามกฎ 2 ทุก field; `tsconfig.json` มี `@/*`; `src/lib/utils.ts` export `cn` (สร้างด้วย `createCn` ตามกฎ 2 และทุก utility ขนาดฟอนต์ใน `globals.css` อยู่ใน `FONT_SIZE_UTILITIES` — **SFUI-10 แทนข้อนี้ด้วย AC-24 ข้อ (c)**); `vitest.config.mts` มี alias `"@"` → `src` และ `include` ครอบ `src/**/*.test.ts` + `src/**/*.test.tsx`;
  unit `src/lib/utils.test.ts` ที่ `import { cn } from "@/lib/utils"` (ผ่าน alias ไม่ใช่ path สัมพัทธ์) ผ่าน: `cn("px-2", "px-4") === "px-4"`
- AC-8 (SFUI-2, กฎ 3, 14, 20) unit (jsdom) `src/components/ui/button.test.tsx` (SFUI-7 ย้ายเป็น `src/components/button.test.tsx` ทดสอบ wrapper `src/components/button.tsx`) — ต้อง**ถูกรันจริง** (ปรากฏในผล `pnpm --filter storefront test:unit` ของ PR; include `*.test.tsx` จาก SFUI-1b) — ของ `src/components/button.tsx` (SFUI-2–6 อยู่ใน `src/components/ui/button.tsx`): `isLoading` → ปุ่ม disabled และข้อความมีอักษรไทย; `buttonVariants({ variant: "outline", size: "sm" })` คืน string;
  shim `Button`/`Badge`/`Label`/`Input`/`Table`/`IconButton`/`buttonClassName`/`clx` ส่งต่อไป shadcn (`Button` ที่ render มี `data-slot="button"`); e2e AC-4 ข้อ (2);
  `e2e/core-90-link-button.unit.spec.ts` (AC-187) ผ่าน
- AC-9 (SFUI-3a, กฎ 4, 9, 11) e2e ใหม่ `e2e/sfui-3a-dialog.spec.ts` (ลูกค้าที่ login): Given `/<cc>/account/addresses` When กด `add-address-button` Then `getByRole("dialog")` มีชื่อที่เข้าถึงได้และเป็นภาษาไทย
  (`expectThai`), `Tab` 20 ครั้งแล้ว focus ยังอยู่ใน dialog, `Escape` ปิดและ focus กลับ `add-address-button`; เหมือนกันกับปุ่มแก้ไขที่อยู่ (testid เดิมของ `edit-address-modal`);
  ระหว่าง test ไม่มี console message ที่มี `DialogTitle` หรือ `aria-describedby`; e2e `core-23c-account-forms`, `core-22-account-fixes`, `thai-ui-account` ผ่านโดยไม่แก้
- AC-10 (SFUI-3b, กฎ 4, 4c, 11) e2e ใหม่ `e2e/sfui-3b-sheet.spec.ts`: side menu (`nav-menu-button`), search drawer (ปุ่มค้นหาใน nav), และ Sheet ตัวเลือกสินค้าบนมือถือ
  `mobile-actions-modal` (เปิดด้วย `mobile-actions-button` บน PDP ที่ 390px — **ไม่ใช่**แถบ `mobile-actions` ซึ่งไม่ใช่ overlay และต้องยัง `opacity: 1` ตาม `flash-sale-fs19`) — แต่ละตัว `role="dialog"` มีชื่อภาษาไทย,
  `Escape` ปิด, focus กลับปุ่มเปิด, ไม่มี console message ตาม AC-9; e2e `core-19a-nav-cart-search`, `core-15b-search-drawer-error`, `core-70-unified-search`, `core-75-thai-substring-search`,
  `core-50-nav-narrow`, `thai-ui-shell`, `flash-sale-fs14`, `flash-sale-fs19` ผ่านโดยไม่แก้
- AC-11 (SFUI-3c, กฎ 4, 9, 12) e2e ใหม่ `e2e/sfui-3c-select.spec.ts`: Given checkout ที่ลูกค้ามีที่อยู่ ≥ 2 When focus `shipping-address-select` กด `ArrowDown` แล้ว `ArrowDown` + `Enter` Then ที่อยู่ที่สองถูกเลือก
  (ฟิลด์ที่อยู่ในฟอร์มเปลี่ยนตาม) และ `Escape` ระหว่างเปิดไม่เปลี่ยนค่า; Given หน้า account profile When กดแก้ไขเบอร์โทร Then `edit-panel` มี `data-open="true"` และแผงอื่น `"false"`;
  e2e `core-26-cart-dropdown-total`, `core-91-cart-dropdown-known`, `core-19a-nav-cart-search`, `core-22-account-fixes`, `core-23-profile-order`, `core-23b-account-progress`, `core-4j-checkout-discount-address`,
  `core-4g-checkout-polish`, `core-63-address-invisible` ผ่านโดยไม่แก้
- AC-12 (SFUI-3d, กฎ 4, 12–13) unit 5 ไฟล์ (`core-19f-continue-after-timeout`, `pay-16-payment-container`, `pay-16-payment-step-state`, `payment-session-lock-timeout`, `pay-14-stale-session`, `core-4i-b-ui-results` — ย้ายจาก AC-13) และ e2e ของหน้าจ่าย order (`order-pay`) ผ่านโดยไม่แก้
  ไม่ mock/import `@headlessui/react` และ assert พฤติกรรมเดิม (จำนวน/ชื่อ test ไม่ลด); e2e: Given ขั้น payment When focus ตัวเลือกบัตรแล้วกด `ArrowDown` Then PromptPay ถูกเลือก
  (`aria-checked="true"`); e2e `payments*.spec.ts`, `pay-*.spec.ts`, `core-52-checkout-guards`, `thai-ui-checkout` ผ่านโดยไม่แก้
- AC-13 (SFUI-3e, กฎ 4, 9) e2e `core-32-shipping-profile-filter` (`aria-checked`/`[checked]` = 0 ตอนเริ่ม, เลือกด้วย
  `delivery-option-radio` ที่มี `data-option-id`), `group-buy-*`, `ev-7c-digital-only-checkout`, `ev-7d-digital-only-totals` ผ่านโดยไม่แก้
- AC-14 (SFUI-4, กฎ 4–5) static: ไฟล์ของ task ไม่ import `@radix-ui/*`/`clsx` และ import `Accordion`/`Slider` จาก `@/components/ui/*`; e2e: Given `/<cc>/store` When กด `Enter` บนหัว filter Then เนื้อหา
  เปิด (`data-state="open"`) และ `ArrowRight` บน thumb ของช่วงราคาเปลี่ยนค่า; e2e ทุก spec ที่ grep พบ testid ของ filter/ช่วงราคา/แท็บ PDP (เช่น `core-store`) ผ่านโดยไม่แก้
- AC-15 (SFUI-5a–5e, กฎ 15, 19–21) static: key ของ task ไม่อยู่ใน `PENDING` (AC-6) และไฟล์ในขอบเขตไม่มี pattern ต้องห้าม; e2e ทุก spec ที่ grep พบ path/testid ของหน้าในขอบเขตผ่านโดยไม่แก้
- AC-16 (SFUI-6, กฎ 1, 15–16) static: `PENDING` ว่าง; ไม่มี `src/styles/legacy-medusa.css`, `src/modules/common/components/ui/`, `src/modules/common/components/radio/`;
  `globals.css` ไม่ `@import` legacy; dependency ตาม AC-1 ข้อหลัง 6; `CLAUDE.md` หัวข้อ Stack ระบุ Tailwind v4 + shadcn/ui (Radix); e2e storefront ทั้งชุดผ่านใน CI
- AC-17 (SFUI-1a สร้าง, ทุก task รัน, กฎ 17) e2e ใหม่ `e2e/sfui-mobile-390.spec.ts` (`viewport: { width: 390, height: 844 }`, ลูกค้าที่ login + cart มีสินค้า 1 ชิ้น):
  `/<cc>`, `/<cc>/store`, PDP, `/<cc>/cart`, `/<cc>/checkout?step=address`, `/<cc>/account`, `/<cc>/account/orders` — ทุกหน้า `scrollWidth <= innerWidth`
- AC-18 (ทุก task, กฎ 18) reviewer ตรวจ: `git diff origin/develop --stat -- apps/backend` และ diff ของไฟล์ e2e ที่เปิด `/app` ตามรายการในกฎ 18 ว่าง; e2e เหล่านั้นผ่านใน CI
- AC-19 (SFUI-7, กฎ 2, 3, 5, 10) static `e2e/sfui-7-ui-pristine.unit.spec.ts`: ไฟล์ใน `src/components/ui/` มีชุดชื่อและ sha256 ตรงกับ `e2e/support/shadcn-ui.json` (ผล `shadcn@4.23.1 add --overwrite`),
  ไม่มี `SFUI:`/import `@/lib/utils`/ไฟล์ test; `radix-ui` ถูก import เฉพาะใน `src/components/**`; className/argument ที่ส่งเข้า `@/components/**` (รวมค่าคงที่ในไฟล์เดียวกัน) ไม่มี utility ขนาดฟอนต์ของ `globals.css`;
  `DialogContent`/`SheetContent` จาก `ui/` มี `showCloseButton={false}` และ `DialogFooter` ไม่เปิดปุ่มปิด; unit `src/components/button.test.tsx` (ย้ายจาก `ui/` — AC-8) และ `src/components/wrappers.test.tsx`
  (wrapper ที่ไม่ใช้ความสามารถเพิ่มได้ DOM เท่ากับของ CLI, `overlayProps`/`thumbLabels`/`children` ถึง DOM); `pnpm dlx shadcn@4.23.1 add <name> --dry-run --diff` ทุกไฟล์ใน `ui/` ได้ "No changes." (บันทึกใน evidence);
  e2e ที่อ้างหน้าที่แตะผ่านโดยไม่แก้ (กฎ 19)

## Non-functional (concurrency, idempotency, scale, observability)
- กันกดซ้ำ: ปุ่มที่ย้ายไป shadcn คง `disabled`/single-flight เดิม (ไม่มี logic ใหม่)
- bundle: บันทึก First Load JS ของ `/[countryCode]` และ PDP จาก `next build` ก่อน (SFUI-1a) และหลัง (SFUI-6) ใน PR — ไม่ใช่ gate
- browser ขั้นต่ำตาม Tailwind v4 (Safari 16.4+, Chrome 111+, Firefox 128+) — Q1
- Vitest + jsdom ที่ render Radix `Select`/`Slider`: polyfill ใน test ไฟล์นั้น (ไม่ใส่ global setup ใหม่ถ้ามีผู้ใช้ที่เดียว)

## Test plan: unit / integration / e2e, mapped to AC numbers
| ชนิด | AC |
|---|---|
| static (`pnpm --filter storefront test:e2e:unit`, `e2e/*.unit.spec.ts`) | AC-1, AC-2, AC-5, AC-6, AC-7, static ของ AC-14/15/16, AC-19 |
| unit (Vitest) | AC-3 (CSS), AC-4 (CSS), AC-7 (`cn`), AC-8, AC-12, AC-13, AC-19 (wrapper) |
| integration | none (ไม่แตะ backend) |
| e2e storefront (Playwright) | AC-3, AC-4 (2), AC-9..AC-15, AC-17 + ชุดเดิมทั้งหมด (กฎ 19) |
qa เก็บ evidence ทุก task ที่มี UI (ทุก task ยกเว้น SFUI-1b) — screenshot ก่อน/หลังของหน้าที่ task แตะ ≤ 5 รูป; builder รัน e2e **ทุก** spec ที่อ้างหน้าที่ task แตะ (CLAUDE.md)

## Tasks (each = one PR, ≤ ~400 LOC, ordered, with dependencies)
เจ้าของไฟล์: **แต่ละไฟล์ถูกแก้โดย task เดียว** (ยกเว้น `globals.css`: 1a → 1b → 6 ตามลำดับ, shim: 2 → 6, `e2e/sfui-legacy.unit.spec.ts`: แต่ละ task ลบ key ตัวเอง)
— task ที่เป็นเจ้าของไฟล์ย้ายไฟล์นั้น**ครบทุกชั้น** (primitive + icon + class + import shim) ในครั้งเดียว · icon ไม่แยก task (ร่างเดิม SFUI-4 icons) เพื่อไม่ให้สอง task แตะไฟล์เดียวกัน ·
ไฟล์ที่มี pattern ต้องห้ามแต่ไม่ได้ระบุชื่อในตารางเป็นของ task 5x ตามโฟลเดอร์ · LOC ประมาณการ**ไม่นับ**ไฟล์ที่ generate: `pnpm-lock.yaml`, `src/components/ui/*` ที่ CLI สร้าง
(นับเฉพาะส่วนที่แก้เพิ่มด้วยมือ), `e2e/support/sfui-baseline.json`, และรายการ `PENDING` ที่สร้างจากสคริปต์ใน SFUI-1a

| Task | งาน — ไฟล์ที่เป็นเจ้าของ | shadcn add | AC | Depends | ∥ |
|---|---|---|---|---|---|
| SFUI-1a | Tailwind v4 + ชั้นเข้ากันได้: `package.json`/lockfile (กฎ 1, AC-1 ขั้น 1a), `postcss.config.js`, ลบ `tailwind.config.js`, `src/styles/globals.css` (`@import "tailwindcss"`, `@theme` ค่าเดิม, `@utility`, `--font-sans`), `src/styles/legacy-medusa.css` (ใหม่), ลบ `thai-ui-preset.js` + `ui-preset-font.test.ts` + `tailwind-config.test.ts` → `src/styles/theme-css.test.ts` (AC-3/4 ส่วน CSS), `src/app/layout.tsx` (comment), เขียนใหม่ `e2e/ui-preset-font.spec.ts`; ใหม่ `e2e/sfui-{deps,legacy-css,baseline,legacy}.unit.spec.ts`, `e2e/support/sfui-baseline.json`, `e2e/sfui-mobile-390.spec.ts`; utility ที่ v4 เปลี่ยนชื่อในไฟล์ใดก็ได้ (codemod `@tailwindcss/upgrade` — เฉพาะ rename ไม่แตะอย่างอื่น) | — | AC-1..AC-6, AC-17, AC-18 | branch เอกสาร `docs/SFUI-shadcn-adr-spec` (stack — owner อนุญาต 2026-11-26; PR เอกสาร merge ก่อน SFUI-1a) | — |
| SFUI-1b | `shadcn init -b radix`: `components.json`, `tsconfig.json` (`@/*`), `src/lib/utils.ts` + `src/lib/utils.test.ts`, `vitest.config.mts` (alias `"@": src`, include `src/**/*.test.tsx` เพิ่ม), `globals.css` (`@import "tw-animate-css"`, `:root` token neutral, `--primary`/`--primary-foreground`/`--ring` → brand, `@theme inline`), `package.json`/lockfile (dependency ขั้น 1b), เพิ่มข้อตรวจใน `theme-css.test.ts` | — | AC-4 (1b), AC-7 | SFUI-1a | — |
| SFUI-2 | primitive พื้นฐาน + shim ส่งต่อ: `src/components/ui/*` (CLI) + `button.tsx` เพิ่ม `isLoading` (กฎ 20), `src/modules/common/components/ui/index.tsx` (คง API เดิม, ส่งต่อ shadcn; `clx` = `cn`), unit `src/components/ui/button.test.tsx`, e2e ข้อ (2) ของ AC-4 ใน `e2e/sfui-2-brand.spec.ts` | `button input label badge table checkbox radio-group` (`native-select` ที่ add ไว้ถูกลบใน SFUI-5a — กฎ 4) | AC-4 (2), AC-8 | SFUI-1b | — |
| SFUI-3a | modal ที่อยู่ → `Dialog`: `common/components/modal/index.tsx` (ลบ; ผู้ใช้ 2 ที่ใช้ `Dialog` ตรง), `lib/context/modal-context.tsx` (ลบถ้าไม่มีผู้ใช้อื่น), `account/components/address-card/{edit-address-modal,add-address}.tsx`, e2e ใหม่ `sfui-3a-dialog.spec.ts` | `dialog` | AC-9 | SFUI-2 | ∥ 3b–5e |
| SFUI-3b | แผงเต็มจอ → `Sheet`: `layout/components/side-menu/index.tsx`, `layout/components/search/{drawer,index,hit}.tsx`, `products/components/product-actions/mobile-actions.tsx`, e2e ใหม่ `sfui-3b-sheet.spec.ts` | `sheet` | AC-10 | SFUI-2 | ∥ |
| SFUI-3c | listbox/popover/disclosure: `layout/components/cart-dropdown/index.tsx` → `Popover`, `layout/components/country-select/index.tsx` + `checkout/components/address-select/index.tsx` → `Select`, `account/components/account-info/index.tsx` → `Collapsible`, e2e ใหม่ `sfui-3c-select.spec.ts` | `popover select collapsible` | AC-11 | SFUI-2 | ∥ |
| SFUI-3d | ขั้นชำระเงิน → `RadioGroup`: `checkout/components/payment/index.tsx`, `checkout/components/payment-container/index.tsx`, `src/lib/constants.tsx` (icon), `order/components/order-pay/index.tsx` (ใช้ `PaymentContainer` ตัวเดียวกัน — ย้ายจาก 3e 2026-11-26), unit `src/{core-19f-continue-after-timeout,pay-16-payment-container,pay-16-payment-step-state,payment-session-lock-timeout,pay-14-stale-session,core-4i-b-ui-results}.test.ts`, e2e ใหม่ใน `sfui-3d-payment.spec.ts` | — | AC-12 | SFUI-2 | ∥ |
| SFUI-3e | ตัวเลือกจัดส่ง → `RadioGroup`: `checkout/components/shipping/index.tsx` (ถ้า unit `core-4i-b-ui-results` ส่วน shipping ต้องแก้ ให้แก้ต่อจาก 3d) | — | AC-13 | SFUI-3d | — |
| SFUI-4 | Radix เดิม → shadcn: `store/components/refinement-list/options-picker/index.tsx`, `store/components/store-refinements/{option-refinements,price-range,refinement-group}.tsx`, `products/components/product-tabs/accordion.tsx` (ลบ variant `radix-state-*`), e2e ใหม่ใน `sfui-4-store.spec.ts` | `accordion slider` | AC-14 | SFUI-2 | ∥ |
| SFUI-5a | ร่วม + layout: `src/modules/common/**` (ยกเว้น `ui/`, `modal/`, `radio/`), `src/modules/layout/**` (ยกเว้นไฟล์ของ 3b/3c), `src/modules/{skeletons,shipping,policies}/**`, `src/app/not-found.tsx`, `src/app/[countryCode]/(main)/**` ที่ไม่อยู่ใน 5b–5e (หน้าแรก, contact, terms, privacy, returns, shipping, verify-account, not-found, layout) | — | AC-15 | SFUI-2 | ∥ |
| SFUI-5b | catalog: `src/modules/{products,store,home,categories,collections,search}/**` (ยกเว้นไฟล์ของ 3b/4), `src/app/[countryCode]/(main)/{store,products,categories,collections,search}/**` | — | AC-15 | SFUI-2 | ∥ |
| SFUI-5c | checkout + cart: `src/modules/{checkout,cart,returns}/**` (ยกเว้นไฟล์ของ 3c/3d/3e), `src/app/[countryCode]/(checkout)/**`, `src/app/[countryCode]/(main)/cart/**` | — | AC-15 | SFUI-2 | ∥ |
| SFUI-5d | account + order: `src/modules/{account,order}/**` (ยกเว้นไฟล์ของ 3a/3c/3e), `src/app/[countryCode]/(main)/{account,order}/**` (ยกเว้น `account/@dashboard/vouchers/**` ของ 5e) | — | AC-15 | SFUI-2 | ∥ |
| SFUI-5e | ฟีเจอร์: `src/modules/{group-buy,affiliate,evoucher}/**`, `src/app/[countryCode]/(main)/{affiliate,g}/**`, `src/app/[countryCode]/(main)/account/@dashboard/vouchers/**` | — | AC-15 | SFUI-2 | ∥ |
| SFUI-6 | ปิดงาน: ลบ shim `common/components/ui/`, `common/components/radio/`, `legacy-medusa.css` + `@import`, dependency ขั้น 6 (`package.json`/lockfile), `e2e/sfui-legacy.unit.spec.ts` เหลือข้อ (a) รายการว่าง, `e2e/sfui-legacy-css.unit.spec.ts` (ลบ), `CLAUDE.md` หัวข้อ Stack (+ ข้อความ storefront ที่อ้าง preset ถ้ามี — owner อนุมัติใน review), บันทึก bundle ก่อน/หลัง | — | AC-1 (ขั้น 6), AC-16 | SFUI-1a..SFUI-5e ทั้งหมด | — |
| SFUI-7 | ไฟล์ใน `ui/` = ผล CLI ตรงตัว (owner 2026-11-26): `src/components/ui/*` (คืนเป็นผล `shadcn add --overwrite`), wrapper ใหม่ `src/components/{button,sheet,slider,radio-group}.tsx`, ย้าย `src/components/ui/button.test.tsx` → `src/components/button.test.tsx`, ใหม่ `src/components/wrappers.test.tsx`, `e2e/support/shadcn-ui.json`, `e2e/sfui-7-ui-pristine.unit.spec.ts`, แก้ `e2e/sfui-4-store.unit.spec.ts` (AC-14 ข้อ import Slider/`cn` ตามกฎใหม่), ผู้เรียก wrapper และจุดที่ส่ง utility ขนาดฟอนต์เข้า primitive (`account-info`, `address-select`, `country-select`, `search/drawer`, `shipping`), กฎ 2/3/5, ADR-030 ข้อ 3–4, `CLAUDE.md` หัวข้อ Stack | ทุกตัวใน `ui/` (`--overwrite`) | AC-19 | SFUI-6 | — |

ลำดับ: SFUI-1a → SFUI-1b → SFUI-2 → (SFUI-3a ∥ 3b ∥ 3c ∥ 3d ∥ SFUI-4 ∥ 5a ∥ 5b ∥ 5c ∥ 5d ∥ 5e; 3e หลัง 3d) → SFUI-6 → SFUI-7
- ไฟล์ร่วมของกลุ่มขนาน: `e2e/sfui-legacy.unit.spec.ts` (ต่างคนต่างลบ key ของตัวเอง — ตัวที่ merge ทีหลัง sync), `src/components/ui/*` (แต่ละ task เพิ่มคนละไฟล์ตามคอลัมน์ shadcn add)
- ประมาณ LOC: 1a ~400 (CSS ชั่วคราวคัดลอกค่า), 1b ~150, 2 ~250, 3a–3e/4 ~200–350 ต่อ task, 5a–5e ~250–380 ต่อ task (5c ใหญ่สุด: `addresses` ~45 จุด) — เกิน 450 ให้หยุดแตกตามโฟลเดอร์ย่อยแล้วแจ้ง planner
- ขนานพร้อมกันได้ตามเครื่อง — e2e storefront ทั้งชุดรันใน CI; ในเครื่องรันเฉพาะ spec ที่อ้างหน้าที่แตะ
- **stack (owner อนุญาต 2026-11-26)**: แต่ละ task แตก branch ต่อจาก branch ของ Depends ในเครื่องโดยไม่รอ merge (task ขนานแตกจาก `feat/SFUI-2-*` ตัวเดียวกัน; SFUI-6 แตกจาก
  branch ที่รวม 3a..5e) → เปิด PR ทั้งชุดพร้อมกันตอนท้าย (base = `develop`) → merge ตามลำดับข้างบน ทีละตัวตามกติกา merge ของ CLAUDE.md (sync `origin/develop` + CI เขียวก่อนแต่ละตัว)
- **งด release `develop → main`** ตั้งแต่ SFUI-2 merge จนถึง SFUI-6 merge ยกเว้น hotfix (owner 2026-11-26)

## ส่วนเก็บกวาดหลัง SFUI-7 (รอบ 45 — owner 2026-11-26 "เก็บต่อเลย")
Goal (owner's words): (1) เลิกใช้ utility ขนาดฟอนต์ของ Medusa starter (`text-{xsmall,small,base,large,xl,2xl,3xl}-{regular,semi}` 13 ตัวที่ `globals.css` นิยามด้วย `@utility`)
แทนด้วย utility มาตรฐานของ Tailwind ที่ได้ค่าเท่าเดิม แล้วลบนิยาม + `cn` ที่ extend (`FONT_SIZE_UTILITIES`/`createCn`); (2) แก้ rule floating label ใน `globals.css` ที่จับ `<label>` ทุกตัวที่ตามหลัง `<input>`
Out of scope: เปลี่ยนค่าที่ render ของ element ใดนอกจากรายการของกฎ 23 · utility อื่นใน `globals.css` (`content-container`, `contrast-btn`, `no-scrollbar`, `--text-3xl` ของ `@theme`) · `src/components/ui/*` (กฎ 3)
ADR: ไม่มีฉบับใหม่ — อยู่ในกรอบ ADR-030 (ข้อ 3 กำหนด `src/lib/utils.ts` = `export { cn } from "cn"` อยู่แล้ว; `createCn` เป็นทางเลี่ยงชั่วคราวของ SFUI-2 ที่หมดเหตุผลเมื่อไม่มี utility ขนาดฟอนต์ของเราเอง)
และการแก้ floating label เป็นการแก้บั๊ก (owner สั่ง) ไม่มีทางเลือกเชิงสถาปัตยกรรม

### What Medusa already gives us
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| utility ขนาดฟอนต์ `text-*-regular/semi` | Medusa Next.js Starter (`globals.css` — เราย้ายเป็น `@utility` ใน SFUI-1a) | **เลิกใช้** → utility มาตรฐานของ Tailwind v4 (`text-*`, `leading-*`, `font-*`) |
| floating label ของช่องกรอก | Starter (`common/components/input` + rule `input ~ label` ใน `globals.css`) | **แก้** ให้ผูกเฉพาะ input ของ `common/components/input` |
| `cn` | shadcn (package `cn` ตาม ADR-030 ข้อ 3) | ใช้ตามเดิมไม่ extend |

Data model / Workflows / API routes: none · Admin UI: none · Storefront pages: ไม่มีหน้าใหม่ — PDP (และหน้าที่ระบุในกฎ 23c) หน้าตาเปลี่ยนตามกฎ 23

### Business rules (ต่อจากกฎ 21)
22. (SFUI-9a–9e) แทน token `text-{xsmall,small,base,large,xl,2xl,3xl}-{regular,semi}` **ทุกจุด**ในไฟล์ของ task (รวม comment, ค่า default ของ prop, ค่าคงที่, template literal) ด้วย utility มาตรฐาน
    ที่ให้ **ค่าที่ render ที่ปลาย develop** (commit ที่ branch แตกออกมา ก่อนแก้ใดๆ) ของ `font-size`, `line-height`, `font-weight` เท่าเดิมทั้งบน element นั้นและลูกที่สืบทอดค่า — กฎ 19 ชนะ:
    (a) ค่าเริ่มต้นตามตาราง map ของกฎ 2 (`xsmall-*` → `text-[10px] leading-4`, `small-*` → `text-xs leading-5`, `base-*` → `text-sm leading-6`, `large-*` → `text-base leading-6`, `xl-*` → `text-2xl leading-[36px]`,
        `2xl-*` → `text-[30px] leading-[48px]`, `3xl-*` → `text-[32px] leading-[44px]` + `font-normal`/`font-semibold`) ใช้ได้เฉพาะเมื่อ token ไม่ชนกับ class อื่น
    (b) token อยู่ใน `cn(...)`/`cn` ของ wrapper ร่วมกับ class ที่ตั้ง font-size/line-height/font-weight (รวมแบบมีเงื่อนไข) → ผลปัจจุบันมาจาก `cn` ที่ extend (token เป็นกลุ่ม font-size: font-size ที่มาทีหลังตัด token
        ทั้งก้อนรวม line-height/น้ำหนัก และ token ที่มาทีหลังตัด `text-<ขนาด>`/`leading-*` ก่อนหน้า) ซึ่งต่างจาก `cn` มาตรฐานหลังแทน → เขียน class ที่ให้ผลลัพธ์เท่าค่าที่ render เดิม**ทุกกิ่งของเงื่อนไข**
    (c) className เดียวกันมีสอง class ที่ตั้ง property เดียวกันโดยไม่มี variant (เช่น token + `font-medium`, token + `text-xs`) → ผลขึ้นกับลำดับใน CSS ที่ compile ไม่ใช่ลำดับใน className →
        คงเฉพาะ class ที่ชนะจริง (ห้ามเหลือสอง class ไม่มี variant ที่ตั้ง property เดียวกันในจุดที่แทน)
    (d) element ที่ property ถูกทับด้วย rule ที่ specificity สูงกว่า (floating label กฎ 23, `<hN>` ที่ผู้เรียกตั้งขนาดเอง) → แทนตาม (a)–(c) ของ class; ค่าที่ render ไม่เปลี่ยนเพราะ rule เดิมยังชนะ (กฎ 23 เป็นเจ้าของการเปลี่ยน)
    (e) ห้ามสร้าง `@utility`/component/ค่าคงที่ใหม่มาแทน token (เขียน utility ตรงทุกจุด); comment ที่อ้างชื่อ token เขียนใหม่เป็นค่า (เช่น "12px/20px/400")
    — builder บันทึกใน PR: ตารางจุดที่เข้า (b)/(c) พร้อมค่าที่วัดที่ปลาย develop และ class ที่เลือก
23. (SFUI-8) floating label: (a) rule `input:focus ~ label`, `input:not(:placeholder-shown) ~ label` และ `input:focus ~ label` (transition) ใน `globals.css` ต้องไม่จับ `<label>` อื่นนอกจาก label ลอยของ
    `src/modules/common/components/input/index.tsx` — วิธีที่แนะนำ: ลบสอง rule ออกจาก `globals.css` แล้วใส่ `peer` ให้ input (ผ่าน `className` ของ `Input` จาก `ui/` — กฎ 3) และ variant `peer-focus:`/`peer-not-placeholder-shown:`
    บน label; ถ้า variant ให้ค่าไม่เท่าเดิม ใช้ selector ใน `globals.css` ที่ผูก attribute เฉพาะ เช่น `label[data-floating-label]` ได้ (ห้ามผูกด้วย `data-slot="input"` เพราะ `Input` ของ shadcn ใช้ที่อื่นด้วย)
    (b) label ลอยทำงานเหมือนเดิมทุกค่า: ตอนว่างและไม่ focus = ตำแหน่ง/ขนาดเดิม (สืบทอด `text-sm leading-5`), ตอน focus หรือมีค่า = `font-size` 10px, `line-height` 16px, น้ำหนัก 400, เลื่อนขึ้น 12px
        (v4 ใช้ property `translate` — วัดค่าจริงที่ปลาย develop), ตอน focus = `left: 0px` + transition 300ms; ค่าที่เติมจากโค้ดลอยทันทีไม่มี transition (CORE-4e)
    (c) **เปลี่ยนหน้าตา (แก้บั๊กที่ owner สั่ง — มีมาตั้งแต่ starter)**: `<label>` ที่ไม่ใช่ floating label แต่เคยถูก rule เดิมจับ ได้ค่าตาม className ของตัวเอง (หรือที่สืบทอด) และไม่เลื่อน
        — อย่างน้อย `option-button` (`products/components/product-actions/option-select.tsx`) และ label ที่ครอบ `product-quantity-select` (`product-actions/index.tsx`) บน PDP:
        12px / 20px / 400 (`text-small-regular` → `text-xs leading-5 font-normal`) และ `translate` = `none` (เดิม 10px/16px และ -12px); builder หา `<label>` อื่นที่ตรง selector เดิมบนหน้าใน AC-17 + หน้า group buy
        + หน้าที่มี `Checkbox`/`RadioGroup` ใน `<form>` (Radix สร้าง `<input>` ซ่อนเป็นพี่น้อง) ด้วย `document.querySelectorAll("input:not(:placeholder-shown) ~ label")` ที่ปลาย develop แล้วระบุใน PR
        พร้อมค่าก่อน/หลัง; label ที่ค่าหลังไม่ตรง className ของตัวเอง = blocker
    (d) SFUI-8 ไม่แก้ไฟล์ของ SFUI-9x (`option-select.tsx`, `product-actions/index.tsx` เป็นของ 9b) — ค่าหลังแก้ของ (c) ได้จาก token หรือ utility ที่แทนแล้วก็เท่ากัน (กฎ 22a)
24. (SFUI-10) หลัง SFUI-8 และ 9a–9e merge: ลบ `@utility text-*-regular/semi` ทั้ง 13 ตัวจาก `globals.css`; `src/lib/utils.ts` = `export { cn } from "cn"` (ADR-030 ข้อ 3 — ไม่มี `cn/config`, `createCn`, `FONT_SIZE_UTILITIES`);
    test ที่อ้าง token/`createCn` ปรับตาม (`src/lib/utils.test.ts` คง `cn("px-2", "px-4") === "px-4"`, `src/styles/theme-css.test.ts`, AC-7 ใน `e2e/sfui-shadcn-init.unit.spec.ts`, ตัวอย่าง class ใน `e2e/sfui-legacy.unit.spec.ts`);
    guard static กัน token กลับมา (AC-24); กฎ 2 ส่วนที่ห้ามส่ง token เข้า `@/components/**` (AC-19) คงไว้ (ไม่มีผลเมื่อไม่มี token)
25. ทุก task ของรอบ 45: e2e เดิมผ่านโดยไม่แก้ locator/assertion (กฎ 19) — ข้อยกเว้นเดียวคือ assertion ที่ยึดค่าบั๊กของกฎ 23c (ถ้ามี) ซึ่ง SFUI-8 แก้พร้อมเหตุผลใน PR; `src/components/ui/*`, `apps/backend/**`,
    `package.json`/lockfile ไม่ถูกแก้ (กฎ 3, 18)

### Acceptance criteria (ต่อจาก AC-19)
- AC-20 (SFUI-9a–9e, กฎ 22) static (คำสั่งใน PR + reviewer): `grep -rnoE "\btext-(xsmall|small|base|large|xl|2xl|3xl)-(regular|semi)\b"` บนไฟล์ในขอบเขตของ task = 0 บรรทัด
- AC-21 (SFUI-9a–9e, กฎ 22) e2e ใหม่ `e2e/sfui-9<x>-font.spec.ts` (ลูกค้าที่ login + seed ของ CORE-2; รูปแบบเดียวกับ `sfui-5b-catalog.spec.ts`): Given หน้าในขอบเขตของ task When อ่าน
  `getComputedStyle` (`fontSize`, `lineHeight`, `fontWeight`) Then เท่าค่าที่วัดที่ปลาย develop ก่อนแก้ — จุดตัวอย่าง = **ทุก token ที่ต่างกันในขอบเขตอย่างน้อย 1 จุด + ทุกจุดที่เข้ากฎ 22b/22c** ที่ render ได้ด้วย seed
  (จุดที่ render ไม่ได้ระบุใน PR พร้อมเหตุผล); หาด้วย `data-testid` (หรือ role ภายใน container ที่มี testid); ห้ามใช้ element ที่ถูก rule floating label เดิมจับ (กฎ 23c — เป็นของ AC-23);
  **spec นี้ต้องผ่านทั้งบน commit ฐาน (ก่อนแก้ — รันไฟล์ spec ใหม่บน worktree ของ commit ฐาน) และหลังแก้** — แนบผลรันทั้งสองใน PR/evidence; e2e ทุก spec ที่อ้างหน้าในขอบเขต (รวม `sfui-5*`, `sfui-6-parity`, `sfui-3e-shipping`) ผ่านโดยไม่แก้
- AC-22 (SFUI-8, กฎ 23a) static `e2e/sfui-8-floating-label.unit.spec.ts`: Given `globals.css` Then ไม่มี selector ที่ลงท้ายด้วย `~ label` หรือ `+ label` โดย `label` ไม่มี class/attribute กำกับ
  (เช่น `input:focus ~ label`); ถ้าใช้ทางเลือก attribute ของกฎ 23a: attribute นั้นพบใน `src/**/*.tsx` เฉพาะ `common/components/input/index.tsx`
- AC-23 (SFUI-8, กฎ 23b–c) e2e ใหม่ `e2e/sfui-8-floating-label.spec.ts`:
  (1) Given หน้า login/register และ checkout `step=address` When ยังไม่กรอก Then label ลอยมี `translate` = `none` และขนาดสืบทอดเดิม; When focus ช่อง Then label 10px/16px/400 และ `translate` เลื่อนขึ้น 12px, `left` = 0px;
      When กรอกแล้ว blur Then ยัง 10px/16px และเลื่อนขึ้น 12px — ค่าทุกตัวเท่าที่วัดที่ปลาย develop (spec ผ่านบน commit ฐานด้วย สำหรับข้อ 1);
  (2) Given PDP `/<cc>/products/t-shirt` Then ทุก `option-button` และ label ที่ครอบ `product-quantity-select` เป็น 12px/20px/400, `translate` = `none` และ `option-button` ไม่ทับ `legend` ของ fieldset
      (`option-button.top >= legend.bottom`) — ข้อนี้ **ล้มบน commit ฐาน** (บั๊กที่แก้) แนบผลใน PR; (3) label อื่นในรายการของกฎ 23c ได้ค่าตาม className ของตัวเอง;
  e2e `core-38-mobile-layout` (AC-132), `sfui-5a-common`, `core-4e-checkout-polish`, `core-24-pdp-quantity`, `core-25-pdp-option-reset`, `core-14b-add-variant`, `fs-21-customer-limit`, `fs-23-pdp-cart-aware-limit`,
  `flash-sale-fs15`, `group-buy-join`, `group-buy-ui-polish` ผ่าน (กฎ 25)
- AC-24 (SFUI-10, กฎ 24) static `e2e/sfui-10-font-utilities.unit.spec.ts`: (a) ทุกไฟล์ใน `apps/storefront/src/**` (รวม `.css`, test, comment) ไม่มี regex ของ AC-20; (b) `globals.css` ไม่มี `@utility text-`;
  (c) `src/lib/utils.ts` มีเพียง `export { cn } from "cn"` และไม่มีไฟล์ใน `src/` ที่อ้าง `cn/config`, `createCn`, `FONT_SIZE_UTILITIES`; `pnpm --filter storefront build`, `typecheck`, `lint`, `test:unit`,
  `test:e2e:unit` ผ่าน; e2e storefront ทั้งชุดผ่านใน CI (รวม AC-21 ของทุก 9x และ AC-23)
- AC-25 (ทุก task รอบ 45, กฎ 25) reviewer: `git diff origin/develop --stat -- apps/backend apps/storefront/src/components/ui apps/storefront/package.json pnpm-lock.yaml` ว่าง

### Test plan
| ชนิด | AC |
|---|---|
| static (`test:e2e:unit`) | AC-22, AC-24 |
| unit (Vitest) | AC-24 (`utils.test.ts`, `theme-css.test.ts` ที่ปรับ) |
| e2e (Playwright) | AC-21 (ทุก 9x), AC-23 + ชุดเดิมทั้งหมด (กฎ 25) |
| คำสั่ง/reviewer | AC-20, AC-25 |
qa เก็บ evidence ทุก task (UI): 9a–9e screenshot ก่อน/หลังของหน้าตัวอย่าง (ต้องเหมือนกัน); SFUI-8 ก่อน/หลังของ PDP (ป้ายตัวเลือก/จำนวน) + ช่องกรอกที่ label ลอย; SFUI-10 ไม่มี UI ใหม่ (ไม่ต้อง qa ถ้า CI e2e ผ่าน)

### Tasks (รอบ 45)
เจ้าของไฟล์: แต่ละไฟล์มี task เดียว ยกเว้น `globals.css`: SFUI-8 (rule floating label) → SFUI-10 (`@utility`) ตามลำดับ · ขอบเขตโฟลเดอร์ของ 9a–9e = ขอบเขตของ 5a–5e **รวม**ไฟล์ที่ 5x เคยยกเว้นให้ 3x/4 แล้ว
(งานเหล่านั้น merge แล้ว) · จำนวนนับ ณ `b2b27ccc` (grep regex ของ AC-20 บน `src/`)

| Task | งาน — ไฟล์ที่เป็นเจ้าของ | AC | Depends | ∥ | LOC |
|---|---|---|---|---|---|
| SFUI-8 | floating label (กฎ 23): `src/styles/globals.css` (เฉพาะ rule `… ~ label` ใน `@layer utilities`), `src/modules/common/components/input/index.tsx`, ใหม่ `e2e/sfui-8-floating-label.{spec,unit.spec}.ts`, assertion เดิมที่ยึดค่าบั๊ก (ถ้ามี — กฎ 25) | AC-22, AC-23, AC-25 | PR เอกสารรอบ 45 | ∥ 9a–9e | ~150 |
| SFUI-9a | common + layout + หน้าคงที่: `src/modules/{common,layout,skeletons,shipping,policies}/**` (ยกเว้น `common/components/input/**` ของ SFUI-8), `src/app/not-found.tsx`, `src/app/[countryCode]/(main)/**` ที่ไม่อยู่ใน 9b–9e (`not-found.tsx`, `verify-account/**` ฯลฯ) — ~21 จุด/14 ไฟล์; ใหม่ `e2e/sfui-9a-font.spec.ts` | AC-20, AC-21, AC-25 | PR เอกสารรอบ 45 | ∥ | ~120 |
| SFUI-9b | catalog: `src/modules/{products,store,home,categories,collections,search}/**`, `src/app/[countryCode]/(main)/{store,products,categories,collections,search}/**` — ~50 จุด/22 ไฟล์; ใหม่ `e2e/sfui-9b-font.spec.ts` | AC-20, AC-21, AC-25 | PR เอกสารรอบ 45 | ∥ | ~200 |
| SFUI-9c | checkout + cart + returns: `src/modules/{checkout,cart,returns}/**`, `src/app/[countryCode]/(checkout)/**`, `src/app/[countryCode]/(main)/cart/**` — ~20 จุด/11 ไฟล์; ใหม่ `e2e/sfui-9c-font.spec.ts` | AC-20, AC-21, AC-25 | PR เอกสารรอบ 45 | ∥ | ~120 |
| SFUI-9d | account + order: `src/modules/{account,order}/**`, `src/app/[countryCode]/(main)/{account,order}/**` (ยกเว้น `account/@dashboard/vouchers/**` ของ 9e) — ~63 จุด/20 ไฟล์; ใหม่ `e2e/sfui-9d-font.spec.ts` | AC-20, AC-21, AC-25 | PR เอกสารรอบ 45 | ∥ | ~250 |
| SFUI-9e | ฟีเจอร์: `src/modules/{group-buy,affiliate,evoucher}/**`, `src/app/[countryCode]/(main)/{affiliate,g}/**`, `src/app/[countryCode]/(main)/account/@dashboard/vouchers/**` — ~63 จุด/14 ไฟล์; ใหม่ `e2e/sfui-9e-font.spec.ts` | AC-20, AC-21, AC-25 | PR เอกสารรอบ 45 | ∥ | ~250 |
| SFUI-10 | ปิดงาน (กฎ 24): `src/styles/globals.css` (ลบ `@utility` 13 ตัว), `src/lib/utils.ts`, `src/lib/utils.test.ts`, `src/styles/theme-css.test.ts`, `e2e/sfui-shadcn-init.unit.spec.ts` (AC-7), `e2e/sfui-legacy.unit.spec.ts` (ตัวอย่าง class), ใหม่ `e2e/sfui-10-font-utilities.unit.spec.ts` | AC-24, AC-25 | SFUI-8, SFUI-9a..9e ทั้งหมด | — | ~120 |

ลำดับ: (SFUI-8 ∥ 9a ∥ 9b ∥ 9c ∥ 9d ∥ 9e) → SFUI-10
- ไฟล์ที่ไม่อยู่ในขอบเขตใดแต่ grep พบ token → เป็นของ 9x ตามโฟลเดอร์ที่ใกล้ที่สุด แจ้ง planner ถ้าไม่ชัด; รวมแล้วเกิน ~450 LOC ให้หยุดแตกตามโฟลเดอร์ย่อยแล้วแจ้ง planner
- กลุ่มขนานไม่มีไฟล์ร่วม (SFUI-8 ไม่แตะไฟล์ของ 9x — กฎ 23d); `globals.css` แตะโดย 8 → 10 เท่านั้น
- **stack (วิธีเดียวกับรอบ 44 — owner อนุญาต 2026-11-26, ADR-030)**: SFUI-8 และ 9a–9e แตก branch จาก branch เอกสาร `docs/SFUI2-font-utilities`; SFUI-10 แตกจาก branch ที่รวม 8 + 9a..9e แล้ว
  โดยไม่รอ merge → เปิด PR ทั้งชุดตอนท้าย (base = `develop`) → merge ตามลำดับข้างบน ทีละตัวตามกติกา merge ของ CLAUDE.md (sync `origin/develop` + CI เขียวก่อนแต่ละตัว); "ปลาย develop" ของกฎ 22/AC-21
  = commit ที่ branch ของ task แตกออกมา (ก่อนแก้)
- ไม่งด release ระหว่างรอบ 45 (แต่ละ task merge แล้ว develop ยังสมบูรณ์: 9x ไม่เปลี่ยนค่าที่ render, SFUI-8 เป็นการแก้บั๊ก, SFUI-10 ลบของที่ไม่มีผู้ใช้)

## ส่วนฟอร์ม (รอบ 48 — owner 2026-11-27, ก่อน release v0.4.0)
Status: done — SFUI-11a..13 ☑ (#605–#610, merge 2026-11-27; เอกสาร #604) · AC-26..37 ☑ (qa ไม่พบ defect — `docs/evidence/storefront-forms/SFUI-*/REPORT.md`)
· SFUI-14 (defect จากทดสอบ manual 2026-11-28 — กฎของ starter ใน `globals.css` ทับ shadcn: ขอบช่องกรอกตอน autofill, เมนูเปิดแบบซูม) ☑ #612 · AC-38, AC-39 ☑ (`docs/evidence/storefront-forms/SFUI-14/REPORT.md`)
(owner 2026-11-27 — ADR-032 accepted "รับตามข้อเสนอ" D1–D5 = ก, Q3 = ตามข้อเสนอ, Q4 = ไม่ทำรอบนี้, Q5 = stack ได้; เพิ่มกติกาการจัดวาง กฎ 37 + ความสูง 36px ตาม default)
Goal (owner's words, 2026-11-27): **ทุกฟอร์มของ storefront** ปรับช่องกรอกให้ "คงตาม default ที่ shadcn ให้มาพร้อม component" — label อยู่เหนือช่อง (ไม่ใช่ floating label อีกต่อไป),
พร้อมข้อความ error, ป้ายบังคับกรอก (*) และ placeholder ตามความเหมาะสม
Out of scope: เปลี่ยนกฎ validation/ข้อความ error ของ server action/`name`/ค่าใน `FormData`/flow · ช่องที่ไม่ใช่ฟอร์มกรอกข้อมูล (allow-list ของกฎ 26 — Q3) · Stripe Elements (สไตล์ภายใน iframe) ·
error ราย field จาก server (Q4) · `apps/backend/**` · หน้าอื่นนอกจากฟอร์มในตาราง inventory
ที่ตั้ง: เป็นส่วนของ spec 09 (ไม่แยก spec ใหม่) เพราะเป็นชั้นแสดงผล storefront บน shadcn ตาม ADR-030 และต้องอ้าง/ยกเว้นกฎ 3, 4, 13, 19, 22 ของ spec นี้โดยตรง; ทางเลือกอยู่ใน ADR-032

### What Medusa already gives us
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ช่องกรอก + label + error ของ storefront | Starter: `common/components/input` (floating label) — ไม่มี error/describedby | **แทน** ด้วย shadcn `field` (CLI) ประกอบใน component ร่วมเดิม (ADR-032 D1) |
| `<select>` ของฟอร์ม | Starter: `common/components/native-select` (ไม่มี label) | **ขยาย** ให้รับ label/error ผ่าน `field`; คง `<select>` native (กฎ 4) |
| ปุ่มในช่อง (แสดงรหัสผ่าน) | ไม่มี | shadcn `input-group` (CLI — ADR-032 D5) |
| validation + ข้อความ error | ไม่มี (Medusa คืน error ของ API; storefront ใช้ attribute native) | **custom เล็ก**: แปลผล `ValidityState` เป็นข้อความไทย (`src/lib/util/field-validation.ts`) — shadcn ไม่มี (คู่มือ useActionState ยัง "Coming Soon") |
| plugin จาก medusajs.com/integrations | ไม่มีสำหรับ UI ของ storefront | — |

Data model / Workflows / API routes: none · Admin UI: none · Storefront pages: ไม่มีหน้าใหม่ — ฟอร์มในตาราง inventory หน้าตาเปลี่ยน

### ตาราง inventory (ณ `2fc21531`) — ช่องในขอบเขต, ป้ายบังคับ, placeholder (ADR-032 D2), task เจ้าของ
`*` = `required` เดิม (ไม่เปลี่ยนว่าช่องไหนบังคับ) · placeholder ว่าง = ไม่มี · label = ข้อความเดิม (ช่องที่ยังไม่มี label ระบุข้อความใหม่)

| Task | ฟอร์ม (ไฟล์ใน `src/modules/`) | ช่อง (testid ของ control) — `*` บังคับ | placeholder | หมายเหตุ |
|---|---|---|---|---|
| 12a | login `account/components/login` | `email-input`*, `password-input`* | — | รหัสผ่านใช้ `InputGroup` (11a) |
| 12a | register `account/components/register` | `first-name-input`*, `last-name-input`*, `email-input`*, `phone-input`, `password-input`* | `phone-input`: `เช่น 0812345678` | |
| 12a | `account/components/profile-name` | `first-name-input`*, `last-name-input`* | — | ใน `edit-panel` ของ `account-info` |
| 12a | `account/components/profile-phone` | `phone-input` | `เช่น 0812345678` | `type="phone"`/`autoComplete="phone"` → `tel` (กฎ 33b) |
| 12a | `account/components/profile-password` | `old-password-input`*, `new-password-input`*, `confirm-password-input`* | — | ยังไม่ทำงาน (TODO ของ starter) — เปลี่ยนแค่หน้าตา |
| 12a | `account/components/profile-billing-address` | `billing-first-name-input`*, `billing-last-name-input`*, `billing-company-input`, `billing-phone-input`*, `billing-address-1-input`*, `billing-address-2-input`, `billing-postcal-code-input`*, `billing-city-input`*, `billing-province-input`, `billing-country-code-select`* (label ใหม่ "ประเทศ") | phone, postal | `type`/`autoComplete` ของ phone → `tel` |
| 12a | `account/components/address-card/{add-address,edit-address-modal}` | `first-name-input`*, `last-name-input`*, `company-input`, `address-1-input`*, `address-2-input`, `postal-code-input`*, `city-input`*, `state-input`, `country-select`*, `phone-input` | phone, postal | ใน `Dialog`; `autoComplete="phone"` → `tel` |
| 12b | `checkout/components/shipping-address` | `shipping-first-name-input`*, `shipping-last-name-input`*, `shipping-address-input`*, `shipping-company-input`, `shipping-postal-code-input`*, `shipping-city-input`*, `shipping-country-select`*, `shipping-province-input`, `billing-address-checkbox` (horizontal), `shipping-email-input`*, `shipping-phone-input` | phone, postal | |
| 12b | `checkout/components/billing_address` | `billing-first-name-input`*, `billing-last-name-input`*, `billing-address-input`*, `billing-company-input`, `billing-postal-input`*, `billing-city-input`*, `billing-country-select`*, `billing-province-input`, `billing-phone-input` | phone, postal | |
| 12b | `checkout/components/addresses` (cart digital-only) | `billing-email-input`* | — | |
| 12b | `checkout/components/discount-code` | `discount-input` (label ใหม่ "โค้ดส่วนลด") | — | `promotion-error` คงเป็นระดับฟอร์ม (CORE-28) แต่ผูก `aria-describedby` เมื่อช่องเปิด (กฎ 32d) |
| 12c | `returns/components/return-request-form` | ต่อแถว: `return-item-quantity` ("จำนวนที่คืน"), `return-item-reason` ("เหตุผล") | — (option ว่างเดิม) | id ไม่ซ้ำต่อแถว |
| 12c | `group-buy/components/group-page/group-join` | `group-quantity` ("จำนวน"), `group-address-select` ("ที่อยู่จัดส่ง"), `group-shipping-option` ("วิธีจัดส่ง") | — | ไม่ใช่ `<form>` แต่เป็นชุดช่องกรอก → ใช้ `NativeSelect` + `field` |
| 12c | `affiliate/components/auth-forms` | login: `affiliate-login-email`*, `affiliate-login-password`*; register: `affiliate-register-name`*, `affiliate-register-code`*, `affiliate-register-email`*, `affiliate-register-password`* | — | label ของรหัสแนะนำคงข้อความเดิม (baseline กฎ 10) |

### Business rules (ต่อจากกฎ 25)
26. ขอบเขต = ทุกช่องในตาราง inventory. **allow-list (ไม่ใช่ฟอร์มกรอกข้อมูล — คงเดิม, Q3)** = คู่ "ไฟล์ + element" ตามตารางนี้เท่านั้น (AC-35 ใช้ตารางเดียวกันเป็นค่าคงที่ใน test;
    path ใต้ `src/modules/` ยกเว้นที่ระบุ):

    | ไฟล์ | element ที่ยกเว้น (testid ของ control หรือเงื่อนไข) | เหตุผล |
    |---|---|---|
    | `store/components/store-search-box/index.tsx` | `<input type="search">` `store-search-input` | ช่องค้นหา |
    | `search/components/search-form/index.tsx` | `<input type="search">` `search-query-input` | ช่องค้นหา |
    | `layout/components/search/index.tsx` | `<input type="search">` `search-input` | ช่องค้นหาใน drawer |
    | `store/components/store-refinements/on-sale-toggle.tsx` | `<input type="checkbox">` `on-sale-toggle` | ตัวกรอง |
    | `store/components/store-refinements/refinement-group.tsx` | `<input type="checkbox">` ใน `refinement-<attribute>` | ตัวกรอง |
    | `products/components/product-actions/option-select.tsx` | `<input type="radio">` (sr-only — testid `option-button` อยู่บน label) | ตัวเลือกสินค้า |
    | `products/components/product-actions/index.tsx` | `<select name="quantity">` `product-quantity-select` | จำนวนบน PDP |
    | `cart/components/cart-item-select/index.tsx` | `<select>` (testid จากผู้เรียก) | จำนวนในตะกร้า |
    | `group-buy/components/group-page/group-join.tsx` | `<input type="number">` `group-selection-quantity` **เท่านั้น** (select สามตัวของไฟล์นี้อยู่ในขอบเขต — 12c) | จำนวนต่อแถวในรายการที่เลือก |
    | ทุกไฟล์ใน `src/modules/**`, `src/app/**` | `<input type="hidden">` | ไม่ใช่ช่องที่ผู้ใช้กรอก |

    ไม่ต้องอยู่ใน allow-list เพราะไม่ใช่ `<input>`/`<select>`/`<textarea>` ของ JSX: `checkout/components/address-select` (`Select` ของ Radix), `common/components/filter-radio-group` และตัวเลือกจัดส่ง/ชำระเงิน (`RadioGroup`)
27. **ยกเว้นกฎ "คง computed style" (กฎ 19, 22 และบทเรียน CLAUDE.md เรื่องงานย้าย class)** — รอบนี้**ตั้งใจเปลี่ยนหน้าตา**เฉพาะ: control ในตาราง inventory, label/ป้าย `*`/คำอธิบาย/ข้อความ error ของช่องนั้น,
    ระยะระหว่างช่องที่ `Field` กำหนด และ **grid ของช่อง** (container ที่จัดช่องเป็นแถว/คู่ตามกฎ 37); ส่วนอื่นของหน้า (ปุ่ม, หัวข้อ, ข้อความระดับฟอร์ม, layout ของหน้ารอบฟอร์ม) **ยังอยู่ใต้กฎ 19**
    (a) e2e/static ที่ยึดหน้าตาช่องกรอกเดิมแก้ได้**เฉพาะรายการใน AC-29** (+ ไฟล์ที่ task ระบุในตาราง Tasks) พร้อมเหตุผลใน PR; e2e อื่นผ่านโดยไม่แก้
    (b) ค่าที่ test ใหม่ assert = ค่าจาก component ของ shadcn ที่ render จริง (วัดด้วย `getComputedStyle` บน build ของ branch) ไม่ใช่ค่าที่อ่านจากชื่อ class
    (c) **ประกาศการแทนถ้อยคำ (ไม่แก้ไฟล์ spec 01 ในรอบนี้ — ข้อนี้มีผลเหนือถ้อยคำเดิม)**: ตั้งแต่ SFUI-11a merge ถ้อยคำต่อไปนี้ถูกแทนด้วยกฎ 28 (label เหนือช่อง ไม่ทับค่าโดยโครงสร้าง) และกฎ 35/37:
        - spec 01 **กฎข้อ 56** — เฉพาะท่อน "floating label ของ input ที่อยู่ไม่ซ้อนกับค่าที่เติมจากการเลือก" (ส่วน `data-testid`/`aria-label` ของ popup และ nudge ยังมีผล)
        - spec 01 **กฎข้อ 63d** — เฉพาะความสูง `h-12` ของ `CountrySelect`/`Input` (เจตนา "ช่องในแถวเดียวกันสูงเท่ากัน" ยังมีผล — กฎ 35)
        - spec 01 **กฎข้อ 96** — เฉพาะส่วน label ลอยของ `Input` ไม่ทับค่า (ส่วนสรุปที่อยู่ของ checkout ยังมีผล)
        - spec 01 **AC-91** — เฉพาะขั้น "label ไม่ทับค่าที่เติมจากที่อยู่ที่บันทึกไว้" (placeholder ไทย/testid/aria-label ยังมีผล); **AC-132** — เฉพาะขั้น label ของฟอร์ม register/login/ที่อยู่ไม่ทับค่า
        - spec 09 **กฎ 23b** และ **AC-23 (1)** (ทั้งข้อ)
        e2e ของข้อเหล่านั้นแก้ตาม AC-29; กฎ 23a/23c, AC-22, AC-23 (2)(3) (label อื่นไม่ถูก rule ลอยจับ) ยังมีผล
28. (11a) โครงของช่อง = ตัวอย่างของ shadcn: `Field` (vertical) → `FieldLabel htmlFor={id}` → control (`id`) → `FieldDescription` (ถ้ามี) → `FieldError` (ถ้ามี); checkbox = `Field orientation="horizontal"`
    → control → `FieldLabel`; **ห้ามส่ง className ที่เปลี่ยนสไตล์ default** ของ `Field`/`FieldLabel`/`FieldDescription`/`FieldError`/`Input`/`InputGroup*` (ยอมเฉพาะ layout ภายนอก เช่น `w-full`, ตำแหน่งใน grid ที่ผู้เรียกส่งให้ `Field` ผ่าน prop `className`);
    ไม่มี variant ของ floating label เดิม (`peer-focus:`, `peer-not-placeholder-shown:`) ในโค้ดของเรา, `placeholder=" "` หรือ label แบบ `absolute` — class `peer/field-label`, `peer-disabled:` ฯลฯ
    ที่มากับไฟล์ของ CLI ใน `ui/` ไม่นับ (ตรงกับ AC-26 (b)); label อยู่เหนือ control (`label.bottom <= control.top`) และชิดซ้ายเดียวกัน — "control" ของช่องรหัสผ่าน = กล่อง `InputGroup` (`[data-slot="input-group"]`)
    ไม่ใช่ `<input>` ภายใน (ซึ่งเป็น `flex-1` ข้าง addon)
    (หมายเหตุสำหรับ qa/reviewer: `*` ห่างข้อความ label ~8px เพราะ `FieldLabel` ของ shadcn เป็น `flex gap-2` — default ของ shadcn **ไม่ใช่ defect**)
29. (11a) id/การผูก: `id` = prop `id` ของผู้เรียก หรือ `useId()` (ไม่ใช้ `name` — ฟอร์มที่อยู่ใน `Dialog` หลายตัว/ checkout มีชื่อซ้ำได้); `input.labels[0]` = `FieldLabel` ของช่อง;
    testid ใหม่ (เมื่อ control มี `data-testid="<t>"`): `<t>-label` บน `FieldLabel`, `<t>-description` บน `FieldDescription`, `<t>-error` บน `FieldError` — ต้องไม่ชนกับ testid ใน baseline (`e2e/support/sfui-baseline.json`)
30. (11a — ADR-032 D3) ป้ายบังคับ: control มี `required` ⇔ `FieldLabel` มี `<span aria-hidden="true">*</span>` (สี `text-destructive`) ต่อท้าย; ชื่อที่เข้าถึงได้ของ control = ข้อความ label ไม่มี `*`;
    ห้ามเขียน `*` ในข้อความ label ของผู้เรียก; ช่องไม่บังคับ**ไม่มีป้ายใดๆ** (ไม่ใส่ "(ไม่บังคับ)" — owner 2026-11-27)
31. (11a, 12x — ADR-032 D2) placeholder: `Input` รับ prop `placeholder` (เลิก `Omit`); ค่าตามตาราง inventory เท่านั้น (`เช่น 0812345678` ช่องเบอร์โทรศัพท์, `เช่น 10110` ช่องรหัสไปรษณีย์);
    `NativeSelect`/`CountrySelect` คง option ว่าง disabled เดิม (`เลือกประเทศ` — AC-91) (**ท่อน `CountrySelect` แทนด้วยรอบ 50 กฎ 70 — SFUI-20b**); placeholder ไม่แทน label
    (a) **ชุด option ของ `<select>` ทุกตัวต้องเท่าเดิม** (ไม่เพิ่ม ไม่ซ้ำ ไม่หาย): `NativeSelect` ปัจจุบันใส่ `<option disabled value="">` เองเสมอ → 11a เพิ่ม prop `placeholder={false}` (ไม่ render option ว่าง; ค่าเริ่มต้นคงพฤติกรรมเดิม)
        และ 12c ใช้กับ `group-quantity` (เดิมไม่มี option ว่าง — มีแค่ `PDP_QUANTITY_OPTIONS`), `group-address-select` (เดิมไม่มี option ว่าง) และ `group-shipping-option` (เดิมมี option ว่าง disabled "เลือกวิธีจัดส่ง" ของตัวเอง →
        ส่งเป็น `placeholder="เลือกวิธีจัดส่ง"` แทน option ที่เขียนเอง ให้เหลือตัวเดียว); `return-item-quantity`/`return-item-reason`/`billing-country-code-select` คง option เดิม (รวม `<option value="">-</option>` ของ billing)
        — AC-34 ตรวจด้วยรายการ `value`+ข้อความของ option เทียบกับ commit ฐาน
32. (11b — ADR-032 D4) error:
    (a) ระดับช่องจาก validation native ที่มีอยู่ (`required`, `type="email"`, `pattern`) เท่านั้น — **ไม่เพิ่ม/ลดกฎ** (ช่องว่างล้วนยังผ่าน client แล้ว server ตอบ error ตามเดิม — CORE-52/AC-147)
    (b) event `invalid` → `preventDefault()` + แสดง `fieldErrorMessage(validity, { label, title, control })` ใน `FieldError`: `valueMissing` → `กรุณากรอก<label>` (input) / `กรุณาเลือก<label>` (select);
        `typeMismatch` → `title` ของช่อง ถ้าไม่มี `กรุณากรอก<label>ให้ถูกต้อง`; `patternMismatch` → `title` ถ้าไม่มี `รูปแบบ<label>ไม่ถูกต้อง`; อื่นๆ → `<label>ไม่ถูกต้อง`; valid → ไม่มีข้อความ
        (`<label>` = prop `label` ไม่มี `*`); `Field` มี `data-invalid`, control มี `aria-invalid="true"`, `aria-describedby` มี id ของ `FieldError`
    (c) focus ช่องแรกที่ผิดตามลำดับ DOM: ช่องที่ได้ event `invalid` จะ focus ตัวเองเมื่อ `document.activeElement` ไม่ใช่ตัวเองและไม่ใช่ช่องอื่นที่ `:invalid` ในฟอร์มเดียวกัน
        (browser ส่ง `invalid` ตามลำดับ DOM → ช่องแรกได้ focus ช่องถัดไปไม่แย่ง); ไม่มีการส่ง server action
    (d) ข้อความหาย และ `aria-invalid`/การอ้าง id หายเมื่อค่าเปลี่ยน (พิมพ์ เลือก หรือ `value` จากโค้ด เช่น เลือกที่อยู่ที่บันทึกไว้) แล้ว `validity.valid`;
        prop `error` ของผู้เรียก (ถ้ามี) แสดงแบบเดียวกัน; `aria-describedby` อ้างเฉพาะ id ที่มี element อยู่จริง (description และ/หรือ error)
    (e) ระดับฟอร์ม: ข้อความจาก server action คงตำแหน่ง/testid/ข้อความเดิม (`login-error-message`, `register-error`, `register-email-exists`, `address-error-message`, `address-error`,
        `promotion-error`, `return-error`, `return-contact-store`, `affiliate-login-error`, `affiliate-register-error`, `error-message` ของ `account-info`) — ข้อยกเว้นเดียว: 12b ผูก `promotion-error` (กฎ 32d)
    (f) ไม่มี JS → bubble native ของ browser ตามเดิม (ฟอร์มยังส่งได้แบบเดิม)
33. (12x) ความถูกต้องของช่อง: (a) `name`/ค่าใน `FormData`/`required`/`type="email"`/`pattern`/`title`/`autoComplete` เดิมคงไว้ (กฎ 13); `Checkbox` คงพฤติกรรมของกฎ 20 (`onClick`, `defaultChecked`, ค่า `on`);
    (b) แก้ค่า HTML ที่ผิดมาแต่เดิม: `type="phone"` → `type="tel"`, `autoComplete="phone"` → `autoComplete="tel"` (ไม่มีผลกับ `FormData`)
34. (11a — ADR-032 D5) ช่องรหัสผ่าน: `InputGroup` + `InputGroupInput` (testid เดิมอยู่บน `<input>`) + `InputGroupAddon align="inline-end"` + `InputGroupButton` `type="button"` มีชื่อที่เข้าถึงได้ไทย
    `แสดงรหัสผ่าน`/`ซ่อนรหัสผ่าน` ตามสถานะ + `aria-pressed`; testid ใหม่ `<t>-toggle`
35. (11a) ขนาด: `Input`/`InputGroup` ตาม default ของ shadcn (`h-9` = 36px — owner 2026-11-27: ไม่ override); `NativeSelect` ใช้ class ตาม registry `native-select` ของ shadcn 4.23.1 (ไม่ใช้ component — กฎ 4) และสูงเท่า `Input` —
    ผู้เรียกเลิกส่ง `h-12` (`CountrySelect`, `profile-billing-address`); ช่องในแถวเดียวกันสูงเท่ากัน (spec 01 กฎ 63d เจตนาเดิม — e2e core-4g/core-4j ผ่านโดยไม่แก้)
36. (ทุก task รอบ 48) component ใหม่ใน `ui/` มาจาก `pnpm dlx shadcn@4.23.1 add field input-group` เท่านั้น (ได้ `field`, `separator`, `input-group`, `textarea`; `button`/`input`/`label` ที่มีแล้วต้อง "No changes.")
    + hash ใน `e2e/support/shadcn-ui.json` (AC-19); `package.json`/lockfile/`globals.css`/`apps/backend/**` ไม่ถูกแก้ (AC-25); ข้อความใหม่ทุกข้อความเป็นไทย (ESLint CORE-4 ผ่าน, กฎ 10)
37. (12a, 12b — owner 2026-11-27, ADR-032 ข้อ 6: "เรื่อง breakpoint ใช้ตาม class มาตรฐานของ tailwind") การจัดวาง — ใช้ breakpoint มาตรฐานของ Tailwind (`sm` 640, `md` 768, `lg` 1024;
    มีอยู่แล้วคู่กับ breakpoint ของ starter ใน `globals.css`) **ห้ามใช้ breakpoint ของ starter** (`2xsmall:`/`xsmall:`/`small:`/`medium:`/`large:`/`xlarge:`/`2xlarge:`) กับ container ของช่องกรอกในขอบเขต:
    (a) viewport < 768px: **ทุกช่องแถวละช่อง** เต็มความกว้างของฟอร์ม ตามลำดับ DOM เดิม (เดิมฟอร์มที่อยู่ของ checkout และคู่ชื่อในบัญชีเป็น `grid-cols-2` ทุกขนาดจอ → เปลี่ยน)
    (b) ≥ 768px (แท็บเล็ตขึ้นไป): คู่ในตารางนี้วางแถวเดียวกัน (ช่องแรกซ้าย) ด้วย `grid-cols-1 md:grid-cols-2`; คู่ที่เดิมใช้ `grid-cols-[144px_1fr]` (รหัสไปรษณีย์–เขต/อำเภอ) → `grid-cols-1 md:grid-cols-[144px_1fr]`;
        ช่องที่ไม่อยู่ในตารางวางแถวละช่อง (คงตามฟอร์มเดิม)

    | ฟอร์ม | คู่ที่วางแถวเดียวกันที่ ≥ 768px | ที่มา |
    |---|---|---|
    | checkout `shipping-address` | ชื่อ–นามสกุล, ที่อยู่–บริษัท, รหัสไปรษณีย์–เขต/อำเภอ, ประเทศ–จังหวัด, อีเมล–เบอร์โทรศัพท์ | คงคู่เดิม (`grid-cols-2`) |
    | checkout `billing_address` | ชื่อ–นามสกุล, ที่อยู่–บริษัท, รหัสไปรษณีย์–เขต/อำเภอ, ประเทศ–จังหวัด; เบอร์โทรศัพท์แถวถัดไป | คงคู่เดิม (`grid-cols-2` 9 ช่อง) |
    | checkout `addresses` (digital-only) | อีเมลแถวเดียว (ไม่มีคู่ — เดิมอยู่ใน `grid-cols-2` เพียงช่องเดียว) | คงเดิม |
    | `profile-name` | ชื่อ–นามสกุล | คงคู่เดิม |
    | `profile-password` | รหัสผ่านเดิม–รหัสผ่านใหม่; ยืนยันรหัสผ่านแถวถัดไป | คงคู่เดิม (grid 2 คอลัมน์ 3 ช่อง) |
    | `profile-billing-address`, `add-address`, `edit-address-modal` | ชื่อ–นามสกุล, รหัสไปรษณีย์–เขต/อำเภอ (`md:grid-cols-[144px_1fr]`), **จังหวัด–ประเทศ** | คงคู่เดิม + **planner เสนอ** จังหวัด–ประเทศ (สอดคล้องคู่ประเทศ–จังหวัดของ checkout) |
    | login, register, affiliate login/สมัคร, `profile-phone`, คืนสินค้า, group buy | ไม่มีคู่ — แถวละช่องทุกขนาดจอ (login/register กว้าง `max-w-sm` แคบเกินสำหรับสองช่อง; affiliate วางสองฟอร์มข้างกันที่ `small:` อยู่แล้ว — ระดับฟอร์มไม่ใช่ container ของช่อง จึงคงไว้; คืนสินค้าคง `small:flex-row` ของแถวสินค้าเดิม — เป็น layout ของแถวสินค้า ไม่ใช่คู่ช่อง) | คงเดิม |

    (c) ช่องในแถวเดียวกันสูงเท่ากันและ label อยู่ระดับเดียวกัน (label บรรทัดเดียวที่ ≥ 768px); `Dialog` ที่อยู่คง `sm:max-w-xl` เดิม (ไม่ใช่ช่องกรอก — กฎ 19)
    (d) **ข้อควรรู้ — layout ของหน้าเปลี่ยนที่ `small:` (1024) ของ starter คนละจุดกับ grid ของช่อง (`md:` 768)** และไม่แก้ในรอบนี้ (กฎ 19): checkout `page.tsx` `grid-cols-1 small:grid-cols-[1fr_416px]`,
        account `account-layout.tsx` `small:grid-cols-[240px_1fr]` → ที่ 768–1023px ฟอร์มกว้างเต็มหน้า (สรุปคำสั่งซื้อ/เมนูบัญชีอยู่ล่าง/บน) และเป็นคู่ช่อง; ที่ ≥ 1024px คอลัมน์ฟอร์มแคบลงเพราะมีคอลัมน์ข้าง
        แต่ยังเป็นคู่ช่อง (เท่ากับ `grid-cols-2` เดิม) — ไม่ขัดกัน; ถ้าคู่ใดที่ 1024–1279px label ตัดสองบรรทัดจนผิดข้อ (c) ให้ builder รายงาน planner (ไม่เปลี่ยน breakpoint เอง)

38. (SFUI-14 — defect owner 2026-11-28) สถานะ autofill ของ browser ต้องไม่เปลี่ยนขอบ เงา พื้น และ ring โฟกัสของช่องกรอก: กฎ `:-webkit-autofill` ของ starter ใน `globals.css` (`@layer utilities`, selector เช่น
    `input:-webkit-autofill` specificity 0,1,1 ชนะ utility class 0,1,0 ใน layer เดียวกัน) **ห้ามมี property `border*` และ `box-shadow`/`-webkit-box-shadow`** — เดิม `border: 1px solid #212121` ทับ `border-0` ของ `InputGroupInput`
    (กล่องเหลี่ยมดำซ้อนในช่องรหัสผ่าน) และ `border-input` ของ `Input` (ขอบดำ); `-webkit-box-shadow: 0 0 0 1000px #fff inset` ทับขอบบน/ล่าง/มุมของ `InputGroup` (control สูง 36px เท่ากลุ่ม) และทับ ring โฟกัส/`shadow-xs` ของ `Input`
    → คงเฉพาะ `-webkit-text-fill-color` + `transition: background-color 5000s …` (กันพื้นสีของ autofill — ยืนยันใน Chromium; Safari ยังไม่ได้ยืนยัน) · ข้อยกเว้นของกฎ 36 (`globals.css` ไม่ถูกแก้) เฉพาะ task นี้
    (b) keyframe ใน `globals.css` ต้องไม่ชื่อชนกับ keyframe ของ `tw-animate-css` (`enter`, `exit`, `accordion-*`, `collapsible-*`, `caret-blink`) — `@keyframes` ชื่อเดียวกันตัวหลังทับทั้งก้อน:
    เดิม `@keyframes enter` ของ starter (scale 0.9 + opacity) ทับ `enter` ที่ `animate-in` ของ shadcn ใช้ → Sheet/Dialog/Popover/Select เปิดแบบซูม (popup) แทนการเลื่อน/ซูม 95% ตามที่ shadcn กำหนด
    (owner เห็นที่เมนู `nav-menu-button`); ลบ `--animate-enter`/`--animate-leave` + `@keyframes enter`/`leave` ของ starter (ไม่มีผู้ใช้). keyframe อื่นของ starter (`ring`, `fade-in-right`, `fade-in-top`, `fade-out-top`, `slide-in`)
    ไม่ชนชื่อ — คงไว้ (ไม่มีผู้ใช้ใน `src/` ยกเว้น unit `theme-css.test.ts` ที่ตรวจ `animate-fade-in-top`)

### Acceptance criteria (ต่อจาก AC-25)
- AC-26 (SFUI-11a, กฎ 28, 35, 36) ☑ #605 static `e2e/sfui-11-form-field.unit.spec.ts`: (a) `common/components/{input,native-select,checkbox}/index.tsx` import `Field` และ `FieldLabel` จาก `@/components/ui/field`;
  (b) ไม่มีไฟล์ใน `src/**` (ไม่ใช่ test) ที่มี class `peer-focus:`/`peer-not-placeholder-shown:` หรือ `placeholder=" "`; (c) `CountrySelect`/`profile-billing-address` ไม่ส่ง `h-12` ให้ `NativeSelect`;
  (d) `src/components/ui/{field,separator,input-group,textarea}.tsx` อยู่ใน `e2e/support/shadcn-ui.json` (AC-19 ผ่าน); (e) className ที่ส่งเข้า `FieldLabel`/`FieldError`/`FieldDescription`/`ShadcnInput`/`InputGroupInput` ในสามไฟล์ข้อ (a) ไม่มี utility ของ font-size/line-height/font-weight/padding/height/สี
- AC-27 (SFUI-11a, กฎ 28–30, 34) ☑ #605 unit (jsdom) `src/modules/common/components/input/input.test.tsx` (render component จริง ไม่ mock primitive — บทเรียน PAY-16):
  `<Input label="อีเมล" name="email" required data-testid="email-input" />` → `FieldLabel` อยู่ก่อน `<input>` ใน DOM (`compareDocumentPosition`), `input.labels[0]` = label ที่มี testid `email-input-label`,
  `id` ไม่ว่างและต่างกันเมื่อ render สองตัวชื่อเดียวกัน, label มี `*` ใน element `aria-hidden="true"`, ชื่อที่เข้าถึงได้ (`getByRole("textbox", { name })`) = `อีเมล`; ไม่มี `required` → ไม่มี `*`;
  `placeholder` ส่งถึง `<input>`; `type="password"` + `data-testid="password-input"` → ปุ่ม `password-input-toggle` มีชื่อไทย, กดแล้ว `type` เป็น `text` และ `aria-pressed="true"`; `NativeSelect` + `label` และ `Checkbox` (horizontal: control ก่อน label) ตรวจแบบเดียวกัน
- AC-28 (SFUI-11a, กฎ 28–30, 35) ☑ #605 e2e ใหม่ `e2e/sfui-11-form-field.spec.ts`: Given `/<cc>/account` (ยังไม่ login) — ฟอร์ม login และ register (`login-to-register-button`); Given `/<cc>/checkout?step=address` (ลูกค้าที่ login + cart)
  When อ่านทุกช่องของสามฟอร์มนี้ในตาราง inventory Then `<t>-label` มองเห็น, `label.bottom <= box.top + 0.5`, `|label.left - box.left| <= 1` (`box` = กล่องของ control; ช่องรหัสผ่านใช้กล่อง
  `[data-slot="input-group"]` ที่ครอบ `<t>` แทน `<input>` — กฎ 28; checkbox ใช้เกณฑ์ horizontal ด้านล่างแทน), `control.labels[0]` = `<t>-label` (ประเมินใน browser),
  ข้อความ label ผ่าน `expectThai`; ช่อง `*` ในตารางมี `required` และ `[aria-hidden="true"]` ภายใน label มีข้อความ `*`; ช่องไม่บังคับไม่มี; `billing-address-checkbox`: `label.left >= checkbox.right`;
  `getComputedStyle(control).height` ของ `email-input` = ค่าที่วัดบน build (คาด `36px`) และ `shipping-country-select` สูงเท่า `shipping-city-input` (±1px) (**ท่อนประเทศแทนด้วยรอบ 50 — AC-63; SFUI-20b ลบขั้นนี้**); ไม่มี label ที่ `translate` ≠ `none`; หน้า 390px ไม่ล้นแนวนอน (AC-17)
- AC-29 (SFUI-11a, กฎ 27a) ☑ #605, #609 e2e เดิมที่ยึด floating label แก้ได้เฉพาะ: `sfui-8-floating-label.spec.ts` (ลบ AC-23 (1); (2)(3) คงไว้), `sfui-8-floating-label.unit.spec.ts` (test ที่ 3 → ไม่มี `peer` ใน `common/components/input`),
  `sfui-5a-common.spec.ts` (test "label ลอย" → label เหนือช่องและมองเห็น), `core-38-mobile-layout.spec.ts` + `core-4e-checkout-polish.spec.ts` (หา label ด้วย `input.labels[0]` แทน `parentElement.querySelector("label")`;
  เกณฑ์ "label ไม่ทับค่า" คงไว้), `sfui-9a-font.spec.ts` (ขั้น NativeSelect ของที่อยู่ใบเสร็จ → ค่าที่วัดบน build ใหม่); 12c แก้ `sfui-9e-font.spec.ts` (label ของ `group-quantity`) และขั้น group buy ของ `sfui-8-floating-label.spec.ts` —
  reviewer: `git diff origin/develop --stat -- apps/storefront/e2e` ของ task มีเฉพาะไฟล์ใหม่ของ task + ไฟล์ในรายการนี้ที่เป็นของ task
- AC-30 (SFUI-11b, กฎ 32b) ☑ #606 unit `src/lib/util/field-validation.test.ts`: `fieldErrorMessage` คืนค่าตามกฎ 32b ทุกกิ่ง (valueMissing input/select, typeMismatch มี/ไม่มี `title`, patternMismatch มี/ไม่มี `title`, กิ่งอื่น, valid → `null`)
  และทุกค่าที่ไม่ใช่ `null` มีอักษรไทย `/[฀-๿]/` และไม่มี `*`
- AC-31 (SFUI-11b, กฎ 32b–d) ☑ #606 unit `input.test.tsx` (เพิ่ม): prop `error="…"` → `<t>-error` มี `role="alert"`, control `aria-invalid="true"`, `aria-describedby` มี id ของ error; prop `description` → `aria-describedby` มี id ของ `<t>-description`;
  ไม่มี error → ไม่มี `aria-invalid` และทุก id ใน `aria-describedby` มี element อยู่จริง; dispatch `invalid` บนช่อง `required` ที่ว่าง → `defaultPrevented === true` และแสดง `กรุณากรอก<label>`; เปลี่ยนค่าแล้ว valid → error หาย
- AC-32 (SFUI-11b, กฎ 32) ☑ #606 e2e ใหม่ `e2e/sfui-11b-field-errors.spec.ts`: Given ฟอร์ม login When กด `sign-in-button` โดยช่องว่าง Then `email-input-error` และ `password-input-error` มองเห็นและเป็นไทย, ข้อความเท่ากับ
  `fieldErrorMessage` ที่คำนวณจาก label จริงใน DOM (ไม่ hard-code), `email-input` focus และมี `aria-invalid="true"` + `aria-describedby` ที่อ้าง id ของ `email-input-error`, URL ไม่เปลี่ยนและ `login-error-message` = 0;
  When กรอก `abc` ในอีเมลแล้วส่ง Then `email-input-error` = ค่า attribute `title` ของ `email-input`; When กรอกอีเมลถูก Then `email-input-error` = 0 และไม่มี `aria-invalid`;
  Given checkout `step=address` ช่องว่าง When กด `submit-address-button` Then `shipping-first-name-input-error` และ `shipping-country-select-error` (`กรุณาเลือกประเทศ` — **แทนด้วยรอบ 50 AC-63: ไม่มีช่องประเทศ**) มองเห็น และ focus อยู่ที่ช่องแรกที่ผิด;
  When เลือกที่อยู่ที่บันทึกไว้ (`shipping-address-select`) Then error ของช่องที่ถูกเติมหาย (กฎ 32d); `affiliate-register-code` ที่ผิด `pattern` → error = `title` ของช่อง
- AC-33 (SFUI-11b, 12x, กฎ 32e–f, 33a) ☑ #606–#609 e2e เดิมของ error ระดับฟอร์มและการคงค่าหลัง error ผ่านโดยไม่แก้: `core-4f-auth-errors`, `core-4h-auth-reason`, `core-20d-return-window`, `core-23c-account-forms`, `core-52-checkout-guards`,
  `core-73-register-existing-email`, `core-79-login-link-mobile`, `core-40-discount-action-race`, `affiliate-portal*.spec.ts` และทุก spec ที่ grep พบ testid ในกฎ 32e
- AC-34 (SFUI-12a/12b/12c, กฎ 28–31, 33b) ☑ #607–#609 e2e ใหม่ `e2e/sfui-12<x>-*-forms.spec.ts` (12a `account`, 12b `checkout`, 12c `feature`): Given ทุกฟอร์มของ task ในตาราง inventory (เปิด `edit-panel`/`Dialog`/view ที่ซ่อนอยู่ก่อนวัด)
  Then ทุกช่องผ่านเกณฑ์เดียวกับ AC-28 และ placeholder = ค่าในตาราง (`toHaveAttribute`) หรือไม่มี attribute; 12a: ช่องเบอร์โทรของ `profile-phone`/`add-address`/`edit-address-modal`/`profile-billing-address` มี `type="tel"` และ `autocomplete="tel"`;
  12b: เมื่อกด `add-discount-button` → `discount-input-label` อยู่เหนือ `discount-input` และเมื่อ `promotion-error` แสดงขณะช่องเปิด `discount-input` มี `aria-describedby` ที่อ้าง id ของ `promotion-error`;
  12c: `return-item-quantity`/`return-item-reason` ทุกแถวมี label ของตัวเองที่ `labels[0]` ชี้ถูกแถว (id ไม่ซ้ำ), `group-quantity`/`group-address-select`/`group-shipping-option` มี label เหนือช่อง;
  ทุก `<select>` ของ task (12a `billing-country-code-select`, `country-select`; 12b `shipping-country-select`, `billing-country-select` — **select ประเทศแทนด้วยรอบ 50 AC-63**; 12c ทุกตัวข้างต้น) มีรายการ `[value, ข้อความ, disabled]` ของ option
  เท่ากับที่วัดบน commit ฐาน (spec ผ่านบน commit ฐานด้วย — กฎ 31a; `group-shipping-option` มี option ว่าง disabled ตัวเดียว, `group-quantity`/`group-address-select` ไม่มี)
- AC-35 (SFUI-13, กฎ 26, 28) ☑ #610 static `e2e/sfui-13-form-guard.unit.spec.ts`: ทุก JSX `<input` (ยกเว้น `type="hidden"`), `<select`, `<textarea`, `<Input` ของ `@/components/ui/input` ใน `src/modules/**`, `src/app/**` (ไม่ใช่ test)
  อยู่ใน `common/components/{input,native-select,checkbox}` หรือตรงคู่ "ไฟล์ + element" ในตาราง allow-list ของกฎ 26 (test เก็บตารางเดียวกันเป็นค่าคงที่ — ระบุ testid/`type`/`name` ต่อไฟล์;
  ไฟล์ใน allow-list ที่มี element อื่นนอกจากที่ระบุ = ล้ม เช่น `<select>` ใน `group-join.tsx`); ไม่มีไฟล์ใดนอก `src/components/**` และ `common/components/input` import `@/components/ui/input`
  (`checkout/components/discount-code` ย้ายไป `common/components/input` ใน 12b); ทุก `<Input`/`<NativeSelect`/`<CountrySelect`/`<Checkbox` ของ `common/components` ในไฟล์ของตาราง inventory มี prop `label`
  (หรือค่าเริ่มต้นของ component — `CountrySelect` มี label เริ่มต้น `ประเทศ` — **ท่อน `CountrySelect` แทนด้วยรอบ 50 กฎ 70 (SFUI-20b); allow-list แก้ตามกฎ 65d/67b (19c/19d)**)
- AC-36 (ทุก task รอบ 48, กฎ 36, 27) ☑ #605–#610 reviewer: `git diff origin/develop --stat -- apps/backend apps/storefront/package.json pnpm-lock.yaml apps/storefront/src/styles/globals.css` ว่าง (ยกเว้น SFUI-14 #612 ที่แก้ `globals.css` ตามกฎ 38 — ข้อยกเว้นของกฎ 36 เฉพาะ task นี้), ไฟล์ใน `src/components/ui/` เป็นไฟล์ใหม่ของ CLI เท่านั้น
  (`--dry-run --diff` ได้ "No changes." — บันทึกใน PR), AC-5 (baseline testid/ข้อความไทย), AC-17 (390px), AC-19 ผ่าน; e2e storefront ทั้งชุดผ่านใน CI
- AC-37 (SFUI-12a, 12b, กฎ 37) ☑ #607, #608 (static ข้อ 3 #610) e2e — ใน `sfui-12a-account-forms.spec.ts` และ `sfui-12b-checkout-forms.spec.ts` (ทุกฟอร์มในตารางกฎ 37b ของ task; หาด้วย testid ของ control, เปิด `edit-panel`/`Dialog` ก่อนวัด):
  (1) Given viewport `375×812` When อ่าน `boundingBox` ของ **`[data-slot="field"]` ที่ครอบ control แต่ละตัว** (`page.getByTestId(t).locator("xpath=ancestor::*[@data-slot='field'][1]")` — ไม่ใช่ `<input>` เพราะ
      `InputGroupInput` เป็น `flex-1` ข้าง addon และ checkbox กว้าง 16px) Then เรียงตามลำดับ DOM แถวละช่อง: `Field` ถัดไป `top >=` `bottom` ของ `Field` ก่อนหน้า, ทุก `Field` `left` เท่ากัน (±1px)
      และกว้างเท่ากัน (±1px) — **ยกเว้นแถว checkbox** (`billing-address-checkbox`: ตรวจแค่ `left` และลำดับ ไม่ตรวจความกว้าง), `scrollWidth <= innerWidth`;
  (2) Given viewport `768×1024` และ `1280×800` Then ทุกคู่ในตารางกฎ 37b (`a`, `b` = กล่อง `[data-slot="field"]` แบบข้อ 1; ความสูงเทียบที่กล่อง control — `<select>`/`<input>`/`InputGroup`): `|a.top - b.top| <= 1`, `b.left >= a.right`, ความสูง control เท่ากัน (±1px) และ `<t>-label` ของทั้งคู่ `top` เท่ากัน (±1px); ช่องที่ไม่อยู่ในคู่ไม่มี control อื่นที่ `top` เท่ากัน;
  (3) Given viewport `767×1024` Then เหมือนข้อ (1) (ขอบ breakpoint `md`); static (ใน `sfui-13-form-guard.unit.spec.ts`): container ของช่องกรอกในไฟล์ของตาราง inventory ไม่มี variant breakpoint ของ starter
  (`2xsmall:`/`xsmall:`/`small:`/`medium:`/`large:`/`xlarge:`/`2xlarge:`) และไม่มี `grid-cols-2`/`grid-cols-[…]` ที่ไม่มี prefix `md:` (ยกเว้น container ระดับฟอร์มที่ระบุใน "ไม่มีคู่" ของตาราง)
- AC-38 (SFUI-14, กฎ 38) ☑ #612 e2e ใหม่ `e2e/sfui-14-autofill-border.spec.ts` (Chromium เต็ม — `channel: "chromium"`): (1) Given `/<cc>/account` (login) When จำลอง cascade ของ `:-webkit-autofill` บน `email-input`/`password-input`
  (สำเนากฎ autofill ทุกข้อใน layer และตำแหน่งเดิม แทน pseudo-class ด้วย attribute selector specificity เท่ากัน — Chrome autofill ช่องรหัสผ่านผ่าน CDP ไม่ได้) Then ขอบทั้งสี่ด้าน (ความกว้าง + สี) ของ
  `[data-slot=input-group-control]` (border-0) และ `Input` เท่าสถานะปกติ, computed `box-shadow` ของ `[data-slot=input-group-control]` และ `Input` เท่าสถานะปกติ (ไม่มีพื้นขาว inset ทับขอบ `InputGroup`),
  เมื่อโฟกัส: `box-shadow` ของ control และ ring ของ `InputGroup`/`Input` (spread 3px) เท่าตอนโฟกัสในสถานะปกติ; กฎ autofill ใน CSS ที่โหลดไม่มี property `border*`/`box-shadow` และยังมี `-webkit-text-fill-color` + `transition`;
  (2) Given ฟอร์ม register When Chrome autofill ที่อยู่จริงผ่าน CDP `Autofill.trigger` (ชื่อ/นามสกุล/อีเมล/เบอร์) Then ทุกช่องที่ `:-webkit-autofill` ขอบและ `box-shadow` เท่าสถานะปกติ, พื้น (`background-color`) alpha 0
  เท่าสถานะปกติ (ไม่เป็นสีฟ้าของ autofill) และเมื่อโฟกัส `email-input` ring เท่าตอนโฟกัสในสถานะปกติ
- AC-39 (SFUI-14, กฎ 38b) ☑ #612 (1) unit `src/styles/keyframes.test.ts`: ชื่อ `@keyframes` ใน `globals.css` ไม่ซ้ำกับของ `tw-animate-css/dist/tw-animate.css` (ไม่มี `enter`/`exit`); (2) e2e ใหม่ `e2e/sfui-14-menu-animation.spec.ts`:
  Given หน้าแรก When คลิก `nav-menu-button` Then ทุกเฟรมระหว่าง animation ของ `nav-menu-popup` (animationName `enter` ของ tw-animate-css) computed transform เป็น `matrix(1, 0, 0, 1, tx, 0)` (เลื่อนอย่างเดียว ไม่ scale) และมีเฟรมที่ `tx < 0` (เข้าจากซ้าย)

### Test plan
| ชนิด | AC |
|---|---|
| static (`test:e2e:unit`) | AC-26, AC-35 (+ AC-5, AC-19 เดิม) |
| unit (Vitest + jsdom) | AC-27, AC-30, AC-31 |
| e2e (Playwright) | AC-28, AC-29 (ที่แก้), AC-32, AC-33, AC-34, AC-37, AC-38, AC-39 + ชุดเดิม (กฎ 27a) |
| reviewer | AC-29 (รายการไฟล์), AC-36 |
qa: `*` ห่างข้อความ label ~8px (`FieldLabel` = `flex gap-2` ของ shadcn) และช่องสูง 36px เป็น default — ไม่บันทึกเป็น defect (กฎ 28, 35) · qa เก็บ evidence ทุก task ยกเว้น SFUI-13: screenshot ก่อน/หลังของฟอร์มในขอบเขต ≤ 5 รูป (11a: login + checkout ที่อยู่ 1280/390; 11b: error ใต้ช่อง; 12x: ฟอร์มของกลุ่ม) — `docs/evidence/storefront-forms/<task>/`;
builder รัน e2e **ทุก** spec ที่อ้างหน้าที่แตะ (grep path/testid ใน `apps/storefront/e2e/`) ก่อน push

### Tasks (รอบ 48)
เจ้าของไฟล์: task เดียวต่อไฟล์ ยกเว้นไฟล์ที่แก้**ตามลำดับ stack**: `common/components/input/index.tsx` + `input.test.tsx` + `native-select/index.tsx` (11a → 11b), `profile-billing-address` (11a แค่ `h-12` → 12a),
`sfui-8-floating-label.spec.ts` (11a → 12c) · ไฟล์ในกลุ่มขนาน (12a ∥ 12b ∥ 12c) ไม่ซ้ำกัน · LOC ไม่นับไฟล์ที่ CLI สร้างและ `shadcn-ui.json`

| Task | งาน — ไฟล์ที่เป็นเจ้าของ | AC | Depends | ∥ | LOC |
|---|---|---|---|---|---|
| SFUI-11a | ☑ #605 — component กลาง (กฎ 28–31, 34–36): `shadcn add field input-group` (`src/components/ui/{field,separator,input-group,textarea}.tsx`), `e2e/support/shadcn-ui.json`; เขียนใหม่ `common/components/input/index.tsx` (Field, `useId`, `*`, placeholder, `InputGroup` รหัสผ่าน), `common/components/native-select/index.tsx` (prop `label`/`id` + `placeholder={false}` ไม่ render option ว่าง — กฎ 31a + class ตาม shadcn + `h-9`), `common/components/checkbox/index.tsx` (horizontal, `useId`), `checkout/components/country-select/index.tsx` (label `ประเทศ`, เลิก `h-12`), `account/components/profile-billing-address/index.tsx` (เฉพาะเลิก `h-12`); unit ใหม่ `common/components/input/input.test.tsx`; e2e ใหม่ `sfui-11-form-field.{spec,unit.spec}.ts`; แก้ e2e ตาม AC-29 (ส่วนของ 11a) | AC-26–AC-29, AC-36 | PR เอกสารรอบ 48 (stack) | — | ~450 (e2e เดิมต้องแก้ใน PR เดียวกันให้เขียว; เกิน ~500 หยุดแจ้ง planner) |
| SFUI-11b | ☑ #606 — error ระดับช่อง (กฎ 32): ใหม่ `src/lib/util/field-validation.{ts,test.ts}`; `input/index.tsx` + `native-select/index.tsx` (prop `error`/`description`, `onInvalid`, `aria-invalid`/`aria-describedby`, focus ช่องแรก, ล้างเมื่อ valid); เพิ่มใน `input.test.tsx`; e2e ใหม่ `sfui-11b-field-errors.spec.ts` | AC-30–AC-33, AC-36 | SFUI-11a (stack) | — | ~300 |
| SFUI-12a | ☑ #607 — account (ตาราง inventory 12a): `account/components/{login,register,profile-name,profile-phone,profile-password,profile-billing-address}/index.tsx`, `account/components/address-card/{add-address,edit-address-modal}.tsx` (placeholder, label ประเทศของที่อยู่ใบเสร็จ, `tel`, การจัดวางกฎ 37); e2e ใหม่ `sfui-12a-account-forms.spec.ts` | AC-33, AC-34, AC-36, AC-37 | SFUI-11b (stack) | ∥ 12b, 12c | ~300 |
| SFUI-12b | ☑ #608 — checkout (ตาราง inventory 12b): `checkout/components/{shipping-address,billing_address,addresses,discount-code}/index.tsx` (**`discount-code` เลิก import `@/components/ui/input` ตรง → ใช้ `common/components/input` พร้อม `label="โค้ดส่วนลด"`**; `ui/label` ที่ครอบ `add-discount-button` คงไว้ — กฎ 19; คง `id="promotion-input"`, `name="code"`, testid เดิม — AC-35), `checkout/components/error-message/index.tsx` (prop `id` ไม่บังคับ — ใช้ผูก `promotion-error`), การจัดวางกฎ 37; e2e ใหม่ `sfui-12b-checkout-forms.spec.ts` | AC-33, AC-34, AC-36, AC-37 | SFUI-11b (stack) | ∥ | ~250 |
| SFUI-12c | ☑ #609 — returns + group buy + affiliate (ตาราง inventory 12c): `returns/components/return-request-form/index.tsx`, `group-buy/components/group-page/group-join.tsx` (select สามตัว → `NativeSelect` + label โดยชุด option เท่าเดิม — กฎ 31a; `group-selection-quantity` คงเดิม), `affiliate/components/auth-forms/index.tsx` (ไม่ต้องแก้โค้ด — ใช้ `Input` ของ 11a อยู่แล้ว; ตรวจด้วย e2e); e2e ใหม่ `sfui-12c-feature-forms.spec.ts`; แก้ `sfui-9e-font.spec.ts` + ขั้น group buy ของ `sfui-8-floating-label.spec.ts` (AC-29) | AC-29, AC-33, AC-34, AC-36 | SFUI-11b (stack) | ∥ | ~250 |
| SFUI-13 | ☑ #610 — guard (กฎ 26, 28, 37): ใหม่ `e2e/sfui-13-form-guard.unit.spec.ts` (allow-list ตามกฎ 26 เป็นค่าคงที่ใน test + static ของ AC-37 ข้อ 3) | AC-35, AC-36, AC-37 (static) | SFUI-12a, 12b, 12c | — | ~120 |
| SFUI-14 | ☑ #612 — defect owner 2026-11-28 (กฎ 38): `src/styles/globals.css` ลบ `border` และ `-webkit-box-shadow` ออกจากกฎ `:-webkit-autofill` ของ starter (คง text-fill + transition) และลบ `--animate-enter`/`--animate-leave` + `@keyframes enter`/`leave` ของ starter (กฎ 38b); e2e ใหม่ `sfui-14-autofill-border.spec.ts`, `sfui-14-menu-animation.spec.ts`; unit ใหม่ `src/styles/keyframes.test.ts` | AC-38, AC-39 | SFUI-11a | — | ~300 |

ลำดับ: SFUI-11a → SFUI-11b → (12a ∥ 12b ∥ 12c) → SFUI-13 · merge จริงตามลำดับนี้ทีละตัว (sync `origin/develop` + CI เขียวก่อนแต่ละตัว)
- **stack** (วิธีเดียวกับรอบ 44–45 — owner อนุญาต 2026-11-27, Q5): 11a แตกจาก branch เอกสาร `docs/storefront-form-fields`, 11b จาก 11a, 12a/12b/12c จาก 11b, 13 จาก branch ที่รวม 12a..12c → เปิด PR ทั้งชุดตอนท้าย (base = `develop`)
- ~~**release v0.4.0 (#603) พักจนรอบ 48 merge ครบ** (owner 2026-11-27) — ระหว่าง 11a merge ถึง 12c merge หน้าตาฟอร์มผสม จึงไม่ release กลางรอบ~~ สิ้นสุดแล้ว — merge ครบ 2026-11-27 (#605 → #610)
- ถ้า `shadcn@4.23.1 add field`/`input-group` ต้องการ dependency ใหม่ หรือ registry ต่างจากที่ ADR-032 บันทึก (`label`+`separator`, `button`+`input`+`textarea`) → หยุดแจ้ง planner

## ส่วน select + ที่อยู่ไทย (รอบ 49 — owner 2026-11-28, ก่อน release v0.4.0)
Status: done — SFUI-15..18c ☑ (#614–#622, merge 2026-11-28) · AC-40..54 ☑ (qa ปลาย stack `34d1be28` ไม่พบ defect — `docs/evidence/storefront-select/SFUI-18c/REPORT.md`;
ภาพ evidence ของ 16a–18c อยู่ใน `docs/evidence/storefront-select/<task>/` ที่ commit มากับ PR #622 (QA ปลาย stack) ไม่ได้อยู่ใน PR ของแต่ละ task; ผล test ต่อ task `SFUI-*-tests.txt`)
· accepted (owner 2026-11-28 — ADR-033 accepted: D1 = ใช้ component ของ shadcn จาก CLI + ประกอบตามตัวอย่าง docs, D2–D5/D7 = ก, D6 = ข; Q-R49-1 = ก, Q-R49-2 = ข, Q-R49-3 = stack ได้,
Q-R49-4 = ตำบลบังคับกรอก) · release v0.4.0 (#603) ~~พักจนรอบ 49 + SFUI-14 (#612) merge ครบ~~ (owner 2026-11-28) สิ้นสุดแล้ว — merge ครบ 2026-11-28 → #603 พร้อมให้ owner merge/tag
· **#612 (SFUI-14) แก้ spec 09 ด้วย** (เพิ่มกฎ 38 + 38b และ AC-38, AC-39 ในส่วนฟอร์มรอบ 48) — **เลขของรอบ 49 จึงเลื่อนหนีแล้ว: กฎ 39–57, AC-40–AC-54**;
PR ที่ merge ทีหลัง (เอกสารรอบ 49 หรือ #612) sync `origin/develop` แล้วเก็บทั้งสองฝั่งของ spec 09 (ส่วนรอบ 49 อยู่หลังส่วนที่ #612 แก้ทั้งหมด)
Goal (owner's words, 2026-11-28): (1) "ปรับพวก select เช่น ช่อง จำนวน และอื่นๆ ให้ใช้ shadcn อย่าใช้ native" — ทุก `<select>` ของ storefront รวมที่รอบ 48 ตัดออก (Q3: จำนวนบน PDP/ตะกร้า);
(2) ฟอร์มที่อยู่ทุกจุดเพิ่มช่อง **ตำบล/แขวง** ใช้ field `address_2` ของ Medusa (ไม่แก้ backend/migration) และเรียงช่องแบบที่อยู่ไทย: บ้านเลขที่/หมู่/ซอย/ถนน (`address_1`) → ตำบล/แขวง (`address_2`)
→ อำเภอ/เขต (`city`) → จังหวัด (`province`) → รหัสไปรษณีย์ (`postal_code`)
Out of scope: autocomplete ที่อยู่จากรหัสไปรษณีย์ (owner ไม่อนุมัติ) · ตัวเลือกภูมิภาค `layout/country-select` และ `checkout/address-select` (เป็น Radix อยู่แล้ว — ไม่แตะยกเว้นการแสดง `address_2` กฎ 57) ·
`<select>` ใน iframe ของ Stripe · `apps/backend/**` · `src/components/ui/*`, `globals.css` (SFUI-14 #612 เป็นเจ้าของ), `package.json`/lockfile · error ราย field จาก server (backlog เดิม)
ทางเลือก select: ADR-033 (accepted) · ที่อยู่ไทย: owner ตัดสิน field (`address_2`) และบังคับกรอกแล้ว จึงไม่มี ADR

### What Medusa already gives us
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| select ของ storefront | ไม่มี (starter ใช้ `<select>` native) — shadcn registry 4.23.1: `select` (Radix), `field`, `label` **ติดตั้งด้วย CLI แล้ว** ใน `ui/`; `native-select` (native — ไม่ใช้), `combobox` (Base UI — dependency ใหม่ ขัด ADR-030), `form` (react-hook-form + zod — ไม่ใช้ Q-R49-6) | **ใช้** `ui/select` + `ui/field` + `ui/label` ตรงที่ผู้เรียก ประกอบตามตัวอย่าง docs (ADR-033 D1) — ยืนยันตรง registry ด้วย `add --dry-run --diff` ไม่มี component กลางใหม่ |
| ส่งค่าใน `<form>` / `required` | Radix render `<select>` ซ่อนที่มี `name`/`required`/`disabled`/`autoComplete` | ใช้ตามนั้น (กฎ 42) |
| error ระดับช่องของ select | shadcn docs: ใส่ `Field data-invalid` + `SelectTrigger aria-invalid` เอง — ไม่มี validation | **custom เล็ก**: ขยาย `useFieldError` เดิม (กฎ 43) |
| ตำบล/แขวง | Address ของ Medusa (cart/order/customer) มี `address_1`, `address_2`, `city`, `province`, `postal_code` | **ใช้ `address_2` as-is** (owner) — ไม่ใช้ `metadata`, ไม่ migration |
| ส่งที่อยู่ให้ Stripe | `payment-button` ส่ง `line2 = address_2`, `state = province` อยู่แล้ว | as-is |
| อีเมลแจ้งคำสั่งซื้อ | ไม่มี template ที่ render ที่อยู่ใน `apps/backend/src/subscribers` (ตรวจ 2026-11-28) | none |
| plugin จาก medusajs.com/integrations | ไม่มี UI storefront/ที่อยู่ไทย | — |

Data model / Workflows / API routes: none · Admin UI: none (dashboard ของ Medusa แสดง `address_2` เป็น "Address 2" ตามเดิม) · Storefront pages: ไม่มีหน้าใหม่

### Inventory `<select>` (ณ `58e2436a`) — control 11 ตัว, task เจ้าของ
| Task | ไฟล์ใน `src/modules/` (หน้า) | testid | ข้อมูล / พฤติกรรม |
|---|---|---|---|
| 16d | `products/components/product-actions/index.tsx` (PDP) | `product-quantity-select` | `<select name="quantity">` ในฟอร์ม POST `/<cc>/cart/add` (no-JS — spec 01 กฎ 59); controlled `qty`; disabled เมื่อหมด/กำลังเพิ่ม; option `pdpQuantityOptions` (จำกัดสิทธิ์ flash) |
| 16c | `cart/components/cart-item-select` ← `cart/components/item` (`/cart`) | `product-select-button` | ไม่อยู่ใน `<form>`; controlled `item.quantity`; เปลี่ยน → server action `updateLineItem` ทันที; option ว่าง disabled `เลือก...` + `cartQuantityOptions` |
| 16a | `returns/components/return-request-form` (ขอคืนสินค้า) | `return-item-quantity`, `return-item-reason` (ต่อแถว) | `NativeSelect` ใน `<form action>` (`useActionState`); `name` `quantity:<line>`/`reason:<line>`; uncontrolled `defaultValue` + remount ด้วย `key`; placeholder `จำนวน`/`เลือกเหตุผล` |
| 16a | `group-buy/components/group-page/group-join.tsx` (`/g/<token>`) | `group-quantity`, `group-address-select`, `group-shipping-option` | `NativeSelect` ไม่อยู่ใน `<form>`; controlled; `placeholder={false}` สองตัวแรก, `เลือกวิธีจัดส่ง` ตัวที่สาม; disabled ขณะ `busy` |
| 16b | `account/components/profile-billing-address` (`/account/profile`) | `billing-country-code-select` | `NativeSelect` `name="country_code"` `required` uncontrolled; option `เลือก...` + `<option value="">-</option>` + ประเทศ |
| 16b | `checkout/components/country-select` ← `checkout/components/{shipping-address,billing_address}` (`/checkout?step=address`) | `shipping-country-select`, `billing-country-select` | controlled + `required` + `autoComplete="country"`; คงค่าหลัง form reset (spec 01 กฎ 110d — hack `defaultSelected`) |
| 16b | `checkout/components/country-select` ← `account/components/address-card/{add-address,edit-address-modal}` (`Dialog`) | `country-select` | uncontrolled (`defaultValue` ใน edit) + `required` |

ไม่ใช่ `<select>`: ตัวเลือกสินค้า (`option-select` = radio + label), sort/filter (`RadioGroup`), `group-selection-quantity` (`<input type="number">`) · ไม่มี select ตัวใดที่เปลี่ยนแล้ว navigate
(ตัวเลือกภูมิภาค `layout/country-select` เป็น Radix แล้ว) · e2e ใช้ `selectOption` กับ select ของเรา ~47 ครั้ง/25 ไฟล์ (+ `toHaveValue`/อ่าน `<option>` ~18 จุด) — รวม `support/stripe.ts` ~บรรทัด 116 (`shipping-country-select` ของเรา — เปลี่ยนใน 16b);
`fillCard` ในไฟล์เดียวกัน (~บรรทัด 158) เป็น select ใน iframe ของ Stripe (ไม่แตะ)

### Business rules — select (ต่อจากกฎ 38/38b ของ SFUI-14 #612; ADR-033)
39. ขอบเขต = ทุก control ในตาราง inventory; หลัง SFUI-17 ไม่มี `<select` ใน JSX ของ `src/modules/**`, `src/app/**` และไม่มี `common/components/native-select`, `cart/components/cart-item-select`
40. (ADR-033 D1 — owner: "ทุก component ที่มีอยู่แล้วใน shadcn ให้ใช้คำสั่ง add ของ shadcn … อย่าสร้างหรือประกอบเองโดยไม่จำเป็น")
    (a) component: `select`, `field`, `label` ใน `ui/` (มีแล้ว) — SFUI-15 รัน `pnpm dlx shadcn@4.23.1 add select --dry-run --diff`, `… add field …`, `… add label …` ทีละตัวต้องได้ "No changes."
        (ไม่ตรง → `add <name> --overwrite` + hash ใน `shadcn-ui.json`, ไม่รับการแก้ `package.json`/lockfile/`globals.css` — กฎ 3); **ไม่สร้าง component กลางใหม่** (ไม่มี `SelectField`/wrapper)
    (b) ผู้เรียกประกอบตรงที่ใช้ตามตัวอย่าง docs ของ shadcn: `Field` (`data-invalid` เมื่อ error) → `FieldLabel htmlFor={id}` (+ `<span aria-hidden="true">*</span>` เมื่อ `required` — กฎ 30) → `Select`
        (`name`, `required`, `disabled`, `autoComplete`, `value`/`onValueChange` หรือ `defaultValue`) → `SelectTrigger id={id} data-testid="<t>" data-value={ค่าปัจจุบัน} aria-invalid` →
        `SelectValue placeholder="…"` (children = ข้อความของ**ค่าปัจจุบัน** → HTML จาก server มีข้อความ) → `SelectContent data-testid="<t>-options"` → `SelectItem value data-testid="<t>-option" data-value={value}` →
        **Radix 2.4.1: `SelectValue` ที่มี children แสดง children ตายตัว** → ผู้เรียกทุกจุดต้องรู้ค่าปัจจุบัน: controlled ใช้ `value` ของตัวเอง; แบบที่เดิม uncontrolled
        (คืนสินค้า `quantity:`/`reason:`, `billing-country-code-select`, `country-select` ใน add/edit address) เก็บค่าปัจจุบันใน state จาก `onValueChange` (เริ่มจาก `defaultValue`;
        ยังส่ง `defaultValue` + `name` ให้ `Select` ตามเดิม) แล้วคำนวณ children และ `data-value` ของ trigger จาก state นั้น — ข้อความบน trigger ต้องตรงค่าใน `FormData` เสมอ;
        `FieldError` (กฎ 43); `id` จาก `useId()`; ไม่มี label ที่มองเห็น → ไม่มี `Field` และ `SelectTrigger aria-label` ไทย; className ที่ส่งเข้า part ของ `ui/` เป็น layout เท่านั้น (`w-full`/`w-auto`) — กฎ 28
    (c) **(ข้อ (2) และ (3) — `CountrySelect` + กัน reset ทับค่าประเทศ — แทนด้วยรอบ 50 กฎ 70: ลบพร้อมช่องประเทศใน SFUI-20b; (1) และ (4) ยังมีผล)**
        **ส่วนที่เขียนเองได้ — เท่านี้** (ADR-033 ข้อ 2): (1) error ระดับช่อง = ขยาย `useFieldError` เดิมใน `common/components/input/index.tsx` (กฎ 43); (2) กัน form reset ทับค่า controlled
        ใน `checkout/components/country-select` (กฎ 42 — ผู้ใช้เดียว ไม่แยก hook); (3) `CountrySelect` คงไว้เป็น component ของโดเมน (แปลง `region.countries` เป็น `SelectItem`, ผู้ใช้ 4 ฟอร์ม);
        (4) helper e2e (กฎ 48) — ห้ามมี helper/hook/component อื่นสำหรับ select (reviewer ตรวจ; แยกเป็น helper ได้เมื่อมีผู้ใช้จริง ≥ 2 และระบุเหตุผลใน PR)
41. **(ส่วนประเทศ — placeholder `เลือกประเทศ`, option ของ `billing-country-code-select` — แทนด้วยรอบ 50 กฎ 70 เมื่อ SFUI-20b merge)** (D2) ค่า `""` = ยังไม่เลือก แสดง placeholder (trigger มี `data-placeholder`); item = option เดิมที่ value ไม่ว่าง ลำดับ/ข้อความ/disabled เดิม; placeholder เดิมคงข้อความ
    (`เลือก...`, `เลือกประเทศ`, `จำนวน`, `เลือกเหตุผล`, `เลือกวิธีจัดส่ง`); `<option value="">-</option>` ของ `billing-country-code-select` ตัดออก; `placeholder={false}` เลิกใช้ (ช่องที่ไม่เคยมี option ว่างมีค่าเสมอ)
42. **(ท่อน "controlled คงค่าปัจจุบันเมื่อฟอร์ม reset … กันใน `CountrySelect`" แทนด้วยรอบ 50 กฎ 70 — ไม่มี select ประเทศแล้ว (SFUI-20b); ส่วนอื่นยังมีผล)** (D4) ใน `<form>`: `FormData` ชื่อ/ค่าเดิม (กฎ 13/33a) ผ่าน select ซ่อนของ Radix (`name`, `required`, `disabled`, `autoComplete`); uncontrolled ใช้ `defaultValue`;
    **controlled คงค่าปัจจุบันเมื่อฟอร์ม reset** (React 19 reset หลัง action — spec 01 กฎ 110d): `onValueChange` ของผู้เรียกไม่ถูกเรียกจาก reset — กันใน `CountrySelect` (controlled ในฟอร์มมีเฉพาะ
    ประเทศของ checkout); เลิก hack `defaultSelected`; `onValueChange(value: string)` แทน `onChange` แบบ event (ผู้เรียกปรับเอง)
43. (D3 — แทนกฎ 32 ส่วน `<select>`) `useFieldError` (export เดิม) ขยายให้รับ select: `invalid` ของ select ซ่อน (listener แบบ capture บน element ของ `Field`) → `preventDefault()`,
    `<t>-error` (`FieldError`) = `fieldErrorMessage(validity, { label, control: "select" })` (`กรุณาเลือก<label>`), `Field data-invalid` + `SelectTrigger aria-invalid="true"` (ตาม docs) + `aria-describedby` อ้าง id ของ error,
    focus trigger ของช่องแรกที่ผิดตามลำดับ DOM (กฎ 32c); ค่าเปลี่ยนจน valid → error/`aria-invalid` หาย; prop/ค่า `error` ของผู้เรียกแสดงแบบเดียวกัน; ไม่เขียน logic ข้อความซ้ำ
    (ใช้กับ select ที่ `required` ทุกตัว: ประเทศ 4 ฟอร์ม + `billing-country-code-select` — **รายการนี้แทนด้วยรอบ 50 กฎ 70** (select ประเทศถูกลบใน SFUI-20b); `useFieldError` สำหรับ select ยังมีผลกับ select `required` ที่เหลือ/ที่เพิ่มในอนาคต)
44. (ยังมีผลกับ select ที่เหลือ — ตัวอย่างช่องประเทศไม่มีแล้วหลังรอบ 50 กฎ 70) a11y: trigger `role="combobox"` ชื่อที่เข้าถึงได้ = ข้อความ label (ไม่มี `*`) หรือ `aria-label`; `aria-required="true"` เมื่อ `required`; คีย์บอร์ดตามกฎ 12; disabled → trigger `disabled`
45. หน้าตา (ADR-033 ข้อ 3): trigger/กล่องรายการ = default ของ shadcn (`h-9` = 36px, `SelectContent` `item-aligned`) — **ยกเว้นกฎ 19/27** เฉพาะ trigger/กล่องรายการ/label ของ control ในตาราง inventory;
    ช่องในแถวเดียวกันสูงเท่ากัน (กฎ 35); PDP: label `จำนวน` เหนือ trigger (`Field` vertical เหมือน `group-quantity`); ตะกร้า: ไม่มี label ที่มองเห็น — `aria-label="จำนวน"`; การ์ดตะกร้า 375px ไม่ล้น (core-47)
46. มือถือ (Q-R49-1 = ก, owner 2026-11-28): popover ของ Radix ทุกอุปกรณ์; แตะ trigger แล้ว `<t>-options` อยู่ในจอทั้งกล่อง เลือกได้ และหน้าไม่ล้นแนวนอน (AC-17)
47. no-JS (Q-R49-2 = ข, owner 2026-11-28): `Select` ของ PDP **ไม่มี `name`** (โหมด JS ส่งจำนวนผ่าน `addToCart` ไม่ใช้ `FormData`) → ฟอร์ม no-JS ไม่ส่ง `quantity` → route `/<cc>/cart/add`
    ได้จำนวน 1 จาก `clampLineItemQuantity` (มีอยู่แล้ว — ไม่แก้ route); ปิด JS แล้ว trigger แสดง `1` แต่เปิดไม่ได้; ไม่มี native fallback; ช่องอื่นไม่รองรับการปิด JS (กฎ 32f ไม่ใช้กับ select)
    (a) **ประกาศการแทนถ้อยคำ (ไม่แก้ไฟล์ spec 01 — แบบเดียวกับกฎ 27c; มีผลตั้งแต่ SFUI-16d merge)**:
        - spec 01 **กฎข้อ 59** — "ทั้งโหมด JS และฟอร์ม no-JS" → "โหมด JS; ฟอร์ม no-JS ส่งจำนวน 1 เสมอ (ไม่มีตัวเลือกเมื่อปิด JS)" (การส่งจำนวนข้าม login ตาม CORE-14b ยังมีผล)
        - spec 01 **AC-44** — "บน PDP ที่เลือก quantity 3 … Then cart มี line ของ variant นั้น `quantity=3`" → "กด Add to cart บน PDP (ไม่เลือกจำนวน) … URL มี `add_variant=` และ**ไม่มี** `add_quantity` (`loginPathForAddToCart` ใส่เฉพาะ quantity > 1),
          HTML ไม่มี `name="add_quantity"` … login แล้ว cart มี `quantity=1`"
        - spec 01 **AC-94** — ท่อน no-JS "เลือก 2 แล้ว submit และ login Then cart มี qty 2" → "submit (ไม่เลือกจำนวน) และ login Then cart มี qty 1"; ท่อน JS (เลือก 3 → qty 3) ยังมีผล
48. e2e (D7): helper `e2e/support/select.ts` — `chooseOption(trigger, value)` (อ่าน testid ของ trigger, คลิกซ้ำจน `aria-expanded="true"` แล้วคลิก `<t>-option[data-value=…]` ใน `<t>-options`,
    รอ `data-value` ของ trigger เปลี่ยน — option `{ waitValue: false }` ไม่รอ: ใช้กรณี server ปฏิเสธค่า (controlled ที่ค่าคงเดิม เช่น จำนวนในตะกร้าเมื่อ stock ไม่พอ/ต้อง login ใหม่ — SFUI-16c) ผู้เรียก assert ผลเอง),
    `expectSelected(trigger, value)` (`data-value`), `selectOptions(trigger)` → `{ placeholder, options: [value, ข้อความ, disabled][] }` (เปิด-อ่าน-`Escape`);
    หาด้วย testid เท่านั้น (ไม่ใช้ `getByRole`/`getByText`/`selectOption`); loop "เลือกซ้ำจน hydrate" เดิมถูกแทนด้วย helper
49. แก้ e2e เดิมได้เฉพาะบรรทัดที่โต้ตอบ/อ่าน select: `selectOption` → `chooseOption`, `toHaveValue` บน testid ของ select → `expectSelected`, ตัวอ่าน `<option>`/`locator("option")` → `selectOptions`,
    `xpath=..` ของ select ในตะกร้า (core-19c) → trigger; ค่าที่คาดของ AC-34 เปลี่ยนตามกฎ 41; assertion ผลทางธุรกิจคงเดิม — ยกเว้น no-JS ของ core-14b (spec 01 AC-44) และ core-24 (spec 01 AC-94)
    ที่เปลี่ยนตามกฎ 47a (ลบ `selectOption`, คาดจำนวน 1); `support/stripe.ts` `fillCard` (iframe ของ Stripe) คง `selectOption`
50. testid เดิมคงที่ (อยู่บน trigger); testid ใหม่ `<t>-options`, `<t>-option` (+ `<t>-label`/`<t>-error` กฎ 29) ไม่ชน baseline; ข้อความไทยของ baseline คงอยู่ (กฎ 10); `aria-label` ใหม่เป็นไทย
51. ไม่แก้ `src/components/ui/*` ด้วยมือ (ถ้า `--dry-run --diff` ไม่ตรง ใช้ `add --overwrite` เท่านั้น — กฎ 40a), `globals.css`, `package.json`/lockfile, `apps/backend/**`; ไม่ add `native-select`/`combobox`/`form`

### Business rules — ที่อยู่ไทย (owner 2026-11-28)
52. ตำบล/แขวง = `address_2` ของ Medusa ทุกที่ (cart shipping/billing, ที่อยู่ของลูกค้า, ที่อยู่ใบเสร็จในโปรไฟล์ = ที่อยู่ของลูกค้า); ช่องใหม่ใน checkout: `name` `shipping_address.address_2` testid `shipping-address-2-input`,
    `billing_address.address_2` testid `billing-address-2-input` (testid เดียวกับช่องของ `profile-billing-address` — คนละหน้า); ช่องบัญชีเดิม (`address-2-input`, `billing-address-2-input`) เปลี่ยน label เป็นตำบล
53. **(ช่อง "ประเทศ" ในลำดับ DOM แทนด้วยรอบ 50 กฎ 70 — เป็น hidden `th` ไม่ render (SFUI-20b); จังหวัดบังคับตามกฎ 69)** label/ลำดับ DOM ในทั้ง 5 ฟอร์ม (checkout `shipping-address`, `billing_address`, บัญชี `add-address`, `edit-address-modal`, `profile-billing-address`):
    ชื่อ → นามสกุล → บริษัท → **`บ้านเลขที่ หมู่ ซอย ถนน`** (`address_1`, placeholder `เช่น 99/1 หมู่ 2 ซ.สุขุมวิท 3 ถ.สุขุมวิท`, `autoComplete="address-line1"`) →
    **`ตำบล/แขวง`** (`address_2`, `autoComplete="address-level3"`) → `เขต/อำเภอ` (`city` — ข้อความเดิม) → `จังหวัด` → `รหัสไปรษณีย์` → ประเทศ → (อีเมล/เบอร์โทรศัพท์ตามฟอร์มเดิม);
    label เดิม `ที่อยู่` (ช่อง `address_1`) และ `อาคาร ห้อง ฯลฯ` เลิกใช้ — `e2e/support/sfui-baseline.json` แก้ได้**เฉพาะ** 3 ข้อความ: `ที่อยู่` (ลบเมื่อ AC-5 ไม่พบแล้ว), `อาคาร ห้อง ฯลฯ` (ลบ),
    `MISSING_ADDRESS_MESSAGE` (ค่าใหม่ตามกฎ 55) + เพิ่ม testid `shipping-address-2-input` (รายการเดียวกับ AC-54)
54. **(แถว "ประเทศ" แทนด้วยรอบ 50 กฎ 70 — ไม่มีช่องแล้ว; gap ระหว่างช่องเป็น `gap-4` ตามกฎ 73)** การจัดวาง (แทนแถวที่อยู่ของตารางกฎ 37b): ≥ 768px คู่ **ชื่อ–นามสกุล, ตำบล/แขวง–เขต/อำเภอ, จังหวัด–รหัสไปรษณีย์** (`md:grid-cols-2`; เลิก `md:grid-cols-[144px_1fr]`)
    + checkout `shipping-address` อีเมล–เบอร์โทรศัพท์ (เดิม); บริษัท, บ้านเลขที่…, ประเทศ, เบอร์โทรศัพท์ (billing/บัญชี) แถวละช่อง; < 768px แถวละช่อง (กฎ 37a) — คู่ ที่อยู่–บริษัท, ประเทศ–จังหวัด,
    รหัสไปรษณีย์–เขต/อำเภอ, จังหวัด–ประเทศ ของรอบ 48 ยกเลิก
55. **(`REQUIRED_ADDRESS_FIELDS` และ `MISSING_ADDRESS_MESSAGE` แทนด้วยรอบ 50 กฎ 69 — เพิ่ม `province` + ข้อความใหม่ เมื่อ SFUI-20a merge; ส่วน "ข้อมูลเดิมยังใช้ได้" ยังมีผล)** บังคับกรอก (Q-R49-4 — owner 2026-11-28: บังคับ): ช่องตำบล `required` ทั้ง 5 ฟอร์ม และ `REQUIRED_ADDRESS_FIELDS` เพิ่ม `address_2` (ช่องว่างล้วนถือว่าไม่กรอก — spec 01 กฎ 110b);
    `MISSING_ADDRESS_MESSAGE` = `กรุณากรอกชื่อ นามสกุล ที่อยู่ ตำบล/แขวง เขต/อำเภอ และรหัสไปรษณีย์ให้ครบ (ช่องที่มีแต่ช่องว่างถือว่ายังไม่ได้กรอก)`;
    **ข้อมูลเดิมที่ไม่มี `address_2` ยังใช้ได้**: order/ที่อยู่เดิมแสดงผลได้ (กฎ 57), group join ด้วยที่อยู่ที่บันทึกไว้ไม่ตรวจเพิ่ม, เลือกที่อยู่เดิมใน checkout → ช่องตำบลว่างแสดง error ระดับช่อง (กฎ 32) จนกรอก
56. การไหลของข้อมูล: `lib/data/cart.ts` `addressFrom` อ่าน `<prefix>.address_2` (ตัดช่องว่าง/zero-width เหมือนช่องอื่น) แทน `""`; `lib/util/compare-addresses.ts` และ
    `checkout/components/shipping-address` (`SAVED_ADDRESS_FIELDS`, state เริ่มต้น, `setFormAddress`) + `billing_address` (state) มี `address_2`; `lib/data/customer.ts`, `lib/data/group-join.ts`,
    backend `join-group.ts` และ `payment-button` (`line2`) มี `address_2` อยู่แล้ว — ไม่แก้
57. **(บรรทัด `"<COUNTRY>"` และ "บรรทัดประเทศของ `profile-billing-address`" แทนด้วยรอบ 50 กฎ 71 — ไม่แสดงประเทศ เมื่อ SFUI-20c merge; ลำดับบรรทัดที่อยู่ยังมีผล)** แสดงผลตามลำดับไทย: helper pure `src/lib/util/address-lines.ts` (ผู้ใช้ ≥ 2) คืน `[ "<address_1> <address_2> <city> <province> <postal_code>" (ข้ามช่องว่าง), "<COUNTRY>" ]`
    ใช้ที่ `checkout/components/addresses` (สรุปจัดส่ง/ใบเสร็จ 3 กล่อง), `checkout/components/shipping` (ข้อความที่อยู่), `order/components/shipping-details`, `checkout/components/address-select` (รายการ),
    การ์ด `edit-address-modal`, สรุป `profile-billing-address`, `group-join` (`addressLabel` = ชื่อ + บรรทัดแรก); ไม่มีจุลภาค/ช่องว่างซ้อนเมื่อช่องใดว่าง
    · บรรทัดประเทศของสรุปที่อยู่ใบเสร็จใน `profile-billing-address` คงแสดงชื่อเต็มของประเทศได้ (พฤติกรรมเดิม — reviewer SFUI-18a รับ; จุดอื่นแสดงรหัสประเทศตัวใหญ่)

### Acceptance criteria (ต่อจาก AC-39 ของ SFUI-14 #612)
- AC-40 (SFUI-15, กฎ 40b, 42, 44) ☑ #614 unit `src/modules/common/components/input/select-field-error.test.tsx` (render `Field` + `Select*` ของ `ui/` จริงตามโครงกฎ 40b ในไฟล์ test — ไม่มี component กลาง;
  polyfill jsdom; ไม่ mock primitive): `<t>-label` อยู่ก่อน trigger, trigger `role="combobox"` ชื่อ `ประเทศ`, `aria-required="true"`, `*` อยู่ใน `aria-hidden`; `renderToString` มีข้อความของค่าที่เลือก (children ของ `SelectValue`);
  ใน `<form>` เลือก item (คีย์บอร์ด) → `new FormData(form).get(name)` = ค่า และ trigger `data-value` = ค่า; `defaultValue` เข้า `FormData`;
  แบบ `defaultValue` + state จาก `onValueChange` (กฎ 40b): เลือก item อื่น → ข้อความของ trigger เปลี่ยนเป็นข้อความของ item นั้น และตรงกับค่าใน `FormData` (เทียบ item ที่มี `data-value` = ค่าใน `FormData`)
- AC-41 (SFUI-15, กฎ 43) ☑ #614 unit (ไฟล์เดียวกัน) — `useFieldError` กับ select: ช่อง `required` ว่างใน `<form>` → `form.requestSubmit()` ไม่ส่ง, event `invalid` `defaultPrevented`, `<t>-error` = `fieldErrorMessage` ของ select
  (`กรุณาเลือกประเทศ`), `Field` มี `data-invalid`, trigger `aria-invalid="true"` + `aria-describedby` มี id ของ `<t>-error`, `document.activeElement` = trigger; เลือกค่าแล้ว error หาย; สองช่องผิด → focus ช่องแรก;
  test เดิมของ `Input` ใน `input.test.tsx` ผ่านไม่แก้
- AC-42 (SFUI-15, กฎ 40a, 48, 51) ☑ #614 static `e2e/sfui-15-select.unit.spec.ts` + บันทึกใน PR: `--dry-run --diff` ของ `select`, `field`, `label` ได้ "No changes." (แนบผลใน PR); AC-19 ผ่าน;
  ไม่มีไฟล์ใหม่ใน `src/components/**` และ `src/modules/common/components/**` นอกจาก test (ไม่มี component กลางของ select); `e2e/support/select.ts` ไม่มี `getByRole`/`getByText`/`selectOption`
- AC-43 (SFUI-16a) ☑ #615 e2e: `core-20-return-request`, `core-20c/20d-return-window`, `core-55-return-receive`, `core-71-return-contact-store`, `group-buy-join`, `group-buy-ui-polish`, `core-32-shipping-profile-filter`,
  `sfui-12c-feature-forms`, `sfui-8-floating-label`, `sfui-9e-font` ผ่านโดยแก้ตามกฎ 49 เท่านั้น; ใหม่ `e2e/sfui-16-select.spec.ts` (ส่วน 16a): `return-item-quantity` เปิดด้วย `Enter`, `ArrowDown` + `Enter` เปลี่ยนค่า, `Escape` ไม่เปลี่ยน;
  เลือก `return-item-reason` แล้วข้อความบน trigger = ข้อความของ item ที่เลือก (กฎ 40b);
  trigger สูง 36px; `selectOptions` ของ `group-shipping-option` มี placeholder `เลือกวิธีจัดส่ง` และไม่มี item value ว่าง
- AC-44 (SFUI-16b) ☑ #616 (**ส่วนประเทศแทนด้วยรอบ 50 — AC-63; SFUI-20b ลบขั้นที่เลือก/ตรวจประเทศ**) e2e: checkout/บัญชีผ่านโดยแก้ตามกฎ 49 (`core-store`, `core-38`, `core-52`, `core-63`, `core-23c`, `ev-7c`, `ev-7d`, `thai-ui-checkout`, `affiliate-last-click`, `support/stripe.ts` (~บรรทัด 116 `shipping-country-select` — ไม่ใช่ `fillCard`),
  `sfui-11-form-field`, `sfui-11b-field-errors`, `sfui-12a/12b`, `core-4e/4g/4j`, `sfui-9a`) — โดยเฉพาะ: core-52 ค่าประเทศคงหลัง error ของ server (`expectSelected`), sfui-11b `shipping-country-select-error` = `กรุณาเลือกประเทศ`
  และ focus อยู่ที่ trigger, `billing-country-code-select` ไม่มี item `-` (กฎ 41); unit `core-52-address-form-state.test.ts` (controlled + `form.reset()` → ค่าไม่เปลี่ยน, `onValueChange` ไม่ถูกเรียก)
  และ `checkout-thai-polish.test.ts` (placeholder `เลือกประเทศ`) ปรับตาม `CountrySelect` ใหม่
- AC-45 (SFUI-16c) ☑ #617 e2e: `core-44`, `core-47`, `core-48`, `pay-18`, `core-14g`, `core-19c`, `core-42`, `flash-sale-fs15` (ตะกร้า), `fs-21` (ตะกร้า) ผ่านโดยแก้ตามกฎ 49; ใหม่ (ใน `sfui-16-select.spec.ts`):
  เลือก 2 ใน `product-select-button` → server action `updateLineItem` ถูกส่ง **1 ครั้ง** และ cart ใน backend จำนวน 2; trigger ชื่อที่เข้าถึงได้ `จำนวน`
- AC-46 (SFUI-16d, กฎ 47) ☑ #618 e2e: `core-24` (JS), `core-14b` (JS), `flash-sale-fs15` (PDP), `fs-21`, `fs-23`, `sfui-8-floating-label` (ป้าย PDP) ผ่านโดยแก้ตามกฎ 49;
  **no-JS (กฎ 47a)**: `core-14b` (spec 01 AC-44) — ไม่เลือกจำนวน กด `add-product-button` → URL มี `add_variant=` และไม่มี `add_quantity`
  (`lib/util/pending-add-to-cart.ts` `loginPathForAddToCart` ใส่เฉพาะ quantity > 1 — route/util ไม่แก้), HTML ของหน้า login ไม่มี `name="add_quantity"`, login แล้ว cart มี `quantity=1`;
  `core-24` (spec 01 AC-94) no-JS — เกณฑ์ URL/HTML เดียวกัน, submit แล้ว login → cart qty 1;
  ใหม่ (ใน `sfui-16-select.spec.ts`): ปิด JS → ไม่มี `select[name="quantity"]` ในหน้า และ `product-quantity-select` แสดง `1`; เปิด JS → `product-quantity-select` เป็น `button[role="combobox"]`, เลือก 3 แล้วเพิ่ม → cart qty 3
- AC-47 (SFUI-17, กฎ 39, 40c) ☑ #619 static (ขยาย `sfui-13-form-guard.unit.spec.ts`): ไม่มี `<select` ใน JSX ของ `src/modules/**`/`src/app/**`; ไม่มีไดเรกทอรี/การ import `common/components/native-select`, `cart/components/cart-item-select`;
  `ALLOW_LIST` ไม่มีรายการ `select`; ทุก `<SelectTrigger` ในไฟล์ของตาราง inventory มี `id` ที่ตรงกับ `htmlFor` ของ `FieldLabel` ในไฟล์เดียวกัน (ข้อความ expression เดียวกัน) หรือมี `aria-label`
  (แทนข้อตรวจ label ของ `NativeSelect` ใน `FIELD_COMPONENTS`); `selectOption(` ใน `e2e/**` มีเฉพาะใน `fillCard` ของ `support/stripe.ts` (select ใน iframe ของ Stripe)
- AC-48 (ทุก task select) ☑ #614–#622 reviewer: `git diff origin/develop --stat -- apps/backend apps/storefront/package.json pnpm-lock.yaml apps/storefront/src/styles/globals.css apps/storefront/src/components/ui` ว่าง;
  diff ของ e2e เดิมเปลี่ยนเฉพาะบรรทัดตามกฎ 49; AC-5, AC-17, AC-19 ผ่าน; e2e storefront ทั้งชุดผ่านใน CI
- AC-49 (SFUI-16b, 16c, กฎ 46) ☑ #616, #617 e2e ใน `sfui-16-select.spec.ts`: viewport 390×844 — แตะ `shipping-country-select` (**แทนด้วยรอบ 50: ใช้ select อื่นในฟอร์ม checkout ไม่ได้แล้ว → SFUI-20b ย้ายขั้นนี้ไปที่ `shipping-address-select` เมื่อมีที่อยู่ที่บันทึกไว้**) และ `product-select-button` → `<t>-options` มองเห็นและ boundingBox อยู่ในจอทั้งกล่อง, เลือก item ได้, `scrollWidth <= innerWidth`
- AC-50 (SFUI-18a, กฎ 56–57) ☑ #620 unit: `src/lib/util/address-lines.test.ts` ลำดับครบ/ข้ามช่องว่าง (ไม่มี `,` หรือช่องว่างซ้อน); `compare-addresses` ต่างกันแค่ `address_2` → `false`;
  `addressFrom` (ใน `core-63-address-invisible.test.ts`) ส่ง `address_2` ที่ตัดช่องว่าง/zero-width แล้ว (เดิมคาด `""`)
- AC-51 (SFUI-18a) ☑ #620 e2e ใหม่ `e2e/sfui-18-thai-address.spec.ts`: ที่อยู่ที่บันทึกไว้มี `address_2` (สร้างผ่าน API) → checkout เลือกจาก `shipping-address-select` แล้วส่ง → `cart.shipping_address.address_2` = ค่านั้น (API);
  `shipping-address-summary` ของ checkout และหน้าคำสั่งซื้อมี `address_1`, `address_2`, `city`, `province`, `postal_code` ตามลำดับ (`indexOf` เพิ่มขึ้น); ที่อยู่เดิมไม่มี `address_2` แสดงได้ไม่มี `,` ซ้อน;
  group join ด้วยที่อยู่ที่มี `address_2` → cart ของกลุ่มมี `address_2`
- AC-52 (SFUI-18b, กฎ 52–54) ☑ #621 e2e (ใน `sfui-18-thai-address.spec.ts`): ทั้ง 5 ฟอร์ม — label ของ `address_1` และตำบลตามกฎ 53 (`expectThai`), ลำดับ DOM ของ testid ตามกฎ 53 (`compareDocumentPosition`),
  กรอกตำบลแล้วบันทึก → ค่าใน API (cart, `/store/customers/me/addresses`, ที่อยู่ใบเสร็จของโปรไฟล์) = ค่าที่กรอก; จัดวาง 375/767 แถวละช่อง, 768/1280 คู่ตามกฎ 54 (เกณฑ์ AC-37) — แก้ `sfui-12a/12b` ส่วน AC-37 ให้ตรงตารางใหม่
- AC-53 (SFUI-18c, กฎ 55) ☑ #622 (**ข้อความ `MISSING_ADDRESS_MESSAGE` แทนด้วยรอบ 50 — กฎ 69, AC-62**) unit `address-required` + `error-message.test.ts`: `address_2` ว่าง/ช่องว่างล้วน → missing, ข้อความใหม่; e2e: ส่งโดยตำบลว่าง → `shipping-address-2-input-error` = `fieldErrorMessage` จาก label จริง;
  ตำบลเป็นช่องว่างล้วน → `address-error-message` = `MISSING_ADDRESS_MESSAGE`; e2e เดิมที่กรอกฟอร์มที่อยู่เพิ่มบรรทัดกรอกตำบล (เพิ่มเท่านั้น — ข้อยกเว้นดู AC-54)
- AC-54 (SFUI-18a/18b/18c) ☑ #620–#622 reviewer: `apps/backend/**` ไม่ถูกแก้; `sfui-baseline.json` เปลี่ยนเฉพาะรายการของกฎ 53: ข้อความ `ที่อยู่`, `อาคาร ห้อง ฯลฯ`, `MISSING_ADDRESS_MESSAGE`
  และ testid ใหม่ `shipping-address-2-input`; diff ของ e2e ใน 18c เป็นบรรทัดเพิ่ม (กรอกตำบล) เท่านั้น ยกเว้น flag บังคับของช่องตำบลในตาราง AC-37 (18c แก้ 4 บรรทัดให้ตรงกฎ 55 — reviewer รับ)

### Test plan
| ชนิด | AC |
|---|---|
| static (`test:e2e:unit`) | AC-42, AC-47 (+ AC-5, AC-19, AC-35 เดิม) |
| unit (Vitest + jsdom) | AC-40, AC-41, AC-50, AC-53 (unit) |
| e2e (Playwright) | AC-43–AC-46, AC-49, AC-51–AC-53 + ชุดเดิม (กฎ 49) |
| reviewer | AC-48, AC-54 |
qa: หน้าตา select/popover และช่องที่อยู่ที่เปลี่ยนเป็น default ของ shadcn — ไม่ใช่ defect (กฎ 45); evidence `docs/evidence/storefront-select/<task>/` ≤ 5 รูป (15 ไม่มี UI ไม่ต้อง qa) ·
builder รัน e2e **ทุก** spec ที่อ้างหน้าที่แตะ (grep path/testid) ก่อน push

### Tasks (รอบ 49)
เจ้าของไฟล์ร่วม (แก้ตามลำดับ stack): `e2e/sfui-13-form-guard.unit.spec.ts` (16a → 16b → 16c → 16d → 17 — 16a/16b แก้เฉพาะตัวนับใน guard; ปรับตามความจริงตอนปิดรอบ), `flash-sale-fs15`/`fs-21` (16c → 16d), `sfui-8-floating-label` (16a → 16d),
ฟอร์มที่อยู่ + `sfui-12a/12b`/`core-52` + `sfui-baseline.json` + `sfui-18-thai-address.spec.ts` (16b → 18a → 18b → 18c), `group-join.tsx` (16a → 18a), `input/index.tsx` (15 เท่านั้น) · ไม่แตะ `globals.css` (SFUI-14 #612) · ผู้เรียกทุกจุดประกอบ `Field` + `Select*` ตามกฎ 40b (ไม่มี component กลาง)

| Task | งาน — ไฟล์ที่เป็นเจ้าของ | AC | Depends | ∥ | LOC |
|---|---|---|---|---|---|
| SFUI-15 | ☑ #614 — ฐาน: ยืนยัน `select`/`field`/`label` ตรง registry (`add --dry-run --diff`, กฎ 40a), ขยาย `useFieldError` ใน `common/components/input/index.tsx` ให้รับ select (กฎ 43), unit ใหม่ `common/components/input/select-field-error.test.tsx`, ใหม่ `e2e/support/select.ts`, ใหม่ `e2e/sfui-15-select.unit.spec.ts` | AC-40–AC-42, AC-48 | PR เอกสารรอบ 49 (stack) | — | ~300 |
| SFUI-16a | ☑ #615 — คืนสินค้า + group buy → `Field` + `Select*` (กฎ 40b): `returns/components/return-request-form`, `group-buy/components/group-page/group-join.tsx` (3 ตัว); e2e ตาม AC-43 + ใหม่ `sfui-16-select.spec.ts` (ส่วน 16a) | AC-43, AC-48 | SFUI-15 | ∥ 16b, 16c | ~280 |
| SFUI-16b | ☑ #616 — ประเทศ: `checkout/components/country-select` (`Field` + `Select*` + กัน reset ทับค่า, ลบ hack `defaultSelected`), ผู้เรียก `checkout/components/{shipping-address,billing_address}` (`onValueChange`), `account/components/{address-card/add-address,address-card/edit-address-modal}`, `account/components/profile-billing-address` (ประกอบเอง — ไม่ใช่ `CountrySelect`); unit 2 ไฟล์ + e2e ตาม AC-44, AC-49 (checkout) | AC-44, AC-48, AC-49 | SFUI-15 | ∥ 16a, 16c | ~420 — เกินเพดานเพราะ e2e ~20 ไฟล์แก้บรรทัดแบบกลไก (~120 LOC ผ่าน helper); แยกไม่ได้เพราะ `CountrySelect` ใช้ร่วม 4 ฟอร์ม — แยกแล้ว PR แรกแดง; เกิน ~500 หยุดแจ้ง planner |
| SFUI-16c | ☑ #617 — จำนวนในตะกร้า: ลบ `cart/components/cart-item-select/` แล้วประกอบ `Select*` (ไม่มี `Field`, `aria-label="จำนวน"`) ใน `cart/components/item/index.tsx`; ลบรายการ allow-list ของไฟล์นี้; e2e ตาม AC-45, AC-49 (ตะกร้า) | AC-45, AC-48, AC-49 | SFUI-15 | ∥ 16a, 16b | ~250 |
| SFUI-16d | ☑ #618 — จำนวนบน PDP: `products/components/product-actions/index.tsx` (`Field` + `Select*` ไม่มี `name`, label `จำนวน` — กฎ 47); ลบรายการ allow-list; e2e ตาม AC-46 รวม no-JS ของ `core-14b`/`core-24` (กฎ 47a) | AC-46, AC-48 | SFUI-16a, SFUI-16c | — | ~200 |
| SFUI-17 | ☑ #619 — ปิดงาน select: ลบ `common/components/native-select/`, ส่วน `NativeSelect` ใน `input/input.test.tsx`; guard `sfui-13-form-guard` ข้อ AC-47 (แทน `FIELD_COMPONENTS` ของ `NativeSelect` ด้วยข้อตรวจ `SelectTrigger`) | AC-47, AC-48 | SFUI-16d, SFUI-16b | ∥ 18a, 18b, 18c | ~170 |
| SFUI-18a | ☑ #620 — ที่อยู่ไทย — ข้อมูล + การแสดงผล (กฎ 56–57): `lib/data/cart.ts` (`addressFrom`), `lib/util/compare-addresses.ts`, ใหม่ `lib/util/address-lines.{ts,test.ts}`, state ของ `checkout/components/{shipping-address,billing_address}`, จุดแสดงผล 7 ไฟล์ในกฎ 57; unit `core-63-address-invisible.test.ts`; e2e ใหม่ `sfui-18-thai-address.spec.ts` (AC-51) + e2e ที่ assert รูปแบบสรุปที่อยู่เดิม (grep `address-summary`) | AC-50, AC-51, AC-54 | SFUI-16a, SFUI-16b | ∥ 16c, 16d, 17 | ~300 |
| SFUI-18b | ☑ #621 — ที่อยู่ไทย — ฟอร์ม **ยังไม่บังคับ** (กฎ 52–54): ช่องตำบล (ไม่มี `required`) + ลำดับ + label/placeholder + จัดวาง ใน 5 ฟอร์ม, `sfui-baseline.json` (`ที่อยู่`, `อาคาร ห้อง ฯลฯ`, testid ใหม่ — AC-54), แก้ AC-37 ใน `sfui-12a/12b`, ส่วน AC-52 ของ `sfui-18-thai-address.spec.ts` | AC-52, AC-54 | SFUI-18a | — | ~300 |
| SFUI-18c | ☑ #622 — ที่อยู่ไทย — บังคับกรอก (กฎ 55): `required` ของช่องตำบลใน 5 ฟอร์ม, `lib/util/address-required.ts` (+ test, `error-message.test.ts`, `core-63-address-invisible.test.ts` ส่วนข้อความ), `sfui-baseline.json` (`MISSING_ADDRESS_MESSAGE`), **เพิ่มบรรทัดกรอกตำบล** ใน e2e/`support/stripe.ts` และ fixture ที่อยู่ที่บันทึกไว้ (ผ่าน API) ที่ไฟล์ e2e ใช้ (~15 ไฟล์ — เพิ่มอย่างเดียว), ส่วน AC-53 ของ `sfui-18-thai-address.spec.ts` | AC-53, AC-54 | SFUI-18b | — | ~250 |

ลำดับ: SFUI-15 → (16a ∥ 16b ∥ 16c) → 16d (หลัง 16a + 16c) → 17 (หลัง 16d + 16b) · 18a (หลัง 16a + 16b) → 18b → 18c · merge จริงทีละตัว: 15 → 16a → 16b → 16c → 16d → 17 → 18a → 18b → 18c
(18b ยังไม่บังคับกรอก → e2e เดิมที่กรอกที่อยู่ผ่านโดยไม่ต้องเพิ่มบรรทัด; 18c เพิ่ม `required` พร้อมบรรทัดกรอกตำบลใน PR เดียว — แต่ละ PR เขียวได้เอง)
(sync `origin/develop` + CI เขียวก่อนแต่ละตัว) · **stack** แบบรอบ 44–48 (Q-R49-3 = ได้, owner 2026-11-28): 15 แตกจาก branch เอกสาร `docs/storefront-shadcn-select`, task ที่มี Depends สองตัวแตกจาก branch ที่รวมทั้งสองแล้ว →
เปิด PR ทั้งชุดตอนท้าย (base = `develop`) · ~~release v0.4.0 (#603) พักจน 18c และ SFUI-14 (#612) merge~~ สิ้นสุดแล้ว (merge ครบ 2026-11-28)

### Open questions (รอบ 49)
- ~~Q-R49-1~~ = ก (owner 2026-11-28): popover ของ Radix ทุกอุปกรณ์
- ~~Q-R49-2~~ = **ข** (owner 2026-11-28): ปิด JS แล้วจำนวนบน PDP = 1 เสมอ — แทนถ้อยคำ spec 01 กฎ 59, AC-44, AC-94 (กฎ 47a)
- ~~Q-R49-3~~ = stack ได้ (owner 2026-11-28)
- ~~Q-R49-4~~ = บังคับกรอก (owner 2026-11-28 — ตามข้อเสนอ; กฎ 55) · ข้อสังเกต: ที่อยู่ในบัญชีที่ลูกค้าเคยกรอก "อาคาร ห้อง ฯลฯ" ไว้ใน `address_2` จะแสดงในช่องตำบล (ลูกค้าแก้เอง — ไม่ย้ายข้อมูล)
- ~~ADR-033 D1–D7~~ = accepted (owner 2026-11-28): D1 = ใช้ component ของ shadcn จาก CLI + ประกอบตามตัวอย่าง docs (ไม่มี `SelectField`), D2–D5/D7 = ก, D6 = ข
- **Q-R49-5 (ทบทวนรอบ 48 — ไม่แก้ในรอบนี้)**: component ร่วมของรอบ 48 ที่ "ประกอบเอง" ทั้งที่ shadcn มีตัวอย่าง/ชิ้นส่วนให้ — ควรย้ายไปประกอบตามตัวอย่าง docs ตรงที่ผู้เรียกไหม?
  ข้อสังเกตของ planner (ตรวจ registry 4.23.1 + โค้ดที่ `58e2436a`):
  (a) `common/components/input` (`Input` ที่มี label/`*`/`useId`/error/ปุ่มรหัสผ่าน) — ชิ้นส่วนเป็นของ shadcn ครบ (`field`, `input`, `input-group`) แต่ห่อเป็น component กลางของเรา ผู้เรียก ~45 ช่อง;
      สิ่งที่ shadcn **ไม่มี** จริงคือ `*` (กฎ 30), error ไทยจาก validation native (`useFieldError`) และ `useId`/`aria-describedby` อัตโนมัติ
  (b) `common/components/native-select` — shadcn **มี** `native-select` ใน registry แต่รอบ 44 เลือกเขียนเอง (wrapper `w-fit` ทำ CORE-4g ล้ม) — ถูกลบใน SFUI-17 อยู่แล้ว
  (c) `common/components/checkbox` — `Field orientation="horizontal"` + `Checkbox` ตามตัวอย่าง docs บวกการกัน reset (`onClick` + `defaultChecked`, qa #353) ซึ่ง shadcn ไม่มี — เหตุผลเดียวกับกฎ 42
  (d) `useFieldError` — shadcn ไม่มี validation นอก `form` (react-hook-form) → จำเป็นถ้าไม่ใช้ `form`
  (e) นอกฟอร์ม: registry มี `spinner` แต่ `Button` wrapper (`isLoading`) และ `cart/components/item` ใช้ icon หมุนของเรา (`common/icons/spinner`/`LoaderCircle`)
  **เสนอ**: ไม่ย้ายตอนนี้ (ก่อน v0.4.0) — ถ้า owner ต้องการ ให้เป็น backlog หลัง v0.4.0: (a) แตก `Input` ออกเป็นการประกอบตาม docs ทีละฟอร์ม + คง `useFieldError` เป็น hook, (e) ใช้ `spinner` ของ shadcn
- **Q-R49-6 (`form` ของ shadcn)**: registry มี `form` (react-hook-form + `@hookform/resolvers` + `zod` — dependency ใหม่ 3 ตัว, state/validation ฟอร์มย้ายไป client แทน server action + `useActionState`)
  ถ้าใช้จะแทน `useFieldError` ได้ แต่ต้องเขียนฟอร์มทุกตัวใหม่และ e2e การคงค่าหลัง error (CORE-4f/4h/20d/23c/52) เสี่ยง — **ไม่เลือกในรอบนี้** (ADR-032 D1 ค เดิม); **เสนอ คงไม่ใช้** · ถาม owner ว่ายืนยันไหม
- ข้อเสนอของ planner ที่ owner แย้งได้ (ไม่ใช่คำถามบังคับ): label `บ้านเลขที่ หมู่ ซอย ถนน` + placeholder ตัวอย่าง, ป้าย `เขต/อำเภอ` คงข้อความเดิม, คู่ช่องใหม่ (กฎ 54), บริษัทอยู่ก่อนบ้านเลขที่,
  รูปแบบสรุปที่อยู่บรรทัดเดียวตามลำดับไทย (กฎ 57), ตัด option `-` ของประเทศในที่อยู่ใบเสร็จ (กฎ 41)

## ส่วน consistency + ที่อยู่ (รอบ 50 — owner 2026-11-28, ก่อน release v0.4.0)
Status: accepted (owner 2026-11-28 — ตัดสินทุกข้อก่อนเขียน; ADR-034 accepted) · spec พร้อม — task SFUI-19a..22 ☐ · **release v0.4.0 (#603) พักจนรอบ 50 merge ครบ** (owner 2026-11-28)
Goal (owner's words, 2026-11-28): "ช่องจังหวัดต้องบังคับกรอก", "ซ่อนช่องประเทศ ส่ง th (เปิดขายแค่ไทย) และซ่อนบรรทัดประเทศในสรุปที่อยู่", "ทุกปุ่มขนาดเท่ากัน = default ของ shadcn รวมปุ่มจ่ายเงิน
และลิงก์สลับ login/สมัคร", ตรวจ consistency ทั้งร้านบน browser จริงแล้วแก้ — "ใช้ค่ามาตรฐานของ component shadcn ที่ติดตั้ง ไม่แก้โดยไม่จำเป็น; ถ้า shadcn มี component ให้ `shadcn add` และประกอบตาม docs";
gap ฟอร์มค่าเดียว 16px; `h1` ทุกหน้าขนาดเดียว (ถอด `uppercase`, hero คงได้); ซ่อนตัวเลือก region ในเมนูข้างเมื่อมีประเทศเดียว; รวมใน v0.4.0
Out of scope: `apps/backend/**` · แก้ไฟล์ใน `src/components/ui/*` (เพิ่มได้เฉพาะไฟล์ใหม่จาก `shadcn add` ตามกฎ 64) · `package.json`/lockfile · สไตล์ภายใน iframe ของ Stripe · หน้าใหม่/flow ใหม่ ·
รายการ "ควรพิจารณา" ที่ไม่รวม (ตาราง "ไม่รวม" ด้านล่าง) · autocomplete/รายการจังหวัดแบบเลือก (จังหวัดยังเป็นช่องพิมพ์)
อินพุต: audit ของ qa บน prod build ของ develop `523056bb` (1280×800 + 390×844, `getComputedStyle`) + คำตัดสิน owner 2026-11-28 · ทางเลือก: ADR-034

### What Medusa already gives us
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ปุ่ม/แบ่งหน้า/toggle/checkbox/ช่องค้นหาของ storefront | ไม่มี (Medusa ไม่มี UI storefront; medusajs.com/integrations ไม่มี plugin UI storefront) — shadcn registry 4.23.1: `button`, `checkbox`, `input`, `input-group`, `dialog`, `sheet`, `accordion`, `select` **มีแล้ว**; `pagination`, `toggle-group` (+ `toggle`), `alert` ยังไม่ติดตั้ง | **ใช้** ของ `ui/` ตาม default (การ์ดตัวเลือก = Choice Card ของ `field` + `radio-group`); **`shadcn add pagination`, `toggle-group`, `alert`** (กฎ 64) — ไม่มี component กลางใหม่ |
| ประเทศของที่อยู่ | Address ของ Medusa (`country_code`) + region ปฏิเสธประเทศนอก region | ส่ง `th` คงที่ผ่าน hidden input (กฎ 70) — ไม่แก้ backend |
| จังหวัด | Address ของ Medusa มี `province` (string) | as-is — บังคับฝั่ง storefront (กฎ 69) |
| ส่งที่อยู่ให้ Stripe | `payment-button` ส่ง `state = province`, `country = country_code` อยู่แล้ว | as-is |

Data model / Workflows / API routes: none · Admin UI: none · Storefront pages: ไม่มีหน้าใหม่ — หน้าตาเปลี่ยนตามตาราง inventory

### Inventory สิ่งที่ต้องแก้ (ณ `523056bb`; path ใต้ `apps/storefront/src/`, บรรทัดตาม audit)
| # | Task | ไฟล์:บรรทัด | testid / ที่ผิด (ค่าที่วัด) | แก้เป็น |
|---|---|---|---|---|
| 1 | 19a | `modules/checkout/components/shipping/index.tsx:371-373` | `submit-delivery-option-button` 48px (`lg` + `h-12`, className `mt` พิมพ์ผิด) | `Button` default (กฎ 59) |
| 2 | 19a | `modules/checkout/components/payment/index.tsx:392-394` | `submit-payment-button` 48px | default + พิสูจน์ Stripe (กฎ 61) |
| 3 | 19a | `modules/checkout/components/payment-button/index.tsx:265,310`; `modules/checkout/components/promptpay-payment/index.tsx:73,307` | `submit-order-button` (บัตร/พร้อมเพย์) และปุ่มของพร้อมเพย์ 48px | default |
| 4 | 19a | `modules/order/components/order-pay/pay-buttons.tsx:42-43,136-137` | `order-pay-card-button`, `order-pay-promptpay-button` 48px | default |
| 5 | 19a | `modules/layout/components/cart-dropdown/index.tsx:284`; `modules/checkout/components/refunded-go-to-cart/index.tsx:14` | `go-to-cart-button` 48px; ไปตะกร้าหลังคืนเงิน `lg` + `h-12` | default |
| 6 | 19a | `modules/cart/templates/summary.tsx:33`; `modules/cart/components/sign-in-prompt/index.tsx:17` | `checkout-button` 40px; ปุ่มเข้าสู่ระบบ `h-10` | default |
| 7 | 19a | `modules/products/components/product-actions/index.tsx:310` | `add-product-button` 40px (ปุ่มมือถือ `mobile-cart-button` 36px) | default |
| 8 | 19a | `modules/account/components/address-card/add-address.tsx:188`, `edit-address-modal.tsx:257` | `cancel-button` 40px คู่ `save-button` 36px | default |
| 9 | 19a | `modules/evoucher/components/voucher-copy-button/index.tsx:12` → `modules/common/components/copy-button/index.tsx:86` | `voucher-copy-button` 32px (`sm` จาก prop legacy `small`/`medium`) | ลบ prop `size` ของ `CopyButton`, default |
| 10 | 19a | `modules/group-buy/components/group-page/group-join.tsx:202-203` | ปุ่ม ghost `sm` 32px | ghost default |
| 11 | 19a | `modules/account/components/account-info/index.tsx:81-82` | `edit-button` `w-[100px] min-h-[25px]` padding 4px 16px | default (ไม่มี className ขนาด) |
| 12 | 19a | `modules/shipping/components/free-shipping-price-nudge/index.tsx:216`; `modules/layout/components/cart-mismatch-banner/index.tsx:45` | ปุ่ม icon รูปทรงเอง; ghost `p-0` | `size="icon"` / ghost default |
| 13 | 19a | `styles/globals.css` (`@utility contrast-btn`) | ไม่มีผู้ใช้ | ลบ (กฎ 62) |
| 14 | 19b | `modules/order/templates/order-details-template.tsx:46-47` | `order-return-button` 42px ขอบเอง | `Button asChild variant="outline"` + ลิงก์ |
| 15 | 19b | `modules/account/components/login/index.tsx:90-95`; `modules/account/components/register/index.tsx:99,147-152` | `login-to-register-button`, `register-to-login-button`, `register-login-link` 44px 12px underline | `Button variant="link"` default (กฎ 63) |
| 16 | 19b | `modules/checkout/components/addresses/index.tsx:64-67`; `shipping/index.tsx:168-171`; `payment/index.tsx:290-293,379`; `discount-code/index.tsx:138-142,231` | `edit-address-button`, `edit-delivery-button`, `edit-payment-button` 22.4px hover ต่างกัน; `add-discount-button` | `Button variant="link"` default |
| 17 | 19b | `modules/account/components/address-card/edit-address-modal.tsx:115-126` | `address-edit-button`, `address-delete-button` 20px 12px outline ของ browser | `Button variant="ghost"` default |
| 18 | 19b | `modules/common/components/delete-button/index.tsx:54-57` | `product-delete-button`, `cart-item-remove-button` | `Button variant="ghost"` (`size="icon"` เมื่อไม่มีข้อความ) |
| 19 | 19b | `modules/account/components/account-nav/index.tsx:110-114,181-184`; `app/[countryCode]/(main)/affiliate/layout.tsx:46` | `logout-button` กับ `affiliate-logout` หน้าตาต่างกัน | ทั้งคู่ `Button variant="ghost"` default |
| 20 | 19b | `modules/account/components/overview/index.tsx:125-127` | `open-order-button` icon ดิบ 16px | `Button variant="ghost" size="icon"` (+ `asChild` ถ้าเป็นลิงก์) |
| 21 | 19c | `modules/search/components/search-form/index.tsx:24-39` | `search-query-input` `<input>` ดิบ 40px; `search-submit` 40px `bg-black` | `Input` + `Button` ตามตัวอย่าง docs "Input with button" (กฎ 65) |
| 22 | 19c | `modules/store/components/store-search-box/index.tsx:43-67` | `store-search-input` 46.4px ไม่มีกรอบ; `store-search-clear` 15px | `InputGroup` + addon icon + `InputGroupButton size="icon-xs"` (กฎ 65) |
| 23 | 19c | `modules/store/components/store-hits/pagination.tsx:17-36`; `modules/store/components/pagination/index.tsx:36` | `product-pagination` และแบ่งหน้าของ orders/หมวด 28.8px 18px | `shadcn add pagination` (กฎ 66) |
| 24 | 19d | `modules/store/components/store-refinements/option-refinements.tsx:109-119`; `refinement-list/options-picker/index.tsx:118-122` | `option-refinement` 40px 12px | `shadcn add toggle-group` (กฎ 67) |
| 25 | 19d | `modules/store/components/store-refinements/current-refinements.tsx:85,107` | `clear-refinements` ลิงก์เอง; `remove-refinement` chip `h-8` | `Button variant="link"`; `Button variant="outline"` default |
| 26 | 19d | `modules/store/components/store-refinements/refinement-group.tsx:36-39`, `on-sale-toggle.tsx:25-28` | `refinement-<attribute>`, `on-sale-toggle` checkbox native 13px | `ui/checkbox` + `Field orientation="horizontal"` (กฎ 67) |
| 27 | 19d | `modules/products/components/product-tabs/accordion.tsx:38`; `option-refinements.tsx:96` | `AccordionTrigger` override `px-1 py-1.5` (32px) และ `py-3` (44px) | `AccordionTrigger` default (กฎ 68) — จาก "ควรพิจารณา" |
| 28 | 20a | ฟอร์มที่อยู่ 5 ตัว (`checkout/components/{shipping-address,billing_address}`, `account/components/{address-card/add-address,address-card/edit-address-modal,profile-billing-address}`) + `lib/util/address-required.ts` | จังหวัดไม่บังคับ (UI + server) | บังคับ (กฎ 69) |
| 29 | 20b | ฟอร์มที่อยู่ 5 ตัว + `modules/checkout/components/country-select/` | ช่องประเทศ (modal เพิ่มที่อยู่ส่งค่าว่าง → "กรุณาเลือกประเทศ") | hidden `th`, ลบ `CountrySelect` ของ checkout (กฎ 70) |
| 30 | 20c | `lib/util/address-lines.ts` + ผู้ใช้ 7 ไฟล์ (กฎ 57) | สรุปที่อยู่มีบรรทัดประเทศ (checkout review แสดง "TH") | ไม่มีบรรทัดประเทศ (กฎ 71) |
| 31 | 20c | `modules/layout/components/side-menu/index.tsx:93-107`; `modules/layout/components/country-select/index.tsx:83-84` | ตัวเลือก region แสดง "Thailand" ตัวเลือกเดียว, dropdown ทับข้อความที่ 390px, trigger override 28px | ซ่อนเมื่อ ≤ 1 ประเทศ + ถอด override (กฎ 72) |
| 32 | 21a | `shipping-address/index.tsx:142,239`; `billing_address/index.tsx:34`; `add-address.tsx`/`edit-address-modal.tsx` (`gap-2` + `gap-y-2` :95/:154); `profile-billing-address:126`; `profile-name:62`; `profile-phone:60`; `profile-password:43`; `login:52`; `register:48`; `discount-code:157` | gap ระหว่างช่อง 8px/16px ปน (`gap-2`, `gap-y-2`, `gap-x-4 gap-y-2`) | `gap-4` (16px) ทุกฟอร์ม (กฎ 73) |
| 33 | 21d, 21e | `modules/checkout/components/error-message/index.tsx:8` (ผู้ใช้ 12 ไฟล์ ~19 จุด) + hard-code `text-rose-500` (`add-address.tsx:177`, `edit-address-modal.tsx:246`, `register/index.tsx:95`, `return-request-form/index.tsx:150,158`, `group-join.tsx:134,215,290`) + Badge destructive ของ `account-info` `error-message` + span ของ `delete-button` | error `text-rose-500`/`text-xs` 12–14px ปนกัน ทั้งระดับฟอร์มและในแถว | ระดับฟอร์ม → `Alert variant="destructive"` ผ่าน `ErrorMessage`; ในแถว/เซลล์ → `FieldError` ตรง (กฎ 74 — owner Q-R50-2 ทาง (ข); ตาราง testid ครบทั้งร้านในกฎ 74c รวม PDP/flash/campaign/cart notice ของ 21e) |
| 34 | 21a | `modules/checkout/components/address-select/index.tsx:45-47` | `shipping-address-select` 46px `px-16` | `SelectTrigger` default (กฎ 75) |
| 35 | 21a | `add-address.tsx:86-88`; `edit-address-modal.tsx:144-146`; `layout/components/side-menu/index.tsx:62-68`; `layout/components/search/drawer.tsx:49`; `products/components/product-actions/mobile-actions.tsx:193-195` | ปุ่มปิด overlay เขียนเอง icon 20px (mobile-actions 48×48) | `DialogClose`/`SheetClose asChild` + `Button variant="ghost" size="icon"` (กฎ 76) — จาก "ควรพิจารณา" |
| 36 | 21b | `<h1` 27 ไฟล์ใน `src/` (ยกเว้น `modules/home/components/hero`) | 16px `uppercase` (auth/verify/affiliate login), 24/36 (affiliate), 30/48 (account/404/search/policy/group), 32/40 (PDP), 32/48 (order) | `text-3xl font-semibold tracking-tight` (กฎ 77) |
| 37 | 21c | `modules/checkout/components/shipping/index.tsx:31,218-356` (`OPTION_CLASS` 3 จุด); `modules/checkout/components/payment-container/index.tsx:34-67` | การ์ดจัดส่งมีขอบ 1px ที่ `RadioGroupItem` แต่การ์ดชำระเงิน `border-0` กรอบอยู่ที่ container + `OptionDot` วาดเอง | Choice Card ของ docs shadcn (`FieldLabel` + `Field` + `RadioGroupItem`) ทั้งสอง (กฎ 80 — owner Q-R50-1) |

**ไม่รวม** (จาก "ควรพิจารณา" ของ audit — ไม่ใช่การถอด override กลับ default และไม่ใช่การใช้ component ของ shadcn ที่ตรงตัว; การ์ดตัวเลือกเดิมอยู่ที่นี่ — owner ตัดสินให้ทำ → ข้อ 37):
| รายการ audit | เหตุผล |
|---|---|
| `option-button` บน PDP/group (radio sr-only + label 40px — `option-select.tsx:38-50`) → toggle-group | radio native เป็นส่วนของฟอร์ม no-JS ของ PDP; ToggleGroup ของ Radix ไม่ส่งค่าใน `<form>` (ADR-034 D4 ง) |
| icon `size-[15px]`/`size={20}` นอกปุ่มที่แปลงในรอบนี้ (`layout/components/search/index.tsx:144` ของ `nav-search-button`, `account-nav/index.tsx:57-117`) | ไม่ใช่ override ของ component (`nav-search-button` ล็อกขนาดด้วย core-50); icon **ใน**ปุ่มที่แปลงแล้วใช้ default `size-4` ของ `Button` (กฎ 60) |
| "จำนวน: 1" ใน cart dropdown ตัวใหญ่กว่าข้อความ variant | ข้อความธรรมดา ไม่ใช่ component — backlog |
| `search-input` ใน search drawer 54.4px (`layout/components/search/index.tsx:72`) | แถบค้นหาเต็มกว้างไร้กรอบแบบ `CommandInput` — เปลี่ยนเป็น `command` = ออกแบบใหม่ (ADR-034 D4 จ) |
| `nav-menu-button` สูงเต็ม nav 63px; การ์ด `add-address-button` 220px | layout/ดีไซน์ตั้งใจ (audit) |
| ลิงก์ช่องทางติดต่อ ≥ 44px (`contact-channel`, spec 01 CORE-85) | ลิงก์ข้อความ ไม่ใช่ปุ่ม — คงไว้ |

### Business rules (ต่อจากกฎ 57; ADR-034) — กฎ 58–80
58. ขอบเขต = ตาราง inventory รอบ 50. **ยกเว้นกฎ "คง computed style" (กฎ 19, 22, 27 และบทเรียน CLAUDE.md เรื่องงานย้าย class) เฉพาะ element ในตาราง** — ค่าที่ test ใหม่ assert
    = ค่าที่ component ของ shadcn render จริงบน build ของ branch (`getComputedStyle`) ไม่ใช่ค่าจากชื่อ class; ส่วนอื่นของหน้ายังอยู่ใต้กฎ 19; e2e เดิมแก้ได้เฉพาะตามกฎ 78
59. (ADR-034 D1) ทุก `Button` (`@/components/button` หรือ `@/components/ui/button`) และ `buttonVariants(...)` ใน `src/modules/**`, `src/app/**`, `src/components/*.tsx` (นอก `ui/`):
    prop/argument `size` ไม่มี หรือเป็น `"default"` หรือ `"icon"` (ปุ่มที่มีแต่ icon — ต้องมี `aria-label` ไทย) เท่านั้น; className/argument ที่ส่งเข้า **ห้ามมี** token ขนาด:
    `h-*`, `min-h-*`, `max-h-*`, `size-*`, `w-[…]`, `min-w-*`, `p-*`/`px-*`/`py-*`/`pt-*`/`pr-*`/`pb-*`/`pl-*`, `text-{xs,sm,base,lg,xl,2xl,…}`/`text-[…]`, `leading-*`, `rounded-*`, `font-*` (รวมแบบมี prefix breakpoint/state เช่น `md:h-10`, `has-[>svg]:px-2`)
    — ยอมเฉพาะ layout ภายนอก (`w-full`, `w-auto`, `w-fit`, `flex-1`, `grow`, `shrink-0`, `self-*`, `m*-*`, `order-*`, `hidden`/`flex` ตาม breakpoint, `justify-*` ของเนื้อหา) และสีตามบทบาทที่ไม่เปลี่ยนขนาด;
    ข้อยกเว้นเดียว: **`InputGroupButton size="icon-xs"` ภายใน `InputGroupAddon`** (pattern ของ docs `input-group` — ปุ่มแสดงรหัสผ่าน `<t>-toggle`, `store-search-clear`); `InputGroupButton` size อื่นห้ามใช้;
    wrapper `@/components/button` (`isLoading`) ใช้ได้ตามเดิม
60. (D3) ปุ่ม/ลิงก์ที่ไม่ใช่ shadcn ในตาราง inventory: action → `<Button>`; navigation → `<Button asChild>` ครอบลิงก์ (`LocalizedClientLink`/`<a>` — ได้ `data-slot="button"`, ลิงก์ไม่ซ้อนปุ่ม spec 01 กฎ 146b);
    variant ตามบทบาท: การกระทำหลักของขั้นตอน `default`; รอง/ย้อนกลับ/ยกเลิก `outline`; การกระทำในบรรทัดข้อความ (แก้ไข, สลับฟอร์ม, ล้างทั้งหมด, เพิ่มโค้ดส่วนลด) `link`; ในรายการ/แถว (แก้/ลบที่อยู่, ออกจากระบบ) `ghost`;
    icon อย่างเดียว `ghost` + `size="icon"`; icon ใน `Button` ไม่ส่ง `size-*` (ใช้ default `size-4` ของ `buttonVariants`); testid/`aria-*`/ข้อความไทย/`onClick`/`href`/`type`/`disabled` คงเดิม
61. (D2) ปุ่มจ่ายเงินทุกตัว (`submit-payment-button`, `submit-order-button` บัตร/พร้อมเพย์, `order-pay-card-button`, `order-pay-promptpay-button`) สูง 36px; **ห้ามแก้ปัญหาคลิกตก iframe ด้วยความสูงปุ่ม**:
    หลังกรอกบัตรใน Stripe Elements `document.elementFromPoint(จุดกลางของปุ่ม)` ต้องเป็นปุ่มหรือลูกของปุ่ม; ถ้าไม่ใช่ ให้ปรับระยะห่าง/layout รอบปุ่ม (เช่น `mt-*` ของ container) แล้วบันทึกใน PR
    หรือหยุดรายงาน planner — ไม่ใส่ `h-*` กลับ
62. `@utility contrast-btn` ใน `src/styles/globals.css` ถูกลบ (ไม่มีผู้ใช้ — ข้อยกเว้นของกฎ 36/51 เฉพาะ SFUI-19a เฉพาะบล็อกนี้); `e2e/sfui-button-lg.unit.spec.ts` ถูกลบและแทนด้วย guard ของ AC-55
63. **ประกาศการแทนถ้อยคำ (ไม่ลบถ้อยคำเดิม — มีผลตั้งแต่ task ที่ระบุ merge)**:
    (a) spec 09 **กฎ 20** ท่อน "`large` → `lg` + `h-12` คงความสูง 48px ของ develop …" → "`small|medium|large` → size `default` (36px) ทั้งหมด (กฎ 59)" — SFUI-19a
    (b) spec 01 **กฎข้อ 137** "`register-login-link` มีพื้นที่แตะสูง ≥ 44px" และ **กฎข้อ 146 (a)** "≥ 44px ที่ 375px" → "เป็น `Button variant="link"` size default สูง 36px";
        **AC-178** / **AC-187** ท่อน `boundingBox().height ≥ 44` → `= 36` (ส่วนเติมอีเมล, testid ไม่ซ้ำ, `register-button` = 0 ตัว ยังมีผล) — SFUI-19b
    (c) spec 09 กฎ 31, 40c, 41–44, 53–55, 57 และ AC-28, AC-32, AC-34, AC-35, AC-44, AC-49, AC-53 ส่วนประเทศ/ช่องบังคับ/บรรทัดประเทศ → กฎ 69–72 — SFUI-20a/20b/20c (หมายเหตุในแต่ละข้อ)
    (d) spec 01 กฎข้อ 55/56 + AC-91 (placeholder `CountrySelect`), 63(d) + AC-99 (ความสูง `CountrySelect`), 73(c) (`billing-country-code-select` สูงเท่า input), 110(d) + AC-147 (select ประเทศคงค่าหลัง error / `toHaveValue("th")`)
        → กฎ 70 (SFUI-20b); 110(b), 116(a) (รายการช่องบังคับ) และ 121(a) (`province` เป็นช่องไม่บังคับ) → กฎ 69 (SFUI-20a) — หมายเหตุในแต่ละข้อของ spec 01
    (e) spec 09 กฎ 32e/AC-33 "ข้อความระดับฟอร์มคงตำแหน่ง/testid/ข้อความเดิม" ยังมีผล — หน้าตาเปลี่ยนเป็น `Alert` ตามกฎ 74 (SFUI-21d)
64. (D4) component ใหม่ใน `ui/` มาจาก `pnpm dlx shadcn@4.23.1 add pagination` (SFUI-19c), `pnpm dlx shadcn@4.23.1 add toggle-group` (SFUI-19d — ได้ `toggle` + `toggle-group`)
    และ `pnpm dlx shadcn@4.23.1 add alert` (SFUI-21d) **เท่านั้น**;
    ตัวที่มีแล้ว (`button`) ต้อง "No changes." (`--dry-run --diff`); hash ของไฟล์ใหม่ใน `e2e/support/shadcn-ui.json` (AC-19); ไม่รับการแก้ `package.json`/lockfile/`globals.css` ที่ CLI เสนอ
    (ต้องการ dependency ใหม่ → หยุดรายงาน planner); ไม่ add `switch`, `command`, `native-select`, `combobox`, `form`
65. ช่องค้นหา: (a) `search-form` = ตัวอย่าง docs "Input with button": `<Input type="search" id="search-q" name="q" …>` ของ `@/components/ui/input` + `<Button type="submit">` default ใน container `flex gap-2`;
    ยังเป็น GET form ที่ทำงานเมื่อปิด JS (`role="search"`, `action`, label `sr-only` คงเดิม); (b) `store-search-box` = `InputGroup` → `InputGroupAddon` (icon `Search`) → `InputGroupInput type="search"` (`aria-label` เดิม)
    → `InputGroupAddon align="inline-end"` → `InputGroupButton size="icon-xs"` `store-search-clear` (`aria-label="ล้างคำค้นหา"`); (c) ช่อง `search-input` ของ drawer คงเดิม (ตาราง "ไม่รวม");
    (d) แก้ allow-list กฎ 26 + AC-35 (`sfui-13-form-guard.unit.spec.ts`): ลบรายการ `<input type="search">` ของ `store-search-box` และ `search-form`; `search/components/search-form/index.tsx` เป็นไฟล์เดียวนอก `src/components/**`
    และ `common/components/input` ที่ import `@/components/ui/input` ได้ (element `<Input type="search">` `search-query-input` เท่านั้น); `store-search-box` ใช้ `InputGroupInput` (ไม่ใช่ `<input` ใน JSX)
66. แบ่งหน้า (`Pagination` ของ starter + `SearchPagination` ของ store): `Pagination` (`aria-label="แบ่งหน้า"` ทับค่าอังกฤษ, testid เดิมบน `<nav>`) → `PaginationContent` → `PaginationItem` → `PaginationLink`
    (`href` = URL ของหน้านั้นจริง: starter `?page=<n>` บน path ปัจจุบัน, store `createURL(page)` ของ `usePagination`; `onClick` → `preventDefault()` + `router.push`/`refine` เดิม; `isActive` บนหน้าปัจจุบัน → `aria-current="page"`;
    `aria-label` ไทย `หน้า <n>` เดิม — spec 01 กฎ 136c/148c ยังมีผล); จุดไข่ปลาคง `<span aria-hidden="true">` เดิม (ไม่ใช้ `PaginationEllipsis`/`PaginationPrevious`/`PaginationNext` — ข้อความอังกฤษตายตัว);
    ไม่ส่ง className ขนาดเข้า part ของ `pagination` (ระยะห่าง `mt-12` ของ container ภายนอกคงได้)
67. ตัวกรองของ store: (a) chip ตัวเลือก (`option-refinement` ทั้งสองไฟล์) = `ToggleGroup type="multiple" variant="outline" spacing={2}` (className layout `flex-wrap` ได้) → `ToggleGroupItem value data-testid="option-refinement"`;
    `value` ของกลุ่ม = ค่าที่ `isRefined`; `onValueChange(next)` เรียก `refine(v)` **ครั้งเดียว** สำหรับค่าที่ต่างจากเดิม (เพิ่มหรือเอาออก); ข้อความ + จำนวน `(<count>)` เดิม; `aria-pressed` มาจาก Radix;
    (b) checkbox หมวด/`on-sale-toggle` = ตัวอย่าง docs `Field orientation="horizontal"` → `Checkbox` (`@/components/ui/checkbox`, `checked={isRefined}`, `onCheckedChange={() => refine(…)}` — ไม่อยู่ใน `<form>` จึงไม่ติดเรื่อง reset ของกฎ 20)
    → `FieldLabel htmlFor`; testid เดิมอยู่บน `Checkbox` root (`role="checkbox"`); ไม่ใช้ `common/components/checkbox` (ตัวนั้นเพื่อฟอร์ม server action); allow-list กฎ 26 ลบสองรายการนี้;
    (c) `clear-refinements` = `Button variant="link"`, `remove-refinement` = `Button variant="outline"` (icon `X` ไม่มี `size-*`; `title`/`aria-label`/`truncate` ของข้อความเดิม — spec 01 กฎข้อ 149)
68. `AccordionTrigger` (`product-tabs/accordion.tsx`, `option-refinements.tsx`) ไม่มี className ที่เปลี่ยน padding/ความสูง/ตัวอักษร (ใช้ default ของ shadcn); `AccordionContent` คง className เดิม
69. (owner — จังหวัดบังคับ) ช่องจังหวัดใน 5 ฟอร์ม (`shipping-province-input`, checkout `billing-province-input`, `state-input` ของ add/edit address, `billing-province-input` ของ `profile-billing-address`) มี `required`
    (ป้าย `*` ตามกฎ 30; error ระดับช่องตามกฎ 32); `REQUIRED_ADDRESS_FIELDS` = `["first_name", "last_name", "address_1", "address_2", "city", "province", "postal_code"]`;
    `MISSING_ADDRESS_MESSAGE` = `กรุณากรอกชื่อ นามสกุล ที่อยู่ ตำบล/แขวง เขต/อำเภอ จังหวัด และรหัสไปรษณีย์ให้ครบ (ช่องที่มีแต่ช่องว่างถือว่ายังไม่ได้กรอก)` (ตรงตัว);
    ข้อมูลเดิมที่ไม่มี `province` แสดงผลได้, group join ด้วยที่อยู่ที่บันทึกไว้ไม่ตรวจเพิ่ม, เลือกที่อยู่เดิมใน checkout → ช่องจังหวัดว่างแสดง error ระดับช่องจนกรอก (เหมือนกฎ 55)
70. (D5 — owner: ซ่อนประเทศ) ทั้ง 5 ฟอร์ม **ไม่ render ช่องประเทศ** และมี `<input type="hidden">` ชื่อเดิม (`shipping_address.country_code`, `billing_address.country_code`, `country_code` ×3) ค่า `ADDRESS_COUNTRY_CODE`
    (= `"th"` export จาก `src/lib/util/address-required.ts` — ที่เดียว);
    **state ของ checkout (`shipping-address`, `billing_address`): `formData["<prefix>.country_code"]` = `ADDRESS_COUNTRY_CODE` คงที่ทุกกรณี** (state เริ่มต้น, `setFormAddress` เมื่อเลือกที่อยู่ที่บันทึกไว้หรือเติมจาก cart —
    ไม่คัดลอกประเทศจากที่อยู่ต้นทาง) และไม่มี UI ที่เขียนค่านี้ — **ทางเลือก (ก) ของ review #624**: `AddressSelect` เทียบ `formData` กับที่อยู่ที่บันทึกไว้ด้วย `compareAddresses` (ซึ่งรวม `country_code`)
    ที่อยู่ที่บันทึกไว้ของร้านเป็น `th` จึงยังจับคู่ได้; ไม่แก้ `compareAddresses`/unit ของมัน (เปลี่ยนน้อยกว่าทาง (ข) และ `formData` = ค่าที่จะส่งจริง — ที่อยู่เดิมที่ประเทศไม่ใช่ `th` ไม่ถูกแสดงว่า "เลือกอยู่" ซึ่งถูกต้อง
    เพราะส่งแล้วจะกลายเป็น `th`; ทาง (ข) เอา `country_code` ออกจาก `FIELDS` จะกระทบการตัดสิน "ใบเสร็จเหมือนที่อยู่จัดส่ง" ใน `checkout/components/addresses` ด้วย); ลบ `modules/checkout/components/country-select/` และ unit ที่ทดสอบมัน
    (`core-52-address-form-state.test.ts` ส่วน `CountrySelect`, `checkout-thai-polish.test.ts` ข้อ placeholder `เลือกประเทศ`); การ์ด `profile-billing-address` ไม่ประกอบ `Select` ประเทศเอง; คู่ช่อง (กฎ 54) ไม่มีแถวประเทศ;
    testid `shipping-country-select`, `billing-country-select`, `country-select`, `billing-country-code-select` ไม่มีใน `src/` แล้ว; `useFieldError` สำหรับ select (กฎ 43) และ `e2e/support/select.ts` คงไว้ (select อื่นยังใช้)
71. (owner — ซ่อนบรรทัดประเทศ) `addressLines(address)` คืน `string[]` ที่มีเฉพาะบรรทัดที่อยู่ตามลำดับไทยของกฎ 57 (`[]` เมื่อทุกช่องว่าง) — ไม่มีบรรทัดประเทศ; ผู้ใช้ 7 ไฟล์ของกฎ 57 ไม่แสดงประเทศ
    (`address-province-country` ของการ์ดใน `edit-address-modal` ถูกลบ, `<span>{country}</span>` ของ `profile-billing-address` ถูกลบ, checkout review/สรุปจัดส่ง/ใบเสร็จ, `order/components/shipping-details`, `address-select`, `shipping`, `group-join` ไม่มี "TH")
72. (D6 — owner) เมนูข้าง: รวม `regions.flatMap((r) => r.countries ?? [])` ได้ ≤ 1 ประเทศ → ไม่ render `CountrySelect` ของ layout และ `country-select-arrow`; ≥ 2 → แสดงตามเดิม;
    `SelectTrigger` ของ `layout/components/country-select` ไม่มี className ขนาด (กฎ 75); `SheetDescription` คงข้อความเดิม (baseline กฎ 10)
73. (owner — gap) container ที่จัดช่องกรอกของทุกฟอร์มในตาราง inventory ของรอบ 48 (ระดับ grid/flex ของช่อง รวมคู่ `md:grid-cols-2`) ใช้ **`gap-4`** (16px ทั้งแนวตั้ง/แนวนอน) — ไม่มี `gap-2`, `gap-y-*`, `gap-x-*`
    ปนในระดับช่อง; ไม่ใช้ `FieldGroup` (default `gap-7` ต่างค่าที่ owner เลือก); ระยะภายใน `Field` (label–control–error) เป็นของ shadcn ไม่แก้
74. (owner 2026-11-28 — Q-R50-2 = ใช้ `Alert` **กับ error ระดับฟอร์ม** เช่น login ผิด, จ่ายเงินไม่สำเร็จ, ที่อยู่ไม่ครบ — ทาง (ข) ของ re-review #624) แยกสองแบบ **โดยไม่สร้าง component/prop ใหม่**:
    (a) **ระดับฟอร์ม/ขั้นของฟอร์ม** = `Alert` ของ shadcn (`pnpm dlx shadcn@4.23.1 add alert` — กฎ 64) ตามตัวอย่าง docs: `<Alert variant="destructive" id={id} data-testid="<เดิม>">` → icon `CircleAlert`
        (lucide, ไม่ส่ง `size-*`) → `<AlertDescription>{ข้อความ}</AlertDescription>` (ไม่มี `AlertTitle`); `ErrorMessage` ของ `checkout/components/error-message` (prop เดิม `error`/`id`/`data-testid`,
        `error` ว่าง → ไม่ render) เปลี่ยนไส้เป็นโครงนี้ และ**ใช้เฉพาะ error ระดับฟอร์ม/การกระทำ/ขั้น**; จุด hard-code แบบ (a) เปลี่ยนไปใช้ `ErrorMessage` —
        ยกเว้น `cart-error-notice` ที่ประกอบ `Alert` (variant `default`) + `AlertDescription` ตรงใน component เดิม (โทนกลาง ไม่ใช่ destructive)
    (b) **ในแถว/เซลล์/ใต้ตัวเลือก (inline)** = `FieldError` ของ `@/components/ui/field` ใช้ตรง (`<FieldError data-testid="<เดิม>">{ข้อความ}</FieldError>` — `text-sm text-destructive`, `role="alert"`, ไม่มีกรอบ;
        className layout ได้ เช่น `basis-full order-last`) — ไม่ผ่าน `ErrorMessage`
    (c) ตาราง testid (จากโค้ดจริง ณ `523056bb` — 12 ไฟล์ที่ import `ErrorMessage` + hard-code; testid ใหม่ที่ไม่อยู่ในตารางนี้ → reviewer ถาม planner):

    | testid | ไฟล์ (`src/modules/`) | แบบ |
    |---|---|---|
    | `login-error-message` | `account/components/login/index.tsx` | (a) |
    | `register-error`, `register-email-exists` (hard-code) | `account/components/register/index.tsx` | (a) |
    | `affiliate-login-error`, `affiliate-register-error` | `affiliate/components/auth-forms/index.tsx` | (a) |
    | `address-error-message` (×2) | `checkout/components/addresses/index.tsx` | (a) |
    | `address-error` (hard-code) | `account/components/address-card/{add-address,edit-address-modal}.tsx` | (a) |
    | `error-message` (Badge destructive ใน wrapper ที่มี transition — testid คงบน wrapper, `ErrorMessage` ไม่ส่ง testid อยู่ข้างใน) | `account/components/account-info/index.tsx` | (a) |
    | `promotion-error` (`id` ผูก `aria-describedby` — กฎ 32d) | `checkout/components/discount-code/index.tsx` | (a) — error ของฟอร์มโค้ดส่วนลด |
    | `delivery-option-error-message` | `checkout/components/shipping/index.tsx` | (a) — error ของขั้นจัดส่ง |
    | `payment-method-error-message`, `payment-session-pending-error` | `checkout/components/payment/index.tsx` | (a) |
    | `stripe-payment-error-message`, `manual-payment-error-message` (ผ่าน `PlaceOrderNotice`) | `checkout/components/payment-button/index.tsx` | (a) |
    | `promptpay-payment-error-message` (×4 — รวมกรณี Stripe ไม่พร้อม :76-79) | `checkout/components/promptpay-payment/index.tsx` | (a) |
    | `order-pay-error`, `order-pay-element-error` | `order/components/order-pay/index.tsx` | (a) |
    | `order-pay-card-error`, `promptpay-payment-error-message` | `order/components/order-pay/pay-buttons.tsx` | (a) |
    | `return-error`, `return-contact-store` (hard-code; มีลิงก์ติดต่อร้านใน `AlertDescription` ได้) | `returns/components/return-request-form/index.tsx` | (a) |
    | `group-join-error` (×2, hard-code) | `group-buy/components/group-page/group-join.tsx` | (a) |
    | `group-units-limit` (hard-code — ใต้รายการที่เลือก) | `group-buy/components/group-page/group-join.tsx` | (b) |
    | `product-error-message` (ใน `TableCell` ของแถวตะกร้า) | `cart/components/item/index.tsx:172` | (b) — เลิกใช้ `ErrorMessage` |
    | `cart-item-remove-error` (span `text-xs` ในแถว) | `common/components/delete-button/index.tsx` | (b) |
    | `review-flash-exceeds-customer-limit` (ขั้น review — กดสั่งซื้อไม่ได้) | `checkout/components/review/index.tsx:64-68` | (a) — error ของขั้น (21d) |
    | `add-variant-error` (กล่องเขียนเอง `border-destructive bg-muted p-4`) | `account/components/add-variant-error/index.tsx:84-86` | (a) — error ของการกระทำเพิ่มลงตะกร้าหลัง login (21d) |
    | `add-to-cart-error` | `products/components/product-actions/index.tsx:320-324` | (a) — error ของการกระทำ "เพิ่มลงตะกร้า" (21e) |
    | `mobile-add-to-cart-error` | `products/components/product-actions/mobile-actions.tsx:172-176` | (a) (21e) |
    | `group-create-team-error` | `home/components/campaigns/create-team-button.tsx:52` | (a) — error ของการกระทำ "สร้างทีม" (21e) |
    | `cart-error-notice` (กล่องเทา ข้อความสีปกติ — `?error=` จากการกลับจากหน้าชำระเงิน) | `cart/components/cart-error-notice/index.tsx:25-31` | (a) แต่ **`Alert` variant `default`** (คงโทนกลางแบบเดิม — PAY-12) (21e) |
    | `flash-qty-exceeds-remaining` (ใต้ตัวเลือกจำนวนบน PDP) | `products/components/flash-sale/qty-exceeds-remaining.tsx:15-17` | (b) — ผูกกับตัวเลือกจำนวน (21e) |
    | `flash-customer-limit-reached` (ใต้ตัวเลือกจำนวน; `flash-customer-limit` ข้างกันเป็นข้อความปกติ ไม่เปลี่ยน) | `products/components/flash-sale/customer-limit.tsx:24-26` | (b) (21e) |
    | `cart-flash-exceeds-remaining`, `cart-flash-exceeds-customer-limit` (ในแถวตะกร้า) | `cart/components/flash-exceeds-remaining/index.tsx:15-16,39-40` | (b) (21e) |
    | `group-leave-error` (ในแถวคำสั่งซื้อกลุ่ม) | `group-buy/components/account-group-orders/leave-button.tsx:72` | (b) — ผูกกับแถว (21e) |
    | `products-error`, `search-drawer-error`, `nav-cart-dropdown-error`, `group-orders-error`, `affiliate-portal-error`, `verify-account-error` | `store-hits`, `layout/search`, `cart-dropdown`, `account-group-orders/index.tsx:28`, `affiliate/portal-error`, `account/verify-account` | **ไม่รวม** — ข้อความแทนเนื้อหาของส่วน/หน้าเมื่อโหลดไม่ได้ (empty state) ไม่ใช่ error ของฟอร์มหรือการกระทำ |
    | `checkout-refunded-notice`, `payment-session-reset-notice` (`role="alert"` สีปกติ มีปุ่ม/ลิงก์ในบรรทัด) | `checkout/components/payment-button/index.tsx:89`, `checkout/components/payment/index.tsx:377` | **ไม่รวม** — notice ของสถานะ ไม่ใช่ error; มีปุ่มการกระทำในบรรทัด (layout เฉพาะ — PAY-16/FS-22) |
    | `checkout-processing-notice`, `order-pay-refund-notice`, `group-order-refund-notice`, `affiliate-status-notice`, `login-payment-received-notice` (ข้อความ/กล่องสีปกติบอกสถานะ) | `checkout/components/payment-button/index.tsx`, `order/components/order-pay/index.tsx`, `group-buy/components/account-group-orders/index.tsx`, `affiliate/components/status-notice/index.tsx`, `account/templates/login-template.tsx` | **ไม่รวม** — notice ของสถานะ (ชำระแล้ว/กำลังดำเนินการ/คืนเงิน/สถานะ affiliate) ไม่ใช่ error ของฟอร์มหรือการกระทำ (review #624 รอบสี่) |
    | `review-refunded-notice`, `promptpay-refunded` (`RefundedGoToCart` ข้อความสีจาง + ลิงก์ไปตะกร้า) | `checkout/components/review/index.tsx`, `checkout/components/refunded-go-to-cart`, `checkout/components/promptpay-payment` | **ไม่รวม** — notice ของสถานะ (คืนเงินแล้ว) เหมือน `checkout-refunded-notice` (SFUI-21d ถาม) |
    | `flash-sold-out`, `flash-card-sold-out`, "สินค้าหมดแล้ว" ของ `flash-campaign-card`; ราคา `text-red-700` ของ `store-hits/price.tsx` | `products/components/flash-sale/index.tsx:184,256`, `home/components/campaigns/flash-campaign-card.tsx:19`, `store/components/store-hits/price.tsx:48` | **ไม่รวม** — ป้ายสถานะ/ราคา ไม่ใช่ error |
    | `*` ของ label (`text-destructive`) | `common/components/input`, `profile-billing-address`, `checkout/components/country-select` | **ไม่รวม** — ป้ายบังคับ (กฎ 30) |

    ที่มาของตาราง: grep `text-destructive`, `text-red-`, `text-rose-`, `role="alert"`, `<ErrorMessage` และ testid ที่มี `error`/`warning`/`limit`/`exceeds`/`reached`/`notice` ใน `src/**` (ไม่ใช่ test) ณ `523056bb` —
    builder grep ซ้ำตอนเริ่ม 21d/21e; เจอตัวที่ไม่อยู่ในตาราง → หยุดถาม planner (ไม่จัดเอง)

    (d) ทั้งสองแบบ: testid คงเดิมบน root (`Alert`/`FieldError` — `role="alert"` จาก component); `id` ของ `promotion-error` อยู่บน root; `textContent` = ข้อความเดิม (icon ไม่มีข้อความ);
        ไม่มี className ที่เปลี่ยนสี/padding/ขนาดตัวอักษรของ `Alert`/`FieldError` (ระยะห่าง/ตำแหน่งภายนอกได้); ไม่มี `text-rose-` ใน `src/**` (ไม่ใช่ test); error ระดับช่อง (`useFieldError`, กฎ 32) ไม่เปลี่ยน;
        ข้อความสำเร็จ (`success-message` Badge) ไม่อยู่ในขอบเขต; **ผลข้างเคียงที่ตั้งใจ**: ตัวที่เดิมไม่มี `role="alert"` (`group-units-limit`, `group-leave-error`, `cart-flash-exceeds-*`,
        `return-error`, `return-contact-store`, `address-error` ฯลฯ) ได้ `role="alert"` จาก `Alert`/`FieldError` — screen reader อ่านเมื่อปรากฏ (ไม่มี e2e ที่ใช้ `getByRole("alert")` — ตรวจแล้วใน re-review #624)
75. `SelectTrigger` ทุกตัวใน `src/modules/**` ไม่มี className ขนาด (`h-*`, `px-*`, `py-*`, `text-*` ขนาด) — layout `w-full`/`w-auto` ได้ (กฎ 40b); ใช้กับ `checkout/address-select` และ `layout/country-select`
76. ปุ่มปิด overlay ในตาราง inventory ข้อ 35 = `DialogClose asChild`/`SheetClose asChild` → `<Button variant="ghost" size="icon" aria-label="<ไทยเดิม>" data-testid="<เดิม>">` + icon `X` (default `size-4`);
    ยังใช้ `showCloseButton={false}` กับ content ของ `ui/` (ปุ่มในตัวมีข้อความ "Close" — กฎ 3); focus/Escape/คืน focus ตามกฎ 11
77. (owner — h1) ทุก `<h1` ใน `src/**` ยกเว้น `modules/home/components/hero` มี className ด้าน typography **เท่านี้**: `text-3xl font-semibold tracking-tight` (+ สี `text-foreground` และ layout ภายนอกได้;
    ไม่มี `uppercase`, `text-[…]`, `text-{xs…2xl}`, `leading-*`, `font-{normal,medium,bold}`) → computed ทุกหน้า font-size 32px (`--text-3xl` ของ theme = 2rem), font-weight 600, letter-spacing และ line-height เท่ากันทุกหน้า,
    `text-transform: none`; `<h1>` ที่เดิมไม่มี class (เช่น `store-page-title`) ใส่ class เดียวกัน; หัวข้อระดับอื่น (h2/h3) ไม่อยู่ในขอบเขต
78. testid/ข้อความ/baseline/e2e: testid เดิมคงที่บน element ที่ทำหน้าที่เดิม (ยกเว้นที่กฎ 70/71 ลบ); `e2e/support/sfui-baseline.json` แก้ได้**เฉพาะ**: ลบ testid `shipping-country-select`, `billing-country-select`, `country-select`,
    `billing-country-code-select`, `address-province-country` และข้อความ `เลือกประเทศ` (20b/20c), ข้อความ `MISSING_ADDRESS_MESSAGE` เป็นค่าใหม่ของกฎ 69 (20a); e2e เดิมแก้ได้เฉพาะไฟล์ที่ task ระบุในตาราง Tasks
    และเฉพาะ (i) ค่าที่คาดของขนาด/ฟอนต์ที่รอบนี้ตั้งใจเปลี่ยน (`sfui-3d-payment`, `core-79`, `core-90`, `sfui-9a..9e-font`, `sfui-5b-catalog`, `sfui-5c-checkout-heading`, `sfui-6-parity` ถ้าเกี่ยว; ของ error ตามกฎ 74 (SFUI-21d): `sfui-9c-font.spec.ts:99-101` (`address-error-message`)
    และ `sfui-9a-font.spec.ts:155-157` (`cart-item-remove-error`) — เฉพาะค่าที่คาดของฟอนต์ ที่ grep `font(`/`getComputedStyle`/`toHaveCSS` บน testid ในตารางกฎ 74c พบ ณ `523056bb`),
    (ii) ลบบรรทัดเลือก/ตรวจประเทศ (20b), (iii) เพิ่มบรรทัดกรอกจังหวัด + fixture API ที่อยู่ที่บันทึกไว้เติม `province` (20a — เพิ่มอย่างเดียว), (iv) ตัวโต้ตอบที่ element เปลี่ยนชนิด (checkbox ตัวกรอง, chip, แบ่งหน้า, การ์ดตัวเลือกจัดส่ง/ชำระเงินที่ข้อความย้ายออกจาก `RadioGroupItem` ไปอยู่ใน `FieldLabel` — กฎ 80)
    โดย assertion ผลทางธุรกิจคงเดิม
79. ปิดรอบ (SFUI-22): ไม่มี JSX `<button` ใน `src/modules/**`, `src/app/**` (ไม่ใช่ test) นอก allow-list ใน guard (ไฟล์ + testid + เหตุผล — เช่น trigger ของ Radix ที่ใช้ `asChild` ไม่ได้);
    ปุ่มที่ไม่อยู่ใต้กฎขนาด (**รายการปิด**): `RadioGroupItem`, `Checkbox`, `AccordionTrigger`, `SelectTrigger`, `ToggleGroupItem` (36px โดย default อยู่แล้ว), `SheetTrigger` ของ `nav-menu-button`, การ์ด `add-address-button`,
    `[data-slot="input-group-addon"] [data-size="icon-xs"]`; ถ้า SFUI-22 พบปุ่มอื่นที่ไม่ใช่ 36px หรือ `<button` ดิบที่ไม่อยู่ใน allow-list → **หยุดรายงาน planner** (ไม่เพิ่มรายการยกเว้น/allow-list เอง)
80. (owner 2026-11-28 — Q-R50-1 = ทำรอบนี้) การ์ดตัวเลือกจัดส่ง (`checkout/components/shipping/index.tsx` 3 จุดที่ใช้ `OPTION_CLASS`) และชำระเงิน (`checkout/components/payment-container/index.tsx` ทั้ง `PaymentContainer`
    และ `StripePaymentContainer`) ใช้**โครงเดียวกัน = pattern "Choice Card" ของ docs shadcn (`field` + `radio-group`)**: ภายใน `RadioGroup` เดิม → `FieldLabel htmlFor={id}` → `Field orientation="horizontal"`
    → `FieldContent` (`FieldTitle` = ชื่อวิธี/ตัวเลือก, `FieldDescription` = ราคา/รายละเอียด หรือ icon ของวิธีชำระ) → `RadioGroupItem value id` (indicator ของ shadcn — **เลิก** `OptionDot`/การซ่อน
    `[data-slot=radio-group-indicator]` และ className ที่ทำให้ `RadioGroupItem` เต็มการ์ด); กรอบ/สีเมื่อเลือกมาจาก `FieldLabel` ของ `ui/field` (`has-data-[state=checked]:border-primary bg-primary/5`) —
    ลบ `OPTION_CLASS` และกรอบของ container ใน `payment-container`; **testid และ attribute ที่ e2e อ่าน (`delivery-option-radio`, `payment-option-<id>`, `data-option-id`, `data-provider`, `aria-disabled`, `aria-checked`)
    คงอยู่บน `RadioGroupItem`** (`role="radio"` — กฎ 9); ช่องกรอกบัตร/QR (children ของ `PaymentContainer`) render **ถัดจาก `FieldLabel` นอก label** ใน wrapper `flex flex-col gap-2` ของรายการนั้น
    (ไม่มี iframe ของ Stripe ใน `<label>`); คลิกที่ใดก็ได้ในการ์ด (label) เลือกตัวเลือก, ลูกศรเปลี่ยนตัวเลือก (กฎ 12), disabled คงพฤติกรรมเดิม; ไม่ใส่ className ที่เปลี่ยนสไตล์ของ part ใน `ui/field`/`ui/radio-group`
    (ระยะห่างระหว่างการ์ด `gap-*` ของ container ได้)

### Acceptance criteria (ต่อจาก AC-54)
- AC-55 (SFUI-19a, กฎ 59, 62) static ใหม่ `e2e/sfui-19-button-size.unit.spec.ts` (แทน `sfui-button-lg.unit.spec.ts` ที่ถูกลบ): parse TSX ของ `src/modules/**`, `src/app/**`, `src/components/*.tsx` (นอก `ui/`) —
  ทุก JSX `<Button`/`<…Close asChild><Button` และ call `buttonVariants(...)` มี `size` ไม่มี/`"default"`/`"icon"`; className (string literal, template, `cn(...)` ที่ครอบ) ไม่มี token ขนาดของกฎ 59;
  `<InputGroupButton` มี `size="icon-xs"` และเป็นลูกของ `InputGroupAddon`; positive/negative control ในไฟล์ (เช่น `<Button size="lg">`, `<Button className="h-12">`, `buttonVariants({ size: "sm" })`, `<Button className="md:h-10">` → ผิด;
  `<Button className="w-full mt-4">`, `<Button size="icon" aria-label="ลบ">` → ผ่าน); `globals.css` ไม่มี `contrast-btn`; ไฟล์ `e2e/sfui-button-lg.unit.spec.ts` ไม่มีแล้ว
- AC-56 (SFUI-19a, กฎ 58–59) e2e ใหม่ `e2e/sfui-19-button-size.spec.ts`: Given viewport `1280×800` และ `390×844` บนชุดหน้า P (หน้าแรก, `/store`, PDP, `/cart` มีสินค้า, cart dropdown เปิด, checkout `step=address|delivery|payment|review`,
  `/account` overview/profile (เปิด `edit-panel`)/addresses (เปิด modal เพิ่ม/แก้)/orders/order details, order confirmed, หน้าจ่าย order ค้างจ่าย, `/g/<token>`, `/account/vouchers` ที่มี voucher, หน้าคืนเงินแล้วไปตะกร้าถ้าสร้างได้ใน test)
  When อ่านทุก element ที่มองเห็นและตรง `[data-slot="button"]` **ยกเว้น `[data-slot="input-group-addon"] [data-size="icon-xs"]`** (ข้อยกเว้นของกฎ 59 — `<t>-toggle` ของช่องรหัสผ่าน, `store-search-clear`;
  ตรวจแยกว่าเป็น 24×24) Then `getComputedStyle(el).height` = `36px` และ `data-size="icon"` → width = `36px` ด้วย; และ testid ของตาราง inventory ข้อ 1–12 ที่อยู่ในหน้าสูง 36px (±0.5)
- AC-57 (SFUI-19a, กฎ 61) e2e (Stripe test จริง — CI มี secret): แก้ `sfui-3d-payment.spec.ts` step D-1 → `submit-payment-button` สูง 36px และหลัง `fillCard` (บัตร `4242…`) `elementFromPoint` ที่จุดกลางของปุ่มคือปุ่ม/ลูกของปุ่ม,
  คลิกแล้ว URL มี `step=review`; ใหม่ (ใน `sfui-19-button-size.spec.ts`): บัตร 3DS (`4000 0027 6000 3184`) → กด `submit-order-button` → challenge → คำสั่งซื้อสำเร็จ; พร้อมเพย์ → กดปุ่มของพร้อมเพย์แล้ว QR แสดง;
  e2e เดิมที่จ่ายผ่าน `support/stripe.ts` ผ่านโดยไม่แก้ assertion (CI ชุดเต็ม) — `support/stripe.ts` เพิ่ม `waitUntilHittable` (scroll แล้วรอ `elementFromPoint` ที่จุดกลางเป็นปุ่ม + boundingBox นิ่ง ก่อนคลิกครั้งเดียว ไม่ retry click) ใน `continueToReview` (review SFUI-19a: ปุ่ม 36px ทำให้คลิกที่ Playwright ส่งทันทีหลัง scroll ถูก hit-test กับตำแหน่งเดิมของ iframe Stripe — จังหวะ automation ไม่ใช่ปุ่มถูกบัง)
- AC-58 (SFUI-19b, กฎ 60, 63b) e2e: แก้ `core-79-login-link-mobile.spec.ts` และ `core-90-auth-toggle.spec.ts` เฉพาะเกณฑ์ขนาด → ที่ 375×812 `register-login-link`, `login-to-register-button`, `register-to-login-button`
  มี `data-slot="button"`, `data-variant="link"`, สูง 36px; พฤติกรรมเดิมผ่าน (เติมอีเมลในฟอร์ม login, `register-button` บนหน้า login = 0 ตัว)
- AC-59 (SFUI-19b, กฎ 60) e2e ใหม่ (ใน `sfui-19-button-size.spec.ts`): ข้อ 14–20 ของตาราง — `order-return-button` เป็น `<a>` ที่มี `data-slot="button"` `data-variant="outline"` (Tab หยุด 1 ครั้ง);
  `edit-address-button`/`edit-delivery-button`/`edit-payment-button`/`add-discount-button` `data-variant="link"`; `address-edit-button`/`address-delete-button`/`logout-button`/`affiliate-logout` `data-variant="ghost"` และ
  `logout-button` กับ `affiliate-logout` มี computed `height`/`padding`/`font-size`/`color` เท่ากัน; `product-delete-button`/`cart-item-remove-button`/`open-order-button` `data-size="icon"` 36×36 มี `aria-label` ไทย;
  ทุกตัวสูง 36px; e2e เดิมที่กดปุ่มเหล่านี้ผ่านโดยไม่แก้
- AC-60 (SFUI-19c, กฎ 64–66) (1) static: `src/components/ui/pagination.tsx` อยู่ใน `shadcn-ui.json` (AC-19 ผ่าน), `--dry-run --diff` ของ `pagination` และ `button` = "No changes." (บันทึกใน PR); `sfui-13-form-guard` ผ่านตามกฎ 65d;
  (2) e2e ใหม่ `e2e/sfui-19c-search-pagination.spec.ts`: `search-query-input` `data-slot="input"` สูง 36px และ `search-submit` `data-slot="button"` สูง 36px; ปิด JS แล้วกรอก + submit → URL `/th/search?q=<คำ>`;
  `store-search-input` อยู่ใน `[data-slot="input-group"]` สูง 36px, พิมพ์แล้ว `store-search-clear` (`InputGroupButton` render `ui/button` → DOM มี `data-slot="button"` + `data-size="icon-xs"`
  และอยู่ภายใน `[data-slot="input-group-addon"]`, `aria-label` = `ล้างคำค้นหา`) กดแล้วช่องว่าง;
  `product-pagination` เป็น `nav` `aria-label="แบ่งหน้า"`, ลิงก์หน้า 36×36 มี `href` ของหน้านั้น, หน้าปัจจุบัน `aria-current="page"`, กด `หน้า 2` → ผลลัพธ์ชุดใหม่และ URL มีหน้า 2; แบ่งหน้าของ `/account/orders` กดหน้า 2 → `?page=2`;
  ไม่มีข้อความ `Previous`/`Next`/`More pages`/`pagination` ใน `textContent`/`aria-label` ของหน้า
- AC-61 (SFUI-19d, กฎ 64, 67–68) (1) static: `toggle.tsx`, `toggle-group.tsx` ใน `shadcn-ui.json`; allow-list ของ `sfui-13-form-guard` ไม่มีรายการ checkbox ของ `on-sale-toggle`/`refinement-group`; `AccordionTrigger` ในสองไฟล์ไม่มี className ขนาด;
  (2) e2e ใหม่ `e2e/sfui-19d-refinements.spec.ts` บน `/store`: `option-refinement` เป็น `[data-slot="toggle-group-item"]` สูง 36px, กดแล้ว `aria-pressed="true"` และรายการสินค้าถูกกรอง, กดซ้ำ → `false` และกลับครบ;
  `refinement-<attribute>`/`on-sale-toggle` เป็น `role="checkbox"` 16×16, คลิก label แล้ว `aria-checked="true"` และกรองจริง; `remove-refinement`/`clear-refinements` สูง 36px กดแล้วลบตัวกรอง;
  AccordionTrigger ของ PDP tabs และกลุ่มตัวเลือกใน store มี computed padding เท่ากัน; e2e เดิมของตัวกรอง (grep testid เหล่านี้) ผ่านโดยแก้ตามกฎ 78 (iv) เท่านั้น
- AC-62 (SFUI-20a, กฎ 69) unit: `address-required` — `province` ว่าง/ช่องว่างล้วน/zero-width → missing; `MISSING_ADDRESS_MESSAGE` ตรงตัวกับกฎ 69 (`error-message.test.ts`, `core-63-address-invisible.test.ts` ส่วนข้อความ);
  e2e (ใน `e2e/sfui-20-address.spec.ts` ใหม่): ทั้ง 5 ฟอร์ม ช่องจังหวัด `required` และ label มี `*`; ส่งโดยจังหวัดว่าง → `<t>-error` = `fieldErrorMessage` จาก label จริง ไม่ส่ง server action;
  จังหวัดเป็นช่องว่างล้วน → `address-error-message` (checkout) / `address-error` (modal ที่อยู่ในบัญชี) = `MISSING_ADDRESS_MESSAGE` ใหม่ (ค่าจาก import ไม่ hard-code) และ ≠ ข้อความ fallback; e2e เดิมที่กรอกที่อยู่ผ่านโดยเพิ่มบรรทัดกรอกจังหวัด
- AC-63 (SFUI-20b, กฎ 70) e2e (ใน `sfui-20-address.spec.ts`): ทั้ง 5 ฟอร์ม ไม่มี testid ประเทศเดิมและไม่มี `[role="combobox"]` ภายในฟอร์มที่ label/ชื่อเป็นประเทศ; มี `input[type="hidden"][name="<ชื่อเดิม>"][value="th"]`;
  checkout ส่งที่อยู่ → `cart.shipping_address.country_code` และ `billing_address.country_code` = `th` (API); modal เพิ่มที่อยู่ (เดิมขึ้น "กรุณาเลือกประเทศ") บันทึกสำเร็จ → ที่อยู่ใน `/store/customers/me/addresses` `country_code` = `th`;
  แก้ที่อยู่ + ที่อยู่ใบเสร็จของโปรไฟล์ → `th`; **ลูกค้าที่มีที่อยู่ที่บันทึกไว้ (สร้างผ่าน API, `country_code: "th"`) เลือกจาก `shipping-address-select` → trigger แสดงข้อความของที่อยู่นั้น
  (ข้อความของ trigger มี `address_1` ของที่อยู่นั้น และ trigger ไม่มี `data-placeholder`) ทั้งก่อนส่งและหลัง reload ที่ cart มีที่อยู่นั้นแล้ว** (กฎ 70 ทาง (ก));
  static: ไม่มีไดเรกทอรี/การ import `modules/checkout/components/country-select`; unit `address-required` มี `ADDRESS_COUNTRY_CODE === "th"`
- AC-64 (SFUI-20c, กฎ 71–72) unit `address-lines.test.ts`: คืน `[line]` ไม่มีรหัสประเทศ, ทุกช่องว่าง → `[]`; unit ใหม่ `side-menu` (render จริง): regions รวม 1 ประเทศ → ไม่มี `country-select-button`/`country-select-arrow`, 2 ประเทศ → มี;
  e2e (ใน `sfui-20-address.spec.ts`): สรุปที่อยู่ของ checkout review (`shipping-address-summary` + ใบเสร็จ), หน้าคำสั่งซื้อ, รายการ `shipping-address-select`, การ์ดที่อยู่, `current-info` ของที่อยู่ใบเสร็จ ไม่มีคำ `TH`/`Thailand`/`ประเทศไทย`
  (regex คำเต็ม) และไม่มี `address-province-country`; เมนูข้าง (seed มีไทยประเทศเดียว) ไม่มี `country-select-button`; แก้ `sfui-3b-sheet.spec.ts` ขั้นรายการประเทศ → ตรวจว่าไม่แสดง (กฎ 78 (ii))
- AC-65 (SFUI-21b, กฎ 77) (1) static ใหม่ใน `e2e/sfui-21-consistency.unit.spec.ts`: ทุก `<h1` ใน `src/**` (ไม่ใช่ test, ยกเว้น hero) มี token `text-3xl`, `font-semibold`, `tracking-tight` และไม่มี token typography อื่นของกฎ 77;
  (2) e2e ใหม่ `e2e/sfui-21-heading.spec.ts`: หน้าที่มี `h1` ในชุด P + login/register/verify/affiliate login/affiliate dashboard (payouts, earnings, profile, programs)/search/policy/404/categories/collections
  ที่ 1280 และ 390 — computed `font-size` = `32px`, `font-weight` = `600`, `text-transform` = `none`, `letter-spacing` และ `line-height` เท่ากันทุกหน้า; hero คงค่าเดิม (`sfui-5b-catalog` ข้อ hero ไม่แก้)
- AC-66 (SFUI-21a, กฎ 73, 75–76) (1) static (ใน `sfui-21-consistency.unit.spec.ts`): container ช่องของไฟล์ในข้อ 32 ไม่มี `gap-2`/`gap-y-`/`gap-x-`; `SelectTrigger` ใน `src/modules/**` ไม่มี className ขนาด;
  ปุ่มปิดในข้อ 35 เป็น `Button` ภายใต้ `DialogClose`/`SheetClose asChild`; (2) e2e ใหม่ `e2e/sfui-21-forms.spec.ts`: ทุกฟอร์มในตาราง inventory รอบ 48 (เปิด `edit-panel`/`Dialog` ก่อนวัด) container ของช่อง
  computed `row-gap` = `16px` (และ `column-gap` = `16px` ที่ ≥ 768px สำหรับคู่); `shipping-address-select` สูง 36px; ปุ่มปิด `close-modal-button`/`close-menu-button`/ปุ่มปิด search drawer/mobile actions สูงและกว้าง 36px,
  `aria-label` ไทย, `Escape` ยังปิด, focus กลับ trigger (กฎ 11)
- AC-67 (SFUI-22, กฎ 79) (1) static (ใน `sfui-21-consistency.unit.spec.ts`): ไม่มี JSX `<button` นอก allow-list ของกฎ 79; (2) e2e (ใน `sfui-19-button-size.spec.ts` ขยาย): ชุดหน้า P + หน้า login/register/store ที่ 1280 และ 390 —
  ทุก element ที่มองเห็นและตรง `button, a[data-slot="button"], [role="button"]` ที่ไม่อยู่ในรายการยกเว้นของกฎ 79 (รายการปิด — เจอนอกรายการ = หยุดแจ้ง planner ไม่เพิ่มเอง) สูง 36px (icon 36×36); (3) AC-5, AC-17, AC-19 ผ่าน
- AC-68 (ทุก task รอบ 50) reviewer: `git diff origin/develop --stat -- apps/backend apps/storefront/package.json pnpm-lock.yaml` ว่าง; `apps/storefront/src/components/ui` มีเฉพาะไฟล์ใหม่จาก CLI ของกฎ 64 (19c, 19d, 21d);
  `globals.css` เปลี่ยนเฉพาะการลบ `contrast-btn` (19a); `sfui-baseline.json` เปลี่ยนเฉพาะรายการกฎ 78; diff ของ e2e เดิมเป็นไปตามกฎ 78; e2e storefront ทั้งชุดผ่านใน CI
- AC-69 (SFUI-21c, กฎ 80) (1) static (ใน `sfui-21-consistency.unit.spec.ts`): `shipping/index.tsx` ไม่มี `OPTION_CLASS`; `payment-container/index.tsx` ไม่ import `OptionDot` และไม่มี `radio-group-indicator]:hidden`;
  ทุก `RadioGroupItem` ในสองไฟล์อยู่ภายใน `FieldLabel` → `Field orientation="horizontal"` และไม่มี className; (2) e2e ใหม่ `e2e/sfui-21c-choice-card.spec.ts` (checkout ที่มีตัวเลือกจัดส่ง ≥ 2 และวิธีชำระ ≥ 2, 1280 + 390):
  การ์ดของ `delivery-option-radio` และ `payment-option-<id>` (`[data-slot="field-label"]` ที่ครอบ) มี computed `border-width`, `border-radius`, `padding` ของ `[data-slot="field"]` เท่ากันทั้งสองขั้น;
  การ์ดที่เลือก `border-color` เท่ากันทั้งสองขั้นและต่างจากการ์ดที่ไม่เลือก; คลิกที่ `FieldTitle` ของการ์ด → `aria-checked="true"` บน testid ของการ์ดนั้น; ลูกศรเปลี่ยนตัวเลือก; Stripe Payment Element
  อยู่นอก `<label>` (`iframe.closest("label") === null`) และกรอกบัตร + `submit-payment-button` ไปขั้น review ได้ (Stripe test); e2e เดิมที่เลือกตัวเลือกจัดส่ง/ชำระเงิน (75 จุด/32 ไฟล์) ผ่านโดยแก้ตามกฎ 78 (iv) เท่านั้น
- AC-70 (SFUI-21d, กฎ 64, 74) (1) static (ใน `sfui-21-consistency.unit.spec.ts`): `src/components/ui/alert.tsx` ใน `shadcn-ui.json` (`--dry-run --diff` "No changes." ใน PR); ไม่มี `text-rose-` ใน `src/**`;
  `checkout/components/error-message/index.tsx` render `Alert variant="destructive"` + `AlertDescription`; testid แบบ (a) ของแถวที่เป็นของ 21d ในตารางกฎ 74c อยู่บน `<ErrorMessage` (หรือ `error-message` ของ `account-info` ที่ครอบ `ErrorMessage`)
  และแบบ (b) ของ 21d อยู่บน `<FieldError`; `cart/components/item/index.tsx` ไม่ import `ErrorMessage`;
  (2) unit `error-message` (render จริง): `error` ว่าง → ไม่ render; มีค่า → root `role="alert"`, `data-slot="alert"`, มี testid และ `id` ที่ส่งเข้า, `textContent` = ข้อความ;
  (3) e2e ใหม่ `e2e/sfui-21d-alert.spec.ts`: trigger error ระดับฟอร์มจริง (`address-error-message` ด้วยจังหวัดช่องว่างล้วน, `login-error-message` รหัสผิด, `register-email-exists` หรือ `register-error`, `promotion-error` โค้ดผิด,
  `address-error` ใน modal ที่อยู่, `error-message` ของ `account-info`) → testid (หรือลูก) เป็น `[data-slot="alert"]`, `role="alert"`, ข้อความเป็นไทยตามเดิม; `discount-input` `aria-describedby` ยังอ้าง id ของ `promotion-error` (กฎ 32d);
  inline: `product-error-message` (stock ไม่พอ — ตามแนว core-48) และ `cart-item-remove-error` (ลบไม่สำเร็จ — ตามแนว core-19c) เป็น `[data-slot="field-error"]` ไม่มี `[data-slot="alert"]`, computed `font-size` 14px
  และสีเท่า `FieldError`, ที่ 390px แถวตะกร้าไม่ล้นแนวนอนและ error ไม่ทับ element อื่นในแถว;
  e2e เดิมที่ตรวจ error เหล่านี้ (AC-33, core-19c, core-48 ฯลฯ) ผ่านโดยไม่แก้ **ยกเว้นค่าที่คาดของฟอนต์ตามกฎ 78 (i)** (`sfui-9c-font` ขั้น `address-error-message`, `sfui-9a-font` ขั้น `cart-item-remove-error`)
  — ถ้า core-19c (error ≤ 2 บรรทัด) ล้มเพราะตัวอักษร 14px → หยุดรายงาน planner; `review-flash-exceeds-customer-limit` (ตามแนว fs-21) และ `add-variant-error` (ตามแนว core-14d) เป็น `[data-slot="alert"]`
- AC-71 (SFUI-21e, กฎ 74) (1) static (ใน `sfui-21-consistency.unit.spec.ts`): testid แบบ (a) ของ 21e อยู่บน `<ErrorMessage` ยกเว้น `cart-error-notice` ที่อยู่บน `<Alert` (ไม่มี `variant="destructive"`); แบบ (b) ของ 21e อยู่บน `<FieldError`;
  ไม่มี element ใน `src/modules/**`/`src/app/**` (ไม่ใช่ test) ที่มีทั้ง `text-destructive` และ `data-testid` นอกแถว "ไม่รวม" ของตารางกฎ 74c; (2) e2e ใหม่ `e2e/sfui-21e-action-errors.spec.ts` (**นอก checkout**):
  PDP เลือกจำนวนเกิน stock แล้วกดเพิ่ม (ตามแนว core-24 qa D-1) → `add-to-cart-error` เป็น `[data-slot="alert"]` `role="alert"` ข้อความไทยเดิม; POST สร้างทีมตอบ 400 (ตามแนว group-buy-home-campaigns AC-48)
  → `group-create-team-error` เป็น `[data-slot="alert"]`; `/cart?error=<ค่าที่รู้จัก>` → `cart-error-notice` เป็น `[data-slot="alert"]` และ computed `color` เท่าสีข้อความปกติของหน้า (`body`) ไม่ใช่สี destructive;
  PDP flash เลือกเกิน remaining (ตามแนว flash-sale-fs15) → `flash-qty-exceeds-remaining` เป็น `[data-slot="field-error"]`; ที่ 390px PDP และแถวตะกร้าไม่ล้นแนวนอน;
  (3) e2e เดิมที่อ้าง testid ของ 21e (`core-24`, `flash-sale-fs15`, `flash-sale-fs19`, `fs-21`, `fs-23`, `group-buy-home-campaigns`, `group-buy-account-orders`, `pay-12`, `pay-18`) ผ่านโดยไม่แก้

### Test plan
| ชนิด | AC |
|---|---|
| static (`test:e2e:unit`) | AC-55, AC-60 (1), AC-61 (1), AC-63 (static), AC-65 (1), AC-66 (1), AC-67 (1), AC-69 (1), AC-70 (1), AC-71 (1) (+ AC-5, AC-19, AC-35 เดิม) |
| unit (Vitest + jsdom — render ของจริง ไม่ mock primitive) | AC-62 (unit), AC-63 (`ADDRESS_COUNTRY_CODE`), AC-64 (unit), AC-70 (2) |
| e2e (Playwright, prod build) | AC-56, AC-57 (Stripe test จริง), AC-58, AC-59, AC-60 (2), AC-61 (2), AC-62–AC-64 (e2e), AC-65 (2), AC-66 (2), AC-67 (2), AC-69 (2) (Stripe test), AC-70 (3), AC-71 (2)(3) + ชุดเดิม (กฎ 78) |
| reviewer | AC-68 |
- guard ขนาดปุ่ม (AC-55) **แทน** `sfui-button-lg.unit.spec.ts` (ลบใน 19a); ค่า 36px ใน e2e = ค่าที่วัดจาก `getComputedStyle` บน build ของ branch (กฎ 58)
- Stripe (AC-57): builder รันในเครื่องได้เมื่อมี key (`source ~/.zshrc` + `stripe listen` ตาม CLAUDE.md) ไม่มี key → ระบุว่ารอ CI; ห้ามข้าม step พิสูจน์ `elementFromPoint`
- payload ประเทศ (AC-63): ตรวจทั้ง hidden input ใน DOM และค่าใน API หลังส่ง (ไม่ใช่แค่ DOM)
- ข้อความ server (AC-62): ค่าที่คาด import จาก `src/lib/util/address-required.ts` และ assert ≠ ข้อความ fallback (บทเรียน CORE-83)
- qa ปลาย stack บน **browser จริง** (prod build 1280 + 390): ทุกปุ่ม 36px (icon 36×36), ฟอร์มที่อยู่ไม่มีช่องประเทศ, payload `country_code=th`, จังหวัดว่าง → error ใต้ช่อง + server ปฏิเสธด้วยข้อความใหม่, สรุปที่อยู่ไม่มีบรรทัดประเทศ,
  รายการ audit ในตาราง inventory ถูกแก้ครบ; หน้าตาที่เปลี่ยนเป็น default ของ shadcn ไม่ใช่ defect (กฎ 58) · evidence `docs/evidence/storefront-consistency/<TASK>/` (`REPORT.md` + ภาพ ≤ 5, PNG ≤ 300KB; 22 ไม่มี UI ใหม่ — ภาพรวมปลาย stack)
- builder รัน e2e **ทุก** spec ที่อ้างหน้า/testid ที่แตะ (grep ใน `apps/storefront/e2e/`) ก่อน push

### Tasks (รอบ 50)
เจ้าของไฟล์ร่วม (แก้ตามลำดับ stack — Depends ในตารางครอบทุกสายนี้แล้ว): ฟอร์มที่อยู่ add/edit address (19a → 19b → 20a → 20b → 20c → 21a → 21d), `checkout/components/shipping/index.tsx` (19a → 19b → 20c → 21c),
`checkout/components/payment/index.tsx` (19a → 19b), `payment-container` (21c เท่านั้น), `group-join.tsx` (19a → 20c → 21d), `login`/`register` (19b → 21b → 21a → 21d), `option-refinements.tsx` (19d เท่านั้น),
`checkout/components/error-message` + `returns/components/return-request-form` + `cart/components/item` (21d เท่านั้น), `common/components/delete-button` (19b → 21d), `account-info` (19a → 21d),
`sfui-9c-font.spec.ts` (21b → 21d), `e2e/sfui-13-form-guard.unit.spec.ts` (19c → 19d → 20b), `e2e/sfui-19-button-size.{spec,unit.spec}.ts` (19a → 19b → 22),
`e2e/sfui-20-address.spec.ts` (20a → 20b → 20c), `e2e/sfui-21-consistency.unit.spec.ts` (21b → 21a → 21c → 21d → 21e → 22), `product-actions/index.tsx` (19a → 21e), `mobile-actions.tsx` (21a → 21e), `sfui-baseline.json` (20a → 20b → 20c), `sfui-9a-font.spec.ts` (20b → 21b → 21d),
`shadcn-ui.json` (19c → 19d → 21d) · ไม่แตะ `apps/backend/**`, `package.json`/lockfile · LOC ไม่นับไฟล์ที่ CLI สร้างและ `shadcn-ui.json`

| Task | งาน — ไฟล์ที่เป็นเจ้าของ | AC | Depends | ∥ | LOC |
|---|---|---|---|---|---|
| SFUI-19a | ปุ่ม shadcn ที่ override ขนาด → default (inventory 1–13): ไฟล์ในข้อ 1–12 **+ ทุกจุดที่ guard AC-55 พบเพิ่ม** (ระบุใน PR; เกิน ~10 ไฟล์นอกตารางหยุดแจ้ง planner), `globals.css` (ลบ `contrast-btn`); ลบ `e2e/sfui-button-lg.unit.spec.ts`; ใหม่ `e2e/sfui-19-button-size.{unit.spec,spec}.ts`; แก้ `sfui-3d-payment.spec.ts` (D-1 → 36px + `elementFromPoint` หลัง `waitUntilHittable`), `e2e/support/stripe.ts` (เพิ่ม `waitUntilHittable` ใน `continueToReview` — ดู AC-57); หมายเหตุกฎ 20 แทนแล้ว | AC-55, AC-56, AC-57, AC-68 | PR เอกสารรอบ 50 (stack) | — | ~300 |
| SFUI-19b | ปุ่ม/ลิงก์ที่ไม่ใช่ shadcn — account/checkout/order (inventory 14–20): `order-details-template.tsx`, `account/components/{login,register,account-nav,overview}`, `address-card/edit-address-modal.tsx` (ข้อ 17), `checkout/components/{addresses,shipping,payment,discount-code}`, `common/components/delete-button`, `app/[countryCode]/(main)/affiliate/layout.tsx`; แก้ `core-79`, `core-90` ตาม AC-58; ขยาย `sfui-19-button-size.spec.ts` (AC-59) | AC-58, AC-59, AC-68 | SFUI-19a | ∥ 19c, 19d | ~280 |
| SFUI-19c | ค้นหา + แบ่งหน้า (inventory 21–23): `shadcn add pagination`; `search/components/search-form`, `store/components/store-search-box`, `store/components/store-hits/pagination.tsx`, `store/components/pagination/index.tsx`; `sfui-13-form-guard` (กฎ 65d); e2e เดิม `core-68`, `core-78`, `core-92` (เลขหน้าเป็นลิงก์ — กฎ 78 (iv)), `sfui-5b-catalog` (ค่าฟอนต์/icon ของ `store-search-input` — กฎ 78 (i)); unit `src/core-92-overview-pagination.test.ts`; ใหม่ `e2e/sfui-19c-search-pagination.spec.ts` | AC-60, AC-68 | SFUI-19a | ∥ 19b | ~280 |
| SFUI-19d | ตัวกรอง store + accordion (inventory 24–27): `shadcn add toggle-group`; `store/components/store-refinements/{option-refinements,current-refinements,refinement-group,on-sale-toggle}.tsx`, `store/components/refinement-list/options-picker/index.tsx`, `products/components/product-tabs/accordion.tsx`; `sfui-13-form-guard` (allow-list checkbox), `sfui-legacy.unit.spec.ts` (AC-16 นับ CSS variable ที่ `ui/toggle-group.tsx` ของ CLI ตั้งใน inline style ว่ามีนิยาม); ใหม่ `e2e/sfui-19d-refinements.spec.ts`; e2e เดิมของตัวกรองตามกฎ 78 (iv) | AC-61, AC-68 | SFUI-19c (`sfui-13-form-guard`, `shadcn-ui.json`) | ∥ 19b | ~330 |
| SFUI-20a | จังหวัดบังคับ (inventory 28, กฎ 69): `required` ใน 5 ฟอร์ม, `lib/util/address-required.ts` (+ `ADDRESS_COUNTRY_CODE` สำหรับ 20b), unit `address-required.test.ts`, `error-message.test.ts`, `core-63-address-invisible.test.ts`; `sfui-baseline.json` (ข้อความ); **เพิ่มบรรทัดกรอกจังหวัด** ใน e2e/`support/stripe.ts`/`support/medusa.ts`/`support/group-buy.ts` + fixture API (~15 ไฟล์ — เพิ่มอย่างเดียว); ตาราง AC-37 ของ `sfui-12a/12b` และตาราง AC-28 ของ `sfui-11-form-field` (flag บังคับของจังหวัด); unit fixture เพิ่มบรรทัด `province` ใน `core-4g-checkout-polish`, `core-52-checkout-guards` (+ `REQUIRED` ในไฟล์), `ev-7c-digital-only-checkout`, `ev-7d-digital-only-totals`; `core-63-address-invisible` ย้าย province จาก test ช่องไม่บังคับไป test ช่องบังคับ; `cartReadyForPayment` ของ `support/medusa.ts` **ไม่เติม** province (AC-51 ของ sfui-18 ใช้ที่อยู่เดิมที่ไม่มีจังหวัด) และ `support/group-buy.ts` เพิ่มแค่ type; ใหม่ `e2e/sfui-20-address.spec.ts` (ส่วน AC-62) | AC-62, AC-68 | SFUI-19b | — | ~300 |
| SFUI-20b | ซ่อนประเทศ (inventory 29, กฎ 70): 5 ฟอร์ม (hidden `th`), ลบ `checkout/components/country-select/`, unit `core-52-address-form-state.test.ts`/`checkout-thai-polish.test.ts` (ส่วน CountrySelect), `sfui-11-form-field.unit.spec.ts` (AC-26 (c)), `sfui-13-form-guard` (ตัวนับ/`CountrySelect`); `sfui-baseline.json` (testid/ข้อความประเทศ); e2e ~25 ไฟล์ที่เลือก/ตรวจประเทศ (ลบบรรทัด — กฎ 78 (ii)) รวม `support/stripe.ts`; ขั้นมือถือ checkout ของ AC-49 ใน `sfui-16-select.spec.ts` ย้ายไป `shipping-address-select` (ข้อยกเว้นเดียวของกฎ 78 (ii)); state ประเทศของ checkout = `ADDRESS_COUNTRY_CODE` คงที่ (กฎ 70 ทาง (ก) — ไม่แก้ `compare-addresses`); ส่วน AC-63 ของ `sfui-20-address.spec.ts` (รวมการจับคู่ `shipping-address-select`); **`checkout/components/address-select` (inventory 34 ย้ายมาจาก 21a — 2026-11-28: AC-49 ที่ย้ายมาใช้ `shipping-address-select` เผยว่ารายการล้นจอ 390 → `SelectTrigger` default + `SelectContent` กว้างเท่า trigger `w-(--radix-select-trigger-width)` ให้ข้อความที่อยู่ตัดบรรทัดในจอ)**; ไฟล์ test เดิมที่ต้องลบบรรทัด/ขั้นของประเทศเพิ่ม: `core-4g-checkout-polish`, `core-4j-checkout-discount-address`, `sfui-9a-font`, `sfui-11b-field-errors`, `core-4g-e2e-hygiene.unit` (เอา core-4g-checkout-polish ออกจากรายการรอ fonts), `sfui-12b-checkout-forms` (`SHIPPING_ORDER` 8 ช่อง) | AC-63, AC-68 | SFUI-20a, SFUI-19d (`sfui-13-form-guard`) — แตกจาก branch ที่รวมทั้งสอง | — | ~450 (owner รับ 2026-11-28) — เกินเพดานเพราะส่วนใหญ่เป็นการ**ลบ** (`CountrySelect` ~125, unit ~80, บรรทัด e2e ~150 ผ่าน helper); แยกไม่ได้เพราะเอาช่องออกแล้ว e2e ที่เลือกประเทศล้มทันที; เกิน ~550 หยุดแจ้ง planner |
| SFUI-20c | สรุปที่อยู่ไม่มีประเทศ + ตัวเลือก region (inventory 30–31, กฎ 71–72): `lib/util/address-lines.{ts,test.ts}`, ผู้ใช้ 7 ไฟล์ของกฎ 57, `layout/components/side-menu/index.tsx`, `layout/components/country-select/index.tsx` (ถอด override); unit ใหม่ `side-menu` (multi-country); `sfui-baseline.json` (`address-province-country`); แก้ `sfui-3b-sheet.spec.ts` + e2e ที่ assert บรรทัดประเทศ (grep `address-summary`, `address-province-country`); ส่วน AC-64 ของ `sfui-20-address.spec.ts`; `sfui-3c-select.spec.ts` (ตัวเลือกประเทศใน side menu → ตรวจว่าไม่แสดง; กรณีหลายประเทศครอบด้วย unit `side-menu`); nit จาก review 20b: ลบ prop `region`/`addresses` ที่ไม่ใช้ใน `address-card/{add-address,edit-address-modal}.tsx` + ผู้เรียก `account/components/address-book/index.tsx`, คอมเมนต์ใน `src/checkout-thai-polish.test.ts` | AC-64, AC-68 | SFUI-20b | — | ~220 |
| SFUI-21b | `h1` ขนาดเดียว (inventory 36, กฎ 77): `<h1` 27 ไฟล์; ใหม่ `e2e/sfui-21-consistency.unit.spec.ts` (AC-65 (1)), `e2e/sfui-21-heading.spec.ts`; แก้ค่าที่คาดของ `h1` ใน `sfui-9a..9e-font`, `sfui-5c-checkout-heading` (กฎ 78 (i)) ; `sfui-5b-catalog` ค่าที่คาด line-height ของ `product-title` (h1 PDP) 40px → 48px ตามกฎ 78 (i) (CI #632 พบ); review 20c: ลบ prop `region`/`regions` ที่ไม่ใช้จาก `account/components/address-book` + `profile-billing-address` และหยุดส่งจาก `account/@dashboard/{addresses,profile}/page.tsx` | AC-65, AC-68 | SFUI-19b, SFUI-20b (`sfui-9a-font`) | ∥ 20c | ~300 |
| SFUI-21a | ฟอร์ม consistency (inventory 32, 34, 35 — กฎ 73, 75–76): gap ในไฟล์ข้อ 32, ~~`checkout/components/address-select` (ข้อ 34)~~ (ย้ายไป SFUI-20b), ปุ่มปิด overlay ข้อ 35 (`add-address`, `edit-address-modal`, `side-menu`, `search/drawer.tsx`, `mobile-actions.tsx`); ขยาย `sfui-21-consistency.unit.spec.ts` (AC-66 (1)); ใหม่ `e2e/sfui-21-forms.spec.ts` | AC-66, AC-68 | SFUI-20c, SFUI-21b | — | ~230 |
| SFUI-21c | การ์ดตัวเลือกจัดส่ง/ชำระเงิน = Choice Card ของ shadcn (inventory 37, กฎ 80 — owner Q-R50-1): `checkout/components/shipping/index.tsx` (3 จุด `OPTION_CLASS`), `checkout/components/payment-container/index.tsx` (ลบ `OptionDot` ถ้าไม่มีผู้ใช้อื่น); ขยาย `sfui-21-consistency.unit.spec.ts` (AC-69 (1)); ใหม่ `e2e/sfui-21c-choice-card.spec.ts`; e2e เดิมที่อ่านข้อความในตัวเลือกตามกฎ 78 (iv) ; ไฟล์เดิมที่ต้องแก้: e2e `core-57-cart-totals`, `thai-ui-checkout` (อ่านข้อความตัวเลือกที่ label ของการ์ด — กฎ 78 (iv)), `sfui-9c-font` (locator `FieldTitle`/การ์ด + ค่าฟอนต์ default ของ `ui/field` — กฎ 78 (i)+(iv)); unit `src/sfui-3e-shipping-radio.test.ts`, `src/pay-16-payment-container.test.ts`; ถอด `className="block"` ของ `RadioGroup` ใน `checkout/components/payment/index.tsx`, `order/components/order-pay/index.tsx`; ลบ `common/components/option-dot` และ wrapper `src/components/radio-group.tsx` (ไม่มีผู้ใช้ — review 21c) + describe ใน `src/components/wrappers.test.tsx` และรายการใน `e2e/sfui-15-select.unit.spec.ts` | AC-69, AC-68 | SFUI-21a (`sfui-21-consistency`; ได้ 20c ของ `shipping/index.tsx` มาด้วย) | — | ~280 |
| SFUI-21d | error ระดับฟอร์ม = `Alert`, inline = `FieldError` (inventory 33, กฎ 74 — owner Q-R50-2 ทาง (ข)): `shadcn add alert`; `checkout/components/error-message/index.tsx` + unit ใหม่; จุด hard-code ระดับฟอร์ม (`add-address`, `edit-address-modal`, `register`, `returns/components/return-request-form`, `group-join.tsx` `group-join-error`, `account/components/account-info` `error-message`) → `ErrorMessage`; `checkout/components/review/index.tsx` `review-flash-exceeds-customer-limit`, `account/components/add-variant-error` → `ErrorMessage`; inline (`cart/components/item/index.tsx` `product-error-message`, `group-join.tsx` `group-units-limit`, `common/components/delete-button` `cart-item-remove-error`) → `FieldError`; ค่าฟอนต์ของ error ใน `sfui-9c-font.spec.ts` และ `sfui-9a-font.spec.ts` (กฎ 78 (i)); ขยาย `sfui-21-consistency.unit.spec.ts` (AC-70 (1)); ใหม่ `e2e/sfui-21d-alert.spec.ts` | AC-70, AC-68 | SFUI-21c (`sfui-21-consistency`; ได้ 19d ของ `shadcn-ui.json`, 19b ของ `delete-button`, 21a ของฟอร์มที่อยู่/register, 20c ของ `group-join`, 21b ของ `sfui-9a-font` มาด้วย) | — | ~360 |
| SFUI-21e | error ของการกระทำ/ข้อความผูกตัวเลือกนอก checkout (ตารางกฎ 74c แถว 21e): `products/components/product-actions/{index,mobile-actions}.tsx` (`add-to-cart-error`, `mobile-add-to-cart-error` → `ErrorMessage`), `home/components/campaigns/create-team-button.tsx` (`ErrorMessage`), `cart/components/cart-error-notice` (`Alert` variant default), `products/components/flash-sale/{qty-exceeds-remaining,customer-limit}.tsx`, `cart/components/flash-exceeds-remaining`, `group-buy/components/account-group-orders/leave-button.tsx` (→ `FieldError`); ขยาย `sfui-21-consistency.unit.spec.ts` (AC-71 (1)); ใหม่ `e2e/sfui-21e-action-errors.spec.ts` | AC-71, AC-68 | SFUI-21d (`sfui-21-consistency`, `ErrorMessage`/`alert`; ได้ 19a ของ `product-actions` และ 21a ของ `mobile-actions` มาด้วย) | — | ~220 |
| SFUI-22 | ปิดรอบ: guard `<button` ดิบ + allow-list (กฎ 79 — เจอนอกรายการหยุดแจ้ง planner) ใน `sfui-21-consistency.unit.spec.ts`; ขยาย `sfui-19-button-size.spec.ts` (AC-67 (2)); ติ๊ก AC-55–71 + Status ของส่วนนี้; ROADMAP; อัปเดต body #603 (session หลัก) | AC-67, AC-68 | SFUI-21e | — | ~150 |

ลำดับ: 19a → (19b ∥ (19c → 19d)) → 20a (หลัง 19b) → 20b (หลัง 20a + 19d) → 20c · 21b (หลัง 19b + 20b) ∥ 20c → 21a (หลัง 20c + 21b) → 21c → 21d → 21e → 22
· merge จริงทีละตัว: 19a → 19b → 19c → 19d → 20a → 20b → 20c → 21b → 21a → 21c → 21d → 21e → 22 (sync `origin/develop` + CI เขียวก่อนแต่ละตัว; แต่ละ PR เขียวได้เอง — 20a เพิ่ม `required` พร้อมบรรทัดกรอกจังหวัดใน PR เดียว)
· **stack** แบบรอบ 44–49 (owner อนุญาตชุด SFUI): 19a แตกจาก branch เอกสาร `docs/storefront-r50-consistency`, task ที่มี Depends สองตัวแตกจาก branch ที่รวมทั้งสองแล้ว → เปิด PR ทั้งชุดตอนท้าย (base = `develop`)
· **release v0.4.0 (#603) พักจนรอบ 50 merge ครบ** (owner 2026-11-28)

### Open questions (รอบ 50)
- ~~Q-R50-1~~ = **ทำรอบนี้** (owner 2026-11-28): การ์ดจัดส่ง/ชำระเงินใช้โครงเดียวกัน = Choice Card ของ shadcn (กฎ 80, SFUI-21c)
- ~~Q-R50-2~~ = **ใช้ `Alert` ของ shadcn กับ error ระดับฟอร์ม** (owner 2026-11-28 — ทาง (ข)): ระดับฟอร์ม = `Alert variant="destructive"`, inline ในแถว/เซลล์ = `FieldError` (กฎ 74, SFUI-21d)
- SFUI-20b ~450 LOC — owner รับ (2026-11-28) · review #624 blocker 3 → กฎ 70 ทาง (ก) (`formData` เก็บ `ADDRESS_COUNTRY_CODE`)

## Open questions
- ~~ADR-032 D1–D5~~ ตัดสินแล้ว (owner 2026-11-27): **รับตามข้อเสนอ** — D1 = ก, D2 = ก (placeholder เฉพาะเบอร์โทร/รหัสไปรษณีย์), D3 = ก (`*` อย่างเดียว ไม่ใส่ "(ไม่บังคับ)"),
  D4 = ก, D5 = ก; ความสูงช่อง 36px ตาม default ของ shadcn; เพิ่มกติกาการจัดวาง (กฎ 37, AC-37) — breakpoint ตาม class มาตรฐานของ Tailwind: คู่ช่องตั้งแต่ `md:` (owner 2026-11-27)
- ~~Q3~~ ตัดสินแล้ว (owner 2026-11-27): ตามข้อเสนอ — ช่องค้นหา/ตัวกรอง/ตัวเลือกและจำนวนบน PDP/จำนวนในตะกร้า/ช่องจำนวนต่อแถวของ group buy ไม่อยู่ในขอบเขต (allow-list กฎ 26)
- ~~Q4~~ ตัดสินแล้ว (owner 2026-11-27): error จาก server ราย field **ไม่ทำรอบนี้** — backlog หลัง v0.4.0 (server action คืน `fieldErrors`)
- ~~Q5~~ ตัดสินแล้ว (owner 2026-11-27): ทำแบบ stack แบบรอบ 44–45 ได้
- ~~Q1~~ ตัดสินแล้ว (owner 2026-11-26): **ยอมรับ** browser ขั้นต่ำของ Tailwind v4 (Safari 16.4+, Chrome 111+, Firefox 128+)
- ~~Q2~~ ตัดสินแล้ว (owner 2026-11-26): **งด release `develop → main`** ระหว่าง SFUI-2 merge จนถึง SFUI-6 merge (ยกเว้น hotfix); ทำงานแบบ stack ได้ (ดูหัวข้อ Tasks)
