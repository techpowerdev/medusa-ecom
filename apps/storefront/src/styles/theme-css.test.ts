import fs from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/postcss"
import postcss from "postcss"
import { describe, expect, it } from "vitest"

// SFUI-1a (spec 09 กฎ 1, 7, 8, 16; AC-3/AC-4 ส่วน CSS) — แทน tailwind-config.test.ts (spec 01 AC-9) และ
// ui-preset-font.test.ts (spec 01 AC-24) ที่ผูกกับ tailwind.config.js + @medusajs/ui-preset ของ Tailwind v3
const STYLES = __dirname
const GLOBALS = path.join(STYLES, "globals.css")
const globals = fs.readFileSync(GLOBALS, "utf8")

/** ค่าของ custom property ตัวแรกที่ชื่อตรง (ใน @theme/:root) */
function cssVar(css: string, name: string): string | undefined {
  const match = css.match(new RegExp(`${name.replace(/[-]/g, "\\-")}\\s*:\\s*([^;]+);`))
  return match?.[1].trim()
}

/** compile globals.css จริงด้วย @tailwindcss/postcss โดย generate เฉพาะ class ที่ส่งมา (ไม่สแกนไฟล์ในโปรเจกต์) */
async function compile(classes: string[]): Promise<postcss.Root> {
  const input =
    globals.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);') +
    `\n@source inline(${JSON.stringify(classes.join(" "))});\n`
  const result = await postcss([tailwindcss()]).process(input, { from: GLOBALS })
  return result.root
}

/** declaration ของ rule ที่ selector ตรงตัว (รวม rule ที่ซ้อนใน @layer/@media) */
function declsOf(root: postcss.Root, selector: string): Record<string, string> {
  const decls: Record<string, string> = {}
  root.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return
    rule.walkDecls((decl) => {
      decls[decl.prop] = decl.value
    })
  })
  return decls
}

const BRAND: Record<string, string> = {
  "--color-brand": "#525252",
  "--color-brand-50": "#FAFAFA",
  "--color-brand-100": "#F5F5F5",
  "--color-brand-200": "#E5E5E5",
  "--color-brand-300": "#D4D4D4",
  "--color-brand-400": "#A3A3A3",
  "--color-brand-500": "#737373",
  "--color-brand-600": "#525252",
  "--color-brand-700": "#404040",
  "--color-brand-800": "#262626",
  "--color-brand-900": "#171717",
}

const GREY: Record<string, string> = {
  "--color-grey-0": "#FFFFFF",
  "--color-grey-5": "#F9FAFB",
  "--color-grey-10": "#F3F4F6",
  "--color-grey-20": "#E5E7EB",
  "--color-grey-30": "#D1D5DB",
  "--color-grey-40": "#9CA3AF",
  "--color-grey-50": "#6B7280",
  "--color-grey-60": "#4B5563",
  "--color-grey-70": "#374151",
  "--color-grey-80": "#1F2937",
  "--color-grey-90": "#111827",
}

describe("globals.css — brand / grey tokens (AC-4 ขั้น 1a, กฎ 7)", () => {
  it("มี --color-brand และ --color-brand-50..900 ค่า hex เดิมทุกตัว", () => {
    for (const [name, value] of Object.entries(BRAND)) {
      expect(cssVar(globals, name), name).toBe(value)
    }
  })

  it("มี --color-grey-0..90 ค่าเดิม", () => {
    for (const [name, value] of Object.entries(GREY)) {
      expect(cssVar(globals, name), name).toBe(value)
    }
  })

  it("ไม่มี selector .dark (ไม่มี dark mode)", () => {
    expect(globals).not.toMatch(/\.dark\b/)
  })

  it("class ของ brand ใช้ได้จริงหลัง compile (bg-brand-900 → --color-brand-900)", async () => {
    const root = await compile(["bg-brand-900", "text-brand"])
    expect(declsOf(root, ".bg-brand-900")["background-color"]).toBe("var(--color-brand-900)")
    expect(declsOf(root, ".text-brand").color).toBe("var(--color-brand)")
  })
})

describe("globals.css — ฟอนต์ (AC-3 ส่วน CSS, กฎ 8)", () => {
  it("--font-sans ค่าตัวแรกคือ var(--font-noto-sans-thai)", () => {
    const value = cssVar(globals, "--font-sans")
    expect(value).toBeDefined()
    expect(value!.split(",")[0].trim()).toBe("var(--font-noto-sans-thai)")
  })

  it("body ใช้ font-sans (@theme inline → ค่าของ --font-sans ที่ขึ้นต้นด้วย Noto Sans Thai)", async () => {
    const root = await compile([])
    expect(declsOf(root, "body")["font-family"]).toBe(cssVar(globals, "--font-sans"))
  })

  it("class typography ของ preset (txt-*) ใช้ var(--font-sans) — ไม่ fix Inter", async () => {
    const root = await compile(["txt-medium", "txt-compact-small-plus"])
    for (const cls of [".txt-medium", ".txt-compact-small-plus"]) {
      expect(declsOf(root, cls)["font-family"], cls).toBe("var(--font-sans)")
    }
  })
})

