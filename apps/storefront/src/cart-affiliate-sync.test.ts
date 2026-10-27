import { beforeEach, describe, expect, it, vi } from "vitest"

// AF-3b (spec 05 กฎ 23, AC-21/AC-22): sync cookie `aff` ลง cart.metadata.affiliate_token ด้วย metadata ของ cart ที่อ่านอยู่แล้ว
// — add to cart ไม่มี round-trip `GET /store/carts/:id` เพิ่ม และ sync อีกครั้งก่อน complete เมื่อค่าใน cookie ต่าง
const fetch = vi.fn()
const create = vi.fn()
const update = vi.fn()
const createLineItem = vi.fn()
const complete = vi.fn()
let affCookie: string | undefined

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  MEDUSA_BACKEND_URL: "http://backend",
  sdk: {
    client: { fetch: (...a: unknown[]) => fetch(...a) },
    store: {
      cart: {
        create: (...a: unknown[]) => create(...a),
        update: (...a: unknown[]) => update(...a),
        createLineItem: (...a: unknown[]) => createLineItem(...a),
        complete: (...a: unknown[]) => complete(...a),
      },
    },
  },
}))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ authorization: "Bearer t" }),
  getCacheOptions: vi.fn().mockResolvedValue({}),
  getCacheTag: vi.fn().mockResolvedValue("carts-t"),
  getCartId: vi.fn().mockResolvedValue("cart_1"),
  removeCartId: vi.fn(),
  setCartId: vi.fn(),
}))
vi.mock("@lib/data/regions", () => ({ getRegion: vi.fn().mockResolvedValue({ id: "reg_1" }) }))
vi.mock("@lib/data/locale-actions", () => ({ getLocale: vi.fn().mockResolvedValue(null) }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "aff" && affCookie ? { value: affCookie } : undefined),
  }),
}))

const cartGets = () =>
  fetch.mock.calls.filter(([url, init]) => url === "/store/carts/cart_1" && (init?.method ?? "GET") === "GET")

const metadataUpdates = () => update.mock.calls.filter(([, body]) => body && "metadata" in body)

beforeEach(() => {
  vi.clearAllMocks()
  affCookie = "tok_bob"
  create.mockResolvedValue({ cart: { id: "cart_1", region_id: "reg_1", metadata: null } })
  update.mockResolvedValue({ cart: { id: "cart_1" } })
  createLineItem.mockResolvedValue({ cart: { id: "cart_1" } })
  complete.mockResolvedValue({ type: "cart", cart: { id: "cart_1" } })
})

const existingCart = (metadata: Record<string, unknown> | null) =>
  fetch.mockResolvedValue({ cart: { id: "cart_1", region_id: "reg_1", metadata } })

const add = async () => {
  const { addToCart } = await import("@lib/data/cart")
  await addToCart({ variantId: "variant_1", quantity: 1, countryCode: "th" })
}

describe("addToCart กับ cookie aff (AC-22)", () => {
  it("cart มี token ของคนอื่น → อ่าน cart ครั้งเดียวเท่าก่อน AF-2 และตั้ง metadata เป็นค่า cookie", async () => {
    existingCart({ affiliate_token: "tok_ann", note: "keep" })
    await add()
    expect(cartGets()).toHaveLength(1)
    expect(metadataUpdates()).toEqual([
      ["cart_1", { metadata: { affiliate_token: "tok_bob", note: "keep" } }, {}, { authorization: "Bearer t" }],
    ])
    expect(createLineItem).toHaveBeenCalledTimes(1)
  })

  it("token ใน cart เท่ากับ cookie → ไม่ POST metadata", async () => {
    existingCart({ affiliate_token: "tok_bob" })
    await add()
    expect(cartGets()).toHaveLength(1)
    expect(metadataUpdates()).toHaveLength(0)
  })

  it("ยังไม่มี cart → สร้างใหม่แล้วใช้ metadata จากผลการสร้าง ไม่อ่าน cart ซ้ำ", async () => {
    fetch.mockRejectedValue(new Error("not found"))
    await add()
    expect(cartGets()).toHaveLength(1)
    expect(metadataUpdates()).toEqual([
      ["cart_1", { metadata: { affiliate_token: "tok_bob" } }, {}, { authorization: "Bearer t" }],
    ])
  })

  it("ไม่มี cookie aff → ไม่แตะ metadata", async () => {
    affCookie = undefined
    existingCart({ affiliate_token: "tok_ann" })
    await add()
    expect(metadataUpdates()).toHaveLength(0)
  })
})

describe("placeOrder sync cookie aff ก่อน complete (กฎ 23, AC-21)", () => {
  const place = async (...args: unknown[]) => {
    const { placeOrder } = await import("@lib/data/cart")
    return (placeOrder as (...a: unknown[]) => Promise<unknown>)(...args)
  }

  it("cookie เปลี่ยนเป็น Bob หลัง add (cart ยังเป็น Ann) → POST metadata ก่อน complete โดยไม่อ่าน cart เพิ่ม", async () => {
    await place("cart_1", { affiliate_token: "tok_ann" })
    expect(metadataUpdates()).toEqual([
      ["cart_1", { metadata: { affiliate_token: "tok_bob" } }, {}, { authorization: "Bearer t" }],
    ])
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(complete.mock.invocationCallOrder[0])
    expect(cartGets()).toHaveLength(0)
  })

  it("cookie ไม่เปลี่ยน → ไม่มี POST /store/carts/:id เพื่อ sync", async () => {
    await place("cart_1", { affiliate_token: "tok_bob" })
    expect(update).not.toHaveBeenCalled()
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it("sync ล้มต้องไม่ทำให้การสั่งซื้อล้ม", async () => {
    update.mockRejectedValueOnce(new Error("boom"))
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await place("cart_1", { affiliate_token: "tok_ann" })
    expect(complete).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it("ผู้เรียกไม่ส่ง metadata (cart ถูก complete โดย webhook แล้ว เช่น PromptPay) → ไม่ sync", async () => {
    await place("cart_1")
    expect(update).not.toHaveBeenCalled()
  })
})
