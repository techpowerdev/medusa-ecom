# QA — CORE-87 (PR #496) หัว facet option บน /store

spec: docs/spec/01-core-medusa.md กฎข้อ 143 / AC-184 · build แบบ prod (`medusa build` NODE_ENV=production + `next build/start`) · commit 18c231f2

| AC | Result | Evidence |
|----|--------|----------|
| AC-184 กรองด้วย tag (สินค้า 2 ชิ้น option "ขนาด" F/L): หัว "ขนาด" ไม่มี "(0)" และไม่มีตัวเลข, F (2) / L (2) — 1280 | pass | qa496-1280-1-filtered.png |
| AC-184 เลือก F: หัวไม่ขึ้น "(1)", F `aria-pressed=true`, L `false`, ยังเห็น 2 ชิ้น — 1280 | pass | qa496-1280-2-selectedF.png |
| AC-184 ชุดเดียวกันที่ 375px | pass | qa496-375-1-filtered.png, qa496-375-2-selectedF.png |
| AC-184 `/th/store` แบบไม่กรอง: accordion เปิด/ปิดได้ (`aria-expanded` true→false→true) ที่ 1280 และ 375 | pass | qa496-1280-3-accordion-closed.png |
| testid `option-refinement-title` มีอยู่ หัวเป็นภาษาไทย | pass | ผล e2e |

e2e ของ PR `e2e/core-87-facet-heading.spec.ts` 1/1 ผ่าน · unit `src/core-87-facet-heading.test.ts` 2/2 ผ่าน
Playwright report/trace ฉบับเต็ม: CI artifact `e2e-evidence` (14 วัน)

## Negative / edge
| กรณี | Result |
|------|--------|
| กด F ซ้ำสองครั้ง → ยกเลิกการเลือก ยังเห็น 2 ชิ้น | pass |
| เลือก F และ L พร้อมกัน → pressed ทั้งคู่ หัวยังเป็น "ขนาด" | pass |
| เพิ่มชิ้นที่ 3 ที่มีแค่ F → F (3) / L (2) หัวไม่มีตัวเลข | pass |
| tag ที่ไม่มีสินค้า → ไม่มีหัว option ไม่มี pageerror | pass |

ข้อสังเกต (นอก scope): chip "ป้ายกำกับ" ในตัวกรองที่เลือกตัดบรรทัดไม่สวยเมื่อชื่อ tag ยาว (มีก่อน PR นี้)
