import { defineRouteConfig } from "@medusajs/admin-sdk"
import { GiftCards } from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"
import { PartnersSection } from "../../components/evoucher/partners-section"
import { PoolsTable } from "../../components/evoucher/pools-table"

// EV-6: หน้า "E-vouchers" — pool (สต็อก code ต่อสถานะ + low-stock) และพาร์ทเนอร์
// การสร้าง pool ทำจาก widget บนหน้า variant (รู้ variant_id อยู่แล้ว)
const EvouchersPage = () => {
  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="flex flex-col gap-y-1 px-6 py-4">
          <Heading level="h1">E-voucher pools</Heading>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            Create a pool from a product variant page (Voucher pool widget), then import partner codes here.
          </Text>
        </div>
        <PoolsTable />
      </Container>
      <PartnersSection />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "E-vouchers",
  icon: GiftCards,
})

export default EvouchersPage
