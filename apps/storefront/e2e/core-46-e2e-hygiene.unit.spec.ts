import { expect, test } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// CORE-46 (spec 01 กฎข้อ 104, AC-140 grep): ขยาย AC-137 ไป e2e/support + hygiene ของ action/สินค้า seed
const E2E = __dirname
const read = (...parts: string[]) => fs.readFileSync(path.join(E2E, ...parts), "utf8")

/** ทุกไฟล์ .ts ใต้ e2e/ (รวม support/) — ยกเว้น `*.unit.spec.ts` (grep test อย่างไฟล์นี้มีข้อความของ pattern เอง ไม่ได้คุม browser) */
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".unit.spec.ts") ? [path.relative(E2E, full)] : []
  })
const files = walk(E2E)

/** CORE-49 (กฎข้อ 107b): ห้ามเฉพาะ**การตั้งค่า** key timeout (ตัด comment ออกก่อน — คำว่า timeout ใน comment ไม่นับ) */
const setsTimeout = (config: string) =>
  /\b(timeout|actionTimeout|navigationTimeout)["']?\s*:/.test(
    config.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  )

/** CORE-49 (กฎข้อ 107c): บรรทัดที่มี `/admin/products?handle=` แล้ว `toHaveLength(1)` ภายใน 3 บรรทัดถัดไป */
const SEED_COUNT_NEXT_TO_FETCH = /\/admin\/products\?handle=[^\n]*\n(?:[^\n]*\n){0,2}[^\n]*toHaveLength\(1\)/

test("AC-140: ทุกไฟล์ใน e2e/**/*.ts ไม่มี add-product-button click() ตามด้วย toBeEnabled() (ยกเว้น comment กฎข้อ 101a)", () => {
  const offenders = files.flatMap((name) => {
    const lines = read(name).split("\n")
    return lines.flatMap((line, i) => {
      const next = lines[i + 1] ?? ""
      const clicked = line.includes('getByTestId("add-product-button").click()')
      const enabled = next.includes('getByTestId("add-product-button")).toBeEnabled()')
      const exempt = /101a/.test(line) || /101a/.test(next)
      return clicked && enabled && !exempt ? [`${name}:${i + 1}`] : []
    })
  })
  expect(offenders).toEqual([])
})

test("AC-140 (กฎข้อ 104a): checkoutToPayment ใส่ตะกร้าด้วย addToCartFromPdp", () => {
  const stripe = read("support", "stripe.ts")
  const body = stripe.slice(stripe.indexOf("export async function checkoutToPayment"))
  expect(body.slice(0, body.indexOf("\n}\n"))).toContain("addToCartFromPdp(")
})

