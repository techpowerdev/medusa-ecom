# QA Evidence — FS-5 Admin widget "Flash sale options" (PR #38)

Spec: `docs/spec/03-flash-sale.md` — Task `FS-5`
- รอบ 1: ตรวจ AC ทั้งหมด → ผ่าน 4 ข้อ พบ D-1 (double submit / POST พร้อมกันได้ exclusivity rule ซ้ำ)
- รอบ 2 (2026-10-26, head `be6cef4`): ตรวจซ้ำ D-1 + regression

สภาพแวดล้อม: backend build + start จาก `.medusa/server` (`NODE_ENV=production`, Redis locking/workflow engine), DB แยก, admin ผ่าน Playwright (Chromium headless)

| AC | Result | Evidence |
|----|--------|----------|
| กฎข้อ 7: บันทึก config → automatic promotion ได้ rule `exclusivity.code_applied ne "true"`, บันทึกซ้ำไม่เพิ่ม, promotion แบบ code ไม่ถูกแตะ | pass | [03-saved-values-alert-gone.png](03-saved-values-alert-gone.png); รอบ 2: rule = 1 แถวต่อ automatic, code = 0 |
| Q1: Alert เตือน automatic promotion ที่ยังไม่มี rule | pass | [01-alert-before-save.png](01-alert-before-save.png); รอบ 2: Alert แสดงก่อน Save แล้วหายหลัง Save |
| AC-11 (a): `total_cap=5` ขณะ `units_sold=10` → 200 + คำเตือน sold out | pass | [04-cap-below-sold-warning.png](04-cap-below-sold-warning.png), [05-cap-saved-below-sold.png](05-cap-saved-below-sold.png) |
| Validation: ค่าไม่ใช่จำนวนเต็มบวก/`units_sold` → 400, ไม่มี campaign → 404, ไม่ login → 401 | pass | [02-invalid-input-error.png](02-invalid-input-error.png) |
| D-1 (a) double-click Save (มี config แล้ว + automatic ใหม่) → POST 1 ครั้ง, rule 1 แถว | pass (ดู D-1r) | คลิกห่าง ≥ 10ms → POST 1 ครั้ง ปุ่ม disabled ระหว่างส่ง; rule 1 แถว |
| D-1 (b) double-click Save ตอนสร้าง config ครั้งแรก → ไม่มี toast error | pass | toast "Flash sale options saved" อย่างเดียว, 200 ทุกตัว, config 1 แถว |
| D-1 (c) POST พร้อมกัน 5 ครั้ง → 200 ทุกตัว, config 1 แถว, rule 1 แถวต่อ promotion | pass | 5×200 config id เดียวกัน; stress 40 ครั้ง → 200 ทั้งหมด ไม่มี lock timeout; lock ไม่ค้างใน Redis |
| D-1 (d) `total_cap=0` → 400 "at least '1'" | pass | `Value for field 'total_cap' too small, expected at least: '1'` |

## Defect ที่เหลือ
**D-1r (minor, ไม่ block — ข้อมูลไม่เสียหาย):** คลิก Save หลายครั้งภายใน event loop tick เดียวกัน (0ms, เช่น `dblclick()` ของ Playwright) ยังส่ง POST 2–3 ครั้งและ toast "saved" ซ้ำ เพราะ `isPending` ของ TanStack Query อัปเดตหลัง 1 tick — แนวทาง: in-flight flag ด้วย `useRef` → follow-up; double-click ของคนจริง (80–250ms) ไม่เจอ

## Artifact
Screenshot 5/5 รูปตามงบ (รอบ 2 ไม่เปลี่ยน); Playwright report/trace ฉบับเต็ม: CI artifact (14 วัน)
