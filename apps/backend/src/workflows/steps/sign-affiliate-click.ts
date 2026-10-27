import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { AFFILIATE_MODULE } from "../../modules/affiliate"
import AffiliateModuleService from "../../modules/affiliate/service"

export type SignAffiliateClickStepOutput = { token: string | null }

// อ่านอย่างเดียว (redirect ไม่เขียน DB — spec 05 non-functional) จึงไม่มี compensation
// affiliate ต้อง `active` ตอน click (กฎ 7) ไม่ active/ไม่พบ → ไม่มี token
export const signAffiliateClickStep = createStep(
  "sign-affiliate-click",
  async (input: { code: string }, { container }) => {
    const affiliateModule: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)

    // ไม่มี secret: medusa-config เตือนครั้งเดียวตอนบูต (production บูตไม่ขึ้น — OPS-7 AC-13) ไม่ log ต่อ request
    if (!(await affiliateModule.hasClickTokenSecret())) {
      return new StepResponse<SignAffiliateClickStepOutput>({ token: null })
    }

    const [affiliate] = await affiliateModule.listAffiliates(
      { code: input.code.toLowerCase(), status: "active" },
      { select: ["id"], take: 1 }
    )

    return new StepResponse<SignAffiliateClickStepOutput>({
      token: affiliate ? await affiliateModule.signClickToken(affiliate.id, new Date()) : null,
    })
  }
)
