// spec 08 static checks ของ src/admin — AC-2 (ADM-1, ADM-8a), AC-3/AC-4 (ADM-2b), AC-5 (ADM-2a)
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

// spec 08 กฎ 4–6: pattern ต้องห้ามนอกรายการข้อยกเว้น (กันกดซ้ำด้วย createSingleFlight, วันเวลาด้วย useDate/DatePicker,
// เงินด้วย getLocaleAmount)
const FORBIDDEN: [string, RegExp][] = [
  ["useRef(false)", /useRef\(\s*false\s*\)/],
  ["datetime-local", /datetime-local/],
  ["ictToIso", /\bictToIso\b/],
  ["isoToIct", /\bisoToIct\b/],
  ["timeZone:", /\btimeZone\s*:/],
  ["toLocaleString(", /\.toLocaleString\(/],
  ["toLocaleDateString(", /\.toLocaleDateString\(/],
  ["Intl.DateTimeFormat(", /\bIntl\.DateTimeFormat\(/],
  ["Intl.NumberFormat(", /\bIntl\.NumberFormat\(/],
]

describe("pattern ต้องห้ามของกฎ 4–6 (spec 08 AC-4)", () => {
  const checked = adminFiles.filter((f) => !isAc4Exception(f))

  it("ตรวจไฟล์ที่ ADM-2a/2b ปรับแล้ว", () => {
    expect(checked).toEqual(
      expect.arrayContaining([
        "widgets/flash-sale-options.tsx",
        "widgets/order-evouchers.tsx",
        "components/group-buy/group-members.tsx",
        "routes/group-buying/[id]/page.tsx",
        "lib/evoucher.ts",
        "lib/group-buy.ts",
      ])
    )
  })

  it.each(checked)("%s ไม่มี pattern ต้องห้าม", (file) => {
    const src = read(file)
    const found = FORBIDDEN.filter(([, re]) => re.test(src)).map(([name]) => name)
    expect(found).toEqual([])
  })
})

describe("กันกดซ้ำด้วย createSingleFlight (spec 08 กฎ 4, ADM-2b)", () => {
  it.each([
    "widgets/flash-sale-options.tsx",
    "widgets/order-evouchers.tsx",
    "components/group-buy/group-members.tsx",
    "routes/group-buying/[id]/page.tsx",
  ])("%s ใช้ useState(createSingleFlight) และไม่มี useRef", (file) => {
    const src = read(file)
    expect(src).toMatch(/useState\(createSingleFlight\)/)
    expect(src).not.toMatch(/\buseRef\b/)
  })
})

describe("แสดงวันเวลาด้วย useDate (spec 08 AC-3, ADM-2b)", () => {
  it.each(["lib/evoucher.ts", "lib/group-buy.ts"])("%s ไม่มี formatDate/formatDateTime", (file) => {
    expect(read(file)).not.toMatch(/\bformatDate(Time)?\b/)
  })

  it.each([
    "widgets/order-evouchers.tsx",
    "components/evoucher/codes-table.tsx",
    "components/group-buy/group-members.tsx",
    "components/group-buy/groups-section.tsx",
    "routes/group-buying/page.tsx",
    "routes/group-buying/[id]/page.tsx",
  ])("%s (ผู้เรียกเดิม) ใช้ useDate จาก @medusajs/dashboard/hooks", (file) => {
    const src = read(file)
    expect(src).toMatch(/import\s*{[^}]*\buseDate\b[^}]*}\s*from\s*["']@medusajs\/dashboard\/hooks["']/)
    expect(src).not.toMatch(/\bformatDate(Time)?\b/)
  })
})
