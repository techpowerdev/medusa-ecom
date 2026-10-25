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
| Storefront: PLP, PDP, cart, checkout, account, orders | Next.js Starter | Theme + i18n ภาษาไทย (ADR-008) |
| Locale ของเนื้อหา (สินค้า/หมวดหมู่/collection) | Translation module (experimental, feature flag) + Store locales + starter: cookie `_medusa_locale`, header `x-medusa-locale`, `language-select` | ใช้ตามเดิม; เปิดที่ backend ใน CORE-7 |
| ข้อความ UI ของ storefront | ไม่มี (starter hard-code อังกฤษ) | next-intl (ADR-008) |
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
- Storefront: locale ไทย + อังกฤษ, การจัดรูปแบบ THB, brand theme (Tailwind tokens) — รายละเอียดใน
  "CORE-4 Storefront i18n / theme / THB" ด้านล่าง
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

## แผนการทดสอบ
- Integration (http): smoke test การตั้งค่า region/tax; flow cart→order ด้วย manual payment
- e2e: AC-1, AC-3, AC-4 ผ่าน Playwright พร้อม screenshot
- CORE-4: ดู "แผนการทดสอบ CORE-4" ด้านล่าง

## CORE-4 Storefront i18n / theme / THB (ADR-008)
Out of scope: การเปิด Translation module และ store locales ที่ backend (CORE-7), การแปลเนื้อหาสินค้า,
locale prefix ใน URL, การแปล admin dashboard, ค่า brand จริง (owner เปลี่ยน token เอง), หน้าของ spec 02–06

### Data model / Workflows / API routes
none (storefront เท่านั้น ไม่มี route ใหม่ ใช้ `GET /store/locales` และ header `x-medusa-locale` ของ Medusa)

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
4. locale ที่รองรับ: `th` (default), `en` ฟังก์ชัน pure `resolveLocale(cookieValue)` → `"en"` เมื่อ language subtag
   เป็น `en` (ไม่สนตัวพิมพ์) มิฉะนั้น → `"th"` (รวม undefined, ค่าว่าง, `fr-FR`, ค่าเสีย)
5. ที่มาของ locale มีที่เดียวคือ cookie `_medusa_locale` (next-intl `getRequestConfig` เรียก `resolveLocale`)
   ไม่มี locale prefix ใน URL; `<html lang>` = locale ที่ resolve แล้ว
6. header `x-medusa-locale` คงพฤติกรรม starter: ส่งค่า cookie ตามจริง ไม่ส่งเมื่อไม่มี cookie (เนื้อหาต้นฉบับใน admin
   ถือเป็นภาษาไทย จึงได้ภาษาไทยโดยไม่ต้องส่ง header)
7. `language-select` แสดงเฉพาะ `th-TH` และ `en-US`: ใช้ผลจาก `GET /store/locales` ที่ตรงกับ locale ที่รองรับ
   ถ้า endpoint ไม่ตอบ/404 หรือไม่มีตัวที่ตรง ให้ใช้รายการคงที่ `th-TH`, `en-US` ตัด option "Default" ของ starter ออก
   ชื่อภาษาแสดงด้วย `Intl.DisplayNames` ของ locale ปัจจุบัน; ตัวเลือกปัจจุบันเมื่อไม่มี cookie คือ `th-TH`
8. ข้อความ UI ทั้งหมดอยู่ใน `apps/storefront/messages/th.json` และ `en.json` ทั้งสองไฟล์มี key ชุดเดียวกัน และไม่มีค่าว่าง
   ข้อความ en ใช้ข้อความเดิมของ starter
9. ทุก element ที่ e2e ต้องหา ต้องมี `data-testid` (ใช้ของ starter ถ้ามี) e2e ไม่ match ด้วยข้อความ
10. directory ที่แปลแล้วต้องผ่าน ESLint rule `react/jsx-no-literals` (เปิดเฉพาะ path ที่แปลแล้ว เพิ่มทีละ task)

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
- AC-12 Given `resolveLocale` When input = `"th-TH"`, `"en-US"`, `"EN"`, `"en-GB"`, `undefined`, `""`, `"fr-FR"`, `"xx_!!"`
  Then ได้ `th, en, en, en, th, th, th, th`
- AC-13 Given `messages/th.json` และ `messages/en.json` When unit test เทียบ key แบบ flatten Then key ตรงกันทุกตัว
  และไม่มีค่าเป็น string ว่าง
