# QA Evidence — ADM-25 (PR #381): ซ่อนแถบแบ่งหน้าตอนตารางโหลดล้ม, หัวข้อ error แท็บ Ledger, กฎ 24d อัตโนมัติ

- **Spec**: `docs/spec/08-admin-ui-medusa-components.md` กฎ 29 และ AC-30 (regression AC-24 / AC-25 / AC-26, ADM-23 AC-28, ADM-26 AC-31, ADM-18 AC-22)
- **Commit ที่ตรวจ**: `2f926d1c` (branch `feat/ADM-25-error-state-pagination` รวม merge `origin/develop` `e2c55a54` / #379)
- **สภาพแวดล้อม**: worktree แยกของ qa, **prod build** (`medusa build` แล้ว `medusa start` จาก `.medusa/server`, `NODE_ENV=production`, `ALLOW_TEST_PROVIDERS=true`) port 9319, DB `medusa_qa381` (สร้างใหม่ + migrate + seed + admin), Redis db 9, Node 22.23.3, Playwright chromium 1280×800, `locale en-US`, `timezoneId Asia/Bangkok`
- **ข้อมูลทดสอบ** (ทุกตารางมี ≥ 2 หน้า): pools 23, partners 23, codes 60 ใน pool เดียว (หน้าละ 50), programs 23, affiliates 23, ledger entries 23, payouts 23, campaigns 30, groups 23 ในแคมเปญเดียว
- **CI**: run 43521700343 ทุก job pass (รวม `storefront-e2e`) — report/trace ฉบับเต็มเป็น CI artifact ของ PR #381 (14 วัน)

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-30 (29a) ทุกตารางของกฎ 29 ตอบ 500 / abort → testid error visible และใน wrapper ไม่มี `/\d+ of \d+ (results\|pages)/` | pass — e2e ของ PR + qa C1 (campaigns, pools, partners, codes, programs, affiliates, ledger, payouts, groups, members × 500/abort) | `03-codes-page2-500-no-pagination.png` |
| AC-30 (29a) `?codes_offset=50` + GET codes 500 → ไม่มี "2 of 1 pages" | pass — e2e ของ PR ×3 + qa ใช้ pool 60 code (หน้า 2 มีจริง) | `03-codes-page2-500-no-pagination.png` |
| AC-30 (29b) แท็บ Ledger ล้ม → "Could not load ledger entries" | pass — e2e ของ PR (AC-26 ledger 500/abort) + qa C1 | `04-ledger-error-heading.png` |
| AC-30 (29c / 24d) มีข้อมูลแล้ว refetch ล้ม → แถวเดิมและแถบแบ่งหน้ายังอยู่ ไม่มี testid error | pass — codes (Import CSV), programs (Delete 409), groups (Create pool group) ×3 ทุกตัว + qa partners (Create partner, GET ล้ม 2 ครั้ง แถว 20 แถวคงอยู่) | `01-codes-refetch-fail-keeps-rows.png`, `02-programs-refetch-fail-keeps-rows.png` (builder) |
| AC-30 API ปกติ แถบแบ่งหน้าแสดง (AC-14) | pass — qa C5 ทุกตาราง + AC-14 ของ PR | `05-codes-recovered-page2.png` |
| AC-30 static (`medusa-ui.unit.spec.ts`, `group-buy-pages.unit.spec.ts`) | pass — jest 210/210 | ผล test |
| AC-24 regression (campaigns) | pass — e2e 500/abort/401/ว่าง | ผล test |
| AC-25 regression (pools/partners/codes) | pass — e2e 500/abort/401/ว่าง/filter | ผล test |
| AC-26 regression (affiliate 4 แท็บ, groups, members) | pass — e2e 500/abort/401/ว่าง | ผล test |

e2e ของ PR ทั้ง 4 ไฟล์ (`evoucher-admin-pool-page`, `evoucher-admin-forms`, `affiliate-admin-forms`, `group-buy-admin-pages`) บน prod build ผ่าน **55/55** (รอบแรก 50/55 เพราะ qa ไม่ได้ตั้ง `DATABASE_URL` ให้ `affiliate-admin-forms.spec.ts` ตั้งแล้วรันใหม่ทั้งไฟล์ 19/19); spec ชั่วคราวของ qa ผ่าน **51/51**

## Checklist ของ qa

1. **ตาราง × 500 / abort** (qa C1 เปิดที่หน้า 2 `<prefix>_offset=<pageSize>` สำหรับตารางที่แบ่งหน้าใน URL): testid error visible, wrapper ไม่มี "x of y results/pages", ทั้งหน้าไม่มี "of 1 pages" / "0 of 0 results" และ `<prefix>_offset` ใน URL ไม่ถูกแก้ — **pass**; **401** → ไป `/app/login` ยืนยันด้วย e2e ของ PR เฉพาะ campaigns, pools, partners, codes, payouts, groups, members (ดูข้อสังเกต 3)
2. `?codes_offset=50` (pool 60 code) + GET codes 500 → `evoucher-codes-error` ไม่มี "2 of 1 pages" — **pass**
3. แท็บ Ledger (`?ledger_offset=20`) ล้ม → "Could not load ledger entries" — **pass**
4. กฎ 24d: codes / programs / groups (e2e ของ PR ×3) + partners (qa C4) → แถวเดิมและแถบแบ่งหน้าคงอยู่ ไม่มี testid error — **pass**
5. API ปกติ: แถบแบ่งหน้าแสดง "1 of N pages", Next → request `offset=<pageSize>` 200 และ URL `<prefix>_offset=<pageSize>`, Prev กลับ "1 of N pages" (หน้า 1 มาจาก cache ของ React Query) ครบ 8 ตาราง URL + groups (state, Next 3 แถว Prev 20 แถว) — **pass** (9/9)
6. ล้มที่หน้า 2 แล้ว reload ตอน API ปกติ → request `offset` เดิม 200, ไม่มี testid error, URL คง offset และแสดง "2 of N pages" ครบ 8 ตาราง — **pass** (8/8)
7. regression: ADM-23 AC-28 (partners clamp ไม่กระพริบ + Edit/Escape) 3/3, ADM-26 AC-31a/b 6/6, ADM-18 AC-22 (หน้าแรก/`?codes_offset=50`) 6/6, AC-7 ผ่านในชุดเต็ม — **pass**

## Edge / negative
- **E1** มีข้อมูลหน้า 1 แล้วกด Next ตอน GET ล้ม (codes / programs / campaigns): URL เปลี่ยนเป็นหน้า 2, แสดง testid error, ไม่มีแถบแบ่งหน้า, ไม่มีแถวของหน้า 1 ค้างใต้ป้ายหน้า 2 (codes ใช้ `keepPreviousData` แต่ไม่แสดงข้อมูลเก่าเมื่อ query key ใหม่ล้ม) — ตรงกฎ 29a
- 401 ของ members (หลังเลือกกลุ่ม) → ไป login; members ล้มแล้วตาราง groups ด้านบนยังมีแถบแบ่งหน้าตามปกติ (ซ่อนเฉพาะตารางที่ล้ม)
- กฎ 24d หลัง mutation: GET ล้ม 2 ครั้ง (retry 1 ของ QueryClient) ไม่มี error ทับตาราง

## Defect
ไม่พบ

## ข้อสังเกต (ไม่บล็อก)
1. ตอน error ที่หน้า ≥ 2 แถบแบ่งหน้าถูกซ่อน (กฎ 29a) จึงไม่มีปุ่ม Prev กลับหน้าแรก ผู้ใช้ต้อง reload (กลับมาหน้าเดิมเมื่อ API ปกติ — checklist 6) หรือแก้ URL เอง และไม่มีปุ่ม retry — ถ้าต้องการกู้ในหน้าควรเป็น task UX แยก
2. test ของ PR `AC-30: ?codes_offset=50 …` ใช้ pool 2 code (หน้า 2 ไม่มีจริง); qa ทดสอบซ้ำกับ pool 60 code ผลเหมือนกัน — อาจใช้ pool > 50 code ให้ตรงสถานการณ์จริงกว่า (nit)
3. qa C1 **ไม่ได้พิสูจน์** 401 ของแท็บ programs/affiliates/ledger (การรอ `waitForURL(/\/app\/login/)` อาจผ่านจาก URL login ตอนเข้าสู่ระบบเอง) และ e2e ของ PR ครอบ 401 ของ affiliate เฉพาะแท็บ payouts — `AffiliateListTable` ใช้ throw เดียวกันทุกแท็บ แต่ยังไม่มีหลักฐานตรง → follow-up ได้
