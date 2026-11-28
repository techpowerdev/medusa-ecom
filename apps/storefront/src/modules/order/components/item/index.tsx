import { PricedPromotion } from "@lib/util/price-breakdown"
import { HttpTypes } from "@medusajs/types"
import { TableCell, TableRow } from "@/components/ui/table"

import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import Thumbnail from "@modules/products/components/thumbnail"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem
  currencyCode: string
  /** SFUI-24c (กฎข้อ 159): promotions ของ order — ราคาต่อชิ้นหักเฉพาะส่วนลดอัตโนมัติ */
  promotions?: PricedPromotion[] | null
}

const Item = ({ item, currencyCode, promotions }: ItemProps) => {
  return (
    <TableRow className="w-full" data-testid="product-row">
      <TableCell className="p-4 pl-0! w-24 whitespace-normal">
        <div className="flex w-16">
          <Thumbnail thumbnail={item.thumbnail} size="square" />
        </div>
      </TableCell>

      <TableCell className="p-4 text-left whitespace-normal">
        <p
          className="text-sm leading-[1.4rem] font-medium text-foreground"
          data-testid="product-name"
        >
          {item.product_title}
        </p>
        <LineItemOptions variant={item.variant} data-testid="product-variant" />
      </TableCell>

      <TableCell className="p-4 pr-0! whitespace-normal">
        {/* SFUI-24c (spec 01 กฎข้อ 159a): "ราคาต่อชิ้น × จำนวน" ทุก qty ไม่มียอดรวมต่อแถว */}
        <LineItemUnitPrice
          item={item}
          promotions={promotions}
          style="tight"
          currencyCode={currencyCode}
          showQuantity
        />
      </TableCell>
    </TableRow>
  )
}

export default Item
