# Evidence: OPS-20a — ช่วงเวลา (a)–(e) ของ flash checkout และเทียบมี/ไม่มี burst

- Spec: `docs/spec/07-scaling-ops.md` — AC-31, แถว task OPS-20a (ต่อจาก OPS-18: `docs/evidence/scale/OPS-18/REPORT.md`, run 41617065775)
- PR: #204 — `feat(ops): แยกเวลา checkout flash เป็นช่วง (a)–(e) และสั่ง load run แบบไม่มี burst ได้ (OPS-20a)`
- Workflow: `.github/workflows/load-nightly.yml` → `tools/load/run.sh` (`workflow_dispatch` บน branch `feat/OPS-20a-checkout-phase-timing`, `-f flash_burst=1` / `-f flash_burst=0` — GitHub ใช้ input ของ workflow ใน ref ที่ระบุ)
- Commit ของทั้งสอง run: `f0c5d3dd227c600ab587f276f53ec8de53ff0111` (HEAD ของ PR #204 = merge `origin/develop` a2f6766)
- Run (1) มี burst: https://github.com/techpowerdev/medusa-ecom/actions/runs/41624221730 (conclusion **success**)
  - job `load`: https://github.com/techpowerdev/medusa-ecom/actions/runs/41624221730/job/125877375200 — 2026-11-03T11:02:33Z → 11:10:41Z
  - artifact `load-nightly-41624221730` (id 13225855614, หมดอายุ 2026-11-17T11:10:38Z)
- Run (2) ไม่มี burst (`flash_burst=0`): https://github.com/techpowerdev/medusa-ecom/actions/runs/41625518955 (conclusion **success**)
  - job `load`: https://github.com/techpowerdev/medusa-ecom/actions/runs/41625518955/job/125881758456 — 2026-11-03T11:11:51Z → 11:17:12Z
  - artifact `load-nightly-41625518955` (id 13226286069, หมดอายุ 2026-11-17T11:17:09Z)
- artifact แต่ละ run: `report.md`, `checkout-timing.md`/`.json`/`.jsonl` (300 บรรทัด หนึ่งบรรทัดต่อ checkout), `flash-sale-console.log` (มีแค่ `cart_id`/status/outcome/เวลา ไม่มี token), `lock-timing.*`, `flash-sale.json`, `group-buy-join.json`
- ไม่มี screenshot (load test ยิง API ล้วน)

## วิธีวัด
- (a) = `res.timings.duration` ของ request complete ต่อ cart ใน `tools/load/flash-sale.js` → บรรทัด `checkout_k6_timing` ผ่าน `k6 run --console-output`
- (b)–(d) = log ระดับ debug `checkout_phase_timing` ของ logger เดิม (JSON logger ของ OPS-3) ผูกด้วย `cart_id`:
  - middleware ของ `POST /store/carts/:id/complete` (`src/api/store/carts/checkout-phase-timing.ts`) บันทึก `entered_at` (ตอนเข้า) และ `finished_at` (`res` `finish`) — middleware ระบุ method จึงทำงาน**หลัง** `authenticate`/ownership ที่ไม่ระบุ method (ลำดับ bucket ของ `RoutesSorter` ของ Medusa) → auth/ownership อยู่ใน (e)
  - handler รวม `complete-cart-validate.ts` (ยังเป็น handler ตัวเดียวของ `completeCartWorkflow.hooks.validate`) บันทึก `started_at`/`ended_at`/`outcome` ใน `finally`
- (b) = `started_at − entered_at`, (c) = `ended_at − started_at` (รอ/ถือ lock ของ OPS-18 เป็นส่วนย่อย join ด้วย `cart_id`), (d) = `finished_at − ended_at`, (e) = (a) − (b+c+d)
- สรุปด้วย `tools/load/checkout-timing.js` (pure function มี unit test) และเทียบสองรันด้วย `--compare`
- `LOG_LEVEL=debug` ตั้งเฉพาะใน `tools/load/run.sh` (ของเดิม OPS-18; `docker-compose.prod.yml` ยังเป็น `${LOG_LEVEL:-info}`); ไม่มี package/service ใหม่; ไม่ใช้ `registerOtel` (ต้องเพิ่ม `@opentelemetry/*` + collector)
- `LOAD_FLASH_BURST=0` ลบ `options.scenarios.burst` (+ threshold ของ burst) — setup ของ k6 ยังสร้าง burst cart เหมือนเดิม เพื่อให้สถานะ DB ก่อน checkout เท่ากันทั้งสอง run

## ขนาดที่รัน (เท่า OPS-4/OPS-18)
| รายการ | (1) มี burst | (2) ไม่มี burst |
|---|---|---|
| flash: ลูกค้า / `total_cap` | 300 / 100 | 300 / 100 |
| flash: burst | 500 rps × 60s ตั้งค่า (`dropped_iterations` 29,402 — ส่งได้จริงราว 600 request) | ปิด (scenario ถูกตัด, ไม่มี metric ของ burst) |
| http request ทั้ง flash-sale.js (รวม setup) | 2,699 | 2,100 |
| join: ลูกค้า / ขนาดกลุ่ม | 200 / 10 | 200 / 10 |

## Gate ความถูกต้อง (AC-2/AC-3)
| ตรวจ | คาดหวัง | (1) มี burst | (2) ไม่มี burst |
|---|---|---|---|
| AC-2 order ที่ได้ส่วนลด (DB) | 100 | 100 pass | 100 pass |
| AC-2 `units_sold` (DB) | 100 | 100 pass | 100 pass |
| AC-2 checkout ที่ได้ 409 `FLASH_SOLD_OUT` | 200 | 200 pass | 200 pass |
| AC-2 checkout ผลอื่น | 0 | 0 pass | 0 pass |
| AC-2 5xx | 0 | 0 pass | 0 pass |
| AC-3 สมาชิกกลุ่ม (DB) | 10 | 10 pass | 10 pass |
| AC-3 join ผลอื่น | 0 | 0 pass | 0 pass |
| AC-3 5xx | 0 | 0 pass | 0 pass |

ทั้งสอง run `failures: 0` → `load test: ผ่าน`

## (1) มี burst — run 41624221730 (ms)
ช่วง checkout (request แรกเข้า middleware ของ (b) → response สุดท้ายออกของ (d)): **2026-11-03T11:08:59.714Z → 11:09:59.970Z (60,256 ms)**
checkout 300 ตัว มีครบทุกช่วงทั้ง 300 — ok = 100, `FLASH_SOLD_OUT` = 200

รวม (300)
| ช่วง | min | median | p95 | max |
|---|---|---|---|---|
| (a) checkout ทั้ง request (k6) | 50,220 | 52,737 | 61,436 | 61,696 |
| (b) ก่อน hook | 18,376 | 19,309 | 19,656 | 19,689 |
| (c) ใน hook | 5,450 | 6,013 | 8,458 | 9,060 |
| (c) ส่วนย่อย: รอ lock | 0 | 10 | 26 | 55 |
| (c) ส่วนย่อย: ถือ lock | 787 | 1,584 | 2,016 | 2,262 |
| (d) หลัง hook | 20,060 | 21,936 | 34,450 | 34,538 |
| (e) = (a) − (b+c+d) | 1,477 | 3,529 | 5,869 | 6,082 |

ok (100)
| ช่วง | min | median | p95 | max |
|---|---|---|---|---|
| (a) | 59,909 | 60,942 | 61,563 | 61,696 |
| (b) | 18,376 | 18,908 | 19,368 | 19,441 |
| (c) | 5,450 | 5,642 | 5,911 | 6,056 |
| (c) รอ lock | 2 | 10 | 24 | 27 |
| (c) ถือ lock | 787 | 906 | 1,154 | 1,211 |
| (d) | 33,883 | 34,299 | 34,498 | 34,538 |
| (e) | 1,477 | 2,031 | 2,711 | 2,813 |

`FLASH_SOLD_OUT` (200)
| ช่วง | min | median | p95 | max |
|---|---|---|---|---|
| (a) | 50,220 | 51,683 | 53,850 | 54,524 |
| (b) | 19,107 | 19,408 | 19,664 | 19,689 |
| (c) | 5,515 | 7,062 | 8,631 | 9,060 |
| (c) รอ lock | 0 | 10 | 27 | 55 |
| (c) ถือ lock | 1,154 | 1,770 | 2,049 | 2,262 |
| (d) | 20,060 | 20,794 | 22,338 | 22,478 |
| (e) | 2,745 | 4,423 | 5,933 | 6,082 |

## (2) ไม่มี burst — run 41625518955 (ms)
ช่วง checkout: **2026-11-03T11:16:23.056Z → 11:16:45.952Z (22,896 ms)**
checkout 300 ตัว มีครบทุกช่วงทั้ง 300 — ok = 100, `FLASH_SOLD_OUT` = 200

รวม (300)
| ช่วง | min | median | p95 | max |
|---|---|---|---|---|
| (a) checkout ทั้ง request (k6) | 8,185 | 22,215 | 22,716 | 22,797 |
| (b) ก่อน hook | 66 | 6,686 | 7,726 | 7,875 |
| (c) ใน hook | 12 | 3,342 | 4,868 | 5,029 |
| (c) ส่วนย่อย: รอ lock | 0 | 9 | 25 | 43 |
| (c) ส่วนย่อย: ถือ lock | 3 | 714 | 1,208 | 1,306 |
| (d) หลัง hook | 6,832 | 9,014 | 14,589 | 14,842 |
| (e) = (a) − (b+c+d) | 12 | 1,250 | 2,515 | 2,722 |

ok (100)
| ช่วง | min | median | p95 | max |
|---|---|---|---|---|
| (a) | 8,185 | 22,677 | 22,732 | 22,797 |
| (b) | 66 | 6,114 | 6,332 | 6,372 |
| (c) | 12 | 2,238 | 2,414 | 2,484 |
| (c) รอ lock | 0 | 8.5 | 16 | 21 |
| (c) ถือ lock | 3 | 550 | 702 | 810 |
| (d) | 8,095 | 13,958 | 14,741 | 14,842 |
| (e) | 12 | 370 | 441 | 537 |

`FLASH_SOLD_OUT` (200)
| ช่วง | min | median | p95 | max |
|---|---|---|---|---|
| (a) | 18,441 | 21,730 | 22,376 | 22,452 |
| (b) | 6,354 | 7,011 | 7,789 | 7,875 |
| (c) | 2,415 | 3,995 | 4,966 | 5,029 |
| (c) รอ lock | 0 | 9 | 27 | 43 |
| (c) ถือ lock | 474 | 833 | 1,229 | 1,306 |
| (d) | 6,832 | 8,815 | 9,120 | 9,210 |
| (e) | 513 | 1,816 | 2,604 | 2,722 |

## สรุปตามเกณฑ์ AC-31 (owner อนุมัติ 2026-11-03)
| เกณฑ์ | ค่า | ผล |
|---|---|---|
| median (a) ไม่มี burst / มี burst | 22,215 / 52,737 = **42.1%** (อยู่ระหว่าง 20%–80%) | **"ทั้งสอง"** — burst ทำให้ช้าขึ้นราว 2.4 เท่า แต่ไม่มี burst checkout ก็ยังใช้ 22 วินาที |

ช่วงหลัก (ช่วงใน (b)–(e) ที่ median ≥ 50% ของ median (a) ของกลุ่มเดียวกัน)
| กลุ่ม | (1) มี burst | (2) ไม่มี burst |
|---|---|---|
| รวม | ไม่มี — (d) 41.6%, (b) 36.6% | ไม่มี — (d) 40.6%, (b) 30.1% |
| ok | **(d)** 34,299 / 60,942 = 56.3% | **(d)** 13,957.5 / 22,676.9 = 61.5% |
| `FLASH_SOLD_OUT` | ไม่มี — (d) 40.2%, (b) 37.6% | ไม่มี — (d) 40.6%, (b) 32.3% |

สัดส่วนผลรวมของแต่ละช่วงต่อผลรวม (a) จาก `checkout-timing.jsonl`:
| กลุ่ม | (b) | (c) | (d) | (e) |
|---|---|---|---|---|
| (1) รวม | 35.0% | 12.0% | 46.4% | 6.6% |
| (2) รวม | 30.9% | 15.5% | 47.8% | 5.8% |
| (1) ok | 31.0% | 9.3% | 56.3% | 3.3% |
| (2) ok | 26.4% | 9.9% | 62.2% | 1.4% |

ข้อสังเกต:
1. เวลาเกือบทั้งหมดอยู่**ใน** route complete ((b)+(c)+(d) ≈ 93–94% ของ (a)) ส่วนที่อยู่ระหว่างจุดเข้า middleware ของ route ถึงตอน response finish ของทั้งสอง run คือ (d) > (b) > (c) และ (e) เล็กที่สุด (median 1.2–3.5 วินาที) — แต่**ห้ามสรุปว่า (e) อยู่นอก server**: (e) รวมคิว event loop/accept, `authenticate` + ownership และเครือข่ายใน runner ซึ่งยังแยกไม่ได้จนกว่าจะมี event-loop delay ของ OPS-20b (AC-32)
2. burst ทำให้ทุกช่วงโตพร้อมกันในสัดส่วนเกือบเดิม ((b) ×2.9, (c) ×1.8, (d) ×2.4, (e) ×2.8 เทียบ median รวม) ทั้งที่ burst ส่งได้จริงเพียงราว 600 request — สอดคล้องกับการแย่งทรัพยากรของ process/DB เดียวกัน ไม่ใช่คอขวดเฉพาะจุด (ยืนยันว่าอิ่มตัวหรือไม่ต้องรอ OPS-20b)
3. ใน hook (c) เวลาถือ lock เป็นส่วนน้อย (median ถือ lock 714–1,584 ms จาก (c) 3.3–6.0 วินาที) และรอ lock ≈ 10 ms ทั้งสอง run ตรงกับข้อสรุปของ OPS-18 ว่า lock ไม่ได้ทำให้ต่อคิว ส่วนที่เหลือของ (c) คือ exclusivity check + query ก่อนเข้า lock
4. (b) (ก่อน hook = step ของ `completeCartWorkflow` ก่อน validate รวมการได้ lock ของ cart ใน workflow) ใช้ 6–7 วินาทีแม้ไม่มี burst ยกเว้น checkout ตัวแรก (66 ms) → (b) โตตามจำนวน checkout ที่เข้าพร้อมกัน
5. `FLASH_SOLD_OUT` ยังใช้ (d) 8.8 วินาที (ไม่มี burst) ถึง 20.8 วินาที (มี burst) **หลัง** hook โยน error ไปแล้ว = ช่วงที่ workflow จัดการ error/compensation และ route complete ของ Medusa 2.22.1 `refetchCart` (`defaultStoreCartFields` เต็มชุด) ก่อน `throw` ให้ error handler ส่ง 409 — เป็นเวลาที่ไม่ได้ทำงานเชิงธุรกิจ ควรวัดต่อ
6. ช่วง checkout ของ run มี burst (60.3 วินาที) อยู่ระหว่างที่ burst ยังทำงาน (burst เริ่มที่ t=0 ส่วน checkout เริ่มที่ t=10s นาน 60s); run ไม่มี burst ใช้ 22.9 วินาที

## ข้อเสนอ (ไม่แก้ใน OPS-20a)
- ไม่เปิด ADR/แก้ design ใน task นี้ ขั้นต่อไปคือ OPS-20b (AC-32) เพื่อตัดสินว่า (b)/(d)/(e) อธิบายได้ด้วยความอิ่มตัวของ server/DB หรือไม่
- task วัดผลที่เสนอหลัง OPS-20b: แยกราย step ภายใน (d) ของ `completeCartWorkflow` (ทาง ok: สร้าง order/ตัด inventory/payment; ทาง sold out: error/compensation) และภายใน (b) — โดยไม่เพิ่ม infra เหมือน AC-31
- ผลนี้ได้บน runner เดียวกับ k6 จึงยังไม่แทน production (Q-O3 a; staging = OPS-19 ⏸)

## รายงานอย่างเดียว (ไม่ใช่ gate)
| scenario | (1) p95 | (2) p95 |
|---|---|---|
| flash burst | 76,243 ms | — (ปิด) |
| flash checkout | 61,436 ms | 22,715 ms |
| group-buy join | 7,925 ms | 7,998 ms |

checkout ของ run (1) (50–62 วินาที) ใกล้กับ OPS-18 (52–63 วินาที) — log debug ที่เพิ่มขึ้นไม่ได้ทำให้ผลเพี้ยนอย่างมีนัยสำคัญ

## สถานะ AC
| AC | ผล | หมายเหตุ |
|---|---|---|
| AC-31 | pass | input `flash_burst` → `LOAD_FLASH_BURST` ตัด scenario burst (unit อ่าน `load-nightly.yml`/`run.sh`/`flash-sale.js` + `k6 inspect`); run id ทั้งสอง; ตาราง (a)–(e) min/median/p95/max รวม 300 และตาม outcome 100/200 ต่อ run; รอ/ถือ lock เป็นส่วนย่อยของ (c); timestamp ช่วง checkout ต่อ run; log debug ผูก `cart_id` ด้วย logger เดิม และ handler ของ hook ยังเป็นตัวเดียว; `LOG_LEVEL=debug` เฉพาะ load run; ไม่มี package/service ใหม่; สรุป = "ทั้งสอง" (42.1%); ช่วงหลัก = (d) ของกลุ่ม ok ทั้งสอง run; gate AC-2 ผ่านทั้งสอง run |

## ข้อสังเกตอื่น
1. ตอนนี้ (e) ยังแยกไม่ได้ระหว่างคิว event loop, middleware ส่วนกลาง/`authenticate`/ownership และเครือข่ายใน runner — ต้องอ่านคู่กับ event-loop delay ของ AC-32
2. จุดเข้าของ (b) อยู่หลัง `authenticate` + ownership (ตามลำดับ middleware ของ Medusa) ไม่ใช่จุดแรกสุดที่ request เข้า server
3. warning เหมือน OPS-4/OPS-18: `Insufficient VUs, reached 300 active VUs` (burst ของ run 1), Node.js 20 deprecation ของ actions
