import { Metadata } from "next"

import { STORE_NAME } from "@lib/util/site"
import { PolicyPage } from "@modules/policies/templates"

export const dynamic = "force-static"
export const revalidate = 60

export const metadata: Metadata = {
  title: "ติดต่อเรา",
  description: `ช่องทางติดต่อ ${STORE_NAME}`,
}

// CORE-85 (spec 01 กฎข้อ 141): ข้อมูลติดต่อจริงที่ owner ส่ง 2026-11-23 — แก้ค่าที่นี่ที่เดียว
const CHANNELS: { label: string; value: string; href?: string; external?: boolean }[] = [
  { label: "อีเมล", value: "support@khumkha.com", href: "mailto:support@khumkha.com" },
  { label: "โทรศัพท์", value: "02-862-3331", href: "tel:+6628623331" },
  {
    label: "ไลน์",
    value: "@khumkha",
    href: "https://line.me/R/ti/p/%40khumkha",
    external: true,
  },
  {
    label: "ที่อยู่",
    value:
      "77/186 อาคารสินสาธรทาวเวอร์ ชั้น 41 ถนนกรุงธนบุรี แขวงคลองต้นไทร เขตคลองสาน กรุงเทพมหานคร 10600",
  },
]

export default function ContactPage() {
  return (
    <PolicyPage title="ติดต่อเรา">
      <p data-testid="contact-intro">
        สอบถามเรื่องคำสั่งซื้อ การจัดส่ง หรือการคืนสินค้าได้ตามช่องทางด้านล่าง
        โปรดแจ้งเลขที่คำสั่งซื้อเพื่อให้เราช่วยเหลือได้รวดเร็วขึ้น
      </p>
      <ul className="flex flex-col gap-4" data-testid="contact-channels">
        {CHANNELS.map((channel) => (
          <li
            key={channel.label}
            className="flex flex-col gap-1 small:flex-row small:gap-6"
            data-testid="contact-channel"
          >
            <span
              className="text-ui-fg-subtle small:w-32 small:shrink-0 small:py-2.5"
              data-testid="contact-channel-label"
            >
              {channel.label}
            </span>
            {channel.href ? (
              <a
                href={channel.href}
                className="inline-flex min-h-[44px] items-center break-all text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
                {...(channel.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {channel.value}
              </a>
            ) : (
              <span className="small:py-2.5">{channel.value}</span>
            )}
          </li>
        ))}
      </ul>
      <p data-testid="contact-hours">เวลาทำการ: จันทร์–ศุกร์ 09:00–18:00 น.</p>
    </PolicyPage>
  )
}
