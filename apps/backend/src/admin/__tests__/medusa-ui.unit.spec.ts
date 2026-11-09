// spec 08 static checks ของ src/admin — AC-2 (ADM-1, ADM-8a), AC-3/AC-4 (ADM-2b), AC-5 (ADM-2a), AC-6 (ADM-3), AC-7 (ADM-4)
import { readdirSync, readFileSync } from "fs"
import { join } from "path"

const ADMIN_DIR = join(__dirname, "..")
const ROUTES_DIR = join(ADMIN_DIR, "routes")

// route ที่ยังไม่ได้ทำตาม AC-2 — ว่างตั้งแต่ ADM-8a (route ใหม่ที่ยังไม่มี icon ต้องเพิ่มที่นี่ชั่วคราว)
const ICON_PENDING: string[] = []

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

  // review #186: ลืมลบ route ออกจาก ICON_PENDING หลังใส่ icon แล้ว → ล้ม (it ธรรมดาเพราะ it.each ไม่รับ array ว่าง)
  it("route ใน ICON_PENDING ยังไม่มี icon: (ใส่แล้วต้องลบออกจากรายการ)", () => {
    const withIcon = routePages
      .filter((r) => ICON_PENDING.includes(r.name))
      .filter((r) => /\bicon:/.test(r.src.slice(r.src.indexOf("defineRouteConfig("))))
      .map((r) => r.name)
    expect(withIcon).toEqual([])
  })
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
      // ADM-10: offset จาก URL ผ่าน usePageOffset (กฎ 13)
      expect(src).toMatch(/usePageOffset\(PREFIX,/)
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

describe("ตาราง/ฟอร์ม partner ใช้ของ Medusa (spec 08 AC-8, ADM-5)", () => {
  const file = "components/evoucher/partners-section.tsx"

  it("ใช้ DataTable, ActionMenu, NoRecords, Form, KeyboundForm ของ @medusajs/dashboard/components และ usePageOffset", () => {
    const src = read(file)
    for (const name of ["DataTable", "ActionMenu", "NoRecords", "Form", "KeyboundForm"]) {
      expect(importsFrom(src, name, "@medusajs/dashboard/components")).toBe(true)
    }
    expect(importsFrom(src, "DataTable", "@medusajs/ui")).toBe(false)
    expect(src).toMatch(/usePageOffset\(PREFIX,/)
    expect(src).not.toMatch(/\bDataTablePaginationState\b/)
  })

  it("Edit/Delete ต่อแถวอยู่ใน ActionMenu (trigger evoucher-partner-row-actions) และว่างแสดง evoucher-partners-empty", () => {
    const src = read(file)
    expect(src).toContain('data-testid="evoucher-partner-row-actions"')
    expect(src).toContain('data-testid="evoucher-partners-empty"')
  })

  it("ฟอร์มใช้ useForm + zodResolver (raw) + noValidate และกันกดซ้ำด้วย useState(createSingleFlight)", () => {
    const src = read(file)
    expect(src).toMatch(/import\s*{[^}]*\buseForm\b[^}]*}\s*from\s*["']react-hook-form["']/)
    expect(src).toMatch(/import\s*{[^}]*\bzodResolver\b[^}]*}\s*from\s*["']@hookform\/resolvers\/zod["']/)
    expect(src).toMatch(/raw:\s*true/)
    expect(src).toMatch(/\bnoValidate\b/)
    expect(src).toMatch(/useState\(createSingleFlight\)/)
    expect(src).not.toMatch(/\b(toForm|toBody|setForm)\b/)
    expect(src).not.toMatch(/\buseRef\b/)
    expect(src).not.toMatch(/toast\.error\("Name is required"\)/)
  })

  it("lib/evoucher-partner-form.ts ตรวจ URL ด้วย new URL(...).protocol และไม่ import ui/components/hooks (กฎ 2)", () => {
    const src = read("lib/evoucher-partner-form.ts")
    expect(src).toMatch(/new URL\(/)
    expect(src).toMatch(/\.protocol\b/)
    expect(src).toMatch(/\bfieldErrorMap\b/)
    expect(src).not.toMatch(/from\s*["']@medusajs\/(ui|dashboard\/components|dashboard\/hooks)["']/)
  })

  it("listPartners รับ limit/offset จากผู้เรียก ไม่ตัดที่ limit: 100 เอง (กฎ 11)", () => {
    const src = read("lib/evoucher.ts")
    const listPartners = src.slice(src.indexOf("listPartners:"), src.indexOf("createPartner:"))
    expect(listPartners).toMatch(/limit:\s*number;\s*offset:\s*number/)
    expect(listPartners).not.toMatch(/limit:\s*100/)
  })
})

describe("ตาราง affiliate ใช้ของ Medusa (spec 08 AC-2, AC-11, ADM-8a)", () => {
  const TABLES = [
    "components/affiliate/programs-table.tsx",
    "components/affiliate/affiliates-table.tsx",
    "components/affiliate/payouts-table.tsx",
    "routes/affiliate/page.tsx",
  ]

  it("lib/affiliate-format.ts ถูกลบแล้ว (เงินใช้ getLocaleAmount, วันเวลาใช้ useDate)", () => {
    expect(adminFiles).not.toContain("lib/affiliate-format.ts")
    expect(adminFiles.filter((f) => /affiliate-format/.test(read(f)))).toEqual([])
  })

  it("route affiliate อยู่ในชุดที่ตรวจ icon ของ AC-2", () => {
    expect(routePages.map((r) => r.name)).toContain("affiliate")
  })

  it("list-table: DataTable ของ dashboard + usePageOffset, ไม่มี state แบ่งหน้าเองและไม่มี as unknown as", () => {
    const src = read("components/affiliate/list-table.tsx")
    expect(importsFrom(src, "DataTable", "@medusajs/dashboard/components")).toBe(true)
    expect(importsFrom(src, "DataTable", "@medusajs/ui")).toBe(false)
    expect(src).toMatch(/usePageOffset\(prefix,/)
    expect(src).not.toMatch(/\b(DataTablePaginationState|useDataTable)\b/)
    expect(src).not.toMatch(/as unknown as/)
  })

  it("query ชื่อ affiliate ตั้ง placeholderData: keepPreviousData (AF-14 nit #187)", () => {
    const queries = read("components/affiliate/list-table.tsx").split("useQuery(").slice(1)
    const names = queries.filter((q) => q.includes("listAffiliateNames("))
    expect(names).toHaveLength(1)
    expect(names[0].slice(0, names[0].indexOf("})"))).toMatch(/placeholderData:\s*keepPreviousData/)
  })

  it("แต่ละแท็บใช้ prefix ไม่ซ้ำกัน (กฎ 9)", () => {
    const prefixes = TABLES.flatMap((f) =>
      [...read(f).matchAll(/useAffiliateList(?:<[^>]*>)?\(\s*"[a-z]+",\s*"([a-z_]+)"/g)].map((m) => m[1])
    )
    expect(prefixes.sort()).toEqual(["affiliates", "ledger", "payouts", "programs"])
  })

  it.each(TABLES)("%s ใช้ useDate/getLocaleAmount ของ dashboard ไม่ใช่ formatter เอง", (file) => {
    const src = read(file)
    expect(src).not.toMatch(/\bformat(Date|Amount)\b/)
    expect(importsFrom(src, "useDate", "@medusajs/dashboard/hooks")).toBe(true)
  })

  it.each(["routes/affiliate/page.tsx", "components/affiliate/payouts-table.tsx", "components/affiliate/mark-paid-prompt.tsx"])(
    "%s แสดงเงินด้วย getLocaleAmount + castNumber จาก @medusajs/dashboard/lib",
    (file) => {
      const src = read(file)
      expect(importsFrom(src, "getLocaleAmount", "@medusajs/dashboard/lib")).toBe(true)
      expect(importsFrom(src, "castNumber", "@medusajs/dashboard/lib")).toBe(true)
    }
  )

  it("หน้า affiliate ใช้ Header ของ components/common", () => {
    expect(read("routes/affiliate/page.tsx")).toMatch(/from\s*["'](?:\.{1,2}\/)+components\/common\/header["']/)
  })

  // payouts-table ยังมี useRef(false) จนถึง ADM-8b; program-form/payout-info-drawer เป็นของ ADM-9 — ตรวจเฉพาะไฟล์ที่ ADM-8a ปรับครบแล้ว
  it.each([
    "components/affiliate/list-table.tsx",
    "components/affiliate/programs-table.tsx",
    "components/affiliate/affiliates-table.tsx",
    "components/affiliate/mark-paid-prompt.tsx",
    "routes/affiliate/page.tsx",
  ])("%s ไม่มี pattern ต้องห้ามของกฎ 4–6", (file) => {
    const src = read(file)
    expect(FORBIDDEN.filter(([, re]) => re.test(src)).map(([name]) => name)).toEqual([])
  })

  it("payouts-table ไม่มี pattern วันเวลา/เงินต้องห้าม (useRef(false) รอ ADM-8b)", () => {
    const src = read("components/affiliate/payouts-table.tsx")
    const found = FORBIDDEN.filter(([name]) => name !== "useRef(false)")
      .filter(([, re]) => re.test(src))
      .map(([name]) => name)
    expect(found).toEqual([])
  })
})

// ADM-10 (spec 08 กฎ 13, AC-14): offset ใน URL ของตาราง DataTable ของ dashboard ผ่านของกลางชุดเดียว
describe("page offset ของกลาง (spec 08 AC-14)", () => {
  const PAGE_OFFSET_USERS = [
    "routes/group-buying/page.tsx",
    "components/evoucher/pools-table.tsx",
    "components/evoucher/codes-table.tsx",
    // กฎ 13e: ตารางที่ merge ก่อน ADM-10
    "components/evoucher/partners-section.tsx",
    "components/affiliate/list-table.tsx",
  ]
  const importsHook = (src: string) =>
    /import\s*{[^}]*\busePageOffset\b[^}]*}\s*from\s*["'](?:\.{1,2}\/)+(?:components\/)?common\/use-page-offset["']/.test(src)

  it("lib/group-buy-campaign.ts ไม่มี pageOffset", () => {
    expect(read("lib/group-buy-campaign.ts")).not.toMatch(/\bpageOffset\b/)
  })

  it("lib/evoucher-query.ts ไม่มี toOffset", () => {
    expect(read("lib/evoucher-query.ts")).not.toMatch(/\btoOffset\b/)
  })

  it("use-page-offset ถูก import อย่างน้อย 3 ไฟล์", () => {
    expect(adminFiles.filter((f) => importsHook(read(f))).length).toBeGreaterThanOrEqual(3)
  })

  it.each(PAGE_OFFSET_USERS)("%s ใช้ usePageOffset และไม่เขียน offset ลง URL เอง", (file) => {
    const src = read(file)
    expect(importsHook(src)).toBe(true)
    expect(src).not.toMatch(/\bsetSearchParams\b/)
  })

  it("codes-table.tsx ไม่มี useSearchParams (reset เมื่อ filter เปลี่ยนอยู่ใน hook — กฎ 13c)", () => {
    expect(read("components/evoucher/codes-table.tsx")).not.toMatch(/\buseSearchParams\b/)
  })
})

// ADM-12 (spec 08 AC-16, กฎ 15): ช่อง number ที่ว่างได้ผ่านของกลางชิ้นเดียว — ตรวจ validity.badInput ไม่ให้ "e" กลายเป็น "ว่าง"
describe("ช่อง number ใช้ NumberInput ของกลาง (spec 08 AC-16, ADM-12)", () => {
  const NUMBER_INPUT_FROM = String.raw`(?:\.{1,2}\/)+components\/common\/number-input`

  it.each(["widgets/flash-sale-options.tsx", "widgets/variant-evoucher-pool.tsx"])(
    "%s import NumberInput จาก components/common/number-input และไม่มี Input type number เอง",
    (file) => {
      const src = read(file)
      expect(importsFrom(src, "NumberInput", NUMBER_INPUT_FROM)).toBe(true)
      expect(src).not.toMatch(/type(?:=|:\s*)["']number["']|"number"\)/)
    }
  )

  it("components/common/number-input.tsx ห่อ Input ของ @medusajs/ui และตรวจ badInput ผ่าน helper เดียว", () => {
    const src = read("components/common/number-input.tsx")
    expect(importsFrom(src, "Input", "@medusajs/ui")).toBe(true)
    expect(importsFrom(src, "numberInputValue", String.raw`(?:\.{1,2}\/)+lib\/form-validation`)).toBe(true)
  })
})

// ADM-13 (spec 08 AC-17, กฎ 16, 18): หัวตารางและปุ่มสร้างอยู่ใน DataTable ของ dashboard; CreateCampaign เป็น controlled
describe("หน้ารายการแคมเปญใช้หัวตารางของ DataTable (spec 08 AC-17, ADM-13)", () => {
  const LIST_PAGE = "routes/group-buying/page.tsx"
  const CREATE_CAMPAIGN = "components/group-buy/create-campaign.tsx"

  it("routes/group-buying/page.tsx ไม่ import components/common/header", () => {
    expect(read(LIST_PAGE)).not.toMatch(/components\/common\/header/)
  })

  it("heading/subHeading/action อยู่ที่ DataTable ภายใน wrapper gb-campaigns-table และเปิด modal แบบ controlled", () => {
    const src = read(LIST_PAGE)
    const wrapper = src.slice(src.indexOf('data-testid="gb-campaigns-table"'))
    expect(wrapper).toMatch(/<DataTable\b/)
    expect(wrapper).toMatch(/heading="Group-buy campaigns"/)
    expect(wrapper).toMatch(/subHeading=/)
    expect(wrapper).toMatch(/action=\{\{\s*label: "Create campaign",\s*onClick:/)
    expect(src).toMatch(/<CreateCampaign\s+open=\{\w+\}\s+onOpenChange=\{\w+\}/)
  })

  it("คำเตือน GBT- อยู่ในหน้าเดียวกันด้วย testid gb-template-warning", () => {
    expect(read(LIST_PAGE)).toMatch(/data-testid="gb-template-warning"/)
  })

  it("create-campaign ไม่มีปุ่ม gb-campaign-create (คง gb-campaign-create-submit)", () => {
    const src = read(CREATE_CAMPAIGN)
    expect(src).not.toMatch(/["']gb-campaign-create["']/)
    expect(src).toMatch(/data-testid="gb-campaign-create-submit"/)
  })

  it("CreateCampaign รับ open/onOpenChange ไม่ถือ state open เอง และตั้ง key + reset ฟอร์มเมื่อเปิด", () => {
    const src = read(CREATE_CAMPAIGN)
    expect(src).toMatch(/CreateCampaign = \(\{\s*open,\s*onOpenChange,?\s*\}/)
    expect(src).not.toMatch(/useState\(false\)/)
    expect(src).toMatch(/<FocusModal open=\{open\}/)
    expect(src).toMatch(/useEffect\(\(\) => \{\s*if \(!open\) return\s*setIdempotencyKey\(newIdempotencyKey\(\)\)\s*form\.reset\(emptyCampaignForm\(\)\)/)
  })
})
