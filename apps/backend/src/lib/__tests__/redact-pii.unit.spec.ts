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
    ["สมาชิกข้าม newline ที่ escape ซ้ำไม่มี ]", fill(String.raw`name: [ '`, String.raw`\n  total: 1,`)],
    ["[name: + newline ที่ escape ซ้ำ", fill("", String.raw`[name: "\n]+`)],
    // re-review #559 รอบ 4: whitespace/newline ยาวคั่น key กับค่า (lookbehind ของ key ตำแหน่งโครงสร้างย้อนผ่าน \s* ทุกจุดที่ backtrack)
    ["name: + ช่องว่างยาว", "name:" + " ".repeat(100_000)],
    ['"name": + ช่องว่างยาว + x', '{"name":' + " ".repeat(100_000) + "x"],
    ["name: + newline ยาว + x", "name:" + "\n".repeat(100_000) + "x"],
    [",name: + ช่องว่างยาว + [", ",name:" + " ".repeat(100_000) + "["],
  ])("ข้อความยาว (%s) redact เสร็จเร็ว (ไม่ quadratic)", (_name, text) => {
    expect(text.length).toBeGreaterThanOrEqual(100_000)
    const started = performance.now()
    redactPii(text)
    expect(performance.now() - started).toBeLessThan(200)
  })
})

