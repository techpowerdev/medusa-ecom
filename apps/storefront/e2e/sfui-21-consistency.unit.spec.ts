import { expect, test } from "@playwright/test"
import ts from "typescript"

import { readSource, sourceFiles } from "./support/sfui-source"
import manifest from "./support/shadcn-ui.json"

// SFUI-21b (spec 09 กฎ 77, AC-65 (1) — owner: h1 ทุกหน้าขนาดเดียว): ทุก `<h1` ใน src/** (ไม่ใช่ test) ยกเว้น hero ของหน้าแรก
// มี typography เท่านี้ `text-3xl font-semibold tracking-tight` (+ สี/layout ภายนอกได้) — ไม่มี uppercase, text-[…], text-{xs…2xl}, leading-*,
// font-{normal,medium,bold,…}

const HERO = "src/modules/home/components/hero/index.tsx"
const REQUIRED = ["text-3xl", "font-semibold", "tracking-tight"]
const FORBIDDEN =
  /^(?:[a-z0-9-]+:)*(?:uppercase|lowercase|capitalize|text-\[.+\]|text-(?:xs|sm|base|lg|xl|2xl|[4-9]xl)|leading-.+|font-(?:thin|extralight|light|normal|medium|bold|extrabold|black)|tracking-(?!tight$).+)$/

/** token ทุกตัวใน literal ของ className (สตริง/template/cn(...)) */
function classTokens(attr: ts.JsxAttribute | undefined): string[] {
  if (!attr?.initializer) return []
  const out: string[] = []
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      out.push(...n.text.split(/\s+/).filter(Boolean))
    }
    n.forEachChild(visit)
  }
  visit(attr.initializer)
  return out
}

export function h1Violations(file: string, source: string): string[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out: string[] = []
  const visit = (n: ts.Node) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(sf) === "h1") {
      const className = n.attributes.properties.find(
        (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === "className"
      )
      const tokens = classTokens(className)
      const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
      const missing = REQUIRED.filter((t) => !tokens.includes(t))
      const bad = tokens.filter((t) => FORBIDDEN.test(t))
      if (missing.length || bad.length) out.push(`${line}: ขาด [${missing.join(" ")}] เกิน [${bad.join(" ")}]`)
    }
    n.forEachChild(visit)
  }
  visit(sf)
  return out
}

test("AC-65 (1): ตัวตรวจ h1 (positive/negative control)", () => {
  const bad = [
    'const a = <h1 className="text-[30px] leading-[48px] font-semibold">x</h1>',
    'const b = <h1 className="text-base leading-6 font-semibold uppercase">x</h1>',
    'const c = <h1 data-testid="t">x</h1>',
    'const d = <h1 className="text-3xl font-semibold tracking-tight md:text-2xl">x</h1>',
    'const e = <h1 className="text-3xl font-bold tracking-tight">x</h1>',
  ].join("\n")
  expect(h1Violations("bad.tsx", bad).map((v) => Number(v.split(":")[0]))).toEqual([1, 2, 3, 4, 5])
  const good = [
    'const a = <h1 className="text-3xl font-semibold tracking-tight">x</h1>',
    'const b = <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-6 break-words">x</h1>',
    'const c = <h1 className="flex flex-col gap-y-3 text-3xl font-semibold tracking-tight">x</h1>',
  ].join("\n")
  expect(h1Violations("good.tsx", good)).toEqual([])
})

test("AC-65 (1): ทุก <h1 ใน src/** (ยกเว้น hero) ใช้ text-3xl font-semibold tracking-tight เท่านั้น (กฎ 77)", () => {
  const files = sourceFiles().filter((f) => f.endsWith(".tsx") && f !== HERO)
  const found = files.flatMap((file) => h1Violations(file, readSource(file)).map((v) => `${file}:${v}`))
  const withH1 = files.filter((file) => readSource(file).includes("<h1"))
  expect(withH1.length, "จำนวนไฟล์ที่มี <h1 (นอก hero)").toBeGreaterThanOrEqual(27)
  expect(found).toEqual([])
})

