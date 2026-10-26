import { sdk } from "@lib/config"
import { syncCartAffiliateToken } from "@lib/data/affiliate"
import { getAuthHeaders, getCartId } from "@lib/data/cookies"
import { loginPathForAddToCart } from "@lib/util/pending-add-to-cart"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import { activateCart, MAX_LINE_ITEM_QUANTITY } from "@lib/util/server-cart"
import { getRequestOrigin } from "@lib/util/site"
import { friendlyErrorMessage } from "@lib/util/error-message"

// qa CORE-4c2 D-1: ไม่ส่งข้อความดิบของ Medusa (เช่น "Variants … do not exist") — log ไว้ฝั่ง server แทน
const ADD_FAILED =
  "เพิ่มสินค้าลงตะกร้าไม่สำเร็จ สินค้าหรือตัวเลือกที่เลือกอาจไม่มีอยู่หรือหมดแล้ว"
import { isEqual } from "lodash"
import { NextRequest, NextResponse } from "next/server"

const resolveVariantId = async (form: FormData, regionId: string) => {
  const productId = form.get("product_id")?.toString()
  const selectedOptions: Record<string, string> = {}
  form.forEach((value, key) => {
    const match = key.match(/^options\[(.+)\]$/)
    if (match) {
      selectedOptions[match[1]] = value.toString()
    }
  })

  if (!productId || Object.keys(selectedOptions).length === 0) {
    return form.get("variant_id")?.toString() || undefined
  }

  const { product } = await sdk.store.product.retrieve(productId, {
    region_id: regionId,
    fields: "id,*variants,*variants.options",
  })

  return product.variants?.find((variant: HttpTypes.StoreProductVariant) =>
    isEqual(
      Object.fromEntries(
        (variant.options ?? []).map((o) => [o.option_id, o.value])
      ),
      selectedOptions
    )
  )?.id
}

const addLineItem = async (
  cartId: string | undefined,
  regionId: string,
  variantId: string,
  quantity: number,
  headers: Awaited<ReturnType<typeof getAuthHeaders>>
) => {
  const id =
    cartId ??
    (await sdk.store.cart.create({ region_id: regionId }, {}, headers)).cart.id
  await sdk.store.cart.createLineItem(
    id,
    { variant_id: variantId, quantity },
    {},
    headers
  )
  return id
}

/** No-JavaScript add-to-cart: the product page form posts here. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ countryCode: string }> }
) {
  const { countryCode } = await params
  const region = await getRegion(countryCode)
  if (!region) {
    return new NextResponse("ไม่รู้จักรหัสประเทศนี้", { status: 404 })
  }

  const form = await request.formData()
  const quantity = Math.min(
    Math.max(parseInt(form.get("quantity")?.toString() ?? "1", 10) || 1, 1),
    MAX_LINE_ITEM_QUANTITY
  )

  let variantId: string | undefined
  try {
    variantId = await resolveVariantId(form, region.id)
  } catch {
    return new NextResponse("ไม่พบสินค้า", { status: 404 })
  }
  if (!variantId) {
    return new NextResponse("กรุณาเลือกตัวเลือกสินค้าที่ถูกต้อง", { status: 400 })
  }

  // CORE-6: ไม่มี guest — ยังไม่ล็อกอินให้ไปหน้า login พร้อม variant ที่ค้างไว้
  const headers = await getAuthHeaders()
  if (!("authorization" in headers)) {
    return NextResponse.redirect(
      `${getRequestOrigin(request)}${loginPathForAddToCart(countryCode, variantId)}`,
      303
    )
  }

  const existingCartId = await getCartId()
  let cartId: string
  try {
    cartId = await addLineItem(
      existingCartId,
      region.id,
      variantId,
      quantity,
      headers
    )
  } catch (error) {
    if (!existingCartId) {
      console.error(error)
      return new NextResponse(friendlyErrorMessage(error, ADD_FAILED), {
        status: 400,
      })
    }
    // The stored cart may be completed or belong to another region.
    try {
      cartId = await addLineItem(
        undefined,
        region.id,
        variantId,
        quantity,
        headers
      )
    } catch (retryError) {
      console.error(retryError)
      return new NextResponse(friendlyErrorMessage(retryError, ADD_FAILED), {
        status: 400,
      })
    }
  }

  // AF-2: cookie `aff` → cart metadata.affiliate_token
  await syncCartAffiliateToken(cartId, headers)
  await activateCart(cartId)

  return NextResponse.redirect(
    `${getRequestOrigin(request)}/${countryCode}/cart`,
    303
  )
}
