"use client"

import { PENDING_ADD_PARAM } from "@lib/util/pending-add-to-cart"
import { useParams, useSearchParams } from "next/navigation"

// CORE-6 (spec 01 AC-6): ส่ง variant ที่ guest กด "Add to cart" ค้างไว้ไปกับฟอร์ม login/register
const PendingAddToCartFields = () => {
  const { countryCode } = useParams() as { countryCode: string }
  const variantId = useSearchParams().get(PENDING_ADD_PARAM)

  if (!variantId) {
    return null
  }

  return (
    <>
      <input type="hidden" name={PENDING_ADD_PARAM} value={variantId} />
      <input type="hidden" name="country_code" value={countryCode} />
    </>
  )
}

export default PendingAddToCartFields