describe("globals.css — Tailwind v4 CSS-first คงค่า theme เดิม (กฎ 1)", () => {
  it("ขึ้นต้นด้วย @import \"tailwindcss\" และ import ชั้นเข้ากันได้ legacy-medusa.css", () => {
    expect(globals.replace(/\/\*[\s\S]*?\*\//g, "").trim().startsWith('@import "tailwindcss";')).toBe(true)
    expect(globals).toContain('@import "./legacy-medusa.css";')
  })

  it("breakpoint, radius, max-w-8xl, text-3xl, animation เดิม generate ได้", async () => {
    const root = await compile([
      "small:hidden",
      "2xsmall:hidden",
      "max-small:hidden",
      "rounded-rounded",
      "rounded-soft",
      "rounded-circle",
      "max-w-8xl",
      "text-3xl",
      "animate-fade-in-top",
      "animate-accordion-open",
    ])
    const css = root.toString()
    expect(css).toMatch(/@media \(width >= 1024px\)/)
    expect(css).toMatch(/@media \(width >= 320px\)/)
    expect(css).toMatch(/@media \(width < 1024px\)/)
    expect(declsOf(root, ".rounded-rounded")["border-radius"]).toBe("var(--radius-rounded)")
    expect(cssVar(globals, "--radius-rounded")).toBe("8px")
    expect(declsOf(root, ".rounded-soft")["border-radius"]).toBe("var(--radius-soft)")
    expect(declsOf(root, ".rounded-circle")["border-radius"]).toBe("var(--radius-circle)")
    expect(declsOf(root, ".max-w-8xl")["max-width"]).toBe("var(--container-8xl)")
    expect(cssVar(globals, "--container-8xl")).toBe("100rem")
    expect(declsOf(root, ".text-3xl")["font-size"]).toBe("var(--text-3xl)")
    // v3 ตั้ง "2rem" อย่างเดียว → ไม่มี line-height (สืบทอดจาก parent เหมือนเดิม)
    expect(declsOf(root, ".text-3xl")["line-height"]).toBeUndefined()
    expect(cssVar(globals, "--text-3xl")).toBe("2rem")
    expect(declsOf(root, ".animate-fade-in-top").animation).toBe("var(--animate-fade-in-top)")
    expect(css).toMatch(/@keyframes fade-in-top/)
    expect(declsOf(root, ".animate-accordion-open").animation).toBe("var(--animate-accordion-open)")
  })

  it("class ใน globals.css เดิม (text-*-regular/semi, content-container, no-scrollbar) ยังใช้ได้เป็น utility", async () => {
    const root = await compile(["text-small-regular", "text-3xl-semi", "content-container", "no-scrollbar"])
    expect(declsOf(root, ".text-small-regular")["font-size"]).toBeDefined()
    expect(declsOf(root, ".text-3xl-semi")["font-weight"]).toBeDefined()
    expect(declsOf(root, ".content-container")["max-width"]).toBe("1440px")
    expect(declsOf(root, ".no-scrollbar")["scrollbar-width"]).toBe("none")
  })
})

describe("legacy-medusa.css — ชั้นเข้ากันได้ของ preset (กฎ 16)", () => {
  it("สี/เงา ui-* และ variant radix-state-* generate ได้", async () => {
    const root = await compile([
      "text-ui-fg-subtle",
      "border-ui-border-base",
      "shadow-borders-base",
      "radix-state-open:hidden",
      "group-radix-state-open:hidden",
    ])
    const css = root.toString()
    expect(declsOf(root, ".text-ui-fg-subtle").color).toBe("var(--color-ui-fg-subtle)")
    expect(declsOf(root, ".border-ui-border-base")["border-color"]).toBe("var(--color-ui-border-base)")
    expect(declsOf(root, ".shadow-borders-base")["--tw-shadow"]).toBeDefined()
    expect(css).toMatch(/\[data-state="open"\]/)
    expect(css).toMatch(/\.group\[data-state="open"\]|:where\(\.group\)\[data-state="open"\]|\.group\)\[data-state="open"\]/)
  })

  it("ring ที่ไม่ระบุสีเป็น blue-500/50 แบบ v3 และตัวแปรดิบ --fg-* ของ preset อยู่ใน :root", async () => {
    const root = await compile(["ring-2"])
    expect(declsOf(root, ".ring-2")["--tw-ring-shadow"]).toContain("rgb(59 130 246 / 0.5)")
    const rootDecls = declsOf(root, ":root")
    // SFUI-5a: --fg-interactive ไม่มีผู้ใช้แล้ว (not-found/InteractiveLink ใช้ token ของ shadcn) — ลบตาม AC-2
    expect(rootDecls["--fg-interactive"]).toBeUndefined()
    expect(rootDecls["--fg-muted"]).toBe("rgba(113, 113, 122, 1)")
  })

  it("ขอบเริ่มต้นเป็นสี --color-ui-border-base แบบ preset เดิม (v4 เริ่มต้นเป็น currentColor)", async () => {
    const root = await compile([])
    let found = false
    root.walkRules((rule) => {
      if (rule.selector.includes("*") && rule.nodes.some((n) => n.type === "decl" && n.prop === "border-color" && n.value === "var(--color-ui-border-base)")) {
        found = true
      }
    })
    expect(found).toBe(true)
  })
})

/** declaration ของ selector `:root` ที่เขียนไว้ใน globals.css เอง (ไม่รวม :root ที่ @theme generate) */
function rootDeclsInSource(css: string): Record<string, string> {
  const decls: Record<string, string> = {}
  postcss.parse(css).walkRules((rule) => {
    if (rule.selector !== ":root") return
    rule.walkDecls((decl) => {
      decls[decl.prop] = decl.value
    })
  })
  return decls
}

describe("globals.css — token ของ shadcn (AC-4 ขั้น 1b, กฎ 7; ADR-030 ข้อ 7)", () => {
  const root = rootDeclsInSource(globals)

  it("import tw-animate-css (แทน tailwindcss-animate)", () => {
    expect(globals).toContain('@import "tw-animate-css";')
  })

  it(":root ชี้ --primary / --primary-foreground / --ring ไปที่ brand", () => {
    expect(root["--primary"]).toBe("var(--color-brand-900)")
    expect(root["--primary-foreground"]).toBe("var(--color-brand-50)")
    expect(root["--ring"]).toBe("var(--color-brand-400)")
  })

  it(":root มี token อื่นของ shadcn ครบ (ค่า neutral)", () => {
    for (const name of [
      "--radius",
      "--background",
      "--foreground",
      "--card",
      "--card-foreground",
      "--popover",
      "--popover-foreground",
      "--secondary",
      "--secondary-foreground",
      "--muted",
      "--muted-foreground",
      "--accent",
      "--accent-foreground",
      "--destructive",
      "--border",
      "--input",
    ]) {
      expect(root[name], name).toBeDefined()
    }
  })

  it("utility ของ shadcn (bg-primary, text-primary-foreground, ring-ring, rounded-md, animate-in) generate ได้", async () => {
    const compiled = await compile([
      "bg-primary",
      "text-primary-foreground",
      "ring-ring",
      "bg-background",
      "border-input",
      "rounded-md",
      "animate-in",
    ])
    // @theme inline → utility อ้าง token ของ :root ตรง
    expect(declsOf(compiled, ".bg-primary")["background-color"]).toBe("var(--primary)")
    expect(declsOf(compiled, ".text-primary-foreground").color).toBe("var(--primary-foreground)")
    expect(declsOf(compiled, ".ring-ring")["--tw-ring-color"]).toBe("var(--ring)")
    expect(declsOf(compiled, ".bg-background")["background-color"]).toBe("var(--background)")
    expect(declsOf(compiled, ".border-input")["border-color"]).toBe("var(--input)")
    expect(declsOf(compiled, ".rounded-md")["border-radius"]).toBeDefined()
    expect(declsOf(compiled, ".animate-in").animation).toBeDefined()
    expect(cssVar(globals, "--color-primary")).toBe("var(--primary)")
    expect(cssVar(globals, "--color-ring")).toBe("var(--ring)")
  })

  it("หลัง compile ตัวแปร brand ที่ --primary/--primary-foreground/--ring อ้างถูก emit จริง (ไม่หายเพราะไม่มี class ใช้)", async () => {
    const compiled = await compile(["bg-primary"])
    const emitted: Record<string, string> = {}
    compiled.walkDecls(/^--color-brand-/, (decl) => {
      emitted[decl.prop] = decl.value
    })
    expect(emitted["--color-brand-900"]).toBe("#171717")
    expect(emitted["--color-brand-50"]).toBe("#FAFAFA")
    expect(emitted["--color-brand-400"]).toBe("#A3A3A3")
  })

  it("ไม่ import shadcn/tailwind.css (ADR-030: CLI ไม่เป็น dependency)", () => {
    expect(globals).not.toMatch(/@import\s+"shadcn\//)
  })

  // SFUI-2 (session หลักตัดสิน Q2): component ของ CLI มี class `dark:*` — ถ้าไม่มี custom variant Tailwind v4 จะ compile
  // เป็น @media (prefers-color-scheme: dark) ทำให้เครื่องที่ตั้ง dark mode เห็นสีเพี้ยน; variant ผูกกับ data-mode="dark"
  // ซึ่งร้านไม่ตั้ง (<html data-mode="light">) และไม่มี selector .dark (กฎ 7)
  it("@custom-variant dark ผูกกับ [data-mode=dark] — dark:* ไม่ถูก compile เป็น prefers-color-scheme", async () => {
    expect(globals).toMatch(/@custom-variant\s+dark\s+\(&:where\(\[data-mode=dark\] \*\)\);/)
    const css = (await compile(["dark:bg-input/30", "dark:aria-invalid:ring-destructive/40"])).toString()
    expect(css).not.toMatch(/prefers-color-scheme/)
    expect(css).toMatch(/\[data-mode=dark\]/)
    // selector .dark (ไม่นับชื่อ class ที่ escape แล้ว เช่น `.dark\:bg-input\/30`)
    expect(css).not.toMatch(/\.dark(?!\\)\b/)
  })
})
