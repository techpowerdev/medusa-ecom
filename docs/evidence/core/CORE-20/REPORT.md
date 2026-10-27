# QA REPORT — CORE-20 หน้าขอคืนสินค้า (PR #112)

- Spec: `docs/spec/01-core-medusa.md` — CORE-20, AC-65, กฎข้อ 30, Q-F5
- Commit ที่ตรวจ: `c096c52` (รอบแรก) และ `01fd55e` (re-check D1 + regression) branch `feat/CORE-20-store-return-page`
- สภาพแวดล้อม: backend `medusa develop` :9133 (DB `medusa_qa112` seed ใหม่ทุกรอบ), storefront prod build (`next build` + `next start`) :8133, Node 22.23.3, Chromium
- ผล e2e ที่ `01fd55e`: 9 passed / 0 failed — `e2e/core-20-return-request.spec.ts` ของ PR 2 passed และ `e2e/core-20/qa-core-20.spec.ts` ของ qa 7 passed (รวม test re-check D1); unit `return-request.test.ts` 12 passed (รอบแรก)
- CI ของ PR (`01fd55e`): https://github.com/techpowerdev/medusa-ecom/actions/runs/40401681008 — Playwright report/trace ฉบับเต็มเป็น artifact ของ run นี้ (เก็บ 14 วัน)
  (run ของ `c096c52`: https://github.com/techpowerdev/medusa-ecom/actions/runs/40398735146 — success)

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-65 order ที่ยังไม่ fulfill ไม่มี `order-return-button` (และ `/return` ตรงๆ → `return-not-available`) | pass | e2e ของ PR + qa test "AC-65 flow เต็ม" |
| AC-65 หลัง admin fulfill + ship ปุ่มขึ้นจากการเปิดหน้าครั้งเดียว (ไม่ล้าง cache, prod build) | pass | 01-order-return-button.png, qa test "AC-65 flow เต็ม" |
| AC-65 หน้าคืน: หัวข้อ/คำแนะนำ/ปุ่มเป็นไทย, จำนวน 0..N (N=2 → 0,1,2), เหตุผลมาจาก return reasons ของ admin | pass | 02-return-form.png |
| AC-65 ทุกแถวเป็น 0 แล้วยืนยัน → `return-error` ไทย และไม่มี return ใน DB | pass | 04-qa-return-error-zero.png |
| AC-65 ยืนยัน → `order-return-success` ไทย; return `requested`, `received_at=null`, shipping method = option `type.code=standard-return`, item มี `reason_id` ที่เลือก | pass | 03-return-success.png + ตรวจผ่าน admin API `/admin/returns` |
| AC-65 กันกดซ้ำ: ปุ่มถูก disable ระหว่างส่ง (`isDisabled()=true`) คลิกซ้ำแล้วมี return เดียว | pass | qa test "AC-65 flow เต็ม" |
| AC-65 / กฎข้อ 30 request ไม่มีฟิลด์ต้องห้าม (unit `buildReturnRequest`) + backend ปฏิเสธ `receive_now`/`return_shipping.price` ที่ยิง API ตรง (400) | pass | unit 12 passed, qa test "edge" |
| AC-65 คืนบางส่วนแล้วปุ่มยังอยู่ (select เหลือ 0..1); คืนครบแล้วปุ่มหาย, `/return` ตรงๆ → `return-not-available` | pass | qa test "AC-65 flow เต็ม" |
| Q-F5 `shipped_at` เกิน 30 วัน → ไม่มีปุ่ม; 29 วัน → มีปุ่ม; ใช้ `delivered_at` ก่อน `shipped_at`; `delivered_at` เกิน 30 วัน → ไม่มีปุ่ม | pass | qa test "Q-F5 หน้าต่าง N วัน" |
| Q-F5 line `requires_shipping=false` (e-voucher) → ไม่มีปุ่ม และ `/return` → `return-not-available` | pass | qa test "Q-F5 e-voucher" |
| Q-F5 region `return_window_days=0` → ไม่มีปุ่ม | pass (แก้แล้วใน `01fd55e`; รอบแรก fail = D1) | qa test "Q-F5 region return_window_days=0" + "D1 re-check" |
| mobile 375px: แถว item/select/ปุ่มไม่ล้นจอ (`scrollWidth ≤ 375`) | pass | 05-qa-return-mobile-375.png |

## Negative / edge case (นอก spec)

| กรณี | ผล |
|------|----|
| ลูกค้าอื่นเปิด `/return` ของ order ที่ไม่ใช่ของตัวเอง | 404 ไม่มีฟอร์ม ถูกต้อง |
| แก้ option ใน select เป็นจำนวน 99 (เกิน max) | `return-error` ไทย ("ส่งคำขอคืนสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง") และไม่มี return ถูกต้อง แต่ข้อความกว้างไป ไม่บอกว่าจำนวนเกิน |
| `POST /store/returns` ตรงพร้อม `receive_now`/`price` | 400 ถูกต้อง (CORE-16) |
| submit ซ้ำ | ได้ return เดียว ถูกต้อง |
| เปิดฟอร์ม `/return` ค้างไว้ แล้ว admin ตั้ง window=0 ก่อนกดยืนยัน | `return-error` ไทย ("คำสั่งซื้อนี้ไม่สามารถขอคืนสินค้าได้แล้ว") และไม่มี return — server action ตรวจซ้ำ (`01fd55e`) |

## Defect

**D1 (ปานกลาง) — ค่า `return_window_days` ที่ admin แก้ไม่มีผล เพราะ `listRegions` ใช้ `force-cache`: แก้แล้ว ผล re-check pass ที่ `01fd55e`**
- อาการรอบแรก (`c096c52`): storefront prod รันอยู่และ cache regions อุ่นแล้ว → admin ตั้ง `metadata.return_window_days=0` → ปุ่มยังอยู่ (ผ่านเฉพาะหลังลบ `.next/cache/fetch-cache` แล้ว restart)
- การแก้ (`01fd55e`): อ่าน window จาก `GET /store/regions/:id` ของ `order.region_id` แบบ `no-store` ใช้ร่วมกันทั้งปุ่ม, หน้า `/return` และ server action
- re-check (prod build ที่รันต่อเนื่อง ไม่ล้าง cache): ลูกค้าเปิดหน้าแล้ว (เห็นปุ่ม) → admin ตั้ง 0 → reload ไม่มีปุ่ม, `/return` แสดง `return-not-available`, ฟอร์มที่เปิดค้างส่งแล้วได้ `return-error` ไทยและไม่มี return → admin ลบ key (`""`; ตรวจใน DB แล้วว่า key หายไป) → ไม่มีปุ่ม และ `/return` แสดง `return-not-available` → ตั้งกลับ 30 → ปุ่มกลับมา และขอคืนสำเร็จ (`order-return-success`) — pass
- regression: e2e ของ PR 2 ข้อ (รวม test ใหม่ของ builder สำหรับ D1) + qa ทุกข้อเดิม pass

## หมายเหตุ
- backend ยังไม่บังคับหน้าต่าง N วันบน `POST /store/returns` (owner: v1 บังคับเฉพาะ storefront) ตามที่ PR ระบุ
- spec ของ qa `apps/storefront/e2e/core-20/qa-core-20.spec.ts` แก้ DB ผ่าน `docker exec psql` (เลื่อน `shipped_at`/`delivered_at`, `requires_shipping`) จึงรันได้เฉพาะในเครื่อง ไม่ได้ commit
