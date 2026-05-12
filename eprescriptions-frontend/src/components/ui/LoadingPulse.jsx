import { SkeletonList } from './Skeleton'

// API legacy — sigue siendo `<LoadingPulse rows={N} />` para no romper páginas
// existentes, pero ahora delega en el skeleton rico (icono + 2 líneas + pill)
// que se ve mucho más cercano al estado final cargado.
export default function LoadingPulse({ rows = 3, className = '' }) {
  return (
    <div className={className}>
      <SkeletonList rows={rows} />
    </div>
  )
}
