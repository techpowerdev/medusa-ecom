import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// CORE-15b (spec 01 กฎข้อ 76, AC-114): `instantsearch.js` ที่ storefront import ตรง (type `SearchClient`)
// ต้องเป็นตัวเดียวกับที่ `react-instantsearch` ใช้ — lockfile มีสำเนาเดียว ไม่งั้น type/instance ของสองสำเนาไม่ตรงกัน
const ROOT = path.resolve(__dirname, "../../..")
const lockfile = readFileSync(path.join(ROOT, "pnpm-lock.yaml"), "utf8")
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "../package.json"), "utf8")
) as { dependencies: Record<string, string> }

/** เวอร์ชันของ `instantsearch.js` ที่ lockfile resolve (key ของ section packages) */
const resolvedVersions = () =>
  Array.from(
    new Set(
      Array.from(
        lockfile.matchAll(/^ {2}instantsearch\.js@([^(:\s]+)/gm),
        (m) => m[1]
      )
    )
  )

/** เวอร์ชันของ `instantsearch.js` ใน dependencies ของ snapshot `react-instantsearch-core` (key ที่มี peer ในวงเล็บ) */
const versionUsedByReactInstantSearch = () => {
  const snapshot = lockfile.match(
    /^ {2}react-instantsearch-core@[^\s(]+\([^\n]+:\n(?: {4,}[^\n]*\n)*/m
  )?.[0]
  return snapshot?.match(/^ {6}instantsearch\.js: ([^(\s]+)/m)?.[1]
}

describe("CORE-15b — pin instantsearch.js (AC-114)", () => {
  it("pnpm-lock.yaml มี instantsearch.js เวอร์ชันเดียว", () => {
    expect(resolvedVersions()).toHaveLength(1)
  })

  it("package.json pin instantsearch.js เวอร์ชันเดียวกับที่ react-instantsearch ใช้", () => {
    const used = versionUsedByReactInstantSearch()
    expect(used).toMatch(/^\d+\.\d+\.\d+$/)
    expect(pkg.dependencies["instantsearch.js"]).toBe(used)
  })
})
