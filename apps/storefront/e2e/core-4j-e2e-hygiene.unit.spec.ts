import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import * as ts from "typescript"

// CORE-4j (spec 01 กฎข้อ 73d, AC-111 grep): `createExpiredPromotion` ลบ campaign เมื่อสร้าง promotion ไม่สำเร็จ
// ต้องตรวจ `.ok()` ของการลบนั้น (cleanup ที่ล้มเงียบทิ้ง campaign ค้าง) — review #170
const source = fs.readFileSync(path.join(__dirname, "core-4g-checkout-polish.spec.ts"), "utf8")

/**
 * CORE-53 (กฎข้อ 111b): หา `function name` ด้วย parser ของ `typescript` (มีใน devDependencies อยู่แล้ว)
 * ไม่ต้องเดาจาก `):` หรือนับวงเล็บเอง — string/comment ไม่ถูกนับเป็นโค้ด
 */
const findFunction = (src: string, name: string) => {
  const file = ts.createSourceFile("fixture.ts", src, ts.ScriptTarget.Latest, true)
  let found: ts.Block | undefined
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.body
    if (!found) ts.forEachChild(node, visit)
  }
  visit(file)
  if (!found) throw new Error(`ไม่พบ function ${name}`)
  return found
}

/** เนื้อหาของ function `name` ตั้งแต่ `{` ถึง `}` ที่ปิด body */
const functionBody = (src: string, name: string) => findFunction(src, name).getText()

/**
 * `request.delete(` ใน function `name` ที่ไม่ได้เก็บผลใน `const x = await request.delete(...)`
 * หรือไม่มีการเรียก `x.ok()` จริงในโค้ด (อ่านจาก AST — `.ok()` ใน comment/string ไม่นับ)
 */
/**
 * call `request.delete(...)` และตัวแปรที่ถูกเรียก `.ok()` ใน function `name` (เดินจาก AST — comment/string ไม่นับ)
 * CORE-59 (กฎข้อ 117b): ใช้ร่วมกันระหว่าง `uncheckedDeletes` และ `deleteCalls`
 */
const deleteAndOkCalls = (src: string, name: string) => {
  const deletes: ts.CallExpression[] = []
  const okCalled = new Set<string>()
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const { expression: target, name: method } = node.expression
      if (method.text === "delete" && target.getText() === "request") deletes.push(node)
      if (method.text === "ok" && ts.isIdentifier(target)) okCalled.add(target.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(findFunction(src, name))
  return { deletes, okCalled }
}

const uncheckedDeletes = (src: string, name: string) => {
  const { deletes, okCalled } = deleteAndOkCalls(src, name)
  return deletes.flatMap((call) => {
    const declaration = ts.isAwaitExpression(call.parent) ? call.parent.parent : undefined
    if (!declaration || !ts.isVariableDeclaration(declaration) || !ts.isIdentifier(declaration.name)) {
      return [`ไม่ได้เก็บผลในตัวแปร: ${call.getText()}`]
    }
    const variable = declaration.name.text
    return okCalled.has(variable) ? [] : [`${variable}.ok() ไม่ถูกตรวจ`]
  })
}

/** CORE-59 (กฎข้อ 117b): จำนวน call `request.delete(` จริงใน function `name` (จาก AST ไม่ใช่ regex บนข้อความ) */
const deleteCalls = (src: string, name: string) => deleteAndOkCalls(src, name).deletes.length

/** CORE-59 (กฎข้อ 117a): ข้อความของ `expect(...)`/`expect.soft(...)` ใน `finally` ของ `try` ทุกตัวใน `src` */
const finallyExpects = (src: string) => {
  const file = ts.createSourceFile("fixture.ts", src, ts.ScriptTarget.Latest, true)
  const calls: string[] = []
  const collect = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText()
      if (callee === "expect" || callee === "expect.soft") calls.push(`${callee}(${node.arguments[0]?.getText()}`)
    }
    ts.forEachChild(node, collect)
  }
  const visit = (node: ts.Node) => {
    if (ts.isTryStatement(node) && node.finallyBlock) collect(node.finallyBlock)
    ts.forEachChild(node, visit)
  }
  visit(file)
  return calls
}

test("AC-111: createExpiredPromotion ตรวจ ok() ของการลบ campaign", () => {
  expect(deleteCalls(source, "createExpiredPromotion"), "createExpiredPromotion ลบ campaign").toBeGreaterThan(0)
  // ทุก `request.delete(` ต้องเก็บผลไว้ในตัวแปรแล้วตรวจ `.ok()` ของตัวแปรนั้น
  expect(uncheckedDeletes(source, "createExpiredPromotion")).toEqual([])
})

test("AC-148 (กฎข้อ 111b): functionBody หา body ได้แม้ function ไม่มี return type และมี `{`/`):` ใน parameter", () => {
  const src = [
    "async function noReturnType(opts: { a: number } = { a: 1 }) {",
    '  const s = "}"',
    "  return opts.a",
    "}",
    "function after(): void {}",
  ].join("\n")
  expect(functionBody(src, "noReturnType")).toBe('{\n  const s = "}"\n  return opts.a\n}')
})

test("AC-148 (กฎข้อ 111b): positive control — .ok() ที่อยู่แค่ใน comment/string ไม่นับว่าตรวจแล้ว", () => {
  const fixture = (okLine: string) =>
    [
      "async function cleanup(request: APIRequestContext) {",
      "  const res = await request.delete(`/x`)",
      okLine,
      "}",
    ].join("\n")
  expect(uncheckedDeletes(fixture("  expect(res.ok()).toBe(true)"), "cleanup")).toEqual([])
  expect(uncheckedDeletes(fixture("  // expect(res.ok()).toBe(true)"), "cleanup")).not.toEqual([])
  expect(uncheckedDeletes(fixture("  /* res.ok() */"), "cleanup")).not.toEqual([])
  expect(uncheckedDeletes(fixture('  console.log("res.ok()")'), "cleanup")).not.toEqual([])
  // ไม่เก็บผลในตัวแปร → ตรวจ ok() ไม่ได้
  expect(uncheckedDeletes("async function f(request: R) {\n  await request.delete(`/x`)\n}", "f")).not.toEqual([])
})

test("AC-158 (กฎข้อ 117b): นับ request.delete( จาก AST — ที่อยู่แค่ใน comment/string ไม่นับ", () => {
  const src = [
    "async function cleanup(request: APIRequestContext) {",
    "  // await request.delete(`/x`)",
    "  /* request.delete( */",
    '  console.log("request.delete(")',
    "}",
  ].join("\n")
  expect(deleteCalls(src, "cleanup")).toBe(0)
  expect(deleteCalls(source, "createExpiredPromotion")).toBeGreaterThanOrEqual(1)
})

test("AC-158 (กฎข้อ 117a): cleanup ใน finally ของ core-4g ใช้ expect.soft — ลบ promotion ล้มแล้วยังลบ campaign ต่อ", () => {
  const calls = finallyExpects(source)
  expect(calls).toContain("expect.soft(promotion.ok()")
  expect(calls).toContain("expect.soft(campaign.ok()")
  expect(calls.filter((call) => call.startsWith("expect("))).toEqual([])
})
