# QA — ADM-33 เมนูต่อแถวใน DataTable ปิดด้วย Escape ครั้งเดียว (PR #409)

Spec: `docs/spec/08-admin-ui-medusa-components.md` หัวข้อ "Follow-up รอบ 36 ส่วนที่ 2" กฎ 37 และ AC-38 (a–e)

## commit ที่ตรวจ
- `313eac89` (head ของ `feat/ADM-33-row-menu-escape` รวม `3c81b82e` fix และ merge develop `b4495434`)
- ใช้ develop `3b8a3d0b` เป็นฐานเทียบ

## สภาพแวดล้อม
- worktree แยกของ qa (ไม่ได้ checkout ใน repo หลัก)
- **prod build**: `NODE_ENV=production medusa build` แล้ว `medusa start` จาก `.medusa/server`
  - PR รันที่ :9332 และ develop ที่ :9333 ใช้ DB เดียวกัน
  - asset ของทั้งสอง build ไม่มีคำ "Development Mode"
- env เป็น key ปลอมแบบ CI (`sk_test_dummy`, `ALLOW_TEST_PROVIDERS=true`) ไม่ได้อ่าน secret จริง
- DB `medusa_qa409` (migrate + seed + admin user), Redis db 14, Node 22.23.3, `CI=1` (`workers=1`)
- Playwright chromium 1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`
- ไม่ใช้ Stripe (เป็น admin ล้วน)
- Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact `e2e-evidence` ของ PR #409 (14 วัน)

## ผล AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-38a static: คอลัมน์ `display` ที่ `id: "actions"` ทั้ง 5 ตารางมี `___truncateTooltip: false` | pass | jest `medusa-ui.unit.spec.ts` ผ่าน 221/221 (ADM-33 ผ่าน 7/7); ลองเอา meta ออกจาก `payouts-table.tsx` ชั่วคราว → static ล้ม 1 เคส (ยืนยันว่า test ตรวจได้จริง แล้ว revert) |
| AC-38b e2e `admin-row-menu-escape.spec.ts` ล้มบน develop / ผ่านบน PR | pass | develop ล้ม 5/5 ที่ `getByRole("menu")` `toHaveCount(0)`; PR ผ่าน 5/5 |
| AC-38c `--repeat-each=10` บน prod build และ `closeRowMenu` แบบ Escape ครั้งเดียว | pass | spec ใหม่ผ่าน 50/50 (และรอบ x5 อีก 25/25); `affiliate-admin-row-actions` + `affiliate-admin-affiliates` ผ่าน x5 สองรอบ รวม 50/50 ไม่มี flaky (รวม `settled()` ที่เพิ่ม `.catch`) |
| AC-38d e2e admin เดิมที่เปิดเมนูต่อแถว | pass | 8 ไฟล์ผ่าน 55/55: `evoucher-admin-forms`, `evoucher-admin-pool-page`, `evoucher-admin-partners`, `affiliate-admin-programs`, `affiliate-admin-payouts`, `affiliate-admin-payout-create`, `affiliate-admin-forms`, `admin-form-discard-prompt` |
| AC-38e ทำซ้ำขั้นของ qa รอบ 36 ตารางละ 6 ครั้ง (แถวเดิม/แถวอื่น) → Escape ครั้งเดียวปิดทุกครั้ง | pass | `qa-01-partners-menu-closed-one-escape.png`; PR ปิดได้ 30/30 ครบ 5 ตาราง ส่วน develop ค้าง 19/30 (ดูตารางด้านล่าง) |
| AC-38e tooltip ของคอลัมน์ข้อความยาว (ชื่อ partner) ยังขึ้นเมื่อ hover | pass (มีเงื่อนไข ดู O-1) | `qa-02-partner-name-tooltip.png`; คอลัมน์ accessor ยังห่อด้วย `TruncatedCell` (แถว partner มี `.truncate` 2 ตัวบน PR และ 3 ตัวบน develop = ลดไปเฉพาะคอลัมน์ actions); เมื่อชื่อล้น tooltip ขึ้นเป็นชื่อเต็ม; ปุ่ม `…` ไม่มี tooltip ทั้งตอน hover และ focus |

## checklist จาก builder (probe ของ qa บน prod build: PR เทียบ develop)
แต่ละรอบ: เปิดเมนู → รอ animation จบ + 250ms → กด Escape 1 ครั้ง → ดูผลหลัง 600ms
ลำดับแถวที่ใช้คือ [0,0,1,0,0,1] (X = เมนูยังเปิดและ body `pointer-events: none`)

| ตาราง | PR (คลิก) | develop (คลิก) | PR (คีย์บอร์ด focus+Enter) | ตำแหน่ง `…` PR/develop |
|---|---|---|---|---|
| partners | 6/6 ปิด | ค้าง 3/6 | 6/6 | x1240 / x1240 |
| codes | 6/6 | ค้าง 4/6 | 6/6 | x1111 / x1111 |
| programs | 6/6 | ค้าง 4/6 | 6/6 | x609 / x609 |
| affiliates | 6/6 | ค้าง 4/6 | 6/6 | x1091 / x1090 (ข้อมูลต่างรอบ) |
| payouts | 6/6 | ค้าง 4/6 | 6/6 | x320 / x320 |
| `/app/products` (Medusa) | 6/6 | 6/6 | 6/6 | x1216 |

- **คลิกแถวอื่นทันทีหลัง Escape**: PR คลิกได้ทั้ง 5 ตาราง ส่วน develop timeout ทั้ง 5 ตาราง (body ไม่รับ pointer)
- **menuitem ยังทำงาน**:
  - partners: Edit เปิด Drawer แล้วปิดได้ (body ไม่ค้าง)
  - partners: Delete ขึ้น prompt และยืนยันลบ partner ที่ qa สร้างเองได้; หลังลบ เปิดเมนูแถวที่เหลือแล้วกด Escape ครั้งเดียวก็ปิด (develop ค้าง)
  - programs: Edit เปิด dialog แล้วปิดได้
  - codes: Reveal กดได้
  - affiliates: Payout info เปิด dialog
  - payouts: Cancel ขึ้น prompt แล้ว Escape ปิด prompt (ไม่ได้ยืนยัน) body ไม่ค้าง
- **ปุ่ม `…` อยู่ตำแหน่งเดิม**: ขนาด 28×28 และพิกัด x ตรงกับ develop ทุกตาราง

## edge / negative
- **กด Escape ทันทีที่เมนูโผล่** (เฟรมเดียวกัน ไม่รอเลย):
  - ตารางของเรายังค้างบ่อยทั้ง PR และ develop: PR ค้าง 18/30, develop 25/30
  - `/app/products` ไม่ค้างเลย (0/6)
  - วัดเพิ่มที่ programs กับ products รอบละ 8 ครั้ง:

    | หน่วงก่อนกด Escape | programs (PR) | products |
    |---|---|---|
    | 0ms | ค้าง 4/8 | 0/8 |
    | 16ms | 0/8 | 0/8 |
    | 50ms | 0/8 | 0/8 |
    | 100ms | 0/8 | 0/8 |

  - สรุป: ค้างเฉพาะเมื่อกดภายใน 1 frame ตรงกับที่ builder วัดไว้ใน `ADM-33-tests.txt` ข้อ 3 (คนกดไม่ทัน) ดู O-2
- **ชื่อ partner ยาวมาก** (~370 ตัวอักษร):
  - ตารางขยายตามข้อความจนกว้างประมาณ 3000px ชื่อจึงไม่ถูกตัด และ tooltip ไม่ขึ้นเอง
  - ปุ่ม `…` ถูกดันออกนอก viewport (ต้องเลื่อนแนวนอน)
  - เป็นแบบเดียวกันทั้ง PR และ develop ดู O-1

## defect
- ไม่พบ

## ข้อสังเกต (ไม่บล็อก)
- **O-1**: `DataTable` ของ `@medusajs/ui` จัด layout ให้คอลัมน์ขยายตามข้อความ คอลัมน์ข้อความจึงแทบไม่ล้นและ tooltip ของ `TruncatedCell` แทบไม่ขึ้นเอง
  - qa ยืนยันว่ากลไก tooltip ยังทำงาน โดยจำกัด `max-width` ของชื่อเป็น 160px ใน browser (`qa-02`)
  - พฤติกรรมนี้เหมือนกันบน develop ไม่ใช่ผลของ PR
  - ถ้าต้องการให้ข้อความยาวถูกตัดจริงหรือไม่ให้ปุ่มหลุดจอ ควรเปิด follow-up
- **O-2**: กด Escape ภายในเฟรมแรกที่เมนูโผล่ยังค้างในตารางของเรา แต่ `/app/products` ของ Medusa (ตารางคนละ implementation) ไม่ค้าง
  - หน่วงเพียง 16ms ก็ไม่ค้างแล้ว และ e2e ใช้ `waitMenuOpened` (รอ animation จบ ไม่ใช่ timeout)
  - ถ้าต้องการให้เหมือน Medusa ทุกจังหวะ ควรเปิด follow-up เพื่อหาสาเหตุใน `@medusajs/ui` DataTable
- **O-3**: ทางคีย์บอร์ด (`focus()` + Enter) ไม่ทำให้ develop ค้างในการวัดของ qa (6/6 ปิดทุกตาราง) จึงยืนยันได้ว่า PR ผ่าน แต่ไม่ได้แสดงอาการบน develop ทางนี้
- **O-4**: test partners ของ `admin-row-menu-escape.spec.ts` หาแถวได้เพราะชื่อ "Partner adm33-…" ถูกเรียงมาอยู่หน้าแรก
  - ตาราง partners แบ่งหน้าละ 20 แถว ตอนที่ qa ทดลอง partner ชื่อที่เรียงหลัง "Partner ev-…" ไปอยู่หน้า 2
  - test ผ่านทุกรอบในตอนนี้ แต่จะเปราะถ้า convention การตั้งชื่อเปลี่ยน

## evidence (2 รูป, PNG 1280×800, ไม่เกิน 105KB)
- `qa-01-partners-menu-closed-one-escape.png`: PR หลังเปิด → Esc → เปิดแถวเดิม → Esc → เปิดแถวอื่น → Esc ครั้งเดียว: ไม่มีเมนูค้าง แถวรับ hover ได้ (develop ในขั้นเดียวกันเมนู Edit/Delete ยังค้าง)
- `qa-02-partner-name-tooltip.png`: tooltip ชื่อเต็มของคอลัมน์ Name เมื่อชื่อถูกตัด (จำกัด max-width ใน browser) และปุ่ม `…` ที่ focus อยู่ไม่มี tooltip
