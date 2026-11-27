# 09 Storefront ใช้ shadcn/ui (Radix) บน Tailwind v4 (SFUI)
Status: accepted (owner 2026-11-26: ADR-030 accepted, Q1 = ยอมรับ, Q2 = งด release ระหว่าง SFUI-2..6) — **ทำงานแบบ stack ได้** (owner อนุญาต 2026-11-26 เป็นข้อยกเว้นของกติกา
"ห้ามแตก branch จาก PR ที่ยังไม่ merge" เฉพาะชุด SFUI): SFUI-1a แตกจาก branch เอกสาร `docs/SFUI-shadcn-adr-spec`, task ถัดไปแตกต่อจาก branch ของ task ที่อยู่ใน Depends
(task ขนานแตกจาก SFUI-2 ตัวเดียวกัน; SFUI-6 แตกจาก branch ที่รวม 3a..5e แล้ว) โดยไม่ต้องรอ PR merge → เปิด PR ทั้งชุดพร้อมกันตอนท้าย (base = `develop`) แล้ว merge ตามลำดับในตาราง Tasks
· SFUI-1a..7 ☑ (#565–#581); รอบ 45 เก็บกวาด (SFUI-8, 9a–9e, 10) ดูหัวข้อ "ส่วนเก็บกวาดหลัง SFUI-7" (owner 2026-11-26 "เก็บต่อเลย");
รอบ 48 ฟอร์ม (SFUI-11a..13, ADR-032 accepted 2026-11-27) ☑ (#605–#610; เอกสาร #604) ดูหัวข้อ "ส่วนฟอร์ม (รอบ 48)"
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
20. ตาราง map ของ shim (SFUI-5x, 3x): `Text` → `<p className="text-sm">` (หรือ `<span>`/`<div>` ตาม `as`); `Heading` h1/h2/h3 → `<hN className="text-3xl|text-2xl|text-xl font-semibold">`;
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
· SFUI-14 (defect จากทดสอบ manual 2026-11-28 — ขอบช่องกรอกตอน Chrome autofill) กำลังทำ · AC-38
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
    `NativeSelect`/`CountrySelect` คง option ว่าง disabled เดิม (`เลือกประเทศ` — AC-91); placeholder ไม่แทน label
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
  `getComputedStyle(control).height` ของ `email-input` = ค่าที่วัดบน build (คาด `36px`) และ `shipping-country-select` สูงเท่า `shipping-city-input` (±1px); ไม่มี label ที่ `translate` ≠ `none`; หน้า 390px ไม่ล้นแนวนอน (AC-17)
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
  Given checkout `step=address` ช่องว่าง When กด `submit-address-button` Then `shipping-first-name-input-error` และ `shipping-country-select-error` (`กรุณาเลือกประเทศ`) มองเห็น และ focus อยู่ที่ช่องแรกที่ผิด;
  When เลือกที่อยู่ที่บันทึกไว้ (`shipping-address-select`) Then error ของช่องที่ถูกเติมหาย (กฎ 32d); `affiliate-register-code` ที่ผิด `pattern` → error = `title` ของช่อง
- AC-33 (SFUI-11b, 12x, กฎ 32e–f, 33a) ☑ #606–#609 e2e เดิมของ error ระดับฟอร์มและการคงค่าหลัง error ผ่านโดยไม่แก้: `core-4f-auth-errors`, `core-4h-auth-reason`, `core-20d-return-window`, `core-23c-account-forms`, `core-52-checkout-guards`,
  `core-73-register-existing-email`, `core-79-login-link-mobile`, `core-40-discount-action-race`, `affiliate-portal*.spec.ts` และทุก spec ที่ grep พบ testid ในกฎ 32e
- AC-34 (SFUI-12a/12b/12c, กฎ 28–31, 33b) ☑ #607–#609 e2e ใหม่ `e2e/sfui-12<x>-*-forms.spec.ts` (12a `account`, 12b `checkout`, 12c `feature`): Given ทุกฟอร์มของ task ในตาราง inventory (เปิด `edit-panel`/`Dialog`/view ที่ซ่อนอยู่ก่อนวัด)
  Then ทุกช่องผ่านเกณฑ์เดียวกับ AC-28 และ placeholder = ค่าในตาราง (`toHaveAttribute`) หรือไม่มี attribute; 12a: ช่องเบอร์โทรของ `profile-phone`/`add-address`/`edit-address-modal`/`profile-billing-address` มี `type="tel"` และ `autocomplete="tel"`;
  12b: เมื่อกด `add-discount-button` → `discount-input-label` อยู่เหนือ `discount-input` และเมื่อ `promotion-error` แสดงขณะช่องเปิด `discount-input` มี `aria-describedby` ที่อ้าง id ของ `promotion-error`;
  12c: `return-item-quantity`/`return-item-reason` ทุกแถวมี label ของตัวเองที่ `labels[0]` ชี้ถูกแถว (id ไม่ซ้ำ), `group-quantity`/`group-address-select`/`group-shipping-option` มี label เหนือช่อง;
  ทุก `<select>` ของ task (12a `billing-country-code-select`, `country-select`; 12b `shipping-country-select`, `billing-country-select`; 12c ทุกตัวข้างต้น) มีรายการ `[value, ข้อความ, disabled]` ของ option
  เท่ากับที่วัดบน commit ฐาน (spec ผ่านบน commit ฐานด้วย — กฎ 31a; `group-shipping-option` มี option ว่าง disabled ตัวเดียว, `group-quantity`/`group-address-select` ไม่มี)
- AC-35 (SFUI-13, กฎ 26, 28) ☑ #610 static `e2e/sfui-13-form-guard.unit.spec.ts`: ทุก JSX `<input` (ยกเว้น `type="hidden"`), `<select`, `<textarea`, `<Input` ของ `@/components/ui/input` ใน `src/modules/**`, `src/app/**` (ไม่ใช่ test)
  อยู่ใน `common/components/{input,native-select,checkbox}` หรือตรงคู่ "ไฟล์ + element" ในตาราง allow-list ของกฎ 26 (test เก็บตารางเดียวกันเป็นค่าคงที่ — ระบุ testid/`type`/`name` ต่อไฟล์;
  ไฟล์ใน allow-list ที่มี element อื่นนอกจากที่ระบุ = ล้ม เช่น `<select>` ใน `group-join.tsx`); ไม่มีไฟล์ใดนอก `src/components/**` และ `common/components/input` import `@/components/ui/input`
  (`checkout/components/discount-code` ย้ายไป `common/components/input` ใน 12b); ทุก `<Input`/`<NativeSelect`/`<CountrySelect`/`<Checkbox` ของ `common/components` ในไฟล์ของตาราง inventory มี prop `label`
  (หรือค่าเริ่มต้นของ component — `CountrySelect` มี label เริ่มต้น `ประเทศ`)
- AC-36 (ทุก task รอบ 48, กฎ 36, 27) ☑ #605–#610 reviewer: `git diff origin/develop --stat -- apps/backend apps/storefront/package.json pnpm-lock.yaml apps/storefront/src/styles/globals.css` ว่าง, ไฟล์ใน `src/components/ui/` เป็นไฟล์ใหม่ของ CLI เท่านั้น
  (`--dry-run --diff` ได้ "No changes." — บันทึกใน PR), AC-5 (baseline testid/ข้อความไทย), AC-17 (390px), AC-19 ผ่าน; e2e storefront ทั้งชุดผ่านใน CI
- AC-37 (SFUI-12a, 12b, กฎ 37) ☑ #607, #608 (static ข้อ 3 #610) e2e — ใน `sfui-12a-account-forms.spec.ts` และ `sfui-12b-checkout-forms.spec.ts` (ทุกฟอร์มในตารางกฎ 37b ของ task; หาด้วย testid ของ control, เปิด `edit-panel`/`Dialog` ก่อนวัด):
  (1) Given viewport `375×812` When อ่าน `boundingBox` ของ **`[data-slot="field"]` ที่ครอบ control แต่ละตัว** (`page.getByTestId(t).locator("xpath=ancestor::*[@data-slot='field'][1]")` — ไม่ใช่ `<input>` เพราะ
      `InputGroupInput` เป็น `flex-1` ข้าง addon และ checkbox กว้าง 16px) Then เรียงตามลำดับ DOM แถวละช่อง: `Field` ถัดไป `top >=` `bottom` ของ `Field` ก่อนหน้า, ทุก `Field` `left` เท่ากัน (±1px)
      และกว้างเท่ากัน (±1px) — **ยกเว้นแถว checkbox** (`billing-address-checkbox`: ตรวจแค่ `left` และลำดับ ไม่ตรวจความกว้าง), `scrollWidth <= innerWidth`;
  (2) Given viewport `768×1024` และ `1280×800` Then ทุกคู่ในตารางกฎ 37b (`a`, `b` = กล่อง `[data-slot="field"]` แบบข้อ 1; ความสูงเทียบที่กล่อง control — `<select>`/`<input>`/`InputGroup`): `|a.top - b.top| <= 1`, `b.left >= a.right`, ความสูง control เท่ากัน (±1px) และ `<t>-label` ของทั้งคู่ `top` เท่ากัน (±1px); ช่องที่ไม่อยู่ในคู่ไม่มี control อื่นที่ `top` เท่ากัน;
  (3) Given viewport `767×1024` Then เหมือนข้อ (1) (ขอบ breakpoint `md`); static (ใน `sfui-13-form-guard.unit.spec.ts`): container ของช่องกรอกในไฟล์ของตาราง inventory ไม่มี variant breakpoint ของ starter
  (`2xsmall:`/`xsmall:`/`small:`/`medium:`/`large:`/`xlarge:`/`2xlarge:`) และไม่มี `grid-cols-2`/`grid-cols-[…]` ที่ไม่มี prefix `md:` (ยกเว้น container ระดับฟอร์มที่ระบุใน "ไม่มีคู่" ของตาราง)
- AC-38 (SFUI-14, กฎ 38) e2e ใหม่ `e2e/sfui-14-autofill-border.spec.ts` (Chromium เต็ม — `channel: "chromium"`): (1) Given `/<cc>/account` (login) When จำลอง cascade ของ `:-webkit-autofill` บน `email-input`/`password-input`
  (สำเนากฎ autofill ทุกข้อใน layer และตำแหน่งเดิม แทน pseudo-class ด้วย attribute selector specificity เท่ากัน — Chrome autofill ช่องรหัสผ่านผ่าน CDP ไม่ได้) Then ขอบทั้งสี่ด้าน (ความกว้าง + สี) ของ
  `[data-slot=input-group-control]` (border-0) และ `Input` เท่าสถานะปกติ, computed `box-shadow` ของ `[data-slot=input-group-control]` และ `Input` เท่าสถานะปกติ (ไม่มีพื้นขาว inset ทับขอบ `InputGroup`),
  เมื่อโฟกัส: `box-shadow` ของ control และ ring ของ `InputGroup`/`Input` (spread 3px) เท่าตอนโฟกัสในสถานะปกติ; กฎ autofill ใน CSS ที่โหลดไม่มี property `border*`/`box-shadow` และยังมี `-webkit-text-fill-color` + `transition`;
  (2) Given ฟอร์ม register When Chrome autofill ที่อยู่จริงผ่าน CDP `Autofill.trigger` (ชื่อ/นามสกุล/อีเมล/เบอร์) Then ทุกช่องที่ `:-webkit-autofill` ขอบและ `box-shadow` เท่าสถานะปกติ, พื้น (`background-color`) alpha 0
  เท่าสถานะปกติ (ไม่เป็นสีฟ้าของ autofill) และเมื่อโฟกัส `email-input` ring เท่าตอนโฟกัสในสถานะปกติ

### Test plan
| ชนิด | AC |
|---|---|
| static (`test:e2e:unit`) | AC-26, AC-35 (+ AC-5, AC-19 เดิม) |
| unit (Vitest + jsdom) | AC-27, AC-30, AC-31 |
| e2e (Playwright) | AC-28, AC-29 (ที่แก้), AC-32, AC-33, AC-34, AC-37, AC-38 + ชุดเดิม (กฎ 27a) |
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
| SFUI-14 | defect owner 2026-11-28 (กฎ 38): `src/styles/globals.css` ลบ `border` และ `-webkit-box-shadow` ออกจากกฎ `:-webkit-autofill` ของ starter (คง text-fill + transition); e2e ใหม่ `sfui-14-autofill-border.spec.ts` | AC-38 | SFUI-11a | — | ~150 |

ลำดับ: SFUI-11a → SFUI-11b → (12a ∥ 12b ∥ 12c) → SFUI-13 · merge จริงตามลำดับนี้ทีละตัว (sync `origin/develop` + CI เขียวก่อนแต่ละตัว)
- **stack** (วิธีเดียวกับรอบ 44–45 — owner อนุญาต 2026-11-27, Q5): 11a แตกจาก branch เอกสาร `docs/storefront-form-fields`, 11b จาก 11a, 12a/12b/12c จาก 11b, 13 จาก branch ที่รวม 12a..12c → เปิด PR ทั้งชุดตอนท้าย (base = `develop`)
- ~~**release v0.4.0 (#603) พักจนรอบ 48 merge ครบ** (owner 2026-11-27) — ระหว่าง 11a merge ถึง 12c merge หน้าตาฟอร์มผสม จึงไม่ release กลางรอบ~~ สิ้นสุดแล้ว — merge ครบ 2026-11-27 (#605 → #610)
- ถ้า `shadcn@4.23.1 add field`/`input-group` ต้องการ dependency ใหม่ หรือ registry ต่างจากที่ ADR-032 บันทึก (`label`+`separator`, `button`+`input`+`textarea`) → หยุดแจ้ง planner

## Open questions
- ~~ADR-032 D1–D5~~ ตัดสินแล้ว (owner 2026-11-27): **รับตามข้อเสนอ** — D1 = ก, D2 = ก (placeholder เฉพาะเบอร์โทร/รหัสไปรษณีย์), D3 = ก (`*` อย่างเดียว ไม่ใส่ "(ไม่บังคับ)"),
  D4 = ก, D5 = ก; ความสูงช่อง 36px ตาม default ของ shadcn; เพิ่มกติกาการจัดวาง (กฎ 37, AC-37) — breakpoint ตาม class มาตรฐานของ Tailwind: คู่ช่องตั้งแต่ `md:` (owner 2026-11-27)
- ~~Q3~~ ตัดสินแล้ว (owner 2026-11-27): ตามข้อเสนอ — ช่องค้นหา/ตัวกรอง/ตัวเลือกและจำนวนบน PDP/จำนวนในตะกร้า/ช่องจำนวนต่อแถวของ group buy ไม่อยู่ในขอบเขต (allow-list กฎ 26)
- ~~Q4~~ ตัดสินแล้ว (owner 2026-11-27): error จาก server ราย field **ไม่ทำรอบนี้** — backlog หลัง v0.4.0 (server action คืน `fieldErrors`)
- ~~Q5~~ ตัดสินแล้ว (owner 2026-11-27): ทำแบบ stack แบบรอบ 44–45 ได้
- ~~Q1~~ ตัดสินแล้ว (owner 2026-11-26): **ยอมรับ** browser ขั้นต่ำของ Tailwind v4 (Safari 16.4+, Chrome 111+, Firefox 128+)
- ~~Q2~~ ตัดสินแล้ว (owner 2026-11-26): **งด release `develop → main`** ระหว่าง SFUI-2 merge จนถึง SFUI-6 merge (ยกเว้น hotfix); ทำงานแบบ stack ได้ (ดูหัวข้อ Tasks)
