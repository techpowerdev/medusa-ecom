import { FetchError } from "@medusajs/js-sdk"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-20d (spec 01 กฎข้อ 66c/66e, AC-102): backend ตอบ 400 RETURN_WINDOW_EXPIRED → server action คืนข้อความไทยเฉพาะ code นั้น
// พร้อมค่าที่ลูกค้าเลือก (จำนวน/เหตุผล) เพื่อให้ฟอร์มคงค่าเดิมหลังส่งล้ม
const fetchMock = vi.fn()
const retrieveOrder = vi.fn()

vi.mock("@lib/config", () => ({ sdk: { client: { fetch: (...a: unknown[]) => fetchMock(...a) } } }))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: async () => ({ authorization: "Bearer t" }),
  getCacheTag: async () => "orders",
}))
vi.mock("@lib/data/orders", () => ({ retrieveOrder: (...a: unknown[]) => retrieveOrder(...a) }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const line = (id: string) => ({
  id,
  requires_shipping: true,
  detail: { shipped_quantity: 2, return_requested_quantity: 0, return_received_quantity: 0, return_dismissed_quantity: 0 },
})
const ORDER = {
  id: "order_1",
  region_id: "reg_1",
  cart: { id: "cart_1" },
  items: [line("L1"), line("L2")],
  fulfillments: [{ shipped_at: yesterday, items: [{ line_item_id: "L1" }, { line_item_id: "L2" }] }],
}

const submit = async () => {
  const { requestReturn } = await import("@lib/data/returns")
  const form = new FormData()
  form.set("order_id", "order_1")
  form.set("quantity:L1", "2")
  form.set("reason:L1", "rr_damaged")
  form.set("quantity:L2", "0")
  return requestReturn({ success: false, error: null }, form)
}

describe("requestReturn เมื่อ backend ปฏิเสธ (CORE-20d)", () => {
  beforeEach(() => {
    retrieveOrder.mockReset().mockResolvedValue(ORDER)
    fetchMock.mockReset().mockImplementation(async (url: string) => {
      if (url.startsWith("/store/regions/")) return { region: { id: "reg_1", metadata: {} } }
      if (url === "/store/shipping-options") return { shipping_options: [{ id: "so_return" }] }
      if (url === "/store/returns") {
        throw new FetchError("The return window for this order has expired", "Bad Request", 400)
      }
      throw new Error(`unexpected ${url}`)
    })
  })

  it("400 RETURN_WINDOW_EXPIRED → ข้อความไทยเฉพาะ code และคืนค่าที่เลือกไว้", async () => {
    const result = await submit()
    expect(result.success).toBe(false)
    expect(result.error).toBe("เลยระยะเวลาที่ขอคืนสินค้าได้แล้ว")
    expect(result.values).toEqual({ "quantity:L1": "2", "reason:L1": "rr_damaged", "quantity:L2": "0" })
  })

  it("region ไม่ตั้ง return_window_days → ใช้ค่าเริ่มต้นแล้วส่งถึง backend (ไม่ปฏิเสธเอง)", async () => {
    await submit()
    expect(fetchMock).toHaveBeenCalledWith("/store/returns", expect.objectContaining({ method: "POST" }))
  })
})
