# 01 Core commerce — สิ่งที่ Medusa v2 มีให้เราอยู่แล้ว

สถานะ: accepted
เป้าหมาย: ร้านค้าพื้นฐานที่สมบูรณ์และพร้อม production โดย **ไม่มี custom commerce logic เลย**
ทุกอย่างใน spec นี้คือการตั้งค่า, seeding, theming และ deployment

## สิ่งที่ Medusa มีให้อยู่แล้ว (ห้ามสร้างใหม่)
| ความสามารถ | Medusa module / feature | สิ่งที่เราทำ |
|------------|-------------------------|------------|
| Products, variants, options, images, categories, collections, tags, types | Product module | Seed + admin |
| Pricing, price lists, currency, tax-inclusive pricing | Pricing module | ตั้งค่า THB |
| Inventory, stock locations, reservations | Inventory + Stock Location | ใช้ 1 location |
| Regions, countries, currencies | Region module | Region "Thailand", THB |
| Sales channels, publishable API keys | Sales Channel + API Key | Default channel |
| Cart, line items, shipping/billing address, totals | Cart module + core flows | Storefront ใช้งาน |
| Promotions, campaigns, budgets, rules, automatic/code | Promotion module | ฐานสำหรับ flash sale |
| Orders, order edits, returns, exchanges, claims | Order module | Admin |
| Payments, sessions, capture, refund, webhooks | Payment module + Stripe provider | Spec 06 |
| Fulfillment, shipping options, providers | Fulfillment module (manual provider) | + digital provider (spec 02) |
| Customers, groups, addresses | Customer module | — |
| Auth (email/password, Google, GitHub) | Auth module | email/password สำหรับลูกค้า |
| Notifications (email providers) | Notification module | Resend/SendGrid provider |
| Tax | Tax module | VAT ไทย 7% แบบรวมในราคา |
| Admin dashboard | `@medusajs/dashboard` | เปลี่ยน theme/logo เท่านั้น |
| Storefront: PLP, PDP, cart, checkout, account, orders | Next.js Starter | Theme + ข้อความภาษาไทย (ADR-008 theme/THB, ADR-014) |
| Locale ของเนื้อหา (สินค้า/หมวดหมู่/collection) | Translation module (experimental, feature flag) + Store locales + starter: cookie `_medusa_locale`, header `x-medusa-locale`, `language-select` | backend เปิดแล้วใน CORE-7 (คงไว้); storefront **ไม่ใช้** ในระยะแรก — ลบ `language-select` (ADR-014) |
| ข้อความ UI ของ storefront | ไม่มี (starter hard-code อังกฤษ) | แทนด้วยภาษาไทยตรงในโค้ด ไม่มี i18n library (ADR-014) |
| File storage | File module (S3 provider) | S3-compatible bucket |
| Search | Product `q` filter (v1); `@medusajs/search-postgres` หากจำเป็นในภายหลัง | Default |
| Scheduled jobs, subscribers, workflow engine | Framework | ใช้ Redis ใน prod |

## การตั้งค่าที่ต้องส่งมอบ
- Region: Thailand, THB, tax-inclusive pricing, payment provider จาก spec 06
- Shipping: manual option 1 รายการ "Standard" (ราคาคงที่), 1 รายการ "Digital delivery" (ฟรี สำหรับ voucher)
- Tax: VAT 7% รวมในราคา
- Notification provider: อีเมล (Resend) สำหรับ order placed / shipped / การส่ง voucher
- File provider: S3-compatible
- Admin: ชื่อร้าน, โลโก้, สกุลเงินเริ่มต้น
- Storefront: ภาษาไทยอย่างเดียว (ADR-014), การจัดรูปแบบ THB, brand theme (Tailwind tokens) — รายละเอียดใน
  "CORE-4 Storefront ภาษาไทย / theme / THB" ด้านล่าง
- **ไม่มี guest** (เจ้าของระบบ): เฉพาะการเรียกดู (PLP/PDP/search/หน้าแคมเปญ/affiliate landing)
  เท่านั้นที่เป็นสาธารณะ การกระทำอื่นทุกอย่างในร้าน — สร้าง/แก้ไข cart, เพิ่มลง cart, checkout, orders,
  vouchers, group buy — ต้องเป็น **customer** ที่ล็อกอินแล้ว (affiliate portal ใช้ actor type
  `affiliate` ของตัวเอง, spec 05) บังคับใช้ฝั่ง server ด้วย middleware
  `authenticate("customer", ...)` ของ Medusa บน store route เหล่านั้น พร้อมกับ hook บน
  `createCartWorkflow` ที่ปฏิเสธ cart ที่ไม่มี `customer_id`; storefront
  redirect ไปหน้า login/register เมื่อกด "Add to cart"

## Acceptance criteria
- AC-1 เมื่อร้านถูก seed แล้ว ลูกค้าเรียกดูสินค้า เพิ่มลง cart และ checkout ด้วย manual payment
  provider แล้วจะมี order ปรากฏใน admin โดยมี `payment_status=authorized`;
  หลังจาก admin capture แล้ว `payment_status=captured` (Stripe อยู่ใน M2)
- AC-2 เมื่อมี order อยู่แล้ว และ admin สร้าง fulfillment พร้อม mark ว่า shipped ลูกค้าจะได้รับ
  อีเมล "shipped" (test inbox)
- AC-3 เมื่อลูกค้ามีบัญชีอยู่แล้ว และเปิดดู "My orders" จะเห็นรายการ order ของตนเอง
  พร้อมยอดรวม THB ที่ถูกต้อง
- AC-4 Admin สามารถสร้างสินค้าที่มี 2 variant พร้อม stock และสินค้าปรากฏบน storefront
  ภายใน 5 วินาที (ไม่มี cache ค้างเกิน 60 วินาทีใน prod)
- AC-6 เมื่อ guest กด "Add to cart" จะถูกส่งไปหน้า login; `POST /store/carts`
  และ `POST /store/carts/:id/line-items` โดยไม่มี customer session จะได้ 401 หลังล็อกอิน
  สินค้าจะถูกเพิ่มลง cart
- AC-5 `GET /health` ตอบ 200; แอปบูตได้ทั้งใน mode `server` และ `worker` แยกกัน
(label อังกฤษในเครื่องหมายคำพูดใน spec นี้ เช่น "Add to cart", "My orders" = ชื่อเรียก element; ข้อความจริงเป็นภาษาไทยและ test หาด้วย
test id ตามตารางใน ADR-014)

## แผนการทดสอบ
- Integration (http): smoke test การตั้งค่า region/tax; flow cart→order ด้วย manual payment
- e2e: AC-1, AC-3, AC-4 ผ่าน Playwright พร้อม screenshot
- CORE-4: ดู "แผนการทดสอบ CORE-4" ด้านล่าง

## CORE-4 Storefront ภาษาไทย / theme / THB (ADR-008 ส่วน theme/THB, ADR-014)
ปรับ 2026-10-26 ตาม ADR-014 (owner): storefront **ภาษาไทยอย่างเดียว** — แทนข้อความอังกฤษของ starter ด้วยภาษาไทยตรงในโค้ด
ไม่มี next-intl, ไม่มี locale cookie, ไม่มี language-select (i18n เลื่อนไป ดู "เลื่อนไป (ADR-014)" ท้ายหัวข้อนี้)
Out of scope: i18n ทุกแบบ, การแปลเนื้อหาสินค้า (ข้อมูลจาก backend), แก้ `force-static`/`revalidate` ของ starter, admin dashboard /
`src/admin/`, ค่า brand จริง (owner เปลี่ยน token เอง), หน้าใหม่ของ spec 02–06 (task ของ spec นั้นเขียนข้อความไทยเองตั้งแต่แรก)

### Data model / Workflows / API routes
none (storefront เท่านั้น)

### Business rules
1. รูปแบบเงิน: `convertToLocale` เมื่อ `currency_code` เป็น THB (ไม่สนตัวพิมพ์) ใช้ `Intl.NumberFormat` แบบ
   `style: "currency"`, `currencyDisplay: "narrowSymbol"`; ถ้าค่าที่ปัดเป็น 2 ตำแหน่งแล้วเป็นจำนวนเต็ม → 0 ทศนิยม
   มิฉะนั้น → 2 ทศนิยม ผลลัพธ์เหมือนกันทั้ง locale `th-TH` และ `en-US` default `locale` เปลี่ยนเป็น `th-TH`
   หากผู้เรียกส่ง `minimumFractionDigits`/`maximumFractionDigits` มาเอง ให้ใช้ค่าของผู้เรียก (เช่น price filter ที่ใช้ 0)
   สกุลเงินอื่นคงพฤติกรรมเดิม
2. จำนวนเงินของ Medusa v2 เป็นหน่วยหลัก (บาท) ไม่หาร 100
3. Theme: `tailwind.config.js` มีสีกลุ่ม `brand` (`50`–`900` + `DEFAULT`) ค่า placeholder เป็นโทนเทากลาง และ
   `fontFamily.sans` ตัวแรกคือ `var(--font-noto-sans-thai)` ฟอนต์โหลดผ่าน `next/font/google` (`Noto_Sans_Thai`,
   subsets `thai` + `latin`, `display: "swap"`) ใน root layout ไม่มี `<link>` ไป Google Fonts ตอน runtime
4. **ESLint กันข้อความอังกฤษ** (CORE-4b ตั้ง, 4c/4d เพิ่ม path ของตัวเอง): `no-restricted-syntax` ใน config ของ storefront เปิดเฉพาะ
   path ที่แปลแล้ว (ตาราง AC-49) ห้าม (a) `JSXText` ที่มีตัวอักษรละติน ≥ 2 ตัวติดกัน (`/[A-Za-z]{2,}/`), (b) string literal/template ที่เป็นค่า
   ของ prop `placeholder`, `title`, `alt`, `aria-label`, `label` ที่มีละติน ≥ 2 ตัว; ข้อยกเว้นตาม ADR-014 ข้อ 4 (ชื่อแบรนด์ เช่น "PromptPay")
   ใช้ `// eslint-disable-next-line no-restricted-syntax -- <เหตุผล>` ทีละบรรทัดเท่านั้น (ห้าม disable ทั้งไฟล์)
