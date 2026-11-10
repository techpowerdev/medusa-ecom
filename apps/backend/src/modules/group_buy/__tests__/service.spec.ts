import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { GROUP_BUY_MODULE } from ".."
import GroupBuyCampaign from "../models/group-buy-campaign"
import GroupBuyGroup from "../models/group-buy-group"
import GroupBuyMembership from "../models/group-buy-membership"
import GroupBuyModuleService from "../service"

jest.setTimeout(60 * 1000)

// GB-1: data layer ของ module group_buy (spec 04 "Data model", ADR-009, docs/design/data-model.md)
moduleIntegrationTestRunner<GroupBuyModuleService>({
  moduleName: GROUP_BUY_MODULE,
  moduleModels: [GroupBuyCampaign, GroupBuyGroup, GroupBuyMembership],
  resolve: "./src/modules/group_buy",
  testSuite: ({ service, MikroOrmWrapper }) => {
    const endsAt = new Date("2026-11-11T00:00:00.000Z")

    async function createCampaign(data: Record<string, unknown> = {}) {
      return service.createGroupBuyCampaigns({
        name: "11.11 group buy",
        target_type: "orders",
        target_value: 3,
        group_mode: "pool",
        ...data,
      })
    }

    async function createGroup(campaignId: string, data: Record<string, unknown> = {}) {
      return service.createGroupBuyGroups({
        campaign_id: campaignId,
        kind: "pool",
        join_token: `tok_${Math.random().toString(36).slice(2)}`,
        starts_at: new Date("2026-11-01T00:00:00.000Z"),
        ends_at: endsAt,
        ...data,
      })
    }

    function membership(campaignId: string, groupId: string, data: Record<string, unknown> = {}) {
      return {
        campaign_id: campaignId,
        group_id: groupId,
        customer_id: "cus_1",
        order_id: `order_${Math.random().toString(36).slice(2)}`,
        units: 1,
        joined_at: new Date(),
        ...data,
      }
    }

    describe("GroupBuyCampaign", () => {
      it("creates a campaign with defaults (status=draft, pay_within_hours=24, nullable limits)", async () => {
        const campaign = await createCampaign()

        expect(campaign).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^gbcamp_/),
            name: "11.11 group buy",
            target_type: "orders",
            target_value: 3,
            group_mode: "pool",
            status: "draft",
            pay_within_hours: 24,
            max_total_orders: null,
            max_units_per_person: null,
            max_people_per_group: null,
            team_duration_hours: null,
          })
        )
      })

      it.each([
        ["target_type", { target_type: "likes" }],
        ["group_mode", { group_mode: "solo" }],
        ["status", { status: "paused" }],
      ])("rejects an unknown %s", async (_field, data) => {
        await expect(createCampaign(data)).rejects.toThrow()
      })

      it.each([
        ["target_value", { target_value: 0 }],
        ["max_total_orders", { max_total_orders: 0 }],
        ["max_units_per_person", { max_units_per_person: 0 }],
        ["max_people_per_group", { max_people_per_group: 0 }],
        ["team_duration_hours", { team_duration_hours: 0 }],
        ["pay_within_hours", { pay_within_hours: 0 }],
      ])("rejects non-positive %s at the database level", async (_field, data) => {
        await expect(createCampaign(data)).rejects.toThrow()
      })
    })

    describe("GroupBuyGroup", () => {
      it("creates an open group with zeroed progress counters", async () => {
        const campaign = await createCampaign()
        const group = await createGroup(campaign.id, { join_token: "abc123" })

        expect(group).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^gbgrp_/),
            campaign_id: campaign.id,
            kind: "pool",
            join_token: "abc123",
            status: "open",
            created_by_customer_id: null,
            name: null,
            succeeded_at: null,
            pay_deadline_at: null,
            progress_orders: 0,
            progress_units: 0,
            progress_people: 0,
          })
        )
        expect(new Date(group.ends_at)).toEqual(endsAt)
      })

      it("requires a unique join_token", async () => {
        const campaign = await createCampaign()
        await createGroup(campaign.id, { join_token: "dup" })

        await expect(createGroup(campaign.id, { join_token: "dup" })).rejects.toThrow()
      })

      it("rejects negative progress counters at the database level", async () => {
        const campaign = await createCampaign()
        await expect(createGroup(campaign.id, { progress_units: -1 })).rejects.toThrow()
      })

      it("lists groups by campaign with the campaign relation", async () => {
        const campaign = await createCampaign()
        const team = await createGroup(campaign.id, {
          kind: "team",
          created_by_customer_id: "cus_1",
        })

        const [fetched] = await service.listGroupBuyGroups(
          { campaign_id: campaign.id },
          { relations: ["campaign"] }
        )
        expect(fetched.id).toEqual(team.id)
        expect(fetched.campaign.id).toEqual(campaign.id)
      })
    })

    describe("GroupBuyMembership", () => {
      // GB-8 (spec 04 กฎข้อ 21, AC-39): route ของลูกค้าหา membership ด้วย customer_id เรียง joined_at — index ต้องขึ้นต้นด้วย customer_id
      it("has a (customer_id, joined_at) index on group_buy_membership", async () => {
        const rows: { indexdef: string }[] = await MikroOrmWrapper.getManager()
          .getConnection()
          .execute(`SELECT indexdef FROM pg_indexes WHERE tablename = 'group_buy_membership'`)
        expect(
          rows.some((r) => /\(customer_id, joined_at\) WHERE \(deleted_at IS NULL\)/.test(r.indexdef))
        ).toBe(true)
      })

      it("creates a joined membership linked to its group and campaign", async () => {
        const campaign = await createCampaign()
        const group = await createGroup(campaign.id)

        const created = await service.createGroupBuyMemberships(
          membership(campaign.id, group.id, { order_id: "order_1", units: 2 })
        )

        expect(created).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^gbmem_/),
            campaign_id: campaign.id,
            group_id: group.id,
            customer_id: "cus_1",
            order_id: "order_1",
            units: 2,
            status: "joined",
          })
        )
      })

      // ADR-009: 1 membership = 1 draft order; ลูกค้าคนเดียวมีได้หลายแถวในกลุ่มเดียว (AC-12)
      it("allows the same customer to hold several memberships in one group", async () => {
        const campaign = await createCampaign()
        const group = await createGroup(campaign.id)

        await service.createGroupBuyMemberships([
          membership(campaign.id, group.id, { customer_id: "cus_1" }),
          membership(campaign.id, group.id, { customer_id: "cus_1" }),
        ])

        const rows = await service.listGroupBuyMemberships({
          group_id: group.id,
          customer_id: "cus_1",
        })
        expect(rows).toHaveLength(2)
      })

      it("rejects a second membership for the same order_id", async () => {
        const campaign = await createCampaign()
        const group = await createGroup(campaign.id)
        await service.createGroupBuyMemberships(
          membership(campaign.id, group.id, { order_id: "order_dup" })
        )

        await expect(
          service.createGroupBuyMemberships(
            membership(campaign.id, group.id, {
              customer_id: "cus_2",
              order_id: "order_dup",
            })
          )
        ).rejects.toThrow()
      })

      it("rejects an unknown status and non-positive units", async () => {
        const campaign = await createCampaign()
        const group = await createGroup(campaign.id)

        await expect(
          service.createGroupBuyMemberships(
            membership(campaign.id, group.id, { status: "refunded" })
          )
        ).rejects.toThrow()
        await expect(
          service.createGroupBuyMemberships(membership(campaign.id, group.id, { units: 0 }))
        ).rejects.toThrow()
      })

      it("filters memberships of a customer across a campaign (campaign_id, customer_id)", async () => {
        const campaign = await createCampaign()
        const other = await createCampaign({ name: "other" })
        const g1 = await createGroup(campaign.id)
        const g2 = await createGroup(other.id)

        await service.createGroupBuyMemberships([
          membership(campaign.id, g1.id, { customer_id: "cus_1" }),
          membership(campaign.id, g1.id, { customer_id: "cus_2" }),
          membership(other.id, g2.id, { customer_id: "cus_1" }),
        ])

        const rows = await service.listGroupBuyMemberships({
          campaign_id: campaign.id,
          customer_id: "cus_1",
        })
        expect(rows.map((r) => r.group_id)).toEqual([g1.id])
      })
    })
  },
})
