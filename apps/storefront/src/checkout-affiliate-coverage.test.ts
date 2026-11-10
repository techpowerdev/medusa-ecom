import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

// spec 05 AF-3c (กฎ 31, AC-37): ทุกจุดที่ storefront เริ่มการชำระใน `modules/checkout/components/**`
// ต้อง sync cookie `aff` ผ่าน `syncAffiliateBefore` (AF-3b) — ตรวจด้วย AST ของ TypeScript ไม่ตัด source ด้วย indexOf
const COMPONENTS_DIR = path.resolve(__dirname, "modules/checkout/components")
// PAY-3b2: สแกนหน้าชำระเงินของ order กลุ่มด้วย (key = `order-pay/...`) เพื่อให้ทุกจุดเริ่มชำระที่นั่นอยู่ใน START_ALLOW_LIST พร้อมเหตุผล
const ORDER_COMPONENTS_DIR = path.resolve(__dirname, "modules/order/components")
const ORDER_PAY_DIR = path.join(ORDER_COMPONENTS_DIR, "order-pay")
// GB-7a2 (spec 04 กฎข้อ 27, 29d; AC-47): หน้ากลุ่มเรียก server action join ด้วย cart ใหม่ — ต้อง sync `aff` ก่อน (key = `group-buy/...`)
const MODULES_DIR = path.resolve(__dirname, "modules")
const GROUP_BUY_DIR = path.join(MODULES_DIR, "group-buy/components")

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

const ORDER_PAY_REASON =
  "หน้า /account/orders/:id/pay ของ group buy อยู่นอกกฎ 31 (รอบ 12) — ไม่มี cart ให้ sync; attribution ของ order กลุ่มอ่าน token จาก metadata ของ draft order ที่บันทึกตอน join (spec 05 กฎ 41)"

/**
 * จุดเริ่มชำระ (confirmPayment / confirmPromptPayPayment / openQr / retrievePaymentIntent) ที่ได้รับยกเว้นทั้งฟังก์ชันพร้อมเหตุผล
 * key = `<ไฟล์>#<ชื่อฟังก์ชันที่ครอบ>`
 */
const START_ALLOW_LIST: Record<string, string> = {
  "promptpay-payment/open-qr.ts#openQr":
    "helper ที่ใช้ร่วมกับหน้า order — ไม่รู้จัก cart; ผู้เรียกใน checkout ต้อง sync ก่อนเรียก openQr( (ตรวจที่จุดเรียกด้วยกฎ 31b)",
  "order-pay/pay-buttons.tsx#OrderCardButton.pay": ORDER_PAY_REASON,
  "order-pay/pay-buttons.tsx#OrderPromptPayButton.showQr": ORDER_PAY_REASON,
  "order-pay/pay-buttons.tsx#OrderPromptPayButton.expire": ORDER_PAY_REASON,
}

type Violation = { key: string; rule: string; line: number }

