# QA CORE-8: ฟอนต์ Noto Sans Thai สำหรับ class ของ `@medusajs/ui-preset`
PR #41, branch `feat/CORE-8-thai-font-override` @ `41dd33c` (spec 01 ส่วน Follow-up: AC-24, AC-25)
สภาพแวดล้อม: backend build + start (`.medusa/server`, port 9118, DB `medusa_qa_core8` ที่ seed แล้ว), storefront `next build` + `next start` (port 8118), Node 22, Chromium 1280x720

| AC | Result | Evidence |
|----|--------|----------|
| AC-24 | pass | Vitest `src/styles/ui-preset-font.test.ts` 5/5 (storefront 27/27); compile Tailwind: `.txt-compact-small`, `.txt-medium`, `.h1-webs`, `.h2-core`, `.h1-docs` ได้ `var(--font-noto-sans-thai), Inter, ...` |
| AC-25 | pass | `e2e/ui-preset-font.spec.ts` 1 passed: หน้าแรกมี element ของ preset 14 ตัว ทุกตัวมี Noto Sans Thai ก่อน Inter — [01-home-noto-sans-thai.png](01-home-noto-sans-thai.png) |

## ตรวจเพิ่ม (นอก AC)
| รายการ | ผล | Evidence |
|---|---|---|
| PDP `/th/products/sweatshirt` | pass: `txt-*` 20 ตัวใช้ Noto ก่อน Inter, ราคา ฿990 ใช้ Noto | [02-pdp-noto-sans-thai.png](02-pdp-noto-sans-thai.png) |
| Account `/th/account` | pass: `txt-*` 18 ตัวและ H1/H3 ใช้ Noto ก่อน Inter | [03-account-noto-sans-thai.png](03-account-noto-sans-thai.png) |
| ข้อความไทยใน nav/heading/footer (ใส่ลง DOM ระหว่างทดสอบ เพราะ UI ยังอังกฤษจนถึง CORE-4b) | pass: face ไทยของ Noto โหลดจริง สระ/วรรณยุกต์ซ้อนถูก ไม่มี overflow | [04-home-thai-text-injected.png](04-home-thai-text-injected.png), [05-footer-thai-text-injected.png](05-footer-thai-text-injected.png) |
| `code-*` ยังเป็น monospace | pass: `.code-label` = `Roboto Mono, ui-monospace, ... monospace` | unit test + compile Tailwind |
| โครงสร้าง preset เปลี่ยน | pass: `withThaiUiPreset({plugins:[]})` throw | unit test |

## Defect
ไม่พบ

## ข้อสังเกต
- CI job `storefront-e2e` ของ PR นี้ถูก SKIPPED (branch ยังไม่มี CORE-6) ผล AC-25 มาจากการรันในเครื่อง
- ชื่อ test e2e ไม่ขึ้นต้นด้วย `AC-25`; regex จับ `txt-ui-fg-base` (class สี) ด้วยแต่ไม่ทำให้ผลผิด
