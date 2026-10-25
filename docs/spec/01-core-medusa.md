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
| CORE-4b | next-intl infra (plugin ใน `next.config`, `src/i18n/request.ts`, `resolveLocale`), `messages/{th,en}.json`, `<html lang>` ตาม locale, `NextIntlClientProvider`, ปรับ `language-select` (กฎข้อ 7), แปล layout shell (nav, footer, side menu, cart dropdown, not-found), test `getLocaleHeader`, lint rule สำหรับ path ของ 4b | AC-10, 12, 13, 14, 15, 16, 17, 18 (path 4b) | CORE-4a, CORE-5, CORE-5b, CORE-8 |
| CORE-4c | แปล home, store/PLP, categories, collections, PDP, cart + เพิ่ม `data-testid` ที่ขาด | AC-18 (path 4c), AC-19 (4c) | CORE-4b, CORE-9 |
| CORE-4d | แปล checkout, account, order, policies, shipping nudge, common components + เพิ่ม `data-testid` ที่ขาด | AC-18 (path 4d), AC-19 (4d) | CORE-4b |
CORE-4c และ CORE-4d ทำขนานกันได้หลัง CORE-4b (ทั้งคู่แก้ `messages/*.json` คนละ namespace — merge ทีหลังต้อง rebase)

### ข้อตัดสินของ owner (CORE-4, 2026-10-25)
1. เนื้อหาสินค้าต้นฉบับใน admin กรอกเป็นภาษาไทย ภาษาอังกฤษมาจาก Translation module (กฎข้อ 6)
2. ADR-008 ข้อ 1 ครอบคลุมการใช้ Translation module ที่ยังเป็น experimental ใน CORE-7 แล้ว ไม่ต้องมี ADR แยก
3. ข้อความ `metadata` (title/description) ของหน้าแปลด้วย next-intl ใน task ของหน้านั้น

## Tasks
| ID | Task | Depends |
|----|------|---------|
| CORE-1 | `create-medusa-app` ลงใน `apps/backend` + starter ลงใน `apps/storefront`; pnpm workspace; Docker Compose (pg, redis); `.env.example`; CI ผ่านด้วย test ว่าง | — |
| CORE-2 | Seed script: region Thailand, THB, VAT 7%, shipping option (Standard + Digital delivery), สินค้าตัวอย่าง, admin user; script `print-publishable-key` ที่ CI ใช้ | CORE-1 |
| CORE-3 | Notification provider (Resend) + template order placed/shipped | CORE-1 |
| CORE-4a | THB format + theme tokens + Noto Sans Thai + Vitest (ดู "CORE-4 Storefront i18n / theme / THB") | CORE-1 |
| CORE-4b | next-intl infra + locale จาก cookie + language-select + แปล layout shell | CORE-4a, CORE-5, CORE-5b, CORE-8 |
| CORE-4c | แปล UI: home, PLP, PDP, cart | CORE-4b, CORE-9 |
| CORE-4d | แปล UI: checkout, account, order และ component กลาง | CORE-4b |
| CORE-5 | ตั้งค่า Playwright แบบ screenshot ทุก step + convention ของโฟลเดอร์ evidence + helper ตั้ง cookie `_medusa_locale` (ADR-008) | CORE-1 |
| CORE-6 | Store route เฉพาะลูกค้า (middleware + cart hook + storefront redirect) + e2e สำหรับ AC-1..AC-4, AC-6 ด้วย manual payment provider (หา element ด้วย `data-testid` ตาม ADR-008) | CORE-2,4a,5 |
| CORE-7 | Backend: เปิด Translation module (feature flag + `medusa-config.ts`) และตั้ง store locales `th-TH`, `en-US` ใน seed เพื่อให้ `GET /store/locales` และ `x-medusa-locale` ใช้งานได้ (ไม่อยู่ใน CORE-4 ตาม ADR-008) | CORE-2 |
| CORE-5b | แก้เครื่องมือ evidence ของ e2e (ดู "Follow-up จาก review/qa") | CORE-5 |
| CORE-8 | ฟอนต์ของ class `txt-*`/`h*-webs` จาก `@medusajs/ui-preset` ใช้ Noto Sans Thai | CORE-4a, CORE-5 |
| CORE-9 | search index เก็บราคา THB → หน้า store แสดงราคา ฿ | CORE-2 |
| CORE-10 | Seed: ชื่อสินค้าไทย, idempotency ต่อขั้น, `.env.example` | CORE-2 (แนะนำ merge หลัง CORE-6) |
| CORE-11 | Notification: อีเมล shipped แสดงเฉพาะ item ที่ส่ง, order placed เคารพ `no_notification` | CORE-3 |
CORE-3, CORE-4a และ CORE-5 ทำขนานกันได้หลังจาก CORE-1; CORE-4c ∥ CORE-4d หลัง CORE-4b; CORE-7 ขนานกับ CORE-4b..4d ได้
(storefront ทำงานได้โดยไม่มี CORE-7 ตามกฎข้อ 6–7 ของ CORE-4)
CORE-5b ∥ CORE-8 ∥ CORE-9 ∥ CORE-10 ∥ CORE-11 (ไม่แตะไฟล์เดียวกัน) — CORE-5b, CORE-8 อยู่บน critical path ของ CORE-4b;
CORE-9 เป็น dependency ของ CORE-4c (PLP/PDP)

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
11. task id ของ evidence มีรูปแบบ `^[A-Z]+-\d+[a-z]?$` (รับ `CORE-4a`, `CORE-5b`)
12. `evidence()` ตรวจงบ (≤ 5 PNG, ≤ 300KB) กับ **ชุดไฟล์ที่จะเกิดขึ้นหลังเขียน** ก่อนเขียนไฟล์จริง ถ้าเกินงบ → throw และไม่เขียนไฟล์
    การเขียนทับไฟล์ชื่อเดิมไม่นับเป็นรูปใหม่
