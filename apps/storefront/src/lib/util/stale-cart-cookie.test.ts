import { NextRequest, NextResponse } from "next/server"
import { describe, expect, it } from "vitest"

import { clearStaleCartCookie } from "./stale-cart-cookie"

// CORE-14 (spec 01 AC-43, กฎ 25): ไม่มี session แต่มี cookie `_medusa_cart_id` ค้าง → ล้าง cookie cart
const request = (cookie: string) =>
  new NextRequest("http://localhost:8000/th/cart", { headers: { cookie } })

// CORE-14g (กฎ 84, AC-120): request ของ server action = POST + header `next-action`
const actionRequest = (cookie: string, method: "GET" | "POST", action: boolean) =>
  new NextRequest("http://localhost:8000/th/cart", {
    method,
    headers: action ? { cookie, "next-action": "abc123" } : { cookie },
  })

const cleared = (response: NextResponse) => {
  const cart = response.cookies.get("_medusa_cart_id")
  return cart !== undefined && cart.value === "" && (cart.maxAge ?? 1) <= 0
}

describe("clearStaleCartCookie", () => {
  it("expires the cart cookie when there is no customer session", () => {
    const response = clearStaleCartCookie(
      request("_medusa_cart_id=cart_01"),
      NextResponse.next()
    )
    expect(cleared(response)).toBe(true)
  })

  it("keeps the cart cookie when the customer is signed in", () => {
    const response = clearStaleCartCookie(
      request("_medusa_cart_id=cart_01; _medusa_jwt=token"),
      NextResponse.next()
    )
    expect(response.cookies.get("_medusa_cart_id")).toBeUndefined()
  })

  it("does nothing when there is no cart cookie", () => {
    const response = clearStaleCartCookie(request(""), NextResponse.next())
    expect(response.cookies.get("_medusa_cart_id")).toBeUndefined()
  })

  describe("server action requests (CORE-14g, AC-120)", () => {
    it("keeps the cart cookie on a server action POST without a session", () => {
      const response = clearStaleCartCookie(
        actionRequest("_medusa_cart_id=cart_01", "POST", true),
        NextResponse.next()
      )
      expect(response.cookies.get("_medusa_cart_id")).toBeUndefined()
    })

    it("still expires the cart cookie on a GET that carries next-action", () => {
      const response = clearStaleCartCookie(
        actionRequest("_medusa_cart_id=cart_01", "GET", true),
        NextResponse.next()
      )
      expect(cleared(response)).toBe(true)
    })

    it("still expires the cart cookie on a POST without next-action", () => {
      const response = clearStaleCartCookie(
        actionRequest("_medusa_cart_id=cart_01", "POST", false),
        NextResponse.next()
      )
      expect(cleared(response)).toBe(true)
    })

    it("keeps the cart cookie on a server action when signed in", () => {
      const response = clearStaleCartCookie(
        actionRequest("_medusa_cart_id=cart_01; _medusa_jwt=token", "POST", true),
        NextResponse.next()
      )
      expect(response.cookies.get("_medusa_cart_id")).toBeUndefined()
    })
  })
})
