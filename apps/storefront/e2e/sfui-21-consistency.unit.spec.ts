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

// ---- SFUI-21a (spec 09 กฎ 73, 75, 76; AC-66 (1)) ----

/** ไฟล์ของตาราง inventory ข้อ 32 (ฟอร์มรอบ 48) — container ของช่องกรอกใช้ gap-4 */
const GAP_FILES = [
  "checkout/components/shipping-address/index.tsx",
  "checkout/components/billing_address/index.tsx",
  "account/components/address-card/add-address.tsx",
  "account/components/address-card/edit-address-modal.tsx",
  "account/components/profile-billing-address/index.tsx",
  "account/components/profile-name/index.tsx",
  "account/components/profile-phone/index.tsx",
  "account/components/profile-password/index.tsx",
  "account/components/login/index.tsx",
  "account/components/register/index.tsx",
  "checkout/components/discount-code/index.tsx",
].map((f) => `src/modules/${f}`)

/** ไฟล์ของตาราง inventory ข้อ 35 — ปุ่มปิด overlay */
const CLOSE_FILES = [
  "account/components/address-card/add-address.tsx",
  "account/components/address-card/edit-address-modal.tsx",
  "layout/components/side-menu/index.tsx",
  "layout/components/search/drawer.tsx",
  "products/components/product-actions/mobile-actions.tsx",
].map((f) => `src/modules/${f}`)

const BAD_GAP = /^(?:[a-z0-9-]+:)*(?:gap-2|gap-[xy]-.+)$/
const SIZE_TOKEN = /^(?:[a-z0-9-]+:|data-\[[^\]]+\]:)*(?:h-.+|min-h-.+|p[xytrbl]?-.+|text-(?:xs|sm|base|lg|\d*xl|\[.+\])|leading-.+)$/

