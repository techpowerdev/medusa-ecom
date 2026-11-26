# ADR-030 Storefront ใช้ shadcn/ui (Radix) บน Tailwind v4 แทนชั้น UI ของ Medusa

สถานะ: **accepted** (owner 2026-11-26 — พร้อมคำตอบ spec 09 Q1 = ยอมรับ browser ขั้นต่ำของ Tailwind v4, Q2 = งด release `develop → main` ระหว่าง SFUI-2 merge ถึง SFUI-6 merge ยกเว้น hotfix)
· การทำงานแบบ stack (owner อนุญาต 2026-11-26 — ข้อยกเว้นของกติกา "ห้ามแตก branch จาก PR ที่ยังไม่ merge" ใน CLAUDE.md เฉพาะชุด SFUI): task SFUI ทุกตัวแตก branch ต่อจาก branch ของ task ก่อนหน้า
(เริ่มจาก branch เอกสาร `docs/SFUI-shadcn-adr-spec`) ได้โดยไม่ต้องรอ PR merge แล้วเปิด PR ทั้งชุดพร้อมกันตอนท้าย (base = `develop`) และ merge ตามลำดับ
เกี่ยวข้อง: spec 09 (task SFUI-1a..6, AC-1..18), ADR-002 (amend), ADR-008 ข้อ 4 (amend วิธีทำ — ไม่เปลี่ยนเจตนา), ADR-014 (ไม่กระทบ), ADR-018 (ไม่กระทบ — admin)
เลข ADR: ADR-029 ถูกใช้แล้ว (refund-failure-visibility), ADR-020/ADR-027 สงวนไว้ (pool / staging) → ใช้ **ADR-030**

## บริบท
- owner (2026-11-26) ตัดสินแล้ว — ไม่เปิดคำถามซ้ำ:
  1. แทนชั้น UI ของ Medusa ใน `apps/storefront` **ทั้ง 4 ชั้น**: shim `src/modules/common/components/ui/index.tsx` (import 89 ไฟล์),
     `@medusajs/ui-preset` + `src/styles/thai-ui-preset.js` (CORE-8) + class `txt-*`/`h*-webs`, `@medusajs/icons` (23 ไฟล์), `@headlessui/react` (12 ไฟล์ใน `src/` + mock/import ใน unit 6 ไฟล์);
     ถอด `tailwindcss-radix`; Radix ที่มีอยู่ (`@radix-ui/react-accordion`, `@radix-ui/react-slider`) รวมเข้ากับแนวของ shadcn
  2. อัป Tailwind v3 → v4 ก่อน แล้วใช้ shadcn CLI รุ่นล่าสุด (CSS-first, `@theme`, `tw-animate-css`)
  3. ยอมให้หน้าตาเปลี่ยนเป็นสไตล์ shadcn แต่ยังใช้สี brand ตาม ADR-008 (map เป็น CSS variable)
- ผลสำรวจโค้ดจริง (`origin/develop` 2026-11-26):
  - `@medusajs/ui-preset@2.22.1` เป็น **preset ของ Tailwind v3 เท่านั้น** (`peerDependencies.tailwindcss: "^3.4.3"`, พ่วง `tailwindcss-animate` + `@tailwindcss/forms`) →
    ใช้กับ Tailwind v4 ไม่ได้ ชั้นที่ 2 ต้องถอดพร้อมการอัป v4 ไม่ใช่ทีหลัง; `tailwindcss-radix@2` เป็น plugin ของ v3 เช่นกัน
  - นอกจาก `txt-*`/`h*-webs` (154 จุด 54 ไฟล์) preset ยังให้ **สี/เงา `ui-*`** (`text-ui-fg-subtle`, `bg-ui-bg-base`, `border-ui-border-base`, `shadow-borders-*` ฯลฯ)
    ใช้อยู่ **412 จุด 120 ไฟล์** — ต้องมีชั้นเข้ากันได้ชั่วคราวครอบด้วย ไม่งั้นหน้าเว็บไม่มีสีทันทีที่อัป v4
  - ตัวแปร variant `radix-state-*` (จาก `tailwindcss-radix`) ใช้ที่ `product-tabs/accordion.tsx` ไฟล์เดียว
  - shim เดิมเขียนเองทั้งหมด (ไม่ได้ import `@medusajs/ui` แล้ว); `Checkbox`/`RadioGroup` ของ shim เป็น `<input>` native
  - e2e (`apps/storefront/e2e/`) หาด้วย `data-testid`; ใช้ `selectOption` กับ `<select>` native ~15 ที่, assert CSS เฉพาะ `text-decoration-line: line-through` (ราคาแฟลช),
    `opacity` ของ `mobile-actions`/ข้อความ error, `data-open` ของ `edit-panel`, `aria-checked`/`[checked]` ใน `delivery-options-container`
