import { createRequire } from "node:module"
import postcss from "postcss"
import tailwindcss, { type Config } from "tailwindcss"
import { describe, expect, it } from "vitest"
import tailwindConfig from "../../tailwind.config.js"
import { withThaiUiPreset } from "./thai-ui-preset.js"

// spec 01 "Follow-up จาก review/qa" business rule 14, AC-24 (CORE-8)
// class typography ของ @medusajs/ui-preset fix ฟอนต์ Inter ไว้ → ต้องได้ Noto Sans Thai เป็นตัวแรก
const CLASSES = [
  "txt-compact-small",
  "txt-medium",
  "h1-webs",
  "h2-webs",
  "h2-core",
  "h1-docs",
]

async function compileComponents(html: string): Promise<postcss.Root> {
  const result = await postcss([
    tailwindcss({
      ...(tailwindConfig as unknown as Config),
      content: [{ raw: html }],
    }),
  ]).process("@tailwind components;", { from: undefined })
  return result.root
}

describe("ui-preset typography ใช้ Noto Sans Thai (AC-24)", () => {
  it("ทุก rule ของ class txt-*/h*-webs ที่กำหนด font-family เริ่มด้วย var(--font-noto-sans-thai)", async () => {
    const root = await compileComponents(
      `<div class="${CLASSES.join(" ")}"></div>`
    )
    const fontFamilies: Record<string, string[]> = {}

    root.walkRules((rule) => {
      for (const cls of CLASSES) {
        if (!rule.selectors.includes(`.${cls}`)) continue
        rule.walkDecls("font-family", (decl) => {
          ;(fontFamilies[cls] ??= []).push(decl.value)
        })
      }
    })

    for (const cls of CLASSES) {
      // กันผ่านแบบว่างเปล่า: ทุก class ต้องถูก generate และมี font-family อย่างน้อย 1 rule
      expect(fontFamilies[cls], `.${cls}`).toBeDefined()
      for (const value of fontFamilies[cls]) {
        expect(value, `.${cls}`).toMatch(/^var\(--font-noto-sans-thai\)/)
      }
    }
  })

  it("ไม่แตะ class code-* (monospace)", async () => {
    const root = await compileComponents(`<div class="code-label"></div>`)
    const values: string[] = []
    root.walkDecls("font-family", (decl) => {
      values.push(decl.value)
    })

    expect(values.length).toBeGreaterThan(0)
    for (const value of values) {
      expect(value).toMatch(/^Roboto Mono/)
    }
  })
})

describe("withThaiUiPreset — fail fast เมื่อโครงสร้าง preset เปลี่ยน", () => {
  it("throw เมื่อไม่มี plugin ที่ห่อได้ (plugins ว่าง)", () => {
    expect(() => withThaiUiPreset({ plugins: [] })).toThrow(/ui-preset/)
  })

  it("throw เมื่อ plugin ไม่ใช่รูป { handler } (เช่น plugin แบบ function ล้วน)", () => {
    expect(() => withThaiUiPreset({ plugins: [() => {}] })).toThrow(/ui-preset/)
  })

  it("ห่อ plugin ของ preset จริงได้", () => {
    const preset = withThaiUiPreset(
      // ui-preset ไม่มี type declaration และ export แบบ CommonJS (module.exports = preset)
      createRequire(import.meta.url)("@medusajs/ui-preset")
    )
    expect(preset.plugins.length).toBeGreaterThan(0)
  })
})
