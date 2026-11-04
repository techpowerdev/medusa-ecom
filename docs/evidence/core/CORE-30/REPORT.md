# QA — CORE-30 (PR #258): login แล้วกลับหน้ากลุ่ม/หน้าแรก (spec 01 กฎข้อ 87, AC-123)

สภาพแวดล้อม: prod build (backend `medusa build` + `medusa start`, storefront `next build` + `next start`) ที่ commit `2ce6d28`, viewport 1280 และ 375,
Stripe test mode, หา element ด้วย `data-testid`, ข้อความไทยตรวจด้วย regex `[฀-๿]`
Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #258 (14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-123 unit — `readReturnTo` รับ `/th/g/abc_D-1`, `/th`, `/buy/<items>` และคืน null สำหรับ URL ภายนอก, `//`, `..`, query, `\` | pass | `login-return.test.ts` 6/6 |
| AC-123 e2e — หน้ากลุ่ม: ไม่ login กด `group-join-button` → `/th/account?return_to=/th/g/<token>` → login → กลับ `/th/g/<token>` membership = 0 แล้วกด join เองสำเร็จ (membership = 1) @1280/@375 | pass | qa-01-group-login-return-375.png, qa-02-group-back-ready-join-1280.png |
| AC-123 e2e — หน้าแรก: ไม่ login กด `group-create-team-button` → `return_to=/th` → login → กลับ `/th` จำนวนทีม = 0 @1280/@375 | pass | qa-03-home-after-login-375.png |
| กฎข้อ 87 — สมัครสมาชิกใหม่ (register) จากหน้า login ที่มี return_to → กลับหน้ากลุ่ม ไม่ join ให้อัตโนมัติ @1280/@375 | pass | qa-04-register-with-return-1280.png |
| AC-123 e2e — return_to เป็น URL ภายนอก → login แล้วอยู่ที่ `/th/account` ในโดเมนเดิม @1280/@375 | pass | qa-05-evil-return-account-375.png |
| AC-41 regression — `/buy/<variant>:1` → login → `/th/checkout` @1280/@375 + core-14* ทั้งชุด | pass | e2e core-14* และ test ของ qa |
| regression — group-buy-join (AC-28/47), group-buy-home-campaigns (AC-48) | pass | e2e 32/32 |

## Negative / edge (ทุกข้อทดสอบที่ 1280 และ 375)
| กรณี | ผลที่ได้ |
|------|---------|
| return_to = `//evil.com`, `https://evil.com`, `/%2F%2Fevil.com` (ทั้งแบบตัวอักษรตรงและแบบ raw ใน URL ที่ decode เป็น `//evil.com`), `\\evil.com`, `/\evil.com`, `javascript:alert(1)` | ไป `/th/account` ไม่มีการนำทางออกนอกโดเมน |
| return_to = `/th/g/abc?x=1`, `/th?x=1`, `/th/account`, `/th/g/../account`, `/TH`, `/th/g/abc` ตามด้วย CRLF + Set-Cookie | ไป `/th/account` |
| dblclick ปุ่ม login | กลับหน้ากลุ่ม ไม่มี error และไม่มี membership |
| ใส่รหัสผ่านผิดก่อน | เห็น `login-error-message` เป็นภาษาไทย, return_to ยังอยู่ใน URL, login ใหม่แล้วกลับหน้ากลุ่ม |
| ปิด JavaScript | ฟอร์ม login พากลับหน้ากลุ่มได้ (ใช้ hidden input) |
| token ที่ไม่มีอยู่จริงแต่รูปแบบผ่าน regex (`/th/g/doesnotexist_QA30`) | redirect ไป path นั้น ไม่มี 5xx |
| return_to = `/zz` | middleware พาไป `/th/zz` ไม่มี 5xx |

## Defect
ไม่พบ

## Observation (ไม่ใช่ defect ของ PR นี้)
1. ลูกค้าที่ login อยู่แล้วเปิด `/th/account?return_to=/th/g/<token>` จะอยู่หน้า account ไม่ถูก redirect เป็นไปตาม spec เพราะ return_to ใช้เฉพาะตอนส่งฟอร์ม login/register
2. return_to ที่รูปแบบผ่าน regex (`/zz`, token ปลอม) จะถูก redirect ไปจริง แต่ยังอยู่ในโดเมนเดียวกันและไม่มี 5xx จึงไม่มีความเสี่ยงเรื่อง open redirect
3. ในฟอร์มสมัครสมาชิก label แบบลอย ("ชื่อ", "นามสกุล" ฯลฯ) ทับค่าที่กรอกในภาพ qa-04 อยู่ใน component register เดิม PR นี้ไม่ได้แตะ ควรแยกเปิด task ตรวจ UI

## สรุป
AC-123 และกฎข้อ 87 ผ่านทุกข้อทั้งที่ 1280 และ 375 ไม่มีการ join/สร้างทีมแทนลูกค้า กันการ redirect ออกนอกโดเมนได้ทุกรูปแบบที่ลอง และ `/buy` ยังทำงานเหมือนเดิม
