# 09 Storefront ใช้ shadcn/ui (Radix) บน Tailwind v4 (SFUI)
Status: draft (รอ owner อนุมัติ ADR-030 — ห้ามเริ่ม task จนกว่า ADR-030 เป็น accepted และ PR เอกสารนี้ merge)
Goal (owner's words, 2026-11-26): เปลี่ยน storefront (`apps/storefront`) จาก UI ของ Medusa เป็น shadcn/ui (Radix) — แทนทั้ง 4 ชั้น (shim `common/components/ui`,
`@medusajs/ui-preset` + `thai-ui-preset.js` + class `txt-*`/`h*-webs`, `@medusajs/icons` → `lucide-react`, `@headlessui/react` → Radix ผ่าน shadcn) และถอด `tailwindcss-radix`;
อัป Tailwind v3 → v4 ก่อนแล้วใช้ shadcn CLI รุ่นล่าสุด; ยอมให้หน้าตาเปลี่ยนเป็นสไตล์ shadcn แต่ยังใช้สี brand ตาม ADR-008
Out of scope: admin (`apps/backend/src/admin` — ADR-018), เปลี่ยนพฤติกรรม/flow/ข้อความไทย/route ของร้าน, dark mode, i18n (ADR-014), icon SVG ที่ starter เขียนเองใน
`src/modules/common/icons/*`, สไตล์ภายใน Stripe Elements (appearance API), หน้าใหม่, เปลี่ยน `data-testid`

การตัดสินใจและเวอร์ชัน dependency: ADR-030 (proposed)

## What Medusa already gives us
| Need | Medusa provides | Use as-is / extend / custom |
|---|---|---|
| ชั้น commerce ของ storefront (route, data layer, JS SDK, cache, Stripe Elements) | Medusa Next.js Starter (ADR-002) | ใช้ตามเดิม — ไม่แตะ |
| design token + typography | `@medusajs/ui-preset` 2.22.1 — Tailwind **v3 เท่านั้น** (`peer tailwindcss ^3.4.3`) | **แทน** ด้วย token ของ shadcn ใน `@theme` (owner: อัป v4) — ชั้นเข้ากันได้ชั่วคราวระหว่างย้าย (กฎ 16) |
| component (Button, Input, Table ฯลฯ) | `@medusajs/ui` (ของ admin; starter ของเราใช้ shim ที่เขียนเองแทนอยู่แล้ว) | **แทน** shim ด้วย shadcn `button`, `input`, `label`, `badge`, `table`, `checkbox`, `radio-group`, `native-select` |
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
   `text-3xl` = 2rem, keyframes/animation `ring`, `fade-in-right`, `fade-in-top`, `fade-out-top`, `accordion-*`, `enter`, `leave`, `slide-in`) ย้ายเป็น `@theme` ชื่อ class เดิมใช้ได้;
   class เดิมใน `globals.css` ที่ถูก `@apply` (`text-xsmall-regular` … `text-3xl-semi`) เป็น `@utility`
2. `components.json` ตาม ADR-030 ข้อ 2 (style `new-york`, ติดตั้งด้วย `pnpm dlx shadcn@4.23.1 init -b radix`, `tailwind.config: ""`, `baseColor: "neutral"`, `iconLibrary: "lucide"`,
   aliases `@/components`, `@/components/ui`, `@/lib/utils`, `@/lib`, `@/hooks`); `tsconfig.json` มี `"@/*": ["*"]`; `src/lib/utils.ts` = `export { cn } from "cn"`
3. component ของ shadcn เพิ่มด้วย `pnpm dlx shadcn@4.23.1 add <name>` ลง `src/components/ui/` เท่านั้น และเฉพาะตัวที่ task ระบุ (ตาราง Tasks); แก้ไฟล์ที่ CLI สร้างได้เท่าที่จำเป็น
   พร้อม comment `// SFUI: <เหตุผล>`; ห้ามสร้างไฟล์ใน `src/components/ui/` ที่ไม่มาจาก registry ของ shadcn; task 2–5 ห้ามแก้ `package.json`/`pnpm-lock.yaml`
   (component ต้องการ dependency ใหม่ → หยุดรายงาน planner)
