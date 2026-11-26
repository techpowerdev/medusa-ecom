// spec 10 (AI18N-1): ฟังก์ชันตรวจของ unit i18n — parity (กฎ 5), key ที่ใช้ (กฎ 6–7) และ guard static (กฎ 14)
// แยกจากไฟล์ spec เพราะ unit ของ AI18N-2..4 (`lib/__tests__/i18n-<กลุ่ม>.unit.spec.ts`) ใช้ตัวตรวจชุดเดียวกัน
// guard อ่าน source ด้วย TypeScript compiler API (ไม่ใช่ regex บรรทัด) — `.tsx` ทดสอบใน jest ไม่ได้ (transform แค่ .[jt]s)
import { readFileSync } from "fs"
import { join } from "path"
import * as ts from "typescript"

export type Json = { [key: string]: string | Json }

export const THAI = /[฀-๿]/

// ---------- กฎ 5: parity ----------

/** แปลง JSON ซ้อนเป็น key แบบจุด `{ a: { b: "x" } }` → `{ "a.b": "x" }` */
export const flatten = (json: Json, prefix = ""): Record<string, string> =>
  Object.entries(json).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === "string" ? { ...acc, [path]: value } : { ...acc, ...flatten(value, path) }
  }, {})

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

/** key หลังตัด suffix plural (`items_one`/`items_other` → `items`) */
export const baseKey = (key: string) => key.replace(PLURAL_SUFFIX, "")

const vars = (value: string) => [...new Set([...value.matchAll(/{{\s*([\w.]+)\s*}}/g)].map((m) => m[1]))].sort()

/**
 * ปัญหา parity ของ namespace หนึ่ง (ว่าง = ผ่าน): key ที่มีฝั่งเดียว (หลัง normalize plural), ชุด `{{var}}` ต่อ key ไม่เท่ากัน,
 * ค่า `th` ที่ไม่มีอักษรไทย (ยกเว้น key ใน `latinKeys` — ชื่อเฉพาะ/หน่วย)
 */
export const parityIssues = (en: Json, th: Json, latinKeys: string[] = []): string[] => {
  const enFlat = flatten(en)
  const thFlat = flatten(th)
  const group = (flat: Record<string, string>) =>
    Object.entries(flat).reduce<Record<string, string[]>>((acc, [key, value]) => {
      const base = baseKey(key)
      acc[base] = [...new Set([...(acc[base] ?? []), ...vars(value)])].sort()
      return acc
    }, {})
  const enKeys = group(enFlat)
  const thKeys = group(thFlat)
  const issues: string[] = []
  for (const key of Object.keys(enKeys)) {
    if (!(key in thKeys)) issues.push(`ไม่มีใน th: ${key}`)
    else if (enKeys[key].join() !== thKeys[key].join()) issues.push(`{{var}} ไม่ตรง: ${key}`)
  }
  for (const key of Object.keys(thKeys)) {
    if (!(key in enKeys)) issues.push(`ไม่มีใน en: ${key}`)
  }
  for (const [key, value] of Object.entries(thFlat)) {
    if (!THAI.test(value) && !latinKeys.includes(baseKey(key))) issues.push(`th ไม่มีอักษรไทย: ${key}`)
  }
  return issues
}

// ---------- กฎ 6–7: key ที่ใช้ในโค้ด ----------

export type Resources = { en: Record<string, Json>; th: Record<string, Json> }

/** key ของ Medusa (namespace `translation`) ที่อนุญาตให้อ้าง พร้อมข้อความเดิมของเรา — ค่า `en` ของ dashboard ต้องเท่ากัน (กฎ 6) */
export const MEDUSA_KEYS: Record<string, string> = {
  "actions.save": "Save",
  "actions.cancel": "Cancel",
  "actions.edit": "Edit",
  "actions.delete": "Delete",
  "actions.create": "Create",
  "general.unsavedChangesTitle": "Are you sure you want to leave this form?",
  "general.unsavedChangesDescription": "You have unsaved changes that will be lost if you exit this form.",
  // AI18N-4: ผลค้นหาว่างของตาราง affiliate (components/affiliate/list-table.tsx)
  "general.noResultsTitle": "No results",
  "general.noResultsMessage": "Try changing the filters or search query",
}

const dashboardDir = () => join(require.resolve("@medusajs/dashboard/package.json"), "..")

