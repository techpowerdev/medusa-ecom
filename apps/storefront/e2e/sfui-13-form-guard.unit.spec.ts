import fs from "node:fs"
import path from "node:path"

import { expect, test } from "@playwright/test"
import ts from "typescript"

import { STOREFRONT, readSource, sourceFiles } from "./support/sfui-source"

// SFUI-13 (spec 09 รอบ 48 กฎ 26, 28, 37; AC-35, AC-37 (3) static): guard ไม่ให้ช่องกรอกใหม่หลุดจาก `field` ของ shadcn
// - ทุก <input>/<select>/<textarea> ของ JSX ใน src/modules, src/app อยู่ใน common/components/{input,checkbox}
//   หรือตรงคู่ "ไฟล์ + element" ของ allow-list (กฎ 26) — element ละหนึ่งตัวพอดี ไฟล์ใน allow-list ที่มี element อื่น = ล้ม
// - `@/components/ui/input` import ได้เฉพาะใน src/components/** และ common/components/input
// - ทุก Input/CountrySelect/Checkbox ของ common ในไฟล์ของตาราง inventory มี label
// - SFUI-17 (รอบ 49 กฎ 39, 40c, 48; AC-47): ไม่มี <select> ใน JSX, ไม่มี native-select/cart-item-select, ALLOW_LIST ไม่มี select,
//   ทุก <SelectTrigger> ในไฟล์ของตาราง inventory select มี id = htmlFor ของ FieldLabel หรือ aria-label, e2e เรียก .selectOption() เฉพาะใน fillCard
// - container ของช่องในไฟล์ inventory ไม่มี breakpoint ของ starter และ grid-cols-2/[…] ต้องมี md: (ยกเว้นระดับฟอร์มตามค่าคงที่)
// parse ด้วย TypeScript (ไม่นับ comment)

type Tag = ts.JsxOpeningElement | ts.JsxSelfClosingElement

const parse = (file: string) => ts.createSourceFile(file, readSource(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node)
  node.forEachChild((child) => walk(child, visit))
}

const tagsOf = (sf: ts.SourceFile) => {
  const found: Tag[] = []
  walk(sf, (n) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) found.push(n)
  })
  return found
}

/** ค่าของ attribute: สตริง → ข้อความ, template → ข้อความใน backtick ตามที่เขียน, expression อื่น → `{…}` ตามที่เขียน, ไม่มีค่า → "" */
function attrs(tag: Tag, sf: ts.SourceFile): Record<string, string> {
  const out: Record<string, string> = {}
  for (const a of tag.attributes.properties) {
    if (!ts.isJsxAttribute(a)) continue
    const name = a.name.getText(sf)
    const init = a.initializer
    if (!init) out[name] = ""
    else if (ts.isStringLiteral(init)) out[name] = init.text
    else if (ts.isJsxExpression(init) && init.expression) {
      const e = init.expression
      out[name] = ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e.text : ts.isTemplateExpression(e) ? e.getText(sf).slice(1, -1) : `{${e.getText(sf)}}`
    }
  }
  return out
}

