# REPORT — CORE-92 (PR #535) overview/orders hygiene + a11y `SearchPagination` ของ `/store`

spec: `docs/spec/01-core-medusa.md` หัวข้อ "Follow-up รอบ 42" · กฎข้อ 148 · AC-189
ทดสอบโดย qa บน prod build ทั้งสองฝั่ง commit `170e39fc` · Stripe key ปลอม
spec ของ PR `core-92-overview-pagination.spec.ts` + `core-78-orders-page-cleanup.spec.ts` 4/4 · QA spec (ไม่ commit) ผ่านทุก test

| AC | ผล | Evidence |
|----|----|----------|
| AC-189 (148a) ลูกค้าที่มีแต่ membership กลุ่ม: overview ไม่มี `no-orders-message` มี `overview-orders-view-all` ("ดูทั้งหมด") → `/th/account/orders` มี `group-orders` 1 card; ลูกค้าที่ไม่มีอะไรเลยยังเห็น "ยังไม่มีคำสั่งซื้อ" ไม่มีลิงก์ดูทั้งหมด | pass | `overview-group-only-1280.png` |
| AC-189 (148b) overview เรียก GB-8 ด้วย `limit=1` | pass | log http ของ backend: overview `memberships?limit=1`, หน้า orders `limit=50` |
| AC-189 (148c) `/th/store` สินค้าจริง 28 ชิ้น = 3 หน้า: `product-pagination` เป็น `<nav aria-label="แบ่งหน้า">` ปุ่ม label "หน้า 1/2/3", `aria-current="page"` ปุ่มเดียว, กดหน้า 2 ย้ายถูกและสินค้าเปลี่ยน, Tab ไปหน้า 3 + Enter ย้ายถูก, 375 ไม่ล้นแนวนอน | pass | `store-pagination-page2-1280.png`, `store-pagination-page2-375.png` |
| 148c จุดไข่ปลา (route mock count=120 = 10 หน้า) | pass | หน้า 1 และหน้า 8 ทุก "..." มี `aria-hidden="true"` aria snapshot ไม่มี "..." |
| 148d `/account/orders` หน้า 1 มี `group-orders` + order 10 ใบ (1280/375); GB-8 ล้ม (500) → `group-orders-error` ข้อความไทย order ยังครบ; หน้า 2 ไม่มีส่วนกลุ่มและ error | pass | QA spec (ทำให้ GB-8 ล้มด้วยการ rename ตารางใน DB ของ qa ชั่วคราว แล้วคืนชื่อเดิม) |
| ข้อความไทย (regex อักษรไทย) | pass | "ดูทั้งหมด", "แบ่งหน้า", "หน้า N", "ยังไม่มีคำสั่งซื้อ", ข้อความ error |

## negative/edge (นอก spec)
- ลูกค้าที่มีแต่กลุ่ม + GB-8 ล้ม: overview ขึ้น "ยังไม่มีคำสั่งซื้อ" ไม่มีลิงก์ดูทั้งหมด (`hasGroupOrders` ตีความ null เป็น false) — หน้า orders กรณีเดียวกันถูกต้อง · ช่องว่างของ spec เสนอ follow-up
- ปุ่มหน้าปัจจุบันเป็น `disabled` หลุดจากลำดับ Tab และหลังกด Enter โฟกัสหลุดไป BODY 1 ใน 3 รอบ — a11y เล็กน้อย เสนอ follow-up
- membership ที่ยกเลิกแล้วอย่างเดียว: overview ไม่มี "ยังไม่มีคำสั่งซื้อ" มีลิงก์ดูทั้งหมด หน้า orders แสดง card "ยกเลิก" ถูกต้อง
- ดับเบิลคลิกปุ่มหน้า 2: ได้หน้า 2 ถูกต้อง `aria-current` เดียว
- ที่ 375 overview ถูกซ่อนด้วย `hidden small:block` ของ starter (พฤติกรรมเดิม); URL ของ `/store` ไม่ sync หน้า (InstantSearch เดิม)

**Defect**: ไม่มี (ที่ขัด spec)
