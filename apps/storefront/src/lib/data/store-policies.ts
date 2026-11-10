"use server"

import { getRegionPolicies, getReturnPolicy, StorePolicies } from "@lib/util/store-policies"
import { listRegionsUncached } from "./regions"

export const getStorePolicies = async (countryCode: string) => {
  const regions = await listRegionsUncached()
  const current = regions.find((region) =>
    region.countries?.some((country) => country.iso_2 === countryCode.toLowerCase())
  )

  return {
    current: getRegionPolicies(current),
    // CORE-20d (กฎข้อ 66a): นโยบายคืนใช้ค่าเริ่มต้นของ backend เมื่อไม่ตั้ง return_window_days (ไม่ขึ้นกับค่าจัดส่ง)
    returns: getReturnPolicy(current),
    currencyCode: current?.currency_code ?? "",
    regions: regions.flatMap((region) => {
      const policies = getRegionPolicies(region)
      return policies ? [{ id: region.id, name: region.name, policies }] : []
    }) as { id: string; name: string; policies: StorePolicies }[],
  }
}