4. map primitive (ADR-030 ข้อ 5): modal ที่อยู่ → `Dialog`; side menu → `Sheet side="left"`, search drawer → `Sheet side="top"`, mobile actions → `Sheet side="bottom"`;
   cart dropdown → `Popover` (คงการเปิดเมื่อ hover/เพิ่มสินค้า และปิดตามเดิม); `layout/country-select`, `checkout/address-select` → `Select`; `account-info` → `Collapsible`;
   ตัวเลือกจัดส่ง/ชำระเงิน → `RadioGroup` + `RadioGroupItem`; filter/sort ของ store → `RadioGroup`; accordion/slider → `Accordion`/`Slider` ของ shadcn;
   `<select>` native ทุกตัว (`common/native-select`, จำนวนสินค้า, ประเทศในฟอร์มที่อยู่, คืนสินค้า, group buy) คงเป็น `<select>` (`native-select` ของ shadcn) — `selectOption` ใช้ได้เหมือนเดิม
5. `radix-ui`/`@radix-ui/*` ถูก import ได้เฉพาะใน `src/components/ui/**` — `src/modules/**`, `src/app/**`, `src/lib/**` import component จาก `@/components/ui/*`
6. icon มาจาก `lucide-react` เท่านั้น (ขนาดด้วย `size-*`): `ArrowUpRightMini`→`ArrowUpRight`, `ArrowRightMini`→`ArrowRight`, `ChevronDownMini`→`ChevronDown`,
   `ChevronUpDown`→`ChevronsUpDown`, `CheckCircleSolid`→`CircleCheck`, `XMark`/`XMarkMini`→`X`, `MagnifyingGlass`→`Search`, `Plus`→`Plus`, `PencilSquare`→`SquarePen`,
   `Trash`→`Trash2`, `Spinner`/`Loader`→`LoaderCircle` + `animate-spin`, `ExclamationCircleSolid`→`CircleAlert`, `EllipseMiniSolid`→`Circle` (`fill-current size-2`),
   `CreditCard`→`CreditCard`, `Scan`→`QrCode`, `ArrowRightOnRectangle`→`LogOut`; ปุ่มที่มีแต่ icon ต้องมีชื่อที่เข้าถึงได้เป็นภาษาไทยไม่น้อยกว่าเดิม
7. token (ADR-030 ข้อ 7): `@theme` มี `--color-brand` และ `--color-brand-50..900` ค่า hex เดิม (`DEFAULT #525252`, 50 `#FAFAFA` … 900 `#171717`) และ `--color-grey-0..90` เดิม;
   `:root` มี `--primary: var(--color-brand-900)`, `--primary-foreground: var(--color-brand-50)`, `--ring: var(--color-brand-400)`; token อื่นตาม `neutral`; ไม่มี selector `.dark`;
   โค้ดใหม่ไม่ใช้สี hex แบบ arbitrary (`[#…]`) ใน `className`
8. ฟอนต์: `--font-sans` ขึ้นต้นด้วย `var(--font-noto-sans-thai)`; `body` ใช้ `font-sans`; `src/app/layout.tsx` ยังโหลด `Noto_Sans_Thai` (`variable: "--font-noto-sans-thai"`) — แทนกฎ 14 ของ spec 01 (CORE-8)
9. `data-testid` ทุกค่าใน baseline (`e2e/support/sfui-baseline.json`, SFUI-1a) ต้องยังอยู่ใน `src/` และอยู่บน element ที่ e2e ใช้งานจริง:
   `DialogContent`/`SheetContent` (แทน `Dialog.Panel`), `SelectTrigger`/`SelectItem` (แทน `ListboxButton`/`ListboxOption`), `PopoverContent`/`PopoverTrigger`,
   `CollapsibleContent`, `RadioGroupItem` (ปุ่ม `role="radio"`); ใช้ `asChild` → testid อยู่ที่ลูก; attribute อื่นที่ e2e อ่านอยู่บน element เดียวกันตามเดิม
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
    `(text|bg|border|ring|divide|fill|stroke|placeholder|outline)-ui-*`, `shadow-(borders|elevation|buttons|details)-*`, `radix-state-*` ในไฟล์ที่ไม่ใช่ test;
    บังคับทีละไฟล์ด้วยรายการ `PENDING` แยก key ตาม task (AC-6) — task ต้องลบ key ของตัวเองใน PR เดียวกัน
