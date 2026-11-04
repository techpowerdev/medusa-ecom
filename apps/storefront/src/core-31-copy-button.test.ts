// @vitest-environment jsdom
import fs from "node:fs"
import path from "node:path"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// CORE-31 (spec 01 กฎข้อ 88, AC-124): ปุ่มคัดลอกของ storefront ใช้ component กลาง `modules/common/components/copy-button`
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ROOT = path.resolve(__dirname, "..")
const COPY_BUTTON = "src/modules/common/components/copy-button/index.tsx"

let container: HTMLDivElement
let root: Root
let writeText: ReturnType<typeof vi.fn>

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!

const deferred = () => {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const render = async (element: ReturnType<typeof createElement>) => {
  await act(async () => {
    root.render(element)
  })
}

const copyButton = async (props: Record<string, unknown> = {}) => {
  const { default: CopyButton } = await import("@modules/common/components/copy-button")
  await render(
    createElement(CopyButton, {
      text: "ABC-123",
      label: "คัดลอก",
      successMessage: "คัดลอกแล้ว",
      buttonTestId: "copy-btn",
      statusTestId: "copy-status",
      ...props,
    })
  )
}

const listFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? listFiles(full) : [full]
  })

describe("CORE-31: component คัดลอกกลาง (กฎข้อ 88, AC-124)", () => {
  beforeEach(() => {
    writeText = vi.fn()
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it("grep: navigator.clipboard.writeText อยู่ไฟล์เดียวใต้ src/modules (common/components/copy-button)", () => {
    const files = listFiles(path.join(ROOT, "src/modules")).filter((file) =>
      fs.readFileSync(file, "utf8").includes("navigator.clipboard.writeText")
    )
    expect(files.map((file) => path.relative(ROOT, file))).toEqual([COPY_BUTTON])
  })

  it("คลิกสองครั้งใน act() เดียว → writeText ถูกเรียก 1 ครั้ง", async () => {
    const pending = deferred()
    writeText.mockReturnValue(pending.promise)
    await copyButton()

    await act(async () => {
      byTestId("copy-btn").click()
      byTestId("copy-btn").click()
    })
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith("ABC-123")

    await act(async () => pending.resolve())
  })

  it("resolve → สถานะตาม prop successMessage และกดได้อีกครั้ง", async () => {
    writeText.mockResolvedValue(undefined)
    await copyButton()

    await act(async () => byTestId("copy-btn").click())
    expect(byTestId("copy-status").textContent).toBe("คัดลอกแล้ว")

    await act(async () => byTestId("copy-btn").click())
    expect(writeText).toHaveBeenCalledTimes(2)
  })

  it("reject → สถานะ 'คัดลอกไม่สำเร็จ' พร้อมข้อความให้คัดลอกเอง", async () => {
    writeText.mockRejectedValue(new Error("denied"))
    await copyButton()

    await act(async () => byTestId("copy-btn").click())
    const status = byTestId("copy-status").textContent ?? ""
    expect(status).toContain("คัดลอกไม่สำเร็จ")
    expect(status).toContain("ABC-123")
  })

  // CORE-37 (spec 01 กฎข้อ 95, AC-131)
  it("reject → ค่าอยู่ใน element <statusTestId>-value แยกจากข้อความนำภาษาไทย", async () => {
    const text = "VC-LONG-0123456789"
    writeText.mockRejectedValue(new Error("denied"))
    await copyButton({ text })

    await act(async () => byTestId("copy-btn").click())
    const status = byTestId("copy-status")
    const value = byTestId("copy-status-value")
    expect(value.textContent).toBe(text)
    expect(status.contains(value)).toBe(true)
    const lead = (status.textContent ?? "").replace(value.textContent ?? "", "")
    expect(lead).toMatch(/[\u0E00-\u0E7F]/)
    expect(value.textContent).not.toMatch(/[\u0E00-\u0E7F]/)
    expect(value.className).not.toContain("break-all")
    expect(status.className).not.toContain("break-all")
  })

  it("share reject NotAllowedError → ลองคัดลอกด้วย writeText 1 ครั้ง resolve → สถานะสำเร็จ", async () => {
    writeText.mockResolvedValue(undefined)
    const share = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"))
    await copyButton({ share })

    await act(async () => byTestId("copy-btn").click())
    expect(share).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith("ABC-123")
    expect(byTestId("copy-status").textContent).toBe("คัดลอกแล้ว")
  })

  it("share reject NotAllowedError + writeText reject → ข้อความล้มพร้อม element ค่า", async () => {
    writeText.mockRejectedValue(new Error("denied"))
    const share = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"))
    await copyButton({ share })

    await act(async () => byTestId("copy-btn").click())
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(byTestId("copy-status-value").textContent).toBe("ABC-123")
  })

  it("share reject AbortError → ไม่คัดลอก และสถานะว่าง", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError"))
    await copyButton({ share })

    await act(async () => byTestId("copy-btn").click())
    expect(writeText).toHaveBeenCalledTimes(0)
    expect(byTestId("copy-status").textContent).toBe("")
    expect(document.querySelector('[data-testid="copy-status-value"]')).toBeNull()
  })

  it("ShareLinkButton (ไม่มี navigator.share) คัดลอก URL แบบ absolute", async () => {
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true })
    const { default: ShareLinkButton } = await import("@modules/common/components/share-link-button")
    await render(
      createElement(ShareLinkButton, {
        url: "/th/g/tok_1",
        label: "คัดลอกลิงก์",
        shareTitle: "เสื้อ",
        buttonTestId: "group-share-copy",
        statusTestId: "group-share-copy-status",
      })
    )

    await act(async () => byTestId("group-share-copy").click())
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/th/g/tok_1`)
    expect(writeText.mock.calls[0][0]).toMatch(/^https?:\/\//)
    expect(byTestId("group-share-copy-status").textContent).toBe("คัดลอกลิงก์แล้ว")
  })

  it("ShareLinkButton (มี navigator.share + shareTitle) แชร์แทนการคัดลอก", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "share", { value: share, configurable: true })
    const { default: ShareLinkButton } = await import("@modules/common/components/share-link-button")
    await render(
      createElement(ShareLinkButton, {
        url: "/th/r/abc",
        label: "แชร์",
        shareTitle: "เสื้อ",
        buttonTestId: "affiliate-share-button",
        statusTestId: "affiliate-share-status",
      })
    )

    await act(async () => byTestId("affiliate-share-button").click())
    expect(share).toHaveBeenCalledWith({ url: `${window.location.origin}/th/r/abc`, title: "เสื้อ" })
    expect(writeText).not.toHaveBeenCalled()
    expect(byTestId("affiliate-share-status").textContent).toBe("")
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true })
  })

  it("VoucherCopyButton คง data-testid='voucher-copy-button' และคัดลอก code", async () => {
    writeText.mockResolvedValue(undefined)
    const { default: VoucherCopyButton } = await import(
      "@modules/evoucher/components/voucher-copy-button"
    )
    await render(createElement(VoucherCopyButton, { code: "VC-999" }))

    expect(byTestId("voucher-copy-button").textContent).toBe("คัดลอกรหัส")
    await act(async () => byTestId("voucher-copy-button").click())
    expect(writeText).toHaveBeenCalledWith("VC-999")
    expect(byTestId("voucher-copy-status").textContent).toBe("คัดลอกแล้ว")
    expect(byTestId("voucher-copy-button").textContent).toMatch(/[\u0E00-\u0E7F]/)
  })
})
