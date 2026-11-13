# QA Evidence — ADM-26 (PR #379): Escape ขณะ Combobox ขยายไม่ปิด FocusModal

- **Spec**: `docs/spec/08-admin-ui-medusa-components.md` กฎ 30 และ AC-31 (regression AC-12 / AC-21 / AC-29)
- **Commit ที่ตรวจ**: `ac2743bf` (branch `feat/ADM-26-combobox-escape`)
- **สภาพแวดล้อม**: worktree แยกของ qa, **prod build** (`medusa build` แล้ว `medusa start` จาก `.medusa/server`, `NODE_ENV=production`, `ALLOW_TEST_PROVIDERS=true`) port 9317, DB `medusa_qa379` (สร้างใหม่ + migrate + seed), Redis db 7, Node 22.23.3, Playwright chromium 1280×800, `locale en-US`, `timezoneId Asia/Bangkok`
- **คำตัดสินของ owner (ก, 2026-11-14)**: ขณะ Combobox ขยาย Escape ไม่ปิด modal — **ข้อจำกัดที่ยอมรับ**: Escape ไม่ปิดรายการตัวเลือก จึงไม่นับเป็น defect
- **report/trace ฉบับเต็ม**: CI artifact ของ PR #379 (14 วัน)

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-31a ฟอร์ม payout: Escape ขณะรายการ affiliate เปิดไม่ปิด modal และค่า From คงอยู่ / เลือก option แล้ว Escape ปิด modal | pass (`--repeat-each=5` 5/5) | `01-payout-escape-keeps-modal.png` |
| AC-31b ฟอร์ม program (สร้าง): Escape ขณะรายการ collection เปิดไม่ปิด modal และชื่อคงอยู่ / คลิก heading แล้ว Escape ปิด modal | pass (`--repeat-each=5` 5/5) | `02-program-escape-keeps-modal.png` |
| AC-31 (กฎ 30c) combobox category และฟอร์ม Edit program | pass (qa E2/E3) | `03-program-category-escape-keeps-modal.png`, `04-edit-program-escape-keeps-modal.png` |
| AC-31 (กฎ 30c) ระหว่างบันทึก (POST หน่วง) Escape ปิด modal ไม่ได้ | pass (qa E4) | `05-program-saving-escape-blocked.png` |
| AC-31 (static/unit) | pass: jest `combobox-escape.unit.spec.ts` + `medusa-ui.unit.spec.ts` 187/187 | ผล test |
| AC-12 regression | pass: `affiliate-admin-forms.spec.ts` AC-12 ×2, AC-12/AC-21 ×1 | ผล test |
| AC-21 regression | pass (e2e) | ผล test |
| AC-29 regression | pass: e2e ×2 (request เดียวต่อหน้ามี active+suspended, 401 พาไป login); integration http ใช้ผลจาก CI (backend http 1–3 pass) | ผล test + CI |

e2e ชุด regression `affiliate-admin-forms`, `affiliate-admin-payout-create`, `affiliate-admin-programs`, `evoucher-admin-forms`, `group-buy-admin-form` ผ่าน **35/35**

## Checklist

1. Create payout: กรอก From แล้วเปิด combobox affiliate กด Escape 1 ครั้ง และซ้ำ 3 ครั้ง → modal อยู่ทุกครั้ง From ยังเป็น 03/05/2026 09:15 AM — **pass**
2. เลือก affiliate แล้วกด Escape → modal ปิด — **pass**
3. Create program: กรอกชื่อ ปิด all เปิด combobox collection และ category แล้วกด Escape (×2) → modal อยู่ ชื่อไม่หาย — **pass**
4. คลิก heading ใน dialog แล้วกด Escape → modal ปิด — **pass**
5. Edit program: แบบข้อ 3 กับทั้ง collection และ category ชื่อที่แก้ยังอยู่ ไม่มี POST และหลังคลิก heading แล้ว Escape modal ปิด — **pass**
6. ฟอร์มที่ไม่มี combobox เปิดอยู่: Escape ปิดทั้ง payout และ program ได้; ระหว่างบันทึก (POST ถูกกั้น ปุ่ม Save disabled) Escape ปิดไม่ได้ ชื่อยังอยู่ และหลังปล่อย POST modal ปิดเอง — **pass**
7. edge — **pass**
   - (a) พิมพ์ค้นใน combobox แล้วกด Escape: modal อยู่ คำค้นยังอยู่ รายการยังเปิด (ข้อจำกัดกฎ 30d)
   - (b) Tab ออกจาก combobox: รายการปิดเอง (`aria-expanded=false`) focus ย้ายไปปุ่มใน `period_from` จากนั้น Escape modal ปิด — ตรงกฎ 30c/d
   - (c) เปิดรายการ → Escape → คลิก heading วน 5 รอบ: modal อยู่ทุกรอบ From ไม่เปลี่ยน
   - (d) คีย์บอร์ดล้วน: ArrowDown รายการเปิด → Escape modal อยู่ → ArrowDown + Enter รายการปิด → Escape modal ปิด
8. regression ฟอร์ม FocusModal อื่น: evoucher "Create partner" และ group-buy "Create campaign" Escape ปิดตามเดิม — **pass** (ข้อสังเกต 2)
9. e2e ของ PR `--repeat-each=5`: AC-31a 5/5, AC-31b 5/5 — **pass**

## Defect
ไม่พบ

## ข้อสังเกต (ไม่บล็อก)
1. Tab ออกจาก combobox แล้วกด Escape → modal ปิดและค่าที่กรอกหาย เพราะ Tab ปิดรายการไปแล้ว ตรงกฎ 30c (มีผลเฉพาะตอน combobox ขยาย) ไม่ใช่บั๊ก แต่ผู้ใช้อาจรู้สึกว่าค่าหาย ถ้าจะกันต้องเป็นนโยบายระดับฟอร์ม (เช่น prompt ก่อนปิดเมื่อฟอร์ม dirty) นอก scope ADM-26
2. evoucher "Create partner": Escape อาจไม่ปิด modal ถ้ากดทันทีหลัง dialog เพิ่ง visible — spec ชั่วคราวของ qa ล้ม 3/3 แต่ probe แยก (กดทันที, หน่วง 100/300/1000ms, คลิก heading ก่อน) ปิดได้ 12/12 และใส่ evaluate คั่นก่อน Escape ก็ผ่าน ดูเป็น race ช่วง mount ของ Radix/focus ที่ขึ้นกับจังหวะ test มากกว่าผู้ใช้จริง PR นี้ไม่แตะ `partners-section.tsx`
3. รูป 01 ไม่เห็นค่า From เพราะ listbox บังช่องวันที่ และรูป 04 ช่องชื่อเลื่อนพ้นจอ — ทั้งสองค่าตรวจด้วย assertion แล้ว (`expectDatePicker`, `toHaveValue`)
4. ทุกเคสหลัง Escape listbox ยัง visible ตรงกฎ 30d ที่ owner ยอมรับ