/** ไฟล์คำแปลของ dashboard (`en`/`th`) แบบ key จุด */
export const dashboardTranslations = (lng: "en" | "th"): Record<string, string> =>
  flatten(JSON.parse(readFileSync(join(dashboardDir(), "src/i18n/translations", `${lng}.json`), "utf8")))

/** key มีใน `en` ของ namespace (รวม plural `_one`/`_other`) */
export const hasKey = (resources: Resources, ns: string, key: string) => {
  const flat = flatten(resources.en[ns] ?? {})
  return key in flat || `${key}_one` in flat || `${key}_other` in flat
}

/**
 * ค่าใน array/union ของ enum ที่ไม่มี key `<prefix>.<value>` ใน `en` (กฎ 7) — unit ของแต่ละกลุ่ม (AI18N-2..4) เรียกกับ enum
 * ของกลุ่มตัวเอง (array ค่าคงที่ หรือ `unionLiterals` ของ type union); ecom-common ไม่มี enum
 */
export const missingEnumKeys = (resources: Resources, ns: string, prefix: string, values: readonly string[]) =>
  values.filter((value) => !hasKey(resources, ns, `${prefix}.${value}`))

const parse = (fileName: string, src: string) =>
  ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

/** literal ของ type union ที่ประกาศในไฟล์ (`type CampaignStatus = "draft" | "active"`) — อ่านด้วย compiler API แบบเดียวกับ guard */
export const unionLiterals = (fileName: string, src: string, typeName: string): string[] => {
  const out: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === typeName) {
      const collect = (type: ts.TypeNode) => {
        if (ts.isUnionTypeNode(type)) type.types.forEach(collect)
        else if (ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) out.push(type.literal.text)
      }
      collect(node.type)
    }
    ts.forEachChild(node, visit)
  }
  visit(parse(fileName, src))
  return out
}

const stringArg = (node: ts.Node | undefined) => (node && ts.isStringLiteralLike(node) ? node.text : undefined)

const objectProp = (obj: ts.Node | undefined, name: string) =>
  obj && ts.isObjectLiteralExpression(obj)
    ? obj.properties.find(
        (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && propName(p.name) === name
      )?.initializer
    : undefined

const propName = (name: ts.PropertyName | ts.JsxAttributeName) =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined

const calleeName = (call: ts.CallExpression | ts.NewExpression) =>
  ts.isIdentifier(call.expression)
    ? call.expression.text
    : ts.isPropertyAccessExpression(call.expression)
      ? call.expression.name.text
      : undefined

/** ชื่อเรียก t ในไฟล์: `t` และ alias ของ helper `import { t as tNs } from ".../i18n/t"` (AI18N-N1 — กันซ้อนชื่อกับ t ของ useTranslation) */
const translateNames = (sf: ts.SourceFile) => {
  const names = new Set(["t"])
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    if (!/(^|\/)i18n\/t$/.test(statement.moduleSpecifier.text)) continue
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings))
      for (const el of bindings.elements) if ((el.propertyName ?? el.name).text === "t") names.add(el.name.text)
  }
  return names
}

/**
 * บรรทัดที่ประกาศ `t` ในไฟล์ที่ import helper เป็นชื่อ `t` ตรงๆ (ว่าง = ผ่าน) — ชื่อซ้อนกับ `const { t } = useTranslation(...)` ฯลฯ
 * ให้ import helper แบบ alias (`import { t as tNs } from ".../i18n/t"`) แทน (AI18N-N1)
 */
export const shadowedHelperLines = (fileName: string, src: string): number[] => {
  const sf = parse(fileName, src)
  const helperAsT = sf.statements.some(
    (s) =>
      ts.isImportDeclaration(s) &&
      ts.isStringLiteral(s.moduleSpecifier) &&
      /(^|\/)i18n\/t$/.test(s.moduleSpecifier.text) &&
      !!s.importClause?.namedBindings &&
      ts.isNamedImports(s.importClause.namedBindings) &&
      s.importClause.namedBindings.elements.some((el) => el.name.text === "t")
  )
  if (!helperAsT) return []
  const lines: number[] = []
  const visit = (node: ts.Node) => {
    if (
      (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node) || ts.isFunctionDeclaration(node)) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.name.text === "t"
    )
      lines.push(sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1)
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return lines
}