5. ข้อความที่ storefront สร้างเองและผู้ใช้เห็นเป็นภาษาไทยทั้งหมด: label, ปุ่ม, heading, ข้อความว่าง/loading/error, `metadata` (title,
   description) ของหน้า, ข้อความใน server action ที่ส่งกลับไปแสดง — ข้อมูลจาก backend (ชื่อสินค้า, option, ที่อยู่) แสดงตามที่ได้รับ ไม่แปล;
   error ของ Medusa API แสดงตามที่ได้รับ **หรือ** แปลงเป็นข้อความไทยทั่วไปได้ (แก้ถ้อยคำรอบ 8 ตาม #103) — 401/403 → ข้อความไทยให้เข้าสู่ระบบใหม่;
   (รอบ 10, qa #117/#131) error ของ**หน้า login/register** ต้องเป็นข้อความไทยเสมอ ไม่แสดงข้อความอังกฤษของ auth provider (เช่น "Invalid email or password") — กฎข้อ 62, CORE-4f
6. ไม่มีตัวเลือกภาษา: ลบ component `language-select` และจุดที่ render (nav/side menu); storefront ไม่เขียน cookie `_medusa_locale`;
   ไม่แก้ `lib/util/get-locale-header.ts` (ไม่มี cookie → ไม่ส่ง `x-medusa-locale` → ได้เนื้อหาต้นฉบับภาษาไทย); `<html lang="th">` คงที่
7. ทุก element ที่ e2e ต้องหา ต้องมี `data-testid` (ใช้ของ starter ถ้ามี) e2e ไม่ match ด้วยข้อความ; การตรวจ "เป็นภาษาไทย" ใช้ regex อักษรไทย
   `/[฀-๿]/` ไม่ hard-code ประโยค (ADR-014 ข้อ 3)
(กฎเดิมข้อ 4–8 และ 10 ของ ADR-008 — `resolveLocale`, cookie, `x-medusa-locale` ตาม cookie, `language-select` 2 ภาษา, `messages/*.json`,
`react/jsx-no-literals` — ย้ายไป "เลื่อนไป (ADR-014)")

### Acceptance criteria (CORE-4)
- AC-7 Given `amount=1000`, `currency_code="thb"` When เรียก `convertToLocale` ด้วย locale `th-TH`, `en-US` และไม่ระบุ locale
  Then ได้ `฿1,000` ทุกกรณี
- AC-8 Given THB When amount = `1000.5`, `0.1`, `0`, `-100`, `1234567.891`, `999.999` Then ได้ `฿1,000.50`, `฿0.10`, `฿0`,
  `-฿100`, `฿1,234,567.89`, `฿1,000` ตามลำดับ ทั้ง `th-TH` และ `en-US`; และเมื่อส่ง `maximumFractionDigits: 0` กับ
  `1000.5` ได้ผลตาม `Intl.NumberFormat` ของผู้เรียก (ไม่ถูก override)
- AC-9 Given `tailwind.config.js` When unit test โหลด config Then มี `theme.extend.colors.brand` ครบ key `DEFAULT, 50..900`
  และ `theme.extend.fontFamily.sans[0] === "var(--font-noto-sans-thai)"`
- AC-10 Given storefront รันอยู่ When e2e เปิดหน้าแรก Then `getComputedStyle(document.body).fontFamily` มีคำว่า
  `Noto Sans Thai` และไม่มี request ไป `fonts.googleapis.com`
- AC-11 Given repo When รัน `pnpm --filter storefront test:unit` Then Vitest รัน test ของ AC-7/8/9 ผ่าน และ job CI
  ของ storefront รันคำสั่งนี้
- AC-12..AC-19 เดิม (`resolveLocale`, `messages/*.json`, cookie → `<html lang>`, `language-select`, `x-medusa-locale` ตาม cookie,
  `react/jsx-no-literals`, ข้อความตาม `messages/<locale>.json`) **ยกเลิก** — ย้ายไป "เลื่อนไป (ADR-014)" แทนด้วย AC-46..AC-50
- AC-46 (CORE-4b, กฎข้อ 6) Given ไม่มี cookie When e2e เปิด `/th` และเปิด side menu Then `<html lang="th">`, ไม่มี element
  `data-testid="language-select"`, `document.cookie` ไม่มี `_medusa_locale` และ `document.title` มีอักษรไทย; Given
  `apps/storefront/package.json` Then ไม่มี dependency `next-intl` และไม่มีโฟลเดอร์ `apps/storefront/messages/` (unit/อ่านไฟล์)
- AC-47 (CORE-4b, กฎข้อ 4) Given fixture ใน path ที่เปิด rule When รัน ESLint (Node API ใน Vitest) กับ `<p>Hello</p>`,
  `<input placeholder="Search" />`, `<p>สวัสดี</p>`, `<p>{price} ฿</p>`, และบรรทัด `PromptPay` ที่มี
  `eslint-disable-next-line no-restricted-syntax -- brand` Then สองตัวแรกมี error `no-restricted-syntax`, ที่เหลือไม่มี error
- AC-48 (CORE-4b/4c/4d, กฎข้อ 5, 7) Given storefront + backend ที่ seed แล้ว ไม่มี cookie locale When e2e เปิดหน้าใน path ของ task
  (4b: home, store, `/search`, category, collection, PDP ของสินค้า seed, not-found ของ `(main)`; 4c1: account overview, profile,
  addresses, login/register, orders (รายการ), verify-account; 4c2: cart, order detail, order confirmed, หน้า policy ทั้ง 5 (`/contact`, `/terms`, `/privacy`, `/returns`, `/shipping`);
  4d: ทุกขั้นของ checkout)
  Then element หลักอย่างน้อย 2 ตัวต่อหน้า (หาด้วย test id — builder ระบุรายการใน `REPORT.md`) มี textContent ตรง `/[฀-๿]/`
  และไม่มีคำละติน ≥ 2 ตัวนอกข้อยกเว้นของ ADR-014 ข้อ 4; เก็บ screenshot ≤ 5 รูปต่อ task
- AC-49 (กฎข้อ 4) Given develop หลัง task merge When `pnpm --filter storefront lint` Then ไม่มี error และ config เปิด rule ครบ path ของ task
  ตามตาราง "เจ้าของ path" ด้านล่าง (ทุกไฟล์ใต้ `apps/storefront/src` ที่มี UI หรือข้อความที่ผู้ใช้เห็นอยู่ใน task เดียวพอดี ไม่ทับกัน; glob ของแต่ละ task ต้อง
  ไม่จับไฟล์ของ task อื่น — ใช้ path เต็มของ route group แทน glob กว้างแบบ `src/app/**/page.tsx`) (CI ตรวจผ่าน job lint เดิม)

  | Task | path ใต้ `apps/storefront/src/` (ไล่จากไฟล์จริง 2026-10-26) |
  |------|------|
  | 4b | `app/layout.tsx`, `app/not-found.tsx`; `app/[countryCode]/(main)/{layout,page,not-found}.tsx`; `app/[countryCode]/(main)/{store,search,categories,collections,products}/**`; `modules/{layout,home,store,search,categories,collections,products}/**`; `app/buy/**` (ข้อความตอบกลับที่ผู้ใช้เห็น — ถ้า CORE-14 merge ก่อนให้ CORE-14 แปลแทน) |
  | 4c1 (#92, แยกรอบ 7) | `app/[countryCode]/(main)/{account,verify-account}/**`; `modules/account/**`; ข้อความ error ที่ผู้ใช้เห็นใน `lib/data/customer.ts` |
  | 4c2 (แยกรอบ 7) | `app/[countryCode]/(main)/{cart,order}/**`; หน้า policy **ทั้งไฟล์** `app/[countryCode]/(main)/{contact,terms,privacy,returns,shipping}/page.tsx`; `modules/{cart,order,policies,common,skeletons}/**` (รวม placeholder "Select..." ของ `NativeSelect` ใน `modules/common`); ข้อความ error ที่ผู้ใช้เห็นใน `lib/data/orders.ts` |
  | 4d | route group `app/[countryCode]/(checkout)/**` (รวม `(checkout)/layout.tsx`, `(checkout)/not-found.tsx`, `checkout/page.tsx`); `modules/{checkout,shipping}/**`; `lib/constants.tsx` (ชื่อวิธีชำระเงินที่แสดงใน checkout); ข้อความ error ที่ผู้ใช้เห็นใน `lib/data/cart.ts` |
  ไฟล์ใหม่ที่เกิดหลังวันนี้: task ที่สร้างไฟล์เป็นผู้เพิ่ม path (กฎข้อ 4); `modules/layout/components/language-select/` ถูกลบใน 4b;
  หน้า order transfer ถูกลบแล้วใน CORE-14a (#81) ไม่ต้องแปล
  evidence (รอบ 7): #92 เก็บที่ `docs/evidence/core/CORE-4c-tests.txt` และ `CORE-4c/` — ยอมรับเป็นโฟลเดอร์ของ CORE-4c1 (งบ 5 รูปเต็มแล้ว ไม่ rename);
  CORE-4c2 ใช้ `CORE-4c2-tests.txt` และ `CORE-4c2/` ของตัวเอง (regex ใหม่ของ #87 รับ)
  ข้อความใน `lib/` และ route handler (`app/**/route.ts`) ESLint rule ไม่ครอบ → ตรวจด้วย unit test หรือ grep ข้อความที่ส่งออก
  (`throw new Error(...)`, `new Response(...)`) ในไฟล์ของ task; ยกเว้น `lib/util/product-markdown.ts` (`llms.txt` สำหรับเครื่อง)
- AC-50 (CORE-4b) AC-10 (ฟอนต์บนหน้าแรก) ผ่านด้วย e2e ใน CORE-4b (ยกมาจากเดิม)

### Non-functional
- ไม่เพิ่ม infra และไม่เพิ่ม dependency (ESLint rule เป็น core rule `no-restricted-syntax`)
- ไม่เปลี่ยนโหมด render ของหน้าใด (`force-static`/`revalidate` ของ starter คงเดิม)

### แผนการทดสอบ CORE-4
| ระดับ | AC |
|------|----|
| unit (Vitest) | AC-7, AC-8, AC-9, AC-46 (ส่วนอ่านไฟล์), AC-47 |
| CI / lint | AC-11, AC-49 |
| e2e (Playwright, หาด้วย `getByTestId`) | AC-10/AC-50, AC-46, AC-48 |
fixture ตั้ง cookie `_medusa_locale` ของ CORE-5 คงไว้แต่ test ใหม่ไม่ใช้ (ADR-014)

### Tasks (ข้อความไทยตรงในโค้ด — diff แบบแทนบรรทัด แตกตามกลุ่มหน้าให้ ≤ ~400 LOC)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-4a | Vitest (dev dep, `test:unit`, ขั้นตอนใน CI) + THB format ใน `convertToLocale` + Tailwind `brand` tokens + Noto Sans Thai ผ่าน `next/font` + `<html lang="th">` | AC-7, 8, 9, 11 | CORE-1 (☑) |
| CORE-4b | ESLint rule (กฎข้อ 4) + ลบ `language-select` (กฎข้อ 6) + ข้อความไทยตาม path 4b ในตาราง AC-49: layout shell (nav, footer, side menu, cart dropdown, not-found, metadata ของ root/main layout), home, store/PLP, search, categories, collections, PDP + เพิ่ม `data-testid` ที่ขาด | AC-10/50, 46, 47, 48 (4b), 49 (4b) | CORE-4a, CORE-5b, CORE-8 (merge แล้วทั้งหมด) — ไม่รอ CORE-9 |
| CORE-4c1 | (◐ #92, แยกรอบ 7) ข้อความไทยตาม path 4c1 ในตาราง AC-49: account (overview, profile, addresses, login/register, รายการ orders), verify-account, error ใน `lib/data/customer.ts` + `data-testid` ที่ขาด | AC-48 (4c1), 49 (4c1) | CORE-4b (ใช้ rule/config ของ 4b) |
| CORE-4c2 | (แยกรอบ 7) ข้อความไทยตาม path 4c2 ในตาราง AC-49: cart, order detail/confirmed, หน้า policy ทั้ง 5 (ทั้งไฟล์ `page.tsx`), `modules/common` (รวม `NativeSelect` "Select..."), `modules/skeletons`, error ใน `lib/data/orders.ts` + `data-testid` ที่ขาด; **รวม follow-up รอบ 7** (กฎข้อ 41–44): ลิงก์นโยบาย/ข้อกำหนดในฟอร์มสมัคร, `timeZone: "Asia/Bangkok"` ทุกจุดที่แสดงวันที่, "+ N รายการ" ของ order card, test ข้อความไทยของ `lib/data/*` ไม่ hard-code จำนวน, error ไม่มีคำนำหน้า `Error:` (กฎข้อ 45) (แตะไฟล์ใน path 4c1 ได้เฉพาะจุดเหล่านี้) | AC-48 (4c2), 49 (4c2), 77..81 | CORE-4c1 (#92) |
| CORE-4d | ข้อความไทยตาม path 4d ในตาราง AC-49: route group `(checkout)` ทั้งหมด (layout, not-found, checkout ทุกขั้น), shipping nudge, `lib/constants.tsx` **รวมข้อความ UI ที่ PAY-2 (#48) เพิ่ม** (เช่น ปุ่ม/ข้อความ PromptPay) + แปลไทยประโยคยอมรับเงื่อนไขในขั้น review และข้อความใน `(checkout)/layout.tsx` (ชื่อร้าน → `STORE_NAME` ทำแล้วใน #80; ยืนยันรอบ 6, กฎข้อ 39) + `data-testid` ที่ขาด | AC-48 (4d), 49 (4d), 75 | CORE-4b, **PAY-2** (ห้ามแตะไฟล์ checkout ก่อน #48 merge) |
CORE-4c1 ∥ CORE-4d หลัง CORE-4b (คนละ path; ทั้งคู่แก้ ESLint config บรรทัด path — ตัวที่ merge ทีหลัง rebase); CORE-4c2 หลัง CORE-4c1 (∥ CORE-4d)
CORE-4b แตะ `src/modules/store/components/store-hits/` เดียวกับ CORE-15 — ตัวที่ merge ทีหลัง rebase (ข้อความ error ของ CORE-15 เขียนไทยอยู่แล้ว)
ถ้า CORE-4b เกิน ~400 LOC ให้แยก CORE-4b1 (rule + layout shell + home + `language-select`; AC-46, 47, 50) และ CORE-4b2 (store/PLP,
search, categories, collections, PDP; AC-48/49 ส่วนนั้น) — 4b2 depends 4b1
PAY-3, PAY-5, CORE-15, EV-7, FS-6, GB-7, AF-8 (UI storefront ใหม่) เขียนข้อความไทยตั้งแต่แรกและเพิ่ม path ของตัวเองใน rule (กฎข้อ 4) ถ้า
CORE-4b merge แล้ว

### ข้อตัดสินของ owner (CORE-4)
1. (2026-10-25) เนื้อหาสินค้าต้นฉบับใน admin กรอกเป็นภาษาไทย — ยังมีผล; ส่วน "ภาษาอังกฤษมาจาก Translation module" เลื่อนไป (ADR-014)
2. (2026-10-25) ADR-008 ข้อ 1 ครอบคลุมการใช้ Translation module ที่ยังเป็น experimental ใน CORE-7 แล้ว — CORE-7 (merge แล้ว #26) **คงไว้ที่
   backend ไม่ถอด** แต่ storefront ยังไม่ใช้ (ไม่มี cookie → ไม่ส่ง `x-medusa-locale`) (ADR-014 ข้อ 5)
3. (2026-10-26, แทนข้อเดิม) `metadata` (title/description) ของหน้าเขียนเป็นภาษาไทยตรงใน task ของหน้านั้น
4. (2026-10-26) ADR-014 accepted: ภาษาไทยอย่างเดียวในระยะแรก ไม่ทำ i18n
5. (2026-10-26, review #70) `hreflang` ของ alternate link ที่ starter สร้าง เปลี่ยนจาก `en-<CC>` เป็น `th-<CC>` (เช่น `th-TH`) ให้ตรงกับ
   `<html lang="th">` — ทำใน CORE-4b2 (#70)

### เลื่อนไป (ADR-014)
กลับมาทำได้เมื่อมี ADR ใหม่ (dynamic SSR หรือ locale ใน URL) เท่านั้น: `resolveLocale` + cookie `_medusa_locale` เป็นที่มาของ locale,
`<html lang>` ตาม cookie, `language-select` 2 ภาษา + fallback เมื่อ `GET /store/locales` ไม่ตอบ, `x-medusa-locale` ตาม cookie ในฐานะ
ฟีเจอร์, `messages/{th,en}.json` + next-intl + `react/jsx-no-literals`, AC-12..AC-19 เดิม (ดูประวัติใน git ของไฟล์นี้ก่อน 2026-10-26)

## Tasks
| ID | Task | Depends |
|----|------|---------|
| CORE-1 | `create-medusa-app` ลงใน `apps/backend` + starter ลงใน `apps/storefront`; pnpm workspace; Docker Compose (pg, redis); `.env.example`; CI ผ่านด้วย test ว่าง | — |
| CORE-2 | Seed script: region Thailand, THB, VAT 7%, shipping option (Standard + Digital delivery), สินค้าตัวอย่าง, admin user; script `print-publishable-key` ที่ CI ใช้ | CORE-1 |
| CORE-3 | Notification provider (Resend) + template order placed/shipped | CORE-1 |
| CORE-4a | THB format + theme tokens + Noto Sans Thai + Vitest (ดู "CORE-4 Storefront ภาษาไทย / theme / THB") | CORE-1 |
| CORE-4b | ESLint กันข้อความอังกฤษ + ลบ `language-select` + ข้อความไทย: layout shell, home, PLP, categories, collections, PDP (ADR-014) | CORE-4a, CORE-5b, CORE-8 |
| CORE-4c1 | ข้อความไทย: account, login/register, verify-account (#92) | CORE-4b |
| CORE-4c2 | ข้อความไทย: cart, order, policies, common, skeletons + follow-up รอบ 7 | CORE-4c1 |
| CORE-4d | ข้อความไทย: checkout + shipping nudge (รวมข้อความของ PAY-2) | CORE-4b, PAY-2 |
| CORE-5 | ตั้งค่า Playwright แบบ screenshot ทุก step + convention ของโฟลเดอร์ evidence + helper ตั้ง cookie `_medusa_locale` (ADR-008; ไม่ถูกใช้หลัง ADR-014) | CORE-1 |
| CORE-6 | Store route เฉพาะลูกค้า (middleware + cart hook + storefront redirect) + e2e สำหรับ AC-1..AC-4, AC-6 ด้วย manual payment provider (หา element ด้วย `data-testid` ตาม ADR-008) | CORE-2,4a,5 |
| CORE-7 | Backend: เปิด Translation module (feature flag + `medusa-config.ts`) และตั้ง store locales `th-TH`, `en-US` ใน seed เพื่อให้ `GET /store/locales` และ `x-medusa-locale` ใช้งานได้ (ไม่อยู่ใน CORE-4 ตาม ADR-008) — merge แล้ว คงไว้ แต่ storefront ยังไม่ใช้ (ADR-014) | CORE-2 |
| CORE-5b | แก้เครื่องมือ evidence ของ e2e (ดู "Follow-up จาก review/qa") | CORE-5 |
| CORE-8 | ฟอนต์ของ class `txt-*`/`h*-webs` จาก `@medusajs/ui-preset` ใช้ Noto Sans Thai | CORE-4a, CORE-5 |
| CORE-9 | search index เก็บราคา THB → หน้า store แสดงราคา ฿ | CORE-2 |
| CORE-10 | Seed: ชื่อสินค้าไทย, idempotency ต่อขั้น, `.env.example` | CORE-2 (แนะนำ merge หลัง CORE-6) |
| CORE-11 | Notification: อีเมล shipped แสดงเฉพาะ item ที่ส่ง, order placed เคารพ `no_notification` | CORE-3 |
CORE-3, CORE-4a และ CORE-5 ทำขนานกันได้หลังจาก CORE-1; CORE-4c1 ∥ CORE-4d หลัง CORE-4b (4d รอ PAY-2 ด้วย); CORE-4c2 หลัง CORE-4c1
(storefront ไม่ใช้ CORE-7 ตาม ADR-014)
CORE-5b ∥ CORE-8 ∥ CORE-9 ∥ CORE-10 ∥ CORE-11 (ไม่แตะไฟล์เดียวกัน) — CORE-5b, CORE-8 อยู่บน critical path ของ CORE-4b;
(2026-10-26: CORE-9 ไม่เป็น dependency ของ CORE-4 task ใดแล้ว — ADR-014)

## Follow-up จาก review/qa (2026-10-25)
ที่มา: หัวข้อ Backlog ใน `docs/ROADMAP.md` และ `docs/evidence/core/CORE-4a/REPORT.md` (defect 1–4)
Out of scope: เปลี่ยนนิยามของ CORE-6 (เรื่อง cart route ยังไม่บังคับ `authenticate("customer")` เป็นงานของ CORE-6 อยู่แล้ว
และ test ของ PROMO-1/FS-3 ที่สร้าง cart แบบไม่มี token ต้องถูกแก้ใน PR ของ CORE-6 เพื่อให้ CI เขียว)

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| ราคาต่อสกุลเงินใน search index | Search (`@medusajs/framework/utils` `search`) + `QueryContext({ currency_code })` ของ Pricing | ขยาย: เพิ่ม `thb` ในรายการสกุลเงินของ index (โค้ดเดิมจาก starter) |
| typography ของ storefront | `@medusajs/ui-preset` (class `txt-*`, `h*-webs` ที่ fix ฟอนต์ Inter) | ขยาย: override ใน Tailwind config/CSS ของเรา ห้าม patch `node_modules` |
| seed แบบรันซ้ำได้ | core workflows (`createRegionsWorkflow`, `createShippingOptionsWorkflow`, …) | ใช้ตามเดิม + เช็กการมีอยู่ทีละ resource |
| ข้าม notification ของ order | field `no_notification` ของ Order module (Medusa ใช้ข้ามอีเมลเอง) | ใช้ตามเดิม: subscriber เช็ก field |
| เครื่องมือ evidence | ไม่มี (ของเราเอง จาก CORE-5) | custom (มีอยู่แล้ว แก้ bug) |

### Data model / Workflows / API routes
none

### Business rules
11. task id ของ evidence มีรูปแบบ `^[A-Z]+-\d+[a-z]?$` (รับ `CORE-4a`, `CORE-5b`) — **รอบ 7: #87 ขยายให้รับ task id ที่แยกซ้อนแบบ `GB-6b1`, `CORE-4c1`
    แล้ว** regex ที่ใช้จริงคือ `TASK_ID_RE`/`TESTS_TXT_RE` ใน `apps/storefront/e2e/support/evidence-rules.ts` (source of truth; spec ไม่ copy regex ซ้ำ)
12. `evidence()` ตรวจงบ (≤ 5 PNG, ≤ 300KB) กับ **ชุดไฟล์ที่จะเกิดขึ้นหลังเขียน** ก่อนเขียนไฟล์จริง ถ้าเกินงบ → throw และไม่เขียนไฟล์
    การเขียนทับไฟล์ชื่อเดิมไม่นับเป็นรูปใหม่
13. ใน `docs/evidence/<feature>/` (ระดับ feature) อนุญาตเฉพาะไฟล์ `<TASK-ID>-tests.txt` และโฟลเดอร์ `<TASK-ID>/`
    (ตาม `docs/evidence/README.md`) ไฟล์ `*-tests.txt` ที่อยู่ในโฟลเดอร์ `<TASK-ID>/` ต้องย้ายขึ้นมาระดับ feature
14. ทุก element ที่ได้ font-family จาก class ของ `@medusajs/ui-preset` (`txt-*`, `h1-webs`…`h3-webs` และกลุ่ม `*-webs` อื่น)
    ต้องได้ `var(--font-noto-sans-thai)` เป็นตัวแรก โดยไม่ fork/patch package
15. สกุลเงินของ search index = `["thb"]` เท่านั้น (ร้านมี region เดียวคือ Thailand/THB) ทั้ง backend `PRICE_CURRENCIES`
    และ storefront `SEARCH_PRICE_CURRENCIES` ต้องมีค่าเท่ากัน; เพิ่มสกุลเงินในอนาคต = แก้ทั้งสองที่
    **ลำดับ release เมื่อ schema/field ของ search index เปลี่ยน** (แก้ 2026-10-26): `medusa db:migrate` → รีสตาร์ต backend (server + worker;
    index ถูก reindex ตอนบูต) → รอ reindex เสร็จ → ค่อยปล่อย storefront ที่อ่าน field ใหม่ — ถ้าปล่อย storefront ก่อน หน้า `/store` จะ query field
    ที่ยังไม่มีใน index; compose prod บังคับ `migrate` ก่อน server และ storefront รอ server healthy อยู่แล้ว (`docker-compose.prod.yml`)
    รายละเอียดอยู่ใน runbook `docs/ops/production.md` หัวข้อ "ลำดับ release" (spec 07)
16. ชื่อสินค้าตัวอย่างใน seed เป็นภาษาไทย (ADR-008, ข้อตัดสินของ owner ข้อ 1) `handle` คงเดิม (URL/e2e ไม่เปลี่ยน)
17. seed ตรวจการมีอยู่ **ทีละ resource** (region, tax region, stock location, fulfillment set, shipping option ตาม `type.code`,
    publishable key ตาม title, category ตาม **handle** (แก้รอบ 6 — ชื่อเป็นไทยแล้ว ดูกฎข้อ 35), product ตาม handle, inventory level) และสร้างเฉพาะที่ขาด — ไม่ใช้ region
    เป็นตัวตัดสินว่าข้ามทั้งหมด
18. `.env.example` ของ backend: `SEED_ADMIN_PASSWORD=` ว่าง (ไม่มีรหัสตัวอย่าง)
19. ค่าส่ง "Standard" คงค่า `shipping_rate: 10` เดิม (placeholder; owner ยังไม่ตัดสิน Q-F1, 2026-10-25) — CORE-10 ไม่รอ Q-F1
    เมื่อ owner ตัดสินแล้วเป็น task แยก
20. อีเมล shipped แสดงเฉพาะ item และจำนวนที่อยู่ใน fulfillment ของ event `shipment.created` นั้น ไม่ใช่ทุก item ของ order
21. subscriber `order.placed` ไม่ส่งอีเมลเมื่อ `order.no_notification === true`

### Acceptance criteria (follow-up)
- AC-20 Given `evidenceDir` When taskId = `CORE-4a`, `CORE-5b`, `CORE-5`, `GB-12` Then คืน path
  `docs/evidence/<feature>/<taskId>`; When taskId = `core-4a`, `CORE4`, `CORE-4ab`, `CORE-`, `CORE-4A` Then throw (unit)
- AC-21 Given โฟลเดอร์ปลายทางมี PNG อยู่แล้ว 5 รูป When `evidence("06-new")` ด้วย `E2E_SAVE_EVIDENCE=1` Then throw และโฟลเดอร์ยังมี
  5 รูปเท่าเดิม (ไม่มี `06-new.png`); When `evidence("01-existing")` (ชื่อซ้ำ) Then เขียนทับได้; Given PNG ใหม่ > 300KB
  Then throw และไม่มีไฟล์ถูกเขียน (unit test ของ helper ที่คำนวณชุดไฟล์ก่อนเขียน)
- AC-22 Given `docs/evidence/<feature>/` มีไฟล์ระดับ feature ที่ไม่ตรง `^[A-Z]+-\d+[a-z]?-tests\.txt$` (เช่น `x.png`, `CORE-5.txt`)
  When รัน `evidence-budget.unit.spec.ts` Then มี violation ระบุ path; Given ไฟล์ `CORE-2-tests.txt` อยู่ใน `core/CORE-2/` Then มี violation
- AC-23 Given develop หลัง merge When รัน `pnpm --filter storefront test:e2e:unit` Then ผ่าน (ย้าย `*-tests.txt` ทุกไฟล์ที่อยู่ใน
  `<TASK-ID>/` ขึ้นระดับ feature แล้ว) และ `.github/workflows/ci.yml` job `lint-typecheck` มีขั้นตอนรันคำสั่งนี้
- AC-24 Given Vitest ประมวลผล Tailwind (config ของ storefront) กับ content `<div class="txt-compact-small txt-medium h1-webs h2-webs">`
  When อ่าน CSS ที่ได้ Then rule ของทุก class ข้างต้นที่กำหนด `font-family` มีค่าเริ่มด้วย `var(--font-noto-sans-thai)` (unit)
- AC-25 Given storefront รันอยู่ When e2e เปิดหน้าแรก Then มี element ที่ class ตรง `txt-` หรือ `-webs` อย่างน้อย 1 ตัว และ
  `getComputedStyle(el).fontFamily` ของ**ทุกตัว**มีคำว่า `Noto Sans Thai` ก่อน `Inter` (หรือไม่มี `Inter`)
- AC-26 Given `toProductPricing({ thb: [variant ราคา 590, variant ราคา 990] })` (ไม่มีส่วนลด) Then ได้ `min_price_thb=590`,
  `max_price_thb=990`, `original_price_thb=590`, `on_sale_thb=false` และไม่มี field `_eur`/`_usd`; `PRICE_CURRENCIES` และ
  `SEARCH_PRICE_CURRENCIES` เท่ากับ `["thb"]`; `indexedCurrency("THB") === "thb"` (unit ทั้ง backend และ storefront)
- AC-27 Given DB ที่ seed แล้ว และ index สร้างเสร็จ When เรียก `/store/search` (method/body แบบเดียวกับที่ `@medusajs/instantsearch-adapter` ส่ง) ด้วย query ว่าง Then ทุก hit
  มี `min_price_thb` เท่ากับราคา THB ที่ seed (integration http)
- AC-28 Given storefront + backend ที่ seed แล้ว When e2e เปิด `/th/store` Then ราคาบนการ์ดสินค้าทุกใบ (หาด้วย `data-testid`) ตรง regex
  `^฿[\d,]+(\.\d{2})?$` และเก็บ screenshot เป็น evidence
- AC-29 Given DB ว่าง When รัน seed Then สินค้าตัวอย่างทุกตัวมี `title` ที่มีอักษรไทย (`/[฀-๿]/`) และ `handle` เท่าเดิม
- AC-30 Given DB ที่ seed ครบแล้ว When รัน seed ซ้ำ Then จำนวน region, shipping option, publishable key, category, product,
  inventory level ไม่เปลี่ยน; Given DB ที่มีเพียง region "Thailand" (สร้างใน test ก่อน) When รัน seed Then resource อื่นตามกฎข้อ 17
  ถูกสร้างครบและ checkout flow ของ AC-1 ใช้งานได้ (integration)
- AC-31 Given `apps/backend/.env.example` Then มีบรรทัด `SEED_ADMIN_PASSWORD=` ที่ไม่มีค่า (unit test อ่านไฟล์) และ seed ที่ไม่มีรหัสผ่าน
  ข้ามการสร้าง admin (พฤติกรรมเดิม)
- AC-32 Given order ที่มี 2 item (A qty 2, B qty 1) When admin สร้าง fulfillment เฉพาะ A qty 1 แล้ว mark shipped Then อีเมล shipped
  (notification ที่ provider ได้รับ) มีเฉพาะ A จำนวน 1 และไม่มี B (integration http, mock provider)
  (owner 2026-10-26: อีเมล shipped ไม่แสดงราคา — แสดงเฉพาะชื่อสินค้าและจำนวนที่ส่ง ราคาดูได้จากอีเมลยืนยัน order/หน้า order)
- AC-33 Given order ที่ `no_notification=true` When เกิด `order.placed` Then ไม่มี notification ถูกสร้าง; Given `no_notification=false`
  Then มี 1 รายการ (integration)

### แผนการทดสอบ (follow-up)
| ระดับ | AC |
|------|----|
| unit (Playwright project `unit`) | AC-20, AC-21, AC-22, AC-23 |
| unit (Vitest storefront / Jest backend) | AC-24, AC-26, AC-31 |
| integration http | AC-27, AC-30, AC-32, AC-33 |
| integration (seed script บน DB ทดสอบ) | AC-29, AC-30 |
| e2e | AC-25, AC-28 |

### Tasks (follow-up)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-5b | `TASK_ID_RE` รับ suffix ตัวเล็ก, `evidence()` ตรวจงบก่อนเขียน, budget test ตรวจระดับ feature, ย้าย `*-tests.txt` ที่ผิดที่, CI รัน `test:e2e:unit`, อัปเดต `docs/evidence/README.md` | AC-20..23 | CORE-5 |
| CORE-8 | override font-family ของ class `txt-*`/`*-webs` ให้ใช้ `var(--font-noto-sans-thai)` (plugin/`@layer` ใน storefront) + Vitest + e2e | AC-24, AC-25 | CORE-4a, CORE-5 |
| CORE-9 | `PRICE_CURRENCIES`/`SEARCH_PRICE_CURRENCIES` = `["thb"]` + unit/integration + e2e หน้า store | AC-26..28 | CORE-2 |
| CORE-10 | seed: ชื่อสินค้าไทย + ชื่อ option (เช่น Size) เป็นไทย (review #70, AC-68), ชื่อ category ไทย + handle คงที่ (รอบ 6, กฎข้อ 35, AC-72), เช็กการมีอยู่ทีละ resource, `.env.example` ว่าง (ค่าส่ง Standard คงเดิม กฎข้อ 19) + หัวข้อ dev ใน `README.md` (กฎข้อ 36, AC-73) | AC-29..31, AC-68, AC-72, AC-73 | CORE-2 (แนะนำ — ไม่บังคับ — ให้ merge หลัง CORE-6 เพราะ e2e ของ CORE-6 ใช้ seed) |
| CORE-11 | อีเมล shipped เฉพาะ item ใน fulfillment, `order.placed` เคารพ `no_notification` | AC-32, AC-33 | CORE-3 |
CORE-5b, CORE-8, CORE-9 ทำขนานกันได้; CORE-5b + CORE-8 เป็น dependency ของ CORE-4b (CORE-9 ไม่เป็น dependency ของ CORE-4 แล้ว — ADR-014);
CORE-10 ∥ CORE-11 นอก critical path และไม่บล็อก release v0.1.0
evidence ของ CORE-8/CORE-9 (e2e) บันทึกได้หลัง CORE-5b merge (ถ้ายังไม่ merge ให้รัน e2e โดยไม่ตั้ง `E2E_SAVE_EVIDENCE`)
fail-fast เมื่อ prod ไม่มี `RESEND_API_KEY` อยู่ใน OPS-7 (spec 07, ADR-010) ไม่อยู่ใน CORE-11

### Open questions (follow-up)
- Q-F1 (owner 2026-10-25: ยังไม่ตัดสิน คง placeholder) ค่าส่ง "Standard" ใน seed/region metadata ควรเป็นเท่าไร
  (ตอนนี้ 10 THB)? ฟรีเมื่อยอดถึงขั้นต่ำหรือไม่
  (ถ้าใช่ ใช้ Medusa shipping option rule/promotion — เป็น task แยก)
  — (2026-10-27) owner ยังไม่ตัดสิน: เพิ่มเป็นข้อใน checklist go-live ของ `docs/ops/production.md` ผ่าน **OPS-13** (spec 07 AC-21) เพื่อไม่ให้เปิดร้านด้วย placeholder

## Follow-up จาก CORE-6 (2026-10-25)
ที่มา: builder CORE-6 (PR #36) — ไม่แก้นิยามของ CORE-6; ทุก task ด้านล่างเริ่มหลัง CORE-6 merge
Out of scope: เปิด `test:e2e:unit` ใน CI — อยู่ใน CORE-5b แล้ว (AC-23: ย้าย `*-tests.txt` + ขั้นตอนใน job `lint-typecheck`)
ไม่สร้าง task ซ้ำ

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ (ตรวจ source 2.22.1) | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| auth ของ customer บน store route | `authenticate("customer", …)` — Medusa ใส่เองเฉพาะ `POST /store/carts/:id/customer`, `GET /store/orders`, `orders/:id/transfer/request|cancel` | ขยาย: CORE-6 ใส่ให้ cart; CORE-13 ใส่ให้ returns |
| order transfer (ย้าย order ของ guest เข้าบัญชี) | `/store/orders/:id/transfer/request|accept|decline|cancel` | **ปิด** (owner Q-F3): ร้านไม่มี guest order |
| cart/order เป็นของคนที่เรียก | **ไม่มี** — route และ `updateCartWorkflow` ไม่เทียบ `customer_id` กับ auth context; `GET /store/orders/:id`, `/store/payment-collections*` ไม่มี auth | ขยาย: middleware ตรวจ owner (ADR-013) |
| แก้ middleware ของ route Medusa | `defineMiddlewares` (matcher + method) | ใช้ตามเดิม |
| storefront สร้าง cart ผ่านลิงก์/agent (UCP) | starter: `/buy/[items]`, `/ucp/*`, `cart/resume/[cartId]` สร้าง/เปิด cart โดยไม่มี session | ปรับ (CORE-14, owner Q-F2): `/buy` บังคับล็อกอิน, ปิด UCP |

### Data model / Workflows
none (middleware + storefront เท่านั้น)

### API routes
ไม่มี route ใหม่ เพิ่ม middleware บน route ของ Medusa:
- CORE-12 ownership (หลัง `authenticate("customer", ["session","bearer"])`, ทุก method): `/store/carts/:id` และ `/store/carts/:id/*`;
  `POST /store/payment-collections` (`body.cart_id`); `/store/payment-collections/:id/payment-sessions*` (owner ของ cart หรือ order ที่
  link กับ collection); `GET /store/shipping-options` (`query.cart_id`); `POST /store/shipping-options/:id/calculate` (`body.cart_id`);
  `GET /store/orders/:id` (`order.customer_id`)
  - auth: CORE-6 ใส่ `authenticate("customer")` ให้แค่ `/store/carts*` และ `/store/payment-collections*` → CORE-12 ต้อง **เพิ่ม
    `authenticate("customer", ["session","bearer"])` เอง** ที่ `/store/shipping-options*` และ `GET /store/orders/:id` ก่อน middleware ownership
- CORE-13 auth + ownership ของ order: `POST /store/returns` (`body.order_id`); ปิด `POST /store/orders/:id/transfer/request|accept|decline|cancel`
  ด้วย middleware ที่ตอบ 404 — ต้องลงทะเบียน**แบบไม่ระบุ method** (อยู่ใน bucket global ของ `routes-sorter.js` จึงทำงานก่อน
  middleware แบบระบุ method) เพราะ core ใส่ `authenticate` แบบระบุ method ไว้ที่ `transfer/request` และ `transfer/cancel` ถ้าเราระบุ
  method ด้วย จะทำงานหลัง `authenticate` ของ core แล้วคำขอที่ไม่มี token ได้ 401 แทน 404

### Business rules
22. (ADR-013) store route ที่อ้าง cart/order/payment collection ต้องผ่าน customer auth และ resource ต้องเป็นของ
    `auth_context.actor_id`; ไม่ตรง, ไม่พบ หรือ owner เป็น null → **404** (ไม่ใช่ 403) ไม่มี token → 401
23. route ของเราเองที่รับ `cart_id`/`order_id` (เช่น GB join, spec 04) ใช้ helper เดียวกับกฎ 22
24. no-guest ครอบ `POST /store/returns`: ต้องล็อกอินและเป็น owner ของ order; order transfer ทั้งชุดปิดใน v1 (owner Q-F3)
    — เปิดใหม่ต้องมี ADR
25. storefront ห้ามมี flow ที่สร้าง cart โดยไม่มี customer session (ต่อจาก CORE-6): `/buy/[items]` บังคับล็อกอิน; UCP (`/ucp/*`,
    `lib/ucp/*`, `cart/resume`) ปิดทั้งชุดใน v1 (owner Q-F2) — เปิดใหม่ต้องมี ADR เรื่องให้ agent ทำงานแทน customer
26. flow Add to cart แบบไม่มี JS (CORE-6: redirect `/account?add_variant=`) ต้องไม่ติด Suspense stream ของ `account/loading.tsx`
    (ไฟล์ starter) — redirect/ฟอร์ม login ต้องอยู่ใน HTML ที่ได้โดยไม่ต้องรัน JS, คง `quantity` ที่ผู้ใช้เลือกไว้ข้าม login,
    และ `add_variant` ที่ไม่มีอยู่จริง/ขายไม่ได้แสดงข้อความ error (`data-testid="add-variant-error"`) ไม่เงียบ

### Acceptance criteria (follow-up CORE-6)
- AC-34 Given customer A มี cart CA และ customer B ล็อกอิน When B เรียก `GET /store/carts/CA`, `POST /store/carts/CA`,
  `POST /store/carts/CA/line-items`, `POST` และ `DELETE /store/carts/CA/line-items/:line_id`, `POST` และ `DELETE /store/carts/CA/promotions`,
  `POST /store/carts/CA/shipping-methods`, `POST /store/carts/CA/taxes`, `POST /store/carts/CA/complete`, `POST /store/carts/CA/customer`
  Then ทุกตัวได้ 404 และ CA ไม่เปลี่ยน (items, promotions, shipping methods, `email`, `completed_at`); When A เรียกชุดเดียวกัน Then ได้ผลเหมือนก่อน CORE-12
- AC-35 Given CA มี payment collection PC When B เรียก `POST /store/payment-collections {cart_id: CA}`,
  `POST /store/payment-collections/PC/payment-sessions`, `GET /store/shipping-options?cart_id=CA`,
  `POST /store/shipping-options/:id/calculate {cart_id: CA}` Then 404 และไม่มี payment session ใหม่; A → 200 ยกเว้น `calculate`:
  A ผ่าน auth + ownership ไปถึง handler ของ Medusa (status **ไม่ใช่** 401/404) — option ใน seed เป็นราคา flat ของ provider manual
  ซึ่งคำนวณไม่ได้ handler จึงตอบ error ของตัวเอง (เช่น 500/400) ซึ่งไม่ใช่สิ่งที่ AC นี้ทดสอบ (แก้ถ้อยคำ 2026-10-26 ตามผล review CORE-12)
- AC-36 Given ไม่มี token When `GET /store/carts/CA` หรือ `GET /store/orders/:id` Then 401
- AC-37 Given order OA ของ A When B `GET /store/orders/OA` Then 404; A → 200
- AC-38 Given cart ที่ `customer_id` เป็น null (สร้างตรงผ่าน module ใน test) When customer ใดเรียก `GET /store/carts/:id` Then 404
- AC-39 (CORE-13) Given order OA ของ A When ไม่มี token `POST /store/returns {order_id: OA}` Then 401; B → 404 และไม่มี return;
  A → 200 และมี return ของ OA
- AC-40 (CORE-13) Given order OA ของ A When เรียก `POST /store/orders/OA/transfer/request`, `/accept`, `/decline`, `/cancel` ทั้งแบบไม่มี
  token, token ของ B และ token ของ A (body ถูกต้องตาม validator ของ Medusa) Then ทุกครั้งได้ 404, ไม่มี order change ประเภท transfer
  ถูกสร้าง และ `OA.customer_id` ยังเป็น A (middleware ปิด route ไม่ระบุ method — ดู "API routes")
- AC-41 (CORE-14a) Given ไม่มี customer session When `GET /buy/<variant_id>:1` Then redirect ไปหน้า login
  ที่มี return URL กลับ `/buy/...` และจำนวน cart ใน DB ไม่เปลี่ยน; Given ล็อกอินแล้ว Then 303 ไป `/<cc>/checkout` และ cart ใหม่มี
  `customer_id` ของผู้ล็อกอิน; (nit review CORE-14a, รอบ 7 — ทำใน CORE-14c #117; **แก้ถ้อยคำรอบ 10** ให้ตรงกับ #117: route `/buy` ตอบ **303** เสมอ) e2e กรณีไม่มี session
  ยิงด้วย `maxRedirects: 0` แล้ว assert status = 303 และ header `location` ชี้หน้า login **ก่อน**ตาม redirect (ไม่ assert เพียงหน้าปลายทาง)
- AC-42 (CORE-14a) `GET /ucp/v1`, `POST /ucp/v1/cart`, `GET /<cc>/cart/resume/<id>` → 404; (รอบ 10 — ที่มาจริงของ nit 307/308 ใน review #81 r2, ทำใน #117) e2e ของ `/ucp/v1` ยิง
  `maxRedirects: 0` แล้ว assert redirect แรกเป็น 307/308 ไป `/th/ucp/...` (middleware ของ country code) ก่อนตามถึง 404 — ไม่มี 2xx ระหว่างทาง
- AC-43 (CORE-14a) Given ไม่มี session แต่มี cookie `_medusa_cart_id` ค้าง When เปิด `/<cc>/cart` Then แสดงหน้า cart ว่างหรือ redirect login
  (ไม่มี 5xx) และ cookie cart ถูกล้าง (e2e)
- AC-44 (CORE-14b, QA CORE-6 D-1, กฎ 26) Given browser ปิด JavaScript และไม่มี session When กด "Add to cart" บน PDP ที่เลือก quantity 3
  Then response HTML ของ `/account?add_variant=…` มีฟอร์ม login (หาด้วย `data-testid` ของฟอร์ม login) ไม่ใช่เพียง spinner ของ `loading.tsx`;
  When login สำเร็จ (ยังไม่มี JS) Then cart มี line ของ variant นั้น `quantity=3`
- AC-45 (CORE-14b, กฎ 26) Given ล็อกอินแล้ว When เปิด `/account?add_variant=variant_ไม่มีจริง` Then เห็น `data-testid="add-variant-error"`
  และ cart ไม่เปลี่ยน; ทั้งแบบเปิดและปิด JS

### แผนการทดสอบ (follow-up CORE-6)
| ระดับ | AC |
|------|----|
| unit (Jest) | resolver ของ owner ต่อ matcher (cart/body/query/collection/order) |
| integration http | AC-34..AC-40 |
| e2e / route test ของ storefront | AC-41, AC-42, AC-43, AC-44 (Playwright context `javaScriptEnabled: false`), AC-45 |

### Tasks (follow-up CORE-6)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-12 | **ความปลอดภัย**: middleware `ensureStoreOwnership` ตาม ADR-013 + matcher ทั้งหมดของ CORE-12 ใน "API routes" + เพิ่ม `authenticate("customer")` ที่ `/store/shipping-options*` และ `GET /store/orders/:id` + integration test | AC-34..38 | CORE-6 |
| CORE-13 | auth + ownership ของ order สำหรับ `POST /store/returns` (ใช้ helper จาก CORE-12) + ปิด order transfer ทั้งชุด (404) | AC-39, AC-40 | CORE-12 (แก้ `src/api/middlewares.ts` ไฟล์เดียวกัน) |
| CORE-14a | (◐ #81, แยกรอบ 6) storefront: `/buy/[items]` บังคับล็อกอินแล้วสร้าง cart พร้อม customer; ปิด `/ucp/*`, `lib/ucp/*`, `cart/resume` (ลบ route); จัดการ cookie cart ค้างเมื่อไม่มี session; ลบหน้า order transfer | AC-41, 42, 43, 56 | CORE-6 |
| CORE-14b | (แยกรอบ 6) แก้ flow no-JS ของ `/account?add_variant=` (กฎ 26, QA CORE-6 D-1) + error ของ `add_variant` | AC-44, 45 | CORE-6 (∥ CORE-14a; แตะ `account` คนละไฟล์ — ถ้าชนตัวที่ merge ทีหลัง rebase) |
| CORE-14c | (เล็ก, follow-up review #81 รอบ 6) login ขณะมี cookie `_medusa_cart_id` ค้างที่เป็น cart ของ**คนอื่น** (มี jwt แล้ว) → `transferCart()` ได้ 404 จาก ownership ของ CORE-12 → ต้องไม่ทำให้ login ล้ม (กฎข้อ 40, AC-76); **รวม nit review CORE-14a (รอบ 7)**: e2e AC-41 กรณีไม่มี session assert 307/308 + `location` ก่อนตาม redirect | AC-76, AC-41 (nit) | CORE-14a |
CORE-12 ∥ CORE-14a ∥ CORE-14b; CORE-13 หลัง CORE-12; CORE-12 ควร merge ก่อน release แรกที่เปิดให้ลูกค้าจริงใช้; CORE-14c หลัง CORE-14a (แตะ `lib/data/customer.ts`
เดียวกับ CORE-4c1 — ตัวที่ merge ทีหลัง rebase)
การแทน "Medusa Store" ในหน้า account (register, metadata `@login`/`profile`) **ไม่ใช่**ขอบเขตของ CORE-14 — อยู่ใน CORE-18 (#80, AC-61, กฎข้อ 38)

### ข้อตัดสินของ owner (follow-up CORE-6, 2026-10-25)
- ADR-013 accepted
- ~~Q-F2~~ `/buy/[items]` เก็บไว้แต่บังคับล็อกอิน; ปิด UCP (`/ucp/*`, `lib/ucp/*`, `cart/resume`) ทั้งชุดใน v1 (เปิดภายหลังต้องมี ADR)
- ~~Q-F3~~ ปิด order transfer ทั้งชุด (request/accept/decline/cancel)

## Follow-up รอบ 4 จาก review/qa + ข้อตัดสินของ owner (2026-10-26)
ไม่เปลี่ยนนิยามของ CORE-12 (#51) — AC-35 แก้เฉพาะถ้อยคำของ `calculate` (ดูใน AC-35); กฎข้อ 15 เพิ่มลำดับ release (runbook ใน
`docs/ops/production.md`) ไม่มี task โค้ด
Out of scope: rate limit ของ `/store/search` (OPS-3), ข้อความ UI อื่นของหน้า `/store` (CORE-4b)

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| คำนวณราคา/ภาษีของสินค้าตาม cart | `GET /store/products*`, `/store/product-variants*` รับ `cart_id` ใน query แล้วใช้ region/ที่อยู่ของ cart นั้น — **ไม่ตรวจเจ้าของ cart** (QA พบ: cart ของคนอื่นได้ 200) | ขยาย: middleware ของ CORE-12 (ADR-013) ตรวจ `query.cart_id` (CORE-12b) |
| auth แบบไม่บังคับ | `authenticate("customer", ["session","bearer"], { allowUnauthenticated: true })` | ใช้ตามเดิม (เฉพาะเมื่อมี `cart_id`) |
| ค้นหาสินค้าบนหน้า store | `/store/search` + `@medusajs/instantsearch-adapter` ของ starter | ใช้ตามเดิม; แก้ฝั่ง storefront เมื่อ error (CORE-15) |
| ที่วาง evidence ของ hotfix | ไม่มี (convention ของเรา, CORE-5b) | กำหนด convention (กฎข้อ 27) ไม่แก้โค้ด |

### Data model / Workflows
none

### API routes (CORE-12b)
ไม่มี route ใหม่ เพิ่ม middleware ใน `src/api/store/ownership/` บน `GET /store/products`, `GET /store/products/:id`,
`GET /store/product-variants`, `GET /store/product-variants/:id` และ store route อื่นของ Medusa 2.22.1 ที่อ่าน `cart_id` จาก query
(builder ค้น source ของ `@medusajs/medusa` `api/store/**` แล้วระบุรายการครบใน PR) — ทำงาน**เฉพาะเมื่อ query มี key `cart_id`**:
ไม่มี token → 401; มี token แต่ cart ไม่ใช่ของผู้เรียก/ไม่พบ/ค่าไม่ใช่ string เดี่ยว → 404 (helper `cartOwner`/`assertOwner` ของ CORE-12);
ไม่มี `cart_id` → ผ่านโดยไม่ต้อง auth (การเรียกดูยังเป็นสาธารณะ)

### Business rules
27. (evidence ของ hotfix/chore ที่ไม่มี task id) ผล test ใส่ใน body ของ PR เท่านั้นเป็นค่าเริ่มต้น; ถ้าต้องเก็บไฟล์ใช้
    `docs/evidence/ops/HOTFIX-<เลข PR>[-tests.txt|/]` ซึ่งตรง `TASK_ID_RE` (ดูกฎข้อ 11) อยู่แล้ว — ไม่แก้ regex/budget test
    (`docs/evidence/README.md`)
28. (CORE-12b, ADR-013) store route ของ Medusa ที่ใช้ `cart_id` ใน query เพื่อคำนวณราคา/ภาษี ต้องผ่านกฎ 22 **เมื่อมี `cart_id`** เท่านั้น
29. (CORE-15) เมื่อ `/store/search` ตอบ error หน้า `/store` ต้อง**หยุดยิง request** (ไม่มี retry อัตโนมัติวนไม่จบ; เปลี่ยน filter/หน้า/ค้นหาใหม่
    โดยผู้ใช้ = request ใหม่ได้ตามปกติ) และแสดง `data-testid="products-error"` เป็นข้อความภาษาไทย (ADR-014) แทนรายการสินค้า

### Acceptance criteria (follow-up รอบ 4)
- AC-51 (CORE-12b) Given customer A มี cart CA (region Thailand) และ B ล็อกอิน When B เรียก `GET /store/products?cart_id=CA`,
  `GET /store/products/:id?cart_id=CA`, `GET /store/product-variants?cart_id=CA`, `GET /store/product-variants/:id?cart_id=CA` Then ทุกตัว 404;
  When A เรียกชุดเดียวกัน Then 200 และ `calculated_price` เท่ากับก่อนเพิ่ม middleware (integration http)
- AC-52 (CORE-12b) Given ไม่มี token When เรียก 4 route ใน AC-51 พร้อม `cart_id=CA` Then 401; When ไม่มี `cart_id` (มี `region_id`) Then 200
  ทั้ง 4 route (การเรียกดูสาธารณะไม่เปลี่ยน)
- AC-53 (CORE-12b) Given A ล็อกอิน When `cart_id=` (ว่าง), `cart_id=cart_ไม่มีจริง`, หรือ `cart_id=CA&cart_id=CA` (array) Then ไม่ใช่ 200
  (404 จาก middleware หรือ 400 จาก validator ของ Medusa) และไม่มี 5xx
- AC-54 (CORE-15, กฎข้อ 29) Given storefront + backend ที่ seed แล้ว และ Playwright `page.route("**/store/search**")` ตอบ 500 ทุกครั้ง
  When เปิด `/th/store` แล้วรอ 6 วินาที Then จำนวน request ไป `/store/search` ≤ 3 (นับด้วย `page.on("request")`), `products-error` มองเห็นได้
  และ textContent มีอักษรไทย, ไม่มี `pageerror` (e2e, screenshot)
- AC-55 (CORE-15) Given สถานะของ AC-54 When ยกเลิก route mock แล้ว reload Then เห็นการ์ดสินค้า (test id ของการ์ดใน store-hits) และ
  ไม่มี `products-error` (e2e)
- AC-69 (CORE-15, D-1 จาก qa CORE-4b2) Given Playwright context locale `en-US` When เปิด `/th/store` Then ป้ายช่วงราคาใต้ slider ตัวกรองราคา
  แสดงสกุลเงินแบบ `฿` (ผ่าน `convertToLocale`) ไม่มีสตริง `THB` — ป้ายค่าต่ำสุดและสูงสุดแต่ละตัวตรง `/^฿[\d,]+(\.\d{2})?$/` ทั้งก่อนและหลังลาก slider
  (e2e; หา element ด้วย `data-testid` ที่ CORE-15 เพิ่มให้ป้ายถ้ายังไม่มี)

### แผนการทดสอบ (follow-up รอบ 4)
| ระดับ | AC |
|------|----|
| unit (Jest) | resolver `cart_id` จาก query: ไม่มี key → ข้าม, string → ตรวจ, array/ว่าง → 404 |
| integration http | AC-51, AC-52, AC-53 |
| e2e | AC-54, AC-55, AC-69 |

### Tasks (follow-up รอบ 4)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-12b | **ความปลอดภัย (เล็ก)**: ขยาย ownership middleware ของ CORE-12 (`src/api/store/ownership/`) ให้ตรวจ `query.cart_id` บน products/product-variants (+ store route อื่นที่อ่าน `cart_id` จาก query ตามที่ตรวจ source) ตามกฎข้อ 28 + integration test | AC-51..53 | CORE-12 |
| CORE-15 | storefront: หน้า `/store` หยุดยิง `/store/search` ซ้ำเมื่อ error และแสดง `products-error` ภาษาไทย (กฎข้อ 29) + e2e; รวม defect D-1 จาก qa CORE-4b2: ป้ายช่วงราคาใต้ slider (`store-refinements/price-range.tsx` `formatAmount`) ใช้ `convertToLocale` แสดง `฿590` ไม่ใช่ `THB 590` เมื่อ browser เป็น en-US (AC-69) | AC-54, AC-55, AC-69 | CORE-9 |
CORE-12b ∥ CORE-15 ∥ CORE-13 (CORE-12b แตะ `src/api/store/ownership/` — ถ้า CORE-13 แตะไฟล์เดียวกันให้ตัวที่ merge ทีหลัง rebase);
CORE-12b ควร merge ก่อน release แรกที่เปิดให้ลูกค้าจริงใช้ (เหมือน CORE-12); CORE-15 กับ CORE-4b แตะ `store-hits` เดียวกัน — ตัวที่ merge ทีหลัง rebase

## Follow-up รอบ 5 + ข้อตัดสินของ owner (2026-10-26)
บันทึก CORE-16 (merge แล้ว #63) ตามที่ทำจริง, CORE-17 (#71 — AC-60a..f ตรงกับ AC-a..f ใน body ของ PR ตามที่ reviewer ขอ
และระบุว่า rule รับเฉพาะ operator `eq` ตามที่ #71 ทำ (rule แบบ `in` ถูกปฏิเสธโดยการออกแบบ ไม่บังคับ test แยก); ส่วนที่เพิ่มจาก review
แยกเป็น CORE-21) และ follow-up จาก qa/review
ไม่เปลี่ยนนิยามของ CORE-11 (#64), CORE-4b2 (#70); CORE-14 (ยังไม่เริ่ม) ได้ขอบเขตเพิ่ม 1 ข้อ (ลบหน้า order transfer, AC-56); CORE-10 (ยังไม่เริ่ม)
ได้ขอบเขตเพิ่ม 1 ข้อ (ชื่อ option ไทย, AC-68); CORE-18 เพิ่มการลบ `product-onboarding-cta` (AC-67)
Out of scope: นโยบายคืนสินค้า/ค่าส่งคืนจริง (Q-F1 ยังเป็น placeholder), การรับของคืน/refund ฝั่ง admin (ใช้หน้า order ของ Medusa admin ตามเดิม)

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ (2.22.1) | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| ลูกค้าขอคืนสินค้า | `POST /store/returns` → `createAndCompleteReturnOrderWorkflow` | ใช้ตามเดิม + middleware ปิดฟิลด์ที่ store ไม่ควรกำหนด (CORE-16) และตรวจ option (CORE-17) |
| return shipping option | shipping option ที่มี rule `is_return=true` (+ `enabled_in_store`) ใน service zone | ใช้ตามเดิม: seed สร้าง "Standard return" (CORE-16) |
| stock location ↔ sales channel | link `sales_channel ↔ stock_location` ของ Medusa (อ่านด้วย `query.graph`) | ใช้ตามเดิมใน CORE-21 |
| เหตุผลการคืน | Return reasons (`GET /store/return-reasons`, admin) | ใช้ตามเดิม (CORE-20) |
| รับของคืน / refund | admin order page (receive return, refund) | ใช้ตามเดิม — store ห้าม `receive_now` |
| หน้าขอคืนสินค้าใน storefront | ไม่มีใน starter | custom page (CORE-20) |
| ตัวนับ cart / search drawer / ปุ่ม "Continue to review" | starter (มี bug เดิม) | แก้ใน storefront (CORE-19a/b) |
| เนื้อหาหน้าร้าน (hero, footer) | starter มีข้อความโฆษณา Medusa/Next.js/GitHub | แทนด้วยเนื้อหาร้าน (CORE-18) |

### Data model / Workflows
none (CORE-16/17 เป็น middleware บน route ของ Medusa; seed เพิ่ม shipping option)

### API routes
ไม่มี route ใหม่ — middleware บน `POST /store/returns` ต่อจาก auth + ownership ของ CORE-13 (`src/api/store/ownership/`):
- CORE-16 (`rejectStoreReturnOverrides`, อ่าน `req.body` ดิบ): body มี key `return_shipping.price`, `receive_now` หรือ `location_id`
  (ค่าใดก็ได้ รวม `0`/`false`) → 400 `invalid_data` ข้อความระบุชื่อฟิลด์; body/`return_shipping` ที่ไม่ใช่ object → ปล่อยให้ validator ของ core ตอบ
- CORE-17: `return_shipping.option_id` ต้องเป็น shipping option ที่ (1) มี rule `is_return` = `"true"`, (2) มี rule `enabled_in_store` = `"true"`,
  (3) อยู่ใน service zone ที่ครอบที่อยู่จัดส่งของ order (geo zone ตาม `order.shipping_address.country_code`) — ไม่ผ่านข้อใด หรือ id ไม่มีจริง → 400 `invalid_data`
  rule ข้อ (1)/(2) นับว่าผ่าน**เฉพาะ operator `eq`** กับค่า `"true"` — rule ที่ใช้ operator อื่น (เช่น `in` แม้ค่าเป็น `["true"]`) ถือว่าไม่ผ่าน (ตามที่ #71 ทำ
  และ reviewer ยอมรับ 2026-10-26); ทำงานหลัง auth + ownership ของ CORE-13 (ADR-013)
- CORE-21 (follow-up review #71): นอกจากข้างบน stock location ของ return option (location ของ fulfillment set ที่ service zone ของ option สังกัด)
  ต้องผูกกับ sales channel ของ order (`order.sales_channel_id`) — ไม่ผูก → 400 `invalid_data`

### Business rules
30. (CORE-16) store กำหนดราคาส่งคืน, stock location ที่รับคืน และการรับของคืนทันทีเองไม่ได้ — ราคา/location มาจาก return option,
    admin เป็นผู้รับของคืน
31. (CORE-16) seed มี return option "Standard return" หาด้วย `type.code = "standard-return"` (ไม่ใช่ชื่อ): flat, provider/service zone/
    shipping profile เดียวกับ "Standard", rules `is_return=true` + `enabled_in_store=true`, ราคา THB = 0 ถ้า `free_returns` ไม่เช่นนั้น =
    `shipping_rate` (`DEFAULT_REGION_STORE_POLICIES`, ตอนนี้ 10 THB placeholder ตาม Q-F1); seed สร้างเฉพาะเมื่อยังไม่มี (รันซ้ำได้) — admin ที่จะ
    เลิกใช้ให้ปิด `enabled_in_store` แทนการลบ (ลบแล้ว seed ครั้งถัดไปสร้างกลับ)
32. (CORE-17) return option ที่ลูกค้าเลือกต้องผ่านเงื่อนไข 3 ข้อใน "API routes" — **ต้อง merge ก่อน release แรกที่เปิดให้ลูกค้าจริงใช้**
33. (CORE-18, owner) storefront ห้ามมีข้อความ/ลิงก์โฆษณาของ starter (Medusa, Next.js, GitHub, `medusajs.com`, `github.com`) ที่ผู้ใช้เห็น
    ใช้เนื้อหาร้านภาษาไทย — จนกว่า owner ส่งเนื้อหาจริงใช้ placeholder ไทยที่มีคอมเมนต์ `TODO(owner-content)` — ต้องเสร็จก่อน release แรก
    (owner 2026-10-26: placeholder ไทยไปก่อน รวมเป็นค่าคงที่ที่แก้ได้ง่าย) และไม่มี component ของ starter ที่ลิงก์ไป `localhost:7001`
    (`product-onboarding-cta`)
34. (CORE-19a) การลบ item ใน cart dropdown ต้องอัปเดตตัวนับใน nav โดยไม่ต้อง reload (starter เดิมไม่อัปเดต)

### Acceptance criteria (follow-up รอบ 5)
- AC-56 (CORE-14a) Given storefront When `GET /th/order/<id>/transfer/<token>`, `.../accept`, `.../decline` Then 404; และไม่มีไฟล์ใต้
  `apps/storefront/src/app/[countryCode]/(main)/order/[id]/transfer/` และไม่มีการเรียก `/store/orders/*/transfer` ใน `apps/storefront/src` (grep ใน test)
- AC-57 (CORE-16 ✓ #63) Given order OA ของ A (2 ชิ้น fulfill แล้ว) When A `POST /store/returns` พร้อม `return_shipping.price: 0`,
  `receive_now: true` (คืนครบ), `receive_now: false`, หรือ `location_id: <stock location จริง>` (ทีละกรณี) Then 400 `type=invalid_data`
  และ OA ไม่มี return (integration http `store-returns-overrides.spec.ts`; unit `return-overrides.unit.spec.ts`)
- AC-58 (CORE-16 ✓ #63) Given seed When A `POST /store/returns` ด้วย `return_shipping: { option_id: <Standard return> }` ไม่มีฟิลด์ต้องห้าม
  Then 200, return `status=requested`, `received_at=null`, shipping method มี `shipping_option_id` = option นั้นและ `amount` = ราคาตามกฎข้อ 31,
  fulfillment ของ return ไปที่ stock location ของ option
- AC-59 (CORE-16 ✓ #63) Given DB ว่าง When seed Then มี option `type.code="standard-return"` 1 รายการตามกฎข้อ 31 (name "Standard return",
  `price_type=flat`, `provider_id=manual_manual`, มี location); Given DB ที่ seed ก่อน CORE-16 (ลบ option ออก) When seed 2 ครั้ง Then มี 1 รายการ
  (integration `seed.spec.ts`)
- AC-60 (CORE-17, ตรงกับ AC-a..AC-f ใน body ของ PR #71) Given order OA ของ A (fulfill แล้ว, ที่อยู่ประเทศ TH) When A `POST /store/returns` ด้วย
  `return_shipping.option_id` = … Then:
  - AC-60a option ที่ไม่ใช่ return (เช่น "Standard" ขาออก, `is_return` ≠ `"true"`) → 400 `invalid_data` ข้อความ `Shipping option is not a return option`
    และ OA ไม่มี return
  - AC-60b return option ที่ `enabled_in_store` ≠ `"true"` (rule ที่ใช้ operator อื่นที่ไม่ใช่ `eq` เช่น `in` ถือว่าไม่ผ่านเช่นกัน) → 400 ข้อความ
    `Return shipping option is not available in store` และ OA ไม่มี return
  - AC-60c return option ใน service zone ที่ไม่ครอบที่อยู่ของ order (zone ประเทศอื่น สร้างใน test) หรือ order ไม่มี `country_code` → 400 `invalid_data` ข้อความ
    `Return shipping option does not serve the order's shipping address` และ OA ไม่มี return
  - AC-60d id ที่ไม่มีจริง → 400 `invalid_data` (ไม่ใช่ 500) และ OA ไม่มี return
  - AC-60e "Standard return" จาก seed → 200 (AC-58 ยังผ่าน)
  - AC-60f ตรวจ option หลัง customer auth + owner check (CORE-13) และ override check (CORE-16): ไม่มี token → 401; customer B → 404
    (test 401/404 ของ CORE-13 ใช้ยืนยันได้) — ไม่ห่อ route ของ Medusa (ADR-013)
  (integration http `store-returns-*.spec.ts`; unit ของตัวตรวจ rule ถ้าแยกเป็น pure function)
- AC-66 (CORE-21) Given return option R ที่ผ่าน AC-60 ทุกข้อ แต่ stock location ของ fulfillment set ของ R ไม่ผูกกับ sales channel ของ OA (สร้างใน test)
  When A `POST /store/returns` ด้วย R Then 400 `invalid_data` และ OA ไม่มี return; "Standard return" จาก seed → 200 (integration http)
- AC-67 (CORE-18) Given `apps/storefront/src` Then ไม่มีโฟลเดอร์/การ import `product-onboarding-cta` และไม่มีสตริง `localhost:7001` (grep ใน test);
  PDP ของสินค้า seed ยังแสดงปกติ (e2e ของ AC-61)
- AC-68 (CORE-10, review #70) Given DB ว่าง When รัน seed Then `title` ของทุก product option ของสินค้าตัวอย่าง (เดิม `Size`, `Color`) มีอักษรไทย
  (`/[฀-๿]/`); ค่า option ที่เป็นรหัสสากล (เช่น `S`, `M`, `L`, `XL`) คงเดิมได้, ค่าที่เป็นคำ (เช่น `Black`, `White`) เป็นไทย; `handle` ของสินค้าเท่าเดิม
  (integration seed)
- AC-61 (CORE-18, กฎข้อ 33) Given storefront + backend ที่ seed แล้ว When e2e เปิด `/th` (home), `/th/store`, PDP ของสินค้า seed และ
  `/th/account` (ไม่ล็อกอิน) Then **ข้อความที่ storefront เขียนเอง** ไม่ตรง `/Medusa|Next\.js|GitHub/i` และไม่มี `a[href*="github.com"]`,
  `a[href*="medusajs.com"]`, `a[href*="nextjs.org"]`; hero และ footer มีอักษรไทย (screenshot home)
  (แก้ถ้อยคำรอบ 6) ข้อมูลจาก backend (ชื่อสินค้า/option/collection/category จาก seed) **ไม่นับ** ตาม ADR-014 ข้อ 4 (และกฎ CORE-4 ข้อ 5): e2e clone `document.body`
  แล้วลบ element ข้อมูลสินค้าที่หาด้วย `data-testid` (เช่น ชื่อสินค้าบนการ์ด/PDP, option value, ชื่อ collection/category) ออกก่อนอ่าน `innerText` — ระบุรายการ
  test id ที่ตัดออกในตัว test; (รอบ 6, review #80) e2e สลับไปฟอร์มสมัครบน `/th/account` แล้วตรวจข้อความแบบเดียวกัน และ `document.title`/meta description
  ของหน้า login และ profile ไม่ตรง `/Medusa/i` — CORE-18 แทน "Medusa Store" ใน `register/index.tsx`, `@login/page.tsx`, `@dashboard/profile/page.tsx`
  ด้วย `STORE_NAME` (กฎข้อ 38) จึง**ไม่มี**รายการยกเว้นรายไฟล์ใน test
- AC-62 (CORE-19a, กฎข้อ 34) Given ลูกค้าล็อกอินมี cart 2 line (qty 1, 1) When เปิด cart dropdown แล้วกดลบ line หนึ่ง Then ตัวนับใน nav
  (หาด้วย test id) เป็น 1 ภายใน 5 วินาทีโดยไม่ reload (e2e)
- AC-63 (CORE-19a) Given viewport 375×812 When เปิด search drawer แล้วพิมพ์ข้อความ 200 ตัวอักษรไม่มีช่องว่าง Then
  `document.documentElement.scrollWidth <= 375` และ input/ผลลัพธ์ไม่ล้นออกนอก drawer (`scrollWidth <= clientWidth` ของ container) (e2e, screenshot)
- AC-64 (CORE-19b) Given checkout ที่กรอกที่อยู่/shipping/payment ครบ When กด "Continue to review" **ครั้งเดียว** วนซ้ำ 20 รอบ (cart ใหม่ทุกรอบ หรือ
  ย้อนกลับขั้น payment) Then ทุกรอบ URL มี `step=review` ภายใน 10 วินาที; และ helper `continueToReview` ใน `e2e/support/stripe.ts` ไม่มีการกดซ้ำ
  (retry click) แล้ว (e2e + grep)
- AC-65 (CORE-20) Given order ของ A ที่ fulfill แล้ว When A เปิดหน้า order detail แล้วกดขอคืนสินค้า (`data-testid="order-return-button"`) เลือก item,
  จำนวน, เหตุผล (จาก return reasons ของ Medusa) แล้วยืนยัน Then มี return `requested` ของ order นั้นใน DB ที่ใช้ option "Standard return" และหน้าแสดง
  ข้อความสำเร็จภาษาไทย (`order-return-success`); request ที่ storefront ส่งไม่มีฟิลด์ต้องห้ามของกฎข้อ 30; order ที่ยังไม่ fulfill ไม่มีปุ่ม (e2e, screenshot)

### แผนการทดสอบ (follow-up รอบ 5)
| ระดับ | AC |
|------|----|
| unit (Jest) | AC-57 (`storeReturnOverrides`), AC-60a..b (ตัวตรวจ rule `eq`/`in` ถ้าแยกเป็น pure function) |
| unit (Vitest/grep storefront) | AC-67 |
| integration http | AC-57, AC-58, AC-59, AC-60a..f, AC-66 |
| integration (seed) | AC-68 |
| e2e / route test ของ storefront | AC-56, AC-61, AC-62, AC-63, AC-64, AC-65 |

### Tasks (follow-up รอบ 5)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-16 | ✓ #63 — middleware ปฏิเสธ `return_shipping.price`/`receive_now`/`location_id` บน `POST /store/returns` + seed "Standard return" | AC-57..59 | CORE-13 |
| CORE-17 | **ความปลอดภัย**: ตรวจ `return_shipping.option_id` ตามกฎข้อ 32 (`is_return`, `enabled_in_store` แบบ operator `eq` เท่านั้น, service zone ของ order) + integration test — ปิดก่อน release แรก | AC-60a..f | CORE-16 |
| CORE-18 | storefront: แทนข้อความ/ลิงก์โฆษณาของ starter (hero, footer, nav, metadata) ด้วยเนื้อหาร้านภาษาไทย placeholder (owner 2026-10-26: ใช้ placeholder ไปก่อน รวมไว้เป็นค่าคงที่ในไฟล์เดียว เช่น `src/lib/store-content.ts` (ไม่สร้างโฟลเดอร์ `lib/constants/` ชนกับ `lib/constants.tsx`) ที่มี `TODO(owner-content)` ให้แก้ง่าย) + ลบ component `product-onboarding-cta` ของ starter (ลิงก์ไป `localhost:7001`, review #70) + แทน "Medusa Store" ในหน้า account ด้วย `STORE_NAME` (รอบ 6, review #80, กฎข้อ 38) — ก่อน release แรก | AC-61, AC-67, AC-74 | CORE-4b2 (#70; แตะ layout/home/PDP ที่ 4b2 แปลแล้ว) |
| CORE-21 | (เล็ก, follow-up review #71) `POST /store/returns`: stock location ของ return option ต้องผูกกับ sales channel ของ order (ต่อจาก middleware ของ CORE-17) — เขียน test AC-66 ก่อน ถ้า `createAndCompleteReturnOrderWorkflow` ของ Medusa ปฏิเสธให้อยู่แล้ว (test ผ่านโดยไม่แก้) PR มีแค่ test; **เพิ่มรอบ 6**: test AC-60c กรณี order ไม่มี `country_code` (AC-70) + error "ไม่พบ option" ไม่สะท้อน `option_id` จาก input (AC-71) | AC-66, AC-70, AC-71 | CORE-17 (#71; แตะ middleware เดียวกัน) |
| CORE-19a | storefront: ตัวนับ cart ใน nav อัปเดตหลังลบใน dropdown + search drawer ไม่ล้นที่ 375px | AC-62, AC-63 | CORE-4b2 (แตะ `modules/layout`, `modules/search`) |
| CORE-19b | storefront: ปุ่ม "Continue to review" ไม่ค้าง (`router.push` ของ starter ใน `modules/checkout`) + ลบการกดซ้ำใน `continueToReview` ของ e2e | AC-64 | CORE-4d (แตะไฟล์ checkout เดียวกัน) |
| CORE-20 | (◐ #112) storefront: หน้าขอคืนสินค้าจาก order detail (เลือก item/จำนวน/เหตุผล → `POST /store/returns` ด้วย return option ของร้าน) ข้อความไทย + path ใหม่ใน ESLint rule (กฎ CORE-4 ข้อ 4) | AC-65 | CORE-17, CORE-4c2 (แตะ `modules/order`) |
CORE-17 ∥ CORE-18 ∥ CORE-19a; CORE-19b หลัง CORE-4d; CORE-20 หลัง CORE-17 และ CORE-4c2; CORE-21 หลัง CORE-17 (∥ CORE-20) — CORE-17, CORE-18
อยู่บนเงื่อนไข release แรก (CORE-21 แนะนำก่อน release แรก ไม่บังคับ: ร้านมี sales channel/stock location เดียว)
CORE-14 เพิ่มขอบเขต: ลบหน้า order transfer `(main)/order/[id]/transfer/**` และโค้ดที่เรียก transfer ใน `lib/data` (AC-56; backend ปิด route แล้วใน CORE-13)
— ส่วนนี้อยู่ใน CORE-14a (#81) ตามการแยกรอบ 6

### Open questions (รอบ 5)
- ~~Q-F4~~ ตัดสินแล้ว (owner 2026-10-26): CORE-18 ใช้เนื้อหา placeholder ภาษาไทยไปก่อน เก็บเป็นค่าคงที่ที่แก้ได้ง่าย (กฎข้อ 33) owner ส่งเนื้อหาจริง
  ภายหลัง = แก้ค่าคงที่ ไม่ต้องมี task ใหม่
- ~~Q-F5~~ (CORE-20) **owner ตัดสิน 2026-10-26**: ปุ่มขอคืนแสดงเฉพาะภายใน N วันหลังได้รับของ (นับจาก `delivered_at` ของ fulfillment ถ้าไม่มีใช้ `shipped_at`; ใช้ `return_window_days` ใน region metadata ที่
  storefront อ่านอยู่แล้ว; ~~backend ไม่บังคับใน v1~~ — **owner เปลี่ยนเป็นบังคับ 2026-10-27 (Q-F6, CORE-20b)**) และซ่อนสำหรับ e-voucher/item ที่ไม่ต้องจัดส่ง (spec 02 กฎข้อ 6)

## Follow-up รอบ 6 จาก review/qa (2026-10-26)
แยก CORE-14 เป็น 14a (#81)/14b + follow-up 14c (transferCart 404 ตอน login); เพิ่มขอบเขตเล็กให้ CORE-10, CORE-21 และ CORE-18 (#80: "Medusa Store" ในหน้า account
→ `STORE_NAME`) และยืนยันขอบเขต CORE-4d; แก้ถ้อยคำ AC-61 (CORE-18) ให้ไม่นับข้อมูลจาก backend;
บันทึก nit ของ CORE-12b; CORE-15 AC-69 มีอยู่แล้ว (เติมรายละเอียด regex)
Out of scope: เปลี่ยนชื่อไทยใน DB ที่ seed ไปแล้ว (seed ไม่ rename resource ที่มีอยู่ — กฎข้อ 36)

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| category ที่มี handle คงที่ | `createProductCategoriesWorkflow` รับ `handle` (ไม่ส่ง = สร้างจาก `name`) | ใช้ตามเดิม: ส่ง `handle` เองเพราะชื่อเป็นไทย |
| error ของ request ที่ไม่ถูกต้อง | `MedusaError(INVALID_DATA, message)` → 400 | ใช้ตามเดิม (ข้อความคงที่ ไม่ต่อ input) |
| โอน cart เข้าบัญชีตอน login | `POST /store/carts/:id/customer` (starter เรียกผ่าน `transferCart()` ใน `lib/data/customer.ts`) + ownership ของ CORE-12 | ใช้ตามเดิม; storefront จัดการ 404 (CORE-14c, กฎข้อ 40) |

### Data model / Workflows / API routes
none

### Business rules
35. (CORE-10, รอบ 6) ชื่อ category ตัวอย่างใน seed เป็นภาษาไทย และส่ง `handle` คงที่ `shirts`, `sweatshirts` (= handle ที่ Medusa สร้างจากชื่ออังกฤษเดิม —
    URL `/categories/<handle>` และ e2e ไม่เปลี่ยน); seed หา category ด้วย `handle` (กฎข้อ 17)
36. (CORE-10, รอบ 6) `README.md` หัวข้อ local dev ระบุ: ต้องตั้ง `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` ใน `apps/backend/.env` เอง (ไม่มีค่าตัวอย่าง กฎข้อ 18)
    และตั้ง `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` (หรือใช้ค่า `SEED_ADMIN_*` เดียวกัน ตามที่ `e2e/support/medusa.ts` อ่าน) ก่อนรัน e2e admin; DB ที่ seed ก่อน
    CORE-10 จะ**ไม่**ได้ชื่อไทย (seed ไม่เปลี่ยนชื่อ resource ที่มีอยู่) → ต้อง reset DB (drop + `db:migrate` + `seed`) ถ้าต้องการชื่อไทย
37. (CORE-21, review #71) error ของ middleware ตรวจ return option ใช้ข้อความคงที่ — ห้ามต่อค่า `return_shipping.option_id` (หรือ input อื่น) ลงใน `message`
    (ไม่สะท้อน input ของผู้ใช้กลับ)
38. (**CORE-18 #80**, รอบ 6 ตาม review — ไม่ใช่ CORE-14) แทนคำ "Medusa Store" ที่ storefront เขียนเองใน `modules/account/components/register/index.tsx`
    (heading, คำอธิบาย, ข้อความยอมรับเงื่อนไข) และ `metadata.description` ของ `app/[countryCode]/(main)/account/@login/page.tsx` และ `.../@dashboard/profile/page.tsx`
    ด้วย `STORE_NAME` (`lib/util/site.ts`; ค่าเป็นเนื้อหาร้าน placeholder ตามกฎข้อ 33 ไม่ใช่ "Medusa Store") — ข้อความรอบ ๆ ยังเป็นอังกฤษได้จนกว่า CORE-4c1 แปล
    (ไฟล์อยู่ใน path ของ 4c1; ตัวที่ merge ทีหลัง rebase) ตรวจด้วย AC-61; **#80 แทนชื่อร้านใน checkout ไปแล้วด้วย** (`(checkout)/layout.tsx` และ
    `checkout/components/review/index.tsx`: "Medusa Store" → `STORE_NAME`, ลบ `MedusaCTA`) — CORE-4d และ reviewer ห้าม revert ส่วนนี้ (กฎข้อ 39)
39. (CORE-4d, ยืนยันรอบ 6) การแทนชื่อร้าน/ลบ `MedusaCTA` ใน checkout ทำแล้วใน CORE-18 (#80, กฎข้อ 38); CORE-4d เหลือเพียง**แปลเป็นไทย** ประโยคยอมรับเงื่อนไข
    ในขั้น review (`modules/checkout/components/review/index.tsx` "By clicking the Place Order button…") และข้อความอื่นใน `(checkout)/layout.tsx` โดยคง `STORE_NAME`
    ไว้ — อยู่ใน path 4d ของตาราง AC-49 อยู่แล้ว ไม่ใช่ task ใหม่ (AC-75)
40. (CORE-14c, review #81) login ขณะมี cookie `_medusa_cart_id` ที่ชี้ไป cart ของ customer อื่น (เช่น เครื่องที่ใช้ร่วมกัน): `transferCart()` ได้ 404 จาก ownership
    middleware ของ CORE-12 (ADR-013) → login ต้อง**สำเร็จ**ตามปกติ, ล้าง cookie cart นั้น (ไม่แสดง error ของ cart ให้ผู้ใช้) — 404 จาก transfer เท่านั้นที่ถูกกลืน
    error อื่น (5xx/network) ยังส่งต่อตามเดิม; ห้ามแก้ backend ให้โอน cart ของคนอื่น (ADR-013)

### Acceptance criteria (follow-up รอบ 6)
- AC-70 (CORE-21, AC-60c ส่วน "order ไม่มี `country_code`") Given order OA ของ A ที่ `shipping_address.country_code` เป็น null (หรือไม่มี shipping address —
  ตั้งใน test ผ่าน module) When A `POST /store/returns` ด้วย "Standard return" Then 400 `invalid_data` ข้อความ
  `Return shipping option does not serve the order's shipping address`, ไม่มี 5xx และ OA ไม่มี return (integration http)
- AC-71 (CORE-21, กฎข้อ 37) Given A ล็อกอิน When `POST /store/returns` ด้วย `return_shipping.option_id = "so_<script>x</script>"` (ไม่มีจริง) Then 400
  `invalid_data` และ `message` ไม่มีสตริง `so_<script>` / `option_id` ที่ส่งไป (เทียบ substring); ข้อความเท่ากันทุกครั้งไม่ว่า id ใด (integration http)
- AC-72 (CORE-10, กฎข้อ 35) Given DB ว่าง When รัน seed Then category ตัวอย่างทุกตัวมี `name` ที่มีอักษรไทยและ `handle` ∈ {`shirts`, `sweatshirts`};
  When รัน seed ซ้ำ Then จำนวน category ไม่เปลี่ยน; Given DB ที่มี category `handle=shirts` ชื่ออังกฤษ (สร้างใน test) When seed Then ไม่มี category ใหม่ที่
  `handle` ซ้ำความหมาย (เช่น `shirts-1`) และชื่อเดิมไม่ถูกเปลี่ยน (integration seed)
- AC-73 (CORE-10, กฎข้อ 36) Given `README.md` Then มีหัวข้อ local dev ที่กล่าวถึง `SEED_ADMIN_PASSWORD`, `E2E_ADMIN_PASSWORD` และการ reset DB เพื่อให้ได้ชื่อไทย
  (unit test อ่านไฟล์ร่วมกับ AC-31)
- AC-74 (CORE-18 #80, กฎข้อ 38) Given `apps/storefront/src` When grep `Medusa Store` Then ไม่พบในไฟล์ register และ page ของ `@login`/`profile` และ
  `lib/util/site.ts` ไม่มีค่า `"Medusa Store"`; ส่วน e2e อยู่ใน AC-61 (ฟอร์มสมัคร + title/description) (unit grep)
- AC-76 (CORE-14c, กฎข้อ 40) Given customer B มี cart CB และ browser มี cookie `_medusa_cart_id=CB` (ตั้งใน test) When customer A login ผ่านฟอร์ม Then login สำเร็จ
  (เข้าหน้า account ของ A), ไม่มี error บนหน้า, cookie `_medusa_cart_id` ถูกล้างหรือชี้ cart ใหม่ของ A และ `CB.customer_id` ยังเป็น B; Given unit test ของ action
  login (mock SDK) ที่ transfer ได้ 500 Then error ถูกส่งต่อ (e2e + unit Vitest)
- AC-75 (CORE-4d, กฎข้อ 39) Given checkout ขั้น review When e2e อ่าน textContent ของบล็อกยอมรับเงื่อนไข (test id ที่ CORE-4d เพิ่ม) Then มีอักษรไทยและไม่ตรง `/Medusa/i`;
  `(checkout)/layout.tsx` ไม่มีสตริง `Medusa Store` (grep) — เป็นส่วนหนึ่งของ AC-48 (4d)

### แผนการทดสอบ (follow-up รอบ 6)
| ระดับ | AC |
|------|----|
| integration http | AC-70, AC-71 (CORE-21) |
| integration (seed) | AC-72 (CORE-10) |
| unit (Jest อ่านไฟล์) | AC-73 (CORE-10) |
| unit grep + e2e | AC-74 (CORE-18), AC-75 (CORE-4d) |
| e2e + unit Vitest | AC-76 (CORE-14c) |

### Tasks (follow-up รอบ 6)
แยก CORE-14 เป็น CORE-14a (#81) / CORE-14b / CORE-14c (follow-up review #81) — ตาราง "Tasks (follow-up CORE-6)"; เพิ่มในแถวเดิม: CORE-10 (AC-72, AC-73;
ตาราง "Tasks (follow-up)"), CORE-21 (AC-70, AC-71; ตาราง "Tasks (follow-up รอบ 5)"), CORE-18 (AC-61 แก้ถ้อยคำ + AC-74, กฎข้อ 38) และ CORE-4d (AC-75; ตาราง Tasks ของ CORE-4)
- nit review CORE-12b: comment ที่อธิบาย `authenticate(..., { allowUnauthenticated: true })` ซ้ำกันใน `src/api/store/ownership/middlewares.ts` บรรทัด 52-58
  → เหลือที่เดียว (แก้ใน PR ของ CORE-12b ก่อน merge ถ้ายังไม่ merge มิฉะนั้นแก้ใน PR ถัดไปที่แตะไฟล์นี้ เช่น CORE-21 — ไม่เปิด PR แยก)
  **(รอบ 8)** ยังไม่ได้แก้ → ย้ายไปรวมในงานเล็ก GB-N1 (spec 04) พร้อม nit CORE-18: comment "onboarding status" ล้าสมัยใน `apps/storefront/src/middleware.ts` ราวบรรทัด 88

## Follow-up รอบ 7 จาก review/qa (2026-10-26)
แยก CORE-4c เป็น CORE-4c1 (#92) / CORE-4c2 (ตาราง AC-49 + ตาราง Tasks ของ CORE-4); follow-up review #92 และ qa รวมเข้า CORE-4c2; nit review CORE-14a รวมเข้า CORE-14c
(AC-41); กฎข้อ 11 อ้าง regex ของ #87
Out of scope: i18n (ADR-014), หน้า `/content/*` (ไม่สร้าง — ใช้หน้า policy ที่มีอยู่)

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| หน้า policy | ไม่มีใน Medusa — storefront มี `(main)/{privacy,terms,...}/page.tsx` ของเราแล้ว | ใช้ตามเดิม (ลิงก์ให้ถูก) |
| แสดงวันที่ตามเขตเวลา | ไม่ใช่งานของ Medusa — `Intl.DateTimeFormat` option `timeZone` | ใช้ตามเดิม |

### Data model / Workflows / API routes
none

### Business rules
41. (CORE-4c2, qa #92) ลิงก์ "นโยบายความเป็นส่วนตัว" และ "ข้อกำหนดการใช้งาน" ในฟอร์มสมัคร (`modules/account/components/register/index.tsx`) ชี้ `/<cc>/privacy` และ
    `/<cc>/terms` (หน้าที่มีจริง) — ไม่ใช่ `/content/privacy-policy`, `/content/terms-of-use` ของ starter ซึ่งเป็น 404
42. (CORE-4c2, review #92) ทุกจุดใน storefront ที่แสดงวันที่/เวลา (`toLocaleDateString`, `toLocaleString`, `Intl.DateTimeFormat` — เช่น order card, overview, order detail)
    ระบุ `timeZone: "Asia/Bangkok"` เสมอ — server (UTC) กับ browser จึงได้ข้อความเดียวกัน (ไม่มี hydration mismatch) และวันไม่เพี้ยนช่วง 00:00–07:00 เวลาไทย;
    มีหลายจุดแล้วจึงรวมเป็น helper เดียวใน `lib/util/` ได้
43. (CORE-4c2, review #92) order card แสดงสินค้าสูงสุด 3 line และแสดง "+ N รายการ" เมื่อมีมากกว่า 3 line โดย N = จำนวน line ที่**ไม่ได้แสดง** (`items.length − 3`)
    — แก้ logic ของ starter ที่แสดง 3 แต่ลบ 4 และนับจาก `quantity`; ≤ 3 line ไม่แสดงตัวนับ
44. (CORE-4c1/4c2, review #92) test ที่ตรวจว่าข้อความที่ผู้ใช้เห็นใน `lib/data/*.ts` เป็นไทย ต้องหาข้อความจาก source ทุกรูปแบบที่ส่งออก (`throw new Error(…)`, string ที่ return
    เป็น error, template literal) แล้วตรวจทีละตัว — ห้าม hard-code จำนวนข้อความที่คาด (เช่น `toHaveLength(7)`) เพื่อให้ข้อความใหม่ถูกตรวจอัตโนมัติ
45. (CORE-4c2, qa #92) ข้อความ error ที่ storefront สร้างจาก `String(error)` (หรือ `error.toString()`) ต้องไม่มีคำนำหน้า `Error:` — ใช้ `error.message` (หรือข้อความไทยของเรา)
46. (CORE-22, qa #92 D-1 — defect ของ starter) `document.title` ของหน้า account เมื่อล็อกอินแล้วต้องตรงกับหน้า: overview "บัญชีของฉัน", profile "โปรไฟล์", addresses "ที่อยู่",
    orders "คำสั่งซื้อ", order detail "คำสั่งซื้อ #<display_id>" (ตามด้วยชื่อร้านได้) — ปัจจุบัน metadata ของ parallel route `@login` ทับ `@dashboard` ทุกหน้าเป็น "เข้าสู่ระบบ";
    หน้า login (ไม่ล็อกอิน) ยังเป็น "เข้าสู่ระบบ" builder ตรวจกลไก metadata ของ parallel route ใน Next เวอร์ชันที่ใช้จริงก่อนแก้
47. (CORE-22, D-2) profile ของลูกค้าที่ไม่มีเบอร์โทร (`phone` null/ว่าง) ต้องไม่แสดงสตริง `null`/`undefined` — แสดงข้อความไทยว่ายังไม่ได้ระบุ (หรือว่าง)
48. (CORE-22, D-3) panel แก้ไขของ account (Disclosure ของ starter) ที่**ปิดอยู่**ต้องไม่รับ click/focus — ปัจจุบันซ่อนด้วย `max-h-0 opacity-0` แต่ `overflow-visible`
    ทำให้ที่ 1280px การกด "แก้ไข" เบอร์โทรไปโดนปุ่มบันทึกที่ซ่อนของ editor อีเมล; panel ที่ปิดต้อง `overflow-hidden` + `pointer-events-none` (หรือ `inert`/ไม่ render)

### Acceptance criteria (follow-up รอบ 7)
- AC-77 (CORE-4c2, กฎข้อ 41) Given ไม่ล็อกอิน When e2e เปิด `/th/account` แล้วสลับไปฟอร์มสมัคร Then ลิงก์ `register-privacy-link` และ `register-terms-link` (test id ที่ 4c2
  เพิ่มถ้ายังไม่มี) มี `href` ลงท้าย `/th/privacy` และ `/th/terms`, ไม่มี `a[href*="/content/"]` ในหน้า และ `GET` ของทั้งสอง href ตอบ 200 (e2e)
- AC-78 (CORE-4c2, กฎข้อ 42) Given `2026-10-25T18:30:00Z` When จัดรูปแบบวันที่ด้วยโค้ดของ order card/overview ภายใต้ `TZ=UTC` และ `TZ=America/New_York` Then ได้วันที่ 26
  ต.ค. เหมือนกันทั้งสองกรณี (unit Vitest); Given `apps/storefront/src` Then ทุกการเรียก `toLocaleDateString(`/`toLocaleString(`/`new Intl.DateTimeFormat(` ระบุ
  `timeZone: "Asia/Bangkok"` หรือผ่าน helper ที่ระบุ (unit grep); Given e2e เปิดหน้า orders ของ account Then console ไม่มีข้อความ hydration mismatch
- AC-79 (CORE-4c2, กฎข้อ 43) Given order 5 line (qty 2 ทุก line) Then order card แสดงสินค้า 3 รายการ และตัวเลขใน `order-card-more-count` (test id) = 2; order 4 line qty 1 → 1;
  order 3 line qty 5 → ไม่มี `order-card-more-count` (unit/component Vitest)
- AC-80 (CORE-4c1/4c2, กฎข้อ 44) Given test ข้อความไทยของ `lib/data/*` When เพิ่ม `throw new Error("Something failed")` ชั่วคราวใน `lib/data/orders.ts` (หรือ `customer.ts`)
  Then test ล้มโดยไม่ต้องแก้ test (positive control บันทึกใน evidence); source ของ test ไม่มีการ assert จำนวนข้อความแบบตัวเลขตายตัว (review)
- AC-81 (CORE-4c2, กฎข้อ 45) Given action/data function ที่ห่อ error เป็นข้อความ When dependency throw `new Error("x")` (mock) Then ข้อความที่คืนไม่ขึ้นต้นด้วย `Error:`;
  Given `apps/storefront/src` Then ไม่มี `String(error)`/`String(err)`/`.toString()` ของ error ในข้อความที่ส่งให้ผู้ใช้ (unit Vitest + grep)
- AC-82 (CORE-22, กฎข้อ 46) Given customer ล็อกอิน When e2e เปิด `/th/account`, `/th/account/profile`, `/th/account/addresses`, `/th/account/orders`,
  `/th/account/orders/details/<id>` Then `document.title` (ค่าจริงใน browser) ของแต่ละหน้าต่างกันทั้ง 5, มีอักษรไทย, ไม่มีคำ "เข้าสู่ระบบ" และหน้า order detail มี `display_id`
  ของ order; Given ไม่ล็อกอิน When เปิด `/th/account` Then title มี "เข้าสู่ระบบ" (e2e)
- AC-83 (CORE-22, กฎข้อ 47) Given customer ที่ `phone` เป็น null When เปิด profile Then textContent ของบล็อกเบอร์โทร (test id ของ starter/เพิ่มใหม่) ไม่มี `null`/`undefined`
  (e2e หรือ component Vitest)
- AC-84 (CORE-22, กฎข้อ 48) Given viewport 1280×800 และ profile ที่ editor ทุกตัวปิด When คลิกปุ่ม "แก้ไข" ของเบอร์โทร (test id) Then editor เบอร์โทรเปิด, editor อีเมลยังปิด
  และไม่มี request update customer; Given editor ใดปิด Then panel ของ editor นั้นมี computed `pointer-events: none` (หรือ `inert`/ไม่อยู่ใน DOM) (e2e)

### แผนการทดสอบ (follow-up รอบ 7)
| ระดับ | AC |
|------|----|
| unit (Vitest) | AC-78 (format + grep), AC-79, AC-80, AC-81, AC-83 (ถ้าเป็น component test) |
| e2e | AC-77, AC-78 (hydration), AC-41 nit (CORE-14c), AC-82, AC-83, AC-84 |

### Tasks (follow-up รอบ 7)
แยก CORE-4c → CORE-4c1 (#92) / CORE-4c2 ในตาราง Tasks ของ CORE-4 (AC-77..81 อยู่ใน CORE-4c2; AC-80 ส่วน `customer.ts` ทำใน #92 ถ้ายังไม่ merge มิฉะนั้นใน 4c2);
CORE-14c รับ nit AC-41
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-22 | (storefront เล็ก, qa #92 — defect ของ starter) title ของหน้า account ที่ล็อกอินแล้วตรงหน้า (D-1, กฎข้อ 46), เบอร์โทรว่างไม่แสดง `null` (D-2, กฎข้อ 47), panel แก้ไขที่ปิดไม่รับ click (D-3, กฎข้อ 48) + e2e | AC-82, AC-83, AC-84 | CORE-4c1 (#92) (∥ CORE-4c2; แตะ `modules/account`/`(main)/account` ที่ 4c2 แตะเฉพาะลิงก์ register/order card — ตัวที่ merge ทีหลัง rebase) |

## Follow-up รอบ 8 จาก qa CORE-22 (#99) — defect ของ starter (2026-10-26)
Out of scope: เปลี่ยนอีเมลของลูกค้า (ต้องเปลี่ยน auth identity — ไม่ทำใน v1)

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| แก้เบอร์โทร | `POST /store/customers/me` (field `phone`) | ใช้ตามเดิม — builder ตรวจ validator 2.22.1 ว่าล้างค่าได้ด้วย `""` หรือ `null` ถ้าไม่ได้ทั้งคู่ให้หยุดและรายงาน |
| เปลี่ยนอีเมล | `POST /store/customers/me` ไม่ใช่ช่องทางเปลี่ยนอีเมลที่ login ได้ (ผูกกับ auth identity) — builder ยืนยันจาก validator | ไม่ทำ: ซ่อน editor อีเมล แสดงอย่างเดียว |
| หน้า 404 | `notFound()` ของ Next.js ตอบ HTTP 404 | ใช้ตามเดิม |

### Data model / Workflows / API routes
none

### Business rules
49. (CORE-23, qa #99) ลูกค้าลบเบอร์โทรได้: บันทึกช่องว่าง → `phone` ของ customer ว่าง/null และหน้า profile แสดงข้อความ "ยังไม่ได้ระบุ" ตามกฎข้อ 47
50. (CORE-23) editor อีเมลของ starter (TODO ที่แสดง success โดยไม่บันทึก) ถูกเอาออก — แสดงอีเมลแบบอ่านอย่างเดียว ไม่มีปุ่ม "แก้ไข" ของอีเมล
51. (CORE-23) หน้า order detail ของ account ที่หา order ไม่พบ (id ไม่มีอยู่/ไม่ใช่ของลูกค้า) ตอบ HTTP **404** ผ่าน `notFound()` (ไม่ใช่ soft 404 ที่ตอบ 200)
52. (CORE-23) เมื่อ token หมดอายุระหว่างบันทึก profile (เช่นเบอร์โทร) ต้องแสดงข้อความ error ภาษาไทย (หรือพาไปหน้า login) — ห้ามแสดง error ดิบของ React
    (เช่น "Minified React error #441") หรือข้อความอังกฤษ
53. (CORE-23) ข้อความ "ยังไม่ได้ระบุ" ของช่องที่ว่างใน profile จัดชิดแนวเดียวกับค่าของช่องอื่น (ไม่เยื้องขวา)

### Acceptance criteria (follow-up รอบ 8)
- AC-85 (กฎข้อ 49) Given customer ที่มีเบอร์ `0812345678` When ล้างช่องเบอร์ใน editor แล้วบันทึก Then `GET /store/customers/me` คืน `phone` ว่างหรือ null
  และบล็อกเบอร์โทรแสดง "ยังไม่ได้ระบุ" (e2e)
- AC-86 (กฎข้อ 50) Given หน้า profile Then ไม่มีปุ่มแก้ไขของอีเมล (test id ของ editor อีเมลไม่อยู่ใน DOM) และอีเมลของลูกค้าแสดงอยู่ (e2e) — e2e ของ AC-84 ส่วน "editor อีเมลยังปิด" ปรับใน CORE-23 ให้ตรวจ editor อื่นที่ยังมีแทน
- AC-87 (กฎข้อ 51) Given customer ล็อกอิน When `GET /th/account/orders/details/order_doesnotexist` (และ order id ของ customer อื่น) Then HTTP status = 404 (e2e `page.goto` response)
- AC-88 (กฎข้อ 52) Given customer อยู่หน้า profile แล้ว token ถูกลบ/หมดอายุ (ลบ cookie `_medusa_jwt` ใน test) When บันทึกเบอร์โทร Then หน้าไม่มีข้อความ `Minified React error`
  และไม่มี error ดิบ; ข้อความ error ที่แสดง (ถ้ามี) มีอักษรไทย หรือ URL เป็นหน้า login (e2e)
- AC-89 (กฎข้อ 53) Given customer ที่ `phone` null When เปิด profile Then `boundingBox().x` ของข้อความ "ยังไม่ได้ระบุ" (test id) เท่ากับ x ของค่าในบล็อกชื่อ (±2px) (e2e)

### Tasks (follow-up รอบ 8)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-23 | ☑ #105 — (storefront เล็ก, qa #99 — defect ของ starter) ลบเบอร์โทรได้, เอา editor อีเมลออก, order ไม่พบตอบ 404, error token หมดเป็นไทย, จัดแนว "ยังไม่ได้ระบุ" (กฎข้อ 49–53) + e2e | AC-85..89 | CORE-22 (#99) (แตะ `modules/account` profile เดียวกัน); ∥ CORE-4c2 (#102/#103 — แตะ order detail ร่วมได้ ตัวที่ merge ทีหลัง rebase) |

## Follow-up รอบ 9 จาก review/qa (2026-10-27)
ที่มา: review/qa ของ #105 (CORE-23), #109 (CORE-4d), #112 (CORE-20), #113 (CORE-14b), #98 (PAY-6b1 — ส่วนข้อความ)
Out of scope: i18n (ADR-014), เปลี่ยนนโยบายคืนสินค้า (Q-F1/Q-F5), loading UI ใหม่ทั้งร้าน

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa / ไลบรารีมีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| ข้อความใน Stripe Elements เป็นไทย | option `locale` ของ `<Elements>` ใน `@stripe/react-stripe-js` (Stripe.js รองรับ `"th"`) | ใช้ตามเดิม — ส่ง `locale: "th"` |
| ตรวจ return ฝั่ง backend | `POST /store/returns` → `createAndCompleteReturnOrderWorkflow`; middleware chain ของ CORE-13/16/17/21 (ADR-013 ทางเลือก A) | ขยาย: middleware ตัวถัดไปใน chain เดิม (CORE-20b) ไม่ห่อ route |
| จำนวนที่ส่งแล้วของ line | `order.items[].detail.shipped_quantity` / `fulfilled_quantity` ของ Order module | ใช้ตามเดิม — นับ `shipped_quantity` |
| progress ระหว่างเปลี่ยนหน้า | `loading.tsx` / `useLinkStatus` ของ Next.js (App Router) | ใช้ตามเดิม (builder ตรวจเวอร์ชัน Next ของ starter) |
| re-throw redirect/notFound ใน server action | `unstable_rethrow` ของ `next/navigation` | ใช้ตามเดิม |

### Data model / Workflows
none

### API routes
- CORE-20b (owner ตัดสิน Q-F6 2026-10-27 — แทน Q-F5 ส่วน "backend ไม่บังคับใน v1"): middleware ใหม่บน `POST /store/returns` ต่อท้าย chain เดิม (หลัง auth + ownership
  ของ CORE-13, override CORE-16, option CORE-17/21 — ADR-013 ทางเลือก A ไม่ห่อ route ของ Medusa): ทุก item ใน body ต้อง (a) เป็น line ที่ `requires_shipping=true`
  (e-voucher/สินค้าไม่ต้องจัดส่ง → 400 `invalid_data`) และ (b) อยู่ในช่วงคืน: `now ≤ วันอ้างอิง + return_window_days` โดยวันอ้างอิง = `delivered_at` ของ fulfillment ที่มี
  item นั้น ถ้าไม่มีใช้ `shipped_at`; ไม่มีทั้งคู่ (ยังไม่ส่ง) → 400; `return_window_days` อ่านจาก metadata ของ region ของ order (`order.region_id`) ค่าเริ่มต้นตาม
  `region-store-policies.ts`; ข้อความ error ไม่สะท้อนค่าจาก input (แบบ CORE-21 กฎข้อ 37); (รอบ 10, บันทึกตามที่ #124 ทำ — review) line ที่ถูกส่งหลายรอบ (หลาย fulfillment)
  ใช้วันอ้างอิง**ล่าสุด**ในบรรดา fulfillment ที่มี item นั้น; nit "อ่าน region รวมใน query เดียวกับ order" ไม่มี task (ประสิทธิภาพเล็กน้อย — แก้เมื่อแตะไฟล์ครั้งถัดไป)

### Business rules
54. (CORE-4e, #109; owner ยืนยัน 2026-10-27) ชื่อวิธีชำระเงินพร้อมเพย์ในข้อความที่ storefront เขียนเอง ใช้ **"พร้อมเพย์"** แบบเดียวทั้ง checkout/หน้า pay (ไม่ปน "PromptPay"); "PromptPay" เหลือได้เฉพาะ
    ที่มาจาก Stripe (โลโก้/ข้อความใน Elements) — ไม่ต้องใช้ข้อยกเว้น ESLint
55. (CORE-4e) `<Elements>` ของ Stripe ส่ง `locale: "th"`; error ที่มาจาก server action ของ checkout (`setAddresses`, `submitPromotionForm`, `renewPromptPaySession` และ
    ข้อความรอสร้าง order ของพร้อมเพย์) ผ่าน `friendlyErrorMessage` (กฎ CORE-4 ข้อ 5) ไม่ส่ง `e.message`/`body.message` ภาษาอังกฤษของ Medusa ตรง; `STORE_NAME` ตามด้วยคำไทยมีเว้นวรรค
    (`{STORE_NAME} แล้ว`); placeholder ของ `CountrySelect` = "เลือกประเทศ"
56. (CORE-4e, qa #109) popup ทักทายที่อยู่และ shipping nudge มี `data-testid`; ปุ่มปิด (X) มี `aria-label` ภาษาไทย; floating label ของ input ที่อยู่ไม่ซ้อนกับค่าที่เติมจากการเลือก
    ที่อยู่ที่บันทึกไว้
57. (CORE-14d, #113) หลัง login แบบ no-JS ที่มี `add_variant` หน้า `/th/cart` ต้องแสดง cart (ไม่ค้าง skeleton) โดยไม่ต้องใช้ JavaScript; error ระหว่างเพิ่มลง cart หลัง login
    ไม่ถูกกลืน (`catch {}` ใน `lib/data/customer.ts`): ส่งต่อเป็น flag `add_error` ให้หน้าแสดง `add-variant-error` และ re-throw redirect/notFound ด้วย `unstable_rethrow`
58. (CORE-14d — owner ตัดสิน 2026-10-27 จาก QA #128 D-1 และ review #128; แทนข้อที่ planner ตัดสินเดิม "เพิ่มอัตโนมัติแล้ว redirect")
    (a) ลูกค้าที่**ล็อกอินอยู่แล้ว**เปิด `/account?add_variant=<id>&add_quantity=<n>` → **ไม่เพิ่มลง cart อัตโนมัติ**: หน้าแสดงการ์ดยืนยัน `add-variant-pending` (ตัวเลือกของ
    variant, จำนวน, ราคา) พร้อมปุ่ม `add-variant-confirm` ซึ่งเป็นฟอร์ม `POST` (server action — ใช้ได้แม้ปิด JavaScript) กดแล้วเพิ่ม variant ตามจำนวนลง cart และ redirect `/cart`
    (b) request `GET` ของ `/account?add_variant=` (page render ของหน้า account/การ์ดยืนยัน) **ไม่แก้ cart** — กันลิงก์ `<a>`/`<img>` จากเว็บอื่นเพิ่มของลง cart ของลูกค้าที่ล็อกอินอยู่
    (CSRF ผ่าน GET) และการกด Back แล้วเพิ่มซ้ำ; ขอบเขตเฉพาะ path นี้ — **ไม่**ครอบ `/buy/[items]` (cart permalink ที่ `GET` สร้าง cart ตาม Q-F2/AC-41 ที่อนุมัติแล้ว คงเดิม)
    (c) ลูกค้าที่**ยังไม่ล็อกอิน** → login ผ่านฟอร์ม (`POST`) แล้วเพิ่มลง cart อัตโนมัติและ redirect `/cart` เหมือนเดิม (CORE-14b, กฎข้อ 26/57) — การเพิ่มเกิดใน `POST` ของ login
    (d) variant ขายไม่ได้ (ไม่มีอยู่/ไม่อยู่ใน sales channel/ไม่มี stock) → แสดง `add-variant-error` และ**ไม่มี**ปุ่ม `add-variant-confirm` (กฎข้อ 26)
59. (CORE-24, #113) PDP มีตัวเลือกจำนวน (`product-quantity-select`, 1..10 ค่าเริ่มต้น 1) ทั้งโหมด JS และฟอร์ม no-JS (แทน `<input type="hidden" name="quantity" value="1">`)
    — จำนวนที่เลือกถูกส่งต่อข้าม login ตาม CORE-14b
60. (CORE-20c, #112) storefront คำนวณสิทธิ์คืนจาก `return_window_days` ของ region ของ order (`order.region_id`) ไม่ใช่ `countryCode` ใน URL; จำนวนที่คืนได้ต่อ line =
    `shipped_quantity − (return_requested_quantity + return_received_quantity + return_dismissed_quantity)` (ไม่ใช้ `fulfilled_quantity`); ตรวจ `canRequestReturn` ครั้งเดียวต่อ action
    และ `listOrders` ไม่ใช้ `force-cache` (สถานะ return ต้องเห็นทันทีหลังส่ง); (re-review #112) การอ่าน region ของหน้า `/returns` และ structured data ไม่ใช้
    `listRegions` แบบ `force-cache` (ค่า `return_window_days` ที่ admin แก้ต้องมีผลโดยไม่ต้อง redeploy); e2e ที่แก้ metadata ของ region ต้องไม่กระทบ test อื่น — ใช้ region
    แยกของ test หรือรันแบบ `serial` แล้วคืนค่าเดิม
61. (CORE-23b, qa/review #105) เปลี่ยนหน้าใน account แสดง progress indicator (`account-nav-pending`) ระหว่างโหลด; ฟอร์ม profile ที่บันทึก**ล้ม**คงค่าที่ผู้ใช้พิมพ์ไว้
    (ไม่ถูก reset โดย React 19 form action)

### Acceptance criteria (follow-up รอบ 9)
- AC-90 (CORE-4e, กฎข้อ 54–55) Given `apps/storefront/src` path 4d When grep ข้อความ UI Then ไม่มี `PromptPay` ในข้อความที่ storefront เขียนเอง (ยกเว้น id/ค่า provider/
  comment); `stripe-wrapper.tsx` ส่ง `locale: "th"` ให้ `<Elements>` (unit อ่าน props ที่ render หรือ grep); unit ของ `setAddresses`/`submitPromotionForm`/`renewPromptPaySession`
  ที่ mock SDK throw `new Error("Cart not found")` Then ข้อความที่คืนมีอักษรไทยและไม่มี `Cart not found` (Vitest); test ของ `renewPromptPaySession` ไม่ตัด source ด้วย `indexOf`
- AC-91 (CORE-4e, กฎข้อ 55–56) Given checkout ขั้นที่อยู่ When e2e เปิด `CountrySelect` Then placeholder มีอักษรไทย; popup ทักทาย/nudge หาได้ด้วย test id และปุ่ม X มี `aria-label`
  ที่มีอักษรไทย; เลือกที่อยู่ที่บันทึกไว้แล้ว `boundingBox` ของ label ไม่ทับกับข้อความค่าใน input; textContent รอบ `STORE_NAME` ไม่มีรูป `<STORE_NAME>แล้ว` ติดกัน (e2e, screenshot 1)
- AC-92 (CORE-14d, กฎข้อ 57) Given Playwright `javaScriptEnabled: false` และลูกค้าไม่ล็อกอิน When เปิด `/th/account?add_variant=<ขายได้>&add_quantity=2` แล้ว login Then ไปหน้า
  `/th/cart` ที่มี `product-row` ของ variant นั้น qty 2 และไม่มี skeleton (`data-testid` ของ skeleton cart ไม่อยู่ใน DOM) ภายใน 10 วินาที; Given SDK เพิ่มลง cart ล้ม (variant ที่ลบระหว่างทาง) Then เห็น
  `add-variant-error` (e2e) และ unit ยืนยันว่า error ถูกส่งต่อ (ไม่มี `catch {}` ว่างใน `lib/data/customer.ts` — grep);
  (กฎข้อ 58 (b)/(c), QA #128 D-1) หลังไปถึง `/th/cart` ที่ qty 2 แล้ว When กด Back ของ browser (กลับไปหน้า account ที่มี query `add_variant`/`add_quantity=2` เดิม — ตอนนี้ล็อกอินแล้ว)
  Then เห็นการ์ด `add-variant-pending` และปุ่ม `add-variant-confirm` และ qty ของ variant นั้นใน cart ยังเป็น 2 (ไม่เพิ่มซ้ำ) (e2e no-JS)
- AC-93 (CORE-14d, กฎข้อ 58) Given ลูกค้าล็อกอินแล้วและ cart ว่าง — ทำทั้ง `javaScriptEnabled: true` และ `false`:
  (a) When เปิด `/th/account?add_variant=<ขายได้>&add_quantity=3` (GET) Then ยังอยู่หน้า account เห็นการ์ด `add-variant-pending` และปุ่ม `add-variant-confirm` และไม่ถูก redirect ไป `/cart`
  (ไม่มีการเพิ่มอัตโนมัติ)
  (b) When กด `add-variant-confirm` Then redirect ไป `/th/cart` และมี `product-row` ของ variant นั้น qty 3
  (c) Given variant ขายไม่ได้ When เปิดลิงก์เดียวกัน Then เห็น `add-variant-error` และไม่มี `add-variant-confirm` ใน DOM — (รอบ 10, review #128) ข้อ (c) render ฝั่ง server ล้วน
  จึงทดสอบด้วย `javaScriptEnabled: false` **ครั้งเดียว**พอ (อยู่นอก loop JS on/off ได้); (a)/(b) ยังต้องทำทั้งสองโหมด
  (e2e `apps/storefront/e2e/core-14d-cart-after-login.spec.ts`) — ตรวจเพิ่มโดย qa ด้วย Playwright (รอบ 2 ของ #128, บันทึกใน `REPORT.md`): ลิงก์ `<a>`/`<img>` จากหน้าเว็บอื่นที่ชี้
  `/th/account?add_variant=` ขณะลูกค้าล็อกอินอยู่ไม่ทำให้ cart เปลี่ยน, กด Back หลังกดยืนยันแล้วไม่เพิ่มเอง และการ์ดแสดงตัวเลือก/จำนวน/ราคา
- AC-94 (CORE-24, กฎข้อ 59) Given PDP ของสินค้า seed When เลือก 3 ใน `product-quantity-select` แล้วกดเพิ่มลง cart Then cart มี line qty 3; Given `javaScriptEnabled: false` และไม่ล็อกอิน
  When เลือก 2 แล้ว submit และ login Then cart มี qty 2 (e2e)
- AC-95 (CORE-20b, owner ตัดสิน Q-F6) Given order OA ของ A ที่ ship แล้วเมื่อ `return_window_days + 1` วันก่อน (ตั้ง `shipped_at`/`delivered_at` ใน test) When A `POST /store/returns`
  ด้วย "Standard return" Then 400 `invalid_data` และ OA ไม่มี return; ship เมื่อ 1 วันก่อน → 200; มี `delivered_at` → ใช้ `delivered_at` แทน `shipped_at`; Given line e-voucher
  (`requires_shipping=false`) Then 400; ยังไม่ ship → 400; ข้อความ error ไม่มีค่า `item.id` จาก input; ลำดับ middleware: ไม่มี token → 401, customer B → 404 (ไม่ถึง middleware นี้)
  (integration http)
- AC-96 (CORE-20c, กฎข้อ 60) Given order ที่ line L qty 3, `fulfilled_quantity=3`, `shipped_quantity=2` และ return requested 1 When เปิดหน้าขอคืน Then จำนวนสูงสุดที่เลือกได้ของ L = 1;
  Given URL `/th/...` แต่ region ของ order มี `return_window_days=7` (region อื่นใน test) Then ปุ่ม `order-return-button` คิดจาก 7 วัน; unit ของ `returnableItems`/`canRequestReturn`
  (Vitest) และหลังส่ง return หน้า order detail แสดงสถานะใหม่โดยไม่ต้องรอ cache (e2e); grep: ไม่มี `force-cache` ในการเรียก `listOrders` และ `listRegions` ของหน้า `/returns`/
  structured data; e2e ที่แก้ region ใช้ region แยกหรือ `test.describe.configure({ mode: "serial" })` พร้อมคืนค่าใน `afterAll`
- AC-97 (CORE-23b, กฎข้อ 61) Given ลูกค้าอยู่ `/th/account` When คลิกเมนู orders (หน่วงเวลาโหลดด้วย route mock) Then `account-nav-pending` มองเห็นก่อนหน้าใหม่แสดง; Given
  บันทึกเบอร์โทรล้ม (mock 500) Then ค่าใน input ยังเป็นค่าที่พิมพ์; e2e ของ AC-88 ไม่มี `if (await x.isVisible())` ครอบ `expect` (grep) (e2e)

### Tasks (follow-up รอบ 9)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-4e | (storefront เล็ก, nit/qa #109 + qa #98) Stripe Elements `locale: "th"`, `friendlyErrorMessage` ใน `setAddresses`/`submitPromotionForm`/`renewPromptPaySession` + ข้อความรอสร้าง order ของพร้อมเพย์ (ถ้า #109 ยังไม่ครอบ), "พร้อมเพย์" แบบเดียว, `{STORE_NAME} แล้ว`, placeholder "เลือกประเทศ", test id/aria-label ของ popup ที่อยู่ + nudge, floating label ซ้อน, test `renewPromptPaySession` ไม่ใช้ `indexOf` (กฎข้อ 54–56) | AC-90, AC-91 | CORE-4d (#109) |
| CORE-14d | (storefront เล็ก, nit/qa #113; ☑ #128) `/cart` ไม่ค้าง skeleton หลัง login no-JS, `add_error` + `unstable_rethrow` แทน `catch {}`, `/account?add_variant=&add_quantity=` ตอนล็อกอินแล้ว = การ์ด `add-variant-pending` + ปุ่ม `add-variant-confirm` (ฟอร์ม POST) ไม่เพิ่มอัตโนมัติ, GET ของ path นี้ไม่แก้ cart (ไม่ครอบ `/buy/[items]`) (กฎข้อ 57–58, owner 2026-10-27) | AC-92, AC-93 | CORE-14b (#113) |
| CORE-24 | (storefront เล็ก, qa #113) ตัวเลือกจำนวนบน PDP ทั้ง JS/no-JS (กฎข้อ 59) | AC-94 | CORE-14b (#113) (∥ CORE-14d: CORE-24 แตะ `modules/products`, CORE-14d แตะ `lib/data/customer.ts`/account/cart) |
| CORE-20b | (backend เล็ก, review #112; owner ตัดสิน Q-F6 2026-10-27 — เริ่มได้): middleware บังคับช่วงคืน N วัน + กัน line ที่ไม่ต้องจัดส่งบน `POST /store/returns` (ADR-013 ทางเลือก A, ต่อ chain ของ CORE-17/21) | AC-95 | CORE-21 ☑ (#86) — เริ่มได้ทันที; ∥ CORE-20c |
| CORE-20c | (storefront เล็ก, nit review/re-review #112) `return_window_days` จาก region ของ order, `returnableItems` นับ `shipped_quantity`, ตัด `canRequestReturn` ซ้ำ, `listOrders`/`listRegions` ของ `/returns` + structured data ไม่ `force-cache`, e2e region แยก/serial (กฎข้อ 60) | AC-96 | CORE-20 (#112) |
| CORE-23b | (storefront เล็ก, qa/review #105) progress ตอนเปลี่ยนหน้า account, ฟอร์มไม่ล้างค่าเมื่อบันทึกล้ม, e2e AC-88 ไม่ใช้ `if(isVisible)` (กฎข้อ 61) | AC-97 | CORE-23 ☑ (#105) |
CORE-19b (เดิม, AC-64) กับ CORE-4e แตะไฟล์ checkout เดียวกัน — ไม่ขนานกัน ทำ CORE-4e ก่อน แล้ว CORE-19b (ทั้งคู่ ← CORE-4d #109); CORE-14d ∥ CORE-24 ∥ CORE-20c ∥ CORE-23b ∥ CORE-4e (คนละโมดูล — ถ้าชน `lib/data/*` ตัวที่ merge ทีหลัง rebase); CORE-20b เป็น backend ∥ ทุกตัว
CORE-15 (AC-69 ป้ายราคา ฿) ยังไม่เริ่ม — ไม่เปลี่ยนนิยาม

### Open questions (รอบ 9)
- ~~Q-F6~~ ตัดสินแล้ว (owner 2026-10-27): backend บังคับช่วงคืน N วันและกัน line ที่ไม่ต้องจัดส่งบน `POST /store/returns` (CORE-20b, AC-95) — แทน Q-F5 ส่วน "backend ไม่บังคับใน v1"
- ~~ชื่อพร้อมเพย์~~ ตัดสินแล้ว (owner 2026-10-27): ใช้ "พร้อมเพย์" (กฎข้อ 54)
- ~~Q-F7~~ ตัดสินแล้ว (owner 2026-10-27): ฟอร์ม no-JS (ปุ่มเพิ่มลง cart บน PDP และ `add-variant-confirm`) กดซ้ำเร็วๆ ส่ง `POST` 2 ครั้ง → line ได้ qty สองเท่า (โหมด JS กันด้วย disable
  ระหว่างส่งอยู่แล้ว) — **ยังไม่ทำใน v1** (เกิดเฉพาะผู้ใช้ที่ปิด JavaScript และกดซ้ำ, แก้ได้เองในหน้า cart); ย้าย **CORE-14e** (nonce ครั้งเดียวต่อฟอร์มฝั่ง server, cookie httpOnly
  อายุสั้น ไม่เพิ่ม infra) ไป backlog หลัง v1.0 ไม่มี AC — (รอบ 10, qa #128 r2 O-2) ขอบเขตของ CORE-14e รวมกรณี no-JS ส่ง `add-variant-confirm`/ฟอร์ม login ซ้ำพร้อมกันตอน
  ยังไม่มี cart → ได้ cart ค้าง 2 ใบ (กลไก nonce เดียวกันแก้ได้; planner รวมเข้า — CORE-14e ยังไม่ทำใน v1 ตามคำตัดสิน Q-F7 ของ owner 2026-10-27)
- ~~Q-F8~~ ตัดสินแล้ว (owner 2026-10-27, QA #128 D-1 / review #128): ลูกค้าที่ล็อกอินแล้วเปิด `/account?add_variant=` → การ์ดยืนยัน + ปุ่ม POST ไม่เพิ่มอัตโนมัติ; GET ของ path นี้ไม่แก้ cart
  (ไม่ครอบ `/buy/[items]` ตาม Q-F2/AC-41) (กฎข้อ 58, AC-92, AC-93)

## Follow-up รอบ 10 จาก review/qa (2026-10-27)
ที่มา: qa/review ของ #117 (CORE-14c), #118 (CORE-19a), #124 (CORE-20b), #128 (CORE-14d), #130 (CORE-20c), #131 (CORE-4e) และ tooling evidence ของ CORE-22
แก้ถ้อยคำในที่เดิม: AC-41/AC-42 (303 ของ `/buy` vs 307/308 ของ `/ucp`), กฎข้อ 5 (error หน้า login/register), API ของ CORE-20b (หลาย fulfillment), AC-93 (c), ขอบเขต CORE-14e
คำตัดสิน owner ที่บันทึกแล้วในรอบ 9 ยังมีผล: Q-F6 (CORE-20b ☑ #124), "พร้อมเพย์", Q-F7 (CORE-14e หลัง v1.0), กฎข้อ 58 (#132); owner อนุมัติ merge #130 (2026-10-27)
Out of scope: i18n (ADR-014), nonce กันส่งซ้ำของฟอร์ม no-JS (CORE-14e หลัง v1.0), เปลี่ยนนโยบายคืนสินค้า (Q-F1)

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa / ไลบรารีมีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| ใส่ promotion code ให้ cart | `POST /store/carts/:id/promotions` — code ที่ใช้ไม่ได้ (เช่น campaign หมดอายุ) ได้ **200** และ cart ไม่มี code นั้น (ไม่ throw) | ใช้ตามเดิม; storefront ตรวจ `cart.promotions` หลังส่ง (กฎข้อ 63) |
| status ของ error จาก Store API | `FetchError` ของ `@medusajs/js-sdk` มี `status` | ใช้ตามเดิม — อย่าทิ้ง status ใน `medusaError` (กฎข้อ 63) |
| region ตาม id | `GET /store/regions/:id` (`sdk.store.region.retrieve`) | ใช้ตามเดิมแทนการ list ทุก region (กฎข้อ 66) |
| ค่าเริ่มต้นของนโยบาย region | `DEFAULT_REGION_STORE_POLICIES` ใน `apps/backend/src/lib/region-store-policies.ts` (ของเรา) | ใช้ค่าเดียวกันทั้ง backend และ storefront (กฎข้อ 66) |

### Data model / Workflows / API routes
none (storefront + e2e tooling)

### Business rules
62. (CORE-4f — qa #117 CORE-14c, qa #131 CORE-4e) หน้า login/register: error ทุกกรณี (รหัสผ่านผิด, อีเมลซ้ำ, 5xx, network) แสดงเป็นข้อความไทยผ่าน `friendlyErrorMessage`
    ใน `login-error-message`/`register-error` (ไม่แสดงข้อความของ auth provider); login/register ที่ล้ม**คงค่าอีเมลที่พิมพ์ไว้** (ไม่ถูก reset โดย React 19 form action — แบบเดียวกับกฎข้อ 61)
    — รหัสผ่านล้างได้
63. (CORE-4g — review/qa #131) (a) `medusaError` ใน `lib/data/cart.ts` (และ util ที่ใช้ร่วม) ต้องคง HTTP `status` ของ error เดิม เพื่อให้ `friendlyErrorMessage` แยก 401/403
    (ข้อความไทยให้เข้าสู่ระบบใหม่) ออกจาก fallback ทั่วไปได้; (b) ใส่โค้ดส่วนลดแล้ว cart ที่ได้กลับ**ไม่มี** code นั้นใน `promotions` (Medusa ตอบ 200) → แสดง `promotion-error`
    ข้อความไทย "ใช้โค้ดนี้ไม่ได้" (หมดอายุ/ไม่ตรงเงื่อนไข) ไม่เงียบ; (c) `compareAddresses` ถือ `null`/`undefined`/`""` เท่ากัน — เลือกที่อยู่ที่บันทึกไว้แล้ว dropdown แสดงที่อยู่นั้น
    ไม่ใช่ "เลือกที่อยู่"; (d) `CountrySelect` สูงเท่า `Input` ในแถวเดียวกัน (±1px)
64. (CORE-19c — qa #118 CORE-19a) `DeleteButton` (`modules/common/components/delete-button`) ส่งต่อ `data-testid` ที่ผู้เรียกส่งมา (เช่น `cart-item-remove-button` ของ starter) ไปที่ `<button>`;
    ลบล้ม → แสดงข้อความไทย `cart-item-remove-error` ใกล้ปุ่มและหยุด spinner (ไม่กลืน error เงียบ)
65. (CORE-14f — qa #128 r2) การ์ด `add-variant-pending` (กฎข้อ 58) ห้ามบอกว่าสินค้า "ยังไม่ได้อยู่ในตะกร้า" — ถ้า variant อยู่ใน cart แล้วแสดงจำนวนปัจจุบัน (`add-variant-in-cart-qty`)
    ไม่เช่นนั้นใช้ข้อความกลาง ("เพิ่มสินค้านี้ลงตะกร้า?"); ค่า `countryCode` (path/ฟอร์ม) ที่ไม่ใช่ประเทศของ region ใดใน flow `add_variant` และ `/account` → ไม่มี 5xx:
    แสดง `add-variant-error` ข้อความไทย หรือ redirect ไป `/th/...` (ไม่โยน error ดิบ)
66. (CORE-20d — review/qa #124, #130) ให้ storefront กับ backend (CORE-20b) ตัดสินสิทธิ์คืนแบบเดียวกัน:
    (a) region ไม่ตั้ง `return_window_days` → ใช้ค่าเริ่มต้นเดียวกับ backend (`DEFAULT_REGION_STORE_POLICIES`, ตอนนี้ 30) ทั้งปุ่ม `order-return-button`, หน้า `/returns` และ JSON-LD
    (ไม่แสดง `PoliciesUnavailable` เพราะ key หาย)
    (b) ช่วงคืนคิด**ต่อ line**: วันอ้างอิงของ line = `delivered_at` (ไม่มีใช้ `shipped_at`) **ล่าสุด**ในบรรดา fulfillment ที่มี item นั้น (ตาม API ของ CORE-20b) — line ที่พ้นช่วงเลือกไม่ได้
    ในฟอร์ม และปุ่มแสดงเมื่อมี line ที่คืนได้ ≥ 1 (ไม่ใช้ fulfillment ล่าสุดของทั้ง order)
    (c) error code ของ CORE-20b (`RETURN_ITEM_NOT_SHIPPABLE`, `RETURN_ITEM_NOT_SHIPPED`, `RETURN_WINDOW_EXPIRED`) และ code อื่นที่ storefront map → ข้อความไทย: ใช้ `code` ถ้า
    js-sdk เก็บไว้ ไม่เช่นนั้น map ด้วยข้อความคงที่ของ backend **พร้อม contract test** (Vitest อ่าน source `apps/backend/src/api/store/ownership/return-window.ts`) ที่ล้มเมื่อข้อความ backend
    เปลี่ยนโดยไม่แก้ map
    (d) PDP/หน้าที่ต้องใช้ region อ่านด้วย `GET /store/regions/:id` ไม่ list ทุก region แบบไม่ cache
    (e) ฟอร์มคืนสินค้าที่ส่งล้มคงจำนวน/เหตุผลที่เลือกไว้; e2e cleanup ตรวจผลของ `request.delete` (ไม่เงียบเมื่อลบ region ของ test ไม่สำเร็จ)
    (f) ค่าที่ admin แก้มีผลกับหน้า `/returns` ภายในรอบ ISR (สังเกต 71–85 วินาทีใน qa #130) — ยอมรับ ≤ 90 วินาที ไม่มี task
67. (CORE-5c — qa #131 พบตอนรัน e2e ด้วย `E2E_SAVE_EVIDENCE=1`) การเก็บ evidence ของ e2e เขียนได้เฉพาะโฟลเดอร์ของ `evidenceTarget` ใน spec ที่กำลังรัน — spec ที่ไม่ตั้ง
    `evidenceTarget` ไม่เขียนไฟล์ evidence; screenshot อัตโนมัติของ `step()` นับรวมในงบ ≤ 5 PNG (กฎข้อ 12) — ปัจจุบันรัน e2e ทั้งชุดแล้ว `CORE-22/` เกิน 5 รูปและไฟล์ของ task อื่นถูกเขียนทับ
    (builder หาสาเหตุใน fixture `e2e/support/` ก่อนแก้)

### Acceptance criteria (follow-up รอบ 10)
- AC-98 (CORE-4f, กฎข้อ 62) Given ลูกค้ามีบัญชี When login ด้วยรหัสผ่านผิด Then `login-error-message` มีอักษรไทย ไม่ตรง `/Invalid|email|password/i` และ input อีเมลยังมีค่าเดิม;
  Given สมัครด้วยอีเมลที่มีบัญชีแล้ว Then error ของฟอร์มสมัครมีอักษรไทยและอีเมลยังอยู่; unit ของ action login/register (mock SDK throw 401/500/network) Then ข้อความที่คืนมีอักษรไทยทุกกรณี
  (e2e + unit Vitest)
- AC-99 (CORE-4g, กฎข้อ 63) unit: `medusaError` ของ `FetchError` status 401 คืน error ที่ `friendlyErrorMessage` แปลงเป็นข้อความ "เข้าสู่ระบบใหม่" (ต่างจากข้อความ fallback ของ status 500);
  `compareAddresses({…, company: null}, {…, company: ""})` = true; e2e: ใส่โค้ดของ promotion ที่ campaign หมดอายุ (สร้างผ่าน admin API) Then เห็น `promotion-error` มีอักษรไทย และ
  `cart.promotions` ไม่มี code นั้น; เลือกที่อยู่ที่บันทึกไว้ที่มี field ว่างแล้ว dropdown ไม่แสดงข้อความ placeholder; หลัง `document.fonts.ready` ความสูงของ `CountrySelect` ต่างจาก `Input`
  ข้างเคียง ≤ 1px; e2e ที่สร้าง/ลบข้อมูลตรวจ `response.ok()` ของ `request.delete` ใน `finally` (grep) (unit Vitest + e2e)
- AC-100 (CORE-19c, กฎข้อ 64) Given cart 2 line When เปิด `/th/cart` และ cart dropdown Then ทุก line มี `cart-item-remove-button` ใน DOM; Given route mock ให้ `DELETE` line ตอบ 500
  When กดลบ Then เห็น `cart-item-remove-error` มีอักษรไทย, spinner หายภายใน 5 วินาที และ line ยังอยู่ (e2e)
- AC-101 (CORE-14f, กฎข้อ 65) Given ลูกค้าล็อกอินและ cart มี variant V qty 2 When เปิด `/th/account?add_variant=V&add_quantity=1` Then การ์ด `add-variant-pending` มี
  `add-variant-in-cart-qty` = 2 และ textContent ไม่มี "ยังไม่ได้อยู่ในตะกร้า"; When เปิด `/zz/account?add_variant=V` หรือส่งฟอร์ม `add-variant-confirm` ที่แก้ `countryCode` เป็น `zz`
  Then HTTP status < 500 และเห็นข้อความไทย (`add-variant-error`) หรือ URL ปลายทางขึ้นต้น `/th/` (e2e ทั้ง JS on/off สำหรับข้อแรก, no-JS สำหรับฟอร์ม)
- AC-102 (CORE-20d, กฎข้อ 66) Given region R ที่ไม่มี `return_window_days` และ order ที่ ship แล้ว 10 วัน When เปิด order detail และ `/th/returns` Then เห็น `order-return-button`,
  หน้า `/returns` แสดงจำนวนวันคืน = ค่าเริ่มต้นของ backend (เทียบกับค่าที่อ่านจาก `region-store-policies.ts` ใน test) และ JSON-LD มีนโยบายคืน; Given order 2 line ที่ line A ship เมื่อ
  `window + 1` วันก่อน และ line B ship เมื่อวาน Then ฟอร์มคืนเลือกได้เฉพาะ B และ backend ตอบ 200 เมื่อส่ง B; Given backend ตอบ 400 `RETURN_WINDOW_EXPIRED` (route mock) Then ข้อความไทย
  เฉพาะของ code นั้น และจำนวนที่เลือกยังอยู่; contract test ล้มเมื่อแก้ข้อความใน `return-window.ts` (positive control ใน evidence); grep: PDP ไม่เรียก `listRegions` (e2e + unit Vitest)
- AC-103 (CORE-5c, กฎข้อ 67) Given `E2E_SAVE_EVIDENCE=1` When รันเฉพาะ `core-22-account-fixes.spec.ts` Then `git status --porcelain docs/evidence` แสดงการเปลี่ยนเฉพาะใต้
  `docs/evidence/core/CORE-22/` และ PNG ในโฟลเดอร์นั้น ≤ 5; When รัน spec อื่น 1 ไฟล์ (เช่น `core-23-*.spec.ts`) Then ไม่มีไฟล์ใต้ `CORE-22/` เปลี่ยน; unit ของ fixture: spec ที่ไม่ตั้ง
  `evidenceTarget` เรียก `evidence()`/`step()` แล้วไม่เขียนไฟล์ (Playwright project `unit` + e2e)

### แผนการทดสอบ (follow-up รอบ 10)
| ระดับ | AC |
|------|----|
| unit (Vitest) | AC-98 (action), AC-99 (`medusaError`, `compareAddresses`), AC-102 (contract test, window ต่อ line) |
| unit (Playwright project `unit`) | AC-103 (fixture) |
| e2e | AC-98, AC-99, AC-100, AC-101, AC-102, AC-103 |

### Tasks (follow-up รอบ 10)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-4f | (storefront เล็ก, qa #117/#131) error หน้า login/register เป็นไทยผ่าน `friendlyErrorMessage` + คงอีเมลเมื่อ login/register ล้ม (กฎข้อ 62) — path 4c1 (`modules/account`, `lib/data/customer.ts`) | AC-98 | CORE-14d ☑ (#128) — เริ่มได้ |
| CORE-4g | (storefront เล็ก, review/qa #131) `medusaError` คง status, `promotion-error` เมื่อโค้ดใช้ไม่ได้, `compareAddresses` null/"", ความสูง `CountrySelect`, e2e รอ `document.fonts.ready` + ตรวจผลลบใน `finally` (กฎข้อ 63) | AC-99 | CORE-4e ☑ (#131) — ∥ CORE-19b/PAY-6c/EV-7c (แตะ checkout คนละ component; ชน `lib/data/cart.ts` ตัวที่ merge ทีหลัง rebase) |
| CORE-19c | (storefront เล็ก, qa #118) `DeleteButton` ส่งต่อ `data-testid` + แสดง error เมื่อลบล้ม (กฎข้อ 64) | AC-100 | CORE-19a ☑ (#118) |
| CORE-14f | (storefront เล็ก, qa #128 r2 O-1/O-3) ข้อความการ์ด `add-variant-pending` ตามสถานะ cart + `countryCode` ที่ไม่มีจริงไม่ทำให้ 5xx (กฎข้อ 65) — O-2 (ส่งซ้ำ → cart 2 ใบ) อยู่ใน CORE-14e หลัง v1.0 | AC-101 | CORE-14d ☑ (#128) — เริ่มได้ |
| CORE-20d | (storefront เล็ก, review/qa #124/#130) ค่าเริ่มต้น window เดียวกับ backend ทุกหน้า, window ต่อ line, map error code + contract test, `GET /store/regions/:id`, ฟอร์มคงค่าเมื่อล้ม, e2e cleanup ตรวจผล (กฎข้อ 66) | AC-102 | CORE-20c (#130 — owner อนุมัติ merge 2026-10-27), CORE-20b ☑ (#124) |
| CORE-5c | (e2e tooling เล็ก, qa #131) evidence เขียนได้เฉพาะโฟลเดอร์ของ `evidenceTarget`, screenshot ของ `step()` อยู่ในงบ, ไม่เขียนทับ task อื่น (กฎข้อ 67) | AC-103 | CORE-5b ☑ |
CORE-19c ∥ CORE-5c ∥ CORE-4g ∥ CORE-4f ∥ CORE-14f เริ่มได้ทันที (CORE-14d ☑ #128; CORE-4f กับ CORE-14f แตะ `lib/data/customer.ts`/account ร่วมกัน — ตัวที่ merge ทีหลัง rebase);
CORE-20d หลัง CORE-20c (◐ #130 คิว merge)
CORE-15, CORE-19b, CORE-23b (รอบเดิม) ยังไม่เริ่ม — นิยามไม่เปลี่ยน; CORE-19b และ CORE-4g ← CORE-4e ☑ เริ่มได้แล้ว

หมายเหตุจาก CORE-1:
- CORE-2: seed ต้องใส่ metadata ของ store/region ที่ storefront อ่าน (key และค่า default ตาม
  `apps/backend/src/lib/region-store-policies.ts` เช่น `return_window_days`, `shipping_rate`) ลงใน region ที่สร้าง
  เพราะ migration script `region-store-policies.ts` เติมให้เฉพาะ region ที่มีอยู่แล้วตอน `db:migrate`
- CORE-6: ต้องลบ `if: ${{ false }}` ของ job `storefront-e2e` ใน `.github/workflows/ci.yml` เพื่อเปิด e2e ใน CI
