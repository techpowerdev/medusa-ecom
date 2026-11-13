import { AdminCreateGroupBuyCampaign } from "../../../api/admin/group-buy/validators"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { webcrypto } from "node:crypto"
import {
  CAMPAIGN_PARSE_OPTIONS,
  campaignFormSchema,
  emptyCampaignForm,
  isEndsAtPast,
  newIdempotencyKey,
  selectSingleProduct,
  toCampaignBody,
  type CampaignForm,
} from "../group-buy-form"
import { BAD_NUMBER_INPUT } from "../form-validation"

// GB-6a: ฟอร์มสร้างแคมเปญใน admin → body ของ POST /admin/group-buy/campaigns (validator ของ GB-2a/GB-2c)
// ADM-7 (spec 08 กฎ 5, AC-10): วันเวลามาจาก DatePicker เป็น Date (ตาม timezone ของเครื่อง) — fixture ระบุ offset ไทยให้ผลตายตัว
const ict = (local: string) => new Date(`${local}:00+07:00`)

const form = (patch: Partial<CampaignForm> = {}): CampaignForm => ({
  ...emptyCampaignForm(),
  name: "GB 11.11",
  target_value: "3",
  starts_at: ict("2026-11-11T00:00"),
  ends_at: ict("2026-11-12T00:00"),
  discount_value: "30",
  product_id: "prod_a",
  ...patch,
})

const bodyOf = (f: CampaignForm) => {
  const result = toCampaignBody(f)
  if ("error" in result) {
    throw new Error(result.error)
  }
  return result.body
}

