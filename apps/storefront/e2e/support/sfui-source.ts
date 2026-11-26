import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

// SFUI (spec 09): ตัวอ่าน source ของ storefront ที่ static spec ของ SFUI ใช้ร่วมกัน
// (sfui-baseline / sfui-legacy / sfui-legacy-css) — parse ด้วย TypeScript จึงไม่นับ comment

export const STOREFRONT = path.resolve(__dirname, "..", "..")
export const SRC = path.join(STOREFRONT, "src")

export const THAI = /[฀-๿]/

/** ไฟล์ `.ts`/`.tsx` ใต้ `src/` ที่ไม่ใช่ test (path สัมพัทธ์กับ apps/storefront ใช้ `/`) */
export function sourceFiles(dir: string = SRC): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return sourceFiles(full)
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
        ? [path.relative(STOREFRONT, full).split(path.sep).join("/")]
        : []
    })
    .sort()
}

export function readSource(file: string): string {
  return fs.readFileSync(path.join(STOREFRONT, file), "utf8")
}

/** ลบช่องว่างทั้งหมด (เทียบข้อความโดยไม่สนการตัดบรรทัด/เว้นวรรค) */
export const squash = (text: string) => text.replace(/\s+/g, "")

const collapse = (text: string) => text.replace(/\s+/g, " ").trim()

function parse(file: string, source: string) {
  return ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
}

/** ข้อความของ literal ตามตัวอักษร (template literal เก็บ `${…}` ตามที่เขียน) */
function literalText(node: ts.Node, sf: ts.SourceFile): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }
  if (ts.isTemplateExpression(node)) return node.getText(sf).slice(1, -1)
  return null
}

/** ทุก literal ภายใน node (รวม ternary/`||` ของค่า testid) */
function literalsIn(node: ts.Node, sf: ts.SourceFile): string[] {
  const own = literalText(node, sf)
  if (own !== null) return [own]
  const found: string[] = []
  node.forEachChild((child) => {
    found.push(...literalsIn(child, sf))
  })
  return found
}

const isTestIdName = (name: ts.Node) =>
  (ts.isIdentifier(name) || ts.isStringLiteral(name)) &&
  name.text === "data-testid"

/** AC-5: ค่าสตริงทั้งหมดของ `data-testid=` (JSX) และ `"data-testid":` (object) */
export function extractTestIds(file: string, source: string): string[] {
  const sf = parse(file, source)
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === "data-testid") {
      if (node.initializer) found.push(...literalsIn(node.initializer, sf))
    } else if (ts.isPropertyAssignment(node) && isTestIdName(node.name)) {
      found.push(...literalsIn(node.initializer, sf))
    }
    node.forEachChild(visit)
  }
  visit(sf)
  return found.filter((value) => value.trim() !== "")
}

/** AC-5: ข้อความที่มีอักษรไทยในสตริง (`"…"`, `'…'`, `` `…` ``) และข้อความ JSX (`>…<`) — ไม่รวม comment */
export function extractThai(file: string, source: string): string[] {
  const sf = parse(file, source)
  const found: string[] = []
  const visit = (node: ts.Node) => {
    const text = ts.isJsxText(node) ? node.text : literalText(node, sf)
    if (text !== null && THAI.test(text)) {
      found.push(collapse(text))
      return
    }
    node.forEachChild(visit)
  }
  visit(sf)
  return found
}

export type Baseline = { testids: string[]; thai: string[] }

export function collectBaseline(files: string[] = sourceFiles()): Baseline {
  const testids = new Set<string>()
  const thai = new Set<string>()
  for (const file of files) {
    const source = readSource(file)
    extractTestIds(file, source).forEach((v) => testids.add(v))
    extractThai(file, source).forEach((v) => thai.add(v))
  }
  return { testids: Array.from(testids).sort(), thai: Array.from(thai).sort() }
}

// ---- กฎ 15: pattern ต้องห้าม (ใช้ทั้ง AC-2 และ AC-6) ----

