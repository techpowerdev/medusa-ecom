# SFUI-3b — QA evidence (spec 09)

ทดสอบรวมทั้ง stack ที่ปลาย `f1a81eba` (feat/SFUI-6-cleanup ซึ่งรวม 1a→6) ในเครื่อง 2026-11-26: backend + storefront แบบ prod build, DB seed ใหม่,
e2e chromium `--workers=1` ทั้งชุด = 484 ผ่าน / 4 ล้ม / 37 ข้าม (ทุกตัวที่ข้ามต้องใช้ Stripe test key จริง), `test:e2e:unit` 197/197, vitest 131 ไฟล์ 2009/2009
(ล้ม 4 = `core-50-nav-narrow` 1280 กว้างต่าง 1.27px บน macOS (ทราบอยู่แล้ว) + `payments-order-pay` 3 ตัวที่เกิดจาก env หลอกในเครื่อง — รันซ้ำบน env ที่ตรงกันผ่าน 17/17)
รายงานและ trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-10 | pass | `sfui-3b-sheet.spec.ts` 3/3 (side menu, search, mobile-actions-modal ที่ 390, รายการประเทศใน side menu); `core-19a` 8/8, `core-15b` 1/1, `core-70` 3/3, `core-75` 2/2, `thai-ui-shell` 2/2, `flash-sale-fs14` 5/5, `flash-sale-fs19` 3/3; `core-50-nav-narrow` 4/5 — ตัวที่ล้มคือ 1280 `nav-menu-button` กว้างต่าง 1.27px จากการเรนเดอร์ฟอนต์ของ macOS (ทราบอยู่แล้ว) → **รอ CI**; 01-side-menu-sheet.png, 02-search-sheet.png, 03-mobile-actions-sheet.png, 04-side-menu-country-open.png |
