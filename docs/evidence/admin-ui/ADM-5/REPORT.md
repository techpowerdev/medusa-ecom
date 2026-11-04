# QA ADM-5: ตาราง Partners (PR #302, head ddd80c8)

spec: `docs/spec/08-admin-ui-medusa-components.md` AC-8 (กฎ 8–11) + spec 02 กฎข้อ 26
สภาพแวดล้อม: prod build (`medusa build` + `medusa start`), viewport 1280×800, locale en-US, timezone Asia/Bangkok
รอบ 1: DB ที่มี partner น้อย รอบ 2: DB ที่มี partner 55 ราย
Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact ของ PR #302 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-8 partner 25 ราย → 20 แถวหน้าแรก, 5 แถวหน้าสอง, `partners_offset` อยู่ใน URL, reload แล้วยังอยู่หน้าเดิม (mock) | pass | `evoucher-admin-partners` test 1 (รอบ 1 และ 2) |
| AC-8 ข้อมูลจริง: partner 26 ราย → 20 แถว, Next → `partners_offset=20` 6 แถว, reload แล้วยังอยู่หน้าเดิม, Prev กลับมา 20 แถว | pass | qa-ac8-real-page2-after-reload.png |
| AC-8 ปุ่ม Create partner อยู่ใน `action` ของ DataTable ไม่มีแถว toolbar ว่าง (ปุ่มอยู่แถวเดียวกับ heading และห่างจากตาราง 17px) | pass | qa-ac8-real-page2-after-reload.png |
| AC-8 ไม่มี partner → เห็น `evoucher-partners-empty` และกด Create partner ได้ | pass | `evoucher-admin-partners` test 1 (mock 0 ราย) |
| AC-8 ชื่อว่างหรือเป็นเว้นวรรคล้วน → "Name is required" ใต้ช่อง Name ไม่มี POST | pass | qa-create-url-errors.png |
| AC-8 / กฎ 26: `logo_url`/`terms_url` = `javascript:`, `JavaScript:`, `data:`, `ftp:`, `vbscript:`, `example.com`, `https://` → error ใต้ช่องและไม่มี request (ทั้ง Create และ Edit) | pass | qa-create-url-errors.png |
| AC-8 / กฎ 26: `http://`, `https://` (มีเว้นวรรคหน้า/หลังถูก trim ออก) และค่าว่างส่งได้ → บันทึกเป็น `null`/URL; Edit ล้าง `logo_url` แล้วได้ `null` | pass | QA spec CREATE/EDIT |
| AC-8 Edit/Delete ผ่าน `evoucher-partner-row-actions` → menuitem "Edit"/"Delete"; Delete กด Cancel ใน prompt แล้วไม่มี `DELETE` | pass | `evoucher-admin-partners` test 3 + QA spec DELETE |
| AC-8 / AC-20 `evoucher-admin-forms` ผ่านโดยแก้แค่ locator | pass (รอบ 1) / **fail (รอบ 2, partner > 20) — D-1** | qa-regression-forms-row-on-page2.png |

## Negative / edge
| กรณี | ผล |
|------|----|
| Create: `Cmd+Enter` ×3 + dblclick ระหว่างหน่วง POST | POST 1 ครั้ง |
| Edit: `Cmd+Enter` ×3 ระหว่างหน่วง POST | POST 1 ครั้ง |
| Delete: dblclick ปุ่มยืนยัน แล้วเปิดเมนูกด Delete อีกครั้งระหว่างรอ | DELETE 1 ครั้ง (menuitem เป็น `data-disabled` และไม่มี prompt ที่สอง) |
| Edit: network abort | toast "Failed to fetch", ปุ่ม Save กดได้อีก, Drawer ยังเปิดอยู่ |
| Edit: backend ตอบ 500 | toast แสดงข้อความจาก backend, ไม่ค้าง |
| Delete: partner ที่ยังมี pool | 400 `not_allowed`, toast "Partner still has pools; delete its pools first", แถวยังอยู่ |
| Delete: network abort | toast "Failed to fetch", ลบซ้ำได้ (prompt ขึ้นใหม่) |
| API กฎ 26: POST `javascript:` หรือ `data:` | 400 `invalid_data` ไม่บันทึก |
| `partners_offset` = `abc`, `-20`, ค่าว่าง | ขอ offset 0, URL ถูกแก้, ไม่มี NaN |
| `partners_offset` = `20.7` / `1e3` | ปัดเป็น 20 / 1000 |
| `partners_offset` = `99999` | 0 แถว, "No partners on this page", "26 of 26 results", "5000 of 2 pages"; Prev → 99960 ยังว่าง (ไม่ค้าง แต่ออกได้ทางเดียวคือแก้ URL) |
| `partners_offset` = `5` | แสดงแถว 6–25 แต่บอก "1 of 2 pages" (offset ไม่ถูกปัดให้ลงเลขหน้า) |
| ลบแถวสุดท้ายของหน้า 2 (21 → 20 ราย) | "No partners on this page", "21 – 20 of 20 results", "2 of 1 pages" ตามที่ reviewer คาด → ADM-10 กฎ 13 (qa-edge1-delete-last-row-page2.png) |
| widget Create pool บน variant | dropdown มี partner ครบ 30/30 (limit 100) รวมรายที่อยู่หน้า 2 ของตาราง, เลือกแล้ว POST pool 200 |
| regression รอบ 1 (`evoucher-admin-*` ×4 + `admin-form-pilot`) | 9/9 ผ่าน |
| regression รอบ 2 (partner 55 ราย) | 8/9 ผ่าน, `evoucher-admin-forms` ล้ม (D-1) |
| unit `evoucher-partner-form` + `medusa-ui` | 89/89 ผ่าน |