16. ชั้นเข้ากันได้ `src/styles/legacy-medusa.css` (SFUI-1a): `@utility` ของ `txt-*`/`h*-webs` และ `@theme` ของ `--color-ui-*`/`--shadow-*` **เฉพาะชื่อที่ใช้จริงใน `src/`**
    ค่าคัดลอกจาก `@medusajs/ui-preset@2.22.1/dist/index.js` (light) font-family = `var(--font-sans)`; `@custom-variant radix-state-open/closed` (+ แบบ `group-`); ห้ามเพิ่มชื่อใหม่หลัง SFUI-1a;
    ลบทั้งไฟล์และ `@import` ใน SFUI-6
17. หน้าในรายการ AC-17 ที่ viewport 390×844 ไม่ล้นแนวนอน (`document.documentElement.scrollWidth <= window.innerWidth`)
18. admin ไม่ถูกแก้ (`git diff` ของ `apps/backend/**` ว่างในทุก task) และ e2e admin (`e2e/*admin*.spec.ts`) ไม่ถูกแก้
19. e2e storefront ที่มีอยู่ผ่าน **โดยไม่แก้ locator/assertion** ยกเว้น: `e2e/ui-preset-font.spec.ts` (เขียนใหม่ใน SFUI-1a — AC-3) — assertion CSS ที่มีอยู่ต้องผ่านตามเดิม
    (`line-through` ของ `flash-original-price`/`product-price`/`s`, `opacity: 1` ของ `mobile-actions` และ error ใน `core-23c`, `[aria-checked="true"], [checked]` = 0 ใน `core-32`)
20. ตาราง map ของ shim (SFUI-5x, 3x): `Text` → `<p className="text-sm">` (หรือ `<span>`/`<div>` ตาม `as`); `Heading` h1/h2/h3 → `<hN className="text-3xl|text-2xl|text-xl font-semibold">`;
    `Container` → `<div className="rounded-lg bg-card p-4">`; `Badge color` → shadcn `Badge` (`grey`→`secondary`, `red`→`destructive`, อื่น → `outline` + `bg-<สี>-100 text-<สี>-700`);
    `IconBadge` → `Badge variant="secondary"`; `IconButton` → `Button variant="ghost" size="icon"`; `Button` `primary|secondary|transparent` → `default|outline|ghost`,
    `small|medium|large` → `sm|default|lg`; `buttonClassName(o, c)` → `cn(buttonVariants(o), c)`; `clx` → `cn`; `Label`/`Input`/`Table.*` → shadcn ชื่อเดียวกัน
    (`Table.Header`→`TableHeader`, `.Body`→`TableBody`, `.Row`→`TableRow`, `.Head`/`.HeaderCell`→`TableHead`, `.Cell`→`TableCell`); `Button isLoading` → prop `isLoading` ที่เพิ่มใน
    `src/components/ui/button.tsx` (SFUI-2 — แสดง "กำลังดำเนินการ..." + disabled ตามเดิม)
21. map class (SFUI-5x, 3x): `txt-*xsmall*`→`text-xs`, `txt-*small*`/`txt-*medium*`→`text-sm`, `txt-*large*`→`text-base`, `txt-*xlarge*`→`text-lg`, `-plus`→`+ font-medium`, `compact`→`+ leading-5`;
    `h1-webs`→`text-6xl font-medium`, `h2-webs`→`text-5xl font-medium`, `h3-webs`→`text-4xl font-medium`; `text-ui-fg-base`→`text-foreground`, `text-ui-fg-subtle`/`-muted`→`text-muted-foreground`,
    `text-ui-fg-disabled`→`text-muted-foreground/60`, `text-ui-fg-interactive`→`text-primary underline-offset-4`, `text-ui-fg-error`→`text-destructive`, `text-ui-fg-on-color`/`-on-inverted`→`text-primary-foreground`,
    `bg-ui-bg-base`/`-field`→`bg-background`, `bg-ui-bg-subtle`/`-component`→`bg-muted`, `bg-ui-bg-interactive`→`bg-primary`, `bg-ui-bg-disabled`→`bg-muted opacity-50`,
    `border-ui-border-base`/`-strong`→`border-border`/`border-input`, `shadow-borders-*`→`border border-input` (+ `ring-[3px] ring-ring/50` แบบ focus), `shadow-elevation-*`→`shadow-sm`/`shadow-md`,
    `ui-tag-<สี>-*`→`<สี>-100`/`<สี>-700`; ชื่อที่ไม่อยู่ในตาราง → token ของ shadcn ที่ใกล้ที่สุด (บันทึกใน PR)

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
  Then ทุกค่ายังพบใน `src/**` (เทียบหลังลบช่องว่างทั้งหมด) — แก้ baseline ได้เฉพาะเมื่อ spec นี้ระบุ (ยังไม่มีข้อยกเว้น)
