import { AdminCreateGroupBuyCampaign } from "../../../api/admin/group-buy/validators"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  emptyCampaignForm,
  isEndsAtPast,
  selectSingleProduct,
  toCampaignBody,
  type CampaignForm,
} from "../group-buy-form"

// GB-6a: ฟอร์มสร้างแคมเปญใน admin → body ของ POST /admin/group-buy/campaigns (validator ของ GB-2a/GB-2c)
const form = (patch: Partial<CampaignForm> = {}): CampaignForm => ({
  ...emptyCampaignForm(),
  name: "GB 11.11",
  target_value: "3",
  starts_at: "2026-11-11T00:00",
  ends_at: "2026-11-12T00:00",
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

  it("reads date-time inputs as Thai time (ICT, UTC+7)", () => {
    const body = bodyOf(form())
    expect(body.starts_at).toBe("2026-11-10T17:00:00.000Z")
    expect(body.ends_at).toBe("2026-11-11T17:00:00.000Z")
  })

  it("sends null start and optional limits as null/omitted when left blank", () => {
    const body = bodyOf(form({ starts_at: "" }))
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
    ["end date", { ends_at: "" }],
    ["end after start", { ends_at: "2026-11-10T00:00" }],
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

// GB-6b2 กฎข้อ 16 (AC-32): เตือนเมื่อ ends_at (ICT) ไม่อยู่ในอนาคต แต่ยังส่งได้
describe("isEndsAtPast", () => {
  const now = Date.parse("2026-11-11T05:00:00.000Z") // 12:00 ICT

  it.each<[string, boolean]>([
    ["2026-11-11T11:59", true],
    ["2026-11-11T12:00", true],
    ["2026-11-11T12:01", false],
    ["", false],
    ["not-a-date", false],
  ])("ends_at %s → %s", (endsAt, expected) => {
    expect(isEndsAtPast(endsAt, now)).toBe(expected)
  })

  it("still lets a past end date through to the API (draft campaign)", () => {
    expect(toCampaignBody(form({ starts_at: "", ends_at: "2020-01-01T00:00" }))).toHaveProperty("body")
  })
})
