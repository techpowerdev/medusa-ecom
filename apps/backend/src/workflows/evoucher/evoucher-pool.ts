import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { updateInventoryItemsWorkflow } from "@medusajs/medusa/core-flows"
import { EVOUCHER_MODULE } from "../../modules/evoucher"
import EvoucherModuleService from "../../modules/evoucher/service"

export type CreateEvoucherPoolInput = {
  partner_id: string
  variant_id: string
  name: string
  how_to_use: string
  face_value?: number | null
  validity_note?: string | null
  low_stock_threshold?: number
}

// variant_id เปลี่ยนไม่ได้: inventory ของ variant ผูกกับ code ใน pool นี้
export type UpdateEvoucherPoolInput = Partial<
  Omit<CreateEvoucherPoolInput, "variant_id">
> & { id: string }

const FIELDS = [
  "id",
  "partner_id",
  "name",
  "how_to_use",
  "face_value",
  "validity_note",
  "low_stock_threshold",
]

// กฎข้อ 1: voucher variant ต้อง manage_inventory=true (inventory = จำนวน code available)
// กฎข้อ 14: inventory item เดียว (required_quantity=1) ที่ไม่มี variant อื่นใช้ร่วม — ไม่งั้น requires_shipping/stock กระทบ variant อื่น
// 404 ถ้า variant ไม่มีอยู่จริง (link pool → variant เป็น read-only ไม่มี FK)
export const validateEvoucherVariantStep = createStep(
  "validate-evoucher-variant",
  async (input: { variant_id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product_variant",
      fields: [
        "id",
        "manage_inventory",
        "inventory_items.inventory_item_id",
        "inventory_items.required_quantity",
        "inventory_items.inventory.variants.id",
      ],
      filters: { id: input.variant_id },
    })
    const variant = data[0]
    if (!variant) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Product variant ${input.variant_id} not found`
      )
    }
    const invalid = (message: string) => new MedusaError(MedusaError.Types.INVALID_DATA, message)
    const items = variant.inventory_items ?? []
    if (!variant.manage_inventory || !items.length) {
      throw invalid("Voucher variant must have manage_inventory=true with an inventory item")
    }
    const [item] = items
    const sharedWith = (item?.inventory?.variants ?? []).filter((v) => v?.id !== variant.id)
    if (items.length !== 1 || Number(item!.required_quantity) !== 1 || sharedWith.length) {
      throw invalid(
        "Voucher variant must have exactly one inventory item (required_quantity=1) that is not shared with another variant"
      )
    }
    return new StepResponse([item!.inventory_item_id])
  }
)

export const createEvoucherPoolStep = createStep(
  "create-evoucher-pool",
  async (input: CreateEvoucherPoolInput, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.retrieveEvoucherPartner(input.partner_id, { select: ["id"] })
    const pool = await service.createEvoucherPools(input)
    return new StepResponse(pool, pool.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.deleteEvoucherPools(id)
  }
)

export const updateEvoucherPoolStep = createStep(
  "update-evoucher-pool",
  async (input: UpdateEvoucherPoolInput, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    const { id, partner_id, name, how_to_use, face_value, validity_note, low_stock_threshold } =
      await service.retrieveEvoucherPool(input.id, { select: FIELDS })
    const previous = {
      id,
      partner_id,
      name,
      how_to_use,
      face_value,
      validity_note,
      low_stock_threshold,
    }
    if (input.partner_id) {
      await service.retrieveEvoucherPartner(input.partner_id, { select: ["id"] })
    }
    const pool = await service.updateEvoucherPools(input)
    return new StepResponse(pool, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.updateEvoucherPools(previous)
  }
)

export const deleteEvoucherPoolStep = createStep(
  "delete-evoucher-pool",
  async (input: { id: string }, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.retrieveEvoucherPool(input.id, { select: ["id"] })
    const [, codes] = await service.listAndCountEvoucherCodes(
      { pool_id: input.id },
      { select: ["id"], take: 1 }
    )
    if (codes > 0) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Pool has codes; only empty pools can be deleted"
      )
    }
    await service.softDeleteEvoucherPools(input.id)
    return new StepResponse(input.id, input.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.restoreEvoucherPools(id)
  }
)

export const createEvoucherPoolWorkflow = createWorkflow(
  "create-evoucher-pool",
  function (input: CreateEvoucherPoolInput) {
    const itemIds = validateEvoucherVariantStep({ variant_id: input.variant_id })
    // กฎข้อ 1: voucher ไม่ต้องจัดส่ง → line item ได้ requires_shipping=false จาก inventory item
    // (compensation ของ updateInventoryItemsWorkflow คืนค่าเดิมถ้าขั้นสร้าง pool ล้ม)
    const updates = transform({ itemIds }, ({ itemIds }) =>
      itemIds.map((id) => ({ id, requires_shipping: false }))
    )
    updateInventoryItemsWorkflow.runAsStep({ input: { updates } })
    return new WorkflowResponse(createEvoucherPoolStep(input))
  }
)

export const updateEvoucherPoolWorkflow = createWorkflow(
  "update-evoucher-pool",
  function (input: UpdateEvoucherPoolInput) {
    return new WorkflowResponse(updateEvoucherPoolStep(input))
  }
)

// กฎข้อ 15: inventory item ของ variant ใน pool (ว่างถ้า pool/variant ไม่มีแล้ว — ให้ขั้นลบตัดสิน 404 เอง)
export const resolveEvoucherPoolInventoryItemsStep = createStep(
  "resolve-evoucher-pool-inventory-items",
  async (input: { id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: pools } = await query.graph({
      entity: "evoucher_pool",
      fields: ["variant_id"],
      filters: { id: input.id },
    })
    if (!pools[0]) {
      return new StepResponse([] as string[])
    }
    const { data: variants } = await query.graph({
      entity: "product_variant",
      fields: ["inventory_items.inventory_item_id"],
      filters: { id: pools[0].variant_id },
    })
    return new StepResponse(
      (variants[0]?.inventory_items ?? []).map((i) => i!.inventory_item_id)
    )
  }
)

export const deleteEvoucherPoolWorkflow = createWorkflow(
  "delete-evoucher-pool",
  function (input: { id: string }) {
    const itemIds = resolveEvoucherPoolInventoryItemsStep(input)
    const deleted = deleteEvoucherPoolStep(input)
    // กฎข้อ 15 (Q7 ค่าเริ่มต้น): คืน requires_shipping=true (ค่าเริ่มต้นของ Medusa); ถ้าล้ม ขั้นลบ restore pool
    when({ itemIds }, ({ itemIds }) => itemIds.length > 0).then(() => {
      const updates = transform({ itemIds }, ({ itemIds }) =>
        itemIds.map((id) => ({ id, requires_shipping: true }))
      )
      updateInventoryItemsWorkflow.runAsStep({ input: { updates } })
    })
    return new WorkflowResponse(deleted)
  }
)
