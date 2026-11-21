# QA — CORE-73 (PR #458) spec 01 AC-172

ทดสอบบน prod build (backend + storefront) ด้วย Playwright รอบแรก 845e220c, re-test F-1 ที่ f633fae4
Playwright report/trace ฉบับเต็มอยู่ใน CI artifact (14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-172 อีเมลลูกค้าเดิม + รหัสถูก: อยู่หน้าสมัคร เห็น `register-email-exists` "อีเมลนี้มีบัญชีแล้ว" + `register-login-link` ไม่มี cookie `_medusa_jwt` ค่าที่กรอกยังอยู่ (รหัสผ่านถูกล้าง) customer ยังมี 1 แถวชื่อเดิม | pass | qa458-ac172-correct-password.png |
| AC-172 รหัสผิด: textContent ตรงกับกรณีรหัสถูกทุกตัวอักษร ไม่ login ไม่สร้าง customer | pass | ผลรัน e2e (QA-2) |
| AC-172 กด `register-login-link` → `login-page` แล้ว login ได้ | pass | ผลรัน e2e (QA-3) |
| AC-172 (regression) อีเมลของ affiliate ที่ยังไม่เป็นลูกค้า: สมัครลูกค้าได้ | pass | ผลรัน e2e (QA-4) |
| สมัครด้วยอีเมลใหม่ (ดับเบิลคลิก): สำเร็จ customer 1 แถว ยิง `signup` ครั้งเดียว | pass | ผลรัน e2e (QA-5) |
| 375px: ข้อความ + ลิงก์อยู่ในจอ ไม่ล้น | pass | qa458-ac172-mobile-375.png |
| F-1 สมัครด้วย `QA…@EXAMPLE.COM` ทับบัญชีตัวเล็ก (รหัสถูก/ผิด + ช่องว่างหัวท้าย) → `register-email-exists` ไม่มี cookie, `provider_identity`/`customer` แถวเดียวเป็นตัวเล็ก | pass | qa458b-f1-uppercase-email-exists.png |
| F-1 login ด้วย `  QA…@EXAMPLE.COM  ` → เข้าบัญชีเดิม | pass | qa458b-f1-login-uppercase.png |
| F-1 สมัครลูกค้าด้วยอีเมลใหม่ตัวปน + ช่องว่าง → บันทึกเป็นตัวเล็ก login ได้ | pass | ผลรัน e2e (F1-c) |
| F-1 affiliate portal: สมัคร/login ด้วยตัวพิมพ์ปน → identity/affiliate.email ตัวเล็ก; สมัครซ้ำด้วยตัวพิมพ์อื่น → error, ไม่ซ้ำ | pass | qa458b-f1-affiliate-login-uppercase.png |
| F-1 ใช้ identity ข้ามกันระหว่างลูกค้า/affiliate ด้วยตัวพิมพ์ใหญ่ → identity เดียว | pass | ผลรัน e2e (F1-e) |

## Negative/edge
- affiliate + รหัสผิด, ดับเบิลคลิกสมัครด้วยอีเมลเดิม, แก้อีเมลหลัง error, reload หลัง error → pass
- อีเมลเดิมแต่ตัวพิมพ์ใหญ่: แก้แล้วที่ f633fae4 → pass
- ข้อจำกัดที่รู้ F-3: บัญชีที่สร้างก่อน fix และเก็บอีเมลตัวพิมพ์ใหญ่ไว้ จะ login ผ่าน storefront ไม่ได้ (ยังไม่มีข้อมูล production)
