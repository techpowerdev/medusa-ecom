import fs from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"

import { errorMessage } from "./error-message"

// spec 01 กฎข้อ 45 / AC-81: ข้อความ error ที่ผู้ใช้เห็นไม่มีคำนำหน้า "Error:" (มาจาก String(error) / error.toString())
describe("errorMessage (AC-81)", () => {
  it.each([
    [new Error("x"), "x"],
    [new TypeError("y"), "y"],
    ["z", "z"],
  ])("%s → %s", (input, expected) => {
    expect(errorMessage(input)).toBe(expected)
  })
})

vi.mock("@lib/config", () => ({
  sdk: {
    auth: { verification: { confirm: vi.fn().mockRejectedValue(new Error("x")) } },
    store: {
      customer: {
        createAddress: vi.fn().mockRejectedValue(new Error("x")),
        updateAddress: vi.fn().mockRejectedValue(new Error("x")),
      },
    },
  },
}))
vi.mock("@lib/data/cookies", () => ({ getAuthHeaders: vi.fn().mockResolvedValue({}) }))
vi.mock("@lib/data/cart", () => ({}))
vi.mock("@lib/util/server-cart", () => ({}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

describe("action ของ lib/data/customer.ts ห่อ error โดยไม่มี Error: (AC-81)", () => {
  const form = new FormData()
  form.set("addressId", "addr_1")

  it.each([
    ["confirmEmailVerification", async (m: typeof import("@lib/data/customer")) => m.confirmEmailVerification("t")],
    ["addCustomerAddress", async (m: typeof import("@lib/data/customer")) => m.addCustomerAddress({}, form)],
    ["updateCustomerAddress", async (m: typeof import("@lib/data/customer")) => m.updateCustomerAddress({}, form)],
  ])("%s → error = x", async (_name, call) => {
    const result = await call(await import("@lib/data/customer"))
    expect(result.error).toBe("x")
  })
})

// grep: ไม่มี String(error) / error.toString() ในข้อความที่ส่งให้ผู้ใช้ (ใช้ errorMessage หรือ `instanceof Error ? .message :`)
const SRC = path.resolve(__dirname, "../..")
const HELPER = path.resolve(__dirname, "error-message.ts")
const STRINGIFY_ERROR = /String\((e|err|error)\)|\b(e|err|error)\.toString\(\)/
// CORE-22 แก้ไฟล์นี้อยู่ (คำสั่งของ session หลัก: 4c2 ห้ามแตะ) — แก้ใน CORE-22 หรือ PR ที่ merge ทีหลัง แล้วลบออกจากรายการ
const PENDING = ["modules/account/components/profile-phone/index.tsx"]

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : []
  })

const offendingLines = (file: string) =>
  fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((line, i) => ({ line, at: `${path.relative(SRC, file)}:${i + 1}` }))
    .filter(({ line }) => STRINGIFY_ERROR.test(line) && !/instanceof Error \?/.test(line))
    .map(({ at, line }) => `${at} ${line.trim()}`)

describe("ไม่มี String(error) ในข้อความ error (AC-81 grep)", () => {
  it("ไฟล์ใน src ใช้ errorMessage หรือ .message", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => file !== HELPER && !PENDING.includes(path.relative(SRC, file)))
      .flatMap(offendingLines)
    expect(offenders).toEqual([])
  })

  it.each(PENDING)("%s ยังค้างอยู่จริง (แก้แล้วให้ลบออกจาก PENDING)", (file) => {
    expect(offendingLines(path.join(SRC, file))).not.toEqual([])
  })
})
