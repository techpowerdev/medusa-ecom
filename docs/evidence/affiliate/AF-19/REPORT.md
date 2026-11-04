# QA — AF-19: header ของ portal ไม่ล้นเมื่อชื่อ affiliate ยาวไม่มีช่องว่าง (PR #286)

Spec: `docs/spec/05-affiliate.md` กฎ 43, AC-51 · ทดสอบบน prod build: backend `medusa build` + `medusa start` (NODE_ENV=production) และ storefront `next build` + `next start` · HEAD `58ef2a7`
ความกว้างที่ทดสอบ: 375 / 639 / 1024 / 1280 px (สูง 812) · หน้าที่ทดสอบ: `/th/affiliate`, `/programs`, `/earnings`, `/payouts`, `/profile`
ชื่อที่ทดสอบ: ละติน `"AF19"+"N".repeat(72)` (76 ตัว), ไทยยาวไม่มีช่องว่าง, ชื่อสั้น `AF19 Short`, ชื่อสั้นคู่กับรหัสแนะนำยาวสุด 32 ตัว
หา element ด้วย `data-testid` ทุกจุด และตรวจข้อความไทยด้วย regex `[฀-๿]`

| AC | Result | Evidence |
|----|--------|----------|
| AC-51 ที่ 375: ชื่อละติน 76 ตัว ทั้ง 5 หน้า → `scrollWidth` = 375, ขอบขวาของชื่อ 341 ≤ 375, ชื่อตัดเป็น 3 บรรทัด, `textContent` ตรงกับชื่อที่สมัคร, `affiliate-code`/`affiliate-logout` อยู่ในจอ | pass | qa-01-latin76-375-products.png; e2e ของ PR (repeat 3) + QA matrix |
| AC-51 ที่ 639: ชื่อละติน 76 ตัว ทั้ง 5 หน้า → `scrollWidth` ≤ 639, ชื่อตัดบรรทัด | pass | qa-03-latin76-639-earnings.png |
| กฎ 43: ชื่อไทยยาวที่ 375–1280 ทั้ง 5 หน้า → ไม่ล้น ชื่อตัดบรรทัด | pass | qa-02-thai-375-profile.png |
| กฎ 43: รหัสแนะนำยาวสุด 32 ตัวที่ 4 ความกว้าง × 5 หน้า → ไม่ล้น | pass | qa-04-code32-375-payouts.png |
| AC-51 ที่ 1280 (และ 1024): ชื่อสั้นอยู่แถวเดียวกับปุ่ม → y-center ต่างกัน 0.0px (เกณฑ์ < 5px) | pass | qa-05-short-1280-programs.png |
| กฎ 43: `affiliate-logout` อยู่ในจอและกดได้ทั้ง 80 จุดวัด (`elementFromPoint` ตรงกลางปุ่มเจอปุ่มเอง) และออกจากระบบได้จริง: กดที่ 375 ด้วยชื่อ 76 ตัว → หน้า login, ทั้ง 5 หน้า redirect ไป login, cookie session ของ affiliate หาย | pass | QA e2e |
| AC-51: `--repeat-each=3` ผ่านทุกรอบ, AC-50 และ e2e เดิมของ `affiliate-portal*` ผ่านโดยไม่แก้ locator | pass | e2e ของ PR 9/9, regression 9/9 |

## Negative / edge (นอก spec)
| กรณี | ผล |
|---|---|
| ชื่อละติน 300 ตัว ที่ 320 และ 375 (หน้า `/` และ `/profile`) | ไม่ล้น ปุ่มออกจากระบบกดได้ |
| ชื่อเป็น URL ยาว ที่ 320 และ 375 | ไม่ล้น |
| ชื่อไทยกับละตินยาวปนกัน | ไม่ล้น |
| ชื่อมี HTML/script (`<b>…<script>window.__x=1</script>`) | แสดงเป็นข้อความตรงตัว script ไม่ทำงาน ไม่ล้น |
| ชื่อมี zero-width space คั่นกลาง | ไม่ล้น `textContent` ตรงกับชื่อที่สมัคร |
| กดออกจากระบบสองครั้งติดกัน (dblclick) ที่ 375 | ไปหน้า login ปกติ ไม่มี error |

## Defect
ไม่พบ

## Observation (ไม่ใช่ defect ไม่บล็อก)
- O-1: `[overflow-wrap:anywhere]` ทำให้ browser ตัดกลางคำไทยได้ ที่ 375 กับชื่อ 76 ตัว คำว่า "รหัสแนะนำ" ถูกแยกเป็น "รหัส / แนะนำ" (qa-01) และรหัสแนะนำถูกตัดที่ `-` (qa-03) อ่านได้และไม่ขัดกฎ 43 — ใส่ `whitespace-nowrap` ที่ "รหัสแนะนำ"/`affiliate-code` ได้ถ้าต้องการ
- O-2: ชื่อละติน 76 ตัวที่ 1024/1280 และชื่อไทยยาวที่ 1024 ดันปุ่มออกจากระบบลงแถวใหม่ทางซ้าย ปุ่มยังอยู่ในจอและกดได้ (พฤติกรรมจาก `flex-wrap` เดิม; spec กำหนดแถวเดียวเฉพาะชื่อสั้นที่ 1280 ซึ่งผ่าน)

## สรุป
AC-51 และกฎ 43 ผ่านทุกข้อบน prod build ที่ 375/639/1024/1280 ทั้ง 5 หน้า ครบทั้งชื่อละตินยาว 76 ตัว ชื่อไทยยาว ชื่อสั้น และรหัสแนะนำ 32 ตัว ปุ่มออกจากระบบอยู่ในจอ กดได้ และออกจากระบบได้จริง regression ผ่านทั้งหมด ไม่มี defect
