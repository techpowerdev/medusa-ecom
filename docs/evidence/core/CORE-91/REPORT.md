# REPORT — CORE-91 (PR #539) dropdown ตะกร้าไม่บอกว่าว่างระหว่างโหลด/ล้ม + ไม่อ่าน cart ซ้ำ

spec: `docs/spec/01-core-medusa.md` หัวข้อ "Follow-up รอบ 42" · กฎข้อ 147 · AC-188
ทดสอบโดย qa บน prod build ของ branch `feat/CORE-91-cart-dropdown-loading` (`d17499d8`) · build ยืนยันว่า `/[countryCode]` เป็นหน้า static และ nav อ่าน cart ใน browser จริง
QA spec (ไม่ commit) 12 passed + edge E1 · e2e ของ builder `core-91-cart-dropdown-known.spec.ts` 5/5

| AC / checklist | ผล | Evidence |
|----|----|----------|
| AC-188 หน่วงการอ่าน cart บน `/th` แล้ว hover: `nav-cart-dropdown-loading` "กำลังโหลดตะกร้า…" ไม่มี "ตะกร้าของคุณยังว่างอยู่" ป้าย "ตะกร้า" + `aria-busy`; ปล่อยแล้ว "ตะกร้า (1)" | pass | `qa-c1-dropdown-loading.png` |
| AC-188 การอ่าน cart ล้ม (mock 500): `nav-cart-dropdown-error` "ยังโหลดตะกร้าไม่ได้" + ลิงก์เดียว "ดูตะกร้า" → `/th/cart` ไม่มี `aria-busy` ไม่มีข้อความตะกร้าว่าง | pass | `qa-c2-dropdown-error.png` |
| AC-188 ไม่มี cart บน `/th` และ `/th/account`: "ตะกร้า (0)" + dropdown ข้อความตะกร้าว่าง | pass | `qa-c3-account-empty.png` |
| AC-188 `/th/account` มีและไม่มี cart: nav ไม่ยิง `retrieveCart` ตอน mount (0 ครั้ง); มี cart → "ตะกร้า (2)" + `cart-item` 1 แถว (บน `/th` static อ่าน 1 ครั้งตามที่ควร) | pass | QA spec |
| เพิ่มสินค้าจาก PDP → "ตะกร้า (1)" dropdown เปิดพร้อม 1 รายการ; `/th/account` ที่ server ส่ง null แล้วยิง `medusa:cart-updated` → อ่าน 1 ครั้ง "ตะกร้า (1)" | pass | QA spec |
| ข้อความใหม่ผ่าน regex อักษรไทย; Tab จาก `nav-cart-link` ครั้งเดียวถึง "ดูตะกร้า" แล้ว Enter ไป `/th/cart` | pass | QA spec |
| 375: `nav-cart-link` มองเห็น ไม่ค้าง `aria-busy` ตอนอ่านล้ม (dropdown ซ่อนด้วย `hidden small:block` เดิม) | pass | QA spec |
| cookie ชี้ cart ที่ถูกลบ บน `/th` และ `/th/account`: "ตะกร้า (0)" + ข้อความว่าง ไม่ค้าง loading/error | pass | QA spec |
| cookie ชี้ cart ที่ complete แล้ว: ไม่ค้าง แต่ยังแสดงรายการของ cart เก่า (พฤติกรรมเดิม — `placeOrder` ลบ cookie ใน flow จริง) | pass | QA spec |

## Defect ที่มีอยู่แล้วบน develop (ไม่ได้มาจาก PR นี้ — ส่ง follow-up)
**D-1** backend อ่าน cart ไม่ได้จริง (ปิด backend) → nav ขึ้น "ตะกร้า (0)" + "ตะกร้าของคุณยังว่างอยู่"
สาเหตุ: `retrieveCart` (`src/lib/data/cart.ts` ~`:79`) `.catch(() => null)` ทำให้ fetch ที่ล้มกลายเป็น "ไม่มี cart" server action จึงตอบ 200 — mock 500 ของ AC-188 ครอบเฉพาะกรณี server action ล้มเอง
