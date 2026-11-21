import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { AFFILIATE_MODULE } from "../modules/affiliate"
import type AffiliateModuleService from "../modules/affiliate/service"

// CORE-81 (spec 01 กฎข้อ 139): แปลงอีเมลเดิมเป็นตัวเล็ก — step ต่อ module + compensation คืนค่าเดิม (ไม่ SQL ตรง)
export type EmailChange = { id: string; from: string; to: string }

export type LowercaseEmailsInput = {
  provider_identities: EmailChange[]
  customers: EmailChange[]
  affiliates: EmailChange[]
}

type Writer = (container: MedusaContainer, rows: { id: string; value: string }[]) => Promise<void>

// เขียนค่าใหม่; ล้มกลางทาง → คืนค่าเดิมของแถวที่เขียนไปแล้วใน step นี้ก่อน throw (compensation ของ step ที่ล้มไม่ถูกเรียก)
const emailStep = (name: string, write: Writer) =>
  createStep(
    name,
    async (changes: EmailChange[], { container }) => {
      const done: EmailChange[] = []
      try {
        for (const change of changes) {
          await write(container, [{ id: change.id, value: change.to }])
          done.push(change)
        }
      } catch (error) {
        await write(container, done.map(({ id, from }) => ({ id, value: from })))
        throw error
      }
      return new StepResponse(changes.length, changes)
    },
    async (changes, { container }) => {
      if (changes?.length) await write(container, changes.map(({ id, from }) => ({ id, value: from })))
    }
  )

const lowercaseProviderIdentitiesStep = emailStep("lowercase-provider-identities", async (container, rows) => {
  if (rows.length) {
    await container.resolve(Modules.AUTH).updateProviderIdentities(rows.map(({ id, value }) => ({ id, entity_id: value })))
  }
})

const lowercaseCustomerEmailsStep = emailStep("lowercase-customer-emails", async (container, rows) => {
  const service = container.resolve(Modules.CUSTOMER)
  for (const { id, value } of rows) await service.updateCustomers(id, { email: value })
})

const lowercaseAffiliateEmailsStep = emailStep("lowercase-affiliate-emails", async (container, rows) => {
  if (rows.length) {
    const service: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
    await service.updateAffiliates(rows.map(({ id, value }) => ({ id, email: value })))
  }
})

export const lowercaseEmailsWorkflow = createWorkflow("lowercase-emails", function (input: LowercaseEmailsInput) {
  const identities = lowercaseProviderIdentitiesStep(input.provider_identities)
  const customers = lowercaseCustomerEmailsStep(input.customers)
  const affiliates = lowercaseAffiliateEmailsStep(input.affiliates)
  return new WorkflowResponse({ provider_identities: identities, customers, affiliates })
})