13. ใน `docs/evidence/<feature>/` (ระดับ feature) อนุญาตเฉพาะไฟล์ `<TASK-ID>-tests.txt` และโฟลเดอร์ `<TASK-ID>/`
    (ตาม `docs/evidence/README.md`) ไฟล์ `*-tests.txt` ที่อยู่ในโฟลเดอร์ `<TASK-ID>/` ต้องย้ายขึ้นมาระดับ feature
14. ทุก element ที่ได้ font-family จาก class ของ `@medusajs/ui-preset` (`txt-*`, `h1-webs`…`h3-webs` และกลุ่ม `*-webs` อื่น)
    ต้องได้ `var(--font-noto-sans-thai)` เป็นตัวแรก โดยไม่ fork/patch package
15. สกุลเงินของ search index = `["thb"]` เท่านั้น (ร้านมี region เดียวคือ Thailand/THB) ทั้ง backend `PRICE_CURRENCIES`
    และ storefront `SEARCH_PRICE_CURRENCIES` ต้องมีค่าเท่ากัน; เพิ่มสกุลเงินในอนาคต = แก้ทั้งสองที่ (index reindex ตอนบูต)
16. ชื่อสินค้าตัวอย่างใน seed เป็นภาษาไทย (ADR-008, ข้อตัดสินของ owner ข้อ 1) `handle` คงเดิม (URL/e2e ไม่เปลี่ยน)
17. seed ตรวจการมีอยู่ **ทีละ resource** (region, tax region, stock location, fulfillment set, shipping option ตาม `type.code`,
    publishable key ตาม title, category ตามชื่อ, product ตาม handle, inventory level) และสร้างเฉพาะที่ขาด — ไม่ใช้ region
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
| CORE-10 | seed: ชื่อสินค้าไทย, เช็กการมีอยู่ทีละ resource, `.env.example` ว่าง (ค่าส่ง Standard คงเดิม กฎข้อ 19) | AC-29..31 | CORE-2 (แนะนำ — ไม่บังคับ — ให้ merge หลัง CORE-6 เพราะ e2e ของ CORE-6 ใช้ seed) |
| CORE-11 | อีเมล shipped เฉพาะ item ใน fulfillment, `order.placed` เคารพ `no_notification` | AC-32, AC-33 | CORE-3 |
CORE-5b, CORE-8, CORE-9 ทำขนานกันได้; CORE-5b + CORE-8 เป็น dependency ของ CORE-4b, CORE-9 เป็น dependency ของ CORE-4c;
CORE-10 ∥ CORE-11 นอก critical path และไม่บล็อก release v0.1.0
evidence ของ CORE-8/CORE-9 (e2e) บันทึกได้หลัง CORE-5b merge (ถ้ายังไม่ merge ให้รัน e2e โดยไม่ตั้ง `E2E_SAVE_EVIDENCE`)
fail-fast เมื่อ prod ไม่มี `RESEND_API_KEY` อยู่ใน OPS-7 (spec 07, ADR-010) ไม่อยู่ใน CORE-11

### Open questions (follow-up)
- Q-F1 (owner 2026-10-25: ยังไม่ตัดสิน คง placeholder) ค่าส่ง "Standard" ใน seed/region metadata ควรเป็นเท่าไร
  (ตอนนี้ 10 THB)? ฟรีเมื่อยอดถึงขั้นต่ำหรือไม่
  (ถ้าใช่ ใช้ Medusa shipping option rule/promotion — เป็น task แยก)

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
  `POST /store/shipping-options/:id/calculate {cart_id: CA}` Then 404 และไม่มี payment session ใหม่; A → 200
