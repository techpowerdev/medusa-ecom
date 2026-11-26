// spec 10 (AI18N-2): กลุ่ม group buy + flash sale (`ecom-group-buy`) — AC-3 (enum กฎ 7), AC-4a (lazy t ตามภาษา), กฎ 3 (ค่า en = ข้อความเดิม)
// jest ตั้ง instance แยก lng=en ไว้ที่ `__tests__/i18n-setup.ts` (กฎ 16) — test ที่เปลี่ยนภาษาคืนเป็น en ใน afterEach
import { readFileSync } from "fs"
import { join } from "path"

import { getI18n } from "react-i18next"

import resources from "../../i18n"
import { THAI, dashboardTranslations, flatten, missingEnumKeys, unionLiterals, type Json, type Resources } from "../../__tests__/i18n-check"
import { FLASH_SALE_PARSE_OPTIONS, flashSaleFormSchema, positiveIntMessage } from "../flash-sale-form"
import { customerLabel, groupProgress } from "../group-buy-campaign"
import { CAMPAIGN_PARSE_OPTIONS, campaignFormSchema, emptyCampaignForm, toCampaignBody } from "../group-buy-form"
import { INT4_MAX } from "../../../lib/int4"

const NS = "ecom-group-buy"
const LIB = join(__dirname, "..")
const en = flatten(resources.en[NS] as Json)
const th = flatten(resources.th[NS] as Json)

const validForm = () => ({
  ...emptyCampaignForm(),
  name: "GB",
  target_value: "3",
  ends_at: new Date("2026-12-31T00:00:00+07:00"),
  discount_value: "10",
  product_id: "prod_a",
})

const endsAtIssue = () => {
  const parsed = campaignFormSchema.safeParse({ ...validForm(), ends_at: new Date("not-a-date") }, CAMPAIGN_PARSE_OPTIONS)
  expect(parsed.success).toBe(false)
  return parsed.error!.issues.find((issue) => issue.path[0] === "ends_at")?.message
}

const nameError = () => {
  const result = toCampaignBody({ ...emptyCampaignForm(), name: "" })
  return "error" in result ? result.error : undefined
}

afterEach(async () => {
  await getI18n().changeLanguage("en")
})

describe("AC-4a ตัวแทน group buy: ข้อความ lazy ตามภาษา (กฎ 4, 8, 11)", () => {
  it("toCampaignBody ไม่กรอกชื่อ / campaignFormSchema ends_at Invalid Date: en เดิม → th → de ได้ en", async () => {
    expect(nameError()).toBe("Name is required")
    expect(endsAtIssue()).toBe("Invalid date")
    await getI18n().changeLanguage("th")
    expect(nameError()).toBe(th["form.errors.nameRequired"])
    expect(nameError()).toMatch(THAI)
    expect(endsAtIssue()).toBe(th["form.errors.invalidDate"])
    expect(endsAtIssue()).toMatch(THAI)
    await getI18n().changeLanguage("de")
    expect(nameError()).toBe("Name is required")
    expect(endsAtIssue()).toBe("Invalid date")
  })

  it.each<[string, Record<string, unknown>, string]>([
    ["ช่องตัวเลขไม่ใช่จำนวนเต็ม (superRefine)", { target_value: "0" }, "Target must be a whole number greater than 0"],
    ["เกิน INT4_MAX", { max_total_orders: String(INT4_MAX + 1) }, `Max total orders must be at most ${INT4_MAX}`],
    ["ส่วนลดไม่ใช่ตัวเลขบวก", { discount_value: "-1" }, "Discount value must be a number greater than 0"],
  ])("schema: %s — en เท่าข้อความเดิม th มีอักษรไทย", async (_, patch, message) => {
    const issue = () => campaignFormSchema.safeParse({ ...validForm(), ...patch }, CAMPAIGN_PARSE_OPTIONS).error?.issues[0]?.message
    expect(issue()).toBe(message)
    await getI18n().changeLanguage("th")
    expect(issue()).toMatch(THAI)
    expect(issue()).not.toMatch(/must be/)
  })

  it.each<[Record<string, unknown>, string]>([
    [{ ends_at: null }, "End date is required"],
    [{ starts_at: new Date("2027-01-01T00:00:00+07:00") }, "End date must be after start date"],
    [{ group_mode: "team" }, "Team duration is required when teams are allowed"],
    [{ discount_value: "101" }, "Percentage discount cannot exceed 100"],
    [{ product_id: null }, "Select the product of this campaign"],
    [{ max_quantity: "1", max_units_per_person: "2" }, "Max discounted quantity must be at least max units per person"],
    [{ max_people_per_group: "2.5" }, "Max people per group must be a whole number greater than 0"],
  ])("toCampaignBody %p → en %p และ th มีอักษรไทย", async (patch, message) => {
    const error = () => {
      const result = toCampaignBody({ ...validForm(), ...patch })
      return "error" in result ? result.error : undefined
    }
    expect(error()).toBe(message)
    await getI18n().changeLanguage("th")
    expect(error()).toMatch(THAI)
  })

  it("flash sale: ข้อความจำนวนเต็มบวก (refine + fieldErrorMap) ตามภาษา", async () => {
    const issue = () =>
      flashSaleFormSchema.safeParse(
        { per_customer_limit: "", total_cap: "0", show_countdown: false, show_remaining: false, banner_text: "" },
        FLASH_SALE_PARSE_OPTIONS
      ).error?.issues[0]?.message
    expect(positiveIntMessage()).toBe("Must be a whole number greater than 0")
    expect(issue()).toBe("Must be a whole number greater than 0")
    await getI18n().changeLanguage("th")
    expect(issue()).toBe(th["flashSale.errors.positiveInt"])
    expect(issue()).toMatch(THAI)
  })

  it("lib/group-buy-campaign: (deleted) และหน่วยของ target แปลตามภาษา", async () => {
    const progress = { progress_orders: 2, progress_units: 5, progress_people: 1 }
    expect(customerLabel({ customer_id: "cus_1", customer: null })).toBe("cus_1 (deleted)")
    expect(groupProgress(progress, { target_type: "units", target_value: 3 })).toBe("5 / 3 units")
    await getI18n().changeLanguage("th")
    expect(customerLabel({ customer_id: "cus_1", customer: null })).toMatch(/^cus_1 .*[฀-๿]/)
    expect(groupProgress(progress, { target_type: "units", target_value: 3 })).toMatch(/^5 \/ 3 .*[฀-๿]/)
  })
})

