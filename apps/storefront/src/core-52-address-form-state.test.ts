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

// CORE-52 (spec 01 กฎข้อ 110d–e, AC-147): select ประเทศคงค่าที่เลือกเมื่อ form ถูก reset (React 19 reset `<form action>`
// หลัง action คืน error) และ ShippingAddress sync จาก cart เมื่อที่อยู่ที่บันทึกเปลี่ยน (แบบปรับ state ระหว่าง render)
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

const select = (testId: string) =>
  container.querySelector<HTMLSelectElement>(`[data-testid="${testId}"]`)!

describe("CountrySelect หลัง form.reset() (กฎข้อ 110d)", () => {
  it("คงค่า value ที่ควบคุมอยู่ ไม่กลับไปตัวเลือกแรก", async () => {
    const { default: CountrySelect } = await import("@modules/checkout/components/country-select")
    const render = (value: string) =>
      act(async () => {
        root.render(
          createElement(
            "form",
            null,
            createElement(CountrySelect, {
              name: "shipping_address.country_code",
              region: region as never,
              value,
              onChange: () => {},
              "data-testid": "shipping-country-select",
            } as never)
          )
        )
      })

    await render("")
    await render("th")
    expect(select("shipping-country-select").value).toBe("th")

    act(() => container.querySelector("form")!.reset())

    expect(select("shipping-country-select").value).toBe("th")
  })
})

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
    expect(select("shipping-country-select").value).toBe("th")
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
    expect(input("billing-address-checkbox").checked).toBe(true)

    await act(async () => input("billing-address-checkbox").click())
    expect(input("billing-address-checkbox").checked).toBe(false)
    const email = input("shipping-email-input")
    expect(email.value).toBe("a@example.com")

    act(() => container.querySelector("form")!.reset())

    expect(input("billing-address-checkbox").checked).toBe(false)
    expect(input("billing-first-name-input")).not.toBeNull()
  })
})