- AC-6 (ทุก task, กฎ 15) static `e2e/sfui-legacy.unit.spec.ts` มี `PENDING: Record<"SFUI-2"|"SFUI-3a"|…|"SFUI-6", string[]>` (สร้างใน SFUI-1a ตามตารางเจ้าของไฟล์):
  (a) ไฟล์ที่มี pattern ต้องห้ามทุกไฟล์อยู่ใน `PENDING` ของ key ใด key หนึ่ง; (b) ทุกไฟล์ใน `PENDING` ยังมีและยังมี pattern (บังคับให้ลบออกเมื่อย้ายเสร็จ);
  (c) task ที่ merge แล้วไม่มี key ใน `PENDING`; หลัง SFUI-6 ไฟล์นี้เหลือเฉพาะการตรวจ (a) กับรายการว่าง
- AC-7 (SFUI-1b, กฎ 2) static: `components.json` มีค่าตามกฎ 2 ทุก field; `tsconfig.json` มี `@/*`; `src/lib/utils.ts` export `cn`; unit: `cn("px-2", "px-4") === "px-4"`
- AC-8 (SFUI-2, กฎ 3, 14, 20) unit (jsdom) ของ `src/components/ui/button.tsx`: `isLoading` → ปุ่ม disabled และข้อความมีอักษรไทย; `buttonVariants({ variant: "outline", size: "sm" })` คืน string;
  shim `Button`/`Badge`/`Label`/`Input`/`Table`/`IconButton`/`buttonClassName`/`clx` ส่งต่อไป shadcn (`Button` ที่ render มี `data-slot="button"`); e2e AC-4 ข้อ (2);
  `e2e/core-90-link-button.unit.spec.ts` (AC-187) ผ่าน
- AC-9 (SFUI-3a, กฎ 4, 9, 11) e2e ใหม่ `e2e/sfui-3a-dialog.spec.ts` (ลูกค้าที่ login): Given `/<cc>/account/addresses` When กด `add-address-button` Then `getByRole("dialog")` มีชื่อที่เข้าถึงได้และเป็นภาษาไทย
  (`expectThai`), `Tab` 20 ครั้งแล้ว focus ยังอยู่ใน dialog, `Escape` ปิดและ focus กลับ `add-address-button`; เหมือนกันกับปุ่มแก้ไขที่อยู่ (testid เดิมของ `edit-address-modal`);
  ระหว่าง test ไม่มี console message ที่มี `DialogTitle` หรือ `aria-describedby`; e2e `core-23c-account-forms`, `core-22-account-fixes`, `thai-ui-account` ผ่านโดยไม่แก้
- AC-10 (SFUI-3b, กฎ 4, 11) e2e ใหม่ `e2e/sfui-3b-sheet.spec.ts`: side menu (`nav-menu-button`), search drawer (ปุ่มค้นหาใน nav), mobile actions (PDP ที่ 390px) — แต่ละตัว `role="dialog"` มีชื่อภาษาไทย,
  `Escape` ปิด, focus กลับปุ่มเปิด, ไม่มี console message ตาม AC-9; e2e `core-19a-nav-cart-search`, `core-15b-search-drawer-error`, `core-70-unified-search`, `core-75-thai-substring-search`,
  `core-50-nav-narrow`, `thai-ui-shell`, `flash-sale-fs14`, `flash-sale-fs19` ผ่านโดยไม่แก้
