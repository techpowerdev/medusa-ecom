# รายงาน QA — CORE-85 หน้า /th/contact (PR #518, AC-182)

commit ที่ตรวจ: `d63d71162b7f0ffc547261813b191229a58b7568` (prod build: backend :9301, storefront :8301, DB medusa_qa518, Redis db 13)

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-182 (1280px) — spec e2e ของ PR | pass | `core-85-contact-page.spec.ts` 2 passed; qa518-contact-1280.png |
| AC-182 (375px) — spec e2e ของ PR | pass | qa518-contact-375.png |
| กฎข้อ 141 — ข้อมูลตรงตัว (อีเมล/โทร/LINE/ที่อยู่/เวลาทำการ) | pass | ตรวจค่า + href ด้วย Playwright (qa518-*.json) |

## checklist ของ PR
- 375px: 4 ช่องทางอ่านครบ scrollWidth-clientWidth = 0, ที่อยู่ตัดบรรทัดถูก — pass
- href: mailto:support@khumkha.com, tel:+6628623331, https://line.me/R/ti/p/@khumkha (target=_blank rel=noopener noreferrer) — pass (ตรวจ attribute)
- 1280px: ป้ายกับค่า top เท่ากันทุกแถว (240/300/360/420) — pass
- ลิงก์ footer "ติดต่อเรา" href=/th/contact (พบแล้ว และคลิกแล้วถึงหน้านี้) — pass; `order-help-contact-link` ตรวจจากซอร์ส (LocalizedClientLink href="/contact" → /th/contact) ไม่ได้เปิดหน้า order จริง
- ไม่มี placeholder/ข้อความ starter (policy-placeholder = 0) — pass
- ภาษาไทย (regex) ที่ title/intro/hours/ป้าย — pass
- ความสูงลิงก์ = 44px ทุกลิงก์ (375 และ 1280) — pass

ข้อสังเกต (ไม่ใช่ defect): ใช้ ALLOW_TEST_PROVIDERS=true + key Stripe/Resend ปลอมเพื่อบูต prod build; LINE URL เป็นรูปแบบมาตรฐานที่ builder สร้าง รอ owner ยืนยัน

## รอบ 2 (head `b551e2e0` แก้ตาม review)
- ลิงก์ LINE เปลี่ยนเป็น `https://line.me/R/ti/p/%40khumkha` (encode `@`) และป้ายช่องทางเป็น "ไลน์" อย่างเดียว — e2e AC-182 ตรวจ href ใหม่และป้ายทุกช่องทางไม่มีคำละติน (CI run 45174571294 storefront-e2e SUCCESS)
- AC-48 ตรวจหน้า contact เฉพาะ `policy-title`/`contact-intro`/`contact-hours` (อีก 4 หน้า policy ตรวจเหมือนเดิม) — reviewer re-review APPROVE
- ค่าที่แสดง เบอร์/อีเมล/ที่อยู่/เวลาทำการ ไม่เปลี่ยนจากรอบ 1 จึงไม่ re-test UI; screenshot รอบ 1 แสดงป้าย "ไลน์ (LINE)" เดิม
