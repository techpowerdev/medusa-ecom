import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  ChangeActionType,
  ContainerRegistrationKeys,
  generateEntityId,
  MedusaError,
  Modules,
  PromotionActions,
} from "@medusajs/framework/utils"
import type { MedusaContainer, RemoteQueryFunction } from "@medusajs/framework/types"
import {
  acquireLockStep,
  cancelOrderWorkflow,
  createOrderWorkflow,
  emitEventStep,
  releaseLockStep,
  updateCartPromotionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { assertCartOwner } from "../../lib/store-ownership"
import { GROUP_BUY_MODULE } from "../../modules/group_buy"
import { GB_DISCOUNT_NOT_APPLIED } from "../../modules/group_buy/errors"
import type GroupBuyModuleService from "../../modules/group_buy/service"
import type { AddGroupMembershipInput } from "../../modules/group_buy/service"
import type { GroupBuyCampaignStatus } from "../../modules/group_buy/utils/campaign-status"
import {
  assertJoinAllowed,
  cartAdjustmentsForOrder,
  itemMatchesTargetRules,
  type TargetRule,
} from "../../modules/group_buy/utils/join"
import { isTargetReached } from "../../modules/group_buy/utils/target"

export const GROUP_BUY_GROUP_SUCCEEDED = "group_buy.group.succeeded"
export const ACTIVE_MEMBERSHIP_STATUSES = ["joined", "awaiting_payment", "paid"]
// ADR-009: ttl ต้องยาวกว่าการ join หนึ่งครั้ง; timeout = เวลารอคิวของ join ที่ยิงพร้อมกัน
export const LOCK_TIMEOUT = 30
export const LOCK_TTL = 60

export type JoinGroupInput = { join_token: string; cart_id: string; customer_id: string }

const toDate = (value?: string | Date | null) => (value ? new Date(value) : null)

const queryOf = (container: MedusaContainer) =>
  container.resolve<RemoteQueryFunction>(ContainerRegistrationKeys.QUERY)

// ขั้น 0 (อ่านอย่างเดียว): หา group จาก token เพื่อรู้ scope ของ lock (ADR-009 ข้อ 4)
export const resolveJoinTargetStep = createStep(
  "resolve-join-target",
  async (input: JoinGroupInput, { container }) => {
    const service: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
    const [group] = await service.listGroupBuyGroups(
      { join_token: input.join_token },
      { select: ["id", "campaign_id"], relations: ["campaign"] }
    )
    if (!group) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Group not found")
    }
    return new StepResponse({
      group_id: group.id,
      campaign_id: group.campaign_id,
      locks: {
        // เฉพาะเมื่อตั้ง max_total_orders — array ว่าง = acquireLockStep ไม่ทำอะไร
        campaign: group.campaign?.max_total_orders ? [`group_buy:campaign:${group.campaign_id}`] : [],
        group: `group_buy:group:${group.id}`,
        customer: `group_buy:customer:${group.campaign_id}:${input.customer_id}`,
      },
    })
  }
)

type GroupForJoin = {
  id: string
  campaign_id: string
  status: string
  ends_at: string | Date
  progress_people: number
  promotion?: { code: string; application_method?: { target_rules?: TargetRule[] | null } | null } | null
}

type CampaignForJoin = {
  status: GroupBuyCampaignStatus
  max_total_orders: number | null
  max_units_per_person: number | null
  max_people_per_group: number | null
  campaign?: { starts_at?: string | Date | null; ends_at?: string | Date | null } | null
}

type CartForJoin = {
  items?: ({ quantity: number } & Record<string, unknown>)[] | null
  promotions?: ({ code?: string | null; is_automatic?: boolean | null } | null)[] | null
}

