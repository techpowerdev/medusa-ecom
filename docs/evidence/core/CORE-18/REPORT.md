# QA REPORT — CORE-18 (PR #80)
Spec: `docs/spec/01-core-medusa.md` กฎข้อ 33, AC-61, AC-67, AC-74 · **commit ที่ทดสอบ: `8ffc039`** · report/trace ฉบับเต็มอยู่ใน CI artifact `playwright-report` (14 วัน)

| ข้อ | ผล | หลักฐาน |
|-----|----|---------|
| 1. `/th` hero (`hero-title`/`hero-subtitle`/`hero-cta`) และ footer (`footer-store-name`/`footer-tagline`/`footer-copyright`) เป็นไทย, `<title>`/meta description เป็นไทย, กด `hero-cta` ไป `/th/store` | ผ่าน | `18-01-home-store-content.png`, `18-02-home-footer.png` |
| 2. `/th`, `/th/store`, PDP `t-shirt`, `/th/account` ไม่มีลิงก์ github.com / medusajs.com / nextjs.org / localhost:7001 และไม่มีข้อความ starter | ผ่าน | e2e ของ QA |
| 3. checkout ไม่มีโลโก้ Medusa/Next.js และ `store-link` = ชื่อร้านไทย | ผ่าน | `18-03-checkout-store-link.png` |
| 4. PDP ไม่มีกล่อง onboarding (แม้ตั้ง cookie `_medusa_onboarding=true`), สั่งซื้อด้วย manual payment แล้วหน้า order confirmed แสดงปกติ | ผ่าน | `18-04-order-confirmed.png` |
| 5. `/th/privacy` `policy-placeholder` เป็นไทย | ผ่าน | e2e ของ QA |
| 6. มือถือ 390px: ไม่มี horizontal overflow, hero/footer อยู่ในกรอบ | ผ่าน | `18-05-mobile-390-footer.png` |
| 7. `/th/account` กด `register-button` แล้ว `register-page` ไม่มีคำว่า Medusa และมีชื่อร้านไทย | ผ่าน | e2e ของ QA |
| 8. title/description ของหน้า login (ไม่ล็อกอิน) และ profile (ล็อกอินแล้ว) ไม่มีคำว่า Medusa และ description มีชื่อร้าน | ผ่าน | e2e ของ QA + test AC-61/AC-74 ของ PR |

## Negative/edge case
| กรณี | ผล |
|------|----|
| cookie `_medusa_onboarding=true` แล้วเปิด PDP และหน้า order confirmed | ไม่มีกล่อง onboarding และไม่มีลิงก์ `localhost:7001` |
| double-click `submit-order-button` | ได้ order เดียว |
| `/th/terms`, `/th/shipping`, `/th/returns`, `/th/contact` และหน้า 404 | ไม่มีลิงก์/ข้อความ/โลโก้ของ starter |

## Defect
ไม่พบ

## ข้อสังเกต (นอกขอบเขต CORE-18)
- ข้อความอังกฤษในหน้า checkout (CORE-4d), หน้า order confirmed, ข้อความรอบชื่อร้านในหน้าสมัคร/login/profile และป้ายหน้า policy (CORE-4c)
- ชื่อสินค้า "Medusa T-Shirt" และรูปจาก `medusa-public-images` เป็นข้อมูล seed จาก backend (AC-61 ฉบับปรับไม่นับ)
- comment ใน `src/middleware.ts:88` ยังเขียน "onboarding status" ทั้งที่ไม่มีโค้ด onboarding แล้ว
