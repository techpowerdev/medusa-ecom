# QA — ADM-24: status หลายค่า + ตัวเลือก affiliate ของฟอร์ม payout ใช้ request เดียวและเรียงชื่อข้ามหน้า (PR #375)

- Spec: `docs/spec/08-admin-ui-medusa-components.md` กฎ 28, AC-29 และ regression AC-12/AC-21
- Commit ที่ตรวจ: `44ba6edc333e673206ab264f9ee4423005e8113a` (merge `origin/develop` เข้า `feat/ADM-24-affiliate-status-multi`) ตรงกับ head ของ PR
- ผลรวม: **ผ่านทุก AC ไม่พบ defect**
- Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #375 (14 วัน)

## สภาพแวดล้อม
- worktree แยกใน scratchpad, prod build (`medusa build` แล้ว `medusa start` จาก `.medusa/server`, `NODE_ENV=production`) backend+admin ที่ :9315
- DB `medusa_qa375` สร้างใหม่ แล้ว migrate + seed + admin user, Redis db 15, Node v22.23.3
- Playwright chromium 1280×800, `en-US`, `Asia/Bangkok`; Stripe dummy test key (flow นี้ไม่เรียก Stripe)
- ข้อมูลใส่ตรงใน DB: active 47 / suspended 36 / pending 34
  - กลุ่ม QaMix 60 ราย `created_at` เท่ากันทั้งหมด ชื่อคละลำดับ และมีชื่อซ้ำกันเอง
  - QaDup 12 รายชื่อเดียวกัน `QaDup Same Name` และ `created_at` เท่ากัน (ทดสอบ tiebreak ด้วย id)
  - ชื่อตัวพิมพ์ปน, unicode (`Élan`), ชื่อไทย และ Seq 40 รายที่ `created_at` ต่างกัน
  - programs, payouts และ entries อย่างละ 45 รายการที่ `created_at` เท่ากัน

## ตาราง AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-29 (e2e) ทุก request ของตัวเลือกมีทั้ง `active` และ `suspended` ใน request เดียว + `order=name` ไม่มี request สถานะเดียว | pass | `ac29-options-top.png`; QA-1 จับได้ 9 request offset 0..80 limit 10 รูป `status[0]=active&status[1]=suspended&order=name` |
| AC-29 (e2e) เลื่อนจนสุด option เรียงชื่อต่อกันข้ามหน้า ไม่ซ้ำ ไม่หาย ไม่มี pending, suspended มีป้าย " — suspended" | pass | `ac29-options-dup-suspended.png`, `ac29-options-bottom.png`; option ทั้ง 85 ตัวตรงกับ `select … where status in (active,suspended) order by name, id` ทีละตัว จำนวนป้าย suspended เท่ากับใน DB |
| AC-29 (e2e) ค้นด้วย q ตัวพิมพ์ปนแล้วเลือก → Create ยิง POST ครั้งเดียว | pass | `ac29-search-selected.png`; `fINDme mixedCASE` ได้ 1 ราย, dblclick Create ได้ POST 1 ครั้ง (200) และ DB มี payout 1 แถว |
| AC-29 (e2e) GET ตัวเลือกตอบ 401 → `/app/login` | pass | QA-4a และ test ของ PR ผ่าน URL ปลายทาง `/app/login` |
| AC-29 (e2e) GET ตัวเลือกตอบ 500 → `affiliate-payout-options-error` ใต้ช่อง และไม่ไป login | pass | `ac29-options-500.png` ข้อความ "Could not load affiliates: An unknown error occurred." |
| AC-29 (API) `status=active` ค่าเดียว / `status[]=` / `status[0]=` / ค่าผิด → 400 `invalid_data` / ไม่ล็อกอิน → 401 / limit 7, 10, 50 ไม่ซ้ำไม่หาย | pass | หัวข้อ API ด้านล่าง |
| AC-12 (regression) | pass | e2e `affiliate-admin-forms.spec.ts` ผ่าน รวม combobox collection 250 และฟอร์มแก้ program ที่ไม่ส่ง starts_at/ends_at |
| AC-21 (regression) | pass | e2e ค้นหารายที่ 250 ด้วย q (ไม่มี `limit=200`) และกรณี 500 แสดง error ใต้ช่อง |
| ตาราง affiliate ทุกแท็บแบ่งหน้าถูก (regression) | pass | QA-6 กด Next จนหน้าสุดท้าย: programs 46/46, affiliates 120/120, ledger 49/49, payouts 48/48 ไม่มี id ซ้ำ |

ผลทดสอบ: e2e ของ PR (`affiliate-admin-forms` + `affiliate-admin-payout-create`) บน prod build ผ่าน 17/17; spec ของ qa (ไม่ commit) ผ่าน 9/9 และ QA-1/3/4 `--repeat-each=3` ผ่าน 15/15

## API ตรง (`GET /admin/affiliate/affiliates`)
- `status[]=active&status[]=suspended&order=name`, `status[0]=…&status[1]=…`, `status=active&status=suspended`, `order=-name`, `+q=QAMIX` (ไม่สนตัวพิมพ์): เดินครบทุกหน้าที่ limit 7, 10, 50 — count 83 (q ได้ 42) ไม่ซ้ำ ไม่หาย มีเฉพาะ active/suspended ลำดับตรง SQL `order by name, id` (`-name` = `name desc, id desc`)
- `status=active` ค่าเดียว: 47 ราย ลำดับ `created_at desc, id desc` เหมือนเดิม
- ค่าผิดทุกรูปได้ 400 `invalid_data`: `status[]=foo`, `status=foo`, `status[]=active&status[]=foo`, `status[0]=bogus`, `status=` (ค่าว่าง)
- ไม่ล็อกอินได้ 401 ทั้งรูป array และค่าเดียว

## Edge / negative
- ชื่อซ้ำ 12 รายที่ `created_at` เท่ากัน: เรียงด้วย id คงที่ข้ามหน้า ไม่เจออาการซ้ำ/หาย แบบ D-1 ของ ADM-17
- ชื่อไทยและ `Élan` อยู่ตาม collation `en_US.utf8` ของ DB; UI แสดงตามลำดับของ API ไม่เรียงซ้ำฝั่ง client
- q ที่ตรงเฉพาะ affiliate pending: `affiliates: []` ไม่มี option
- dblclick ปุ่ม Create ได้ POST 1 ครั้ง

## Defect
ไม่พบ

## ข้อสังเกต (ไม่ blocking)
1. ข้อความ 400 เมื่อ status ผิดมาจาก zod union อ่านแล้วสับสน (`status[]=foo` → "Field 'status, 0' is required"; `status=foo` → "Expected type: 'array' for field 'status', got: 'foo'") type ถูกตาม spec (`invalid_data`) แต่ไม่บอกค่าที่รับได้ → follow-up ได้
2. screenshot ทันทีหลังคลิก option ยังเห็นข้อความค้นหาจางซ้อน label เพราะ transition ของ `Combobox` ของ dashboard ยังไม่จบ รอ 1.5 วินาทีภาพสะอาด — ไม่ใช่ defect
3. ข้อมูลจาก e2e AC-44 (`e2e-af12c-ann`/`sue`) ไม่ถูกลบหลังจบ test ไปโผล่ใน combobox รอบถัดไป — hygiene ของ test เดิม
