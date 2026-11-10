import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { EVOUCHER_MODULE } from "../../modules/evoucher"
import EvoucherModuleService from "../../modules/evoucher/service"

export type EvoucherPartnerInput = {
  name: string
  logo_url?: string | null
  terms_url?: string | null
  support_contact?: string | null
}

export type UpdateEvoucherPartnerInput = Partial<EvoucherPartnerInput> & {
  id: string
}

const FIELDS = ["id", "name", "logo_url", "terms_url", "support_contact"]

export const createEvoucherPartnerStep = createStep(
  "create-evoucher-partner",
  async (input: EvoucherPartnerInput, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    const partner = await service.createEvoucherPartners(input)
    return new StepResponse(partner, partner.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.deleteEvoucherPartners(id)
  }
)

export const updateEvoucherPartnerStep = createStep(
  "update-evoucher-partner",
  async (input: UpdateEvoucherPartnerInput, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    const { id, name, logo_url, terms_url, support_contact } =
      await service.retrieveEvoucherPartner(input.id, { select: FIELDS })
    const previous = { id, name, logo_url, terms_url, support_contact }
    const partner = await service.updateEvoucherPartners(input)
    return new StepResponse(partner, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.updateEvoucherPartners(previous)
  }
)

export const deleteEvoucherPartnerStep = createStep(
  "delete-evoucher-partner",
  async (input: { id: string }, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.retrieveEvoucherPartner(input.id, { select: ["id"] })
    const [, pools] = await service.listAndCountEvoucherPools(
      { partner_id: input.id },
      { select: ["id"], take: 1 }
    )
    if (pools > 0) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Partner still has pools; delete its pools first"
      )
    }
    await service.softDeleteEvoucherPartners(input.id)
    return new StepResponse(input.id, input.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.restoreEvoucherPartners(id)
  }
)

export const createEvoucherPartnerWorkflow = createWorkflow(
  "create-evoucher-partner",
  function (input: EvoucherPartnerInput) {
    return new WorkflowResponse(createEvoucherPartnerStep(input))
  }
)

export const updateEvoucherPartnerWorkflow = createWorkflow(
  "update-evoucher-partner",
  function (input: UpdateEvoucherPartnerInput) {
    return new WorkflowResponse(updateEvoucherPartnerStep(input))
  }
)

export const deleteEvoucherPartnerWorkflow = createWorkflow(
  "delete-evoucher-partner",
  function (input: { id: string }) {
    return new WorkflowResponse(deleteEvoucherPartnerStep(input))
  }
)
