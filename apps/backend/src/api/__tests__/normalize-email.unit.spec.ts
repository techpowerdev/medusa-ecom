import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { normalizeEmailBody, normalizeEmailMiddlewares } from "../normalize-email"

// CORE-80 (spec 01 กฎข้อ 138, AC-179): middleware แปลงเฉพาะ `email`/`identifier` ที่เป็น string
const run = (body: unknown, validatedBody?: unknown) => {
  const req = { body, validatedBody } as unknown as MedusaRequest
  const next = jest.fn() as unknown as MedusaNextFunction
  normalizeEmailBody(req, {} as MedusaResponse, next)
  expect(next).toHaveBeenCalledTimes(1)
  return req as unknown as { body: unknown; validatedBody: unknown }
}

describe("normalizeEmailBody", () => {
  it("lowercases email and identifier without touching other fields", () => {
    const req = run({
      email: " Foo.Bar@Example.COM ",
      identifier: "FOO.bar@example.com",
      password: "Secret-PW1",
      first_name: "Somchai",
      metadata: { Email: "Keep@Me.CO" },
    })

    expect(req.body).toEqual({
      email: "foo.bar@example.com",
      identifier: "foo.bar@example.com",
      password: "Secret-PW1",
      first_name: "Somchai",
      metadata: { Email: "Keep@Me.CO" },
    })
  })

  it("also normalizes validatedBody when a validator already ran", () => {
    const req = run({ email: "A@B.CO" }, { email: "A@B.CO", first_name: "Ann" })

    expect(req.validatedBody).toEqual({ email: "a@b.co", first_name: "Ann" })
  })

  it.each([[undefined], [null], ["A@B.CO"], [{ email: 42, identifier: null }]])(
    "leaves non-object bodies and non-string fields alone (%p)",
    (body) => {
      const copy = body && typeof body === "object" ? { ...body } : body
      expect(run(body).body).toEqual(copy)
    }
  )
})

describe("normalizeEmailMiddlewares", () => {
  const matchers = normalizeEmailMiddlewares.map((route) => String(route.matcher))

  it("covers customer + affiliate emailpass and customer create/update routes", () => {
    expect(matchers).toEqual(
      expect.arrayContaining([
        "/auth/customer/emailpass",
        "/auth/customer/emailpass/register",
        "/auth/customer/emailpass/reset-password",
        "/auth/affiliate/emailpass",
        "/auth/affiliate/emailpass/register",
        "/auth/affiliate/emailpass/reset-password",
        "/store/customers",
        "/admin/customers",
        "/admin/customers/:id",
      ])
    )
    expect(normalizeEmailMiddlewares.every((route) => route.method?.toString() === "POST")).toBe(true)
  })

  // Q-C13 = ก (owner 2026-11-21): ไม่แตะ /auth/user/* ของแอดมิน
  it("does not touch the admin user actor", () => {
    expect(matchers.some((m) => m.includes("/auth/user"))).toBe(false)
  })
})
