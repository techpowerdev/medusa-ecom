# QA CORE-84 (PR #519) — จับ error กลุ่ม group buy/flash/affiliate ด้วย code

- spec: `docs/spec/01-core-medusa.md` กฎข้อ 140, AC-181 (b) กลุ่ม group buy/flash/affiliate และ (c); ADR-028; `docs/spec/05-affiliate.md` AC-53
- commit ที่ตรวจ: `d5659fb0765f6057502fb9d1fe7eb025c29db2b8` (worktree แบบ detached)
- สภาพแวดล้อม: prod build ทั้งสองฝั่ง
  - backend: `NODE_ENV=production medusa build` แล้ว `medusa start` จาก `.medusa/server`
  - storefront: `next build` แล้ว `next start` ที่ :8259
  - DB `medusa_qa519`, Redis db 11, `pp_system_default`, viewport 375×812
- backend จริงอยู่ที่ :9269 โดยมี proxy ของ qa ที่ :9259 คั่นไว้
  - proxy บันทึก status และ body ของ POST เพื่อใช้ตรวจ (c) เพราะ join, สร้างทีม และ register เป็น server action ที่ browser ไม่เห็น response ของ backend
  - proxy บันทึก hash ของ token ใน header `authorization` ด้วย
- **ไม่มี route mock** ทุกกรณีสร้างจาก backend จริง ดังนี้
  - กลุ่มเต็ม: สองแท็บแย่งที่สุดท้ายพร้อมกัน
  - เกินชิ้นต่อคน: มี membership เดิมอยู่แล้ว
  - cart ว่าง: ลบ line item ของ cart ที่หน้ากลุ่มเตรียมไว้ผ่าน store API ก่อนกด join
  - กลุ่มหมดเวลา: ย้อน `ends_at` ใน DB
  - ต้นแบบ 2 สินค้า: แก้ผ่าน admin API `target-rules/batch`
- ผลการรัน
  - test ของ qa (ไม่ commit) 10/10 ผ่าน
  - e2e เดิมที่เกี่ยวข้อง (`group-buy-join`, `group-buy-home-campaigns`, `affiliate-portal`) 21/21 ผ่านบน prod build
  - vitest ของ PR (`core-84-gb-affiliate-codes`, `group-join-error`, `affiliate-register-error`) 362/362 ผ่าน
- report/trace ฉบับเต็ม: CI artifact `e2e-evidence` ของ PR #519 (14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-181 (b) `/th/g/<token>` สองแท็บแย่งที่สุดท้าย (`max_people_per_group=2`, มีสมาชิกแล้ว 1) กด join พร้อมกัน → แท็บหนึ่งไป `/th/account/orders` อีกแท็บ `group-join-error` = `กลุ่มนี้เต็มแล้ว`; membership = 2; backend ตอบ 201 + 409 `{type: conflict, code: GB_GROUP_FULL}` (QA-GB1) | pass | qa519-01-group-full-race-375.png |
| AC-181 (b) join เกินชิ้นต่อคน (มี 2 ชิ้นแล้ว เพิ่ม 2, max 3) → `เกินจำนวนชิ้นสูงสุดต่อคน (3 ชิ้น)`; 409 `code: GB_UNITS_LIMIT_EXCEEDED` (QA-GB2) | pass | qa519-02-units-limit-375.png |
| AC-181 (b) join ด้วย cart ว่าง → `กรุณาเลือกสินค้าอย่างน้อย 1 ชิ้นก่อนเข้าร่วม` (ไม่ใช่ "ปิดรับแล้ว"); 400 `{type: invalid_data, code: GB_CART_EMPTY}` (QA-GB3) | pass | qa519-03-cart-empty-375.png |
| AC-181 (b) กลุ่มหมดเวลาระหว่างอยู่บนหน้า → `กลุ่มหรือแคมเปญนี้ปิดรับแล้ว`; 400 `not_allowed` ไม่มี code (QA-GB4 + e2e เดิม) | pass | ผล test QA-GB4 |
| AC-181 (b) หน้าแรก: ต้นแบบถูกแก้เป็น 2 สินค้าแล้ว dblclick สร้างทีม → `group-create-team-error` = `แคมเปญนี้ยังไม่พร้อมเปิดกลุ่ม` อยู่หน้าเดิม ปุ่มกดได้; POST 1 ครั้ง 400 `code: GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED` (QA-GB5 + AC-48 เดิม) | pass | qa519-04-create-team-not-ready-375.png |
| AC-181 (b) + spec 05 AC-53: สมัคร affiliate ด้วยรหัส `admin` / `support` → `affiliate-register-error` = `รหัสแนะนำนี้เป็นคำสงวน กรุณาเลือกรหัสอื่น` ไม่เข้า portal ไม่สร้าง affiliate; 400 `{type: invalid_data, code: AFFILIATE_CODE_RESERVED}` (QA-AF1 + AF-21/AF-22 เดิม) | pass | qa519-05-affiliate-reserved-375.png |
| AC-181 (b) อีเมลที่เป็นลูกค้าอยู่แล้ว + รหัสผ่านผิด → `อีเมลนี้มีบัญชีอยู่แล้ว กรุณาใช้รหัสผ่านเดิม` ไม่สร้าง affiliate (backend 401 `Identity with email already exists` → ข้อยกเว้น `IDENTITY_EXISTS`); ใช้รหัสผ่านเดิม → สมัครได้ เข้า portal เห็นรหัสของตัวเอง (QA-AF2) | pass | ผล test QA-AF2 |
| AC-181 (c) body ของ POST ที่ล้มมี `code` ครบทุกตัวที่ storefront ใช้ตัดสิน (GB_GROUP_FULL, GB_UNITS_LIMIT_EXCEEDED, GB_CART_EMPTY, GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED, AFFILIATE_CODE_RESERVED — จากบันทึกของ proxy); static test ของ PR ผ่าน | pass | ผล test QA-GB1..5, QA-AF1 |
| flash: PR ไม่แตะ flash (409 ตอน complete ย้ายไปใน CORE-82 แล้ว) static test ยืนยันว่าไม่มีการเทียบข้อความเหลือ | n/a | vitest `core-84-gb-affiliate-codes` |

