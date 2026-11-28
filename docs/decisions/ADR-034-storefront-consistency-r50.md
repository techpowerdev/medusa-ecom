# ADR-034 storefront: ปุ่มขนาดเดียว (default ของ shadcn), ซ่อนประเทศ, จังหวัดบังคับ และ consistency จาก audit บน browser (รอบ 50)

สถานะ: **accepted** (owner 2026-11-28 — ตัดสินทุกข้อในหัวข้อ "การตัดสินใจ" ก่อนเขียน ADR นี้; เพิ่ม D8 + D4 ค หลัง review #624 (owner 2026-11-28: Q-R50-1 = ทำ, Q-R50-2 = ใช้ `Alert`); planner บันทึก 2026-11-28)
เกี่ยวข้อง: spec 09 หัวข้อ "ส่วน consistency + ที่อยู่ (รอบ 50)" (กฎ 58–80, AC-55–AC-70, task SFUI-19a..22 รวม 21c/21d) · **แทนบางข้อของ** spec 09 กฎ 20, 31, 40c, 41–44, 53–55, 57,
spec 01 กฎข้อ 55/56, 63(d), 73(c), 110(b)(d), 116(a), 121(a), 137, 146(a) + AC-91, AC-99, AC-147, AC-178, AC-187, และ ADR-033 ส่วน `CountrySelect` (ข้อ 2 แถว "กัน form reset ทับค่า controlled" และ "`CountrySelect` คงไว้")
— **ADR-033 ถูกแทนบางส่วนด้วย ADR-034** (ไม่แก้ไฟล์ ADR-033 — ADR เก่าไม่แก้; ดูหัวข้อ "การแก้กฎ/ADR เดิม")
เลข ADR: ADR-033 ล่าสุด, ADR-020/ADR-027 สงวนไว้ → ใช้ **ADR-034**

## บริบท
- owner ทดสอบ storefront หลังรอบ 49 (2026-11-28, ก่อน release v0.4.0 — #603 ยังไม่ merge) แล้วสั่ง: (1) จังหวัดบังคับกรอก, (2) ซ่อนช่องประเทศ ส่ง `th` เสมอ (ขายแค่ไทย)
  และซ่อนบรรทัดประเทศในสรุปที่อยู่, (3) **ทุกปุ่มขนาดเท่ากัน = default ของ shadcn** รวมปุ่มจ่ายเงินและลิงก์สลับ login/สมัคร, (4) ตรวจ consistency ทั้งร้านบน browser จริงแล้วแก้
  โดย "ใช้ค่ามาตรฐานของ component shadcn ที่ติดตั้ง ไม่แก้โดยไม่จำเป็น" และถ้า shadcn มี component ให้ `pnpm dlx shadcn@4.23.1 add` แล้วประกอบตาม docs (หลักเดียวกับ ADR-033 D1), (5) รวมใน v0.4.0
- audit ของ qa บน prod build ของ develop `523056bb` (1280×800 + 390×844, `getComputedStyle`): ปุ่ม 57/61 ตัว — **ไม่ใช่ 36px 39/40 ตัว** (shadcn ที่ override ขนาด 12: 48px 7, 40px 4, 32px 1;
  `InputGroupButton` `icon-xs` 24px 3 = pattern ของ shadcn; ไม่ใช่ shadcn 24); `Input`/`SelectTrigger` 36px ยกเว้น override 2 จุด และ `<input>` ดิบ 3 จุด; error ระดับฟอร์ม `text-rose-500` 12–14px 12 จุด
  ขณะที่ error ระดับช่อง (`FieldError`) เป็น `text-destructive` 14px; checkbox native 13px 2 จุด; gap ระหว่างช่องฟอร์ม 4 ค่า (8/16px ปนกัน); `h1` 5–6 ขนาด (16–32px, บางหน้า `uppercase`)
- ข้อขัดกับของเดิม:
  - spec 09 กฎ 20: `large` → `lg` + `h-12` (48px) เพราะ D-1 ของ qa รอบ 44 — ปุ่ม 40px ทำให้คลิก `submit-payment-button` หลังกรอกบัตรตกใน iframe ของ Stripe; บังคับด้วย `e2e/sfui-button-lg.unit.spec.ts` และ `sfui-3d-payment.spec.ts` (48px)
  - spec 01 กฎ 137 / 146a (CORE-79/90): ลิงก์สลับฟอร์ม auth พื้นที่แตะ ≥ 44px (e2e `core-79-login-link-mobile`, `core-90-auth-toggle`)
  - spec 09 กฎ 41–44/53–55/57 + ADR-033: ช่องประเทศเป็น `Select` บังคับใน 5 ฟอร์ม, `CountrySelect` กัน form reset ทับค่า, สรุปที่อยู่มีบรรทัดประเทศ, `REQUIRED_ADDRESS_FIELDS` ไม่มี `province`
- shadcn registry `new-york-v4` (ตรวจ 2026-11-28): `button` sizes `default` `h-9` (36px), `icon` `size-9`, `xs`/`sm`/`lg`/`icon-xs`/`icon-sm`/`icon-lg`; `InputGroupButton` (ใน `input-group` ที่มีแล้ว) size `xs`/`sm`/`icon-xs`/`icon-sm`
  ตามตัวอย่าง docs ปุ่มในช่องใช้ `icon-xs`; `pagination` (deps `button`; `PaginationLink` = `<a>` + `buttonVariants` ghost/outline size `icon`; `Pagination` `aria-label="pagination"` และ
  `PaginationPrevious`/`Next`/`Ellipsis` มีข้อความอังกฤษตายตัว); `toggle-group` (deps `toggle`; prop `spacing`); `checkbox`, `field`, `input`, `input-group`, `select`, `dialog`, `sheet`, `accordion` มีแล้ว;
  `switch`, `alert`, `command` ไม่ได้ติดตั้ง
- Medusa ไม่มี component UI ของ storefront; medusajs.com/integrations ไม่มี plugin UI ของ storefront · Address ของ Medusa มี `province` (string) และ `country_code` — ไม่ต้องแก้ backend

## ทางเลือก
### D1 — ขนาดปุ่ม
- **ก (owner เลือก)** ทุก `Button`/`buttonVariants` ใช้ size `default` (36px) — ปุ่มที่มีแต่ icon ใช้ `icon` (36×36) — ไม่มี className ที่เปลี่ยนความสูง/padding/ขนาดตัวอักษร; รวมปุ่มจ่ายเงิน
  ยกเว้นข้อเดียว: `InputGroupButton` size `icon-xs` ภายใน `InputGroupAddon` (pattern ของ docs `input-group` — ปุ่มแสดงรหัสผ่าน, ปุ่มล้างคำค้น)
- ข คงปุ่มจ่ายเงิน/ปุ่มหลัก `lg` (40px) หรือ 48px — owner ไม่รับ ("ทุกปุ่มขนาดเท่ากัน")
- ค ให้ `InputGroupButton` เป็น 36px ด้วย — ปุ่มจะสูงเท่ากล่อง `InputGroup` (36px) ซ้อนขอบ ผิดตัวอย่าง docs → ไม่เลือก
### D2 — ความเสี่ยงคลิกตก iframe ของ Stripe เมื่อปุ่มจ่ายเงินเหลือ 36px
- **ก (เลือก)** ปุ่มเป็น 36px ตาม D1; **พิสูจน์ด้วย e2e บน Stripe test จริง** ว่า ณ จุดกลางของ `submit-payment-button` หลังกรอกบัตร `document.elementFromPoint` คือปุ่ม (ไม่ใช่ iframe)
  และกดแล้วไปขั้น review; ถ้าตกจริง แก้ที่ระยะห่าง/layout รอบปุ่ม (ไม่ใช่ความสูงปุ่ม) หรือหยุดรายงาน planner
- ข ใส่ `h-12` เฉพาะปุ่มจ่ายเงิน — ขัด D1
### D3 — ลิงก์/ปุ่มที่ไม่ได้ใช้ shadcn (~25 จุด) และลิงก์สลับฟอร์ม auth
- **ก (owner เลือก)** เป็น `Button` (action) หรือ `<Button asChild>` ครอบลิงก์ (navigation — ได้ `data-slot="button"`) variant ตามบทบาท (`default`/`outline`/`ghost`/`link`), size `default`/`icon`;
  ลิงก์สลับ login/สมัคร = `Button variant="link"` size default (36px) — เลิก ≥ 44px ของ spec 01 กฎ 137/146a
- ข คง 44px สำหรับลิงก์ auth (เหตุผล a11y เดิม) — owner ไม่รับ; ข้อสังเกต: 36px ต่ำกว่า 44×44 ของ WCAG 2.5.5 (AAA) แต่ผ่าน 24×24 ของ 2.5.8 (AA) — owner ยอมรับ
### D4 — component ที่ shadcn มีให้ (ตามหลัก "ถ้ามีให้ `shadcn add`")
- **ก (เลือก)** `shadcn add pagination` (แบ่งหน้า 2 จุด), `shadcn add toggle-group` (ได้ `toggle` + `toggle-group` — chip ตัวกรองตัวเลือกสินค้า); checkbox ตัวกรอง → `ui/checkbox` ที่มีแล้ว;
  ช่องค้นหา → `ui/input` + `Button` (ตัวอย่าง docs "Input with button") และ `ui/input-group`; ปุ่มปิด overlay → `DialogClose`/`SheetClose asChild` + `Button variant="ghost" size="icon"`
  ส่วนที่ไม่ใช้จาก `pagination`: `PaginationPrevious`/`PaginationNext` (ข้อความอังกฤษ; ร้านไม่มีปุ่มก่อน/ถัดไปอยู่แล้ว), `PaginationEllipsis` (`sr-only` "More pages" ตายตัว) → จุดไข่ปลาคง `<span aria-hidden>` เดิม;
  `Pagination` ส่ง `aria-label="แบ่งหน้า"` ทับ (prop ถูก spread หลังค่าเริ่มต้น)
- ข `switch` สำหรับ "เฉพาะสินค้าลดราคา" — ต้อง add component ใหม่และต่างจาก checkbox ตัวกรองข้างกัน → ไม่เลือก (ใช้ checkbox ทั้งกลุ่ม)
- **ค (owner เลือก 2026-11-28 — Q-R50-2)** `shadcn add alert` → error ระดับฟอร์ม**ทุกจุด** = `Alert variant="destructive"` + icon + `AlertDescription` ผ่าน `ErrorMessage` เดิม
  (testid คงเดิมบน `Alert` root, `role="alert"` จาก component) — แทนข้อเสนอเดิมของ planner (ข้อความ `text-sm text-destructive`) ที่ owner ไม่รับ
- ง `ToggleGroup type="single"` แทน radio ของตัวเลือกสินค้า (`option-select`) — radio native เป็นส่วนของฟอร์ม no-JS บน PDP และ Radix ToggleGroup ไม่ส่งค่าใน `<form>` → ไม่เลือก (นอกขอบเขต)
- จ `command` สำหรับช่องค้นหาใน drawer — เป็นการออกแบบใหม่ ไม่ใช่การถอด override → ไม่เลือก (ช่อง `search-input` ของ drawer คงเดิม)
### D5 — ประเทศในฟอร์มที่อยู่
- **ก (owner เลือก)** ไม่ render ช่องประเทศ; ฟอร์มส่ง `<input type="hidden" name="<prefix>country_code" value="th">` (ค่าคงที่เดียว `ADDRESS_COUNTRY_CODE` ใน `lib/util/address-required.ts`);
  ลบ `checkout/components/country-select` และกลไกกัน reset ทับค่าที่มีไว้เพื่อมัน (ไม่มีผู้ใช้แล้ว — ห้ามเก็บไว้เผื่อ); สรุปที่อยู่ไม่มีบรรทัดประเทศ;
  state ของ checkout (`formData`) เก็บ `country_code = ADDRESS_COUNTRY_CODE` คงที่ เพื่อให้ `compareAddresses` (เทียบ `country_code` ด้วย) ยังจับคู่ที่อยู่ที่บันทึกไว้ใน `shipping-address-select` ได้
  (review #624 — เลือกทาง (ก) แทน (ข) "เอา `country_code` ออกจาก `compareAddresses`" เพราะเปลี่ยนน้อยกว่า, ไม่กระทบการตัดสิน "ใบเสร็จเหมือนที่อยู่จัดส่ง" และ `formData` = ค่าที่ส่งจริง)
- ข อ่าน `country_code` จาก `region.countries` ตัวแรก — ซับซ้อนกว่าโดยไม่จำเป็น (ร้านเปิดแค่ไทย และ Medusa ปฏิเสธประเทศนอก region อยู่แล้ว)
- ค server action บังคับ `th` เอง (ไม่อ่าน `FormData`) — เปลี่ยน server action ทุกตัวโดยไม่จำเป็น → ไม่เลือก
### D6 — ตัวเลือก region ในเมนูข้าง (`layout/components/country-select`)
- **ก (owner เลือก)** ซ่อน (ไม่ render `CountrySelect` และลูกศร) เมื่อรวมประเทศจากทุก region ได้ ≤ 1 ประเทศ; มี ≥ 2 แสดงตามเดิม (ถอด override ความสูงของ trigger ด้วย)
- ข ลบทิ้ง — เสียความสามารถเมื่อเปิดหลายประเทศ → ไม่เลือก
### D7 — consistency อื่นจาก audit (owner ตัดสิน 2026-11-28)
- gap ระหว่างช่องฟอร์ม = **16px (`gap-4`) ค่าเดียวทุกฟอร์ม** (ไม่ใช้ `FieldGroup` ของ shadcn เพราะ default `gap-7` = 28px ต่างจากค่าที่ owner เลือก)
- `h1` ทุกหน้า **ขนาดเดียว** = `text-3xl font-semibold tracking-tight` (ตาม typography ของ shadcn ระดับ h2 — `text-3xl` ของ theme เรา = 2rem → 32px) ถอด `uppercase`; hero หน้าแรกคงเดิม
- error ระดับฟอร์ม = `Alert` ของ shadcn (D4 ค — ไม่มี `text-rose-*`)
- ถอด override ที่ทำให้ต่างจาก default: `SelectTrigger` (`checkout/address-select`, `layout/country-select`), `AccordionTrigger` (`product-tabs`, `option-refinements`), icon ในปุ่ม (`size-*` → default `size-4` ของ `Button`)

### D8 — การ์ดตัวเลือกจัดส่ง/ชำระเงิน (owner 2026-11-28 — Q-R50-1 = ทำรอบนี้)
- สภาพเดิม: การ์ดจัดส่งมีขอบ 1px ที่ `RadioGroupItem` (`OPTION_CLASS` ของเรา) แต่การ์ดชำระเงิน `RadioGroupItem` `border-0` กรอบอยู่ที่ container + `OptionDot` วาด indicator เอง
- **ก (เลือก)** pattern "Choice Card" ของ docs shadcn (`field` + `radio-group` — มีใน `ui/field` แล้ว: `FieldLabel` ที่ครอบ `Field` ได้กรอบ/`has-data-[state=checked]:border-primary bg-primary/5`):
  `FieldLabel htmlFor` → `Field orientation="horizontal"` → `FieldContent` (`FieldTitle`/`FieldDescription`) → `RadioGroupItem` (indicator default) — ทั้งสองขั้น; testid/attribute ของ e2e คงบน `RadioGroupItem`;
  ช่องบัตร/QR ของ Stripe อยู่ถัดจาก label (ไม่อยู่ใน `<label>`)
- ข ใส่ขอบแบบการ์ดจัดส่งให้การ์ดชำระเงิน (class ของเรา) — ไม่ใกล้ default ของ shadcn → ไม่เลือก

## การตัดสินใจ (owner accepted 2026-11-28)
D1 = ก, D2 = ก, D3 = ก, D4 = ก + ค, D5 = ก, D6 = ก, D7 ตามข้อความข้างบน, D8 = ก — รายละเอียดเป็นกฎ 58–80 ของ spec 09; **ข้อยกเว้นเดียวของ "ทุกปุ่ม 36px"**: `InputGroupButton size="icon-xs"` ใน `InputGroupAddon`
(ปุ่มที่ไม่ใช่ปุ่มตามความหมาย — `RadioGroupItem`, `Checkbox`, `AccordionTrigger`, `SelectTrigger`, `SheetTrigger` ของ `nav-menu-button`, การ์ด `add-address-button` — ไม่อยู่ใต้กฎขนาดปุ่ม; ดูกฎ 79)
ทำแบบ stack เหมือนรอบ 44–49; รวมใน v0.4.0 (#603 พักจนรอบ 50 merge ครบ)

## ผลที่ตามมา
+ ปุ่มทั้งร้านสูงเท่ากันและหน้าตาตาม default ของ shadcn — guard static กันขนาดกลับมา; โค้ดน้อยลง (ลบ override ~40 จุด, `CountrySelect` ของ checkout, `@utility contrast-btn`)
+ ฟอร์มที่อยู่สั้นลงหนึ่งช่อง และไม่มี error "กรุณาเลือกประเทศ" ใน modal เพิ่มที่อยู่ (เดิมส่งค่าว่าง)
− ปุ่มหลัก (จ่ายเงิน, ไปตะกร้า, เพิ่มลงตะกร้า) เล็กลงจาก 40–48px เป็น 36px — พื้นที่แตะบนมือถือลดลง (owner ยอมรับ) และต้องพิสูจน์ D2 ทุกครั้งที่แตะขั้นชำระเงิน
− ถอยจากเกณฑ์ ≥ 44px ของ CORE-79/90 (spec 01 กฎ 137/146a) — e2e `core-79`, `core-90` เปลี่ยนเกณฑ์เป็น 36px
− e2e ~25 ไฟล์ที่เลือก/ตรวจประเทศต้องแก้ (ลบบรรทัดเลือกประเทศ) และ e2e ฟอนต์ของรอบ 45 (`sfui-9a..9e`, `sfui-5b/5c`) ที่ล็อกขนาดหัวข้อต้องเปลี่ยนค่าที่คาด (หน้าตาตั้งใจเปลี่ยน — ยกเว้นกฎ 19)
− ที่อยู่เดิมของลูกค้าที่ไม่มีจังหวัดต้องกรอกเพิ่มเมื่อเลือกใช้ใน checkout (error ระดับช่องเหมือนตำบลในรอบ 49) · ที่อยู่เดิมที่ `country_code` ไม่ใช่ `th` ถูกบันทึกเป็น `th` เมื่อแก้ไขผ่านฟอร์ม
− error ระดับฟอร์มเปลี่ยนจากข้อความบรรทัดเดียวเป็นกล่อง `Alert` (มีขอบ + icon) — หน้าตาเปลี่ยนมากขึ้นตามที่ owner เลือก; การ์ดตัวเลือกเปลี่ยนเป็น Choice Card (indicator วงกลมของ shadcn แทน `OptionDot`)
  และข้อความชื่อ/ราคาย้ายออกจาก `RadioGroupItem` → e2e ที่อ่านข้อความภายใน testid ของตัวเลือกต้องแก้ (spec 09 กฎ 78 (iv))
− component ใหม่ใน `ui/` 4 ไฟล์ (`pagination`, `toggle`, `toggle-group`, `alert`) + hash ใน `e2e/support/shadcn-ui.json` — ไม่มี dependency ใหม่ (`radix-ui`, `lucide-react`, `class-variance-authority`, `cn` มีแล้ว)
− แบ่งหน้าเปลี่ยนจาก `<button>` เป็นลิงก์ `<a href>` (ตามตัวอย่าง docs) — มี `href` จริงของหน้าถัดไป (กดด้วย JS ยังใช้ router/`refine` เดิม)
− **release v0.4.0 (#603) พักจนรอบ 50 merge ครบ** (owner 2026-11-28)

## การแก้กฎ/ADR เดิม (มีผลเมื่อ task เจ้าของ merge; ไม่ลบถ้อยคำเดิม — ใส่หมายเหตุ "แทนด้วยรอบ 50" ในไฟล์)
- spec 09 กฎ 20 ท่อน "`large` → `lg` + `h-12` คงความสูง 48px" และ `IconButton` → `Button variant="ghost" size="icon"` (ยังมีผล) → แทนด้วยกฎ 59–61 (SFUI-19a)
- spec 09 กฎ 40c (2)(3), 41 (placeholder `เลือกประเทศ`, `billing-country-code-select`), 42 (กัน reset ใน `CountrySelect`), 43 (รายการ select บังคับ "ประเทศ 4 ฟอร์ม + `billing-country-code-select`"),
  44 (ยังมีผลกับ select ที่เหลือ), 53 (ช่องประเทศในลำดับ DOM), 54 (ประเทศแถวละช่อง) → แทนด้วยกฎ 70 (SFUI-20b); กฎ 55 (ช่องบังคับ + ข้อความ) → กฎ 69 (SFUI-20a); กฎ 57 (บรรทัดประเทศ) → กฎ 71 (SFUI-20c)
- spec 09 กฎ 31 + AC-35 (ท่อน `CountrySelect` — option `เลือกประเทศ`, label เริ่มต้น `ประเทศ`), AC-28/32/34/44/49/53 (ส่วนประเทศ/ข้อความ) → กฎ 69–70 (SFUI-20a/20b)
- spec 01 กฎข้อ 137, 146a และ AC-178, AC-187 ท่อน "≥ 44px" → "ปุ่ม `Button variant="link"` size default สูง 36px" (SFUI-19b); ส่วนอื่น (เติมอีเมล, testid ไม่ซ้ำ, ลิงก์ไม่ซ้อนปุ่ม) ยังมีผล
- spec 01 กฎข้อ 55/56 + AC-91 (placeholder `CountrySelect`), 63(d) + AC-99 (ความสูง `CountrySelect`), 73(c) (`billing-country-code-select` สูงเท่า input),
  110(d) + AC-147 (select ประเทศคงค่าหลัง error / `toHaveValue("th")`) → spec 09 กฎ 70 (SFUI-20b)
- spec 01 กฎข้อ 110(b), 116(a) (รายการช่องบังคับ) และ 121(a) (`province` เป็นช่องไม่บังคับ) → spec 09 กฎ 69 (+`province`; SFUI-20a)
- spec 09 กฎ 32e / AC-33 (ข้อความระดับฟอร์มคงตำแหน่ง/testid/ข้อความ) ยังมีผล — หน้าตาเป็น `Alert` ตามกฎ 74 (SFUI-21d)
- ADR-033 ข้อ 2 แถว "กัน form reset ทับค่า controlled" และ "`CountrySelect` (คงไว้)" → ลบพร้อม `CountrySelect` (SFUI-20b); `useFieldError` สำหรับ select และ helper `e2e/support/select.ts` ยังมีผล
- ไม่แก้: spec 01 CORE-85 (ลิงก์ช่องทางติดต่อ ≥ 44px — เป็นลิงก์ข้อความ ไม่ใช่ปุ่ม), ADR-030/032 (ยังมีผลทั้งหมด)

## แหล่งอ้างอิง (ตรวจ 2026-11-28)
- `apps/storefront/src/components/ui/button.tsx` (ผล CLI — sizes ข้างบน), `…/ui/input-group.tsx` (`InputGroupButton` sizes)
- https://ui.shadcn.com/r/styles/new-york-v4/pagination.json · `…/toggle-group.json` (registryDependencies `toggle`, deps `radix-ui`, `cn`) · `…/alert.json` (deps `cn`, `role="alert"`, `data-slot="alert"`)
  · https://ui.shadcn.com/docs/components/field (Choice Card) · https://ui.shadcn.com/docs/components/input (Input with button)
  · https://ui.shadcn.com/docs/components/input-group · https://ui.shadcn.com/docs/components/typography
- ผล audit ของ qa รอบ 50 ขั้น 0 (develop `523056bb`) — รายการ file:line อยู่ในตาราง inventory ของ spec 09 รอบ 50
