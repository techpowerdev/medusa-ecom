# QA REPORT — FS-17 แคตตาล็อก revalidate 60 วินาที (PR #164)

- Spec: `docs/spec/03-flash-sale.md` กฎข้อ 22, AC-24, AC-20 (หน้าแรก) · ADR-017 ทางเลือก A
- Commit ที่ตรวจ: `27738e5` (branch `feat/FS-17-catalog-revalidate`)
- สภาพแวดล้อม: prod build — backend `medusa start`, storefront `next build && next start`, DB แยก, Stripe key ปลอม (test)
- CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/40514568551 — storefront-e2e ✅, lint-typecheck ✅, backend/docker SKIPPED (classify-changes: storefront-only)
- รายงาน Playwright/trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ run ข้างต้น (14 วัน)

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-24 (unit) revalidate ≤ 60 ทั้ง 4 ฟังก์ชัน, มี cookie → revalidate + tag, ชุด hit ว่างไม่ fetch | pass | Vitest `catalog-revalidate.test.ts` 9/9 (รันซ้ำโดย QA) |
| AC-24 (e2e) warm `/th` → สร้าง collection + สินค้า flash ผ่าน admin API → rail ขึ้นภายใน 90 วินาที, การ์ดมี `flash-price` ฿800 / `flash-original-price` ฿1,000 | pass — 71.1 วินาที (2 รอบ); reload ทันทีหลังสร้างยังไม่เห็น rail (ยืนยันว่า cache ทำงานจริง) | qa-ac24-home-rail-flash.png |
| AC-20 (หน้าแรก) ไม่มี `test.fixme` ใน `flash-sale-fs14.spec.ts` และ test หน้าแรกผ่าน | pass — grep = 0; test หน้าแรกผ่าน 43.1 วินาที | ผลรัน FS-14 e2e |
| กฎข้อ 22: แก้ชื่อ + ราคา → หน้า collection / `/search` / หน้าแรก อัปเดตภายใน 90 วินาที | pass — PLP 71.7 / 72.6 วินาที, `/search` 79.0 / 80.6 วินาที, หน้าแรก 86.2 / 88.4 วินาที (ดู O-1) | qa-ac24-plp-updated.png |
| กฎข้อ 22: ลบ collection → rail หายจากหน้าแรกภายใน 90 วินาที | pass — 63.7 / 64.0 วินาที; หน้า collection ที่ลบแล้วได้ 404 ทันที | qa-ac24-home-rail-removed.png |
| regression FS-14: `/th/store` การ์ด flash ถูกต้อง ไม่มี console error | pass | qa-fs14-store-flash.png |
| login แล้ว (มี cookie `_medusa_cache_id`) หน้าแรก/PLP/บัญชีทำงานปกติ และราคาที่แก้สดภายใน 90 วินาที (fetch มี tag) | pass — PLP 71.6 / 72.0 วินาที | qa-ac24-logged-in-plp.png |
| regression FS-13 / FS-14 e2e | pass — 7/7 | prod build ในเครื่อง + CI storefront-e2e ✅ |

## Negative / edge case (นอก spec)

| กรณี | ผล |
|------|----|
| ปิดแคมเปญ (ends_at ในอดีต) → การ์ดหน้าแรกกลับเป็นราคาปกติ | pass — ~0.1 วินาที (ราคา flash ไม่ผ่าน catalog cache) |
| เปลี่ยนสินค้าเป็น draft → หายจาก PLP | pass — 7.3 วินาที |
| PDP ของสินค้าที่เพิ่งเป็น draft | ยังได้ 200 ภายใน 7 วินาทีแรก; หลังลบสินค้าได้ 404 — PDP อยู่นอกขอบเขตกฎข้อ 22 |
| หน้า collection ที่ลบแล้ว | 404 ทันที |

## ข้อสังเกต (ไม่ใช่ defect ของ PR นี้)
- O-1: stale-while-revalidate สองชั้น (ISR ของหน้า + Data Cache) — คำขอแรกหลังหมดอายุยังได้ข้อมูลเก่า คำขอถัดไปได้ข้อมูลใหม่ กรณีคนเข้าน้อย หน้าแรกสดช้าสุดที่วัดได้ 88.4 วินาที (ใกล้เพดาน 90 วินาที); ถ้ามีคนเข้าอย่างน้อยทุก 5 วินาทีจะอยู่ที่ ~71 วินาที
- O-2: `/th/account` มี console 404 จากการ prefetch `/th/customer-service` (ลิงก์ใน `account-layout.tsx` มีอยู่แล้วบน develop) — เสนอเป็น task แยก
- รูปของ builder ใน `docs/evidence/flash-sale/FS-17/` = 0; รูปของ QA = 5

Defect: ไม่พบ
