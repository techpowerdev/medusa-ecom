import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

// CORE-63 (spec 01 กฎข้อ 121, AC-162): (a) ช่องไม่บังคับของ setAddresses ผ่าน trimInvisible,
// (b)(c) ฟอร์มที่อยู่หน้าบัญชี (addCustomerAddress/updateCustomerAddress) ตัดทุกช่อง — ช่องบังคับว่างหลังตัด → ข้อความไทย ไม่เรียก Store API,
// ค่าคงที่ของช่องบังคับ/ข้อความอยู่ใต้ src/lib/util/ ที่เดียว
// อักขระมองไม่เห็นเขียนเป็น escape `\uXXXX` เสมอ (บทเรียน CORE-58)
const THAI = /[฀-๿]/
const ZW = "\u200B"

const retrieve = vi.fn()
const update = vi.fn()
const createAddress = vi.fn()
const updateAddress = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@lib/config", () => ({
  MEDUSA_BACKEND_URL: "http://backend",
  sdk: {
    store: {
      cart: {
        retrieve: (...a: unknown[]) => retrieve(...a),
        update: (...a: unknown[]) => update(...a),
      },
      customer: {
        createAddress: (...a: unknown[]) => createAddress(...a),
        updateAddress: (...a: unknown[]) => updateAddress(...a),
      },
    },
  },
}))
vi.mock("@lib/data/cookies", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({ authorization: "Bearer t" }),
  getCacheOptions: vi.fn().mockResolvedValue({}),
  getCacheTag: vi.fn().mockResolvedValue("t"),
  getCartId: vi.fn().mockResolvedValue("cart_1"),
  removeCartId: vi.fn(),
  setCartId: vi.fn(),
}))
vi.mock("@lib/data/regions", () => ({ getRegion: vi.fn() }))
vi.mock("@lib/data/locale-actions", () => ({ getLocale: vi.fn().mockResolvedValue(null) }))
vi.mock("@lib/data/affiliate", () => ({ syncCartAffiliateToken: vi.fn() }))
vi.mock("@lib/util/server-cart", () => ({}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
  notFound: () => {
    throw new Error("NOT_FOUND")
  },
  unstable_rethrow: vi.fn(),
}))

// SFUI-18c (spec 09 กฎ 55): ตำบล/แขวง (address_2) บังคับกรอก; SFUI-20a (กฎ 69): จังหวัด (province) บังคับกรอก
const REQUIRED = ["first_name", "last_name", "address_1", "address_2", "city", "province", "postal_code"] as const

beforeEach(() => {
  vi.clearAllMocks()
  retrieve.mockResolvedValue({ cart: { id: "cart_1", items: [{ requires_shipping: true }] } })
  update.mockResolvedValue({ cart: { id: "cart_1" } })
  createAddress.mockResolvedValue({ customer: {} })
  updateAddress.mockResolvedValue({ customer: {} })
})

