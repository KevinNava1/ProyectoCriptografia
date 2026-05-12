// Bloques skeleton reusables sobre `.skeleton-bar` (shimmer 1.6s, ver index.css).
// Mantenemos la API simple: tamaños con clases Tailwind y composiciones útiles
// para los layouts que repetimos en el proyecto.

export function SkeletonBar({ className = '', style }) {
  return <div className={`skeleton-bar ${className}`} style={style} />
}

export function SkeletonCard({ rows = 3, className = '' }) {
  return (
    <div className={`secure-card p-5 ${className}`}>
      <SkeletonBar className="h-4 w-1/3 mb-3" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBar
          key={i}
          className={`h-3 mb-2 ${i === 0 ? 'w-2/3' : i === rows - 1 ? 'w-1/2' : 'w-3/5'}`}
        />
      ))}
    </div>
  )
}

export function SkeletonRow({ className = '' }) {
  return (
    <div
      className={`secure-card flex items-center justify-between gap-4 p-4 ${className}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="skeleton-bar w-11 h-11 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <SkeletonBar className="h-3.5 w-1/2 mb-2" />
          <SkeletonBar className="h-2.5 w-3/4" />
        </div>
      </div>
      <SkeletonBar className="h-6 w-20 rounded-full shrink-0" />
    </div>
  )
}

export function SkeletonStat() {
  return (
    <div className="secure-card relative overflow-hidden min-h-[124px] flex flex-col justify-between p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <SkeletonBar className="h-2.5 w-16" />
        <SkeletonBar className="h-9 w-9 rounded-lg" />
      </div>
      <SkeletonBar className="h-9 w-20 mt-2" />
    </div>
  )
}

export function SkeletonStats({ count = 3 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  )
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="secure-card p-0 overflow-hidden">
      <div
        className="grid gap-4 px-5 py-3 border-b border-[var(--border-subtle)]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, c) => (
          <SkeletonBar key={c} className="h-2.5" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-4 px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBar
              key={c}
              className="h-3"
              style={{ opacity: 0.85 - c * 0.08 }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
