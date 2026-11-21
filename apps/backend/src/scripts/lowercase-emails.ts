import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { normalizeEmail } from "../lib/normalize-email"
import { AFFILIATE_MODULE } from "../modules/affiliate"
import type AffiliateModuleService from "../modules/affiliate/service"
import { EmailChange, LowercaseEmailsInput, lowercaseEmailsWorkflow } from "../workflows/lowercase-emails"

// CORE-81 (spec 01 กฎข้อ 139, go-live ข้อ 11): แปลงอีเมลที่สร้างก่อน CORE-80 เป็นตัวเล็ก — ค่าเริ่มต้น dry-run
// ใช้: `npx medusa exec ./src/scripts/lowercase-emails.ts` (dry-run) และ `... lowercase-emails.ts apply`
// (`medusa exec` เป็น yargs แบบ strict — `--apply` เป็น option ที่ไม่รู้จักจึงส่งเป็นคำ `apply`; รับ `--apply` ด้วยเมื่อเรียก function ตรง)

export type EmailRow = {
  id: string
  email: string
  /** ส่วนอื่นของ unique index (`provider` ของ identity, `has_account` ของ customer) */
  uniqueWith: string
  /** false = ไม่แปลง แต่ยังนับตอนตรวจชน (เช่น identity ของแอดมิน — Q-C13 = ก) */
  convert: boolean
}

export type TablePlan = { changes: EmailChange[]; collisions: string[][] }
export type LowercasePlan = Record<keyof LowercaseEmailsInput, TablePlan>

/** แถวที่ต้องแปลง และกลุ่ม id ที่ได้ค่าเดียวกันภายใต้ unique index เดิมหลังแปลง (ต้องแก้ด้วยมือก่อน — ไม่รวมบัญชีเอง) */
export function planLowercase(rows: EmailRow[]): TablePlan {
  const groups = new Map<string, { id: string; changed: boolean }[]>()
  const changes: EmailChange[] = []
  for (const row of rows) {
    const to = row.convert ? normalizeEmail(row.email) : row.email
    const changed = to !== row.email
    if (changed) changes.push({ id: row.id, from: row.email, to })
    const key = JSON.stringify([row.uniqueWith, to])
    groups.set(key, [...(groups.get(key) ?? []), { id: row.id, changed }])
  }
  const collisions = [...groups.values()]
    .filter((group) => group.length > 1 && group.some((row) => row.changed))
    .map((group) => group.map((row) => row.id))
  return { changes, collisions }
}

async function loadPlan(container: MedusaContainer): Promise<LowercasePlan> {
  const identities = await container
    .resolve(Modules.AUTH)
    // IDX_provider_identity_provider_entity_id ไม่ใช่ partial index → แถวที่ soft-delete แล้วยังชนได้ (นับตอนตรวจชน ไม่แปลง)
    .listProviderIdentities({ provider: "emailpass" }, { relations: ["auth_identity"], withDeleted: true })
  const customers = await container
    .resolve(Modules.CUSTOMER)
    .listCustomers({}, { select: ["id", "email", "has_account"] })
  const affiliateService: AffiliateModuleService = container.resolve(AFFILIATE_MODULE)
  const affiliates = await affiliateService.listAffiliates({}, { select: ["id", "email"] })

  return {
    provider_identities: planLowercase(
      identities.map((identity) => {
        const meta = identity.auth_identity?.app_metadata ?? {}
        const deleted = Boolean((identity as { deleted_at?: unknown }).deleted_at)
        return {
          id: identity.id,
          email: identity.entity_id,
          uniqueWith: identity.provider,
          // Q-C13 = ก: เฉพาะ identity ที่ผูก customer/affiliate และไม่ผูกแอดมิน
          convert: !deleted && !meta.user_id && Boolean(meta.customer_id || meta.affiliate_id),
        }
      })
    ),
    customers: planLowercase(
      customers
        .filter((customer) => customer.email)
        .map((customer) => ({
          id: customer.id,
          email: customer.email as string,
          uniqueWith: String(customer.has_account),
          convert: true,
        }))
    ),
    affiliates: planLowercase(
      affiliates.map((affiliate) => ({ id: affiliate.id, email: affiliate.email, uniqueWith: "", convert: true }))
    ),
  }
}

const tables = (plan: LowercasePlan) => Object.entries(plan) as [keyof LowercasePlan, TablePlan][]

/** ชน → ไม่แก้อะไร; ไม่ชนและ `apply` → แก้ผ่าน `lowercaseEmailsWorkflow` (compensation คืนค่าเดิมเมื่อ step ใดล้ม) */
export async function lowercaseEmails(container: MedusaContainer, apply: boolean) {
  const plan = await loadPlan(container)
  const collided = tables(plan).some(([, table]) => table.collisions.length > 0)
  const pending = tables(plan).some(([, table]) => table.changes.length > 0)
  if (collided || !apply || !pending) {
    return { plan, applied: false }
  }
  await lowercaseEmailsWorkflow(container).run({
    input: {
      provider_identities: plan.provider_identities.changes,
      customers: plan.customers.changes,
      affiliates: plan.affiliates.changes,
    },
  })
  return { plan, applied: true }
}

export default async function lowercaseEmailsScript({ container, args }: ExecArgs) {
  const apply = (args ?? []).some((arg) => arg === "apply" || arg === "--apply")
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { plan, applied } = await lowercaseEmails(container, apply)

  // พิมพ์เฉพาะ id (ไม่พิมพ์อีเมล — PII)
  for (const [table, { changes, collisions }] of tables(plan)) {
    logger.info(`lowercase-emails: ${table} ต้องแปลง ${changes.length} แถว`)
    for (const change of changes) logger.info(`lowercase-emails: ${table} ${change.id}`)
    for (const ids of collisions) logger.error(`lowercase-emails: ชน ${table}: ${ids.join(", ")}`)
  }
  if (tables(plan).some(([, table]) => table.collisions.length > 0)) {
    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      "lowercase-emails: มีอีเมลที่ต่างกันแค่ตัวพิมพ์ — แก้คู่ที่ชนด้วยมือ (script ไม่รวมบัญชี) แล้วรันใหม่; ยังไม่ได้แก้ข้อมูลใด"
    )
  }
  const total = tables(plan).reduce((sum, [, table]) => sum + table.changes.length, 0)
  logger.info(
    applied
      ? `lowercase-emails: แปลงแล้ว ${total} แถว — รัน dry-run ซ้ำต้องได้ 0 แถว`
      : total === 0
        ? "lowercase-emails: ไม่มีแถวที่ต้องแปลง"
        : `lowercase-emails: dry-run — ยังไม่แก้ข้อมูล (${total} แถว) รันซ้ำพร้อม apply เพื่อแปลง`
  )
}