describe("setAddresses: ช่องไม่บังคับ (กฎข้อ 121a)", () => {
  const checkoutForm = () => {
    const form = new FormData()
    form.set("checkout_country_code", "th")
    form.set("email", "a@example.com")
    form.set("same_as_billing", "on")
    form.set("shipping_address.first_name", "สมชาย")
    form.set("shipping_address.last_name", "ใจดี")
    form.set("shipping_address.address_1", "99 ถนนสุขุมวิท")
    form.set("shipping_address.address_2", "คลองเตยเหนือ")
    form.set("shipping_address.postal_code", "10110")
    form.set("shipping_address.city", "วัฒนา")
    form.set("shipping_address.province", "กรุงเทพมหานคร")
    form.set("shipping_address.country_code", "th")
    return form
  }
  const submit = async (form: FormData) =>
    (await import("@lib/data/cart")).setAddresses(null, form).catch((e: Error) => e.message)

  it("company/phone ที่มีแต่ zero-width → ส่ง \"\"", async () => {
    const form = checkoutForm()
    form.set("shipping_address.company", ZW)
    form.set("shipping_address.phone", "\u2060")

    expect(await submit(form)).toBe("REDIRECT /th/checkout?step=delivery")
    const { shipping_address } = update.mock.calls[0][1]
    expect(shipping_address.company).toBe("")
    expect(shipping_address.phone).toBe("")
    expect(shipping_address.country_code).toBe("th")
  })

  it("zero-width หัว/ท้ายของช่องไม่บังคับถูกตัด คงข้อความกลาง", async () => {
    const form = checkoutForm()
    form.set("shipping_address.company", `${ZW}บริษัท${ZW}`)
    form.set("shipping_address.province", `${ZW}กรุงเทพ${ZW}มหานคร `)
    form.set("shipping_address.phone", ` 0812345678${ZW}`)

    expect(await submit(form)).toBe("REDIRECT /th/checkout?step=delivery")
    const { shipping_address } = update.mock.calls[0][1]
    expect(shipping_address.company).toBe("บริษัท")
    expect(shipping_address.province).toBe(`กรุงเทพ${ZW}มหานคร`)
    expect(shipping_address.phone).toBe("0812345678")
  })

  // SFUI-18a (spec 09 กฎ 56, AC-50): ตำบล/แขวง (address_2) อ่านจากฟอร์มและตัด white space/zero-width เหมือนช่องอื่น (เดิมส่ง "" เสมอ)
  // SFUI-18c (กฎ 55, AC-53): ตำบลบังคับ — zero-width/ช่องว่างล้วน → MISSING_ADDRESS_MESSAGE ไม่บันทึกลง cart
  it("address_2 ส่งค่าที่ตัดแล้ว; zero-width ล้วน → MISSING_ADDRESS_MESSAGE ไม่เรียก update", async () => {
    const form = checkoutForm()
    form.set("shipping_address.address_2", ` ${ZW}คลองเตย${ZW}เหนือ\uFEFF `)
    expect(await submit(form)).toBe("REDIRECT /th/checkout?step=delivery")
    expect(update.mock.calls[0][1].shipping_address.address_2).toBe(`คลองเตย${ZW}เหนือ`)

    const blank = checkoutForm()
    blank.set("shipping_address.address_2", `${ZW} \u2060`)
    expect(await submit(blank)).toBe(await missingMessage())
    expect(update).toHaveBeenCalledTimes(1)
  })

  // SFUI-20a (spec 09 กฎ 69, AC-62): จังหวัดบังคับ — ช่องว่าง/zero-width ล้วน → MISSING_ADDRESS_MESSAGE ไม่เรียก update
  it.each([` ${ZW}\uFEFF `, "   ", ""])("province = %j → MISSING_ADDRESS_MESSAGE ไม่เรียก update", async (value) => {
    const form = checkoutForm()
    form.set("shipping_address.province", value)
    expect(await submit(form)).toBe(await missingMessage())
    expect(update).not.toHaveBeenCalled()
  })
})

const accountForm = () => {
  const form = new FormData()
  form.set("first_name", "สมชาย")
  form.set("last_name", "ใจดี")
  form.set("company", "")
  form.set("address_1", "99 ถนนสุขุมวิท")
  form.set("address_2", "คลองเตยเหนือ")
  form.set("city", "วัฒนา")
  form.set("postal_code", "10110")
  form.set("province", "กรุงเทพมหานคร")
  form.set("country_code", "th")
  form.set("phone", "")
  return form
}
const padAll = (form: FormData) => {
  for (const [key, value] of Array.from(form.entries())) {
    if (key !== "country_code") form.set(key, `${ZW}${value}\uFEFF`)
  }
  return form
}

const missingMessage = async () => (await import("@lib/util/address-required")).MISSING_ADDRESS_MESSAGE

