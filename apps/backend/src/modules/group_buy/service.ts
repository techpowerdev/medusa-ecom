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
import { joinProgress, leaveProgress } from "./utils/join"
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

export type CancelGroupMembershipInput = {
  membership_id: string
  group_id: string
  isLastMembership: boolean
}

export type RestoreGroupMembershipInput = {
  membership_id: string
  group_id: string
  before: GroupBuyProgress
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

  // spec 04 leaveGroupWorkflow: membership → cancelled + ตัวนับของกลุ่มใน transaction เดียว
  @InjectManager()
  async cancelGroupMembership(
    input: CancelGroupMembershipInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    return await this.cancelGroupMembership_(input, sharedContext)
  }

  // compensation ของ cancelGroupMembership — membership กลับเป็น joined และคืนตัวนับเดิมใน transaction เดียว
  @InjectManager()
  async restoreGroupMembership(
    input: RestoreGroupMembershipInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    await this.restoreGroupMembership_(input, sharedContext)
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

  @InjectTransactionManager()
  protected async cancelGroupMembership_(
    input: CancelGroupMembershipInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    const membership = await this.retrieveGroupBuyMembership(input.membership_id, {}, sharedContext)
    const group = await this.retrieveGroupBuyGroup(input.group_id, {}, sharedContext)
    const before = progressOf(group)
    const [cancelled] = await this.updateGroupBuyMemberships(
      [{ id: membership.id, status: "cancelled" as const }],
      sharedContext
    )
    const progress = leaveProgress(before, membership.units, input.isLastMembership)
    await this.updateGroupBuyGroups({ id: input.group_id, ...progress }, sharedContext)
    return { membership: cancelled, before }
  }

  @InjectTransactionManager()
  protected async restoreGroupMembership_(
    input: RestoreGroupMembershipInput,
    @MedusaContext() sharedContext: Context = {}
  ) {
    await this.updateGroupBuyMemberships(
      [{ id: input.membership_id, status: "joined" as const }],
      sharedContext
    )
    await this.updateGroupBuyGroups({ id: input.group_id, ...input.before }, sharedContext)
  }
}

export default GroupBuyModuleService