- shadcn ปัจจุบัน (ตรวจ 2026-11-26 — แหล่งอ้างอิงท้ายเอกสาร):
  - CLI `shadcn@4.23.1`; ตั้งแต่ 2026-07 **ค่าเริ่มต้นเป็น Base UI** — ต้องสั่ง `init -b radix` เพื่อได้ Radix ("Radix is not being deprecated")
  - style `new-york` ใช้ package รวม **`radix-ui`** (import `{ Dialog as DialogPrimitive } from "radix-ui"`) แทน `@radix-ui/react-*` แยกตัว (2026-02)
  - ตั้งแต่ 2026-09 component import `cn` จาก package **`cn`** (drop-in ของ `twMerge(clsx(...))`); `@/lib/utils` เหลือ `export { cn } from "cn"`
  - Tailwind v4: `tw-animate-css` แทน `tailwindcss-animate`, สี OKLCH, `@theme inline`, ทุก primitive มี `data-slot`, ไม่มี `forwardRef` (React 19)
  - `components.json` ของ v4: `tailwind.config` เป็น `""`, style `default` เลิกใช้ → `new-york`
- Medusa ไม่มี component library สำหรับ storefront ที่ทำงานบน Tailwind v4 (`@medusajs/ui` + preset เป็นของ admin/v3) และ `medusajs.com/integrations` ไม่มี plugin ด้าน UI ของ storefront —
  ชั้น commerce ของ starter (data layer, JS SDK, caching, Stripe Elements) **คงเดิม** ADR นี้แตะเฉพาะชั้นการแสดงผล

## ทางเลือก
A. **Tailwind v4 + shadcn/ui แบบ Radix (`-b radix`, style `new-york`)** ติดตั้งผ่าน CLI ลง `src/components/ui/*`; ชั้นเข้ากันได้ชั่วคราวสำหรับ class ของ preset ระหว่างย้าย
B. คงชั้น UI เดิม (Tailwind v3 + preset + shim + headlessui) — ไม่ตรงคำตัดสิน owner; v4 ทำไม่ได้ตราบที่มี preset
C. Tailwind v4 + shadcn แบบ **Base UI** (ค่าเริ่มต้นของ CLI ตั้งแต่ 2026-07) — owner ระบุ Radix; ไม่มีเหตุผลด้านเทคนิคให้แย้ง และ Radix ยังได้รับการดูแลเท่ากัน
D. Tailwind v4 แต่เขียน primitive เอง (dialog/select ฯลฯ) — สร้างของที่ library ทำได้ดีอยู่แล้ว (ขัดหลัก CLAUDE.md ข้อ 1 และ 3)

ทางเลือกย่อยของ helper รวม class:
a. **package `cn`** (สิ่งที่ CLI ปัจจุบันสร้าง; component ทุกตัว import `from "cn"`)
b. `clsx` + `tailwind-merge` ใน `src/lib/utils.ts` แบบเดิมของ shadcn — ต้องแก้ import ของทุก component ที่ CLI สร้างให้ด้วยมือ

## การตัดสินใจ (owner accepted 2026-11-26)
เลือก **A** + ทางเลือกย่อย **a**

