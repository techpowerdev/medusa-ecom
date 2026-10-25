// CORE-6: store route ของ cart/checkout ต้องมี customer ที่ล็อกอิน (spec 01 "ไม่มี guest")
// สมัคร + สร้าง customer + ล็อกอินผ่าน auth route ของ Medusa แล้วคืน bearer token ที่ผูก customer แล้ว
type Api = {
  post: (url: string, body?: unknown, config?: { headers: Record<string, string> }) => Promise<{ data: any }>
}

export async function registerCustomer(
  api: Api,
  publishableKey: string,
  email: string,
  password: string
): Promise<{ token: string; customerId: string }> {
  const { data: reg } = await api.post("/auth/customer/emailpass/register", { email, password })
  const { data: created } = await api.post(
    "/store/customers",
    { email },
    { headers: { authorization: `Bearer ${reg.token}`, "x-publishable-api-key": publishableKey } }
  )
  const { data: login } = await api.post("/auth/customer/emailpass", { email, password })
  return { token: login.token, customerId: created.customer.id }
}

export const storeHeadersFor = (publishableKey: string, token?: string) => ({
  headers: {
    "x-publishable-api-key": publishableKey,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
})