- AC-36 Given ไม่มี token When `GET /store/carts/CA` หรือ `GET /store/orders/:id` Then 401
- AC-37 Given order OA ของ A When B `GET /store/orders/OA` Then 404; A → 200
- AC-38 Given cart ที่ `customer_id` เป็น null (สร้างตรงผ่าน module ใน test) When customer ใดเรียก `GET /store/carts/:id` Then 404
- AC-39 (CORE-13) Given order OA ของ A When ไม่มี token `POST /store/returns {order_id: OA}` Then 401; B → 404 และไม่มี return;
  A → 200 และมี return ของ OA
- AC-40 (CORE-13) Given order OA ของ A When เรียก `POST /store/orders/OA/transfer/request`, `/accept`, `/decline`, `/cancel` ทั้งแบบไม่มี
  token, token ของ B และ token ของ A (body ถูกต้องตาม validator ของ Medusa) Then ทุกครั้งได้ 404, ไม่มี order change ประเภท transfer
  ถูกสร้าง และ `OA.customer_id` ยังเป็น A (middleware ปิด route ไม่ระบุ method — ดู "API routes")
- AC-41 (CORE-14) Given ไม่มี customer session When `GET /buy/<variant_id>:1` Then redirect ไปหน้า login
  ที่มี return URL กลับ `/buy/...` และจำนวน cart ใน DB ไม่เปลี่ยน; Given ล็อกอินแล้ว Then 303 ไป `/<cc>/checkout` และ cart ใหม่มี
  `customer_id` ของผู้ล็อกอิน
- AC-42 (CORE-14) `GET /ucp/v1`, `POST /ucp/v1/cart`, `GET /<cc>/cart/resume/<id>` → 404
- AC-43 (CORE-14) Given ไม่มี session แต่มี cookie `_medusa_cart_id` ค้าง When เปิด `/<cc>/cart` Then แสดงหน้า cart ว่างหรือ redirect login
  (ไม่มี 5xx) และ cookie cart ถูกล้าง (e2e)
- AC-44 (CORE-14, QA CORE-6 D-1, กฎ 26) Given browser ปิด JavaScript และไม่มี session When กด "Add to cart" บน PDP ที่เลือก quantity 3
  Then response HTML ของ `/account?add_variant=…` มีฟอร์ม login (หาด้วย `data-testid` ของฟอร์ม login) ไม่ใช่เพียง spinner ของ `loading.tsx`;
  When login สำเร็จ (ยังไม่มี JS) Then cart มี line ของ variant นั้น `quantity=3`
- AC-45 (CORE-14, กฎ 26) Given ล็อกอินแล้ว When เปิด `/account?add_variant=variant_ไม่มีจริง` Then เห็น `data-testid="add-variant-error"`
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
| CORE-14 | storefront: `/buy/[items]` บังคับล็อกอินแล้วสร้าง cart พร้อม customer; ปิด `/ucp/*`, `lib/ucp/*`, `cart/resume` (ลบ route); จัดการ cookie cart ค้างเมื่อไม่มี session; แก้ flow no-JS ของ `/account?add_variant=` (กฎ 26, QA CORE-6 D-1) | AC-41..45 | CORE-6 |
CORE-12 ∥ CORE-14; CORE-13 หลัง CORE-12; CORE-12 ควร merge ก่อน release แรกที่เปิดให้ลูกค้าจริงใช้
CORE-14 ถ้า diff เกิน ~400 LOC ให้แยก CORE-14a (`/buy` บังคับล็อกอิน + ปิด UCP + cookie cart ค้าง; AC-41..43) และ CORE-14b
(no-JS login + error ของ `add_variant`; AC-44, AC-45) — ทั้งสอง Depends CORE-6 และทำขนานกันได้

### ข้อตัดสินของ owner (follow-up CORE-6, 2026-10-25)
- ADR-013 accepted
- ~~Q-F2~~ `/buy/[items]` เก็บไว้แต่บังคับล็อกอิน; ปิด UCP (`/ucp/*`, `lib/ucp/*`, `cart/resume`) ทั้งชุดใน v1 (เปิดภายหลังต้องมี ADR)
- ~~Q-F3~~ ปิด order transfer ทั้งชุด (request/accept/decline/cancel)

หมายเหตุจาก CORE-1:
- CORE-2: seed ต้องใส่ metadata ของ store/region ที่ storefront อ่าน (key และค่า default ตาม
  `apps/backend/src/lib/region-store-policies.ts` เช่น `return_window_days`, `shipping_rate`) ลงใน region ที่สร้าง
  เพราะ migration script `region-store-policies.ts` เติมให้เฉพาะ region ที่มีอยู่แล้วตอน `db:migrate`
- CORE-6: ต้องลบ `if: ${{ false }}` ของ job `storefront-e2e` ใน `.github/workflows/ci.yml` เพื่อเปิด e2e ใน CI
