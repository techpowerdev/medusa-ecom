# QA evidence — CORE-4a (PR #19)
spec: `docs/spec/01-core-medusa.md` "CORE-4 Storefront i18n / theme / THB" · ADR-008
สภาพแวดล้อม: backend :9120 (DB `medusa_qa4a`, seed Thailand/THB), storefront :8120 (`next dev`), Playwright chromium 1280×720
HTML report/trace ฉบับเต็ม: CI artifact `e2e-evidence` (job storefront-e2e ยังปิดอยู่ — รอบนี้รันในเครื่อง)

| AC | Result | Evidence |
|----|--------|----------|
| AC-7 | pass | `pnpm --filter storefront test:unit` 22/22 ผ่าน (`src/lib/util/money.test.ts`) · ภาพจริง [03-pdp-thb-price.png](03-pdp-thb-price.png) `฿590` |
| AC-8 | pass | `money.test.ts` ทั้ง 6 ค่า × th-TH/en-US + caller override · ภาพจริง [04-cart-thb-totals.png](04-cart-thb-totals.png) `฿590` / `฿551.40` / `฿38.60` / `฿0` |
| AC-9 | pass | `src/styles/tailwind-config.test.ts` ผ่าน · Tailwind CLI สร้าง `.bg-brand`, `.text-brand-700`, `.border-brand-50` ได้ |
| AC-11 | pass | `vitest run` ผ่าน · `.github/workflows/ci.yml` มีขั้นตอน `pnpm --filter storefront test:unit` |

## ตรวจบน storefront จริง (สนับสนุน, AC-10 เป็นของ 4b)
| สิ่งที่ตรวจ | Result | Evidence |
|-------------|--------|----------|
| `<html lang="th">`, body font = Noto Sans Thai, ไม่มี request ไป fonts.googleapis.com/gstatic | pass | [01-home-lang-th-noto.png](01-home-lang-th-noto.png) |
| ตัวอักษรไทยแสดงด้วย Noto Sans Thai | pass | [05-account-thai-name.png](05-account-thai-name.png) |
| store listing แสดงราคา ฿ | **fail (defect เดิม นอก AC ของ 4a)** | [02-store-no-price-defect.png](02-store-no-price-defect.png) |

## Defect / ข้อสังเกต
1. หน้า store ไม่แสดงราคาใน region THB: search index เก็บราคาแค่ `eur`, `usd` (`SEARCH_PRICE_CURRENCIES`, backend `PRICE_CURRENCIES`) และ fallback เป็น eur
2. `TASK_ID_RE` ของ evidence fixture (CORE-5) ไม่รับ `CORE-4a` ทำให้ `E2E_SAVE_EVIDENCE=1` ล้ม
3. `evidence-budget.unit.spec.ts` fail บน develop เพราะ `*-tests.txt` อยู่ในโฟลเดอร์ CORE-2, CORE-3, OPS-1
4. element ที่ใช้ class `txt-*` (เช่น nav link) ได้ font Inter จาก `@medusajs/ui-preset` ไม่มี Noto Sans Thai (ข้อสังเกต ไม่ใช่ fail ของ 4a)
5. edge case: `-0` → `-฿0`, `NaN` → `฿NaN`