const line = (sf: ts.SourceFile, node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1

const COMMON_CONTROLS = ["input", "checkbox"].map((name) => `src/modules/common/components/${name}/`)

type Allowed = { file: string; tag: "input" | "select"; match: Record<string, string>; why: string }

/** allow-list ของกฎ 26 (ไฟล์ + element) — `<input type="hidden">` ยกเว้นทุกไฟล์ใน src/modules, src/app */
const ALLOW_LIST: Allowed[] = ([
  { file: "layout/components/search/index.tsx", tag: "input", match: { type: "search", "data-testid": "search-input" }, why: "ช่องค้นหาใน drawer" },
  // testid `option-button` อยู่บน <label> ไม่ใช่ <input> (sr-only)
  { file: "products/components/product-actions/option-select.tsx", tag: "input", match: { type: "radio" }, why: "ตัวเลือกสินค้า" },
  {
    file: "group-buy/components/group-page/group-join.tsx",
    tag: "input",
    match: { type: "number", "data-testid": "group-selection-quantity" },
    why: "จำนวนต่อแถวในรายการที่เลือก (select สามตัวของไฟล์นี้อยู่ในขอบเขต — ห้ามมี <select>)",
  },
] as Allowed[]).map((a) => ({ ...a, file: `src/modules/${a.file}` }))

/** ไฟล์ของตาราง inventory (spec 09 รอบ 48) — profile-password ไม่ render ในหน้า profile จึงตรวจได้แค่ static */
const INVENTORY = [
  "account/components/login/index.tsx",
  "account/components/register/index.tsx",
  "account/components/profile-name/index.tsx",
  "account/components/profile-phone/index.tsx",
  "account/components/profile-password/index.tsx",
  "account/components/profile-billing-address/index.tsx",
  "account/components/address-card/add-address.tsx",
  "account/components/address-card/edit-address-modal.tsx",
  "checkout/components/shipping-address/index.tsx",
  "checkout/components/billing_address/index.tsx",
  "checkout/components/addresses/index.tsx",
  "checkout/components/discount-code/index.tsx",
  "returns/components/return-request-form/index.tsx",
  "group-buy/components/group-page/group-join.tsx",
  "affiliate/components/auth-forms/index.tsx",
].map((f) => `src/modules/${f}`)

/**
 * container ระดับฟอร์ม/แถวสินค้าที่ยกเว้นกฎ 37 (ตาราง 37b "ไม่มีคู่") — "ไฟล์ + class" ต้องตรงกับที่พบพอดี
 * (class ที่ยกเว้นแต่ไม่มีแล้วก็ล้ม — ให้ลบออกจากรายการนี้)
 */
const FORM_LEVEL_EXCEPTIONS: Record<string, string[]> = {
  // affiliate วางฟอร์ม login/สมัครข้างกันที่ small: — ระดับฟอร์ม ไม่ใช่ container ของช่อง
  "src/modules/affiliate/components/auth-forms/index.tsx": ["small:grid-cols-2"],
  // แถวสินค้าของคืนสินค้า (ชื่อสินค้า | จำนวน | เหตุผล) — layout ของแถวสินค้า ไม่ใช่คู่ช่อง
  "src/modules/returns/components/return-request-form/index.tsx": ["small:flex-row", "small:items-center"],
}

const STARTER_BREAKPOINTS = new Set(["2xsmall", "xsmall", "small", "medium", "large", "xlarge", "2xlarge"])

/** variant ของ class (`:` ภายใน `[...]` ไม่นับ) */
function splitClass(token: string) {
  const parts: string[] = []
  let depth = 0
  let current = ""
  for (const c of token) {
    if (c === "[") depth++
    else if (c === "]") depth--
    if (c === ":" && depth === 0) {
      parts.push(current)
      current = ""
    } else current += c
  }
  return { variants: parts, utility: current.replace(/^!/, "") }
}

/** class ที่ผิดกฎ 37 ในไฟล์: variant breakpoint ของ starter หรือ grid-cols-2/grid-cols-[…] ที่ไม่มี md: */
function layoutViolations(file: string): string[] {
  const sf = parse(file)
  const found = new Set<string>()
  walk(sf, (n) => {
    if (!(ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n))) return
    for (const token of n.text.split(/\s+/).filter(Boolean)) {
      const { variants, utility } = splitClass(token)
      if (variants.some((v) => STARTER_BREAKPOINTS.has(v))) found.add(token)
      else if (/^grid-cols-(?:2|\[.*\])$/.test(utility) && !variants.includes("md")) found.add(token)
    }
  })
  return Array.from(found).sort()
}

/** path ที่ import ชี้ (alias `@modules/`, `@/`, relative) สัมพัทธ์กับ apps/storefront ไม่มีนามสกุล */
function resolveImport(from: string, spec: string): string | null {
  if (spec.startsWith("@modules/")) return `src/modules/${spec.slice("@modules/".length)}`
  if (spec.startsWith("@/")) return `src/${spec.slice(2)}`
  if (spec.startsWith(".")) return path.posix.normalize(path.posix.join(path.posix.dirname(from), spec))
  return null
}

