import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Filter, Pill, RefreshCcw } from 'lucide-react'
import PageTransition from '../components/ui/PageTransition'
import RxTemplate from '../components/ui/RxTemplate'
import LoadingPulse from '../components/ui/LoadingPulse'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import SearchInput from '../components/ui/SearchInput'
import PageHero from '../components/ui/PageHero'
import iconPillBottle from '../assets/icons/pill-bottle.png'
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
  // Bumpear `version` re-dispara el useEffect de fetch — usado por el botón
  // Refrescar para repedir las recetas con sus flags cripto_ok actuales.
  const [version, setVersion] = useState(0)

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
  }, [user, version])

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
        <PageHero
          eyebrow="Paciente"
          title="Mis recetas"
          subtitle="Voltea cada tarjeta para ver la firma cripto del médico."
          iconImg={iconPillBottle}
          accent="#0A84FF"
        >
          <button
            type="button"
            onClick={() => {
              setFlippedId(null)
              setVersion((v) => v + 1)
            }}
            className="btn btn-ghost btn-sm"
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} /> Refrescar
          </button>
        </PageHero>

        {/* Toolbar — buscador + filtros por estado */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar por medicamento, médico, estado…"
          />

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
