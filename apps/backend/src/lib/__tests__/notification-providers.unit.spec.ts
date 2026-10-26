import { buildNotificationProviders, storefrontUrlWarning } from "../notification-providers"

describe("buildNotificationProviders", () => {
  it("falls back to Medusa's local provider for email (and feed) when RESEND_API_KEY is missing", () => {
    const providers = buildNotificationProviders({})

    expect(providers).toEqual([
      expect.objectContaining({
        resolve: "@medusajs/medusa/notification-local",
        id: "local",
        options: expect.objectContaining({ channels: ["feed", "email"] }),
      }),
    ])
  })

  it("treats an empty RESEND_API_KEY as missing", () => {
    const providers = buildNotificationProviders({ RESEND_API_KEY: "" })

    expect(providers).toHaveLength(1)
    expect(providers[0].resolve).toEqual("@medusajs/medusa/notification-local")
  })

  it("uses the Resend provider for email and keeps local for the admin feed when the key is set", () => {
    const providers = buildNotificationProviders({
      RESEND_API_KEY: "re_from_env",
      RESEND_FROM_EMAIL: "Shop <shop@example.com>",
      EVOUCHER_ENCRYPTION_KEY: "ab".repeat(32),
    })

    expect(providers).toEqual([
      expect.objectContaining({
        resolve: "@medusajs/medusa/notification-local",
        id: "local",
        options: expect.objectContaining({ channels: ["feed"] }),
      }),
      {
        resolve: "./src/modules/resend",
        id: "resend",
        options: {
          channels: ["email"],
          api_key: "re_from_env",
          from: "Shop <shop@example.com>",
          // EV-4: ถอด code/PIN ของ e-voucher ตอน render อีเมล (notification.data เก็บ ciphertext)
          evoucher_encryption_key: "ab".repeat(32),
        },
      },
    ])
  })
})

// GB-4 review #89: ลิงก์ชำระเงินในอีเมลต้องเป็น URL เต็ม — production ที่ไม่ตั้ง STOREFRONT_URL ต้องเตือนตอนบูต
describe("storefrontUrlWarning", () => {
  it("warns in production when STOREFRONT_URL is missing or not http(s)", () => {
    expect(storefrontUrlWarning({ NODE_ENV: "production" })).toMatch(/STOREFRONT_URL/)
    expect(storefrontUrlWarning({ NODE_ENV: "production", STOREFRONT_URL: "shop.example" })).toMatch(
      /STOREFRONT_URL/
    )
  })

  it("is silent when set in production, and outside production", () => {
    expect(storefrontUrlWarning({ NODE_ENV: "production", STOREFRONT_URL: "https://shop.example" })).toBeNull()
    expect(storefrontUrlWarning({ NODE_ENV: "development" })).toBeNull()
  })
})
