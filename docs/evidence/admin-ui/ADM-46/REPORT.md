# QA — ADM-46 (PR #513): ปุ่ม Save disabled ระหว่าง modal ปิด + Enter ค้างบน Create pool group

- Spec: `docs/spec/08-admin-ui-medusa-components.md` กฎ 43, กฎ 50, AC-51
- Commit ที่ตรวจ: `552c22fb` (branch `feat/ADM-46-save-disabled-hold`, merge `origin/develop` `58c1ce74`)
- สภาพแวดล้อม: **prod build** (`NODE_ENV=production medusa build` แล้ว `medusa start` จาก `.medusa/server`), backend :9258,
  DB `medusa_qa513` (seed ใหม่), Redis db 10, Chromium headless, viewport 1280×800, admin ภาษาอังกฤษ
- Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #513 (job e2e, 14 วัน) — ไม่เก็บใน git

## ผลต่อ AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-51 (a) partner: หลัง POST สำเร็จ ระหว่าง modal ปิด Save `disabled` ทุก frame, ไม่มีแถวซ้ำ | pass | qa513-closing-partner.png; e2e PR frames `[true×10–11]` ×3 รอบ; QA edge: DB 1 แถวต่อการสร้าง |
| AC-51 (a) campaign: เหมือนข้างบน | pass | qa513-closing-campaign.png; frames `[true×10–12]` ×3 รอบ |
| AC-51 (a) variant pool: เหมือนข้างบน | pass | e2e PR frames `[true×11–12]` ×3 รอบ; QA edge ปิดช้า 10x Save disabled (ผล test) |
| AC-51 (a) program / payout: สร้างสำเร็จ modal ปิด ไม่ซ้ำ (ถูกถอดทันที ไม่มี frame ปิด) | pass | e2e PR (frames `[]` ตามที่ PR ระบุ); QA edge: Save disabled ระหว่าง in-flight, POST 1 ครั้ง, program ใน DB 1 แถว |
| เปิดฟอร์มเดิมใหม่หลังสร้างสำเร็จ → Save กดได้และสร้างได้ (5 ฟอร์ม) | pass | e2e PR ขั้น (d); QA edge ขั้น (2)/(3) `toBeEnabled` |
| API error → Save กดได้ทันทีและส่งใหม่ได้ (5 ฟอร์ม) | pass | e2e PR 500; QA edge 400 หน่วง 800ms → enabled ภายใน 1 วินาที แล้ว 200 |
| AC-51 (b) Create pool group: Enter ค้าง = 1 group; คลิกแยก 2 ครั้ง = 2 group | pass | qa513-pool-group.png; e2e PR (mock) + QA edge **backend จริง** นับใน DB |
| Import codes: สำเร็จแล้ว Import disabled จนเลือกไฟล์ใหม่ | pass | qa513-import-disabled.png; e2e PR frames ทุก frame disabled; QA edge คลิก/Enter ไม่ยิง |

## ชุด test ที่รัน (prod build)

| ชุด | ผล |
|-----|----|
| `e2e/admin-create-double-submit.spec.ts` (ของ PR) | 8/8 และ `--repeat-each=3` 24/24 |
| QA edge `e2e/admin-ui/qa513-adm46.spec.ts` (ไม่ commit) | 13/13 |
| regression: retry-allocation (EV-24), evoucher-admin-partners/forms/pool-page, admin-program-form-edit, affiliate-admin-forms/payout-create, admin-form-pilot, group-buy-admin-form, admin-form-discard-prompt, admin-modal-return-focus | 79/79 |
| unit `single-flight.unit.spec.ts` + `medusa-ui.unit.spec.ts` | 253/253 |

## Negative / edge case

| กรณี | ผล |
|------|----|
| network ช้า 800ms + แอนิเมชันปิดช้า 10x (CDP): คลิก Save ×3 + ⌘+Enter ×3 ระหว่าง in-flight และคลิก/⌘+Enter/Enter ระหว่างปิด (partner/campaign/pool) | pass — Save disabled ตลอด, POST เพิ่ม 0 |
| ⌘/Ctrl+Enter ค้าง ~1 วินาทีในช่องกรอก (5 ฟอร์ม) | pass — POST 1 ครั้ง, modal ปิดและไม่เปิดซ้ำ |
| Enter ค้าง ~1 วินาทีบนปุ่ม Save ที่โฟกัส (5 ฟอร์ม) | pass ด้านกันซ้ำ (POST 1, DB 1 แถว) — **ข้อสังเกต O-1** ด้านล่าง |
| Create pool group backend จริง: Enter ค้าง / Enter ค้าง + network ช้า 1.5s / คลิกแยก 2 ครั้ง / dblclick | pass — +1 / +1 / +2 / +1 group ใน DB |
| Drawer แก้ partner (ใช้ lock เดียวกับฟอร์มสร้าง): dblclick Save = 1 request, เปิดแก้ใหม่ Save กดได้, เปิด Create หลังแก้ Save กดได้ | pass |
| EV-24 Retry allocation (createSingleFlight เดิม): dblclick = POST 1 ครั้ง | pass (regression spec) |

## Defect

ไม่พบ defect ของ AC-51

## ข้อสังเกต (ไม่อยู่ใน AC — เสนอเป็น follow-up)

- **O-1** Enter ค้างบนปุ่ม Save ของฟอร์มที่ปิดแล้วคืน focus ให้ปุ่มเปิด (partner, program, payout, variant pool; campaign ไม่เกิด):
  ขั้นตอน: เปิด Create partner → กรอก Name → Tab ไปที่ Save → กด Enter ค้าง ~1 วินาที
  expected: สร้าง 1 partner และ modal ปิด / actual: สร้าง 1 partner (ไม่ซ้ำ) แต่ keydown ที่ repeat หลัง modal ปิดไปกดปุ่ม
  "Create partner" ที่ได้ focus คืน (กฎ 38) → ฟอร์มสร้างว่างเปิดขึ้นใหม่ (qa513-enter-held-reopen-partner.png)
  ไม่มีข้อมูลเสียหาย ไม่น่าเกิดจาก PR นี้ (PR ไม่แตะ focus/ปุ่มเปิด — ไม่ได้ยืนยันบน develop) ถ้าต้องการแก้ ใช้แนวเดียวกับกฎ 50
  (ข้าม keydown `repeat` ที่ปุ่มเปิด หรือที่ปุ่ม Save)
- program/payout ไม่มี frame ระหว่างปิดให้ตรวจ (ถูกถอดทันที) ตามที่ PR ระบุ — ตรวจได้เฉพาะ disabled ระหว่าง in-flight
