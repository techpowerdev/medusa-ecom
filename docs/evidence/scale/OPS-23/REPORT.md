# Evidence: OPS-23 — เทียบ `DATABASE_POOL_MAX` 10/20/40 ใน load-nightly

- Spec: `docs/spec/07-scaling-ops.md` — AC-38 และแถว task OPS-23 (owner Q-O4 = ก 2026-11-09) ใช้รูปแบบผลตาม `docs/evidence/scale/OPS-20b/REPORT.md`
- PR: #371
- Workflow: `.github/workflows/load-nightly.yml` → `tools/load/run.sh` (`workflow_dispatch` บน `feat/OPS-23-db-pool-compare` ด้วย `-f flash_burst=1 -f db_pool_max=<ค่า>`)
- ทั้งสาม run ใช้ commit `f3328042bbc0d8774ea0af7c22ddb80697de43f0` และรันทีละ run ต่อกัน (concurrency group `load-nightly`)

| pool | run | job | ช่วงเวลา job (UTC) | conclusion | artifact (id, หมดอายุ) |
|---|---|---|---|---|---|
| 10 (ค่าเดิม) | [43467729719](https://github.com/techpowerdev/medusa-ecom/actions/runs/43467729719) | 132031234258 | 2026-11-13T16:56:23Z → 17:05:33Z | success | `load-nightly-43467729719` (14060485365, 2026-11-27) |
| 20 | [43469331882](https://github.com/techpowerdev/medusa-ecom/actions/runs/43469331882) | 132036766218 | 2026-11-13T17:05:50Z → 17:14:47Z | success | `load-nightly-43469331882` (14061471079, 2026-11-27) |
| 40 | [43470910012](https://github.com/techpowerdev/medusa-ecom/actions/runs/43470910012) | 132042252032 | 2026-11-13T17:15:06Z → 17:24:12Z | success | `load-nightly-43470910012` (14060219359, 2026-11-27) |

- ยืนยันค่า pool จริงสองทาง: บรรทัด `pool (OPS-23): DATABASE_POOL_MAX=<ค่า>` ใน `report.md` และ `numUsed` ของ server ในช่วง checkout ได้ 10/20/40 ตามลำดับ
- 10 คือค่าเดิม: ถ้าไม่ตั้งค่า `pg-connection-loader` ของ `@medusajs/framework` 2.22.1 ส่ง `max: undefined` ทำให้ knex/tarn ใช้ default 10 (OPS-20b วัด `numUsed` ได้ 10)
- ค่า pool มีผลทั้ง server และ worker; Postgres `max_connections` ค่าเริ่มต้น 100 โดย run ที่ pool 40 ใช้ client backend สูงสุด 44
- sampler ตั้งเท่ากันทุก run ตาม OPS-20b (`LOG_LEVEL=debug`, event-loop/pool ทุก 1s, `LOAD_SAMPLE_INTERVAL=1`)
- AC-33: `artifact-guard.js scan` ผ่านทุก run และตรวจซ้ำในเครื่องด้วย regex JWT ไม่พบใน artifact ทั้งสาม
- ไม่เพิ่ม package หรือ service ไม่แตะโค้ด app และไม่แก้ค่าเริ่มต้นของ pool ใน config; ไม่มี screenshot เพราะ load test ยิง API ล้วน

## ขนาดที่รัน (มี burst ทุก run)
flash: ลูกค้า 300 ราย `total_cap` 100 burst 500 rps × 60s (`dropped_iterations` 29,414 / 29,404 / 29,351) | join: ลูกค้า 200 ราย กลุ่ม 10 คน

## Gate ความถูกต้อง (AC-2/AC-3)
| ตรวจ | คาดหวัง | pool 10 | pool 20 | pool 40 |
|---|---|---|---|---|
| AC-2 order ที่ได้ส่วนลด (DB) | 100 | 100 pass | 100 pass | 100 pass |
| AC-2 `units_sold` (DB) | 100 | 100 pass | 100 pass | 100 pass |
| AC-2 409 `FLASH_SOLD_OUT` | 200 | 200 pass | 200 pass | 200 pass |
| AC-2 checkout ผลอื่น | 0 | 0 pass | 0 pass | 0 pass |
| AC-2 5xx | 0 | 0 pass | 0 pass | 0 pass |
| AC-3 สมาชิกกลุ่ม (DB) | 10 | 10 pass | 10 pass | 10 pass |
| AC-3 join ผลอื่น | 0 | 0 pass | 0 pass | 0 pass |
| AC-3 5xx | 0 | 0 pass | 0 pass | 0 pass |

ทั้งสาม run ได้ `failures: 0` → `load test: ผ่าน`
p95 ของ k6 (รายงานอย่างเดียว, ms): flash burst 83,359 / 85,000 / 82,952; flash checkout 66,214 / 67,339 / 77,931; join 9,725 / 12,560 / 24,601

## (a)–(e) ของ AC-31 (ms; ตารางเต็มอยู่ใน `checkout-timing.md` ของแต่ละ artifact)
ช่วง checkout (2026-11-13): pool 10 17:03:40.693Z → 17:04:45.655Z (64,962); pool 20 17:12:51.636Z → 17:13:57.940Z (66,304); pool 40 17:21:55.924Z → 17:23:09.045Z (73,121)

### รวม (300 checkout ต่อ run)
| ช่วง | pool 10 median / p95 | pool 20 median / p95 | pool 40 median / p95 |
|---|---|---|---|
| (a) checkout ทั้ง request | 57,121.63 / 66,214.52 | 63,143.36 / 67,339.84 | 75,035.96 / 77,931.35 |
| (b) ก่อน hook | 20,698 / 20,945.3 | 20,255 / 21,690.05 | 22,225 / 27,507 |
| (c) ใน hook | 7,069 / 9,445.1 | 9,068.5 / 12,068.8 | 9,746 / 10,945.2 |
| (c) รอ lock | 12 / 28 | 24 / 53 | 51 / 98 |
| (c) ถือ lock | 1,607.5 / 2,297.55 | 2,024.5 / 2,519.2 | 1,917 / 4,311.5 |
| (d) หลัง hook | 23,477 / 37,058.25 | 22,849.5 / 38,369 | 23,681.5 / 40,716.2 |
| (e) = (a) − (b+c+d) | 4,085.6 / 6,570.27 | 6,031.1 / 10,011.83 | 14,392.94 / 21,930.58 |

### ตาม outcome (median)
| ช่วง | outcome | pool 10 | pool 20 | pool 40 |
|---|---|---|---|---|
| (a) | `FLASH_SOLD_OUT` (200) | 56,207.66 | 60,948.4 | 74,316.99 |
| (a) | ok (100) | 65,733.94 | 66,583.09 | 75,966.71 |
| (d) | `FLASH_SOLD_OUT` | 22,535 | 22,571 | 22,274 |
| (d) | ok | 36,853 | 37,532.5 | 39,837.5 |
| (e) | `FLASH_SOLD_OUT` | 5,018.06 | 7,407.71 | 17,137.99 |
| (e) | ok | 2,223 | 2,674.02 | 8,183.16 |

ช่วงหลักเหมือนกันทุก run: รวม = ไม่มี, `FLASH_SOLD_OUT` = ไม่มี, ok = (d)

## pool wait / connection ตาม AC-32 (ช่วง checkout; min / median / p95 / max)
| ตัวชี้วัด | pool 10 | pool 20 | pool 40 |
|---|---|---|---|
| รอ pool ของ server (`numPendingAcquires`) | 426 / 675.5 / 932.7 / 985 | 345 / 675 / 812.6 / 845 | 243 / 663 / 711 / 721 |
| `numUsed` ของ server | 10 / 10 / 10 / 10 | 20 / 20 / 20 / 20 | 40 / 40 / 40 / 40 |
| connection ของ Postgres (client backend) | 13 / 13 / 14 / 14 | 23 / 23 / 24 / 24 | 43 / 43 / 44 / 44 |
| state = active | 1 / 1 / 2.3 / 4 | 1 / 1 / 6.5 / 9 | 1 / 1 / 13.9 / 17 |
| state = idle | 3 / 10 / 12 / 13 | 7 / 19 / 22 / 23 | 17 / 35 / 40.9 / 42 |
| state = idle in transaction | 0 / 2 / 6 / 9 | 0 / 3 / 12.25 / 15 | 0 / 7 / 16 / 22 |
| wait_event_type = Client | 9 / 12 / 13 / 13 | 14 / 22 / 23 / 23 | 26 / 42 / 43 / 43 |
| wait_event_type = Lock | 0 / 0 / 0 / 3 | 0 / 0 / 5.5 / 8 | 0 / 0 / 12.9 / 15 |
| event-loop delay server (p95 ต่อวินาที, ms) | 9.05 / 14.58 / 34.48 / 55.67 | 16.1 / 24.8 / 56.29 / 62.61 | 38.82 / 57.44 / 80.77 / 84.96 |
| event-loop delay worker (p95 ต่อวินาที, ms) | 0.1 / 0.22 / 4.43 / 9.09 | 0.1 / 0.34 / 3.67 / 7.73 | 0.11 / 0.48 / 3.68 / 5.22 |
| CPU server (%, 100 = 1 core) | 97.2 / 116.2 / 177.31 / 183.21 | 107.11 / 115.72 / 139.54 / 179.64 | 109.05 / 114.35 / 159.04 / 184.1 |
| CPU postgres (%) | 18.3 / 28.27 / 43.68 / 51.9 | 21.59 / 30.75 / 43.1 / 50.82 | 19.71 / 27.27 / 39.94 / 45.29 |
| จำนวน sample (server / worker / docker / pg) | 64 / 65 / 21 / 55 | 65 / 66 / 22 / 56 | 71 / 74 / 24 / 63 |

เกณฑ์ AC-32 ทั้งสาม run: event-loop p95 < 100ms (ไม่เข้าเกณฑ์), CPU server ≥ 90% (เข้าเกณฑ์), รอ pool > 0 (เข้าเกณฑ์) → **อิ่มตัว** ตารางรายวินาทีอยู่ใน `saturation.md` ของแต่ละ artifact

## ข้อสรุป
1. **(d)/(e) อธิบายด้วยขนาด pool ไม่ได้** — ถ้า pool เป็นคอขวด การเพิ่ม pool ต้องทำให้ (d)/(e) ลดลง แต่ผลกลับทาง: median (d) แทบคงที่ (23.5 → 22.8 → 23.7s), median (e) 4.1 → 6.0 → 14.4s, median (a) 57.1 → 63.1 → 75.0s, p95 ของ join 9.7 → 12.6 → 24.6s
2. จำนวนที่รอ pool แทบไม่ลด (median 675.5 → 675 → 663) ทั้งที่ connection เพิ่ม 4 เท่า: connection ที่ถูกยืมส่วนใหญ่ว่างฝั่ง Postgres (`wait_event_type = Client` median 12/22/42 จาก 13/23/43), CPU ของ Postgres คงที่ราว 28%, CPU ของ server เต็มราว 115% ทุกค่า → คิวรอ pool เป็นอาการของ server ที่ CPU เต็ม ไม่ใช่การขาด connection
3. pool ใหญ่ขึ้นทำให้แย่ลง: event-loop delay median 14.6 → 24.8 → 57.4ms; p95 `idle in transaction` 6 → 12.25 → 16; p95 `wait_event_type = Lock` 0 → 5.5 → 12.9; median รอ lock (OPS-18) 12 → 24 → 51ms; p95 ถือ lock 2.3 → 2.5 → 4.3s
4. ข้อจำกัด: runner เครื่องเดียวรัน k6 และ sampler ด้วย (Q-O3 a) และวัดค่าละ 1 run ความต่างระหว่าง 10 กับ 20 อาจอยู่ในช่วงแปรปรวน แต่แนวโน้มที่ 40 ชัดทุกตัวชี้วัด

**ค่าที่เสนอ: คง default ของ Medusa (10 = ไม่ตั้ง `DATABASE_POOL_MAX`) สำหรับ prod และไม่เปิด ADR-020** — ทางที่น่าจะลด (d)/(e) คือเพิ่ม CPU ฝั่ง server (หลาย process/replica) หรือลดงาน CPU ต่อ request ซึ่งอยู่นอกขอบเขต OPS-23 และควรเป็น task แยก
