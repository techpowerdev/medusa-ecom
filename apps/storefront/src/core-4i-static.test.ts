import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

// CORE-4i (spec 01 กฎข้อ 72, AC-110 static): ใน modules/checkout/** และ modules/cart/** ห้ามมี `friendlyErrorMessage(`
// ใน `catch` หรือ callback ของ `.catch(` — server action ต้องคืน `{ error }` ให้ผู้เรียกอ่าน (error ที่ throw ถูก Next ซ่อนใน production)
const DIRS = ["modules/checkout", "modules/cart"]

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(path.resolve(__dirname, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(rel)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : []
  })

const isCatchCallback = (node: ts.Node) =>
  (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
  ts.isCallExpression(node.parent) &&
  ts.isPropertyAccessExpression(node.parent.expression) &&
  node.parent.expression.name.text === "catch"

/** บรรทัดที่เรียก friendlyErrorMessage( ภายใน catch clause หรือ callback ของ .catch( */
const friendlyInCatch = (source: string, fileName = "source.tsx"): number[] => {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind)
  const lines: number[] = []
  const visit = (node: ts.Node, inCatch: boolean) => {
    const here = inCatch || ts.isCatchClause(node) || isCatchCallback(node)
    if (here && ts.isCallExpression(node) && node.expression.getText(file) === "friendlyErrorMessage") {
      lines.push(file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1)
    }
    ts.forEachChild(node, (child) => visit(child, here))
  }
  visit(file, false)
  return lines
}

describe("ตัวตรวจ friendlyErrorMessage ใน catch (AC-110)", () => {
  it("พบทั้ง try/catch และ .catch(callback); ไม่นับการเรียกนอก catch", () => {
    const source = [
      "try { await a() } catch (e) { setError(friendlyErrorMessage(e, \"x\")) }",
      "await b().catch((err) => setError(friendlyErrorMessage(err)))",
      "await c().catch(function (err) { return friendlyErrorMessage(err) })",
      "const m = friendlyErrorMessage(result, \"x\")",
    ].join("\n")
    expect(friendlyInCatch(source)).toEqual([1, 2, 3])
  })
})

// CORE-4i-b: ไม่มีไฟล์ยกเว้นแล้ว (payment, payment-button, shipping แปลงครบ)
describe.each(DIRS.flatMap(sourceFiles))(
  "%s ไม่แปลง error จาก catch ของ server action (กฎข้อ 72)",
  (name) => {
    it("ไม่มี friendlyErrorMessage( ใน catch", () => {
      const source = fs.readFileSync(path.resolve(__dirname, name), "utf8")
      expect(friendlyInCatch(source, name)).toEqual([])
    })
  }
)