const asModule = (resolved: string) => resolved.replace(/\.(tsx?)$/, "").replace(/\/index$/, "")

function importsOf(file: string) {
  const sf = parse(file)
  return sf.statements.filter(ts.isImportDeclaration).map((d) => ({
    module: resolveImport(file, (d.moduleSpecifier as ts.StringLiteral).text),
    defaultName: d.importClause?.name?.text ?? null,
  }))
}

const FIELD_COMPONENTS: Record<string, string> = {
  "src/modules/common/components/input": "Input",
  "src/modules/common/components/checkbox": "Checkbox",
}

/** ค่าเริ่มต้นของ prop `label` ที่ component ตั้งเอง (CountrySelect: `label = "ประเทศ"` — SFUI-11a) */
function defaultLabel(module: string): string | null {
  const sf = parse(`${module}/index.tsx`)
  let found: string | null = null
  walk(sf, (n) => {
    if (ts.isBindingElement(n) && n.name.getText(sf) === "label" && n.initializer && ts.isStringLiteral(n.initializer)) {
      found = n.initializer.text
    }
  })
  return found
}

const UI_INPUT = "src/components/ui/input"

/** SFUI-19c (กฎ 65d): ไฟล์เดียวนอก src/components/** และ common/components/input ที่ import ui/input ได้ — element `<Input>` ตามนี้เท่านั้น */
const UI_INPUT_EXTRA = { file: "src/modules/search/components/search-form/index.tsx", match: { type: "search", "data-testid": "search-query-input" } }

test("AC-35 (กฎ 26): <input>/<select>/<textarea> ของ JSX อยู่ใน common/components หรือตรงคู่ ไฟล์ + element ของ allow-list (element ละหนึ่งตัวพอดี)", () => {
  const files = sourceFiles().filter((f) => /^src\/(modules|app)\/.*\.tsx$/.test(f))
  const outside: string[] = []
  const hits = new Map<Allowed, string[]>(ALLOW_LIST.map((a) => [a, []]))
  for (const file of files) {
    if (COMMON_CONTROLS.some((dir) => file.startsWith(dir))) continue
    const sf = parse(file)
    for (const tag of tagsOf(sf)) {
      const name = tag.tagName.getText(sf)
      if (!["input", "select", "textarea"].includes(name)) continue
      const a = attrs(tag, sf)
      if (name === "input" && a.type === "hidden") continue
      const where = `${file}:${line(sf, tag)} <${name} ${JSON.stringify(a)}>`
      const allowed = ALLOW_LIST.find(
        (entry) => entry.file === file && entry.tag === name && Object.entries(entry.match).every(([k, v]) => a[k] === v)
      )
      if (allowed) hits.get(allowed)!.push(where)
      else outside.push(where)
    }
  }
  expect(outside, "ช่องกรอกนอก common/components และนอก allow-list ของกฎ 26").toEqual([])
  for (const [entry, found] of hits) {
    expect(found, `${entry.file} <${entry.tag} ${JSON.stringify(entry.match)}> (${entry.why}) — ต้องพบหนึ่งตัวพอดี`).toHaveLength(1)
  }
})

test("AC-35 (กฎ 28): @/components/ui/input import ได้เฉพาะใน src/components/** และ common/components/input", () => {
  const all = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name)
      return e.isDirectory() ? all(full) : /\.tsx?$/.test(e.name) ? [path.relative(STOREFRONT, full).split(path.sep).join("/")] : []
    })
  // รวมไฟล์ test ด้วย — test ที่ render ui/input ตรงก็ข้าม component ร่วมเช่นกัน
  const offenders = all(path.join(STOREFRONT, "src")).filter(
    (file) =>
      importsOf(file).some((i) => i.module && asModule(i.module) === UI_INPUT) &&
      !file.startsWith("src/components/") &&
      !file.startsWith("src/modules/common/components/input/") &&
      file !== UI_INPUT_EXTRA.file
  )
  expect(offenders).toEqual([])
})

