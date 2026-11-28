import repeat from "@lib/util/repeat"
import { PricedPromotion } from "@lib/util/price-breakdown"
import { HttpTypes } from "@medusajs/types"
import { Table, TableBody } from "@/components/ui/table"

import Divider from "@modules/common/components/divider"
import Item from "@modules/order/components/item"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"

type ItemsProps = {
  /** SFUI-24c: `promotions` (retrieveOrder ขอ code/is_automatic — กฎข้อ 158f) ไม่อยู่ใน type ของ StoreOrder */
  order: HttpTypes.StoreOrder & { promotions?: PricedPromotion[] | null }
}

const Items = ({ order }: ItemsProps) => {
  const items = order.items

  return (
    <div className="flex flex-col">
      <Divider className="mb-0!" />
      <Table>
        <TableBody data-testid="products-table">
          {items?.length
            ? items
                .sort((a, b) => {
                  return (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1
                })
                .map((item) => {
                  return (
                    <Item
                      key={item.id}
                      item={item}
                      currencyCode={order.currency_code}
                      promotions={order.promotions}
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

export default Items
