import { EmailTemplates, renderEmailTemplate } from "../templates"

const order = {
  id: "order_01",
  display_id: 1042,
  email: "somchai@example.com",
  currency_code: "thb",
  total: 1605,
  subtotal: 1500,
  shipping_total: 105,
  tax_total: 105,
  customer: { first_name: "Somchai" },
  items: [
    {
      id: "ordli_01",
      product_title: "Thai Tea <Limited>",
      variant_title: "500g",
      quantity: 2,
      total: 1500,
    },
  ],
}

describe("renderEmailTemplate", () => {
  describe("order-placed", () => {
    it("renders subject with display id and an html body with items and THB totals", () => {
      const email = renderEmailTemplate(EmailTemplates.ORDER_PLACED, { order })

      expect(email).not.toBeNull()
      expect(email!.subject).toContain("#1042")
      expect(email!.html).toContain("Somchai")
      expect(email!.html).toContain("500g")
      expect(email!.html).toContain("× 2")
      // Intl th-TH THB format: ฿1,605.00
      expect(email!.html).toContain("฿1,605.00")
      expect(email!.html).toContain("฿105.00")
    })

    it("escapes html in user-controlled values", () => {
      const email = renderEmailTemplate(EmailTemplates.ORDER_PLACED, {
        order: { ...order, customer: { first_name: "<script>x</script>" } },
      })

      expect(email!.html).not.toContain("<script>")
      expect(email!.html).toContain("&lt;script&gt;")
      expect(email!.html).toContain("Thai Tea &lt;Limited&gt;")
    })
  })

  describe("order-shipped", () => {
    it("renders subject with display id and lists tracking numbers", () => {
      const email = renderEmailTemplate(EmailTemplates.ORDER_SHIPPED, {
        order,
        fulfillment: {
          labels: [
            { tracking_number: "TH123456789", tracking_url: "https://track.example.com/TH123456789" },
          ],
        },
      })

      expect(email).not.toBeNull()
      expect(email!.subject).toContain("#1042")
      expect(email!.html).toContain("TH123456789")
      expect(email!.html).toContain('href="https://track.example.com/TH123456789"')
      expect(email!.html).toContain("500g")
    })

    it("renders without tracking labels", () => {
      const email = renderEmailTemplate(EmailTemplates.ORDER_SHIPPED, {
        order,
        fulfillment: { labels: [] },
      })

      expect(email!.html).toContain("#1042")
    })

    it("drops non-http tracking urls", () => {
      const email = renderEmailTemplate(EmailTemplates.ORDER_SHIPPED, {
        order,
        fulfillment: {
          labels: [{ tracking_number: "TH1", tracking_url: "javascript:alert(1)" }],
        },
      })

      expect(email!.html).not.toContain("javascript:")
      expect(email!.html).toContain("TH1")
    })
  })

  it("returns null for an unknown template", () => {
    expect(renderEmailTemplate("unknown", { order })).toBeNull()
  })
})
