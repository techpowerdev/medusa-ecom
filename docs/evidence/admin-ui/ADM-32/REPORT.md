# QA — ADM-32 error รูปค่าของช่องตัวเลขในฟอร์ม Create campaign แสดงใต้ช่อง (PR #408)

Spec: `docs/spec/08-admin-ui-medusa-components.md` หัวข้อ "Follow-up รอบ 36 ส่วนที่ 2" กฎ 36 และ AC-37 (a–e)
Regression: AC-32 (ADM-27), AC-19 (ADM-15), AC-36 (ADM-31)

## commit ที่ตรวจ
- `596ad494` — `fix(admin-ui): error รูปค่าของช่องตัวเลขในฟอร์ม Create campaign แสดงใต้ช่องแทน toast (ADM-32)`

## สภาพแวดล้อม
- worktree แยกของ qa ไม่ได้ checkout ใน repo หลัก
- **prod build**: `NODE_ENV=production medusa build` แล้ว `medusa start` จาก `.medusa/server` ที่ port 9331
  - `assert-absent.sh "Development Mode"` ผ่าน (348 ไฟล์)
- env เป็น key ปลอมแบบ CI (`sk_test_dummy`, `ALLOW_TEST_PROVIDERS=true`) ไม่ได้อ่าน secret จริง
- DB `medusa_qa408` (migrate + seed + admin user), Redis db 13, Node 22.23.3
- Playwright chromium 1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, `workers=1`
- ไม่ใช้ Stripe (ฟอร์ม admin ล้วน)
- Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact `e2e-evidence` ของ PR #408 (14 วัน)

## ผล AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-37a unit `group-buy-form.unit.spec.ts` | pass | ผ่าน 107/107; เอา `group-buy-form.ts` ของ develop มาแทนชั่วคราว → ล้ม 37 เคส (7 ช่อง × 5 ค่า + `discount_value` -10/0) ยืนยันว่าล้มบน develop จริง แล้ว revert; diff ของ unit มีแต่บรรทัดที่เพิ่ม ไม่ได้แก้ assertion ของ `toCampaignBody` |
| AC-37b e2e: `max_total_orders` -1/1.5/0/2147483648/99999999999999999999, `target_value` -3, `discount_value` -10 → error ใต้ช่อง ไม่มี toast และไม่มี POST; 2147483647 → POST 200 | pass | e2e ผ่าน (รัน `--repeat-each=3` ผ่าน 3/3); `qa-01-max-total-orders-field-errors.png` |
| AC-37c e2e: 400 ที่ schema ไม่ครอบ → toast 1 ตัว ไม่มี error ใต้ช่อง และ modal ยังเปิด | pass | e2e ผ่าน (`--repeat-each=3` ผ่าน 3/3); `qa-02-backend-400-toast.png` |
| AC-37d e2e admin เดิมผ่านโดยไม่แก้ assertion | pass | `group-buy-admin-form` + `admin-form-discard-prompt` + `admin-dialog-title` ผ่าน 19/19 บน prod build |
| AC-37e REPORT + screenshot ≤ 2 | pass | 2 รูป: `qa-01-max-total-orders-field-errors.png` (1180×200, 16KB) และ `qa-02-backend-400-toast.png` (1280×800, 59KB) |

## checklist จาก builder
- [x] (1) `max_total_orders` = -1 → error "Max total orders must be a whole number greater than 0" ใต้ช่อง
  - `aria-invalid="true"`
  - ไม่มี toast และไม่มี POST
- [x] (2) 2147483648 → error ใต้ช่อง "Max total orders must be at most 2147483647"
- [x] (3) 400 อื่นจาก backend (จำลองด้วย `page.route`) → toast ข้อความ backend และ modal ไม่ปิด
- [x] (4) ฟอร์ม dirty + Escape → alertdialog 1 ตัว (ADM-27); กด Leave → focus กลับปุ่ม "Create campaign" (ADM-15)
- [x] (4) dblclick ปุ่ม Create → POST 1 ครั้ง

## ตาราง 8 ช่อง × 8 ค่า (prod build; ไม่เลือกสินค้า เพื่อให้ค่าที่ผ่าน schema ไปจบที่ `gb-product-required-error` โดยไม่ POST)
ช่องที่ตรวจ: `target_value`, `team_duration_hours`, `max_total_orders`, `max_units_per_person`, `max_people_per_group`, `pay_within_hours`, `max_quantity`, `discount_value`

