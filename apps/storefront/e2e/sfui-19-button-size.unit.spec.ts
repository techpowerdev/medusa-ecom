import fs from "node:fs"
import path from "node:path"

import { expect, test } from "@playwright/test"
import ts from "typescript"

import { STOREFRONT, readSource, sourceFiles } from "./support/sfui-source"

// AC-55 (SFUI-19a, spec 09 กฎ 59, 62 — ADR-034 D1): ทุกปุ่มใช้ขนาดมาตรฐานของ shadcn
// `Button`/`buttonVariants(...)` มี size ไม่มี/"default"/"icon" และ className ที่ส่งเข้าไม่มี token ขนาด;
// ข้อยกเว้นเดียว `InputGroupButton size="icon-xs"` ภายใน `InputGroupAddon` (pattern ของ docs input-group)
// แทน `sfui-button-lg.unit.spec.ts` (กฎ 20 เดิม `lg` + `h-12`) ที่ถูกลบ

const ALLOWED_SIZE = new Set(["default", "icon"])

// กฎ 59: token ขนาด (หลังตัด prefix breakpoint/state เช่น `md:`, `has-[>svg]:` และ `!`/`-`)
const SIZE_TOKEN =
  /^(?:(?:min-|max-)?h-.+|size-.+|w-\[.+|min-w-.+|p[xytrblse]?-.+|text-(?:xs|sm|base|lg|\d*xl|\[.+\])|leading-.+|rounded(?:-.+)?|font-.+)$/

/** ตัด variant (`:` นอก `[...]`) แล้วคืน utility */
function utilityOf(token: string): string {
  let depth = 0
  let start = 0
  for (let i = 0; i < token.length; i++) {
    const c = token[i]
    if (c === "[") depth++
    else if (c === "]") depth--
    else if (c === ":" && depth === 0) start = i + 1
  }
  return token.slice(start).replace(/^!|!$/g, "").replace(/^-/, "")
}

export const isSizeToken = (token: string) => SIZE_TOKEN.test(utilityOf(token))

/** ข้อความทุก literal (สตริง/template) ภายใน node */
function literals(node: ts.Node): string[] {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  ) {
    return [node.text]
  }
  const found: string[] = []
  node.forEachChild((child) => {
    found.push(...literals(child))
  })
  return found
}

const sizeTokensIn = (node: ts.Node) =>
  literals(node)
    .flatMap((chunk) => chunk.split(/\s+/))
    .filter((token) => token !== "" && isSizeToken(token))

const tagName = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, sf: ts.SourceFile) =>
  node.tagName.getText(sf)

function attribute(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, sf: ts.SourceFile, name: string) {
  return node.attributes.properties.find(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === name
  )
}

/** ค่าสตริงของ attribute (`size="x"` หรือ `size={"x"}`); ไม่ใช่ literal → null */
function attributeText(attr: ts.JsxAttribute): string | null {
  const init = attr.initializer
  if (!init) return null
  if (ts.isStringLiteral(init)) return init.text
  if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)) {
    return init.expression.text
  }
  return null
}

function insideInputGroupAddon(node: ts.Node, sf: ts.SourceFile): boolean {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isJsxElement(p) && p.openingElement.tagName.getText(sf) === "InputGroupAddon") return true
  }
  return false
}

/** จุดที่ผิดกฎ 59 ในไฟล์ (`<บรรทัด>: <เหตุผล>`) */
export function buttonSizeViolations(file: string, source: string): string[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out: string[] = []
  const report = (node: ts.Node, why: string) =>
    out.push(`${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: ${why}`)

  const checkClassName = (node: ts.Node, scope: ts.Node | undefined) => {
    if (!scope) return
    const tokens = sizeTokensIn(scope)
    if (tokens.length) report(node, `className มี token ขนาด ${tokens.join(" ")}`)
  }

  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node, sf)
      if (tag === "Button") {
        const size = attribute(node, sf, "size")
        if (size) {
          const value = attributeText(size)
          if (value === null || !ALLOWED_SIZE.has(value)) {
            report(node, `size=${size.initializer?.getText(sf) ?? "(ว่าง)"}`)
          }
        }
        checkClassName(node, attribute(node, sf, "className")?.initializer)
      } else if (tag === "InputGroupButton") {
        const size = attribute(node, sf, "size")
        if (!size || attributeText(size) !== "icon-xs") {
          report(node, `InputGroupButton size=${size?.initializer?.getText(sf) ?? "(ไม่มี)"}`)
        }
        if (!insideInputGroupAddon(node, sf)) report(node, "InputGroupButton อยู่นอก InputGroupAddon")
        checkClassName(node, attribute(node, sf, "className")?.initializer)
      }
    }
    if (ts.isCallExpression(node) && node.expression.getText(sf) === "buttonVariants") {
      const [arg] = node.arguments
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const prop of arg.properties) {
          if (!ts.isPropertyAssignment(prop)) continue
          const name = prop.name.getText(sf)
          if (name === "size") {
            const init = prop.initializer
            if (!ts.isStringLiteralLike(init) || !ALLOWED_SIZE.has(init.text)) {
              report(node, `buttonVariants size: ${init.getText(sf)}`)
            }
          } else if (name === "className") {
            checkClassName(node, prop.initializer)
          }
        }
      } else if (arg) {
        report(node, `buttonVariants(${arg.getText(sf)}) ตรวจ size ไม่ได้`)
      }
      // cn(buttonVariants(...), "...") — argument อื่นของ cn ที่ครอบคือ className ที่ส่งเข้า
      const parent = node.parent
      if (ts.isCallExpression(parent) && parent.expression.getText(sf) === "cn") {
        for (const other of parent.arguments) {
          if (other !== node) checkClassName(node, other)
        }
      }
    }
    node.forEachChild(visit)
  }
  visit(sf)
  return out
}

