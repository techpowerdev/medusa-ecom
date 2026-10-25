import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { AFFILIATE_MODULE } from "../../modules/affiliate"
import AffiliateModuleService from "../../modules/affiliate/service"
import { buildPayout, PayoutCandidateEntry } from "../../modules/affiliate/utils/payout"

export type CreateAffiliatePayoutInput = {
  affiliate_id: string
  period_from: Date
  period_to: Date
}

export type MarkAffiliatePayoutPaidInput = {
  id: string
  reference?: string | null
}

/**
 * Q8: approved + reversed entries created before period_to that are not in any payout yet.
 * Entries left over from an earlier round (net ≤ 0) are picked up here — that is the carry-over.
 */
export const prepareAffiliatePayoutStep = createStep(
  "prepare-affiliate-payout",
  async (input: CreateAffiliatePayoutInput, { container }) => {
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    await service.retrieveAffiliate(input.affiliate_id, { select: ["id"] })

    const payouts = await service.listAffiliatePayouts(
      { affiliate_id: input.affiliate_id },
      { select: ["entry_ids"] }
    )
    const taken = new Set(payouts.flatMap((p) => p.entry_ids as string[]))
    const entries = await service.listAffiliateCommissionEntries(
      {
        affiliate_id: input.affiliate_id,
        status: ["approved", "reversed"],
        created_at: { $lt: input.period_to },
      },
      { select: ["id", "amount", "currency", "status"] }
    )

    const draft = buildPayout(
      entries.filter((e) => !taken.has(e.id)) as unknown as PayoutCandidateEntry[]
    )
    if (!draft) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Nothing to pay: no unpaid approved entries or the net amount is not positive"
      )
    }

    return new StepResponse({ ...input, ...draft })
  }
)

export const createAffiliatePayoutStep = createStep(
  "create-affiliate-payout",
  async (
    input: CreateAffiliatePayoutInput & { amount: number; currency: string; entry_ids: string[] },
    { container }
  ) => {
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const payout = await service.createAffiliatePayouts({ ...input, status: "draft" })
    return new StepResponse(payout, payout.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    await service.deleteAffiliatePayouts(id)
  }
)

// Ledger rule 5: entries move forward only (approved → paid); reversed entries keep their status
export const markAffiliatePayoutEntriesPaidStep = createStep(
  "mark-affiliate-payout-entries-paid",
  async (input: { id: string }, { container }) => {
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const payout = await service.retrieveAffiliatePayout(input.id, { select: ["id", "status", "entry_ids"] })
    if (payout.status !== "draft") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Payout is already paid")
    }

    const approved = await service.listAffiliateCommissionEntries(
      { id: payout.entry_ids as string[], status: "approved" },
      { select: ["id"] }
    )
    const ids = approved.map((e) => e.id)
    if (ids.length) {
      await service.updateAffiliateCommissionEntries({
        selector: { id: ids, status: "approved" },
        data: { status: "paid" },
      })
    }
    return new StepResponse(ids, ids)
  },
  // Compensation only undoes this uncommitted run (same exception as rule 15)
  async (ids, { container }) => {
    if (!ids?.length) {
      return
    }
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    await service.updateAffiliateCommissionEntries({
      selector: { id: ids, status: "paid" },
      data: { status: "approved" },
    })
  }
)

export const setAffiliatePayoutPaidStep = createStep(
  "set-affiliate-payout-paid",
  async (input: MarkAffiliatePayoutPaidInput, { container }) => {
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    const payout = await service.updateAffiliatePayouts({
      id: input.id,
      status: "paid",
      paid_at: new Date(),
      reference: input.reference ?? null,
    })
    return new StepResponse(payout, input.id)
  },
  async (id, { container }) => {
    if (!id) {
      return
    }
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    await service.updateAffiliatePayouts({ id, status: "draft", paid_at: null, reference: null })
  }
)

export const createAffiliatePayoutWorkflow = createWorkflow(
  "create-affiliate-payout",
  function (input: CreateAffiliatePayoutInput) {
    // Serialize per affiliate so two drafts cannot take the same entries
    const key = transform({ input }, ({ input }) => `affiliate-payout:${input.affiliate_id}`)
    acquireLockStep({ key, timeout: 5, ttl: 30 })

    const draft = prepareAffiliatePayoutStep(input)
    const payout = createAffiliatePayoutStep(draft)

    releaseLockStep({ key })
    return new WorkflowResponse(payout)
  }
)

export const markAffiliatePayoutPaidWorkflow = createWorkflow(
  "mark-affiliate-payout-paid",
  function (input: MarkAffiliatePayoutPaidInput) {
    const key = transform({ input }, ({ input }) => `affiliate-payout-paid:${input.id}`)
    acquireLockStep({ key, timeout: 5, ttl: 30 })

    markAffiliatePayoutEntriesPaidStep({ id: input.id })
    const payout = setAffiliatePayoutPaidStep(input)

    releaseLockStep({ key })
    return new WorkflowResponse(payout)
  }
)
