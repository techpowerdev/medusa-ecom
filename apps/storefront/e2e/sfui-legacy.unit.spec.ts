import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

import {
  FORBIDDEN_IMPORT,
  PRESET_RAW_VAR,
  STOREFRONT,
  filesWithForbiddenPattern,
  hasForbiddenPattern,
  legacyClassNames,
  legacyNamesOfClass,
  readSource,
  sourceFiles,
} from "./support/sfui-source"

// SFUI (spec 09 กฎ 15–16, AC-6, AC-16): ชั้น UI เดิม (shim/radio/modal, @medusajs/icons, @headlessui/react, @radix-ui/react-*, clsx,
// class/ตัวแปรของ @medusajs/ui-preset) ถูกย้ายครบแล้ว (SFUI-2..5e) และ SFUI-6 ลบชั้นเข้ากันได้ทิ้ง — ไม่มีไฟล์ใดใน src/** ได้รับยกเว้นอีก
// (ก่อน SFUI-6 ไฟล์นี้มี PENDING แยก key ตาม task เจ้าของไฟล์ — ตามสเปก AC-6 หลัง SFUI-6 เหลือเฉพาะข้อ (a) กับรายการว่าง)
const PENDING: string[] = []

test("AC-6 (a) / AC-16: ไม่มีไฟล์ใดใน src/** ที่มี pattern ต้องห้ามของกฎ 15 (PENDING ว่าง)", () => {
  expect(PENDING).toEqual([])
  const offending = filesWithForbiddenPattern().filter((file) => !PENDING.includes(file))
  expect(offending, "ไฟล์ที่ import ชั้น UI เดิม หรือใช้ class/ตัวแปรของ preset กลับมา").toEqual([])
})

// AC-16: ชั้นเข้ากันได้ชั่วคราวถูกลบและ globals.css ไม่ import กลับมา
test("AC-16: ไม่มี legacy-medusa.css, shim common/components/{ui,radio,modal} และ globals.css ไม่ import legacy", () => {
  for (const removed of [
    "src/styles/legacy-medusa.css",
    "src/modules/common/components/ui",
    "src/modules/common/components/radio",
    "src/modules/common/components/modal",
  ]) {
    expect(fs.existsSync(path.join(STOREFRONT, removed)), removed).toBe(false)
  }
  const globals = readSource("src/styles/globals.css")
  expect(globals).not.toMatch(/legacy-medusa/)
  // ไม่มี @theme/สีของ preset กลับมาใน CSS (--color-ui-*, --shadow-borders-* ฯลฯ, ring สีน้ำเงินของ v3)
  expect(globals).not.toMatch(/--color-ui-|--shadow-(?:borders|elevation|buttons|details)-|--default-ring-color/)
})

// positive/negative control ของตัวจับ pattern
test("AC-6: ตัวจับ class ของ preset แยก variant/important/opacity และไม่นับ class ของ Tailwind ปกติ", () => {
  expect(legacyNamesOfClass("hover:text-ui-fg-base")).toEqual(["text-ui-fg-base"])
  expect(legacyNamesOfClass("group-disabled:!shadow-borders-base")).toEqual(["shadow-borders-base"])
  expect(legacyNamesOfClass("small:txt-compact-xlarge-plus")).toEqual(["txt-compact-xlarge-plus"])
  expect(legacyNamesOfClass("bg-ui-bg-base/50")).toEqual(["bg-ui-bg-base"])
  expect(legacyNamesOfClass("group-radix-state-open:rotate-180")).toEqual(["group-radix-state-open"])
  expect(legacyNamesOfClass("data-[state=open]:h1-webs")).toEqual(["h1-webs"])
  for (const plain of ["text-small-regular", "text-gray-700", "shadow-sm", "bg-white", "rounded-rounded", "h-1"]) {
    expect(legacyNamesOfClass(plain), plain).toEqual([])
  }
  expect(legacyClassNames("x.tsx", '// txt-medium ใน comment\nconst a = <p className="txt-medium" />')).toEqual([
    "txt-medium",
  ])
  expect(legacyClassNames("x.tsx", "// txt-medium ใน comment เท่านั้น")).toEqual([])
  expect(FORBIDDEN_IMPORT.test('vi.mock("@headlessui/react", () => ({}))')).toBe(true)
  expect(FORBIDDEN_IMPORT.test('import { X } from "@modules/common/components/ui"')).toBe(true)
  expect(FORBIDDEN_IMPORT.test('import X from "@modules/common/components/modal/index"')).toBe(true)
  expect(FORBIDDEN_IMPORT.test('import { cn } from "@/lib/utils"')).toBe(false)
})

