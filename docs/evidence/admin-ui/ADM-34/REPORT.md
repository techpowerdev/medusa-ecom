# QA — ADM-34 ปิด FocusModal แล้ว focus กลับปุ่มที่เปิด ด้วย hook `useRestoreOpenerFocus` (PR #413)

Spec: `docs/spec/08-admin-ui-medusa-components.md` หัวข้อ "Follow-up รอบ 37" กฎ 38 และ AC-39 (a–d)
Regression: AC-32 (ADM-27), AC-31 (ADM-26), AC-36 (ADM-31), AC-38 (ADM-33), AC-19 (ADM-15)

## commit ที่ตรวจ
- `3a22708e` — `feat(admin-ui): ปิด FocusModal แล้ว focus กลับปุ่มที่เปิดด้วย hook useRestoreOpenerFocus (ADM-34)` (base develop `e9352c91`)

## สภาพแวดล้อม
- worktree แยกของ qa ไม่ได้ checkout ใน repo หลัก
- **prod build**:
  - `NODE_ENV=production medusa build` แล้ว `medusa start` จาก `.medusa/server` ที่ port 9338
  - ไม่มีคำ "Development Mode" ใน asset
- env เป็น key ปลอมแบบ CI (`sk_test_dummy`, `ALLOW_TEST_PROVIDERS=true`) ไม่ได้อ่าน secret จริง
- DB `medusa_qa413` (migrate + seed + admin user), Redis db 7, Node 22.23.3
- Playwright chromium 1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`, `workers=1`
- ไม่ใช้ Stripe (ฟอร์ม admin ล้วน)
- Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact `e2e-evidence` ของ PR #413 (14 วัน)

## ผล AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-39a static: ทุกไฟล์ที่มี `<FocusModal.Content` เรียก `useRestoreOpenerFocus(` ไม่มี inline และ static ของกฎ 19b ย้ายมาตรวจ hook | pass | jest `medusa-ui.unit.spec.ts` + `group-buy-pages.unit.spec.ts` ผ่าน 244/244; ลองเอา `{...restoreFocus}` ออกจาก `payout-form.tsx` ชั่วคราว → static ล้ม 1 เคสตรงไฟล์ (ยืนยันว่าตรวจได้จริง แล้ว revert) |
| AC-39b e2e `admin-modal-return-focus.spec.ts` | pass | ผ่าน 8/8; `--repeat-each=3` ผ่าน 24/24 |
| AC-39c e2e admin เดิมผ่านโดยไม่แก้ | pass | `admin-dialog-title`, `admin-form-discard-prompt`, `evoucher-admin-forms`, `affiliate-admin-forms`, `affiliate-admin-payout-create`, `group-buy-admin-form` และ `admin-row-menu-escape` ผ่านรวมกับ e2e ใหม่ 63/63 |
| AC-39d ทั้ง 5 ฟอร์ม เปิดด้วยเมาส์/คีย์บอร์ด ปิดด้วย Escape/ปุ่มปิด แล้ว focus ring อยู่ที่ปุ่มที่เปิด | pass | `qa-01-create-partner-keyboard-escape-focus.png`, `qa-02-create-pool-keyboard-escape-focus.png`; ตรวจ 30/30 กรณี `document.activeElement` เป็นปุ่มที่เปิด |

## checklist จาก builder
ตรวจครบ 5 ฟอร์ม: Create partner, Create program, Create payout, Create campaign และ Create pool (หน้า variant ที่ยังไม่มี pool) ฟอร์มละ 6 แบบ รวม 30 กรณี

- [x] **วิธีเปิดและปิด**
  - เปิด: คลิกด้วยเมาส์ หรือ Tab ไปที่ปุ่มแล้วกด Enter
  - ปิด: Escape, คลิกปุ่ม X ของ `FocusModal.Header` หรือกด Enter ที่ปุ่ม X
  - ทุกกรณี focus กลับปุ่มที่เปิด
- [x] **focus ring**
  - ขึ้น (`:focus-visible`) เมื่อเปิดด้วยคีย์บอร์ด หรือปิดด้วย Escape / Enter ที่ X
  - กรณี "เปิดด้วยเมาส์ + ปิดด้วยการคลิก X" focus อยู่ที่ปุ่มแต่ไม่มี ring ซึ่งเป็น heuristic ของ browser สำหรับการใช้เมาส์ ไม่ใช่บั๊ก
- [x] **ฟอร์ม dirty** (partner, program, campaign, pool)
  - กด Escape → prompt ขึ้น → "Continue editing" แล้ว dialog ยังเปิดและค่าที่กรอกยังอยู่
  - กด X → "Leave" → focus กลับปุ่มที่เปิด
- [x] **บันทึกสำเร็จ**
  - Create partner: focus กลับปุ่ม (e2e)
  - Create pool: บันทึก 200 แล้วปุ่ม "Create pool" ถูกแทนด้วย "Manage codes" → focus อยู่ที่ `BODY` ตามกฎ 38a (ปล่อยค่าเริ่มต้นของ Radix เมื่อปุ่มหายจาก DOM) และ `body` ไม่ค้าง `pointer-events`

## regression / edge
- **ADM-27 prompt:** `admin-form-discard-prompt` ผ่าน และ qa ตรวจเองตาม checklist ด้านบน
- **ADM-26 Combobox ในฟอร์ม payout**
  - กด Escape ตอนรายการ affiliate เปิด → dialog ไม่ปิด
  - ปิดรายการแล้วกด Escape → dialog ปิด และ focus กลับปุ่ม "Create payout"
- **ADM-31 ชื่อ dialog:** `admin-dialog-title` ผ่าน และ Edit program ยังได้ชื่อ "Edit program"
- **ADM-33 เมนูต่อแถวปิดด้วย Escape ครั้งเดียว:** `admin-row-menu-escape` ผ่าน
- **ADM-15:** `group-buy-admin-form` (AC-19) ผ่าน และ Create campaign คืน focus ทั้ง 6 แบบ
- **Edit program (เปิดจาก menuitem ของ `ActionMenu`):** ปิดด้วย Escape หรือ X แล้ว focus อยู่ที่ `BODY` ตรงกับ Out of scope ของรอบ 37 (menuitem ถูกถอดจาก DOM) และ `body` ไม่ค้าง `pointer-events`
- **เปิดปิดเร็ว (Create partner)**
  - เปิดแล้วกด Escape 10 รอบ → focus กลับปุ่ม 10/10
  - dblclick ปุ่มเปิด → dialog ตัวเดียว ปิดแล้ว focus กลับปุ่ม
- **Tab ต่อหลังคืน focus:** Shift+Tab ไปที่ element ก่อนหน้าในส่วนเดียวกัน ไม่เด้งไปต้นหน้า
- **e2e admin อื่นที่เปิดฟอร์มเหล่านี้:** `admin-form-pilot`, `admin-list-create-action`, `affiliate-admin-programs`, `affiliate-admin-affiliates`, `evoucher-admin-partners`, `evoucher-admin-pool-page`, `group-buy-admin-pages` ผ่าน 40/40

## defect
- ไม่พบ

## ข้อสังเกต (ไม่บล็อก)
- **O-1:** กด Escape ทันทีหลังคลิกเปิด (ระหว่าง animation เปิด) ถูกเพิกเฉย 4/6 รอบ — อาการเดียวกับ O-2 ของ ADM-31 ซึ่งมีบน develop อยู่แล้ว (พฤติกรรมของ Radix) เมื่อกด Escape อีกครั้งแล้ว focus กลับปุ่มทุกรอบ
- **O-2:** Create pool หลังบันทึกสำเร็จ focus ไป `BODY` เพราะปุ่มเปิดถูกแทนด้วย "Manage codes" — ตรงกับกฎ 38a ถ้าต้องการให้ focus ไปที่ "Manage codes" ต้องเปิด follow-up แยก
- **O-3:** ฟอร์ม payout: กด Escape ตอนรายการ Combobox เปิด → รายการยังเปิดค้าง (dialog ไม่ปิดตามกฎ 30c) ต้องคลิกนอกรายการก่อน PR นี้ไม่ได้แตะ Combobox — ไม่ได้เทียบกับ develop

## evidence (2 รูป, PNG 1280×800, ไม่เกิน 85KB)
- `qa-01-create-partner-keyboard-escape-focus.png` — เปิด Create partner ด้วย Tab + Enter แล้วปิดด้วย Escape: focus ring อยู่ที่ปุ่ม "Create partner"
- `qa-02-create-pool-keyboard-escape-focus.png` — เปิด Create pool (หน้า variant) ด้วย Tab + Enter แล้วปิดด้วย Escape: focus ring อยู่ที่ปุ่ม "Create pool"
