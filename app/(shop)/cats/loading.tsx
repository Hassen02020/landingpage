export default function CategoryLoading() {
  return (
    <div className="container animate-pulse py-10">
      <div className="h-8 w-56 rounded bg-ink-100" />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-ink-100" />
        ))}
      </div>
    </div>
  )
}
