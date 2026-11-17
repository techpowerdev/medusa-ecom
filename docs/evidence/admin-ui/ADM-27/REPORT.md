# QA — ADM-27 ถามยืนยันก่อนปิดฟอร์ม admin ที่กรอกค่าแล้ว (PR #389)

Spec: `docs/spec/08-admin-ui-medusa-components.md` หัวข้อ "Follow-up รอบ 32" กฎ 31 และ AC-32 (owner ตอบ Q9 = ก เมื่อ 2026-11-17)
Regression: AC-31 (ADM-26), AC-19 (ADM-15)

## commit ที่ตรวจ
- รอบแรก: `d3514f7ee7933d48a21da8387cd9d47b04ac7440` (พบ D-1)
- re-test: `481e183516f619ee1a53099e537f35aaa77beabb` — `fix(admin): ไม่เปิด prompt ทิ้งฟอร์มระหว่างกด Save ก่อน isPending render` hook เช็ก `isPending` และ `form.formState.isSubmitting` แล้วตัดสินใจด้วยค่าล่าสุดหลัง event เดิมจบ (setTimeout + ref ที่อัปเดตใน `useLayoutEffect`)

## สภาพแวดล้อม (ทั้งสองรอบ)
- worktree แยกของ qa ไม่ได้ checkout ใน repo หลัก
- **prod build**: `medusa build` แล้ว `medusa start` จาก `.medusa/server` (NODE_ENV=production, ALLOW_TEST_PROVIDERS=true) backend และ admin ที่ port 9314
- DB `medusa_qa389` สร้างใหม่ทุกรอบ แล้ว migrate + seed + admin user; Redis db 14
- Node 22.23.3; Playwright chromium 1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`
- ไม่ใช้ Stripe (ฟอร์ม admin ล้วน)
- Playwright report/trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR #389 (14 วัน)

## ผล AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-32 สร้าง partner: dirty แล้วกด Escape → มี alertdialog และฟอร์มยังเปิด; "Continue editing" → ค่าคงอยู่; "Leave" → ปิด เปิดใหม่ช่องว่าง; ไม่ dirty → ปิดทันที | pass | `01-partner-discard-prompt.png`, e2e `admin-form-discard-prompt.spec.ts` |
| AC-32 สร้างแคมเปญ / สร้าง program (เงื่อนไขเดียวกัน) | pass | e2e `admin-form-discard-prompt.spec.ts` |
| AC-32 Drawer แก้ partner: dirty แล้วคลิกปุ่ม X → มี alertdialog | pass | e2e + spec ของ qa (X / Cancel / Escape / คลิกนอก) |
| AC-32 payout dirty + Combobox ขยาย แล้ว Escape → ไม่มี alertdialog dialog ยังเปิด (กฎ 31d); ปิดรายการแล้ว Escape → มี prompt | pass | `02-payout-discard-prompt.png` |
| AC-32 Escape 2 ครั้งติดกัน → alertdialog 1 ตัว; บันทึกสำเร็จแล้วไม่มี alertdialog | pass | e2e + spec ของ qa (Escape 3 ครั้ง, dblclick X ได้ 1 ตัว) |
| AC-32 static (`medusa-ui.unit.spec.ts`) | pass | jest 208/208 |
| กฎ 31 ครบ 7 ฟอร์ม (สร้าง/แก้ partner, แคมเปญ, สร้าง/แก้ program, payout, payout-info drawer, pool, flash sale): ทุกทางปิดถามเมื่อ dirty ไม่ถามเมื่อไม่ dirty | pass | `03-flash-sale-drawer-prompt.png` (X), `04-pool-create-prompt.png` (คลิกนอก), spec ของ qa 9 ฟอร์ม × 2 เคส |
| กฎ 31c กันกดซ้ำ: ระหว่างบันทึกปิดทุกทางไม่เกิดอะไร ไม่มี prompt; บันทึกสำเร็จปิดไม่ถาม; POST 1 ครั้ง (รวมกรณี D-1 คือกด Save แล้ว Escape ทันที) | pass (re-test `481e1835`) | `05-pending-no-prompt.png`; spec ของ qa ส่วนระหว่างบันทึก 5/5 และ D-1 50/50 รอบ |
| AC-31 (ADM-26) regression | pass | `affiliate-admin-forms.spec.ts` ADM-26 a/b |
| AC-19 (ADM-15) regression: Escape แล้ว Leave → focus กลับปุ่ม "Create campaign" | pass | `group-buy-admin-form.spec.ts` |
| regression admin อื่นๆ | pass | รอบแรก 67/67 (12 ไฟล์), re-test 73/73 (13 ไฟล์) |

## edge / negative
- **แก้ค่าแล้วแก้กลับเป็นค่าเดิม**: ฟอร์มที่เป็นช่องข้อความถือว่าไม่ dirty (`isDirty` ของ react-hook-form เทียบ defaultValues) ปิดได้โดยไม่ถาม — ถูกต้อง
- **Drawer แก้ไข (partner, program, flash sale)**: ค่าเริ่มต้นมาจากข้อมูลเดิม ไม่แก้ก็ไม่ถาม แก้แล้ว Leave → เปิดใหม่ได้ค่าเดิมจากข้อมูล
- **คีย์บอร์ดล้วน**: prompt focus ที่ "Continue editing" (ปลอดภัย) Enter → กลับไปแก้ต่อ ค่าคงอยู่; Escape ที่ prompt → ปิดแค่ prompt; Tab ไป "Leave" แล้ว Enter → ปิด และ focus กลับปุ่ม "Create campaign"
- **prompt ไม่ซ้อน**: Escape จริง 3 ครั้งได้ alertdialog 1 ตัว, dblclick X ได้ 1 ตัว
- **body ไม่ค้าง `pointer-events: none`**: หลังปิดทุกทาง (Leave, ปิดตอนไม่ dirty, บันทึกสำเร็จ) ทั้ง 9 ฟอร์มคลิกหน้าได้ปกติ

## defect
**D-1 แก้แล้ว (ตรวจซ้ำที่ `481e1835`)**: เดิมถ้ากด Save แล้วกด Escape ทันที (ก่อน `isPending` render — น้อยกว่า 1 frame) prompt จะเปิดขณะบันทึกและค้างอยู่หลังฟอร์มปิด (รอบแรกทำซ้ำได้ 3/4 ฟอร์ม)
- วิธี re-test: หน่วง POST 1.5s ด้วย `page.route` แล้วทำซ้ำ 2 วิธี — (ก) `click` Save แล้ว `keyboard.press("Escape")` ทันทีที่เห็น POST; (ข) `page.evaluate` ที่ click Save แล้ว dispatch Escape ใน task เดียวกัน (วิธีนี้ทำซ้ำได้ 100% บน `d3514f7e`)
- ทดสอบ 5 ฟอร์ม (สร้าง partner, แก้ partner, แก้ program, flash sale, payout-info) × 2 วิธี × 5 รอบ = 50 รอบ
- ผล: ทุกรอบไม่มี alertdialog ทั้งระหว่างบันทึกและหลังฟอร์มปิด, POST 1 ครั้งต่อรอบ, ฟอร์มปิดเมื่อบันทึกสำเร็จ, `body` ไม่ค้าง `pointer-events: none`
- ไม่พบ defect ใหม่

## ผล re-test (`481e1835`)
- static jest `medusa-ui.unit.spec.ts` ผ่าน 208/208
- e2e ของ PR `admin-form-discard-prompt.spec.ts` ผ่าน 6/6
- regression admin 13 ไฟล์ ผ่าน 73/73 รวม AC-31a/b (ADM-26) และ AC-19 (ADM-15)
- spec ของ qa (regression) ผ่าน 34/34 ครบตามรอบแรกทุกเคส: 9 ฟอร์ม ไม่ dirty/dirty/แก้กลับ, กดซ้ำเร็ว (Escape 3 ครั้ง, dblclick X, Escape 2 ครั้งใน tick เดียว ได้ prompt 1 ตัว), คีย์บอร์ดล้วน, ADM-26 combobox, ระหว่างบันทึก (หน่วง 4s) 5/5, `body` ไม่ค้าง

## ข้อสังเกต (ไม่บล็อก)
- **O-1**: รูปที่ e2e ของ builder ถ่ายติดตอน prompt ยัง fade-in — รูป 01/02 ในโฟลเดอร์นี้ qa ถ่ายใหม่หลังรอ animation จบ และ builder เอาการถ่ายรูปออกจาก e2e แล้ว
- **O-2**: ใน FocusModal ที่ผ่าน prompt มาแล้ว 2 รอบ คลิกนอกทันทีหลัง "Continue editing" ถูกเพิกเฉย 1 ครั้ง (ไม่ถามและไม่ปิด) รอ 800ms ถามปกติ — ปลอดภัย น่าจะเป็นพฤติกรรมของ Radix layer
- **O-3**: คลิกนอกระหว่าง animation เปิด (~200ms แรก) ถูกเพิกเฉยแม้ยังไม่ dirty (ไม่รอ 3/6 ปิดได้, รอ 500ms 6/6) — เส้นทางนี้ไม่ผ่าน hook น่าจะเป็นพฤติกรรมของ Radix ยังไม่ได้เทียบบน develop
- **O-4**: ตอน prompt รอบที่ 2 ขึ้นไป `body` เป็น `pointer-events: auto` แต่ overlay ยังคลุมหน้า ไม่มีผลที่ผู้ใช้เห็น และหลังปิดไม่ค้าง
- **O-5**: การปิดระหว่างบันทึกของสร้างแคมเปญ / สร้าง pool / สร้าง payout / สร้าง program ยังไม่ได้ทดสอบ e2e (ต้องกรอก field ที่ validate ฝั่ง client หลายช่อง) — static test ยืนยันว่าส่งสถานะเดียวกันเข้า hook

## evidence (5 รูป, PNG 1280×800, ทุกรูปไม่เกิน 95KB)
- `01-partner-discard-prompt.png` — สร้าง partner กด Escape แล้วมี prompt
- `02-payout-discard-prompt.png` — payout: ปิดรายการ Combobox แล้ว Escape มี prompt (ตอน Combobox ขยาย Escape ไม่มี prompt)
- `03-flash-sale-drawer-prompt.png` — Drawer flash sale กดปุ่ม X แล้วมี prompt
- `04-pool-create-prompt.png` — สร้าง pool คลิกนอก modal แล้วมี prompt
- `05-pending-no-prompt.png` — ระหว่างบันทึก flash sale (Save หมุน, Cancel disabled) กด Escape / X / คลิกนอก ไม่มี prompt และ Drawer ยังเปิด
