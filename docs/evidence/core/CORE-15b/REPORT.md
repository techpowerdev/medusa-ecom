# Evidence: CORE-15b — error ของ search drawer ที่ header ไม่เป็น `pageerror` + pin `instantsearch.js` (QA PR #213)

- Spec: `docs/spec/01-core-medusa.md` — AC-114, กฎข้อ 76
- PR: #213 — branch `fix/CORE-15b-search-drawer-error` @a8f91f2
- สภาพแวดล้อม: backend `medusa develop`, storefront prod build (`next build` + `next start`), node 24.12.0, Stripe test mode เท่านั้น; search index seed ตอน backend บูต; หา element ด้วย `data-testid`

## ผลตาม AC

| AC / ข้อตรวจ | ผล | หลักฐาน |
|----|----|---------|
| AC-114 e2e: mock `/store/search` ตอบ 500 → `search-drawer-error` ข้อความไทย, ไม่มี `pageerror`, `console.error` 1 บรรทัดต่อการค้นหาที่ล้ม | pass | spec ของ builder ด้วย `E2E_SAVE_EVIDENCE=1` ผ่าน 1/1; `ac114-desktop-error.png` |
| AC-114 layout: กล่อง error อยู่ใต้ช่องค้นหาในกรอบ drawer ไม่มี `search-results`/`search-loading` ซ้อน | pass | `ac114-desktop-error.png` |
| AC-114 unit: lockfile มี `instantsearch.js` เวอร์ชันเดียว 4.120.0 | pass | vitest `core-15b-instantsearch-pin.test.ts` 2/2 |
| ไม่ mock → ค้นหาปกติ: "เสื้อ" ได้ 2 รายการ, คำที่ไม่มีขึ้น `search-no-results`, ไม่มี pageerror, console.error = 0 | pass | `normal-desktop-results.png` |
| AC-63 (regression) 375×812 ทั้งค้นหาปกติ (ข้อความ 200 ตัวอักษร) และตอน error: drawer อยู่ในจอ ไม่ล้นแนวนอน | pass | `ac63-375-error.png`; `core-19a` AC-63 ผ่าน |
| search ล่ม (503) แล้วกลับมา → พิมพ์ใหม่ได้ผล error หาย ไม่ต้อง reload (marker บน `window`) | pass | `recover-results-no-reload.png` |
| edge: network abort, พิมพ์รัวทีละตัว, ปิดแล้วเปิด drawer หลัง error | pass | error ไทย ไม่มี pageerror เปิดใหม่ค้นหาได้ |

console ตอน search ล่มมีเฉพาะ `Failed to load resource ... 500` / `net::ERR_FAILED` (browser พิมพ์เอง) และ `[search-drawer] search request failed: <msg>` บรรทัดเดียวไม่มี stack — ไม่มี uncaught error ทุกกรณี

Defect: ไม่พบ

## ข้อสังเกต (ไม่ใช่ defect)
1. รูป `01-search-drawer-error` จาก spec ของ builder ถ่ายตอน drawer ยังเลื่อนเข้าไม่สุด (ไม่รอ animation) — ใช้ `ac114-desktop-error.png` แทน และไม่ commit รูปนั้น
2. เปิด drawer ครั้งเดียวมี search 2 ครั้ง (query ว่างตอนเปิด + หลังพิมพ์) ตอนล้มจึงได้ log 2 บรรทัด ตรงกับ assertion ของ spec (1 บรรทัดต่อ request ที่ล้ม — reviewer รับการตีความนี้)
