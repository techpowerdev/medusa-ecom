# QA ADM-43 (PR #491) — spec 08 กฎ 47 / AC-48

สภาพแวดล้อม: prod build (`NODE_ENV=production`, `medusa start` จาก `.medusa/server`), DB แยก, env ปลอม, viewport 1280×800 และ 1440×900; commit ที่ทดสอบ: `a5c81737` (re-test หลังแก้ D-1 ด้วย `activationMode="manual"`)

| AC | Result | Evidence |
|----|--------|----------|
| AC-48 (a) ค้นด้วย code ได้ 1 แถว (ตัวเล็ก/ตัวใหญ่) | pass | qa491-ac3-code-search-1440.png |
| AC-48 (a) trim ช่องว่าง (space/tab/newline หัวท้าย; ช่องว่างล้วน = ไม่กรอง) | pass | ผล test API + UI |
| AC-48 (a) `%` `_` `\` เป็นตัวอักษรธรรมดา (รวมชื่อที่มี `\` จริง) | pass | qa491-ac4-percent-literal-1280.png |
| AC-48 (b) คลิกแท็บ Affiliates → `tab=affiliates` หลัง reload ยังอยู่แท็บเดิม | pass | qa491-ac1-tab-reload-1280.png |
| AC-48 (b) `?tab=nope`/ค่าว่าง/`AFFILIATES`/`affiliates%20` → Programs; `?tab=ledger` เปิด Ledger | pass | ผล e2e |
| กฎ 47c สลับ Ledger แล้วกลับมา คำค้นและแถวยังอยู่ | pass | ผล e2e |
| กฎ 47c offset ของแต่ละแท็บคงอยู่ | pass | qa491-ac7-back-offset-1440.png |
| คลิกแท็บ 1 ครั้ง = history +1 (คลิกแท็บเดิมซ้ำไม่เพิ่ม) | pass (D-1 แก้แล้ว) | ผล e2e @1280/@1440 |
| back 1 ครั้งย้อนไปแท็บก่อนหน้า (Payouts → Ledger → Affiliates → Programs) | pass (D-1 แก้แล้ว) | qa491-ac7-back-offset-1440.png + ผล e2e |
| keyboard: ลูกศรย้ายโฟกัสอย่างเดียว; Enter/Space สลับแท็บ (history +1) | pass | ผล e2e @1280/@1440 |
| combobox affiliate ของฟอร์ม payout ค้นด้วยชื่อและ code ได้ | pass | qa491-ac8-payout-combobox-1280.png |

## Negative/edge case
- `_` ได้เฉพาะชื่อที่มี `50%_off` จริง ไม่มี `50xxoff` → `_` ไม่ทำงานเป็น wildcard
- `\` ค้นได้เฉพาะชื่อที่มี `\` จริง; `back\slash` ได้ 1 ราย, `backxslash` ได้ 0
- `<tag>c_b` ได้ 0 ราย (ไม่ match `<tag>cab`)
- ข้อสังเกต (นอก AC): พิมพ์คำค้นแล้วสลับแท็บภายในช่วง debounce คำค้นหาย

e2e QA ผ่าน 5/5, e2e ของ PR + regression affiliate admin ผ่าน 31/31, evidence-budget ผ่าน; report/trace ใน CI artifact ของ PR #491
