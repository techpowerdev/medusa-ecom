import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { signAffiliateClickStep } from "../steps/sign-affiliate-click"

export type TrackClickWorkflowInput = { code: string }

// spec 05 `trackClickWorkflow(code, path)`: หา affiliate → signed token สำหรับ cookie `aff`
// path (`?to=`) จัดการที่ route; การบันทึก click เลื่อนไป v2
export const trackClickWorkflow = createWorkflow(
  "track-click",
  function (input: TrackClickWorkflowInput) {
    return new WorkflowResponse(signAffiliateClickStep(input))
  }
)
