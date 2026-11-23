# QA GB-22 (PR #444) — spec 04 กฎข้อ 45, AC-64
ทดสอบบน prod build (backend/storefront) commit 300d8717 ไม่มี Stripe key: จ่ายเงินจำลองด้วย admin mark-as-paid, เลื่อนเวลาและสถานะด้วย SQL, job group-buy-deadline รันจริงทุกนาที

| AC / กรณี | Result | Evidence |
|----|--------|----------|
| AC-64 (c) ทำซ้ำ GB-M-48x: เปิดหน้า pay ค้างไว้ → เลย pay_deadline → job ยกเลิกสิทธิ์ → กดบัตร 2 ครั้ง → backend ตอบ 400 GB_PAYMENT_CLOSED → หน้าขึ้น order-pay-closed ไม่มี paid/awaiting/form/error | pass | qa444-1-pay-open-past-deadline-closed.png |
| AC-64 (a)(c) สิทธิ์ cancelled + payment captured → หน้า pay ขึ้น order-pay-closed + order-pay-refund-notice ทั้งเปิดปกติและกลับจาก redirect ไม่ขึ้น "กำลังยืนยัน"/ชำระแล้ว; หน้าบัญชีขึ้นยกเลิก + group-order-refund-notice | pass | qa444-2-pay-cancelled-refund-notice.png |
| มือถือ 375px (หน้า pay cancelled และแถว processing ในหน้าบัญชี): ไม่มี scroll แนวนอน | pass | qa444-3-pay-cancelled-375.png |
| AC-64 (b)(d) ทำซ้ำ GB-M-46x: จ่ายแล้วแต่ convert_failed → awaiting_payment + captured → แถวขึ้น group-order-processing ไม่มีลิงก์ชำระ; เลย pay_deadline แล้วรอ job ≥ 2 รอบ → ยังเป็น processing ไม่ขึ้น "หมดเวลาชำระเงิน" | pass | qa444-4-account-processing-after-deadline.png |
| AC-64 (e) GB-8 รายการคืน order key = currency_code, display_id, id, is_draft_order, payment_status, status, total | pass | ผล test + integration ของ PR |
| Regression: จ่ายทันเวลา → membership paid → หน้าบัญชี "ชำระแล้ว" + ลิงก์ order; หน้า pay ขึ้น order-pay-paid | pass | qa444-5-regression-paid.png |
| ข้อความเป็นภาษาไทย (expectThai) ทุก testid ที่ตรวจ | pass | ผล test |
| e2e ของ PR (payments-order-pay + group-buy-account-orders) | pass 20 / skip 6 (Stripe UI) | CI artifact |

## Negative / edge
- กดปุ่มบัตรซ้ำ 2 ครั้งตอนสิทธิ์ปิดแล้ว → ยังขึ้น closed ไม่มี error ไม่มีฟอร์มกลับมา
- mark-as-paid ซ้ำ / หลังสิทธิ์ถูกยกเลิก → 400 (ไม่มีเงินเข้าซ้ำ)
- ทดสอบไม่ได้ (ไม่มี Stripe key): webhook replay, การจ่ายผ่าน UI บัตร/พร้อมเพย์จริง, การคืนเงินอัตโนมัติ GB-21

หมายเหตุหลัง qa: ตามข้อสังเกตของ qa (หน้า pay ขึ้น "ชำระเงินเรียบร้อยแล้ว" ขณะหน้าบัญชีขึ้น "กำลังยืนยัน" สำหรับ convert_failed) session หลักสั่งแก้ใน PR เดิม — หน้า pay กรณี membership `awaiting_payment` + เงินเข้าแล้วแสดง `order-pay-processing` ข้อความเดียวกับหน้าบัญชี; ยืนยันด้วย e2e ของ PR (d) และ re-review (CI e2e 403 passed รวมเคส Stripe จริง)
