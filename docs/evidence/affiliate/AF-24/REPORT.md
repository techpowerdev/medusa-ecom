# QA AF-24 (PR #439) — spec 05 กฎ 48, AC-56/57
รันบน prod build (backend + storefront), DB แยกของ qa, manual payment; หา element ด้วย data-testid และตรวจความเป็นไทยด้วย regex อักษรไทย
Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #439 (14 วัน)

| AC / กรณี | Result | Evidence |
|----|--------|----------|
| AC-56 การ์ด sweatshirt ฿990 ที่ 15% → "ได้ประมาณ ฿138.79 ต่อชิ้น", t-shirt ฿590 ที่ 10% → ฿55.14 + ป้าย `affiliate-estimate-basis` "ค่าคอมโดยประมาณ (คิดจากราคาก่อน VAT)"; API `estimate={amount:138.79/55.14, currency_code:"thb", excludes_tax:true}` | pass | qa439-01-cards-desktop.png |
| AC-56 ซื้อจริงผ่าน `/r/<code>` ด้วย UI 1 ชิ้น → entry pending t-shirt 55.14 และ sweatshirt 138.79 ตรงกับการ์ดถึงทศนิยม 2 ตำแหน่ง; Earnings "รอตรวจสอบ" ฿193.93 | pass | qa439-01-cards-desktop.png (การ์ด) + ผล test |
| AC-56 การ์ดที่ rate_varies (t-shirt L อยู่ในโปรแกรม 20% เพิ่ม) → "สูงสุด" ไม่มี `affiliate-estimate`/`-basis`, API `estimate=null` | pass | qa439-02-rate-varies.png |
| AC-57 entry pending + ยกเลิก order (reversal −55.14 ของ line เดียวกัน) → "รอตรวจสอบ" ฿0, "ถูกหักคืน" ฿0 + `affiliate-earnings-pending-note` "หักรายการยกเลิก/คืนเงินแล้ว" | pass | qa439-03-earnings-pending-cancel.png |
| AC-57 entry approved + ยกเลิก → อนุมัติแล้ว ฿55.14, ถูกหักคืน −฿55.14 แยก, รอตรวจสอบ ฿0; ผลรวมทุกแถวจาก API = ผลรวม amount ใน DB (0.00 = 0.00) | pass | qa439-04-earnings-approved-reversed.png |
| มือถือ 375px: Products และ Earnings ไม่ล้นแนวนอน (scrollWidth 375), ป้ายไม่ล้นการ์ด | pass | qa439-05-mobile-375.png |
| แยกข้อมูล: affiliate C เห็น ฿0 ทุกช่อง, API `totals=[]`; A เห็นเฉพาะของตัวเอง (pending 193.93) | pass | ผล test |
| ไม่ login → `GET /affiliate/products` และ `/affiliate/me/earnings` ได้ 401 | pass | ผล test |
| edge: ซื้อ 2 ชิ้น → entry 110.28 (= 1180/1.07×10%) | pass | ผล test |
| edge: refund บางส่วน 595/1190 → ไม่มี reversal (กฎ 28d), pending 110.28 | pass | ผล test |
| edge: reversal บางส่วน −55.14 ของ line ที่ยัง pending (ใส่ด้วย SQL จำลองการคืน 1 ใน 2 ชิ้น) → pending สุทธิ 55.14 ไม่มีแถว reversed | pass | ผล test |
| edge: refund ส่วนที่เหลือจนครบ → reversal ส่วนที่เหลือ −55.14 (ไม่ซ้ำกับที่มีอยู่) → pending ฿0 | pass | ผล test |
| edge: ยกเลิก order ซ้ำครั้งที่สอง → 400, ไม่มี reversal ซ้ำ (entry ยัง 2 แถว) | pass | ผล test |
| edge: โปรแกรมหมดอายุ (ends_at ในอดีต) → การ์ดหายจากแท็บ active | pass | ผล test |
| regression `affiliate-portal.spec.ts` + `affiliate-portal-pages.spec.ts` | pass (11/11) | CI artifact |

ข้อสังเกต (ไม่ผิด spec):
- แถว pending ที่หักจนเหลือ 0 ยังคืน `count` = จำนวน entry pending (เช่น amount 0, count 1) และ reversal ที่ถูกหักไม่นับใน count; UI ไม่แสดง count
- การ์ดยังแสดงราคาขายแบบรวม VAT (฿590) คู่กับค่าคอมที่คิดจากราคาก่อน VAT ตามที่ spec กำหนด มีป้ายอธิบายแล้ว
