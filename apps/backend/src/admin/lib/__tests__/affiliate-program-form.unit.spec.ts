import {
  AdminCreateAffiliateProgram,
  AdminUpdateAffiliateProgram,
} from "../../../api/admin/affiliate/validators"
import {
  allowedProgramStatuses,
  canDeleteProgram,
  emptyProgramForm,
  isoToIct,
  programToForm,
  toProgramBody,
  type ProgramForm,
} from "../affiliate-program-form"
import type { Program } from "../affiliate"

// AF-12a (spec 05 กฎ 37a, AC-42): ฟอร์มโปรแกรมใน admin → body ของ POST /admin/affiliate/programs(/:id)
const form = (patch: Partial<ProgramForm> = {}): ProgramForm => ({
  ...emptyProgramForm(),
  name: "Launch",
  starts_at: "2026-11-01T00:00",
  ends_at: "2026-12-01T00:00",
  commission_value: "10",
  ...patch,
})

const bodyOf = (f: ProgramForm) => {
  const result = toProgramBody(f)
  if ("error" in result) {
    throw new Error(result.error)
  }
  return result.body
}

const program: Program = {
  id: "affprog_1",
  name: "Old",
  status: "published",
  starts_at: "2026-10-31T17:00:00.000Z",
  ends_at: "2026-11-30T17:00:00.000Z",
  announce_text: null,
  commission_value: 5,
  attribution_window_days: 3,
  hold_days: 10,
  cap_per_order: 200,
  scope: { variant_ids: ["variant_a"], collection_ids: ["pcol_1"] },
}

describe("toProgramBody", () => {
  it("builds a body that the admin create validator accepts, with defaults 7/14 and empty optionals as null", () => {
    const body = bodyOf(form())
    expect(AdminCreateAffiliateProgram.safeParse(body).success).toBe(true)
    expect(body).toMatchObject({
      name: "Launch",
      starts_at: "2026-10-31T17:00:00.000Z", // ICT 00:00 = 17:00Z ของวันก่อน
      ends_at: "2026-11-30T17:00:00.000Z",
      commission_value: 10,
      attribution_window_days: 7,
      hold_days: 14,
      cap_per_order: null,
      announce_text: null,
      status: "draft",
      scope: { all: true },
    })
  })

  it("rejects ends_at not after starts_at before sending", () => {
    for (const ends_at of ["2026-11-01T00:00", "2026-10-01T00:00"]) {
      expect(toProgramBody(form({ ends_at }))).toEqual({
        error: "End must be after start",
        field: "ends_at",
      })
    }
  })

  it("rejects missing name, dates and out-of-range numbers", () => {
    expect(toProgramBody(form({ name: " " }))).toMatchObject({ error: "Name is required" })
    expect(toProgramBody(form({ starts_at: "" }))).toMatchObject({ error: "Start is required" })
    for (const commission_value of ["", "0", "101", "abc"]) {
      expect(toProgramBody(form({ commission_value }))).toMatchObject({
        field: "commission_value",
      })
    }
    expect(toProgramBody(form({ attribution_window_days: "0" }))).toMatchObject({
      field: "attribution_window_days",
    })
    expect(toProgramBody(form({ hold_days: "1.5" }))).toMatchObject({ field: "hold_days" })
    expect(toProgramBody(form({ cap_per_order: "-1" }))).toMatchObject({ field: "cap_per_order" })
  })

  it("sends selected collections and categories when not all products", () => {
    const body = bodyOf(form({ all: false, collection_ids: ["pcol_1"], category_ids: ["pcat_1"] }))
    expect(body.scope).toEqual({ all: false, collection_ids: ["pcol_1"], category_ids: ["pcat_1"] })
    expect(AdminCreateAffiliateProgram.safeParse(body).success).toBe(true)
  })

  it("keeps existing variant_ids on edit, including when switching to all products (Q16)", () => {
    const edited = programToForm(program)
    expect(edited.variant_ids).toEqual(["variant_a"])

    const same = bodyOf({ ...edited, commission_value: "12" })
    expect(same.scope).toEqual({
      all: false,
      collection_ids: ["pcol_1"],
      category_ids: [],
      variant_ids: ["variant_a"],
    })
    expect(AdminUpdateAffiliateProgram.safeParse(same).success).toBe(true)

    const all = bodyOf({ ...edited, all: true })
    expect(all.scope).toEqual({ all: true, variant_ids: ["variant_a"] })
  })
})

describe("programToForm / isoToIct", () => {
  it("shows stored values in Thai time", () => {
    expect(isoToIct("2026-10-31T17:00:00.000Z")).toBe("2026-11-01T00:00")
    expect(programToForm(program)).toMatchObject({
      name: "Old",
      starts_at: "2026-11-01T00:00",
      ends_at: "2026-12-01T00:00",
      commission_value: "5",
      attribution_window_days: "3",
      hold_days: "10",
      cap_per_order: "200",
      announce_text: "",
      status: "published",
      all: false,
      collection_ids: ["pcol_1"],
      category_ids: [],
    })
  })
})

describe("allowedProgramStatuses (กฎ 20)", () => {
  it("offers only forward transitions from the current status", () => {
    expect(allowedProgramStatuses()).toEqual(["draft", "published"])
    expect(allowedProgramStatuses("draft")).toEqual(["draft", "published", "ended"])
    expect(allowedProgramStatuses("published")).toEqual(["published", "ended"])
    expect(allowedProgramStatuses("ended")).toEqual(["ended"])
  })
})

describe("canDeleteProgram", () => {
  it("is true only for draft programs", () => {
    expect(canDeleteProgram({ status: "draft" })).toBe(true)
    expect(canDeleteProgram({ status: "published" })).toBe(false)
    expect(canDeleteProgram({ status: "ended" })).toBe(false)
  })
})
