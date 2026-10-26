# QA CORE-14a — PR #81

ทดสอบที่ commit `019f304` | Playwright chromium desktop 1280x720, workers=1 | หา element ด้วย `data-testid` เท่านั้น
Playwright report และ trace ฉบับเต็ม: CI artifact ของ PR #81 (เก็บ 14 วัน)

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-41 `/buy/<variant>:2` ไม่ล็อกอิน → `/th/account?return_to=/buy/...` เห็น `login-page` และไม่สร้าง cart | ผ่าน | `ac41-buy-guest-login-page.png` |
| AC-41 ล็อกอินผ่าน `sign-in-button` → `/th/checkout`, cart มี `customer_id` ของผู้ล็อกอิน จำนวน 2 (ตรวจใน DB) | ผ่าน | `ac41-login-checkout-qty2.png` |
| AC-41 สมัครผ่าน `register-button` → `/th/checkout`, cart เป็นของลูกค้าใหม่ จำนวน 2 | ผ่าน | `ac41-register-checkout-qty2.png` |
| AC-41 ล็อกอินอยู่แล้ว GET `/buy` → 303 ไป `/th/checkout` | ผ่าน | `core-14-buy-login.spec.ts` |
| AC-42 `/ucp/v1` → 307 ไป `/th/ucp/v1` แล้วจบที่ 404; POST `/ucp/v1/cart` จบที่ 404; `/.well-known/ucp` → 404; `/th/cart/resume/x` → 404; หน้า `/th` ไม่มี header `Link` rel=ucp | ผ่าน | ผล test |
| AC-56 `/th/order/x/transfer/y`, `/accept`, `/decline` → 404 (หน้า 404 ภาษาไทย) | ผ่าน | `ac56-order-transfer-404.png` |
| AC-56 `/th/account/orders` ไม่มี element transfer และไม่มี `<form>` | ผ่าน | ผล test |
| AC-43 มีแค่ cookie `_medusa_cart_id` ไม่มี jwt → `/th/cart` 200 แสดง `empty-cart-message` และ cookie ถูกล้าง | ผ่าน | `ac43-stale-cookie-empty-cart.png` |
| AC-44, AC-45 | อยู่ใน CORE-14b | — |

## Negative / edge case
| กรณี | ผล |
|------|----|
| `return_to` = `https://evil.com`, `//evil.com`, `/\evil.com`, `/buy/../../evil`, `javascript:alert(1)`, `/buy/x:1?next=https://evil.com` แล้วล็อกอิน | อยู่ในเว็บ (`/th/account`) ไม่ redirect ออกนอก |
| `/buy/<v>:101`, `:0`, `:-1`, `/buy/%2F%2Fevil.com` (ไม่ล็อกอิน) | 400 |
| `/buy/variant_nope:1` (ไม่ล็อกอิน) | 303 ไป login (ตรวจ variant หลังล็อกอิน) |
| ล็อกอินแล้ว `/buy/<v>:101` / variant ไม่มีอยู่ | 400 / 404 ไม่สร้าง cart |
| มี jwt ของ A แต่ cookie cart เป็นของ B → `/th/cart` | 200, cart ว่าง, cart ของ B ไม่ถูกแตะ |
| cookie cart ของ B แล้ว A ล็อกอินผ่าน `/buy` | ได้ cart ใหม่ของ A จำนวน 2 ไป checkout |
| cookie cart ของ B แล้ว A ล็อกอินแบบปกติ | ไม่มี error, `/th/cart` ว่าง |
| ดับเบิลคลิก `sign-in-button` จาก `/buy` | ได้ cart เดียว |
| ล็อกอินแล้วยิง GET `/buy` พร้อมกัน 2 ครั้ง | ได้ cart 2 ใบ — permalink สร้าง cart ใหม่ทุกครั้งตามออกแบบ (ข้อสังเกต ไม่ใช่ defect) |

## Defect
ไม่พบใน scope ของ CORE-14a

## ข้อสังเกตนอก scope
- ข้อความอังกฤษในหน้าสมัครและ checkout อยู่ในขอบเขต CORE-4c / CORE-4d
