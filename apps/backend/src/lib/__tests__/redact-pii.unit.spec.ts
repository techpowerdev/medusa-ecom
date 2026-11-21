import { Writable } from "stream"
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

  // review #473 (blocker): EMAIL เดิม backtrack แบบ O(n²) กับช่วง [A-Za-z0-9._%+-] ยาว → block event loop ทุกบรรทัด log
  // (errorHandler ของ Medusa log `req.path` ของ client ที่ไม่ login ได้) — วัดขนาดงาน ไม่ใช่ timeout เข้มงวด
  it.each([
    ["a ติดกัน 100k ตัว", "a".repeat(100_000)],
    ["404 ของ id ยาว", `Error 404 at /store/products/prod_${"A".repeat(16_000)}: Product with id: prod_${"A".repeat(16_000)} was not found`],
    ["จุดและขีดติดกัน 100k ตัว", "a.b-".repeat(25_000)],
  ])("ข้อความยาว (%s) redact เสร็จเร็ว (ไม่ quadratic)", (_name, text) => {
    const started = performance.now()
    expect(redactPii(text)).toBe(text)
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
