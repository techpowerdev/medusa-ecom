import type { NextRequest, NextResponse } from "next/server"

// CORE-14 (spec 01 AC-43, กฎ 25): cart เป็นของ customer เท่านั้น — ไม่มี session (`_medusa_jwt`)
// แต่ยังมี cookie `_medusa_cart_id` ค้าง (เช่น token หมดอายุ/ลบไป) → ล้าง cookie cart
// CORE-14g (กฎ 84, AC-120): ยกเว้น request ของ server action (POST + `next-action`) — ให้ action ใช้ cart id เดิม
// ได้ 401 จาก backend แล้วคืน `unauthorized` (หน้าแสดง SIGN_IN_AGAIN_MESSAGE) แทนการ render ตะกร้าว่าง
const isServerAction = (request: NextRequest) =>
  request.method === "POST" && request.headers.has("next-action")

export const clearStaleCartCookie = (request: NextRequest, response: NextResponse) => {
  if (
    request.cookies.has("_medusa_cart_id") &&
    !request.cookies.has("_medusa_jwt") &&
    !isServerAction(request)
  ) {
    response.cookies.set("_medusa_cart_id", "", { maxAge: 0, path: "/" })
  }
  return response
}
