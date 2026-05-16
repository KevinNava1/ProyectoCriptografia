import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Filter, Pill, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import RxTemplate from '../components/ui/RxTemplate'
import LoadingPulse from '../components/ui/LoadingPulse'
import EmptyState from '../components/ui/EmptyState'
import { listContainer, listItem } from '../lib/animations'
import { useAuthStore } from '../store/useAuthStore'
import { recetasAPI } from '../api'

const FILTERS = [
  { id: 'all',        label: 'Todas'      },
  { id: 'emitida',    label: 'Emitidas'   },
  { id: 'dispensada', label: 'Dispensadas'},
]

// Cuántas recetas por página. La rejilla es auto-fit, así que esto es solo
// el corte de paginación — no fija el nº de columnas.
const PAGE_SIZE = 10

// Ventana de páginas a pintar: 1 … (n-1) n (n+1) … last. Para miles de
// recetas no tiene sentido listar 80 botones.
function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out = [1]
  if (current > 4) out.push('…')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) out.push(i)
  if (current < total - 3) out.push('…')
  out.push(total)
  return out
}

function PageBtn({ children, active, disabled, onClick, label }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="min-w-[38px] h-9 px-2.5 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1 transition-all disabled:opacity-35 disabled:cursor-not-allowed"
      style={
        active
          ? { background: 'linear-gradient(135deg,#0A84FF,#0052CC)', color: '#fff', boxShadow: '0 4px 14px rgba(10,132,255,0.32)' }
          : { background: 'rgba(255,255,255,0.72)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }
      }
    >
      {children}
    </button>
  )
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap pt-2">
      <PageBtn disabled={page === 1} onClick={() => onChange(page - 1)} label="Página anterior">
        <ChevronLeft size={15} />
        <span className="hidden sm:inline">Anterior</span>
      </PageBtn>
      {pageWindow(page, totalPages).map((p, i) =>
        p === '…'
          ? <span key={`gap-${i}`} className="px-1 text-[color:var(--text-secondary)] select-none">…</span>
          : <PageBtn key={p} active={p === page} onClick={() => onChange(p)} label={`Página ${p}`}>{p}</PageBtn>
      )}
      <PageBtn disabled={page === totalPages} onClick={() => onChange(page + 1)} label="Página siguiente">
        <span className="hidden sm:inline">Siguiente</span>
        <ChevronRight size={15} />
      </PageBtn>
    </div>
  )
}

export default function MisRecetas() {
  const user = useAuthStore(s => s.user)
  const [searchParams] = useSearchParams()
  const initialFilter = ['all', 'emitida', 'dispensada'].includes(searchParams.get('filter'))
    ? searchParams.get('filter')
    : 'all'
  const [recetas, setRecetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState(initialFilter)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  // Cuando el paciente voltea una receta a ver su firma, queremos que las
  // demás se difuminen para enfocar la vista. flippedId es el id que está
  // mostrando el reverso; null = nada flipped.
  const [flippedId, setFlippedId] = useState(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await recetasAPI.porPaciente(user.id)
        if (!cancelled) setRecetas(data || [])
      } catch (err) {
        if (!cancelled) setError(err?.uiMessage || 'No se pudieron cargar las recetas')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  // Filtro por estado + búsqueda de texto libre (medicamento, médico, estado,
  // instrucciones, nº de receta).
  const filtered = useMemo(() => {
    const base = filter === 'all' ? recetas : recetas.filter(r => r.estado === filter)
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter(r => {
      const haystack = [
        r.medicamento, r.dosis, r.estado, r.instrucciones,
        r.medico_username, `#${r.id}`,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [recetas, filter, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  // Si cambia el filtro o la búsqueda, volvemos a la página 1 y cerramos
  // cualquier receta volteada (podría haber quedado fuera de la página).
  useEffect(() => { setPage(1); setFlippedId(null) }, [filter, query])

  const safePage = Math.min(page, totalPages)
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  )

  const goToPage = (p) => {
    setFlippedId(null)
    setPage(Math.min(Math.max(1, p), totalPages))
  }

  const rangeFrom = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <PageTransition>
      <div className="space-y-6">
        <header className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="label-xs">Paciente</div>
            <h1 className="font-heading text-3xl md:text-4xl mt-2 flex items-center gap-3">
              <Pill className="text-[color:var(--cyan)]" /> Mis recetas
            </h1>
            <p className="text-[color:var(--text-secondary)] text-sm mt-2 max-w-xl">
              Toca "Ver firma" en cada receta para mostrar la huella SHA3-256 y la firma ECDSA P-256 + SHA3-256 del médico.
            </p>
          </div>
        </header>

        {/* Toolbar — buscador + filtros por estado */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)] pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por medicamento, médico, estado…"
              className="input-field"
              style={{ paddingLeft: '2.3rem', paddingRight: query ? '2.3rem' : '0.95rem' }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 glass rounded-xl p-1 self-start sm:self-auto">
            <Filter size={14} className="text-[color:var(--text-secondary)] ml-2" />
            {FILTERS.map(f => {
              const active = filter === f.id
              return (
                <motion.button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  whileTap={{ scale: 0.97 }}
                  className="relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ color: active ? '#FFFFFF' : 'var(--text-secondary)' }}
                >
                  {active && (
                    <motion.span
                      layoutId="mis-recetas-filter"
                      className="absolute inset-0 rounded-lg"
                      style={{ background: 'linear-gradient(135deg,#0A84FF,#0052CC)', boxShadow: '0 4px 14px rgba(10,132,255,0.32)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{f.label}</span>
                </motion.button>
              )
            })}
          </div>
        </div>

        {loading && <LoadingPulse rows={4} />}
        {!loading && error && <EmptyState title="Error" message={error} />}
        {!loading && !error && recetas.length === 0 && (
          <EmptyState
            title="Sin recetas todavía"
            message="Cuando un médico te emita una receta, aparecerá aquí cifrada con AES-128-GCM."
          />
        )}
        {!loading && !error && recetas.length > 0 && filtered.length === 0 && (
          <EmptyState
            title="Ninguna coincide"
            message="Ajusta el filtro de estado o el texto de búsqueda para ver tus recetas."
          />
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* Leyenda animada: vuelve a entrar con un fade cada vez que el
                  rango cambia (al paginar o filtrar) para que se note. */}
              <motion.span
                key={`${rangeFrom}-${rangeTo}-${filtered.length}`}
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="text-xs text-[color:var(--text-secondary)] font-mono"
              >
                Mostrando <strong className="text-[color:var(--text-primary)]">{rangeFrom}–{rangeTo}</strong> de {filtered.length} receta{filtered.length === 1 ? '' : 's'}
              </motion.span>
              <span className="text-xs text-[color:var(--text-secondary)] font-mono">
                Página {safePage} / {totalPages}
              </span>
            </div>

            <motion.div
              key={`${filter}-${query}-${safePage}`}
              variants={listContainer}
              initial="initial"
              animate="animate"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))',
                gap: '1.25rem',
              }}
            >
              {pageItems.map(r => (
                <motion.div key={r.id} variants={listItem}>
                  <RxTemplate
                    receta={r}
                    flipped={flippedId === r.id}
                    dimmed={flippedId !== null && flippedId !== r.id}
                    onFlipChange={(f) => setFlippedId(f ? r.id : null)}
                  />
                </motion.div>
              ))}
            </motion.div>

            <Pagination page={safePage} totalPages={totalPages} onChange={goToPage} />
          </>
        )}
      </div>
    </PageTransition>
  )
}