## Defect
**D-1 (test fragility ใน regression ไม่ใช่บั๊กของแอป):** `apps/storefront/e2e/evoucher-admin-forms.spec.ts:82` เขียนว่า `expect(page.getByText(name, { exact: true })).toHaveCount(1)` โดยไม่ล็อกว่าแถวต้องอยู่หน้าแรก
- ขั้นตอนทำซ้ำ: สร้าง partner ที่ชื่อเรียงก่อน "EV-9" 25 ราย (เช่น "AAA …") ผ่าน API แล้วรัน `evoucher-admin-forms`
- Expected: test ผ่าน
- Actual: POST 1 ครั้งและได้ 200 ตามที่ควร แต่ partner ใหม่ตกไปอยู่หน้า 2 (ตารางเรียงตามชื่อทีละ 20 แถว) → `Received: 0`
- ส่งกลับ builder แก้ locator/ชื่อของ test

## Observation
- O-1: offset เกินท้ายตาราง (ลบแถวสุดท้ายของหน้า 2 หรือ `partners_offset=99999`) ไม่ถูก clamp หน้าแสดงว่า "2 of 1 pages" หรือ "5000 of 2 pages" และ Prev ถอยได้ทีละหน้าเท่านั้น offset ที่ไม่ลงเลขหน้า (`5`) ก็ไม่ถูกปัด ทั้งหมดอยู่ในขอบเขตกฎ 13 ของ ADM-10 ซึ่ง (e) ระบุให้ใช้กับตาราง partners ด้วย
- O-2: toast error ตอน Drawer Edit เปิดอยู่ถูก overlay ของ Drawer บังจนจาง (qa-edit-network-error-toast.png) เกิดจากลำดับซ้อนของ `toast` กับ `Drawer` ของ Medusa ไม่ใช่โค้ดของ ADM-5 ผู้ใช้จะเห็นข้อความไม่ชัด
- O-3: สร้าง partner แล้ว ถ้าแถวใหม่ไปอยู่หน้าอื่นตามลำดับชื่อ ผู้ใช้จะไม่เห็นแถวนั้น มีแค่ toast "Partner created" ให้รู้ (ต้นเหตุเดียวกับ D-1)

## สรุป
AC-8 ผ่านทุกข้อ ทั้ง DataTable, empty state, ปุ่มใน `action`, ฟอร์ม Form/zod, การตรวจ URL ตามกฎ 26, ActionMenu, prompt และการกันกดซ้ำ widget Create pool ยังใช้ได้หลังเปลี่ยน signature เหลือ D-1 ที่ทำให้ `evoucher-admin-forms` ล้มบน DB ที่มี partner เกิน 20 ราย ส่งกลับให้ builder แก้

## หลังแก้ D-1 (head `c411d26`, commit `c54ad18`)
- `evoucher-admin-forms` ใช้ชื่อขึ้นต้น `000 EV-9 partner …` หาแถวภายใน `evoucher-partners` และลบ partner ตอนจบ; `evoucher-admin-partners` อ่าน partner ด้วย id จาก response ของ POST (เดิม `order=-created_at&limit=1` แข่งกับ worker อื่น)
- บน DB ที่มี partner "AAA …" 25 ราย: ก่อนแก้ `evoucher-admin-forms` ล้ม (`Received: 0`) หลังแก้ผ่าน 1/1
- `evoucher-admin-*` + `admin-form-pilot` workers=2 ผ่าน 9/9 และ `--repeat-each=2` ผ่าน 18/18 (partner ใน DB 38 ราย)
- D-1 ปิดแล้ว (ผลจาก builder ตรวจซ้ำโดย reviewer)
