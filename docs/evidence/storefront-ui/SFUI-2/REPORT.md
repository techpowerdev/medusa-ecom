# SFUI-2 — QA evidence (spec 09)

ทดสอบรวมทั้ง stack ที่ปลาย `f1a81eba` (feat/SFUI-6-cleanup ซึ่งรวม 1a→6) ในเครื่อง 2026-11-26: backend + storefront แบบ prod build, DB seed ใหม่,
e2e chromium `--workers=1` ทั้งชุด = 484 ผ่าน / 4 ล้ม / 37 ข้าม (ทุกตัวที่ข้ามต้องใช้ Stripe test key จริง), `test:e2e:unit` 197/197, vitest 131 ไฟล์ 2009/2009
(ล้ม 4 = `core-50-nav-narrow` 1280 กว้างต่าง 1.27px บน macOS (ทราบอยู่แล้ว) + `payments-order-pay` 3 ตัวที่เกิดจาก env หลอกในเครื่อง — รันซ้ำบน env ที่ตรงกันผ่าน 17/17)
รายงานและ trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-4 (2) | pass | `sfui-2-brand.spec.ts`: พื้นปุ่ม `add-product-button` = rgb(23, 23, 23); 01-pdp-add-button-brand-900.png |
| AC-8 | pass | vitest `src/components/ui/button.test.tsx` ถูกรันและผ่าน; `core-90-link-button.unit.spec.ts` ผ่าน |
