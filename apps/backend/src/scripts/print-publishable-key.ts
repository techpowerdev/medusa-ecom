import { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { STOREFRONT_KEY_TITLE } from "./seed"

/** token ของ publishable key "Storefront" ที่ seed สร้าง (ไม่รวม key ที่ถูก revoke) */
export async function getPublishableKey(container: MedusaContainer): Promise<string> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["token", "revoked_at"],
    filters: { type: "publishable", title: STOREFRONT_KEY_TITLE },
  })
  const key = data.find((k) => !k.revoked_at)
  if (!key) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `ไม่พบ publishable key "${STOREFRONT_KEY_TITLE}" — รัน seed ก่อน`)
  }
  return key.token
}

/** ใช้ใน CI: `pnpm --filter backend --silent print-publishable-key` → พิมพ์ token บรรทัดเดียวลง stdout */
export default async function printPublishableKey({ container }: ExecArgs) {
  process.stdout.write(`${await getPublishableKey(container)}\n`)
}