/**
 * key literal ที่ไฟล์ใช้แต่ไม่มีจริง (กฎ 6; ว่าง = ผ่าน) — `t("<key>", { ns? })` ของ `useTranslation("<ns>")`,
 * helper `t("<ns>", "<key>")` (namespace ของเรา) และ `defineRouteConfig({ label, translationNs })`;
 * `ns: "translation"` ต้องอยู่ใน `MEDUSA_KEYS` และค่า `en` ของ dashboard เท่าข้อความเดิม; key ที่ไม่ใช่ literal (enum) ตรวจด้วย `missingEnumKeys`
 */
export const keyIssues = (fileName: string, src: string, resources: Resources): string[] => {
  const ours = Object.keys(resources.en)
  const dashboardEn = dashboardTranslations("en")
  const issues: string[] = []
  const namespaces = new Set<string>()
  const calls: { key: string; ns?: string }[] = []
  const sf = parse(fileName, src)
  const tNames = translateNames(sf)

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = calleeName(node)
      const name = callee && tNames.has(callee) ? "t" : callee
      const [a0, a1] = node.arguments
      if (name === "useTranslation") {
        const ns = stringArg(a0)
        if (ns) namespaces.add(ns)
        else issues.push("useTranslation ต้องระบุ namespace เป็น string literal")
      } else if (name === "t" && stringArg(a0) && ours.includes(stringArg(a0)!) && stringArg(a1)) {
        calls.push({ ns: stringArg(a0), key: stringArg(a1)! })
      } else if (name === "t" && stringArg(a0) && ours.includes(stringArg(a0)!) && a1 && ts.isTemplateExpression(a1)) {
        // helper ที่ key เป็น template (enum `t("<ns>", \`<prefix>.${value}\`)`) — ตรวจด้วย missingEnumKeys (กฎ 7)
      } else if (name === "t" && stringArg(a0) && ours.includes(stringArg(a0)!) && a1) {
        // key แบบ identifier/expression อื่นตรวจแบบ static ไม่ได้ (nit review AI18N-3) — ให้เขียนเป็น literal หรือ template ของ enum
        issues.push(`${stringArg(a0)}: key ไม่ใช่ literal/template (${a1.getText()})`)
      } else if (name === "t" && stringArg(a0)) {
        calls.push({ key: stringArg(a0)!, ns: stringArg(objectProp(a1, "ns")) })
      } else if (name === "defineRouteConfig") {
        const ns = stringArg(objectProp(a0, "translationNs"))
        const label = stringArg(objectProp(a0, "label"))
        if (ns && label) calls.push({ ns, key: label })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)

  if (namespaces.size > 1) issues.push(`useTranslation หลาย namespace: ${[...namespaces].join(", ")}`)
  const fileNs = [...namespaces][0]
  for (const { key, ns = fileNs } of calls) {
    if (ns === "translation") {
      if (!(key in MEDUSA_KEYS)) issues.push(`translation:${key} ไม่อยู่ในรายการ MEDUSA_KEYS`)
      else if (dashboardEn[key] !== MEDUSA_KEYS[key]) issues.push(`translation:${key} ค่า en ของ dashboard ไม่เท่าข้อความเดิม`)
    } else if (!ns || !ours.includes(ns)) {
      issues.push(`${key}: ไม่รู้ namespace (${ns ?? "ไม่มี useTranslation"})`)
    } else if (!hasKey(resources, ns, key)) {
      issues.push(`${ns}:${key}`)
    }
  }
  return issues
}

// ---------- กฎ 14: guard static ----------

export type GuardRule = "a" | "b" | "c" | "d" | "e" | "f" | "g"
export type GuardIssue = { rule: GuardRule; text: string; line: number }

/** ชื่อเฉพาะ/หน่วยที่คงละตินได้ (กฎ 14 allowlist) */
export const LATIN_TOKENS = ["THB", "CSV", "URL", "ID"]
/** literal ที่ function export ใน lib คืนได้ (กฎ 14e) ต่อไฟล์ — ค่าภายในที่ไม่ใช่ข้อความแสดงผล (ผูกกับไฟล์ — nit review AI18N-3) */
export const RETURN_ALLOWLIST: Record<string, string[]> = {
  // AI18N-3: `PoolStockState` (ค่า enum ภายใน — ข้อความแสดงผลอยู่ใน ecom-evoucher `stock.*`)
  "lib/evoucher-pool-delete.ts": ["no_codes", "low", "ok"],
}

