import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// CORE-4g (spec 01 กฎข้อ 63, AC-99 grep): e2e ที่ลบข้อมูลของ test ใน `finally` ต้องตรวจ `.ok()` ของ `request.delete`
// (cleanup ที่ล้มเงียบทิ้งข้อมูลค้างให้ test อื่น) และ e2e ที่วัด layout ของฟอร์ม checkout รอ `document.fonts.ready` ก่อนวัด
const E2E = __dirname
const specs = fs
  .readdirSync(E2E)
  .filter((name) => name.endsWith(".spec.ts") && !name.endsWith(".unit.spec.ts"))

/** เนื้อหาของทุก `finally { ... }` ในไฟล์ (นับวงเล็บปีกกา) */
const finallyBlocks = (source: string) => {
  const blocks: string[] = []
  const re = /finally\s*\{/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) {
    let depth = 1
    let i = match.index + match[0].length
    while (depth > 0 && i < source.length) {
      if (source[i] === "{") depth++
      if (source[i] === "}") depth--
      i++
    }
    blocks.push(source.slice(match.index, i))
  }
  return blocks
}

test("AC-99: request.delete ใน finally ตรวจ .ok() ทุกครั้ง", () => {
  const offenders = specs.flatMap((name) =>
    finallyBlocks(fs.readFileSync(path.join(E2E, name), "utf8"))
      .filter((block) => {
        const deletes = block.match(/request\.delete\(/g)?.length ?? 0
        const checks = block.match(/\.ok\(\)/g)?.length ?? 0
        return deletes > checks
      })
      .map((block) => `${name}: ${block.split("\n").slice(0, 3).join(" ").trim()}`)
  )
  expect(offenders).toEqual([])
})

test("AC-99: e2e ที่วัด layout ของฟอร์ม checkout รอ document.fonts.ready", () => {
  for (const name of ["core-4e-checkout-polish.spec.ts", "core-4g-checkout-polish.spec.ts"]) {
    expect(fs.readFileSync(path.join(E2E, name), "utf8"), name).toContain("document.fonts.ready")
  }
})
