# REPORT — CORE-95 (PR #546) จ่ายบัตรแล้ว session หมด → notice "ได้รับชำระเงินแล้ว…" บนหน้า login แล้วไปหน้า orders

spec: `docs/spec/01-core-medusa.md` หัวข้อ "Follow-up รอบ 42" · กฎข้อ 151 · AC-192 (Q-C16 = ก owner 2026-11-23)
ทดสอบโดย qa บน prod build ของ head `ea53782f` ทั้ง desktop 1280 และ mobile 375 · QA spec (ไม่ commit) 30/30 passed
ส่วนที่พิสูจน์จาก CI: เฉพาะ AC-192(a) ทางบัตร Stripe จริง — run 45287442517 job `storefront-e2e` 495 passed ไม่มี skipped (report/trace เต็มเป็น CI artifact 14 วัน)

| AC / ข้อ | ผล | Evidence |
|---|---|---|
| AC-192(a) ทางบัตรจริง (4242, ลบ `_medusa_jwt` ก่อนยืนยัน, complete ได้ 401 จริง) → `/th/account?notice=payment_received` | pass (CI) | `core-95-payment-received-notice.spec.ts:28` ✓ (7.5s) |
| AC-192(a)(b) notice ไทย (regex อักษรไทย, ไม่ล้นจอ) แล้ว login → `/th/account/orders` | pass (1280 + 375) | `01-login-notice-desktop.png`, `02-login-notice-mobile.png`, `03-orders-after-login.png` |
| AC-192(c) `notice=<script>alert(1)</script>`, `x`, ค่าว่าง, `?notice` ไม่มีค่า, `PAYMENT_RECEIVED`, `payment_received%20`, `x&notice=payment_received` → ไม่มี notice ไม่มี hidden input ไม่มี dialog | pass (1280 + 375) | QA spec |
| AC-192(d) manual + 401 จริง → `/th/account` ไม่มี notice | pass | QA spec; CI core-76 (a2) ✓ |
| สลับไปหน้าสมัครสมาชิก → notice ยังแสดง; สมัครแล้วไม่ไป orders; login → สมัคร → login: hidden `notice` ส่งต่อ → orders | pass | QA spec |
| `return_to=/th` + notice → ไป `/th` (`return_to` ที่ผ่าน `readReturnTo` มาก่อน) | pass | QA spec |
| `return_to` = `//evil.com`, `https://evil.com`, `/\evil.com`, `…/../..//evil.com` → ไป `/th/account/orders` ไม่ออกนอก origin | pass | QA spec (framenavigated) |
| edge: รหัสผิด → error ไทย notice ยังอยู่ แก้แล้ว → orders; กด sign-in สองครั้งเร็ว → ไป orders ครั้งเดียว; login อยู่แล้วเปิด `?notice=payment_received` → ไม่มี notice ค้าง | pass | QA spec |

## ข้อสังเกต (ไม่ทำให้ AC ล้ม)
`notice=payment_received&notice=x` แสดง notice (`useSearchParams().get()` ใช้ค่าแรก; สลับลำดับแล้วไม่แสดง) — spec ไม่กำหนดกรณี param ซ้ำ ไม่มีผลด้านความปลอดภัย (ข้อความคงที่ ไม่ render ค่าจาก URL) — session หลักยอมรับเป็นพฤติกรรม บันทึกเป็น follow-up

**Defect**: ไม่มี
