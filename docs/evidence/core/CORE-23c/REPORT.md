# Evidence: CORE-23c — ฟอร์มที่อยู่/โปรไฟล์ใน account (QA PR #214)

- Spec: `docs/spec/01-core-medusa.md` — AC-112
- PR: #214 — branch `fix/CORE-23c-account-forms` @350a72d
- สภาพแวดล้อม: backend `medusa develop`, storefront prod build, node 24.12.0; ลูกค้า login; หา element ด้วย `data-testid`; ไม่ใช้ Stripe (ไม่เกี่ยวกับ feature)
- ผล: e2e ของ builder (`core-23c-account-forms.spec.ts`) 5/5; spec ของ qa ผ่าน 6 ล้ม 4 (ทั้ง 4 คือ D-1/D-2 ซึ่งอยู่นอก AC-112 และมีอยู่ก่อน PR)
- รูป: `01`, `02` จาก builder + `01-cancel-error-not-cleared`, `03`, `05` จาก qa (รวม 5 รูป)

## ผลตาม AC

| AC / การตรวจ | ผล | หลักฐาน |
|----|----|---------|
| AC-112 (a) เพิ่ม/แก้ที่อยู่ล้ม 500 หรือ network → ค่ายังอยู่ + error ไทย | pass | `01-add-address-failed-keeps-values.png` (builder), qa QA-3/QA-3b |
| AC-112 (b) ที่อยู่ใบเสร็จล้ม → error ไทยในฟอร์ม ไม่เข้า error boundary; กดซ้ำจนสำเร็จ → `is_default_billing=true` 1 รายการ (ทั้งสร้างใหม่และแก้ id เดิม) | pass | `02-billing-network-failed-inline-error.png` (builder), `03-billing-retry-success-default.png` |
| AC-112 (c) กด "แก้ไข" แล้วพิมพ์ทันทีตัวอักษรไม่หาย (ชื่อ, เบอร์, ที่อยู่ใบเสร็จ) | pass | e2e QA-1 |
| AC-112 (d) ลิงก์ "บริการลูกค้า" → `/th/contact` 200, h1 ไทย, ไม่มี 404 ใต้ `/th/` | pass | e2e QA-5 + test ที่ 5 ของ builder |
| AC-112 (e) unit `console.error` ใน `customer.ts` | pass | `docs/evidence/core/CORE-23c-tests.txt` |
| QA: "ยกเลิก" → ค่ากลับเป็นค่าเดิม | pass | e2e QA-1 |
| QA: modal ที่อยู่ — error ใต้ช่องสุดท้ายเหนือปุ่มบันทึก, ปุ่ม disable ระหว่างส่ง, dblclick → POST 1 ครั้ง ไม่มีที่อยู่ซ้ำ | pass | e2e QA-3/QA-3b |
| QA: 375px modal ไม่ล้น (scrollWidth 341 = clientWidth, หน้า 375) | pass | `05-add-address-modal-375.png` |
| edge: บันทึกชื่อสำเร็จแล้วกดแก้ไขใหม่ → success ถูกล้าง | pass | e2e QA-1b |
| QA: "ยกเลิก" → error ถูกล้าง | fail (D-1 — นอก AC-112, มีก่อน PR) | `01-cancel-error-not-cleared.png` |
| edge: ปิด modal เพิ่มที่อยู่หลังล้มแล้วเปิดใหม่ → error เก่ายังค้าง | fail (D-2 — นอก spec) | e2e QA-3c |

## Defect (นอก AC-112 → follow-up แยก ไม่บล็อก PR นี้)
- **D-1:** editor ชื่อ/เบอร์/ที่อยู่ใบเสร็จ — บันทึกล้ม → error ไทย → "ยกเลิก" → panel ปิด ค่ากลับเดิม แต่ `error-message` ยังค้าง (`opacity: 1`) สาเหตุ: `clearState` ล้างแค่ `successState` ส่วน `state.error` ของ `useActionState` ไม่ถูกล้าง (reviewer #214 ยืนยันว่ามีอยู่บน develop ก่อน PR)
- **D-2:** modal เพิ่มที่อยู่ — บันทึกล้ม → "ยกเลิก" → เปิดใหม่ → `address-error` เก่ายังแสดง เพราะ `close()` ไม่ล้าง `formState`

## หมายเหตุ
- QA-1 editor ชื่อ: `pressSequentially` พิมพ์แทรกที่ต้นช่องเพราะตำแหน่ง caret ไม่ใช่ตัวอักษรหาย
- footer ของ starter ไม่ล้นในหน้า addresses ที่ 375px
