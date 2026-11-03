# Evidence: OPS-18 — เวลารอ/ถือ lock ของ flash checkout ใน load run

- Spec: `docs/spec/07-scaling-ops.md` — AC-29, แถว task OPS-18 (ต่อจาก OPS-4: `docs/evidence/scale/OPS-4/REPORT.md`, run 40590093846)
- PR: #194 — `feat(ops): วัดเวลารอ/ถือ lock ของ flash checkout ใน load run (OPS-18)`
- Workflow: `.github/workflows/load-nightly.yml` → `tools/load/run.sh` (`workflow_dispatch` บน branch `feat/OPS-18-checkout-lock-timing`)
- Run: https://github.com/techpowerdev/medusa-ecom/actions/runs/41617065775 (event `workflow_dispatch`, conclusion **success**)
  - job `load`: https://github.com/techpowerdev/medusa-ecom/actions/runs/41617065775/job/125853053205
  - เวลา: 2026-11-03T10:10:46Z → 10:18:41Z (step `tools/load/run.sh` 10:10:50 → 10:18:36)
- Commit: `fad358ed598d9cdb8df8eef12fe97d085affde90` (HEAD ของ PR #194 = merge `origin/develop` e7c59a2)
- Artifact (14 วัน หมดอายุ 2026-11-17T10:18:37Z): `load-nightly-41617065775` (id 13222495540) — `report.md`, `lock-timing.md`, `lock-timing.jsonl` (300 บรรทัด หนึ่งบรรทัดต่อ checkout), `flash-sale.json`, `group-buy-join.json`
- ไม่มี screenshot (load test ยิง API ล้วน)

## วิธีวัด
- hook `apps/backend/src/workflows/hooks/flash-sale-reservation.ts` log ระดับ debug หนึ่งบรรทัดต่อ checkout ผ่าน logger เดิม (JSON logger ของ OPS-3): `requested_at` (ก่อนเรียก `locking.execute`), `acquired_at` (callback เริ่ม), `released_at` (callback จบ), `wait_ms` = (a), `hold_ms` = (b) = เวลาภายใน `locking.execute`, `outcome`
- `LOG_LEVEL=debug` ตั้งใน `tools/load/run.sh` เท่านั้น (`docker-compose.prod.yml` ยังเป็น `${LOG_LEVEL:-info}`); ไม่มี package ใหม่/service ใหม่ใน compose
- หลัง k6 จบ `run.sh` ดึง `compose logs server worker` ทุก run แล้วสรุปด้วย `tools/load/lock-timing.js` (pure function มี unit test) → `lock-timing.md`
- lock key = `flash_sale:customer:<campaign_id>:<customer_id>` (ต่อ campaign + ลูกค้า ตาม spec 03) และลูกค้าแต่ละคน checkout ครั้งเดียว

## ขนาดที่รัน (เท่า OPS-4)
| รายการ | ค่า |
|---|---|
| flash: ลูกค้า / `total_cap` | 300 / 100 |
| flash: burst (ตั้งค่า) | 500 rps × 60s (`dropped_iterations` 29,409 — ทำได้จริงต่ำกว่ามากเหมือน OPS-4) |
| join: ลูกค้า / ขนาดกลุ่ม | 200 / 10 |
| stack | `docker-compose.prod.yml` (server + worker + Postgres + Redis) ใน runner เดียวกับ k6 |

## Gate ความถูกต้อง (AC-2/AC-3) — run เดียวกัน
| ตรวจ | คาดหวัง | ค่าจริง | ผล |
|---|---|---|---|
| AC-2 order ที่ได้ส่วนลด (DB) | 100 | 100 | pass |
| AC-2 `units_sold` (DB) | 100 | 100 | pass |
| AC-2 checkout ที่ได้ 409 `FLASH_SOLD_OUT` | 200 | 200 | pass |
| AC-2 checkout ผลอื่น | 0 | 0 | pass |
| AC-2 5xx | 0 | 0 | pass |
| AC-3 สมาชิกกลุ่ม (DB) | 10 | 10 | pass |
| AC-3 join ผลอื่น | 0 | 0 | pass |
| AC-3 5xx | 0 | 0 | pass |

`failures: 0` → `load test: ผ่าน`

## ผลวัด (ms) — จาก `lock-timing.md` ของ run
checkout ที่มี log: 300 (ครบ) — outcome: ok = 100, `FLASH_SOLD_OUT` = 200

| เวลา | จำนวน | min | median | p95 | max |
|---|---|---|---|---|---|
| (a) เวลารอ lock | 300 | 1 | 12 | 29.05 | 38 |
| (b) เวลาถือ lock (ภายใน `locking.execute`) | 300 | 932 | 1,519 | 2,175.25 | 2,436 |
| เทียบ: checkout ทั้ง request (k6 `scenario:checkout`) | 300 | 52,186 | 54,805 | 62,730 | 63,036 |

แยก (b) ตาม outcome (จาก `lock-timing.jsonl`): ok min/median/max = 932 / 1,047 / 1,357; sold out = 1,232 / 1,835 / 2,436

| ข้อมูลสำหรับเกณฑ์ | ค่า |
|---|---|
| ช่วงเวลา checkout ในส่วน lock (ขอ lock ตัวแรก 10:17:17.365Z → ปล่อยตัวสุดท้าย 10:17:27.777Z) | 10,412 ms |
| ผลรวมเวลาถือ lock | 459,677 ms (4,415% ของช่วงเวลา — hold ซ้อนกัน) |
| ช่วงที่มี lock ถืออยู่อย่างน้อยหนึ่งตัว | 100% |
| lock ที่ถือพร้อมกันสูงสุด | 67 |
| Spearman(ลำดับขอ lock, เวลารอ) | 0.15 |
| Spearman(ลำดับขอ lock, เวลาถือ) | 0.97 |
| median เวลารอ รายควอร์ไทล์ของคิว (Q1→Q4) | 11 → 7 → 14 → 15 |

## สรุปสาเหตุ: **หักล้าง** — checkout ไม่ได้ถูก serialize ด้วย lock
| เกณฑ์ AC-29 | ผล |
|---|---|
| ผลรวมเวลาถือ lock ≥ 80% ของช่วงเวลา checkout | ตัวเลขเกิน (4,415%) แต่เพราะ hold **ซ้อนกัน** สูงสุด 67 ตัวพร้อมกัน — ถ้า serialize จริง lock ที่ถือพร้อมกันสูงสุดต้อง = 1 และผลรวม ≈ 100% |
| เวลารอ lock โตตามลำดับคิว | **ไม่** — median 12ms, max 38ms, Spearman 0.15, ควอร์ไทล์ไม่เพิ่มตามคิว |
| สรุป | ไม่ผ่านเกณฑ์ยืนยันทั้งสองข้อพร้อมกัน → หักล้าง |

เหตุผลประกอบ:
1. lock key แยกต่อ (campaign, ลูกค้า) และลูกค้าแต่ละคน checkout ครั้งเดียว จึงไม่มี checkout ใดรอ lock ของกันและกัน (เวลารอเป็นแค่ round-trip ไป Redis)
2. ต่อ checkout เวลารอ + ถือ lock รวมไม่เกิน ~2.5s (38 + 2,436 ms) ขณะที่ checkout ทั้ง request ใช้ 52–63s → **≥ 95% ของเวลา checkout อยู่นอก `locking.execute`**
3. ทั้ง 300 checkout ผ่านช่วง lock ภายใน 10.4 วินาที ถ้าต่อคิวทีละตัวต้องใช้ ≈ 460 วินาที (ผลรวม hold)
4. ที่ต่อคิวจริงเล็กน้อยคือ **ภายใน** lock: เวลาถือโตตามลำดับคิว (Spearman 0.97) และตัวที่ sold out (มาทีหลัง) ถือนานกว่า — สอดคล้องกับ `UPDATE flash_sale_config ... units_sold` ที่ทุก transaction แย่ง row เดียวกัน (row lock ของ Postgres ถือจนจบ transaction) แต่เพิ่มได้แค่ ~1–2.4s ต่อ checkout ไม่ใช่ต้นเหตุของ 52–63s
5. ข้อสันนิษฐาน (ยังไม่ได้วัดใน OPS-18): เวลาส่วนใหญ่อยู่ก่อนและหลัง hook ใน `completeCartWorkflow` ขณะที่ server process เดียวรับ burst (burst ก็ช้าถึง 78s, p95 78,281 ms) — ระบบอิ่มตัวทั้งก้อน (CPU/event loop/DB pool ของ runner 4 vCPU) ไม่ใช่ lock ของ flash sale; ช่วง lock (10:17:17–10:17:27) อยู่ราว 25–35 วินาทีหลังส่ง checkout (ประมาณจากเวลาใน log ของ job ไม่ใช่ค่าที่วัดตรง)

## ข้อเสนอ (ไม่แก้ใน OPS-18)
- ไม่ต้องแก้ design ของ lock flash sale — ผลไม่ชี้ว่า lock เป็นคอขวด จึงไม่เปิด ADR
- ถ้าจะหาสาเหตุ 52–63s ต่อ: task วัดผลใหม่ (ไม่เพิ่ม infra) เช่น (1) รัน checkout โดยไม่มี burst เพื่อแยกว่าช้าเพราะ burst หรือเพราะ workflow เอง (2) log debug เวลาก่อน/หลัง hook ของ `completeCartWorkflow` หรือ event-loop lag — ผลบน runner เดียวกับ k6 ยังไม่แทน production (Q-O3 a; staging = OPS-19 ⏸)
- row contention ของ `flash_sale_config` (ข้อ 4) จะโตตามโหลดจริง ควรวัดซ้ำบน staging ก่อนตัดสินว่าต้องมี ADR หรือไม่

## รายงานอย่างเดียว (ไม่ใช่ gate)
| scenario | p95 | median | max |
|---|---|---|---|
| flash burst | 78,281 ms | 23.1s | 78.8s |
| flash checkout | 62,730 ms | 54.8s | 63.0s |
| group-buy join | 9,418 ms | 0.85s (ทุก request ของ scenario) | 11.83s |

checkout ของ run นี้ (52–63s) ใกล้กับ OPS-4 (58–71s) — log ระดับ debug ไม่ได้ทำให้ผลเพี้ยนอย่างมีนัย

## สถานะ AC
| AC | ผล | หมายเหตุ |
|---|---|---|
| AC-29 | pass | ตาราง (a)/(b) min/median/p95/max จาก log debug ของ logger เดิม, `LOG_LEVEL=debug` เฉพาะ load run, ไม่มี package/service ใหม่, run id 41617065775, สรุป = หักล้าง, gate AC-2 ผ่านใน run เดียวกัน; ไม่ต้องแก้ design |

## ข้อสังเกต
1. การตีความใน `lock-timing.js`: "เวลารอโตตามลำดับคิว" = Spearman(ลำดับขอ lock, เวลารอ) ≥ 0.8 และ median รายควอร์ไทล์ไม่ลดลง; "ช่วงเวลา checkout" = ขอ lock ตัวแรก → ปล่อยตัวสุดท้าย — ตัวเลขดิบอยู่ในตารางให้ตีความใหม่ได้
2. ผลรวม hold ≥ 80% ผ่านได้ทั้งตอน serialize และตอนขนานกันแน่น จึงต้องอ่านคู่กับ "lock ที่ถือพร้อมกันสูงสุด" (= 67) และเกณฑ์เวลารอ
3. log เต็มของ server/worker ไม่เข้า artifact (อยู่ในโฟลเดอร์ชั่วคราวของ `run.sh`) — `lock-timing.jsonl` มีเฉพาะ `cart_id` + เวลา + `outcome` ไม่มี token/ข้อมูลลูกค้า (ส่วน `flash-sale.json` ของ k6 ยังมี `setup_data` ที่มี JWT ของลูกค้า load test ติดมาตั้งแต่ OPS-4 — `JWT_SECRET` สุ่มใหม่ทุก run, follow-up ตัดออกด้วย `handleSummary`)
4. warning เหมือน OPS-4: `Insufficient VUs, reached 300 active VUs` (burst), Node.js 20 deprecation ของ actions
