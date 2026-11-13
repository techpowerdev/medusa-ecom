# QA ADM-18 — PR #377 (spec 08 กฎ 22, AC-22 + regression AC-7, AC-14)

## Commit ที่ตรวจ
`23676c460f443f0f64921fd3a8f05bb6d258faba` (branch `feat/ADM-18-pool-filter-esc`, base `4b9e488e`) — PR นี้แก้เฉพาะ test (e2e + `ADM-18-tests.txt`) ไม่แตะโค้ด admin

## สภาพแวดล้อม
- worktree แยกของ qa, node v22.23.3, **prod build** (`medusa build` แล้ว `medusa start` จาก `.medusa/server`) ที่พอร์ต 9316
- DB `medusa_qa377` สร้างใหม่ แล้ว migrate + seed + admin user, Redis db 4, Stripe test key, `ALLOW_TEST_PROVIDERS=true`
- Playwright chromium, viewport 1280×800, `locale: en-US`, `timezoneId: Asia/Bangkok`
- หน่วงเครือข่าย: CDP `Network.emulateNetworkConditions` (latency 300ms, 200KB/s) ร่วมกับ `page.route` หน่วง GET `/admin/evoucher/pools/<P>` 1000ms
- รูป evidence มีแถบ "QA overlay — URL: …" มุมล่างซ้ายที่ QA ฉีดเพื่อให้เห็น URL ในภาพ ไม่ใช่ UI ของแอป
- Playwright report/trace ฉบับเต็ม: CI artifact ของ PR #377 (14 วัน)

## ตาราง AC
| AC | Result | Evidence |
|----|--------|----------|
| AC-22 (หน้าแรก) | pass | `qa-01-void-esc-page1.png` · e2e ของ PR `--repeat-each=10` ผ่าน 20/20 (2.4m) |
| AC-22 (`?codes_offset=50`) | pass | `qa-02-void-esc-from-offset50.png` · URL ไม่มี `codes_offset`, request `/codes` เป็น `[null,"void"]` |
| AC-7 (regression) | pass | ทั้งไฟล์ `evoucher-admin-pool-page.spec.ts` ผ่าน 11/11 (48.8s) |
| AC-14 (regression) | pass | e2e AC-14 ผ่าน 2/2 · unit `page-offset` + `medusa-ui` ผ่าน 213/213 |
| AC-20, AC-25 (ไฟล์เดียวกัน) | pass | อยู่ในชุด 11/11 ข้างบน |

## Checklist / edge (prod build, spec ชั่วคราวของ QA)
1. pool 60 code (available ทั้งหมด) หน่วงเครือข่าย → Status = void → รอจน URL มี `codes_status=%22void%22` แล้วกด Esc: popover ปิด, chip "Status is void" ยังอยู่, หลัง 1.5 วินาที URL ยังเป็น `"void"`, request `/codes` ล่าสุดมี `status=void`, ตาราง "No codes match the selected status." — **pass** (`qa-01-void-esc-page1.png`)
2. ทำซ้ำจาก `?codes_offset=50` → URL ไม่มี `codes_offset`, filter คงอยู่ — **pass** (`qa-02-void-esc-from-offset50.png`)
3. pool ผสม (available 52 / delivered 5 / void 3) จาก `?codes_offset=50` หน่วงเครือข่าย ทุกครั้งที่เปลี่ยนค่ารอ URL แล้วกด Esc — **pass** ทุกขั้น (`qa-03-change-to-delivered.png`):

   | ค่า filter | ผล |
   |---|---|
   | available | 50 แถว ทุกแถว available |
   | delivered (เปลี่ยนผ่าน chip) | 5 แถว |
   | void | 3 แถว |
   | allocated | "No codes match…" |
   | เปลี่ยนเป็น available แล้วคลิกนอก popover | filter คงอยู่ |
   | Clear all | URL ไม่มี `codes_status`, 50 แถว |
   | ปุ่ม X ของ chip | filter ถูกลบ, 50 แถว |

   ค่า status ในระบบมีเพียง `available/allocated/delivered/void`
4. e2e ของ PR `-g ADM-18 --repeat-each=10` บน prod build ของ QA → 20/20 passed
5. (บันทึกอย่างเดียว) ข้อจำกัดที่ owner ยอมรับใน v1 **ยังเกิดตามที่คาด** — หน่วง loader 1000ms แล้วกด Esc ก่อน URL commit:

   | กด Esc หลังคลิกตัวเลือก | ผล |
   |---|---|
   | 150 / 300 / 600 / 900ms | filter หาย 12/12 (URL ไม่มี `codes_status`) |
   | ≤ 50ms | filter คงอยู่ 3/3 + 5/5 (navigation `void` ยังชนะ) |

## Defect
ไม่พบ

## ข้อสังเกต (ไม่ใช่ defect, ไม่บล็อก)
- **O-1:** URL commit แล้วยังไม่พอ ต้องรอ React render รอบถัดไปด้วย — ไม่หน่วง loader: กด Esc หรือคลิกนอก popover ภายใน ~50ms หลัง URL commit filter หาย (Esc ทันที 5/5 + 3/3, คลิกนอก 3/3, Esc หลัง 50ms หาย 2/3); รอ ≥100ms คงอยู่ 15/15; กรณีหน่วง 1000ms ตาม AC-22 กด Esc ทันทีหลัง commit filter คงอยู่ทุกครั้ง test ของ PR จึงเสถียร (40/40 รวมรอบของ builder) — ต้นเหตุเดียวกับกฎ 22 (`hasValue` ของ `DataTableFilter` ยังเป็นค่าเก่า) ผู้ใช้จริงกดเร็วขนาดนี้ไม่ได้ → เสนอหมายเหตุในกฎ 22 ว่าหน้าต่างของข้อจำกัดนับถึง re-render หลัง URL commit
- **O-2:** กด Esc ≤50ms หลังคลิก filter ไม่หาย ช่วงที่หายจริงประมาณ 150ms หลังคลิกจนถึง commit — ไม่ตรงกับคำว่า "Esc ทันทีหาย" ในคำอธิบาย PR (ข้อมูลอ้างอิง 18/20 ของ builder น่าจะมีช่วงหน่วงระหว่างคลิกกับ Esc มากกว่า)
- **O-3:** หลัง Clear all หรือเลือกค่าที่เคยดูแล้วไม่มี request `/codes` ใหม่ (cache ของ react-query) — assertion `statuses.at(-1)` ใน test ของ PR ถูกเฉพาะการเลือกค่าครั้งแรก ระวังถ้าขยาย test
