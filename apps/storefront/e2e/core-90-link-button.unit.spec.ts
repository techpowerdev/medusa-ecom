import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// CORE-90 (spec 01 กฎข้อ 146b, AC-187 static): ไม่มี `<Button` เป็นลูกตรงของ `LocalizedClientLink` ใน src/modules/**
// (<button> ซ้อนใน <a> = Tab หยุดสองครั้งและ HTML ไม่ถูกต้อง) — ลิงก์ที่หน้าตาเป็นปุ่มใช้ `buttonClassName` บนลิงก์แทน
const MODULES = path.resolve(__dirname, "../src/modules")

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

// หา `<LocalizedClientLink …>` แล้วข้าม attribute จนถึง `>` ที่ปิด tag (ข้าม `>` ใน `{…}` และในสตริง เช่น `=>`)
// คืนตำแหน่ง (บรรทัด) ที่ลูกตัวแรกหลัง tag เปิดเป็น `<Button`
function nestedButtonLines(source: string): number[] {
  const lines: number[] = []
  const open = /<LocalizedClientLink\b/g
  let match: RegExpExecArray | null
  while ((match = open.exec(source))) {
    let i = match.index + match[0].length
    let depth = 0
    let quote: string | null = null
    for (; i < source.length; i++) {
      const c = source[i]
      if (quote) {
        if (c === quote) quote = null
      } else if (c === '"' || c === "'" || c === "`") quote = c
      else if (c === "{") depth++
      else if (c === "}") depth--
      else if (c === ">" && depth === 0) break
    }
    if (source[i - 1] === "/") continue // self-closing
    if (/^\s*<Button\b/.test(source.slice(i + 1))) {
      lines.push(source.slice(0, match.index).split("\n").length)
    }
  }
  return lines
}

test("AC-187: ไม่มี <Button เป็นลูกตรงของ LocalizedClientLink ใน src/modules/**", () => {
  const found = sourceFiles(MODULES).flatMap((file) =>
    nestedButtonLines(fs.readFileSync(file, "utf8")).map(
      (line) => `${path.relative(MODULES, file)}:${line}`
    )
  )
  expect(found).toEqual([])
})

for (const code of [
  '<LocalizedClientLink href="/cart">\n  <Button>ไป</Button>\n</LocalizedClientLink>',
  '<LocalizedClientLink href={`/a/${id}`} data-testid="x"><Button variant="secondary">x</Button></LocalizedClientLink>',
  '<LocalizedClientLink\n  href="/"\n  onClick={() => a > b}\n  passHref\n>\n  <Button\n    className="w-full"\n  >x</Button>\n</LocalizedClientLink>',
]) {
  test(`AC-187: จับรูปซ้อน ${code.replace(/\s+/g, " ").slice(0, 60)}`, () => {
    expect(nestedButtonLines(code)).toEqual([1])
  })
}

test("AC-187: ไม่จับลิงก์ที่ใช้ className ของปุ่ม หรือ Button ที่ไม่ใช่ลูกตรง", () => {
  expect(
    nestedButtonLines(
      '<LocalizedClientLink href="/" className={buttonClassName()}>x</LocalizedClientLink>\n' +
        '<LocalizedClientLink href="/"><span>x</span></LocalizedClientLink>\n<Button>y</Button>'
    )
  ).toEqual([])
})
