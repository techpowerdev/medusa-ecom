import type { NextRequest, NextResponse } from "next/server"

// CORE-14 (spec 01 AC-43, กฎ 25): cart เป็นของ customer เท่านั้น — ไม่มี session (`_medusa_jwt`)
// แต่ยังมี cookie `_medusa_cart_id` ค้าง (เช่น token หมดอายุ/ลบไป) → ล้าง cookie cart
export const clearStaleCartCookie = (request: NextRequest, response: NextResponse) => {
  if (request.cookies.has("_medusa_cart_id") && !request.cookies.has("_medusa_jwt")) {
    response.cookies.set("_medusa_cart_id", "", { maxAge: 0, path: "/" })
  }
  return response
}