1. **Tailwind v4 แบบ CSS-first**: ลบ `tailwind.config.js`; ค่า theme เดิม (brand, grey, breakpoints `2xsmall`..`2xlarge`, `borderRadius`, `maxWidth.8xl`, keyframes/animation)
   ย้ายเป็น `@theme` ใน `src/styles/globals.css`; PostCSS ใช้ `@tailwindcss/postcss` ตัวเดียว (เลิก `autoprefixer` — v4 จัดการ prefix เอง)
2. **shadcn**: `pnpm dlx shadcn@4.23.1 init -b radix` แล้วตั้ง `components.json`:
   `style: "new-york"`, `tailwind.config: ""`, `tailwind.css: "src/styles/globals.css"`, `tailwind.baseColor: "neutral"`, `tailwind.cssVariables: true`, `tailwind.prefix: ""`,
   `rsc: true`, `tsx: true`, `iconLibrary: "lucide"`, aliases `components: "@/components"`, `ui: "@/components/ui"`, `utils: "@/lib/utils"`, `lib: "@/lib"`, `hooks: "@/hooks"`;
   `tsconfig.json` เพิ่ม `"@/*": ["*"]` (baseUrl `src` เดิม — alias `@lib/*`, `@modules/*` คงไว้)
3. **ที่ตั้ง**: component ของ shadcn อยู่ที่ `apps/storefront/src/components/ui/<name>.tsx` (เพิ่มด้วย `shadcn add` เท่านั้น); `src/lib/utils.ts` = `export { cn } from "cn"`;
   แก้ไฟล์ใน `src/components/ui/` ได้เท่าที่จำเป็น (เช่น prop `isLoading` ของ `Button` ที่แสดง "กำลังดำเนินการ..." ตามเดิม) พร้อม comment `// SFUI:` อธิบาย;
   component ของโดเมน (ตะกร้า, checkout ฯลฯ) คงอยู่ใน `src/modules/**` ตาม starter
4. **Radix เข้าผ่าน `src/components/ui/*` เท่านั้น** (package `radix-ui` รวม) — โค้ดใน `src/modules/**`, `src/app/**` ไม่ import `radix-ui`/`@radix-ui/*` ตรง;
   accordion/slider เดิมย้ายเป็น `accordion`/`slider` ของ shadcn
5. **map primitive**: headless `Dialog` (modal ที่อยู่) → `Dialog`; headless `Dialog`/`Popover` ที่เป็นแผงเต็มจอ (side menu, search drawer, mobile actions) → `Sheet`;
   `Popover` (cart dropdown) → `Popover`; `Listbox` → `Select`; `Disclosure` → `Collapsible`; `RadioGroup`/`Radio` → `RadioGroup`/`RadioGroupItem`;
   **`<select>` native คงเป็น native** ผ่าน `native-select` ของ shadcn (e2e ใช้ `selectOption`, ฟอร์ม server action อ่าน `FormData`); `Input`/`Label` ของ shadcn เป็น element native อยู่แล้ว
6. **icons**: `lucide-react` แทน `@medusajs/icons` (ตาราง map ใน spec 09 กฎ 6); icon SVG ที่ starter เขียนเองใน `src/modules/common/icons/*` อยู่นอกขอบเขต
7. **theme / brand (ADR-008 ข้อ 4 — เจตนาคงเดิม วิธีเปลี่ยน)**: palette `--color-brand` + `--color-brand-50..900` (ค่า hex เดิม) อยู่ใน `@theme` เป็นที่เดียวที่ owner แก้;
   token ของ shadcn ชี้ไปที่ brand: `--primary: var(--color-brand-900)`, `--primary-foreground: var(--color-brand-50)`, `--ring: var(--color-brand-400)`
   (brand-900 `#171717` = สีปุ่มหลักสีดำเดิม); token อื่นใช้ค่า `neutral` ของ shadcn; **ไม่มี dark mode** (ไม่ใส่ `.dark`, `<html data-mode="light">` คงเดิม)
8. **ฟอนต์ (แทนกลไก CORE-8)**: `@theme inline { --font-sans: var(--font-noto-sans-thai), ui-sans-serif, system-ui, sans-serif; }` และ `body` ใช้ `font-sans`;
   ไม่ต้องห่อ preset อีก (`thai-ui-preset.js` และ test ของมันถูกลบ) — `next/font` ใน `src/app/layout.tsx` คงเดิม