- AC-11 (SFUI-3c, กฎ 4, 9, 12) e2e ใหม่ `e2e/sfui-3c-select.spec.ts`: Given checkout ที่ลูกค้ามีที่อยู่ ≥ 2 When focus `shipping-address-select` กด `ArrowDown` แล้ว `ArrowDown` + `Enter` Then ที่อยู่ที่สองถูกเลือก
  (ฟิลด์ที่อยู่ในฟอร์มเปลี่ยนตาม) และ `Escape` ระหว่างเปิดไม่เปลี่ยนค่า; Given หน้า account profile When กดแก้ไขเบอร์โทร Then `edit-panel` มี `data-open="true"` และแผงอื่น `"false"`;
  e2e `core-26-cart-dropdown-total`, `core-91-cart-dropdown-known`, `core-19a-nav-cart-search`, `core-22-account-fixes`, `core-23-profile-order`, `core-23b-account-progress`, `core-4j-checkout-discount-address`,
  `core-4g-checkout-polish`, `core-63-address-invisible` ผ่านโดยไม่แก้
- AC-12 (SFUI-3d, กฎ 4, 12–13) unit 5 ไฟล์ (`core-19f-continue-after-timeout`, `pay-16-payment-container`, `pay-16-payment-step-state`, `payment-session-lock-timeout`, `pay-14-stale-session`)
  ไม่ mock/import `@headlessui/react` และ assert พฤติกรรมเดิม (จำนวน/ชื่อ test ไม่ลด); e2e: Given ขั้น payment When focus ตัวเลือกบัตรแล้วกด `ArrowDown` Then PromptPay ถูกเลือก
  (`aria-checked="true"`); e2e `payments*.spec.ts`, `pay-*.spec.ts`, `core-52-checkout-guards`, `thai-ui-checkout` ผ่านโดยไม่แก้
- AC-13 (SFUI-3e, กฎ 4, 9) unit `core-4i-b-ui-results` ไม่ mock `@headlessui/react` (จำนวน test ไม่ลด); e2e `core-32-shipping-profile-filter` (`aria-checked`/`[checked]` = 0 ตอนเริ่ม, เลือกด้วย
  `delivery-option-radio` ที่มี `data-option-id`), `group-buy-*`, `ev-7c-digital-only-checkout`, `ev-7d-digital-only-totals` และ e2e ของหน้าจ่าย order (`order-pay`) ผ่านโดยไม่แก้
- AC-14 (SFUI-4, กฎ 4–5) static: ไฟล์ของ task ไม่ import `@radix-ui/*`/`clsx` และ import `Accordion`/`Slider` จาก `@/components/ui/*`; e2e: Given `/<cc>/store` When กด `Enter` บนหัว filter Then เนื้อหา
  เปิด (`data-state="open"`) และ `ArrowRight` บน thumb ของช่วงราคาเปลี่ยนค่า; e2e ทุก spec ที่ grep พบ testid ของ filter/ช่วงราคา/แท็บ PDP (เช่น `core-store`) ผ่านโดยไม่แก้
- AC-15 (SFUI-5a–5e, กฎ 15, 19–21) static: key ของ task ไม่อยู่ใน `PENDING` (AC-6) และไฟล์ในขอบเขตไม่มี pattern ต้องห้าม; e2e ทุก spec ที่ grep พบ path/testid ของหน้าในขอบเขตผ่านโดยไม่แก้
- AC-16 (SFUI-6, กฎ 1, 15–16) static: `PENDING` ว่าง; ไม่มี `src/styles/legacy-medusa.css`, `src/modules/common/components/ui/`, `src/modules/common/components/radio/`;
  `globals.css` ไม่ `@import` legacy; dependency ตาม AC-1 ข้อหลัง 6; `CLAUDE.md` หัวข้อ Stack ระบุ Tailwind v4 + shadcn/ui (Radix); e2e storefront ทั้งชุดผ่านใน CI
- AC-17 (SFUI-1a สร้าง, ทุก task รัน, กฎ 17) e2e ใหม่ `e2e/sfui-mobile-390.spec.ts` (`viewport: { width: 390, height: 844 }`, ลูกค้าที่ login + cart มีสินค้า 1 ชิ้น):
  `/<cc>`, `/<cc>/store`, PDP, `/<cc>/cart`, `/<cc>/checkout?step=address`, `/<cc>/account`, `/<cc>/account/orders` — ทุกหน้า `scrollWidth <= innerWidth`
