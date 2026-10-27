import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"
import { Heading, Table } from "@modules/common/components/ui"

import Item from "@modules/cart/components/item"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"

type ItemsTemplateProps = {
  cart?: HttpTypes.StoreCart
  flashExceeded?: Record<string, number>
}

const ItemsTemplate = ({ cart, flashExceeded }: ItemsTemplateProps) => {
  const items = cart?.items
  return (
    <div>
      <div className="pb-3 flex items-center">
        <Heading
          className="text-[2rem] leading-[2.75rem]"
          data-testid="cart-title"
        >
          ตะกร้าสินค้า
        </Heading>
      </div>
      <Table>
        <Table.Header className="border-t-0">
          <Table.Row
            className="text-ui-fg-subtle txt-medium-plus"
            data-testid="cart-items-header"
          >
            <Table.HeaderCell className="!pl-0">สินค้า</Table.HeaderCell>
            <Table.HeaderCell></Table.HeaderCell>
            <Table.HeaderCell>จำนวน</Table.HeaderCell>
            <Table.HeaderCell className="hidden small:table-cell">
              ราคา
            </Table.HeaderCell>
            <Table.HeaderCell className="!pr-0 text-right">
              รวม
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
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
                      flashRemaining={flashExceeded?.[item.id]}
                    />
                  )
                })
            : repeat(5).map((i) => {
                return <SkeletonLineItem key={i} />
              })}
        </Table.Body>
      </Table>
    </div>
  )
}

export default ItemsTemplate