9. **ชั้นเข้ากันได้ชั่วคราว** `src/styles/legacy-medusa.css` (SFUI-1a → ลบใน SFUI-6): `@utility` ของ `txt-*`/`h*-webs` และ `@theme` ของสี/เงา `ui-*` **เฉพาะที่ใช้จริง**
   ค่าคัดลอกจาก `@medusajs/ui-preset@2.22.1/dist` (light) โดย font-family เป็น `var(--font-sans)`; `@custom-variant radix-state-open/closed` แทน `tailwindcss-radix`
10. **dependency** (pin exact; ตรวจจาก npm registry 2026-11-26 — builder ห้ามเปลี่ยนเวอร์ชันเองโดยไม่แก้ ADR):

| package | เวอร์ชัน | ชนิด | เพิ่มใน | หมายเหตุ |
|---|---|---|---|---|
| `tailwindcss` | 4.3.5 | dev | SFUI-1a | แทน `^3.0.23` |
| `@tailwindcss/postcss` | 4.3.5 | dev | SFUI-1a | PostCSS plugin ของ v4 (Next.js 16 ใช้ PostCSS) |
| `tw-animate-css` | 1.4.0 | dev | SFUI-1b | แทน `tailwindcss-animate` (ที่มากับ preset) — `@import "tw-animate-css"` |
| `radix-ui` | 1.8.1 | dep | SFUI-1b | package รวมของ Radix; peer `react ^19.0` ✓ (React 19.0.5) |
| `class-variance-authority` | 0.7.1 | dep | SFUI-1b | variant ของ button/badge |
| `cn` | 0.5.2 | dep | SFUI-1b | helper รวม class ของ shadcn (ไม่มี dependency) |
| `lucide-react` | 1.80.0 | dep | SFUI-1b | peer `react ^19.0.0` ✓ |
| `shadcn` (CLI) | 4.23.1 | — | ใช้ผ่าน `pnpm dlx shadcn@4.23.1` | ไม่เป็น dependency |

ถอด: `@medusajs/ui-preset`, `tailwindcss-radix`, `autoprefixer` (SFUI-1a — ใช้กับ v4 ไม่ได้/ไม่จำเป็น);
`@medusajs/icons`, `@headlessui/react`, `@radix-ui/react-accordion`, `@radix-ui/react-slider`, `clsx` (SFUI-6 เมื่อไม่มีผู้ใช้แล้ว).
ความเข้ากันได้: Next 16.3.8 + React 19.0.5 + `@types/react` 19.0.5 — `radix-ui`/`lucide-react` รองรับ React 19 ตาม peer; component ของ shadcn ชุด v4 ไม่มี `forwardRef`

11. **คง `data-testid` ทุกตัว** ไว้บน element ที่ e2e ใช้งานจริง (Radix ส่ง prop ที่ไม่รู้จักต่อถึง DOM ของ part นั้น; ใช้ `asChild` → testid อยู่ที่ลูก);
    test ไม่เปลี่ยนวิธีหา element (CLAUDE.md, ADR-014 ข้อ 3)
12. admin (`apps/backend/src/admin`) **ไม่กระทบ** — ยังใช้ `@medusajs/ui`/`@medusajs/dashboard` ตาม ADR-018 (คนละแอป คนละ Tailwind config)

