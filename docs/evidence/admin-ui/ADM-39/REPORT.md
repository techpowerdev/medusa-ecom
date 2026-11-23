# QA — ADM-39 (PR #430) ฟอร์มสร้างใน admin ไม่ยิง POST ซ้ำระหว่าง FocusModal กำลังปิด

Spec: docs/spec/08-admin-ui-medusa-components.md หัวข้อ "Follow-up รอบ 40" — AC-44 (กฎ 43) · bug ADM-B1 (manual เฟส 8 ADM-M-14)
สภาพแวดล้อม: backend build แบบ production (`medusa start`) + DB/Redis แยกของ qa · backend จริง (route mock เฉพาะการตอบ 500)
นับ POST จาก network (`page.on("request")`) และนับแถวใน DB ทุกรอบ · Playwright report/trace ฉบับเต็มอยู่ใน CI artifact ของ run ล่าสุดของ PR

| AC / กรณี | Result | Evidence |
|----|--------|----------|
| AC-44 e2e ของ builder `admin-create-double-submit.spec.ts` (7 test: partner, program, payout, campaign, variant pool, pool group, import codes) | pass 7/7 | CI artifact |
| AC-44 (a) ดับเบิลคลิก Save เว้น 80/150ms (วิธีเดิมของเฟส 8) และ 100ms (คลิกที่สอง detail 2) — 5 ฟอร์ม modal | pass: POST 1, แถว 1 ทุกรอบ | qa430-partner-after-dblclick.png, qa430-campaign-after-dblclick.png |
| AC-44 (a) คลิกที่สองหลัง response แล้ว (+30ms แบบ detail 1 และแบบ dblclick detail 2) ระหว่าง modal ปิด | pass: POST 1, แถว 1 (partner/campaign ทำซ้ำ ×5 รอบละ 4 แบบ = 40/40) | qa430-partner-after-dblclick.png |
| AC-44 (b) Save แล้วกด ⌘+Enter ทันที / +120ms หลัง response และ ⌘+Enter ซ้ำหลัง response | pass: POST 1, แถว 1 ทุกฟอร์ม | qa430-campaign-after-dblclick.png |
| AC-44 (c) API ตอบ 500 → modal ยังเปิด กด Save ซ้ำได้ | pass: POST 2 (500 + 200), แถว 1 ทุกฟอร์ม | วิดีโอ |
| AC-44 (d) เปิดฟอร์มใหม่หลังสร้างสำเร็จ → Save ใช้ได้ (ทุกรอบเปิดฟอร์มใหม่ 11 รอบต่อฟอร์ม) | pass | qa430-campaign-after-dblclick.png |
| ปิด modal ด้วย Esc (ทั้งตอน dirty ผ่าน prompt Leave และตอนว่าง) แล้วเปิดใหม่ → Save ใช้ได้ | pass | วิดีโอ |
| Edit partner (Drawer): บันทึกซ้ำหลังเปิดใหม่ 4 รอบ, ดับเบิลคลิก 80ms, ⌘+Enter หลัง response, Edit→Create, Create→Edit, ปิดด้วยคลิกนอกแล้วเปิดใหม่ | pass: POST 1 ต่อรอบ | qa430-edit-partner.png |
| Create pool group: ดับเบิลคลิกจริงเว้น 100ms และคลิกที่สองหลัง response → 1 group; network หน่วง 1.5 วิ + คลิกเดี่ยวสองครั้งห่าง 150ms → POST 1; คลิกแยกกัน 3 ครั้งห่าง 1.5 วิ → 3 groups; 500 แล้วคลิกใหม่ได้ | pass | qa430-pool-group.png |
| Import codes: ดับเบิลคลิก 80/150/100ms และคลิกซ้ำหลัง response → POST 1, code +1; เลือกไฟล์ใหม่แล้ว import ได้; ไฟล์เนื้อหาซ้ำ → ส่งได้ (skipped 1 duplicates); 500 แล้ว import ใหม่ได้ | pass | qa430-import-codes.png |
| unit `single-flight.unit.spec.ts` | pass 7/7 | — |

ฐานเทียบบน develop (สคริปต์เดียวกัน): partner คลิกหลัง response ได้แถวซ้ำ 5/5 · campaign POST 2 · pool group ได้ group ซ้ำ 2 → bug ทำซ้ำได้บน develop และหายบน PR

ข้อสังเกต (ไม่ใช่ defect): pool group ที่คลิกเดี่ยว 2 ครั้ง (detail 1 ทั้งคู่) หลัง response กลับแล้วจะสร้าง 2 group ตามที่ออกแบบไว้ (คลิกแยกครั้ง) · Enter ครั้งที่สองบนปุ่ม pool group ไม่ยิงเพราะ focus หลุดตอนปุ่ม loading · import codes บน develop ไม่ซ้ำอยู่แล้ว (ไฟล์ถูกล้างหลังสำเร็จ ปุ่มจึง disable)