- AC-14 Given ไม่มี cookie `_medusa_locale` When เปิด `/th` Then `<html lang="th">` และข้อความใน
  `getByTestId("nav-account-link")` เท่ากับค่าของ key นั้นใน `th.json`
- AC-15 Given cookie `_medusa_locale=en-US` When เปิด `/th` Then `<html lang="en">` และข้อความ `nav-account-link`
  เท่ากับค่าใน `en.json`; Given cookie `fr-FR` Then ผลเหมือน AC-14
- AC-16 Given ไม่มี cookie และ `GET /store/locales` ตอบ 404 When เปิด language-select (`data-testid="language-select"`)
  Then มีตัวเลือกพอดี 2 รายการ (`th-TH`, `en-US`) และไม่มี "Default"; When เลือก `en-US` Then cookie `_medusa_locale=en-US`
  และหลัง refresh `<html lang="en">`
- AC-17 Given cookie `_medusa_locale=en-US` When storefront เรียก Medusa API Then request มี header
  `x-medusa-locale: en-US`; Given ไม่มี cookie Then ไม่มี header นี้ (unit test ของ `getLocaleHeader` ด้วย cookie mock)
- AC-18 Given path ที่ task นั้นแปล When รัน `pnpm --filter storefront lint` Then ไม่มี error `react/jsx-no-literals`
  (ขอบเขต path: 4b = `src/modules/layout`, `src/app/**/layout.tsx`, `not-found`; 4c = `src/modules/{home,store,categories,collections,products,cart}`;
  4d = `src/modules/{checkout,account,order,policies,shipping,common}`)
- AC-19 Given cookie `th-TH` และ `en-US` When e2e เปิดหน้าใน path ของ task (4c: home, store, PDP, cart; 4d: checkout,
  account overview, orders, order detail) Then element หลักอย่างน้อย 1 ตัวต่อหน้า (ผ่าน test id) แสดงข้อความตรงกับ
  `messages/<locale>.json` และเก็บ screenshot ไว้เป็น evidence (≤ 5 รูป)

### Non-functional
- ไม่เพิ่ม infra; dependency ใหม่: `next-intl`, `vitest` (dev) ต้องเข้ากับ Next.js 16 / React 19 ที่ pin อยู่
  ให้ builder ตรวจกับ docs ผ่าน context7 ก่อนติดตั้ง
- ห้ามโหลดไฟล์ข้อความทั้งหมดไป client: ส่งเฉพาะ namespace ที่ client component ใช้ผ่าน `NextIntlClientProvider`
- cache: การเปลี่ยน locale ต้อง revalidate ตามที่ `updateLocale` ของ starter ทำอยู่ ไม่เพิ่มกลไกใหม่

### แผนการทดสอบ CORE-4
| ระดับ | AC |
|------|----|
| unit (Vitest) | AC-7, AC-8, AC-9, AC-12, AC-13, AC-17 |
| CI / lint | AC-11, AC-18 |
| e2e (Playwright, ตั้ง cookie ใน context, หาด้วย `getByTestId`) | AC-10, AC-14, AC-15, AC-16, AC-19 |
CORE-4a ไม่มี e2e (ทำได้ก่อน CORE-5) AC-10 ซึ่งเป็นผลของ CORE-4a ตรวจด้วย e2e ใน CORE-4b หลัง CORE-5 merge แล้ว
fixture ของ Playwright (CORE-5) ต้องมี helper ตั้ง cookie `_medusa_locale` ต่อ test (default ไม่ตั้ง = th)

### Tasks (CORE-4 แตกเป็น 4 PR เพราะการแปล UI ทั้ง starter ~150 component เกิน ~400 LOC ต่อ PR)
| ID | Task | AC | Depends |
|----|------|----|---------|
| CORE-4a | Vitest (dev dep, `test:unit`, ขั้นตอนใน CI) + THB format ใน `convertToLocale` + Tailwind `brand` tokens + Noto Sans Thai ผ่าน `next/font` + `<html lang="th">` | AC-7, 8, 9, 11 | CORE-1 |
| CORE-4b | next-intl infra (plugin ใน `next.config`, `src/i18n/request.ts`, `resolveLocale`), `messages/{th,en}.json`, `<html lang>` ตาม locale, `NextIntlClientProvider`, ปรับ `language-select` (กฎข้อ 7), แปล layout shell (nav, footer, side menu, cart dropdown, not-found), test `getLocaleHeader`, lint rule สำหรับ path ของ 4b | AC-10, 12, 13, 14, 15, 16, 17, 18 (path 4b) | CORE-4a, CORE-5 |
| CORE-4c | แปล home, store/PLP, categories, collections, PDP, cart + เพิ่ม `data-testid` ที่ขาด | AC-18 (path 4c), AC-19 (4c) | CORE-4b |
| CORE-4d | แปล checkout, account, order, policies, shipping nudge, common components + เพิ่ม `data-testid` ที่ขาด | AC-18 (path 4d), AC-19 (4d) | CORE-4b |
CORE-4c และ CORE-4d ทำขนานกันได้หลัง CORE-4b (ทั้งคู่แก้ `messages/*.json` คนละ namespace — merge ทีหลังต้อง rebase)

