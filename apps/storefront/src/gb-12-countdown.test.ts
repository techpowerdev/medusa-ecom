// @vitest-environment jsdom
import fs from "node:fs"
import path from "node:path"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import Countdown from "@modules/common/components/countdown"

// GB-12 (spec 04 กฎข้อ 32a, AC-51): นับถอยหลังของการ์ดหน้าแรกและหน้ากลุ่มเป็น component เดียว
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const MODULES = path.resolve(__dirname, "modules")
const read = (p: string) => fs.readFileSync(path.join(MODULES, p), "utf8")

describe("GB-12: countdown กลาง (AC-51 grep)", () => {
  it("ไม่มีไฟล์ countdown เดิมสองไฟล์", () => {
    expect(
      fs.existsSync(
        path.join(MODULES, "home/components/campaigns/campaign-countdown.tsx")
      )
    ).toBe(false)
    expect(
      fs.existsSync(
        path.join(MODULES, "group-buy/components/group-page/countdown.tsx")
      )
    ).toBe(false)
  })

  it("การ์ดหน้าแรกและหน้ากลุ่ม import @modules/common/components/countdown", () => {
    for (const file of [
      "home/components/campaigns/group-campaign-card.tsx",
      "home/components/campaigns/flash-campaign-card.tsx",
      "group-buy/components/group-page/index.tsx",
    ]) {
      expect(read(file), file).toContain(
        'from "@modules/common/components/countdown"'
      )
    }
  })
})

describe("GB-12: <Countdown> (AC-51 unit, fake timers)", () => {
  const START = Date.parse("2026-11-04T10:00:00Z")
  let container: HTMLDivElement
  let root: Root

  const render = async (props: Record<string, unknown>) => {
    await act(async () => root.render(createElement(Countdown, props as never)))
  }
  const text = () =>
    container.querySelector('[data-testid="c"]')?.textContent ?? null

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  const props = (endsAt: string | null) => ({
    endsAt,
    now: START,
    testId: "c",
    expiredLabel: "หมดเวลาแล้ว",
  })

  it("endsAt อีก 3 วินาที → ตัวเลขลดลงหลังเลื่อนเวลา 1 วินาที", async () => {
    await render(props(new Date(START + 3_000).toISOString()))
    expect(text()).toContain("00:00:03")
    await act(async () => vi.advanceTimersByTime(1_000))
    expect(text()).toContain("00:00:02")
  })

  it("เลย endsAt → แสดง expiredLabel และ interval ถูก clear", async () => {
    await render(props(new Date(START + 3_000).toISOString()))
    await act(async () => vi.advanceTimersByTime(4_000))
    expect(text()).toBe("หมดเวลาแล้ว")
    expect(vi.getTimerCount()).toBe(0)
  })

  it("expiredLabel ของแต่ละที่ใช้ตามที่ส่ง + testId/className อยู่ที่ element", async () => {
    await render({
      ...props(new Date(START - 1_000).toISOString()),
      expiredLabel: "หมดเวลารวมกลุ่มแล้ว",
      className: "x-cls",
    })
    const el = container.querySelector('[data-testid="c"]')!
    expect(el.textContent).toBe("หมดเวลารวมกลุ่มแล้ว")
    expect(el.className).toContain("x-cls")
  })

  it("endsAt = null → ไม่ render และไม่ตั้ง interval", async () => {
    await render(props(null))
    expect(container.innerHTML).toBe("")
    expect(vi.getTimerCount()).toBe(0)
  })
})