// กฎ 15 (แก้ใน spec 09): ตัวแปรดิบของ preset `var(--fg-*|--bg-*|--border-*)` นับเป็น pattern ต้องห้าม
// — ไม่งั้นเอาไฟล์ออกจาก PENDING ได้ทั้งที่ยังอ้างตัวแปร แล้ว SFUI-6 ลบ legacy CSS ทำให้สี (เช่น ลูกศร InteractiveLink) หายเงียบ
test("AC-6: ตัวแปรดิบของ preset var(--fg-*/--bg-*/--border-*) ในไฟล์ที่ไม่ใช่ test นับเป็น pattern ต้องห้าม", () => {
  expect(hasForbiddenPattern("x.tsx", '<ArrowUpRight color="var(--fg-interactive)" />')).toBe(true)
  expect(hasForbiddenPattern("x.tsx", 'const s = { color: "var(--bg-subtle)", borderColor: "var(--border-base)" }')).toBe(true)
  expect(hasForbiddenPattern("x.tsx", 'const f = "var(--font-noto-sans-thai)"')).toBe(false)
  expect(hasForbiddenPattern("x.tsx", 'const c = "var(--color-ui-fg-base)"')).toBe(false)
  expect(hasForbiddenPattern("x.test.ts", 'const c = "var(--fg-muted)"')).toBe(false)
  expect(PRESET_RAW_VAR.test("var(--fg-muted)")).toBe(true)
})

test("AC-6: ไฟล์ที่อ้าง var(--fg-*) อยู่ใน PENDING ของ task เจ้าของไฟล์ (หรือย้ายเสร็จแล้ว — ไม่มี pattern)", () => {
  // SFUI-5a ย้ายเสร็จ: not-found/InteractiveLink ใช้ token ของ shadcn แทน var(--fg-interactive)
  // SFUI-5c ย้ายเสร็จ: discount-code ใช้ token ของ shadcn แทน var(--fg-muted)
  for (const file of [
    "src/app/not-found.tsx",
    "src/modules/common/components/interactive-link/index.tsx",
    "src/modules/checkout/components/discount-code/index.tsx",
  ]) {
    expect(hasForbiddenPattern(file, readSource(file)), file).toBe(false)
  }
})

// ย้ายจาก e2e/sfui-legacy-css.unit.spec.ts (ลบใน SFUI-6): ตัวแปร CSS ที่ src/** อ้างตรงต้องมีนิยาม — ไม่งั้นค่าเป็น invalid เงียบๆ
// ตัวแปรที่ไม่ต้องนิยามเอง: ของ Tailwind (namespace ของ theme + `--tw-*`), next/font, Radix
const EXTERNAL_VAR =
  /^(tw-|radix-|font-noto-sans-thai$|(color|spacing|text|font|font-weight|tracking|leading|breakpoint|container|radius|shadow|inset-shadow|drop-shadow|blur|perspective|aspect|ease|animate|default)-)/

test("AC-16: ทุก var(--…) ที่ src/** อ้างตรงมีนิยามใน src/styles/*.css (ยกเว้นของ Tailwind/next/font/Radix)", () => {
  const css = fs
    .readdirSync(path.join(STOREFRONT, "src", "styles"))
    .filter((name) => name.endsWith(".css"))
    .map((name) => readSource(`src/styles/${name}`))
    .join("\n")
  const declared = new Set(Array.from(css.matchAll(/--([\w-]+)\s*:/g), (m) => m[1]))
  const missing = sourceFiles().flatMap((file) =>
    Array.from(readSource(file).matchAll(/var\(--([\w-]+)/g), (m) => m[1])
      .filter((name) => !EXTERNAL_VAR.test(name) && !declared.has(name))
      .map((name) => `--${name} (${file})`)
  )
  expect(missing, "ตัวแปร CSS ที่ไม่มีนิยาม").toEqual([])
})
