import { GET as listActive } from "../campaigns/active/route"
import { GET as getGroup } from "../groups/[token]/route"

// GB-11 (review #230): route สาธารณะต้องไม่โหลดกลุ่มตามจำนวน team ที่ลูกค้าสร้างได้ไม่จำกัด และไม่ 500 เมื่อข้อมูลไม่ครบ
const productRule = { attribute: "items.product.id", operator: "in", values: [{ value: "prod_x" }] }
const campaign = (id: string, endsInMs: number) => ({
  id,
  name: id,
  status: "active",
  target_type: "orders",
  target_value: 3,
  group_mode: "both",
  max_people_per_group: null,
  max_units_per_person: null,
  team_duration_hours: 2,
  pay_within_hours: 24,
  campaign: { starts_at: null, ends_at: new Date(Date.now() + endsInMs).toISOString() },
  promotion: {
    application_method: { type: "percentage", value: 30, currency_code: null, target_rules: [productRule] },
  },
})
const pool = (id: string, campaignId: string) => ({
  id,
  campaign_id: campaignId,
  name: null,
  kind: "pool",
  join_token: `tok_${id}`,
  status: "open",
  starts_at: new Date().toISOString(),
  ends_at: new Date(Date.now() + 3600_000).toISOString(),
  progress_orders: 0,
  progress_units: 0,
  progress_people: 0,
})

const call = async (handler: typeof listActive, graph: jest.Mock, params = {}) => {
  const res = { json: jest.fn() }
  await handler({ scope: { resolve: () => ({ graph }) }, params } as never, res as never)
  return { graph, body: res.json.mock.calls[0]?.[0] }
}

describe("GET /store/group-buy/campaigns/active — queries", () => {
  it("reads campaigns without groups, then only open, unexpired pools of the live campaigns (2 fixed queries)", async () => {
    const graph = jest.fn(async ({ entity }: { entity: string }) =>
      entity === "group_buy_campaign"
        ? { data: [campaign("gbcamp_b", 7200_000), campaign("gbcamp_a", 3600_000)] }
        : { data: [pool("gbgrp_1", "gbcamp_a"), pool("gbgrp_2", "gbcamp_b")] }
    )
    const { body } = await call(listActive, graph)

    expect(graph).toHaveBeenCalledTimes(2)
    const [first, second] = graph.mock.calls.map(
      ([arg]) => arg as { entity: string; fields: string[]; filters: unknown }
    )
    expect(first.entity).toEqual("group_buy_campaign")
    expect(first.fields.some((f: string) => f.startsWith("groups."))).toBe(false)
    expect(second.entity).toEqual("group_buy_group")
    expect(second.filters).toEqual({
      // เฉพาะแคมเปญที่ผ่านกรอง หลังเรียง ends_at และตัด 50
      campaign_id: ["gbcamp_a", "gbcamp_b"],
      kind: "pool",
      status: "open",
      ends_at: { $gt: expect.any(Date) },
    })
    expect(body.campaigns.map((c: { id: string }) => c.id)).toEqual(["gbcamp_a", "gbcamp_b"])
    expect(body.campaigns.map((c: { pool_groups: { id: string }[] }) => c.pool_groups.map((g) => g.id))).toEqual([
      ["gbgrp_1"],
      ["gbgrp_2"],
    ])
  })

  it("no live campaign → no group query", async () => {
    const graph = jest.fn(async () => ({ data: [] }))
    const { body } = await call(listActive, graph)
    expect(graph).toHaveBeenCalledTimes(1)
    expect(body).toEqual({ campaigns: [] })
  })
})

describe("GET /store/group-buy/groups/:token — missing campaign", () => {
  it("group found but its campaign is missing → 404 not_found, not 500", async () => {
    const graph = jest.fn(async ({ entity }: { entity: string }) =>
      entity === "group_buy_group" ? { data: [pool("gbgrp_1", "gbcamp_gone")] } : { data: [] }
    )
    await expect(call(getGroup, graph, { token: "tok_gbgrp_1" })).rejects.toMatchObject({ type: "not_found" })
  })
})
