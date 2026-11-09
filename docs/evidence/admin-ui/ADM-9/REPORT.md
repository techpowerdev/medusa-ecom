# QA ADM-9 — PR #322 (ฟอร์ม affiliate ใช้ `Form` + `DatePicker` + `Combobox`)

- Spec: `docs/spec/08-admin-ui-medusa-components.md` แถว ADM-9, AC-12
- Commit: `8b16c5ed` (base `ee69cdc0`) · prod build port 9211 · chromium 1280×800 · Asia/Bangkok · key ปลอม
- ผล e2e: spec เดิม 8/8 (`--workers=1`), spec checklist ของ QA 42/42, unit `src/admin` 336/336

| AC / รายการ | Result | Evidence |
|---|---|---|
| AC-12 collection ลำดับ 250 ค้นแล้วเลือกได้, starts → `2026-11-30T17:00:00.000Z`, `period_from` เริ่มต้น | pass | e2e `affiliate-admin-forms` |
| AC-12 e2e programs/affiliates/payouts ผ่าน | pass (reviewer ตัดสินเรื่อง `Escape` ที่ลบใน `affiliate-admin-payout-create`) | log e2e |
| AC-12 static: ไม่มี `datetime-local`/`ictToIso`/`isoToIct`, ไม่มี `useState` ถือค่าฟอร์ม | pass | unit + grep |
| AC-12 แก้โดยไม่แตะวันที่ → ไม่ส่ง `starts_at`/`ends_at`; แก้แค่ ends → ส่งแค่ ends | pass | T2 |
| AC-12 ปิด `all` ไม่เลือก scope → error (สร้าง + แก้) ไม่มี request | pass | V1 |
| AC-12 ตัวเลือก affiliate 252 ราย: ค้นชื่อ/อีเมลได้, เลือกได้, มีป้าย suspended | pass | A3 |
| เลย์เอาต์ modal program/payout, drawer, mark-paid prompt | pass | ac12-1-program-modal.png, ac12-2-payout-modal.png, ac12-3-payout-info-drawer.png, ac12-4-mark-paid-prompt.png |
| `⌘/Ctrl+Enter` ทั้ง 4 ฟอร์ม กดซ้ำ = 1 request | pass (ดูข้อสังเกต 1) | K1–K5 |
| dblclick Save = 1 request | pass | D1–D3 |
| scope นอกหน้าแรก: จำนวน 3 และ 2 ถูก, ป้ายชื่อถูก, เอาออกแล้ว body ถูก, `variant_ids` คงเดิม | pass | S1, ac12-5-scope-outside-first-page.png |
| พิมพ์ `e` ใน Cap per order → error ใต้ช่อง ไม่มี request (กฎ 15) | pass | N1–N3 |
| DatePicker เวลาไทย → UTC (program + payout) | pass | T1 |
| ends ≤ starts และ payout to ≤ from → error ไม่มี request | pass | V2 |
| เลขบัญชี 10–12 หลัก (AF-M-28): 9/13 หลัก/ตัวอักษรถูกปฏิเสธ, ตัด `-`/ช่องว่างแล้วเก็บถูก | pass | A1 |
| Clear payout info มี prompt: Cancel = 0 request, ยืนยัน = `null` 1 ครั้ง | pass | A2 |
| Edge: Enter เปล่าไม่ส่ง, 400 แล้วส่งใหม่ได้, Esc ระหว่างส่งไม่ปิด modal, wheel โหลดหน้าถัดไป | pass | E1–E3, S2 |

## Defect
ไม่พบ

## ข้อสังเกต (ไม่นับเป็น defect)
1. `⌘/Ctrl+Enter` ตอน focus อยู่ใน segment ของ DatePicker ไม่ส่งฟอร์ม (หน้า campaign ของ Medusa และฟอร์ม ADM-7 เป็นเช่นกัน)
2. Esc ตอน dropdown Combobox เปิด ปิดทั้ง FocusModal และค่าที่กรอกหาย
3. dblclick ปุ่ม Clear ได้ prompt เดียว 0 request แต่ drawer ปิดไปด้วย และ Esc ระหว่างบันทึก drawer ก็ปิด drawer (เกิดบน base `ee69cdc0` ด้วย)
4. DatePicker ที่ค่าว่าง: คลิกวันแล้วช่องยังว่างจนกว่าจะตั้งเวลา
5. แก้ ends ของโปรแกรมที่มีวินาที: วินาทีเดิมยังติดไปใน body; ค้นหา affiliate เป็น fuzzy โดยรายการที่ตรงอยู่บนสุด