/** ขอบเขตของกฎ 59: `src/modules/**`, `src/app/**`, `src/components/*.tsx` (นอก `ui/`) — ไม่รวม test */
export const ruleFiles = () =>
  sourceFiles().filter(
    (file) =>
      file.endsWith(".tsx") &&
      (file.startsWith("src/modules/") ||
        file.startsWith("src/app/") ||
        /^src\/components\/[^/]+\.tsx$/.test(file))
  )

test("AC-55: ตัวตรวจจับขนาดปุ่ม (positive/negative control)", () => {
  const bad = [
    'const a = <Button size="lg">x</Button>',
    'const b = <Button className="h-12">x</Button>',
    'const c = <a className={buttonVariants({ size: "sm" })} />',
    'const d = <Button className="md:h-10">x</Button>',
    'const e = <a className={cn(buttonVariants({ size: "lg" }), "h-12 w-full")} />',
    'const f = <a className={cn(buttonVariants(), "w-full h-10")} />',
    'const g = <Button size={size}>x</Button>',
    'const h = <Button variant="ghost" className="p-0 text-sm">x</Button>',
    'const i = <Button className="has-[>svg]:px-2 rounded-full">x</Button>',
    'const j = <Button className={cn("w-[100px] min-h-[25px]", x)}>x</Button>',
    'const k = <a className={buttonVariants({ className: "font-medium" })} />',
    'const l = <InputGroupAddon><InputGroupButton size="icon-sm" /></InputGroupAddon>',
    'const m = <InputGroupButton size="icon-xs" />',
    'const n = <Button className={`${x} size-8`}>x</Button>',
  ].join("\n")
  expect(buttonSizeViolations("bad.tsx", bad).map((v) => Number(v.split(":")[0]))).toEqual([
    1, 2, 3, 4, 5, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
  ])
  const good = [
    'const a = <Button className="w-full mt-4">x</Button>',
    'const b = <Button size="icon" aria-label="ลบ">x</Button>',
    'const c = <Button size="default" variant="outline">x</Button>',
    'const d = <a className={cn(buttonVariants({ variant: "outline" }), "w-full")} />',
    'const e = <Button className="text-primary hidden md:flex self-end shrink-0 flex-1">x</Button>',
    'const f = <InputGroup><InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="x" /></InputGroupAddon></InputGroup>',
    'const g = <SheetClose asChild><Button variant="ghost" size="icon" aria-label="ปิด"><X /></Button></SheetClose>',
    'const h = <Button className="text-destructive hover:text-destructive pointer-events-none">x</Button>',
  ].join("\n")
  expect(buttonSizeViolations("good.tsx", good)).toEqual([])
})

test("AC-55: ทุกปุ่มใน src/modules, src/app, src/components/*.tsx ใช้ size default/icon ไม่มี className ขนาด (กฎ 59)", () => {
  const files = ruleFiles()
  expect(files.length).toBeGreaterThan(100)
  const offenders = files.flatMap((file) =>
    buttonSizeViolations(file, readSource(file)).map((v) => `${file}:${v}`)
  )
  expect(offenders, "ปุ่มที่ override ขนาดของ shadcn").toEqual([])
})

test("AC-55: globals.css ไม่มี @utility contrast-btn และ guard เดิม sfui-button-lg ถูกลบ (กฎ 62)", () => {
  const css = fs.readFileSync(path.join(STOREFRONT, "src/styles/globals.css"), "utf8")
  expect(css).not.toContain("contrast-btn")
  expect(fs.existsSync(path.join(STOREFRONT, "e2e/sfui-button-lg.unit.spec.ts"))).toBe(false)
})
