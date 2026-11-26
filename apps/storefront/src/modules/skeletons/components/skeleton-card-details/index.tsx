const SkeletonCardDetails = () => {
  return (
    <div className="flex flex-col gap-1 my-4 transition-all duration-150 ease-in-out" data-testid="skeleton-card-details">
      <div className="h-4 bg-muted rounded-md w-1/4 animate-pulse mb-1"></div>
      <div className="pt-3 pb-1 block w-full h-11 px-4 mt-0 bg-background border rounded-md appearance-none border-input animate-pulse" />
    </div>
  )
}

export default SkeletonCardDetails
