import { FetchError } from "@medusajs/js-sdk"
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-29 (spec 01 กฎข้อ 86, AC-122; ADR-019 ทางเลือก B): จำ id ตะกร้าหลักใน customer.metadata.active_cart_id
// ทุกครั้งที่ตั้ง cookie `_medusa_cart_id` เป็น cart ใหม่ และกู้ตอน login เมื่อไม่มี cookie cart
const fetch = vi.fn()
const cartCreate = vi.fn()
const cartUpdate = vi.fn()
const createLineItem = vi.fn()
const transferCart = vi.fn()
const cartComplete = vi.fn()
const customerUpdate = vi.fn()
const customerRetrieve = vi.fn()
const setCartId = vi.fn()
const removeCartId = vi.fn()
let cartCookie: string | undefined

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  MEDUSA_BACKEND_URL: "http://backend",
  sdk: {
    auth: { login: vi.fn().mockResolvedValue("tok") },
    client: { fetch: (...a: unknown[]) => fetch(...a) },
    store: {
      cart: {
        create: (...a: unknown[]) => cartCreate(...a),
        update: (...a: unknown[]) => cartUpdate(...a),
        createLineItem: (...a: unknown[]) => createLineItem(...a),
        transferCart: (...a: unknown[]) => transferCart(...a),
        complete: (...a: unknown[]) => cartComplete(...a),
      },
      customer: {
        update: (...a: unknown[]) => customerUpdate(...a),
        retrieve: (...a: unknown[]) => customerRetrieve(...a),
      },
    },
  },
}))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ authorization: "Bearer tok" }),
  getCacheOptions: vi.fn().mockResolvedValue({}),
  getCacheTag: vi.fn().mockResolvedValue("carts-t"),
  getCartId: async () => cartCookie,
  setCartId: async (id: string) => {
    setCartId(id)
    cartCookie = id
  },
  removeCartId: async () => {
    removeCartId()
    cartCookie = undefined
  },
  setAuthToken: vi.fn(),
  getPendingCustomer: vi.fn(),
  removePendingCustomer: vi.fn(),
}))
vi.mock("@lib/data/regions", () => ({
  getRegion: vi.fn().mockResolvedValue({ id: "reg_1" }),
  listRegions: vi.fn().mockResolvedValue([{ id: "reg_1", countries: [{ iso_2: "th" }] }]),
}))
vi.mock("@lib/data/locale-actions", () => ({ getLocale: vi.fn().mockResolvedValue(null) }))
vi.mock("@lib/data/affiliate", () => ({ syncCartAffiliateToken: vi.fn() }))
vi.mock("@lib/data/fulfillment", () => ({
  listCartShippingMethods: vi.fn().mockResolvedValue([]),
  calculatePriceForShippingOption: vi.fn(),
}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
  unstable_rethrow: vi.fn(),
}))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))

const remembered = (id: string) => [{ metadata: { active_cart_id: id } }, {}, { authorization: "Bearer tok" }]

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
  cartCookie = undefined
  // mockReset: ค่า Once ที่ค้างจาก test ก่อนหน้าไม่รั่วข้าม test
  for (const fn of [fetch, cartCreate, cartUpdate, createLineItem, transferCart, cartComplete, customerUpdate, customerRetrieve]) {
    fn.mockReset()
  }
  cartCreate.mockResolvedValue({ cart: { id: "cart_new", region_id: "reg_1", metadata: null } })
  cartUpdate.mockResolvedValue({ cart: { id: "cart_new", metadata: null, currency_code: "thb" } })
  createLineItem.mockResolvedValue({ cart: { id: "cart_new" } })
  customerUpdate.mockResolvedValue({ customer: {} })
  customerRetrieve.mockResolvedValue({ customer: { metadata: null, addresses: [] } })
  transferCart.mockResolvedValue({ cart: {} })
})

