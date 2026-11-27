# ADR-032 ช่องกรอกในฟอร์ม storefront ใช้ `field` ของ shadcn ตาม default (label เหนือช่อง, ป้ายบังคับ, ข้อความ error ใต้ช่อง)

สถานะ: **accepted** (owner 2026-11-27 — รับตามข้อเสนอ: D1 = ก, D2 = ก, D3 = ก (`*` อย่างเดียว ไม่ใส่ "(ไม่บังคับ)"), D4 = ก, D5 = ก; ความสูงช่อง 36px ตาม default ของ shadcn ไม่ override;
เพิ่มกติกาการจัดวาง — ข้อ 6 ของการตัดสินใจ; spec 09 Q3 = ตามข้อเสนอ, Q4 = ไม่ทำรอบนี้ (backlog หลัง v0.4.0), Q5 = stack ได้) · เสนอโดย planner 2026-11-27
เกี่ยวข้อง: spec 09 หัวข้อ "ส่วนฟอร์ม (รอบ 48)" (กฎ 26–37, AC-26–AC-37, task SFUI-11a..13), ADR-030 (ไม่ขัด — อยู่ในกรอบข้อ 3–5), ADR-014 (ข้อความไทยตรงในโค้ด),
spec 09 กฎ 19/22 (ยกเว้นเฉพาะช่องกรอกในรอบนี้ — กฎ 27), spec 01 กฎข้อ 56 (ส่วน floating label), 63d, 96 และ AC-91/AC-132 ส่วน label (ถูกแทน — กฎ 27c)
เลข ADR: ADR-031 ล่าสุด, ADR-020/ADR-027 สงวนไว้ → ใช้ **ADR-032**

