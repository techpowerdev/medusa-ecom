# SFUI-1a — QA evidence (spec 09)

ทดสอบรวมทั้ง stack ที่ปลาย `f1a81eba` (feat/SFUI-6-cleanup ซึ่งรวม 1a→6) ในเครื่อง 2026-11-26: backend + storefront แบบ prod build, DB seed ใหม่,
e2e chromium `--workers=1` ทั้งชุด = 484 ผ่าน / 4 ล้ม / 37 ข้าม (ทุกตัวที่ข้ามต้องใช้ Stripe test key จริง), `test:e2e:unit` 197/197, vitest 131 ไฟล์ 2009/2009
(ล้ม 4 = `core-50-nav-narrow` 1280 กว้างต่าง 1.27px บน macOS (ทราบอยู่แล้ว) + `payments-order-pay` 3 ตัวที่เกิดจาก env หลอกในเครื่อง — รันซ้ำบน env ที่ตรงกันผ่าน 17/17)
รายงานและ trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-1 (ขั้น 1a) | pass | `sfui-deps.unit.spec.ts` ผ่าน; `pnpm --filter storefront build` + `test:unit` ผ่าน (lint/typecheck ดูจาก CI) |
| AC-2 | n/a ที่ปลาย stack | `sfui-legacy-css.unit.spec.ts` ถูกลบใน SFUI-6 ตาม AC-16 (legacy-medusa.css ไม่มีแล้ว) |
| AC-3 | pass | `ui-preset-font.spec.ts` ผ่าน + unit `theme-css.test.ts`; 01-home-noto-sans-thai.png |
| AC-4 (CSS ของ 1a) | pass | unit `theme-css.test.ts` (ค่า hex brand ครบ) |
| AC-5 | pass | `sfui-baseline.unit.spec.ts` ผ่าน |
| AC-6 | pass | `sfui-legacy.unit.spec.ts` ผ่าน (PENDING ว่างที่ปลาย stack) |
| AC-17 | pass | `sfui-mobile-390.spec.ts` ผ่านบน DB สะอาด (รันก่อนชุดเต็ม) และในชุดเต็ม; ตรวจด้วยตา 35 หน้า/สถานะที่ 390px ไม่มีหน้าใดล้นแนวนอน; 01-pdp-390.png, 02-checkout-390.png |
| AC-18 | pass | `git diff <merge-base develop> -- apps/backend` และไฟล์ e2e ที่เปิด `/app` ตามกฎ 18 ว่าง; e2e admin ทั้งหมดผ่านในชุดเต็ม |
