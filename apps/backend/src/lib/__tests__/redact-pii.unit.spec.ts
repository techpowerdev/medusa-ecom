import { Writable } from "stream"
import { inspect } from "util"
import { KEY_VALUE, redactPii, redactValue } from "../redact-pii"
import { buildJsonLogger } from "../json-logger"

// OPS-33 (spec 07 กฎข้อ 15 รอบ 41, AC-48 a/c): log ของ prod ต้องไม่มี PII ของลูกค้า แต่ id/จำนวนเงินยังอยู่ครบ

const PAYMENT_ID = "pay_01M70812345678XYZ"
const CART_ID = "cart_01JX0912345678ABCD"
const INTENT_ID = "pi_3Q0812345678"
const PM_ID = "pm_1Q66812345678"

const billing = {
  id: PM_ID,
  object: "payment_method",
  billing_details: {
    address: {
      city: "Khlong Toei",
      country: "TH",
      line1: "99/1 Sukhumvit Soi 4",
      line2: "Floor 7",
      postal_code: "10110",
      state: "Bangkok",
    },
    email: "somchai.jaidee@example.co.th",
    name: "Somchai Jaidee",
    phone: "+66812345678",
  },
}
// บรรทัดจริงจาก integration ของ OPS-32 (complete-after-payment-log.spec.ts / docs/evidence/ops/OPS-32-tests.txt)
// พร้อม billing_details ที่ Stripe ส่งกลับเมื่อลูกค้ากรอกครบ
const RECREATE_LINE =
  "Encountered an error when trying to recreate a payment session - [object Object] - Error: An error occurred in " +
  `InitiatePayment during creation of stripe payment intent: Invalid string: ${JSON.stringify(billing)}.`

const PII = [
  "Somchai",
  "Jaidee",
  "somchai.jaidee@example.co.th",
  "+66812345678",
  "99/1 Sukhumvit Soi 4",
  "Floor 7",
  "Khlong Toei",
  "Bangkok",
  "10110",
]

