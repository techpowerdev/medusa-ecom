// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (k: string) => (k === "step" ? "address" : null) }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/th/checkout",
  useParams: () => ({ countryCode: "th" }),
}))
vi.mock("@lib/data/cart", () => ({ setAddresses: vi.fn() }))

// CORE-52 (spec 01 กฎข้อ 110d–e, AC-147): ค่าประเทศคงที่เมื่อ form ถูก reset (SFUI-20b: hidden แทน select) (React 19 reset `<form action>`
// หลัง action คืน error) และ ShippingAddress sync จาก cart เมื่อที่อยู่ที่บันทึกเปลี่ยน (แบบปรับ state ระหว่าง render)
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// SFUI-5a: checkbox เป็น Checkbox ของ shadcn (Radix วัดขนาดด้วย ResizeObserver ที่ jsdom ไม่มี)
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const region = {
  id: "reg_1",
  countries: [
    { iso_2: "sg", display_name: "Singapore" },
    { iso_2: "th", display_name: "Thailand" },
  ],
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

// SFUI-20b (spec 09 กฎ 70 — แทน CORE-52 กฎข้อ 110d ส่วน select ประเทศ): ไม่มีช่องประเทศแล้ว — hidden `shipping_address.country_code` = th คงที่
// (ไม่คัดลอกจากที่อยู่ต้นทาง) และคงค่าหลัง form.reset()
const hiddenCountry = () => new FormData(container.querySelector("form") ?? undefined).get("shipping_address.country_code")

describe("ShippingAddress sync จากที่อยู่ใน cart (กฎข้อ 110e, 73b)", () => {
  const cart = (city: string, email = "a@example.com") =>
    ({
      id: "cart_1",
      email,
      region,
      shipping_address: {
        first_name: "สมชาย",
        last_name: "ใจดี",
        address_1: "1",
        postal_code: "10110",
        city,
        country_code: "th",
      },
    }) as never

  const render = async (c: unknown, customer: unknown = null) => {
    const { default: ShippingAddress } = await import("@modules/checkout/components/shipping-address")
    await act(async () => {
      root.render(
        createElement(ShippingAddress, { cart: c, customer, checked: true, onChange: () => {} } as never)
      )
    })
  }
  const value = (testId: string) =>
    container.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!.value

  it("ที่อยู่ที่บันทึกเปลี่ยน → ฟอร์มแสดงค่าใหม่", async () => {
    await render(cart("วัฒนา"))
    expect(value("shipping-city-input")).toBe("วัฒนา")

    await render(cart("บางรัก"))
    expect(value("shipping-city-input")).toBe("บางรัก")
    expect(container.querySelector<HTMLInputElement>('input[type="hidden"][name="shipping_address.country_code"]')!.value).toBe("th")
  })

  it("SFUI-20b (กฎ 70): ที่อยู่ใน cart เป็นประเทศอื่น → ค่าที่ส่ง (hidden) ยังเป็น ADDRESS_COUNTRY_CODE และไม่มีช่องประเทศ", async () => {
    const { ADDRESS_COUNTRY_CODE } = await import("@lib/util/address-required")
    const other = cart("วัฒนา") as unknown as { shipping_address: Record<string, string> }
    other.shipping_address.country_code = "sg"
    await render(other)
    expect(container.querySelector<HTMLInputElement>('input[type="hidden"][name="shipping_address.country_code"]')!.value).toBe(ADDRESS_COUNTRY_CODE)
    expect(container.querySelector('[data-testid="shipping-country-select"]')).toBeNull()
  })

  it("cart ไม่มีอีเมล → ใช้อีเมลของลูกค้า", async () => {
    await render(cart("วัฒนา", ""), { email: "c@example.com", addresses: [] })
    expect(value("shipping-email-input")).toBe("c@example.com")
  })
})

// qa #353 D-1: React 19 reset `<form action>` หลัง setAddresses คืน error → checkbox "ใช้ที่อยู่จัดส่งเป็นที่อยู่ใบเสร็จ"
// กลับเป็น defaultChecked (ติ๊ก) ขณะฟอร์มใบเสร็จยังแสดง → ส่งใหม่ได้ same_as_billing=on ที่อยู่ใบเสร็จที่กรอกหายเงียบ
describe("ฟอร์มที่อยู่หลัง form.reset() (กฎข้อ 110d, qa #353 D-1)", () => {
  const cart = {
    id: "cart_1",
    email: "a@example.com",
    region,
    items: [{ id: "item_1", requires_shipping: true }],
    shipping_address: { first_name: "สมชาย", address_1: "1", city: "วัฒนา", country_code: "th" },
    billing_address: { first_name: "สมชาย", address_1: "1", city: "วัฒนา", country_code: "th" },
  }
  const input = (testId: string) => container.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!

  it("ไม่ติ๊กใช้ที่อยู่จัดส่ง → reset แล้ว checkbox ยังไม่ติ๊ก และค่าที่พิมพ์ในฟอร์มใบเสร็จไม่หาย", async () => {
    const { default: Addresses } = await import("@modules/checkout/components/addresses")
    await act(async () => {
      root.render(createElement(Addresses, { cart, customer: null } as never))
    })
    // SFUI-5a: testid อยู่บน root role="checkbox" ของ Radix (aria-checked) + ค่าที่ส่งจริงอยู่ใน FormData
    const checked = () => input("billing-address-checkbox").getAttribute("aria-checked")
    const sameAsBilling = () => new FormData(container.querySelector("form")!).get("same_as_billing")
    expect(checked()).toBe("true")
    expect(sameAsBilling()).toBe("on")

    await act(async () => input("billing-address-checkbox").click())
    expect(checked()).toBe("false")
    const email = input("shipping-email-input")
    expect(email.value).toBe("a@example.com")

    act(() => container.querySelector("form")!.reset())

    expect(checked()).toBe("false")
    expect(sameAsBilling()).toBeNull()
    expect(input("billing-first-name-input")).not.toBeNull()
    // SFUI-20b (กฎ 70): ประเทศ hidden คงค่า th หลัง reset ทั้งจัดส่งและใบเสร็จ
    expect(hiddenCountry()).toBe("th")
    expect(new FormData(container.querySelector("form")!).get("billing_address.country_code")).toBe("th")
  })
})
