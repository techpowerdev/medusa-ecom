import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ChevronDown from "@modules/common/icons/chevron-down"
import { STORE_NAME } from "@lib/store-content"

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full bg-white relative small:min-h-screen">
      <div className="h-16 bg-white border-b ">
        <nav className="flex h-full items-center content-container justify-between">
          <LocalizedClientLink
            href="/cart"
            className="text-small-semi text-foreground flex items-center gap-x-2 uppercase flex-1 basis-0"
            data-testid="back-to-cart-link"
          >
            <ChevronDown className="rotate-90" size={16} />
            <span className="mt-px hidden small:block text-muted-foreground hover:text-foreground">
              กลับไปที่ตะกร้าสินค้า
            </span>
            <span className="mt-px block small:hidden text-muted-foreground hover:text-foreground">
              กลับ
            </span>
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/"
            className="text-lg leading-5 font-medium text-muted-foreground hover:text-foreground uppercase"
            data-testid="store-link"
          >
            {STORE_NAME}
          </LocalizedClientLink>
          <div className="flex-1 basis-0" />
        </nav>
      </div>
      <div className="relative" data-testid="checkout-container">{children}</div>
    </div>
  )
}
