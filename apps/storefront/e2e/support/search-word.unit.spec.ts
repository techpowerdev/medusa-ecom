import { expect, test } from "@playwright/test"

import { SEARCH_WORD_SCHEMES, thaiRunWord } from "./search-word"

// CORE-86 (spec 01 กฎข้อ 142, AC-183): คำค้นไทยเฉพาะ run ของแต่ละ spec ต้องไม่ชนกันเมื่อรันหลาย worker
// (ค้นแบบ word_similarity > 0.3 ของ pg_trgm — ตัวเลขของ run ที่ใกล้กันทำให้คำคล้ายกันเกินเกณฑ์ ถ้าใช้ตัวอักษรชุดเดียวกัน)
const schemes = Object.entries(SEARCH_WORD_SCHEMES)

const trigrams = (word: string) => {
  const chars = Array.from(word)
  return new Set(
    chars.slice(0, -2).map((_, i) => chars.slice(i, i + 3).join(""))
  )
}

test.describe("thaiRunWord", () => {
  test("มีอย่างน้อยสอง scheme (core-75 และ fs14) และตัวเลข 10 ตัวไม่ซ้ำกันในแต่ละ scheme", () => {
    expect(Object.keys(SEARCH_WORD_SCHEMES).sort()).toEqual(
      expect.arrayContaining(["core75", "fs14"])
    )
    for (const [, { digits }] of schemes) {
      expect(new Set(Array.from(digits)).size).toBe(10)
    }
  })

  test("คำนำหน้าต่างกันและไม่เป็น substring ของกัน", () => {
    for (const [a, sa] of schemes) {
      for (const [b, sb] of schemes) {
        if (a === b) continue
        expect(sa.prefix.length, a).toBeGreaterThan(0)
        expect(sb.prefix.includes(sa.prefix), `${a} ใน ${b}`).toBe(false)
      }
    }
  })

  test("อักษรของสอง scheme ไม่ซ้ำกันเลย → คำจาก run ใกล้กัน/เดียวกันไม่มี trigram ร่วม", () => {
    const run = "1763712345678"
    const near = "1763712345679"
    for (const [a, sa] of schemes) {
      for (const [b, sb] of schemes) {
        if (a === b) continue
        const charsB = new Set(Array.from(sb.prefix + sb.digits))
        expect(
          Array.from(sa.prefix + sa.digits).filter((c) => charsB.has(c)),
          `${a}/${b}`
        ).toEqual([])
        const tb = trigrams(
          thaiRunWord(b as keyof typeof SEARCH_WORD_SCHEMES, near)
        )
        const shared = Array.from(
          trigrams(thaiRunWord(a as keyof typeof SEARCH_WORD_SCHEMES, run))
        ).filter((t) => tb.has(t))
        expect(shared, `${a}/${b}`).toEqual([])
      }
    }
  })

  test("คำ = คำนำหน้า + ตัวเลขของ run แปลงเป็นอักษรไทยของ scheme (ไม่มีตัวเลขเหลือ)", () => {
    const { prefix, digits } = SEARCH_WORD_SCHEMES.core75
    expect(thaiRunWord("core75", "0129")).toBe(
      prefix + digits[0] + digits[1] + digits[2] + digits[9]
    )
    expect(thaiRunWord("fs14", "1763712345678")).not.toMatch(/\d/)
  })
})
