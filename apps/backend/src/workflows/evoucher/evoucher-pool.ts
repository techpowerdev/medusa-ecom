import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
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
    // 404 ถ้า variant ไม่มีอยู่จริง (link pool → variant เป็น read-only ไม่มี FK)
    useQueryGraphStep({
      entity: "product_variant",
      fields: ["id"],
      filters: { id: input.variant_id },
      options: { throwIfKeyNotFound: true },
    })
    return new WorkflowResponse(createEvoucherPoolStep(input))
  }
)

export const updateEvoucherPoolWorkflow = createWorkflow(
  "update-evoucher-pool",
  function (input: UpdateEvoucherPoolInput) {
    return new WorkflowResponse(updateEvoucherPoolStep(input))
  }
)

export const deleteEvoucherPoolWorkflow = createWorkflow(
  "delete-evoucher-pool",
  function (input: { id: string }) {
    return new WorkflowResponse(deleteEvoucherPoolStep(input))
  }
)
