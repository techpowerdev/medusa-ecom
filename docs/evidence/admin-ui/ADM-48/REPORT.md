# REPORT — ADM-48 (PR #542) Enter ค้างบน Save ไม่เปิดฟอร์มใหม่

spec: `docs/spec/08-admin-ui-medusa-components.md` หัวข้อ "Follow-up รอบ 42" · กฎ 52 · AC-53
ทดสอบโดย qa บน prod build ของ backend+admin (`NODE_ENV=production` → `medusa start` จาก `.medusa/server`) commit `768ad7ed` · viewport 1280×800
e2e ของ PR ผ่าน 15/15 (AC-53 4 ฟอร์ม, `admin-create-double-submit.spec.ts` 8, `admin-row-menu-return-focus.spec.ts` 3) · QA spec (ไม่ commit) 6/6 สองรอบ — จำลอง Enter ค้างแบบคน (หน่วง 500ms แล้ว repeat ทุก 33ms × 40) นับ dialog ด้วย MutationObserver; partner/program/payout ยิง backend จริงและนับแถวใน DB
เทียบ develop `aa32e4bb` ด้วยชุดเดียวกัน: ล้ม — dialog โผล่ซ้ำ 7 (partner), 20 (program), 7 (campaign) ครั้ง; บน PR 0 ครั้ง

| AC / checklist | ผล | Evidence |
|----|----|----------|
| AC-53 (1) Enter ค้างบน Save ของ Create partner/program/payout/pool → POST 1 ครั้ง, dialog ใหม่ 0, focus อยู่ที่ปุ่มเปิด | pass | `ac53-hold-enter-partner-focus-opener.png`; e2e PR 4/4; QA spec 4/4 |
| AC-53 (2) ปล่อย Enter แล้วกดใหม่ → ฟอร์มเปิดปกติ | pass | QA spec ×4 ฟอร์ม |
| Create campaign + ฟอร์มแก้จากเมนู `…` (partners/affiliates/payouts) ไม่ถดถอย focus คืนปุ่ม `…` | pass | QA campaign hold-Enter; AC-52 3/3; Drawer แก้ partner กด Enter ค้าง → ไม่มีเมนู/ฟอร์มเปิดซ้ำ |
| Tab/Shift+Tab/Escape หลังปิดฟอร์มทำงานเดิม; Enter ค้างแล้ว blur แล้วกด Enter ใหม่ → เปิดได้ | pass | `ac53-after-blur-enter-reopens-program.png`; QA ×4 |
| ดับเบิลคลิก Save / ⌘(Ctrl)+Enter ค้าง → ไม่สร้างข้อมูลซ้ำ | pass | AC-44 ×5 ฟอร์ม + pool group + import codes (PR); QA dblclick partner/program แถวใน DB +1; ⌘/Ctrl+Enter ค้าง POST +1 |

## ข้อค้นพบนอก spec (เหมือนกันบน develop — ไม่ใช่ regression)
1. สร้างสำเร็จแล้วเปิด Create partner ใหม่ทันที กด Escape ภายใน ~1 วินาที → modal ไม่ปิด (รอ 1 วินาทีหรือกด X ปิดได้; หน้าโหลดใหม่ Escape ทันทีปิดได้ — สงสัย toast ที่เพิ่งขึ้น)
2. Create pool ยิง backend จริง: สร้างแล้วปุ่ม "Create pool" หาย (variant มี pool ได้ตัวเดียว) คืน focus ให้ปุ่มเปิดไม่ได้ — POST 1 ครั้ง ไม่มี dialog ซ้ำ ถูกตามที่ออกแบบ
3. ที่ 1280px toast "… created" บังปุ่ม Save ของ FocusModal ที่เปิดใหม่ (เห็นในรูปที่ 2) — พฤติกรรม toast ของ `@medusajs/ui`

**Defect**: ไม่มี
