// spec 08 static checks ของ src/admin — AC-2 (ADM-1, ADM-8a), AC-3/AC-4 (ADM-2b), AC-5 (ADM-2a), AC-6 (ADM-3), AC-7 (ADM-4)
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
    "components/group-buy/groups-section.tsx",
    "routes/group-buying/[id]/page.tsx",
    "components/evoucher/codes-table.tsx",
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

describe("ฟอร์ม pilot ใช้ Form + KeyboundForm + zod (spec 08 AC-6, กฎ 8, ADM-3)", () => {
  it.each(["widgets/flash-sale-options.tsx", "widgets/variant-evoucher-pool.tsx"])(
    "%s ใช้ Form/KeyboundForm ของ dashboard + useForm + zodResolver และไม่ถือค่าฟอร์มด้วย useState",
    (file) => {
      const src = read(file)
      expect(src).toMatch(
        /import\s*{[^}]*\bForm\b[^}]*\bKeyboundForm\b[^}]*}\s*from\s*["']@medusajs\/dashboard\/components["']/
      )
      expect(src).toMatch(/import\s*{[^}]*\buseForm\b[^}]*}\s*from\s*["']react-hook-form["']/)
      expect(src).toMatch(/import\s*{[^}]*\bzodResolver\b[^}]*}\s*from\s*["']@hookform\/resolvers\/zod["']/)
      expect(src).toMatch(/useState\(createSingleFlight\)/)
      expect(src).not.toMatch(/\b(toForm|EMPTY|parseLimit|setForm)\b/)
      expect(src).not.toMatch(/\buseRef\b/)
    }
  )

  it.each(["lib/flash-sale-form.ts", "lib/evoucher-pool-form.ts"])(
    "%s ใช้ optionalInt จาก @medusajs/dashboard/lib (ไม่ import ui/components/hooks — กฎ 2)",
    (file) => {
      const src = read(file)
      expect(src).toMatch(/import\s*{[^}]*\boptionalInt\b[^}]*}\s*from\s*["']@medusajs\/dashboard\/lib["']/)
      expect(src).not.toMatch(/from\s*["']@medusajs\/(ui|dashboard\/components|dashboard\/hooks)["']/)
    }
  )
})

const importsFrom = (src: string, name: string, from: string) =>
  new RegExp(`import\\s*{[^}]*\\b${name}\\b[^}]*}\\s*from\\s*["']${from}["']`).test(src)

