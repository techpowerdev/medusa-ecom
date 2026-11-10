# รายงาน QA — CORE-23b (PR #154)

Spec: `docs/spec/01-core-medusa.md` กฎข้อ 61, AC-97 (+ regression AC-88 และหน้า account) · head `bc1f5dc` · prod build (`medusa start` + `next start`) · Stripe key ปลอม
CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/40508858492 (Playwright report/trace ฉบับเต็มเป็น artifact ของ run นี้ เก็บ 14 วัน)
ผล: e2e ของ PR + regression account 11/11, e2e:unit 30 passed, QA spec (ในเครื่อง ไม่ได้ commit) 21/22 — ตัวที่ล้มคือ D1 ซึ่งเป็นบั๊กเดิมของ develop

| AC | Result | Evidence |
|----|--------|----------|
| AC-97 คลิกเมนู (orders/ที่อยู่/โปรไฟล์) desktop 1280 หน่วง RSC 2 วินาที → `account-nav-pending` ขึ้นเฉพาะใน link ที่คลิก (1 ตัว) ก่อนหน้าใหม่แสดง แล้วหายไป | pass | qa-01-desktop-nav-pending.png, 01-account-nav-pending.png |
| AC-97 mobile 375 คลิกเมนูในรายการ → spinner อยู่ข้างชื่อเมนู layout ไม่เพี้ยน (ความสูง link 57px เท่าเดิม, `scrollWidth`=375) | pass | qa-02-mobile375-nav-pending.png |
| AC-97 บันทึกเบอร์ล้ม (mock 500) → error ไทย, panel ยังเปิด, `phone-input` เป็นค่าที่พิมพ์ | pass | 02-phone-save-failed-keeps-value.png |
| กฎข้อ 61 ชื่อ/เบอร์/ที่อยู่ใบเสร็จ บันทึกล้มเพราะลบ cookie `_medusa_jwt` → error ไทย ค่าที่พิมพ์ไม่หาย (บน develop ค่าหายทั้ง 3 ฟอร์ม) | pass | qa-03-billing-save-failed-keeps-value.png |
| AC-97 e2e ของ AC-88 ไม่มี `if (await x.isVisible())` (grep spec) | pass | `core-23b-no-conditional-expect.unit.spec.ts` |
| AC-88 (regression) token หาย → ข้อความไทย ไม่มี `Minified React error` | pass | e2e `core-23-profile-order.spec.ts` |
| regression หน้า account (AC-48, AC-82..AC-87) | pass | e2e 11/11 ของ core-22, core-23, thai-ui-account, core-23b |

## Checklist ของ PR
- บันทึกสำเร็จ (ชื่อ/เบอร์/ที่อยู่) → panel ปิด ค่าใหม่แสดงทั้งก่อนและหลัง reload และตรงกับ backend: pass
- ระหว่างส่ง ปุ่มบันทึก disabled/loading, dblclick หรือคลิกซ้ำ 3 ครั้งระหว่างส่ง → POST server action 1 ครั้ง (ที่อยู่ใบเสร็จถูกสร้าง 1 รายการ): pass
- กด ยกเลิก หลังพิมพ์ → ค่ากลับเป็นค่าเดิม (ทั้ง 3 ฟอร์ม และกรณีกดหลังบันทึกล้ม): pass
- บันทึกล้มแล้วบันทึกใหม่สำเร็จ → ค่าใหม่ถูกบันทึก: pass

## Negative/edge case เพิ่มเติม
- ปิด JS: บันทึกไม่ได้ทั้งบน develop และบน PR (ปุ่ม แก้ไข ต้องใช้ JS และ panel เป็น `inert`) ผู้ใช้เห็นเหมือนเดิม ต่างกันแค่ markup: ฟอร์มบน PR ไม่มี `action`/`method` — ถ้าวันหน้าทำให้ editor เปิดได้โดยไม่ใช้ JS ต้องกลับมาดู
- D1 (บั๊กเดิมของ develop ไม่ได้เกิดจาก PR นี้): ฟอร์มที่อยู่ใบเสร็จเมื่อ server action ตอบ 500 ที่ชั้น network ทั้งหน้ากลายเป็น "This page couldn't load" เพราะไม่มีตัวครอบ try/catch แบบฟอร์มชื่อ/เบอร์ — เปิดเป็น task ใหม่
- D2 (ข้อสังเกตเดิมจาก CORE-22): พิมพ์ทันทีที่กด แก้ไข (ภายใน 1 frame) ค่าหายเพราะ panel ยังเป็น `inert`
