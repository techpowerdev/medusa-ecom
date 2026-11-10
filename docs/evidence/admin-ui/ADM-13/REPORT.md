# QA ADM-13 — PR #321 (หน้า `/group-buying` ใช้ `heading`/`subHeading`/`action` ของ `DataTable`)

- Spec: `docs/spec/08-admin-ui-medusa-components.md` แถว ADM-13, AC-17 (ฉบับแก้ใน PR นี้), กฎ 16/18
- Commit: `daff7fcea23832168ad5795de744573946429166` · prod build port 9210 · chromium 1280×800 · admin อังกฤษ · key ปลอม
- ผล test: spec QA 8 passed; e2e ของ repo 12 passed; unit 128 passed

| AC / รายการ | Result | Evidence |
|----|--------|----------|
| AC-17 heading 1 ตัว + ปุ่ม 1 ตัวใน `gb-campaigns-table` แถวเดียวกัน (ปุ่มเทียบบล็อก heading+subHeading ต่าง ≈0 px, เกณฑ์ ≤8; เทียบตัว heading 10.39 px ตามที่ PR ระบุ) | pass | 01-list-toolbar-ac17.png |
| AC-17 ไม่มีแถว toolbar ว่าง | pass | 01-list-toolbar-ac17.png |
| AC-17 `gb-template-warning` visible | pass | 01-list-toolbar-ac17.png |
| AC-17 static (ไม่ import header, ไม่มี `gb-campaign-create`, `open`/`onOpenChange`) | pass | unit 128 passed (2 suites) |
| AC-17 e2e `group-buy-admin-form` แก้เฉพาะ locator | pass | 12 passed (`group-buy-admin-form`, `-pages`, `-detail`) |
| กฎ 16 dblclick ปุ่มเปิด = dialog เดียว; JS click ซ้ำขณะเปิด ค่าและ key เดิม | pass | test `dblclick ปุ่มเปิด` |
| กฎ 16 ปิดแล้วเปิดใหม่ ฟอร์มว่าง (รวม select, DatePicker, picker, error) + key ใหม่ | pass | 05-reopen-empty-form.png |
| GB-13 network error แล้ว submit ซ้ำ key เดิม, แคมเปญเพิ่ม 1 | pass | test `network error` |
| กฎ 4 dblclick Create = 1 POST, ปุ่ม disabled, Esc ระหว่างรอไม่ปิด | pass | test `dblclick Create` |
| ADM-10 `gb_offset` Next/Prev; `abc`, ว่าง, `-5` → ลบ param; `25`, `99999` → 20 | pass | 06-gb-offset-page2.png |
| Empty state ยังมี heading, ปุ่ม, คำเตือน และเปิด modal ได้ | pass | 02-empty-state.png |
| Validation `gb-product-required-error`, `gb-max-quantity-error` ขึ้นและไม่มี POST | pass | 04-validation-errors.png |

Negative/edge เพิ่มเติม (pass): สำเร็จแล้วเปิดใหม่ฟอร์มว่าง + key ใหม่; เปิด/ปิด modal ที่หน้า 2 offset คงเดิม; คลิกแถวไปหน้ารายละเอียด
Negative control (inject บน DOM): เรียง toolbar แนวตั้งได้ 46.4 px เกินเกณฑ์จริง, แทรกแถวว่าง 32 px ตัวตรวจจับได้ 1 แถว

## Defect
ไม่มี

## ข้อสังเกต (ไม่ใช่ defect)
1. ปิด modal แล้ว focus ไปอยู่ที่ `BODY` ไม่กลับปุ่ม Create campaign (น่าจะมีอยู่เดิม อ่านจากโค้ด ไม่ได้รันบน develop)
2. `gb_offset=99999` ยิง request `offset=99980` หนึ่งครั้งก่อน clamp เป็น 20 ตามพฤติกรรม `usePageOffset`
