import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { ActiveGroupBuyCampaign } from "@lib/util/home-campaigns"

// GB-7c (spec 04 กฎข้อ 29a, AC-48): ไม่มีแคมเปญ active ทั้งสองแบบ → ไม่มีส่วน `home-campaigns` (render ว่าง)
vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({ sdk: { client: { fetch: vi.fn() } } }))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useParams: () => ({ countryCode: "th" }) }))

const campaign: ActiveGroupBuyCampaign = {
  id: "gbc_1",
  name: "แคมเปญ",
  starts_at: null,
  ends_at: null,
  target_type: "orders",
  target_value: 5,
  group_mode: "both",
  max_people_per_group: null,
  max_units_per_person: null,
  team_duration_hours: 24,
  pay_within_hours: 24,
  discount: { type: "percentage", value: 10, currency_code: null },
  product_id: "prod_1",
  pool_groups: [],
}

const render = async (groupCampaigns: ActiveGroupBuyCampaign[]) => {
  const { default: HomeCampaigns } = await import("@modules/home/components/campaigns")
  return renderToStaticMarkup(
    createElement(HomeCampaigns, { flashSales: [], groupCampaigns, products: [], countryCode: "th", now: 0 })
  )
}

describe("HomeCampaigns (AC-48)", () => {
  it("ไม่มีแคมเปญทั้งสองแบบ → ไม่ render อะไรเลย", async () => {
    expect(await render([])).toBe("")
  })

  it("มีแคมเปญ group buy → มี home-campaigns และการ์ด", async () => {
    const html = await render([campaign])
    expect(html).toContain('data-testid="home-campaigns"')
    expect(html).toContain('data-testid="group-campaign-card"')
  })
})
