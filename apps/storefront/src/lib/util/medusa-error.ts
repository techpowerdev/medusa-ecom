type MedusaError = {
  response?: {
    data: { message?: string } | string
    status: number
    headers: unknown
  }
  request?: unknown
  message?: string
  config?: { url: string; baseURL: string }
  status?: unknown
}

// CORE-4g (spec 01 กฎข้อ 63a): คง HTTP status ของ error เดิม (`FetchError.status` ของ js-sdk) ไว้ที่ error ที่ throw
// เพื่อให้ `friendlyErrorMessage` แยก 401/403 (ให้เข้าสู่ระบบใหม่) ออกจากข้อความ fallback ได้
const withStatus = (error: Error, status: unknown) =>
  typeof status === "number" ? Object.assign(error, { status }) : error

export default function medusaError(error: unknown): never {
  const err = error as MedusaError
  if (err.response) {
    const u = new URL(err.config?.url ?? "", err.config?.baseURL ?? "")
    console.error("Resource:", u.toString())
    console.error("Response data:", err.response.data)
    console.error("Status code:", err.response.status)
    console.error("Headers:", err.response.headers)

    const data = err.response.data
    const message =
      typeof data === "object" && data !== null
        ? data.message || String(data)
        : data

    throw withStatus(
      new Error(message.charAt(0).toUpperCase() + message.slice(1) + "."),
      err.response.status
    )
  } else if (err.request) {
    throw new Error("No response received: " + String(err.request))
  } else {
    throw withStatus(
      new Error("Error setting up the request: " + err.message),
      err.status
    )
  }
}
