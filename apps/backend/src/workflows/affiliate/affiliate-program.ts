import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { AFFILIATE_MODULE } from "../../modules/affiliate"
import AffiliateModuleService from "../../modules/affiliate/service"
import { ProgramScope } from "../../modules/affiliate/utils/commission"

type ProgramStatus = "draft" | "published" | "ended"

export type AffiliateProgramInput = {
  name: string
  starts_at: Date
  ends_at: Date
  status?: ProgramStatus
  announce_text?: string | null
  commission_value: number
  scope: ProgramScope
  attribution_window_days?: number
  cap_per_order?: number | null
  hold_days?: number
}

export type UpdateAffiliateProgramInput = Partial<AffiliateProgramInput> & { id: string }

// status moves forward only: draft → published → ended (rule 10: ended = closed early)
const STATUS_ORDER: ProgramStatus[] = ["draft", "published", "ended"]

const FIELDS = [
  "id",
  "name",
  "starts_at",
  "ends_at",
  "status",
  "announce_text",
  "commission_value",
  "scope",
  "attribution_window_days",
  "cap_per_order",
  "hold_days",
]

export const createAffiliateProgramStep = createStep(
  "create-affiliate-program",
  async (input: AffiliateProgramInput, { container }) => {
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const program = await service.createAffiliatePrograms(input)
    return new StepResponse(program, program.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    await service.deleteAffiliatePrograms(id)
  }
)

export const updateAffiliateProgramStep = createStep(
  "update-affiliate-program",
  async (input: UpdateAffiliateProgramInput, { container }) => {
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const previous = await service.retrieveAffiliateProgram(input.id, { select: FIELDS })

    if (
      input.status &&
      STATUS_ORDER.indexOf(input.status) < STATUS_ORDER.indexOf(previous.status)
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Program status cannot move from ${previous.status} to ${input.status}`
      )
    }
    const startsAt = new Date(input.starts_at ?? previous.starts_at)
    const endsAt = new Date(input.ends_at ?? previous.ends_at)
    if (startsAt >= endsAt) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "ends_at must be after starts_at")
    }

    const program = await service.updateAffiliatePrograms(input)
    return new StepResponse(program, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    await service.updateAffiliatePrograms(previous)
  }
)

// Only drafts can be removed; published/ended programs are referenced by the ledger
export const deleteAffiliateProgramStep = createStep(
  "delete-affiliate-program",
  async (input: { id: string }, { container }) => {
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const program = await service.retrieveAffiliateProgram(input.id, { select: ["id", "status"] })
    if (program.status !== "draft") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Only draft programs can be deleted; end the program instead"
      )
    }
    await service.softDeleteAffiliatePrograms(input.id)
    return new StepResponse(input.id, input.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    await service.restoreAffiliatePrograms(id)
  }
)

export const createAffiliateProgramWorkflow = createWorkflow(
  "create-affiliate-program",
  function (input: AffiliateProgramInput) {
    return new WorkflowResponse(createAffiliateProgramStep(input))
  }
)

export const updateAffiliateProgramWorkflow = createWorkflow(
  "update-affiliate-program",
  function (input: UpdateAffiliateProgramInput) {
    return new WorkflowResponse(updateAffiliateProgramStep(input))
  }
)

export const deleteAffiliateProgramWorkflow = createWorkflow(
  "delete-affiliate-program",
  function (input: { id: string }) {
    return new WorkflowResponse(deleteAffiliateProgramStep(input))
  }
)
