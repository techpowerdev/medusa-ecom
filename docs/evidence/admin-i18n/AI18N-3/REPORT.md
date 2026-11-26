# Evidence: admin ภาษาไทย (spec 10, ADR-031) — AI18N-3

qa ตรวจที่ปลาย stack `68d3cb33` (รวม AI18N-1..4) บน prod build (`NODE_ENV=production pnpm --filter backend build` + `medusa start`, storefront `next build/start`), Stripe test mode
หลังจากนั้น AI18N-4 แก้ตาม review เป็น `534893cb` (`general.noResults*` ของ Medusa, `i18n-check.ts`) — builder รัน e2e affiliate ซ้ำบน commit นั้นผ่าน 23/23
report/trace เต็มของ Playwright อยู่ใน CI artifact `e2e-evidence` (14 วัน)

| AC | Task | Result | Evidence |
|----|------|--------|----------|
| AC-3 | AI18N-3 | pass | `i18n.unit.spec.ts`, `lib/__tests__/i18n-evoucher.unit.spec.ts` (key literal, enum) |
| AC-4 | AI18N-3 | pass | `lib/__tests__/i18n-evoucher.unit.spec.ts` (en/th/de); `order-refund-blocked.unit.spec.ts` |
| AC-5 | AI18N-3 | pass | guard AST; `I18N_PENDING.evoucher` ว่าง |
| AC-7 | AI18N-3 | pass | e2e admin เดิมของ e-voucher/widget ผ่าน รวม `pay-10`, `core-55`, `payments-refund` (Stripe จริง) |
| AC-10 | AI18N-3 | pass | `e2e/admin-i18n-evoucher.spec.ts` 2/2 — 02-pool-th.png |

## ตรวจด้วยตา (ไม่อยู่ใน AC)
- `lng=th`: เมนู แอฟฟิลิเอต/บัตรกำนัล/ซื้อกลุ่ม, heading และแท็บเป็นไทย; หน้า Medusa เดิมไทยตาม `th.json`; ไม่พบ key ดิบ
- `lng=en`: ข้อความเท่าเดิม ไม่มีอักษรไทย
- `lng=de`: หน้า Medusa เป็นเยอรมัน ข้อความของเรา fallback เป็นอังกฤษ ไม่มี key ดิบ (กฎ 11)
- นอกขอบเขต: เมนู "Drafts" (plugin `@medusajs/draft-order`) และ "no limit" ในการ์ด budget ของ campaign เป็นข้อความของ Medusa

## Flaky
- `admin-row-menu-return-focus.spec.ts:129` (AC-52 payouts) ล้ม 1 ครั้งตอนรันขนาน (alertdialog ยังอยู่หลัง Escape) — รันเดี่ยว `--repeat-each=3` ผ่าน 9/9 ไม่เกี่ยวกับรอบนี้

## Defect
ไม่พบ
