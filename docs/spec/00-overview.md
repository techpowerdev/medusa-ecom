# 00 ภาพรวม — เป้าหมาย ขอบเขต และแผนผังฟีเจอร์

สถานะ: accepted (เป้าหมายของเจ้าของระบบ, 2026-10-25)

## เป้าหมายของเจ้าของระบบ (ตามต้นฉบับ, ภาษาไทย → สรุป)
1. เว็บไซต์ e-commerce ของตัวเอง สร้าง **บน Medusa v2** โดยการต่อยอด — ไม่สร้างสิ่งที่
   Medusa มีอยู่แล้วและทำได้ดีขึ้นมาใหม่ ปฏิบัติตาม coding convention และ best practice ของ Medusa
2. ฟีเจอร์ commerce พื้นฐานทั้งหมดของ Medusa ต้องครบถ้วน ใช้งานได้ และพร้อมสำหรับ production
3. ไม่ over-engineering
4. ฟีเจอร์เพิ่มเติมที่ต้องมี:
   - **E-voucher**: ขายต่อ voucher ของพาร์ทเนอร์ (Lotus, Big C, ห้างสรรพสินค้า, คาเฟ่); เราถือ
     coupon code ของพาร์ทเนอร์ไว้และส่งมอบในรูปแบบดิจิทัล (อีเมล) ไม่มีการ redeem ฝั่งเรา
   - แคมเปญ **Flash sale**: ส่วนลดแบบจำกัดเวลาเพื่อกระตุ้นการซื้อ
   - แคมเปญ **Group buying**: ส่วนลดแบบจำกัดเวลาที่จะมีผลก็ต่อเมื่อถึงเป้าหมายที่กำหนด
     (เป้าหมาย = จำนวนออเดอร์, จำนวนชิ้น, หรือจำนวนคน); มีการจำกัดจำนวนออเดอร์รวม, จำนวนชิ้นต่อคน,
     จำนวนคนต่อกลุ่ม; กลุ่มเป็นได้ทั้ง **pool** ที่แอดมินสร้าง หรือ **team** ที่ลูกค้าสร้างเอง
     ขึ้นอยู่กับการตั้งค่าของแคมเปญ
   - ระบบ **Affiliate** พร้อม commission window (เปิดค่าคอมมิชชันเป็นช่วงเวลา ไม่ใช่ถาวร) —
     คล้าย affiliate ของ TikTok/Shopee แต่เป็นร้านค้าเดียว (ไม่ใช่ marketplace)
     affiliate เห็นได้ว่าสินค้าใดได้ค่าคอมมิชชันตอนนี้หรือเร็ว ๆ นี้ และนำไปแชร์ต่อ
   - การชำระเงินผ่าน **Stripe**: บัตรเครดิต/เดบิต + **PromptPay** ของไทย
5. รองรับผู้ใช้จำนวนมากได้ดี (scale ได้)

## แผนผังฟีเจอร์ → spec
| # | ฟีเจอร์ | Spec | แนวทางการสร้าง |
|---|---------|------|----------------|
| 1 | Core commerce | `01-core-medusa.md` | ใช้ Medusa ตามที่มี; ตั้งค่า |
| 2 | E-voucher | `02-evoucher.md` | custom module `evoucher` (code pool ของพาร์ทเนอร์ → Medusa inventory) + digital fulfillment + notification |
| 3 | Flash sale | `03-flash-sale.md` | ต่อยอด Promotion module (campaign + rules); custom module แบบบางเฉพาะ per-customer cap + ข้อมูล countdown |
| 4 | Group buying | `04-group-buying.md` | custom module `group_buy`; สร้าง draft order ตอน join (รูปแบบ Medusa Quotes), ส่ง pay link เมื่อสำเร็จ; ส่วนลดผ่าน Promotion module |
| 5 | Affiliate | `05-affiliate.md` | custom module `affiliate` (actor type ของตัวเอง); attribution ผ่าน signed link; product showcase แบบ now/soon; ledger |
| 6 | Payments | `06-payments-stripe.md` | Medusa Stripe provider (`pp_stripe_stripe`, `pp_stripe-promptpay_stripe`), auto capture |
| 7 | Scale & ops | `07-scaling-ops.md` | Worker mode, Redis modules, DB indexes, CDN, observability |
| 8 | Admin UI ใช้ของ Medusa | `08-admin-ui-medusa-components.md` | ปรับหน้า/widget ใน `src/admin/` ให้ใช้ export ของ `@medusajs/dashboard` + `@medusajs/ui` เป็นฐาน (ADR-018) |

## Milestones (ดู `docs/ROADMAP.md`)
M0 Scaffold → M1 ร้านค้าหลักใช้งานได้ (test mode) → M2 Payments (Stripe cards + PromptPay) →
M3 E-voucher → M4 Flash sale → M5 Group buying → M6 Affiliate → M7 Scale/hardening → v1.0

## การตัดสินใจของเจ้าของระบบ (2026-10-25)
- **ไม่มี guest** การดูสินค้าเท่านั้นที่เป็นสาธารณะ การกระทำอื่น ๆ ทั้งหมดต้องเป็นลูกค้าที่ล็อกอินแล้ว
  (cart, checkout, orders, vouchers, group buy) affiliate เป็น actor type แยกต่างหากที่มี
  login ของตัวเอง ไม่จำเป็นต้องเป็นลูกค้า
- ส่วนลด flash sale และ group buy ไม่สามารถใช้ร่วมกับ promotion code อื่นได้
- Group buying: สร้าง draft order ตอน join → ส่ง pay link เมื่อถึงเป้าหมาย → ยกเลิก + แจ้งเตือนเมื่อไม่ถึงเป้าหมาย

## ข้อกำหนด non-functional ส่วนกลาง
- เงิน: ตาม Medusa v2 — จำนวนเงินเป็น **ทศนิยมหน่วยหลัก** (฿100 = `100`) เก็บด้วย
  `model.bigNumber()` / `BigNumber` ใน custom module ห้ามใช้หน่วยสตางค์ในโค้ดของเรา; Stripe
  provider จะแปลงเป็นหน่วยย่อยภายในเอง
- เวลา: เก็บเป็น UTC; admin แสดงและกรอกเวลาตาม timezone ของเครื่องแอดมินแบบเดียวกับหน้า campaign/promotion ของ Medusa
  (`DatePicker`/`useDate` — ADR-018) เครื่องแอดมินจึงต้องตั้งเวลาเป็นไทย (`Asia/Bangkok`); storefront แสดงเวลาไทยเสมอ (spec 01 กฎ 42)
- Idempotency: webhook, scheduled job และขั้นตอน settlement ทั้งหมดต้องรันซ้ำได้อย่างปลอดภัย
- Concurrency: ตัวนับ "จำนวนจำกัด / slot จำกัด" ทุกตัวต้องบังคับใช้ที่ระดับ DB
  (atomic update หรือ row lock) ไม่ใช่ใน memory ของแอปพลิเคชัน
- Observability: structured log, request ID, error tracking; health endpoint
- Security: admin route อยู่หลัง Medusa auth; store route ใช้ publishable API key;
  rate limit ที่ endpoint auth และ campaign-join
