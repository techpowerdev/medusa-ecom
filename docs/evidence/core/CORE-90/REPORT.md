# REPORT — CORE-90 (PR #525) a11y ปุ่มสลับฟอร์ม login/register + ลิงก์ไม่ซ้อน `<button>`

spec: `docs/spec/01-core-medusa.md` หัวข้อ "Follow-up รอบ 42" · AC-187
ทดสอบโดย qa บน prod build ทั้ง backend และ storefront · viewport 375×812, 1280×800, 320×640 · 6/6 ผ่าน · เทียบกับ develop `59c6af18` ด้วย spec เดียวกัน
Playwright report และ trace ฉบับเต็ม: CI artifact ของ PR #525

| AC / checklist | ผล | Evidence |
|---|---|---|
| AC-187 (a) `login-to-register-button` สูง ≥ 44px กดแล้วไปฟอร์มสมัคร (375/1280/320) | pass | `01-login-to-register-375.png` — สูง 20→44px ทุก viewport, Enter แล้วไป `register-page` |
| AC-187 (a) `register-to-login-button` สูง ≥ 44px กดแล้วกลับ login, `type="button"` ไม่ submit ฟอร์ม | pass | `02-register-to-login-375.png` — สูง 20→44px, ไม่มี `register-error` |
| AC-187 (a) testid ไม่ซ้ำ: หน้า login มี `register-button` 0 ตัว (develop 1), หน้า register 1 ตัว (ปุ่ม submit) | pass | ผล test ของ qa (ซ้ำที่เหลือ `category-link`×2 มีบน develop อยู่แล้ว ไม่เกี่ยวกับ PR) |
| AC-187 (b) Tab หยุดครั้งเดียวพร้อมกรอบ focus: `group-order-pay-link`, `checkout-button`, `go-to-cart-button` (1280), `hero-cta`, `continue-shopping-button`, `order-details-link` | pass | `03-cart-checkout-focus-375.png` — Tab stop 2→1 ทุกลิงก์, ring 2px ผ่าน `:focus-visible`; Enter บน `group-order-pay-link` ไปหน้า `/pay` |
| AC-187 (b) static: ไม่มี `<Button` เป็นลูกตรงของ `LocalizedClientLink` | pass | `core-90-link-button.unit.spec.ts` 5/5 |
| หน้าตาเหมือนก่อนแก้ (เทียบ develop) | pass | กว้าง/สูง/สี/พื้นหลัง/ขอบ/font/radius เท่ากันทุกค่า; `checkout-button` เต็มแถว (327/360px), `go-to-cart-button` 386px เท่าเดิม |
| ข้อความไทยครบ, 320px ไม่ล้นแนวนอน | pass | regex อักษรไทยผ่าน ไม่มีคำละตินในฟอร์ม login/register |
| ตะกร้า `sign-in-button` | N/A | เปิดจากมุมผู้ใช้ไม่ได้ (cart ไม่มี customer ถูกล้างตามกติกา no-guest; develop ก็เปิดไม่ได้) — ตรวจด้วย unit static แทน |
| `promptpay-go-to-cart` (PromptPay refunded) | ข้าม | ต้องใช้ Stripe test key — ดูผล CI `pay-15-promptpay-go-to-cart.spec.ts` |

**Edge case**: กดปุ่มสลับด้วย Enter ได้ ไม่ submit ฟอร์ม; jwt ไม่ถูกต้อง → หน้าตะกร้าไม่แสดง cart ของคนอื่น ไม่มี error
**Defect**: ไม่มี
**Nit (ไม่ block)**: ปุ่มสลับมี `px-2` ทำให้ "." ท้ายประโยคแยกจากคำ (เห็นในรูป 01) · (นอก PR) `nav-cart-link` (`<a>`) อยู่ใน `PopoverButton` (`<button>`) ของ `cart-dropdown`
