"use client"

import { RETURN_TO_PARAM } from "@lib/util/login-return"
import {
  PENDING_ADD_PARAM,
  PENDING_QUANTITY_PARAM,
} from "@lib/util/pending-add-to-cart"
import { useParams, useSearchParams } from "next/navigation"

// CORE-6 (spec 01 AC-6): ส่ง variant ที่ guest กด "Add to cart" ค้างไว้ไปกับฟอร์ม login/register
// CORE-14 (AC-41): ส่ง return URL ของ /buy/... ไปด้วย (server action ตรวจซ้ำว่าเป็น /buy/ เท่านั้น)
const PendingAddToCartFields = () => {
  const { countryCode } = useParams() as { countryCode: string }
  const searchParams = useSearchParams()
  const variantId = searchParams.get(PENDING_ADD_PARAM)
  const quantity = searchParams.get(PENDING_QUANTITY_PARAM)
  const returnTo = searchParams.get(RETURN_TO_PARAM)

  if (returnTo) {
    return <input type="hidden" name={RETURN_TO_PARAM} value={returnTo} />
  }

  if (!variantId) {
    return null
  }

  return (
    <>
      <input type="hidden" name={PENDING_ADD_PARAM} value={variantId} />
      <input type="hidden" name="country_code" value={countryCode} />
      {quantity && (
        <input type="hidden" name={PENDING_QUANTITY_PARAM} value={quantity} />
      )}
    </>
  )
}

export default PendingAddToCartFields