// กฎ 7: ทุกค่าของ enum ที่แสดงต่อผู้ใช้มี key ใน en (ค่า en = ค่าดิบเดิม) — union อ่านด้วย compiler API, z.enum อ่านจาก schema
describe("AC-3 enum ของ group buy มี key ครบ (กฎ 7)", () => {
  const union = (file: string, type: string) => unionLiterals(file, readFileSync(join(LIB, file), "utf8"), type)
  const ENUMS: [string, readonly string[]][] = [
    ["status", union("group-buy-campaign.ts", "CampaignStatus")],
    ["groupStatus", union("group-buy.ts", "GroupStatus")],
    ["membershipStatus", union("group-buy.ts", "MembershipStatus")],
    ["groupKind", union("group-buy.ts", "GroupKind")],
    ["groupMode", union("group-buy-form.ts", "GroupMode")],
    ["targetType", union("group-buy-form.ts", "TargetType")],
    ["targetValue", union("group-buy-form.ts", "TargetType")],
    ["progress", union("group-buy-form.ts", "TargetType")],
    ["groupMode", campaignFormSchema.shape.group_mode.options],
    ["targetType", campaignFormSchema.shape.target_type.options],
    ["discountType", campaignFormSchema.shape.discount_type.options],
    // สถานะสินค้าของ Medusa (`ProductStatus`) ที่ picker แสดง
    ["productStatus", ["draft", "proposed", "published", "rejected"]],
  ]

  it.each(ENUMS)("%s: %p", (prefix, values) => {
    expect(values.length).toBeGreaterThan(1)
    expect(missingEnumKeys(resources as Resources, NS, prefix, values)).toEqual([])
  })

  it("ค่า en ของสถานะ/ชนิด = ค่าดิบเดิม (ข้อความที่แสดงในโหมดอังกฤษไม่เปลี่ยน)", () => {
    for (const [prefix, values] of ENUMS.filter(([p]) => !["targetValue", "progress"].includes(p))) {
      for (const value of values) expect(en[`${prefix}.${value}`]).toBe(value)
    }
    expect(en["targetValue.orders"]).toBe("{{value}} orders")
    expect(en["progress.people"]).toBe("{{current}} / {{target}} people")
  })

  // AI18N-N1 (nit review รอบ 46): ค่า th ของสถานะสินค้าเท่าคำแปลของ Medusa (`products.productStatus.*` ใน th.json ของ dashboard)
  it("productStatus: ค่า th = th.json ของ @medusajs/dashboard", () => {
    const dashboardTh = dashboardTranslations("th")
    const th = flatten(resources.th[NS] as Json)
    for (const value of ["draft", "proposed", "published", "rejected"]) {
      expect(dashboardTh[`products.productStatus.${value}`]).toMatch(THAI)
      expect(th[`productStatus.${value}`]).toBe(dashboardTh[`products.productStatus.${value}`])
    }
  })
})

// กฎ 3: ค่า en ของข้อความหลักเท่าข้อความอังกฤษเดิมตรงตัว (e2e เดิมหาด้วยชื่อเหล่านี้)
describe("ค่า en = ข้อความเดิม (กฎ 3)", () => {
  it.each([
    ["nav.groupBuying", "Group buying"],
    ["list.heading", "Group-buy campaigns"],
    ["list.create", "Create campaign"],
    ["list.loadError", "Could not load campaigns"],
    ["groups.loadError", "Could not load groups"],
    ["members.loadError", "Could not load members"],
    ["groups.createPool", "Create pool group"],
    ["form.title", "Create group-buy campaign"],
    ["form.labels.name", "Name *"],
    ["flashSale.title", "Flash sale options"],
    ["flashSale.fields.totalCap", "Total cap"],
    ["flashSale.unlimited", "Unlimited"],
  ])("%s = %p", (key, value) => {
    expect(en[key]).toBe(value)
    expect(th[key]).toMatch(THAI)
  })
})

// e2e หา element ด้วย `adminLabel(lng, ns, <ข้อความ en>)` — ค่า en เดียวกันหลาย key ต้องแปลไทยเหมือนกัน (ไม่งั้นหาค่าไทยไม่ได้แน่นอน)
it("ค่า en ซ้ำกันใน ecom-group-buy มีค่า th เดียวกัน", () => {
  const byEn = new Map<string, Set<string>>()
  for (const [key, value] of Object.entries(en)) byEn.set(value, (byEn.get(value) ?? new Set()).add(th[key]))
  const conflicts = [...byEn].filter(([, values]) => values.size > 1).map(([value]) => value)
  expect(conflicts).toEqual([])
})
