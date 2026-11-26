const SkeletonProductPreview = () => {
  return (
    <div className="animate-pulse">
      {/* SFUI-6 (กฎ 19): เดิมเป็น <Container> ของ shim (clsx "bg-white rounded-lg p-4" + class ผู้เรียก) — ใน CSS ของ v3 บน develop .bg-white/.p-4 อยู่หลัง .bg-gray-100/.bg-ui-bg-subtle จึงชนะ → พื้นขาว */}
      <div className="rounded-lg bg-card p-4 aspect-[9/16] w-full" />
      <div className="flex justify-between text-base-regular mt-2">
        <div className="w-2/5 h-6 bg-gray-100"></div>
        <div className="w-1/5 h-6 bg-gray-100"></div>
      </div>
    </div>
  )
}

export default SkeletonProductPreview