describe("redactPii (OPS-33, AC-48a)", () => {
  it("บรรทัด recreate a payment session → ไม่มีชื่อ/อีเมล/เบอร์/ที่อยู่เหลือ แต่ id ยังอยู่ครบ", () => {
    const line = `${RECREATE_LINE} cart_id=${CART_ID} payment_id=${PAYMENT_ID} intent=${INTENT_ID}`
    const out = redactPii(line)

    for (const value of PII) {
      expect(out).not.toContain(value)
    }
    for (const id of [PAYMENT_ID, CART_ID, INTENT_ID, PM_ID]) {
      expect(out).toContain(id)
    }
    expect(out).toContain('"name":"[REDACTED]"')
    expect(out).toContain('"country":"TH"')
    expect(out).toContain("Encountered an error when trying to recreate a payment session")
  })

  it("อีเมลทุกที่ในข้อความ (ไม่ต้องมี key)", () => {
    expect(redactPii("customer Somchai.J+tag@mail.example.com failed")).toBe("customer [REDACTED] failed")
  })

  it("ค่าของ key ในรูป JS object (util.inspect) และ Ruby hash", () => {
    expect(redactPii("{ first_name: 'Somchai', last_name: 'Jaidee', company: 'ACME', address_1: '1 Rd', province: 'BKK', id: 'addr_1' }")).toBe(
      "{ first_name: '[REDACTED]', last_name: '[REDACTED]', company: '[REDACTED]', address_1: '[REDACTED]', province: '[REDACTED]', id: 'addr_1' }"
    )
    expect(redactPii('{"name"=>"Somchai Jaidee", "address_2" => "Floor 7", "object"=>"payment_method"}')).toBe(
      '{"name"=>"[REDACTED]", "address_2" => "[REDACTED]", "object"=>"payment_method"}'
    )
    expect(redactPii('{"name":"O\\"Brien","phone":null}')).toBe('{"name":"[REDACTED]","phone":null}')
  })

  it("key ที่ลงท้ายเหมือนกันแต่ไม่อยู่ในรายการไม่ถูกแตะ", () => {
    expect(redactPii('{"product_name":"T-Shirt","cityscape":"x"}')).toBe('{"product_name":"T-Shirt","cityscape":"x"}')
  })

  it.each([
    ["0812345678", "โทร 0812345678 แล้ว", "โทร [REDACTED] แล้ว"],
    ["021234567", "tel=021234567", "tel=[REDACTED]"],
    ["+66812345678", "(+66812345678)", "([REDACTED])"],
    ["ต้นสตริง", "0899999999", "[REDACTED]"],
  ])("เบอร์โทรไทยที่มีขอบเขต (%s)", (_name, input, expected) => {
    expect(redactPii(input)).toBe(expected)
  })

  it("เลขกลาง ULID/id และตัวเลขที่ไม่ใช่เบอร์ไม่ถูกตัด", () => {
    const text =
      `${PAYMENT_ID} ${CART_ID} ${INTENT_ID} order_01K0812345678Z amount=1999 raw_amount 0.15 ` +
      "request_id=0b7c1e2a-0812-4a5b-9c3d-012345678901 2026-11-21 11:24:37 08123456789012"
    expect(redactPii(text)).toBe(text)
  })

  // review #473: จำนวนเงิน BigNumber (raw_amount precision 20) และชื่อไฟล์ต้องไม่ถูกแตะ
  it("ทศนิยมยาวและชื่อไฟล์ที่มี @ ไม่ถูกตัด", () => {
    const text = "raw_amount 0.0812345678 rate=1.0666666667 icon image@2x.png logo@3x.webp"
    expect(redactPii(text)).toBe(text)
  })

  it("key PII ไม่สนตัวพิมพ์ และค่าที่เป็นตัวเลขใต้ key PII ถูก redact", () => {
    expect(redactPii(`{"Email":"x","Name":"Somchai","postal_code":10110, phone: 812345678, amount: 1999}`)).toBe(
      `{"Email":"[REDACTED]","Name":"[REDACTED]","postal_code":[REDACTED], phone: [REDACTED], amount: 1999}`
    )
  })

  // OPS-35 (spec 07 กฎข้อ 17a รอบ 42, AC-50): ช่องว่างที่ review #473 พบ
  it("ค่าในเครื่องหมาย backtick ของ util.inspect (สตริงที่มีทั้ง ' และ \")", () => {
    const out = redactPii("{ email: `a.b@x.co`, name: `O'Brien \"Bob\"`, company: `ACME`, id: `cus_01K08`, total: 1999 }")
    for (const value of ["a.b@x.co", "O'Brien", "Bob", "ACME"]) {
      expect(out).not.toContain(value)
    }
    expect(out).toBe("{ email: `[REDACTED]`, name: `[REDACTED]`, company: `[REDACTED]`, id: `cus_01K08`, total: 1999 }")
  })

  it("JSON ที่ escape ซ้อน (JSON อยู่ในสตริงของ JSON อีกชั้น)", () => {
    const inner = JSON.stringify({ email: "somchai.jaidee@example.co.th", name: "Somchai Jaidee", phone: "+66812345678", id: CART_ID })
    const once = JSON.stringify({ message: inner })
    const twice = JSON.stringify({ message: once })
    for (const text of [once, twice]) {
      const out = redactPii(text)
      for (const value of ["somchai", "Somchai", "Jaidee", "+66812345678"]) {
        expect(out).not.toContain(value)
      }
      expect(out).toContain(CART_ID)
      // ผลยังเป็น JSON ที่ parse ได้ (quote ที่ escape ถูกคงไว้ครบคู่)
      expect(() => JSON.parse(out)).not.toThrow()
    }
    expect(redactPii(once)).toContain('\\"name\\":\\"[REDACTED]\\"')
    expect(redactPii('{\\"name\\":\\"O\\\\\\"Brien\\",\\"state\\":\\"Bangkok\\"}')).toBe(
      '{\\"name\\":\\"[REDACTED]\\",\\"state\\":\\"[REDACTED]\\"}'
    )
  })

  // OPS-36 (spec 07 กฎข้อ 18 รอบ 43, AC-51): review #536
  const nest = (value: unknown, levels: number): string => {
    let text = JSON.stringify(value)
    for (let i = 0; i < levels; i++) {
      text = JSON.stringify({ m: text })
    }
    return text
  }
  const unnest = (text: string, levels: number): unknown => {
    let value = JSON.parse(text)
    for (let i = 0; i < levels; i++) {
      value = JSON.parse(value.m)
    }
    return value
  }

  it("ค่า email ลงท้ายด้วย backslash ใน JSON escape ซ้อน ไม่ทำให้ city ถัดไปหลุด (เคส review #536)", () => {
    const text = JSON.stringify({ m: JSON.stringify({ email: "Som\\", city: "Bangkok", id: "cart_123" }) })
    const out = redactPii(text)

    expect(out).not.toContain("Som")
    expect(out).not.toContain("Bangkok")
    expect(unnest(out, 1)).toEqual({ email: "[REDACTED]", city: "[REDACTED]", id: "cart_123" })
  })

  it.each([0, 1, 2, 3])("escape %i ชั้น: ค่าที่ลงท้าย/มี backslash และ quote ถูก redact ครบ ทุก key ถัดไปด้วย", (levels) => {
    const value = {
      name: "Som\\",
      first_name: 'O"Brien\\\\',
      last_name: '\\"',
      city: "Bangkok",
      address_1: "99/1\nSukhumvit",
      id: CART_ID,
      amount: 1999,
    }
    const out = redactPii(nest(value, levels))

    for (const pii of ["Som", "Brien", "Bangkok", "Sukhumvit"]) {
      expect(out).not.toContain(pii)
    }
    expect(unnest(out, levels)).toEqual({
      name: "[REDACTED]",
      first_name: "[REDACTED]",
      last_name: "[REDACTED]",
      city: "[REDACTED]",
      address_1: "[REDACTED]",
      id: CART_ID,
      amount: 1999,
    })
  })

  it("escape ≥ 4 ชั้นไม่ redact ค่าของ key (ยอมรับตามกฎข้อ 18b รอบ 43) และไม่ทำให้ข้อความเสีย", () => {
    const text = nest({ name: "Somchai", id: CART_ID }, 4)
    expect(redactPii(text)).toBe(text)
  })

  it("สตริงหลายท่อนของ util.inspect (address_1 ที่มี \\n) ถูก redact ทุกท่อน", () => {
    const text = inspect({
      address_1: "99/1 Sukhumvit Soi 4 Khlong Toei Khlong Toei Thailand long text here 1234567890 abcdefghijklmnop\nSomchai Jaidee\nit's line",
      city: "Bangkok",
      id: CART_ID,
      amount: 1999,
    })
    expect(text).toContain("' +\n") // ยืนยันว่า util.inspect ตัดเป็นหลายท่อนจริง
    const out = redactPii(text)

    for (const pii of ["Sukhumvit", "Somchai", "Jaidee", "it's", "Bangkok"]) {
      expect(out).not.toContain(pii)
    }
    expect(out).toBe(`{\n  address_1: '[REDACTED]',\n  city: '[REDACTED]',\n  id: '${CART_ID}',\n  amount: 1999\n}`)
  })

  // review #554 (blocker): ผล util.inspect หลายท่อนที่ถูก JSON.stringify ซ้อน 1–3 ชั้น (เช่น `Invalid string: {…}` ของ OPS-32 ใน JSON log)
  // newline ระหว่างท่อนกลายเป็น `\n` ที่ escape และท่อนที่ใช้ `"` กลายเป็น `\"…\"`
  it.each([1, 2, 3])("สตริงหลายท่อนของ util.inspect ใน JSON escape %i ชั้น ถูก redact ทุกท่อน", (levels) => {
    const inspected =
      "Invalid string: " +
      inspect(
        {
          billing_details: { address: { line1: `${"y".repeat(80)}\nSomchai`, city: "BKK" } },
          address_1: `${"x".repeat(80)}\nit's Sukhumvit\nJaidee`,
          address_2: `it's ${"z".repeat(80)}\nKhlong Toei\nToei's "Soi" 4`,
          id: CART_ID,
          amount: 1999,
        },
        { depth: 5 }
      )
    expect(inspected).toContain(`\n    "it's Sukhumvit\\n"`) // มีท่อนที่ใช้ " จริง
    expect(inspected).toContain(`address_2: "it's`) // ท่อนแรกใช้ " ได้ด้วย
    const out = redactPii(nest({ msg: inspected }, levels - 1))

    for (const pii of ["Somchai", "BKK", "Sukhumvit", "Jaidee", "Khlong", "Toei", "Soi"]) {
      expect(out).not.toContain(pii)
    }
    const msg = (unnest(out, levels - 1) as { msg: string }).msg
    expect(msg).toContain(`id: '${CART_ID}'`)
    expect(msg).toContain("amount: 1999")
  })

  it.each([
    ["ข้อความธรรมดา", "refund for o'brien@example.com done", "refund for [REDACTED] done"],
    ["ใน quote เดี่ยว", "to: 'o'brien@example.com'", "to: '[REDACTED]'"],
    ["ใน quote คู่", 'to: "o\'brien@example.com"', 'to: "[REDACTED]"'],
  ])("อีเมลที่ local part มี ' (%s) ไม่เหลือ o'", (_name, input, expected) => {
    const out = redactPii(input)
    expect(out).not.toContain("o'")
    expect(out).not.toContain("brien")
    expect(out).toBe(expected)
  })

  // review #473 (blocker): EMAIL เดิม backtrack แบบ O(n²) กับช่วง [A-Za-z0-9._%+-] ยาว → block event loop ทุกบรรทัด log
  // (errorHandler ของ Medusa log `req.path` ของ client ที่ไม่ login ได้) — วัดขนาดงาน ไม่ใช่ timeout เข้มงวด
  it.each([
    ["a ติดกัน 100k ตัว", "a".repeat(100_000)],
    ["404 ของ id ยาว", `Error 404 at /store/products/prod_${"A".repeat(16_000)}: Product with id: prod_${"A".repeat(16_000)} was not found`],
    ["จุดและขีดติดกัน 100k ตัว", "a.b-".repeat(25_000)],
    // OPS-35: local part ที่มี ' และ backslash ยาว (JSON escape ซ้อน) ต้องยัง linear
    ["a' ติดกัน 100k ตัว", "a'".repeat(50_000)],
    ["backslash 100k ตัว", "\\".repeat(100_000)],
    ["escape quote ไม่ปิด", `\\"name\\":\\"${"x\\\\".repeat(25_000)}`],
    // OPS-36: backslash + quote ที่ไม่ใช่ quote ปิด และสตริงหลายท่อนที่ไม่ปิด
    ["escape quote ภายในค่า ไม่ปิด", `\\"name\\":\\"${'\\\\\\"x'.repeat(20_000)}`],
  ])("ข้อความยาว (%s) redact เสร็จเร็ว (ไม่ quadratic)", (_name, text) => {
    const started = performance.now()
    expect(redactPii(text)).toBe(text)
    expect(performance.now() - started).toBeLessThan(200)
  })

  // OPS-36: input ที่ match key แล้วต้องไล่ค่ายาว (ผลถูก redact บางส่วน จึงวัดเฉพาะเวลา)
  const L3 = "\\".repeat(7)
  it.each([
    ["escape 3 ชั้น ไม่ปิด", `${L3}"name${L3}":${L3}"${"\\".repeat(100_000)}`],
    ["escape 3 ชั้น quote ภายในยาว", `${L3}"name${L3}":${L3}"${`${"\\".repeat(15)}"x`.repeat(6_000)}`],
    ["สตริงหลายท่อนไม่ปิด", `name: 'a'${" + 'a'".repeat(16_000)} + '${"x".repeat(10_000)}`],
    ["key PII ซ้ำไม่ปิด", `\\"name\\":\\"x`.repeat(10_000)],
    // review #554: ตัวคั่น/ท่อนของ util.inspect ที่ escape
    ["ช่วง backslash ยาวหลังค่า", `name: 'a'${"\\".repeat(100_000)}`],
    ["ท่อน escape ไม่ปิด", `\\"name\\":\\"a\\" +\\n ${"\\".repeat(50_000)}"${"x".repeat(50_000)}`],
    ["ท่อน escape ซ้ำ", `name: 'a'${" +\\n \\\"b\\\"".repeat(10_000)} +\\n \\\"`],
    ["escaped newline ยาวไม่มี +", `name: 'a'${"\\\\n".repeat(30_000)}`],
  ])("ข้อความยาวที่มี key PII (%s) redact เสร็จเร็ว (ไม่ quadratic)", (_name, text) => {
    const started = performance.now()
    redactPii(text)
    expect(performance.now() - started).toBeLessThan(200)
  })
})

// OPS-39 (spec 07 กฎข้อ 21 รอบ 43, AC-54): ช่องที่เหลือหลัง OPS-36 (review #554)
describe("redactPii (OPS-39, AC-54)", () => {
  /** ห่อสตริงด้วย JSON.stringify ซ้ำ `levels` ชั้น (escape ซ้อน) */
  const wrap = (text: string, levels: number): string => {
    let out = text
    for (let i = 0; i < levels; i++) {
      out = JSON.stringify(out)
    }
    return out
  }

  // (a) util.inspect quote ด้วย ' และ escape ' ภายในเป็น \' เมื่อสตริงมีครบทั้ง ', " และ backtick
  it.each([0, 1, 2, 3])("(a) \\' ของ util.inspect ใน JSON escape %i ชั้น redact ทั้งค่า และ id ถัดไปยังอยู่", (levels) => {
    const inspected = inspect({ name: "it's \"Somchai\" `x`", id: "cart_01ABC" })
    expect(inspected).toContain("'it\\'s") // ยืนยันว่า inspect ใช้ \' จริง
    const out = redactPii(wrap(inspected, levels))

    expect(out).not.toContain("Somchai")
    expect(out).toContain("cart_01ABC")
  })

  // guard: ค่าที่ลงท้ายด้วย backslash จริงต้องปิดตรงตำแหน่งจริง (ไม่ตีความเป็น \' ของชั้นอื่นจน city หลุด)
  it.each([0, 1, 2, 3])("(a) guard: ค่าลงท้าย backslash ตามด้วย city ใน escape %i ชั้น → ไม่มี Bangkok", (levels) => {
    const out = redactPii(wrap(inspect({ name: "a\\", city: "Bangkok", id: CART_ID }), levels))

    expect(out).not.toContain("Bangkok")
    expect(out).toContain(CART_ID)
  })

  // (b) ค่าของ key PII ที่เป็น array แบบแบน
  const arrayInputs: [string, string][] = [
    ["inspect บรรทัดเดียว", inspect({ name: ["Somchai", "Jaidee"], postal_code: [10110], id: "pay_01X" })],
    ["inspect หลายบรรทัด (breakLength 1)", inspect({ name: ["Somchai", "Jaidee"], postal_code: [10110], id: "pay_01X" }, { breakLength: 1 })],
    ["JSON", JSON.stringify({ name: ["Somchai"], city: "Bangkok", id: "pay_01X" })],
    [
      "inspect array ยาว (> 6 สมาชิก) และสมาชิกหลายท่อน",
      inspect({
        name: ["Somchai", "Jaidee", "a", "b", "c", "d", "e", "f"],
        address_1: [`${"x".repeat(80)}\nSomchai it's\nJaidee`, "Bangkok"],
        id: "pay_01X",
      }),
    ],
  ]
  it.each(arrayInputs.flatMap(([name, text]) => [0, 1, 2, 3].map((levels) => [name, levels, text] as const)))(
    "(b) array ใต้ key PII (%s) escape %i ชั้น → ไม่มีสมาชิกเหลือ และ id ยังอยู่",
    (_name, levels, text) => {
      const out = redactPii(wrap(text, levels))

      for (const pii of ["Somchai", "Jaidee", "10110", "Bangkok"]) {
        expect(out).not.toContain(pii)
      }
      expect(out).toContain("pay_01X")
    }
  )

  it("(b) inspect หลายบรรทัดของ array ยาวถูกตัดจริง (กัน fixture เปลี่ยนรูป)", () => {
    expect(arrayInputs[1][1]).toContain("name: [\n")
    expect(arrayInputs[3][1]).toContain("' +\n")
  })

  it("(b) JSON array ระดับ 0 ยัง parse ได้ และ key ถัดไปถูก redact ตามปกติ", () => {
    const out = redactPii(JSON.stringify({ name: ["Somchai", "Jaidee"], city: "Bangkok", id: "pay_01X", amount: 1999 }))
    expect(JSON.parse(out)).toEqual({ name: ["[REDACTED]"], city: "[REDACTED]", id: "pay_01X", amount: 1999 })
  })

  // review #559 (nit): quote มาจากสมาชิกตัวแรก — ตัวคั่นหลังสมาชิกตัวสุดท้าย (pretty-print) ไม่ทำให้ quote หาย
  it("(b) quote ของผลมาจากสมาชิกตัวแรก (JSON pretty-print ยัง parse ได้)", () => {
    expect(redactPii(inspect({ name: ["Som'chai"], id: CART_ID }))).toBe(`{ name: ["[REDACTED]"], id: '${CART_ID}' }`)
    const pretty = redactPii(JSON.stringify({ name: ["Somchai", "Jaidee"], id: "pay_01X" }, null, 2))
    expect(JSON.parse(pretty)).toEqual({ name: ["[REDACTED]"], id: "pay_01X" })
  })

  it("(b) array ที่มีสมาชิกซ้อน/object (ไม่บังคับตามกฎ 21b) ไม่ทำให้ key ถัดไปหลุดหรือ id หาย", () => {
    const out = redactPii(inspect({ name: ["Somchai", { x: 1 }], city: "Bangkok", id: CART_ID }))
    expect(out).not.toContain("Bangkok")
    expect(out).toContain(CART_ID)
  })

  // review #559 (re-review blocker): ค่าที่ไม่ใช่ PII ลงท้ายด้วยรูป `<pii-key>: [` ต้องไม่ทำให้ key ถัดไปหลุด (develop ไม่หลุด)
  const OPENERS = ["name: [", "city: [ '", 'phone: ["x", ', "Name: [1, ", 'name: ["', "address_1: [\n", "email: [ 'a', "]
  const FORMS: [string, (value: object) => string][] = [
    ["inspect", (value) => inspect(value)],
    ["JSON", (value) => JSON.stringify(value)],
    ["JSON pretty-print", (value) => JSON.stringify(value, null, 2)],
  ]
  it.each(OPENERS.flatMap((opener) => FORMS.flatMap(([form, render]) => [0, 1, 2, 3].map((levels) => [opener, form, levels, render] as const))))(
    "(b) note ลงท้าย %j (%s, escape %i ชั้น) ไม่ทำให้ key ถัดไปหลุด",
    (opener, _form, levels, render) => {
      const out = redactPii(wrap(render({ note: opener, city: "Bangkok", phone: "77777", name: ["Somchai"], id: "cart_1" }), levels))

      for (const pii of ["Bangkok", "77777", "Somchai"]) {
        expect(out).not.toContain(pii)
      }
      expect(out).toContain("cart_1")
    }
  )

  // re-review #559 รอบ 3: สมาชิก array ห้ามกลืน key/ค่าที่ไม่ใช่ PII (จำนวนเงิน/id/ชื่อ key — กฎ 21d)
  const KEEP_CASES: [object, string[]][] = [
    [{ message: "city: [", total: "1999.50", id: "cart_1" }, ["1999.50", "total", "cart_1"]],
    [{ message: "Invalid name: [", amount: "250", currency_code: "thb" }, ["250", "amount", "thb"]],
    [{ message: "phone: [1, ", display_id: "1001", request_id: "01JABC" }, ["1001", "display_id", "request_id", "01JABC"]],
    [{ address_2X: "city:[", id0: "0" }, ["id0"]],
    [{ note: 'name: ["x", ', total: 1999, id: "cart_1" }, ["1999", "cart_1", "total"]],
  ]
  const KEEP_FORMS: [string, (value: object) => string][] = [
    ["inspect", (value) => inspect(value)],
    ["inspect breakLength 1", (value) => inspect(value, { breakLength: 1 })],
    ["JSON", (value) => JSON.stringify(value)],
    ["JSON pretty-print", (value) => JSON.stringify(value, null, 2)],
  ]
  it.each(
    KEEP_CASES.flatMap(([value, keep], index) =>
      KEEP_FORMS.flatMap(([form, render]) => [0, 1, 2, 3].map((levels) => [index, form, levels, value, keep, render] as const))
    )
  )("(b) ค่าที่ไม่ใช่ PII หลังรูปเปิด array (case %i, %s, escape %i ชั้น) ไม่ถูกตัด", (_index, form, levels, value, keep, render) => {
    const text = wrap(render(value), levels)
    const out = redactPii(text)

    for (const kept of keep) {
      expect(out).toContain(kept)
    }
    if (form.startsWith("JSON") && levels === 0) {
      expect(Object.keys(JSON.parse(out))).toEqual(Object.keys(value)) // parse ได้และ key ครบ (ข้อความใน message อาจถูก redact เกิน)
    }
  })

  it("(b) สมาชิกที่ไม่แบน (null/true/false) ไม่ทำให้สมาชิกตัวหลังหลุด", () => {
    const out = redactPii(inspect({ name: ["Somchai", null, true, false, "Jaidee"], id: CART_ID }))
    expect(out).not.toContain("Somchai")
    expect(out).not.toContain("Jaidee")
    expect(out).toContain(CART_ID)
  })

  // (c) fuzz: seed คงที่ — ถ้าล้ม ข้อความจะพิมพ์ seed, case และ input (JSON) เพื่อทำซ้ำได้
  const SEED = 0x0b5_39
  const MARK = "PIIMARK"
  const FUZZ_KEYS = ["name", "first_name", "address_1", "city", "email", "postal_code"]
  const NON_PII: Record<string, string | number>[] = [
    { total: "1999.50", currency_code: "thb" },
    { amount: 250, display_id: "1001" },
    { request_id: "01JABCREQ", total: 77 },
  ]
  const FUZZ_OPENERS = ["name: [", "city: [ '", 'phone: ["x", ', "Name: [1, ", 'name: ["', "email: [ 'a', ", "first_name: [\n  "]
  const FUZZ_CHARS = ["'", '"', "`", "\\", "\n", "[", "]", ",", ":", " ", "a", "Z", "x"]
  /** mulberry32 — PRNG แบบ seed คงที่ */
  const prng = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  it(`(c) fuzz ${MARK} 600 object × escape 0–3 ชั้น ไม่หลุด (seed ${SEED})`, () => {
    const rand = prng(SEED)
    const int = (n: number) => Math.floor(rand() * n)
    const randomString = (long: boolean) => {
      const length = long ? 90 + int(40) : int(12)
      let text = ""
      for (let i = 0; i < length; i++) {
        text += FUZZ_CHARS[int(FUZZ_CHARS.length)]
      }
      const at = int(text.length + 1)
      // สตริงยาวต้องมี \n เพื่อให้ inspect ตัดเป็นหลายท่อน
      return `${text.slice(0, at)}${MARK}${text.slice(at)}${long ? "\nend" : ""}`
    }
    const failures: string[] = []
    let multiLineArrays = 0
    let multiSegments = 0
    for (let i = 0; i < 600; i++) {
      const id = `cart_${i.toString(36)}FZ`
      const obj: Record<string, unknown> = {}
      // ค่าที่ไม่ใช่ PII ลงท้ายด้วยรูปเปิด array ของ key PII (review #559) ครึ่งหนึ่งของ case — วางก่อน key PII
      if (i % 2 === 0) {
        obj.note = randomString(false).replace(MARK, "") + FUZZ_OPENERS[int(FUZZ_OPENERS.length)]
        // field ที่ไม่ใช่ PII หลังรูปเปิด (re-review #559 รอบ 3) — ค่าและชื่อ key ต้องอยู่ครบ
        Object.assign(obj, NON_PII[i % NON_PII.length])
      }
      for (const key of FUZZ_KEYS.filter(() => rand() < 0.4).concat(FUZZ_KEYS[i % FUZZ_KEYS.length])) {
        // บังคับให้มี array ยาว (> 6 สมาชิก) ทุก 5 case และสตริงยาวที่มี \n ทุก 3 case
        const longArray = i % 5 === 0
        obj[key] =
          longArray || rand() < 0.4
            ? Array.from({ length: longArray ? 7 + int(6) : 1 + int(4) }, () => randomString(i % 3 === 0 && rand() < 0.3))
            : randomString(i % 3 === 0)
      }
      obj.id = id
      const inspected = inspect(obj)
      const kept = i % 2 === 0 ? Object.entries(NON_PII[i % NON_PII.length]).flat().map(String) : []
      if (/: \[\n/.test(inspected)) multiLineArrays++
      if (/' \+\n|" \+\n|` \+\n/.test(inspected)) multiSegments++
      for (const levels of [0, 1, 2, 3]) {
        const out = redactPii(wrap(inspected, levels))
        if (out.includes(MARK) || !out.includes(id) || kept.some((value) => !out.includes(value))) {
          failures.push(`seed=${SEED} case=${i} levels=${levels} input=${JSON.stringify(obj)} out=${JSON.stringify(out)}`)
        }
      }
    }
    expect(failures.slice(0, 3)).toEqual([])
    expect(multiLineArrays).toBeGreaterThan(50)
    expect(multiSegments).toBeGreaterThan(50)
  })

  // (d) ReDoS: input ≥ 100k ตัวอักษร — ทุกตัวอย่างเป็น "ข้อความดิบ" (String.raw: backslash ในโค้ดคือ backslash จริงในข้อความ)
  const L = (n: number) => "\\".repeat(n)
  /** prefix + unit ซ้ำจนยาว ≥ 100k ตัวอักษร */
  const fill = (prefix: string, unit: string) => prefix + unit.repeat(Math.ceil(100_000 / unit.length))
  it.each([
    ["name: ' + \\' ซ้ำไม่มี quote ปิด", String.raw`name: '` + String.raw`\'`.repeat(50_000)],
    ["name: [ + 'a', ซ้ำไม่มี ]", String.raw`name: [ ` + String.raw`'a', `.repeat(20_000)],
    ["\\\"name\\\":[ + \\\\\\\"a\\\\\\\", ซ้ำ", String.raw`\"name\":[` + String.raw`\\\"a\\\",`.repeat(12_000)],
    // กิ่งใหม่ทุกกิ่ง: \' ของ inspect ชั้น 1–3 ไม่ปิด, array ของตัวเลข/ท่อน + /สมาชิกที่ escape, array ซ้อนกันไม่ปิด
    ...[1, 2, 3].map((k) => [`\\' ชั้น ${k} ไม่ปิด`, fill("name: 'x", `${L(2 ** k)}'${L(2 ** k - 1)}"`)] as [string, string]),
    ...[1, 2, 3].map((k) => [`array ของสมาชิก \\' ชั้น ${k} ไม่มี ]`, fill("name: [ ", `'${L(2 ** k)}'${L(2 ** k - 1)}"', `)] as [string, string]),
    ["array ตัวเลขไม่มี ]", "name: [" + "1,".repeat(50_000)],
    ["array ท่อน + ไม่มี ]", "name: [ " + "'a' + ".repeat(17_000)],
    ["array หลายบรรทัดที่ escape ไม่มี ]", String.raw`\"name\": [\n` + String.raw`    'a',\n`.repeat(10_000)],
    ["key array ซ้ำ", "name: [ ".repeat(13_000)],
    ["key array ซ้ำในสตริง", "name: [ 'name: [ ".repeat(6_000)],
    ["array ไม่ปิดตามด้วย backslash ยาว", "name: [ 'a', " + L(100_000)],
    // review #559 (blocker): สมาชิกปิดได้แล้วท่อน + ต่อไปจนสุดข้อความ ไม่เจอ ] → ทุก key (in-phase) ล้มและสแกนถึงท้าย
    ["สมาชิก + ท่อนยาวไม่มี ] (review #559)", fill("", String.raw`name: ["+ \"`)],
    ["สมาชิก + ท่อนยาวไม่มี ] key city", fill("", String.raw`city: ["+ \"`)],
    ["สมาชิก + ท่อนยาวไม่มี ] ไม่มีช่องว่าง", fill("", String.raw`name: ["+\"`)],
    ["สมาชิกสองตัว + ท่อนที่ escape", fill("", String.raw`\"name: [""+`)],
    ["สมาชิก ' + ท่อนที่ escape 2 ชั้น", fill("", String.raw`\\\"name: ["'+`)],
    // re-review #559: guard รูป `<pii-key>:` ในสมาชิก/กิ่ง \' — ต้องยัง linear
    ["note ลงท้าย name: [ ซ้ำ (JSON)", fill("", '{"note":"name: [","city":"Bangkok","id":"cart_1"}')],
    ["note ลงท้าย city: [ ' ซ้ำ (inspect)", fill("", String.raw`{ note: 'city: [ \'', city: 'Bangkok', id: 'cart_1' }`)],
    ["array ของ null ไม่มี ]", fill("name: [ ", "null, ")],
    ["สมาชิกที่มี key PII ข้างใน ไม่ปิด", fill("name: [ 'a", " name: x")],
    ["\\' ชั้น 1 ที่มี key PII ข้างใน", fill(String.raw`name: 'it\\'s \"x\"`, " city: y")],
    // re-review #559 รอบ 3: guard ขอบ field (`,"key":`, newline ที่ escape + `key:`), สมาชิกต้องตามด้วยขอบ array, key ตำแหน่งโครงสร้าง
    ["note ลงท้าย name: [ ตามด้วย field ที่ไม่ใช่ PII ซ้ำ", fill("", '{"note":"[name: [","total":"1999.50","id":"cart_1"},')],
    ["สมาชิก ' ข้าม field JSON ซ้ำไม่มี ]", fill("name: [ '", '","total":1,"x":"')],
    ["สมาชิกข้าม newline ที่ escape ซ้ำไม่มี ]", fill(String.raw`name: [ '`, String.raw`
  total: 1,`)],
    ["[name: + newline ที่ escape ซ้ำ", fill("", String.raw`[name: "
]+`)],
  ])("ข้อความยาว (%s) redact เสร็จเร็ว (ไม่ quadratic)", (_name, text) => {
    expect(text.length).toBeGreaterThanOrEqual(100_000)
    const started = performance.now()
    redactPii(text)
    expect(performance.now() - started).toBeLessThan(200)
  })
})

// re-review #559 รอบ 3: regex ใหญ่คอมไพล์ช้าเมื่อเรียกครั้งแรก (ก่อนลดขนาดวัดได้ ~1.1 วินาที — block event loop ตอน log บรรทัดแรก)
// V8 cache regex ตาม source จึงสร้าง regex ที่ source ต่างเล็กน้อย (บังคับคอมไพล์ใหม่) แล้ววัดการใช้ครั้งแรก
describe("KEY_VALUE คอมไพล์เร็ว (re-review #559)", () => {
  it("การใช้ครั้งแรกของ regex ที่คอมไพล์ใหม่ ≤ 200ms", () => {
    const fresh = new RegExp(`${KEY_VALUE.source}|(?!)${Date.now()}`, KEY_VALUE.flags)
    const started = performance.now()
    '{ name: "Somchai", city: ["Bangkok"], id: "cart_1" }'.replace(fresh, "")
    expect(performance.now() - started).toBeLessThan(200)
  })
})

describe("redactValue (review #473)", () => {
  it("key ไม่สนตัวพิมพ์ และตัวเลขใต้ key PII", () => {
    expect(redactValue({ Email: "a", postal_code: 10110, phone: 812345678, quantity: 2 })).toEqual({
      Email: "[REDACTED]",
      postal_code: "[REDACTED]",
      phone: "[REDACTED]",
      quantity: 2,
    })
  })

  it("Error และ Map ที่ส่งเป็น meta ถูก redact (ไม่หลุดเป็นค่าเดิม)", () => {
    const err = Object.assign(new Error("buyer somchai.jaidee@example.co.th"), { email: "somchai.jaidee@example.co.th" })
    const out = redactValue({ err, extra: new Map([["email", "somchai.jaidee@example.co.th"], ["id", CART_ID]]) })
    const text = JSON.stringify(out)

    expect(text).not.toContain("somchai.jaidee@example.co.th")
    expect(out).toEqual({
      err: expect.objectContaining({ message: "buyer [REDACTED]", stack: expect.stringContaining("buyer [REDACTED]"), email: "[REDACTED]" }),
      extra: { email: "[REDACTED]", id: CART_ID },
    })
    expect(err.message).toBe("buyer somchai.jaidee@example.co.th")
  })

  // OPS-39 (AC-54b): array ใต้ key PII — ทุกสมาชิกที่เป็น string/ตัวเลข
  it("array ใต้ key PII ทุกสมาชิกเป็น [REDACTED] (OPS-39)", () => {
    expect(redactValue({ name: ["Somchai", 1] })).toEqual({ name: ["[REDACTED]", "[REDACTED]"] })
    expect(redactValue({ tags: ["vip", 1], address: { line1: ["99/1"] } })).toEqual({ tags: ["vip", 1], address: { line1: ["[REDACTED]"] } })
  })
})

/** เก็บบรรทัด JSON ที่ logger เขียนออก */
function capture() {
  const raw: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      raw.push(...chunk.toString().split("\n").filter(Boolean))
      callback()
    },
  })
  return { raw, stream }
}

