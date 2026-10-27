import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { AFFILIATE_MODULE } from "../../src/modules/affiliate"

jest.setTimeout(60 * 1000)

const AFFILIATE = { email: "ann@example.com", password: "ann-password" }
const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } })

// AF-1 / AC-12: affiliate เป็น actor type แยกของ Auth module ไม่ใช่ customer
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const registerAffiliate = async () => {
      const { data } = await api.post("/auth/affiliate/emailpass/register", AFFILIATE)
      return api.post("/affiliate/register", { name: "Ann", code: "ann" }, bearer(data.token))
    }

    const login = async (actor: string, body: Record<string, string>) => {
      const { data } = await api.post(`/auth/${actor}/emailpass`, body)
      return data.token as string
    }

    describe("affiliate register + login (AC-12)", () => {
      it("registers an affiliate as pending without creating a customer", async () => {
        const response = await registerAffiliate()

        expect(response.status).toEqual(200)
        expect(response.data.affiliate).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            email: AFFILIATE.email,
            name: "Ann",
            code: "ann",
            status: "pending",
          })
        )
        expect(response.data.affiliate.payout_info).toBeUndefined()

        const authModule = getContainer().resolve(Modules.AUTH)
        const [identity] = await authModule.listAuthIdentities({
          app_metadata: { affiliate_id: response.data.affiliate.id },
        })
        expect(identity.app_metadata).not.toHaveProperty("customer_id")

        const customerModule = getContainer().resolve(Modules.CUSTOMER)
        expect(await customerModule.listCustomers({ email: AFFILIATE.email })).toHaveLength(0)
      })

      it("logs in at /auth/affiliate/emailpass and reads /affiliate/me", async () => {
        await registerAffiliate()
        const token = await login("affiliate", AFFILIATE)

        const response = await api.get("/affiliate/me", bearer(token))

        expect(response.status).toEqual(200)
        expect(response.data.affiliate).toEqual(
          expect.objectContaining({ email: AFFILIATE.email, code: "ann", status: "pending" })
        )
        expect(response.data.affiliate.payout_info).toBeUndefined()
      })

      // AF-13 / AC-39 (กฎ 34): has_payout_info เป็น boolean และยังไม่ส่ง payout_info (AC-16)
      it.each([
        [{ bank_name: "x" }, true],
        [null, false],
        [{}, false],
      ])("returns has_payout_info for payout_info %p as %p without payout_info (AC-39)", async (payoutInfo, expected) => {
        const { data } = await registerAffiliate()
        await getContainer()
          .resolve(AFFILIATE_MODULE)
          .updateAffiliates({ id: data.affiliate.id, payout_info: payoutInfo })
        const token = await login("affiliate", AFFILIATE)

        const response = await api.get("/affiliate/me", bearer(token))

        expect(response.status).toEqual(200)
        expect(response.data.affiliate.has_payout_info).toBe(expected)
        expect(response.data.affiliate).not.toHaveProperty("payout_info")
      })

      it("rejects registering twice with the same auth identity", async () => {
        await registerAffiliate()
        const token = await login("affiliate", AFFILIATE)

        const error = await api
          .post("/affiliate/register", { name: "Ann again", code: "ann2" }, bearer(token))
          .catch((e) => e)

        expect(error.response.status).toEqual(400)
      })

      it("rejects a duplicate affiliate code", async () => {
        await registerAffiliate()
        const { data } = await api.post("/auth/affiliate/emailpass/register", {
          email: "bob@example.com",
          password: "bob-password",
        })

        const error = await api
          .post("/affiliate/register", { name: "Bob", code: "ann" }, bearer(data.token))
          .catch((e) => e)

        expect(error.response.status).toEqual(400)
      })

      it("requires authentication to register an affiliate", async () => {
        const error = await api
          .post("/affiliate/register", { name: "Ann", code: "ann" })
          .catch((e) => e)

        expect(error.response.status).toEqual(401)
      })
    })

    describe("actor isolation (AC-12)", () => {
      it("returns 401 on /affiliate/me without a token", async () => {
        const error = await api.get("/affiliate/me").catch((e) => e)

        expect(error.response.status).toEqual(401)
      })

      it("returns 401 on /affiliate/me for a customer token", async () => {
        const container = getContainer()
        const customer = { email: "cust@example.com", password: "cust-password" }
        const { authIdentity } = await container
          .resolve(Modules.AUTH)
          .register("emailpass", { body: customer })
        await createCustomerAccountWorkflow(container).run({
          input: { authIdentityId: authIdentity!.id, customerData: { email: customer.email } },
        })
        const token = await login("customer", customer)

        const error = await api.get("/affiliate/me", bearer(token)).catch((e) => e)

        expect(error.response.status).toEqual(401)
      })

      it("does not let a customer token register as an affiliate", async () => {
        const container = getContainer()
        const customer = { email: "cust2@example.com", password: "cust-password" }
        const { authIdentity } = await container
          .resolve(Modules.AUTH)
          .register("emailpass", { body: customer })
        await createCustomerAccountWorkflow(container).run({
          input: { authIdentityId: authIdentity!.id, customerData: { email: customer.email } },
        })
        const token = await login("customer", customer)

        const error = await api
          .post("/affiliate/register", { name: "Cust", code: "cust" }, bearer(token))
          .catch((e) => e)

        expect(error.response.status).toEqual(401)
      })
    })
  },
})
