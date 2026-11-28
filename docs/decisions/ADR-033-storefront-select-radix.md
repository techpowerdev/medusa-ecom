# ADR-033 `<select>` ของ storefront ใช้ `Select` ของ shadcn (Radix) แทน `<select>` native

สถานะ: **accepted** (owner 2026-11-28 — D1 = ปรับตาม owner (ค′ ด้านล่าง: ใช้ component ของ shadcn ที่ติดตั้งด้วย CLI + ประกอบตามตัวอย่างใน docs, เขียนเองเฉพาะที่จำเป็น),
D2 = ก, D3 = ก, D4 = ก, D5 = ก, **D6 = ข** (ปิด JS แล้วจำนวนบน PDP = 1), D7 = ก; spec 09 Q-R49-1 = ก, Q-R49-2 = ข, Q-R49-3 = stack ได้, Q-R49-4 = ตำบลบังคับกรอก) · เสนอโดย planner 2026-11-28
เกี่ยวข้อง: spec 09 หัวข้อ "ส่วน select + ที่อยู่ไทย (รอบ 49)" (กฎ 39–57, AC-40–AC-54 — เลื่อนจาก 38/AC-38 เพราะ #612 (SFUI-14) ใช้กฎ 38/38b และ AC-38/39 แล้ว; task SFUI-15..18c), **แทนบางข้อของ ADR-030 ข้อ 5** ("`<select>` native คงเป็น native")
และ **ADR-032 ข้อ 4 + D2 ส่วน `<select>` + D4 ข้อ "ไม่มี JS → bubble native" ส่วน `<select>`**, spec 01 กฎข้อ 59 / AC-44 / AC-94 (แทนถ้อยคำ — spec 09 กฎ 47a), spec 01 กฎข้อ 110d (คงค่าหลัง form reset)
เลข ADR: ADR-032 ล่าสุด, ADR-020/ADR-027 สงวนไว้ → ใช้ **ADR-033**
นอกขอบเขต ADR นี้: ช่องตำบล/แขวง + ลำดับที่อยู่ไทยของรอบ 49 (spec 09 กฎ 52–57, SFUI-18a/18b/18c) — owner ตัดสิน field (`address_2`) และบังคับกรอก (Q-R49-4) แล้ว

## บริบท
- owner (2026-11-28, ก่อน release v0.4.0 — #603 ยังไม่ merge): "ปรับพวก select เช่น ช่อง จำนวน และอื่นๆ ให้ใช้ shadcn อย่าใช้ native" — ครอบ `<select>` ทุกจุดของ storefront
  รวมจุดที่รอบ 48 ตัดออก (Q3: จำนวนบน PDP, จำนวนในตะกร้า) → ขัดกับ ADR-030 ข้อ 5 และ ADR-032 ข้อ 4 ที่ accepted แล้ว จึงต้องมี ADR นี้แทนข้อนั้น
- owner (2026-11-28, ตอนตัดสิน D1): "ทุก component ที่มีอยู่แล้วใน shadcn ให้ใช้คำสั่ง add ของ shadcn เพื่อติดตั้ง อย่าสร้างหรือประกอบเองโดยไม่จำเป็น"
- สภาพโค้ด (develop `58e2436a`): `<select>` ใน JSX มี 3 ที่ — `common/components/native-select` (ผู้ใช้: คืนสินค้า 2, group buy 3, `profile-billing-address` 1,
  `checkout/components/country-select` → ที่อยู่ checkout 2 + ที่อยู่ในบัญชี 2), `cart/components/cart-item-select` (จำนวนในตะกร้า), `product-actions/index.tsx` (จำนวนบน PDP) —
  รวม control 11 ตัว (ตาราง inventory ใน spec 09) · `select`, `field`, `label` ของ shadcn ติดตั้งด้วย CLI แล้วใน `src/components/ui/` (SFUI-3c, SFUI-2, SFUI-11a)
- registry ของ shadcn (`ui.shadcn.com/r/styles/new-york-v4/*.json`, ตรวจ 2026-11-28) ที่เกี่ยวข้อง:
  - `select` (Radix — มีแล้ว), `field` (มีแล้ว), `label` (มีแล้ว) — **ครบตามที่ต้องใช้ ไม่ต้อง add ตัวใหม่**
  - `native-select` — เป็น `<select>` native (ขัดคำสั่ง owner) → ไม่ใช้
  - `form` — dependency `react-hook-form`, `@hookform/resolvers`, `zod` (ใหม่ทั้งหมด) + ย้าย state ฟอร์มไป client → **ไม่เลือก** (ต้องถาม owner — spec 09 Q-R49-6)
  - `combobox` — สร้างบน **Base UI** (`@base-ui/react` — dependency ใหม่ และขัด ADR-030 ที่เลือก Radix) → ไม่ใช้
  - ตัวอย่างใน docs: `Field` → `FieldLabel htmlFor` → `Select` → `SelectTrigger id` (invalid: `Field data-invalid` + `SelectTrigger aria-invalid`) → `SelectValue placeholder` → `SelectContent` → `SelectItem`;
    docs ไม่มีตัวอย่าง `name`/การส่งใน `<form>` และไม่มี validation ในตัว
- พฤติกรรมของ Radix Select (`@radix-ui/react-select` 2.4.1 ที่ `radix-ui` 1.8.1 ใช้ — ตรวจจาก source ใน `node_modules`; skill `building-storefronts`/`storefront-best-practices`
  เรียกไม่ได้ใน session ของ planner):
  - อยู่ใน `<form>` (หรือมี prop `form`) → render `<select aria-hidden tabindex=-1>` ซ่อน (visually hidden ไม่ใช่ `display:none`) ที่รับ `name`, `required`, `disabled`,
    `autoComplete`, `form` → `FormData`/constraint validation native ใช้ได้; **option ของ select ซ่อนถูกเติมหลัง hydrate** (item mount ใน DocumentFragment ฝั่ง client) —
    HTML จาก server มีแค่ option ว่างเมื่อยังไม่เลือก (มีค่า → ไม่มี option เลย จึงไม่ส่งค่าเมื่อปิด JS)
  - ฟัง event `reset` ของฟอร์ม แล้วตั้งค่ากลับเป็นค่าตอน mount — แบบ controlled จะเรียก `onValueChange(ค่าตอน mount)` (React 19 reset `<form action>` หลัง action → ทับค่าที่ลูกค้าเลือก
    ถ้าไม่กัน — spec 01 กฎ 110d)
  - `SelectItem value=""` **ไม่ใช้** (2.4.1 ไม่ throw แต่ค่า `""` = ล้างค่า/แสดง placeholder จึงเลือกเป็นค่าจริงไม่ได้) · `SelectValue` ไม่มี children → แสดงข้อความของ item ที่เลือกได้หลัง hydrate เท่านั้น;
    **มี children → แสดง children ตายตัว** (ไม่ตามค่าที่เลือก) → ผู้เรียกต้องคำนวณ children จากค่าปัจจุบัน (state จาก `onValueChange` แม้เป็น `defaultValue` — spec 09 กฎ 40b)
  - trigger เป็น `<button role="combobox" aria-required>`; event `invalid` เกิดที่ select ซ่อน (ไม่ใช่ trigger) และไม่ bubble — ต้องฟังแบบ capture ที่ container
  - ปิด JavaScript → trigger เปิดไม่ได้ (เลือกค่าไม่ได้)
- e2e ใช้ `selectOption` กับ select ของเรา ~47 ครั้งใน 25 ไฟล์ + `toHaveValue`/อ่าน `<option>` ~18 จุด (รวม `support/stripe.ts` ~บรรทัด 116 = `shipping-country-select` ของเรา; **ไม่นับ** `fillCard` ในไฟล์เดียวกัน ~บรรทัด 158 ซึ่งเป็น select ใน iframe ของ Stripe — คง `selectOption`)
- ไม่มี select ตัวใดในขอบเขตที่เปลี่ยนแล้ว navigate (ตัวเลือกภูมิภาค `layout/country-select` เป็น Radix อยู่แล้ว; sort/filter เป็น `RadioGroup`) — จำนวนในตะกร้ายิง server action ทันทีที่เปลี่ยน
- Medusa ไม่มี component ฟอร์มของ storefront และ medusajs.com/integrations ไม่มี plugin UI ของ storefront

## ทางเลือก
### D1 — ประกอบอย่างไร
- ก (planner เสนอเดิม) component กลางใหม่ `common/components/select-field` (`SelectField`) ห่อ `Field` + `Select*` — **owner ไม่รับ**: ประกอบเองโดยไม่จำเป็น
- ข wrapper `src/components/select.tsx` แบบ spec 09 กฎ 3 — ไม่จำเป็น (ไม่ต้องเพิ่มความสามารถให้ primitive)
- **ค′ (owner 2026-11-28 — เลือก)** ใช้ `select`/`field`/`label` ของ shadcn ที่ติดตั้งด้วย CLI (ยืนยันว่าตรง registry ด้วย `pnpm dlx shadcn@4.23.1 add select field label --dry-run --diff` → "No changes."
  ทีละตัว) แล้ว**ผู้เรียกประกอบตามตัวอย่างใน docs ตรงที่ใช้** (`Field` → `FieldLabel` → `Select` → `SelectTrigger` → `SelectValue` → `SelectContent` → `SelectItem`) — ไม่มี component กลางใหม่;
  เขียนเองเฉพาะ "ส่วนที่จำเป็น" (ข้อ 2 ของการตัดสินใจ)
- ง ใช้ `form` ของ shadcn (react-hook-form + zod) — dependency ใหม่ 3 ตัว + เปลี่ยนวิธีส่งฟอร์มจาก server action → **ไม่เลือกโดยไม่ถาม owner** (Q-R49-6)
- จ `combobox` ของ shadcn — Base UI (dependency ใหม่, ขัด ADR-030) · ฉ `native-select` ของ shadcn — native (ขัดคำสั่ง)

### D2 — ค่าว่าง / placeholder
- **ก (เลือก)** placeholder = `SelectValue placeholder` (ข้อความเดิมของแต่ละช่อง) ไม่ใช่ item; ค่า `""` = ยังไม่เลือก; item = option เดิมที่ value ไม่ว่าง;
  `<option value="">-</option>` ของ `profile-billing-address` **ตัดออก** (ช่อง `required`)
- ข ค่า sentinel แทน `""` — ค่าใน `FormData` เปลี่ยน ต้องแก้ server action

### D3 — error ระดับช่อง (แทนกฎ 32 ส่วน `<select>`)
- **ก (เลือก)** ฟัง `invalid` ของ select ซ่อนแบบ capture บน `Field` → `preventDefault()` + ข้อความไทยจาก `fieldErrorMessage` เดิม, `Field data-invalid` + `SelectTrigger aria-invalid` (ตาม docs) + `aria-describedby`,
  focus trigger ของช่องแรกที่ผิด — ขยาย `useFieldError` เดิม
- ข ตรวจค่าว่างเองใน `onSubmit` ของแต่ละฟอร์ม

### D4 — ฟอร์ม/`FormData`/reset
- **ก (เลือก)** ใช้ select ซ่อนของ Radix (`name`) → `FormData` ชื่อ/ค่าเดิม; uncontrolled ใช้ `defaultValue`; controlled ต้องคงค่าเมื่อฟอร์ม reset (กันใน `CountrySelect` — ผู้ใช้ controlled ในฟอร์มมีแค่ที่นี่)
- ข `<input type="hidden" name>` ของเราเอง — ซ้ำกับ Radix และเสีย `required`

### D5 — มือถือ
- **ก (เลือก)** popover ของ Radix ทุกอุปกรณ์ · ข native บนจอสัมผัส

### D6 — PDP เมื่อปิด JavaScript
- ก native เฉพาะ HTML แรกแล้วสลับเป็น Radix — **owner ไม่รับ**
- **ข (owner เลือก)** ปิด JS แล้ว**จำนวนเป็น 1 เสมอ**: `Select` บน PDP ไม่มี `name` (ฝั่ง JS ส่งจำนวนผ่าน `addToCart` ไม่ใช้ `FormData`) → ฟอร์ม no-JS ไม่ส่ง `quantity`
  → route `/<cc>/cart/add` ใช้ `clampLineItemQuantity(undefined)` = 1 (มีอยู่แล้ว ไม่แก้ route) · แทนถ้อยคำ spec 01 กฎ 59, AC-44, AC-94 (spec 09 กฎ 47a)
- ค PDP คง native — ขัดคำสั่ง

### D7 — e2e
- **ก (เลือก)** helper กลาง `e2e/support/select.ts` หาด้วย testid เท่านั้น (trigger `<t>`, `<t>-options`, `<t>-option` + `data-value`; trigger มี `data-value`)
- ข `getByRole("option", { name })` — ขัด CLAUDE.md

## การตัดสินใจ (owner accepted 2026-11-28)
D1 = ค′, D2 = ก, D3 = ก, D4 = ก, D5 = ก, D6 = ข, D7 = ก — รายละเอียดเป็นกฎ 39–51 ของ spec 09:
1. **component ของ shadcn**: ใช้ `select`, `field`, `label` ที่มีใน `src/components/ui/` (ไม่ add ตัวใหม่; SFUI-15 ยืนยันด้วย `--dry-run --diff` ว่าไฟล์ตรง registry ของ 4.23.1 — ไม่ตรง → `add --overwrite`
   + อัปเดต hash ใน `e2e/support/shadcn-ui.json`); ไม่ใช้ `native-select`, `combobox`, `form`; ไม่แก้ `src/components/ui/*`
2. **ส่วนที่เขียนเอง (เท่าที่จำเป็น) — ไม่มีส่วนอื่นนอกจากนี้**:
   | ส่วน | ที่อยู่ | เหตุผลที่ shadcn/Radix ไม่มีให้ | ผู้ใช้ |
   |---|---|---|---|
   | error ระดับช่องของ select (ขยาย `useFieldError` เดิม: ฟัง `invalid` แบบ capture, ข้อความไทย, `aria-invalid`/`aria-describedby`, focus trigger) | `common/components/input/index.tsx` (export เดิม) | docs แสดงแค่การใส่ `data-invalid`/`aria-invalid` เอง ไม่มี validation; `invalid` เกิดที่ select ซ่อนที่ไม่ bubble | select `required` 5 ตัว (≥ 2) |
   | กัน form reset ทับค่า controlled | `checkout/components/country-select` (ผู้ใช้เดียว — ไม่แยก hook) | พฤติกรรมของ Radix (`reset` → `onValueChange(ค่าตอน mount)`) ชน spec 01 กฎ 110d | ประเทศ checkout 2 ช่อง |
   | `CountrySelect` (คงไว้ — แปลง `region.countries` เป็น `SelectItem`) | `checkout/components/country-select` (มีอยู่แล้ว) | logic ของโดเมน ไม่ใช่ UI primitive | 4 ฟอร์ม |
   | helper e2e | `e2e/support/select.ts` | test code | ~25 spec |
   ที่เหลือ (testid, `data-value`, `SelectValue` children สำหรับ HTML แรก, `aria-label`, `*` ของ label) เป็น prop/markup ที่ผู้เรียกใส่ตามตัวอย่าง docs — ไม่ใช่ component ใหม่;
   ลบ `common/components/native-select` และ `cart/components/cart-item-select` (ผู้เรียกประกอบเอง)
3. หน้าตา select = default ของ shadcn (`SelectTrigger` `h-9` = 36px, `SelectContent` `item-aligned`) — ยกเว้นกฎ "คง computed style" (spec 09 กฎ 19/27) เฉพาะ trigger/กล่องรายการ/label ของ select ในรอบนี้
4. testid เดิมอยู่บน trigger; testid ใหม่ `<t>-options`/`<t>-option` (+ `<t>-label`/`<t>-error` ตามกฎ 29)
5. ทำแบบ stack เหมือนรอบ 44–48 (Q-R49-3)

## ผลที่ตามมา
+ select ทั้งร้านหน้าตา/พฤติกรรมเดียวกัน (popover ของ shadcn) ตรงคำสั่ง owner; ไม่มี component กลางใหม่ — โครงตรงตัวอย่าง docs ของ shadcn ดูแลง่ายเมื่อ docs เปลี่ยน
+ `FormData`/`required` ยังเป็นของ browser (select ซ่อนของ Radix) — server action ไม่ต้องแก้
− markup ของ select ซ้ำในผู้เรียก ~8 จุด (`Field` + `FieldLabel` + `*` + `Select*` ~15–25 บรรทัด/จุด) — owner เลือกแลกกับการไม่มี abstraction ของเราเอง
− e2e ~25 ไฟล์ต้องเปลี่ยนวิธีโต้ตอบกับ select (เครื่องกลผ่าน helper) — reviewer ตรวจว่าเปลี่ยนเฉพาะบรรทัดโต้ตอบ/อ่าน select (spec 09 กฎ 49)
− **ปิด JS แล้วเลือกจำนวนบน PDP ไม่ได้ (ได้ 1 เสมอ)** — ถอยจากความสามารถของ CORE-24 (owner ยอมรับ); ช่อง select อื่นใช้ไม่ได้เมื่อปิด JS (ไม่เคยเป็น AC)
− มือถือเสีย picker ของระบบ · autofill ประเทศอาจไม่เติม select ซ่อน (ลูกค้าเลือกเองหนึ่งครั้ง)
− จำนวนในตะกร้า: ปุ่มตัวอักษร/ลูกศรบน trigger ที่ปิดอยู่เปลี่ยนค่าทันที (typeahead ของ Radix) → ยิง server action ต่อครั้ง เหมือน `<select>` บน Windows
− unit (jsdom) ที่ render Radix Select ต้อง polyfill `hasPointerCapture`/`scrollIntoView`/`ResizeObserver` (ADR-030 ผลที่ตามมา)
− **release v0.4.0 (#603) พักจนรอบ 49 (และ SFUI-14 #612) merge ครบ** (owner 2026-11-28)

## การแก้ ADR เดิม (มีผลแล้ว — ADR นี้ accepted 2026-11-28; ไม่แก้ไฟล์ ADR เดิม ข้อนี้มีผลเหนือถ้อยคำเดิม)
- ADR-030 ข้อ 5: ท่อน "**`<select>` native คงเป็น native** … `selectOption`, ฟอร์ม server action อ่าน `FormData`" → "`<select>` → `Select` ของ shadcn ประกอบตามตัวอย่าง docs (ADR-033)"
- ADR-032 ข้อ 4 (`NativeSelect` คงเป็น `<select>`), D2 ท่อน "`<select>` คง option ว่างเดิม", D4 ท่อน "ไม่มี JS → bubble native" ส่วน `<select>` → แทนด้วย D2/D3/D6 ของ ADR นี้

## แหล่งอ้างอิง (ตรวจ 2026-11-28)
- `node_modules/.pnpm/@radix-ui+react-select@2.4.1…/dist/index.mjs`: `SelectProvider` (`isFormControl`, listener `reset`), `SelectBubbleInput` (select ซ่อน, `name`/`required`/`autoComplete`/`form`, option จาก `nativeOptionsSet`), `shouldShowPlaceholder` (`""`/`undefined`)
- `apps/storefront/src/components/ui/select.tsx` (ผล CLI — `SelectTrigger` `data-[size=default]:h-9 w-fit`, `SelectContent` `position="item-aligned"`)
- https://ui.shadcn.com/docs/components/select (invalid: `Field data-invalid` + `SelectTrigger aria-invalid`) · https://ui.shadcn.com/docs/components/field
- https://ui.shadcn.com/r/styles/new-york-v4/registry.json · `…/form.json` (deps `react-hook-form`, `@hookform/resolvers`, `zod`) · `…/combobox.json` (deps `@base-ui/react`)
- `apps/storefront/src/lib/util/pending-add-to-cart.ts` `clampLineItemQuantity` (ไม่มีค่า → 1)
