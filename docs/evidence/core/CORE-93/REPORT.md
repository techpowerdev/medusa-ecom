# REPORT — CORE-93 (PR #533) chip ป้ายกำกับบน `/th/store` และหัว option ไม่มีตัวเลข

spec: `docs/spec/01-core-medusa.md` หัวข้อ "Follow-up รอบ 42" · กฎข้อ 149 · AC-190 (ฉบับแก้ตาม owner Q-C17 = ก 2026-11-24)
ทดสอบโดย qa บน prod build (backend production + `next start`) PR head `1d243cab` · ค้นหาผ่าน `@medusajs/search-postgres` (index ใน DB ของ run)
ข้อมูลชุดใหม่ต่อรอบ: tag ชื่อยาว 80 code point, สินค้า 2 ชิ้น option "ขนาด" F/L ราคา 900/300 (ชิ้นแรกลดเหลือ 700 ผ่าน price list sale), collection และ category ของ run
e2e ของ PR `core-93-label-chip.spec.ts` + regression `core-87-facet-heading.spec.ts` 2/2 · unit `core-93-options-picker-heading.test.ts` 2/2 · QA spec (ไม่ commit) 5/5

| AC / checklist | ผล | Evidence |
|----|----|----------|
| AC-190 (b) chip "ป้ายกำกับ: …" ของ tag 80 ตัว: บรรทัดเดียว, `text-overflow: ellipsis`, ถูกตัด (scrollWidth > clientWidth), `title` = "ป้ายกำกับ: <ชื่อเต็ม>", ไม่ล้นขอบ `ul`/viewport, ไม่มี horizontal scroll ที่ 1280/375/320 | pass | `01-store-1280-long-label-chip.png`, `02-store-375-chips-long-and-short.png`, `03-store-320-chips.png` |
| กด chip ป้ายกำกับ → ตัวกรองหาย (URL ไม่มี `[labels]`) chip อื่นยังอยู่; "ล้างทั้งหมด" ล้างจนเหลือ `/th/store` (3 ขนาด) | pass | QA spec |
| chip ชื่อสั้น "ขนาด: F", "ลดราคา" แสดงเต็ม บรรทัดเดียว `title` = ข้อความ | pass | `02-store-375-chips-long-and-short.png`, `03-store-320-chips.png` |
| AC-190 (a) + regression CORE-87: หัว facet "ขนาด" บน `/store` ไม่มีตัวเลข/วงเล็บ ทั้งก่อนและหลังเลือกค่า | pass | `01-store-1280-long-label-chip.png`; unit core-93 2/2; e2e core-87 1/1 |
| `/th/collections/<handle>`, `/th/categories/<handle>` ไม่มี "ตัวเลือกสินค้า"; เรียงราคา ต่ำ→สูง [300, 700], สูง→ต่ำ [700, 300] | pass | QA spec |

ตรวจภาษาไทยด้วย regex อักษรไทยบนข้อความ chip · หา element ด้วย `data-testid`

**Defect**: ไม่มี
**ข้อสังเกตนอก scope**: ติ๊ก "เฉพาะสินค้าลดราคา" แล้วตัวเลขข้าง toggle เป็น "(2)" ทั้งที่ผลจริง 1 ชิ้น (เห็นในรูป 02/03) — น่าจะมาจาก `useToggleRefinement` ให้ `value.count` ของสถานะตอนติ๊กออก
