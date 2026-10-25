import postcss from "postcss"
import tailwindcss, { type Config } from "tailwindcss"
import { describe, expect, it } from "vitest"
import tailwindConfig from "../../tailwind.config.js"

// spec 01 "Follow-up จาก review/qa" business rule 14, AC-24 (CORE-8)
// class typography ของ @medusajs/ui-preset fix ฟอนต์ Inter ไว้ → ต้องได้ Noto Sans Thai เป็นตัวแรก
const CLASSES = ["txt-compact-small", "txt-medium", "h1-webs", "h2-webs"]

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