- AC-18 (ทุก task, กฎ 18) static/CI: `git diff origin/develop --stat -- apps/backend 'apps/storefront/e2e/*admin*'` ว่าง (reviewer ตรวจ); e2e admin ผ่าน

## Non-functional (concurrency, idempotency, scale, observability)
- กันกดซ้ำ: ปุ่มที่ย้ายไป shadcn คง `disabled`/single-flight เดิม (ไม่มี logic ใหม่)
- bundle: บันทึก First Load JS ของ `/[countryCode]` และ PDP จาก `next build` ก่อน (SFUI-1a) และหลัง (SFUI-6) ใน PR — ไม่ใช่ gate
- browser ขั้นต่ำตาม Tailwind v4 (Safari 16.4+, Chrome 111+, Firefox 128+) — Q1
- Vitest + jsdom ที่ render Radix `Select`/`Slider`: polyfill ใน test ไฟล์นั้น (ไม่ใส่ global setup ใหม่ถ้ามีผู้ใช้ที่เดียว)

## Test plan: unit / integration / e2e, mapped to AC numbers
| ชนิด | AC |
|---|---|
| static (`pnpm --filter storefront test:e2e:unit`, `e2e/*.unit.spec.ts`) | AC-1, AC-2, AC-5, AC-6, AC-7, static ของ AC-14/15/16 |
| unit (Vitest) | AC-3 (CSS), AC-4 (CSS), AC-7 (`cn`), AC-8, AC-12, AC-13 |
| integration | none (ไม่แตะ backend) |
| e2e storefront (Playwright) | AC-3, AC-4 (2), AC-9..AC-15, AC-17 + ชุดเดิมทั้งหมด (กฎ 19) |
qa เก็บ evidence ทุก task ที่มี UI (ทุก task ยกเว้น SFUI-1b) — screenshot ก่อน/หลังของหน้าที่ task แตะ ≤ 5 รูป; builder รัน e2e **ทุก** spec ที่อ้างหน้าที่ task แตะ (CLAUDE.md)

## Tasks (each = one PR, ≤ ~400 LOC, ordered, with dependencies)
เจ้าของไฟล์: **แต่ละไฟล์ถูกแก้โดย task เดียว** (ยกเว้น `globals.css`: 1a → 1b → 6 ตามลำดับ, shim: 2 → 6, `e2e/sfui-legacy.unit.spec.ts`: แต่ละ task ลบ key ตัวเอง)
— task ที่เป็นเจ้าของไฟล์ย้ายไฟล์นั้น**ครบทุกชั้น** (primitive + icon + class + import shim) ในครั้งเดียว · icon ไม่แยก task (ร่างเดิม SFUI-4 icons) เพื่อไม่ให้สอง task แตะไฟล์เดียวกัน ·
ไฟล์ที่มี pattern ต้องห้ามแต่ไม่ได้ระบุชื่อในตารางเป็นของ task 5x ตามโฟลเดอร์ · LOC ประมาณการไม่นับ lockfile/ไฟล์ที่ CLI สร้าง

