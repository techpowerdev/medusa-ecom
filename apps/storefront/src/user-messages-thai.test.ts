import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

// spec 01 AC-49 + กฎข้อ 44 / AC-80: ข้อความ error ที่ storefront สร้างเองใน lib/data/* (server action/data function)
// และ route handler เป็นภาษาไทย — ESLint rule ไม่ครอบ (ไม่มี JSX) จึงอ่านจาก source ด้วย TypeScript AST เก็บทุกข้อความที่ส่งออก
// (`throw new Error(…)`, `new Error(…)`, `new NextResponse(…)`/`new Response(…)`, ค่าของ property `error`) รวมทุกกิ่งของ `?:`, `||`, `??`,
// argument ของ function ที่เรียก (เช่น fallback ของ `friendlyErrorMessage(error, "…")`) และค่าของ `const` ที่อ้างถึงในไฟล์เดียวกัน
// ไม่ assert จำนวนข้อความ — ข้อความใหม่ถูกตรวจอัตโนมัติ; error ของ Medusa API (`errorMessage(error)`) แสดงตามที่ได้รับ ไม่นับ
// ไฟล์ของ task ที่แปลแล้ว (ตาราง "เจ้าของ path" ของ AC-49): customer.ts (CORE-4c1), orders.ts + cart/add (CORE-4c2), cart.ts (CORE-4d), returns.ts (CORE-20)
const FILES = [
  "lib/data/customer.ts",
  "lib/data/orders.ts",
  "app/[countryCode]/(main)/cart/add/route.ts",
  "lib/data/cart.ts",
  // CORE-20
  "lib/data/returns.ts",
]
// CORE-4d: ข้อความที่ component ของ checkout ตั้งเอง ESLint rule ไม่ครอบ (`setError("…")`, prop `error="…"` ของ ErrorMessage,
// `metadata` ของหน้า, `title` ของวิธีชำระเงินใน lib/constants.tsx) — ตรวจด้วยตัวอ่านเดียวกัน
const CHECKOUT_DIRS = ["app/[countryCode]/(checkout)", "modules/checkout", "modules/shipping"]
// ADR-014 ข้อ 4: ชื่อแบรนด์วิธีชำระเงินคงเป็นละตินได้ — ยกเว้นพร้อมเพย์ใช้ "พร้อมเพย์" แบบเดียว (CORE-4e กฎข้อ 54)
const BRANDS = ["PayPal", "iDeal", "Bancontact"]
const tsxFiles = (dir: string): string[] =>
  fs.readdirSync(path.resolve(__dirname, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) return tsxFiles(rel)
    return /\.tsx?$/.test(entry.name) ? [rel] : []
  })
const RESPONSE = ["Error", "NextResponse", "Response"]
// property ที่เป็นข้อความถึงผู้ใช้ (`message` ของผลลัพธ์ server action, `title`/`description` ของ metadata/วิธีชำระเงิน)
const MESSAGE_PROPS = ["error", "message", "title", "description"]
const SET_ERROR = /^set(Error|ErrorMessage)$/
const THAI = /[฀-๿]/
const LATIN_WORD = /[A-Za-z]{2,}/g

/** ข้อความ (string/template) ในตำแหน่งที่เป็นค่าผลลัพธ์ของ expression */
const resultTexts = (node: ts.Expression, consts: Map<string, ts.Expression>): string[] => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text]
  if (ts.isTemplateExpression(node)) {
    return [node.head.text + node.templateSpans.map((s) => s.literal.text).join(" ")]
  }
  if (ts.isParenthesizedExpression(node)) return resultTexts(node.expression, consts)
  if (ts.isConditionalExpression(node)) {
    return [...resultTexts(node.whenTrue, consts), ...resultTexts(node.whenFalse, consts)]
  }
  if (
    ts.isBinaryExpression(node) &&
    [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(
      node.operatorToken.kind
    )
  ) {
    return [...resultTexts(node.left, consts), ...resultTexts(node.right, consts)]
  }
  if (ts.isCallExpression(node)) return node.arguments.flatMap((arg) => resultTexts(arg, consts))
  if (ts.isIdentifier(node) && consts.has(node.text)) return resultTexts(consts.get(node.text)!, consts)
  return []
}