describe("บันทึก active_cart_id เมื่อตั้ง cookie cart ใหม่ (กฎข้อ 86a)", () => {
  it("getOrSetCart สร้าง cart ใหม่ → customer.update ด้วย active_cart_id 1 ครั้ง", async () => {
    fetch.mockRejectedValue(new FetchError("Not Found", "Not Found", 404))
    const { getOrSetCart } = await import("@lib/data/cart")
    await expect(getOrSetCart("th")).resolves.toMatchObject({ id: "cart_new" })
    expect(customerUpdate.mock.calls).toEqual([remembered("cart_new")])
  })

  it("customer.update reject → getOrSetCart ยังสำเร็จและตั้ง cookie", async () => {
    fetch.mockRejectedValue(new FetchError("Not Found", "Not Found", 404))
    customerUpdate.mockRejectedValue(new FetchError("boom", "Internal Server Error", 500))
    const { getOrSetCart } = await import("@lib/data/cart")
    await expect(getOrSetCart("th")).resolves.toMatchObject({ id: "cart_new" })
    expect(setCartId).toHaveBeenCalledWith("cart_new")
    expect(console.error).toHaveBeenCalled()
  })

  it("getOrSetCart ใช้ cart เดิมใน cookie → ไม่เรียก customer.update", async () => {
    cartCookie = "cart_old"
    fetch.mockResolvedValue({ cart: { id: "cart_old", region_id: "reg_1", metadata: null } })
    const { getOrSetCart } = await import("@lib/data/cart")
    await getOrSetCart("th")
    expect(customerUpdate).not.toHaveBeenCalled()
  })

  it("activateCart → customer.update ด้วย active_cart_id 1 ครั้ง; reject ก็ไม่ throw", async () => {
    const { activateCart } = await import("@lib/util/server-cart")
    await activateCart("cart_buy")
    expect(customerUpdate.mock.calls).toEqual([remembered("cart_buy")])
    customerUpdate.mockRejectedValueOnce(new TypeError("fetch failed"))
    await expect(activateCart("cart_buy2")).resolves.toBeUndefined()
    expect(setCartId).toHaveBeenLastCalledWith("cart_buy2")
  })

  it("activateCart กับ cart เดิมใน cookie (เช่น /cart/add เพิ่มลง cart เดิม) → ไม่เรียก customer.update", async () => {
    cartCookie = "cart_same"
    const { activateCart } = await import("@lib/util/server-cart")
    await activateCart("cart_same")
    expect(setCartId).toHaveBeenCalledWith("cart_same")
    expect(customerUpdate).not.toHaveBeenCalled()
  })

  it("prepareGroupCart (cart ของกลุ่ม — spec 04 กฎข้อ 14c) → ไม่เรียก customer.update และไม่ตั้ง cookie", async () => {
    const address = { id: "addr_1", first_name: "A", country_code: "th" }
    customerRetrieve.mockReset()
    fetch.mockResolvedValue({ customer: { email: "a@example.com", addresses: [address] } })
    const { prepareGroupCart } = await import("@lib/data/group-join")
    const result = await prepareGroupCart({
      countryCode: "th",
      addressId: "addr_1",
      items: [{ variant_id: "v_1", quantity: 1 }],
    })
    expect(result).toMatchObject({ ok: true })
    expect(customerUpdate).not.toHaveBeenCalled()
    expect(setCartId).not.toHaveBeenCalled()
  })
})

describe("payment-return ตั้ง cookie cart (กฎข้อ 86a)", () => {
  const returnRequest = () =>
    new NextRequest(
      "http://shop.test/api/payment-return?cart_id=cart_pay&country_code=th&payment_intent=pi_1&payment_intent_client_secret=sec_1&redirect_status=failed"
    )

  beforeEach(() => {
    fetch.mockResolvedValue({
      cart: { payment_collection: { payment_sessions: [{ data: { id: "pi_1", client_secret: "sec_1" } }] } },
    })
  })

  it("cookie ยังไม่ใช่ cart นี้ → customer.update ด้วย active_cart_id 1 ครั้ง", async () => {
    const { GET } = await import("./app/api/payment-return/route")
    const res = await GET(returnRequest())
    expect(res.headers.get("location")).toContain("/th/checkout?step=payment")
    expect(setCartId).toHaveBeenCalledWith("cart_pay")
    expect(customerUpdate.mock.calls).toEqual([remembered("cart_pay")])
  })

  it("customer.update reject → ยัง redirect ตามเดิม", async () => {
    customerUpdate.mockRejectedValue(new FetchError("boom", "Internal Server Error", 500))
    const { GET } = await import("./app/api/payment-return/route")
    const res = await GET(returnRequest())
    expect(res.headers.get("location")).toContain("/th/checkout?step=payment")
  })

  it("cookie เป็น cart นี้อยู่แล้ว → ไม่เขียนซ้ำ", async () => {
    cartCookie = "cart_pay"
    const { GET } = await import("./app/api/payment-return/route")
    await GET(returnRequest())
    expect(customerUpdate).not.toHaveBeenCalled()
  })
})

