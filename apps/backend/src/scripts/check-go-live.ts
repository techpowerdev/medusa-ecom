import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

// OPS-7 (ADR-010 D1, spec 07 AC-11): ตรวจก่อนเปิดร้าน — `pnpm --filter backend check:go-live` บน container ของ prod
// ไม่ผ่านข้อใด → throw (`medusa exec` exit 1) พร้อมรายการ; checklist อยู่ใน docs/ops/production.md "Go-live checklist"
type Env = Record<string, string | undefined>

export async function goLiveFailures(container: MedusaContainer, env: Env): Promise<string[]> {
  const failures: string[] = []
  if (env.NODE_ENV !== "production") {
    failures.push(`NODE_ENV ต้องเป็น production (ได้ ${env.NODE_ENV || "(ว่าง)"})`)
  }
  if (env.ALLOW_TEST_PROVIDERS) {
    failures.push("ALLOW_TEST_PROVIDERS ต้องไม่ถูกตั้งใน production (ADR-010)")
  }
  if (!env.STRIPE_API_KEY || /^(sk|rk)_test_/.test(env.STRIPE_API_KEY)) {
    failures.push("STRIPE_API_KEY ต้องเป็น live key (ไม่ว่างและไม่ขึ้นต้นด้วย sk_test_/rk_test_)")
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: regions } = await query.graph({ entity: "region", fields: ["name", "payment_providers.id"] })
  for (const region of regions) {
    if ((region.payment_providers ?? []).some((p) => p?.id === "pp_system_default")) {
      failures.push(`region "${region.name}" เปิด pp_system_default (manual payment) — ปิดใน admin ก่อนเปิดร้าน`)
    }
  }
  return failures
}

export default async function checkGoLive({ container }: ExecArgs) {
  const failures = await goLiveFailures(container, process.env)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (failures.length) {
    failures.forEach((failure) => logger.error(`check:go-live FAIL ${failure}`))
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `check:go-live ไม่ผ่าน ${failures.length} ข้อ: ${failures.join("; ")}`)
  }
  logger.info("check:go-live ผ่านทุกข้อ")
}