## edge / negative
| กรณี | ผล |
|------|----|
| token ไม่ปน: login ลูกค้าผ่าน UI แล้วสมัคร affiliate (อีเมลอื่น, dblclick) ในแท็บเดียวกัน | pass — `/auth/affiliate/emailpass/register` ไม่มี `authorization`; `/affiliate/register` ใช้ token ที่ hash ≠ JWT ลูกค้า; `_medusa_jwt` ไม่เปลี่ยน และ `_affiliate_jwt` ≠ JWT ลูกค้า; `/th/account` ยังแสดงอีเมลลูกค้า; affiliate 1 รายการ (QA-AF3) |
| สองแท็บแย่งที่สุดท้าย | pass — เข้าได้ 1 คน ไม่เกิน `max_people_per_group` (QA-GB1) |
| dblclick join (409) / สร้างทีม (400) / สมัครคำสงวน | pass — POST ถึง backend 1 ครั้งทุกกรณี |
| รหัสตัวพิมพ์ใหญ่ `Shop` | browser ไม่ส่งฟอร์ม (`pattern` a-z ของ input) ไม่มี POST จึงไม่ถึง middleware คำสงวน (QA-AF1e) |
| ข้อความ error มีอักษรไทย และไม่มี `[A-Za-z]{4,}` | pass — group-join-error, group-create-team-error, affiliate-register-error ทุกกรณีข้างบน |
| 375px | pass — test ของ qa ทั้งหมดรันที่ 375×812 |

## defect / ข้อสังเกต
- ไม่พบ defect
- ไม่ได้ทดสอบ end-to-end: `GB_SHIPPING_PROFILE_NOT_COVERED` — สร้างจาก UI ไม่ได้ เพราะ storefront กรองวิธีส่งตาม profile อยู่แล้ว (CORE-32); ใช้กลไกเดียวกับ `GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED` คือ 400 `not_allowed` ที่ errorHandler ของ Medusa คง `code` ไว้ (ยืนยันจาก body จริงของ QA-GB5) และมี unit ครอบ
- ข้อสังเกต (ไม่ใช่ defect): ข้อความ 400 ของ `GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED` ยังขึ้นต้นด้วยชื่อ code (`GB_CAMPAIGN_SINGLE_PRODUCT_REQUIRED: a group buy…`) storefront ไม่ได้ใช้ข้อความนี้แล้ว ผู้ใช้จึงไม่เห็น