// ขั้น 1 (ภายใต้ lock, อ่านอย่างเดียว): เจ้าของ cart (CORE-12) → แคมเปญ/กลุ่ม → ข้อจำกัด (spec 04, ADR-009)
export const validateJoinStep = createStep(
  "validate-join",
  async (input: JoinGroupInput & { group_id: string }, { container }) => {
    const query = queryOf(container)
    // ADR-013 ข้อ 3: cart ของคนอื่น/ไม่พบ → 404 ก่อนอ่านอย่างอื่น (AC-24)
    await assertCartOwner(query, input.cart_id, input.customer_id)

    const { data: groups } = await query.graph({
      entity: "group_buy_group",
      fields: [
        "id",
        "campaign_id",
        "status",
        "ends_at",
        "progress_people",
        "promotion.code",
        "promotion.application_method.target_rules.attribute",
        "promotion.application_method.target_rules.operator",
        "promotion.application_method.target_rules.values.value",
      ],
      filters: { id: input.group_id },
    })
    const group = groups[0] as unknown as GroupForJoin | undefined
    if (!group) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Group not found")
    }
    if (!group.promotion?.code) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "The group has no promotion")
    }
    const rules = group.promotion.application_method?.target_rules ?? []

    // ช่วงเวลามาจาก Medusa campaign ผ่าน link (แก้ starts_at หลังสร้างกลุ่มได้ — AC-23)
    const { data: campaigns } = await query.graph({
      entity: "group_buy_campaign",
      fields: [
        "status",
        "max_total_orders",
        "max_units_per_person",
        "max_people_per_group",
        "campaign.starts_at",
        "campaign.ends_at",
      ],
      filters: { id: group.campaign_id },
    })
    const campaign = campaigns[0] as unknown as CampaignForJoin | undefined
    if (!campaign) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Group buy campaign not found")
    }

    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "items.quantity",
        ...rules.map((r) => r.attribute),
        "promotions.code",
        "promotions.is_automatic",
      ],
      filters: { id: input.cart_id },
    })
    const cart = carts[0] as unknown as CartForJoin
    const items = cart.items ?? []

    const service: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
    const customerMemberships = await service.listGroupBuyMemberships(
      {
        campaign_id: group.campaign_id,
        customer_id: input.customer_id,
        status: ACTIVE_MEMBERSHIP_STATUSES,
      } as any,
      { select: ["group_id", "units"] }
    )
    const campaignMembershipCount = campaign.max_total_orders
      ? (
          await service.listAndCountGroupBuyMemberships(
            { campaign_id: group.campaign_id, status: ACTIVE_MEMBERSHIP_STATUSES } as any,
            { select: ["id"], take: 1 }
          )
        )[1]
      : 0

    const cartUnits = items.reduce((sum, i) => sum + Number(i.quantity), 0)
    const { isNewPerson } = assertJoinAllowed({
      now: new Date(),
      campaign: {
        ...campaign,
        starts_at: toDate(campaign.campaign?.starts_at),
        ends_at: toDate(campaign.campaign?.ends_at),
      },
      group: { ...group, ends_at: new Date(group.ends_at) },
      cartUnits,
      cartManualCodes: (cart.promotions ?? [])
        .filter((p) => p?.is_automatic !== true)
        .map((p) => p?.code ?? ""),
      itemsEligible: items.every((item) => itemMatchesTargetRules(item, rules)),
      customerMemberships: customerMemberships.map((m) => ({ group_id: m.group_id, units: m.units })),
      campaignMembershipCount,
    })

    return new StepResponse({
      code: group.promotion.code,
      units: cartUnits,
      isNewPerson,
      membership_id: generateEntityId(undefined, "gbmem"),
    })
  }
)

const cartCodes = async (container: MedusaContainer, cartId: string) => {
  const { data } = await queryOf(container).graph({
    entity: "cart",
    fields: ["promotions.code"],
    filters: { id: cartId },
  })
  return ((data[0]?.promotions ?? []) as { code?: string }[]).map((p) => p?.code)
}

// ขั้น 2: ใส่ GB-<token> (flash หลุดเองผ่าน hook ของ PROMO-1) — compensation เอา code ออก (เฉพาะเมื่อขั้นนี้ใส่เอง)
export const applyGroupCodeStep = createStep(
  "apply-group-code",
  async (input: { cart_id: string; code: string }, { container }) => {
    const added = !(await cartCodes(container, input.cart_id)).includes(input.code)
    await updateCartPromotionsWorkflow(container).run({
      input: { cart_id: input.cart_id, promo_codes: [input.code], action: PromotionActions.ADD },
    })
    return new StepResponse(undefined, added ? input : undefined)
  },
  async (applied, { container }) => {
    if (!applied) {
      return
    }
    await updateCartPromotionsWorkflow(container).run({
      input: { cart_id: applied.cart_id, promo_codes: [applied.code], action: PromotionActions.REMOVE },
    })
  }
)

// ขั้น 2b แยกจากขั้น 2: step ที่ throw ไม่รัน compensation ของตัวเอง — ถ้ารวมกัน GB-<token> จะค้างใน cart (AC-23)
export const assertGroupDiscountAppliedStep = createStep(
  "assert-group-discount-applied",
  async (input: { cart_id: string; code: string }, { container }) => {
    const { data } = await queryOf(container).graph({
      entity: "cart",
      fields: ["items.adjustments.code"],
      filters: { id: input.cart_id },
    })
    const items = (data[0]?.items ?? []) as { adjustments?: { code?: string }[] }[]
    if (!items.some((i) => (i?.adjustments ?? []).some((a) => a?.code === input.code))) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "The group buy discount could not be applied to this cart",
        GB_DISCOUNT_NOT_APPLIED
      )
    }
    return new StepResponse(undefined)
  }
)

