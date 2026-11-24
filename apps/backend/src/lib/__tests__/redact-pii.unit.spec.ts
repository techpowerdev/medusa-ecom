import { Writable } from "stream"
import { inspect } from "util"
import { redactPii, redactValue } from "../redact-pii"
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
  ])("ข้อความยาวที่มี key PII (%s) redact เสร็จเร็ว (ไม่ quadratic)", (_name, text) => {
    const started = performance.now()
    redactPii(text)
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
