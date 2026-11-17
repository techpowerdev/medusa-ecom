# คู่มือ admin: สร้าง promotion ส่วนลดแบบจำนวนเงิน (fixed)

ที่มา: spec 01 กฎข้อ 122 (CORE-64, owner ตัดสิน 2026-11-17 "ให้ลดตามที่ตั้งเป๊ะ") · ใช้กับ Medusa admin (`@medusajs/dashboard` 2.22.1) ที่ `/app/promotions`
ชื่อปุ่ม/ป้ายในคู่มือนี้คงภาษาอังกฤษตามที่หน้า admin แสดงจริง

## ทำไมต้องเปิด "Does promotion include taxes?"
ราคาสินค้าและค่าส่ง THB ของร้านเป็นราคา**รวม VAT 7% แล้ว** ส่วนลดแบบจำนวนเงิน (fixed) ต้องคิดบนฐานเดียวกัน:

| สวิตช์ "Does promotion include taxes?" | สินค้า ฿1,070 (รวม VAT) + ส่วนลด fixed ฿100 | ลูกค้าเห็นส่วนลด |
|---|---|---|
| **เปิด** (Tax Inclusive = True) | Medusa ลด ฿100 จากราคารวม VAT | **฿100** (ตรงที่ตั้ง) |
| ปิด (ค่าเริ่มต้น, Tax Inclusive = False) | Medusa ลด ฿100 จากราคาก่อน VAT แล้วบวก VAT ของส่วนลดอีก 7% | ~฿107 (เกินที่ตั้ง) |

ฟอร์มสร้างของ admin ตั้งสวิตช์นี้เป็น**ปิด**เป็นค่าเริ่มต้น → ต้องเปิดเองทุกครั้งที่สร้างส่วนลดแบบจำนวนเงิน

## ขั้นตอนสร้าง (Amount off products / Amount off order)
1. ไปที่ Promotions → Create
2. แท็บ **Type**: เลือก template **"Amount off products"** (ลดต่อชิ้นของสินค้าที่เลือก) หรือ **"Amount off order"** (ลดจากยอดทั้งคำสั่งซื้อ) แล้วกด Continue
3. แท็บ **Details**:
   - Method = Promotion code แล้วกรอก Code
   - Status = **Draft** ไว้ก่อน (ตรวจค่าให้ครบก่อนเปิดใช้)
   - **เปิดสวิตช์ "Does promotion include taxes?"**
   - เลือกสกุลเงิน THB (เงื่อนไข Currency Code) และกรอก Promotion Value เป็นจำนวนเงินที่ต้องการลด (เช่น 100)
   - "Amount off products": กำหนด Maximum Quantity และเงื่อนไขสินค้าตามแคมเปญ
4. แท็บ **Campaign** (ถ้ามี) แล้วกด Save

## ตรวจก่อนเปิดใช้
1. เปิดหน้า detail ของ promotion ที่สร้าง → แถว **"Tax Inclusive"** ต้องเป็น **True**
2. ถ้าถูกต้อง: เมนู ⋯ → Edit → เปลี่ยน Status เป็น **Active** → Save
3. แนะนำทดลองใส่โค้ดกับตะกร้าทดสอบ: แถว "ส่วนลด" ในตะกร้าต้องเท่าจำนวนที่ตั้งพอดี

## สร้างแล้วแต่ลืมเปิดสวิตช์
หน้า detail แสดง "Tax Inclusive" = False → เมนู ⋯ → Edit (Edit Promotion Details) → เปิด "Does promotion include taxes?" → Save
แล้วตรวจหน้า detail ซ้ำว่าเป็น True
หมายเหตุ: ฟอร์ม Edit แสดงสวิตช์เฉพาะเมื่อ Value Type เป็น Amount — ถ้าเปลี่ยนเป็น Percentage ระบบจะตั้งกลับเป็นปิดเอง

## ส่วนลดแบบอื่น
- **Percentage off product / Percentage off order**: ไม่ต้องตั้ง (ฟอร์มไม่แสดงสวิตช์) — % ของราคารวม VAT ได้ผลเท่ากันทั้งสองฐาน (สินค้า ฿1,070 ลด 10% = ฿107)
- **Buy X Get Y** และ **Free shipping** (ส่วนลดค่าจัดส่ง): ไม่ต้องตั้ง (ฟอร์มไม่แสดงสวิตช์)
- **Flash sale** (ADR-003): promotion ของ flash sale สร้างในหน้า Promotions นี้เช่นกัน — ถ้าเป็นแบบจำนวนเงินต้องเปิดสวิตช์ตามขั้นตอนข้างบน
- **Group buy**: ระบบสร้าง promotion ให้เองและตั้ง Tax Inclusive = True อัตโนมัติ (spec 04 กฎข้อ 12) — ไม่ต้องทำอะไร
