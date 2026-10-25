import { AuthenticatedMedusaRequest, MedusaResponse, refetchEntities } from "@medusajs/framework/http"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { data: affiliates, metadata } = await refetchEntities({
    entity: "affiliate",
    idOrFilter: req.filterableFields,
    scope: req.scope,
    fields: req.queryConfig.fields,
    pagination: req.queryConfig.pagination,
  })
  res.json({ affiliates, count: metadata.count, limit: metadata.take, offset: metadata.skip })
}
