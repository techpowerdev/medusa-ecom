import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

import { STOREFRONT } from "./support/sfui-source"

// SFUI (spec 09 กฎ 1, AC-1; ADR-030 ข้อ 10): dependency ของ storefront pin แบบ exact ตามตาราง ADR-030 ทีละขั้น
// ขั้น 1a: Tailwind v4 + PostCSS plugin ของ v4; ถอด preset/plugin ของ v3 และ autoprefixer
// ขั้น 1b = tw-animate-css, radix-ui, cva, cn, lucide-react; ขั้น 6 = ถอดชุดที่เหลือ (ข้อตรวจของแต่ละขั้นอยู่ด้านล่าง)
const pkg = JSON.parse(fs.readFileSync(path.join(STOREFRONT, "package.json"), "utf8")) as {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}
const all = { ...pkg.dependencies, ...pkg.devDependencies }

test("AC-1 (1a): tailwindcss และ @tailwindcss/postcss เป็น 4.3.5 แบบ exact ใน devDependencies", () => {
  expect(pkg.devDependencies.tailwindcss).toBe("4.3.5")
  expect(pkg.devDependencies["@tailwindcss/postcss"]).toBe("4.3.5")
  expect(pkg.dependencies.tailwindcss).toBeUndefined()
  expect(pkg.dependencies["@tailwindcss/postcss"]).toBeUndefined()
})

test("AC-1 (1a): ไม่มี @medusajs/ui-preset, tailwindcss-radix, autoprefixer", () => {
  for (const name of ["@medusajs/ui-preset", "tailwindcss-radix", "autoprefixer"]) {
    expect(all[name], name).toBeUndefined()
  }
})

test("AC-1 (กฎ 1): ไม่มีไฟล์ tailwind.config.* และ postcss config มี plugin เดียวคือ @tailwindcss/postcss", () => {
  const files = fs.readdirSync(STOREFRONT)
  expect(files.filter((name) => /^tailwind\.config\./.test(name))).toEqual([])

  const postcssFiles = files.filter((name) => /^postcss\.config\./.test(name))
  expect(postcssFiles).toHaveLength(1)
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- อ่าน config แบบเดียวกับที่ Next.js โหลด
  const config = require(path.join(STOREFRONT, postcssFiles[0]))
  expect(Object.keys((config.default ?? config).plugins)).toEqual(["@tailwindcss/postcss"])
})

test("AC-1 (กฎ 1): globals.css ขึ้นต้นด้วย @import \"tailwindcss\" (ไม่นับ comment)", () => {
  const css = fs.readFileSync(path.join(STOREFRONT, "src", "styles", "globals.css"), "utf8")
  const firstStatement = css.replace(/\/\*[\s\S]*?\*\//g, "").trim().split("\n")[0]
  expect(firstStatement).toBe('@import "tailwindcss";')
})

// ขั้น 1b (SFUI-1b): dependency ของ shadcn/ui แบบ Radix
test("AC-1 (1b): dependency ของ shadcn pin exact ตาม ADR-030 ข้อ 10", () => {
  expect(pkg.devDependencies["tw-animate-css"]).toBe("1.4.0")
  expect(pkg.dependencies["tw-animate-css"]).toBeUndefined()
  const runtime: Record<string, string> = {
    "radix-ui": "1.8.1",
    "class-variance-authority": "0.7.1",
    cn: "0.5.2",
    "lucide-react": "1.80.0",
  }
  for (const [name, version] of Object.entries(runtime)) {
    expect(pkg.dependencies[name], name).toBe(version)
    expect(pkg.devDependencies[name], name).toBeUndefined()
  }
  // CLI ใช้ผ่าน pnpm dlx เท่านั้น ไม่เป็น dependency
  expect(all.shadcn).toBeUndefined()
})

// ขั้น 6 (SFUI-6): ถอดชั้น UI เดิมที่ไม่มีผู้ใช้แล้ว — icon (lucide แทน), headless (Radix ผ่าน shadcn แทน),
// Radix แยก package (radix-ui รวมแทน), clsx (cn แทน)
test("AC-1 (6): ไม่มี @medusajs/icons, @headlessui/react, @radix-ui/react-*, clsx", () => {
  for (const name of ["@medusajs/icons", "@headlessui/react", "clsx"]) {
    expect(all[name], name).toBeUndefined()
  }
  expect(Object.keys(all).filter((name) => name.startsWith("@radix-ui/"))).toEqual([])
})