const userMessages = (source: string, fileName = "source.ts"): string[] => {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind)
  const found: string[] = []
  const consts = new Map<string, ts.Expression>()
  const collectConsts = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      consts.set(node.name.text, node.initializer)
    }
    ts.forEachChild(node, collectConsts)
  }
  collectConsts(file)
  const visit = (node: ts.Node) => {
    if (ts.isNewExpression(node) && RESPONSE.includes(node.expression.getText(file)) && node.arguments?.[0]) {
      found.push(...resultTexts(node.arguments[0], consts))
    }
    if (ts.isPropertyAssignment(node) && MESSAGE_PROPS.includes(node.name.getText(file))) {
      found.push(...resultTexts(node.initializer, consts))
    }
    if (ts.isCallExpression(node) && SET_ERROR.test(node.expression.getText(file))) {
      found.push(...node.arguments.flatMap((arg) => resultTexts(arg, consts)))
    }
    if (ts.isJsxAttribute(node) && node.name.getText(file) === "error" && node.initializer) {
      const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer
      if (value) found.push(...resultTexts(value, consts))
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

const notThai = (message: string) =>
  !THAI.test(message) || (message.match(LATIN_WORD) ?? []).length > 0

describe("ตัวอ่านข้อความจาก source (กฎข้อ 44)", () => {
  it("พบข้อความทุกรูปแบบที่ส่งออก", () => {
    const source = `
      throw new Error("a1")
      const e = new Error(\`a2 \${x}\`)
      return { error: "a3" }
      return { state: "error", error: "error" in x ? x.error : "a4" }
      return { error: cond ? "a5" : \`a6\` }
      return { error: x || "a7" }
      return new NextResponse("a8", { status: 404 })
      const FALLBACK = "a9"
      return new NextResponse(friendlyErrorMessage(error, FALLBACK), { status: 400 })
      return { error: friendlyErrorMessage(err, "a10") }
      return { status: "error", message: "a11" }
      export const metadata = { title: "a12", description: "a13" }
      setError(e.error?.message ?? "a14")
      setErrorMessage("a15")
      const el = <ErrorMessage error="a16" />
    `
    expect(userMessages(source, "source.tsx").sort()).toEqual(
      ["a1", "a10", "a11", "a12", "a13", "a14", "a15", "a16", "a2 ", "a3", "a4", "a5", "a6", "a7", "a8", "a9"]
    )
  })

  it("ไม่นับ error ของ Medusa API ที่ส่งต่อ", () => {
    expect(userMessages("return { error: errorMessage(error) }")).toEqual([])
  })
})

// CORE-19d (กฎข้อ 68): `deleteLineItem` คืน `{ error: "unauthorized" | "failed" }` เป็นรหัสให้ client แปลเป็นข้อความไทย ไม่ใช่ข้อความถึงผู้ใช้
const ERROR_CODES = ["unauthorized", "failed"]

describe.each(FILES)("ข้อความ error ของ %s เป็นภาษาไทย (AC-49, AC-80)", (name) => {
  it("ทุกข้อความมีอักษรไทยและไม่มีคำละติน", () => {
    const source = fs.readFileSync(path.resolve(__dirname, name), "utf8")
    expect(userMessages(source).filter((m) => !ERROR_CODES.includes(m)).filter(notThai)).toEqual([])
  })
})

describe.each(CHECKOUT_DIRS.flatMap(tsxFiles).concat("lib/constants.tsx"))(
  "ข้อความที่ checkout ตั้งเองใน %s เป็นภาษาไทย (AC-48 4d, AC-49)",
  (name) => {
    it("ทุกข้อความมีอักษรไทยและไม่มีคำละติน (ยกเว้นชื่อแบรนด์)", () => {
      const source = fs.readFileSync(path.resolve(__dirname, name), "utf8")
      // "" = ล้างข้อความ error (setErrorMessage(""))
      const bad = userMessages(source, name).filter((m) => m !== "" && notThai(m) && !BRANDS.includes(m))
      expect(bad).toEqual([])
    })
  }
)
// CORE-4e (AC-90): renewPromptPaySession ตรวจด้วยพฤติกรรม (mock fetch) ใน checkout-thai-polish.test.ts แทนการตัด source