const parseTsx = (file: string) => ts.createSourceFile(file, readSource(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const openingOf = (n: ts.Node) => (ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null)
const attrOf = (el: ts.JsxOpeningElement | ts.JsxSelfClosingElement, sf: ts.SourceFile, name: string) =>
  el.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === name)
const lineOf = (sf: ts.SourceFile, n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

/** container (JSX element) ที่มี `<Input` อยู่ภายในและ className มี gap-2, gap-x-… หรือ gap-y-… */
export function fieldGapViolations(file: string, sf = parseTsx(file)): string[] {
  const out: string[] = []
  const visit = (n: ts.Node) => {
    const el = openingOf(n)
    if (el && ts.isJsxElement(n)) {
      const bad = classTokens(attrOf(el, sf, "className")).filter((t) => BAD_GAP.test(t))
      const hasInput = n.getText(sf).includes("<Input")
      if (bad.length && hasInput) out.push(`${file}:${lineOf(sf, n)} ${bad.join(" ")}`)
    }
    n.forEachChild(visit)
  }
  visit(sf)
  return out
}

test("AC-66 (1): container ของช่องในไฟล์ข้อ 32 ไม่มี gap-2/gap-x-*/gap-y-* (กฎ 73 — gap-4)", () => {
  const control = ts.createSourceFile(
    "c.tsx",
    'const a = <div className="grid gap-x-4 gap-y-2"><Input /></div>\nconst b = <div className="grid gap-4"><Input /></div>\nconst c = <div className="flex gap-x-2"><Button /></div>',
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  expect(fieldGapViolations("c.tsx", control)).toEqual(["c.tsx:1 gap-x-4 gap-y-2"])
  expect(GAP_FILES.flatMap((f) => fieldGapViolations(f))).toEqual([])
})

test("AC-66 (1): SelectTrigger ใน src/modules/** ไม่มี className ขนาด (กฎ 75)", () => {
  const found: string[] = []
  for (const file of sourceFiles().filter((f) => f.startsWith("src/modules/") && f.endsWith(".tsx"))) {
    const sf = parseTsx(file)
    const visit = (n: ts.Node) => {
      const el = openingOf(n)
      if (el && el.tagName.getText(sf) === "SelectTrigger") {
        const bad = classTokens(attrOf(el, sf, "className")).filter((t) => SIZE_TOKEN.test(t))
        if (bad.length) found.push(`${file}:${lineOf(sf, n)} ${bad.join(" ")}`)
      }
      n.forEachChild(visit)
    }
    visit(sf)
  }
  expect(found).toEqual([])
})

test("AC-66 (1): ปุ่มปิด overlay ในไฟล์ข้อ 35 = DialogClose/SheetClose asChild → Button ghost icon (กฎ 76)", () => {
  const found: string[] = []
  let closes = 0
  for (const file of CLOSE_FILES) {
    const sf = parseTsx(file)
    const visit = (n: ts.Node) => {
      const el = openingOf(n)
      if (el && /^(Dialog|Sheet)Close$/.test(el.tagName.getText(sf))) {
        closes++
        const child = ts.isJsxElement(n) ? n.children.map(openingOf).find(Boolean) : null
        const ok =
          !!attrOf(el, sf, "asChild") &&
          !!child &&
          child.tagName.getText(sf) === "Button" &&
          attrOf(child, sf, "variant")?.initializer?.getText(sf) === '"ghost"' &&
          attrOf(child, sf, "size")?.initializer?.getText(sf) === '"icon"' &&
          !!attrOf(child, sf, "aria-label")
        if (!ok) found.push(`${file}:${lineOf(sf, n)}`)
      }
      n.forEachChild(visit)
    }
    visit(sf)
  }
  expect(closes, "ปุ่มปิดในไฟล์ข้อ 35").toBe(5)
  expect(found).toEqual([])
})

// ---- SFUI-21c (spec 09 กฎ 80; AC-69 (1) — owner Q-R50-1: การ์ดตัวเลือกจัดส่ง/ชำระเงิน = Choice Card ของ shadcn) ----

const SHIPPING = "src/modules/checkout/components/shipping/index.tsx"
const PAYMENT_CONTAINER = "src/modules/checkout/components/payment-container/index.tsx"

/** `RadioGroupItem` ที่ parent (JSX element) ไม่ใช่ `Field orientation="horizontal"` ใน `FieldLabel` หรือมี className */
export function choiceCardViolations(file: string, sf = parseTsx(file)): { count: number; bad: string[] } {
  const bad: string[] = []
  let count = 0
  const parentElement = (n: ts.Node) => {
    let p = n.parent
    while (p && !ts.isJsxElement(p)) p = p.parent
    return p as ts.JsxElement | undefined
  }
  const visit = (n: ts.Node) => {
    const el = openingOf(n)
    if (el && el.tagName.getText(sf) === "RadioGroupItem") {
      count++
      const field = parentElement(n)
      const label = field && parentElement(field)
      const ok =
        !attrOf(el, sf, "className") &&
        field?.openingElement.tagName.getText(sf) === "Field" &&
        attrOf(field.openingElement, sf, "orientation")?.initializer?.getText(sf) === '"horizontal"' &&
        label?.openingElement.tagName.getText(sf) === "FieldLabel" &&
        !!attrOf(label.openingElement, sf, "htmlFor")
      if (!ok) bad.push(`${file}:${lineOf(sf, n)}`)
    }
    n.forEachChild(visit)
  }
  visit(sf)
  return { count, bad }
}

test("AC-69 (1): ตัวตรวจ Choice Card (positive/negative control)", () => {
  const src = (code: string) => ts.createSourceFile("c.tsx", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const good = src('const a = <FieldLabel htmlFor="x"><Field orientation="horizontal"><FieldContent /><RadioGroupItem value="x" id="x" /></Field></FieldLabel>')
  expect(choiceCardViolations("c.tsx", good)).toEqual({ count: 1, bad: [] })
  const bad = src(
    [
      'const a = <RadioGroupItem value="x" className="w-full" />',
      'const b = <FieldLabel htmlFor="x"><Field><RadioGroupItem value="x" id="x" /></Field></FieldLabel>',
      'const c = <FieldLabel htmlFor="x"><Field orientation="horizontal"><RadioGroupItem value="x" id="x" className="border-0" /></Field></FieldLabel>',
      'const d = <div><Field orientation="horizontal"><RadioGroupItem value="x" id="x" /></Field></div>',
    ].join("\n")
  )
  expect(choiceCardViolations("c.tsx", bad).bad).toEqual(["c.tsx:1", "c.tsx:2", "c.tsx:3", "c.tsx:4"])
})

test("AC-69 (1): shipping ไม่มี OPTION_CLASS, payment-container ไม่มี OptionDot/การซ่อน indicator (กฎ 80)", () => {
  expect(readSource(SHIPPING)).not.toContain("OPTION_CLASS")
  for (const file of [SHIPPING, PAYMENT_CONTAINER]) {
    expect(readSource(file), file).not.toMatch(/import OptionDot|option-dot/)
    expect(readSource(file), file).not.toContain("radio-group-indicator]:hidden")
  }
})

test("AC-69 (1): ทุก RadioGroupItem ในสองไฟล์อยู่ใน FieldLabel → Field orientation=horizontal และไม่มี className (กฎ 80)", () => {
  const shipping = choiceCardViolations(SHIPPING)
  const payment = choiceCardViolations(PAYMENT_CONTAINER)
  expect(shipping.count, "RadioGroupItem ใน shipping (pickup toggle, จัดส่ง, สาขา)").toBe(3)
  expect(payment.count, "RadioGroupItem ใน payment-container").toBe(1)
  expect([...shipping.bad, ...payment.bad]).toEqual([])
})
