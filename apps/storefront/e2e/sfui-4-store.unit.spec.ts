import { expect, test } from "@playwright/test"
import ts from "typescript"

import { readSource } from "./support/sfui-source"

// SFUI-4 (spec 09 กฎ 4–5, AC-14 ส่วน static): accordion/slider ของ store filter และแท็บ PDP ใช้ shadcn
// `Accordion`/`Slider` จาก `@/components/ui/*` — ไม่ import Radix ตรง (`@radix-ui/*`, `radix-ui`) หรือ `clsx`
// SFUI-7 (กฎ 3): Slider ที่ต้องตั้งชื่อ thumb ภาษาไทยมาจาก wrapper `@/components/slider` (ไฟล์ใน ui = ผล CLI ตรงตัว)

const ACCORDION_FILES = [
  "modules/products/components/product-tabs/accordion.tsx",
  "modules/store/components/refinement-list/options-picker/index.tsx",
  "modules/store/components/store-refinements/option-refinements.tsx",
]
const SLIDER_FILES = ["modules/store/components/store-refinements/price-range.tsx"]
const TASK_FILES = [
  ...ACCORDION_FILES,
  ...SLIDER_FILES,
  "modules/store/components/store-refinements/refinement-group.tsx",
]

function imports(file: string): { from: string; names: string[] }[] {
  const source = readSource(`src/${file}`)
  const node = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  return node.statements.filter(ts.isImportDeclaration).map((decl) => {
    const bindings = decl.importClause?.namedBindings
    return {
      from: (decl.moduleSpecifier as ts.StringLiteral).text,
      names: bindings && ts.isNamedImports(bindings) ? bindings.elements.map((el) => (el.propertyName ?? el.name).text) : [],
    }
  })
}

for (const file of TASK_FILES) {
  test(`AC-14: ${file} ไม่ import @radix-ui/*, radix-ui หรือ clsx`, () => {
    const forbidden = imports(file)
      .map((i) => i.from)
      .filter((from) => /^@radix-ui\//.test(from) || from === "radix-ui" || from === "clsx")
    expect(forbidden).toEqual([])
  })
}

for (const file of ACCORDION_FILES) {
  test(`AC-14: ${file} import Accordion จาก @/components/ui/accordion`, () => {
    const ui = imports(file).filter((i) => i.from === "@/components/ui/accordion")
    expect(ui.flatMap((i) => i.names)).toEqual(expect.arrayContaining(["Accordion", "AccordionItem"]))
  })
}

for (const file of SLIDER_FILES) {
  test(`AC-14: ${file} import Slider จาก @/components/slider`, () => {
    const ui = imports(file).filter((i) => i.from === "@/components/slider")
    expect(ui.flatMap((i) => i.names)).toContain("Slider")
  })
}

test("AC-14 (กฎ 2–3): accordion/slider จาก CLI ใช้ cn ของ package cn ตามผล CLI (SFUI-7)", () => {
  for (const file of ["components/ui/accordion.tsx", "components/ui/slider.tsx"]) {
    const cn = imports(file).filter((i) => i.from === "cn")
    expect(cn.flatMap((i) => i.names), file).toContain("cn")
    expect(imports(file).map((i) => i.from), file).not.toContain("@/lib/utils")
  }
})
