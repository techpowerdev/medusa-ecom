import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  acquireLockStep,
  releaseLockStep,
  updateInventoryItemsWorkflow,
} from "@medusajs/medusa/core-flows"
import { EVOUCHER_MODULE } from "../../modules/evoucher"
import EvoucherModuleService from "../../modules/evoucher/service"
import {
  EVOUCHER_POOL_LOCK_TIMEOUT,
  EVOUCHER_POOL_LOCK_TTL,
  evoucherPoolLockKey,
  resolveEvoucherPoolInventoryStep,
} from "./import-evoucher-codes"
import { EvoucherStockLevel, readEvoucherStock } from "./void-evoucher-codes"

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

// กฎข้อ 1: voucher variant ต้อง manage_inventory=true (inventory = จำนวน code available) และ product ต้องไม่มี shipping profile
// (Medusa 2.22.1 ตั้ง line item requires_shipping=true ทุกครั้งที่ product มี shipping profile ใดๆ — prepare-line-item-data)
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
        "product.shipping_profile.id",
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
    if (variant.product?.shipping_profile?.id) {
      throw invalid(
        "Voucher product must not have a shipping profile (Medusa requires shipping for line items of any product with one). " +
          "Clear it on the product page (Shipping profile section) or via POST /admin/products/:id with { shipping_profile_id: null }, then try again"
      )
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

// EV-20 (กฎข้อ 36a/b): ลบ code ทั้งหมดของ pool (available/void) — 404 ถ้า pool ไม่มี, 400 ถ้ามี code ที่เคยจอง/ส่งให้ลูกค้า
export const softDeleteUnissuedEvoucherCodesStep = createStep(
  "soft-delete-unissued-evoucher-codes",
  async (input: { pool_id: string }, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.retrieveEvoucherPool(input.pool_id, { select: ["id"] })
    // ISO string: compensation data ต้อง serialize ได้ (workflow engine แบบ Redis)
    const deleted_at = new Date().toISOString()
    const counts = await service.softDeleteUnissuedPoolCodes(input.pool_id, new Date(deleted_at))
    return new StepResponse(counts, counts.total ? { pool_id: input.pool_id, deleted_at } : undefined)
  },
  async (data, { container }) => {
    if (!data) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.restorePoolCodes(data.pool_id, new Date(data.deleted_at))
  }
)

// EV-20 (กฎข้อ 36b + session หลักตัดสิน 2026-11-21): reservation ค้าง = order ที่รอชำระ/รอส่งรหัสจาก pool นี้ → 400
// ตรวจและลด stock ใต้ lock key เดียวกับ reserveInventoryStep ของ Medusa (inventory_item_id) แบบเดียวกับ voidEvoucherStockStep
// จึงไม่ใช้ adjustInventoryLevelsStep (ครอบด้วย lock เดียวกันซ้ำ = deadlock)
export const lowerDeletedEvoucherPoolStockStep = createStep(
  "lower-deleted-evoucher-pool-stock",
  async (input: EvoucherStockLevel & { available: number }, { container }) => {
    const inventory = container.resolve(Modules.INVENTORY)
    const level: EvoucherStockLevel = {
      inventory_item_id: input.inventory_item_id,
      location_id: input.location_id,
    }
    await container.resolve(Modules.LOCKING).execute([input.inventory_item_id], async () => {
      const { reserved } = await readEvoucherStock(container, level)
      if (reserved > 0) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Pool has orders awaiting payment or code delivery (reserved stock); it cannot be deleted until they are completed or canceled"
        )
      }
      if (input.available > 0) {
        await inventory.adjustInventory([
          { inventoryItemId: level.inventory_item_id, locationId: level.location_id, adjustment: -input.available },
        ])
      }
    })
    return new StepResponse(undefined, input.available > 0 ? { ...level, available: input.available } : undefined)
  },
  async (data, { container }) => {
    if (!data) {
      return
    }
    const inventory = container.resolve(Modules.INVENTORY)
    await container.resolve(Modules.LOCKING).execute([data.inventory_item_id], () =>
      inventory.adjustInventory([
        { inventoryItemId: data.inventory_item_id, locationId: data.location_id, adjustment: data.available },
      ])
    )
  }
)

export const deleteEvoucherPoolStep = createStep(
  "delete-evoucher-pool",
  async (input: { id: string }, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
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

// EV-20 (กฎข้อ 36): ลบ code ที่ยังไม่ถูกส่ง → ลด stock ตามจำนวน available → requires_shipping=true (กฎข้อ 15) → ลบ pool
// ใต้ lock ของ pool เดียวกับ import (กัน code ใหม่เข้าระหว่างลบ); allocation ถูกกันด้วย row lock ของ UPDATE (ดู service)
export const deleteEvoucherPoolWorkflow = createWorkflow(
  "delete-evoucher-pool",
  function (input: { id: string }) {
    const lockKey = transform({ input }, ({ input }) => evoucherPoolLockKey(input.id))
    const lockOwnerId = transform({ input }, (_, { context }) => `evoucher-pool-delete:${context.transactionId}`)
    acquireLockStep({
      key: lockKey,
      ownerId: lockOwnerId,
      timeout: EVOUCHER_POOL_LOCK_TIMEOUT,
      ttl: EVOUCHER_POOL_LOCK_TTL,
    })

    const itemIds = resolveEvoucherPoolInventoryItemsStep(input)
    const codes = softDeleteUnissuedEvoucherCodesStep({ pool_id: input.id })
    // ขั้นใดล้มหลังจากนี้ compensation คืน code (และ stock/requires_shipping ที่ทำไปแล้ว)
    // pool ที่ไม่มี code เลยไม่มี stock/reservation ให้ตรวจ (และอาจยังไม่มี inventory level)
    when("lower-deleted-evoucher-pool-stock", { codes }, ({ codes }) => codes.total > 0).then(() => {
      const level = resolveEvoucherPoolInventoryStep({ pool_id: input.id })
      const stock = transform({ level, codes }, ({ level, codes }) => ({ ...level, available: codes.available }))
      lowerDeletedEvoucherPoolStockStep(stock)
    })
    // กฎข้อ 15 (Q7 ค่าเริ่มต้น): คืน requires_shipping=true (ค่าเริ่มต้นของ Medusa)
    when("restore-evoucher-requires-shipping", { itemIds }, ({ itemIds }) => itemIds.length > 0).then(() => {
      const updates = transform({ itemIds }, ({ itemIds }) =>
        itemIds.map((id) => ({ id, requires_shipping: true }))
      )
      updateInventoryItemsWorkflow.runAsStep({ input: { updates } })
    })
    const deleted = deleteEvoucherPoolStep(input)

    releaseLockStep({ key: lockKey, ownerId: lockOwnerId })
    return new WorkflowResponse(deleted)
  }
)
