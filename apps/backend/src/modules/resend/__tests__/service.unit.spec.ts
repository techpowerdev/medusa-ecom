import ResendNotificationProviderService from "../service"

const mockSend = jest.fn()

// ห้ามเรียก Resend API จริงใน test — mock SDK ทั้งก้อน
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}))

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as any

const order = {
  id: "order_01",
  display_id: 7,
  email: "somchai@example.com",
  currency_code: "thb",
  total: 100,
  subtotal: 100,
  shipping_total: 0,
  tax_total: 7,
  items: [],
}

const buildService = () =>
  new ResendNotificationProviderService(
    { logger },
    { api_key: "re_test_dummy", from: "Shop <shop@example.com>" }
  )

describe("ResendNotificationProviderService", () => {
  beforeEach(() => {
    mockSend.mockReset()
  })

  it("uses the notification-resend identifier", () => {
    expect(ResendNotificationProviderService.identifier).toEqual("notification-resend")
  })

  describe("validateOptions", () => {
    it("requires api_key", () => {
      expect(() =>
        ResendNotificationProviderService.validateOptions({ from: "a@b.co" })
      ).toThrow(/api_key/)
    })

    it("requires from", () => {
      expect(() =>
        ResendNotificationProviderService.validateOptions({ api_key: "re_x" })
      ).toThrow(/from/)
    })

    it("accepts valid options", () => {
      expect(() =>
        ResendNotificationProviderService.validateOptions({ api_key: "re_x", from: "a@b.co" })
      ).not.toThrow()
    })
  })

  describe("send", () => {
    it("sends the rendered template through the Resend client and returns its id", async () => {
      mockSend.mockResolvedValue({ data: { id: "email_123" }, error: null })

      const result = await buildService().send({
        to: "somchai@example.com",
        channel: "email",
        template: "order-placed",
        data: { order },
      } as any)

      expect(result).toEqual({ id: "email_123" })
      expect(mockSend).toHaveBeenCalledTimes(1)
      const payload = mockSend.mock.calls[0][0]
      expect(payload.from).toEqual("Shop <shop@example.com>")
      expect(payload.to).toEqual(["somchai@example.com"])
      expect(payload.subject).toContain("#7")
      expect(payload.html).toContain("฿100.00")
    })

    it("prefers notification.from over the default sender", async () => {
      mockSend.mockResolvedValue({ data: { id: "email_1" }, error: null })

      await buildService().send({
        to: "somchai@example.com",
        from: "Promo <promo@example.com>",
        channel: "email",
        template: "order-placed",
        data: { order },
      } as any)

      expect(mockSend.mock.calls[0][0].from).toEqual("Promo <promo@example.com>")
    })

    it("throws for an unknown template without calling Resend", async () => {
      await expect(
        buildService().send({
          to: "somchai@example.com",
          channel: "email",
          template: "does-not-exist",
          data: {},
        } as any)
      ).rejects.toThrow(/does-not-exist/)

      expect(mockSend).not.toHaveBeenCalled()
    })

    it("throws when Resend returns an error so the notification is marked failed", async () => {
      mockSend.mockResolvedValue({
        data: null,
        error: { name: "validation_error", message: "Invalid `to` field" },
      })

      await expect(
        buildService().send({
          to: "bad",
          channel: "email",
          template: "order-placed",
          data: { order },
        } as any)
      ).rejects.toThrow(/Invalid `to` field/)
    })
  })
})
