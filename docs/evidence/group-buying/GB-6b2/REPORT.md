# QA: GB-6b2 ฟอร์มสร้างแคมเปญ group buying (PR #96)

ทดสอบที่ commit `6382284` · backend `medusa start` (production) · e2e: `group-buy-admin-form.spec.ts` (2/2 ผ่าน) + spec ของ QA (6/6 ผ่าน)
Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #96 (14 วัน)

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-33 ไม่มีช่อง "Product IDs" / เลือก 2 สินค้าผ่าน `gb-product-picker` → `target_rules items.product.id in [id1,id2]` | ผ่าน | `04-qa-picker-2-selected.png` |
| AC-33 checkbox ทั้งสองแถวติ๊กจริง (`data-state=checked` + ไอคอน check) | ผ่าน | `04-qa-picker-2-selected.png` |
| AC-33 selection คงอยู่หลังเปลี่ยนคำค้น และหลังไปหน้า 2 แล้วกลับมา | ผ่าน | e2e ของ QA |
| AC-33 ต้นแบบ `GBT-*` ในหน้า Promotions มี rule "Product In" ตรงกับสินค้าที่เลือก (API + UI) | ผ่าน | `05-qa-promotion-gbt-rule.png` |
| AC-32 max_quantity=1, max_units_per_person=2 → `gb-max-quantity-error` ใต้ช่อง, `aria-invalid`, ไม่มี POST; แก้ช่องแล้ว error หาย | ผ่าน | e2e ของ QA + builder |
| AC-32 max_quantity = max_units_per_person → ส่งได้ | ผ่าน | e2e ของ QA |
| AC-32 ends_at อดีต → `gb-ends-at-warning` แต่สร้างได้เป็น draft; Activate ถูก backend ปฏิเสธ 400 | ผ่าน | e2e ของ QA |
| AC-32 dblclick Create และ `btn.click()` ×5 ใน JS task เดียว → POST 1 ครั้ง แถวใหม่ 1 แถว | ผ่าน | e2e ของ QA |
| ข้อความ admin เป็นอังกฤษ | ผ่าน | e2e ของ QA |

## Negative / edge case
| กรณี | ผล |
|------|----|
| กด Esc ระหว่าง POST ค้าง → modal ไม่ปิด | ผ่าน |
| max_quantity=0 → toast error ไม่มี POST | ผ่าน |
| ชื่อเป็นช่องว่างล้วน → ไม่มี POST | ผ่าน |
| เลือก/ยกเลิกสินค้าในหน้า 2 ไม่กระทบที่เลือกในหน้า 1 | ผ่าน |
| header select-all ติ๊ก/ยกเลิกทั้งหน้า | ผ่าน |

## หมายเหตุ
- screenshot ของ builder ถ่ายระหว่าง transition ทำให้ checkbox แถวที่สองดูไม่ติ๊ก — ไม่ใช่ bug (รอ ~800ms แล้วติ๊กชัดเจน)
- ไม่พบ defect
