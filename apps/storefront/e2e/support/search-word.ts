// CORE-86 (spec 01 กฎข้อ 142): คำค้นไทยเฉพาะ run สำหรับ e2e ที่ค้นผ่าน index (word_similarity > 0.3 ของ pg_trgm — CORE-75)
// แต่ละ spec มีคำนำหน้าคงที่และชุดอักษรแทนตัวเลขของตัวเอง ที่ไม่มีอักษรร่วมกับ scheme อื่น — ถ้าใช้ตัวอักษรชุดเดียวกัน
// run ของสอง worker ที่เวลาใกล้กันได้คำที่คล้ายกันเกินเกณฑ์ (วัดได้ ~0.67 แม้ใส่คำนำหน้าต่างกัน) → ผลค้นของอีก spec หลุดมา
// เพิ่ม spec ใหม่ = เพิ่ม scheme ที่ใช้อักษรไม่ซ้ำ (`search-word.unit.spec.ts` ตรวจทุกคู่)
export const SEARCH_WORD_SCHEMES = {
  core75: { prefix: "ภม", digits: "กขคงจฉชซญด" },
  fs14: { prefix: "ยร", digits: "ตถทธนบปผพฟ" },
} as const

/** คำไทยล้วนจาก `run` (ตัวเลข) = คำนำหน้าของ scheme + ตัวเลขแต่ละหลักแทนด้วยอักษรของ scheme */
export const thaiRunWord = (
  scheme: keyof typeof SEARCH_WORD_SCHEMES,
  run: string
) => {
  const { prefix, digits } = SEARCH_WORD_SCHEMES[scheme]
  return prefix + run.replace(/\d/g, (d) => digits[Number(d)])
}
