# QA GB-6a — หน้า admin รายการแคมเปญ group buying + ฟอร์มสร้าง (PR #75)

สภาพแวดล้อม: commit `3584b9c`, backend แบบ build (`NODE_ENV=production`) + DB ที่ migrate + seed, Playwright Chromium headless,
timezone ของ browser `America/New_York` · โหมด production ตั้ง cookie `Secure` จึงส่ง header `x-forwarded-proto: https` (ไม่ใช่ defect)

| ข้อ | ผล | หลักฐาน |
|-----|----|---------|
| 1 sidebar มี "Group buying" + ตารางว่างแสดง empty state + คำเตือน GBT- (Q7) | ผ่าน | `ac1-empty-state.png` |
| 2 percentage 30 → toast "Campaign created as draft", แถวใหม่สถานะ draft, ลิงก์ GBT- เปิด `/app/promotions/promo_…` ได้ | ผ่าน | `ac2-campaign-draft.png` |
| 3 ไม่มีชื่อ / ends ก่อน starts / mode team ไม่ใส่ duration → toast error, modal ยังเปิด, ไม่ยิง POST | ผ่าน | `ac3-validation-toast.png` |
| 4 คลิกเมาส์ Create 5 ครั้ง → POST 1 ครั้ง ได้แคมเปญเดียว | ผ่าน | `ac4b-same-tick.png` |
| 4b คลิก 5 ครั้งใน JS task เดียว | รอบแรก **ไม่ผ่าน (D1)** → แก้แล้ว: ทดสอบซ้ำที่ `20f2ddd` ผ่าน (POST 1 ครั้ง แคมเปญ 1 อัน) | `ac4b-same-tick.png` (รอบทดสอบซ้ำ) |
| 5 fixed 100 → promotion ต้นแบบ `currency_code=thb`, `is_tax_inclusive=true`; ปิด switch → `false` (กฎข้อ 12) | ผ่าน | `ac5-fixed-thb-promotion.png` + `GET /admin/promotions/:id` |
| 6 เวลาที่กรอกตีความเป็นเวลาไทย (+07:00) ไม่ขึ้นกับ timezone ของ browser | ผ่าน | กรอก 2026-12-01 10:00 / 12-31 23:30 → API `03:00Z` / `16:30Z` |

## Negative / edge case
| กรณี | ผล |
|------|----|
| percentage 101 / target 0 / ไม่มี ends / discount -5 | toast error ไม่ยิง POST |
| ends ในอดีต (2020) | API ตอบ 200 สร้างเป็น draft — ตาม spec 04 ตรวจ `ends_at > now` ตอน draft→active (GB-6b); ควรเตือนใน UI (งานต่อ) |

## Defect
- D1 (minor): guard กันกดซ้ำพึ่ง `create.isPending` อย่างเดียว ซึ่งยังไม่อัปเดตระหว่าง click ใน task เดียวกัน → `for(i=0;i<5;i++) btn.click()`
  ได้ 5 แคมเปญ (ขัด CLAUDE.md เรื่องกันกดซ้ำ) → builder เพิ่ม guard `useRef` (inline) ใน PR นี้; idempotency ฝั่ง backend เป็นงานต่อ

## ทดสอบ D1 ซ้ำ (commit `20f2ddd`) — ผ่าน 4/4
| กรณี | ผล |
|------|----|
| `el.click()` 5 ครั้งใน JS task เดียว | POST 1 ครั้ง แคมเปญ 1 อัน |
| สร้างสำเร็จแล้วสร้างอันถัดไปในหน้าเดิม (ไม่ reload) | ปุ่มกดได้ POST รวม 2 ครั้ง ได้ชื่อละ 1 อัน |
| POST แรกได้ 400 (mock) + คลิก 5 ครั้งใน tick เดียว | POST 1 ครั้ง, toast error, modal ยังเปิด, ปุ่มกดได้ แล้วสร้างสำเร็จ |
| คลิกเมาส์ 5 ครั้งติดกัน | POST 1 ครั้ง แคมเปญ 1 อัน |
ตรวจ DB หลังทดสอบ: `group_buy_campaign` 5 แถว และ promotion `GBT-%` 5 อัน ตรงกับที่คาด ไม่มี template เกิน