| Task | งาน — ไฟล์ที่เป็นเจ้าของ | shadcn add | AC | Depends | ∥ |
|---|---|---|---|---|---|
| SFUI-1a | Tailwind v4 + ชั้นเข้ากันได้: `package.json`/lockfile (กฎ 1, AC-1 ขั้น 1a), `postcss.config.js`, ลบ `tailwind.config.js`, `src/styles/globals.css` (`@import "tailwindcss"`, `@theme` ค่าเดิม, `@utility`, `--font-sans`), `src/styles/legacy-medusa.css` (ใหม่), ลบ `thai-ui-preset.js` + `ui-preset-font.test.ts` + `tailwind-config.test.ts` → `src/styles/theme-css.test.ts` (AC-3/4 ส่วน CSS), `src/app/layout.tsx` (comment), เขียนใหม่ `e2e/ui-preset-font.spec.ts`; ใหม่ `e2e/sfui-{deps,legacy-css,baseline,legacy}.unit.spec.ts`, `e2e/support/sfui-baseline.json`, `e2e/sfui-mobile-390.spec.ts`; utility ที่ v4 เปลี่ยนชื่อในไฟล์ใดก็ได้ (codemod `@tailwindcss/upgrade` — เฉพาะ rename ไม่แตะอย่างอื่น) | — | AC-1..AC-6, AC-17, AC-18 | PR เอกสารนี้ merge + ADR-030 accepted | — |
| SFUI-1b | `shadcn init -b radix`: `components.json`, `tsconfig.json` (`@/*`), `src/lib/utils.ts`, `globals.css` (`@import "tw-animate-css"`, `:root` token neutral, `--primary`/`--primary-foreground`/`--ring` → brand, `@theme inline`), `package.json`/lockfile (dependency ขั้น 1b), เพิ่มข้อตรวจใน `theme-css.test.ts` | — | AC-4 (1b), AC-7 | SFUI-1a | — |
| SFUI-2 | primitive พื้นฐาน + shim ส่งต่อ: `src/components/ui/*` (CLI) + `button.tsx` เพิ่ม `isLoading` (กฎ 20), `src/modules/common/components/ui/index.tsx` (คง API เดิม, ส่งต่อ shadcn; `clx` = `cn`), unit `src/components/ui/button.test.tsx`, e2e ข้อ (2) ของ AC-4 ใน `e2e/sfui-2-brand.spec.ts` | `button input label badge table checkbox radio-group native-select` | AC-4 (2), AC-8 | SFUI-1b | — |
| SFUI-3a | modal ที่อยู่ → `Dialog`: `common/components/modal/index.tsx` (ลบ; ผู้ใช้ 2 ที่ใช้ `Dialog` ตรง), `lib/context/modal-context.tsx` (ลบถ้าไม่มีผู้ใช้อื่น), `account/components/address-card/{edit-address-modal,add-address}.tsx`, e2e ใหม่ `sfui-3a-dialog.spec.ts` | `dialog` | AC-9 | SFUI-2 | ∥ 3b–5e |
| SFUI-3b | แผงเต็มจอ → `Sheet`: `layout/components/side-menu/index.tsx`, `layout/components/search/{drawer,index,hit}.tsx`, `products/components/product-actions/mobile-actions.tsx`, e2e ใหม่ `sfui-3b-sheet.spec.ts` | `sheet` | AC-10 | SFUI-2 | ∥ |
| SFUI-3c | listbox/popover/disclosure: `layout/components/cart-dropdown/index.tsx` → `Popover`, `layout/components/country-select/index.tsx` + `checkout/components/address-select/index.tsx` → `Select`, `account/components/account-info/index.tsx` → `Collapsible`, e2e ใหม่ `sfui-3c-select.spec.ts` | `popover select collapsible` | AC-11 | SFUI-2 | ∥ |
| SFUI-3d | ขั้นชำระเงิน → `RadioGroup`: `checkout/components/payment/index.tsx`, `checkout/components/payment-container/index.tsx`, `src/lib/constants.tsx` (icon), unit `src/{core-19f-continue-after-timeout,pay-16-payment-container,pay-16-payment-step-state,payment-session-lock-timeout,pay-14-stale-session}.test.ts`, e2e ใหม่ใน `sfui-3d-payment.spec.ts` | — | AC-12 | SFUI-2 | ∥ |
| SFUI-3e | ตัวเลือกจัดส่ง + หน้าจ่าย order → `RadioGroup`: `checkout/components/shipping/index.tsx`, `order/components/order-pay/index.tsx`, unit `src/core-4i-b-ui-results.test.ts` | — | AC-13 | SFUI-2 | ∥ |
| SFUI-4 | Radix เดิม → shadcn: `store/components/refinement-list/options-picker/index.tsx`, `store/components/store-refinements/{option-refinements,price-range,refinement-group}.tsx`, `products/components/product-tabs/accordion.tsx` (ลบ variant `radix-state-*`), e2e ใหม่ใน `sfui-4-store.spec.ts` | `accordion slider` | AC-14 | SFUI-2 | ∥ |
| SFUI-5a | ร่วม + layout: `src/modules/common/**` (ยกเว้น `ui/`, `modal/`, `radio/`), `src/modules/layout/**` (ยกเว้นไฟล์ของ 3b/3c), `src/modules/{skeletons,shipping,policies}/**`, `src/app/not-found.tsx`, `src/app/[countryCode]/(main)/**` ที่ไม่อยู่ใน 5b–5e (หน้าแรก, contact, terms, privacy, returns, shipping, verify-account, not-found, layout) | — | AC-15 | SFUI-2 | ∥ |
| SFUI-5b | catalog: `src/modules/{products,store,home,categories,collections,search}/**` (ยกเว้นไฟล์ของ 3b/4), `src/app/[countryCode]/(main)/{store,products,categories,collections,search}/**` | — | AC-15 | SFUI-2 | ∥ |
| SFUI-5c | checkout + cart: `src/modules/{checkout,cart,returns}/**` (ยกเว้นไฟล์ของ 3c/3d/3e), `src/app/[countryCode]/(checkout)/**`, `src/app/[countryCode]/(main)/cart/**` | — | AC-15 | SFUI-2 | ∥ |
| SFUI-5d | account + order: `src/modules/{account,order}/**` (ยกเว้นไฟล์ของ 3a/3c/3e), `src/app/[countryCode]/(main)/{account,order}/**` (ยกเว้น `account/@dashboard/vouchers/**` ของ 5e) | — | AC-15 | SFUI-2 | ∥ |
| SFUI-5e | ฟีเจอร์: `src/modules/{group-buy,affiliate,evoucher}/**`, `src/app/[countryCode]/(main)/{affiliate,g}/**`, `src/app/[countryCode]/(main)/account/@dashboard/vouchers/**` | — | AC-15 | SFUI-2 | ∥ |
| SFUI-6 | ปิดงาน: ลบ shim `common/components/ui/`, `common/components/radio/`, `legacy-medusa.css` + `@import`, dependency ขั้น 6 (`package.json`/lockfile), `e2e/sfui-legacy.unit.spec.ts` เหลือข้อ (a) รายการว่าง, `e2e/sfui-legacy-css.unit.spec.ts` (ลบ), `CLAUDE.md` หัวข้อ Stack (+ ข้อความ storefront ที่อ้าง preset ถ้ามี — owner อนุมัติใน review), บันทึก bundle ก่อน/หลัง | — | AC-1 (ขั้น 6), AC-16 | SFUI-1a..SFUI-5e ทั้งหมด | — |

