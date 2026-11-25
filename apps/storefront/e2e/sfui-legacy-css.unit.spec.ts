import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

import { SRC, legacyClassNames, readSource, sourceFiles } from "./support/sfui-source"

// SFUI (spec 09 กฎ 16, AC-2): class ของ @medusajs/ui-preset ที่ยังใช้ใน src/** ต้องมีนิยามในชั้นเข้ากันได้ชั่วคราว
// src/styles/legacy-medusa.css (ไม่งั้นหน้าเว็บไม่มีสไตล์เงียบๆ หลังอัป Tailwind v4) และไฟล์นั้นไม่มีชื่อที่ไม่ถูกใช้ (ลบทั้งไฟล์ใน SFUI-6)
const LEGACY_CSS = path.join(SRC, "styles", "legacy-medusa.css")

// ชื่อที่โค้ดเดิมใช้แต่ @medusajs/ui-preset@2.22.1 ไม่เคยมีสไตล์ (พิมพ์ผิดตั้งแต่ก่อน SFUI — v3 ก็ไม่ generate อะไร)
// ไม่สร้างนิยามให้ เพื่อไม่ให้หน้าตาเปลี่ยน; task เจ้าของไฟล์ (5x) ลบ class เหล่านี้ตอนย้าย
const NO_STYLE_IN_PRESET = [
  "txt-compact-plus",
  "txt-ui-fg-base",
  "text-ui-fg-medium-plus",
  "shadow-borders-interactive",
  "shadow-borders-strong-with-shadow",
]

type Definitions = { utilities: Set<string>; colors: Set<string>; shadows: Set<string>; variants: Set<string> }