test("AC-35 (กฎ 65d): search-form import ui/input และมี <Input type=\"search\"> search-query-input ตัวเดียว", () => {
  const { file, match } = UI_INPUT_EXTRA
  const local = parse(file)
    .statements.filter(ts.isImportDeclaration)
    .filter((d) => asModule(resolveImport(file, (d.moduleSpecifier as ts.StringLiteral).text) ?? "") === UI_INPUT)
    .flatMap((d) => {
      const named = d.importClause?.namedBindings
      return named && ts.isNamedImports(named) ? named.elements.map((e) => e.name.text) : []
    })
  expect(local, `${file} import { Input } จาก @/components/ui/input`).toEqual(["Input"])
  const sf = parse(file)
  const inputs = tagsOf(sf)
    .filter((t) => t.tagName.getText(sf) === "Input")
    .map((t) => attrs(t, sf))
  expect(inputs.map((a) => Object.fromEntries(Object.keys(match).map((k) => [k, a[k]])))).toEqual([match])
})

test("AC-35 (กฎ 28–30): ทุก Input/CountrySelect/Checkbox ของ common ในไฟล์ของตาราง inventory มี label", () => {
  const missing: string[] = []
  let counted = 0
  for (const file of INVENTORY) {
    expect(fs.existsSync(path.join(STOREFRONT, file)), file).toBe(true)
    const locals = new Map<string, string>()
    for (const i of importsOf(file)) {
      if (i.module && i.defaultName && FIELD_COMPONENTS[asModule(i.module)]) locals.set(i.defaultName, asModule(i.module))
    }
    const sf = parse(file)
    for (const tag of tagsOf(sf)) {
      const component = locals.get(tag.tagName.getText(sf))
      if (!component) continue
      counted++
      const a = attrs(tag, sf)
      const label = a.label ?? defaultLabel(component)
      if (!label || label === "{undefined}") missing.push(`${file}:${line(sf, tag)} <${tag.tagName.getText(sf)} data-testid=${a["data-testid"]}>`)
    }
  }
  expect(missing).toEqual([])
  // จำนวนช่องในตาราง inventory: 12a 43 + 12b 22 + 12c 11 = 76 (กันตัวนับหลุดเพราะ import เปลี่ยนรูป — เพิ่ม/ลดช่องต้องแก้ spec ก่อน)
  // − 5 ของ SFUI-16a (spec 09 รอบ 49: select ของคืนสินค้า 2 + group join 3 เป็น Field + Select* ของ shadcn — ไม่ใช่ NativeSelect แล้ว)
  // − 1: SFUI-16b ประเทศของ profile-billing-address ประกอบ Select ของ shadcn ตรงที่ใช้ (spec 09 กฎ 40b — ไม่ใช่ component ของ common)
  // + 2: SFUI-18b ช่องตำบล/แขวงของ checkout (shipping-address-2-input, billing-address-2-input — spec 09 กฎ 52)
  // SFUI-20b (กฎ 70): CountrySelect ของ checkout ถูกลบ (4 ฟอร์ม) → 72 − 4
  expect(counted).toBe(68)
})

test("AC-37 (3): container ของช่องในไฟล์ inventory ไม่มี breakpoint ของ starter และ grid-cols-2/[…] มี md: — ยกเว้นระดับฟอร์มตามค่าคงที่ ไฟล์ + class", () => {
  for (const file of INVENTORY) {
    expect(layoutViolations(file), file).toEqual([...(FORM_LEVEL_EXCEPTIONS[file] ?? [])].sort())
  }
  for (const file of Object.keys(FORM_LEVEL_EXCEPTIONS)) expect(INVENTORY, file).toContain(file)
})

