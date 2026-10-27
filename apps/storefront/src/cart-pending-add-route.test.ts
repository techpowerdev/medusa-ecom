import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-14d (spec 01 กฎข้อ 58, AC-93): ลูกค้าที่ล็อกอินแล้วเปิด /account?add_variant=… → หน้า dashboard ส่งมา route นี้
// เพิ่มลง cart แล้ว redirect /cart เหมือน flow หลัง login; เพิ่มไม่สำเร็จ → /account?…&add_error=1
const addPendingToCart = vi.fn()

vi.mock("@lib/data/customer", () => ({
  addPendingToCart: (...a: unknown[]) => addPendingToCart(...a),
}))

const get = async (query: string, countryCode = "th") => {
  const { GET } = await import("./app/[countryCode]/(main)/cart/pending-add/route")
  const request = new NextRequest(`http://localhost:8000/${countryCode}/cart/pending-add?${query}`)
  return GET(request, { params: Promise.resolve({ countryCode }) })
}

describe("GET /[countryCode]/cart/pending-add (CORE-14d)", () => {
  beforeEach(() => addPendingToCart.mockReset())

  it("ส่ง variant/quantity/country จาก URL ให้ addPendingToCart", async () => {
    await get("add_variant=variant_01&add_quantity=2")
    expect(addPendingToCart).toHaveBeenCalledWith({
      variantId: "variant_01",
      quantity: 2,
      countryCode: "th",
    })
  })

  it("ไม่มี variant หรือ country ไม่ถูกต้อง → 400 ข้อความไทย ไม่แตะ cart", async () => {
    for (const [query, cc] of [["", "th"], ["add_variant=v", "../x"]]) {
      const res = await get(query, cc)
      expect(res?.status).toBe(400)
      expect(await res?.text()).toMatch(/[฀-๿]/)
    }
    expect(addPendingToCart).not.toHaveBeenCalled()
  })
})
