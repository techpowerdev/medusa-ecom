# QA ปลาย stack รอบ 50 (SFUI-19a..22) — browser จริง

ตรวจที่ `155bd309` (ฐาน develop `c0310565`) แล้ว checkout ไป `847cd3ed` (แก้ `BUTTON_SELECTOR` ของ `sfui-19-button-size.spec.ts` ตาม review SFUI-22) แล้วรัน spec นั้นซ้ำบน server เดิม
prod build (backend `NODE_ENV=production` จาก `.medusa/server` :9511, storefront `next start` :8511), Stripe test mode + `stripe listen` (events ชุดเดียวกับ CI), viewport 1280×800 และ 390×844 (touch)

## ผลการรัน
| ชุด | ผล |
|---|---|
| e2e รอบ 50: `sfui-19-button-size`, `sfui-19c-search-pagination`, `sfui-19d-refinements`, `sfui-20-address`, `sfui-21-heading`, `sfui-21-forms`, `sfui-21c-choice-card`, `sfui-21d-alert`, `sfui-21e-action-errors`, `sfui-3d-payment`, `payments` | 39 passed |
| `sfui-19-button-size.spec.ts` ที่ `847cd3ed` | 5 passed |
| unit project (`test:e2e:unit`) ที่ `155bd309` และ `847cd3ed` | 274 passed ทั้งสองครั้ง |
| Vitest | 2089 passed (140 ไฟล์) |
| spec ที่เกี่ยวข้องเพิ่ม: `core-79`, `core-90`, `sfui-3b-sheet`, `sfui-3c-select`, `core-4e`, `core-19c` | 15 passed |
| crawl วัด computed style 135 หน้า×ขนาดจอ (ชุดหน้าเดียวกับ audit ก่อนรอบ + หน้าจ่าย order ค้างจ่าย + PDP มือถือ) | ปุ่มที่อยู่นอกรายการกฎ 79 และไม่ใช่ 36px = 0/95 (ก่อนรอบ 39/57) |

## ตาราง AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-55 | pass | unit project 274 passed (`sfui-19-button-size.unit.spec.ts`) |
| AC-56 | pass | `sfui-19-button-size` passed; crawl: ทุกปุ่ม 36px รวม `order-pay-card-button`/`order-pay-promptpay-button`, `mobile-*` (03-payment-choice-card-pay-36px-390.png) |
| AC-57 | pass | `sfui-3d-payment` + 3DS + พร้อมเพย์ passed; แตะปุ่มด้วย touch ทันทีหลังกรอกบัตรที่ 390 → `elementFromPoint` = ปุ่ม → review → สั่งซื้อสำเร็จ (03-payment-choice-card-pay-36px-390.png) |
| AC-58 | pass | `core-79`, `core-90` passed; ลิงก์สลับ 36px `data-variant="link"` (04-login-toggle-link-36px-390.png) |
| AC-59 | pass | `sfui-19-button-size` AC-59 passed; `logout-button`/`affiliate-logout` ghost 36px |
| AC-60 | pass | `sfui-19c-search-pagination` passed; pagination ของ shadcn (01-store-toggle-pagination-checkbox-1280.png) |
| AC-61 | pass | `sfui-19d-refinements` passed; chip = toggle-group-item 36px, checkbox 16×16 (01-store-toggle-pagination-checkbox-1280.png) |
| AC-62 | pass | `sfui-20-address` passed; จังหวัดว่าง → `state-input-error` + focus (02-add-address-no-country-province-required-1280.png) |
| AC-63 | pass | `sfui-20-address` passed (hidden `country_code=th`, API `th`, trigger ของ `shipping-address-select` แสดงที่อยู่ทั้งก่อน/หลัง reload); modal ไม่มีช่องประเทศ (02-add-address-no-country-province-required-1280.png) |
| AC-64 | pass | `sfui-20-address`, `sfui-3b`, `sfui-3c` passed; สรุป review ที่ 390 ไม่มี TH/Thailand/ประเทศไทย; เมนูข้างไม่มี `country-select-button` |
| AC-65 | pass | `sfui-21-heading` passed; crawl h1 32px/600/48px ทุกหน้า (ยกเว้น hero) |
| AC-66 | pass | `sfui-21-forms` passed; crawl: row/column gap 16px ใน profile/address/login/register — ดูข้อสังเกต D1 (affiliate) |
| AC-67 | pass | unit guard `<button` passed; `sfui-19-button-size` passed ทั้งที่ `155bd309` และ `847cd3ed` |
| AC-68 | reviewer | diff backend/`package.json`/lockfile ว่าง; ไม่มี `text-rose-`/`contrast-btn` ใน `src` |
| AC-69 | pass | `sfui-21c-choice-card` passed; ที่ 390 แตะข้อความฝั่งซ้ายของการ์ด (ห่างวงกลม 285px) → `aria-checked="true"` ทั้งการ์ดจัดส่งและการ์ดชำระเงิน; iframe ไม่อยู่ใน `<label>` |
| AC-70 | pass | `sfui-21d-alert` + `core-19c` passed; `cart-item-remove-error` เป็น FieldError 14px (05-cart-remove-error-nudge-overflow-375.png) |
| AC-71 | pass | `sfui-21e-action-errors` passed; `cart-error-notice` root สีเท่า body, AlertDescription เป็น muted-foreground (ตั้งใจ) |

