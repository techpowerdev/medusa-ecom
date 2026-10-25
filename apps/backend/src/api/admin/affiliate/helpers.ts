import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AFFILIATE_MODULE } from "../../../modules/affiliate"
import AffiliateModuleService from "../../../modules/affiliate/service"

/*
 * Reads go through the module service (not Query): the models are named `affiliate_commission_entry` /
 * `affiliate_payout` while the MedusaService keys are `CommissionEntry` / `Payout`, so Query cannot
 * resolve them (it looks for `listAffiliateCommissionEntries`). Renaming is out of AF-5 scope.
 */
const ENTITIES = {
  affiliate: { list: "listAndCountAffiliates", retrieve: "retrieveAffiliate" },
  program: { list: "listAndCountAffiliatePrograms", retrieve: "retrieveAffiliateProgram" },
  entry: { list: "listAndCountCommissionEntries", retrieve: "retrieveCommissionEntry" },
  payout: { list: "listAndCountPayouts", retrieve: "retrievePayout" },
} as const

export type AffiliateEntity = keyof typeof ENTITIES

type AnyMethod = (...args: unknown[]) => Promise<unknown>

const method = (req: AuthenticatedMedusaRequest, name: string) => {
  const service: AffiliateModuleService = req.scope.resolve(AFFILIATE_MODULE)
  return (service[name as keyof AffiliateModuleService] as AnyMethod).bind(service)
}

export const refetchEntity = async (
  entity: AffiliateEntity,
  id: string,
  req: AuthenticatedMedusaRequest
) => method(req, ENTITIES[entity].retrieve)(id, { select: req.queryConfig.fields })

export const listEntities = async (
  entity: AffiliateEntity,
  key: string,
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { select, skip, take, order } = req.listConfig
  const [data, count] = (await method(req, ENTITIES[entity].list)(req.filterableFields, {
    select,
    skip,
    take,
    order,
  })) as [unknown[], number]

  res.json({ [key]: data, count, limit: take, offset: skip })
}