const ADDRESS_FIELDS = [
  "first_name",
  "last_name",
  "company",
  "address_1",
  "address_2",
  "city",
  "province",
  "postal_code",
  "country_code",
  "phone",
]

const pick = (row: Record<string, unknown> | null | undefined) =>
  row ? Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, row[f] ?? undefined])) : undefined

// ขั้น 3: draft order จาก cart (pattern ของตัวอย่าง Quotes) — draft order ไม่จอง inventory (กฎข้อ 6)
// compensation: ยกเลิก order (step ถัดไปล้ม → order ถูกยกเลิก)
export const createGroupDraftOrderStep = createStep(
  "create-group-draft-order",
  async (
    input: { cart_id: string; code: string; group_id: string; membership_id: string },
    { container }
  ) => {
    const { data } = await queryOf(container).graph({
      entity: "cart",
      fields: [
        "region_id",
        "customer_id",
        "email",
        "sales_channel_id",
        "currency_code",
        "shipping_address.*",
        "billing_address.*",
        "items.variant_id",
        "items.quantity",
        "items.unit_price",
        "items.is_tax_inclusive",
        "items.metadata",
        "shipping_methods.name",
        "shipping_methods.amount",
        "shipping_methods.is_tax_inclusive",
        "shipping_methods.shipping_option_id",
        "shipping_methods.data",
      ],
      filters: { id: input.cart_id },
    })
    const cart = data[0] as any
    const { result: order } = await createOrderWorkflow(container).run({
      input: {
        is_draft_order: true,
        status: "pending",
        region_id: cart.region_id,
        customer_id: cart.customer_id,
        email: cart.email ?? undefined,
        sales_channel_id: cart.sales_channel_id ?? undefined,
        currency_code: cart.currency_code,
        shipping_address: pick(cart.shipping_address),
        billing_address: pick(cart.billing_address),
        items: (cart.items ?? []).map((i: any) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          is_tax_inclusive: i.is_tax_inclusive,
          metadata: i.metadata ?? undefined,
        })),
        shipping_methods: (cart.shipping_methods ?? []).map((m: any) => ({
          name: m.name,
          amount: m.amount,
          is_tax_inclusive: m.is_tax_inclusive,
          shipping_option_id: m.shipping_option_id ?? undefined,
          data: m.data ?? undefined,
        })),
        // link order ↔ promotion; adjustment จริงมาจาก freezeDraftOrderAdjustmentsStep
        promo_codes: [input.code],
        metadata: {
          group_buy_group_id: input.group_id,
          group_buy_membership_id: input.membership_id,
        },
      } as any,
    })
    return new StepResponse(order, order.id)
  },
  async (orderId, { container }) => {
    if (!orderId) {
      return
    }
    await cancelOrderWorkflow(container).run({ input: { order_id: orderId } })
  }
)

// ขั้น 3 (ต่อ) กฎข้อ 5: freeze ส่วนลดที่ Medusa คำนวณบน cart ลง draft order
// createOrderWorkflow 2.22.1 คำนวณ promotion ใหม่จาก order ที่ไม่มี items.product จึงไม่เข้า target rule ของ
// GB-<token> (ส่วนลดหาย) — แทนด้วย adjustment ของ cart ทั้งชุด ไม่คำนวณส่วนลดเอง; ไม่มี compensation
// เพราะ order ถูกยกเลิกโดย compensation ของขั้นก่อนหน้า
// GB-3c (กฎข้อ 18): ใส่ adjustment ผ่าน order change (ITEM_ADJUSTMENTS_REPLACE) แล้ว confirm — Order module คำนวณ
// summary (current_order_total/pending_difference) ใหม่จากยอดหลังส่วนลดเอง ไม่เขียนตัวเลข summary เอง
export const freezeDraftOrderAdjustmentsStep = createStep(
  "freeze-draft-order-adjustments",
  async (input: { cart_id: string; order_id: string }, { container }) => {
    const query = queryOf(container)
    const [{ data: carts }, { data: orders }] = await Promise.all([
      query.graph({
        entity: "cart",
        fields: [
          "items.variant_id",
          "items.adjustments.code",
          "items.adjustments.raw_amount",
          "items.adjustments.promotion_id",
          "items.adjustments.description",
          "items.adjustments.is_tax_inclusive",
          "items.adjustments.provider_id",
        ],
        filters: { id: input.cart_id },
      }),
      query.graph({
        entity: "order",
        fields: ["items.id", "items.variant_id"],
        filters: { id: input.order_id },
      }),
    ])
    const orderItems = (orders[0]?.items ?? []) as any[]
    const adjustments = cartAdjustmentsForOrder((carts[0]?.items ?? []) as any[], orderItems)
    const orderModule = container.resolve(Modules.ORDER)
    const change = await orderModule.createOrderChange({
      order_id: input.order_id,
      change_type: "edit",
      description: "group-buy: freeze GB- adjustments",
    })
    // replace ทุก item (รวม item ที่ไม่มีส่วนลด → []) แทน adjustment ที่ createOrderWorkflow คำนวณไว้
    await orderModule.addOrderAction(
      orderItems.map((item) => ({
        order_change_id: change.id,
        order_id: input.order_id,
        action: ChangeActionType.ITEM_ADJUSTMENTS_REPLACE,
        details: {
          reference_id: item.id,
          adjustments: adjustments.filter((a) => a.item_id === item.id),
        },
      })) as any
    )
    await orderModule.confirmOrderChange(change.id)
    return new StepResponse(undefined)
  }
)

