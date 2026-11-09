# QA ADM-11 — PR #311 (หน้ารายละเอียด pool/group buy ใช้ผล loader เป็น `initialData` + breadcrumb E-vouchers)

- Spec: `docs/spec/08-admin-ui-medusa-components.md` แถว ADM-11, กฎ 14, AC-15 (ฉบับแก้ใน PR นี้: GET ≤ 4 และไม่มี GET หลัง response แรก)
- Commit: `3b433745` · prod build (`medusa build` + `medusa start`) แบบ qa #293 · chromium 1280×800 · workers=1 · backend :9213
- report/trace ฉบับเต็ม: CI artifact https://github.com/techpowerdev/medusa-ecom/actions/runs/42529862371 (14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-15 เปิด `/app/group-buying/<C>` ตรง: GET ≤ 4 และไม่มี GET หลัง response แรก | pass | 4 ครั้ง × 4 รอบ (หลัง response แรก 0) · 02-campaign-detail.png |
| AC-15 เปิด `/app/evouchers/pools/<P>` ตรง: GET ≤ 4 และไม่มี GET หลัง response แรก | pass | 4 ครั้ง × 4 รอบ (หลัง response แรก 0) |
| AC-15 breadcrumb "E-vouchers › ชื่อ pool" ลิงก์ไป `/app/evouchers` | pass | 01-pool-breadcrumb.png |
| AC-15 หน่วง GET 2000ms แล้วคลิกแถว เห็นสถานะ < 3500ms | pass | 2365–2424ms (5 รอบ) |
| AC-15 id ที่ไม่มี → `gb-campaign-not-found` | pass | 05-campaign-not-found.png |
| AC-15 e2e detail / members / pool-page ผ่านโดยไม่แก้ | pass | 4/4, 5/5, 1/1 |
| Activate/End อัปเดตสถานะทันที | pass | 03-campaign-ended-after-end.png |
| import code แล้วตัวเลขสถานะหน้า pool อัปเดต | pass | 04-pool-import-counts.png (available 1→4) |

Edge case: เข้าหน้าโดยคลิกจาก list ได้ GET 2 ครั้ง (หลัง response แรก 0), back/forward ได้ GET 4 ครั้ง (0), refresh และ back/forward หลัง Activate/End ไม่ stale, dblclick Import = 1 POST ทั้งหมดผ่าน

สังเกต: สองแท็บ แท็บที่ไม่ได้กดยังแสดงสถานะเก่าจนกว่าจะ reload เพราะ dashboard ตั้ง `refetchOnWindowFocus:false` และ `staleTime` 90s ไม่ได้มาจาก `initialData` (วิเคราะห์จากโค้ด ยังไม่ได้รันเทียบบน develop) · id แคมเปญที่ไม่มีได้ GET 5 ครั้งตามกฎ 14 · id pool ที่ไม่มีแสดงหน้า 404 ของ dashboard (พฤติกรรมเดิม)

Defect: ไม่พบ
