## งาน (Task)
Spec: `docs/spec/<nn>-<slug>.md` — Task ID: `<XX-n>`
ADR ที่เกี่ยวข้อง: ADR-___ (หรือไม่มี)

## สิ่งที่เปลี่ยน (ไม่เกิน 3 บรรทัด)
-

## ตรวจสอบการใช้ของเดิมของ Medusa
- [ ] ค้นหา module/workflow/API ของ Medusa สำหรับความสามารถนี้แล้ว ไม่พบ / พบบางส่วน (อธิบายด้านล่าง)
- ใช้: `<ชื่อ module/workflow>`
- ขยาย: `<hooks/links/widgets>`

## Acceptance criteria ที่ครอบคลุม
- [ ] AC-1 …
- [ ] AC-2 …

## ผลทดสอบ (สรุป ไม่ต้องวาง log เต็ม)
```
unit:        N passed
integration: N passed
e2e:         N passed
```
ผลเต็ม: `docs/evidence/<feature>/<task-id>-tests.txt`

## หลักฐาน (Evidence)
Screenshot / trace: `docs/evidence/<feature>/<task-id>/` (รายงาน QA: `REPORT.md`)

## Dependency ใหม่
ไม่มี | `<pkg>` — เหตุผล

## นอกขอบเขต / งานต่อเนื่อง
-

## Checklist
- [ ] เขียน test ก่อนโค้ด และ test ล้มเหลวถ้าไม่มีการเปลี่ยนแปลงนี้
- [ ] `pnpm lint && pnpm typecheck` ผ่าน
- [ ] commit migration แล้ว (ถ้ามี)
- [ ] ไม่มี secret ใน diff
- [ ] diff ≤ ~400 บรรทัด (ถ้าเกิน อธิบายว่าทำไมแยกไม่ได้)
