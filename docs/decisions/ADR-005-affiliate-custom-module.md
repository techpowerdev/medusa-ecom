# ADR-005 Affiliate = module ที่สร้างเอง พร้อม commission ledger แบบ append-only และโปรแกรมที่มีช่วงเวลากำหนด

สถานะ: อนุมัติแล้ว (เจ้าของโปรเจกต์, 2026-10-25)

## บริบท
เจ้าของโปรเจกต์ต้องการให้ค่าคอมมิชชัน affiliate เกิดขึ้นเฉพาะในช่วงเวลาที่กำหนด (โปรแกรม), attribution แบบ last-click,
การ hold ยอดเผื่อ refund และการจ่ายเงินแบบ manual Medusa ไม่มีคอนเซ็ปต์ affiliate

## ทางเลือก
1. module ที่สร้างเอง: Affiliate, Program (ช่วงเวลา), Attribution, CommissionEntry (ledger), Payout
2. affiliate SaaS ภายนอก เชื่อมต่อผ่าน webhook
3. จำลองค่าคอมมิชชันเป็น Medusa promotion (ไม่เหมาะ: promotion ให้ส่วนลดฝั่งผู้ซื้อ)

## การตัดสินใจ
เลือกทางเลือกที่ 1 Affiliate เป็น **actor type แยก** ใน Auth module ของ Medusa (ไม่ใช่ customer);
ล็อกอินเข้า portal ของตัวเอง affiliate อาจมีบัญชี customer ภายใต้อีเมลเดียวกันได้ด้วย
แต่ทั้งสองเป็นอิสระจากกัน ledger เป็นแบบ append-only (การ reverse คือแถวใหม่) การจ่ายเงินทำแบบ manual

## ผลที่ตามมา
+ ควบคุมช่วงเวลา, scope และรายงานได้เต็มที่; ไม่มีค่าใช้จ่าย vendor
− เราต้องดูแลเรื่อง fraud/edge case เอง (ซื้อให้ตัวเอง, cookie ถูกเขียนทับ, refund) — ครอบคลุมใน AC แล้ว
