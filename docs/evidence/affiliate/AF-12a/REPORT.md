# QA REPORT — AF-12a admin Programs (PR #163)

Spec: `docs/spec/05-affiliate.md` กฎ 20, กฎ 37/37a, AC-42 · ตรวจที่ commit `6fbf0df`
สภาพแวดล้อม: prod build (`medusa build` + `medusa start`, admin `/app`), DB/Redis แยกของ QA, Stripe key ปลอม,
browser timezone `America/New_York` (เพื่อพิสูจน์ว่าเวลาเป็น ICT ไม่ขึ้นกับเครื่อง)
CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/40512938790 (ทุก job ผ่าน; Playwright report/trace เต็มอยู่ใน artifact ของ run นี้ 14 วัน)

## Acceptance criteria

| AC | Result | Evidence |
|----|--------|----------|
| AC-42 สร้างผ่าน `affiliate-program-create` แล้ว dblclick Save → `POST /admin/affiliate/programs` 1 ครั้ง แถว `draft` ใหม่ปรากฏโดยไม่ reload | pass | 01-program-created.png; e2e `affiliate-admin-programs.spec.ts` + QA-1 |
| AC-42 แก้ `commission_value` → GET ได้ค่าใหม่ และ `scope.variant_ids` (ตั้งผ่าน API) ไม่เปลี่ยน | pass | 02-program-edit-form.png; e2e + QA-3 |
| AC-42 โปรแกรม `published` → ตัวเลือก status ไม่มี `draft` และแถวไม่มี `affiliate-program-delete` | pass | 03-published-status-options.png; e2e + QA-4 |
| AC-42 ลบ draft: ยกเลิก prompt → ไม่มี `DELETE`; ยืนยัน → แถวหาย | pass | 04-delete-prompt.png; e2e + QA-7 |
| AC-42 `ends_at` ก่อน `starts_at` → เห็น error และไม่มี `POST` | pass | e2e + QA-5 |

## Checklist ของ PR (browser timezone America/New_York)

| ข้อ | Result | Test |
|----|--------|------|
| 1. ค่าเริ่มต้น attribution 7 / hold 14 / status draft / All เปิด; ตอนสร้าง status มีแค่ draft/published; dblclick Save = POST 1 ครั้ง | pass | QA-1 |
| 2. ปิด All → เห็น collection/category ของร้าน; เลือก 2 collection + 1 category → GET ได้ `collection_ids`/`category_ids` ตรง | pass | QA-2, qa-01-scope-ict-form.png |
| 3. `variant_ids` (API, 2 ตัว) คงอยู่ทั้งตอนสลับ All เปิดและปิด; "Variants set via API: 2"; dblclick Save ตอนแก้ = POST 1 ครั้ง | pass | QA-3 |
| 4. status: draft → draft/published/ended, published → published/ended, ended → ended; Delete มีเฉพาะ draft | pass | QA-4 |
| 5. ends = starts, commission 0/101/-1, ชื่อว่าง/ช่องว่าง, attribution 0 → error ใต้ช่อง ไม่มี request | pass | QA-5 |
| 6. API error (อีกแท็บเปลี่ยนเป็น ended แล้ว UI save เป็น published) → toast, refetch โดยไม่ reload | pass | QA-6 |
| 7. Keep program = ไม่มี DELETE; dblclick Delete เปิด prompt เดียว; dblclick ยืนยัน = DELETE 1 ครั้ง; ลบแถวที่อีกแท็บ publish แล้ว → toast, refetch, ปุ่ม Delete หาย | pass | QA-7 |
| 8. เวลาในฟอร์มเป็น ICT ตรงกับคอลัมน์ (เคสข้ามวัน 17:30Z = 00:30 ICT วันถัดไป); กรอก 09:15 ICT → 02:15Z | pass | QA-2, QA-2b |
| admin เป็นภาษาอังกฤษ | pass | QA-1, QA-7, QA-10 |
| Regression แท็บ Affiliates/Ledger/Payouts (AF-6) และ payout cancel (AF-9) | pass | QA-10, `affiliate-admin-payouts.spec.ts`, regression AF-6 (3 test) |

## Negative / edge case (นอก spec)

| กรณี | ผลที่ได้ | หมายเหตุ |
|------|--------|----------|
| `starts_at` ที่ตั้งผ่าน API มีวินาที แล้วแก้แค่ commission ใน UI | ถูกปัดวินาทีทิ้ง | datetime-local ละเอียดแค่นาที ผลกระทบต่ำ — follow-up |
| ปิด All แล้วไม่เลือกอะไรเลย แล้ว Save | บันทึกได้ scope ว่าง (ไม่ครอบคลุมสินค้าใด) | spec ไม่ได้ห้าม — follow-up ให้ planner ตัดสิน |
| แก้/ลบ program ระหว่างที่อีกแท็บเปลี่ยนสถานะ | 400 → toast + refetch | ตามกฎ 37 |

## ผลรัน
- e2e ของ builder: 1 passed · QA spec (ในเครื่อง ไม่ได้ commit): 11 passed · regression AF-6/AF-9: 4 passed
- CI run 40512938790: ทุก job ผ่าน

Defect: ไม่พบ
