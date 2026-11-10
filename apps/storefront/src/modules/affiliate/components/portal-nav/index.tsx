"use client"

import { clx } from "@modules/common/components/ui"
import Link from "next/link"
import { usePathname } from "next/navigation"

const ITEMS = [
  { path: "", label: "สินค้า", testId: "affiliate-nav-products" },
  { path: "/programs", label: "โปรแกรม", testId: "affiliate-nav-programs" },
  { path: "/earnings", label: "รายได้", testId: "affiliate-nav-earnings" },
  { path: "/payouts", label: "การจ่ายเงิน", testId: "affiliate-nav-payouts" },
  { path: "/profile", label: "โปรไฟล์", testId: "affiliate-nav-profile" },
] as const

/** AF-8b (กฎ 33): แถบนำทางของ portal */
export default function PortalNav({ countryCode }: { countryCode: string }) {
  const pathname = usePathname()
  const base = `/${countryCode}/affiliate`

  return (
    <nav className="flex flex-wrap gap-x-6 gap-y-2 border-b border-ui-border-base" aria-label="เมนูแอฟฟิลิเอต">
      {ITEMS.map((item) => {
        const href = `${base}${item.path}`
        const current = pathname === href
        return (
          <Link
            key={item.testId}
            href={href}
            aria-current={current ? "page" : undefined}
            className={clx("pb-2", current && "border-b-2 border-ui-fg-base font-semibold")}
            data-testid={item.testId}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
