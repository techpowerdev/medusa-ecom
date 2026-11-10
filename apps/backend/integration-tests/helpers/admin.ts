// spec 04 กฎข้อ 36c (GB-N5): admin user + JWT (actor_type "user") สำหรับเรียก /admin/* ใน integration test
// สร้าง user + auth identity ผ่าน module ของ Medusa แล้วออก token ด้วย jwtSecret ของ projectConfig
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, generateJwtToken } from "@medusajs/framework/utils"

export async function createAdminUser(
  container: MedusaContainer,
  email = "admin@example.com"
): Promise<{ userId: string; token: string; headers: { authorization: string } }> {
  const user = await container.resolve(Modules.USER).createUsers({ email })
  const identity = await container.resolve(Modules.AUTH).createAuthIdentities({
    provider_identities: [{ provider: "emailpass", entity_id: email }],
    app_metadata: { user_id: user.id },
  })
  const { http } = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig
  const token = generateJwtToken(
    {
      actor_id: user.id,
      actor_type: "user",
      auth_identity_id: identity.id,
      app_metadata: { user_id: user.id },
    },
    { secret: http.jwtSecret as string, expiresIn: "1d" }
  )
  return { userId: user.id, token, headers: { authorization: `Bearer ${token}` } }
}