ลำดับ: SFUI-1a → SFUI-1b → SFUI-2 → (SFUI-3a ∥ 3b ∥ 3c ∥ 3d ∥ 3e ∥ SFUI-4 ∥ 5a ∥ 5b ∥ 5c ∥ 5d ∥ 5e) → SFUI-6
- ไฟล์ร่วมของกลุ่มขนาน: `e2e/sfui-legacy.unit.spec.ts` (ต่างคนต่างลบ key ของตัวเอง — ตัวที่ merge ทีหลัง sync), `src/components/ui/*` (แต่ละ task เพิ่มคนละไฟล์ตามคอลัมน์ shadcn add)
- ประมาณ LOC: 1a ~400 (CSS ชั่วคราวคัดลอกค่า), 1b ~150, 2 ~250, 3a–3e/4 ~200–350 ต่อ task, 5a–5e ~250–380 ต่อ task (5c ใหญ่สุด: `addresses` ~45 จุด) — เกิน 450 ให้หยุดแตกตามโฟลเดอร์ย่อยแล้วแจ้ง planner
- ขนานพร้อมกันได้ตามเครื่อง — e2e storefront ทั้งชุดรันใน CI; ในเครื่องรันเฉพาะ spec ที่อ้างหน้าที่แตะ

## Open questions
- Q1: Tailwind v4 รองรับ Safari 16.4+ / Chrome 111+ / Firefox 128+ เท่านั้น — iOS ต่ำกว่า 16.4 (ออกก่อน มี.ค. 2023) จะแสดงผลเพี้ยน ยอมรับไหม? (ค่าเสนอ: ยอมรับ — ไม่บล็อกการเริ่ม)
- Q2: ระหว่าง SFUI-2 merge จนถึง SFUI-6 merge หน้าเว็บมีสไตล์ผสม (shadcn + ชั้นเข้ากันได้) — ตกลงไม่ release `develop → main` ช่วงนั้น (ยกเว้น hotfix) ใช่ไหม?
  และจะเริ่มก่อนหรือหลัง go-live? (ค่าเสนอ: ไม่ release ช่วงนั้น; เริ่มเมื่อ owner สั่ง)
