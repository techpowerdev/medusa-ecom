import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createAdminUser } from "../helpers/admin"

jest.setTimeout(120 * 1000)

// CORE-80 (spec 01 กฎข้อ 138, AC-179): backend แปลงอีเมลเป็นตัวเล็กก่อนถึง route ของ Medusa
// emailpass เก็บ `email` เป็น `entity_id` ตรงๆ (case-sensitive) — เฉพาะ actor customer + affiliate (Q-C13 = ก)
const PASSWORD = "Secret-PW1" // ตัวพิมพ์ผสม: ต้องไม่ถูกแปลง
const MIXED = "Foo.Bar@Example.COM"
const LOWER = "foo.bar@example.com"

type HttpError = { response?: { status: number; data?: { message?: string } } }
// ห่อ error ของ axios (circular) เป็นค่าธรรมดา — CLAUDE.md บทเรียน
const outcome = (request: Promise<{ status: number; data: any }>) =>
  request.then(
    (r) => ({ status: r.status, data: r.data }),
    (e: HttpError) => ({ status: e.response?.status, data: e.response?.data })
  )
const bearer = (token: string, extra: Record<string, string> = {}) => ({
  headers: { authorization: `Bearer ${token}`, ...extra },
})

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const entityIds = async () =>
      (await getContainer().resolve(Modules.AUTH).listProviderIdentities({ provider: "emailpass" })).map(
        (p) => p.entity_id
      )

    describe("customer emailpass", () => {
      it("stores the identity in lowercase and logs in with any casing", async () => {
        const register = await outcome(api.post("/auth/customer/emailpass/register", { email: MIXED, password: PASSWORD }))
        expect(register.status).toBe(200)
        expect(await entityIds()).toEqual([LOWER])

        const login = await outcome(api.post("/auth/customer/emailpass", { email: "FOO.bar@example.com", password: PASSWORD }))
        expect(login.status).toBe(200)
        expect(typeof login.data.token).toBe("string")
      })

      it("rejects a second register that differs only by casing", async () => {
        await api.post("/auth/customer/emailpass/register", { email: MIXED, password: PASSWORD })

        // รหัสผ่านต่าง: emailpass คืน identity เดิม (200) เมื่อรหัสตรงและยังไม่ผูก actor — ซ้ำจริงต้องได้ 401
        const again = await outcome(
          api.post("/auth/customer/emailpass/register", { email: "foo.BAR@example.com", password: "Other-PW9" })
        )

        expect(again.status).toBe(401)
        expect(again.data.message).toBe("Identity with email already exists")
        expect(await entityIds()).toEqual([LOWER])
      })

      it("resets the password through a mixed-case identifier", async () => {
        await api.post("/auth/customer/emailpass/register", { email: MIXED, password: PASSWORD })
        const eventBus = getContainer().resolve(Modules.EVENT_BUS)
        const emit = jest.spyOn(eventBus, "emit")

        const reset = await outcome(api.post("/auth/customer/emailpass/reset-password", { identifier: "FOO.Bar@EXAMPLE.com" }))
        expect(reset.status).toBe(201)

        const messages = emit.mock.calls.flatMap(([m]) => (Array.isArray(m) ? m : [m])) as {
          name: string
          data: { entity_id: string; token: string }
        }[]
        emit.mockRestore()
        const event = messages.find((m) => m.name === "auth.password_reset")
        expect(event?.data.entity_id).toBe(LOWER)

        const update = await outcome(
          api.post("/auth/customer/emailpass/update", { password: "New-Secret-PW2" }, bearer(event!.data.token))
        )
        expect(update.status).toBe(200)
        const login = await outcome(api.post("/auth/customer/emailpass", { email: MIXED, password: "New-Secret-PW2" }))
        expect(login.status).toBe(200)
      })

      it("creates the store customer with a lowercase email", async () => {
        const { data } = await api.post("/auth/customer/emailpass/register", { email: MIXED, password: PASSWORD })
        const [key] = await getContainer()
          .resolve(Modules.API_KEY)
          .createApiKeys([{ title: "core-80", type: "publishable", created_by: "core-80" }])

        const created = await outcome(
          api.post(
            "/store/customers",
            { email: MIXED, first_name: "Somchai", last_name: "McDonald" },
            bearer(data.token, { "x-publishable-api-key": key.token })
          )
        )

        expect(created.status).toBe(200)
        expect(created.data.customer).toEqual(
          expect.objectContaining({ email: LOWER, first_name: "Somchai", last_name: "McDonald" })
        )
      })
    })

    describe("admin customers", () => {
      it("lowercases the email on create and update without touching other fields", async () => {
        const { headers } = await createAdminUser(getContainer())

        const created = await outcome(api.post("/admin/customers", { email: "A@B.CO", first_name: "MixedCase" }, { headers }))
        expect(created.status).toBe(200)
        expect(created.data.customer).toEqual(expect.objectContaining({ email: "a@b.co", first_name: "MixedCase" }))

        const updated = await outcome(
          api.post(`/admin/customers/${created.data.customer.id}`, { email: "C@D.CO", last_name: "McKay" }, { headers })
        )
        expect(updated.status).toBe(200)
        expect(updated.data.customer).toEqual(expect.objectContaining({ email: "c@d.co", last_name: "McKay" }))
      })
    })

    describe("affiliate emailpass", () => {
      it("stores the identity and affiliate in lowercase and logs in with any casing", async () => {
        const register = await outcome(api.post("/auth/affiliate/emailpass/register", { email: MIXED, password: PASSWORD }))
        expect(register.status).toBe(200)
        expect(await entityIds()).toEqual([LOWER])

        const affiliate = await outcome(
          api.post("/affiliate/register", { name: "Ann McAfee", code: "ann-core80" }, bearer(register.data.token))
        )
        expect(affiliate.status).toBe(200)
        expect(affiliate.data.affiliate).toEqual(expect.objectContaining({ email: LOWER, name: "Ann McAfee" }))

        const again = await outcome(api.post("/auth/affiliate/emailpass/register", { email: "FOO.BAR@example.com", password: PASSWORD }))
        expect(again.status).toBe(401)
        expect(again.data.message).toBe("Identity with email already exists")

        const login = await outcome(api.post("/auth/affiliate/emailpass", { email: "fOO.bar@EXAMPLE.com", password: PASSWORD }))
        expect(login.status).toBe(200)
      })
    })

    // Q-C13 = ก (owner 2026-11-21): ไม่แตะ /auth/user/* ของแอดมิน
    describe("admin user actor", () => {
      it("keeps the admin identity as sent", async () => {
        const register = await outcome(api.post("/auth/user/emailpass/register", { email: MIXED, password: PASSWORD }))

        expect(register.status).toBe(200)
        expect(await entityIds()).toEqual([MIXED])
      })
    })
  },
})
