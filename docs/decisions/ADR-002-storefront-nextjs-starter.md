# ADR-002 Storefront = Medusa Next.js Starter (ปรับธีม) ไม่ใช่แอป Ant Design ที่สร้างเอง

สถานะ: อนุมัติแล้ว (เจ้าของโปรเจกต์, 2026-10-25)
— **หมายเหตุ 2026-11-26 ([ADR-030](ADR-030-storefront-shadcn-ui.md) accepted 2026-11-26)**: ชั้นแสดงผลของ starter (`@medusajs/ui-preset`, shim `common/components/ui`,
`@headlessui/react`, `@medusajs/icons`) ถูกแทนด้วย shadcn/ui (Radix) บน Tailwind v4; ชั้น commerce ของ starter (route, data layer, JS SDK, caching, Stripe Elements) คงเดิม
และการรับ upstream ต่อไปจำกัดที่ชั้น data/logic

## บริบท
ก่อนหน้านี้เจ้าของโปรเจกต์เคยพิจารณาทำ storefront ด้วย Ant Design เอง แต่เป้าหมาย "ไม่สร้างสิ่งที่ Medusa มีอยู่แล้ว"
ใช้กับ storefront ด้วย: starter มี PLP/PDP/cart/checkout
(รวม Stripe Elements)/account/orders ครบแล้ว โดยใช้ JS SDK ของ Medusa และ convention เรื่อง caching

## ทางเลือก
1. Medusa Next.js Starter ปรับธีมใหม่ (Tailwind tokens) และต่อยอดด้วยหน้าใหม่
2. สร้างแอป Next.js ใหม่ด้วย Ant Design และเขียนหน้า commerce ทั้งหมดใหม่

## การตัดสินใจ
เลือกทางเลือกที่ 1 หน้าฟีเจอร์ใหม่ (flash banner, หน้ากลุ่ม, affiliate dashboard, voucher ของฉัน)
เพิ่มเป็น route ภายใน starter โดยใช้ data-fetching helper ของ starter เอง

## ผลที่ตามมา
+ ประหยัดเวลาหลายสัปดาห์; edge case ของ checkout (3DS, ที่อยู่, regions) ถูกจัดการไว้แล้ว
− อัตลักษณ์ด้านภาพถูกจำกัดอยู่กับการทำธีมด้วย Tailwind; ไม่ใช้ Ant Design
− การอัปเกรด starter ต้อง merge การเปลี่ยนแปลงจาก upstream เป็นครั้งคราว
