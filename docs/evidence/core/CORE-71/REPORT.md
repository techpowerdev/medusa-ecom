# QA CORE-71 (PR #448) — spec 01 กฎ 129, AC-170
ทดสอบกรณีจริงบน prod build ของ d24408a1 (backend + storefront), DB แยกของ qa, manual payment — ไม่ mock
ทำซ้ำแบบ CORE-M-62: สินค้า manage_inventory ที่มี level ที่ location ของ return option → order 2 ชิ้น → fulfill + ship → ตั้ง stocked 0 แล้วลบ level ที่ location นั้น → backend ตอบ `400 invalid_data "This item cannot be returned online"`
spec ของ qa 6 test + spec ของ builder 2 test ผ่าน 8/8

| AC / กรณี | ผล | หลักฐาน |
|----|----|----|
| AC-170 ที่ 1280: location ไม่มีของ → `return-contact-store` ภาษาไทย ไม่มี `return-error` ไม่มีคำว่า "ลองใหม่" จำนวน 2 ยังอยู่หลังส่งไม่สำเร็จ ไม่มี return ถูกสร้าง ไม่ล้นจอ | pass | qa448-ac170-contact-store-1280.png |
| AC-170 ที่ 375: เหมือนข้อบน (scrollWidth 375) | pass | qa448-ac170-contact-store-375.png |
| AC-170: `return-contact-store-link` href `/th/contact` กดแล้วไปหน้าติดต่อเรา (200) | pass | qa448-ac170-contact-page-1280.png |
| error อื่น: ไม่เลือกสินค้า → `return-error` ข้อความเดิม ไม่มี contact-store | pass | qa448-edge-no-item-return-error.png |
| error อื่น: จำนวนเกินที่ซื้อ → `return-error` ข้อความเดิม ไม่สร้าง return | pass | ผล test |
| edge: กดส่งซ้ำตอน location ไม่มีของ → ยังเห็น contact-store จำนวนยังอยู่ return = 0 | pass | ผล test |
| regression: location มีของ → `order-return-success` และ return สถานะ requested 1 รายการ | pass | qa448-regression-return-success.png |
| spec ของ builder (route mock 2 test) | pass | ผล test |

ข้อสังเกต: หน้า `/th/contact` ยังเป็นเนื้อหาตัวอย่าง ไม่มีช่องทางติดต่อจริง — ต้องใส่ข้อมูลจริงก่อน go-live
