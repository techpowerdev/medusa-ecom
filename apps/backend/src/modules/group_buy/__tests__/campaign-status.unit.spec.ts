import { MedusaError } from "@medusajs/framework/utils"
import {
  assertCampaignActivatable,
  assertCampaignPatchAllowed,
  resolveCampaignStatusTransition,
} from "../utils/campaign-status"

const notAllowed = expect.objectContaining({ type: MedusaError.Types.NOT_ALLOWED })

// spec 04 กฎข้อ 10 + AC-21a: draft → active → ended, ended เป็นสถานะสุดท้าย, ตั้งค่าเดิมซ้ำ = no-op
describe("resolveCampaignStatusTransition", () => {
  it.each([
    ["draft", "active"],
    ["active", "ended"],
  ] as const)("allows %s → %s", (from, to) => {
    expect(resolveCampaignStatusTransition(from, to)).toEqual("transition")
  })

  it.each([
    ["draft", "draft"],
    ["active", "active"],
    ["ended", "ended"],
  ] as const)("treats %s → %s as a no-op", (from, to) => {
    expect(resolveCampaignStatusTransition(from, to)).toEqual("noop")
  })

  it.each([
    ["active", "draft"],
    ["ended", "active"],
    ["ended", "draft"],
    ["draft", "ended"],
  ] as const)("rejects %s → %s with NOT_ALLOWED", (from, to) => {
    expect(() => resolveCampaignStatusTransition(from, to)).toThrow(notAllowed)
  })
})

// spec 04 updateGroupBuyCampaignWorkflow: draft แก้ได้ทุกคอนฟิก; active แก้ได้เฉพาะ name, pay_within_hours; ended แก้ไม่ได้
describe("assertCampaignPatchAllowed", () => {
  it("allows any config field while draft", () => {
    expect(() =>
      assertCampaignPatchAllowed("draft", {
        name: "x",
        target_value: 5,
        group_mode: "team",
        max_people_per_group: 3,
      })
    ).not.toThrow()
  })

  it("allows name and pay_within_hours while active", () => {
    expect(() =>
      assertCampaignPatchAllowed("active", { name: "x", pay_within_hours: 12 })
    ).not.toThrow()
  })

  it.each(["target_value", "target_type", "group_mode", "max_total_orders"])(
    "rejects %s while active",
    (field) => {
      expect(() => assertCampaignPatchAllowed("active", { [field]: 1 })).toThrow(notAllowed)
    }
  )

  it("rejects any change once ended", () => {
    expect(() => assertCampaignPatchAllowed("ended", { name: "x" })).toThrow(notAllowed)
  })
})

// spec 04 setGroupBuyCampaignStatusWorkflow: draft → active ต้องมี template ที่มี application_method
// และ Medusa campaign มี ends_at > now
describe("assertCampaignActivatable", () => {
  const now = new Date("2026-11-01T00:00:00.000Z")

  it("passes with a template and a future ends_at", () => {
    expect(() =>
      assertCampaignActivatable({
        hasTemplateApplicationMethod: true,
        endsAt: new Date("2026-11-02T00:00:00.000Z"),
        now,
      })
    ).not.toThrow()
  })

  it("rejects a campaign without a template application method", () => {
    expect(() =>
      assertCampaignActivatable({
        hasTemplateApplicationMethod: false,
        endsAt: new Date("2026-11-02T00:00:00.000Z"),
        now,
      })
    ).toThrow(notAllowed)
  })

  it.each([
    ["missing", null],
    ["in the past", new Date("2026-10-31T00:00:00.000Z")],
    ["equal to now", now],
  ])("rejects an ends_at that is %s", (_label, endsAt) => {
    expect(() =>
      assertCampaignActivatable({ hasTemplateApplicationMethod: true, endsAt, now })
    ).toThrow(notAllowed)
  })
})
