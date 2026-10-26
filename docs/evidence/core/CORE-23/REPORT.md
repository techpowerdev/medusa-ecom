# QA REPORT — CORE-23 (PR #105)

ทดสอบบน build ระดับ production (`medusa start` + `next build`/`next start`) ที่ commit `38dec9d`
e2e ของ PR ผ่าน 4/4; regression core-22, thai-ui-account, core-store, core-14-buy-login ผ่านทั้งหมด; spec ของ QA ผ่าน 13/13

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-85 ล้างเบอร์แล้วบันทึก → `GET /store/customers/me` phone เป็น null และหน้าแสดง "ยังไม่ได้ระบุ" | ผ่าน | `01-phone-cleared.png` |
| AC-86 อีเมลอ่านอย่างเดียว (`account-email` ไม่มีปุ่ม/input) และ `POST /store/customers/me {email}` → 400 | ผ่าน | `02-profile-email-readonly-aligned.png` |
| AC-89 ค่าทุกช่องอยู่แนวเดียวกับ label ที่ 1280px และ 375px ไม่มี scroll แนวนอน | ผ่าน | `02-…`, `04-profile-aligned-375.png` |
| AC-87 order ที่ไม่มี / ของลูกค้าอื่น / id แปลก → HTTP 404 + หน้า not-found ไทย; order ของตัวเอง → 200 | ผ่าน | `05-order-of-other-customer-404.png` |
| AC-88 ลบ cookie `_medusa_jwt` แล้วบันทึกเบอร์/ชื่อ → ข้อความไทย (ตอน QA: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"; หลัง resolve กับ #103 เป็น "กรุณาเข้าสู่ระบบอีกครั้ง") ไม่มี "Minified React error" ข้อมูลไม่เปลี่ยน | ผ่าน | `03-token-expired-save.png` |
| เปลี่ยนหน้าในเมนู account 3 รอบ ที่ 1280/375px → ไม่มีหน้าขาว | ผ่าน | e2e ของ QA |

## Negative / edge case
- เบอร์ช่องว่างล้วน → บันทึกเป็น null — ผ่าน
- dblclick บันทึกเบอร์ → server action 1 ครั้ง — ผ่าน
- เครือข่ายช้า 600ms แล้วเปลี่ยนหน้าในเมนู → ไม่มีหน้าขาว (~1.3s) — ผ่าน
- ไม่ได้ login เปิด order → หน้า login ไม่รั่วข้อมูล — ผ่าน

## Defect
ไม่พบ defect ที่ block

## ข้อสังเกต (minor)
1. เครือข่ายช้า กดเมนู account แล้วหน้าเดิมค้าง ~1.3s ไม่มีตัวบอกสถานะ (ผลจากลบ loading.tsx) → เสนอ progress bar
2. บันทึกไม่สำเร็จ (token หมดอายุ) ค่าที่พิมพ์ในช่องเบอร์ถูกล้าง (React 19 reset ฟอร์มหลัง form action)
3. รูป 03 ถ่ายระหว่าง fade-in ของ error badge