function definitions(css: string): Definitions {
  const all = (re: RegExp) => new Set(Array.from(css.matchAll(re), (m) => m[1]))
  return {
    utilities: all(/@utility\s+([\w-]+)\s*\{/g),
    colors: all(/--color-(ui-[\w-]+)\s*:/g),
    shadows: all(/--shadow-([\w-]+)\s*:/g),
    variants: all(/@custom-variant\s+([\w-]+)/g),
  }
}

/** class ของ preset → ชื่อที่ต้องมีนิยาม (ชนิด + ชื่อ) */
function requiredDefinition(name: string): [keyof Definitions, string] {
  if (/radix-state-/.test(name)) return ["variants", name]
  if (/^shadow-/.test(name)) return ["shadows", name.replace(/^shadow-/, "")]
  const color = name.match(/^[a-z]+-(ui-[\w-]+)$/)
  if (color) return ["colors", color[1]]
  return ["utilities", name]
}

const used = new Set(sourceFiles().flatMap((file) => legacyClassNames(file, readSource(file))))

test("AC-2: มีไฟล์ legacy-medusa.css และ globals.css import ไฟล์นี้", () => {
  expect(fs.existsSync(LEGACY_CSS)).toBe(true)
  expect(fs.readFileSync(path.join(SRC, "styles", "globals.css"), "utf8")).toContain(
    '@import "./legacy-medusa.css";'
  )
})

test("AC-2: ทุก class ของ preset ที่ใช้ใน src/** มีนิยามใน legacy-medusa.css", () => {
  expect(used.size, "กันผ่านแบบว่างเปล่า").toBeGreaterThan(20)
  const defs = definitions(fs.readFileSync(LEGACY_CSS, "utf8"))
  const undefinedNames = Array.from(used)
    .filter((name) => !NO_STYLE_IN_PRESET.includes(name))
    .filter((name) => {
      const [kind, key] = requiredDefinition(name)
      return !defs[kind].has(key)
    })
  expect(undefinedNames, "class ของ preset ที่ไม่มีสไตล์").toEqual([])
})

test("AC-2: legacy-medusa.css ไม่มีชื่อที่ไม่ถูกใช้ใน src/**", () => {
  const defs = definitions(fs.readFileSync(LEGACY_CSS, "utf8"))
  const needed = { utilities: new Set<string>(), colors: new Set<string>(), shadows: new Set<string>(), variants: new Set<string>() }
  for (const name of Array.from(used)) {
    const [kind, key] = requiredDefinition(name)
    needed[kind].add(key)
  }
  const unused = (Object.keys(defs) as (keyof Definitions)[]).flatMap((kind) =>
    Array.from(defs[kind]).filter((key) => !needed[kind].has(key)).map((key) => `${kind}:${key}`)
  )
  expect(unused, "นิยามที่ไม่มีผู้ใช้").toEqual([])
})

test("AC-2: ชื่อใน NO_STYLE_IN_PRESET ยังถูกใช้จริง (ลบออกเมื่อ task เจ้าของไฟล์ย้ายเสร็จ)", () => {
  for (const name of NO_STYLE_IN_PRESET) expect(Array.from(used), name).toContain(name)
})

test("AC-2: map class → นิยามที่ต้องมี", () => {
  expect(requiredDefinition("txt-compact-small")).toEqual(["utilities", "txt-compact-small"])
  expect(requiredDefinition("h1-webs")).toEqual(["utilities", "h1-webs"])
  expect(requiredDefinition("border-ui-border-base")).toEqual(["colors", "ui-border-base"])
  expect(requiredDefinition("accent-ui-fg-interactive")).toEqual(["colors", "ui-fg-interactive"])
  expect(requiredDefinition("shadow-borders-base")).toEqual(["shadows", "borders-base"])
  expect(requiredDefinition("group-radix-state-open")).toEqual(["variants", "group-radix-state-open"])
})

// review SFUI-1a: preset ใส่ตัวแปรดิบ (`--fg-*`, `--bg-*` ฯลฯ) ใน :root ด้วย — โค้ดที่อ้าง `var(--…)` ตรง (เช่น prop `color` ของ icon)
// ต้องยังมีนิยาม ไม่งั้นค่าเป็น invalid เงียบๆ (stroke ของลูกศร InteractiveLink หาย)
// ตัวแปรที่ไม่ต้องนิยามเอง: ของ Tailwind (namespace ของ theme + `--tw-*`), next/font, Radix, token ของ shadcn (SFUI-1b ขึ้นไปนิยามใน globals.css)
const EXTERNAL_VAR =
  /^(tw-|radix-|font-noto-sans-thai$|(color|spacing|text|font|font-weight|tracking|leading|breakpoint|container|radius|shadow|inset-shadow|drop-shadow|blur|perspective|aspect|ease|animate|default)-)/

/** ชื่อตัวแปร CSS ทุกตัวที่ `src/**` (ไม่ใช่ test) อ้างด้วย `var(--…)` → ไฟล์ที่อ้าง */
function referencedVars(): Map<string, string[]> {
  const refs = new Map<string, string[]>()
  for (const file of sourceFiles()) {
    for (const m of Array.from(readSource(file).matchAll(/var\(--([\w-]+)/g))) {
      refs.set(m[1], [...(refs.get(m[1]) ?? []), file])
    }
  }
  return refs
}

/** ตัวแปรที่ประกาศ (`--x:`) ใน src/styles/*.css */
function declaredVars(): Set<string> {
  const css = fs
    .readdirSync(path.join(SRC, "styles"))
    .filter((name) => name.endsWith(".css"))
    .map((name) => fs.readFileSync(path.join(SRC, "styles", name), "utf8"))
    .join("\n")
  return new Set(Array.from(css.matchAll(/(--[\w-]+)\s*:/g), (m) => m[1].slice(2)))
}

test("AC-2: ทุก var(--…) ที่ src/** อ้างตรงมีนิยามใน src/styles/*.css (ยกเว้นของ Tailwind/next/font/Radix)", () => {
  const declared = declaredVars()
  const missing = Array.from(referencedVars().entries())
    .filter(([name]) => !EXTERNAL_VAR.test(name) && !declared.has(name))
    .map(([name, files]) => `--${name} (${files.join(", ")})`)
  expect(missing, "ตัวแปร CSS ที่ไม่มีนิยาม").toEqual([])
})

test("AC-2: ตัวแปรดิบใน :root ของ legacy-medusa.css ถูกอ้างจริงทุกตัว (ไม่มีชื่อที่ไม่ถูกใช้)", () => {
  const css = fs.readFileSync(LEGACY_CSS, "utf8")
  const root = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? ""
  const refs = referencedVars()
  const unused = Array.from(root.matchAll(/--([\w-]+)\s*:/g), (m) => m[1]).filter((name) => !refs.has(name))
  expect(unused).toEqual([])
})
