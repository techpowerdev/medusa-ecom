# QA — ADM-31 ห่อหัวข้อฟอร์ม FocusModal ด้วย `FocusModal.Title asChild` (PR #404)

Spec: `docs/spec/08-admin-ui-medusa-components.md` หัวข้อ "Follow-up รอบ 36" กฎ 35 และ AC-36 (a–d)
Regression: AC-32 (ADM-27), AC-31 (ADM-26), AC-19 (ADM-15)

## commit ที่ตรวจ
- `73ed6d31` — `fix(admin): ห่อหัวข้อฟอร์ม FocusModal ด้วย FocusModal.Title asChild ให้ dialog มี accessible name (ADM-31)`
- ใช้ develop `8425a53f` เป็นฐานเทียบหน้าตา, ชื่อ dialog และ console

## สภาพแวดล้อม
- worktree แยกของ qa ไม่ได้ checkout ใน repo หลัก
- **prod build**:
  - PR: `NODE_ENV=production medusa build` แล้ว `medusa start` จาก `.medusa/server` ที่ port 9325
  - develop: build แบบเดียวกัน รันที่ port 9326 โดยใช้ DB เดียวกัน เพื่อเทียบหน้าตา
  - ทั้งสอง build ไม่มีคำ "Development Mode" ใน asset
- env เป็น key ปลอมแบบ CI (`sk_test_dummy`, `ALLOW_TEST_PROVIDERS=true`) ไม่ได้อ่าน secret จริง
- DB `medusa_qa404` (migrate + seed + admin user), Redis db 7, Node 22.23.3
- Playwright chromium 1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, `workers=1`
- ไม่ใช้ Stripe (ฟอร์ม admin ล้วน)
- Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact `e2e-evidence` ของ PR #404 (14 วัน)

## ผล AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-36a static: ทุกไฟล์ที่มี `<FocusModal.Content` มี `<FocusModal.Title asChild>` ห่อ `<Heading>` จำนวนเท่ากัน (5 ไฟล์) | pass | jest `medusa-ui.unit.spec.ts` ผ่าน 214/214; ลองเอา `asChild` ออกจาก `payout-form.tsx` ชั่วคราว → static ล้ม 1 เคส (ยืนยันว่า test ตรวจได้จริง แล้ว revert) |
| AC-36b e2e `admin-dialog-title.spec.ts`: 4 ฟอร์มมี accessible name และไม่มี console error `DialogTitle` | pass | e2e ผ่าน 4/4 บน prod build (รัน 2 รอบ) |
| AC-36c e2e admin เดิม 6 ไฟล์ผ่านโดยไม่แก้ | pass | รวมกับ e2e ใหม่ ผ่าน 61/61 (`evoucher-admin-forms`, `affiliate-admin-forms`, `affiliate-admin-payout-create`, `group-buy-admin-form`, `admin-form-discard-prompt`, `evoucher-admin-pool-page`) |
| AC-36d หน้าตาเท่าเดิม | pass | `qa-01-create-partner-dialog.png`, `qa-02-create-campaign-dialog.png`; screenshot ตอน dialog เปิดของ PR กับ develop ต่างกัน **0 px** ครบ 6 ฟอร์ม; tag, className, font (18px/500), ตำแหน่ง heading (x384 y118 w512 h28), parent และ sibling เหมือนกันทุกค่า |
| AC-36d console ไม่มี error `DialogTitle` | pass | PR มีศูนย์ครั้งทั้ง 6 ฟอร์ม; develop มี error "`DialogContent` requires a `DialogTitle`" ครบทุกฟอร์ม |
| AC-36d accessible name ของ dialog ตรงหัวข้อฟอร์ม | pass | ได้ชื่อ "Create partner", "Create program", "Edit program", "Create payout", "Create group-buy campaign" และ "Create voucher pool for L"; `aria-labelledby` ชี้ id ของ heading ตัวจริง; develop ได้ dialog ไม่มีชื่อ และ `aria-labelledby` ชี้ id ที่ไม่มีอยู่จริง |

