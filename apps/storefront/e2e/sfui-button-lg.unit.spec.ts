import { expect, test } from "@playwright/test"
import ts from "typescript"

import { readSource, sourceFiles } from "./support/sfui-source"

// D-1 (qa SFUI, spec 09 กฎ 19/20): `size="large"` ของ shim เดิมสูง 48px แต่ `lg` ของ shadcn สูง 40px — ปุ่มที่เตี้ยลงทำให้คลิก
// `submit-payment-button` หลังกรอกบัตรตกใน iframe ของ Stripe; ปุ่ม/ลิงก์ที่ย้ายจาก `large` ไปใช้ shadcn ตรงด้วย `lg`
// ต้องใส่ `h-12` คงความสูงเดิม (ยกเว้นไฟล์ของ shadcn CLI ใน src/components/ui)
const H12 = /(?:^|[\s"'`])h-12(?=$|[\s"'`])/

/** บรรทัดที่ใช้ size "lg" ของ Button/buttonVariants โดยไม่มี h-12 ในตำแหน่งเดียวกัน */
function lgWithoutH12(file: string, source: string): number[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const lines: number[] = []
  const report = (node: ts.Node, scope: ts.Node) => {
    if (!H12.test(scope.getText(sf))) {
      lines.push(sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1)
    }
  }
  const visit = (node: ts.Node) => {
    // <Button size="lg" className="h-12 ..."> — h-12 ต้องอยู่ใน element เดียวกัน
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(sf) === "size" &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      node.initializer.text === "lg"
    ) {
      report(node, node.parent.parent)
    }
    // buttonVariants({ size: "lg" }) — h-12 อยู่ใน call เอง (className) หรือใน cn(...) ที่ครอบ
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(sf) === "size" &&
      ts.isStringLiteral(node.initializer) &&
      node.initializer.text === "lg" &&
      ts.isObjectLiteralExpression(node.parent) &&
      ts.isCallExpression(node.parent.parent) &&
      node.parent.parent.expression.getText(sf) === "buttonVariants"
    ) {
      const call = node.parent.parent
      report(node, ts.isCallExpression(call.parent) ? call.parent : call)
    }
    node.forEachChild(visit)
  }
  visit(sf)
  return lines
}

test("D-1: ตัวตรวจจับ size lg ที่ไม่มี h-12 (positive/negative control)", () => {
  const bad = [
    'const a = <Button size="lg">x</Button>',
    'const b = <a className={cn(buttonVariants({ size: "lg" }), "w-full")} />',
    'const c = <Button size="lg" className="h-120">x</Button>',
  ].join("\n")
  expect(lgWithoutH12("bad.tsx", bad)).toEqual([1, 2, 3])
  const good = [
    'const a = <Button size="lg" className="h-12">x</Button>',
    'const b = <a className={cn(buttonVariants({ size: "lg" }), "h-12 w-full")} />',
    'const c = <a className={buttonVariants({ size: "lg", className: "w-full h-12" })} />',
    'const d = <Button size="sm">x</Button>',
  ].join("\n")
  expect(lgWithoutH12("good.tsx", good)).toEqual([])
})

test("D-1: ปุ่ม size lg ใน src/** (นอก components/ui ของ shadcn) คงความสูง h-12 ของ large เดิม", () => {
  const offenders = sourceFiles()
    .filter((file) => !file.startsWith("src/components/ui/"))
    .flatMap((file) => lgWithoutH12(file, readSource(file)).map((line) => `${file}:${line}`))
  expect(offenders, "ปุ่ม lg ที่ไม่มี h-12").toEqual([])
})
