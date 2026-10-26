import { MedusaError } from "@medusajs/framework/utils"
import {
  GB_ALREADY_IN_OTHER_GROUP,
  GB_CART_ALREADY_JOINED,
  GB_GROUP_FULL,
  GB_ITEMS_NOT_ELIGIBLE,
  GB_MAX_TOTAL_ORDERS_REACHED,
  GB_UNITS_LIMIT_EXCEEDED,
} from "../errors"
import {
  assertJoinAllowed,
  assertLeaveAllowed,
  cartAdjustmentsForOrder,
  itemMatchesTargetRules,
  joinProgress,
  leaveProgress,
  type JoinCheck,
} from "../utils/join"

const HOUR = 60 * 60 * 1000
const now = new Date("2026-11-01T10:00:00.000Z")

const check = (data: Partial<JoinCheck> = {}): JoinCheck => ({
  now,
  campaign: {
    status: "active",
    starts_at: new Date(now.getTime() - HOUR),
    ends_at: new Date(now.getTime() + 10 * HOUR),
    max_total_orders: null,
    max_units_per_person: null,
    max_people_per_group: null,
  },
  group: { id: "gbgrp_1", status: "open", ends_at: new Date(now.getTime() + HOUR), progress_people: 0 },
  cartUnits: 1,
  cartManualCodes: [],
  itemsEligible: true,
  customerMemberships: [],
  campaignMembershipCount: 0,
  ...data,
})

const withCampaign = (campaign: Partial<JoinCheck["campaign"]>) =>
  check({ campaign: { ...check().campaign, ...campaign } })

const conflict = (code: string) => expect.objectContaining({ type: MedusaError.Types.CONFLICT, code })
const notAllowed = expect.objectContaining({ type: MedusaError.Types.NOT_ALLOWED })

// spec 04 joinGroupWorkflow ขั้น 1 (ADR-009 ข้อ 3, 5; กฎข้อ 4, 7, 10)
describe("assertJoinAllowed", () => {
  it("accepts the first join and reports a new person", () => {
    expect(assertJoinAllowed(check())).toEqual({ isNewPerson: true })
  })

  it.each(["draft", "ended"] as const)("rejects a %s campaign with NOT_ALLOWED", (status) => {
    expect(() => assertJoinAllowed(withCampaign({ status }))).toThrow(notAllowed)
  })

  it("rejects when the Medusa campaign starts_at is in the future (AC-23)", () => {
    expect(() =>
      assertJoinAllowed(withCampaign({ starts_at: new Date(now.getTime() + 1) }))
    ).toThrow(notAllowed)
  })

  it("rejects when the Medusa campaign has ended", () => {
    expect(() => assertJoinAllowed(withCampaign({ ends_at: now }))).toThrow(notAllowed)
  })

  it("rejects a group that is not open or whose deadline passed (NOT_ALLOWED)", () => {
    const group = check().group
    expect(() => assertJoinAllowed(check({ group: { ...group, status: "succeeded" } }))).toThrow(
      notAllowed
    )
    expect(() => assertJoinAllowed(check({ group: { ...group, ends_at: now } }))).toThrow(notAllowed)
  })

  it("rejects a cart with another promotion code (AC-14)", () => {
    expect(() => assertJoinAllowed(check({ cartManualCodes: ["SAVE10"] }))).toThrow(
      conflict("PROMOTION_NOT_COMBINABLE")
    )
  })

  it("rejects a member of another group in the same campaign (AC-18)", () => {
    expect(() =>
      assertJoinAllowed(check({ customerMemberships: [{ group_id: "gbgrp_2", units: 1 }] }))
    ).toThrow(conflict(GB_ALREADY_IN_OTHER_GROUP))
  })

  it("max_people_per_group counts distinct customers; an existing member may order again (AC-4)", () => {
    const full = { ...check().group, progress_people: 2 }
    const campaign = { ...check().campaign, max_people_per_group: 2 }
    expect(() => assertJoinAllowed(check({ campaign, group: full }))).toThrow(conflict(GB_GROUP_FULL))
    expect(
      assertJoinAllowed(
        check({ campaign, group: full, customerMemberships: [{ group_id: "gbgrp_1", units: 1 }] })
      )
    ).toEqual({ isNewPerson: false })
  })

  it("max_total_orders counts all memberships of the campaign (AC-13)", () => {
    const campaign = { ...check().campaign, max_total_orders: 5 }
    expect(() => assertJoinAllowed(check({ campaign, campaignMembershipCount: 5 }))).toThrow(
      conflict(GB_MAX_TOTAL_ORDERS_REACHED)
    )
    expect(() => assertJoinAllowed(check({ campaign, campaignMembershipCount: 4 }))).not.toThrow()
  })

  it("max_units_per_person sums existing units + the cart (AC-5, AC-17)", () => {
    const campaign = { ...check().campaign, max_units_per_person: 2 }
    const member = [{ group_id: "gbgrp_1", units: 1 }]
    expect(() => assertJoinAllowed(check({ campaign, cartUnits: 3 }))).toThrow(
      conflict(GB_UNITS_LIMIT_EXCEEDED)
    )
    expect(() =>
      assertJoinAllowed(check({ campaign, cartUnits: 2, customerMemberships: member }))
    ).toThrow(conflict(GB_UNITS_LIMIT_EXCEEDED))
    expect(() =>
      assertJoinAllowed(check({ campaign, cartUnits: 1, customerMemberships: member }))
    ).not.toThrow()
  })

  it("rejects a cart with items outside the campaign scope", () => {
    expect(() => assertJoinAllowed(check({ itemsEligible: false }))).toThrow(
      conflict(GB_ITEMS_NOT_ELIGIBLE)
    )
  })

  it("rejects a cart that already holds a GB- code, before PROMOTION_NOT_COMBINABLE (กฎข้อ 14b, AC-27)", () => {
    for (const codes of [["GB-AAA"], ["GB-BBB"], ["SAVE10", "GB-AAA"]]) {
      expect(() => assertJoinAllowed(check({ cartManualCodes: codes }))).toThrow(
        conflict(GB_CART_ALREADY_JOINED)
      )
    }
  })

  it("rejects an empty cart (INVALID_DATA)", () => {
    expect(() => assertJoinAllowed(check({ cartUnits: 0 }))).toThrow(
      expect.objectContaining({ type: MedusaError.Types.INVALID_DATA })
    )
  })
})

