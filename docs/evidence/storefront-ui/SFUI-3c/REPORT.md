# SFUI-3c — QA evidence (spec 09)

ทดสอบรวมทั้ง stack ที่ปลาย `f1a81eba` (feat/SFUI-6-cleanup ซึ่งรวม 1a→6) ในเครื่อง 2026-11-26: backend + storefront แบบ prod build, DB seed ใหม่,
e2e chromium `--workers=1` ทั้งชุด = 484 ผ่าน / 4 ล้ม / 37 ข้าม (ทุกตัวที่ข้ามต้องใช้ Stripe test key จริง), `test:e2e:unit` 197/197, vitest 131 ไฟล์ 2009/2009
(ล้ม 4 = `core-50-nav-narrow` 1280 กว้างต่าง 1.27px บน macOS (ทราบอยู่แล้ว) + `payments-order-pay` 3 ตัวที่เกิดจาก env หลอกในเครื่อง — รันซ้ำบน env ที่ตรงกันผ่าน 17/17)
รายงานและ trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-11 | pass | `sfui-3c-select.spec.ts` 4/4 (ArrowDown+Enter เลือกที่อยู่ที่สอง, Escape ไม่เปลี่ยนค่า, `edit-panel` `data-open`, Popover ของตะกร้า, Select ประเทศ); `core-26` 2/2, `core-91` 5/5, `core-19a` 8/8, `core-22` 2/2, `core-23` 4/4, `core-23b` 2/2, `core-4j` 2/2, `core-4g` 1/1, `core-63` 1/1; 01-checkout-address-select-keyboard.png, 02-profile-phone-collapsible-open.png, 03-cart-dropdown-popover-1280.png |
