# QA ADM-21a — สถานะ error แทน empty ของตาราง e-voucher (PR #361)

- Spec: `docs/spec/08-admin-ui-medusa-components.md` แถว ADM-21a, กฎ 24a–d + 25, AC-25 (regression AC-7, AC-8, AC-20 และ ADM-20 AC-24/AC-9)
- Commit ที่ตรวจ: `29645be896ebc66895765176ee37b70ef39d6e24` (branch `feat/ADM-21a-evoucher-error-state`)
- สภาพแวดล้อม: backend prod build (`medusa build` + `medusa start`, NODE_ENV=production) ที่ :9261 พร้อม admin, DB `medusa_qa361` (migrate + seed), Redis db 11, node v22.23.3, Chromium 1280×800, `locale: "en-US"`, `timezoneId: "Asia/Bangkok"`
- CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/43404848931 — Playwright report/trace ฉบับเต็มอยู่ใน artifact `e2e-evidence` (เก็บ 14 วัน)

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-25 pools: GET `pools?*` ตอบ 500 / abort → `evoucher-pools-error` + "Could not load voucher pools", หัว "E-voucher pools" คงอยู่, ไม่มี "No voucher pools yet", ตาราง Partners ปกติ | pass | 01-pools-error-500.png; e2e `evoucher-admin-forms.spec.ts:152` (500 + abort) |
| AC-25 partners: GET `partners*` ตอบ 500 / abort → `evoucher-partners-error` อยู่ใน `evoucher-partners-table`, `evoucher-partners-empty` count 0, ปุ่ม "Create partner" enabled และเปิดฟอร์มได้ | pass | 02-partners-error-500.png; e2e `evoucher-admin-forms.spec.ts:160` (500 + abort) |
| AC-25 codes ไม่มี filter: ตอบ 500 / abort → `evoucher-codes-error` + "Could not load codes", หัว "Codes" คงอยู่, ไม่มี "Import a CSV to add codes." | pass | 04-codes-error-500.png; e2e `evoucher-admin-pool-page.spec.ts:317`, `:326` |
| AC-25 codes มี `?codes_status=void`: ตอบ 500 / abort → แสดง error ไม่ใช่ "No codes match the selected status." | pass | e2e `evoucher-admin-pool-page.spec.ts:333` + QA test "codes abort ขณะมี ?codes_status=void" |
| ปุ่ม filter ของ codes ใช้ได้ขณะ error: เลือก Status = void แล้ว URL มี `codes_status` และยังเป็น error; API กลับมาแล้ว reload ได้ empty filtered เดิม; ลบ filter แล้วแถวกลับมา | pass | QA test "codes 500 → ปุ่ม filter ยังใช้ได้" |
| AC-25 ตอบ 401 → ไป `/app/login` (pools, partners, codes ทั้งไม่มีและมี filter) | pass | e2e `evoucher-admin-forms.spec.ts:174` ×2, `evoucher-admin-pool-page.spec.ts:348` + QA test "codes 401 ขณะมี ?codes_status=void" |
| AC-25 ตอบรายการว่าง → empty state เดิมแสดง และ testid error count 0 (pools, partners, codes) | pass | 03-pools-partners-empty.png; e2e `evoucher-admin-forms.spec.ts:183`, `evoucher-admin-pool-page.spec.ts:357` |
| กฎ 24d: refetch ล้มขณะมีข้อมูล → คงตารางเดิม ไม่สลับเป็น error (pools + partners หลัง Create partner invalidate; codes หลัง Import CSV invalidate; GET ล้มครบ 2 ครั้งตาม `retry: 1`) | pass | 05-codes-refetch-fail-keeps-rows.png; QA test "QA 24d" ×2 |
| AC-25 static (`medusa-ui.unit.spec.ts`) + unit ของ `lib/fetch-error` | pass | `jest src/admin`: 19 suites, 390 tests passed |
| AC-7 (Codes แบ่งหน้า, filter, Reveal) | pass | e2e `evoucher-admin-pool-page.spec.ts:20` |
| AC-8 (Partners 20/5 แถว, empty, ฟอร์ม, Edit/Delete) | pass | e2e `evoucher-admin-partners.spec.ts:52`, `:105`, `:159` |
| AC-20 (dblclick Save = POST 1 ครั้ง; ไม่มี empty state กระพริบตอน offset เกิน) | pass | e2e `evoucher-admin-forms.spec.ts:34`, `evoucher-admin-pool-page.spec.ts:245` |
| Regression ADM-20 (ใช้ helper `isUnauthorized` ร่วม): AC-24 500 / abort / 401 / ว่าง, AC-9, AC-14 | pass | e2e `group-buy-admin-pages.spec.ts:55`, `:128`, `:185`, `:204`, `:218`, `:230` |
| Regression ADM-20 กฎ 24d: รายการแคมเปญมีข้อมูล → stale แล้วกลับมาหน้าเดิม, GET ล้ม 2 ครั้ง → ตารางคงอยู่ ไม่มี `gb-campaigns-error` | pass | QA test "QA regression ADM-20 24d" |

ผลรวม: e2e ของ PR + regression ผ่าน 26/26 (`evoucher-admin-forms`, `evoucher-admin-pool-page`, `evoucher-admin-partners`, `group-buy-admin-pages`) และ QA เพิ่มเติมผ่าน 8/8

## Negative / edge case (นอก spec)

| เคส | ผล |
|-----|-----|
| pools และ partners ล้มพร้อมกัน | error ขึ้นทั้งสองตาราง ไม่มี "No voucher pools yet" / "No partners yet" และ Create partner ยังเปิดฟอร์มได้ — pass |
| อยู่หน้า 2 ของ Codes (60 code) แล้ว GET `offset=50` ล้ม | แสดง `evoucher-codes-error` ไม่คงแถวของหน้า 1 และปุ่ม Prev ยังกดได้ ถือเป็น query ใหม่ที่ยังไม่มีข้อมูล ไม่ใช่ refetch จึงไม่ขัดกฎ 24d; footer แสดง "2 of 1 pages" เพราะไม่มี count ตอนล้ม (เล็กน้อย) |
| เลือกค่า filter แล้วกด Escape ทันที (ภายในประมาณ 50ms) | filter ที่เพิ่งเลือกหายจาก URL — เป็นเหมือนกันทั้งตอนตาราง error และตอนปกติ จึงเป็นพฤติกรรมของ `DataTable` ของ Medusa ไม่เกี่ยวกับ PR นี้ |

## Defect

ไม่พบ

## หลักฐาน (รูป ≤ 5)

`05-codes-refetch-fail-keeps-rows.png` แทน `05-codes-empty.png` เพราะกฎ 24d ยังไม่มี e2e อัตโนมัติ รูปนี้แสดง toast "Imported 1 codes" แต่ตาราง Codes ยังคง 3 แถวเดิม (refetch ล้ม) และไม่มี error ขึ้น ส่วน empty state ของ codes มี e2e `:357` ยืนยันแล้ว และ empty state ของ pools/partners มีรูป 03 อยู่แล้ว