// ขั้น 4 (ภายใต้ lock ของกลุ่ม): membership + ตัวนับใน transaction เดียว (service) — compensation: ลบ membership
// และคืนตัวนับเดิมใน transaction เดียว
export const createGroupMembershipStep = createStep(
  "create-group-membership",
  async (input: AddGroupMembershipInput, { container }) => {
    const service: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
    const { membership, before, progress } = await service.addGroupMembership(input)
    const campaign = await service.retrieveGroupBuyCampaign(input.campaign_id, {
      select: ["target_type", "target_value"],
    })
    return new StepResponse(
      { membership, reached: isTargetReached(campaign, progress) },
      { membership_id: membership.id, group_id: input.group_id, before }
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service: GroupBuyModuleService = container.resolve(GROUP_BUY_MODULE)
    await service.revertGroupMembership(undo)
  }
)

// spec 04 joinGroupWorkflow — lock ตามลำดับ ADR-009: campaign (เมื่อตั้ง max_total_orders) → group → customer
// ขั้น 1–4 อยู่ภายใต้ lock ชุดเดียวกัน; step ที่ล้มทำให้ compensation ของ step ก่อนหน้ารัน (รวม release lock)
export const joinGroupWorkflow = createWorkflow("join-group", function (input: JoinGroupInput) {
  const target = resolveJoinTargetStep(input)

  acquireLockStep({ key: target.locks.campaign, timeout: LOCK_TIMEOUT, ttl: LOCK_TTL }).config({
    name: "acquire-group-buy-campaign-lock",
  })
  acquireLockStep({ key: target.locks.group, timeout: LOCK_TIMEOUT, ttl: LOCK_TTL }).config({
    name: "acquire-group-buy-group-lock",
  })
  acquireLockStep({ key: target.locks.customer, timeout: LOCK_TIMEOUT, ttl: LOCK_TTL }).config({
    name: "acquire-group-buy-customer-lock",
  })

  const checked = validateJoinStep(
    transform({ input, target }, ({ input, target }) => ({ ...input, group_id: target.group_id }))
  )
  const codeInput = transform({ input, checked }, ({ input, checked }) => ({
    cart_id: input.cart_id,
    code: checked.code,
  }))
  applyGroupCodeStep(codeInput)
  assertGroupDiscountAppliedStep(codeInput)

  const order = createGroupDraftOrderStep(
    transform({ input, checked, target }, ({ input, checked, target }) => ({
      cart_id: input.cart_id,
      code: checked.code,
      group_id: target.group_id,
      membership_id: checked.membership_id,
    }))
  )
  freezeDraftOrderAdjustmentsStep(
    transform({ input, order }, ({ input, order }) => ({ cart_id: input.cart_id, order_id: order.id }))
  )

  const joined = createGroupMembershipStep(
    transform({ input, checked, target, order }, ({ input, checked, target, order }) => ({
      id: checked.membership_id,
      group_id: target.group_id,
      campaign_id: target.campaign_id,
      customer_id: input.customer_id,
      order_id: order.id,
      units: checked.units,
      isNewPerson: checked.isNewPerson,
    }))
  )

  when({ joined }, ({ joined }) => joined.reached).then(() => {
    emitEventStep({
      eventName: GROUP_BUY_GROUP_SUCCEEDED,
      data: transform({ target }, ({ target }) => ({ id: target.group_id })),
    })
  })

  releaseLockStep({
    key: transform({ target }, ({ target }) => [
      ...target.locks.campaign,
      target.locks.group,
      target.locks.customer,
    ]),
  })

  return new WorkflowResponse(joined.membership)
})
