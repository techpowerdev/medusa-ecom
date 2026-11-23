import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-82 (spec 01 กฎข้อ 140, AC-181 a, ADR-028): helper `medusaFetch` เรียก Store API ด้วย fetch ตรง
// → error 4xx เป็น `MedusaApiError` ที่มี status/type/code ครบ (FetchError ของ js-sdk 2.22.1 ทิ้ง code/type)
// และ header (publishable key, auth, locale) + credentials เท่ากับที่ `sdk.client.fetch` ส่ง — ล้มเมื่อ bump SDK แล้วต่างกัน
const getAuthHeaders = vi.fn()
const getLocale = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@lib/data/cookies", () => ({ getAuthHeaders: () => getAuthHeaders() }))
vi.mock("@lib/data/locale-actions", () => ({ getLocale: () => getLocale() }))

const fetchMock = vi.fn()
const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 })

const load = async () => {
  vi.resetModules()
  return {
    config: await import("@lib/config"),
    medusaFetch: (await import("@lib/data/medusa-fetch")).medusaFetch,
    MedusaApiError: (await import("@lib/util/medusa-api-error")).MedusaApiError,
  }
}

/** URL, method, body, credentials และ header (ชื่อตัวเล็ก) ของ request ล่าสุด */
const lastRequest = () => {
  const [input, init] = fetchMock.mock.calls.at(-1)!
  return {
    url: String(input),
    method: init.method,
    body: init.body,
    credentials: init.credentials,
    headers: Object.fromEntries(new Headers(init.headers).entries()),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("NEXT_PUBLIC_MEDUSA_BACKEND_URL", "http://backend.test")
  vi.stubEnv("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY", "pk_test_core82")
  vi.stubGlobal("fetch", fetchMock)
  getAuthHeaders.mockResolvedValue({ authorization: "Bearer jwt_1" })
  getLocale.mockResolvedValue("th")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("medusaFetch: error ของ Store API (AC-181 a)", () => {
  it("4xx { type, code, message } → MedusaApiError มี status/type/code/message ครบ", async () => {
    const { medusaFetch, MedusaApiError } = await load()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: "conflict", code: "FLASH_SOLD_OUT", message: "This flash sale is sold out" }), {
        status: 409,
        statusText: "Conflict",
      })
    )
    const error = await medusaFetch("/store/carts/cart_1/complete").catch((e: unknown) => e)
    expect(error).toBeInstanceOf(MedusaApiError)
    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({
      status: 409,
      type: "conflict",
      code: "FLASH_SOLD_OUT",
      message: "This flash sale is sold out",
    })
  })

  it("4xx ไม่มี code (error ของ Medusa core) → code null, type ตาม body", async () => {
    const { medusaFetch } = await load()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: "not_allowed", message: "Not enough stock available for item x at location y" }), {
        status: 400,
      })
    )
    await expect(medusaFetch("/store/carts/cart_1/complete")).rejects.toMatchObject({
      status: 400,
      type: "not_allowed",
      code: null,
    })
  })

  it("body ไม่ใช่ JSON → status ครบ, type/code null, message = statusText", async () => {
    const { medusaFetch } = await load()
    fetchMock.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502, statusText: "Bad Gateway" }))
    await expect(medusaFetch("/store/carts/cart_1")).rejects.toMatchObject({
      status: 502,
      type: null,
      code: null,
      message: "Bad Gateway",
    })
  })

  it("network error → throw error เดิม (แบบ SDK) ไม่ใช่ MedusaApiError", async () => {
    const { medusaFetch, MedusaApiError } = await load()
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))
    const error = await medusaFetch("/store/carts/cart_1").catch((e: unknown) => e)
    expect(error).toBeInstanceOf(TypeError)
    expect(error).not.toBeInstanceOf(MedusaApiError)
  })

  it("2xx → body JSON; POST ไป base URL + path พร้อม body JSON และไม่ตั้ง cache (CORE-4i-b)", async () => {
    const { medusaFetch } = await load()
    fetchMock.mockResolvedValue(ok({ cart: { id: "cart_1" } }))
    await expect(medusaFetch("/store/carts/cart_1", { promo_codes: ["A"] })).resolves.toEqual({ cart: { id: "cart_1" } })
    const req = lastRequest()
    expect(req.url).toBe("http://backend.test/store/carts/cart_1")
    expect(req.method).toBe("POST")
    expect(JSON.parse(req.body)).toEqual({ promo_codes: ["A"] })
    expect(fetchMock.mock.calls[0][1].cache).toBeUndefined()
  })
})