test("AC-37 (b) static: profile-password — รหัสผ่านเดิม–ใหม่คู่กันที่ md:, ยืนยันแถวถัดไป, ทุกช่องมี label/required/type password (ไม่ render ในหน้า profile จึงตรวจ e2e ไม่ได้)", () => {
  const file = "src/modules/account/components/profile-password/index.tsx"
  const sf = parse(file)
  const grids = tagsOf(sf).filter((t) => {
    const cls = (attrs(t, sf).className ?? "").split(/\s+/)
    return cls.includes("grid-cols-1") && cls.includes("md:grid-cols-2")
  })
  expect(grids, "container grid-cols-1 md:grid-cols-2 หนึ่งตัว").toHaveLength(1)
  const grid = grids[0].parent as ts.JsxElement
  const children = grid.children.filter((c): c is ts.JsxSelfClosingElement => ts.isJsxSelfClosingElement(c))
  expect(children.map((c) => c.tagName.getText(sf))).toEqual(["Input", "Input", "Input"])
  expect(grid.children.filter((c) => !ts.isJsxText(c) || c.text.trim() !== "")).toHaveLength(3)
  const fields = children.map((c) => attrs(c, sf))
  expect(fields.map((a) => a["data-testid"])).toEqual(["old-password-input", "new-password-input", "confirm-password-input"])
  for (const a of fields) {
    expect(a.label, a["data-testid"]).toMatch(/[฀-๿]/)
    expect(a.label, a["data-testid"]).not.toContain("*")
    expect(a.required, a["data-testid"]).toBe("")
    expect(a.type, a["data-testid"]).toBe("password")
    expect(a.placeholder, a["data-testid"]).toBeUndefined()
  }
})

// ---- SFUI-17 (spec 09 รอบ 49 กฎ 39, 40c, 48; AC-47): ปิดงาน select ----

/** ไฟล์ของตาราง inventory select (spec 09 รอบ 49) ที่ประกอบ SelectTrigger เอง — CountrySelect ใช้แทนในผู้เรียก 4 ฟอร์ม */
const SELECT_INVENTORY = [
  "products/components/product-actions/index.tsx",
  "cart/components/item/index.tsx",
  "returns/components/return-request-form/index.tsx",
  "group-buy/components/group-page/group-join.tsx",
  // SFUI-20b (กฎ 70): profile-billing-address ไม่ประกอบ Select ประเทศแล้ว และ checkout/components/country-select ถูกลบ
].map((f) => `src/modules/${f}`)

const REMOVED_MODULES = [
  "src/modules/common/components/native-select",
  "src/modules/cart/components/cart-item-select",
  "src/modules/checkout/components/country-select", // SFUI-20b (กฎ 70, AC-63 static)
]

