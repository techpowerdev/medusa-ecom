# QA REPORT — CORE-22 (PR #99)

ทดสอบที่ commit `adf8665` ด้วย storefront แบบ `next build && next start` และ backend แบบ dev พร้อม seed
e2e ของ PR (`core-22-account-fixes`, `thai-ui-account`) ผ่าน 5/5 และ spec ของ qa ผ่าน 9/9
Playwright report และ trace ฉบับเต็มดูได้ที่ CI artifact ของ PR #99

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-82 title ทั้ง 5 หน้าตอนล็อกอิน ("บัญชีของฉัน" / "โปรไฟล์" / "ที่อยู่" / "คำสั่งซื้อ" / "คำสั่งซื้อ #N") ต่างกัน ไม่มี "เข้าสู่ระบบ"; ตอนไม่ล็อกอิน `/th/account` = "เข้าสู่ระบบ" | ผ่าน | `qa-01-order-detail-title.png` |
| AC-82 client navigation + logout → title เปลี่ยนตาม | ผ่าน | e2e ของ QA |
| AC-83 ไม่มีเบอร์ → "ยังไม่ได้ระบุ" ไม่มี null/undefined; บันทึกเบอร์แล้วแสดงเบอร์ | ผ่าน | `qa-03-phone-saved-success.png` |
| AC-84 1280×800 เปิดเฉพาะ editor ที่กด ไม่มี request อื่น; Tab ไม่เข้า panel ที่ปิด | ผ่าน | `qa-04-billing-editor-open-only.png` |
| editor ที่เปิดบันทึกได้ / dropdown ประเทศไม่ถูกตัด / success-error แสดง | ผ่าน | `qa-05-billing-saved-success.png` |
| มือถือ 375px ไม่มี scroll แนวนอน | ผ่าน | `qa-06-profile-mobile-375.png` |

## Edge case
- dblclick บันทึก → ส่ง server action 1 ครั้ง — ผ่าน
- token ไม่ถูกต้อง → หน้า login, title "เข้าสู่ระบบ" — ผ่าน
- หลัง logout เปิด `/th/account/profile` → ไม่เห็นข้อมูล — ผ่าน
- order detail ที่ไม่มี/ของคนอื่น → title "404 ไม่พบหน้านี้" ไม่เห็นข้อมูล — ผ่าน (HTTP 200 ดูข้อสังเกต)

## Defect
ไม่พบ defect ของ PR นี้

## ข้อสังเกต (นอกขอบเขต — มีตั้งแต่ starter → task CORE-23)
1. error ของ `profile-phone` เมื่อ token หมดเป็นข้อความดิบ "Minified React error #441"
2. ลบเบอร์ (บันทึกค่าว่าง) ไม่ได้
3. dropdown ประเทศ placeholder "Select..." และตัวเลือก "-" ซ้ำ (CORE-4c2)
4. order ที่ไม่พบ (soft 404) ตอบ HTTP 200
5. editor อีเมลแสดง success โดยไม่บันทึกจริง (TODO ของ starter)
6. "ยังไม่ได้ระบุ" เยื้องขวาเล็กน้อย
