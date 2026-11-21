import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
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

// unique violation (มีคนสมัครแทรกระหว่าง plan กับ apply): ข้อความของ DB / `dbErrorMapper` ของ Medusa มีอีเมล
// ("Customer with email: …, already exists.") → แทนด้วยข้อความที่มีแค่ตาราง/id (ไม่ให้ PII หลุดเข้า log ของ `medusa exec`)
const isUniqueViolation = (error: unknown) => {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown }
  return code === "23505" || (typeof message === "string" && /already exists\.?$/.test(message))
}

// เขียนค่าใหม่; ล้มกลางทาง → คืนค่าเดิมของแถวที่เขียนไปแล้วใน step นี้ก่อน throw (compensation ของ step ที่ล้มไม่ถูกเรียก)
const emailStep = (table: keyof LowercaseEmailsInput, name: string, write: Writer) =>
  createStep(
    name,
    async (changes: EmailChange[], { container }) => {
      const done: EmailChange[] = []
      for (const change of changes) {
        try {
          await write(container, [{ id: change.id, value: change.to }])
        } catch (error) {
          await write(container, done.map(({ id, from }) => ({ id, value: from })))
          if (!isUniqueViolation(error)) throw error
          throw new MedusaError(
            MedusaError.Types.CONFLICT,
            `lowercase-emails: ${table} ${change.id} ชน unique index ระหว่าง apply (มีแถวใหม่ที่ได้ค่าเดียวกัน) — ` +
              "คืนค่าเดิมแล้ว รัน dry-run ใหม่เพื่อดูรายการชน"
          )
        }
        done.push(change)
      }
      return new StepResponse(changes.length, changes)
    },
    async (changes, { container }) => {
      if (changes?.length) await write(container, changes.map(({ id, from }) => ({ id, value: from })))
    }
  )

const lowercaseProviderIdentitiesStep = emailStep("provider_identities", "lowercase-provider-identities", async (container, rows) => {
  if (rows.length) {
    await container.resolve(Modules.AUTH).updateProviderIdentities(rows.map(({ id, value }) => ({ id, entity_id: value })))
  }
})

const lowercaseCustomerEmailsStep = emailStep("customers", "lowercase-customer-emails", async (container, rows) => {
  const service = container.resolve(Modules.CUSTOMER)
  for (const { id, value } of rows) await service.updateCustomers(id, { email: value })
})

const lowercaseAffiliateEmailsStep = emailStep("affiliates", "lowercase-affiliate-emails", async (container, rows) => {
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
