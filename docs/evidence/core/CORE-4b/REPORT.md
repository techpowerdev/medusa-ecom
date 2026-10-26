# CORE-4b1 — QA report (PR #57)
สภาพแวดล้อม: backend build + start จาก `.medusa/server` (DB แยก seed แล้ว, Redis db แยก), storefront `next build` + `next start`,
Node 22.23.3, Chromium (Playwright) — Playwright report/trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR #57 (14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-46 | pass | [4b1-02-side-menu-th.png](4b1-02-side-menu-th.png): `<html lang="th">`, side menu ไม่มี `language-select`, ไม่มี cookie `_medusa_locale` หลังเดินหน้าแรก/store/not-found; unit ตรวจว่าไม่มี next-intl/messages |
| AC-47 | pass | vitest `src/thai-ui-rule.test.ts` 20/20 (unit ทั้งหมด 57/57) |
| AC-48 (4b1) | pass | [4b1-01-home-th.png](4b1-01-home-th.png), [4b1-03-not-found-th.png](4b1-03-not-found-th.png): nav, hero, footer, side menu, not-found ของ `(main)` เป็นไทย ละตินที่เหลือคือชื่อแบรนด์และข้อมูลจาก backend — test id ที่ใช้: ดู `e2e/thai-ui-shell.spec.ts` |
| AC-49 (4b1) | pass | `eslint .` 0 error (35 warning เดิมของ starter), `tsc` ผ่าน, rule เปิดตรง path ของ 4b1 |
| AC-50 | pass | `getComputedStyle(body).fontFamily` = "Noto Sans Thai", …; `document.fonts.check` true; ไม่มี request ไป fonts.googleapis.com |
| regression | pass | `playwright --project=chromium --project=unit` 31/31 |

## ตรวจเพิ่มจากมุมลูกค้า
- cart dropdown ว่างและมีสินค้า (login แล้ว): ข้อความไทยครบ
- search drawer: ว่าง / กำลังค้นหา / ไม่พบ เป็นไทย placeholder และ aria-label ไทย
- not-found: root และ `(main)` ได้ 404, lang=th, เนื้อหาไทย
- mobile 375px: ไม่มี element ล้นในหน้าแรก, side menu, search
- cookie `_medusa_locale=en` ค้างจากก่อนหน้า → ยังได้ lang=th

## Defect
ไม่มีในขอบเขตของ 4b1

## ข้อสังเกต (นอกขอบเขต PR นี้)
1. หลังกด "ลบ" ใน cart dropdown ตัวนับ "ตะกร้า (1)" ไม่ลดจนกว่าจะ reload (พฤติกรรมเดิมของ starter) → task แยก
2. search drawer ที่ 375px: query ยาวไม่มีช่องว่างทำให้ข้อความ "ไม่พบ" ล้นขอบ (ไม่มี `break-words`) — เล็กน้อย
3. หน้าแรกไม่มี product rail เพราะ seed ไม่มี collection
4. "Variant: L" ใน cart dropdown มาจาก `modules/common` → 4c
5. ข้อความอังกฤษที่เหลือเป็นของ 4b2 (store/PLP, search page, categories, collections, PDP), 4c, 4d

# CORE-4b2 — QA report (PR #70)
commit 4fe7506 · stack ของ QA (backend + storefront build/start, DB seed ใหม่)
CI artifact (Playwright report/trace ฉบับเต็ม): https://github.com/techpowerdev/medusa-ecom/actions/runs/40262129577
screenshot: `4b2-01-store-th.png`, `4b2-02-pdp-th.png` (โฟลเดอร์นี้ใช้งบ 5 รูปครบแล้ว รูปของ QA อยู่ใน CI artifact)

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-48 (4b2) store | ผ่าน | `thai-ui-pages.spec.ts` "AC-48: หน้า store และ PDP" (store-page-title, sort-by-container, refinement-title-category, placeholder store-search-input, document.title) |
| AC-48 (4b2) /search | ผ่าน | "AC-48: หน้า /search" (search-result-count, search-submit, placeholder, search-no-results) |
| AC-48 (4b2) category + collection | ผ่าน | "AC-48: หน้า category และ collection" (sort-by-container, meta description ไทย) |
| AC-48 (4b2) PDP | ผ่าน | add-product-button, product-tab-information, product-tab-shipping |
| AC-49 (4b) | ผ่าน | lint 0 error; JSX อังกฤษใน path 4b ทั้ง 11 path ได้ `no-restricted-syntax` error, path 4c/4d ได้ 0; Vitest 93 ผ่าน |
| hreflang `th-<CC>` | ผ่าน | หลัง build: `/th` และ `/th/products/t-shirt` → `hrefLang="th-TH"` |
| AC-46, AC-47, AC-50 (regression) | ผ่าน | `thai-ui-shell.spec.ts`, `ui-preset-font.spec.ts` |

e2e chromium ทั้งชุด: 12 ผ่าน, 6 ข้าม (payments ต้องใช้ Stripe test key — ใน CI ผ่าน); playwright unit 27 ผ่าน

## ตรวจเพิ่ม (edge/negative)
| กรณี | ผล |
|------|----|
| `/buy` รูปแบบผิด / variant ไม่มี (404) / จำนวน 999999 และ 0 / ประเทศ us | ผ่าน — ข้อความไทยทุกกรณี |
| store ค้นหาไม่พบ + chip หมวดหมู่ + ปุ่มล้างตัวกรอง | ผ่าน |
| collection ไม่มีสินค้า | ผ่าน — ไม่มีข้อความอังกฤษ (ไม่มี empty state ตามพฤติกรรมเดิมของ starter) |
| category/collection/product ที่ไม่มีอยู่ → 404 | ผ่าน — not-found ไทย |
| PDP มือถือ 390px (mobile-cart-button) | ผ่าน |
| เลือก variant แล้วปุ่ม/tab ยังเป็นไทย | ผ่าน |
| ป้ายช่วงราคาใต้ slider บน `/store` | **ไม่ผ่าน** — D-1 |

## Defect
- D-1 (minor, มีอยู่ก่อน PR นี้, ไม่กระทบ AC-48): `modules/store/components/store-refinements/price-range.tsx` `formatAmount` ใช้
  `Intl.NumberFormat(undefined, { style: "currency" })` แทน `convertToLocale` → browser en-US แสดง "THB 590 / THB 990" แทน "฿590 / ฿990"
  (chip ตัวกรองราคาใน current-refinements ถูกต้องแล้ว) → ส่งต่อเป็น follow-up ใน CORE-15 (หน้า `/store`)
