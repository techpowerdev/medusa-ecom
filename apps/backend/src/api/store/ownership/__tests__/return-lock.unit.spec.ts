import { EventEmitter } from "node:events"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  lockStoreReturnOrder,
  STORE_RETURN_LOCK_TTL_SECONDS,
  STORE_RETURN_LOCK_WAIT_MS,
  storeReturnLockKey,
} from "../return-lock"
import { assignStoreReturnLocation } from "../return-location"
import { storeOwnershipMiddlewares } from "../middlewares"

// CORE-56 (spec 01 กฎข้อ 114, Q-C6 = ก): POST /store/returns ของ order เดียวกันทำทีละตัวด้วย Locking module
const heldError = (key: string) => new Error(`Failed to acquire lock for key "${key}"`)

const setup = (opts: { acquire?: jest.Mock; next?: () => void; validatedBody?: unknown } = {}) => {
  const acquire = opts.acquire ?? jest.fn(async () => undefined)
  const release = jest.fn(async () => true)
  const warn = jest.fn()
  const res = Object.assign(new EventEmitter(), { destroyed: false })
  const req = {
    validatedBody: "validatedBody" in opts ? opts.validatedBody : { order_id: "order_1" },
    scope: { resolve: (key: string) => (key === Modules.LOCKING ? { acquire, release } : { warn }) },
  } as unknown as MedusaRequest
  const next = jest.fn(opts.next ?? (() => undefined)) as unknown as MedusaNextFunction
  const run = () => lockStoreReturnOrder(req, res as unknown as MedusaResponse, next)
  const ownerOf = () => (acquire.mock.calls[0] as unknown as [string, { ownerId: string }])[1].ownerId
  return { acquire, release, warn, res, next, run, ownerOf }
}

describe("lockStoreReturnOrder", () => {
  afterEach(() => jest.useRealTimers())

  it("acquires store-return:<order_id> with a per-request ownerId and a TTL, then calls next()", async () => {
    const a = setup()
    const b = setup()
    await a.run()
    await b.run()
    expect(storeReturnLockKey("order_1")).toBe("store-return:order_1")
    expect(a.acquire).toHaveBeenCalledWith("store-return:order_1", {
      ownerId: expect.any(String),
      expire: STORE_RETURN_LOCK_TTL_SECONDS,
    })
    expect(STORE_RETURN_LOCK_TTL_SECONDS).toBeGreaterThanOrEqual(30)
    expect(a.ownerOf()).not.toEqual(b.ownerOf())
    expect(a.next).toHaveBeenCalledWith()
    expect(a.release).not.toHaveBeenCalled()
  })

  it("releases once with its ownerId when the response finishes (close afterwards does not release again)", async () => {
    const t = setup()
    await t.run()
    t.res.emit("finish")
    t.res.emit("close")
    expect(t.release).toHaveBeenCalledTimes(1)
    expect(t.release).toHaveBeenCalledWith("store-return:order_1", { ownerId: t.ownerOf() })
  })

  it("releases once when the response closes before finish (client disconnected)", async () => {
    const t = setup()
    await t.run()
    t.res.emit("close")
    t.res.emit("finish")
    expect(t.release).toHaveBeenCalledTimes(1)
    expect(t.release).toHaveBeenCalledWith("store-return:order_1", { ownerId: t.ownerOf() })
  })

  it("releases once and rethrows when the next handler throws", async () => {
    const boom = new Error("boom")
    const t = setup({
      next: () => {
        throw boom
      },
    })
    await expect(t.run()).rejects.toBe(boom)
    t.res.emit("finish")
    expect(t.release).toHaveBeenCalledTimes(1)
    expect(t.release).toHaveBeenCalledWith("store-return:order_1", { ownerId: t.ownerOf() })
  })

  it("logs (does not throw) when release fails — the TTL frees the lock", async () => {
    const t = setup()
    t.release.mockRejectedValueOnce(new Error("redis down"))
    await t.run()
    t.res.emit("finish")
    await new Promise((resolve) => setImmediate(resolve))
    expect(t.warn).toHaveBeenCalledTimes(1)
  })

  it("waits while another request of the same order holds the lock, then proceeds", async () => {
    jest.useFakeTimers()
    const acquire = jest
      .fn()
      .mockRejectedValueOnce(heldError("store-return:order_1"))
      .mockRejectedValueOnce(heldError("store-return:order_1"))
      .mockResolvedValue(undefined)
    const t = setup({ acquire })
    const done = t.run()
    await jest.advanceTimersByTimeAsync(1000)
    await done
    expect(acquire).toHaveBeenCalledTimes(3)
    expect(new Set(acquire.mock.calls.map((c) => (c[1] as { ownerId: string }).ownerId)).size).toBe(1)
    expect(t.next).toHaveBeenCalledWith()
  })

  it("answers 409 (no next, no release) when the lock is still held after the wait timeout (≤ 5s)", async () => {
    jest.useFakeTimers()
    const acquire = jest.fn().mockRejectedValue(heldError("store-return:order_1"))
    const t = setup({ acquire })
    const done = t.run()
    const settled = expect(done).rejects.toMatchObject({ type: MedusaError.Types.CONFLICT })
    await jest.advanceTimersByTimeAsync(STORE_RETURN_LOCK_WAIT_MS + 500)
    await settled
    expect(STORE_RETURN_LOCK_WAIT_MS).toBeLessThanOrEqual(5000)
    expect(t.next).not.toHaveBeenCalled()
    expect(t.release).not.toHaveBeenCalled()
  })

  it("does not turn a Redis/Locking error into 409 — rethrows it as is", async () => {
    const redis = new Error("connect ECONNREFUSED 127.0.0.1:6379")
    const t = setup({ acquire: jest.fn().mockRejectedValue(redis) })
    await expect(t.run()).rejects.toBe(redis)
    expect(t.acquire).toHaveBeenCalledTimes(1)
    expect(t.next).not.toHaveBeenCalled()
  })

  it("releases at once and stops when the client disconnected while waiting", async () => {
    const t = setup()
    t.acquire.mockImplementation(async () => {
      t.res.destroyed = true
    })
    await t.run()
    expect(t.next).not.toHaveBeenCalled()
    expect(t.release).toHaveBeenCalledTimes(1)
    expect(t.release).toHaveBeenCalledWith("store-return:order_1", { ownerId: t.ownerOf() })
  })

  it("fails loudly (no lock) when core did not validate the body first", async () => {
    const t = setup({ validatedBody: undefined })
    await expect(t.run()).rejects.toThrow(MedusaError)
    expect(t.acquire).not.toHaveBeenCalled()
    expect(t.next).not.toHaveBeenCalled()
  })
})

describe("POST /store/returns middleware order (CORE-56)", () => {
  it("ends with assignStoreReturnLocation → lockStoreReturnOrder", () => {
    const chain = storeOwnershipMiddlewares.find((m) => m.matcher === "/store/returns")!.middlewares!
    expect(chain.slice(-2)).toEqual([assignStoreReturnLocation, lockStoreReturnOrder])
  })
})