// OPS-40 (spec 07 กฎข้อ 22 รอบ 43, AC-55): ค่าที่ไม่ใช่ PII ลงท้ายด้วยรูปเปิด key PII ค่าเดี่ยว (review #559)
describe("redactPii (OPS-40, AC-55)", () => {
  const wrap = (text: string, levels: number): string => {
    let out = text
    for (let i = 0; i < levels; i++) {
      out = JSON.stringify(out)
    }
    return out
  }
  const SERIALIZERS: [string, (value: object) => string][] = [
    ["inspect", (value) => inspect(value, { depth: 5 })],
    ["inspect breakLength 1", (value) => inspect(value, { depth: 5, breakLength: 1 })],
    ["JSON", (value) => JSON.stringify(value)],
    ["JSON pretty-print", (value) => JSON.stringify(value, null, 2)],
  ]
  const KEPT = ["1999.50", "1042", "req_01ABC", "thb", "total", "display_id", "request_id", "currency_code"]

  // (a) รูปเปิดค่าเดี่ยว 5 แบบ × serialize 4 แบบ × escape 0–3 ชั้น = 80 กรณี
  const OPENERS = ["name: '", 'name: "', "phone: ", "Name: ", '"name":"']
  it.each(OPENERS.flatMap((opener) => SERIALIZERS.flatMap(([form, render]) => [0, 1, 2, 3].map((levels) => [opener, form, levels, render] as const))))(
    "(a) note ลงท้าย %j (%s, escape %i ชั้น) ไม่ทำให้ city หลุด และไม่กลืนจำนวนเงิน/id/ชื่อ key",
    (opener, _form, levels, render) => {
      const value = { note: opener, city: "Bangkok", total: "1999.50", display_id: 1042, request_id: "req_01ABC", currency_code: "thb" }
      const out = redactPii(wrap(render(value), levels))

      expect(out).not.toContain("Bangkok")
      for (const kept of KEPT) {
        expect(out).toContain(kept)
      }
    }
  )

  // (b) \' ของ util.inspect ที่เนื้อหามีรูป `<pii-key>:` ใน JSON escape 0–3 ชั้น
  it.each([0, 1, 2, 3])("(b) \\' + `city:` ในค่า name escape %i ชั้น redact ทั้งค่า และ id ถัดไปยังอยู่", (levels) => {
    const inspected = inspect({ name: "it's \"Somchai\" `x` city: y", id: CART_ID })
    expect(inspected).toContain("'it\\'s") // ยืนยันว่า inspect ใช้ \' จริง
    const out = redactPii(wrap(inspected, levels))

    expect(out).not.toContain("Somchai")
    expect(out).toContain(CART_ID)
  })

  it("ข้อความอิสระใน field ที่ไม่ใช่ PII ยังถูก redact (เหมือน develop)", () => {
    for (const text of [
      inspect({ message: "Invalid name: 'Somchai'", total: 1999 }),
      JSON.stringify({ message: "customer name: 'Somchai', city: 'Bangkok'", id: CART_ID }),
      wrap(inspect({ note: ['a', "Invalid city: 'Bangkok'"], id: CART_ID }), 2),
    ]) {
      const out = redactPii(text)
      expect(out).not.toContain("Somchai")
      expect(out).not.toContain("Bangkok")
    }
  })

  // (c) fuzz สองทิศ: seed คงที่ — ถ้าล้ม ข้อความจะพิมพ์ seed, case และ input เพื่อทำซ้ำได้
  const SEED = 0x0b5_40
  const MARK = "PIIMARK"
  const FUZZ_OPENERS = [
    ...OPENERS,
    String.raw`\"name\":\"`,
    String.raw`\\\"name\\\":\\\"`,
    "city: '",
    "email: `",
    "'name': '",
    '"name"=>"',
    "postal_code: ",
    "first_name: \"",
  ]
  const FUZZ_PREFIX = ["", "", ", ", "{ ", "\n  ", "\\n  ", "x ", "[", "'", '"', "`", "\\"]
  const FUZZ_PII_KEYS = ["name", "first_name", "address_1", "city", "email", "postal_code", "phone"]
  const FUZZ_CHARS = ["'", '"', "`", "\\", "\n", "[", "]", ",", ":", " ", "a", "Z", "x", "{", "}", "+"]
  const KNOWN: [string, string | number][] = [
    ["total", "1999.50"],
    ["amount", 250],
    ["display_id", 1042],
    ["request_id", "req_01ABC"],
    ["currency_code", "thb"],
  ]
  /** mulberry32 — PRNG แบบ seed คงที่ */
  const prng = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  it(`(c) fuzz ${MARK} 600 object × serialize 4 แบบ × escape 0–3 ชั้น ไม่หลุดและไม่กลืนค่าที่ไม่ใช่ PII (seed ${SEED})`, () => {
    const rand = prng(SEED)
    const int = (n: number) => Math.floor(rand() * n)
    const pick = <T,>(items: T[]): T => items[int(items.length)]
    const randomText = (length: number) => Array.from({ length }, () => pick(FUZZ_CHARS)).join("")
    const opener = () => pick(FUZZ_PREFIX) + randomText(int(3)) + pick(FUZZ_OPENERS)
    const piiValue = () => {
      const text = randomText(int(14))
      const at = int(text.length + 1)
      return `${text.slice(0, at)}${MARK}${text.slice(at)}`
    }
    const failures: string[] = []
    for (let i = 0; i < 600; i++) {
      const obj: Record<string, unknown> = {}
      const kept: string[] = []
      for (let n = 0; n < 1 + int(2); n++) {
        // field ที่ไม่ใช่ PII ลงท้ายด้วยรูปเปิด (ค่าเดี่ยว หรือสมาชิกตัวสุดท้ายของ array) → key PII → field ที่รู้ค่าล่วงหน้า
        const noteKey = `${pick(["note", "message", "description", "reason"])}${n || ""}`
        obj[noteKey] = rand() < 0.75 ? opener() : [...Array.from({ length: int(3) }, () => randomText(int(5))), opener()]
        obj[pick(FUZZ_PII_KEYS)] = piiValue()
        for (const [key, value] of KNOWN) {
          if (rand() < 0.6) {
            obj[`${key}${n || ""}`] = value
            kept.push(`${key}${n || ""}`, String(value))
          }
        }
      }
      const id = `cart_${i.toString(36)}FZ`
      obj.id = id
      kept.push(id)
      for (const [form, render] of SERIALIZERS) {
        for (const levels of [0, 1, 2, 3]) {
          const out = redactPii(wrap(render(obj), levels))
          const lost = kept.filter((value) => !out.includes(value))
          if (out.includes(MARK) || lost.length) {
            failures.push(`seed=${SEED} case=${i} ${form} levels=${levels} lost=${JSON.stringify(lost)} input=${JSON.stringify(obj)}`)
          }
        }
      }
    }
    expect(failures.slice(0, 3)).toEqual([])
  })

  // review #562 (blocker 1): key ที่ไม่ใช่ identifier (`x-note`, `user-agent`) — `, b: ` ในค่าเคยเริ่ม field ปลอมแล้วกลืน quote เปิดของ name
  // (ค่า PII ขึ้นต้นด้วยอักษรไทย/ช่องว่าง/เครื่องหมาย) — develop ไม่หลุด
  const INSPECTS: [string, (value: object) => string][] = [
    ["inspect", (value) => inspect(value)],
    ["inspect breakLength 1", (value) => inspect(value, { breakLength: 1 })],
  ]
  it.each(
    ["x-note", "user-agent"].flatMap((key) =>
      ["a, b: ", "Missing fields, reason:", "a\n  b: "].flatMap((note) => INSPECTS.map(([form, render]) => [key, note, form, render] as const))
    )
  )("(review #562) key %j ค่า %j (%s) × ค่า PII ขึ้นต้นด้วยอักษรไทย/ช่องว่าง/เครื่องหมาย × escape 0–3 ชั้น ไม่หลุด", (key, note, _form, render) => {
    for (const name of ["สมชาย ใจดี", " Somchai", "-Somchai", "(Somchai)"]) {
      for (const levels of [0, 1, 2, 3]) {
        const out = redactPii(wrap(render({ [key]: note, name, id: CART_ID }), levels))
        expect(out).not.toMatch(/Somchai|สมชาย/)
        expect(out).toContain(CART_ID)
      }
    }
  })

  it("(review #562) key ที่ไม่ใช่ identifier ใน object ซ้อน (headers user-agent) ไม่ทำให้ first_name หลุด", () => {
    for (const [, render] of SERIALIZERS) {
      for (const levels of [0, 1, 2, 3]) {
        expect(redactPii(wrap(render({ headers: { "user-agent": "Mozilla/5.0 (X11; rv: " }, first_name: "สมชาย" }), levels))).not.toContain("สมชาย")
      }
    }
  })

  // review #562 (blocker 2): กฎ 22a "ค่าของ key ใดก็ได้" — ตาราง (a) กับ key ที่ไม่ใช่ identifier
  it.each(
    ["x-note", "user-agent", "note.text", "my note", "0note", "ชื่อ"].flatMap((key) => OPENERS.map((opener) => [key, opener] as const))
  )("(review #562) key %j ค่าลงท้าย %j × serialize 4 แบบ × escape 0–3 ชั้น ไม่ทำให้ city หลุด และไม่กลืนค่าที่ไม่ใช่ PII", (key, opener) => {
    for (const [, render] of SERIALIZERS) {
      for (const levels of [0, 1, 2, 3]) {
        const value = { [key]: opener, city: "Bangkok", total: "1999.50", display_id: 1042, request_id: "req_01ABC", currency_code: "thb" }
        const out = redactPii(wrap(render(value), levels))
        expect(out).not.toContain("Bangkok")
        for (const kept of KEPT) {
          expect(out).toContain(kept)
        }
      }
    }
  })

  // review #562: array ใต้ key PII ที่สมาชิกหน้าตาเหมือนขอบ field (กฎ 22f — ไม่ redact) ต้องไม่ทำให้ค่าเดี่ยวของ key PII ถัดไปหลุด
  it.each(SERIALIZERS)("(review #562) array 22f ตามด้วย postal_code ค่าเดี่ยว (%s) × escape 0–3 ชั้น ไม่หลุด", (_form, render) => {
    for (const levels of [0, 1, 2, 3]) {
      expect(redactPii(wrap(render({ city: ["\n  t:"], postal_code: "\n10110" }), levels))).not.toContain("10110")
    }
  })

  // review #562: fuzz สองทิศที่ขยาย — key ที่ไม่ใช่ identifier, object ซ้อน, ค่า PII ขึ้นต้นด้วยอักษรไทย/ช่องว่าง/เครื่องหมาย,
  // array 22f (สมาชิกหน้าตาเหมือนขอบ field) ตามด้วย key PII ค่าเดี่ยว
  const SEED_562 = 0x0b5_62
  it(`(review #562) fuzz ${MARK} key/ค่าที่ไม่ใช่ identifier + array 22f 600 object × serialize 4 แบบ × escape 0–3 ชั้น (seed ${SEED_562})`, () => {
    const rand = prng(SEED_562)
    const int = (n: number) => Math.floor(rand() * n)
    const pick = <T,>(items: T[]): T => items[int(items.length)]
    const chars = [...FUZZ_CHARS, "ส", "ม", "-", "(", "t"]
    const randomText = (length: number) => Array.from({ length }, () => pick(chars)).join("")
    const openers = [...FUZZ_OPENERS, "a, b: ", "Missing fields, reason:", "a\n  b: ", ", rv: ", "\n  t:", ',"a":"', "{ a: '", "k: "]
    const opener = () => pick(FUZZ_PREFIX) + randomText(int(4)) + pick(openers)
    const noteKeys = ["note", "x-note", "user-agent", "note.text", "my note", "0note", "ชื่อ", "a b-c"]
    const piiKeys = [...FUZZ_PII_KEYS, "Name", "CITY"]
    const piiValue = () => {
      const text = randomText(int(10))
      const at = int(text.length + 1)
      return `${pick(["สม", " ", "-", "(", "", "a", "\n"])}${text.slice(0, at)}${MARK}${text.slice(at)}`
    }
    const failures: string[] = []
    for (let i = 0; i < 600; i++) {
      const obj: Record<string, unknown> = {}
      const kept: string[] = []
      for (let n = 0; n < 1 + int(2); n++) {
        const noteKey = `${pick(noteKeys)}${n || ""}`
        const note = rand() < 0.7 ? opener() : [randomText(int(5)), opener()]
        if (rand() < 0.15) obj.headers = { [noteKey]: note }
        else obj[noteKey] = note
        if (rand() < 0.3) obj[`${pick(["city", "name", "phone"])}`] = [pick(["\n  t:", ',"a":"', "x, b: "]) + randomText(int(3))]
        obj[pick(piiKeys)] = piiValue()
        for (const [key, value] of KNOWN) {
          if (rand() < 0.5) {
            obj[`${key}${n || ""}`] = value
            kept.push(`${key}${n || ""}`, String(value))
          }
        }
      }
      const id = `cart_${i.toString(36)}FZ`
      obj.id = id
      kept.push(id)
      for (const [form, render] of SERIALIZERS) {
        for (const levels of [0, 1, 2, 3]) {
          const out = redactPii(wrap(render(obj), levels))
          const lost = kept.filter((value) => !out.includes(value))
          if (out.includes(MARK) || lost.length) {
            failures.push(`seed=${SEED_562} case=${i} ${form} levels=${levels} lost=${JSON.stringify(lost)} input=${JSON.stringify(obj)}`)
          }
        }
      }
    }
    expect(failures.slice(0, 3)).toEqual([])
  })

  // re-review #562 รอบ 2: key ใน quote ที่มี quote อีกชนิด/backslash/escape ข้างใน (inspect `"customer's note"`, `'say "hi"'`, `'a\\b'`, `'a\nb'`)
  // เคยไม่ถูกจับเป็น field → `, tel:` ในค่าเริ่ม field ปลอมที่กลืน quote เปิดของ phone (ค่าขึ้นต้นด้วย `+` `,` `]` `}` newline) — develop ไม่หลุด
  const ODD_KEYS = ["customer's note", 'say "hi"', "a\\b", "a\nb", "tab\tkey", "\ud83d"]
  it.each(ODD_KEYS.flatMap((key) => ["+66 81 234 5678", ",Somchai", "]Somchai", "}Somchai", "\nSomchai"].map((phone) => [key, phone] as const)))(
    "(re-review #562) key %j ค่า PII %j × serialize 4 แบบ × escape 0–3 ชั้น ไม่หลุด",
    (key, phone) => {
      for (const [, render] of SERIALIZERS) {
        for (const levels of [0, 1, 2, 3]) {
          const out = redactPii(wrap(render({ [key]: "call me, tel:", phone, id: CART_ID }), levels))
          expect(out).not.toMatch(/Somchai|234 5678/)
          expect(out).toContain(CART_ID)
        }
      }
    }
  )

  // re-review #562 รอบ 2: fuzz สองทิศ — key ที่มี ' " backslash newline tab surrogate และค่า PII ขึ้นต้นด้วย + , ] } newline
  const SEED_562B = 0x0b5_63
  it(`(re-review #562) fuzz ${MARK} key ที่มี quote/escape × ค่า PII ขึ้นต้นด้วยเครื่องหมาย 600 object × serialize 4 แบบ × escape 0–3 ชั้น (seed ${SEED_562B})`, () => {
    const rand = prng(SEED_562B)
    const int = (n: number) => Math.floor(rand() * n)
    const pick = <T,>(items: T[]): T => items[int(items.length)]
    const chars = [...FUZZ_CHARS, "ส", "-", "t", "\t"]
    const randomText = (length: number) => Array.from({ length }, () => pick(chars)).join("")
    const keyChars = ["'", '"', "\\", "\n", "\t", "\ud83d", "a", " ", "-", "ส", ":", ","]
    const oddKey = () => `${pick(["note", "customer", "x"])}${Array.from({ length: 1 + int(3) }, () => pick(keyChars)).join("")}${pick(["", "k"])}`
    const openers = [...FUZZ_OPENERS, "call me, tel:", "a, b: ", "a\n  b: ", ", rv: ", "x: ["]
    const failures: string[] = []
    for (let i = 0; i < 600; i++) {
      const obj: Record<string, unknown> = {}
      const kept: string[] = []
      for (let n = 0; n < 1 + int(2); n++) {
        obj[`${oddKey()}${n || ""}`] = rand() < 0.75 ? pick(FUZZ_PREFIX) + randomText(int(4)) + pick(openers) : [randomText(int(4)), pick(openers)]
        const text = randomText(int(8))
        obj[pick(FUZZ_PII_KEYS)] = `${pick(["+66 ", ",", "]", "}", "\n", "สม", " "])}${text.slice(0, 3)}${MARK}${text.slice(3)}`
        for (const [key, value] of KNOWN) {
          if (rand() < 0.5) {
            obj[`${key}${n || ""}`] = value
            kept.push(`${key}${n || ""}`, String(value))
          }
        }
      }
      const id = `cart_${i.toString(36)}FZ`
      obj.id = id
      kept.push(id)
      for (const [form, render] of SERIALIZERS) {
        for (const levels of [0, 1, 2, 3]) {
          const out = redactPii(wrap(render(obj), levels))
          const lost = kept.filter((value) => !out.includes(value))
          if (out.includes(MARK) || lost.length) {
            failures.push(`seed=${SEED_562B} case=${i} ${form} levels=${levels} lost=${JSON.stringify(lost)} input=${JSON.stringify(obj)}`)
          }
        }
      }
    }
    expect(failures.slice(0, 3)).toEqual([])
  })

  // re-review #562 รอบ 3 (ข้อ 1): ค่า PII ที่ขึ้นต้นด้วย `+` — `+` ติดกันไม่ใช่ขอบหลังสมาชิก (ท่อนต่อของ inspect มีช่องว่างนำเสมอ ` +`)
  it("(re-review #562 รอบ 3) ค่า PII ขึ้นต้นด้วย + หลังค่าของ field ที่ไม่ใช่ PII ไม่หลุด", () => {
    for (const [, render] of INSPECTS) {
      for (const levels of [0, 1, 2, 3]) {
        expect(redactPii(wrap(render({ note: "a, b:", phone: "+66 81 234 5678", id: CART_ID }), levels))).not.toContain("234 5678")
      }
    }
    const text = JSON.stringify(
      inspect({ detail: "=>'=>", last_name: "\\\"naXme\\\":\\\"`'+'\",\"x\":\"", message1: ", ", postal_code: "+'x-a': 10110 $" })
    )
    expect(redactPii(text)).not.toContain("10110")
  })

  // re-review #562 รอบ 3 (ข้อ 2): key ใน quote ยาวไม่จำกัด (เดิม ≤ 128 token — key ยาวกว่านั้นไม่ถูกจับเป็น field แล้ว key PII ถัดไปหลุด)
  it.each(
    [`x-${"a".repeat(130)}`, `it's${"a".repeat(125)}`, `say "${"a".repeat(200)}"`].flatMap((key) =>
      [", สมชาย", "]สมชาย", "}สมชาย", "\nสมชาย", "+สมชาย"].map((name) => [key.slice(0, 12), name, key] as const)
    )
  )("(re-review #562 รอบ 3) key ยาว %j… ค่า name %j × serialize 4 แบบ × escape 0–3 ชั้น ไม่หลุด", (_label, name, key) => {
    for (const [, render] of SERIALIZERS) {
      for (const levels of [0, 1, 2, 3]) {
        const out = redactPii(wrap(render({ [key]: "a, b:", name, id: CART_ID }), levels))
        expect(out).not.toContain("สมชาย")
        expect(out).toContain(CART_ID)
      }
    }
  })

  // re-review #562 รอบ 4: ค่าของ field ที่ไม่ใช่ PII เป็น array ซ้อน หรือ object ที่มี key ว่าง `''` — เดิมจับ `[` ได้ชั้นเดียวและ key ต้องยาว ≥ 1
  // จึงสแกนเข้าไปในค่าแล้ว `, b:` เริ่ม field ปลอมที่กลืน quote เปิดของ key PII ถัดไป (ที่อยู่ขึ้นต้นด้วย newline จาก textarea เกิดจริง) — develop ไม่หลุด
  it.each([
    ["array ซ้อน", { d: [["a, b:"]], address_1: "\n99/1 ถนนสุขุมวิท" }, /สุขุมวิท/],
    ["object key ว่าง", { m: { "": "a, b:" }, name: ", สมชาย" }, /สมชาย/],
    ["object key ว่าง ค่า , ", { note: { "": ", " }, first_name: ":\tสมชาย" }, /สมชาย/],
    ["array ซ้อน 3 ชั้นของ object", { d: [[[{ x: "a, b:" }]]], city: "\nบางนา" }, /บางนา/],
    // fuzz object ซ้อน/Map/null-prototype ของ builder: สมาชิก `'\\'` หลัง Map/object ใน array และ key ของ Map ที่มี `\n  amount:`
    [
      "array ของ Map/null-prototype แล้วสมาชิก backslash",
      {
        note0: [
          [Object.assign(Object.create(null), { "x-a": ":\\n+" }), ['"', "phone: "]],
          [new Map([["a\nb", "+"]]), Object.assign(Object.create(null), { "a\nb": "\\" })],
          "\\",
        ],
        postal_code: " :-สมชาย[",
      },
      /สมชาย/,
    ],
    ["Map key ที่มี \\n + เยื้อง + key", { message1: new Map([["\\n  amount: ไทย", "email: `city:["]]), city: '}"name":""user-agent":สมชาย [' }, /สมชาย/],
  ] as const)("(re-review #562 รอบ 4) %s × serialize 5 แบบ × escape 0–3 ชั้น ไม่หลุด", (_name, value, pii) => {
    for (const [, render] of [...SERIALIZERS, ["inspect breakLength Infinity", (v: object) => inspect(v, { breakLength: Infinity })] as const]) {
      for (const levels of [0, 1, 2, 3]) {
        const out = redactPii(wrap(render({ ...value, id: CART_ID }), levels))
        expect(out).not.toMatch(pii)
        expect(out).toContain(CART_ID)
      }
    }
  })

  // re-review #562 รอบ 5: key ที่มี ' " backtick ครบ (inspect quote ด้วย ' และ escape เป็น \') — quote ปิดของ key เคยยอม backslash นำ
  // จึงปิดผิดที่ตรง `\':` กลาง key แล้วค่าของ field กลืน key PII ถัดไป — develop ไม่หลุด
  it.each([
    ["`\"'x': [", { address_1: "99 Moo 1', Bangkok" }, /Moo|Bangkok/],
    ["`\"'x': [", { address_1: "Soi 'A', Bangkok 10110" }, /Soi|Bangkok|10110/],
    ["a`\"'b': [", { name: "Somchai 'Tom', Jaidee" }, /Somchai|Tom|Jaidee/],
    ["`\"'x': [,", { city: "Bangkok']`" }, /Bangkok/],
    ['"name":"\':company: `x', { company: "ACME 'Thai', Ltd" }, /ACME|Thai|Ltd/],
  ] as const)("(re-review #562 รอบ 5) key %j × serialize 4 แบบ × escape 0–3 ชั้น ไม่หลุดและไม่กลืน total", (key, pii, re) => {
    for (const [, render] of SERIALIZERS) {
      for (const levels of [0, 1, 2, 3]) {
        const out = redactPii(wrap(render({ [key]: 5, ...pii, total: "1999.50", id: CART_ID }), levels))
        expect(out).not.toMatch(re)
        expect(out).toContain("1999.50")
        expect(out).toContain(CART_ID)
      }
    }
  })

  // fuzz.mts ของ reviewer (cart_6vjFZ): key `'"name":"\':company: …'` — ข้อความ inspect จริง (escape 0 ชั้น) ห่อ 0–3 ชั้น
  const CART_6VJ = "{\n  'a\\nb': Symbol(s),\n  city: '\\\\nPIIMARK0Qame: \"',\n  total0: '1999.50',\n  request_id0: 'req_01K0X',\n  '\"name\":\"\\':company: `KEYMARK1Q': Map(1) { \"ไทย', total: '\" => '\\\\\"name\\\\\":\\\\\"name: \"' },\n  state: \"+PIIMARK1Q😀\\\\n  'x-y': ,\",\n  total1: '1999.51',\n  display_id1: 1041,\n  request_id1: 'req_01K1X',\n  \"a': b2\": Map(1) { '... 3 more items$' => 'postal_code: 1999.50' },\n  last_name: '😀`]nullNaPIIMARK2Qme: ',\n  total2: '1999.52',\n  request_id2: 'req_01K2X',\n  id: 'cart_6vjFZ'\n}"
  it.each([0, 1, 2, 3])("(re-review #562 รอบ 5) key ที่มี \\' + `:` กลาง key (cart_6vjFZ) escape %i ชั้น — last_name ไม่หลุด", (levels) => {
    const out = redactPii(wrap(CART_6VJ, levels))
    expect(out).not.toContain("PIIMARK2Q")
    expect(out).toContain("1999.52")
  })

  // fuzz ของ reviewer (fz_nokm seed 4001/8001): Map key หลายท่อน (`'\n' +\n  '  total: …' =>`) — ข้อความ inspect breakLength 1 ชั้น 1 จริง
  it.each([
    ["\"{\\n  n: Map(1) {\\n    '\\\\n' +\\n      '  total: \\\\n' +\\n      '  total: ' => \\\"', 'k': '{\\\"\\n  },\\n  last_name: ',PIIMARK0Q\\\\r\\\\n',\\n  total0: '1999.50',\\n  display_id0: 1040,\\n  request_id0: 'req_01K0X',\\n  reason1: '\\\"user-agent\\\": name: \\\"',\\n  first_name: 'ไทยPIIMARK1Q',\\n  display_id1: 1041,\\n  request_id1: 'req_01K1X',\\n  description2: 'postal_code: \\\\n' +\\n    '  total:  $\\\"',\\n  postal_code: '😀namePIIMARK2Q: \\\"',\\n  total2: '1999.52',\\n  xreq3: {\\n    '': 'null'\\n  },\\n  email: ':PIIMARK3QZ1999.50',\\n  request_id3: 'req_01K3X',\\n  id: 'cart_4r3FZ'\\n}\"", "PIIMARK0Q"],
    ["\"{\\n  xreq: Map(1) {\\n    '\\\\n' +\\n      '  total: \\\",\\\"x\\\":\\\"' => `\\\"user-agent\\\": ', total: '`\\n  },\\n  name: ']PIIMARK0Q',\\n  total0: '1999.50',\\n  display_id0: 1040,\\n  description1: {\\n    inner: ''\\n  },\\n  first_name: '😀ไทยcity:[=>cPIIMARK1Qity: ',\\n  total1: '1999.51',\\n  display_id1: 1041,\\n  id: 'cart_8veFZ'\\n}\"", "PIIMARK0Q"],
  ])("(re-review #562 รอบ 6) Map key หลายท่อน — %#", (text, mark) => {
    expect(redactPii(text)).not.toContain(mark)
  })

  // (d) ReDoS: input ≥ 100k ตัวอักษร (String.raw: backslash ในโค้ดคือ backslash จริงในข้อความ)
  const fill = (prefix: string, unit: string, suffix = "") => prefix + unit.repeat(Math.ceil(100_000 / unit.length)) + suffix
  it.each([
    // ทุกจุดเริ่ม match ล้ม
    ["note: 'name: ซ้ำไม่มี quote ปิด", fill("{ note: '", "name: ")],
    [", name: \" ซ้ำ", fill("{ id: 1", ', name: "')],
    ["note: 'name: + field ที่ไม่ใช่ PII ซ้ำ", fill("", "\nnote: 'name: , b: \\")],
    ["field ที่ไม่ใช่ PII ค่า ' เปิดซ้ำ", fill("", "{ a: '")],
    ["field ที่ไม่ใช่ PII + array สมาชิก null ซ้ำ", fill("", ",, a: [ 'nullnull")],
    ['\\"name\\":[ + \'{ ซ้ำ', fill("", String.raw` \"name\":['{`)],
    // whitespace/newline ยาวคั่น key กับค่า
    ["name: + ช่องว่างยาว + 'x'", fill("name:", " ", "'x'")],
    ["name: + newline ยาว + 'x'", fill("name:", "\n", "'x'")],
    ["\\\"name\\\": + \\n ยาว + \\\"x\\\" (escape 1 ชั้น)", fill(String.raw`{\"name\":`, String.raw`\n`, String.raw`\"x\"`)],
    ["field ที่ไม่ใช่ PII + ช่องว่างยาว + 'x'", fill("{ a:", " ", "'x'")],
    ["field ที่ไม่ใช่ PII + \\r\\n ยาว + 'x'", fill(",a", "\r\n", ": 'x'")],
    ["ช่องว่างยาวก่อน key ที่ไม่ใช่ PII", fill(",", " ", "a: 'x'")],
    ["array ของ field ที่ไม่ใช่ PII + \\n ที่ escape ยาว", fill("{ a: [", String.raw`\n`, "'x'")],
    // re-review #562 รอบ 2: key ใน quote ที่มี escape/quote อีกชนิด
    ["key ใน quote + \\' ซ้ำไม่ปิด", fill("{ '", String.raw`\'`)],
    ["key ใน quote + backslash ยาว", fill(", '", "\\")],
    ["key ใน quote + quote สลับชนิดยาว", fill(", '", `"'`)],
    ["key ใน quote ที่ escape 1 ชั้น + \\\\\\\" ซ้ำ", fill(String.raw`{\"`, String.raw`\\\"`)],
    ["key ใน quote ซ้ำไม่มี :", fill("", `, 'a"b' `)],
    ["key ใน ' + backslash + อักษรไทยซ้ำ (เดิม ~95ms — สแกน 128 token จากทุก quote)", fill("", String.raw`, 'x\\สม`)],
    ["key ใน ' + backslash ยาว + quote ซ้ำ", fill("", String.raw`-, 'x\\\\'สม`)],
    // re-review #562 รอบ 3: key ใน quote ไม่จำกัดความยาว — key ยาว 100k, quote สลับ, backslash ยาว
    ["key ใน ' ยาว 100k ไม่ปิด", fill("{ '", "a")],
    ["key ใน ' ยาว 100k + :", fill("{ '", "a", "': 'x'")],
    ['key ใน " ยาว 100k ไม่ปิด', fill('{ "', "a")],
    ["key ใน \\\" (escape 1 ชั้น) ยาว + \\\\\\\" ซ้ำ", fill(String.raw`{\"`, String.raw`a\\\"`)],
    ["key ใน ' + quote \" สลับยาว", fill("{ '", `"a`)],
    ['key ใน " + quote \' สลับยาว', fill('{ "', `'a`)],
    ["key ใน ' + \\' ซ้ำยาว + backslash", fill("{ '", String.raw`\'a\\`)],
    ["key ใน ' ซ้ำ ไม่มี : (ทุกจุดเริ่มล้ม)", fill("", ", 'aaaa' ")],
    // re-review #562 รอบ 4: วงเล็บเป็นตัวคั่นของค่า field และ key ว่าง
    ["field + [ ซ้ำ", fill("{ a: ", "[")],
    ["field + ] ซ้ำ", fill("{ a: [", "]")],
    ["field + [ ช่องว่าง ซ้ำ", fill("{ a: ", "[ ")],
    ["field + [[ 'x', ซ้ำ", fill("{ a: ", "[[ 'x', ")],
    ["key ว่างซ้ำ", fill("{ ", "'': ")],
    ["key ว่าง \"\": ซ้ำ (JSON)", fill("{", '"":')],
    ["key ว่างซ้ำ + , ", fill("", ", '': ")],
  ])("ข้อความยาว (%s) redact เสร็จเร็ว (ไม่ quadratic)", (_name, text) => {
    expect(text.length).toBeGreaterThanOrEqual(100_000)
    const started = performance.now()
    redactPii(text)
    expect(performance.now() - started).toBeLessThan(200)
  })

  // re-review #562 รอบ 2 (ตัดสินโดย session หลัก): backtrack stack ล้น → แทนทั้งข้อความด้วย [REDACTED] (ไม่ throw ไม่หลุด)
  // fixture ของ reviewer: กิ่ง key PII อย่างเดียว (fallback เดิม) ไม่มี guard ของ NON_PII_FIELD → company หลุด
  it("ข้อความยาวมาก (4M ตัวอักษร) ของ field ที่ไม่ใช่ PII ไม่ throw และไม่หลุด", () => {
    const head = JSON.stringify({ message1: `name:'postal_code:"\\''+`, company: "สมชาย ใจดี" })
    const text = head.slice(0, -1) + `,"a":[${String.raw`\n`.repeat(2_000_000)}"x"]}`
    let out = ""
    expect(() => (out = redactPii(text))).not.toThrow()
    expect(out).not.toContain("สมชาย")
  })

  it("regex โยน RangeError (backtrack stack ล้น) → ผลเป็น [REDACTED] ทั้งข้อความ (บังคับเข้าทางนี้โดยไม่ขึ้นกับจุดล้นของ V8)", () => {
    const replace = jest.spyOn(String.prototype, "replace").mockImplementationOnce(() => {
      throw new RangeError("Maximum call stack size exceeded")
    })
    try {
      expect(redactPii('{"name":"Somchai","id":"cart_1"}')).toBe("[REDACTED]")
    } finally {
      replace.mockRestore()
    }
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
