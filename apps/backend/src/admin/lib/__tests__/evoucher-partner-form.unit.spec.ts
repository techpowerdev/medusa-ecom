import {
  HTTP_URL_MESSAGE,
  PARTNER_PARSE_OPTIONS,
  partnerFormSchema,
  toPartnerFormValues,
} from "../evoucher-partner-form"

// ADM-5 (spec 08 AC-8, กฎ 8) + spec 02 กฎข้อ 26 (follow-up EV-14 #195): ฟอร์มสร้าง/แก้ partner ในหน้า E-vouchers
describe("partnerFormSchema", () => {
  const filled = toPartnerFormValues()

  const errorsOf = (input: unknown) => {
    const parsed = partnerFormSchema.safeParse(input, PARTNER_PARSE_OPTIONS)
    expect(parsed.success).toBe(false)
    return Object.fromEntries(parsed.error!.issues.map((i) => [i.path.join("."), i.message]))
  }

  it("ค่าเริ่มต้นของฟอร์มสร้างเป็น string ว่างทุกช่อง", () => {
    expect(filled).toEqual({ name: "", logo_url: "", terms_url: "", support_contact: "" })
  })

  it("ค่าของ partner เดิม → ค่าฟอร์ม (null → ว่าง)", () => {
    expect(
      toPartnerFormValues({
        id: "evpart_1",
        name: "Starbucks",
        logo_url: "https://example.com/logo.png",
        terms_url: null,
        support_contact: null,
      })
    ).toEqual({ name: "Starbucks", logo_url: "https://example.com/logo.png", terms_url: "", support_contact: "" })
  })

  it("แปลงค่าฟอร์มเป็น body (trim; ช่องไม่บังคับที่ว่าง → null เพื่อล้างค่าเดิม)", () => {
    expect(
      partnerFormSchema.parse(
        { name: "  Starbucks  ", logo_url: " ", terms_url: "https://example.com/terms ", support_contact: "" },
        PARTNER_PARSE_OPTIONS
      )
    ).toEqual({ name: "Starbucks", logo_url: null, terms_url: "https://example.com/terms", support_contact: null })
  })

  it.each(["", "   "])("name %p → Name is required", (name) => {
    expect(errorsOf({ ...filled, name })).toEqual({ name: "Name is required" })
  })

  it.each(["http://example.com/logo.png", "https://example.com/terms", "HTTPS://EXAMPLE.COM"])(
    "URL %p (http/https) ผ่าน",
    (url) => {
      const body = partnerFormSchema.parse({ ...filled, name: "A", logo_url: url, terms_url: url }, PARTNER_PARSE_OPTIONS)
      expect(body.logo_url).toBe(url)
      expect(body.terms_url).toBe(url)
    }
  )

  it.each(["javascript:alert(1)", "data:text/html,x", "ftp://example.com/file", "example.com", "vbscript:msgbox(1)", "https//x"])(
    "URL %p ไม่ใช่ http(s) → error ใต้ช่องนั้น",
    (url) => {
      expect(errorsOf({ ...filled, name: "A", logo_url: url })).toEqual({ logo_url: HTTP_URL_MESSAGE })
      expect(errorsOf({ ...filled, name: "A", terms_url: url })).toEqual({ terms_url: HTTP_URL_MESSAGE })
    }
  )

  it("ค่าที่ไม่ใช่ string (เช่น undefined) ได้ข้อความต่อช่องจาก fieldErrorMap ไม่ใช่ Invalid input", () => {
    expect(errorsOf({ logo_url: "", terms_url: "", support_contact: "" })).toEqual({ name: "Name is required" })
  })
})
