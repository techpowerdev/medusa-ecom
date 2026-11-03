import { randomBytes } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  ContainerRegistrationKeys,
  generateJwtToken,
  Modules,
} from "@medusajs/framework/utils"

jest.setTimeout(120 * 1000)

// ต้องตั้งก่อน runner โหลด medusa-config (module evoucher อ่าน key จาก env)
process.env.EVOUCHER_ENCRYPTION_KEY = randomBytes(32).toString("hex")

type HttpError = { response?: { status: number; data: unknown } }

// ห่อ error ของ axios เป็น Error ธรรมดา (กัน circular reference ทำ jest worker crash)
const expectStatus = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (e) {
    const { response } = e as HttpError
    if (!response) throw new Error(String(e))
    return { status: response.status, data: response.data as { type?: string } }
  }
  throw new Error("expected request to fail")
}

const UNSAFE_URLS = [
  { field: "terms_url", value: "javascript:alert(1)" },
  { field: "logo_url", value: "data:text/html,x" },
  { field: "terms_url", value: "vbscript:msgbox(1)" },
  { field: "logo_url", value: "ftp://example.com/logo.png" },
]

// EV-14 (AC-40, กฎข้อ 26): logo_url/terms_url ของ partner รับเฉพาะ http(s) ทั้งสร้างและแก้
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>

    beforeEach(async () => {
      const container = getContainer()
      const userModule = container.resolve(Modules.USER)
      const authModule = container.resolve(Modules.AUTH)
      const user = await userModule.createUsers({ email: "admin@example.com" })
      const identity = await authModule.createAuthIdentities({
        provider_identities: [
          { provider: "emailpass", entity_id: "admin@example.com" },
        ],
        app_metadata: { user_id: user.id },
      })
      const { http } = container.resolve(
        ContainerRegistrationKeys.CONFIG_MODULE
      ).projectConfig
      const token = generateJwtToken(
        {
          actor_id: user.id,
          actor_type: "user",
          auth_identity_id: identity.id,
          app_metadata: { user_id: user.id },
        },
        { secret: http.jwtSecret, expiresIn: "1d" }
      )
      headers = { authorization: `Bearer ${token}` }
    })

    it.each(UNSAFE_URLS)(
      "create ด้วย $field = $value → 400 invalid_data และไม่บันทึก",
      async ({ field, value }) => {
        const res = await expectStatus(
          api.post(
            "/admin/evoucher/partners",
            { name: "Lotus", [field]: value },
            { headers }
          )
        )
        expect(res.status).toBe(400)
        expect(res.data.type).toBe("invalid_data")

        const list = await api.get("/admin/evoucher/partners", { headers })
        expect(list.data.partners).toEqual([])
      }
    )

    it.each(UNSAFE_URLS)(
      "update ด้วย $field = $value → 400 invalid_data และค่าเดิมไม่เปลี่ยน",
      async ({ field, value }) => {
        const created = await api.post(
          "/admin/evoucher/partners",
          {
            name: "Lotus",
            logo_url: "https://cdn.example.com/lotus.png",
            terms_url: "https://example.com/terms",
          },
          { headers }
        )
        const id = created.data.partner.id as string

        const res = await expectStatus(
          api.post(
            `/admin/evoucher/partners/${id}`,
            { [field]: value },
            { headers }
          )
        )
        expect(res.status).toBe(400)
        expect(res.data.type).toBe("invalid_data")

        const after = await api.get(`/admin/evoucher/partners/${id}`, {
          headers,
        })
        expect(after.data.partner).toEqual(
          expect.objectContaining({
            logo_url: "https://cdn.example.com/lotus.png",
            terms_url: "https://example.com/terms",
          })
        )
      }
    )

    it("รับ http/https และ null ได้ทั้งสร้างและแก้", async () => {
      const created = await api.post(
        "/admin/evoucher/partners",
        {
          name: "Lotus",
          logo_url: "http://cdn.example.com/lotus.png",
          terms_url: "https://example.com/terms",
        },
        { headers }
      )
      expect(created.status).toBe(200)
      expect(created.data.partner).toEqual(
        expect.objectContaining({
          logo_url: "http://cdn.example.com/lotus.png",
          terms_url: "https://example.com/terms",
        })
      )

      const updated = await api.post(
        `/admin/evoucher/partners/${created.data.partner.id}`,
        { logo_url: "https://cdn.example.com/new.png", terms_url: null },
        { headers }
      )
      expect(updated.status).toBe(200)
      expect(updated.data.partner).toEqual(
        expect.objectContaining({
          logo_url: "https://cdn.example.com/new.png",
          terms_url: null,
        })
      )
    })
  },
})
