# Evidence: EV-7e — หน้า vouchers แบ่งหน้า + `support_contact` + บล็อก partner บน PDP (QA PR #217)

- Spec: `docs/spec/02-evoucher.md` — AC-43, กฎข้อ 29 (+ ส่วนแสดงผลของกฎข้อ 26)
- PR: #217 — branch `feat/EV-7e-vouchers-partner-block` @2163a63
- สภาพแวดล้อม: prod build, node 24.12.0, ลูกค้า login, Stripe test mode เท่านั้น; หา element ด้วย `data-testid`
- ผล: e2e ของ builder `ev-7e-vouchers-partner.spec.ts` 1/1; e2e ของ qa 5/5
- รูป: `01`, `02`, `03` จาก builder + `ac43-pdp-p2-unsafe-urls-hidden`, `edge-vouchers-page99` จาก qa (รวม 5 รูป)
- รายงาน/trace ฉบับเต็ม: CI artifact ของ PR #217 (14 วัน)

## ผลตาม AC

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-43 (29a) แบ่งหน้าละ 20 · ถัดไป → 5 ใบ · ก่อนหน้า → 20 ใบ · ไม่มี code ซ้ำข้ามหน้า | pass | `01-vouchers-page-1.png`, `02-vouchers-page-2.png`, e2e qa test 1 |
| AC-43 (29b) `support_contact` แสดงบน `voucher-card` (ข้อความไทย) / ไม่มีค่า → ไม่แสดงแถว | pass | `01-vouchers-page-1.png`, e2e qa test 1–2 |
| AC-43 (29c) PDP หลาย variant: บล็อกตาม variant ที่เลือก · option ไม่ครบ/variant ไม่มี pool → ไม่มีบล็อก · `?v_id=` ตรงตัว · บล็อกสูงสุด 1 (ปกติและ throttle) · ไม่มี hydration error/pageerror | pass | `ac43-pdp-p2-unsafe-urls-hidden.png`, e2e qa test 3–4 |
| AC-43 (29d/26) `terms_url` `  JavaScript:…` + logo `data:` (ตั้งใน DB) → ไม่มี `<a>`/`<img>`; https → render ปกติ | pass | `ac43-pdp-p2-unsafe-urls-hidden.png`, `03-pdp-partner-block-safe-urls.png` |
| 375px หน้า vouchers (หน้า 1/2) และ PDP ไม่ล้นแนวนอน | pass | e2e qa test 1, 5 |

## Negative / edge

| กรณี | ผล |
|------|----|
| `?page=abc`, `0`, `-1`, `1.5`, `2abc`, `%00`, `1e3`, `page=2&page=3` | 200 แสดงหน้า 1 (20 ใบ) ไม่ error |
| `?page=99` | ว่าง + ปุ่มก่อนหน้า แต่ข้อความ "ยังไม่มีบัตรกำนัล" และปุ่มไป `?page=98` (ว่างเหมือนกัน) → D-1 (minor) — `edge-vouchers-page99.png` |
| `?v_id=` ขยะ | ใช้ variant ตั้งต้นและ URL ถูกแก้เป็น v_id ของ variant นั้น |
| `?v_id=` variant ที่ไม่มี pool | หลัง hydrate ไม่มีบล็อก |
| throttle Slow 3G + CPU 6x | บล็อกสูงสุด 1; ก่อน hydrate ทั้งหน้าแสดง variant ตั้งต้น (~10.6 วินาที) แล้วเปลี่ยนตาม `v_id` — สอดคล้องกับ ProductActions (พฤติกรรมหน้า static เดิม ไม่ขัดกฎ 29c) |

## Defect
- **D-1 (minor, UX, ไม่ขัด AC-43):** ลูกค้ามีบัตร 25 ใบ เปิด `?page=99` → ขึ้น "ยังไม่มีบัตรกำนัล" และปุ่มก่อนหน้าไป `?page=98` ที่ว่างเหมือนกัน — ควรมีข้อความแยกจากกรณีไม่มีบัตรเลย และปุ่มกลับไปหน้าสุดท้ายที่มีบัตรหรือหน้า 1 (spec ไม่ได้กำหนดพฤติกรรมนี้ → follow-up)
