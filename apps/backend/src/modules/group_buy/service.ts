import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import type { Context } from "@medusajs/framework/types"
import GroupBuyCampaign from "./models/group-buy-campaign"
import GroupBuyGroup from "./models/group-buy-group"
import GroupBuyMembership from "./models/group-buy-membership"
import { joinProgress } from "./utils/join"
import type { GroupBuyProgress } from "./utils/target"

export type AddGroupMembershipInput = {
  id: string
  group_id: string
  campaign_id: string
  customer_id: string
  order_id: string
  units: number
  isNewPerson: boolean
}

const progressOf = (g: GroupBuyProgress): GroupBuyProgress => ({
  progress_orders: g.progress_orders,
  progress_units: g.progress_units,
  progress_people: g.progress_people,
})

// logic ข้าม module (promotion, draft order, lock) อยู่ใน workflow — ที่นี่มีแค่ CRUD + การเขียนที่ต้องอยู่ใน transaction เดียว
class GroupBuyModuleService extends MedusaService({
  GroupBuyCampaign,
  GroupBuyGroup,
  GroupBuyMembership,
}) {
  // spec 04 joinGroupWorkflow ขั้น 4: membership + ตัวนับของกลุ่มใน transaction เดียว (ล้มกลางทาง → ไม่มีอะไรค้าง)
  @InjectManager()
  async addGroupMembership(
    input: AddGroupMembershipInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return await this.addGroupMembership_(input, sharedContext)
  }

  // compensation ของ addGroupMembership — ลบ membership และคืนตัวนับเดิมใน transaction เดียว
  @InjectManager()
  async revertGroupMembership(
    input: { membership_id: string; group_id: string; before: GroupBuyProgress },
    @MedusaContext() sharedContext: Context = {}
  ) {
    await this.revertGroupMembership_(input, sharedContext)
  }

  @InjectTransactionManager()
  protected async addGroupMembership_(
    input: AddGroupMembershipInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const group = await this.retrieveGroupBuyGroup(input.group_id, {}, sharedContext)
    const before = progressOf(group)
    const { isNewPerson, ...data } = input
    const membership = await this.createGroupBuyMemberships(
      { ...data, status: "joined" as const, joined_at: new Date() },
      sharedContext
    )
    const progress = joinProgress(before, input.units, isNewPerson)
    await this.updateGroupBuyGroups({ id: input.group_id, ...progress }, sharedContext)
    return { membership, before, progress }
  }

  @InjectTransactionManager()
  protected async revertGroupMembership_(
    input: { membership_id: string; group_id: string; before: GroupBuyProgress },
    @MedusaContext() sharedContext: Context = {}
  ) {
    await this.deleteGroupBuyMemberships(input.membership_id, sharedContext)
    await this.updateGroupBuyGroups({ id: input.group_id, ...input.before }, sharedContext)
  }
}

export default GroupBuyModuleService
