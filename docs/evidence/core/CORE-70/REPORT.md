# QA — CORE-70 (PR #459) ค้นหาให้ผลตรงกันทุกที่

Spec: `docs/spec/01-core-medusa.md` หัวข้อ "Follow-up รอบ 40" กฎข้อ 128 / AC-169
prod build ของ 25247188 (`db:migrate` → seed → บูต, index เติม `product_v1`), Playwright; report/trace ฉบับเต็มเป็น CI artifact

| AC | Result | Evidence |
|----|--------|----------|
| AC-169 ค้น "shirt" ได้ชุดเดียวกันทั้ง drawer, `/th/search?q=shirt`, `/th/store?q=shirt` | pass | qa459-ac169-drawer-shirt.png |
| AC-169 `/th/store?q=รองเท้า` ช่องค้นหามีคำนั้นและผลถูกกรอง; พิมพ์แล้ว URL เป็น `?q=` | pass | ผล test QA-2 |
| AC-169 ลิงก์เดิม `/th/store?product[query]=canvas` ยังใช้ได้ (เขียน URL ใหม่เป็น `?q=`) | pass | qa459-ac169-store-legacy-query.png |
| AC-169 ตัวกรองหน้า/หมวด/ราคาบน /store อยู่ใน URL และ reload แล้วถูก | pass | qa459-ac169-store-filters-reload.png |
| AC-169 `/th/search` ไม่มีผล แสดง `search-no-results` ไทย | pass | qa459-ac169-search-no-results.png |
| ราคา flash ยังแสดงในผลค้นหา (`flash-sale-fs14` 5/5) | pass | ผล test |
| 24 คำค้น ไทย/อังกฤษ/ตัวพิมพ์ต่างกัน ได้ชุดเดียวกันครบทั้งสามหน้า | pass | ผล test QA-5 |

e2e builder 3/3; regression core-15/15b/store/19a, store-thb-price, flash-sale-fs14 17/17; qa spec 6/6

## เทียบการค้นภาษาไทย (PR ทุกหน้า vs develop /th/search แบบ ILIKE)
| คำค้น | ประเภท | PR | develop /th/search |
|---|---|---|---|
| เสื้อยืดคอกลม | คำเต็ม | พบ | พบ |
| เสื้อ / กางเกง / รองเท้า | คำนำหน้า | พบ | พบ |
| ยืด, คอกลม, ยีนส์, ขาสั้น, ผ้าใบ, สีขาว | คำกลาง/ท้ายคำ | ไม่พบ | พบ |
| "เสื้อยืด คอกลม", "รองเท้า สีขาว" | เติมเว้นวรรคเอง | ไม่พบ | พบ |
| เชิ้ต / ลายทาง / สีดำ | คำที่มีวรรคในชื่อ | พบ | พบ |
| hoodie/HOODIE, canvas/CANVAS | ตัวพิมพ์ | พบ | พบ |
| can | prefix อังกฤษ | ไม่พบ | พบ |
| shirt | อังกฤษใน handle | t-shirt (ไม่มี sweatshirt) | t-shirt + sweatshirt |
ข้อจำกัดเดียวกันนี้มีอยู่แล้วใน drawer และ /store บน develop — qa459-thai-substring-yued-no-result.png

## Negative / edge
อักขระพิเศษใน q (`%`, `"`, `<script>`, ยาว 300 ตัว, เว้นวรรคล้วน) 200 ไม่มี pageerror ไม่ถูกตีความเป็น HTML; `q` กับ `product[query]` พร้อมกัน → `q` ชนะ; Back บน /store คืนค่าคำค้นถูก
