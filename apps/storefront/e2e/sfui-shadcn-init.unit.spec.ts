import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

import { STOREFRONT } from "./support/sfui-source"

// SFUI-1b (spec 09 กฎ 2, AC-7; ADR-030 ข้อ 2–3): ผลของ `pnpm dlx shadcn@4.23.1 init -b radix`
// — components.json, alias "@/*" ของ tsconfig/vitest และ helper `cn` ที่ `src/lib/utils.ts`

function readJson<T>(file: string): T {
  const text = fs.readFileSync(path.join(STOREFRONT, file), "utf8")
  // tsconfig อาจมี comment/trailing comma → parse ด้วย TypeScript
  const parsed = ts.parseConfigFileTextToJson(file, text)
  if (parsed.error) throw new Error(`${file}: ${ts.flattenDiagnosticMessageText(parsed.error.messageText, "\n")}`)
  return parsed.config as T
}

test("AC-7: components.json มีค่าตามกฎ 2 ทุก field", () => {
  const config = readJson<Record<string, unknown>>("components.json")
  expect(config).toMatchObject({
    style: "new-york",
    rsc: true,
    tsx: true,
    tailwind: {
      config: "",
      css: "src/styles/globals.css",
      baseColor: "neutral",
      cssVariables: true,
      prefix: "",
    },
    iconLibrary: "lucide",
    aliases: {
      components: "@/components",
      ui: "@/components/ui",
      utils: "@/lib/utils",
      lib: "@/lib",
      hooks: "@/hooks",
    },
  })
})

test("AC-7: tsconfig.json มี \"@/*\": [\"*\"] บน baseUrl src และคง alias เดิม", () => {
  const { compilerOptions } = readJson<{ compilerOptions: { baseUrl: string; paths: Record<string, string[]> } }>(
    "tsconfig.json"
  )
  expect(compilerOptions.baseUrl).toBe("./src")
  expect(compilerOptions.paths["@/*"]).toEqual(["*"])
  expect(compilerOptions.paths["@lib/*"]).toEqual(["lib/*"])
  expect(compilerOptions.paths["@modules/*"]).toEqual(["modules/*"])
})

// ADR-030 ข้อ 3 (SFUI-10 กฎ 24 แทนทางเลี่ยงของ SFUI-2): src/lib/utils.ts re-export `cn` ของ package cn ตรงตัว — ไม่ extend
// (ไม่กลับไป clsx + tailwind-merge); รายละเอียดของ AC-24 (c) อยู่ที่ e2e/sfui-10-font-utilities.unit.spec.ts
test("AC-7: src/lib/utils.ts export cn จาก package cn (re-export ตรง)", () => {
  const source = fs.readFileSync(path.join(STOREFRONT, "src", "lib", "utils.ts"), "utf8")
  const file = ts.createSourceFile("utils.ts", source, ts.ScriptTarget.Latest)
  const reExportsCn = file.statements.filter(ts.isExportDeclaration).some(
    (node) =>
      !!node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === "cn" &&
      !!node.exportClause &&
      ts.isNamedExports(node.exportClause) &&
      node.exportClause.elements.some((el) => el.name.text === "cn" && !el.propertyName)
  )
  expect(reExportsCn).toBe(true)
  expect(file.statements).toHaveLength(1)
})

test("AC-7: vitest.config.mts มี alias \"@\" → src และ include ครอบ src/**/*.test.ts + src/**/*.test.tsx", () => {
  // อ่านเป็นข้อความ: config ใช้ __dirname ซึ่ง vitest เติมให้แต่ ESM loader ของ Playwright ไม่มี
  const source = fs.readFileSync(path.join(STOREFRONT, "vitest.config.mts"), "utf8").replace(/\/\/.*$/gm, "")
  expect(source).toMatch(/"@"\s*:\s*path\.resolve\(\s*__dirname\s*,\s*"src"\s*\)/)
  const include = source.match(/include\s*:\s*\[([^\]]*)\]/)
  expect(include, "test.include").not.toBeNull()
  const globs = Array.from(include![1].matchAll(/"([^"]+)"/g), (m) => m[1])
  expect(globs).toEqual(expect.arrayContaining(["src/**/*.test.ts", "src/**/*.test.tsx"]))
})
