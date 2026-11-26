import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { expect, test } from "@playwright/test"
import ts from "typescript"

import manifest from "./support/shadcn-ui.json"
import { STOREFRONT, readSource, sourceFiles } from "./support/sfui-source"

// SFUI-7 (spec 09 กฎ 2, 3, 5, AC-19): `src/components/ui/*` = ผลของ shadcn CLI ตรงตัว (ห้ามแก้) — ปรับด้วย wrapper ใน
// `src/components/*` หรือส่ง className/props; hash ใน `e2e/support/shadcn-ui.json` มาจาก `node scripts/shadcn-ui-verify.mjs --write`
// (ต้องใช้เน็ต — test นี้ไม่ต้อง)

const UI_DIR = path.join(STOREFRONT, "src/components/ui")
const uiFiles = () => fs.readdirSync(UI_DIR).sort()
const sha256 = (file: string) => createHash("sha256").update(fs.readFileSync(path.join(UI_DIR, file), "utf8")).digest("hex")

function parse(file: string) {
  return ts.createSourceFile(file, readSource(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/** ชื่อที่ import จาก module ที่ตรง `from` (ชื่อท้องถิ่น → module) */
function importedNames(sf: ts.SourceFile, from: (specifier: string) => boolean): Map<string, string> {
  const names = new Map<string, string>()
  for (const decl of sf.statements.filter(ts.isImportDeclaration)) {
    const specifier = (decl.moduleSpecifier as ts.StringLiteral).text
    const bindings = decl.importClause?.namedBindings
    if (!from(specifier) || !bindings || !ts.isNamedImports(bindings)) continue
    bindings.elements.forEach((el) => names.set(el.name.text, specifier))
  }
  return names
}

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node)
  node.forEachChild((child) => walk(child, visit))
}

/** ค่าเริ่มต้นของตัวแปรทุกตัวในไฟล์ (ชื่อ → initializer) — ใช้ตามค่าคงที่ของ class เช่น `OPTION_CLASS` */
function declarations(sf: ts.SourceFile): Map<string, ts.Expression> {
  const found = new Map<string, ts.Expression>()
  walk(sf, (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) found.set(n.name.text, n.initializer)
  })
  return found
}

/** ข้อความใน literal ทั้งหมดใต้ node (สตริง/template) รวมค่าของตัวแปรในไฟล์เดียวกันที่ถูกอ้าง */
function literals(node: ts.Node, vars: Map<string, ts.Expression>, seen = new Set<string>()): string[] {
  const found: string[] = []
  walk(node, (n) => {
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n)
    ) {
      found.push(n.text)
    } else if (ts.isIdentifier(n) && vars.has(n.text) && !seen.has(n.text)) {
      seen.add(n.text)
      found.push(...literals(vars.get(n.text)!, vars, seen))
    }
  })
  return found
}

const jsxElements = (sf: ts.SourceFile) => {
  const found: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = []
  walk(sf, (n) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) found.push(n)
  })
  return found
}

const attribute = (el: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string) =>
  el.attributes.properties.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === name)

const location = (file: string, node: ts.Node) =>
  `${file}:${node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1}`

test("AC-19 (กฎ 3): ไฟล์ใน src/components/ui ตรงกับผลของ shadcn CLI ตามตัวอักษร (hash ใน e2e/support/shadcn-ui.json)", () => {
  expect(uiFiles()).toEqual(Object.keys(manifest.files).sort())
  const files = manifest.files as Record<string, string>
  for (const file of uiFiles()) expect(sha256(file), file).toBe(files[file])
})

