import { defineRouteConfig } from "@medusajs/admin-sdk"
import { LayoutComposer } from "@medusajs/dashboard/components"
import { GiftCards } from "@medusajs/icons"
import { Container } from "../../components/common/container"
import { PartnersSection } from "../../components/evoucher/partners-section"
import { PoolsTable } from "../../components/evoucher/pools-table"

// EV-6: หน้า "E-vouchers" — pool (สต็อก code ต่อสถานะ + low-stock) และพาร์ทเนอร์
// การสร้าง pool ทำจาก widget บนหน้า variant (รู้ variant_id อยู่แล้ว)
// ADM-4: layout ด้วย LayoutComposer (core:single-column) ของ dashboard; หัวของตาราง pool ใช้ heading/subHeading
// ของ DataTable (แบบหน้า list ของ Medusa) แทน Header แยกที่จะซ้อนกับ toolbar ของตาราง
const EvouchersPage = () => {
  return (
    <LayoutComposer
      widgetsZonePrefix="evoucher.list"
      preferredLayoutId="core:single-column"
      sections={{
        main: (
          <>
            <LayoutComposer.Entry id="EvoucherPoolsTable">
              <Container>
                <PoolsTable />
              </Container>
            </LayoutComposer.Entry>
            <LayoutComposer.Entry id="EvoucherPartnersSection">
              <PartnersSection />
            </LayoutComposer.Entry>
          </>
        ),
      }}
    />
  )
}

export const config = defineRouteConfig({
  label: "E-vouchers",
  icon: GiftCards,
})

// ADM-11 (spec 08 กฎ 14): breadcrumb ระดับแรกของหน้า pool = "E-vouchers" (ลิงก์ไป /evouchers)
export const handle = { breadcrumb: () => "E-vouchers" }

export default EvouchersPage
