import { HttpTypes } from "@medusajs/types"
import { TableCell, TableRow } from "@/components/ui/table"

import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import Thumbnail from "@modules/products/components/thumbnail"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem | HttpTypes.StoreOrderLineItem
  currencyCode: string
}

const Item = ({ item, currencyCode }: ItemProps) => {
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
        <span className="pr-0! flex flex-col items-end h-full justify-center">
          <span className="flex gap-x-1 ">
            <p className="text-sm leading-[1.4rem] text-muted-foreground">
              <span data-testid="product-quantity">{item.quantity}</span>x{" "}
            </p>
            {/* CORE-65 (spec 01 กฎข้อ 123): ชิ้นเดียว ราคาต่อหน่วย = ราคารวม → ไม่แสดงซ้ำ */}
            {item.quantity > 1 && (
              <LineItemUnitPrice
                item={item}
                style="tight"
                currencyCode={currencyCode}
              />
            )}
          </span>

          <LineItemPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
      </TableCell>
    </TableRow>
  )
}

export default Item
