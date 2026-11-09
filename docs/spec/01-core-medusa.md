# 01 Core commerce — สิ่งที่ Medusa v2 มีให้เราอยู่แล้ว

สถานะ: accepted (รอบ 25 2026-11-09 — sync สถานะ: CORE-4i (#222 + #305), CORE-9b/9c/10c/15b/23c/25/26/48 ☑, owner ยืนยัน Q-F1 คง ฿10 placeholder; follow-up ล่าสุด: รอบ 23 2026-11-05 — CORE-50..51, กฎข้อ 108–109, AC-145..146 (หัวข้อ "Follow-up รอบ 23"), CORE-47 ☑ #298 (train #299), qa #298 O-2 และ qa #295 O-1 ปิดโดยไม่สร้าง task;
รอบ 21 2026-11-04 — CORE-47..49, กฎข้อ 105–107, AC-141..144 (หัวข้อ "Follow-up รอบ 21"), CORE-44..46 ☑, แก้ถ้อยคำกฎข้อ 103 ตาม D-1 ของ qa #288 (กฎข้อ 103e, AC-141 ☑ ครอบโดย test ที่ merge แล้ว);
รอบ 20 2026-11-04 — CORE-44..46, กฎข้อ 102–104, AC-138..140 (หัวข้อ "Follow-up รอบ 20"), CORE-40..43 ☑, ขยายกฎข้อ 99 ไป `step=delivery`/ไม่มี step (ถอนข้อ "ยอมรับใน v1" ของรอบ 19); รอบ 19 2026-11-04 — CORE-40..43, กฎข้อ 98–101, AC-134..137 (หัวข้อ "Follow-up รอบ 19"), CORE-29/35..39 ☑, กฎข้อ 96b ปิดโดยไม่แก้โค้ด, escape ตัว pipe ในเซลล์ตาราง; รอบ 18 2026-11-04 — CORE-35..39, กฎข้อ 93–97, AC-129..133 (หัวข้อ "Follow-up รอบ 18"); รอบ 17 2026-11-04 — CORE-33 (ไม่มีวิธีส่งหลังกรอง/method ค้าง, ← #243), CORE-34 (`removePromotionCode` ล้าง error, ← #241), กฎข้อ 91–92, AC-127..128,
หมายเหตุทาง (b) ของ CORE-32 ในกฎข้อ 89; รอบ 16b 2026-11-04 — owner ตัดสิน Q-C3 = B (ADR-019 accepted), Q-C4 = (ข) → ตรวจ shipping profile ตอน join ใน spec 04 GB-14, nit review #240 ของกฎข้อ 86e/87 และ Depends ของ CORE-28/29, CORE-28b (comment e2e core-14g หลัง CORE-28 #241) กฎข้อ 90, AC-126;
รอบ 16 2026-11-04 — CORE-28..32, กฎข้อ 85–89, AC-121..125, ADR-019 (CORE-29), คำถาม Q-C3/Q-C4; รอบ 14 2026-11-03 — CORE-27 กันกดเพิ่มตะกร้าซ้ำ, กฎข้อ 83, AC-119; CORE-14g cookie cart ใน server action (qa #222 D-1), กฎข้อ 84, AC-120; รอบ 13 — CORE-26, CORE-9c, กฎข้อ 81–82, AC-117..118, Q-C1/Q-C2 ตัดสินแล้วโดย owner 2026-11-03)
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
| UI ของ admin extension (component, hook, utility) | `@medusajs/dashboard/{components,hooks,lib}` (ตั้งแต่ v2.21.0) + `@medusajs/ui` + custom guide (Header) | ใช้เป็นฐานก่อนสร้างเอง — ADR-018 (accepted owner 2026-10-28), spec 08 (ADM-1..9) |
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
| CORE-10 | seed: ชื่อสินค้าไทย + ชื่อ option (เช่น Size) เป็นไทย (review #70, AC-68), ชื่อ category ไทย + handle คงที่ (รอบ 6, กฎข้อ 35, AC-72), เช็กการมีอยู่ทีละ resource, `.env.example` ว่าง (ค่าส่ง Standard คงเดิม กฎข้อ 19) + หัวข้อ dev ใน `README.md` (กฎข้อ 36, AC-73) — (รอบ 12, review #159) **AC-72 ยังไม่ได้ทำจริง** (seed ยังชื่ออังกฤษและหา category ด้วย `name`) → CORE-10c | AC-29..31, AC-68, AC-72, AC-73 | CORE-2 (แนะนำ — ไม่บังคับ — ให้ merge หลัง CORE-6 เพราะ e2e ของ CORE-6 ใช้ seed) |
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
  — (2026-11-09, รอบ 25) owner ยืนยันอีกครั้ง: **คง ฿10 placeholder** ไว้ก่อน ยังเป็นข้อใน checklist go-live เหมือนเดิม (ไม่มี task, ไม่เปลี่ยน seed)

## Follow-up จาก CORE-6 (2026-10-25)
ที่มา: builder CORE-6 (PR #36) — ไม่แก้นิยามของ CORE-6; ทุก task ด้านล่างเริ่มหลัง CORE-6 merge
Out of scope: เปิด `test:e2e:unit` ใน CI — อยู่ใน CORE-5b แล้ว (AC-23: ย้าย `*-tests.txt` + ขั้นตอนใน job `lint-typecheck`)
ไม่สร้าง task ซ้ำ

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa มีให้ (ตรวจ source 2.22.1) | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| auth ของ customer บน store route | `authenticate("customer", …)` — Medusa ใส่เองเฉพาะ `POST /store/carts/:id/customer`, `GET /store/orders`, `orders/:id/transfer/request\|cancel` | ขยาย: CORE-6 ใส่ให้ cart; CORE-13 ใส่ให้ returns |
| order transfer (ย้าย order ของ guest เข้าบัญชี) | `/store/orders/:id/transfer/request\|accept\|decline\|cancel` | **ปิด** (owner Q-F3): ร้านไม่มี guest order |
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
| CORE-19b | storefront: ปุ่ม "Continue to review" ไม่ค้าง + ลบการกดซ้ำใน `continueToReview` ของ e2e — (แก้ถ้อยคำรอบ 11 ตาม review #151) ต้นเหตุจริงคือ **race**: server action ที่สร้าง payment session คืนผลก่อน cart ใหม่เข้า props ของ component → กด Continue แล้วสร้าง session ซ้ำ; แก้โดยล็อกปุ่มจน cart มี session ของ provider ที่เลือก (ไม่ใช่ `router.push` ของ starter ตามที่เขียนเดิม) — ◐ #151; กรณี RSC refresh ไม่มาถึงแล้วปุ่มล็อกค้าง → CORE-19e | AC-64 | CORE-4d (แตะไฟล์ checkout เดียวกัน) |
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
- AC-100 (CORE-19c, กฎข้อ 64) Given cart 2 line When เปิด `/th/cart` และ cart dropdown Then ทุก line มี `cart-item-remove-button` ใน DOM; Given route mock ให้ request ของ
  server action ที่ลบ line (browser ส่งเป็น `POST` ไปที่หน้าเดิมพร้อม header `next-action` — `DELETE /store/carts/:id/line-items/:id` ยิงจาก Next server จึง mock จาก browser ไม่ได้)
  ตอบ 500 When กดลบ Then เห็น `cart-item-remove-error` มีอักษรไทย, spinner หายภายใน 5 วินาที และ line ยังอยู่ (e2e)
  (แก้ถ้อยคำรอบ 11 ตาม review #142 — ตรงกับที่ #142 ทดสอบ)
- AC-101 (CORE-14f, กฎข้อ 65) Given ลูกค้าล็อกอินและ cart มี variant V qty 2 When เปิด `/th/account?add_variant=V&add_quantity=1` Then การ์ด `add-variant-pending` มี
  `add-variant-in-cart-qty` = 2 และ textContent ไม่มี "ยังไม่ได้อยู่ในตะกร้า"; When เปิด `/zz/account?add_variant=V` หรือส่งฟอร์ม `add-variant-confirm` ที่แก้ `countryCode` เป็น `zz`
  Then HTTP status < 500 และเห็นข้อความไทย (`add-variant-error`) หรือ URL ปลายทางขึ้นต้น `/th/` (e2e ทั้ง JS on/off สำหรับข้อแรก, no-JS สำหรับฟอร์ม)
- AC-102 (CORE-20d, กฎข้อ 66) Given region R ที่ไม่มี `return_window_days` และ order ที่ ship แล้ว 10 วัน When เปิด order detail และ `/th/returns` Then เห็น `order-return-button`,
  หน้า `/returns` แสดงจำนวนวันคืน = ค่าเริ่มต้นของ backend (เทียบกับค่าที่อ่านจาก `region-store-policies.ts` ใน test) และ JSON-LD มีนโยบายคืน; Given order 2 line ที่ line A ship เมื่อ
  `window + 1` วันก่อน และ line B ship เมื่อวาน Then ฟอร์มคืนเลือกได้เฉพาะ B และ backend ตอบ 200 เมื่อส่ง B; Given backend ตอบ 400 `RETURN_WINDOW_EXPIRED` (route mock) Then ข้อความไทย
  เฉพาะของ code นั้น และจำนวนที่เลือกยังอยู่; contract test ล้มเมื่อแก้ข้อความใน `return-window.ts` (positive control ใน evidence); grep: ไฟล์ของ PDP อ่าน region ผ่าน
  `GET /store/regions/:id` และไม่เรียก `listRegions` (แก้ถ้อยคำรอบ 12 ตาม review #168 ให้ตรงกฎข้อ 66d) (e2e + unit Vitest)
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
(รอบ 11 สถานะ) CORE-19c ☑ #142 · CORE-4f ☑ #144 · CORE-14f ◐ #150 · CORE-20c ☑ #130 (CORE-20d เริ่มได้) · CORE-24 ☑ #134 · CORE-19b ◐ #151 · CORE-4g, CORE-5c, CORE-15, CORE-23b ☐

## Follow-up รอบ 11 จาก review/qa (2026-10-27)
ที่มา: review/qa ของ #142 (CORE-19c), #144 (CORE-4f), #151 (CORE-19b), builder CORE-4f และคำตัดสิน owner spec 03 Q6 (CORE-10b)
แก้ถ้อยคำในที่เดิม: AC-100 (mock request ของ server action ไม่ใช่ `DELETE` — review #142), แถว CORE-19b (ต้นเหตุคือ race ไม่ใช่ `router.push` — review #151)
Out of scope: nonce กันส่งซ้ำของฟอร์ม no-JS (CORE-14e หลัง v1.0) — กฎข้อ 69 กันเฉพาะการกดซ้ำตอน JS ทำงาน

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa / ไลบรารีมีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| status ของ error จาก Store API ใน server action | `FetchError.status` ของ `@medusajs/js-sdk` (ฝั่ง Next server) | ใช้ตามเดิม แต่ Next ใน production **ซ่อน** message/property ของ error ที่ throw จาก server action → ต้อง**คืนค่า** แทน throw (กฎข้อ 68) |
| สถานะ pending ของฟอร์ม | `useFormStatus`/`useActionState` ของ React 19 | ใช้ตามเดิม (กฎข้อ 69) |
| สร้าง collection และผูกสินค้าใน seed | `createCollectionsWorkflow` / workflow ของ product ใน `@medusajs/medusa/core-flows` | ใช้ตามเดิม (กฎข้อ 70) |

### Data model / Workflows / API routes
none (storefront)

### Business rules
68. (CORE-19d — review/qa #142) server action `deleteLineItem` คืนผลแบบมีโครงสร้าง `{ error: "unauthorized" | "failed" } | { ok: true }` แทนการ throw — status 401/403 ของ
    `FetchError` → `"unauthorized"`, อื่นๆ → `"failed"`; `DeleteButton` แสดง `cart-item-remove-error` ข้อความไทย "เข้าสู่ระบบใหม่" สำหรับ `unauthorized` (ต่างจากข้อความ fallback)
    — ไม่สร้าง helper กลางจนกว่าจะมี action ที่สองต้องใช้ (CLAUDE.md ข้อ 3)
69. (CORE-4h — review/qa #144, builder CORE-4f) ต่อจากกฎข้อ 62: (a) `completeLogin`/action login คืน `reason: "invalid_credentials"` (จาก status 401 ของ auth) และ UI ตัดสินจาก `reason`
    ไม่เทียบข้อความอังกฤษ; register 401 ที่ไม่ใช่อีเมลซ้ำ → ข้อความไทยทั่วไปของการสมัคร (ไม่บอกว่า "มีบัญชีอยู่แล้ว"); (b) ฟอร์มสมัครที่ล้มคงชื่อ/นามสกุล/เบอร์/อีเมล (รหัสผ่านล้างได้);
    (c) ปุ่ม login/register disabled ระหว่างส่ง (`dblclick` = action 1 ครั้ง); (d) หน้า verify-account (`confirmEmailVerification`) แสดง error เป็นข้อความไทยผ่าน `friendlyErrorMessage`
    ไม่แสดง `errorMessage` ดิบ
70. (CORE-10b — owner ตัดสิน spec 03 Q6, 2026-10-27) seed สร้าง product collection ตัวอย่าง handle คงที่ `featured` ชื่อไทย (เช่น "สินค้าแนะนำ") ใส่สินค้าที่ seed สร้าง 2–4 รายการ
    ด้วย workflow ของ Medusa (`createCollectionsWorkflow` + การผูกสินค้าผ่าน workflow ของ product) เพื่อให้หน้าแรกของ dev/staging มี rail สินค้า; idempotent แบบ CORE-10 (เช็กด้วย handle
    ก่อนสร้าง; มีอยู่แล้ว → ไม่สร้าง/ไม่แก้); e2e ของ FS-17 **ไม่**พึ่ง collection นี้ (สร้างข้อมูลเอง)
71. (CORE-19e — review #151 CORE-19b) ปุ่ม Continue ของขั้นชำระเงินที่ CORE-19b ล็อกไว้จน cart (props) มี session ของ provider ที่เลือก ต้อง**ไม่ค้างถาวร**เมื่อ RSC refresh ไม่มาถึง:
    ล็อกเกิน 5 วินาที → เรียก `router.refresh()` 1 ครั้ง; เกิน 10 วินาทีนับจากเริ่มล็อก → ปลดล็อกปุ่มและแสดง `payment-session-pending-error` ข้อความไทย (ให้ลองอีกครั้ง) — cart ได้ session
    เมื่อใดก็ปลดล็อกทันทีและยกเลิก timer (ไม่ refresh)

### Acceptance criteria (follow-up รอบ 11)
- AC-104 (CORE-19d, กฎข้อ 68) unit (Vitest, mock SDK): `deleteLineItem` เมื่อ SDK throw `FetchError` 401 → คืน `{ error: "unauthorized" }`, 500/network → `{ error: "failed" }`, สำเร็จ → `{ ok: true }`
  และไม่ throw; unit ของ `DeleteButton`: `unauthorized` กับ `failed` แสดงข้อความไทยต่างกันใน `cart-item-remove-error`; e2e: AC-100 ยังผ่าน (unit Vitest + e2e)
- AC-105 (CORE-4h, กฎข้อ 69) Given ลูกค้ามีบัญชี When `dblclick` ปุ่ม login ด้วยรหัสผ่านผิด Then มี request ของ action login 1 ครั้ง (นับ `POST` ที่มี header `next-action`) และ
  `login-error-message` มีอักษรไทย; When สมัครด้วยอีเมลที่มีบัญชีแล้ว Then input ชื่อ/นามสกุล/เบอร์/อีเมลยังมีค่าเดิมและ error มีอักษรไทย; Given token ยืนยันอีเมลไม่ถูกต้อง
  When เปิดหน้า verify-account Then ข้อความ error มีอักษรไทยและไม่ตรง `/[A-Za-z]{4,}/`; unit ของ action login (mock 401) คืน `reason: "invalid_credentials"`; unit ของ component login:
  action คืน `{ reason: "invalid_credentials", message: "<ข้อความใดก็ได้ที่ไม่ใช่ของ auth provider>" }` Then แสดงข้อความไทยเฉพาะของรหัสผ่านผิด (ตัดสินจาก `reason` ไม่ใช่ข้อความ);
  unit ของ action register (mock 401 ที่ไม่ใช่อีเมลซ้ำ) Then ข้อความไม่มี "มีบัญชีอยู่แล้ว" (แก้รอบ 11 ตาม review #152 — grep `"Invalid"` เดิมผ่านอยู่แล้วหลัง #144 จึงตัดออก) (e2e + unit Vitest)
- AC-106 (CORE-10b, กฎข้อ 70) Given DB ว่าง When รัน seed **สองครั้ง** Then มี product collection handle `featured` **1 รายการ** ชื่อมีอักษรไทย มีสินค้า seed ≥ 2 รายการ และจำนวนสินค้าใน
  collection เท่าเดิมหลังรันครั้งที่สอง; `GET /store/collections?handle[]=featured` (publishable key ของ seed) คืน collection นั้น; Given admin แก้ชื่อ collection `featured` (handle เดิม)
  When รัน seed อีกครั้ง Then ชื่อที่ admin แก้ยังอยู่และไม่มี collection ใหม่ (integration — test seed แบบเดียวกับ CORE-10)
- AC-107 (CORE-19e, กฎข้อ 71) unit (Vitest + fake timers) ของ component ขั้นชำระเงิน: Given เลือกวิธีชำระแล้ว action สร้าง session สำเร็จแต่ prop `cart` ยังไม่มี session ของ provider นั้น
  (แก้ถ้อยคำรอบ 12 ตาม review #166 — session ถูกสร้างตอนเลือกวิธีชำระ ไม่ใช่ตอนกด Continue)
  When เวลาผ่าน 5 วินาที Then `router.refresh` (mock) ถูกเรียก 1 ครั้งและปุ่มยัง disabled; When ผ่าน 10 วินาที Then ปุ่มกดได้และเห็น `payment-session-pending-error` มีอักษรไทย;
  Given prop `cart` ได้ session ที่ 2 วินาที Then ปุ่มปลดล็อก, ไม่มีการเรียก `router.refresh` และไม่มี error หลังเวลาผ่าน 10 วินาที; e2e AC-64 ยังผ่าน (unit Vitest + e2e)

### Tasks (follow-up รอบ 11)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-19d | (storefront เล็ก, review/qa #142) `deleteLineItem` คืนผลแบบมีโครงสร้าง + `DeleteButton` แยก unauthorized (กฎข้อ 68) — ไฟล์: `lib/data/cart.ts`, `modules/common/components/delete-button` | AC-104 | CORE-19c ☑ (#142) — เริ่มได้; ชน `lib/data/cart.ts` กับ CORE-4g ตัวที่ merge ทีหลัง rebase |
| CORE-4h | (storefront เล็ก, review/qa #144) `reason` ของ login, ฟอร์มสมัครคงค่า, กันกดซ้ำ login/register, error ไทยหน้า verify-account (กฎข้อ 69) — ไฟล์: `lib/data/customer.ts`, `modules/account/components/{login,register}`, หน้า verify-account | AC-105 | CORE-4f ☑ (#144) — เริ่มได้; ชน `lib/data/customer.ts` กับ CORE-14f (◐ #150) ตัวที่ merge ทีหลัง rebase |
| CORE-10b | (backend seed เล็ก, owner Q6 spec 03) collection ตัวอย่าง `featured` ใน seed (กฎข้อ 70) — ไฟล์: `apps/backend/src/scripts/seed.ts` (+ test ของ seed) | AC-106 | CORE-10 ☑ (#76) — เริ่มได้ |
| CORE-19e | (storefront เล็ก, review #151) ปุ่ม Continue ที่ล็อกรอ session ไม่ค้าง: `router.refresh()` ที่ 5s, ปลดล็อก + error ไทยที่ 10s (กฎข้อ 71) — ไฟล์: component ขั้นชำระเงินใน `modules/checkout` ที่ CORE-19b แก้ | AC-107 | CORE-19b (#151 merge) — ชนไฟล์ checkout กับ CORE-4g/EV-7c ตัวที่ merge ทีหลัง rebase |
CORE-19d ∥ CORE-4h ∥ CORE-10b (คนละไฟล์); CORE-19e หลัง #151
(รอบ 12 สถานะ) ☑ ทั้งหมดของรอบ 10–11: CORE-14f #150 · CORE-19b #151 · CORE-23b #154 · CORE-10b #159 · CORE-19d #160 · CORE-4h #162 · CORE-19e #166 · CORE-20d #168 ·
CORE-5c #169 · CORE-4g #170 · CORE-15 #177

## Follow-up รอบ 12 จาก review/qa (2026-10-28)
ที่มา: review/qa ของ #150, #154 (CORE-23b), #159 (CORE-10b), #160, #164 (FS-17), #166 (CORE-19e), #168 (CORE-20d), #169 (CORE-5c), #170 (CORE-4g), #173, #177 (CORE-15),
#178 (FS-15 — defect PDP เดิม), builder FS-15/FS-17/CORE-4h/AF-12c
แก้ถ้อยคำในที่เดิม: แถว "UI ของ admin extension" (ADR-018 accepted), AC-102 (grep region ของ PDP — review #168), AC-107 (session สร้างตอนเลือกวิธีชำระ — review #166),
แถว CORE-10 (AC-72 ยังไม่ทำ → CORE-10c)
ไม่ทำ/ยอมรับ (planner รอบ 12):
- review #168: ownership middleware ของ `GET /store/regions/:id` ไม่ระบุ method — route มีเฉพาะ GET จึงไม่กระทบพฤติกรรม; `/returns` ค้างค่า ~60s หลัง e2e คืนค่า = ISR ตามกฎข้อ 66f
- qa #168: Store order API ส่ง field ระดับ fulfillment (`data`, `provider_id`, `delivery_address`, `created_by`) ให้เจ้าของ order — เป็นของ Medusa core; provider ที่ใช้ใน v1
  (manual, `digital` ของ EV-3) ไม่ใส่ข้อมูลภายในใน `data` → ยอมรับใน v1; ทบทวนเมื่อเพิ่ม fulfillment provider ใหม่ (ใส่ใน PR ของ provider นั้น)
- qa CORE-14f: `/zz/account` → `/th/zz/account` (404 ภาษาไทย) — ตรง AC-101 แล้ว ไม่แก้ middleware
- builder CORE-4h: register อีเมลซ้ำยังเทียบข้อความ `Identity with email already exists` — auth ของ Medusa 2.22.1 ไม่มี code แยก จึงคงไว้และเพิ่มในเช็กลิสต์ bump (spec 07 ข้อ 8)
- builder CORE-5c: ตัวเลือก `E2E_SAVE_EVIDENCE=<TASK-ID>` — ไม่ทำ: CORE-5c จำกัดการเขียนตาม `evidenceTarget` แล้ว เหลือแค่ชื่อไฟล์ไม่ตรง (กฎข้อ 77)
- review #154: ปุ่ม `Loading...` ใน `modules/common/components/ui/index.tsx` — แก้แล้ว (เป็น "กำลังดำเนินการ...")
Out of scope: nonce กันส่งซ้ำของฟอร์ม no-JS (CORE-14e ⏸), แปลงตัวพิมพ์ของโค้ดส่วนลด (กฎข้อ 73)

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa / ไลบรารีมีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| error ของ server action ใน production | ไม่มี — Next ซ่อน message/property ของ error ที่ throw | คืนค่าแทน throw (กฎข้อ 68 → ขยายเป็นกฎข้อ 72) |
| ให้ RSC refresh ได้ cart ใหม่ | `revalidateTag` ของ Next + tag ของ cart ที่ starter ใช้ใน `retrieveCart` | ใช้ตามเดิม (กฎข้อ 75) |
| category ที่ handle คงที่ | `createProductCategoriesWorkflow` รับ `handle`; `query.graph` กรองด้วย `handle` | ใช้ตามเดิม (กฎข้อ 80) |
| ผูกสินค้าเข้า collection | workflow ของ product ใน core-flows (ที่ CORE-10b ใช้) | ใช้ตามเดิม (กฎข้อ 80) |

### Data model / Workflows / API routes
none (แก้ seed, search ingestion และ storefront เท่านั้น)

### Business rules
72. (CORE-4i — builder FS-15, review #160/#170, qa #142) server action ใน `lib/data/cart.ts` ที่ UI แสดง error (อย่างน้อย `applyPromotions`, `setAddresses`, `initiatePaymentSession`,
    `placeOrder`, `updateLineItem` — builder ตรวจผู้เรียก**ทั้งหมด** รวมหน้า `/account/orders/:id/pay` ของ PAY-3b1/PAY-3b2 ที่ใช้ component ชำระเงินเดียวกัน) คืน
    `{ error: "unauthorized" | "failed" | <code ที่ UI แยก — อย่างน้อย `PAYMENT_ALREADY_COMPLETED` (spec 06 กฎข้อ 9 d), `FLASH_*`, `PROMOTION_NOT_COMBINABLE`> }` แทนการ throw
    (แบบกฎข้อ 68) และผู้เรียกทุกตัวต้องอ่านค่าที่คืน (ไม่มีผู้เรียกที่ห่อ `try/catch` แล้วถือว่าไม่ throw = สำเร็จ) — แยกทางของ spec 06 กฎข้อ 9 (d)/(d2)/401 ต้องคงพฤติกรรมเดิม (review #188); `redirect`/`notFound`
    ของ Next ยัง throw ได้; ตอนนี้มีผู้ใช้ ≥ 2 ที่ → ย้ายการแปลง `FetchError` → ผล เป็น helper เดียวใน `lib/util/` (ใช้ร่วมกับ `deleteLineItem` ของ CORE-19d); UI แสดง `unauthorized`
    ด้วย constant `SIGN_IN_AGAIN_MESSAGE` ตัวเดียวทั้งเว็บ; ข้อยกเว้น literal `"unauthorized"`/`"failed"` ใน `user-messages-thai.test` จำกัดเฉพาะไฟล์ที่ใช้จริง (ไม่ยกเว้นทั้งโฟลเดอร์)
73. (CORE-4j — qa/review #170) (a) โค้ดส่วนลด trim ช่องว่างหัวท้ายก่อนส่ง — **ไม่**แปลงตัวพิมพ์ (Medusa เทียบตัวพิมพ์ และ code ของร้านมีตัวเล็กได้ เช่น `GB-<token>`);
    (b) ใส่โค้ดส่วนลดขณะฟอร์มที่อยู่ยังไม่บันทึก → ค่าที่พิมพ์ในฟอร์มที่อยู่ไม่หาย; (c) `billing-country-code-select` สูงเท่า input ข้างเคียง (±1px);
    (d) helper e2e `createExpiredPromotion` ตรวจ `response.ok()` ของการลบ campaign
74. (CORE-23c — qa/review #154, #150, qa #164 O-2) หน้า account: (a) ฟอร์มเพิ่ม/แก้ที่อยู่ (`address-card/add-address.tsx`, `edit-address-modal.tsx`) ที่บันทึกล้ม**คงค่าที่พิมพ์**
    และแสดง error ไทย (แบบกฎข้อ 61); (b) ฟอร์มที่อยู่ใบเสร็จ (`profile-billing-address`) เมื่อ server action ล้มระดับ network/5xx แสดง error ไทยในฟอร์ม ไม่ใช่หน้า "This page couldn't load";
    (c) กด "แก้ไข" แล้วพิมพ์ทันที ค่าที่พิมพ์ไม่หาย (ช่องไม่อยู่ใต้ `inert` หลังเปิด); (d) ลิงก์บริการลูกค้าใน `account-layout.tsx` ชี้ `/contact` (หน้าที่มีอยู่) แทน `/customer-service` ที่ไม่มี;
    (e) `.catch(() => null)` ใน `lib/data/customer.ts` ที่ review #150 ชี้ log error ก่อนคืน `null`
75. (CORE-19f — qa #166, qa #151) ขั้นชำระเงิน: (a) action ที่สร้าง payment session เรียก `revalidateTag` ของ cart ก่อนคืนผล — `router.refresh()` ของกฎข้อ 71 จึงได้ cart ที่มี session (ไม่ค้าง
    `force-cache`); (b) หลังปุ่มปลดล็อกจาก timeout (กฎข้อ 71) กด Continue ขณะ cart ยังไม่มี session ของ provider ที่เลือก → สร้าง session ใหม่ ไม่ไปขั้น review ที่ส่วนการชำระเงินว่าง;
    (c) สลับ บัตร → พร้อมเพย์ → บัตร แล้วกด Continue ครั้งเดียว → ขั้น review แสดงวิธีบัตร
76. (CORE-15b — review #177) search drawer ที่ header: request ค้นหาล้ม → แสดง `search-drawer-error` ข้อความไทย ไม่มี uncaught error (`pageerror`) และ `console.error` 1 บรรทัดเพื่อ debug;
    `instantsearch.js` ใน `apps/storefront/package.json` pin เวอร์ชันเดียวกับที่ `react-instantsearch` ใช้ (lockfile มีสำเนาเดียว)
77. (CORE-5d — qa #169, qa #173, builder CORE-5c/AF-12c) รัน e2e ทั้งชุดด้วย `E2E_SAVE_EVIDENCE=1` ต้องไม่ล้มเพราะงบ evidence ของ CORE-5c: ชื่อที่ spec ส่งให้ `evidence()`/`step()` ในโฟลเดอร์
    ที่มี PNG ครบ 5 แล้วต้องเป็นชื่อไฟล์ที่ commit อยู่ (แก้ชื่อใน spec ให้ตรงไฟล์ของ qa ไม่ลบ/เปลี่ยนรูปที่ commit) — อย่างน้อย CORE-22, CORE-14a, CORE-14d, CORE-4f, FS-10, AF-6, AF-8b;
    spec ที่ไม่ตั้ง `evidenceTarget` แต่เรียก `evidence()` → `console.warn` 1 ครั้งต่อไฟล์ (ยังไม่เขียนไฟล์ ตามกฎข้อ 67); (review #154) static test ที่ห้าม `if (await x.isVisible())`
    ใน e2e (ของ CORE-23b) จับรูปแบบ `getByTestId("…").isVisible()` และ locator แบบ chain ด้วย
78. (CORE-25 — qa #178 defect PDP ของ starter, flaky `core-19a-nav-cart-search.spec.ts:183`) PDP: option ที่ลูกค้าเลือกต้อง**ไม่ถูกรีเซ็ต**เป็นค่าจาก `v_id` ใน URL เมื่อ effect
    ที่ขึ้นกับ `product.variants` ทำงานซ้ำ (เลือก S → M แล้วกดเพิ่มทันที → line ใน cart เป็น M เสมอ — ลูกค้าต้องไม่ได้ไซซ์ผิด); helper `uiAddSizes` ของ e2e รอ `v_id` ของ variant
    ที่เลือกก่อนกดเพิ่ม; แถบปุ่มของ PDP บนมือถือที่ 375px ไม่ทับปุ่มเพิ่มลงตะกร้าหลัก
79. (CORE-9b — builder FS-17) search ingestion รับ event ลบที่ payload ไม่มี relation (เช่น `product-option.deleted`) โดยไม่ throw: `apps/backend/src/search/helpers/resolve-product-ids.ts`
    ข้าม row ที่หา `product_id` ไม่ได้ (ไม่อ่าน property ของ `undefined`) — สินค้าที่ได้รับผลถูก index ใหม่จาก event ของ product ที่ Medusa ส่งตามมา (builder ยืนยันใน 2.22.1;
    ถ้าไม่มี event ตามมา ให้หา `product_id` จากข้อมูลที่ payload มีหรือรายงานใน PR)
80. (CORE-10c — review #159) ทำกฎข้อ 35/AC-72 ให้จริง: category ตัวอย่างชื่อไทย `handle` คงที่ `shirts`/`sweatshirts` และ `ensureCategories` หาด้วย `handle` (ไม่ใช่ `name`);
    collection `featured` ที่มีอยู่แต่**ไม่มีสินค้า** (seed ล้มกลางทางรอบก่อน) → ผูกสินค้า seed ตามกฎข้อ 70 (ไม่แก้ชื่อ) — collection ที่มีสินค้าแล้วไม่แตะ;
    หมายเหตุ (รอบ 13, review #202): seed แยกไม่ออกว่า `featured` ว่างเพราะ seed ล้มหรือเพราะ admin เอาสินค้าออกเอง — รัน seed ซ้ำจึง**เติมสินค้า seed กลับเข้า `featured` ที่ admin ทำว่าง**
    (ยอมรับ: seed ใช้กับ dev/สภาพแวดล้อมใหม่ ไม่รันซ้ำบน production ที่ admin จัดการ collection เอง — ไม่มี task)

### Acceptance criteria (follow-up รอบ 12)
- AC-108 (CORE-9b, กฎข้อ 79) unit ของ `resolve-product-ids` ด้วย payload `product-option.deleted` ที่ไม่มี relation → คืนรายการ (อาจว่าง) ไม่ throw; integration: Given สินค้า P ที่มี option
  When ลบ option ผ่าน admin API Then spy logger ไม่มีบรรทัด warn/error ที่มี `Cannot read properties of undefined` และ `POST /store/search` ค้นด้วยชื่อ P ยังคืน P (unit jest + integration http)
  — (แก้ถ้อยคำรอบ 13 ตาม review #200: route ค้นหาของเราเป็น `POST /store/search` ไม่ใช่ `GET ?q=`)
- AC-109 (CORE-10c, กฎข้อ 80) integration seed ที่อ้าง AC-72 (ชื่อ category มีอักษรไทย, `handle` ∈ {`shirts`, `sweatshirts`}, รันซ้ำจำนวนเท่าเดิม, category อังกฤษ `handle=shirts` เดิมไม่ถูกเปลี่ยน
  และไม่มี `shirts-1`); Given collection `featured` ที่ไม่มีสินค้า When seed Then มีสินค้า seed ≥ 2 ใน collection และชื่อเดิมไม่เปลี่ยน; test ของ AC-30 assert จำนวน product collection = 1
- AC-110 (CORE-4i, กฎข้อ 72) unit (Vitest, mock SDK): ทุก action ที่เปลี่ยนเมื่อ SDK throw `FetchError` 401 → `{ error: "unauthorized" }`, 500/network → `{ error: "failed" }` (หรือ code ที่ UI แยก) และ
  ไม่ throw; component: ผล `unauthorized` แสดง `SIGN_IN_AGAIN_MESSAGE`; static (Vitest อ่าน source): ใน `modules/checkout/**` และ `modules/cart/**` ไม่มี `friendlyErrorMessage(` ที่รับค่าจาก
  `catch` ของการเรียก server action, ข้อยกเว้นใน `user-messages-thai.test` ระบุรายชื่อไฟล์; unit: action สร้าง session ที่ SDK throw 409 code `PAYMENT_ALREADY_COMPLETED` → คืน
  `{ error: "PAYMENT_ALREADY_COMPLETED" }` และหน้า `/account/orders/:id/pay` เข้าทาง poll ของ spec 06 กฎข้อ 9(d); e2e AC-99, AC-100, AC-22 (spec 03), AC-19, AC-7 และ (รอบ 13) AC-20
  (spec 06 — กลับจาก redirect ของ Stripe, PAY-3b2 #203) ยังผ่าน; (รอบ 13, Q-C2 = (ก) owner 2026-11-03) unit: ผลของ `createPaymentSession` (`lib/data/payment.ts`) และ `initiatePaymentSession` (`lib/data/cart.ts`)
  ผ่าน helper กลาง — ผู้เรียกใน UI ทั้งสองที่ได้ผลรูปแบบเดียว `{ ok: true } | { error }` (non-2xx อื่น → `"failed"`, 401 → `"unauthorized"`, 409 `PAYMENT_ALREADY_COMPLETED` → code นั้น)
  (รอบ 14, owner 2026-11-03) หมายเหตุ: ข้อ 1 ของ AC นี้ (ผล `unauthorized` แสดง `SIGN_IN_AGAIN_MESSAGE`) บนหน้า `/cart` เมื่อ JWT หายแต่ cookie `_medusa_cart_id` ยังอยู่ ไม่ขึ้นใน e2e เพราะ
  middleware ล้าง cookie ใน request ของ server action แล้วหน้าถูก render เป็นตะกร้าว่าง (qa #222 D-1) — **ปิดใน CORE-14g** (กฎข้อ 84, AC-120) ไม่ใช่ใน CORE-4i-a; หลังทั้งสอง merge ต้องรัน e2e ข้อนี้ซ้ำ
- AC-111 (CORE-4j, กฎข้อ 73) e2e: ใส่โค้ด `"  <code ที่ใช้ได้>  "` → `cart.promotions` มี code นั้น; กรอกฟอร์มที่อยู่ (ยังไม่กดบันทึก) แล้วใส่โค้ดส่วนลด → input ที่อยู่ยังมีค่าเดิม; หลัง
  `document.fonts.ready` ความสูง `billing-country-code-select` ต่างจาก input ข้างเคียง ≤ 1px; grep: `createExpiredPromotion` ตรวจ `ok()` ของการลบ
- AC-112 (CORE-23c, กฎข้อ 74) e2e: route mock request ของ server action เพิ่มที่อยู่/แก้ที่อยู่ให้ตอบ 500 → ค่าที่พิมพ์ยังอยู่และ error มีอักษรไทย; mock action ที่อยู่ใบเสร็จให้ล้มระดับ network →
  ยังเห็นฟอร์มพร้อม error ไทย (ไม่มีข้อความ "This page couldn't load"); กดแก้ไขแล้ว `type` ทันที → input มีค่าที่พิมพ์; เปิด `/th/account` → ไม่มี response 404 ของ path ใดใต้ `/th/`
  และลิงก์บริการลูกค้ามี `href` ลงท้าย `/contact`; unit: ฟังก์ชันใน `customer.ts` ที่ review #150 ชี้เรียก logger เมื่อ error (e2e + unit Vitest)
- AC-113 (CORE-19f, กฎข้อ 75) unit: action สร้าง session เรียก `revalidateTag` ด้วย tag ของ cart (mock `next/cache`); component (jsdom + fake timers): หลังปลดล็อกจาก timeout กด Continue
  ขณะ prop `cart` ไม่มี session → เรียก action สร้าง session และไม่เรียกการไปขั้น review; e2e (เมื่อ `HAS_STRIPE_UI`): สลับ บัตร → พร้อมเพย์ → บัตร แล้วกด Continue 1 ครั้ง → ขั้น review
  แสดงส่วนวิธีชำระเป็นบัตร; AC-64, AC-107 ยังผ่าน (unit Vitest + e2e)
- AC-114 (CORE-15b, กฎข้อ 76) e2e: route mock ของ request ค้นหาตอบ 500 → เปิด search ที่ header แล้วพิมพ์ → เห็น `search-drawer-error` มีอักษรไทย และ `page.on("pageerror")` ไม่ถูกเรียก;
  unit (อ่าน `pnpm-lock.yaml`): `instantsearch.js` มีเวอร์ชันเดียว (e2e + unit Vitest)
- AC-115 (CORE-5d, กฎข้อ 77) unit (Playwright project `unit`): สำหรับทุก spec ที่ตั้ง `evidenceTarget` และโฟลเดอร์มี PNG 5 ไฟล์ → ชื่อที่ spec ใช้กับ `evidence()`/`step()` เป็นสับเซตของชื่อ PNG
  ในโฟลเดอร์ (อ่าน source); fixture: ไม่ตั้ง `evidenceTarget` แล้วเรียก `evidence()` → `console.warn` 1 ครั้ง ไม่เขียนไฟล์; e2e: `E2E_SAVE_EVIDENCE=1` กับ spec ของ CORE-22, FS-10, AF-6,
  AF-8b → ไม่มี error จากงบ evidence และ `git status --porcelain docs/evidence` ไม่มีไฟล์ใหม่ในโฟลเดอร์ที่เต็ม; static test เรื่อง `isVisible` ล้มกับ fixture
  `if (await page.getByTestId("x").isVisible())` (positive control ใน evidence)
- AC-116 (CORE-25, กฎข้อ 78) e2e (`--repeat-each=10` ใน evidence): PDP สินค้า 2 ไซซ์ เลือก S → M แล้วกดเพิ่มทันที (ไม่รอ) → line ใน cart เป็น M ทุกรอบ; `core-19a-nav-cart-search.spec.ts:183`
  ผ่าน `--repeat-each=10`; ที่ 375×812 `boundingBox` ของแถบปุ่มมือถือไม่ทับปุ่มเพิ่มลงตะกร้าหลักเมื่อปุ่มหลักอยู่ในจอ

### แผนการทดสอบ (follow-up รอบ 12)
| ระดับ | AC |
|------|----|
| unit (jest backend) | AC-108 |
| integration (http / seed) | AC-108, AC-109 |
| unit (Vitest / Playwright `unit`) | AC-110, AC-112, AC-113, AC-114, AC-115 |
| e2e | AC-110 (regression), AC-111, AC-112, AC-113, AC-114, AC-115, AC-116 |

### Tasks (follow-up รอบ 12)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-9b | (backend เล็ก, builder FS-17) search ingestion ไม่ throw กับ event ลบที่ไม่มี relation (กฎข้อ 79) — ไฟล์: `src/search/helpers/resolve-product-ids.ts` + test | AC-108 | CORE-9 ☑ — ☑ #200 |
| CORE-10c | (backend seed เล็ก, review #159) category ไทย + `handle` คงที่ + หาด้วย handle, ซ่อม `featured` ที่ว่าง, test AC-72/AC-30 (กฎข้อ 80) — ไฟล์: `src/scripts/seed.ts` + test seed | AC-72, AC-109 | CORE-10b ☑ (#159) — ☑ #202 |
| CORE-4i | (storefront, FS-15/#160/#170) server action ของ `lib/data/cart.ts` คืนผลแบบมีโครงสร้าง + helper กลาง + `SIGN_IN_AGAIN_MESSAGE` เดียว (กฎข้อ 72) — ไฟล์: `lib/data/cart.ts`, `lib/util/` (helper), component ใน `modules/checkout`/`modules/cart` และหน้า `/account/orders/:id/pay` ที่เรียก action, `user-messages-thai.test` — เกิน ~400 LOC ให้ builder แยก (เช่น 4i-a: helper + `applyPromotions`/`updateLineItem` + cart; 4i-b: action ชำระเงิน + ผู้เรียก checkout/หน้า pay); (รอบ 13) + `lib/data/payment.ts` (`createPaymentSession`) และ `modules/order/components/order-pay` ตาม Q-C2 = (ก) (helper กลาง `{ ok } \| { error }`) — ☑ CORE-4i-a #222 + CORE-4i-b #305 (train #307) | AC-110 | CORE-19d ☑, FS-15 ☑ (#178), PAY-3b1 ☑ (#189), **PAY-3b2 (#203) merge** (spec 06 — contract error ของ action สร้าง session เดียวกัน; review #188) |
| CORE-4j | (storefront เล็ก, qa/review #170) trim โค้ดส่วนลด, ฟอร์มที่อยู่ไม่หายเมื่อใส่โค้ด, ความสูง billing select, `ok()` ใน helper e2e (กฎข้อ 73) | AC-111 | CORE-4i (แตะ `applyPromotions`/ฟอร์ม checkout เดียวกัน) |
| CORE-23c | (storefront เล็ก, qa/review #154/#150/#164) ฟอร์มที่อยู่ใน account คงค่าเมื่อล้ม, ที่อยู่ใบเสร็จไม่ล่มทั้งหน้า, พิมพ์หลังกดแก้ไข, ลิงก์ `/contact`, log ใน `customer.ts` (กฎข้อ 74) — ไฟล์: `modules/account/components/{address-card,profile-billing-address}`, `modules/account/templates/account-layout.tsx`, `lib/data/customer.ts` — ☑ #214 | AC-112 | CORE-23b ☑ (#154) — **เริ่มได้** (∥ CORE-4i — คนละไฟล์) |
| CORE-19f | (storefront เล็ก, qa #166/#151) revalidate cart หลังสร้าง session, Continue หลัง timeout ไม่ข้าม session, e2e สลับวิธีชำระ (กฎข้อ 75) — ไฟล์: `lib/data/cart.ts` (action สร้าง session), `modules/checkout/components/payment` | AC-113 | CORE-19e ☑ (#166), CORE-4i (แตะ action เดียวกัน — CORE-4i รอ PAY-3b1/3b2 อยู่แล้ว) |
| CORE-15b | (storefront เล็ก, review #177) error ของ search drawer ที่ header + pin `instantsearch.js` (กฎข้อ 76) — ไฟล์: `modules/search` (drawer), `apps/storefront/package.json`, `pnpm-lock.yaml` — ☑ #213 | AC-114 | CORE-15 ☑ (#177) — **เริ่มได้** |
| CORE-5d | (e2e tooling เล็ก, qa #169/#173) ชื่อ evidence ใน spec ตรงไฟล์ที่ commit + `console.warn` เมื่อไม่มี `evidenceTarget` (กฎข้อ 77) — ไฟล์: `e2e/support/` (fixture), `e2e/*.spec.ts` ที่ชื่อไม่ตรง | AC-115 | CORE-5c ☑ (#169) — **เริ่มได้** (แก้เฉพาะสตริงชื่อใน spec — ชนไฟล์ e2e ตัวที่ merge ทีหลัง rebase) |
| CORE-25 | (storefront เล็ก, **defect ที่ลูกค้าอาจได้ไซซ์ผิด** — qa #178) option บน PDP ไม่ถูกรีเซ็ตจาก `v_id`, `uiAddSizes` รอ `v_id`, แถบมือถือไม่ทับปุ่มหลัก (กฎข้อ 78) — ไฟล์: `modules/products/components/product-actions/{index,mobile-actions}.tsx`, e2e ของ CORE-19a (รอบ 13: #199 จริงแตะ `product-actions/index.tsx` + `lib/hooks/use-in-view.tsx` ใหม่) | AC-116 | — ☑ #199 |
(รอบ 13 สถานะ) CORE-9b ◐ #200, CORE-10c ◐ #202, CORE-25 ◐ #199; CORE-23c ∥ CORE-15b ∥ CORE-5d เริ่มได้ทันที; PAY-3b1 (#189) → PAY-3b2 → CORE-4i → (CORE-4j ∥ CORE-19f ∥ EV-7d ของ spec 02)

## Follow-up รอบ 13 จาก review/qa (2026-11-03)
ที่มา: review/qa ของ #199 (CORE-25), #200 (CORE-9b), #202 (CORE-10c), #203 (PAY-3b2 — contract ของ action สร้าง session ที่ค้างจากรอบ 12)
แก้ถ้อยคำในที่เดิม: AC-108 (`POST /store/search`), กฎข้อ 80 (หมายเหตุ seed เติม `featured` ที่ admin ทำว่าง), AC-110 (+ AC-20 ของ spec 06, Q-C2), แถว CORE-4i (← #203); owner ตัดสิน Q-C1/Q-C2 ตามข้อเสนอ (ก) ทั้งหมด 2026-11-03
ไม่ทำ/ยอมรับ (planner รอบ 13):
- review #200: option กลางที่ผูกหลายสินค้า — `query.graph` ของ `resolve-product-ids` ไม่แบ่งหน้า → **backlog** (ไม่มี AC): ทำเมื่อ option ตัวเดียวผูกสินค้าหลักร้อยจริง (แคตตาล็อก v1 เล็ก)
- review #199: แถบมือถือจาง 300ms ทับปุ่มหลักชั่วครู่เมื่อเลื่อนเร็ว → FS-19 (spec 03 กฎข้อ 24b — แตะไฟล์เดียวกับเรื่องรอ `flash.loading`)
Out of scope: เปลี่ยนรูปแบบ `cart-totals` ของหน้า `/cart`/checkout นอกจากให้แถวรวมกันได้ยอดสุทธิ (กฎข้อ 81b), i18n

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa / ไลบรารีมีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| ยอดรวมของ cart หลังส่วนลด | field ที่ Medusa คำนวณใน cart: `item_total` (รวมภาษี หลังส่วนลด), `item_subtotal`, `subtotal`, `discount_total`/`discount_subtotal`, `tax_total`, `total` | ใช้ตามเดิม — ห้ามคำนวณยอดเองใน storefront (กฎข้อ 81) |
| dropdown ของตะกร้า | `cart-dropdown` ของ Medusa Next.js Starter (เปิดเอง 5 วินาทีเมื่อจำนวนชิ้นเปลี่ยน) | ขยาย — แก้ยอดรวมและพฤติกรรมเปิดเอง (กฎข้อ 81, Q-C1) |
| รอ event ใน integration test | `medusaIntegrationTestRunner` + logger ใน container (`ContainerRegistrationKeys.LOGGER`) | ใช้ตามเดิม — ไม่ spy property private ของ event bus (กฎข้อ 82) |

### Data model / Workflows / API routes
none

### Business rules
81. (CORE-26 — **qa #199: ลูกค้าสับสนเรื่องราคา**, review #199) (a) dropdown ของตะกร้า (`nav-cart-dropdown`) แสดงยอดรวมจาก field ที่ Medusa คำนวณซึ่ง**สอดคล้องกับราคาต่อ line ที่แสดง
    (หลังส่วนลด flash/promotion และรวม VAT ตามราคาร้าน)** — ตาม Q-C1 (1) = (ก) (owner 2026-11-03): `cart.item_total` พร้อมป้าย "ยอดรวมสินค้า (รวม VAT)" แทน `cart.subtotal` + "(ไม่รวมภาษี)" ที่เป็นยอดก่อนส่วนลด
    และไม่รวมภาษี (เคส qa: line ฿2,360 × 2 แต่ยอดรวม ฿5,514.02 = 5,900/1.07); ห้ามคำนวณเอง (ไม่หาร 1.07, ไม่ `reduce` ราคา line); (b) `cart-totals` ของ `/cart` และ checkout: แถวที่แสดง
    (ยอดก่อนส่วนลด, ส่วนลด, ค่าจัดส่ง, ภาษี) ต้องรวมได้ `total` (±0.01) — ใช้ field ฐานภาษีเดียวกัน (`item_subtotal − discount_subtotal + shipping_subtotal + tax_total = total` — ไม่ใช้ `subtotal`
    ของ cart เพราะใน Medusa v2 รวม `shipping_subtotal` แล้ว จะนับค่าส่งซ้ำกับแถวค่าจัดส่ง) ถ้าปัจจุบันไม่รวมกันได้ให้แก้ใน task เดียวกัน;
    (c) dropdown ที่เปิดเองหลังจำนวนชิ้นเปลี่ยน (เช่นกดเพิ่มบน PDP) ต้องปิดเองภายใน 5 วินาที**แม้ mouse ค้างอยู่ใต้ panel ตั้งแต่ตอนเปิด** (panel เปิดทับปุ่มที่ลูกค้าเพิ่งกด — review #199:
    ค้างเปิดทับคอลัมน์ขวาของ PDP จน e2e ต้อง `dispatchEvent`) — การชี้ที่ `nav-cart-link` ยังเปิดค้างได้ตามเดิมของ starter (Q-C1 (2) = (ก), owner 2026-11-03); (d) (review #199 CORE-25)
    unit ของ PDP มีกรณีเปลี่ยน `product.id` (render สินค้าใหม่พร้อม `v_id` ของสินค้าใหม่) → option เป็นของ variant ตาม `v_id` ใหม่ ไม่ค้างค่าของสินค้าเดิม; (e) (review #202) comment
    ใน `apps/storefront/e2e/thai-ui-pages.spec.ts` ราวบรรทัด 11 ที่ยังอ้างชื่อ category "Shirts" แก้ตามชื่อไทยของกฎข้อ 80
82. (CORE-9c — review #200 CORE-9b) `integration-tests/http/search-option-deleted.spec.ts`: (a) รอผลของ ingestion ด้วยการ poll ค่าที่ test ต้องการ (เช่นผลของ `POST /store/search`)
    พร้อม timeout ชัดเจน แทน `sleep(3000)` คงที่; (b) ตรวจ log ผ่าน `logger` ที่ export สาธารณะจาก `@medusajs/framework/logger` ไม่ spy `logger_` ที่เป็น property private ของ event bus
    (แก้ระหว่าง CORE-9c 2026-11-03 ตามที่ session หลักอนุมัติ: ถ้อยคำเดิมให้ใช้ logger จาก container (`ContainerRegistrationKeys.LOGGER`) แต่ใน
    `medusaIntegrationTestRunner` ของ 2.22.1 เป็นคนละ instance — `medusa-test-runner.js:89-91` ตั้ง `LOGGER` = `logger` ของ framework แล้ว `appLoader.load()`
    สร้าง module ก่อน (event bus เก็บ logger ไว้ใน constructor, `medusa-module.js:285-292`) จากนั้น `loaders/index.js:97-100` จึงตั้ง `LOGGER = configDir.logger`
    (JSON logger ของ `medusa-config.ts`) ทับ — probe: `eventBus.logger_ === logger` เป็น true, `=== container.resolve(LOGGER)` เป็น false spy ที่ container จึงจับ log
    ของ event bus ไม่ได้ เป็นพฤติกรรมเฉพาะ test runner: ใน production (`medusa start`/worker) `initializeContainer` ตั้ง `LOGGER = configDir.logger ?? logger` ก่อน load
    module event bus จึงใช้ JSON logger ของ `medusa-config.ts` ตามปกติ) —
    ก่อน assert "ไม่มีบรรทัด error" ต้องยืนยันว่า spy จับ log ได้จริง (positive control: log ที่รู้ว่าเกิดในช่วงเดียวกัน หรือ assert ว่า spy ถูกเรียก ≥ 1 ครั้ง)

### Acceptance criteria (follow-up รอบ 13)
- AC-117 (CORE-26, กฎข้อ 81) e2e: Given แคมเปญ flash −20% ของสินค้า X ราคา ฿2,950 และ cart ของลูกค้ามี X qty 2 When ชี้ `nav-cart-link` Then `cart-subtotal` ใน `nav-cart-dropdown`
  มี `data-value` เท่ากับ `item_total` ของ `GET /store/carts/:id` (เทียบตัวเลข) = ผลรวมราคา line ที่แสดง (±0.01) และป้ายเป็น "ยอดรวมสินค้า (รวม VAT)" ไม่มีคำ "ไม่รวมภาษี" (Q-C1 (1) = (ก)); ที่ `/th/cart` แถวของ
  `cart-totals` (ยอดก่อนส่วนลด − ส่วนลด + ค่าจัดส่ง + ภาษี — ตาม field ที่แสดง) = ยอดรวม ±0.01; static (Vitest อ่าน source): `cart-dropdown/index.tsx` ไม่มี `1.07` และไม่มี `.reduce(` ที่อ่าน `unit_price`/`total`/`subtotal` (regex
  `/\.reduce\([\s\S]*?\b(unit_price|total|subtotal)\b/` กับ source ที่ตัด `countItems` ออกแล้ว — `countItems` ที่ `reduce` รวม `quantity` ได้รับยกเว้น;
  review #206: regex เดิม `reduce\([^)]*…` หยุดที่ `)` ของ arrow function จึงจับโค้ดจริงไม่ได้);
  e2e (desktop 1280px): กด `add-product-button` บน PDP โดยไม่ขยับ mouse → `nav-cart-dropdown` ปรากฏแล้วหายภายใน 6 วินาที และกด `add-product-button` ซ้ำได้ด้วย `click()` ปกติ (ไม่ใช้
  `dispatchEvent` — grep e2e ของ CORE-25/CORE-19a: ไม่มี `dispatchEvent("click")` กับปุ่มนี้); ชี้ `nav-cart-link` → dropdown ยังเปิดค้างตามเดิม; unit (Vitest + jsdom) ของ PDP: rerender ด้วย
  `product` ใหม่ + `v_id` ของ variant ในสินค้าใหม่ → option ที่เลือกตรง variant นั้น; grep: `thai-ui-pages.spec.ts` ไม่มี `Shirts` (e2e + unit Vitest)
- AC-118 (CORE-9c, กฎข้อ 82) grep `search-option-deleted.spec.ts`: ไม่มี `sleep(`/`setTimeout(` ที่รอเวลาคงที่ และไม่มี `logger_`; มีการ poll ที่มี timeout; spy ของ logger ถูกเรียก ≥ 1 ครั้งในช่วง test
  (positive control) และไม่มีบรรทัด warn/error ที่มี `Cannot read properties of undefined`; suite ผ่าน 3 run ติดใน CI (run id ใน PR); AC-108 ยังผ่าน (integration http)

### แผนการทดสอบ (follow-up รอบ 13)
| ระดับ | AC |
|------|----|
| unit (Vitest) | AC-117 (static + PDP rerender) |
| integration (http) | AC-118 |
| e2e | AC-117 |

### Tasks (follow-up รอบ 13)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-26 | (storefront เล็ก, **qa #199 — ยอดรวมใน dropdown ไม่ตรงราคาหลังส่วนลด**, review #199/#202) ยอดรวมของ `nav-cart-dropdown` จาก field ของ Medusa ที่สอดคล้องกับส่วนลด, แถว `cart-totals` รวมได้ยอดสุทธิ, dropdown ที่เปิดเองปิดเองแม้ mouse อยู่ใต้ panel, unit PDP เปลี่ยน `product.id`, comment "Shirts" (กฎข้อ 81) — ไฟล์: `modules/layout/components/cart-dropdown/index.tsx`, `modules/common/components/cart-totals` (ถ้าแถวไม่รวมกัน), `src/core-25-pdp-option-reset.test.ts` (+ `product-actions/index.tsx` ถ้า test ล้ม), `e2e/thai-ui-pages.spec.ts`, e2e ใหม่ของ CORE-26 — ☑ #209 | AC-117 | **CORE-25 (#199) merge** (test/e2e ของ PDP + ชน `product-actions`), CORE-10c (#202) เป็น dependency อ่อน — **ไม่บล็อก** (เริ่มหลัง #199 ได้; ส่วน (e) comment "Shirts" ใช้ชื่อ category ไทยของ #202 — ถ้า #202 ยังไม่ merge ตอนเปิด PR ให้ rebase แล้วทำ (e) ก่อน merge หรือข้าม (e) ไป PR ถัดไปที่แตะไฟล์นั้น); ∥ FS-19 (spec 03 — ชน `product-actions/index.tsx` ได้ ตัวที่ merge ทีหลัง rebase); ชน `cart-totals` กับ EV-7d (spec 02) ตัวที่ merge ทีหลัง rebase — **ควรทำก่อน** (ลูกค้าเห็นราคาสับสน) |
| CORE-9c | (backend test-only เล็ก, review #200) `search-option-deleted.spec.ts` poll + timeout แทน `sleep`, spy `logger` ของ `@medusajs/framework/logger` (ไม่ใช่ `logger_`) + positive control (กฎข้อ 82) — ไฟล์: `integration-tests/http/search-option-deleted.spec.ts` — ☑ #218 | AC-118 | **CORE-9b (#200) merge** |
CORE-26 ∥ CORE-9c ∥ FS-19 (spec 03) หลัง PR ที่ระบุ merge; CORE-4i ← PAY-3b2 (#203)

### Open questions (รอบ 13 — ปิดแล้ว)
- ~~Q-C1~~ ตัดสินแล้ว (owner 2026-11-03): **(1) = (ก)** `item_total` ป้าย "ยอดรวมสินค้า (รวม VAT)", **(2) = (ก)** คงเปิดเองแต่ปิดเองใน 5 วินาทีแม้ mouse อยู่ใต้ panel → กฎข้อ 81, AC-117, CORE-26;
  คำถามเดิม (CORE-26, qa/review #199) dropdown ของตะกร้า: (1) ยอดรวมที่แสดง — (ก) **[แนะนำ]** `item_total` ป้าย "ยอดรวมสินค้า (รวม VAT)": ตรงกับราคาต่อ line ที่ลูกค้าเห็น (หลังส่วนลด รวม VAT
  เพราะราคาร้านรวม VAT) ไม่รวมค่าส่งที่ยังไม่ได้เลือก; (ข) `total` — รวมค่าส่ง/ภาษีทั้งหมด แต่ก่อนเลือกวิธีส่งไม่ตรงกับยอดที่จะจ่าย อาจสับสนอีกแบบ; (ค) คง `subtotal` (ก่อนส่วนลด ไม่รวมภาษี)
  แล้วเพิ่มแถวส่วนลด/ภาษี — ครบแต่ dropdown ยาวขึ้นและยังขัดกับราคา line ที่รวม VAT; (2) dropdown เปิดเองหลังกดเพิ่ม — (ก) **[แนะนำ]** คงการเปิดเอง (feedback ว่าเพิ่มแล้ว) แต่ปิดเองใน 5 วินาที
  แม้ mouse อยู่ใต้ panel (กฎข้อ 81c); (ข) ไม่เปิดเองบน PDP (ใช้ toast/ข้อความใต้ปุ่มแทน — ต้องมีข้อความใหม่); (ค) คงตามเดิมของ starter (ปัญหาค้างทับปุ่มยังอยู่)
- ~~Q-C2~~ ตัดสินแล้ว (owner 2026-11-03): **(ก)** helper กลาง — ผู้เรียกใน UI ได้ `{ ok: true } | { error }` รูปแบบเดียว (`createPaymentSession` คงเป็นตัวส่ง request ระดับล่าง) → กฎข้อ 72, AC-110, CORE-4i;
  คำถามเดิม (CORE-4i, ค้างจากรอบ 12 — ชน PAY-3b2 #203) action สร้าง payment session มีสองรูปแบบผล: `createPaymentSession` (`lib/data/payment.ts`, ใช้ fetch ตรง) คืน `{ status, code }`
  ให้หน้า pay แยกกฎข้อ 9 d/d2/401 ของ spec 06 ส่วน `initiatePaymentSession` (`lib/data/cart.ts`) คืน `{ error }` ตามกฎข้อ 72 — (ก) **[แนะนำ]** คง `createPaymentSession` เป็นตัวส่ง request
  ระดับล่าง (ต้องใช้ status/code จาก fetch ตรงเพราะ `FetchError` ไม่เก็บ code) แต่ผู้เรียกใน UI ทั้งหน้า pay และ checkout ได้ผลผ่าน helper กลางของกฎข้อ 72 รูปแบบเดียว `{ ok: true } | { error }`
  (`401` → `"unauthorized"`, 409 `PAYMENT_ALREADY_COMPLETED` → code นั้น, non-2xx อื่น/network → `"failed"`) — การแยกทางของกฎข้อ 9 d/d2/401 ทำได้ครบจากค่านี้ และ UI มีรูปแบบผลเดียวทั้งเว็บ;
  (ข) คงสองรูปแบบ + บันทึกเหตุผลใน JSDoc — แก้น้อยสุด แต่ผู้เรียกต้องจำสองแบบ (ขัดเจตนา "helper เดียว" ของกฎข้อ 72); (ค) ทุก action คืน `{ status, code }` — ต้องแก้ผู้เรียกของกฎข้อ 68/72
  ทั้งหมดที่ทำไปแล้ว; ไม่กระทบ EV-7d (spec 02 กฎข้อ 28 — redirect ผ่าน `safeCountryCode`; EV-7d ยังรอ CORE-4i ตามเดิม)

## Follow-up รอบ 14 (2026-11-03 — owner สั่ง: กันกดเพิ่มตะกร้าซ้ำบน storefront)
ที่มา: qa #211 (FS-19) — `el.click()` สองครั้งใน tick เดียวที่ `add-product-button` หรือ `mobile-cart-button` → line ได้ quantity 2 (ปัญหาเดิมของ starter ไม่ใช่ regression;
qa #209 ใช้ dblclick ของ Playwright ได้ +1 เพราะมีจังหวะให้ React render ระหว่างคลิก) ต้นเหตุ: ปุ่ม disable ด้วย state `isAdding` ซึ่งยังไม่ render ตอนคลิกที่สองใน tick เดียว;
review #211: `mobile-cart-button` ไม่ disable ด้วย `!isValidVariant`/`optionsDisabled`/`isAdding` ครบแบบปุ่มหลัก
ค้นแล้ว (`apps/storefront/src`): จุดเดียวใน UI ที่เรียก `addToCart` คือ `handleAddToCart` ของ `product-actions/index.tsx` (ทั้งสองปุ่มเรียก handler นี้) — `lib/data/customer.ts` เรียกฝั่ง server
หลัง login (pending add ครั้งเดียว ไม่ใช่ปุ่ม) จึง**ไม่สร้าง hook ใหม่** (CLAUDE.md ข้อ 3 — ผู้ใช้ที่เดียว); hook ที่มีอยู่ `lib/hooks/use-submit-once.tsx` (login/register, กฎข้อ 69c)
ไม่ใช้ เพราะผูกกับ `FormEvent` ของ `<form>` และปลด guard ผ่าน `useEffect` ตาม `isPending` ของ form action ขณะที่ `mobile-cart-button` เป็น `onClick` นอก form และ `handleAddToCart` เรียก `addToCart` ตรง
Out of scope: backend / Store API (เพิ่มสินค้าเดิมซ้ำโดยตั้งใจยังต้องรวม quantity ตามเดิม), ปุ่มอื่นของ storefront ที่ไม่ใช่เพิ่มตะกร้า

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa / ไลบรารีมีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| เพิ่ม line ลง cart | `POST /store/carts/:id/line-items` (variant เดิมรวม quantity) ผ่าน `addToCart` ของ Medusa Next.js Starter (`lib/data/cart.ts`) | ใช้ตามเดิม — ไม่แตะ |
| ปุ่ม/สถานะ loading | `Button` ของ `@medusajs/ui` (`isLoading`, `disabled`) + state `isAdding` ของ `ProductActions` ใน starter | ขยาย — เพิ่ม guard แบบ synchronous (`useRef`) ใน `handleAddToCart` เพราะ state ไม่ทันในคลิกที่สองของ tick เดียว |
| กันยิงซ้ำฝั่ง server | Store API ไม่มี idempotency key ของ line item | ไม่ทำ — owner กำหนดไม่แตะ backend; กันที่ client พอสำหรับการกดซ้อนของคนเดียว |

### Data model / Workflows / API routes
none

### Business rules
83. (CORE-27 — qa/review #211) ปุ่มเพิ่มลงตะกร้าทั้งสองจุดของ PDP ต้องกันการยิงซ้อน**แบบ synchronous** (ฟอร์ม login/register อยู่ใต้กฎข้อ 69c + `use-submit-once` ตามเดิม — กฎนี้ไม่ซ้อน/ไม่แก้กฎนั้น) — (a) `handleAddToCart`
    ใน `product-actions/index.tsx` ใช้ `useRef` in-flight: ถ้ามี request ค้างอยู่ให้ return ทันที ตั้งค่าก่อน `await` แรก และปลดใน `finally` (ทั้งสำเร็จและ error) — `isAdding` ยังใช้แสดงผล/disable
    ได้ แต่ห้ามเป็นตัวกันเพียงอย่างเดียว; (b) หลัง request แรกจบ กดเพิ่มอีกครั้งต้องได้ (quantity สะสมตาม Medusa); (c) `mobile-cart-button` disable ด้วยเงื่อนไขเดียวกับ `add-product-button`
    (`!inStock`, `!variant`, `!isValidVariant`, `optionsDisabled`, `isAdding`, `qtyExceeded`, และ prop `flashLoading` ที่ FS-19 #211 เพิ่มตามกฎข้อ 24a ของ spec 03) — ส่งค่าที่ขาดเป็น prop จาก `index.tsx`;
    (d) ไม่สร้าง hook/abstraction ใหม่จนกว่าจะมีจุดที่สองที่ต้องใช้จริง

### Acceptance criteria (follow-up รอบ 14)
- AC-119 (CORE-27, กฎข้อ 83) unit (Vitest + jsdom, `src/core-27-add-to-cart-guard.test.ts`): `addToCart` mock คืน promise ที่ยังไม่ resolve; Given PDP render แล้ว When เรียก `.click()`
  ที่ `add-product-button` สองครั้งภายใน `act()` เดียว (ไม่ให้ React render ระหว่างคลิก — test นี้ต้อง fail กับโค้ดก่อนแก้) Then `addToCart` ถูกเรียก 1 ครั้ง; เหมือนกันกับ `mobile-cart-button`
  (mock `useIntersection` คืน `false` — หลัง #211 แถบ mount เฉพาะ `inView === false`) และคลิกปุ่มหลัก + ปุ่มมือถือสลับกันใน `act()` เดียว → 1 ครั้ง; resolve request แรกแล้วคลิกอีกครั้ง → เรียกครั้งที่ 2; mock reject → ปลด guard แล้วคลิกอีกครั้งได้;
  render ด้วย variant ที่ไม่ valid / `disabled` → `mobile-cart-button` มี attribute `disabled`; ทุกกรณีคลิกต้อง mock `useFlashOffer` คืน `loading: false` และ assert ว่าปุ่ม**ไม่ disabled ก่อนคลิก**
  (ไม่งั้นปุ่ม disabled ตั้งแต่ต้น test ผ่านโดยไม่ได้ทดสอบ guard);
  e2e (`e2e/core-27-add-to-cart-guard.spec.ts`, customer login, desktop 1280px และ 375×812 สำหรับ `mobile-cart-button`): เริ่มนับ request ของ server action เพิ่มตะกร้า (POST ที่มี header
  `next-action` จาก `page.on("request")`) **ก่อน** `page.evaluate` ที่เรียก `el.click()` สองครั้งติดกัน → รอ network idle + ช่วงคงที่ที่กำหนดในไฟล์ (เช่น 1 วินาที) → จำนวน request = **1 พอดี**
  (กัน false-pass: โค้ดเดิมยิงสอง action พร้อมกัน ตัวแรกจบแล้วอ่าน cart ได้ 1 ขณะตัวที่สองยังค้าง) แล้ว quantity ของ line ใน `GET /store/carts/:id` = 1; จากนั้น `click()` ปกติแล้วรอ → จำนวน request = 2
  และ quantity = 2; ผ่าน `--repeat-each=5` (ผลใน evidence) และต้อง fail กับโค้ดก่อนแก้ (แนบผลรันก่อนแก้ใน PR)

### แผนการทดสอบ (follow-up รอบ 14)
| ระดับ | AC |
|------|----|
| unit (Vitest) | AC-119 (คลิกซ้อน, หลัง resolve/reject, disabled ของปุ่มมือถือ) |
| e2e | AC-119 (desktop + 375px) |

### Tasks (follow-up รอบ 14)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-27 | (storefront เล็ก, qa/review #211) guard `useRef` in-flight ใน `handleAddToCart` + `mobile-cart-button` disable ครบแบบปุ่มหลัก (กฎข้อ 83) — ไฟล์: `modules/products/components/product-actions/index.tsx`, `modules/products/components/product-actions/mobile-actions.tsx`, `src/core-27-add-to-cart-guard.test.ts` ใหม่, `e2e/core-27-add-to-cart-guard.spec.ts` ใหม่ | AC-119 | **FS-19 (#211) merge** (แตะ `index.tsx` + `mobile-actions.tsx` และเพิ่ม `flash.loading` ใน prop เดียวกัน); CORE-26 (#209) — ชน e2e/unit ของ PDP (core-25) ตัวที่ merge ทีหลัง rebase (ไม่บล็อกถ้า #211 merge แล้ว) |
(รอบ 14 สถานะ) CORE-27 ☐ (← FS-19 #211); ไม่มีคำถามค้าง

### Open questions (รอบ 14)
none

## Follow-up รอบ 14b (2026-11-03 — owner อนุมัติ: cookie cart ใน server action, qa #222 D-1)
ที่มา: qa #222 (CORE-4i-a) D-1 + builder ยืนยันบน develop — ลูกค้า login อยู่หน้า `/cart` แล้ว JWT หาย/หมดอายุ แต่ cookie `_medusa_cart_id` ยังอยู่ → กดแก้จำนวน/ใส่โค้ด/ลบโค้ด/ลบสินค้า →
`clearStaleCartCookie` (`lib/util/stale-cart-cookie.ts`, middleware ของ CORE-14a) ล้าง cookie ใน request ของ server action ด้วย → Next render `/cart` ใหม่ใน response เดียวกันโดยไม่มี cart id →
เห็นตะกร้าว่างทับผล `{ error: "unauthorized" }` และไม่ขึ้น `SIGN_IN_AGAIN_MESSAGE` (cart ใน backend ยังอยู่ครบ) — AC-43 ครอบเฉพาะตอน**เปิดหน้า** ส่วนกฎข้อ 68/72 + AC-104/AC-110 ต้องบอกให้เข้าสู่ระบบใหม่
สองข้อนี้ไม่ขัดกันถ้า middleware ไม่ล้าง cookie ใน request ของ server action
Out of scope: backend, การ refresh token อัตโนมัติ, การย้าย cart หลัง login ใหม่ (CORE-14c เดิม)

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa / ไลบรารีมีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| ปฏิเสธการแก้ cart เมื่อไม่มี token | ownership ของ CORE-6/CORE-12 → Store API ตอบ 401 | ใช้ตามเดิม |
| แยก request ของ server action | Next.js ส่ง header `next-action` ในทุก POST ของ server action | ใช้ตามเดิม — เงื่อนไขเพิ่มใน `clearStaleCartCookie` |
| ล้าง cookie cart ค้าง | middleware ของ starter + `clearStaleCartCookie` (CORE-14a) | ขยาย — ข้ามเฉพาะ request ของ server action |

### Data model / Workflows / API routes
none

### Business rules
84. (CORE-14g — qa #222 D-1, owner 2026-11-03) `clearStaleCartCookie` **ไม่ล้าง** `_medusa_cart_id` เมื่อ request มี header `next-action` (server action) — ให้ action ทำงานกับ cart id เดิม
    ได้รับ 401 จาก backend แล้วคืน `{ error: "unauthorized" }` ตามกฎข้อ 68/72 และหน้าแสดง `SIGN_IN_AGAIN_MESSAGE` โดยแถวสินค้ายังอยู่; request อื่น (GET หน้า/RSC navigation) ยังล้างตาม AC-43
    เหมือนเดิม; ความปลอดภัยไม่ลด เพราะ action ตรวจ JWT ก่อนเรียก SDK และ backend ตอบ 401 สำหรับ cart ที่ไม่มี token (CORE-12) — ไม่แก้ middleware ส่วนอื่น ไม่เพิ่ม helper ใหม่

### Acceptance criteria (follow-up รอบ 14b)
- AC-120 (CORE-14g, กฎข้อ 84) unit (Vitest, `stale-cart-cookie.test.ts` เดิม): request ที่มี `_medusa_cart_id` ไม่มี `_medusa_jwt` และมี header `next-action` → response ไม่มี `Set-Cookie` ของ `_medusa_cart_id`;
  เหมือนกันแต่ไม่มี `next-action` (GET) → ล้าง (`maxAge: 0`) ตาม test เดิม; มี `_medusa_jwt` → ไม่ล้างทั้งสองแบบ (test เดิมยังผ่าน);
  e2e (`e2e/core-14g-action-stale-jwt.spec.ts`, customer login มี cart ที่มีสินค้า 1 line + โค้ดส่วนลด 1 ตัว): เปิด `/th/cart` แล้วลบ cookie `_medusa_jwt` ออกจาก context (คง `_medusa_cart_id`) โดยไม่ reload
  แล้วทำทีละอย่าง — (1) เปลี่ยนจำนวน (2) ลบโค้ดส่วนลด (3) ใส่โค้ด (4) ลบสินค้า — แต่ละครั้ง Then เห็นข้อความเท่ากับ `SIGN_IN_AGAIN_MESSAGE` (import constant ไม่ match ข้อความ hard-code) และแถวสินค้ายังอยู่
  (`data-testid` ของแถวใน cart), cookie `_medusa_cart_id` ยังเป็นค่าเดิม และ cart ใน backend (อ่านด้วย token เดิมผ่าน API) ไม่เปลี่ยน; จากนั้น reload `/th/cart` → cookie `_medusa_cart_id` ถูกล้าง
  และหน้าเป็นตามที่ AC-43 กำหนด; test ต้อง fail กับโค้ดก่อนแก้ (แนบผลรันก่อนแก้ใน PR)

### แผนการทดสอบ (follow-up รอบ 14b)
| ระดับ | AC |
|------|----|
| unit (Vitest) | AC-120 (`next-action` → ไม่ล้าง, GET → ล้าง, มี JWT → ไม่ล้าง) |
| e2e | AC-120 (จำนวน / ลบโค้ด / ใส่โค้ด / ลบสินค้า + reload → AC-43) |

### Tasks (follow-up รอบ 14b)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-14g | (storefront เล็ก ~60–80 LOC, qa #222 D-1; owner เรียก "CORE-14d" แต่เลขนี้ใช้แล้ว ☑ #128) เงื่อนไข `!request.headers.has("next-action")` ใน `clearStaleCartCookie` (กฎข้อ 84) — ไฟล์: `lib/util/stale-cart-cookie.ts`, `lib/util/stale-cart-cookie.test.ts`, `e2e/core-14g-action-stale-jwt.spec.ts` ใหม่ | AC-120 | CORE-4i-a (#222) — ขนานได้ (คนละไฟล์) แต่ e2e ของ AC-120 พึ่งผล `unauthorized` ของ #222: ถ้า #222 ยังไม่ merge ให้ merge ก่อนเปิด PR; หลังทั้งสอง merge รัน AC-110 ข้อ 1 ซ้ำ |
(รอบ 14b สถานะ) CORE-14g ☐ เริ่มได้; ไม่มีคำถามค้าง

### Open questions (รอบ 14b)
none

## Follow-up รอบ 16 จาก review/qa (2026-11-04 — owner อนุมัติเปิด task)
ที่มา: qa CORE-4i (#222) O-2, qa GB-7a2 (#238) ข้อสังเกต 1 และ D1, qa GB-7c (#239) AC-48 (ไม่ login → `/th/account` แล้วไม่กลับหน้าเดิม), รอบ 14b (ตะกร้าหายหลัง login ใหม่ — เดิม out of scope),
review/qa 2026-11-04 (ปุ่มคัดลอกซ้ำกัน 2 ที่, comment ค้างใน e2e core-19c) — ตรวจโค้ดบน develop `abbbc92` แล้วยังเป็นจริงทุกข้อ:
`promotion-error` อยู่ใต้ `{isOpen && ...}` (`discount-code/index.tsx` ~95–118); `readReturnTo` รับเฉพาะ `/buy/` (`lib/util/login-return.ts`) และหน้ากลุ่ม/ปุ่มสร้างทีม `router.push("/<cc>/account")`
ไม่มี return URL; `VoucherCopyButton` เรียก `navigator.clipboard.writeText` เองซ้ำกับ `ShareLinkButton`; checkout/หน้ากลุ่มแสดงทุก option จาก `GET /store/shipping-options` (ไม่กรอง);
comment `core-19c-delete-button-error.spec.ts` ~180–181 ยังว่า middleware ล้าง cookie ก่อนถึง action (จะผิดเมื่อ CORE-14g #234 merge)
ย้ายไป spec 04 (GB-12 กฎข้อ 32c): ข้อความส่วนลด fixed "ต่อชิ้น" — อยู่ใน `groupDiscountValue` ของหน้ากลุ่ม/การ์ด group buy (qa GB-7a1 ข้อสังเกต 2) ไม่ใช่ checkout
Out of scope: กฎข้อ 84/AC-120 (CORE-14g ☑ #234 — ไม่แก้), refresh token อัตโนมัติ, merge cart สองใบ, กรอง/ห่อ `GET /store/shipping-options` ฝั่ง backend,
การตรวจ shipping profile ตอน join ฝั่ง backend (Q-C4 = ข → spec 04 GB-14 กฎข้อ 35 — ไม่อยู่ใน spec นี้), i18n

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa / ไลบรารีมีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| หา cart ล่าสุดของ customer หลัง login | **ไม่มี** — Store API 2.22.1 ไม่มี `GET /store/carts` (`api/store/carts/route.ts` export แค่ `POST`), อ่าน cart ได้ด้วย id ที่ storefront เก็บเท่านั้น; `metadata` ของ customer แก้ได้ผ่าน `POST /store/customers/me` | ขยาย — **ADR-019 (accepted owner 2026-11-04)** ทางเลือก B: จำ id ของตะกร้าหลักใน `customer.metadata` แล้วกู้ตอน login; ownership ของ CORE-12 ตรวจ cart ที่กู้ (กฎข้อ 86) |
| โอน cart ตอน login | `transferCart()` → `POST /store/carts/:id/customer` (+ กฎข้อ 40) | ใช้ตามเดิม — กู้เฉพาะเมื่อหลังขั้นนี้ไม่มี cookie cart |
| return URL หลัง login | `RETURN_TO_PARAM` + `readReturnTo` + `loginPathForReturn` ของ CORE-14 (รับเฉพาะ `/buy/<items>`) | ขยาย allow-list (กฎข้อ 87) |
| วิธีส่งที่ใช้ได้กับสินค้าใน cart | `GET /store/shipping-options?cart_id=` คืน `shipping_profile_id` ของ option แต่**ไม่กรอง**ตาม shipping profile ของสินค้า (`list-shipping-options-for-cart` 2.22.1 กรองแค่ fulfillment set/ที่อยู่); Medusa ตรวจ profile ตอน complete cart (`validate-shipping`) | ขยาย — กรองฝั่ง storefront (กฎข้อ 89); ไม่ห่อ route ของ Medusa; join ของ group buy ไม่ผ่าน complete cart → ตรวจที่ backend ใน spec 04 GB-14 (Q-C4 = ข) |
| ปุ่มคัดลอก | `Button` (`@modules/common/components/ui`) + `navigator.clipboard`; `ShareLinkButton` (spec 05) และ `VoucherCopyButton` (spec 02) ทำซ้ำกัน | custom — component คัดลอกกลางตัวเดียว (ผู้ใช้จริง 3 ที่ — CLAUDE.md ข้อห้าม 3) |

### Data model / Workflows / API routes
none — ADR-019 ทางเลือก B (accepted) ใช้ `POST /store/customers/me` และ `GET /store/carts/:id` ของ Medusa

### Business rules
85. (CORE-28 — qa #222 O-2) `promotion-error` ใน `modules/checkout/components/discount-code` render **นอก** `isOpen` — error ของการใส่/ลบโค้ด (รวม `SIGN_IN_AGAIN_MESSAGE`) เห็นทันทีไม่ว่าช่องใส่โค้ดเปิดหรือปิด
    และยังอยู่หลังกดปิดช่อง; การใส่/ลบครั้งถัดไปที่สำเร็จล้าง error (พฤติกรรมเดิม); comment ใน `e2e/core-19c-delete-button-error.spec.ts` (~180–181) แก้ให้ตรงกฎข้อ 84 (action ไม่ถูกล้าง cookie)
86. (CORE-29 — รอบ 14b, **ADR-019 accepted ทางเลือก B — owner 2026-11-04**) กู้ตะกร้าหลัง login ใหม่:
    (a) ทุกจุดที่ตั้ง cookie `_medusa_cart_id` เป็น cart ใหม่ (`getOrSetCart` ใน `lib/data/cart.ts`, `activateCart` ใน `lib/util/server-cart.ts`, `app/api/payment-return/route.ts`) บันทึก
      `metadata.active_cart_id = <cart id>` ของ customer ผ่าน `sdk.store.customer.update` จาก helper เดียวใน `lib/data/` — เขียนไม่สำเร็จ → log แล้วไปต่อ (การสร้าง cart ไม่ล้ม);
      cart ของ group buy ไม่ถูกตั้งเป็น cookie (spec 04 กฎข้อ 14c) จึงไม่ถูกบันทึก
    (b) `completeLogin` หลัง `transferCart()`: ถ้า**ไม่มี** cookie `_medusa_cart_id` (ไม่มีมาแต่แรก หรือถูกทิ้งเพราะ 404 ตามกฎข้อ 40) → อ่าน `metadata.active_cart_id` → `GET /store/carts/:id` ด้วย token ใหม่
      → 200 และ `completed_at` null → `setCartId` + revalidate tag `carts`; ไม่มีค่า / 404 (ไม่ใช่ของตัวเอง — CORE-12) / complete แล้ว / error อื่น → ไม่ตั้ง cookie และ login สำเร็จตามเดิม
    (c) มี cookie cart อยู่แล้วหลัง `transferCart()` → ไม่แตะ (ไม่ทับ ไม่ merge)
    (d) ไม่แก้กฎข้อ 84 / AC-43 (GET ที่ไม่มี JWT ยังล้าง cookie ค้าง)
    (e) ส่งเฉพาะ key `active_cart_id` — `MedusaInternalService.update` ของ v2.22.1 (`packages/core/utils/src/modules-sdk/medusa-internal-service.ts`) merge `metadata` ด้วย
      `mergeMetadata(entity.metadata ?? {}, update.metadata)` อยู่แล้ว (ตรวจ source โดย review #240) key อื่นของ customer จึงไม่หาย — ไม่ต้องอ่าน-แล้ว-merge เองฝั่ง storefront; test ยืนยัน (AC-122)
87. (CORE-30 — qa #239 AC-48, #238 AC-47) ลูกค้าที่ยังไม่ login กด `group-join-button` (หน้ากลุ่ม) หรือ `group-create-team-button` (การ์ดหน้าแรก) → ไป `loginPathForReturn(<cc>, <path ของหน้านั้น>)`
    และหลัง login สำเร็จ redirect กลับ path นั้น: `readReturnTo` รับเพิ่มเฉพาะ `^/[a-z]{2}/g/[A-Za-z0-9_-]+$` (หน้ากลุ่ม) และ `^/[a-z]{2}$` (หน้าแรก) นอกเหนือจาก `/buy/<items>` เดิม —
    ค่าอื่น (URL เต็ม, `//`, `\`, `..`, path อื่น) → `null` แล้วทำตามเดิม (`/account`); ข้อ "มี query → `null`" ใช้กับ **path ใหม่สองแบบนี้เท่านั้น** (`/th/g/abc?x=1`, `/th?x=1` → `null`)
    — `/buy/<items>` เดิมยังรับ query ได้ตาม CORE-14 และคงพฤติกรรมเดิม (สร้าง cart แล้วไป checkout); หลังกลับ**ไม่** join/สร้างทีมให้อัตโนมัติ
    (ลูกค้ากดเอง — ไม่ยิง POST แทนลูกค้า); ฟอร์ม no-JS ใช้ hidden input เดิมของ `PendingAddToCartFields`
88. (CORE-31 — review 2026-11-04) ปุ่มคัดลอกของ storefront ใช้ component กลาง `modules/common/components/copy-button` — `navigator.clipboard.writeText` อยู่ไฟล์เดียวใต้ `src/modules`:
    props = ข้อความที่คัดลอก, label, ข้อความสถานะสำเร็จ, test id ของปุ่ม/สถานะ; กันกดซ้ำระหว่างทำงาน; ล้ม → สถานะ "คัดลอกไม่สำเร็จ" พร้อมข้อความให้คัดลอกเอง; `ShareLinkButton`
    ใช้ component นี้ในทางที่ไม่มี Web Share (แปลง URL relative เป็น absolute ก่อนส่งเหมือนเดิม); `VoucherCopyButton` ใช้ component นี้ (หรือถูกแทน) โดยคง `data-testid="voucher-copy-button"`
    และข้อความเดิม — e2e เดิมของ EV-7b, AF-8a/8b, GB-7a1 ไม่ต้องแก้ locator
89. (CORE-32 — qa #238 ข้อสังเกต 1, D1) option วิธีส่งที่แสดงที่ checkout (`modules/checkout/templates/checkout-form` → `shipping`) และหน้ากลุ่ม (`prepareGroupCart` ใน `lib/data/group-join.ts`)
    ผ่าน helper เดียว `lib/util/shipping-options.ts`: (a) ถ้า Store API คืน shipping profile ของสินค้าใน line (เช่น `items.product.shipping_profile.id` — builder ตรวจว่า 2.22.1 อนุญาต field ใด)
    แสดงเฉพาะ option ที่ `shipping_profile_id` อยู่ใน profile ของ line ที่ `requires_shipping = true`; (b) ถ้า Store API ไม่คืน profile ของสินค้า → cart ที่มี line `requires_shipping = true`
    ซ่อน option ที่ `type.code === "digital-delivery"` (ตัวระบุเดียวกับ spec 02 กฎข้อ 8 — ไม่ใช้ชื่อ) — ระบุใน PR ว่าใช้ทาง (a) หรือ (b); (c) cart ที่ทุก line `requires_shipping = false`
    ทำตาม EV-7c เดิม (ข้ามขั้น delivery — ไม่แตะ); (d) กรองแล้วไม่เหลือ option → ข้อความไม่มีวิธีส่งเดิมของแต่ละหน้า; CORE-32 แก้ storefront อย่างเดียว —
    ด่านฝั่ง backend ของ join (Q-C4 = ข) อยู่ที่ **spec 04 GB-14 กฎข้อ 35 / AC-54** (ทำขนานกันได้; checkout ปกติ Medusa ตรวจตอน complete อยู่แล้ว)
    **หมายเหตุ (รอบ 17, CORE-32 #243)**: builder ใช้ทาง **(b)** เพราะ Store API 2.22.1 ไม่คืน shipping profile ของสินค้าใน line → ตอนนี้กรองได้**เฉพาะ** option `type.code = "digital-delivery"`;
    ถ้าร้านเพิ่ม shipping profile อื่น (เช่น สินค้าชิ้นใหญ่/ของสด) ต้องทบทวนกฎนี้ — ทาง (a) ต้องมี route ของเราเองที่คืน profile ของ line (เขียน ADR ก่อน เพราะเป็นการห่อข้อมูลที่ Medusa ไม่เปิดใน Store API)
90. (CORE-28b — รอบ 16b, session หลัก 2026-11-04; test-only) comment ใน `e2e/core-14g-action-stale-jwt.spec.ts` (~125) ที่ว่า "promotion-error แสดงเฉพาะเมื่อเปิดช่องใส่โค้ด" ไม่จริงหลังกฎข้อ 85 (CORE-28 #241)
    → แก้ comment ให้บอกเหตุผลจริงของการเปิดช่อง (ขั้น (3) ต้องใช้ `discount-input`) โดยไม่เปลี่ยนขั้นตอน/assertion ของ test; แยกจาก CORE-28 เพราะ PR #241 เปิดแล้ว

### Acceptance criteria (follow-up รอบ 16)
- AC-121 (CORE-28, กฎข้อ 85) unit (Vitest + jsdom, `src/core-28-promotion-error.test.ts`): Given cart มีโค้ด 1 ตัว ช่องใส่โค้ด**ปิด** (ไม่กด `add-discount-button`) และ `applyPromotions` mock คืน
  `{ error: "unauthorized" }` When กด `remove-discount-button` Then `promotion-error` มีข้อความเท่ากับ `SIGN_IN_AGAIN_MESSAGE` (import constant) โดยไม่ต้องเปิดช่อง; Given เปิดช่องแล้วใส่โค้ดที่ใช้ไม่ได้
  (mock คืน `codes` ที่ไม่มีโค้ดนั้น) When กด `add-discount-button` เพื่อปิดช่อง Then `promotion-error` ยังมีข้อความ; ลบโค้ดสำเร็จ → `promotion-error` ว่าง; test ต้อง fail กับโค้ดก่อนแก้ (แนบผลใน PR);
  grep: `e2e/core-19c-delete-button-error.spec.ts` ไม่มีวลี "ก่อนถึง action"
- AC-122 (CORE-29, กฎข้อ 86; ADR-019 accepted owner 2026-11-04) e2e (`e2e/core-29-restore-cart.spec.ts`): Given customer A login และมี cart C (เพิ่มสินค้า 1 line ผ่าน PDP) When ลบ cookie `_medusa_jwt` แล้วเปิด `/th/cart`
  (cookie `_medusa_cart_id` ถูกล้างตาม AC-43) แล้ว login ใหม่ผ่านฟอร์ม Then cookie `_medusa_cart_id = C`, `/th/cart` มีแถวสินค้าเดิม (`data-testid` ของแถว) และ `nav-cart-link` มีจำนวนเดิม;
  Given C ถูก complete แล้ว (ผ่าน API ด้วย manual payment) When ลบ JWT แล้ว login ใหม่ Then ไม่มี cookie `_medusa_cart_id`; Given `metadata.active_cart_id` ของ A ถูกตั้ง (ผ่าน API) เป็น cart ของ B
  When A login Then login สำเร็จ ไม่มี cookie cart และ cart ของ B ยังมี `customer_id = B`; Given browser มี cookie cart D ของ A อยู่แล้วตอน login Then cookie ยังเป็น D;
  unit (Vitest, mock sdk): สร้าง cart ใหม่ผ่าน `getOrSetCart`/`activateCart`/payment-return → `customer.update` ถูกเรียกด้วย `{ metadata: { active_cart_id: <id> } }` 1 ครั้ง; `customer.update` reject →
  การสร้าง cart ยังสำเร็จ; `prepareGroupCart` ไม่เรียก `customer.update`; e2e/อ่าน API: key อื่นใน `metadata` ของ customer (ตั้งไว้ก่อน test) ยังอยู่หลังบันทึก (กฎข้อ 86e)
- AC-123 (CORE-30, กฎข้อ 87) unit (`lib/util/login-return.test.ts`): `readReturnTo` รับ `/th/g/abc_D-1`, `/th`, `/buy/<items>` (เคสเดิม); คืน `null` สำหรับ `https://evil.example/th`, `//evil.example`,
  `/th/g/../account`, `/th/g/a/b`, `/th/account`, `/th/g/abc?x=1`, `\evil`; e2e (`e2e/core-30-login-return.spec.ts`): Given ไม่ login When เปิด `/th/g/<pool token>` แล้วกด `group-join-button`
  Then URL เป็นหน้า login ที่มี `return_to=/th/g/<token>`; login ผ่านฟอร์ม → URL เป็น `/th/g/<token>` และไม่มี membership ใหม่ (อ่านผ่าน admin API); เหมือนกันสำหรับ `group-create-team-button` บน `/th` →
  กลับ `/th` และจำนวนทีมของแคมเปญไม่เพิ่ม; แก้ `return_to` เป็น `https://evil.example` แล้ว login → URL เป็น `/th/account`; AC-41 (`/buy`) ยังผ่าน
- AC-124 (CORE-31, กฎข้อ 88) grep: `navigator.clipboard.writeText` อยู่ในไฟล์เดียวใต้ `apps/storefront/src/modules` (`common/components/copy-button`); unit (Vitest + jsdom): คลิกสองครั้งใน `act()` เดียว →
  `writeText` ถูกเรียก 1 ครั้ง; resolve → สถานะตาม prop; reject → ข้อความล้มที่มีข้อความให้คัดลอกเอง; `ShareLinkButton` (ไม่มี `navigator.share`) คัดลอก URL แบบ absolute;
  e2e เดิมผ่านโดยไม่แก้ locator: EV-7b (`voucher-copy-button`), AF-8a/8b (Profile/Products), GB-7a1 (`group-share-copy`, `group-share-copy-status`)
- AC-125 (CORE-32, กฎข้อ 89) unit (`lib/util/shipping-options.test.ts`): Standard (profile Default) + Digital delivery (profile Digital, `type.code = "digital-delivery"`) กับ cart ที่มี line `requires_shipping = true`
  ของสินค้า profile Default → เหลือ Standard; ไม่มี option ที่ตรง → `[]`; e2e: Given cart ของ A มี t-shirt (seed) When เปิดขั้น delivery ของ `/th/checkout` Then ไม่มี option ที่ id = Digital delivery
  (id จาก `GET /store/shipping-options?cart_id=` ด้วย `type.code` — ไม่ match ข้อความ) และมี Standard; หน้ากลุ่ม: หลังกด `group-shipping-load` `group-shipping-option` ไม่มี `<option value=<id ของ Digital delivery>>`;
  spec 02 AC-37 (cart voucher ล้วน) และ spec 04 AC-28 ยังผ่าน
- AC-126 (CORE-28b, กฎข้อ 90) grep: `apps/storefront/e2e/core-14g-action-stale-jwt.spec.ts` ไม่มีวลี "แสดงเฉพาะเมื่อเปิดช่อง"; `git diff` ของไฟล์นั้นเปลี่ยนเฉพาะบรรทัด comment
  (ไม่มีบรรทัดโค้ดที่เพิ่ม/ลบนอกจาก `//`); e2e core-14g ยังผ่าน (CI)

### แผนการทดสอบ (follow-up รอบ 16)
| ระดับ | AC |
|------|----|
| unit (Vitest) | AC-121, AC-122 (helper บันทึก/กู้ — mock sdk), AC-123 (allow-list), AC-124, AC-125 |
| e2e | AC-122, AC-123, AC-124 (regression ของ e2e เดิม), AC-125, AC-126 (regression core-14g) |
| grep | AC-126 |

### Tasks (follow-up รอบ 16)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-28 | (storefront เล็ก ~60 LOC, qa #222 O-2) `promotion-error` นอก `isOpen` + แก้ comment ค้างใน e2e core-19c (กฎข้อ 85) — ไฟล์: `modules/checkout/components/discount-code/index.tsx`, `src/core-28-promotion-error.test.ts` ใหม่, `e2e/core-19c-delete-button-error.spec.ts` (comment) — ☑ #241 | AC-121 | CORE-14g ☑ (#234 merge แล้ว 2026-11-04 — e2e ของ AC-120 ลบ/ใส่โค้ดตอน JWT หาย + comment อ้างพฤติกรรมของ #234) — **เริ่มได้** |
| CORE-29 | (storefront ~180 LOC, รอบ 14b) บันทึก `metadata.active_cart_id` เมื่อตั้ง cookie cart ใหม่ + กู้ตอน login เมื่อไม่มี cookie cart (กฎข้อ 86) — ไฟล์: helper ใหม่ใน `lib/data/` (+ unit), `lib/data/cart.ts`, `lib/util/server-cart.ts`, `app/api/payment-return/route.ts`, `lib/data/customer.ts` (`completeLogin`), `e2e/core-29-restore-cart.spec.ts` ใหม่ — ☑ #263 (train #268) | AC-122 | CORE-14g ☑ (#234 — พฤติกรรม cookie เมื่อ JWT หาย), **CORE-30** (ชน `lib/data/customer.ts` — ทำทีละตัว CORE-30 ก่อน) |
| CORE-30 | (storefront เล็ก ~150 LOC, qa #239/#238) return URL ของหน้ากลุ่ม/หน้าแรกหลัง login (กฎข้อ 87) — ไฟล์: `lib/util/login-return.ts` (+ test), `lib/data/customer.ts` (`continueAfterAuth`), `modules/group-buy/components/group-page/group-join.tsx`, `modules/home/components/campaigns/create-team-button.tsx`, `e2e/core-30-login-return.spec.ts` ใหม่ — ☑ #258 | AC-123 | none — **เริ่มได้** (GB-7a2 ☑ #238, GB-7c ☑ #239); ชน `group-join.tsx` กับ GB-12 (spec 04) ตัวที่ merge ทีหลัง rebase |
| CORE-31 | (storefront เล็ก ~120 LOC, review 2026-11-04) component คัดลอกกลาง ใช้โดย `ShareLinkButton` และ `VoucherCopyButton` (กฎข้อ 88) — ไฟล์: `modules/common/components/copy-button/index.tsx` ใหม่ (+ unit), `modules/common/components/share-link-button/index.tsx`, `modules/evoucher/components/voucher-copy-button/index.tsx` — ☑ #254 | AC-124 | none — **เริ่มได้** (∥ ทุกตัว) |
| CORE-32 | (storefront ~150 LOC, qa #238) กรอง option วิธีส่งตาม shipping profile ที่ checkout และหน้ากลุ่ม (กฎข้อ 89) — ไฟล์: `lib/util/shipping-options.ts` ใหม่ (+ unit), `modules/checkout/templates/checkout-form/index.tsx` (หรือ `components/shipping`), `lib/data/group-join.ts`, `lib/data/cart.ts` (field ของ line ถ้าใช้ทาง (a)), e2e — ☑ #243 (ทาง (b)) | AC-125 | none — **เริ่มได้** (∥; `lib/data/group-join.ts` ไม่มี task อื่นแตะ; ∥ GB-14 ของ spec 04 — ไม่มีไฟล์ชน: GB-14 แตะ `lib/util/group-join-error.ts` ไม่แตะ `group-join.ts`/`shipping-options.ts`) |
| CORE-28b | (test-only เล็ก ~2 LOC, รอบ 16b) แก้ comment ค้างใน e2e core-14g หลังกฎข้อ 85 (กฎข้อ 90) — ไฟล์: `e2e/core-14g-action-stale-jwt.spec.ts` — ☑ #251 | AC-126 | **CORE-28 (#241) merge** (∥ ทุกตัว; ไฟล์นี้ไม่มี task อื่นแตะ) |
(รอบ 16 สถานะ) CORE-30 ∥ CORE-31 ∥ CORE-32 เริ่มได้; CORE-28 ← #234; CORE-29 ← ADR-019 + #234 + CORE-30; ไม่บล็อก release ใด แต่ CORE-30/CORE-32 ควรมีก่อน release v0.5.0 (flow ของ group buy)
(รอบ 16b สถานะ 2026-11-04) #234 ☑ และ ADR-019 accepted → CORE-28 เริ่มได้ (◐ รอบ 17), CORE-32 ◐ รอบ 17; CORE-29 ← CORE-30 เท่านั้น; CORE-30 ∥ CORE-31 เริ่มได้
(รอบ 17 สถานะ 2026-11-04) CORE-28 ◐ #241, CORE-32 ◐ #243 → follow-up CORE-33 (← #243), CORE-34 (← #241) ในหัวข้อ "Follow-up รอบ 17"

### Open questions (รอบ 16)
- ~~**Q-C3**~~ **ตัดสินแล้ว (owner 2026-11-04) = (B)** → ADR-019 accepted: จำ id ตะกร้าหลักใน `customer.metadata` ด้วย API ของ Medusa ไม่มี backend ใหม่ (กฎข้อ 86, CORE-29) —
  คำถามเดิม: (A) route ใหม่ `GET /store/customers/me/carts/latest` + marker ของ cart กลุ่ม; (B) **[แนะนำ]** `customer.metadata`; (C) ไม่กู้
- ~~**Q-C4**~~ **ตัดสินแล้ว (owner 2026-11-04) = (ข)** → ตรวจฝั่ง backend ตอน join ใน `validateJoinStep` ว่า shipping method ของ cart ครอบ shipping profile ของทุก line ที่ `requires_shipping = true`
  ไม่ครอบ → 400 code `GB_SHIPPING_PROFILE_NOT_COVERED` — **spec 04 GB-14 (กฎข้อ 35, AC-54)**; CORE-32 ยังเป็น storefront อย่างเดียว — คำถามเดิม: (ก) ไม่ใน v1 (storefront กรองอย่างเดียว);
  (ข) ตรวจใน `validateJoinStep` → 400 code ใหม่

## Follow-up รอบ 17 จาก review/qa (2026-11-04 — owner อนุมัติเปิด task)
ที่มา: qa CORE-32 (#243) O-1, O-2; qa CORE-28 (#241) O-3; review/qa test hygiene ของ #243 — ตรวจโค้ดบน develop `e45b046`:
`removePromotionCode` ใน `modules/checkout/components/discount-code/index.tsx` (~43–53) ไม่เรียก `setErrorMessage("")` ก่อนส่ง ต่างจาก `addPromotionCode` (~56) — ยังจริง;
ปุ่ม `submit-delivery-option-button` ใน `modules/checkout/components/shipping/index.tsx` (~385) disabled ด้วย `!cart.shipping_methods?.[0]` และค่าเริ่มของ radio มาจาก
`cart.shipping_methods?.at(-1)?.shipping_option_id` (~63–64) โดยไม่เทียบกับรายการที่แสดง — ยังจริง; การกรองและ `delivery-options-container` ที่ว่างอยู่ในโค้ดของ #243 (ยังไม่ merge — ยืนยันจากรายงาน qa)
Out of scope: แปลง error 400 ของ `completeCartWorkflow` (`validate-shipping`) เป็นข้อความไทยเมื่อลูกค้าข้ามขั้น delivery ด้วย URL `?step=payment` (ด่านจริงคือ backend ของ Medusa — ยอมรับใน v1),
ทาง (a) ของกฎข้อ 89 — **(รอบ 18)** กรณี cart ค้าง method ที่ถูกกรองออกแล้วเข้า `?step=payment`/`?step=review` ตรงๆ ถูกยกขึ้นเป็น CORE-35 (กฎข้อ 93) เพราะ
`deliveryStepDone` ยังนับ method ค้างเป็น "เสร็จ"; ข้อยอมรับเดิมเหลือเฉพาะ race ที่ cart เปลี่ยนระหว่างเปิดหน้า (backend ตอบ 400 ตามเดิม)

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa / ไลบรารีมีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| วิธีส่งที่ cart เลือกไว้ | `cart.shipping_methods[].shipping_option_id` ของ Store API | ใช้ตามเดิม — storefront เทียบกับรายการที่กรองแล้วของกฎข้อ 89 (กฎข้อ 91) |
| ตรวจวิธีส่งตอน complete | `validateShippingStep` ใน `completeCartWorkflow` (400 เมื่อไม่ครอบ profile) | ใช้ตามเดิม — ไม่แก้ |
| แทนวิธีส่งเดิมของ cart | `POST /store/carts/:id/shipping-methods` (`setShippingMethod` เดิม) | ใช้ตามเดิม |

### Data model / Workflows / API routes
none

### Business rules
91. (CORE-33 — qa #243 O-1, O-2) ขั้น delivery ของ checkout (`modules/checkout/components/shipping`) หลังกรองตามกฎข้อ 89:
    (a) กรองแล้วไม่เหลือ option (ทั้งส่งและรับเอง) → แสดงข้อความไทยใน `delivery-options-empty` (เช่น "ไม่มีวิธีจัดส่งสำหรับสินค้าในตะกร้านี้ กรุณาติดต่อร้าน" — ปรับถ้อยคำได้ใน PR)
      แทน `delivery-options-container` ที่ว่าง และ `submit-delivery-option-button` disabled;
    (b) วิธีส่งที่ถือว่า "เลือกแล้ว" = `shipping_option_id` ของ `cart.shipping_methods` ตัวล่าสุด**ที่อยู่ในรายการที่กรองแล้ว**เท่านั้น — cart เก่าที่ค้าง method ที่ถูกกรองออก (เช่น Digital delivery
      บน cart ที่ต้องจัดส่ง) → ไม่มี radio ถูกเลือก, `submit-delivery-option-button` disabled จนลูกค้าเลือก option ในรายการ, และสรุปตอนขั้นปิดไม่แสดงชื่อ method นั้น;
      เงื่อนไขอยู่ใน helper pure ใน `lib/util/shipping-options.ts` เดิม (+ unit) ไม่กระจาย `cart.shipping_methods?.[0]` หลายที่
    (c) cart ที่ทุก line `requires_shipping = false` ทำตาม EV-7c เดิม (ไม่แตะ)
    (d) e2e `e2e/core-32-shipping-profile-filter.spec.ts` (~70 ใน #243 — บล็อกที่เรียก `cartReadyForPayment` ซึ่ง default เป็น variant ของ **t-shirt**) มี comment อธิบายเหตุผลจริง:
      หน้ากลุ่ม join ด้วย cart ใหม่ที่ test เข้าถึง id ไม่ได้ จึงสร้าง cart t-shirt อีกใบเพื่ออ่าน id ของ option Digital delivery จาก `GET /store/shipping-options?cart_id=` (ใช้แทนกันได้เพราะ seed
      ให้ id ของ option เดียวกันกับทุก cart) และบล็อกนี้ยัง assert ว่า Store API **คืน** Digital delivery ให้ cart t-shirt (พิสูจน์ว่าการซ่อนมาจากการกรองของ storefront) — แก้ comment เท่านั้น
92. (CORE-34 — qa #241 O-3) `removePromotionCode` ใน `modules/checkout/components/discount-code` ล้าง error เดิม (`setErrorMessage("")`) ก่อนเรียก `submitPromotionCodes` แบบเดียวกับ `addPromotionCode`
    — error ของรอบก่อนไม่ค้างระหว่างลบรอบใหม่; ผลของการลบ (สำเร็จ/ล้ม) ตั้ง error ตามเดิมของกฎข้อ 85

### Acceptance criteria (follow-up รอบ 17)
- AC-127 (CORE-33, กฎข้อ 91) unit (`lib/util/shipping-options.test.ts`): helper "option ที่เลือกแล้ว" — method ล่าสุดเป็น Standard ที่อยู่ในรายการ → id ของ Standard; method ล่าสุดเป็น Digital delivery ที่ไม่อยู่ในรายการ
  (และไม่มี method อื่นในรายการ) → `null`; ไม่มี method → `null`; e2e: Given cart ของ A มี t-shirt (seed) และตั้ง shipping method เป็น Digital delivery ผ่าน `POST /store/carts/:id/shipping-methods`
  ด้วย token ของ A (id ของ option จาก `type.code` — ไม่ match ข้อความ) When เปิดขั้น delivery ของ `/th/checkout` Then ไม่มี radio ใน `delivery-options-container` ที่ `checked`/`aria-checked="true"`
  และ `submit-delivery-option-button` disabled; When เลือก Standard Then ปุ่ม enabled และ `GET /store/carts/:id` มี `shipping_methods` ที่ `shipping_option_id` = Standard;
  component test (Vitest + jsdom): Given component ขั้น delivery ได้รายการ option (prop เดิมของ starter) เฉพาะ Digital delivery กับ cart ที่มี line ต้องจัดส่ง (รายการที่กรองแล้วว่าง) Then มี `delivery-options-empty` ข้อความตรง regex อักษรไทย,
  ไม่มี radio และปุ่ม disabled; component test: Given ขั้น delivery **ปิด** และ `cart.shipping_methods` ตัวล่าสุดเป็น method ที่ถูกกรองออก (fixture `name = "Digital delivery"`, option ไม่อยู่ในรายการที่กรองแล้ว)
  Then ส่วนสรุปของขั้น delivery ไม่มีข้อความ `name` ของ method นั้น (เทียบกับค่าใน fixture ไม่ใช่ข้อความ UI) และไม่ render ราคาของ method นั้น (กฎข้อ 91b);
  grep: `core-32-shipping-profile-filter.spec.ts` มี comment ภาษาไทยในบล็อกที่สร้าง cart ใบที่สอง; AC-125 และ spec 02 AC-37 ยังผ่าน
- AC-128 (CORE-34, กฎข้อ 92) unit (Vitest + jsdom, ต่อจาก `src/core-28-promotion-error.test.ts` หรือไฟล์ใหม่): Given `promotion-error` มีข้อความจากการใส่โค้ดที่ล้ม และ `applyPromotions` mock
  คืน promise ที่ยังไม่ resolve When กด `remove-discount-button` Then ก่อน resolve ไม่มี element `promotion-error` (`ErrorMessage` คืน `null` เมื่อไม่มีข้อความ); resolve สำเร็จ → ยังไม่มี element `promotion-error`; resolve `{ error: "unauthorized" }` → `SIGN_IN_AGAIN_MESSAGE`;
  test ต้อง fail กับโค้ดก่อนแก้ (แนบผลใน PR); AC-121 ยังผ่าน

### แผนการทดสอบ (follow-up รอบ 17)
| ระดับ | AC |
|------|----|
| unit (Vitest) | AC-127 (helper), AC-128 |
| e2e / component | AC-127 |
| grep | AC-127 (comment) |

### Tasks (follow-up รอบ 17)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-33 | (storefront เล็ก ~100 LOC, qa #243 O-1/O-2) ข้อความเมื่อไม่มีวิธีส่งหลังกรอง + method ค้างที่ถูกกรองออกถือว่ายังไม่เลือก + comment e2e core-32 (กฎข้อ 91) — ไฟล์: `lib/util/shipping-options.ts` (+ test), `modules/checkout/components/shipping/index.tsx`, `e2e/core-32-shipping-profile-filter.spec.ts` (comment + เคสใหม่) — ☑ #255 | AC-127 | **CORE-32 (#243) merge** (แก้โค้ด/e2e ที่ #243 เพิ่ม); ∥ CORE-34 (คนละไฟล์) |
| CORE-34 | (storefront เล็ก ~30 LOC, qa #241 O-3) `removePromotionCode` ล้าง error ก่อนส่ง (กฎข้อ 92) — ไฟล์: `modules/checkout/components/discount-code/index.tsx`, unit — ☑ #252 | AC-128 | **CORE-28 (#241) merge** (ไฟล์เดียวกัน); ∥ CORE-28b, CORE-33 |
(รอบ 17) ไม่บล็อก release ใด; CORE-33 ควรมีก่อน release v0.5.0 ถ้า CORE-32 อยู่ใน release นั้น (cart เก่าที่ค้าง Digital delivery)
(รอบ 18 สถานะ 2026-11-04) merge แล้วผ่าน merge train: CORE-28 ☑ #241, CORE-32 ☑ #243 (train #248); CORE-28b ☑ #251, CORE-34 ☑ #252, CORE-31 ☑ #254, CORE-33 ☑ #255 (train #256);
CORE-30 ☑ #258 (train #260); CORE-29 ☑ #263 (train #268)

### Open questions (รอบ 17)
none

## Follow-up รอบ 18 จาก review/qa (2026-11-04 — session หลักส่ง follow-up ของ #252/#254/#255/#258)
ที่มา: review #255, qa #252 (`docs/evidence/core/CORE-34/REPORT.md` O-2), qa/review #254 (`CORE-31/REPORT.md` ข้อสังเกต 2–4), qa #255 O-2 (`CORE-33/REPORT.md`),
qa #258 O-3 (`CORE-30/REPORT.md`, ภาพ qa-04), review #258 nits — ตรวจโค้ดบน develop `2c0fea6`:
`lib/util/digital-checkout.ts` `deliveryStepDone` = `isDigitalOnlyCart || shipping_methods.length > 0` (บรรทัด 16–18) ใช้ใน `payment/index.tsx` (~88), `review/index.tsx` (~22),
`payment-button/index.tsx` (~31) — ยังจริง; `discount-code/index.tsx` ปุ่ม `remove-discount-button` (~167–182) ไม่มีสถานะกำลังลบ และ `submitPromotionCodes` ใช้ `PROMOTION_FAILED` ร่วมกันทั้งใส่/ลบ — ยังจริง;
`common/components/copy-button/index.tsx` ข้อความล้ม `คัดลอกไม่สำเร็จ กรุณาคัดลอกเอง: ${value}` ใน `<span class="... break-all">` เดียว (~52, ~75) และ `share` ที่ throw (ไม่ใช่ `AbortError`) ไปตกที่ข้อความเดียวกันโดยไม่ลองคัดลอก — ยังจริง;
`voucher-card/index.tsx` วาง `VoucherCopyButton` (ปุ่ม + สถานะใน `flex-col`) ในแถว `flex-wrap items-center` (~20–26) → สถานะที่ขึ้นใต้ปุ่มดันปุ่มขึ้นและแถวสูงขึ้น — ยังจริง;
`VoucherCopyButton` ส่ง `size="small"` แล้ว (#254) — **ไม่ต้องทำ**; `checkout/components/addresses/index.tsx` สรุปที่อยู่ 3 คอลัมน์ `w-1/3` แถวเดียวทุกความกว้าง (~153–226) — ยังจริง;
`common/components/input/index.tsx` label ลอย `top-3.5` + `-translate-y-3` (globals.css ~20–28) กับ input `h-12 pt-5` — ภาพ qa-04 label ทับค่าที่กรอก — ยังจริง (ต้นเหตุเชิงเรขาคณิตให้ builder ยืนยัน);
`lib/util/login-return.ts` `GROUP_PAGE_RE` = `[A-Za-z0-9_-]+` ไม่จำกัดความยาว, `login-return.test.ts` ไม่มีเคส `/\evil`, `%2F%2Fevil`, `/th/g/abc\n`, `continueAfterAuth` ใน `lib/data/customer.ts` (~214–245)
ไม่มี comment ลำดับเมื่อมีทั้ง `return_to` และ `add_variant` — ยังจริง
Out of scope: แสดงค่าส่งในสรุปตะกร้าของ method ค้าง (qa #255 O-3 — ฿0 ของ Digital delivery; หายเองเมื่อลูกค้าเลือกวิธีส่งใหม่ — ยอมรับใน v1), เปลี่ยนป้ายปุ่มคัดลอกกลับเป็นสถานะบนปุ่ม (qa #254 ข้อ 1 — reviewer ยอมรับแล้ว)

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa / ไลบรารีมีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| ตรวจวิธีส่งตอน complete | `validateShippingStep` ใน `completeCartWorkflow` | ใช้ตามเดิม — CORE-35 แค่ไม่ให้ UI พาไปถึงขั้นนั้นด้วย method ค้าง |
| รายการ option ของ cart | `GET /store/shipping-options?cart_id=` (`listCartShippingMethods` เดิม) + helper `shippingOptionsForCart`/`selectedShippingOptionId` (CORE-32/33) | ใช้ตามเดิม — ไม่ยิง API เพิ่ม (checkout-form ดึงอยู่แล้ว) |
| สถานะปุ่มกำลังทำงาน | `Button` ของ `@medusajs/ui` (re-export ที่ `@modules/common/components/ui`) prop `isLoading` | ใช้ตามเดิม (ปุ่มลบโค้ด, CopyButton) |
| label ของ input | `Input` ของ starter (`modules/common/components/input`) | ขยาย — แก้ CSS ใน component เดิม ไม่สร้าง input ใหม่ |

### Data model / Workflows / API routes
none

### Business rules
93. (CORE-35 — review #255) ขั้น delivery ของ checkout ถือว่า "เสร็จ" = cart digital-only (EV-7c) **หรือ** `selectedShippingOptionId(cart, <รายการที่กรองแล้วของกฎข้อ 89>) !== null` (helper เดียวกับกฎข้อ 91b)
    — ไม่ใช่แค่ `shipping_methods.length > 0`: (a) `deliveryStepDone` รับรายการที่กรองแล้วเป็น argument (ไม่มี argument = พฤติกรรมเดิม สำหรับ `checkoutStep` ของหน้าตะกร้าที่ไม่มีรายการ option);
    (b) `checkout-form` (server) คำนวณครั้งเดียวจาก `listCartShippingMethods` ที่ดึงอยู่แล้วแล้วส่งเป็น prop ให้ Payment/Review/PaymentButton — ไม่ยิง API เพิ่มฝั่ง client;
    (c) เปิด `/<cc>/checkout?step=payment` หรือ `?step=review` ตรงๆ ขณะขั้น delivery ยังไม่เสร็จ → พาไป `?step=delivery` (redirect ฝั่ง server หรือ `router.replace` — เลือกใน PR)
    และไม่มีทางกด `submit-order-button`; หน้าตะกร้า (`checkoutStep`) ไม่ต้องแก้ เพราะปลายทางตรวจซ้ำตามข้อ (c)
94. (CORE-36 — qa #252 O-2) ปุ่ม `remove-discount-button` ระหว่างลบ: disabled + แสดงสถานะกำลังทำงาน (spinner หรือ `aria-busy="true"`) และกันคลิกซ้อนใน tick เดียว (ref in-flight แบบ CORE-27);
    ลบล้มด้วยเหตุที่ไม่ใช่ auth → ข้อความไทยเฉพาะการลบ (เช่น "ลบโค้ดส่วนลดไม่สำเร็จ กรุณาลองอีกครั้ง" — ปรับถ้อยคำได้ใน PR แต่ต่างจาก `PROMOTION_FAILED`);
    auth ยังเป็น `SIGN_IN_AGAIN_MESSAGE` (กฎข้อ 85); การใส่โค้ดคงข้อความเดิม
95. (CORE-37 — qa/review #254) `CopyButton` กลาง (กฎข้อ 88): (a) คัดลอกล้ม → ข้อความนำ "คัดลอกไม่สำเร็จ กรุณาคัดลอกเอง" แยกจากค่าที่ให้คัดลอก — ค่าอยู่ใน element ของตัวเอง
    (`<statusTestId>-value`, `select-all`, ตัดบรรทัดแบบ `break-words`/`overflow-wrap:anywhere` ไม่ใช่ `break-all` ของทั้งประโยค); (b) `share` throw error ที่ไม่ใช่ `AbortError` → ลองคัดลอกด้วย clipboard ต่อ
    (สำเร็จ = ข้อความสำเร็จ, ล้ม = ข้อ (a)); (c) การ์ด voucher: แถวรหัสวางปุ่มคัดลอกไม่เยื้องเมื่อสถานะขึ้น — สถานะไม่ดันปุ่ม (เช่น แถว `items-start` หรือสถานะอยู่แถวของตัวเองใต้แถวรหัส)
96. (CORE-38 — qa #255 O-2, qa #258 O-3) layout ฟอร์ม/สรุปที่ 375px: (a) สรุปที่อยู่ของขั้น address (`shipping-address-summary`, `shipping-contact-summary`, `billing-address-summary` และคู่ digital-only)
    ที่ความกว้าง < 640px (`sm`) เรียงเป็นแนวตั้ง, ≥ 640px คงแถวเดียว; อีเมล/ข้อความยาวตัดบรรทัดในคอลัมน์ของตัวเอง (`break-words`/`overflow-wrap:anywhere`) ไม่ล้นทับคอลัมน์ข้าง;
    (b) `Input` ของ starter: label ที่ลอยแล้ว (มีค่าหรือ focus) ไม่ทับข้อความในช่อง — แก้ที่ `modules/common/components/input` / `globals.css` ที่เดียว (มีผลทุกฟอร์มที่ใช้ `Input`)
    — **(รอบ 19) ปิดโดยไม่แก้โค้ด**: qa #267 ยืนยันว่าภาพ qa-04 ของ #258 เป็นภาพที่ถ่ายกลาง transition 300ms ของ label (หลัง transition จบ label ไม่ทับค่า — ผ่าน AC-132 ส่วน label
      ที่ 375/639/640/1280 บนฟอร์ม register, login และที่อยู่ checkout) ดู `docs/evidence/core/CORE-38/REPORT.md` Observation 1; #267 แก้เฉพาะข้อ (a) (+ D-1 ข้อความยาวไม่มีช่องว่าง)
97. (CORE-39 — nit review #258; ไม่เปลี่ยนพฤติกรรมของ path ที่ถูกต้อง) (a) `GROUP_PAGE_RE` ใน `lib/util/login-return.ts` จำกัดความยาว token `{1,64}`;
    (b) comment ใน `continueAfterAuth` (`lib/data/customer.ts`) บอกลำดับเมื่อฟอร์มมีทั้ง `return_to` และ `add_variant` (`return_to` ที่ผ่าน allow-list มาก่อน — `add_variant` ถูกข้าม) ตามโค้ดจริงตอนแก้;
    (c) unit ถาวรใน `login-return.test.ts` ของเคสที่ qa #258 ลองมือ: `/\evil`, `/%2F%2Fevil`, `/th/g/abc\n`, token ยาว 65 ตัว → `null`; token ยาว 64 ตัว → คืนค่า

### Acceptance criteria (follow-up รอบ 18)
- AC-129 (CORE-35, กฎข้อ 93) unit (Vitest, ต่อจาก `src/ev-7c-digital-only-checkout.test.ts`): `deliveryStepDone(cart, options)` — cart ต้องจัดส่ง + method ล่าสุดเป็น Digital delivery ที่ไม่อยู่ใน `options` → `false`;
  method Standard อยู่ใน `options` → `true`; digital-only ไม่มี method → `true`; ไม่ส่ง `options` → ผลเท่าเดิม (`shipping_methods.length > 0`) — expectation เดิมของไฟล์ผ่านโดยไม่แก้;
  e2e (ต่อจาก `e2e/core-32-shipping-profile-filter.spec.ts` หรือไฟล์ใหม่ `e2e/core-35-*.spec.ts`): Given cart ของ A มี t-shirt + ที่อยู่ + shipping method = Digital delivery ตั้งผ่าน
  `POST /store/carts/:id/shipping-methods` ด้วย token ของ A (id จาก `type.code`) When เปิด `/th/checkout?step=payment` และ `/th/checkout?step=review` (แยกกัน)
  Then URL มี `step=delivery`, `submit-delivery-option-button` disabled, ไม่มี `submit-order-button` ที่ enabled และไม่มี request `POST /store/carts/<id>/complete` (นับด้วย `page.on("request")`);
  When เลือก Standard แล้วกด `submit-delivery-option-button` Then URL มี `step=payment` และขั้น payment เปิดอยู่ (ไม่ถูกพากลับ delivery); AC-127, AC-125 และ spec 02 AC-37 ยังผ่าน
- AC-130 (CORE-36, กฎข้อ 94) unit (Vitest + jsdom, ต่อจาก `src/core-28-promotion-error.test.ts`): `applyPromotions` mock คืน promise ที่ยังไม่ resolve When กด `remove-discount-button` สองครั้งใน `act()` เดียว
  Then `applyPromotions` ถูกเรียก 1 ครั้ง และปุ่ม `disabled` (และ `aria-busy="true"` ถ้าใช้) ก่อน resolve; resolve แล้วปุ่มกดได้อีก (ถ้าแถวยังอยู่); mock reject/คืน error ที่ไม่ใช่ `unauthorized` →
  `promotion-error` มีข้อความตรง regex อักษรไทยและ**ไม่เท่ากับ**ข้อความ fallback ของการใส่โค้ด (import หรือ export constant — ไม่ hard-code ซ้ำ); `{ error: "unauthorized" }` → `SIGN_IN_AGAIN_MESSAGE`;
  การใส่โค้ดที่ล้มยังได้ข้อความเดิม; AC-121, AC-128 ยังผ่าน
- AC-131 (CORE-37, กฎข้อ 95) unit (Vitest + jsdom, ต่อจาก `src/core-31-copy-button.test.ts`): `writeText` reject → มี element `<statusTestId>-value` ที่ `textContent` เท่ากับค่าที่ส่ง (เทียบ prop ไม่ hard-code)
  และข้อความนำตรง regex อักษรไทยอยู่นอก element นั้น; `share` reject `NotAllowedError` → `writeText` ถูกเรียก 1 ครั้งด้วยค่าเดิม และ resolve → สถานะสำเร็จ; `share` reject `AbortError` → `writeText` 0 ครั้ง สถานะว่าง (เดิม);
  e2e 375×812 (หน้า `/th/account/vouchers`, override `writeText` ให้ reject): ค่าใน `voucher-copy-status-value` อยู่ใน element เดียวที่ `getComputedStyle(...).wordBreak !== "break-all"`, `document.documentElement.scrollWidth ≤ 375`;
  e2e 1280: ตำแหน่ง y ของ `voucher-copy-button` ก่อน-หลังคลิก (สำเร็จ) ต่างกัน ≤ 1px และ y-center ของ `voucher-code` กับปุ่มต่างกัน < 5px; e2e เดิมของ AC-124 ผ่านโดยไม่แก้ locator
- AC-132 (CORE-38, กฎข้อ 96) e2e 375×812 (checkout ของ A ที่อีเมลยาว ≥ 40 ตัวไม่มีช่องว่าง, ใช้ที่อยู่เดียวกัน, หลังกด `submit-address-button`): bounding box ของ `shipping-contact-summary` และ
  `billing-address-summary` ไม่ซ้อนกัน (intersection = 0) และไม่ซ้อนกับ `shipping-address-summary`, ข้อความอีเมลอยู่ภายในกล่องของ `shipping-contact-summary`, `scrollWidth ≤ 375`; ที่ 1280 ทั้งสามกล่องมี top เท่ากัน (±2px);
  e2e 375 และ 1280 หน้า register (`/th/account` → สลับไปฟอร์มสมัคร) หลังกรอกทุกช่องแล้ว blur และรอ transition จบ: ทุก label ของ input ในฟอร์ม `getBoundingClientRect().bottom` ≤
  `input.getBoundingClientRect().top + parseFloat(getComputedStyle(input).paddingTop)` (label ไม่ลงไปในพื้นที่ข้อความ); เงื่อนไขเดียวกันผ่านสำหรับฟอร์ม login และฟอร์มที่อยู่ของ checkout ที่มีค่าเติม (regression);
  ภาพ evidence 375 ของ register และสรุปที่อยู่
- AC-133 (CORE-39, กฎข้อ 97) unit (`lib/util/login-return.test.ts`): `/\evil`, `/%2F%2Fevil`, `"/th/g/abc\n"`, `/th/g/<65 ตัว>` → `null`; `/th/g/<64 ตัว>` → คืนค่าเดิม; เคสเดิมทั้งหมดผ่านโดยไม่แก้ expectation;
  grep: `login-return.ts` มี `{1,64}`; `lib/data/customer.ts` มี comment ที่กล่าวถึงทั้ง `return_to` และ `add_variant` ใน `continueAfterAuth`; AC-123 (e2e) ยังผ่าน

### แผนการทดสอบ (follow-up รอบ 18)
| ระดับ | AC |
|------|----|
| unit (Vitest) | AC-129, AC-130, AC-131, AC-133 |
| e2e | AC-129, AC-131 (375/1280), AC-132 (375/1280 + regression ฟอร์ม login/ที่อยู่) |
| grep | AC-133 |

### Tasks (follow-up รอบ 18)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-35 | (storefront ~120 LOC, review #255) ขั้น delivery "เสร็จ" ใช้ option ที่เลือกในรายการที่กรองแล้ว + `?step=payment`/`review` ตรงๆ พากลับ delivery (กฎข้อ 93) — ไฟล์: `lib/util/digital-checkout.ts` (+ `src/ev-7c-digital-only-checkout.test.ts`), `modules/checkout/templates/checkout-form/index.tsx`, `modules/checkout/components/{payment,review,payment-button}/index.tsx`, e2e — ☑ #266 (train #270) | AC-129 | none — **เริ่มได้** (CORE-32/33 ☑); ∥ CORE-36..39 (คนละไฟล์); ชน `checkout-form` กับ CORE-4i/CORE-19f (spec ☐) ตัวที่ merge ทีหลัง rebase — **ควรก่อน release v0.5.0** (ลูกค้าเจอ 400 อังกฤษตอนจ่าย) |
| CORE-36 | (storefront เล็ก ~50 LOC, qa #252 O-2) ปุ่มลบโค้ดส่วนลดมีสถานะกำลังลบ + กันคลิกซ้อน + ข้อความล้มเฉพาะการลบ (กฎข้อ 94) — ไฟล์: `modules/checkout/components/discount-code/index.tsx`, `src/core-28-promotion-error.test.ts` — ☑ #264 (train #268) | AC-130 | none — **เริ่มได้** (CORE-28/34 ☑); ∥ ทุกตัว |
| CORE-37 | (storefront เล็ก ~80 LOC, qa/review #254) ข้อความล้มของปุ่มคัดลอกแยกค่า + Web Share ล้มแล้วลองคัดลอก + แถวรหัสของการ์ด voucher ไม่เยื้อง (กฎข้อ 95) — ไฟล์: `modules/common/components/copy-button/index.tsx`, `src/core-31-copy-button.test.ts`, `modules/evoucher/components/voucher-card/index.tsx`, e2e — ☑ #265 (train #268) | AC-131 | none — **เริ่มได้** (CORE-31 ☑ #254); ∥ ทุกตัว (EV-7e ☐ แตะ `voucher-card` — ตัวที่ merge ทีหลัง rebase) |
| CORE-38 | (storefront เล็ก ~60 LOC + e2e, qa #255 O-2 / qa #258 O-3) สรุปที่อยู่ของ checkout เรียงแนวตั้งที่ < 640px + label ลอยของ `Input` ไม่ทับค่า (กฎข้อ 96) — ไฟล์: `modules/checkout/components/addresses/index.tsx`, `modules/common/components/input/index.tsx` และ/หรือ `styles/globals.css`, e2e ใหม่ — ☑ #267 (train #270; ส่วน (b) ปิดโดยไม่แก้ `Input` — ดูกฎข้อ 96b) | AC-132 | none — **เริ่มได้**; ∥ ทุกตัว (CORE-4j ☐ แตะฟอร์มที่อยู่ — ตัวที่ merge ทีหลัง rebase) |
| CORE-39 | (storefront test/nit เล็ก ~25 LOC, review #258) จำกัดความยาว token ใน `return_to`, comment ลำดับ `return_to`/`add_variant`, unit เคสที่ qa ลองมือ (กฎข้อ 97) — ไฟล์: `lib/util/login-return.ts` (+ test), `lib/data/customer.ts` (comment) — ☑ #271 (train #272) | AC-133 | **CORE-29 merge** (ชน `lib/data/customer.ts` — `completeLogin`/`continueAfterAuth` ไฟล์เดียวกัน; ไม่แตก branch ระหว่าง CORE-29 เปิด); ไม่บล็อก release |
(รอบ 18) CORE-35 ∥ CORE-36 ∥ CORE-37 ∥ CORE-38 เริ่มได้ทันที; CORE-39 ← CORE-29; CORE-35 ควรมีก่อน release v0.5.0, ที่เหลือไม่บล็อก release
(รอบ 19 สถานะ 2026-11-04) merge แล้วผ่าน merge train: CORE-29 ☑ #263, CORE-36 ☑ #264, CORE-37 ☑ #265 (train #268); CORE-35 ☑ #266, CORE-38 ☑ #267 (train #270); CORE-39 ☑ #271 (train #272)

### ยอมรับใน v1 / ไม่เปิด task (รอบ 18)
- ปุ่ม voucher `size="small"` (qa #254 ข้อ 2) — ทำแล้วใน #254 (`voucher-copy-button/index.tsx` ส่ง `size="small"`); ที่ 375px ปุ่มเต็มความกว้างการ์ดเป็นพฤติกรรมของแถว `flex-wrap` ซึ่ง CORE-37 ข้อ (c) จัดใหม่อยู่แล้ว
- ค่าส่ง ฿0 ในสรุปตะกร้าขณะ cart ค้าง Digital delivery (qa #255 O-3) — ยอดจริงคำนวณใหม่เมื่อเลือกวิธีส่ง และ CORE-35 กันไม่ให้จ่ายด้วย method ค้าง

## Follow-up รอบ 19 จาก review/qa (2026-11-04 — owner สั่ง "เปิดเลย")
ที่มา: qa #264 (`docs/evidence/core/CORE-36/REPORT.md` O-1, O-2, O-4), review/qa #266 (`CORE-35/REPORT.md` Observation 1, 5), qa/review #265 (`CORE-37/REPORT.md` O-1),
qa #267 (`CORE-38/REPORT.md` Observation 3), nit review #267 — ตรวจโค้ดบน develop `028f353`:
`modules/checkout/components/discount-code/index.tsx` — `removingRef`/`removingCode` (~48–57) กันเฉพาะการลบซ้อนกัน; `SubmitButton` `discount-apply-button` (~129–134) ไม่ disabled ระหว่างลบ
และ `addPromotionCode` (~87–90) สร้างรายการจาก `promotions` ของ prop ตอนคลิก (ยังมีโค้ดที่กำลังลบ) → ได้ `[A, B]` ตามที่ qa ทำซ้ำ 2/2 — **ยังจริง (bug)**; ทางกลับกัน (ลบระหว่างใส่โค้ด) ปุ่มลบก็ไม่ disabled — ยังจริง;
`modules/checkout/templates/checkout-form/index.tsx` (~36–40) redirect `?step=payment`/`review` ไป `step=delivery` เสมอเมื่อ delivery ยังไม่เสร็จ แม้ยังไม่มีที่อยู่ (ฟอร์มที่อยู่เปิดเฉพาะ `step=address` —
`addresses/index.tsx` ~33) — ยังจริง; `checkoutStep` ใน `lib/util/digital-checkout.ts` (~32–37) มีลำดับ address → delivery → payment อยู่แล้วแต่ไม่รับรายการที่กรองแล้ว;
`modules/cart/components/item/index.tsx` ช่องรูป `w-24` + ช่องจำนวน `w-28` + padding ของ `Table.Cell` ที่ 375px (คอลัมน์ราคา `hidden small:table-cell` แล้ว) — ยังจริงตามภาพ qa-04 ของ #264;
`modules/common/components/copy-button/index.tsx` (~94–96) span สถานะ `basis-full` อยู่ใน DOM ตลอด (สูง 0) + `gap-y-1` ของแถวใน `voucher-card/index.tsx` (~21) → ช่องว่าง 4px — ยังจริง;
e2e `core-4g-checkout-polish.spec.ts:112–113`, `ev-7c-digital-only-checkout.spec.ts:103–104`/`:175–176`, `thai-ui-checkout.spec.ts:42`, `core-38-mobile-layout.spec.ts:141–142` และไฟล์อื่น
ใช้ `click()` ของ `add-product-button` ตามด้วย `toBeEnabled()` (timeout default 5s) เป็นตัวแทน "ใส่ตะกร้าเสร็จ" — เงื่อนไขผิด: ผ่านได้ทันทีก่อนปุ่มเข้าสถานะ pending หรือล้มเมื่อ action ช้ากว่า 5s
ตอนเครื่องโหลดสูง — ยังจริง; `core-38-mobile-layout.spec.ts` เคส digital-only (~262–275) ไม่กรอก `LONG_CITY` และ input เขต/อำเภอของ `billing_address/index.tsx` (~77–83) **ไม่มี `data-testid`** — ยังจริง
Out of scope: เปิด `?step=delivery` ตรงๆ ตอนยังไม่มีที่อยู่ (พฤติกรรมเดิมของ starter — ไม่ได้ถูกรายงาน; ขยายกฎข้อ 99 ไป delivery ต้องแก้ setup ของ e2e เดิมที่ตั้ง shipping method ผ่าน API — ยอมรับใน v1; **รอบ 20 ถอน → CORE-45 กฎข้อ 103**),
spinner ของปุ่มลบโค้ด (qa #264 O-3 — ตรงกฎข้อ 94 แล้ว), `force-cache` ของ `retrieveCart` เมื่อเปลี่ยน method จากนอก storefront (qa #266 Observation 2 — ไม่ใช่ flow ของผู้ใช้)

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa / ไลบรารีมีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| ตั้งชุดโค้ดของ cart | `POST /store/carts/:id` (`promo_codes`) ผ่าน `applyPromotions` เดิม — แทนทั้งชุด | ใช้ตามเดิม — CORE-40 แก้เฉพาะลำดับ/การกันกดฝั่ง component (ไม่มี route ลบโค้ดทีละตัวที่ต้องใช้) |
| สถานะ pending ของฟอร์ม | `useFormStatus` ของ React ใน `SubmitButton` ของ starter + prop `disabled` ของ `Button` (`@medusajs/ui`) | ใช้ตามเดิม |
| ลำดับขั้น checkout | `checkoutStep` เดิม (EV-7c) + `selectedShippingOptionId` (CORE-33) | ขยาย — รับรายการที่กรองแล้ว (แบบ `deliveryStepDone` ของกฎข้อ 93) |
| ตารางสินค้า | `Table` ของ `@medusajs/ui` (starter) | ใช้ตามเดิม — แก้ className ของ cell |
| รอผล async ใน e2e | `expect.poll`, `page.waitForResponse`, `expect(locator).toHaveCount/toHaveAttribute` ของ Playwright | ใช้ตามเดิม — ไม่เพิ่ม dependency |

### Data model / Workflows / API routes
none

### Business rules
98. (CORE-40 — qa #264 O-1, **bug**) ช่องโค้ดส่วนลด (`modules/checkout/components/discount-code`) มี action โค้ด (ใส่ **หรือ** ลบ) ค้างได้ทีละหนึ่งเท่านั้น:
    (a) ระหว่างมี action ค้าง `discount-apply-button` และทุก `remove-discount-button` disabled; ref in-flight ตัวเดียวกันกันทั้ง `addPromotionCode` และ `removePromotionCode`
    (ขยาย `removingRef` เดิมของ CORE-36 — ไม่สร้าง hook ใหม่) — คลิกใน tick เดียวกันไม่ยิง action ที่สอง;
    (b) รายการโค้ดที่ส่งตอนใส่โค้ด = ชุดโค้ดล่าสุดที่รู้ (`result.codes` ของ action ที่สำเร็จล่าสุด ถ้าใหม่กว่า prop `cart.promotions`; ไม่งั้น prop) + โค้ดใหม่ —
    โค้ดที่เพิ่งลบสำเร็จไม่ถูกส่งกลับไปแม้ prop ยังไม่ refresh; ลบล้ม → ชุดเดิม (โค้ดยังอยู่) — ข้อความ error ตามกฎข้อ 85/92/94 เดิม;
    (c) โค้ดอัตโนมัติ (`is_automatic`) คงพฤติกรรมเดิม
99. (CORE-41 — review/qa #266 Observation 1) เปิด `/<cc>/checkout?step=payment` หรือ `?step=review` ตรงๆ ขณะขั้นก่อนหน้ายังไม่เสร็จ → redirect ไป**ขั้นแรกที่ยังไม่เสร็จ**:
    ไม่มีที่อยู่/อีเมล → `?step=address` (ฟอร์มที่อยู่เปิด); มีที่อยู่แต่ delivery ยังไม่เสร็จตามกฎข้อ 93 → `?step=delivery` (เดิม);
    ใช้ helper เดียว `checkoutStep(cart, options?)` ใน `lib/util/digital-checkout.ts` (ส่ง `options` = รายการที่กรองแล้ว → delivery ใช้ `deliveryStepDone(cart, options)`; ไม่ส่ง = พฤติกรรมเดิมของหน้าตะกร้า)
    แทนเงื่อนไขใน `checkout-form` — ไม่ยิง API เพิ่ม; cart digital-only ข้าม delivery ตามเดิม
    (รอบ 21: `checkoutStep` ยังเป็น pure แต่ `checkout-form` อ่าน cart แบบ fresh เพิ่ม 1 ครั้งเมื่อ cart จาก cache บอกให้ redirect — ดูกฎข้อ 103e)
100. (CORE-42 — qa #264 O-4, qa/review #265 O-1) layout มือถือ: (a) หน้า `/cart` ที่ 375px ตารางสินค้าไม่ล้นขอบขวา — คอลัมน์ "รวม" (`product-price`) เห็นครบในจอ
     (ลดความกว้างของช่องรูป/ช่องจำนวนที่ < `small` หรือจัด cell ใหม่ — เลือกใน PR; ≥ `small` คง layout เดิม); (b) แถวรหัสของการ์ด voucher ไม่มีช่องว่างใต้แถวเมื่อสถานะของ `CopyButton` ว่าง —
     span สถานะยังอยู่ใน DOM พร้อม `aria-live="polite"` (ไม่ใช้ `display:none`/ไม่ unmount เพราะ live region ที่ถูกซ่อนแล้วแสดงอาจไม่ถูกอ่าน) เช่น ย้ายระยะห่างไปเป็น margin ของ span เมื่อมีเนื้อหา
     (`empty:` variant) แทน `gap-y` ของแถว; แถวรหัสมี `data-testid="voucher-code-row"`; กฎข้อ 95c เดิมยังผ่าน
101. (CORE-43 — test hygiene, qa #264 O-2 / #266 Observation 5 / #267 Observation 3, nit review #267) e2e ของ storefront รอ**เงื่อนไขที่ถูกต้อง**แทน timeout default:
     (a) helper `addToCartFromPdp(page, ...)` ใน `e2e/support/` (ผู้ใช้จริง ≥ 2 ที่) กด `add-product-button` แล้วรอผลจริง — response ของ server action (request `POST` ที่มี header `next-action` ของหน้า PDP)
     สำเร็จ **และ** จำนวนสินค้าใน cart ของ cookie `_medusa_cart_id` ตาม Store API (`expect.poll` + token ของลูกค้า) เพิ่มตามที่คาด — แทน `click()` + `toBeEnabled()` ทุกจุดใน `e2e/*.spec.ts`
     (ยกเว้น test ที่ตั้งใจทดสอบสถานะปุ่มเอง เช่น FS-16/CORE-27 — ระบุใน PR);
     (b) `core-14-buy-login` AC-41, `ev-7c` AC-37/AC-3, `thai-ui-checkout` AC-48/75, `core-4g-checkout-polish` AC-99 (และ `core-4e` AC-91 ถ้า trace ชี้ pattern เดียวกัน):
     builder อ่าน trace ของรอบที่ล้ม (CI artifact หรือรันในเครื่องด้วย `--repeat-each` ขณะโหลดสูง) แล้วระบุ assertion ที่ล้มจริงใน PR ก่อนแก้; แก้ด้วยการรอเงื่อนไขของขั้นนั้น
     (เช่น URL ปลายทางหลัง redirect หลายต่อ, response ของ action, สถานะ cart ผ่าน API) — **ห้าม**เพิ่ม `expect.timeout`/`timeout` ระดับ config, ห้าม `waitForTimeout`;
     timeout ต่อ assertion ได้เฉพาะการรอ navigation ฝั่ง server หลายต่อที่ระบุเหตุผลใน comment (≤ 1 จุดต่อ test); ถ้าต้นเหตุคือ cold start ของ storefront process แรก (qa #267 Observation 3)
     ให้แนบหลักฐานและเสนอใน PR (warm-up ใน global setup ได้ — ไม่ใช่ infra ใหม่);
     (c) `core-38-mobile-layout.spec.ts` เคส digital-only กรอก `LONG_CITY` ลงช่องเขต/อำเภอของที่อยู่ใบเสร็จ — เพิ่ม `data-testid="billing-city-input"` ใน `billing_address/index.tsx`
     (ชื่อตามแบบ `shipping-city-input`) และเคส billing ต่างจาก shipping ของไฟล์เดียวกันกรอก `LONG_CITY` ลงช่องนี้ด้วย

### Acceptance criteria (follow-up รอบ 19)
- AC-134 (CORE-40, กฎข้อ 98) unit (Vitest + jsdom, ต่อจาก `src/core-28-promotion-error.test.ts`): Given cart prop มีโค้ด A และ `applyPromotions` mock คืน promise ที่ยังไม่ resolve When กด `remove-discount-button`
  Then `discount-apply-button` disabled; When ส่งฟอร์มใส่โค้ด B (submit) ระหว่างนั้น Then `applyPromotions` ถูกเรียกรวม 1 ครั้ง; When resolve การลบด้วย `codes: []` **โดยไม่ re-render prop** (cart ยังมี A)
  แล้วใส่ B Then การเรียกครั้งที่ 2 ได้ argument `["B"]` (ไม่มี A); Given การลบ resolve เป็น error ที่ไม่ใช่ `unauthorized` Then การใส่ B ครั้งถัดไปส่ง `["A", "B"]`; Given การใส่โค้ดค้าง
  Then ทุก `remove-discount-button` disabled และคลิกไม่เรียก `applyPromotions` เพิ่ม; test ส่วนรายการโค้ดต้อง fail กับโค้ดก่อนแก้ (แนบผลใน PR); AC-121, AC-128, AC-130 ยังผ่าน;
  e2e (`/th/checkout`, cart ของ A มีโค้ด A ผ่าน Store API): ค้าง server action ของการลบด้วย `page.route` → `discount-apply-button` `toBeDisabled()`; ปล่อย แล้วใส่ B ผ่าน UI
  → `GET /store/carts/:id` (token ของ A) มี `promotions[].code` = `[B]` เท่านั้น
- AC-135 (CORE-41, กฎข้อ 99) unit (Vitest, ต่อจาก `src/ev-7c-digital-only-checkout.test.ts`): `checkoutStep(cart, options)` — ไม่มีที่อยู่ + method Standard อยู่ใน `options` → `"address"`;
  มีที่อยู่ + method Digital ค้างที่ไม่อยู่ใน `options` → `"delivery"`; มีที่อยู่ + Standard อยู่ใน `options` → `"payment"`; digital-only ไม่มีที่อยู่ → `"address"`, มีที่อยู่ → `"payment"`;
  ไม่ส่ง `options` → expectation เดิมของไฟล์ผ่านโดยไม่แก้; e2e: Given cart ของ A มี t-shirt ไม่มีที่อยู่ When เปิด `/th/checkout?step=payment` และ `?step=review` (แยกกัน) Then URL มี `step=address`,
  `shipping-first-name-input` visible และไม่มี `submit-order-button`; Given cart digital-only ไม่มีที่อยู่ When `?step=review` Then `step=address` และ `billing-first-name-input` visible;
  AC-129 (มีที่อยู่ + method ค้าง → `step=delivery`) และ e2e checkout ปกติ (มีที่อยู่ + Standard → `?step=payment` ไม่ถูก redirect) ยังผ่าน
- AC-136 (CORE-42, กฎข้อ 100) e2e 375×812: (a) `/th/cart` ของ A ที่มี t-shirt 1 line → `document.documentElement.scrollWidth ≤ 375` และทุก `product-price` มี `getBoundingClientRect().right ≤ 375`
  และ `left ≥ 0` และไม่ถูกตัดโดย ancestor (`elementFromPoint` ที่จุดกลางของ `product-price` อยู่ภายใน `product-price`); ที่ 1280 คอลัมน์ราคาต่อหน่วยยังแสดง (`cart-items-header` มี header cell 5 ช่องที่ visible) — regression e2e ของ `/cart` เดิมผ่าน;
  (b) `/th/account/vouchers` ที่ 375 และ 1280 ขณะสถานะว่าง: `voucher-code-row` bottom − max(bottom ของ `voucher-code`, `voucher-copy-button`) ≤ 1px,
  `voucher-copy-status` อยู่ใน DOM, `aria-live="polite"` และ `getComputedStyle(...).display !== "none"`; หลังคัดลอกล้ม (override `writeText` reject) สถานะ + `voucher-copy-status-value` อยู่ใน `voucher-code-row`
  ใต้ปุ่ม และ AC-131 (ตำแหน่งปุ่มก่อน-หลัง ≤ 1px) ยังผ่าน
- AC-137 (CORE-43, กฎข้อ 101) grep: `apps/storefront/e2e/*.spec.ts` ไม่มีลำดับ `getByTestId("add-product-button").click()` ตามด้วย `toBeEnabled()` ของปุ่มเดียวกันในบรรทัดถัดไป
  (ยกเว้นบรรทัดที่มี comment อ้างกฎข้อ 101a); `e2e/support/` มี helper ของข้อ (a) + unit ของ helper (Playwright `unit` project, mock `page`) ถ้ามี logic เลือก request;
  `playwright.config.ts` ไม่เปลี่ยนค่า `timeout`/`expect.timeout`; diff ไม่มี `waitForTimeout`; PR ระบุ assertion ที่ล้มจริงของแต่ละ test ในข้อ (b) จาก trace;
  `core-14-buy-login`, `ev-7c-digital-only-checkout`, `thai-ui-checkout`, `core-4g-checkout-polish` รัน `--repeat-each=5` ผ่านทุกรอบ (ใน CI job `storefront-e2e` หรือในเครื่องขณะรัน 4 workers — แนบผลใน PR);
  grep: `billing_address/index.tsx` มี `billing-city-input` และ `core-38-mobile-layout.spec.ts` ใช้ `LONG_CITY` กับ `billing-city-input` ทั้งเคส digital-only และเคส billing ต่างกัน; AC-132 ยังผ่าน

### แผนการทดสอบ (follow-up รอบ 19)
| ระดับ | AC |
|------|----|
| unit (Vitest) | AC-134, AC-135 |
| e2e | AC-134, AC-135, AC-136 (375/1280), AC-137 (repeat 5 + regression ที่แตะ) |
| grep | AC-137 |

### Tasks (follow-up รอบ 19)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-40 | (storefront เล็ก ~120 LOC รวม test, **bug** qa #264 O-1) ช่องโค้ดส่วนลดมี action ค้างได้ทีละหนึ่ง + รายการโค้ดตอนใส่ไม่พาโค้ดที่เพิ่งลบกลับมา (กฎข้อ 98) — ไฟล์: `modules/checkout/components/discount-code/index.tsx`, `src/core-28-promotion-error.test.ts`, e2e ใหม่ `e2e/core-40-*.spec.ts` — ☑ #275 (train #282) | AC-134 | none — **เริ่มได้** (CORE-36 ☑ #264); ∥ ทุกตัว; ชน `discount-code` กับ CORE-4j (☐, trim โค้ด) ตัวที่ merge ทีหลัง rebase — **ควรทำก่อน** (ลูกค้าได้ส่วนลดที่ลบแล้วกลับมาเงียบๆ) |
| CORE-41 | (storefront เล็ก ~120 LOC รวม test, review/qa #266) `?step=payment`/`review` ตรงๆ → ขั้นแรกที่ยังไม่เสร็จ (`step=address` เมื่อไม่มีที่อยู่) ผ่าน `checkoutStep(cart, options)` (กฎข้อ 99) — ไฟล์: `lib/util/digital-checkout.ts` (+ `src/ev-7c-digital-only-checkout.test.ts`), `modules/checkout/templates/checkout-form/index.tsx`, e2e (ต่อจาก e2e ของ CORE-35 หรือไฟล์ใหม่) — ☑ #276 (train #279) | AC-135 | none — **เริ่มได้** (CORE-35 ☑ #266); ∥ ทุกตัว; ชน `checkout-form` กับ CORE-4i/CORE-19f (☐) ตัวที่ merge ทีหลัง rebase |
| CORE-42 | (storefront เล็ก ~100 LOC รวม e2e, qa #264 O-4 + qa/review #265 O-1) ตารางสินค้า `/cart` ที่ 375 ไม่ล้น + แถวรหัส voucher ไม่มีช่องว่างเมื่อสถานะว่าง (กฎข้อ 100) — ไฟล์: `modules/cart/components/item/index.tsx` (และ/หรือ `cart/templates/items.tsx`), `modules/common/components/copy-button/index.tsx`, `modules/evoucher/components/voucher-card/index.tsx`, e2e ใหม่ — ☑ #278 (train #283) | AC-136 | none — **เริ่มได้** (CORE-37 ☑ #265); ∥ ทุกตัว; ชน `voucher-card` กับ EV-7e (☐) และ `item/index.tsx` กับ CORE-4i (☐) ตัวที่ merge ทีหลัง rebase; ไม่บล็อก release |
| CORE-43 | (e2e test hygiene ~150 LOC, qa #264/#266/#267 + nit review #267) helper ใส่ตะกร้าจาก PDP ที่รอผลจริง แทน `click()` + `toBeEnabled()`, แก้ assertion ที่ล้มจริงของ test ที่ไม่นิ่งด้วยเงื่อนไขที่ถูก, `LONG_CITY` + `billing-city-input` ของ core-38 (กฎข้อ 101) — ไฟล์: `e2e/support/` (helper ใหม่ หรือใน `medusa.ts`), `e2e/*.spec.ts` ที่ใช้ pattern เดิม, `e2e/core-38-mobile-layout.spec.ts`, `modules/checkout/components/billing_address/index.tsx` (test id) — ☑ #281 (train #283) | AC-137 | none — **เริ่มได้**; ∥ ทุกตัว (แตะ e2e หลายไฟล์ — ตัวที่ merge ทีหลัง rebase; e2e ใหม่ของ CORE-40/41/42 สร้าง cart ผ่าน Store API หรือใช้ helper ถ้า CORE-43 merge แล้ว ไม่เพิ่ม pattern เดิม); ไม่บล็อก release; ถ้าเกิน ~400 LOC แยก (a)+(c) / (b) |
(รอบ 19) CORE-40 ∥ CORE-41 ∥ CORE-42 ∥ CORE-43 เริ่มได้ทันที; CORE-40 ควรทำก่อน (bug ส่วนลด) และควรมีก่อน release ถัดไป; ที่เหลือไม่บล็อก release
(รอบ 20 สถานะ 2026-11-04) merge แล้วผ่าน merge train: CORE-41 ☑ #276 (train #279); CORE-40 ☑ #275 (train #282 — train #280 ปิดเพราะ e2e ของ CORE-42 พึ่ง stock ของสินค้า seed);
CORE-42 ☑ #278, CORE-43 ☑ #281 (train #283)

### ยอมรับใน v1 / ไม่เปิด task (รอบ 19)
- ~~เปิด `?step=delivery` ตรงๆ ตอนยังไม่มีที่อยู่ — ดู Out of scope ด้านบน (ไม่ถูกรายงาน; ปลายทาง payment/review ถูกกันแล้วด้วยกฎข้อ 93/99)~~ — **(รอบ 20) ถอน**: qa #276 Observation 1 รายงานแล้ว → CORE-45 (กฎข้อ 103)
- สถานะกำลังลบของปุ่มลบโค้ดเห็นได้น้อย (qa #264 O-3) — ตรงกฎข้อ 94 (`aria-busy` + disabled) และ CORE-40 เพิ่ม disabled ให้ปุ่มใส่โค้ดด้วย
- การ์ด Products ของ affiliate ที่ 375 ตัด URL หลายบรรทัด (qa #265 O-3) — ไม่ล้นจอและอ่านได้; หน้า Profile ล้นจริง → spec 05 AF-18

### Open questions (รอบ 18)
none

## Follow-up รอบ 20 จาก review/qa (2026-11-04 — owner สั่ง "ตกลง")
ที่มา: qa #278 (`docs/evidence/core/CORE-42/REPORT.md` D-2, O-1), qa #276 (`CORE-41/REPORT.md` Observation 1–2 + negative case `?step=foo`/ไม่มี step), nit review #281 + ข้อเสนอของ builder CORE-43,
nit review #278, บทเรียน train #280 (ปิดเพราะ e2e ของ CORE-42 ใช้ stock ของสินค้า seed) — ตรวจโค้ดบน develop `256aecd`:
`modules/cart/templates/index.tsx` (~23) grid `small:grid-cols-[1fr_360px] gap-x-40` — ที่ 1024px (`small`) คอลัมน์ซ้ายเหลือราว 456px (976 − 160 − 360) และ `1fr` มีค่าต่ำสุด = min-content ของตาราง
→ แถวที่มีราคาขีดฆ่า + ราคาลดดันคอลัมน์สรุปล้นขวา (qa วัด `scrollWidth` 1029–1057; base เท่ากัน) — ยังจริง;
`modules/cart/components/item/index.tsx` (~101–114) ตัวเลือกจำนวน 1..`Math.min(maxQuantity, 10)` + `<option value={1}>` ซ้ำท้าย (ของ starter) → line จำนวน > 10 แสดง "1" เพราะ `value` ไม่อยู่ในรายการ
(ลูกค้าเห็นจำนวนผิดและเลือก "1" เพื่อลดจำนวนไม่ได้ เพราะ `onChange` ไม่ยิง) — ยังจริง;
`modules/checkout/templates/checkout-form/index.tsx` (~45–51) redirect เฉพาะ `step=payment`/`review`: `step=delivery` ตอนไม่มีที่อยู่เปิดขั้น delivery ได้, ไม่มี step/step ไม่รู้จัก/step ซ้ำ (array → `undefined` ที่ `checkout/page.tsx:33`)
→ ทุก section ปิด — และ `app/buy/[items]/route.ts:29`, `lib/data/customer.ts:239` พาลูกค้าไป `/<cc>/checkout` ที่ไม่มี step — ยังจริง;
`e2e/support/stripe.ts:104–105` `checkoutToPayment` ยัง `click()` + `toBeEnabled()` (grep ของ AC-137 ครอบเฉพาะ `e2e/*.spec.ts` ไม่ครอบ `e2e/support/`) — ยังจริง;
`e2e/support/server-action.ts:8` comment ว่า `page.waitForResponse` "ไม่มี timeout ของ assertion (ใช้ timeout ของ test)" — review #281 ชี้ว่าไม่ตรง (ต้องยืนยันกับ docs ของ Playwright);
`core-19a-nav-cart-search.spec.ts:60`, `core-24-pdp-quantity.spec.ts:54`, `:177` `waitForResponse` รับ response ใดก็ได้ที่ request มี `next-action` (อาจจับ action ราคา/สถานะ login ที่ PDP ยิงตอนโหลด — เหตุผลเดียวกับ `isAddToCartBody` ของ CORE-43) — ยังจริง;
`e2e/affiliate-admin-programs.spec.ts:35`, `group-buy-admin-detail.spec.ts:22`, `group-buy-admin-dates.spec.ts:21` ดึง `/admin/products?limit=1` (ตัวแรกตามลำดับ default — อาจเป็นสินค้าชั่วคราวที่ test อื่นสร้างแล้วลบระหว่างรัน) — ยังจริง
Out of scope: `ECONNRESET` ระหว่าง Playwright `request` กับ backend ตอนรัน 12 workers ในเครื่อง (ดู "ยอมรับใน v1" ด้านล่าง), ชื่อสินค้ายาวตัดหลายบรรทัดที่ 375 (qa #278 O-2 — ไม่ล้น อ่านได้)

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa / ไลบรารีมีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| layout หน้าตะกร้า | template `/cart` ของ starter + `Table` ของ `@medusajs/ui` | ขยาย — แก้ className ของ grid/cell เดิม |
| แก้จำนวนของ line + ตรวจ stock | `updateLineItem` เดิม → `POST /store/carts/:id/line-items/:line_id` (`updateLineItemInCartWorkflow` ตรวจ inventory เอง) | ใช้ตามเดิม — UI แสดงจำนวนจริงเท่านั้น ไม่สร้างเพดานเอง |
| ลำดับขั้น checkout | `checkoutStep(cart, options)` (CORE-41) + `deliveryStepDone` (CORE-35) | ขยาย — ใช้เป็นปลายทางของทุก step ที่ใช้ไม่ได้ |
| รอ server action ใน e2e | `waitForServerAction`, `isAddToCartBody`, `addToCartFromPdp` ใน `e2e/support/server-action.ts` (CORE-43) | ใช้ตามเดิม — ไม่เขียน helper ใหม่ |
| หาสินค้า seed ผ่าน admin API | `GET /admin/products?handle=<handle>` | ใช้ตามเดิม |

### Data model / Workflows / API routes
none

### Business rules
102. (CORE-44 — qa #278 D-2, O-1) หน้า `/cart`: (a) ที่ ≥ 1024px (`small`) คอลัมน์สรุปไม่ล้นขอบขวาเมื่อมีโค้ดส่วนลด (ราคาขีดฆ่า + ราคาลด) — คอลัมน์ซ้ายของ grid หดได้ (`minmax(0,1fr)`)
     และ/หรือระยะห่างคอลัมน์ช่วง `small` ถึงก่อน `large` เล็กลง (เลือกใน PR ตามผลวัด); คอลัมน์สรุปกว้าง 360px เท่าเดิม; ค่าใน `product-price` ไม่ถูกตัด; < 1024px คงตาม CORE-42 (กฎข้อ 100a);
     (b) `product-select-button` แสดงจำนวนจริงของ line: ตัวเลือก = 1..10 และเพิ่ม `item.quantity` เมื่อ > 10 (เรียงน้อยไปมาก ไม่มีค่าซ้ำ — ตัด `<option value={1}>` ซ้ำท้ายของ starter)
     ผ่าน helper pure `cartQuantityOptions(quantity)` ใน `lib/util/` (+ unit); ไม่เพิ่มเพดานจำนวนเอง (Medusa ตรวจ stock ตอนแก้จำนวน)
103. (CORE-45 — qa #276 Observation 1–2; **ขยายกฎข้อ 99 และถอนข้อ "ยอมรับใน v1" ของรอบ 19**) `checkout-form` redirect ไป `?step=<checkoutStep(cart, options)>` เมื่อ:
     (a) ไม่มี `step` หรือ `step` ไม่ใช่ค่าใดใน `address`/`delivery`/`payment`/`review` แบบตรงตัว (`REVIEW`, `foo`, step ซ้ำ ถือว่าไม่รู้จัก);
     (b) `step=delivery` และ `checkoutStep` = `"address"`; (c) `step=delivery` บน cart digital-only (ไม่มีขั้น delivery); (d) `step=payment`/`review` ตามกฎข้อ 99 เดิม;
     ไม่ redirect: `step=address` ทุกกรณี และ `step=delivery` เมื่อมีที่อยู่แล้ว (รวมเมื่อ delivery เสร็จแล้ว — ลูกค้ากลับมาเปลี่ยนวิธีส่ง); ปลายทางของ redirect ต้องไม่เข้าเงื่อนไขซ้ำ (ไม่วน);
     ตัดสินด้วย helper pure `checkoutRedirectStep(step, cart, options)` (คืน step ปลายทางหรือ `null`) ใน `lib/util/digital-checkout.ts` ข้าง `checkoutStep` — ~~ไม่ยิง API เพิ่ม~~
     **(รอบ 21 แก้ถ้อยคำตามของที่ merge แล้ว #288)** `checkoutRedirectStep` ยังเป็น pure (ไม่ยิง API);
     (e) (D-1 ของ qa #288: หลังกด `submit-address-button` หน้าเด้งกลับ `step=address` เพราะ cart ที่หน้าอ่านแบบ `force-cache` ยังเป็นค่าก่อน `setAddresses`)
     `checkout-form` ตัดสินผ่าน `checkoutRedirectWithLatest(step, cart, optionsFor, loadLatest)` (`lib/util/digital-checkout.ts:74–86`): ถ้า cart จาก cache **ไม่**ต้อง redirect
     → ไม่อ่าน cart เพิ่ม; ถ้าต้อง redirect → อ่าน cart แบบ fresh (`retrieveCart(cart.id, undefined, { fresh: true })` = `cache: "no-store"`, `lib/data/cart.ts:69`) **เพิ่ม 1 ครั้ง**
     แล้วตัดสินซ้ำด้วย `checkoutRedirectStep` และ render ด้วย cart/options ล่าสุดนั้น (`checkout-form/index.tsx:46–56`); อ่าน fresh ไม่ได้ (`null`) → ใช้ผลจาก cart เดิม
104. (CORE-46 — test hygiene, nit review #281/#278, builder CORE-43) (a) `checkoutToPayment` ใน `e2e/support/stripe.ts` ใส่ตะกร้าด้วย `addToCartFromPdp` (มี `request`/`pk`/`customer` ใน argument อยู่แล้ว);
     (b) comment ใน `e2e/support/server-action.ts` (~6–8) บอกที่มาของ timeout ของ `page.waitForResponse` ตรงตามจริง — builder ตรวจกับ docs ของ Playwright เวอร์ชันที่ pin และ `playwright.config.ts`
     (ค่า default ของ `timeout` option, ผลของ `actionTimeout`/`setDefaultTimeout`) แล้วอ้าง URL ของ docs ใน comment — ห้ามเดา; ถ้าตรวจแล้วเดิมถูก ให้เพิ่ม URL อ้างอิงอย่างเดียวและบอกใน PR;
     (c) `core-19a-nav-cart-search.spec.ts` และ `core-24-pdp-quantity.spec.ts` ที่รอ action ของการเพิ่มลงตะกร้าใช้ `waitForServerAction(page, isAddToCartBody)` (หรือ `addToCartFromPdp` ถ้า test ไม่ได้ทดสอบสถานะปุ่มเอง);
     (d) e2e admin ที่ต้องการ "สินค้าใดก็ได้" ดึงสินค้า seed ด้วย handle คงที่ (`GET /admin/products?handle=<handle>`) แล้ว assert ได้ 1 รายการ — แทน `limit=1`;
     handle = สินค้าที่ `limit=1` ได้อยู่แล้วบน DB ที่ seed ใหม่ (builder ตรวจแล้วระบุใน PR — คงพฤติกรรมเดิมของ test เช่น exclusivity ของแคมเปญ group buy/flash กับสินค้านั้น)

### Acceptance criteria (follow-up รอบ 20)
- AC-138 (CORE-44, กฎข้อ 102) unit (Vitest): `cartQuantityOptions(3)` = `[1..10]`; `cartQuantityOptions(10)` = `[1..10]`; `cartQuantityOptions(99)` = `[1..10, 99]`; ทุกผลไม่มีค่าซ้ำและเรียงน้อยไปมาก;
  grep: `modules/cart/components/item/index.tsx` เรียก `cartQuantityOptions` และไม่มี `<option value={1} key={1}>` ซ้ำท้าย;
  e2e (สินค้าของ test เองที่สร้างผ่าน admin API มี stock ≥ 200 หรือ `manage_inventory: false` — ไม่ใช้ stock ของ t-shirt seed; ลบใน `afterAll`) ที่ 1024×768 และ 1280×800:
  cart ของ A แบบ 1 line จำนวน 99 และ 3 line + โค้ดส่วนลด 5% ผ่าน Store API (token ของ A) → `document.documentElement.scrollWidth ≤ viewport`, คอลัมน์ขวาของ grid
  (เพิ่ม `data-testid="cart-summary-column"` ที่ `div.relative` ใน `cart/templates/index.tsx`) มี `right ≤ viewport` และกว้าง 360px (±1), ทุก `product-price` มี `right ≤ left` ของ `cart-summary-column`
  และ `elementFromPoint` ที่จุดกลางอยู่ภายใน `product-price`; `product-select-button` ของ line จำนวน 99 มี `inputValue() === "99"`; `selectOption("2")` → `GET /store/carts/:id` (token ของ A) ได้ quantity 2;
  AC-136 (375) และ e2e เดิมของ `/cart` (`core-42`, `thai-ui-cart-order`, `core-26-cart-dropdown-total`, `core-19c-delete-button-error`) ผ่านโดยไม่แก้ locator
- AC-139 (CORE-45, กฎข้อ 103) unit (Vitest, ต่อจาก `src/ev-7c-digital-only-checkout.test.ts`): `checkoutRedirectStep` — `undefined`/`"foo"`/`"REVIEW"` + cart ไม่มีที่อยู่ → `"address"`,
  + cart มีที่อยู่ + Standard อยู่ใน `options` → `"payment"`; `"delivery"` + ไม่มีที่อยู่ → `"address"`; `"delivery"` + มีที่อยู่ (method ค้างหรือ Standard แล้ว) → `null`;
  `"delivery"` + digital-only ไม่มีที่อยู่ → `"address"`, มีที่อยู่ → `"payment"`; `"address"` + ทุก fixture → `null`; `"payment"`/`"review"` ได้ผลเดียวกับ AC-135;
  ทุก fixture cart × ทุก step ที่ทดสอบ: ถ้าผล = `s` (ไม่ใช่ `null`) แล้ว `checkoutRedirectStep(s, cart, options) === null` (ไม่วน); expectation เดิมของไฟล์ผ่านโดยไม่แก้;
  e2e: Given cart ของ A มี t-shirt ไม่มีที่อยู่ When เปิด `/th/checkout?step=delivery`, `/th/checkout`, `/th/checkout?step=foo` (แยกกัน) Then URL มี `step=address`, `shipping-first-name-input` visible
  และไม่มี `delivery-option-radio`; Given มีที่อยู่ + Standard When `/th/checkout` Then `step=payment`, When `?step=delivery` Then URL ยังเป็น `step=delivery` และ `delivery-option-radio` visible;
  Given digital-only มีที่อยู่ When `?step=delivery` Then `step=payment`; ทุกเคสมี navigation ≤ 2 (นับ `framenavigated` ของ main frame) และไม่มี request `POST /store/carts/<id>/complete`;
  regression: AC-135, AC-129, e2e `core-32-shipping-profile-filter`, `core-40-discount-action-race` (เปิด `/th/checkout`), `thai-ui-checkout`, `core-14-buy-login` (`/buy` → `/th/checkout`) ผ่าน —
  ถ้า e2e เดิมเปิด `step=delivery` บน cart ที่ไม่มีที่อยู่ ให้ตั้งที่อยู่ผ่าน Store API ใน setup ของ test นั้น (ไม่ผ่อนกฎ) และระบุใน PR;
  (รอบ 21) เคส cart ใน cache ค้าง (กฎข้อ 103e) แยกเป็น AC-141
- AC-140 (CORE-46, กฎข้อ 104) grep: ทุกไฟล์ใน `apps/storefront/e2e/**/*.ts` (รวม `support/`) ไม่มีลำดับ `getByTestId("add-product-button").click()` ตามด้วย `toBeEnabled()` ของปุ่มเดียวกันในบรรทัดถัดไป
  (ยกเว้นบรรทัดที่มี comment อ้างกฎข้อ 101a — ขยาย AC-137 ไป `support/`); `checkoutToPayment` เรียก `addToCartFromPdp`; `core-19a-nav-cart-search.spec.ts` และ `core-24-pdp-quantity.spec.ts`
  ไม่มี `headers()["next-action"]` (ใช้ `waitForServerAction`/`isAddToCartBody`); `e2e/support/server-action.ts` มี URL `playwright.dev` ใน comment เรื่อง timeout และ PR ยกข้อความจาก docs ที่ยืนยัน;
  `apps/storefront/e2e/` ไม่มี `admin/products?limit=1` และสามไฟล์ที่แก้ใช้ `handle=` พร้อม assertion จำนวน 1; `playwright.config.ts` ไม่เปลี่ยน, diff ไม่มี `waitForTimeout`;
  spec ที่แตะ (`core-19a-nav-cart-search`, `core-24-pdp-quantity`, `affiliate-admin-programs`, `group-buy-admin-detail`, `group-buy-admin-dates` และ e2e ที่เรียก `checkoutToPayment`) ผ่าน `--repeat-each=3` (CI หรือในเครื่อง 4 workers — แนบผลใน PR)

### แผนการทดสอบ (follow-up รอบ 20)
| ระดับ | AC |
|------|----|
| unit (Vitest) | AC-138, AC-139 |
| e2e | AC-138 (1024/1280 + regression `/cart`), AC-139 (+ regression checkout), AC-140 (repeat 3) |
| grep | AC-138, AC-140 |

หมายเหตุ (บทเรียน train #280 — แนวปฏิบัติของ e2e ตั้งแต่รอบ 20, reviewer ตรวจใน PR ที่เพิ่ม/แก้ e2e): e2e ที่ใส่จำนวนมาก (≥ 10 ชิ้นต่อ line) หรือทำให้ stock ลด/หมด
ต้องสร้างสินค้า/variant ของตัวเองผ่าน admin API (stock ของตัวเองหรือ `manage_inventory: false`) แล้วลบใน `afterAll` — ห้ามใช้ stock ของสินค้า seed (`t-shirt`, `sweatshirt`) ที่ test อื่นใช้ร่วม
(train #280: e2e ของ CORE-42 ใส่ t-shirt ของ seed จำนวน 99 ทำให้ e2e ของ CORE-40 ที่รันใน train เดียวกันใส่ตะกร้าไม่ได้); test ที่แค่ต้องการ "สินค้าใดก็ได้" อ่านสินค้า seed ด้วย handle คงที่ (กฎข้อ 104d) ไม่ใช่ตัวแรกของรายการ

### Tasks (follow-up รอบ 20)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-44 | (storefront เล็ก ~130 LOC รวม test, qa #278 D-2 + O-1) หน้า `/cart`: คอลัมน์สรุปไม่ล้นที่ ≥ 1024 เมื่อมีส่วนลด + ตัวเลือกจำนวนแสดงจำนวนจริงของ line (กฎข้อ 102) — ไฟล์: `modules/cart/templates/index.tsx`, `modules/cart/components/item/index.tsx`, `lib/util/cart-quantity-options.ts` ใหม่ (+ test), e2e ใหม่ `e2e/core-44-*.spec.ts` — ☑ #287 (train #290) | AC-138 | none — **เริ่มได้** (CORE-42 ☑ #278); ∥ ทุกตัว; ชน `item/index.tsx` กับ CORE-4i (☐) ตัวที่ merge ทีหลัง rebase; ไม่บล็อก release |
| CORE-45 | (storefront เล็ก ~150 LOC รวม test, qa #276 Observation 1–2) checkout เปิด step ที่ใช้ไม่ได้ (ไม่มี step, step ไม่รู้จัก, `delivery` ก่อนมีที่อยู่, `delivery` ของ digital-only) → ขั้นแรกที่ยังไม่เสร็จ ผ่าน `checkoutRedirectStep` (กฎข้อ 103) — ไฟล์: `lib/util/digital-checkout.ts` (+ `src/ev-7c-digital-only-checkout.test.ts`), `modules/checkout/templates/checkout-form/index.tsx`, e2e (ต่อจาก `e2e/core-41-checkout-first-step.spec.ts`) — ☑ #288 (train #291; รวม D-1 ของ qa #288 → กฎข้อ 103e) | AC-139 | none — **เริ่มได้** (CORE-41 ☑ #276); ∥ ทุกตัว; ชน `checkout-form` กับ CORE-4i/CORE-19f (☐) ตัวที่ merge ทีหลัง rebase; ไม่บล็อก release |
| CORE-46 | (e2e test hygiene ~60 LOC, nit review #281/#278 + builder CORE-43) `checkoutToPayment` ใช้ `addToCartFromPdp`, comment timeout ของ `waitForResponse` ตาม docs, core-19a/core-24 เลือก action ด้วย `isAddToCartBody`, e2e admin ดึงสินค้า seed ด้วย handle (กฎข้อ 104) — ไฟล์: `e2e/support/{stripe,server-action}.ts`, `e2e/core-19a-nav-cart-search.spec.ts`, `e2e/core-24-pdp-quantity.spec.ts`, `e2e/affiliate-admin-programs.spec.ts`, `e2e/group-buy-admin-detail.spec.ts`, `e2e/group-buy-admin-dates.spec.ts` — ☑ #289 (train #290) | AC-140 | none — **เริ่มได้** (CORE-43 ☑ #281); ∥ ทุกตัว (CORE-44/45 สร้าง e2e ไฟล์ใหม่ ไม่ชน); ไม่บล็อก release |
(รอบ 20) CORE-44 ∥ CORE-45 ∥ CORE-46 เริ่มได้ทันที — ไม่มีตัวใดบล็อก release
(รอบ 21 สถานะ 2026-11-04) merge แล้วผ่าน merge train: CORE-44 ☑ #287, CORE-46 ☑ #289 (train #290); CORE-45 ☑ #288 (train #291)

### ยอมรับใน v1 / ไม่เปิด task (รอบ 20)
- `ECONNRESET` ระหว่าง Playwright `request` กับ backend ตอนรัน e2e 12 workers ในเครื่อง (builder CORE-43) — CI รัน `workers: 1` (`playwright.config.ts:14`) จึงไม่เกิดใน gate;
  เกิดเฉพาะเครื่อง dev ที่ใช้ค่า default (ครึ่งหนึ่งของจำนวน core) กับ backend process เดียวแบบ dev — ไม่ใช่พฤติกรรมของ production (spec 07 มี load test แยก) และการแก้ต้องเพิ่ม retry/infra ใน test
  ซึ่งขัด CLAUDE.md ข้อ 3; แนวทาง: รันในเครื่องด้วย `--workers=4` (ค่าเดียวกับ AC-137/AC-140) — ถ้าเกิดใน CI จริงค่อยเปิด task พร้อม log
- ชื่อสินค้ายาวตัดหลายบรรทัดที่ 375 (qa #278 O-2) — ไม่ล้นและอ่านได้

### Open questions (รอบ 20)
none

## Follow-up รอบ 21 จาก review/qa (2026-11-04 — owner อนุมัติเปิด task)
ที่มา: qa #288 (`docs/evidence/core/CORE-45/REPORT.md` D-1, Observation 1), qa #287 (`CORE-44/REPORT.md` O-1, O-2), nit review #289 (CORE-46), qa #286 (`affiliate-admin-programs` — ดู spec 05 AF-20 สำหรับ O-1),
qa #285 O-1 (spec 04 GB-15 → หมายเหตุใน spec 07 Deliverables ข้อ 11) — ตรวจโค้ดบน develop `167faba`:
- `lib/util/digital-checkout.ts:50–67` `checkoutRedirectStep` ยัง pure; `:74–86` `checkoutRedirectWithLatest` อ่าน cart ล่าสุดเฉพาะเมื่อผลจาก cart เดิมบอกให้ redirect;
  `modules/checkout/templates/checkout-form/index.tsx:46–51` ส่ง `retrieveCart(cart.id, undefined, { fresh: true })` (`cache: "no-store"` — `lib/data/cart.ts:69`) → ถ้อยคำ "ไม่ยิง API เพิ่ม" ของกฎข้อ 103 ไม่ตรงแล้ว
  → **แก้ถ้อยคำในกฎข้อ 103e (ไม่มีโค้ด ไม่สร้าง task)**;
- `checkout-form/index.tsx:33` `listCartShippingMethods(cart.id)` (`lib/data/fulfillment.ts:12–26` tag `fulfillment` + `force-cache`) ไม่ถูกอ่านใหม่เมื่อ `checkoutRedirectWithLatest` อ่าน cart แบบ fresh
  (`:49` กรองรายการเดิมด้วย cart ล่าสุด) — ข้อสังเกต ไม่เปิด task (ดู "ยอมรับใน v1" ด้านล่าง);
- `modules/cart/components/item/index.tsx:72–80` ช่องชื่อสินค้าไม่มีการตัดคำ/`min-w-0`, `:121–143` ช่อง "รวม" ไม่มี `whitespace-nowrap`; `modules/common/components/line-item-price/index.tsx:23–58` แสดงราคาขีดฆ่า + ราคาลดคนละบรรทัด —
  ที่ 375 ตาม qa (ชื่อไทยปนอังกฤษ ~90 ตัว, จำนวน 99 ยอด 7 หลัก ฿1,222,221.33 → ฿1,161,110.26 พร้อมส่วนลด + อีก line จำนวน 11) ตารางกว้างเกินจอ → `product-price` ล้นขวา 10px (`scrollWidth` 385) — ยังจริง
  (ชื่อสั้นไม่ล้น = AC-136 ผ่าน);
- `item/index.tsx:20–26` `changeLineQuantity` → `actionErrorMessage(result.error, UPDATE_QUANTITY_FAILED)`; `lib/data/cart.ts:213–216` `updateLineItem` → `actionFailure(error)` ไม่ส่ง `codes`
  (`lib/util/action-result.ts:18–32` รู้จักเฉพาะ code ใน `CHECKOUT_CONFLICTS` = 409 ของ complete — `lib/util/checkout-error.ts:4–20`) → stock ไม่พอได้ `"failed"` → ข้อความทั่วไป — ยังจริง;
  Medusa: `confirmInventoryStep` ของ `@medusajs/core-flows` (เรียกจาก `updateLineItemInCartWorkflow` ผ่าน `confirmVariantInventoryWorkflow`) throw
  `MedusaError(MedusaError.Types.NOT_ALLOWED, "Some variant does not have the required inventory", MedusaError.Codes.INSUFFICIENT_INVENTORY)` (`type` = `not_allowed`, `code` = `insufficient_inventory`)
  → `errorHandler` ของ Medusa ตอบ **400** (backend `src/api/error-handler.ts:32–36` ส่ง error ที่ไม่อยู่ใน allow-list 409 ให้ handler ของ Medusa ตามเดิม);
  `FetchError` ของ js-sdk 2.22.1 เก็บแค่ message/status (comment `checkout-error.ts:2`) → จับคู่ด้วย status 400 + `code` (ถ้ามี) หรือข้อความคงที่;
  storefront ที่อื่น**ไม่มี**ตัวแยก error นี้: PDP (`modules/products/components/product-actions/index.tsx:32–33`, `:150–151`) ใช้ fallback ที่บอกเรื่อง stock อยู่แล้วกับทุก error
  (error ที่ throw จาก server action ถูกซ่อนข้อความใน production); `modules/account/components/add-variant-error/index.tsx:36` ตรวจ stock ก่อนด้วย `canPurchaseVariant` ไม่ได้อ่าน error
  → ไม่มี helper ให้ใช้ซ้ำ ต้องเพิ่มที่เดียว;
- `e2e/core-46-e2e-hygiene.unit.spec.ts:65` `not.toMatch(/timeout/i)` (ซ้ำ `core-43-e2e-hygiene.unit.spec.ts:43`) ล้มได้แค่เพราะคำว่า timeout ใน comment; `:18–30` ซ้ำ `core-43…:12–24`
  (core-46 ครอบมากกว่า: `e2e/**/*.ts` รวม `support/`); `:59` `toMatch(/toHaveLength\(1\)/)` ค้นทั้งไฟล์ — ทั้งสามไฟล์มี `toHaveLength(1)` ของ assertion อื่น
  (`group-buy-admin-detail.spec.ts:98`, `:141`, `:206`, `:214`; `affiliate-admin-programs.spec.ts:132`) → ลบ assertion ข้าง `handle=` ทิ้งก็ยังผ่าน — ยังจริง;
- `e2e/affiliate-admin-programs.spec.ts:79`, `:124`, `:128` `waitForTimeout(300)` (core-46 unit `:63` ยกเว้นไฟล์นี้ไว้) — ยังจริง;
- `e2e/core-25-pdp-option-reset.spec.ts:40`, `core-26-cart-dropdown-total.spec.ts:221`, `flash-sale-fs19.spec.ts:162` รอ response ของ action **ใดก็ได้** ที่มี `next-action` (อาจจับ action ราคา/flash ที่ PDP ยิงตอนโหลด)
  และ `flash-sale-fs19.spec.ts:43` อ่าน header เองใน route handler — ยังจริง
Out of scope: ไฟล์ e2e อื่นที่อ่าน `next-action` เอง (เช่น `core-27`, `core-19c`, `core-4h`, `payments-*` — action อื่นหรือ mock เฉพาะ ไม่ถูกรายงาน), ข้อความ error ของการเพิ่มลงตะกร้าบน PDP (บอกเรื่อง stock อยู่แล้ว)

### สิ่งที่ Medusa มีให้อยู่แล้ว
| ความต้องการ | Medusa / ไลบรารีมีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| ตรวจ stock ตอนแก้จำนวน | `updateLineItemInCartWorkflow` → `confirmVariantInventoryWorkflow` / `confirmInventoryStep` (400, `type` `not_allowed`, `code` `insufficient_inventory`) | ใช้ตามเดิม — storefront แปลงเป็นข้อความไทยเท่านั้น ไม่ตรวจ stock เอง |
| แปลงผล server action เป็นข้อความ | `actionFailure` / `actionErrorMessage` ของ CORE-4i (`lib/util/action-result.ts`) | ขยาย — เพิ่ม code ที่รู้จัก 1 ตัว |
| ตารางสินค้า | `Table` ของ starter (`@modules/common/components/ui` — ตัวแทน `@medusajs/ui` ที่ใช้ `clsx` ต่อ `className`) | ใช้ตามเดิม — CORE-47 ส่ง className แบบ breakpoint ให้ `Table`/`Table.Header`/`Table.Body`/row/cell (กฎข้อ 105) ไม่แก้ component |
| อ่าน cart แบบไม่ cache | `retrieveCart(..., { fresh: true })` (`cache: "no-store"`) | ใช้ตามเดิม (ของ #288) |
| รอ server action ใน e2e | `waitForServerAction`, `isServerAction`, `isAddToCartBody` (`e2e/support/server-action.ts`) | ใช้ตามเดิม |
| รอ animation ของ dialog ใน e2e | `locator.evaluate` + Web Animations API (`getAnimations()`), `expect(locator).toBeVisible()` ของ Playwright | ใช้ตามเดิม — ไม่เพิ่ม dependency |

### Data model / Workflows / API routes
none

### Business rules
105. (CORE-47 — qa #287 O-1; ขยายกฎข้อ 100a; **owner เลือกทาง (C) "จัดแถวใหม่สำหรับมือถือ" 2026-11-04**) หน้า `/cart` ที่ < 1024px (`small` ใน `apps/storefront/tailwind.config.js` = `1024px`)
     แต่ละ line item (`Item` แบบ `type="full"`) แสดงเป็นแถวแบบการ์ด อ่านได้แม้ชื่อสินค้ายาว (~90 ตัว ไทยปนอังกฤษ) และยอดรวม 7 หลักมีทศนิยมพร้อมราคาขีดฆ่า
     (ที่มา: ทางเดิม "แก้เฉพาะ className ของ cell" ของ builder `a74a496` ไม่ล้นจอแต่ที่ 375 container 327px เหลือช่องชื่อ 16px — รูป 59, จำนวน 128, รวม 108 — ชื่อยาวตัดราว 50 บรรทัด):
     (a) โครงการ์ด: รูปอยู่ซ้าย; ชื่อสินค้า (`product-title`) + ตัวเลือก (`product-variant`) ใช้ความกว้างที่เหลือทั้งหมดทางขวาของรูป และตัดคำตามปกติ (`break-words` กันคำยาวล้น —
     ไม่บังคับ `[overflow-wrap:anywhere]`); บรรทัดล่างมีปุ่มลบ (`product-delete-button`), select จำนวน (`product-select-button`) และราคารวมชิดขวา
     (`product-original-price` ขีดฆ่า + `product-price`) — ตัวเลขแต่ละค่าอยู่บรรทัดเดียว (`whitespace-nowrap` ที่ cell ของ "รวม" เฉพาะ < small) ไม่ถูกตัด/ทับ และอยู่ในจอครบ;
     ข้อความ error ของการลบ/แก้จำนวน (`cart-item-remove-error`, `product-error-message`) และ `CartFlashExceedsRemaining` อยู่ในการ์ดของ line นั้น (AC-100 ที่ 375 ยังผ่าน);
     (b) วิธีทำ: **render ครั้งเดียว** — คง `<tr>` 1 ตัวและ `<td>` 5 ตัวเดิมตามลำดับเดิม แล้วสลับ display ด้วย class breakpoint: < small `tr` เป็น `grid`
     (เช่น `grid grid-cols-[auto_minmax(0,1fr)_auto]` + วาง cell ด้วย `col-span`/`row-span`/`col-start` — เลือกใน PR) และ `td` เป็น `block`; ≥ small `small:table-row` / `small:table-cell`;
     ใน `modules/cart/templates/items.tsx` < small `Table` และ `Table.Body` เป็น `block` (`block small:table`, `block small:table-row-group`) และ `Table.Header` ซ่อน
     (`hidden small:table-header-group`) — หัวคอลัมน์ "สินค้า/จำนวน/ราคา/รวม" ไม่มีความหมายในการ์ด และ `thead` ที่ยังเป็น table-row จะกำหนดความกว้างคอลัมน์ทับ grid;
     `Table` (`@modules/common/components/ui` — `clsx` ต่อ `className` ท้าย class เดิม) รับ className ได้อยู่แล้ว ไม่ต้องแก้ `ui/index.tsx`;
     (c) **ห้าม render สองชุด** (ชุดมือถือ + ชุดตาราง ซ่อนด้วย `hidden`/`small:hidden`): testid จะซ้ำใน DOM — `toHaveCount`/`getByTestId` ของ Playwright นับ element ที่ซ่อนด้วย
     (`core-19c-delete-button-error.spec.ts:115` คาด `product-delete-button` 1 ตัวต่อแถว) และ `core-42-cart-voucher-layout.spec.ts:72–78` อ่าน `td` ทั้งหมดของแถวกับ `product-select-button` ตัวแรกใน DOM;
     testid เดิมทุกตัว (`product-row`, `product-title`, `product-variant`, `product-delete-button`, `product-select-button`, `product-error-message`, `product-unit-price`, `product-price`,
     `product-original-price`, `cart-items-header`) ต้องมี **1 ตัวต่อแถวใน DOM** และไม่แก้ locator ของ e2e เดิม;
     (d) class ของการ์ดทั้งหมดใน `Item` ใส่ผ่านเงื่อนไข `type === "full"` (`clx({...})`) — **`type="preview"` ห้ามเปลี่ยน** (`modules/cart/templates/preview.tsx` = สรุปตะกร้าใน checkout
     ซึ่งแสดงที่ < 1024 ด้วย) DOM/class ของ preview ต้องเท่าเดิม;
     (e) ≥ 1024 (`small:`) layout ตารางเหมือนเดิมทุกพิกเซล: header 5 ช่อง, padding ของ th/td = `DESKTOP_BASELINE` ของ `core-42-cart-voucher-layout.spec.ts:84–88`,
     กล่องลบ/จำนวน `w-28` (112px), รูป `small:w-24`, `product-unit-price` แสดง — กฎข้อ 100a/102a และ CORE-44 (AC-138) ห้ามถอย;
     (f) **ไม่แก้** `LineItemPrice`, `LineItemOptions`, `LineItemUnitPrice`, `DeleteButton`, `CartItemSelect` (ใช้ร่วมกับ order/checkout/dropdown) และไม่แก้ logic
     (`changeLineQuantity`, `cartQuantityOptions`) — แตะเฉพาะ className/โครงสร้าง wrapper ใน `item/index.tsx` และ className ใน `items.tsx`;
     `SkeletonLineItem` (ตอนโหลด) คงเดิม
106. (CORE-48 — qa #287 O-2) แก้จำนวนบน `/cart` แล้ว Medusa ตอบ stock ไม่พอ → `product-error-message` แสดงข้อความไทยเฉพาะ
     `INSUFFICIENT_INVENTORY_MESSAGE` = "สินค้ามีไม่พอตามจำนวนที่เลือก กรุณาลดจำนวนแล้วลองใหม่อีกครั้ง" (ค่าคงที่ที่เดียว):
     (a) `updateLineItem` (`lib/data/cart.ts`) คืน `{ error: "INSUFFICIENT_INVENTORY" }` เมื่อ error มี status 400 **และ** (`code === "insufficient_inventory"` หรือข้อความ
     (ตัด `.` ท้าย ไม่สนตัวพิมพ์ — แบบ `normalize` ของ `checkout-error.ts:23`) = `"Some variant does not have the required inventory"`) ผ่าน helper pure ตัวเดียวใน `lib/util/`
     (เช่น `isInsufficientInventory(error)`) ที่ `actionFailure` ใช้ (ขยาย argument `codes` เดิม หรือเรียกก่อน `actionFailure` — เลือกใน PR);
     **ไม่**เพิ่มลง `CHECKOUT_CONFLICTS` (map ของ 409 ตอน complete ที่ `src/checkout-conflict-contract.test.ts:40–44` นับจำนวนให้เท่ากับ backend);
     (b) error อื่น (5xx, network, 400 อื่น) คง `UPDATE_QUANTITY_FAILED`; 401/403 คง `SIGN_IN_AGAIN_MESSAGE` (กฎข้อ 72);
     (c) หลัง error `product-select-button` แสดงจำนวนจริงของ line (Medusa ไม่แก้ line) และ error หายเมื่อแก้จำนวนสำเร็จครั้งถัดไป;
     (d) ไม่ตรวจ stock ฝั่ง storefront เอง ไม่ตั้งเพดานจำนวน (กฎข้อ 102b คงเดิม)
107. (CORE-49 — test hygiene, nit review #289 + qa #286/#288) (a) grep test "`add-product-button` `click()` ตามด้วย `toBeEnabled()`" และการตรวจ `playwright.config.ts` อยู่ที่เดียวใน
     `e2e/core-46-e2e-hygiene.unit.spec.ts` (ครอบ `e2e/**/*.ts` รวม `support/`) — ลบตัวที่ซ้ำใน `core-43-e2e-hygiene.unit.spec.ts:12–24` และ `:43`;
     (b) การตรวจ config ห้ามเฉพาะ**การตั้งค่า** timeout: regex ของ key `timeout`, `actionTimeout`, `navigationTimeout` ที่ตามด้วย `:` (เช่น `/\b(timeout|actionTimeout|navigationTimeout)\s*:/`)
     — ครอบ `timeout`/`expect.timeout` (กฎข้อ 101b) และ `actionTimeout` (ที่ comment ของ `e2e/support/server-action.ts:8–13` อ้างว่าไม่ได้ตั้ง) โดยคำว่า timeout ใน comment ไม่ทำให้ล้ม;
     (c) assertion จำนวน 1 ของสินค้า seed (กฎข้อ 104d) ต้องอยู่ติดการดึง: ในสามไฟล์ `toHaveLength(1)` อยู่ภายใน 3 บรรทัดถัดจากบรรทัดที่มี `/admin/products?handle=` (regex หลายบรรทัด) — ไม่ค้นทั้งไฟล์;
     (d) `affiliate-admin-programs.spec.ts` ไม่มี `waitForTimeout`: `:79` (ไม่มี POST หลัง validation ล้ม) และ `:124` (ไม่มี DELETE หลัง "Keep program") ใช้ assertion ที่พิสูจน์ได้แทนการรอเวลา —
     คง `expect(requests).toEqual([])` ทันทีหลัง error แสดง และให้ assertion นับ request ของขั้นถัดไปเป็นตัวพิสูจน์ (`:89` คาด `POST` เดียว, `:132` คาด `DELETE` เดียว — request เกินจะล้มที่นั่น) พร้อม comment;
     `:128` (animation ก่อนถ่าย evidence) รอ `alertdialog` visible แล้วรอ animation ของ dialog จบ (`getAnimations({ subtree: true })` → `finished`) — builder ยืนยันในเครื่องว่าภาพ evidence ไม่ใช่ภาพกลาง transition;
     (e) `core-25-pdp-option-reset.spec.ts:40`, `core-26-cart-dropdown-total.spec.ts:221`, `flash-sale-fs19.spec.ts:162` ใช้ `waitForServerAction(page, isAddToCartBody)`;
     `flash-sale-fs19.spec.ts:43` (route handler ที่ mock action ข้อมูล flash) ใช้ `isServerAction(req, (body) => body.includes(variantId))` — พฤติกรรมของ test คงเดิม

### Acceptance criteria (follow-up รอบ 21)
- AC-141 (กฎข้อ 103e — ☑ ครอบแล้วโดย #288 ไม่มี task) unit (Vitest) `src/ev-7c-digital-only-checkout.test.ts:261–301`: Given cart จาก cache ไม่มีที่อยู่ + cart ล่าสุดมีที่อยู่ When `checkoutRedirectWithLatest("delivery", …)`
  Then `redirectStep === null`, ใช้ cart ล่าสุด และ `loadLatest` ถูกเรียก 1 ครั้ง; ไม่มี step + cart ล่าสุดพร้อมจ่าย → `"payment"`; cart ล่าสุดก็ยังไม่มีที่อยู่ → `"address"`;
  cart จาก cache ไม่ต้อง redirect → `loadLatest` ไม่ถูกเรียก; `loadLatest` คืน `null` → ใช้ผลจาก cart เดิม;
  e2e `e2e/core-41-checkout-first-step.spec.ts:206–230` (D-1): Given หน้าเปิด `/th/checkout?step=address` ขณะ cart ไม่มีที่อยู่ (cache cart ไว้) แล้วตั้งที่อยู่ผ่าน Store API ตรง (ไม่มี `revalidateTag`)
  When เปิด `?step=delivery` Then URL ยังเป็น `step=delivery`, `delivery-option-radio` visible, `shipping-first-name-input` count 0, navigation ≤ 2 และไม่มี `POST …/complete`;
  grep: `checkout-form/index.tsx` เรียก `checkoutRedirectWithLatest` และ `{ fresh: true }`
- AC-142 (CORE-47, กฎข้อ 105) e2e `e2e/core-47-cart-375-long-title.spec.ts`: Given สินค้าของ test เอง (`manage_inventory: false` ผ่าน admin API, ลบใน `afterAll` — แนวปฏิบัติรอบ 20) 2 ตัว
  ชื่อคงที่ในไฟล์ test ยาว 85–95 ตัว ที่มีทั้งอักษรไทย (`/[฀-๿]/`) และคำอังกฤษ ราคาต่อหน่วย ฿12,345.67; cart ของ A: line 1 จำนวน 99 (ยอด ≥ ฿1,000,000.00) และ line 2 จำนวน 11
  + โค้ดส่วนลด 5% ผ่าน Store API (token ของ A)
  (a) 375×812 When เปิด `/th/cart` Then `product-row` count 2; `document.documentElement.scrollWidth ≤ 375`; ทุก testid ในกฎข้อ 105c (ที่ line มี) count 1 ภายในแต่ละ `product-row`;
  ทุก `product-title`: `textContent` เท่ากับชื่อที่สร้าง, `right ≤ 375`, ความกว้าง `≥ 0.6 ×` ความกว้างของ `product-row` ของแถวนั้น
  (เหตุผล: เหลือได้แค่ช่องรูป ≤ 40% — ถ้าช่องชื่อยังอยู่แถวเดียวกับช่องจำนวน 128px + ช่องรวม ≥ 108px จะได้ ≤ ~28% ของแถว 327px; `a74a496` ได้ 16px ≈ 5%)
  และจำนวนบรรทัด `Math.round(height / lineHeight) ≤ 5` โดย `lineHeight = parseFloat(getComputedStyle(el).lineHeight)` ต้องเป็นตัวเลข (ไม่ใช่ `normal`)
  (เหตุผล: ~90 ตัวที่กว้าง ≥ 196px ได้ราว 3–4 บรรทัด เผื่อฟอนต์ไทยของเครื่อง CI กว้างกว่า 1 บรรทัด; ก่อนแก้ ~50 บรรทัด);
  ทุก `product-price` และ `product-original-price`: `left ≥ 0`, `right ≤ 375`, `elementFromPoint` ที่จุดกลางอยู่ภายใน element นั้น และ `Range` ที่ครอบเนื้อหา (`selectNodeContents`)
  มี `getClientRects().length === 1` (ตัวเลขไม่ถูกตัดบรรทัด); ราคาชิดขวา: `max(right ของ product-price, product-original-price) ≥ right ของ product-row − 2`;
  ราคา/select/ปุ่มลบอยู่บรรทัดล่าง: `top` ของ `product-price`, `product-select-button` และ `product-delete-button` `≥ bottom` ของ `product-variant` ในแถวเดียวกัน (−1px);
  `product-select-button` และ `product-delete-button` มี `elementFromPoint` ที่จุดกลางอยู่ภายใน element นั้น (`el.contains(hit)`) และ `cart-items-header` ไม่ visible;
  (b) 375 When `selectOption("2")` ที่ `product-select-button` ของแถวจำนวน 11 (หาแถวด้วย `product-row` ที่ `product-title` ตรงชื่อ) Then `inputValue() === "2"` และ `GET /store/carts/:id` (token ของ A)
  line นั้น quantity = 2 (`expect.poll`); When คลิก `product-delete-button` ของแถวเดียวกัน Then `product-row` count 1 และ Store API มี 1 line;
  (c) 1023×800 When เปิด `/th/cart` Then `getComputedStyle(product-row).display !== "table-row"` (ขอบ breakpoint เป็นการ์ด) และ `scrollWidth ≤ 1023`;
  (d) 1024×768 และ 1280×800 (cart เดียวกันก่อนข้อ b) When เปิด `/th/cart` Then `cart-items-header` มี `th` 5 ตัว visible ทั้งหมด; ทุก `product-row` `display === "table-row"`
  และ `td` ทุกตัว `display === "table-cell"`; padding ของ th/td แถวแรกเท่า `DESKTOP_BASELINE` ของ `core-42-cart-voucher-layout.spec.ts:84–88` และกล่องลบ/จำนวน
  (`product-select-button.closest("td").firstElementChild`) กว้าง 112; ลิงก์รูปกว้าง 96; `product-unit-price` visible; `scrollWidth ≤` ความกว้าง viewport;
  (e) preview ไม่เปลี่ยน: 375×812 When เปิด `/th/checkout` (cart เดียวกัน ไม่กรอกข้อมูล ไม่กดชำระ) Then ทุก `product-row` ภายใน `items-table` มี `display === "table-row"` (ถ้าที่ 375 สรุปตะกร้าถูกพับหรือหา `items-table` ไม่เจอ ให้เปิดสรุปตะกร้าก่อน ถ้าทำไม่ได้ให้ตรวจที่ 1280 แทน และเพิ่ม grep ว่า class ของการ์ดอยู่ภายใต้เงื่อนไข `type === "full"` เท่านั้น — session หลัก 2026-11-04);
  test ต้อง fail กับ develop `1c664a9` (ข้อ a: ความกว้าง/บรรทัดของ `product-title` หรือ `scrollWidth`) — แนบผลใน PR;
  e2e เดิมผ่านโดยไม่แก้ locator: `core-42-cart-voucher-layout` (AC-136, 375 + 1280), `core-44-cart-summary-qty` (AC-138, 1024/1280), `core-19c-delete-button-error` (AC-100, 1280 + 375),
  `thai-ui-cart-order`, `core-14g-action-stale-jwt`, `flash-sale-fs15`, `core-26-cart-dropdown-total`;
  qa เทียบภาพ `/th/cart` ที่ 1024 และ 1280 กับ develop (ข้อมูลเดียวกัน) ว่าไม่ต่าง และแนบภาพ 375 ชื่อยาวใน `REPORT.md`
- AC-143 (CORE-48, กฎข้อ 106) unit (Vitest): helper คืน `true` กับ `{ status: 400, message: "Some variant does not have the required inventory" }`, ข้อความเดียวกันที่มี `.` ท้าย/ตัวพิมพ์ต่าง,
  และ `{ status: 400, code: "insufficient_inventory", message: "x" }`; คืน `false` กับ 400 ข้อความอื่น, 500 ข้อความเดียวกัน, 409, `null`/`undefined`/string;
  `updateLineItem` (mock `sdk.store.cart.updateLineItem` reject ด้วย error ข้างต้น, มี JWT + cart id) → `{ error: "INSUFFICIENT_INVENTORY" }`;
  `changeLineQuantity` → `INSUFFICIENT_INVENTORY_MESSAGE` เมื่อได้ code นี้, `UPDATE_QUANTITY_FAILED` เมื่อ `"failed"`, `SIGN_IN_AGAIN_MESSAGE` เมื่อ `"unauthorized"`; `src/checkout-conflict-contract.test.ts` ผ่านโดยไม่แก้;
  e2e ที่ 1280×800 และ 375×812: Given สินค้าของ test เอง `manage_inventory: true` stock 5 (location ของ seed, ลบใน `afterAll`), cart ของ A จำนวน 1 ผ่าน Store API When `/th/cart` → `selectOption("10")` ของ `product-select-button`
  Then `product-error-message` visible, `textContent` เท่ากับ `INSUFFICIENT_INVENTORY_MESSAGE` และตรง `/[฀-๿]/`, `product-select-button` `inputValue() === "1"`,
  `GET /store/carts/:id` (token ของ A) quantity = 1; When `selectOption("3")` Then `product-error-message` count 0 (หรือว่าง) และ quantity = 3 — e2e นี้ยืนยันข้อความ/สถานะจริงของ Medusa 2.22.1 ที่ pin
  (ถ้าไม่ตรงให้หยุดรายงาน ไม่เดา); AC-138 และ `core-19c-delete-button-error` ผ่าน
- ☑ AC-144 (CORE-49, กฎข้อ 107) grep/unit (Playwright `unit` project): `core-43-e2e-hygiene.unit.spec.ts` ไม่มี `add-product-button").click()` และไม่อ่าน `playwright.config.ts`; `core-46-e2e-hygiene.unit.spec.ts` มีทั้งสอง;
  regex ของ config ผ่านกับ `playwright.config.ts` ปัจจุบัน และ PR แนบผล mutation: เพิ่ม comment ที่มีคำว่า timeout → ยังผ่าน, เพิ่ม `timeout: 1`, `actionTimeout: 1` หรือ `expect: { timeout: 1 }` → ล้ม;
  ลบ `toHaveLength(1)` ที่อยู่ถัดจาก `handle=` ในไฟล์ใดไฟล์หนึ่งของสามไฟล์ → test ของกฎข้อ 104d ล้ม (แนบผลใน PR); `affiliate-admin-programs.spec.ts` ไม่มี `waitForTimeout` และอยู่ในรายการไฟล์ที่ตรวจ
  `waitForTimeout` ของ core-46 (ลบ comment ยกเว้นที่ `:63`); `core-25-pdp-option-reset.spec.ts`, `core-26-cart-dropdown-total.spec.ts`, `flash-sale-fs19.spec.ts` ไม่มี `headers()["next-action"]` และมี
  `waitForServerAction(page, isAddToCartBody)` (fs19 มี `isServerAction(` ด้วย); `playwright.config.ts` ไม่เปลี่ยน; diff ไม่มี `waitForTimeout`;
  e2e `affiliate-admin-programs`, `core-25-pdp-option-reset`, `core-26-cart-dropdown-total`, `flash-sale-fs19` ผ่าน `--repeat-each=3` (CI หรือในเครื่อง 4 workers — แนบผลใน PR)

### แผนการทดสอบ (follow-up รอบ 21)
| ระดับ | AC |
|------|----|
| unit (Vitest) | AC-141 (มีแล้ว), AC-143 |
| unit (Playwright `unit` project, grep) | AC-144 |
| e2e | AC-141 (มีแล้ว), AC-142 (375 + 1023 + regression 1024/1280 + preview ใน checkout 375), AC-143 (1280/375), AC-144 (repeat 3) |

### Tasks (follow-up รอบ 21)
| ID | Task | ไฟล์ที่แตะ | ขนาด | Viewport | AC | Depends |
|----|------|------|------|------|----|---------|
| CORE-47 | (storefront, qa #287 O-1; **owner เลือกทาง (C) 2026-11-04** แทนทางเดิม "แก้เฉพาะ className ของ cell" — `a74a496` ไม่ล้นแต่ช่องชื่อเหลือ 16px) `/cart` ที่ < 1024 แต่ละ line เป็นแถวแบบการ์ด: รูปซ้าย, ชื่อ + ตัวเลือกใช้ความกว้างที่เหลือ, บรรทัดล่างปุ่มลบ + select จำนวน + ราคารวมชิดขวาไม่ตัดตัวเลข; ≥ 1024 ตารางเดิมทุกพิกเซล; `type="preview"` ไม่เปลี่ยน (กฎข้อ 105) | `modules/cart/components/item/index.tsx` (className แบบ breakpoint ของ `tr`/`td` + wrapper เฉพาะ `type === "full"`), `modules/cart/templates/items.tsx` (className ของ `Table`/`Table.Header`/`Table.Body`), e2e ใหม่ `e2e/core-47-cart-375-long-title.spec.ts` — ☑ #298 (train #299) | ~150 LOC รวม e2e | 375×812, 1023×800 (+ regression 1024×768, 1280×800) | AC-142 | none — **เริ่มได้**; ∥ ทุกตัว; ชน `item/index.tsx` กับ CORE-48 (และ CORE-4i ☐) ตัวที่ merge ทีหลัง rebase; ไม่บล็อก release |
| CORE-48 | (storefront, qa #287 O-2) แก้จำนวนเกิน stock → ข้อความไทยว่าสินค้าไม่พอ แทนข้อความทั่วไป (กฎข้อ 106) | `lib/data/cart.ts` (`updateLineItem`), helper ใหม่ใน `lib/util/` (+ unit Vitest ใน `src/`), `modules/cart/components/item/index.tsx` (`changeLineQuantity` + ค่าคงที่ข้อความ), e2e ใหม่ `e2e/core-48-cart-insufficient-stock.spec.ts` — ☑ #300 (train #307) | ~130 LOC รวม test | 1280×800, 375×812 | AC-143 | none — **เริ่มได้** (CORE-4i-a ☑, CORE-44 ☑ #287); ∥ ทุกตัว; ชน `item/index.tsx` กับ CORE-47/CORE-4i และ `lib/data/cart.ts` กับ CORE-4i (☐) ตัวที่ merge ทีหลัง rebase; ไม่บล็อก release |
| CORE-49 | (e2e test hygiene, nit review #289 + qa #286/#288) รวม grep test ไว้ที่ core-46, regex config เฉพาะ key timeout, `toHaveLength(1)` ติด `handle=`, ตัด `waitForTimeout` ของ affiliate-admin-programs, core-25/core-26/fs19 ใช้ `waitForServerAction`/`isServerAction` (กฎข้อ 107) | `e2e/core-46-e2e-hygiene.unit.spec.ts`, `e2e/core-43-e2e-hygiene.unit.spec.ts`, `e2e/affiliate-admin-programs.spec.ts`, `e2e/core-25-pdp-option-reset.spec.ts`, `e2e/core-26-cart-dropdown-total.spec.ts`, `e2e/flash-sale-fs19.spec.ts` | ~70 LOC | ไม่มี UI ใหม่ (e2e เดิมรันที่ viewport เดิมของแต่ละไฟล์) | AC-144 | none — **เริ่มได้** (CORE-46 ☑ #289); ∥ ทุกตัว (ไม่มี task อื่นแตะไฟล์เหล่านี้); ไม่บล็อก release |
(รอบ 21) CORE-47 ∥ CORE-48 ∥ CORE-49 เริ่มได้ทันที (และ ∥ AF-20 ของ spec 05) — ไม่มีตัวใดบล็อก release; CORE-47 กับ CORE-48 แตะ `item/index.tsx` คนละส่วน (CORE-47 = className/JSX ของแถว, CORE-48 = `changeLineQuantity` + ค่าคงที่ข้อความ) ตัวที่ merge ทีหลัง rebase

### ยอมรับใน v1 / ไม่เปิด task (รอบ 21)
- กฎข้อ 103 "ไม่ยิง API เพิ่ม" → แก้ถ้อยคำเป็นกฎข้อ 103e + AC-141 (ครอบโดย test ที่ merge แล้วใน #288) — ไม่มีโค้ด
- รายการ shipping option ใน `checkout-form/index.tsx:33` มาจาก cache tag `fulfillment` ของ request ก่อนหน้า (ไม่ถูกอ่านใหม่ตอนอ่าน cart แบบ fresh ของกฎข้อ 103e):
  **ไม่มีผลตอนนี้** — seed มี service zone เดียวทั้งประเทศ (`apps/backend/src/scripts/seed.ts:246` geo zone `country` = TH) option จึงไม่ขึ้นกับที่อยู่ และ e2e D-1 (`core-41-checkout-first-step.spec.ts:220–227`)
  ที่ cache หน้าไว้ตอนยังไม่มีที่อยู่ก็ยังเห็น `delivery-option-radio` หลังตั้งที่อยู่; mutation ของ cart ใน storefront revalidate tag `fulfillment` พร้อม `carts` อยู่แล้ว (`lib/data/cart.ts:134–135`, `:222–223`)
  — ถ้าเพิ่ม service zone/geo zone ระดับจังหวัดหรือ option ที่ขึ้นกับที่อยู่ ให้ task นั้นอ่านรายการ option แบบ fresh คู่กับ cart ใน `checkoutRedirectWithLatest`
- (qa #288 Observation 1) ตอนรัน e2e 12 workers ในเครื่อง (load average 32–63) กด `checkout-button` บน `/th/cart` แล้วบางครั้งไม่ย้ายหน้าภายใน 30 วินาที (RSC ของ `?step=address` ตอบ 200 แต่ router ไม่ย้าย);
  ที่ 8 workers ไม่เกิด — CI รัน `workers: 1` (`playwright.config.ts:14`) จึงไม่อยู่ใน gate และเป็นอาการเดียวกับ `ECONNRESET` ของรอบ 20 (เครื่องโหลดเกิน ไม่ใช่พฤติกรรมของ production);
  แนวทาง: รันในเครื่องด้วย `--workers=4` ถ้าเกิดใน CI หรือที่ ≤ 4 workers ค่อยเปิด task สอบสวนพร้อม trace
- (qa #285 O-1) `medusa start` (NODE_ENV=production) ตั้ง session cookie ของ admin เป็น `Secure` → login admin ผ่าน http ที่ไม่ใช่ localhost ไม่ติด — เป็นพฤติกรรมตั้งใจของ Medusa;
  บันทึกเป็นข้อกำหนดของ prod ใน spec 07 Deliverables ข้อ 11 (spec 07 ยังไม่เคยระบุ)

### Open questions (รอบ 21)
none

## Follow-up รอบ 23 จาก review/qa (2026-11-05 — owner อนุมัติให้ทำรอบถัดไป)
ที่มา: qa CORE-47 #298 (`docs/evidence/core/CORE-47/REPORT.md` O-1), qa AF-20 #295 (`docs/evidence/affiliate/AF-20/REPORT.md` O-1, O-2), nit review #295 (AF-20) และ #298 (CORE-47)
— merge แล้วผ่าน train #299: CORE-47 #298, AF-20 #295 (spec 05); ตรวจโค้ดบน develop `a349676` (path ย่อจาก `apps/storefront/`):
- `src/modules/layout/templates/nav/index.tsx:17–58`: nav เป็น 3 คอลัมน์ — ซ้าย `nav-menu-button` (`flex-1 basis-0`), กลาง `nav-store-link` (`txt-compact-xlarge-plus uppercase`, ไม่มี `whitespace-nowrap`),
  ขวา `nav-search-button` + (`hidden small:flex` บัญชี) + `nav-cart-link` ใน `gap-x-6` (`flex-1 basis-0`); `content-container` = `px-6` (`src/styles/globals.css:54–56`) → ที่ 320 เหลือ 272px
  ให้ทั้งสามคอลัมน์; `nav-cart-link` (`src/modules/layout/components/cart-dropdown/index.tsx:112–116`, ข้อความ `ตะกร้า (${totalItems})`) ไม่มี `whitespace-nowrap` → "ตะกร้า (116)" ตัด 2 บรรทัด
  เกือบชนไอคอนค้นหา (qa #298 O-1) และชื่อร้าน "ร้านค้าของเรา" ชิดไอคอนค้นหา (qa #295 O-2) — ยังจริง
- `e2e/core-42-cart-voucher-layout.spec.ts:84–88` และ `e2e/core-47-cart-375-long-title.spec.ts:29–34` มี `DESKTOP_BASELINE` ค่าเดียวกันสองชุด (comment `:29` บอกว่าคัดลอกเพราะ import ไฟล์ spec จะลงทะเบียน test ซ้ำ)
  — ผู้ใช้ 2 ที่แล้ว → ย้ายไป `e2e/support/` — ยังจริง
- `e2e/support/affiliate.ts:13–20` `createActiveAffiliate(request, admin, prefix?, email?, name?, code?)` optional แบบตำแหน่ง 4 ตัว ผู้เรียก 20 จุดใน 10 ไฟล์
  (`affiliate-header-overflow.spec.ts:120–127` ต้องส่ง `undefined` แทน email) — ยังจริง;
  `e2e/affiliate-header-overflow.spec.ts:92–99` `longCode()` สุ่ม a-z (`letters`) ความกว้างของรหัสจึงต่างกันทุกรอบ (`w` กับ `i`) — ยังจริง;
  `:11` `test.use({ evidenceTarget: { …, taskId: "AF-19" } })` ระดับไฟล์ครอบ describe ของ AC-52 (AF-20, `:111–160`) ด้วย — ยังจริง (test ของ AF-20 ไม่เรียก `evidence()` จึงยังไม่มีไฟล์ผิดโฟลเดอร์)
- CORE-49 (☐ — ไม่อยู่ในรายการงานที่กำลังทำของ session หลัก 2026-11-05) แตะ `core-43/core-46-e2e-hygiene.unit.spec.ts`, `affiliate-admin-programs`, `core-25`, `core-26`, `flash-sale-fs19` — **ไม่มีไฟล์ซ้ำ**กับรายการข้างบน แต่รวมแล้ว diff เกิน ~200 LOC
  และขอบเขตต่างกัน (CORE-49 = รอเงื่อนไขจริง; รายการนี้ = ของกลาง/API ของ helper) → **เปิดเป็น task ใหม่ CORE-51** ไม่ขยาย CORE-49
Out of scope: เปลี่ยนข้อความ/ไอคอนของ nav (คง "เมนู", ชื่อร้าน, "ตะกร้า (n)" ตาม ADR-014), nav ที่ ≥ 1024, header ของ affiliate portal

### สิ่งที่ Medusa มีให้อยู่แล้ว (รอบ 23)
| ความต้องการ | Medusa / ไลบรารีมีให้ | ใช้ตามเดิม / ขยาย / custom |
|------|------|------|
| nav ของร้าน | `Nav` ของ Medusa Next.js Starter (`templates/nav`) + Tailwind | ขยาย — แก้ className แบบ breakpoint `< small` เท่านั้น ไม่เพิ่ม component |
| วัด layout ใน e2e | Playwright `boundingBox`, `evaluate` + `Range.getClientRects` (แบบ AC-142) | ใช้ตามเดิม |
| ของกลาง e2e | `e2e/support/*` | ขยาย — เพิ่มไฟล์ค่าคงที่ของ layout cart |

### Data model / Workflows / API routes
none

### Business rules (รอบ 23)
108. (CORE-50 — qa #298 O-1 + qa #295 O-2) nav ที่ < 1024px (`small`) ตั้งแต่ 320px:
     (a) `nav-menu-button`, `nav-store-link`, `nav-search-button`, `nav-cart-link` ไม่ทับกัน — ระยะแนวนอนระหว่างตัวที่ติดกัน ≥ 8px และทุกตัวอยู่ใน `[0, viewport]`;
     (b) `nav-cart-link` และ `nav-store-link` อยู่บรรทัดเดียว (`whitespace-nowrap`) และชื่อร้านแสดงครบ (ไม่ตัดด้วย `truncate`/ellipsis) แม้ตะกร้ามี 3 หลัก; ความสูง header คง `h-16`;
     (c) วิธีทำเลือกใน PR ตามผลวัด เฉพาะ class `< small` (เช่น `gap-x-6` → `gap-x-3`, ขนาดตัวอักษรชื่อร้านเล็กลง, `min-w-0`/`shrink-0` ของคอลัมน์, padding ของ `content-container` ภายใน nav) —
         **ห้าม render สองชุด** (testid ซ้ำ — กฎข้อ 105c) และไม่เปลี่ยนข้อความ; ถ้าที่ 320 ทำ (a)+(b) พร้อมกันไม่ได้โดยไม่เปลี่ยนข้อความ ให้หยุดรายงาน planner (owner ตัดสินเรื่องข้อความ/ไอคอน);
     (d) ≥ 1024 เหมือนเดิม: ชื่อร้านอยู่กึ่งกลาง viewport, `nav-account-link` แสดง, class `small:` เดิมไม่เปลี่ยน
109. (CORE-51 — test hygiene, nit review #295/#298) (a) `DESKTOP_BASELINE` อยู่ที่ `e2e/support/cart-layout.ts` (ใหม่) ไฟล์เดียว — `core-42-cart-voucher-layout.spec.ts`
     และ `core-47-cart-375-long-title.spec.ts` import (ลบ comment "คัดลอก" ที่ core-47 `:29`) ค่าเท่าเดิม;
     (b) `createActiveAffiliate(request, admin, options?)` รับ `{ prefix?, email?, name?, code? }` ค่า default เท่าเดิม (`prefix` = `"e2e-af2"`, `name` = `` `E2E ${prefix}` ``, `code` = `<prefix>-<สุ่ม>`, `email` = `<code>@example.com`)
         ผู้เรียกทุกจุดเปลี่ยนเป็น object (ไม่ส่ง `undefined` แทนตำแหน่ง);
     (c) `longCode()` ใน `affiliate-header-overflow.spec.ts` ไม่สุ่มตัวอักษร: ส่วนที่ต่างกันต่อรอบเป็นตัวเลขเท่านั้น (เช่น timestamp ฐาน 10) ตัวอักษรที่เหลือคงที่ ยาว 32 ตัว มี `-` ≥ 3 ตัว
         และผ่าน regex ของ register เดิม — ความกว้างของรหัสคงที่ทุกรอบ;
     (d) describe ของ AC-52 (AF-20) ใน `affiliate-header-overflow.spec.ts` ตั้ง `evidenceTarget` เป็น `{ feature: "affiliate", taskId: "AF-20" }` ของตัวเอง (AC-51 คง AF-19);
         ไม่เพิ่มการเรียก `evidence()` (โฟลเดอร์ AF-20 มีภาพครบงบ 5 รูปแล้ว)

### Acceptance criteria (follow-up รอบ 23)
- AC-145 (CORE-50, กฎข้อ 108) e2e ใหม่ `e2e/core-50-nav-narrow.spec.ts`: Given สินค้าของ test เอง (`manage_inventory: false` ผ่าน admin API, ลบใน `afterAll` — แนวปฏิบัติรอบ 20) และ cart ของ A
  จำนวนรวม 116 (ผ่าน Store API, token ของ A) When เปิด `/th` ที่ 320×640, 375×812, 639×812 และ 1023×800 Then `nav-cart-link` `textContent` ตรง `/^ตะกร้า \(116\)$/` (มีอักษรไทย `/[฀-๿]/`);
  สำหรับคู่ที่ติดกัน (`nav-menu-button`→`nav-store-link`→`nav-search-button`→`nav-cart-link`) `left ของตัวขวา − right ของตัวซ้าย ≥ 8`; ทุกตัว `left ≥ 0`, `right ≤ viewport`;
  `Range.selectNodeContents` ของ `nav-cart-link` และ `nav-store-link` มี `getClientRects().length === 1`; `nav-store-link` มี `scrollWidth ≤ clientWidth` และ `textContent` = ชื่อร้านเต็ม;
  `document.documentElement.scrollWidth ≤ viewport`; ความสูงของ `header` = 64; When 1280×800 Then `|centerX(nav-store-link) − 640| ≤ 1`, `nav-account-link` visible และระยะ/ขนาดของทั้ง 4 ตัว
  เท่ากับที่วัดบน develop `a349676` (±1px — แนบค่าใน PR); test ต้องล้มบน develop ที่ 320 (บรรทัดของ `nav-cart-link` หรือระยะ < 8);
  e2e เดิมผ่านโดยไม่แก้ locator: `core-19a-nav-cart-search` (375), `core-26-cart-dropdown-total`; qa แนบภาพ 320 ใน `REPORT.md`
- AC-146 (CORE-51, กฎข้อ 109) grep/unit (Playwright `unit` project, ต่อจาก `core-46-e2e-hygiene.unit.spec.ts`): ใน `e2e/**/*.ts` มี `DESKTOP_BASELINE = {` เฉพาะ `e2e/support/cart-layout.ts`
  และสองไฟล์ cart import จากที่นั่น; ทุกการเรียก `createActiveAffiliate(` (regex หลายบรรทัด) มีอาร์กิวเมนต์ไม่เกิน 3 ตัวและตัวที่ 3 (ถ้ามี) ขึ้นต้นด้วย `{`; `affiliate-header-overflow.spec.ts`
  ไม่มี `letters(` ใน `longCode` และมี `taskId: "AF-20"`; ใน test ของ AC-52 assertion ใหม่ `code.replace(/\d/g, "0")` เท่ากับค่าคงที่ในไฟล์; `pnpm --filter storefront typecheck` (หรือ `pnpm typecheck`) ผ่าน;
  e2e `core-42-cart-voucher-layout`, `core-47-cart-375-long-title`, `affiliate-header-overflow` และไฟล์ที่เรียก `createActiveAffiliate` ทั้ง 10 ไฟล์ผ่าน (CI)

### แผนการทดสอบ (follow-up รอบ 23)
| ระดับ | AC |
|------|----|
| unit (Playwright `unit` project, grep) | AC-146 |
| e2e | AC-145 (320/375/639/1023 + regression 1280), AC-146 (ไฟล์ที่แตะทั้งหมด) |

### Tasks (follow-up รอบ 23)
| ID | Task | ไฟล์ที่แตะ (`apps/storefront/`) | ขนาด | Viewport | AC | Depends | ชนกับงานที่กำลังทำ |
|----|------|------|------|------|----|---------|------|
| CORE-50 | (storefront, qa #298 O-1 + qa #295 O-2) nav ที่ < 1024 ตั้งแต่ 320: ชื่อร้าน/ไอคอนค้นหา/"ตะกร้า (n)" ไม่ชิด/ทับกัน และ "ตะกร้า (n)" บรรทัดเดียว (กฎข้อ 108) | `src/modules/layout/templates/nav/index.tsx`, `src/modules/layout/components/cart-dropdown/index.tsx` (เฉพาะ className ของ `nav-cart-link`), `src/modules/layout/components/side-menu/index.tsx` (ถ้าต้องแก้ className), e2e ใหม่ `e2e/core-50-nav-narrow.spec.ts` | ~120 LOC รวม e2e | 320×640, 375×812, 639×812, 1023×800 (+ regression 1280×800) | AC-145 | none — **เริ่มได้**; ∥ ทุกตัว; ไม่บล็อก release | ไม่ชน CORE-48 (`item/index.tsx`, `cart.ts`), CORE-4i-b (`cart.ts`/`payment.ts`), ADM-* |
| CORE-51 | (e2e test hygiene, nit review #295/#298) `DESKTOP_BASELINE` ไป `e2e/support/cart-layout.ts`, `createActiveAffiliate` รับ options object, `longCode()` ความกว้างคงที่, `evidenceTarget` ของ AC-52 เป็น AF-20 (กฎข้อ 109) | `e2e/support/cart-layout.ts` (ใหม่), `e2e/core-42-cart-voucher-layout.spec.ts`, `e2e/core-47-cart-375-long-title.spec.ts`, `e2e/support/affiliate.ts`, ผู้เรียก 10 ไฟล์ (`e2e/affiliate-{admin-names,admin-payouts,admin-payout-create,header-overflow,profile-overflow,portal,portal-pages,portal-polish,tracking,last-click}.spec.ts`), `e2e/core-46-e2e-hygiene.unit.spec.ts` (grep ใหม่) | ~110 LOC (ส่วนใหญ่เปลี่ยนบรรทัดเรียก) | ไม่มี UI ใหม่ (e2e เดิมรันที่ viewport เดิม) | AC-146 | none — **เริ่มได้**; ไม่บล็อก release | **ชน ADM-8a** (แก้ข้อความเงินใน `affiliate-admin-*.spec.ts` — `affiliate-admin-{payouts,payout-create,names}`) และ ADM-8b (locator ปุ่มต่อแถวในไฟล์เดียวกัน) → ตัวที่ merge ทีหลัง rebase (เปลี่ยนเฉพาะบรรทัดเรียก); **ชน CORE-49** ที่ `core-46-e2e-hygiene.unit.spec.ts` → ตัวที่ merge ทีหลัง rebase; ไม่ชน CORE-48, CORE-4i-b |
(รอบ 23) CORE-50 ∥ CORE-51 เริ่มได้ทันที (และ ∥ ADM-10..12 ของ spec 08); CORE-47 ☑ #298 (train #299)

### ยอมรับใน v1 / ไม่เปิด task (รอบ 23)
- (qa #298 O-2) ราคาในการ์ด `/cart` อยู่กึ่งกลางแนวตั้งเมื่อมี error/คำเตือนในแถวล่าง — ความสวยงามเล็กน้อย ไม่ทับ อ่านได้ (qa ยืนยัน) — ไม่เปิด task
- (qa #295 O-1) รหัสแนะนำ 32 ตัวที่เป็นตัวกว้าง (`w`/`m`) ถูกตัดหลัง `-` ที่ 375/320 — spec 05 กฎ 44(b) อนุญาตเมื่อรหัสกว้างเกินบรรทัด, คัดลอกได้ตรงตัว,
  และทางเลือก (ตัดกลางคำด้วย `break-all` หรือย่อตัวอักษร) อ่านยากกว่า — ปิดโดยไม่สร้าง task (บันทึกใน spec 05 รอบ 23)

### Open questions (รอบ 23)
none (คำถามของรอบนี้อยู่ที่ spec 08 Q7)

หมายเหตุจาก CORE-1:
- CORE-2: seed ต้องใส่ metadata ของ store/region ที่ storefront อ่าน (key และค่า default ตาม
  `apps/backend/src/lib/region-store-policies.ts` เช่น `return_window_days`, `shipping_rate`) ลงใน region ที่สร้าง
  เพราะ migration script `region-store-policies.ts` เติมให้เฉพาะ region ที่มีอยู่แล้วตอน `db:migrate`
- CORE-6: ต้องลบ `if: ${{ false }}` ของ job `storefront-e2e` ใน `.github/workflows/ci.yml` เพื่อเปิด e2e ใน CI