describe("json-logger ของ prod redact PII (OPS-33, AC-48a/c)", () => {
  it("message, stack/cause และ field อื่นของ log ไม่มี PII แต่มี worker_mode, level และ id ครบ", () => {
    const { raw, stream } = capture()
    const logger = buildJsonLogger({ NODE_ENV: "production", MEDUSA_WORKER_MODE: "worker" }, stream)!

    const cause = new Error(`card holder somchai.jaidee@example.co.th`)
    logger.error(`${RECREATE_LINE} payment_id=${PAYMENT_ID}`, Object.assign(new Error(RECREATE_LINE), { cause }))
    logger.warn(`CART_COMPLETION_FAILED_AFTER_PAYMENT cart_id=${CART_ID} payment_id=${PAYMENT_ID} code=FLASH_LIMIT_EXCEEDED`)
    logger.info("customer contact 0812345678")

    const text = raw.join("\n")
    for (const value of PII) {
      expect(text).not.toContain(value)
    }
    const lines = raw.map((line) => JSON.parse(line))
    expect(lines.map((line) => [line.level, line.worker_mode])).toEqual([
      ["error", "worker"],
      ["warn", "worker"],
      ["info", "worker"],
    ])
    expect(lines[0].message).toContain(PAYMENT_ID)
    expect(lines[0].message).toContain("[REDACTED]")
    expect(lines[1].message).toBe(`CART_COMPLETION_FAILED_AFTER_PAYMENT cart_id=${CART_ID} payment_id=${PAYMENT_ID} code=FLASH_LIMIT_EXCEEDED`)
    expect(lines[2].message).toBe("customer contact [REDACTED]")
  })

  it("ไม่แก้ object ของผู้เรียก (redact บนสำเนา)", () => {
    const { raw, stream } = capture()
    const logger = buildJsonLogger({ NODE_ENV: "production" }, stream)!
    const detail = { email: "somchai.jaidee@example.co.th", name: "Somchai Jaidee", id: CART_ID }

    logger.log("info", "detail", { detail })

    expect(JSON.parse(raw[0]).detail).toEqual({ email: "[REDACTED]", name: "[REDACTED]", id: CART_ID })
    expect(detail.email).toBe("somchai.jaidee@example.co.th")
  })

  it("AC-48c development → undefined (Medusa ใช้ logger เดิมซึ่งไม่ redact)", () => {
    expect(buildJsonLogger({ NODE_ENV: "development" })).toBeUndefined()
  })
})