test("AC-140 (กฎข้อ 104b): comment เรื่อง timeout ใน server-action.ts อ้าง docs ของ playwright.dev", () => {
  expect(read("support", "server-action.ts")).toMatch(/\/\/.*https:\/\/playwright\.dev\/docs\//)
})

test("AC-140 (กฎข้อ 104c): core-19a และ core-24 ไม่อ่าน headers()[\"next-action\"] เอง แต่ใช้ isAddToCartBody", () => {
  for (const name of ["core-19a-nav-cart-search.spec.ts", "core-24-pdp-quantity.spec.ts"]) {
    const src = read(name)
    expect(src, name).not.toContain('headers()["next-action"]')
    expect(src, name).toContain("waitForServerAction(page, isAddToCartBody)")
  }
})

test("AC-140 (กฎข้อ 104d): e2e ไม่มี admin/products?limit=1 และสามไฟล์ใช้ handle= พร้อม assert จำนวน 1", () => {
  expect(files.filter((name) => read(name).includes("admin/products?limit=1"))).toEqual([])
  for (const name of [
    "affiliate-admin-programs.spec.ts",
    "group-buy-admin-detail.spec.ts",
    "group-buy-admin-dates.spec.ts",
  ]) {
    // CORE-49 (กฎข้อ 107c): toHaveLength(1) ต้องอยู่ภายใน 3 บรรทัดถัดจากบรรทัดที่ดึง handle= — ไม่ค้นทั้งไฟล์
    expect(read(name), name).toMatch(SEED_COUNT_NEXT_TO_FETCH)
  }
})

test("AC-140/AC-144 (กฎข้อ 107b): playwright.config.ts ไม่ตั้ง timeout/expect.timeout/actionTimeout/navigationTimeout", () => {
  expect(setsTimeout(fs.readFileSync(path.join(E2E, "..", "playwright.config.ts"), "utf8"))).toBe(false)
})

test("AC-144 (กฎข้อ 107b): regex ของ config ตรวจเฉพาะการตั้งค่า — comment ที่มีคำว่า timeout ไม่ทำให้ล้ม", () => {
  expect(setsTimeout("// ไม่ตั้ง timeout: ใช้ default\n/* actionTimeout: 0 */\nexport default {}")).toBe(false)
  for (const config of ["{ timeout: 1 }", "{ use: { actionTimeout: 1 } }", "{ expect: { timeout: 1 } }", "{ use: { navigationTimeout: 1 } }"]) {
    expect(setsTimeout(config), config).toBe(true)
  }
})

test("AC-140: ไฟล์ที่แตะไม่มี waitForTimeout / force", () => {
  for (const name of [
    path.join("support", "stripe.ts"),
    path.join("support", "server-action.ts"),
    "core-19a-nav-cart-search.spec.ts",
    "core-24-pdp-quantity.spec.ts",
    "group-buy-admin-detail.spec.ts",
    "group-buy-admin-dates.spec.ts",
    "affiliate-admin-programs.spec.ts",
  ]) {
    const src = read(name)
    expect(src, name).not.toContain("waitForTimeout")
    expect(src, name).not.toMatch(/force:\s*true/)
  }
})

test("AC-144 (กฎข้อ 107e): core-25, core-26, fs19 รอ action ด้วย waitForServerAction(page, isAddToCartBody) ไม่อ่าน headers()[\"next-action\"] เอง", () => {
  for (const name of ["core-25-pdp-option-reset.spec.ts", "core-26-cart-dropdown-total.spec.ts", "flash-sale-fs19.spec.ts"]) {
    const src = read(name)
    expect(src, name).not.toContain('headers()["next-action"]')
    expect(src, name).toContain("waitForServerAction(page, isAddToCartBody)")
  }
  expect(read("flash-sale-fs19.spec.ts")).toContain("isServerAction(")
})

/**
 * CORE-51 (กฎข้อ 109b): อาร์กิวเมนต์ของทุกการเรียก `createActiveAffiliate(` (หลายบรรทัดได้, วงเล็บซ้อนได้ 2 ชั้น เช่น `await adminHeaders(request)`)
 * ส่วนการประกาศ `function createActiveAffiliate(` ไม่นับ
 */
const AFFILIATE_CALL = /(?<!function )\bcreateActiveAffiliate\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/g
/** 2 ตัวแรกไม่มี object; ตัวที่ 3 (ถ้ามี) เป็น `{...}` และเป็นตัวสุดท้าย */
const VALID_AFFILIATE_ARGS = /^\s*[^,{]+,\s*[^,{]+(?:,\s*\{[\s\S]*\})?\s*,?\s*$/
const affiliateCalls = (src: string) => Array.from(src.matchAll(AFFILIATE_CALL), (match) => match[1])

test("AC-146 (กฎข้อ 109a): DESKTOP_BASELINE ค่าตาราง /cart อยู่ที่ support/cart-layout.ts ไฟล์เดียว และสองไฟล์ cart import จากที่นั่น", () => {
  const home = path.join("support", "cart-layout.ts")
  expect(files.filter((name) => read(name).includes("DESKTOP_BASELINE = {"))).toEqual([home])
  for (const name of ["core-42-cart-voucher-layout.spec.ts", "core-47-cart-375-long-title.spec.ts"]) {
    expect(read(name), name).toMatch(/import\s*\{[^}]*\bDESKTOP_BASELINE\b[^}]*\}\s*from\s*"\.\/support\/cart-layout"/)
  }
  expect(read("core-47-cart-375-long-title.spec.ts")).not.toContain("คัดลอก")
})

test("AC-146 (กฎข้อ 109b): ทุกการเรียก createActiveAffiliate มีอาร์กิวเมนต์ไม่เกิน 3 ตัว และตัวที่ 3 เป็น options object", () => {
  // ตัวตรวจเองต้องจับแบบตำแหน่งได้ และไม่จับแบบ object หลายบรรทัด
  expect(affiliateCalls('createActiveAffiliate(request, admin, "x")')).toEqual(['request, admin, "x"'])
  expect(VALID_AFFILIATE_ARGS.test('request, admin, "x"')).toBe(false)
  expect(VALID_AFFILIATE_ARGS.test('request, admin, "x", undefined, name, code')).toBe(false)
  expect(VALID_AFFILIATE_ARGS.test('request, admin, { prefix: "x" }, "y"')).toBe(false)
  expect(VALID_AFFILIATE_ARGS.test("request, admin")).toBe(true)
  expect(VALID_AFFILIATE_ARGS.test('request, await adminHeaders(request), {\n  prefix: "x",\n  name,\n}\n')).toBe(true)

  const callers = files.filter((name) => /(?<!function )\bcreateActiveAffiliate\(/.test(read(name)))
  expect(callers.length).toBeGreaterThan(0)
  for (const name of callers) {
    const src = read(name)
    const calls = affiliateCalls(src)
    // regex ต้องจับครบทุกจุด — วงเล็บซ้อนเกินที่รองรับต้องล้ม ไม่ใช่ผ่านเพราะหาไม่เจอ
    expect(calls.length, name).toBe(src.match(/(?<!function )\bcreateActiveAffiliate\(/g)?.length)
    expect(calls.filter((args) => !VALID_AFFILIATE_ARGS.test(args)), name).toEqual([])
  }
})

test("AC-146 (กฎข้อ 109c,d): longCode ไม่สุ่มตัวอักษร รูปแบบรหัสคงที่ และ describe ของ AC-52 ตั้ง evidenceTarget เป็น AF-20", () => {
  const src = read("affiliate-header-overflow.spec.ts")
  const body = src.slice(src.indexOf("function longCode"))
  expect(body.slice(0, body.indexOf("\n}\n"))).not.toContain("letters(")
  expect(src).toMatch(/const LONG_CODE_SHAPE = "[a-z0-9-]{32}"/)
  expect(src).toContain('expect(code.replace(/\\d/g, "0")).toBe(LONG_CODE_SHAPE)')

  const ac52 = src.split("test.describe(").filter((block) => /^[`"]AC-52/.test(block))
  expect(ac52).toHaveLength(2)
  for (const block of ac52) expect(block).toContain('taskId: "AF-20"')
  expect(src).toContain('test.use({ evidenceTarget: { feature: "affiliate", taskId: "AF-19" } })')
})
