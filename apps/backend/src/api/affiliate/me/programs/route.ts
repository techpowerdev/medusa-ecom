import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PORTAL_PROGRAM_FIELDS } from "../../helpers"

// กฎ 9-10: เฉพาะ published ที่ยังไม่หมดเวลา — active (อยู่ในช่วง) หรือ upcoming (starts_at > now)
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const now = new Date()
  const { data } = await query.graph({
    entity: "affiliate_program",
    fields: PORTAL_PROGRAM_FIELDS,
    filters: { status: "published", ends_at: { $gt: now } },
    pagination: { order: { starts_at: "ASC", id: "ASC" } },
  })

  res.json({
    programs: data.map((p) => ({ ...p, state: new Date(p.starts_at) > now ? "upcoming" : "active" })),
  })
}
