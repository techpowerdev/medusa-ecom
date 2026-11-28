import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import Item from "@modules/cart/components/item"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"

type ItemsTemplateProps = {
  cart?: HttpTypes.StoreCart
  flashExceeded?: Record<string, number>
  flashCustomerLimit?: Record<string, number>
}

const ItemsTemplate = ({
  cart,
  flashExceeded,
  flashCustomerLimit,
}: ItemsTemplateProps) => {
  const items = cart?.items
  return (
    <div>
      <div className="pb-3 flex items-center">
        <h2
          className="font-semibold text-[2rem] leading-[2.75rem]"
          data-testid="cart-title"
        >
          ตะกร้าสินค้า
        </h2>
      </div>
      {/* CORE-47 (กฎข้อ 105b): < small ตารางเป็น block ให้แถวเป็นการ์ด (grid ใน Item) และซ่อนหัวคอลัมน์ — ≥ small ตารางเดิม */}
      <Table className="max-small:block">
        <TableHeader className="border-t-0 max-small:hidden">
          <TableRow
            className="text-muted-foreground text-sm leading-[1.4rem] font-medium"
            data-testid="cart-items-header"
          >
            {/* CORE-42 (กฎข้อ 100a): padding < small ตรงกับ cell ของ Item (≥ small คงเดิม)
                SFUI-5c: shadcn TableHead เริ่มที่ px-2 — ใส่ px-4 เดิมของ shim เอง (spec 09 กฎ 21, core-42/47)
                และ text-muted-foreground (TableHead ของ shadcn ตั้ง text-foreground ทับสีของแถวหัวตาราง)
                SFUI-6 (กฎ 19): Table.HeaderCell เดิมสูง h-12 และไม่มี whitespace-nowrap ของ shadcn TableHead (h-10) */}
            <TableHead className="h-12 whitespace-normal px-4 pl-0! pr-2 small:pr-4 text-muted-foreground">
              สินค้า
            </TableHead>
            <TableHead className="h-12 whitespace-normal px-2 small:px-4 text-muted-foreground"></TableHead>
            <TableHead className="h-12 whitespace-normal px-2 small:px-4 text-muted-foreground">
              จำนวน
            </TableHead>
            {/* SFUI-24c (spec 01 กฎข้อ 159a): ไม่มีคอลัมน์ยอดรวม — ราคาต่อชิ้นอยู่คอลัมน์สุดท้าย */}
            <TableHead className="h-12 whitespace-normal px-4 pr-0! text-right text-muted-foreground">
              ราคา
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="max-small:block">
          {items
            ? items
                .sort((a, b) => {
                  return (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
                })
                .map((item) => {
                  return (
                    <Item
                      key={item.id}
                      item={item}
                      currencyCode={cart?.currency_code}
                      promotions={cart?.promotions}
                      flashRemaining={flashExceeded?.[item.id]}
                      flashCustomerRemaining={flashCustomerLimit?.[item.id]}
                    />
                  )
                })
            : repeat(5).map((i) => {
                return <SkeletonLineItem key={i} />
              })}
        </TableBody>
      </Table>
    </div>
  )
}

export default ItemsTemplate
