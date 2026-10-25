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
