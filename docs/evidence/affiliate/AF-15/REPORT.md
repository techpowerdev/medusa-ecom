# Evidence: AF-15 — `payout_info` แบบ strict + `expected_status` + prompt ของ Clear (QA PR #215)

- Spec: `docs/spec/05-affiliate.md` — AC-46, กฎข้อ 39 (owner Q20)
- PR: #215 — branch `feat/AF-15-payout-info-strict` @6dcbb8c
- สภาพแวดล้อม: prod-like (`medusa build` + `medusa start` จาก `.medusa/server`), node 24.12.0, Playwright chromium; admin ภาษาอังกฤษ; ไม่ใช้ Stripe
- ผล: e2e ของ PR (`affiliate-admin-affiliates.spec.ts`) 2/2; e2e ของ qa 5/5
- รายงาน/trace ฉบับเต็มดู CI artifact ของ PR #215

## ผลตาม AC

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-46 (39a) ฟอร์ม: เลขบัญชี 9 / 13 หลัก / มีตัวอักษร / full-width / เลขไทย → `affiliate-payout-info-error` ไม่มี POST; ` 123 4-56789 0 ` → เก็บ `1234567890`, `1234-5678-9012` → `123456789012` (ตรวจ API และ DB) | pass | `ac46-1-account-number-error.png` |
| AC-46 (39c) Clear แล้วยกเลิก prompt → ไม่มี request; Clear สองครั้งติด → prompt เดียว; ยืนยัน → `payout_info = null` | pass | `ac46-2-clear-prompt.png` |
| AC-46 (39b) approve / suspend / reactivate ส่ง `expected_status` ทุกครั้ง; แท็บที่สองระงับแล้ว แท็บเดิมกด approve → 409 + toast "Affiliate status changed to suspended (expected pending)" แถวเปลี่ยนเป็น `suspended` + ปุ่ม Reactivate | pass | `ac46-3-stale-approve-409.png` |
| กันกดซ้ำ: Save / approve / reactivate สองครั้งติด → POST ครั้งเดียว | pass | e2e (นับ request) |
| `payout_info` รูปแบบเก่า (`{bank,acct,promptpay_id}`, 3 ช่องที่มี `-` + key เกิน, ค่าไม่ใช่ string) → เปิด drawer ได้ ไม่มี pageerror; ปิดด้วย Esc → ไม่มี POST ข้อมูลใน DB ไม่เปลี่ยน; approve ไม่แตะ `payout_info` | pass | `ac46-5-legacy-payout-info.png` |

## Negative / edge (API)
- key เกิน `promptpay_id`, ขาดช่อง, ค่าว่างหลัง trim, `account_number` เป็น number, full-width, เลขไทย, `payout_info: []`, `expected_status` ที่ไม่มีจริง, key ระดับบนที่ไม่รู้จัก → 400 `invalid_data` ทุกกรณี
- มีแต่ `expected_status` ที่ตรง → 200 / ไม่ตรง → 409 `AFFILIATE_STATUS_CHANGED`; ส่ง payout + `expected_status` ไม่ตรง → 409 และ payout ไม่ถูกเขียน
- approve พร้อมกัน 5 ครั้ง → 200 ×1, 409 ×4; ส่งซ้ำหลังสำเร็จ → 409
- เลขบัญชีที่มี tab ข้างใน → 200 (`\s` ถูกตัด)

Defect: ไม่พบตาม spec

## ข้อสังเกต (ไม่ใช่ defect ตาม spec)
1. เลขบัญชีผิดรูปแบบอย่างเดียวยังขึ้น toast "Fill in all payout fields" ซึ่งชวนเข้าใจผิด (ข้อความใต้ช่องถูก: "Must be 10–12 digits")
2. `payout_info` รูปแบบเก่าที่ key ไม่ตรง 3 ช่อง แสดงเป็นช่องว่าง — admin ไม่เห็นข้อมูลเดิม ถ้ากด Save จะเขียนทับและ key อื่นหาย (ตามกฎ 39a แต่ไม่มีคำเตือน)