/** ทุกไฟล์ .ts/.tsx ใต้ dir (รวม test) path สัมพัทธ์กับ apps/storefront */
function allFiles(dir: string): string[] {
  return fs.readdirSync(path.join(STOREFRONT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`
    return e.isDirectory() ? allFiles(rel) : /\.tsx?$/.test(e.name) ? [rel] : []
  })
}

test.describe("AC-47 (SFUI-17): ไม่มี select native เหลือ", () => {
  test("ไม่มี <select ใน JSX ของ src/modules/** และ src/app/** (กฎ 39)", () => {
    const found = [...allFiles("src/modules"), ...allFiles("src/app")]
      .filter((f) => f.endsWith(".tsx"))
      .flatMap((file) => {
        const sf = parse(file)
        return tagsOf(sf)
          .filter((tag) => tag.tagName.getText(sf) === "select")
          .map((tag) => `${file}:${line(sf, tag)}`)
      })
    expect(found).toEqual([])
  })

  test("ไม่มีไดเรกทอรีและการ import ของ common/components/native-select, cart/components/cart-item-select", () => {
    for (const dir of REMOVED_MODULES) expect(fs.existsSync(path.join(STOREFRONT, dir)), dir).toBe(false)
    const offenders = allFiles("src").flatMap((file) =>
      importsOf(file)
        .filter((i) => i.module && REMOVED_MODULES.includes(asModule(i.module)))
        .map((i) => `${file} → ${i.module}`)
    )
    expect(offenders).toEqual([])
  })

  test("ALLOW_LIST ไม่มีรายการ select", () => {
    expect(ALLOW_LIST.filter((a) => a.tag === "select")).toEqual([])
  })

  test("ทุก <SelectTrigger ในไฟล์ของตาราง inventory select มี id = htmlFor ของ FieldLabel ในไฟล์เดียวกัน หรือมี aria-label", () => {
    const missing: string[] = []
    for (const file of SELECT_INVENTORY) {
      const sf = parse(file)
      const tags = tagsOf(sf)
      const htmlFors = new Set(tags.filter((t) => t.tagName.getText(sf) === "FieldLabel").map((t) => attrs(t, sf).htmlFor).filter(Boolean))
      const triggers = tags.filter((t) => t.tagName.getText(sf) === "SelectTrigger")
      expect(triggers.length, `${file} มี SelectTrigger`).toBeGreaterThan(0)
      for (const trigger of triggers) {
        const a = attrs(trigger, sf)
        if (!(a.id && htmlFors.has(a.id)) && !a["aria-label"]) missing.push(`${file}:${line(sf, trigger)} id=${a.id}`)
      }
    }
    expect(missing).toEqual([])
  })

  test("e2e เรียก .selectOption() เฉพาะใน fillCard ของ support/stripe.ts (select ใน iframe ของ Stripe — กฎ 48)", () => {
    const outside: string[] = []
    let inFillCard = 0
    for (const file of allFiles("e2e").filter((f) => f.endsWith(".ts"))) {
      const sf = ts.createSourceFile(file, readSource(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      walk(sf, (n) => {
        if (!(ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "selectOption")) return
        let owner: ts.Node | undefined = n.parent
        while (owner && !(ts.isFunctionDeclaration(owner) && owner.name?.text === "fillCard")) owner = owner.parent
        if (file === "e2e/support/stripe.ts" && owner) inFillCard++
        else outside.push(`${file}:${line(sf, n)}`)
      })
    }
    expect(outside).toEqual([])
    expect(inFillCard, "fillCard ยังเลือกประเทศ/ข้อมูลใน iframe ของ Stripe ด้วย selectOption").toBeGreaterThan(0)
  })
})

// SFUI-19d (spec 09 กฎ 67b, 68; AC-61 (1)): checkbox ตัวกรองเป็น `ui/checkbox` (ไม่อยู่ใน allow-list) และ AccordionTrigger ใช้ขนาด default
test.describe("AC-61 (SFUI-19d): ตัวกรองของ store", () => {
  const FILTER_FILES = ["store/components/store-refinements/on-sale-toggle.tsx", "store/components/store-refinements/refinement-group.tsx"].map(
    (f) => `src/modules/${f}`
  )

  test("allow-list ไม่มีรายการของ on-sale-toggle/refinement-group และสองไฟล์ render Checkbox ของ @/components/ui/checkbox", () => {
    expect(ALLOW_LIST.filter((a) => FILTER_FILES.includes(a.file))).toEqual([])
    for (const file of FILTER_FILES) {
      expect(importsOf(file).some((i) => i.module === "src/components/ui/checkbox"), `${file} import ui/checkbox`).toBe(true)
      const sf = parse(file)
      expect(tagsOf(sf).filter((t) => t.tagName.getText(sf) === "Checkbox"), file).toHaveLength(1)
    }
  })

  test("AccordionTrigger ของ product-tabs และ option-refinements ไม่มี className ที่เปลี่ยน padding/ความสูง/ตัวอักษร (กฎ 68)", () => {
    const SIZE = /^(?:[a-z0-9-]+:)*(?:p[xytrbl]?-|h-|min-h-|max-h-|leading-|font-|text-(?:xs|sm|base|lg|\d?xl|\[))/
    const found: string[] = []
    let triggers = 0
    for (const file of ["products/components/product-tabs/accordion.tsx", "store/components/store-refinements/option-refinements.tsx"].map((f) => `src/modules/${f}`)) {
      const sf = parse(file)
      for (const tag of tagsOf(sf).filter((t) => t.tagName.getText(sf) === "AccordionTrigger")) {
        triggers++
        const bad = (attrs(tag, sf).className ?? "").split(/\s+/).filter((t) => SIZE.test(t))
        if (bad.length) found.push(`${file}:${line(sf, tag)} ${bad.join(" ")}`)
      }
    }
    expect(triggers).toBe(2)
    expect(found).toEqual([])
  })
})
