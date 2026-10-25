import { buildNotificationProviders } from "../notification-providers"

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
        },
      },
    ])
  })
})
