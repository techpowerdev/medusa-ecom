# QA Report — CORE-5 (PR #7)

สภาพแวดล้อม: commit `635bfd8`, Node v24.12.0, backend :9107, storefront :8107, DB `medusa_qa5`
(migrate อย่างเดียว ไม่มี seed เพราะตอนทดสอบ CORE-2 ยังไม่ merge)

spec 01 ไม่มี AC เฉพาะของ CORE-5 จึงทดสอบตามสิ่งที่ส่งมอบใน PR (D-1..D-4)

| AC | ผล | Evidence |
|----|----|----------|
| D-1 `pnpm --filter storefront test:e2e` รันได้ | ✅ pass | 9 passed (unit 7 + smoke 2); `test:e2e:unit` 7 passed |
| D-2 screenshot ทุก step + trace ทุก test ใน report | ✅ pass | JSON reporter มี `step-NN <ชื่อ>`, `screenshot`, `trace` ทุก test; step ที่ fail หลัง `goto` ยังได้ `step-01` |
| D-3 `E2E_SAVE_EVIDENCE=1` เขียน PNG ถูกที่ | ✅ pass | [01-storefront-robots.png](01-storefront-robots.png) (20.7KB), [02-admin-login.png](02-admin-login.png) (22.6KB); ไม่ตั้ง env → ไม่เขียนไฟล์ |
| D-4 บังคับ ≤5 PNG / ≤300KB / ห้าม trace ใน git | ✅ pass | ดูกรณี negative ด้านล่าง |

## กรณี negative (ตั้งใจให้ fail)
| กรณี | ผลที่ได้ |
|------|---------|
| เขียนรูปที่ 6 | throw "มี 6 PNG เกินกำหนด 5 รูป" |
| PNG > 300KB (canvas noise) | throw และไม่เขียนไฟล์ |
| ชื่อผิดรูปแบบ (`Admin Login`, `../escape`) | throw |
| ไม่ตั้ง `evidenceTarget` | throw |
| 7 PNG + PNG 400KB + `trace.zip` + โฟลเดอร์ย่อย `screenshots/` | `test:e2e:unit` fail พร้อมแจ้ง violation ครบ 4 ข้อ |

## ข้อสังเกต (ไม่ block)
1. `evidence()` เขียน PNG ก่อนเช็กงบ — รูปที่ 6 ทำให้ test fail แต่ไฟล์ค้างบนดิสก์
2. budget test ตรวจเฉพาะ `<feature>/<task-id>/` — ไฟล์ที่ระดับ feature (เช่น `docs/evidence/qa-tmp/trace.zip`) และชื่อโฟลเดอร์ผิดรูปแบบไม่ถูกจับ
3. step ที่ใช้ `page.setContent()` ไม่ได้ screenshot เพราะ URL ยังเป็น `about:blank`
4. คำสั่งของ agent QA ยกตัวอย่าง `screenshots/ac1-checkout.png` แต่ convention ใหม่ห้ามโฟลเดอร์ย่อย — ต้องปรับให้ตรงกัน
5. `next dev` แก้ `next-env.d.ts` และสร้าง `AGENTS.md`/`CLAUDE.md` ใน storefront ทุกครั้งที่รัน
6. job `storefront-e2e` ใน CI ยัง skip (เปิดใน CORE-6) จึงยังไม่มี artifact `e2e-evidence` และ `test:e2e:unit` ยังไม่รันใน CI
   (CI run: https://github.com/techpowerdev/medusa-ecom/actions/runs/40176107381)
