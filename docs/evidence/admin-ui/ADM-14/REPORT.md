# QA ADM-14 — PR #327 (ปุ่มสร้างใน `action` ของ `DataTable`)

- Spec: `docs/spec/08-admin-ui-medusa-components.md` แถว ADM-14, AC-18, กฎ 18
- Commit: `a8bceff5a88c4eb33883adeb85ed641e02d02577` · prod build port 9213 · chromium 1280×800 · admin อังกฤษ · key ปลอม

| AC / รายการ | Result | Evidence |
|---|---|---|
| AC-18 ปุ่ม 1 ตัวใน wrapper (role+ชื่อ, ADR-018) ครบ 3 ตาราง | pass | 02-partners-page-2.png, 03-programs-toolbar.png, 04-payouts-toolbar.png |
| AC-18 `centerY` Partners (ไม่มี subHeading): ต่าง 0 px | pass | 02-partners-page-2.png |
| AC-18 `centerY` Programs/Payouts: เทียบบล็อก heading+subHeading 0.01 px (เทียบตัว heading 10.39 px เพราะ toolbar `items-center`) | pass ตามเกณฑ์เทียบบล็อก | 03-programs-toolbar.png, 04-payouts-toolbar.png |
| AC-18 ไม่มีแถว toolbar ว่าง: wrapper ถึง heading 16–18 px, toolbar ถึง thead 17 px | pass | log GEOM |
| AC-18 กดปุ่มแล้ว modal เดิมเปิด; dblclick และคลิกซ้ำ 3 ครั้งใน tick เดียว = dialog 1 ตัว; กดซ้ำไม่ล้างค่า | pass | 05-partners-modal-after-dblclick.png |
| AC-18 static: ไม่มี testid เดิม, ไม่ import header (unit 153 passed + grep) | pass | ผล test |
| AC-18 e2e locator ที่แก้ + dblclick Save = 1 POST (12/12 ของ PR) | pass | ผล test |
| Partners ว่างจริง: `NoRecords`/`evoucher-partners-empty`, ปุ่มกดได้, `0 of 0 results`, `1 of 1 pages`, Prev/Next disabled, ไม่มี NaN | pass | 01-partners-empty.png |
| สร้างสำเร็จแถวใหม่ขึ้น ครบ 3 ตาราง | pass | 03, 04 + ผล test |
| regression แก้/ลบแถว Partners, Programs และ Cancel ของ Payouts | pass | ผล test |
| regression แบ่งหน้า `partners_offset`, `programs_offset`, `payouts_offset` + reload | pass | 02-partners-page-2.png |

Negative/edge (pass): `partners_offset=40` ตอนไม่มีข้อมูล URL ถูกแก้และเห็น empty state; ลบแถวจนหน้า 2 หมดกลับหน้าแรก; สร้าง partner จากหน้า 2 URL คงเดิม; เปิด Edit แล้วเปิด Create ฟอร์มว่าง; Escape แล้วเปิดใหม่ค่าถูกล้าง; สลับแท็บ Programs/Payouts ปุ่มแท็บละ 1 ตัว

## Defect
ไม่พบ bug ของแอป
