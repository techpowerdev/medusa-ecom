import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

jest.setTimeout(60 * 1000)

// CORE-1 smoke test: แอป Medusa บูตได้กับ Postgres จริง และ endpoint /health ที่ Medusa มีให้ตอบ 200
medusaIntegrationTestRunner({
  testSuite: ({ api }) => {
    describe("GET /health", () => {
      it("returns 200 when the app has booted", async () => {
        const response = await api.get("/health")

        expect(response.status).toEqual(200)
      })
    })
  },
})
