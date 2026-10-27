import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

// spec 05 AF-3c (กฎ 31, AC-37): ทุกจุดที่ storefront เริ่มการชำระใน `modules/checkout/components/**`
// ต้อง sync cookie `aff` ผ่าน `syncAffiliateBefore` (AF-3b) — ตรวจด้วย AST ของ TypeScript ไม่ตัด source ด้วย indexOf
const COMPONENTS_DIR = path.resolve(__dirname, "modules/checkout/components")

/**
 * การเรียก `retrievePaymentIntent` เพื่อ poll สถานะอย่างเดียว (ไม่เริ่มการชำระ) — ได้รับยกเว้นพร้อมเหตุผล (กฎ 31)
 * key = `<ไฟล์ใต้ components>#<ชื่อฟังก์ชันที่ครอบ>`
 */
const POLL_ALLOW_LIST: Record<string, string> = {
  "promptpay-payment/index.tsx#PromptPayCheckout.expire":
    "QR หมดเวลาแล้ว อ่านสถานะ PI เพื่อตัดสินว่าจะ poll ต่อหรือสร้าง session ใหม่เท่านั้น — ไม่ confirm/ไม่เริ่มการชำระ",
}

/**
 * `placeOrder(` ที่ไม่ส่ง `cart.metadata` ได้เฉพาะ completion หลังการชำระที่เริ่มภายใน `syncAffiliateBefore` แล้ว
 * (กฎ 31c บังคับให้ manual ส่ง metadata; จุดอื่นต้องอยู่ใน allow-list พร้อมเหตุผล)
 */
const PLACE_ORDER_ALLOW_LIST: Record<string, string> = {
  "payment-button/index.tsx#StripePaymentButton.onPaymentCompleted":
    "เรียกหลัง stripe.confirmPayment สำเร็จ ซึ่งอยู่ใน syncAffiliateBefore แล้ว (กฎ 31a) — cart ถูก sync ก่อนเริ่มชำระ",
  "promptpay-payment/index.tsx#PromptPayCheckout.finish":
    "ทางสำรองหลังชำระพร้อมเพย์แล้ว (webhook complete cart ไปแล้ว) — sync เกิดก่อน retrievePaymentIntent/confirm ใน showQr (กฎ 31b)",
}

type Violation = { key: string; rule: string; line: number }

type ScanResult = {
  violations: Violation[]
  /** จำนวน call ที่พบต่อชนิด — กัน test ผ่านแบบว่างเปล่าเมื่อชื่อฟังก์ชันเปลี่ยน */
  counts: Record<"confirmPayment" | "confirmPromptPayPayment" | "placeOrder" | "retrievePaymentIntent", number>
  /** key ของ allow-list ที่ถูกใช้จริง — กัน allow-list ค้าง */
  usedAllowKeys: Set<string>
}

const calleeName = (call: ts.CallExpression): string | undefined => {
  const e = call.expression
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) return e.name.text
  return undefined
}

const isFunctionLike = (n: ts.Node): n is ts.FunctionLikeDeclaration =>
  ts.isArrowFunction(n) ||
  ts.isFunctionExpression(n) ||
  ts.isFunctionDeclaration(n) ||
  ts.isMethodDeclaration(n)

const HOOK_WRAPPERS = new Set(["useCallback", "useMemo"])

/** ชื่อของฟังก์ชัน: declaration ตรง หรือ `const x = () => …` / `const x = useCallback(() => …)` */
const functionName = (fn: ts.FunctionLikeDeclaration): string | undefined => {
  if ((ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) && fn.name) {
    return fn.name.getText()
  }
  let n: ts.Node = fn
  while (
    ts.isParenthesizedExpression(n.parent) ||
    ts.isAsExpression(n.parent) ||
    (ts.isCallExpression(n.parent) && HOOK_WRAPPERS.has(calleeName(n.parent) ?? ""))
  ) {
    n = n.parent
  }
  if (ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) return n.parent.name.text
  if (ts.isPropertyAssignment(n.parent)) return n.parent.name.getText()
  return undefined
}

