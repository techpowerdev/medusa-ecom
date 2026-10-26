import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

// spec 01 AC-49 + กฎข้อ 44 / AC-80: ข้อความ error ที่ storefront สร้างเองใน lib/data/* (server action/data function)
// และ route handler เป็นภาษาไทย — ESLint rule ไม่ครอบ (ไม่มี JSX) จึงอ่านจาก source ด้วย TypeScript AST เก็บทุกข้อความที่ส่งออก
// (`throw new Error(…)`, `new Error(…)`, `new NextResponse(…)`/`new Response(…)`, ค่าของ property `error`) รวมทุกกิ่งของ `?:`, `||`, `??`
// ไม่ assert จำนวนข้อความ — ข้อความใหม่ถูกตรวจอัตโนมัติ; error ของ Medusa API (`errorMessage(error)`) แสดงตามที่ได้รับ ไม่นับ
// ไฟล์ของ task ที่แปลแล้ว (ตาราง "เจ้าของ path" ของ AC-49): customer.ts (CORE-4c1), orders.ts + cart/add (CORE-4c2) — cart.ts เพิ่มใน CORE-4d
const FILES = [
  "lib/data/customer.ts",
  "lib/data/orders.ts",
  "app/[countryCode]/(main)/cart/add/route.ts",
]
const RESPONSE = ["Error", "NextResponse", "Response"]
const THAI = /[฀-๿]/
const LATIN_WORD = /[A-Za-z]{2,}/g

/** ข้อความ (string/template) ในตำแหน่งที่เป็นค่าผลลัพธ์ของ expression */
const resultTexts = (node: ts.Expression): string[] => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text]
  if (ts.isTemplateExpression(node)) {
    return [node.head.text + node.templateSpans.map((s) => s.literal.text).join(" ")]
  }
  if (ts.isParenthesizedExpression(node)) return resultTexts(node.expression)
  if (ts.isConditionalExpression(node)) {
    return [...resultTexts(node.whenTrue), ...resultTexts(node.whenFalse)]
  }
  if (
    ts.isBinaryExpression(node) &&
    [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(
      node.operatorToken.kind
    )
  ) {
    return [...resultTexts(node.left), ...resultTexts(node.right)]
  }
  return []
}

const userMessages = (source: string): string[] => {
  const file = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isNewExpression(node) && RESPONSE.includes(node.expression.getText(file)) && node.arguments?.[0]) {
      found.push(...resultTexts(node.arguments[0]))
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(file) === "error") {
      found.push(...resultTexts(node.initializer))
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
    `
    expect(userMessages(source).sort()).toEqual(["a1", "a2 ", "a3", "a4", "a5", "a6", "a7", "a8"])
  })

  it("ไม่นับ error ของ Medusa API ที่ส่งต่อ", () => {
    expect(userMessages("return { error: errorMessage(error) }")).toEqual([])
  })
})

describe.each(FILES)("ข้อความ error ของ %s เป็นภาษาไทย (AC-49, AC-80)", (name) => {
  it("ทุกข้อความมีอักษรไทยและไม่มีคำละติน", () => {
    const source = fs.readFileSync(path.resolve(__dirname, name), "utf8")
    expect(userMessages(source).filter(notThai)).toEqual([])
  })
})
