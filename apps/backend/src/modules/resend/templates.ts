// Email template แบบ HTML string (ไม่ใช้ react-email เพื่อไม่เพิ่ม dependency — spec/ADR ไม่ได้ระบุ)
// ข้อมูลที่ได้รับมาจาก workflow ใน src/workflows/ (query.graph ของ order / fulfillment)

export const EmailTemplates = {
  ORDER_PLACED: "order-placed",
  ORDER_SHIPPED: "order-shipped",
  EVOUCHER_LOW_STOCK: "evoucher-low-stock",
  EVOUCHER_EXPIRY_SUMMARY: "evoucher-expiry-summary",
} as const

export type RenderedEmail = { subject: string; html: string }

type Amount = number | string | null | undefined

type EmailOrderItem = {
  product_title?: string | null
  variant_title?: string | null
  title?: string | null
  quantity?: Amount
  total?: Amount
}

type EmailOrder = {
  display_id?: number | null
  currency_code?: string | null
  total?: Amount
  subtotal?: Amount
  shipping_total?: Amount
  tax_total?: Amount
  customer?: { first_name?: string | null } | null
  shipping_address?: { first_name?: string | null } | null
  items?: (EmailOrderItem | null)[] | null
}

type EmailFulfillment = {
  labels?: ({ tracking_number?: string | null; tracking_url?: string | null } | null)[] | null
}

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const formatMoney = (amount: Amount, currencyCode?: string | null): string => {
  const value = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0)
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: (currencyCode || "thb").toUpperCase(),
  }).format(Number.isFinite(value) ? value : 0)
}

const isHttpUrl = (url?: string | null): url is string => !!url && /^https?:\/\//i.test(url)

const greetingName = (order: EmailOrder) =>
  order.customer?.first_name || order.shipping_address?.first_name || ""

const layout = (title: string, body: string) =>
  `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>` +
  `<body style="font-family:Arial,sans-serif;color:#18181b;max-width:600px;margin:0 auto;padding:24px">` +
  body +
  `</body></html>`

// CORE-11: อีเมล shipped ส่ง withPrices=false — item เป็นจำนวนที่ส่งรอบนี้ ไม่ใช่ยอดของทั้ง line
const itemsTable = (order: EmailOrder, withPrices = true) => {
  const rows = (order.items ?? [])
    .filter((item): item is EmailOrderItem => !!item)
    .map((item) => {
      const name = [item.product_title || item.title, item.variant_title].filter(Boolean).join(" — ")
      return (
        `<tr><td style="padding:8px 0">${escapeHtml(name)} × ${escapeHtml(item.quantity)}</td>` +
        (withPrices
          ? `<td style="padding:8px 0;text-align:right">${formatMoney(item.total, order.currency_code)}</td>`
          : "") +
        `</tr>`
      )
    })
    .join("")

  return `<table style="width:100%;border-collapse:collapse">${rows}</table>`
}

const totalsTable = (order: EmailOrder) => {
  const row = (label: string, amount: Amount, bold = false) =>
    `<tr${bold ? ' style="font-weight:bold"' : ""}><td>${label}</td>` +
    `<td style="text-align:right">${formatMoney(amount, order.currency_code)}</td></tr>`

  return (
    `<table style="width:100%;border-top:1px solid #e4e4e7;margin-top:16px">` +
    row("ยอดสินค้า / Subtotal", order.subtotal) +
    row("ค่าจัดส่ง / Shipping", order.shipping_total) +
    row("VAT (รวมในราคา / included)", order.tax_total) +
    row("ยอดรวม / Total", order.total, true) +
    `</table>`
  )
}

const renderOrderPlaced = (data: Record<string, unknown>): RenderedEmail => {
  const order = (data.order ?? {}) as EmailOrder
  const orderNo = `#${escapeHtml(order.display_id)}`
  const subject = `ยืนยันคำสั่งซื้อ ${orderNo} / Order ${orderNo} confirmed`

  const body =
    `<h1 style="font-size:20px">ขอบคุณสำหรับคำสั่งซื้อ ${escapeHtml(greetingName(order))}</h1>` +
    `<p>เราได้รับคำสั่งซื้อ ${orderNo} แล้ว และจะแจ้งให้ทราบเมื่อจัดส่ง<br>` +
    `We've received order ${orderNo} and will let you know when it ships.</p>` +
    itemsTable(order) +
    totalsTable(order)

  return { subject, html: layout(subject, body) }
}

