# ADR-012 Worker ต้องฟื้นตัวหรือจบ process เมื่อการเชื่อมต่อ Redis ของ event bus ขาด

สถานะ: accepted (เจ้าของโปรเจกต์, 2026-10-25); ภาคผนวกท้ายไฟล์ owner ตัดสิน 2026-10-26
เกี่ยวข้อง: spec 07 (OPS-8, AC-5, AC-18, AC-19), OPS-1, OPS-2, OPS-3, OPS-12

## บริบท
review พบว่า BullMQ worker ของ Redis Event Bus module บน process `worker` หยุดรับงานหลัง Redis ตอบ `ETIMEDOUT`
แต่ `GET /health` ของ Medusa ยังตอบ 200 (health ไม่ได้ตรวจ Redis/BullMQ) orchestrator จึงไม่ restart ให้ — event
(order placed, payment captured → ส่ง voucher ฯลฯ) ค้างโดยไม่มีใครรู้
Redis Event Bus module รับ option `redisOptions` (ioredis) และ `workerOptions` (BullMQ Worker) ซึ่งเรายังไม่ได้ตั้ง (`infra-modules.ts`)
ยังไม่ได้ยืนยันสาเหตุราก (ค่า retry ของ ioredis/BullMQ vs bug ของ module)

## ทางเลือก
A. **ตั้งค่า reconnect ผ่าน option ของ module** (`redisOptions`: retry ไม่จำกัด/`maxRetriesPerRequest: null` ตามที่ BullMQ แนะนำ ฯลฯ)
   ให้ worker กลับมาทำงานเองหลัง Redis กลับมา — ไม่มีโค้ดใหม่ แต่ต้องพิสูจน์ด้วย test ว่าแก้ได้จริง
B. A + **fail-fast**: ถ้าเชื่อมต่อไม่ได้นานเกินเกณฑ์ ให้ process จบด้วย exit ≠ 0 ให้ orchestrator restart — ต้องเข้าถึง event ของ
   connection (ioredis `end`/BullMQ `error`) ซึ่งอาจต้องพึ่ง internal ของ module
C. route `GET /health/ready` ของเราเองที่ ping Redis และตรวจสถานะ worker — เป็น API route ใหม่ที่ซ้อนกับ `/health` ของ Medusa,
   ต้องเข้าถึง internal ของ event bus เพื่อรู้สถานะ worker, ยังไม่แก้สาเหตุ
D. sidecar/probe ภายนอก (เช่น exec probe ที่ตรวจ queue lag) — infra ใหม่ ขัดกฎข้อ 3 ของ CLAUDE.md

## การตัดสินใจ
เลือก A ก่อน วัดผลด้วย AC-5 ของ spec 07 (script จำลอง Redis หยุด 30 วินาที)
1. builder (OPS-8) เขียน `tools/ops/smoke-redis-outage.sh` ให้ fail บน develop ปัจจุบันก่อน (ยืนยันว่า reproduce ได้)
2. ตั้ง `redisOptions`/`workerOptions` ตาม docs ของ Medusa/BullMQ (ตรวจผ่าน context7) จน AC-5 ผ่าน
3. ถ้า A อย่างเดียวไม่ผ่าน → ทำ B โดยใช้เฉพาะ API สาธารณะของ ioredis/BullMQ ที่ module เปิดให้ ถ้าต้องแตะ internal ให้หยุดและ
   กลับมาอัปเดต ADR นี้ก่อน
4. ไม่สร้าง route health ใหม่ (C) และไม่เพิ่ม infra (D)

## ผลที่ตามมา
+ แก้ที่สาเหตุด้วย config ทางการของ Medusa ก่อน โค้ดน้อยที่สุด
+ มี script ทดสอบที่ใช้ซ้ำได้ใน CI (ต่อจาก `smoke-worker-mode.sh`)
− `/health` ยังไม่สะท้อนสถานะ Redis — ยอมรับได้ถ้า worker ฟื้นเองหรือจบ process เอง (AC-5)
− ถ้าต้องไป B อาจผูกกับรายละเอียดภายในของ module ทำให้ bump เวอร์ชัน Medusa ต้องตรวจซ้ำ

## ภาคผนวก (2026-10-26): ผลทดลอง OPS-8 (#101) และการตัดสินของ owner
ผลทดลอง (evidence `docs/evidence/ops/OPS-8-tests.txt` ใน #101):
- `docker pause` Redis 30 วินาทีระหว่าง worker ทำงาน → ไม่เกิด `ETIMEDOUT` (kernel ยังรับ TCP handshake แทน container ที่ถูก pause
  คำสั่งแค่ค้าง) worker กลับมาประมวลผล event เองหลัง unpause โดยไม่ restart
- pause + restart worker ระหว่าง pause และ `docker stop` Redis + restart worker + start Redis หลัง 30 วินาที → worker ฟื้นเองและประมวลผล event ได้
- loader ของ `event-bus-redis` ตั้ง `maxRetriesPerRequest: null` เป็นค่า default อยู่แล้ว — ทางเลือก A ไม่มีอะไรต้องตั้งเพิ่ม
- ความล้มเหลวจริงใน PR #27 เกิด**ตอนบูต**ขณะเครื่องโหลดหนัก (log `Error running event bus worker` แล้ว worker ไม่รับงาน ขณะ `/health` ยัง 200)
  ทำซ้ำในเครื่องไม่ได้ (แม้บูตด้วย `--cpus 0.2`)

การตัดสิน (owner, 2026-10-26) — แทนขั้น 1–3 ของ "การตัดสินใจ":
1. ปิด OPS-8 ด้วย `tools/ops/smoke-redis-outage.sh` เป็น **regression test** (ผ่านบน develop ตั้งแต่แรก ไม่มีขั้น "fail ก่อนแก้") —
   AC-5 ของ spec 07 ปรับถ้อยคำตามนี้
2. **ไม่**แก้ `infra-modules.ts` และไม่ทำทางเลือก B (ไม่แตะ internal ของ module)
3. ความเสี่ยงที่เหลือ (worker ตายตอนบูต) ครอบด้วย **alert จาก log** `Error running event bus worker` บน process worker → restart worker
   (OPS-3, spec 07 AC-18) และเอกสารใน `docs/ops/production.md`
4. รัน script ใน CI job `docker-worker-mode` เป็น task แยก (OPS-12, AC-19) หลัง OPS-7 เพราะแตะ job เดียวกัน
5. ขั้น 4 เดิม (ไม่สร้าง route health ใหม่, ไม่เพิ่ม infra) คงเดิม

ผลที่ตามมาเพิ่ม: − ถ้า worker ตายตอนบูตจะรู้ผ่าน alert ไม่ใช่ orchestrator restart อัตโนมัติ (มีช่วงเวลาที่ event ค้างจนกว่าจะมีคน/ระบบ
restart); ถ้าเกิดซ้ำใน production ให้กลับมาเปิด ADR นี้พิจารณา B ใหม่พร้อม log จริง
