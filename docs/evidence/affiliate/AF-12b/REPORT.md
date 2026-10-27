# QA REPORT — AF-12b (PR #165) admin แท็บ Affiliates: approve/suspend/reactivate + ข้อมูลรับเงิน

Spec: `docs/spec/05-affiliate.md` กฎ 8, 37, 37b, AC-43 · head `56e58cb`
สภาพแวดล้อม: prod build (`medusa build` แล้ว `medusa start` จาก `.medusa/server`, admin `/app`) viewport 1280×720, DB/Redis แยกของ QA, Stripe key ปลอม (ไม่ได้ใช้)
CI (ผ่านทุก job): https://github.com/techpowerdev/medusa-ecom/actions/runs/40514575869 — Playwright report/trace ฉบับเต็มอยู่ใน artifact ของ run นี้ (14 วัน)
ผล: e2e 8/8 (builder 1 + QA 7 — QA spec ในเครื่อง ไม่ได้ commit)

## Acceptance criteria

| AC | Result | Evidence |
|----|--------|----------|
| AC-43 แถว `pending` มีเฉพาะ `affiliate-approve`; dblclick → `POST` 1 ครั้ง `{status:"active"}` badge `active` ไม่ reload | pass | `01-affiliates-pending.png`; e2e `affiliate-admin-affiliates.spec.ts` |
| AC-43 `affiliate-suspend` → Cancel prompt ไม่มี request; ยืนยัน → `suspended` + `affiliate-reactivate`; reactivate → `active` | pass | `02-suspend-prompt.png`; e2e เดียวกัน |
| AC-43 บันทึกข้อมูลรับเงิน 3 field → `GET /admin/affiliate/affiliates/:id` ได้ `payout_info` ตรงกัน (trim แล้ว); Clear → `null` | pass | `03-payout-info-form.png`, `04-payout-info-cleared.png`; e2e + QA |
| กฎ 37 API ล้ม → toast ข้อความจาก API + refetch รายการ | pass | `qa-api-error-toast-refetch.png`; QA (404 จริง + mock 500/400) |
| กฎ 8 `payout_info` ไม่ออกทาง portal API หลัง admin แก้ | pass | `/affiliate/me`, `/me/programs`, `/me/earnings`, `/me/payouts` = 200 ไม่มี key/ค่า |
| กฎ 37 ปุ่มอยู่ในจอที่ 1280px, admin เป็นภาษาอังกฤษ | pass | boundingBox ≤ 1280×720, ไม่มี scroll แนวนอน, ไม่มีอักษรไทย |

## Negative / edge case (QA เพิ่ม)

| กรณี | ผล |
|------|----|
| แถว `suspended` มีเฉพาะ `affiliate-reactivate` | pass |
| affiliate ถูกลบระหว่างหน้าเปิด → approve | 404 → toast ข้อความจาก API, GET รายการใหม่, แถวหาย |
| mock 500 ตอน approve | toast, refetch, badge ยัง `pending`, ปุ่มกดได้อีก |
| mock 400 ตอน Save payout info | toast, drawer ยังเปิด ค่าที่กรอกไม่หาย, refetch; Save ซ้ำหลัง API ปกติ → บันทึกได้ |
| ช่องว่างล้วนทั้ง 3 ช่อง + dblclick Save | error "Required" 3 จุด ไม่มี request |
| Clear เมื่อยังไม่มีข้อมูล / Esc ปิด drawer | Clear disabled / ไม่มี request |
| dblclick Save, dblclick Clear | อย่างละ 1 POST |
| `payout_info` จาก API มี key เกิน (`promptpay_id`) | ฟอร์มแสดง 3 ช่อง; Save ส่งเฉพาะ 3 key (ตรงกับ Q18) |
| stale row: แท็บอื่นระงับไปแล้ว หน้าเก่ากด approve | POST 200 → `active` ไม่มี error (backend ไม่ตรวจลำดับสถานะ — ข้อสังเกต เพราะกฎ 37 ห้ามแก้ backend) |
| Regression แท็บ Programs / Ledger / Payouts | โหลดได้ ไม่มี pageerror |

## Defect
ไม่พบ

## ข้อสังเกต
- stale row approve ทำให้ affiliate ที่เพิ่งถูกระงับกลับเป็น `active` โดยไม่ผ่านขั้นยืนยัน — ถ้าต้องการกัน ควรเพิ่มกฎใน spec เป็น task ถัดไป
- single-flight ใช้ตัวเดียวทั้งตาราง: ระหว่าง prompt ของ suspend เปิดอยู่ ปุ่มของแถวอื่นไม่มีผล (ยอมรับได้)