## ผลที่ตามมา
+ ถอด dependency ที่ผูกกับ Tailwind v3 ได้หมด; มี primitive ที่เข้าถึงได้ (focus trap, Escape, ARIA) จาก Radix แทนของเขียนเอง/headless คนละค่าย
+ สี brand และฟอนต์ไทยอยู่ใน CSS variable ที่เดียว (ไม่ต้องห่อ plugin แบบ CORE-8)
+ component อยู่ในโค้ดของเรา (shadcn = copy) แก้ได้โดยไม่รอ upstream
− **browser ขั้นต่ำของ Tailwind v4**: Safari 16.4+, Chrome 111+, Firefox 128+ — iOS < 16.4 จะแสดงผลเพี้ยน (owner ยอมรับ 2026-11-26 — spec 09 Q1)
− หน้าตาเปลี่ยนทั้งร้าน (owner ยอมรับ); ช่วงที่ task ยัง merge ไม่ครบจะเห็นสไตล์ผสม — **งด release `develop → main` ระหว่าง SFUI-2 merge ถึง SFUI-6 merge ยกเว้น hotfix** (owner 2026-11-26 — spec 09 Q2)
− ADR-002: merge การเปลี่ยนแปลงจาก upstream ของ Medusa Next.js Starter ยากขึ้นมากในชั้นแสดงผล (starter ยังใช้ preset/v3) — ต่อไปรับเฉพาะชั้น data/logic จาก upstream
− test เดิมที่ผูกกับ preset ต้องเขียนใหม่: `src/styles/ui-preset-font.test.ts`, `src/styles/tailwind-config.test.ts`, `e2e/ui-preset-font.spec.ts` (spec 01 AC-9 ส่วนฟอนต์/brand, AC-24, AC-25
  → แทนด้วย spec 09 AC-3/AC-4) และ unit 6 ไฟล์ที่ mock/import `@headlessui/react`
− utility บางตัวของ v4 เปลี่ยนชื่อ/ความหมาย (`shadow-sm`→`shadow-xs`, `rounded`→`rounded-sm`, `outline-none`→`outline-hidden`, เลิก `bg-opacity-*`, `flex-shrink-*`; `hover:` มีผลเฉพาะอุปกรณ์ที่ hover ได้;
  สีขอบเริ่มต้นเป็น `currentColor`) — แก้ใน SFUI-1a ด้วย codemod `@tailwindcss/upgrade` หรือมือ
− package `cn` ยังเป็น 0.x (ออก 2026-09) — ถ้ามีปัญหา ย้อนเป็น `clsx` + `tailwind-merge` ได้โดยแก้ `src/lib/utils.ts` + import ของ `src/components/ui/*` (ADR ใหม่)
− unit test (Vitest + jsdom) ที่ render `Select`/`Slider` ของ Radix อาจต้อง polyfill `ResizeObserver`/`hasPointerCapture`/`scrollIntoView`

## การแก้ ADR เดิม (มีผลแล้ว — ADR นี้ accepted 2026-11-26)
- ADR-002: เพิ่มหมายเหตุ — ชั้นแสดงผลของ starter (preset/shim/headlessui/icons) ถูกแทนด้วย shadcn/ui; ส่วน commerce ของ starter คงเดิม
- ADR-008 ข้อ 4: เพิ่มหมายเหตุ — brand tokens + Noto Sans Thai ทำผ่าน `@theme`/CSS variable ใน `globals.css` แทน `tailwind.config.js` (ค่าและเจตนาเดิม)
- ADR-014: เพิ่มหมายเหตุ — ไม่กระทบ (ข้อความไทยเขียนตรงในโค้ดคงเดิม; ข้อความ a11y ใหม่ของ overlay เป็นไทย)

## แหล่งอ้างอิง (ตรวจ 2026-11-26)
- https://ui.shadcn.com/docs/tailwind-v4 · https://ui.shadcn.com/docs/components-json · https://ui.shadcn.com/docs/installation/next
- https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default (`init -b radix`) · https://ui.shadcn.com/docs/changelog/2026-02-radix-ui (`radix-ui`) · https://ui.shadcn.com/docs/changelog (2026-09 `cn`)
- https://ui.shadcn.com/docs/components/native-select
- npm registry (`/latest`): `shadcn` 4.23.1, `tailwindcss` 4.3.5, `@tailwindcss/postcss` 4.3.5, `tw-animate-css` 1.4.0, `radix-ui` 1.8.1, `class-variance-authority` 0.7.1, `cn` 0.5.2, `lucide-react` 1.80.0
- `node_modules/@medusajs/ui-preset@2.22.1/package.json` (`peerDependencies.tailwindcss: "^3.4.3"`)
