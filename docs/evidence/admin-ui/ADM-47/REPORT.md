# REPORT — ADM-47 (PR #526) focus กลับปุ่ม `…` หลังปิดฟอร์มจากเมนูของ partners/payouts/affiliates

spec: `docs/spec/08-*.md` หัวข้อ "Follow-up รอบ 42" · AC-52
ทดสอบโดย qa บน prod build ของ backend+admin (`NODE_ENV=production`, `medusa build` → `medusa start`) commit `2c25729a` · viewport 1280×800
e2e ของ PR `admin-row-menu-return-focus.spec.ts` 3/3 · regression `admin-program-form-edit.spec.ts` (ADM-44) 3/3 · QA spec เพิ่ม 3 ชุด (ไม่ commit) ผ่าน · ทุกจุดตรวจ `document.activeElement` และ `pointer-events` ของ `body`
Playwright report และ trace ฉบับเต็ม: CI artifact ของ PR #526

| AC | ผล | Evidence |
|----|----|----------|
| AC-52 partners: Edit จาก `…` ปิดด้วย Cancel / Escape / Save → focus ที่ `…` ของแถวเดิม | pass | `01-partner-trigger-focus-ring-after-save.png` |
| AC-52 affiliates: Payout info ปิดด้วย Escape / Save → focus ที่ `…` | pass | `02-affiliate-trigger-focus-ring-after-save.png` |
| AC-52 payouts: Mark paid ปิดด้วย Keep as draft / Escape → focus ที่ `…`; ยืนยันแล้วแถวเป็น paid ไม่มี `…` | pass | `03-payout-trigger-focus-ring-after-escape.png` |
| regression: Edit program (Drawer) ปิดด้วย Cancel/Escape คืน focus | pass | QA spec + `admin-program-form-edit.spec.ts` 3/3 |
| regression: Create partner (Escape/Save), Create payout (Escape ×2) คืน focus ให้ปุ่ม Create | pass | QA spec (log) |
| regression: หลังปิดฟอร์ม `body` pointer-events = `auto` คลิกเปิดเมนู/ฟอร์มต่อได้ | pass | QA spec |
| edge: เปิด/ปิดเร็วสลับแถว A/B 6 รอบ (partners, affiliates) และ 5 รอบ (payouts) → focus ที่ `…` ของแถวที่เพิ่งเปิดทุกรอบ | pass | QA spec (log) |
| edge: dblclick Mark as paid → POST `/mark-paid` 1 ครั้ง สถานะ `paid` | pass | QA spec (log) |

## ข้อสังเกต (ไม่ใช่ defect ของ PR)
1. ปิดด้วยเมาส์ focus อยู่ที่ `…` ถูกต้อง แต่ ring ไม่แสดง (`:focus-visible` = false ตาม heuristic ของ Chrome — เหมือน ADM-44); ปิดด้วย Escape/Mod+Enter ring แสดงทุกครั้ง
2. กด Escape ขณะ FocusModal สร้าง partner ยังเล่น animation เปิด → ค้าง 3/15 รอบ ต้องกดซ้ำ (Edit จากเมนู 0/15) — path Create ไม่ถูกแก้ใน PR นี้ น่าจะมาจาก animation ของ Radix/Medusa
3. หลัง Mark as paid สำเร็จ แถวไม่มี `…` focus ไป `BODY`, pointer-events `auto` — ตรง spec กฎ 10
