# QA — ADM-44 (PR #499)

Spec: `docs/spec/08-admin-ui-medusa-components.md` กฎ 48 (a/b/c), AC-49
Commit ที่ตรวจ: รอบ 1 `46125c6f`, รอบ 2 `8b265cb8` (แก้ O-1 + เปลี่ยน re-validate เป็น `deps` ของ RHF)
สภาพแวดล้อม: backend prod build (`NODE_ENV=production` build + `medusa start`), Chromium 1280×800, locale en-US, timezone Asia/Bangkok
Playwright report/trace ฉบับเต็ม: CI artifact `e2e-evidence` (14 วัน)

## ผล e2e
| ชุด | รอบ 1 (`46125c6f`) | รอบ 2 (`8b265cb8`) |
|---|---|---|
| `admin-program-form-edit.spec.ts` (ของ PR) | 4/4 (`--repeat-each=2`) | 9/9 (`--repeat-each=3`, รวม test O-1) |
| regression e2e admin ที่แตะฟอร์ม/ตาราง program | 7 ไฟล์ 40/40 | 7 ไฟล์ 43/43 |
| edge case ของ qa (QA-1…QA-7) | 6 ผ่าน / QA-7 ล้ม | ทั้งหมดผ่าน; QA-7 (Cancel/Escape/Save) ซ้ำ 3 รอบ 9/9 |

## ผลต่อ AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-49a (กฎ 48a) ends<starts กด Save → error; เลื่อน starts_at ให้ถูก → error หาย ≤1 วินาทีโดยไม่กด Save; เลื่อนกลับ → error กลับ; ไม่มี POST (ทั้งฟอร์มสร้างและ Drawer) | pass | qa499-01-ends-at-error-focused.png, qa499-02-ends-at-error-cleared.png |
| กฎ 48c กด Save → focus ที่ segment แรกของ DatePicker `ends_at` | pass | qa499-01-ends-at-error-focused.png |
| AC-49b (กฎ 48b) Edit เปิด `Drawer` (testid `affiliate-program-drawer`, `sm:max-w-[560px]`, dialog เดียว) | pass | qa499-03-edit-program-drawer.png |
| Create ยังเป็น FocusModal เต็มจอ (Save บน header) + error หลายช่องพร้อมกัน (กฎ 46) | pass | qa499-05-create-focusmodal-multi-errors.png |
| Drawer กันกดซ้ำ: dblclick/⌘+Enter/คลิกซ้ำระหว่างบันทึก → POST 1 ครั้ง, Save/Cancel disabled, Escape ระหว่างบันทึกไม่ปิด | pass | qa499-04-drawer-saving-disabled.png |
| Drawer dirty: Cancel/Escape/คลิกนอก → prompt; Continue คงค่า; Leave ปิด; เปิดใหม่ค่ารีเซ็ต | pass | ผล e2e QA-2 |
| ปิด Drawer (Cancel/Escape/Leave/Save) แล้ว focus กลับปุ่ม `…` ของแถว (กฎ 38) | pass (รอบ 2) | ผล e2e QA-7 + test O-1 ของ PR |
| Escape ขณะรายการ Collections เปิดไม่ปิด Drawer (กฎ 30c); scroll เห็น field ครบที่ 1280×800 | pass | ผล e2e QA-4 |
| ⌘/Ctrl+Enter ใน Drawer ส่งฟอร์ม (KeyboundForm) | pass | ผล e2e QA-5 |
| admin คงภาษาอังกฤษ (ไม่มีอักษรไทย) | pass | ผล e2e QA-2, QA-6 |

## Defect / ข้อสังเกต
| ID | รายการ | รอบ 1 | รอบ 2 |
|---|---|---|---|
| O-1 | ปิด Drawer แก้ไขที่เปิดจากเมนู `…` → focus ไป BODY ไม่กลับปุ่ม `…` | fail | **แก้แล้ว** (focus กลับปุ่ม `affiliate-program-row-actions` ทุกทางปิด, body ไม่ค้าง `pointer-events: none`) |
| O-2 | dirty → Cancel → Continue editing → คลิกนอก Drawer → บางครั้งไม่มี prompt และ Drawer ไม่ปิด (ค่าไม่หาย; Escape ยังขึ้น prompt) | พบ | ยังพบเป็นบางครั้ง (program 1/4 ผ่าน) — **เป็นอาการเดิมบน develop**: Drawer partner (`partners-section.tsx` ไม่มี diff กับ develop) เป็นเหมือนกัน (2/4 ผ่าน); ข้อจำกัดของ `usePrompt` — ไม่แก้ใน PR นี้ |
| O-3 | ⌘/Ctrl+Enter ขณะ focus อยู่ใน segment ของ DatePicker ไม่ส่งฟอร์ม (ฟอร์มสร้างและ Drawer) | พบ | ยังพบ — พฤติกรรมเดิม นอกขอบเขต |
| O-4 | แก้ program ที่ starts_at มีวินาที (สร้างผ่าน API) → วินาทีเดิมยังติดไปกับค่าที่บันทึก (DatePicker ละเอียดระดับนาที) | พบ | ไม่เปลี่ยน — ข้อสังเกต |
