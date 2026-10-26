// provider ของ Notification Module (ใช้ใน medusa-config.ts)
// - มี RESEND_API_KEY → channel "email" ส่งผ่าน Resend; "feed" (admin dashboard) ยังใช้ local ตาม default ของ Medusa
// - ไม่มี key (dev/test/CI) → local provider ของ Medusa รับทั้ง "feed" และ "email" (log แทนการส่งจริง)
type Env = Record<string, string | undefined>

const LOCAL_PROVIDER = "@medusajs/medusa/notification-local"

export const buildNotificationProviders = (env: Env) => {
  if (!env.RESEND_API_KEY) {
    return [
      {
        resolve: LOCAL_PROVIDER,
        id: "local",
        options: { name: "Local Notification Provider", channels: ["feed", "email"] },
      },
    ]
  }

  return [
    {
      resolve: LOCAL_PROVIDER,
      id: "local",
      options: { name: "Local Notification Provider", channels: ["feed"] },
    },
    {
      resolve: "./src/modules/resend",
      id: "resend",
      options: {
        channels: ["email"],
        api_key: env.RESEND_API_KEY,
        from: env.RESEND_FROM_EMAIL,
        // EV-4: ถอด code/PIN ของ e-voucher ตอน render อีเมล (notification.data เก็บ ciphertext)
        evoucher_encryption_key: env.EVOUCHER_ENCRYPTION_KEY,
      },
    },
  ]
}

// GB-4 (review #89): ลิงก์ชำระเงินในอีเมล group buy = STOREFRONT_URL + path — client อีเมลไม่มี base URL
// ยังไม่มี fail-fast ของ OPS-7 จึงเตือนตอนโหลด config ใน production
export const storefrontUrlWarning = (env: Env): string | null =>
  env.NODE_ENV === "production" && !/^https?:\/\//i.test(env.STOREFRONT_URL ?? "")
    ? "STOREFRONT_URL is not set to an http(s) URL — group buy payment links in emails will not work"
    : null