**ช่องจำนวนเต็ม 7 ช่อง**
- `-1`, `0`, `1.5`, `"e"` → error ใต้ช่อง testid ตามกฎ 36c ข้อความ `<label> must be a whole number greater than 0`
- `2147483648`, `99999999999999999999` → error ใต้ช่อง ข้อความ `<label> must be at most 2147483647` (ท่อนเดียว ไม่ซ้ำสองท่อนแบบเดิม)
- ทุกเคสที่ผิด: `aria-invalid="true"` เฉพาะช่องนั้น, toast 0, POST 0
- `2147483647` และค่าว่าง → ไม่มี error ที่ช่องนั้น (ไปจบที่ product error)

**`discount_value`**
- `-1`, `0`, `"e"` → `gb-discount-value-error` "Discount value must be a number greater than 0" และ `aria-invalid="true"`
- `1.5` ผ่าน
- ≥ 2147483647 ตอนเป็น percentage → toast "Percentage discount cannot exceed 100" (กฎข้าม field — Out of scope)
- ค่าว่าง → toast "Discount value must be a number greater than 0" (ช่องบังคับว่าง — Out of scope กฎ 36d)

## regression / edge
- **error หลายช่องพร้อมกัน**: ใส่ค่าผิดครบ 8 ช่อง (-3, 1.5, 2147483648, 0, 99999999999999999999, -1, "e", -10)
  - error ขึ้นครบ 8 ช่อง และ `aria-invalid="true"` ครบ 8 ช่อง
  - toast 0, POST 0
- **แก้ทีละช่อง**: error ลดลงตามลำดับ 7 → 6 → … → 0 (validate ใหม่ตอนแก้ค่า)
- **สร้างได้จริง**: dblclick → POST 1 ครั้ง ได้ 200
  - ตรวจ `GET /admin/group-buy/campaigns/:id`: status `draft`
  - ค่าที่บันทึก: `target_value` 5, `team_duration_hours` 48, `max_total_orders` 2147483647, `max_units_per_person` 2, `max_people_per_group` 7, `pay_within_hours` 12
  - body: `max_quantity` 2147483647, `value` 12.5
- **⌘/Ctrl+Enter** ตอน `max_total_orders` = -1 → error ใต้ช่อง ไม่มี POST
- **เปิดฟอร์มใหม่หลัง Leave** → ไม่มี error ค้างและไม่มี `aria-invalid` ค้าง

## defect
- ไม่พบ

## ข้อสังเกต (ไม่บล็อก — อยู่นอก scope ของกฎ 36)
- **O-1**: `discount_value` แบบ fixed ไม่มีเพดาน
  - ใส่ `99999999999999999999` → schema ผ่าน → backend ตอบ 200 สร้างแคมเปญที่มีส่วนลด 1e20 THB ได้จริง (qa ลบทิ้งแล้ว)
  - กฎ 36b กำหนดแค่ `> 0` จึงไม่ใช่ defect ของ PR นี้ ถ้าต้องการเพดานควรเปิด follow-up
- **O-2**: ช่องบังคับที่ว่าง (`target_value`, `max_quantity`, `pay_within_hours`) ตอนยังไม่เลือกสินค้า ขึ้นแค่ `gb-product-required-error` ก่อน
  - ข้อความ "… is required" มาทีหลังเป็น toast เพราะ `buildBody` ตรวจสินค้าก่อน `required(...)`
  - เป็นพฤติกรรมเดิมของ `toCampaignBody` (กฎ 36d)
- **O-3**: ช่อง `NumberInput` รับ `1e3` เป็นค่าได้ (`Number` = 1000 เป็นจำนวนเต็ม จึงผ่าน) ไม่กระทบความถูกต้อง

## evidence (2 รูป, PNG ≤ 60KB)
- `qa-01-max-total-orders-field-errors.png` — ช่อง Max total orders ค่า -1 กับ 2147483648 วางคู่กัน error อยู่ใต้ช่อง (รวมจาก 2 ภาพที่ crop บริเวณช่อง)
- `qa-02-backend-400-toast.png` — 400 จาก backend (จำลอง) ขึ้นเป็น toast ไม่มี error ใต้ช่อง และ modal ยังเปิด
