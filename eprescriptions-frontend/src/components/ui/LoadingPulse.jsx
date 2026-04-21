export default function LoadingPulse({ rows = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="secure-card p-5">
          <div className="skeleton-bar h-4 w-1/3 mb-3" />
          <div className="skeleton-bar h-3 w-2/3 mb-2" />
          <div className="skeleton-bar h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}