// ---- SFUI-21a (spec 09 กฎ 73, 75, 76; AC-66 (1)) ----

/** ไฟล์ของตาราง inventory ข้อ 32 (ฟอร์มรอบ 48) — container ของช่องกรอกใช้ gap-4 */
const GAP_FILES = [
  "checkout/components/shipping-address/index.tsx",
  "checkout/components/billing_address/index.tsx",
  "account/components/address-card/add-address.tsx",
  "account/components/address-card/edit-address-modal.tsx",
  "account/components/profile-billing-address/index.tsx",
  "account/components/profile-name/index.tsx",
  "account/components/profile-phone/index.tsx",
  "account/components/profile-password/index.tsx",
  "account/components/login/index.tsx",
  "account/components/register/index.tsx",
  "checkout/components/discount-code/index.tsx",
  // SFUI-23 (กฎ 81, AC-72 (1)): ฟอร์ม login/สมัครของ affiliate (inventory 38) — ตกจากข้อ 32
  "affiliate/components/auth-forms/index.tsx",
].map((f) => `src/modules/${f}`)

/** ไฟล์ของตาราง inventory ข้อ 35 — ปุ่มปิด overlay */
const CLOSE_FILES = [
  "account/components/address-card/add-address.tsx",
  "account/components/address-card/edit-address-modal.tsx",
  "layout/components/side-menu/index.tsx",
  "layout/components/search/drawer.tsx",
  "products/components/product-actions/mobile-actions.tsx",
].map((f) => `src/modules/${f}`)

const BAD_GAP = /^(?:[a-z0-9-]+:)*(?:gap-2|gap-[xy]-.+)$/
const SIZE_TOKEN = /^(?:[a-z0-9-]+:|data-\[[^\]]+\]:)*(?:h-.+|min-h-.+|p[xytrbl]?-.+|text-(?:xs|sm|base|lg|\d*xl|\[.+\])|leading-.+)$/

