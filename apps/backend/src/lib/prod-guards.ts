// OPS-7 prod guards (ADR-010 C + D1, docs/spec/07-scaling-ops.md AC-9, AC-10, AC-13, AC-17)
// production ที่ตั้งค่าไม่ครบต้องล้มตอนบูต (fail-closed) แทนการทำงานผิดแบบเงียบ ๆ
import { MedusaError } from "@medusajs/framework/utils"

type Env = Record<string, string | undefined>

const isProduction = (env: Env) => env.NODE_ENV === "production"

/** ADR-010 ข้อ 1: เฉพาะค่า "true" ปิด guard ของ provider ทดสอบ (CI/staging เท่านั้น ห้ามตั้งใน prod) */
export const testProvidersAllowed = (env: Env) => env.ALLOW_TEST_PROVIDERS === "true"

/** guard ของ provider ทดสอบทำงาน: production และไม่ได้ตั้ง ALLOW_TEST_PROVIDERS=true */
export const testProvidersGuarded = (env: Env) => isProduction(env) && !testProvidersAllowed(env)

export const missingEnvError = (names: string[], why: string) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, `ต้องตั้ง ${names.join(", ")} ใน production — ${why}`)

const isHttpUrl = (value: string | undefined) => {
  try {
    return ["http:", "https:"].includes(new URL(value ?? "").protocol)
  } catch {
    return false
  }
}

/**
 * ตรวจ env ที่ production ขาดไม่ได้ตอนโหลด medusa-config (ไม่ขึ้นกับ ALLOW_TEST_PROVIDERS — CI ตั้งค่าทดสอบให้เอง)
 * production → throw; นอก production → คืนข้อความ warning (medusa-config log ครั้งเดียวตอนบูต)
 */
export const checkBootEnv = (env: Env): string[] => {
  const problems: [string, string][] = []
  if (!env.AFFILIATE_TOKEN_SECRET) {
    problems.push([
      "AFFILIATE_TOKEN_SECRET",
      "AFFILIATE_TOKEN_SECRET is not set — affiliate links redirect without attribution cookie",
    ])
  }
  if (!isHttpUrl(env.STOREFRONT_URL)) {
    problems.push([
      "STOREFRONT_URL",
      "STOREFRONT_URL is not set to an http(s) URL — group buy payment links in emails are paths only",
    ])
  }
  if (problems.length && isProduction(env)) {
    throw missingEnvError(
      problems.map(([name]) => name),
      "AFFILIATE_TOKEN_SECRET = secret ของ cookie `aff`, STOREFRONT_URL = URL http(s) ของ storefront สำหรับลิงก์ในอีเมล"
    )
  }
  return problems.map(([, warning]) => warning)
}

const STRIPE_PROVIDERS = ["pp_stripe_stripe", "pp_stripe-promptpay_stripe"]

/** AC-10 (ADR-010 D1): seed ไม่เปิด manual payment (`pp_system_default`) ให้ region ใน production */
export const seedPaymentProviders = (env: Env): string[] =>
  testProvidersGuarded(env) ? [...STRIPE_PROVIDERS] : ["pp_system_default", ...STRIPE_PROVIDERS]