describe("itemMatchesTargetRules", () => {
  const item = { variant_id: "variant_1", product: { id: "prod_x", categories: [{ id: "pcat_1" }] } }
  const rule = (attribute: string, operator: string, values: string[]) => ({
    attribute,
    operator,
    values: values.map((value) => ({ value })),
  })

  it("matches every rule (AND) with in / eq / ne / nin on item paths, including arrays", () => {
    expect(itemMatchesTargetRules(item, [])).toBe(true)
    expect(itemMatchesTargetRules(item, [rule("items.product.id", "in", ["prod_x", "prod_y"])])).toBe(true)
    expect(itemMatchesTargetRules(item, [rule("items.product.id", "in", ["prod_y"])])).toBe(false)
    expect(itemMatchesTargetRules(item, [rule("items.variant_id", "eq", ["variant_1"])])).toBe(true)
    expect(itemMatchesTargetRules(item, [rule("items.product.categories.id", "in", ["pcat_1"])])).toBe(true)
    expect(itemMatchesTargetRules(item, [rule("items.product.id", "ne", ["prod_x"])])).toBe(false)
    expect(itemMatchesTargetRules(item, [rule("items.product.id", "nin", ["prod_y"])])).toBe(true)
    expect(
      itemMatchesTargetRules(item, [
        rule("items.product.id", "in", ["prod_x"]),
        rule("items.variant_id", "in", ["variant_2"]),
      ])
    ).toBe(false)
  })

  it("does not match an unsupported operator", () => {
    expect(itemMatchesTargetRules(item, [rule("items.product.id", "gt", ["prod_x"])])).toBe(false)
  })
})

