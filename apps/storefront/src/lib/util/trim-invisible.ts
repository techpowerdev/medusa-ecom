// CORE-58 (spec 01 กฎข้อ 116a): `String#trim` ไม่ตัด zero-width (U+200B/U+200C/U+200D/U+2060) — ช่องที่มีแต่อักขระพวกนี้
// ผ่าน `required` ของ browser ได้ ตัดเฉพาะหัว/ท้ายร่วมกับ white space (U+FEFF รวมไว้ให้ชัด แม้ `trim` ตัดอยู่แล้ว)
const EDGES = /^[\s​‌‍⁠﻿]+|[\s​‌‍⁠﻿]+$/g

/** ตัด white space และ zero-width ที่หัว/ท้าย คงอักขระกลางข้อความ */
export const trimInvisible = (value: string) => value.replace(EDGES, "")
