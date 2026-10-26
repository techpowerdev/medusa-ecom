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

    it("lists shipped items with quantity but without prices (CORE-11)", () => {
      const email = renderEmailTemplate(EmailTemplates.ORDER_SHIPPED, {
        order: {
          ...order,
          items: [{ id: "ordli_01", product_title: "Thai Tea", variant_title: "500g", quantity: 1 }],
        },
        fulfillment: { labels: [] },
      })

      expect(email!.html).toContain("Thai Tea — 500g × 1")
      expect(email!.html).not.toContain("฿")
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

  describe("e-voucher admin emails (EV-5)", () => {
    it("renders the low-stock alert with pool name, available count and threshold", () => {
      const email = renderEmailTemplate(EmailTemplates.EVOUCHER_LOW_STOCK, {
        pool: { id: "evpool_1", name: "Lotus <500>", available: 3, low_stock_threshold: 20 },
      })

      expect(email).not.toBeNull()
      expect(email!.subject).toContain("Lotus")
      expect(email!.html).toContain("Lotus &lt;500&gt;")
      expect(email!.html).toContain("<b>3</b>")
      expect(email!.html).toContain("<b>20</b>")
    })

    it("renders the daily expiry summary with voided counts per pool", () => {
      const email = renderEmailTemplate(EmailTemplates.EVOUCHER_EXPIRY_SUMMARY, {
        date: "2026-10-25",
        total_voided: 5,
        pools: [
          { id: "evpool_1", name: "Lotus 500", voided: 2 },
          { id: "evpool_2", name: "Big C <100>", voided: 3 },
        ],
      })

      expect(email).not.toBeNull()
      expect(email!.subject).toContain("2026-10-25")
      expect(email!.html).toContain("Lotus 500")
      expect(email!.html).toContain("Big C &lt;100&gt;")
      expect(email!.html).toContain("<b>5</b>")
    })
  })
  describe("e-voucher delivery emails (EV-4)", () => {
    const delivered = {
      order: { id: "order_01", display_id: 1042 },
      vouchers: [
        {
          title: "Lotus Gift Voucher <500>",
          partner: { name: "Lotus", logo_url: "https://cdn.example.com/lotus.png" },
          how_to_use: "แสดง code ที่แคชเชียร์ <ทุกสาขา>",
          validity_note: "ใช้ได้ทุกสาขา",
          // code/PIN ใน notification.data เป็น ciphertext เสมอ — ถอดตอน render เท่านั้น
          codes: [
            { code: "enc:LOTUS-0001", pin: "enc:1111", expires_at: "2026-12-31T16:59:59.999Z" },
            { code: "enc:LOTUS-0002", pin: null, expires_at: null },
          ],
        },
      ],
    }

    const decrypt = (value: string) => value.replace(/^enc:/, "")

    it("renders every code with PIN, expiry (Thai date), partner logo and how-to-use block", () => {
      const email = renderEmailTemplate(EmailTemplates.EVOUCHER_DELIVERED, delivered, { decrypt })

      expect(email).not.toBeNull()
      expect(email!.subject).toContain("#1042")
      expect(email!.html).toContain("LOTUS-0001")
      expect(email!.html).toContain("LOTUS-0002")
      expect(email!.html).toContain("1111")
      // 2026-12-31T16:59:59.999Z = สิ้นวัน 31 ธ.ค. 2026 เวลาไทย
      expect(email!.html).toContain("2026-12-31")
      expect(email!.html).toContain('src="https://cdn.example.com/lotus.png"')
      expect(email!.html).toContain("แสดง code ที่แคชเชียร์ &lt;ทุกสาขา&gt;")
      expect(email!.html).toContain("Lotus Gift Voucher &lt;500&gt;")
      expect(email!.html).toContain("ใช้ได้ทุกสาขา")
      expect(email!.html).not.toContain("enc:")
    })

    it("refuses to render codes without a decrypt function", () => {
      expect(() => renderEmailTemplate(EmailTemplates.EVOUCHER_DELIVERED, delivered)).toThrow(/decrypt/)
    })

    it("renders the delivery-failed admin alert with the order id", () => {
      const email = renderEmailTemplate(EmailTemplates.EVOUCHER_DELIVERY_FAILED, {
        order: { id: "order_01", display_id: 1042, email: "somchai@example.com" },
        error: "resend down <x>",
      })

      expect(email!.subject).toContain("#1042")
      expect(email!.html).toContain("order_01")
      expect(email!.html).toContain("somchai@example.com")
      expect(email!.html).toContain("resend down &lt;x&gt;")
    })

    it("drops a non-http partner logo url", () => {
      const email = renderEmailTemplate(EmailTemplates.EVOUCHER_DELIVERED, {
        ...delivered,
        vouchers: [{ ...delivered.vouchers[0], partner: { name: "Lotus", logo_url: "javascript:alert(1)" } }],
      }, { decrypt })

      expect(email!.html).not.toContain("javascript:")
    })

    it("renders the backordered admin alert with order and the short line items", () => {
      const email = renderEmailTemplate(EmailTemplates.EVOUCHER_BACKORDERED, {
        order: { id: "order_01", display_id: 1042, email: "somchai@example.com" },
        items: [{ line_item_id: "ordli_01", title: "Lotus <500>", quantity: 2, pool_name: "Lotus pool" }],
      })

      expect(email).not.toBeNull()
      expect(email!.subject).toContain("#1042")
      expect(email!.html).toContain("order_01")
      expect(email!.html).toContain("somchai@example.com")
      expect(email!.html).toContain("Lotus &lt;500&gt;")
      expect(email!.html).toContain("× 2")
      expect(email!.html).toContain("Lotus pool")
    })
  })

  // PAY-6b (spec 06 กฎข้อ 7D, ADR-015 D): อีเมลถึง OPS_ALERT_EMAIL เมื่อ webhook ชำระแล้วแต่หา session ไม่เจอ
  describe("payment-webhook-orphan", () => {
    it("renders the PI id, session id, amount and the runbook title (escaped)", () => {
      const email = renderEmailTemplate(EmailTemplates.PAYMENT_WEBHOOK_ORPHAN, {
        provider: "stripe-promptpay_stripe",
        session_id: "payses_<x>",
        payment_intent: "pi_123",
        amount: 500,
      })

      expect(email).not.toBeNull()
      expect(email!.subject).toContain("PAYMENT_WEBHOOK_SESSION_NOT_FOUND")
      expect(email!.subject).toContain("pi_123")
      expect(email!.html).toContain("pi_123")
      expect(email!.html).toContain("payses_&lt;x&gt;")
      expect(email!.html).toContain("stripe-promptpay_stripe")
      expect(email!.html).toContain("500")
      expect(email!.html).toContain("เงินถูกตัดแต่ไม่มี order (ADR-015)")
    })
  })
})
