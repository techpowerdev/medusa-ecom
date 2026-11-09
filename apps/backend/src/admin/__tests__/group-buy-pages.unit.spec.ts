// spec 08 AC-9 (ADM-6) static: หน้า group buy ใช้ของ Medusa — LayoutComposer, Header, DataTable ของ dashboard (rowHref),
// SectionRow + NoRecords + loader/breadcrumb; groups-section คง DataTable ของ ui แต่ใช้ Header + createSingleFlight
import { readFileSync } from "fs"
import { join } from "path"

const ADMIN_DIR = join(__dirname, "..")
const read = (file: string) => readFileSync(join(ADMIN_DIR, file), "utf8")

const LIST = "routes/group-buying/page.tsx"
const DETAIL = "routes/group-buying/[id]/page.tsx"
const GROUPS = "components/group-buy/groups-section.tsx"

const importsFrom = (src: string, name: string, from: string) =>
  new RegExp(`import\\s*{[^}]*\\b${name}\\b[^}]*}\\s*from\\s*["']${from.replace(/\//g, "\\/")}["']`).test(src)
const importsHeader = (src: string) =>
  /import\s*{[^}]*\bHeader\b[^}]*}\s*from\s*["'](?:\.{1,2}\/)+(?:components\/)?common\/header["']/.test(src)

describe("รายการแคมเปญ (spec 08 AC-9)", () => {
  const src = read(LIST)

  // ADM-13 (AC-17): หัวตารางย้ายเข้า heading/subHeading/action ของ DataTable — ตรวจใน medusa-ui.unit.spec.ts
  it("ใช้ LayoutComposer + DataTable ของ @medusajs/dashboard/components", () => {
    expect(importsFrom(src, "LayoutComposer", "@medusajs/dashboard/components")).toBe(true)
    expect(importsFrom(src, "DataTable", "@medusajs/dashboard/components")).toBe(true)
  })

  // ADM-10 (กฎ 13): gb_offset อ่าน/normalize/แก้ URL ผ่าน usePageOffset (ตรวจใน medusa-ui.unit.spec.ts AC-14)
  it("คลิกแถวด้วย rowHref และหน้าอยู่ใน URL (prefix + usePageOffset) ไม่ถือ state แบ่งหน้าเอง", () => {
    expect(src).toMatch(/rowHref=/)
    expect(src).toMatch(/prefix=/)
    expect(src).toMatch(/usePageOffset\(PREFIX,/)
    expect(src).not.toMatch(/DataTablePaginationState|useDataTable|onRowClick/)
  })

  it("export handle.breadcrumb เป็น \"Group buying\" (breadcrumb 2 ระดับร่วมกับหน้ารายละเอียด)", () => {
    expect(src).toMatch(/export const handle\s*=\s*{\s*breadcrumb:\s*\(\)\s*=>\s*"Group buying"/)
  })
})

describe("รายละเอียดแคมเปญ (spec 08 AC-9)", () => {
  const src = read(DETAIL)

  it("ใช้ LayoutComposer, SectionRow, NoRecords ของ @medusajs/dashboard/components และ Header", () => {
    for (const name of ["LayoutComposer", "SectionRow", "NoRecords"]) {
      expect(importsFrom(src, name, "@medusajs/dashboard/components")).toBe(true)
    }
    expect(importsHeader(src)).toBe(true)
  })

  it("ฟิลด์รายละเอียดใช้ SectionRow ไม่ใช่ grid เอง", () => {
    expect(src).toMatch(/<SectionRow\b/)
    expect(src).not.toMatch(/grid grid-cols-2/)
  })

  it("export loader และ handle.breadcrumb (ชื่อแคมเปญ)", () => {
    expect(src).toMatch(/export const loader\b/)
    expect(src).toMatch(/export const handle\s*=\s*{[^}]*\bbreadcrumb\b/)
  })
})

describe("ตารางกลุ่ม (spec 08 AC-9)", () => {
  const src = read(GROUPS)

  it("คง DataTable ของ @medusajs/ui (ต้องใช้ onRowClick เลือกแถว) แต่ใช้ Header", () => {
    expect(importsFrom(src, "DataTable", "@medusajs/ui")).toBe(true)
    expect(src).toMatch(/onRowClick/)
    expect(importsHeader(src)).toBe(true)
  })

  it("กันกดซ้ำด้วย useState(createSingleFlight) ไม่มี useRef", () => {
    expect(src).toMatch(/useState\(createSingleFlight\)/)
    expect(src).not.toMatch(/\buseRef\b/)
  })
})
