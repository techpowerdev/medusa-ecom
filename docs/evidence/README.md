# Convention ของโฟลเดอร์ evidence (CORE-5, CORE-5b)

อ้างอิงกฎ CLAUDE.md ข้อ 6 "ไม่มี evidence เท่ากับไม่เคยเกิดขึ้น"

## โครงสร้าง
```
docs/evidence/
  <feature>/                    # kebab-case ตัวเล็ก เช่น core, group-buying, flash-sale
    <TASK-ID>-tests.txt         # builder: ผล test (unit/integration/e2e) ของ task
    <TASK-ID>/                  # เช่น CORE-5/, CORE-4a/
      REPORT.md                 # QA: ตาราง AC + อ้างอิง screenshot
      01-<ชื่อ-kebab>.png        # screenshot สำคัญ ≤ 5 รูป, PNG เท่านั้น, ≤ 300KB ต่อรูป
```
- `<TASK-ID>` มีรูปแบบ `^[A-Z]+-\d+[a-z]?$` (เช่น `CORE-5`, `GB-12`, `CORE-4a`, `CORE-5b`)
- ระดับ `<feature>/` อนุญาตเฉพาะไฟล์ `<TASK-ID>-tests.txt` และโฟลเดอร์ `<TASK-ID>/` เท่านั้น
- ในโฟลเดอร์ `<TASK-ID>/` อนุญาตเฉพาะ `REPORT.md` และ `*.png` เท่านั้น — **ห้ามวาง `<TASK-ID>-tests.txt` ในนี้**
  (ให้วางที่ระดับ `<feature>/`)
- `e2e/evidence-budget.unit.spec.ts` ตรวจกฎทั้งหมดนี้ทุกโฟลเดอร์ และ CI รันใน job `lint-typecheck`

## อะไรอยู่ใน git / อะไรอยู่ใน CI
| สิ่งที่เก็บ | ที่อยู่ | อายุ |
|-----------|--------|------|
| REPORT.md + screenshot สำคัญ ≤ 5 รูป | `docs/evidence/<feature>/<TASK-ID>/` (git) | ถาวร |
| HTML report, trace, screenshot ทุก step | `apps/storefront/playwright-report/`, `apps/storefront/test-results/` → CI artifact `e2e-evidence` | 14 วัน |

## การเขียน e2e
- import `test`, `expect` จาก `apps/storefront/e2e/support/fixtures.ts` (ไม่ใช่จาก `@playwright/test` โดยตรง)
- ตั้งปลายทาง: `test.use({ evidenceTarget: { feature: "core", taskId: "CORE-5" } })`
- ห่อทุกขั้นด้วย `await step("ชื่อขั้น", async () => { ... })` → แนบ screenshot หลังจบ step เสมอ
  (รวมกรณี fail) ลงใน HTML report ข้ามเฉพาะ step ที่ยังไม่เปิดหน้าใด (`about:blank` เช่น step ที่เรียก API อย่างเดียว)
- เรียก `await evidence("01-ชื่อ-kebab")` ณ จุดสำคัญ → แนบใน report เสมอ และเขียน PNG ลง
  `docs/evidence/...` เฉพาะเมื่อรันด้วย `E2E_SAVE_EVIDENCE=1` — ตรวจงบ (≤ 5 PNG, ≤ 300KB) กับชุดไฟล์หลังเขียน
  **ก่อน**เขียนจริง ถ้าเกินงบจะ throw และไม่เขียนไฟล์ใดเลย; เขียนทับชื่อเดิมไม่นับเป็นรูปใหม่
- ทุก test เก็บ trace + screenshot ตอนจบ (`playwright.config.ts`) viewport 1280×720

## คำสั่ง
```bash
pnpm --filter storefront test:e2e:unit                  # กฎ evidence + ตรวจ convention/งบทุกโฟลเดอร์ (ไม่ต้องมี server, CI รันทุก PR)
pnpm --filter storefront test:e2e                       # ทั้งหมด (ต้องมี storefront :8000 + backend :9000)
E2E_SAVE_EVIDENCE=1 pnpm --filter storefront test:e2e   # บันทึก screenshot สำคัญลง docs/evidence/
```
เปลี่ยน URL ได้ด้วย `E2E_BASE_URL` (storefront) และ `E2E_BACKEND_URL`
(ค่า default คือ `NEXT_PUBLIC_MEDUSA_BACKEND_URL` หรือ `http://localhost:9000`)
