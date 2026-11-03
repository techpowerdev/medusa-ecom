# Evidence: CORE-27 — ปุ่มเพิ่มตะกร้าบน PDP กันการยิงซ้อน (QA PR #221)

- Spec: `docs/spec/01-core-medusa.md` — AC-119, กฎข้อ 83 (owner สั่ง 2026-11-03)
- PR: #221 — branch `fix/CORE-27-add-to-cart-guard` @535b7af
- สภาพแวดล้อม: backend `medusa start`, storefront prod build, node 24.12.0; ลูกค้า login ทุกเคส; Stripe test mode เท่านั้น; หา element ด้วย `data-testid`
- รายงาน/trace ฉบับเต็ม: CI artifact ของ PR #221

## ผลตาม AC

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-119 desktop 1280px: dblclick / `el.click()` ×2 / `form.requestSubmit()` ×2 → addToCart ยิง 1 ครั้ง quantity 1; กดอีกครั้ง → 2 | pass | `ac119-desktop-dblclick-qty1.png`; e2e `core-27-add-to-cart-guard` `--repeat-each=5` 10/10 |
| AC-119 มือถือ 375×812: dblclick / `el.click()` ×2 ที่ `mobile-cart-button`, กดสลับปุ่มหลักกับปุ่มมือถือ 4 ครั้งใน tick เดียว → 1 ครั้ง quantity 1; กดอีกครั้ง → 2 | pass | `ac119-mobile-dblclick-qty1.png` |
| AC-119 (83c) option ที่ไม่มี variant (L) → ปุ่มหลักและปุ่มมือถือ disable, `el.click()` ไม่ยิง action | pass | `ac119-mobile-invalid-option-disabled.png` |
| addToCart ล้ม (500 / network abort) → error ไทยที่ `add-to-cart-error` / `mobile-add-to-cart-error`, ปุ่มกดได้อีก, กดซ้ำแล้วสำเร็จ quantity 1 | pass | `ac119-desktop-500-error-reenabled.png`, `ac119-mobile-network-error-reenabled.png` |
| request ช้า 2.5 วินาที → ปุ่ม disabled ระหว่างรอ, `el.click()` เพิ่ม 3 ครั้งไม่ยิงเพิ่ม | pass | ผล test QA-3 |
| regression CORE-24/25/26 และ FS-19 (e2e 10 เคส) + unit `core-27-add-to-cart-guard.test.ts` 8 เคส | pass | ผล test |

## Baseline บน develop (ไม่มี guard)
- e2e AC-119 ของ PR ล้มทั้งสอง viewport (ยิง 2 ครั้ง) เช่นเดียวกับ `requestSubmit` ×2 (2 ครั้ง) และกดสลับปุ่ม (4 ครั้ง) → test แยกโค้ดก่อน/หลังแก้ได้จริง
- `dblclick()` ของ Playwright ผ่านบน develop ด้วย (React render ทันระหว่างสองคลิก) และเคส option ที่ไม่มี variant ก็ผ่านเพราะ `!variant` เดิม disable อยู่แล้ว — `!isValidVariant` ที่เพิ่มไม่เปลี่ยนพฤติกรรมกรณีนี้

Defect: ไม่พบ

## ข้อสังเกต (ไม่ใช่ defect ของ PR)
1. หลังกด `mobile-cart-button` หน้าจอเลื่อนจาก `scrollY` 1726 กลับเป็น 0 และแถบล่างหาย — เกิดเหมือนกันบน develop (มีมาก่อน PR)
2. เมื่อ server ตอบ 500 หรือ network ล้ม ข้อความ error พูดถึงสินค้าคงเหลือ ("…จำนวนที่เลือกอาจเกินสินค้าคงเหลือหรือสินค้าหมดแล้ว") ทั้งที่สาเหตุไม่เกี่ยว — follow-up ของ copy
