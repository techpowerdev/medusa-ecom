import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { STORE_CONTENT, STORE_NAME } from "./lib/store-content"

// CORE-18: spec 01 กฎข้อ 33, AC-61 (ส่วนอ่านไฟล์), AC-67
const SRC = __dirname
const THAI = /[฀-๿]/
const SELF = path.basename(__filename)

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return sourceFiles(full)
    }
    return /\.(ts|tsx)$/.test(entry.name) && entry.name !== SELF ? [full] : []
  })

const filesMatching = (pattern: RegExp) =>
  sourceFiles(SRC)
    .filter((file) => pattern.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(SRC, file))

describe("ไม่มี component onboarding ของ starter (AC-67)", () => {
  it("ไม่มีโฟลเดอร์ product-onboarding-cta", () => {
    expect(
      fs.existsSync(path.join(SRC, "modules/products/components/product-onboarding-cta"))
    ).toBe(false)
  })

  it("ไม่มีการ import product-onboarding-cta", () => {
    expect(filesMatching(/product-onboarding-cta/)).toEqual([])
  })

  it("ไม่มีสตริง localhost:7001", () => {
    expect(filesMatching(/localhost:7001/)).toEqual([])
  })
})

describe("ไม่มีข้อความ/ลิงก์โฆษณาของ starter (กฎข้อ 33)", () => {
  it("ไม่มีลิงก์ไป github.com, medusajs.com, nextjs.org", () => {
    expect(filesMatching(/https?:\/\/[\w.]*(github\.com|medusajs\.com|nextjs\.org)/)).toEqual([])
  })

  it("ไม่มีชื่อร้าน Medusa Store และ component medusa-cta", () => {
    expect(filesMatching(/Medusa Store|medusa-cta/)).toEqual([])
    expect(fs.existsSync(path.join(SRC, "modules/layout/components/medusa-cta"))).toBe(false)
  })
})

describe("ชื่อร้านในหน้า account และ site.ts มาจาก store-content (AC-74)", () => {
  it.each([
    "modules/account/components/register/index.tsx",
    "app/[countryCode]/(main)/account/@login/page.tsx",
    "app/[countryCode]/(main)/account/@dashboard/profile/page.tsx",
    "lib/util/site.ts",
  ])("%s ไม่มี Medusa Store", (file) => {
    expect(fs.readFileSync(path.join(SRC, file), "utf8")).not.toContain("Medusa Store")
  })

  it("site.ts export STORE_NAME จาก store-content", () => {
    expect(fs.readFileSync(path.join(SRC, "lib/util/site.ts"), "utf8")).toMatch(
      /export \{ STORE_NAME \} from "@lib\/store-content"/
    )
  })
})

describe("เนื้อหาร้านรวมไว้ที่ src/lib/store-content.ts (AC-61)", () => {
  it("มี TODO(owner-content) ให้ owner แก้", () => {
    const content = fs.readFileSync(path.join(SRC, "lib/store-content.ts"), "utf8")
    expect(content).toContain("TODO(owner-content)")
  })

  it("ชื่อร้าน, hero, footer และ metadata เป็นภาษาไทย ไม่มีชื่อ starter", () => {
    const texts = [
      STORE_NAME,
      STORE_CONTENT.description,
      STORE_CONTENT.hero.title,
      STORE_CONTENT.hero.subtitle,
      STORE_CONTENT.hero.ctaLabel,
      STORE_CONTENT.footer.tagline,
      STORE_CONTENT.policyPlaceholderNotice,
    ]
    for (const text of texts) {
      expect(text).toMatch(THAI)
      expect(text).not.toMatch(/Medusa|Next\.js|GitHub/i)
    }
  })
})
