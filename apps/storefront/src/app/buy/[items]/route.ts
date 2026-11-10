import { loginPathForReturn } from "@lib/util/login-return"
import { buyFromPermalink } from "@lib/util/server-cart"
import { getRequestOrigin } from "@lib/util/site"
import { NextResponse } from "next/server"

const NO_STORE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }

/**
 * Cart permalink: /buy/{variant_id}:{quantity},... builds a cart and opens checkout.
 * CORE-14 (spec 01 AC-41, กฎ 25): ไม่มี guest — ยังไม่ล็อกอินให้ไปหน้า login แล้วกลับมาที่ลิงก์เดิม
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ items: string }> }
) {
  const url = new URL(request.url)
  const result = await buyFromPermalink(
    (await params).items,
    url.searchParams.get("context/address_country")
  )

  if ("error" in result) {
    return new NextResponse(result.error, { status: result.status, headers: NO_STORE })
  }

  const path =
    result.next === "login"
      ? loginPathForReturn(result.countryCode, `${url.pathname}${url.search}`)
      : `/${result.countryCode}/checkout`

  return NextResponse.redirect(`${getRequestOrigin(request)}${path}`, {
    status: 303,
    headers: NO_STORE,
  })
}
