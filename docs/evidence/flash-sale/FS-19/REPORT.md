# Evidence: FS-19 — แถบมือถือรอข้อมูล flash และไม่จางทับปุ่มหลัก (QA PR #211)

- Spec: `docs/spec/03-flash-sale.md` — AC-26, กฎข้อ 24
- PR: #211 — branch `fix/FS-19-mobile-bar-flash-loading` @a26dd07
- สภาพแวดล้อม: storefront prod build, 375×812, node 24.12.0, ลูกค้า login ทุก test, Stripe test mode เท่านั้น; หา element ด้วย `data-testid`
- ผล: e2e ของ builder (`flash-sale-fs19` + `core-25`) `--repeat-each=3` 15/15; รวม `fs16` (AC-23) 16/16; spec ของ qa `--repeat-each=3` 24/24
- รูป: `01`, `02` จาก builder + `03`, `04` จาก qa (รวม 4 รูป)

## ผลตาม AC

| AC / ข้อตรวจ | ผล | หลักฐาน |
|---|---|---|
| AC-26a flash หน่วง 3s → `mobile-cart-button` `aria-busy="true"` + disabled, กดระหว่างรอไม่มีผล, หลังตอบกดได้ ราคา ฿800 | pass | `01-mobile-bar-waiting-flash.png`, fs19 test 1 ×3, QA-1 ×3 |
| AC-26a flash ตอบ 500 → แถบกดได้ (5–12ms หลังตอบ) เพิ่มที่ราคาปกติได้ไม่มี error | pass | fs19 test 2 ×3, QA-2 ×3 |
| AC-26b `scrollIntoView({block:"center"})` → แถบซ่อน ≤ 100ms ไม่มี frame ที่จางทับ | pass | `02-main-button-center-no-bar.png`, fs19 test 3 ×3 |
| AC-26b (QA) touch fling (CDP `synthesizeScrollGesture`) ขึ้นลง 6 รอบ (~800 frame): frame ที่จางทับ = 0, ทับนานสุด 0ms, ยังจางเข้าตอนไม่ทับ, จบที่ opacity 1 | pass | QA-3 ×3 |
| sold out (stock 0): `mobile-cart-button` disabled "สินค้าหมด" ทั้งระหว่างรอและหลังตอบ กดแล้วไม่สร้าง cart | pass | `04-qa-mobile-bar-sold-out.png`, QA-4 ×3 |
| flash sold out (total_cap 1 ขายครบ): ปุ่มแถบล่างและปุ่มหลัก disabled | pass | QA-4b ×3 |
| เลือก S→M จาก modal ของแถบแล้วเพิ่ม → line M 1 ชิ้น, nav "ตะกร้า (1)" | pass | `03-qa-mobile-bar-added-M.png`, QA-1 ×3 |
| regression AC-116 (CORE-25): S→M ได้ M, แถบไม่ทับปุ่มหลักก่อน/หลัง hydrate; ปิด JS ไม่มี `mobile-actions` | pass | core-25 ×3, QA-6 ×3 |
| regression AC-23 (FS-16) | pass | fs16 3/3 |
| ข้อความ UI ของแถบเป็นไทย | pass | QA-1, QA-4 |

Defect: ไม่พบใน scope ของ PR

## ข้อสังเกต (นอก spec — ไม่ใช่ defect ของ FS-19)
1. กดซ้ำเร็ว (`el.click()` สองครั้งใน tick เดียว) ทั้ง `mobile-cart-button` และ `add-product-button` ได้ quantity 2 — มีมาก่อน PR นี้ (ปุ่มหลักก็เป็น) ต้องตัดสินใน spec ว่า storefront ต้องกันกดซ้ำแบบนี้หรือไม่
2. `POST /admin/flash-sales/:id/config` ไม่รับ `total_cap: 0` (400 "at least 1") — qa ทำ flash sold out ด้วยการซื้อให้ครบ cap 1