## บริบท
- owner (2026-11-27, ก่อน release v0.4.0 — PR release #603 พักไว้) สั่ง: **ทุกฟอร์มของ storefront** ปรับช่องกรอกให้ "คงตาม default ที่ shadcn ให้มาพร้อม component" —
  label อยู่เหนือช่อง (เลิก floating label), มีข้อความ error, ป้ายบังคับกรอก (*) และ placeholder ตามความเหมาะสม
- สภาพโค้ดปัจจุบัน (develop `2fc21531`):
  - ช่องกรอกเกือบทั้งหมดผ่าน wrapper `src/modules/common/components/input/index.tsx` (ผู้ใช้ 12 ไฟล์: login, register, profile-name/phone/password/billing-address,
    add-address, edit-address-modal, checkout shipping-address/billing_address/addresses, affiliate auth-forms) — floating label ด้วย `peer` (SFUI-8),
    `placeholder=" "` บังคับ (type ห้ามส่ง placeholder), input `h-12 pt-5`, `*` สี rose หลัง label
  - **label ไม่ผูกกับ input จริง**: `htmlFor={name}` แต่ input ไม่มี `id` (ผู้เรียกไม่ส่ง) → `input.labels` ว่าง, ชื่อที่เข้าถึงได้ของช่องว่าง; ปุ่มแสดงรหัสผ่านไม่มีชื่อที่เข้าถึงได้
  - `<select>` ใช้ `common/components/native-select` (ไม่มี label ในตัว): `CountrySelect` ของ checkout/ที่อยู่ไม่มี label ที่มองเห็นเลย (มีแต่ option "เลือกประเทศ"),
    คืนสินค้า/group buy ห่อ `<select>` ด้วย `<label>` + `<span>` เอง; checkbox ใช้ `common/components/checkbox` (`id="checkbox"` ตายตัว)
  - error: ข้อความจาก server action เป็นระดับฟอร์ม (`ErrorMessage` ใต้ฟอร์ม, `Badge` ของ `account-info`, `address-error`, `return-error` ฯลฯ — ไม่ผูกกับช่อง);
    validation ฝั่ง client มีแค่ attribute native (`required`, `type="email"`, `pattern` + `title`) → browser แสดง bubble ตามภาษาของ browser (ไม่ใช่ไทยเสมอ — ขัดเจตนา ADR-014);
    ไม่มี `aria-invalid`/`aria-describedby` ที่ใด
  - ฟอร์มส่งด้วย server action (`useActionState`) ผ่าน `<form action>` หรือ `submitWithoutReset` (onSubmit) — **ไม่ใช้ react-hook-form**
- shadcn (ตรวจ 2026-11-27 จาก `ui.shadcn.com/docs/components/field`, `/docs/forms`, registry `ui.shadcn.com/r/styles/new-york-v4/{field,input-group}.json`;
  skill `building-storefronts`/`storefront-best-practices` เรียกไม่ได้ใน session ของ planner — builder ตรวจซ้ำด้วย `pnpm dlx shadcn@4.23.1 add <name> --dry-run`):
  - **`field`** (registryDependencies `label`, `separator`; dependency `cn` — มีแล้ว): `Field` (`role="group"`, `orientation` vertical/horizontal/responsive, `data-invalid` → `text-destructive`),
    `FieldLabel` (ห่อ `Label`), `FieldDescription`, `FieldError` (`role="alert"`, รับ `children` หรือ `errors`, ไม่ render เมื่อว่าง), `FieldGroup`, `FieldSet`, `FieldLegend`, `FieldContent`, `FieldTitle`, `FieldSeparator`
  - ตัวอย่างทางการ: `<Field data-invalid>` → `<FieldLabel htmlFor>` → `<Input id aria-invalid placeholder>` → `<FieldDescription>` → `<FieldError>`; **ไม่มี** ป้าย `*` และ**ไม่ใส่** `aria-describedby` ให้เอง
  - `/docs/forms` มีคู่มือ React Hook Form, TanStack Form, Formisch; คู่มือ "React useActionState" ยัง "Coming Soon"
  - **`input-group`** (deps `button`, `input`, `textarea`): `InputGroup` + `InputGroupInput` + `InputGroupAddon` + `InputGroupButton` — แบบ default ของ shadcn สำหรับปุ่มในช่อง (เช่น แสดงรหัสผ่าน)
  - `form` (เดิม) = react-hook-form + `@hookform/resolvers` — ต้องเพิ่ม dependency และย้าย state ฟอร์มไป client
  - `Input` default: `h-9`, `px-3 py-1`, `text-base md:text-sm`, `shadow-xs`, `aria-invalid:border-destructive aria-invalid:ring-destructive/20`
- Medusa ไม่มี component ฟอร์มสำหรับ storefront (starter ให้แค่ `Input` แบบ floating label ที่เรากำลังเปลี่ยน) และ medusajs.com/integrations ไม่มี plugin UI ของ storefront

## ทางเลือกและข้อเสนอ

### D1 — ประกอบช่องกรอกอย่างไร
- **ก (เสนอ)** `pnpm dlx shadcn@4.23.1 add field` แล้วเขียน `common/components/input`, `native-select`, `checkbox` ใหม่ให้**ประกอบจาก `Field`/`FieldLabel`/`FieldDescription`/`FieldError`
  ตามโครงตัวอย่างของ shadcn** (ไม่ส่ง className ที่เปลี่ยนสไตล์ default) — props เดิม (`label`, `name`, `required`, `data-testid`, …) คงไว้ ผู้เรียก 12 ไฟล์ไม่ต้องเปลี่ยน import;
  เพิ่มเฉพาะที่ shadcn ไม่ทำให้ (`id` ด้วย `useId`, `*`, `aria-describedby`, ข้อความ error ไทยจาก validation native) ไว้ที่ component ร่วมนี้ที่เดียว
- ข ผู้เรียกทุกจุดประกอบ `Field` + `FieldLabel` + `Input` + `FieldError` เองตามตัวอย่าง shadcn — ~45 ช่อง × ~6 บรรทัด, logic ป้าย `*`/describedby/validation ซ้ำทุกจุด
- ค `form` ของ shadcn + react-hook-form — dependency ใหม่ + ย้าย validation/state ไป client ขัดกับ server action + `submitWithoutReset` และพฤติกรรม React 19 reset ที่ e2e ยึด (CORE-4f/4h/20d/23c/52)
- ง ไม่ใช้ `field` — ประกอบ `Label` + `Input` + `<p>` error เอง: สร้างของที่ shadcn มีให้แล้ว (ขัด CLAUDE.md ข้อ 1/3)

### D2 — placeholder
- **ก (เสนอ)** ใส่เฉพาะช่องที่ "ตัวอย่างรูปแบบ" ช่วยผู้ใช้ และเป็นไทย/ตัวเลข (ESLint ข้อความไทย CORE-4 ห้ามละติน ≥ 2 ตัวใน `placeholder`):
  เบอร์โทรศัพท์ `เช่น 0812345678`, รหัสไปรษณีย์ `เช่น 10110`; ช่องอื่นไม่มี placeholder (label บอกแล้ว — placeholder ไม่ใช่ label แทน); `<select>` คง option ว่างเดิม ("เลือกประเทศ", "เลือก...")
- ข ทุกช่องมี placeholder แบบคำสั่ง ("กรอกชื่อ") — ซ้ำ label, ข้อความจางอ่านยาก
- ค ไม่มี placeholder เลย

### D3 — ป้ายบังคับกรอก
- **ก (เสนอ)** ช่องที่มี `required` แสดง `*` ต่อท้ายข้อความใน `FieldLabel` เป็น `<span aria-hidden="true" class="text-destructive">*</span>` (ไม่อยู่ในชื่อที่เข้าถึงได้)
  และ control มี attribute `required` (screen reader อ่าน "จำเป็น") — ป้ายมาจาก prop `required` ที่เดียว ไม่เขียน `*` ในข้อความ label
- ข ไม่ใส่ `*` แต่ต่อท้ายช่องไม่บังคับด้วย "(ไม่บังคับ)"
- ค ก + คำอธิบาย "* จำเป็นต้องกรอก" หัวฟอร์ม

### D4 — ข้อความ error
- **ก (เสนอ)** สองระดับ:
  (1) **ระดับช่อง** = ผลของ validation native ที่มีอยู่แล้ว (`required`/`type`/`pattern` — **ไม่เพิ่มกฎ validation ใหม่**): จับ event `invalid` (เรียก `preventDefault()` ไม่ให้ bubble ภาษา browser)
      แล้วแสดงข้อความไทยใน `FieldError` ใต้ช่อง + `aria-invalid="true"` + `aria-describedby` → id ของ `FieldError`; focus ช่องแรกที่ผิด; ข้อความหายเมื่อค่าเปลี่ยนจนช่องถูก
  (2) **ระดับฟอร์ม** = ข้อความจาก server action แสดงที่เดิม (testid เดิม) ไม่ย้ายเข้าช่อง (server คืนข้อความเดียวต่อฟอร์ม; e2e เดิมยึด testid เหล่านี้)
  ไม่มี JS → bubble native ตามเดิม (progressive enhancement คงอยู่)
- ข ระดับฟอร์มอย่างเดียว (คง bubble ของ browser) — ไม่ตรงคำสั่ง "พร้อมข้อความ error" ของ field default ของ shadcn และ bubble ไม่เป็นไทยเสมอ
- ค ก + ให้ server action คืน `fieldErrors` ราย field แล้ว map เข้าช่อง — แก้ `src/lib/data/*` (customer, cart, returns, affiliate) + test ของ action; ใหญ่กว่ามาก → spec 09 Q4

### D5 — ปุ่มแสดง/ซ่อนรหัสผ่าน
- **ก (เสนอ)** `pnpm dlx shadcn@4.23.1 add input-group` (เพิ่ม `input-group.tsx`, `textarea.tsx` ใน `ui/` — `button`/`input` มีอยู่แล้วตรง CLI) แล้วใช้ `InputGroup` + `InputGroupInput` +
  `InputGroupAddon align="inline-end"` + `InputGroupButton` (ชื่อที่เข้าถึงได้ไทย "แสดงรหัสผ่าน"/"ซ่อนรหัสผ่าน" + `aria-pressed`) — default ของ shadcn สำหรับปุ่มในช่อง
- ข คงปุ่มของเรา (`absolute right-0`) บน `Input` ธรรมดา เพิ่ม `aria-label` ไทย — ไม่ต้อง add component แต่ไม่ใช่ default ของ shadcn

## การตัดสินใจ (owner accepted 2026-11-27 — "รับตามข้อเสนอ")
D1 = ก, D2 = ก, D3 = ก (ช่องไม่บังคับ**ไม่มี**ป้ายใดๆ — ไม่ใส่ "(ไม่บังคับ)"), D4 = ก, D5 = ก — รายละเอียดเป็นกฎ 26–37 ของ spec 09:
1. component ของ shadcn ที่ add ในรอบนี้: `field` (+ `separator` ตาม registry), `input-group` (+ `textarea` ตาม registry) — ผ่าน CLI เท่านั้น, hash ใน `e2e/support/shadcn-ui.json`,
   **ไม่มี dependency ใหม่** (ทุกตัวใช้ `radix-ui`/`cn`/`class-variance-authority` ที่มีแล้ว) และไม่รับการแก้ `package.json`/lockfile/`globals.css` ที่ CLI เสนอ (spec 09 กฎ 3)
2. ช่องกรอกในฟอร์มทุกตัวในขอบเขต (spec 09 กฎ 26 — ตาราง inventory) ผ่าน `common/components/{input,native-select,checkbox}` ที่ประกอบจาก `field`; ไม่มีไฟล์อื่นประกอบ `<input>`/`<select>` ของฟอร์มเอง (guard SFUI-13)
3. หน้าตาช่องกรอก = default ของ shadcn (`Input` `h-9`, label `text-sm font-medium` เหนือช่อง, ระยะ `gap-3` ของ `Field`) — **ตั้งใจเปลี่ยน** จึงยกเว้นกฎ "คง computed style" (spec 09 กฎ 19/22)
   เฉพาะช่องกรอก/label/ข้อความ error/`<select>` ของฟอร์มในรอบนี้ (กฎ 27)
4. `NativeSelect` คงเป็น `<select>` ของเรา (spec 09 กฎ 4 — ไม่ใช้ `NativeSelect` ของ shadcn) แต่ใช้ class ตาม registry `native-select` ของ shadcn 4.23.1 และสูงเท่า `Input` (`h-9`)
5. ห้ามแก้ `src/components/ui/*` (CLAUDE.md, spec 09 กฎ 3) และ Radix เข้าผ่าน `src/components/**` เท่านั้น (ADR-030 ข้อ 4) — `field`/`input-group` อยู่ใน `ui/` จึงไม่ขัด
6. **การจัดวาง (owner 2026-11-27)**: ต่ำกว่า breakpoint `small` (1024px — `--breakpoint-small` ใน `globals.css`, จุดเดียวกับที่ layout ของ storefront เช่น checkout/affiliate เปลี่ยนเป็นหลายคอลัมน์)
   ทุกช่องวางแถวละช่อง; ตั้งแต่ `small:` ขึ้นไป คู่ช่องที่สัมพันธ์กันวางแถวเดียวกันได้ — คู่ที่มีอยู่แล้วในฟอร์มเดิมคงไว้ + คู่ที่ planner เสนอ (spec 09 กฎ 37); ใช้ variant ของ theme (`small:`) ไม่ใช้ `sm:`/`md:` ของ Tailwind ค่าเริ่มต้น
7. ความสูงช่อง = default ของ shadcn (`h-9` = 36px) ไม่ override (owner 2026-11-27)

## ผลที่ตามมา
+ ทุกช่องมี label ที่ผูกจริง (`input.labels`, ชื่อที่เข้าถึงได้ไทย) — แก้บั๊ก a11y ที่มีมาตั้งแต่ starter (`htmlFor` ไม่มี `id` คู่)
+ ข้อความ error ของ validation เป็นไทยเสมอ (ไม่ขึ้นกับภาษาของ browser) และผูก `aria-describedby`/`aria-invalid`
+ หน้าตาฟอร์มตรงเอกสาร shadcn — ดูแล/เพิ่มฟอร์มใหม่ได้ด้วย component ร่วมตัวเดียว
− หน้าตาเปลี่ยนทุกฟอร์ม: ช่องเตี้ยลง 48px → 36px (มือถือ font 16px — iOS ไม่ zoom), ฟอร์มยาวขึ้นเพราะ label แยกบรรทัด; e2e/static ที่ยึด floating label ต้องเขียนใหม่ (spec 09 AC-29 — รายการปิด)
− ข้อยกเว้นของกฎ 19 ทำให้ reviewer ต้องแยก "ช่องกรอก" (เปลี่ยนได้) กับส่วนอื่นของหน้า (ต้องคงค่า) — กฎ 27 ระบุขอบเขตเป็นรายการ
− error จาก server ยังเป็นระดับฟอร์ม (D4 ก) — ราย field อยู่ใน backlog หลัง v0.4.0 (spec 09 Q4, owner 2026-11-27)
− บนมือถือฟอร์มที่อยู่ของ checkout เปลี่ยนจาก 2 คอลัมน์ (`grid-cols-2` ทุกขนาดจอ) เป็นคอลัมน์เดียว — ฟอร์มยาวขึ้นแต่ช่องกว้างพอสำหรับข้อความไทย
− release v0.4.0 (#603) พักจนรอบ 48 merge ครบ (owner 2026-11-27)

## แหล่งอ้างอิง (ตรวจ 2026-11-27)
- https://ui.shadcn.com/docs/components/field · https://ui.shadcn.com/docs/forms · https://ui.shadcn.com/docs/forms/react-hook-form (โครง `Field data-invalid` + `aria-invalid`)
- https://ui.shadcn.com/r/styles/new-york-v4/field.json · https://ui.shadcn.com/r/styles/new-york-v4/input-group.json
- `apps/storefront/eslint.config.mjs` (`TEXT_PROPS` รวม `placeholder`) · `src/modules/common/components/{input,native-select,checkbox}/index.tsx` ที่ `2fc21531`
