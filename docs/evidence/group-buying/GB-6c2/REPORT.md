# รายงาน QA — GB-6c2 (PR #121)

- Spec: `docs/spec/04-group-buying.md` แถว GB-6c, AC-35
- Commit ที่ทดสอบ: `22a2db9` (branch `feat/GB-6c2-admin-memberships-ui`)
- สภาพแวดล้อม: backend prod build (`medusa start`, NODE_ENV=production, ALLOW_TEST_PROVIDERS=true) :9139, DB `medusa_qa121` (seed ใหม่), Redis db 14, Playwright chromium, Node 22 — ไม่ใช้ Stripe (flow นี้ไม่เรียก Stripe)
- Test: `apps/storefront/e2e/group-buy-admin-members.spec.ts` (PR, 2 test) + QA spec ในเครื่อง (6 test, ไม่ได้ commit) — 8 passed
- Report/trace ฉบับเต็ม: CI artifact ของ PR (14 วัน) https://github.com/techpowerdev/medusa-ecom/actions/runs/40447873325

## ตาราง AC

| AC | Result | Evidence |
|----|--------|----------|
| AC-35 คลิกแถวกลุ่ม → `gb-memberships-table` แสดงสมาชิกครบ (อีเมล, units, status, payment) ลิงก์ `/app/draft-orders/<order_id>` | pass | 01-memberships-table.png |
| AC-35 ลิงก์ draft order เปิดหน้า Draft Order ของ Medusa ได้จริง (ลูกค้าตรงกัน ไม่มี page error) | pass | 03-draft-order-page.png |
| AC-35 dblclick `gb-group-succeed` → กล่องยืนยัน 1 กล่อง, POST 1 ครั้ง, กลุ่ม `succeeded`, สมาชิก `awaiting_payment`, ปุ่มหาย | pass | 02-group-succeeded.png |
| AC-35 กด `gb-group-fail` แล้ว Cancel → ไม่มี request | pass | ผล test `group-buy-admin-members.spec.ts:148` |
| AC-35 dblclick `gb-group-fail` + ยืนยัน → POST 1 ครั้ง, กลุ่ม `failed`, สมาชิก `cancelled`, order `canceled`, ปุ่มหาย | pass | 04-group-failed.png |
| AC-35 กลุ่ม `succeeded`/`failed` ไม่มีปุ่ม succeed/fail | pass | 02-group-succeeded.png, 04-group-failed.png |
| AC-35 ลูกค้าถูกลบแสดง `<customer_id> (deleted)` ไม่ crash; order ที่แปลงแล้วลิงก์ `/app/orders/<id>` เปิดได้ (แปลงผ่าน `POST /admin/draft-orders/:id/convert-to-order`) | pass | 05-deleted-and-converted.png |
| ข้อความ admin เป็นอังกฤษ ไม่มีอักษรไทย | pass | QA spec |

## Negative / edge case

| กรณี | ผลลัพธ์ |
|------|---------|
| หน้าเก่า: กลุ่มถูก fail ผ่าน API แล้ว admin กด succeed + ยืนยัน | POST 1 ครั้ง ได้ 400 toast "Group buy group is already failed" ไม่ crash — หน้ายังแสดง `open`/ปุ่มเดิมจน reload (minor) |
| POST `/succeed` ผ่าน API พร้อมกัน 2 ครั้ง | 200/200 (no-op ตามกฎข้อ 8) กลุ่ม `succeeded` payment collection 1 รายการ |
| กลุ่มไม่มีสมาชิก | empty state "No members yet" |

## Defect
ไม่พบ defect ที่ทำให้ AC fail
ข้อสังเกต minor: `onError` ใน `group-members.tsx` ไม่ invalidate query ของกลุ่ม หน้าจึงแสดงสถานะเก่าจน reload