// spec 04 ขั้น 3 + กฎข้อ 5: freeze adjustment ที่ Medusa คำนวณบน cart ลง line item ของ draft order
describe("cartAdjustmentsForOrder", () => {
  const raw = (value: string) => ({ value, precision: 20 })
  const adj = (code: string, value: string) => ({
    code,
    raw_amount: raw(value),
    promotion_id: `promo_${code}`,
    description: null,
    is_tax_inclusive: true,
    provider_id: null,
  })

  it("maps each cart line's adjustments onto the order item with the same variant (one-to-one)", () => {
    const cartItems = [
      { variant_id: "v1", adjustments: [adj("GB-A", "30.1")] },
      { variant_id: "v2", adjustments: [] },
      { variant_id: "v1", adjustments: [adj("GB-A", "10")] },
    ]
    const orderItems = [
      { id: "oi_2", variant_id: "v2" },
      { id: "oi_1a", variant_id: "v1" },
      { id: "oi_1b", variant_id: "v1" },
    ]
    expect(cartAdjustmentsForOrder(cartItems, orderItems)).toEqual([
      {
        item_id: "oi_1a",
        code: "GB-A",
        amount: raw("30.1"),
        promotion_id: "promo_GB-A",
        description: null,
        is_tax_inclusive: true,
        provider_id: null,
      },
      expect.objectContaining({ item_id: "oi_1b", amount: raw("10") }),
    ])
  })

  it("throws when an order item for a cart line is missing", () => {
    expect(() =>
      cartAdjustmentsForOrder([{ variant_id: "v1", adjustments: [adj("GB-A", "1")] }], [])
    ).toThrow()
  })
})

// spec 04 ขั้น 4 (AC-4, AC-12 นับคนไม่ซ้ำ)
describe("joinProgress", () => {
  const progress = { progress_orders: 2, progress_units: 3, progress_people: 1 }

  it("join adds an order and units; people only for a new person", () => {
    expect(joinProgress(progress, 2, true)).toEqual({
      progress_orders: 3,
      progress_units: 5,
      progress_people: 2,
    })
    expect(joinProgress(progress, 1, false)).toEqual({
      progress_orders: 3,
      progress_units: 4,
      progress_people: 1,
    })
  })
})

// spec 04 leaveGroupWorkflow (AC-7): ลบออเดอร์และ units; people −1 เฉพาะ membership สุดท้ายของลูกค้าในกลุ่ม
describe("leaveProgress", () => {
  const progress = { progress_orders: 2, progress_units: 3, progress_people: 1 }

  it("leave removes an order and its units; people only for the last membership", () => {
    expect(leaveProgress(progress, 2, false)).toEqual({
      progress_orders: 1,
      progress_units: 1,
      progress_people: 1,
    })
    expect(leaveProgress(progress, 1, true)).toEqual({
      progress_orders: 1,
      progress_units: 2,
      progress_people: 0,
    })
  })
})

// spec 04 กฎข้อ 13 (AC-25): ของคนอื่น/ไม่พบ → 404; cancelled แล้วหรือกลุ่มไม่ open → 400
describe("assertLeaveAllowed", () => {
  const membership = { customer_id: "cus_a", status: "joined" }
  const group = { status: "open", ends_at: new Date(now.getTime() + HOUR) }
  const errorOf = (fn: () => void) => {
    try {
      fn()
    } catch (e) {
      return e as MedusaError
    }
    throw new Error("expected an error")
  }

  it("allows the owner of a joined membership in an open group", () => {
    expect(() => assertLeaveAllowed({ now, membership, group, customer_id: "cus_a" })).not.toThrow()
  })

  it("missing or someone else's membership → not_found", () => {
    expect(
      errorOf(() => assertLeaveAllowed({ now, membership: undefined, group, customer_id: "cus_a" })).type
    ).toEqual(MedusaError.Types.NOT_FOUND)
    expect(errorOf(() => assertLeaveAllowed({ now, membership, group, customer_id: "cus_b" })).type).toEqual(
      MedusaError.Types.NOT_FOUND
    )
  })

  it.each([
    ["cancelled membership", { ...membership, status: "cancelled" }, group],
    ["awaiting_payment membership", { ...membership, status: "awaiting_payment" }, group],
    ["succeeded group", membership, { ...group, status: "succeeded" }],
    ["failed group", membership, { ...group, status: "failed" }],
    // session หลัก 2026-10-26: ตีความกฎข้อ 13 — กลุ่ม open ที่หมดเวลาแล้ว (job ยังไม่ตัดสิน) ออกไม่ได้ เหมือน join
    ["open group past its ends_at", membership, { ...group, ends_at: now }],
  ])("%s → not_allowed", (_, m, g) => {
    expect(errorOf(() => assertLeaveAllowed({ now, membership: m, group: g, customer_id: "cus_a" })).type).toEqual(
      MedusaError.Types.NOT_ALLOWED
    )
  })
})