### Open questions (CORE-4)
1. ยืนยันว่าเนื้อหาสินค้าต้นฉบับใน admin กรอกเป็นภาษาไทย และภาษาอังกฤษมาจาก Translation module (กฎข้อ 6)
2. CORE-7 ใช้ Translation module ที่ยังเป็น experimental — ต้องมี ADR แยกหรือถือว่าครอบคลุมโดย ADR-008 ข้อ 1
3. ข้อความ `metadata` (title/description) ของหน้า แปลด้วย next-intl ด้วยหรือไม่ (เสนอ: ใช่ ใน task ของหน้านั้น)

## Tasks
| ID | Task | Depends |
|----|------|---------|
| CORE-1 | `create-medusa-app` ลงใน `apps/backend` + starter ลงใน `apps/storefront`; pnpm workspace; Docker Compose (pg, redis); `.env.example`; CI ผ่านด้วย test ว่าง | — |
| CORE-2 | Seed script: region Thailand, THB, VAT 7%, shipping option (Standard + Digital delivery), สินค้าตัวอย่าง, admin user; script `print-publishable-key` ที่ CI ใช้ | CORE-1 |
| CORE-3 | Notification provider (Resend) + template order placed/shipped | CORE-1 |
| CORE-4a | THB format + theme tokens + Noto Sans Thai + Vitest (ดู "CORE-4 Storefront i18n / theme / THB") | CORE-1 |
| CORE-4b | next-intl infra + locale จาก cookie + language-select + แปล layout shell | CORE-4a, CORE-5 |
| CORE-4c | แปล UI: home, PLP, PDP, cart | CORE-4b |
| CORE-4d | แปล UI: checkout, account, order และ component กลาง | CORE-4b |
| CORE-5 | ตั้งค่า Playwright แบบ screenshot ทุก step + convention ของโฟลเดอร์ evidence + helper ตั้ง cookie `_medusa_locale` (ADR-008) | CORE-1 |
| CORE-6 | Store route เฉพาะลูกค้า (middleware + cart hook + storefront redirect) + e2e สำหรับ AC-1..AC-4, AC-6 ด้วย manual payment provider (หา element ด้วย `data-testid` ตาม ADR-008) | CORE-2,4a,5 |
| CORE-7 | Backend: เปิด Translation module (feature flag + `medusa-config.ts`) และตั้ง store locales `th-TH`, `en-US` ใน seed เพื่อให้ `GET /store/locales` และ `x-medusa-locale` ใช้งานได้ (ไม่อยู่ใน CORE-4 ตาม ADR-008) | CORE-2 |
CORE-3, CORE-4a และ CORE-5 ทำขนานกันได้หลังจาก CORE-1; CORE-4c ∥ CORE-4d หลัง CORE-4b; CORE-7 ขนานกับ CORE-4b..4d ได้
(storefront ทำงานได้โดยไม่มี CORE-7 ตามกฎข้อ 6–7 ของ CORE-4)

หมายเหตุจาก CORE-1:
- CORE-2: seed ต้องใส่ metadata ของ store/region ที่ storefront อ่าน (key และค่า default ตาม
  `apps/backend/src/lib/region-store-policies.ts` เช่น `return_window_days`, `shipping_rate`) ลงใน region ที่สร้าง
  เพราะ migration script `region-store-policies.ts` เติมให้เฉพาะ region ที่มีอยู่แล้วตอน `db:migrate`
- CORE-6: ต้องลบ `if: ${{ false }}` ของ job `storefront-e2e` ใน `.github/workflows/ci.yml` เพื่อเปิด e2e ใน CI
