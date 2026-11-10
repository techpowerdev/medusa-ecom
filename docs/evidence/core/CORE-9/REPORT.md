# CORE-9 — QA evidence (spec 01 กฎข้อ 15, AC-26..28)

สภาพแวดล้อม: worktree แยก, DB `medusa_qa_core9` (migrate + seed), Redis db 12, backend :9123
(`medusa build` แล้ว start จาก `.medusa/server`, NODE_ENV=production), storefront :8123 (`next build` + `next start`), Node v22.23.3

| AC | Result | Evidence |
|----|--------|----------|
| AC-26 | pass | unit backend `search-pricing.unit.spec.ts` 3/3, Vitest `search-client.test.ts` 3/3 |
| AC-27 | pass | integration `search-thb.spec.ts` 1/1 + `/store/search` บน DB QA: sweatshirt `min_price_thb=990`, t-shirt `590` ไม่มี field `_eur`/`_usd` |
| AC-28 | pass | `e2e/store-thb-price.spec.ts` (E2E_SAVE_EVIDENCE=1) 1/1 → [01-store-thb-prices.png](01-store-thb-prices.png) (฿990, ฿590) |
| AC-28 (ค้นหา) | pass | ค้นหา "Sweat" ได้การ์ดเดียว ฿990 → [02-store-search-thb.png](02-store-search-thb.png) |
| AC-28 (กรอง/เรียง) | pass | Low→High ใบแรก ฿590, High→Low ใบแรก ฿990, Size S ได้ T-Shirt ฿590 → [03-store-filter-sort-thb.png](03-store-filter-sort-thb.png) |

## Negative/edge
| กรณี | ผล |
|------|-----|
| price range slider ลด max สุด | pass: เหลือการ์ด ฿590 ใบเดียว |
| ค้นหาคำที่ไม่มี | pass: แสดง `no-products` |
| index เก่า (eur/usd) แล้วบูตโค้ดใหม่ **โดยไม่** `db:migrate` | `/store/search` 400 `Field "min_price_thb" is not facetable` หน้า store ค้างที่ skeleton → [04-store-old-index-before-migrate.png](04-store-old-index-before-migrate.png) |
| `db:migrate` ตอน server ยังรัน (ยังไม่รีสตาร์ต) | ยัง 400 |
| `db:migrate` แล้วรีสตาร์ต | pass: seed `product_v2` ใหม่ ราคา THB ครบ e2e AC-28 ผ่าน |

## Defect / ข้อสังเกต
1. (deploy, ไม่ block) ต้อง `medusa db:migrate` แล้วรีสตาร์ต backend ก่อนปล่อย storefront ใหม่ — `docker-compose.prod.yml` บังคับลำดับ migrate ก่อน server/worker อยู่แล้ว
2. (defect เดิมของ storefront ไม่ได้มาจาก diff นี้) เมื่อ `/store/search` ตอบ 400 หน้า store ยิง request ซ้ำไม่หยุด (~1,074 request ใน 6 วินาที) และไม่ขึ้น `products-error` → แยกเป็น task fix

Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #45 (14 วัน)
