"use client"

import Back from "@modules/common/icons/back"
import FastDelivery from "@modules/common/icons/fast-delivery"
import Refresh from "@modules/common/icons/refresh"

import Accordion from "./accordion"
import { HttpTypes } from "@medusajs/types"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const ProductTabs = ({ product }: ProductTabsProps) => {
  const tabs = [
    {
      key: "information",
      label: "ข้อมูลสินค้า",
      component: <ProductInfoTab product={product} />,
    },
    {
      key: "shipping",
      label: "การจัดส่งและการคืนสินค้า",
      component: <ShippingInfoTab />,
    },
  ]

  return (
    <div className="w-full">
      <Accordion type="multiple">
        {tabs.map((tab) => (
          <Accordion.Item
            key={tab.key}
            title={tab.label}
            headingSize="medium"
            value={tab.key}
            data-testid={`product-tab-${tab.key}`}
          >
            {tab.component}
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  )
}

const ProductInfoTab = ({ product }: ProductTabsProps) => {
  return (
    <div className="text-small-regular py-8">
      <div className="grid grid-cols-2 gap-x-8">
        <div className="flex flex-col gap-y-4">
          <div>
            <span className="font-semibold">วัสดุ</span>
            <p>{product.material ? product.material : "-"}</p>
          </div>
          <div>
            <span className="font-semibold">ประเทศผู้ผลิต</span>
            <p>{product.origin_country ? product.origin_country : "-"}</p>
          </div>
          <div>
            <span className="font-semibold">ประเภท</span>
            <p>{product.type ? product.type.value : "-"}</p>
          </div>
        </div>
        <div className="flex flex-col gap-y-4">
          <div>
            <span className="font-semibold">น้ำหนัก</span>
            <p>{product.weight ? `${product.weight} กรัม` : "-"}</p>
          </div>
          <div>
            <span className="font-semibold">ขนาด</span>
            <p>
              {product.length && product.width && product.height
                ? `ยาว ${product.length} × กว้าง ${product.width} × สูง ${product.height}`
                : "-"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const ShippingInfoTab = () => {
  return (
    <div className="text-small-regular py-8">
      <div className="grid grid-cols-1 gap-y-8">
        <div className="flex items-start gap-x-2">
          <FastDelivery />
          <div>
            <span className="font-semibold">จัดส่งรวดเร็ว</span>
            <p className="max-w-sm">
              พัสดุจะถึงจุดรับสินค้าหรือที่บ้านของคุณภายใน 3-5 วันทำการ
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Refresh />
          <div>
            <span className="font-semibold">เปลี่ยนสินค้าง่าย</span>
            <p className="max-w-sm">
              ขนาดไม่พอดีใช่ไหม ไม่ต้องกังวล เราเปลี่ยนสินค้าชิ้นใหม่ให้
            </p>
          </div>
        </div>
        <div className="flex items-start gap-x-2">
          <Back />
          <div>
            <span className="font-semibold">คืนสินค้าสะดวก</span>
            <p className="max-w-sm">
              ส่งสินค้าคืนแล้วเราจะคืนเงินให้ ไม่ต้องให้เหตุผล
              เราจะดูแลให้การคืนสินค้าราบรื่นที่สุด
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductTabs
