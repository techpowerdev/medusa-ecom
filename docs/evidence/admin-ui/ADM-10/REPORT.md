# QA ADM-10 — PR #315 (offset ใน URL ผ่าน `pageOffset`/`clampOffset` + `usePageOffset`)

- Spec: `docs/spec/08-admin-ui-medusa-components.md` แถว ADM-10, AC-14, กฎ 13; regression AC-7
- Commit: `717470d574b092f53c68490d14e24cc25fc464b9` · prod build (`medusa build` + `medusa start` จาก `.medusa/server`) · Stripe key ปลอม
- ผล test: e2e ของ QA 8/8, regression 8/8 (`evoucher-admin-pool-page`, `group-buy-admin-pages`, `evoucher-admin-partners`, `affiliate-admin-tables`), unit `page-offset` + `medusa-ui` 132/132
- report/trace ฉบับเต็ม: CI artifact ของ PR (14 วัน)

| AC / กรณี | Result | Evidence |
|---|---|---|
| AC-14 `codes_offset=abc`, `-50` → ไม่มี param, 50 แถว, ไม่มี NaN, ใช้ replace | pass | 01-codes-offset-abc.png |
| AC-14 `99999999` → `50`, 10 แถว, request `[99999950, 50]` 2 ครั้ง ไม่วน | pass | 02-codes-offset-clamped.png |
| AC-14 ไม่ลงตัว/ผิดรูป: `75`, `60` → `50`; `12.5`, `1e1`, `0`, ค่าว่าง → ไม่มี param | pass | ผล e2e |
| AC-14 Back ไม่กลับค่าดิบ (`99999999`, `abc`), Forward = `50` | pass | ผล e2e |
| AC-7 filter delivered จากหน้า 2 → 5 แถว, ไม่มี request ที่พา offset เก่า | pass | 03-codes-filter-delivered-from-page-2.png |
| AC-14 `pools_offset=abc`, `-1` → ไม่มี param | pass | ผล e2e |
| AC-14 `partners_offset=abc` → ไม่มี param; `25` → `20` | pass | ผล e2e |
| ลบ partner ตัวสุดท้ายของหน้าสุดท้าย → กลับหน้าแรก 20 แถว, request `[20, 0]` | pass | 04-partner-delete-last-page.png |
| gb 0 แถว + `gb_offset=99999` → ไม่มี param, empty state; `gb_offset=` → ไม่มี param | pass | ผล e2e |
| AC-14 `gb_offset=25` → `20`; `99999` → หน้าสุดท้ายตาม count | pass | ผล e2e (test ของ PR) |
| offset แท็บ affiliate แยกกัน (แก้เฉพาะแท็บที่เปิด แท็บอื่นคงค่า) | pass | 05-affiliate-tab-offsets.png |

ข้อสังเกต (ไม่ขัด AC):
- O-1 empty state "Import a CSV to add codes." กระพริบตอน `99999999`: 1 frame เมื่อไม่หน่วง, 51 frame (~830ms) เมื่อหน่วง GET codes 800ms
- O-2 จากหน้า 2 กด filter แล้ว Back ได้หน้าแรก ไม่กลับหน้า 2 (ไม่อยู่ใน AC ยังไม่ได้เทียบกับ develop)
- ข้อจำกัด: มี pool 1 แถว จึงไม่ได้ทดสอบ pools แบบไม่ลงตัว page size หรือเกินจำนวน (ใช้ hook เดียวกับตารางอื่น)

Defect: ไม่พบ