// CORE-4i-b (กฎข้อ 72): placeOrder คืน { kind } (CORE-76) แทนการ throw
// PAY-12 (spec 06 กฎข้อ 14, AC-25): route แยกทางตาม kind — refunded → error=refunded, processing → อ่าน order ของ cart,
// unauthorized → หน้า login พร้อม return path เดิม, อื่นๆ → error=order_failed (เดิม)
describe("payment-return หลัง Stripe สำเร็จ: ผลของ placeOrder (CORE-4i-b, PAY-12)", () => {
  const SUCCEEDED_PATH =
    "/api/payment-return?cart_id=cart_pay&country_code=th&payment_intent=pi_1&payment_intent_client_secret=sec_1&redirect_status=succeeded"
  const succeededRequest = () => new NextRequest(`http://shop.test${SUCCEEDED_PATH}`)
  const conflict = (code: string, message = "x") =>
    Object.assign(new FetchError(message, "Conflict", 409), { code })
  const rethrowRedirects = async () => {
    const { unstable_rethrow } = await import("next/navigation")
    vi.mocked(unstable_rethrow).mockImplementation((e: unknown) => {
      if (e instanceof Error && e.message.startsWith("REDIRECT ")) throw e
    })
  }

  beforeEach(() => {
    cartCookie = "cart_pay"
    fetch.mockResolvedValue({
      cart: { payment_collection: { payment_sessions: [{ data: { id: "pi_1", client_secret: "sec_1" } }] } },
    })
  })

  afterEach(async () => {
    const { unstable_rethrow } = await import("next/navigation")
    vi.mocked(unstable_rethrow).mockReset() // implementation ของ rethrowRedirects ไม่รั่วไป describe อื่น
  })

  it.each([
    ["409 FLASH_SOLD_OUT", () => cartComplete.mockRejectedValue(conflict("FLASH_SOLD_OUT"))],
    ["409 FLASH_LIMIT_EXCEEDED", () => cartComplete.mockRejectedValue(conflict("FLASH_LIMIT_EXCEEDED"))],
    [
      "400 สต็อกไม่พอตอน complete (ไม่มี code)",
      () =>
        cartComplete.mockRejectedValue(
          new FetchError("Some variant does not have the required inventory", "Bad Request", 400)
        ),
    ],
  ])("%s → kind refunded → /th/cart?error=refunded", async (_label, arrange) => {
    arrange()
    const { GET } = await import("./app/api/payment-return/route")
    const res = await GET(succeededRequest())
    expect(res.headers.get("location")).toBe("http://shop.test/th/cart?error=refunded")
  })

  it.each([
    ["500", () => cartComplete.mockRejectedValue(new FetchError("x", "Internal Server Error", 500))],
    ["409 ไม่รู้จัก code", () => cartComplete.mockRejectedValue(conflict("SOMETHING_ELSE"))],
    ["cart ไม่ complete (type: cart)", () => cartComplete.mockResolvedValue({ type: "cart", cart: {}, error: { message: "declined" } })],
  ])("%s → { kind: failed } → /cart?error=order_failed", async (_label, arrange) => {
    arrange()
    const { GET } = await import("./app/api/payment-return/route")
    const res = await GET(succeededRequest())
    expect(cartComplete).toHaveBeenCalledWith("cart_pay", {}, expect.anything())
    expect(res.headers.get("location")).toBe("http://shop.test/th/cart?error=order_failed")
  })

  it.each([401, 403])("%s → หน้า login พร้อม return path เดิม (ไม่ใช่ order_failed)", async (status) => {
    cartComplete.mockRejectedValue(new FetchError("x", "Unauthorized", status))
    const { GET } = await import("./app/api/payment-return/route")
    const location = new URL((await GET(succeededRequest())).headers.get("location")!)
    expect(`${location.origin}${location.pathname}`).toBe("http://shop.test/th/account")
    expect(location.searchParams.get("return_to")).toBe(SUCCEEDED_PATH)
  })

  it("409 CART_COMPLETION_IN_PROGRESS + order มีแล้ว → หน้า order confirmed (ไม่ใช่ error=refunded)", async () => {
    await rethrowRedirects()
    cartComplete
      .mockRejectedValueOnce(conflict("CART_COMPLETION_IN_PROGRESS"))
      .mockResolvedValueOnce({ type: "order", order: { id: "order_1" } })
    const { GET } = await import("./app/api/payment-return/route")
    await expect(GET(succeededRequest())).rejects.toThrow("REDIRECT /th/order/order_1/confirmed")
    expect(cartComplete).toHaveBeenCalledTimes(2)
  })

  it("409 CART_COMPLETION_IN_PROGRESS + ยังไม่มี order → /th/checkout?step=review (กลไก poll ของ PAY-6b)", async () => {
    await rethrowRedirects()
    cartComplete.mockRejectedValue(
      new FetchError("Cart is already being completed by another request", "Conflict", 409)
    )
    const { GET } = await import("./app/api/payment-return/route")
    const res = await GET(succeededRequest())
    expect(res.headers.get("location")).toBe("http://shop.test/th/checkout?step=review")
    expect(cartComplete).toHaveBeenCalledTimes(2)
  })

  it("ได้ order → redirect ของ Next ถูกส่งต่อ (unstable_rethrow) ไม่กลายเป็น order_failed", async () => {
    const { unstable_rethrow } = await import("next/navigation")
    vi.mocked(unstable_rethrow).mockImplementationOnce((e: unknown) => {
      throw e
    })
    cartComplete.mockResolvedValue({ type: "order", order: { id: "order_1", shipping_address: { country_code: "TH" } } })
    const { GET } = await import("./app/api/payment-return/route")
    await expect(GET(succeededRequest())).rejects.toThrow("REDIRECT /th/order/order_1/confirmed")
  })
})

