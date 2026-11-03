// spec 08 static checks ของ src/admin — AC-2 (ADM-1, ADM-8a), AC-5 (ADM-2a)
import { readdirSync, readFileSync } from "fs"
import { join } from "path"

const ADMIN_DIR = join(__dirname, "..")
const ROUTES_DIR = join(ADMIN_DIR, "routes")

// route ที่ยังไม่ได้ทำตาม AC-2 — ต้องว่างเมื่อ ADM-8a merge
const ICON_PENDING = ["affiliate"]

const routePages = readdirSync(ROUTES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => ({ name: d.name, file: join(ROUTES_DIR, d.name, "page.tsx") }))
  .map((r) => ({ ...r, src: readFileSync(r.file, "utf8") }))
  .filter((r) => r.src.includes("defineRouteConfig("))

describe("route config icon (spec 08 AC-2)", () => {
  it("พบ route ที่ต้องตรวจ", () => {
    expect(routePages.map((r) => r.name)).toEqual(
      expect.arrayContaining(["evouchers", "group-buying"])
    )
  })

  it.each(routePages.filter((r) => !ICON_PENDING.includes(r.name)).map((r) => [r.name, r.src]))(
    "%s มี icon ที่ import จาก @medusajs/icons",
    (_name, src) => {
      const config = src.slice(src.indexOf("defineRouteConfig("))
      const icon = config.match(/\bicon:\s*([A-Za-z0-9_]+)/)
      expect(icon).not.toBeNull()
      const importRe = new RegExp(
        `import\\s*{[^}]*\\b${icon![1]}\\b[^}]*}\\s*from\\s*["']@medusajs/icons["']`
      )
      expect(src).toMatch(importRe)
    }
  )
})

// ไฟล์ .ts/.tsx ทั้งหมดใน src/admin (ยกเว้น test) เป็น path สัมพัทธ์ เช่น "widgets/order-evouchers.tsx"
const adminFiles: string[] = (readdirSync(ADMIN_DIR, { recursive: true }) as string[])
  .map((f) => f.split("\\").join("/"))
  .filter((f) => /\.tsx?$/.test(f) && !f.includes("__tests__/"))
const read = (file: string) => readFileSync(join(ADMIN_DIR, file), "utf8")

describe("Header + SectionRow (spec 08 AC-5)", () => {
  it("components/common/header.tsx ถูก import อย่างน้อย 2 ไฟล์", () => {
    const importers = adminFiles.filter((f) =>
      /from\s*["'](?:\.{1,2}\/)+components\/common\/header["']/.test(read(f))
    )
    expect(importers.length).toBeGreaterThanOrEqual(2)
  })

  it.each(["widgets/flash-sale-options.tsx", "widgets/variant-evoucher-pool.tsx"])(
    "%s ใช้ SectionRow จาก @medusajs/dashboard/components แทน Field/Row เอง",
    (file) => {
      const src = read(file)
      expect(src).toMatch(
        /import\s*{[^}]*\bSectionRow\b[^}]*}\s*from\s*["']@medusajs\/dashboard\/components["']/
      )
      expect(src).not.toMatch(/const (Field|Row) =/)
    }
  )
})

// spec 08 AC-4: ไฟล์ที่ยังไม่ปรับ — ADM-2b เพิ่มข้อตรวจ pattern ต้องห้ามกับไฟล์นอกรายการนี้ และ task ที่แตะไฟล์ใด
// ต้องลบไฟล์นั้นออกจากรายการใน PR เดียวกัน; ต้องว่างเมื่อ ADM-1..9 merge ครบ (AC-12)
// รูปแบบ entry: path ตรง, "<dir>/**" (ทั้งโฟลเดอร์) หรือ "<prefix>*" (ชื่อขึ้นต้นด้วย)
const AC4_EXCEPTIONS = [
  "components/affiliate/**",
  "routes/affiliate/**",
  "lib/affiliate*",
  "components/group-buy/create-campaign.tsx",
  "components/group-buy/groups-section.tsx",
  "lib/group-buy-form.ts",
]

const matchesEntry = (entry: string, file: string) =>
  entry.endsWith("/**")
    ? file.startsWith(entry.slice(0, -2))
    : entry.endsWith("*")
      ? file.startsWith(entry.slice(0, -1))
      : file === entry

const isAc4Exception = (file: string) => AC4_EXCEPTIONS.some((entry) => matchesEntry(entry, file))

describe("รายการข้อยกเว้นของ AC-4 (spec 08)", () => {
  it.each(AC4_EXCEPTIONS)("%s ยังตรงกับไฟล์ที่มีอยู่ (ไม่ค้างหลังไฟล์ถูกลบ/ย้าย)", (entry) => {
    expect(adminFiles.some((f) => matchesEntry(entry, f))).toBe(true)
  })

  it("จับเฉพาะไฟล์ในรายการ", () => {
    expect(isAc4Exception("components/affiliate/list-table.tsx")).toBe(true)
    expect(isAc4Exception("lib/affiliate-format.ts")).toBe(true)
    expect(isAc4Exception("widgets/order-evouchers.tsx")).toBe(false)
    expect(isAc4Exception("components/group-buy/group-members.tsx")).toBe(false)
  })
})