const qualifiedName = (node: ts.Node): string => {
  const names: string[] = []
  for (let n = node.parent; n; n = n.parent) {
    if (isFunctionLike(n)) {
      const name = functionName(n)
      if (name) names.unshift(name)
    }
  }
  return names.join(".") || "<top-level>"
}

/** call อยู่ภายในฟังก์ชันที่ส่งเป็น argument ของ `syncAffiliateBefore(` (ไม่ใช่ถูกเรียกก่อนแล้วส่งผลลัพธ์) */
const isWrappedBySync = (node: ts.Node): boolean => {
  for (let n = node.parent; n; n = n.parent) {
    if (
      isFunctionLike(n) &&
      ts.isCallExpression(n.parent) &&
      calleeName(n.parent) === "syncAffiliateBefore" &&
      n.parent.arguments.some((a) => a === n)
    ) {
      return true
    }
  }
  return false
}

/** มี `syncAffiliateBefore(` เริ่มก่อน call นี้ในฟังก์ชันเดียวกัน (ฟังก์ชันที่ใกล้ที่สุดที่ครอบ) */
const hasSyncBeforeInSameFunction = (call: ts.CallExpression): boolean => {
  let fn: ts.Node | undefined = call.parent
  while (fn && !isFunctionLike(fn)) fn = fn.parent
  if (!fn) return false
  let found = false
  const visit = (n: ts.Node) => {
    if (found) return
    if (
      ts.isCallExpression(n) &&
      calleeName(n) === "syncAffiliateBefore" &&
      n.getStart() < call.getStart()
    ) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(fn, visit)
  return found
}

function scan(relFile: string, code: string): ScanResult {
  const sf = ts.createSourceFile(relFile, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const result: ScanResult = {
    violations: [],
    counts: { confirmPayment: 0, confirmPromptPayPayment: 0, placeOrder: 0, retrievePaymentIntent: 0 },
    usedAllowKeys: new Set(),
  }

  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const name = calleeName(n)
      const key = `${relFile}#${qualifiedName(n)}`
      const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
      const fail = (rule: string) => result.violations.push({ key, rule, line })

      if (name === "confirmPayment") {
        // (a) บัตร: ต้องอยู่ภายใน argument ของ syncAffiliateBefore
        result.counts.confirmPayment++
        if (!isWrappedBySync(n)) fail("31a: confirmPayment ไม่อยู่ใน syncAffiliateBefore")
      } else if (name === "confirmPromptPayPayment") {
        // (b) พร้อมเพย์: ต้องมี syncAffiliateBefore ก่อนหน้าในฟังก์ชันเดียวกัน
        result.counts.confirmPromptPayPayment++
        if (!isWrappedBySync(n) && !hasSyncBeforeInSameFunction(n)) {
          fail("31b: confirmPromptPayPayment ไม่มี syncAffiliateBefore ก่อนหน้า")
        }
      } else if (name === "placeOrder") {
        // (c) ต้องส่ง cart.metadata ให้ placeOrder sync ภายใน — เว้น completion หลังชำระที่อยู่ใน allow-list
        result.counts.placeOrder++
        if (n.arguments.length < 2) {
          if (key in PLACE_ORDER_ALLOW_LIST) result.usedAllowKeys.add(key)
          else fail("31c: placeOrder ไม่ส่ง cart.metadata")
        }
      } else if (name === "retrievePaymentIntent") {
        result.counts.retrievePaymentIntent++
        if (!isWrappedBySync(n)) {
          if (key in POLL_ALLOW_LIST) result.usedAllowKeys.add(key)
          else fail("31: retrievePaymentIntent นอก syncAffiliateBefore และไม่อยู่ใน allow-list ของการ poll")
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return result
}

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [full] : []
  })

const scanComponents = () => {
  const merged: ScanResult = {
    violations: [],
    counts: { confirmPayment: 0, confirmPromptPayPayment: 0, placeOrder: 0, retrievePaymentIntent: 0 },
    usedAllowKeys: new Set(),
  }
  for (const file of sourceFiles(COMPONENTS_DIR)) {
    const rel = path.relative(COMPONENTS_DIR, file).split(path.sep).join("/")
    const r = scan(rel, fs.readFileSync(file, "utf8"))
    merged.violations.push(...r.violations)
    for (const k of Object.keys(merged.counts) as (keyof ScanResult["counts"])[]) {
      merged.counts[k] += r.counts[k]
    }
    r.usedAllowKeys.forEach((k) => merged.usedAllowKeys.add(k))
  }
  return merged
}

describe("ทุกจุดเริ่มชำระผ่าน syncAffiliateBefore (AF-3c, กฎ 31, AC-37)", () => {
  it("source ใต้ modules/checkout/components ผ่านเงื่อนไข (a)–(c)", () => {
    const result = scanComponents()
    expect(result.violations).toEqual([])
    // กัน test ผ่านแบบว่างเปล่า: ต้องพบจุดเริ่มชำระจริงทุกชนิด
    expect(result.counts.confirmPayment).toBeGreaterThan(0)
    expect(result.counts.confirmPromptPayPayment).toBeGreaterThan(0)
    expect(result.counts.placeOrder).toBeGreaterThan(0)
  })

  it("allow-list ไม่มีแถวค้าง และทุกแถวมีเหตุผล", () => {
    const { usedAllowKeys } = scanComponents()
    for (const list of [POLL_ALLOW_LIST, PLACE_ORDER_ALLOW_LIST]) {
      for (const [key, reason] of Object.entries(list)) {
        expect(reason.trim().length, key).toBeGreaterThan(10)
        expect(usedAllowKeys.has(key), `allow-list ค้าง: ${key}`).toBe(true)
      }
    }
  })

  describe("positive control (fixture) — กรณีไม่ครอบต้องถูกจับ", () => {
    const FILE = "fixture/index.tsx"

    it.each([
      [
        "31a",
        "stripe.confirmPayment นอก syncAffiliateBefore",
        `const Pay = () => { const handlePayment = async () => {
           await syncAffiliateBefore(cart, async () => null)
           await stripe.confirmPayment({ elements })
         } }`,
      ],
      [
        "31a",
        "stripe.confirmPayment ถูกเรียกก่อนแล้วส่งผลลัพธ์ (ไม่ได้ห่อเป็นฟังก์ชัน)",
        `const Pay = () => { const handlePayment = async () => {
           await syncAffiliateBefore(cart, stripe.confirmPayment({ elements }) as any)
         } }`,
      ],
      [
        "31b",
        "ฟังก์ชันที่เรียก confirmPromptPayPayment โดยไม่มี sync ก่อน",
        `const Pay = () => { const showQr = async () => {
           const confirmed = await stripe.confirmPromptPayPayment(clientSecret, {}, { handleActions: false })
           await syncAffiliateBefore(cart, async () => confirmed)
         } }`,
      ],
      [
        "31c",
        "placeOrder(cart.id) ที่ไม่ส่ง metadata",
        `const ManualTestPaymentButton = () => { const onPaymentCompleted = async () => {
           await placeOrder(cart.id)
         } }`,
      ],
      [
        "31:",
        "retrievePaymentIntent นอก sync และไม่อยู่ใน allow-list",
        `const Pay = () => { const showQr = async () => {
           const current = await stripe.retrievePaymentIntent(clientSecret)
         } }`,
      ],
    ])("%s %s → ล้ม", (rule, _label, code) => {
      const { violations } = scan(FILE, code)
      expect(violations).toHaveLength(1)
      expect(violations[0].rule.startsWith(rule)).toBe(true)
    })

    it("รูปแบบที่ถูกต้อง (ตาม #119) → ไม่มี violation", () => {
      const code = `const Pay = () => {
        const handlePayment = async () => {
          await syncAffiliateBefore(cart, () => stripe.confirmPayment({ elements }))
        }
        const showQr = async () => {
          const current = await syncAffiliateBefore(cart, () => stripe.retrievePaymentIntent(clientSecret))
          await stripe.confirmPromptPayPayment(clientSecret, {}, { handleActions: false })
        }
        const onPaymentCompleted = async () => {
          await placeOrder(cart.id, cart.metadata ?? null)
        }
      }`
      expect(scan(FILE, code).violations).toEqual([])
    })
  })
})
