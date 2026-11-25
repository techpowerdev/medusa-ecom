# OPS-41 — fixture จาก review OPS-40 (#562)

คัดจาก scratchpad ของ reviewer เพื่อไม่ให้หาย (nit review #562, owner ตัดสิน 2026-11-26) — ใช้เป็น test case ของ OPS-41

- `cart_13rjFZ-fixture.txt` — ข้อความ (JSON string ของ `inspect`) ของ fixture `cart_13rjFZ` (`fuzz.mts all` seed 48001–52000)
  ที่ PR #562 แย่กว่า develop และไม่เข้าข้อยกเว้น (d1)/(d2)/(d3) ของกฎ 22d: ค่า `total0: '1999.50'` กินข้าม `,\n`
  เข้า key ที่มี quote ปน แล้ว `address_1: "` ในชื่อ key กลืนไปถึง `first_name`
- `cls5-OPS40.mts.txt` — ตัวจำแนกแบบเข้มของ reviewer (d1/d2/d3) รวม generator S, N1, N2 (เปลี่ยนนามสกุลเป็น `.txt`
  เพื่อไม่ให้ lint/typecheck ของ repo หยิบไปตรวจ) ต้องวาง `prx.ts` (= `redact-pii.ts` ของ PR + `export const PII_ONLY_X = PII_ONLY`)
  และ `devx.ts` (= `redact-pii.ts` ของ develop ที่ใช้เทียบ) ข้างกันก่อนรันด้วย Node 22
