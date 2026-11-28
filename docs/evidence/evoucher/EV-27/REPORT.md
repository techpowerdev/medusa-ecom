# EV-27 — ผล QA (spec 02 กฎข้อ 43, AC-57..59) — PR #602

qa ตรวจบน prod build backend (`NODE_ENV=production`), ภาพทั้งหมดจาก commit `08fa31b3` (หลังแก้ nit ของ review); regression ชุดใหญ่รันบน `746e03ba` และ builder รันซ้ำบน `08fa31b3`
report/trace เต็มของ Playwright อยู่ใน CI artifact ของ PR #602

| AC | Result | Evidence |
|----|--------|----------|
| AC-57 | pass | unit `evoucher-pool-prerequisites.unit.spec.ts` — backend jest `src/admin` 29 suites / 961 tests บน `08fa31b3` |
| AC-58 | pass | `e2e/evoucher-admin-pool-prerequisites.spec.ts` 6 passed (th/en × a+b, c, d) บน `08fa31b3` — 01-prerequisites-list.png, 02-form-after-fix.png, 03-prerequisites-error.png |
| AC-59 | pass | diff ไม่มีไฟล์ใต้ `apps/backend/src/{workflows,api}`; บน `746e03ba` admin-form-pilot, admin-create-double-submit, admin-modal-return-focus, evoucher-admin-forms, admin-i18n-evoucher, admin-dialog-title + static ev-27-pool-ready-variant รวม 47 passed, evoucher-admin-pool-delete 4 passed; บน `08fa31b3` regression 6 spec 41 passed (builder), static 6 passed, parity/guard i18n ผ่าน |

ภาพ 01 มาจากการตรวจด้วยตาของ qa บน `08fa31b3` (variant ของสินค้าปกติ — ขาดเฉพาะ shipping profile) เพราะภาพ 01 ของ spec ถูกจับระหว่าง animation เปิด FocusModal (dialog ยังโปร่งใส)

## ตรวจด้วยตา (th/en บน `08fa31b3`)
- หน้า variant ของสินค้าปกติไม่มีกล่องเงื่อนไขค้าง ปุ่ม "สร้างคลังโค้ด" กดได้; กดแล้วขึ้นเฉพาะเงื่อนไขที่ขาดพร้อมลิงก์ไปหน้า Medusa (shipping profile / จัดการสถานที่) ที่เปิด drawer ได้
- คำไทยตรง Medusa ("รายการสินค้าคงคลัง", "สถานที่จัดเก็บสินค้า"); โหมด en ไม่มีอักษรไทย
- ดับเบิลคลิกเปิดได้ dialog เดียว; ⌘/Ctrl+Enter และ Enter ในหน้ารายการเงื่อนไขไม่มี POST; ดับเบิลคลิก Save = POST 1 ครั้ง แล้ว widget เป็น "จัดการโค้ด"
- inventory item ที่ใช้ร่วมกับสินค้าอื่น → ขึ้น `inventoryItem`; ลบ location level → ขึ้น `stockLocation` แก้แล้วได้ฟอร์ม
- ข้อสังเกต (ไม่ใช่ defect, ตามกฎ 43c ข้อ 1): query refetch ระหว่างกรอก (focus/online) ทำให้ฟอร์มกระพริบเป็น "กำลังโหลด" ชั่วครู่ ค่าที่กรอกไม่หาย

## Defect
ไม่พบ
