# CORE-19a — QA report (PR #118)
commit ที่ตรวจ: **5faad48** (รอบ 2 — รอบแรก 5231a0b พบ D-1/D-2)
สภาพแวดล้อม: backend `medusa build` + `medusa start` (NODE_ENV=production, `ALLOW_TEST_PROVIDERS=true`, DB `medusa_qa118` seed ใหม่, Redis db 12), storefront `next build` + `next start`, Node 22.23.3, Chromium (Playwright)
CI artifact (Playwright report/trace ฉบับเต็ม): https://github.com/techpowerdev/medusa-ecom/actions/runs/40443917015
test ของ QA (ในเครื่อง ไม่ได้ commit): qa-checklist 18 test + `e2e/core-19a-nav-cart-search.spec.ts` ของ PR + `thai-ui-shell.spec.ts`

| AC | ผล | หลักฐาน |
|----|----|---------|
| AC-62 | ผ่าน | e2e ของ PR 7/7 (cart จาก API บน `/th`, `/th/store`, PDP; root cause; UI flow D-1 S และ S+M); QA UI flow ล็อกอิน+เพิ่ม S, M จาก PDP แล้วลบที่ `/th`, `/th/store`, PDP, `/th/cart`, `/th/account` → 1 ไม่ reload; รัน 3 รอบผ่านทั้งหมด [01-nav-cart-count-after-remove.png](01-nav-cart-count-after-remove.png), [qa-01-pdp-delete-count-fixed.png](qa-01-pdp-delete-count-fixed.png) (หลังแก้: เพิ่ม S+M บน PDP แล้วลบหนึ่งรายการ → "ตะกร้า (1)") |
| AC-63 | ผ่าน | test ของ PR ซ้ำ 10/10; QA 375/320px × คำค้นไทย/ละติน 200 ตัว: สถานะว่าง/กำลังค้นหา/ไม่พบ ไม่มี scroll แนวนอน ไม่มี element ล้น drawer ปุ่มปิดอยู่ในจอและกดปิดได้ (12/12 ใน 3 รอบ) [02-search-drawer-375-long-query.png](02-search-drawer-375-long-query.png), [qa-04-search-drawer-320-thai-no-results.png](qa-04-search-drawer-320-thai-no-results.png) |
| desktop 1280 | ผ่าน | drawer กว้าง 448px (`max-w-md`) ค้นหา "เสื้อ" แล้วแสดง `search-results` และ `search-hit-link` ไม่มี scroll แนวนอน |
| ตะกร้าว่างภาษาไทย | ผ่าน | ลบ line สุดท้ายที่ `/th`, `/th/store`, PDP → 0 และ dropdown ว่างเป็นภาษาไทย [qa-03-dropdown-empty-th.png](qa-03-dropdown-empty-th.png) |
| regression `thai-ui-shell.spec.ts` | ผ่าน | 2/2 |

สรุปการรัน: qa-checklist 18 test × 3 รอบ = 54/54 ผ่าน · e2e ของ PR + thai-ui-shell 10/10 · AC-63 ของ PR ซ้ำ 10 รอบ 10/10

## ตรวจเพิ่ม (edge/negative)
| กรณี | ผล |
|------|----|
| เพิ่ม S (หรือ S+M) บน PDP แล้วลบใน dropdown ทันทีโดยไม่ navigate (วิธีของ QA CORE-4b) | ผ่าน — ตัวนับเป็น 0 (หรือ 1) ไม่ reload |
| ลบสองครั้งติดกันบน `/th/store` → 1 แล้ว 0 | ผ่าน |
| กดลบซ้ำ (double click) | ผ่าน — ลบ line เดียว ตัวนับ 1 และหลัง reload ยังเป็น 1 |
| ลบ line เดียวกันจากสองแท็บ (stale) | ผ่าน — หลัง reload ตัวนับถูกต้อง ไม่มี error ค้าง |

## Defect
| ID | รอบ 1 (5231a0b) | รอบ 2 (5faad48) |
|----|-----------------|-----------------|
| D-1 (major, AC-62 / กฎข้อ 34) ตัวนับใน nav ไม่อัปเดตหลังลบ/เพิ่มบนหน้า static (`/th`, PDP) เมื่อแก้ cart ผ่าน UI | ไม่ผ่าน | **ผ่าน** — `CartDropdown` อ่าน cart ด้วย `retrieveCart(..., { fresh: true })` (`no-store`) หลัง `medusa:cart-updated` |
| D-2 (minor) test AC-63 ของ PR วัดระหว่าง transition ของ drawer → flaky 2/10 | ไม่ผ่าน | **ผ่าน** — รอ drawer นิ่งก่อนวัด 10/10 |

ไม่พบ defect ใหม่
