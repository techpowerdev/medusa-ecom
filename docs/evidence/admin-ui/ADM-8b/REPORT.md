# QA ADM-8b — ปุ่มต่อแถวของตาราง affiliate เป็น `ActionMenu` (PR #316)

- Spec: `docs/spec/08-admin-ui-medusa-components.md` แถว ADM-8b, AC-13; ADR-018
- Commit: `794b1da0bdf1ada2ef055da0f6a214eaf9ccc24b` (รอบก่อนผ่านที่ `3f4b2ba7` ก่อนแก้ blocker ของ reviewer) · prod build (`medusa build` + `medusa start` จาก `.medusa/server`) · Stripe key ปลอม
- ผล test: 15/15 (QA 5 + `affiliate-admin-*` 10 รวม AC-26, AC-42..46, AC-11, AC-13), unit `medusa-ui` + `lib/affiliate*` 141/141
- report/trace ฉบับเต็ม: CI artifact ของ PR (14 วัน)

| AC / กรณี | Result | Evidence |
|---|---|---|
| Affiliates: Approve / Suspend (prompt) / Reactivate + Payout info | pass | 01-affiliate-row-menu.png |
| Programs: draft มี Edit + Delete, published มีแค่ Edit, prompt Keep ไม่ยิง request | pass | ผล e2e |
| Payouts: draft มี Mark paid + Cancel, paid ไม่มี trigger, prompt Keep ไม่ยิง request | pass | ผล e2e |
| dblclick = 1 request (Approve, ยืนยัน Suspend, Delete program, Cancel payout, Mark paid) | pass | ผล e2e |
| เมนูไม่ปิดเองตอน refetch ทั้ง 3 ตาราง (node เดิมยังอยู่) | pass | ผล e2e |
| body ไม่ค้าง `pointer-events:none`: 6 ชนิด modal รอบละ 5 ครั้ง ค้าง 0/30 และคลิกหน้าได้จริง | pass | 05-page-interactive-after-modals.png |
| Cancel ค้าง → Mark paid disabled | pass | 03-mark-paid-disabled-during-cancel.png |
| Mark paid ค้าง → Cancel/Mark paid disabled (รวมช่วง refetch หลังสำเร็จ) | pass | ผล e2e |
| ลำดับใหม่: DELETE A ค้าง → เปิด/ปิด Mark paid B → เมนู A disabled; Mark paid B สำเร็จแล้ว A ยัง disabled | pass | 04-payout-a-disabled-after-opening-b.png (จับระหว่าง animation เมนูจึงจาง ผล disabled ยืนยันจาก assertion) |
| Edit โปรแกรม disabled ระหว่าง Delete, กดแล้วไม่เปิด modal | pass | 02-program-edit-disabled-during-delete.png |

ข้อมูลประกอบ:
- Escape ครั้งแรกปิดเมนู: รอ 300ms หลังเมนูเปิด ปิดได้ 10/10 ทั้ง 3 ตาราง; กดทันทีที่เมนูโผล่ผลไม่นิ่ง (รอบแรก 3/10, 1/10, 3/10; รอบสุดท้าย 9/10) จึงเป็นเรื่องจังหวะ animation
- Escape ครั้งแรกปิด modal: 30/30
- ทิศ Mark paid ค้าง: กล่องบังตารางอยู่ จึงเปิดเมนูด้วย `pointerdown` ตรง ส่วนช่วง refetch ใช้คลิกจริง

Defect: ไม่พบ
