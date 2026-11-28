import fs from "node:fs"
import path from "node:path"

import { expect, test } from "@playwright/test"
import ts from "typescript"

import manifest from "./support/shadcn-ui.json"
import { STOREFRONT, readSource, sourceFiles } from "./support/sfui-source"

// SFUI-11a (spec 09 กฎ 28, 35, 36, AC-26): ช่องกรอกของ storefront ประกอบจาก `field` ของ shadcn (label เหนือช่อง)
// ไม่มี floating label เดิม และไม่ส่ง className ที่เปลี่ยนสไตล์ default ของ primitive

// SFUI-17 (spec 09 รอบ 49 กฎ 39): native-select ถูกลบ — select ใช้ Select ของ shadcn ประกอบตรงที่ใช้
const COMMON = ["input", "checkbox"].map((name) => `src/modules/common/components/${name}/index.tsx`)
const PROFILE_BILLING = "src/modules/account/components/profile-billing-address/index.tsx"

const parse = (file: string) =>
  ts.createSourceFile(file, readSource(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node)
  node.forEachChild((child) => walk(child, visit))
}

const jsxElements = (sf: ts.SourceFile) => {
  const found: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = []
  walk(sf, (n) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) found.push(n)
  })
  return found
}

/** ข้อความใน literal ทั้งหมดใต้ node (สตริง/template) */
function literals(node: ts.Node): string[] {
  const found: string[] = []
  walk(node, (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      found.push(n.text)
    }
  })
  return found
}

const classTokens = (el: ts.JsxOpeningElement | ts.JsxSelfClosingElement) => {
  const attr = el.attributes.properties.find(
    (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === "className"
  )
  return attr?.initializer ? literals(attr.initializer).flatMap((t) => t.split(/\s+/)).filter(Boolean) : []
}

test("AC-26 (a): input / checkbox ของ common import Field และ FieldLabel จาก @/components/ui/field", () => {
  for (const file of COMMON) {
    const sf = parse(file)
    const names = sf.statements
      .filter(ts.isImportDeclaration)
      .filter((d) => (d.moduleSpecifier as ts.StringLiteral).text === "@/components/ui/field")
      .flatMap((d) => {
        const b = d.importClause?.namedBindings
        return b && ts.isNamedImports(b) ? b.elements.map((e) => e.name.text) : []
      })
    expect(names, file).toEqual(expect.arrayContaining(["Field", "FieldLabel"]))
  }
})

test('AC-26 (b): ไม่มีไฟล์ใน src/** ที่มี variant peer-focus: / peer-not-placeholder-shown: หรือ placeholder=" "', () => {
  const offenders = sourceFiles().filter((file) =>
    /peer-focus:|peer-not-placeholder-shown:|placeholder=" "/.test(readSource(file))
  )
  expect(offenders).toEqual([])
})

// SFUI-16b (spec 09 กฎ 40b): profile-billing-address ประกอบ SelectTrigger ของ shadcn แทน NativeSelect
// SFUI-20b (กฎ 70 — AC-26 (c) ส่วนประเทศแทนด้วย AC-63): ไม่มีช่องประเทศแล้ว — ไม่มี SelectTrigger และ CountrySelect ของ checkout ถูกลบ
test("AC-26 (c): profile-billing-address ไม่ประกอบ Select ประเทศ (กฎ 70) และไม่มีไฟล์ CountrySelect ของ checkout", () => {
  const billing = jsxElements(parse(PROFILE_BILLING)).filter((el) => el.tagName.getText() === "SelectTrigger")
  expect(billing, PROFILE_BILLING).toHaveLength(0)
  expect(fs.existsSync(path.join(STOREFRONT, "src/modules/checkout/components/country-select"))).toBe(false)
})

test("AC-26 (d): field, separator, input-group, textarea ของ CLI อยู่ใน e2e/support/shadcn-ui.json", () => {
  expect(Object.keys(manifest.files)).toEqual(
    expect.arrayContaining(["field.tsx", "separator.tsx", "input-group.tsx", "textarea.tsx"])
  )
})

// utility ที่เปลี่ยนสไตล์ default (ขนาด/ระยะบรรทัด/น้ำหนักตัวอักษร, padding, ความสูง, สี) — กฎ 28 ยอมเฉพาะ layout ภายนอก
const STYLE_UTILITY =
  /^(?:[^\s:]+:)*!?-?(?:text-|leading-|font-|p[xytrblse]?-|h-|min-h-|max-h-|size-|bg-|border-|ring-|outline-|placeholder-|fill-|stroke-)/
const PRIMITIVES = new Set(["FieldLabel", "FieldError", "FieldDescription", "ShadcnInput", "InputGroupInput"])

test("AC-26 (e): className ที่ส่งเข้า FieldLabel / FieldError / FieldDescription / ShadcnInput / InputGroupInput ไม่มี utility ของสไตล์", () => {
  const offenders: string[] = []
  for (const file of COMMON) {
    for (const el of jsxElements(parse(file))) {
      if (!PRIMITIVES.has(el.tagName.getText())) continue
      const bad = classTokens(el).filter((t) => STYLE_UTILITY.test(t))
      if (bad.length > 0) offenders.push(`${file} <${el.tagName.getText()}> ${bad.join(" ")}`)
    }
  }
  expect(offenders).toEqual([])
})

test("AC-26 (e): ตัวตรวจ utility จับ class สไตล์และไม่จับ layout", () => {
  for (const c of ["text-sm", "leading-6", "font-medium", "px-4", "pt-5", "h-12", "md:h-10", "text-rose-500", "bg-muted"]) {
    expect(STYLE_UTILITY.test(c), c).toBe(true)
  }
  for (const c of ["w-full", "col-span-2", "md:col-span-2", "flex-1"]) expect(STYLE_UTILITY.test(c), c).toBe(false)
})
