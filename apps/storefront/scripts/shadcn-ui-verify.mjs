#!/usr/bin/env node
// SFUI-7 (spec 09 กฎ 3): ตรวจว่า src/components/ui/* ตรงกับผลของ shadcn CLI ตัวอักษรต่อตัวอักษร (ต้องใช้เน็ต — รันในเครื่อง)
//   node scripts/shadcn-ui-verify.mjs                 → add ทุก component ใน manifest ลง temp dir แล้วเทียบกับ src/components/ui
//   node scripts/shadcn-ui-verify.mjs --write [name…] → เขียน hash ของผล CLI ลง manifest (เพิ่ม component ใหม่ได้) — ไม่แตะ src/components/ui
// CLI รันใน temp dir ที่มีแค่ components.json/package.json/tsconfig.json/globals.css/utils.ts ของเรา จึงไม่แก้ package.json/lockfile/globals.css
// ของโปรเจกต์; test offline `e2e/sfui-7-ui-pristine.unit.spec.ts` เทียบไฟล์จริงกับ hash ใน manifest
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const STOREFRONT = path.resolve(import.meta.dirname, "..")
const UI = path.join(STOREFRONT, "src/components/ui")
const MANIFEST = path.join(STOREFRONT, "e2e/support/shadcn-ui.json")

const args = process.argv.slice(2)
const write = args.includes("--write")
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"))
const names = [
  ...new Set([
    ...Object.keys(manifest.files).map((f) => f.replace(/\.tsx$/, "")),
    ...args.filter((a) => !a.startsWith("--")),
  ]),
].sort()

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "shadcn-ui-verify-"))
for (const file of ["components.json", "package.json", "tsconfig.json", "src/styles/globals.css", "src/lib/utils.ts"]) {
  fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true })
  fs.copyFileSync(path.join(STOREFRONT, file), path.join(tmp, file))
}
execFileSync("pnpm", ["dlx", `shadcn@${manifest.shadcn}`, "add", ...names, "--overwrite", "--yes"], {
  cwd: tmp,
  stdio: "inherit",
})

const sha256 = (text) => createHash("sha256").update(text).digest("hex")
const generated = path.join(tmp, "src/components/ui")
const files = Object.fromEntries(
  fs
    .readdirSync(generated)
    .sort()
    .map((file) => [file, sha256(fs.readFileSync(path.join(generated, file)))])
)

if (write) {
  fs.writeFileSync(MANIFEST, JSON.stringify({ ...manifest, files }, null, 2) + "\n")
  console.log(`เขียน ${Object.keys(files).length} hash ลง ${path.relative(STOREFRONT, MANIFEST)} — คัดลอกไฟล์จาก ${generated} ไป src/components/ui`)
} else {
  const actual = fs.readdirSync(UI).sort()
  const diff = [...new Set([...actual, ...Object.keys(files)])].filter(
    (file) => !files[file] || !actual.includes(file) || sha256(fs.readFileSync(path.join(UI, file))) !== files[file]
  )
  if (diff.length > 0) {
    console.error(`ไม่ตรงกับผล CLI: ${diff.join(", ")} (ผล CLI อยู่ที่ ${generated})`)
    process.exit(1)
  }
  console.log(`src/components/ui ตรงกับผล shadcn@${manifest.shadcn} ทั้ง ${actual.length} ไฟล์`)
  fs.rmSync(tmp, { recursive: true, force: true })
}