const parseTsx = (file: string) => ts.createSourceFile(file, readSource(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const openingOf = (n: ts.Node) => (ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null)
const attrOf = (el: ts.JsxOpeningElement | ts.JsxSelfClosingElement, sf: ts.SourceFile, name: string) =>
  el.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === name)
const lineOf = (sf: ts.SourceFile, n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1

/** container (JSX element) ที่มีช่อง (`<Input`/`<Select`/`<Checkbox` — review 21a) อยู่ภายในและ className มี gap-2, gap-x-… หรือ gap-y-… */
export function fieldGapViolations(file: string, sf = parseTsx(file)): string[] {
  const out: string[] = []
  const visit = (n: ts.Node) => {
    const el = openingOf(n)
    if (el && ts.isJsxElement(n)) {
      const bad = classTokens(attrOf(el, sf, "className")).filter((t) => BAD_GAP.test(t))
      const hasInput = /<(?:Input|Select|Checkbox)\b/.test(n.getText(sf))
      if (bad.length && hasInput) out.push(`${file}:${lineOf(sf, n)} ${bad.join(" ")}`)
    }
    n.forEachChild(visit)
  }
  visit(sf)
  return out
}

test("AC-66 (1): container ของช่องในไฟล์ข้อ 32 ไม่มี gap-2/gap-x-*/gap-y-* (กฎ 73 — gap-4)", () => {
  const control = ts.createSourceFile(
    "c.tsx",
    [
      'const a = <div className="grid gap-x-4 gap-y-2"><Input /></div>',
      'const b = <div className="grid gap-4"><Input /></div>',
      'const c = <div className="flex gap-x-2"><Button /></div>',
      'const d = <div className="flex flex-col gap-y-2"><Select name="x" /></div>',
      'const e = <div className="flex gap-2"><Checkbox id="x" /></div>',
    ].join("\n"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  expect(fieldGapViolations("c.tsx", control)).toEqual(["c.tsx:1 gap-x-4 gap-y-2", "c.tsx:4 gap-y-2", "c.tsx:5 gap-2"])
  expect(GAP_FILES.flatMap((f) => fieldGapViolations(f))).toEqual([])
})

test("AC-66 (1): SelectTrigger ใน src/modules/** ไม่มี className ขนาด (กฎ 75)", () => {
  const found: string[] = []
  for (const file of sourceFiles().filter((f) => f.startsWith("src/modules/") && f.endsWith(".tsx"))) {
    const sf = parseTsx(file)
    const visit = (n: ts.Node) => {
      const el = openingOf(n)
      if (el && el.tagName.getText(sf) === "SelectTrigger") {
        const bad = classTokens(attrOf(el, sf, "className")).filter((t) => SIZE_TOKEN.test(t))
        if (bad.length) found.push(`${file}:${lineOf(sf, n)} ${bad.join(" ")}`)
      }
      n.forEachChild(visit)
    }
    visit(sf)
  }
  expect(found).toEqual([])
})

test("AC-66 (1): ปุ่มปิด overlay ในไฟล์ข้อ 35 = DialogClose/SheetClose asChild → Button ghost icon (กฎ 76)", () => {
  const found: string[] = []
  let closes = 0
  for (const file of CLOSE_FILES) {
    const sf = parseTsx(file)
    const visit = (n: ts.Node) => {
      const el = openingOf(n)
      if (el && /^(Dialog|Sheet)Close$/.test(el.tagName.getText(sf))) {
        closes++
        const child = ts.isJsxElement(n) ? n.children.map(openingOf).find(Boolean) : null
        const ok =
          !!attrOf(el, sf, "asChild") &&
          !!child &&
          child.tagName.getText(sf) === "Button" &&
          attrOf(child, sf, "variant")?.initializer?.getText(sf) === '"ghost"' &&
          attrOf(child, sf, "size")?.initializer?.getText(sf) === '"icon"' &&
          !!attrOf(child, sf, "aria-label")
        if (!ok) found.push(`${file}:${lineOf(sf, n)}`)
      }
      n.forEachChild(visit)
    }
    visit(sf)
  }
  expect(closes, "ปุ่มปิดในไฟล์ข้อ 35").toBe(5)
  expect(found).toEqual([])
})

// ---- SFUI-21c (spec 09 กฎ 80; AC-69 (1) — owner Q-R50-1: การ์ดตัวเลือกจัดส่ง/ชำระเงิน = Choice Card ของ shadcn) ----

const SHIPPING = "src/modules/checkout/components/shipping/index.tsx"
const PAYMENT_CONTAINER = "src/modules/checkout/components/payment-container/index.tsx"

/** `RadioGroupItem` ที่ parent (JSX element) ไม่ใช่ `Field orientation="horizontal"` ใน `FieldLabel` หรือมี className */
export function choiceCardViolations(file: string, sf = parseTsx(file)): { count: number; bad: string[] } {
  const bad: string[] = []
  let count = 0
  const parentElement = (n: ts.Node) => {
    let p = n.parent
    while (p && !ts.isJsxElement(p)) p = p.parent
    return p as ts.JsxElement | undefined
  }
  const visit = (n: ts.Node) => {
    const el = openingOf(n)
    if (el && el.tagName.getText(sf) === "RadioGroupItem") {
      count++
      const field = parentElement(n)
      const label = field && parentElement(field)
      const ok =
        !attrOf(el, sf, "className") &&
        field?.openingElement.tagName.getText(sf) === "Field" &&
        attrOf(field.openingElement, sf, "orientation")?.initializer?.getText(sf) === '"horizontal"' &&
        label?.openingElement.tagName.getText(sf) === "FieldLabel" &&
        !!attrOf(label.openingElement, sf, "htmlFor")
      if (!ok) bad.push(`${file}:${lineOf(sf, n)}`)
    }
    n.forEachChild(visit)
  }
  visit(sf)
  return { count, bad }
}

test("AC-69 (1): ตัวตรวจ Choice Card (positive/negative control)", () => {
  const src = (code: string) => ts.createSourceFile("c.tsx", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const good = src('const a = <FieldLabel htmlFor="x"><Field orientation="horizontal"><FieldContent /><RadioGroupItem value="x" id="x" /></Field></FieldLabel>')
  expect(choiceCardViolations("c.tsx", good)).toEqual({ count: 1, bad: [] })
  const bad = src(
    [
      'const a = <RadioGroupItem value="x" className="w-full" />',
      'const b = <FieldLabel htmlFor="x"><Field><RadioGroupItem value="x" id="x" /></Field></FieldLabel>',
      'const c = <FieldLabel htmlFor="x"><Field orientation="horizontal"><RadioGroupItem value="x" id="x" className="border-0" /></Field></FieldLabel>',
      'const d = <div><Field orientation="horizontal"><RadioGroupItem value="x" id="x" /></Field></div>',
    ].join("\n")
  )
  expect(choiceCardViolations("c.tsx", bad).bad).toEqual(["c.tsx:1", "c.tsx:2", "c.tsx:3", "c.tsx:4"])
})

test("AC-69 (1): shipping ไม่มี OPTION_CLASS, payment-container ไม่มี OptionDot/การซ่อน indicator (กฎ 80)", () => {
  expect(readSource(SHIPPING)).not.toContain("OPTION_CLASS")
  for (const file of [SHIPPING, PAYMENT_CONTAINER]) {
    expect(readSource(file), file).not.toMatch(/import OptionDot|option-dot/)
    expect(readSource(file), file).not.toContain("radio-group-indicator]:hidden")
  }
})

test("AC-69 (1): ทุก RadioGroupItem ในสองไฟล์อยู่ใน FieldLabel → Field orientation=horizontal และไม่มี className (กฎ 80)", () => {
  const shipping = choiceCardViolations(SHIPPING)
  const payment = choiceCardViolations(PAYMENT_CONTAINER)
  expect(shipping.count, "RadioGroupItem ใน shipping (pickup toggle, จัดส่ง, สาขา)").toBe(3)
  expect(payment.count, "RadioGroupItem ใน payment-container").toBe(1)
  expect([...shipping.bad, ...payment.bad]).toEqual([])
})

// ---- SFUI-21d (spec 09 กฎ 64, 74; AC-70 (1) — owner Q-R50-2 ทาง (ข): error ระดับฟอร์ม = Alert, inline = FieldError) ----

const M = (f: string) => `src/modules/${f}`
const ERROR_MESSAGE = M("checkout/components/error-message/index.tsx")

/** แบบ (a) ของ 21d ในตารางกฎ 74c: testid → ไฟล์ (testid อยู่บน `<ErrorMessage`) — `stripe-/manual-payment-error-message` ส่งผ่าน `errorTestId` ของ PlaceOrderNotice */
const ALERT_21D: [string, string[]][] = [
  ["login-error-message", ["account/components/login/index.tsx"]],
  ["register-error", ["account/components/register/index.tsx"]],
  ["register-email-exists", ["account/components/register/index.tsx"]],
  ["affiliate-login-error", ["affiliate/components/auth-forms/index.tsx"]],
  ["affiliate-register-error", ["affiliate/components/auth-forms/index.tsx"]],
  ["address-error-message", ["checkout/components/addresses/index.tsx"]],
  ["address-error", ["account/components/address-card/add-address.tsx", "account/components/address-card/edit-address-modal.tsx"]],
  ["promotion-error", ["checkout/components/discount-code/index.tsx"]],
  ["delivery-option-error-message", ["checkout/components/shipping/index.tsx"]],
  ["payment-method-error-message", ["checkout/components/payment/index.tsx"]],
  ["payment-session-pending-error", ["checkout/components/payment/index.tsx"]],
  ["promptpay-payment-error-message", ["checkout/components/promptpay-payment/index.tsx", "order/components/order-pay/pay-buttons.tsx"]],
  ["order-pay-error", ["order/components/order-pay/index.tsx"]],
  ["order-pay-element-error", ["order/components/order-pay/index.tsx"]],
  ["order-pay-card-error", ["order/components/order-pay/pay-buttons.tsx"]],
  ["return-error", ["returns/components/return-request-form/index.tsx"]],
  ["return-contact-store", ["returns/components/return-request-form/index.tsx"]],
  ["group-join-error", ["group-buy/components/group-page/group-join.tsx"]],
  ["review-flash-exceeds-customer-limit", ["checkout/components/review/index.tsx"]],
  ["add-variant-error", ["account/components/add-variant-error/index.tsx"]],
]
/** แบบ (b) ของ 21d: testid อยู่บน `<FieldError` */
const INLINE_21D: [string, string][] = [
  ["group-units-limit", "group-buy/components/group-page/group-join.tsx"],
  ["product-error-message", "cart/components/item/index.tsx"],
  ["cart-item-remove-error", "common/components/delete-button/index.tsx"],
]

/** tag ของทุก JSX element ที่มี `data-testid="<testid>"` (string literal) ในไฟล์ */
export function tagsWithTestId(file: string, testId: string, sf = parseTsx(file)): string[] {
  const out: string[] = []
  const visit = (n: ts.Node) => {
    const el = openingOf(n)
    const init = el && attrOf(el, sf, "data-testid")?.initializer
    if (el && init && ts.isStringLiteral(init) && init.text === testId) out.push(el.tagName.getText(sf))
    n.forEachChild(visit)
  }
  visit(sf)
  return out
}

test("AC-70 (1): ตัวหา tag ของ testid (positive/negative control)", () => {
  const sf = ts.createSourceFile(
    "c.tsx",
    'const a = <><ErrorMessage data-testid="x" /><p data-testid="x">e</p><FieldError data-testid="y">e</FieldError></>',
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  expect(tagsWithTestId("c.tsx", "x", sf)).toEqual(["ErrorMessage", "p"])
  expect(tagsWithTestId("c.tsx", "y", sf)).toEqual(["FieldError"])
})

test("AC-70 (1): alert ของ CLI อยู่ใน shadcn-ui.json, ไม่มี text-rose- ใน src/**, ErrorMessage = Alert destructive + AlertDescription (กฎ 64, 74)", () => {
  expect(Object.keys(manifest.files)).toContain("alert.tsx")
  expect(sourceFiles().filter((f) => readSource(f).includes("text-rose-"))).toEqual([])
  const src = readSource(ERROR_MESSAGE)
  expect(src).toMatch(/<Alert\s[^>]*variant="destructive"/)
  expect(src).toContain("<AlertDescription")
  expect(src).not.toContain("<AlertTitle")
})

test("AC-70 (1): testid แบบ (a) ของ 21d อยู่บน <ErrorMessage, แบบ (b) อยู่บน <FieldError, cart item ไม่ import ErrorMessage (กฎ 74)", () => {
  const bad: string[] = []
  for (const [id, files] of ALERT_21D) {
    for (const f of files) {
      const tags = tagsWithTestId(M(f), id)
      if (!tags.length || tags.some((t) => t !== "ErrorMessage")) bad.push(`${id} @ ${f}: [${tags.join(", ")}]`)
    }
  }
  for (const [id, f] of INLINE_21D) {
    const tags = tagsWithTestId(M(f), id)
    if (!tags.length || tags.some((t) => t !== "FieldError")) bad.push(`${id} @ ${f}: [${tags.join(", ")}]`)
  }
  // account-info: wrapper `error-message` (transition) ครอบ ErrorMessage ที่ไม่ส่ง testid
  const info = readSource(M("account/components/account-info/index.tsx"))
  if (!/data-testid="error-message"[^]*?<ErrorMessage error=/.test(info) || info.includes('variant="destructive"')) bad.push("error-message @ account-info")
  expect(bad).toEqual([])
  expect(readSource(M("cart/components/item/index.tsx"))).not.toContain("checkout/components/error-message")
})

// ---- SFUI-21e (spec 09 กฎ 74; AC-71 (1) — error ของการกระทำ/ข้อความผูกตัวเลือกนอก checkout) ----

/** แบบ (a) ของ 21e: testid → ไฟล์ (บน `<ErrorMessage`) */
const ALERT_21E: [string, string][] = [
  ["add-to-cart-error", "products/components/product-actions/index.tsx"],
  ["mobile-add-to-cart-error", "products/components/product-actions/mobile-actions.tsx"],
  ["group-create-team-error", "home/components/campaigns/create-team-button.tsx"],
]
/** แบบ (b) ของ 21e: testid → ไฟล์ (บน `<FieldError`) */
const INLINE_21E: [string, string][] = [
  ["flash-qty-exceeds-remaining", "products/components/flash-sale/qty-exceeds-remaining.tsx"],
  ["flash-customer-limit-reached", "products/components/flash-sale/customer-limit.tsx"],
  ["cart-flash-exceeds-remaining", "cart/components/flash-exceeds-remaining/index.tsx"],
  ["cart-flash-exceeds-customer-limit", "cart/components/flash-exceeds-remaining/index.tsx"],
  ["group-leave-error", "group-buy/components/account-group-orders/leave-button.tsx"],
]
/** แถว "ไม่รวม" ของตารางกฎ 74c ที่มี `text-destructive` ได้ (ข้อความแทนเนื้อหา/ป้ายสถานะ) */
const DESTRUCTIVE_EXCLUDED = new Set([
  "products-error",
  "search-drawer-error",
  "nav-cart-dropdown-error",
  "group-orders-error",
  "affiliate-portal-error",
  "verify-account-error",
  "flash-sold-out",
  "flash-card-sold-out",
])

/** JSX element ที่ className มี `text-destructive` และมี data-testid ที่ไม่อยู่ใน `allowed` (testid ที่ไม่ใช่ string literal นับว่าผิด) */
export function destructiveTestIdViolations(file: string, allowed: Set<string>, sf = parseTsx(file)): string[] {
  const out: string[] = []
  const visit = (n: ts.Node) => {
    const el = openingOf(n)
    const testId = el && attrOf(el, sf, "data-testid")
    if (el && testId && classTokens(attrOf(el, sf, "className")).some((t) => /(^|:)text-destructive$/.test(t))) {
      const init = testId.initializer
      const id = init && ts.isStringLiteral(init) ? init.text : null
      if (!id || !allowed.has(id)) out.push(`${file}:${lineOf(sf, n)} ${id ?? testId.getText(sf)}`)
    }
    n.forEachChild(visit)
  }
  visit(sf)
  return out
}

test("AC-71 (1): ตัวตรวจ text-destructive + testid (positive/negative control)", () => {
  const sf = ts.createSourceFile(
    "c.tsx",
    'const a = <><p className="text-xs text-destructive" data-testid="x">e</p><p className="text-destructive" data-testid="ok">e</p><span className="text-destructive">*</span></>',
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  expect(destructiveTestIdViolations("c.tsx", new Set(["ok"]), sf)).toEqual(["c.tsx:1 x"])
})

test("AC-71 (1): testid แบบ (a) ของ 21e บน <ErrorMessage, cart-error-notice บน <Alert ไม่ destructive, แบบ (b) บน <FieldError (กฎ 74)", () => {
  const bad: string[] = []
  for (const [id, f] of ALERT_21E) {
    const tags = tagsWithTestId(M(f), id)
    if (!tags.length || tags.some((t) => t !== "ErrorMessage")) bad.push(`${id} @ ${f}: [${tags.join(", ")}]`)
  }
  for (const [id, f] of INLINE_21E) {
    const tags = tagsWithTestId(M(f), id)
    if (!tags.length || tags.some((t) => t !== "FieldError")) bad.push(`${id} @ ${f}: [${tags.join(", ")}]`)
  }
  const notice = M("cart/components/cart-error-notice/index.tsx")
  const tags = tagsWithTestId(notice, "cart-error-notice")
  if (tags.join() !== "Alert" || readSource(notice).includes('variant="destructive"')) bad.push(`cart-error-notice: [${tags.join(", ")}]`)
  expect(bad).toEqual([])
})

test("AC-71 (1): ไม่มี element ที่มีทั้ง text-destructive และ data-testid นอกแถว 'ไม่รวม' ของกฎ 74c", () => {
  const files = sourceFiles().filter((f) => /^src\/(modules|app)\//.test(f) && f.endsWith(".tsx"))
  expect(files.flatMap((f) => destructiveTestIdViolations(f, DESTRUCTIVE_EXCLUDED))).toEqual([])
})

// ---- SFUI-22 (spec 09 กฎ 79; AC-67 (1) — ปิดรอบ 50): ไม่มี JSX `<button` ดิบใน src/modules/**, src/app/** นอก allow-list ----

/** allow-list ของกฎ 79: ไฟล์ → testid ของ `<button` ดิบ + เหตุผล (เพิ่มเองไม่ได้ — เจอนอกรายการ = หยุดแจ้ง planner) */
const RAW_BUTTON_ALLOWED: { file: string; testId: string; reason: string }[] = [
  {
    file: "src/modules/account/components/address-card/add-address.tsx",
    testId: "add-address-button",
    reason: "การ์ดเพิ่มที่อยู่ (DialogTrigger asChild) สูงเท่าการ์ดที่อยู่ — อยู่ในรายการปิดของกฎ 79 ที่ไม่อยู่ใต้กฎขนาดปุ่ม",
  },
]

/** `<button` (JSX intrinsic) ทุกตัวในไฟล์ → `<file>:<line> <testid|->` */
export function rawButtons(file: string, sf = parseTsx(file)): string[] {
  const out: string[] = []
  const visit = (n: ts.Node) => {
    const el = openingOf(n)
    if (el && el.tagName.getText(sf) === "button") {
      const init = attrOf(el, sf, "data-testid")?.initializer
      out.push(`${file}:${lineOf(sf, n)} ${init && ts.isStringLiteral(init) ? init.text : "-"}`)
    }
    n.forEachChild(visit)
  }
  visit(sf)
  return out
}

test("AC-67 (1): ตัวหา <button ดิบ (positive/negative control)", () => {
  const sf = ts.createSourceFile(
    "c.tsx",
    'const a = <><button data-testid="x">a</button>\n<Button data-testid="y" />\n<button type="button" /><ButtonGroup /></>',
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  expect(rawButtons("c.tsx", sf)).toEqual(["c.tsx:1 x", "c.tsx:3 -"])
})

test("AC-67 (1): ไม่มี JSX <button ดิบใน src/modules/**, src/app/** นอก allow-list ของกฎ 79", () => {
  const files = sourceFiles().filter((f) => /^src\/(modules|app)\//.test(f) && f.endsWith(".tsx"))
  const allowed = new Set(RAW_BUTTON_ALLOWED.map((a) => `${a.file} ${a.testId}`))
  const found = files.flatMap((f) => rawButtons(f)).filter((hit) => !allowed.has(hit.replace(/:\d+ /, " ")))
  expect(found).toEqual([])
  // ทุกรายการใน allow-list ยังมีอยู่จริง (ลบปุ่มแล้วต้องลบรายการ)
  for (const a of RAW_BUTTON_ALLOWED) {
    expect(rawButtons(a.file).map((hit) => hit.replace(/:\d+ /, " ")), `${a.file} ${a.testId}`).toContain(`${a.file} ${a.testId}`)
  }
})

// ---- SFUI-23 (spec 09 กฎ 83, 84; AC-73 (static), AC-74 (static)) ----

const NUDGE = M("shipping/components/free-shipping-price-nudge/index.tsx")

/** JSX element ที่มี `data-testid="<testId>"` (string literal) ทุกตัวในไฟล์ */
function elementsWithTestId(file: string, testId: string, sf = parseTsx(file)) {
  const out: { el: ts.JsxOpeningElement | ts.JsxSelfClosingElement; node: ts.Node }[] = []
  const visit = (n: ts.Node) => {
    const el = openingOf(n)
    const init = el && attrOf(el, sf, "data-testid")?.initializer
    if (el && init && ts.isStringLiteral(init) && init.text === testId) out.push({ el, node: n })
    n.forEachChild(visit)
  }
  visit(sf)
  return { sf, out }
}

test("AC-73 (static): ลิงก์ในกล่องส่งฟรี = Button asChild (ghost/secondary, size default) ครอบ LocalizedClientLink ไม่มี className ทับ (กฎ 83)", () => {
  const want: [string, string, string[], string][] = [
    ["free-shipping-nudge-cart-link", '"ghost"', [], '"/cart"'],
    ["free-shipping-nudge-store-link", '"secondary"', ["grow"], '"/store"'],
  ]
  for (const [id, variant, classes, href] of want) {
    const { sf, out } = elementsWithTestId(NUDGE, id)
    expect(out.length, id).toBe(1)
    const { el, node } = out[0]
    expect(el.tagName.getText(sf), id).toBe("Button")
    expect(!!attrOf(el, sf, "asChild"), `${id} asChild`).toBe(true)
    expect(attrOf(el, sf, "variant")?.initializer?.getText(sf), `${id} variant`).toBe(variant)
    expect(attrOf(el, sf, "size"), `${id} size (default)`).toBeUndefined()
    expect(classTokens(attrOf(el, sf, "className")), `${id} className`).toEqual(classes)
    const child = ts.isJsxElement(node) ? node.children.map(openingOf).find(Boolean) : null
    expect(child?.tagName.getText(sf), `${id} child`).toBe("LocalizedClientLink")
    expect(attrOf(child!, sf, "href")?.initializer?.getText(sf), `${id} href`).toBe(href)
    expect(attrOf(child!, sf, "className"), `${id} child className`).toBeUndefined()
  }
  const src = readSource(NUDGE)
  expect(src).not.toContain("outline-hidden")
  expect(src).not.toContain("rounded-2xl")
})

/** ตารางกฎ 84 (รายการปิด): testid → [ไฟล์, จำนวน element, token margin] */
const NEGATIVE_MARGIN: [string, string, number, string][] = [
  ["logout-button", "account/components/account-nav/index.tsx", 2, "-ml-4"],
  ["add-discount-button", "checkout/components/discount-code/index.tsx", 1, "-ml-4"],
  ["register-login-link", "account/components/register/index.tsx", 1, "-ml-4"],
  ["edit-address-button", "checkout/components/addresses/index.tsx", 1, "-mr-4"],
  ["edit-delivery-button", "checkout/components/shipping/index.tsx", 1, "-mr-4"],
  ["edit-payment-button", "checkout/components/payment/index.tsx", 1, "-mr-4"],
]

test("AC-74 (static): className ของปุ่มในตารางกฎ 84 = token margin ของแถวนั้นพอดี (ไม่มี token อื่น)", () => {
  const bad: string[] = []
  for (const [id, f, count, token] of NEGATIVE_MARGIN) {
    const { sf, out } = elementsWithTestId(M(f), id)
    if (out.length !== count) bad.push(`${id} @ ${f}: พบ ${out.length} ตัว (คาด ${count})`)
    for (const { el } of out) {
      const tokens = classTokens(attrOf(el, sf, "className"))
      if (el.tagName.getText(sf) !== "Button" || tokens.join(" ") !== token) bad.push(`${id} @ ${f}:${lineOf(sf, el)} [${tokens.join(" ")}]`)
    }
  }
  expect(bad).toEqual([])
})