type ScanResult = {
  violations: Violation[]
  /** จำนวน call ที่พบต่อชนิด — กัน test ผ่านแบบว่างเปล่าเมื่อชื่อฟังก์ชันเปลี่ยน */
  counts: Record<
    "confirmPayment" | "confirmPromptPayPayment" | "openQr" | "placeOrder" | "retrievePaymentIntent" | "joinGroupBuy",
    number
  >
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

/** `syncAffiliateBefore(` ที่ call นี้อยู่ภายในฟังก์ชันที่ส่งเป็น argument (ไม่ใช่ถูกเรียกก่อนแล้วส่งผลลัพธ์) */
const wrappingSync = (node: ts.Node): ts.CallExpression | undefined => {
  for (let n = node.parent; n; n = n.parent) {
    if (
      isFunctionLike(n) &&
      ts.isCallExpression(n.parent) &&
      calleeName(n.parent) === "syncAffiliateBefore" &&
      n.parent.arguments.some((a) => a === n)
    ) {
      return n.parent
    }
  }
  return undefined
}
const isWrappedBySync = (node: ts.Node): boolean => !!wrappingSync(node)

/**
 * มี `syncAffiliateBefore(` ที่**จบ**ก่อน call นี้เริ่ม ในฟังก์ชันเดียวกัน (ฟังก์ชันที่ใกล้ที่สุดที่ครอบ) — AF-N3 (กฎ 40e):
 * ไม่นับ sync ที่อยู่ในฟังก์ชันซ้อนที่ประกาศไว้ (ไม่ได้ถูกเรียกในลำดับนี้) และไม่นับ sync ที่เป็นส่วนหนึ่งของ argument ของ call เอง
 */
const precedingSync = (call: ts.CallExpression): ts.CallExpression | undefined => {
  let fn: ts.Node | undefined = call.parent
  while (fn && !isFunctionLike(fn)) fn = fn.parent
  if (!fn) return undefined
  let found: ts.CallExpression | undefined
  const visit = (n: ts.Node) => {
    if (found) return
    if (ts.isCallExpression(n) && calleeName(n) === "syncAffiliateBefore" && n.getEnd() <= call.getStart()) {
      found = n
      return
    }
    // ฟังก์ชันซ้อน = scope อื่น (sync ข้างในเกิดเมื่อถูกเรียกเท่านั้น)
    if (isFunctionLike(n)) return
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(fn, visit)
  return found
}
const hasSyncBeforeInSameFunction = (call: ts.CallExpression): boolean => !!precedingSync(call)

const unwrap = (e: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e)
    ? unwrap(e.expression)
    : e

/** AF-N3 (กฎ 40e/31c): argument ของ metadata มีจริง และไม่ใช่ `undefined` / `void …` */
const passesMetadata = (call: ts.CallExpression): boolean => {
  const arg = call.arguments[1]
  if (!arg) return false
  const e = unwrap(arg)
  return !(ts.isIdentifier(e) && e.text === "undefined") && !ts.isVoidExpression(e)
}

const isUndefinedArg = (e: ts.Expression) => (ts.isIdentifier(e) && e.text === "undefined") || ts.isVoidExpression(e)

/** GB-7a2 (AC-47): cart ที่ส่งให้ `syncAffiliateBefore(` มี `metadata` — object literal ต้องมี key `metadata` ที่ไม่ใช่ undefined */
const syncPassesMetadata = (sync: ts.CallExpression): boolean => {
  const arg = sync.arguments[0]
  if (!arg) return false
  const e = unwrap(arg)
  if (!ts.isObjectLiteralExpression(e)) return !isUndefinedArg(e)
  if (e.properties.some(ts.isSpreadAssignment)) return true
  return e.properties.some(
    (p) =>
      p.name?.getText() === "metadata" &&
      (ts.isShorthandPropertyAssignment(p) || (ts.isPropertyAssignment(p) && !isUndefinedArg(unwrap(p.initializer))))
  )
}

function scan(relFile: string, code: string): ScanResult {
  const sf = ts.createSourceFile(relFile, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const result: ScanResult = {
    violations: [],
    counts: { confirmPayment: 0, confirmPromptPayPayment: 0, openQr: 0, placeOrder: 0, retrievePaymentIntent: 0, joinGroupBuy: 0 },
    usedAllowKeys: new Set(),
  }

  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const name = calleeName(n)
      const key = `${relFile}#${qualifiedName(n)}`
      const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
      const fail = (rule: string) => {
        if (key in START_ALLOW_LIST) result.usedAllowKeys.add(key)
        else result.violations.push({ key, rule, line })
      }

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
      } else if (name === "openQr") {
        // PAY-3b2: openQr( confirm พร้อมเพย์ภายใน → ผู้เรียกต้อง sync ก่อนเหมือน (b)
        result.counts.openQr++
        if (!isWrappedBySync(n) && !hasSyncBeforeInSameFunction(n)) fail("31b: openQr ไม่มี syncAffiliateBefore ก่อนหน้า")
      } else if (name === "placeOrder") {
        // (c) ต้องส่ง cart.metadata ให้ placeOrder sync ภายใน — เว้น completion หลังชำระที่อยู่ใน allow-list
        result.counts.placeOrder++
        if (!passesMetadata(n)) {
          if (key in PLACE_ORDER_ALLOW_LIST) result.usedAllowKeys.add(key)
          else result.violations.push({ key, rule: "31c: placeOrder ไม่ส่ง cart.metadata", line })
        }
      } else if (name === "joinGroupBuy") {
        // (d) GB-7a2: server action join ต้องมี sync ครอบหรือก่อนหน้าในฟังก์ชันเดียวกัน และส่ง metadata ของ cart ใหม่
        result.counts.joinGroupBuy++
        const sync = wrappingSync(n) ?? precedingSync(n)
        if (!sync) fail("31d: joinGroupBuy ไม่มี syncAffiliateBefore ก่อนหน้า")
        else if (!syncPassesMetadata(sync)) fail("31d: syncAffiliateBefore ก่อน joinGroupBuy ไม่ส่ง metadata ของ cart")
      } else if (name === "retrievePaymentIntent") {
        result.counts.retrievePaymentIntent++
        if (!isWrappedBySync(n)) {
          if (key in POLL_ALLOW_LIST && !(key in START_ALLOW_LIST)) result.usedAllowKeys.add(key)
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
    counts: { confirmPayment: 0, confirmPromptPayPayment: 0, openQr: 0, placeOrder: 0, retrievePaymentIntent: 0, joinGroupBuy: 0 },
    usedAllowKeys: new Set(),
  }
  const files = [
    ...sourceFiles(COMPONENTS_DIR).map((f) => [COMPONENTS_DIR, f]),
    ...sourceFiles(ORDER_PAY_DIR).map((f) => [ORDER_COMPONENTS_DIR, f]),
    ...sourceFiles(GROUP_BUY_DIR).map((f) => [MODULES_DIR, f]),
  ]
  for (const [root, file] of files) {
    const rel = path.relative(root, file).split(path.sep).join("/")
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
  it("source ใต้ modules/checkout/components, order-pay และ group-buy/components ผ่านเงื่อนไข (a)–(d)", () => {
    const result = scanComponents()
    expect(result.violations).toEqual([])
    // กัน test ผ่านแบบว่างเปล่า: ต้องพบจุดเริ่มชำระจริงทุกชนิด
    expect(result.counts.confirmPayment).toBeGreaterThan(0)
    expect(result.counts.confirmPromptPayPayment).toBeGreaterThan(0)
    expect(result.counts.openQr).toBeGreaterThan(0)
    expect(result.counts.placeOrder).toBeGreaterThan(0)
    expect(result.counts.joinGroupBuy).toBeGreaterThan(0)
  })

  it("allow-list ไม่มีแถวค้าง และทุกแถวมีเหตุผล", () => {
    const { usedAllowKeys } = scanComponents()
    for (const list of [POLL_ALLOW_LIST, PLACE_ORDER_ALLOW_LIST, START_ALLOW_LIST]) {
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
        "31b",
        "openQr( โดยไม่มี sync ก่อน (helper confirm พร้อมเพย์ภายใน)",
        `const Pay = () => { const showQr = async () => {
           const step = await openQr(stripe, clientSecret, email, undefined)
         } }`,
      ],
      [
        "31c",
        "placeOrder(cart.id) ที่ไม่ส่ง metadata",
        `const ManualTestPaymentButton = () => { const onPaymentCompleted = async () => {
           await placeOrder(cart.id)
         } }`,
      ],
      // AF-N3 (กฎ 40e, AC-47): ตรวจค่า argument ของ metadata ไม่ใช่แค่จำนวน argument
      [
        "31c",
        "placeOrder(id, undefined) — มี argument ที่ 2 แต่ไม่ส่ง metadata จริง",
        `const ManualTestPaymentButton = () => { const onPaymentCompleted = async () => {
           await placeOrder(cart.id, undefined)
         } }`,
      ],
      [
        "31c",
        "placeOrder(id, void 0)",
        `const ManualTestPaymentButton = () => { const onPaymentCompleted = async () => {
           await placeOrder(cart.id, void 0)
         } }`,
      ],
      // AF-N3 (กฎ 40e, AC-47): sync ในฟังก์ชันอื่นที่ประกาศก่อน (ซ้อนอยู่ข้างใน) ไม่นับเป็น sync ของฟังก์ชันนี้
      [
        "31b",
        "syncAffiliateBefore อยู่ในฟังก์ชันอื่นที่ประกาศก่อน confirmPromptPayPayment",
        `const Pay = () => { const showQr = async () => {
           const prepare = async () => { await syncAffiliateBefore(cart, async () => null) }
           await stripe.confirmPromptPayPayment(clientSecret, {}, { handleActions: false })
         } }`,
      ],
      [
        "31b",
        "syncAffiliateBefore อยู่ในฟังก์ชันอื่นที่ประกาศก่อน openQr(",
        `const Pay = () => { const showQr = async () => {
           function prepare() { return syncAffiliateBefore(cart, async () => null) }
           await openQr(stripe, clientSecret, email, undefined)
         } }`,
      ],
      [
        "31b",
        "syncAffiliateBefore เป็น argument ของ confirm เอง (ไม่ได้ทำก่อน)",
        `const Pay = () => { const showQr = async () => {
           await stripe.confirmPromptPayPayment(clientSecret, await syncAffiliateBefore(cart, async () => ({})))
         } }`,
      ],
      // GB-7a2 (AC-47): join ของหน้ากลุ่ม
      [
        "31d",
        "joinGroupBuy โดยไม่มี sync ก่อน",
        `const Join = () => { const join = async () => {
           await setShippingMethod({ cartId, shippingMethodId })
           await joinGroupBuy(token, cartId)
         } }`,
      ],
      [
        "31d",
        "sync อยู่หลัง joinGroupBuy",
        `const Join = () => { const join = async () => {
           await joinGroupBuy(token, cart.id)
           await syncAffiliateBefore(cart, async () => null)
         } }`,
      ],
      [
        "31d",
        "sync ในฟังก์ชันซ้อนที่ประกาศก่อน joinGroupBuy",
        `const Join = () => { const join = async () => {
           const prepare = async () => { await syncAffiliateBefore(cart, async () => null) }
           await joinGroupBuy(token, cart.id)
         } }`,
      ],
      [
        "31d",
        "sync ด้วย cart ที่ไม่มี metadata",
        `const Join = () => { const join = async () => {
           await syncAffiliateBefore({ id: cartId }, () => joinGroupBuy(token, cartId))
         } }`,
      ],
      [
        "31d",
        "sync ด้วย metadata: undefined",
        `const Join = () => { const join = async () => {
           await syncAffiliateBefore({ id: cartId, metadata: undefined }, async () => null)
           await joinGroupBuy(token, cartId)
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
        const showSharedQr = async () => {
          const current = await syncAffiliateBefore(cart, () => stripe.retrievePaymentIntent(clientSecret))
          await openQr(stripe, clientSecret, email, current.paymentIntent)
        }
        const onPaymentCompleted = async () => {
          await placeOrder(cart.id, cart.metadata ?? null)
        }
        const join = async () => {
          await syncAffiliateBefore(cart, () => joinGroupBuy(token, cart.id))
        }
        const joinAfter = async () => {
          await syncAffiliateBefore({ id: cart.id, metadata: cart.metadata }, async () => null)
          await joinGroupBuy(token, cart.id)
        }
      }`
      expect(scan(FILE, code).violations).toEqual([])
    })
  })
})
