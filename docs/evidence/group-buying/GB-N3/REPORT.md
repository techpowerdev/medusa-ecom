# QA GB-N3 — PR #161 (commit 9ed7d9b)

Spec: `docs/spec/04-group-buying.md` กฎข้อ 24, AC-42 (+ regression AC-41)
สภาพแวดล้อม: prod build (`medusa build` + `medusa start`, admin `/app`), DB/Redis แยกของ qa, Stripe key ปลอม (ไม่ใช้ Stripe ใน task นี้)
CI (report/trace ฉบับเต็ม, artifact 14 วัน): https://github.com/techpowerdev/medusa-ecom/actions/runs/40511590654

| AC | Result | Evidence |
|----|--------|----------|
| AC-42 เลือกแถวกลุ่มแล้วทุก `td` (รวม `td` แรก sticky) มี `background-color` เท่ากัน (`rgb(239,246,255)`) และต่างจากแถวที่ไม่เลือก | pass | qa-01-selected-row-all-cells.png |
| AC-42 hover แถวที่เลือก (`td` แรก/ที่สอง) แล้ว `td` แรกยังเป็น highlight; hover แถวอื่นยังได้สี hover ปกติ | pass | วัดค่าสีใน e2e (ภาพเหมือน qa-01 จึงไม่แนบซ้ำ) |
| กฎ 24a กด `gb-memberships-close` แล้ว highlight หายทั้งแถว (สีของทุก `td` = แถวที่ไม่เลือก) | pass | qa-03-after-close.png |
| กฎ 24b `GET /store/customers/me/group-buy/orders/:id`: ก่อน succeed `not_paid`, หลัง succeed `not_paid` (1 collection), หลัง mark-as-paid `captured`; ไม่มี 500 | pass | e2e API (QA) + unit `order-route-payment-status` 2/2 (`[null, c]` ได้ `captured`, `[null]` ได้ `not_paid`) |
| AC-41 (regression) fail ตอบ 4xx แล้วตารางกลุ่ม refetch เป็น `succeeded` ปุ่มหาย ไม่ต้อง reload; เปลี่ยนหน้าแล้ว selection ปิด | pass | qa-04-ac41-fail-4xx-refetched.png + e2e AC-41 2/2 |

e2e `group-buy-admin-members.spec.ts`: 5/5 passed (AC-35 ×2, AC-41 ×2, AC-42 ×1); QA spec (ในเครื่อง ไม่ได้ commit) 2/2

## Negative / edge case
| กรณี | ผล |
|------|----|
| เลือกแถว 0 แล้วเปลี่ยนไปแถว 2: highlight ย้ายไปแถว 2 มีแถวที่เลือกแถวเดียว แถว 0 กลับเป็นสีปกติ | pass |
| customer อื่นเรียก route ของ order นี้ | 404 (pass) |
| เรียก route โดยไม่ login | 401 (pass) |
| `null` ใน `payment_collections` | สร้างจาก DB จริงไม่ได้ จึงครอบด้วย unit (pass) |

หมายเหตุ: ในแถวที่ไม่เลือก `td` แรก sticky เป็นขาว และ `td` อื่นโปร่งใส ซึ่งเป็นค่า default ของ DataTable ไม่ใช่ defect
Defect: ไม่พบ