describe("toCampaignBody", () => {
  it("builds a body that the admin create validator accepts", () => {
    const parsed = AdminCreateGroupBuyCampaign.safeParse(bodyOf(form()))
    expect(parsed.success).toBe(true)
  })

  // GB-6e (spec 04 กฎข้อ 30, AC-50): 1 แคมเปญ = 1 สินค้า → target_rules มี values ค่าเดียว
  it("maps percentage discount and the single product onto an items application method", () => {
    const body = bodyOf(form({ product_id: "prod_b" }))
    expect(body.application_method).toEqual({
      type: "percentage",
      target_type: "items",
      allocation: "each",
      max_quantity: 10,
      value: 30,
      target_rules: [{ attribute: "items.product.id", operator: "in", values: ["prod_b"] }],
    })
  })

  it("sets THB for a fixed discount and keeps the single product scope", () => {
    const body = bodyOf(form({ discount_type: "fixed", discount_value: "100" }))
    expect(body.application_method).toEqual(
      expect.objectContaining({
        type: "fixed",
        value: 100,
        currency_code: "thb",
        target_rules: [{ attribute: "items.product.id", operator: "in", values: ["prod_a"] }],
      })
    )
    expect(AdminCreateGroupBuyCampaign.safeParse(body).success).toBe(true)
  })

  it("rejects a form without a product with a product field error (gb-product-required-error)", () => {
    expect(toCampaignBody(form({ product_id: null }))).toEqual({ error: expect.any(String), field: "product" })
  })

  it("has no 'empty = all products' comment left in lib/group-buy-form.ts", () => {
    const source = readFileSync(join(__dirname, "..", "group-buy-form.ts"), "utf8")
    expect(source).not.toMatch(/ว่าง = ทุกสินค้า/)
  })

  // ADM-7: แทน test ของ ictToIso — ส่ง Date ที่ DatePicker ให้มาเข้า body ตรงๆ (JSON เป็น ISO UTC)
  it("passes the picked Date values to the body as-is (serialized as ISO UTC)", () => {
    const starts = new Date("2026-12-01T03:00:00.000Z")
    const ends = new Date("2026-12-31T16:30:00.000Z")
    const body = bodyOf(form({ starts_at: starts, ends_at: ends }))
    expect(body.starts_at).toBe(starts)
    expect(body.ends_at).toBe(ends)
    expect(JSON.parse(JSON.stringify(body))).toEqual(
      expect.objectContaining({ starts_at: "2026-12-01T03:00:00.000Z", ends_at: "2026-12-31T16:30:00.000Z" })
    )
  })

  it("has no ictToIso left in lib/group-buy-form.ts (spec 08 rule 5)", () => {
    const source = readFileSync(join(__dirname, "..", "group-buy-form.ts"), "utf8")
    expect(source).not.toMatch(/\bictToIso\b|datetime-local/)
  })

  it("sends null start and optional limits as null/omitted when left blank", () => {
    const body = bodyOf(form({ starts_at: null }))
    expect(body.starts_at).toBeNull()
    expect(body.max_total_orders).toBeNull()
    expect(body.max_units_per_person).toBeNull()
    expect(body.max_people_per_group).toBeNull()
    expect(body.team_duration_hours).toBeNull()
    expect(body.pay_within_hours).toBe(24)
  })

  it("keeps the tax-inclusive default (spec 04 rule 12) and lets the admin turn it off", () => {
    expect(bodyOf(form()).is_tax_inclusive).toBe(true)
    expect(bodyOf(form({ is_tax_inclusive: false })).is_tax_inclusive).toBe(false)
  })

  it.each<[string, Partial<CampaignForm>]>([
    ["name", { name: "  " }],
    ["target value", { target_value: "0" }],
    ["end date", { ends_at: null }],
    ["end after start", { ends_at: ict("2026-11-10T00:00") }],
    ["end equal to start", { ends_at: ict("2026-11-11T00:00") }],
    ["invalid end date", { ends_at: new Date("not-a-date") }],
    ["discount value", { discount_value: "abc" }],
    ["percentage above 100", { discount_value: "101" }],
    ["team duration for team mode", { group_mode: "team", team_duration_hours: "" }],
    ["whole-number limits", { max_people_per_group: "2.5" }],
  ])("rejects an invalid %s with a message instead of calling the API", (_, patch) => {
    expect(toCampaignBody(form(patch))).toEqual({ error: expect.any(String) })
  })

  // GB-6b2 กฎข้อ 15 (AC-32): max_quantity ต้อง ≥ max_units_per_person เมื่อกรอกทั้งคู่ — error ผูกกับช่อง max_quantity
  it("rejects max_quantity below max_units_per_person with a max_quantity field error", () => {
    expect(toCampaignBody(form({ max_quantity: "1", max_units_per_person: "2" }))).toEqual({
      error: expect.any(String),
      field: "max_quantity",
    })
  })

  it.each<[string, Partial<CampaignForm>]>([
    ["equal", { max_quantity: "2", max_units_per_person: "2" }],
    ["per-person limit left blank", { max_quantity: "1", max_units_per_person: "" }],
  ])("accepts max_quantity vs max_units_per_person when %s", (_, patch) => {
    expect(toCampaignBody(form(patch))).toHaveProperty("body")
  })
})

// GB-6e (AC-50): picker เลือกได้สินค้าเดียว — เลือกตัวใหม่แทนตัวเดิม, ยกเลิกตัวที่เลือก = ไม่มีสินค้า
describe("selectSingleProduct", () => {
  it.each<[string, string | null, Record<string, boolean>, string | null]>([
    ["first pick", null, { prod_a: true }, "prod_a"],
    ["A then B keeps only B", "prod_a", { prod_a: true, prod_b: true }, "prod_b"],
    ["unselect the current one", "prod_a", {}, null],
    ["unselect via false flag", "prod_a", { prod_a: false }, null],
    ["state unchanged keeps the current one", "prod_a", { prod_a: true }, "prod_a"],
  ])("%s", (_, current, next, expected) => {
    expect(selectSingleProduct(current, next)).toBe(expected)
  })
})

// GB-6b2 กฎข้อ 16 (AC-32): เตือนเมื่อ ends_at ไม่อยู่ในอนาคต แต่ยังส่งได้ (ADM-7: รับ Date จาก DatePicker)
describe("isEndsAtPast", () => {
  const now = Date.parse("2026-11-11T05:00:00.000Z") // 12:00 ICT

  it.each<[string, Date | null, boolean]>([
    ["11:59 ICT", ict("2026-11-11T11:59"), true],
    ["12:00 ICT", ict("2026-11-11T12:00"), true],
    ["12:01 ICT", ict("2026-11-11T12:01"), false],
    ["empty", null, false],
    ["invalid date", new Date("not-a-date"), false],
  ])("ends_at %s → %s", (_, endsAt, expected) => {
    expect(isEndsAtPast(endsAt, now)).toBe(expected)
  })

  it("still lets a past end date through to the API (draft campaign)", () => {
    expect(toCampaignBody(form({ starts_at: null, ends_at: ict("2020-01-01T00:00") }))).toHaveProperty("body")
  })
})

