import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  return (
    <div id="product-info">
      <div className="flex flex-col gap-y-4 lg:max-w-[500px] mx-auto">
        {product.collection && (
          <LocalizedClientLink
            href={`/collections/${product.collection.handle}`}
            className="text-muted-foreground hover:text-foreground"
          >
            {product.collection.title}
          </LocalizedClientLink>
        )}
        <h1
          className="text-3xl font-semibold tracking-tight text-foreground"
          data-testid="product-title"
        >
          {product.title}
        </h1>

        <p
          className="text-sm leading-[1.4rem] text-muted-foreground whitespace-pre-line"
          data-testid="product-description"
        >
          {product.description}
        </p>
      </div>
    </div>
  )
}

export default ProductInfo
