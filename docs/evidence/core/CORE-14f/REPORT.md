# QA REPORT — CORE-14f (PR #150)

spec: `docs/spec/01-core-medusa.md` กฎข้อ 65, AC-101 (+ regression AC-92, AC-93) · commit `fafe81d`
สภาพแวดล้อม: prod build (`medusa build/start` + `next build/start`) ข้อมูลจาก seed (CORE-2) และใช้ Stripe key ปลอม
Playwright report/trace ฉบับเต็ม: CI artifact ของ run https://github.com/techpowerdev/medusa-ecom/actions/runs/40503378982 (เก็บ 14 วัน)
ผล: e2e ของ PR (`core-14f` + `core-14d`) 9/9, e2e ของ QA (ในเครื่อง ไม่ได้ commit) 15/15, Vitest 29/29

| AC | Result | Evidence |
|----|--------|----------|
| AC-101 (a) ล็อกอินอยู่และ cart มี V qty 2 แล้วเปิด `/th/account?add_variant=V&add_quantity=1` → `add-variant-in-cart-qty` = 2 เป็นข้อความไทย ไม่มี "ยังไม่ได้อยู่ในตะกร้า" (JS เปิดและปิด) | pass | qa-01-pending-card-in-cart-qty2-nojs.png; e2e `core-14f-pending-card.spec.ts` |
| AC-101 cart ว่าง → การ์ดไม่มี `add-variant-in-cart-qty` และใช้ข้อความ "เพิ่มสินค้านี้ลงตะกร้า?" (JS on/off) | pass | e2e ของ QA |
| AC-101 (b) ส่งฟอร์ม `add-variant-confirm` ที่แก้ `country_code` เป็น `zz`, `/evil.example`, `//evil.example`, `https://evil.example` (ปิด JS) → 303→307→200 ไม่มี 5xx อยู่ในโดเมนร้านที่ `/th/account` เห็น `add-variant-error` ภาษาไทย cart ไม่เปลี่ยน | pass | qa-02-tampered-country-zz-error-nojs.png |
| AC-101 (c) เปิด `/zz/account?add_variant=V` (ล็อกอินและไม่ล็อกอิน, JS on/off) → 307 → `/th/zz/account?…` 404 หน้าไทย ไม่มี 5xx URL ขึ้นต้น `/th/` | pass | e2e ของ QA + ของ builder |
| กฎ 65: กด Back หลัง confirm ไป `/th/cart` → การ์ดแสดง `add-variant-in-cart-qty` = 2 และ cart ยัง qty 2 (JS on/off) | pass | e2e ของ QA |
| AC-92 regression (no-JS login → `/th/cart` qty 2 ไม่มี skeleton, variant ถูกลบระหว่างทาง → `add-variant-error`, D-1 กด Back ไม่เพิ่มซ้ำ) | pass | e2e `core-14d-cart-after-login.spec.ts` |
| AC-93 regression (a)(b) JS on/off, (c) no-JS | pass | e2e `core-14d-cart-after-login.spec.ts` + e2e ของ QA |

## Negative/edge case (นอก spec)
| กรณี | ผลลัพธ์ |
|------|---------|
| ลบ hidden `add_variant` ออกจากฟอร์มแล้ว submit | 303→307→`/th/account` 200 ไม่มี 5xx |
| `country_code` = `TH` (ตัวใหญ่) หรือว่าง | ไม่มี 5xx อยู่ที่ `/th/account` เห็น `add-variant-error` |
| `add_quantity` = 999 / -5 / abc | การ์ดแสดง 100 / 1 / 1 ชิ้น; confirm ที่ 999 → cart qty 100 (clamp ทำงาน) |
| submit พร้อมกันจาก 2 แท็บ ขณะ cart ว่าง | ได้ cart 2 ใบ ใบละ qty 1 — O-2 เดิม spec เลื่อนไป CORE-14e |

## ข้อสังเกต (ไม่ใช่ defect ตาม AC)
- O-1: `/zz/account?add_variant=V` ไปจบที่ 404 `/th/zz/account` ทำให้รายการที่ค้างไว้หาย ตรงตาม AC (<500, URL ขึ้นต้น `/th/`) มาจาก middleware เดิม
- O-2: ข้อความ error เมื่อแก้ `country_code` ยังเป็น "สินค้าที่เลือกอาจไม่มีอยู่ หมดแล้ว หรือมีไม่พอ…" ไม่ตรงสาเหตุจริง ความรุนแรงต่ำ (เกิดเฉพาะเมื่อแก้ฟอร์มเอง)

## Defect
ไม่พบ
