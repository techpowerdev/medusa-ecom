import fs from "node:fs"
import path from "node:path"
import { FetchError } from "@medusajs/js-sdk"
import { describe, expect, it, vi } from "vitest"

import { errorMessage, friendlyErrorMessage } from "./error-message"

const THAI = /[฀-๿]/
const isThaiOnly = (text: string) => THAI.test(text) && !/[A-Za-z]{2,}/.test(text)

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

// qa CORE-4c2 D-1/D-3: error ดิบภาษาอังกฤษจาก Medusa (เช่น "Unauthorized", "Variants … do not exist") ไม่ส่งถึงผู้ใช้ตรงๆ
describe("friendlyErrorMessage (qa D-1, D-3)", () => {
  it.each([401, 403])("FetchError %i → ให้เข้าสู่ระบบใหม่ (ไทย)", (status) => {
    const message = friendlyErrorMessage(new FetchError("Unauthorized", "Unauthorized", status))
    expect(isThaiOnly(message)).toBe(true)
    expect(message).toMatch(/เข้าสู่ระบบ/)
  })

  it.each([
    new FetchError("Variants variant_bogus do not exist", "Bad Request", 400),
    new FetchError("Internal error", "Internal Server Error", 500),
    new Error("x"),
    "x",
  ])("%s → ข้อความทั่วไปภาษาไทย ไม่ส่งข้อความดิบ", (error) => {
    const message = friendlyErrorMessage(error)
    expect(isThaiOnly(message)).toBe(true)
    expect(message).not.toMatch(/login|เข้าสู่ระบบ/)
  })

  it("ใช้ข้อความ fallback ของผู้เรียก (ไม่ใช่ 401/403)", () => {
    expect(friendlyErrorMessage(new Error("x"), "เพิ่มไม่สำเร็จ")).toBe("เพิ่มไม่สำเร็จ")
  })

  it("401 ไม่ถูกแทนด้วย fallback ของผู้เรียก", () => {
    const message = friendlyErrorMessage(new FetchError("Unauthorized", "Unauthorized", 401), "เพิ่มไม่สำเร็จ")
    expect(message).not.toBe("เพิ่มไม่สำเร็จ")
  })
})

const createAddress = vi.fn()
const updateAddress = vi.fn()

vi.mock("@lib/config", () => ({
  sdk: {
    auth: { verification: { confirm: vi.fn().mockRejectedValue(new Error("x")) } },
    store: {
      customer: {
        createAddress: (...args: unknown[]) => createAddress(...args),
        updateAddress: (...args: unknown[]) => updateAddress(...args),
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

  it("confirmEmailVerification → error = x", async () => {
    const { confirmEmailVerification } = await import("@lib/data/customer")
    expect((await confirmEmailVerification("t")).error).toBe("x")
  })

  // qa D-3: address-error เคยแสดง "Unauthorized" ดิบ
  it.each([
    ["addCustomerAddress", createAddress, (m: typeof import("@lib/data/customer")) => m.addCustomerAddress({}, form)],
    ["updateCustomerAddress", updateAddress, (m: typeof import("@lib/data/customer")) => m.updateCustomerAddress({}, form)],
  ] as const)("%s → error ภาษาไทย (401 ให้เข้าสู่ระบบใหม่, อื่นๆ ข้อความทั่วไป)", async (_name, mock, call) => {
    const customer = await import("@lib/data/customer")
    mock.mockRejectedValueOnce(new FetchError("Unauthorized", "Unauthorized", 401))
    const unauthorized = (await call(customer)).error ?? ""
    mock.mockRejectedValueOnce(new Error("x"))
    const other = (await call(customer)).error ?? ""
    expect([unauthorized, other].every(isThaiOnly)).toBe(true)
    expect(unauthorized).toMatch(/เข้าสู่ระบบ/)
    expect(other).not.toBe(unauthorized)
  })
})

// grep: ไม่มี String(error) / error.toString() ในข้อความที่ส่งให้ผู้ใช้ (ใช้ errorMessage หรือ `instanceof Error ? .message :`)
const SRC = path.resolve(__dirname, "../..")
const HELPER = path.resolve(__dirname, "error-message.ts")
const STRINGIFY_ERROR = /String\((e|err|error)\)|\b(e|err|error)\.toString\(\)/

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
      .filter((file) => file !== HELPER)
      .flatMap(offendingLines)
    expect(offenders).toEqual([])
  })
})
