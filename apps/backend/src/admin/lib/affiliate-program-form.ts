import type { Program, ProgramBody, ProgramStatus } from "./affiliate"

// AF-12a (spec 05 กฎ 37a): ค่าฟอร์มโปรแกรม (string ตาม input) ↔ body ของ POST /admin/affiliate/programs(/:id)
// pure — import แค่ type เพื่อให้ unit test ตรวจกับ validator ของ AF-5 ได้
export const emptyProgramForm = () => ({
  name: "",
  starts_at: "", // <input type="datetime-local"> ตีความเป็นเวลาไทย (ICT)
  ends_at: "",
  commission_value: "",
  attribution_window_days: "7",
  hold_days: "14",
  cap_per_order: "",
  announce_text: "",
  status: "draft" as ProgramStatus,
  all: true,
  collection_ids: [] as string[],
  category_ids: [] as string[],
  // Q16: แก้ใน UI ไม่ได้ — เก็บค่าเดิมไว้ส่งกลับทั้งก้อน (update แทนที่ JSON scope ทั้งก้อน)
  variant_ids: [] as string[],
})
export type ProgramForm = ReturnType<typeof emptyProgramForm>
export type ProgramFormField = keyof ProgramForm

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000

export const isoToIct = (iso: string) => new Date(Date.parse(iso) + ICT_OFFSET_MS).toISOString().slice(0, 16)

const ictToIso = (value: string) => {
  const date = new Date(`${value.length === 16 ? `${value}:00` : value}+07:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export const programToForm = (p: Program): ProgramForm => ({
  name: p.name,
  starts_at: isoToIct(p.starts_at),
  ends_at: isoToIct(p.ends_at),
  commission_value: String(p.commission_value),
  attribution_window_days: String(p.attribution_window_days),
  hold_days: String(p.hold_days),
  cap_per_order: p.cap_per_order == null ? "" : String(p.cap_per_order),
  announce_text: p.announce_text ?? "",
  status: p.status,
  all: !!p.scope?.all,
  collection_ids: p.scope?.collection_ids ?? [],
  category_ids: p.scope?.category_ids ?? [],
  variant_ids: p.scope?.variant_ids ?? [],
})

class FormError extends Error {
  constructor(
    message: string,
    readonly field: ProgramFormField,
  ) {
    super(message)
  }
}

const date = (value: string, label: string, field: ProgramFormField) => {
  const iso = value ? ictToIso(value) : null
  if (!iso) {
    throw new FormError(value ? `${label} is invalid` : `${label} is required`, field)
  }
  return iso
}

const number = (
  form: ProgramForm,
  field: "commission_value" | "attribution_window_days" | "hold_days" | "cap_per_order",
  message: string,
  ok: (n: number) => boolean,
) => {
  const n = Number(form[field])
  if (!form[field].trim() || !Number.isFinite(n) || !ok(n)) {
    throw new FormError(message, field)
  }
  return n
}

// variant_ids เดิมส่งกลับเสมอ รวมกรณี all (all คลุมทุกสินค้าอยู่แล้ว และกลับมาใช้ได้เมื่อปิด all)
const toScope = (form: ProgramForm) => {
  const variants = form.variant_ids.length ? { variant_ids: form.variant_ids } : {}
  return form.all
    ? { all: true, ...variants }
    : {
        all: false,
        collection_ids: form.collection_ids,
        category_ids: form.category_ids,
        ...variants,
      }
}

const buildBody = (form: ProgramForm): ProgramBody => {
  const name = form.name.trim()
  if (!name) {
    throw new FormError("Name is required", "name")
  }
  const starts_at = date(form.starts_at, "Start", "starts_at")
  const ends_at = date(form.ends_at, "End", "ends_at")
  if (Date.parse(ends_at) <= Date.parse(starts_at)) {
    throw new FormError("End must be after start", "ends_at")
  }
  return {
    name,
    starts_at,
    ends_at,
    commission_value: number(
      form,
      "commission_value",
      "Commission must be above 0 and at most 100",
      (n) => n > 0 && n <= 100,
    ),
    attribution_window_days: number(
      form,
      "attribution_window_days",
      "Attribution window must be a whole number of at least 1",
      (n) => Number.isInteger(n) && n >= 1,
    ),
    hold_days: number(
      form,
      "hold_days",
      "Hold days must be a whole number of at least 0",
      (n) => Number.isInteger(n) && n >= 0,
    ),
    cap_per_order: form.cap_per_order.trim()
      ? number(form, "cap_per_order", "Cap per order must be above 0", (n) => n > 0)
      : null,
    announce_text: form.announce_text.trim() || null,
    status: form.status,
    scope: toScope(form),
  }
}

export const toProgramBody = (
  form: ProgramForm,
): { body: ProgramBody } | { error: string; field: ProgramFormField } => {
  try {
    return { body: buildBody(form) }
  } catch (e) {
    if (e instanceof FormError) {
      return { error: e.message, field: e.field }
    }
    throw e
  }
}

// กฎ 20: draft < published < ended เปลี่ยนได้เฉพาะไปข้างหน้าหรือคงเดิม; ตอนสร้างได้แค่ draft/published
const ORDER: ProgramStatus[] = ["draft", "published", "ended"]
export const allowedProgramStatuses = (current?: ProgramStatus): ProgramStatus[] =>
  current ? ORDER.slice(ORDER.indexOf(current)) : ["draft", "published"]

// กฎ 20: ลบ (soft-delete) ได้เฉพาะ draft
export const canDeleteProgram = (p: Pick<Program, "status">) => p.status === "draft"