/** import/`vi.mock` ของ package/ชั้นที่ถูกแทน (ตรวจทั้งไฟล์ test และไม่ใช่ test) */
export const FORBIDDEN_IMPORT =
  /["'](@medusajs\/icons|@medusajs\/ui-preset|@headlessui\/react|@radix-ui\/react-[\w-]+|tailwindcss-radix|clsx|@modules\/common\/components\/(?:ui|radio|modal))(?:\/[^"']*)?["']/

/**
 * utility ของ preset (กฎ 15) — ตรวจเฉพาะไฟล์ที่ไม่ใช่ test
 * SFUI-1a: เพิ่ม `accent-` ในกลุ่มสี (`accent-ui-fg-interactive` ใช้สี `ui-*` เหมือนกัน — ไม่งั้นหลุดเงียบตอนลบชั้นเข้ากันได้ใน SFUI-6)
 */
const LEGACY_UTILITY =
  /^(txt-[\w-]+|h[1-3]-(?:webs|core|docs)|(?:text|bg|border|ring|divide|fill|stroke|placeholder|outline|accent)-ui-[\w-]+|shadow-(?:borders|elevation|buttons|details)-[\w-]+)$/
const LEGACY_VARIANT = /^(?:group-|peer-)?radix-state-[\w-]+$/

/** แยก class เป็น variant + utility (`:` ภายใน `[...]` ไม่นับ) แล้วตัด `!`, `/opacity` */
function splitClass(token: string): { variants: string[]; utility: string } {
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
  const utility = current.replace(/^!|!$/g, "").replace(/\/[\w.[\]]+$/, "")
  return { variants: parts, utility }
}

/** ชื่อ utility/variant ของ preset ที่ class หนึ่งตัวใช้ */
export function legacyNamesOfClass(token: string): string[] {
  const { variants, utility } = splitClass(token)
  return [
    ...variants.filter((v) => LEGACY_VARIANT.test(v)),
    ...(LEGACY_UTILITY.test(utility) ? [utility] : []),
  ]
}

/** ทุกข้อความใน literal (สตริง/template) ของไฟล์ — class อยู่ในนี้ (ไม่รวม comment) */
function literalChunks(file: string, source: string): string[] {
  const sf = parse(file, source)
  const chunks: string[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      chunks.push(node.text)
    }
    node.forEachChild(visit)
  }
  visit(sf)
  return chunks
}

/** ชื่อ class/variant ของ preset ทั้งหมดในไฟล์ (ไม่ซ้ำ) */
export function legacyClassNames(file: string, source: string): string[] {
  const names = new Set<string>()
  for (const chunk of literalChunks(file, source)) {
    for (const token of chunk.split(/\s+/)) {
      legacyNamesOfClass(token).forEach((n) => names.add(n))
    }
  }
  return Array.from(names).sort()
}

export const isTestFile = (file: string) => /\.test\.tsx?$/.test(file)

/** ตัวแปรดิบของ preset (`:root` จาก addBase — ชั้นเข้ากันได้คืนให้ใน legacy-medusa.css) ที่โค้ดอ้างตรง */
export const PRESET_RAW_VAR = /var\(--(?:fg|bg|border)-[\w-]+/

/** กฎ 15: import ต้องห้าม (ทุกไฟล์) หรือ class/ตัวแปรดิบของ preset (เฉพาะไฟล์ที่ไม่ใช่ test) */
export function hasForbiddenPattern(file: string, source: string): boolean {
  if (FORBIDDEN_IMPORT.test(source)) return true
  if (isTestFile(file)) return false
  return PRESET_RAW_VAR.test(source) || legacyClassNames(file, source).length > 0
}

/** ไฟล์ `src/**` (รวม test) ที่มี pattern ต้องห้ามของกฎ 15 */
export function filesWithForbiddenPattern(): string[] {
  return [...sourceFiles(), ...allTestFiles()]
    .sort()
    .filter((file) => hasForbiddenPattern(file, readSource(file)))
}

function allTestFiles(dir: string = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return allTestFiles(full)
    return /\.test\.tsx?$/.test(entry.name)
      ? [path.relative(STOREFRONT, full).split(path.sep).join("/")]
      : []
  })
}
