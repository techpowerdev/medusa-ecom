import { planLowercase } from "../lowercase-emails"

// CORE-81 (spec 01 กฎข้อ 139): แผนแปลงอีเมล + ตรวจชนภายใต้ unique index เดิม
describe("planLowercase", () => {
  const row = (id: string, email: string, uniqueWith = "", convert = true) => ({ id, email, uniqueWith, convert })

  it("lists only rows whose email changes when lowercased", () => {
    expect(planLowercase([row("a", "Foo@X.co"), row("b", "bar@x.co")])).toEqual({
      changes: [{ id: "a", from: "Foo@X.co", to: "foo@x.co" }],
      collisions: [],
    })
  })

  it("reports rows that end up equal under the same unique key", () => {
    expect(planLowercase([row("a", "A@x.co"), row("b", "a@x.co"), row("c", "C@x.co")]).collisions).toEqual([["a", "b"]])
  })

  it("does not collide across a different second key (has_account / provider)", () => {
    expect(planLowercase([row("a", "A@x.co", "true"), row("b", "a@x.co", "false")]).collisions).toEqual([])
  })

  it("keeps rows that must not be converted but still checks them for collisions", () => {
    const plan = planLowercase([row("admin", "Admin@x.co", "emailpass", false), row("cus", "ADMIN@X.CO", "emailpass")])
    expect(plan.changes).toEqual([{ id: "cus", from: "ADMIN@X.CO", to: "admin@x.co" }])
    expect(planLowercase([row("admin", "a@x.co", "", false), row("cus", "A@x.co")]).collisions).toEqual([["admin", "cus"]])
  })

  it("is idempotent once everything is lowercase", () => {
    expect(planLowercase([row("a", "a@x.co"), row("b", "b@x.co")])).toEqual({ changes: [], collisions: [] })
  })
})