const TEXT_PROPS = new Set([
  "title",
  "label",
  "placeholder",
  "heading",
  "subHeading",
  "description",
  "message",
  "error",
  "confirmText",
  "cancelText",
  "children",
  "text",
])
const ZOD_METHODS = new Set([
  "min",
  "max",
  "length",
  "regex",
  "email",
  "url",
  "refine",
  "superRefine",
  "nonempty",
  "int",
  "positive",
  "nonnegative",
  "negative",
  "nonpositive",
  "gt",
  "gte",
  "lt",
  "lte",
  "multipleOf",
  "finite",
])

const stripTokens = (text: string) =>
  LATIN_TOKENS.reduce((rest, token) => rest.replace(new RegExp(`\\b${token}\\b`, "g"), " "), text)

/** มีคำละติน ≥ 2 ตัวอักษร (หลังตัด allowlist) */
export const hasLatinWord = (text: string) => /[A-Za-z]{2,}/.test(stripTokens(text))
/** มีคำละตินสองคำคั่นด้วยช่องว่าง (ประโยค) */
const hasLatinPhrase = (text: string) => /[A-Za-z]{2,}[.,:;!?'")]*\s+[("']*[A-Za-z]{2,}/.test(stripTokens(text))

type Literal = { text: string; template: boolean; node: ts.Node }

/** ข้อความ literal ใน expression (ผ่าน `?:`, `??`/`||`/`&&`/`+`, วงเล็บ, `as`) — ไม่เข้าไปใน function/call */
const literalsOf = (expr: ts.Node | undefined): Literal[] => {
  if (!expr) return []
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [{ text: expr.text, template: false, node: expr }]
  if (ts.isTemplateExpression(expr)) {
    const text = [expr.head.text, ...expr.templateSpans.map((s) => s.literal.text)].join(" ")
    return [{ text, template: true, node: expr }]
  }
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isJsxExpression(expr)) return literalsOf(expr.expression)
  if (ts.isConditionalExpression(expr)) return [...literalsOf(expr.whenTrue), ...literalsOf(expr.whenFalse)]
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind
    // `cond && "x"` → เฉพาะฝั่งขวา; `??`/`||`/`+` ทั้งสองฝั่ง; การเปรียบเทียบ (`type === "button"`) ไม่ใช่ข้อความแสดงผล
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return literalsOf(expr.right)
    if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.PlusToken)
      return [...literalsOf(expr.left), ...literalsOf(expr.right)]
    return []
  }
  return []
}

const isFunctionLike = (node: ts.Node) =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isConstructorDeclaration(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isSetAccessorDeclaration(node)

const insideFunction = (node: ts.Node) => {
  for (let p = node.parent; p; p = p.parent) if (isFunctionLike(p)) return true
  return false
}

const isExported = (node: ts.Node) =>
  ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

/** function ที่ export (`export function f`, `export const f = () => ...`) */
const exportedFunction = (fn: ts.Node) => {
  if (ts.isFunctionDeclaration(fn)) return isExported(fn)
  if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isVariableDeclaration(fn.parent)) {
    const statement = fn.parent.parent?.parent
    return !!statement && ts.isVariableStatement(statement) && isExported(statement)
  }
  return false
}

const enclosingFunction = (node: ts.Node) => {
  for (let p = node.parent; p; p = p.parent) if (isFunctionLike(p)) return p
  return undefined
}

const isTranslateCall = (node: ts.CallExpression, tNames: Set<string>) => {
  const name = calleeName(node)
  return (!!name && tNames.has(name)) || name === "useTranslation"
}

export type GuardOptions = {
  /** ไฟล์ใน `I18N_PENDING` — ตรวจเฉพาะ (f), (g) */
  pending?: boolean
  /** ไฟล์ที่ `new Error(...)` ถูกนำไปแสดงต่อผู้ใช้ (กฎ 14c) */
  errorShownToUser?: boolean
}

/**
 * ข้อความ UI ฮาร์ดโค้ด (กฎ 14 a–e) และการเรียก t ตอนโหลด module / route config ที่ไม่ใช่ literal (f–g) ของไฟล์หนึ่ง
 * `fileName` เป็น path สัมพัทธ์จาก `src/admin` (เช่น `lib/group-buy-form.ts`) — (e) ใช้กับ `lib/*.ts`
 */
