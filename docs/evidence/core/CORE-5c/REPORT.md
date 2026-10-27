# QA CORE-5c — PR #169 (spec 01 กฎข้อ 67, AC-103)

งานนี้เป็น tooling ของ e2e ไม่มี UI จึงไม่มี screenshot หลักฐานคือผลของ test และ `git status` ด้านล่าง
ตรวจที่ head `0004e35` บน prod build (`medusa start` + `next start`) ใน worktree แยก, DB/Redis ของ QA, Stripe key ปลอม
CI run: https://github.com/techpowerdev/medusa-ecom/actions/runs/40528002695 (changes, lint-typecheck, storefront-e2e = pass; backend = skipped ตาม classify-changes) — report/trace ฉบับเต็มอยู่ใน artifact `e2e-evidence`

| AC | Result | Evidence |
|----|--------|----------|
| AC-103 (1) `E2E_SAVE_EVIDENCE=1` รันเฉพาะ core-22 → เปลี่ยนเฉพาะใต้ CORE-22/ และ PNG ≤ 5 | pass | ทั้ง 2 test ล้มด้วย `evidence เกินงบใน docs/evidence/core/CORE-22` และ `git status --porcelain docs/evidence` ว่าง PNG ยังเป็น 5 รูป; รอบเสริม (ย้าย PNG เดิมออกชั่วคราว): 2 passed ไฟล์ใหม่มีเฉพาะใต้ `CORE-22/` และเป็นชื่อจาก `evidence()` ทั้งคู่ (ไม่มีรูปจาก `step()`) |
| AC-103 (2) รัน core-23 แบบเปิด save → CORE-22/ ไม่เปลี่ยน | pass | 4 passed; `git status` แสดงเฉพาะไฟล์ใต้ `CORE-23/`; `shasum -c` ของ PNG ใน CORE-22 OK ครบ 5 ไฟล์ |
| AC-103 (3) ไม่เปิด save → ไม่มีไฟล์ใน docs/evidence เปลี่ยน | pass | รัน chromium ทั้งชุด 112 test: `git status --porcelain docs/evidence` ว่าง |
| AC-103 (4) e2e `evidence-guard.spec.ts` ผ่านทั้งตอนเปิดและปิด save | pass | ทั้งสองแบบ 1 passed และ `git status` ว่าง; Playwright project `unit` 35 passed (รวม 4 เคสของ `evidence-save.unit.spec.ts`) |

## Edge case: รัน chromium ทั้งชุดแบบเปิด save (workers=1, DB ใหม่)
- ไฟล์ที่เปลี่ยนทุกไฟล์อยู่ในโฟลเดอร์ของ `evidenceTarget` ของ spec ที่เขียน และเป็นชื่อจาก `evidence()`
- ไม่มีโฟลเดอร์ใดเกิน 5 PNG และไม่มี PNG เกิน 300KB; CORE-22 ไม่เปลี่ยน
- spec ที่โฟลเดอร์เต็มงบ throw โดยไม่เขียนไฟล์: AF-6, CORE-14a, CORE-14d, CORE-22, CORE-4f, FS-10, GB-6b1

## Defect
ไม่พบ

## ข้อสังเกต (นอก scope — backlog)
- ชื่อ PNG ที่ QA commit ไว้ไม่ตรงกับชื่อใน `evidence()` ของ spec หลายโฟลเดอร์ (เช่น CORE-22 `qa-01-*` vs `01-*`, FS-10, AF-6) → รันทั้งชุดแบบเปิด save จะได้ไฟล์ untracked ค้าง และ `evidence()` ตัวถัดไป throw (ไม่เกินงบ 5 รูปตามกฎ)
- test checkout 4 ตัวล้มในเครื่องเพราะ Stripe key ปลอม (CI ที่ใช้ test key ผ่าน) — PR นี้ไม่แตะ checkout