describe("กู้ตะกร้าตอน login (กฎข้อ 86b, 86c)", () => {
  const login = async () => {
    const { login } = await import("@lib/data/customer")
    const form = new FormData()
    form.set("email", "a@example.com")
    form.set("password", "pw")
    return login(null, form)
  }
  const cartGets = () => fetch.mock.calls.filter(([url]) => String(url).startsWith("/store/carts/"))

  beforeEach(() => {
    customerRetrieve.mockResolvedValue({ customer: { metadata: { active_cart_id: "cart_c", other: 1 } } })
  })

  it("ไม่มี cookie cart, cart ยังไม่ complete → setCartId(C) และ login สำเร็จ", async () => {
    fetch.mockResolvedValue({ cart: { id: "cart_c", completed_at: null } })
    await expect(login()).resolves.toEqual({ state: "success" })
    expect(cartGets()).toHaveLength(1)
    expect(cartGets()[0][1]).toMatchObject({ headers: { authorization: "Bearer tok" }, cache: "no-store" })
    expect(setCartId).toHaveBeenCalledWith("cart_c")
  })

  it("cart complete แล้ว → ไม่ตั้ง cookie", async () => {
    fetch.mockResolvedValue({ cart: { id: "cart_c", completed_at: "2026-11-04T00:00:00Z" } })
    await expect(login()).resolves.toEqual({ state: "success" })
    expect(setCartId).not.toHaveBeenCalled()
  })

  it("cart ไม่ใช่ของตัวเอง (404 — CORE-12) → ไม่ตั้ง cookie, login สำเร็จ, warn สั้นๆ ไม่ใช่ error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    fetch.mockRejectedValue(new FetchError("Cart not found", "Not Found", 404))
    await expect(login()).resolves.toEqual({ state: "success" })
    expect(setCartId).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0].every((arg) => typeof arg === "string"), "ไม่ส่ง error object (ไม่มี stack)").toBe(true)
  })

  it("อ่าน cart ได้ 500 → ไม่ตั้ง cookie, login สำเร็จ และ console.error", async () => {
    fetch.mockRejectedValue(new FetchError("boom", "Internal Server Error", 500))
    await expect(login()).resolves.toEqual({ state: "success" })
    expect(setCartId).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalled()
  })

  it("ไม่มีค่าใน metadata → ไม่อ่าน cart", async () => {
    customerRetrieve.mockResolvedValue({ customer: { metadata: null } })
    await expect(login()).resolves.toEqual({ state: "success" })
    expect(cartGets()).toHaveLength(0)
    expect(setCartId).not.toHaveBeenCalled()
  })

  it("ใช้ metadata จากการอ่าน customer ครั้งเดิมของ completeLogin (ไม่ retrieve ซ้ำ)", async () => {
    fetch.mockResolvedValue({ cart: { id: "cart_c", completed_at: null } })
    await expect(login()).resolves.toEqual({ state: "success" })
    expect(customerRetrieve).toHaveBeenCalledTimes(1)
    expect(setCartId).toHaveBeenCalledWith("cart_c")
  })

  it("มี cookie cart D อยู่แล้วหลัง transfer → ไม่แตะ (ไม่อ่าน active_cart_id)", async () => {
    cartCookie = "cart_d"
    await expect(login()).resolves.toEqual({ state: "success" })
    expect(transferCart).toHaveBeenCalledWith("cart_d", {}, { authorization: "Bearer tok" })
    expect(cartGets()).toHaveLength(0)
    expect(setCartId).not.toHaveBeenCalled()
    expect(cartCookie).toBe("cart_d")
  })

  it("cookie cart ของคนอื่นถูกทิ้ง (transfer 404) → กู้จาก active_cart_id", async () => {
    cartCookie = "cart_of_b"
    transferCart.mockRejectedValueOnce(new FetchError("Cart not found", "Not Found", 404))
    fetch.mockResolvedValue({ cart: { id: "cart_c", completed_at: null } })
    await expect(login()).resolves.toEqual({ state: "success" })
    expect(removeCartId).toHaveBeenCalledTimes(1)
    expect(setCartId).toHaveBeenCalledWith("cart_c")
  })
})
