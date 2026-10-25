import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { EVOUCHER_MODULE } from "../../modules/evoucher"
import EvoucherModuleService from "../../modules/evoucher/service"
import { assertEvoucherKeyStep } from "./steps/assert-evoucher-key"

export type RevealEvoucherCodeInput = {
  code_id: string
  actor_type: string
  actor_id: string
}

export const recordEvoucherCodeRevealStep = createStep(
  "record-evoucher-code-reveal",
  async (input: RevealEvoucherCodeInput, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    // retrieve ก่อน → 404 สำหรับ code ที่ไม่มี และไม่เขียน audit
    await service.retrieveEvoucherCode(input.code_id, { select: ["id"] })
    const audit = await service.createEvoucherCodeReveals(input)
    return new StepResponse(audit, audit.id)
  },
  async (auditId, { container }) => {
    if (!auditId) {
      return
    }
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    await service.deleteEvoucherCodeReveals(auditId)
  }
)

// ถอดรหัสเป็น step สุดท้าย (หลังเขียน audit แล้วเท่านั้น)
export const decryptEvoucherCodeStep = createStep(
  "decrypt-evoucher-code",
  async (input: { code_id: string }, { container }) => {
    const service: EvoucherModuleService = container.resolve(EVOUCHER_MODULE)
    const row = await service.retrieveEvoucherCode(input.code_id)
    return new StepResponse({
      id: row.id,
      code: await service.decryptSecret(row.code),
      pin: row.pin ? await service.decryptSecret(row.pin) : null,
      status: row.status,
      expires_at: row.expires_at,
    })
  }
)

export const revealEvoucherCodeWorkflow = createWorkflow(
  "reveal-evoucher-code",
  function (input: RevealEvoucherCodeInput) {
    assertEvoucherKeyStep()
    recordEvoucherCodeRevealStep(input)
    const code = decryptEvoucherCodeStep({ code_id: input.code_id })
    return new WorkflowResponse(code)
  }
)
