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

/** CORE-53 (กฎข้อ 111a): string literal (คงไว้) หรือ comment (ตัดทิ้ง) — จับ string ก่อน จึงไม่ตัด `/*` หรือ `//` ที่อยู่ใน string */
const STRING_OR_COMMENT = /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g
const TIMEOUT_KEY = "(?:timeout|actionTimeout|navigationTimeout)"
/**
 * CORE-49 (กฎข้อ 107b): ห้ามเฉพาะ**การตั้งค่า** key timeout (ตัด comment ออกก่อน — คำว่า timeout ใน comment ไม่นับ)
 * CORE-53 (กฎข้อ 111a): นับ shorthand `{ timeout }` ด้วย (key ตามด้วย `,` หรือ `}`)
 */
const setsTimeout = (config: string) => {
  const code = config.replace(STRING_OR_COMMENT, (_match, literal: string | undefined) => literal ?? "")
  return (
    new RegExp(`\\b${TIMEOUT_KEY}["']?\\s*:`).test(code) || new RegExp(`[{,]\\s*${TIMEOUT_KEY}\\s*[,}]`).test(code)
  )
}

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

test("AC-148 (กฎข้อ 111a): setsTimeout จับ shorthand และไม่ตัด /* ที่อยู่ใน string", () => {
  for (const config of ["{ timeout }", "{ use: { actionTimeout } }", "{ expect: { timeout, other: 1 } }", "{ use: { navigationTimeout, } }"]) {
    expect(setsTimeout(config), config).toBe(true)
  }
  expect(setsTimeout('const a="/*"; export default { timeout: 1 }')).toBe(true)
  expect(setsTimeout("const a = '/*'; const b = `*/`; export default { actionTimeout: 1 }")).toBe(true)
  expect(setsTimeout('const url = "http://x"; export default { timeout: 1 }')).toBe(true)
  // comment ทั้งสองแบบ (รวม `//` ท้ายบรรทัด) ยังไม่นับ
  expect(setsTimeout("export default { retries: 0 } // timeout: 1\n/* { timeout } */")).toBe(false)
  expect(setsTimeout('const timeoutMs = 1; export default { name: "timeout" }')).toBe(false)
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
/**
 * 2 ตัวแรกไม่มี object; ตัวที่ 3 (ถ้ามี) เป็น `{...}` (ปีกกาซ้อนได้ 2 ชั้น) และเป็นตัวสุดท้าย
 * CORE-54 (กฎข้อ 112b): ปีกกาต้องจับคู่กัน — ไม่ใช้ `[\s\S]*` แบบ greedy ที่เดินข้าม `}` ของ object ตัวแรกไปถึงตัวที่ 4
 * ข้อจำกัด (nit review #355): รับปีกกาซ้อนได้แค่ 2 ชั้น และไม่รู้จัก string — `{`/`}`/`,` ใน string หรือ object ซ้อน 3 ชั้น
 * ทำให้ไม่ match → test ล้มให้เห็น (ไม่ผ่านเงียบ) แล้วค่อยขยาย regex เมื่อมีผู้เรียกแบบนั้นจริง
 * CORE-59 (กฎข้อ 117c): ไม่ต้อง parse string ให้ครบ — tsc (typecheck) จับอาร์กิวเมนต์ที่ผิดรูปอยู่แล้ว
 */
const VALID_AFFILIATE_ARGS = /^\s*[^,{]+,\s*[^,{]+(?:,\s*\{(?:[^{}]|\{[^{}]*\})*\})?\s*,?\s*$/
const affiliateCalls = (src: string) => Array.from(src.matchAll(AFFILIATE_CALL), (match) => match[1])

/** CORE-54 (กฎข้อ 112a): body ของ `function longCode` ถึง `\n}\n` — หาไม่เจอต้อง throw ไม่คืนสตริงว่างให้ assert ผ่านเงียบ */
const longCodeBody = (src: string) => {
  const start = src.indexOf("function longCode")
  if (start === -1) throw new Error("ไม่พบ function longCode")
  const end = src.indexOf("\n}\n", start)
  if (end === -1) throw new Error("ไม่พบจุดจบของ function longCode")
  return src.slice(start, end)
}

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

test("AC-149 (กฎข้อ 112b): ตัวตรวจอาร์กิวเมนต์ createActiveAffiliate ปฏิเสธตัวที่ 4 แม้ตัวสุดท้ายเป็น object", () => {
  expect(VALID_AFFILIATE_ARGS.test("request, admin, { a: 1 }, { b: 2 }")).toBe(false)
  expect(VALID_AFFILIATE_ARGS.test("request, admin, { a: { b: 1 } }")).toBe(true)
  expect(VALID_AFFILIATE_ARGS.test('request, await adminHeaders(request), {\n  prefix: "x",\n  name,\n}\n')).toBe(true)
})

test("AC-149 (กฎข้อ 112a): longCodeBody throw เมื่อหา longCode ไม่เจอ ไม่ผ่านเงียบ", () => {
  expect(() => longCodeBody("const other = 1")).toThrow()
  expect(() => longCodeBody("function longCode() {\n  return 1")).toThrow()
  expect(longCodeBody("function longCode() {\n  return 1\n}\n")).toContain("return 1")
})

test("AC-146 (กฎข้อ 109c,d): longCode ไม่สุ่มตัวอักษร รูปแบบรหัสคงที่ และ describe ของ AC-52 ตั้ง evidenceTarget เป็น AF-20", () => {
  const src = read("affiliate-header-overflow.spec.ts")
  expect(longCodeBody(src)).not.toContain("letters(")
  expect(src).toMatch(/const LONG_CODE_SHAPE = "[a-z0-9-]{32}"/)
  expect(src).toContain('expect(code.replace(/\\d/g, "0")).toBe(LONG_CODE_SHAPE)')

  const ac52 = src.split("test.describe(").filter((block) => /^[`"]AC-52/.test(block))
  expect(ac52).toHaveLength(2)
  for (const block of ac52) expect(block).toContain('taskId: "AF-20"')
  expect(src).toContain('test.use({ evidenceTarget: { feature: "affiliate", taskId: "AF-19" } })')
})

/** CORE-61 (กฎข้อ 119a): body ของ test ที่ชื่อขึ้นต้นด้วย `prefix` ถึง `test(` ตัวถัดไป — หาไม่เจอต้อง throw ไม่ผ่านเงียบ */
const testBody = (src: string, prefix: string) => {
  const start = src.indexOf(`test("${prefix}`)
  if (start === -1) throw new Error(`ไม่พบ test "${prefix}`)
  const next = src.slice(start + 1).search(/\n\s*test\(/)
  return next === -1 ? src.slice(start) : src.slice(start, start + 1 + next)
}

test("AC-160 (กฎข้อ 119a): test A ของ group-buy-join รอ server action ของ prepare และ join ด้วย waitForServerAction ไม่มี waitForTimeout", () => {
  expect(() => testBody("const x = 1", "A:")).toThrow()
  const body = testBody(read("group-buy-join.spec.ts"), "A:")
  expect(body.match(/waitForServerAction\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  expect(body).not.toContain("waitForTimeout")
})

test("AC-160 (กฎข้อ 119b): const PAGINATION_TEXT ประกาศที่ support/admin.ts ที่เดียว และ 4 ไฟล์ admin import จากที่นั่น", () => {
  expect(files.filter((name) => read(name).includes("const PAGINATION_TEXT"))).toEqual([path.join("support", "admin.ts")])
  for (const name of [
    "affiliate-admin-forms.spec.ts",
    "group-buy-admin-pages.spec.ts",
    "evoucher-admin-pool-page.spec.ts",
    "evoucher-admin-forms.spec.ts",
  ]) {
    expect(read(name), name).toMatch(/import\s*\{[^}]*\bPAGINATION_TEXT\b[^}]*\}\s*from\s*"\.\/support\/admin"/)
  }
})

/** ADM-30 (spec 08 กฎ 34a): ตัด comment ออก (คง string literal) ก่อน match — assert ที่ถูก comment ไว้ไม่นับ */
const stripComments = (code: string) => code.replace(STRING_OR_COMMENT, (_match, literal: string | undefined) => literal ?? "")

/** ADM-30: เนื้อในของวงเล็บที่เปิดที่ `start` (นับคู่ `open`/`close`) — หาวงเล็บปิดไม่เจอต้อง throw ไม่ผ่านเงียบ */
const balanced = (code: string, start: number, open: string, close: string) => {
  let depth = 0
  for (let i = start; i < code.length; i++) {
    if (code[i] === open) depth++
    else if (code[i] === close && --depth === 0) return code.slice(start + 1, i)
  }
  throw new Error(`ไม่พบ ${close} ที่ปิด ${open} ตำแหน่ง ${start}`)
}

const AC44_CLEANUP = ["affiliate_payout", "affiliate_commission_entry", "affiliate", "affiliate_program"]

/** ADM-30 (spec 08 กฎ 34d; spec 01 กฎข้อ 119c): ปัญหาของ `finally` ใน body ของ test AC-44 — ไม่ดู `finally` ของ helper นอก test */
const ac44FinallyProblems = (body: string) => {
  const code = stripComments(body)
  const at = code.search(/\bfinally\s*\{/)
  if (at === -1) return ["ไม่พบ finally ใน test AC-44"]
  const block = balanced(code, code.indexOf("{", at), "{", "}")
  const deleted = Array.from(block.matchAll(/softSql\("[^"]*",\s*"delete from (\w+)/g), ([, table]) => table)
  const problems: string[] = []
  if (deleted.join() !== AC44_CLEANUP.join()) {
    problems.push(`softSql ใน finally ลบ ${deleted.join(" → ") || "(ไม่มี)"} — ต้องเป็น ${AC44_CLEANUP.join(" → ")}`)
  }
  if (!/softSql\("[^"]*",\s*"select count\(\*\)[^"]*from affiliate\b/.test(block)) problems.push("ไม่นับ affiliate ที่เหลือด้วย softSql")
  if (!/expect\.soft\([^\n]*\.count\b[^\n]*\)\.toBe\(0\)/.test(block)) problems.push("ไม่มี expect.soft(… count …).toBe(0)")
  return problems
}

test("AC-160 (กฎข้อ 119c; spec 08 กฎ 34d): finally ของ test AC-44 ลบ payout → entry → affiliate → program ด้วย softSql + expect.soft จำนวนที่เหลือ และไม่มี request.delete( ที่ไม่ตรวจ ok", () => {
  const src = read("affiliate-admin-payout-create.spec.ts")
  expect(ac44FinallyProblems(testBody(src, "AC-44:"))).toEqual([])
  const deletes = src.match(/request\.delete\(/g)?.length ?? 0
  const checked = Array.from(src.matchAll(/const (\w+) = await request\.delete\(/g)).filter(([, name]) =>
    src.includes(`${name}.ok()`)
  ).length
  expect(checked).toBe(deletes)
})

test("AC-35 (spec 08 กฎ 34d) self-check: finally ที่ไม่มี softSql ลบ affiliate หรือ finally ของ helper นอก test ไม่ผ่าน", () => {
  const cleanup = [
    'softSql("a", "delete from affiliate_payout where affiliate_id = any($1)", [ids])',
    'softSql("b", "delete from affiliate_commission_entry where order_id = $1", [o, ids])',
    'softSql("c", "delete from affiliate where id = any($1)", [ids])',
    'softSql("d", "delete from affiliate_program where id = any($1)", [programIds])',
    'const left = await softSql("e", "select count(*)::int as count from affiliate where id = any($1)", [ids])',
    'expect.soft(left[0]?.count, "x").toBe(0)',
  ]
  const sample = (lines: string[]) => `test("AC-44: x", async () => {\n  try {\n    run()\n  } finally {\n    ${lines.join("\n    ")}\n  }\n})\n`
  expect(ac44FinallyProblems(sample(cleanup))).toEqual([])
  const noAffiliate = sample(cleanup.filter((line) => !line.includes('"c"')))
  expect(noAffiliate).toMatch(/\bfinally\s*\{/) // static เดิมของกฎข้อ 119c ผ่านตัวอย่างนี้ (vacuous)
  expect(ac44FinallyProblems(noAffiliate)).not.toEqual([])
  expect(ac44FinallyProblems(sample(cleanup.map((line) => (line.includes('"c"') ? `// ${line}` : line))))).not.toEqual([])
  expect(ac44FinallyProblems(sample([cleanup[1], cleanup[0], ...cleanup.slice(2)]))).not.toEqual([])
  expect(ac44FinallyProblems(sample(cleanup.slice(0, 4)))).not.toEqual([])
  expect(ac44FinallyProblems('test("AC-44: x", async () => {\n  run()\n})\n')).toEqual(["ไม่พบ finally ใน test AC-44"])
})

/** ADM-29 (spec 08 กฎ 33d): นิพจน์ของ `const tag = …` ใน body ของ test — หาไม่เจอต้อง throw ไม่ผ่านเงียบ */
const tagExpression = (body: string) => {
  const match = body.match(/const tag = ([^\n]+)\n/)
  if (!match) throw new Error("ไม่พบ const tag = …")
  return match[1].trim()
}

/** ADM-30 (spec 08 กฎ 34a, 34b): ปัญหาของการค้นด้วย q ใน body ของ test — ตัด comment ก่อน แล้วทุก predicate ของ
 * `waitForResponse` ที่ตรวจ `searchParams.get("q")` ต้องเทียบ `pathname ===` และสร้าง `new URL(` ครั้งเดียว; ต้อง assert count = 1 */
const searchProblems = (body: string) => {
  const code = stripComments(body)
  const predicates: string[] = []
  for (let at = code.indexOf("waitForResponse("); at !== -1; at = code.indexOf("waitForResponse(", at + 1)) {
    const predicate = balanced(code, at + "waitForResponse".length, "(", ")")
    if (predicate.includes('searchParams.get("q")')) predicates.push(predicate)
  }
  const problems = predicates.length === 0 ? ['ไม่พบ waitForResponse ที่ตรวจ searchParams.get("q")'] : []
  for (const predicate of predicates) {
    if (!/\bpathname\s*===/.test(predicate)) problems.push(`predicate ไม่เทียบ pathname ===: ${predicate.trim()}`)
    if (predicate.match(/new URL\(/g)?.length !== 1) problems.push(`predicate ต้องสร้าง new URL( ครั้งเดียว: ${predicate.trim()}`)
  }
  if (!/\.count\b[^\n]*\)\.toBe\(1\)/.test(code)) problems.push("ไม่มี assert .count … toBe(1) ของผล q")
  return problems
}

test("AC-35 (spec 08 กฎ 34a, 34b) self-check: assert count ที่ถูก comment หรือ predicate ที่ไม่เทียบ pathname ไม่ผ่าน", () => {
  const predicate = '(r) => {\n  const url = new URL(r.url())\n  return url.pathname === AFFILIATES && url.searchParams.get("q") === term\n}'
  const count = 'expect((await (await searched).json()).count, `GET ${AFFILIATES}?q=${term}`).toBe(1)'
  const sample = (p: string, c: string) => `const searched = page.waitForResponse(\n${p},\n)\nawait fill(term)\n${c}\n`
  expect(searchProblems(sample(predicate, count))).toEqual([])
  const commented = sample(predicate, `// ${count}`)
  expect(commented).toMatch(/\.count\b[^\n]*\)\.toBe\(1\)/) // static เดิมของกฎ 33d ผ่านตัวอย่างนี้ (vacuous)
  expect(searchProblems(commented)).not.toEqual([])
  expect(searchProblems(sample(predicate, `/* ${count} */`))).not.toEqual([])
  expect(searchProblems(sample(`// ${predicate.replace(/\n/g, "\n// ")}`, count))).not.toEqual([])
  expect(searchProblems(sample('(r) => new URL(r.url()).searchParams.get("q") === term', count))).not.toEqual([])
  const twice = '(r) => new URL(r.url()).pathname === AFFILIATES && new URL(r.url()).searchParams.get("q") === term'
  expect(searchProblems(sample(twice, count))).not.toEqual([])
  expect(() => searchProblems("page.waitForResponse((r) => r.ok()")).toThrow()
})

test("AC-33/AC-34/AC-35 (spec 08 กฎ 32, 33, 34; ADM-28, ADM-29, ADM-30): AC-12 ตัวแรกและ payout ของ affiliate-admin-forms ใช้ tag ไม่มีตัวเลข, assert count = 1 ของผล q และ predicate เทียบ pathname (ไม่นับ comment), ไม่มี waitForTimeout และ setTimeout ≤ 120_000", () => {
  const src = read("affiliate-admin-forms.spec.ts")
  expect(() => tagExpression("const x = 1\n")).toThrow()
  for (const prefix of ["AC-12: ปิด all โดยไม่เลือก scope", "AC-12/AC-21: ฟอร์มสร้าง payout"]) {
    const body = testBody(src, prefix)
    // ต้นเหตุ (ADM-28 trace run 44071909424, 43475980049): q ของ Medusa แยกคำแล้ว AND — tag ตัวเลขที่มี "249" ทำให้ทั้ง 250 รายการตรง
    const expression = tagExpression(body)
    if (expression.includes("Date.now()")) expect(expression, prefix).toContain(".replace(/\\d/g,")
    // ตรวจผลจริง: ประเมินนิพจน์จากไฟล์ test ของเราเอง (ใช้แค่ String/Date.now) หลายครั้งแล้วต้องไม่มีตัวเลข
    const evaluate = new Function(`return ${expression}`) as () => string
    for (let i = 0; i < 5; i++) expect(evaluate(), prefix).not.toMatch(/\d/)
    expect(searchProblems(body), prefix).toEqual([])
    expect(body, prefix).not.toContain("waitForTimeout")
    const timeouts = Array.from(body.matchAll(/test\.setTimeout\(([\d_]+)\)/g), ([, value]) => Number(value.replace(/_/g, "")))
    expect(timeouts.length, prefix).toBeGreaterThan(0)
    for (const value of timeouts) expect(value, prefix).toBeLessThanOrEqual(120_000)
  }
})
