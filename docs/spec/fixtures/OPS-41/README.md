# OPS-41 — fixture จาก review OPS-40 (#562)

คัดจาก scratchpad ของ reviewer เพื่อไม่ให้หาย (nit review #562, owner ตัดสิน 2026-11-26) — ใช้เป็น test case ของ OPS-41
(อยู่นอก `docs/evidence/` เพราะกฎ evidence เก็บได้เฉพาะ `REPORT.md` + PNG)

## `cart_13rjFZ-fixture.txt`
ข้อความ log ชั้น escape 1 (JSON string ของผล `inspect`) ของ fixture `cart_13rjFZ` (`fuzz.mts all` seed 48001–52000)
ที่ PR #562 แย่กว่า develop และไม่เข้าข้อยกเว้น (d1)/(d2)/(d3) ของกฎ 22d — ส่งเข้า `redactPii` ได้ตรงๆ;
ผลที่ถูกต้องต้องไม่มี `PIIMARK1Q` (ค่าของ `first_name`) กลไก: ค่า `total0: '1999.50'` กินข้าม `,\n` เข้า key ที่มี quote ปน
แล้ว `address_1: "` ในชื่อ key กลืนไปถึง `first_name`

## `cls5-OPS40.mts.txt`
ตัวจำแนกแบบเข้มของ reviewer (d1/d2/d3) รวม generator S, N1, N2 — นามสกุล `.txt` เพื่อไม่ให้ lint/typecheck ของ repo หยิบไปตรวจ
วิธีรัน (Node 22, นอก repo):
```bash
mkdir /tmp/ops41 && cp cls5-OPS40.mts.txt /tmp/ops41/cls5-OPS40.mts
# วาง prx.ts = redact-pii.ts ที่จะทดสอบ + บรรทัด `export const PII_ONLY_X = PII_ONLY`
# วาง devx.ts = redact-pii.ts ของ develop ที่ใช้เทียบ (OPS-40 เทียบกับ d5b7c0d7)
cd /tmp/ops41 && node --experimental-strip-types cls5-OPS40.mts <mode> <args>
```
โหมด: ดู usage ที่หัวไฟล์ และกิ่ง `gen === "<โหมด>"` (A, M, S, N1/N2, K, F) — `S <seed0> <seed1>` = generator S, `N1`/`N2` = sanity check object ปกติ