const renderOrderShipped = (data: Record<string, unknown>): RenderedEmail => {
  const order = (data.order ?? {}) as EmailOrder
  const fulfillment = (data.fulfillment ?? {}) as EmailFulfillment
  const orderNo = `#${escapeHtml(order.display_id)}`
  const subject = `คำสั่งซื้อ ${orderNo} จัดส่งแล้ว / Order ${orderNo} has shipped`

  const tracking = (fulfillment.labels ?? [])
    .filter((label) => !!label?.tracking_number)
    .map((label) => {
      const number = escapeHtml(label!.tracking_number)
      return isHttpUrl(label!.tracking_url)
        ? `<li><a href="${escapeHtml(label!.tracking_url)}">${number}</a></li>`
        : `<li>${number}</li>`
    })
    .join("")

  const body =
    `<h1 style="font-size:20px">คำสั่งซื้อ ${orderNo} จัดส่งแล้ว ${escapeHtml(greetingName(order))}</h1>` +
    `<p>Your order ${orderNo} is on its way.</p>` +
    (tracking ? `<p>เลขพัสดุ / Tracking number:</p><ul>${tracking}</ul>` : "") +
    itemsTable(order, false)

  return { subject, html: layout(subject, body) }
}

// EV-5: อีเมลถึง admin จาก job รายวันของ e-voucher (ข้อมูลมาจาก src/workflows/evoucher/send-evoucher-stock-alerts.ts)
type EvoucherPoolStock = {
  name?: string | null
  available?: number | null
  low_stock_threshold?: number | null
}

const renderEvoucherLowStock = (data: Record<string, unknown>): RenderedEmail => {
  const pool = (data.pool ?? {}) as EvoucherPoolStock
  const subject = `[E-voucher] code ใกล้หมด: ${pool.name ?? ""} / Low stock`

  const body =
    `<h1 style="font-size:20px">E-voucher code ใกล้หมด / Low stock</h1>` +
    `<p>Pool <b>${escapeHtml(pool.name)}</b> เหลือ code ที่ขายได้ <b>${escapeHtml(pool.available)}</b> ` +
    `(เกณฑ์แจ้งเตือน <b>${escapeHtml(pool.low_stock_threshold)}</b>) — กรุณา import code เพิ่มจากพาร์ทเนอร์<br>` +
    `Available codes are below the threshold. Please import more codes from the partner.</p>`

  return { subject, html: layout(subject, body) }
}

type EvoucherExpirySummary = {
  date?: string
  total_voided?: number
  pools?: ({ name?: string | null; voided?: number } | null)[]
}

const renderEvoucherExpirySummary = (data: Record<string, unknown>): RenderedEmail => {
  const summary = data as EvoucherExpirySummary
  const subject = `[E-voucher] สรุป code ใกล้หมดอายุที่ถูก void ${summary.date ?? ""} / Expiry summary`

  const rows = (summary.pools ?? [])
    .filter((pool) => !!pool)
    .map(
      (pool) =>
        `<tr><td style="padding:4px 0">${escapeHtml(pool!.name)}</td>` +
        `<td style="padding:4px 0;text-align:right">${escapeHtml(pool!.voided)}</td></tr>`
    )
    .join("")

  const body =
    `<h1 style="font-size:20px">สรุป code ที่ถูก void (ใกล้หมดอายุ) / Expiring codes voided</h1>` +
    `<p>code ที่จะหมดอายุภายใน 7 วันถูกหยุดขาย รวม <b>${escapeHtml(summary.total_voided)}</b> code<br>` +
    `Codes expiring within 7 days were voided and removed from stock.</p>` +
    `<table style="width:100%;border-collapse:collapse">${rows}</table>`

  return { subject, html: layout(subject, body) }
}

const renderers: Record<string, (data: Record<string, unknown>) => RenderedEmail> = {
  [EmailTemplates.ORDER_PLACED]: renderOrderPlaced,
  [EmailTemplates.ORDER_SHIPPED]: renderOrderShipped,
  [EmailTemplates.EVOUCHER_LOW_STOCK]: renderEvoucherLowStock,
  [EmailTemplates.EVOUCHER_EXPIRY_SUMMARY]: renderEvoucherExpirySummary,
}

export const renderEmailTemplate = (
  template: string,
  data: Record<string, unknown>
): RenderedEmail | null => {
  const render = renderers[template]
  return render ? render(data) : null
}
