# QA — ADM-42 (PR #451) ฟอร์ม affiliate program แสดง error ทุกช่องพร้อมกัน (spec 08 กฎ 46, AC-47)

สภาพแวดล้อม: prod build backend+admin (`medusa build` → `medusa start`), DB แยก, commit afa50709
รัน: e2e ของ builder (`admin-program-form-errors.spec.ts`) + e2e ของ qa (Q1–Q7) — 8/8 passed, `--repeat-each=2` 16/16 passed
Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #451 (14 วัน)

| AC / กรณี | Result | Evidence |
|----|--------|----------|
| AC-47 Create ว่าง + ends<starts + ปิด All products กด Save ครั้งเดียว → error name, ends_at, commission, scope พร้อมกัน ไม่มี POST; แก้ชื่อแล้ว Save → error ที่เหลือคงอยู่ | pass | 01-program-form-all-errors.png, qa451-01-create-empty-all-errors.png |
| Q1 Create ว่างทั้งฟอร์ม → error ครบ 4 ช่องในครั้งเดียว, focus ที่ name, ดับเบิลคลิก Save ซ้ำยังไม่มี POST | pass | qa451-01-create-empty-all-errors.png |
| Q2 ผิดหลายช่อง (commission 150, ends<starts, attribution 0, hold -1, cap 0, scope ว่าง) → error ครบ 6 ช่อง ไม่มี POST | pass | qa451-02-create-multi-invalid.png |
| Q3 แก้ทีละช่อง → error ช่องที่แก้หายทันที ช่องอื่นยังอยู่ → แก้ครบแล้ว Save → POST 1 ครั้ง, program 1 แถว | pass | qa451-03-fix-one-by-one.png |
| Q4 Edit ผิด 5 ช่อง → error ครบ + focus ที่ name ไม่มี POST; แก้แล้วดับเบิลคลิก Save → POST 1 ครั้ง ค่าใหม่ถูกต้อง | pass | qa451-04-edit-multi-invalid.png |
| Q5 ⌘/Ctrl+Enter เหมือน Save (ว่าง → error ครบ; ถูก + กด 2 ครั้ง → POST 1) | pass | ผล e2e Q5 |
| Q6 regression ADM-39: มี error → กรอกถูก → ดับเบิลคลิก Save → POST 1 ครั้ง | pass | ผล e2e Q6 |
| Q7 Esc แล้วเปิดใหม่ → ฟอร์มสะอาด (ทั้งไม่ dirty และ dirty+error → Leave) | pass | ผล e2e Q7 |

ข้อสังเกต (ไม่ขัด spec): แก้ starts_at จนช่วงวันที่ถูกแล้ว แต่ error "End must be after start" ใต้ ends_at ยังค้างจนกด Save ครั้งถัดไป (react-hook-form re-validate เฉพาะช่องที่แก้); ฟอร์มแก้ใช้ FocusModal ไม่ใช่ Drawer ตาม ADR-018 Q5 (มีอยู่ก่อน PR)