## ข้อที่ reviewer ขอให้ตรวจด้วยมือ
- แตะปุ่มจ่ายเงินทันทีหลังกรอกบัตร (390 touch): ไม่ตกไป iframe — pass
- แตะการ์ด Choice Card ทั้งใบ (390): เลือกได้ — pass
- ปุ่มปิดกล่องค่าส่งฟรี: Button icon 36px สีดำ (หน้าตาเปลี่ยนตั้งใจ) — ok
- คอลัมน์จำนวนในตะกร้ากว้างขึ้นตอนลบไม่สำเร็จที่ 1280 — ตั้งใจ, ok
- `cart-error-notice` ข้อความ muted-foreground — ตั้งใจ, ok
- ลิงก์สลับ login/สมัคร: 36px กึ่งกลางบรรทัด แต่ช่องว่างในประโยคแปลก (ดู "ควรพิจารณา" ข้อ 2)
- ปุ่มออกจากระบบในเมนูมือถือ: เยื้อง (ดู "ควรพิจารณา" ข้อ 1)

## Defect (ไม่ทำให้ AC ล้ม)
- D1: ฟอร์ม login/สมัครของ affiliate (`affiliate/components/auth-forms/index.tsx:20,40` `gap-y-2`) gap 8px ขณะที่ login ลูกค้า 16px — กฎ 73 ระบุ "ทุกฟอร์มใน inventory รอบ 48" (รวม 12c) แต่ inventory ข้อ 32 ไม่มีไฟล์นี้ → planner ตัดสิน
- D2 (มีก่อนรอบ): popup ค่าส่งฟรี `w-[400px]` ล้นจอที่ 375/390 ข้อความและปุ่มถูกตัดซ้าย (05-cart-remove-error-nudge-overflow-375.png)
- D3: ลิงก์ "ดูตะกร้าสินค้า"/"ดูสินค้า" ใน popup เดียวกันเป็นปุ่มเขียนเอง (~44px, `rounded-2xl`, `outline-hidden` ไม่มี focus ring) — AC-67 ไม่จับเพราะไม่มี `data-variant`

## ควรพิจารณา
1. ปุ่ม ghost/link มี `px-4` ทำให้ข้อความเยื้องจากแนวคอลัมน์: "ออกจากระบบ" ในเมนูบัญชีมือถือ (ข้อความ x=72 ขณะ icon ของรายการอื่น x=56 และข้อความ x=84; desktop ก็เยื้อง 16px), "แก้ไข" และ "เพิ่มโค้ดส่วนลด" ใน checkout/ตะกร้า — แก้ได้ด้วย `-ml-4`/`-mr-4` (กฎ 59 อนุญาต)
2. ลิงก์ "สมัครสมาชิก" ในประโยค: ลิงก์ 14px แต่ประโยค 12px และ padding 16px ทั้งสองข้างทำให้จุด "." ลอย (04-login-toggle-link-36px-390.png)
3. icon `size-[15px]` เหลือ 2 จุด (`order-details-template.tsx:34`, `layout/components/search/index.tsx:144`)
4. "จำนวน: 1" ใน cart dropdown ยังใหญ่กว่าข้อความ variant
5. หน้า account overview/ตะกร้า/checkout/คืนสินค้า ไม่มี h1 (นอกขอบเขตกฎ 77)

## ภาพ
- 01-store-toggle-pagination-checkbox-1280.png — store: chip toggle-group, checkbox 16px, InputGroup ค้นหา, pagination ของ shadcn
- 02-add-address-no-country-province-required-1280.png — modal เพิ่มที่อยู่: ไม่มีช่องประเทศ, จังหวัด `*` + error ใต้ช่อง, gap 16px, ปุ่มปิด icon
- 03-payment-choice-card-pay-36px-390.png — Choice Card ชำระเงิน + ปุ่มไปขั้นตรวจสอบ 36px หลังกรอกบัตร (touch)
- 04-login-toggle-link-36px-390.png — ลิงก์สลับสมัครสมาชิก `variant="link"` 36px
- 05-cart-remove-error-nudge-overflow-375.png — FieldError ลบไม่สำเร็จในแถวตะกร้า + popup ค่าส่งฟรีล้นจอ (D2)

Playwright report และ trace ฉบับเต็มอยู่ใน CI artifact (14 วัน)
