// AF-2: `?to=` ของลิงก์ affiliate ต้องเป็น path ภายในร้านเท่านั้น (กัน open redirect) — ไม่ผ่าน → "/"
export function safeRedirectPath(to: unknown): string {
  if (typeof to !== "string" || !to.startsWith("/") || to.startsWith("//")) {
    return "/"
  }
  // backslash / control chars: browser บางตัวตีความ `/\host` หรือ `/\t/host` เป็น protocol-relative URL
  if (/[\\\u0000-\u001f\u007f]/.test(to)) {
    return "/"
  }
  return to
}
