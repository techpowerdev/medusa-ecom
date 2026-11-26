import { HttpTypes } from "@medusajs/types"
import Image from "next/image"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
}

const ImageGallery = ({ images }: ImageGalleryProps) => {
  return (
    <div className="flex items-start relative">
      <div className="flex flex-col flex-1 small:mx-16 gap-y-4">
        {images.map((image, index) => {
          return (
            // SFUI-6 (กฎ 19): เดิม <Container> ของ shim — .bg-white ของ v3 อยู่หลัง .bg-ui-bg-subtle บน develop จึงชนะ → bg-card
            <div
              key={image.id}
              className="relative aspect-[29/34] w-full overflow-hidden rounded-lg bg-card p-4"
              id={image.id}
            >
              {!!image.url && (
                <Image
                  src={image.url}
                  priority={index <= 2 ? true : false}
                  className="absolute inset-0 rounded-rounded"
                  alt={`รูปสินค้า ${index + 1}`}
                  fill
                  sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
                  style={{
                    objectFit: "cover",
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ImageGallery
