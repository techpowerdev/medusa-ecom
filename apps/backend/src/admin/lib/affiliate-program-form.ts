import { z } from "zod"
import type { Program, ProgramBody, ProgramStatus } from "./affiliate"
import { fieldErrorMap } from "./form-validation"

// AF-12a (spec 05 กฎ 37a): ค่าฟอร์มโปรแกรม ↔ body ของ POST /admin/affiliate/programs(/:id)
// pure — import แค่ type เพื่อให้ unit test ตรวจกับ validator ของ AF-5 ได้
// ADM-9 (spec 08 กฎ 5, 8): schema ตรวจรูปค่า (วันเวลาเป็น Date จาก DatePicker ตาม timezone ของเครื่องแอดมิน),
// กฎธุรกิจอยู่ใน toProgramBody แล้ว map error เข้า form.setError
export const programFormSchema = z.object({
  name: z.string(),
  starts_at: z.date().nullable(),
  ends_at: z.date().nullable(),
  commission_value: z.string(),
  attribution_window_days: z.string(),
  hold_days: z.string(),
  cap_per_order: z.string(),
  announce_text: z.string(),
  status: z.enum(["draft", "published", "ended"]),
  all: z.boolean(),
  collection_ids: z.array(z.string()),
  category_ids: z.array(z.string()),
  // Q16: แก้ใน UI ไม่ได้ — เก็บค่าเดิมไว้ส่งกลับทั้งก้อน (update แทนที่ JSON scope ทั้งก้อน)
  variant_ids: z.array(z.string()),
})
export type ProgramForm = z.input<typeof programFormSchema>
export type ProgramFormField = keyof ProgramForm

// z.date() กับ Invalid Date ให้ "Invalid input" — แทนด้วยข้อความของช่อง (ADM-3 fieldErrorMap)
export const PROGRAM_PARSE_OPTIONS = {
  error: fieldErrorMap({ starts_at: "Start is invalid", ends_at: "End is invalid" }),
}

export const emptyProgramForm = (): ProgramForm => ({
  name: "",
  starts_at: null,
  ends_at: null,
  commission_value: "",
  attribution_window_days: "7",
  hold_days: "14",
  cap_per_order: "",
  announce_text: "",
  status: "draft",
  all: true,
  collection_ids: [],
  category_ids: [],
  variant_ids: [],
})

export const programToForm = (p: Program): ProgramForm => ({
  name: p.name,
  starts_at: new Date(p.starts_at),
  ends_at: new Date(p.ends_at),
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

const date = (value: Date | null, label: string, field: ProgramFormField) => {
  if (!value) {
    throw new FormError(`${label} is required`, field)
  }
  if (Number.isNaN(value.getTime())) {
    throw new FormError(`${label} is invalid`, field)
  }
  return value
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
  if (ends_at.getTime() <= starts_at.getTime()) {
    throw new FormError("End must be after start", "ends_at")
  }
  if (!form.all && !form.collection_ids.length && !form.category_ids.length && !form.variant_ids.length) {
    throw new FormError("Select at least one collection or category", "collection_ids")
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

/**
 * ADM-9 (nit #163/#176): DatePicker ละเอียดระดับนาที — วันเวลาที่แอดมินไม่ได้แก้ต้องไม่ถูกส่ง (วินาทีเดิมไม่ถูกปัดทุก Save)
 * form ถือ Date จาก `programToForm` ไว้ตรงๆ จึงเทียบ timestamp กับค่าที่เก็บได้เลย
 */
export const omitUnchangedDates = (
  body: ProgramBody,
  stored: Pick<Program, "starts_at" | "ends_at">,
): Partial<ProgramBody> => {
  const { starts_at, ends_at, ...rest } = body
  return {
    ...rest,
    ...(starts_at.getTime() === Date.parse(stored.starts_at) ? {} : { starts_at }),
    ...(ends_at.getTime() === Date.parse(stored.ends_at) ? {} : { ends_at }),
  }
}

// กฎ 20: draft < published < ended เปลี่ยนได้เฉพาะไปข้างหน้าหรือคงเดิม; ตอนสร้างได้แค่ draft/published
const ORDER: ProgramStatus[] = ["draft", "published", "ended"]
export const allowedProgramStatuses = (current?: ProgramStatus): ProgramStatus[] =>
  current ? ORDER.slice(ORDER.indexOf(current)) : ["draft", "published"]

// กฎ 20: ลบ (soft-delete) ได้เฉพาะ draft
export const canDeleteProgram = (p: Pick<Program, "status">) => p.status === "draft"