test("AC-19 (กฎ 2–3): ไฟล์ใน src/components/ui ไม่มี comment `SFUI:` และใช้ cn ของ package (ไม่ import @/lib/utils)", () => {
  for (const file of uiFiles()) {
    const source = readSource(`src/components/ui/${file}`)
    expect(source, file).not.toContain("SFUI:")
    expect(source, file).not.toMatch(/from\s+["']@\/lib\/utils["']/)
  }
})

test("AC-19 (กฎ 5): radix-ui/@radix-ui/* ถูก import เฉพาะใน src/components/**", () => {
  const offenders = sourceFiles().filter(
    (file) => !file.startsWith("src/components/") && /from\s+["'](?:radix-ui|@radix-ui\/[^"']+)["']/.test(readSource(file))
  )
  expect(offenders).toEqual([])
})

// cn ของ package (ที่ primitive ใช้) ไม่รู้จัก utility ขนาดฟอนต์ของ globals.css — ถือเป็นสีตัวอักษรแล้วตัด `text-<สี>` ของ primitive
// (หรือถูกตัดเมื่อคู่กับ `text-<สี>`) → ผู้เรียกใช้ utility มาตรฐานของ Tailwind ที่ได้ค่าเท่ากันแทน (spec 09 กฎ 2)
const OWN_FONT_SIZE = /^(?:[^\s:]+:)*!?text-(?:xsmall|small|base|large|xl|2xl|3xl)-(?:regular|semi)$/

test("AC-19 (กฎ 2): className/argument ที่ส่งเข้า component ของ @/components/** ไม่มี utility ขนาดฟอนต์ของ globals.css", () => {
  const offenders: string[] = []
  for (const file of sourceFiles().filter((f) => f.endsWith(".tsx") && !f.startsWith("src/components/ui/"))) {
    const sf = parse(file)
    const names = importedNames(sf, (specifier) => specifier.startsWith("@/components/"))
    if (names.size === 0) continue
    const vars = declarations(sf)
    const check = (node: ts.Node) => {
      const tokens = literals(node, vars).flatMap((text) => text.split(/\s+/)).filter((t) => OWN_FONT_SIZE.test(t))
      if (tokens.length > 0) offenders.push(`${location(file, node)} ${tokens.join(" ")}`)
    }
    for (const el of jsxElements(sf)) {
      const className = attribute(el, "className")
      if (names.has(el.tagName.getText()) && className?.initializer) check(className.initializer)
    }
    walk(sf, (n) => {
      if (ts.isCallExpression(n) && names.has(n.expression.getText())) n.arguments.forEach(check)
    })
  }
  expect(offenders).toEqual([])
})

// ปุ่มปิดในตัวของ DialogContent/SheetContent/DialogFooter ของ CLI มีข้อความ "Close" (กฎ 10) — ใช้ของ ui ต้องปิดปุ่มนั้น;
// ต้องการปุ่มปิดในตัว → ใช้ wrapper `@/components/sheet` (ข้อความ "ปิด")
test("AC-19 (กฎ 10): DialogContent/SheetContent ของ @/components/ui ตั้ง showCloseButton={false} และ DialogFooter ไม่เปิดปุ่มปิดในตัว", () => {
  const offenders: string[] = []
  for (const file of sourceFiles().filter((f) => f.endsWith(".tsx") && !f.startsWith("src/components/ui/"))) {
    const sf = parse(file)
    const names = importedNames(sf, (specifier) => specifier === "@/components/ui/dialog" || specifier === "@/components/ui/sheet")
    for (const el of jsxElements(sf)) {
      const tag = el.tagName.getText()
      if (!names.has(tag)) continue
      const value = attribute(el, "showCloseButton")?.initializer?.getText()
      if ((tag === "DialogContent" || tag === "SheetContent") && value !== "{false}") offenders.push(location(file, el))
      if (tag === "DialogFooter" && value !== undefined && value !== "{false}") offenders.push(location(file, el))
    }
  }
  expect(offenders).toEqual([])
})

test("AC-19: test ของ component อยู่นอก src/components/ui (โฟลเดอร์นี้มีแต่ไฟล์จาก CLI)", () => {
  expect(uiFiles().filter((file) => !file.endsWith(".tsx") || /\.test\./.test(file))).toEqual([])
})
