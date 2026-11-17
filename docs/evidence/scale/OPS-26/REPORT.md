# Evidence: OPS-26 — เทียบ server 1 vs 2 process (`medusa start --cluster`) ใน load-nightly

- Spec: `docs/spec/07-scaling-ops.md` — AC-41 หัวข้อ "Follow-up รอบ 32" (owner Q-O5 = ก 2026-11-17) ใช้รูปแบบผลตาม `docs/evidence/scale/OPS-23/REPORT.md`
- PR: #385
- Workflow: `.github/workflows/load-nightly.yml` → `tools/load/run.sh` (`workflow_dispatch` บน `feat/OPS-26-cluster-compare` ด้วย `-f flash_burst=1 -f server_processes=<n>`)
- ทั้งสอง run ใช้ commit `bdca32bcf6a1da927dec45e1fd321cf2e1700ff5` และรันทีละ run ต่อกัน (concurrency group `load-nightly`)

| server process | run | job | ช่วงเวลา job (UTC) | conclusion | artifact (id, หมดอายุ) |
|---|---|---|---|---|---|
| 1 (ค่าเดิม) | [44044789298](https://github.com/techpowerdev/medusa-ecom/actions/runs/44044789298) | 133907702522 | 2026-11-17T08:12:43Z → 08:19:25Z | success | `load-nightly-44044789298` (14311741037, 2026-12-01) |
| 2 | [44044794206](https://github.com/techpowerdev/medusa-ecom/actions/runs/44044794206) | 133910852645 | 2026-11-17T08:19:28Z → 08:27:03Z | success | `load-nightly-44044794206` (14312675013, 2026-12-01) |

- n > 1: `run.sh` เพิ่ม `-f tools/load/server-cluster.yml` → container `server` รัน `medusa start --cluster 2 --servers 2`; worker คงคำสั่งเดิม; n = 1 ใช้คำสั่ง compose เดิมทุกตัวอักษร (unit test)
- `--servers` เท่ากับ `--cluster` เพราะใน 2.22.1 primary ส่ง `workerMode` ให้ process ลูกแล้วลูกเขียนทับ `MEDUSA_WORKER_MODE`; ไม่ใส่ = `shared` (ลูกรัน subscriber/job ด้วย) — ใส่แล้วทุก process เป็น `server` (ตรวจจาก job log ช่วง seed: บรรทัด `worker_mode` เป็น `server` 81 บรรทัด ไม่มี `shared`; log ของ server ไม่อยู่ใน artifact จึงตรวจย้อนจาก artifact ไม่ได้)
- ยืนยันจำนวน process จริงสองทาง: (1) บรรทัด `server processes (OPS-26): 1 (บูตจริง … : 1)` และ `: 2 (บูตจริง … : 2)` ใน `report.md` — นับ `Server is ready on port` ใน log ของ container `server` — ตัวนับนี้จับ process ที่ตายระหว่าง run ไม่ได้ เพราะใน 2.22.1 `cluster.on("exit")` fork ใหม่แต่ไม่ส่ง message ให้บูต (`start.js:311–314`) (review #385) (2) sample event-loop/pool ของ server ในช่วง checkout: 46 sample/46s (1 process) เทียบ 83 sample/42s (2 process ≈ 2 sample ต่อวินาทีตลอดช่วง checkout — หลักฐานหลักว่าทั้งสอง process ทำงานจนจบ run)
- sampler (กฎ c): event-loop และรอ pool ของ server **รวมทุก process** — `saturation.js` เดิมคำนวณสถิติจาก sample ทุก process ร่วมกัน (log ไม่มี pid) ค่าจึงเป็น "ค่าต่อ process" ที่รวมสอง process ไว้ชุดเดียว; CPU จาก `docker stats` เป็นของ container (รวมทุก process)
- connection (กฎ d + nit review #383): pool default 10 ต่อ process → server 10 × n + worker 10 = 10 × (n + 1) = 20 / 30 ไม่เกิน `max_connections` 100; วัดได้ client backend สูงสุด 14 / 25
- sampler ตั้งเท่ากันทั้งสอง run (`LOG_LEVEL=debug`, event-loop/pool ทุก 1s, `LOAD_SAMPLE_INTERVAL=1`), `DATABASE_POOL_MAX` ว่าง (default 10)
- AC-33: `artifact-guard.js scan` ผ่านทั้งสอง run และตรวจซ้ำในเครื่องด้วย regex JWT/`setup_data` ไม่พบใน artifact
- ไม่เพิ่ม package หรือ service ไม่แตะโค้ด app, `medusa-config.ts`, ค่า pool หรือ `docker-compose.prod.yml`; ไม่มี screenshot เพราะ load test ยิง API ล้วน

## ขนาดที่รัน (มี burst ทั้งสอง run)
flash: ลูกค้า 300 ราย `total_cap` 100 burst 500 rps × 60s (`dropped_iterations` 29,273 / 29,045) | join: ลูกค้า 200 ราย กลุ่ม 10 คน

## Gate ความถูกต้อง (AC-2/AC-3)
| ตรวจ | คาดหวัง | 1 process | 2 process |
|---|---|---|---|
| AC-2 order ที่ได้ส่วนลด (DB) | 100 | 100 pass | 100 pass |
| AC-2 `units_sold` (DB) | 100 | 100 pass | 100 pass |
| AC-2 409 `FLASH_SOLD_OUT` | 200 | 200 pass | 200 pass |
| AC-2 checkout ผลอื่น | 0 | 0 pass | 0 pass |
| AC-2 5xx | 0 | 0 pass | 0 pass |
| AC-3 สมาชิกกลุ่ม (DB) | 10 | 10 pass | 10 pass |
| AC-3 join ผลอื่น | 0 | 0 pass | 0 pass |
| AC-3 5xx | 0 | 0 pass | 0 pass |

ทั้งสอง run ได้ `failures: 0` → `load test: ผ่าน` (ไม่ oversell เมื่อ checkout กระจายไปสอง process — lock ของ flash sale อยู่ที่ Redis)
p95 ของ k6 (รายงานอย่างเดียว, ms): flash burst 59,797 / 52,440; flash checkout 47,251 / 42,681; join 7,658 / 10,230

## (a)–(e) ของ AC-31 (ms; ตารางเต็มอยู่ใน `checkout-timing.md` ของแต่ละ artifact)
ช่วง checkout (2026-11-17): 1 process 08:17:58.762Z → 08:18:44.750Z (45,988); 2 process 08:25:19.406Z → 08:26:01.413Z (42,007)

### รวม (300 checkout ต่อ run)
| ช่วง | 1 process median / p95 | 2 process median / p95 | ผลต่าง median |
|---|---|---|---|
| (a) checkout ทั้ง request | 40,485.67 / 47,251.77 | 35,369.22 / 42,681.07 | −12.6% |
| (b) ก่อน hook | 13,936.5 / 14,077.05 | 12,107.5 / 12,575.7 | −13.1% |
| (c) ใน hook | 4,982 / 6,872.65 | 4,211 / 5,853.05 | −15.5% |
| (c) รอ lock | 8 / 21 | 11 / 34.05 | +3ms |
| (c) ถือ lock | 1,268 / 1,507.7 | 1,084.5 / 1,505.05 | −14.5% |
| (d) หลัง hook | 16,987 / 27,151 | 14,975.5 / 24,800.1 | −11.8% |
| (e) = (a) − (b+c+d) | 3,066.94 / 4,699.99 | 2,792.02 / 3,808.26 | −9.0% |

### ตาม outcome (median)
| ช่วง | outcome | 1 process | 2 process |
|---|---|---|---|
| (a) | `FLASH_SOLD_OUT` (200) | 39,758.71 | 34,603.2 |
| (a) | ok (100) | 46,945.71 | 41,548.63 |
| (d) | `FLASH_SOLD_OUT` | 16,310 | 14,689 |
| (d) | ok | 27,049 | 24,019.5 |
| (e) | `FLASH_SOLD_OUT` | 3,671.38 | 3,175.49 |
| (e) | ok | 2,028.14 | 1,624.97 |

ช่วงหลักเหมือนกันทั้งสอง run: รวม = ไม่มี, `FLASH_SOLD_OUT` = ไม่มี, ok = (d)

## pool wait / connection ตาม AC-32 (ช่วง checkout; min / median / p95 / max)
| ตัวชี้วัด | 1 process | 2 process |
|---|---|---|
| รอ pool ของ server ต่อ process (`numPendingAcquires`, รวม sample ทุก process) | 374 / 675 / 887.5 / 1,002 | 158 / 327 / 452 / 520 |
| `numUsed` ของ server ต่อ process | 10 / 10 / 10 / 10 | 10 / 10 / 10 / 10 |
| connection ของ Postgres (client backend) | 13 / 13 / 14 / 14 | 23 / 23 / 24 / 25 |
| state = active | 1 / 1 / 3.05 / 4 | 1 / 1 / 2 / 15 |
| state = idle | 3 / 10 / 12.05 / 13 | 7 / 19 / 22 / 22 |
| state = idle in transaction | 0 / 1 / 6.1 / 9 | 0 / 3 / 10.35 / 13 |
| wait_event_type = Client | 9 / 12 / 13 / 13 | 8 / 22 / 23 / 24 |
| wait_event_type = Lock | 0 / 0 / 0.15 / 3 | 0 / 0 / 0 / 14 |
| event-loop delay server ต่อ process (p95 ต่อวินาที, ms) | 7.07 / 11.97 / 25.24 / 30.96 | 7.02 / 17.74 / 43.94 / 88.63 |
| event-loop delay worker (p95 ต่อวินาที, ms) | 0.1 / 0.28 / 4.37 / 6.47 | 0.31 / 0.86 / 8.55 / 18.08 |
| CPU server (container, %, 100 = 1 core) | 103.73 / 116.54 / 141.79 / 165.01 | 171.25 / 216.23 / 249.8 / 251.09 |
| CPU postgres (%) | 15.72 / 28.05 / 40.57 / 52.05 | 36.05 / 44.28 / 60.18 / 64.03 |
| จำนวน sample (server / worker / docker / pg) | 46 / 46 / 15 / 40 | 83 / 42 / 13 / 34 |

เกณฑ์ AC-32 ทั้งสอง run: event-loop p95 < 100ms (ไม่เข้าเกณฑ์), CPU server ≥ 90% (เข้าเกณฑ์), รอ pool > 0 (เข้าเกณฑ์) → **อิ่มตัว** ตารางรายวินาทีอยู่ใน `saturation.md` ของแต่ละ artifact

## ข้อสรุป
1. **(a)/(d)/(e) ลดลงแต่ไม่มาก** — median (a) 40.5 → 35.4s (−12.6%), (d) 17.0 → 15.0s (−11.8%), (e) 3.07 → 2.79s (−9.0%); ทุกช่วง (b)/(c)/(d) ลดใกล้เคียงกันราว 12–15% ไม่มีช่วงใดหายไป และ (d) ยังเป็นช่วงหลักของ checkout ที่สำเร็จ
2. **CPU ของ server ขยายได้จริงแต่ throughput ไม่ตาม** — CPU ของ container server เพิ่มจาก ~117% เป็น ~216% (สอง process ใช้ได้ราว 2 core) และรอ pool ต่อ process ลดครึ่ง (median 675 → 327) แต่เวลา checkout ลดเพียง ~13%: runner 4 vCPU ต้องแบ่งให้ k6 (burst 500 rps), Postgres (CPU 28 → 44%), worker, Redis และ sampler — เมื่อ server ใช้ 2 core ส่วนที่เหลือของเครื่องก็อิ่ม (event-loop delay ต่อ process median 12.0 → 17.7ms, p95 ของ join 7.7 → 10.2s)
3. ความแปรปรวนระหว่าง run สูง: run 1 process ครั้งนี้ median (a) 40.5s เทียบ OPS-23 pool 10 (config เดียวกัน) 57.1s → ผลต่าง ~13% จากการวัดค่าละ 1 run **ยังสรุปไม่ได้ว่าเกินช่วงแปรปรวน** ตัวชี้วัดที่เปลี่ยนชัดเกินความแปรปรวนคือ CPU ของ server (~2 เท่า) และรอ pool ต่อ process (ครึ่งหนึ่ง)
4. ข้อจำกัด: runner เครื่องเดียว 4 vCPU รัน k6/Postgres/Redis/worker/sampler ร่วมกับ server (Q-O3 a) จึงวัดผลของ "เพิ่ม CPU ให้ server" ได้ไม่เต็ม ผล 2 process อาจต่ำกว่าบนเครื่องที่ server มี CPU ของตัวเอง; ค่าละ 1 run

**ข้อเสนอ: ไม่เปลี่ยนวิธี deploy prod และไม่เปิด ADR-024** — การ scale server ในเครื่องนี้ลดเวลา checkout ได้บ้าง (~13%) แต่วัดด้วย runner ร่วมไม่พอจะแยกว่า `--cluster` ใน image ดีกว่า replica ตาม Deliverables ข้อ 2 ("prod: 2× server" ซึ่งรองรับอยู่แล้ว) ทั้งสองทางเพิ่ม CPU ให้ server แบบเดียวกัน ถ้าต้องการตัวเลขที่ชัดกว่านี้ควรวัดบนเครื่องที่แยก k6 ออกจาก stack (staging) หรือทำ Q-O5 ทาง ข (profile งาน CPU ต่อ request ของ checkout) — ทั้งคู่เป็น task ใหม่
