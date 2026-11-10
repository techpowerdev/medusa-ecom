import { isEqual } from "lodash"

const FIELDS = [
  "first_name",
  "last_name",
  "address_1",
  "company",
  "postal_code",
  "city",
  "country_code",
  "province",
  "phone",
] as const

// CORE-4g (spec 01 กฎข้อ 63c): ที่อยู่ที่บันทึกไว้เก็บ field ว่างเป็น null แต่ cart อาจเป็น "" — ถือว่าเท่ากัน
const normalize = (address: object) =>
  Object.fromEntries(
    FIELDS.map((field) => [
      field,
      (address as Record<string, unknown>)[field] ?? "",
    ])
  )

export default function compareAddresses(address1: object, address2: object) {
  return isEqual(normalize(address1), normalize(address2))
}
