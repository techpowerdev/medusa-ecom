import { addPendingToCart } from "@lib/data/customer"
import { isCountryCode, readPendingAddQuery } from "@lib/util/pending-add-to-cart"
import { NextRequest, NextResponse } from "next/server"

/**
 * CORE-14d (spec 01 กฎข้อ 58): ลูกค้าที่ล็อกอินอยู่แล้วเปิด `/account?add_variant=…` → หน้า dashboard redirect มาที่นี่
 * (server component ตั้ง cookie cart ไม่ได้) เพิ่มลง cart แล้วไป `/cart`; ไม่สำเร็จ → `/account?…&add_error=1`
 * ยังไม่ล็อกอิน → addToCart redirect ไปหน้า login พร้อม variant ที่ค้างไว้ (CORE-6)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ countryCode: string }> }
) {
  const { countryCode } = await params
  const pending = readPendingAddQuery(
    Object.fromEntries(request.nextUrl.searchParams)
  )
  if (!pending || !isCountryCode(countryCode)) {
    return new NextResponse("ลิงก์เพิ่มสินค้าลงตะกร้าไม่ถูกต้อง", { status: 400 })
  }

  return addPendingToCart({
    variantId: pending.variantId,
    quantity: pending.quantity,
    countryCode,
  })
}
