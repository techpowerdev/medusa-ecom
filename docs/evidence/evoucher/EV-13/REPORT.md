# QA EV-13 — PR #167 (widget E-vouchers บน order + toast error ของ resend)

spec: `docs/spec/02-evoucher.md` (AC-32, regression AC-19) · commit ที่ตรวจ: `91934bf`
สภาพแวดล้อม: prod build (`medusa build` → `medusa start`, NODE_ENV=production, admin `/app`), viewport 1280×800,
local notification provider (ไม่ตั้ง `RESEND_API_KEY`) ยกเว้นเคส resend ล้ม (ดูหมายเหตุ), Stripe key ปลอม
CI: https://github.com/techpowerdev/medusa-ecom/actions/runs/40521113615 (Playwright report + trace ฉบับเต็มเป็น artifact 14 วัน)
ผล: e2e ของ builder 2/2, QA spec (ในเครื่อง ไม่ได้ commit) 5/5

| AC | Result | Evidence |
|----|--------|----------|
| AC-32 widget 3 code ไม่ล้นที่ 1280px | pass | qa-ac32-widget-1280.png — widget scrollWidth 580 = clientWidth 580; ตาราง 814px เลื่อนใน container `overflow-x: auto`; เลื่อนขวาสุดเห็นคอลัมน์ Expires ในกรอบ; หน้า 1280/1280 ไม่มี scrollbar แนวนอน |
| AC-32 resend ล้ม: toast ไม่มี `noti_` | pass | qa-ac32-resend-fail-toast.png — provider ล้มจริง, POST 1 ครั้ง (500), toast/response ไม่ match `/noti_[A-Za-z0-9]+/` และมี "Try again or check the server logs."; log backend มี order id + `noti_…`; code ยัง delivered |
| AC-32 order ไม่มี code ไม่แสดง widget | pass | qa-ac32-no-code-order.png — ไม่มี `evoucher-order-widget`/`evoucher-resend`; API resend → 400 |
| AC-19 (regression) resend สำเร็จ | pass | qa-ac19-resend-success.png — dblclick → POST 1 ครั้ง, toast สำเร็จ, notification `evoucher.delivered` 1 → 2 |
| AC-32 (builder) | pass | 01-widget-and-error-toast.png — e2e `evoucher-admin-resend.spec.ts` 2/2 บน prod build |

## Negative / edge case
| เคส | ผล |
|-----|-----|
| resend ไม่มี token admin | 401 |
| ยิง resend พร้อมกัน 2 ครั้ง | 200 + 409 `EVOUCHER_RESEND_IN_PROGRESS`, notification ใหม่ 1 ฉบับ |
| dblclick ปุ่ม Resend (สำเร็จและล้ม) | POST 1 ครั้งทั้งสองกรณี |
| admin ภาษาอังกฤษ | ข้อความใน widget และ toast ไม่มีอักษรไทย |

## หมายเหตุ
- เคส resend ล้มใช้ Resend provider ที่ตั้ง key ปลอมและ `RESEND_BASE_URL` ชี้ port ที่ปิดในเครื่อง เพื่อให้ provider ล้มจริงโดยไม่มีอีเมลหรือ request ออกนอกเครื่อง
- nit: ข้อความ error มีจุดซ้อน `...could not be resolved.). Try again...` ไม่ผิด AC

## Defect
ไม่พบ