// ADM-7 (spec 08 กฎ 5, 8): schema ของ react-hook-form — วันเวลาเป็น z.date() (nullable), กฎธุรกิจอยู่ใน toCampaignBody
describe("campaignFormSchema", () => {
  const parse = (patch: Partial<CampaignForm>) =>
    campaignFormSchema.safeParse(form(patch), CAMPAIGN_PARSE_OPTIONS)
  const messageOf = (patch: Partial<CampaignForm>, field: string) =>
    parse(patch).error?.issues.find((i) => i.path[0] === field)?.message

  it("accepts the default form values with Date/null date fields", () => {
    expect(campaignFormSchema.safeParse(emptyCampaignForm(), CAMPAIGN_PARSE_OPTIONS).success).toBe(true)
    expect(parse({}).success).toBe(true)
  })

  it("parses to the same values (raw resolver, parse on submit)", () => {
    expect(campaignFormSchema.parse(form(), CAMPAIGN_PARSE_OPTIONS)).toEqual(form())
  })

  it.each(["starts_at", "ends_at"] as const)("shows 'Invalid date' (not zod's 'Invalid input') for an invalid %s", (field) => {
    expect(messageOf({ [field]: new Date("not-a-date") }, field)).toBe("Invalid date")
  })

  it("rejects a non-date value for ends_at with 'Invalid date'", () => {
    expect(messageOf({ ends_at: "2026-11-12T00:00" as unknown as Date }, "ends_at")).toBe("Invalid date")
  })

  // ADM-15 (spec 08 กฎ 19a): NumberInput ส่ง BAD_NUMBER_INPUT เมื่อพิมพ์ค่าที่ไม่ใช่ตัวเลข ("e") — error ใต้ช่องนั้น
  // (ข้อความเดียวกับ toCampaignBody) ไม่ถือเป็น "ว่าง" และไม่ไปจบที่ toast
  it.each([
    ["target_value", "Target must be a whole number greater than 0"],
    ["discount_value", "Discount value must be a number greater than 0"],
    ["max_quantity", "Max quantity must be a whole number greater than 0"],
    ["team_duration_hours", "Team duration must be a whole number greater than 0"],
    ["max_total_orders", "Max total orders must be a whole number greater than 0"],
    ["max_units_per_person", "Max units per person must be a whole number greater than 0"],
    ["max_people_per_group", "Max people per group must be a whole number greater than 0"],
    ["pay_within_hours", "Pay within must be a whole number greater than 0"],
  ] as const)("rejects BAD_NUMBER_INPUT in %s with the field's message", (field, message) => {
    const issues = parse({ [field]: BAD_NUMBER_INPUT }).error?.issues ?? []
    expect(issues.map((i) => [i.path[0], i.message])).toEqual([[field, message]])
  })

  it("still accepts an empty optional number field (blank = not set)", () => {
    expect(parse({ max_total_orders: "" }).success).toBe(true)
  })
})

// GB-15 (AC-58, กฎข้อ 33d): key ของฟอร์มต้องสร้างได้บนหน้า http (ไม่มี crypto.randomUUID — มีแค่ getRandomValues)
describe("newIdempotencyKey", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto")

  afterEach(() => {
    if (original) {
      Object.defineProperty(globalThis, "crypto", original)
    }
  })

  it("makes 1,000 unique UUID v4 keys with only getRandomValues (non-secure context)", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
      configurable: true,
      writable: true,
    })
    expect((globalThis.crypto as Partial<Crypto>).randomUUID).toBeUndefined()

    const keys = Array.from({ length: 1000 }, () => newIdempotencyKey())

    for (const key of keys) {
      expect(key).toMatch(/^[A-Za-z0-9_-]{8,128}$/)
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    }
    expect(new Set(keys).size).toBe(1000)
  })
})