export const guardIssues = (fileName: string, src: string, { pending = false, errorShownToUser = false }: GuardOptions = {}) => {
  const sf = parse(fileName, src)
  const tNames = translateNames(sf)
  const isLib = /^lib\/[^/]+\.ts$/.test(fileName)
  const issues: GuardIssue[] = []
  const add = (rule: GuardRule, node: ts.Node, text: string) =>
    issues.push({ rule, text, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 })
  const flagLatin = (rule: GuardRule, expr: ts.Node | undefined) =>
    literalsOf(expr)
      .filter((l) => hasLatinWord(l.text))
      .forEach((l) => add(rule, l.node, l.text))
  // label ของ defineRouteConfig ที่มี translationNs เป็น key ไม่ใช่ข้อความ (กฎ 9)
  const routeLabelKeys = new Set<ts.Node>()

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node)
      // (f) ทุกไฟล์
      if (isTranslateCall(node, tNames) && !insideFunction(node)) add("f", node, node.getText(sf))
      // (g) ทุกไฟล์
      if (name === "defineRouteConfig" && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
        const ns = objectProp(node.arguments[0], "translationNs")
        const label = objectProp(node.arguments[0], "label")
        if (ns) {
          if (!ts.isStringLiteral(ns)) add("g", ns, `translationNs: ${ns.getText(sf)}`)
          if (!label || !ts.isStringLiteral(label)) add("g", label ?? node, `label: ${label?.getText(sf) ?? "(ไม่มี)"}`)
          else routeLabelKeys.add(label)
        }
      }
      if (!pending) {
        // (c)
        if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "toast")
          flagLatin("c", node.arguments[0])
        // (d)
        if (name && ZOD_METHODS.has(name) && ts.isPropertyAccessExpression(node.expression)) {
          for (const arg of node.arguments) {
            if (ts.isObjectLiteralExpression(arg)) {
              flagLatin("d", objectProp(arg, "message"))
              flagLatin("d", objectProp(arg, "error"))
            } else flagLatin("d", arg)
          }
        }
        if (name === "fieldErrorMap" && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
          for (const p of node.arguments[0].properties) if (ts.isPropertyAssignment(p)) flagLatin("d", p.initializer)
        }
      }
    }
    if (!pending) {
      // (c) new FormError / new Error ที่แสดงต่อผู้ใช้
      if (ts.isNewExpression(node)) {
        const name = calleeName(node)
        if (name === "FormError" || (name === "Error" && errorShownToUser)) flagLatin("c", node.arguments?.[0])
      }
      // (a) JSX text และ string literal ที่เป็นลูกของ element
      if (ts.isJsxText(node) && hasLatinWord(node.text)) add("a", node, node.text.trim())
      if (ts.isJsxExpression(node) && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) flagLatin("a", node.expression)
      // (b) prop/key ที่เป็นข้อความ
      if (ts.isJsxAttribute(node) && TEXT_PROPS.has(propName(node.name) ?? "")) flagLatin("b", node.initializer)
      if (ts.isPropertyAssignment(node) && TEXT_PROPS.has(propName(node.name) ?? "") && !routeLabelKeys.has(node.initializer))
        flagLatin("b", node.initializer)
      // (e) lib: ประโยคอังกฤษ (ขึ้นต้นตัวใหญ่) และ literal คำละตินที่ function export คืน
      if (isLib && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node))) {
        const inType = ts.isLiteralTypeNode(node.parent) || ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)
        const [literal] = literalsOf(node)
        const sentence = literal.template ? hasLatinPhrase(literal.text) : /^[A-Z]/.test(literal.text) && hasLatinPhrase(literal.text)
        if (!inType && sentence) add("e", node, literal.text)
      }
      if (isLib) {
        const returned = ts.isReturnStatement(node)
          ? node.expression
          : ts.isArrowFunction(node) && !ts.isBlock(node.body)
            ? node.body
            : undefined
        const fn = ts.isReturnStatement(node) ? enclosingFunction(node) : node
        if (returned && fn && exportedFunction(fn)) {
          // template (path ของ API ฯลฯ) ตรวจด้วยเงื่อนไขประโยคด้านบนแล้ว
          literalsOf(returned)
            .filter((l) => !l.template && hasLatinWord(l.text) && !RETURN_ALLOWLIST[fileName]?.includes(l.text))
            .forEach((l) => add("e", l.node, `return ${l.text}`))
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  // call ถูกเยี่ยมก่อนลูก — label ของ route config อยู่ใน routeLabelKeys ก่อนเยี่ยม property ของมัน
  visit(sf)
  return issues
}
