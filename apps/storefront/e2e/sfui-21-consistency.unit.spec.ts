import { expect, test } from "@playwright/test"
import ts from "typescript"

import { readSource, sourceFiles } from "./support/sfui-source"

// SFUI-21b (spec 09 กฎ 77, AC-65 (1) — owner: h1 ทุกหน้าขนาดเดียว): ทุก `<h1` ใน src/** (ไม่ใช่ test) ยกเว้น hero ของหน้าแรก
// มี typography เท่านี้ `text-3xl font-semibold tracking-tight` (+ สี/layout ภายนอกได้) — ไม่มี uppercase, text-[…], text-{xs…2xl}, leading-*,
// font-{normal,medium,bold,…}

const HERO = "src/modules/home/components/hero/index.tsx"
const REQUIRED = ["text-3xl", "font-semibold", "tracking-tight"]
const FORBIDDEN =
  /^(?:[a-z0-9-]+:)*(?:uppercase|lowercase|capitalize|text-\[.+\]|text-(?:xs|sm|base|lg|xl|2xl|[4-9]xl)|leading-.+|font-(?:thin|extralight|light|normal|medium|bold|extrabold|black)|tracking-(?!tight$).+)$/

/** token ทุกตัวใน literal ของ className (สตริง/template/cn(...)) */
function classTokens(attr: ts.JsxAttribute | undefined): string[] {
  if (!attr?.initializer) return []
  const out: string[] = []
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      out.push(...n.text.split(/\s+/).filter(Boolean))
    }
    n.forEachChild(visit)
  }
  visit(attr.initializer)
  return out
}

export function h1Violations(file: string, source: string): string[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out: string[] = []
  const visit = (n: ts.Node) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(sf) === "h1") {
      const className = n.attributes.properties.find(
        (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === "className"
      )
      const tokens = classTokens(className)
      const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
      const missing = REQUIRED.filter((t) => !tokens.includes(t))
      const bad = tokens.filter((t) => FORBIDDEN.test(t))
      if (missing.length || bad.length) out.push(`${line}: ขาด [${missing.join(" ")}] เกิน [${bad.join(" ")}]`)
    }
    n.forEachChild(visit)
  }
  visit(sf)
  return out
}

test("AC-65 (1): ตัวตรวจ h1 (positive/negative control)", () => {
  const bad = [
    'const a = <h1 className="text-[30px] leading-[48px] font-semibold">x</h1>',
    'const b = <h1 className="text-base leading-6 font-semibold uppercase">x</h1>',
    'const c = <h1 data-testid="t">x</h1>',
    'const d = <h1 className="text-3xl font-semibold tracking-tight md:text-2xl">x</h1>',
    'const e = <h1 className="text-3xl font-bold tracking-tight">x</h1>',
  ].join("\n")
  expect(h1Violations("bad.tsx", bad).map((v) => Number(v.split(":")[0]))).toEqual([1, 2, 3, 4, 5])
  const good = [
    'const a = <h1 className="text-3xl font-semibold tracking-tight">x</h1>',
    'const b = <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-6 break-words">x</h1>',
    'const c = <h1 className="flex flex-col gap-y-3 text-3xl font-semibold tracking-tight">x</h1>',
  ].join("\n")
  expect(h1Violations("good.tsx", good)).toEqual([])
})

test("AC-65 (1): ทุก <h1 ใน src/** (ยกเว้น hero) ใช้ text-3xl font-semibold tracking-tight เท่านั้น (กฎ 77)", () => {
  const files = sourceFiles().filter((f) => f.endsWith(".tsx") && f !== HERO)
  const found = files.flatMap((file) => h1Violations(file, readSource(file)).map((v) => `${file}:${v}`))
  const withH1 = files.filter((file) => readSource(file).includes("<h1"))
  expect(withH1.length, "จำนวนไฟล์ที่มี <h1 (นอก hero)").toBeGreaterThanOrEqual(27)
  expect(found).toEqual([])
})
