# Evidence: OPS-4 — load test รายคืน (k6) flash-sale burst และ group-buy join

- Spec: `docs/spec/07-scaling-ops.md` — AC-2, AC-3, Q-O3 (a)–(e), แถว task OPS-4
- PR: #175 (merged) — `chore(ops): k6 load test รายคืนของ flash-sale burst และ group-buy join พร้อม seed-load (OPS-4)`
- Workflow: `.github/workflows/load-nightly.yml` → `tools/load/run.sh`
- Run: https://github.com/techpowerdev/medusa-ecom/actions/runs/40590093846 (event `workflow_dispatch`, branch `develop`, conclusion **success**)
  - job `load`: https://github.com/techpowerdev/medusa-ecom/actions/runs/40590093846/job/122491787470
  - เวลา: 2026-10-27T21:50:35Z → 21:58:55Z (step `tools/load/run.sh` ใช้เวลา 21:50:41 → 21:58:52)
- Commit: `3a88b516d2f408f71127c2a1b6a44f54b72e58bf` (merge commit ของ #175)
- Artifact (14 วัน หมดอายุ 2026-11-10T21:58:52Z): `load-nightly-40590093846` (id 12775055088) — `report.md`, `flash-sale.json`, `group-buy-join.json` (k6 `--summary-export`)
- ไม่มี screenshot (load test ยิง API ล้วน ไม่มี UI)

## สภาพแวดล้อมและขนาดที่รัน

| รายการ | spec กำหนด (AC-2/AC-3, Q-O3) | run นี้ |
|---|---|---|
| stack | `docker-compose.prod.yml` (server + worker + Postgres + Redis) ใน runner เดียว, `NODE_ENV=production`, `ALLOW_TEST_PROVIDERS=true` (Q-O3 a) | ตรงตาม spec (log: `ALLOW_TEST_PROVIDERS=true in production — ... CI/staging only`) |
| k6 | image pin เวอร์ชัน (Q-O3 d) | `grafana/k6:2.3.0` อยู่ใน network ของ compose |
| flash: ลูกค้า / `total_cap` | 300 / 100 | 300 / 100 |
| flash: burst | 500 rps × 60 วินาที | **ตั้งค่า** 500 rps × 60s (ค่าเริ่มต้นของ `run.sh` ไม่ได้ override) — ทำได้จริงต่ำกว่ามาก ดูข้อสังเกตข้อ 1 |
| join: ลูกค้า / ขนาดกลุ่ม | 200 / 10 | 200 / 10 |
| seed | `seed-load` สร้างลูกค้าและ token | log: `seed-load: 300 flash + 200 join customers → /tmp/load-data.json` |

run นี้ใช้ขนาดเต็ม ไม่ใช่การรันขนาดย่อหรือ smoke

## Gate (workflow ล้มถ้าไม่ผ่าน) — จาก `report.md` ของ run

| ตรวจ | คาดหวัง | ค่าจริง | ผล |
|---|---|---|---|
| AC-2 order ที่ได้ส่วนลด (นับจาก DB) | 100 | 100 | pass |
| AC-2 `units_sold` (DB) | 100 | 100 | pass |
| AC-2 checkout ที่ได้ 409 `FLASH_SOLD_OUT` | 200 | 200 | pass |
| AC-2 checkout ผลอื่น | 0 | 0 | pass |
| AC-2 5xx | 0 | 0 | pass |
| AC-3 สมาชิกกลุ่ม (DB) | 10 | 10 | pass |
| AC-3 join ผลอื่น (ไม่ใช่ 201/409) | 0 | 0 | pass |
| AC-3 5xx | 0 | 0 | pass |

`failures: 0` → `load test: ผ่าน`

## k6 thresholds (จากสรุป k6 ใน log)

| scenario | threshold | ค่าจริง | ผล |
|---|---|---|---|
| flash-sale | `http_5xx` `count==0` | count=0 | ✓ |
| flash-sale | `checkout_unexpected` `count==0` | count=0 | ✓ |
| flash-sale | `http_req_duration{scenario:burst}` `max>=0` (ใช้แยก summary ตาม scenario เท่านั้น) | max=1m29s | ✓ |
| flash-sale | `http_req_duration{scenario:checkout}` `max>=0` | max=1m11s | ✓ |
| group-buy-join | `http_5xx` `count==0` | count=0 | ✓ |
| group-buy-join | `join_unexpected` `count==0` | count=0 | ✓ |
| group-buy-join | `http_req_duration{scenario:join}` `max>=0` | max=16.73s | ✓ |

## รายงานอย่างเดียว (ไม่ใช่ gate — Q-O3 a; เป้า p95 < 300ms)

| scenario | p95 | p90 | median | max | เทียบเป้า 300ms |
|---|---|---|---|---|---|
| flash burst (`scenario:burst`) | 88,902 ms (1m28s) | 1m28s | 12.06s | 1m29s | ไม่ถึงเป้า (report-only) |
| flash checkout (`scenario:checkout`) | 70,812 ms (1m10s) | 1m10s | 1m1s | 1m11s | ไม่ถึงเป้า (report-only) |
| group-buy join (`scenario:join`) | 13,862 ms | 11.42s | 7.39s | 16.73s | ไม่ถึงเป้า (report-only) |

ตัวเลขรวมอื่นจาก k6:

| metric | flash-sale | group-buy-join |
|---|---|---|
| `http_reqs` (รวม setup) | 2,521 (9.67/s) | 400 (9.16/s) |
| `http_req_failed` | 7.93% (200 จาก 2,521) | 47.50% (190 จาก 400) |
| `iterations` | 721 | 200 |
| `dropped_iterations` | 29,423 (112.85/s) | – |
| `vus_max` | 600 | 200 |
| counter เฉพาะ | `checkout_orders`=100, `checkout_sold_out`=200, `burst_non_2xx`=0 | `join_joined`=10, `join_rejected`=190 |

`http_req_failed` มีแต่ response 409 ที่คาดไว้แล้ว k6 นับเป็น failed เพราะไม่ใช่ 2xx: flash 200 = `FLASH_SOLD_OUT` และ join 190 = กลุ่มเต็ม ไม่มี 5xx เลย (`http_5xx`=0 ทั้งสอง scenario)

## สถานะ AC

| AC | ผล | หมายเหตุ |
|---|---|---|
| AC-2 | ◐ gate ผ่าน — **ยังไม่ติ๊ก** | ส่วนที่เป็น gate ผ่านครบ (order ได้ส่วนลด = 100, `units_sold` = 100, 409 = 200, 5xx = 0) แต่เงื่อนไข "500 rps เป็นเวลา 60 วินาที" ไม่เกิดจริง (ข้อสังเกตข้อ 1) ส่วน p95 < 300ms เป็น report-only ตาม Q-O3 (a) — รอ owner ตัดสินว่าจะยอมรับ AC-2 ด้วยผล gate อย่างเดียว หรือต้องปรับ burst ให้ถึงอัตราที่กำหนดก่อน |
| AC-3 | pass | join พร้อมกัน 200 ครั้ง กลุ่มขนาด 10 → สมาชิก 10 คนจาก DB, 201 = 10, 409 = 190, ผลอื่น = 0, 5xx = 0 |

## ข้อสังเกต

1. **burst ไม่ถึง 500 rps**: เป้า 500 rps × 60s ≈ 30,000 iteration แต่ k6 ทิ้งไป 29,423 iteration (`dropped_iterations`) และเตือน `Insufficient VUs, reached 300 active VUs and cannot initialize more` (scenario burst ตั้ง `maxVUs = N = 300`) จำนวน request ของ burst ที่ส่งจริงคำนวณได้ 421 ครั้ง (`iterations` 721 ลบ checkout 300 iteration; หนึ่ง iteration ของ burst = หนึ่ง request — ค่าคำนวณ ไม่ใช่ค่าที่ k6 รายงานตรง) ไม่มี burst request ไหนได้ non-2xx (`burst_non_2xx`=0) สาเหตุที่น่าจะเป็นคือ response ช้ามาก (median 12s, p95 ~89s) จน VU 300 ตัวถูกใช้หมด ระบบที่รันใน runner เดียวกับ k6 (4 vCPU) รับโหลดนี้ไม่ไหว
2. **latency สูงมาก**: checkout ทุกครั้งใช้ 58–71 วินาที (min 58.14s) เพราะ 300 checkout ยิงพร้อม burst ส่วน join p95 13.9s ตัวเลขเหล่านี้ไม่แทน production (Q-O3 a) แต่ห่างจากเป้า 300ms หลายระดับ ควรทบทวนเมื่อมี staging (ต้องมี ADR)
3. ไม่มี timeout ฝั่ง client: timeout ของ request ตั้งไว้ 120s และ max ที่วัดได้ 1m29s ทุก checkout จึงได้ผลที่คาดไว้ (order หรือ 409)
4. ไม่มี warmup แยก: checkout เริ่มที่ t=10s ของ burst (`LOAD_CHECKOUT_START` ค่าเริ่มต้น) cart ทั้งหมดสร้างใน `setup()` ก่อนเริ่มวัด
5. warning อื่นใน log ที่ไม่กระทบผล: `DeprecationWarning: Calling client.query() when the client is already executing a query` (pg) ตอน seed, lint warning `@medusajs/cli/dist/reporter` ตอน build image, และ Node.js 20 deprecation ของ `actions/checkout@v4`/`actions/upload-artifact@v4`
6. gate ผ่านจึงไม่มี `backend-tail.log` ใน artifact (`run.sh` เก็บ log นี้เฉพาะตอนล้ม)
