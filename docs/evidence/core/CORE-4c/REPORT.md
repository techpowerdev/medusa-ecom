# QA — CORE-4c1 (PR #92) ข้อความไทยหน้า account
ทดสอบที่ commit `db32a1d` · Playwright chromium · ข้อความไทยตรวจด้วย regex อักษรไทย + ไม่มีคำละติน ≥2 ตัว · หา element ด้วย `data-testid`
รายงาน HTML และ trace ฉบับเต็มอยู่ใน CI artifact ของ job e2e (14 วัน)

| AC / checklist | ผล | หลักฐาน |
|----|----|---------|
| AC-48 login (ไม่ login) เป็นไทย ไม่มีคำว่า Medusa; login ผิดรหัส → `login-error-message` | ผ่าน | e2e ของ QA |
| AC-48 register เป็นไทย มีชื่อร้าน (STORE_NAME); สมัครผ่าน UI → เข้า overview ได้ | ผ่าน | e2e ของ QA |
| AC-48 overview + nav + "มีคำถาม?" เป็นไทย; วันที่ order แบบ พ.ศ. | ผ่าน | e2e ของ QA |
| AC-48 profile แก้ชื่อ/เบอร์ → บันทึก → ข้อความสำเร็จ; billing ว่าง → ข้อความไทย | ผ่าน (ดู D-2) | e2e ของ QA |
| AC-48 addresses เพิ่ม/แก้ไข/ลบ: หัว modal, label, ปุ่มเป็นไทย | ผ่าน (มีของ 4c2/4d เหลือ) | e2e ของ QA |
| AC-48 orders ว่าง → ข้อความไทย | ผ่าน | e2e ของ QA |
| AC-48 orders มี order → "2 ชิ้น", "ดูรายละเอียด", วันที่ พ.ศ.; เปิดหน้า details ได้ | ผ่าน | `4c1-04-orders-th.png` |
| AC-48 verify-account ไม่มี token / token ปลอม → ข้อความไทย | ผ่าน | e2e ของ QA |
| AC-48 account nav มือถือ 375px เป็นไทย ไม่ล้นจอ | ผ่าน | `4c1-05-mobile-nav-th.png` |
| document.title ของแต่ละหน้า account ตรงกับ metadata | ไม่ผ่าน (D-1, ของเดิม) | e2e ของ QA |

## Edge case
- dblclick "บันทึก" ที่อยู่ใหม่ → ได้ที่อยู่ 1 รายการ — ผ่าน
- สมัครด้วยอีเมลที่มีอยู่แล้ว → error จาก Medusa มีคำนำหน้า "Error:" (จาก `String(error)`)

## Defect (ทั้งหมดเป็นของเดิมจาก starter ไม่ได้เกิดจาก PR นี้ → แยกเป็น task ต่อ)
- D-1 (ปานกลาง): title ของหน้า account ทุกหน้าที่ login แล้วเป็น "เข้าสู่ระบบ" (metadata ของ parallel route `@login` ทับ `@dashboard`; บน develop เป็น "Sign in")
- D-2 (ต่ำ): profile ลูกค้าที่ไม่มีเบอร์ แสดงค่าเป็น "null"
- D-3 (ปานกลาง): จอ 1280px กด "แก้ไข" เบอร์โทร แต่ไปโดนปุ่มบันทึกที่ซ่อนอยู่ของ editor อีเมล (Disclosure panel `max-h-0 opacity-0` แต่ยัง overflow-visible)
- D-4 (นอกขอบเขต 4c1): "Country" (4d), "Select..." (4c2), คำนำหน้า "Error:" ในข้อความ error
