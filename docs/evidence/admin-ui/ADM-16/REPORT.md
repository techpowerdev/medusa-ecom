# QA — ADM-16 (PR #359) spec 08 กฎ 20 / AC-20

- Spec: `docs/spec/08-admin-ui-medusa-components.md` (ADM-16, กฎ 20, AC-20; regression AC-7, AC-8, AC-14)
- Commit ที่ตรวจ: `3605cd000395eaecbcab0a53fd8e84801264102d` (branch `feat/ADM-16-evoucher-table-deps`)
- สภาพแวดล้อม: prod build (`medusa build` + `medusa start`, admin ที่ :9259), node v22.23.3, viewport 1280×800, locale en-US / Asia/Bangkok
- CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/43391866643 (report/trace ฉบับเต็มอยู่ใน artifact `e2e-evidence` เก็บ 14 วัน)

## ผลตาม AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-20 กฎ 20b — `?codes_offset=99999999`, GET `/codes` หน่วง → ไม่มี "Import a CSV to add codes.", จบ `codes_offset=50` 10 แถว | pass | test ของ builder ผ่าน; test QA หน่วง 1500ms กลางการโหลดเจอ skeleton 56 element, MutationObserver ไม่เจอ empty state (offset `99999950` แล้ว `50`) — qa-ac20-skeleton-during-clamp.png |
| AC-20 กฎ 20a codes — เมนู `evoucher-code-row-actions` เปิดค้างระหว่าง refetch ไม่ปิดเอง | pass | qa-ac20a-code-menu-open-after-refetch.png |
| AC-20 กฎ 20a partners — เมนู `evoucher-partner-row-actions` เปิดค้างระหว่าง refetch | pass | qa-ac20a-partner-menu-open-after-refetch.png |
| AC-20 static | pass | jest `medusa-ui.unit.spec.ts -t ADM-16` ผ่าน 6 ข้อ |
| AC-7 (regression) | pass | e2e `evoucher-admin-pool-page` AC-7 |
| AC-8 (regression) | pass | e2e `evoucher-admin-partners` ผ่าน 3 ข้อ |
| AC-14 (regression) | pass | e2e `evoucher-admin-pool-page` AC-14 ผ่าน 2 ข้อ |

ตัวคุม: build ด้วย `codes-table.tsx`/`partners-section.tsx` จาก `origin/develop` แล้ว test QA ชุดเดียวกันล้ม 3/3 (เห็น empty state, เมนูปิดเองหลัง refetch ทั้งสองตาราง)

## Checklist ใน PR (1280×800) — pass ทุกข้อ
- offset เกิน + เครือข่ายช้า: เห็น skeleton ไม่เห็น empty state
- เมนูต่อแถวเปิดค้างระหว่าง refetch (codes, partners)
- Reveal ผ่าน prompt แล้วเปิด drawer โค้ดจริง; ดับเบิลคลิก menuitem/ปุ่มยืนยัน = request เดียว; แถวอื่น disabled
- Partners: Edit (drawer ค่าเดิม), Delete แล้ว Cancel = ไม่มี DELETE, ยืนยัน = DELETE 1 ครั้ง + toast + แถวหาย; ระหว่างส่งแถวอื่น disabled
- AC-14 เดิม (`abc` / `-50` / กรอง status จากหน้า 2)

## Negative / edge
| กรณี | ผล |
|------|----|
| ดับเบิลคลิก Delete / Reveal | request 1 ครั้ง |
| ลบ partner แถวสุดท้ายของหน้าสุดท้าย | กลับหน้าก่อน 20 แถว — qa-edge-partner-last-row-deleted-clamped.png; ระหว่าง clamp "No partners on this page" กระพริบ |
| `?partners_offset=99999999` | จบ `partners_offset=20` ถูกต้อง; "No partners on this page" กระพริบระหว่าง clamp |

## ข้อสังเกต (ไม่ใช่ defect ของ AC-20)
1. Partners แสดง "No partners on this page" ช่วงสั้นๆ ระหว่าง clamp `partners_offset` ตรงกับ "นอกขอบเขต" ใน PR
2. ดับเบิลคลิกปุ่มยืนยัน "Delete" ใน prompt: คลิกที่สองตกไปโดน element ใต้ปุ่ม 1 ครั้งจาก 3 รอบโดนแถว pools แล้วไปหน้า pool (DELETE ยังเป็น 1 ครั้ง) เป็นพฤติกรรมของ `usePrompt` ของ Medusa ที่ PR นี้ไม่ได้แตะ