describe("addCustomerAddress (กฎข้อ 121b)", () => {
  const add = async (form: FormData) =>
    (await import("@lib/data/customer")).addCustomerAddress({ isDefaultBilling: false }, form)

  it.each(REQUIRED)("%s = ZWSP → ข้อความไทย ไม่เรียก createAddress", async (field) => {
    const form = accountForm()
    form.set(field, ZW)

    const result = await add(form)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(THAI)
    expect(result.error).toBe(await missingMessage())
    expect(createAddress).not.toHaveBeenCalled()
  })

  it("ช่องว่างล้วน (white space) ก็ไม่เรียก createAddress", async () => {
    const form = accountForm()
    form.set("city", "   ")

    expect((await add(form)).success).toBe(false)
    expect(createAddress).not.toHaveBeenCalled()
  })

  it("ทุกช่องถูกต้องแต่มี ZWSP หัว/ท้าย → createAddress ได้ค่าที่ตัดแล้ว", async () => {
    const form = padAll(accountForm())
    form.set("company", `${ZW}บริษัท${ZW}`)
    form.set("phone", `${ZW}`)

    expect(await add(form)).toEqual({ success: true, error: null })
    const body = createAddress.mock.calls[0][0]
    expect(body).toMatchObject({
      first_name: "สมชาย",
      last_name: "ใจดี",
      company: "บริษัท",
      address_1: "99 ถนนสุขุมวิท",
      address_2: "คลองเตยเหนือ",
      city: "วัฒนา",
      postal_code: "10110",
      province: "กรุงเทพมหานคร",
      country_code: "th",
      phone: "",
    })
  })
})

describe("updateCustomerAddress (กฎข้อ 121b)", () => {
  const edit = async (form: FormData) =>
    (await import("@lib/data/customer")).updateCustomerAddress({ addressId: "addr_1" }, form)

  it.each(REQUIRED)("%s = ZWSP → ข้อความไทย ไม่เรียก updateAddress", async (field) => {
    const form = accountForm()
    form.set(field, ZW)

    const result = await edit(form)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(THAI)
    expect(result.error).toBe(await missingMessage())
    expect(updateAddress).not.toHaveBeenCalled()
  })

  it("ทุกช่องถูกต้องแต่มี ZWSP หัว/ท้าย → updateAddress ได้ค่าที่ตัดแล้ว", async () => {
    const form = padAll(accountForm())
    form.set("phone", `${ZW}0812345678 `)

    expect(await edit(form)).toEqual({ success: true, error: null })
    const [id, body] = updateAddress.mock.calls[0]
    expect(id).toBe("addr_1")
    expect(body).toMatchObject({
      first_name: "สมชาย",
      last_name: "ใจดี",
      company: "",
      address_1: "99 ถนนสุขุมวิท",
      address_2: "คลองเตยเหนือ",
      city: "วัฒนา",
      postal_code: "10110",
      province: "กรุงเทพมหานคร",
      country_code: "th",
      phone: "0812345678",
    })
  })

  it("phone ว่างหลังตัด → ไม่ส่ง key phone (คงพฤติกรรมเดิม)", async () => {
    const form = accountForm()
    form.set("phone", ` ${ZW} `)

    expect(await edit(form)).toEqual({ success: true, error: null })
    expect(updateAddress.mock.calls[0][1]).not.toHaveProperty("phone")
  })
})

describe("ค่าคงที่ของช่องบังคับอยู่ที่เดียว (กฎข้อ 121b)", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return files(full)
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : []
    })

  it.each(["const REQUIRED_ADDRESS_FIELDS", "const MISSING_ADDRESS_MESSAGE"])("%s มีไฟล์เดียวใต้ src/lib/util/", (decl) => {
    const owners = files(__dirname)
      .filter((file) => readFileSync(file, "utf8").includes(decl))
      .map((file) => path.relative(__dirname, file))
    expect(owners).toHaveLength(1)
    expect(owners[0]).toMatch(/^lib\/util\//)
  })
})
