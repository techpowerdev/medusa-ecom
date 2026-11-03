# Evidence: ADM-2a — Header/Container จาก guide และ SectionRow ของ dashboard ใน widget admin (QA PR #205)

- Spec: `docs/spec/08-admin-ui-medusa-components.md` — AC-5 (+ nit EV-13 #167)
- PR: #205 — branch `feat/ADM-2a-admin-header-sectionrow` @c2b6486 (รวมการจัดรูปแบบ `variant-evoucher-pool.tsx` ใน fd9564c แล้ว)
- สภาพแวดล้อม: build แบบ prod-like (`build` + `medusa start`), node 24.12.0, seed ใช้ `pp_system_default` (`ALLOW_TEST_PROVIDERS=true` แบบ CI) ไม่ใช้ Stripe
- admin คงภาษาอังกฤษ; หา element ด้วย `data-testid` (ปุ่มที่ไม่มี testid หาด้วย role + ชื่อแบบ e2e เดิม)
- รายงาน/trace ฉบับเต็มอยู่ใน CI artifact `e2e-evidence`

## ผลตาม AC

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-5 static (Header import 3 ไฟล์, ใช้ `SectionRow`, ไม่มี `const Field`/`const Row`) | pass | jest `src/admin` 99/99 (12 suites) |
| AC-5 Campaign: Flash sale options มี Header (h2), แถวเป็น SectionRow (`grid-cols-2 px-6`) เส้นคั่น 1px ครบ 6 แถว, Total cap ตรง API (40), ปุ่ม Edit เปิด drawer | pass | `ac5-01-flash-sale-widget.png`, `ac5-02-flash-sale-edit-drawer.png` |
| AC-5 Variant ที่มี pool: SectionRow มีเส้นคั่น, Manage codes เป็นลิงก์ `/app/evouchers/pools/:id` คลิกแล้วไปจริง ไม่มีปุ่ม Create pool | pass | `ac5-03-voucher-pool-widget.png` |
| AC-5 Variant ที่ไม่มี pool: แสดง "not an e-voucher" + Create pool; dblclick Save (หน่วง 800ms) ได้ POST 1 ครั้ง, pool 1 ตัว แล้ว Manage codes ขึ้น | pass | ผล test ของ qa |
| AC-5 Order: Header E-vouchers, dblclick `evoucher-resend` ได้ POST 1 ครั้ง + toast สำเร็จ, toast error ไม่มีจุดซ้อน | pass | `ac5-04-order-evouchers-error-toast.png` |
| e2e ของ PR บน HEAD (flash-sale-admin-widget, flash-sale-admin-save, evoucher-admin-resend ×2, evoucher-admin-forms) | pass 5/5 | Playwright list output |
| edge: `total_cap=null` แสดง "Unlimited", campaign ไม่มี config แสดง empty state และกด Edit ได้, toast error 4 รูปแบบ | pass | ผล test ของ qa |

toast error ที่ mock 4 รูปแบบ — ไม่มี `.).`, `..` หรือ `noti_` และมีคำว่า try again กับ log:
- `(smtp down.).` → `(smtp down). Try again or check the server logs.`
- `dns fail..` → `dns fail. Try again or check the logs.`
- `noti_…: quota hit.` → `quota hit. Try again or check the server logs.`
- `(relay rejected...).` → `(relay rejected). …`

Defect: ไม่พบ

## ข้อสังเกต (ไม่ใช่ defect)
1. ปุ่ม Edit, Manage codes, Create pool และ container ของ widget Voucher pool ไม่มี `data-testid` — เสนอให้ ADM-3 เพิ่ม
2. ตาราง E-vouchers ที่ 1280px เลื่อนแนวนอนภายใน widget ตามที่ EV-13 ออกแบบ (`overflow-x-auto`)