describe("medusaFetch: header เท่ากับ sdk.client.fetch (AC-181 a)", () => {
  it.each([
    ["login + locale th", { authorization: "Bearer jwt_1" }, "th"],
    ["login + ไม่มี cookie locale", { authorization: "Bearer jwt_1" }, null],
    ["ไม่ login + locale en", {}, "en"],
    ["ไม่ login + ไม่มี locale", {}, null],
  ])("%s", async (_label, auth, locale) => {
    getAuthHeaders.mockResolvedValue(auth)
    getLocale.mockResolvedValue(locale)
    fetchMock.mockImplementation(async () => ok())
    const { config, medusaFetch } = await load()

    // แบบที่ data layer เรียก SDK: header = getAuthHeaders()
    await config.sdk.client.fetch("/store/carts/cart_1/complete", {
      method: "POST",
      headers: { ...(await getAuthHeaders()) },
      body: { a: 1 },
    })
    const viaSdk = lastRequest()
    await medusaFetch("/store/carts/cart_1/complete", { a: 1 })
    const viaHelper = lastRequest()

    expect(viaHelper.headers).toEqual(viaSdk.headers)
    expect(viaHelper.credentials).toBe(viaSdk.credentials)
    expect(viaHelper.url).toBe(viaSdk.url)
    expect(viaHelper.body).toBe(viaSdk.body)
    expect(viaHelper.headers["x-publishable-api-key"]).toBe("pk_test_core82")
  })

  // CORE-84: route ของ affiliate ส่ง token ของ actor `affiliate` แทน JWT ของลูกค้า — header อื่นเหมือนเดิม
  it.each([
    ["token ของ affiliate", { authorization: "Bearer aff_tok" }],
    ["ไม่ส่ง auth", {}],
  ])("authHeaders (%s) แทน getAuthHeaders", async (_label, auth) => {
    fetchMock.mockImplementation(async () => ok())
    const { medusaFetch } = await load()
    await medusaFetch("/affiliate/register", { code: "ann" })
    const viaCustomer = lastRequest().headers
    await medusaFetch("/affiliate/register", { code: "ann" }, auth)
    const { authorization: _customer, ...rest } = viaCustomer
    expect(_customer).toBe("Bearer jwt_1")
    expect(lastRequest().headers).toEqual({ ...rest, ...auth })
  })

  it("ไม่มี body → ไม่ส่ง body (แบบ sdk.store.cart.complete)", async () => {
    fetchMock.mockImplementation(async () => ok())
    const { medusaFetch } = await load()
    await medusaFetch("/store/carts/cart_1/complete")
    expect(lastRequest().body).toBeUndefined()
  })
})

// AC-181 b (static): กลุ่ม checkout/cart/payment ไม่เหลือ map ข้อความอังกฤษของ backend/Medusa —
// ข้อความ error ของ Medusa core ที่ไม่มี code อยู่ในรายการข้อยกเว้นของ helper (`medusa-api-error.ts`) ที่เดียว
describe("static: กลุ่ม checkout/cart/payment ตัดสินจาก code (AC-181 b)", () => {
  const src = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8")
  const GROUP = [
    "lib/util/checkout-error.ts",
    "lib/util/insufficient-inventory.ts",
    "lib/util/place-order-outcome.ts",
    "lib/util/action-result.ts",
    "lib/data/cart.ts",
    "lib/data/payment.ts",
  ]
  const ENGLISH_MESSAGES = [
    "This flash sale is sold out",
    "Flash sale limit per customer exceeded",
    "can't be combined",
    "Some variant does not have the required inventory",
    "Not enough stock available",
    "Cannot complete a cart with no items",
    "already being completed",
  ]

  it.each(GROUP)("%s ไม่มีข้อความอังกฤษของ backend และไม่เทียบ message", (file) => {
    const text = src(file)
    for (const message of ENGLISH_MESSAGES) {
      expect(text, message).not.toContain(message)
    }
    expect(text).not.toMatch(/normalize\(/)
  })

  it("map 409 ตอน complete มีแค่ code + ข้อความไทย (ไม่มี field message)", async () => {
    const { CHECKOUT_CONFLICTS } = await import("@lib/util/checkout-error")
    for (const conflict of CHECKOUT_CONFLICTS) {
      expect(Object.keys(conflict).sort()).toEqual(["code", "text"])
    }
  })

  it("ข้อยกเว้นที่ไม่มี code อยู่ใน helper ที่เดียว", () => {
    const helper = src("lib/util/medusa-api-error.ts")
    expect(helper).toContain("Not enough stock available for item ")
    expect(helper).toContain("Cannot complete a cart with no items")
  })

  it("ไม่มี fetch ตรงไป Store API นอก helper (createPaymentSession ย้ายเข้า medusaFetch — ADR-028)", () => {
    for (const file of ["lib/data/payment.ts", "lib/data/cart.ts"]) {
      expect(src(file), file).not.toMatch(/\bawait fetch\(|[^.\w]fetch\(`\$\{MEDUSA_BACKEND_URL/)
    }
    expect(src("lib/data/medusa-fetch.ts")).toMatch(/fetch\(/)
  })

  it("empty-cart-completion.ts ถูกแทนด้วยข้อยกเว้นของ helper", () => {
    expect(() => src("lib/util/empty-cart-completion.ts")).toThrow()
  })
})
