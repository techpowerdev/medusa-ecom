# QA ADM-3 — pilot ฟอร์ม Form + KeyboundForm + zod (PR #294)

Spec: `docs/spec/08-admin-ui-medusa-components.md` AC-6 · head `1205fe6` · prod build (`medusa build` + `medusa start`) · viewport 1280×800 · locale en-US · timezone Asia/Bangkok
Playwright report และ trace ฉบับเต็มดูได้จาก CI artifact ของ PR #294 (เก็บ 14 วัน)

| AC | Result | Evidence |
|----|--------|----------|
| AC-6 drawer flash sale: Total cap `0` แสดง `fs-total-cap-error` ใต้ช่อง และไม่มี `POST .../config` | pass | ac6-flash-total-cap-0-error.png, e2e `admin-form-pilot` |
| AC-6 drawer: error รายช่องอ่านรู้เรื่อง (`0`/`-1`/`1.5` ทั้ง Total cap และ Per-customer limit ได้ "Must be a whole number greater than 0") และไม่มี POST | pass | ac6-flash-negative-errors.png |
| AC-6 drawer: บันทึกค่าที่ถูกได้ body ตรงกับก่อน PR (`{per_customer_limit:2,total_cap:50,show_countdown:true,show_remaining:true,banner_text:"  Flash 50%  "}` · ช่องว่างได้ `null` · banner ที่มีแต่ช่องว่างได้ `null`) | pass | e2e QA (body ของ request) |
| AC-6 drawer: dblclick Save = 1 POST · กด `Control+Enter` 2 ครั้งและ `Meta+Enter` 1 ครั้งระหว่างที่ response ถูกหน่วง = 1 POST · ปุ่ม disabled ระหว่างรอ | pass | e2e `admin-form-pilot` + e2e QA |
| AC-6 drawer: ปิดแล้วเปิดใหม่ค่าถูก (หลัง Save, หลังกรอก invalid แล้ว Cancel ค่ากลับเป็นค่าที่บันทึกไว้และไม่มี error ค้าง) | pass | e2e QA |
| AC-6 Create pool: ไม่เลือก partner แสดง `evoucher-pool-partner_id-error` "Select a partner" และไม่มี POST · error ช่องอื่นอ่านรู้เรื่อง | pass | ac6-pool-field-errors.png |
| AC-6 Create pool: กรอกครบแล้วสร้างได้ · dblclick ตามด้วย `Control+Enter` = 1 POST · body ตรงกับของเดิม (trim name/how_to_use/validity_note, `face_value:500.5`, `low_stock_threshold:0`, ค่า default 20) | pass | ac6-pool-created.png |

## Negative / edge
| กรณี | ผลลัพธ์ |
|------|---------|
| drawer: network ล้ม (`route.abort`) | toast "Failed to fetch" · drawer ยังเปิด · Save กดได้อีก |
| drawer: backend ตอบ 400 | toast แสดงข้อความจาก backend · ไม่ค้าง (ac6-flash-backend-400-toast.png) |
| drawer: network ช้า 3 วินาที | Save และ Cancel disabled ระหว่างรอ แล้วปิด drawer และ widget แสดงค่าใหม่ |
| pool: network ล้ม / backend ตอบ 400 | toast แสดง error · ค่าในฟอร์มยังอยู่ · Save กดได้อีก |
| pool: network ช้า 3 วินาทีแล้วกด `Control+Enter` | ปุ่ม disabled แล้วสร้างได้ · ส่ง POST รวม 3 ครั้งตามที่ตั้งใจลอง (ล้ม, 400, สำเร็จ) |
| pool: name/how to use ที่มีแต่ช่องว่าง, face `-1`, low-stock `1.5`/`-3` | "Name is required" / "How to use is required" / "Must be a number of 0 or more" / "Must be a whole number of 0 or more" ไม่พบ "Invalid input" |
| ตัวอักษรและช่องว่างใน input number | Chromium ไม่รับ `abc` และช่องว่าง (value เป็น `""`) จึงไม่มี error |

## Defect
ไม่พบ

## Observation (ไม่ใช่ regression)
1. พิมพ์ `e` ในช่อง Total cap ได้ ช่องแสดง "e" แต่ `validity.badInput=true` และ value เป็น `""` พอกด Save จะบันทึก `total_cap: null` (ไม่จำกัด) โดยไม่มี error ก่อน PR ทำงานเหมือนกัน เสนอเป็น follow-up ให้ตรวจ `badInput`
2. ใน modal Create pool ถ้ากด Escape แล้วเปิดใหม่ ค่าที่กรอกและ error ยังคงอยู่ เหมือนพฤติกรรมเดิม (ฟอร์มถูก reset หลังสร้างสำเร็จเท่านั้น)
3. ถ้ามีต่อ schema เท่านั้นที่ช่องว่างล้วนกลายเป็น `0` เพราะ `castNumber` ทำ `Number(" ")` แต่ผ่าน UI ไปไม่ถึง เพราะ input number ตัดช่องว่างทิ้ง
4. screenshot `ac6-flash-total-cap-0-error.png` มาจาก spec ของ builder ซึ่งใช้ viewport 1280×720 รูปอื่นใช้ 1280×800

## สรุป
AC-6 ผ่านทุกข้อ ไม่พบ defect ฟอร์มทั้งสองแสดง error ใต้ช่องเป็นข้อความที่อ่านรู้เรื่อง ไม่ส่ง POST เมื่อค่าไม่ถูก กันการกดซ้ำได้ทั้งคลิกและคีย์ลัด body ตรงกับก่อน PR และเมื่อ network หรือ backend มีปัญหาก็แสดงผลได้โดยไม่ค้าง
