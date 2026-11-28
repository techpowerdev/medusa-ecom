import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

import { SRC, STOREFRONT, readSource } from "./support/sfui-source"

// SFUI-10 (spec 09 กฎ 24, AC-24): หลัง SFUI-9a–9e แทน utility ขนาดฟอนต์ของ starter ด้วย utility มาตรฐานครบแล้ว
// ลบนิยาม `@utility` ทั้ง 13 ตัวใน globals.css และ `cn` กลับเป็น re-export ตรงจาก package `cn` (ADR-030 ข้อ 3)
// — guard นี้กัน token / `cn` ที่ extend กลับมา

// regex เดียวกับ AC-20 (ประกอบจากส่วนย่อยเพื่อไม่ให้ไฟล์นี้มี token ตรงตัว)
const SIZES = ["xsmall", "small", "base", "large", "xl", "2xl", "3xl"].join("|")
const TOKEN = new RegExp(`\\btext-(?:${SIZES})-(?:regular|semi)\\b`, "g")

/** ทุกไฟล์ใต้ `src/` (ทุกนามสกุล รวม .css, test และ comment) — path สัมพัทธ์กับ apps/storefront */
function allFiles(dir: string = SRC): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return allFiles(full)
      return [path.relative(STOREFRONT, full).split(path.sep).join("/")]
    })
    .sort()
}

test("AC-24: ตัวจับ token จับครบ 13 ตัวและไม่นับ utility มาตรฐาน (control)", () => {
  const tokens = ["xsmall-regular", ...["small", "base", "large", "xl", "2xl", "3xl"].flatMap((s) => [`${s}-regular`, `${s}-semi`])]
  expect(tokens).toHaveLength(13)
  for (const t of tokens) {
    expect(`<p className="hover:text-${t} mt-2" />`.match(TOKEN), t).toEqual([`text-${t}`])
  }
  for (const plain of ["text-xs", "text-sm", "text-2xl", "text-[30px]", "font-semibold", "text-small", "text-base-x"]) {
    expect(plain.match(TOKEN), plain).toBeNull()
  }
})

test("AC-24 (a): ไม่มีไฟล์ใดใน src/** (รวม .css, test, comment) ที่มี utility ขนาดฟอนต์ของ starter", () => {
  const files = allFiles()
  expect(files).toContain("src/styles/globals.css")
  expect(files).toContain("src/lib/utils.test.ts")
  const hits = files.flatMap((file) =>
    readSource(file)
      .split("\n")
      .flatMap((line, i) => (line.match(TOKEN) ?? []).map((token) => `${file}:${i + 1} ${token}`))
  )
  expect(hits).toEqual([])
})

test("AC-24 (b): globals.css ไม่มี `@utility text-`", () => {
  expect(readSource("src/styles/globals.css")).not.toMatch(/@utility\s+text-/)
})

test("AC-24 (c): src/lib/utils.ts มีเพียง re-export cn จาก package cn และไม่มีไฟล์ใน src/ ที่อ้าง cn/config, createCn, FONT_SIZE_UTILITIES", () => {
  const code = readSource("src/lib/utils.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .trim()
  expect(code).toMatch(/^export\s*\{\s*cn\s*\}\s*from\s*["']cn["'];?$/)
  const refs = allFiles().filter((file) => /cn\/config|\bcreateCn\b|\bFONT_SIZE_UTILITIES\b/.test(readSource(file)))
  expect(refs).toEqual([])
})