describe("หน้า e-voucher ใช้ของ Medusa (spec 08 AC-7, ADM-4)", () => {
  it.each(["components/evoucher/pools-table.tsx", "components/evoucher/codes-table.tsx"])(
    "%s ใช้ DataTable ของ @medusajs/dashboard/components (แบ่งหน้าใน URL) ไม่ใช่ state เอง",
    (file) => {
      const src = read(file)
      expect(importsFrom(src, "DataTable", "@medusajs/dashboard/components")).toBe(true)
      expect(importsFrom(src, "DataTable", "@medusajs/ui")).toBe(false)
      expect(src).not.toMatch(/\bDataTablePaginationState\b/)
      expect(importsFrom(src, "useQueryParams", "@medusajs/dashboard/hooks")).toBe(true)
    }
  )

  it("codes-table: Reveal ต่อแถวอยู่ใน ActionMenu (trigger evoucher-code-row-actions) และกรองสถานะด้วย filters ของ DataTable", () => {
    const src = read("components/evoucher/codes-table.tsx")
    expect(importsFrom(src, "ActionMenu", "@medusajs/dashboard/components")).toBe(true)
    expect(src).toContain('data-testid="evoucher-code-row-actions"')
    expect(src).toMatch(/\bfilters=/)
    expect(importsFrom(src, "Select", "@medusajs/ui")).toBe(false)
  })

  it.each(["routes/evouchers/page.tsx", "routes/evouchers/pools/[id]/page.tsx"])(
    "%s ใช้ LayoutComposer ของ @medusajs/dashboard/components",
    (file) => {
      const src = read(file)
      expect(importsFrom(src, "LayoutComposer", "@medusajs/dashboard/components")).toBe(true)
      expect(src).not.toMatch(/className="flex flex-col gap-y-3"/)
    }
  )

  it("หน้า pool ใช้ Header + SectionRow", () => {
    const src = read("routes/evouchers/pools/[id]/page.tsx")
    expect(importsFrom(src, "SectionRow", "@medusajs/dashboard/components")).toBe(true)
    expect(src).toMatch(/from\s*["'](?:\.{1,2}\/)+components\/common\/header["']/)
  })

  it("import-codes ใช้ Header และกันกดซ้ำด้วย useState(createSingleFlight) (useRef ใช้แค่อ้าง input file)", () => {
    const src = read("components/evoucher/import-codes.tsx")
    expect(src).toMatch(/from\s*["'](?:\.{1,2}\/)+common\/header["']/)
    expect(src).toMatch(/useState\(createSingleFlight\)/)
    expect(src).not.toMatch(/upload\.mutate\(/)
  })
})

describe("ฟอร์มสร้างแคมเปญ group buy ใช้ Form + DatePicker และ product picker ใช้ useProducts (spec 08 AC-10, ADM-7)", () => {
  const campaign = () => read("components/group-buy/create-campaign.tsx")
  const picker = () => read("components/group-buy/product-picker.tsx")

  it("create-campaign ใช้ Form/KeyboundForm ของ dashboard + useForm + zodResolver และไม่ถือค่าฟอร์มด้วย useState", () => {
    const src = campaign()
    expect(src).toMatch(
      /import\s*{[^}]*\bForm\b[^}]*\bKeyboundForm\b[^}]*}\s*from\s*["']@medusajs\/dashboard\/components["']/
    )
    expect(importsFrom(src, "useForm", "react-hook-form")).toBe(true)
    expect(importsFrom(src, "zodResolver", "@hookform/resolvers/zod")).toBe(true)
    expect(src).toMatch(/\{ raw: true \}/)
    expect(src).toMatch(/\bnoValidate\b/)
    expect(src).not.toMatch(/\b(setForm|useState\(emptyCampaignForm)\b/)
  })

  it("create-campaign กรอกวันเวลาด้วย DatePicker granularity=minute ไม่มี datetime-local", () => {
    const src = campaign()
    expect(importsFrom(src, "DatePicker", "@medusajs/ui")).toBe(true)
    expect(src.match(/granularity="minute"/g)?.length).toBeGreaterThanOrEqual(1)
    expect(src).not.toMatch(/datetime-local/)
  })

  it("create-campaign คง toCampaignBody → form.setError และ idempotency key ของ GB-15 ที่ตั้งตอน openModal", () => {
    const src = campaign()
    expect(src).toMatch(/toCampaignBody\(/)
    expect(src).toMatch(/form\.setError\(/)
    expect(src).toMatch(/newIdempotencyKey\(\)/)
    expect(src).toMatch(/idempotency_key/)
  })

  it("create-campaign กันกดซ้ำด้วย useState(createSingleFlight) และไม่มี useRef", () => {
    const src = campaign()
    expect(src).toMatch(/useState\(createSingleFlight\)/)
    expect(src).not.toMatch(/\buseRef\b/)
  })

  it("product-picker ใช้ useProducts ของ dashboard ไม่เรียก sdk.admin.product.list เอง และยังเป็น single select (GB-6e)", () => {
    const src = picker()
    expect(importsFrom(src, "useProducts", "@medusajs/dashboard/hooks")).toBe(true)
    expect(src).not.toMatch(/sdk\.admin\.product\.list/)
    expect(src).not.toMatch(/\buseQuery\b/)
    expect(src).toMatch(/selectSingleProduct\(/)
  })

  it("lib/group-buy-form.ts ใช้ z.date() และไม่ import ui/components/hooks (กฎ 2)", () => {
    const src = read("lib/group-buy-form.ts")
    expect(src).toMatch(/z\.date\(\)/)
    expect(src).not.toMatch(/from\s*["']@medusajs\/(ui|dashboard\/components|dashboard\/hooks)["']/)
  })
})
