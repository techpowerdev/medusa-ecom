import {
  isCampaignLive,
  isListedPool,
  publicCampaignProductId,
  publicDiscount,
  toPublicCampaign,
  toPublicGroup,
} from "../utils/public-campaign"

const rule = (attribute: string, values: string[], operator = "in") => ({
  attribute,
  operator,
  values: values.map((value) => ({ value })),
})

// spec 04 กฎข้อ 28e + 30 (GB-11): product_id = ค่าเดียวของ rule items.product.id/in — 0 หรือ 2 ค่า → null
describe("publicCampaignProductId", () => {
  it.each([
    ["no application method", null, null],
    ["no target rules", { target_rules: [] }, null],
    ["one product", { target_rules: [rule("items.product.id", ["prod_x"])] }, "prod_x"],
    ["two products", { target_rules: [rule("items.product.id", ["prod_x", "prod_y"])] }, null],
    ["empty values", { target_rules: [rule("items.product.id", [])] }, null],
    ["variant scope", { target_rules: [rule("items.variant_id", ["variant_1"])] }, null],
    ["other operator", { target_rules: [rule("items.product.id", ["prod_x"], "eq")] }, null],
    [
      "two product rules",
      {
        target_rules: [rule("items.product.id", ["prod_x"]), rule("items.product.id", ["prod_y"])],
      },
      null,
    ],
    [
      "product rule next to another items rule",
      {
        target_rules: [rule("items.product.id", ["prod_x"]), rule("items.variant_id", ["variant_1"])],
      },
      "prod_x",
    ],
  ])("%s → %s", (_, method, expected) => {
    expect(publicCampaignProductId(method as Parameters<typeof publicCampaignProductId>[0])).toEqual(expected)
  })
})

describe("publicDiscount", () => {
  it("percentage → currency_code null, value as number", () => {
    expect(publicDiscount({ type: "percentage", value: "30", currency_code: "thb" })).toEqual({
      type: "percentage",
      value: 30,
      currency_code: null,
    })
  })

  it("fixed keeps currency_code", () => {
    expect(publicDiscount({ type: "fixed", value: 100, currency_code: "thb" })).toEqual({
      type: "fixed",
      value: 100,
      currency_code: "thb",
    })
  })

  it("no application method → null", () => {
    expect(publicDiscount(null)).toBeNull()
  })
})

// กฎข้อ 28c: เงื่อนไขเดียวกับ join (กฎข้อ 10)
describe("isCampaignLive", () => {
  const now = new Date("2026-11-03T10:00:00Z")
  const past = "2026-11-03T09:00:00Z"
  const future = "2026-11-03T11:00:00Z"
  it.each([
    ["active, in window", "active", past, future, true],
    ["active, no starts_at", "active", null, future, true],
    ["draft", "draft", past, future, false],
    ["ended", "ended", past, future, false],
    ["starts in the future", "active", future, future, false],
    ["ends_at passed", "active", past, past, false],
    ["no ends_at", "active", past, null, false],
  ] as const)("%s → %s", (_, status, startsAt, endsAt, expected) => {
    expect(isCampaignLive({ status, starts_at: startsAt, ends_at: endsAt }, now)).toBe(expected)
  })
})

// กฎข้อ 28d: pool ที่ open และยังไม่หมดเวลาเท่านั้น ไม่ list team
describe("isListedPool", () => {
  const now = new Date("2026-11-03T10:00:00Z")
  it.each([
    ["open pool", "pool", "open", "2026-11-03T11:00:00Z", true],
    ["failed pool", "pool", "failed", "2026-11-03T11:00:00Z", false],
    ["open pool past ends_at", "pool", "open", "2026-11-03T09:00:00Z", false],
    ["open team", "team", "open", "2026-11-03T11:00:00Z", false],
  ] as const)("%s → %s", (_, kind, status, endsAt, expected) => {
    expect(isListedPool({ kind, status, ends_at: endsAt }, now)).toBe(expected)
  })
})

// กฎข้อ 28b: allow-list ประกอบทีละ field — key อื่นของ entity ไม่หลุด
describe("toPublicCampaign / toPublicGroup", () => {
  it("returns exactly the allow-listed keys", () => {
    const campaign = toPublicCampaign(
      {
        id: "gbcamp_1",
        name: "A",
        status: "active",
        target_type: "orders",
        target_value: 3,
        group_mode: "both",
        max_people_per_group: null,
        max_units_per_person: 2,
        max_total_orders: 10,
        team_duration_hours: 24,
        pay_within_hours: 24,
        campaign: {
          id: "camp_1",
          starts_at: null,
          ends_at: "2026-11-04T00:00:00Z",
        },
      },
      {
        id: "promo_1",
        code: "GBT-1",
        application_method: {
          type: "percentage",
          value: 30,
          currency_code: null,
          target_rules: [rule("items.product.id", ["prod_x"])],
        },
      }
    )
    expect(Object.keys(campaign).sort()).toEqual(
      [
        "id",
        "name",
        "starts_at",
        "ends_at",
        "target_type",
        "target_value",
        "group_mode",
        "max_people_per_group",
        "max_units_per_person",
        "team_duration_hours",
        "pay_within_hours",
        "discount",
        "product_id",
      ].sort()
    )
    expect(campaign.product_id).toEqual("prod_x")
    expect(JSON.stringify(campaign)).not.toMatch(/promo_1|GBT-|\bcamp_1/)

    const group = toPublicGroup({
      id: "gbgrp_1",
      name: null,
      join_token: "tok",
      status: "open",
      kind: "team",
      starts_at: "2026-11-03T00:00:00Z",
      ends_at: "2026-11-04T00:00:00Z",
      progress_orders: 1,
      progress_units: 2,
      progress_people: 1,
      created_by_customer_id: "cus_1",
      pay_deadline_at: null,
    })
    expect(Object.keys(group).sort()).toEqual(
      [
        "id",
        "name",
        "join_token",
        "status",
        "starts_at",
        "ends_at",
        "progress_orders",
        "progress_units",
        "progress_people",
      ].sort()
    )
  })
})