## checklist จาก builder
- [x] Create partner (`/app/evouchers`), Create program, Edit program, Create payout (`/app/affiliate`), Create campaign (`/app/group-buying`) และ Create pool (widget `variant-evoucher-pool`): หน้าตาเท่ากับ develop (diff 0 px)
- [x] console ไม่มี error ที่มีคำ `DialogTitle` (ยังมี warn `Missing Description` และ `HydrateFallback` ซึ่งนอก scope และขึ้นบน develop เหมือนกัน)
- [x] accessible name ของแต่ละ dialog ตรงหัวข้อฟอร์ม (ตรวจด้วย `toHaveAccessibleName`, `ariaSnapshot` และ `aria-labelledby`; ไม่ได้ใช้เป็น locator)
- [x] ปุ่ม `data-testid="evoucher-partner-save"` ไม่ทำให้ Drawer แก้ partner พัง:
  - ตอน Drawer เปิด testid นี้มีตัวเดียวใน DOM
  - Drawer ได้ชื่อ "Edit partner"
  - dblclick Save ยิง `POST /admin/evoucher/partners/:id` ครั้งเดียวแล้ว Drawer ปิด

## regression / edge
- **ADM-27 prompt ก่อนปิดฟอร์มที่กรอกแล้ว** (Create partner):
  - กรอกแล้วกด Escape → มี alertdialog 1 ตัว dialog ยังเปิด
  - "Continue editing" → ค่าที่กรอกยังอยู่
  - กด Escape แล้ว "Leave" → dialog ปิด
  - e2e `admin-form-discard-prompt` ผ่าน 6/6
- **ADM-26** ฟอร์ม payout: กด Escape ตอน Combobox เปิดอยู่ → ปิดแค่ Combobox และ dialog ยังชื่อ "Create payout"
- **ADM-15** focus กลับปุ่ม "Create campaign" หลังปิด (e2e `group-buy-admin-form` ผ่าน และ qa ตรวจซ้ำ)
- **เปิดปิดเร็ว**: เปิดแล้วปิดด้วย Escape 8 รอบ แล้ว dblclick ปุ่มเปิด
  - ได้ dialog ตัวเดียว
  - id ของ heading ไม่ซ้ำและ `aria-labelledby` ชี้ถูก (H1)
  - `body` ไม่ค้าง `pointer-events: none`
  - ไม่มี error `DialogTitle`
  - ผ่าน 3/3 รอบ
- **สลับโหมดฟอร์ม program** Create → Edit → Create: ชื่อ dialog เปลี่ยนตามโหมดทุกครั้ง ไม่ค้างชื่อเก่า
- **dialog ซ้อน**: ตอน alertdialog ของ prompt เปิดทับ ฟอร์มยังมี dialog เดียว ไม่มี error
- **e2e admin อื่นที่เปิดฟอร์มเหล่านี้**: `admin-form-pilot`, `admin-list-create-action`, `affiliate-admin-programs`, `evoucher-admin-partners`, `group-buy-admin-pages` ผ่าน 25/25

## defect
- ไม่พบ

## ข้อสังเกต (ไม่บล็อก — มีอยู่แล้วบน develop `8425a53f` ไม่ใช่ผลของ PR นี้)
- **O-1**: ปิดฟอร์ม Create partner (Escape ตอนยังไม่กรอก หรือ Leave หลังกรอก) แล้ว focus ไปอยู่ที่ `BODY` ไม่กลับปุ่ม "Create partner"
  - ฟอร์ม Create campaign กลับปุ่มถูกต้อง
  - เทียบแล้ว develop เป็นแบบเดียวกัน
  - ถ้าต้องการให้เหมือนกฎ ADM-15 ควรเปิด follow-up
- **O-2**: กด Escape ทันทีหลังคลิกเปิด (ระหว่าง animation เปิด) ถูกเพิกเฉย 3/6 รอบ ทั้งบน PR และ develop
  - น่าจะเป็นพฤติกรรมของ Radix (ตรงกับ O-3 ของ ADM-27)
  - ถ้ารอประมาณ 250ms หลังเห็น dialog จะปิดได้ทุกรอบ
- **O-3**: e2e ของ PR ไม่ครอบ Edit program และ Create pool (spec กำหนดให้ static ของ AC-36a ครอบไว้)
  - qa ตรวจทั้งสองฟอร์มด้วยมือแล้ว ผ่านทั้งชื่อ dialog และหน้าตา

## evidence (2 รูป, PNG 1280×800, ไม่เกิน 45KB)
- `qa-01-create-partner-dialog.png` — ฟอร์ม Create partner บน PR (pixel ตรงกับ develop)
- `qa-02-create-campaign-dialog.png` — ฟอร์ม Create group-buy campaign บน PR (pixel ตรงกับ develop)
